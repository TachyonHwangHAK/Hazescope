// Lightweight SVG line chart with band shading, lerped morphs, crosshair tooltip and table view.
import { s, h, clamp, lerp, isNum, fmtTime } from './util.js';
import { tween } from './anim.js';

function niceMax(v, step) { return Math.max(step, Math.ceil(v / step) * step); }

export class LineChart {
  constructor(root, legendEl, tableEl, opts) {
    this.root = root; this.legendEl = legendEl; this.tableEl = tableEl; this.opts = opts;
    this.hidden = new Set(); this.data = null; this.prev = null; this.cancel = null; this.hoverIdx = null;
    this.svg = s('svg', { role: 'img', 'aria-hidden': 'false' });
    this.tip = h('div', { class: 'chart-tip', 'aria-hidden': 'true' });
    this.empty = h('div', { class: 'chart-empty' });
    root.append(this.svg, this.tip, this.empty);
    this.gBands = s('g'); this.gGrid = s('g'); this.gSeries = s('g'); this.gHover = s('g', { 'pointer-events': 'none' });
    this.overlay = s('rect', { fill: 'transparent', tabindex: '0', class: 'chart-overlay' });
    this.svg.append(this.gBands, this.gGrid, this.gSeries, this.gHover, this.overlay);
    this.overlay.addEventListener('pointermove', (e) => this._onPointer(e));
    this.overlay.addEventListener('pointerdown', (e) => this._onPointer(e));
    this.overlay.addEventListener('pointerleave', () => this._hideHover());
    this.overlay.addEventListener('blur', () => this._hideHover());
    this.overlay.addEventListener('keydown', (e) => this._onKey(e));
    this.overlay.addEventListener('focus', () => { if (this.data && this.hoverIdx == null) this._showHover(this.data.times.length - 1); });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.render(false)).observe(root);
    else window.addEventListener('resize', () => this.render(false));
  }

  update(data) {
    this.data = data;
    this.render(true);
    this._renderLegend();
    this._renderTable();
  }
  refreshLabels() { this.render(false); this._renderLegend(); this._renderTable(); }

  _dims() {
    const W = Math.max(280, this.root.clientWidth), H = Math.max(200, this.root.clientHeight);
    return { W, H, ml: 40, mr: 10, mt: 10, mb: 26 };
  }

  render(animate) {
    const d = this.data; if (!d) return;
    const { W, H, ml, mr, mt, mb } = this._dims();
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.svg.setAttribute('aria-label', d.ariaLabel || '');
    const n = d.times.length;
    const visible = d.series.filter((sr) => !this.hidden.has(sr.id));
    const vmax = Math.max(0, ...visible.flatMap((sr) => sr.values.filter(isNum)));
    this.empty.textContent = n ? '' : (d.emptyText || '');
    this.empty.hidden = !!n;

    const yMax = niceMax(Math.max(vmax * 1.12, d.minTop || 0), d.step || 50);
    const x0 = d.times[0]?.getTime() || 0, x1 = d.times[n - 1]?.getTime() || 1;
    const xs = (t) => ml + ((t - x0) / Math.max(1, x1 - x0)) * (W - ml - mr);
    const ys = (v) => mt + (1 - v / yMax) * (H - mt - mb);
    this._scale = { xs, ys, ml, mr, mt, mb, W, H };

    // Bands
    this.gBands.replaceChildren();
    for (const b of d.bands || []) {
      if (b.min > yMax) continue;
      const yTop = ys(Math.min(b.max === Infinity ? yMax : b.max, yMax)), yBot = ys(Math.max(0, b.min === 0 ? 0 : b.min - 1));
      this.gBands.append(s('rect', { x: ml, y: yTop, width: W - ml - mr, height: Math.max(0, yBot - yTop), fill: b.color, 'fill-opacity': 0.07 }));
      if (yBot - yTop > 16) this.gBands.append(s('text', { x: W - mr - 6, y: yTop + 13, 'text-anchor': 'end', class: 'band-label', fill: b.color, text: b.label }));
    }
    // Grid & axes
    this.gGrid.replaceChildren();
    let tickStep = d.step || 50;
    while (yMax / tickStep > 5) tickStep *= 2;
    for (let v = 0; v <= yMax + 0.001; v += tickStep) {
      const y = ys(v); const i = v;
      this.gGrid.append(s('line', { x1: ml, x2: W - mr, y1: y, y2: y, class: i === 0 ? 'axis-line' : 'grid-line' }));
      this.gGrid.append(s('text', { x: ml - 8, y: y + 4, 'text-anchor': 'end', class: 'tick', text: Math.round(v) }));
    }
    if (n > 1) {
      const every = W < 520 ? 6 : 3;
      d.times.forEach((t, i) => {
        const hr = Math.round((t.getTime() / 3600_000 + 8) % 24);
        if (hr % every !== 0) return;
        const x = xs(t.getTime());
        if (x < ml + 14 || x > W - mr - 14) return;
        this.gGrid.append(s('text', { x, y: H - 6, 'text-anchor': 'middle', class: 'tick', text: fmtTime(t, this.opts.lang()) }));
      });
    }
    this.overlay.setAttribute('x', ml); this.overlay.setAttribute('y', mt);
    this.overlay.setAttribute('width', Math.max(0, W - ml - mr)); this.overlay.setAttribute('height', Math.max(0, H - mt - mb));

    // Series with morph
    const colors = this.opts.colors();
    const target = d.series.map((sr) => sr.values.map((v, i) => (isNum(v) ? [xs(d.times[i].getTime()), ys(v)] : null)));
    if (!this.paths || this.paths.length !== d.series.length) {
      this.gSeries.replaceChildren();
      this.paths = d.series.map(() => { const p = s('path', { class: 'series' }); this.gSeries.append(p); return p; });
    }
    d.series.forEach((sr, i) => {
      this.paths[i].setAttribute('stroke', colors[i % colors.length]);
      this.paths[i].classList.toggle('is-hidden', this.hidden.has(sr.id));
    });
    const from = this.prev && animate ? this.prev : null;
    if (this.cancel) this.cancel();
    const drawAt = (t) => {
      target.forEach((pts, si) => {
        const prevPts = from && from[si];
        let dStr = '', pen = false;
        pts.forEach((pt, i) => {
          if (!pt) { pen = false; return; }
          let p = pt;
          if (prevPts && prevPts.length) {
            const j = Math.round((i / Math.max(1, pts.length - 1)) * (prevPts.length - 1));
            const q = prevPts[j] || prevPts.find(Boolean);
            if (q) p = [lerp(q[0], pt[0], t), lerp(q[1], pt[1], t)];
          }
          dStr += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`; pen = true;
        });
        this.paths[si].setAttribute('d', dStr);
      });
    };
    if (from) this.cancel = tween(720, drawAt); else drawAt(1);
    this.prev = target;
    if (this.hoverIdx != null) this._showHover(Math.min(this.hoverIdx, n - 1));
  }

  _onPointer(e) {
    if (!this.data || !this._scale || !this.data.times.length) return;
    const rect = this.svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * this._scale.W;
    let best = 0, bd = Infinity;
    this.data.times.forEach((t, i) => { const dx = Math.abs(this._scale.xs(t.getTime()) - px); if (dx < bd) { bd = dx; best = i; } });
    this._showHover(best);
  }
  _onKey(e) {
    if (!this.data) return;
    const n = this.data.times.length; if (!n) return;
    let i = this.hoverIdx ?? n - 1;
    if (e.key === 'ArrowLeft') i = Math.max(0, i - 1);
    else if (e.key === 'ArrowRight') i = Math.min(n - 1, i + 1);
    else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = n - 1;
    else if (e.key === 'Escape') { this._hideHover(); return; } else return;
    e.preventDefault(); this._showHover(i);
  }
  _showHover(i) {
    const d = this.data; const sc = this._scale; if (!d || !sc || !d.times[i]) return;
    this.hoverIdx = i;
    const colors = this.opts.colors();
    const x = sc.xs(d.times[i].getTime());
    this.gHover.replaceChildren(s('line', { x1: x, x2: x, y1: sc.mt, y2: sc.H - sc.mb, class: 'crosshair' }));
    const rows = [];
    d.series.forEach((sr, si) => {
      if (this.hidden.has(sr.id)) return;
      const v = sr.values[i];
      if (isNum(v)) this.gHover.append(s('circle', { cx: x, cy: sc.ys(v), r: 4.5, fill: colors[si % colors.length], class: 'hover-dot' }));
      rows.push({ label: sr.label, v, c: colors[si % colors.length] });
    });
    rows.sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
    this.tip.replaceChildren(
      h('div', { class: 'tip-time', text: `${fmtTime(d.times[i], this.opts.lang())} ${d.unitLabel || ''}` }),
      ...rows.map((r) => h('div', { class: 'tip-row' }, h('i', { style: { background: r.c } }), h('span', { text: r.label }), h('b', { text: isNum(r.v) ? Math.round(r.v) : '—' }))),
    );
    const rect = this.root.getBoundingClientRect();
    const scaleX = rect.width / sc.W;
    const tw = this.tip.offsetWidth || 160, th = this.tip.offsetHeight || 120;
    let left = x * scaleX + 14; if (left + tw > rect.width) left = x * scaleX - tw - 14;
    left = clamp(left, 0, Math.max(0, rect.width - tw));
    const top = clamp(sc.mt + 4, 0, Math.max(0, rect.height - th));
    this.tip.style.transform = `translate(${left}px, ${top}px)`;
    this.tip.classList.add('is-on');
  }
  _hideHover() { this.hoverIdx = null; this.gHover.replaceChildren(); this.tip.classList.remove('is-on'); }

  _renderLegend() {
    const d = this.data; if (!d) return;
    const colors = this.opts.colors();
    this.legendEl.replaceChildren(...d.series.map((sr, i) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(!this.hidden.has(sr.id)) }, h('i', { style: { background: colors[i % colors.length] } }), sr.label);
      b.addEventListener('click', () => {
        const visibleCount = d.series.filter((x) => !this.hidden.has(x.id)).length;
        if (!this.hidden.has(sr.id) && visibleCount === 1) return; // keep at least one line
        this.hidden.has(sr.id) ? this.hidden.delete(sr.id) : this.hidden.add(sr.id);
        this.render(true); this._renderLegend();
      });
      b.addEventListener('mouseenter', () => this.paths?.forEach((p, k) => p.classList.toggle('is-dim', k !== i)));
      b.addEventListener('mouseleave', () => this.paths?.forEach((p) => p.classList.remove('is-dim')));
      return b;
    }));
  }

  _renderTable() {
    const d = this.data; if (!d || !this.tableEl) return;
    const head = h('tr', {}, h('th', { scope: 'col', text: d.timeLabel || 'Time' }), ...d.series.map((sr) => h('th', { scope: 'col', text: sr.label })));
    const rows = d.times.map((t, i) => h('tr', {}, h('td', { text: fmtTime(t, this.opts.lang()) }), ...d.series.map((sr) => h('td', { text: isNum(sr.values[i]) ? Math.round(sr.values[i]) : '—' }))));
    this.tableEl.replaceChildren(h('table', { class: 'data-table' }, h('thead', {}, head), h('tbody', {}, rows.reverse())));
  }
}

// Guided tour with a lerped spotlight that tracks its target every frame.
import { $, h, clamp, prefersReducedMotion } from './util.js';
import { t, getLang } from './i18n.js';
import { PERSONAS } from './assistant.js';

const STEPS = [
  { key: 0, target: null },
  { key: 1, target: '#now .hero-grid' },
  { key: 2, target: '#status-pill' },
  { key: 3, target: '#map-section' },
  { key: 4, target: '#trends-section' },
  { key: 5, target: '#xref-section' },
  { key: 6, target: '#regional-section' },
  { key: 7, target: '#advice-section' },
  { key: 8, target: '#assistant-fab' },
  { key: 9, target: '#settings-btn' },
];

export class Tour {
  constructor({ voice, onFinish, setLang, setPersona, getPersona }) {
    this.voice = voice; this.onFinish = onFinish; this.setLang = setLang; this.setPersona = setPersona; this.getPersona = getPersona;
    this.root = $('#tour'); this.ring = $('#tour-ring'); this.card = $('#tour-card');
    this.i = 0; this.active = false; this.raf = 0; this.interacted = false;
    this.cur = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 }; this.first = true;
    $('#tour-next').addEventListener('click', () => { this._gesture(); this.next(); });
    $('#tour-back').addEventListener('click', () => { this._gesture(); this.go(this.i - 1); });
    $('#tour-skip').addEventListener('click', () => this.finish());
    this.root.addEventListener('keydown', (e) => this._key(e));
    this._tick = this._tick.bind(this);
    window.addEventListener('resize', () => { if (this.active) this.first = true; });
  }

  _gesture() { this.interacted = true; this.voice.unlock(); }

  start() {
    this.active = true; this.root.hidden = false; this.first = true;
    this.root.style.opacity = '0';
    requestAnimationFrame(() => { this.root.style.transition = 'opacity 260ms ease'; this.root.style.opacity = '1'; });
    document.body.style.overflow = 'hidden';
    this.go(0);
    cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(this._tick);
  }

  finish() {
    if (!this.active) return;
    this.active = false; this.voice.stop();
    this.root.style.opacity = '0';
    document.body.style.overflow = '';
    setTimeout(() => { this.root.hidden = true; cancelAnimationFrame(this.raf); this.raf = 0; }, 270);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    this.onFinish && this.onFinish();
  }

  next() { if (this.i >= STEPS.length - 1) this.finish(); else this.go(this.i + 1); }

  go(i) {
    this.i = clamp(i, 0, STEPS.length - 1);
    const step = STEPS[this.i];
    if (step.target) {
      // Bring the target into view, then let the frame loop follow it.
      const el = this._target(step);
      if (el) {
        // Keep the target clear of the sticky header and the card.
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const fixed = getComputedStyle(el).position === 'fixed' || el.closest('.topbar');
        if (!fixed && (r.top < 80 || r.bottom > vh - 220)) {
          const y = window.scrollY + r.top - Math.max(80, (vh - Math.min(r.height, vh * 0.55)) / 2 - 60);
          window.scrollTo({ top: Math.max(0, y), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        }
      }
    } else {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    this.render();
  }

  _target(step) { const el = step.target && document.querySelector(step.target); return el && el.offsetParent !== null ? el : (el && getComputedStyle(el).position === 'fixed' ? el : null); }

  render() {
    const step = STEPS[this.i]; const n = STEPS.length;
    $('#tour-step').textContent = t('tour.step', { i: this.i + 1, n });
    $('#tour-title').textContent = t(`tour.${step.key}.title`);
    const body = $('#tour-body');
    body.textContent = t(`tour.${step.key}.body`);
    body.classList.remove('is-swap'); void body.offsetWidth; body.classList.add('is-swap');
    $('#tour-dots').replaceChildren(...STEPS.map((_, k) => h('i', { class: k === this.i ? 'on' : '' })));
    $('#tour-back').hidden = this.i === 0;
    $('#tour-next').textContent = this.i === 0 ? t('tour.start') : (this.i === n - 1 ? t('tour.done') : t('tour.next'));
    $('#tour-skip').textContent = t('tour.skip');
    const extra = $('#tour-extra'); extra.replaceChildren();
    if (this.i === 0) extra.append(this._welcomeExtras());
    this.ring.classList.toggle('is-center', !step.target);
    setTimeout(() => $('#tour-next').focus({ preventScroll: true }), 30);
    if (this.interacted) this.voice.speak(`${t(`tour.${step.key}.title`)}. ${t(`tour.${step.key}.body`)}`);
  }

  _welcomeExtras() {
    const lang = getLang();
    const langSeg = h('div', { class: 'seg seg-wide', role: 'group', 'aria-label': t('tour.0.lang') },
      ...['en', 'zh'].map((l) => h('button', { type: 'button', 'aria-pressed': String(lang === l), onclick: () => { this._gesture(); this.setLang(l); this.render(); } }, l === 'en' ? 'English' : '华语')),
      h('span', { class: 'seg-thumb', 'aria-hidden': 'true' }));
    const cur = this.getPersona();
    const personas = h('div', { class: 'persona-switch', role: 'radiogroup', 'aria-label': t('tour.0.persona'), style: { padding: '0', border: '0' } },
      ...Object.values(PERSONAS).map((p) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(cur === p.id), onclick: () => { this._gesture(); this.setPersona(p.id); this.render(); } },
        h('span', { class: 'orb', 'data-persona': p.id, html: `<svg><use href="#${p.icon}"/></svg>` }), p.name[lang])));
    const wrap = h('div', {}, h('p', { class: 'fineprint', style: { marginBottom: '6px' }, text: t('tour.0.lang') }), langSeg,
      h('p', { class: 'fineprint', style: { margin: '12px 0 6px' }, text: t('tour.0.persona') }), personas);
    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('seg-refresh')));
    return wrap;
  }

  _key(e) {
    if (!this.active) return;
    if (e.key === 'Escape') { e.preventDefault(); this.finish(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this._gesture(); this.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this._gesture(); this.go(this.i - 1); }
    else if (e.key === 'Tab') {
      const f = Array.from(this.card.querySelectorAll('button:not([hidden])')).filter((b) => b.offsetParent !== null);
      if (!f.length) return;
      const idx = f.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }

  _tick() {
    if (!this.active) return;
    const vw = window.innerWidth, vh = window.innerHeight; const pad = 8;
    const step = STEPS[this.i]; const el = this._target(step);
    let goal;
    if (el) {
      const r = el.getBoundingClientRect();
      const top = Math.max(r.top - pad, 4), bottom = Math.min(r.bottom + pad, vh - 4);
      goal = { x: r.left - pad, y: top, w: r.width + pad * 2, h: Math.max(0, bottom - top) };
    } else goal = { x: vw / 2, y: vh / 2, w: 0, h: 0 };

    const cw = this.card.offsetWidth, ch = this.card.offsetHeight;
    const mobile = vw <= 760;
    let cx, cy;
    if (!el) { cx = (vw - cw) / 2; cy = Math.max(12, (vh - ch) / 2); }
    else if (mobile) {
      cx = (vw - cw) / 2;
      const below = vh - (goal.y + goal.h);
      cy = below > ch + 24 || goal.y < vh * 0.45 ? vh - ch - 16 : 16 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 0);
      if (cy + ch > vh - 8) cy = vh - ch - 8;
    } else {
      cx = clamp(goal.x + goal.w / 2 - cw / 2, 12, vw - cw - 12);
      cy = goal.y + goal.h + 14;
      if (cy + ch > vh - 12) cy = goal.y - ch - 14;
      if (cy < 12) { // no room above or below: put it beside the target
        cy = clamp(goal.y + goal.h / 2 - ch / 2, 12, vh - ch - 12);
        cx = goal.x + goal.w + 14 + cw < vw ? goal.x + goal.w + 14 : Math.max(12, goal.x - cw - 14);
      }
    }
    const k = this.first || prefersReducedMotion() ? 1 : 0.2;
    this.first = false;
    const c = this.cur;
    c.x += (goal.x - c.x) * k; c.y += (goal.y - c.y) * k; c.w += (goal.w - c.w) * k; c.h += (goal.h - c.h) * k;
    c.cx += (cx - c.cx) * k; c.cy += (cy - c.cy) * k;
    this.ring.style.transform = `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px)`;
    this.ring.style.width = `${c.w.toFixed(1)}px`; this.ring.style.height = `${c.h.toFixed(1)}px`;
    this.card.style.transform = `translate(${c.cx.toFixed(1)}px, ${c.cy.toFixed(1)}px)`;
    this.raf = requestAnimationFrame(this._tick);
  }
}

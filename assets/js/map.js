// Haze map: Leaflet (embedded) over an embedded offline basemap, with sharp online tiles layered
// on top when reachable. Draws a CAMS model haze field with a 24-hour forecast timeline and NEA's
// measured PM2.5 over Singapore.
import { ONLINE_TILES, OFFLINE_ATTRIBUTION, NEA_REGIONS, REGION_FALLBACK_POS, SINGAPORE, XREF } from './config.js';
import { destinationPoint, isNum, escapeHtml, clamp, prefersReducedMotion, fmtTime } from './util.js';
import { psiBand, pmBand } from './analysis.js';
import { renderGridField, renderPointField, idwSampler, makeSampler, gridBounds, blendFrames, pointInRings, legendGradient, CONTOUR_LEVELS, mercY } from './hazefield.js';

const SG_BOUNDS = [[1.205, 103.6], [1.475, 104.05]];
const REGION_BOUNDS = [[-6.6, 97.2], [5.8, 116.4]];
const SG_FIELD = { north: 1.49, south: 1.15, west: 103.57, east: 104.13 };
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const LEGEND_MAX = 300;

export class MapView {
  constructor(el, fallbackEl, opts) {
    this.el = el; this.fallbackEl = fallbackEl; this.opts = opts;
    this.view = 'sg'; this.basemap = opts.basemap || 'terrain'; this.hazeOn = true;
    this.ready = false; this.failed = false; this.summary = null;
    this.t = 0; this.targetT = 0; this.maxT = 0; this.playing = false;
    this.online = { loads: 0, errors: 0, state: 'offline' };
    this.probeEl = document.getElementById('map-probe');
    this.sourceEl = document.getElementById('map-source');
    this._raf = 0;
  }

  init() {
    const L = window.L; const B = window.HAZESCOPE_BASEMAP;
    if (!L || !B) { this._fail(); return; }
    try {
      this.L = L; this.B = B;
      const touch = window.matchMedia('(pointer: coarse)').matches;
      const bounds = L.latLngBounds(B.bounds);
      this.imageBounds = bounds;
      const map = this.map = L.map(this.el, {
        zoomControl: true, attributionControl: true, scrollWheelZoom: false, dragging: !touch, tap: false,
        zoomSnap: 0.25, zoomDelta: 0.5, maxZoom: 14, maxBounds: bounds.pad(0.02), maxBoundsViscosity: 0.9,
        fadeAnimation: true, zoomAnimation: true,
      });
      map.attributionControl.setPrefix(false);
      map.on('click focus', () => { map.scrollWheelZoom.enable(); if (touch) map.dragging.enable(); });
      this.el.addEventListener('mouseleave', () => { map.scrollWheelZoom.disable(); this._hideProbe(); });

      for (const [name, z] of [['offlineBase', 150], ['offlineVec', 250], ['onlineBase', 300], ['haze', 360], ['onlineLabels', 370]]) {
        const p = map.createPane(name); p.style.zIndex = String(z); p.style.pointerEvents = 'none';
      }

      // Offline layers (always present underneath)
      this.offline = {
        satellite: L.imageOverlay(B.satellite, bounds, { pane: 'offlineBase', interactive: false, attribution: OFFLINE_ATTRIBUTION.satellite }),
        terrain: L.imageOverlay(B.terrain, bounds, { pane: 'offlineBase', interactive: false, attribution: OFFLINE_ATTRIBUTION.terrain }),
      };
      this.vectors = L.geoJSON(B.countries, { pane: 'offlineVec', interactive: false, attribution: OFFLINE_ATTRIBUTION.borders, style: () => this._vecStyle() }).addTo(map);
      const sg = (B.countries.features || []).find((f) => f.properties.iso === 'SGP');
      this.sgRings = sg ? sg.geometry.coordinates.flat() : [];

      // Online layers (added only when the browser reports a connection)
      const tile = (cfg, pane) => {
        const layer = L.tileLayer(cfg.url, { pane, subdomains: cfg.subdomains || 'abc', maxNativeZoom: cfg.maxNativeZoom, maxZoom: 14, attribution: cfg.attribution, errorTileUrl: BLANK, crossOrigin: false });
        // A failed tile is swapped for the blank errorTileUrl, which also fires 'tileload'; ignore those.
        layer.on('tileload', (e) => { if (e.tile && e.tile.src === BLANK) return; this.online.loads++; this._setSource('online'); });
        layer.on('tileerror', () => { this.online.errors++; if (!this.online.loads) this._setSource('offline'); });
        return layer;
      };
      this.onlineLayers = {
        satellite: [tile(ONLINE_TILES.satellite, 'onlineBase'), tile(ONLINE_TILES.labels, 'onlineLabels')],
        terrain: [tile(ONLINE_TILES.terrain, 'onlineBase')],
      };
      window.addEventListener('online', () => this._syncOnline());
      window.addEventListener('offline', () => this._syncOnline());

      // Haze canvases
      const CanvasOverlay = L.ImageOverlay.extend({
        _initImage() {
          const c = this._image = this._url;
          L.DomUtil.addClass(c, 'leaflet-image-layer');
          if (this._zoomAnimated) L.DomUtil.addClass(c, 'leaflet-zoom-animated');
          if (this.options.className) L.DomUtil.addClass(c, this.options.className);
          c.onselectstart = L.Util.falseFn; c.onmousemove = L.Util.falseFn;
        },
      });
      this.CanvasOverlay = CanvasOverlay;
      this.sgCanvas = document.createElement('canvas');
      const sgAspect = (mercY(SG_FIELD.north) - mercY(SG_FIELD.south)) / ((SG_FIELD.east - SG_FIELD.west) * Math.PI / 180);
      this.sgCanvas.width = 600; this.sgCanvas.height = Math.round(600 * sgAspect);
      this.sgOverlay = new CanvasOverlay(this.sgCanvas, [[SG_FIELD.south, SG_FIELD.west], [SG_FIELD.north, SG_FIELD.east]], { pane: 'haze', className: 'haze-canvas haze-sg' });

      this.sgLayer = L.layerGroup().addTo(map);
      this.regionLayer = L.layerGroup();
      this.setBasemap(this.basemap);
      this._syncOnline();

      map.fitBounds(SG_BOUNDS, { animate: false });
      this._updateMinZoom();
      map.on('zoomend', () => this.vectors.setStyle(this._vecStyle()));
      map.on('moveend', () => this._renderHaze());
      map.on('mousemove', (e) => this._probe(e.latlng, e.containerPoint));
      map.on('click', (e) => { if (touch) this._probe(e.latlng, e.containerPoint); });
      map.on('movestart', () => { if (touch) this._hideProbe(); });
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { map.invalidateSize({ pan: false }); this._updateMinZoom(); }).observe(this.el);
      this.ready = true;
      this._legend();
      if (this.summary) this.update(this.summary);
    } catch (e) {
      console.error(e);
      this._fail();
    }
  }

  _fail() {
    this.failed = true;
    this.fallbackEl.hidden = false; this.el.hidden = true;
    this.el.parentElement.querySelectorAll('.map-overlay').forEach((n) => { n.hidden = true; });
  }

  _updateMinZoom() {
    if (!this.map) return;
    const z = this.map.getBoundsZoom(this.imageBounds, true);
    this.map.setMinZoom(Math.ceil(z * 4) / 4);
  }

  _vecStyle() {
    const z = this.map ? this.map.getZoom() : 6;
    const sat = this.basemap === 'satellite';
    const crisp = clamp((z - 8) / 2, 0, 1); // the embedded images get soft beyond zoom 8
    return {
      color: sat ? '#f4f7ff' : '#55684f', weight: z >= 9 ? 1.3 : 0.8, opacity: sat ? 0.65 : 0.8,
      fill: crisp > 0, fillColor: sat ? '#334a2d' : '#e3e9d6', fillOpacity: crisp * 0.92,
    };
  }

  setBasemap(kind) {
    this.basemap = kind === 'satellite' ? 'satellite' : 'terrain';
    if (!this.map) return;
    const other = this.basemap === 'satellite' ? 'terrain' : 'satellite';
    this.map.removeLayer(this.offline[other]);
    this.offline[this.basemap].addTo(this.map);
    this.el.dataset.basemap = this.basemap;
    this.vectors.setStyle(this._vecStyle());
    this._syncOnline();
  }

  _syncOnline() {
    if (!this.map) return;
    const want = navigator.onLine;
    for (const [kind, layers] of Object.entries(this.onlineLayers)) {
      for (const l of layers) {
        const on = want && kind === this.basemap;
        if (on && !this.map.hasLayer(l)) l.addTo(this.map);
        if (!on && this.map.hasLayer(l)) this.map.removeLayer(l);
      }
    }
    this.online.loads = 0; this.online.errors = 0;
    this._setSource(want ? 'connecting' : 'offline');
  }

  _setSource(state) {
    if (this.online.state === state) return;
    this.online.state = state;
    if (!this.sourceEl) return;
    this.sourceEl.dataset.state = state;
    this.sourceEl.querySelector('span').textContent = this.opts.t(state === 'online' ? 'map.srcOnline' : state === 'connecting' ? 'map.srcConnecting' : 'map.srcOffline');
  }

  setView(view, { animate = true } = {}) {
    this.view = view;
    if (!this.ready) return;
    this.map.closePopup();
    if (view === 'region') { this.regionLayer.addTo(this.map); this.map.removeLayer(this.sgLayer); }
    else { this.map.removeLayer(this.regionLayer); this.sgLayer.addTo(this.map); }
    const b = view === 'region' ? REGION_BOUNDS : SG_BOUNDS;
    if (animate && !prefersReducedMotion()) this.map.flyToBounds(b, { duration: 1.1, easeLinearity: 0.2 });
    else this.map.fitBounds(b, { animate: false });
    this._legend();
  }

  focusRegion(region) {
    if (!this.ready) return;
    if (this.view !== 'sg') this.opts.onViewChange?.('sg');
    const pos = this.regionPos?.[region] || REGION_FALLBACK_POS[region];
    const m = this.regionMarkers?.[region];
    this.map.flyTo(pos, 12, { duration: prefersReducedMotion() ? 0 : 0.9 });
    if (m) setTimeout(() => m.openPopup(), 950);
  }
  focusCity(id) {
    if (!this.ready) return;
    if (this.view !== 'region') this.opts.onViewChange?.('region');
    const m = this.cityMarkers?.[id];
    if (!m) return;
    setTimeout(() => { this.map.flyTo(m.getLatLng(), 7, { duration: 1 }); setTimeout(() => m.openPopup(), 1050); }, this.view === 'region' ? 0 : 1150);
  }

  // ---------------------------------------------------------------- haze timeline
  timeline() {
    const g = this.grid;
    if (!g) return { available: false, max: 0 };
    return { available: true, max: this.maxT, offset: this.frameOffset, times: g.times };
  }
  timeAt(t) { const g = this.grid; if (!g) return null; return g.times[Math.min(g.times.length - 1, this.frameOffset + Math.round(t))] || null; }

  setTime(t, { instant = false } = {}) {
    this.targetT = clamp(t, 0, this.maxT);
    if (instant || prefersReducedMotion() || document.hidden) { this.t = this.targetT; this._renderHaze(); return; }
    if (!this._raf) { this._last = 0; this._raf = requestAnimationFrame((n) => this._step(n)); }
  }
  _step(now) {
    const dt = this._last ? Math.min(0.1, (now - this._last) / 1000) : 0.016; this._last = now;
    const k = 1 - Math.exp(-dt / 0.18);
    this.t += (this.targetT - this.t) * k;
    if (Math.abs(this.targetT - this.t) < 0.004) this.t = this.targetT;
    this._renderHaze();
    this._raf = this.t === this.targetT ? 0 : requestAnimationFrame((n) => this._step(n));
  }

  setHazeVisible(on) {
    this.hazeOn = !!on;
    if (!this.ready) return;
    for (const o of [this.gridOverlay, this.sgOverlay]) {
      if (!o) continue;
      if (on && !this.map.hasLayer(o)) o.addTo(this.map);
      if (!on && this.map.hasLayer(o)) this.map.removeLayer(o);
    }
    if (on) this._renderHaze();
  }

  _setGrid(raw) {
    if (!raw || !raw.frames?.length) { this.grid = null; this.maxT = 0; return; }
    if (this.grid && this.grid.raw === raw) return;
    const now = Date.now();
    let off = 0;
    raw.times.forEach((tm, k) => { if (tm && new Date(tm).getTime() <= now) off = k; });
    this.grid = { raw, rows: raw.rows, cols: raw.cols, lats: raw.lats, lons: raw.lons, times: raw.times.map((x) => new Date(x)), frames: raw.frames };
    this.frameOffset = off;
    this.maxT = Math.max(0, raw.frames.length - 1 - off);
    this.t = this.targetT = clamp(this.targetT, 0, this.maxT);
    this.gridFull = gridBounds(this.grid);
    if (!this.gridCanvas) {
      this.gridCanvas = document.createElement('canvas');
      const b = this.gridFull;
      this.gridOverlay = new this.CanvasOverlay(this.gridCanvas, [[b.south, b.west], [b.north, b.east]], { pane: 'haze', className: 'haze-canvas', attribution: OFFLINE_ATTRIBUTION.haze });
      if (this.hazeOn) this.gridOverlay.addTo(this.map);
      if (this.hazeOn && this.map.hasLayer(this.sgOverlay)) { this.map.removeLayer(this.sgOverlay); this.sgOverlay.addTo(this.map); }
    }
  }

  // The model field is drawn for the visible area only, so it stays sharp at every zoom.
  _gridView() {
    const L = this.L; const vb = this.map.getBounds().pad(0.12); const f = this.gridFull;
    const view = { north: Math.min(vb.getNorth(), f.north), south: Math.max(vb.getSouth(), f.south), west: Math.max(vb.getWest(), f.west), east: Math.min(vb.getEast(), f.east) };
    if (view.north <= view.south || view.east <= view.west) return null;
    const nw = this.map.latLngToContainerPoint([view.north, view.west]), se = this.map.latLngToContainerPoint([view.south, view.east]);
    const cssW = Math.max(1, se.x - nw.x), cssH = Math.max(1, se.y - nw.y);
    const res = clamp(Math.sqrt(380000 / (cssW * cssH)), 0.35, Math.min(1, window.devicePixelRatio || 1));
    return { view, bounds: L.latLngBounds([view.south, view.west], [view.north, view.east]), w: Math.round(cssW * res), h: Math.round(cssH * res), res };
  }

  _frameValues(t) {
    const g = this.grid; if (!g) return null;
    const pos = this.frameOffset + t; const a = Math.floor(pos), f = pos - a;
    const A = g.frames[clamp(a, 0, g.frames.length - 1)], Bf = g.frames[clamp(a + 1, 0, g.frames.length - 1)];
    return blendFrames(A, Bf, f);
  }

  _renderHaze() {
    if (!this.ready || !this.hazeOn) return;
    if (this.grid && this.gridCanvas) {
      const values = this._frameValues(this.t);
      this._curSampler = makeSampler({ ...this.grid, values });
      const gv = this._gridView();
      if (gv) {
        if (this.gridCanvas.width !== gv.w || this.gridCanvas.height !== gv.h) { this.gridCanvas.width = gv.w; this.gridCanvas.height = gv.h; }
        this.gridOverlay.setBounds(gv.bounds);
        renderGridField(this.gridCanvas, { ...this.grid, values }, gv.view, this.gridFull, { res: gv.res });
        this.gridCanvas.style.visibility = '';
      } else this.gridCanvas.style.visibility = 'hidden';
    }
    // NEA measured field shows "now" only; it fades out as the slider moves into the forecast.
    const neaOpacity = clamp(1 - this.t * 1.6, 0, 1);
    if (this.sgOverlay) {
      if (this.neaSampler && neaOpacity > 0 && !this.map.hasLayer(this.sgOverlay)) this.sgOverlay.addTo(this.map);
      if ((!this.neaSampler || neaOpacity === 0) && this.map.hasLayer(this.sgOverlay)) this.map.removeLayer(this.sgOverlay);
      this.sgOverlay.setOpacity(neaOpacity);
    }
  }

  _renderNea(S) {
    const pmItem = S.pmItems[S.pmItems.length - 1];
    const pos = this.regionPos;
    const pts = NEA_REGIONS.map((r) => ({ lat: (pos[r] || REGION_FALLBACK_POS[r])[0], lon: (pos[r] || REGION_FALLBACK_POS[r])[1], v: pmItem?.pm25_1h?.[r] }));
    if (!pts.some((p) => isNum(p.v))) { this.neaSampler = null; return; }
    this.neaSampler = idwSampler(pts, 2);
    renderPointField(this.sgCanvas, this.neaSampler, SG_FIELD, this.sgRings);
  }

  // ---------------------------------------------------------------- probe (hover readout)
  _probe(latlng, cp) {
    if (!this.probeEl || !this.hazeOn) return;
    const { lat, lng } = latlng; const t = this.opts.t;
    let v = null, src = '';
    if (this.neaSampler && this.t < 0.5 && this.sgRings.length && pointInRings(lat, lng, this.sgRings)) { v = this.neaSampler(lat, lng); src = t('map.probeNea'); }
    else if (this._curSampler) { v = this._curSampler(lat, lng); src = this.t < 0.5 ? t('map.probeModel') : t('map.probeForecast', { h: Math.round(this.t) }); }
    if (!isNum(v)) { this._hideProbe(); return; }
    const b = pmBand(v);
    this.probeEl.innerHTML = `<b>${Math.round(v)}</b> µg/m³ <span class="probe-band" style="--band:${b.color}"><i></i>${escapeHtml(t('pmband.' + b.id))}</span><small>${escapeHtml(src)}</small>`;
    const w = this.el.clientWidth;
    const x = clamp(cp.x + 14, 4, w - 190), y = Math.max(4, cp.y - 52);
    this.probeEl.style.transform = `translate(${x}px, ${y}px)`;
    this.probeEl.hidden = false;
  }
  _hideProbe() { if (this.probeEl) this.probeEl.hidden = true; }

  // ---------------------------------------------------------------- data
  update(S) {
    this.summary = S;
    if (!this.ready) return;
    const L = this.L; const t = this.opts.t;
    this.regionPos = this.opts.regionPos();
    this._setGrid(S.grid);
    this._renderNea(S);
    this._renderHaze();

    this.sgLayer.clearLayers(); this.regionLayer.clearLayers();
    this.regionMarkers = {}; this.cityMarkers = {};
    const psiItem = S.psiItems[S.psiItems.length - 1];
    const pmItem = S.pmItems[S.pmItems.length - 1];
    for (const r of NEA_REGIONS) {
      const pos = this.regionPos[r] || REGION_FALLBACK_POS[r];
      const v = psiItem?.psi24?.[r]; const band = psiBand(v); const pm = pmItem?.pm25_1h?.[r];
      const m = L.marker(pos, {
        icon: L.divIcon({ className: 'map-pill', iconSize: [0, 0], iconAnchor: [0, 0],
          html: `<div><i style="background:${band ? band.color : '#8892a6'}"></i><b>${isNum(v) ? Math.round(v) : '—'}</b><small>${escapeHtml(t('region.' + r))}</small></div>` }),
        keyboard: true, title: `${t('region.' + r)}: PSI ${isNum(v) ? Math.round(v) : '—'}`,
      });
      m.bindPopup(`<b>${escapeHtml(t('region.' + r))}</b><br>${escapeHtml(t('hero.psi'))}: <b>${isNum(v) ? Math.round(v) : '—'}</b> ${band ? escapeHtml(t('band.' + band.id)) : ''}<br>${escapeHtml(t('hero.pm'))}: <b>${isNum(pm) ? Math.round(pm) : '—'}</b> µg/m³`);
      this.sgLayer.addLayer(m);
      this.regionMarkers[r] = m;
    }
    if (S.wind) {
      const toDeg = (S.wind.fromDeg + 180) % 360;
      const html = `<div><svg viewBox="0 0 64 64" style="transform:rotate(${toDeg.toFixed(0)}deg)"><circle cx="32" cy="32" r="26" fill="rgba(10,20,36,.6)" stroke="rgba(255,255,255,.75)" stroke-width="1.5"/><path d="M32 12 L41 34 L32 29 L23 34 Z" fill="#5fd4c6"/><path d="M32 29 V52" stroke="#5fd4c6" stroke-width="4" stroke-linecap="round"/></svg></div>`;
      const m = L.marker([1.262, 103.985], { icon: L.divIcon({ className: 'wind-icon', iconSize: [56, 56], iconAnchor: [28, 28], html }), keyboard: false });
      m.bindTooltip(t('map.windTip', { dir: t('compass.' + this.opts.compass(S.wind.fromDeg)), kt: isNum(S.wind.knots) ? S.wind.knots.toFixed(1) : '—' }), { direction: 'top' });
      this.sgLayer.addLayer(m);
    }
    if (S.wind && !S.wind.calm) {
      const pts = [[SINGAPORE.lat, SINGAPORE.lon]];
      for (let a = -XREF.upwindHalfAngle; a <= XREF.upwindHalfAngle; a += 5) {
        const p = destinationPoint(SINGAPORE, (S.wind.fromDeg + a + 360) % 360, XREF.upwindMaxKm); pts.push([p.lat, p.lon]);
      }
      this.regionLayer.addLayer(L.polygon(pts, { color: '#ffb36b', weight: 1.6, dashArray: '6 6', fill: false, interactive: false }));
    }
    for (const c of S.regional) {
      if (c.id === 'sg') continue;
      const band = pmBand(c.pm25); const color = band ? band.color : '#8892a6';
      const cm = L.circleMarker([c.lat, c.lon], { radius: 6, color: '#ffffff', weight: c.upwind ? 2.6 : 1.6, fillColor: color, fillOpacity: 1 });
      cm.bindPopup(`<b>${escapeHtml(t('city.' + c.id))}</b><br>${escapeHtml(t('reg.pm'))}: <b>${isNum(c.pm25) ? Math.round(c.pm25) : '—'}</b> µg/m³ (${escapeHtml(t('reg.model'))})<br>${escapeHtml(t('reg.aqi'))}: ${isNum(c.aqi) ? Math.round(c.aqi) : '—'}${c.dist ? `<br>${Math.round(c.dist)} km ${escapeHtml(t('compass.' + this.opts.compass(c.bearing)))}` : ''}${c.upwind ? `<br><b>${escapeHtml(t('reg.upwind'))}</b>` : ''}`);
      const label = L.marker([c.lat, c.lon], { icon: L.divIcon({ className: 'map-pill map-pill-city', iconSize: [0, 0], iconAnchor: [0, 0],
        html: `<div><b>${isNum(c.pm25) ? Math.round(c.pm25) : '—'}</b><small>${escapeHtml(t('city.' + c.id))}</small></div>` }), interactive: false, keyboard: false });
      this.regionLayer.addLayer(cm); this.regionLayer.addLayer(label);
      this.cityMarkers[c.id] = cm;
    }
    this._legend();
    this.opts.onTimeline?.(this.timeline());
  }

  _legend() {
    const el = document.getElementById('map-legend'); if (!el) return;
    const t = this.opts.t;
    const ticks = [0, ...CONTOUR_LEVELS].map((v) => `<span style="left:${(v / LEGEND_MAX * 100).toFixed(1)}%">${v}${v === CONTOUR_LEVELS[CONTOUR_LEVELS.length - 1] ? '+' : ''}</span>`).join('');
    el.innerHTML = `<p class="lg-title">${escapeHtml(t('map.legendTitle'))}</p><div class="lg-bar" style="background:${legendGradient(LEGEND_MAX)}"></div><div class="lg-ticks">${ticks}</div><p class="lg-note">${escapeHtml(t(this.view === 'region' ? 'map.legendRegion' : 'map.legendSg'))}</p>`;
  }

  refreshLabels() {
    if (this.summary) this.update(this.summary); else this._legend();
    const st = this.online.state; this.online.state = ''; this._setSource(st);
  }
  formatTime(d, lang) { return fmtTime(d, lang); }
}

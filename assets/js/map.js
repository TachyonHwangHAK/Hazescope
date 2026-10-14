// Map view (Leaflet from unpkg with SRI). Degrades to a message + region list if Leaflet can't load.
import { LEAFLET, BASEMAPS, BASEMAP_ATTRIBUTION, PSI_BANDS, PM_BANDS, NEA_REGIONS, REGION_FALLBACK_POS, SINGAPORE, XREF } from './config.js';
import { destinationPoint, isNum, escapeHtml } from './util.js';
import { psiBand, pmBand } from './analysis.js';

let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = LEAFLET.css; css.integrity = LEAFLET.cssIntegrity; css.crossOrigin = '';
    document.head.insertBefore(css, document.head.querySelector('link[href$="app.css"]'));
    const js = document.createElement('script');
    js.src = LEAFLET.js; js.integrity = LEAFLET.jsIntegrity; js.crossOrigin = ''; js.async = true;
    const timer = setTimeout(() => reject(new Error('Leaflet load timeout')), 15000);
    js.onload = () => { clearTimeout(timer); window.L ? resolve(window.L) : reject(new Error('Leaflet missing')); };
    js.onerror = () => { clearTimeout(timer); reject(new Error('Leaflet failed to load')); };
    document.head.append(js);
  });
  return leafletPromise;
}

const SG_BOUNDS = [[1.205, 103.6], [1.475, 104.05]];
const REGION_BOUNDS = [[-6.6, 97.8], [5.6, 115.6]];

export class MapView {
  constructor(el, fallbackEl, legendEl, opts) {
    this.el = el; this.fallbackEl = fallbackEl; this.legendEl = legendEl; this.opts = opts;
    this.view = 'sg'; this.ready = false; this.failed = false; this.summary = null;
  }

  async init(theme) {
    try {
      const L = await loadLeaflet();
      this.L = L;
      const touch = window.matchMedia('(pointer: coarse)').matches;
      this.map = L.map(this.el, {
        zoomControl: true, attributionControl: true, scrollWheelZoom: false, dragging: !touch,
        zoomSnap: 0.25, zoomDelta: 0.5, worldCopyJump: false, preferCanvas: false, fadeAnimation: true, zoomAnimation: true,
      });
      this.map.attributionControl.setPrefix(false);
      // Enable wheel / drag only after an intentional interaction so page scrolling isn't hijacked.
      this.map.on('click focus', () => { this.map.scrollWheelZoom.enable(); if (touch) this.map.dragging.enable(); });
      this.el.addEventListener('mouseleave', () => this.map.scrollWheelZoom.disable());
      this.tiles = L.tileLayer(this._tileUrl(theme), { attribution: BASEMAP_ATTRIBUTION, subdomains: 'abcd', maxZoom: 18, detectRetina: false }).addTo(this.map);
      this.sgLayer = L.layerGroup().addTo(this.map);
      this.regionLayer = L.layerGroup();
      this.map.fitBounds(SG_BOUNDS, { animate: false });
      this.ready = true;
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.map.invalidateSize({ pan: false })).observe(this.el);
      if (this.summary) this.update(this.summary);
      this._legend();
    } catch (e) {
      this.failed = true;
      this.fallbackEl.hidden = false; this.el.hidden = true; this.legendEl.hidden = true;
    }
  }

  _tileUrl(theme) { return theme === 'light' ? BASEMAPS.light : theme === 'colourful' ? BASEMAPS.voyager : BASEMAPS.dark; }
  setTheme(theme) { if (this.tiles) this.tiles.setUrl(this._tileUrl(theme)); }

  setView(view, { animate = true } = {}) {
    this.view = view;
    if (!this.ready) return;
    if (view === 'region') { this.regionLayer.addTo(this.map); }
    else { this.map.removeLayer(this.regionLayer); this.map.closePopup(); }
    const bounds = view === 'region' ? REGION_BOUNDS : SG_BOUNDS;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate && !reduce) this.map.flyToBounds(bounds, { duration: 1.1, easeLinearity: 0.2 });
    else this.map.fitBounds(bounds, { animate: false });
    this._legend();
  }

  focusRegion(region) {
    if (!this.ready) return;
    if (this.view !== 'sg') this.opts.onViewChange?.('sg');
    const pos = this.regionPos?.[region] || REGION_FALLBACK_POS[region];
    const m = this.regionMarkers?.[region];
    this.map.flyTo(pos, 12, { duration: 0.9 });
    if (m) setTimeout(() => m.openPopup(), 950);
  }
  focusCity(id) {
    if (!this.ready) return;
    if (this.view !== 'region') this.opts.onViewChange?.('region');
    const m = this.cityMarkers?.[id];
    if (!m) return;
    setTimeout(() => { this.map.flyTo(m.getLatLng(), 7, { duration: 1 }); setTimeout(() => m.openPopup(), 1050); }, this.view === 'region' ? 0 : 1150);
  }

  update(S) {
    this.summary = S;
    if (!this.ready) return;
    const L = this.L; const t = this.opts.t;
    this.sgLayer.clearLayers(); this.regionLayer.clearLayers();
    this.regionMarkers = {}; this.cityMarkers = {};

    // Singapore regions (NEA)
    const psiItem = S.psiItems[S.psiItems.length - 1];
    const pmItem = S.pmItems[S.pmItems.length - 1];
    this.regionPos = this.opts.regionPos();
    for (const r of NEA_REGIONS) {
      const pos = this.regionPos[r] || REGION_FALLBACK_POS[r];
      const v = psiItem?.psi24?.[r]; const band = psiBand(v); const pm = pmItem?.pm25_1h?.[r];
      const color = band ? band.color : '#8892a6';
      const circle = L.circle(pos, { radius: 3600, color, weight: 2, opacity: 0.95, fillColor: color, fillOpacity: 0.38 });
      const label = L.marker(pos, { icon: L.divIcon({ className: 'map-label', iconSize: [0, 0], iconAnchor: [0, 0],
        html: `<div><span>${isNum(v) ? Math.round(v) : '—'}</span><small>${escapeHtml(t('region.' + r))}</small></div>` }), interactive: false, keyboard: false });
      const popup = `<b>${escapeHtml(t('region.' + r))}</b><br>${escapeHtml(t('hero.psi'))}: <b>${isNum(v) ? Math.round(v) : '—'}</b> ${band ? escapeHtml(t('band.' + band.id)) : ''}<br>${escapeHtml(t('hero.pm'))}: <b>${isNum(pm) ? Math.round(pm) : '—'}</b> µg/m³`;
      circle.bindPopup(popup);
      this.sgLayer.addLayer(circle); this.sgLayer.addLayer(label);
      this.regionMarkers[r] = circle;
    }
    // Wind arrow over the sea south of the island
    if (S.wind) {
      const toDeg = (S.wind.fromDeg + 180) % 360;
      const html = `<div><svg viewBox="0 0 64 64" style="transform:rotate(${toDeg.toFixed(0)}deg)"><circle cx="32" cy="32" r="26" fill="rgba(10,20,36,.55)" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/><path d="M32 12 L41 34 L32 29 L23 34 Z" fill="#5fd4c6"/><path d="M32 29 V52" stroke="#5fd4c6" stroke-width="4" stroke-linecap="round"/></svg></div>`;
      const m = L.marker([1.215, 103.9], { icon: L.divIcon({ className: 'wind-icon', iconSize: [64, 64], iconAnchor: [32, 32], html }), keyboard: false });
      m.bindTooltip(t('map.windTip', { dir: t('compass.' + this.opts.compass(S.wind.fromDeg)), kt: isNum(S.wind.knots) ? S.wind.knots.toFixed(1) : '—' }), { direction: 'top' });
      this.sgLayer.addLayer(m);
    }

    // Regional model
    if (S.wind && !S.wind.calm) {
      const pts = [[SINGAPORE.lat, SINGAPORE.lon]];
      for (let a = -XREF.upwindHalfAngle; a <= XREF.upwindHalfAngle; a += 5) {
        const p = destinationPoint(SINGAPORE, (S.wind.fromDeg + a + 360) % 360, XREF.upwindMaxKm); pts.push([p.lat, p.lon]);
      }
      this.regionLayer.addLayer(L.polygon(pts, { color: '#ec7a3a', weight: 1.5, dashArray: '5 6', fillColor: '#ec7a3a', fillOpacity: 0.08, interactive: false }));
    }
    for (const c of S.regional) {
      const band = pmBand(c.pm25); const color = band ? band.color : '#8892a6';
      const r = isNum(c.pm25) ? Math.max(7, Math.min(22, 6 + Math.sqrt(c.pm25) * 1.1)) : 7;
      const cm = L.circleMarker([c.lat, c.lon], { radius: r, color: c.upwind ? '#ffffff' : color, weight: c.upwind ? 2.5 : 1.5, fillColor: color, fillOpacity: 0.75 });
      cm.bindPopup(`<b>${escapeHtml(t('city.' + c.id))}</b><br>${escapeHtml(t('reg.pm'))}: <b>${isNum(c.pm25) ? Math.round(c.pm25) : '—'}</b> µg/m³ (${escapeHtml(t('reg.model'))})<br>${escapeHtml(t('reg.aqi'))}: ${isNum(c.aqi) ? Math.round(c.aqi) : '—'}${c.dist ? `<br>${Math.round(c.dist)} km ${escapeHtml(t('compass.' + this.opts.compass(c.bearing)))}` : ''}${c.upwind ? `<br><b>${escapeHtml(t('reg.upwind'))}</b>` : ''}`);
      const label = L.marker([c.lat, c.lon], { icon: L.divIcon({ className: 'map-label', iconSize: [0, 0], iconAnchor: [0, 0],
        html: `<div style="transform:translate(-50%, ${-(r + 20)}px)"><span>${isNum(c.pm25) ? Math.round(c.pm25) : '—'}</span><small>${escapeHtml(t('city.' + c.id))}</small></div>` }), interactive: false, keyboard: false });
      this.regionLayer.addLayer(cm); this.regionLayer.addLayer(label);
      this.cityMarkers[c.id] = cm;
    }
    this._legend();
  }

  _legend() {
    if (!this.legendEl) return;
    const t = this.opts.t;
    const bands = this.view === 'region' ? PM_BANDS : PSI_BANDS;
    const pre = this.view === 'region' ? 'pmband.' : 'band.';
    this.legendEl.replaceChildren(...bands.map((b) => {
      const sp = document.createElement('span');
      const i = document.createElement('i'); i.style.background = b.color;
      sp.append(i, document.createTextNode(t(pre + b.id)));
      return sp;
    }));
  }
  refreshLabels() { if (this.summary) this.update(this.summary); else this._legend(); }
}

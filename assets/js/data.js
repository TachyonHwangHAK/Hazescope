// Refresh orchestration, caching, and per-source status.
import * as api from './api.js';
import { MIN_SOURCE_AGE } from './config.js';
import { sgtDateString, store } from './util.js';

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const reviver = (k, v) => (typeof v === 'string' && ISO_RE.test(v) ? new Date(v) : v);

export const SOURCES = ['psi', 'pm', 'regional', 'grid', 'windDirection', 'windSpeed', 'airTemperature', 'humidity', 'rainfall', 'twoHr', 'twentyFourHr', 'psiPrev', 'pmPrev'];

export class DataController {
  constructor() {
    this.raw = {};
    this.status = {}; // key -> { ok, at, error }
    this.listeners = new Set();
    this.inflight = null;
    this.lastRefresh = null;
    this.fromCache = false;
    this.demo = false;
    this._emitQueued = false;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(reason) {
    if (this._emitQueued) return;
    this._emitQueued = true;
    requestAnimationFrame(() => { this._emitQueued = false; for (const fn of this.listeners) fn(reason); });
  }

  cacheKey() { return this.demo ? 'cache.demo' : 'cache.live'; }

  loadCache() {
    try {
      const raw = window.localStorage.getItem('hazescope.v1.' + this.cacheKey());
      if (!raw) return false;
      const c = JSON.parse(raw, reviver);
      if (!c || !c.raw) return false;
      // Discard caches older than 36 h — not useful and may mislead.
      if (c.savedAt && Date.now() - new Date(c.savedAt).getTime() > 36 * 3600_000) return false;
      this.raw = c.raw; this.status = c.status || {}; this.lastRefresh = c.savedAt ? new Date(c.savedAt) : null;
      this.fromCache = true;
      return true;
    } catch { return false; }
  }
  saveCache() {
    store.set(this.cacheKey(), { savedAt: new Date().toISOString(), raw: this.raw, status: this.status });
  }
  clearCache() { store.remove('cache.live'); store.remove('cache.demo'); }

  setDemo(on) {
    this.demo = !!on;
    api.setTransport(on ? this._demoTransport : null);
    this.raw = {}; this.status = {}; this.fromCache = false; this.lastRefresh = null;
  }
  async enableDemo() {
    const mod = await import('./demo.js');
    this._demoTransport = mod.demoTransport;
    this.setDemo(true);
  }
  disableDemo() { this.setDemo(false); }

  hasCore() { return !!(this.raw.psi || this.raw.psiPrev) && !!(this.raw.pm || this.raw.pmPrev); }
  errorCount() { return SOURCES.filter((k) => this.status[k] && !this.status[k].ok).length; }
  okCount() { return SOURCES.filter((k) => this.status[k] && this.status[k].ok).length; }

  async _run(key, fn) {
    try {
      const v = await fn();
      this.raw[key] = v;
      this.status[key] = { ok: true, at: new Date() };
    } catch (e) {
      // An empty dataset for today right after midnight is normal, not a failure.
      if ((key === 'psi' || key === 'pm') && e.kind === 'empty') {
        this.raw[key] = { regions: {}, items: [] };
        this.status[key] = { ok: true, at: new Date() };
      } else {
        this.status[key] = { ok: false, at: new Date(), error: e.kind || 'unknown', message: e.message };
      }
    }
    // Save as each source arrives, so a page closed mid-refresh still keeps what it got.
    if (this.status[key]?.ok) { clearTimeout(this._saveT); this._saveT = setTimeout(() => this.saveCache(), 800); }
    this.emit(key);
  }

  isFresh(key, minAge) {
    const st = this.status[key];
    return st && st.ok && this.raw[key] && Date.now() - new Date(st.at).getTime() < minAge;
  }

  refresh() {
    if (this.inflight) return this.inflight;
    const today = sgtDateString();
    const yesterday = sgtDateString(new Date(Date.now() - 24 * 3600_000));
    this.emit('start');
    const jobs = [];
    // Priority 1: NEA air quality (rate-limited queue preserves order)
    jobs.push(this._run('psi', () => api.fetchPSI(today)));
    jobs.push(this._run('pm', () => api.fetchPM25(today)));
    // Regional model (different host, not limited)
    if (!this.isFresh('regional', MIN_SOURCE_AGE.regional)) jobs.push(this._run('regional', () => api.fetchRegional()));
    if (!this.isFresh('grid', MIN_SOURCE_AGE.grid)) jobs.push(this._run('grid', () => api.fetchGrid()));
    // Priority 2: MSS observations
    jobs.push(this._run('windDirection', () => api.fetchStations('windDirection')));
    jobs.push(this._run('windSpeed', () => api.fetchStations('windSpeed')));
    jobs.push(this._run('twoHr', () => api.fetchTwoHr()));
    jobs.push(this._run('airTemperature', () => api.fetchStations('airTemperature')));
    jobs.push(this._run('humidity', () => api.fetchStations('humidity')));
    jobs.push(this._run('rainfall', () => api.fetchStations('rainfall')));
    if (!this.isFresh('twentyFourHr', MIN_SOURCE_AGE.twentyFourHr)) jobs.push(this._run('twentyFourHr', () => api.fetchTwentyFour()));
    // Priority 3: yesterday, once per day, for a full 24-hour trend window
    if (this.raw.prevDate !== yesterday || !this.status.psiPrev?.ok) {
      jobs.push(this._run('psiPrev', () => api.fetchPSI(yesterday)));
    }
    if (this.raw.prevDate !== yesterday || !this.status.pmPrev?.ok) {
      jobs.push(this._run('pmPrev', () => api.fetchPM25(yesterday)));
    }

    this.inflight = Promise.all(jobs).then(() => {
      if (this.status.psiPrev?.ok && this.status.pmPrev?.ok) this.raw.prevDate = yesterday;
      this.lastRefresh = new Date();
      this.fromCache = false;
      this.saveCache();
    }).finally(() => { this.inflight = null; this.emit('done'); });
    return this.inflight;
  }
}

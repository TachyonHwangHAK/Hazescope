// Data access: rate-limited fetch, response normalisation.
import { ENDPOINTS, OPEN_METEO_AQ, RATE_LIMIT, REQUEST_TIMEOUT_MS, CITIES } from './config.js';
import { parseDate, isNum } from './util.js';

export class ApiError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.kind = kind; // 'network' | 'timeout' | 'rate' | 'http' | 'payload' | 'empty'
    this.status = status;
  }
}

// Sliding-window limiter for data.gov.sg (published: 6 calls / 10 s without a key).
class RateLimiter {
  constructor({ max, windowMs }) { this.max = max; this.windowMs = windowMs; this.stamps = []; this.chain = Promise.resolve(); }
  schedule(task) {
    const run = this.chain.then(async () => {
      for (;;) {
        const now = Date.now();
        this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
        if (this.stamps.length < this.max) break;
        const wait = this.windowMs - (now - this.stamps[0]) + 25;
        await sleep(wait);
      }
      this.stamps.push(Date.now());
    });
    this.chain = run.catch(() => {});
    return run.then(task);
  }
  // Called after a 429 so the next calls wait for a fresh window.
  saturate() { const now = Date.now(); this.stamps = Array(this.max).fill(now); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const limiter = new RateLimiter(RATE_LIMIT);

let transport = liveTransport;
export function setTransport(fn) { transport = fn || liveTransport; }
export function isDemoTransport() { return transport !== liveTransport; }

async function liveTransport(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { signal: ctl.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') throw new ApiError('timeout', 'Request timed out');
    throw new ApiError('network', 'Network error or request blocked by the browser');
  }
  clearTimeout(timer);
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

async function getJSON(url, { limited = true } = {}) {
  const attempt = async () => {
    const { status, body } = limited ? await limiter.schedule(() => transport(url)) : await transport(url);
    if (status === 429) { if (limited) limiter.saturate(); throw new ApiError('rate', 'Rate limit reached', 429); }
    if (status === 404 && body && body.code != null) throw new ApiError('empty', body.errorMsg || 'No data', 404);
    if (status < 200 || status >= 300) throw new ApiError('http', `HTTP ${status}`, status);
    if (!body) throw new ApiError('payload', 'Invalid JSON');
    return body;
  };
  try { return await attempt(); }
  catch (e) {
    if (e.kind === 'rate' || e.kind === 'timeout') { await sleep(e.kind === 'rate' ? 11_000 : 1_500); return attempt(); }
    throw e;
  }
}

function neaData(body) {
  if (body.code != null && body.code !== 0) throw new ApiError('payload', body.errorMsg || `API code ${body.code}`);
  if (!body.data) throw new ApiError('payload', 'Missing data');
  return body.data;
}

const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] != null) return o[k]; return undefined; };
const num = (v) => (v == null || v === '' ? null : (isNum(+v) ? +v : null));

function regionMap(meta) {
  const out = {};
  for (const m of meta || []) {
    const loc = pick(m, 'labelLocation', 'label_location') || {};
    if (m && m.name) out[m.name] = [num(loc.latitude), num(loc.longitude)];
  }
  return out;
}

function normRegionReading(obj) {
  const out = {};
  if (!obj) return out;
  for (const [k, v] of Object.entries(obj)) out[k] = num(v);
  return out;
}

// --- NEA air quality -----------------------------------------------------------
export async function fetchPSI(date) {
  const body = await getJSON(date ? `${ENDPOINTS.psi}?date=${date}` : ENDPOINTS.psi);
  const d = neaData(body);
  const items = (d.items || []).map((it) => {
    const r = it.readings || {};
    return {
      t: parseDate(it.timestamp),
      updated: parseDate(pick(it, 'updatedTimestamp', 'update_timestamp')),
      psi24: normRegionReading(r.psi_twenty_four_hourly),
      pm25_24: normRegionReading(r.pm25_twenty_four_hourly),
      pm10_24: normRegionReading(r.pm10_twenty_four_hourly),
      o3_8h: normRegionReading(r.o3_eight_hour_max),
      no2_1h: normRegionReading(r.no2_one_hour_max),
      so2_24: normRegionReading(r.so2_twenty_four_hourly),
      co_8h: normRegionReading(r.co_eight_hour_max),
    };
  }).filter((x) => x.t).sort((a, b) => a.t - b.t);
  return { regions: regionMap(d.regionMetadata), items };
}

export async function fetchPM25(date) {
  const body = await getJSON(date ? `${ENDPOINTS.pm25}?date=${date}` : ENDPOINTS.pm25);
  const d = neaData(body);
  const items = (d.items || []).map((it) => ({
    t: parseDate(it.timestamp),
    updated: parseDate(pick(it, 'updatedTimestamp', 'update_timestamp')),
    pm25_1h: normRegionReading((it.readings || {}).pm25_one_hourly),
  })).filter((x) => x.t).sort((a, b) => a.t - b.t);
  return { regions: regionMap(d.regionMetadata), items };
}

// --- MSS station readings ---------------------------------------------------------
export async function fetchStations(kind) {
  const body = await getJSON(ENDPOINTS[kind]);
  const d = neaData(body);
  const stations = {};
  for (const st of d.stations || []) {
    const loc = st.location || {};
    stations[st.id || st.deviceId] = { name: st.name, lat: num(loc.latitude), lon: num(loc.longitude) };
  }
  const readings = (d.readings || []).map((r) => ({ t: parseDate(r.timestamp), data: r.data || [] }))
    .filter((r) => r.t).sort((a, b) => b.t - a.t);
  const latest = readings[0];
  if (!latest) throw new ApiError('empty', 'No station readings');
  const values = latest.data.map((x) => ({ id: pick(x, 'stationId', 'station_id'), value: num(x.value) }))
    .filter((x) => x.id && x.value != null);
  return { t: latest.t, unit: pick(d, 'readingUnit', 'reading_unit') || '', stations, values };
}

// --- MSS forecasts ------------------------------------------------------------------
export async function fetchTwoHr() {
  const body = await getJSON(ENDPOINTS.twoHr);
  const d = neaData(body);
  const meta = {};
  for (const a of pick(d, 'area_metadata', 'areaMetadata') || []) {
    const loc = pick(a, 'label_location', 'labelLocation') || {};
    meta[a.name] = [num(loc.latitude), num(loc.longitude)];
  }
  const items = (d.items || []).slice().sort((a, b) => (parseDate(b.timestamp) || 0) - (parseDate(a.timestamp) || 0));
  const it = items[0];
  if (!it) throw new ApiError('empty', 'No forecast');
  const vp = pick(it, 'valid_period', 'validPeriod') || {};
  const areas = (it.forecasts || []).map((f) => {
    const fc = typeof f.forecast === 'object' && f.forecast ? (f.forecast.text || f.forecast.code || '') : (f.forecast || '');
    return { name: f.area, forecast: String(fc), pos: meta[f.area] || null };
  });
  return {
    t: parseDate(it.timestamp),
    updated: parseDate(pick(it, 'update_timestamp', 'updateTimestamp')),
    validText: vp.text || '',
    validStart: parseDate(vp.start), validEnd: parseDate(vp.end),
    areas,
  };
}

export async function fetchTwentyFour() {
  const body = await getJSON(ENDPOINTS.twentyFourHr);
  const d = neaData(body);
  const recs = (d.records || d.items || []).slice().sort((a, b) =>
    (parseDate(pick(b, 'updatedTimestamp', 'timestamp')) || 0) - (parseDate(pick(a, 'updatedTimestamp', 'timestamp')) || 0));
  const rec = recs[0];
  if (!rec || !rec.general) throw new ApiError('empty', 'No 24-hr forecast');
  const g = rec.general;
  const fc = typeof g.forecast === 'object' && g.forecast ? (g.forecast.text || g.forecast.code || '') : (g.forecast || '');
  const rh = pick(g, 'relativeHumidity', 'relative_humidity') || {};
  const wind = g.wind || {};
  const vp = pick(g, 'validPeriod', 'valid_period') || {};
  return {
    updated: parseDate(pick(rec, 'updatedTimestamp', 'timestamp')),
    text: String(fc),
    tempLow: num((g.temperature || {}).low), tempHigh: num((g.temperature || {}).high),
    rhLow: num(rh.low), rhHigh: num(rh.high),
    windLow: num((wind.speed || {}).low), windHigh: num((wind.speed || {}).high),
    windDir: wind.direction || '',
    validText: vp.text || '',
  };
}

// --- Regional model (Open-Meteo / CAMS) -------------------------------------------------
export async function fetchRegional() {
  const lat = CITIES.map((c) => c.lat).join(',');
  const lon = CITIES.map((c) => c.lon).join(',');
  const url = `${OPEN_METEO_AQ}?latitude=${lat}&longitude=${lon}` +
    '&current=pm2_5,pm10,us_aqi,carbon_monoxide&hourly=pm2_5&forecast_days=2';
  const body = await getJSON(url, { limited: false });
  if (body && body.error) throw new ApiError('payload', body.reason || 'Open-Meteo error');
  const list = Array.isArray(body) ? body : [body];
  if (list.length !== CITIES.length) throw new ApiError('payload', 'Unexpected location count');
  const now = Date.now();
  return list.map((loc, i) => {
    const cur = loc.current || {};
    const hourly = loc.hourly || {};
    const times = (hourly.time || []).map((t) => parseDate(`${t}Z`));
    const series = [];
    times.forEach((t, k) => {
      if (!t) return;
      const v = num((hourly.pm2_5 || [])[k]);
      if (t.getTime() >= now - 3600_000 && series.length < 25) series.push({ t, v });
    });
    return {
      id: CITIES[i].id,
      t: parseDate(cur.time ? `${cur.time}Z` : null),
      pm25: num(cur.pm2_5), pm10: num(cur.pm10), aqi: num(cur.us_aqi), co: num(cur.carbon_monoxide),
      next24: series,
    };
  });
}

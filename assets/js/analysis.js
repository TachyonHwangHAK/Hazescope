// Derivations and cross-referencing between NEA, MSS and the regional model.
import { PSI_BANDS, PM_BANDS, NEA_REGIONS, CITIES, SINGAPORE, XREF } from './config.js';
import { mean, max, min, isNum, haversineKm, bearingDeg, angDiff } from './util.js';

export function bandFor(v, bands) {
  if (!isNum(v)) return null;
  const r = Math.round(v);
  return bands.find((b) => r >= b.min && r <= b.max) || bands[bands.length - 1];
}
export const psiBand = (v) => bandFor(v, PSI_BANDS);
export const pmBand = (v) => bandFor(v, PM_BANDS);

// Merge yesterday + today item lists (dedupe by timestamp).
export function mergeItems(...lists) {
  const map = new Map();
  for (const l of lists) for (const it of (l || [])) if (it && it.t) map.set(it.t.getTime(), it);
  return Array.from(map.values()).sort((a, b) => a.t - b.t);
}

function regionStats(obj) {
  const vals = NEA_REGIONS.map((r) => obj?.[r]).filter(isNum);
  if (!vals.length) return null;
  let maxRegion = null, mx = -Infinity;
  for (const r of NEA_REGIONS) if (isNum(obj?.[r]) && obj[r] > mx) { mx = obj[r]; maxRegion = r; }
  return { byRegion: obj, max: max(vals), min: min(vals), mean: mean(vals), maxRegion };
}

export function windMean(dirSet, speedSet) {
  if (!dirSet || !dirSet.values.length) return null;
  const speedById = {};
  const knotsFactor = /km/i.test(speedSet?.unit || '') ? 1 / 1.852 : /m\/?s/i.test(speedSet?.unit || '') ? 1.943844 : 1;
  for (const v of speedSet?.values || []) speedById[v.id] = v.value * knotsFactor;
  let x = 0, y = 0, wsum = 0;
  for (const v of dirSet.values) {
    const w = isNum(speedById[v.id]) ? Math.max(speedById[v.id], 0.1) : 1;
    const th = (v.value * Math.PI) / 180;
    x += w * Math.sin(th); y += w * Math.cos(th); wsum += w;
  }
  if (!wsum) return null;
  const fromDeg = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  const steadiness = Math.hypot(x, y) / wsum; // 1 = all stations agree
  const knots = mean(Object.values(speedById));
  return {
    fromDeg, steadiness,
    knots: isNum(knots) ? knots : null,
    kmh: isNum(knots) ? knots * 1.852 : null,
    calm: isNum(knots) ? knots < XREF.calmKnots : false,
    stations: dirSet.values.length,
    t: dirSet.t,
  };
}

const HAZE_RE = /haz|smoke|烟霾|霾/i;
const RAIN_RE = /rain|shower|thunder|drizzle/i;

export function summarize(raw) {
  const psiItems = mergeItems(raw.psiPrev?.items, raw.psi?.items);
  const pmItems = mergeItems(raw.pmPrev?.items, raw.pm?.items);
  const psiLatest = psiItems[psiItems.length - 1] || null;
  const pmLatest = pmItems[pmItems.length - 1] || null;

  const psi = psiLatest ? { t: psiLatest.t, updated: psiLatest.updated, ...regionStats(psiLatest.psi24) } : null;
  if (psi) psi.band = psiBand(psi.max);
  const pm = pmLatest ? { t: pmLatest.t, updated: pmLatest.updated, ...regionStats(pmLatest.pm25_1h) } : null;
  if (pm) pm.band = pmBand(pm.max);
  const pm24 = psiLatest ? regionStats(psiLatest.pm25_24) : null;

  // Change vs one hour earlier
  const prevPsi = psiItems.length > 1 ? regionStats(psiItems[psiItems.length - 2].psi24) : null;
  if (psi && prevPsi) psi.delta = psi.max - prevPsi.max;
  const prevPm = pmItems.length > 1 ? regionStats(pmItems[pmItems.length - 2].pm25_1h) : null;
  if (pm && prevPm) pm.delta = pm.max - prevPm.max;

  const temp = raw.airTemperature ? { mean: mean(raw.airTemperature.values.map((v) => v.value)), t: raw.airTemperature.t, n: raw.airTemperature.values.length } : null;
  const rh = raw.humidity ? { mean: mean(raw.humidity.values.map((v) => v.value)), t: raw.humidity.t } : null;
  const wind = windMean(raw.windDirection, raw.windSpeed);
  const rain = raw.rainfall ? {
    raining: raw.rainfall.values.filter((v) => v.value > 0).length,
    total: raw.rainfall.values.length,
    max: max(raw.rainfall.values.map((v) => v.value)),
    t: raw.rainfall.t,
  } : null;

  let twoHr = null;
  if (raw.twoHr) {
    const counts = {};
    for (const a of raw.twoHr.areas) counts[a.forecast] = (counts[a.forecast] || 0) + 1;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    twoHr = {
      ...raw.twoHr,
      hazyCount: raw.twoHr.areas.filter((a) => HAZE_RE.test(a.forecast)).length,
      rainCount: raw.twoHr.areas.filter((a) => RAIN_RE.test(a.forecast)).length,
      total: raw.twoHr.areas.length,
      dominant: dominant ? dominant[0] : '',
    };
  }
  const day = raw.twentyFourHr ? { ...raw.twentyFourHr, hazy: HAZE_RE.test(raw.twentyFourHr.text) } : null;

  const regional = (raw.regional || []).map((r) => {
    const c = CITIES.find((x) => x.id === r.id);
    const pos = { lat: c.lat, lon: c.lon };
    const isSg = c.id === 'sg';
    const dist = isSg ? 0 : haversineKm(SINGAPORE, pos);
    const bear = isSg ? null : bearingDeg(SINGAPORE, pos);
    const upwind = !!(wind && !wind.calm && bear != null && dist <= XREF.upwindMaxKm && angDiff(bear, wind.fromDeg) <= XREF.upwindHalfAngle);
    return { ...r, ...c, dist, bearing: bear, upwind, band: pmBand(r.pm25) };
  });

  return { psi, pm, pm24, psiItems, pmItems, temp, rh, wind, rain, twoHr, day, regional, grid: raw.grid || null };
}

// Time series for the chart: last 24 hourly points per region.
export function chartSeries(items, key) {
  const pts = items.slice(-24);
  return {
    times: pts.map((p) => p.t),
    series: NEA_REGIONS.map((r) => ({ id: r, values: pts.map((p) => (isNum(p[key]?.[r]) ? p[key][r] : null)) })),
  };
}

// --- Cross-reference checks --------------------------------------------------------------
// Each: { id, status: 'ok'|'info'|'warn'|'alert'|'na', key, vars }
export function crossChecks(S, now = Date.now()) {
  const out = [];

  // 1. NEA freshness
  if (S.psi?.t) {
    const ageMin = (now - S.psi.t.getTime()) / 60000;
    out.push(ageMin > XREF.staleNeaMin
      ? { id: 'fresh', status: 'warn', key: 'xref.fresh.stale', vars: { min: Math.round(ageMin) } }
      : { id: 'fresh', status: 'ok', key: 'xref.fresh.ok', vars: { min: Math.max(0, Math.round(ageMin)) } });
  } else out.push({ id: 'fresh', status: 'na', key: 'xref.na' });

  // 2. NEA 1-hr PM2.5 vs 24-hr PM2.5 (trend)
  if (S.pm && S.pm24 && isNum(S.pm.mean) && isNum(S.pm24.mean) && S.pm24.mean > 0) {
    const ratio = S.pm.mean / S.pm24.mean - 1;
    const vars = { h1: Math.round(S.pm.mean), h24: Math.round(S.pm24.mean), pct: Math.round(Math.abs(ratio) * 100) };
    if (ratio > XREF.trendRatio) out.push({ id: 'trend', status: S.pm.mean > 55 ? 'alert' : 'warn', key: 'xref.trend.up', vars });
    else if (ratio < -XREF.trendRatio) out.push({ id: 'trend', status: 'ok', key: 'xref.trend.down', vars });
    else out.push({ id: 'trend', status: 'info', key: 'xref.trend.flat', vars });
  } else out.push({ id: 'trend', status: 'na', key: 'xref.na' });

  // 3. NEA measured vs CAMS model at Singapore
  const sgModel = S.regional.find((r) => r.id === 'sg');
  if (S.pm && isNum(S.pm.mean) && sgModel && isNum(sgModel.pm25)) {
    const diff = sgModel.pm25 - S.pm.mean;
    const agree = Math.abs(diff) <= Math.max(XREF.modelAgreeAbs, XREF.modelAgreeRel * S.pm.mean);
    const vars = { nea: Math.round(S.pm.mean), model: Math.round(sgModel.pm25), diff: Math.round(Math.abs(diff)) };
    out.push({ id: 'model', status: agree ? 'ok' : 'warn', key: agree ? 'xref.model.agree' : (diff > 0 ? 'xref.model.over' : 'xref.model.under'), vars });
  } else out.push({ id: 'model', status: 'na', key: 'xref.na' });

  // 4. MSS wind vs regional sources
  if (S.wind) {
    const ups = S.regional.filter((r) => r.upwind && isNum(r.pm25) && r.pm25 > XREF.regionalElevatedPm)
      .sort((a, b) => b.pm25 - a.pm25);
    const vars = { dir: Math.round(S.wind.fromDeg), cities: ups.map((u) => u.id), top: ups[0]?.id, pm: ups[0] ? Math.round(ups[0].pm25) : null };
    if (S.wind.calm) out.push({ id: 'wind', status: 'info', key: 'xref.wind.calm', vars });
    else if (ups.length) out.push({ id: 'wind', status: 'alert', key: 'xref.wind.upwind', vars });
    else out.push({ id: 'wind', status: 'ok', key: 'xref.wind.clear', vars });
  } else out.push({ id: 'wind', status: 'na', key: 'xref.na' });

  // 5. MSS forecast wording vs NEA readings
  if (S.twoHr || S.day) {
    const hazyFc = (S.twoHr?.hazyCount || 0) > 0 || !!S.day?.hazy;
    const unhealthy = (S.psi?.max || 0) > 100 || (S.pm?.max || 0) > 55;
    const vars = { n: S.twoHr?.hazyCount || 0, total: S.twoHr?.total || 0 };
    if (hazyFc && unhealthy) out.push({ id: 'forecast', status: 'alert', key: 'xref.fc.both', vars });
    else if (hazyFc) out.push({ id: 'forecast', status: 'warn', key: 'xref.fc.hazyOnly', vars });
    else if (unhealthy) out.push({ id: 'forecast', status: 'warn', key: 'xref.fc.readingsOnly', vars });
    else out.push({ id: 'forecast', status: 'ok', key: 'xref.fc.clear', vars });
  } else out.push({ id: 'forecast', status: 'na', key: 'xref.na' });

  // 6. Rain washout
  if (S.rain) {
    const vars = { n: S.rain.raining, total: S.rain.total };
    out.push(S.rain.raining > 0
      ? { id: 'rain', status: 'info', key: 'xref.rain.yes', vars }
      : { id: 'rain', status: 'info', key: 'xref.rain.no', vars });
  } else out.push({ id: 'rain', status: 'na', key: 'xref.na' });

  return out;
}

export function overallConfidence(checks) {
  const scored = checks.filter((c) => c.status !== 'na');
  return { available: scored.length, total: checks.length };
}

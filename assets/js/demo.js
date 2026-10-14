// Demo transport — synthetic data in the exact API shapes, for previews and tests.
// Clearly labelled "Demo data" in the UI; never used unless the user opts in (?demo=1 or the button).
import { NEA_REGIONS, REGION_FALLBACK_POS, CITIES } from './config.js';
import { sgtDateString } from './util.js';

const OFF = { north: -0.18, south: -0.05, east: 0.08, west: 0.16, central: 0.1 };
const pad = (n) => String(n).padStart(2, '0');

function hourlyTimes(date) {
  const today = sgtDateString();
  const nowH = Math.floor((Date.now() + 8 * 3600_000) / 3600_000) % 24;
  const last = date === today ? nowH : 23;
  const out = [];
  for (let h = 0; h <= last; h++) out.push(`${date}T${pad(h)}:00:00+08:00`);
  return out;
}
function hazeLevel(ts) {
  const t = new Date(ts).getTime() / 3600_000;
  return 1 + 0.35 * Math.sin(t / 5.3) + 0.2 * Math.sin(t / 2.1 + 1);
}
const regionMeta = NEA_REGIONS.map((r) => ({ name: r, labelLocation: { latitude: REGION_FALLBACK_POS[r][0], longitude: REGION_FALLBACK_POS[r][1] } }));

function psi(date) {
  return { code: 0, errorMsg: '', data: { regionMetadata: regionMeta, items: hourlyTimes(date).reverse().map((ts) => {
    const k = hazeLevel(ts);
    const per = (base, jitter = 1) => Object.fromEntries(NEA_REGIONS.map((r) => [r, Math.round(base * k * (1 + OFF[r] * jitter))]));
    return { date, timestamp: ts, updatedTimestamp: ts.replace(':00:00', ':01:11'), readings: {
      psi_twenty_four_hourly: per(118), pm25_twenty_four_hourly: per(82), pm10_twenty_four_hourly: per(98),
      o3_eight_hour_max: per(45, 0.3), no2_one_hour_max: per(35, 0.4), so2_twenty_four_hourly: per(5, 0.2), co_eight_hour_max: per(1, 0),
      pm25_sub_index: per(118), pm10_sub_index: per(80), so2_sub_index: per(3, 0), o3_sub_index: per(20, 0.3), co_sub_index: per(12, 0),
    } };
  }) } };
}
function pm25(date) {
  return { code: 0, errorMsg: '', data: { regionMetadata: regionMeta, items: hourlyTimes(date).reverse().map((ts) => {
    const k = hazeLevel(new Date(new Date(ts).getTime() + 3 * 3600_000).toISOString());
    return { date, timestamp: ts, updatedTimestamp: ts, readings: { pm25_one_hourly: Object.fromEntries(NEA_REGIONS.map((r) => [r, Math.round(88 * k * (1 + OFF[r] * 1.3))])) } };
  }) } };
}
const STATIONS = [
  ['S109', 'Ang Mo Kio Avenue 5', 1.3764, 103.8492], ['S50', 'Clementi Road', 1.3337, 103.7768],
  ['S107', 'East Coast Parkway', 1.3135, 103.9625], ['S43', 'Kim Chuan Road', 1.3399, 103.8878],
  ['S60', 'Sentosa', 1.25, 103.8279], ['S24', 'Upper Changi Road North', 1.3678, 103.9826],
  ['S115', 'Tuas South Avenue 3', 1.29377, 103.61843], ['S104', 'Woodlands Avenue 9', 1.44387, 103.78538],
];
function stations(kind) {
  const nowIso = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const val = (i) => ({
    windDirection: 215 + ((i * 17) % 40) - 20,
    windSpeed: 6 + (i % 4) * 1.5,
    airTemperature: 29.4 + (i % 3) * 0.6,
    humidity: 71 + (i % 5) * 2,
    rainfall: i === 6 ? 0.2 : 0,
  }[kind]);
  const unit = { windDirection: 'degrees', windSpeed: 'knots', airTemperature: 'deg C', humidity: 'percentage', rainfall: 'mm' }[kind];
  return { code: 0, errorMsg: '', data: {
    stations: STATIONS.map(([id, name, la, lo]) => ({ id, deviceId: id, name, location: { latitude: la, longitude: lo } })),
    readings: [{ timestamp: nowIso, data: STATIONS.map(([id], i) => ({ stationId: id, value: val(i) })) }],
    readingType: kind, readingUnit: unit,
  } };
}
const AREAS = [['Ang Mo Kio', 1.375, 103.839], ['Bedok', 1.321, 103.924], ['Bukit Timah', 1.3294, 103.8021], ['Changi', 1.357, 103.987],
  ['Jurong West', 1.34039, 103.705], ['Pasir Ris', 1.37, 103.949], ['Queenstown', 1.291, 103.786], ['Tuas', 1.294947, 103.635], ['Woodlands', 1.432, 103.786], ['City', 1.292, 103.844]];
function twoHr() {
  const now = new Date();
  return { code: 0, errorMsg: '', data: {
    area_metadata: AREAS.map(([name, la, lo]) => ({ name, label_location: { latitude: la, longitude: lo } })),
    items: [{ update_timestamp: now.toISOString(), timestamp: now.toISOString(),
      valid_period: { start: now.toISOString(), end: new Date(now.getTime() + 2 * 3600_000).toISOString(), text: '' },
      forecasts: AREAS.map(([name], i) => ({ area: name, forecast: i % 3 === 0 ? 'Hazy' : (i % 3 === 1 ? 'Slightly Hazy' : 'Partly Cloudy (Day)') })) }],
  } };
}
function twentyFour() {
  const now = new Date();
  return { code: 0, errorMsg: '', data: { records: [{ date: sgtDateString(), updatedTimestamp: now.toISOString(), timestamp: now.toISOString(),
    general: { temperature: { low: 25, high: 33, unit: 'Degrees Celsius' }, relativeHumidity: { low: 60, high: 90, unit: 'Percentage' },
      forecast: { code: 'HZ', text: 'Hazy' }, validPeriod: { start: now.toISOString(), end: now.toISOString(), text: '' },
      wind: { speed: { low: 10, high: 20 }, direction: 'SW' } }, periods: [] }] } };
}
function regional() {
  const base = { sg: 92, jb: 98, btm: 85, mlk: 110, kl: 96, pku: 210, jbi: 245, plm: 280, mdn: 60, jkt: 48, ptk: 190, kch: 75, pky: 260, bsb: 30 };
  const start = new Date(); start.setUTCMinutes(0, 0, 0);
  return CITIES.map((c) => {
    const times = [], vals = [];
    for (let i = -2; i < 46; i++) {
      const t = new Date(start.getTime() + i * 3600_000);
      times.push(t.toISOString().slice(0, 16));
      vals.push(Math.round(base[c.id] * (1 + 0.25 * Math.sin(i / 4 + c.lat))));
    }
    return { latitude: c.lat, longitude: c.lon, current: { time: start.toISOString().slice(0, 16), pm2_5: base[c.id], pm10: Math.round(base[c.id] * 1.3), us_aqi: Math.min(500, Math.round(base[c.id] * 1.4 + 20)), carbon_monoxide: 300 + base[c.id] * 4 },
      hourly: { time: times, pm2_5: vals } };
  });
}

export async function demoTransport(url) {
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
  const u = new URL(url);
  const date = u.searchParams.get('date') || sgtDateString();
  const p = u.pathname;
  let body;
  if (u.hostname.includes('open-meteo')) body = regional();
  else if (p.endsWith('/psi')) body = psi(date);
  else if (p.endsWith('/pm25')) body = pm25(date);
  else if (p.endsWith('/wind-direction')) body = stations('windDirection');
  else if (p.endsWith('/wind-speed')) body = stations('windSpeed');
  else if (p.endsWith('/air-temperature')) body = stations('airTemperature');
  else if (p.endsWith('/relative-humidity')) body = stations('humidity');
  else if (p.endsWith('/rainfall')) body = stations('rainfall');
  else if (p.endsWith('/two-hr-forecast')) body = twoHr();
  else if (p.endsWith('/twenty-four-hr-forecast')) body = twentyFour();
  else return { status: 404, body: null };
  return { status: 200, body: JSON.parse(JSON.stringify(body)) };
}

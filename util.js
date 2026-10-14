import { APP } from './config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) node.style.setProperty(sk, sv); else node.style[sk] = sv; } }
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else node.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c) node.append(c);
  return node;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function mean(arr) {
  const v = arr.filter(isNum);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
export function max(arr) {
  const v = arr.filter(isNum);
  return v.length ? Math.max(...v) : null;
}
export function min(arr) {
  const v = arr.filter(isNum);
  return v.length ? Math.min(...v) : null;
}

export const prefersReducedMotion = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// --- Time (Singapore time is UTC+8, no DST) -------------------------------
const SGT_OFFSET_MS = 8 * 3600_000;
export function sgtDateString(date = new Date()) {
  const d = new Date(date.getTime() + SGT_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}
export function sgtHour(date = new Date()) {
  const d = new Date(date.getTime() + SGT_OFFSET_MS);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}
export function fmtTime(date, lang) {
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-SG' : 'en-SG', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Singapore',
    }).format(date);
  } catch { return date.toISOString().slice(11, 16); }
}
export function fmtClock(date, lang) {
  try {
    return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-SG' : 'en-SG', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Singapore',
    }).format(date);
  } catch { return date.toISOString().slice(11, 19); }
}
export function fmtDateLong(date, lang) {
  try {
    return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-SG' : 'en-SG', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Singapore',
    }).format(date);
  } catch { return sgtDateString(date); }
}
export function fmtCountdown(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(t / 60), sec = t % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// --- Geo ---------------------------------------------------------------------
const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
export function bearingDeg(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
export function destinationPoint(a, bearing, km) {
  const d = km / R, br = rad(bearing), la = rad(a.lat), lo = rad(a.lon);
  const lat2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br));
  const lon2 = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(lat2));
  return { lat: deg(lat2), lon: deg(lon2) };
}
export function angDiff(a, b) {
  const d = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return d;
}
export function compassPoint(deg16) {
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return pts[Math.round((((deg16 % 360) + 360) % 360) / 22.5) % 16];
}

// --- Storage (never throws) ---------------------------------------------------
export const store = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(APP.storagePrefix + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { window.localStorage.setItem(APP.storagePrefix + key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) {
    try { window.localStorage.removeItem(APP.storagePrefix + key); } catch { /* ignore */ }
  },
};

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function cssVar(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

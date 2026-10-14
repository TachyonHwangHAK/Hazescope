// HazeScope SG — application bootstrap and rendering.
import { APP, PSI_BANDS, PM_BANDS, ADVISORY, NEA_REGIONS, INTERVAL_CHOICES, DEFAULT_INTERVAL_MIN, SERIES_COLORS, REGION_FALLBACK_POS, XREF } from './config.js';
import { $, $$, h, s, store, isNum, fmtTime, fmtClock, fmtDateLong, fmtCountdown, compassPoint, prefersReducedMotion, cssVar, debounce } from './util.js';
import { t, setLang, getLang, applyDom, listJoin, forecastText, windDirText, onLangChange } from './i18n.js';
import { DataController, SOURCES } from './data.js';
import { summarize, chartSeries, crossChecks, psiBand, pmBand } from './analysis.js';
import { Lerp, animateNumber } from './anim.js';
import { Sky } from './sky.js';
import { LineChart } from './chart.js';
import { MapView } from './map.js';
import { Voice } from './voice.js';
import { Assistant, PERSONAS } from './assistant.js';
import { Tour } from './tutorial.js';

// ---------------------------------------------------------------- settings
const DEFAULTS = { lang: 'en', theme: 'dark', basemap: 'terrain', hazeOn: true, intervalMin: DEFAULT_INTERVAL_MIN, persona: 'aetherguard', voiceOn: true, gender: 'male', rate: 1, announce: true, tutorialDone: false };
const settings = { ...DEFAULTS, ...(store.get('settings') || {}) };
if (!INTERVAL_CHOICES.includes(settings.intervalMin)) settings.intervalMin = DEFAULT_INTERVAL_MIN;
if (!PERSONAS[settings.persona]) settings.persona = 'aetherguard';
if (!['light', 'dark', 'colourful', 'glass'].includes(settings.theme)) settings.theme = 'dark';
const saveSettings = () => store.set('settings', settings);

// ---------------------------------------------------------------- core objects
const data = new DataController();
const voice = new Voice();
voice.enabled = settings.voiceOn; voice.gender = settings.gender; voice.rate = settings.rate; voice.lang = settings.lang;

let S = null; let checks = [];
let metric = 'psi';
let mapView = 'sg';
let nextFetchAt = Date.now();
let lastManual = 0;
let prevBands = store.get('bands') || null;
let lastFailureToast = 0;
let firstRender = true;

const sky = new Sky($('#sky'), $('#now'));
const chart = new LineChart($('#chart'), $('#chart-legend'), $('#chart-table'), {
  lang: getLang,
  colors: () => SERIES_COLORS[['light', 'colourful'].includes(settings.theme) ? 'light' : 'dark'],
});
const map = new MapView($('#map'), $('#map-fallback'), {
  t, compass: compassPoint, basemap: settings.basemap,
  onTimeline: (tl) => renderTimeline(tl),
  regionPos: () => ({ ...REGION_FALLBACK_POS, ...(data.raw.psi?.regions || data.raw.psiPrev?.regions || {}) }),
  onViewChange: (v) => setMapView(v),
});

const assistant = new Assistant({
  voice,
  getCtx: () => ({ S, checks }),
  getPersona: () => settings.persona,
  setPersona: (id) => setPersona(id),
  actions: {
    setTheme: (th) => setTheme(th),
    setLang: (l) => changeLang(l),
    refresh: () => refresh(true),
    startTour: () => tour.start(),
    focusCity: (id) => { map.focusCity(id); },
    focusRegion: (r) => { map.focusRegion(r); },
  },
});

const tour = new Tour({
  voice,
  setLang: (l) => changeLang(l),
  setPersona: (id) => setPersona(id),
  getPersona: () => settings.persona,
  onFinish: () => { settings.tutorialDone = true; saveSettings(); },
});

// ---------------------------------------------------------------- theme & language
function setTheme(theme) {
  settings.theme = theme; saveSettings();
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', { dark: '#0c1524', light: '#edf2f7', colourful: '#fff6ee', glass: '#071320' }[theme]);
  sky.setTheme(theme, cssVar('--bg'));
  $$('[data-theme-opt]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.themeOpt === theme)); b.setAttribute('aria-checked', String(b.dataset.themeOpt === theme)); });
  if (chart.data) chart.refreshLabels();
}

function changeLang(lang) {
  settings.lang = lang; saveSettings();
  voice.lang = lang; voice.stop();
  setLang(lang);
}
onLangChange(() => {
  $('#lang-glyph').textContent = getLang() === 'zh' ? 'EN' : '华';
  document.title = getLang() === 'zh' ? 'HazeScope SG — 新加坡及区域烟霾监测' : 'HazeScope SG — Singapore & regional haze monitor';
  buildIntervalOptions(); renderPersonaPickers(); assistant.renderChips();
  $$('#set-lang [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  updateVoiceHelp(); updateDemoButton();
  render();
  map.refreshLabels();
  renderTimeline(map.timeline());
  refreshAllSegs();
});

function setPersona(id) {
  if (!PERSONAS[id]) return;
  const changed = settings.persona !== id;
  settings.persona = id; settings.gender = PERSONAS[id].gender; voice.gender = settings.gender; saveSettings();
  renderPersonaPickers(); updateVoiceHelp();
  $$('#set-gender [data-gender]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gender === settings.gender)));
  refreshAllSegs();
  if (changed && assistant.open) assistant.greet(true);
  else if (changed) assistant.greeted = false;
}

function renderPersonaPickers() {
  const lang = getLang(); const p = PERSONAS[settings.persona];
  const orb = (pp, cls = 'orb') => h('span', { class: cls, 'data-persona': pp.id, html: `<svg><use href="#${pp.icon}"/></svg>` });
  for (const id of ['#fab-orb', '#asst-orb']) { const el = $(id); el.dataset.persona = p.id; el.innerHTML = `<svg><use href="#${p.icon}"/></svg>`; }
  $('#fab-label').textContent = p.name[lang];
  $('#asst-name').textContent = p.name[lang];
  $('#asst-role').textContent = t(`persona.${p.id}.role`);
  $('#persona-switch').replaceChildren(...Object.values(PERSONAS).map((pp) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(pp.id === p.id), onclick: () => setPersona(pp.id),
  }, orb(pp), pp.name[lang])));
  $('#set-persona').replaceChildren(...Object.values(PERSONAS).map((pp) => h('button', {
    type: 'button', 'aria-pressed': String(pp.id === p.id), onclick: () => setPersona(pp.id),
  }, orb(pp), h('span', {}, h('b', { text: pp.name[lang] }), h('small', { text: t(`persona.${pp.id}.role`) })))));
}

// ---------------------------------------------------------------- segmented controls
function updateSeg(seg) {
  const thumb = seg.querySelector('.seg-thumb'); if (!thumb) return;
  const on = seg.querySelector('button[aria-selected="true"], button[aria-pressed="true"]');
  if (!on || !on.offsetWidth) return;
  thumb.style.width = `${on.offsetWidth}px`;
  thumb.style.transform = `translateX(${on.offsetLeft}px)`;
}
function refreshAllSegs() { $$('.seg').forEach(updateSeg); }
window.addEventListener('seg-refresh', refreshAllSegs);
window.addEventListener('resize', debounce(refreshAllSegs, 100));

// ---------------------------------------------------------------- helpers
function bandIcon(b) { return `<svg><use href="#i-${b ? b.icon : 'circle'}"/></svg>`; }
function setChip(el, band, label) {
  el.dataset.band = band ? band.id : 'none';
  el.style.setProperty('--band', band ? band.color : 'var(--muted)');
  el.innerHTML = `${bandIcon(band)}<span></span>`;
  el.querySelector('span').textContent = label || '—';
}
function ago(date) {
  if (!date) return '';
  const sec = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (sec < 45) return t('time.justNow');
  if (sec < 3600) return t('time.minAgo', { n: Math.round(sec / 60) });
  return t('time.hAgo', { n: Math.floor(sec / 3600), m: Math.round((sec % 3600) / 60) });
}
const lowerFirst = (str) => (getLang() === 'zh' ? str : str.charAt(0).toLowerCase() + str.slice(1));

function toast(msg, kind = 'info', ms = 5200) {
  const icon = kind === 'error' ? 'alert2' : kind === 'band' ? 'alert' : 'info';
  const el = h('div', { class: 'toast', 'data-kind': kind, role: kind === 'error' ? 'alert' : 'status' }, h('span', { html: `<svg><use href="#i-${icon}"/></svg>` }), h('p', { text: msg }));
  const box = $('#toasts');
  box.append(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 320); }, ms);
}

// ---------------------------------------------------------------- rendering
const scaleLerp = new Lerp(0, { tau: 0.35, epsilon: 0.05, onUpdate: (v) => { $('#scale-marker').style.transform = `translateX(${v}px)`; } });
const compassLerp = new Lerp(0, { tau: 0.45, epsilon: 0.1, angular: true, onUpdate: (v) => { $('#compass-arrow').setAttribute('transform', `rotate(${v.toFixed(1)} 60 60)`); } });

function render() {
  S = summarize(data.raw);
  checks = crossChecks(S);
  renderHero(); renderRegions(); renderWeather(); renderChart(); renderXref(); renderRegional(); renderAdvice(); renderSources(); renderStatus();
  map.update(S);
  maybeAnnounce();
  firstRender = false;
}

function renderHero() {
  const lang = getLang();
  if (S.psi && isNum(S.psi.max)) {
    $('#psi-value').parentElement.classList.remove('is-empty'); $('#psi-scale').classList.remove('is-empty');
    animateNumber($('#psi-value'), Math.round(S.psi.max));
    setChip($('#psi-band'), S.psi.band, t('band.' + S.psi.band.id));
    const range = t('hero.range', { min: Math.round(S.psi.min), max: Math.round(S.psi.max), region: lowerFirst(t('region.' + S.psi.maxRegion)) });
    const delta = isNum(S.psi.delta) ? (S.psi.delta > 0 ? t('hero.deltaUp', { n: Math.round(S.psi.delta) }) : S.psi.delta < 0 ? t('hero.deltaDown', { n: Math.round(-S.psi.delta) }) : t('hero.deltaFlat')) : '';
    $('#psi-sub').textContent = [range, delta].filter(Boolean).join(lang === 'zh' ? '。' : '. ') + (lang === 'zh' ? '。' : '.');
    const track = $('#psi-scale .scale-track');
    scaleLerp.set(Math.min(1, S.psi.max / 400) * track.clientWidth);
    const adv = ADVISORY[S.psi.band.id];
    $('#hero-advice').textContent = t('hero.advice', { a: lowerFirst(t(adv.healthy)), b: lowerFirst(t(adv.vulnerable)) });
    const pub = S.psi.updated || S.psi.t;
    $('#hero-meta').textContent = data.fromCache && !data.demo ? t('hero.metaCached', { time: fmtTime(S.psi.t, lang) }) : t('hero.meta', { time: fmtTime(S.psi.t, lang), ago: ago(pub) });
  } else {
    $('#psi-value').parentElement.classList.add('is-empty'); $('#psi-scale').classList.add('is-empty');
    animateNumber($('#psi-value'), null, { fallback: '' });
    setChip($('#psi-band'), null, '—');
    $('#psi-sub').textContent = ' ';
    $('#hero-advice').textContent = t('hero.adviceNone');
    $('#hero-meta').textContent = '';
  }
  if (S.pm && isNum(S.pm.max)) {
    $('#pm-value').parentElement.classList.remove('is-empty');
    animateNumber($('#pm-value'), Math.round(S.pm.max));
    setChip($('#pm-band'), S.pm.band, t('pmband.' + S.pm.band.id));
    const delta = isNum(S.pm.delta) ? (S.pm.delta > 0 ? t('hero.deltaUp', { n: Math.round(S.pm.delta) }) : S.pm.delta < 0 ? t('hero.deltaDown', { n: Math.round(-S.pm.delta) }) : t('hero.deltaFlat')) : '';
    $('#pm-sub').textContent = `${fmtTime(S.pm.t, lang)}${delta ? (lang === 'zh' ? '，' : ', ') + lowerFirst(delta) : ''}`;
    sky.setHaze(S.pm.max);
  } else {
    $('#pm-value').parentElement.classList.add('is-empty');
    animateNumber($('#pm-value'), null, { fallback: '' });
    setChip($('#pm-band'), null, '—');
    $('#pm-sub').textContent = ' ';
  }
  if (S.wind) sky.setWind(S.wind.fromDeg, S.wind.knots);
}

function renderRegions() {
  const psiItem = S.psiItems[S.psiItems.length - 1]; const pmItem = S.pmItems[S.pmItems.length - 1];
  const list = $('#region-list');
  if (!list.children.length) {
    list.replaceChildren(...NEA_REGIONS.map((r) => h('li', {}, h('button', { type: 'button', 'data-region': r, onclick: () => { if (mapView !== 'sg') setMapView('sg'); map.focusRegion(r); } },
      h('span', { class: 'rg-name' }, h('i'), h('span', { class: 'rg-label' })), h('span', { class: 'rg-psi num' }, '—'), h('span', { class: 'rg-pm' })))));
  }
  for (const r of NEA_REGIONS) {
    const btn = list.querySelector(`[data-region="${r}"]`);
    const v = psiItem?.psi24?.[r]; const pm = pmItem?.pm25_1h?.[r]; const b = psiBand(v);
    btn.querySelector('.rg-label').textContent = t('region.' + r);
    btn.style.setProperty('--band', b ? b.color : 'var(--muted)');
    animateNumber(btn.querySelector('.rg-psi'), isNum(v) ? Math.round(v) : null);
    btn.querySelector('.rg-pm').textContent = isNum(pm) ? `PM2.5 ${Math.round(pm)} µg/m³` : 'PM2.5 —';
    btn.setAttribute('aria-label', `${t('region.' + r)}: PSI ${isNum(v) ? Math.round(v) : '—'} ${b ? t('band.' + b.id) : ''}, PM2.5 ${isNum(pm) ? Math.round(pm) : '—'}`);
  }
}

function renderWeather() {
  const lang = getLang();
  if (S.wind) {
    compassLerp.set(S.wind.fromDeg + 180);
    $('#wind-from').textContent = S.wind.calm ? t('wx.calm') : t('wx.windFrom', { dir: t('compass.' + compassPoint(S.wind.fromDeg)) });
    const det = isNum(S.wind.knots) ? t('wx.windDetail', { kt: S.wind.knots.toFixed(1), kmh: Math.round(S.wind.kmh), n: S.wind.stations }) : '';
    $('#wind-detail').textContent = S.wind.steadiness < 0.4 ? `${det}${lang === 'zh' ? '。' : '. '}${t('wx.windVariable')}` : det;
  } else { $('#wind-from').textContent = '—'; $('#wind-detail').textContent = ' '; }
  animateNumber($('#wx-temp'), S.temp?.mean, { decimals: 1 });
  animateNumber($('#wx-rh'), isNum(S.rh?.mean) ? Math.round(S.rh.mean) : null);
  $('#wx-rain').textContent = S.rain ? (S.rain.raining ? t('wx.rainYes', { n: S.rain.raining, total: S.rain.total }) : t('wx.rainNo')) : '—';
  if (S.twoHr) {
    $('#fc2-main').textContent = forecastText(S.twoHr.dominant);
    $('#fc2-sub').textContent = S.twoHr.hazyCount ? t('wx.fc2Hazy', { n: S.twoHr.hazyCount, total: S.twoHr.total }) : t('wx.fc2Most', { total: S.twoHr.total });
  } else { $('#fc2-main').textContent = '—'; $('#fc2-sub').textContent = ' '; }
  if (S.day) {
    $('#fc24-main').textContent = forecastText(S.day.text);
    $('#fc24-sub').textContent = t('wx.fc24Sub', { lo: S.day.tempLow ?? '—', hi: S.day.tempHigh ?? '—', rlo: S.day.rhLow ?? '—', rhi: S.day.rhHigh ?? '—', dir: windDirText(S.day.windDir), wlo: S.day.windLow ?? '—', whi: S.day.windHigh ?? '—' });
  } else { $('#fc24-main').textContent = '—'; $('#fc24-sub').textContent = ' '; }
}

function renderChart() {
  const isPsi = metric === 'psi';
  const cs = isPsi ? chartSeries(S.psiItems, 'psi24') : chartSeries(S.pmItems, 'pm25_1h');
  $('#trend-desc').textContent = t(isPsi ? 'trend.descPsi' : 'trend.descPm');
  chart.update({
    times: cs.times,
    series: cs.series.map((sr) => ({ ...sr, label: t('region.' + sr.id) })),
    bands: (isPsi ? PSI_BANDS : PM_BANDS).map((b) => ({ ...b, label: t((isPsi ? 'band.' : 'pmband.') + b.id) })),
    step: isPsi ? 50 : 25, minTop: isPsi ? 110 : 70,
    unitLabel: isPsi ? 'PSI' : 'µg/m³', timeLabel: t('trend.time'), emptyText: t('trend.empty'),
    ariaLabel: t('trend.aria', { metric: isPsi ? t('hero.psi') : t('hero.pm') }),
  });
}

const XREF_ICON = { ok: 'check', info: 'info', warn: 'alert', alert: 'alert2', na: 'circle' };
function renderXref() {
  const titles = { fresh: 'xref.fresh.title', trend: 'xref.trend.title', model: 'xref.model.title', wind: 'xref.wind.title', forecast: 'xref.fc.title', rain: 'xref.rain.title' };
  $('#xref-list').replaceChildren(...checks.map((c) => {
    const vars = { ...c.vars };
    if (c.id === 'wind' && c.vars) {
      vars.dirName = t('compass.' + compassPoint(c.vars.dir || 0));
      vars.cities = listJoin((c.vars.cities || []).slice(0, 3).map((id) => t('city.' + id)));
      vars.km = XREF.upwindMaxKm;
    }
    return h('li', { class: 'xref-item', 'data-status': c.status },
      h('span', { class: 'xref-icon', html: `<svg><use href="#i-${XREF_ICON[c.status]}"/></svg>` }),
      h('div', {}, h('p', { class: 'xref-title' }, h('span', { text: t(titles[c.id]) }), h('span', { class: 'xref-tag', text: t('xref.status.' + c.status) })),
        h('p', { class: 'xref-body', text: t(c.key, vars) })));
  }));
}

function sparkline(points) {
  const vals = points.map((p) => p.v).filter(isNum);
  const svg = s('svg', { class: 'spark', viewBox: '0 0 120 30', preserveAspectRatio: 'none', role: 'img' });
  if (vals.length < 2) return svg;
  const top = Math.max(80, ...vals) * 1.1;
  const y = (v) => 28 - (v / top) * 26;
  svg.append(s('line', { x1: 0, x2: 120, y1: y(55), y2: y(55), class: 'spark-ref' }));
  let d = '';
  points.forEach((p, i) => { if (isNum(p.v)) d += `${d ? 'L' : 'M'}${((i / (points.length - 1)) * 120).toFixed(1)},${y(p.v).toFixed(1)}`; });
  svg.append(s('path', { d }));
  svg.setAttribute('aria-label', t('reg.sparkAria', { a: Math.round(vals[0]), b: Math.round(vals[vals.length - 1]) }));
  return svg;
}

function renderRegional() {
  const body = $('#reg-body');
  const rows = [...S.regional].sort((a, b) => (a.id === 'sg' ? -1 : b.id === 'sg' ? 1 : (b.pm25 ?? -1) - (a.pm25 ?? -1)));
  if (!rows.length) { body.replaceChildren(h('tr', {}, h('td', { colspan: '6', class: 'fineprint', text: t('reg.empty') }))); return; }
  body.replaceChildren(...rows.map((c) => {
    const b = c.band;
    const tr = h('tr', { tabindex: '0', 'data-city': c.id },
      h('td', {}, h('span', { class: 'reg-place' }, t('city.' + c.id),
        c.upwind ? h('span', { class: 'upwind', html: `<svg><use href="#i-wind"/></svg>` }, t('reg.upwind')) : null),
        h('span', { class: 'reg-cc', text: t('cc.' + c.cc) })),
      h('td', { class: 'r' }, h('b', { text: isNum(c.pm25) ? Math.round(c.pm25) : '—' })),
      h('td', {}, h('span', { class: 'lvl', style: { '--band': b ? b.color : 'var(--muted)' }, html: bandIcon(b) }, b ? t('pmband.' + b.id) : '—')),
      h('td', { class: 'r', text: isNum(c.aqi) ? Math.round(c.aqi) : '—' }),
      h('td', { class: 'r', text: c.dist ? `${Math.round(c.dist)} km ${compassPoint(c.bearing)}` : '—' }),
      h('td', {}, sparkline(c.next24 || [])));
    const go = () => { setMapView('region'); map.focusCity(c.id); $('#map-section').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }); };
    tr.addEventListener('click', go);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    return tr;
  }));
}

function renderAdvice() {
  const cur = S.psi?.band?.id;
  $('#adv-body').replaceChildren(...PSI_BANDS.map((b) => {
    const a = ADVISORY[b.id];
    const range = b.max === Infinity ? `> ${b.min - 1}` : `${b.min}–${b.max}`;
    return h('tr', { class: b.id === cur ? 'is-current' : '', style: { '--band': b.color } },
      h('td', {}, h('span', { class: 'adv-band', html: bandIcon(b) }, t('band.' + b.id), b.id === cur ? h('span', { class: 'adv-now', text: t('adv.now') }) : null), h('span', { class: 'adv-range', text: range })),
      h('td', { text: t(a.healthy) }), h('td', { text: t(a.vulnerable) }), h('td', { text: t(a.chronic) }));
  }));
}

function renderSources() {
  const lang = getLang();
  const items = SOURCES.map((k) => {
    const st = data.status[k];
    const state = !st ? '' : st.ok ? 'ok' : 'err';
    const detail = !st ? t('foot.never') : st.ok ? fmtTime(new Date(st.at), lang) : t('foot.failed', { why: t('err.' + (st.error || 'unknown')) });
    return { k, state, detail };
  });
  $('#sources-list').replaceChildren(...items.map((i) => h('li', {}, h('span', { class: `src-dot ${i.state}` }), h('span', {}, `${t('src.' + i.k)}: `, h('span', { class: 'fineprint', text: i.detail })))));
  $('#sources-status').replaceChildren(...items.map((i) => h('div', {}, h('span', {}, h('span', { class: `src-dot ${i.state}`, style: { display: 'inline-block', marginRight: '8px' } }), t('src.' + i.k)), h('span', { text: i.detail }))));
  const demoOn = data.demo;
  $('#demo-banner').hidden = !demoOn;
  const noCore = !data.hasCore();
  const coreFailed = (data.status.psi && !data.status.psi.ok) || (data.status.pm && !data.status.pm.ok);
  $('#empty-state').hidden = demoOn || !noCore || !coreFailed;
  if (!$('#empty-state').hidden) {
    const err = data.status.psi?.error;
    $('#empty-detail').textContent = !navigator.onLine ? t('toast.offline') : err === 'rate' ? t('empty.rate') : err === 'network' ? t('empty.network') : t('empty.body');
  }
}

function statusState() {
  if (data.demo) return 'demo';
  if (!navigator.onLine) return 'offline';
  const coreFailed = (data.status.psi && !data.status.psi.ok) || (data.status.pm && !data.status.pm.ok);
  if (!data.hasCore() && coreFailed) return 'error';
  if (data.inflight) return 'loading';
  if (data.fromCache) return 'cached';
  if (data.errorCount()) return 'partial';
  return data.hasCore() ? 'live' : 'loading';
}
function renderStatus() {
  const st = statusState();
  const pill = $('#status-pill');
  pill.dataset.state = st;
  $('#status-text').textContent = t('status.' + st);
  const remain = nextFetchAt - Date.now();
  $('#status-count').textContent = st === 'loading' || st === 'offline' ? '' : fmtCountdown(remain);
  pill.title = t('status.title', { cd: fmtCountdown(remain) });
}

function maybeAnnounce() {
  const now = { psi: S.psi?.band?.id || null, pm: S.pm?.band?.id || null };
  if (!now.psi && !now.pm) return;
  if (prevBands && settings.announce && !data.demo && !firstRender) {
    const msgs = [];
    if (now.psi && prevBands.psi && now.psi !== prevBands.psi) msgs.push(t('toast.band', { metric: t('hero.psi'), band: t('band.' + now.psi), value: Math.round(S.psi.max) }));
    if (now.pm && prevBands.pm && now.pm !== prevBands.pm) msgs.push(t('toast.band', { metric: t('hero.pm'), band: t('pmband.' + now.pm), value: Math.round(S.pm.max) }));
    if (msgs.length) {
      msgs.forEach((m) => toast(m, 'band', 9000));
      $('#sr-live').textContent = msgs.join(' ');
      if (!tour.active) voice.speak(msgs.join(' '));
    }
  }
  prevBands = now; store.set('bands', now);
}

// ---------------------------------------------------------------- refresh loop
async function refresh(manual = false) {
  if (data.inflight) return;
  if (manual && Date.now() - lastManual < 10_000) { toast(t('toast.cooldown')); return; }
  if (manual) lastManual = Date.now();
  if (!navigator.onLine && !data.demo) { renderStatus(); if (manual) toast(t('toast.offline'), 'error'); return; }
  nextFetchAt = Date.now() + settings.intervalMin * 60_000;
  const p = data.refresh();
  renderStatus(); renderSources();
  await p;
  const errs = SOURCES.filter((k) => data.status[k] && !data.status[k].ok);
  if (!data.demo && errs.length) {
    const coreFailed = errs.includes('psi') || errs.includes('pm');
    if (coreFailed && Date.now() - lastFailureToast > 10 * 60_000) { toast(t('toast.network'), 'error', 8000); lastFailureToast = Date.now(); }
    else if (!coreFailed && manual) toast(t('toast.partial', { n: errs.length, total: SOURCES.length }));
  }
}

data.on((reason) => {
  if (reason === 'start') { renderStatus(); return; }
  render();
});

function tick() {
  const now = new Date();
  $('#hero-clock').textContent = fmtClock(now, getLang());
  $('#hero-date').textContent = fmtDateLong(now, getLang());
  renderStatus();
  // Refresh "published x min ago" text without recomputing everything
  if (S?.psi?.t && !(data.fromCache && !data.demo)) {
    const pub = S.psi.updated || S.psi.t;
    $('#hero-meta').textContent = t('hero.meta', { time: fmtTime(S.psi.t, getLang()), ago: ago(pub) });
  }
  if (Date.now() >= nextFetchAt && !data.inflight && !document.hidden && (navigator.onLine || data.demo)) refresh();
}

// ---------------------------------------------------------------- UI wiring
function buildIntervalOptions() {
  const sel = $('#set-interval');
  sel.replaceChildren(...INTERVAL_CHOICES.map((n) => h('option', { value: String(n), text: n === 1 ? t('set.intervalOpt1') : n === 60 ? t('set.intervalOpt60') : t('set.intervalOpt', { n }) })));
  sel.value = String(settings.intervalMin);
}

function updateVoiceHelp() {
  const d = voice.describe();
  const el = $('#voice-help');
  el.textContent = d.status === 'ok' ? t('set.voiceOk', { name: d.name })
    : d.status === 'approx' ? t('set.voiceApprox', { name: d.name, gender: t(settings.gender === 'female' ? 'set.female.lc' : 'set.male.lc') })
    : d.status === 'none' ? t('set.voiceNone') : t('set.voiceUnsupported');
  const on = settings.voiceOn && voice.supported;
  for (const b of [$('#voice-btn'), $('#asst-speak')]) {
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = `<svg><use href="#i-${on ? 'volume' : 'mute'}"/></svg>`;
  }
  $('#set-voice-on').checked = settings.voiceOn;
  $('#set-rate').value = String(settings.rate);
}
function updateDemoButton() { $('#set-demo').textContent = t(data.demo ? 'set.demoOff' : 'set.demoOn'); }

function toggleVoice() {
  settings.voiceOn = !settings.voiceOn; voice.enabled = settings.voiceOn; saveSettings();
  if (!settings.voiceOn) voice.stop(); else voice.unlock();
  updateVoiceHelp();
}

// Sheets (settings) with focus management
let lastFocus = null;
function openSheet(sheet) {
  lastFocus = document.activeElement;
  sheet.hidden = false; sheet.classList.add('is-entering');
  const scrim = $('#scrim'); scrim.hidden = false; scrim.classList.add('is-entering');
  requestAnimationFrame(() => requestAnimationFrame(() => { sheet.classList.remove('is-entering'); scrim.classList.remove('is-entering'); refreshAllSegs(); }));
  setTimeout(() => sheet.querySelector('button, select, input')?.focus({ preventScroll: true }), 50);
}
function closeSheet(sheet) {
  if (sheet.hidden) return;
  sheet.classList.add('is-leaving'); const scrim = $('#scrim'); scrim.classList.add('is-leaving');
  setTimeout(() => { sheet.hidden = true; sheet.classList.remove('is-leaving'); scrim.hidden = true; scrim.classList.remove('is-leaving'); }, 300);
  lastFocus?.focus?.({ preventScroll: true });
}
function trapFocus(container, e) {
  if (e.key !== 'Tab') return;
  const f = Array.from(container.querySelectorAll('button, select, input, a[href], [tabindex="0"]')).filter((el) => el.offsetParent !== null && !el.disabled);
  if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
}

// ---------------------------------------------------------------- haze timeline & basemap
let playTimer = 0;
function setBasemap(kind) {
  settings.basemap = kind; saveSettings();
  $$('#basemap-seg [data-basemap]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.basemap === kind)));
  updateSeg($('#basemap-seg'));
  map.setBasemap(kind);
}
function timelineLabel(h) {
  const tl = map.timeline();
  const when = $('#haze-when'), what = $('#haze-what');
  if (!tl.available) { when.textContent = t('map.noGridTitle'); what.textContent = t('map.noGrid'); return; }
  if (h <= 0) { when.textContent = t('map.now'); what.textContent = t('map.nowDetail'); return; }
  const tm = map.timeAt(h);
  when.textContent = t('map.ahead', { h, time: tm ? fmtTime(tm, getLang()) : '' });
  what.textContent = t('map.aheadDetail');
}
function renderTimeline(tl) {
  const slider = $('#haze-slider');
  slider.disabled = !tl.available; $('#haze-play').disabled = !tl.available;
  slider.max = String(tl.available ? tl.max : 0);
  if (+slider.value > tl.max) slider.value = String(tl.max);
  const ticks = $('#haze-ticks');
  if (tl.available && tl.max > 0) {
    const marks = [];
    for (let k = 0; k <= tl.max; k += 6) marks.push(k);
    ticks.replaceChildren(...marks.map((k) => h('span', { style: { left: `${(k / tl.max) * 100}%` }, text: k === 0 ? t('map.now') : fmtTime(map.timeAt(k), getLang()) })));
  } else ticks.replaceChildren();
  slider.style.setProperty('--fill', `${tl.max ? (+slider.value / tl.max) * 100 : 0}%`);
  timelineLabel(+slider.value);
}
function setHazeHour(hh, { fromPlay = false } = {}) {
  const slider = $('#haze-slider');
  slider.value = String(hh);
  slider.style.setProperty('--fill', `${+slider.max ? (hh / +slider.max) * 100 : 0}%`);
  map.setTime(hh);
  timelineLabel(hh);
  if (!fromPlay) stopPlay();
}
function stopPlay() {
  clearInterval(playTimer); playTimer = 0;
  const b = $('#haze-play'); b.innerHTML = '<svg><use href="#i-play"/></svg>'; b.setAttribute('aria-label', t('map.play'));
}
function togglePlay() {
  if (playTimer) { stopPlay(); return; }
  const slider = $('#haze-slider'); const max = +slider.max; if (!max) return;
  if (+slider.value >= max) setHazeHour(0, { fromPlay: true });
  const b = $('#haze-play'); b.innerHTML = '<svg><use href="#i-pause"/></svg>'; b.setAttribute('aria-label', t('map.pause'));
  let hold = 0;
  playTimer = setInterval(() => {
    const v = +slider.value;
    if (v >= max) { if (++hold > 2) { hold = 0; setHazeHour(0, { fromPlay: true }); } return; }
    setHazeHour(v + 1, { fromPlay: true });
  }, prefersReducedMotion() ? 1200 : 650);
}

function setMapView(v) {
  mapView = v;
  $$('#map-seg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  updateSeg($('#map-seg'));
  $('#map-desc').textContent = t(v === 'region' ? 'map.descRegion' : 'map.descSg');
  $('#map-desc').dataset.i18n = v === 'region' ? 'map.descRegion' : 'map.descSg';
  map.setView(v);
}

function wire() {
  // Top bar
  $('#lang-btn').addEventListener('click', () => changeLang(getLang() === 'zh' ? 'en' : 'zh'));
  $('#voice-btn').addEventListener('click', toggleVoice);
  $('#asst-speak').addEventListener('click', toggleVoice);
  $('#status-pill').addEventListener('click', () => refresh(true));
  $('#settings-btn').addEventListener('click', () => openSheet($('#settings')));
  $('#settings-close').addEventListener('click', () => closeSheet($('#settings')));
  $('#scrim').addEventListener('click', () => closeSheet($('#settings')));
  $('#settings').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet($('#settings')); trapFocus($('#settings'), e); });

  // Theme menu
  const tb = $('#theme-btn'), tm = $('#theme-menu');
  const closeMenu = () => { tm.hidden = true; tb.setAttribute('aria-expanded', 'false'); };
  tb.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = tm.hidden; tm.hidden = !open; tb.setAttribute('aria-expanded', String(open));
    if (open) tm.querySelector(`[data-theme-opt="${settings.theme}"]`)?.focus();
  });
  tm.addEventListener('keydown', (e) => {
    const items = $$('button', tm); const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === 'Escape') { closeMenu(); tb.focus(); }
  });
  document.addEventListener('click', (e) => { if (!tm.hidden && !tm.contains(e.target)) closeMenu(); });
  $$('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.themeOpt); closeMenu(); }));

  // Settings controls
  $$('#set-lang [data-lang]').forEach((b) => b.addEventListener('click', () => changeLang(b.dataset.lang)));
  $('#set-interval').addEventListener('change', (e) => {
    settings.intervalMin = +e.target.value; saveSettings();
    const last = data.lastRefresh ? data.lastRefresh.getTime() : Date.now();
    nextFetchAt = Math.max(Date.now() + 2000, last + settings.intervalMin * 60_000);
    renderStatus();
  });
  $('#set-voice-on').addEventListener('change', (e) => { if (e.target.checked !== settings.voiceOn) toggleVoice(); });
  $$('#set-gender [data-gender]').forEach((b) => b.addEventListener('click', () => {
    settings.gender = b.dataset.gender; voice.gender = settings.gender; saveSettings();
    $$('#set-gender [data-gender]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    updateSeg($('#set-gender')); updateVoiceHelp();
  }));
  $('#set-rate').addEventListener('input', (e) => { settings.rate = +e.target.value; voice.rate = settings.rate; saveSettings(); });
  $('#voice-test').addEventListener('click', () => {
    voice.unlock();
    const p = PERSONAS[settings.persona];
    const line = getLang() === 'zh' ? `您好，我是${p.spoken.zh}。今天也要好好呼吸。` : `Hello, I’m ${p.spoken.en}. Let’s keep an eye on the air together.`;
    voice.speak(line, { force: true });
  });
  $('#set-announce').checked = settings.announce;
  $('#set-announce').addEventListener('change', (e) => { settings.announce = e.target.checked; saveSettings(); });
  $('#set-refresh').addEventListener('click', () => refresh(true));
  $('#set-tour').addEventListener('click', () => { closeSheet($('#settings')); setTimeout(() => tour.start(), 320); });
  $('#set-clear').addEventListener('click', () => { data.clearCache(); store.remove('bands'); toast(t('toast.cleared')); });
  $('#set-demo').addEventListener('click', () => toggleDemo(!data.demo));
  $('#demo-exit').addEventListener('click', () => toggleDemo(false));
  $('#empty-retry').addEventListener('click', () => { lastManual = 0; refresh(true); });
  $('#empty-demo').addEventListener('click', () => toggleDemo(true));

  // Map & chart segs
  $$('#map-seg button').forEach((b) => b.addEventListener('click', () => setMapView(b.dataset.view)));
  $$('#basemap-seg [data-basemap]').forEach((b) => b.addEventListener('click', () => setBasemap(b.dataset.basemap)));
  $('#haze-slider').addEventListener('input', (e) => setHazeHour(+e.target.value));
  $('#haze-play').addEventListener('click', togglePlay);
  $('#haze-on').addEventListener('change', (e) => { settings.hazeOn = e.target.checked; saveSettings(); map.setHazeVisible(settings.hazeOn); });
  $$('#trend-seg button').forEach((b) => b.addEventListener('click', () => {
    metric = b.dataset.metric;
    $$('#trend-seg button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    updateSeg($('#trend-seg')); renderChart();
  }));
  for (const seg of ['#map-seg', '#trend-seg']) {
    $(seg).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const btns = $$('button', $(seg)); const i = btns.indexOf(document.activeElement); if (i < 0) return;
      const n = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length]; n.focus(); n.click();
    });
  }

  // Assistant
  $('#assistant-fab').addEventListener('click', () => { voice.unlock(); assistant.show(); });
  $('#assistant').addEventListener('keydown', (e) => { if (e.key === 'Escape') assistant.hide(); });
  voice.onState = (on) => { $('#asst-orb').classList.toggle('is-speaking', on); $('#fab-orb').classList.toggle('is-speaking', on); };
  if (voice.supported) {
    const vs = window.speechSynthesis;
    const upd = () => updateVoiceHelp();
    vs.addEventListener ? vs.addEventListener('voiceschanged', upd) : (vs.onvoiceschanged = upd);
  }

  // Section highlighting
  const navLinks = $$('[data-nav]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === e.target.id));
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['now', 'map-section', 'trends-section', 'xref-section', 'regional-section', 'advice-section', 'weather-section'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  // Connectivity & visibility
  window.addEventListener('online', () => { toast(t('toast.online')); refresh(); });
  window.addEventListener('offline', () => { toast(t('toast.offline'), 'error'); renderStatus(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() >= nextFetchAt) refresh(); });
  window.addEventListener('resize', debounce(() => { if (S?.psi && isNum(S.psi.max)) scaleLerp.set(Math.min(1, S.psi.max / 400) * $('#psi-scale .scale-track').clientWidth, { instant: true }); }, 120));

  // Compass ticks
  const ticks = $('#compass-ticks');
  for (let a = 0; a < 360; a += 22.5) {
    const r1 = a % 90 === 0 ? 44 : 47; const rad = (a * Math.PI) / 180;
    ticks.append(s('line', { x1: 60 + Math.sin(rad) * r1, y1: 60 - Math.cos(rad) * r1, x2: 60 + Math.sin(rad) * 51, y2: 60 - Math.cos(rad) * 51 }));
  }
}

async function toggleDemo(on) {
  if (on) { await data.enableDemo(); toast(t('toast.demoOn')); }
  else { data.disableDemo(); data.loadCache(); toast(t('toast.demoOff')); }
  const url = new URL(window.location.href);
  on ? url.searchParams.set('demo', '1') : url.searchParams.delete('demo');
  try { history.replaceState(null, '', url); } catch { /* ignore */ }
  updateDemoButton(); render(); lastManual = 0; nextFetchAt = Date.now();
  refresh();
}

// ---------------------------------------------------------------- boot
async function boot() {
  $('#app-version').textContent = APP.version;
  document.documentElement.setAttribute('data-theme', settings.theme);
  setLang(settings.lang);
  applyDom();
  wire();
  setTheme(settings.theme);
  buildIntervalOptions(); renderPersonaPickers(); updateVoiceHelp(); assistant.renderChips();
  $$('#set-gender [data-gender]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gender === settings.gender)));
  $('#lang-glyph').textContent = getLang() === 'zh' ? 'EN' : '华';

  const demo = new URLSearchParams(location.search).get('demo') === '1';
  if (demo) await data.enableDemo();
  updateDemoButton();
  data.loadCache();
  render();
  sky.start();
  map.init(); map.setHazeVisible(settings.hazeOn); map.setView(mapView, { animate: false }); map.update(S);
  $('#haze-on').checked = settings.hazeOn;
  setBasemap(settings.basemap);
  requestAnimationFrame(refreshAllSegs);
  if (document.fonts?.ready) document.fonts.ready.then(refreshAllSegs);

  nextFetchAt = Date.now();
  tick();
  setInterval(tick, 1000);

  if (!settings.tutorialDone) setTimeout(() => tour.start(), 650);
}

boot();

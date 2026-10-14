// HazeScope SG — static configuration
// All data endpoints are public and keyless. See README for sources and limits.

export const APP = {
  name: 'HazeScope SG',
  version: '1.0.0',
  storagePrefix: 'hazescope.v1.',
};

// data.gov.sg v2 real-time APIs (NEA air quality + MSS weather)
export const NEA_BASE = 'https://api-open.data.gov.sg/v2/real-time/api';
export const ENDPOINTS = {
  psi: `${NEA_BASE}/psi`,
  pm25: `${NEA_BASE}/pm25`,
  windDirection: `${NEA_BASE}/wind-direction`,
  windSpeed: `${NEA_BASE}/wind-speed`,
  airTemperature: `${NEA_BASE}/air-temperature`,
  humidity: `${NEA_BASE}/relative-humidity`,
  rainfall: `${NEA_BASE}/rainfall`,
  twoHr: `${NEA_BASE}/two-hr-forecast`,
  twentyFourHr: `${NEA_BASE}/twenty-four-hr-forecast`,
};

// Open-Meteo Air Quality API (CAMS global model, ~45 km) — modelled, not measured.
export const OPEN_METEO_AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// data.gov.sg: 6 calls / 10 s without an API key (guide.data.gov.sg, API rate limits).
// We stay one below the published ceiling to leave headroom for clock skew.
export const RATE_LIMIT = { max: 5, windowMs: 10_500 };
export const REQUEST_TIMEOUT_MS = 15_000;

// Fetch-interval choices (minutes). The UI itself ticks every second.
export const INTERVAL_CHOICES = [1, 2, 5, 10, 15, 30, 60];
export const DEFAULT_INTERVAL_MIN = 5;

// Sources refreshed less often than the user interval (minimum age, ms).
export const MIN_SOURCE_AGE = {
  twentyFourHr: 15 * 60_000,
  regional: 10 * 60_000, // CAMS global updates every 12 h; hourly values change on the hour
};

export const NEA_REGIONS = ['north', 'south', 'east', 'west', 'central'];

// Fallback label positions (NEA regionMetadata overrides these when present).
export const REGION_FALLBACK_POS = {
  north: [1.41803, 103.82],
  south: [1.29587, 103.82],
  east: [1.35735, 103.94],
  west: [1.35735, 103.7],
  central: [1.35735, 103.82],
};

export const SINGAPORE = { lat: 1.3521, lon: 103.8198 };

// Regional reference points for the CAMS model query. Chosen for transboundary
// haze relevance (Sumatra, Kalimantan, Peninsular Malaysia).
export const CITIES = [
  { id: 'sg',  lat: 1.3521,  lon: 103.8198, cc: 'SG' },
  { id: 'jb',  lat: 1.4927,  lon: 103.7414, cc: 'MY' },
  { id: 'btm', lat: 1.0456,  lon: 104.0305, cc: 'ID' },
  { id: 'mlk', lat: 2.1896,  lon: 102.2501, cc: 'MY' },
  { id: 'kl',  lat: 3.1390,  lon: 101.6869, cc: 'MY' },
  { id: 'pku', lat: 0.5071,  lon: 101.4478, cc: 'ID' },
  { id: 'jbi', lat: -1.6101, lon: 103.6131, cc: 'ID' },
  { id: 'plm', lat: -2.9761, lon: 104.7754, cc: 'ID' },
  { id: 'mdn', lat: 3.5952,  lon: 98.6722,  cc: 'ID' },
  { id: 'jkt', lat: -6.2088, lon: 106.8456, cc: 'ID' },
  { id: 'ptk', lat: -0.0263, lon: 109.3425, cc: 'ID' },
  { id: 'kch', lat: 1.5535,  lon: 110.3593, cc: 'MY' },
  { id: 'pky', lat: -2.2136, lon: 113.9108, cc: 'ID' },
  { id: 'bsb', lat: 4.9031,  lon: 114.9398, cc: 'BN' },
];

// 24-hr PSI bands (NEA). Colours follow NEA's public convention.
export const PSI_BANDS = [
  { id: 'good',      min: 0,   max: 50,   color: '#22a65a', icon: 'leaf' },
  { id: 'moderate',  min: 51,  max: 100,  color: '#3b8fd9', icon: 'circle' },
  { id: 'unhealthy', min: 101, max: 200,  color: '#e9a823', icon: 'alert' },
  { id: 'vunhealthy',min: 201, max: 300,  color: '#ec7a3a', icon: 'alert2' },
  { id: 'hazardous', min: 301, max: Infinity, color: '#d33b3b', icon: 'skull' },
];

// 1-hr PM2.5 bands (NEA, haze.gov.sg), µg/m³.
export const PM_BANDS = [
  { id: 'normal',   min: 0,   max: 55,   color: '#22a65a', icon: 'leaf' },
  { id: 'elevated', min: 56,  max: 150,  color: '#e9a823', icon: 'alert' },
  { id: 'high',     min: 151, max: 250,  color: '#ec7a3a', icon: 'alert2' },
  { id: 'vhigh',    min: 251, max: Infinity, color: '#d33b3b', icon: 'skull' },
];

// Health advisory by 24-hr PSI band (MOH/NEA via HealthHub). Keys resolve in i18n.
export const ADVISORY = {
  good:       { healthy: 'adv.normal',        vulnerable: 'adv.normal',          chronic: 'adv.normal' },
  moderate:   { healthy: 'adv.normal',        vulnerable: 'adv.normal',          chronic: 'adv.normal' },
  unhealthy:  { healthy: 'adv.reduceStrenuous', vulnerable: 'adv.minimiseStrenuous', chronic: 'adv.avoidStrenuous' },
  vunhealthy: { healthy: 'adv.avoidStrenuous',  vulnerable: 'adv.minimiseOutdoor',   chronic: 'adv.avoidOutdoor' },
  hazardous:  { healthy: 'adv.minimiseOutdoor', vulnerable: 'adv.avoidOutdoor',      chronic: 'adv.avoidOutdoor' },
};

// Region series colours (validated categorical slots 1–5; adjacent-pair CVD safe).
export const SERIES_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  dark:  ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
};

// Map basemaps (CARTO, OSM data). Attribution is mandatory.
export const BASEMAPS = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
};
export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

export const LEAFLET = {
  css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  cssIntegrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
  js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  jsIntegrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
};

// Cross-reference thresholds
export const XREF = {
  upwindHalfAngle: 45,      // degrees either side of the wind-from bearing
  upwindMaxKm: 1600,
  regionalElevatedPm: 55,   // µg/m³ — NEA Band II lower edge
  modelAgreeAbs: 12,        // µg/m³
  modelAgreeRel: 0.35,      // ±35 %
  trendRatio: 0.2,          // 1-hr vs 24-hr PM2.5 ±20 %
  calmKnots: 2,
  staleNeaMin: 90,
};

// Haze field rendering: interpolates gridded PM2.5 onto a canvas in Web Mercator,
// colours it on a ramp keyed to NEA's 1-hr PM2.5 bands, and draws band-edge contours.
import { clamp, lerp, isNum } from './util.js';

// [µg/m³, [r, g, b, alpha]] — edges of NEA bands at 55 / 150 / 250
export const RAMP = [
  [0, [34, 166, 90, 0.0]],
  [20, [34, 166, 90, 0.16]],
  [55, [233, 190, 35, 0.40]],
  [150, [236, 122, 58, 0.55]],
  [250, [211, 59, 59, 0.66]],
  [400, [122, 36, 120, 0.74]],
];
export const CONTOUR_LEVELS = [55, 150, 250];

export function rampColor(v) {
  if (!isNum(v)) return [0, 0, 0, 0];
  if (v <= RAMP[0][0]) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) {
    if (v <= RAMP[i][0]) {
      const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i];
      const t = (v - a) / (b - a);
      return [lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t), lerp(ca[3], cb[3], t)];
    }
  }
  return RAMP[RAMP.length - 1][1];
}
export function legendGradient(maxV = 300) {
  const stops = [];
  for (let v = 0; v <= maxV; v += 10) {
    const [r, g, b] = rampColor(Math.max(v, 25));
    stops.push(`rgb(${r | 0},${g | 0},${b | 0}) ${(v / maxV * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(',')})`;
}

const D2R = Math.PI / 180;
export const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));
export const invMercY = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / D2R;

// Catmull-Rom weights for fractional position t in [0,1)
function crWeights(t) {
  const t2 = t * t, t3 = t2 * t;
  return [-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2];
}

// Grid: { rows, cols, lats[rows] (north→south), lons[cols] (west→east), values Float32Array(rows*cols) }
export function makeSampler(grid) {
  const { rows, cols, lats, lons, values } = grid;
  const lat0 = lats[0], dlat = lats[1] - lats[0], lon0 = lons[0], dlon = lons[1] - lons[0];
  const at = (r, c) => values[clamp(r, 0, rows - 1) * cols + clamp(c, 0, cols - 1)];
  return (lat, lon) => {
    const fy = (lat - lat0) / dlat, fx = (lon - lon0) / dlon;
    if (fy < -0.5 || fy > rows - 0.5 || fx < -0.5 || fx > cols - 0.5) return null;
    const iy = Math.floor(fy), ix = Math.floor(fx);
    const wy = crWeights(fy - iy), wx = crWeights(fx - ix);
    let v = 0;
    for (let j = 0; j < 4; j++) {
      let row = 0;
      for (let i = 0; i < 4; i++) row += wx[i] * at(iy - 1 + j, ix - 1 + i);
      v += wy[j] * row;
    }
    return Math.max(0, v);
  };
}

export function gridBounds(grid) {
  const { lats, lons } = grid;
  const dlat = Math.abs(lats[1] - lats[0]), dlon = Math.abs(lons[1] - lons[0]);
  return { north: Math.max(...lats) + dlat / 2, south: Math.min(...lats) - dlat / 2, west: lons[0] - dlon / 2, east: lons[lons.length - 1] + dlon / 2 };
}

// Render the field into `canvas`, which covers `view` (Web Mercator in y). `full` is the grid's
// own extent: the field is feathered at those edges. `res` is canvas pixels per CSS pixel.
export function renderGridField(canvas, grid, view, full, { contours = true, feather = 0.6, res = 1 } = {}) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const { rows, cols, lats, lons, values } = grid;
  const lat0 = lats[0], dlat = lats[1] - lats[0], lon0 = lons[0], dlon = lons[1] - lons[0];
  const yN = mercY(view.north), yS = mercY(view.south);
  const at = (r, c) => values[clamp(r, 0, rows - 1) * cols + clamp(c, 0, cols - 1)];

  // Pass 1: interpolate each grid row across all pixel columns.
  const colIx = new Int32Array(W), colW = new Float32Array(W * 4), colLon = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const lon = view.west + ((x + 0.5) / W) * (view.east - view.west);
    colLon[x] = lon;
    const fx = (lon - lon0) / dlon, ix = Math.floor(fx);
    colIx[x] = ix; colW.set(crWeights(fx - ix), x * 4);
  }
  const rowsX = new Float32Array((rows + 2) * W);
  for (let r = -1; r <= rows; r++) {
    const base = (r + 1) * W;
    for (let x = 0; x < W; x++) {
      const ix = colIx[x], o = x * 4;
      rowsX[base + x] = colW[o] * at(r, ix - 1) + colW[o + 1] * at(r, ix) + colW[o + 2] * at(r, ix + 1) + colW[o + 3] * at(r, ix + 2);
    }
  }
  const rowAt = (r, x) => rowsX[(clamp(r, -1, rows) + 1) * W + x];
  const featherLat = Math.abs(dlat) * feather, featherLon = Math.abs(dlon) * feather;
  const edge = (dist, f) => { const t = clamp(dist / f, 0, 1); return t * t * (3 - 2 * t); };
  const colEdge = new Float32Array(W);
  for (let x = 0; x < W; x++) colEdge[x] = edge(Math.min(colLon[x] - full.west, full.east - colLon[x]), featherLon);

  // Pass 2: interpolate down each pixel column.
  for (let y = 0; y < H; y++) {
    const lat = invMercY(yN - ((y + 0.5) / H) * (yN - yS));
    const ey = edge(Math.min(lat - full.south, full.north - lat), featherLat);
    if (ey <= 0) continue;
    const fy = (lat - lat0) / dlat, iy = Math.floor(fy);
    const wy = crWeights(fy - iy);
    for (let x = 0; x < W; x++) {
      const ex = colEdge[x]; if (ex <= 0) continue;
      const v = Math.max(0, wy[0] * rowAt(iy - 1, x) + wy[1] * rowAt(iy, x) + wy[2] * rowAt(iy + 1, x) + wy[3] * rowAt(iy + 2, x));
      const c = rampColor(v);
      const p = (y * W + x) * 4;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = c[3] * 255 * ey * ex;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (contours) drawContours(ctx, makeSampler(grid), view, W, H, { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLon: lons[0], maxLon: lons[lons.length - 1] }, res);
}

// Marching squares on a screen-spaced lattice (about every 12 CSS px) across the view.
function drawContours(ctx, sample, view, W, H, ext, res) {
  const yN = mercY(view.north), yS = mercY(view.south);
  const step = 12 * res;
  const nx = Math.max(2, Math.ceil(W / step) + 1), ny = Math.max(2, Math.ceil(H / step) + 1);
  const X = new Float32Array(nx), Y = new Float32Array(ny), LON = new Float32Array(nx), LAT = new Float32Array(ny);
  for (let i = 0; i < nx; i++) { X[i] = (i / (nx - 1)) * W; LON[i] = view.west + (i / (nx - 1)) * (view.east - view.west); }
  for (let j = 0; j < ny; j++) { Y[j] = (j / (ny - 1)) * H; LAT[j] = invMercY(yN - (j / (ny - 1)) * (yN - yS)); }
  const V = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const inside = LAT[j] >= ext.minLat && LAT[j] <= ext.maxLat && LON[i] >= ext.minLon && LON[i] <= ext.maxLon;
    V[j * nx + i] = inside ? (sample(LAT[j], LON[i]) ?? NaN) : NaN;
  }
  for (const level of CONTOUR_LEVELS) {
    const path = new Path2D();
    let any = false;
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = V[j * nx + i], b = V[j * nx + i + 1], c = V[(j + 1) * nx + i + 1], dd = V[(j + 1) * nx + i];
        if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(dd)) continue;
        const idx = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (dd >= level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const t = (p, q) => (level - p) / (q - p || 1e-6);
        const top = [lerp(X[i], X[i + 1], t(a, b)), Y[j]];
        const right = [X[i + 1], lerp(Y[j], Y[j + 1], t(b, c))];
        const bottom = [lerp(X[i], X[i + 1], t(dd, c)), Y[j + 1]];
        const left = [X[i], lerp(Y[j], Y[j + 1], t(a, dd))];
        const seg = (p, q) => { path.moveTo(p[0], p[1]); path.lineTo(q[0], q[1]); any = true; };
        const centerHigh = (a + b + c + dd) / 4 >= level;
        switch (idx) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 5: if (centerHigh) { seg(left, top); seg(bottom, right); } else { seg(left, bottom); seg(top, right); } break;
          case 10: if (centerHigh) { seg(top, right); seg(left, bottom); } else { seg(left, top); seg(bottom, right); } break;
          default: break;
        }
      }
    }
    if (!any) continue;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(10,16,28,0.5)'; ctx.lineWidth = 3 * res; ctx.stroke(path);
    ctx.strokeStyle = level >= 250 ? 'rgba(255,214,214,0.95)' : level >= 150 ? 'rgba(255,226,200,0.95)' : 'rgba(255,246,214,0.95)';
    ctx.lineWidth = 1.3 * res; ctx.setLineDash(level === 55 ? [6 * res, 4 * res] : []); ctx.stroke(path); ctx.setLineDash([]);
  }
}

// Inverse-distance weighting over a few measured points, masked to polygons (e.g. the island).
export function idwSampler(points, power = 2) {
  const pts = points.filter((p) => isNum(p.v));
  return (lat, lon) => {
    if (!pts.length) return null;
    let num = 0, den = 0;
    for (const p of pts) {
      const dx = (lon - p.lon) * Math.cos(lat * D2R), dy = lat - p.lat;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-10) return p.v;
      const w = 1 / Math.pow(d2, power / 2);
      num += w * p.v; den += w;
    }
    return num / den;
  };
}

export function renderPointField(canvas, sampler, bounds, maskRings) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H), d = img.data;
  const yN = mercY(bounds.north), yS = mercY(bounds.south);
  for (let y = 0; y < H; y++) {
    const lat = invMercY(yN - ((y + 0.5) / H) * (yN - yS));
    for (let x = 0; x < W; x++) {
      const lon = bounds.west + ((x + 0.5) / W) * (bounds.east - bounds.west);
      const c = rampColor(sampler(lat, lon));
      const p = (y * W + x) * 4;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = Math.min(255, c[3] * 255 * 1.35);
    }
  }
  ctx.putImageData(img, 0, 0);
  if (maskRings && maskRings.length) {
    const px = (lon) => ((lon - bounds.west) / (bounds.east - bounds.west)) * W;
    const py = (lat) => ((yN - mercY(lat)) / (yN - yS)) * H;
    const path = new Path2D();
    for (const ring of maskRings) ring.forEach(([lon, lat], k) => (k ? path.lineTo(px(lon), py(lat)) : path.moveTo(px(lon), py(lat))));
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000'; ctx.fill(path, 'evenodd');
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.2; ctx.stroke(path);
  }
}

export function pointInRings(lat, lon, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// Blend two frames of grid values.
export function blendFrames(a, b, t) {
  if (!b || t <= 0) return a;
  if (t >= 1) return b;
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = isNum(a[i]) && isNum(b[i]) ? a[i] + (b[i] - a[i]) * t : (a[i] ?? b[i]);
  return out;
}

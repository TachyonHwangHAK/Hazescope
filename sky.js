// Hero sky: an atmosphere whose haze density, tint and particle drift follow the live data.
import { clamp, lerp, prefersReducedMotion, sgtHour, isNum } from './util.js';

const PALETTES = {
  // [top, bottom] for clear and hazy skies; day/night variants
  deep:      { clearDay: ['#12305c', '#3a6ea3'], clearNight: ['#081229', '#1b3157'], hazeDay: ['#4a3a2c', '#9a7448'], hazeNight: ['#1e1712', '#4d3a26'], tower: '#0a1426', light: '#ffd58a' },
  pale:      { clearDay: ['#9fc8f2', '#e9f3fc'], clearNight: ['#b8c6e2', '#e9eef8'], hazeDay: ['#cdbb9c', '#f1e6d2'], hazeNight: ['#bfb19a', '#e9dfcc'], tower: '#8fa6c2', light: '#fff2c4' },
  colourful: { clearDay: ['#ffc59a', '#ffe6f0'], clearNight: ['#d9b8ff', '#ffe1ee'], hazeDay: ['#d8b38b', '#f6e2cc'], hazeNight: ['#c9a888', '#efdcc6'], tower: '#b07ab8', light: '#fff0c0' },
  glass:     { clearDay: ['#0c3550', '#2a6a8a'], clearNight: ['#061a2c', '#163a5a'], hazeDay: ['#43382e', '#8a6c4a'], hazeNight: ['#1c1814', '#463624'], tower: '#071827', light: '#9ef2e6' },
};
const THEME_PALETTE = { dark: 'deep', light: 'pale', colourful: 'colourful', glass: 'glass' };

const rgbOf = (c) => (Array.isArray(c) ? c : (() => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; })());
// Mix two colours (hex strings or [r,g,b]) → [r,g,b]
function mixRgb(a, b, t) { const A = rgbOf(a), B = rgbOf(b); return A.map((v, i) => Math.round(lerp(v, B[i], t))); }

// Seeded PRNG so the skyline is stable between visits.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export class Sky {
  constructor(canvas, host) {
    this.canvas = canvas; this.host = host;
    this.ctx = canvas.getContext('2d');
    this.haze = 0.15; this.hazeTarget = 0.15;
    this.windX = 0.4; this.windXTarget = 0.4; this.windY = -0.1; this.windYTarget = -0.1;
    this.theme = 'dark'; this.particles = []; this.running = false; this.visible = true;
    this.last = 0; this.raf = 0; this.w = 0; this.h = 0; this.dpr = 1;
    this.sprite = null; this.skyline = null; this.bgColor = '#0c1524';
    this._loop = this._loop.bind(this);
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    this.ro ? this.ro.observe(host) : window.addEventListener('resize', () => this.resize());
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; this._sync(); }, { threshold: 0 }).observe(host);
    }
    document.addEventListener('visibilitychange', () => this._sync());
    this.resize();
  }

  setTheme(theme, bgColor) {
    this.theme = theme; if (bgColor) this.bgColor = bgColor;
    this._buildSkyline(); this._drawStaticIfNeeded();
  }
  // pm: µg/m³ (1-hr PM2.5). Maps 10→clear, 160+→very hazy.
  setHaze(pm) {
    if (!isNum(pm)) return;
    this.hazeTarget = clamp((pm - 10) / 150, 0, 1);
    this._adjustParticles(); this._drawStaticIfNeeded();
  }
  // Meteorological "from" direction (deg) and speed (knots)
  setWind(fromDeg, knots) {
    if (!isNum(fromDeg)) return;
    const toRad = ((fromDeg + 180) * Math.PI) / 180;
    const sp = clamp(isNum(knots) ? knots / 8 : 0.6, 0.15, 1.6);
    this.windXTarget = Math.sin(toRad) * sp;
    this.windYTarget = -Math.cos(toRad) * sp * 0.25;
    this._drawStaticIfNeeded();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    this.w = Math.max(1, Math.round(r.width)); this.h = Math.max(1, Math.round(r.height));
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._buildSprite(); this._buildSkyline(); this._adjustParticles(true);
    this._drawStaticIfNeeded(true);
  }

  start() { this.running = true; this._sync(); }
  _sync() {
    const should = this.running && this.visible && !document.hidden && !prefersReducedMotion();
    if (should && !this.raf) { this.last = 0; this.raf = requestAnimationFrame(this._loop); }
    if (!should && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    if (!should) this._drawStaticIfNeeded(true);
  }
  _drawStaticIfNeeded(force) {
    if (this.raf && !force) return;
    if (prefersReducedMotion() || !this.running || force) {
      this.haze = this.hazeTarget; this.windX = this.windXTarget; this.windY = this.windYTarget;
      this._draw(0);
    }
  }

  _buildSprite() {
    const c = document.createElement('canvas'); const S = 64; c.width = c.height = S;
    const g = c.getContext('2d'); const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.45, 'rgba(255,255,255,.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S); this.sprite = c;
  }

  _buildSkyline() {
    if (!this.w) return;
    const pal = PALETTES[THEME_PALETTE[this.theme] || 'deep'];
    const night = this._nightness() > 0.5;
    const make = (seed, baseH, varH, alpha, windows) => {
      const c = document.createElement('canvas');
      c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr);
      const g = c.getContext('2d'); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const r = rng(seed); let x = -10; g.fillStyle = pal.tower; g.globalAlpha = alpha;
      const ground = this.h;
      const towers = [];
      while (x < this.w + 20) {
        const w = 18 + r() * 46; const hh = baseH + r() * varH * (0.4 + 0.6 * Math.sin((x / this.w) * Math.PI));
        const top = ground - hh; towers.push([x, top, w, hh]);
        g.beginPath();
        const style = r();
        if (style < 0.18) { // stepped
          g.moveTo(x, ground); g.lineTo(x, top + 14); g.lineTo(x + w * 0.2, top + 14); g.lineTo(x + w * 0.2, top); g.lineTo(x + w * 0.8, top); g.lineTo(x + w * 0.8, top + 14); g.lineTo(x + w, top + 14); g.lineTo(x + w, ground);
        } else if (style < 0.3) { // spire
          g.moveTo(x, ground); g.lineTo(x, top + 10); g.lineTo(x + w / 2, top - 16); g.lineTo(x + w, top + 10); g.lineTo(x + w, ground);
        } else if (style < 0.42) { // slanted roof
          g.moveTo(x, ground); g.lineTo(x, top + 12); g.lineTo(x + w, top); g.lineTo(x + w, ground);
        } else { g.rect(x, top, w, hh); }
        g.fill();
        x += w + r() * 6 - 1;
      }
      if (windows && night) {
        g.globalAlpha = 0.55; g.fillStyle = pal.light;
        for (const [tx, ty, tw, th] of towers) {
          for (let wy = ty + 8; wy < this.h - 6; wy += 9) for (let wx = tx + 4; wx < tx + tw - 4; wx += 7) if (r() < 0.16) g.fillRect(wx, wy, 2.2, 3);
        }
      }
      return c;
    };
    const s = Math.max(0.55, Math.min(1, this.h / 600));
    this.skyline = { far: make(7, 60 * s, 150 * s, 0.45, false), near: make(31, 28 * s, 92 * s, 0.92, true) };
  }

  _nightness() { const hr = sgtHour(); return hr < 6.3 || hr > 19.4 ? 1 : (hr < 7.3 ? 7.3 - hr : (hr > 18.4 ? hr - 18.4 : 0)); }

  _adjustParticles(reset) {
    const area = this.w * this.h;
    const target = Math.min(this.w < 700 ? 90 : 170, Math.round((area / 9000) * (0.18 + this.hazeTarget * 1.05)));
    if (reset) this.particles = [];
    while (this.particles.length < target) this.particles.push(this._spawn(true));
    if (this.particles.length > target) this.particles.length = target;
  }
  _spawn(anywhere) {
    const depth = Math.random();
    return {
      x: anywhere ? Math.random() * this.w : (this.windX >= 0 ? -40 : this.w + 40),
      y: Math.random() * this.h * 0.95,
      r: 10 + depth * 46, depth, a: 0.05 + Math.random() * 0.12, ph: Math.random() * Math.PI * 2,
      sp: 8 + depth * 22,
    };
  }

  _loop(now) {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    const k = 1 - Math.exp(-dt / 0.9);
    this.haze += (this.hazeTarget - this.haze) * k;
    this.windX += (this.windXTarget - this.windX) * k;
    this.windY += (this.windYTarget - this.windY) * k;
    this._draw(dt);
    this.raf = requestAnimationFrame(this._loop);
  }

  _draw(dt) {
    const { ctx, w, h } = this; if (!w || !h) return;
    const pal = PALETTES[THEME_PALETTE[this.theme] || 'deep'];
    const n = clamp(this._nightness(), 0, 1); const hz = Math.pow(this.haze, 0.85);
    const top = mixRgb(mixRgb(pal.clearDay[0], pal.clearNight[0], n), mixRgb(pal.hazeDay[0], pal.hazeNight[0], n), hz);
    const bot = mixRgb(mixRgb(pal.clearDay[1], pal.clearNight[1], n), mixRgb(pal.hazeDay[1], pal.hazeNight[1], n), hz);

    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgb(${top})`); g.addColorStop(1, `rgb(${bot})`);
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // Sun or moon, dimmed and reddened by haze
    const cx = w * 0.82, cy = h * 0.24, R = Math.min(w, h) * 0.07;
    const disc = n > 0.5 ? [236, 240, 255] : mixRgb('#fff6d8', '#ff9a4a', hz);
    const glow = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 4);
    glow.addColorStop(0, `rgba(${disc},${0.42 * (1 - hz * 0.55)})`); glow.addColorStop(1, `rgba(${disc},0)`);
    ctx.fillStyle = glow; ctx.fillRect(cx - R * 4, cy - R * 4, R * 8, R * 8);
    ctx.globalAlpha = 0.95 - hz * 0.55; ctx.fillStyle = `rgb(${disc})`;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Skyline with atmospheric perspective
    if (this.skyline) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1 - hz * 0.75; ctx.drawImage(this.skyline.far, 0, 0);
      ctx.globalAlpha = 1 - hz * 0.45; ctx.drawImage(this.skyline.near, 0, 0);
      ctx.restore();
    }
    // Haze veil — denser near the ground
    const veil = ctx.createLinearGradient(0, h * 0.25, 0, h);
    veil.addColorStop(0, `rgba(${bot},0)`); veil.addColorStop(1, `rgba(${bot},${0.15 + hz * 0.6})`);
    ctx.fillStyle = veil; ctx.fillRect(0, 0, w, h);

    // Particles drift with the measured wind
    const tint = mixRgb('#ffffff', '#e2b77d', hz);
    const tintCanvas = this.sprite;
    for (const p of this.particles) {
      if (dt) {
        p.ph += dt * (0.4 + p.depth);
        p.x += (this.windX * p.sp + Math.sin(p.ph) * 2) * dt * 1.6;
        p.y += (this.windY * p.sp + Math.cos(p.ph * 0.7) * 1.5) * dt;
        if (p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60) Object.assign(p, this._spawn(false), { y: Math.random() * h * 0.95 });
      }
      ctx.globalAlpha = p.a * (0.55 + hz * 1.1);
      ctx.drawImage(tintCanvas, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    // Warm tint pass for hazy particles
    if (hz > 0.05) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = hz * 0.18; ctx.fillStyle = `rgb(${tint})`; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Blend into the page
    ctx.globalAlpha = 1;
    // Fade the bottom edge to transparent so the hero dissolves into whatever the page shows behind it.
    const fade = ctx.createLinearGradient(0, h * 0.78, 0, h);
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = fade; ctx.fillRect(0, h * 0.78, w, h * 0.22 + 1);
    ctx.globalCompositeOperation = 'source-over';
  }
}

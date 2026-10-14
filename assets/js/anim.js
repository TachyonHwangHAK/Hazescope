// Frame-rate–independent lerp engine. One rAF loop, sleeps when idle.
import { prefersReducedMotion, isNum } from './util.js';

const springs = new Set();
let rafId = 0;
let last = 0;

function loop(now) {
  const dt = Math.min(0.1, (now - (last || now)) / 1000);
  last = now;
  for (const sp of springs) {
    if (sp.step(dt)) springs.delete(sp);
  }
  rafId = springs.size ? requestAnimationFrame(loop) : 0;
  if (!rafId) last = 0;
}
function wake() { if (!rafId) rafId = requestAnimationFrame(loop); }

// Exponential smoothing toward target: value += (target - value) * (1 - e^(-dt/tau)).
export class Lerp {
  constructor(value = 0, { tau = 0.16, epsilon = 0.01, onUpdate, angular = false } = {}) {
    this.value = value; this.target = value; this.tau = tau; this.epsilon = epsilon;
    this.onUpdate = onUpdate; this.angular = angular;
  }
  set(target, { instant = false } = {}) {
    if (!isNum(target)) return;
    if (this.angular) {
      // Travel the shortest way round the dial.
      const d = ((target - this.value) % 360 + 540) % 360 - 180;
      target = this.value + d;
    }
    this.target = target;
    if (instant || prefersReducedMotion() || document.hidden) {
      this.value = target; this.onUpdate && this.onUpdate(this.value, true);
      springs.delete(this);
      return;
    }
    springs.add(this); wake();
  }
  step(dt) {
    const k = 1 - Math.exp(-dt / this.tau);
    this.value += (this.target - this.value) * k;
    const done = Math.abs(this.target - this.value) < this.epsilon;
    if (done) this.value = this.target;
    this.onUpdate && this.onUpdate(this.value, done);
    return done;
  }
}

// Animated number bound to a text node.
const numberBindings = new WeakMap();
export function animateNumber(el, target, { decimals = 0, tau = 0.22, fallback = '—' } = {}) {
  if (!el) return;
  if (!isNum(target)) { el.textContent = fallback; numberBindings.delete(el); return; }
  let b = numberBindings.get(el);
  if (!b) {
    const start = isNum(parseFloat(el.textContent)) ? parseFloat(el.textContent) : target;
    b = new Lerp(start, { tau, epsilon: decimals ? 0.005 : 0.4, onUpdate: (v, done) => {
      el.textContent = (done ? b.target : v).toFixed(decimals);
    } });
    numberBindings.set(el, b);
  }
  b.set(target);
  if (b.value === b.target) el.textContent = target.toFixed(decimals);
}

// Generic per-frame callback for a fixed duration (used for chart morphs).
export function tween(duration, onFrame) {
  if (prefersReducedMotion() || document.hidden || duration <= 0) { onFrame(1); return () => {}; }
  let start = 0, id = 0, cancelled = false;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const f = (now) => {
    if (cancelled) return;
    if (!start) start = now;
    const t = Math.min(1, (now - start) / duration);
    onFrame(ease(t));
    if (t < 1) id = requestAnimationFrame(f);
  };
  id = requestAnimationFrame(f);
  return () => { cancelled = true; cancelAnimationFrame(id); };
}

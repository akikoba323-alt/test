// Scalar helpers, easing curves and damped springs used by animation, camera and effects.

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp01((x - a) / (b - a));
export const remap = (x, a, b, c, d) => c + (d - c) * clamp01((x - a) / (b - a));
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

// Frame-rate independent exponential approach: move a toward b with half-life-ish rate k (1/s).
export const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);

// Pulse that rises instantly at t=0 and decays with the given half-life (seconds).
export const decay = (t, halfLife) => (t < 0 ? 0 : Math.pow(0.5, t / halfLife));

// Attack/decay envelope: linear rise over `a` seconds, exponential decay with half-life `h`.
export const envAD = (t, a, h) => (t < 0 ? 0 : t < a ? t / a : Math.pow(0.5, (t - a) / h));

// Window that is 1 inside [t0,t1] with smooth ramps of width r at both ends.
export const window01 = (t, t0, t1, rIn, rOut = rIn) => Math.min(smoothstep(t0 - rIn, t0, t), 1 - smoothstep(t1, t1 + rOut, t));

export const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => { const u = t - 1; return u * u * u + 1; },
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => { const u = 1 - t; return 1 - u * u * u * u; },
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * Math.pow(t - 1, 4)),
  inQuint: (t) => t * t * t * t * t,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  outBackStrong: (t) => { const c1 = 3.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  // Fast strike: almost no motion at first (anticipation already happened), then explosive.
  strike: (t) => 1 - Math.pow(1 - Math.pow(t, 1.6), 3),
  // Heavy strike: slow start, huge acceleration at the end (a haymaker).
  heavy: (t) => Math.pow(t, 3.2),
  // Snap: reaches target very fast and settles.
  snap: (t) => 1 - Math.pow(1 - t, 6),
  step: (t) => (t < 1 ? 0 : 1),
  hold: () => 0,
};

export function easeFn(e) {
  if (typeof e === 'function') return e;
  return Ease[e || 'inOutQuad'] || Ease.inOutQuad;
}

// Critically damped / under-damped spring for scalars (semi-implicit). k: stiffness, c: damping ratio.
export class Spring {
  constructor(value = 0, freq = 6, zeta = 0.5) { this.x = value; this.v = 0; this.target = value; this.freq = freq; this.zeta = zeta; }
  step(dt) {
    const w = TAU * this.freq;
    const a = w * w * (this.target - this.x) - 2 * this.zeta * w * this.v;
    this.v += a * dt; this.x += this.v * dt;
    return this.x;
  }
  impulse(v) { this.v += v; }
  reset(v = 0) { this.x = this.target = v; this.v = 0; }
}

// Vector spring on plain arrays [x,y,z].
export class Spring3 {
  constructor(freq = 6, zeta = 0.5) { this.x = [0, 0, 0]; this.v = [0, 0, 0]; this.t = [0, 0, 0]; this.freq = freq; this.zeta = zeta; }
  step(dt) {
    const w = TAU * this.freq, k = w * w, c = 2 * this.zeta * w;
    for (let i = 0; i < 3; i++) {
      this.v[i] += (k * (this.t[i] - this.x[i]) - c * this.v[i]) * dt;
      this.x[i] += this.v[i] * dt;
    }
  }
  impulse(x, y, z) { this.v[0] += x; this.v[1] += y; this.v[2] += z; }
  reset() { this.x.fill(0); this.v.fill(0); this.t.fill(0); }
}

// Catmull-Rom on arrays of [x,y,z] points, u in [0,1] across the whole path.
export function catmull(points, u, out) {
  const n = points.length - 1;
  const f = clamp01(u) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
  const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  for (let k = 0; k < 3; k++) {
    out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  }
  return out;
}

export function bezier3(p0, p1, p2, p3, t, out) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  for (let k = 0; k < 3; k++) out[k] = a * p0[k] + b * p1[k] + c * p2[k] + d * p3[k];
  return out;
}

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}

// Easing + time helpers. Every animation in the film is a pure function of time.
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const map = (x, a, b, c, d) => c + (d - c) * clamp((x - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const fract = (x) => x - Math.floor(x);
export const mix = lerp;

const PI = Math.PI;
export const E = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inQuint: (t) => t * t * t * t * t,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  inSine: (t) => 1 - Math.cos((t * PI) / 2),
  outSine: (t) => Math.sin((t * PI) / 2),
  inOutSine: (t) => -(Math.cos(PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  inOutBack: (t, s = 1.70158 * 1.525) => (t < 0.5 ? (Math.pow(2 * t, 2) * ((s + 1) * 2 * t - s)) / 2 : (Math.pow(2 * t - 2, 2) * ((s + 1) * (t * 2 - 2) + s) + 2) / 2),
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * PI) / 3)) + 1),
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// damped spring step response (0 -> 1), f = frequency (Hz), z = damping ratio
export function spring(t, f = 2.2, z = 0.45) {
  if (t <= 0) return 0;
  const w = 2 * PI * f;
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

// progress of an animation starting at t0 with duration d
export const P = (t, t0, d, ease = E.linear) => ease(clamp((t - t0) / d));
// in/out envelope: rises over [a, a+ri], holds, falls over [b-ro, b]
export function env(t, a, b, ri = 0.3, ro = 0.3, ein = E.outCubic, eout = E.inCubic) {
  if (t < a || t > b) return 0;
  const i = ri > 0 ? ein(clamp((t - a) / ri)) : 1;
  const o = ro > 0 ? 1 - eout(clamp((t - (b - ro)) / ro)) : 1;
  return Math.min(i, o);
}
// keyframes: [[t, v], ...] with optional ease per segment [[t, v, ease]]
export function keys(t, ks, def = E.inOutCubic) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1];
      const [t1, v1, e] = ks[i];
      const u = (e || def)((t - t0) / (t1 - t0));
      if (Array.isArray(v0)) return v0.map((a, k) => a + (v1[k] - a) * u);
      return v0 + (v1 - v0) * u;
    }
  }
  return ks[ks.length - 1][1];
}
// stagger helper: progress for item i of n spread across [t0, t0+span], each lasting d
export const stag = (t, i, t0, gap, d, ease = E.outCubic) => ease(clamp((t - t0 - i * gap) / d));
// periodic step: number of whole beats elapsed
export const beats = (t, t0, period) => Math.max(0, Math.floor((t - t0) / period));

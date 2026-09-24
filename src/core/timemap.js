// Maps playback time (what the viewer experiences, P) to world time (what physics and
// choreography run on, W). Slow motion stretches world intervals; hit-stops freeze the world
// for a few real frames. Ramps are built from many small constant-rate segments.
import { clamp, smoothstep } from './math.js';

export class TimeMap {
  constructor() { this.slows = []; this.stops = []; this.knotsW = [0]; this.knotsP = [0]; }

  // World interval [w0,w1] plays at `rate` (0.1 = ten times slower). Rates ramp in/out over rampIn/rampOut world seconds.
  slow(w0, w1, rate, rampIn = 0.0, rampOut = 0.0) { this.slows.push({ w0, w1, rate, rampIn, rampOut }); return this; }
  // Freeze world time at w for `hold` real seconds.
  hitstop(w, hold) { this.stops.push({ w, hold }); return this; }

  rateAtW(w) {
    let r = 1;
    for (const s of this.slows) {
      if (w < s.w0 - s.rampIn || w > s.w1 + s.rampOut) continue;
      let k = 1;
      if (w < s.w0) k = smoothstep(s.w0 - s.rampIn, s.w0, w);
      else if (w > s.w1) k = 1 - smoothstep(s.w1, s.w1 + s.rampOut, w);
      const rr = 1 + (s.rate - 1) * k;
      if (rr < r) r = rr;
    }
    return r;
  }

  build(endW) {
    // breakpoints along W where the rate changes
    const bp = new Set([0, endW]);
    for (const s of this.slows) {
      const segs = [[s.w0 - s.rampIn, s.w0, 12], [s.w0, s.w1, 1], [s.w1, s.w1 + s.rampOut, 12]];
      for (const [a, b, n] of segs) for (let i = 0; i <= n; i++) bp.add(a + (b - a) * (i / n));
    }
    for (const h of this.stops) bp.add(h.w);
    const ws = [...bp].filter((w) => w >= 0 && w <= endW).sort((a, b) => a - b);
    const stops = [...this.stops].sort((a, b) => a.w - b.w);
    const KW = [0], KP = [0];
    let p = 0, si = 0;
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (i > 0) {
        const w0 = ws[i - 1], mid = (w0 + w) * 0.5;
        p += (w - w0) / Math.max(1e-4, this.rateAtW(mid));
        KW.push(w); KP.push(p);
      }
      while (si < stops.length && Math.abs(stops[si].w - w) < 1e-9) {
        p += stops[si].hold; KW.push(w); KP.push(p); si++;
      }
    }
    this.knotsW = KW; this.knotsP = KP; this.endW = endW; this.endP = p;
    return this;
  }

  // world time for playback time
  W(P) {
    const KP = this.knotsP, KW = this.knotsW;
    if (P <= 0) return P;
    if (P >= KP[KP.length - 1]) return KW[KW.length - 1] + (P - KP[KP.length - 1]);
    let lo = 0, hi = KP.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (KP[m] <= P) lo = m; else hi = m; }
    const dp = KP[hi] - KP[lo];
    return dp <= 0 ? KW[lo] : KW[lo] + (KW[hi] - KW[lo]) * ((P - KP[lo]) / dp);
  }

  // playback time at which world time first reaches w
  P(w) {
    const KP = this.knotsP, KW = this.knotsW;
    if (w <= 0) return w;
    if (w >= KW[KW.length - 1]) return KP[KP.length - 1] + (w - KW[KW.length - 1]);
    let lo = 0, hi = KW.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (KW[m] < w) lo = m; else hi = m; }
    const dw = KW[hi] - KW[lo];
    return dw <= 0 ? KP[lo] : KP[lo] + (KP[hi] - KP[lo]) * ((w - KW[lo]) / dw);
  }

  // instantaneous world/playback rate at playback time P (0 during hit-stops)
  rate(P) {
    const e = 1e-4;
    return clamp((this.W(P + e) - this.W(P - e)) / (2 * e), 0, 4);
  }
}

// Scene-authoring helpers.
import { clamp, E } from '../engine/ease.js';

export const chapter = (n, jp, en, t0) => ({ n, jp, en, t0 });
export const cueFn = (eng) => (id, sub, off = 0) => eng.cues.at(id, sub) + off;
export const cueEnd = (eng) => (id, sub, off = 0) => eng.cues.end(id, sub) + off;

// sequential beats: returns index of the last beat whose time <= t
export function beatIndex(t, times) { let k = -1; for (let i = 0; i < times.length; i++) if (t >= times[i]) k = i; return k; }
// optional hook: tools/sfx_scan.mjs installs globalThis.__onset to collect animation onsets for the sound-effects track
const EASE_NAME = new Map(Object.entries(E).map(([k, v]) => [v, k]));
const onset = (a, d, kind) => { const h = globalThis.__onset; if (h) h(a, d, kind); };
// progress since time a over duration d with easing
export const since = (t, a, d = 0.5, e = E.outCubic) => (onset(a, d, EASE_NAME.get(e) || 'custom'), t <= a ? 0 : t >= a + d ? 1 : e((t - a) / d));
// 0..1 pulse that rises at a and decays
export const pulse = (t, a, rise = 0.05, decay = 0.4) => (onset(a, decay, 'pulse'), t < a ? 0 : t < a + rise ? (t - a) / rise : Math.exp(-(t - a - rise) / decay));
// frame-quantized jitter for glitchy flicker
export const flick = (t, rate = 24, seed = 1) => { const k = Math.floor(t * rate); const x = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };

// Lighting / color-script keyframes. Each key is a partial look; missing fields inherit from
// the previous key (starting from defaultLook). Values interpolate with the key's ease.
import { defaultLook } from '../engine.js';
import { easeFn, clamp01 } from '../core/math.js';

function lerpVal(a, b, t) {
  if (typeof a === 'number') return a + (b - a) * t;
  if (Array.isArray(a)) return a.map((v, i) => v + (b[i] - v) * t);
  if (a && typeof a === 'object') { const o = {}; for (const k in a) o[k] = k in b ? lerpVal(a[k], b[k], t) : a[k]; return o; }
  return t < 0.5 ? a : b;
}
function merge(base, over) {
  const o = { ...base };
  for (const k in over) o[k] = over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) ? { ...(base[k] || {}), ...over[k] } : over[k];
  return o;
}

export class LookTrack {
  constructor(keys) {
    // resolve full looks
    let cur = defaultLook();
    this.keys = keys.map((k) => { cur = merge(cur, k.look); return { w: k.w, look: cur, ease: easeFn(k.ease) }; });
    if (!this.keys.length) this.keys.push({ w: 0, look: cur, ease: easeFn('linear') });
  }
  sample(W) {
    const K = this.keys;
    if (W <= K[0].w) return K[0].look;
    for (let i = 0; i < K.length - 1; i++) {
      if (W < K[i + 1].w) {
        const t = K[i + 1].ease(clamp01((W - K[i].w) / (K[i + 1].w - K[i].w)));
        return lerpVal(K[i].look, K[i + 1].look, t);
      }
    }
    return K[K.length - 1].look;
  }
}

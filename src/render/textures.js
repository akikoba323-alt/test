// Procedural textures generated at load time (tileable noise volumes and detail maps).
import * as THREE from 'three';
import { RNG } from '../core/rng.js';

// Periodic gradient noise on an integer lattice with period `per`.
function makePeriodicNoise3(seed) {
  const rng = new RNG(seed);
  const G = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) { const v = rng.dir({}); G[i * 3] = v.x; G[i * 3 + 1] = v.y; G[i * 3 + 2] = v.z; }
  const P = new Uint8Array(256);
  for (let i = 0; i < 256; i++) P[i] = i;
  for (let i = 255; i > 0; i--) { const j = rng.int(0, i); const t = P[i]; P[i] = P[j]; P[j] = t; }
  const h = (x, y, z) => P[(P[(P[x & 255] + y) & 255] + z) & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return function noise(x, y, z, per) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = fade(xf), v = fade(yf), w = fade(zf);
    let r = 0;
    const X0 = ((xi % per) + per) % per, Y0 = ((yi % per) + per) % per, Z0 = ((zi % per) + per) % per;
    const X1 = (X0 + 1) % per, Y1 = (Y0 + 1) % per, Z1 = (Z0 + 1) % per;
    const g = (ix, iy, iz, dx, dy, dz) => { const k = h(ix, iy, iz) * 3; return G[k] * dx + G[k + 1] * dy + G[k + 2] * dz; };
    const x00 = g(X0, Y0, Z0, xf, yf, zf) + u * (g(X1, Y0, Z0, xf - 1, yf, zf) - g(X0, Y0, Z0, xf, yf, zf));
    const x10 = g(X0, Y1, Z0, xf, yf - 1, zf) + u * (g(X1, Y1, Z0, xf - 1, yf - 1, zf) - g(X0, Y1, Z0, xf, yf - 1, zf));
    const x01 = g(X0, Y0, Z1, xf, yf, zf - 1) + u * (g(X1, Y0, Z1, xf - 1, yf, zf - 1) - g(X0, Y0, Z1, xf, yf, zf - 1));
    const x11 = g(X0, Y1, Z1, xf, yf - 1, zf - 1) + u * (g(X1, Y1, Z1, xf - 1, yf - 1, zf - 1) - g(X0, Y1, Z1, xf, yf - 1, zf - 1));
    const y0 = x00 + v * (x10 - x00), y1 = x01 + v * (x11 - x01);
    r = y0 + w * (y1 - y0);
    return r;
  };
}

function worley3(x, y, z, per, rng, out) {
  // cell points are hashed from integer cell coords (periodic); returns F1, writes F2-F1 to out[0]
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let best = 9, second = 9;
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = xi + dx, cy = yi + dy, cz = zi + dz;
    const wx = ((cx % per) + per) % per, wy = ((cy % per) + per) % per, wz = ((cz % per) + per) % per;
    const hh = rng(wx, wy, wz);
    const px = cx + hh[0], py = cy + hh[1], pz = cz + hh[2];
    const d = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
    if (d < best) { second = best; best = d; } else if (d < second) second = d;
  }
  if (out) out[0] = Math.sqrt(second) - Math.sqrt(best);
  return Math.sqrt(best);
}

export function makeNoise3D(size = 64) {
  const noise = makePeriodicNoise3(99);
  const data = new Uint8Array(size * size * size * 4);
  const cellHash = (x, y, z) => {
    let s = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
    const r = new RNG(s);
    return [r.next(), r.next(), r.next()];
  };
  const cache = new Map();
  const ch = (x, y, z) => { const k = (x * 64 + y) * 64 + z; let v = cache.get(k); if (!v) { v = cellHash(x, y, z); cache.set(k, v); } return v; };
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = ((z * size + y) * size + x) * 4;
    // fbm with base period 4 cells across the texture
    let f = 0, amp = 0.5, per = 4;
    for (let o = 0; o < 5; o++) {
      const s = per / size;
      f += amp * noise(x * s, y * s, z * s, per);
      amp *= 0.5; per *= 2;
    }
    const edge = [0];
    const wA = worley3(x / size * 6, y / size * 6, z / size * 6, 6, ch);
    const wB = worley3(x / size * 12, y / size * 12, z / size * 12, 12, ch, edge);
    const billow = 1 - Math.min(1, wA * 0.9) * 0.65 - Math.min(1, wB) * 0.35;
    data[i] = Math.max(0, Math.min(255, (f * 0.9 + 0.5) * 255));
    data[i + 1] = Math.max(0, Math.min(255, billow * 255));
    data[i + 2] = Math.max(0, Math.min(255, (1 - Math.min(1, wB)) * 255));
    data[i + 3] = Math.max(0, Math.min(255, edge[0] * 255 * 1.4));
  }
  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

// 2D tileable detail noise: R fbm, G ridged, B cellular, A white
export function makeNoise2D(size = 256) {
  const noise = makePeriodicNoise3(7);
  const data = new Uint8Array(size * size * 4);
  const rng = new RNG(5);
  const pts = [];
  const cells = 16;
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + rng.next()) / cells, (j + rng.next()) / cells]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    let f = 0, amp = 0.5, per = 8, rid = 0;
    for (let o = 0; o < 6; o++) {
      const s = per / size;
      const n = noise(x * s, y * s, 0.5 * o, per);
      f += amp * n;
      rid += amp * (1 - Math.abs(n) * 2);
      amp *= 0.5; per *= 2;
    }
    const u = x / size, v = y / size;
    const ci = Math.floor(u * cells), cj = Math.floor(v * cells);
    let best = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = (ci + di + cells) % cells, jj = (cj + dj + cells) % cells;
      const p = pts[jj * cells + ii];
      const px = p[0] + (ci + di < 0 ? -1 : ci + di >= cells ? 1 : 0), py = p[1] + (cj + dj < 0 ? -1 : cj + dj >= cells ? 1 : 0);
      const d = Math.hypot(px - u, py - v) * cells;
      if (d < best) best = d;
    }
    data[i] = Math.max(0, Math.min(255, (f * 1.1 + 0.5) * 255));
    data[i + 1] = Math.max(0, Math.min(255, rid * 255));
    data[i + 2] = Math.max(0, Math.min(255, best * 255));
    data[i + 3] = rng.int(0, 255);
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

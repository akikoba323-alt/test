// Dense-grid surface nets. Primitives are splatted into the grid inside their bounding boxes
// (exact for sequential smooth unions because smin(a,b,k) == a whenever b > a + k).
// Vertices are placed at the mean of the edge crossings, then Newton-projected onto the true
// SDF surface; normals come from the SDF gradient.
import { smin, smax } from './sdf.js';

export function meshSDF(prims, opts) {
  const h = opts.cell;
  const bb = opts.bounds; // [minx,miny,minz,maxx,maxy,maxz]
  const region = opts.region || null; // signed region function (negative inside), intersected hard
  const ox = bb[0] - 2 * h, oy = bb[1] - 2 * h, oz = bb[2] - 2 * h;
  const nx = Math.ceil((bb[3] - bb[0]) / h) + 5, ny = Math.ceil((bb[4] - bb[1]) / h) + 5, nz = Math.ceil((bb[5] - bb[2]) / h) + 5;
  const N = nx * ny * nz;
  const F = new Float32Array(N).fill(1e3);
  const sxy = nx * ny;
  for (const p of prims) {
    const pad = p.k + 3 * h;
    const b = p.infinite ? bb : p.bbox;
    const i0 = Math.max(0, Math.floor((b[0] - pad - ox) / h)), i1 = Math.min(nx - 1, Math.ceil((b[3] + pad - ox) / h));
    const j0 = Math.max(0, Math.floor((b[1] - pad - oy) / h)), j1 = Math.min(ny - 1, Math.ceil((b[4] + pad - oy) / h));
    const k0 = Math.max(0, Math.floor((b[2] - pad - oz) / h)), k1 = Math.min(nz - 1, Math.ceil((b[5] + pad - oz) / h));
    const op = p.op, kk = p.k, d = p.d;
    if (op === 'int') {
      // intersection affects everything: outside bbox the prim is "far outside"
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
        const row = k * sxy + j * nx;
        for (let i = 0; i < nx; i++) {
          const inside = i >= i0 && i <= i1 && j >= j0 && j <= j1 && k >= k0 && k <= k1;
          const v = inside ? d(ox + i * h, oy + j * h, oz + k * h) : 1e3;
          F[row + i] = smax(F[row + i], v, kk);
        }
      }
      continue;
    }
    for (let k = k0; k <= k1; k++) {
      const z = oz + k * h;
      for (let j = j0; j <= j1; j++) {
        const y = oy + j * h;
        const row = k * sxy + j * nx;
        for (let i = i0; i <= i1; i++) {
          const v = d(ox + i * h, y, z);
          const idx = row + i;
          F[idx] = op === 'add' ? smin(F[idx], v, kk) : smax(F[idx], -v, kk);
        }
      }
    }
  }
  if (region) {
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const idx = k * sxy + j * nx + i;
      if (F[idx] > 0.05) continue;
      F[idx] = Math.max(F[idx], region(ox + i * h, oy + j * h, oz + k * h));
    }
  }
  const index = buildPrimIndex(prims, 0.08);

  // ---- surface nets
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cxy = (nx - 1) * (ny - 1);
  const pos = [];
  const corner = new Float32Array(8);
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cOff = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = F[(k + cOff[c][2]) * sxy + (j + cOff[c][1]) * nx + (i + cOff[c][0])];
      corner[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) {
      const va = corner[a], vb = corner[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += cOff[a][0] + (cOff[b][0] - cOff[a][0]) * t;
      sy += cOff[a][1] + (cOff[b][1] - cOff[a][1]) * t;
      sz += cOff[a][2] + (cOff[b][2] - cOff[a][2]) * t;
      cnt++;
    }
    cellVert[k * cxy + j * (nx - 1) + i] = pos.length / 3;
    pos.push(ox + (i + sx / cnt) * h, oy + (j + sy / cnt) * h, oz + (k + sz / cnt) * h);
  }
  const idx = [];
  const cv = (i, j, k) => cellVert[k * cxy + j * (nx - 1) + i];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = F[k * sxy + j * nx + i];
    const inside = v0 < 0;
    // x-edge (i,j,k)-(i+1,j,k): cells around share j-1..j, k-1..k
    if (i < nx - 1) {
      const v1 = F[k * sxy + j * nx + i + 1];
      if ((v1 < 0) !== inside) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), !inside);
    }
    if (j < ny - 1) {
      const v1 = F[k * sxy + (j + 1) * nx + i];
      if ((v1 < 0) !== inside) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), !inside);
    }
    if (k < nz - 1) {
      const v1 = F[(k + 1) * sxy + j * nx + i];
      if ((v1 < 0) !== inside) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), !inside);
    }
  }
  const P = new Float32Array(pos);
  const Nrm = new Float32Array(P.length);
  // Newton projection onto the exact SDF + gradient normals
  const e = h * 0.25;
  const f = region ? (x, y, z) => Math.max(evalIndexed(index, x, y, z), region(x, y, z)) : (x, y, z) => evalIndexed(index, x, y, z);
  for (let v = 0; v < P.length; v += 3) {
    let x = P[v], y = P[v + 1], z = P[v + 2];
    let gx = 0, gy = 0, gz = 0;
    for (let it = 0; it < (opts.project ?? 1); it++) {
      const d = f(x, y, z);
      gx = f(x + e, y, z) - f(x - e, y, z); gy = f(x, y + e, z) - f(x, y - e, z); gz = f(x, y, z + e) - f(x, y, z - e);
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) / (2 * e);
      if (gl < 1e-6) break;
      const s = d / (gl * gl) / (2 * e);
      const nx_ = x - gx * s, ny_ = y - gy * s, nz_ = z - gz * s;
      // keep the vertex close to its cell
      if (Math.abs(nx_ - P[v]) > h || Math.abs(ny_ - P[v + 1]) > h || Math.abs(nz_ - P[v + 2]) > h) break;
      x = nx_; y = ny_; z = nz_;
    }
    gx = f(x + e, y, z) - f(x - e, y, z); gy = f(x, y + e, z) - f(x, y - e, z); gz = f(x, y, z + e) - f(x, y, z - e);
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    P[v] = x; P[v + 1] = y; P[v + 2] = z;
    Nrm[v] = gx / gl; Nrm[v + 1] = gy / gl; Nrm[v + 2] = gz / gl;
  }
  return { positions: P, normals: Nrm, indices: new Uint32Array(idx), stats: { nx, ny, nz, verts: P.length / 3, tris: idx.length / 3 } };
}

// Uniform-grid bucket index over primitives so point queries only visit nearby primitives.
// Each bucket keeps the original primitive order (ops are sequential).
export function buildPrimIndex(prims, cell) {
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of prims) if (!p.infinite) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], p.bbox[a] - p.k - 0.02); mx[a] = Math.max(mx[a], p.bbox[a + 3] + p.k + 0.02); }
  const n = [0, 1, 2].map((a) => Math.max(1, Math.ceil((mx[a] - mn[a]) / cell)));
  const buckets = new Array(n[0] * n[1] * n[2]);
  for (let i = 0; i < buckets.length; i++) buckets[i] = [];
  prims.forEach((p) => {
    const lo = [0, 1, 2].map((a) => p.infinite ? 0 : Math.max(0, Math.floor((p.bbox[a] - p.k - 0.02 - mn[a]) / cell)));
    const hi = [0, 1, 2].map((a) => p.infinite ? n[a] - 1 : Math.min(n[a] - 1, Math.floor((p.bbox[a + 3] + p.k + 0.02 - mn[a]) / cell)));
    for (let k = lo[2]; k <= hi[2]; k++) for (let j = lo[1]; j <= hi[1]; j++) for (let i = lo[0]; i <= hi[0]; i++) buckets[(k * n[1] + j) * n[0] + i].push(p);
  });
  return { mn, n, cell, buckets, empty: [] };
}
export function queryPrims(index, x, y, z) {
  const i = Math.floor((x - index.mn[0]) / index.cell), j = Math.floor((y - index.mn[1]) / index.cell), k = Math.floor((z - index.mn[2]) / index.cell);
  if (i < 0 || j < 0 || k < 0 || i >= index.n[0] || j >= index.n[1] || k >= index.n[2]) return index.empty;
  return index.buckets[(k * index.n[1] + j) * index.n[0] + i];
}
export function evalIndexed(index, x, y, z) {
  const list = queryPrims(index, x, y, z);
  let d = 1e3;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const v = p.d(x, y, z);
    if (p.op === 'add') d = smin(d, v, p.k);
    else if (p.op === 'sub') d = smax(d, -v, p.k);
    else d = smax(d, v, p.k);
  }
  return d;
}

// vertex adjacency lists (for weight smoothing)
export function adjacency(indices, nVerts) {
  const adj = Array.from({ length: nVerts }, () => []);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    adj[a].push(b, c); adj[b].push(a, c); adj[c].push(a, b);
  }
  return adj.map((l) => Array.from(new Set(l)));
}

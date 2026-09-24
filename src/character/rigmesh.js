// Builds a skinned mesh from an SDF sculpt: meshes each part at its own resolution,
// computes skin weights restricted to the bones each nearby primitive allows, smooths them
// over the surface, and assigns soft material weights from the model's region rules.
import * as THREE from 'three';
import { meshSDF, adjacency, buildPrimIndex, queryPrims } from './mesher.js';

function segDist(px, py, pz, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz || 1e-9;
  let t = ((px - a.x) * abx + (py - a.y) * aby + (pz - a.z) * abz) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (a.x + abx * t), dy = py - (a.y + aby * t), dz = pz - (a.z + abz * t);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function buildRigMesh(model, rig, joints, opts = {}) {
  const { J, tips } = joints;
  const prims = model.sculpt(J, tips, rig);
  const parts = opts.lod ? model.lodParts(J, rig) : model.parts(J, rig);
  const allPos = [], allNrm = [], allIdx = [], partOf = [];
  let base = 0;
  const stats = [];
  for (const part of parts) {
    const partPrims = part.filter ? prims.filter(part.filter) : prims;
    const m = meshSDF(partPrims, { cell: part.cell, bounds: part.bounds, region: part.region, project: part.project ?? 1 });
    stats.push({ name: part.name, ...m.stats });
    for (let i = 0; i < m.positions.length; i++) { allPos.push(m.positions[i]); allNrm.push(m.normals[i]); }
    for (let i = 0; i < m.indices.length; i++) allIdx.push(m.indices[i] + base);
    for (let i = 0; i < m.positions.length / 3; i++) partOf.push(parts.indexOf(part));
    base += m.positions.length / 3;
  }
  const nV = allPos.length / 3;
  const boneIndex = rig.index;
  const nB = rig.bones.length;

  // --- skin weights
  const W = new Float32Array(nV * nB);
  const allowedDefault = model.defaultBones || ['hips'];
  const pindex = buildPrimIndex(prims, 0.08);
  for (let v = 0; v < nV; v++) {
    const x = allPos[v * 3], y = allPos[v * 3 + 1], z = allPos[v * 3 + 2];
    // nearby primitives decide the allowed bones
    let dmin = 1e9;
    const ds = [];
    for (const p of queryPrims(pindex, x, y, z)) {
      if (p.op !== 'add' || !p.bones) continue;
      const bb = p.bbox, m = 0.06;
      if (x < bb[0] - m || y < bb[1] - m || z < bb[2] - m || x > bb[3] + m || y > bb[4] + m || z > bb[5] + m) continue;
      const d = p.d(x, y, z);
      ds.push([d, p]);
      if (d < dmin) dmin = d;
    }
    const allowed = new Set();
    for (const [d, p] of ds) if (d < dmin + (model.ownerBand ?? 0.018)) for (const b of p.bones) allowed.add(b);
    if (!allowed.size) for (const b of allowedDefault) allowed.add(b);
    let tot = 0;
    for (const bn of allowed) {
      const bi = boneIndex[bn];
      if (bi === undefined) throw new Error('unknown bone ' + bn);
      const d = segDist(x, y, z, J[bn], tips[bn]);
      const w = 1 / Math.pow(d * d + 0.0004, 2);
      W[v * nB + bi] += w;
      tot += w;
    }
    for (let b = 0; b < nB; b++) W[v * nB + b] /= tot;
  }
  // smoothing
  const adj = adjacency(allIdx, nV);
  const tmp = new Float32Array(W.length);
  const iters = model.smoothIters ?? 4;
  for (let it = 0; it < iters; it++) {
    for (let v = 0; v < nV; v++) {
      const nb = adj[v];
      const o = v * nB;
      for (let b = 0; b < nB; b++) tmp[o + b] = W[o + b] * 0.5;
      if (!nb.length) { for (let b = 0; b < nB; b++) tmp[o + b] = W[o + b]; continue; }
      const k = 0.5 / nb.length;
      for (const u of nb) { const ou = u * nB; for (let b = 0; b < nB; b++) tmp[o + b] += W[ou + b] * k; }
    }
    W.set(tmp);
  }
  const skinIndex = new Uint16Array(nV * 4), skinWeight = new Float32Array(nV * 4);
  const order = new Array(nB);
  for (let v = 0; v < nV; v++) {
    for (let b = 0; b < nB; b++) order[b] = b;
    const o = v * nB;
    order.sort((a, b) => W[o + b] - W[o + a]);
    let s = 0;
    for (let k = 0; k < 4; k++) s += W[o + order[k]];
    for (let k = 0; k < 4; k++) { skinIndex[v * 4 + k] = order[k]; skinWeight[v * 4 + k] = W[o + order[k]] / (s || 1); }
  }

  // --- material weights (8 channels) + extra per-vertex data
  const matA = new Float32Array(nV * 4), matB = new Float32Array(nV * 4), extra = new Float32Array(nV * 4);
  const mw = new Float32Array(8);
  const ex = new Float32Array(4);
  const pv = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let v = 0; v < nV; v++) {
    pv.set(allPos[v * 3], allPos[v * 3 + 1], allPos[v * 3 + 2]);
    nv.set(allNrm[v * 3], allNrm[v * 3 + 1], allNrm[v * 3 + 2]);
    mw.fill(0); ex.fill(0);
    // soft nearest-primitive materials
    let dmin = 1e9;
    const near = [];
    for (const p of queryPrims(pindex, pv.x, pv.y, pv.z)) {
      if (p.op !== 'add' || p.mat === null) continue;
      const bb = p.bbox, m = 0.03;
      if (pv.x < bb[0] - m || pv.y < bb[1] - m || pv.z < bb[2] - m || pv.x > bb[3] + m || pv.y > bb[4] + m || pv.z > bb[5] + m) continue;
      const d = p.d(pv.x, pv.y, pv.z);
      near.push(d, p);
      if (d < dmin) dmin = d;
    }
    const sharp = model.matSharpness ?? 0.0025;
    for (let i = 0; i < near.length; i += 2) {
      const w = Math.exp(-(near[i] - dmin) / sharp);
      if (w < 1e-3) continue;
      mw[near[i + 1].mat] += w;
      if (near[i + 1].hair) ex[1] = Math.max(ex[1], near[i + 1].hair * w);
      if (near[i + 1].tag === 'eye') ex[0] = Math.max(ex[0], w);
      if (near[i + 1].tag === 'brow') ex[2] = Math.max(ex[2], w);
      if (near[i + 1].tag === 'stubble') ex[3] = Math.max(ex[3], w);
    }
    if (model.materialAt) model.materialAt(pv, nv, J, mw, ex, prims);
    let s = 0;
    for (let i = 0; i < 8; i++) s += mw[i];
    if (s <= 0) { mw[0] = 1; s = 1; }
    for (let i = 0; i < 4; i++) { matA[v * 4 + i] = mw[i] / s; matB[v * 4 + i] = mw[4 + i] / s; extra[v * 4 + i] = ex[i]; }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(allNrm, 3));
  g.setAttribute('aBind', new THREE.Float32BufferAttribute(allPos.slice(), 3));
  g.setAttribute('aMatA', new THREE.BufferAttribute(matA, 4));
  g.setAttribute('aMatB', new THREE.BufferAttribute(matB, 4));
  g.setAttribute('aExtra', new THREE.BufferAttribute(extra, 4));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  g.setIndex(allIdx);
  g.computeBoundingSphere();
  return { geometry: g, stats, prims };
}

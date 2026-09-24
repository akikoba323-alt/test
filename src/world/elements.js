// Element store: every destructible architectural piece (column, slab panel, spandrel, glass pane,
// mullion, wall, furniture...) is an instanced box addressable by id, with an AABB spatial index
// so the fight can query "everything within 3 m of this impact" and crack / hide / fracture it.
import * as THREE from 'three';
import { KIND } from './archmat.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CELL = 6;

export const EL = { ARCH: 0, GLASS_O: 1, GLASS_T: 2 };

export class ElementStore {
  constructor(ctx, capacity = { arch: 20000, glassO: 8000, glassT: 2000 }) {
    this.ctx = ctx;
    this.n = 0;
    const cap = capacity.arch + capacity.glassO + capacity.glassT;
    this.cap = cap;
    // per-element data
    this.layer = new Uint8Array(cap);
    this.inst = new Int32Array(cap);
    this.bmin = new Float32Array(cap * 3);
    this.bmax = new Float32Array(cap * 3);
    this.kind = new Uint8Array(cap);
    this.bld = new Int16Array(cap);
    this.floor = new Int16Array(cap);
    this.flags = new Uint16Array(cap);
    this.state = new Uint8Array(cap);      // 0 intact, 1 cracked, 2 removed
    this.tint = new Float32Array(cap * 3);
    this.seed = new Float32Array(cap);
    this.rotY = new Float32Array(cap);
    this.grid = new Map();
    this.layers = [];
    this.matArch = ctx.mats.arch;
    this.matGlassO = ctx.mats.glassO;
    this.matGlassT = ctx.mats.glassT;
    this.makeLayer(EL.ARCH, capacity.arch, this.matArch, true);
    this.makeLayer(EL.GLASS_O, capacity.glassO, this.matGlassO, false);
    this.makeLayer(EL.GLASS_T, capacity.glassT, this.matGlassT, false);
    this.group = new THREE.Group();
    for (const L of this.layers) this.group.add(L.mesh);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.initialMatrices = null;
  }

  makeLayer(id, cap, mat, shadow) {
    const g = BOX.clone();
    const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const t = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(id === EL.ARCH ? 'aArch' : 'aGlass', a);
    g.setAttribute('aTint', t);
    const mesh = new THREE.InstancedMesh(g, mat, cap);
    mesh.count = 0;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.layers[id] = { id, cap, mesh, attr: a, tint: t, count: 0, dirty: false, ranges: [] };
  }

  // Add an axis-aligned (optionally Y-rotated) box element. Returns element id.
  add(layer, cx, cy, cz, sx, sy, sz, kind, tint, meta = {}) {
    const L = this.layers[layer];
    if (L.count >= L.cap) return -1;
    const id = this.n++;
    const ii = L.count++;
    L.mesh.count = L.count;
    const ry = meta.rotY || 0;
    this._q.setFromAxisAngle(this._p.set(0, 1, 0), ry);
    this._m.compose(this._p.set(cx, cy, cz), this._q, this._s.set(sx, sy, sz));
    L.mesh.setMatrixAt(ii, this._m);
    const seed = meta.seed ?? Math.random();
    if (layer === EL.ARCH) L.attr.setXYZW(ii, kind, seed, meta.damage || 0, 0);
    else L.attr.setXYZW(ii, meta.mode ?? (layer === EL.GLASS_T ? 1 : 0), seed, 0, meta.depth ?? 5);
    L.tint.setXYZ(ii, tint[0], tint[1], tint[2]);
    this.layer[id] = layer; this.inst[id] = ii; this.kind[id] = kind;
    // AABB (rotated boxes: conservative)
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    const hx = (sx * c + sz * s) / 2, hz = (sx * s + sz * c) / 2, hy = sy / 2;
    this.bmin[id * 3] = cx - hx; this.bmin[id * 3 + 1] = cy - hy; this.bmin[id * 3 + 2] = cz - hz;
    this.bmax[id * 3] = cx + hx; this.bmax[id * 3 + 1] = cy + hy; this.bmax[id * 3 + 2] = cz + hz;
    this.bld[id] = meta.bld ?? -1; this.floor[id] = meta.floor ?? -1; this.flags[id] = meta.flags ?? 0;
    this.tint[id * 3] = tint[0]; this.tint[id * 3 + 1] = tint[1]; this.tint[id * 3 + 2] = tint[2];
    this.seed[id] = seed; this.rotY[id] = ry;
    this.state[id] = 0;
    // spatial grid
    const x0 = Math.floor((cx - hx) / CELL), x1 = Math.floor((cx + hx) / CELL);
    const y0 = Math.floor((cy - hy) / CELL), y1 = Math.floor((cy + hy) / CELL);
    const z0 = Math.floor((cz - hz) / CELL), z1 = Math.floor((cz + hz) / CELL);
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = (x + 2048) * 16777216 + (y + 512) * 4096 + (z + 2048);
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(id);
    }
    return id;
  }

  // after construction: snapshot matrices so reset() can restore the intact city
  seal() {
    for (const L of this.layers) {
      if (L.count) L.mesh.computeBoundingSphere();
      L.mesh.visible = L.count > 0;
      L.mesh.instanceMatrix.needsUpdate = true;
      L.attr.needsUpdate = true; L.tint.needsUpdate = true;
      L.initial = L.mesh.instanceMatrix.array.slice(0, L.count * 16);
      L.initialAttr = L.attr.array.slice(0, L.count * 4);
    }
    this.initialState = this.state.slice(0, this.n);
    this.visitStamp = new Uint32Array(this.n);
    this.stamp = 1;
  }

  reset() {
    for (const L of this.layers) {
      L.mesh.instanceMatrix.array.set(L.initial);
      L.attr.array.set(L.initialAttr);
      L.mesh.instanceMatrix.needsUpdate = true;
      L.attr.needsUpdate = true;
    }
    this.state.set(this.initialState);
  }

  // query element ids overlapping an AABB
  query(minx, miny, minz, maxx, maxy, maxz, out = [], filter = null) {
    const stamp = ++this.stamp;
    const x0 = Math.floor(minx / CELL), x1 = Math.floor(maxx / CELL);
    const y0 = Math.floor(miny / CELL), y1 = Math.floor(maxy / CELL);
    const z0 = Math.floor(minz / CELL), z1 = Math.floor(maxz / CELL);
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const arr = this.grid.get((x + 2048) * 16777216 + (y + 512) * 4096 + (z + 2048));
      if (!arr) continue;
      for (const id of arr) {
        if (this.visitStamp[id] === stamp) continue;
        this.visitStamp[id] = stamp;
        if (this.state[id] === 2) continue;
        const i3 = id * 3;
        if (this.bmax[i3] < minx || this.bmin[i3] > maxx || this.bmax[i3 + 1] < miny || this.bmin[i3 + 1] > maxy || this.bmax[i3 + 2] < minz || this.bmin[i3 + 2] > maxz) continue;
        if (filter && !filter(id)) continue;
        out.push(id);
      }
    }
    return out;
  }

  querySphere(cx, cy, cz, r, out = [], filter = null) {
    const tmp = this.query(cx - r, cy - r, cz - r, cx + r, cy + r, cz + r, [], filter);
    for (const id of tmp) if (this.distToBox(id, cx, cy, cz) <= r) out.push(id);
    return out;
  }

  distToBox(id, x, y, z) {
    const i3 = id * 3;
    const dx = Math.max(this.bmin[i3] - x, 0, x - this.bmax[i3]);
    const dy = Math.max(this.bmin[i3 + 1] - y, 0, y - this.bmax[i3 + 1]);
    const dz = Math.max(this.bmin[i3 + 2] - z, 0, z - this.bmax[i3 + 2]);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // decompose an element's transform
  getBox(id, outPos, outSize) {
    const L = this.layers[this.layer[id]];
    L.mesh.getMatrixAt(this.inst[id], this._m);
    this._m.decompose(outPos, this._q, outSize);
    return this._q.clone();
  }

  hide(id) {
    if (this.state[id] === 2) return;
    this.state[id] = 2;
    const L = this.layers[this.layer[id]];
    this._m.makeScale(0, 0, 0);
    L.mesh.setMatrixAt(this.inst[id], this._m);
    L.mesh.instanceMatrix.needsUpdate = true;
  }

  setDamage(id, d) {
    const L = this.layers[this.layer[id]];
    if (this.layer[id] === EL.ARCH) L.attr.setZ(this.inst[id], d);
    else L.attr.setZ(this.inst[id], d);
    L.attr.needsUpdate = true;
    if (this.state[id] === 0 && d > 0) this.state[id] = 1;
  }
  getDamage(id) { return this.layers[this.layer[id]].attr.getZ(this.inst[id]); }

  center(id, out) {
    const i3 = id * 3;
    return out.set((this.bmin[i3] + this.bmax[i3]) / 2, (this.bmin[i3 + 1] + this.bmax[i3 + 1]) / 2, (this.bmin[i3 + 2] + this.bmax[i3 + 2]) / 2);
  }
}

export { KIND };

// Verlet cloth for coat skirts, scarf tails and sashes. Grid particles with structural, shear
// and bend constraints; the top row is pinned to a bone. Collides with capsules (legs, torso),
// feels air drag relative to wind/shockwave gusts, and is sub-stepped for very fast motion.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Cloth {
  // rest: array of rows of Vector3 (bind-pose world positions); pinBone: THREE.Bone; pinRows: number of pinned rows
  constructor(rest, pinBone, opts = {}) {
    this.rows = rest.length; this.cols = rest[0].length;
    const n = this.rows * this.cols;
    this.n = n;
    this.pos = new Float32Array(n * 3); this.prev = new Float32Array(n * 3);
    this.inv = new Float32Array(n);
    this.local = new Float32Array(n * 3); // pinned particle position in the bone's bind frame
    this.bone = pinBone;
    const bindInv = new THREE.Matrix4().copy(pinBone.matrixWorld).invert();
    this.wrap = !!opts.wrap;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c;
      const p = rest[r][c];
      this.pos.set([p.x, p.y, p.z], i * 3); this.prev.set([p.x, p.y, p.z], i * 3);
      this.inv[i] = r < (opts.pinRows ?? 1) ? 0 : 1;
      _v.copy(p).applyMatrix4(bindInv);
      this.local.set([_v.x, _v.y, _v.z], i * 3);
    }
    // constraints
    const C = [];
    const add = (a, b, k) => { const pa = rest[Math.floor(a / this.cols)][a % this.cols], pb = rest[Math.floor(b / this.cols)][b % this.cols]; C.push(a, b, pa.distanceTo(pb), k); };
    const idx = (r, c) => r * this.cols + (this.wrap ? (c + this.cols) % this.cols : c);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = idx(r, c);
      if (c + 1 < this.cols || this.wrap) add(i, idx(r, c + 1), 1);
      if (r + 1 < this.rows) add(i, idx(r + 1, c), 1);
      if (r + 1 < this.rows && (c + 1 < this.cols || this.wrap)) { add(i, idx(r + 1, c + 1), 0.5); add(idx(r, c + 1), idx(r + 1, c), 0.5); }
      if (r + 2 < this.rows) add(i, idx(r + 2, c), opts.bend ?? 0.3);
      if (c + 2 < this.cols || this.wrap) add(i, idx(r, c + 2), (opts.bend ?? 0.3) * 0.6);
    }
    this.C = new Float32Array(C);
    this.drag = opts.drag ?? 1.2;
    this.gravity = opts.gravity ?? 1;
    this.stretch = opts.stretch ?? 1.04;
    this.colliders = [];
    // geometry
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const uv = new Float32Array(n * 2);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) { uv[(r * this.cols + c) * 2] = c / (this.cols - 1); uv[(r * this.cols + c) * 2 + 1] = r / (this.rows - 1); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const ind = [];
    const cmax = this.wrap ? this.cols : this.cols - 1;
    for (let r = 0; r < this.rows - 1; r++) for (let c = 0; c < cmax; c++) {
      const a = idx(r, c), b = idx(r, c + 1), d = idx(r + 1, c), e = idx(r + 1, c + 1);
      ind.push(a, d, b, b, d, e);
    }
    g.setIndex(ind);
    this.geo = g;
    this.inited = false;
    this.lastPin = new THREE.Vector3();
  }

  pinned(i, out) {
    return out.set(this.local[i * 3], this.local[i * 3 + 1], this.local[i * 3 + 2]).applyMatrix4(this.bone.matrixWorld);
  }

  reset() {
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      if (this.inv[i] === 0) { this.pinned(i, _v); }
      else {
        // hang below the pin of the same column in the current pose
        const c = i % this.cols, r = Math.floor(i / this.cols);
        this.pinned(c, _v);
        const seg = this.C[2] || 0.08;
        _v.y -= r * seg;
      }
      this.pos[i3] = _v.x; this.pos[i3 + 1] = _v.y; this.pos[i3 + 2] = _v.z;
      this.prev[i3] = _v.x; this.prev[i3 + 1] = _v.y; this.prev[i3 + 2] = _v.z;
    }
    this.inited = true;
    this.bone.getWorldPosition(this.lastPin);
  }

  // wind(x,y,z,out) -> air velocity at a point
  step(dt, wind) {
    if (!this.inited) this.reset();
    if (dt <= 0) { this.writeGeometry(); return; }
    // teleport guard (seeks / cuts / holds snapping)
    this.bone.getWorldPosition(_a);
    const jump = _a.distanceTo(this.lastPin);
    this.lastPin.copy(_a);
    if (jump > 3) { this.reset(); this.writeGeometry(); return; }
    const sub = Math.min(6, Math.max(2, Math.ceil(jump / 0.12)));
    const h = dt / sub;
    const P = this.pos, Q = this.prev, inv = this.inv, C = this.C;
    // pinned targets for this frame, interpolated across substeps
    const n = this.n;
    const pinFrom = this._pf || (this._pf = new Float32Array(n * 3));
    const pinTo = this._pt || (this._pt = new Float32Array(n * 3));
    for (let i = 0; i < n; i++) if (inv[i] === 0) { const i3 = i * 3; pinFrom[i3] = P[i3]; pinFrom[i3 + 1] = P[i3 + 1]; pinFrom[i3 + 2] = P[i3 + 2]; this.pinned(i, _v); pinTo[i3] = _v.x; pinTo[i3 + 1] = _v.y; pinTo[i3 + 2] = _v.z; }
    const air = new THREE.Vector3();
    for (let s = 1; s <= sub; s++) {
      const k = s / sub;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        if (inv[i] === 0) { P[i3] = pinFrom[i3] + (pinTo[i3] - pinFrom[i3]) * k; P[i3 + 1] = pinFrom[i3 + 1] + (pinTo[i3 + 1] - pinFrom[i3 + 1]) * k; P[i3 + 2] = pinFrom[i3 + 2] + (pinTo[i3 + 2] - pinFrom[i3 + 2]) * k; Q[i3] = P[i3]; Q[i3 + 1] = P[i3 + 1]; Q[i3 + 2] = P[i3 + 2]; continue; }
        const x = P[i3], y = P[i3 + 1], z = P[i3 + 2];
        let vx = (x - Q[i3]) / h, vy = (y - Q[i3 + 1]) / h, vz = (z - Q[i3 + 2]) / h;
        wind(x, y, z, air);
        // quadratic-ish drag toward the air velocity
        const rx = air.x - vx, ry = air.y - vy, rz = air.z - vz;
        const rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
        const dk = Math.min(1, this.drag * h * (1 + rl * 0.08));
        vx += rx * dk; vy += ry * dk - 9.8 * this.gravity * h; vz += rz * dk;
        Q[i3] = x; Q[i3 + 1] = y; Q[i3 + 2] = z;
        P[i3] = x + vx * h; P[i3 + 1] = y + vy * h; P[i3 + 2] = z + vz * h;
      }
      for (let it = 0; it < 5; it++) {
        for (let c = 0; c < C.length; c += 4) {
          const a = C[c] * 3, b = C[c + 1] * 3, rest = C[c + 2], stiff = C[c + 3];
          const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const wa = inv[C[c]], wb = inv[C[c + 1]], w = wa + wb;
          if (w === 0) continue;
          const diff = ((d - rest) / d) * stiff / w;
          P[a] += dx * diff * wa; P[a + 1] += dy * diff * wa; P[a + 2] += dz * diff * wa;
          P[b] -= dx * diff * wb; P[b + 1] -= dy * diff * wb; P[b + 2] -= dz * diff * wb;
        }
        this.collide();
      }
    }
    this.writeGeometry();
  }

  collide() {
    const P = this.pos, inv = this.inv;
    for (const cap of this.colliders) {
      const ax = cap.a.x, ay = cap.a.y, az = cap.a.z;
      const bx = cap.b.x - ax, by = cap.b.y - ay, bz = cap.b.z - az;
      const l2 = bx * bx + by * by + bz * bz || 1e-6;
      const r = cap.r;
      for (let i = 0; i < this.n; i++) {
        if (inv[i] === 0) continue;
        const i3 = i * 3;
        const px = P[i3] - ax, py = P[i3 + 1] - ay, pz = P[i3 + 2] - az;
        let t = (px * bx + py * by + pz * bz) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - bx * t, dy = py - by * t, dz = pz - bz * t;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 1e-6;
          const push = (r - d) / d;
          P[i3] += dx * push; P[i3 + 1] += dy * push; P[i3 + 2] += dz * push;
        }
      }
    }
    // ground
    const fl = this.floorY ?? 0;
    for (let i = 0; i < this.n; i++) { const i3 = i * 3 + 1; if (P[i3] < fl + 0.01) P[i3] = fl + 0.01; }
  }

  writeGeometry() {
    const pa = this.geo.attributes.position.array, na = this.geo.attributes.normal.array;
    pa.set(this.pos);
    const R = this.rows, Cc = this.cols;
    for (let r = 0; r < R; r++) for (let c = 0; c < Cc; c++) {
      const i = r * Cc + c;
      const c0 = this.wrap ? (c - 1 + Cc) % Cc : Math.max(0, c - 1), c1 = this.wrap ? (c + 1) % Cc : Math.min(Cc - 1, c + 1);
      const r0 = Math.max(0, r - 1), r1 = Math.min(R - 1, r + 1);
      const ia = (r * Cc + c0) * 3, ib = (r * Cc + c1) * 3, ic = (r0 * Cc + c) * 3, id = (r1 * Cc + c) * 3;
      _a.set(pa[ib] - pa[ia], pa[ib + 1] - pa[ia + 1], pa[ib + 2] - pa[ia + 2]);
      _b.set(pa[id] - pa[ic], pa[id + 1] - pa[ic + 1], pa[id + 2] - pa[ic + 2]);
      _v.crossVectors(_b, _a).normalize();
      na[i * 3] = _v.x; na[i * 3 + 1] = _v.y; na[i * 3 + 2] = _v.z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

// ---- builders -------------------------------------------------------------------------
// Coat skirt: ellipse around the pelvis, open at the front, flaring down to the knees.
export function buildSkirt(J, bone, o) {
  const rows = o.rows ?? 8, cols = o.cols ?? 22;
  const cy = J.hips.y + (o.top ?? -0.02), cx = J.hips.x, cz = J.hips.z - 0.005;
  const rest = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    const u = r / (rows - 1);
    const y = cy - u * o.length;
    const flare = 1 + u * (o.flare ?? 0.35);
    for (let c = 0; c < cols; c++) {
      const a = (o.gap ?? 0.45) + (c / (cols - 1)) * (Math.PI * 2 - 2 * (o.gap ?? 0.45)); // angle from front (+Z), going around the back
      row.push(new THREE.Vector3(cx + Math.sin(a) * o.rx * flare, y, cz + Math.cos(a) * o.rz * flare));
    }
    rest.push(row);
  }
  return new Cloth(rest, bone, { pinRows: 1, bend: 0.25, drag: 1.4 });
}

// Ribbon/strip hanging from a point (scarf tail, sash end)
export function buildStrip(bone, start, dir, side, length, width, rows, o = {}) {
  const rest = [];
  const d = dir.clone().normalize(), s = side.clone().normalize();
  for (let r = 0; r < rows; r++) {
    const u = r / (rows - 1);
    const row = [];
    for (let c = 0; c < 2; c++) row.push(start.clone().addScaledVector(d, u * length).addScaledVector(s, (c - 0.5) * width * (1 - u * (o.taper ?? 0.3))));
    rest.push(row);
  }
  return new Cloth(rest, bone, { pinRows: 1, bend: o.bend ?? 0.5, drag: o.drag ?? 2.2, gravity: o.gravity ?? 1 });
}

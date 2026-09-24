// Signed distance primitives for sculpting characters in code. Each primitive exposes
// d(x,y,z) (world-space bind pose) and a bounding box used to splat it into a grid.
// Ops: 'add' (smooth union), 'sub' (smooth subtraction), 'int' (smooth intersection).
import * as THREE from 'three';

let _id = 0;
function base(bbox, opts) {
  return {
    id: _id++,
    bbox,
    op: opts.op || 'add',
    k: opts.k ?? 0.02,
    mat: opts.mat ?? null,       // material override id (else region rules decide)
    bones: opts.bones || null,   // bones allowed to influence skin weights near this primitive
    tag: opts.tag || null,
    hair: opts.hair ?? 0,        // 0..1, flutter weight
  };
}

const rotInv = (m) => { // Matrix3 (local->world) -> row-major world->local 9 numbers
  const e = m.elements; // column-major
  return [e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8]];
};

// basis from forward-ish axis: returns Matrix3 whose columns are local x,y,z in world
export function basisFromY(yAxis, zHint = new THREE.Vector3(0, 0, 1)) {
  const y = yAxis.clone().normalize();
  let x = new THREE.Vector3().crossVectors(y, zHint);
  if (x.lengthSq() < 1e-6) x = new THREE.Vector3().crossVectors(y, new THREE.Vector3(1, 0, 0));
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  return new THREE.Matrix3().set(x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z);
}
export function basisEuler(xDeg, yDeg, zDeg) {
  const m4 = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(xDeg * Math.PI / 180, yDeg * Math.PI / 180, zDeg * Math.PI / 180, 'ZXY'));
  return new THREE.Matrix3().setFromMatrix4(m4);
}

export function sphere(c, r, opts = {}) {
  const [cx, cy, cz] = [c.x, c.y, c.z];
  const p = base([cx - r, cy - r, cz - r, cx + r, cy + r, cz + r], opts);
  p.d = (x, y, z) => Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) - r;
  return p;
}

// radii along local axes of basis m (Matrix3 columns = local axes). IQ's bound approximation.
export function ellipsoid(c, rx, ry, rz, m = null, opts = {}) {
  const [cx, cy, cz] = [c.x, c.y, c.z];
  const R = Math.max(rx, ry, rz);
  const p = base([cx - R, cy - R, cz - R, cx + R, cy + R, cz + R], opts);
  const e = m ? m.elements : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  // local = M^T * (p - c): column vectors are e[0..2], e[3..5], e[6..8]
  const irx = 1 / rx, iry = 1 / ry, irz = 1 / rz;
  p.d = (x, y, z) => {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const lx = e[0] * dx + e[1] * dy + e[2] * dz;
    const ly = e[3] * dx + e[4] * dy + e[5] * dz;
    const lz = e[6] * dx + e[7] * dy + e[8] * dz;
    const ax = lx * irx, ay = ly * iry, az = lz * irz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax * irx, by = ay * iry, bz = az * irz;
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  };
  return p;
}

// Round cone between a (radius r1) and b (radius r2); a capsule when r1 == r2. Exact (IQ).
export function roundCone(a, b, r1, r2 = r1, opts = {}) {
  const ax = a.x, ay = a.y, az = a.z;
  const bax = b.x - ax, bay = b.y - ay, baz = b.z - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const R = Math.max(r1, r2);
  const p = base([Math.min(a.x, b.x) - R, Math.min(a.y, b.y) - R, Math.min(a.z, b.z) - R, Math.max(a.x, b.x) + R, Math.max(a.y, b.y) + R, Math.max(a.z, b.z) + R], opts);
  const srr = Math.sign(rr);
  p.d = (x, y, z) => {
    const pax = x - ax, pay = y - ay, paz = z - az;
    const yy = pax * bax + pay * bay + paz * baz;
    const zz = yy - l2;
    const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = srr * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
  return p;
}

export function roundBox(c, hx, hy, hz, r, m = null, opts = {}) {
  const [cx, cy, cz] = [c.x, c.y, c.z];
  const R = Math.sqrt(hx * hx + hy * hy + hz * hz);
  const p = base([cx - R, cy - R, cz - R, cx + R, cy + R, cz + R], opts);
  const e = m ? m.elements : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const bx = hx - r, by = hy - r, bz = hz - r;
  p.d = (x, y, z) => {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const lx = Math.abs(e[0] * dx + e[1] * dy + e[2] * dz) - bx;
    const ly = Math.abs(e[3] * dx + e[4] * dy + e[5] * dz) - by;
    const lz = Math.abs(e[6] * dx + e[7] * dy + e[8] * dz) - bz;
    const mx = Math.max(lx, 0), my = Math.max(ly, 0), mz = Math.max(lz, 0);
    return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(lx, Math.max(ly, lz)), 0) - r;
  };
  return p;
}

// Torus in the local XZ plane of basis m (axis = local Y).
export function torus(c, R, r, m = null, opts = {}) {
  const [cx, cy, cz] = [c.x, c.y, c.z];
  const E = R + r;
  const p = base([cx - E, cy - E, cz - E, cx + E, cy + E, cz + E], opts);
  const e = m ? m.elements : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  p.d = (x, y, z) => {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const lx = e[0] * dx + e[1] * dy + e[2] * dz;
    const ly = e[3] * dx + e[4] * dy + e[5] * dz;
    const lz = e[6] * dx + e[7] * dy + e[8] * dz;
    const q = Math.sqrt(lx * lx + lz * lz) - R;
    return Math.sqrt(q * q + ly * ly) - r;
  };
  return p;
}

// Half-space (for clipping / flat cuts): points with dot(p - c, n) > 0 are outside.
export function plane(c, n, opts = {}) {
  const nn = n.clone().normalize();
  const p = base([-1e3, -1e3, -1e3, 1e3, 1e3, 1e3], opts);
  const d0 = nn.dot(c);
  p.d = (x, y, z) => nn.x * x + nn.y * y + nn.z * z - d0;
  p.infinite = true;
  return p;
}

// Generic primitive from a closure (caller supplies bbox)
export function custom(bbox, fn, opts = {}) {
  const p = base(bbox, opts);
  p.d = fn;
  return p;
}

export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smax(a, b, k) { return -smin(-a, -b, k); }

// Evaluate a primitive list at one point (sequential ops) — used for vertex projection and attributes.
export function evalSDF(prims, x, y, z) {
  let d = 1e3;
  for (let i = 0; i < prims.length; i++) {
    const p = prims[i], bb = p.bbox, m = p.k + 0.01;
    if (!p.infinite && (x < bb[0] - m || y < bb[1] - m || z < bb[2] - m || x > bb[3] + m || y > bb[4] + m || z > bb[5] + m)) {
      if (p.op === 'int') d = Math.max(d, 1e3);
      continue;
    }
    const v = p.d(x, y, z);
    if (p.op === 'add') d = smin(d, v, p.k);
    else if (p.op === 'sub') d = smax(d, -v, p.k);
    else d = smax(d, v, p.k);
  }
  return d;
}

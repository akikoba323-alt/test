// Character sculpts. Everything is authored in the bind (A-)pose in world meters, anchored on
// joint positions so the same code adapts to each fighter's proportions.
import * as THREE from 'three';
import { sphere, ellipsoid, roundCone, roundBox, torus, basisFromY, basisEuler } from './sdf.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a.clone().lerp(b, t);
const dirv = (a, b) => b.clone().sub(a).normalize();
const add = (a, x, y, z) => a.clone().add(V(x, y, z));
const FWD = V(0, 0, 1);

// Material slots shared by both fighters (the shader has one table per fighter)
export const M = { SKIN: 0, CLOTH_A: 1, CLOTH_B: 2, BOOT: 3, GLOVE: 4, HAIR: 5, ACCENT: 6, METAL: 7 };

// basis for a bone from its world matrix (columns x,y,z)
function boneBasis(rig, name) {
  return new THREE.Matrix3().setFromMatrix4(rig.byName[name].matrixWorld);
}
// point in a bone's local frame
function bonePt(rig, name, x, y, z) {
  return V(x, y, z).applyMatrix4(rig.byName[name].matrixWorld);
}
function side(s) { return s === 'L' ? 1 : -1; }

// ------------------------------------------------------------------------------------------
// shared anatomy builders (parameterized by bulk)
function buildLimbs(J, tips, rig, P, prims, o) {
  for (const s of ['L', 'R']) {
    const sx = side(s);
    const ua = J['upperarm.' + s], fa = J['forearm.' + s], hd = J['hand.' + s];
    const armB = basisFromY(dirv(ua, fa), FWD);
    const faB = basisFromY(dirv(fa, hd), FWD);
    const armMat = o.sleeveMat ?? M.SKIN;
    // deltoid cap
    prims.push(ellipsoid(add(lerp(ua, fa, 0.12), sx * 0.006 * o.bulk, 0.006, 0.0), 0.048 * o.bulk * o.delt, 0.078 * o.bulk, 0.053 * o.bulk * o.delt, armB, { k: 0.048, mat: armMat, bones: ['clavicle.' + s, 'upperarm.' + s, 'chest'] }));
    prims.push(roundCone(ua, fa, 0.047 * o.bulk, 0.037 * o.bulk, { k: 0.02, mat: armMat, bones: ['upperarm.' + s] }));
    // biceps (front = local z) / triceps (back)
    const bc = lerp(ua, fa, 0.5).add(new THREE.Vector3(0, 0, 1).applyMatrix3(armB).multiplyScalar(0.02 * o.bulk));
    prims.push(ellipsoid(bc, 0.034 * o.bulk * o.arm, 0.085, 0.036 * o.bulk * o.arm, armB, { k: 0.025, mat: armMat, bones: ['upperarm.' + s] }));
    const tc = lerp(ua, fa, 0.38).add(new THREE.Vector3(0, 0, -1).applyMatrix3(armB).multiplyScalar(0.022 * o.bulk));
    prims.push(ellipsoid(tc, 0.037 * o.bulk * o.arm, 0.095, 0.033 * o.bulk * o.arm, armB, { k: 0.025, mat: armMat, bones: ['upperarm.' + s] }));
    prims.push(sphere(fa, 0.036 * o.bulk, { k: 0.025, mat: armMat, bones: ['upperarm.' + s, 'forearm.' + s] }));
    // forearm
    const faMat = o.forearmMat ?? armMat;
    prims.push(roundCone(fa, hd, 0.042 * o.bulk * o.fore, 0.027 * o.bulk, { k: 0.02, mat: faMat, bones: ['forearm.' + s] }));
    const fb = lerp(fa, hd, 0.28).add(new THREE.Vector3(sx * 0.35, 0, 0.6).applyMatrix3(faB).multiplyScalar(0.018 * o.bulk));
    prims.push(ellipsoid(fb, 0.04 * o.bulk * o.fore, 0.08, 0.034 * o.bulk * o.fore, faB, { k: 0.025, mat: faMat, bones: ['forearm.' + s] }));
    // legs
    const th = J['thigh.' + s], kn = J['shin.' + s], an = J['foot.' + s];
    const thB = basisFromY(dirv(th, kn), FWD);
    const shB = basisFromY(dirv(kn, an), FWD);
    const legMat = o.legMat ?? M.CLOTH_B;
    prims.push(roundCone(th, kn, 0.082 * o.bulk * o.leg, 0.05 * o.bulk, { k: 0.03, mat: legMat, bones: ['thigh.' + s, 'hips'] }));
    const q = lerp(th, kn, 0.45).add(new THREE.Vector3(0, 0, 1).applyMatrix3(thB).multiplyScalar(0.03 * o.bulk));
    prims.push(ellipsoid(q, 0.055 * o.bulk * o.leg, 0.17, 0.05 * o.bulk * o.leg, thB, { k: 0.03, mat: legMat, bones: ['thigh.' + s] }));
    const hm = lerp(th, kn, 0.42).add(new THREE.Vector3(0, 0, -1).applyMatrix3(thB).multiplyScalar(0.03 * o.bulk));
    prims.push(ellipsoid(hm, 0.05 * o.bulk * o.leg, 0.16, 0.046 * o.bulk * o.leg, thB, { k: 0.03, mat: legMat, bones: ['thigh.' + s] }));
    const ad = lerp(th, kn, 0.22).add(V(-sx * 0.035, 0, 0));
    prims.push(ellipsoid(ad, 0.045 * o.bulk, 0.12, 0.05 * o.bulk, thB, { k: 0.03, mat: legMat, bones: ['thigh.' + s, 'hips'] }));
    prims.push(sphere(kn, 0.05 * o.bulk, { k: 0.03, mat: legMat, bones: ['thigh.' + s, 'shin.' + s] }));
    prims.push(sphere(add(kn, 0, 0.005, 0.035), 0.028 * o.bulk, { k: 0.02, mat: legMat, bones: ['shin.' + s] }));
    prims.push(roundCone(kn, an, 0.047 * o.bulk, 0.03 * o.bulk, { k: 0.02, mat: legMat, bones: ['shin.' + s] }));
    const cf = lerp(kn, an, 0.3).add(new THREE.Vector3(0, 0, -1).applyMatrix3(shB).multiplyScalar(0.028 * o.bulk));
    prims.push(ellipsoid(cf, 0.045 * o.bulk * o.leg, 0.1, 0.045 * o.bulk * o.leg, shB, { k: 0.03, mat: legMat, bones: ['shin.' + s] }));
  }
}

function buildTorso(J, prims, o) {
  const mat = o.torsoMat ?? M.SKIN, hipMat = o.hipMat ?? M.CLOTH_B, b = o.bulk, c = o.chest;
  const hy = J.hips.y, cy = J.chest.y;
  prims.push(ellipsoid(add(J.hips, 0, -0.02, -0.005), 0.155 * b, 0.105 * b, 0.105 * b, null, { k: 0.04, mat: hipMat, bones: ['hips'] }));
  for (const sx of [1, -1]) prims.push(ellipsoid(add(J.hips, sx * 0.07 * b, -0.075, -0.055 * b), 0.08 * b, 0.095 * b, 0.075 * b, null, { k: 0.04, mat: hipMat, bones: ['hips', sx > 0 ? 'thigh.L' : 'thigh.R'] }));
  prims.push(ellipsoid(add(J.spine, 0, 0.015, 0.02), 0.13 * b, 0.12 * b, 0.095 * b, null, { k: 0.05, mat, bones: ['spine', 'hips'] }));
  for (const sx of [1, -1]) prims.push(ellipsoid(add(J.spine, sx * 0.1 * b, -0.01, 0), 0.05 * b, 0.08 * b, 0.07 * b, null, { k: 0.04, mat, bones: ['spine'] }));
  prims.push(ellipsoid(add(J.chest, 0, 0.015, -0.005), 0.155 * b * c, 0.175 * b, 0.115 * b, null, { k: 0.05, mat, bones: ['chest', 'spine'] }));
  for (const sx of [1, -1]) {
    prims.push(ellipsoid(add(J.chest, sx * 0.07 * b * c, 0.065 * b, 0.07 * b), 0.08 * b * c, 0.06 * b * c, 0.04 * b * c, basisEuler(-12, 0, sx * 12), { k: 0.03, mat, bones: ['chest'] }));
    prims.push(ellipsoid(add(J.chest, sx * 0.115 * b * c, 0.0, -0.045 * b), 0.055 * b * c, 0.13 * b, 0.065 * b, null, { k: 0.04, mat, bones: ['chest'] }));
    prims.push(ellipsoid(add(J.chest, sx * 0.075 * b, 0.07, -0.085 * b), 0.06 * b, 0.08 * b, 0.035 * b, null, { k: 0.04, mat, bones: ['chest'] }));
  }
  prims.push(ellipsoid(add(J.chest, 0, 0.16 * b, -0.045 * b), 0.13 * b * o.traps, 0.05 * b * Math.sqrt(o.traps), 0.06 * b, null, { k: 0.05, mat, bones: ['chest', 'neck'] }));
}

// Head sculpt in head-joint local offsets (bind pose head is unrotated). Vertical layout
// (relative to the head joint): chin -0.035, mouth +0.011, nose base +0.033, eyes +0.074,
// brow +0.098, hairline +0.163, crown +0.19.
export const EYE_OFFSET = [0.031, 0.074, 0.08];
function buildHead(J, prims, o) {
  const H = J.head, skin = M.SKIN;
  const hb = ['head'], jb = ['jaw', 'head'];
  const f = o.face;
  const fs = f.s ?? 1;
  const P = (x, y, z) => add(H, x * f.w * fs, y * fs, z * f.d * fs);
  prims.push(ellipsoid(P(0, 0.108, -0.016), 0.074 * f.w * fs, 0.09 * fs, 0.096 * f.d * fs, null, { k: 0.03, mat: skin, bones: hb }));
  prims.push(ellipsoid(P(0, 0.122, 0.034), 0.066 * f.w * fs, 0.056 * fs, 0.058 * f.d * fs, null, { k: 0.03, mat: skin, bones: hb }));
  prims.push(ellipsoid(P(0, 0.056, 0.048), 0.058 * f.w * fs, 0.05 * fs, 0.05 * f.d * fs, null, { k: 0.028, mat: skin, bones: hb }));
  prims.push(ellipsoid(P(0, 0.014, 0.028), 0.053 * f.w * f.jaw * fs, 0.04 * fs, 0.058 * f.d * fs, null, { k: 0.028, mat: skin, bones: jb, tag: o.stubble ? 'stubble' : null }));
  for (const sx of [1, -1]) prims.push(ellipsoid(P(sx * 0.05 * f.jaw, 0.016, -0.004), 0.016, 0.025, 0.026, null, { k: 0.024, mat: skin, bones: jb }));
  prims.push(ellipsoid(P(0, -0.011, 0.075), 0.021 * f.chin * fs, 0.016 * fs, 0.017 * fs, null, { k: 0.02, mat: skin, bones: ['jaw'], tag: o.stubble ? 'stubble' : null }));
  for (const sx of [1, -1]) prims.push(ellipsoid(P(sx * 0.046, 0.064, 0.06), 0.02, 0.013, 0.021, null, { k: 0.02, mat: skin, bones: hb }));
  prims.push(roundCone(P(-0.044, 0.097, 0.081), P(0.044, 0.097, 0.081), 0.0105 * f.brow, 0.0105 * f.brow, { k: 0.02, mat: skin, bones: hb }));
  prims.push(roundCone(P(0, 0.09, 0.087), P(0, 0.047, 0.101 + f.nose * 0.003), 0.0064, 0.0094 * f.nose, { k: 0.012, mat: skin, bones: hb }));
  for (const sx of [1, -1]) prims.push(sphere(P(sx * 0.0105 * f.nose, 0.04, 0.092), 0.0078, { k: 0.01, mat: skin, bones: hb }));
  // fuller cheeks between cheekbone and jaw
  for (const sx of [1, -1]) prims.push(ellipsoid(P(sx * 0.04, 0.038, 0.046), 0.022, 0.026, 0.026, null, { k: 0.025, mat: skin, bones: hb }));
  // philtrum ridges and nasolabial hint
  for (const sx of [1, -1]) prims.push(roundCone(P(sx * 0.0035, 0.033, 0.095), P(sx * 0.0045, 0.02, 0.094), 0.0022, 0.0022, { k: 0.004, mat: skin, bones: hb }));
  const [ex, ey, ez] = EYE_OFFSET;
  // brows (hair material) following the brow ridge
  const ridgeR = 0.0105 * f.brow;
  if (o.brows) for (const sx of [1, -1]) prims.push(roundCone(P(sx * 0.011, 0.0955, 0.081 + ridgeR * 0.9), P(sx * 0.05, 0.0995, 0.07 + ridgeR * 0.8), 0.0036, 0.0019, { k: 0.002, mat: M.HAIR, bones: hb, tag: 'brow' }));
  for (const sx of [1, -1]) prims.push(sphere(P(sx * ex, ey + 0.002, ez + 0.016), 0.0175, { op: 'sub', k: 0.011 }));
  for (const sx of [1, -1]) prims.push(sphere(P(sx * ex, ey, ez), 0.0126, { k: 0.0015, mat: skin, tag: 'eye', bones: hb }));
  for (const sx of [1, -1]) prims.push(ellipsoid(P(sx * ex, ey + 0.0078, ez + 0.0045), 0.0142, 0.0042, 0.0092, basisEuler(24, 0, 0), { k: 0.0045, mat: skin, bones: hb }));
  for (const sx of [1, -1]) prims.push(ellipsoid(P(sx * ex, ey - 0.0082, ez + 0.0048), 0.0128, 0.003, 0.0078, null, { k: 0.0035, mat: skin, bones: hb }));
  // mouth
  prims.push(ellipsoid(P(0, 0.0165, 0.092), 0.0195, 0.0058, 0.0072, null, { k: 0.008, mat: skin, bones: hb }));
  prims.push(ellipsoid(P(0, 0.0055, 0.0895), 0.0178, 0.0066, 0.0074, null, { k: 0.008, mat: skin, bones: ['jaw'] }));
  prims.push(roundCone(P(-0.0195, 0.011, 0.1), P(0.0195, 0.011, 0.1), 0.0018, 0.0018, { op: 'sub', k: 0.0035 }));
  // ears
  for (const sx of [1, -1]) prims.push(ellipsoid(P(sx * 0.073, 0.066, -0.008), 0.0095, 0.028, 0.019, basisEuler(0, sx * 20, 0), { k: 0.011, mat: skin, bones: hb }));
  // neck
  prims.push(roundCone(add(J.neck, 0, -0.01, -0.005), add(H, 0, 0.03, -0.014), 0.055 * o.neck, 0.048 * o.neck, { k: 0.035, mat: skin, bones: ['neck', 'head'] }));
  for (const sx of [1, -1]) prims.push(roundCone(P(sx * 0.054, 0.042, -0.016), add(J.neck, sx * 0.022, -0.015, 0.05), 0.012 * o.neck, 0.011 * o.neck, { k: 0.025, mat: skin, bones: ['neck', 'head'] }));
}

// Swept-back spiky hair built from bent clumps (two round cones each).
function buildSpikyHair(H, prims, seed0) {
  let seed = seed0;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hb = ['head'];
  prims.push(ellipsoid(add(H, 0, 0.112, -0.022), 0.081, 0.094, 0.102, null, { k: 0.018, mat: M.HAIR, bones: hb, hair: 0.1 }));
  // explicit spikes: [azimuth (0=front), root height, dir(back, up, out), length, root radius, bend]
  const spikes = [
    [0.0, 0.176, [0.6, 0.85, 0.0], 0.16, 0.03, -0.9], [0.45, 0.17, [0.6, 0.85, 0.3], 0.15, 0.028, -0.85], [-0.45, 0.17, [0.6, 0.85, 0.3], 0.15, 0.028, -0.85],
    [0.9, 0.155, [0.7, 0.6, 0.55], 0.13, 0.026, -0.7], [-0.9, 0.155, [0.7, 0.6, 0.55], 0.13, 0.026, -0.7],
    [0.2, 0.2, [0.8, 0.6, 0.1], 0.17, 0.03, -0.6], [-0.25, 0.2, [0.8, 0.6, 0.1], 0.17, 0.03, -0.6],
    [0.0, 0.205, [1.0, 0.35, 0.0], 0.18, 0.032, -0.5],
    [1.35, 0.14, [1.0, 0.35, 0.55], 0.14, 0.026, -0.35], [-1.35, 0.14, [1.0, 0.35, 0.55], 0.14, 0.026, -0.35],
    [1.75, 0.115, [1.0, 0.05, 0.6], 0.12, 0.024, -0.25], [-1.75, 0.115, [1.0, 0.05, 0.6], 0.12, 0.024, -0.25],
    [2.3, 0.1, [0.9, -0.25, 0.55], 0.11, 0.024, -0.1], [-2.3, 0.1, [0.9, -0.25, 0.55], 0.11, 0.024, -0.1],
    [2.85, 0.095, [0.9, -0.45, 0.25], 0.1, 0.024, 0.0], [-2.85, 0.095, [0.9, -0.45, 0.25], 0.1, 0.024, 0.0],
    [2.6, 0.155, [1.0, 0.1, 0.3], 0.14, 0.028, -0.2], [-2.6, 0.155, [1.0, 0.1, 0.3], 0.14, 0.028, -0.2],
    [3.1, 0.14, [1.0, -0.1, 0.0], 0.13, 0.027, -0.1],
  ];
  for (const [az, ry, dir, L, r0, bend] of spikes) {
    const j = (rnd() - 0.5) * 0.08;
    const root = add(H, Math.sin(az + j) * 0.066, ry, Math.cos(az + j) * 0.078 - 0.022);
    const out = V(Math.sin(az), 0, Math.cos(az) * 0.4);
    const d = V(0, dir[1], -dir[0]).addScaledVector(out, dir[2]).normalize();
    const mid = root.clone().addScaledVector(d, L * 0.5);
    // bend: tips curl backward/down
    const d2 = d.clone().add(V(0, bend * 0.35, -0.35)).normalize();
    const tip = mid.clone().addScaledVector(d2, L * 0.55);
    prims.push(roundCone(root, mid, r0, r0 * 0.58, { k: 0.008, mat: M.HAIR, bones: hb, hair: 0.35 }));
    prims.push(roundCone(mid, tip, r0 * 0.58, 0.0016, { k: 0.004, mat: M.HAIR, bones: hb, hair: 1.0 }));
  }
}

function buildHands(J, rig, prims, o) {
  for (const s of ['L', 'R']) {
    const sx = side(s);
    const gl = o.handMat;
    const hB = boneBasis(rig, 'hand.' + s), fB = boneBasis(rig, 'fingers.' + s), tB = boneBasis(rig, 'fingertips.' + s);
    const hb = o.hand;
    // wrist
    prims.push(roundCone(lerp(J['forearm.' + s], J['hand.' + s], 0.85), J['hand.' + s], 0.027 * hb, 0.025 * hb, { k: 0.015, mat: o.wristMat ?? gl, bones: ['forearm.' + s, 'hand.' + s] }));
    // palm: local x = palm normal axis, y = along (negative), z = width (thumb side +z)
    prims.push(roundBox(bonePt(rig, 'hand.' + s, 0, -0.048 * hb, 0.004), 0.017 * hb, 0.047 * hb, 0.043 * hb, 0.014 * hb, hB, { k: 0.012, mat: gl, bones: ['hand.' + s] }));
    prims.push(ellipsoid(bonePt(rig, 'hand.' + s, -sx * 0.008, -0.03 * hb, 0.03 * hb), 0.018 * hb, 0.03 * hb, 0.018 * hb, hB, { k: 0.012, mat: gl, bones: ['hand.' + s, 'thumb.' + s] }));
    // fingers (mitten with grooves)
    prims.push(roundBox(bonePt(rig, 'fingers.' + s, 0, -0.024 * hb, 0), 0.0165 * hb, 0.03 * hb, 0.041 * hb, 0.0125 * hb, fB, { k: 0.008, mat: gl, bones: ['fingers.' + s] }));
    prims.push(roundBox(bonePt(rig, 'fingertips.' + s, 0, -0.022 * hb, -0.002), 0.0145 * hb, 0.026 * hb, 0.038 * hb, 0.0115 * hb, tB, { k: 0.008, mat: gl, bones: ['fingertips.' + s] }));
    for (const zz of [-0.021, 0.0, 0.021]) {
      prims.push(roundCone(bonePt(rig, 'fingers.' + s, sx * 0.0175 * hb, -0.004 * hb, zz * hb), bonePt(rig, 'fingertips.' + s, sx * 0.015 * hb, -0.05 * hb, zz * hb), 0.0022, 0.0022, { op: 'sub', k: 0.003 }));
    }
    // knuckles
    for (const zz of [-0.03, -0.01, 0.01, 0.03]) prims.push(sphere(bonePt(rig, 'fingers.' + s, sx * 0.01 * hb, 0.0, zz * hb), 0.0115 * hb, { k: 0.01, mat: o.knuckleMat ?? gl, bones: ['hand.' + s, 'fingers.' + s] }));
    // thumb
    const t0 = J['thumb.' + s], t1 = bonePt(rig, 'thumb.' + s, 0.004, -0.035 * hb, 0.006), t2 = bonePt(rig, 'thumb.' + s, 0.008, -0.062 * hb, 0.01);
    prims.push(roundCone(t0, t1, 0.0155 * hb, 0.0135 * hb, { k: 0.012, mat: gl, bones: ['thumb.' + s, 'hand.' + s] }));
    prims.push(roundCone(t1, t2, 0.0135 * hb, 0.011 * hb, { k: 0.01, mat: gl, bones: ['thumb.' + s] }));
  }
}

function buildFeet(J, rig, prims, o) {
  for (const s of ['L', 'R']) {
    const an = J['foot.' + s], ball = J['toe.' + s];
    const mat = o.footMat;
    const fdir = dirv(V(an.x, 0, an.z), V(ball.x, 0, ball.z));
    const soleB = basisFromY(V(0, 1, 0), fdir);
    const len = o.foot;
    // foot body from heel to toe
    const heel = V(an.x, 0.045, an.z - 0.055 * len), toe = V(ball.x, 0.03, ball.z + 0.06 * len);
    prims.push(roundCone(heel, lerp(heel, toe, 0.55), 0.046 * len, 0.04 * len, { k: 0.03, mat, bones: ['foot.' + s] }));
    prims.push(roundCone(lerp(heel, toe, 0.5), toe, 0.04 * len, 0.03 * len, { k: 0.03, mat, bones: ['foot.' + s, 'toe.' + s] }));
    prims.push(roundCone(add(an, 0, 0.02, 0), lerp(heel, toe, 0.35), 0.04 * len, 0.042 * len, { k: 0.03, mat, bones: ['foot.' + s, 'shin.' + s] }));
    if (o.sole) prims.push(roundBox(V((heel.x + toe.x) / 2, 0.013, (heel.z + toe.z) / 2), 0.05 * len, 0.013, 0.145 * len, 0.008, soleB, { k: 0.004, mat: o.soleMat ?? mat, bones: ['foot.' + s, 'toe.' + s] }));
    if (o.bootShaft) prims.push(roundCone(an, lerp(J['shin.' + s], an, o.bootShaft), 0.05 * len, 0.047 * len, { k: 0.015, mat, bones: ['shin.' + s] }));
  }
}

// Mesh parts: body at coarse resolution, head and hands finer; seams sit under collars/cuffs.
// Regions are signed functions (negative inside) intersected with the sculpt.
function standardParts(J, rig, o) {
  const neckCut = o.neckCut;
  const hands = ['L', 'R'].map((s) => {
    const w = lerp(J['forearm.' + s], J['hand.' + s], o.wristT);
    const d = dirv(J['forearm.' + s], J['hand.' + s]);
    const c = bonePt(rig, 'hand.' + s, 0, -0.07, 0);
    const R = 0.19;
    // inside = beyond the wrist plane and within R of the hand center
    const fn = (x, y, z) => Math.max(-((x - w.x) * d.x + (y - w.y) * d.y + (z - w.z) * d.z), Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2 + (z - c.z) ** 2) - R);
    return { s, w, c, R, fn };
  });
  const head = (x, y, z) => neckCut - y;
  const body = (x, y, z) => -Math.min(head(x, y, z), hands[0].fn(x, y, z), hands[1].fn(x, y, z));
  const parts = [
    { name: 'body', cell: o.body, bounds: [-0.85, -0.02, -0.35, 0.85, neckCut + 0.03, 0.35], region: body },
    { name: 'head', cell: o.head, bounds: [-0.34, neckCut - 0.02, -0.3, 0.34, J.head.y + o.headTop, 0.3], region: head },
  ];
  for (const h of hands) {
    parts.push({ name: 'hand' + h.s, cell: o.hand, bounds: [h.c.x - h.R, h.c.y - h.R, h.c.z - h.R, h.c.x + h.R, h.c.y + h.R, h.c.z + h.R], region: h.fn });
  }
  return parts;
}

// ==========================================================================================
// KAI — lean speed fighter: long dark coat (skirt simulated as cloth), red scarf, silver spiky hair
export const KAI = {
  name: 'kai',
  P: {
    hipH: 1.0, spineL: 0.1, chestL: 0.19, neckL: 0.225, headL: 0.095,
    clavX: 0.02, clavY: 0.19, shoulderX: 0.16,
    upperArmL: 0.31, forearmL: 0.265, palmL: 0.09, finger1L: 0.05, thumbX: 0.012, thumbY: 0.028,
    hipX: 0.095, thighL: 0.43, shinL: 0.41, ankleH: 0.07, footL: 0.13,
  },
  defaultBones: ['chest'],
  face: { w: 0.99, d: 0.98, jaw: 1.0, chin: 0.86, brow: 1.1, nose: 0.92 },
  iris: [0.32, 0.42, 0.48],
  sculpt(J, tips, rig) {
    const prims = [];
    const o = { bulk: 1.0, chest: 1.0, traps: 0.9, delt: 1.0, arm: 1.0, fore: 1.0, leg: 1.0, sleeveMat: M.CLOTH_A, legMat: M.CLOTH_B, torsoMat: M.CLOTH_A, hipMat: M.CLOTH_B };
    buildTorso(J, prims, o);
    buildLimbs(J, tips, rig, this.P, prims, o);
    // coat bulk: chest panel thickness and shoulders
    prims.push(ellipsoid(add(J.chest, 0, 0.02, 0.01), 0.165, 0.18, 0.122, null, { k: 0.04, mat: M.CLOTH_A, bones: ['chest', 'spine'] }));
    prims.push(ellipsoid(add(J.spine, 0, 0.0, 0.0), 0.142, 0.13, 0.108, null, { k: 0.05, mat: M.CLOTH_A, bones: ['spine', 'hips'] }));
    // belt
    prims.push(ellipsoid(add(J.hips, 0, 0.035, -0.002), 0.162, 0.021, 0.113, null, { k: 0.006, mat: M.GLOVE, bones: ['hips'] }));
    prims.push(roundBox(add(J.hips, 0, 0.035, 0.112), 0.028, 0.02, 0.006, 0.004, null, { k: 0.004, mat: M.METAL, bones: ['hips'] }));
    // high collar + scarf wrap
    prims.push(roundCone(add(J.neck, 0, -0.025, -0.01), add(J.neck, 0, 0.06, -0.005), 0.078, 0.07, { k: 0.02, mat: M.CLOTH_A, bones: ['neck', 'chest'], tag: 'collar' }));
    prims.push(torus(add(J.neck, 0, 0.005, 0.005), 0.07, 0.03, basisEuler(8, 0, 0), { k: 0.02, mat: M.ACCENT, bones: ['neck', 'chest'], tag: 'scarf' }));
    prims.push(torus(add(J.neck, 0, 0.045, 0.0), 0.062, 0.024, basisEuler(-6, 0, 0), { k: 0.015, mat: M.ACCENT, bones: ['neck'], tag: 'scarf' }));
    prims.push(ellipsoid(add(J.neck, -0.035, -0.01, 0.07), 0.035, 0.04, 0.025, null, { k: 0.02, mat: M.ACCENT, bones: ['neck', 'chest'], tag: 'scarf' }));
    // sleeve cuffs
    for (const s of ['L', 'R']) prims.push(roundCone(lerp(J['forearm.' + s], J['hand.' + s], 0.78), lerp(J['forearm.' + s], J['hand.' + s], 0.93), 0.036, 0.035, { k: 0.008, mat: M.CLOTH_A, bones: ['forearm.' + s] }));
    buildHead(J, prims, { face: this.face, neck: 1.0, brows: true });
    buildSpikyHair(J.head, prims, 7);
    // gloves with metal knuckle plates
    buildHands(J, rig, prims, { handMat: M.GLOVE, knuckleMat: M.METAL, hand: 1.0, wristMat: M.GLOVE });
    buildFeet(J, rig, prims, { footMat: M.BOOT, foot: 1.0, sole: true, soleMat: M.BOOT, bootShaft: 0.55 });
    return prims;
  },
  parts(J, rig) { return standardParts(J, rig, { neckCut: J.neck.y + 0.052, body: 0.0062, head: 0.003, hand: 0.003, wristT: 0.9, headTop: 0.36 }); },
  lodParts() { return [{ name: 'lod', cell: 0.016, bounds: [-0.75, -0.02, -0.3, 0.75, 2.05, 0.3], project: 1 }]; },
};

// ==========================================================================================
// GOU — 2.15 m brute: bare torso with magma veins, armored steel gauntlets, iron collar,
// baggy wrapped trousers, sash. Bald, heavy brow, broad jaw.
export const GOU = {
  name: 'gou',
  P: {
    hipH: 1.18, spineL: 0.125, chestL: 0.24, neckL: 0.255, headL: 0.1,
    clavX: 0.03, clavY: 0.225, shoulderX: 0.225,
    upperArmL: 0.37, forearmL: 0.325, palmL: 0.125, finger1L: 0.07, thumbX: 0.018, thumbY: 0.04,
    hipX: 0.13, thighL: 0.5, shinL: 0.5, ankleH: 0.085, footL: 0.16,
  },
  defaultBones: ['chest'],
  face: { w: 1.12, d: 1.02, jaw: 1.22, chin: 1.25, brow: 1.45, nose: 1.3, s: 1.14 },
  iris: [0.22, 0.14, 0.08],
  sculpt(J, tips, rig) {
    const prims = [];
    const o = { bulk: 1.42, chest: 1.12, traps: 1.7, delt: 1.25, arm: 1.3, fore: 1.25, leg: 1.12, sleeveMat: M.SKIN, legMat: M.CLOTH_A, torsoMat: M.SKIN, hipMat: M.CLOTH_A, forearmMat: M.METAL };
    buildTorso(J, prims, o);
    buildLimbs(J, tips, rig, this.P, prims, o);
    // abdominal wall: six-pack and serratus
    for (let r = 0; r < 3; r++) for (const sx of [1, -1]) {
      prims.push(ellipsoid(add(J.spine, sx * 0.042, 0.105 - r * 0.07, 0.12), 0.036, 0.03, 0.022, null, { k: 0.02, mat: M.SKIN, bones: ['spine', 'hips'] }));
    }
    for (let r = 0; r < 3; r++) for (const sx of [1, -1]) {
      prims.push(ellipsoid(add(J.chest, sx * (0.17 - r * 0.004), -0.03 - r * 0.045, 0.06 - r * 0.004), 0.022, 0.018, 0.03, basisEuler(0, sx * 30, sx * -25), { k: 0.02, mat: M.SKIN, bones: ['chest'] }));
    }
    // sash (thick cloth band) + knot
    prims.push(ellipsoid(add(J.hips, 0, 0.045, 0.0), 0.225, 0.055, 0.165, null, { k: 0.012, mat: M.CLOTH_B, bones: ['hips', 'spine'] }));
    prims.push(ellipsoid(add(J.hips, 0.09, 0.03, 0.15), 0.05, 0.045, 0.035, null, { k: 0.015, mat: M.CLOTH_B, bones: ['hips'] }));
    // iron collar (hides the head/body seam)
    prims.push(torus(add(J.neck, 0, 0.03, 0.01), 0.093, 0.028, basisEuler(10, 0, 0), { k: 0.008, mat: M.ACCENT, bones: ['neck', 'chest'] }));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      prims.push(sphere(add(J.neck, Math.sin(a) * 0.12, 0.03 + Math.cos(a) * 0.018, 0.01 + Math.cos(a) * 0.12), 0.011, { k: 0.004, mat: M.ACCENT, bones: ['neck', 'chest'] }));
    }
    buildHead(J, prims, { face: this.face, neck: 1.75, brows: true, stubble: true });
    // gauntlets: armored forearm shells with plate rings and a flared cuff
    for (const s of ['L', 'R']) {
      const fa = J['forearm.' + s], hd = J['hand.' + s];
      const faB = basisFromY(dirv(fa, hd), FWD);
      prims.push(roundCone(lerp(fa, hd, 0.12), lerp(fa, hd, 0.95), 0.084, 0.068, { k: 0.01, mat: M.METAL, bones: ['forearm.' + s] }));
      prims.push(torus(lerp(fa, hd, 0.12), 0.07, 0.016, faB, { k: 0.01, mat: M.METAL, bones: ['forearm.' + s, 'upperarm.' + s] }));
      for (const t of [0.35, 0.58, 0.8]) prims.push(torus(lerp(fa, hd, t), 0.072 - t * 0.014, 0.009, faB, { k: 0.006, mat: M.METAL, bones: ['forearm.' + s] }));
      // top ridge plate
      const top = new THREE.Vector3(side(s) * 0.7, 0, 0.7).applyMatrix3(faB).normalize();
      prims.push(roundCone(lerp(fa, hd, 0.2).addScaledVector(top, 0.055), lerp(fa, hd, 0.9).addScaledVector(top, 0.045), 0.025, 0.018, { k: 0.012, mat: M.METAL, bones: ['forearm.' + s] }));
    }
    buildHands(J, rig, prims, { handMat: M.METAL, knuckleMat: M.METAL, hand: 1.58, wristMat: M.METAL });
    // baggy trousers: loose volume around the thighs, gathered at the wraps
    for (const s of ['L', 'R']) {
      const th = J['thigh.' + s], kn = J['shin.' + s];
      prims.push(roundCone(lerp(th, kn, 0.05), lerp(th, kn, 0.95), 0.135, 0.095, { k: 0.04, mat: M.CLOTH_A, bones: ['thigh.' + s, 'hips'] }));
      prims.push(roundCone(kn, lerp(kn, J['foot.' + s], 0.38), 0.09, 0.075, { k: 0.04, mat: M.CLOTH_A, bones: ['shin.' + s] }));
    }
    // knuckle studs
    for (const s of ['L', 'R']) for (const zz of [-0.047, -0.016, 0.016, 0.047]) prims.push(roundCone(bonePt(rig, 'fingers.' + s, side(s) * 0.022, 0.0, zz), bonePt(rig, 'fingers.' + s, side(s) * 0.042, -0.004, zz), 0.014, 0.008, { k: 0.004, mat: M.METAL, bones: ['fingers.' + s] }));
    // shin wraps and wrapped feet
    for (const s of ['L', 'R']) {
      const kn = J['shin.' + s], an = J['foot.' + s];
      prims.push(roundCone(lerp(kn, an, 0.35), an, 0.07, 0.055, { k: 0.02, mat: M.CLOTH_B, bones: ['shin.' + s] }));
      for (const t of [0.45, 0.6, 0.75, 0.9]) prims.push(torus(lerp(kn, an, t), 0.066 - t * 0.012, 0.009, basisFromY(dirv(kn, an), FWD), { k: 0.01, mat: M.CLOTH_B, bones: ['shin.' + s] }));
    }
    buildFeet(J, rig, prims, { footMat: M.BOOT, foot: 1.25, sole: true, soleMat: M.BOOT });
    return prims;
  },
  parts(J, rig) { return standardParts(J, rig, { neckCut: J.neck.y + 0.052, body: 0.0072, head: 0.0032, hand: 0.0038, wristT: 0.9, headTop: 0.34 }); },
  lodParts() { return [{ name: 'lod', cell: 0.018, bounds: [-1.0, -0.02, -0.4, 1.0, 2.35, 0.4], project: 1 }]; },
};

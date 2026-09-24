// Humanoid skeleton. Bone offsets are defined in a neutral frame (all local rotations identity
// means: standing upright, facing +Z, arms hanging straight down, Y up, +X = character's left).
// The bind pose used for meshing is an A-pose (arms abducted) so the arm SDFs don't merge with the torso.
//
// Rotation conventions (degrees, Euler order ZXY => q = Rz * Rx * Ry):
//   spine/neck/head:  +X bend forward,  +Y turn left,  +Z lean right-side-down (toward -X... see below)
//   arms (hang -Y):   -X swing forward/up, +Z abduct left arm outward (mirror: -Z for right), Y twist
//   legs (hang -Y):   -X lift knee forward, +X swing leg back, Z abduct (L:+, R:-)
//   elbow: -X flex,   knee: +X flex,   foot: +X toes down (plantarflex)
import * as THREE from 'three';

export const BONES = [
  // name, parent, offset from parent (neutral), bind rotation (deg, ZXY)
  ['root', null, [0, 0, 0]],
  ['hips', 'root', [0, 'hipH', 0]],
  ['spine', 'hips', [0, 'spineL', -0.012]],
  ['chest', 'spine', [0, 'chestL', -0.01]],
  ['neck', 'chest', [0, 'neckL', 0.0]],
  ['head', 'neck', [0, 'headL', 0.018]],
  ['jaw', 'head', [0, 0.012, 0.035]],
  ['clavicle.L', 'chest', ['clavX', 'clavY', 0.035]],
  ['upperarm.L', 'clavicle.L', ['shoulderX', -0.015, -0.045]],
  ['forearm.L', 'upperarm.L', [0, '-upperArmL', 0]],
  ['hand.L', 'forearm.L', [0, '-forearmL', 0]],
  ['fingers.L', 'hand.L', [0, '-palmL', 0.012]],
  ['fingertips.L', 'fingers.L', [0, '-finger1L', 0]],
  ['thumb.L', 'hand.L', ['-thumbX', '-thumbY', 0.028]],
  ['clavicle.R', 'chest', ['-clavX', 'clavY', 0.035]],
  ['upperarm.R', 'clavicle.R', ['-shoulderX', -0.015, -0.045]],
  ['forearm.R', 'upperarm.R', [0, '-upperArmL', 0]],
  ['hand.R', 'forearm.R', [0, '-forearmL', 0]],
  ['fingers.R', 'hand.R', [0, '-palmL', 0.012]],
  ['fingertips.R', 'fingers.R', [0, '-finger1L', 0]],
  ['thumb.R', 'hand.R', ['thumbX', '-thumbY', 0.028]],
  ['thigh.L', 'hips', ['hipX', -0.06, 0.005]],
  ['shin.L', 'thigh.L', [0, '-thighL', 0.012]],
  ['foot.L', 'shin.L', [0, '-shinL', -0.018]],
  ['toe.L', 'foot.L', [0, '-ankleH', 'footL']],
  ['thigh.R', 'hips', ['-hipX', -0.06, 0.005]],
  ['shin.R', 'thigh.R', [0, '-thighL', 0.012]],
  ['foot.R', 'shin.R', [0, '-shinL', -0.018]],
  ['toe.R', 'foot.R', [0, '-ankleH', 'footL']],
];

// the "tip" end of each bone's segment (for distance-based skin weights), expressed as a child bone or explicit offset
export const TIPS = {
  root: null, hips: 'spine', spine: 'chest', chest: 'neck', neck: 'head', head: [0, 0.2, 0.02], jaw: [0, -0.02, 0.07],
  'clavicle.L': 'upperarm.L', 'upperarm.L': 'forearm.L', 'forearm.L': 'hand.L', 'hand.L': 'fingers.L', 'fingers.L': 'fingertips.L', 'fingertips.L': [0, -0.045, 0], 'thumb.L': [0.012, -0.05, 0.02],
  'clavicle.R': 'upperarm.R', 'upperarm.R': 'forearm.R', 'forearm.R': 'hand.R', 'hand.R': 'fingers.R', 'fingers.R': 'fingertips.R', 'fingertips.R': [0, -0.045, 0], 'thumb.R': [-0.012, -0.05, 0.02],
  'thigh.L': 'shin.L', 'shin.L': 'foot.L', 'foot.L': 'toe.L', 'toe.L': [0, -0.01, 0.07],
  'thigh.R': 'shin.R', 'shin.R': 'foot.R', 'foot.R': 'toe.R', 'toe.R': [0, -0.01, 0.07],
};

// Bind (A-)pose, [x, y, z] degrees applied in ZXY order like every pose array in the project.
export const BIND_POSE = {
  'upperarm.L': [-6, 0, 44], 'upperarm.R': [-6, 0, -44],
  'forearm.L': [-12, 0, 0], 'forearm.R': [-12, 0, 0],
  'thigh.L': [0, 0, 5], 'thigh.R': [0, 0, -5],
  'thumb.L': [-30, 0, 0], 'thumb.R': [-30, 0, 0],
};

const DEG = Math.PI / 180;
const _e = new THREE.Euler();
export function quatFromDeg(x, y, z, out = new THREE.Quaternion()) {
  _e.set(x * DEG, y * DEG, z * DEG, 'ZXY');
  return out.setFromEuler(_e);
}
// Pose arrays are [x, y, z] degrees applied in ZXY order.
export function quatXYZ(a, out = new THREE.Quaternion()) { return quatFromDeg(a[0], a[1], a[2], out); }

export function resolveOffset(off, P) {
  return off.map((v) => {
    if (typeof v === 'number') return v;
    const neg = v.startsWith('-');
    const val = P[neg ? v.slice(1) : v];
    if (val === undefined) throw new Error('missing proportion ' + v);
    return neg ? -val : val;
  });
}

// Build THREE bones in the bind pose. Returns { bones, byName, index }
export function buildBones(P) {
  const bones = [], byName = {}, index = {};
  for (const [name, parent, off] of BONES) {
    const b = new THREE.Bone();
    b.name = name;
    const o = resolveOffset(off, P);
    b.position.set(o[0], o[1], o[2]);
    const bp = BIND_POSE[name];
    if (bp) quatXYZ(bp, b.quaternion);
    if (parent) byName[parent].add(b);
    index[name] = bones.length;
    bones.push(b);
    byName[name] = b;
  }
  bones[0].updateMatrixWorld(true);
  return { bones, byName, index };
}

// World-space joint positions and tips for the bind pose (used by the sculptor and skin weighting).
export function bindJoints(rig) {
  const J = {};
  const v = new THREE.Vector3();
  for (const b of rig.bones) J[b.name] = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
  const tips = {};
  for (const b of rig.bones) {
    const t = TIPS[b.name];
    if (t === null || t === undefined) { tips[b.name] = J[b.name].clone().add(new THREE.Vector3(0, 0.05, 0)); continue; }
    if (typeof t === 'string') tips[b.name] = J[t].clone();
    else tips[b.name] = v.set(t[0], t[1], t[2]).applyMatrix4(b.matrixWorld).clone();
  }
  return { J, tips };
}

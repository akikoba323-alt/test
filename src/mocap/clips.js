// Runtime mocap clip library: decodes the baked clip bundle and samples poses.
// A pose is a set of rig-local quaternions for BONES plus the hips position in clip space
// (leg-length units, clip starts at the origin facing +Z) and foot contact flags.
import * as THREE from 'three';
import { BONES, CLIPS, DATA } from './clipdata.js';

export { BONES as MOCAP_BONES };
const NB = BONES.length;
const MIRROR_IDX = BONES.map((b) => BONES.indexOf(b.endsWith('.L') ? b.slice(0, -2) + '.R' : b.endsWith('.R') ? b.slice(0, -2) + '.L' : b));

let Q = null, P = null, C = null;
const byName = {};
function decode(b64, Type) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Type(u8.buffer);
}
export function clipLib() {
  if (!Q) {
    Q = decode(DATA.q, Int16Array); P = decode(DATA.p, Float32Array); C = decode(DATA.c, Uint8Array);
    for (const m of CLIPS) byName[m.name] = m;
  }
  return byName;
}
export function getClip(name) {
  const c = clipLib()[name];
  if (!c) throw new Error('unknown clip ' + name);
  return c;
}

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function readQ(clip, f, k, out) {
  const o = clip.oq + (f * NB + k) * 4;
  return out.set(Q[o] / 32767, Q[o + 1] / 32767, Q[o + 2] / 32767, Q[o + 3] / 32767);
}

export function makePose() {
  return { q: BONES.map(() => new THREE.Quaternion()), pos: new THREE.Vector3(), contact: 0 };
}

// Sample a clip at clip time t (seconds, clamped to the clip). mirror swaps sides.
export function sampleClip(clip, t, out, mirror = false) {
  const ft = Math.min(Math.max(t, 0), clip.dur) * clip.fps;
  const f0 = Math.min(clip.n - 1, Math.floor(ft)), f1 = Math.min(clip.n - 1, f0 + 1), u = ft - f0;
  for (let k = 0; k < NB; k++) {
    readQ(clip, f0, k, _qa);
    readQ(clip, f1, k, _qb);
    const dst = out.q[mirror ? MIRROR_IDX[k] : k];
    dst.copy(_qa).slerp(_qb, u).normalize();
    if (mirror) { dst.y = -dst.y; dst.z = -dst.z; }
  }
  const p0 = clip.op + f0 * 3, p1 = clip.op + f1 * 3;
  out.pos.set(P[p0] + (P[p1] - P[p0]) * u, P[p0 + 1] + (P[p1 + 1] - P[p0 + 1]) * u, P[p0 + 2] + (P[p1 + 2] - P[p0 + 2]) * u);
  if (mirror) out.pos.x = -out.pos.x;
  const c = C[clip.oc + (u < 0.5 ? f0 : f1)];
  out.contact = mirror ? ((c & 1) << 1) | ((c >> 1) & 1) : c;
  return out;
}

// heading (radians about +Y) of the hips at clip time t
export function clipHeading(clip, t, mirror = false) {
  const pose = sampleClip(clip, t, _tmpPose, mirror);
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(pose.q[0]);
  return Math.atan2(f.x, f.z);
}
const _tmpPose = makePose();

// events with mirrored limb names
export function clipEvents(clip, mirror = false) {
  const sw = { LH: 'RH', RH: 'LH', LF: 'RF', RF: 'LF' };
  return clip.events.map((e) => (mirror ? { ...e, limb: sw[e.limb] } : e));
}

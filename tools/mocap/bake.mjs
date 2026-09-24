// Mocap baking: CMU BVH segments -> clips on the project rig.
//   node tools/mocap/bake.mjs <rawDir> <spec.json> <out.js>
// Retargeting: for every mapped bone the world-space rotation delta from the source T-pose
// (frame 0 of the cgspeed conversion, facing +Z) is applied to the rig's own T-pose, then
// converted to rig-local rotations. Arm swing is corrected for the source T-pose's 8° droop.
// Root motion is normalised so each clip starts at the origin facing +Z; hips positions are
// stored in leg-length units (scaled per character at runtime). Also stores foot contacts
// and detected strike events.
import fs from 'node:fs';
import * as THREE from 'three';
import { parseBVH, fkFrame } from './bvh.mjs';

export const RIG_BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'clavicle.L', 'upperarm.L', 'forearm.L', 'hand.L', 'clavicle.R', 'upperarm.R', 'forearm.R', 'hand.R',
  'thigh.L', 'shin.L', 'foot.L', 'toe.L', 'thigh.R', 'shin.R', 'foot.R', 'toe.R'];
const PARENT = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', 'clavicle.L': 'chest', 'upperarm.L': 'clavicle.L', 'forearm.L': 'upperarm.L', 'hand.L': 'forearm.L',
  'clavicle.R': 'chest', 'upperarm.R': 'clavicle.R', 'forearm.R': 'upperarm.R', 'hand.R': 'forearm.R', 'thigh.L': 'hips', 'shin.L': 'thigh.L', 'foot.L': 'shin.L', 'toe.L': 'foot.L',
  'thigh.R': 'hips', 'shin.R': 'thigh.R', 'foot.R': 'shin.R', 'toe.R': 'foot.R' };
const SRC = { hips: 'Hips', spine: 'Spine', chest: 'Spine1', neck: 'Neck1', head: 'Head', 'clavicle.L': 'LeftShoulder', 'upperarm.L': 'LeftArm', 'forearm.L': 'LeftForeArm', 'hand.L': 'LeftHand',
  'clavicle.R': 'RightShoulder', 'upperarm.R': 'RightArm', 'forearm.R': 'RightForeArm', 'hand.R': 'RightHand', 'thigh.L': 'LeftUpLeg', 'shin.L': 'LeftLeg', 'foot.L': 'LeftFoot', 'toe.L': 'LeftToeBase',
  'thigh.R': 'RightUpLeg', 'shin.R': 'RightLeg', 'foot.R': 'RightFoot', 'toe.R': 'RightToeBase' };
// child joint used to measure a bone's direction (for swing correction of the source T-pose)
const DIRCHILD = { 'upperarm.L': ['LeftForeArm', [1, 0, 0]], 'forearm.L': ['LeftHand', [1, 0, 0]], 'upperarm.R': ['RightForeArm', [-1, 0, 0]], 'forearm.R': ['RightHand', [-1, 0, 0]],
  'thigh.L': ['LeftLeg', [0, -1, 0]], 'shin.L': ['LeftFoot', [0, -1, 0]], 'thigh.R': ['RightLeg', [0, -1, 0]], 'shin.R': ['RightFoot', [0, -1, 0]] };
const Z90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const Zm90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
const RIG_T = Object.fromEntries(RIG_BONES.map((b) => [b, b.endsWith('.L') && /arm|hand/.test(b) ? Z90.clone() : b.endsWith('.R') && /arm|hand/.test(b) ? Zm90.clone() : new THREE.Quaternion()]));

function heading(q) { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); return Math.atan2(f.x, f.z); }

export function bakeClip(bvh, spec) {
  const Q = [], P = [];
  const J = (n) => bvh.byName[n].index;
  // source T-pose (frame 0) with swing correction
  fkFrame(bvh, 0, Q, P);
  const srcT = {};
  for (const b of RIG_BONES) {
    const q = Q[J(SRC[b])].clone();
    const dc = DIRCHILD[b];
    if (dc) {
      const d = P[J(dc[0])].clone().sub(P[J(SRC[b])]).normalize();
      const fix = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(...dc[1]));
      q.premultiply(fix);
    }
    srcT[b] = q.invert();
  }
  const off = (n) => bvh.byName[n].offset;
  const len = (o) => Math.hypot(o[0], o[1], o[2]);
  const leg = len(off('LeftLeg')) + len(off('LeftFoot'));
  // floor: low percentile of toe/foot heights over the whole take
  const lows = [];
  for (let f = 1; f < bvh.nFrames; f += 4) { fkFrame(bvh, f, Q, P); lows.push(Math.min(P[J('LeftToeBase')].y, P[J('RightToeBase')].y, P[J('LeftFoot')].y, P[J('RightFoot')].y)); }
  lows.sort((a, b) => a - b);
  const floorY = lows[Math.floor(lows.length * 0.02)] - 0.35; // toe joint sits ~2 cm above the sole
  // straight-legged standing height of the hips above the sole (geometry, not the T-pose frame,
  // which cgspeed placed at the first frame's hips height)
  const standY = (Math.abs(off('LeftUpLeg')[1]) + leg + Math.abs(off('LeftToeBase')[1]) + 0.35) / leg;
  const fps = spec.fps ?? 60;
  const srcFps = 1 / bvh.dt;
  const f0 = Math.max(1, Math.round(spec.from * srcFps)), f1 = Math.min(bvh.nFrames - 1, Math.round((spec.to ?? bvh.nFrames * bvh.dt) * srcFps));
  const n = Math.max(2, Math.floor((f1 - f0) / srcFps * fps) + 1);
  const quats = new Int16Array(n * RIG_BONES.length * 4);
  const pos = new Float32Array(n * 3);
  const contact = new Uint8Array(n);
  const prevQ = RIG_BONES.map(() => null);
  let h0 = 0, o0 = null;
  const W = {}, Wq = new THREE.Quaternion(), L = new THREE.Quaternion();
  const feetPrev = [null, null];
  const ee = [];
  for (let i = 0; i < n; i++) {
    const sf = Math.min(f1, f0 + Math.round(i / fps * srcFps));
    fkFrame(bvh, sf, Q, P);
    const hp = P[J('Hips')];
    if (i === 0) { h0 = heading(Q[J('Hips')].clone().multiply(srcT.hips)); o0 = hp.clone(); }
    const yawFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -h0);
    for (const b of RIG_BONES) {
      // world delta from the T-pose, re-expressed in the heading-normalised clip frame
      const D = Q[J(SRC[b])].clone().multiply(srcT[b]);
      D.premultiply(yawFix);
      W[b] = D.multiply(RIG_T[b]);
    }
    RIG_BONES.forEach((b, k) => {
      const p = PARENT[b];
      L.copy(W[b]);
      if (p) L.premultiply(Wq.copy(W[p]).invert());
      if (prevQ[k] && prevQ[k].dot(L) < 0) L.set(-L.x, -L.y, -L.z, -L.w);
      prevQ[k] = L.clone();
      const o = (i * RIG_BONES.length + k) * 4;
      quats[o] = Math.round(L.x * 32767); quats[o + 1] = Math.round(L.y * 32767); quats[o + 2] = Math.round(L.z * 32767); quats[o + 3] = Math.round(L.w * 32767);
    });
    const rel = hp.clone().sub(o0).applyQuaternion(yawFix);
    pos[i * 3] = rel.x / leg; pos[i * 3 + 1] = (hp.y - floorY) / leg; pos[i * 3 + 2] = rel.z / leg;
    // foot contacts: low and slow
    let c = 0;
    [['LeftFoot', 'LeftToeBase'], ['RightFoot', 'RightToeBase']].forEach(([fa, ta], s) => {
      const fy = (P[J(fa)].y - floorY) / leg, ty = (P[J(ta)].y - floorY) / leg;
      const fp = P[J(ta)].clone().applyQuaternion(yawFix).divideScalar(leg);
      const v = feetPrev[s] ? fp.distanceTo(feetPrev[s]) * fps : 0;
      feetPrev[s] = fp;
      if (Math.min(fy - 0.07, ty) < 0.06 && v < 0.5) c |= 1 << s;
    });
    contact[i] = c;
    ee.push(['LeftHand', 'RightHand', 'LeftToeBase', 'RightToeBase'].map((nm) => P[J(nm)].clone().sub(hp).applyQuaternion(yawFix).divideScalar(leg)));
  }
  // strike events: end-effector speed peaks (relative to hips) followed by an extension maximum
  const events = [];
  const names = ['LH', 'RH', 'LF', 'RF'];
  for (let k = 0; k < 4; k++) {
    const sp = ee.map((e, i) => (i === 0 || i === n - 1 ? 0 : ee[i + 1][k].distanceTo(ee[i - 1][k]) * fps / 2));
    for (let i = 3; i < n - 3; i++) {
      if (sp[i] < 3.6 || sp[i] < sp[i - 1] || sp[i] < sp[i + 1] || sp[i] < sp[i - 3] || sp[i] < sp[i + 3]) continue;
      let best = i, bd = 0;
      for (let m = i; m < Math.min(n, i + Math.round(fps * 0.15)); m++) { const d = ee[m][k].length(); if (d > bd) { bd = d; best = m; } }
      events.push({ limb: names[k], peak: +(i / fps).toFixed(3), t: +(best / fps).toFixed(3), reach: +bd.toFixed(2), speed: +sp[i].toFixed(1) });
    }
  }
  events.sort((a, b) => a.t - b.t);
  const last = n - 1;
  fkFrame(bvh, Math.min(f1, f0 + Math.round(last / fps * srcFps)), Q, P);
  const hEnd = heading(Q[J('Hips')].clone().multiply(srcT.hips)) - h0;
  return {
    meta: { name: spec.name, src: spec.src, from: spec.from, to: spec.to, fps, n, standY: +standY.toFixed(4), dur: +((n - 1) / fps).toFixed(4), events, endPos: [+pos[last * 3].toFixed(4), +pos[last * 3 + 2].toFixed(4)], endYaw: +(((hEnd + Math.PI * 3) % (Math.PI * 2)) - Math.PI).toFixed(4), notes: spec.notes || '' },
    quats, pos, contact,
  };
}

// --------------------------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith('bake.mjs')) {
  const [rawDir, specPath, outPath] = process.argv.slice(2);
  const specs = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const cache = {};
  const metas = [], chunks = [];
  let offQ = 0, offP = 0, offC = 0;
  for (const spec of specs) {
    const bvh = cache[spec.src] || (cache[spec.src] = parseBVH(fs.readFileSync(`${rawDir}/${spec.src}.bvh`, 'utf8')));
    const c = bakeClip(bvh, spec);
    c.meta.oq = offQ; c.meta.op = offP; c.meta.oc = offC;
    offQ += c.quats.length; offP += c.pos.length; offC += c.contact.length;
    metas.push(c.meta);
    chunks.push(c);
    console.log(spec.name.padEnd(16), spec.src, `${c.meta.dur}s`, 'end', c.meta.endPos.map((v) => v.toFixed(2)).join(','), (c.meta.endYaw * 180 / Math.PI).toFixed(0) + '°', 'ev', c.meta.events.map((e) => `${e.limb}@${e.t}`).join(' '));
  }
  const q = new Int16Array(offQ), p = new Float32Array(offP), ct = new Uint8Array(offC);
  for (const c of chunks) { q.set(c.quats, c.meta.oq); p.set(c.pos, c.meta.op); ct.set(c.contact, c.meta.oc); }
  const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  const js = `// Generated by tools/mocap/bake.mjs from the CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), BVH conversion by B. Hahne.
export const BONES = ${JSON.stringify(RIG_BONES)};
export const CLIPS = ${JSON.stringify(metas)};
export const DATA = { q: '${b64(q)}', p: '${b64(p)}', c: '${b64(ct)}' };
`;
  fs.writeFileSync(outPath, js);
  console.log('wrote', outPath, (js.length / 1024).toFixed(0) + ' KB', metas.length, 'clips');
}

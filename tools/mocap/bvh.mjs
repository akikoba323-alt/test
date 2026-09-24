// BVH parsing and forward kinematics (Node side, three.js math).
import * as THREE from 'three';

export function parseBVH(text) {
  const tok = text.split(/\s+/).filter(Boolean);
  let i = 0;
  const joints = [];
  const next = () => tok[i++];
  const expect = (s) => { const t = next(); if (t !== s) throw new Error(`BVH: expected ${s} got ${t} at ${i}`); };
  function parseJoint(parent, isEnd) {
    const name = isEnd ? (parent.name + '_end') : next();
    expect('{');
    const j = { name, parent: parent ? parent.index : -1, offset: [0, 0, 0], channels: [], children: [], end: !!isEnd, index: joints.length };
    joints.push(j);
    if (parent) parent.children.push(j.index);
    for (;;) {
      const t = next();
      if (t === 'OFFSET') j.offset = [+next(), +next(), +next()];
      else if (t === 'CHANNELS') { const n = +next(); for (let k = 0; k < n; k++) j.channels.push(next()); }
      else if (t === 'JOINT') parseJoint(j, false);
      else if (t === 'End') { expect('Site'); parseJoint(j, true); }
      else if (t === '}') break;
      else throw new Error('BVH: unexpected ' + t);
    }
    return j;
  }
  expect('HIERARCHY');
  expect('ROOT');
  parseJoint(null, false);
  expect('MOTION');
  expect('Frames:');
  const nFrames = +next();
  expect('Frame');
  expect('Time:');
  const dt = +next();
  let nch = 0;
  for (const j of joints) { j.chOff = nch; nch += j.channels.length; }
  const data = new Float32Array(nFrames * nch);
  for (let f = 0; f < nFrames * nch; f++) data[f] = +tok[i++];
  return { joints, nFrames, dt, nch, data, byName: Object.fromEntries(joints.map((j) => [j.name, j])) };
}

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), DEG = Math.PI / 180;
const AX = { Xrotation: new THREE.Vector3(1, 0, 0), Yrotation: new THREE.Vector3(0, 1, 0), Zrotation: new THREE.Vector3(0, 0, 1) };

// world rotation + position of every joint at frame f
export function fkFrame(bvh, f, outQ, outP) {
  const { joints, data, nch } = bvh;
  const base = f * nch;
  for (const j of joints) {
    const lq = new THREE.Quaternion();
    const lp = new THREE.Vector3(...j.offset);
    let k = base + j.chOff;
    for (const c of j.channels) {
      const v = data[k++];
      if (c === 'Xposition') lp.x = v; else if (c === 'Yposition') lp.y = v; else if (c === 'Zposition') lp.z = v;
      else { _q.setFromAxisAngle(AX[c], v * DEG); lq.multiply(_q); }
    }
    if (j.channels.includes('Xposition')) lp.add(new THREE.Vector3(...j.offset));
    if (j.parent < 0) { outQ[j.index] = lq; outP[j.index] = lp; }
    else {
      const pq = outQ[j.parent], pp = outP[j.parent];
      outP[j.index] = lp.applyQuaternion(pq).add(pp);
      outQ[j.index] = pq.clone().multiply(lq);
    }
  }
}

// Animation core: sparse per-channel keyframe tracks, analytic two-bone IK, a procedural
// foot-planting controller, look-at, spring-driven overlap / hit reactions, and bone velocities.
import * as THREE from 'three';
import { easeFn, clamp, clamp01, Spring3, DEG, smoothstep } from '../core/math.js';
import { quatXYZ } from './skeleton.js';

// ------------------------------------------------------------------------------------------
// Track: channel -> sorted keys {t, v, e}. Numbers and arrays interpolate (eased by the
// destination key), strings/objects step. Arrays flagged smooth use Catmull-Rom.
const SMOOTH = new Set(['pos', 'ikHandL', 'ikHandR', 'ikFootL', 'ikFootR']);
export class Track {
  constructor() { this.ch = new Map(); this.dirty = false; }
  key(t, values, ease = 'inOutQuad') {
    for (const name in values) {
      let c = this.ch.get(name);
      if (!c) { c = []; this.ch.set(name, c); }
      c.push({ t, v: values[name], e: easeFn(ease), en: ease });
    }
    this.dirty = true;
    return this;
  }
  finalize() {
    for (const c of this.ch.values()) c.sort((a, b) => a.t - b.t);
    this.dirty = false;
  }
  // last key time of channel
  end(name) { const c = this.ch.get(name); return c && c.length ? c[c.length - 1].t : 0; }
  sample(t, out) {
    if (this.dirty) this.finalize();
    for (const [name, c] of this.ch) out[name] = sampleChannel(c, t, SMOOTH.has(name), out[name]);
    return out;
  }
  sampleOne(name, t) {
    if (this.dirty) this.finalize();
    const c = this.ch.get(name);
    return c ? sampleChannel(c, t, SMOOTH.has(name), undefined) : undefined;
  }
}

function findKey(c, t) {
  // index of last key with key.t <= t
  let lo = 0, hi = c.length - 1;
  if (t < c[0].t) return -1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c[m].t <= t) lo = m; else hi = m - 1; }
  return lo;
}

function sampleChannel(c, t, smooth, prevOut) {
  const i = findKey(c, t);
  if (i < 0) return clone(c[0].v, prevOut);
  if (i >= c.length - 1) return clone(c[c.length - 1].v, prevOut);
  const a = c[i], b = c[i + 1];
  const v0 = a.v, v1 = b.v;
  if (typeof v0 === 'string' || typeof v0 === 'boolean' || (v0 && typeof v0 === 'object' && !Array.isArray(v0))) return v0;
  const u = b.t > a.t ? b.e(clamp01((t - a.t) / (b.t - a.t))) : 1;
  if (typeof v0 === 'number') return v0 + (v1 - v0) * u;
  const out = Array.isArray(prevOut) && prevOut.length === v0.length ? prevOut : new Array(v0.length);
  if (smooth && c.length > 2) {
    const p0 = c[Math.max(0, i - 1)].v, p3 = c[Math.min(c.length - 1, i + 2)].v;
    const u2 = u * u, u3 = u2 * u;
    for (let k = 0; k < v0.length; k++) {
      out[k] = 0.5 * (2 * v0[k] + (-p0[k] + v1[k]) * u + (2 * p0[k] - 5 * v0[k] + 4 * v1[k] - p3[k]) * u2 + (-p0[k] + 3 * v0[k] - 3 * v1[k] + p3[k]) * u3);
    }
    return out;
  }
  for (let k = 0; k < v0.length; k++) out[k] = v0[k] + (v1[k] - v0[k]) * u;
  return out;
}
function clone(v, prev) {
  if (Array.isArray(v)) { const o = Array.isArray(prev) && prev.length === v.length ? prev : new Array(v.length); for (let k = 0; k < v.length; k++) o[k] = v[k]; return o; }
  return v;
}

// ------------------------------------------------------------------------------------------
// Two-bone IK
const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _E = new THREE.Vector3(), _x = new THREE.Vector3();
const _yw = new THREE.Vector3(), _xw = new THREE.Vector3(), _zw = new THREE.Vector3();
const _yl = new THREE.Vector3(), _xl = new THREE.Vector3(), _zl = new THREE.Vector3();
const _m = new THREE.Matrix4(), _ml = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qp = new THREE.Quaternion();

// world rotation that maps a bone's local child-offset direction onto `dir`, with local X onto `xAxis`
function frameRotation(offLocal, dir, xAxis, out) {
  _yl.copy(offLocal).normalize();
  _xl.set(1, 0, 0).addScaledVector(_yl, -_yl.x).normalize();
  _zl.crossVectors(_xl, _yl);
  _yw.copy(dir).normalize();
  _xw.copy(xAxis).addScaledVector(_yw, -xAxis.dot(_yw));
  if (_xw.lengthSq() < 1e-8) _xw.set(1, 0, 0).addScaledVector(_yw, -_yw.x);
  _xw.normalize();
  _zw.crossVectors(_xw, _yw);
  _m.makeBasis(_xw, _yw, _zw);
  _ml.makeBasis(_xl, _yl, _zl).transpose();
  _m.multiply(_ml);
  return out.setFromRotationMatrix(_m);
}

function setWorldQuat(bone, qWorld) {
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(qWorld));
  bone.updateMatrixWorld(true);
}

// Solve upper/lower bones so the end joint reaches `target`; pole = world direction the middle joint bends toward.
// isLeg selects the flexion sign (knees bend back, elbows forward).
export function solveTwoBone(upper, lower, end, target, pole, isLeg, weight = 1) {
  const S = upper.getWorldPosition(new THREE.Vector3());
  const a = lower.position.length(), b = end.position.length();
  _u.copy(target).sub(S);
  let d = _u.length();
  if (d < 1e-5) return;
  _u.divideScalar(d);
  d = clamp(d, Math.abs(a - b) + 1e-4, a + b - 1e-4);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  _v.copy(pole).addScaledVector(_u, -pole.dot(_u));
  if (_v.lengthSq() < 1e-8) _v.set(0, 0, 1).addScaledVector(_u, -_u.z);
  _v.normalize();
  _E.copy(S).addScaledVector(_u, a * cosA).addScaledVector(_v, a * sinA);
  _x.crossVectors(_u, _v).multiplyScalar(isLeg ? -1 : 1);
  const T = _u.clone().multiplyScalar(d).add(S);
  const qU = frameRotation(lower.position, _E.clone().sub(S), _x, new THREE.Quaternion());
  const qL = frameRotation(end.position, T.sub(_E), _x, new THREE.Quaternion());
  if (weight < 1) {
    const cu = upper.getWorldQuaternion(new THREE.Quaternion());
    qU.slerpQuaternions(cu, qU, weight);
  }
  setWorldQuat(upper, qU);
  if (weight < 1) {
    const cl = lower.getWorldQuaternion(new THREE.Quaternion());
    qL.slerpQuaternions(cl, qL, weight);
  }
  setWorldQuat(lower, qL);
}

// ------------------------------------------------------------------------------------------
const BODY_BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'jaw', 'clavicle.L', 'clavicle.R', 'upperarm.L', 'upperarm.R', 'forearm.L', 'forearm.R', 'hand.L', 'hand.R', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'foot.L', 'foot.R', 'toe.L', 'toe.R'];
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();

export class Animator {
  constructor(fighter) {
    this.f = fighter;
    this.track = new Track();
    this.ch = {};
    this.opponent = null;
    const J = fighter.joints.J;
    this.hipH = J.hips.y;
    this.ankleH = J['foot.L'].y;
    this.restHips = fighter.bone.hips.position.clone();
    this.feet = {
      L: { pos: new THREE.Vector3(), planted: true, stepping: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t0: 0, dur: 0.2, lift: 0.06, yaw: 0, fromYaw: 0, toYaw: 0, init: false },
      R: { pos: new THREE.Vector3(), planted: true, stepping: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t0: 0, dur: 0.2, lift: 0.06, yaw: 0, fromYaw: 0, toYaw: 0, init: false },
    };
    this.springs = { hips: new Spring3(3.2, 0.45), spine: new Spring3(3.6, 0.4), chest: new Spring3(4.0, 0.38), head: new Spring3(5.0, 0.35) };
    this.bonePos = {};
    this.boneVel = {};
    this.prevPos = {};
    for (const b of fighter.rig.bones) { this.bonePos[b.name] = new THREE.Vector3(); this.boneVel[b.name] = new THREE.Vector3(); this.prevPos[b.name] = new THREE.Vector3(); }
    this.events = []; // footfalls etc. {type, t, pos}
    this.rootQuat = new THREE.Quaternion();
    this.rootPos = new THREE.Vector3();
    this.lastT = null;
  }

  reset() {
    for (const k in this.springs) this.springs[k].reset();
    for (const s of ['L', 'R']) Object.assign(this.feet[s], { planted: true, stepping: false, init: false });
    this.lastT = null;
    this.events.length = 0;
  }

  impulse(part, x, y, z) { const s = this.springs[part]; if (s) s.impulse(x, y, z); }

  // root-space -> world
  toWorld(p, out) {
    return out.set(p[0], p[1], p[2]).applyQuaternion(this.yawQuat).add(this.groundPos);
  }

  evaluate(t, dt) {
    const f = this.f, B = f.bone, ch = this.ch;
    this.track.sample(t, ch);
    const pos = ch.pos || [0, 0, 0];
    const yaw = (ch.yaw ?? 0) * DEG, tilt = ch.tilt || [0, 0];
    const floor = ch.floor ?? 0;
    this.yawQuat = this.yawQuat || new THREE.Quaternion();
    this.yawQuat.setFromAxisAngle(tmpV.set(0, 1, 0), yaw);
    this.groundPos = this.groundPos || new THREE.Vector3();
    this.groundPos.set(pos[0], floor, pos[2]);
    // root: yaw * pitch * roll, pivoting around the pelvis
    tmpE.set(tilt[0] * DEG, yaw, tilt[1] * DEG, 'YXZ');
    this.rootQuat.setFromEuler(tmpE);
    const pivot = tmpV2.set(0, this.hipH, 0);
    const rotated = pivot.clone().applyQuaternion(this.rootQuat);
    B.root.position.set(pos[0], pos[1], pos[2]).add(pivot).sub(rotated);
    B.root.quaternion.copy(this.rootQuat);
    this.rootPos.copy(B.root.position);

    // accel-driven overlap
    if (dt > 0 && this.lastT !== null) {
      const h = 1 / 120;
      const p0 = this.track.sampleOne('pos', t - h), p2 = this.track.sampleOne('pos', t + h);
      if (p0 && p2) {
        const ax = (p2[0] - 2 * pos[0] + p0[0]) / (h * h), az = (p2[2] - 2 * pos[2] + p0[2]) / (h * h), ay = (p2[1] - 2 * pos[1] + p0[1]) / (h * h);
        // into root space
        const cy = Math.cos(-yaw), sy = Math.sin(-yaw);
        const lx = ax * cy + az * sy, lz = -ax * sy + az * cy;
        const k = clamp(dt, 0, 1 / 30) * (ch.overlap ?? 1);
        const cl = (v) => clamp(v, -400, 400);
        this.springs.chest.impulse(cl(-lz) * 0.9 * k * 60, 0, cl(lx) * 0.6 * k * 60);
        this.springs.head.impulse(cl(-lz) * 1.2 * k * 60, 0, cl(lx) * 0.9 * k * 60);
        this.springs.spine.impulse(cl(-lz) * 0.5 * k * 60 + cl(-ay) * 0.08 * k * 60, 0, 0);
      }
    }
    if (dt > 0) for (const k in this.springs) {
      const s = this.springs[k];
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      for (let i = 0; i < n; i++) s.step(dt / n);
      for (let i = 0; i < 3; i++) s.x[i] = clamp(s.x[i], -60, 60);
    }

    // FK
    for (const name of BODY_BONES) {
      const v = ch[name];
      if (v) quatXYZ(v, B[name].quaternion); else B[name].quaternion.identity();
    }
    const sp = this.springs;
    const addRot = (bone, s, scale = 1) => { if (Math.abs(s.x[0]) + Math.abs(s.x[1]) + Math.abs(s.x[2]) < 1e-3) return; quatXYZ([s.x[0] * scale, s.x[1] * scale, s.x[2] * scale], tmpQ); bone.quaternion.multiply(tmpQ); };
    addRot(B.hips, sp.hips); addRot(B.spine, sp.spine); addRot(B.chest, sp.chest); addRot(B.neck, sp.head, 0.4); addRot(B.head, sp.head, 0.6);
    const ho = ch.hipOff || [0, 0, 0];
    B.hips.position.set(this.restHips.x + ho[0], this.restHips.y + ho[1] + (ch.hipY ?? 0), this.restHips.z + ho[2]);
    // fingers
    for (const s of ['L', 'R']) {
      const c = ch['fist' + s] ?? 1;
      const sx = s === 'L' ? 1 : -1;
      quatXYZ([-c * 85, 0, 0], B['fingers.' + s].quaternion);
      quatXYZ([-c * 95, 0, 0], B['fingertips.' + s].quaternion);
      quatXYZ([-30 - c * 25, 0, -sx * c * 30], B['thumb.' + s].quaternion);
    }
    quatXYZ([(ch.jaw ?? 0) * 22, 0, 0], B.jaw.quaternion);
    B.root.updateMatrixWorld(true);

    // look at the opponent
    const lookW = ch.look ?? 0;
    if (lookW > 0.001 && this.opponent) {
      const target = this.lookTarget(ch.lookAt, tmpV);
      this.lookAtTarget(target, lookW);
    }

    // arms IK
    for (const s of ['L', 'R']) {
      const w = ch['ikHand' + s + 'w'] ?? 0;
      if (w <= 0.001) continue;
      const p = ch['ikHand' + s] || [0, 1.2, 0.4];
      const target = this.toWorld(p, new THREE.Vector3());
      const aim = ch['aim' + s] ?? 0;
      if (aim > 0.001 && this.opponent) {
        const at = this.opponentPoint(ch['aimAt' + s] || 'head', new THREE.Vector3());
        target.lerp(at, aim);
      }
      const pl = ch['pole' + s] || [s === 'L' ? 0.6 : -0.6, -0.5, -0.8];
      const pole = new THREE.Vector3(pl[0], pl[1], pl[2]).applyQuaternion(this.rootQuat);
      solveTwoBone(B['upperarm.' + s], B['forearm.' + s], B['hand.' + s], target, pole, false, w);
    }

    // legs: foot controller + IK
    this.updateFeet(t, dt, ch);
    B.root.updateMatrixWorld(true);

    // bone world positions & velocities
    for (const b of f.rig.bones) {
      const p = this.bonePos[b.name];
      p.setFromMatrixPosition(b.matrixWorld);
      if (dt > 0 && this.lastT !== null) this.boneVel[b.name].copy(p).sub(this.prevPos[b.name]).divideScalar(dt);
      this.prevPos[b.name].copy(p);
    }
    this.lastT = t;
  }

  opponentPoint(name, out) {
    const o = this.opponent;
    const map = { head: 'head', chest: 'chest', gut: 'spine', jaw: 'jaw', hips: 'hips', knee: 'shin.L' };
    const bn = map[name] || name;
    out.copy(o.anim.bonePos[bn] || o.anim.bonePos.chest);
    if (name === 'head') out.y += 0.08;
    if (name === 'jaw') out.y -= 0.01;
    return out;
  }

  lookTarget(name, out) { return this.opponentPoint(name || 'head', out); }

  lookAtTarget(target, w) {
    const B = this.f.bone;
    for (const [bn, share] of [['neck', 0.4], ['head', 0.6]]) {
      const bone = B[bn];
      const bp = bone.getWorldPosition(new THREE.Vector3());
      const dir = target.clone().sub(bp).normalize();
      // current forward (+Z of bone)
      const q = bone.getWorldQuaternion(new THREE.Quaternion());
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const rot = new THREE.Quaternion().setFromUnitVectors(fwd, dir);
      // clamp the correction angle
      const ang = 2 * Math.acos(clamp(rot.w, -1, 1));
      const maxA = 70 * DEG;
      const k = ang > maxA ? maxA / ang : 1;
      const partial = new THREE.Quaternion().slerp(rot, share * w * k);
      const nq = partial.multiply(q);
      setWorldQuat(bone, nq);
    }
  }

  updateFeet(t, dt, ch) {
    const B = this.f.bone;
    const mode = ch.feet || 'plant';
    const floor = ch.floor ?? 0;
    const rootY = (ch.pos || [0, 0, 0])[1];
    const airborne = rootY > floor + 0.08 || mode === 'fk';
    for (const s of ['L', 'R']) {
      const F = this.feet[s];
      const st = ch['stance' + s] || [s === 'L' ? 0.12 : -0.12, 0, 0];
      const desired = this.toWorld([st[0], 0, st[2]], new THREE.Vector3());
      desired.y = floor + this.ankleH + (st[1] || 0);
      const desiredYaw = (ch.yaw ?? 0) * DEG + (ch['footYaw' + s] ?? (s === 'L' ? 12 : -12)) * DEG;
      const ikw = ch['ikFoot' + s + 'w'] ?? 0;
      if (!F.init) { F.pos.copy(desired); F.yaw = desiredYaw; F.init = true; F.planted = true; F.stepping = false; }
      if (airborne) {
        F.planted = false; F.stepping = false; F.pos.copy(desired);
        F.yaw = desiredYaw;
        if (ikw > 0.001) this.solveLeg(s, this.toWorld(ch['ikFoot' + s], new THREE.Vector3()), ikw, false);
        continue;
      }
      if (mode === 'slide') {
        const wasStill = F.pos.distanceTo(desired);
        F.pos.copy(desired); F.yaw = desiredYaw; F.planted = true; F.stepping = false;
        if (dt > 0 && wasStill > 0.002) this.events.push({ type: 'skid', t, side: s, pos: F.pos.clone(), speed: wasStill / dt });
      } else {
        if (!F.stepping) {
          const other = this.feet[s === 'L' ? 'R' : 'L'];
          const dist = Math.hypot(F.pos.x - desired.x, F.pos.z - desired.z);
          const thresh = ch.stepThresh ?? 0.1;
          const yawErr = Math.abs(((desiredYaw - F.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if ((dist > thresh || yawErr > 0.6) && (!other.stepping || dist > thresh * 3)) {
            F.stepping = true; F.planted = false;
            F.from.copy(F.pos); F.to.copy(desired); F.t0 = t;
            F.dur = clamp(0.1 + dist * 0.18, 0.09, 0.28) * (ch.stepTime ?? 1);
            F.lift = clamp(0.03 + dist * 0.12, 0.03, 0.2);
            F.fromYaw = F.yaw; F.toYaw = desiredYaw;
          } else {
            F.pos.y = desired.y;
          }
        }
        if (F.stepping) {
          F.to.lerp(desired, clamp(dt * 12, 0, 1));
          const u = clamp01((t - F.t0) / F.dur);
          const e = u * u * (3 - 2 * u);
          F.pos.lerpVectors(F.from, F.to, e);
          F.pos.y += Math.sin(Math.PI * u) * F.lift;
          F.yaw = F.fromYaw + (F.toYaw - F.fromYaw) * e;
          if (u >= 1) { F.stepping = false; F.planted = true; this.events.push({ type: 'step', t, side: s, pos: F.pos.clone(), speed: F.from.distanceTo(F.to) / F.dur }); }
        }
      }
      let target = F.pos;
      if (ikw > 0.001) target = F.pos.clone().lerp(this.toWorld(ch['ikFoot' + s], new THREE.Vector3()), ikw);
      this.solveLeg(s, target, 1, ikw < 0.5, F.yaw, F.stepping ? clamp01((t - F.t0) / F.dur) : 0);
    }
  }

  solveLeg(s, target, w, flatFoot, footYaw = 0, stepU = 0) {
    const B = this.f.bone;
    const ch = this.ch;
    const pl = ch['poleFoot' + s] || [s === 'L' ? 0.15 : -0.15, 0, 1];
    const pole = new THREE.Vector3(pl[0], pl[1], pl[2]).applyQuaternion(flatFoot ? this.yawQuat : this.rootQuat);
    solveTwoBone(B['thigh.' + s], B['shin.' + s], B['foot.' + s], target, pole, true, w);
    if (flatFoot) {
      // keep the sole level; roll the toe during steps
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), footYaw);
      if (stepU > 0) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin(stepU * Math.PI) * 0.35));
      setWorldQuat(B['foot.' + s], q);
    }
  }
}

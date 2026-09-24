// Script authoring. A FighterHandle keeps "turtle" state (where the fighter is and faces at the
// write cursor) so moves can be expressed relative to the fighter; the ScriptBuilder collects
// events, time warps, shots and lighting keys into one timeline.
import * as THREE from 'three';
import { TimeMap } from '../core/timemap.js';
import { getClip, sampleClip, makePose, clipEvents, MOCAP_BONES } from '../mocap/clips.js';

const _pose = makePose();
const _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

const DEG = Math.PI / 180;

export class FighterHandle {
  constructor(S, fighter, name) {
    this.S = S;
    this.f = fighter;
    this.name = name;
    this.track = fighter.anim.track;
    this.pos = [0, 0, 0];   // root ground position (y = height above floor; floor separate)
    this.yaw = 0;           // degrees
    this.floor = 0;
    this.t = 0;             // last written time
  }
  key(t, ch, ease = 'inOutQuad') {
    this.track.key(t, ch, ease);
    if (ch.pos) this.pos = ch.pos.slice();
    if (ch.yaw !== undefined) this.yaw = ch.yaw;
    if (ch.floor !== undefined) this.floor = ch.floor;
    this.t = Math.max(this.t, t);
    return this;
  }
  // root-space -> world helpers
  fwd(d = 1) { return [Math.sin(this.yaw * DEG) * d, 0, Math.cos(this.yaw * DEG) * d]; }
  side(d = 1) { return [Math.cos(this.yaw * DEG) * d, 0, -Math.sin(this.yaw * DEG) * d]; } // +X local (character's left)
  local(x, y, z) {
    const s = Math.sin(this.yaw * DEG), c = Math.cos(this.yaw * DEG);
    return [this.pos[0] + x * c + z * s, this.pos[1] + y, this.pos[2] - x * s + z * c];
  }
  faceTo(other, t, ease = 'inOutQuad') {
    const dx = other.pos[0] - this.pos[0], dz = other.pos[2] - this.pos[2];
    let yaw = Math.atan2(dx, dz) / DEG;
    // keep continuity (no 360 flips)
    while (yaw - this.yaw > 180) yaw -= 360;
    while (yaw - this.yaw < -180) yaw += 360;
    this.key(t, { yaw }, ease);
    return yaw;
  }
  // ------------------------------------------------------------------------------------------
  // Mocap clips. Places a clip segment in the world and time-warps it.
  //   o.from / o.to      clip segment (s)
  //   o.dur              world duration (uniform speed)  | o.speed
  //   o.warp             [[clipTime, worldOffset, ease?], ...] explicit retiming (first entry = from)
  //   o.at, o.yaw        world hips xz / facing (deg) at clip time o.alignAt (default from);
  //                      default: continue from the turtle position and facing
  //   o.floor            floor height (default: turtle floor)
  //   o.mirror, o.fadeIn, o.fadeOut
  // Returns { t0, t1, w(clipTime) -> world time, ev(limb, n) -> world time of the n-th strike event }
  clip(t, name, o = {}) {
    const clip = getClip(name);
    const from = o.from ?? 0, to = o.to ?? clip.dur;
    let warp;
    if (o.warp) warp = o.warp.map(([c, w, e]) => [t + w, c, e]);
    else { const dur = o.dur ?? (to - from) / (o.speed ?? 1); warp = [[t, from], [t + dur, to]]; }
    const mirror = !!o.mirror;
    const L = this.f.anim.legLen;
    const alignAt = o.alignAt ?? from;
    sampleClip(clip, alignAt, _pose, mirror);
    const cx = _pose.pos.x * L, cz = _pose.pos.z * L;
    const hA = headingOf(_pose.q[0]);
    const wantYaw = (o.yaw ?? this.yaw) * Math.PI / 180;
    const yaw = wantYaw - hA;
    const at = o.at ?? this.pos;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const px = at[0] - (cx * cy + cz * sy), pz = at[2] - (-cx * sy + cz * cy);
    const floor = o.floor ?? this.floor;
    const strideOrigin = [_pose.pos.x, _pose.pos.z];
    const inst = this.f.anim.addClip({ clip, from, to, w0: warp[0][0], warp: warp.map(([w, c, e]) => [w, c, e]), mirror, pos: [px, floor, pz], yaw: yaw * 180 / Math.PI, fadeIn: o.fadeIn ?? 0.1, fadeOut: o.fadeOut ?? 0.12, stride: o.stride, strideOrigin, offset: o.offset, lift: o.lift });
    const place = { px, pz, yaw, floor, mirror, L, clip, stride: o.stride ?? 1, strideOrigin, offset: o.offset };
    this.lastClip = { inst, place };
    // turtle state at the end of the segment
    const end = this.clipWorld(place, to);
    this.pos = [end.x, floor, end.z];
    this.yaw = end.heading * 180 / Math.PI;
    this.floor = floor;
    this.t = Math.max(this.t, warp[warp.length - 1][0]);
    // keep the channel track consistent for whatever follows the clip
    this.track.key(warp[warp.length - 1][0], { pos: this.pos.slice(), yaw: this.yaw, floor }, 'step');
    const wOf = (c) => {
      for (let i = 0; i < warp.length - 1; i++) if (c <= warp[i + 1][1]) return warp[i][0] + (warp[i + 1][0] - warp[i][0]) * ((c - warp[i][1]) / Math.max(1e-6, warp[i + 1][1] - warp[i][1]));
      return warp[warp.length - 1][0];
    };
    const evs = clipEvents(clip, mirror).filter((e) => e.t >= from - 1e-3 && e.t <= to + 1e-3);
    return { t0: warp[0][0], t1: warp[warp.length - 1][0], w: wOf, place, events: evs, ev: (limb, n = 0) => { const e = evs.filter((x) => x.limb === limb)[n]; return e ? wOf(e.t) : null; }, evClip: (limb, n = 0) => { const e = evs.filter((x) => x.limb === limb)[n]; return e ? e.t : null; } };
  }
  // world hips position + heading of a placed clip at clip time c
  clipWorld(place, c, wt) {
    sampleClip(place.clip, c, _pose, place.mirror);
    const L = place.L, cy = Math.cos(place.yaw), sy = Math.sin(place.yaw);
    let x0 = _pose.pos.x, z0 = _pose.pos.z;
    if (place.stride && place.stride !== 1) { const so = place.strideOrigin; x0 = so[0] + (x0 - so[0]) * place.stride; z0 = so[1] + (z0 - so[1]) * place.stride; }
    const x = x0 * L, z = z0 * L;
    let ox = 0, oz = 0;
    if (place.offset && wt !== undefined) { const K = place.offset; const last = K[K.length - 1]; if (wt >= last[0]) { ox = last[1][0]; oz = last[1][2]; } }
    else if (place.offset) { const last = place.offset[place.offset.length - 1]; ox = last[1][0]; oz = last[1][2]; }
    return { x: place.px + x * cy + z * sy + ox, z: place.pz - x * sy + z * cy + oz, y: place.floor + this.f.anim.hipH + (_pose.pos.y - place.clip.standY) * L, heading: place.yaw + headingOf(_pose.q[0]) };
  }
  // world position of a bone for a placed clip at clip time c (forward kinematics on the rig)
  clipBone(place, c, bone) {
    const B = this.f.bone;
    sampleClip(place.clip, c, _pose, place.mirror);
    const w = this.clipWorld(place, c);
    const yq = _q.setFromAxisAngle(_up, w.heading);
    const hipsWorldQ = new THREE.Quaternion().setFromAxisAngle(_up, place.yaw).multiply(_pose.q[0]);
    B.root.position.set(w.x, place.floor, w.z);
    B.root.quaternion.copy(yq);
    B.hips.position.set(0, w.y - place.floor, 0);
    B.hips.quaternion.copy(yq.clone().invert().multiply(hipsWorldQ));
    for (let k = 1; k < MOCAP_BONES.length; k++) B[MOCAP_BONES[k]].quaternion.copy(_pose.q[k]);
    B.root.updateMatrixWorld(true);
    return new THREE.Vector3().setFromMatrixPosition(B[bone].matrixWorld);
  }
  // Strike clip placed so that `limb` (event name, e.g. 'RF') reaches `target` at its extension;
  // facing `face` (a world point) at that moment. Returns the clip handle plus contact time.
  strikeClip(t, name, o) {
    const clip = getClip(name);
    const mirror = !!o.mirror;
    const evs = clipEvents(clip, mirror).filter((e) => e.limb === o.limb && e.t >= (o.from ?? 0) - 1e-3 && e.t <= (o.to ?? clip.dur) + 1e-3);
    const ev = evs[o.n ?? 0];
    if (!ev) throw new Error(`no ${o.limb} event in ${name}`);
    const bone = { LH: 'hand.L', RH: 'hand.R', LF: 'foot.L', RF: 'foot.R' }[o.limb];
    // place at origin facing +Z to measure the effector relative to the hips at contact
    const probe = { px: 0, pz: 0, yaw: 0, floor: 0, mirror, L: this.f.anim.legLen, clip };
    const hp = this.clipWorld(probe, ev.t);
    const ep = this.clipBone(probe, ev.t, bone);
    // rotate so that at contact the hips->effector offset points along the approach line
    const rel = new THREE.Vector2(ep.x - hp.x, ep.z - hp.z);
    const tgt = o.target;
    const relAng = Math.atan2(rel.x, rel.y); // heading of the effector offset in the probe frame
    const approach = Math.atan2(tgt[0] - (o.from3 ? o.from3[0] : this.pos[0]), tgt[2] - (o.from3 ? o.from3[2] : this.pos[2]));
    const yaw = approach - relAng; // rotate probe so the effector offset points along the approach line
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const hx = tgt[0] - (rel.x * cy + rel.y * sy), hz = tgt[2] - (-rel.x * sy + rel.y * cy);
    // the hips heading at contact in the probe frame -> world facing at contact
    const hH = hp.heading;
    return { ...this.clip(t, name, { ...o, alignAt: ev.t, at: [hx, this.floor, hz], yaw: (yaw + hH) * 180 / Math.PI }), contactClip: ev.t, effectorY: ep.y };
  }

  // Locomotion clip segment carrying the fighter from the turtle position to `to` (xz) in `dur`:
  // yaw and stride (root-motion scale) are solved so the path starts here and ends there.
  // Returns the clip handle; o.face = final facing (deg) is applied through the next move.
  travelClip(t, name, from, to, dest, dur, o = {}) {
    const clip = getClip(name);
    const mirror = !!o.mirror;
    const L = this.f.anim.legLen;
    sampleClip(clip, from, _pose, mirror); const ax = _pose.pos.x, az = _pose.pos.z, hA = headingOf(_pose.q[0]);
    sampleClip(clip, to, _pose, mirror); const bx = _pose.pos.x, bz = _pose.pos.z;
    const dcx = (bx - ax) * L, dcz = (bz - az) * L;
    const dwx = dest[0] - this.pos[0], dwz = dest[2] - this.pos[2];
    const lc = Math.hypot(dcx, dcz), lw = Math.hypot(dwx, dwz);
    const yaw = Math.atan2(dwx, dwz) - Math.atan2(dcx, dcz);
    const stride = lc > 1e-3 ? lw / lc : 1;
    return this.clip(t, name, { ...o, from, to, dur, at: this.pos, alignAt: from, yaw: (yaw + hA) * 180 / Math.PI, stride, mirror });
  }
  // Exact world position of a bone at world time w, from whichever clip instance drives the
  // fighter then (build-time forward kinematics). Falls back to the turtle position.
  boneAt(w, bone) {
    const A = this.f.anim, B = this.f.bone;
    let inst = null;
    for (const o of A.perf) if (w >= o.w0 - 1e-6 && w <= o.w1 + 1e-6) inst = o;
    if (!inst) for (const o of A.perf) if (w >= o.w0 - o.fadeIn && w <= o.w1 + o.fadeOut) inst = o;
    if (!inst) return new THREE.Vector3(this.pos[0], this.pos[1] + (bone === 'head' ? 1.7 : 1.2) * (this.name === 'gou' ? 1.18 : 1), this.pos[2]);
    const pose = makePose(), hips = new THREE.Vector3(), hq = new THREE.Quaternion();
    A.sampleInst(inst, w, pose, hips, hq);
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(hq);
    const yq = new THREE.Quaternion().setFromAxisAngle(_up, Math.atan2(f.x, f.z));
    B.root.position.set(hips.x, inst.pos[1], hips.z);
    B.root.quaternion.copy(yq);
    B.hips.position.set(0, hips.y - inst.pos[1], 0);
    B.hips.quaternion.copy(yq.clone().invert().multiply(hq));
    for (let k = 1; k < MOCAP_BONES.length; k++) B[MOCAP_BONES[k]].quaternion.copy(pose.q[k]);
    B.root.updateMatrixWorld(true);
    return new THREE.Vector3().setFromMatrixPosition(B[bone].matrixWorld);
  }
  // clip start time so that the n-th `limb` event lands at world time tc (uniform speed)
  strikeClipAt(tc, name, o) {
    const clip = getClip(name);
    const from = o.from ?? 0, speed = o.speed ?? 1;
    const ev = clipEvents(clip, !!o.mirror).filter((e) => e.limb === o.limb && e.t >= from - 1e-3 && e.t <= (o.to ?? clip.dur) + 1e-3)[o.n ?? 0];
    if (!ev) throw new Error(`no ${o.limb} event in ${name}`);
    const t = tc - (ev.t - from) / speed;
    const h = this.strikeClip(t, name, { ...o, speed });
    h.contact = tc;
    return h;
  }
  // world hips + heading at clip time c of a clip handle (for chaining alignments)
  at(handle, c) { return this.clipWorld(handle.place, c); }

  yawTo(x, z) {
    let yaw = Math.atan2(x - this.pos[0], z - this.pos[2]) / DEG;
    while (yaw - this.yaw > 180) yaw -= 360;
    while (yaw - this.yaw < -180) yaw += 360;
    return yaw;
  }
}

function headingOf(q) { _v3.set(0, 0, 1).applyQuaternion(q); return Math.atan2(_v3.x, _v3.z); }

export class ScriptBuilder {
  constructor(engine) {
    this.e = engine;
    this.kai = new FighterHandle(this, engine.kai, 'kai');
    this.gou = new FighterHandle(this, engine.gou, 'gou');
    this.events = [];      // {w, fn, tag}
    this.shots = [];       // {w, type, p}
    this.looks = [];       // {w, look, ease}
    this.attach = [];      // {w0, w1, victim, holder, bone, offset}
    this.chapters = [];
    this.tm = new TimeMap();
    this.endW = 0;
    this.sfxCues = [];
  }
  chapter(w, title, sub) { this.chapters.push({ w, title, sub }); }
  event(w, fn, tag = '') { this.events.push({ w, fn, tag }); return this; }
  slow(w0, w1, rate, rin = 0.05, rout = 0.08) { this.tm.slow(w0, w1, rate, rin, rout); return this; }
  hitstop(w, hold) { this.tm.hitstop(w, hold); return this; }
  shot(w, type, p = {}) { this.shots.push({ w, type, p }); return this; }
  look(w, look, ease = 'inOutSine') { this.looks.push({ w, look, ease }); return this; }
  hold(w0, w1, victim, holder, bone, offset = [0, 0, 0], extra = {}) { this.attach.push({ w0, w1, victim, holder, bone, offset, ...extra }); return this; }
  sfx(w, name, p = {}) { this.sfxCues.push({ w, name, p }); return this; }
  finish(endW) {
    this.endW = endW;
    this.tm.build(endW);
    this.shots.sort((a, b) => a.w - b.w);
    this.looks.sort((a, b) => a.w - b.w);
    this.events.sort((a, b) => a.w - b.w);
    this.kai.track.finalize();
    this.gou.track.finalize();
  }
}

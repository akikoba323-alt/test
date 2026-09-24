// Script authoring. A FighterHandle keeps "turtle" state (where the fighter is and faces at the
// write cursor) so moves can be expressed relative to the fighter; the ScriptBuilder collects
// events, time warps, shots and lighting keys into one timeline.
import { TimeMap } from '../core/timemap.js';

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
  yawTo(x, z) {
    let yaw = Math.atan2(x - this.pos[0], z - this.pos[2]) / DEG;
    while (yaw - this.yaw > 180) yaw -= 360;
    while (yaw - this.yaw < -180) yaw += 360;
    return yaw;
  }
}

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

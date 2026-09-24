// Film runtime: owns the script, time map, event queue, director and look track; steps the world
// in fixed sub-steps so every event fires at its exact world time; supports seeking.
import * as THREE from 'three';
import { ScriptBuilder } from './choreo/builder.js';
import { Director } from './choreo/director.js';
import { Combat } from './choreo/combat.js';
import { LookTrack } from './choreo/look.js';
import { EventQueue } from './core/events.js';
import { buildScript } from './choreo/script.js';
import { PT } from './fx/particles.js';
import { clamp } from './core/math.js';

export class Film {
  constructor(engine, opts = {}) {
    this.e = engine;
    this.opts = opts;
    this.queue = new EventQueue();
    this.cues = [];          // audio cue log {w, name, p}
    this.cueListeners = [];
    this.P = 0; this.W = 0;
    this.lastDtReal = 1 / 60;
    this.speed = 1;
  }

  build() {
    this.aspect = this.aspect || 2.39;
    const S = new ScriptBuilder(this.e);
    this.S = S;
    this.combat = new Combat(this);
    buildScript(S, this);
    this.tm = S.tm;
    this.endW = S.endW;
    this.endP = this.tm.endP;
    this.director = new Director(this, S.shots);
    this.lookTrack = new LookTrack(S.looks);
    this.chapters = S.chapters.map((c) => ({ ...c, p: this.tm.P(c.w) }));
    this.reset();
  }

  at(w, fn) { this.queue.push(w, fn); }
  cue(name, p = {}) {
    const c = { w: this.e.time, name, p };
    this.cues.push(c);
    for (const l of this.cueListeners) l(c);
  }

  reset() {
    const e = this.e;
    e.city.reset();
    e.fx.reset();
    e.debris.reset();
    e.interiors.reset();
    this.combat.reset();
    for (const L of e.city.lamps) L.on = true;
    for (const f of [e.kai, e.gou]) { f.anim.reset(); f.hurt = 0; f.clearGhosts(); for (const c of f.cloths) c.cloth.inited = false; }
    this.queue.clear();
    for (const ev of this.S.events) this.queue.push(ev.w, ev.fn, ev.tag);
    this.cues.length = 0;
    this.P = 0; this.W = 0;
    this.director.reset();
    this.e.time = 0;
    this.stepWorld(0, 0);
  }

  // advance playback by dtReal seconds
  update(dtReal) {
    this.lastDtReal = dtReal;
    const P1 = Math.min(this.P + dtReal * this.speed, this.endP + 2);
    const W1 = this.tm.W(P1);
    this.pTarget = P1;
    this.advanceTo(W1);
    this.P = P1;
  }

  advanceTo(W1, maxStep = 1 / 90) {
    let W = this.W;
    if (W1 <= W) { this.e.fx.play = this.pTarget ?? this.P; this.W = W; this.stepWorld(W, 0); return; }
    const P0 = this.P, P1 = this.pTarget ?? this.P, W0 = W, span = Math.max(1e-9, W1 - W0);
    while (W < W1 - 1e-9) {
      let w = Math.min(W1, W + maxStep);
      const te = this.queue.peekTime();
      if (te > W && te < w) w = te;
      this.e.fx.play = P0 + (P1 - P0) * ((w - W0) / span);
      this.stepWorld(w, w - W);
      W = w;
      while (this.queue.size && this.queue.peekTime() <= W + 1e-9) {
        const ev = this.queue.pop();
        this.e.time = ev.w;
        try { ev.fn(this.e, this.combat, this); } catch (err) { console.error('event failed', ev.tag, err); }
      }
    }
    this.W = W1;
  }

  stepWorld(W, dt) {
    const e = this.e;
    e.time = W;
    // holds: evaluate holders first, then pin victims to the holder's bone
    const holds = this.S.attach.filter((h) => W >= h.w0 && W <= h.w1);
    const order = holds.length && holds[0].victim === 'kai' ? [e.gou, e.kai] : [e.kai, e.gou];
    for (const f of order) {
      const hold = holds.find((h) => (h.victim === 'kai' ? e.kai : e.gou) === f);
      if (hold) {
        const holder = hold.holder === 'kai' ? e.kai : e.gou;
        const hp = holder.anim.bonePos[hold.bone].clone();
        const off = new THREE.Vector3(...hold.offset).applyQuaternion(holder.anim.rootQuat);
        f.anim.rootOverride = { pos: hp.add(off), quat: hold.quat ? hold.quat(W, holder) : null };
      }
      f.anim.evaluate(W, dt);
      this.updateFighterFx(f, W, dt);
      this.updateCloth(f, W, dt);
      f.recordGhost(W);
      f.updateGhosts(W, f.anim.ch.ghost ?? 0, f.anim.ch.ghostGap ?? 0.035);
    }
    e.debris.movers = [e.kai, e.gou].map((f) => ({ a: f.anim.bonePos.hips.clone(), b: f.anim.bonePos.head.clone(), r: f === e.gou ? 0.6 : 0.45, vel: f.anim.boneVel.chest.clone() }));
    e.debris.step(dt, W);
    e.city.wires.step(dt);
    e.fx.particles.movers = [e.kai, e.gou].map((f) => { const p = f.anim.bonePos.chest, v = f.anim.boneVel.chest; return { x: p.x, y: p.y, z: p.z, r: 3, vx: v.x, vy: v.y, vz: v.z }; });
    e.fx.update(W, dt, e.camera);
  }

  updateCloth(f, W, dt) {
    if (!f.cloths.length) return;
    const e = this.e, bp = f.anim.bonePos, shocks = e.fx.frameFx.shocks || [];
    const wind = this.e.look.wind || [2.5, 0, 0.8];
    const floor = f.anim.ch.floor ?? 0;
    const windFn = (x, y, z, out) => {
      out.set(wind[0], wind[1], wind[2]);
      for (const s of shocks) {
        const dx = x - s.x, dy = y - s.y, dz = z - s.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const shell = Math.exp(-(((d - s.r) / (s.thick * 2)) ** 2));
        const k = shell * s.strength * 45 / d;
        out.x += dx * k; out.y += dy * k; out.z += dz * k;
      }
      return out;
    };
    for (const c of f.cloths) {
      c.cloth.colliders = c.colliders(bp);
      c.cloth.floorY = floor;
      c.cloth.step(dt, windFn);
      c.mat.userData.u.uDamage.value = (f.anim.ch.damage ?? 0) * c.tear;
    }
  }

  updateFighterFx(f, W, dt) {
    const a = f.anim, ch = a.ch, u = f.u, fx = this.e.fx;
    u.uTime.value = W;
    u.uEnergy.value = ch.energy ?? 0;
    u.uEyeGlow.value = ch.eyeGlow ?? (ch.energy ?? 0);
    u.uDamage.value = ch.damage ?? 0;
    u.uSoot.value = ch.soot ?? 0;
    // smear scales with world time per frame so slow motion shows no stretching
    u.uSmear.value = (ch.smear ?? 0.35) * clamp(dt, 0, 1 / 60);
    const bones = f.rig.bones;
    for (let i = 0; i < bones.length; i++) u.uBoneVel.value[i].copy(a.boneVel[bones[i].name]);
    // decay impact dents
    for (let i = 0; i < 4; i++) {
      const d = u.uImpD.value[i];
      if (d.w > 0) { const k = Math.exp(-dt * 7); d.x *= k; d.y *= k; d.z *= k; if (Math.abs(d.x) + Math.abs(d.y) + Math.abs(d.z) < 1e-4) d.w = 0; }
    }
    // hair lag from head acceleration (spring)
    f.hairS = f.hairS || { x: new THREE.Vector3(), v: new THREE.Vector3(), prev: null };
    const hv = a.boneVel.head;
    if (dt > 0) {
      const hs = f.hairS;
      if (!hs.prev) hs.prev = hv.clone();
      const acc = hv.clone().sub(hs.prev).divideScalar(dt);
      hs.prev.copy(hv);
      hs.v.addScaledVector(acc, -0.0025 * dt * 60).addScaledVector(hs.x, -dt * 220).multiplyScalar(Math.exp(-dt * 9));
      hs.x.addScaledVector(hs.v, dt);
      hs.x.clampLength(0, 0.06);
      u.uHairOff.value.copy(hs.x);
    }
    // footfalls and skids
    for (const ev of a.events) {
      if (ev.type === 'step') {
        const heavy = f === this.e.gou;
        if (ev.speed > 1.5 || heavy) fx.burst(PT.DUST, heavy ? 6 : 3, ev.pos, { up: 0.5, speed: 1.2, life: 1.2, size: heavy ? 0.5 : 0.3, spread: 0.2 });
        if (heavy && (ch.energy ?? 0) > 0.4) fx.crack(ev.pos, 1.2 + (ch.energy ?? 0), { grow: 0.05, glow: ch.energy ?? 0 });
        this.cue('step', { pos: ev.pos, heavy, speed: ev.speed });
      } else if (ev.type === 'skid' && dt > 0) {
        if (Math.random() < 0.6) fx.particles.spawn(PT.DUST, ev.pos.x, ev.pos.y - 0.05, ev.pos.z, (Math.random() - 0.5) * 2, 0.6 + Math.random(), (Math.random() - 0.5) * 2, 1.4, 0.35, Math.random());
        if (f === this.e.gou && Math.random() < 0.3) fx.particles.spawn(PT.SPARK, ev.pos.x, ev.pos.y - 0.06, ev.pos.z, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, 0.35, 0.02, Math.random());
      }
    }
    a.events.length = 0;
    // energy aura motes
    const en = ch.energy ?? 0;
    if (en > 0.25 && dt > 0) {
      const n = Math.round(en * 90 * dt * 10);
      const c = a.bonePos.chest;
      for (let i = 0; i < n; i++) {
        const r = 0.3 + Math.random() * 0.6 * (f === this.e.gou ? 1.3 : 1);
        const ang = Math.random() * 6.283, y = (Math.random() - 0.3) * 1.6;
        fx.particles.spawn(f === this.e.gou ? PT.EMBER : PT.ENERGY, c.x + Math.cos(ang) * r, c.y + y, c.z + Math.sin(ang) * r, (Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 2.5 * en, (Math.random() - 0.5) * 0.6, 0.7 + Math.random() * 0.8, 0.03 + 0.03 * en, Math.random());
      }
    }
  }

  // the fx block passed to engine.render: director lens + look
  frame() {
    const look = this.lookTrack.sample(this.W);
    this.e.look = look;
    this.e.applyLook(look);
    const cam = this.director.update(this.P, this.W);
    return cam;
  }

  seek(P, onProgress) {
    this.reset();
    const target = clamp(P, 0, this.endP);
    const Wt = this.tm.W(target);
    // coarse fast-forward: world steps of 1/30 s; particles only in the last few seconds
    const warm = Math.max(0, Wt - 4);
    const e = this.e;
    const origStep = e.fx.particles.step.bind(e.fx.particles);
    e.fx.particles.step = (dt, time) => { if (time >= warm) origStep(dt, time); else e.fx.particles.queue = 0; };
    this.pTarget = target;
    this.advanceTo(Wt, 1 / 30);
    e.fx.particles.step = origStep;
    this.P = target;
    this.W = Wt;
  }
}

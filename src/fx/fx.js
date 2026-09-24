// Effects hub: particles, shockwaves, dynamic lights, dust volumes, crack / scorch sources,
// screen flashes and impact frames. Everything is time-stamped in world time so effects
// evolve correctly under slow motion and hit-stop.
import * as THREE from 'three';
import { Particles, PT } from './particles.js';
import { damageUniforms, MAX_CRACKS } from '../world/archmat.js';
import { RNG } from '../core/rng.js';
import { clamp, clamp01, envAD, smoothstep } from '../core/math.js';

const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export class FX {
  constructor(engine) {
    this.e = engine;
    const q = engine.q;
    this.particles = new Particles(engine.renderer, engine.noise3D, { width: 256, height: q.particles || 256 });
    this.rng = new RNG(1234);
    this.shocks = [];   // {x,y,z, t0, speed, maxR, thick, strength, bright, push, life}
    this.lights = [];   // {x,y,z, t0, life, color, intensity, radius, attack, halflife}
    this.dusts = [];    // volumetric dust: {x,y,z, t0, r0, r1, grow, density, life, heat}
    this.cracks = [];   // {x,y,z, t0, radius, grow, intensity, glow, seed}
    this.scorches = [];
    this.flashes = [];  // screen flashes {t0, life, amount, color}
    this.impacts = [];  // impact frames {t0, dur, mode, amount}
    this.shakes = [];   // camera trauma {t0, amount, halflife, dir}
    this.heats = [];
    this.pool = [];
    for (let i = 0; i < 6; i++) {
      const L = new THREE.PointLight(0xffffff, 0, 30, 2);
      L.castShadow = false;
      engine.scene.add(L);
      this.pool.push(L);
    }
    this.time = 0;
    this.frameFx = {};
  }

  reset() {
    this.shocks.length = 0; this.lights.length = 0; this.dusts.length = 0; this.cracks.length = 0; this.scorches.length = 0;
    this.flashes.length = 0; this.impacts.length = 0; this.shakes.length = 0; this.heats.length = 0;
    this.particles.clearTargets();
    for (const L of this.pool) L.intensity = 0;
  }

  // ---------------------------------------------------------------------------------------
  // primitives
  shock(pos, opts = {}) {
    const s = { x: pos.x, y: pos.y, z: pos.z, t0: opts.t ?? this.time, speed: opts.speed ?? 60, maxR: opts.maxR ?? 25, thick: opts.thick ?? 1.2, strength: opts.strength ?? 1, bright: opts.bright ?? 0.25, push: opts.push ?? 1, r0: opts.r0 ?? 0.3 };
    this.shocks.push(s);
    return s;
  }
  light(pos, color, intensity, radius, life = 0.3, attack = 0.01) {
    this.lights.push({ x: pos.x, y: pos.y, z: pos.z, t0: this.time, life, color, intensity, radius, attack, follow: null });
    return this.lights[this.lights.length - 1];
  }
  dust(pos, r0, r1, density, life = 6, grow = 1.5, heat = 0) {
    this.dusts.push({ x: pos.x, y: pos.y, z: pos.z, t0: this.time, r0, r1, density, life, grow, heat });
  }
  crack(pos, radius, opts = {}) {
    this.cracks.push({ x: pos.x, y: pos.y, z: pos.z, t0: this.time, radius, grow: opts.grow ?? 0.12, intensity: opts.intensity ?? 1, glow: opts.glow ?? 0, seed: this.rng.next() * 10, life: opts.life ?? 1e9 });
  }
  scorch(pos, radius) { this.scorches.push({ x: pos.x, y: pos.y, z: pos.z, r: radius, t0: this.time }); }
  flash(amount, life = 0.12, color = [1, 1, 1]) { this.flashes.push({ t0: this.time, life, amount, color }); }
  impactFrame(dur, mode = 0, amount = 1) { this.impacts.push({ t0: this.time, dur, mode, amount }); }
  shake(amount, halflife = 0.12, dir = null) { this.shakes.push({ t0: this.time, amount, halflife, dir }); }
  heat(pos, radius, life) { this.heats.push({ x: pos.x, y: pos.y, z: pos.z, r: radius, t0: this.time, life }); }

  // ---------------------------------------------------------------------------------------
  // particle helpers
  burst(type, n, pos, o = {}) {
    const P = this.particles, r = this.rng;
    const spread = o.spread ?? 1, speed = o.speed ?? 5, dir = o.dir, cone = o.cone ?? Math.PI;
    for (let i = 0; i < n; i++) {
      let vx, vy, vz;
      if (dir) { r.cone(_d, dir, cone); } else r.dir(_d);
      if (o.flat) { _d.y = Math.abs(_d.y) * o.flat; _d.normalize(); }
      if (o.up) { _d.y = Math.abs(_d.y) * o.up + (1 - o.up) * _d.y; }
      const sp = speed * (o.speedMin ?? 0.3 + 0.7 * r.next()) * (0.5 + r.next() * 0.8);
      vx = _d.x * sp + (o.vel ? o.vel.x : 0); vy = _d.y * sp + (o.vel ? o.vel.y : 0); vz = _d.z * sp + (o.vel ? o.vel.z : 0);
      const px = pos.x + (r.next() - 0.5) * spread, py = pos.y + (r.next() - 0.5) * spread * (o.flatPos ? 0.2 : 1), pz = pos.z + (r.next() - 0.5) * spread;
      const life = (o.life ?? 1.5) * (0.6 + r.next() * 0.8);
      const size = (o.size ?? 0.5) * (0.6 + r.next() * 0.8);
      P.spawn(type, px, Math.max(py, o.minY ?? -1e9), pz, vx, vy, vz, life, size, r.next(), 0, o.age0 ?? 0);
    }
  }

  // Standard impact recipe. kind: 'light' | 'heavy' | 'ground' | 'wall' | 'metal' | 'energy'
  hit(pos, dir, strength, kind = 'light', opts = {}) {
    const s = strength;
    const color = opts.color || [1.0, 0.8, 0.55];
    if (kind === 'metal' || opts.sparks) this.burst(PT.SPARK, Math.round(20 + 60 * s), pos, { dir, cone: 1.2, speed: 14 + 20 * s, life: 0.5, size: 0.03, spread: 0.1 });
    this.burst(PT.DUST, Math.round(6 + 26 * s), pos, { speed: 2 + 6 * s, life: 1.4 + 1.5 * s, size: 0.5 + 0.8 * s, spread: 0.3 });
    if (s > 0.4) this.burst(PT.RING, Math.round(10 + 30 * s), pos, { flat: 0.12, speed: 8 + 18 * s, life: 0.9 + 0.8 * s, size: 0.5 + 0.6 * s, spread: 0.2 });
    this.light(pos, color, 25 * s + 5, 6 + 10 * s, 0.12 + 0.12 * s, 0.005);
    if (s > 0.25) this.shock(pos, { speed: 90 + 90 * s, maxR: 4 + 26 * s, thick: 0.6 + 0.8 * s, strength: 0.4 + 0.8 * s, bright: 0.12 + 0.3 * s, push: 0.5 + s });
    if (s > 0.6) { this.dust(pos, 1, 3 + 6 * s, 0.03 + 0.05 * s, 3 + 3 * s, 2.5); }
    this.shake(0.1 + 0.6 * s, 0.08 + 0.1 * s, dir);
  }

  groundSlam(pos, strength, opts = {}) {
    const s = strength;
    const g = new THREE.Vector3(pos.x, (opts.floor ?? 0) + 0.05, pos.z);
    this.burst(PT.RING, Math.round(40 + 120 * s), g, { flat: 0.06, speed: 12 + 40 * s, life: 1.2 + 1.5 * s, size: 0.8 + 1.2 * s, spread: 0.8, minY: g.y });
    this.burst(PT.DUST, Math.round(30 + 80 * s), g, { up: 0.9, speed: 4 + 14 * s, life: 2.5 + 3 * s, size: 1.0 + 1.6 * s, spread: 2 * s });
    this.burst(PT.CHIP, Math.round(30 + 140 * s), g, { up: 1, cone: 1.1, dir: new THREE.Vector3(0, 1, 0), speed: 6 + 18 * s, life: 2.5, size: 0.05 + 0.08 * s, spread: 1.5 * s });
    this.burst(PT.SPARK, Math.round(10 + 30 * s), g, { up: 0.6, speed: 10 + 16 * s, life: 0.5, size: 0.03, spread: 0.5 });
    this.shock(g, { speed: 70 + 120 * s, maxR: 10 + 60 * s, thick: 1.2 + 1.5 * s, strength: 0.6 + s, bright: 0.25 + 0.3 * s, push: 1 + 2 * s });
    this.light(g.clone().setY(g.y + 1), opts.color || [1.0, 0.75, 0.5], 50 * s + 10, 12 + 20 * s, 0.2 + 0.2 * s, 0.005);
    this.dust(g, 2, 6 + 22 * s, 0.05 + 0.06 * s, 6 + 8 * s, 1.6);
    this.crack(g, 3 + 16 * s, { grow: 0.25 + 0.2 * s, intensity: 1, glow: opts.glow ?? 0 });
    this.shake(0.5 + 0.8 * s, 0.15 + 0.2 * s);
  }

  dashTrail(from, to, strength = 1, floor = 0) {
    const n = Math.round(10 + 30 * strength);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      _v.lerpVectors(from, to, t);
      if (_v.y - floor < 1.2) this.particles.spawn(PT.DUST, _v.x, floor + 0.1, _v.z, (this.rng.next() - 0.5) * 3, 0.5 + this.rng.next() * 1.5, (this.rng.next() - 0.5) * 3, 1.5 + this.rng.next(), 0.4 + 0.5 * strength, this.rng.next());
    }
  }

  // ---------------------------------------------------------------------------------------
  update(time, dt, camera) {
    this.time = time;
    const P = this.particles;
    // shockwave shells (radius grows with deceleration)
    const shocksOut = [], simShocks = [];
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      const t = time - s.t0;
      if (t < 0) continue;
      const R = s.r0 + s.maxR * (1 - Math.exp(-t * s.speed / s.maxR));
      const life = clamp01(1 - (R - s.r0) / (s.maxR * 0.985));
      if (life <= 0.005) { this.shocks.splice(i, 1); continue; }
      const k = life * s.strength;
      shocksOut.push({ x: s.x, y: s.y, z: s.z, r: R, thick: s.thick * (1 + t * 2), strength: k, bright: s.bright * life });
      simShocks.push({ x: s.x, y: s.y, z: s.z, r: R, thick: s.thick * 1.5, push: s.push * life });
    }
    P.shocks = simShocks;
    // lights
    const active = [];
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const L = this.lights[i];
      const t = time - L.t0;
      if (t > L.life * 4 + 0.5) { this.lights.splice(i, 1); continue; }
      if (t < 0) continue;
      const env = t < L.attack ? t / L.attack : Math.exp(-(t - L.attack) / Math.max(L.life, 0.01));
      if (L.follow) { L.x = L.follow.x; L.y = L.follow.y; L.z = L.follow.z; }
      const I = L.intensity * env * (L.flicker ? 0.75 + 0.25 * Math.sin(time * L.flicker + L.t0 * 13) : 1);
      if (I > 0.05) active.push({ x: L.x, y: L.y, z: L.z, r: L.radius, color: L.color, intensity: I });
    }
    for (const x of this.persistentLights || []) if (x.intensity > 0.05) active.push(x);
    active.sort((a, b) => b.intensity * b.r - a.intensity * a.r);
    this.activeLights = active.slice(0, 8);
    for (let i = 0; i < this.pool.length; i++) {
      const L = this.pool[i], a = active[i];
      if (a) { L.position.set(a.x, a.y, a.z); L.color.setRGB(a.color[0], a.color[1], a.color[2]); L.intensity = a.intensity * 12; L.distance = a.r * 2.2; }
      else L.intensity = 0;
    }
    // dust volumes
    const dustOut = [];
    for (let i = this.dusts.length - 1; i >= 0; i--) {
      const d = this.dusts[i];
      const t = time - d.t0;
      if (t > d.life) { this.dusts.splice(i, 1); continue; }
      if (t < 0) continue;
      const r = d.r0 + (d.r1 - d.r0) * (1 - Math.exp(-t * d.grow));
      const dens = d.density * smoothstep(0, 0.15, t) * (1 - smoothstep(d.life * 0.5, d.life, t)) * Math.pow(d.r1 / Math.max(r, 0.5), 0.5) * 0.6;
      dustOut.push({ x: d.x, y: d.y + t * 0.4, z: d.z, r, density: dens, noise: 0.85, heat: d.heat * Math.exp(-t * 0.8) });
    }
    dustOut.sort((a, b) => b.density * b.r - a.density * a.r);
    // cracks -> material uniforms
    const cp = damageUniforms.uCrackP.value, cq = damageUniforms.uCrackQ.value;
    const cs = this.cracks.filter((c) => time >= c.t0).slice(-MAX_CRACKS);
    for (let i = 0; i < MAX_CRACKS; i++) {
      const c = cs[i];
      if (!c) { cp[i].set(0, -1e5, 0, 0); continue; }
      const t = time - c.t0;
      const R = c.radius * (1 - Math.exp(-t / Math.max(c.grow, 0.01)));
      cp[i].set(c.x, c.y, c.z, R);
      cq[i].set(c.intensity, c.glow * Math.exp(-t * 0.6), c.seed, 0);
    }
    const sp = damageUniforms.uScorchP.value;
    const ss = this.scorches.filter((c) => time >= c.t0).slice(-16);
    for (let i = 0; i < 16; i++) { const c = ss[i]; if (!c) sp[i].set(0, -1e5, 0, 0); else sp[i].set(c.x, c.y, c.z, c.r * clamp01((time - c.t0) * 4)); }
    // flashes / impact frames / shake
    let flash = 0; const fcol = [0, 0, 0];
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]; const t = time - f.t0;
      if (t > f.life * 6) { this.flashes.splice(i, 1); continue; }
      if (t < 0) continue;
      const a = f.amount * Math.exp(-t / f.life);
      flash += a; fcol[0] += f.color[0] * a; fcol[1] += f.color[1] * a; fcol[2] += f.color[2] * a;
    }
    let impact = null;
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const f = this.impacts[i]; const t = time - f.t0;
      if (t > f.dur + 1) { this.impacts.splice(i, 1); continue; }
      if (t >= 0 && t < f.dur) impact = { mode: f.mode, amount: f.amount };
    }
    let trauma = 0;
    for (let i = this.shakes.length - 1; i >= 0; i--) {
      const s = this.shakes[i]; const t = time - s.t0;
      if (t > s.halflife * 10) { this.shakes.splice(i, 1); continue; }
      if (t >= 0) trauma += s.amount * Math.pow(0.5, t / s.halflife);
    }
    const heats = this.heats.filter((h) => time >= h.t0 && time - h.t0 < h.life).map((h) => ({ x: h.x, y: h.y, z: h.z, r: h.r }));
    this.frameFx = { shocks: shocksOut, lights: this.activeLights, dust: dustOut.slice(0, 16), flash, flashColor: flash > 0 ? [fcol[0] / flash, fcol[1] / flash, fcol[2] / flash] : [1, 1, 1], impact, trauma: Math.min(trauma, 2.5), heat: heats.slice(0, 4) };
    P.step(dt, time);
  }
}

export { PT };

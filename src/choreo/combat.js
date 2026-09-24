// Runtime combat helpers used by script events: strikes (FX + reactions + dents + sound cues),
// propagating window-shatter rings, element breaking, craters with uplifted asphalt plates,
// flung cars, launch craters, energy discharges.
import * as THREE from 'three';
import { PT } from '../fx/particles.js';
import { EL } from '../world/elements.js';
import { KIND } from '../world/archmat.js';
import { voronoiCells, impactSeeds } from '../fx/fracture.js';
import { RNG } from '../core/rng.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class Combat {
  constructor(film) {
    this.film = film;
    this.e = film.e;
    this.fx = film.e.fx;
    this.debris = film.e.debris;
    this.city = film.e.city;
    this.rng = new RNG(99);
    this.craters = [];
    this.craterGroup = new THREE.Group();
    this.e.scene.add(this.craterGroup);
    this.dentSlot = { kai: 0, gou: 0 };
  }

  reset() {
    for (const c of this.craters) { this.craterGroup.remove(c.mesh); c.mesh.geometry.dispose(); }
    this.craters.length = 0;
    const holes = this.e.city.ground.material.userData.u.uHoles.value;
    for (const h of holes) h.set(0, 0, 0, 0);
    for (const f of [this.e.kai, this.e.gou]) for (const d of f.u.uImpD.value) d.set(0, 0, 0, 0);
  }

  F(name) { return name === 'kai' ? this.e.kai : this.e.gou; }
  bonePos(f, bone) { return f.anim.bonePos[bone].clone(); }

  // A landed blow. attacker/victim: 'kai'|'gou'; bone: striking bone name; o: options
  strike(attacker, bone, victim, o = {}) {
    const A = this.F(attacker), V = this.F(victim);
    const p = this.bonePos(A, bone);
    if (o.at) p.copy(o.at);
    const vel = A.anim.boneVel[bone];
    const dir = o.dir ? new THREE.Vector3(...o.dir) : (vel.lengthSq() > 1 ? vel.clone().normalize() : V.anim.bonePos.chest.clone().sub(p).normalize());
    const s = o.strength ?? 0.5;
    const kind = o.kind || 'hit';
    const color = attacker === 'kai' ? [0.6, 0.85, 1.0] : [1.0, 0.55, 0.25];
    if (kind === 'block' || kind === 'metal' || (victim === 'gou' && o.gauntlet)) this.fx.hit(p, dir, s, 'metal', { color: [1, 0.8, 0.5], sparks: true });
    else this.fx.hit(p, dir, s, kind === 'clash' ? 'metal' : 'heavy', { color, sparks: kind === 'clash' || bone.startsWith('hand') && attacker === 'gou' });
    // body dent + ripple on the victim (not for blocks)
    if (kind !== 'block' && kind !== 'clash') {
      const slot = this.dentSlot[victim]++ % 4;
      V.u.uImp.value[slot].set(p.x, p.y, p.z, (o.dent ?? 0.09) * (1 + s));
      V.u.uImpD.value[slot].set(dir.x * 0.035 * (0.5 + s), dir.y * 0.035 * (0.5 + s), dir.z * 0.035 * (0.5 + s), 1);
      V.dentT = V.dentT || [0, 0, 0, 0];
      V.dentT[slot] = this.e.time;
      // spring reactions
      const r = o.react || 'chest';
      const k = 220 * s * (victim === 'gou' ? 0.6 : 1);
      const cq = new THREE.Quaternion().copy(V.anim.rootQuat).invert();
      const ld = dir.clone().applyQuaternion(cq);
      if (r === 'head') { V.anim.impulse('head', -ld.z * k * 1.6 + 60 * s, ld.x * k, ld.x * k * 0.6); V.anim.impulse('chest', -ld.z * k * 0.5, 0, 0); }
      else if (r === 'gut') { V.anim.impulse('spine', k * 1.4, 0, 0); V.anim.impulse('chest', k * 0.8, 0, 0); V.anim.impulse('head', k * 0.8, 0, 0); }
      else { V.anim.impulse('chest', -ld.z * k, ld.x * k * 0.5, ld.x * k * 0.4); V.anim.impulse('spine', -ld.z * k * 0.5, 0, 0); }
      V.hurt = (V.hurt || 0) + s * 0.04;
    } else {
      V.anim.impulse('chest', -60 * s, 0, 0);
      V.anim.impulse('head', -40 * s, 0, 0);
    }
    if (o.impactFrame) this.fx.impactFrame(o.impactFrame, o.impactMode ?? 0, 1);
    if (o.flash) this.fx.flash(o.flash, 0.06, color);
    if (o.windows) this.shatterRing(p, o.windows, o.windowSpeed ?? 160, s);
    if (o.cars) this.pushCars(p, o.cars, s * 30);
    if (o.wires) this.city.wires.blast(p, o.wires, 10 * s);
    if (o.shockR) this.fx.shock(p, { speed: 200, maxR: o.shockR, thick: 2, strength: 1.2, bright: 0.4, push: 2 });
    if (o.dustR) this.fx.dust(p, 2, o.dustR, 0.06, 5, 1.2);
    this.film.cue(kind === 'block' ? 'block' : kind === 'clash' ? 'clash' : s > 0.7 ? 'heavyHit' : 'hit', { pos: p, strength: s, attacker });
    return p;
  }

  // break every element in a sphere
  breakAround(center, radius, o = {}) {
    const hits = this.city.querySphere(center.x, center.y, center.z, radius, o.filter);
    const blast = { pos: o.blastPos || center, speed: o.speed ?? 12, radius: radius };
    let n = 0;
    for (const h of hits) {
      if (o.skipGlass && h.store.layer[h.id] !== EL.ARCH) continue;
      if (o.onlyGlass && h.store.layer[h.id] === EL.ARCH) continue;
      if (o.maxSize) {
        const i3 = h.id * 3;
        const sz = Math.max(h.store.bmax[i3] - h.store.bmin[i3], h.store.bmax[i3 + 1] - h.store.bmin[i3 + 1], h.store.bmax[i3 + 2] - h.store.bmin[i3 + 2]);
        if (sz > o.maxSize) { h.store.setDamage(h.id, 0.9); continue; }
      }
      this.debris.breakElement(h.store, h.id, { impact: center, blast, jitter: o.jitter ?? 2, keep: o.keep, vel: o.vel, n: o.n });
      n++;
    }
    if (n && !o.silent) this.film.cue('crumble', { pos: center, strength: Math.min(1, n / 20) });
    return n;
  }

  // crack (damage) elements around a point without breaking
  damageAround(center, radius, amount = 0.6) {
    for (const h of this.city.querySphere(center.x, center.y, center.z, radius)) h.store.setDamage(h.id, Math.max(h.store.getDamage(h.id), amount));
  }

  // glass panes shatter in a ring expanding at `speed` m/s from center (world-time events)
  shatterRing(center, radius, speed = 160, strength = 1) {
    const hits = this.city.querySphere(center.x, center.y, center.z, radius, (s, id) => s.layer[id] !== EL.ARCH);
    const t0 = this.e.time;
    const byDist = hits.map((h) => ({ h, d: h.store.distToBox(h.id, center.x, center.y, center.z) })).sort((a, b) => a.d - b.d);
    let count = 0;
    for (const { h, d } of byDist) {
      const t = t0 + d / speed;
      const k = 1 - d / radius;
      this.film.at(t, () => {
        if (h.store.state[h.id] === 2) return;
        this.debris.breakElement(h.store, h.id, { blast: { pos: center, speed: 6 + 22 * k * strength, radius: 4 } });
        if ((count++ % 6) === 0) this.film.cue('glassBurst', { pos: _v.copy(h.store.center(h.id, _w)).clone(), strength: k });
      });
    }
    // lamps in the ring flicker off, signs spark
    for (const L of this.city.lamps) {
      const d = Math.hypot(L.x - center.x, L.y - center.y, L.z - center.z);
      if (d < radius * 0.7) this.film.at(t0 + d / speed, () => { if (L.on) { L.on = false; this.fx.burst(PT.SPARK, 14, new THREE.Vector3(L.x, L.y, L.z), { speed: 6, life: 0.6, size: 0.02 }); this.debris.breakElement(this.city.street, L.id, { blast: { pos: center, speed: 8, radius: 2 } }); } });
    }
  }

  pushCars(center, radius, speed) {
    for (const car of this.city.cars) {
      if (car.story) continue;
      const d = car.mesh.position.distanceTo(center);
      if (d > radius) continue;
      const k = 1 - d / radius;
      const dir = car.mesh.position.clone().sub(center).setY(0).normalize();
      const vel = dir.multiplyScalar(speed * k).setY(speed * k * 0.35 + 2 * k);
      const b = car.mesh.userData.body || this.debris.addProp(car.mesh, car.half, car.mass);
      if (!b) continue;
      b.v.add(vel);
      b.w.add(new THREE.Vector3((this.rng.next() - 0.5) * 4 * k, (this.rng.next() - 0.5) * 3 * k, (this.rng.next() - 0.5) * 4 * k));
      b.asleep = false; b.sleep = 0;
      car.u.uBroken.value = Math.max(car.u.uBroken.value, k > 0.3 ? 1 : 0);
      if (k > 0.3) this.fx.burst(PT.GLASS, 20, car.mesh.position.clone().setY(1.2), { speed: 5, life: 1.5, size: 0.03, spread: 1.5 });
    }
  }

  // Crater: bowl mesh + ground hole + uplifted asphalt plates + flung chunks + cracks
  crater(center, R, depth, o = {}) {
    const floor = o.floor ?? 0;
    const g = new THREE.BufferGeometry();
    const seg = 56, rings = 16, outer = 1.55;
    const pos = [], arch = [], tint = [], rest = [], restN = [];
    const hfun = (r, a) => {
      const u = r / R;
      const n = (Math.sin(a * 7 + u * 5) * 0.5 + Math.sin(a * 13 - u * 3) * 0.3) * 0.08 * depth;
      if (u < 1) return floor - depth * Math.pow(1 - u * u, 0.7) + n * (1 - u) - 0.02;
      if (u < outer) { const k = (u - 1) / (outer - 1); return floor + depth * 0.18 * Math.sin(Math.PI * Math.min(1, k * 1.2)) * (1 - k) + n * 0.3; }
      return floor;
    };
    const verts = [];
    for (let i = 0; i <= rings; i++) {
      const u = Math.pow(i / rings, 0.8) * outer;
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        const r = u * R;
        verts.push([center.x + Math.cos(a) * r, hfun(r, a), center.z + Math.sin(a) * r, u]);
      }
    }
    const idx = [];
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
      idx.push(a, c, b, b, c, d);
    }
    for (const v of verts) {
      pos.push(v[0], v[1], v[2]);
      rest.push(v[0], v[1], v[2]);
      restN.push(0, 1, 0);
      const inner = v[3] < 1.0;
      arch.push(inner ? KIND.DIRT : KIND.ASPHALT, 0.3, 0.6, inner ? 1 : 0);
      tint.push(1, 1, 1);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aArch', new THREE.Float32BufferAttribute(arch, 4));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, this.e.ctx.mats.arch);
    mesh.receiveShadow = true; mesh.castShadow = true;
    this.craterGroup.add(mesh);
    this.craters.push({ mesh, center: center.clone(), R });
    // cut the road surface
    const holes = this.e.city.ground.material.userData.u.uHoles.value;
    const slot = holes.find((h) => h.z === 0) || holes[this.craters.length % holes.length];
    slot.set(center.x, center.z, R * outer * 0.98, 1);
    // uplifted plates around the rim (pinned chunks of a virtual asphalt slab)
    const slabR = R * outer * 1.05;
    const hx = slabR, hy = 0.1, hz = slabR;
    const seeds = [];
    for (let i = 0; i < 44; i++) { const a = this.rng.next() * Math.PI * 2, r = R * (0.95 + this.rng.next() * 0.55); seeds.push([Math.cos(a) * r, 0, Math.sin(a) * r]); }
    for (let i = 0; i < 10; i++) { const a = this.rng.next() * Math.PI * 2, r = R * (0.2 + this.rng.next() * 0.6); seeds.push([Math.cos(a) * r, 0, Math.sin(a) * r]); }
    const cells = voronoiCells(hx, hy, hz, seeds, 10);
    const q = new THREE.Quaternion();
    const kept = cells.filter((c) => { const r = Math.hypot(c.centroid[0], c.centroid[2]); return r > R * 0.9 && r < R * 1.6; });
    const batch = this.debris.makeBatch(kept, new THREE.Vector3(center.x, floor - 0.1, center.z), q, KIND.ASPHALT, [1, 1, 1], 0.5, null);
    kept.forEach((c, i) => {
      const b = this.debris.newBody();
      if (!b) return;
      b.batch = batch; b.ci = i; b.kind = 0;
      b.p.set(center.x + c.centroid[0], floor - 0.12 + c.centroid[1], center.z + c.centroid[2]);
      const r = Math.hypot(c.centroid[0], c.centroid[2]);
      const tangent = new THREE.Vector3(-c.centroid[2], 0, c.centroid[0]).normalize();
      const lift = (0.12 + this.rng.next() * 0.35) * Math.max(0.1, 1.55 - r / R);
      b.q.setFromAxisAngle(tangent, -lift);
      // hinge on the outer edge: raise so the lowest corner touches the road
      b.p.y = floor - 0.02 + Math.sin(lift) * Math.max(c.ext[0], c.ext[2]) * 0.55 + 0.1 * Math.cos(lift);
      b.h.set(c.ext[0], c.ext[1], c.ext[2]);
      const m = c.volume * 2300; b.invMass = 1 / m; b.invI.set(12 / m, 12 / m, 12 / m); b.r = Math.hypot(...c.ext);
      b.asleep = true; b.pinned = true;
      this.debris.writeChunk(b);
    });
    // flung asphalt/dirt chunks from the bowl
    const flung = cells.filter((c) => Math.hypot(c.centroid[0], c.centroid[2]) <= R * 0.9);
    if (flung.length) {
      const fb = this.debris.makeBatch(flung, new THREE.Vector3(center.x, floor - 0.12, center.z), q, KIND.ASPHALT, [1, 1, 1], 0.7, null);
      flung.forEach((c, i) => {
        const b = this.debris.newBody();
        if (!b) return;
        b.batch = fb; b.ci = i; b.kind = 0;
        b.p.set(center.x + c.centroid[0], floor + 0.3, center.z + c.centroid[2]);
        b.h.set(c.ext[0], c.ext[1], c.ext[2]);
        const m = Math.max(c.volume * 2300, 5); b.invMass = 1 / m; b.invI.set(12 / m, 12 / m, 12 / m); b.r = Math.hypot(...c.ext);
        const out = new THREE.Vector3(c.centroid[0], 0, c.centroid[2]).normalize();
        b.v.copy(out).multiplyScalar(4 + this.rng.next() * 10 * (o.power ?? 1)).setY(6 + this.rng.next() * 14 * (o.power ?? 1));
        b.w.set((this.rng.next() - 0.5) * 12, (this.rng.next() - 0.5) * 12, (this.rng.next() - 0.5) * 12);
        b.rest = 0.15; b.fric = 0.7;
        this.debris.writeChunk(b);
      });
    }
    // break nearby sidewalks/props, cracks, dust, fx
    this.breakAround(new THREE.Vector3(center.x, floor + 0.2, center.z), R * 1.3, { speed: 10, skipGlass: false, maxSize: 12, silent: true });
    this.fx.crack(new THREE.Vector3(center.x, floor, center.z), R * 4.5, { grow: 0.35, intensity: 1, glow: o.glow ?? 0 });
    this.fx.scorch(new THREE.Vector3(center.x, floor, center.z), R * 1.2);
    this.fx.groundSlam(new THREE.Vector3(center.x, floor, center.z), Math.min(1.5, R / 5), { floor, glow: o.glow });
    this.film.cue('crater', { pos: center.clone(), strength: Math.min(1.5, R / 5) });
    return mesh;
  }

  // push-off crater when a fighter launches
  launch(fighterName, strength = 1) {
    const f = this.F(fighterName);
    const p = f.anim.bonePos['foot.R'].clone(); p.y = 0.05;
    this.fx.burst(PT.RING, Math.round(20 + 40 * strength), p, { flat: 0.08, speed: 10 + 15 * strength, life: 1.2, size: 0.6 + 0.6 * strength, spread: 0.4 });
    this.fx.burst(PT.CHIP, Math.round(20 + 50 * strength), p, { dir: new THREE.Vector3(0, 1, 0), cone: 1.0, speed: 6 + 10 * strength, life: 2, size: 0.05, spread: 0.6 });
    this.fx.burst(PT.DUST, Math.round(10 + 20 * strength), p, { up: 0.8, speed: 3 + 5 * strength, life: 2.5, size: 0.8, spread: 0.8 });
    this.fx.crack(p, 2 + 3 * strength, { grow: 0.08 });
    this.fx.shake(0.3 * strength, 0.1);
    this.film.cue('launch', { pos: p, strength, fighter: fighterName });
  }
}

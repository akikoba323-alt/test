// Debris physics and rendering.
//   ChunkBatch: one broken element = one draw call; chunk transforms live in uniform arrays.
//   Rigid bodies: box-corner contacts against the ground, intact floor slabs and building shells,
//   restitution + friction impulses, sleeping, shockwave pushes, fighter kicks, and secondary
//   fracture when big chunks land hard. Glass shards are instanced prototypes; cars are bodies too.
import * as THREE from 'three';
import { voronoiCells, impactSeeds, glassSeeds, clipPoly, boxPolyhedron } from './fracture.js';
import { makeArchMaterial, KIND } from '../world/archmat.js';
import { EL } from '../world/elements.js';
import { RNG } from '../core/rng.js';
import { PT } from './particles.js';

const MAXC = 48;
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();

// ---- chunk material (arch surface + per-chunk rigid transforms) --------------------------
const CHUNK_VERT_PARS = `
uniform vec4 uCP[${MAXC}];
uniform vec4 uCQ[${MAXC}];
attribute float aChunk;
vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
`;
function patchChunk(sh, u) {
  sh.uniforms.uCP = u.uCP; sh.uniforms.uCQ = u.uCQ;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + CHUNK_VERT_PARS)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
{ int ci = int(aChunk + 0.5); objectNormal = qrot(uCQ[ci], objectNormal); }`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
{ int ci = int(aChunk + 0.5); transformed = qrot(uCQ[ci], transformed) + uCP[ci].xyz; }`);
}

let chunkTemplate = null;
function makeChunkMaterials(noise2D, u) {
  const m = makeArchMaterial(noise2D, { chunks: true });
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => { base(sh); patchChunk(sh, u); };
  m.customProgramCacheKey = () => 'archChunk';
  const d = new THREE.MeshDepthMaterial();
  d.onBeforeCompile = (sh) => patchChunk(sh, u);
  d.customProgramCacheKey = () => 'archChunkDepth';
  return { mat: m, depth: d };
}

// ---- body storage -----------------------------------------------------------------------
class Body {
  constructor() {
    this.p = new THREE.Vector3(); this.v = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.w = new THREE.Vector3();
    this.h = new THREE.Vector3(); // half extents (local AABB)
    this.invMass = 1; this.invI = new THREE.Vector3(1, 1, 1); this.r = 0.5;
    this.sleep = 0; this.asleep = false; this.age = 0; this.kind = 0; this.rest = 0.2; this.fric = 0.6;
    this.batch = null; this.ci = -1; this.shard = -1; this.prop = null; this.volume = 0; this.gen = 0;
    this.alive = true; this.lastHit = -10; this.cell = null; this.floorY = 0;
  }
}

export class Debris {
  constructor(engine) {
    this.e = engine;
    this.fx = engine.fx;
    this.rng = new RNG(4321);
    this.bodies = [];
    this.batches = [];
    this.group = new THREE.Group();
    engine.scene.add(this.group);
    this.maxBodies = engine.q.maxDebris || 5000;
    this.buildGlassShards();
    this.events = []; // landing impacts for audio {t, pos, speed, kind, mass}
    this.floorFn = (x, y, z) => 0;
    this.obstacles = []; // building shell AABBs [x0,y0,z0,x1,y1,z1]
    this.movers = [];    // fighter capsules {a:Vector3, b:Vector3, r, vel}
    this.time = 0;
  }

  reset() {
    for (const b of this.bodies) if (b.prop) b.prop.userData.body = null;
    for (const b of this.batches) { this.group.remove(b.mesh); b.mesh.geometry.dispose(); }
    this.batches.length = 0;
    this.bodies.length = 0;
    this.shardFree = [];
    for (let i = this.shardCap - 1; i >= 0; i--) this.shardFree.push(i);
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < this.shardCap; i++) this.shardMesh.setMatrixAt(i, _m);
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.events.length = 0;
  }

  // ---------------------------------------------------------------------------------------
  // Break an element into Voronoi chunks. opts: {impact: Vector3, vel: Vector3 (bulk), blast: {pos, speed}, n, keep: 0..1 fraction staying put, spin}
  breakElement(store, id, opts = {}) {
    if (store.state[id] === 2) return null;
    const layer = store.layer[id];
    const pos = new THREE.Vector3(), size = new THREE.Vector3();
    const quat = store.getBox(id, pos, size);
    store.hide(id);
    const kind = store.kind[id];
    const tint = [store.tint[id * 3], store.tint[id * 3 + 1], store.tint[id * 3 + 2]];
    const seed = store.seed[id];
    const camD = this.e.camera.position.distanceTo(pos);
    const vol = size.x * size.y * size.z;
    if (layer !== EL.ARCH) return this.shatterGlass(pos, size, quat, opts, camD);
    // small or thin items: break into few pieces or stay whole
    let n = opts.n ?? Math.round(Math.min(MAXC - 4, 4 + Math.cbrt(vol) * 7));
    if (kind === KIND.WOOD || kind === KIND.PLASTIC || kind === KIND.SIGN) n = Math.min(n, vol < 0.5 ? 1 : 3);
    if (kind === KIND.ALU || kind === KIND.STEEL) n = Math.min(n, Math.max(1, Math.round(Math.max(size.x, size.y, size.z) / 1.5)));
    if (camD > 90) n = Math.min(n, 6);
    else if (camD > 45) n = Math.min(n, 12);
    const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2;
    const inv = quat.clone().invert();
    const imp = opts.impact ? opts.impact.clone().sub(pos).applyQuaternion(inv) : null;
    const impL = imp ? [imp.x, imp.y, imp.z] : null;
    let cells;
    if (n <= 1) cells = [{ faces: boxPolyhedron(hx, hy, hz), volume: vol, centroid: [0, 0, 0] }];
    else if ((kind === KIND.ALU || kind === KIND.STEEL) && n > 1) {
      // slice long members into segments along their major axis
      cells = sliceMember(hx, hy, hz, n, this.rng);
    } else cells = voronoiCells(hx, hy, hz, impactSeeds(hx, hy, hz, impL, n, this.rng, opts.focus ?? 0.55), 12);
    const structural = kind === KIND.CONCRETE || kind === KIND.SLAB || (store.flags[id] & 2);
    const batch = this.makeBatch(cells, pos, quat, kind, tint, seed, structural ? size : null);
    const mat = kind === KIND.STEEL || kind === KIND.ALU ? 'metal' : kind === KIND.WOOD || kind === KIND.PLASTIC ? 'light' : 'stone';
    const density = mat === 'metal' ? 1500 : mat === 'light' ? 300 : 2300;
    // bodies
    const blast = opts.blast;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const b = this.newBody();
      if (!b) break;
      b.batch = batch; b.ci = i; b.kind = mat === 'stone' ? 0 : mat === 'metal' ? 1 : 2;
      b.p.set(c.centroid[0], c.centroid[1], c.centroid[2]).applyQuaternion(quat).add(pos);
      b.q.copy(quat);
      const ext = c.ext;
      b.h.set(ext[0], ext[1], ext[2]);
      const m = Math.max(c.volume * density, 0.2);
      b.invMass = 1 / m;
      b.invI.set(12 / (m * (4 * (ext[1] ** 2 + ext[2] ** 2) + 1e-4)), 12 / (m * (4 * (ext[0] ** 2 + ext[2] ** 2) + 1e-4)), 12 / (m * (4 * (ext[0] ** 2 + ext[1] ** 2) + 1e-4)));
      b.r = Math.hypot(ext[0], ext[1], ext[2]);
      b.volume = c.volume;
      b.rest = mat === 'metal' ? 0.3 : 0.15;
      b.fric = 0.7;
      b.gen = opts.gen ?? 0;
      // velocity: bulk + radial from blast + random
      if (opts.vel) b.v.copy(opts.vel);
      if (blast) {
        _v.copy(b.p).sub(blast.pos);
        const d = _v.length() || 1;
        const sp = blast.speed * Math.min(1.6, 1.2 / Math.max(0.35, d / Math.max(blast.radius || 2, 0.1)));
        b.v.addScaledVector(_v.divideScalar(d), sp * (0.6 + this.rng.next() * 0.8));
      }
      b.v.x += (this.rng.next() - 0.5) * (opts.jitter ?? 2); b.v.y += (this.rng.next() - 0.3) * (opts.jitter ?? 2); b.v.z += (this.rng.next() - 0.5) * (opts.jitter ?? 2);
      const spin = opts.spin ?? 6;
      b.w.set((this.rng.next() - 0.5) * spin, (this.rng.next() - 0.5) * spin, (this.rng.next() - 0.5) * spin);
      // keep some chunks in place (cracked but attached)
      if (opts.keep && this.rng.next() < opts.keep && (!impL || Math.hypot(c.centroid[0] - impL[0], c.centroid[1] - impL[1], c.centroid[2] - impL[2]) > Math.max(hx, hy, hz) * 0.45)) {
        b.v.set(0, 0, 0); b.w.set(0, 0, 0); b.asleep = true; b.pinned = true;
      }
      this.writeChunk(b);
    }
    return batch;
  }

  // wake pinned chunks of batches around a point (secondary collapse)
  release(center, radius, push = 2) {
    for (const b of this.bodies) {
      if (!b.alive || !b.pinned) continue;
      if (b.p.distanceTo(center) < radius) { b.pinned = false; b.asleep = false; b.sleep = 0; b.v.set((this.rng.next() - 0.5) * push, -this.rng.next() * push, (this.rng.next() - 0.5) * push); }
    }
  }

  makeBatch(cells, pos, quat, kind, tint, seed, rebarSize) {
    const P = [], N = [], C = [], R = [], RN = [], A = [], T = [];
    const rq = quat;
    const addTri = (a, b, c, n, ci, cen, interior, k = kind, tn = tint) => {
      for (const v of [a, b, c]) {
        P.push(v[0] - cen[0], v[1] - cen[1], v[2] - cen[2]);
        N.push(n[0], n[1], n[2]);
        C.push(ci);
        _v.set(v[0], v[1], v[2]).applyQuaternion(rq).add(pos);
        R.push(_v.x, _v.y, _v.z);
        _w.set(n[0], n[1], n[2]).applyQuaternion(rq);
        RN.push(_w.x, _w.y, _w.z);
        A.push(k, seed, 0.2, interior ? 1 : 0);
        T.push(tn[0], tn[1], tn[2]);
      }
    };
    cells.forEach((c, ci) => {
      const cen = c.centroid;
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const f of c.faces) {
        for (const p of f.pts) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k] - cen[k]); mx[k] = Math.max(mx[k], p[k] - cen[k]); }
        for (let i = 1; i < f.pts.length - 1; i++) addTri(f.pts[0], f.pts[i], f.pts[i + 1], f.n, ci, cen, !f.outer);
      }
      c.ext = [Math.max(Math.abs(mn[0]), mx[0]), Math.max(Math.abs(mn[1]), mx[1]), Math.max(Math.abs(mn[2]), mx[2])];
      // rebar through structural chunks: short rods along the major axis sticking out
      if (rebarSize && c.volume > 0.004) {
        const ax = rebarSize.y > rebarSize.x && rebarSize.y > rebarSize.z ? 1 : rebarSize.x > rebarSize.z ? 0 : 2;
        const hs = [rebarSize.x / 2, rebarSize.y / 2, rebarSize.z / 2];
        for (const [o1, o2] of [[0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
          const line = [0, 0, 0];
          const a1 = (ax + 1) % 3, a2 = (ax + 2) % 3;
          line[a1] = o1 * hs[a1]; line[a2] = o2 * hs[a2];
          // clip the line to the cell using its face planes
          let t0 = -hs[ax], t1 = hs[ax];
          let ok = true;
          for (const f of c.faces) {
            const n = f.n, p0 = f.pts[0];
            const d = n[0] * p0[0] + n[1] * p0[1] + n[2] * p0[2];
            const base = n[0] * line[0] + n[1] * line[1] + n[2] * line[2] - n[ax] * line[ax];
            const dn = n[ax];
            if (Math.abs(dn) < 1e-6) { if (base > d + 1e-6) { ok = false; break; } continue; }
            const t = (d - base) / dn;
            if (dn > 0) t1 = Math.min(t1, t); else t0 = Math.max(t0, t);
          }
          if (!ok || t1 - t0 < 0.05) continue;
          const ext = 0.12 + this.rng.next() * 0.35;
          const s0 = t0 - (t0 > -hs[ax] + 0.01 ? ext : 0), s1 = t1 + (t1 < hs[ax] - 0.01 ? ext : 0);
          const bend = (this.rng.next() - 0.5) * 0.25;
          const pa = line.slice(), pb = line.slice();
          pa[ax] = s0; pb[ax] = s1;
          pb[a1] += bend; pb[a2] += bend * 0.5;
          addRod(pa, pb, 0.012, (a, b, cc, n) => addTri(a, b, cc, n, ci, cen, false, KIND.STEEL, [0.12, 0.06, 0.035]));
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('aChunk', new THREE.Float32BufferAttribute(C, 1));
    g.setAttribute('aRest', new THREE.Float32BufferAttribute(R, 3));
    g.setAttribute('aRestN', new THREE.Float32BufferAttribute(RN, 3));
    g.setAttribute('aArch', new THREE.Float32BufferAttribute(A, 4));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(T, 3));
    const u = { uCP: { value: Array.from({ length: MAXC }, () => new THREE.Vector4()) }, uCQ: { value: Array.from({ length: MAXC }, () => new THREE.Vector4(0, 0, 0, 1)) } };
    const { mat, depth } = makeChunkMaterials(this.e.noise2D, u);
    const mesh = new THREE.Mesh(g, mat);
    mesh.customDepthMaterial = depth;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    const batch = { mesh, u, count: cells.length, dirty: true, born: this.time };
    this.batches.push(batch);
    return batch;
  }

  writeChunk(b) {
    const u = b.batch.u;
    u.uCP.value[b.ci].set(b.p.x, b.p.y, b.p.z, 1);
    u.uCQ.value[b.ci].set(b.q.x, b.q.y, b.q.z, b.q.w);
  }

  newBody() {
    if (this.bodies.length >= this.maxBodies) {
      // recycle the oldest sleeping non-pinned body (it stays visible where it lies)
      const idx = this.bodies.findIndex((b) => b.asleep && !b.pinned && !b.prop);
      if (idx < 0) return null;
      this.bodies.splice(idx, 1);
    }
    const b = new Body();
    this.bodies.push(b);
    return b;
  }

  // ---------------------------------------------------------------------------------------
  // Glass: large shards as instanced prototypes + glitter particles
  buildGlassShards() {
    const protos = [];
    const rng = new RNG(8);
    const g = new THREE.BufferGeometry();
    const pos = [], nrm = [];
    // single canonical shard: irregular triangle prism, scaled per instance
    const tri = [[-0.5, -0.45], [0.55, -0.3], [-0.1, 0.55]];
    const t = 0.5;
    const push = (a, b, c) => {
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      const l = Math.hypot(...n) || 1;
      for (const v of [a, b, c]) { pos.push(...v); nrm.push(n[0] / l, n[1] / l, n[2] / l); }
    };
    const top = tri.map(([x, y]) => [x, y, t]), bot = tri.map(([x, y]) => [x, y, -t]);
    push(top[0], top[1], top[2]); push(bot[0], bot[2], bot[1]);
    for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; push(bot[i], bot[j], top[j]); push(bot[i], top[j], top[i]); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x9fb8c0, roughness: 0.04, metalness: 0.0, transmission: 0.0, transparent: true, opacity: 0.55, envMapIntensity: 2.2, side: THREE.DoubleSide, specularIntensity: 1 });
    this.shardCap = 3000;
    this.shardMesh = new THREE.InstancedMesh(g, mat, this.shardCap);
    this.shardMesh.frustumCulled = false;
    this.shardMesh.castShadow = false;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < this.shardCap; i++) this.shardMesh.setMatrixAt(i, _m);
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.shardMesh);
    this.shardFree = [];
    for (let i = this.shardCap - 1; i >= 0; i--) this.shardFree.push(i);
  }

  shatterGlass(pos, size, quat, opts, camD) {
    const fx = this.fx, rng = this.rng;
    const area = size.x * size.y;
    const n = camD < 30 ? Math.round(Math.min(22, 5 + area * 2.5)) : camD < 70 ? Math.round(Math.min(6, 2 + area * 0.5)) : camD < 140 ? 1 : 0;
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const blast = opts.blast;
    const out = blast ? normal.clone().multiplyScalar(Math.sign(normal.dot(_v.copy(pos).sub(blast.pos))) || 1) : normal;
    for (let i = 0; i < n; i++) {
      const si = this.shardFree.pop();
      if (si === undefined) break;
      const b = this.newBody();
      if (!b) { this.shardFree.push(si); break; }
      b.shard = si; b.kind = 3;
      const lx = (rng.next() - 0.5) * size.x * 0.9, ly = (rng.next() - 0.5) * size.y * 0.9;
      b.p.set(lx, ly, 0).applyQuaternion(quat).add(pos);
      const s = Math.sqrt(area / n) * (0.5 + rng.next() * 0.9);
      b.h.set(s * 0.5, s * 0.5, 0.012);
      b.scale = s;
      b.q.copy(quat).multiply(_q.setFromAxisAngle(_v.set(0, 0, 1), rng.next() * 6.28));
      const m = s * s * 0.012 * 2500 + 0.05;
      b.invMass = 1 / m; b.invI.set(10 / m, 10 / m, 10 / m); b.r = s * 0.7; b.rest = 0.1; b.fric = 0.4;
      const sp = blast ? blast.speed * (0.5 + rng.next() * 0.8) : 2 + rng.next() * 3;
      b.v.copy(out).multiplyScalar(sp).add(_v.set((rng.next() - 0.5) * 3, rng.next() * 2, (rng.next() - 0.5) * 3));
      if (opts.vel) b.v.add(opts.vel);
      b.w.set((rng.next() - 0.5) * 14, (rng.next() - 0.5) * 14, (rng.next() - 0.5) * 14);
      this.writeShard(b);
    }
    // glitter
    const gl = camD < 60 ? Math.round(16 + area * 6) : Math.round(4 + area * 1.5);
    fx.burst(PT.GLASS, gl, pos, { dir: out, cone: 1.2, speed: (blast ? blast.speed : 3) * 0.9, life: 2.2, size: 0.04, spread: Math.max(size.x, size.y) * 0.8 });
    this.events.push({ t: this.time, pos: pos.clone(), speed: 10, kind: 'glass', mass: area, camD });
    return null;
  }

  writeShard(b) {
    _s.set(b.scale, b.scale, 0.02);
    _m.compose(b.p, b.q, _s);
    this.shardMesh.setMatrixAt(b.shard, _m);
    this.shardDirty = true;
  }

  // Cars and other props as rigid bodies
  addProp(obj, half, mass, opts = {}) {
    if (obj.userData.body && obj.userData.body.alive) {
      const b0 = obj.userData.body;
      if (opts.vel) b0.v.copy(opts.vel);
      if (opts.spin) b0.w.copy(opts.spin);
      b0.asleep = false; b0.sleep = 0;
      return b0;
    }
    const b = this.newBody();
    if (!b) return null;
    b.prop = obj; b.kind = 1;
    b.p.copy(obj.position); b.q.copy(obj.quaternion);
    // obj origin is at its base: store the offset so the body center is the box center
    b.offset = new THREE.Vector3(0, half.y, 0);
    b.p.add(_v.copy(b.offset).applyQuaternion(b.q));
    b.h.copy(half);
    b.invMass = 1 / mass;
    b.invI.set(12 / (mass * (4 * (half.y ** 2 + half.z ** 2))), 12 / (mass * (4 * (half.x ** 2 + half.z ** 2))), 12 / (mass * (4 * (half.x ** 2 + half.y ** 2))));
    b.r = half.length(); b.rest = 0.25; b.fric = 0.55;
    if (opts.vel) b.v.copy(opts.vel);
    if (opts.spin) b.w.copy(opts.spin);
    obj.userData.body = b;
    return b;
  }

  // ---------------------------------------------------------------------------------------
  applyBlast(center, radius, speed, up = 0.3) {
    for (const b of this.bodies) {
      if (!b.alive || b.pinned) continue;
      _v.copy(b.p).sub(center);
      const d = _v.length();
      if (d > radius) continue;
      const k = 1 - d / radius;
      _v.divideScalar(d || 1);
      _v.y += up;
      b.v.addScaledVector(_v, speed * k);
      b.w.x += (this.rng.next() - 0.5) * 8 * k; b.w.z += (this.rng.next() - 0.5) * 8 * k;
      b.asleep = false; b.sleep = 0;
    }
  }

  step(dt, time) {
    this.time = time;
    if (dt <= 0) return;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let s = 0; s < n; s++) this.substep(h, time - dt + (s + 1) * h);
    // write render transforms
    for (const b of this.bodies) {
      if (!b.alive || (b.asleep && !b.justSlept && !b.follow)) continue;
      b.justSlept = false;
      if (b.batch) { this.writeChunk(b); b.batch.dirty = true; }
      else if (b.shard >= 0) this.writeShard(b);
      else if (b.prop) {
        b.prop.quaternion.copy(b.q);
        b.prop.position.copy(b.p).sub(_v.copy(b.offset).applyQuaternion(b.q));
      }
    }
    if (this.shardDirty) { this.shardMesh.instanceMatrix.needsUpdate = true; this.shardDirty = false; }
  }

  substep(h, time) {
    const g = -9.81;
    const corners = this._corners || (this._corners = Array.from({ length: 8 }, () => new THREE.Vector3()));
    for (const b of this.bodies) {
      if (!b.alive) continue;
      if (b.follow) {
        // kinematic: carried by a fighter (blends in from the body's current pose)
        const f = b.follow;
        let np = f.fighter.anim.bonePos[f.bone].clone().add(new THREE.Vector3(...f.offset).applyQuaternion(f.fighter.anim.rootQuat));
        if (f.bone2) np.add(f.fighter.anim.bonePos[f.bone2]).sub(f.fighter.anim.bonePos[f.bone]).multiplyScalar(0.5).add(f.fighter.anim.bonePos[f.bone]).add(new THREE.Vector3(...f.offset).applyQuaternion(f.fighter.anim.rootQuat)).sub(np).add(np);
        if (f.t0 !== undefined && time < f.t0 + f.blend) {
          const k = Math.max(0, Math.min(1, (time - f.t0) / f.blend));
          const kk = k * k * (3 - 2 * k);
          if (!f.startP) { f.startP = b.p.clone(); f.startQ = b.q.clone(); }
          np = f.startP.clone().lerp(np, kk);
          if (f.quat) { const tq = f.fighter.anim.rootQuat.clone().multiply(f.quat); b.q.copy(f.startQ).slerp(tq, kk); }
        } else if (f.quat) b.q.copy(f.fighter.anim.rootQuat).multiply(f.quat);
        b.v.copy(np).sub(b.p).divideScalar(Math.max(h, 1e-4));
        b.p.copy(np);
        b.w.set(0, 0, 0); b.asleep = false;
        continue;
      }
      if (b.asleep) continue;
      b.age += h;
      b.v.y += g * h;
      // light air drag (stronger for small pieces)
      const dragK = b.shard >= 0 ? 0.6 : 0.02 + 0.05 / Math.max(b.r, 0.1);
      b.v.multiplyScalar(Math.exp(-dragK * h));
      b.w.multiplyScalar(Math.exp(-0.25 * h));
      b.p.addScaledVector(b.v, h);
      // integrate orientation
      const wl = b.w.length();
      if (wl > 1e-5) { _q.setFromAxisAngle(_v.copy(b.w).divideScalar(wl), wl * h); b.q.premultiply(_q).normalize(); }
      // fighter kicks
      for (const m of this.movers) {
        const d = distPointSeg(b.p, m.a, m.b);
        if (d < m.r + b.r * 0.5 && m.vel.lengthSq() > 4) {
          _v.copy(b.p).sub(closestPointSeg(b.p, m.a, m.b, _w)).normalize();
          const push = m.vel.length() * 0.9;
          b.v.addScaledVector(m.vel, 0.7).addScaledVector(_v, push * 0.4);
          b.w.addScaledVector(_v.set(this.rng.next() - 0.5, this.rng.next() - 0.5, this.rng.next() - 0.5), 12);
        }
      }
      // contacts: corners vs floor (cached lookup; refreshed every few steps)
      if (!(b.floorAge > 0) || Math.abs(b.p.y - b.floorQY) > 1.5) { b.floorCache = this.floorFn(b.p.x, b.p.y + b.r, b.p.z); b.floorAge = 6; b.floorQY = b.p.y; }
      b.floorAge--;
      const floorY = b.floorCache;
      b.floorY = floorY;
      if (b.p.y - b.r < floorY) {
        let deepest = 0, ci = -1;
        for (let k = 0; k < 8; k++) {
          const c = corners[k].set(k & 1 ? b.h.x : -b.h.x, k & 2 ? b.h.y : -b.h.y, k & 4 ? b.h.z : -b.h.z).applyQuaternion(b.q).add(b.p);
          const pen = floorY - c.y;
          if (pen > deepest) { deepest = pen; ci = k; }
        }
        if (ci >= 0) {
          const c = corners[ci];
          b.p.y += deepest;
          c.y += deepest;
          this.resolveContact(b, c, _w.set(0, 1, 0), time);
        }
      }
      // building shells: push out horizontally
      if (b.shard < 0) for (const o of this.obstacles) {
        if (b.p.x > o[0] && b.p.x < o[3] && b.p.y > o[1] && b.p.y < o[4] && b.p.z > o[2] && b.p.z < o[5]) {
          const dx0 = b.p.x - o[0], dx1 = o[3] - b.p.x, dz0 = b.p.z - o[2], dz1 = o[5] - b.p.z;
          const m = Math.min(dx0, dx1, dz0, dz1);
          if (m > 2.5) continue; // deep inside (interior debris) - let it be
          if (m === dx0) { b.p.x = o[0]; if (b.v.x > 0) b.v.x *= -0.25; }
          else if (m === dx1) { b.p.x = o[3]; if (b.v.x < 0) b.v.x *= -0.25; }
          else if (m === dz0) { b.p.z = o[2]; if (b.v.z > 0) b.v.z *= -0.25; }
          else { b.p.z = o[5]; if (b.v.z < 0) b.v.z *= -0.25; }
        }
      }
      // sleeping
      const e = b.v.lengthSq() + b.w.lengthSq() * b.r * b.r;
      if (e < 0.02 && b.p.y - b.r < floorY + 0.05) { b.sleep += h; if (b.sleep > 0.4) { b.asleep = true; b.justSlept = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0); } }
      else b.sleep = 0;
      if (b.p.y < -60) { b.alive = false; }
    }
  }

  resolveContact(b, c, n, time) {
    const r = _v.copy(c).sub(b.p);
    // velocity at contact
    const vc = new THREE.Vector3().crossVectors(b.w, r).add(b.v);
    const vn = vc.dot(n);
    if (vn >= 0) return;
    // world inverse inertia (approx: use local diag rotated)
    const invIw = (vec) => {
      const lq = b.q.clone().invert();
      const l = vec.clone().applyQuaternion(lq);
      l.set(l.x * b.invI.x, l.y * b.invI.y, l.z * b.invI.z);
      return l.applyQuaternion(b.q);
    };
    const rn = new THREE.Vector3().crossVectors(r, n);
    const k = b.invMass + new THREE.Vector3().crossVectors(invIw(rn), r).dot(n);
    const e = Math.abs(vn) > 2 ? b.rest : 0;
    const j = -(1 + e) * vn / k;
    b.v.addScaledVector(n, j * b.invMass);
    b.w.add(invIw(rn).multiplyScalar(j));
    // friction
    const vt = vc.clone().addScaledVector(n, -vn);
    const vtl = vt.length();
    if (vtl > 1e-4) {
      const t = vt.divideScalar(vtl);
      const rt = new THREE.Vector3().crossVectors(r, t);
      const kt = b.invMass + new THREE.Vector3().crossVectors(invIw(rt), r).dot(t);
      const jt = Math.max(-vtl / kt, -b.fric * j);
      b.v.addScaledVector(t, jt * b.invMass);
      b.w.add(invIw(rt).multiplyScalar(jt));
    }
    // landing events (audio / dust) and secondary fracture
    const speed = -vn;
    if (speed > 3 && time - b.lastHit > 0.15) {
      b.lastHit = time;
      const mass = 1 / b.invMass;
      this.events.push({ t: time, pos: c.clone(), speed, kind: b.kind === 3 ? 'glass' : b.kind === 1 ? 'metal' : 'stone', mass });
      if (b.kind === 0 && mass > 40) this.fx.burst(PT.DUST, Math.min(12, 2 + Math.round(mass / 150)), c, { speed: 1.5 + speed * 0.2, life: 2, size: 0.3 + Math.min(1.5, Math.cbrt(mass) * 0.08), spread: b.r });
      if (b.kind === 0) this.fx.burst(PT.CHIP, Math.min(10, 2 + Math.round(speed)), c, { dir: n, cone: 1.3, speed: speed * 0.3, life: 1.2, size: 0.04, spread: b.r * 0.5 });
      if (b.kind === 1 && speed > 6) this.fx.burst(PT.SPARK, 8, c, { dir: n, cone: 1.2, speed: speed * 0.8, life: 0.4, size: 0.02 });
      if (b.kind === 3 && speed > 4 && b.shard >= 0) {
        // shard shatters into glitter on hard landing
        this.fx.burst(PT.GLASS, 12, c, { dir: n, cone: 1.4, speed: speed * 0.35, life: 1.2, size: 0.03, spread: b.r * 0.5 });
        b.alive = false;
        _m.makeScale(0, 0, 0); this.shardMesh.setMatrixAt(b.shard, _m); this.shardDirty = true; this.shardFree.push(b.shard);
      }
      if (b.kind === 0 && b.gen < 1 && speed > 9 && b.volume > 0.25 && b.batch) this.secondary(b, c, speed);
    }
  }

  // re-fracture a big chunk that landed hard
  secondary(b, contact, speed) {
    b.alive = false;
    // hide it in its batch
    b.batch.u.uCP.value[b.ci].set(0, -1e4, 0, 1);
    b.batch.dirty = true;
    const size = new THREE.Vector3(b.h.x * 2, b.h.y * 2, b.h.z * 2);
    const hx = b.h.x, hy = b.h.y, hz = b.h.z;
    const inv = b.q.clone().invert();
    const imp = contact.clone().sub(b.p).applyQuaternion(inv);
    const cells = voronoiCells(hx, hy, hz, impactSeeds(hx, hy, hz, [imp.x, imp.y, imp.z], 7, this.rng, 0.5), 8);
    const batch = this.makeBatch(cells, b.p.clone(), b.q.clone(), KIND.CONCRETE, [1, 1, 1], this.rng.next(), null);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const nb = this.newBody();
      if (!nb) break;
      nb.batch = batch; nb.ci = i; nb.kind = 0; nb.gen = b.gen + 1;
      nb.p.set(c.centroid[0], c.centroid[1], c.centroid[2]).applyQuaternion(b.q).add(b.p);
      nb.q.copy(b.q);
      nb.h.set(c.ext[0], c.ext[1], c.ext[2]);
      const m = Math.max(c.volume * 2300, 0.2);
      nb.invMass = 1 / m; nb.invI.set(12 / (m * 0.5), 12 / (m * 0.5), 12 / (m * 0.5));
      nb.r = Math.hypot(...c.ext); nb.volume = c.volume; nb.rest = 0.15; nb.fric = 0.7;
      nb.v.copy(b.v).multiplyScalar(0.3);
      nb.v.x += (this.rng.next() - 0.5) * speed * 0.5; nb.v.z += (this.rng.next() - 0.5) * speed * 0.5; nb.v.y = Math.abs(nb.v.y) * 0.2 + this.rng.next() * speed * 0.3;
      nb.w.set((this.rng.next() - 0.5) * 10, (this.rng.next() - 0.5) * 10, (this.rng.next() - 0.5) * 10);
      this.writeChunk(nb);
    }
    this.fx.burst(PT.DUST, 14, contact, { speed: 3 + speed * 0.2, life: 2.5, size: 0.8, spread: b.r });
  }
}

function addRod(a, b, r, tri) {
  // square rod between a and b
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(...d) || 1;
  const dn = [d[0] / l, d[1] / l, d[2] / l];
  const up = Math.abs(dn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = [dn[1] * up[2] - dn[2] * up[1], dn[2] * up[0] - dn[0] * up[2], dn[0] * up[1] - dn[1] * up[0]];
  const ul = Math.hypot(...u); u = u.map((x) => x / ul * r);
  const w = [dn[1] * u[2] - dn[2] * u[1], dn[2] * u[0] - dn[0] * u[2], dn[0] * u[1] - dn[1] * u[0]];
  const P = (p, s1, s2) => [p[0] + u[0] * s1 + w[0] * s2, p[1] + u[1] * s1 + w[1] * s2, p[2] + u[2] * s1 + w[2] * s2];
  const qa = [P(a, 1, 1), P(a, -1, 1), P(a, -1, -1), P(a, 1, -1)], qb = [P(b, 1, 1), P(b, -1, 1), P(b, -1, -1), P(b, 1, -1)];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const n = [(qa[i][0] + qa[j][0]) / 2 - a[0], (qa[i][1] + qa[j][1]) / 2 - a[1], (qa[i][2] + qa[j][2]) / 2 - a[2]];
    const nl = Math.hypot(...n) || 1;
    const nn = [n[0] / nl, n[1] / nl, n[2] / nl];
    tri(qa[i], qa[j], qb[j], nn);
    tri(qa[i], qb[j], qb[i], nn);
  }
}

function sliceMember(hx, hy, hz, n, rng) {
  const ax = hy > hx && hy > hz ? 1 : hx > hz ? 0 : 2;
  const h = [hx, hy, hz][ax];
  const cells = [];
  let faces0 = boxPolyhedron(hx, hy, hz);
  const cuts = [];
  for (let i = 1; i < n; i++) cuts.push(-h + (2 * h * i) / n + (rng.next() - 0.5) * (h / n));
  cuts.sort((a, b) => a - b);
  let lo = -h;
  for (let i = 0; i <= cuts.length; i++) {
    const hi = i < cuts.length ? cuts[i] : h;
    let f = faces0;
    const nlo = [0, 0, 0], nhi = [0, 0, 0];
    nlo[ax] = -1; nhi[ax] = 1;
    // tilt the cut planes a little for jagged breaks
    const tilt = (rng.next() - 0.5) * 0.4;
    nhi[(ax + 1) % 3] = tilt;
    f = clipPoly(f, nhi, hi);
    f = clipPoly(f, nlo, -lo);
    if (f.length >= 4) {
      let cx = 0, cy = 0, cz = 0, k = 0;
      for (const face of f) for (const p of face.pts) { cx += p[0]; cy += p[1]; cz += p[2]; k++; }
      const c = [cx / k, cy / k, cz / k];
      const dims = [hx, hy, hz]; dims[ax] = (hi - lo) / 2;
      cells.push({ faces: f, volume: dims[0] * dims[1] * dims[2] * 8, centroid: c });
    }
    lo = hi;
  }
  return cells;
}

function closestPointSeg(p, a, b, out) {
  const ab = _s.copy(b).sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
  return out.copy(a).addScaledVector(ab, t);
}
function distPointSeg(p, a, b) { return p.distanceTo(closestPointSeg(p, a, b, new THREE.Vector3())); }

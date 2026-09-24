// Overhead power/telecom lines: verlet ropes between pole crossarms, rendered as camera-facing
// ribbons with real thickness. Wires sway in pressure waves and snap (with arcing sparks).
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec3 aOther;
attribute float aSide;
uniform float uWidth;
varying float vSide;
void main() {
  vec4 a = modelViewMatrix * vec4(position, 1.0);
  vec4 b = modelViewMatrix * vec4(aOther, 1.0);
  vec3 dir = normalize(b.xyz - a.xyz);
  vec3 side = normalize(cross(dir, normalize(a.xyz)));
  // keep at least ~1.2 px
  float w = max(uWidth, -a.z * 0.0012);
  a.xyz += side * aSide * w * 0.5;
  vSide = aSide;
  gl_Position = projectionMatrix * a;
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vSide;
void main() { gl_FragColor = vec4(uColor * (0.6 + 0.4 * (1.0 - abs(vSide))), 1.0); }`;

export class Wires {
  constructor(maxSegs = 6000) {
    this.ropes = [];
    this.maxSegs = maxSegs;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(maxSegs * 4 * 3);
    this.other = new Float32Array(maxSegs * 4 * 3);
    const side = new Float32Array(maxSegs * 4);
    const idx = new Uint32Array(maxSegs * 6);
    for (let i = 0; i < maxSegs; i++) {
      side.set([-1, 1, -1, 1], i * 4);
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aOther', new THREE.BufferAttribute(this.other, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uWidth: { value: 0.025 }, uColor: { value: new THREE.Color(0.012, 0.012, 0.014) } }, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.nSegs = 0;
  }

  // catenary rope from a to b with sag (m) and n segments
  add(a, b, sag = 0.8, n = 12) {
    const pts = [], prev = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= sag * 4 * t * (1 - t);
      pts.push(p); prev.push(p.clone());
    }
    const len = a.distanceTo(b) / n * 1.01;
    const rope = { pts, prev, rest: pts.map((p) => p.clone()), len, pinA: true, pinB: true, a: a.clone(), b: b.clone(), cut: -1, sleeping: true, n };
    this.ropes.push(rope);
    return rope;
  }

  reset() {
    for (const r of this.ropes) {
      r.pts.forEach((p, i) => { p.copy(r.rest[i]); r.prev[i].copy(r.rest[i]); });
      r.pinA = r.pinB = true; r.cut = -1; r.sleeping = true;
    }
  }

  // push ropes near a point outward (pressure wave)
  blast(center, radius, strength) {
    for (const r of this.ropes) {
      let hit = false;
      for (let i = 0; i < r.pts.length; i++) {
        const d = r.pts[i].distanceTo(center);
        if (d < radius) {
          const k = (1 - d / radius) * strength;
          const dir = r.pts[i].clone().sub(center).normalize();
          r.prev[i].addScaledVector(dir, -k * 0.016);
          hit = true;
        }
      }
      if (hit) r.sleeping = false;
    }
  }

  snap(rope, index) { rope.cut = index; rope.sleeping = false; }

  step(dt) {
    if (dt <= 0) return;
    const g = -9.8 * dt * dt;
    for (const r of this.ropes) {
      if (r.sleeping) continue;
      const P = r.pts, Q = r.prev;
      let motion = 0;
      for (let i = 0; i < P.length; i++) {
        if ((i === 0 && r.pinA) || (i === P.length - 1 && r.pinB)) continue;
        const p = P[i], q = Q[i];
        const vx = (p.x - q.x) * 0.992, vy = (p.y - q.y) * 0.992, vz = (p.z - q.z) * 0.992;
        q.copy(p);
        p.x += vx; p.y += vy + g; p.z += vz;
        if (p.y < 0.05) { p.y = 0.05; q.x = p.x - vx * 0.5; q.z = p.z - vz * 0.5; }
        motion += Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
      }
      for (let it = 0; it < 8; it++) {
        for (let i = 0; i < P.length - 1; i++) {
          if (i === r.cut) continue;
          const a = P[i], b = P[i + 1];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const diff = (d - r.len) / d * 0.5;
          const fa = (i === 0 && r.pinA) ? 0 : 1, fb = (i + 1 === P.length - 1 && r.pinB) ? 0 : 1;
          const s = fa + fb || 1;
          a.x += dx * diff * fa * 2 / s; a.y += dy * diff * fa * 2 / s; a.z += dz * diff * fa * 2 / s;
          b.x -= dx * diff * fb * 2 / s; b.y -= dy * diff * fb * 2 / s; b.z -= dz * diff * fb * 2 / s;
        }
      }
      if (motion < 1e-4 && r.cut < 0) r.sleeping = true;
    }
  }

  updateGeometry() {
    let s = 0;
    const P = this.pos, O = this.other;
    for (const r of this.ropes) {
      for (let i = 0; i < r.pts.length - 1 && s < this.maxSegs; i++) {
        if (i === r.cut) continue;
        const a = r.pts[i], b = r.pts[i + 1];
        const o = s * 12;
        P[o] = a.x; P[o + 1] = a.y; P[o + 2] = a.z; O[o] = b.x; O[o + 1] = b.y; O[o + 2] = b.z;
        P[o + 3] = a.x; P[o + 4] = a.y; P[o + 5] = a.z; O[o + 3] = b.x; O[o + 4] = b.y; O[o + 5] = b.z;
        P[o + 6] = b.x; P[o + 7] = b.y; P[o + 8] = b.z; O[o + 6] = b.x * 2 - a.x; O[o + 7] = b.y * 2 - a.y; O[o + 8] = b.z * 2 - a.z;
        P[o + 9] = b.x; P[o + 10] = b.y; P[o + 11] = b.z; O[o + 9] = b.x * 2 - a.x; O[o + 10] = b.y * 2 - a.y; O[o + 11] = b.z * 2 - a.z;
        s++;
      }
    }
    this.nSegs = s;
    this.geo.setDrawRange(0, s * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aOther.needsUpdate = true;
  }
}

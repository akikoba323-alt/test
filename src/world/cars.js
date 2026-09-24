// Procedural cars sculpted with the same SDF toolkit as the fighters. Each car is an individual
// mesh so it can be flung, flipped and crushed; hazard lights blink on abandoned cars.
import * as THREE from 'three';
import { roundBox, roundCone, ellipsoid, sphere, torus, basisEuler } from '../character/sdf.js';
import { meshSDF } from '../character/mesher.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// material ids: 0 paint, 1 glass, 2 black trim, 3 chrome, 4 headlight, 5 taillight, 6 tire, 7 roof sign
function carPrims(type) {
  const P = [];
  const add = (p, mat) => { p.mat = mat; P.push(p); };
  if (type === 'van') {
    add(roundBox(V(0, 0.95, 0), 0.74, 0.62, 1.7, 0.16), 0);
    add(roundBox(V(0, 1.42, -0.1), 0.72, 0.3, 1.45, 0.12, null, { k: 0.05 }), 1);
  } else if (type === 'truck') {
    add(roundBox(V(0, 0.95, 1.7), 0.95, 0.75, 0.75, 0.18), 0);
    add(roundBox(V(0, 1.45, 1.85), 0.92, 0.32, 0.5, 0.1, null, { k: 0.04 }), 1);
    add(roundBox(V(0, 1.55, -0.9), 1.1, 1.2, 2.2, 0.06), 3);
    add(roundBox(V(0, 0.45, 0), 0.8, 0.12, 3.0, 0.05), 2);
  } else {
    const suv = type === 'suv';
    const L = suv ? 2.3 : 2.35, H = suv ? 0.42 : 0.33;
    add(roundBox(V(0, 0.62 + (suv ? 0.08 : 0), 0), 0.9, H, L, 0.2, null, { k: 0.1 }), 0);
    // hood slope + trunk
    add(roundBox(V(0, 0.8 + (suv ? 0.1 : 0), 1.25), 0.86, 0.12, 0.9, 0.12, basisEuler(-6, 0, 0), { k: 0.12 }), 0);
    // cabin (glass greenhouse)
    add(roundBox(V(0, 1.12 + (suv ? 0.16 : 0), -0.2), 0.8, suv ? 0.34 : 0.27, suv ? 1.35 : 1.1, 0.2, null, { k: 0.14 }), 1);
    if (type === 'taxi') add(roundBox(V(0, 1.48, -0.2), 0.18, 0.09, 0.28, 0.04, null, { k: 0.02 }), 7);
  }
  // wheel arches (subtract) and bumpers
  const wb = type === 'truck' ? [1.8, -1.5] : type === 'van' ? [1.15, -1.15] : [1.35, -1.35];
  for (const z of wb) for (const x of [-0.92, 0.92]) {
    const arch = roundCone(V(x * 1.2, 0.36, z), V(x * 0.7, 0.36, z), 0.42, 0.42);
    arch.op = 'sub'; arch.k = 0.04; P.push(arch);
  }
  const zf = type === 'truck' ? 2.45 : type === 'van' ? 1.85 : 2.3, zr = type === 'truck' ? -3.05 : type === 'van' ? -1.85 : -2.3;
  add(roundBox(V(0, 0.45, zf), 0.9, 0.14, 0.14, 0.07, null, { k: 0.05 }), 2);
  add(roundBox(V(0, 0.45, zr), 0.9, 0.14, 0.14, 0.07, null, { k: 0.05 }), 2);
  // lights
  for (const x of [-0.62, 0.62]) {
    add(ellipsoid(V(x, 0.72, zf - 0.08), 0.2, 0.07, 0.06), 4);
    add(ellipsoid(V(x, type === 'truck' ? 0.7 : 0.78, zr + 0.06), 0.2, 0.06, 0.05), 5);
  }
  // mirrors
  if (type !== 'truck') for (const x of [-0.98, 0.98]) add(roundBox(V(x, 1.0, 0.55), 0.07, 0.05, 0.08, 0.02), 2);
  return { P, wheelZ: wb, zf, zr };
}

const CAR_VERT_PARS = `
attribute vec4 aCarMat0;
attribute vec4 aCarMat1;
varying vec4 vCM0; varying vec4 vCM1; varying vec3 vCarLocal;
uniform vec4 uCrush[3];
`;

export function makeCarMaterial(color, noise2D) {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
  const u = {
    uPaint: { value: new THREE.Color(color[0], color[1], color[2]) },
    uHazard: { value: 0 }, uLightsOn: { value: 0 }, uBroken: { value: 0 }, uTime: { value: 0 }, uDirt: { value: 0.2 },
    uCrush: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },
    tNoise2: { value: noise2D },
  };
  mat.userData.u = u;
  mat.customProgramCacheKey = () => 'car';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + CAR_VERT_PARS)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vCM0 = aCarMat0; vCM1 = aCarMat1; vCarLocal = position;
for (int i = 0; i < 3; i++) {
  vec4 c = uCrush[i];
  if (c.w <= 0.0) continue;
  float d = distance(transformed, c.xyz);
  float k = exp(-d * d / (c.w * c.w * 0.5));
  transformed += normalize(c.xyz - transformed + vec3(0.0, 0.001, 0.0)) * k * c.w * 0.45;
  transformed.y -= k * c.w * 0.15;
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vCM0; varying vec4 vCM1; varying vec3 vCarLocal;
uniform vec3 uPaint; uniform float uHazard, uLightsOn, uBroken, uTime, uDirt;
uniform sampler2D tNoise2;
float gCR = 0.4, gCM = 0.0; vec3 gCE = vec3(0.0); float gCC = 1.0;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float paint = vCM0.x, glass = vCM0.y, trim = vCM0.z, chrome = vCM0.w;
  float head = vCM1.x, tail = vCM1.y, tire = vCM1.z, sign = vCM1.w;
  float n = texture(tNoise2, vCarLocal.xz * 0.6 + vCarLocal.y * 0.3).r;
  vec3 alb = uPaint * paint + vec3(0.02, 0.025, 0.03) * glass + vec3(0.03) * trim + vec3(0.8) * chrome
           + vec3(0.9) * head + vec3(0.5, 0.02, 0.02) * tail + vec3(0.03) * tire + vec3(0.9, 0.85, 0.3) * sign;
  alb = mix(alb, vec3(0.35, 0.32, 0.28), smoothstep(0.55, 0.9, n) * uDirt * (paint + trim));
  diffuseColor.rgb = alb;
  gCR = 0.35 * paint + 0.05 * glass + 0.6 * trim + 0.15 * chrome + 0.2 * (head + tail) + 0.9 * tire + 0.4 * sign;
  gCM = 0.1 * paint + 0.0 * glass + 1.0 * chrome;
  gCC = paint;
  float blink = step(0.5, fract(uTime * 1.25));
  gCE = vec3(1.0, 0.95, 0.85) * head * uLightsOn * 8.0 + vec3(1.0, 0.05, 0.02) * tail * (uLightsOn * 2.0 + uHazard * blink * 0.0)
      + vec3(1.0, 0.45, 0.02) * (head + tail) * uHazard * blink * 6.0 + vec3(1.0, 0.9, 0.5) * sign * 3.0;
  // shattered windows go matte white-ish crazing
  if (uBroken > 0.0) { diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.58, 0.6), glass * uBroken * 0.6); gCR = mix(gCR, 0.6, glass * uBroken); }
}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gCR;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = gCM;')
      .replace('#include <clearcoat_fragment_maps>', '#include <clearcoat_fragment_maps>\nmaterial.clearcoat *= gCC;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gCE;');
  };
  return mat;
}

const cache = {};
export function carGeometry(type) {
  if (cache[type]) return cache[type];
  const { P, wheelZ } = carPrims(type);
  const bb = type === 'truck' ? [-1.3, -0.05, -3.4, 1.3, 2.9, 2.9] : [-1.2, -0.05, -2.6, 1.2, 2.0, 2.6];
  const m = meshSDF(P, { cell: type === 'truck' ? 0.06 : 0.045, bounds: bb, project: 1 });
  const nV = m.positions.length / 3;
  const m0 = new Float32Array(nV * 4), m1 = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) {
    const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2];
    let best = 1e9, mat = 0;
    for (const p of P) { if (p.op === 'sub' || p.mat === undefined) continue; const d = p.d(x, y, z); if (d < best) { best = d; mat = p.mat; } }
    if (mat < 4) m0[v * 4 + mat] = 1; else m1[v * 4 + mat - 4] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('aCarMat0', new THREE.BufferAttribute(m0, 4));
  g.setAttribute('aCarMat1', new THREE.BufferAttribute(m1, 4));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  // wheels: add tire cylinders into the same geometry (tire material)
  const parts = [g];
  const wheelR = type === 'truck' ? 0.5 : 0.34;
  for (const z of wheelZ) for (const x of [-0.8, 0.8]) {
    const w = new THREE.CylinderGeometry(wheelR, wheelR, 0.24, 20);
    w.rotateZ(Math.PI / 2);
    w.translate(x * (type === 'truck' ? 1.15 : 1.0), wheelR, z);
    w.deleteAttribute('uv');
    const n = w.attributes.position.count;
    const a0 = new Float32Array(n * 4), a1 = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) a1[i * 4 + 2] = 1;
    w.setAttribute('aCarMat0', new THREE.BufferAttribute(a0, 4));
    w.setAttribute('aCarMat1', new THREE.BufferAttribute(a1, 4));
    parts.push(w.toNonIndexed ? w : w);
  }
  const merged = mergeSimple(parts);
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  cache[type] = merged;
  return merged;
}

// merge geometries that share position/normal/aCarMat0/aCarMat1 (indexed or not)
export function mergeSimple(geos) {
  const names = ['position', 'normal', 'aCarMat0', 'aCarMat1'];
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  const arrays = names.map((n) => new Float32Array(nv * geos[0].attributes[n].itemSize));
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of geos) {
    names.forEach((n, k) => arrays[k].set(g.attributes[n].array, vo * g.attributes[n].itemSize));
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; io += g.index.count; }
    else { for (let i = 0; i < g.attributes.position.count; i++) idx[io + i] = vo + i; io += g.attributes.position.count; }
    vo += g.attributes.position.count;
  }
  names.forEach((n, k) => out.setAttribute(n, new THREE.BufferAttribute(arrays[k], geos[0].attributes[n].itemSize)));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export class Car {
  constructor(type, color, noise2D) {
    this.type = type;
    this.mesh = new THREE.Mesh(carGeometry(type), makeCarMaterial(color, noise2D));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.u = this.mesh.material.userData.u;
    const bb = this.mesh.geometry.boundingBox;
    this.half = new THREE.Vector3().subVectors(bb.max, bb.min).multiplyScalar(0.5);
    this.mass = type === 'truck' ? 6000 : type === 'van' ? 1100 : 1400;
    this.crushN = 0;
  }
  crush(localPoint, radius) {
    const c = this.u.uCrush.value[this.crushN++ % 3];
    c.set(localPoint.x, localPoint.y, localPoint.z, radius);
  }
  resetState() {
    for (const c of this.u.uCrush.value) c.set(0, 0, 0, 0);
    this.u.uBroken.value = 0;
    this.crushN = 0;
  }
}

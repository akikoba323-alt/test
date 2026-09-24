// Background city: instanced building shells with procedural facades. Each instance can be
// collapsed (tilted, sheared and sunk) by the finale's shockwave via per-instance attributes.
import * as THREE from 'three';
import { damageUniforms } from './archmat.js';
import { RNG } from '../core/rng.js';

const VERT = /* glsl */ `
attribute vec4 aSky;       // x floorH, y bayW, z seed, w style
attribute vec3 aSkyTint;
attribute vec4 aCollapse;  // x start time, y dir angle, z max tilt, w sink fraction
uniform float uTime;
varying vec3 vLp; varying vec3 vN; varying vec4 vSkyV; varying vec3 vTintV; varying vec3 vW; varying float vCol; varying vec3 vSizeV;
void main() {
  vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec3 base = instanceMatrix[3].xyz;
  vec3 lp = position * sc;           // local, meters (box base at y=0)
  vLp = lp; vSizeV = sc;
  vec3 p = lp;
  vec3 n = normal;
  float col = 0.0;
  if (aCollapse.x > 0.0 && uTime > aCollapse.x) {
    float t = uTime - aCollapse.x;
    col = clamp(t / 7.0, 0.0, 1.0);
    float e = col * col * (3.0 - 2.0 * col);
    float sink = aCollapse.w * e;
    // crumple: lower storeys fail first, the top falls into the footprint while tilting away
    float h = max(sc.y, 1.0);
    float yk = p.y / h;
    p.y = p.y * (1.0 - sink) - sink * 0.0;
    float tilt = aCollapse.z * e * yk;
    vec2 dir = vec2(cos(aCollapse.y), sin(aCollapse.y));
    float ca = cos(tilt), sa = sin(tilt);
    vec3 q = p;
    float along = dot(q.xz, dir);
    float nAlong = along * ca + q.y * sa;
    q.y = -along * sa + q.y * ca;
    q.xz += dir * (nAlong - along);
    p = q;
    p.xz += (fract(sin(dot(lp, vec3(12.9, 78.2, 37.7))) * 43758.5) - 0.5) * e * 1.5;
  }
  vCol = col;
  vec4 wp = modelMatrix * vec4(base + p, 1.0);
  vW = wp.xyz;
  vN = n;
  vSkyV = aSky; vTintV = aSkyTint;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
uniform sampler2D tEnv;
uniform sampler2D tNoise2;
uniform vec3 uSunDir, uSunCol, uCamPos, uAmbient, uFogColor;
uniform float uPower, uTime, uNight, uFogDensity;
varying vec3 vLp; varying vec3 vN; varying vec4 vSkyV; varying vec3 vTintV; varying vec3 vW; varying float vCol; varying vec3 vSizeV;
#define PI 3.14159265
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 env(vec3 d) {
  float phi = (abs(d.x) + abs(d.z) < 1e-5) ? 0.0 : atan(d.x, d.z);
  float th = asin(clamp(d.y, -1.0, 1.0));
  return textureLod(tEnv, vec2(phi / (2.0 * PI) + 0.5, th / PI + 0.5), 2.0).rgb;
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  float floorH = vSkyV.x, bay = vSkyV.y, seed = vSkyV.z, style = vSkyV.w;
  vec3 base = vTintV;
  vec3 col;
  float ndl = max(dot(N, uSunDir), 0.0);
  if (N.y > 0.5) {
    // roof: gravel/membrane with clutter shading
    float n = texture(tNoise2, vW.xz * 0.2).r;
    col = vec3(0.16, 0.16, 0.17) * (0.7 + 0.6 * n) * (uAmbient + uSunCol * ndl);
  } else {
    vec2 f = vec2(abs(N.x) > 0.5 ? vLp.z : vLp.x, vLp.y);
    vec2 cell = floor(f / vec2(bay, floorH));
    vec2 w = fract(f / vec2(bay, floorH));
    float winMask = step(0.12, w.x) * step(w.x, 0.88) * step(0.22, w.y) * step(w.y, 0.86);
    if (style > 1.5) winMask = step(0.04, w.x) * step(w.x, 0.96) * step(0.3, w.y) * step(w.y, 0.95); // curtain wall bands
    float groundFloor = step(f.y, floorH * 1.2);
    float r = h21(cell + seed * 17.0);
    float lit = step(0.8 - uNight * 0.45, r) * uPower * (1.0 - vCol);
    vec3 R = reflect(-V, N);
    float fres = 0.05 + 0.95 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float fres2 = 0.18 + 0.82 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 glass = mix(vec3(0.012, 0.015, 0.02), vec3(1.0, 0.85, 0.62) * (0.8 + 0.8 * h21(cell + 3.0)) * mix(0.25, 1.2, uNight), lit) * (1.0 - fres2) + env(R) * fres2;
    vec3 wall = base * (0.85 + 0.3 * texture(tNoise2, vW.xy * 0.05 + seed).r) * (uAmbient + uSunCol * ndl);
    col = mix(wall, glass, winMask);
    // storefront glow at street level
    col += vec3(1.0, 0.8, 0.55) * groundFloor * winMask * uPower * mix(0.15, 0.8, uNight) * step(0.4, h21(cell * 1.7));
  }
  // aviation warning light on tall roofs
  if (vSizeV.y > 90.0 && vLp.y > vSizeV.y - 1.5 && length(vLp.xz) < 2.0) col += vec3(1.0, 0.05, 0.02) * 20.0 * step(0.5, fract(uTime * 0.7 + seed));
  // collapsing buildings are dimmed by dust
  col = mix(col, vec3(0.2, 0.18, 0.16) * (uAmbient + uSunCol * 0.2), vCol * 0.6);
  // aerial perspective
  float dist = length(vW - uCamPos);
  float fog = 1.0 - exp(-dist * uFogDensity);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Skyline {
  constructor(ctx, lots) {
    this.ctx = ctx;
    const n = lots.length;
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const aSky = new Float32Array(n * 4), aTint = new Float32Array(n * 3), aCol = new Float32Array(n * 4);
    this.uniforms = {
      tEnv: { value: ctx.envEqui }, tNoise2: { value: ctx.noise2D },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Vector3(1, 1, 1) }, uCamPos: { value: new THREE.Vector3() },
      uAmbient: { value: new THREE.Vector3(0.2, 0.2, 0.25) }, uFogColor: { value: new THREE.Vector3(0.5, 0.5, 0.55) }, uFogDensity: { value: 0.0004 },
      uPower: damageUniforms.uPower, uTime: damageUniforms.uTime, uNight: damageUniforms.uNight,
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms });
    const mesh = new THREE.InstancedMesh(g, mat, n);
    const m = new THREE.Matrix4();
    const rng = new RNG(4242);
    this.lots = lots;
    lots.forEach((L, i) => {
      m.makeScale(L.w, L.h, L.d).setPosition(L.x, 0, L.z);
      mesh.setMatrixAt(i, m);
      aSky[i * 4] = L.floorH; aSky[i * 4 + 1] = L.bay; aSky[i * 4 + 2] = rng.next(); aSky[i * 4 + 3] = L.style;
      aTint[i * 3] = L.tint[0]; aTint[i * 3 + 1] = L.tint[1]; aTint[i * 3 + 2] = L.tint[2];
    });
    g.setAttribute('aSky', new THREE.InstancedBufferAttribute(aSky, 4));
    g.setAttribute('aSkyTint', new THREE.InstancedBufferAttribute(aTint, 3));
    this.collapseAttr = new THREE.InstancedBufferAttribute(aCol, 4);
    this.collapseAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aCollapse', this.collapseAttr);
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    this.mesh = mesh;
    // shadow casting uses the default depth material (no collapse deformation in shadows)
  }
  collapse(i, t0, dirAngle, tilt, sink) {
    this.collapseAttr.setXYZW(i, t0, dirAngle, tilt, sink);
    this.collapseAttr.needsUpdate = true;
  }
  reset() {
    this.collapseAttr.array.fill(0);
    this.collapseAttr.needsUpdate = true;
  }
}

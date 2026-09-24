// Street surface: one large plane shaded procedurally from world XZ (asphalt, lane markings,
// zebra crossings, stop lines, wear, patches, manholes, puddles, lamp light pools, craters).
import * as THREE from 'three';
import { ARCH_GLSL } from './archmat.js';
import { damageUniforms } from './archmat.js';

export const GRID = {
  pitch: 130,
  avenueHalf: (k) => (k === 0 ? 15 : 9),   // streets along X at z = k*pitch
  streetHalf: (k) => (k === 0 ? 11 : 9),   // streets along Z at x = k*pitch
  walkAv: (k) => (k === 0 ? 6 : 4),
  walkSt: (k) => (k === 0 ? 5 : 4),
};

export const MAX_HOLES = 16, MAX_LAMPS = 32;

export function makeGroundMaterial(noise2D) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const u = {
    tNoise2: { value: noise2D }, ...damageUniforms,
    uHoles: { value: Array.from({ length: MAX_HOLES }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uLamps: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uLampColor: { value: new THREE.Color(1.0, 0.72, 0.42) },
    uWet: { value: 0.0 },
  };
  mat.userData.u = u;
  mat.customProgramCacheKey = () => 'ground';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWp;
uniform vec4 uHoles[${MAX_HOLES}];
uniform vec4 uLamps[${MAX_LAMPS}];
uniform vec3 uLampColor;
uniform float uWet;
${ARCH_GLSL}
float gRoughG = 0.9; float gBumpG = 0.0; vec3 gEmitG = vec3(0.0); vec3 gLampG = vec3(0.0);
vec3 perturbG(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz)); vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  return normalize(abs(fDet) * surf_norm - sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2));
}
float dashLine(float d, float w, float along, float dash, float gap) {
  float line = smoothstep(w, w * 0.6, abs(d));
  float ph = mod(along, dash + gap);
  return line * step(ph, dash);
}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
for (int i = 0; i < ${MAX_HOLES}; i++) {
  vec4 h = uHoles[i];
  if (h.z > 0.0 && distance(vWp.xz, h.xy) < h.z) discard;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 p = vWp.xz;
  float pitch = ${GRID.pitch.toFixed(1)};
  float kz = floor(p.y / pitch + 0.5), kx = floor(p.x / pitch + 0.5);
  float dz = p.y - kz * pitch, dx = p.x - kx * pitch;
  float hwz = kz == 0.0 ? 15.0 : 9.0, hwx = kx == 0.0 ? 11.0 : 9.0;
  bool onAv = abs(dz) < hwz, onSt = abs(dx) < hwx;
  vec4 nA = texture(tNoise2, p * 0.013), nB = texture(tNoise2, p * 0.11), nC = texture(tNoise2, p * 0.9), nD = texture(tNoise2, p * 4.7);
  // asphalt base with aggregate speckle and repair patches
  vec3 alb = vec3(0.075, 0.074, 0.072) * (0.75 + 0.5 * nA.r) * (0.85 + 0.3 * nD.a);
  float patchN = smoothstep(0.62, 0.64, texture(tNoise2, floor(p / 3.0) * 0.07).r);
  alb = mix(alb, alb * (nA.g > 0.5 ? 0.7 : 1.35), patchN * 0.8);
  float rough = 0.86 + 0.08 * nC.r;
  float bump = nD.r * 0.004 + nC.g * 0.002;
  float paint = 0.0;
  if (onAv && !onSt) {
    // lanes along X: center double line (orange), lane dashes (white), edge lines
    float lane = 3.6;
    float center = max(smoothstep(0.1, 0.07, abs(abs(dz) - 0.2)), 0.0);
    float lanes = 0.0;
    for (int i = 1; i <= 3; i++) lanes = max(lanes, dashLine(abs(dz) - float(i) * lane, 0.08, p.x, 5.0, 7.0));
    float edge = smoothstep(0.1, 0.07, abs(abs(dz) - (hwz - 0.35)));
    // crosswalk bands near intersections
    float cxd = abs(dx) - (hwx + 3.2);
    float cw = step(abs(cxd), 2.0) * step(0.5, fract(dz / 0.9 + 0.25)) * step(abs(dz), hwz - 0.6);
    float stopL = smoothstep(0.25, 0.2, abs(abs(dx) - (hwx + 6.2))) * step(0.3, abs(dz)) * step(abs(dz), hwz - 0.5) * step(0.0, dz * sign(dx) * -1.0 + 0.0);
    lanes *= step(hwx + 7.0, abs(dx));
    center *= step(hwx + 5.4, abs(dx));
    paint = max(max(lanes, edge), max(cw, stopL));
    alb = mix(alb, vec3(0.62, 0.34, 0.06), center * 0.9);
    // tire wear bands
    float wear = smoothstep(0.9, 0.2, abs(fract(abs(dz) / lane) * lane - lane * 0.5 - 0.0 + 0.9 * (fract(abs(dz) / lane) > 0.5 ? -1.0 : 1.0)));
    alb *= 1.0 - 0.18 * smoothstep(0.4, 1.0, abs(fract(abs(dz) / lane - 0.5) - 0.5) * 3.0);
  } else if (onSt && !onAv) {
    float lane = 3.4;
    float center = smoothstep(0.1, 0.07, abs(dx));
    float lanes = dashLine(abs(dx) - lane, 0.08, p.y, 5.0, 7.0);
    float edge = smoothstep(0.1, 0.07, abs(abs(dx) - (hwx - 0.35)));
    float czd = abs(dz) - (hwz + 3.2);
    float cw = step(abs(czd), 2.0) * step(0.5, fract(dx / 0.9 + 0.25)) * step(abs(dx), hwx - 0.6);
    float stopL = smoothstep(0.25, 0.2, abs(abs(dz) - (hwz + 6.2))) * step(0.3, abs(dx)) * step(abs(dx), hwx - 0.5);
    lanes *= step(hwz + 7.0, abs(dz));
    center *= step(hwz + 5.4, abs(dz));
    paint = max(max(center, lanes), max(edge, max(cw, stopL)));
  } else if (onSt && onAv) {
    // intersection: faint turn guide dashes
    float guide = dashLine(length(vec2(dx, dz)) - 9.0, 0.06, atan(dz, dx) * 9.0, 1.0, 1.0) * 0.4;
    paint = guide;
  }
  // worn paint
  float worn = smoothstep(0.35, 0.65, nC.b * 0.6 + nD.g * 0.4);
  paint *= 0.55 + 0.45 * worn;
  alb = mix(alb, vec3(0.72, 0.72, 0.7), paint);
  rough = mix(rough, 0.62, paint);
  bump += paint * 0.0015;
  // manholes
  vec2 mh = vec2(mod(p.x + 17.0, 34.0) - 17.0, dz - (kz == 0.0 ? 5.4 : 3.0));
  float mhr = length(mh);
  if (onAv && mhr < 0.35) {
    float ring = smoothstep(0.34, 0.32, mhr) - smoothstep(0.3, 0.28, mhr);
    float pat = step(0.5, fract((mh.x + mh.y) * 12.0)) * 0.3;
    alb = vec3(0.09, 0.085, 0.08) * (0.8 + pat) - ring * 0.02;
    rough = 0.45; bump += ring * 0.004;
  }
  // fine cracks in old asphalt
  float fc = vEdge2(p * 0.55 + 3.1);
  float crk = smoothstep(0.035, 0.0, fc) * smoothstep(0.55, 0.75, nA.b);
  alb *= 1.0 - crk * 0.5;
  bump -= crk * 0.002;
  // puddles (glossy, darker)
  float puddle = smoothstep(0.66, 0.7, nA.r * 0.7 + nB.g * 0.3) * uWet;
  alb *= 1.0 - puddle * 0.5;
  rough = mix(rough, 0.04, puddle);
  bump *= 1.0 - puddle;
  // impact cracks / scorch
  vec2 cr = crackField(vWp, vec3(0.0, 1.0, 0.0));
  alb *= 1.0 - cr.x * 0.9;
  bump -= cr.x * 0.008;
  gEmitG += vec3(1.0, 0.4, 0.1) * cr.y * 5.0;
  float sc = scorchField(vWp);
  alb = mix(alb, alb * 0.15, sc);
  diffuseColor.rgb = alb;
  gRoughG = rough; gBumpG = bump;
  // street lamp pools (cheap fake lights)
  vec3 lamp = vec3(0.0);
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    vec4 L = uLamps[i];
    if (L.w <= 0.0) continue;
    float d2 = dot(p - L.xy, p - L.xy);
    lamp += uLampColor * L.w * exp(-d2 / (L.z * L.z));
  }
  gLampG = lamp * alb;
}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRoughG;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = perturbG(-vViewPosition, normal, vec2(dFdx(gBumpG), dFdy(gBumpG)), faceDirection);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += gEmitG + gLampG;`);
  };
  return mat;
}

export function makeGround(noise2D) {
  const g = new THREE.PlaneGeometry(8000, 8000, 1, 1);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, makeGroundMaterial(noise2D));
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

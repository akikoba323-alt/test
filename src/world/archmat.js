// Architectural surface shading shared by intact instanced elements and fracture chunks.
// Appearance is a function of the element's REST position/normal so a wall looks identical
// the instant before and after it shatters (chunks carry their rest coordinates).
import * as THREE from 'three';
import { patchEnvOcc } from '../render/interior.js';

export const KIND = { CONCRETE: 0, CLADDING: 1, ALU: 2, DRYWALL: 3, SLAB: 4, BRICK: 5, STEEL: 6, STONE: 7, FRACTURE: 8, WOOD: 9, PLASTIC: 10, SIGN: 11, ASPHALT: 12, PAVER: 13, DIRT: 14, CARPAINT: 15, RUBBER: 16 };
export const MAX_CRACKS = 24;

// Global damage state shared by every architectural material (updated once per frame).
export const damageUniforms = {
  uCrackP: { value: Array.from({ length: MAX_CRACKS }, () => new THREE.Vector4(0, -1e5, 0, 0)) },
  uCrackQ: { value: Array.from({ length: MAX_CRACKS }, () => new THREE.Vector4()) },
  uScorchP: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, -1e5, 0, 0)) },
  uPower: { value: 1 },
  uTime: { value: 0 },
  uDust: { value: 0 },
  uNight: { value: 0 },
};

export const ARCH_GLSL = /* glsl */ `
uniform vec4 uCrackP[${MAX_CRACKS}];
uniform vec4 uCrackQ[${MAX_CRACKS}];
uniform vec4 uScorchP[16];
uniform float uPower, uTime, uDust, uNight;
uniform sampler2D tNoise2;
float h11(float n) { return fract(sin(n) * 43758.5453123); }
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec4 tri(vec3 p, vec3 n, float s) {
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
  return texture(tNoise2, p.zy * s) * w.x + texture(tNoise2, p.xz * s) * w.y + texture(tNoise2, p.xy * s) * w.z;
}
// 2D coordinates in the plane of a surface
vec2 planeUV(vec3 p, vec3 n) {
  vec3 a = abs(n);
  return a.y > max(a.x, a.z) ? p.xz : (a.x > a.z ? p.zy : p.xy);
}
// Voronoi edge distance (2D), for crack networks
float vEdge2(vec2 x) {
  vec2 n = floor(x), f = fract(x), mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j), o = h22(n + g), r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(i, j), o = h22(n + g), r = g + o - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
}
// Crack field: radial fractures near the origin blending into a cellular network outward.
// returns (crack line intensity, glow)
vec2 crackField(vec3 P, vec3 N) {
  float c = 0.0, glow = 0.0;
  for (int i = 0; i < ${MAX_CRACKS}; i++) {
    vec4 cp = uCrackP[i];
    if (cp.w <= 0.0) continue;
    vec3 d = P - cp.xyz;
    float dist = length(d);
    if (dist > cp.w * 1.15) continue;
    vec4 cq = uCrackQ[i];
    vec2 uv = planeUV(d, N);
    float ang = atan(uv.y, uv.x);
    float r = length(uv);
    float seed = cq.z;
    // radial rays with jitter
    float rays = 9.0 + floor(h11(seed) * 7.0);
    float a = ang * rays / 6.2831 + seed * 3.0;
    float fa = fract(a) - 0.5;
    float wob = (texture(tNoise2, vec2(r * 0.35 / max(cp.w, 0.5), floor(a) * 0.137 + seed)).r - 0.5) * 0.9;
    float radial = abs(fa + wob * 0.45);
    float radialLine = smoothstep(0.035 + 0.02 / (1.0 + r), 0.0, radial * max(r, 0.05) / max(cp.w * 0.08, 0.02));
    // cellular network, only close to the impact, with broken (intermittent) segments
    float sc = 1.0 / max(cp.w * 0.07, 0.05);
    float cell = vEdge2(uv * sc + seed * 17.0);
    float gaps = smoothstep(0.35, 0.6, texture(tNoise2, uv * sc * 0.21 + seed).r);
    float cellLine = smoothstep(0.035, 0.0, cell) * smoothstep(cp.w * 0.5, cp.w * 0.08, dist) * gaps;
    float fade = smoothstep(cp.w, cp.w * 0.45, dist);
    float k = max(radialLine * fade, cellLine * 0.8) * cq.x;
    // crushed core
    k = max(k, smoothstep(cp.w * 0.1, cp.w * 0.03, dist) * cq.x * 0.7);
    c = max(c, k);
    glow = max(glow, k * cq.y * smoothstep(cp.w, 0.0, dist));
  }
  return vec2(c, glow);
}
float scorchField(vec3 P) {
  float s = 0.0;
  for (int i = 0; i < 16; i++) {
    vec4 sp = uScorchP[i];
    if (sp.w <= 0.0) continue;
    float d = distance(P, sp.xyz);
    s = max(s, smoothstep(sp.w, sp.w * 0.3, d));
  }
  return s;
}
// surface description for a kind
void archSurface(float kind, vec3 P, vec3 N, vec3 L, vec3 S, vec3 tint, float seed, float damage,
                 out vec3 alb, out float rough, out float metal, out vec3 emit, out float bump) {
  vec4 n1 = tri(P, N, 0.21), n2 = tri(P, N, 1.3), n3 = tri(P, N, 5.1);
  float big = n1.r, mid = n2.r, fine = n3.r;
  emit = vec3(0.0); metal = 0.0; bump = 0.0;
  float k = floor(kind + 0.5);
  float edge = 0.0;
  if (S.x < 50.0) {
    vec3 e = S * 0.5 - abs(L);
    float m = min(min(e.x, e.y), e.z);
    edge = smoothstep(0.05, 0.0, m);
  }
  if (k == 0.0 || k == 8.0) {
    // raw concrete, formwork seams and tie holes
    alb = vec3(0.46, 0.45, 0.43) * tint * (0.78 + 0.35 * big) * (0.92 + 0.12 * fine);
    rough = 0.88;
    vec2 uv = planeUV(P, N);
    float seamH = smoothstep(0.012, 0.0, abs(fract(uv.y / 1.2) - 0.5) - 0.495);
    float seamV = smoothstep(0.012, 0.0, abs(fract(uv.x / 2.4) - 0.5) - 0.495);
    vec2 th = fract(uv / vec2(0.6, 0.6)) - 0.5;
    float tie = smoothstep(0.02, 0.012, length(th));
    alb *= 1.0 - 0.12 * max(seamH, seamV) - tie * 0.35;
    bump = (big * 0.3 + fine * 0.7) * 0.004 - tie * 0.003;
    // rain streaks / grime running down
    float streak = texture(tNoise2, vec2(P.x * 0.9 + P.z * 0.9, P.y * 0.02)).g;
    alb *= 1.0 - smoothstep(0.55, 0.9, streak) * 0.2 * (1.0 - abs(N.y));
  } else if (k == 1.0) {
    alb = tint * (0.85 + 0.25 * big) * (0.95 + 0.08 * fine);
    rough = 0.62 + 0.2 * mid;
    float streak = texture(tNoise2, vec2(P.x * 0.35 + P.z * 0.35, P.y * 0.045 + seed)).g;
    alb *= 1.0 - smoothstep(0.62, 0.95, streak) * 0.12 * (1.0 - abs(N.y));
    bump = fine * 0.0015;
  } else if (k == 2.0) {
    alb = tint * (0.9 + 0.1 * mid); rough = 0.32 + 0.15 * fine; metal = 0.9; bump = fine * 0.0004;
  } else if (k == 3.0) {
    alb = tint * (0.93 + 0.07 * big); rough = 0.86;
    float base = smoothstep(0.1, 0.09, L.y + S.y * 0.5) * step(abs(N.y), 0.5);
    alb = mix(alb, vec3(0.08), base);
    bump = fine * 0.0008;
  } else if (k == 4.0) {
    if (N.y > 0.5) {
      // floor finish: carpet tiles
      vec2 uv = P.xz;
      vec2 ct = floor(uv / 0.5);
      float tileVar = h21(ct + seed);
      alb = tint * (0.8 + 0.25 * tileVar) * (0.85 + 0.2 * n3.g);
      rough = 0.95;
      bump = n3.g * 0.002;
    } else if (N.y < -0.5) {
      // ceiling: acoustic tiles and light panels
      vec2 uv = P.xz;
      vec2 g = abs(fract(uv / 0.6) - 0.5);
      float grid = smoothstep(0.47, 0.49, max(g.x, g.y));
      alb = vec3(0.72, 0.72, 0.7) * (1.0 - grid * 0.35) * (0.94 + 0.08 * fine);
      rough = 0.9;
      vec2 lp = fract(uv / 2.4) - 0.5;
      float panel = step(abs(lp.x), 0.12) * step(abs(lp.y), 0.25);
      float flick = 1.0;
      if (damage > 0.3) flick = step(0.35, fract(sin(floor(uTime * 12.0 + seed * 91.0) * 12.9898) * 43758.5)) * (0.4 + 0.6 * step(0.5, h11(floor(uTime * 3.0) + seed)));
      float on = uPower * step(damage, 0.85) * flick;
      emit = vec3(1.0, 0.97, 0.9) * panel * on * 6.0;
      alb = mix(alb, vec3(0.9), panel);
    } else {
      alb = vec3(0.44, 0.43, 0.41) * (0.8 + 0.3 * big); rough = 0.88; bump = fine * 0.003;
    }
  } else if (k == 5.0) {
    vec2 uv = planeUV(P, N) / vec2(0.225, 0.075);
    float lodB = smoothstep(0.25, 0.6, length(fwidth(uv)));
    float row = floor(uv.y);
    uv.x += mod(row, 2.0) * 0.5;
    vec2 f = fract(uv);
    float mortar = 1.0 - smoothstep(0.03, 0.06, f.x) * smoothstep(0.03, 0.06, 1.0 - f.x) * smoothstep(0.06, 0.12, f.y) * smoothstep(0.06, 0.12, 1.0 - f.y);
    float bv = h21(floor(uv) + seed);
    alb = mix(tint * (0.75 + 0.4 * bv) * (0.9 + 0.2 * fine), vec3(0.55, 0.53, 0.5), mortar);
    alb = mix(alb, tint * 0.82 + vec3(0.03), lodB);
    rough = 0.9; bump = ((1.0 - mortar) * 0.004 + fine * 0.001) * (1.0 - lodB);
  } else if (k == 6.0) {
    alb = tint * (0.85 + 0.2 * big); rough = 0.45 + 0.25 * mid; metal = 0.55;
    float rust = smoothstep(0.62, 0.85, mid * 0.6 + big * 0.4);
    alb = mix(alb, vec3(0.25, 0.1, 0.05), rust * 0.6); rough = mix(rough, 0.9, rust); metal *= 1.0 - rust;
    bump = fine * 0.001;
  } else if (k == 7.0) {
    // polished stone with veins
    float v = abs(sin((P.x + P.z) * 2.0 + big * 9.0 + mid * 3.0));
    alb = tint * (0.85 + 0.15 * big) * (1.0 - smoothstep(0.96, 1.0, v) * 0.5);
    rough = 0.12 + 0.1 * fine;
  } else if (k == 9.0) {
    float grain = sin(P.x * 60.0 + P.z * 60.0 + big * 20.0) * 0.5 + 0.5;
    alb = tint * (0.8 + 0.3 * grain); rough = 0.55;
  } else if (k == 10.0) {
    alb = tint; rough = 0.5;
  } else if (k == 11.0) {
    alb = tint * 0.2; rough = 0.4;
    emit = tint * 4.0 * uPower * (0.85 + 0.15 * sin(uTime * 2.0 + seed * 10.0));
  } else if (k == 12.0) {
    alb = vec3(0.075, 0.074, 0.072) * (0.75 + 0.5 * big) * (0.85 + 0.3 * fine);
    rough = 0.88; bump = fine * 0.004 + mid * 0.002;
  } else if (k == 13.0) {
    // sidewalk pavers
    vec2 uv = P.xz / vec2(0.3, 0.3);
    vec2 f = fract(uv);
    float joint = 1.0 - smoothstep(0.02, 0.05, f.x) * smoothstep(0.02, 0.05, 1.0 - f.x) * smoothstep(0.02, 0.05, f.y) * smoothstep(0.02, 0.05, 1.0 - f.y);
    float pv = h21(floor(uv));
    alb = tint * (0.8 + 0.25 * pv) * (0.9 + 0.2 * fine) * (1.0 - joint * 0.35);
    rough = 0.82; bump = (1.0 - joint) * 0.002;
  } else if (k == 14.0) {
    alb = vec3(0.28, 0.23, 0.19) * (0.7 + 0.5 * big) * (0.8 + 0.4 * fine); rough = 0.97; bump = fine * 0.01 + mid * 0.02;
  } else if (k == 15.0) {
    alb = tint; rough = 0.25; metal = 0.3;
  } else {
    alb = tint; rough = 0.8;
  }
  // subtle darkening/AO at element edges, lighter chipped arrises on concrete
  alb *= 1.0 - edge * 0.12;
  // damage: dust, chips
  float dmg = clamp(damage + uDust * 0.35, 0.0, 1.0);
  float dm = smoothstep(0.35, 0.9, big * 0.5 + fine * 0.5 + dmg * 0.5) * dmg;
  alb = mix(alb, vec3(0.5, 0.48, 0.45), dm * 0.55);
  rough = mix(rough, 0.95, dm);
}
`;

// Fresh fracture faces: lighter concrete with aggregate
export const FRACTURE_GLSL = /* glsl */ `
void fractureSurface(vec3 P, vec3 N, out vec3 alb, out float rough, out float bump) {
  vec4 n3 = tri(P, N, 7.0), n2 = tri(P, N, 1.7);
  float agg = smoothstep(0.55, 0.62, n3.b) * 0.5 + smoothstep(0.7, 0.75, n2.b) * 0.4;
  alb = vec3(0.6, 0.58, 0.55) * (0.85 + 0.25 * n2.r) * (1.0 - agg * 0.35);
  rough = 0.97;
  bump = n3.r * 0.006 + agg * 0.003;
}
`;

export function makeArchMaterial(noise2D, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, side: opts.side ?? THREE.FrontSide });
  const u = { tNoise2: { value: noise2D }, ...damageUniforms };
  mat.userData.u = u;
  mat.customProgramCacheKey = () => 'arch' + (opts.chunks ? 'c' : 'i');
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aArch;
attribute vec3 aTint;
${opts.chunks ? 'attribute vec3 aRest; attribute vec3 aRestN; attribute vec4 aXf; attribute vec4 aXq;' : ''}
varying vec3 vRest; varying vec3 vRestN; varying vec4 vArchV; varying vec3 vTint; varying vec3 vLocal; varying vec3 vSize;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vArchV = aArch; vTint = aTint;
#ifdef USE_INSTANCING
  vec4 rp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vRest = rp.xyz;
  vRestN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vLocal = position * sc; vSize = sc;
#else
  ${opts.chunks ? 'vRest = aRest; vRestN = aRestN;' : 'vRest = (modelMatrix * vec4(position, 1.0)).xyz; vRestN = normalize(mat3(modelMatrix) * normal);'}
  vLocal = vec3(0.0); vSize = vec3(100.0);
#endif
`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vRest; varying vec3 vRestN; varying vec4 vArchV; varying vec3 vTint; varying vec3 vLocal; varying vec3 vSize;
${ARCH_GLSL}
${FRACTURE_GLSL}
vec3 gEmitA = vec3(0.0); float gRoughA = 0.8, gMetalA = 0.0, gBumpA = 0.0;
vec3 perturbA(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 alb; float rgh, met, bmp; vec3 em;
  vec3 N0 = normalize(vRestN);
  if (vArchV.w > 0.5) { fractureSurface(vRest, N0, alb, rgh, bmp); met = 0.0; em = vec3(0.0); float kk = floor(vArchV.x + 0.5); if (kk == 12.0 || kk == 14.0) alb *= kk == 12.0 ? 0.28 : 0.55; }
  else archSurface(vArchV.x, vRest, N0, vLocal, vSize, vTint, vArchV.y, vArchV.z, alb, rgh, met, em, bmp);
  vec2 cr = crackField(vRest, N0);
  alb *= 1.0 - cr.x * 0.85;
  bmp -= cr.x * 0.006;
  em += vec3(1.0, 0.45, 0.12) * cr.y * 6.0;
  float sc = scorchField(vRest);
  alb = mix(alb, alb * 0.12, sc * 0.85);
  rgh = mix(rgh, 0.7, sc);
  diffuseColor.rgb = alb;
  gEmitA = em; gRoughA = rgh; gMetalA = met; gBumpA = bmp;
}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRoughA;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = gMetalA;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = perturbA(-vViewPosition, normal, vec2(dFdx(gBumpA), dFdy(gBumpA)), faceDirection);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += gEmitA;`);
    patchEnvOcc(sh);
  };
  return mat;
}

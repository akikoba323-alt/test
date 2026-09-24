// Fighter surface shader: MeshPhysicalMaterial extended with an 8-slot material table blended
// by per-vertex weights, procedural micro detail in bind space, wrap-lit skin, accumulated damage
// (dust, soot, scratches, torn cloth revealing skin), energy glow, impact dents and smear frames.
import * as THREE from 'three';

export const MAX_IMPACTS = 4;

export function createFighterMaterial(table, opts = {}) {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.0, sheen: 0.0, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) });
  const nB = opts.bones || 32;
  const u = {
    uMatA: { value: table.map((m) => new THREE.Vector4(m.albedo[0], m.albedo[1], m.albedo[2], m.rough)) },
    uMatB: { value: table.map((m) => new THREE.Vector4(m.metal ?? 0, m.sheen ?? 0, m.sss ?? 0, m.detail ?? 0.5)) },
    uMatC: { value: table.map((m) => new THREE.Vector4(m.kind ?? 0, m.tear ?? 0, m.emit ?? 0, 0)) },
    tNoise: { value: opts.noise3D },
    uDamage: { value: 0 }, uSoot: { value: 0 }, uWet: { value: 0 },
    uEnergy: { value: 0 }, uEnergyColor: { value: new THREE.Color(0.3, 0.8, 1.0) }, uEnergyMode: { value: opts.energyMode ?? 0 },
    uEyeColor: { value: new THREE.Color(0.1, 0.1, 0.1) }, uEyeGlow: { value: 0 },
    uIris: { value: new THREE.Color(0.2, 0.25, 0.3) },
    uEyeL: { value: new THREE.Vector3() }, uEyeR: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uImp: { value: Array.from({ length: MAX_IMPACTS }, () => new THREE.Vector4(0, -1000, 0, 0.1)) },
    uImpD: { value: Array.from({ length: MAX_IMPACTS }, () => new THREE.Vector4()) },
    uBoneVel: { value: Array.from({ length: nB }, () => new THREE.Vector3()) },
    uSmear: { value: 0 },
    uHairOff: { value: new THREE.Vector3() },
    uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) },
  };
  mat.userData.u = u;
  mat.customProgramCacheKey = () => 'fighter' + nB;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aBind;
attribute vec4 aMatA;
attribute vec4 aMatB;
attribute vec4 aExtra;
varying vec3 vBind;
varying vec4 vMatA;
varying vec4 vMatB;
varying vec4 vExtra;
varying vec3 vWorldP;
uniform vec4 uImp[${MAX_IMPACTS}];
uniform vec4 uImpD[${MAX_IMPACTS}];
uniform vec3 uBoneVel[${nB}];
uniform float uSmear;
uniform vec3 uHairOff;
uniform float uTime;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
{
  // world == model space for fighters (mesh has identity transform)
  vec3 wp = transformed;
  // impact dents: inward push + travelling ripple
  for (int i = 0; i < ${MAX_IMPACTS}; i++) {
    vec4 im = uImp[i];
    vec4 idd = uImpD[i];
    if (idd.w <= 0.0) continue;
    float d = distance(wp, im.xyz);
    float r = im.w;
    float core = exp(-d * d / (r * r));
    float ripple = sin(d * 42.0 - idd.w * 0.0 + uTime * 0.0) * exp(-d / (r * 2.5)) * 0.25;
    wp += idd.xyz * (core + ripple * (1.0 - core));
  }
  // smear frames: trailing surfaces stretch back along the local velocity
  if (uSmear > 0.0) {
    vec3 vel = uBoneVel[int(skinIndex.x)] * skinWeight.x + uBoneVel[int(skinIndex.y)] * skinWeight.y
             + uBoneVel[int(skinIndex.z)] * skinWeight.z + uBoneVel[int(skinIndex.w)] * skinWeight.w;
    float sp = length(vel);
    if (sp > 0.5) {
      vec3 vd = vel / sp;
      vec3 nw = normalize(objectNormal);
      float trail = smoothstep(-0.2, -0.9, dot(nw, vd));
      float streak = 0.55 + 0.45 * sin(dot(aBind, vec3(97.0, 131.0, 71.0)));
      wp -= vel * uSmear * trail * streak;
    }
  }
  wp += uHairOff * aExtra.y;
  transformed = wp;
  vWorldP = wp;
}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vBind = aBind; vMatA = aMatA; vMatB = aMatB; vExtra = aExtra;`);

    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
precision highp sampler3D;
varying vec3 vBind;
varying vec4 vMatA;
varying vec4 vMatB;
varying vec4 vExtra;
varying vec3 vWorldP;
uniform vec4 uMatA[8];
uniform vec4 uMatB[8];
uniform vec4 uMatC[8];
uniform sampler3D tNoise;
uniform float uDamage, uSoot, uWet, uEnergy, uEnergyMode, uEyeGlow, uTime, uFlash;
uniform vec3 uEnergyColor, uEyeColor, uFlashColor, uIris, uEyeL, uEyeR;
float gSkin = 0.0;
float gSSS = 0.0;
vec3 gEmit = vec3(0.0);
float n3(vec3 p) { return texture(tNoise, p).r; }
float cell3(vec3 p) { return texture(tNoise, p).b; }
float mw(int i) { return i < 4 ? vMatA[i] : vMatB[i - 4]; }
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
// distance to the nearest Voronoi cell border (F2 - F1 style, exact bisector distance)
float voronoiEdge(vec3 x) {
  vec3 p = floor(x), f = fract(x);
  vec3 mr = vec3(0.0), mb = vec3(0.0);
  float md = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(i, j, k);
    vec3 r = b + hash33(p + b) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mb = b; }
  }
  md = 8.0;
  for (int k = -2; k <= 2; k++) for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec3 b = mb + vec3(i, j, k);
    vec3 r = b + hash33(p + b) - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
}
vec3 perturbN(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
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
vec3 alb = vec3(0.0); float rgh = 0.0, met = 0.0, shn = 0.0, detail = 0.0, tearable = 0.0, emitW = 0.0;
float kindCloth = 0.0, kindLeather = 0.0, kindMetal = 0.0, kindHair = 0.0, kindSkin = 0.0;
for (int i = 0; i < 8; i++) {
  float w = mw(i);
  if (w < 0.002) continue;
  alb += w * uMatA[i].rgb; rgh += w * uMatA[i].a;
  met += w * uMatB[i].x; shn += w * uMatB[i].y; gSSS += w * uMatB[i].z; detail += w * uMatB[i].w;
  float k = uMatC[i].x;
  kindSkin += w * float(k < 0.5); kindCloth += w * float(abs(k - 1.0) < 0.5); kindLeather += w * float(abs(k - 2.0) < 0.5);
  kindMetal += w * float(abs(k - 3.0) < 0.5); kindHair += w * float(abs(k - 4.0) < 0.5);
  tearable += w * uMatC[i].y; emitW += w * uMatC[i].z;
}
gSkin = kindSkin;
vec3 bp = vBind;
alb *= 1.0 - smoothstep(0.55, 0.85, vExtra.z) * 0.8;
// stubble: dense dark dots on the jaw
float stub = vExtra.w * smoothstep(0.35, 0.75, n3(vBind * 160.0)) ;
alb = mix(alb, alb * 0.35, stub * 0.75);
// micro variation
float nA = n3(bp * 1.7), nB = n3(bp * 7.3 + 3.1), nC = n3(bp * 23.0 + 7.7);
alb *= 0.9 + 0.2 * nA;
alb = mix(alb, alb * vec3(1.05, 0.93, 0.9), kindSkin * smoothstep(0.45, 0.7, nB) * 0.5);
// cloth weave / leather grain / hair strands
float weave = sin(bp.x * 1400.0 + bp.y * 900.0) * sin(bp.y * 1300.0 - bp.z * 800.0);
float hgt = 0.0;
hgt += kindCloth * (weave * 0.00035 + nC * 0.0012);
hgt += kindLeather * (cell3(bp * 11.0) * 0.0012 + nC * 0.0006);
hgt += kindSkin * (n3(bp * 55.0) * 0.00035 + nC * 0.0005);
hgt += kindHair * (sin(bp.x * 900.0 + bp.z * 300.0 + nB * 12.0) * 0.0009);
hgt += kindMetal * (n3(bp * 80.0) * 0.0002);
// wear on metal edges and leather creases
alb = mix(alb, alb * 1.6, kindMetal * smoothstep(0.62, 0.8, nB) * 0.6);
// ---- damage accumulation
float dmg = uDamage;
float dust = smoothstep(0.55 - dmg * 0.5, 0.95 - dmg * 0.4, n3(bp * 3.1 + 11.0) * 0.7 + nC * 0.3);
vec3 dustCol = vec3(0.42, 0.39, 0.35);
alb = mix(alb, dustCol, dust * dmg * 0.75);
rgh = mix(rgh, 0.95, dust * dmg * 0.8);
float soot = smoothstep(0.6, 0.9, n3(bp * 2.3 + 5.0) + nB * 0.2) * uSoot;
alb = mix(alb, vec3(0.03, 0.028, 0.026), soot * 0.8);
float scratch = smoothstep(0.985, 0.999, sin(bp.x * 180.0 + bp.y * 60.0 + nB * 9.0) * n3(bp * 4.0 + 2.0) * 1.2) * dmg;
alb = mix(alb, mix(alb * 1.7, vec3(0.45, 0.08, 0.06), kindSkin), scratch * 0.8);
// torn cloth reveals skin underneath
float tearN = n3(bp * 4.2 + 17.0) * 0.75 + nB * 0.25;
float tear = tearable * smoothstep(1.05 - dmg * 0.55, 1.08 - dmg * 0.55, tearN);
float tearEdge = tearable * (smoothstep(0.98 - dmg * 0.55, 1.05 - dmg * 0.55, tearN) - tear);
vec3 skinAlb = uMatA[0].rgb;
alb = mix(alb, skinAlb * 0.85, tear);
alb *= 1.0 - tearEdge * 0.7;
rgh = mix(rgh, uMatA[0].a, tear);
gSkin = max(gSkin, tear);
hgt += tearEdge * 0.002;
// eyes: sclera, limbal ring, iris, pupil computed from the direction inside the eyeball
float eye = smoothstep(0.35, 0.8, vExtra.x);
float irisMask = 0.0;
if (eye > 0.001) {
  vec3 ec = distance(bp, uEyeL) < distance(bp, uEyeR) ? uEyeL : uEyeR;
  vec3 ed = normalize(bp - ec);
  vec3 fwd = normalize(vec3(sign(ec.x) * 0.08, -0.03, 1.0));
  float ca = dot(ed, fwd);
  float iris = smoothstep(0.87, 0.885, ca);
  float pupil = smoothstep(0.965, 0.972, ca);
  float limbal = smoothstep(0.86, 0.875, ca) - smoothstep(0.875, 0.9, ca);
  vec3 sclera = vec3(0.78, 0.74, 0.7) * (0.85 + 0.15 * ca);
  vec3 irisC = uIris * (0.7 + 0.6 * n3(bp * 300.0)) * (0.6 + 0.4 * smoothstep(0.885, 0.96, ca));
  vec3 eyeC = mix(sclera, irisC, iris);
  eyeC = mix(eyeC, vec3(0.01), pupil);
  eyeC *= 1.0 - limbal * 0.6;
  alb = mix(alb, eyeC, eye);
  irisMask = iris * eye;
  gSSS *= 1.0 - eye;
}
// lash line / eye shadow: darken skin that wraps the upper eyeball edge
{
  vec3 ec = distance(bp, uEyeL) < distance(bp, uEyeR) ? uEyeL : uEyeR;
  vec3 q = bp - ec;
  float r = length(q);
  float lash = smoothstep(0.0165, 0.0128, r) * smoothstep(-0.004, 0.003, q.y) * smoothstep(0.004, 0.009, q.z) * (1.0 - eye);
  float lower = smoothstep(0.0155, 0.0128, r) * smoothstep(0.0, -0.005, q.y) * (1.0 - eye) * 0.35;
  alb = mix(alb, vec3(0.03, 0.02, 0.02), clamp(lash * 0.9 + lower, 0.0, 1.0) * kindSkin);
  // subtle eye-socket shadow tint
  alb *= 1.0 - kindSkin * smoothstep(0.03, 0.014, r) * 0.18;
}
diffuseColor.rgb = alb;
float gRough = clamp(rgh + (nC - 0.5) * 0.08, 0.04, 1.0);
gRough = mix(gRough, 0.05, eye);
float gMetal = met;
// energy
float en = uEnergy;
if (en > 0.001) {
  if (uEnergyMode < 0.5) {
    // electric filaments crawling over the surface
    float t = uTime;
    float f1 = abs(n3(bp * 2.6 + vec3(0.0, t * 0.35, t * 0.11)) - 0.5);
    float f2 = abs(n3(bp * 5.1 - vec3(t * 0.2, 0.0, t * 0.3)) - 0.5);
    float fil = smoothstep(0.018, 0.0, f1 * f2 * 4.0 - 0.001) * smoothstep(0.3, 0.9, en);
    gEmit += uEnergyColor * (fil * 8.0 + 0.15 * en) * (0.6 + 0.4 * sin(t * 40.0 + bp.y * 30.0));
  } else {
    // magma veins along cellular cell borders (F2 - F1), finer branches layered on top
    vec3 wq = bp * 11.0 + (vec3(n3(bp * 2.0), n3(bp * 2.0 + 5.0), n3(bp * 2.0 + 9.0)) - 0.5) * 2.2;
    float e1 = voronoiEdge(wq);
    float vein = smoothstep(0.035 + en * 0.07, 0.0, e1) * (kindSkin + emitW);
    float pulse = 0.75 + 0.25 * sin(uTime * 3.0 + bp.y * 8.0);
    gEmit += uEnergyColor * vein * en * 14.0 * pulse;
    alb = mix(alb, alb * 0.55, vein * en);
    diffuseColor.rgb = alb;
  }
}
gEmit += uEyeColor * irisMask * uEyeGlow * 30.0;
gEmit += uFlashColor * uFlash;
`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = gRough;`)
      .replace('#include <metalnessmap_fragment>', `float metalnessFactor = gMetal;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec2 dH = vec2(dFdx(hgt), dFdy(hgt)) * 1.0;
  normal = perturbN(-vViewPosition, normal, dH * 1.0, faceDirection);
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += gEmit;`)
      // wrap lighting + subsurface tint for skin
      .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>`);
    sh.fragmentShader = sh.fragmentShader.replace(
      'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
      `vec3 sssTint = vec3(1.0, 0.38, 0.25);
vec3 outgoingLight = totalDiffuse * (1.0 + gSSS * sssTint * 0.35) + totalSpecular + totalEmissiveRadiance;`);
  };
  return mat;
}

// Curtain-wall / window glass. Instanced thin panes; per-instance mode:
//   0 = interior-mapped (opaque look: parallax rooms behind the pane)
//   1 = see-through (real interior geometry behind)
// Reflections come from an equirect environment (sky + procedural skyline band).
import * as THREE from 'three';
import { damageUniforms } from './archmat.js';

const VERT = /* glsl */ `
attribute vec4 aGlass;   // x mode, y seed, z crack, w room depth
attribute vec3 aTint;
varying vec3 vW; varying vec3 vN; varying vec3 vLocal; varying vec3 vSize; varying vec4 vG; varying vec3 vTint;
varying vec3 vRoomX; varying vec3 vRoomY; varying vec3 vRoomZ;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  mat3 im = mat3(modelMatrix) * mat3(instanceMatrix);
  vec3 sc = vec3(length(im[0]), length(im[1]), length(im[2]));
  vN = normalize(im * normal);
  vLocal = position * sc; vSize = sc;
  vG = aGlass; vTint = aTint;
  // pane frame axes in world (x: across, y: up, z: pane normal = thin axis)
  vRoomX = im[0] / sc.x; vRoomY = im[1] / sc.y; vRoomZ = im[2] / sc.z;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tEnv;
uniform sampler2D tNoise2;
uniform vec3 uSunDir, uSunCol, uCamPos;
uniform float uPower, uTime, uNight, uEnvGain, uFloorH, uExposureHint;
varying vec3 vW; varying vec3 vN; varying vec3 vLocal; varying vec3 vSize; varying vec4 vG; varying vec3 vTint;
varying vec3 vRoomX; varying vec3 vRoomY; varying vec3 vRoomZ;
#define PI 3.14159265
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 env(vec3 d, float lod) {
  float phi = (abs(d.x) + abs(d.z) < 1e-5) ? 0.0 : atan(d.x, d.z);
  float th = asin(clamp(d.y, -1.0, 1.0));
  return textureLod(tEnv, vec2(phi / (2.0 * PI) + 0.5, th / PI + 0.5), lod).rgb;
}
void main() {
  vec3 V = normalize(uCamPos - vW);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  float cosT = clamp(dot(N, V), 0.0, 1.0);
  float seed = vG.y;
  // slight waviness in reflections (float glass imperfection)
  vec2 wob = (texture(tNoise2, vW.xy * 0.05 + seed).rg - 0.5) * 0.02;
  vec3 R = reflect(-V, normalize(N + vec3(wob.x, wob.y, 0.0)));
  float F0 = vG.x < 0.5 ? 0.22 : 0.08;
  float F = F0 + (1.0 - F0) * pow(1.0 - cosT, 5.0);
  vec3 refl = env(R, 1.0) * uEnvGain;
  float glint = pow(max(dot(R, uSunDir), 0.0), 900.0) * 60.0 + pow(max(dot(R, uSunDir), 0.0), 60.0) * 0.8;
  refl += uSunCol * glint;
  // cracks (spiderweb from a per-pane origin)
  float crack = 0.0;
  if (vG.z > 0.001) {
    vec2 o = (vec2(h21(vec2(seed, 1.0)), h21(vec2(seed, 2.0))) - 0.5) * vSize.xy * 0.6;
    vec2 q = vLocal.xy - o;
    float r = length(q), a = atan(q.y, q.x);
    float rays = abs(fract(a * 14.0 / 6.2831 + seed * 7.0) - 0.5);
    float rl = smoothstep(0.03, 0.0, rays * r * 3.0) * smoothstep(vG.z * 2.5, 0.0, r);
    float rings = smoothstep(0.02, 0.0, abs(fract(r * 3.5 + h21(vec2(floor(a * 14.0 / 6.2831), seed)) * 0.3) - 0.5) - 0.47) * smoothstep(vG.z * 1.8, 0.0, r);
    crack = clamp(max(rl, rings * 0.8) * clamp(vG.z * 2.0, 0.0, 1.0), 0.0, 1.0);
  }
  vec4 outc;
  if (vG.x < 0.5) {
    // interior mapping: room box behind the pane. Local frame: x across, y up, z into the building (-normal)
    vec3 ro = vec3(vLocal.x / vSize.x + 0.5, vLocal.y / vSize.y + 0.5, 0.0);
    vec3 wd = -V;
    vec3 inward = -vRoomZ * sign(dot(vRoomZ, V));
    vec3 rd = vec3(dot(wd, vRoomX) / vSize.x, dot(wd, vRoomY) / vSize.y, dot(wd, inward) / max(vG.w, 1.0));
    rd = normalize(rd);
    // room is [0,1]^2 x [0,1] in this normalized space
    vec3 tMax = (step(0.0, rd) - ro) / rd;
    tMax = max(tMax, (vec3(1.0) - step(0.0, rd) - ro) / rd * 0.0 - 1e6);
    float tx = rd.x > 0.0 ? (1.0 - ro.x) / rd.x : -ro.x / rd.x;
    float ty = rd.y > 0.0 ? (1.0 - ro.y) / rd.y : -ro.y / rd.y;
    float tz = (1.0 - ro.z) / max(rd.z, 1e-4);
    float t = min(min(tx, ty), tz);
    vec3 hp = ro + rd * t;
    float room = h21(vec2(seed * 13.1, floor(vW.y / uFloorH)));
    float lit = step(0.62 - 0.3 * uNight, h21(vec2(seed, 7.0))) * uPower;
    vec3 wallC = mix(vec3(0.55, 0.52, 0.48), vec3(0.42, 0.45, 0.5), room);
    vec3 col;
    if (t == tz) {
      col = wallC * 0.8;
      // furniture band and a partition silhouette
      float desk = step(hp.y, 0.3) * step(0.18, hp.y);
      col *= 1.0 - desk * 0.6;
    } else if (t == ty) {
      col = rd.y > 0.0 ? vec3(0.7) * (1.0 + step(abs(fract(hp.x * 2.0) - 0.5), 0.15) * step(abs(hp.z - 0.5), 0.2) * 3.0 * lit) : vec3(0.18, 0.17, 0.2);
    } else {
      col = wallC * 0.65;
    }
    float depthShade = mix(1.0, 0.45, hp.z);
    vec3 lightC = mix(vec3(0.015, 0.018, 0.024), vec3(1.0, 0.92, 0.78) * mix(0.35, 1.3, uNight), lit);
    col *= lightC * depthShade;
    // blinds
    float blinds = step(0.55, h21(vec2(seed, 3.3)));
    float bl = blinds * step(1.0 - h21(vec2(seed, 5.1)) * 0.8, ro.y) * (0.6 + 0.4 * step(0.5, fract(ro.y * vSize.y * 12.0)));
    col = mix(col, vec3(0.5, 0.48, 0.45) * (0.15 + lit * 0.9), bl * 0.9);
    vec3 trans = col * vTint * (1.0 - F);
    outc = vec4(trans + refl * F, 1.0);
  } else {
    float a = clamp(F + 0.06, 0.0, 1.0);
    outc = vec4(refl * F + vTint * 0.01, a);
  }
  outc.rgb = mix(outc.rgb, vec3(0.75, 0.78, 0.8) * (0.3 + 0.7 * max(dot(N, uSunDir), 0.0)) * uEnvGain, crack * 0.85);
  outc.a = max(outc.a, crack * 0.9);
  gl_FragColor = outc;
}`;

export function makeGlassMaterial(noise2D, envTex, transparent) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      tEnv: { value: envTex }, tNoise2: { value: noise2D },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Vector3(1, 1, 1) }, uCamPos: { value: new THREE.Vector3() },
      uPower: damageUniforms.uPower, uTime: damageUniforms.uTime, uNight: damageUniforms.uNight,
      uEnvGain: { value: 1 }, uFloorH: { value: 4 }, uExposureHint: { value: 1 },
    },
    transparent, depthWrite: !transparent, side: THREE.DoubleSide,
  });
  mat.onBeforeRender = () => {};
  return mat;
}

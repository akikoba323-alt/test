// Sky: single-scattering atmosphere baked into an equirect LUT when the sun moves, plus a
// procedural cloud deck, sun disk, stars, smoke darkening and ground-fire glow on cloud bases.
// Also produces the PMREM environment used for reflections and image based lighting.
import * as THREE from 'three';
import { Pass, makeRT } from './fsq.js';
import { COMMON } from './glsl.js';

const ATMOS = /* glsl */ `
${COMMON}
uniform vec3 uSunDir;
uniform float uSunPower;
varying vec2 vUv;
// Rayleigh + Mie single scattering (after glsl-atmosphere, wwwtyro)
const float rPlanet = 6371e3, rAtmos = 6471e3;
const vec3 kRlh = vec3(5.5e-6, 13.0e-6, 22.4e-6);
const float kMie = 21e-6, shRlh = 8e3, shMie = 1.2e3, g = 0.758;
vec2 rsi(vec3 r0, vec3 rd, float sr) {
  float a = dot(rd, rd), b = 2.0 * dot(rd, r0), c = dot(r0, r0) - sr * sr, d = b * b - 4.0 * a * c;
  if (d < 0.0) return vec2(1e5, -1e5);
  return vec2((-b - sqrt(d)) / (2.0 * a), (-b + sqrt(d)) / (2.0 * a));
}
vec3 atmosphere(vec3 r, vec3 r0, vec3 pSun) {
  vec2 p = rsi(r0, r, rAtmos);
  if (p.x > p.y) return vec3(0.0);
  p.y = min(p.y, rsi(r0, r, rPlanet).x);
  const int I = 20, J = 8;
  float iStep = (p.y - p.x) / float(I);
  float iTime = 0.0, iOdR = 0.0, iOdM = 0.0;
  vec3 totR = vec3(0.0), totM = vec3(0.0);
  float mu = dot(r, pSun), mumu = mu * mu, gg = g * g;
  float pR = 3.0 / (16.0 * PI) * (1.0 + mumu);
  float pM = 3.0 / (8.0 * PI) * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));
  for (int i = 0; i < I; i++) {
    vec3 iPos = r0 + r * (iTime + iStep * 0.5);
    float iH = length(iPos) - rPlanet;
    float odR = exp(-iH / shRlh) * iStep, odM = exp(-iH / shMie) * iStep;
    iOdR += odR; iOdM += odM;
    float jStep = rsi(iPos, pSun, rAtmos).y / float(J);
    float jTime = 0.0, jOdR = 0.0, jOdM = 0.0;
    for (int j = 0; j < J; j++) {
      vec3 jPos = iPos + pSun * (jTime + jStep * 0.5);
      float jH = length(jPos) - rPlanet;
      jOdR += exp(-jH / shRlh) * jStep; jOdM += exp(-jH / shMie) * jStep;
      jTime += jStep;
    }
    vec3 attn = exp(-(kMie * (iOdM + jOdM) + kRlh * (iOdR + jOdR)));
    totR += odR * attn; totM += odM * attn;
    iTime += iStep;
  }
  return uSunPower * (pR * kRlh * totR + pM * kMie * totM);
}
void main() {
  float phi = (vUv.x - 0.5) * 2.0 * PI;
  float th = (vUv.y - 0.5) * PI;
  vec3 dir = vec3(cos(th) * sin(phi), sin(th), cos(th) * cos(phi));
  vec3 d = dir; d.y = max(d.y, -0.02);
  vec3 c = atmosphere(normalize(d), vec3(0.0, rPlanet + 40.0, 0.0), uSunDir);
  gl_FragColor = vec4(c, 1.0);
}`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_COMMON = /* glsl */ `
${COMMON}
uniform sampler2D tLut;
uniform sampler2D tNoise2;
uniform vec3 uSunDir, uSunColor, uMoonDir;
uniform float uTime, uCloudCover, uCloudBright, uSmoke, uNight, uStars, uSunDisk, uExpo;
uniform vec3 uGroundGlow, uSmokeColor, uHorizonTint;
uniform float uGroundGlowAmt, uSkyline, uCityLights;
uniform vec3 uCloudShift;
vec3 lut(vec3 d) {
  float phi = (abs(d.x) + abs(d.z) < 1e-5) ? 0.0 : atan(d.x, d.z);
  float th = asin(clamp(d.y, -1.0, 1.0));
  return texture(tLut, vec2(phi / (2.0 * PI) + 0.5, th / PI + 0.5)).rgb;
}
float cloudField(vec2 p) {
  float n = texture(tNoise2, p * 0.00011 + uCloudShift.xy).r * 0.55
          + texture(tNoise2, p * 0.00031 - uCloudShift.xy * 1.7).r * 0.3
          + texture(tNoise2, p * 0.0011 + uCloudShift.xy * 3.0).g * 0.15;
  return smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover + 0.35, n);
}
vec3 skyColor(vec3 d, bool withSun) {
  vec3 col = lut(d) * uExpo;
  float mu = dot(d, uSunDir);
  if (withSun) {
    float disk = smoothstep(0.99985, 0.99992, mu);
    col += uSunColor * disk * uSunDisk * 40.0;
    col += uSunColor * pow(max(mu, 0.0), 600.0) * 2.0 * uSunDisk;
  }
  if (uStars > 0.0 && d.y > 0.0) {
    vec3 sp = d * 420.0;
    vec3 cell = floor(sp);
    float h = hash13(cell);
    float star = step(0.9975, h) * smoothstep(0.9, 0.2, length(fract(sp) - 0.5) * 2.0);
    col += vec3(0.8, 0.85, 1.0) * star * uStars * (0.4 + 0.6 * hash13(cell + 7.0)) * smoothstep(0.0, 0.2, d.y);
  }
  if (d.y > 0.004) {
    float t = 2200.0 / d.y;
    vec2 p = d.xz * t;
    float c = cloudField(p);
    float c2 = cloudField(p + uSunDir.xz * 240.0);
    float lit = clamp(1.0 - (c2 - c) * 1.6, 0.25, 1.35);
    vec3 sunLit = uSunColor * (0.25 + 1.2 * pow(max(mu, 0.0), 6.0)) * lit;
    vec3 amb = lut(normalize(vec3(d.x, 0.35, d.z))) * uExpo * 1.4;
    vec3 cloudCol = (amb + sunLit * 0.9) * uCloudBright;
    cloudCol += uGroundGlow * uGroundGlowAmt * (0.6 + 0.8 * (1.0 - lit));
    float fade = smoothstep(0.004, 0.08, d.y);
    col = mix(col, cloudCol, c * fade * 0.92);
  }
  float hz = exp(-max(d.y, 0.0) * 9.0);
  col = mix(col, col * uHorizonTint, hz * 0.5);
  float sm = uSmoke * (0.55 + 0.45 * hz) * smoothstep(-0.1, 0.35, 1.0 - d.y);
  col = mix(col, uSmokeColor + uGroundGlow * uGroundGlowAmt * hz * 0.5, clamp(sm, 0.0, 0.97));
  if (d.y < 0.0) col = mix(col, uSmokeColor * 0.4 + lut(vec3(d.x, 0.02, d.z)) * uExpo * 0.25, smoothstep(0.0, -0.05, d.y));
  return max(col, vec3(0.0));
}
// distant skyline silhouette for reflections
vec3 skyline(vec3 d, vec3 col) {
  if (uSkyline <= 0.0) return col;
  float phi = atan(d.x, d.z);
  float cell = floor(phi * 90.0);
  float hgt = 0.012 + 0.06 * pow(hash12(vec2(cell, 3.0)), 2.2) + 0.02 * hash12(vec2(floor(phi * 23.0), 9.0));
  if (d.y < hgt && d.y > -0.2) {
    vec3 b = mix(vec3(0.05, 0.055, 0.065), lut(vec3(d.x, 0.1, d.z)) * uExpo * 0.25, 0.5);
    vec2 w = vec2(phi * 2200.0, d.y * 900.0);
    float win = step(0.45, fract(w.x)) * step(0.4, fract(w.y)) * step(0.62, hash12(floor(w) + cell));
    b += vec3(1.0, 0.8, 0.55) * win * uCityLights * 2.0;
    col = mix(col, b, uSkyline);
  }
  return col;
}
`;

const SKY_FRAG = /* glsl */ `
${SKY_COMMON}
varying vec3 vDir;
void main() { gl_FragColor = vec4(skyColor(normalize(vDir), true), 1.0); }
`;

const ENV_FRAG = /* glsl */ `
${SKY_COMMON}
varying vec2 vUv;
void main() {
  float phi = (vUv.x - 0.5) * 2.0 * PI;
  float th = (vUv.y - 0.5) * PI;
  vec3 d = vec3(cos(th) * sin(phi), sin(th), cos(th) * cos(phi));
  vec3 c = skyColor(d, true);
  c = skyline(d, c);
  gl_FragColor = vec4(min(c, vec3(200.0)), 1.0);
}`;

export class Sky {
  constructor(renderer, noise2D) {
    this.r = renderer;
    this.lutRT = makeRT(256, 128, { type: THREE.HalfFloatType });
    this.lutPass = new Pass(ATMOS, { uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunPower: { value: 22 } });
    this.uniforms = {
      tLut: { value: this.lutRT.texture }, tNoise2: { value: noise2D },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Vector3(1, 1, 1) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uTime: { value: 0 }, uCloudCover: { value: 0.45 }, uCloudBright: { value: 1 }, uSmoke: { value: 0 }, uNight: { value: 0 }, uStars: { value: 0 },
      uSunDisk: { value: 1 }, uExpo: { value: 1 }, uGroundGlow: { value: new THREE.Vector3(1, 0.35, 0.1) }, uGroundGlowAmt: { value: 0 },
      uSmokeColor: { value: new THREE.Vector3(0.05, 0.045, 0.04) }, uHorizonTint: { value: new THREE.Vector3(1, 0.95, 0.9) },
      uCloudShift: { value: new THREE.Vector3() }, uSkyline: { value: 0 }, uCityLights: { value: 0 },
    };
    // equirect environment for glass reflections (sky + skyline band)
    this.envEquiRT = new THREE.WebGLRenderTarget(512, 256, { type: THREE.HalfFloatType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false });
    this.envPass = new Pass(ENV_FRAG, this.uniforms);
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.uniforms,
      side: THREE.BackSide, depthWrite: false, depthTest: true,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.onBeforeRender = (r, s, cam) => { this.mesh.position.setFromMatrixPosition(cam.matrixWorld); this.mesh.scale.setScalar(cam.far * 0.9); this.mesh.updateMatrixWorld(); };
    // env generation scene: sky + optional skyline silhouette ring
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), this.material);
    this.envSky.onBeforeRender = () => {};
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.lastSun = new THREE.Vector3(9, 9, 9);
  }

  addEnvObject(obj) { this.envScene.add(obj); }

  update(state) {
    const u = this.uniforms;
    u.uSunDir.value.copy(state.sunDir);
    u.uSunColor.value.copy(state.sunColorVec);
    u.uTime.value = state.time;
    u.uCloudCover.value = state.cloudCover;
    u.uCloudBright.value = state.cloudBright;
    u.uSmoke.value = state.smoke;
    u.uStars.value = state.stars;
    u.uSunDisk.value = state.sunDisk;
    u.uExpo.value = state.skyExpo;
    u.uGroundGlowAmt.value = state.groundGlow;
    u.uGroundGlow.value.copy(state.groundGlowColor);
    u.uSmokeColor.value.copy(state.smokeColor);
    u.uCloudShift.value.set(state.time * 0.0008, state.time * 0.0003, 0);
    if (state.sunDir.distanceTo(this.lastSun) > 0.002) {
      this.lutPass.u.uSunDir.value.copy(state.sunDir);
      this.lutPass.render(this.r, this.lutRT);
      this.lastSun.copy(state.sunDir);
      this.envDirty = true;
    }
  }

  // Equirect reflection map for glass (sky + skyline).
  buildEquirect(skylineAmt = 1, cityLights = 0.2) {
    this.uniforms.uSkyline.value = skylineAmt;
    this.uniforms.uCityLights.value = cityLights;
    this.envPass.render(this.r, this.envEquiRT);
    this.uniforms.uSkyline.value = 0;
    return this.envEquiRT.texture;
  }

  // Rebuild the PMREM reflection environment (call sparingly).
  buildEnv() {
    if (this.envRT) this.envRT.dispose();
    this.envSky.position.set(0, 0, 0);
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.5, 5000);
    this.envDirty = false;
    return this.envRT.texture;
  }
}

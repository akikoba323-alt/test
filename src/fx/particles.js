// GPU particle system: state in float textures (MRT ping-pong), ring-buffer spawning from a CPU
// queue, per-type physics (gravity, drag, buoyancy, curl-noise turbulence, ground bounce),
// forces from shockwave shells and from fast-moving fighters, and soft lit billboards.
import * as THREE from 'three';
import { INTERIOR_GLSL, interiorUniforms } from '../render/interior.js';

export const PT = {
  DUST: 0, SMOKE: 1, SPARK: 2, EMBER: 3, CHIP: 4, GLASS: 5, FIRE: 6, RING: 7, WATER: 8, PAPER: 9, ENERGY: 10, TRAIL: 11, VAPOR: 12, FLASH: 13, BLOOD: 14, ASH: 15,
};
// per type: gravity, drag, buoyancy, turbulence, bounce, groundStop
const TYPE_TABLE = [
  [0.15, 2.2, 0.35, 0.8, 0.0, 1], // DUST
  [0.0, 1.2, 1.4, 1.2, 0.0, 1],   // SMOKE
  [1.0, 0.35, 0.0, 0.05, 0.45, 0], // SPARK
  [0.05, 1.6, 0.9, 1.6, 0.0, 1],  // EMBER
  [1.0, 0.15, 0.0, 0.0, 0.35, 0], // CHIP
  [1.0, 0.25, 0.0, 0.1, 0.25, 0], // GLASS
  [0.0, 2.5, 3.0, 1.5, 0.0, 1],   // FIRE
  [0.06, 3.2, 0.0, 0.45, 0.0, 1], // RING (ground shock dust)
  [1.0, 0.6, 0.0, 0.2, 0.1, 1],   // WATER
  [0.25, 3.0, 0.0, 2.5, 0.0, 1],  // PAPER
  [0.0, 2.0, 0.3, 2.0, 0.0, 1],   // ENERGY
  [0.1, 2.8, 0.25, 0.8, 0.0, 1],  // TRAIL
  [0.0, 4.0, 0.1, 0.3, 0.0, 1],   // VAPOR
  [0.0, 0.0, 0.0, 0.0, 0.0, 1],   // FLASH
  [1.0, 0.3, 0.0, 0.0, 0.0, 1],   // BLOOD (unused, reserved)
  [0.08, 1.8, 0.2, 1.4, 0.0, 1],  // ASH
];

const SIM_VERT = `
in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const SIM_FRAG = `
precision highp float;
precision highp sampler3D;
uniform sampler2D tPos, tVel, tProp, tSpawnA, tSpawnB, tSpawnC;
uniform sampler3D tNoise;
uniform float uDt, uTime;
uniform int uHead, uCount, uN, uSpawnW;
uniform vec4 uTypeA[16]; // gravity, drag, buoyancy, turbulence
uniform vec4 uTypeB[16]; // bounce, groundStop
uniform vec4 uShock[8];  // xyz center, w radius
uniform vec4 uShockP[8]; // x thickness, y strength, z speed
uniform int uShockN;
uniform vec4 uMover[4];  // xyz pos, w radius
uniform vec4 uMoverV[4]; // xyz velocity
uniform int uMoverN;
uniform vec3 uWind;
uniform vec4 uFloors[8]; // x0, z0, x1, z1 of a raised floor region (w stored in uFloorY)
uniform float uFloorY[8];
uniform int uFloorN;
layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVel;
layout(location = 2) out vec4 oProp;
vec3 curl(vec3 p) {
  float e = 0.35;
  vec3 dx = vec3(e, 0, 0), dy = vec3(0, e, 0), dz = vec3(0, 0, e);
  float n1 = texture(tNoise, (p + dy) * 0.04).r - texture(tNoise, (p - dy) * 0.04).r;
  float n2 = texture(tNoise, (p + dz) * 0.04).g - texture(tNoise, (p - dz) * 0.04).g;
  float n3 = texture(tNoise, (p + dx) * 0.04).b - texture(tNoise, (p - dx) * 0.04).b;
  float n4 = texture(tNoise, (p + dz + 7.1) * 0.04).r - texture(tNoise, (p - dz + 7.1) * 0.04).r;
  float n5 = texture(tNoise, (p + dx + 3.3) * 0.04).g - texture(tNoise, (p - dx + 3.3) * 0.04).g;
  float n6 = texture(tNoise, (p + dy + 5.7) * 0.04).b - texture(tNoise, (p - dy + 5.7) * 0.04).b;
  return vec3(n1 - n2, n3 - n4, n5 - n6) / (2.0 * e);
}
float floorAt(vec3 p) {
  float f = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uFloorN) break;
    vec4 r = uFloors[i];
    if (p.x > r.x && p.x < r.z && p.z > r.y && p.z < r.w && p.y > uFloorY[i] - 0.5) f = max(f, uFloorY[i]);
  }
  return f;
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int W = textureSize(tPos, 0).x;
  int idx = c.y * W + c.x;
  int rel = (idx - uHead + uN) % uN;
  if (rel < uCount) {
    ivec2 sc = ivec2(rel % uSpawnW, rel / uSpawnW);
    vec4 a = texelFetch(tSpawnA, sc, 0), b = texelFetch(tSpawnB, sc, 0), p = texelFetch(tSpawnC, sc, 0);
    // a.w is the (negative or zero) initial age offset; advance by it for sub-frame spawn timing
    oPos = a; oVel = b; oProp = p;
    return;
  }
  vec4 P = texelFetch(tPos, c, 0), V = texelFetch(tVel, c, 0), Pr = texelFetch(tProp, c, 0);
  if (V.w <= 0.0 || P.w < 0.0 || P.w > V.w) { oPos = vec4(P.xyz, -1.0); oVel = V; oProp = Pr; return; }
  float dt = uDt;
  int type = int(Pr.x + 0.5);
  vec4 ta = uTypeA[type], tb = uTypeB[type];
  vec3 pos = P.xyz, vel = V.xyz;
  float age = P.w;
  // forces
  vec3 acc = vec3(0.0, -9.8 * ta.x, 0.0);
  acc.y += ta.z * exp(-age * 0.25) * (1.0 + Pr.w * 0.0);
  acc += curl(pos + vec3(0.0, uTime * 0.3, float(type))) * ta.w * 2.0;
  acc += uWind * (0.3 + ta.y * 0.2);
  for (int i = 0; i < 8; i++) {
    if (i >= uShockN) break;
    vec3 d = pos - uShock[i].xyz;
    float r = length(d);
    float shell = exp(-pow((r - uShock[i].w) / max(uShockP[i].x, 0.5), 2.0));
    acc += (d / max(r, 0.01)) * shell * uShockP[i].y * 60.0;
  }
  for (int i = 0; i < 4; i++) {
    if (i >= uMoverN) break;
    vec3 d = pos - uMover[i].xyz;
    float r = length(d);
    float R = uMover[i].w;
    if (r < R) {
      float k = 1.0 - r / R;
      vec3 mv = uMoverV[i].xyz;
      acc += (mv * 2.2 + normalize(d + 1e-4) * length(mv) * 1.5) * k * k * 3.0;
    }
  }
  // drag toward still air
  vel += acc * dt;
  vel *= exp(-ta.y * dt);
  pos += vel * dt;
  float fl = floorAt(pos);
  if (pos.y < fl) {
    pos.y = fl;
    if (tb.x > 0.0 && vel.y < -0.5) { vel.y = -vel.y * tb.x; vel.xz *= 0.6; }
    else { vel.y = max(vel.y, 0.0); vel.xz *= exp(-6.0 * dt * tb.y); }
  }
  age += dt;
  oPos = vec4(pos, age); oVel = vec4(vel, V.w); oProp = Pr;
}`;

const REN_VERT = `
precision highp float;
precision highp sampler3D;
precision highp sampler2DShadow;
in vec3 position;
uniform sampler2D tPos, tVel, tProp;
uniform sampler2DShadow tShadow;
uniform mat4 uShadowM[2];
uniform vec4 uCascade[2];
uniform float uShadowOn;
out float vSunVis;
uniform mat4 viewMatrix, projectionMatrix;
uniform vec3 uCamPos, uCamRight, uCamUp;
uniform vec2 uRes;
uniform float uTime;
out vec2 vUv; out float vType; out float vAgeN; out float vSeed; out vec3 vWp; out float vViewZ; out float vSize; out vec3 vVel; out float vLifeAge;
void main() {
  int W = textureSize(tPos, 0).x;
  int id = gl_InstanceID;
  ivec2 c = ivec2(id % W, id / W);
  vec4 P = texelFetch(tPos, c, 0), V = texelFetch(tVel, c, 0), Pr = texelFetch(tProp, c, 0);
  float life = V.w, age = P.w;
  vType = Pr.x; vSeed = Pr.z; vVel = V.xyz;
  if (life <= 0.0 || age < 0.0 || age >= life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float t = age / life;
  vAgeN = t; vLifeAge = age;
  int type = int(Pr.x + 0.5);
  float size = Pr.y;
  // growth curves
  if (type == 0 || type == 7 || type == 11) size *= 0.4 + 2.1 * (1.0 - exp(-age * 1.4)) + age * 0.12;
  else if (type == 1 || type == 15) size *= 0.5 + age * 0.6;
  else if (type == 6) size *= (0.6 + 0.8 * sin(3.1416 * min(t * 1.3, 1.0)));
  else if (type == 12) size *= 0.5 + 2.5 * t;
  else if (type == 13) size *= 0.5 + 1.5 * t;
  vSize = size;
  vec3 wp = P.xyz;
  vec3 right = uCamRight, up = uCamUp;
  vec2 q = position.xy;
  if (type == 2 || type == 5 || type == 8) {
    // velocity-aligned streak
    vec3 vv = V.xyz;
    vec4 a = viewMatrix * vec4(wp, 1.0);
    vec4 b = viewMatrix * vec4(wp - vv * 0.03, 1.0);
    vec2 sd = (b.xy / max(-b.z, 0.01) - a.xy / max(-a.z, 0.01));
    float sl = length(sd);
    vec3 dirW = length(vv) > 0.01 ? normalize(vv) : up;
    vec3 side = normalize(cross(dirW, normalize(wp - uCamPos)));
    float stretch = clamp(length(vv) * 0.035, 1.0, 12.0) * (type == 5 ? 0.5 : 1.0);
    wp += side * q.x * size + dirW * q.y * size * stretch;
  } else if (type == 9) {
    // tumbling paper sheet
    float a1 = vSeed * 40.0 + age * (2.0 + vSeed * 3.0), a2 = vSeed * 13.0 + age * 1.3;
    vec3 ax = vec3(cos(a1), sin(a2) * 0.4, sin(a1));
    vec3 ay = normalize(cross(ax, vec3(sin(a2), 1.0, cos(a2))));
    wp += ax * q.x * size + ay * q.y * size * 1.3;
  } else {
    float rot = vSeed * 6.28 + age * (type == 1 ? 0.2 : 0.6) * (vSeed - 0.5);
    float cr = cos(rot), sr = sin(rot);
    vec2 rq = vec2(q.x * cr - q.y * sr, q.x * sr + q.y * cr);
    if (type == 7) { right = normalize(vec3(uCamRight.x, 0.0, uCamRight.z)); up = normalize(vec3(uCamUp.x, 0.25, uCamUp.z)); }
    wp += (right * rq.x + up * rq.y) * size;
  }
  vUv = position.xy * 0.5 + 0.5;
  vWp = wp;
  // sun visibility at the particle center (soft 4-tap PCF)
  vSunVis = 1.0;
  if (uShadowOn > 0.5) {
    vec4 cv = viewMatrix * vec4(P.xyz, 1.0);
    float vd = -cv.z;
    for (int i = 1; i >= 0; i--) {
      vec4 c = uCascade[i];
      if (vd >= c.x && vd < c.y) {
        vec4 sc = uShadowM[i] * vec4(P.xyz, 1.0);
        sc.xyz /= sc.w;
        if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0) {
          vec2 ts = vec2(1.5 / 4096.0);
          vSunVis = 0.25 * (texture(tShadow, vec3(sc.xy + vec2(-ts.x, -ts.y), sc.z - 0.002)) + texture(tShadow, vec3(sc.xy + vec2(ts.x, -ts.y), sc.z - 0.002))
                  + texture(tShadow, vec3(sc.xy + vec2(-ts.x, ts.y), sc.z - 0.002)) + texture(tShadow, vec3(sc.xy + vec2(ts.x, ts.y), sc.z - 0.002)));
        }
      }
    }
  }
  vec4 vp = viewMatrix * vec4(wp, 1.0);
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}`;

const REN_FRAG = `
precision highp float;
precision highp sampler3D;
uniform sampler2D tDepthHalf;
uniform sampler3D tNoise;
uniform vec3 uSunDir, uSunCol, uAmbient, uFogColor;
uniform vec4 uLPos[8];
uniform vec4 uLCol[8];
uniform int uLN;
uniform vec2 uRes;
uniform float uTime, uFogDensity;
in vec2 vUv; in float vType; in float vAgeN; in float vSeed; in vec3 vWp; in float vViewZ; in float vSize; in vec3 vVel; in float vLifeAge;
in float vSunVis;
out vec4 fragColor;
${INTERIOR_GLSL}
float h11(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float sceneZ = texelFetch(tDepthHalf, ivec2(gl_FragCoord.xy), 0).r;
  if (vViewZ > sceneZ + 0.05) discard;
  int type = int(vType + 0.5);
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float t = vAgeN;
  vec3 col = vec3(0.0);
  float a = 0.0;
  bool additive = false;
  // soft intersection with geometry
  float soft = clamp((sceneZ - vViewZ) / max(vSize * 0.8, 0.05), 0.0, 1.0);
  vec3 light = uAmbient * envOcc(vWp);
  for (int i = 0; i < 8; i++) {
    if (i >= uLN) break;
    vec3 d = uLPos[i].xyz - vWp;
    float d2 = dot(d, d);
    float R = uLPos[i].w;
    float w = clamp(1.0 - d2 / (R * R), 0.0, 1.0);
    light += uLCol[i].rgb * uLCol[i].a * w * w / (1.0 + d2 * 0.25) * 0.3;
  }
  if (type == 0 || type == 1 || type == 7 || type == 11 || type == 12 || type == 15) {
    // billowing volume: noise-eroded soft sphere with a fake normal for sun shading
    vec3 np = vec3(p * 0.7, vSeed * 17.0 + vLifeAge * 0.14);
    float n = texture(tNoise, np * 0.9).g * 0.6 + texture(tNoise, np * 2.3 + 3.1).r * 0.4;
    float edge = r + (n - 0.5) * 0.75 * smoothstep(0.1, 0.9, r);
    float shape = smoothstep(1.0, 0.0, edge);
    shape *= shape * (0.65 + 0.7 * n);
    vec3 N = normalize(vec3(p, sqrt(max(0.0, 1.0 - r * r)) + 0.3));
    float sunL = 0.45 + 0.55 * clamp(dot(N, normalize(vec3(uSunDir.x, uSunDir.y, 0.4))), 0.0, 1.0);
    vec3 base = type == 1 ? vec3(0.06, 0.055, 0.05) : type == 12 ? vec3(0.8, 0.82, 0.86) : type == 15 ? vec3(0.22, 0.21, 0.2) : vec3(0.36, 0.33, 0.3);
    if (type == 0 || type == 7 || type == 11) base *= 0.85 + 0.3 * h11(vSeed * 91.0);
    col = base * (light + uSunCol * sunL * vSunVis * (type == 1 ? 0.35 : 0.8)) ;
    float fadeIn = smoothstep(0.0, 0.06, t), fadeOut = 1.0 - smoothstep(0.55, 1.0, t);
    float dens = type == 1 ? 0.7 : type == 12 ? 0.35 : type == 7 ? 0.16 : 0.36;
    float nearFade = smoothstep(0.8, 3.2, vViewZ);
    a = shape * dens * fadeIn * fadeOut * soft * nearFade;
    col *= a;
  } else if (type == 2 || type == 13) {
    // spark streak / flash
    float core = type == 2 ? smoothstep(1.0, 0.0, abs(p.x)) * smoothstep(1.0, 0.3, abs(p.y)) : smoothstep(1.0, 0.0, r);
    vec3 hot = mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.45, 0.1), smoothstep(0.1, 0.8, t));
    if (type == 13) hot = vec3(1.0, 0.9, 0.75);
    col = hot * core * (1.0 - t) * (type == 2 ? 30.0 : 12.0);
    additive = true;
  } else if (type == 3 || type == 10) {
    float core = smoothstep(1.0, 0.0, r);
    vec3 c = type == 3 ? vec3(1.0, 0.45, 0.12) : (h11(vSeed * 7.0) > 0.5 ? vec3(0.35, 0.85, 1.0) : vec3(1.0, 0.4, 0.1));
    float flick = 0.6 + 0.4 * sin(vLifeAge * 25.0 + vSeed * 50.0);
    col = c * core * core * flick * (1.0 - t) * 16.0;
    additive = true;
  } else if (type == 4) {
    // debris chip: irregular dark shard, lit
    float edge = smoothstep(1.0, 0.8, max(abs(p.x) * (1.0 + h11(vSeed * 3.0)), abs(p.y) * (1.0 + h11(vSeed * 5.0))) + (texture(tNoise, vec3(p, vSeed)).r - 0.5));
    vec3 c = mix(vec3(0.3, 0.29, 0.27), vec3(0.5, 0.48, 0.45), h11(vSeed * 13.0));
    col = c * (light + uSunCol * vSunVis * (0.4 + 0.6 * h11(vSeed + floor(vLifeAge * 8.0))));
    a = edge * soft;
    col *= a;
  } else if (type == 5) {
    // glass glitter: mostly transparent with sparkling highlights
    float core = smoothstep(1.0, 0.2, abs(p.x)) * smoothstep(1.0, 0.2, abs(p.y));
    float glint = pow(h11(vSeed * 31.0 + floor(vLifeAge * 20.0)), 12.0) * 50.0;
    col = (vec3(0.6, 0.7, 0.75) * (light + uSunCol * 0.5 * vSunVis) * 0.4 + uSunCol * glint * (0.15 + 0.85 * vSunVis)) * core;
    a = core * 0.35 * soft;
    col *= 1.0;
  } else if (type == 6) {
    // flame: layered noise, hot core
    vec3 np = vec3(p * vec2(0.9, 0.6) + vec2(0.0, -vLifeAge * 1.2), vSeed * 9.0);
    float n = texture(tNoise, np * 0.8).r * 0.6 + texture(tNoise, np * 2.1).g * 0.4;
    float shape = smoothstep(1.0, 0.1, r + (n - 0.5) * 1.2 + p.y * 0.2);
    float heat = shape * (1.0 - t);
    col = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.75, 0.3), smoothstep(0.3, 0.9, heat)) * heat * 9.0;
    col *= soft;
    additive = true;
  } else if (type == 8) {
    float core = smoothstep(1.0, 0.0, abs(p.x)) * smoothstep(1.0, 0.2, abs(p.y));
    col = vec3(0.7, 0.8, 0.9) * (light + uSunCol * 0.7 * vSunVis) * core;
    a = core * 0.55 * soft;
    col *= a;
  } else if (type == 9) {
    float sheet = step(abs(p.x), 0.85) * step(abs(p.y), 0.95);
    col = vec3(0.85, 0.84, 0.8) * (light + uSunCol * vSunVis * (0.4 + 0.6 * abs(sin(vLifeAge * 4.0 + vSeed * 20.0))));
    a = sheet * soft;
    col *= a;
  }
  // aerial perspective
  float fog = 1.0 - exp(-vViewZ * uFogDensity);
  if (!additive) col = mix(col, uFogColor * a, fog * 0.8);
  else col *= 1.0 - fog * 0.5;
  fragColor = additive ? vec4(col, 0.0) : vec4(col, a);
}`;

export class Particles {
  constructor(renderer, noise3D, opts = {}) {
    this.r = renderer;
    const W = opts.width || 256, H = opts.height || 256;
    this.W = W; this.H = H; this.N = W * H;
    const mk = () => new THREE.WebGLRenderTarget(W, H, { count: 3, type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false });
    this.rtA = mk(); this.rtB = mk();
    this.spawnW = 256; this.spawnH = 48;
    this.maxSpawn = this.spawnW * this.spawnH;
    const sa = () => { const t = new THREE.DataTexture(new Float32Array(this.maxSpawn * 4), this.spawnW, this.spawnH, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t; };
    this.spA = sa(); this.spB = sa(); this.spC = sa();
    this.queue = 0;
    const typeA = TYPE_TABLE.map((t) => new THREE.Vector4(t[0], t[1], t[2], t[3]));
    const typeB = TYPE_TABLE.map((t) => new THREE.Vector4(t[4], t[5], 0, 0));
    const v4 = (n) => Array.from({ length: n }, () => new THREE.Vector4());
    this.simMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: SIM_VERT, fragmentShader: SIM_FRAG,
      uniforms: {
        tPos: { value: null }, tVel: { value: null }, tProp: { value: null }, tSpawnA: { value: this.spA }, tSpawnB: { value: this.spB }, tSpawnC: { value: this.spC },
        tNoise: { value: noise3D }, uDt: { value: 0 }, uTime: { value: 0 }, uHead: { value: 0 }, uCount: { value: 0 }, uN: { value: this.N }, uSpawnW: { value: this.spawnW },
        uTypeA: { value: typeA }, uTypeB: { value: typeB },
        uShock: { value: v4(8) }, uShockP: { value: v4(8) }, uShockN: { value: 0 },
        uMover: { value: v4(4) }, uMoverV: { value: v4(4) }, uMoverN: { value: 0 },
        uWind: { value: new THREE.Vector3(0.6, 0, 0.3) },
        uFloors: { value: v4(8) }, uFloorY: { value: new Array(8).fill(0) }, uFloorN: { value: 0 },
      },
      depthTest: false, depthWrite: false,
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.simMesh = new THREE.Mesh(g, this.simMat);
    this.simMesh.frustumCulled = false;
    this.simScene = new THREE.Scene();
    this.simScene.add(this.simMesh);
    this.simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // render
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    quad.instanceCount = this.N;
    this.renMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: REN_VERT, fragmentShader: REN_FRAG,
      uniforms: {
        tPos: { value: null }, tVel: { value: null }, tProp: { value: null }, tDepthHalf: { value: null }, tNoise: { value: noise3D },
        viewMatrix: { value: new THREE.Matrix4() }, projectionMatrix: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() }, uCamRight: { value: new THREE.Vector3() }, uCamUp: { value: new THREE.Vector3() }, uRes: { value: new THREE.Vector2() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Vector3(1, 1, 1) }, uAmbient: { value: new THREE.Vector3(0.3, 0.3, 0.35) }, uFogColor: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
        uLPos: { value: v4(8) }, uLCol: { value: v4(8) }, uLN: { value: 0 }, uTime: { value: 0 }, uFogDensity: { value: 0.0015 },
        tShadow: { value: null }, uShadowM: { value: [new THREE.Matrix4(), new THREE.Matrix4()] }, uCascade: { value: v4(2) }, uShadowOn: { value: 0 },
        ...interiorUniforms,
      },
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.renMesh = new THREE.Mesh(quad, this.renMat);
    this.renMesh.frustumCulled = false;
    this.renScene = new THREE.Scene();
    this.renScene.add(this.renMesh);
    this.head = 0;
    this.time = 0;
    this.shocks = [];
    this.movers = [];
    this.clearTargets();
  }

  clearTargets() {
    const r = this.r;
    const prev = r.getRenderTarget();
    for (const rt of [this.rtA, this.rtB]) { r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(true, false, false); }
    // mark all dead: age -1 requires a pass; the sim treats age>life (0 > 0 is false) ... use spawn of nothing:
    r.setRenderTarget(prev);
    this.queue = 0;
    this.head = 0;
    this.deadInit = true;
  }

  // Queue one particle. pos/vel arrays, life seconds, size meters, type PT.*, age0 initial age (>=0)
  spawn(type, px, py, pz, vx, vy, vz, life, size, seed = Math.random(), extra = 0, age0 = 0) {
    if (this.queue >= this.maxSpawn) return;
    const i = this.queue++ * 4;
    const A = this.spA.image.data, B = this.spB.image.data, C = this.spC.image.data;
    A[i] = px; A[i + 1] = py; A[i + 2] = pz; A[i + 3] = age0;
    B[i] = vx; B[i + 1] = vy; B[i + 2] = vz; B[i + 3] = life;
    C[i] = type; C[i + 1] = size; C[i + 2] = seed; C[i + 3] = extra;
  }

  step(dt, time) {
    const r = this.r;
    const count = Math.min(this.queue, this.maxSpawn);
    const u = this.simMat.uniforms;
    if (count > 0) { this.spA.needsUpdate = this.spB.needsUpdate = this.spC.needsUpdate = true; }
    if (dt <= 0 && count === 0) return;
    u.tPos.value = this.rtA.textures[0]; u.tVel.value = this.rtA.textures[1]; u.tProp.value = this.rtA.textures[2];
    u.uDt.value = Math.min(dt, 1 / 20); u.uTime.value = time;
    u.uHead.value = this.head; u.uCount.value = count;
    u.uShockN.value = Math.min(this.shocks.length, 8);
    for (let i = 0; i < u.uShockN.value; i++) { const s = this.shocks[i]; u.uShock.value[i].set(s.x, s.y, s.z, s.r); u.uShockP.value[i].set(s.thick, s.push, 0, 0); }
    u.uMoverN.value = Math.min(this.movers.length, 4);
    for (let i = 0; i < u.uMoverN.value; i++) { const m = this.movers[i]; u.uMover.value[i].set(m.x, m.y, m.z, m.r); u.uMoverV.value[i].set(m.vx, m.vy, m.vz, 0); }
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.rtB);
    r.render(this.simScene, this.simCam);
    r.setRenderTarget(prev);
    [this.rtA, this.rtB] = [this.rtB, this.rtA];
    this.head = (this.head + count) % this.N;
    this.queue = 0;
    this.time = time;
  }

  render(renderer, target, depthHalf, camera, look) {
    const u = this.renMat.uniforms;
    u.tPos.value = this.rtA.textures[0]; u.tVel.value = this.rtA.textures[1]; u.tProp.value = this.rtA.textures[2];
    u.tDepthHalf.value = depthHalf;
    u.viewMatrix.value.copy(camera.matrixWorldInverse);
    u.projectionMatrix.value.copy(camera.projectionMatrix);
    u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    u.uCamRight.value.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    u.uCamUp.value.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    u.uTime.value = this.time;
    const sh = look && look.sun && look.sun.shadow;
    if (sh && sh.map && sh.map.depthTexture && sh.isSunLightShadow) {
      u.tShadow.value = sh.map.depthTexture;
      for (let i = 0; i < 2; i++) { u.uShadowM.value[i].copy(sh.getMatrix(i)); u.uCascade.value[i].copy(sh._cascadeData[i]); }
      u.uShadowOn.value = 1;
    } else u.uShadowOn.value = 0;
    if (look) {
      u.uSunDir.value.copy(look.sunDir); u.uSunCol.value.copy(look.sunCol); u.uAmbient.value.copy(look.ambient); u.uFogColor.value.copy(look.fogColor); u.uFogDensity.value = look.fogDensity;
      const ls = look.lights || [];
      u.uLN.value = Math.min(ls.length, 8);
      for (let i = 0; i < u.uLN.value; i++) { const l = ls[i]; u.uLPos.value[i].set(l.x, l.y, l.z, l.r); u.uLCol.value[i].set(l.color[0], l.color[1], l.color[2], l.intensity); }
    }
    renderer.setRenderTarget(target);
    renderer.render(this.renScene, camera);
  }
}

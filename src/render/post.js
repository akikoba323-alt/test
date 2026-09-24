// HDR post-processing chain.
//   scene (HDR + depth) -> half-res linear depth -> volumetric light (shadowed sun + point lights + dust volumes)
//   -> particles (offscreen, half-res) -> combine (shockwave refraction, heat haze, depth-aware upsampling)
//   -> bokeh DOF -> camera motion blur (character-masked) -> bloom + anamorphic streak + lens dirt
//   -> final (lens distortion, chromatic aberration, ACES, grading, grain, letterbox, impact frames)
import * as THREE from 'three';
import { Pass, makeRT } from './fsq.js';
import { COMMON, PHASE } from './glsl.js';
import { INTERIOR_GLSL, interiorUniforms } from './interior.js';

const MAX_DUST = 16, MAX_VLIGHTS = 8, MAX_SHOCK = 8, MAX_HEAT = 4;

// ---------------------------------------------------------------------------------------------
const DEPTH_DOWN = /* glsl */ `
${COMMON}
uniform sampler2D tDepth; uniform float uNear, uFar; uniform vec2 uSrcSize;
varying vec2 vUv;
void main() {
  vec2 p = floor(gl_FragCoord.xy) * 2.0;
  float d0 = texelFetch(tDepth, ivec2(p), 0).r, d1 = texelFetch(tDepth, ivec2(p) + ivec2(1, 0), 0).r;
  float d2 = texelFetch(tDepth, ivec2(p) + ivec2(0, 1), 0).r, d3 = texelFetch(tDepth, ivec2(p) + ivec2(1, 1), 0).r;
  // checkerboard min/max keeps both foreground and background samples available to the upsampler
  float checker = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0);
  float d = checker < 0.5 ? min(min(d0, d1), min(d2, d3)) : max(max(d0, d1), max(d2, d3));
  gl_FragColor = vec4(linDepth(d, uNear, uFar), 0.0, 0.0, 1.0);
}`;

// ---------------------------------------------------------------------------------------------
const VOLUMETRIC = /* glsl */ `
precision highp sampler2DShadow;
precision highp sampler3D;
${COMMON}
${PHASE}
${INTERIOR_GLSL}
uniform sampler2D tDepthHalf;
uniform sampler2DShadow tShadow;
uniform sampler3D tNoise;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCamPos, uSunDir, uSunColor, uAmbient, uScatterTint;
uniform mat4 uShadowM[2];
uniform vec4 uCascade[2];
uniform float uShadowOn, uShadowBias;
uniform float uFogDensity, uFogHeight, uFogFalloff, uFogNoise, uAniso, uMaxDist, uTime, uFrame, uSunScatter;
uniform vec4 uDust[${MAX_DUST}];
uniform vec4 uDustP[${MAX_DUST}];
uniform int uDustCount;
uniform vec4 uLPos[${MAX_VLIGHTS}];
uniform vec4 uLCol[${MAX_VLIGHTS}];
uniform int uLCount;
uniform int uSteps;
varying vec2 vUv;

float sunVis(vec3 p, float vd) {
  if (uShadowOn < 0.5) return 1.0;
  float vis = 1.0;
  for (int i = 1; i >= 0; i--) {
    vec4 c = uCascade[i];
    if (vd >= c.x && vd < c.y) {
      vec4 sc = uShadowM[i] * vec4(p, 1.0);
      sc.xyz /= sc.w;
      if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0)
        vis = texture(tShadow, vec3(sc.xy, sc.z - uShadowBias));
    }
  }
  return vis;
}

float density(vec3 p, out float heat) {
  heat = 0.0;
  float h = max(p.y - uFogHeight, 0.0);
  float n = texture(tNoise, p * 0.0065 + vec3(uTime * 0.004, -uTime * 0.002, 0.0)).r;
  float d = uFogDensity * exp(-h * uFogFalloff) * mix(1.0, 0.25 + 1.5 * n, uFogNoise);
  for (int i = 0; i < ${MAX_DUST}; i++) {
    if (i >= uDustCount) break;
    vec3 q = p - uDust[i].xyz;
    float r = uDust[i].w;
    float l2 = dot(q, q);
    if (l2 < r * r) {
      float f = 1.0 - sqrt(l2) / r;
      float nn = texture(tNoise, p * (0.9 / max(r, 1.0)) * vec3(1.0, 0.8, 1.0) + vec3(0.0, -uTime * 0.03, float(i) * 0.37)).r;
      float dd = uDustP[i].x * f * f * mix(1.0, smoothstep(0.25, 0.8, nn) * 2.2, uDustP[i].y);
      d += dd;
      heat += dd * uDustP[i].z;
    }
  }
  return d;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float zView = texelFetch(tDepthHalf, ivec2(fc), 0).r;
  vec3 rv = viewRay(vUv, uInvProj);
  vec3 rd = normalize(mat3(uCamWorld) * rv);
  float cosZ = max(1e-3, -rv.z);
  float tEnd = min(zView / cosZ, uMaxDist);
  float jitter = fract(ign(fc + vec2(uFrame * 5.588238, uFrame * 1.2345)));
  float cosT = dot(rd, uSunDir);
  float phSun = hgPhase(cosT, uAniso) * 0.7 + hgPhase(cosT, -0.2) * 0.3;
  vec3 inscat = vec3(0.0);
  float T = 1.0;
  float steps = float(uSteps);
  float prevT = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= uSteps) break;
    float u = (float(i) + jitter) / steps;
    float t = tEnd * u * u;
    float ds = t - prevT;
    prevT = t;
    vec3 p = uCamPos + rd * t;
    float heat;
    float sig = density(p, heat);
    if (sig < 1e-6) continue;
    float vd = t * cosZ;
    vec3 L = uSunColor * uSunScatter * sunVis(p, vd) * phSun + uAmbient * envOcc(p) * (1.0 / (4.0 * PI));
    for (int k = 0; k < ${MAX_VLIGHTS}; k++) {
      if (k >= uLCount) break;
      vec3 dl = uLPos[k].xyz - p;
      float d2 = dot(dl, dl);
      float r = uLPos[k].w;
      float win = saturate(1.0 - d2 / (r * r));
      L += uLCol[k].rgb * (win * win / (d2 + 1.0)) * (1.0 / (4.0 * PI)) * uLCol[k].a;
    }
    L = L * uScatterTint + vec3(1.0, 0.35, 0.08) * heat * 6.0;
    float st = exp(-sig * ds);
    inscat += T * L * (1.0 - st);
    T *= st;
    if (T < 0.01) break;
  }
  gl_FragColor = vec4(inscat, T);
}`;

// ---------------------------------------------------------------------------------------------
const COMBINE = /* glsl */ `
${COMMON}
uniform sampler2D tScene, tDepth, tDepthHalf, tVol, tPart, tMask;
uniform mat4 uInvProj, uCamWorld, uViewProj;
uniform vec3 uCamPos;
uniform float uNear, uFar, uTime, uVolOn, uPartOn;
uniform vec4 uShock[${MAX_SHOCK}];
uniform vec4 uShockP[${MAX_SHOCK}];
uniform int uShockCount;
uniform vec4 uHeat[${MAX_HEAT}];
uniform int uHeatCount;
uniform vec2 uRes;
varying vec2 vUv;

vec4 upsample(sampler2D tex, vec2 uv, float z) {
  vec2 hs = vec2(textureSize(tDepthHalf, 0));
  vec2 p = uv * hs - 0.5;
  vec2 f = fract(p);
  ivec2 i0 = ivec2(floor(p));
  vec4 acc = vec4(0.0);
  float ws = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    ivec2 q = clamp(i0 + ivec2(i, j), ivec2(0), ivec2(hs) - 1);
    float zq = texelFetch(tDepthHalf, q, 0).r;
    float wb = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
    float wd = 1.0 / (1e-4 + abs(zq - z) / max(z, 1e-3) * 40.0);
    float w = wb * wd + 1e-6;
    acc += texelFetch(tex, q, 0) * w;
    ws += w;
  }
  return acc / ws;
}

void main() {
  vec2 uv = vUv;
  float dRaw = texture(tDepth, uv).r;
  float z = linDepth(dRaw, uNear, uFar);
  vec3 rv = viewRay(uv, uInvProj);
  vec3 rd = normalize(mat3(uCamWorld) * rv);
  float sceneDist = z / max(1e-3, -rv.z);
  vec2 off = vec2(0.0);
  vec3 shellGlow = vec3(0.0);
  // spherical shockwaves: refraction along the projected shell + faint condensation glow
  for (int i = 0; i < ${MAX_SHOCK}; i++) {
    if (i >= uShockCount) break;
    vec3 c = uShock[i].xyz;
    float R = uShock[i].w, w = max(uShockP[i].x, 0.05), str = uShockP[i].y;
    vec3 oc = c - uCamPos;
    float tc = dot(oc, rd);
    float dp = length(oc - rd * tc);
    float camIn = length(oc);
    // front hit distance of the shell (or back hit if the camera is inside)
    float h = sqrt(max(R * R - dp * dp, 0.0));
    float tHit = camIn > R ? tc - h : tc + h;
    if (tHit > sceneDist || tHit < 0.0) continue;
    float shell = exp(-pow((dp - R) / w, 2.0));
    float inner = exp(-pow((dp - R + w * 1.2) / (w * 1.5), 2.0));
    vec4 cc = uViewProj * vec4(c, 1.0);
    vec2 cuv = cc.xy / max(cc.w, 1e-3) * 0.5 + 0.5;
    vec2 dir = uv - cuv;
    float dl = length(dir * vec2(uRes.x / uRes.y, 1.0));
    dir = dl > 1e-4 ? dir / max(length(dir), 1e-4) : vec2(0.0);
    float scale = w / max(tHit, 1.0);
    off += dir * (shell - inner * 0.6) * str * clamp(scale * 0.6, 0.0, 0.012);
    shellGlow += vec3(0.9, 0.95, 1.0) * shell * uShockP[i].z;
    // whole-frame pressure pulse when the shell sweeps over the camera
    float pass = exp(-pow((camIn - R) / (w * 2.5), 2.0));
    off += (uv - 0.5) * pass * str * 0.012;
  }
  // heat shimmer inside hot volumes in front of the surface
  for (int i = 0; i < ${MAX_HEAT}; i++) {
    if (i >= uHeatCount) break;
    vec3 oc = uHeat[i].xyz - uCamPos;
    float tc = dot(oc, rd);
    float dp = length(oc - rd * tc);
    float R = uHeat[i].w;
    if (dp > R || tc - sqrt(max(R * R - dp * dp, 0.0)) > sceneDist) continue;
    float k = 1.0 - dp / R;
    vec2 q = uv * vec2(uRes.x / uRes.y, 1.0) * 60.0 + vec2(0.0, -uTime * 3.5);
    off += (vec2(vnoise2(q), vnoise2(q + 17.3)) - 0.5) * 0.004 * k * k;
  }
  vec2 suv = clamp(uv + off, vec2(0.0005), vec2(0.9995));
  vec3 col = texture(tScene, suv).rgb;
  if (length(off) > 1e-5) {
    // subtle dispersion on strong refraction
    col.r = texture(tScene, clamp(uv + off * 1.08, vec2(0.0005), vec2(0.9995))).r;
    col.b = texture(tScene, clamp(uv + off * 0.92, vec2(0.0005), vec2(0.9995))).b;
    z = linDepth(texture(tDepth, suv).r, uNear, uFar);
  }
  if (uVolOn > 0.5) {
    vec4 v = upsample(tVol, suv, z);
    col = col * v.a + v.rgb;
  }
  if (uPartOn > 0.5) {
    vec4 p = upsample(tPart, suv, z);
    col = col * (1.0 - clamp(p.a, 0.0, 1.0)) + p.rgb;
  }
  col += shellGlow * 0.15 * (0.5 + 0.5 * luma(col));
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

// ---------------------------------------------------------------------------------------------
const DOF_PREP = /* glsl */ `
${COMMON}
uniform sampler2D tColor, tDepth;
uniform float uNear, uFar, uFocus, uAperture, uMaxCoc;
varying vec2 vUv;
float coc(float z) { return clamp(uAperture * (z - uFocus) / max(z, 1e-3), -uMaxCoc, uMaxCoc); }
void main() {
  vec2 ts = 1.0 / vec2(textureSize(tColor, 0));
  vec3 c = vec3(0.0);
  float nearMin = 0.0, farC = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 o = (vec2(i, j) - 0.5) * ts;
    c += texture(tColor, vUv + o).rgb;
    float cc = coc(linDepth(texture(tDepth, vUv + o).r, uNear, uFar));
    nearMin = min(nearMin, cc);
    farC += cc;
  }
  float cc = nearMin < -0.5 ? nearMin : farC * 0.25;
  gl_FragColor = vec4(min(c * 0.25, vec3(60.0)), cc);
}`;

const DOF_GATHER = /* glsl */ `
${COMMON}
uniform sampler2D tHalf;
uniform float uMaxCoc;
varying vec2 vUv;
const float GOLDEN = 2.39996323;
void main() {
  vec2 ts = 1.0 / vec2(textureSize(tHalf, 0));
  vec4 center = texture(tHalf, vUv);
  float cc = abs(center.a);
  vec3 acc = center.rgb;
  float tot = 1.0;
  float radius = 0.5;
  float ang = ign(gl_FragCoord.xy) * 6.2831;
  for (int i = 0; i < 72; i++) {
    if (radius >= uMaxCoc) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * ts * radius;
    vec4 s = texture(tHalf, tc);
    float sc = abs(s.a);
    if (s.a > center.a) sc = clamp(sc, 0.0, cc * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, sc);
    acc += mix(acc / tot, s.rgb, m);
    tot += 1.0;
    radius += 0.9 / radius;
    ang += GOLDEN;
  }
  gl_FragColor = vec4(acc / tot, center.a);
}`;

const DOF_MERGE = /* glsl */ `
${COMMON}
uniform sampler2D tColor, tBlur, tDepth;
uniform float uNear, uFar, uFocus, uAperture, uMaxCoc;
varying vec2 vUv;
void main() {
  vec3 sharp = texture(tColor, vUv).rgb;
  vec4 b = texture(tBlur, vUv);
  float z = linDepth(texture(tDepth, vUv).r, uNear, uFar);
  float c = abs(clamp(uAperture * (z - uFocus) / max(z, 1e-3), -uMaxCoc, uMaxCoc));
  float k = max(smoothstep(0.35, 1.6, c), smoothstep(0.4, 1.8, -b.a));
  gl_FragColor = vec4(mix(sharp, b.rgb, k), 1.0);
}`;

// ---------------------------------------------------------------------------------------------
const MOTION_BLUR = /* glsl */ `
${COMMON}
uniform sampler2D tColor, tDepth, tMask;
uniform mat4 uInvProj, uCamWorld, uPrevViewProj;
uniform float uNear, uFar, uStrength, uRadial, uMaxLen;
uniform vec2 uRadialCenter;
uniform vec2 uRes;
varying vec2 vUv;
void main() {
  float d = texture(tDepth, vUv).r;
  vec3 vp = viewPos(vUv, d, uInvProj);
  vec3 wp = (uCamWorld * vec4(vp, 1.0)).xyz;
  vec4 pc = uPrevViewProj * vec4(wp, 1.0);
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
  vec2 vel = (vUv - puv) * uStrength;
  float m = texture(tMask, vUv).r;
  vel *= 1.0 - m;
  vel += (vUv - uRadialCenter) * uRadial;
  float L = length(vel * uRes);
  float maxL = uMaxLen * uRes.y;
  if (L > maxL) vel *= maxL / L;
  vec3 c = texture(tColor, vUv).rgb;
  if (length(vel * uRes) < 0.75) { gl_FragColor = vec4(c, 1.0); return; }
  float j = ign(gl_FragCoord.xy) - 0.5;
  vec3 acc = c;
  float ws = 1.0;
  for (int i = 0; i < 14; i++) {
    float t = (float(i) + 0.5 + j) / 14.0 - 0.5;
    vec2 uv = clamp(vUv + vel * t, vec2(0.001), vec2(0.999));
    float mm = texture(tMask, uv).r;
    float w = 1.0 - mm * (1.0 - m);
    acc += texture(tColor, uv).rgb * w;
    ws += w;
  }
  gl_FragColor = vec4(acc / ws, 1.0);
}`;

// ---------------------------------------------------------------------------------------------
const BLOOM_PREFILTER = /* glsl */ `
${COMMON}
uniform sampler2D tColor;
uniform float uThreshold, uKnee;
varying vec2 vUv;
vec3 karis(vec3 c) { return c / (1.0 + luma(c) * 0.25); }
void main() {
  vec2 ts = 1.0 / vec2(textureSize(tColor, 0));
  vec3 a = texture(tColor, vUv + ts * vec2(-1, -1)).rgb, b = texture(tColor, vUv + ts * vec2(1, -1)).rgb;
  vec3 c = texture(tColor, vUv + ts * vec2(-1, 1)).rgb, d = texture(tColor, vUv + ts * vec2(1, 1)).rgb;
  vec3 col = (karis(a) + karis(b) + karis(c) + karis(d)) * 0.25;
  col = col / max(1e-4, 1.0 - luma(col) * 0.25);
  float br = max(col.r, max(col.g, col.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-4);
  float w = max(rq, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(col * w, vec3(200.0)), 1.0);
}`;

const BLOOM_DOWN = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() {
  vec2 ts = 1.0 / vec2(textureSize(tSrc, 0));
  vec3 a = texture(tSrc, vUv + ts * vec2(-2, 2)).rgb, b = texture(tSrc, vUv + ts * vec2(0, 2)).rgb, c = texture(tSrc, vUv + ts * vec2(2, 2)).rgb;
  vec3 d = texture(tSrc, vUv + ts * vec2(-2, 0)).rgb, e = texture(tSrc, vUv).rgb, f = texture(tSrc, vUv + ts * vec2(2, 0)).rgb;
  vec3 g = texture(tSrc, vUv + ts * vec2(-2, -2)).rgb, h = texture(tSrc, vUv + ts * vec2(0, -2)).rgb, i = texture(tSrc, vUv + ts * vec2(2, -2)).rgb;
  vec3 j = texture(tSrc, vUv + ts * vec2(-1, 1)).rgb, k = texture(tSrc, vUv + ts * vec2(1, 1)).rgb;
  vec3 l = texture(tSrc, vUv + ts * vec2(-1, -1)).rgb, m = texture(tSrc, vUv + ts * vec2(1, -1)).rgb;
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}`;

const BLOOM_UP = /* glsl */ `
uniform sampler2D tSrc, tPrev;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 ts = uRadius / vec2(textureSize(tSrc, 0));
  vec3 s = texture(tSrc, vUv + ts * vec2(-1, -1)).rgb + texture(tSrc, vUv + ts * vec2(1, -1)).rgb
         + texture(tSrc, vUv + ts * vec2(-1, 1)).rgb + texture(tSrc, vUv + ts * vec2(1, 1)).rgb;
  s += 2.0 * (texture(tSrc, vUv + ts * vec2(0, -1)).rgb + texture(tSrc, vUv + ts * vec2(0, 1)).rgb
            + texture(tSrc, vUv + ts * vec2(-1, 0)).rgb + texture(tSrc, vUv + ts * vec2(1, 0)).rgb);
  s += 4.0 * texture(tSrc, vUv).rgb;
  gl_FragColor = vec4(texture(tPrev, vUv).rgb + s / 16.0, 1.0);
}`;

// horizontal-only blur for anamorphic streaks
const STREAK = /* glsl */ `
uniform sampler2D tSrc;
uniform float uStep;
varying vec2 vUv;
void main() {
  float tx = uStep / float(textureSize(tSrc, 0).x);
  vec3 s = texture(tSrc, vUv).rgb * 0.2;
  float w = 0.2;
  for (int i = 1; i <= 6; i++) {
    float k = exp(-float(i * i) * 0.12);
    s += (texture(tSrc, vUv + vec2(tx * float(i), 0.0)).rgb + texture(tSrc, vUv - vec2(tx * float(i), 0.0)).rgb) * k;
    w += 2.0 * k;
  }
  gl_FragColor = vec4(s / w, 1.0);
}`;

// ---------------------------------------------------------------------------------------------
const FINAL = /* glsl */ `
${COMMON}
uniform sampler2D tColor, tBloom, tStreak, tDirt, tMask, tDepth;
uniform vec2 uRes;
uniform float uTime, uExposure, uBloom, uDirt, uStreak, uCA, uLensK, uVignette, uGrain, uAspect;
uniform float uSat, uContrast, uTemp, uTint;
uniform vec3 uLift, uGamma, uGain, uSplitShadow, uSplitHigh;
uniform float uImpact, uImpactMode, uImpactThresh, uFlash, uFade, uFadeWhite;
uniform vec3 uFlashColor, uImpactTint;
uniform float uSpeedLines;
uniform vec2 uSpeedCenter;
uniform float uNear, uFar;
varying vec2 vUv;

vec3 aces(vec3 x) {
  const mat3 ACESIn = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 ACESOut = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  vec3 v = ACESIn * x;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(ACESOut * (a / b), 0.0, 1.0);
}
vec3 whiteBalance(vec3 c, float temp, float tint) {
  // cheap LMS-free approximation: warm/cool on R/B, tint on G
  return c * vec3(1.0 + temp * 0.18, 1.0 - tint * 0.12, 1.0 - temp * 0.22);
}
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

void main() {
  vec2 uv = vUv;
  // letterbox
  float frameAspect = uRes.x / uRes.y;
  float barH = max(0.0, (1.0 - frameAspect / uAspect) * 0.5);
  if (uv.y < barH || uv.y > 1.0 - barH) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // lens distortion (applied around frame center)
  vec2 cc = uv - 0.5;
  float r2 = dot(cc * vec2(frameAspect, 1.0), cc * vec2(frameAspect, 1.0));
  vec2 duv = 0.5 + cc * (1.0 + uLensK * r2) / (1.0 + uLensK * 0.35);
  // chromatic aberration grows toward the edges
  vec2 caDir = cc * (uCA * (0.35 + r2 * 2.0));
  vec3 col;
  col.r = texture(tColor, duv + caDir).r;
  col.g = texture(tColor, duv).g;
  col.b = texture(tColor, duv - caDir).b;
  vec3 bl = vec3(texture(tBloom, duv + caDir * 1.5).r, texture(tBloom, duv).g, texture(tBloom, duv - caDir * 1.5).b);
  vec3 dirt = texture(tDirt, uv).rgb;
  col += bl * (uBloom + dirt * uDirt);
  col += texture(tStreak, duv).rgb * uStreak * vec3(0.55, 0.75, 1.25);
  col = whiteBalance(col, uTemp, uTint);
  col *= uExposure;
  // flash (pre-tonemap so it blows out naturally)
  col += uFlashColor * uFlash;
  vec3 c = aces(col);
  // grading in display-ish space
  float l = luma(c);
  c = mix(vec3(l), c, uSat);
  c = (c - 0.5) * uContrast + 0.5;
  c = pow(max(c * uGain + uLift * (1.0 - c), 0.0), 1.0 / uGamma);
  float lum = luma(c);
  c += uSplitShadow * (1.0 - smoothstep(0.0, 0.5, lum)) * 0.12 + uSplitHigh * smoothstep(0.45, 1.0, lum) * 0.10;
  // vignette
  float vig = 1.0 - uVignette * smoothstep(0.35, 1.25, length(cc * vec2(frameAspect / 1.6, 1.0)) * 1.4);
  c *= vig;
  // anime speed lines radiating from a focus point
  if (uSpeedLines > 0.001) {
    vec2 d = (uv - uSpeedCenter) * vec2(frameAspect, 1.0);
    float ang = atan(d.y, d.x);
    float rr = length(d);
    float ln = hash12(vec2(floor(ang * 90.0), floor(uTime * 24.0)));
    float line = step(0.82, ln) * smoothstep(0.18, 0.75, rr);
    c = mix(c, vec3(1.0), line * uSpeedLines * 0.55);
  }
  // impact frame: stark two-tone silhouettes
  if (uImpact > 0.001) {
    float m = texture(tMask, uv).r;
    float lumC = luma(c);
    float z = linDepth(texture(tDepth, uv).r, uNear, uFar);
    float fg = step(0.5, m);
    vec3 ink = uImpactMode < 0.5 ? vec3(0.0) : uImpactMode < 1.5 ? vec3(1.0) : vec3(0.02, 0.0, 0.0);
    vec3 paper = uImpactMode < 0.5 ? vec3(1.0) : uImpactMode < 1.5 ? vec3(0.0) : uImpactTint;
    vec3 imp = mix(paper, ink, fg);
    c = mix(c, imp, uImpact);
  }
  // grain (luminance dependent, strongest in the mids)
  float g = hash12(gl_FragCoord.xy + fract(uTime * 13.7) * 1000.0) - 0.5;
  float lg = luma(c);
  c += g * uGrain * (0.35 + lg * (1.0 - lg) * 2.4);
  c = mix(c, vec3(uFadeWhite), uFade);
  c = toSRGB(saturate(c));
  c += (hash12(gl_FragCoord.xy * 1.37 + 3.1) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

// ---------------------------------------------------------------------------------------------
function makeDirtTexture(seedW = 512, seedH = 256) {
  // procedural lens dirt: soft blotches, a few hard specks and smudge streaks
  const c = document.createElement('canvas');
  c.width = seedW; c.height = seedH;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, seedW, seedH);
  let s = 12345;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 140; i++) {
    const x = r() * seedW, y = r() * seedH, rad = 4 + r() * r() * 50, a = 0.03 + r() * 0.08;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,${230 + r() * 25 | 0},${200 + r() * 55 | 0},${a})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 300; i++) {
    const x = r() * seedW, y = r() * seedH, rad = 0.5 + r() * 2.2;
    g.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.2})`;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = `rgba(255,245,230,${0.02 + r() * 0.04})`;
    g.lineWidth = 3 + r() * 10;
    g.beginPath();
    let x = r() * seedW, y = r() * seedH;
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 120; y += (r() - 0.5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export class Post {
  constructor(renderer, opts = {}) {
    this.r = renderer;
    this.q = opts.quality || {};
    this.w = 2; this.h = 2;
    const depthTex = () => { const d = new THREE.DepthTexture(2, 2); d.type = THREE.FloatType; return d; };
    this.rtScene = makeRT(2, 2, { depth: true, depthTexture: depthTex(), samples: this.q.msaa || 0 });
    this.rtMask = makeRT(2, 2, { type: THREE.UnsignedByteType, depth: true });
    this.rtDepthHalf = makeRT(2, 2, { type: THREE.FloatType, format: THREE.RedFormat, filter: THREE.NearestFilter });
    this.rtVol = makeRT(2, 2, { filter: THREE.NearestFilter });
    this.rtPart = makeRT(2, 2, { filter: THREE.NearestFilter });
    this.rtA = makeRT(2, 2);
    this.rtB = makeRT(2, 2);
    this.rtDofHalf = makeRT(2, 2);
    this.rtDofBlur = makeRT(2, 2);
    this.bloomMips = [];
    this.bloomUps = [];
    for (let i = 0; i < 7; i++) { this.bloomMips.push(makeRT(2, 2)); this.bloomUps.push(makeRT(2, 2)); }
    this.rtStreakA = makeRT(2, 2);
    this.rtStreakB = makeRT(2, 2);
    this.dirt = makeDirtTexture();
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;

    this.pDepth = new Pass(DEPTH_DOWN, { tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 1000 }, uSrcSize: { value: new THREE.Vector2() } });
    const v4 = (n) => Array.from({ length: n }, () => new THREE.Vector4());
    this.pVol = new Pass(VOLUMETRIC, {
      tDepthHalf: { value: null }, tShadow: { value: null }, tNoise: { value: opts.noise3D || null },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Vector3(1, 1, 1) }, uAmbient: { value: new THREE.Vector3(0.1, 0.1, 0.1) },
      uScatterTint: { value: new THREE.Vector3(1, 1, 1) },
      uShadowM: { value: [new THREE.Matrix4(), new THREE.Matrix4()] }, uCascade: { value: v4(2) }, uShadowOn: { value: 0 }, uShadowBias: { value: 0.0015 },
      uFogDensity: { value: 0.002 }, uFogHeight: { value: 0 }, uFogFalloff: { value: 0.02 }, uFogNoise: { value: 0.5 }, uAniso: { value: 0.6 },
      uMaxDist: { value: 600 }, uTime: { value: 0 }, uFrame: { value: 0 }, uSunScatter: { value: 1 },
      uDust: { value: v4(MAX_DUST) }, uDustP: { value: v4(MAX_DUST) }, uDustCount: { value: 0 },
      uLPos: { value: v4(MAX_VLIGHTS) }, uLCol: { value: v4(MAX_VLIGHTS) }, uLCount: { value: 0 },
      uSteps: { value: this.q.volSteps || 32 },
      ...interiorUniforms,
    });
    this.pCombine = new Pass(COMBINE, {
      tScene: { value: null }, tDepth: { value: null }, tDepthHalf: { value: null }, tVol: { value: null }, tPart: { value: null }, tMask: { value: null },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uViewProj: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
      uNear: { value: 0.1 }, uFar: { value: 1000 }, uTime: { value: 0 }, uVolOn: { value: 1 }, uPartOn: { value: 1 },
      uShock: { value: v4(MAX_SHOCK) }, uShockP: { value: v4(MAX_SHOCK) }, uShockCount: { value: 0 },
      uHeat: { value: v4(MAX_HEAT) }, uHeatCount: { value: 0 }, uRes: { value: new THREE.Vector2() },
    });
    const dofU = () => ({ uNear: { value: 0.1 }, uFar: { value: 1000 }, uFocus: { value: 10 }, uAperture: { value: 0 }, uMaxCoc: { value: 10 } });
    this.pDofPrep = new Pass(DOF_PREP, { tColor: { value: null }, tDepth: { value: null }, ...dofU() });
    this.pDofGather = new Pass(DOF_GATHER, { tHalf: { value: null }, uMaxCoc: { value: 10 } });
    this.pDofMerge = new Pass(DOF_MERGE, { tColor: { value: null }, tBlur: { value: null }, tDepth: { value: null }, ...dofU() });
    this.pMB = new Pass(MOTION_BLUR, {
      tColor: { value: null }, tDepth: { value: null }, tMask: { value: null },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uPrevViewProj: { value: new THREE.Matrix4() },
      uNear: { value: 0.1 }, uFar: { value: 1000 }, uStrength: { value: 0.5 }, uRadial: { value: 0 }, uMaxLen: { value: 0.06 },
      uRadialCenter: { value: new THREE.Vector2(0.5, 0.5) }, uRes: { value: new THREE.Vector2() },
    });
    this.pPre = new Pass(BLOOM_PREFILTER, { tColor: { value: null }, uThreshold: { value: 1.0 }, uKnee: { value: 0.6 } });
    this.pDown = new Pass(BLOOM_DOWN, { tSrc: { value: null } });
    this.pUp = new Pass(BLOOM_UP, { tSrc: { value: null }, tPrev: { value: null }, uRadius: { value: 1.0 } });
    this.pStreak = new Pass(STREAK, { tSrc: { value: null }, uStep: { value: 1 } });
    this.pFinal = new Pass(FINAL, {
      tColor: { value: null }, tBloom: { value: null }, tStreak: { value: null }, tDirt: { value: this.dirt }, tMask: { value: null }, tDepth: { value: null },
      uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uExposure: { value: 1 }, uBloom: { value: 0.05 }, uDirt: { value: 0.3 }, uStreak: { value: 0.0 },
      uCA: { value: 0.002 }, uLensK: { value: 0 }, uVignette: { value: 0.35 }, uGrain: { value: 0.04 }, uAspect: { value: 2.39 },
      uSat: { value: 1 }, uContrast: { value: 1 }, uTemp: { value: 0 }, uTint: { value: 0 },
      uLift: { value: new THREE.Vector3(0, 0, 0) }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uSplitShadow: { value: new THREE.Vector3(0, 0, 0) }, uSplitHigh: { value: new THREE.Vector3(0, 0, 0) },
      uImpact: { value: 0 }, uImpactMode: { value: 0 }, uImpactThresh: { value: 0.3 }, uFlash: { value: 0 }, uFade: { value: 0 }, uFadeWhite: { value: 0 },
      uFlashColor: { value: new THREE.Vector3(1, 1, 1) }, uImpactTint: { value: new THREE.Vector3(1, 0.1, 0.05) },
      uSpeedLines: { value: 0 }, uSpeedCenter: { value: new THREE.Vector2(0.5, 0.5) }, uNear: { value: 0.1 }, uFar: { value: 1000 },
    });
    this.prevViewProj = new THREE.Matrix4();
    this.viewProj = new THREE.Matrix4();
    this.frame = 0;
  }

  setSize(w, h) {
    this.w = w; this.h = h;
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    this.rtScene.setSize(w, h);
    this.rtMask.setSize(hw, hh);
    const vs = this.q.volScale || 2;
    this.rtDepthHalf.setSize(hw, hh);
    this.rtVol.setSize(hw, hh);
    this.volScale = vs;
    this.rtPart.setSize(hw, hh);
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
    this.rtDofHalf.setSize(hw, hh);
    this.rtDofBlur.setSize(hw, hh);
    let bw = hw, bh = hh;
    for (let i = 0; i < this.bloomMips.length; i++) {
      this.bloomMips[i].setSize(Math.max(1, bw), Math.max(1, bh));
      this.bloomUps[i].setSize(Math.max(1, bw), Math.max(1, bh));
      bw >>= 1; bh >>= 1;
    }
    this.rtStreakA.setSize(Math.max(1, w >> 2), Math.max(1, h >> 4));
    this.rtStreakB.setSize(Math.max(1, w >> 2), Math.max(1, h >> 4));
  }

  // hooks: { renderMask(renderer, target), renderParticles(renderer, target, depthHalfTex) }
  render(scene, camera, fx, hooks = {}) {
    const r = this.r, q = this.q;
    camera.updateMatrixWorld();
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (fx.cut || this.frame === 0) this.prevViewProj.copy(this.viewProj);

    // 1. scene
    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);
    const depth = this.rtScene.depthTexture;

    // 2. character mask (for motion blur exclusion and impact frames)
    r.setRenderTarget(this.rtMask);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    if (hooks.renderMask) hooks.renderMask(r, this.rtMask);

    // 3. half-res linear depth
    this.pDepth.u.tDepth.value = depth;
    this.pDepth.u.uNear.value = camera.near; this.pDepth.u.uFar.value = camera.far;
    this.pDepth.render(r, this.rtDepthHalf);

    // 4. volumetric light
    const volOn = q.volumetric !== false && fx.vol && fx.vol.on !== false;
    if (volOn) this.renderVolumetric(camera, fx);

    // 5. particles (offscreen, half-res, manual depth test)
    r.setRenderTarget(this.rtPart);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
    if (hooks.renderParticles) hooks.renderParticles(r, this.rtPart, this.rtDepthHalf.texture, camera);

    // 6. combine
    const cu = this.pCombine.u;
    cu.tScene.value = this.rtScene.texture; cu.tDepth.value = depth; cu.tDepthHalf.value = this.rtDepthHalf.texture;
    cu.tVol.value = this.rtVol.texture; cu.tPart.value = this.rtPart.texture;
    cu.uInvProj.value.copy(camera.projectionMatrixInverse); cu.uCamWorld.value.copy(camera.matrixWorld);
    cu.uViewProj.value.copy(this.viewProj); cu.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    cu.uNear.value = camera.near; cu.uFar.value = camera.far; cu.uTime.value = fx.time || 0;
    cu.uVolOn.value = volOn ? 1 : 0; cu.uPartOn.value = hooks.renderParticles ? 1 : 0;
    cu.uRes.value.set(this.w, this.h);
    const shocks = fx.shocks || [];
    cu.uShockCount.value = Math.min(shocks.length, MAX_SHOCK);
    for (let i = 0; i < cu.uShockCount.value; i++) {
      const s = shocks[i];
      cu.uShock.value[i].set(s.x, s.y, s.z, s.r);
      cu.uShockP.value[i].set(s.thick ?? 2, s.strength ?? 1, s.bright ?? 0.3, 0);
    }
    const heat = fx.heat || [];
    cu.uHeatCount.value = Math.min(heat.length, MAX_HEAT);
    for (let i = 0; i < cu.uHeatCount.value; i++) cu.uHeat.value[i].set(heat[i].x, heat[i].y, heat[i].z, heat[i].r);
    this.pCombine.render(r, this.rtA);
    let cur = this.rtA, other = this.rtB;

    // 7. depth of field
    const dof = fx.dof;
    if (q.dof !== false && dof && dof.aperture > 0.01) {
      const setDof = (u) => { u.uNear.value = camera.near; u.uFar.value = camera.far; u.uFocus.value = dof.focus; u.uAperture.value = dof.aperture * (this.h / 1080) ; u.uMaxCoc.value = Math.min(dof.maxCoc ?? 14, 18) * (this.h / 1080) * 1.0 + 2.0; };
      setDof(this.pDofPrep.u);
      this.pDofPrep.u.tColor.value = cur.texture; this.pDofPrep.u.tDepth.value = depth;
      this.pDofPrep.render(r, this.rtDofHalf);
      this.pDofGather.u.tHalf.value = this.rtDofHalf.texture;
      this.pDofGather.u.uMaxCoc.value = this.pDofPrep.u.uMaxCoc.value;
      this.pDofGather.render(r, this.rtDofBlur);
      setDof(this.pDofMerge.u);
      this.pDofMerge.u.tColor.value = cur.texture; this.pDofMerge.u.tBlur.value = this.rtDofBlur.texture; this.pDofMerge.u.tDepth.value = depth;
      this.pDofMerge.render(r, other);
      [cur, other] = [other, cur];
    }

    // 8. motion blur
    const mb = fx.mb || {};
    if (q.motionBlur !== false && ((mb.strength ?? 0.5) > 0.01 || (mb.radial ?? 0) > 0.001)) {
      const u = this.pMB.u;
      u.tColor.value = cur.texture; u.tDepth.value = depth; u.tMask.value = this.rtMask.texture;
      u.uInvProj.value.copy(camera.projectionMatrixInverse); u.uCamWorld.value.copy(camera.matrixWorld);
      u.uPrevViewProj.value.copy(this.prevViewProj);
      u.uNear.value = camera.near; u.uFar.value = camera.far;
      u.uStrength.value = fx.cut ? 0 : (mb.strength ?? 0.5);
      u.uRadial.value = mb.radial ?? 0;
      u.uRadialCenter.value.set(mb.cx ?? 0.5, mb.cy ?? 0.5);
      u.uMaxLen.value = mb.maxLen ?? 0.08;
      u.uRes.value.set(this.w, this.h);
      this.pMB.render(r, other);
      [cur, other] = [other, cur];
    }

    // 9. bloom
    const bloom = fx.bloom || {};
    this.pPre.u.tColor.value = cur.texture;
    this.pPre.u.uThreshold.value = bloom.threshold ?? 1.2;
    this.pPre.u.uKnee.value = bloom.knee ?? 0.7;
    this.pPre.render(r, this.bloomMips[0]);
    const levels = q.bloomLevels || 6;
    for (let i = 1; i < levels; i++) {
      this.pDown.u.tSrc.value = this.bloomMips[i - 1].texture;
      this.pDown.render(r, this.bloomMips[i]);
    }
    // upsample: up[i] = mip[i] + upsample(up[i+1])
    let prev = this.bloomMips[levels - 1];
    for (let i = levels - 2; i >= 0; i--) {
      this.pUp.u.tSrc.value = prev.texture;
      this.pUp.u.tPrev.value = this.bloomMips[i].texture;
      this.pUp.u.uRadius.value = 1.0;
      this.pUp.render(r, this.bloomUps[i]);
      prev = this.bloomUps[i];
    }
    const bloomTex = prev.texture;
    // anamorphic streak from the second mip
    let streakTex = this.black;
    if ((bloom.streak ?? 0) > 0.001) {
      this.pStreak.u.tSrc.value = this.bloomMips[1].texture; this.pStreak.u.uStep.value = 1.5;
      this.pStreak.render(r, this.rtStreakA);
      this.pStreak.u.tSrc.value = this.rtStreakA.texture; this.pStreak.u.uStep.value = 5;
      this.pStreak.render(r, this.rtStreakB);
      this.pStreak.u.tSrc.value = this.rtStreakB.texture; this.pStreak.u.uStep.value = 16;
      this.pStreak.render(r, this.rtStreakA);
      streakTex = this.rtStreakA.texture;
    }

    // 10. final
    const f = this.pFinal.u, g = fx.grade || {};
    f.tColor.value = cur.texture; f.tBloom.value = bloomTex; f.tStreak.value = streakTex; f.tMask.value = this.rtMask.texture; f.tDepth.value = depth;
    f.uRes.value.set(this.w, this.h); f.uTime.value = fx.time || 0;
    f.uExposure.value = fx.exposure ?? 1;
    f.uBloom.value = bloom.strength ?? 0.06; f.uDirt.value = bloom.dirt ?? 0.4; f.uStreak.value = bloom.streak ?? 0;
    f.uCA.value = fx.ca ?? 0.0025; f.uLensK.value = fx.lensK ?? 0; f.uVignette.value = fx.vignette ?? 0.35; f.uGrain.value = fx.grain ?? 0.035;
    f.uAspect.value = fx.aspect ?? 2.39;
    f.uSat.value = g.sat ?? 1; f.uContrast.value = g.contrast ?? 1; f.uTemp.value = g.temp ?? 0; f.uTint.value = g.tint ?? 0;
    f.uLift.value.fromArray(g.lift || [0, 0, 0]); f.uGamma.value.fromArray(g.gamma || [1, 1, 1]); f.uGain.value.fromArray(g.gain || [1, 1, 1]);
    f.uSplitShadow.value.fromArray(g.splitShadow || [0, 0, 0]); f.uSplitHigh.value.fromArray(g.splitHigh || [0, 0, 0]);
    const imp = fx.impact || {};
    f.uImpact.value = imp.amount ?? 0; f.uImpactMode.value = imp.mode ?? 0; f.uImpactThresh.value = imp.thresh ?? 0.25;
    f.uImpactTint.value.fromArray(imp.tint || [1, 0.12, 0.04]);
    f.uFlash.value = fx.flash ?? 0; f.uFlashColor.value.fromArray(fx.flashColor || [1, 1, 1]);
    f.uFade.value = fx.fade ?? 0; f.uFadeWhite.value = fx.fadeWhite ?? 0;
    f.uSpeedLines.value = fx.speedLines ?? 0; f.uSpeedCenter.value.set(fx.speedCx ?? 0.5, fx.speedCy ?? 0.5);
    f.uNear.value = camera.near; f.uFar.value = camera.far;
    this.pFinal.render(r, null);

    this.prevViewProj.copy(this.viewProj);
    this.frame++;
  }

  renderVolumetric(camera, fx) {
    const u = this.pVol.u, v = fx.vol || {};
    u.tDepthHalf.value = this.rtDepthHalf.texture;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    const sun = fx.sun;
    if (sun) {
      u.uSunDir.value.copy(sun.dir);
      u.uSunColor.value.set(sun.color.r * sun.intensity, sun.color.g * sun.intensity, sun.color.b * sun.intensity);
      const sh = sun.light && sun.light.shadow;
      if (sh && sh.map && sh.map.depthTexture && sun.light.castShadow) {
        u.tShadow.value = sh.map.depthTexture;
        if (sh.isSunLightShadow) {
          for (let i = 0; i < 2; i++) { u.uShadowM.value[i].copy(sh.getMatrix(i)); u.uCascade.value[i].copy(sh._cascadeData[i]); }
        } else {
          for (let i = 0; i < 2; i++) { u.uShadowM.value[i].copy(sh.matrix); u.uCascade.value[i].set(i === 0 ? -1e10 : 1e10, i === 0 ? 1e10 : 1e10, 1e10, 0); }
        }
        u.uShadowOn.value = 1;
      } else u.uShadowOn.value = 0;
    }
    u.uAmbient.value.fromArray(v.ambient || [0.2, 0.25, 0.3]);
    u.uScatterTint.value.fromArray(v.tint || [1, 1, 1]);
    u.uFogDensity.value = v.density ?? 0.002;
    u.uFogHeight.value = v.height ?? 0;
    u.uFogFalloff.value = v.falloff ?? 0.015;
    u.uFogNoise.value = v.noise ?? 0.6;
    u.uAniso.value = v.aniso ?? 0.65;
    u.uSunScatter.value = v.sunScatter ?? 1;
    u.uMaxDist.value = v.maxDist ?? 800;
    u.uTime.value = fx.time || 0;
    u.uFrame.value = this.frame % 64;
    u.uSteps.value = this.q.volSteps || 32;
    const dust = v.dust || [];
    u.uDustCount.value = Math.min(dust.length, MAX_DUST);
    for (let i = 0; i < u.uDustCount.value; i++) {
      const d = dust[i];
      u.uDust.value[i].set(d.x, d.y, d.z, d.r);
      u.uDustP.value[i].set(d.density ?? 0.05, d.noise ?? 0.8, d.heat ?? 0, 0);
    }
    const ls = v.lights || [];
    u.uLCount.value = Math.min(ls.length, MAX_VLIGHTS);
    for (let i = 0; i < u.uLCount.value; i++) {
      const l = ls[i];
      u.uLPos.value[i].set(l.x, l.y, l.z, l.r);
      u.uLCol.value[i].set(l.color[0], l.color[1], l.color[2], l.intensity);
    }
    this.pVol.render(this.r, this.rtVol);
  }
}

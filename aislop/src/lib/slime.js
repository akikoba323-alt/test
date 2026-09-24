// "Slop" slime renderer: turns any white mask (drawn on the 2D canvas) into glossy dripping goo.
// Pipeline: mask -> downward drip smear -> blur -> height-field shading.
import { THREE } from '../engine/gl.js';
import { blurTex, mat } from './glfx.js';

const SMEAR = /* glsl */ `
uniform sampler2D mask; uniform float grow, seed, maxLen; uniform vec2 res; varying vec2 vUv;
void main(){
  float px = 1.0 / res.y;
  float x = vUv.x * res.x / (res.y / 1080.);
  float n = vnoise(vec2(x / 17. + seed, 1.3));
  float n2 = vnoise(vec2(x / 6.5 + seed * 3., 7.1));
  float L = grow * (pow(n, 3.2) * maxLen + pow(n2, 7.) * maxLen * 0.35) * (res.y / 1080.);
  float f = texture2D(mask, vUv).a;
  for (int i = 1; i <= 18; i++) {
    float s = float(i) / 18.;
    float m = texture2D(mask, vUv + vec2(0., s * L * px)).a;
    f = max(f, m * (1. - s * 0.5));
  }
  gl_FragColor = vec4(f, f, f, 1.);
}`;

const SHADE = /* glsl */ `
uniform sampler2D field; uniform vec2 res; uniform vec3 base; uniform vec3 deep; uniform float gloss, thr;
varying vec2 vUv;
void main(){
  float h = texture2D(field, vUv).r;
  float a = smoothstep(thr - .04, thr + .03, h);
  if (a <= 0.) { gl_FragColor = vec4(0.); return; }
  vec2 ex = vec2(1.6 / res.x, 0.), ey = vec2(0., 1.6 / res.y);
  float hx = texture2D(field, vUv + ex).r - texture2D(field, vUv - ex).r;
  float hy = texture2D(field, vUv + ey).r - texture2D(field, vUv - ey).r;
  vec3 N = normalize(vec3(-hx * 5., -hy * 5., 1.));
  vec3 L = normalize(vec3(-.45, .55, .75));
  float diff = max(dot(N, L), 0.);
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float spec = pow(max(dot(N, H), 0.), 70.) * gloss;
  float spec2 = pow(max(dot(N, normalize(vec3(.5, -.2, 1.))), 0.), 20.) * .25 * gloss;
  float rim = pow(1. - N.z, 2.);
  float thick = smoothstep(thr, .95, h);
  vec3 col = mix(deep, base, .35 + .65 * thick) * (.45 + .7 * diff) + rim * base * .5;
  col += spec * vec3(1.) + spec2 * base;
  gl_FragColor = vec4(col * a, a);
}`;

export function slime(f, maskTex, o = {}) {
  const gl = f.gl;
  const smear = mat(gl, 'slime_smear', SMEAR, { mask: { value: null }, grow: { value: 0 }, seed: { value: 0 }, maxLen: { value: 260 }, res: { value: new THREE.Vector2(gl.W, gl.H) } });
  const shade = mat(gl, 'slime_shade', SHADE, { field: { value: null }, res: { value: new THREE.Vector2(gl.W, gl.H) }, base: { value: new THREE.Color() }, deep: { value: new THREE.Color() }, gloss: { value: 1 }, thr: { value: 0.45 } }, 'normal');
  const rtS = gl.rt('slime_s');
  smear.uniforms.mask.value = maskTex; smear.uniforms.grow.value = o.grow ?? 1; smear.uniforms.seed.value = o.seed ?? 0; smear.uniforms.maxLen.value = o.maxLen ?? 260;
  gl.pass(smear, rtS);
  const bl = blurTex(gl, rtS.texture, o.blur ?? 7, 'slime');
  shade.uniforms.field.value = bl;
  shade.uniforms.base.value.set(o.color || '#c6f432');
  shade.uniforms.deep.value.set(o.deep || '#3e5410');
  shade.uniforms.gloss.value = o.gloss ?? 1;
  shade.uniforms.thr.value = o.thr ?? 0.45;
  f.pass(shade);
}

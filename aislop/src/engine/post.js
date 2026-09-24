// Transition compositor + final "lens" (bloom, CA, grain, vignette, grade, glitch, scanlines).
import { THREE } from './gl.js';

export const TRANS = { cut: 0, fade: 1, dip: 2, glitch: 3, wipe: 4, zoom: 5, whip: 6, goo: 7, pixel: 8, dissolve: 9, iris: 10, flash: 11, slice: 12 };

const TRANS_FRAG = /* glsl */ `
uniform sampler2D tA, tB; uniform float p; uniform int ttype; uniform vec2 dir; uniform float time; uniform vec2 res; uniform vec3 tcol;
varying vec2 vUv;
vec4 split(sampler2D t, vec2 uv, float k){ return vec4(texture2D(t, uv + vec2(k,0.)).r, texture2D(t, uv).g, texture2D(t, uv - vec2(k,0.)).b, 1.); }
vec4 dblur(sampler2D t, vec2 uv, vec2 d){ vec4 s = vec4(0.); for(int i=0;i<16;i++){ float f = float(i)/15.-.5; s += texture2D(t, uv + d*f); } return s/16.; }
vec4 rblur(sampler2D t, vec2 uv, float k){ vec4 s = vec4(0.); vec2 c = uv-.5; for(int i=0;i<16;i++){ float f = 1. - k*float(i)/15.; s += texture2D(t, .5 + c*f); } return s/16.; }
void main(){
  vec2 uv = vUv; float asp = res.x/res.y;
  vec4 a = texture2D(tA, uv), b = texture2D(tB, uv), c = a;
  float e = p*p*(3.-2.*p);
  if (ttype == 0) { c = p < .5 ? a : b; }
  else if (ttype == 1) { c = mix(a, b, e); }
  else if (ttype == 2) { float q = p*2.; c = q < 1. ? mix(a, vec4(tcol,1.), smoothstep(0.,1.,q)) : mix(vec4(tcol,1.), b, smoothstep(0.,1.,q-1.)); }
  else if (ttype == 3) {
    float k = 1. - abs(p*2.-1.);
    float tt = floor(time*30.);
    vec2 blk = floor(uv * vec2(12., 40.));
    float r = hash12(blk + tt*1.7);
    float row = hash12(vec2(floor(uv.y*60.), tt));
    vec2 off = vec2((row-.5) * .18 * k * step(.55, row), 0.);
    float sw = step(r, smoothstep(.15,.85,p));
    vec4 A = split(tA, uv + off, .012*k), B = split(tB, uv + off, .012*k);
    c = mix(A, B, sw);
    float band = step(.985, hash12(vec2(floor(uv.y*200.), tt))) * k;
    c.rgb = mix(c.rgb, vec3(.78,.96,.2), band*.8);
    c.rgb += (hash12(uv*res + tt) - .5) * .25 * k;
  }
  else if (ttype == 4) {
    vec2 d = normalize(dir);
    float x = dot((uv - .5)*vec2(asp,1.), d) / (abs(d.x)*asp + abs(d.y)) + .5;
    float n = (vnoise(uv*vec2(asp,1.)*10.) - .5) * .06 + (vnoise(uv*vec2(asp,1.)*40.) - .5)*.02;
    float edge = p * 1.15 - .075;
    float m = smoothstep(edge - .006, edge + .006, x + n);
    c = mix(b, a, m);
    float ring = 1. - smoothstep(0., .012, abs(x + n - edge));
    c.rgb += tcol * ring * .9;
  }
  else if (ttype == 5) {
    float k = sin(3.14159*p);
    vec4 A = rblur(tA, .5 + (uv-.5)/(1. + e*1.5), .25*k);
    vec4 B = rblur(tB, .5 + (uv-.5)/(0.7 + .3*e), .25*k);
    c = mix(A, B, smoothstep(.35,.65,p));
    c.rgb += k*k*.15;
  }
  else if (ttype == 6) {
    vec2 d = normalize(dir);
    float s = (p < .5) ? 4.*p*p*p : 1. - pow(-2.*p + 2., 3.)/2.;
    float k = sin(3.14159*p);
    vec2 uA = uv + d * s, uB = uv + d * (s - 1.);
    vec2 bl = d * .35 * k;
    bool inA = uA.x >= 0. && uA.x <= 1. && uA.y >= 0. && uA.y <= 1.;
    c = inA ? dblur(tA, uA, bl) : dblur(tB, uB, bl);
  }
  else if (ttype == 7) {
    float x = uv.x * asp;
    float drip = (vnoise(vec2(x*5., 0.)) * .7 + vnoise(vec2(x*23., 3.)) * .3);
    drip = pow(drip, 2.5) * .55;
    float front = mix(1.08, -0.65, e);
    float y = uv.y + drip;
    float m = smoothstep(front - .004, front + .004, y);
    vec4 goo = vec4(mix(vec3(.78,.96,.2), vec3(.45,.6,.08), smoothstep(0., .06, y - front)), 1.);
    float band = smoothstep(front, front + .015, y) * (1. - smoothstep(front + .045, front + .08, y));
    vec4 top = mix(b, goo, band);
    float hl = pow(1. - clamp(abs(y - front - .02)/.02, 0., 1.), 4.);
    top.rgb += hl * .25;
    c = mix(a, top, m);
  }
  else if (ttype == 8) {
    float k = 1. - abs(p*2.-1.);
    float px = mix(1., 90., k*k);
    vec2 q = (floor(uv*res/px) + .5)*px/res;
    c = p < .5 ? texture2D(tA, q) : texture2D(tB, q);
  }
  else if (ttype == 9) {
    float n = vnoise(uv*vec2(asp,1.)*6.)*.6 + vnoise(uv*vec2(asp,1.)*24.)*.3 + vnoise(uv*vec2(asp,1.)*90.)*.1;
    float m = smoothstep(p*1.2 - .1, p*1.2, n);
    c = mix(b, a, m);
  }
  else if (ttype == 10) {
    vec2 ctr = .5 + dir;
    float d = length((uv - ctr)*vec2(asp,1.));
    float r = e * 1.3;
    float m = smoothstep(r, r - .004, d);
    c = mix(a, b, m);
    c.rgb += tcol * (1. - smoothstep(0., .01, abs(d - r))) * step(.001, p) * step(p, .999);
  }
  else if (ttype == 11) {
    float k = 1. - abs(p*2.-1.);
    c = p < .5 ? a : b;
    c.rgb = mix(c.rgb, tcol, pow(k, 1.5));
  }
  else if (ttype == 12) {
    float n = 9.;
    float band = floor(uv.y * n);
    float delay = hash11(band*3.7) * .35;
    float q = clamp((p - delay) / .65, 0., 1.);
    q = q<.5 ? 4.*q*q*q : 1. - pow(-2.*q+2., 3.)/2.;
    float sgn = mod(band, 2.) < 1. ? 1. : -1.;
    vec2 uA = uv + vec2(sgn * q, 0.), uB = uv + vec2(sgn * (q - 1.), 0.);
    c = (uA.x >= 0. && uA.x <= 1.) ? texture2D(tA, uA) : texture2D(tB, uB);
  }
  gl_FragColor = vec4(c.rgb, 1.);
}`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D src; uniform float thresh; uniform vec2 texel; varying vec2 vUv;
void main(){
  vec3 s = vec3(0.);
  s += texture2D(src, vUv + texel*vec2(-1.,-1.)).rgb; s += texture2D(src, vUv + texel*vec2(1.,-1.)).rgb;
  s += texture2D(src, vUv + texel*vec2(-1.,1.)).rgb; s += texture2D(src, vUv + texel*vec2(1.,1.)).rgb;
  s *= .25;
  float l = max(max(s.r, s.g), s.b);
  float k = smoothstep(thresh, thresh + .25, l);
  gl_FragColor = vec4(s * k, 1.);
}`;
const BLUR_FRAG = /* glsl */ `
uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec3 s = texture2D(src, vUv).rgb * .227027;
  s += texture2D(src, vUv + dir*1.3846).rgb * .3162162; s += texture2D(src, vUv - dir*1.3846).rgb * .3162162;
  s += texture2D(src, vUv + dir*3.2308).rgb * .0702703; s += texture2D(src, vUv - dir*3.2308).rgb * .0702703;
  gl_FragColor = vec4(s, 1.);
}`;

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tIn, tBloom, tBloom2; uniform vec2 res; uniform float frame, time;
uniform float grain, grainSize, vign, ca, bloom, scan, glitch, sat, contrast, bright, fade, letterbox, warp, crt, chroma;
uniform vec3 lift, gain; uniform vec4 flash; uniform float dither;
varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  if (warp > 0.) { vec2 d = uv - .5; uv = .5 + d * (1. + warp * dot(d,d) * 1.2) / (1. + warp*.3); }
  if (glitch > 0.) {
    float tt = floor(time * 24.);
    float row = hash12(vec2(floor(uv.y * 34.), tt));
    float blockRow = hash12(vec2(floor(uv.y * 9.), tt + 3.));
    uv.x += (row - .5) * .09 * glitch * step(1. - glitch*.6, blockRow);
    uv.x += (hash12(vec2(floor(uv.y*res.y/2.), tt)) - .5) * .004 * glitch;
  }
  vec2 d = uv - .5; float r2 = dot(d, d);
  vec2 off = d * (ca * .010 * (.25 + r2 * 2.5) + glitch * .012);
  vec3 col;
  col.r = texture2D(tIn, uv + off).r;
  col.g = texture2D(tIn, uv).g;
  col.b = texture2D(tIn, uv - off).b;
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) col = vec3(0.);
  col += (texture2D(tBloom, uv).rgb * .6 + texture2D(tBloom2, uv).rgb * .6) * bloom;
  col = col * gain + lift * (1. - col);
  col = (col - .5) * contrast + .5 + bright;
  float l = luma(col);
  col = mix(vec3(l), col, sat);
  if (scan > 0.) { float s = .5 + .5 * sin(gl_FragCoord.y * 3.14159 * .5); col *= 1. - scan * s * .6; }
  if (crt > 0.) { float m = mod(gl_FragCoord.x, 3.); vec3 mask = m < 1. ? vec3(1.,.7,.7) : m < 2. ? vec3(.7,1.,.7) : vec3(.7,.7,1.); col *= mix(vec3(1.), mask, crt); }
  float vd = length(d * vec2(res.x/res.y, 1.));
  col *= mix(1., smoothstep(1.25, .25, vd), vign);
  vec2 gp = floor(gl_FragCoord.xy / grainSize);
  float g = (hash12(gp + vec2(frame * 13.17, frame * 7.31)) + hash12(gp * 1.37 + vec2(frame * 3.1, 11.)) - 1.);
  col += g * grain * (1. - l * .6);
  col += (hash12(gl_FragCoord.xy + frame) - .5) / 255.;
  col = mix(col, flash.rgb, flash.a);
  col *= 1. - fade;
  if (letterbox > 0. && (vUv.y < letterbox || vUv.y > 1. - letterbox)) col = vec3(0.);
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;

// Packs the final RGB frame into planar yuv420p (BT.709, limited range) inside an RGBA8 target of size W/4 x 1.5H,
// so a single readPixels yields exactly the byte stream ffmpeg expects (2.7x less data than RGBA).
const YUV_FRAG = /* glsl */ `
uniform sampler2D src; uniform vec2 res; varying vec2 vUv;
vec3 px(vec2 p){ return texture2D(src, vec2(p.x / res.x, 1. - p.y / res.y)).rgb; }
float Y(vec3 c){ return 16. + 219. * dot(c, vec3(.2126, .7152, .0722)); }
float U(vec3 c){ float y = dot(c, vec3(.2126, .7152, .0722)); return 128. + 224. * (c.b - y) / 1.8556; }
float V(vec3 c){ float y = dot(c, vec3(.2126, .7152, .0722)); return 128. + 224. * (c.r - y) / 1.5748; }
void main(){
  float W = res.x, H = res.y;
  float sr = floor(gl_FragCoord.y);
  float tx = floor(gl_FragCoord.x);
  vec4 o;
  if (sr < H) {
    float row = sr + .5;
    for (int k = 0; k < 4; k++) o[k] = Y(px(vec2(tx * 4. + float(k) + .5, row)));
  } else {
    bool isV = sr >= H + H * .25;
    float q = sr - H - (isV ? H * .25 : 0.);
    float half_ = W / 8.;
    float crow = q * 2. + (tx >= half_ ? 1. : 0.);
    float ccol0 = (tx >= half_ ? tx - half_ : tx) * 4.;
    for (int k = 0; k < 4; k++) {
      vec2 p = vec2((ccol0 + float(k)) * 2. + 1., crow * 2. + 1.);
      vec3 c = px(p);
      o[k] = isV ? V(c) : U(c);
    }
  }
  gl_FragColor = floor(o + .5) / 255.;
}`;

// global delivery knobs (set once at boot from URL params)
export const POST_OPTS = { grainScale: 1, grainSizeScale: 1 };

export const DEFAULT_LOOK = {
  grain: 0.045, grainSize: 1.6, vign: 0.35, ca: 0.12, bloom: 0.22, bloomThresh: 0.72, scan: 0, glitch: 0, sat: 1, contrast: 1, bright: 0,
  fade: 0, letterbox: 0, warp: 0, crt: 0, lift: [0, 0, 0], gain: [1, 1, 1], flash: [1, 1, 1, 0],
};

export function mixLook(a, b, p) {
  const o = {};
  for (const k of Object.keys(DEFAULT_LOOK)) {
    const x = a[k] ?? DEFAULT_LOOK[k], y = b[k] ?? DEFAULT_LOOK[k];
    o[k] = Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * p) : x + (y - x) * p;
  }
  return o;
}

export class Post {
  constructor(gl) {
    this.gl = gl;
    const W = gl.W, H = gl.H;
    this.res = new THREE.Vector2(W, H);
    this.trans = gl.material(TRANS_FRAG, {
      tA: { value: null }, tB: { value: null }, p: { value: 0 }, ttype: { value: 0 }, dir: { value: new THREE.Vector2(1, 0) },
      time: { value: 0 }, res: { value: this.res }, tcol: { value: new THREE.Color(0, 0, 0) },
    });
    this.bright = gl.material(BRIGHT_FRAG, { src: { value: null }, thresh: { value: 0.7 }, texel: { value: new THREE.Vector2(1 / W, 1 / H) } });
    this.blur = gl.material(BLUR_FRAG, { src: { value: null }, dir: { value: new THREE.Vector2() } });
    this.final = gl.material(FINAL_FRAG, {
      tIn: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, res: { value: this.res }, frame: { value: 0 }, time: { value: 0 },
      grain: { value: 0 }, grainSize: { value: 1.5 }, vign: { value: 0 }, ca: { value: 0 }, bloom: { value: 0 }, scan: { value: 0 }, glitch: { value: 0 },
      sat: { value: 1 }, contrast: { value: 1 }, bright: { value: 0 }, fade: { value: 0 }, letterbox: { value: 0 }, warp: { value: 0 }, crt: { value: 0 }, chroma: { value: 0 },
      lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) }, flash: { value: new THREE.Vector4(1, 1, 1, 0) }, dither: { value: 0 },
    });
    this.rtMix = gl.rt('post_mix');
    const bw = Math.max(2, Math.round(W / 4)), bh = Math.max(2, Math.round(H / 4));
    this.rtB1 = gl.rt('post_b1', { w: bw, h: bh });
    this.rtB2 = gl.rt('post_b2', { w: bw, h: bh });
    const cw = Math.max(2, Math.round(W / 16)), ch = Math.max(2, Math.round(H / 16));
    this.rtC1 = gl.rt('post_c1', { w: cw, h: ch });
    this.rtC2 = gl.rt('post_c2', { w: cw, h: ch });
    this.yuv = gl.material(YUV_FRAG, { src: { value: null }, res: { value: this.res } });
  }
  // pack an RGB target into yuv420p; returns the packed target
  packYUV(srcTex) {
    const gl = this.gl;
    const rt = gl.rt('post_yuv', { w: gl.W / 4, h: gl.H * 1.5, nearest: true });
    this.yuv.uniforms.src.value = srcTex;
    gl.pass(this.yuv, rt);
    return rt;
  }
  render(texA, texB, tr, p, look, time, frame, target = null) {
    const gl = this.gl;
    let src = texA;
    if (texB && tr) {
      const u = this.trans.uniforms;
      u.tA.value = texA; u.tB.value = texB; u.p.value = p; u.ttype.value = TRANS[tr.type] ?? 1;
      u.dir.value.set(...(tr.dir || [1, 0])); u.time.value = time;
      u.tcol.value.set(tr.color || '#000000');
      gl.pass(this.trans, this.rtMix);
      src = this.rtMix.texture;
    }
    // bloom chain
    const bw = this.rtB1.width, bh = this.rtB1.height;
    if (look.bloom > 0.001) {
      this.bright.uniforms.src.value = src; this.bright.uniforms.thresh.value = look.bloomThresh;
      this.bright.uniforms.texel.value.set(1 / gl.W, 1 / gl.H);
      gl.pass(this.bright, this.rtB1);
      for (let k = 0; k < 2; k++) {
        this.blur.uniforms.src.value = this.rtB1.texture; this.blur.uniforms.dir.value.set((1 + k) / bw, 0); gl.pass(this.blur, this.rtB2);
        this.blur.uniforms.src.value = this.rtB2.texture; this.blur.uniforms.dir.value.set(0, (1 + k) / bh); gl.pass(this.blur, this.rtB1);
      }
      const cw = this.rtC1.width, ch = this.rtC1.height;
      gl.blit(this.rtB1.texture, this.rtC1, { blend: 'replace' });
      for (let k = 0; k < 2; k++) {
        this.blur.uniforms.src.value = this.rtC1.texture; this.blur.uniforms.dir.value.set((1 + k) / cw, 0); gl.pass(this.blur, this.rtC2);
        this.blur.uniforms.src.value = this.rtC2.texture; this.blur.uniforms.dir.value.set(0, (1 + k) / ch); gl.pass(this.blur, this.rtC1);
      }
    }
    const u = this.final.uniforms;
    u.tIn.value = src; u.tBloom.value = this.rtB1.texture; u.tBloom2.value = this.rtC1.texture;
    u.frame.value = frame % 1000; u.time.value = time;
    for (const k of ['grain', 'grainSize', 'vign', 'ca', 'bloom', 'scan', 'glitch', 'sat', 'contrast', 'bright', 'fade', 'letterbox', 'warp', 'crt']) u[k].value = look[k];
    u.grain.value = look.grain * POST_OPTS.grainScale;
    u.grainSize.value = look.grainSize * POST_OPTS.grainSizeScale * (gl.W / 1920);
    u.lift.value.set(...look.lift); u.gain.value.set(...look.gain); u.flash.value.set(...look.flash);
    gl.pass(this.final, target);
  }
}

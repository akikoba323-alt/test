// three.js-backed GL layer: renderer, fullscreen passes, render targets, canvas uploads, layer blits.
import * as THREE from 'three';

export const GLSL_COMMON = /* glsl */ `
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+10.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm3(vec3 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*snoise(p); p*=2.02; a*=.5; } return s; }
vec3 aces(vec3 x){ const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
vec3 lin2srgb(vec3 c){ c = max(c, 0.); return mix(12.92*c, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
vec3 srgb2lin(vec3 c){ return mix(c/12.92, pow((c+.055)/1.055, vec3(2.4)), step(.04045, c)); }
float luma(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
`;

export const VERT_FS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`;

const BLIT_FRAG = /* glsl */ `
uniform sampler2D tex; uniform float opacity; uniform int mode; uniform float exposure; uniform vec4 rect; uniform vec4 uvRect;
uniform vec3 tint; uniform float tintAmt;
varying vec2 vUv;
${GLSL_COMMON}
void main(){
  vec2 uv = (vUv - rect.xy) / rect.zw;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) discard;
  uv = uvRect.xy + uv * uvRect.zw;
  vec4 c = texture2D(tex, uv);
  if (mode == 1) { // linear HDR -> filmic -> sRGB, opaque where alpha>0
    vec3 col = lin2srgb(aces(c.rgb * exposure));
    c = vec4(col * c.a, c.a);
  } else if (mode == 2) { // straight alpha source
    c.rgb *= c.a;
  }
  c.rgb = mix(c.rgb, tint * c.a, tintAmt);
  gl_FragColor = c * opacity;
}`;

export class GL {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false, depth: true });
    const r = this.renderer;
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.autoClear = false;
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.gl = r.getContext();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.targets = new Map();
    this.canvasTexs = new Map();
    this.blitMats = {};
    for (const mode of ['normal', 'add', 'screen', 'multiply', 'replace']) this.blitMats[mode] = this.makeBlit(mode);
  }
  blendProps(mode) {
    const o = { transparent: true, depthTest: false, depthWrite: false };
    if (mode === 'replace') return { ...o, blending: THREE.NoBlending, transparent: false };
    o.blending = THREE.CustomBlending;
    o.blendEquation = THREE.AddEquation;
    if (mode === 'normal') { o.blendSrc = THREE.OneFactor; o.blendDst = THREE.OneMinusSrcAlphaFactor; }
    if (mode === 'add') { o.blendSrc = THREE.OneFactor; o.blendDst = THREE.OneFactor; }
    if (mode === 'screen') { o.blendSrc = THREE.OneFactor; o.blendDst = THREE.OneMinusSrcColorFactor; }
    if (mode === 'multiply') { o.blendSrc = THREE.DstColorFactor; o.blendDst = THREE.OneMinusSrcAlphaFactor; }
    o.blendSrcAlpha = THREE.OneFactor; o.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; o.blendEquationAlpha = THREE.AddEquation;
    return o;
  }
  makeBlit(mode) {
    return new THREE.ShaderMaterial({
      vertexShader: VERT_FS, fragmentShader: BLIT_FRAG,
      uniforms: { tex: { value: null }, opacity: { value: 1 }, mode: { value: 0 }, exposure: { value: 1 }, rect: { value: new THREE.Vector4(0, 0, 1, 1) }, uvRect: { value: new THREE.Vector4(0, 0, 1, 1) }, tint: { value: new THREE.Color(1, 1, 1) }, tintAmt: { value: 0 } },
      ...this.blendProps(mode),
    });
  }
  // fullscreen shader material with common header
  material(frag, uniforms = {}, mode = 'replace') {
    return new THREE.ShaderMaterial({ vertexShader: VERT_FS, fragmentShader: GLSL_COMMON + frag, uniforms, ...this.blendProps(mode) });
  }
  rt(name, o = {}) {
    const w = o.w || this.W, h = o.h || this.H;
    let t = this.targets.get(name);
    if (t && (t.width !== w || t.height !== h)) { t.dispose(); t = null; }
    if (!t) {
      t = new THREE.WebGLRenderTarget(w, h, {
        type: o.float ? THREE.HalfFloatType : THREE.UnsignedByteType,
        format: THREE.RGBAFormat, depthBuffer: !!o.depth, stencilBuffer: false,
        samples: o.msaa || 0, minFilter: o.nearest ? THREE.NearestFilter : THREE.LinearFilter, magFilter: o.nearest ? THREE.NearestFilter : THREE.LinearFilter,
        generateMipmaps: false, wrapS: o.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping, wrapT: o.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping,
      });
      t.texture.colorSpace = THREE.NoColorSpace;
      this.targets.set(name, t);
    }
    return t;
  }
  clear(target, r = 0, g = 0, b = 0, a = 0) {
    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(new THREE.Color(r, g, b), a);
    this.renderer.clear(true, true, false);
  }
  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }
  blit(tex, target, o = {}) {
    const m = this.blitMats[o.blend || 'normal'];
    m.uniforms.tex.value = tex;
    m.uniforms.opacity.value = o.opacity == null ? 1 : o.opacity;
    m.uniforms.mode.value = o.hdr ? 1 : o.straight ? 2 : 0;
    m.uniforms.exposure.value = o.exposure || 1;
    const R = o.rect || [0, 0, 1, 1];
    m.uniforms.rect.value.set(R[0], R[1], R[2], R[3]);
    const U = o.uvRect || [0, 0, 1, 1];
    m.uniforms.uvRect.value.set(U[0], U[1], U[2], U[3]);
    if (o.tint) { m.uniforms.tint.value.set(o.tint); m.uniforms.tintAmt.value = o.tintAmt == null ? 1 : o.tintAmt; } else m.uniforms.tintAmt.value = 0;
    this.pass(m, target);
  }
  canvasTex(canvas) {
    let t = this.canvasTexs.get(canvas);
    if (!t) {
      t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.NoColorSpace;
      t.premultiplyAlpha = true;
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      this.canvasTexs.set(canvas, t);
    }
    t.needsUpdate = true;
    return t;
  }
  read(buf) {
    const gl = this.gl;
    this.renderer.setRenderTarget(null);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }
}
export { THREE };

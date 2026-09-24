// Reusable GL effects operating on textures: gaussian blur pyramid, generic material cache.
import { THREE } from '../engine/gl.js';

const BLUR = /* glsl */ `
uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 s = texture2D(src, vUv) * .227027;
  s += texture2D(src, vUv + dir*1.3846) * .3162162; s += texture2D(src, vUv - dir*1.3846) * .3162162;
  s += texture2D(src, vUv + dir*3.2308) * .0702703; s += texture2D(src, vUv - dir*3.2308) * .0702703;
  gl_FragColor = s;
}`;

const mats = new WeakMap();
function blurMat(gl) {
  let m = mats.get(gl);
  if (!m) { m = gl.material(BLUR, { src: { value: null }, dir: { value: new THREE.Vector2() } }); mats.set(gl, m); }
  return m;
}

// Blur a texture. radius ~ pixels at 1080p. Returns a texture (valid until next call with the same tag).
export function blurTex(gl, tex, radius = 8, tag = 'b') {
  if (radius <= 0.01) return tex;
  const div = radius > 24 ? 8 : radius > 10 ? 4 : 2;
  const w = Math.round(gl.W / div), h = Math.round(gl.H / div);
  const a = gl.rt(`blur_${tag}_a${div}`, { w, h }), b = gl.rt(`blur_${tag}_b${div}`, { w, h });
  gl.blit(tex, a, { blend: 'replace' });
  const m = blurMat(gl);
  const k = (radius * gl.W / 1920) / div / 3.2;
  const iters = Math.max(1, Math.ceil(k / 1.5));
  const step = k / iters;
  for (let i = 0; i < iters; i++) {
    m.uniforms.src.value = a.texture; m.uniforms.dir.value.set(step / w * 1.0, 0); gl.pass(m, b);
    m.uniforms.src.value = b.texture; m.uniforms.dir.value.set(0, step / h * 1.0); gl.pass(m, a);
  }
  return a.texture;
}

// cache materials per key
const mcache = new Map();
export function mat(gl, key, frag, uniforms, blend = 'replace') {
  let m = mcache.get(key);
  if (!m) { m = gl.material(frag, uniforms, blend); mcache.set(key, m); }
  return m;
}

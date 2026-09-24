// Fullscreen-triangle pass helper for post-processing shaders.
import * as THREE from 'three';

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const mesh = new THREE.Mesh(geo);
mesh.frustumCulled = false;
const scene = new THREE.Scene();
scene.add(mesh);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export const FSQ_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export class Pass {
  constructor(frag, uniforms = {}, opts = {}) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: opts.vert || FSQ_VERT,
      fragmentShader: frag,
      uniforms,
      defines: opts.defines || {},
      depthTest: false,
      depthWrite: false,
      blending: opts.blending ?? THREE.NoBlending,
      transparent: !!opts.blending,
      toneMapped: false,
    });
    if (opts.blendSrc) {
      this.material.blending = THREE.CustomBlending;
      this.material.blendSrc = opts.blendSrc;
      this.material.blendDst = opts.blendDst;
    }
    this.u = this.material.uniforms;
  }
  render(renderer, target) {
    mesh.material = this.material;
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
  }
}

export function makeRT(w, h, opts = {}) {
  return new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), {
    type: opts.type ?? THREE.HalfFloatType,
    format: opts.format ?? THREE.RGBAFormat,
    minFilter: opts.filter ?? THREE.LinearFilter,
    magFilter: opts.filter ?? THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: opts.depth ?? false,
    stencilBuffer: false,
    generateMipmaps: false,
    samples: opts.samples ?? 0,
    depthTexture: opts.depthTexture ?? null,
  });
}

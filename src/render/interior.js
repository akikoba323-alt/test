// Interior sky-light occlusion. Building shells are boxes; inside a box the environment (sky)
// light falls off with horizontal distance to the nearest facade, so interiors read as rooms lit
// through their windows instead of open-air. Portals are spheres around breaches (blown-out
// facades, punched slabs) where the sky pours back in. Shared by the surface materials, the
// particle renderer and the volumetric fog so the air inside a room darkens consistently.
import * as THREE from 'three';

export const MAX_INT = 4, MAX_PORT = 8;

export const interiorUniforms = {
  uIntMin: { value: Array.from({ length: MAX_INT }, () => new THREE.Vector4(0, 0, 0, 1)) },
  uIntMax: { value: Array.from({ length: MAX_INT }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uPortal: { value: Array.from({ length: MAX_PORT }, () => new THREE.Vector4(0, 0, 0, 0)) },
};

export const INTERIOR_GLSL = `
uniform vec4 uIntMin[${MAX_INT}];
uniform vec4 uIntMax[${MAX_INT}];
uniform vec4 uPortal[${MAX_PORT}];
// 1 = open sky, down to the box's floor value deep inside
float envOcc(vec3 P) {
  float occ = 1.0;
  for (int i = 0; i < ${MAX_INT}; i++) {
    vec4 mn = uIntMin[i], mx = uIntMax[i];
    if (mx.w <= 0.0) continue;
    vec3 a = P - mn.xyz, b = mx.xyz - P;
    float inside = min(min(min(a.x, b.x), min(a.y, b.y)), min(a.z, b.z));
    if (inside < 0.0) continue;
    float d = min(min(a.x, b.x), min(a.z, b.z));
    float o = mix(mn.w, 1.0, exp(-d / mx.w));
    for (int k = 0; k < ${MAX_PORT}; k++) {
      vec4 pt = uPortal[k];
      if (pt.w <= 0.0) continue;
      vec3 q = P - pt.xyz;
      o = max(o, exp(-dot(q, q) / (pt.w * pt.w)));
    }
    occ = min(occ, o);
  }
  return occ;
}
`;

// Patch a three.js lit material (Standard/Physical) so image-based light is occluded indoors.
export function patchEnvOcc(sh) {
  Object.assign(sh.uniforms, interiorUniforms);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vEnvWP;')
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
{
  vec4 ewp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  ewp = instanceMatrix * ewp;
#endif
  vEnvWP = (modelMatrix * ewp).xyz;
}`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vEnvWP;\n' + INTERIOR_GLSL)
    .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
{
  float eo = envOcc(vEnvWP);
  iblIrradiance *= eo; irradiance *= eo;
#if defined( RE_IndirectSpecular )
  radiance *= eo;
#endif
#ifdef USE_CLEARCOAT
  clearcoatRadiance *= eo;
#endif
}`);
}

// Scene-side controller: shell boxes and breach portals.
export class Interiors {
  constructor() { this.boxes = []; this.portals = []; }
  reset() { this.portals.length = 0; this.write(); }
  setBoxes(list) { this.boxes = list.slice(0, MAX_INT); this.write(); }
  // a breach: sky light floods a sphere of radius r around p (grows in over `grow` seconds)
  addPortal(p, r) {
    this.portals.push({ x: p.x, y: p.y, z: p.z, r });
    if (this.portals.length > MAX_PORT) this.portals.shift();
    this.write();
  }
  write() {
    const mn = interiorUniforms.uIntMin.value, mx = interiorUniforms.uIntMax.value, pt = interiorUniforms.uPortal.value;
    for (let i = 0; i < MAX_INT; i++) {
      const b = this.boxes[i];
      if (!b) { mx[i].set(0, 0, 0, 0); continue; }
      mn[i].set(b.min[0], b.min[1], b.min[2], b.floor ?? 0.14);
      mx[i].set(b.max[0], b.max[1], b.max[2], b.falloff ?? 3.5);
    }
    for (let i = 0; i < MAX_PORT; i++) {
      const p = this.portals[i];
      if (!p) pt[i].set(0, 0, 0, 0); else pt[i].set(p.x, p.y, p.z, p.r);
    }
  }
}

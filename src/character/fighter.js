// A fighter: procedural skinned body, material, pose application and derived data (bone
// world positions / velocities) used by effects, IK targeting and the camera.
import * as THREE from 'three';
import { buildBones, bindJoints, quatXYZ } from './skeleton.js';
import { buildRigMesh } from './rigmesh.js';
import { createFighterMaterial } from './charmaterial.js';
import { EYE_OFFSET } from './models.js';
import { Animator } from './anim.js';
import { buildSkirt, buildStrip } from './cloth.js';

// cloth surface: sheen fabric; hem frays as damage grows (holes discarded by noise)
function clothMaterial(color, sheen = 0.6) {
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(...color), roughness: 0.82, sheen, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.6, 0.6, 0.65), side: THREE.DoubleSide });
  const u = { uDamage: { value: 0 } };
  m.userData.u = u;
  m.customProgramCacheKey = () => 'cloth';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDamage = u.uDamage;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUvC;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUvC = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vUvC; uniform float uDamage;
float hC(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nC(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hC(i), hC(i + vec2(1, 0)), f.x), mix(hC(i + vec2(0, 1)), hC(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
{
  float n = nC(vUvC * vec2(28.0, 9.0)) * 0.6 + nC(vUvC * vec2(70.0, 22.0)) * 0.4;
  float hem = vUvC.y;
  if (n < uDamage * (0.15 + hem * 0.9) - 0.05) discard;
}`);
  };
  return m;
}

export class Fighter {
  constructor(model, table, opts = {}) {
    this.name = model.name;
    this.model = model;
    const t0 = performance.now();
    this.rig = buildBones(model.P);
    this.joints = bindJoints(this.rig);
    const built = buildRigMesh(model, this.rig, this.joints);
    this.buildStats = built.stats;
    this.material = createFighterMaterial(table, { noise3D: opts.noise3D, bones: this.rig.bones.length, energyMode: opts.energyMode });
    this.u = this.material.userData.u;
    const H = this.joints.J.head, f = model.face || { w: 1, d: 1 }, fs = f.s ?? 1;
    this.u.uEyeL.value.set(H.x + EYE_OFFSET[0] * f.w * fs, H.y + EYE_OFFSET[1] * fs, H.z + EYE_OFFSET[2] * f.d * fs);
    this.u.uEyeR.value.set(H.x - EYE_OFFSET[0] * f.w * fs, H.y + EYE_OFFSET[1] * fs, H.z + EYE_OFFSET[2] * f.d * fs);
    if (model.iris) this.u.uIris.value.setRGB(...model.iris);
    this.mesh = new THREE.SkinnedMesh(built.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group = new THREE.Group();
    this.group.add(this.rig.bones[0]);
    this.group.add(this.mesh);
    this.group.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.rig.bones);
    this.mesh.bind(this.skeleton, new THREE.Matrix4());
    this.buildMs = performance.now() - t0;
    this.bone = this.rig.byName;
    // cloth pieces are created while the rig is still in its bind pose
    this.cloths = [];
    if (model.cloth) for (const c of model.cloth(this.joints.J, this.rig, THREE)) {
      const mat = clothMaterial(c.color, c.sheen);
      const mesh = new THREE.Mesh(c.cloth.geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      mesh.layers.enable(1);
      this.group.add(mesh);
      this.cloths.push({ ...c, mesh, mat });
    }
    this.neutral();
    this.anim = new Animator(this);
  }

  neutral() {
    for (const b of this.rig.bones) b.quaternion.identity();
    this.group.updateMatrixWorld(true);
  }

  // pose: { boneName: [x,y,z] degrees } (+ optional root: {p:[x,y,z], yaw})
  applyEuler(pose) {
    for (const k in pose) {
      const b = this.bone[k];
      if (b) quatXYZ(pose[k], b.quaternion);
    }
  }
}

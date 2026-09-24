// A fighter: procedural skinned body, material, pose application and derived data (bone
// world positions / velocities) used by effects, IK targeting and the camera.
import * as THREE from 'three';
import { buildBones, bindJoints, quatXYZ } from './skeleton.js';
import { buildRigMesh } from './rigmesh.js';
import { createFighterMaterial } from './charmaterial.js';
import { EYE_OFFSET } from './models.js';
import { Animator } from './anim.js';

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

// Character look-dev harness: ?test=char&who=kai  — captures a turntable of views.
import * as THREE from 'three';
import { SunLight } from 'three/addons/lights/SunLight.js';
import { Post } from './render/post.js';
import { Sky } from './render/sky.js';
import { makeNoise3D, makeNoise2D } from './render/textures.js';
import { Fighter } from './character/fighter.js';
import { KAI, GOU } from './character/models.js';
import { KAI_TABLE, GOU_TABLE } from './character/tables.js';

export async function runCharTest(canvas, W, H, params) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const noise3D = makeNoise3D(64), noise2D = makeNoise2D(256);
  const post = new Post(renderer, { noise3D, quality: { volSteps: 16 } });
  post.setSize(W, H);
  const sky = new Sky(renderer, noise2D);
  const scene = new THREE.Scene();
  scene.add(sky.mesh);
  const sun = new SunLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.01;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const t0 = performance.now();
  const who = params.get('who') || 'kai';
  const f = who === 'gou' ? new Fighter(GOU, GOU_TABLE, { noise3D, energyMode: 1 }) : new Fighter(KAI, KAI_TABLE, { noise3D });
  const sc = who === 'gou' ? 1.19 : 1;
  console.log('fighter build ms', Math.round(performance.now() - t0), JSON.stringify(f.buildStats));
  scene.add(f.group);
  const sunDir = new THREE.Vector3(-0.6, 0.45, 0.65).normalize();
  sun.position.copy(sunDir);
  const sunCol = new THREE.Color(1.0, 0.8, 0.62);
  sun.color.copy(sunCol); sun.intensity = 3.2;
  sky.update({ sunDir, sunColorVec: new THREE.Vector3(1, 0.8, 0.6).multiplyScalar(3), time: 0, cloudCover: 0.4, cloudBright: 1, smoke: 0, stars: 0, sunDisk: 1, skyExpo: 1, groundGlow: 0, groundGlowColor: new THREE.Vector3(1, 0.3, 0.1), smokeColor: new THREE.Vector3(0.05, 0.045, 0.04) });
  scene.environment = sky.buildEnv();
  scene.environmentIntensity = 0.7;
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 5000);
  const views = [
    { p: [0, 1.1, 5.2], t: [0, 0.95, 0], fov: 30 },
    { p: [3.2, 1.5, 4.0], t: [0, 0.95, 0], fov: 30 },
    { p: [5.0, 1.1, 0.0], t: [0, 0.95, 0], fov: 30 },
    { p: [0.4, 1.3, -5.0], t: [0, 0.95, 0], fov: 30 },
    { p: [0.25, 1.72, 0.65], t: [0, 1.69, 0], fov: 30 },
    { p: [0.9, 1.75, 0.5], t: [0, 1.7, 0], fov: 30 },
    { p: [1.0, 1.25, 0.75], t: [0.58, 1.02, 0.05], fov: 22 },
    { p: [0.0, 1.69, 0.42], t: [0, 1.69, 0], fov: 22 },
  ];
  const pose = params.get('pose');
  const POSES = {
    guard: { pos: [0, 0, 0], yaw: 0, hipY: -0.07, hips: [0, -28, 0], spine: [6, 4, 0], chest: [6, 8, 0], stanceL: [0.13, 0, 0.24], stanceR: [-0.13, 0, -0.2], footYawL: 10, footYawR: -40,
      ikHandL: [0.12, 1.36, 0.36], ikHandR: [-0.1, 1.4, 0.22], ikHandLw: 1, ikHandRw: 1, poleL: [0.7, -1, -0.4], poleR: [-0.7, -1, -0.4], fistL: 1, fistR: 1 },
    jab: { pos: [0, 0, 0.08], yaw: 0, hipY: -0.06, hips: [0, -38, 0], spine: [8, -8, 0], chest: [8, -14, 0], stanceL: [0.13, 0, 0.32], stanceR: [-0.13, 0, -0.18], footYawL: 10, footYawR: -40,
      ikHandL: [0.03, 1.5, 0.88], ikHandR: [-0.06, 1.47, 0.18], ikHandLw: 1, ikHandRw: 1, poleL: [0.9, -0.6, -0.1], poleR: [-0.7, -1, -0.4], fistL: 1, fistR: 1 },
    crouch: { pos: [0, 0, 0], yaw: 0, hipY: -0.42, hips: [25, 0, 0], spine: [15, 0, 0], chest: [10, 0, 0], stanceL: [0.22, 0, 0.18], stanceR: [-0.22, 0, -0.12],
      ikHandL: [0.25, 0.9, 0.35], ikHandR: [-0.3, 0.55, 0.1], ikHandLw: 1, ikHandRw: 1, fistL: 0.2, fistR: 0.9 },
  };
  if (pose && POSES[pose]) {
    f.anim.track.key(0, POSES[pose], 'linear');
    for (let i = 0; i < 30; i++) f.anim.evaluate(i / 60, 1 / 60);
  }
  window.__captureAt = async (t) => {
    const v = views[Math.round(t) % views.length];
    camera.position.fromArray(v.p).multiplyScalar(sc); camera.lookAt(new THREE.Vector3().fromArray(v.t).multiplyScalar(sc)); camera.fov = v.fov; camera.updateProjectionMatrix();
    f.u.uEnergy.value = Number(params.get('energy') || 0); f.u.uTime.value = 1.3;
    f.u.uEnergyColor.value.setRGB(1.0, 0.35, 0.06);
    if (pose === 'neutral') f.neutral();
    post.render(scene, camera, {
      time: 1, exposure: 1.0, sun: { dir: sunDir, color: sunCol, intensity: 3.2, light: sun },
      vol: { on: false }, dof: { focus: camera.position.distanceTo(new THREE.Vector3().fromArray(v.t)), aperture: 0.0 },
      mb: { strength: 0 }, bloom: { strength: 0.04, threshold: 2 }, grade: { sat: 1.0, contrast: 1.0 }, aspect: W / H, grain: 0.01, vignette: 0.2, ca: 0.0005,
    });
    return canvas.toDataURL('image/png');
  };
  window.__ready = true;
}

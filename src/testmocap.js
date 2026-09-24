// Mocap QA harness: ?test=mocap&clip=roundR[&who=kai][&mirror=1][&view=side|front|34|top]
// Plays a clip on a fighter on a gridded floor and captures frames at clip times.
import * as THREE from 'three';
import { SunLight } from 'three/addons/lights/SunLight.js';
import { Post } from './render/post.js';
import { Sky } from './render/sky.js';
import { makeNoise3D, makeNoise2D } from './render/textures.js';
import { Fighter } from './character/fighter.js';
import { KAI, GOU } from './character/models.js';
import { KAI_TABLE, GOU_TABLE } from './character/tables.js';
import { getClip } from './mocap/clips.js';

export async function runMocapTest(canvas, W, H, params) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const noise3D = makeNoise3D(64), noise2D = makeNoise2D(256);
  const post = new Post(renderer, { noise3D, quality: { volSteps: 8 } });
  post.setSize(W, H);
  const sky = new Sky(renderer, noise2D);
  const scene = new THREE.Scene();
  scene.add(sky.mesh);
  const sun = new SunLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.01;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(40, 40, 0x999999, 0x666666);
  grid.position.y = 0.002;
  scene.add(grid);
  const who = params.get('who') || 'kai';
  const f = who === 'gou' ? new Fighter(GOU, GOU_TABLE, { noise3D, energyMode: 1 }) : new Fighter(KAI, KAI_TABLE, { noise3D });
  scene.add(f.group);
  const clip = getClip(params.get('clip') || 'roundR');
  const mirror = params.get('mirror') === '1';
  f.anim.addClip({ clip, w0: 0, pos: [0, 0, 0], yaw: 0, mirror, fadeIn: 0, fadeOut: 0, speed: Number(params.get('speed') || 1) });
  f.anim.track.key(0, { fistL: 1, fistR: 1 }, 'linear');
  const sunDir = new THREE.Vector3(-0.5, 0.55, 0.65).normalize();
  sun.position.copy(sunDir);
  const sunCol = new THREE.Color(1.0, 0.85, 0.7);
  sun.color.copy(sunCol); sun.intensity = 3.0;
  sky.update({ sunDir, sunColorVec: new THREE.Vector3(1, 0.85, 0.7).multiplyScalar(3), time: 0, cloudCover: 0.3, cloudBright: 1, smoke: 0, stars: 0, sunDisk: 1, skyExpo: 1, groundGlow: 0, groundGlowColor: new THREE.Vector3(1, 0.3, 0.1), smokeColor: new THREE.Vector3(0.05, 0.045, 0.04) });
  scene.environment = sky.buildEnv();
  scene.environmentIntensity = 0.8;
  const camera = new THREE.PerspectiveCamera(32, W / H, 0.05, 5000);
  const view = params.get('view') || '34';
  let simT = 0;
  f.anim.evaluate(0, 0);
  window.__captureAt = async (t) => {
    if (t < simT) { simT = 0; f.anim.reset(); f.anim.evaluate(0, 0); }
    while (simT < t - 1e-6) { const d = Math.min(1 / 60, t - simT); simT += d; f.anim.evaluate(simT, d); }
    const hp = f.anim.bonePos.hips;
    const tgt = new THREE.Vector3(hp.x, 0.95 * (who === 'gou' ? 1.19 : 1), hp.z);
    const off = { '34': [3.4, 1.4, 4.2], side: [5.2, 1.1, 0], front: [0, 1.2, 5.4], back: [0, 1.4, -5.4], top: [0.01, 7, 0.5] }[view];
    camera.position.set(tgt.x + off[0], off[1], tgt.z + off[2]);
    camera.lookAt(tgt);
    camera.updateMatrixWorld();
    sun.position.copy(sunDir);
    post.render(scene, camera, {
      time: t, exposure: 1.0, sun: { dir: sunDir, color: sunCol, intensity: 3.0, light: sun },
      vol: { on: false }, dof: { focus: 5, aperture: 0 }, mb: { strength: 0 }, bloom: { strength: 0.03, threshold: 2 },
      grade: { sat: 1.0, contrast: 1.0 }, aspect: W / H, grain: 0.0, vignette: 0.15, ca: 0,
    });
    return canvas.toDataURL('image/png');
  };
  console.log('clip', JSON.stringify({ name: clip.name, dur: clip.dur, events: clip.events.slice(0, 12) }));
  window.__ready = true;
}

// Engine: owns the renderer, post chain, sky/sun, city, fighters and per-frame orchestration.
import * as THREE from 'three';
import { SunLight } from 'three/addons/lights/SunLight.js';
import { Post } from './render/post.js';
import { Sky } from './render/sky.js';
import { makeNoise3D, makeNoise2D } from './render/textures.js';
import { makeArchMaterial, damageUniforms } from './world/archmat.js';
import { makeGlassMaterial } from './world/glass.js';
import { City } from './world/city.js';
import { Fighter } from './character/fighter.js';
import { KAI, GOU } from './character/models.js';
import { KAI_TABLE, GOU_TABLE } from './character/tables.js';
import { FX } from './fx/fx.js';
import { Debris } from './fx/debris.js';

export const QUALITY = {
  ultra: { scale: 1.0, msaa: 4, volSteps: 40, shadow: 2048, bloomLevels: 6 },
  high: { scale: 1.0, msaa: 0, volSteps: 32, shadow: 2048, bloomLevels: 6 },
  medium: { scale: 0.8, msaa: 0, volSteps: 20, shadow: 1536, bloomLevels: 5 },
  low: { scale: 0.6, msaa: 0, volSteps: 12, shadow: 1024, bloomLevels: 4, dof: false },
};

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.q = QUALITY[opts.quality || 'high'];
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.offline, stencil: false });
    r.setPixelRatio(1);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NoToneMapping;
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.info.autoReset = false;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 30000);
    this.time = 0;
  }

  async init(progress = () => {}) {
    const step = async (msg, frac) => { progress(msg, frac); await new Promise((r) => setTimeout(r, 0)); };
    await step('textures', 0.02);
    this.noise3D = makeNoise3D(64);
    this.noise2D = makeNoise2D(256);
    this.post = new Post(this.renderer, { noise3D: this.noise3D, quality: this.q });
    this.sky = new Sky(this.renderer, this.noise2D);
    this.scene.add(this.sky.mesh);
    const sun = new SunLight(0xffffff, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.q.shadow, this.q.shadow);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.sun = sun;
    this.scene.add(sun);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.sunColor = new THREE.Color(1, 1, 1);
    this.sunIntensity = 3;
    // look state (lighting, sky) defaults: dusk
    this.look = defaultLook();
    this.applyLook(this.look, true);
    this.envEqui = this.sky.buildEquirect(1, 0.2);
    const ctx = { noise2D: this.noise2D, noise3D: this.noise3D, envEqui: this.envEqui, mats: {} };
    ctx.mats.arch = makeArchMaterial(this.noise2D);
    ctx.mats.glassO = makeGlassMaterial(this.noise2D, this.envEqui, false);
    ctx.mats.glassT = makeGlassMaterial(this.noise2D, this.envEqui, true);
    this.ctx = ctx;
    await step('city', 0.1);
    this.city = new City(ctx, (m) => progress(m, 0.2));
    this.scene.add(this.city.group);
    await step('fighters', 0.5);
    this.kai = new Fighter(KAI, KAI_TABLE, { noise3D: this.noise3D, energyMode: 0 });
    this.kai.u.uEnergyColor.value.setRGB(0.35, 0.8, 1.0);
    this.kai.u.uEyeColor.value.setRGB(0.4, 0.9, 1.0);
    await step('fighters', 0.75);
    this.gou = new Fighter(GOU, GOU_TABLE, { noise3D: this.noise3D, energyMode: 1 });
    this.gou.u.uEnergyColor.value.setRGB(1.0, 0.36, 0.06);
    this.gou.u.uEyeColor.value.setRGB(1.0, 0.45, 0.1);
    this.kai.anim.opponent = this.gou;
    this.gou.anim.opponent = this.kai;
    this.scene.add(this.kai.group, this.gou.group);
    for (const f of [this.kai, this.gou]) f.mesh.layers.enable(1);
    this.fx = new FX(this);
    this.debris = new Debris(this);
    this.debris.floorFn = (x, y, z) => this.city.floorAt(x, y, z);
    this.debris.obstacles = this.city.shellBoxes();
    this.maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    await step('environment', 0.95);
    this.scene.environment = this.sky.buildEnv();
    this.scene.environmentIntensity = this.look.envIntensity;
    progress('ready', 1);
  }

  setSize(w, h) {
    this.w = w; this.h = h;
    const s = this.q.scale;
    const rw = Math.max(2, Math.round(w * s)), rh = Math.max(2, Math.round(h * s));
    this.renderer.setSize(rw, rh, false);
    this.post.setSize(rw, rh);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  applyLook(L, force = false) {
    const e = L.sunElev * Math.PI / 180, a = L.sunAz * Math.PI / 180;
    this.sunDir.set(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)).normalize();
    this.sun.position.copy(this.sunDir);
    this.sunColor.setRGB(L.sunColor[0], L.sunColor[1], L.sunColor[2]);
    this.sun.color.copy(this.sunColor);
    this.sun.intensity = L.sunIntensity;
    this.sunIntensity = L.sunIntensity;
    this.sky.update({
      sunDir: this.sunDir, sunColorVec: new THREE.Vector3(L.sunColor[0], L.sunColor[1], L.sunColor[2]).multiplyScalar(L.sunIntensity),
      time: this.time, cloudCover: L.cloudCover, cloudBright: L.cloudBright, smoke: L.smoke, stars: L.stars, sunDisk: L.sunDisk, skyExpo: L.skyExpo,
      groundGlow: L.groundGlow, groundGlowColor: new THREE.Vector3(...L.groundGlowColor), smokeColor: new THREE.Vector3(...L.smokeColor),
    });
    damageUniforms.uNight.value = L.night;
    damageUniforms.uPower.value = L.power;
  }

  updateMaterialUniforms(camera) {
    const m = this.ctx.mats;
    for (const g of [m.glassO, m.glassT]) {
      g.uniforms.uSunDir.value.copy(this.sunDir);
      g.uniforms.uSunCol.value.set(this.sunColor.r, this.sunColor.g, this.sunColor.b).multiplyScalar(this.sunIntensity);
      g.uniforms.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      g.uniforms.uEnvGain.value = this.look.glassEnv;
    }
    const su = this.city.skyline.uniforms;
    su.uSunDir.value.copy(this.sunDir);
    su.uSunCol.value.set(this.sunColor.r, this.sunColor.g, this.sunColor.b).multiplyScalar(this.sunIntensity * 0.9);
    su.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    su.uAmbient.value.fromArray(this.look.skylineAmbient);
    su.uFogColor.value.fromArray(this.look.fogColor);
    su.uFogDensity.value = this.look.skylineFog;
    damageUniforms.uTime.value = this.time;
  }

  // advance simulation by world dt ending at world time W
  stepWorld(W, dt) {
    this.time = W;
    for (const f of [this.kai, this.gou]) f.anim.evaluate(W, dt);
    this.debris.movers = [this.kai, this.gou].map((f) => ({ a: f.anim.bonePos.hips.clone(), b: f.anim.bonePos.head.clone(), r: 0.45, vel: f.anim.boneVel.chest.clone() }));
    this.debris.step(dt, W);
    this.city.wires.step(dt);
    this.city.wires.updateGeometry();
    this.fx.particles.movers = [this.kai, this.gou].map((f) => { const p = f.anim.bonePos.chest, v = f.anim.boneVel.chest; return { x: p.x, y: p.y, z: p.z, r: 2.5, vx: v.x, vy: v.y, vz: v.z }; });
    this.fx.update(W, dt, this.camera);
  }

  render(fx = {}) {
    const cam = this.camera;
    cam.updateMatrixWorld();
    this.updateMaterialUniforms(cam);
    const L = this.look;
    const F = this.fx.frameFx || {};
    const self = this;
    const hooks = {
      renderParticles(r, target, depthHalf, camera) {
        self.fx.particles.render(r, target, depthHalf, camera, {
          sun: self.sun, sunDir: self.sunDir, sunCol: new THREE.Vector3(self.sunColor.r, self.sunColor.g, self.sunColor.b).multiplyScalar(self.sunIntensity * 0.6),
          ambient: new THREE.Vector3(...L.fogAmbient).multiplyScalar(0.55), fogColor: new THREE.Vector3(...L.fogColor), fogDensity: L.skylineFog, lights: F.lights || [],
        });
      },
      renderMask(r, target) {
        self.scene.overrideMaterial = self.maskMat;
        const env = self.scene.environment;
        cam.layers.set(1);
        r.render(self.scene, cam);
        cam.layers.set(0);
        self.scene.overrideMaterial = null;
      },
    };
    fx = { ...fx, dust: [...(fx.dust || []), ...(F.dust || [])], vlights: [...(fx.vlights || []), ...(F.lights || [])], shocks: [...(fx.shocks || []), ...(F.shocks || [])], heat: F.heat, flash: (fx.flash || 0) + (F.flash || 0), flashColor: F.flashColor, impact: fx.impact || F.impact, hooks };
    this.post.render(this.scene, cam, {
      time: this.time,
      exposure: L.exposure,
      sun: { dir: this.sunDir, color: this.sunColor, intensity: this.sunIntensity, light: this.sun },
      vol: { on: true, density: L.fogDensity, height: 0, falloff: L.fogFalloff, ambient: L.fogAmbient, tint: L.fogTint, aniso: 0.7, maxDist: L.fogMaxDist, sunScatter: L.sunScatter, dust: fx.dust || [], lights: fx.vlights || [] },
      dof: fx.dof || { focus: 20, aperture: 0 },
      mb: fx.mb || { strength: 0.4 },
      bloom: { strength: L.bloom, threshold: 1.4, dirt: 0.5, streak: fx.streak ?? 0.15 },
      grade: L.grade,
      aspect: fx.aspect ?? 2.39,
      ca: fx.ca ?? 0.0012, lensK: fx.lensK ?? 0, vignette: 0.38, grain: 0.035,
      shocks: fx.shocks || [], heat: fx.heat || [],
      impact: fx.impact, flash: fx.flash, flashColor: fx.flashColor, fade: fx.fade, fadeWhite: fx.fadeWhite,
      speedLines: fx.speedLines, cut: fx.cut,
    }, fx.hooks || {});
  }
}

export function defaultLook() {
  return {
    sunElev: 7, sunAz: -62, sunColor: [1.0, 0.62, 0.36], sunIntensity: 4.2,
    cloudCover: 0.48, cloudBright: 1.0, smoke: 0, stars: 0, sunDisk: 1, skyExpo: 1, groundGlow: 0, groundGlowColor: [1, 0.35, 0.1], smokeColor: [0.05, 0.045, 0.04],
    night: 0.2, power: 1, envIntensity: 1.25, glassEnv: 1.15, exposure: 1.3, bloom: 0.05,
    fogDensity: 0.0022, fogFalloff: 0.012, fogAmbient: [0.25, 0.3, 0.42], fogTint: [1, 1, 1], fogMaxDist: 900, sunScatter: 1.0,
    skylineAmbient: [0.3, 0.33, 0.42], fogColor: [0.62, 0.52, 0.5], skylineFog: 0.0011,
    grade: { sat: 1.05, contrast: 1.06, temp: 0.05, lift: [0.0, 0.005, 0.015], gain: [1.02, 1.0, 0.97], splitShadow: [-0.1, 0.05, 0.2], splitHigh: [0.2, 0.08, -0.1] },
  };
}

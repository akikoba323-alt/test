// 崩界 — the film. World-time choreography, camera, lighting and events.
import * as THREE from 'three';
import * as mv from './moves.js';
import { PT } from '../fx/particles.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildScript(S, film) {
  const K = S.kai, G = S.gou;
  const E = S.e;

  // ============================================================================================
  // LIGHTING — color script
  S.look(0, { sunElev: 3.4, sunAz: -90, sunColor: [1.0, 0.58, 0.3], sunIntensity: 4.6, cloudCover: 0.42, night: 0.15, exposure: 1.75, envIntensity: 1.25, fogDensity: 0.0014, sunScatter: 0.9,
    grade: { sat: 1.06, contrast: 1.1, temp: 0.04, lift: [0.0, 0.004, 0.014], gain: [1.03, 1.0, 0.97], splitShadow: [-0.14, 0.03, 0.24], splitHigh: [0.2, 0.07, -0.1] } });
  S.look(10.9, { fogDensity: 0.0014 });
  S.look(11.2, { fogDensity: 0.0009, sunScatter: 0.7 });
  S.look(29, { sunElev: 2.8, sunColor: [1.0, 0.5, 0.24] });

  // ============================================================================================
  // ACT 0 — 序 stillness
  S.chapter(0, '序', '静寂');
  K.key(0, { pos: [-22, 0, 2], yaw: 90, floor: 0 }, 'linear');
  G.key(0, { pos: [22, 0, -2], yaw: -90, floor: 0 }, 'linear');
  mv.ready(K, 0); mv.ready(G, 0);
  G.key(0, { fistR: 0.35, fistL: 0.5 }, 'linear');
  G.key(5.6, { fistR: 0.35 }, 'linear');
  G.key(6.05, { fistR: 1.0 }, 'snap');
  K.key(6.9, { eyeGlow: 0 }, 'linear'); K.key(7.35, { eyeGlow: 0.35 }, 'outQuad'); K.key(7.9, { eyeGlow: 0.05 }, 'inQuad');
  K.key(9.6, { head: [0, 0, 0] }, 'linear'); K.key(10.4, { head: [-4, 0, 0] }, 'inOutSine');
  // drifting dust / papers in the wind
  for (let t = 0.2; t < 11; t += 0.45) S.event(t, (e) => {
    e.fx.particles.spawn(PT.DUST, -30 + Math.random() * 60, 0.2, -10 + Math.random() * 20, 2.5 + Math.random() * 2, 0.3, 0.6, 3.5, 0.5 + Math.random() * 0.5, Math.random());
    if (Math.random() < 0.3) e.fx.particles.spawn(PT.PAPER, -40 + Math.random() * 20, 0.3 + Math.random(), -8 + Math.random() * 16, 3 + Math.random() * 2, 0.8, Math.random() - 0.5, 6, 0.14, Math.random());
  });
  // dust swirling at Kai's feet for the boots shot
  for (let t = 3.2; t < 5.4; t += 0.12) S.event(t, (e) => e.fx.particles.spawn(PT.DUST, -22 + (Math.random() - 0.5) * 2, 0.05, 2 + (Math.random() - 0.5) * 2, 2.2 + Math.random(), 0.25, (Math.random() - 0.5), 2.2, 0.22 + Math.random() * 0.2, Math.random()));
  // Gou's stance lowers — the asphalt creaks
  G.key(9.6, { hipY: -0.04 }, 'linear');
  mv.guard(G, 10.6, 'inOutCubic');
  mv.guard(K, 10.5, 'inOutCubic');
  S.event(10.35, (e, c) => { e.fx.crack(V(22, 0.02, -2), 3.2, { grow: 0.6 }); film.cue('creak', { pos: V(22, 0, -2) }); });
  S.event(10.8, () => film.cue('silence', { dur: 0.3 }));

  S.shot(0, 'dolly', { name: 'telephoto sunset', from: [300, 2.6, 0.4], to: [300, 4.0, 0.4], target: [0, 1.9, 0], targetTo: [0, 2.2, 0], fov: 4.2, aperture: 0.3, handheld: 0.15, mb: 0.2, exposure: -1.2 });
  S.shot(3.4, 'dolly', { name: 'boots', from: [-21.1, 0.14, 3.25], to: [-21.25, 0.16, 2.55], target: [-22, 0.2, 2.05], fov: 34, aperture: 14, handheld: 0.35 });
  S.shot(5.2, 'dolly', { name: 'gauntlet', from: [21.2, 0.55, -3.55], to: [21.3, 0.6, -3.3], target: 'gou.hand.R', fov: 30, aperture: 10, handheld: 0.3, focus: 'gou.hand.R' });
  S.shot(6.8, 'dolly', { name: 'face 3/4', from: [-21.05, 1.74, 2.72], to: [-21.12, 1.73, 2.64], target: [-21.95, 1.71, 2.0], fov: 22, aperture: 6, handheld: 0.2, focus: 'kai.head' });
  S.shot(8.2, 'dolly', { name: 'profile wide', from: [-2, 1.2, 30], to: [2, 1.4, 29], target: [0, 3.5, 0], fov: 46, aperture: 0.6, handheld: 0.2 });
  S.shot(9.6, 'dolly', { name: 'over shoulder', from: [-23.6, 1.9, 3.3], to: [-23.3, 1.85, 3.0], target: 'gou.chest', fov: 16, aperture: 3, handheld: 0.25, focus: 'gou.chest' });

  // ============================================================================================
  // ACT 1 — 激突 collision
  S.chapter(11, '一', '激突');
  // launch
  K.key(10.85, { hipY: -0.22, spine: [22, 0, 0] }, 'inOutQuad');
  G.key(10.85, { hipY: -0.28, spine: [24, 0, 0] }, 'inOutQuad');
  S.event(11.0, (e, c) => { c.launch('kai', 1.0); c.launch('gou', 1.4); });
  mv.dash(K, 11.0, [-0.95, 0, 0.35], 0.5, { anticipation: 0.0, lean: 38, arms: 'back' });
  mv.dash(G, 11.0, [1.2, 0, -0.25], 0.5, { anticipation: 0.0, lean: 30 });
  // clash pose at contact 11.55: Kai right cross, Gou right haymaker, fists meeting
  K.key(11.36, { ikHandR: [-0.25, 1.35, -0.25], hips: [6, -60, 0], chest: [8, -20, 0] }, 'outQuad');
  G.key(11.34, { ikHandR: [-0.5, 1.8, -0.3], hips: [6, -50, 0], chest: [8, -25, 0] }, 'outQuad');
  K.key(11.55, { ikHandR: [-0.02, 1.52, 0.75], ikHandL: [0.2, 1.3, 0.1], hips: [8, 30, 0], chest: [6, 22, 0], spine: [18, 5, 0], head: [-8, -8, 0], jaw: 0.4, hipY: -0.16, poleR: [-0.8, -0.4, 0], stanceL: [0.14, 0, 0.45], stanceR: [-0.12, 0, -0.35], feet: 'slide' }, 'strike');
  G.key(11.55, { ikHandR: [0.02, 1.55, 0.95], ikHandL: [0.3, 1.4, 0.25], hips: [8, 30, 0], chest: [10, 25, 0], spine: [16, 5, 0], head: [-6, -10, 0], jaw: 0.7, hipY: -0.2, poleR: [-0.9, -0.3, 0], stanceL: [0.25, 0, 0.45], stanceR: [-0.22, 0, -0.4], feet: 'slide' }, 'heavy');
  S.hitstop(11.55, 0.1);
  S.slow(11.57, 11.8, 0.075, 0.015, 0.12);
  S.event(11.55, (e, c) => {
    const p = V(0.1, 1.55, 0.05);
    c.strike('kai', 'hand.R', 'gou', { at: p, dir: [1, 0, 0], strength: 1.4, kind: 'clash', impactFrame: 0.05, flash: 1.0, windows: 95, windowSpeed: 120, cars: 34, wires: 80, shockR: 110 });
    e.fx.crack(V(0.1, 0.02, 0), 14, { grow: 0.35 });
    e.fx.burst(PT.RING, 240, V(0, 0.12, 0), { flat: 0.02, speed: 42, life: 2.4, size: 1.3, spread: 2.5, minY: 0.1 });
    e.fx.burst(PT.SPARK, 140, p, { speed: 40, life: 0.7, size: 0.035, spread: 0.1 });
    e.fx.light(p, [1.0, 0.85, 0.7], 30, 30, 0.25, 0.002);
    e.debris.applyBlast(p, 40, 18, 0.35);
    film.cue('megaClash', { pos: p, strength: 1.4 });
  });
  // hold the clash (pushing against each other), then recoil apart
  K.key(11.8, { pos: [-0.95, 0, 0.35], hipY: -0.18, spine: [20, 5, 0] }, 'linear');
  G.key(11.8, { pos: [1.2, 0, -0.25], hipY: -0.22, spine: [18, 5, 0] }, 'linear');
  mv.skid(K, 11.82, 5.2, 0.5);
  mv.skid(G, 11.82, 4.0, 0.55);
  S.event(11.84, (e, c) => { e.fx.dashTrail(V(-1, 0, 0.3), V(-6.2, 0, 0.3), 1.2); e.fx.dashTrail(V(1.2, 0, -0.2), V(5.2, 0, -0.2), 1.4); e.fx.shake(0.6, 0.12); film.cue('skid', { pos: V(0, 0, 0) }); });

  S.shot(11.0, 'track', { name: 'rush track', subject: 'kai.chest', offset: [-1.2, -0.6, 3.2], target: 'kai.chest', lookOff: [3.5, 0, -0.5], fov: 62, lag: 0, mb: 0.8, handheld: 0.5, aperture: 0.6 });
  S.shot(11.4, 'static', { name: 'closing wide', pos: [0.4, 0.55, 6.5], target: [0.05, 1.35, 0], fov: 74, lensK: 0.08, mb: 0.9, handheld: 0.4 });
  S.shot(11.555, 'orbit', { name: 'bullet time', center: [0.1, 1.4, 0.05], a0: 160, a1: 262, radius: 4.3, h0: -0.35, h1: 0.4, fov: 44, timeBase: 'play', ease: 'inOutSine', aperture: 4, focus: [0.1, 1.5, 0.05], mb: 0.12, shake: 0.35 });
  S.shot(11.84, 'dolly', { name: 'recoil wide', from: [-3, 7, 26], to: [-2, 6, 24], target: [0, 2.2, 0], fov: 52, aperture: 0.4, shake: 1.2 });

  // --- pause: both in guard
  const g1 = 12.25;
  mv.guard(K, g1); mv.guard(G, g1);
  G.key(12.5, { head: [-6, 16, 8] }, 'inOutQuad'); G.key(12.75, { head: [-6, -10, -6] }, 'inOutQuad'); mv.guard(G, 13.0);
  S.shot(12.1, 'dolly', { name: 'standoff 2', from: [-1.5, 1.4, 9.5], to: [-0.8, 1.5, 8.6], target: 'mid', fov: 38, aperture: 1.4, handheld: 0.35 });

  // --- Kai flurry
  let t = 13.1;
  t = mv.dash(K, t, [3.35, 0, 0.1], 0.16, { anticipation: 0.05, lean: 26 });
  const j1 = mv.punch(K, t, { side: 'L', type: 'jab', target: 'head' });
  mv.block(G, j1.contact - 0.08, 0.3);
  S.event(j1.contact, (e, c) => c.strike('kai', 'hand.L', 'gou', { strength: 0.45, kind: 'block' }));
  const j2 = mv.punch(K, j1.contact + 0.1, { side: 'R', type: 'cross', target: 'head' });
  mv.block(G, j2.contact - 0.06, 0.3);
  S.event(j2.contact, (e, c) => c.strike('kai', 'hand.R', 'gou', { strength: 0.6, kind: 'block' }));
  G.key(j2.contact + 0.02, { pos: G.pos.slice() }, 'linear');
  G.key(j2.contact + 0.25, { pos: [G.pos[0] + 0.7, 0, G.pos[2]], feet: 'slide' }, 'outCubic');
  const j3 = mv.punch(K, j2.contact + 0.12, { side: 'L', type: 'hook', target: 'head' });
  S.event(j3.contact, (e, c) => c.strike('kai', 'hand.L', 'gou', { strength: 0.75, react: 'head', impactFrame: 0.034 }));
  mv.react(G, j3.contact, { part: 'head', side: -1, strength: 0.8 });
  const j4 = mv.punch(K, j3.contact + 0.14, { side: 'R', type: 'body', target: 'gut' });
  mv.block(G, j4.contact - 0.07, 0.25, { low: true });
  S.event(j4.contact, (e, c) => c.strike('kai', 'hand.R', 'gou', { strength: 0.55, kind: 'block' }));
  const j5 = mv.kick(K, j4.contact + 0.12, { side: 'R', type: 'spin', target: 'chest', dirSign: 1 });
  mv.block(G, j5.contact - 0.1, 0.45);
  S.event(j5.contact, (e, c) => { c.strike('kai', 'foot.R', 'gou', { strength: 0.9, kind: 'block', shockR: 14 }); });
  // Gou slides back from the spin kick, feet carving the asphalt
  G.key(j5.contact, { pos: G.pos.slice() }, 'linear');
  G.key(j5.contact + 0.45, { pos: [G.pos[0] + 3.2, 0, G.pos[2]], feet: 'slide' }, 'outCubic');
  G.key(j5.contact + 0.47, { feet: 'plant' }, 'step');
  S.event(j5.contact + 0.02, (e) => { e.fx.dashTrail(V(4.5, 0, 0.1), V(7.8, 0, 0.1), 1.0); e.fx.crack(V(6.5, 0.02, 0), 3, { grow: 0.3 }); });
  K.key(j5.end, { pos: K.pos.slice() }, 'linear');
  t = j5.end + 0.05;
  S.shot(13.1, 'cover', { name: 'flurry', side: 80, elev: 6, fill: 0.78, fov: 36, lag: 5, handheld: 0.6, aperture: 1.2, shake: 1.0 });
  S.shot(j2.contact + 0.02, 'static', { name: 'over gou', pos: [7.2, 2.25, -0.9], target: 'kai.chest', fov: 28, aperture: 2, handheld: 0.5, focus: 'kai.head' });
  S.shot(j3.contact - 0.1, 'orbit', { name: 'hook side', center: 'gou.head', a0: 20, a1: -5, radius: 2.4, height: -0.1, fov: 30, aperture: 3, shake: 1.2 });
  S.shot(j4.contact - 0.05, 'cover', { name: 'body low', side: 70, elev: -4, fill: 0.85, fov: 50, lag: 6, minY: 0.35, handheld: 0.6, aperture: 0.8 });
  S.shot(j5.contact - 0.18, 'static', { name: 'spin kick wide', pos: [5, 1.1, 10.5], target: [5.5, 1.3, 0], fov: 40, aperture: 0.8, shake: 1.3 });

  // --- Gou's heavy hook; Kai ducks; the air pressure blows a car away
  const hk = mv.punch(G, t + 0.25, { side: 'R', type: 'heavy', target: 'head', step: 0.7 });
  mv.slip(K, hk.contact - 0.12, { duck: true, dir: 1, dur: 0.42 });
  S.slow(hk.contact - 0.08, hk.contact + 0.16, 0.2, 0.04, 0.06);
  S.event(hk.contact, (e, c) => {
    const p = e.gou.anim.bonePos['hand.R'].clone();
    film.cue('whooshHeavy', { pos: p });
    e.fx.shock(p, { speed: 60, maxR: 18, thick: 1.5, strength: 1.0, bright: 0.2, push: 3 });
    e.fx.burst(PT.RING, 60, V(p.x, 0.2, p.z), { dir: V(-0.6, 0.1, 0.8).normalize(), cone: 0.5, speed: 30, life: 1.2, size: 0.8, spread: 0.5 });
    const car = e.city.cars[0];
    const b = e.debris.addProp(car.mesh, car.half, car.mass, { vel: V(-6, 7, 17), spin: V(3.5, 1.5, -2.5) });
    car.crush(V(0.9, 0.9, 0.2), 0.9); car.u.uBroken.value = 1;
    e.fx.burst(PT.GLASS, 40, car.mesh.position.clone().setY(1.2), { speed: 8, life: 1.6, size: 0.03, spread: 1.5 });
    film.cue('carImpact', { pos: car.mesh.position.clone(), strength: 0.8 });
  });
  S.shot(hk.contact - 0.35, 'static', { name: 'duck close', pos: [K.pos[0] - 1.6, 0.9, K.pos[2] + 2.6], target: 'kai.head', fov: 34, aperture: 4, focus: 'kai.head', shake: 1.3 });

  // --- Kai counters: knee, uppercut, spinning back kick launching Gou into the van
  const c1 = mv.kick(K, hk.contact + 0.22, { side: 'L', type: 'knee', target: 'gut' });
  S.event(c1.contact, (e, c) => c.strike('kai', 'shin.L', 'gou', { strength: 0.85, react: 'gut', dent: 0.12, impactFrame: 0.034 }));
  mv.react(G, c1.contact, { part: 'gut', strength: 1.1, dur: 0.3 });
  const c2 = mv.punch(K, c1.contact + 0.1, { side: 'R', type: 'upper', target: 'jaw' });
  S.event(c2.contact, (e, c) => c.strike('kai', 'hand.R', 'gou', { strength: 0.9, react: 'head', dent: 0.1, flash: 0.4 }));
  mv.react(G, c2.contact, { part: 'head', strength: 1.3, dur: 0.35, noReturn: true });
  const c3 = mv.kick(K, c2.contact + 0.12, { side: 'R', type: 'spin', target: 'chest', dirSign: -1 });
  S.hitstop(c3.contact, 0.08);
  S.event(c3.contact, (e, c) => c.strike('kai', 'foot.R', 'gou', { strength: 1.1, react: 'chest', impactFrame: 0.05, flash: 0.6, shockR: 20, cars: 8 }));
  const gFrom = G.pos.slice();
  G.key(c3.contact, { pos: gFrom }, 'linear');
  mv.fly(G, c3.contact + 0.01, [23.4, 0.2, 0.9], 0.62, { arc: 0.9, spin: -0.15, pose: 'flung' });
  S.event(c3.contact + 0.63, (e, c) => {
    const van = e.city.cars[2];
    const b = e.debris.addProp(van.mesh, van.half, van.mass, { vel: V(2.6, 1.5, 0.4), spin: V(0.2, 0.8, 0.3) });
    van.crush(V(-0.95, 1.0, 0.2), 1.1); van.crush(V(-0.95, 0.6, -0.6), 0.8); van.u.uBroken.value = 1;
    c.strike('gou', 'chest', 'gou', { at: e.gou.anim.bonePos.spine.clone(), dir: [1, 0, 0], strength: 0.8, kind: 'metal' });
    e.fx.burst(PT.GLASS, 60, van.mesh.position.clone().setY(1.3), { speed: 9, life: 1.8, size: 0.035, spread: 1.6 });
    film.cue('carImpact', { pos: van.mesh.position.clone(), strength: 1.0 });
  });
  mv.land(G, c3.contact + 0.64, { deep: true, recover: 0.7 });
  S.shot(c1.contact - 0.1, 'cover', { name: 'counter', side: 110, elev: 5, fill: 0.8, fov: 40, lag: 6, handheld: 0.7, aperture: 1.0, shake: 1.2 });
  S.shot(c3.contact - 0.05, 'dolly', { name: 'launch to van', from: [12, 1.3, 7.5], to: [17, 1.5, 6.5], target: 'gou.chest', fov: 44, aperture: 0.5, shake: 1.4, mb: 0.8 });


  // --- Gou rips up the van and hurls it; Kai kicks it away into a facade
  const tLand = c3.contact + 0.64;
  const tUp = tLand + 0.7;
  G.key(tUp + 0.05, { yaw: 95 }, 'inOutQuad');                // turn toward the van (east)
  G.key(tUp + 0.35, { hipY: -0.45, spine: [40, 0, 0], ikHandL: [0.55, 0.8, 0.95], ikHandR: [-0.55, 0.8, 0.95], poleL: [1, 0, -0.3], poleR: [-1, 0, -0.3], jaw: 0.6 }, 'inOutQuad');
  S.event(tUp + 0.3, (e) => {
    const van = e.city.cars[2];
    const b = van.mesh.userData.body || e.debris.addProp(van.mesh, van.half, van.mass);
    b.follow = { fighter: e.gou, bone: 'hand.L', offset: [0, 0.35, 0], t0: e.time, blend: 0.3, quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)) };
    b.follow.bone2 = null;
    film.cue('metalGroan', { pos: van.mesh.position.clone() });
  });
  // lift overhead, then pivot to face Kai and throw
  G.key(tUp + 0.8, { hipY: -0.1, spine: [-10, 0, 0], chest: [-15, 0, 0], head: [-20, 0, 0], ikHandL: [0.45, 2.6, 0.2], ikHandR: [-0.45, 2.6, 0.2], jaw: 1 }, 'inOutCubic');
  const tThrow = tUp + 1.25;
  G.key(tUp + 1.05, { yaw: -100, chest: [-25, 0, 0], ikHandL: [0.45, 2.7, -0.25], ikHandR: [-0.45, 2.7, -0.25] }, 'inOutQuad');
  G.key(tThrow, { spine: [30, 0, 0], chest: [20, 0, 0], ikHandL: [0.35, 1.7, 1.0], ikHandR: [-0.35, 1.7, 1.0], hipY: -0.2, jaw: 1 }, 'strike');
  S.event(tThrow, (e) => {
    const van = e.city.cars[2];
    const b = van.mesh.userData.body;
    b.follow = null;
    const target = e.kai.anim.bonePos.chest.clone().add(V(0, 0.4, 0));
    const dir = target.clone().sub(b.p).normalize();
    b.v.copy(dir.multiplyScalar(27)).add(V(0, 1.8, 0));
    b.w.set(0.4, 2.6, 0.8);
    film.cue('whooshHeavy', { pos: b.p.clone() });
  });
  mv.guard(G, tThrow + 0.5);
  // Kai: flying side kick meets the van ~0.62 s later
  const tVan = tThrow + 0.6;
  K.key(tVan - 0.32, { pos: K.pos.slice() }, 'linear');
  mv.fly(K, tVan - 0.3, [K.pos[0] + 3.4, 1.35, K.pos[2] - 0.2], 0.3, { arc: 0.35, pose: 'tuck' });
  K.key(tVan, { feet: 'fk', ikFootR: [-0.1, 0.1, 1.05], ikFootRw: 1, poleFootR: [-0.2, 1, 0], tilt: [0, 38], 'thigh.L': [-80, 0, 0], 'shin.L': [120, 0, 0], ikHandLw: 0, ikHandRw: 0 }, 'strike');
  S.hitstop(tVan, 0.07);
  S.slow(tVan - 0.05, tVan + 0.12, 0.25, 0.03, 0.05);
  S.event(tVan, (e, c) => {
    const van = e.city.cars[2];
    const b = van.mesh.userData.body;
    const foot = e.kai.anim.bonePos['foot.R'].clone();
    b.v.set(-9, 13, -15);
    b.w.set(3.5, -1.5, 2.0);
    van.crush(van.mesh.worldToLocal(foot.clone()), 1.2);
    e.fx.hit(foot, V(-0.4, 0.5, -0.7).normalize(), 1.0, 'metal', { sparks: true });
    e.fx.burst(PT.GLASS, 50, foot, { speed: 10, life: 1.6, size: 0.03, spread: 1.2 });
    e.fx.impactFrame(0.034, 1, 1);
    film.cue('carKick', { pos: foot });
  });
  const kaiAfterVan = [K.pos[0] - 5.5, 0, K.pos[2] + 9.5];
  mv.fly(K, tVan + 0.1, kaiAfterVan, 0.75, { arc: 2.2, spin: -1, pose: 'tuck' });
  mv.land(K, tVan + 0.85, { recover: 0.3 });
  // van smashes into the NW mid-rise
  S.event(tVan + 1.05, (e, c) => {
    const van = e.city.cars[2];
    const p = van.mesh.position.clone().add(V(0, 1, 0));
    c.breakAround(p, 4.5, { speed: 9, maxSize: 7 });
    c.damageAround(p, 9, 0.7);
    e.fx.crack(p, 6, { grow: 0.15 });
    e.fx.hit(p, V(0, 0, -1), 1.0, 'metal');
    film.cue('crash', { pos: p, strength: 1 });
  });
  S.shot(tUp - 0.1, 'cover', { name: 'gou rises', subjects: ['gou.chest', () => E.city.cars[2].mesh.position], side: -70, elev: 4, fill: 0.7, fov: 40, lag: 3, aperture: 1.5, handheld: 0.4 });
  S.shot(tUp + 0.62, 'static', { name: 'van overhead low', pos: [20.5, 0.4, 5.5], target: 'gou.head', lookOff: [0, 0.8, 0], fov: 50, aperture: 0.8, handheld: 0.5 });
  S.shot(tThrow - 0.05, 'cover', { name: 'van incoming', subjects: ['kai.chest', () => E.city.cars[2].mesh.position], side: -60, elev: 5, fill: 0.7, fov: 44, lag: 4, aperture: 1.2, handheld: 0.6 });
  S.shot(tVan - 0.12, 'orbit', { name: 'van kick', center: () => E.kai.anim.bonePos['foot.R'], a0: 150, a1: 190, radius: 4.2, height: 0.3, fov: 40, timeBase: 'play', aperture: 2, mb: 0.2, shake: 1.2 });
  S.shot(tVan + 0.2, 'cover', { name: 'van flies', subjects: ['kai.chest', () => E.city.cars[2].mesh.position], side: 120, elev: 10, fill: 0.6, fov: 52, lag: 2.5, aperture: 0.4, shake: 1.0 });

  // --- Gou charges; Kai vaults; Gou demolishes the corner signal pole
  const tCharge = tVan + 1.2;
  G.key(tCharge, { pos: G.pos.slice() }, 'linear');
  const pole = [-12.6, 0, 16.4];
  const chargeTo = [pole[0] + 1.1, 0, pole[2] - 1.0];
  const rn = mv.run(G, tCharge, chargeTo, 1.75, { accel: true });
  for (const tf of rn.falls) S.event(tf, (e, c) => {
    const p = e.gou.anim.bonePos[Math.random() < 0.5 ? 'foot.L' : 'foot.R'].clone(); p.y = 0.05;
    e.fx.crack(p, 1.6, { grow: 0.05 });
    e.fx.burst(PT.CHIP, 10, p, { dir: V(0, 1, 0), cone: 0.8, speed: 4, life: 1.2, size: 0.04 });
    e.fx.burst(PT.DUST, 4, p, { up: 0.6, speed: 2, life: 1.4, size: 0.6 });
    e.fx.shake(0.18, 0.08);
    film.cue('stomp', { pos: p });
  });
  // Kai waits, then vaults over the tackle (full flip)
  mv.guard(K, tCharge + 0.2);
  const tVault = tCharge + 1.35;
  const kv = K.pos.slice();
  const vaultTo = [kv[0] + 2.5, 0, kv[2] - 3.2];
  mv.leap(K, tVault, vaultTo, 4.2, 0.9, { flips: 1, pose: 'tuck' });
  // shoulder tackle into the pole
  G.key(tCharge + 1.75, { spine: [35, 0, 0], chest: [20, -30, 0], hips: [0, -35, 0], ikHandLw: 1, ikHandRw: 1, ikHandL: [0.3, 1.2, 0.3], ikHandR: [-0.2, 1.5, 0.1] }, 'outQuad');
  S.event(tCharge + 1.75, (e, c) => {
    const p = V(pole[0], 3, pole[2]);
    c.breakAround(p, 3.2, { speed: 14, maxSize: 10 });
    c.breakAround(V(pole[0], 6.2, pole[2] - 4), 5, { speed: 10, maxSize: 10, silent: true });
    for (const r of e.city.wires.ropes) if (r.pts[0].distanceTo(p) < 20 || r.pts[r.pts.length - 1].distanceTo(p) < 20) { e.city.wires.snap(r, 3 + (r.n % 5)); }
    e.city.wires.blast(p, 30, 14);
    e.fx.hit(p, V(-0.6, 0.2, 0.7).normalize(), 1.1, 'metal', { sparks: true });
    e.fx.burst(PT.SPARK, 120, V(pole[0], 9, pole[2]), { speed: 12, life: 1.2, size: 0.03, spread: 1 });
    e.fx.light(V(pole[0], 8, pole[2]), [0.6, 0.8, 1.0], 18, 18, 0.25, 0.002).flicker = 40;
    film.cue('poleSnap', { pos: p });
  });
  mv.guard(G, tCharge + 2.05);
  S.shot(tCharge - 0.05, 'cover', { name: 'charge', subjects: ['gou.chest', 'kai.chest'], side: 60, elev: 3, fill: 0.7, fov: 38, lag: 4, minY: 0.4, aperture: 0.8, handheld: 0.6, shake: 1.2 });
  S.shot(tVault + 0.05, 'cover', { name: 'vault', subjects: ['kai.hips', 'gou.chest'], side: 95, orbit: 40, elev: 2, fill: 0.72, fov: 48, lag: 4, minY: 0.35, aperture: 0.5, mb: 0.6 });
  S.shot(tCharge + 1.7, 'static', { name: 'pole hit', pos: [pole[0] + 9, 1.6, pole[2] - 7], target: [pole[0], 4, pole[2]], fov: 48, aperture: 0.4, shake: 1.4 });

  // --- axe kick: Gou slammed face-down -> crater 1
  const tAxe = tVault + 0.9 + 0.45;
  K.key(tVault + 0.9 + 0.02, { pos: K.pos.slice() }, 'linear');
  const gP = [pole[0] + 1.6, 0, pole[2] - 2.0];
  mv.fly(K, tVault + 0.93, [gP[0] + 1.2, 4.2, gP[2] - 1.0], 0.3, { arc: 1.2, pose: 'tuck' });
  K.key(tAxe - 0.12, { feet: 'fk', ikFootR: [-0.05, 2.1, 0.5], ikFootRw: 1, tilt: [-20, 0], spine: [-10, 0, 0], ikHandLw: 0, ikHandRw: 0 }, 'outQuad');
  K.key(tAxe, { pos: [gP[0] + 0.9, 2.2, gP[2] - 0.8], ikFootR: [-0.05, -0.2, 0.9], tilt: [25, 0], spine: [25, 0, 0] }, 'strike');
  G.key(tAxe - 0.3, { pos: gP, yaw: G.yaw }, 'outQuad');
  G.key(tAxe, { spine: [15, 0, 0] }, 'linear');
  S.hitstop(tAxe, 0.11);
  S.slow(tAxe + 0.01, tAxe + 0.22, 0.12, 0.02, 0.1);
  S.event(tAxe, (e, c) => {
    c.strike('kai', 'foot.R', 'gou', { strength: 1.3, react: 'chest', dir: [0, -1, 0], impactFrame: 0.05, impactMode: 0, flash: 0.5, cars: 16, windows: 26 });
  });
  G.key(tAxe + 0.001, { pos: gP }, 'linear');
  G.key(tAxe + 0.14, { pos: [gP[0], -0.55, gP[2]], tilt: [80, 0], feet: 'fk', 'thigh.L': [0, 0, 8], 'thigh.R': [0, 0, -8], 'shin.L': [10, 0, 0], 'shin.R': [10, 0, 0], ikHandLw: 0, ikHandRw: 0, 'upperarm.L': [-150, 0, 30], 'upperarm.R': [-150, 0, -30], jaw: 0.8 }, 'inQuad');
  S.event(tAxe + 0.14, (e, c) => { c.crater(V(gP[0], 0, gP[2]), 4.2, 1.3, { power: 1.2 }); e.fx.flash(0.35, 0.06); });
  K.key(tAxe + 0.02, { pos: [gP[0] + 0.9, 2.2, gP[2] - 0.8] }, 'linear');
  mv.fly(K, tAxe + 0.05, [gP[0] + 2.4, 0, gP[2] - 2.2], 0.45, { arc: 1.4, spin: -0.5, pose: 'tuck' });
  mv.land(K, tAxe + 0.5, { recover: 0.35 });
  S.shot(tAxe - 0.35, 'cover', { name: 'axe low', subjects: ['kai.hips', 'gou.chest'], side: 70, elev: -8, fill: 0.8, fov: 52, lag: 0, minY: 0.35, aperture: 0.6, shake: 1.6 });
  S.shot(tAxe + 0.13, 'cover', { name: 'crater top', subjects: ['gou.chest', 'kai.hips'], side: 60, orbit: 25, elev: 52, fill: 0.45, fov: 50, lag: 0, timeBase: 'play', aperture: 0.3, shake: 1.2, mb: 0.2 });

  // --- ankle grab, overhead swing, slam (crater 2), throw down the avenue
  const tGrab = tAxe + 1.35;
  G.key(tGrab - 0.5, { pos: [gP[0], -0.3, gP[2]], tilt: [40, 0], hipY: -0.2 }, 'inOutQuad');
  G.key(tGrab - 0.1, { pos: [gP[0], 0, gP[2]], tilt: [0, 0], feet: 'plant', yaw: G.yawTo(K.pos[0], K.pos[2]), hipY: -0.45, spine: [35, 0, 0], ikHandRw: 1, ikHandR: [-0.1, 0.35, 1.2], ikHandLw: 1, ikHandL: [0.4, 0.9, 0.4], 'upperarm.L': [0, 0, 0], 'upperarm.R': [0, 0, 0], 'thigh.L': [0, 0, 0], 'thigh.R': [0, 0, 0], 'shin.L': [0, 0, 0], 'shin.R': [0, 0, 0] }, 'outCubic');
  G.key(tGrab, { ikHandR: [-0.05, 0.25, 1.35], fistR: 0.3 }, 'snap');
  G.key(tGrab + 0.05, { fistR: 0.85 }, 'snap');
  // swing: hand goes overhead (root space: forward -> up -> behind -> ground behind)
  const sw = [[-0.05, 0.4, 1.3], [-0.1, 2.2, 0.9], [-0.1, 3.0, 0.0], [-0.1, 2.0, -1.0], [-0.1, 0.5, -1.3]];
  const swT = [tGrab + 0.1, tGrab + 0.32, tGrab + 0.44, tGrab + 0.55, tGrab + 0.64];
  sw.forEach((h, i) => G.key(swT[i], { ikHandR: h, hipY: -0.2 + (i === 2 ? 0.1 : 0), spine: [i < 2 ? 10 : -15 + i * 12, 0, 0], chest: [i < 2 ? -10 : 5 * i, 0, 0], jaw: 1 }, i === 4 ? 'inCubic' : 'inOutSine'));
  S.hold(tGrab, tGrab + 0.64, 'kai', 'gou', 'hand.R', [0, 0, 0]);
  // Kai: grabbed by the ankle - inverted, flung around the arc (tilt tracks the swing)
  K.key(tGrab, { feet: 'fk', tilt: [180, 0], ikHandLw: 0, ikHandRw: 0, 'upperarm.L': [-160, 0, 20], 'upperarm.R': [-150, 0, -30], 'thigh.L': [-10, 0, 10], 'thigh.R': [30, 0, -10], 'shin.L': [60, 0, 0], jaw: 0.6, look: 0 }, 'snap');
  K.key(swT[1], { tilt: [120, 0] }, 'inOutSine');
  K.key(swT[2], { tilt: [0, 0] }, 'inOutSine');
  K.key(swT[3], { tilt: [-90, 0] }, 'inOutSine');
  K.key(swT[4], { tilt: [-150, 0] }, 'inCubic');
  const slamP = [gP[0] - 2.6, 0, gP[2] + 1.6];
  S.hitstop(swT[4], 0.1);
  S.event(swT[4], (e, c) => {
    const p = e.kai.anim.bonePos.chest.clone(); p.y = 0.2;
    c.strike('gou', 'hand.R', 'kai', { at: p, strength: 1.2, react: 'chest', dir: [0, -1, 0], impactFrame: 0.034, flash: 0.3 });
    c.crater(V(p.x, 0, p.z), 3.2, 1.0, { power: 0.9 });
  });
  // second swing back over and release toward the east
  S.hold(swT[4] + 0.12, swT[4] + 0.55, 'kai', 'gou', 'hand.R', [0, 0, 0]);
  const sw2 = [[-0.1, 0.5, -1.3], [-0.1, 2.3, -0.8], [-0.1, 3.0, 0.2], [0.0, 2.4, 1.2]];
  sw2.forEach((h, i) => G.key(swT[4] + 0.12 + i * 0.14, { ikHandR: h, spine: [30 - i * 18, 0, 0], jaw: 1 }, 'inOutSine'));
  K.key(swT[4] + 0.12, { tilt: [-150, 0] }, 'linear');
  K.key(swT[4] + 0.4, { tilt: [-10, 0] }, 'inOutSine');
  const tRel = swT[4] + 0.12 + 0.42;
  const relPos = [gP[0] + 0.6, 3.0, gP[2] - 0.4];
  K.key(tRel, { pos: relPos, tilt: [40, 0] }, 'linear');
  const kaiSkidFrom = [12, 0.4, 5.2];
  mv.fly(K, tRel + 0.01, kaiSkidFrom, 0.72, { arc: 0.8, spin: 1, pose: 'flung' });
  G.key(tRel, { fistR: 0.2 }, 'snap');
  mv.guard(G, tRel + 0.35);
  const tSkid = tRel + 0.73;
  K.key(tSkid, { pos: kaiSkidFrom, tilt: [0, 0], yaw: -100, feet: 'slide' }, 'linear');
  mv.land(K, tSkid + 0.01, { recover: 0.1 });
  K.key(tSkid + 0.02, { pos: kaiSkidFrom }, 'linear');
  K.key(tSkid + 0.6, { pos: [17, 0, 4.2], feet: 'slide', hipY: -0.35, spine: [20, 0, 0], ikHandL: [0.5, 0.25, 0.3] }, 'outCubic');
  K.key(tSkid + 0.62, { feet: 'plant' }, 'step');
  S.event(tSkid + 0.01, (e) => { e.fx.dashTrail(V(12, 0, 5.2), V(17, 0, 4.2), 1.3); for (let i = 0; i < 8; i++) e.at && 0; film.cue('skid', { pos: V(14, 0, 4.8) }); });
  S.shot(tGrab - 0.2, 'cover', { name: 'grab', subjects: ['gou.hand.R', 'kai.foot.R'], side: 90, elev: 4, fill: 0.55, minR: 1.3, fov: 40, lag: 0, minY: 0.3, aperture: 2 });
  S.shot(tGrab + 0.08, 'cover', { name: 'swing', subjects: ['gou.chest', 'kai.chest'], axis: [1, 0], side: 90, elev: 6, fill: 0.62, minR: 3.2, fov: 46, lag: 0, aperture: 0.4, mb: 0.7, shake: 1.2 });
  S.shot(tRel - 0.05, 'track', { name: 'thrown', subject: 'kai.chest', offset: [-1.8, 0.6, 3.5], target: 'kai.chest', fov: 55, lag: 5, aperture: 0.6, mb: 0.7 });
  S.shot(tSkid - 0.05, 'static', { name: 'skid stop', pos: [20.5, 0.35, 7.5], target: [16, 0.6, 4.4], fov: 44, aperture: 1.5, shake: 1.0 });

  // --- Kai's energy ignites; spinning heel kick launches Gou into the tower lobby
  const tIgnite = tSkid + 0.75;
  mv.guard(K, tIgnite, 'inOutQuad', { energy: 0 });
  K.key(tIgnite + 0.45, { energy: 0.75, eyeGlow: 0.9 }, 'inOutQuad');
  K.key(tIgnite + 1.2, { energy: 0.75, eyeGlow: 0.9 }, 'linear');
  S.event(tIgnite + 0.1, () => film.cue('energyRise', { who: 'kai' }));
  const lobbyHit = [33.5, 1.6, -25.5];
  const meet = [7.5, 0, 3.2];
  G.key(tIgnite + 0.1, { pos: G.pos.slice() }, 'linear');
  const gRun = mv.run(G, tIgnite + 0.1, [meet[0] - 1.2, 0, meet[2] + 0.9], 0.95, { accel: true });
  K.key(tIgnite + 0.55, { pos: K.pos.slice() }, 'linear');
  mv.dash(K, tIgnite + 0.55, [meet[0] + 0.3, 0, meet[2] - 0.2], 0.3, { anticipation: 0.03, lean: 28 });
  const hk2 = mv.kick(K, tIgnite + 0.92, { side: 'R', type: 'spin', target: 'chest', dirSign: 1 });
  S.hitstop(hk2.contact, 0.12);
  S.slow(hk2.contact - 0.04, hk2.contact + 0.18, 0.1, 0.03, 0.08);
  S.event(hk2.contact, (e, c) => {
    c.strike('kai', 'foot.R', 'gou', { strength: 1.5, react: 'chest', impactFrame: 0.05, impactMode: 0, flash: 0.8, shockR: 40, cars: 12 });
    const p = e.kai.anim.bonePos['foot.R'].clone();
    e.fx.burst(PT.ENERGY, 120, p, { speed: 14, life: 0.8, size: 0.05, spread: 0.3 });
    e.fx.light(p, [0.4, 0.8, 1.0], 25, 20, 0.3, 0.003);
    film.cue('energyHit', { pos: p });
  });
  G.key(hk2.contact, { pos: G.pos.slice() }, 'linear');
  mv.fly(G, hk2.contact + 0.01, lobbyHit, 0.62, { arc: 0.6, spin: -0.2, roll: 0.3, pose: 'flung' });
  const tLobby = hk2.contact + 0.63;
  S.event(tLobby, (e, c) => {
    const p = V(lobbyHit[0], lobbyHit[1], lobbyHit[2]);
    c.breakAround(p, 4.2, { speed: 20, blastPos: p.clone().add(V(-4, 0, 6)) });
    c.shatterRing(p, 30, 90, 1);
    c.damageAround(p, 12, 0.6);
    e.interiors.addPortal(V(lobbyHit[0], 3, lobbyHit[2] - 1), 7);
    e.fx.crack(V(lobbyHit[0], 0.1, lobbyHit[2] - 3), 8, { grow: 0.2 });
    e.fx.hit(p, V(0.4, 0, -1).normalize(), 1.3, 'heavy');
    e.fx.dust(V(lobbyHit[0], 2, lobbyHit[2] - 6), 2, 14, 0.025, 8, 1.2);
    e.fx.burst(PT.DUST, 60, V(lobbyHit[0], 1.5, lobbyHit[2]), { speed: 10, life: 3, size: 1.2, spread: 3 });
    film.cue('crash', { pos: p, strength: 1.4 });
  });
  G.key(tLobby + 0.01, { pos: [lobbyHit[0] + 1, 0, lobbyHit[2] - 7], feet: 'fk', tilt: [-60, 0] }, 'outCubic');
  S.shot(tIgnite - 0.1, 'dolly', { name: 'kai ignites', from: [19.5, 1.55, 6.6], to: [19.1, 1.6, 6.1], target: 'kai.head', fov: 30, aperture: 3, focus: 'kai.head' });
  S.shot(tIgnite + 0.6, 'cover', { name: 'converge', side: 90, elev: 3, fill: 0.75, fov: 55, lag: 3, minY: 0.4, aperture: 0.5, mb: 0.8 });
  S.shot(hk2.contact - 0.1, 'orbit', { name: 'heel kick', center: () => E.gou.anim.bonePos.chest, a0: 250, a1: 205, radius: 3.6, height: 0.2, fov: 44, timeBase: 'play', aperture: 3, mb: 0.2, shake: 1.3 });
  S.shot(hk2.contact + 0.2, 'dolly', { name: 'into the tower', from: [-2, 6, 14], to: [2, 5, 10], target: () => E.gou.anim.bonePos.chest, fov: 42, aperture: 0.3, mb: 0.7, shake: 1.2 });

  // --- quiet beat: dust settles; then a red roar from inside the lobby
  const tQuiet = tLobby + 0.4;
  mv.guard(K, tQuiet + 0.6, 'inOutQuad', { energy: 0.25, eyeGlow: 0.3 });
  K.key(tQuiet + 1.4, { head: [-2, 10, 0], chest: [10, 0, 0] }, 'inOutSine');
  S.event(tQuiet + 0.8, () => film.cue('carAlarm', { pos: V(24, 0, 9) }));
  const tRoar = tQuiet + 2.4;
  S.event(tRoar, (e, c) => {
    const p = V(lobbyHit[0] + 1, 2, lobbyHit[2] - 7);
    e.fx.light(p, [1.0, 0.35, 0.08], 30, 25, 1.2, 0.3);
    c.shatterRing(p, 22, 60, 0.8);
    e.fx.shock(p, { speed: 50, maxR: 30, thick: 2, strength: 1, bright: 0.2, push: 3 });
    film.cue('roar', { pos: p });
  });
  G.key(tRoar - 0.8, { energy: 0, eyeGlow: 0 }, 'linear');
  G.key(tRoar - 0.4, { pos: [lobbyHit[0] + 1, 0, lobbyHit[2] - 7], tilt: [0, 0], feet: 'plant', yaw: 200, energy: 0.2 }, 'inOutQuad');
  mv.charge(G, tRoar - 0.3, 0.7, { roar: true });
  G.key(tRoar + 0.2, { energy: 0.7, eyeGlow: 1 }, 'outQuad');
  S.shot(tQuiet, 'dolly', { name: 'aftermath', from: [4, 1.7, 13], to: [4.5, 1.8, 11.5], target: [lobbyHit[0], 3, lobbyHit[2]], fov: 34, aperture: 0.6, handheld: 0.3 });
  S.shot(tQuiet + 1.2, 'dolly', { name: 'kai back', from: [K.pos[0] - 1.2, 1.5, K.pos[2] + 3.5], to: [K.pos[0] - 0.9, 1.55, K.pos[2] + 2.8], target: [lobbyHit[0], 2.5, lobbyHit[2]], fov: 38, aperture: 2.5, focus: 'kai.head', handheld: 0.25 });
  S.shot(tRoar - 0.1, 'static', { name: 'lobby roar', pos: [lobbyHit[0] - 6, 1.4, lobbyHit[2] + 12], target: [lobbyHit[0] + 1, 2.5, lobbyHit[2] - 7], fov: 36, aperture: 0.8, shake: 1.5 });
  const act1End = tRoar + 1.0;

  S.finish(act1End + 2);
}

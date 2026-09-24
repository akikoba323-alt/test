// Acts 0–1: the stand-off and the street clash, performed with retimed motion capture.
// Phrasing follows fight-choreography practice: each exchange is a short phrase with a clear
// cause and result, separated by resets; the camera holds on phrases from one side of the
// Kai→Gou line and cuts on the big impacts.
import * as THREE from 'three';
import * as mv from '../moves.js';
import { PT } from '../../fx/particles.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const arr = (v) => [v.x, v.y, v.z];

// facing (deg) from a fighter's turtle position toward a point, continuous with its current yaw
function yawToward(F, p) {
  let y = Math.atan2(p[0] - F.pos[0], p[2] - F.pos[2]) * 180 / Math.PI;
  while (y - F.yaw > 180) y -= 360;
  while (y - F.yaw < -180) y += 360;
  return y;
}
// a hold on the idle performance, facing a point
function idle(F, t, dur, face, o = {}) {
  const yaw = face ? yawToward(F, face) : F.yaw;
  const from = o.from ?? 1.0;
  const span = Math.min(8.5, dur * (o.speed ?? 0.9));
  return F.clip(t, 'idle', { from, to: from + span, dur, yaw, fadeIn: o.fadeIn ?? 0.18, fadeOut: o.fadeOut ?? 0.18, offset: o.offset });
}
// strike aim window: pull the limb onto `target` (world point or opponent bone name) around contact
function aim(F, limb, tc, target, o = {}) {
  const key = { LH: 'aimL', RH: 'aimR', LF: 'aimFootL', RF: 'aimFootR' }[limb];
  const at = { LH: 'aimAtL', RH: 'aimAtR', LF: 'aimFootAtL', RF: 'aimFootAtR' }[limb];
  const pre = o.pre ?? 0.1, post = o.post ?? 0.12;
  F.key(tc - pre - 0.001, { [key]: 0 }, 'linear');
  F.key(tc - pre, { [at]: target }, 'step');
  F.key(tc - 0.01, { [key]: o.w ?? 1 }, 'outQuad');
  F.key(tc + (o.hold ?? 0.04), { [key]: o.w ?? 1 }, 'linear');
  F.key(tc + post, { [key]: 0 }, 'inOutQuad');
}
// authored arm override over the performance (blocks, grabs): root-space hand targets
function arms(F, t, dur, L, R, o = {}) {
  const ramp = o.ramp ?? 0.07;
  F.key(t - ramp, { mIKL: 0, mIKR: 0 }, 'linear');
  F.key(t, { mIKL: L ? 1 : 0, mIKR: R ? 1 : 0, ...(L ? { ikHandL: L, poleL: o.poleL || [1, -0.3, -0.5] } : {}), ...(R ? { ikHandR: R, poleR: o.poleR || [-1, -0.3, -0.5] } : {}) }, 'outQuad');
  F.key(t + dur, { mIKL: L ? 1 : 0, mIKR: R ? 1 : 0 }, 'linear');
  F.key(t + dur + (o.release ?? 0.16), { mIKL: 0, mIKR: 0 }, 'inOutQuad');
}

// Place a strike so its limb lands on target at tc, then (optionally) carry the fighter there
// with a locomotion clip that starts at tTravel. Returns the strike handle.
function approach(F, tc, name, so, tr) {
  const pre = F.pos.slice(), preYaw = F.yaw;
  const h = F.strikeClipAt(tc, name, so);
  const st = F.at(h, so.from ?? 0);
  const post = F.pos.slice(), postYaw = F.yaw;
  if (tr) {
    F.pos = pre; F.yaw = preYaw;
    F.travelClip(tr.t, tr.clip || 'run', tr.from ?? 1.0, tr.to ?? 1.7, [st.x, 0, st.z], h.t0 - tr.t + (tr.overlap ?? 0.05), { fadeIn: tr.fadeIn ?? 0.12, fadeOut: tr.fadeOut ?? 0.12 });
  }
  F.pos = post; F.yaw = postYaw;
  return h;
}

export function act01(S, film) {
  const K = S.kai, G = S.gou, E = S.e;

  // ============================================================================================
  // ACT 0 — 序 stillness
  S.chapter(0, '序', '静寂');
  K.key(0, { pos: [-22, 0, 2], yaw: 90, floor: 0 }, 'linear');
  G.key(0, { pos: [22, 0, -2], yaw: -90, floor: 0 }, 'linear');
  mv.ready(K, 0); mv.ready(G, 0);
  K.key(0, { mlook: 0.85, fistL: 0.55, fistR: 0.55 }, 'linear');
  G.key(0, { mlook: 0.85, fistR: 0.35, fistL: 0.6 }, 'linear');
  const tGo = 10.95;
  idle(K, 0, tGo, [22, 0, -2], { from: 0.6, speed: 0.85, fadeIn: 0 });
  idle(G, 0, tGo, [-22, 0, 2], { from: 2.0, speed: 0.72, fadeIn: 0 });
  G.key(5.6, { fistR: 0.35 }, 'linear');
  G.key(6.05, { fistR: 1.0 }, 'snap');
  K.key(6.9, { eyeGlow: 0 }, 'linear'); K.key(7.35, { eyeGlow: 0.35 }, 'outQuad'); K.key(7.9, { eyeGlow: 0.05 }, 'inQuad');
  K.key(9.0, { fistL: 0.55, fistR: 0.55 }, 'linear'); K.key(9.3, { fistL: 1, fistR: 1 }, 'snap');
  for (let t = 0.2; t < 11; t += 0.45) S.event(t, (e) => {
    e.fx.particles.spawn(PT.DUST, -30 + Math.random() * 60, 0.2, -10 + Math.random() * 20, 2.5 + Math.random() * 2, 0.3, 0.6, 3.5, 0.5 + Math.random() * 0.5, Math.random());
    if (Math.random() < 0.3) e.fx.particles.spawn(PT.PAPER, -40 + Math.random() * 20, 0.3 + Math.random(), -8 + Math.random() * 16, 3 + Math.random() * 2, 0.8, Math.random() - 0.5, 6, 0.14, Math.random());
  });
  for (let t = 3.2; t < 5.4; t += 0.12) S.event(t, (e) => e.fx.particles.spawn(PT.DUST, -22 + (Math.random() - 0.5) * 2, 0.05, 2 + (Math.random() - 0.5) * 2, 2.2 + Math.random(), 0.25, (Math.random() - 0.5), 2.2, 0.22 + Math.random() * 0.2, Math.random()));
  S.event(10.35, (e) => { e.fx.crack(V(22, 0.02, -2), 3.2, { grow: 0.6 }); film.cue('creak', { pos: V(22, 0, -2) }); });
  S.event(10.8, () => film.cue('silence', { dur: 0.3 }));

  S.shot(0, 'dolly', { name: 'telephoto sunset', from: [300, 2.6, 0.4], to: [300, 4.0, 0.4], target: [0, 1.9, 0], targetTo: [0, 2.2, 0], fov: 4.2, aperture: 0.3, handheld: 0.15, mb: 0.2, exposure: -0.7 });
  S.shot(3.4, 'dolly', { name: 'boots', from: [-21.0, 0.16, 3.3], to: [-21.2, 0.17, 2.6], target: 'kai.foot.L', lookOff: [0.2, 0.05, 0], fov: 34, aperture: 14, handheld: 0.35, focus: 'kai.foot.L' });
  S.shot(5.2, 'single', { name: 'gauntlet', subject: 'gou.hand.R', world: true, az: 200, elev: 8, dist: 1.25, fov: 32, s: [0.25, -0.1], aperture: 10, handheld: 0.3, focus: 'gou.hand.R', op: { pos: 3, aim: 5 } });
  S.shot(6.8, 'single', { name: 'kai face', subject: 'kai.head', axisFrom: ['kai.chest', 'gou.chest'], az: -35, elev: 2, dist: 1.05, fov: 24, s: [-0.3, 0.05], aperture: 6, handheld: 0.2, focus: 'kai.head', op: { pos: 3, aim: 5 } });
  S.shot(8.2, 'two', { name: 'standoff wide', sa: [-0.62, -0.18], sb: [0.62, -0.12], side: 1, az: 0, elev: 1.5, fov: 24, minD: 25, maxD: 90, aperture: 0.4, handheld: 0.2, newAxis: true });
  S.shot(9.6, 'two', { name: 'over kai shoulder', sa: [-0.72, -0.35], sb: [0.12, -0.05], side: 1, az: -58, elev: 3, fov: 18, minD: 2.5, aperture: 3, handheld: 0.25, focus: 'gou.chest' });

  // ============================================================================================
  // ACT 1 — 激突 collision
  S.chapter(11, '一', '激突');
  // ---- phrase 1: both explode forward; right crosses meet in the middle -----------------------
  const clashP = [0.1, 1.55, 0.05];
  const tClash = 11.55;
  S.event(tGo, (e, c) => { c.launch('kai', 1.0); c.launch('gou', 1.4); });
  K.key(tGo, { ghost: 0 }, 'linear'); K.key(tGo + 0.08, { ghost: 0.9 }, 'outQuad'); K.key(tClash, { ghost: 0.9 }, 'linear'); K.key(tClash + 0.15, { ghost: 0 }, 'linear');
  G.key(tGo, { ghost: 0 }, 'linear'); G.key(tGo + 0.08, { ghost: 0.6 }, 'outQuad'); G.key(tClash, { ghost: 0.6 }, 'linear'); G.key(tClash + 0.15, { ghost: 0 }, 'linear');
  const kc = approach(K, tClash, 'cross', { limb: 'RH', target: clashP, from: 0.12, speed: 1.35, fadeIn: 0.12, fadeOut: 0.2,
    offset: [[tClash + 0.02, [0, 0, 0]], [tClash + 0.6, [-4.6, 0, 0.3], 'outCubic']] }, { t: tGo, from: 1.0, to: 1.9, overlap: 0.06 });
  const gc = approach(G, tClash, 'cross', { limb: 'RH', target: clashP, from: 0.1, speed: 1.15, fadeIn: 0.12, fadeOut: 0.2,
    offset: [[tClash + 0.02, [0, 0, 0]], [tClash + 0.6, [3.6, 0, -0.3], 'outCubic']] }, { t: tGo, from: 1.0, to: 1.75, overlap: 0.06 });
  aim(K, 'RH', tClash, clashP, { pre: 0.12, hold: 0.08, post: 0.2 });
  aim(G, 'RH', tClash, clashP, { pre: 0.12, hold: 0.08, post: 0.2 });
  K.key(tClash, { jaw: 0.4 }, 'snap'); G.key(tClash, { jaw: 0.8 }, 'snap');
  S.hitstop(tClash, 0.1);
  S.slow(tClash + 0.02, tClash + 0.25, 0.075, 0.015, 0.12);
  S.event(tClash, (e, c) => {
    const p = V(...clashP);
    c.strike('kai', 'hand.R', 'gou', { at: p, dir: [1, 0, 0], strength: 1.4, kind: 'clash', impactFrame: 0.05, flash: 1.0, windows: 95, windowSpeed: 120, cars: 34, wires: 80, shockR: 110 });
    e.fx.crack(V(0.1, 0.02, 0), 14, { grow: 0.35 });
    e.fx.burst(PT.RING, 240, V(0, 0.12, 0), { flat: 0.02, speed: 42, life: 2.4, size: 1.3, spread: 2.5, minY: 0.1 });
    e.fx.burst(PT.SPARK, 140, p, { speed: 40, life: 0.7, size: 0.035, spread: 0.1 });
    e.fx.light(p, [1.0, 0.85, 0.7], 30, 30, 0.25, 0.002);
    e.debris.applyBlast(p, 40, 18, 0.35);
    film.cue('megaClash', { pos: p, strength: 1.4 });
  });
  S.event(tClash + 0.05, (e) => { e.fx.dashTrail(V(-1, 0, 0.3), V(-5.6, 0, 0.4), 1.2); e.fx.dashTrail(V(1.2, 0, -0.2), V(4.8, 0, -0.4), 1.4); film.cue('skid', { pos: V(0, 0, 0) }); });

  S.shot(tGo, 'single', { name: 'rush', subject: 'kai.hips', axisFrom: ['kai.chest', 'gou.chest'], az: -62, elev: 2, dist: 4.6, fov: 58, s: [-0.25, -0.05], mb: 0.9, handheld: 0.6, aperture: 0.6, op: { pos: 7, aim: 10 } });
  S.shot(tGo + 0.4, 'static', { name: 'closing wide', pos: [0.4, 0.55, 6.5], target: [0.05, 1.35, 0], fov: 74, lensK: 0.08, mb: 0.9, handheld: 0.4 });
  S.shot(tClash + 0.005, 'orbit', { name: 'bullet time', center: [0.1, 1.4, 0.05], a0: 160, a1: 262, radius: 4.3, h0: -0.35, h1: 0.4, fov: 44, timeBase: 'play', ease: 'inOutSine', aperture: 4, focus: [0.1, 1.5, 0.05], mb: 0.12, shake: 0.35 });
  S.shot(tClash + 0.29, 'two', { name: 'recoil wide', sa: [-0.45, -0.1], sb: [0.45, -0.05], side: 1, az: -4, elev: 9, fov: 40, minD: 9, aperture: 0.4, shake: 1.2, op: { pos: 2, aim: 3, zoom: 2 } });

  // ---- phrase 2: reset — guards up, Gou shakes the sting out of his hand ----------------------
  const tReset = kc.t1 - 0.05;
  idle(K, tReset, 1.15, G.pos, { from: 3.0, speed: 1.0 });
  idle(G, gc.t1 - 0.05, 1.2, K.pos, { from: 5.0, speed: 0.8 });
  G.key(tReset + 0.2, { addHead: [0, 0, 0] }, 'linear'); G.key(tReset + 0.45, { addHead: [-8, 18, 6] }, 'inOutQuad'); G.key(tReset + 0.75, { addHead: [-6, -10, -4] }, 'inOutQuad'); G.key(tReset + 1.0, { addHead: [0, 0, 0] }, 'inOutQuad');
  S.shot(tReset - 0.05, 'two', { name: 'reset', sa: [-0.36, -0.08], sb: [0.36, -0.02], side: 1, az: 8, elev: 3, fov: 28, fovTo: 23, minD: 6, aperture: 1.4, handheld: 0.35, op: { pos: 2, aim: 3, zoom: 1 } });

  // ---- phrase 3: speed — Kai's jab-cross (blocked), roundhouse (blocked), side kick (lands) ----
  const t3 = tReset + 1.1;
  // Gou holds his ground in guard for the whole phrase (one long idle); blocks are arm overrides
  idle(G, t3 - 0.1, 2.2, K.pos, { from: 2.4, speed: 0.75 });
  const tJab = t3 + 0.42;
  const kjc = approach(K, tJab, 'jabcross', { limb: 'LH', target: arr(G.boneAt(tJab, 'head')), from: 0.08, speed: 1.45, fadeIn: 0.1, fadeOut: 0.1 },
    { t: t3, from: 1.1, to: 1.55, overlap: 0.05 });
  const tCross2 = kjc.ev('RH');
  aim(K, 'LH', tJab, 'head', { w: 0.8 });
  aim(K, 'RH', tCross2, 'head', { w: 0.8 });
  arms(G, tJab - 0.08, (tCross2 - tJab) + 0.12, [0.1, 1.95, 0.42], [-0.08, 2.0, 0.38]);
  S.event(tJab, (e, c) => c.strike('kai', 'hand.L', 'gou', { strength: 0.45, kind: 'block' }));
  S.event(tCross2, (e, c) => c.strike('kai', 'hand.R', 'gou', { strength: 0.6, kind: 'block' }));
  // roundhouse to the head, caught on Gou's raised left forearm
  const tRound = tCross2 + 0.36;
  const kr = approach(K, tRound, 'round', { limb: 'RF', target: arr(G.boneAt(tRound, 'head')), from: 0.28, to: 1.25, speed: 1.35, fadeIn: 0.1, fadeOut: 0.14 });
  aim(K, 'RF', tRound, 'head', { w: 0.7, pre: 0.08 });
  arms(G, tRound - 0.1, 0.2, [0.42, 2.02, 0.28], null, { poleL: [1, 0.2, -0.3] });
  S.event(tRound, (e, c) => { c.strike('kai', 'foot.R', 'gou', { strength: 0.9, kind: 'block', shockR: 12 }); });
  // side kick to the body: this one lands and drives Gou back, feet carving the asphalt
  const tSide = tRound + 0.62;
  const ks = approach(K, tSide, 'side', { limb: 'RF', target: arr(G.boneAt(tSide, 'spine')), from: 0.25, to: 1.1, speed: 1.3, fadeIn: 0.12, fadeOut: 0.16 });
  aim(K, 'RF', tSide, 'gut', { w: 0.8 });
  const push = new THREE.Vector3(G.pos[0] - K.pos[0], 0, G.pos[2] - K.pos[2]).normalize().multiplyScalar(3.2);
  idle(G, tSide - 0.02, 1.4, K.pos, { from: 4.0, speed: 0.7, fadeIn: 0.04, offset: [[tSide, [0, 0, 0]], [tSide + 0.45, arr(push), 'outCubic']] });
  S.hitstop(tSide, 0.07);
  S.event(tSide, (e, c) => {
    c.strike('kai', 'foot.R', 'gou', { strength: 1.0, react: 'gut', dent: 0.12, impactFrame: 0.034, shockR: 18, cars: 8 });
    const g0 = e.gou.anim.bonePos.hips.clone(); g0.y = 0;
    e.fx.dashTrail(g0, g0.clone().add(push), 1.1);
    e.fx.crack(g0.clone().add(push.clone().multiplyScalar(0.7)), 3, { grow: 0.3 });
  });
  S.shot(t3 - 0.08, 'two', { name: 'speed phrase', sa: [-0.3, -0.06], sb: [0.3, -0.02], side: 1, az: 22, elev: 5, fov: 34, minD: 4.5, aperture: 1.1, handheld: 0.45, shake: 1.0, op: { pos: 3, aim: 5, zoom: 2 } });
  S.shot(tSide - 0.004, 'single', { name: 'side kick land', subject: 'gou.chest', axisFrom: ['kai.chest', 'gou.chest'], az: 38, elev: -6, dist: 3.4, fov: 40, s: [0.18, 0.05], aperture: 2, shake: 1.4, op: { pos: 4, aim: 6 } });

  if (typeof window !== 'undefined') window.__keys = { tGo, tClash, tReset, t3, tJab, tCross2, tRound, tSide };
  return { end: tSide + 1.5, K, G };
}

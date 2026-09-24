// Move library. Each move writes sparse keys into a fighter's track relative to its current
// root (turtle) state and returns timing info (contact time etc.). Kai is fast and snappy;
// Gou loads long and follows through heavily.
const DEG = Math.PI / 180;

export const STYLE = {
  kai: {
    speed: 1.0, heavy: 0.0,
    guard: { hipY: -0.07, hips: [0, -28, 0], spine: [6, 4, 0], chest: [6, 8, 0], neck: [0, 6, 0], head: [-4, 8, 0], stanceL: [0.13, 0, 0.26], stanceR: [-0.13, 0, -0.2], footYawL: 12, footYawR: -40,
      ikHandL: [0.12, 1.36, 0.36], ikHandR: [-0.1, 1.4, 0.22], ikHandLw: 1, ikHandRw: 1, poleL: [0.8, -1, -0.4], poleR: [-0.8, -1, -0.4], fistL: 1, fistR: 1, aimL: 0, aimR: 0, look: 1, jaw: 0, hipOff: [0, 0, 0], ikFootLw: 0, ikFootRw: 0, feet: 'plant', tilt: [0, 0] },
    shoulderY: 1.45, reach: 0.72, headY: 1.68,
  },
  gou: {
    speed: 0.62, heavy: 1.0,
    guard: { hipY: -0.13, hips: [6, -14, 0], spine: [10, 2, 0], chest: [8, 8, 0], neck: [-4, 4, 0], head: [-6, 6, 0], stanceL: [0.27, 0, 0.2], stanceR: [-0.25, 0, -0.18], footYawL: 16, footYawR: -30,
      ikHandL: [0.3, 1.52, 0.52], ikHandR: [-0.2, 1.58, 0.42], ikHandLw: 1, ikHandRw: 1, poleL: [1.0, -0.8, -0.3], poleR: [-1.0, -0.8, -0.3], fistL: 1, fistR: 1, aimL: 0, aimR: 0, look: 1, jaw: 0, hipOff: [0, 0, 0], ikFootLw: 0, ikFootRw: 0, feet: 'plant', tilt: [0, 0] },
    shoulderY: 1.78, reach: 0.95, headY: 2.0,
  },
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const mirrorX = (v) => [-v[0], v[1], v[2]];
const other = (s) => (s === 'L' ? 'R' : 'L');
const sgn = (s) => (s === 'L' ? 1 : -1);

export function styleOf(F) { return STYLE[F.name]; }

export function guard(F, t, ease = 'inOutQuad', over = {}) {
  const g = clone(styleOf(F).guard);
  Object.assign(g, over);
  F.key(t, g, ease);
  return t;
}

// relaxed standing (the stand-off)
export function ready(F, t, ease = 'inOutQuad') {
  const tall = F.name === 'gou';
  F.key(t, {
    hipY: tall ? -0.04 : -0.01, hips: [0, tall ? -8 : -12, 0], spine: [tall ? 6 : 2, 0, 0], chest: [tall ? 4 : 0, 4, 0], neck: [0, 0, 0], head: [tall ? -4 : 0, 0, 0],
    stanceL: [tall ? 0.24 : 0.14, 0, tall ? 0.08 : 0.1], stanceR: [tall ? -0.24 : -0.14, 0, tall ? -0.06 : -0.08], footYawL: 10, footYawR: -14,
    ikHandLw: 0, ikHandRw: 0, 'upperarm.L': [4, 0, tall ? 22 : 10], 'upperarm.R': [4, 0, tall ? -22 : -10], 'forearm.L': [tall ? -24 : -12, 0, 0], 'forearm.R': [tall ? -24 : -12, 0, 0],
    fistL: tall ? 1 : 0.6, fistR: tall ? 1 : 0.6, look: 1, aimL: 0, aimR: 0, jaw: 0, hipOff: [0, 0, 0], feet: 'plant', tilt: [0, 0], ikFootLw: 0, ikFootRw: 0,
    energy: 0, eyeGlow: 0, damage: 0, soot: 0, smear: 0.35, overlap: 1, ghost: 0,
  }, ease);
  return t;
}

// move the root along a straight line with an ease; optional lean
export function travel(F, t, to, dur, ease = 'inOutCubic', o = {}) {
  const ch = { pos: [to[0], to[1] ?? F.pos[1], to[2]] };
  if (o.yaw !== undefined) ch.yaw = o.yaw;
  if (o.feet) ch.feet = o.feet;
  F.key(t, { pos: F.pos.slice() }, 'linear');
  F.key(t + dur, ch, ease);
  return t + dur;
}

// explosive dash: lean in, arms back or guarded, feet skid; returns arrival time
export function dash(F, t, to, dur, o = {}) {
  const st = styleOf(F);
  const yaw = o.yaw ?? F.yawTo(to[0], to[2]);
  const t0 = t;
  // anticipation: sink and load
  const ant = o.anticipation ?? (F.name === 'gou' ? 0.14 : 0.06);
  F.key(t0, { pos: F.pos.slice() }, 'linear');
  F.key(t0 + ant, { hipY: st.guard.hipY - 0.12, spine: [18, 0, 0], chest: [10, 0, 0], yaw, stanceL: [0.14, 0, 0.1], stanceR: [-0.14, 0, -0.35] }, 'outQuad');
  const lean = o.lean ?? 34;
  F.key(t0 + ant + dur * 0.35, { hipY: st.guard.hipY - 0.05, spine: [lean, 0, 0], chest: [lean * 0.4, 0, 0], head: [-lean * 0.6, 0, 0], feet: o.feet ?? 'slide',
    ikHandL: o.arms === 'back' ? [0.35, 1.05, -0.45] : st.guard.ikHandL, ikHandR: o.arms === 'back' ? [-0.35, 1.05, -0.45] : st.guard.ikHandR }, 'outQuad');
  F.key(t0 + ant, { pos: F.pos.slice() }, 'linear');
  F.key(t0 + ant + dur, { pos: [to[0], to[1] ?? 0, to[2]] }, o.ease ?? 'inOutCubic');
  F.key(t0 + ant + dur + 0.02, { feet: 'plant' }, 'step');
  return t0 + ant + dur;
}

// Punch. type: jab | cross | hook | upper | heavy | body. Returns {contact, end}
export function punch(F, t, o = {}) {
  const st = styleOf(F);
  const s = o.side || 'L', sx = sgn(s), os = other(s);
  const type = o.type || 'jab';
  const heavy = F.name === 'gou' || type === 'heavy';
  const sp = (o.speed ?? 1) / (F.name === 'gou' ? 0.75 : 1);
  const A = (type === 'jab' ? 0.05 : type === 'heavy' ? 0.42 : type === 'upper' ? 0.1 : 0.08) / sp * (F.name === 'gou' ? 1.6 : 1);
  const S = (type === 'jab' ? 0.06 : type === 'heavy' ? 0.12 : 0.085) / sp;
  const H = o.hold ?? (type === 'heavy' ? 0.06 : 0.03);
  const R = (type === 'jab' ? 0.1 : type === 'heavy' ? 0.45 : 0.16) / sp;
  const tA = t + A, tC = tA + S, tH = tC + H, tE = tH + R;
  const shY = st.shoulderY;
  const y = o.height ?? (o.target === 'gut' ? shY - 0.35 : o.target === 'chest' ? shY - 0.12 : shY + 0.12);
  const reach = st.reach * 1.05;
  // twist: rear-hand strikes rotate the hips strongly
  const rear = (F.name === 'kai' && s === 'R') || (F.name === 'gou' && s === 'R');
  const twist = type === 'jab' ? -12 : type === 'hook' ? 48 * sx : type === 'upper' ? 30 * sx : rear ? 55 * sx : -22;
  const g = st.guard;
  // anticipation: hand pulls back, hips load the other way, knees sink
  const load = {
    jab: { hand: [sx * 0.1, y - 0.05, 0.22], hips: [4, -24, 0] },
    cross: { hand: [sx * 0.14, y - 0.08, 0.1], hips: [6, g.hips[1] - 10 * sx, 0] },
    hook: { hand: [sx * 0.45, y - 0.05, 0.12], hips: [6, g.hips[1] - 22 * sx, 0] },
    upper: { hand: [sx * 0.18, y - 0.55, 0.12], hips: [18, g.hips[1] - 15 * sx, 0] },
    heavy: { hand: [sx * 0.55, y + 0.1, -0.45], hips: [4, g.hips[1] - 45 * sx, 0] },
    body: { hand: [sx * 0.16, y - 0.4, 0.12], hips: [12, g.hips[1] - 12 * sx, 0] },
  }[type];
  F.key(tA, {
    ['ikHand' + s]: load.hand, ['aim' + s]: 0, hips: load.hips, hipY: g.hipY - (heavy ? 0.12 : 0.05), spine: [heavy ? 12 : 8, load.hips[1] * 0.2, 0], chest: [8, load.hips[1] * 0.35, 0],
    ['pole' + s]: [sx * 1.0, -0.6, -0.6], jaw: heavy ? 0.4 : 0,
  }, heavy ? 'outCubic' : 'outQuad');
  // strike
  const hookArc = type === 'hook' ? [sx * 0.02, y, reach * 0.8] : type === 'upper' ? [sx * 0.05, y + 0.1, reach * 0.7] : [sx * 0.02, y, reach];
  const stepIn = o.step ?? (type === 'jab' ? 0.18 : heavy ? 0.45 : 0.25);
  const fw = F.fwd(stepIn);
  F.key(tA, { pos: F.pos.slice() }, 'linear');
  F.key(tC, { pos: [F.pos[0] + fw[0], F.pos[1], F.pos[2] + fw[2]] }, 'outCubic');
  F.key(tC, {
    ['ikHand' + s]: hookArc, ['aim' + s]: o.aim ?? 1, ['aimAt' + s]: o.target || 'head',
    hips: [heavy ? 8 : 4, g.hips[1] + twist, 0], hipY: g.hipY - (heavy ? 0.1 : 0.04), spine: [heavy ? 14 : 8, twist * 0.25, type === 'hook' ? -sx * 6 : 0], chest: [heavy ? 10 : 6, twist * 0.45, 0],
    ['pole' + s]: type === 'hook' ? [sx * 0.6, 0.6, -0.4] : type === 'upper' ? [sx * 0.4, -1, -0.5] : [sx * 0.9, -0.5, -0.1],
    ['ikHand' + os]: [-sx * 0.08, shY - 0.02, 0.2], head: [-6, -twist * 0.3, 0], jaw: heavy ? 0.7 : 0.1,
  }, type === 'heavy' ? 'heavy' : 'strike');
  F.key(tH, { ['aim' + s]: o.aim ?? 1 }, 'linear');
  // follow-through / recovery
  if (heavy) F.key(tH + R * 0.35, { hips: [10, g.hips[1] + twist * 1.25, 0], chest: [12, twist * 0.6, 0], ['aim' + s]: 0.3, ['ikHand' + s]: [sx * -0.15, y - 0.25, reach * 0.85] }, 'outQuad');
  guard(F, tE, 'inOutQuad');
  return { contact: tC, end: tE, hold: tH, side: s };
}

// Kicks: round | front | side | spin | knee | axe
export function kick(F, t, o = {}) {
  const st = styleOf(F);
  const s = o.side || 'R', sx = sgn(s), os = other(s);
  const type = o.type || 'round';
  const heavy = F.name === 'gou';
  const k = heavy ? 1.6 : 1;
  const A = (type === 'knee' ? 0.07 : type === 'spin' ? 0.12 : type === 'axe' ? 0.14 : 0.09) * k;
  const S = (type === 'knee' ? 0.07 : type === 'spin' ? 0.16 : 0.09) * k;
  const H = 0.04;
  const R = (type === 'spin' ? 0.28 : 0.2) * k;
  const tA = t + A, tC = tA + S, tH = tC + H, tE = tH + R;
  const g = st.guard;
  const legLen = heavy ? 1.12 : 0.92;
  const h = o.height ?? (o.target === 'head' ? st.headY - 0.05 : o.target === 'gut' ? 1.05 : 1.3) * (heavy ? 1.1 : 1);
  const support = os;
  const sup = g['stance' + support];
  // chamber
  const chamber = type === 'knee' ? [sx * 0.08, 0.75, 0.25] : type === 'axe' ? [sx * 0.05, 1.3, 0.35] : type === 'spin' ? [sx * 0.2, 0.6, -0.3] : [sx * 0.15, 0.7, 0.2];
  const spinYaw = type === 'spin' ? F.yaw + 180 * (o.dirSign ?? 1) : F.yaw;
  F.key(tA, {
    ['ikFoot' + s]: chamber, ['ikFoot' + s + 'w']: 1, ['poleFoot' + s]: type === 'round' ? [sx * 1, 0.2, 0.4] : [sx * 0.2, 0, 1],
    hipY: g.hipY + 0.02, hips: [type === 'axe' ? -8 : 4, type === 'round' ? g.hips[1] - 40 * sx : g.hips[1], 0], spine: [type === 'round' ? -6 : 6, 0, sx * 6], chest: [0, 10, 0],
    ['stance' + support]: [sup[0] * 0.3, 0, 0.02], ['footYaw' + support]: type === 'round' ? -sx * 70 : 0,
  }, 'outQuad');
  // extension
  let ext;
  if (type === 'knee') ext = [sx * 0.05, h - 0.25, 0.45];
  else if (type === 'front') ext = [sx * 0.05, h, legLen * 0.95];
  else if (type === 'side') ext = [sx * 0.1, h, legLen * 1.02];
  else if (type === 'axe') ext = [sx * 0.05, h * 0.85, legLen * 0.7];
  else if (type === 'spin') ext = [sx * 0.05, h, legLen];
  else ext = [sx * 0.15, h, legLen * 0.9];
  const tilt = type === 'side' || type === 'round' ? [0, sx * -28] : type === 'spin' ? [0, sx * -22] : [0, 0];
  F.key(tC, {
    ['ikFoot' + s]: ext, ['poleFoot' + s]: type === 'side' || type === 'round' ? [sx * 0.2, 1, 0] : [sx * 0.2, 0.3, 1],
    hips: [type === 'axe' ? -20 : 0, type === 'round' ? g.hips[1] - 90 * sx : type === 'side' ? g.hips[1] - 80 * sx : g.hips[1], 0],
    spine: [type === 'side' || type === 'round' ? -10 : 8, 0, sx * 14], chest: [0, 18 * sx, 0], tilt, head: [0, 20 * sx, 0],
    ['ikHand' + s]: [sx * 0.3, 1.0, -0.35], ['ikHand' + os]: [-sx * 0.15, st.shoulderY - 0.05, 0.25], yaw: spinYaw,
  }, 'strike');
  F.key(tH, { ['ikFoot' + s]: ext }, 'linear');
  F.key(tE - R * 0.35, { ['ikFoot' + s]: chamber, tilt: [0, 0] }, 'inOutQuad');
  guard(F, tE, 'inOutQuad', { ['ikFoot' + s + 'w']: 0, yaw: spinYaw });
  return { contact: tC, end: tE, side: s, foot: 'foot.' + s };
}

// defensive block: forearms/gauntlets up in front of the face (or crossed low)
export function block(F, t, dur, o = {}) {
  const st = styleOf(F), g = st.guard;
  const y = o.low ? st.shoulderY - 0.4 : st.shoulderY + 0.05;
  F.key(t + 0.06, {
    ikHandL: [0.06, y, 0.3], ikHandR: [-0.06, y + 0.04, 0.28], poleL: [1, -0.2, -0.2], poleR: [-1, -0.2, -0.2],
    hips: [8, g.hips[1] * 0.5, 0], spine: [14, 0, 0], chest: [10, 0, 0], head: [10, 0, 0], hipY: g.hipY - 0.06,
  }, 'snap');
  if (!o.noReturn) guard(F, t + dur, 'inOutQuad');
  return t + dur;
}

// slip / duck under a strike
export function slip(F, t, o = {}) {
  const st = styleOf(F), g = st.guard;
  const dir = o.dir ?? 1; // +1 = to the character's left
  const dur = o.dur ?? 0.22;
  F.key(t + dur * 0.35, {
    hipY: g.hipY - (o.duck ? 0.35 : 0.12), hipOff: [dir * 0.18, 0, -0.05], spine: [o.duck ? 32 : 14, 0, dir * 14], chest: [10, 0, dir * 10], head: [0, 0, dir * 8],
    ikHandL: [0.14, st.shoulderY - 0.15, 0.3], ikHandR: [-0.1, st.shoulderY - 0.1, 0.25],
  }, 'outCubic');
  guard(F, t + dur, 'inOutQuad');
  return t + dur;
}

// procedural hit pose: head snap / gut fold / spin. Spring impulses applied at runtime.
export function react(F, t, o = {}) {
  const st = styleOf(F), g = st.guard;
  const part = o.part || 'head';
  const str = o.strength ?? 1;
  const dur = (o.dur ?? 0.35) * (F.name === 'gou' ? 1.2 : 1);
  if (part === 'head') F.key(t + 0.04, { head: [-35 * str, (o.side ?? 0) * 30, (o.side ?? 0) * 12], neck: [-18 * str, 0, 0], chest: [-8 * str, 0, 0], jaw: 0.8, hipY: g.hipY + 0.03 }, 'snap');
  else if (part === 'gut') F.key(t + 0.05, { spine: [40 * str, 0, 0], chest: [22 * str, 0, 0], head: [18, 0, 0], hipOff: [0, 0, -0.18 * str], hipY: g.hipY - 0.12, jaw: 1, ikHandL: [0.12, 1.1, 0.25], ikHandR: [-0.12, 1.15, 0.22] }, 'snap');
  else if (part === 'chest') F.key(t + 0.04, { chest: [-22 * str, 0, 0], spine: [-10 * str, 0, 0], head: [-15, 0, 0], jaw: 0.6 }, 'snap');
  if (!o.noReturn) guard(F, t + dur, 'inOutQuad');
  return t + dur;
}

// Airborne flight along a ballistic-ish arc from the current position. Body tumbles/stretches.
export function fly(F, t, to, dur, o = {}) {
  const from = F.pos.slice();
  const h = o.arc ?? 1.5;
  const n = 6;
  const spin = o.spin ?? 0; // full rotations (pitch)
  const roll = o.roll ?? 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = from[0] + (to[0] - from[0]) * u;
    const z = from[2] + (to[2] - from[2]) * u;
    const y = from[1] + ((to[1] ?? 0) - from[1]) * u + 4 * h * u * (1 - u);
    F.key(t + dur * u, { pos: [x, Math.max(0, y), z] }, o.ease === 'linear' || i > 0 ? 'linear' : 'linear');
  }
  if (spin || roll) {
    F.key(t, { tilt: [0, 0] }, 'linear');
    F.key(t + dur, { tilt: [spin * 360, roll * 360] }, o.spinEase ?? 'outQuad');
  }
  // limbs trail (flung pose)
  const pose = o.pose ?? 'flung';
  if (pose === 'flung') F.key(t + Math.min(0.08, dur * 0.3), {
    feet: 'fk', ikHandLw: 0, ikHandRw: 0, 'upperarm.L': [-30, 0, 70], 'upperarm.R': [-30, 0, -70], 'forearm.L': [-30, 0, 0], 'forearm.R': [-40, 0, 0],
    'thigh.L': [-20, 0, 10], 'thigh.R': [10, 0, -8], 'shin.L': [40, 0, 0], 'shin.R': [70, 0, 0], spine: [-20, 0, 0], chest: [-18, 0, 0], head: [-25, 0, 0], jaw: 0.7, look: 0.2,
  }, 'outQuad');
  else if (pose === 'tuck') F.key(t + Math.min(0.08, dur * 0.3), {
    feet: 'fk', ikHandLw: 0.6, ikHandRw: 0.6, ikHandL: [0.15, 1.2, 0.25], ikHandR: [-0.15, 1.2, 0.25], 'thigh.L': [-95, 0, 8], 'thigh.R': [-95, 0, -8], 'shin.L': [120, 0, 0], 'shin.R': [120, 0, 0], spine: [30, 0, 0], chest: [20, 0, 0], head: [20, 0, 0], hipY: 0,
  }, 'outQuad');
  else if (pose === 'dive') F.key(t + Math.min(0.1, dur * 0.3), {
    feet: 'fk', ikHandLw: 1, ikHandRw: 1, ikHandL: [0.05, 1.5, 0.9], ikHandR: [-0.05, 1.5, 0.9], 'thigh.L': [15, 0, 4], 'thigh.R': [22, 0, -4], 'shin.L': [20, 0, 0], 'shin.R': [35, 0, 0], spine: [10, 0, 0],
  }, 'outQuad');
  F.key(t + dur, { pos: [to[0], to[1] ?? 0, to[2]] }, 'linear');
  return t + dur;
}

// land from the air (absorb): crouch then rise to guard
export function land(F, t, o = {}) {
  const st = styleOf(F), g = st.guard;
  F.key(t, { feet: 'plant', tilt: [0, 0] }, 'step');
  F.key(t + 0.001, { hipY: g.hipY - (o.deep ? 0.45 : 0.25), spine: [28, 0, 0], chest: [14, 0, 0], head: [-10, 0, 0],
    ikHandLw: 1, ikHandRw: 1, ikHandL: [0.3, o.deep ? 0.35 : 0.9, 0.35], ikHandR: [-0.3, 0.95, 0.1], 'upperarm.L': [0, 0, 0], 'upperarm.R': [0, 0, 0], 'thigh.L': [0, 0, 0], 'thigh.R': [0, 0, 0], 'shin.L': [0, 0, 0], 'shin.R': [0, 0, 0], jaw: 0.2 }, 'snap');
  guard(F, t + (o.recover ?? 0.35), 'inOutQuad');
  return t + (o.recover ?? 0.35);
}

// skid backwards (pushed by a block) with feet sliding; ends in guard
export function skid(F, t, dist, dur, o = {}) {
  const st = styleOf(F), g = st.guard;
  const b = F.fwd(-dist);
  const to = [F.pos[0] + b[0], F.pos[1], F.pos[2] + b[2]];
  F.key(t, { pos: F.pos.slice(), feet: 'slide' }, 'linear');
  F.key(t + 0.03, { hipY: g.hipY - 0.1, spine: [18, 0, 0], chest: [10, 0, 0] }, 'snap');
  F.key(t + dur, { pos: to }, 'outCubic');
  F.key(t + dur + 0.01, { feet: 'plant' }, 'step');
  guard(F, t + dur + 0.15, 'inOutQuad');
  return t + dur;
}

// power-up / charge stance
export function charge(F, t, dur, o = {}) {
  const st = styleOf(F), g = st.guard;
  const tall = F.name === 'gou';
  F.key(t + dur * 0.3, {
    hipY: g.hipY - (tall ? 0.25 : 0.18), stanceL: [0.3, 0, 0.22], stanceR: [-0.3, 0, -0.22], hips: [10, 0, 0], spine: [-6, 0, 0], chest: [-12, 0, 0], head: [-18, 0, 0], jaw: o.roar ? 1 : 0.2,
    ikHandL: [0.45, 1.05, 0.15], ikHandR: [-0.45, 1.05, 0.15], poleL: [1, -0.5, -0.5], poleR: [-1, -0.5, -0.5], fistL: 1, fistR: 1,
  }, 'inOutCubic');
  F.key(t + dur, { chest: [-18, 0, 0], head: [-25, 0, 0] }, 'inOutSine');
  return t + dur;
}

// Procedural run: alternating FK stride keyed per half-cycle, root moves linearly with ease-in.
// Returns footfall times (for dust/crack events).
export function run(F, t, to, dur, o = {}) {
  const heavy = F.name === 'gou';
  const freq = o.freq ?? (heavy ? 2.6 : 3.6);
  const half = 1 / (freq * 2);
  const n = Math.max(2, Math.round(dur / half));
  const from = F.pos.slice();
  const yaw = o.yaw ?? F.yawTo(to[0], to[2]);
  F.key(t, { pos: from, yaw, feet: 'fk', ikHandLw: 0, ikHandRw: 0, tilt: [0, 0] }, 'outQuad');
  const falls = [];
  const lean = o.lean ?? (heavy ? 22 : 30);
  for (let i = 0; i <= n; i++) {
    const tt = t + (i / n) * dur;
    const u = i / n;
    const e = o.accel ? u * u * (3 - 2 * u) * 0.35 + u * 0.65 : u;
    const L = i % 2 === 0;
    const sw = heavy ? 48 : 58;
    F.key(tt, {
      pos: [from[0] + (to[0] - from[0]) * e, from[1], from[2] + (to[2] - from[2]) * e],
      hipY: -0.06 - (i % 2 ? 0.02 : 0.08) * (heavy ? 1.3 : 1), spine: [lean, 0, 0], chest: [lean * 0.35, L ? 12 : -12, 0], hips: [0, L ? -10 : 10, 0], head: [-lean * 0.7, 0, 0],
      'thigh.L': [L ? -sw : sw * 0.55, 0, 3], 'thigh.R': [L ? sw * 0.55 : -sw, 0, -3],
      'shin.L': [L ? 35 : 95, 0, 0], 'shin.R': [L ? 95 : 35, 0, 0],
      'foot.L': [L ? -10 : 30, 0, 0], 'foot.R': [L ? 30 : -10, 0, 0],
      'upperarm.L': [L ? 45 : -60, 0, 14], 'upperarm.R': [L ? -60 : 45, 0, -14], 'forearm.L': [-80, 0, 0], 'forearm.R': [-80, 0, 0],
      jaw: heavy ? 0.3 : 0,
    }, 'inOutSine');
    if (i > 0) falls.push(tt);
  }
  F.key(t + dur + 0.02, { feet: 'plant' }, 'step');
  return { end: t + dur, falls };
}

// Big leap along an arc with a tucked flip; returns landing time
export function leap(F, t, to, height, dur, o = {}) {
  F.key(t, { hipY: -0.3, spine: [25, 0, 0] }, 'outQuad');
  fly(F, t + (o.crouch ?? 0.08), to, dur, { arc: height, spin: o.flips ?? 0, pose: o.pose ?? 'tuck', spinEase: 'inOutSine' });
  return t + (o.crouch ?? 0.08) + dur;
}

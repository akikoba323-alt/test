// Parametric hero buildings built from destructible elements.
import { EL, ElementStore } from './elements.js';
import { KIND } from './archmat.js';
import { RNG } from '../core/rng.js';

const lin = (r, g, b) => [Math.pow(r / 255, 2.2), Math.pow(g / 255, 2.2), Math.pow(b / 255, 2.2)];
const WHITE = [1, 1, 1];

export class Building {
  constructor(ctx, P) {
    this.P = P;
    this.name = P.name;
    this.id = P.id;
    this.rng = new RNG(P.seed || 1);
    this.store = new ElementStore(ctx, P.capacity || { arch: 20000, glassO: 8000, glassT: 2500 });
    this.store.bldId = P.id;
    this.levels = []; // { y (floor top), h (to next), index }
    this.bounds = null;
    this.hero = new Set(P.heroFloors || []);
  }
  add(layer, cx, cy, cz, sx, sy, sz, kind, tint, meta = {}) {
    meta.bld = this.id;
    if (meta.seed === undefined) meta.seed = this.rng.next();
    return this.store.add(layer, cx, cy, cz, sx, sy, sz, kind, tint, meta);
  }
  seal() {
    this.store.seal();
    const P = this.P;
    this.bounds = [P.x0, 0, P.z0, P.x1, this.topY + 12, P.z1];
  }
  // height of the highest intact floor surface below y at (x, z), or null if outside
  floorAt(x, y, z) {
    const P = this.P;
    if (!this.slabIds || x < P.x0 || x > P.x1 || z < P.z0 || z > P.z1) return null;
    const i = Math.min(this.nx - 1, Math.max(0, Math.floor((x - P.x0) / this.bay[0])));
    const j = Math.min(this.nz - 1, Math.max(0, Math.floor((z - P.z0) / this.bay[1])));
    let L = this.levels.length - 1;
    while (L > 0 && this.yOf(L) > y + 0.05) L--;
    for (; L >= 0; L--) {
      const id = this.slabIds[L] ? this.slabIds[L][i * this.nz + j] : -1;
      if (id >= 0 && this.store.state[id] !== 2) return L === 0 ? 0.12 : this.yOf(L);
    }
    return 0;
  }
}

// Generic framed tower: slab panels per bay, columns, core, facade (curtain wall, punched
// windows or open frame), optional interiors on hero floors.
export function buildTower(ctx, P) {
  const b = new Building(ctx, P);
  const r = b.rng;
  const { x0, z0, x1, z1 } = P;
  const nx = P.bays[0], nz = P.bays[1];
  const W = x1 - x0, D = z1 - z0, bw = W / nx, bd = D / nz;
  const levels = P.floors;
  const yOf = (L) => (L === 0 ? 0 : (P.lobbyH ?? P.floorH) + (L - 1) * P.floorH);
  b.yOf = yOf;
  b.bay = [bw, bd];
  b.slabIds = [];
  b.nx = nx; b.nz = nz;
  const topY = yOf(levels);
  b.topY = topY;
  const slabT = 0.3;
  const colS = P.colSize ?? 0.8;
  const coreW = P.core ? P.core[0] : 0, coreD = P.core ? P.core[1] : 0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const facadeInset = 0.35;
  const skipFacade = P.facade === 'open';
  for (let L = 0; L <= levels; L++) {
    const y = yOf(L), yn = L < levels ? yOf(L + 1) : y;
    const h = yn - y;
    const floorMeta = { floor: L };
    b.levels.push({ y, h, index: L });
    // slab panels (the lobby floor is a stone slab on grade)
    const ids = [];
    b.slabIds.push(ids);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const sx = x0 + (i + 0.5) * bw, sz = z0 + (j + 0.5) * bd;
      if (L === 0) {
        ids[i * nz + j] = b.add(EL.ARCH, sx, 0.06, sz, bw, 0.12, bd, P.lobbyFloorKind ?? KIND.STONE, P.lobbyFloorTint ?? lin(190, 186, 178), { ...floorMeta, flags: 1 });
      } else {
        if (P.partialTop && L === levels && (i + j) % 3 === 0) { ids[i * nz + j] = -1; continue; }
        ids[i * nz + j] = b.add(EL.ARCH, sx, y - slabT / 2, sz, bw, slabT, bd, KIND.SLAB, P.carpet ?? lin(92, 96, 104), { ...floorMeta, flags: 1 });
      }
    }
    if (L === levels) {
      // roof: parapet
      if (P.parapet !== false) {
        const pt = 0.3, ph = 1.3;
        b.add(EL.ARCH, cx, y + ph / 2, z0 + pt / 2, W, ph, pt, KIND.CLADDING, P.cladTint, floorMeta);
        b.add(EL.ARCH, cx, y + ph / 2, z1 - pt / 2, W, ph, pt, KIND.CLADDING, P.cladTint, floorMeta);
        b.add(EL.ARCH, x0 + pt / 2, y + ph / 2, cz, pt, ph, D, KIND.CLADDING, P.cladTint, floorMeta);
        b.add(EL.ARCH, x1 - pt / 2, y + ph / 2, cz, pt, ph, D, KIND.CLADDING, P.cladTint, floorMeta);
      }
      break;
    }
    // columns
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      let px = x0 + i * bw, pz = z0 + j * bd;
      const perim = i === 0 || j === 0 || i === nx || j === nz;
      if (perim && !skipFacade) { px = Math.min(Math.max(px, x0 + facadeInset + colS / 2 + 0.25), x1 - facadeInset - colS / 2 - 0.25); pz = Math.min(Math.max(pz, z0 + facadeInset + colS / 2 + 0.25), z1 - facadeInset - colS / 2 - 0.25); }
      const lobbyCol = L === 0 && P.lobbyH;
      const s = lobbyCol ? colS * 1.25 : colS;
      b.add(EL.ARCH, px, y + (h - slabT) / 2, pz, s, h - slabT, s, lobbyCol ? KIND.STONE : KIND.CONCRETE, lobbyCol ? lin(200, 196, 188) : WHITE, { ...floorMeta, flags: 2 });
      if (P.rebarTop && L === levels - 1) {
        for (let k = 0; k < 4; k++) b.add(EL.ARCH, px + (k & 1 ? 0.25 : -0.25), yn + 0.6, pz + (k & 2 ? 0.25 : -0.25), 0.03, 1.4 + r.next() * 0.8, 0.03, KIND.STEEL, lin(90, 60, 45), floorMeta);
      }
    }
    // core
    if (P.core) {
      const t = 0.35, hh = h - slabT;
      b.add(EL.ARCH, cx, y + hh / 2, cz - coreD / 2 + t / 2, coreW, hh, t, KIND.CONCRETE, WHITE, { ...floorMeta, flags: 2 });
      b.add(EL.ARCH, cx, y + hh / 2, cz + coreD / 2 - t / 2, coreW, hh, t, L === 0 ? KIND.ALU : KIND.CONCRETE, L === 0 ? lin(150, 146, 140) : WHITE, { ...floorMeta, flags: 2 });
      b.add(EL.ARCH, cx - coreW / 2 + t / 2, y + hh / 2, cz, t, hh, coreD, KIND.CONCRETE, WHITE, { ...floorMeta, flags: 2 });
      b.add(EL.ARCH, cx + coreW / 2 - t / 2, y + hh / 2, cz, t, hh, coreD, KIND.CONCRETE, WHITE, { ...floorMeta, flags: 2 });
      // corridor-side drywall around the core on office floors
      if (L > 0 && P.interiorWalls !== false) {
        const ww = 0.12, off = 1.8;
        b.add(EL.ARCH, cx, y + hh / 2, cz - coreD / 2 - off, coreW + 2 * off, hh, ww, KIND.DRYWALL, lin(214, 210, 200), floorMeta);
        b.add(EL.ARCH, cx, y + hh / 2, cz + coreD / 2 + off, coreW + 2 * off, hh, ww, KIND.DRYWALL, lin(214, 210, 200), floorMeta);
      }
    }
    if (!skipFacade) buildFacade(b, P, L, y, h, floorMeta);
    if (b.hero.has(L) || (P.sparseInterior && L > 0 && r.next() < P.sparseInterior)) buildInterior(b, P, L, y, h, b.hero.has(L));
  }
  if (P.roofItems) buildRoof(b, P, topY);
  b.seal();
  return b;
}

function buildFacade(b, P, L, y, h, meta) {
  const { x0, z0, x1, z1 } = P;
  const sides = [
    // [ax, az (along), nx, nz (outward), length, start]
    { along: [1, 0], out: [0, -1], len: x1 - x0, ox: x0, oz: z0, rot: 0 },
    { along: [1, 0], out: [0, 1], len: x1 - x0, ox: x0, oz: z1, rot: 0 },
    { along: [0, 1], out: [-1, 0], len: z1 - z0, ox: x0, oz: z0, rot: Math.PI / 2 },
    { along: [0, 1], out: [1, 0], len: z1 - z0, ox: x1, oz: z0, rot: Math.PI / 2 },
  ];
  const lobby = L === 0 && P.lobbyH;
  const heroFloor = b.hero.has(L);
  for (const s of sides) {
    const nb = Math.max(1, Math.round(s.len / (P.paneW ?? 1.5)));
    const pw = s.len / nb;
    const spandH = P.spandrel ?? 1.1;
    const glassH = lobby ? h - 0.9 : h - spandH;
    const gy = lobby ? y + 0.1 + glassH / 2 : y + spandH / 2 + glassH / 2 - 0.05;
    const plane = 0.05;
    const fx = s.ox + s.out[0] * plane, fz = s.oz + s.out[1] * plane;
    // spandrel band at slab edge
    if (!lobby && P.facade !== 'punched') {
      const sy = y - 0.3 + spandH / 2 - 0.05;
      for (let k = 0; k < nb; k += Math.max(1, Math.round(6 / pw))) {
        const span = Math.min(Math.max(1, Math.round(6 / pw)), nb - k);
        const c = (k + span / 2) * pw;
        b.add(EL.ARCH, fx + s.along[0] * c + s.out[0] * 0.08, sy, fz + s.along[1] * c + s.out[1] * 0.08, span * pw, spandH, 0.12, KIND.CLADDING, P.spandTint ?? P.cladTint, { ...meta, rotY: s.rot, flags: 4 });
      }
    }
    if (P.facade === 'punched') {
      // masonry wall with punched windows
      const winW = pw * 0.55, sill = 0.9, winH = Math.min(h - 1.3, 1.6);
      for (let k = 0; k < nb; k++) {
        const c = (k + 0.5) * pw;
        const px = fx + s.along[0] * c, pz = fz + s.along[1] * c;
        const wallK = P.wallKind ?? KIND.CLADDING;
        // piers left/right and spandrels below/above
        const pier = (pw - winW) / 2;
        for (const sgn of [-1, 1]) {
          const o = sgn * (winW / 2 + pier / 2);
          b.add(EL.ARCH, px + s.along[0] * o + s.out[0] * 0.1, y + h / 2, pz + s.along[1] * o + s.out[1] * 0.1, pier, h, 0.25, wallK, P.cladTint, { ...meta, rotY: s.rot, flags: 4 });
        }
        b.add(EL.ARCH, px + s.out[0] * 0.1, y + sill / 2, pz + s.out[1] * 0.1, winW, sill, 0.25, wallK, P.cladTint, { ...meta, rotY: s.rot, flags: 4 });
        const topH = h - sill - winH;
        b.add(EL.ARCH, px + s.out[0] * 0.1, y + sill + winH + topH / 2, pz + s.out[1] * 0.1, winW, topH, 0.25, wallK, P.cladTint, { ...meta, rotY: s.rot, flags: 4 });
        b.add(heroFloor ? EL.GLASS_T : EL.GLASS_O, px + s.out[0] * 0.02, y + sill + winH / 2, pz + s.out[1] * 0.02, winW, winH, 0.03, 0, P.glassTint, { ...meta, rotY: s.rot, depth: 4.5, flags: 8 });
        if (P.balconies && s.out[1] === -1 && L > 0 && L % 1 === 0) {
          // balcony slab + railing + AC unit
          const bx = px + s.out[0] * 0.8, bz = pz + s.out[1] * 0.8;
          b.add(EL.ARCH, bx, y - 0.1, bz, pw * 0.9, 0.2, 1.4, KIND.CONCRETE, WHITE, { ...meta, rotY: s.rot });
          b.add(EL.ARCH, bx + s.out[0] * 0.7, y + 0.55, bz + s.out[1] * 0.7, pw * 0.9, 1.1, 0.05, KIND.ALU, lin(170, 172, 170), { ...meta, rotY: s.rot });
          if (b.rng.next() < 0.6) b.add(EL.ARCH, bx + s.along[0] * pw * 0.3, y + 0.35, bz + s.along[1] * pw * 0.3, 0.8, 0.6, 0.3, KIND.PLASTIC, lin(210, 208, 200), { ...meta, rotY: s.rot });
        }
      }
      continue;
    }
    // curtain wall: panes + mullions
    for (let k = 0; k < nb; k++) {
      const c = (k + 0.5) * pw;
      const px = fx + s.along[0] * c, pz = fz + s.along[1] * c;
      const layer = lobby || heroFloor ? EL.GLASS_T : EL.GLASS_O;
      b.add(layer, px, gy, pz, pw - 0.06, glassH, 0.03, 0, P.glassTint, { ...meta, rotY: s.rot, depth: 5 + b.rng.next() * 3, flags: 8 });
      const mx = s.ox + s.out[0] * 0.1 + s.along[0] * k * pw, mz = s.oz + s.out[1] * 0.1 + s.along[1] * k * pw;
      b.add(EL.ARCH, mx, y + h / 2 - 0.15, mz, 0.07, h, 0.2, KIND.ALU, P.mullionTint ?? lin(60, 64, 70), { ...meta, rotY: s.rot, flags: 16 });
    }
    if (lobby) {
      // canopy over the entrance
      if (P.canopy && s.out[1] === 1) {
        const c = s.len / 2;
        b.add(EL.ARCH, fx + s.along[0] * c + s.out[0] * 2.5, y + 4.4, fz + s.along[1] * c + s.out[1] * 2.5, 18, 0.35, 5, KIND.ALU, lin(50, 52, 56), { ...meta, rotY: s.rot });
      }
    }
  }
}

function buildInterior(b, P, L, y, h, dense) {
  const r = b.rng;
  const { x0, z0, x1, z1 } = P;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const coreW = P.core ? P.core[0] + 4 : 0, coreD = P.core ? P.core[1] + 4 : 0;
  const meta = { floor: L };
  if (L === 0 && P.lobbyH) {
    // lobby: reception desk, benches, planters, turnstiles
    b.add(EL.ARCH, cx, 0.6, cz + coreD / 2 + 4, 8, 1.1, 1.2, KIND.STONE, lin(40, 38, 36), meta);
    for (let i = -3; i <= 3; i++) b.add(EL.ARCH, cx + i * 1.4, 0.55, cz + coreD / 2 + 1.2, 0.2, 1.0, 1.2, KIND.ALU, lin(180, 180, 185), meta);
    for (let i = 0; i < 6; i++) {
      const px = x0 + 5 + i * (x1 - x0 - 10) / 5, pz = z1 - 5;
      b.add(EL.ARCH, px, 0.45, pz, 1.4, 0.9, 1.4, KIND.STONE, lin(120, 116, 110), meta);
      b.add(EL.ARCH, px, 1.2, pz, 1.1, 0.8, 1.1, KIND.PLASTIC, lin(40, 70, 36), meta);
    }
    for (let i = 0; i < 4; i++) b.add(EL.ARCH, x0 + 8 + i * 8, 0.25, cz + 3, 3, 0.45, 0.8, KIND.WOOD, lin(120, 84, 56), meta);
    return;
  }
  const n = dense ? 1 : 0.35;
  const desk = lin(170, 160, 150), chair = lin(30, 30, 34), mon = lin(20, 20, 22);
  for (let px = x0 + 3; px < x1 - 3; px += 3.2) {
    for (let pz = z0 + 3; pz < z1 - 3; pz += 2.2) {
      if (Math.abs(px - cx) < coreW / 2 + 1.5 && Math.abs(pz - cz) < coreD / 2 + 1.5) continue;
      if (r.next() > n) continue;
      b.add(EL.ARCH, px, y + 0.73, pz, 1.6, 0.05, 0.8, KIND.WOOD, desk, meta);
      b.add(EL.ARCH, px - 0.7, y + 0.36, pz, 0.05, 0.72, 0.75, KIND.PLASTIC, lin(60, 60, 64), meta);
      b.add(EL.ARCH, px + 0.7, y + 0.36, pz, 0.05, 0.72, 0.75, KIND.PLASTIC, lin(60, 60, 64), meta);
      b.add(EL.ARCH, px + (r.next() - 0.5) * 0.6, y + 0.98, pz - 0.2, 0.55, 0.36, 0.04, KIND.SIGN, [0.02, 0.03, 0.05], meta);
      b.add(EL.ARCH, px + (r.next() - 0.5) * 0.3, y + 0.5, pz + 0.6, 0.5, 0.9, 0.5, KIND.PLASTIC, chair, meta);
      if (r.next() < 0.3) b.add(EL.ARCH, px, y + 0.6, pz - 0.45, 1.6, 1.2, 0.05, KIND.PLASTIC, lin(90, 98, 110), meta);
    }
  }
  // glass meeting room partitions near the core
  if (dense && P.core) {
    b.add(EL.GLASS_T, cx - coreW / 2 - 3, y + (h - 0.3) / 2, cz, 0.03, h - 0.3, 6, 0, [0.8, 0.9, 0.9], { ...meta, rotY: 0, depth: 2 });
  }
}

function buildRoof(b, P, y) {
  const r = b.rng;
  const { x0, z0, x1, z1 } = P;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const meta = { floor: P.floors };
  // mechanical penthouse over the core
  if (P.core) b.add(EL.ARCH, cx, y + 2.5, cz, P.core[0] + 2, 5, P.core[1] + 2, KIND.CLADDING, P.cladTint, meta);
  // AC units, ducts
  for (let i = 0; i < 10; i++) {
    const px = x0 + 4 + r.next() * (x1 - x0 - 8), pz = z0 + 4 + r.next() * (z1 - z0 - 8);
    if (P.core && Math.abs(px - cx) < P.core[0] / 2 + 3 && Math.abs(pz - cz) < P.core[1] / 2 + 3) continue;
    b.add(EL.ARCH, px, y + 0.9, pz, 2.2, 1.8, 1.6, KIND.STEEL, lin(150, 152, 150), meta);
  }
  // water tank on legs
  if (P.waterTank) {
    const tx = x0 + 7, tz = z1 - 7;
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) b.add(EL.ARCH, tx + dx, y + 1.5, tz + dz, 0.25, 3, 0.25, KIND.STEEL, lin(80, 80, 80), meta);
    b.add(EL.ARCH, tx, y + 5, tz, 4.4, 4, 4.4, KIND.STEEL, lin(190, 188, 180), { ...meta, flags: 32 });
  }
  // antenna mast
  if (P.antenna) {
    b.add(EL.ARCH, cx + 4, y + 5 + P.antenna / 2, cz, 0.5, P.antenna, 0.5, KIND.STEEL, lin(200, 60, 50), meta);
    for (let k = 1; k < 4; k++) b.add(EL.ARCH, cx + 4, y + 5 + k * P.antenna / 4, cz, 2.2, 0.12, 0.12, KIND.STEEL, lin(200, 200, 200), meta);
  }
  // helipad slab
  if (P.helipad) b.add(EL.ARCH, x0 + 12, y + 0.2, z0 + 12, 16, 0.4, 16, KIND.CONCRETE, lin(70, 72, 76), meta);
}

// Tower crane: lattice mast, jib, counter-jib, cab, counterweights. Steel members as elements.
export function buildCrane(ctx, P) {
  const b = new Building(ctx, { ...P, capacity: { arch: 3000, glassO: 50, glassT: 50 } });
  const { x, z, height, jibLen, cjLen, dir } = P;
  const s = 2.4, seg = 3.0;
  const yellow = lin(236, 176, 30);
  const m = { floor: 0, flags: 64 };
  b.topY = height + 8;
  for (let yy = 0; yy < height; yy += seg) {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(EL.ARCH, x + dx * s / 2, yy + seg / 2, z + dz * s / 2, 0.22, seg, 0.22, KIND.STEEL, yellow, { ...m, floor: Math.floor(yy / seg) });
    // horizontal braces
    b.add(EL.ARCH, x, yy + 0.1, z - s / 2, s, 0.12, 0.12, KIND.STEEL, yellow, { ...m, floor: Math.floor(yy / seg) });
    b.add(EL.ARCH, x, yy + 0.1, z + s / 2, s, 0.12, 0.12, KIND.STEEL, yellow, { ...m, floor: Math.floor(yy / seg) });
    b.add(EL.ARCH, x - s / 2, yy + 0.1, z, 0.12, 0.12, s, KIND.STEEL, yellow, { ...m, floor: Math.floor(yy / seg) });
    b.add(EL.ARCH, x + s / 2, yy + 0.1, z, 0.12, 0.12, s, KIND.STEEL, yellow, { ...m, floor: Math.floor(yy / seg) });
  }
  // slewing unit + cab
  const top = height;
  b.add(EL.ARCH, x, top + 0.6, z, 3.4, 1.2, 3.4, KIND.STEEL, yellow, m);
  b.add(EL.ARCH, x + dir[0] * 2.2, top + 2.0, z + dir[1] * 2.2 + 1.2, 2.0, 2.2, 2.0, KIND.STEEL, lin(220, 220, 220), m);
  b.add(EL.GLASS_O, x + dir[0] * 3.25, top + 2.1, z + dir[1] * 2.2 + 1.2, 1.8, 1.6, 0.03, 0, [0.6, 0.7, 0.75], { ...m, rotY: Math.PI / 2 });
  // apex tower
  b.add(EL.ARCH, x, top + 7, z, 0.4, 11, 0.4, KIND.STEEL, yellow, m);
  // jib (triangular lattice approximated by 3 chords + diagonals)
  const jy = top + 1.8;
  const segs = Math.floor(jibLen / seg);
  for (let i = 0; i < segs; i++) {
    const d0 = 2 + i * seg + seg / 2;
    const px = x + dir[0] * d0, pz = z + dir[1] * d0;
    const rot = Math.atan2(dir[1], dir[0]);
    b.add(EL.ARCH, px, jy, pz + 0.8, seg, 0.14, 0.14, KIND.STEEL, yellow, { ...m, rotY: -rot, floor: 100 + i });
    b.add(EL.ARCH, px, jy, pz - 0.8, seg, 0.14, 0.14, KIND.STEEL, yellow, { ...m, rotY: -rot, floor: 100 + i });
    b.add(EL.ARCH, px, jy + 1.6, pz, seg, 0.14, 0.14, KIND.STEEL, yellow, { ...m, rotY: -rot, floor: 100 + i });
    b.add(EL.ARCH, px, jy + 0.8, pz + 0.4, 0.1, 1.8, 0.1, KIND.STEEL, yellow, { ...m, floor: 100 + i });
  }
  // tie cables (thin rods from apex to jib)
  for (const frac of [0.45, 0.85]) {
    const d = jibLen * frac;
    const mx = x + dir[0] * d / 2, mz = z + dir[1] * d / 2;
    const len = Math.hypot(d, 10);
    const rot = Math.atan2(dir[1], dir[0]);
    const el = b.add(EL.ARCH, mx, top + 7.5, mz, len, 0.05, 0.05, KIND.STEEL, lin(40, 40, 40), { ...m, rotY: -rot, floor: 200 });
  }
  // counter-jib with counterweights
  const cseg = Math.floor(cjLen / seg);
  for (let i = 0; i < cseg; i++) {
    const d0 = -(2 + i * seg + seg / 2);
    b.add(EL.ARCH, x + dir[0] * d0, jy, z + dir[1] * d0, seg, 0.5, 2.2, KIND.STEEL, yellow, { ...m, rotY: -Math.atan2(dir[1], dir[0]), floor: 150 + i });
  }
  for (let i = 0; i < 4; i++) b.add(EL.ARCH, x - dir[0] * (cjLen - 2) , jy - 1.6 - i * 0.2, z - dir[1] * (cjLen - 2) + (i - 1.5) * 1.1, 2.0, 2.6, 1.0, KIND.CONCRETE, lin(160, 160, 158), { ...m, floor: 160 });
  // trolley and hook block
  b.hookPos = [x + dir[0] * jibLen * 0.6, jy - 0.6, z + dir[1] * jibLen * 0.6];
  b.add(EL.ARCH, b.hookPos[0], b.hookPos[1], b.hookPos[2], 1.6, 0.6, 1.8, KIND.STEEL, lin(60, 60, 60), { ...m, floor: 170 });
  b.add(EL.ARCH, b.hookPos[0], b.hookPos[1] - 20, b.hookPos[2], 0.05, 40, 0.05, KIND.STEEL, lin(30, 30, 30), { ...m, floor: 171 });
  b.add(EL.ARCH, b.hookPos[0], b.hookPos[1] - 40.5, b.hookPos[2], 0.8, 1.0, 0.6, KIND.STEEL, lin(220, 170, 30), { ...m, floor: 172 });
  b.P.x0 = x - jibLen; b.P.x1 = x + jibLen; b.P.z0 = z - jibLen; b.P.z1 = z + jibLen;
  b.seal();
  b.bounds = [x - jibLen, 0, z - jibLen, x + jibLen, height + 12, z + jibLen];
  return b;
}

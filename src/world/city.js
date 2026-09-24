// City assembly: street grid, sidewalks, hero buildings, crane, props, wires, cars, skyline.
import * as THREE from 'three';
import { ElementStore, EL } from './elements.js';
import { KIND } from './archmat.js';
import { buildTower, buildCrane } from './buildings.js';
import { makeGround, GRID } from './ground.js';
import { Skyline } from './skyline.js';
import { Wires } from './wires.js';
import { Car } from './cars.js';
import { RNG } from '../core/rng.js';

const lin = (r, g, b) => [Math.pow(r / 255, 2.2), Math.pow(g / 255, 2.2), Math.pow(b / 255, 2.2)];

export function blockBounds(i, j) {
  const P = GRID.pitch;
  const x0 = P * i + GRID.streetHalf(i) + GRID.walkSt(i), x1 = P * (i + 1) - GRID.streetHalf(i + 1) - GRID.walkSt(i + 1);
  const z0 = P * j + GRID.avenueHalf(j) + GRID.walkAv(j), z1 = P * (j + 1) - GRID.avenueHalf(j + 1) - GRID.walkAv(j + 1);
  return [x0, z0, x1, z1];
}

export class City {
  constructor(ctx, onProgress = () => {}) {
    this.ctx = ctx;
    this.group = new THREE.Group();
    this.buildings = [];
    this.stores = [];
    this.rng = new RNG(77);
    this.lamps = [];
    this.signals = [];
    this.cars = [];
    this.signs = [];
    this.ground = makeGround(ctx.noise2D);
    this.group.add(this.ground);
    onProgress('streets');
    this.street = new ElementStore(ctx, { arch: 16000, glassO: 200, glassT: 400 });
    this.buildStreets();
    onProgress('buildings');
    this.buildHero();
    onProgress('props');
    this.wires = new Wires();
    this.buildProps();
    this.street.seal();
    this.stores.push(this.street);
    this.group.add(this.street.group);
    this.group.add(this.wires.mesh);
    this.wires.updateGeometry();
    onProgress('skyline');
    this.buildSkyline();
    this.buildCars();
  }

  addBuilding(b) {
    this.buildings.push(b);
    this.stores.push(b.store);
    this.group.add(b.store.group);
    return b;
  }

  // ---------------------------------------------------------------------------------------
  buildStreets() {
    const S = this.street, r = this.rng;
    const paver = lin(150, 146, 140), curb = lin(170, 168, 162);
    const R = 3; // blocks around the center that get destructible sidewalks
    for (let i = -R; i < R; i++) for (let j = -R; j < R; j++) {
      const [x0, z0, x1, z1] = blockBounds(i, j);
      // ring outer bounds = to the road edges
      const ox0 = x0 - GRID.walkSt(i), ox1 = x1 + GRID.walkSt(i + 1), oz0 = z0 - GRID.walkAv(j), oz1 = z1 + GRID.walkAv(j + 1);
      const near = Math.abs(i + 0.5) < 2 && Math.abs(j + 0.5) < 2;
      const seg = near ? 6 : 30;
      const h = 0.15;
      // north & south sidewalk strips (along X)
      for (const [za, zb] of [[oz0, z0], [z1, oz1]]) {
        for (let x = ox0; x < ox1 - 0.01; x += seg) {
          const w = Math.min(seg, ox1 - x);
          S.add(EL.ARCH, x + w / 2, h / 2, (za + zb) / 2, w, h, zb - za, KIND.PAVER, paver, { flags: 1 });
        }
        const zc = za === oz0 ? oz0 + 0.1 : oz1 - 0.1;
        for (let x = ox0; x < ox1 - 0.01; x += seg) { const w = Math.min(seg, ox1 - x); S.add(EL.ARCH, x + w / 2, 0.09, zc, w, 0.18, 0.2, KIND.CONCRETE, curb, {}); }
      }
      // east & west strips (along Z) between the N/S strips
      for (const [xa, xb] of [[ox0, x0], [x1, ox1]]) {
        for (let z = z0; z < z1 - 0.01; z += seg) {
          const w = Math.min(seg, z1 - z);
          S.add(EL.ARCH, (xa + xb) / 2, h / 2, z + w / 2, xb - xa, h, w, KIND.PAVER, paver, { flags: 1 });
        }
        const xc = xa === ox0 ? ox0 + 0.1 : ox1 - 0.1;
        for (let z = z0; z < z1 - 0.01; z += seg) { const w = Math.min(seg, z1 - z); S.add(EL.ARCH, xc, 0.09, z + w / 2, 0.2, 0.18, w, KIND.CONCRETE, curb, {}); }
      }
      // lot surface (plaza) inside the block
      const pl = near ? 4 : 1;
      for (let a = 0; a < pl; a++) for (let c = 0; c < pl; c++) {
        const w = (x1 - x0) / pl, d = (z1 - z0) / pl;
        S.add(EL.ARCH, x0 + (a + 0.5) * w, 0.07, z0 + (c + 0.5) * d, w, 0.14, d, KIND.PAVER, lin(128, 126, 122), { flags: 1 });
      }
    }
  }

  // ---------------------------------------------------------------------------------------
  buildHero() {
    const ctx = this.ctx;
    // T1: 42-level office tower with a double-height lobby (the fight moves inside, up and out)
    this.t1 = this.addBuilding(buildTower(ctx, {
      name: 'KUROGANE TOWER', id: 1, seed: 11, x0: 22, z0: -68, x1: 66, z1: -25, floors: 42, lobbyH: 8, floorH: 4, bays: [5, 5], core: [13, 12],
      facade: 'curtain', paneW: 1.47, glassTint: [0.62, 0.78, 0.82], cladTint: lin(58, 62, 70), spandTint: lin(38, 44, 52), mullionTint: lin(70, 74, 80),
      heroFloors: [0, 12, 13], sparseInterior: 0.25, canopy: true, roofItems: true, waterTank: true, antenna: 18, helipad: true,
      capacity: { arch: 32000, glassO: 14000, glassT: 2400 },
    }));
    // construction frame + tower crane
    this.frame = this.addBuilding(buildTower(ctx, {
      name: 'SITE', id: 2, seed: 12, x0: 78, z0: -66, x1: 110, z1: -30, floors: 18, floorH: 3.8, bays: [4, 4], facade: 'open', partialTop: true, rebarTop: true, parapet: false,
      interiorWalls: false, capacity: { arch: 4000, glassO: 10, glassT: 10 },
    }));
    this.crane = this.addBuilding(buildCrane(ctx, { name: 'CRANE', id: 3, seed: 13, x: 94, z: -74, height: 182, jibLen: 72, cjLen: 22, dir: [-1, 0] }));
    // B3: apartments (meteor target)
    this.b3 = this.addBuilding(buildTower(ctx, {
      name: 'APARTMENTS', id: 4, seed: 14, x0: -68, z0: 28, x1: -24, z1: 60, floors: 12, floorH: 3.2, bays: [6, 4], core: [8, 6],
      facade: 'punched', paneW: 3.6, balconies: true, glassTint: [0.7, 0.75, 0.75], cladTint: lin(196, 186, 168), wallKind: KIND.CLADDING,
      sparseInterior: 0.5, interiorWalls: true, roofItems: true, waterTank: true, capacity: { arch: 14000, glassO: 2500, glassT: 50 },
    }));
    // SE commercial with LED wall
    this.store = this.addBuilding(buildTower(ctx, {
      name: 'COMMERCIAL', id: 5, seed: 15, x0: 22, z0: 26, x1: 70, z1: 64, floors: 10, lobbyH: 6, floorH: 4.6, bays: [5, 4], core: [12, 10],
      facade: 'curtain', paneW: 2.4, glassTint: [0.5, 0.6, 0.62], cladTint: lin(210, 206, 198), spandTint: lin(210, 206, 198), mullionTint: lin(200, 200, 205),
      sparseInterior: 0.4, roofItems: true, capacity: { arch: 8000, glassO: 3000, glassT: 800 },
    }));
    // NW mid-rises with vertical signs along the avenue
    this.m1 = this.addBuilding(buildTower(ctx, {
      name: 'MID1', id: 6, seed: 16, x0: -46, z0: -52, x1: -20, z1: -25, floors: 8, floorH: 3.6, bays: [3, 3], core: [6, 6], facade: 'punched', paneW: 2.6,
      glassTint: [0.6, 0.66, 0.7], cladTint: lin(120, 112, 104), sparseInterior: 0.4, roofItems: true, waterTank: true, capacity: { arch: 5000, glassO: 800, glassT: 20 },
    }));
    this.m2 = this.addBuilding(buildTower(ctx, {
      name: 'MID2', id: 7, seed: 17, x0: -76, z0: -54, x1: -50, z1: -25, floors: 6, floorH: 3.6, bays: [3, 3], core: [6, 6], facade: 'punched', paneW: 2.4, wallKind: KIND.BRICK,
      glassTint: [0.6, 0.66, 0.7], cladTint: lin(140, 70, 52), sparseInterior: 0.4, roofItems: true, capacity: { arch: 4000, glassO: 600, glassT: 20 },
    }));
    this.m3 = this.addBuilding(buildTower(ctx, {
      name: 'MID3', id: 8, seed: 18, x0: -110, z0: -56, x1: -82, z1: -25, floors: 9, floorH: 3.6, bays: [3, 3], core: [6, 6], facade: 'curtain', paneW: 1.8,
      glassTint: [0.55, 0.62, 0.66], cladTint: lin(90, 94, 100), sparseInterior: 0.2, roofItems: true, capacity: { arch: 6000, glassO: 1800, glassT: 20 },
    }));
    // B4: super-tall in the NW block
    this.b4 = this.addBuilding(buildTower(ctx, {
      name: 'SKY SPIRE', id: 9, seed: 19, x0: -110, z0: -112, x1: -74, z1: -76, floors: 62, lobbyH: 9, floorH: 4.2, bays: [4, 4], core: [12, 12],
      facade: 'curtain', paneW: 3.0, glassTint: [0.55, 0.68, 0.78], cladTint: lin(160, 166, 172), spandTint: lin(80, 90, 100), mullionTint: lin(170, 176, 182),
      roofItems: true, antenna: 40, capacity: { arch: 22000, glassO: 6500, glassT: 20 },
    }));
    // shops along the SW avenue front
    this.m4 = this.addBuilding(buildTower(ctx, {
      name: 'MID4', id: 10, seed: 20, x0: -110, z0: 26, x1: -76, z1: 58, floors: 7, floorH: 3.6, bays: [3, 3], core: [6, 6], facade: 'punched', paneW: 2.8,
      glassTint: [0.6, 0.66, 0.7], cladTint: lin(170, 160, 150), sparseInterior: 0.3, roofItems: true, capacity: { arch: 5000, glassO: 700, glassT: 20 },
    }));
    this.heroRects = this.buildings.filter((b) => b.P.x1 - b.P.x0 < 100).map((b) => [b.P.x0 - 3, b.P.z0 - 3, b.P.x1 + 3, b.P.z1 + 3]);
    this.heroRects.push([74, -80, 114, -26]); // site + crane
  }

  // ---------------------------------------------------------------------------------------
  buildProps() {
    const S = this.street, r = this.rng;
    const pole = lin(70, 72, 76), dark = lin(30, 32, 34);
    // street lights along the main avenue and cross street
    const lamp = (x, z, dirX, dirZ) => {
      S.add(EL.ARCH, x, 4.5, z, 0.18, 9, 0.18, KIND.STEEL, pole, { flags: 128 });
      S.add(EL.ARCH, x + dirX * 1.2, 8.9, z + dirZ * 1.2, Math.abs(dirX) > 0 ? 2.4 : 0.12, 0.12, Math.abs(dirZ) > 0 ? 2.4 : 0.12, KIND.STEEL, pole, { flags: 128 });
      const head = S.add(EL.ARCH, x + dirX * 2.3, 8.8, z + dirZ * 2.3, 0.7, 0.18, 0.45, KIND.SIGN, [1.0, 0.75, 0.45], { flags: 128 });
      this.lamps.push({ x: x + dirX * 2.3, y: 8.7, z: z + dirZ * 2.3, id: head, on: true });
    };
    for (let x = -118; x <= 118; x += 24) {
      if (Math.abs(x) < 20) continue;
      lamp(x, -16.2, 0, 1); lamp(x + 12, 16.2, 0, -1);
    }
    for (let z = -118; z <= 118; z += 24) {
      if (Math.abs(z) < 24) continue;
      lamp(-12.4, z, 1, 0); lamp(12.4, z + 12, -1, 0);
    }
    // traffic signals at the four corners (horizontal 3-lamp heads over the road)
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = sx * 12.6, z = sz * 16.4;
      S.add(EL.ARCH, x, 3.4, z, 0.22, 6.8, 0.22, KIND.STEEL, lin(120, 122, 118), { flags: 128 });
      // arm over the avenue (along -sz direction) and over the cross street
      S.add(EL.ARCH, x, 6.6, z - sz * 4.5, 0.14, 0.14, 9, KIND.STEEL, lin(120, 122, 118), { flags: 128 });
      S.add(EL.ARCH, x - sx * 4.5, 6.2, z, 9, 0.14, 0.14, KIND.STEEL, lin(120, 122, 118), { flags: 128 });
      const h1 = S.add(EL.ARCH, x, 6.2, z - sz * 7.8, 0.35, 0.4, 1.35, KIND.PLASTIC, dark, { flags: 128 });
      const h2 = S.add(EL.ARCH, x - sx * 7.8, 5.8, z, 1.35, 0.4, 0.35, KIND.PLASTIC, dark, { flags: 128 });
      // lamp positions (for emissive dots drawn by the signal system)
      this.signals.push({ pos: new THREE.Vector3(x, 6.2, z - sz * 7.8), along: new THREE.Vector3(0, 0, 1), face: new THREE.Vector3(sx, 0, 0), axis: 'av', ids: [h1] });
      this.signals.push({ pos: new THREE.Vector3(x - sx * 7.8, 5.8, z), along: new THREE.Vector3(1, 0, 0), face: new THREE.Vector3(0, 0, sz), axis: 'st', ids: [h2] });
      // pedestrian signals
      S.add(EL.ARCH, x - sx * 1.2, 2.6, z + sz * 0.4, 0.3, 0.6, 0.25, KIND.PLASTIC, dark, { flags: 128 });
    }
    // guardrails along the main avenue curbs (with gaps near crossings)
    for (const z of [-15.45, 15.45]) for (let x = -118; x < 118; x += 4) {
      if (Math.abs(x) < 22) continue;
      S.add(EL.ARCH, x + 2, 0.75, z, 3.9, 0.12, 0.05, KIND.ALU, lin(200, 202, 204), { flags: 256 });
      S.add(EL.ARCH, x, 0.45, z, 0.06, 0.9, 0.06, KIND.ALU, lin(200, 202, 204), { flags: 256 });
    }
    // utility poles + wires along the cross street and the minor side of the avenue
    const poles = [];
    for (let z = -118; z <= 118; z += 30) {
      if (Math.abs(z) < 26) continue;
      for (const x of [-15.2, 15.2]) {
        S.add(EL.ARCH, x, 6, z, 0.34, 12, 0.34, KIND.CONCRETE, lin(160, 158, 152), { flags: 128 });
        S.add(EL.ARCH, x, 11.2, z, 0.14, 0.14, 1.8, KIND.STEEL, lin(90, 90, 90), { flags: 128 });
        S.add(EL.ARCH, x, 10.2, z, 0.14, 0.14, 1.4, KIND.STEEL, lin(90, 90, 90), { flags: 128 });
        if (r.next() < 0.6) S.add(EL.ARCH, x, 9.0, z + 0.4, 0.5, 0.8, 0.5, KIND.STEEL, lin(110, 112, 110), { flags: 128 });
        poles.push(new THREE.Vector3(x, 11.2, z));
      }
    }
    // wires between consecutive poles on each side, plus some spanning the street
    for (const x of [-15.2, 15.2]) {
      const col = poles.filter((p) => p.x === x).sort((a, b) => a.z - b.z);
      for (let i = 0; i < col.length - 1; i++) {
        if (col[i + 1].z - col[i].z > 45) continue;
        for (const [dz, dy] of [[-0.8, 0], [0.8, 0], [-0.6, -1.0], [0.6, -1.0], [0, -1.6]]) {
          this.wires.add(col[i].clone().add(new THREE.Vector3(0, dy, dz)), col[i + 1].clone().add(new THREE.Vector3(0, dy, dz)), 0.5 + r.next() * 0.4, 12);
        }
      }
    }
    for (const p of poles) if (p.x < 0 && r.next() < 0.5) this.wires.add(p.clone(), new THREE.Vector3(15.2, 10.6, p.z + 1.5), 0.9, 14);
    // vending machines against building fronts
    for (const [x, z, ry] of [[-20.6, -30, Math.PI / 2], [-20.6, -31.1, Math.PI / 2], [20.6, 32, -Math.PI / 2], [-40, -22.8, 0], [-39, -22.8, 0]]) {
      S.add(EL.ARCH, x, 0.95, z, 1.0, 1.8, 0.8, KIND.PLASTIC, lin(230, 230, 232), { rotY: ry, flags: 512 });
      S.add(EL.ARCH, x + Math.sin(ry) * -0.41, 1.1, z + Math.cos(ry) * 0.41, 0.8, 1.2, 0.03, KIND.SIGN, [0.9, 0.95, 1.0], { rotY: ry, flags: 512 });
    }
    // bus stop shelter on the south sidewalk
    const bx = -60, bz = 18.2;
    S.add(EL.ARCH, bx, 2.4, bz + 1.3, 6, 0.1, 2.4, KIND.ALU, lin(150, 152, 156), { flags: 512 });
    for (const dx of [-2.9, 2.9]) S.add(EL.ARCH, bx + dx, 1.2, bz + 2.4, 0.1, 2.4, 0.1, KIND.ALU, lin(150, 152, 156), { flags: 512 });
    S.add(EL.GLASS_T, bx, 1.2, bz + 2.45, 5.6, 2.2, 0.03, 0, [0.8, 0.9, 0.9], { flags: 8 });
    S.add(EL.ARCH, bx + 2.4, 1.2, bz + 2.4, 1.1, 2.0, 0.05, KIND.SIGN, [0.95, 0.85, 0.75], { flags: 512 });
    // neon signs: vertical boards on the NW mid-rises facing the avenue
    this.signSpots = [
      { x: -24, y: 16, z: -24.4, h: 12, w: 1.6, text: '居酒屋 龍', color: [1.0, 0.25, 0.35] },
      { x: -37, y: 14, z: -24.4, h: 10, w: 1.4, text: 'カラオケ', color: [0.3, 0.8, 1.0] },
      { x: -56, y: 12, z: -24.4, h: 9, w: 1.4, text: 'ホテル', color: [1.0, 0.7, 0.2] },
      { x: -66, y: 13, z: -24.4, h: 9, w: 1.3, text: '麻雀', color: [0.4, 1.0, 0.5] },
      { x: -86, y: 18, z: -24.4, h: 14, w: 1.8, text: '薬 ドラッグ', color: [1.0, 0.9, 0.3] },
      { x: -98, y: 15, z: -24.4, h: 11, w: 1.5, text: 'ラーメン', color: [1.0, 0.35, 0.15] },
      { x: -80, y: 12, z: 25.6, h: 10, w: 1.5, text: '焼肉', color: [1.0, 0.3, 0.3] },
      { x: -95, y: 13, z: 25.6, h: 11, w: 1.6, text: 'パチンコ', color: [1.0, 0.4, 0.9] },
    ];
  }

  // ---------------------------------------------------------------------------------------
  buildSkyline() {
    const r = new RNG(99);
    const lots = [];
    const R = 13; // blocks radius
    const overlaps = (x0, z0, x1, z1) => this.heroRects.some(([a, b, c, d]) => x0 < c && x1 > a && z0 < d && z1 > b);
    for (let i = -R; i < R; i++) for (let j = -R; j < R; j++) {
      const [bx0, bz0, bx1, bz1] = blockBounds(i, j);
      const cxm = (bx0 + bx1) / 2, czm = (bz0 + bz1) / 2;
      const dist = Math.hypot(cxm, czm);
      if (dist > 1750) continue;
      if (czm > 900) continue; // bay to the south
      const nxs = r.int(1, 3), nzs = r.int(1, 3);
      for (let a = 0; a < nxs; a++) for (let c = 0; c < nzs; c++) {
        const lw = (bx1 - bx0) / nxs, ld = (bz1 - bz0) / nzs;
        const m = 2.5;
        const x0 = bx0 + a * lw + m, x1 = bx0 + (a + 1) * lw - m, z0 = bz0 + c * ld + m, z1 = bz0 + (c + 1) * ld - m;
        if (overlaps(x0, z0, x1, z1)) continue;
        const centerBoost = Math.exp(-dist / 700);
        let h = 14 + Math.pow(r.next(), 2.2) * (70 + 190 * centerBoost);
        if (r.next() < 0.06 * centerBoost + 0.01) h += 80 + r.next() * 120;
        const style = r.next() < 0.45 ? 2 : r.next() < 0.5 ? 1 : 0;
        const tint = style === 2 ? lin(70, 80, 92) : r.pick([lin(180, 172, 160), lin(150, 146, 140), lin(120, 118, 115), lin(200, 196, 188), lin(110, 90, 80)]);
        lots.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h, floorH: 3.4 + r.next() * 0.8, bay: 1.8 + r.next() * 1.4, style, tint });
      }
    }
    this.skyline = new Skyline(this.ctx, lots);
    this.group.add(this.skyline.mesh);
  }

  buildCars() {
    const r = new RNG(5);
    const specs = [
      ['sedan', -34, 5.4, 0.08], ['taxi', -26, -9.0, 3.1], ['van', 24, 9.0, 0.05], ['sedan', 38, 1.8, -0.04], ['suv', 52, -5.4, 3.2], ['truck', 70, -12, 3.14],
      ['sedan', -58, -1.8, 3.2], ['taxi', 6, 38, 1.57], ['sedan', -5, -40, -1.6], ['van', -7, 60, 1.55], ['suv', 5, -62, -1.5], ['sedan', 90, 5.4, 0.1],
      ['taxi', -84, 9, 0.02], ['sedan', 3, 24, 1.3], ['suv', -18, 12, 0.6], ['sedan', 16, -20.5, 0.0],
    ];
    const colors = [[0.6, 0.6, 0.62], [0.02, 0.02, 0.025], [0.75, 0.75, 0.74], [0.25, 0.02, 0.02], [0.03, 0.06, 0.2], [0.12, 0.13, 0.13]];
    for (const [type, x, z, rot] of specs) {
      const color = type === 'taxi' ? [0.02, 0.02, 0.02] : type === 'truck' ? [0.8, 0.8, 0.78] : r.pick(colors);
      const car = new Car(type, color, this.ctx.noise2D);
      car.mesh.position.set(x, 0, z);
      car.mesh.rotation.y = rot;
      car.home = { pos: car.mesh.position.clone(), rot };
      car.u.uHazard.value = r.next() < 0.6 ? 1 : 0;
      this.cars.push(car);
      this.group.add(car.mesh);
    }
  }

  floorAt(x, y, z) {
    for (const b of this.buildings) {
      if (!b.slabIds) continue;
      const f = b.floorAt(x, y, z);
      if (f !== null) return f;
    }
    return 0;
  }
  shellBoxes() {
    return this.buildings.filter((b) => b.slabIds && b.P.facade !== 'open').map((b) => [b.P.x0, 0, b.P.z0, b.P.x1, b.topY, b.P.z1]);
  }

  // queries across all stores: returns [{store, id}]
  querySphere(x, y, z, rad, filter) {
    const out = [];
    for (const s of this.stores) {
      const ids = s.querySphere(x, y, z, rad, [], filter ? (id) => filter(s, id) : null);
      for (const id of ids) out.push({ store: s, id });
    }
    return out;
  }
  queryBox(minx, miny, minz, maxx, maxy, maxz, filter) {
    const out = [];
    for (const s of this.stores) {
      const ids = s.query(minx, miny, minz, maxx, maxy, maxz, [], filter ? (id) => filter(s, id) : null);
      for (const id of ids) out.push({ store: s, id });
    }
    return out;
  }

  reset() {
    for (const s of this.stores) s.reset();
    this.wires.reset();
    this.skyline.reset();
    for (const c of this.cars) { c.mesh.position.copy(c.home.pos); c.mesh.rotation.set(0, c.home.rot, 0); c.resetState(); }
  }
}

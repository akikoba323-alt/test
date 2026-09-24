// Chapter 06 — the economics of slop (4:25–5:45)
import { C, F, rgba, mixHex } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure, wrap } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, carrow, check, cross, marker, star, poly } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag } from '../lib/hud.js';
import { videoThumb, atlas } from '../lib/thumbs.js';
import { paper, snow, scanlines } from '../lib/textures.js';
import { buildFactory } from '../lib/factory.js';
import { THREE } from '../engine/gl.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

export function econScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('06', '経済', 'ECONOMICS', cue(56, 'AI') - 0.1);

  // ------------------------------------------------ S34: the human production schedule
  const TASKS = [['取材', 0, 3, '取材して'], ['撮影', 3, 5, '撮影して'], ['編集', 5, 9, '編集して'], ['失敗', 9, 9.6, '失敗したら'], ['撮り直し', 9.6, 12.5, '撮り直す']];
  const S34 = {
    id: 'S34', start: cue(57, '人間の') - 0.3, trans: { type: 'wipe', d: 0.6, dir: [-1, 0], color: '#ffab3d' }, chapter: CH,
    look: { vign: 0.4, bloom: 0.2, gain: [1.03, 1.0, 0.95] },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      ctx.fillStyle = '#16130f'; ctx.fillRect(0, 0, 1920, 1080);
      grid(ctx, 40, 'rgba(255,171,61,0.04)');
      const tTime = cs(57, '時間がかかる') - 0.5, tWorth = cs(59, 'だから') - 0.2;
      const x0 = 330, x1 = 1760, y0 = 250, days = 14, dw = (x1 - x0) / days;
      text(ctx, '人間の動画づくり', 150, 150, { family: F.jpHeavy, size: 50, weight: 900, color: C.human, alpha: since(t, 0.1, 0.4) });
      // calendar header
      const hq = since(t, tTime, 0.6);
      for (let d = 0; d < days; d++) {
        const q = clamp(hq * days - d);
        ctx.save(); ctx.globalAlpha = q;
        fillRR(ctx, x0 + d * dw + 3, y0 - 60, dw - 6, 44, 6, '#2a2218');
        text(ctx, `${d + 1}日`, x0 + d * dw + dw / 2, y0 - 30, { family: F.jp, size: 20, weight: 700, color: C.humanDim, align: 'center' });
        ctx.restore();
      }
      // task bars
      TASKS.forEach(([lab, a, b, sub], i) => {
        const tt = cs(58, sub) - 0.3;
        const q = E.outCubic(clamp((t - tt) / 0.7));
        if (q <= 0) return;
        const y = y0 + 30 + i * 96;
        const fail = lab === '失敗';
        text(ctx, lab, x0 - 30, y + 46, { family: F.jpHeavy, size: 36, weight: 900, color: fail ? C.alert : C.paper, align: 'right', alpha: clamp(q * 2) });
        fillRR(ctx, x0 + a * dw, y + 10, (b - a) * dw * q, 56, 10, fail ? C.alert : lab === '撮り直し' ? '#c7832c' : C.human);
        if (fail && q > 0.5) { text(ctx, '✕', x0 + a * dw + (b - a) * dw / 2, y + 50, { family: F.sans, size: 34, weight: 900, color: '#fff', align: 'center' }); }
        if (lab === '撮り直し' && q > 0.3) carrow(ctx, x0 + 9.6 * dw + 30, y + 10, x0 + 7 * dw, y - 160, x0 + 4 * dw, y - 190, { color: rgba(C.human, 0.8), lw: 4, dash: [10, 8], p: clamp((q - 0.3) * 2) });
      });
      // pondering person + thought bubble
      const wq = since(t, tWorth, 0.5, E.outBack);
      if (wq > 0) {
        const px = 1700, py = 820;
        circle(ctx, px, py - 70, 34, C.human); fillRR(ctx, px - 46, py - 26, 92, 110, 36, C.human);
        const bx = 1240, by = 800;
        ctx.save(); ctx.translate(bx, by); ctx.scale(wq, wq);
        fillRR(ctx, -330, -80, 660, 150, 75, C.paper);
        circle(ctx, 360, 40, 22, C.paper); circle(ctx, 410, 70, 12, C.paper);
        text(ctx, 'これ、本当に出す価値ある？', 0, 12, { family: F.jpHeavy, size: 40, weight: 900, color: C.ink, align: 'center' });
        ctx.restore();
      }
      const total = since(t, cs(58, '撮り直す') + 0.4, 0.6);
      if (total > 0) text(ctx, '＝ 約2週間', x1, 150, { family: F.jpHeavy, size: 56, weight: 900, color: C.human, align: 'right', alpha: total });
    },
  };

  // ------------------------------------------------ S35: the gacha machine — 100 → 1 hit, 1000 → 10 hits
  let caps;
  const S35 = {
    id: 'S35', start: cue(60, 'でも') - 0.2, trans: { type: 'slice', d: 0.55 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.35, bloomThresh: 0.62 },
    setup() {
      const r = rng(77);
      caps = [];
      const mk = (n, gold, t0, spread) => {
        const golds = new Set(r.shuffle([...Array(n).keys()]).slice(0, gold));
        for (let i = 0; i < n; i++) {
          const x = 760 + r.gauss() * spread; const h = Math.max(0, 1 - Math.abs(x - 760) / (spread * 2.4));
          caps.push({ t0: t0 + (i / n) * 1.6 + r() * 0.05, tx: x, ty: 880 - h * r() * (spread * 0.9), c: golds.has(i), col: r.pick(['#ff5a5a', '#5ab0ff', '#7ee07e', '#ffb35a', '#c58cff', '#ff8ad0']), rot: r() * 6, batch: n });
        }
      };
      caps.mk = mk;
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tMiss = cs(60, '外れても') - 0.4, t100 = cs(61, '百本') - 0.3, t1000 = cs(62, '千本') - 0.3;
      if (!caps.built) { caps.mk(100, 1, t100, 150); caps.mk(1000, 10, t1000, 260); caps.built = true; }
      ctx.fillStyle = '#0e0e11'; ctx.fillRect(0, 0, 1920, 1080);
      glow(ctx, 760, 500, 700, '#2a2410', 0.5);
      // machine
      const mx = 760, my = 380;
      fillRR(ctx, mx - 170, my + 90, 340, 330, 20, '#c62828');
      fillRR(ctx, mx - 150, my + 110, 300, 60, 12, '#8e1b1b');
      text(ctx, 'AI ガチャ', mx, my + 152, { family: F.jpHeavy, size: 40, weight: 900, color: '#fff', align: 'center' });
      circle(ctx, mx, my - 60, 200, 'rgba(200,230,255,.12)', 'rgba(255,255,255,.5)', 4);
      for (let k = 0; k < 40; k++) { const a = hash(k * 3) * 6.28, rr2 = Math.sqrt(hash(k * 7)) * 170; circle(ctx, mx + Math.cos(a) * rr2, my - 60 + Math.sin(a) * rr2 * 0.9 + 30, 22, ['#ff5a5a', '#5ab0ff', '#7ee07e', '#ffb35a', '#c58cff'][k % 5]); }
      circle(ctx, mx, my + 250, 58, '#f3f0e8'); ctx.save(); ctx.translate(mx, my + 250); ctx.rotate(t * (t > t100 ? 14 : 1)); ctx.fillStyle = '#c62828'; ctx.fillRect(-50, -10, 100, 20); ctx.restore();
      fillRR(ctx, mx - 60, my + 360, 120, 70, 10, '#111');
      // "a miss doesn't hurt"
      const mq = since(t, tMiss, 0.5) * (1 - since(t, t100 - 0.1, 0.3));
      if (mq > 0) {
        const u = clamp((t - tMiss) / 1.6);
        const cx = mx + 40 + u * 600, cy = 880 - Math.abs(Math.sin(u * 9)) * 60 * (1 - u);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(u * 12);
        circle(ctx, 0, 0, 34, '#5ab0ff'); ctx.fillStyle = '#f3f0e8'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI); ctx.fill();
        ctx.restore();
        text(ctx, 'ハズレ', cx, cy - 60, { family: F.jpHeavy, size: 34, weight: 900, color: C.mute2, align: 'center', alpha: mq });
        text(ctx, '痛くない', 1500, 520, { family: F.jpHeavy, size: 110, weight: 900, color: C.paper, align: 'center', each: popEach(mq, 0.3) });
        text(ctx, '1本のコスト ≈ ¥0', 1500, 610, { family: F.jp, size: 36, weight: 700, color: C.slop, align: 'center', alpha: mq });
      }
      // capsules
      let hits = 0, total = 0;
      const curBatch = t > t1000 ? 1000 : 100;
      for (const c of caps) {
        const a = t - c.t0; if (a < 0) continue;
        if (c.batch === curBatch) { total++; if (c.c) hits++; }
        const fly = clamp(a / 0.55);
        const sx = mx, sy = my + 400;
        const x = lerp(sx, c.tx, fly), y = lerp(sy, c.ty, fly) - Math.sin(fly * Math.PI) * 180;
        const r = c.batch === 1000 ? 16 : 22;
        ctx.save(); ctx.translate(x, y); ctx.rotate(c.rot + fly * 6);
        if (c.c) { glow(ctx, 0, 0, r * 4, C.gold, 0.5); circle(ctx, 0, 0, r, '#ffd24a'); ctx.fillStyle = '#fff7c2'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fill(); }
        else { circle(ctx, 0, 0, r, c.col); ctx.fillStyle = '#f3f0e8'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fill(); }
        ctx.restore();
      }
      if (t > t100) {
        const is1000 = t > t1000;
        const q = since(t, is1000 ? t1000 : t100, 0.4, E.outBack);
        fillRR(ctx, 1260, 300, 520, 360, 20, 'rgba(11,11,13,.9)');
        text(ctx, is1000 ? '千本出して' : '百本出して', 1520, 380, { family: F.jpHeavy, size: 50, weight: 900, color: C.paper, align: 'center', alpha: q });
        text(ctx, '当たり', 1400, 520, { family: F.jpHeavy, size: 44, weight: 900, color: C.gold, align: 'center' });
        odometer(ctx, hits, 1560, 560, { family: F.bebas, size: 150, color: C.gold, align: 'center' });
        text(ctx, '本でOK', 1690, 520, { family: F.jpHeavy, size: 36, weight: 900, color: C.gold, align: 'center' });
        text(ctx, `出した数 ${fmt(total)}`, 1520, 630, { family: F.mono, size: 26, color: C.mute2, align: 'center' });
      }
    },
  };

  // ------------------------------------------------ S36: one quality video vs a thousand cheap ones
  const S36 = {
    id: 'S36', start: cue(63, 'この仕組み') - 0.25, trans: { type: 'fade', d: 0.4 }, chapter: CH,
    look: { vign: 0.4, bloom: 0.3 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tQ = cs(63, '質の高い') - 0.3, tC = cs(63, '安い') - 0.3, tW = cs(63, '強く') - 0.3;
      const base = 820;
      const oq = since(t, 0.05, 0.4) * (1 - since(t, tQ + 0.2, 0.4));
      if (oq > 0) text(ctx, 'この仕組みでは…', 960, 420, { family: F.jpHeavy, size: 80, weight: 900, color: C.paper, align: 'center', alpha: oq });
      // left: one quality video (tall golden card, fixed views)
      const lq = since(t, tQ, 0.5, E.outBack);
      ctx.save(); ctx.translate(560, base - 150); ctx.scale(lq, lq);
      glow(ctx, 0, -40, 260, C.human, 0.25);
      fillRR(ctx, -140, -120, 280, 240, 16, '#2b1d0b'); strokeRR(ctx, -140, -120, 280, 240, 16, C.human, 4);
      star(ctx, 0, -20, 60, C.human); text(ctx, '質の高い1本', 0, 90, { family: F.jpHeavy, size: 30, weight: 900, color: C.human, align: 'center' });
      ctx.restore();
      // right: pile of 1000 cheap ones
      const n = Math.floor(1000 * E.outCubic(clamp((t - tC) / 1.6)));
      for (let i = 0; i < n; i++) {
        const c = i % 40, r = Math.floor(i / 40);
        const x = 1140 + c * 16 + (r % 2) * 8, y = base - 12 - r * 12;
        ctx.fillStyle = i % 7 === 0 ? '#9fc21f' : C.slop; ctx.fillRect(x, y, 13, 9);
      }
      if (n > 0) text(ctx, `安い${fmt(n)}本`, 1460, base + 60, { family: F.jpHeavy, size: 36, weight: 900, color: C.slop, align: 'center' });
      line(ctx, 300, base + 8, 1820, base + 8, rgba(C.paper, 0.4), 2);
      // verdict: total attention
      const wq = since(t, tW, 0.5, E.outBack);
      if (wq > 0) {
        const hL = 180, hR = 520 * wq;
        fillRR(ctx, 470, 180, 180, 60, 8, '#2b1d0b');
        text(ctx, '合計の再生', 560, 222, { family: F.jp, size: 22, weight: 700, color: C.mute2, align: 'center' });
        text(ctx, '強くなることがある', 1460, 230, { family: F.jpHeavy, size: 54, weight: 900, color: C.paper, align: 'center', alpha: wq });
        // crown over the pile
        ctx.save(); ctx.translate(1460, base - 12 - 25 * 12 - 60); ctx.scale(wq, wq);
        ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-60, 30); ctx.lineTo(-60, -20); ctx.lineTo(-30, 5); ctx.lineTo(0, -35); ctx.lineTo(30, 5); ctx.lineTo(60, -20); ctx.lineTo(60, 30); ctx.fill();
        ctx.restore();
        noteTag(ctx, t - tW, '※ 模式図', 1850, 960 - 60);
      }
    },
  };

  // ------------------------------------------------ S37–S38: the algorithm's point of view
  const S37 = {
    id: 'S37', start: cue(64, 'アルゴリズム') - 0.25, trans: { type: 'glitch', d: 0.45 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.3, scan: 0.12 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tH = cs(64, '作者が') - 0.2, tA = cs(64, 'AI工場') - 0.2, tOne = cs(64, 'とりあえず') - 0.2, tDist = cs(65, '視聴時間') - 0.3, tSend = cs(65, '配る') - 0.4;
      ctx.fillStyle = '#07090a'; ctx.fillRect(0, 0, 1920, 1080);
      grid(ctx, 24, 'rgba(198,244,50,0.035)');
      text(ctx, 'ALGORITHM VIEW', 80, 150, { family: F.mono, size: 26, weight: 700, color: C.slop, ls: 8, each: decodeEach(since(t, 0, 0.8), t, 3, true, C.slop) });
      text(ctx, 'アルゴリズムから見れば', 80, 200, { family: F.jp, size: 30, weight: 700, color: C.mute2, alpha: since(t, 0.2, 0.4) });
      // scanner gate
      const gx = 900;
      fillRR(ctx, gx - 20, 260, 40, 520, 10, '#1d2410');
      const beam = (Math.sin(t * 6) * 0.5 + 0.5);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = C.slop; ctx.fillRect(gx - 3, 260 + beam * 500, 6, 20); ctx.restore();
      // items entering
      const item = (tt, y, human) => {
        const u = E.inOutCubic(clamp((t - tt) / 1.0));
        if (t < tt) return;
        const x = lerp(-300, gx - 80, u);
        if (u >= 1) {
          const k = clamp((t - tt - 1.0) / 0.6);
          for (let d = 0; d < 6; d++) { const px = lerp(gx + 30, 1000, clamp(k * 1.4 - d * 0.1)); if (px > gx + 30 && px < 1000) { ctx.fillStyle = rgba(human ? C.human : C.slop, 0.8); ctx.fillRect(px, y - 4 + (d % 2) * 8, 18, 6); } }
        }
        {
          ctx.save(); ctx.translate(x, y);
          fillRR(ctx, -260, -90, 260, 180, 14, human ? '#2b1d0b' : '#1d2408'); strokeRR(ctx, -260, -90, 260, 180, 14, human ? C.human : C.slop, 3);
          icon(ctx, human ? 'user' : 'factory', -200, -20, 60, { color: human ? C.human : C.slop, lw: 1.8 });
          text(ctx, human ? '3日' : '3秒', -110, 10, { family: F.jpHeavy, size: 64, weight: 900, color: human ? C.human : C.slop });
          text(ctx, human ? '作者が悩んで作った' : 'AI工場が出した', -130, 65, { family: F.jp, size: 20, weight: 700, color: C.mute2, align: 'center' });
          ctx.restore();
        }
      };
      item(tH, 400, true);
      item(tA, 640, false);
      // terminal table on the right
      const rows = [];
      if (t > tH + 1.5) rows.push(['vid_8f3a1c', t > tDist ? '41%' : '…', t > tDist ? '6.2%' : '…']);
      if (t > tA + 1.5) rows.push(['vid_2b77e0', t > tDist ? '44%' : '…', t > tDist ? '6.9%' : '…']);
      const tx = 1000, ty = 330;
      fillRR(ctx, tx, ty - 70, 840, 420, 10, 'rgba(10,14,6,.9)'); strokeRR(ctx, tx, ty - 70, 840, 420, 10, rgba(C.slop, 0.35), 2);
      text(ctx, 'video_id', tx + 30, ty - 20, { family: F.mono, size: 24, weight: 700, color: C.slopDim });
      text(ctx, 'count', tx + 330, ty - 20, { family: F.mono, size: 24, weight: 700, color: C.slopDim });
      text(ctx, 'watch', tx + 480, ty - 20, { family: F.mono, size: 24, weight: 700, color: C.slopDim, alpha: since(t, tDist, 0.3) });
      text(ctx, 'ctr', tx + 650, ty - 20, { family: F.mono, size: 24, weight: 700, color: C.slopDim, alpha: since(t, tDist, 0.3) });
      rows.forEach((r, i) => {
        const y = ty + 50 + i * 70;
        text(ctx, r[0], tx + 30, y, { family: F.mono, size: 30, color: C.slop, each: decodeEach(since(t, (i ? tA : tH) + 1.4, 0.6), t, i + 4, true, C.slop) });
        text(ctx, '1', tx + 350, y, { family: F.mono, size: 34, weight: 700, color: C.paper });
        text(ctx, r[1], tx + 480, y, { family: F.mono, size: 30, color: C.paper });
        text(ctx, r[2], tx + 650, y, { family: F.mono, size: 30, color: C.paper });
      });
      const oq = since(t, tOne, 0.5, E.outBack);
      if (oq > 0) {
        text(ctx, '＝ とりあえず「1本」', tx + 30, ty + 240, { family: F.jpHeavy, size: 50, weight: 900, color: C.paper, alpha: oq });
        text(ctx, '誰が作ったか、どれだけ悩んだかは列に存在しない', tx + 30, ty + 300, { family: F.jp, size: 24, weight: 500, color: C.mute2, alpha: oq });
      }
      // distribute
      const dq = since(t, tSend, 0.5);
      if (dq > 0) {
        fillRR(ctx, tx + 520, ty + 380, 320, 70, 35, C.slop);
        text(ctx, 'DISTRIBUTE ✓', tx + 680, ty + 428, { family: F.mono, size: 28, weight: 700, color: C.ink, align: 'center', alpha: dq });
        for (let k = 0; k < 26; k++) {
          const a = -0.9 + (k / 25) * 1.8, L = 900 * dq;
          const sx = tx + 840, sy = ty + 415;
          ctx.save(); ctx.globalAlpha = 0.25 * dq; line(ctx, sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L, C.slop, 2); ctx.restore();
        }
      }
    },
  };

  // ------------------------------------------------ S39: filling the floor (3D, top-down)
  let fl;
  const S39 = {
    id: 'S39', start: cue(66, 'AI') - 0.25, trans: { type: 'dissolve', d: 0.6 }, chapter: CH,
    look: { vign: 0.55, bloom: 0.35, grain: 0.05 },
    setup() {
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x0a0a0c, 0.02);
      const N = 36, cell = 1;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      const tiles = new THREE.GridHelper(N, N, 0x3a3630, 0x3a3630); tiles.position.y = 0.002; scene.add(tiles);
      // human works: few warm pedestals
      const humans = [];
      const hm = new THREE.MeshStandardMaterial({ color: 0xffab3d, roughness: 0.4, emissive: 0x3a2000, emissiveIntensity: 0.5 });
      const hcells = [[4, 5], [-6, 3], [2, -7], [-3, -4], [9, -2], [-10, -8], [7, 9]];
      for (const [i, j] of hcells) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), hm); m.position.set(i + 0.5, 0.8, j + 0.5); m.castShadow = true; scene.add(m); humans.push([i, j]); }
      // slop boxes: one per remaining cell
      const cells = [];
      for (let j = -N / 2; j < N / 2; j++) for (let i = -N / 2; i < N / 2; i++) if (!hcells.some(([a, b]) => a === i && b === j)) cells.push([i, j]);
      const r = rng(9);
      const order = r.shuffle(cells.map((_, k) => k));
      const box = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.5, 0.92), new THREE.MeshStandardMaterial({ roughness: 0.6 }), cells.length);
      box.castShadow = true; box.receiveShadow = true;
      const col = new THREE.Color();
      cells.forEach((c, k) => { col.set(k % 5 === 0 ? 0x8aa81c : k % 3 ? 0xc6f432 : 0xa4c826).multiplyScalar(0.8 + hash(k) * 0.3); box.setColorAt(k, col); });
      scene.add(box);
      scene.add(new THREE.HemisphereLight(0xbfc8d6, 0x202020, 0.5));
      const key = new THREE.DirectionalLight(0xfff1dc, 2.2); key.position.set(10, 20, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -22; key.shadow.camera.right = 22; key.shadow.camera.top = 22; key.shadow.camera.bottom = -22; scene.add(key);
      const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
      fl = { scene, camera, box, cells, order, rank: (() => { const a = new Float32Array(cells.length); order.forEach((k, i) => (a[k] = i / cells.length)); return a; })() };
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tFill = cs(67, '数で') - 1.4, tEnd = cs(67, '尽くして') + 0.4;
      const o = new THREE.Object3D();
      const prog = clamp((t - tFill) / (tEnd - tFill));
      fl.cells.forEach(([i, j], k) => {
        const rk = fl.rank[k];
        const td = tFill + rk * (tEnd - tFill) * 0.9;
        const a = t - td;
        let y;
        if (a < 0) y = 60; else y = Math.max(0.25, 18 - 0.5 * 40 * a * a);
        const land = a > 0 && y <= 0.25 ? Math.exp(-(a - Math.sqrt(17.75 / 20)) * 8) : 0;
        o.position.set(i + 0.5, y, j + 0.5); o.scale.set(1, 1 - land * 0.35, 1); o.rotation.y = (hash(k) - 0.5) * 0.2;
        o.updateMatrix(); fl.box.setMatrixAt(k, o.matrix);
      });
      fl.box.instanceMatrix.needsUpdate = true;
      const ang = 0.5 + t * 0.05;
      fl.camera.position.set(Math.cos(ang) * 16, 26 - t * 0.3, Math.sin(ang) * 16);
      fl.camera.lookAt(0, 0, 0);
      f.three(fl.scene, fl.camera, { exposure: 1.0, clear: [0.03, 0.03, 0.035, 1] });
      const q1 = since(t, 0.1, 0.5) * (1 - since(t, tFill + 0.2, 0.4));
      text(ctx, '人間を倒そうとしているわけじゃない', 960, 180, { family: F.jpHeavy, size: 56, weight: 900, color: C.paper, align: 'center', alpha: q1, shadow: 'rgba(0,0,0,.8)', shadowBlur: 20 });
      const q2 = since(t, cs(67, '数で') - 0.2, 0.5, E.outExpo);
      text(ctx, '数で床を埋め尽くしている', 960, 180, { family: F.jpHeavy, size: 64, weight: 900, color: C.slop, align: 'center', each: riseEach(q2, 40, 0.3), shadow: 'rgba(0,0,0,.8)', shadowBlur: 20 });
    },
  };

  // ------------------------------------------------ S40: the platform's policy documents
  const S40 = {
    id: 'S40', start: cue(68, 'YouTube') - 0.25, trans: { type: 'slice', d: 0.6 }, chapter: CH,
    source: 'YouTube パートナープログラム収益化ポリシー（2025.07更新）／スパムに関するポリシー', sourceAt: 0.6,
    look: { vign: 0.5, bloom: 0.2, gain: [1.02, 1.0, 0.96] },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tUpd = cs(69, '二千二十五') - 0.3, tTpl = cs(69, 'テンプレート') - 0.2, tMass = cs(69, '大量生産') - 0.2, tView = cs(69, '独自の視点') - 0.2, tStamp1 = cs(69, '収益化できない') - 0.2;
      const tSpam = cs(70, '現在の') - 0.3, tSim = cs(70, '似た動画') - 0.2, tStamp2 = cs(70, '禁止') - 0.3;
      ctx.fillStyle = '#1a1714'; ctx.fillRect(0, 0, 1920, 1080);
      glow(ctx, 900, 400, 900, '#3a3022', 0.6);
      const doc = (x, y, rot, title, lines, hl, stampT, stampTxt, alpha) => {
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
        ctx.drawImage(paper('#f4efe4', 'doc'), 0, 0, 900, 1080, -380, -470, 760, 940);
        ctx.shadowColor = 'transparent';
        text(ctx, title, -320, -380, { family: F.jpHeavy, size: 34, weight: 900, color: '#111' });
        line(ctx, -320, -350, 320, -350, '#111', 2);
        lines.forEach((ln, i) => {
          const yy = -290 + i * 58;
          const h = hl.find((z) => z[0] === i);
          if (h) {
            const w = measure(ctx, h[1], { family: F.jp, size: 27, weight: 500 });
            const pre = measure(ctx, ln.slice(0, ln.indexOf(h[1])), { family: F.jp, size: 27, weight: 500 });
            marker(ctx, -320 + pre - 4, yy - 26, w + 8, 34, since(t, h[2], 0.5), 'rgba(255,230,60,.65)');
          }
          text(ctx, ln, -320, yy, { family: F.jp, size: 27, weight: 500, color: '#2a2a2e' });
        });
        // stamp
        const sp = since(t, stampT, 0.18);
        if (sp > 0) {
          const s = lerp(2.2, 1, E.outQuad(sp));
          ctx.save(); ctx.translate(150, 250); ctx.rotate(-0.18); ctx.scale(s, s); ctx.globalAlpha *= sp;
          strokeRR(ctx, -200, -70, 400, 140, 12, '#c8202a', 10);
          text(ctx, stampTxt, 0, 26, { family: F.jpHeavy, size: 76, weight: 900, color: '#c8202a', align: 'center' });
          ctx.restore();
        }
        ctx.restore();
      };
      const shake = pulse(t, tStamp1, 0.02, 0.15) * 8 + pulse(t, tStamp2, 0.02, 0.15) * 8;
      ctx.save(); ctx.translate(Math.sin(t * 80) * shake, Math.cos(t * 70) * shake);
      const d1 = since(t, tUpd - 0.4, 0.6, E.outExpo);
      doc(720, 540 + (1 - d1) * 700, -0.04, '収益化ポリシー（2025年7月 更新）', [
        '次のようなコンテンツは収益化の対象外です：', '・テンプレート的なコンテンツ', '・大量生産されたコンテンツ', '・独自の視点がない、自動生成された', '　コンテンツ', '・繰り返しの多いコンテンツ', '', '（要約）',
      ], [[1, 'テンプレート的', tTpl], [2, '大量生産', tMass], [3, '独自の視点がない', tView]], tStamp1, '収益化不可', 1);
      const d2 = since(t, tSpam, 0.6, E.outExpo);
      if (d2 > 0) doc(1250, 560 + (1 - d2) * 800, 0.05, 'スパムに関するポリシー', [
        '次の行為は禁止されています：', '・AIや自動化ツールを使い、', '　似た動画を大量にばらまく行為', '・視聴者を欺く反復的な投稿', '', '', '', '（要約）',
      ], [[2, '似た動画を大量にばらまく', tSim]], tStamp2, '禁止', 1);
      ctx.restore();
      const hq = since(t, 0, 0.5) * (1 - since(t, tUpd, 0.4));
      text(ctx, 'プラットフォームも対策', 960, 520, { family: F.jpHeavy, size: 90, weight: 900, color: C.paper, align: 'center', alpha: hq, shadow: 'rgba(0,0,0,.8)', shadowBlur: 30 });
    },
  };

  // ------------------------------------------------ S41: CCTV — the platform watches the factory
  let fac2, cam2;
  const S41 = {
    id: 'S41', start: cue(71, 'つまり') - 0.2, trans: { type: 'pixel', d: 0.5 }, chapter: CH,
    look: { vign: 0.7, bloom: 0.3, sat: 0.15, grain: 0.1, grainSize: 2.2, scan: 0.35, ca: 0.4, contrast: 1.15, gain: [0.9, 1.05, 0.95], warp: 0.25 },
    setup() { fac2 = buildFactory({ lines: 7, spacing: 3.0, len: 70, per: 34, pressZ: 6, fog: 0.035 }); cam2 = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 200); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tq = Math.floor(t * 8) / 8; // choppy CCTV frame rate
      fac2.update(f.T - 300 + tq - t, 1.5);
      cam2.position.set(-9, 9.5, -10); cam2.lookAt(1, 0.5, 8 + Math.sin(tq * 0.3) * 1.5);
      fac2.lamps.visible = false;
      f.three(fac2.scene, cam2, { exposure: 1.2, clear: [0.03, 0.03, 0.03, 1] });
      snow(ctx, t, 0.07);
      // overlay
      ctx.save();
      text(ctx, 'CAM 03 — PLATFORM MONITOR', 70, 90, { family: F.vt, size: 46, color: '#e8ffe0' });
      const rec = Math.floor(t * 2) % 2 === 0;
      if (rec) circle(ctx, 1740, 76, 14, '#ff3030');
      text(ctx, 'REC', 1770, 90, { family: F.vt, size: 46, color: '#e8ffe0' });
      const secs = 44 + Math.floor(t);
      text(ctx, `2026-06-12  03:17:${String(secs % 60).padStart(2, '0')}`, 70, 1000 - 60, { family: F.vt, size: 42, color: '#e8ffe0' });
      // detection box
      const dq = since(t, cs(71, '工場') - 0.6, 0.3);
      if (dq > 0) {
        const bx = 560, by = 330, bw = 900, bh = 420;
        ctx.globalAlpha = dq * (flick(t, 6) > 0.1 ? 1 : 0.4);
        ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 4; ctx.strokeRect(bx, by, bw, bh);
        for (const [x, y, sx, sy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) { line(ctx, x, y, x + sx * 40, y, '#ffd400', 10); line(ctx, x, y, x, y + sy * 40, '#ffd400', 10); }
        fillRR(ctx, bx, by - 60, 520, 56, 4, '#ffd400');
        text(ctx, 'FACTORY DETECTED  98.2%', bx + 14, by - 20, { family: F.vt, size: 44, color: '#111' });
        text(ctx, '「これ、さすがに工場になってきたな」', 960, 880 - 20, { family: F.jpHeavy, size: 50, weight: 900, color: '#fffbe0', align: 'center', alpha: dq, shadow: 'rgba(0,0,0,.9)', shadowBlur: 20 });
      }
      ctx.restore();
    },
  };

  return [S34, S35, S36, S37, S39, S40, S41];
}

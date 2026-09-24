// Chapter 11 — model collapse (10:13–11:31)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure, wrap } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, poly, marker } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { noteTag, chapterCard } from '../lib/hud.js';
import { paper } from '../lib/textures.js';
import { landMask } from '../lib/worldmap.js';
import { mat } from '../lib/glfx.js';
import { THREE } from '../engine/gl.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

// ---- paths for the cathedral → rabbit morph (normalized -1..1 space)
function cathedralPts(n) {
  const segs = [];
  // facade outline with a pointed gothic arch window and two towers
  const P = [[-0.9, 0.9], [-0.9, -0.35], [-0.75, -0.55], [-0.6, -0.35], [-0.6, 0.0], [-0.35, 0.0], [-0.35, -0.5], [0, -0.95], [0.35, -0.5], [0.35, 0.0], [0.6, 0.0], [0.6, -0.35], [0.75, -0.55], [0.9, -0.35], [0.9, 0.9], [0.2, 0.9], [0.2, 0.35], [0, 0.12], [-0.2, 0.35], [-0.2, 0.9], [-0.9, 0.9]];
  return resample(P, n);
}
function rabbitPts(n) {
  const P = [];
  // body ellipse + head + two long ears (single closed-ish path)
  const add = (x, y) => P.push([x, y]);
  for (let a = 0.2; a <= Math.PI * 1.35; a += 0.12) add(0.25 + Math.cos(a) * 0.62, 0.45 + Math.sin(a) * 0.4); // body bottom arc
  add(-0.35, 0.05); add(-0.45, -0.1);
  for (let a = Math.PI * 0.9; a <= Math.PI * 1.9; a += 0.15) add(-0.55 + Math.cos(a) * 0.22, -0.18 + Math.sin(a) * 0.2); // head
  add(-0.5, -0.38); add(-0.58, -0.92); add(-0.47, -0.95); add(-0.42, -0.4); // ear 1
  add(-0.36, -0.4); add(-0.32, -0.9); add(-0.22, -0.9); add(-0.28, -0.35); // ear 2
  add(-0.25, -0.1); add(0.0, 0.0); add(0.4, -0.02); add(0.8, 0.2); add(0.88, 0.45); add(0.95, 0.35); add(0.98, 0.5); add(0.87, 0.6);
  add(0.8, 0.75); add(0.3, 0.86); add(0.1, 0.84);
  return resample(P, n);
}
function resample(P, n) {
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const tot = L[L.length - 1], out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * tot;
    while (j < L.length - 1 && L[j] < d) j++;
    const u = (d - L[j - 1]) / (L[j] - L[j - 1] || 1);
    out.push([lerp(P[j - 1][0], P[j][0], u), lerp(P[j - 1][1], P[j][1], u)]);
  }
  return out;
}
function drawRabbit(ctx, x, y, s, tailCol, bob = 0) {
  ctx.save(); ctx.translate(x, y - bob); ctx.scale(s, s);
  ctx.fillStyle = '#c9b494'; ctx.strokeStyle = '#3a2c1c'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(10, 20, 58, 40, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-44, -8, 26, 22, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-56, -58, 8, 34, -0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-38, -60, 8, 34, 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  circle(ctx, -52, -12, 3.5, '#111');
  ctx.beginPath(); ctx.moveTo(40, 58); ctx.lineTo(62, 58); ctx.stroke();
  circle(ctx, 70, 8, 14, tailCol, '#3a2c1c', 2.5);
  ctx.restore();
}

export function collapseScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('11', 'モデル崩壊', 'MODEL COLLAPSE', cue(117, 'そして') - 0.2);

  // ------------------------------------------------ S63–S64: SF intro + the ouroboros loop
  const S63 = {
    id: 'S63', start: cue(117, 'そして') - 0.2, trans: { type: 'glitch', d: 0.6 }, chapter: CH,
    look: (t) => ({ vign: 0.55, bloom: 0.5, bloomThresh: 0.45, ca: 0.25, grain: 0.05 }),
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tSF = cs(117, 'SF') - 0.4, tFill = cs(118, 'AIが作った') - 0.2, tLearn = cs(119, '次のAI') - 0.2, tEat = cs(120, '当然') - 0.2, tMake = cs(121, 'さらに') - 0.2, tSnake = cs(123, 'AIがAI') - 0.3;
      // starfield
      for (let k = 0; k < 260; k++) { const x = (hash(k) * 1920 + t * (10 + hash(k * 3) * 30)) % 1920, y = hash(k * 7) * 1080; ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.6 * hash(k * 11)})`; ctx.fillRect(x, y, 1.6, 1.6); }
      // HUD rings
      const cx = 960, cy = 520;
      for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * (0.1 + k * 0.07) * (k % 2 ? -1 : 1)); ctx.setLineDash([4 + k * 6, 10 + k * 8]); circle(ctx, 0, 0, 330 + k * 60, null, rgba(C.slop, 0.18 - k * 0.04), 2); ctx.restore(); }
      const introQ = 1 - since(t, tFill - 0.3, 0.5);
      if (introQ > 0) {
        ctx.save(); ctx.globalAlpha = introQ;
        text(ctx, 'CHAPTER 11', cx, 360, { family: F.mono, size: 28, weight: 700, color: C.slop, align: 'center', ls: 12, each: decodeEach(since(t, 0.1, 0.6), t, 3, true, C.slop) });
        text(ctx, 'MODEL COLLAPSE', cx, 520, { family: F.oswald, size: 150, weight: 700, color: C.paper, align: 'center', ls: 10, each: decodeEach(since(t, 0.3, 1.2), t, 5, true, C.paper, C.slop) });
        text(ctx, 'モデル崩壊', cx, 620, { family: F.jpHeavy, size: 64, weight: 900, color: C.slop, align: 'center', alpha: since(t, 0.9, 0.5) });
        text(ctx, '一番SFっぽい話', cx, 720, { family: F.jp, size: 34, weight: 700, color: C.mute2, align: 'center', alpha: since(t, tSF, 0.5) });
        ctx.restore();
      }
      if (t < tFill - 0.3) return;
      // loop diagram: AI → 文章 → ネット → 次のAI
      const lq = since(t, tFill - 0.3, 0.6);
      const R = 290;
      const stations = [['bot', 'AI', -Math.PI / 2, C.slop, tFill - 0.3], ['file-text', 'AIの文章', 0, C.paper, tFill], ['globe', 'ネット', Math.PI / 2, C.paper, tFill + 0.6], ['bot', '次のAI', Math.PI, C.slop, tLearn]];
      const snakeK = E.inOutCubic(clamp((t - tSnake) / 1.2));
      // ring with flowing slop
      ctx.save(); ctx.globalAlpha = lq * (1 - snakeK);
      circle(ctx, cx, cy, R, null, rgba(C.paper, 0.2), 3);
      for (let k = 0; k < 40; k++) { const a = -Math.PI / 2 + ((t * 0.25 + k / 40) % 1) * Math.PI * 2; circle(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 5, C.slop); }
      stations.forEach(([ic, lab, a, col, ts]) => {
        const q = since(t, ts, 0.4, E.outBack); if (q <= 0) return;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        ctx.save(); ctx.translate(x, y); ctx.scale(q, q);
        circle(ctx, 0, 0, 70, '#101014', col, 3); icon(ctx, ic, 0, -4, 58, { color: col, lw: 1.8 });
        ctx.restore();
        text(ctx, lab, x + (Math.cos(a) > 0.5 ? 100 : Math.cos(a) < -0.5 ? -100 : 0), y + (Math.sin(a) > 0.5 ? 120 : Math.sin(a) < -0.5 ? -100 : 12), { family: F.jpHeavy, size: 34, weight: 900, color: col, align: Math.cos(a) > 0.5 ? 'left' : Math.cos(a) < -0.5 ? 'right' : 'center', alpha: q });
      });
      const eq = since(t, tEat, 0.4, E.outBack) * (1 - since(t, tMake - 0.1, 0.3));
      if (eq > 0) text(ctx, '食べる', cx - R - 20, cy - 110, { family: F.jpHeavy, size: 44, weight: 900, color: C.alert, align: 'right', each: popEach(eq, 0.3) });
      const mq = since(t, tMake, 0.4, E.outBack) * (1 - since(t, tSnake - 0.2, 0.3));
      if (mq > 0) text(ctx, '作る → また食べる', cx, cy + 12, { family: F.jpHeavy, size: 44, weight: 900, color: C.slop, align: 'center', each: popEach(mq, 0.3) });
      // generation counter
      const gen = t > tLearn ? 1 + Math.floor((t - tLearn) * 1.6) : 1;
      text(ctx, 'GEN ' + String(Math.min(gen, 99)).padStart(2, '0'), 1760, 180, { family: F.mono, size: 44, weight: 700, color: C.slop, align: 'right' });
      ctx.restore();
      // ouroboros: a snake made of text eats its own tail
      if (snakeK > 0) {
        const rot = t * 0.35;
        const N = 120;
        const arc = Math.PI * 2 * 0.93;
        ctx.save(); ctx.globalAlpha = snakeK;
        for (let i = N - 1; i >= 0; i--) {
          const u = i / (N - 1);
          const a = rot + u * arc;
          const th = lerp(58, 16, Math.pow(u, 1.3));
          const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
          circle(ctx, x, y, th / 2, i % 2 ? '#9fc21f' : C.slop);
          if (i % 3 === 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); text(ctx, 'AIの残飯'[Math.floor(i / 3) % 5], 0, th * 0.18, { family: F.jpHeavy, size: th * 0.55, weight: 900, color: '#233008', align: 'center' }); ctx.restore(); }
        }
        // head at u=0 biting the tail end (u=1)
        const ah = rot;
        const hx = cx + Math.cos(ah) * R, hy = cy + Math.sin(ah) * R;
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(ah - Math.PI / 2 + Math.PI);
        ctx.fillStyle = C.slop; ctx.beginPath(); ctx.ellipse(0, 0, 44, 64, 0, 0, Math.PI * 2); ctx.fill();
        circle(ctx, -18, 20, 7, '#10140a'); circle(ctx, 18, 20, 7, '#10140a');
        ctx.fillStyle = '#10140a'; const bite = 0.2 + 0.2 * Math.abs(Math.sin(t * 5));
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-30, -64 - bite * 30); ctx.lineTo(30, -64 - bite * 30); ctx.fill();
        ctx.restore();
        ctx.restore();
        const sq2 = since(t, tSnake + 0.4, 0.6, E.outExpo);
        text(ctx, 'AIが、', cx, cy - 20, { family: F.jpHeavy, size: 50, weight: 900, color: C.paper, align: 'center', each: riseEach(sq2, 30, 0.3) });
        text(ctx, 'AIの残飯を食べる', cx, cy + 50, { family: F.jpHeavy, size: 50, weight: 900, color: C.slop, align: 'center', each: riseEach(clamp(sq2 * 1.2 - 0.2), 30, 0.3) });
      }
    },
  };

  // ------------------------------------------------ S65: distribution collapse (real resampling simulation, ridgeline)
  let ridges;
  function simulate() {
    const r = rng(2024);
    // generation 0: diverse data (mixture with long tails)
    let data = [];
    for (let i = 0; i < 4000; i++) {
      const k = r();
      if (k < 0.45) data.push(r.gauss() * 0.9 - 1.2);
      else if (k < 0.8) data.push(r.gauss() * 0.7 + 1.4);
      else if (k < 0.93) data.push(r.gauss() * 1.8);
      else data.push((r() < 0.5 ? -1 : 1) * (3 + r() * 2.2)); // rare tails
    }
    const gens = [];
    const bins = 120, lo = -6, hi = 6;
    const hist = (d) => { const h = new Float32Array(bins); for (const v of d) { const b = Math.floor((v - lo) / (hi - lo) * bins); if (b >= 0 && b < bins) h[b]++; } const m = Math.max(...h); return Array.from(h, (x) => x / m); };
    gens.push(hist(data));
    let cur = data;
    for (let g = 1; g <= 9; g++) {
      // each generation learns from a finite sample of the previous generation's output (bootstrap + slight smoothing)
      const n = 140;
      const sample = []; for (let i = 0; i < n; i++) sample.push(cur[Math.floor(r() * cur.length)]);
      const bw = 0.18;
      const next = []; for (let i = 0; i < 4000; i++) { const s = sample[Math.floor(r() * n)]; next.push(s * 0.93 + r.gauss() * bw * 0.6); }
      cur = next;
      gens.push(hist(cur));
    }
    return gens;
  }
  const S65 = {
    id: 'S65', start: cue(124, 'Nature') - 0.3, trans: { type: 'dissolve', d: 0.6 }, chapter: CH,
    source: 'Shumailov et al., "AI models collapse when trained on recursively generated data", Nature 631 (2024)', sourceAt: 0.6,
    look: { vign: 0.5, bloom: 0.35, bloomThresh: 0.5 },
    setup() { ridges = simulate(); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tGen = cs(124, '次世代') - 0.4, tBreak = cs(124, '壊れて') - 0.4, tMC = cs(124, 'モデル崩壊') - 0.4;
      const x0 = 380, x1 = 1540, baseY = 330, dy = 56, amp = 200;
      const shown = clamp((t - tGen) / (tBreak + 1.5 - tGen)) * 9;
      for (let g = 0; g <= 9; g++) {
        const vis = g === 0 ? since(t, 0.3, 0.5) : clamp(shown - g + 1);
        if (vis <= 0) continue;
        const y = baseY + g * dy;
        const h = ridges[g];
        const col = g === 0 ? C.human : g < 5 ? '#b8d95a' : C.slop;
        ctx.save(); ctx.globalAlpha = vis;
        ctx.beginPath(); ctx.moveTo(x0, y);
        for (let i = 0; i < h.length; i++) { const x = lerp(x0, x1, i / (h.length - 1)); ctx.lineTo(x, y - h[i] * amp * vis); }
        ctx.lineTo(x1, y); ctx.closePath();
        ctx.fillStyle = '#0b0b0d'; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
        text(ctx, 'GEN ' + g, x0 - 30, y - 6, { family: F.mono, size: 22, weight: 700, color: col, align: 'right' });
        ctx.restore();
      }
      text(ctx, '元のデータ（多様・裾が長い）', x1 + 30, baseY - 30, { family: F.jp, size: 26, weight: 700, color: C.human, alpha: since(t, 0.6, 0.5) });
      const bq = since(t, tBreak, 0.5);
      if (bq > 0) {
        text(ctx, '裾（珍しいもの）が消え、', x1 + 30, baseY + 5 * dy, { family: F.jp, size: 26, weight: 700, color: C.paper, alpha: bq });
        text(ctx, '一点に潰れていく', x1 + 30, baseY + 5 * dy + 40, { family: F.jp, size: 26, weight: 700, color: C.paper, alpha: bq });
      }
      const mq = since(t, tMC, 0.5, E.outExpo);
      text(ctx, 'モデル崩壊', 960, 160, { family: F.jpHeavy, size: 80, weight: 900, color: C.slop, align: 'center', each: riseEach(mq, 30, 0.3) });
      text(ctx, 'model collapse', 960, 210, { family: F.mono, size: 26, color: C.mute2, align: 'center', alpha: mq });
      noteTag(ctx, t - 1, '※ 再学習の簡易シミュレーション（有限サンプルからの再推定を9世代）', 1880, 1000 - 60);
    },
  };

  // ------------------------------------------------ S66–S67: medieval architecture → jackrabbits
  const GENTXT = [
    ['Input', '…typically accomplished by a master mason and a small team of itinerant masons… based on early examples of Perpendicular…', C.human],
    ['Gen 1', '…architecture such as St. Peter’s Basilica in Rome or St. Peter’s Basilica in Buenos Aires…', '#d9d99a'],
    ['Gen 5', '…ism, which had been translated into more than 100 languages including English, French, German, Italian, Spanish…', '#b8d95a'],
    ['Gen 9', '…architecture. In addition to being home to some of the world’s largest populations of black @-@ tailed jackrabbits, white @-@ tailed jackrabbits, blue @-@ tailed jackrabbits, red @-@ tailed jackrabbits, yellow @-', C.slop],
  ];
  let catP, rabP;
  const S66 = {
    id: 'S66', start: cue(125, '実験') - 0.3, trans: { type: 'wipe', d: 0.6, dir: [1, 0], color: '#c6f432' }, chapter: CH,
    source: 'Shumailov et al., Nature (2024) — Example 1', sourceAt: 0.5,
    look: { vign: 0.45, bloom: 0.25, gain: [1.02, 1.0, 0.96] },
    setup() { catP = cathedralPts(260); rabP = rabbitPts(260); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tIn = cs(125, '中世建築') - 0.3, tGen = cs(125, '世代を重ね') - 0.3, t9 = cs(125, '九世代') - 0.4, tJ = cs(125, 'ジャックラビット') - 0.3, tList = cs(125, '延々') - 0.4;
      const tBook = cs(126, '中世建築') - 0.3, tZukan = cs(126, 'ウサギ図鑑') - 0.6, tLol = cs(127, '笑える') - 0.1, tScary = cs(128, 'でも') - 0.15;
      if (t < tBook) {
        ctx.drawImage(paper('#ece4d2', 'nat'), 0, 0);
        // morphing line drawing
        const m = E.inOutCubic(clamp((t - t9) / 1.6));
        const cx = 470, cy = 520, sc = 300;
        const pts = catP.map((p, i) => [cx + lerp(p[0], rabP[i][0], m) * sc, cy + lerp(p[1], rabP[i][1], m) * sc]);
        ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        poly(ctx, pts, since(t, tIn, 1.2), '#3a2c1c', 5);
        ctx.restore();
        if (m < 0.2 && t > tIn + 0.8) { ctx.save(); ctx.globalAlpha = 1 - m * 5; for (let k = 0; k < 7; k++) line(ctx, cx - 0.3 * sc + k * 0.1 * sc, cy + 0.02 * sc, cx - 0.3 * sc + k * 0.1 * sc, cy + 0.33 * sc, '#3a2c1c', 2); ctx.restore(); }
        text(ctx, m < 0.5 ? '中世建築' : '野ウサギ', cx, 940 - 60, { family: F.mincho, size: 50, weight: 900, color: m < 0.5 ? '#3a2c1c' : '#5a7a00', align: 'center', alpha: since(t, tIn, 0.5) });
        // generation cards
        const cards = [[tIn, 0], [tGen, 1], [tGen + 1.2, 2], [t9, 3]];
        cards.forEach(([tt, k], i) => {
          const q = since(t, tt, 0.5, E.outExpo);
          if (q <= 0) return;
          const [lab, body, col] = GENTXT[k];
          const x = 880, y = 150 + i * 190;
          ctx.save(); ctx.globalAlpha = q; ctx.translate((1 - q) * 60, 0);
          fillRR(ctx, x, y, 960, 170, 12, '#16161b');
          text(ctx, lab, x + 24, y + 42, { family: F.mono, size: 26, weight: 700, color: col });
          const lines = wrap(ctx, body, 900, { family: F.garamond, size: 24, style: 'italic' }).slice(0, 4);
          lines.forEach((ln, j) => text(ctx, ln, x + 24, y + 78 + j * 28, { family: F.garamond, size: 24, style: 'italic', color: '#e8e2d4' }));
          if (k === 3) {
            const jq = since(t, tJ, 0.4);
            if (jq > 0) { fillRR(ctx, x + 700, y + 8, 240, 40, 20, rgba(C.alert, jq)); text(ctx, 'ジャックラビット', x + 820, y + 36, { family: F.jpHeavy, size: 24, weight: 900, color: '#fff', align: 'center', alpha: jq }); }
          }
          ctx.restore();
        });
        return;
      }
      // encyclopedia plate: "ウサギ図鑑"
      ctx.drawImage(paper('#efe6d0', 'zukan'), 0, 0);
      const zq = since(t, tBook, 0.5);
      text(ctx, 'ウサギ図鑑', 960, 150, { family: F.mincho, size: 72, weight: 900, color: '#3a2c1c', align: 'center', alpha: zq });
      text(ctx, '— 中世建築を学んだAIの子孫が書いた —', 960, 200, { family: F.mincho, size: 26, weight: 700, color: '#6b5a3a', align: 'center', alpha: zq });
      const tails = [['#1a1a1a', 'black-tailed'], ['#ffffff', 'white-tailed'], ['#3b82f6', 'blue-tailed'], ['#e02424', 'red-tailed'], ['#f5c518', 'yellow-…'], ['#1a1a1a', 'black-tailed'], ['#ffffff', 'white-tailed'], ['#3b82f6', 'blue-tailed'], ['#e02424', 'red-tailed'], ['#f5c518', 'yellow-…']];
      const lol = t > tLol ? Math.abs(Math.sin((t - tLol) * 10)) * 12 * (t < tScary ? 1 : 0) : 0;
      tails.forEach(([c, name], i) => {
        const q = since(t, tBook + 0.2 + i * 0.15, 0.35, E.outBack);
        if (q <= 0) return;
        const x = 290 + (i % 5) * 340, y = 380 + Math.floor(i / 5) * 290;
        ctx.save(); ctx.globalAlpha = q;
        drawRabbit(ctx, x, y, 1.1 * q, c, i % 2 ? lol : lol * 0.6);
        text(ctx, name + ' jackrabbit', x, y + 120, { family: F.garamond, size: 22, style: 'italic', color: '#3a2c1c', align: 'center' });
        ctx.restore();
      });
      if (t > tLol && t < tScary) text(ctx, '笑える', 1700, 190, { family: F.pop, size: 60, color: '#c62828', align: 'center', each: popEach(since(t, tLol, 0.3)) });
      if (t > tScary) {
        ctx.fillStyle = '#040405'; ctx.fillRect(0, 0, 1920, 1080);
        // one rabbit silhouette left in the dark, eye glinting
        ctx.save(); ctx.globalAlpha = 0.9; ctx.filter = 'none';
        ctx.fillStyle = '#0d0d0f'; ctx.beginPath(); ctx.ellipse(1480, 700, 90, 60, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(1400, 650, 40, 34, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(1382, 575, 12, 52, -0.15, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(1408, 572, 12, 52, 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        glow(ctx, 1392, 645, 24, C.alert, 0.9 * since(t, tScary + 0.4, 0.3)); circle(ctx, 1392, 645, 4, '#ff5a4e');
        text(ctx, 'でも、構造は怖い。', 760, 560, { family: F.mincho, size: 96, weight: 900, color: C.paper, align: 'center', each: riseEach(since(t, tScary + 0.05, 0.6, E.outExpo), 30, 0.25) });
      }
    },
  };

  // ------------------------------------------------ S68: copy of a copy of a copy (generation loss shader)
  let srcTex, copyCache = { k: -1 };
  const COPY = /* glsl */ `
  uniform sampler2D src; uniform float k; uniform vec2 res; varying vec2 vUv;
  void main(){
    vec2 px = 1. / res;
    vec2 uv = vUv + vec2(sin(k * 1.7) * .6, cos(k * 2.3) * .5) * px;   // copier misregistration
    uv = .5 + (uv - .5) * (1. - .0012);                                   // slight scale drift
    vec3 c = texture2D(src, uv).rgb * .4;
    c += texture2D(src, uv + vec2(px.x * 1.6, 0.)).rgb * .15; c += texture2D(src, uv - vec2(px.x * 1.6, 0.)).rgb * .15;
    c += texture2D(src, uv + vec2(0., px.y * 1.6)).rgb * .15; c += texture2D(src, uv - vec2(0., px.y * 1.6)).rgb * .15;
    vec3 mean = vec3(.62, .58, .52);
    float l = luma(c);
    float sat = length(c - vec3(l));
    c = mix(c, mean, .05 + .22 * sat);          // rare / saturated colours are pulled to the average first
    c = mix(c, vec3(l), .04);
    c = (c - .5) * .985 + .5;
    c += (hash12(vUv * res + k * 17.) - .5) * .012;
    gl_FragColor = vec4(c, 1.);
  }`;
  function buildDiverse() {
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f1ece2'; ctx.fillRect(0, 0, 1920, 1080);
    const r = rng(33);
    // a crowd of distinct characters: majority + a few minority groups (rare colours)
    for (let i = 0; i < 260; i++) {
      const x = 100 + (i % 26) * 66 + r.range(-8, 8), y = 140 + Math.floor(i / 26) * 86 + r.range(-6, 6);
      const rare = i === 44 || i === 45 || i === 71 || i === 150 || i === 151 || i === 152 || i === 219;
      const col = rare ? r.pick(['#e0197d', '#00a6c8', '#7b2ff7']) : r.pick(['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#6d6875', '#b5838d', '#457b9d', '#e9c46a']);
      circle(ctx, x, y, 17, col);
      ctx.fillStyle = '#222'; ctx.fillRect(x - 7, y - 4, 3, 3); ctx.fillRect(x + 4, y - 4, 3, 3);
      if (r() < 0.3) { ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.strokeRect(x - 10, y - 7, 8, 7); ctx.strokeRect(x + 2, y - 7, 8, 7); }
      if (r() < 0.25) { ctx.fillStyle = r.pick(['#111', '#c1121f', '#2a9d8f']); ctx.fillRect(x - 14, y - 22, 28, 6); }
      ctx.font = '9px JBMono'; ctx.fillStyle = '#555'; ctx.fillText(String(1000 + i), x - 12, y + 30);
    }
    ctx.font = '700 38px NotoSerifJP'; ctx.fillStyle = '#222'; ctx.fillText('ORIGINAL — 多様な世界', 100, 90);
    return c;
  }
  const S68 = {
    id: 'S68', start: cue(129, 'コピー') - 0.3, trans: { type: 'cut', d: 0 }, chapter: CH,
    look: { vign: 0.5, bloom: 0.15, grain: 0.05 },
    setup(eng) { const cv = buildDiverse(); srcTex = new THREE.CanvasTexture(cv); srcTex.colorSpace = THREE.NoColorSpace; srcTex.needsUpdate = true; },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tDet = cs(129, '細部') - 0.4, tRare = cs(130, '珍しい') - 0.3, tMin = cs(131, '少数派') - 0.3, tAvg = cs(132, '平均的') - 0.3;
      // copies accelerate
      const K = Math.floor(keys(t, [[0, 0], [tDet, 4, E.linear], [tRare, 9, E.linear], [tMin, 14, E.linear], [tAvg, 20, E.linear], [f.dur, 34, E.linear]]));
      const gl = f.gl;
      const m = mat(gl, 'copyloss', COPY, { src: { value: null }, k: { value: 0 }, res: { value: new THREE.Vector2(gl.W, gl.H) } });
      const a = gl.rt('copy_a'), b = gl.rt('copy_b');
      if (copyCache.k < 0 || K < copyCache.k) { gl.blit(srcTex, a, { blend: 'replace' }); copyCache = { k: 0, cur: a, other: b }; }
      while (copyCache.k < K) { m.uniforms.src.value = copyCache.cur.texture; m.uniforms.k.value = copyCache.k + 1; gl.pass(m, copyCache.other); const tmp = copyCache.cur; copyCache.cur = copyCache.other; copyCache.other = tmp; copyCache.k++; }
      // present the current copy on a copier bed
      ctx.fillStyle = '#1a1a1d'; ctx.fillRect(0, 0, 1920, 1080);
      f.flush();
      f.tex(copyCache.cur.texture, { rect: [0.1, 0.0796, 0.8, 0.8] });
      // scanner light sweep each copy
      const ph = (t * 1.6) % 1;
      ctx.save(); const sx = 192 + ph * 1536; const g = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0); g.addColorStop(0, 'rgba(200,255,120,0)'); g.addColorStop(0.5, 'rgba(220,255,160,.35)'); g.addColorStop(1, 'rgba(200,255,120,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 60, 130, 120, 864); ctx.restore();
      strokeRR(ctx, 192, 130, 1536, 864, 6, 'rgba(255,255,255,.2)', 2);
      text(ctx, 'COPY ' + String(K).padStart(2, '0'), 1728, 108, { family: F.mono, size: 44, weight: 700, color: C.slop, align: 'right' });
      text(ctx, 'コピーのコピーのコピー…', 192, 108, { family: F.jpHeavy, size: 40, weight: 900, color: C.paper });
      const labs = [[tDet, '細部が消える'], [tRare, '珍しい表現が消える'], [tMin, '少数派の情報が消える'], [tAvg, '平均的で、無難で、似たものだけが残る']];
      const cur = labs.filter(([tt]) => t > tt).pop();
      if (cur) {
        const q = since(t, cur[0], 0.4, E.outExpo);
        fillRR(ctx, 960 - 560, 800, 1120, 110, 16, 'rgba(11,11,13,.9)');
        text(ctx, cur[1], 960, 874, { family: F.jpHeavy, size: 52, weight: 900, color: cur[1].startsWith('平均') ? C.slop : C.paper, align: 'center', each: riseEach(q, 30, 0.3) });
      }
    },
  };

  // ------------------------------------------------ S69: the world itself, distorted (3D point globe)
  let globe;
  const GLV = /* glsl */ `
  attribute float aLand; uniform float warp, time, px; varying vec3 vCol;
  ${''}
  float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  void main(){
    vec3 p = position;
    vec3 q = p * 2.2 + vec3(time * .15, 0., 0.);
    float n = sin(q.x * 1.3 + sin(q.y * 1.7 + time * .4)) * sin(q.z * 1.1 + time * .3);
    p *= 1. + warp * (.35 * n + .15 * sin(p.y * 6. + time));
    p.x += warp * .35 * sin(p.y * 3. + time * .6);
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = px * (aLand > .5 ? 2.2 : 1.2);
    vec3 land = vec3(.93, .92, .89), sea = vec3(.25, .3, .4);
    vec3 c = mix(sea, land, aLand);
    vCol = mix(c, vec3(.776, .957, .196) * (.55 + .45 * aLand), warp * .85);
  }`;
  const S69 = {
    id: 'S69', start: cue(133, 'AI') - 0.3, trans: { type: 'dissolve', d: 0.7 }, chapter: CH,
    look: { vign: 0.6, bloom: 0.5, bloomThresh: 0.4, ca: 0.25 },
    setup() {
      const m = landMask();
      const N = 60000, pos = new Float32Array(N * 3), land = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2, rr2 = Math.sqrt(1 - y * y), th = i * 2.399963;
        const x = Math.cos(th) * rr2, z = Math.sin(th) * rr2;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        const lat = Math.asin(y) * 180 / Math.PI, lon = Math.atan2(z, x) * 180 / Math.PI;
        const mx = Math.floor((lon + 180) / 360 * m.width), my = Math.floor((84 - lat) / 142 * m.height);
        land[i] = my >= 0 && my < m.height && m.data[(my * m.width + mx) * 4] > 127 ? 1 : 0;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aLand', new THREE.BufferAttribute(land, 1));
      const material = new THREE.ShaderMaterial({ vertexShader: GLV, fragmentShader: 'varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.); }', uniforms: { warp: { value: 0 }, time: { value: 0 }, px: { value: 2 } }, depthTest: true });
      const pts = new THREE.Points(g, material);
      const scene = new THREE.Scene(); scene.add(pts);
      const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
      globe = { scene, camera, pts, material };
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tEdu = cs(133, '教材') - 0.3, tGarb = cs(133, 'ゴミ') - 0.3, tWorld = cs(133, '世界そのもの') - 0.6;
      const u = globe.material.uniforms;
      u.time.value = t; u.px.value = 2.0 * f.gl.W / 1920;
      u.warp.value = E.inOutCubic(clamp((t - tWorld) / 2.2));
      globe.pts.rotation.y = t * 0.25; globe.pts.rotation.x = 0.35;
      globe.camera.position.set(0, 0, lerp(3.6, 3.0, clamp(t / f.dur))); globe.camera.lookAt(0, 0, 0);
      f.three(globe.scene, globe.camera, { ldr: true, msaa: 0, clear: [0.01, 0.01, 0.015, 1] });
      // model-eye HUD
      ctx.save(); ctx.strokeStyle = rgba(C.slop, 0.5); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(960, 540, 470, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2 + t * 0.1; line(ctx, 960 + Math.cos(a) * 470, 540 + Math.sin(a) * 470, 960 + Math.cos(a) * (k % 6 ? 485 : 505), 540 + Math.sin(a) * (k % 6 ? 485 : 505), rgba(C.slop, 0.6), 2); }
      ctx.restore();
      text(ctx, 'FUTURE MODEL — WORLD VIEW', 960, 50 + 40, { family: F.mono, size: 22, weight: 700, color: C.slop, align: 'center', ls: 6 });
      const q1 = since(t, tEdu, 0.5);
      text(ctx, '未来のAIの教材が slop なら', 120, 300, { family: F.jpHeavy, size: 44, weight: 900, color: C.paper, alpha: q1 * (1 - since(t, tWorld, 0.4)) });
      const q2 = since(t, tWorld + 0.2, 0.6, E.outExpo);
      text(ctx, '「世界そのもの」を', 150, 460, { family: F.mincho, size: 70, weight: 900, color: C.paper, each: riseEach(q2, 30, 0.3), shadow: 'rgba(0,0,0,.9)', shadowBlur: 20 });
      text(ctx, '歪める', 150, 600, { family: F.mincho, size: 130, weight: 900, color: C.slop, each: riseEach(since(t, tWorld + 0.7, 0.6, E.outExpo), 40, 0.3), shadow: 'rgba(0,0,0,.9)', shadowBlur: 20 });
    },
  };

  return [S63, S65, S66, S68, S69];
}

// Chapter 15 — epilogue (15:13–16:46 + tail)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, spring } from '../engine/ease.js';
import { text, riseEach, popEach } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { fillRR, strokeRR, circle, line, glow, arrow, cross, poly, cursor, spinner, star, vgrad, sketchCircle } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { chapterCard } from '../lib/hud.js';
import { halftone } from '../lib/textures.js';
import { THREE } from '../engine/gl.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), m = k < 0 ? 0 : 255, a = Math.abs(k);
  const ch = (v) => Math.round(v + (m - v) * a);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
function lerpCol(a, b, u) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - u) + ((pb >> s) & 255) * u);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// A brilliant-cut gem seen from the side; its facets double as the shards when it breaks.
const GEM = [
  [[-0.45, -0.55], [-1, -0.2], [-0.5, -0.2]],
  [[-0.45, -0.55], [-0.5, -0.2], [0, -0.2], [0, -0.55]],
  [[0, -0.55], [0, -0.2], [0.5, -0.2], [0.45, -0.55]],
  [[0.45, -0.55], [0.5, -0.2], [1, -0.2]],
  [[-1, -0.2], [-0.5, -0.2], [0, 1]],
  [[-0.5, -0.2], [0, -0.2], [0, 1]],
  [[0, -0.2], [0.5, -0.2], [0, 1]],
  [[0.5, -0.2], [1, -0.2], [0, 1]],
];
const GEM_COL = ['#ffcf7a', '#ffe2a8', '#ffd18a', '#e89a2e', '#f0a53a', '#ffc56b', '#d98520', '#b86b14'];
function drawGem(ctx, x, y, s, t = 0, o = {}) {
  ctx.save(); ctx.translate(x, y);
  if (o.glow !== false) { glow(ctx, 0, 0.1 * s, s * 2.6, C.human, 0.32); glow(ctx, 0, 0, s * 1.1, '#ffe2a8', 0.35); }
  GEM.forEach((pts, i) => {
    ctx.fillStyle = GEM_COL[i]; ctx.beginPath(); pts.forEach(([a, b], k) => (k ? ctx.lineTo(a * s, b * s) : ctx.moveTo(a * s, b * s))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,230,.55)'; ctx.lineWidth = Math.max(1, s * 0.012); ctx.stroke();
  });
  // twinkle
  const tw = 0.6 + 0.4 * Math.sin(t * 5.3);
  star(ctx, -0.25 * s, -0.48 * s, 0.22 * s * tw, 'rgba(255,255,255,.9)', 4, 0.18);
  ctx.restore();
}

export function endScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('15', '結び', 'EPILOGUE', cue(189, 'もしかすると') - 0.2);

  // ------------------------------------------------ S89: "made by humans" becomes a marketing badge
  function badge(ctx, x, y, r, s, col, txt, rot = 0, q = 1) {
    if (q <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(q, q);
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = r * 0.15; ctx.shadowOffsetY = r * 0.05;
    star(ctx, 0, 0, r, col, 18, 0.86);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2); ctx.stroke();
    const lines = txt.split('\n');
    lines.forEach((ln, i) => text(ctx, ln, 0, (i - (lines.length - 1) / 2) * r * 0.36 + r * 0.12, { family: F.jpHeavy, size: r * s, weight: 900, color: '#fff', align: 'center' }));
    ctx.restore();
  }
  const BOX_COLS = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d'];
  const BOX_SUB = ['ほっこり記事', 'まじめ解説', '旅行ガイド', '毎日ニュース'];
  function packageBox(ctx, x, y, w, h, seed = 0, detail = false) {
    const col = BOX_COLS[seed % 4], d = w * 0.1;
    ctx.save(); ctx.translate(x, y);
    // top and side faces (oblique, seen from the upper right)
    ctx.fillStyle = shade(col, 0.28); ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2 + d, -h / 2 - d * 0.6); ctx.lineTo(w / 2 + d, -h / 2 - d * 0.6); ctx.lineTo(w / 2, -h / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(col, -0.32); ctx.beginPath(); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(w / 2 + d, -h / 2 - d * 0.6); ctx.lineTo(w / 2 + d, h / 2 - d * 0.6); ctx.lineTo(w / 2, h / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip(); ctx.globalAlpha *= 0.16;
    const ht = halftone(10, '#000', 'pk'); for (let yy = -h / 2; yy < h / 2; yy += ht.height) for (let xx = -w / 2; xx < w / 2; xx += ht.width) ctx.drawImage(ht, xx, yy);
    ctx.restore();
    // brand label
    fillRR(ctx, -w * 0.43, -h * 0.45, w * 0.86, h * 0.2, w * 0.03, '#fff8e8');
    text(ctx, 'コンテンツ', 0, -h * 0.45 + h * 0.135, { family: F.mochiy, size: w * 0.13, color: '#222', align: 'center' });
    text(ctx, BOX_SUB[seed % 4], 0, -h * 0.16, { family: F.jpHeavy, size: w * 0.085, weight: 900, color: '#fff', align: 'center' });
    // a window onto the "contents": lines of text
    const wy = -h * 0.1, wh = h * 0.3;
    fillRR(ctx, -w * 0.36, wy, w * 0.72, wh, w * 0.04, 'rgba(255,255,255,.92)');
    for (let i = 0; i < 6; i++) fillRR(ctx, -w * 0.28, wy + wh * 0.14 + i * wh * 0.13, w * (0.56 - (i === 5 ? 0.24 : hash(i + seed * 7) * 0.12)), wh * 0.055, 2, 'rgba(40,40,40,.35)');
    if (detail) {
      const py = h * 0.28;
      fillRR(ctx, -w * 0.42, py, w * 0.84, h * 0.17, 6, '#fff');
      text(ctx, '原材料名：取材、経験、手間（国産）', -w * 0.38, py + h * 0.065, { family: F.jp, size: w * 0.042, weight: 700, color: '#333' });
      text(ctx, '内容量：1,200字（人間1人分）', -w * 0.38, py + h * 0.13, { family: F.jp, size: w * 0.038, weight: 500, color: '#555' });
    }
    ctx.restore();
  }
  const S89 = {
    id: 'S89', start: cue(189, 'もしかすると') - 0.2, trans: { type: 'dip', d: 0.6, color: '#000000' }, chapter: CH,
    look: { vign: 0.35, bloom: 0.2, sat: 1.08 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tHuman = cs(189, '人間が作りました') - 0.3, tMute = cs(189, '無添加') - 0.3, tHand = cs(189, '手作り') - 0.3, tMkt = cs(189, 'マーケティング') - 0.4;
      ctx.fillStyle = '#f3ecdc'; ctx.fillRect(0, 0, 1920, 1080);
      const out = E.inOutCubic(clamp((t - tMkt) / 1.4));
      if (out < 1) {
        const s = 1 - out * 0.7;
        // each sticker lands with a small thump
        const thump = pulse(t, tHuman + 0.2, 0.03, 0.12) + pulse(t, tMute + 0.15, 0.03, 0.12) + pulse(t, tHand + 0.15, 0.03, 0.12);
        ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(960, 540 + thump * 5); ctx.scale(s, s); ctx.translate(-960, -540);
        packageBox(ctx, 960, 540, 470, 620, 0, true);
        badge(ctx, 1235, 300, 100, 0.26, '#2b9348', '無添加', -0.2, since(t, tMute, 0.35, E.outBack));
        badge(ctx, 690, 330, 92, 0.27, '#bc6c25', '手作り', 0.18, since(t, tHand, 0.35, E.outBack));
        badge(ctx, 1215, 720, 140, 0.2, '#d62828', '人間が\n作りました', -0.12, since(t, tHuman, 0.45, E.outBack));
        ctx.restore();
      }
      if (out > 0) {
        // a whole shelf of content products, every one wearing the same badge
        ctx.save(); ctx.globalAlpha = out;
        for (let r = 0; r < 3; r++) {
          const y = 230 + r * 300;
          ctx.fillStyle = '#b08d57'; ctx.fillRect(0, y + 120, 1920, 26); ctx.fillStyle = '#8a6a3c'; ctx.fillRect(0, y + 146, 1920, 8);
          for (let k = 0; k < 9; k++) { const x = 110 + k * 215; packageBox(ctx, x, y, 170, 230, k + r); badge(ctx, x + 50, y + 62, 42, 0.2, '#d62828', '人間が\n作りました', -0.15, 1); }
        }
        ctx.restore();
        // supermarket POP card
        const pq = since(t, tMkt + 0.7, 0.45, E.outBack);
        if (pq > 0) {
          ctx.save(); ctx.translate(960, 520); ctx.rotate(-0.05); ctx.scale(pq, pq);
          ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
          fillRR(ctx, -560, -110, 1120, 220, 26, '#ffe14d');
          ctx.shadowColor = 'transparent';
          strokeRR(ctx, -560, -110, 1120, 220, 26, '#d62828', 8);
          text(ctx, 'ただのマーケティング文句？', 0, 30, { family: F.jpHeavy, size: 78, weight: 900, color: '#d62828', align: 'center' });
          star(ctx, -545, -105, 72, '#d62828', 14, 0.72);
          text(ctx, '!?', -545, -82, { family: F.jpHeavy, size: 54, weight: 900, color: '#fff', align: 'center' });
          ctx.restore();
        }
      }
      chapterCard(ctx, t - 0.05, CH, 2.0);
    },
  };

  // ------------------------------------------------ S90–S91: the closed AI economy — and the one who pays
  const LOOP = [['AIが生成した広告', 'megaphone', 'AIが生成した広告'], ['AIが生成した記事', 'file-text', 'AIが生成した記事'], ['AIエージェントが読む', 'bot', 'AIエージェント'], ['AIが要約', 'list-collapse', 'AIが要約'], ['AIが別の記事を書く', 'pen-line', 'AIが別の記事']];
  const S90 = {
    id: 'S90', start: cue(190, 'そして') - 0.2, trans: { type: 'glitch', d: 0.45 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.4, bloomThresh: 0.55 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tPay = cs(190, '人間だけ') - 0.3, tSub = cs(190, '月額') - 0.3, tWho = cs(191, 'そこまで') - 0.2, tCust = cs(191, '客') - 0.5;
      const nodeT = LOOP.map(([, , sub]) => cs(190, sub) - 0.25);
      const k = E.inOutCubic(clamp((t - tWho) / 0.8));
      const cx = lerp(760, 540, k), cy = lerp(500, 560, k), R = lerp(300, 240, k), ns = lerp(1, 0.78, k);
      const P = (i) => { const a = -Math.PI / 2 + (i / LOOP.length) * Math.PI * 2 + t * 0.05; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.85]; };
      ctx.save(); ctx.globalAlpha = lerp(1, 0.55, k);
      LOOP.forEach((_, i) => {
        const j = (i + 1) % LOOP.length;
        const q = since(t, Math.max(nodeT[i], nodeT[j]), 0.5);
        if (q <= 0) return;
        const [x, y] = P(i), [x2, y2] = P(j);
        arrow(ctx, lerp(x, x2, 0.24), lerp(y, y2, 0.24), lerp(x, x2, 0.76), lerp(y, y2, 0.76), { color: rgba(C.slop, 0.7), lw: 4, p: q });
      });
      // once closed, pulses run around the loop — nobody outside is needed
      if (t > nodeT[4] + 0.5) for (let m = 0; m < 5; m++) {
        const u = (t * 0.22 + m / 5) % 1, fi = u * LOOP.length, i = Math.floor(fi), fr = fi - i;
        const [x, y] = P(i), [x2, y2] = P((i + 1) % LOOP.length);
        glow(ctx, lerp(x, x2, fr), lerp(y, y2, fr), 30, C.slop, 0.7); circle(ctx, lerp(x, x2, fr), lerp(y, y2, fr), 7, '#eaffb0');
      }
      LOOP.forEach(([lab, ic], i) => {
        const q = since(t, nodeT[i], 0.4, E.outBack);
        if (q <= 0) return;
        const [x, y] = P(i);
        ctx.save(); ctx.translate(x, y); ctx.scale(q * ns, q * ns);
        circle(ctx, 0, 0, 74, '#131a06', C.slop, 3); icon(ctx, ic, 0, -4, 58, { color: C.slop, lw: 1.8 });
        ctx.restore();
        text(ctx, lab, x, y + 112 * ns, { family: F.jpHeavy, size: 26 * lerp(1, 0.85, k), weight: 900, color: C.slop, align: 'center', alpha: q });
      });
      ctx.restore();
      // the human outside the loop, paying
      const pq = since(t, tPay, 0.5, E.outBack);
      if (pq > 0) {
        const hx = lerp(1480, 1010, k), hy = 600;
        glow(ctx, hx, hy - 40, 220, C.human, 0.16 * pq);
        ctx.save(); ctx.translate(hx, hy); ctx.scale(pq, pq);
        circle(ctx, 0, -110, 44, C.human); fillRR(ctx, -58, -60, 116, 160, 44, C.human);
        ctx.restore();
        text(ctx, '人間だけが払っている', hx, hy - 200, { family: F.jpHeavy, size: 40, weight: 900, color: C.human, align: 'center', alpha: pq * (1 - clamp(k * 3)) });
        const sq = since(t, tSub, 0.4, E.outBack);
        if (sq > 0) {
          for (let m = 0; m < 6; m++) {
            const u = ((t - tSub) * 0.8 + m / 6) % 1;
            const x = lerp(hx - 60, cx + R * 0.4, u), y = lerp(hy - 40, cy, u) - Math.sin(u * Math.PI) * 120;
            circle(ctx, x, y, 14, '#ffd24a', '#b8860b', 2); text(ctx, '¥', x, y + 6, { family: F.jpHeavy, size: 16, weight: 900, color: '#8a5a00', align: 'center' });
          }
          ctx.save(); ctx.translate(hx, hy + 170); ctx.scale(sq, sq);
          fillRR(ctx, -150, -38, 300, 76, 38, C.human); text(ctx, '月額 ¥980', 0, 13, { family: F.jpHeavy, size: 36, weight: 900, color: C.ink, align: 'center' });
          ctx.restore();
        }
      }
      // the receipt: who is the customer here?
      if (k > 0) {
        const rx = 1500, ry = 110, RH = 700;
        const printed = E.outCubic(clamp((t - tWho - 0.1) / 1.5));
        ctx.save(); ctx.globalAlpha = k;
        fillRR(ctx, rx - 250, ry - 24, 500, 30, 15, '#2a2a30');
        ctx.save(); ctx.beginPath(); ctx.rect(rx - 240, ry, 480, RH * printed + 1); ctx.clip();
        ctx.fillStyle = '#f7f5ef'; ctx.fillRect(rx - 220, ry, 440, RH);
        const dash = (y) => { ctx.save(); ctx.setLineDash([9, 7]); line(ctx, rx - 195, ry + y, rx + 195, ry + y, '#777', 2); ctx.restore(); };
        text(ctx, 'RECEIPT', rx, ry + 62, { family: F.mono, size: 34, weight: 700, color: '#222', align: 'center', ls: 6 });
        dash(100);
        [['AI広告', '¥0'], ['AI記事', '¥0'], ['AIエージェント', '¥0'], ['AI要約', '¥0'], ['AI記事（別）', '¥0']].forEach(([a, b], i) => {
          text(ctx, a, rx - 195, ry + 152 + i * 44, { family: F.jp, size: 26, weight: 500, color: '#222' });
          text(ctx, b, rx + 195, ry + 152 + i * 44, { family: F.mono, size: 26, weight: 700, color: '#222', align: 'right' });
        });
        dash(375);
        text(ctx, '合計（月額）', rx - 195, ry + 425, { family: F.jp, size: 28, weight: 700, color: '#222' }); text(ctx, '¥980', rx + 195, ry + 425, { family: F.mono, size: 30, weight: 700, color: '#222', align: 'right' });
        text(ctx, 'お支払い：人間', rx - 195, ry + 478, { family: F.jp, size: 28, weight: 700, color: '#222' });
        dash(522);
        text(ctx, 'お客様：？？？', rx, ry + 598, { family: F.jpHeavy, size: 46, weight: 900, color: '#c62828', align: 'center' });
        ctx.fillStyle = '#222'; for (let b = 0; b < 44; b++) if (hash(b * 5 + 1) > 0.35) ctx.fillRect(rx - 150 + b * 7, ry + 630, hash(b * 3) > 0.6 ? 4 : 2, 40);
        ctx.restore();
        ctx.restore();
        sketchCircle(ctx, rx, ry + 582, 190, 46, since(t, tCust + 0.4, 0.5), C.alert, 5, 4);
        const wq = since(t, tCust, 0.5, E.outExpo);
        text(ctx, '誰が客なのか', 540, 190, { family: F.jpHeavy, size: 76, weight: 900, color: C.paper, align: 'center', each: riseEach(wq, 30, 0.3), shadow: 'rgba(0,0,0,.9)', shadowBlur: 20 });
      }
    },
  };

  // ------------------------------------------------ S92: not a story of AI being too smart
  const S92 = {
    id: 'S92', start: cue(192, 'AI') - 0.25, trans: { type: 'slice', d: 0.55 }, chapter: CH,
    look: { vign: 0.5, bloom: 0.5, bloomThresh: 0.5 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tNot = cs(192, 'ありません') - 0.4, tRev = cs(193, 'むしろ') - 0.2;
      const shrink = E.inOutCubic(clamp((t - tRev) / 0.8));
      const s = lerp(1, 0.25, shrink);
      glow(ctx, 960, 500, 600 * s, '#6d4bd8', 0.45 * (1 - shrink));
      ctx.save(); ctx.translate(960, 500); ctx.scale(s, s);
      icon(ctx, 'brain-circuit', 0, 0, 520, { color: shrink > 0.5 ? C.mute2 : '#b9a4ff', lw: 0.9 });
      ctx.restore();
      text(ctx, '超知能', 960, 820, { family: F.jpHeavy, size: 60, weight: 900, color: '#b9a4ff', align: 'center', alpha: since(t, 0.1, 0.4) * (1 - shrink) });
      const nq = since(t, tNot, 0.3);
      if (nq > 0 && shrink < 1) cross(ctx, 960, 500, 600 * s, nq, C.alert, 30);
      text(ctx, 'AIが賢くなりすぎた話ではない', 960, 170, { family: F.jpHeavy, size: 56, weight: 900, color: C.paper, align: 'center', alpha: since(t, tNot - 0.2, 0.4) });
      if (shrink > 0) text(ctx, 'むしろ逆', 960, 780, { family: F.jpHeavy, size: 120, weight: 900, color: C.slop, align: 'center', each: popEach(since(t, tRev + 0.2, 0.4), 0.3) });
    },
  };

  // ------------------------------------------------ S93–S94: a million mediocre machines → the landscape → dread → a smile
  let swarm;
  const NS = 400000;
  const SV = /* glsl */ `
  attribute vec3 aSmile; attribute float aR;
  uniform float smile, scary, time, px; varying vec3 vCol;
  void main(){
    vec3 p = position;
    float far = 1. - smoothstep(-60., 10., p.z);
    vec3 q = p;
    q.y += scary * (2.5 + 9. * far) * (.55 + .45 * sin(p.x * .13 + time * 2.2 + p.z * .07));
    q += scary * .12 * vec3(sin(time * 23. + aR * 91.), sin(time * 19. + aR * 57.), 0.);
    q.y += sin(time * 3. + aR * 40.) * .02;
    vec3 pos = mix(q, aSmile, smile);
    vec4 mv = modelViewMatrix * vec4(pos, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = px * clamp(30. / -mv.z, .8, 6.);
    vec3 lime = vec3(.776, .957, .196), red = vec3(1., .16, .1);
    vCol = mix(mix(lime, vec3(1., .9, .6), step(.995, aR)), red, scary);
  }`;
  const CAM = {
    close: [[0, 3, 28], [0, 1, 10]],
    wide: [[0, 30, 62], [0, 8, -10]],
    scary: [[0, 5, 34], [0, 9, -20]],
    smile: [[0, 10, 62], [0, 4, -10]],
  };
  const mixCam = (a, b, u) => [0, 1].map((i) => a[i].map((v, k) => lerp(v, b[i][k], u)));
  const S93 = {
    id: 'S93', start: cue(194, 'そこそこ') - 0.25, trans: { type: 'zoom', d: 0.5 }, chapter: CH,
    look: { vign: 0.55, bloom: 0.5, bloomThresh: 0.4 },
    setup() {
      const r = rng(1000000);
      const pos = new Float32Array(NS * 3), sm = new Float32Array(NS * 3), ar = new Float32Array(NS);
      for (let i = 0; i < NS; i++) {
        const x = r.range(-60, 60), z = r.range(-60, 20);
        const h = Math.sin(x * 0.08) * 2.5 + Math.cos(z * 0.06) * 2 + Math.sin((x + z) * 0.15) * 0.8;
        pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
        ar[i] = r();
        // smiley target: face ring + eyes + mouth, in the xy plane at z = -10
        const k = r();
        let tx, ty;
        if (k < 0.45) { const a = r() * Math.PI * 2, rr2 = 14 + r.gauss() * 0.4; tx = Math.cos(a) * rr2; ty = Math.sin(a) * rr2; }
        else if (k < 0.6) { const a = r() * Math.PI * 2, rr2 = Math.sqrt(r()) * 1.8; tx = -5 + Math.cos(a) * rr2; ty = 4 + Math.sin(a) * rr2 * 1.4; }
        else if (k < 0.75) { const a = r() * Math.PI * 2, rr2 = Math.sqrt(r()) * 1.8; tx = 5 + Math.cos(a) * rr2; ty = 4 + Math.sin(a) * rr2 * 1.4; }
        else { const a = Math.PI * (1.15 + r() * 0.7), rr2 = 8 + r.gauss() * 0.4; tx = Math.cos(a) * rr2; ty = Math.sin(a) * rr2 - 0.5; }
        sm[i * 3] = tx; sm[i * 3 + 1] = ty + 8; sm[i * 3 + 2] = -10 + r.gauss() * 0.3;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSmile', new THREE.BufferAttribute(sm, 3)); g.setAttribute('aR', new THREE.BufferAttribute(ar, 1));
      const m = new THREE.ShaderMaterial({ vertexShader: SV, fragmentShader: 'varying vec3 vCol; void main(){ vec2 d = gl_PointCoord - .5; if (dot(d,d) > .25) discard; gl_FragColor = vec4(vCol, 1.); }', uniforms: { smile: { value: 0 }, scary: { value: 0 }, time: { value: 0 }, px: { value: 1 } } });
      const pts = new THREE.Points(g, m); pts.frustumCulled = false;
      const scene = new THREE.Scene(); scene.add(pts);
      const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 400);
      swarm = { scene, camera, m };
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tMass = cs(194, 'ものすごい量') - 0.4, tEach = cs(195, '一つ一つ') - 0.2, tMil = cs(195, '百万') - 0.3, tLand = cs(195, '景色') - 0.5;
      const tScary = cs(196, '怖い') - 0.5, tFun = cs(197, 'そして') - 0.15;
      // opening: a single, so-so robot
      const oneQ = since(t, 0.05, 0.4, E.outBack) * (1 - since(t, tMass - 0.2, 0.4));
      if (oneQ > 0) {
        ctx.save(); ctx.translate(960, 520); ctx.scale(oneQ, oneQ);
        fillRR(ctx, -110, -120, 220, 190, 40, C.slop); circle(ctx, -45, -40, 20, C.ink); circle(ctx, 45, -40, 20, C.ink); fillRR(ctx, -50, 10, 100, 16, 8, C.ink);
        line(ctx, 0, -120, 0, -170, C.slop, 8); circle(ctx, 0, -180, 14, C.slop);
        fillRR(ctx, -70, 80, 50, 90, 18, C.slop); fillRR(ctx, 20, 80, 50, 90, 18, C.slop);
        ctx.restore();
        text(ctx, 'そこそこ賢い機械', 960, 820, { family: F.jpHeavy, size: 56, weight: 900, color: C.paper, align: 'center', alpha: oneQ });
        text(ctx, 'IQ: まあまあ', 1260, 380, { family: F.mono, size: 30, weight: 700, color: C.mute2, alpha: oneQ });
        return;
      }
      const u = swarm.m.uniforms;
      const smile = E.inOutCubic(clamp((t - tFun) / 1.0));
      const scary = since(t, tScary, 0.5) * (1 - smile);
      u.time.value = t; u.px.value = 1.4 * f.gl.W / 1920; u.smile.value = smile; u.scary.value = scary;
      let cam = mixCam(CAM.close, CAM.wide, E.inOutCubic(clamp((t - tMass) / 3.0)));
      cam = mixCam(cam, CAM.scary, E.inOutCubic(clamp((t - tScary) / 0.8)));
      cam = mixCam(cam, CAM.smile, smile);
      const shake = scary * 0.35;
      swarm.camera.position.set(cam[0][0] + Math.sin(t * 37) * shake, cam[0][1] + Math.cos(t * 29) * shake, cam[0][2]);
      swarm.camera.lookAt(cam[1][0], cam[1][1], cam[1][2]);
      f.three(swarm.scene, swarm.camera, { ldr: true, msaa: 0, clear: [0.01, 0.012, 0.01, 1] });
      // keep the top band readable over the particles
      vgrad(ctx, 0, 0, 1920, 460, `rgba(0,0,0,${0.9 * (1 - smile)})`, 'rgba(0,0,0,0)');
      const hudA = 1 - since(t, tScary - 0.25, 0.3);
      if (hudA > 0) {
        // exponential count: every order of magnitude takes the same time, landing on 1,000,000 at "百万"
        const cu = clamp((t - tMass) / (tMil + 0.35 - tMass));
        const cnt = Math.round(Math.pow(10, 6 * cu));
        ctx.save(); ctx.globalAlpha = hudA * since(t, tMass, 0.4);
        odometer(ctx, cnt, 960, 300, { family: F.bebas, size: 120, color: cu >= 1 ? C.slop : C.paper, align: 'center' });
        text(ctx, '稼働中の「そこそこ賢い機械」', 960, 352, { family: F.jp, size: 26, weight: 700, color: C.mute2, align: 'center' });
        ctx.restore();
        const caps = [[tMass, 'ものすごい量で動かせる', C.paper], [tEach, '一つ一つは雑でも', C.mute2], [tMil, '百万個あれば', C.slop], [tLand, 'ネットの景色を変えられる', C.slop]];
        caps.forEach(([a, s, col], i) => {
          const b = i + 1 < caps.length ? caps[i + 1][0] : 1e9;
          if (t < a || t > b + 0.15) return;
          const q = since(t, a + 0.08, 0.45, E.outExpo), o = 1 - since(t, b, 0.15);
          text(ctx, s, 960, 150, { family: F.jpHeavy, size: 60, weight: 900, color: col, align: 'center', alpha: o * hudA, each: riseEach(q, 30, 0.3) });
        });
      }
      const sq = since(t, tScary, 0.35) * (1 - since(t, tFun, 0.3));
      if (sq > 0) text(ctx, 'だから怖い。', 960, 230, { family: F.mincho, size: 116, weight: 900, color: '#fff4f0', align: 'center', alpha: sq * (0.8 + 0.2 * flick(t, 12)), shadow: 'rgba(255,40,20,.95)', shadowBlur: 50 });
      if (t > tFun + 0.2) text(ctx, 'そして、ちょっと面白い。', 960, 880, { family: F.pop, size: 72, color: C.slop, align: 'center', each: popEach(since(t, tFun + 0.2, 0.5, E.outBack), 0.3) });
    },
  };

  // ------------------------------------------------ S95: making information vs. throwing it away — the balance tips
  let heap;
  const S95 = {
    id: 'S95', start: cue(198, '私たち') + 0.4, trans: { type: 'fade', d: 0.7 }, chapter: CH,
    look: { vign: 0.5, bloom: 0.4, bloomThresh: 0.55 },
    setup() {
      const r = rng(9811);
      heap = [];
      [11, 10, 9, 8, 6, 5, 3].forEach((n, row) => { for (let i = 0; i < n; i++) heap.push({ x: (i - (n - 1) / 2) * 22 + r.range(-3, 3), y: -12 - row * 19, rot: r.range(-0.3, 0.3), d: (row / 7) * 0.8 + r() * 0.25, fly: r() < 0.25 ? r.range(-1, 1) : null }); });
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tFirst = cs(198, '人類史上') - 0.3, tMake = cs(198, '情報を作る') - 0.3, tToss = cs(198, '情報を捨てる') - 0.3, tMore = cs(198, '重要') - 0.4;
      // --- history strip: the amount of information we can make, exploding
      const hq = since(t, tFirst - 0.3, 0.5) * (1 - since(t, tMake - 0.2, 0.5));
      if (hq > 0) {
        ctx.save(); ctx.globalAlpha = hq; ctx.translate(0, -40 * since(t, tMake - 0.2, 0.5));
        text(ctx, '人類史上初めて', 960, 190, { family: F.jpHeavy, size: 64, weight: 900, color: C.paper, align: 'center', each: riseEach(since(t, tFirst, 0.6, E.outExpo), 30, 0.3) });
        line(ctx, 220, 700, 1700, 700, rgba(C.paper, 0.4), 3);
        [['洞窟壁画', 'hand'], ['活版印刷', 'book-open'], ['インターネット', 'globe'], ['生成AI', 'sparkles']].forEach(([s, ic], i) => {
          const x = 300 + i * 440, q = since(t, tFirst + 0.15 + i * 0.25, 0.4, E.outBack);
          if (q <= 0) return;
          ctx.save(); ctx.translate(x, 620); ctx.scale(q, q); icon(ctx, ic, 0, 0, 76, { color: i === 3 ? C.slop : C.paper, lw: 1.6 }); ctx.restore();
          line(ctx, x, 690, x, 710, rgba(C.paper, 0.6), 3);
          text(ctx, s, x, 760, { family: F.jpHeavy, size: 30, weight: 900, color: i === 3 ? C.slop : C.mute2, align: 'center', alpha: q });
        });
        const p = clamp((t - tFirst - 0.6) / 1.6);
        const pts = []; for (let i = 0; i <= 80; i++) { const v = i / 80; if (v > p) break; pts.push([lerp(220, 1700, v), 680 - Math.pow(v, 7) * 400]); }
        ctx.lineCap = 'round'; poly(ctx, pts, 1, C.slop, 6);
        if (pts.length) { const [ex, ey] = pts[pts.length - 1]; glow(ctx, ex, ey, 40, C.slop, 0.8); }
        text(ctx, '作れる情報の量', 1680, 250, { family: F.jpHeavy, size: 34, weight: 900, color: C.slop, align: 'right', alpha: since(t, tFirst + 2.0, 0.4) });
        ctx.restore();
      }
      // --- the balance
      const bq = since(t, tMake - 0.2, 0.5);
      if (bq <= 0) return;
      const PX = 960, PY = 330, BL = 500, HANG = 200;
      const tLand = tToss + 0.45;
      let th = -0.2 * E.outCubic(clamp((t - tMake) / 1.6));
      if (t > tLand) th = lerp(-0.2, 0.24, spring(t - tLand, 1.1, 0.35));
      ctx.save(); ctx.globalAlpha = bq; ctx.translate(0, (1 - bq) * 40);
      // stand
      ctx.fillStyle = '#3a3a44'; ctx.beginPath(); ctx.moveTo(PX - 150, 830); ctx.lineTo(PX + 150, 830); ctx.lineTo(PX + 110, 800); ctx.lineTo(PX - 110, 800); ctx.closePath(); ctx.fill();
      line(ctx, PX, PY, PX, 800, '#55555f', 14);
      // needle
      ctx.save(); ctx.translate(PX, PY); ctx.rotate(th * 1.5); line(ctx, 0, 0, 0, -95, C.alert, 5); ctx.restore();
      ctx.strokeStyle = rgba(C.paper, 0.3); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(PX, PY, 110, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.stroke();
      const lx = PX - Math.cos(th) * BL, ly = PY - Math.sin(th) * BL, rx = PX + Math.cos(th) * BL, ry = PY + Math.sin(th) * BL;
      line(ctx, lx, ly, rx, ry, C.paper, 12); circle(ctx, PX, PY, 18, C.paper); circle(ctx, PX, PY, 7, '#3a3a44');
      const pan = (x, y, col) => {
        line(ctx, x, y, x - 125, y + HANG, rgba(C.paper, 0.55), 2); line(ctx, x, y, x + 125, y + HANG, rgba(C.paper, 0.55), 2);
        circle(ctx, x, y, 8, C.paper);
        ctx.fillStyle = '#2a2a32'; ctx.beginPath(); ctx.ellipse(x, y + HANG, 150, 30, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
        line(ctx, x - 150, y + HANG, x + 150, y + HANG, col, 5);
      };
      pan(lx, ly, C.slop); pan(rx, ry, C.human);
      // left: a heap of generated content raining in
      heap.forEach((c) => {
        const q = clamp((t - tMake - c.d) / 0.35);
        if (q <= 0) return;
        let x = lx + c.x, y = ly + HANG + c.y - (1 - E.outBounce(q)) * 600, rot = c.rot;
        if (c.fly != null && t > tLand) { const v = clamp((t - tLand - 0.05) / 1.3); x += c.fly * 420 * v; y += -380 * v + 1500 * v * v; rot += c.fly * 8 * v; }
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); fillRR(ctx, -9, -9, 18, 18, 4, C.slop); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-5, -3, 10, 2); ctx.fillRect(-5, 2, 7, 2); ctx.restore();
      });
      text(ctx, '「情報を作る能力」', lx, ly + HANG + 90, { family: F.jpHeavy, size: 36, weight: 900, color: C.slop, align: 'center', alpha: since(t, tMake + 0.2, 0.4) });
      // right: one small ability, dropped in — and it outweighs everything
      const dq = clamp((t - tToss) / 0.45);
      if (dq > 0) {
        const x = rx, y = lerp(-120, ry + HANG - 60, E.inQuad(dq));
        glow(ctx, x, y, 160, C.human, 0.4);
        circle(ctx, x, y, 58, C.human); icon(ctx, 'trash', x, y, 62, { color: C.ink, lw: 2.4 });
        text(ctx, '「情報を捨てる能力」', rx, ry + HANG + 90, { family: F.jpHeavy, size: 38, weight: 900, color: C.human, align: 'center', alpha: since(t, tLand, 0.4) });
      }
      ctx.restore();
      const mq = since(t, tMore, 0.6, E.outExpo);
      if (mq > 0) {
        const rise = riseEach(mq, 30, 0.3);
        text(ctx, '「捨てる能力」のほうが重要になる時代', 960, 150, { family: F.jpHeavy, size: 56, weight: 900, color: C.paper, align: 'center', each: (g, i, n) => ({ ...rise(g, i, n), color: i <= 6 ? C.human : C.paper }) });
      }
    },
  };

  // ------------------------------------------------ S96: generate more — or judge?
  function card(ctx, x, y, col, a = 1) {
    ctx.save(); ctx.globalAlpha *= a;
    fillRR(ctx, x - 24, y - 16, 48, 32, 5, col);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 16, y - 7, 28, 3); ctx.fillRect(x - 16, y, 20, 3);
    ctx.restore();
  }
  const S96 = {
    id: 'S96', start: cue(199, 'これから') - 0.25, trans: { type: 'glitch', d: 0.4 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.4 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tGen = cs(199, 'もっと') - 0.3, tOr = cs(200, 'それとも') - 0.2, tB = cs(200, '信じ') - 0.3, tI = cs(200, '無視') - 0.3, tC = cs(200, '確かめる') - 0.4, tAb = cs(200, '判断する能力') - 0.4;
      const PX = 480, PY = 470, BX = [1170, 1440, 1710], BY = 500;
      const bins = [[tB, '信じる', 'check', C.human], [tI, '無視する', 'x', C.mute2], [tC, '確かめる', 'search', C.paper]];
      const dimL = 1 - 0.6 * since(t, tAb, 0.6);
      line(ctx, 960, 170, 960, 860, rgba(C.paper, 0.15), 2);
      // left: the generate button, spewing content
      const gq = since(t, tGen, 0.5, E.outBack);
      if (gq > 0) {
        const beat = t > tGen + 0.5 ? pulse(t, tGen + 0.5 + Math.floor((t - tGen - 0.5) / 0.16) * 0.16, 0.02, 0.08) : 0;
        ctx.save(); ctx.globalAlpha = dimL; ctx.translate(PX, PY); ctx.scale(gq * (1 + beat * 0.03), gq * (1 + beat * 0.03));
        glow(ctx, 0, 0, 300, C.slop, 0.25);
        fillRR(ctx, -230, -80, 460, 160, 80, C.slop);
        text(ctx, '✦ もっと生成', 0, 22, { family: F.jpHeavy, size: 56, weight: 900, color: C.ink, align: 'center' });
        ctx.restore();
        text(ctx, 'もっと生成するAI？', PX, 690, { family: F.jpHeavy, size: 44, weight: 900, color: C.slop, align: 'center', alpha: gq * dimL });
        for (let k = 0; k < 90; k++) {
          const st = tGen + 0.5 + k * 0.16, u = (t - st) / 1.0;
          if (u <= 0 || u >= 1.8) continue;
          if (u < 1) { card(ctx, lerp(PX + 200, 1440, E.inOutSine(u)), lerp(PY - 20, 300, u) - Math.sin(u * Math.PI) * 140, C.slop, clamp(u / 0.1)); continue; }
          const v = clamp((u - 1) / 0.7);
          const open = bins.map((b, i) => (st + 1 > b[0] + 0.3 ? i : -1)).filter((i) => i >= 0);
          if (!open.length) { card(ctx, lerp(1440, 1440 + (hash(k * 13) - 0.5) * 700, v), lerp(300, 1150, E.inQuad(v)), C.slop, 1 - v); continue; }
          const bi = open[Math.floor(hash(k * 7 + 3) * open.length)];
          if (v < 1) card(ctx, lerp(1440, BX[bi], E.outCubic(v)), lerp(300, BY - 30, E.inQuad(v)), lerpCol(C.slop, bins[bi][3], v), 1);
        }
      }
      // right: judgement — three bins
      const oq = since(t, tOr, 0.5);
      if (oq > 0) {
        text(ctx, 'それとも…', 1440, 220, { family: F.jpHeavy, size: 44, weight: 900, color: C.mute2, align: 'center', alpha: oq });
        bins.forEach(([tt, s, ic, col], i) => {
          const q = since(t, tt, 0.4, E.outBack);
          if (q <= 0) return;
          const x = BX[i];
          ctx.save(); ctx.translate(x, BY); ctx.scale(q, q);
          ctx.fillStyle = '#17171c'; ctx.beginPath(); ctx.moveTo(-100, -40); ctx.lineTo(100, -40); ctx.lineTo(80, 130); ctx.lineTo(-80, 130); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
          icon(ctx, ic, 0, 50, 70, { color: col, lw: 2.4 });
          ctx.restore();
          text(ctx, s, x, BY + 190, { family: F.jpHeavy, size: 36, weight: 900, color: col, align: 'center', alpha: q });
        });
        text(ctx, '判断する能力？', 1440, 830, { family: F.jpHeavy, size: 62, weight: 900, color: C.human, align: 'center', each: riseEach(since(t, tAb, 0.5, E.outExpo), 30, 0.3) });
      }
    },
  };

  // ------------------------------------------------ S97–S98: when fakes and the real cost the same → trust at zero, shattering
  let shards;
  const GX = 960, GY = 540, GS = 190;
  function shardAt(s, u) {
    const x = lerp(s.x0, s.xf, E.outQuad(u)), y = lerp(s.y0, s.yf, u) - s.h * 4 * u * (1 - u);
    return [x, y, s.spin * E.outQuad(u)];
  }
  function drawShards(ctx, u, a = 1) {
    for (const s of shards) {
      const [x, y, r] = shardAt(s, u);
      ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.globalAlpha *= a;
      ctx.fillStyle = s.col; ctx.beginPath(); s.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,248,230,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
  }
  const S97 = {
    id: 'S97', start: cue(201, 'AI') - 0.25, trans: { type: 'dip', d: 0.6, color: '#000000' }, chapter: CH,
    look: { vign: 0.6, bloom: 0.5, bloomThresh: 0.45 },
    setup() {
      const r = rng(203);
      shards = [];
      // the facets themselves, plus small chips
      GEM.forEach((pts, i) => {
        const c = pts.reduce((a, [x, y]) => [a[0] + x / pts.length, a[1] + y / pts.length], [0, 0]);
        const side = Math.abs(c[0]) < 1e-6 ? (r() < 0.5 ? -1 : 1) : Math.sign(c[0]);
        shards.push({ pts: pts.map(([x, y]) => [(x - c[0]) * GS, (y - c[1]) * GS]), x0: GX + c[0] * GS, y0: GY + c[1] * GS, xf: GX + side * r.range(120, 520), yf: r.range(835, 870), h: r.range(120, 320), spin: r.range(-3, 3), col: GEM_COL[i] });
      });
      for (let i = 0; i < 34; i++) {
        const a = r() * Math.PI * 2, s = r.range(8, 22);
        shards.push({ pts: [[r.range(-1, 1) * s, r.range(-1, 1) * s], [r.range(-1, 1) * s, r.range(-1, 1) * s], [r.range(-1, 1) * s, r.range(-1, 1) * s]], x0: GX + Math.cos(a) * 60, y0: GY + Math.sin(a) * 60, xf: GX + Math.cos(a) * r.range(150, 760), yf: r.range(830, 880), h: r.range(80, 420), spin: r.range(-12, 12), col: GEM_COL[Math.floor(r() * 8)] });
      }
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tNot = cs(201, 'ゴミが増える') - 0.4, tBlend = cs(202, '見分け') - 0.4, tPrice = cs(202, '同じ値段') - 0.6, tTrust = cs(203, '信頼の値段') - 0.4, tBreak = cs(203, 'ゼロ') + 0.05;
      const blend = E.inOutCubic(clamp((t - tBlend) / 1.2));
      if (t < tTrust - 0.3) {
        // trash vs. the real thing — until you can't tell them apart
        const L = [700, 500], R = [1220, 500];
        ctx.save(); ctx.translate(L[0], L[1]);
        ctx.fillStyle = lerpCol('#8a8478', '#9a8f7c', blend);
        ctx.beginPath(); for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; const rr2 = 110 + (hash(k * 5) - 0.5) * 50 * (1 - blend); ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(0,0,0,${0.25 * (1 - blend)})`; ctx.lineWidth = 2; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo((hash(k * 3) - 0.5) * 150, (hash(k * 3 + 1) - 0.5) * 150); ctx.lineTo((hash(k * 3 + 2) - 0.5) * 150, (hash(k * 3 + 5) - 0.5) * 150); ctx.stroke(); }
        ctx.restore();
        if (blend < 1) { ctx.save(); ctx.globalAlpha = 1 - blend; drawGem(ctx, R[0], R[1] - 20, 115, t); ctx.restore(); }
        if (blend > 0) { ctx.save(); ctx.globalAlpha = blend; ctx.fillStyle = '#9a8f7c'; ctx.beginPath(); for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + 0.2; ctx.lineTo(R[0] + Math.cos(a) * 110, R[1] + Math.sin(a) * 110); } ctx.closePath(); ctx.fill(); ctx.restore(); }
        const tagQ = since(t, 0.3, 0.4);
        const tag = (x, y, label, price, col) => { ctx.save(); ctx.globalAlpha = tagQ; fillRR(ctx, x - 110, y, 220, 90, 10, '#f4efe4'); text(ctx, label, x, y + 36, { family: F.jp, size: 24, weight: 700, color: '#555', align: 'center' }); text(ctx, price, x, y + 78, { family: F.bebas, size: 46, color: col, align: 'center' }); ctx.restore(); };
        tag(L[0], 650, blend > 0.5 ? '？' : 'ゴミ', '¥0', '#444');
        const pr = t < tPrice ? 10000 : Math.max(0, Math.round(10000 * (1 - E.inOutCubic(clamp((t - tPrice) / 1.2)))));
        tag(R[0], 650, blend > 0.5 ? '？' : '本物', '¥' + fmt(pr), pr === 0 ? C.alert : '#1b1b1f');
        const nq = since(t, 0.2, 0.4) * (1 - since(t, tBlend - 0.2, 0.4));
        if (nq > 0) { text(ctx, '本当の問題は', 960, 180, { family: F.jpHeavy, size: 46, weight: 900, color: C.mute2, align: 'center', alpha: nq }); text(ctx, 'ゴミが増えることではない', 960, 270, { family: F.jpHeavy, size: 64, weight: 900, color: C.paper, align: 'center', alpha: since(t, tNot, 0.4) * nq }); }
        const bq = since(t, tBlend, 0.4);
        if (bq > 0) text(ctx, '見分けがつかなくなったとき', 960, 230, { family: F.jpHeavy, size: 60, weight: 900, color: C.paper, align: 'center', alpha: bq });
        if (t > tPrice + 0.6) text(ctx, '本物までゴミと同じ値段になる', 960, 850, { family: F.mincho, size: 64, weight: 900, color: C.alert, align: 'center', each: riseEach(since(t, tPrice + 0.6, 0.6, E.outExpo), 30, 0.3) });
        return;
      }
      // the trust gem: its price falls to zero, it cracks, it shatters into its own facets
      const price = Math.max(0, Math.round(1000000 * (1 - E.inCubic(clamp((t - tTrust) / (tBreak - tTrust))))));
      const since0 = t - tBreak;
      const shake = since0 > 0 ? Math.exp(-since0 / 0.15) : 0;
      ctx.save(); ctx.translate(Math.sin(t * 80) * 16 * shake, Math.cos(t * 67) * 12 * shake);
      const aq = since(t, tTrust - 0.3, 0.5);
      text(ctx, '信頼', GX, 330, { family: F.mincho, size: 96, weight: 900, color: '#ffe2a8', align: 'center', alpha: aq * (1 - since(t, tBreak, 0.25)), shadow: 'rgba(255,171,61,.8)', shadowBlur: 30 });
      if (since0 < 0) {
        const gs = lerp(0.85, 1, aq);
        ctx.save(); ctx.globalAlpha = aq; ctx.translate(GX, GY); ctx.scale(gs, gs); ctx.translate(-GX, -GY);
        drawGem(ctx, GX, GY, GS, t);
        const cp = clamp((t - (tBreak - 0.9)) / 0.9);
        if (cp > 0) {
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          poly(ctx, [[GX - 30, GY - 100], [GX + 14, GY - 40], [GX - 22, GY + 10], [GX + 30, GY + 70], [GX + 4, GY + 150]], cp, '#3a2208', 5);
          poly(ctx, [[GX + 14, GY - 40], [GX + 90, GY - 60], [GX + 150, GY - 30]], clamp(cp * 1.6 - 0.5), '#3a2208', 4);
          poly(ctx, [[GX - 22, GY + 10], [GX - 100, GY + 20], [GX - 160, GY - 20]], clamp(cp * 1.6 - 0.7), '#3a2208', 4);
        }
        ctx.restore();
      } else drawShards(ctx, clamp(since0 / 0.55));
      ctx.restore();
      fillRR(ctx, GX - 220, 780, 440, 100, 14, 'rgba(11,11,13,.9)');
      text(ctx, '信頼の値段', GX, 760, { family: F.jp, size: 28, weight: 700, color: C.mute2, align: 'center', alpha: aq });
      text(ctx, '¥' + fmt(price), GX, 856, { family: F.bebas, size: 80, color: price === 0 ? (since0 > 0 && flick(t, 14) < 0.15 ? '#fff' : C.alert) : C.human, align: 'center', alpha: aq });
      if (since0 > 0 && since0 < 0.4) { ctx.fillStyle = `rgba(255,240,220,${0.75 * Math.exp(-since0 / 0.07)})`; ctx.fillRect(0, 0, 1920, 1080); }
    },
  };

  // ------------------------------------------------ S99: the regenerate button does nothing
  const S99 = {
    id: 'S99', start: cue(204, 'それを') - 0.25, trans: { type: 'cut', d: 0 }, chapter: CH, hud: false,
    end: cue(204, 'それを') + 11,
    look: (t) => ({ vign: 0.55, bloom: 0.35, fade: clamp((t - 9.2) / 1.6) }),
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tRegen = cs(204, '再生成') - 0.5, tClick = cs(204, 'ボタン') - 0.1, tNot = cs(204, '簡単ではありません') - 0.2;
      const tFail = tNot + 0.4;
      // the shards stay where they fell
      drawShards(ctx, 1, 0.8 - 0.35 * since(t, 0.2, 1.5));
      const plateA = 1 - since(t, 0.3, 0.6);
      if (plateA > 0) { ctx.save(); ctx.globalAlpha = plateA; fillRR(ctx, GX - 220, 780, 440, 100, 14, 'rgba(11,11,13,.9)'); text(ctx, '信頼の値段', GX, 760, { family: F.jp, size: 28, weight: 700, color: C.mute2, align: 'center' }); text(ctx, '¥0', GX, 856, { family: F.bebas, size: 80, color: C.alert, align: 'center' }); ctx.restore(); }
      text(ctx, 'それを作り直すのは', 960, 200, { family: F.mincho, size: 56, weight: 900, color: C.paper, align: 'center', alpha: since(t, 0.1, 0.5) });
      const bq = since(t, tRegen, 0.4, E.outBack);
      const click = pulse(t, tClick, 0.05, 0.2);
      const loading = t > tClick && t < tFail;
      const failed = t >= tFail;
      if (bq > 0) {
        const sx = failed ? Math.sin((t - tFail) * 42) * 16 * Math.exp(-(t - tFail) * 6) : 0;
        ctx.save(); ctx.translate(960 + sx, 440); ctx.scale(bq * (1 - click * 0.06), bq * (1 - click * 0.06));
        fillRR(ctx, -230, -54, 460, 108, 54, failed ? '#2a2a30' : '#f2f2f2'); strokeRR(ctx, -230, -54, 460, 108, 54, failed ? '#444' : '#ccc', 2);
        if (loading) spinner(ctx, -150, 0, 24, t, '#333', 4); else icon(ctx, 'refresh-cw', -150, 0, 40, { color: failed ? '#666' : '#222', lw: 2.2 });
        text(ctx, loading ? '再生成中…' : '再生成', 30, 16, { family: F.jpHeavy, size: 44, weight: 900, color: failed ? '#666' : '#222', align: 'center' });
        ctx.restore();
        const m = E.inOutCubic(clamp((t - tRegen - 0.2) / 0.9));
        if (t < tNot + 1.5) cursor(ctx, lerp(1500, 1000, m), lerp(900, 460, m), 1.6, click);
      }
      if (failed) {
        text(ctx, '信頼は再生成できません', 960, 575, { family: F.jpHeavy, size: 40, weight: 900, color: C.alert, align: 'center', alpha: since(t, tFail, 0.5) });
        text(ctx, 'ほど簡単ではない。', 960, 700, { family: F.mincho, size: 70, weight: 900, color: C.paper, align: 'center', each: riseEach(since(t, tNot + 0.2, 0.8, E.outExpo), 30, 0.3) });
      } else if (t > tRegen) {
        text(ctx, 'AIに「再生成」ボタンを押させるほど', 960, 700, { family: F.mincho, size: 50, weight: 900, color: C.paper, align: 'center', alpha: since(t, tRegen, 0.5) });
      }
    },
  };

  return [S89, S90, S92, S93, S95, S96, S97, S99];
}

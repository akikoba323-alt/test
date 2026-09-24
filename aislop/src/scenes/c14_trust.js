// Chapter 14 — the irony: trust becomes the scarce thing (13:55–15:13)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure, font } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, check, cross, poly, sketchLine, sketchCircle, star } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag, chapterCard } from '../lib/hud.js';
import { paper } from '../lib/textures.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

// pencil-writing reveal: wipe text left→right with a slight lead fade
function handWrite(ctx, s, x, y, p, o = {}) {
  if (p <= 0) return;
  const w = measure(ctx, s, { family: o.family || F.hand, size: o.size || 48, weight: o.weight || 600 });
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 10, y - (o.size || 48) * 1.2, (w + 20) * clamp(p), (o.size || 48) * 1.6); ctx.clip();
  text(ctx, s, x, y, { family: o.family || F.hand, size: o.size || 48, weight: o.weight || 600, color: o.color || '#2a2016' });
  ctx.restore();
  return w;
}

export function trustScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('14', '信頼', 'TRUST', cue(167, 'でも') - 0.2);

  // ------------------------------------------------ S82: something rises with the slop
  const S82 = {
    id: 'S82', start: cue(167, 'でも') - 0.2, trans: { type: 'dip', d: 0.6, color: '#000000' }, chapter: CH,
    look: { vign: 0.45, bloom: 0.3 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tIrony = cs(167, '皮肉') - 0.4, tMore = cs(168, '増えれば') - 0.4, tValue = cs(168, '価値') - 0.4;
      chapterCard(ctx, t - 0.05, CH, 2.0);
      const iq = since(t, tIrony, 0.4) * (1 - since(t, tMore - 0.2, 0.3));
      if (iq > 0) text(ctx, '一つだけ、皮肉な話', 1300, 540, { family: F.mincho, size: 74, weight: 900, color: C.paper, align: 'center', alpha: iq });
      if (t < tMore - 0.3) return;
      const x0 = 260, x1 = 1660, yB = 820, yT = 250;
      const q = since(t, tMore - 0.3, 0.5);
      ctx.save(); ctx.globalAlpha = q;
      line(ctx, x0, yB, x1, yB, rgba(C.paper, 0.5), 2); line(ctx, x0, yT, x0, yB, rgba(C.paper, 0.5), 2);
      const p = clamp((t - tMore) / 2.2);
      const a = [], b = [];
      for (let i = 0; i <= 60; i++) { const u = i / 60; if (u > p) break; const x = lerp(x0, x1, u); a.push([x, yB - 30 - Math.pow(u, 2.2) * 480]); b.push([x, yB - 20 - Math.pow(u, 2.6) * 420]); }
      ctx.lineCap = 'round'; poly(ctx, a, 1, C.slop, 7);
      const vq = since(t, tValue, 0.5);
      ctx.globalAlpha = q * vq; poly(ctx, b, 1, C.human, 7); ctx.globalAlpha = q;
      if (p > 0.9) text(ctx, 'AI slop の量', x1 - 150, yT - 10, { family: F.jpHeavy, size: 40, weight: 900, color: C.slop, align: 'right' });
      if (vq > 0 && b.length) {
        const [bx, by] = b[b.length - 1];
        fillRR(ctx, bx - 60, by - 120, 120, 90, 14, C.human);
        text(ctx, '？', bx, by - 50, { family: F.jpHeavy, size: 70, weight: 900, color: C.ink, align: 'center' });
        text(ctx, '価値が上がるもの', bx - 90, by + 90, { family: F.jpHeavy, size: 40, weight: 900, color: C.human, align: 'right', alpha: vq });
      }
      ctx.restore();
    },
  };

  // ------------------------------------------------ S83: the human checklist (pencil on paper)
  const ITEMS = [
    [169, '人間が実際に見た', 'eye'], [170, '人間が実際に行った', 'footprints'], [171, '人間が実際に試した', 'flask-conical'],
    [172, '人間が責任を持って名前を出した', 'signature'], [173, '一次資料を確認した', 'file-search'], [174, '間違えたら訂正した', 'pencil'],
  ];
  const S83 = {
    id: 'S83', start: cue(169, '人間') - 0.3, trans: { type: 'wipe', d: 0.7, dir: [1, 0], color: '#ffab3d' }, chapter: CH,
    look: { vign: 0.45, bloom: 0.15, grain: 0.05, gain: [1.03, 1.0, 0.95] },
    draw(f) {
      const { ctx, t } = f;
      ctx.drawImage(paper('#efe6d2', 'check'), 0, 0);
      // ruled notebook lines
      for (let y = 200; y < 900; y += 118) line(ctx, 200, y + 30, 1720, y + 30, 'rgba(90,120,170,.25)', 2);
      line(ctx, 330, 120, 330, 960, 'rgba(200,80,80,.3)', 2);
      ITEMS.forEach(([id, s, ic], i) => {
        const tt = cue(id) - f.S.start - 0.1;
        const dur = Math.max(0.6, eng.cues.S[id].end - eng.cues.S[id].start - 0.3);
        const y = 210 + i * 118;
        const p = clamp((t - tt) / dur);
        if (p <= 0) return;
        // checkbox + check
        strokeRR(ctx, 230, y - 40, 60, 60, 6, '#3a2c1c', 3);
        const cp = clamp((t - tt - dur) / 0.35);
        if (cp > 0) { ctx.save(); ctx.lineCap = 'round'; poly(ctx, [[238, y - 12], [256, y + 10], [300, y - 56]], cp, '#c62828', 8); ctx.restore(); }
        const w = handWrite(ctx, s, 370, y, p, { size: 62, color: '#2a2016' });
        icon(ctx, ic, 370 + w + 60, y - 16, 52, { color: '#7a5a2a', lw: 2, alpha: clamp(p * 2 - 1) });
        if (i === 3 && cp > 0) { ctx.save(); ctx.translate(1520, y - 14); ctx.rotate(-0.1); ctx.globalAlpha = cp; circle(ctx, 0, 0, 46, null, '#c62828', 5); text(ctx, '責任', 0, 14, { family: F.mincho, size: 36, weight: 900, color: '#c62828', align: 'center' }); ctx.restore(); }
        if (i === 5 && p > 0.5) { const k = clamp((p - 0.5) * 2); sketchLine(ctx, 1280, y - 60, 1500, y - 60, k, '#c62828', 4, 5); text(ctx, '訂正', 1520, y - 50, { family: F.hand, size: 36, weight: 600, color: '#c62828', alpha: k }); }
      });
    },
  };

  // ------------------------------------------------ S84: the premium seal
  const S84 = {
    id: 'S84', start: cue(175, 'つまり') - 0.2, trans: { type: 'fade', d: 0.6 }, chapter: CH,
    look: { vign: 0.6, bloom: 0.22, bloomThresh: 0.8, gain: [1.0, 0.98, 0.94] },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tOld = cs(175, '昔は') - 0.3, tFact = cs(175, 'ちゃんとやった') - 0.8, tPrem = cs(175, 'プレミアム') - 0.4;
      glow(ctx, 960, 470, 800, '#3a2808', 0.7);
      const oq = since(t, tOld, 0.5) * (1 - since(t, tFact - 0.2, 0.4));
      if (oq > 0) { text(ctx, '昔は当たり前すぎて', 960, 460, { family: F.mincho, size: 64, weight: 900, color: C.mute2, align: 'center', alpha: oq }); text(ctx, '価値にならなかった', 960, 560, { family: F.mincho, size: 64, weight: 900, color: C.mute2, align: 'center', alpha: oq }); }
      const sq = spring(t - tFact, 1.4, 0.5);
      if (t > tFact) {
        const cx = 960, cy = 470, R = 280 * sq;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate((1 - sq) * 0.6);
        // scalloped rim
        for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; circle(ctx, Math.cos(a) * R, Math.sin(a) * R, R * 0.09, '#9c7418'); }
        const g = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R * 1.05); g.addColorStop(0, '#f3dc8a'); g.addColorStop(0.45, '#c99a2e'); g.addColorStop(1, '#5e420a');
        circle(ctx, 0, 0, R, g);
        circle(ctx, 0, 0, R * 0.82, null, 'rgba(90,60,0,.55)', 3); circle(ctx, 0, 0, R * 0.78, null, 'rgba(255,240,190,.5)', 2);
        // embossed text
        const emb = (s, y, size) => { text(ctx, s, 3, y + 3, { family: F.mincho, size: size * sq, weight: 900, color: 'rgba(40,25,0,.8)', align: 'center' }); text(ctx, s, -1.5, y - 1.5, { family: F.mincho, size: size * sq, weight: 900, color: 'rgba(255,240,190,.75)', align: 'center' }); text(ctx, s, 0, y, { family: F.mincho, size: size * sq, weight: 900, color: '#8a6512', align: 'center' }); };
        emb('人間が', -40 * sq, 64); emb('ちゃんとやった', 50 * sq, 64);
        text(ctx, '★ HUMAN MADE ★', 0, 130 * sq, { family: F.garamond, size: 28 * sq, weight: 700, color: '#6b4a08', align: 'center', ls: 4 });
        // specular sweep
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
        const sx = lerp(-R * 2, R * 2, ((t - tFact) * 0.45) % 1.4 / 1.4);
        const sg = ctx.createLinearGradient(sx - 90, -R, sx + 90, R); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,240,.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sg; ctx.fillRect(-R, -R, R * 2, R * 2);
        ctx.restore();
        ctx.restore();
      }
      const pq = since(t, tPrem, 0.5, E.outExpo);
      if (pq > 0) { text(ctx, 'が、プレミアムになる', 960, 870, { family: F.mincho, size: 70, weight: 900, color: C.gold, align: 'center', each: riseEach(pq, 30, 0.3), shadow: 'rgba(0,0,0,.9)', shadowBlur: 20 }); }
    },
  };

  // ------------------------------------------------ S85: infinite content vs one light of trust
  const S85 = {
    id: 'S85', start: cue(176, 'これから') - 0.2, trans: { type: 'dissolve', d: 0.7 }, chapter: CH,
    look: (t) => ({ vign: 0.6, bloom: 0.55, bloomThresh: 0.45 }),
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tScarce = 0.1, tNot = cs(176, '文章でも') - 0.3, tInf = cs(177, '無限') - 0.3, tTrust = cs(178, '信頼') - 0.5;
      // perspective field of content icons receding
      const horizon = 380;
      const icons = ['file-text', 'image', 'play'];
      for (let row = 14; row >= 0; row--) {
        const z = 1 + row * 0.9;
        const y = horizon + 560 / z;
        const s = 90 / z;
        const n = Math.ceil(1920 / (s * 1.8)) + 2;
        const drift = (t * 60 / z) % (s * 1.8);
        for (let k = -1; k < n; k++) {
          const x = k * s * 1.8 - drift + (row % 2) * s * 0.9;
          const q = since(t, tNot + row * 0.03, 0.4);
          if (q <= 0) continue;
          ctx.save(); ctx.globalAlpha = q * clamp(1.2 - row / 14) * 0.9;
          icon(ctx, icons[(k + row * 7 + 999) % 3], x, y, s, { color: '#6d6d78', lw: 1.6 });
          if (row < 4 && t > tInf) text(ctx, '¥0', x + s * 0.6, y - s * 0.6, { family: F.mono, size: s * 0.32, weight: 700, color: C.slopDim });
          ctx.restore();
        }
      }
      const g = ctx.createLinearGradient(0, 0, 0, horizon + 60); g.addColorStop(0, '#06060a'); g.addColorStop(1, 'rgba(6,6,10,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, horizon + 60);
      const oq0 = since(t, 0.05, 0.4) * (1 - since(t, tNot - 0.1, 0.3));
      if (oq0 > 0) text(ctx, 'これからネットで希少になるのは…', 960, 540, { family: F.jpHeavy, size: 64, weight: 900, color: C.paper, align: 'center', alpha: oq0 });
      const nq = since(t, tNot, 0.4) * (1 - since(t, tTrust - 0.3, 0.4));
      if (nq > 0) text(ctx, '文章でも、画像でも、動画でもない', 960, 250, { family: F.jpHeavy, size: 58, weight: 900, color: C.paper, align: 'center', alpha: nq });
      const iq = since(t, tInf, 0.4) * (1 - since(t, tTrust - 0.3, 0.4));
      if (iq > 0) text(ctx, '∞ 無限に作れる', 960, 340, { family: F.jpHeavy, size: 46, weight: 900, color: C.slop, align: 'center', alpha: iq });
      // the one warm light
      const tq = since(t, tTrust, 1.0, E.outCubic);
      if (tq > 0) {
        ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.55 * tq})`; ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
        const r = 30 + 8 * Math.sin(t * 3);
        glow(ctx, 960, 560, 420 * tq, '#ffab3d', 0.35 * tq); glow(ctx, 960, 560, 140 * tq, '#ffe2a8', 0.8 * tq);
        circle(ctx, 960, 560, r * tq, '#fff4d8');
        text(ctx, '信頼', 960, 330, { family: F.mincho, size: 150, weight: 900, color: '#ffe2a8', align: 'center', each: riseEach(since(t, tTrust + 0.2, 0.8, E.outExpo), 40, 0.3), shadow: 'rgba(255,171,61,.5)', shadowBlur: 40 });
        text(ctx, '希少になるのは、', 960, 180, { family: F.mincho, size: 44, weight: 900, color: C.paper, align: 'center', alpha: tq });
      }
    },
  };

  // ------------------------------------------------ S86: the four questions
  const QS = [[179, '誰が作ったのか', 'user-round', 'WHO'], [180, 'なぜ作ったのか', 'target', 'WHY'], [181, '何を根拠にしたのか', 'book-open-check', 'SOURCE'], [182, '間違っていたら誰が責任を取るのか', 'shield-check', 'ACCOUNTABILITY']];
  const S86 = {
    id: 'S86', start: cue(179, '誰が') - 0.25, trans: { type: 'glitch', d: 0.4 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.35 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tStrong = cs(183, '強い') - 0.5, tFour = cs(183, '四つ') - 0.3;
      const merge = E.inOutCubic(clamp((t - tFour) / 1.0));
      QS.forEach(([id, s, ic, en], i) => {
        const q = since(t, cue(id) - f.S.start - 0.15, 0.45, E.outBack);
        if (q <= 0) return;
        const gx = 520 + (i % 2) * 880, gy = 330 + Math.floor(i / 2) * 330;
        const x = lerp(gx, 960 + (i % 2 ? 1 : -1) * 150, merge), y = lerp(gy, 470 + (i < 2 ? -1 : 1) * 110, merge);
        const w = lerp(800, 280, merge), h = lerp(270, 200, merge);
        ctx.save(); ctx.translate(x, y); ctx.scale(q, q);
        fillRR(ctx, -w / 2, -h / 2, w, h, 24, '#17140f'); strokeRR(ctx, -w / 2, -h / 2, w, h, 24, rgba(C.human, 0.7), 3);
        icon(ctx, ic, -w / 2 + 90, 0, 90 * (1 - merge * 0.4), { color: C.human, lw: 1.8 });
        if (merge < 0.6) { ctx.save(); ctx.globalAlpha = 1 - merge / 0.6; text(ctx, en, -w / 2 + 180, -40, { family: F.mono, size: 22, weight: 700, color: C.humanDim, ls: 4 }); text(ctx, s, -w / 2 + 180, 30, { family: F.jpHeavy, size: s.length > 10 ? 40 : 54, weight: 900, color: C.paper }); ctx.restore(); }
        else text(ctx, en, 30, 12, { family: F.mono, size: 26, weight: 700, color: C.human, align: 'center', alpha: (merge - 0.6) / 0.4 });
        ctx.restore();
      });
      if (merge > 0) {
        const sq = since(t, tStrong, 0.5, E.outBack);
        ctx.save(); ctx.globalAlpha = merge;
        text(ctx, 'この4つに答えられるコンテンツは', 960, 820, { family: F.jpHeavy, size: 44, weight: 900, color: C.paper, align: 'center' });
        ctx.restore();
        text(ctx, '強い', 960, 940 - 20, { family: F.jpHeavy, size: 90, weight: 900, color: C.human, align: 'center', each: popEach(sq, 0.3) });
      }
    },
  };

  // ------------------------------------------------ S87: three eras of the internet → S88: 検索 → 検証
  const S87 = {
    id: 'S87', start: cue(184, '逆に') - 0.25, trans: { type: 'slice', d: 0.6 }, chapter: CH,
    look: { vign: 0.5, bloom: 0.4, bloomThresh: 0.5 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tTurn = cs(184, '転換点') - 0.5, t1 = cs(185, '昔の') - 0.3, t2 = cs(186, '次の') - 0.3, t3 = cs(187, 'そして') - 0.3, tConf = cs(187, '確認') - 0.4;
      const tq = since(t, 0.1, 0.5) * (1 - since(t, t1 - 0.4, 0.4));
      if (tq > 0) {
        line(ctx, 200, 560, 1720, 560, rgba(C.paper, 0.35), 3);
        const k = since(t, tTurn, 0.5, E.outBack);
        ctx.save(); ctx.translate(1400, 560); ctx.rotate(Math.PI / 4); ctx.scale(k, k); fillRR(ctx, -24, -24, 48, 48, 6, C.slop); ctx.restore();
        text(ctx, '今ここ', 1400, 640, { family: F.jpHeavy, size: 36, weight: 900, color: C.slop, align: 'center', alpha: k * tq });
        text(ctx, 'インターネット史上', 960, 380, { family: F.jpHeavy, size: 50, weight: 900, color: C.mute2, align: 'center', alpha: tq });
        text(ctx, 'かなり変な転換点', 960, 480, { family: F.jpHeavy, size: 90, weight: 900, color: C.paper, align: 'center', alpha: since(t, tTurn, 0.5) * tq });
      }
      if (t < t1 - 0.4) return;
      // panorama of three eras; camera pans panel to panel
      const panel = t < t2 - 0.3 ? 0 : t < t3 - 0.3 ? 1 : 2;
      const tp = [t1, t2, t3][panel];
      const camX = lerp(panel === 0 ? 0 : panel === 1 ? 1920 : 3840, panel === 0 ? 0 : panel === 1 ? 1920 : 3840, 1) - (panel > 0 ? (1 - E.inOutCubic(clamp((t - tp + 0.3) / 0.8))) * 1920 : 0);
      ctx.save(); ctx.translate(-camX, 0);
      const heads = [['昔のネット', '情報が少ない → 探すのが大変', '探す'], ['次のネット', '情報が多すぎる → 選ぶのが大変', '選ぶ'], ['今始まっているネット', '無限に作れる → 確かめるのが大変', '確かめる']];
      heads.forEach(([h, sub, verb], i) => {
        const ox = i * 1920;
        text(ctx, h, ox + 160, 180, { family: F.jpHeavy, size: 60, weight: 900, color: i === 2 ? C.slop : C.paper });
        text(ctx, sub, ox + 160, 250, { family: F.jp, size: 34, weight: 700, color: C.mute2 });
        text(ctx, verb, ox + 1760, 250, { family: F.mincho, size: 110, weight: 900, color: i === 2 ? C.slop : C.human, align: 'right' });
        const cxp = ox + 960, cyp = 600;
        if (i === 0) {
          // sparse dots, a searchlight sweeping
          for (let k = 0; k < 14; k++) circle(ctx, ox + 200 + hash(k * 3) * 1500, 380 + hash(k * 7) * 480, 5, 'rgba(239,235,227,.9)');
          const a = Math.sin(t * 0.9) * 0.6;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(cxp, 1000, 0, cxp, 1000, 900); g.addColorStop(0, 'rgba(255,220,150,.25)'); g.addColorStop(1, 'rgba(255,220,150,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cxp, 1000); ctx.lineTo(cxp + Math.sin(a - 0.18) * 1100, 1000 - Math.cos(a - 0.18) * 1100); ctx.lineTo(cxp + Math.sin(a + 0.18) * 1100, 1000 - Math.cos(a + 0.18) * 1100); ctx.fill();
          ctx.restore();
          text(ctx, '1998', ox + 160, 940 - 40, { family: F.vt, size: 60, color: C.mute });
        } else if (i === 1) {
          for (let k = 0; k < 700; k++) circle(ctx, ox + 160 + hash(k * 3 + 1) * 1600, 360 + hash(k * 7 + 2) * 520, 3.2, 'rgba(239,235,227,.75)');
          // funnel filter
          ctx.save(); ctx.strokeStyle = C.human; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cxp - 220, 420); ctx.lineTo(cxp - 30, 720); ctx.lineTo(cxp - 30, 860); ctx.moveTo(cxp + 220, 420); ctx.lineTo(cxp + 30, 720); ctx.lineTo(cxp + 30, 860); ctx.stroke(); ctx.restore();
          text(ctx, '2012', ox + 160, 940 - 40, { family: F.vt, size: 60, color: C.mute });
        } else {
          // infinite spawning dots, each needs a "?"
          const n = Math.min(900, 60 + Math.floor((t - t3) * 180));
          for (let k = 0; k < n; k++) { const x = ox + 160 + hash(k * 5 + 11) * 1600, y = 330 + hash(k * 9 + 3) * 560; circle(ctx, x, y, 4, k % 2 ? C.slop : 'rgba(239,235,227,.8)'); if (k % 9 === 0) text(ctx, '?', x + 8, y - 6, { family: F.jpHeavy, size: 18, weight: 900, color: C.alert }); }
          ctx.save(); ctx.translate(cxp, 620); icon(ctx, 'search', 0, 0, 220, { color: C.paper, lw: 1.4 }); ctx.restore();
          text(ctx, '2026', ox + 160, 940 - 40, { family: F.vt, size: 60, color: C.slop });
          const cq = since(t, tConf, 0.5);
          if (cq > 0) { fillRR(ctx, ox + 360, 820 - 60, 1200, 90, 16, 'rgba(11,11,13,.9)'); text(ctx, '「そもそも誰かが本当に知っていて書いたのか」', ox + 960, 822, { family: F.jpHeavy, size: 40, weight: 900, color: C.paper, align: 'center', alpha: cq }); }
        }
      });
      ctx.restore();
    },
  };
  const S88 = {
    id: 'S88', start: cue(188, '検索') - 0.2, trans: { type: 'flash', d: 0.3, color: '#ffffff' }, chapter: CH,
    look: { vign: 0.5, bloom: 0.45, bloomThresh: 0.5 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tV = cs(188, '検証') - 0.25;
      const q = since(t, 0, 0.4, E.outExpo);
      const m = clamp((t - tV) / 0.5);
      font(ctx, F.mincho, 330, 900);
      const cx = 960, y = 640;
      text(ctx, '検', cx - 170, y, { family: F.mincho, size: 330, weight: 900, color: C.paper, align: 'center', alpha: q });
      // second glyph morphs: 索 → 証 through a decode flicker
      const second = m <= 0 ? '索' : m >= 1 ? '証' : (flick(t, 30, 3) > 0.5 ? '索' : '証');
      const col = m >= 1 ? C.human : C.paper;
      text(ctx, second, cx + 170, y + (m > 0 && m < 1 ? (flick(t, 30, 5) - 0.5) * 16 : 0), { family: F.mincho, size: 330, weight: 900, color: col, align: 'center', alpha: q });
      if (m > 0 && m < 1) { ctx.save(); ctx.globalAlpha = 0.5; text(ctx, '索', cx + 176, y, { family: F.mincho, size: 330, weight: 900, color: C.alert, align: 'center' }); ctx.restore(); }
      text(ctx, m >= 1 ? 'VERIFY' : 'SEARCH', cx, y + 130, { family: F.grotesk, size: 40, weight: 700, color: m >= 1 ? C.human : C.mute2, align: 'center', ls: 20 });
      text(ctx, m >= 1 ? 'の時代' : 'の時代から、', cx + 420, y - 30, { family: F.mincho, size: 56, weight: 900, color: C.mute2, alpha: q });
    },
  };

  return [S82, S83, S84, S85, S86, S87, S88];
}

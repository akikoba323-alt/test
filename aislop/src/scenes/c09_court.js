// Chapter 09 — courts: hallucinated case law (8:17–9:08)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure, typed } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, check, cross, marker, sketchCircle, cursor, underline } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag, chapterCard } from '../lib/hud.js';
import { paper } from '../lib/textures.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

const CASE = 'Hollander v. Brightwater Logistics, Inc.';
const CITE = '912 F.3d 447 (5th Cir. 2018)';
const CASENO = 'No. 2:19-cv-04417-RJK';

function brief(ctx, x, y, w, h, t, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#fdfcf8'; ctx.fillRect(x, y, w, h);
  ctx.shadowColor = 'transparent';
  // line numbers (pleading paper)
  ctx.strokeStyle = 'rgba(180,30,30,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 70, y); ctx.lineTo(x + 70, y + h); ctx.moveTo(x + 76, y); ctx.lineTo(x + 76, y + h); ctx.stroke();
  for (let i = 1; i <= 24; i++) text(ctx, String(i), x + 50, y + 40 + i * 36, { family: F.times, size: 18, color: '#999', align: 'right' });
  const L = (s, i, o2 = {}) => text(ctx, s, x + 100, y + 40 + i * 36, { family: F.times, size: 25, color: '#111', ...o2 });
  L('MEMORANDUM IN SUPPORT OF MOTION', 1, { weight: 700 });
  L('    Courts in this Circuit have consistently held that', 3);
  L('a carrier who fails to disclose such risks is liable.', 4);
  const cy = y + 40 + 6 * 36;
  if (o.hl) marker(ctx, x + 96, cy - 26, measure(ctx, 'See ' + CASE, { family: F.times, size: 25 }) + 10, 34, o.hl, 'rgba(255,220,40,.6)');
  L('See ' + CASE + ',', 6, { style: 'italic' });
  L(CITE + '.', 7);
  if (o.bad) { const w = measure(ctx, CITE + '.', { family: F.times, size: 25 }); sketchCircle(ctx, x + 100 + w / 2, y + 40 + 7 * 36 - 8, w / 2 + 40, 60, o.bad, C.alert, 5); }
  L('    Moreover, the duty extends to subsidiaries that', 9);
  L('operate under a shared logistics agreement.', 10);
  ctx.restore();
}

export function courtScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('09', '法廷', 'COURT', cue(97, 'そして') - 0.2);

  // ------------------------------------------------ S55: 1,395 cases
  const S55 = {
    id: 'S55', start: cue(97, 'そして') - 0.2, trans: { type: 'dip', d: 0.5, color: '#000000' }, chapter: CH,
    source: 'Reuters（2026年9月）', sourceAt: 3.4,
    look: { vign: 0.5, bloom: 0.25, gain: [1.0, 0.99, 0.96] },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tR = cs(98, 'Reuters') - 0.2, tUS = cs(98, 'アメリカ') - 0.3, tN = cs(98, '千三百') - 0.9, tFed = cs(98, '連邦') - 0.2;
      chapterCard(ctx, t - 0.05, CH, 2.8);
      // courthouse silhouette
      const cq = since(t, 0.3, 1.0);
      ctx.save(); ctx.globalAlpha = 0.22 * cq;
      ctx.fillStyle = '#e8e2d4';
      ctx.beginPath(); ctx.moveTo(1180, 250); ctx.lineTo(1520, 130); ctx.lineTo(1860, 250); ctx.fill();
      for (let k = 0; k < 6; k++) ctx.fillRect(1210 + k * 118, 280, 50, 420);
      ctx.fillRect(1170, 262, 700, 18); ctx.fillRect(1150, 700, 740, 30); ctx.fillRect(1130, 730, 780, 30);
      ctx.restore();
      if (t < tR - 0.3) return;
      // unit chart of case folders
      const cols = 45, n = 1395;
      const shown = Math.floor(n * E.outCubic(clamp((t - tN) / 1.8)));
      const x0 = 150, y0 = 330, cw = 22, ch = 17;
      for (let i = 0; i < n; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        const x = x0 + c * cw, y = y0 + r * ch;
        if (i >= shown) { if (t > tUS) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x, y, cw - 5, ch - 5); } continue; }
        ctx.fillStyle = '#d8c79a'; ctx.fillRect(x, y + 2, cw - 5, ch - 7); ctx.fillRect(x, y, (cw - 5) * 0.45, 3);
      }
      const q = since(t, tR, 0.5);
      text(ctx, '生成AI由来の誤りが確認された', 150, 220, { family: F.jp, size: 32, weight: 700, color: C.mute2, alpha: q });
      text(ctx, 'アメリカの裁判案件', 150, 280, { family: F.jpHeavy, size: 46, weight: 900, color: C.paper, alpha: since(t, tUS, 0.4) });
      if (t > tN) {
        fillRR(ctx, 1230, 780 - 170, 620, 220, 18, 'rgba(11,11,13,.9)');
        text(ctx, '少なくとも', 1260, 680, { family: F.jpHeavy, size: 36, weight: 900, color: C.mute2 });
        odometer(ctx, shown, 1260, 800, { family: F.bebas, size: 130, color: C.paper });
        text(ctx, '件', 1560, 800, { family: F.jpHeavy, size: 56, weight: 900, color: C.paper });
        text(ctx, '連邦・州の合計', 1640, 800, { family: F.jp, size: 24, weight: 700, color: C.mute2, alpha: since(t, tFed, 0.4) });
      }
    },
  };

  // ------------------------------------------------ S56: the brief, the database, "no such case"
  const S56 = {
    id: 'S56', start: cue(100, '実在') - 0.4, trans: { type: 'slice', d: 0.55 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.2 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tName = cs(100, '事件名') - 0.3, tSearch = cs(101, '引用された') - 0.2, tNone = cs(101, 'そんな裁判') - 0.3, tOld = cs(102, '昔なら') - 0.2, tFake = cs(102, '捏造') - 0.3, tDel = cs(102, '意識的') - 0.3;
      ctx.fillStyle = '#16140f'; ctx.fillRect(0, 0, 1920, 1080);
      const oldK = E.inOutCubic(clamp((t - tOld) / 0.7));
      // brief
      ctx.save(); ctx.translate(-oldK * 700, 0);
      brief(ctx, 110, 90, 980, 900, t, { hl: since(t, tName, 0.5), bad: since(t, tNone + 0.4, 0.6) });
      ctx.restore();
      text(ctx, '存在しない判例を引用', 150 - oldK * 700, 1000 - 60, { family: F.jpHeavy, size: 34, weight: 900, color: C.alert, alpha: since(t, 0.1, 0.4) * (1 - oldK) });
      // search panel
      const sq = since(t, tSearch, 0.5, E.outExpo) * (1 - oldK);
      if (sq > 0) {
        const px = 1150, py = 250;
        ctx.save(); ctx.globalAlpha = sq; ctx.translate((1 - sq) * 80, 0);
        fillRR(ctx, px, py, 680, 520, 16, '#fbfaf7');
        ctx.fillStyle = '#1f2a44'; ctx.fillRect(px, py, 680, 64);
        text(ctx, '判例データベース', px + 30, py + 42, { family: F.jpHeavy, size: 28, weight: 700, color: '#fff' });
        fillRR(ctx, px + 30, py + 100, 620, 64, 10, '#fff'); strokeRR(ctx, px + 30, py + 100, 620, 64, 10, '#b8b3a8', 2);
        icon(ctx, 'search', px + 62, py + 132, 28, { color: '#666' });
        const q = typed(CASE, clamp((t - tSearch - 0.3) / 1.2));
        text(ctx, q, px + 90, py + 142, { family: F.times, size: 24, style: 'italic', color: '#111' });
        if (Math.floor(t * 2.5) % 2 === 0 && q.length < CASE.length) { ctx.fillStyle = '#111'; ctx.fillRect(px + 92 + measure(ctx, q, { family: F.times, size: 24, style: 'italic' }), py + 116, 3, 32); }
        const nq = since(t, tNone, 0.4, E.outBack);
        if (nq > 0) {
          cross(ctx, px + 340, py + 300, 90, nq, C.alert, 12);
          text(ctx, '該当する判例は見つかりませんでした', px + 340, py + 420, { family: F.jpHeavy, size: 30, weight: 900, color: '#111', align: 'center', alpha: nq });
          text(ctx, '0 件', px + 340, py + 470, { family: F.mono, size: 28, weight: 700, color: C.alert, align: 'center', alpha: nq });
        }
        ctx.restore();
        text(ctx, 'そんな裁判はない', 1490, 880, { family: F.jpHeavy, size: 60, weight: 900, color: C.alert, align: 'center', each: popEach(since(t, tNone + 0.2, 0.4), 0.3) });
      }
      // old times: forging precedent was deliberate
      if (oldK > 0) {
        const x = 1280;
        ctx.save(); ctx.globalAlpha = oldK;
        glow(ctx, x - 80, 420, 420, '#ffb040', 0.35);
        // candle + quill
        fillRR(ctx, x - 300, 520, 40, 140, 6, '#f2e6c9'); ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.ellipse(x - 280, 500 + Math.sin(t * 9) * 3, 12, 26, 0, 0, Math.PI * 2); ctx.fill();
        icon(ctx, 'feather', x - 120, 560, 150, { color: C.human, lw: 1.3 });
        text(ctx, '昔の「判例の捏造」', x, 260, { family: F.jpHeavy, size: 50, weight: 900, color: C.paper, align: 'center' });
        text(ctx, '＝ かなり意識的な不正', x, 800, { family: F.jpHeavy, size: 56, weight: 900, color: C.human, align: 'center', each: riseEach(since(t, tDel, 0.5), 30, 0.3) });
        ctx.restore();
      }
    },
  };

  // ------------------------------------------------ S57: ask the AI, paste as-is
  const S57 = {
    id: 'S57', start: cue(103, '今は') - 0.25, trans: { type: 'glitch', d: 0.4 }, chapter: CH,
    look: { vign: 0.4, bloom: 0.3 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tAsk = cs(103, 'AIに聞いて') - 0.3, tPaste = cs(103, 'そのまま') - 0.2, tHap = cs(103, '発生') - 0.3;
      // chat window
      const cx = 140, cy = 180;
      fillRR(ctx, cx, cy, 760, 640, 18, '#17171c'); strokeRR(ctx, cx, cy, 760, 640, 18, 'rgba(255,255,255,.08)', 2);
      text(ctx, 'AI アシスタント', cx + 30, cy + 50, { family: F.jpHeavy, size: 26, weight: 700, color: C.mute2 });
      const q1 = since(t, tAsk, 0.4);
      if (q1 > 0) { fillRR(ctx, cx + 260, cy + 90, 460, 90, 18, '#2b2b33'); text(ctx, '運送業者の責任を認めた判例を', cx + 290, cy + 128, { family: F.jp, size: 24, color: C.paper, alpha: q1 }); text(ctx, '教えて', cx + 290, cy + 160, { family: F.jp, size: 24, color: C.paper, alpha: q1 }); }
      const q2 = since(t, tAsk + 0.5, 0.3);
      if (q2 > 0) {
        fillRR(ctx, cx + 30, cy + 210, 660, 230, 18, '#20261a');
        text(ctx, 'はい。代表的な判例は次の通りです：', cx + 60, cy + 256, { family: F.jp, size: 24, color: C.paper });
        const sel = t > tPaste - 0.5;
        if (sel) ctx.fillStyle = 'rgba(80,140,255,.45)', ctx.fillRect(cx + 56, cy + 280, 610, 90);
        text(ctx, typed(CASE + ',', clamp((t - tAsk - 0.6) * 3)), cx + 60, cy + 314, { family: F.times, size: 25, style: 'italic', color: '#e8f5c8' });
        text(ctx, typed(CITE, clamp((t - tAsk - 0.9) * 3)), cx + 60, cy + 352, { family: F.times, size: 25, color: '#e8f5c8' });
        text(ctx, '（確認済み）', cx + 60, cy + 410, { family: F.jp, size: 22, color: C.slopDim });
      }
      // keys
      const key = (x, y, lab, press) => { fillRR(ctx, x, y + 14, 130, 120, 16, '#08080a'); fillRR(ctx, x, y + 14 * press, 130, 120, 16, '#e9e6de'); text(ctx, lab, x + 65, y + 14 * press + 78, { family: F.sans, size: 52, weight: 800, color: '#111', align: 'center' }); };
      const pC = pulse(t, tPaste - 0.4, 0.05, 0.15), pV = pulse(t, tPaste + 0.1, 0.05, 0.15);
      key(980, 300, '⌘', Math.max(pC, pV)); key(1130, 300, 'C', pC); key(1280, 300, 'V', pV);
      text(ctx, 'コピー → ペースト', 1200, 520, { family: F.jpHeavy, size: 40, weight: 900, color: C.paper, align: 'center', alpha: since(t, tPaste - 0.4, 0.4) });
      // pasted into the brief
      const bq = since(t, tPaste + 0.1, 0.5, E.outExpo);
      if (bq > 0) {
        ctx.save(); ctx.globalAlpha = bq; ctx.translate(980, 600);
        fillRR(ctx, 0, 0, 800, 230, 8, '#fdfcf8');
        text(ctx, 'See ' + CASE + ',', 30, 60, { family: F.times, size: 25, style: 'italic', color: '#111' });
        text(ctx, CITE + '.', 30, 100, { family: F.times, size: 25, color: '#111' });
        text(ctx, '準備書面.docx', 30, 190, { family: F.mono, size: 20, color: '#888' });
        ctx.restore();
      }
      const hq = since(t, tHap, 0.4, E.outBack);
      if (hq > 0) text(ctx, 'で発生する', 1780, 900 - 30, { family: F.jpHeavy, size: 60, weight: 900, color: C.alert, align: 'right', each: popEach(hq, 0.3) });
    },
  };

  // ------------------------------------------------ S58: confident case numbers; hedging human vs 12pt lies
  const S58 = {
    id: 'S58', start: cue(104, 'しかも') - 0.25, trans: { type: 'whip', d: 0.4, dir: [-1, 0] }, chapter: CH,
    look: { vign: 0.45, bloom: 0.25 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tNo = cs(104, '事件番号') - 0.3, tConf = cs(105, '自信') - 0.4, tHum = cs(106, '人間なら') - 0.2, tMaybe = cs(106, 'たぶん') - 0.2, tMem = cs(106, '記憶違い') - 0.2, tAI = cs(106, 'AIは') - 0.2, t12 = cs(106, '十二') - 0.4, tLie = cs(106, '平然と') - 0.3;
      const phase2 = E.inOutCubic(clamp((t - tHum) / 0.6));
      // phase 1: stamping a case number with full confidence
      if (phase2 < 1) {
        ctx.save(); ctx.globalAlpha = 1 - phase2;
        fillRR(ctx, 260, 250, 1400, 330, 12, '#fdfcf8');
        text(ctx, '架空の判例', 300, 320, { family: F.jpHeavy, size: 34, weight: 900, color: '#999' });
        text(ctx, CASE, 300, 400, { family: F.times, size: 44, style: 'italic', color: '#111' });
        const sq = since(t, tNo, 0.2);
        if (sq > 0) {
          const s = lerp(2, 1, E.outQuad(sq));
          ctx.save(); ctx.translate(960, 500); ctx.scale(s, s); ctx.globalAlpha *= sq;
          text(ctx, CASENO, 0, 16, { family: F.courier, size: 60, weight: 700, color: '#1f2a44', align: 'center' });
          ctx.restore();
        }
        // confidence gauge
        const cq = since(t, tConf, 0.5);
        if (cq > 0) {
          fillRR(ctx, 560, 680, 800, 60, 30, '#26262d');
          fillRR(ctx, 560, 680, 800 * E.outCubic(cq), 60, 30, C.slop);
          text(ctx, '自信 100%', 960, 722, { family: F.jpHeavy, size: 36, weight: 900, color: C.ink, align: 'center' });
          text(ctx, '間違えるときも', 960, 820, { family: F.jpHeavy, size: 44, weight: 900, color: C.paper, align: 'center', alpha: cq });
        }
        ctx.restore();
      }
      if (phase2 <= 0) return;
      // phase 2: human (hedging) vs AI (12pt)
      ctx.save(); ctx.globalAlpha = phase2;
      line(ctx, 960, 160, 960, 900, rgba(C.paper, 0.15), 2);
      // human face
      const hx = 480, hy = 470;
      text(ctx, '人間なら', hx, 190, { family: F.jpHeavy, size: 44, weight: 900, color: C.human, align: 'center' });
      circle(ctx, hx, hy, 150, '#f3c9a3');
      circle(ctx, hx - 50, hy - 20, 12, '#222'); circle(ctx, hx + 50, hy - 20, 12, '#222');
      ctx.strokeStyle = '#222'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(hx - 80, hy - 60); ctx.lineTo(hx - 30, hy - 50); ctx.moveTo(hx + 30, hy - 50); ctx.lineTo(hx + 80, hy - 66); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - 40, hy + 60); ctx.quadraticCurveTo(hx - 10, hy + 40 + Math.sin(t * 8) * 4, hx + 20, hy + 62); ctx.quadraticCurveTo(hx + 35, hy + 70, hx + 45, hy + 55); ctx.stroke();
      for (let k = 0; k < 2; k++) { const a = (t * 0.8 + k * 0.5) % 1; ctx.fillStyle = `rgba(120,190,255,${1 - a})`; ctx.beginPath(); ctx.ellipse(hx + 120 + k * 20, hy - 70 + a * 90, 9, 14, 0, 0, Math.PI * 2); ctx.fill(); }
      const b1 = since(t, tMaybe, 0.4, E.outBack), b2 = since(t, tMem, 0.4, E.outBack);
      if (b1 > 0) { ctx.save(); ctx.translate(hx - 170, hy + 250); ctx.scale(b1, b1); fillRR(ctx, -120, -45, 240, 90, 45, C.paper); text(ctx, 'たぶん…', 0, 16, { family: F.hand, size: 40, weight: 600, color: '#333', align: 'center' }); ctx.restore(); }
      if (b2 > 0) { ctx.save(); ctx.translate(hx + 150, hy + 300); ctx.scale(b2, b2); fillRR(ctx, -170, -45, 340, 90, 45, C.paper); text(ctx, '記憶違いかも…', 0, 16, { family: F.hand, size: 38, weight: 600, color: '#333', align: 'center' }); ctx.restore(); }
      // AI side: the 12pt spec sheet
      const ax = 1440;
      const aq = since(t, tAI, 0.4);
      text(ctx, 'AIは', ax, 190, { family: F.jpHeavy, size: 44, weight: 900, color: C.slop, align: 'center', alpha: aq });
      if (aq > 0) {
        // toolbar
        fillRR(ctx, ax - 400, 250, 800, 76, 10, '#e9e7e1');
        fillRR(ctx, ax - 380, 264, 420, 48, 6, '#fff'); text(ctx, 'Times New Roman', ax - 364, 298, { family: F.times, size: 28, color: '#111' });
        const q12 = since(t, t12, 0.3, E.outBack);
        fillRR(ctx, ax + 60, 264, 110, 48, 6, '#fff'); strokeRR(ctx, ax + 60, 264, 110, 48, 6, q12 > 0 ? C.alert : '#bbb', q12 > 0 ? 4 : 1.5);
        text(ctx, '12', ax + 115, 300, { family: F.sans, size: 30, weight: 700, color: '#111', align: 'center' });
        text(ctx, 'B  I  U', ax + 250, 300, { family: F.times, size: 30, weight: 700, color: '#555' });
        if (q12 > 0) { ctx.save(); ctx.translate(ax + 115, 250); ctx.scale(q12, q12); text(ctx, 'フォントサイズ 12', 0, -24, { family: F.jpHeavy, size: 30, weight: 900, color: C.alert, align: 'center' }); ctx.restore(); }
        // the lie in perfect 12pt
        fillRR(ctx, ax - 400, 360, 800, 440, 6, '#fdfcf8');
        const lq = since(t, tLie, 0.6);
        const lines = ['See Hollander v. Brightwater', 'Logistics, Inc., 912 F.3d 447', '(5th Cir. 2018) (holding that', 'carriers are liable for...).'];
        lines.forEach((s, i) => text(ctx, s, ax - 360, 430 + i * 60, { family: F.times, size: 34, style: i === 0 || i === 1 ? 'italic' : 'normal', color: '#111' }));
        ctx.save(); ctx.globalAlpha = lq;
        text(ctx, '行間 2.0 ／ 両端揃え ／ 誤字なし', ax, 760, { family: F.jp, size: 24, weight: 700, color: '#888', align: 'center' });
        ctx.restore();
        text(ctx, '平然とウソをつく', ax, 880, { family: F.jpHeavy, size: 60, weight: 900, color: C.alert, align: 'center', each: popEach(since(t, tLie + 0.3, 0.4), 0.3) });
      }
      ctx.restore();
      noteTag(ctx, t - 1, '※ 判例名・番号はすべて架空の例です', 1880, 1000 - 50);
    },
  };

  return [S55, S56, S57, S58];
}

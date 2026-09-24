// Chapter 08 — books (6:58–8:17)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, check, cross, marker, poly, sketchCircle } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag, chapterCard } from '../lib/hud.js';
import { bookCover, atlas } from '../lib/thumbs.js';
import { paper } from '../lib/textures.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

function genericCover(ctx, x, y, w, h, seed, o = {}) {
  const r = rng(seed * 41 + 3);
  const cols = [['#1f3b57', '#e9c46a'], ['#264653', '#f4a261'], ['#3d2c4f', '#f2cc8f'], ['#1b4332', '#95d5b2'], ['#6d2e46', '#f6bd60']][seed % 5];
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = cols[0]; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = cols[1]; ctx.fillRect(x, y + h * 0.62, w, h * 0.06);
  for (let k = 0; k < 3; k++) { ctx.fillStyle = rgba('#ffffff', 0.85); ctx.fillRect(x + w * 0.12, y + h * (0.16 + k * 0.08), w * (0.76 - k * 0.12), h * 0.045); }
  text(ctx, o.author || 'Jane Friedman', x + w / 2, y + h * 0.86, { family: F.garamond, size: w * 0.11, weight: 600, color: cols[1], align: 'center' });
  ctx.restore();
}

// engraving-style mushroom illustration
function mushroom(ctx, x, y, s, kind, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  // stem
  ctx.fillStyle = '#efe4cf';
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.bezierCurveTo(-30, 80, -22, 160, -36, 200); ctx.lineTo(36, 200); ctx.bezierCurveTo(22, 160, 30, 80, 26, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let k = 0; k < 14; k++) { const yy = 20 + k * 12; ctx.beginPath(); ctx.moveTo(10, yy); ctx.lineTo(24, yy + 6); ctx.stroke(); }
  if (kind === 'b') { ctx.beginPath(); ctx.ellipse(0, 70, 34, 10, 0, 0, Math.PI * 2); ctx.stroke(); }
  // cap
  const capW = kind === 'a' ? 120 : 130, capH = kind === 'a' ? 90 : 70;
  ctx.fillStyle = kind === 'a' ? '#c9a27a' : '#d8c3a0';
  ctx.beginPath(); ctx.moveTo(-capW, 4); ctx.bezierCurveTo(-capW, -capH * 1.4, capW, -capH * 1.4, capW, 4); ctx.quadraticCurveTo(0, 22, -capW, 4); ctx.fill(); ctx.stroke();
  // hatching on the cap
  ctx.save(); ctx.beginPath(); ctx.moveTo(-capW, 4); ctx.bezierCurveTo(-capW, -capH * 1.4, capW, -capH * 1.4, capW, 4); ctx.quadraticCurveTo(0, 22, -capW, 4); ctx.clip();
  ctx.lineWidth = 1.3;
  for (let k = -capW; k < capW; k += 7) { ctx.beginPath(); ctx.moveTo(k, 10); ctx.lineTo(k + 40, -capH * 1.2); ctx.globalAlpha = 0.25 + 0.5 * Math.max(0, k / capW); ctx.stroke(); }
  ctx.restore();
  if (kind === 'b') for (let k = 0; k < 9; k++) { const a = -2.6 + k * 0.33; circle(ctx, Math.cos(a) * capW * 0.6, -capH * 0.55 + Math.sin(a) * capH * 0.35, 7, '#f7efe0', '#2a2016', 1.5); }
  // gills
  ctx.lineWidth = 1.2; ctx.globalAlpha = 0.6;
  for (let k = -capW + 10; k < capW - 10; k += 9) { ctx.beginPath(); ctx.moveTo(k * 0.95, 8); ctx.lineTo(k * 0.3, 14); ctx.stroke(); }
  ctx.restore();
}

export function bookScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('08', '本', 'BOOKS', cue(82, '本も') - 0.2);

  // ------------------------------------------------ S48: books under someone else's name
  const S48 = {
    id: 'S48', start: cue(82, '本も') - 0.2, trans: { type: 'slice', d: 0.6 }, chapter: CH,
    source: '報道（2023年）：Jane Friedman の名前で出回ったAI生成とみられる本', sourceAt: 2.6,
    look: { vign: 0.4, bloom: 0.2 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tJF = cs(83, 'Jane') - 0.3, tNot = cs(83, '本人が書いていない') - 0.2, tSus = cs(84, '本人は') - 0.2, tDel = cs(84, '五冊') - 0.3;
      chapterCard(ctx, t - 0.05, CH, 2.4);
      if (t < 2.3) return;
      // store page
      const sx = 200, sy = 140, sw = 1520, sh = 740;
      const pq = since(t, 2.3, 0.5, E.outExpo);
      ctx.save(); ctx.globalAlpha = pq; ctx.translate(0, (1 - pq) * 60);
      fillRR(ctx, sx, sy, sw, sh, 14, '#f7f6f2');
      ctx.fillStyle = '#232f3e'; ctx.fillRect(sx, sy, sw, 64);
      text(ctx, 'BOOK STORE', sx + 30, sy + 42, { family: F.grotesk, size: 26, weight: 700, color: '#fff', ls: 4 });
      fillRR(ctx, sx + 300, sy + 14, 800, 36, 6, '#fff');
      text(ctx, '著者: Jane Friedman', sx + 60, sy + 140, { family: F.jpHeavy, size: 44, weight: 900, color: '#111', each: decodeEach(since(t, tJF, 0.8), t, 3, false, '#111') });
      text(ctx, '検索結果 5件', sx + 60, sy + 190, { family: F.jp, size: 24, weight: 500, color: '#666' });
      for (let i = 0; i < 5; i++) {
        const bx = sx + 70 + i * 290, by = sy + 240;
        const dq = clamp((t - tDel - i * 0.35) / 0.4);
        ctx.save();
        ctx.globalAlpha = 1 - dq;
        genericCover(ctx, bx, by, 220, 320, i);
        for (let k = 0; k < 2; k++) { ctx.fillStyle = '#ccc'; ctx.fillRect(bx, by + 340 + k * 22, 200 - k * 60, 12); }
        for (let k = 0; k < 5; k++) { ctx.fillStyle = '#f5a623'; ctx.beginPath(); ctx.arc(bx + 10 + k * 22, by + 400, 8, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        if (dq > 0) {
          const q = since(t, tDel + i * 0.35, 0.25, E.outBack);
          ctx.save(); ctx.translate(bx + 110, by + 160); ctx.rotate(-0.2); ctx.scale(q, q);
          strokeRR(ctx, -95, -40, 190, 80, 8, '#c8202a', 7);
          text(ctx, '削除', 0, 22, { family: F.jpHeavy, size: 56, weight: 900, color: '#c8202a', align: 'center' });
          ctx.restore();
        }
      }
      ctx.restore();
      // the author: "I didn't write these"
      const nq = since(t, tNot, 0.5, E.outBack) * (1 - since(t, tSus - 0.2, 0.3));
      if (nq > 0) {
        ctx.save(); ctx.translate(1500, 780); ctx.scale(nq, nq);
        fillRR(ctx, -250, -70, 500, 120, 60, '#111');
        text(ctx, '本人が書いていない', 0, 12, { family: F.jpHeavy, size: 44, weight: 900, color: C.alert, align: 'center' });
        ctx.restore();
      }
      const sq = since(t, tSus, 0.4) * (1 - since(t, tDel - 0.3, 0.3));
      if (sq > 0) { fillRR(ctx, 560, 800, 800, 90, 45, '#111'); text(ctx, '本人「AIで生成されたのでは？」', 960, 858, { family: F.jpHeavy, size: 40, weight: 900, color: C.paper, align: 'center', alpha: sq }); }
      const cq = since(t, tDel + 1.8, 0.4, E.outBack);
      if (cq > 0) text(ctx, '最終的に 5冊が削除', 960, 860, { family: F.jpHeavy, size: 60, weight: 900, color: C.alert, align: 'center', each: popEach(cq, 0.3) });
    },
  };

  // ------------------------------------------------ S49: 15 books in one day
  const S49 = {
    id: 'S49', start: cue(85, '同じ年') - 0.25, trans: { type: 'whip', d: 0.45, dir: [0, 1] }, chapter: CH,
    source: '報道（2023年）', sourceAt: 0.5,
    look: { vign: 0.4, bloom: 0.25 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tName = cs(85, 'Steven') - 0.3, tDay = cs(85, '一日に') - 0.4, t15 = cs(85, '十五') - 0.3;
      grid(ctx, 60, 'rgba(255,255,255,0.03)');
      text(ctx, '「Steven Walryn」名義', 960, 190, { family: F.jpHeavy, size: 56, weight: 900, color: C.paper, align: 'center', each: decodeEach(since(t, tName, 0.8), t, 7, false, C.paper) });
      // day axis
      const x0 = 200, x1 = 1720, y = 720;
      const aq = since(t, tDay, 0.6);
      line(ctx, x0, y, lerp(x0, x1, aq), y, rgba(C.paper, 0.6), 3);
      for (let h = 0; h <= 24; h += 3) { const x = lerp(x0, x1, h / 24); ctx.save(); ctx.globalAlpha = aq; line(ctx, x, y, x, y + 14, rgba(C.paper, 0.6), 2); text(ctx, `${String(h).padStart(2, '0')}:00`, x, y + 48, { family: F.mono, size: 22, color: C.mute2, align: 'center' }); ctx.restore(); }
      text(ctx, '1日', x0 - 30, y + 10, { family: F.jpHeavy, size: 34, weight: 900, color: C.mute2, align: 'right', alpha: aq });
      // books dropping at publication times
      const r = rng(15);
      let n = 0;
      for (let i = 0; i < 15; i++) {
        const hour = 1 + i * 1.5 + r() * 0.9;
        const tt = tDay + 0.3 + i * 0.22;
        const q = clamp((t - tt) / 0.35);
        if (q <= 0) continue;
        n++;
        const x = lerp(x0, x1, hour / 24);
        const stackY = y - 12 - 150;
        const yy = lerp(stackY - 300, stackY, E.outBounce(q));
        ctx.save(); ctx.translate(x, yy); ctx.rotate((hash(i) - 0.5) * 0.15);
        bookCover(ctx, -45, -65, 90, 135, i + 40, ['dog', 'hokkaido', 'invest', 'mushroom'][i % 4], { stamp: false, author: 'S. Walryn' });
        ctx.restore();
        text(ctx, `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`, x, y - 250 + 0, { family: F.mono, size: 16, color: C.mute, align: 'center', alpha: q });
      }
      if (n > 0) {
        odometer(ctx, n, 820, 400, { family: F.bebas, size: 170, color: C.slop, align: 'right' });
        text(ctx, '冊', 840, 400, { family: F.jpHeavy, size: 64, weight: 900, color: C.slop });
        text(ctx, '1日で公開（AI生成とみられる）', 920, 400, { family: F.jpHeavy, size: 40, weight: 900, color: C.paper, alpha: since(t, t15, 0.4) });
      }
    },
  };

  // ------------------------------------------------ S50: KDP disclosure form
  const S50 = {
    id: 'S50', start: cue(86, 'Amazon') - 0.25, trans: { type: 'fade', d: 0.4 }, chapter: CH,
    source: 'Amazon KDP コンテンツガイドライン', sourceAt: 0.5,
    look: { vign: 0.4, bloom: 0.2 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tText = cs(86, '文章') - 0.2, tImg = cs(86, '画像') - 0.2, tTr = cs(86, '翻訳') - 0.2, tAsk = cs(86, '申告') - 0.3;
      const fx = 460, fy = 170, fw = 1000, fh = 680;
      const q = since(t, 0.05, 0.5, E.outExpo);
      ctx.save(); ctx.globalAlpha = q; ctx.translate(0, (1 - q) * 40);
      fillRR(ctx, fx, fy, fw, fh, 16, '#fbfaf7');
      ctx.fillStyle = '#232f3e'; ctx.fillRect(fx, fy, fw, 70);
      text(ctx, 'KDP ─ 出版の詳細', fx + 36, fy + 46, { family: F.jpHeavy, size: 30, weight: 700, color: '#fff' });
      text(ctx, 'AI生成コンテンツ', fx + 50, fy + 150, { family: F.jpHeavy, size: 44, weight: 900, color: '#111' });
      text(ctx, 'この本にAIで生成したコンテンツを使用しましたか？', fx + 50, fy + 205, { family: F.jp, size: 28, weight: 500, color: '#444' });
      [[tText, '文章'], [tImg, '画像'], [tTr, '翻訳']].forEach(([tt, s], i) => {
        const y = fy + 300 + i * 100;
        strokeRR(ctx, fx + 60, y - 38, 52, 52, 8, '#333', 3);
        const c = since(t, tt, 0.35);
        if (c > 0) { fillRR(ctx, fx + 60, y - 38, 52, 52, 8, '#1d4ed8'); check(ctx, fx + 86, y - 12, 34, c, '#fff', 6); }
        text(ctx, s, fx + 140, y, { family: F.jpHeavy, size: 44, weight: 900, color: '#111' });
        text(ctx, 'はい、AIで生成しました', fx + 330, y, { family: F.jp, size: 26, color: c > 0 ? '#1d4ed8' : '#aaa' });
      });
      ctx.restore();
      const aq = since(t, tAsk, 0.4, E.outBack);
      if (aq > 0) {
        ctx.save(); ctx.translate(1400, 790); ctx.rotate(-0.12); ctx.scale(aq, aq);
        fillRR(ctx, -210, -52, 420, 104, 52, C.slop);
        text(ctx, '申告が必要に', 0, 18, { family: F.jpHeavy, size: 50, weight: 900, color: C.ink, align: 'center' });
        ctx.restore();
      }
    },
  };

  // ------------------------------------------------ S51: why? cost cliff + the 3,000-page tower
  const S51 = {
    id: 'S51', start: cue(87, 'なぜ') - 0.25, trans: { type: 'glitch', d: 0.4 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.25 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tEasy = cs(88, '簡単') - 0.2, tCost = cs(89, 'コスト') - 0.5, tOld = cs(90, '昔なら') - 0.3, t300 = cs(90, '三百') - 0.3, tMad = cs(90, '狂気') - 0.4;
      const q0 = since(t, 0, 0.4) * (1 - since(t, tEasy + 0.3, 0.3));
      if (q0 > 0) {
        text(ctx, 'なぜ本まで', 960, 440, { family: F.jpHeavy, size: 80, weight: 900, color: C.paper, align: 'center', alpha: q0 });
        text(ctx, 'slop化するのか', 960, 560, { family: F.jpHeavy, size: 110, weight: 900, color: C.slop, align: 'center', alpha: q0 });
      }
      const eq = since(t, tEasy, 0.3, E.outBack) * (1 - since(t, tCost - 0.1, 0.3));
      if (eq > 0) text(ctx, '簡単です。', 960, 560, { family: F.jpHeavy, size: 150, weight: 900, color: C.paper, align: 'center', each: popEach(eq, 0.3) });
      // cost cliff chart
      const cq = since(t, tCost, 0.5) * (1 - since(t, tOld, 0.4));
      if (cq > 0) {
        ctx.save(); ctx.globalAlpha = cq;
        const x0 = 300, x1 = 1640, yT = 260, yB = 800;
        line(ctx, x0, yB, x1, yB, rgba(C.paper, 0.5), 2); line(ctx, x0, yT, x0, yB, rgba(C.paper, 0.5), 2);
        text(ctx, '本1冊を書くコスト', x0, yT - 30, { family: F.jpHeavy, size: 34, weight: 900, color: C.paper });
        const p = clamp((t - tCost) / 1.4);
        const pts = [];
        for (let i = 0; i <= 60; i++) { const u = i / 60; if (u > p) break; const x = lerp(x0, x1, u); const y = u < 0.72 ? yT + 60 + u * 40 : lerp(yT + 90, yB - 20, E.outExpo((u - 0.72) / 0.28)); pts.push([x, y]); }
        ctx.lineCap = 'round'; poly(ctx, pts, 1, C.human, 6);
        if (p > 0.1) text(ctx, '数ヶ月〜数年', x0 + 30, yT + 40, { family: F.jp, size: 26, weight: 700, color: C.human });
        if (p > 0.95) { text(ctx, '数分', x1 - 20, yB - 40, { family: F.jpHeavy, size: 40, weight: 900, color: C.slop, align: 'right' }); text(ctx, '生成AI', lerp(x0, x1, 0.72), yB + 50, { family: F.jp, size: 26, weight: 700, color: C.slop, align: 'center' }); }
        text(ctx, '激減', 1200, 520, { family: F.jpHeavy, size: 120, weight: 900, color: C.slop, each: popEach(since(t, tCost + 1.2, 0.4)) });
        ctx.restore();
      }
      // tower of pages
      if (t > tOld - 0.2) {
        const tq = since(t, tOld, 0.4);
        const pages = Math.floor(3000 * E.outCubic(clamp((t - t300) / 2.2)));
        const baseY = 880, px = 1100;
        for (let i = 0; i < pages; i += 6) {
          const y = baseY - i * 0.22;
          ctx.fillStyle = i % 300 < 6 ? '#d8cfbd' : '#f0e9dc';
          ctx.fillRect(px - 150 + Math.sin(i * 0.05) * 4, y, 300, 1.6);
        }
        // tiny human
        ctx.save(); ctx.globalAlpha = tq;
        circle(ctx, 820, 800, 16, C.human); fillRR(ctx, 804, 818, 32, 50, 12, C.human);
        for (let k = 0; k < 3; k++) { const a = (t * 3 + k) % 1; circle(ctx, 850 + k * 8, 790 + a * 30, 4, 'rgba(120,190,255,.8)'); }
        ctx.restore();
        text(ctx, '300ページ × 10冊', 380, 400, { family: F.jpHeavy, size: 64, weight: 900, color: C.paper, alpha: since(t, t300, 0.4) });
        text(ctx, `${fmt(pages)} ページ`, 380, 480, { family: F.mono, size: 40, weight: 700, color: C.mute2, alpha: since(t, t300, 0.4) });
        text(ctx, '＝ 狂気', 380, 620, { family: F.jpHeavy, size: 110, weight: 900, color: C.alert, each: popEach(since(t, tMad, 0.4)) });
      }
    },
  };

  // ------------------------------------------------ S52: themes → mass production of covers
  const THEMES = [['dog', '犬のしつけ'], ['hokkaido', '北海道旅行'], ['invest', '初心者向け投資'], ['mushroom', 'キノコ採集']];
  let wall;
  const S52 = {
    id: 'S52', start: cue(91, '今は') - 0.25, trans: { type: 'slice', d: 0.55 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.25 },
    setup() { wall = atlas(48, 120, 180, 8, (ctx, x, y, w, h, i) => bookCover(ctx, x + 2, y + 2, w - 4, h - 4, i * 7 + 1, THEMES[i % 4][0], { author: ['AI編集部', '編集部', 'K. Tanaka', 'J. Smith'][i % 4] })); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tt = THEMES.map(([, w]) => cs(91, w) - 0.25);
      const tLine = cs(91, 'AIに並べ') - 0.2, tBody = cs(91, '本文') - 0.2, tCover = cs(91, '表紙') - 0.2, tMass = cs(91, '量産') - 0.4;
      const massK = E.inOutCubic(clamp((t - tMass) / 1.2));
      // wall of covers behind (mass production)
      if (massK > 0) {
        const cols = 22, rows = 9;
        const s = lerp(2.4, 1, massK);
        ctx.save(); ctx.globalAlpha = clamp(massK * 1.5); ctx.translate(960, 480); ctx.scale(s, s); ctx.translate(-960, -480);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const ap = clamp((t - tMass - hash(i) * 1.0) / 0.3);
          if (ap <= 0) continue;
          wall.draw(ctx, i % 48, 20 + c * 86, 60 + r * 100 + (1 - ap) * 20, 80, 120);
        }
        ctx.restore();
        ctx.save(); ctx.fillStyle = rgba(C.ink, 0.35); ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
        text(ctx, '量産できる', 960, 560, { family: F.jpHeavy, size: 170, weight: 900, color: C.paper, align: 'center', each: popEach(since(t, tMass + 0.4, 0.4), 0.3), shadow: 'rgba(0,0,0,.9)', shadowBlur: 40 });
        return;
      }
      // four themes
      THEMES.forEach(([k, w], i) => {
        const q = since(t, tt[i], 0.45, E.outBack);
        if (q <= 0) return;
        const x = 330 + i * 420, y = 400;
        ctx.save(); ctx.translate(x, y); ctx.scale(q, q); ctx.rotate((i - 1.5) * 0.03);
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30;
        bookCover(ctx, -130, -195, 260, 390, i + 3, k, { author: 'AI編集部' });
        ctx.restore();
      });
      // steps
      [[tLine, 'テーマをAIに並べさせ', 'list'], [tBody, '本文を書かせ', 'pen-line'], [tCover, '表紙も作らせれば', 'image']].forEach(([ts, s, ic], i) => {
        const q = since(t, ts, 0.4, E.outBack);
        if (q <= 0) return;
        const x = 250 + i * 520, y = 780;
        ctx.save(); ctx.translate(x, y); ctx.scale(q, q);
        fillRR(ctx, -40, -44, 480, 88, 44, '#17171c'); strokeRR(ctx, -40, -44, 480, 88, 44, rgba(C.slop, 0.5), 2);
        icon(ctx, ic, 10, 0, 40, { color: C.slop, lw: 2 });
        text(ctx, s, 50, 14, { family: F.jpHeavy, size: 36, weight: 900, color: C.paper });
        ctx.restore();
      });
      text(ctx, '売れそうなテーマ', 960, 150, { family: F.jpHeavy, size: 44, weight: 900, color: C.mute2, align: 'center', alpha: since(t, tt[0], 0.4) });
    },
  };

  // ------------------------------------------------ S53: the mushroom field guide (horror)
  const S53 = {
    id: 'S53', start: cue(92, 'ただし') - 0.2, trans: { type: 'dip', d: 0.6, color: '#000000' }, chapter: CH,
    look: (t) => ({ vign: 0.75, bloom: 0.25, grain: 0.07, contrast: 1.1, gain: [1.05, 0.95, 0.9], sat: 0.85 }),
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tNo = cs(92, '笑えません') - 0.5, tEd = cs(93, '食べられる') - 0.3, tPo = cs(93, '毒キノコ') - 0.3, tWrong = cs(93, '間違えたら') - 0.4, tNat = cs(94, '自然') - 0.3;
      const tSwap = tWrong + 0.2;
      // dark forest vignette + page
      ctx.fillStyle = '#070605'; ctx.fillRect(0, 0, 1920, 1080);
      const z = 1 + t * 0.015;
      ctx.save(); ctx.translate(960, 520); ctx.scale(z, z); ctx.translate(-960, -520);
      ctx.drawImage(paper('#e8dcc2', 'guide'), 0, 0, 1920, 1080, 210, 90, 1500, 860);
      text(ctx, 'キノコ採集ハンドブック', 960, 170, { family: F.mincho, size: 44, weight: 900, color: '#3a2c1c', align: 'center' });
      text(ctx, '— 見分け方 —', 960, 216, { family: F.mincho, size: 26, weight: 700, color: '#6b5a3a', align: 'center' });
      mushroom(ctx, 640, 420, 1.2, 'a', t);
      mushroom(ctx, 1280, 440, 1.2, 'b', t);
      // labels: correct first, then silently swapped
      const swapped = t > tSwap && flick(t, 14, 3) > 0.12;
      const lab = (x, isEdible) => {
        fillRR(ctx, x - 120, 720, 240, 70, 8, isEdible ? '#2f6b3a' : '#7a1d1d');
        text(ctx, isEdible ? '食用 ✓' : '猛毒 ☠', x, 768, { family: F.mincho, size: 40, weight: 900, color: '#f4efe4', align: 'center' });
      };
      const q1 = since(t, tEd, 0.4), q2 = since(t, tPo, 0.4);
      ctx.save(); ctx.globalAlpha = q1; lab(640, !swapped); ctx.restore();
      ctx.save(); ctx.globalAlpha = q2; lab(1280, swapped); ctx.restore();
      text(ctx, 'キノコA', 640, 850, { family: F.mincho, size: 30, weight: 700, color: '#3a2c1c', align: 'center' });
      text(ctx, 'キノコB', 1280, 850, { family: F.mincho, size: 30, weight: 700, color: '#3a2c1c', align: 'center' });
      text(ctx, '傘は滑らかで、柄は白く、特有の香りがある。', 640, 900, { family: F.mincho, size: 20, color: '#5a4a32', align: 'center' });
      text(ctx, '傘に白い斑点があり、柄につばがある。', 1280, 900, { family: F.mincho, size: 20, color: '#5a4a32', align: 'center' });
      ctx.restore();
      if (t > tSwap && t < tSwap + 0.35) { ctx.save(); ctx.fillStyle = 'rgba(255,40,30,.12)'; ctx.fillRect(0, 0, 1920, 1080); ctx.restore(); }
      const nq = since(t, tNo, 0.5) * (1 - since(t, tEd - 0.2, 0.3));
      if (nq > 0) { ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.7 * nq})`; ctx.fillRect(0, 0, 1920, 1080); ctx.restore(); text(ctx, 'キノコ採集だけは', 960, 450, { family: F.mincho, size: 70, weight: 900, color: C.paper, align: 'center', alpha: nq }); text(ctx, '本当に笑えません', 960, 580, { family: F.mincho, size: 96, weight: 900, color: C.alert, align: 'center', alpha: nq }); }
      const natq = since(t, tNat, 0.6);
      if (natq > 0) {
        ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.55 * natq})`; ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
        text(ctx, '文章が自然であるほど、', 960, 470, { family: F.mincho, size: 72, weight: 900, color: C.paper, align: 'center', each: riseEach(natq, 30, 0.3) });
        text(ctx, '危険は増える', 960, 600, { family: F.mincho, size: 110, weight: 900, color: C.alert, align: 'center', each: riseEach(since(t, tNat + 0.6, 0.6), 40, 0.3) });
      }
      noteTag(ctx, t - 1, '※ 架空の図です。実際の見分けには使えません', 1880, 1000 - 60);
    },
  };

  // ------------------------------------------------ S54: the 2x2 — well-written but wrong
  const S54 = {
    id: 'S54', start: cue(95, 'AI') - 0.25, trans: { type: 'fade', d: 0.5 }, chapter: CH,
    look: { vign: 0.4, bloom: 0.3 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tBad = cs(95, '下手') - 0.3, tGood = cs(96, '上手い') - 0.3, tWrong = cs(96, '間違って') - 0.3;
      const cx = 960, cy = 500, W = 1100, H = 620;
      const q = since(t, 0.05, 0.5, E.outExpo);
      ctx.save(); ctx.globalAlpha = q;
      line(ctx, cx - W / 2, cy, cx + W / 2, cy, rgba(C.paper, 0.5), 3); line(ctx, cx, cy - H / 2, cx, cy + H / 2, rgba(C.paper, 0.5), 3);
      text(ctx, '文章が下手', cx - W / 2, cy + H / 2 + 40, { family: F.jp, size: 26, weight: 700, color: C.mute2 });
      text(ctx, '文章が上手い', cx + W / 2, cy + H / 2 + 40, { family: F.jp, size: 26, weight: 700, color: C.mute2, align: 'right' });
      text(ctx, '中身が正しい', cx - 20, cy + H / 2 - 10, { family: F.jp, size: 24, weight: 700, color: C.mute2, align: 'right' });
      text(ctx, '中身が間違い', cx - 20, cy - H / 2 + 26, { family: F.jp, size: 24, weight: 700, color: C.mute2, align: 'right' });
      const quad = (x, y, title, sub, col, hl = 0) => {
        if (hl > 0) { fillRR(ctx, x - W / 4 + 10, y - H / 4 + 10, W / 2 - 20, H / 2 - 20, 16, rgba(col, 0.18 * hl)); strokeRR(ctx, x - W / 4 + 10, y - H / 4 + 10, W / 2 - 20, H / 2 - 20, 16, rgba(col, hl), 4); }
        text(ctx, title, x, y + 6, { family: F.jpHeavy, size: 40, weight: 900, color: col, align: 'center' });
        text(ctx, sub, x, y + 50, { family: F.jp, size: 24, weight: 500, color: C.mute2, align: 'center' });
      };
      quad(cx - W / 4, cy - H / 4, '昔のスパム', 'すぐバレる', C.mute2, since(t, tBad, 0.4) * (1 - since(t, tGood, 0.3)));
      quad(cx + W / 4, cy + H / 4, 'ちゃんとした記事', '', C.human);
      quad(cx - W / 4, cy + H / 4, '素朴な文章', '', C.mute2);
      const hw = since(t, tWrong, 0.5);
      quad(cx + W / 4, cy - H / 4, '上手いのに間違い', hw > 0 ? '← いちばんやばい' : '', C.alert, hw);
      ctx.restore();
      // the dot travels
      const dx = lerp(cx - W / 4, cx + W / 4, E.inOutCubic(clamp((t - tGood) / 0.8)));
      const dy = lerp(cy + H / 4, cy - H / 4, E.inOutCubic(clamp((t - tWrong) / 0.8)));
      if (t > tBad) { glow(ctx, dx, dy - 80, 60, C.alert, 0.6 * hw + 0.2); circle(ctx, dx, dy - 80, 16, hw > 0.5 ? C.alert : C.slop); text(ctx, 'AI slop', dx, dy - 110, { family: F.archivo, size: 22, color: hw > 0.5 ? C.alert : C.slop, align: 'center' }); }
    },
  };

  return [S48, S49, S50, S51, S52, S53, S54];
}

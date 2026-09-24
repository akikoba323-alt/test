// Chapter 05 — video slop, the channel factories (3:26–4:25)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, check, cross, cursor, handCursor, star } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag, chapterCard } from '../lib/hud.js';
import { videoThumb, atlas, albumArt, photo } from '../lib/thumbs.js';
import { landDots } from '../lib/worldmap.js';
import { buildFactory } from '../lib/factory.js';
import { paper } from '../lib/textures.js';
import { THREE } from '../engine/gl.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

let thumbA = null;
const thumbs = () => thumbA || (thumbA = atlas(48, 320, 180, 8, (ctx, x, y, w, h, i) => videoThumb(ctx, x, y, w, h, i * 3 + 101, i % 4 === 0 ? 'slop' : 'bait')));

// big tactile button
export function bigButton(ctx, x, y, w, h, label, press, col = C.slop, sub = '') {
  const d = 22 * (1 - press);
  ctx.save();
  fillRR(ctx, x - w / 2, y - h / 2 + 22, w, h, 34, '#101012');
  fillRR(ctx, x - w / 2, y - h / 2 + 22 - d, w, h, 34, col === C.slop ? '#6f8c12' : '#8c5a12');
  const g = ctx.createLinearGradient(0, y - h / 2 - d, 0, y + h / 2 - d);
  g.addColorStop(0, col === C.slop ? '#e2ff7a' : '#ffc875'); g.addColorStop(1, col);
  fillRR(ctx, x - w / 2, y - h / 2 + 22 - d - 22, w, h, 34, g);
  text(ctx, label, x, y + 22 - d - 22 + 26, { family: F.jpHeavy, size: 84, weight: 900, color: '#10140a', align: 'center' });
  if (sub) text(ctx, sub, x, y + 22 - d - 22 + 70, { family: F.mono, size: 20, weight: 700, color: 'rgba(0,0,0,.5)', align: 'center', ls: 3 });
  ctx.restore();
}

export function videoScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('05', '動画', 'VIDEO', cue(43, '動画') - 0.2);

  // ------------------------------------------------ S26: the editing timeline fills with AI
  const TRACKS = [['台本', 'file-text', '台本を'], ['声', 'mic', '声を'], ['映像', 'clapperboard', '映像を'], ['サムネ', 'image', 'サムネを']];
  const S26 = {
    id: 'S26', start: cue(43, '動画') - 0.2, trans: { type: 'glitch', d: 0.45 }, chapter: CH,
    look: { vign: 0.4, bloom: 0.25 },
    draw(f) {
      const { ctx, t, T } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      // app chrome
      fillRR(ctx, 120, 110, 1680, 790, 14, '#141418'); strokeRR(ctx, 120, 110, 1680, 790, 14, 'rgba(255,255,255,.08)', 2);
      ctx.fillStyle = '#1c1c22'; ctx.fillRect(120, 110, 1680, 44);
      for (let k = 0; k < 3; k++) circle(ctx, 150 + k * 26, 132, 8, ['#ff5f57', '#febc2e', '#28c840'][k]);
      text(ctx, 'untitled_video_0417.proj', 960, 140, { family: F.mono, size: 18, color: C.mute2, align: 'center' });
      // preview monitor
      const pw = 720, ph = 405, px = 960 - pw / 2, py = 175;
      fillRR(ctx, px - 6, py - 6, pw + 12, ph + 12, 6, '#000');
      const filled = TRACKS.map(([, , w]) => cs(44, w) - 0.25);
      const allOn = t > filled[3] + 0.4;
      if (t > filled[2]) thumbs().draw(ctx, Math.floor(t * 1.5) % 48, px, py, pw, ph);
      else { ctx.fillStyle = '#0b0b0d'; ctx.fillRect(px, py, pw, ph); text(ctx, 'NO MEDIA', 960, py + ph / 2 + 10, { family: F.mono, size: 24, color: C.mute, align: 'center' }); }
      const tc = Math.max(0, t - filled[0]) * 29.97;
      text(ctx, `00:${String(Math.floor(tc / 1800) % 60).padStart(2, '0')}:${String(Math.floor(tc / 30) % 60).padStart(2, '0')}:${String(Math.floor(tc) % 30).padStart(2, '0')}`, 960, py + ph + 40, { family: F.mono, size: 22, color: C.paper, align: 'center' });
      // tracks
      const tx0 = 330, tx1 = 1760, ty0 = 660, th = 52;
      ctx.fillStyle = '#101013'; ctx.fillRect(140, ty0 - 34, 1640, 4 * (th + 10) + 44);
      for (let s = 0; s <= 12; s++) { const x = tx0 + (tx1 - tx0) * s / 12; line(ctx, x, ty0 - 30, x, ty0 - 20, 'rgba(255,255,255,.25)', 1.5); }
      TRACKS.forEach(([lab, ic, w], i) => {
        const y = ty0 + i * (th + 10);
        icon(ctx, ic, 172, y + th / 2, 24, { color: C.mute2 });
        text(ctx, lab, 200, y + th / 2 + 9, { family: F.jpHeavy, size: 24, weight: 700, color: C.paper });
        fillRR(ctx, tx0, y, tx1 - tx0, th, 6, '#1a1a1f');
        const q = E.outCubic(clamp((t - filled[i]) / 0.45));
        if (q > 0) {
          const nClips = 6;
          for (let c = 0; c < nClips; c++) {
            const cq = clamp(q * nClips - c);
            if (cq <= 0) continue;
            const cw = (tx1 - tx0) / nClips;
            fillRR(ctx, tx0 + c * cw + 2, y + 2, (cw - 4) * cq, th - 4, 5, c % 2 ? '#a9d12a' : C.slop);
            if (cq > 0.6) text(ctx, 'AI', tx0 + c * cw + 18, y + th / 2 + 8, { family: F.grotesk, size: 20, weight: 700, color: C.ink });
          }
          const lq = since(t, filled[i], 0.3, E.outBack);
          text(ctx, 'AI', tx1 + 10, y + th / 2 + 10, { family: F.grotesk, size: 28, weight: 700, color: C.slop, each: popEach(lq) });
        }
      });
      // playhead
      const phx = tx0 + ((t * 0.12) % 1) * (tx1 - tx0);
      line(ctx, phx, ty0 - 34, phx, ty0 + 4 * (th + 10), '#ff3b30', 2);
      const wq = since(t, 0.2, 0.5) * (1 - since(t, filled[0] - 0.2, 0.3));
      if (wq > 0) text(ctx, '動画はさらに相性がいい', 960, 420, { family: F.jpHeavy, size: 72, weight: 900, color: C.paper, align: 'center', alpha: wq, shadow: 'rgba(0,0,0,.8)', shadowBlur: 20 });
      if (allOn) text(ctx, '全部AI', 960, py + ph / 2 + 30, { family: F.jpHeavy, size: 120, weight: 900, color: C.slop, align: 'center', each: popEach(since(t, filled[3] + 0.4, 0.4)), shadow: 'rgba(0,0,0,.8)', shadowBlur: 30 });
    },
  };

  // ------------------------------------------------ S27: two buttons
  const S27 = {
    id: 'S27', start: cue(45, '人間が') - 0.2, trans: { type: 'zoom', d: 0.45 }, chapter: CH,
    look: { vign: 0.5, bloom: 0.35, bloomThresh: 0.6 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tG = cs(45, '生成') - 0.1, tP = cs(45, '投稿') - 0.1, tAuto = cs(45, '押すだけ') + 0.1;
      glow(ctx, 960, 560, 700, '#1c2508', 0.6);
      text(ctx, '人間がやること', 960, 200, { family: F.jpHeavy, size: 52, weight: 700, color: C.mute2, align: 'center', alpha: since(t, 0.1, 0.4) });
      // press schedule: first two manual presses, then accelerating auto-clicks
      const pressAt = (tt, at) => { const d = tt - at; return d < 0 ? 0 : d < 0.08 ? d / 0.08 : Math.max(0, 1 - (d - 0.08) / 0.12); };
      let pG = pressAt(t, tG), pP = pressAt(t, tP);
      const autoN = t > tAuto ? Math.floor(Math.pow(t - tAuto, 1.6) * 6) : 0;
      let count = (t > tP ? 1 : 0) + autoN;
      if (t > tAuto) {
        const k = Math.pow(t - tAuto, 1.6) * 6;
        const ph = k - Math.floor(k);
        pG = Math.max(pG, ph < 0.5 ? Math.sin(ph * 2 * Math.PI) : 0);
        pP = Math.max(pP, ph >= 0.5 ? Math.sin((ph - 0.5) * 2 * Math.PI) : 0);
      }
      bigButton(ctx, 620, 520, 520, 220, '生成', pG, C.slop, 'GENERATE');
      bigButton(ctx, 1300, 520, 520, 220, '投稿', pP, C.human, 'POST');
      // finger / cursor
      let fx, fy, click;
      if (t < tG) { fx = lerp(1700, 640, E.inOutCubic(clamp(t / Math.max(0.1, tG)))); fy = lerp(950, 540, E.inOutCubic(clamp(t / Math.max(0.1, tG)))); click = pG; }
      else if (t < tP) { const u = E.inOutCubic(clamp((t - tG - 0.15) / Math.max(0.1, tP - tG - 0.15))); fx = lerp(640, 1320, u); fy = 540 - Math.sin(u * Math.PI) * 60; click = pG; }
      else if (t < tAuto) { fx = 1320; fy = 540; click = pP; }
      else { const k = Math.pow(t - tAuto, 1.6) * 6; const ph = k - Math.floor(k); fx = ph < 0.5 ? 640 : 1320; fy = 540; click = Math.max(pG, pP); }
      handCursor(ctx, fx, fy + 20 - click * 14, 2.6, click);
      if (count > 0) {
        text(ctx, '投稿数', 960, 820, { family: F.jpHeavy, size: 34, weight: 700, color: C.mute2, align: 'center' });
        odometer(ctx, count, 960, 950, { family: F.bebas, size: 120, color: C.paper, align: 'center' });
      }
      if (t > tAuto + 0.4) text(ctx, 'AUTO', 1740, 200, { family: F.mono, size: 30, weight: 700, color: flick(t, 4) > 0.3 ? C.alert : '#5a1a14', align: 'right', ls: 6 });
    },
  };

  // ------------------------------------------------ S28: Kapwing — new user's feed
  const S28 = {
    id: 'S28', start: cue(46, '二千二十五') - 0.25, trans: { type: 'whip', d: 0.45, dir: [1, 0] }, chapter: CH,
    source: 'Kapwing「AI Slop Report」（2025年末報道）', sourceAt: 0.4,
    look: { vign: 0.4, bloom: 0.25 },
    mblur: { n: 3, shutter: 0.5 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tNew = cs(46, '新規') - 0.3, tPct = cs(46, '二十') - 0.4, tJ = cs(46, '判定') - 0.3;
      // phone
      const pxc = 620, pyc = 520, pw = 400, ph = 780;
      fillRR(ctx, pxc - pw / 2 - 16, pyc - ph / 2 - 16, pw + 32, ph + 32, 60, '#0e0e11'); strokeRR(ctx, pxc - pw / 2 - 16, pyc - ph / 2 - 16, pw + 32, ph + 32, 60, 'rgba(255,255,255,.14)', 3);
      ctx.save(); rr(ctx, pxc - pw / 2, pyc - ph / 2, pw, ph, 46); ctx.clip();
      ctx.fillStyle = '#000'; ctx.fillRect(pxc - pw / 2, pyc - ph / 2, pw, ph);
      // vertical feed of videos (each fills the screen), scrolling
      const vh = ph;
      const scroll = Math.max(0, t - tNew) * 1.35;
      const k0 = Math.floor(scroll);
      const ease = E.inOutCubic(scroll - k0 < 0.35 ? (scroll - k0) / 0.35 : 1);
      for (let d = 0; d <= 1; d++) {
        const k = k0 + d;
        const y = pyc - ph / 2 + (d - ease) * vh;
        thumbs().draw(ctx, (k * 7) % 48, pxc - pw / 2 - 100, y + 120, pw + 200, (pw + 200) * 9 / 16 * 1.9);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(pxc - pw / 2, y, pw, vh);
        thumbs().draw(ctx, (k * 7) % 48, pxc - pw / 2, y + vh / 2 - 115, pw, pw * 9 / 16);
        const slop = hash(k * 13 + 5) < 0.22 && t > tPct;
        if (slop) { fillRR(ctx, pxc - pw / 2 + 20, y + 40, 150, 46, 10, C.slop); text(ctx, 'AI SLOP', pxc - pw / 2 + 95, y + 72, { family: F.grotesk, size: 24, weight: 700, color: C.ink, align: 'center' }); }
        ctx.fillStyle = '#fff'; ctx.fillRect(pxc - pw / 2 + 20, y + vh - 130, 200, 14); ctx.fillStyle = '#aaa'; ctx.fillRect(pxc - pw / 2 + 20, y + vh - 104, 280, 10);
        for (let b = 0; b < 4; b++) circle(ctx, pxc + pw / 2 - 40, y + vh / 2 + 60 + b * 70, 22, 'rgba(255,255,255,.2)');
      }
      ctx.restore();
      // "new user" badge
      const nq = since(t, tNew, 0.4, E.outBack);
      fillRR(ctx, pxc - 120, pyc - ph / 2 - 80, 240, 50, 25, rgba(C.paper, nq)); text(ctx, '新規ユーザー', pxc, pyc - ph / 2 - 45, { family: F.jpHeavy, size: 26, weight: 900, color: C.ink, align: 'center', alpha: nq });
      // waffle chart
      const wq = since(t, tPct - 0.2, 0.3);
      const wx = 930, wy = 280, cell = 44;
      for (let i = 0; i < 100; i++) {
        const c = i % 10, r = Math.floor(i / 10);
        const on = i < Math.round(21 * clamp((t - tPct) / 1.2));
        const a = since(t, tPct - 0.2 + i * 0.004, 0.2);
        ctx.save(); ctx.globalAlpha = a;
        fillRR(ctx, wx + c * cell, wy + (9 - r) * cell, cell - 6, cell - 6, 6, on ? C.slop : '#26262d');
        ctx.restore();
      }
      if (wq > 0) {
        text(ctx, 'アルゴリズムが', wx + 480, wy + 40, { family: F.jp, size: 30, weight: 700, color: C.mute2, alpha: wq });
        text(ctx, '見せた動画の', wx + 480, wy + 80, { family: F.jp, size: 30, weight: 700, color: C.mute2, alpha: wq });
        text(ctx, '20%', wx + 480, wy + 240, { family: F.bebas, size: 170, color: C.slop, alpha: wq });
        text(ctx, '超', wx + 480 + measure(ctx, '20%', { family: F.bebas, size: 170 }) + 8, wy + 240, { family: F.jpHeavy, size: 70, weight: 900, color: C.slop, alpha: wq });
        text(ctx, 'が AI slop', wx + 480, wy + 310, { family: F.jpHeavy, size: 44, weight: 900, color: C.paper, alpha: since(t, tJ, 0.4) });
        text(ctx, '（新規ユーザーの場合）', wx + 480, wy + 360, { family: F.jp, size: 24, color: C.mute, alpha: since(t, tJ, 0.4) });
      }
    },
  };

  // ------------------------------------------------ S29: 15,000 channels on a dot map → 278 slop-only
  let mapDots;
  const S29 = {
    id: 'S29', start: cue(47, 'さらに') - 0.25, trans: { type: 'dissolve', d: 0.6 }, chapter: CH,
    source: 'Kapwing（人気チャンネル1万5000を調査）', sourceAt: 0.5,
    look: { vign: 0.45, bloom: 0.35, bloomThresh: 0.55 },
    setup() {
      const all = landDots(160, 150, 1600, 720, 7.4);
      const r = rng(15000);
      const pick = r.shuffle(all).slice(0, 15000);
      mapDots = pick.map(([x, y], i) => ({ x, y, r: hash(i * 3 + 1), slop: false }));
      const idx = r.shuffle(mapDots.map((_, i) => i)).slice(0, 278);
      for (const i of idx) mapDots[i].slop = true;
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tN = cs(47, '一万五千') - 0.4, tS = cs(47, '二百七十八') - 0.5, tOnly = cs(47, 'だけ') - 0.3;
      const appear = clamp((t - 0.2) / Math.max(0.5, tN + 0.8));
      let shown = 0;
      for (const d of mapDots) {
        if (d.r > appear) continue;
        shown++;
        const lit = d.slop && t > tS + d.r * 0.8;
        if (lit) continue;
        ctx.fillStyle = 'rgba(200,200,210,.42)'; ctx.fillRect(d.x - 1.5, d.y - 1.5, 3, 3);
      }
      for (const d of mapDots) {
        if (!d.slop || d.r > appear) continue;
        const lq = clamp((t - (tS + d.r * 0.8)) / 0.3);
        if (lq <= 0) continue;
        glow(ctx, d.x, d.y, 18 * lq, C.slop, 0.35);
        circle(ctx, d.x, d.y, 4.5, C.slop);
      }
      // counters
      const cnt = Math.round(15000 * E.outCubic(appear));
      fillRR(ctx, 100, 700, 560, 210, 16, 'rgba(11,11,13,.85)');
      text(ctx, '世界の人気チャンネル', 130, 750, { family: F.jp, size: 28, weight: 700, color: C.mute2 });
      odometer(ctx, cnt, 130, 870, { family: F.bebas, size: 120, color: C.paper });
      if (t > tS) {
        const n = Math.round(278 * clamp((t - tS) / 1.4));
        fillRR(ctx, 1260, 700, 560, 210, 16, 'rgba(11,11,13,.85)');
        text(ctx, 'AI slopだけを投稿', 1290, 750, { family: F.jpHeavy, size: 30, weight: 900, color: C.slop, alpha: since(t, tOnly, 0.4) });
        odometer(ctx, n, 1290, 870, { family: F.bebas, size: 120, color: C.slop });
        text(ctx, 'チャンネル', 1290 + 200, 870, { family: F.jpHeavy, size: 40, weight: 900, color: C.slop });
      }
      noteTag(ctx, t - 1, '※ 点の位置はイメージ', 960, 960 - 60, 'center');
    },
  };

  // ------------------------------------------------ S30: the operator — 15 people, 930 channels, 270 monetized, $20k/month
  const S30 = {
    id: 'S30', start: cue(48, 'しかも') - 0.2, trans: { type: 'glitch', d: 0.4 }, chapter: CH,
    source: 'The Guardian（運営者への取材）', sourceAt: 1.2,
    look: { vign: 0.45, bloom: 0.3 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tEarn = 0, tTeam = cs(49, '十五人') - 0.3, tCh = cs(49, '九百三十') - 0.4, tMon = cs(49, '二百七十') - 0.4, tUSD = cs(50, '二万ドル') - 0.6;
      // opening beat: "しかも実際に稼げる"
      const oq = since(t, 0.05, 0.4, E.outBack) * (1 - since(t, cs(49, 'Guardian') - 0.35, 0.3));
      if (oq > 0) {
        text(ctx, 'しかも', 960, 430, { family: F.jpHeavy, size: 60, weight: 700, color: C.mute2, align: 'center', alpha: oq });
        text(ctx, '実際に稼げる', 960, 580, { family: F.jpHeavy, size: 150, weight: 900, color: C.gold, align: 'center', each: popEach(oq, 0.3) });
        for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + t; const R = 420 + 30 * Math.sin(t * 3 + k); text(ctx, '$', 960 + Math.cos(a) * R * 1.3, 520 + Math.sin(a) * R * 0.6, { family: F.archivo, size: 40, color: rgba(C.gold, 0.5 * oq), align: 'center' }); }
      }
      const tG = cs(49, 'Guardian') - 0.2;
      const aq = since(t, tG, 0.5, E.outExpo) * (1 - since(t, tTeam - 0.1, 0.4));
      if (aq > 0) {
        ctx.save(); ctx.globalAlpha = aq;
        const cx = 960, cy = 470;
        glow(ctx, cx, cy - 40, 420, '#3a2a10', 0.6);
        circle(ctx, cx, cy - 90, 95, '#121214'); fillRR(ctx, cx - 190, cy + 20, 380, 260, 120, '#121214');
        ctx.fillStyle = '#2a2a30'; for (let k = 0; k < 7; k++) ctx.fillRect(cx - 90 + ((k * 37) % 50), cy - 120 + k * 9, 130 - ((k * 23) % 40), 8);
        text(ctx, 'ある運営者', cx, cy + 360, { family: F.jpHeavy, size: 56, weight: 900, color: C.paper, align: 'center' });
        text(ctx, '（匿名）', cx, cy + 410, { family: F.jp, size: 28, weight: 500, color: C.mute2, align: 'center' });
        text(ctx, 'The Guardian の取材より', cx, cy - 240, { family: F.garamond, size: 34, style: 'italic', color: C.mute2, align: 'center' });
        ctx.restore();
      }
      if (t < tTeam - 0.4) return;
      // team column
      const tq = since(t, tTeam, 0.5);
      const px0 = 230, py0 = 150, gap = 48;
      for (let i = 0; i < 15; i++) {
        const q = since(t, tTeam + i * 0.03, 0.3, E.outBack);
        if (q <= 0) continue;
        const x = px0 + (i % 3) * 60, y = py0 + Math.floor(i / 3) * 120;
        ctx.save(); ctx.translate(x, y); ctx.scale(q, q);
        circle(ctx, 0, 0, 16, C.human); fillRR(ctx, -22, 22, 44, 50, 16, C.human);
        ctx.restore();
      }
      text(ctx, '15人のチーム', 290, py0 + 640, { family: F.jpHeavy, size: 36, weight: 900, color: C.human, align: 'center', alpha: tq });
      // channel grid 31x30 = 930
      const gx0 = 800, gy0 = 150, cs2 = 21;
      const cq = clamp((t - tCh) / 1.2);
      const nCh = Math.floor(930 * E.outCubic(cq));
      const monSet = (i) => hash(i * 17 + 3) < 270 / 930;
      const mq = clamp((t - tMon) / 1.0);
      // fan-out lines
      if (cq > 0) {
        ctx.save(); ctx.globalAlpha = 0.07 + 0.08 * (1 - mq); ctx.strokeStyle = C.human; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < nCh; i += 2) { const p = i % 15; const x = px0 + (p % 3) * 60 + 20, y = py0 + Math.floor(p / 3) * 120 + 40; const c = i % 31, r = Math.floor(i / 31); ctx.moveTo(x, y); ctx.lineTo(gx0 + c * cs2 + 8, gy0 + r * cs2 + 8); }
        ctx.stroke(); ctx.restore();
      }
      for (let i = 0; i < nCh; i++) {
        const c = i % 31, r = Math.floor(i / 31);
        const x = gx0 + c * cs2, y = gy0 + r * cs2;
        const mon = monSet(i) && mq > hash(i * 7) * 0.8;
        fillRR(ctx, x, y, cs2 - 4, cs2 - 4, 3, mon ? C.gold : '#3a3a44');
        if (mon) { ctx.fillStyle = '#4a3406'; ctx.font = `700 12px ${'Inter'}`; ctx.textAlign = 'center'; ctx.fillText('$', x + (cs2 - 4) / 2, y + 13); }
      }
      if (cq > 0) {
        text(ctx, fmt(nCh), gx0 + 31 * cs2 + 40, gy0 + 90, { family: F.bebas, size: 110, color: C.paper });
        text(ctx, 'チャンネル', gx0 + 31 * cs2 + 44, gy0 + 140, { family: F.jpHeavy, size: 32, weight: 900, color: C.paper });
      }
      if (mq > 0) {
        text(ctx, '270', gx0 + 31 * cs2 + 40, gy0 + 290, { family: F.bebas, size: 110, color: C.gold, alpha: since(t, tMon, 0.3) });
        text(ctx, 'を収益化', gx0 + 31 * cs2 + 44, gy0 + 340, { family: F.jpHeavy, size: 32, weight: 900, color: C.gold, alpha: since(t, tMon, 0.3) });
      }
      const uq = since(t, tUSD, 0.6, E.outBack);
      if (uq > 0) {
        fillRR(ctx, 760, 820 - 150, 1100, 210, 20, 'rgba(11,11,13,.9)');
        text(ctx, '月に最大', 800, 760, { family: F.jpHeavy, size: 44, weight: 900, color: C.paper, alpha: uq });
        const v = 20000 * E.outCubic(clamp((t - tUSD) / 1.2));
        text(ctx, '$' + fmt(v), 1830, 790, { family: F.bebas, size: 170, color: C.gold, align: 'right', alpha: uq });
      }
    },
  };

  // ------------------------------------------------ S31–S32: the conveyor belt factory (3D)
  let fac, cam;
  const CH6 = chapter('06', '経済', 'ECONOMICS', cue(56, 'AI') - 0.1);
  const S31 = {
    id: 'S31', start: cue(51, '内容は') - 0.2, trans: { type: 'dip', d: 0.5, color: '#000000' }, chapter: [CH, CH6],
    source: 'The Guardian', sourceAt: 0.3,
    look: (t) => ({ vign: 0.55, bloom: 0.45, bloomThresh: 0.62, grain: 0.05, contrast: 1.06 }),
    setup() { fac = buildFactory({ lines: 9, spacing: 3.0, len: 80, per: 40, pressZ: 14 }); cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 200); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tMusic = cs(51, 'AI音楽') - 0.2, tImg = cs(51, 'AI画像') - 0.2, tLife = cs(51, '人生談') - 0.8;
      const tQuote = cs(52, '本人') - 0.2, tBelt = cs(53, 'コンベヤー') - 0.3, tArt = cs(54, '芸術') - 0.25, tFac = cs(55, '工場') - 0.15;
      fac.update(f.T - 250, 1.6);
      // camera: low tracking along a belt → crane up & pull back at "工場です"
      const up = E.inOutCubic(clamp((t - tFac) / 4.5));
      const x = lerp(1.5, 0, up), y = lerp(2.1, 15, up), z = lerp(-4 + t * 0.7, -34, up);
      cam.position.set(x, y, z);
      cam.lookAt(lerp(1.9, 0, up), lerp(1.2, 0.5, up), lerp(z + 10, 8, up));
      cam.fov = lerp(38, 46, up); cam.updateProjectionMatrix();
      fac.lamps.visible = y < 6.2;
      f.three(fac.scene, cam, { exposure: 1.1, clear: [0.04, 0.042, 0.048, 1] });
      // content tags
      const tags = [[tMusic, 'AI音楽', 'music'], [tImg, 'AI画像', 'image'], [tLife, 'ChatGPT・Geminiで書いた長い人生談', 'scroll-text']];
      if (t < tQuote) tags.forEach(([tt, s, ic], i) => {
        const q = since(t, tt, 0.4, E.outBack) * (1 - since(t, tQuote - 0.3, 0.3));
        if (q <= 0) return;
        const w = measure(ctx, s, { family: F.jpHeavy, size: 40, weight: 900 }) + 110;
        ctx.save(); ctx.translate(140, 240 + i * 110); ctx.scale(q, q);
        fillRR(ctx, 0, -50, w, 80, 40, C.slop); icon(ctx, ic, 46, -10, 36, { color: C.ink, lw: 2.2 });
        text(ctx, s, 80, 4, { family: F.jpHeavy, size: 40, weight: 900, color: C.ink });
        ctx.restore();
      });
      // quote
      const qq = since(t, tBelt, 0.6, E.outExpo) * (1 - since(t, tArt - 0.1, 0.2));
      if (qq > 0) {
        ctx.save(); const g = ctx.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.globalAlpha = qq; ctx.fillRect(0, 0, 1920, 520); ctx.restore();
        text(ctx, '“It was a conveyor belt.”', 960, 230, { family: F.iserif, size: 88, style: 'italic', color: C.paper, align: 'center', each: riseEach(qq, 40, 0.2) });
        text(ctx, '「コンベヤーベルトだった」', 960, 330, { family: F.mincho, size: 60, weight: 900, color: C.slop, align: 'center', each: riseEach(clamp(qq * 1.2 - 0.2), 30, 0.2) });
        text(ctx, '— 930チャンネルの運営者', 960, 390, { family: F.jp, size: 26, color: C.mute2, align: 'center', alpha: qq });
      } else if (t > tQuote && t < tBelt) {
        text(ctx, '本人の表現がすごい', 960, 250, { family: F.jpHeavy, size: 64, weight: 900, color: C.paper, align: 'center', each: riseEach(since(t, tQuote, 0.5, E.outExpo), 40, 0.3), shadow: 'rgba(0,0,0,.8)', shadowBlur: 20 });
      }
      // flash: the art studio (not this)
      if (t > tArt - 0.08 && t < tFac - 0.02) {
        ctx.drawImage(paper('#e9dcc2', 'studio'), 0, 0);
        ctx.save();
        glow(ctx, 1400, 250, 800, '#ffcf7a', 0.55);
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(700, 260, 16, 640); ctx.fillRect(1000, 260, 16, 640); ctx.fillRect(640, 820, 440, 16);
        fillRR(ctx, 680, 300, 360, 440, 6, '#fbf6ea'); ctx.fillStyle = '#e07a5f'; ctx.beginPath(); ctx.arc(820, 470, 90, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3d405b'; ctx.fillRect(700, 560, 320, 160);
        for (let k = 0; k < 5; k++) { ctx.fillStyle = ['#e07a5f', '#81b29a', '#f2cc8f', '#3d405b', '#5b8def'][k]; circle(ctx, 1250 + k * 60, 800, 24, ctx.fillStyle); }
        text(ctx, '芸術工房', 1400, 560, { family: F.mincho, size: 110, weight: 900, color: '#3b2a1a', align: 'center' });
        cross(ctx, 960, 520, 620, since(t, tArt, 0.25), C.alert, 40);
        text(ctx, 'じゃない', 1400, 690, { family: F.jpHeavy, size: 64, weight: 900, color: C.alert, align: 'center', alpha: since(t, tArt + 0.15, 0.2) });
        ctx.restore();
      }
      const tEco = CH6.t0 - f.S.start;
      if (t > tFac - 0.02) {
        const q = since(t, tFac, 0.35, E.outBack) * (1 - since(t, tEco + 0.3, 0.4));
        if (q > 0) text(ctx, '工場です', 960, 560, { family: F.jpHeavy, size: 190, weight: 900, color: C.paper, align: 'center', each: popEach(q, 0.3), shadow: 'rgba(0,0,0,.85)', shadowBlur: 40 });
      }
      chapterCard(ctx, t - tEco - 0.5, CH6, 4.2);
    },
  };

  return [S26, S27, S28, S29, S30, S31];
}

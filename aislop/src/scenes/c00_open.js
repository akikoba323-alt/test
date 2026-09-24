// Chapter 00 — cold open (0:00–0:32)
import { C, F, rgba, mixHex } from '../engine/theme.js';
import { clamp, E, lerp, keys, env, spring } from '../engine/ease.js';
import { text, font, decodeEach, riseEach, measure } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, cursor } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { videoThumb, webCard, postCard, photo, atlas } from '../lib/thumbs.js';
import { MEDIA, specimen } from '../lib/media.js';
import { blurTex } from '../lib/glfx.js';
import { cueFn, since, pulse, flick } from './util.js';

// ---------------------------------------------------------------- S01: the endless feed
function makeFeedAtlas() {
  // 64 cards, 375 px wide (1.5x of on-screen 250), variable heights
  const types = [];
  const r = rng(99);
  for (let i = 0; i < 64; i++) types.push(r() < 0.5 ? 'video' : r() < 0.45 ? 'web' : r() < 0.5 ? 'post' : 'photo');
  const H = { video: 211, web: 234, post: 188, photo: 250 };
  const a = atlas(64, 375, 250, 8, (ctx, x, y, w, h, i) => {
    const ty = types[i], hh = H[ty];
    ctx.save(); rr(ctx, x + 2, y + 2, w - 4, hh - 4, 14); ctx.clip();
    if (ty === 'video') videoThumb(ctx, x + 2, y + 2, w - 4, hh - 4, i + 1, i % 5 === 0 ? 'slop' : 'bait');
    else if (ty === 'web') webCard(ctx, x + 2, y + 2, w - 4, hh - 4, i + 3);
    else if (ty === 'post') postCard(ctx, x + 2, y + 2, w - 4, hh - 4, i + 5, { dark: i % 2 === 0 });
    else photo(ctx, x + 2, y + 2, w - 4, hh - 4, i + 7);
    ctx.restore();
  });
  a.types = types; a.hs = types.map((ty) => H[ty] / 1.5);
  return a;
}

let feedAtlas = null;
const getFeed = () => feedAtlas || (feedAtlas = makeFeedAtlas());

export function openScenes(eng) {
  const cue = cueFn(eng);
  let feed;
  const COLS = 9, CW = 250, GAP = 22;
  const colCards = [];
  const tStop0 = cue(0, '本当に') - 0.25, tStop1 = cue(0, '本当に') + 1.0;
  const V0 = 2400;
  const scrollAt = (t) => {
    if (t < tStop0) return V0 * t;
    const d = tStop1 - tStop0;
    const u = clamp((t - tStop0) / d);
    return V0 * tStop0 + V0 * d * (u - u * u * u + u * u * u * u / 2);
  };
  const HERO_COL = 4;
  let heroIdx = 0, heroPhase = 0;

  const S01 = {
    id: 'S01', start: 0, hud: false,
    mblur: (t) => (t < tStop1 - 0.2 ? { n: 5, shutter: 0.7 } : null),
    look: (t) => ({ vign: 0.55, ca: 0.18, bloom: 0.2, grain: 0.05, fade: 1 - clamp(t / 0.25) }),
    setup() {
      feed = getFeed();
      const r = rng(7);
      for (let c = 0; c < COLS; c++) {
        const seq = []; let y = 0;
        for (let k = 0; k < 18; k++) { const idx = Math.floor(r() * 64); seq.push({ idx, y, h: feed.hs[idx] }); y += feed.hs[idx] + GAP; }
        colCards.push({ seq, L: y, speed: 0.78 + 0.44 * hash(c * 31 + 7), phase: r() * y });
      }
      // align a hero card of the centre column exactly at screen centre when the scroll stops
      const col = colCards[HERO_COL];
      const sEnd = scrollAt(tStop1 + 5) * col.speed;
      let best = 1e9;
      for (let k = 0; k < col.seq.length; k++) {
        const it = col.seq[k];
        if (feed.types[it.idx] !== 'video') continue;
        const yc = ((it.y + col.phase - sEnd) % col.L + col.L) % col.L; // y position of card top in column space
        const d = Math.abs(yc + it.h / 2 - 540);
        if (d < best) { best = d; heroIdx = k; }
      }
      const it = col.seq[heroIdx];
      const yc = ((it.y + col.phase - sEnd) % col.L + col.L) % col.L;
      heroPhase = 540 - (yc + it.h / 2);
      col.phase += heroPhase;
    },
    draw(f) {
      const { ctx, t } = f;
      const s = scrollAt(t);
      const tHuman = cue(0, '人間が作った');
      const camS = keys(t, [[0, 1.5], [cue(0, 'その中身') - 0.2, 0.86, E.outCubic], [tStop0, 0.95, E.inOutSine], [tStop1 + 0.35, 1.95, E.inOutCubic], [7.0, 2.1, E.linear]]);
      const camR = keys(t, [[0, -0.07], [3, -0.035], [tStop1, 0]]);
      const focus = clamp((t - tStop1 + 0.3) / 0.9);
      const flashAI = t > cue(0, '本当に') - 0.05 && t < cue(0, '本当に') + 0.06;
      const heroCol = colCards[HERO_COL], hero = heroCol.seq[heroIdx];
      const colX = (c) => 960 + (c - (COLS - 1) / 2) * (CW + GAP) - CW / 2;
      const heroOff = ((-s * heroCol.speed + heroCol.phase) % heroCol.L + heroCol.L) % heroCol.L;
      let heroY = hero.y + heroOff;
      while (heroY + hero.h / 2 - 540 > heroCol.L / 2) heroY -= heroCol.L;
      while (heroY + hero.h / 2 - 540 < -heroCol.L / 2) heroY += heroCol.L;
      // wall (without hero)
      ctx.save();
      ctx.translate(960, 540); ctx.rotate(camR); ctx.scale(camS, camS); ctx.translate(-960, -540);
      for (let c = 0; c < COLS; c++) {
        const col = colCards[c];
        const off = ((-s * col.speed + col.phase) % col.L + col.L) % col.L;
        const x = colX(c);
        for (let rep = -2; rep <= 2; rep++) {
          for (let k = 0; k < col.seq.length; k++) {
            const it = col.seq[k];
            const y = it.y + off + rep * col.L;
            if (y > 1080 / 0.8 + 400 || y + it.h < -400) continue;
            if (c === HERO_COL && k === heroIdx && Math.abs(y - heroY) < 1 && focus > 0) continue;
            feed.draw(ctx, it.idx, x, y, CW, it.h);
            if (flashAI) { fillRR(ctx, x + CW - 58, y + 8, 50, 26, 6, C.slop); text(ctx, 'AI', x + CW - 33, y + 28, { family: F.grotesk, size: 18, weight: 700, color: C.ink, align: 'center' }); }
          }
        }
      }
      ctx.restore();
      if (focus > 0) {
        // rack focus: blur the wall, keep the hero sharp
        const tex = f.grab2d();
        const bl = blurTex(f.gl, tex, 3 + 22 * E.inOutCubic(focus), 'feed');
        f.tex(bl, { opacity: 1 });
        ctx.save(); ctx.fillStyle = rgba(C.ink, 0.45 * focus); ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
        ctx.save();
        ctx.translate(960, 540); ctx.rotate(camR); ctx.scale(camS, camS); ctx.translate(-960, -540);
        const x = colX(HERO_COL), y = heroY;
        ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 40 * focus;
        feed.draw(ctx, hero.idx, x, y, CW, hero.h);
        ctx.shadowBlur = 0;
        strokeRR(ctx, x - 6, y - 6, CW + 12, hero.h + 12, 16, rgba(C.paper, 0.6 * focus), 2);
        ctx.restore();
        // creator label
        const la = since(t, tHuman - 0.2, 0.5);
        if (la > 0) {
          const lx = 960 + (CW / 2 + 40) * camS, ly = 540 - 40;
          ctx.save(); ctx.globalAlpha = la;
          line(ctx, 960 + (CW / 2 + 8) * camS, 540, lx - 10, 540, rgba(C.paper, 0.6), 2, E.outExpo(la));
          text(ctx, 'AUTHOR', lx, ly - 18, { family: F.mono, size: 16, weight: 700, color: C.mute, ls: 3 });
          text(ctx, '作成者：', lx, ly + 26, { family: F.jpHeavy, size: 40, weight: 700, color: C.paper });
          const qx = lx + measure(ctx, '作成者：', { family: F.jpHeavy, size: 40, weight: 700 });
          const blink = Math.floor(t * 2.2) % 2 === 0;
          if (t < tHuman + 0.9) { if (blink) { ctx.fillStyle = C.paper; ctx.fillRect(qx + 6, ly - 8, 4, 40); } }
          else text(ctx, '？', qx + 4, ly + 26, { family: F.jpHeavy, size: 40, weight: 900, color: C.slop, each: decodeEach(clamp((t - tHuman - 0.9) / 0.4), t, 4, false, C.slop) });
          text(ctx, 'uploaded 0.8 sec ago', lx, ly + 66, { family: F.mono, size: 18, color: C.mute2, each: decodeEach(clamp((t - tHuman) / 0.8), t, 8, true, C.mute2) });
          ctx.restore();
        }
      }
    },
  };

  // ---------------------------------------------------------------- S02–S04: media catalogue → time → 0.8s → "not AI itself"
  const words = MEDIA.map((m) => m.jp);
  const TW = 420, TH = 210, GX = 40, GY = 36;
  const gx0 = 960 - (3 * TW + 2 * GX) / 2, gy0 = 128;
  const BACK = [['撮影', '4時間'], ['制作', '3日'], ['取材', '1週間'], ['執筆', '5時間'], ['作曲', '2ヶ月'], ['執筆', '2年'], ['使用', '3ヶ月'], ['準備', '6週間'], ['研究', '3年']];
  const S02 = {
    id: 'S02', start: cue(1, '写真') - 0.12, trans: { type: 'zoom', d: 0.45 },
    chapter: null, hud: false,
    look: (t) => ({ vign: 0.4, bloom: 0.18 }),
    draw(f) {
      const { ctx, t, T } = f;
      grid(ctx, 48, 'rgba(255,255,255,0.045)', 0, -t * 6, 1920, 1080, true);
      const tw = words.map((w) => cue(1, w) - f.S.start);
      const tFlip = cue(2, '誰かが') - f.S.start - 0.2;
      const tNow = cue(2, '今は') - f.S.start;
      const tNot = cue(2, '限りません') - f.S.start;
      const tS4 = cue(3, 'しかも') - f.S.start;
      const tStrike = cue(3, '自体では') - f.S.start;
      const recede = E.inOutCubic(clamp((t - tS4 + 0.1) / 0.7));
      // tiles
      ctx.save();
      ctx.translate(960, 480); ctx.scale(1 - recede * 0.18, 1 - recede * 0.18); ctx.translate(-960, -480);
      for (let i = 0; i < 9; i++) {
        const col = i % 3, row = Math.floor(i / 3);
        const x = gx0 + col * (TW + GX), y = gy0 + row * (TH + GY);
        const a = t - tw[i];
        if (a < 0) { ctx.save(); ctx.setLineDash([10, 8]); strokeRR(ctx, x, y, TW, TH, 14, 'rgba(255,255,255,0.14)', 1.5); ctx.restore(); text(ctx, String(i + 1).padStart(2, '0'), x + TW / 2, y + TH / 2 + 12, { family: F.mono, size: 30, weight: 700, color: 'rgba(255,255,255,0.12)', align: 'center' }); continue; }
        const sp = spring(a, 2.4, 0.55);
        const flipT = tFlip + i * 0.11;
        const fp = clamp((t - flipT) / 0.42);
        const sx = Math.abs(Math.cos(E.inOutCubic(fp) * Math.PI));
        const back = fp > 0.5;
        // state after "今は": 0 amber, 1 lime; flicker after "限りません"
        let lime = t > tNow + i * 0.05 ? 1 : 0;
        if (t > tNot) { const fk = flick(t, 9, i * 3 + 1); lime = fk > (i % 3 === 0 ? 0.25 : 0.62) ? 1 : 0; if (t > tNot + 1.1) lime = [1, 0, 1, 1, 0, 1, 0, 1, 1][i]; }
        ctx.save();
        ctx.globalAlpha = (1 - recede * 0.8);
        const cx = x + TW / 2, cy = y + TH / 2;
        ctx.translate(cx, cy + (1 - sp) * 60); ctx.scale(sx * (0.7 + 0.3 * sp), 0.7 + 0.3 * sp); ctx.translate(-cx, -cy);
        if (!back) {
          specimen(ctx, MEDIA[i].k, x, y, TW, TH, T, { seed: i * 3 + 2 });
          // label chip
          const lp = clamp(a / 0.5);
          fillRR(ctx, x + 12, y + 12, 44 + measure(ctx, MEDIA[i].jp, { family: F.jpHeavy, size: 22, weight: 700 }) + 70, 36, 18, 'rgba(10,10,12,.78)');
          icon(ctx, MEDIA[i].icon, x + 34, y + 30, 20, { color: C.paper, lw: 2.2 });
          text(ctx, MEDIA[i].jp, x + 52, y + 38, { family: F.jpHeavy, size: 22, weight: 700, color: C.paper, each: decodeEach(lp, t, i + 2, false, C.paper) });
          const jw = measure(ctx, MEDIA[i].jp, { family: F.jpHeavy, size: 22, weight: 700 });
          text(ctx, MEDIA[i].en, x + 60 + jw, y + 37, { family: F.grotesk, size: 13, weight: 700, color: C.mute2, ls: 2 });
          const flash = pulse(t, tw[i], 0.02, 0.18);
          if (flash > 0.01) strokeRR(ctx, x - 2, y - 2, TW + 4, TH + 4, 16, rgba(C.paper, flash), 4);
        } else {
          const base = lime ? '#1d2408' : '#2a1d0a';
          fillRR(ctx, x, y, TW, TH, 14, base);
          strokeRR(ctx, x + 1, y + 1, TW - 2, TH - 2, 14, lime ? rgba(C.slop, 0.55) : rgba(C.human, 0.5), 2);
          const colr = lime ? C.slop : C.human;
          icon(ctx, lime ? 'bot' : 'user', x + 58, y + TH / 2 - 8, 64, { color: colr, lw: 1.6 });
          text(ctx, lime ? '生成' : BACK[i][0], x + 58, y + TH / 2 + 60, { family: F.jpHeavy, size: 22, weight: 700, color: colr, align: 'center' });
          // time value: rolls to 0.8秒
          let val = BACK[i][1];
          if (lime) {
            const roll = clamp((t - tNow - i * 0.05) / 0.35);
            val = roll < 1 && t < tNot ? ['9日', '41分', '3分', '12秒', '5秒'][Math.floor(roll * 5)] : '0.8秒';
          }
          text(ctx, val, x + 130, y + TH / 2 + 30, { family: F.jpHeavy, size: 72, weight: 900, color: lime ? C.slop : C.paper });
          text(ctx, lime ? 'GENERATED' : 'MADE BY A HUMAN', x + 132, y + TH / 2 - 44, { family: F.mono, size: 14, weight: 700, color: lime ? C.slopDim : C.humanDim, ls: 2 });
          // clock hands spinning while flipping in (time passing)
          const cx2 = x + TW - 50, cy2 = y + 44;
          circle(ctx, cx2, cy2, 22, null, rgba(colr, 0.8), 2.5);
          const spin = lime ? (t - tNow) * 0.5 : (t - flipT) * 9;
          line(ctx, cx2, cy2, cx2 + Math.cos(spin) * 15, cy2 + Math.sin(spin) * 15, colr, 2.5);
          line(ctx, cx2, cy2, cx2 + Math.cos(spin / 12) * 10, cy2 + Math.sin(spin / 12) * 10, colr, 3);
          if (lime && t < tNot && t > tNow) { const g = flick(t, 30, i); if (g > 0.85) { ctx.fillStyle = rgba(C.slop, 0.35); ctx.fillRect(x, y + g * TH * 0.8, TW, 8); } }
        }
        ctx.restore();
      }
      ctx.restore();
      // S04: statement
      if (t > tS4 - 0.1) {
        const p = since(t, tS4 - 0.05, 0.6, E.outExpo);
        ctx.save();
        ctx.fillStyle = rgba(C.ink, 0.55 * p); ctx.fillRect(0, 0, 1920, 1080);
        const y = 520;
        text(ctx, '問題は', 960, y - 150, { family: F.jpHeavy, size: 46, weight: 700, color: C.mute2, align: 'center', alpha: p });
        const s = 'AIが作ったこと';
        text(ctx, s, 960, y, { family: F.jpHeavy, size: 150, weight: 900, color: C.paper, align: 'center', ls: -4, each: riseEach(p, 60, 0.4) });
        const w = measure(ctx, s, { family: F.jpHeavy, size: 150, weight: 900, ls: -4 });
        const sp = E.outExpo(clamp((t - tStrike + 0.05) / 0.35));
        if (sp > 0) {
          ctx.save(); ctx.translate(960, y - 52); ctx.rotate(-0.04);
          ctx.fillStyle = C.alert; ctx.fillRect(-w / 2 - 30, -9, (w + 60) * sp, 18);
          ctx.restore();
          text(ctx, '…ではない', 960 + w / 2 - 10, y + 110, { family: F.jpHeavy, size: 56, weight: 900, color: C.alert, align: 'right', alpha: since(t, tStrike + 0.1, 0.3) });
        }
        ctx.restore();
      }
    },
  };

  // ---------------------------------------------------------------- S05: facts label + pouring into the algorithm
  const rows = [
    { k: '責任者', from: 3, unit: '人', cue: '誰も責任を持たず', val: '0' },
    { k: '確認', from: 5, unit: '回', cue: '誰も確認せず', val: '0' },
    { k: 'コスト', from: 120000, unit: '', cue: 'ほぼゼロ円で', val: '≈ ¥0' },
    { k: '生産量', from: 1, unit: '', cue: 'ほぼ無限に', val: '∞' },
  ];
  let parts;
  const S05 = {
    id: 'S05', start: cue(4, '問題は') - 0.25, trans: { type: 'whip', d: 0.4, dir: [-1, 0] },
    hud: false,
    look: { vign: 0.45, bloom: 0.3 },
    setup() {
      feed = getFeed();
      const r = rng(55);
      parts = Array.from({ length: 170 }, (_, i) => ({ x: r.range(-150, 1250), d: r.range(0, 3.4), sp: r.range(0.8, 1.3), rot: r.range(-1, 1), sz: r.range(46, 92), idx: r.int(0, 63), side: r() }));
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      grid(ctx, 60, 'rgba(255,255,255,0.035)');
      // ---- label (left)
      const lx = 100, ly = 120, lw = 760;
      const lp = since(t, 0, 0.5, E.outExpo);
      ctx.save(); ctx.globalAlpha = lp; ctx.translate(-40 * (1 - lp), 0);
      fillRR(ctx, lx, ly, lw, 640, 6, '#f2efe8');
      text(ctx, '成分表示', lx + 30, ly + 72, { family: F.jpHeavy, size: 56, weight: 900, color: '#111' });
      text(ctx, 'CONTENT FACTS', lx + lw - 30, ly + 70, { family: F.archivo, size: 26, color: '#111', align: 'right' });
      ctx.fillStyle = '#111'; ctx.fillRect(lx + 24, ly + 92, lw - 48, 14);
      text(ctx, '1本あたり', lx + 30, ly + 138, { family: F.jp, size: 22, weight: 500, color: '#333' });
      ctx.fillRect(lx + 24, ly + 152, lw - 48, 4);
      rows.forEach((row, i) => {
        const y = ly + 230 + i * 104;
        const ta = cs(4, row.cue) - 0.1;
        const a = since(t, ta, 0.35);
        text(ctx, row.k, lx + 30, y, { family: F.jpHeavy, size: 44, weight: 900, color: '#111', alpha: 0.25 + 0.75 * a });
        // value roll
        let v = row.from;
        const u = clamp((t - ta) / 0.55);
        let s;
        if (u <= 0) s = row.k === 'コスト' ? '¥' + row.from.toLocaleString() : row.from + row.unit;
        else if (u < 1) {
          if (row.k === '生産量') s = Math.floor(Math.pow(10, u * 9)).toLocaleString();
          else if (row.k === 'コスト') s = '¥' + Math.round(row.from * (1 - E.outCubic(u))).toLocaleString();
          else s = Math.max(0, Math.round(row.from * (1 - u))) + row.unit;
        } else s = row.val + (row.val === '0' ? row.unit : '');
        const col = u >= 1 ? (row.k === '生産量' ? '#5a7a00' : '#c62828') : '#111';
        text(ctx, s, lx + lw - 30, y, { family: row.val === '∞' && u >= 1 ? F.garamond : F.bebas, size: row.val === '∞' && u >= 1 ? 86 : 70, weight: 700, color: col, align: 'right', alpha: 0.25 + 0.75 * a });
        ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(lx + 24, y + 30, lw - 48, 2);
        if (u >= 1 && t - ta < 0.9) { ctx.save(); ctx.globalAlpha = 1 - (t - ta - 0.55) / 0.35; ctx.fillStyle = rgba(C.alert, 0.18); ctx.fillRect(lx + 24, y - 58, lw - 48, 80); ctx.restore(); }
      });
      text(ctx, '※ 責任・確認は含まれておりません', lx + 30, ly + 612, { family: F.jp, size: 20, weight: 500, color: '#555', alpha: since(t, cs(4, 'ほぼ無限に') + 0.5, 0.4) });
      ctx.restore();
      // ---- funnel (right)
      const fx = 1400, fy = 330, fr = 300;
      const tPour = cs(4, 'アルゴリズム') - 1.4;
      glow(ctx, 1400, 560, 700, '#1a2a06', 0.5);
      const fa = since(t, 0.2, 0.6);
      ctx.save(); ctx.globalAlpha = fa;
      // inner glow
      glow(ctx, fx, fy + 200, 260, C.slop, 0.12 + 0.25 * since(t, tPour + 1.2, 1));
      // funnel body
      ctx.strokeStyle = rgba(C.paper, 0.85); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(fx, fy, fr, 54, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx - fr, fy); ctx.lineTo(fx - 42, fy + 330); ctx.lineTo(fx - 42, fy + 560); ctx.moveTo(fx + fr, fy); ctx.lineTo(fx + 42, fy + 330); ctx.lineTo(fx + 42, fy + 560); ctx.stroke();
      for (let k = 1; k < 5; k++) { const u = k / 5; ctx.globalAlpha = fa * 0.25; ctx.beginPath(); ctx.ellipse(fx, fy + u * 330, lerp(fr, 42, u), lerp(54, 10, u), 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = fa;
      text(ctx, 'ALGORITHM', fx + 80, fy + 420, { family: F.mono, size: 26, weight: 700, color: C.slop, ls: 6 });
      text(ctx, 'アルゴリズム', fx + 80, fy + 456, { family: F.jp, size: 20, weight: 500, color: C.mute2 });
      ctx.restore();
      // ---- liquid slop accumulating inside the funnel
      const lvl = since(t, tPour + 0.8, 2.2, E.outCubic) * 0.45 + 0.28 * since(t, 0.8, 4, E.linear);
      if (lvl > 0.001) {
        ctx.save();
        const top = fy + 560 - 560 * lvl;
        ctx.beginPath(); ctx.moveTo(fx - fr, fy); ctx.lineTo(fx - 42, fy + 330); ctx.lineTo(fx - 42, fy + 560); ctx.lineTo(fx + 42, fy + 560); ctx.lineTo(fx + 42, fy + 330); ctx.lineTo(fx + fr, fy); ctx.closePath(); ctx.clip();
        const g = ctx.createLinearGradient(0, top, 0, fy + 560); g.addColorStop(0, rgba(C.slop, 0.9)); g.addColorStop(1, rgba('#5f7d10', 0.95));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, top);
        for (let xx = fx - fr; xx <= fx + fr; xx += 12) ctx.lineTo(xx, top + Math.sin(xx * 0.03 + t * 5) * 5 + Math.sin(xx * 0.011 - t * 3) * 4);
        ctx.lineTo(fx + fr, 1080); ctx.lineTo(fx - fr, 1080); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgba('#ffffff', 0.35); ctx.fillRect(fx - fr, top - 2, fr * 2, 3);
        ctx.restore();
      }
      // ---- particles: early trickle, then a torrent
      {
        const tt = t - tPour;
        for (const [pi, p] of parts.entries()) {
          const early = pi % 6 === 0;
          const life = early ? (t - 0.5) * p.sp * 0.55 - p.d * 1.2 : tt * p.sp - p.d;
          if (life < 0) continue;
          const u = clamp(life / 1.6);
          const x0 = 960 + p.x * 0.8, y0 = -120;
          const ang = p.side * 6.28 + u * 9;
          const rad = lerp(fr * 0.9, 20, E.inQuad(u));
          const tx = fx + Math.cos(ang) * rad, ty = fy + Math.sin(ang) * rad * 0.18 + E.inCubic(u) * 330;
          const k = E.inOutCubic(clamp(u * 1.6));
          const x = lerp(x0, tx, k), y = lerp(y0, ty, k) ;
          if (u >= 1) continue;
          const sz = p.sz * (1 - 0.8 * E.inQuad(u));
          const limeK = clamp((u - 0.35) / 0.4);
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot * (1 - u) + ang * 0.2);
          feed.draw(ctx, p.idx, -sz / 2, -sz * 0.3, sz, sz * 0.6);
          if (limeK > 0) { ctx.globalAlpha = limeK; ctx.fillStyle = C.slop; ctx.fillRect(-sz / 2, -sz * 0.3, sz, sz * 0.6); }
          ctx.restore();
        }
      }
      if (t > tPour) {
        // lime stream out of the spout
        const sa = since(t, tPour + 1.3, 0.5);
        if (sa > 0) {
          ctx.save();
          const g = ctx.createLinearGradient(0, fy + 560, 0, 1080);
          g.addColorStop(0, rgba(C.slop, 0.95)); g.addColorStop(1, rgba(C.slop, 0.6));
          ctx.fillStyle = g;
          const w = 30 + 6 * Math.sin(t * 20);
          ctx.fillRect(fx - w / 2, fy + 560, w, (1080 - fy - 560) * sa);
          ctx.restore();
        }
      }
    },
  };
  return [S01, S02, S05];
}

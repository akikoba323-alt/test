// Chapter 07 — music: uploads, fake streams, deletions (5:45–6:58)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, check, cross, star } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag, chapterCard } from '../lib/hud.js';
import { albumArt } from '../lib/thumbs.js';
import { THREE } from '../engine/gl.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

export function musicScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('07', '音楽', 'MUSIC', cue(72, '二千二十六') - 0.2);
  const perSec = 90000 / 86400;

  // ------------------------------------------------ S42: the upload waterfall + live counter
  const S42 = {
    id: 'S42', start: cue(72, '二千二十六') - 0.2, trans: { type: 'glitch', d: 0.45 }, chapter: CH,
    source: 'Deezer（2026年6月発表）', sourceAt: 3.2,
    look: { vign: 0.45, bloom: 0.35, bloomThresh: 0.6 },
    draw(f) {
      const { ctx, t, T } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const t9 = cs(72, '九万') - 0.8, tHalf = cs(73, '五十') - 0.6;
      // waterfall of song strips
      const cols = 64, cw = 1920 / cols;
      const split = E.inOutCubic(clamp((t - tHalf) / 0.8));
      for (let c = 0; c < cols; c++) {
        const sp = 260 + hash(c * 7) * 380 + t * 40;
        const len = 80 + hash(c * 13) * 160;
        for (let k = 0; k < 6; k++) {
          const y = ((t * sp + hash(c * 31 + k) * 1400 + k * 260) % 1400) - 200;
          const ai = hash(c * 97 + k * 11 + Math.floor((t * sp + hash(c * 31 + k) * 1400 + k * 260) / 1400) * 5) < (0.3 + 0.22 * split);
          const col = ai ? C.slop : 'rgba(239,235,227,.55)';
          // mini waveform strip
          ctx.fillStyle = col;
          for (let s = 0; s < 10; s++) { const a = 0.3 + 0.7 * Math.abs(Math.sin((c + k) * 1.7 + s * 0.9)); ctx.fillRect(c * cw + cw / 2 - a * cw * 0.35, y + s * len / 10, a * cw * 0.7, len / 10 - 2); }
        }
      }
      const g = ctx.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, 'rgba(11,11,13,.9)'); g.addColorStop(0.35, 'rgba(11,11,13,.35)'); g.addColorStop(0.7, 'rgba(11,11,13,.35)'); g.addColorStop(1, 'rgba(11,11,13,.95)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
      chapterCard(ctx, t - 0.1, CH, 2.8);
      // counters
      const q = since(t, t9, 0.5, E.outBack);
      if (q > 0) {
        fillRR(ctx, 560, 260, 800, 420, 24, 'rgba(11,11,13,.9)'); strokeRR(ctx, 560, 260, 800, 420, 24, rgba(C.slop, 0.3), 2);
        text(ctx, 'AI生成と判定された新規楽曲（ピーク時）', 960, 330, { family: F.jp, size: 30, weight: 700, color: C.mute2, align: 'center', alpha: q });
        odometer(ctx, 90000 * E.outCubic(clamp((t - t9) / 1.2)), 900, 500, { family: F.bebas, size: 180, color: C.slop, align: 'center' });
        text(ctx, '曲／日', 1170, 500, { family: F.jpHeavy, size: 60, weight: 900, color: C.slop, alpha: q });
        text(ctx, '＝ 1秒に約1曲', 960, 600, { family: F.jpHeavy, size: 40, weight: 900, color: C.paper, align: 'center', alpha: since(t, t9 + 1.2, 0.4) });
      }
      const hq = since(t, tHalf, 0.5);
      if (hq > 0) {
        const bw = 1000, bx = 960 - bw / 2, by = 740;
        fillRR(ctx, bx, by, bw, 60, 30, '#26262d');
        fillRR(ctx, bx + bw * 0.5 * (1 - E.outCubic(hq)) + bw * 0.5 * 0, by, bw * (0.5 + 0.02) * E.outCubic(hq), 60, 30, C.slop);
        line(ctx, 960, by - 14, 960, by + 74, C.paper, 3);
        text(ctx, '新規アップロードの 50% 超', 960, by + 130, { family: F.jpHeavy, size: 46, weight: 900, color: C.paper, align: 'center', alpha: hq });
      }
      // live counter (grounded: 90,000/day ≈ 1.04 songs per second of this video)
      const lq = since(t, t9 + 2.0, 0.5);
      if (lq > 0) {
        ctx.save(); ctx.globalAlpha = lq;
        fillRR(ctx, 1380, 900 - 90, 480, 70, 12, 'rgba(11,11,13,.85)');
        circle(ctx, 1410, 845, 8, flick(t, 3) > 0.3 ? C.alert : '#5a1a14');
        text(ctx, 'この動画の開始から届いたAI曲（推定）', 1430, 832, { family: F.jp, size: 16, weight: 700, color: C.mute2 });
        text(ctx, fmt(Math.floor(T * perSec)) + ' 曲', 1430, 868, { family: F.mono, size: 28, weight: 700, color: C.slop });
        ctx.restore();
      }
    },
  };

  // ------------------------------------------------ S43: half — two random new songs
  const S43 = {
    id: 'S43', start: cue(74, '半分') - 0.2, trans: { type: 'cut', d: 0 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.3 },
    draw(f) {
      const { ctx, t, T } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tTwo = cs(75, '二曲') - 0.4, tFlip = cs(75, '一曲') - 0.3;
      const hq = since(t, 0, 0.3, E.outBack);
      const upk = E.inOutCubic(clamp((t - tTwo + 0.6) / 0.7));
      ctx.save(); ctx.translate(960, lerp(560, 190, upk)); ctx.scale(lerp(1, 0.32, upk), lerp(1, 0.32, upk));
      text(ctx, '半分', 0, 110, { family: F.jpHeavy, size: 330, weight: 900, color: C.slop, align: 'center', each: popEach(hq, 0.2) });
      ctx.restore();
      if (t > tTwo - 0.5) {
        const records = [[640, false], [1280, true]];
        records.forEach(([x, ai], i) => {
          const q = since(t, tTwo + i * 0.25, 0.6, E.outBack);
          if (q <= 0) return;
          const y = 470;
          ctx.save(); ctx.translate(x, y + (1 - q) * 500); ctx.rotate((1 - q) * (i ? 0.4 : -0.4));
          // vinyl peeking out of sleeve
          const out = since(t, tFlip, 0.6, E.outCubic);
          circle(ctx, 60 + out * 120, 0, 190, '#111', '#222', 2);
          for (let r = 60; r < 190; r += 14) circle(ctx, 60 + out * 120, 0, r, null, 'rgba(255,255,255,.06)', 1);
          circle(ctx, 60 + out * 120, 0, 50, ai ? C.slop : C.human);
          fillRR(ctx, -210, -210, 420, 420, 8, '#1a1a20');
          albumArt(ctx, -200, -200, 400, i * 11 + 3, { title: ai ? 'Deep Relax 24/7' : 'Night Walk' });
          ctx.restore();
          const rq = since(t, tFlip + 0.35 + i * 0.1, 0.4, E.outBack);
          if (rq > 0) {
            ctx.save(); ctx.translate(x - 10, y - 250); ctx.rotate(i ? 0.1 : -0.08); ctx.scale(rq, rq);
            fillRR(ctx, -170, -40, 340, 80, 10, ai ? C.slop : C.human);
            text(ctx, ai ? '完全AI生成' : '人間の曲', 0, 18, { family: F.jpHeavy, size: 44, weight: 900, color: C.ink, align: 'center' });
            ctx.restore();
          }
        });
        text(ctx, '新曲を2曲ランダムに取ったら…', 960, 900 - 40, { family: F.jpHeavy, size: 46, weight: 900, color: C.paper, align: 'center', alpha: since(t, tTwo, 0.4) });
      }
    },
  };

  // ------------------------------------------------ S44: the stream farm — up to 85% fraudulent
  const S44 = {
    id: 'S44', start: cue(76, 'しかも') - 0.25, trans: { type: 'dip', d: 0.5, color: '#000000' }, chapter: CH,
    source: 'Deezer（AI楽曲ストリームの最大85%を不正と検出）', sourceAt: 0.6,
    look: { vign: 0.65, bloom: 0.5, bloomThresh: 0.45, grain: 0.06 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const t85 = cs(76, '八十五') - 0.5, tFraud = cs(76, '不正') - 0.3;
      ctx.fillStyle = '#060607'; ctx.fillRect(0, 0, 1920, 1080);
      const rows = 7, cols = 16;
      const z = 1 + t * 0.012;
      ctx.save(); ctx.translate(960, 520); ctx.scale(z, z); ctx.translate(-960, -520);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = 120 + c * 106, y = 150 + r * 118;
        const fraud = hash(i * 7 + 3) < 0.85;
        const flagged = fraud && t > tFraud + hash(i * 3) * 1.2;
        // rack
        ctx.fillStyle = '#141416'; ctx.fillRect(x - 6, y + 96, 96, 8);
        fillRR(ctx, x, y, 84, 100, 10, '#1d1d22');
        fillRR(ctx, x + 5, y + 6, 74, 86, 6, flagged ? '#2a0b09' : '#0f1a0a');
        // play UI on each phone
        const ph = (t * 0.15 + hash(i) * 0.1) % 1;
        ctx.fillStyle = flagged ? C.alert : C.slop;
        ctx.beginPath(); ctx.moveTo(x + 34, y + 30); ctx.lineTo(x + 52, y + 42); ctx.lineTo(x + 34, y + 54); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 12, y + 72, 60, 4);
        ctx.fillStyle = flagged ? C.alert : C.slop; ctx.fillRect(x + 12, y + 72, 60 * ph, 4);
        if (flagged) { text(ctx, '不正', x + 42, y + 24, { family: F.jpHeavy, size: 16, weight: 900, color: C.alert, align: 'center' }); }
      }
      ctx.restore();
      // cables glow line
      glow(ctx, 960, 560, 900, flagsRed(t, tFraud) ? '#3a0a08' : '#122004', 0.35);
      // counters
      const plays = 1000000 + t * 185000;
      fillRR(ctx, 560, 20, 800, 110, 16, 'rgba(8,8,10,.9)');
      text(ctx, '▶', 610, 98, { family: F.sans, size: 60, weight: 900, color: C.slop });
      odometer(ctx, plays, 690, 104, { family: F.bebas, size: 90, color: C.paper });
      text(ctx, '回再生', 1180, 98, { family: F.jpHeavy, size: 40, weight: 900, color: C.paper });
      const q = since(t, t85, 0.5, E.outBack);
      if (q > 0) {
        fillRR(ctx, 600, 880 - 110, 720, 120, 18, 'rgba(8,8,10,.92)');
        text(ctx, '最大', 650, 868, { family: F.jpHeavy, size: 44, weight: 900, color: C.paper, alpha: q });
        text(ctx, '85%', 760, 872, { family: F.bebas, size: 110, color: C.alert, alpha: q });
        text(ctx, 'が不正な再生', 960, 868, { family: F.jpHeavy, size: 50, weight: 900, color: C.paper, alpha: since(t, tFraud, 0.4) });
      }
    },
  };
  function flagsRed(t, tf) { return t > tf; }

  // ------------------------------------------------ S45: 8-bit "SLOP QUEST"
  let pix;
  const S45 = {
    id: 'S45', start: cue(77, 'つまり') - 0.2, trans: { type: 'pixel', d: 0.5 }, chapter: CH,
    look: { vign: 0.35, bloom: 0.3, scan: 0.25, crt: 0.25, warp: 0.15, ca: 0.3 },
    setup() { pix = document.createElement('canvas'); pix.width = 320; pix.height = 180; },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tMake = cs(77, '大量に') - 0.2, tInflate = cs(77, '機械的') - 0.3, tRoy = cs(77, 'ロイヤリティ') - 0.3, tGame = cs(77, 'ゲーム') - 0.4;
      const p = pix.getContext('2d');
      p.imageSmoothingEnabled = false;
      p.fillStyle = '#10103a'; p.fillRect(0, 0, 320, 180);
      // parallax pixel city
      for (let k = 0; k < 16; k++) { const w = 18 + (k * 7) % 14, h = 30 + (k * 13) % 50; const x = ((k * 24 - t * 12) % 384 + 384) % 384 - 32; p.fillStyle = '#1c1c5a'; p.fillRect(Math.floor(x), 140 - h, w, h); }
      p.fillStyle = '#2b2b1a'; p.fillRect(0, 140, 320, 40);
      for (let x = 0; x < 320; x += 8) { p.fillStyle = ((x + Math.floor(t * 30)) % 16) < 8 ? '#6b8f10' : '#8fbf14'; p.fillRect(x, 140, 8, 4); }
      // hero robot
      const hx = 60, hy = 116 - (Math.floor(t * 8) % 2) * 2;
      p.fillStyle = '#c6f432'; p.fillRect(hx, hy, 14, 14); p.fillStyle = '#000'; p.fillRect(hx + 3, hy + 4, 3, 3); p.fillRect(hx + 9, hy + 4, 3, 3);
      p.fillStyle = '#c6f432'; p.fillRect(hx + 2, hy + 14, 4, 6); p.fillRect(hx + 8, hy + 14, 4, 6); p.fillRect(hx + 6, hy - 4, 2, 4);
      // collectibles by phase
      const phase = t < tMake ? 0 : t < tInflate ? 1 : t < tRoy ? 2 : 3;
      let score = 0;
      for (let k = 0; k < 40; k++) {
        const x = 320 + k * 26 - (t - tMake) * 90;
        if (t < tMake || x < hx + 14) { if (t >= tMake && x < hx + 14 && x > -30) score++; continue; }
        if (x > 330) continue;
        const kind = x < 0 ? 0 : (k % 3);
        p.fillStyle = phase >= 3 ? '#ffd24a' : phase >= 2 ? '#ff5a5a' : '#ffffff';
        if (phase >= 3) { p.fillRect(Math.floor(x), 104, 8, 8); p.fillStyle = '#b8860b'; p.fillRect(Math.floor(x) + 3, 106, 2, 4); }
        else if (phase >= 2) { p.beginPath(); p.moveTo(Math.floor(x), 100); p.lineTo(Math.floor(x) + 8, 104); p.lineTo(Math.floor(x), 108); p.fill(); }
        else { p.fillRect(Math.floor(x) + 4, 98, 2, 10); p.fillRect(Math.floor(x), 106, 5, 4); p.fillRect(Math.floor(x) + 4, 98, 5, 2); }
      }
      pix.score = score;
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(pix, 0, 0, 1920, 1080); ctx.restore();
      // HUD in pixel fonts
      text(ctx, 'SLOP QUEST', 960, 150, { family: F.pixel, size: 56, color: '#fff', align: 'center', stroke: '#6b2bd9', strokeW: 10 });
      const labels = ['AIで曲を作る', 'AIで大量に曲を作り', '再生まで機械的に膨らませ', 'ロイヤリティを取る'];
      text(ctx, 'STAGE ' + (phase + 1) + ' : ' + labels[phase], 960, 240, { family: F.dot, size: 44, color: phase === 3 ? '#ffd24a' : '#c6f432', align: 'center' });
      const scoreV = phase >= 3 ? (t - tRoy) * 48000 : phase >= 2 ? (t - tInflate) * 250000 : score * 10;
      text(ctx, (phase >= 3 ? 'ROYALTY ¥' : phase >= 2 ? 'PLAYS ' : 'SONGS ') + fmt(Math.floor(scoreV)), 80, 90, { family: F.pixel, size: 28, color: '#fff' });
      text(ctx, 'LIFE ♥♥♥', 1840, 90, { family: F.pixel, size: 28, color: '#ff5a5a', align: 'right' });
      if (t > tGame) {
        const q = since(t, tGame, 0.3);
        ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.6 * q})`; ctx.fillRect(0, 380, 1920, 300); ctx.restore();
        text(ctx, 'というゲームまで成立する', 960, 560, { family: F.dot, size: 80, color: '#fff', align: 'center', alpha: Math.floor(t * 4) % 2 ? q : q * 0.85 });
      }
    },
  };

  // ------------------------------------------------ S46: 75 million spam tracks deleted
  const S46 = {
    id: 'S46', start: cue(78, 'Spotify') - 0.25, trans: { type: 'glitch', d: 0.4 }, chapter: CH,
    source: 'Spotify（2025年9月発表：過去12か月）', sourceAt: 0.6,
    look: { vign: 0.45, bloom: 0.3 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tN = cs(78, '七千五百万') - 0.8, tDel = cs(78, '削除') - 0.4, tNot = cs(79, 'これは') - 0.2, tBut = cs(80, 'しかし') - 0.2;
      const tUp = cs(80, '大量アップロード') - 0.2, tDup = cs(80, '重複') - 0.2, tSeo = cs(80, '検索対策') - 0.2, tEasy = cs(80, '簡単') - 0.3;
      const phase2 = E.inOutCubic(clamp((t - tBut) / 0.7));
      // unit grid: 750 squares = 75,000,000 (1 = 100,000 tracks)
      const cols = 50, rowsN = 15, sq = 22;
      const gx = 960 - cols * sq / 2 - phase2 * 380, gy = 330 - phase2 * 40;
      const sc = 1 - phase2 * 0.45;
      ctx.save(); ctx.translate(gx, gy); ctx.scale(sc, sc);
      const fillN = Math.floor(750 * E.outCubic(clamp((t - 0.3) / Math.max(0.5, tN - 0.3 + 1.2))));
      for (let i = 0; i < 750; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        const x = c * sq, y = r * sq;
        if (i >= fillN) { strokeRR(ctx, x + 2, y + 2, sq - 4, sq - 4, 3, 'rgba(255,255,255,.06)', 1); continue; }
        const del = t > tDel + (hash(i * 5) * 1.6);
        const notAI = hash(i * 11 + 7) < 0.35;
        if (del) {
          const k = clamp((t - tDel - hash(i * 5) * 1.6) / 0.25);
          ctx.save(); ctx.globalAlpha = 1 - k * 0.85;
          fillRR(ctx, x + 2, y + 2 + k * 6, sq - 4, sq - 4, 3, t > tNot && notAI ? '#6b6b76' : C.slop);
          ctx.restore();
          strokeRR(ctx, x + 2, y + 2, sq - 4, sq - 4, 3, 'rgba(255,59,48,.35)', 1);
        } else fillRR(ctx, x + 2, y + 2, sq - 4, sq - 4, 3, t > tNot && notAI ? '#6b6b76' : C.slop);
      }
      ctx.restore();
      // headline number
      const nq = since(t, tN, 0.5);
      text(ctx, '過去12か月で削除された「スパム的なトラック」', 960 - phase2 * 380, 200 - phase2 * 30, { family: F.jp, size: 30, weight: 700, color: C.mute2, align: 'center', alpha: since(t, 0.2, 0.4) });
      if (nq > 0) {
        odometer(ctx, 75000000 * E.outCubic(clamp((t - tN) / 1.4)), 960 - phase2 * 380, 820 - phase2 * 200, { family: F.bebas, size: 150 * (1 - phase2 * 0.35), color: C.paper, align: 'center' });
        text(ctx, '曲以上', 960 - phase2 * 380 + 360 * (1 - phase2 * 0.35), 820 - phase2 * 200, { family: F.jpHeavy, size: 50 * (1 - phase2 * 0.3), weight: 900, color: C.paper, alpha: nq });
      }
      if (t > tDel && phase2 < 1) { icon(ctx, 'trash', 1780, 260, 90, { color: C.alert, lw: 1.8, alpha: 1 - phase2 }); }
      text(ctx, '1マス = 10万曲', 1850 - phase2 * 400, 900 - 40, { family: F.jp, size: 22, color: C.mute, align: 'right', alpha: since(t, 1, 0.5) * (1 - phase2) });
      const nt = since(t, tNot, 0.4) * (1 - phase2);
      if (nt > 0) { fillRR(ctx, 1240, 700, 560, 70, 12, 'rgba(11,11,13,.92)'); ctx.fillStyle = '#6b6b76'; ctx.fillRect(1260, 722, 26, 26); text(ctx, '全部がAI曲というわけではない', 1300, 746, { family: F.jpHeavy, size: 30, weight: 700, color: C.paper, alpha: nt }); }
      // tactics
      if (phase2 > 0) {
        text(ctx, 'Spotify自身の説明', 1180, 250, { family: F.jp, size: 30, weight: 700, color: C.mute2, alpha: phase2 });
        text(ctx, '生成AIで簡単になった slop戦術', 1180, 310, { family: F.jpHeavy, size: 40, weight: 900, color: C.paper, alpha: phase2 });
        [[tUp, '大量アップロード', 'upload'], [tDup, '重複', 'copy'], [tSeo, '検索対策', 'search']].forEach(([tt, s, ic], i) => {
          const q = since(t, tt, 0.4, E.outBack);
          if (q <= 0) return;
          const y = 420 + i * 150;
          ctx.save(); ctx.translate(1180, y); ctx.scale(q, q);
          fillRR(ctx, 0, -60, 640, 120, 18, '#17171c'); strokeRR(ctx, 0, -60, 640, 120, 18, rgba(C.slop, 0.35), 2);
          icon(ctx, ic, 70, 0, 60, { color: C.slop, lw: 1.8 });
          text(ctx, s, 140, 18, { family: F.jpHeavy, size: 48, weight: 900, color: C.paper });
          if (t > tEasy) { fillRR(ctx, 470, -26, 150, 52, 26, C.slop); text(ctx, '簡単に', 545, 12, { family: F.jpHeavy, size: 28, weight: 900, color: C.ink, align: 'center' }); }
          ctx.restore();
        });
      }
    },
  };

  // ------------------------------------------------ S47: the empty hall (3D)
  let hall;
  const S47 = {
    id: 'S47', start: cue(81, '人類は') - 0.25, trans: { type: 'dip', d: 0.7, color: '#000000' }, chapter: CH,
    look: { vign: 0.65, bloom: 0.5, bloomThresh: 0.5, grain: 0.06, contrast: 1.05 },
    setup() {
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050506, 0.05);
      const seatG = new THREE.BoxGeometry(0.5, 0.08, 0.45); const backG = new THREE.BoxGeometry(0.5, 0.55, 0.07);
      const seatM = new THREE.MeshStandardMaterial({ color: 0x5a1a22, roughness: 0.7 });
      const rows = 14, per = 22;
      const seats = new THREE.InstancedMesh(seatG, seatM, rows * per), backs = new THREE.InstancedMesh(backG, seatM, rows * per);
      const o = new THREE.Object3D();
      let k = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < per; c++) {
        const x = (c - (per - 1) / 2) * 0.6, z = 2 + r * 0.95, y = 0.45 + r * 0.22;
        o.position.set(x, y, z); o.rotation.set(0, 0, 0); o.updateMatrix(); seats.setMatrixAt(k, o.matrix);
        o.position.set(x, y + 0.3, z + 0.22); o.rotation.set(-0.1, 0, 0); o.updateMatrix(); backs.setMatrixAt(k, o.matrix);
        k++;
      }
      seats.receiveShadow = backs.receiveShadow = true; seats.castShadow = backs.castShadow = true;
      scene.add(seats, backs);
      const steps = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9 }));
      steps.position.set(0, 0, 8); steps.rotation.x = -Math.atan2(0.22, 0.95); steps.position.y = 1.6; scene.add(steps);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      const stage = new THREE.Mesh(new THREE.BoxGeometry(12, 0.9, 5), new THREE.MeshStandardMaterial({ color: 0x4a3c30, roughness: 0.55 })); stage.position.set(0, 0.45, -3.2); stage.receiveShadow = true; scene.add(stage);
      // speaker + turntable on stage
      const spk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.7), new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.5 })); spk.position.set(-1.6, 1.7, -3.4); spk.castShadow = true; scene.add(spk);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.3 })); cone.rotation.x = Math.PI / 2; cone.position.set(-1.6, 1.9, -3.04); scene.add(cone);
      const tt = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.9), new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.5 })); tt.position.set(0.8, 1.35, -3.2); scene.add(tt);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 48), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.25, metalness: 0.2 })); disc.position.set(0.75, 1.44, -3.2); scene.add(disc);
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.021, 32), new THREE.MeshStandardMaterial({ color: 0xc6f432, emissive: 0x3a4a08 })); label.position.set(0.75, 1.445, -3.2); scene.add(label);
      const spot = new THREE.SpotLight(0xfff0dc, 160, 24, 0.3, 0.55, 1.3); spot.position.set(0, 9, -1); spot.target.position.set(0, 1, -3.2); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); scene.add(spot, spot.target);
      const fill = new THREE.PointLight(0x6070a0, 7, 30, 1.2); fill.position.set(0, 6, 9); scene.add(fill);
      const spill = new THREE.SpotLight(0xffe0c0, 18, 30, 0.7, 0.8, 1.2); spill.position.set(0, 3, -2); spill.target.position.set(0, 1.5, 8); scene.add(spill, spill.target);
      scene.add(new THREE.HemisphereLight(0x303048, 0x080808, 0.6));
      // dust motes
      const N = 700; const pos = new Float32Array(N * 3); const r = rng(5);
      for (let i = 0; i < N; i++) { pos[i * 3] = r.range(-2.2, 2.2); pos[i * 3 + 1] = r.range(0.5, 8); pos[i * 3 + 2] = r.range(-5, 0.5); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xfff2d8, size: 0.025, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      scene.add(dust);
      const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100);
      hall = { scene, camera, disc, label, dust };
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const t1 = cs(81, '誰も聴いて') - 0.3, t2 = cs(81, '誰も作って') - 0.3, t3 = cs(81, '誰かが') - 0.3, tEnd = cs(81, '地点') - 0.4;
      hall.disc.rotation.y = t * 3.5; hall.label.rotation.y = t * 3.5;
      hall.dust.rotation.y = t * 0.02; hall.dust.position.y = Math.sin(t * 0.2) * 0.1;
      const u = t / f.dur;
      hall.camera.position.set(lerp(3.5, 1.2, u), lerp(5.2, 4.2, u), lerp(15, 11, u));
      hall.camera.lookAt(0, 1.6, -2);
      f.three(hall.scene, hall.camera, { exposure: 1.5, clear: [0.01, 0.01, 0.012, 1] });
      // play counter above the stage
      const plays = 1284019 + t * 31337;
      const pq = since(t, 0.3, 0.6);
      ctx.save(); ctx.globalAlpha = pq;
      text(ctx, '▶ ' + fmt(Math.floor(plays)) + ' 回再生', 960, 170, { family: F.mono, size: 48, weight: 700, color: C.slop, align: 'center', shadow: 'rgba(198,244,50,.5)', shadowBlur: 20 });
      ctx.restore();
      const lines3 = [[t1, '誰も聴いていない曲を、', C.paper], [t2, '誰も作っていないかもしれないのに、', C.paper], [t3, '誰かが再生したことにする。', C.slop]];
      lines3.forEach(([tt, s, col], i) => {
        const q = since(t, tt, 0.7, E.outExpo);
        text(ctx, s, 150, 620 + i * 84, { family: F.mincho, size: 56, weight: 900, color: col, each: riseEach(q, 30, 0.2), shadow: 'rgba(0,0,0,.9)', shadowBlur: 16 });
      });
    },
  };

  return [S42, S43, S44, S45, S46, S47];
}

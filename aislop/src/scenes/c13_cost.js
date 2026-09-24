// Chapter 13 — the verification cost; attention as food (12:31–13:55)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure, typed, wrap } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, carrow, check, cross, poly, cursor, handCursor, star } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag, chapterCard } from '../lib/hud.js';
import { paper } from '../lib/textures.js';
import { videoThumb, atlas } from '../lib/thumbs.js';
import { slime } from '../lib/slime.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

export function costScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('13', '確認コスト', 'VERIFICATION COST', cue(148, 'つまり') - 0.2);

  // ------------------------------------------------ S75: "verification cost" + diverging costs
  const S75 = {
    id: 'S75', start: cue(148, 'つまり') - 0.2, trans: { type: 'dip', d: 0.5, color: '#000000' }, chapter: CH,
    look: { vign: 0.45, bloom: 0.3 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tQty = cs(148, '量だけ') - 0.3, tKey = cs(149, '確認') - 0.3, tMake = cs(150, '作る') - 0.2, tCheck = cs(151, '確かめる') - 0.2;
      chapterCard(ctx, t - 0.05, CH, 2.3);
      const q1 = since(t, Math.min(tQty, 2.2), 0.4) * (1 - since(t, tKey - 0.1, 0.3));
      if (q1 > 0) { text(ctx, '増えているのは', 960, 440, { family: F.jpHeavy, size: 50, weight: 900, color: C.mute2, align: 'center', alpha: q1 }); text(ctx, 'コンテンツの量だけではない', 960, 560, { family: F.jpHeavy, size: 80, weight: 900, color: C.paper, align: 'center', alpha: q1 }); }
      const kq = since(t, tKey, 0.5, E.outExpo);
      const up = E.inOutCubic(clamp((t - tMake + 0.3) / 0.7));
      if (kq > 0) {
        ctx.save(); ctx.translate(960, lerp(560, 190, up)); ctx.scale(lerp(1, 0.45, up), lerp(1, 0.45, up));
        text(ctx, '確認コスト', 0, 70, { family: F.jpHeavy, size: 220, weight: 900, color: C.human, align: 'center', each: riseEach(kq, 80, 0.3) });
        ctx.restore();
      }
      if (up > 0) {
        const x0 = 260, x1 = 1660, yT = 330, yB = 860;
        ctx.save(); ctx.globalAlpha = up;
        line(ctx, x0, yB, x1, yB, rgba(C.paper, 0.5), 2); line(ctx, x0, yT, x0, yB, rgba(C.paper, 0.5), 2);
        text(ctx, 'コスト', x0 - 20, yT + 10, { family: F.jp, size: 24, weight: 700, color: C.mute2, align: 'right' });
        text(ctx, '時間 →', x1, yB + 40, { family: F.jp, size: 24, weight: 700, color: C.mute2, align: 'right' });
        const pm = clamp((t - tMake) / 1.4), pc = clamp((t - tCheck) / 1.4);
        const mk = [], ck = [];
        for (let i = 0; i <= 60; i++) { const u = i / 60; const x = lerp(x0, x1, u); if (u <= pm) mk.push([x, lerp(yT + 70, yB - 30, E.outExpo(Math.max(0, u - 0.2) / 0.8))]); if (u <= pc) ck.push([x, yT + 90 + Math.sin(u * 9) * 6 - u * 20]); }
        ctx.lineCap = 'round'; poly(ctx, mk, 1, C.slop, 7); poly(ctx, ck, 1, C.human, 7);
        if (pm > 0.95) text(ctx, '作るコスト：下がる', x1 - 10, yB - 60, { family: F.jpHeavy, size: 44, weight: 900, color: C.slop, align: 'right' });
        if (pc > 0.95) text(ctx, '確かめるコスト：下がらない', x1 - 10, yT + 60, { family: F.jpHeavy, size: 44, weight: 900, color: C.human, align: 'right' });
        ctx.restore();
      }
    },
  };

  // ------------------------------------------------ S76: the asymmetry — bars that run off-screen
  const S76 = {
    id: 'S76', start: cue(152, '一秒') - 0.3, trans: { type: 'slice', d: 0.55 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.3 },
    mblur: (t) => ({ n: 2, shutter: 0.5 }),
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tA1 = 0.2, tA2 = cs(152, '十分') - 0.5;
      const tB1 = cs(153, '一分') - 0.3, tB2 = cs(153, '一時間') - 0.5;
      const tC1 = cs(154, '百円') - 0.3, tGo = cs(154, '現地') - 0.3, tTel = cs(154, '電話') - 0.3, tDoc = cs(154, '資料') - 0.3;
      const tAtk = cs(155, '攻撃') - 0.3, tDef = cs(155, '防御') - 0.3;
      const phase = t < tB1 - 0.3 ? 0 : t < tC1 - 0.3 ? 1 : t < tAtk - 0.3 ? 2 : 3;
      if (phase <= 1) {
        const P = phase === 0 ? { a: '1秒で生成', b: '検証に 10分', ratio: 600, tb: tA2, ta: tA1, unit: 60, unitLab: (k) => k + '分' } : { a: '1分で制作', b: '確認に 1時間', ratio: 60, tb: tB2, ta: tB1, unit: 6, unitLab: (k) => (k * 6) + '分' };
        const px = 8; // 1 unit = 8px for phase 0 (seconds), for phase 1 the unit is minutes
        const scale = phase === 0 ? 8 : 80;
        const L = P.ratio * scale;
        const grow = E.inOutCubic(clamp((t - P.tb) / 2.2));
        const pan = Math.max(0, L * grow - 1500);
        ctx.save(); ctx.translate(-pan, 0);
        // ruler
        const y0 = 360;
        for (let k = 0; k <= P.ratio; k += P.unit) { const x = 200 + k * scale; line(ctx, x, 760, x, 780, rgba(C.paper, 0.4), 2); if (k > 0) text(ctx, phase === 0 ? (k / 60) + '分' : k + '分', x, 820, { family: F.mono, size: 24, color: C.mute2, align: 'center' }); }
        line(ctx, 200, 770, 200 + L + 200, 770, rgba(C.paper, 0.3), 2);
        // bars
        const qa = since(t, P.ta, 0.3);
        fillRR(ctx, 200, y0, Math.max(10, scale * (phase === 0 ? 1 : 1) * qa), 90, 8, C.slop);
        text(ctx, P.a, 200, y0 - 24, { family: F.jpHeavy, size: 44, weight: 900, color: C.slop, alpha: qa });
        const qb = since(t, P.tb - 0.3, 0.3);
        fillRR(ctx, 200, y0 + 200, Math.max(10, L * grow), 90, 8, C.human);
        text(ctx, P.b, 200, y0 + 176, { family: F.jpHeavy, size: 44, weight: 900, color: C.human, alpha: qb });
        ctx.restore();
        // ratio badge
        if (grow > 0.9) text(ctx, '× ' + P.ratio, 1760, 260, { family: F.bebas, size: 150, color: C.human, align: 'right', each: popEach(since(t, P.tb + 2.1, 0.4)) });
        return;
      }
      if (phase === 2) {
        // ¥100 fake news vs. the reporter's legwork
        const q = since(t, tC1, 0.4, E.outBack);
        ctx.save(); ctx.translate(330, 480); ctx.scale(q, q);
        circle(ctx, 0, 0, 110, '#c9c9c9', '#8a8a8a', 6); text(ctx, '¥100', 0, 22, { family: F.bebas, size: 90, color: '#555', align: 'center' });
        ctx.restore();
        text(ctx, 'で作った偽ニュース', 330, 680, { family: F.jpHeavy, size: 36, weight: 900, color: C.slop, align: 'center', alpha: q });
        text(ctx, 'を否定するために…', 330, 730, { family: F.jp, size: 28, weight: 700, color: C.mute2, align: 'center', alpha: q });
        const steps = [[tGo, '現地へ行き', 'train-front'], [tTel, '電話をかけ', 'phone'], [tDoc, '資料を読む', 'files']];
        let hours = 0;
        steps.forEach(([ts, s, ic], i) => {
          const sq = since(t, ts, 0.45, E.outBack);
          if (sq <= 0) return;
          hours += [9, 3, 6][i] * clamp((t - ts) / 1.2);
          const x = 800 + i * 380, y = 460;
          if (i > 0) arrow(ctx, x - 290, y, x - 110, y, { color: rgba(C.human, 0.7), lw: 4, p: sq });
          ctx.save(); ctx.translate(x, y); ctx.scale(sq, sq);
          circle(ctx, 0, 0, 100, '#2b1d0b', C.human, 3); icon(ctx, ic, 0, -6, 90, { color: C.human, lw: 1.6 });
          ctx.restore();
          text(ctx, s, x, y + 160, { family: F.jpHeavy, size: 40, weight: 900, color: C.human, align: 'center', alpha: sq });
        });
        if (hours > 0) { text(ctx, '記者の手間', 1560, 820 - 40, { family: F.jp, size: 28, weight: 700, color: C.mute2, align: 'center' }); text(ctx, Math.round(hours) + ' 時間…', 1560, 860, { family: F.bebas, size: 90, color: C.human, align: 'center' }); }
        noteTag(ctx, t - tGo, '※ イメージ', 1880, 1000 - 50);
        return;
      }
      // phase 3: attack automated, defence manual
      const aq = since(t, tAtk, 0.4), dq = since(t, tDef, 0.4);
      line(ctx, 960, 180, 960, 880, rgba(C.paper, 0.2), 2);
      text(ctx, '攻撃側：自動化', 480, 220, { family: F.jpHeavy, size: 50, weight: 900, color: C.slop, align: 'center', alpha: aq });
      text(ctx, '防御側：人力のまま', 1440, 220, { family: F.jpHeavy, size: 50, weight: 900, color: C.human, align: 'center', alpha: dq });
      // the slop cannon
      if (aq > 0) {
        ctx.save(); ctx.globalAlpha = aq;
        fillRR(ctx, 120, 520, 220, 120, 20, '#2a3510'); fillRR(ctx, 300, 555, 160, 50, 10, '#3d4d14'); icon(ctx, 'bot', 230, 580, 70, { color: C.slop, lw: 1.8 });
        for (let k = 0; k < 40; k++) {
          const u = ((t - tAtk) * 2.4 + k / 40) % 1;
          const x = 470 + u * 1100, y = 580 + Math.sin(k * 3.1) * 90 * u;
          if (x > 1400) continue;
          ctx.save(); ctx.translate(x, y); ctx.rotate(u * 6 + k);
          fillRR(ctx, -24, -15, 48, 30, 4, k % 3 ? C.slop : '#9fc21f'); ctx.restore();
        }
        ctx.restore();
      }
      // the lone checker
      if (dq > 0) {
        ctx.save(); ctx.globalAlpha = dq;
        circle(ctx, 1560, 520, 40, C.human); fillRR(ctx, 1505, 565, 110, 150, 40, C.human);
        icon(ctx, 'search', 1470, 600, 110, { color: C.paper, lw: 2 });
        const checked = Math.floor((t - tDef) * 0.8);
        text(ctx, `確認済み ${checked} 件`, 1560, 800, { family: F.jpHeavy, size: 36, weight: 900, color: C.human, align: 'center' });
        ctx.restore();
      }
    },
  };

  // ------------------------------------------------ S77: the core — a mechanism that eats attention and verification time
  const S77 = {
    id: 'S77', start: cue(156, 'ここが') - 0.2, trans: { type: 'glitch', d: 0.45 }, chapter: CH,
    look: (t) => ({ vign: 0.55, bloom: 0.45, bloomThresh: 0.55 }),
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tCore = 0.1, tGomi = cs(157, 'AIが作ったゴミ') - 0.3, tDiff = cs(157, '少し違う') - 0.3, tExact = cs(158, '正確には') - 0.2, tAtt = cs(158, '注意力') - 0.3, tVer = cs(158, '検証時間') - 0.3, tProfit = cs(158, '利益') - 0.3;
      const q0 = since(t, tCore, 0.4) * (1 - since(t, tGomi - 0.2, 0.3));
      if (q0 > 0) text(ctx, 'ここが核心', 960, 580, { family: F.jpHeavy, size: 150, weight: 900, color: C.paper, align: 'center', each: popEach(q0, 0.3) });
      const gq = since(t, tGomi, 0.4) * (1 - since(t, tExact - 0.2, 0.4));
      if (gq > 0) {
        text(ctx, 'AI slop ＝「AIが作ったゴミ」', 960, 540, { family: F.jpHeavy, size: 84, weight: 900, color: C.paper, align: 'center', alpha: gq });
        const dq = since(t, tDiff, 0.5);
        if (dq > 0) { ctx.save(); ctx.globalAlpha = gq; ctx.translate(960, 600); ctx.rotate(-0.03); ctx.fillStyle = C.alert; ctx.fillRect(-520, -8, 1040 * dq, 8); ctx.restore(); text(ctx, '…だけじゃない', 1480, 680, { family: F.jpHeavy, size: 46, weight: 900, color: C.alert, align: 'right', alpha: dq * gq }); }
      }
      if (t < tExact - 0.3) return;
      // plate background
      const pq = since(t, tExact - 0.3, 0.5);
      ctx.save(); ctx.globalAlpha = pq;
      ctx.drawImage(paper('#e7e0cf', 'plate'), 0, 0);
      ctx.fillStyle = 'rgba(20,16,10,.08)'; ctx.fillRect(0, 0, 1920, 1080);
      text(ctx, 'Fig. 13 ― slop の構造（改訂版の定義）', 120, 120, { family: F.mincho, size: 36, weight: 900, color: '#2a2016' });
      ctx.restore();
      f.flush();
      // creature mask: blobby body (metaballs) with pseudopods reaching for food
      const cx = 960, cy = 520;
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + t * 0.3; const r = 150 + 30 * Math.sin(t * 1.3 + k); circle(ctx, cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.6, 110 + 20 * Math.sin(t * 2 + k * 1.7), '#fff'); }
      circle(ctx, cx, cy, 200, '#fff');
      for (let k = 0; k < 4; k++) { const a = -2.6 + k * 0.35; const L = 260 + 30 * Math.sin(t * 2 + k); circle(ctx, cx + Math.cos(a) * L, cy + Math.sin(a) * L * 0.8, 46, '#fff'); circle(ctx, cx + Math.cos(a) * L * 0.6, cy + Math.sin(a) * L * 0.5, 60, '#fff'); }
      const mask = f.grab2d('creature');
      slime(f, mask, { grow: 0.35, maxLen: 120, blur: 12, color: '#c6f432', deep: '#3e5410', seed: 5.5, thr: 0.4 });
      // mouth + many eyes
      ctx.save();
      ctx.fillStyle = '#14180a'; ctx.beginPath(); ctx.ellipse(cx - 150, cy - 10, 70, 44 + 14 * Math.sin(t * 6), -0.3, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 7; k++) { const ex = cx - 40 + (k % 4) * 70, ey = cy - 90 + Math.floor(k / 4) * 90; circle(ctx, ex, ey, 18, '#f7f7f0'); circle(ctx, ex - 5 + Math.sin(t + k) * 4, ey, 8, '#111'); }
      ctx.restore();
      // food streams into the mouth: eyes (attention) and clocks (verification time)
      const feed = (tt, ic, lab, from, col) => {
        const q = since(t, tt, 0.4);
        if (q <= 0) return;
        for (let k = 0; k < 7; k++) {
          const u = ((t - tt) * 0.7 + k / 7) % 1;
          const x = lerp(from[0], cx - 170, E.inQuad(u)), y = lerp(from[1], cy - 10, E.inQuad(u)) + Math.sin(u * 8 + k) * 20 * (1 - u);
          ctx.save(); ctx.globalAlpha = q * (1 - u * 0.4); icon(ctx, ic, x, y, 52 * (1 - u * 0.6), { color: col, lw: 2 }); ctx.restore();
        }
        text(ctx, lab, from[0], from[1] - 70, { family: F.mincho, size: 40, weight: 900, color: '#2a2016', align: 'center', alpha: q });
      };
      feed(tAtt, 'eye', '他人の注意力', [260, 330], '#2a2016');
      feed(tVer, 'clock', '他人の検証時間', [260, 760], '#7a4a12');
      // output: profit
      const oq = since(t, tProfit, 0.4);
      if (oq > 0) {
        for (let k = 0; k < 8; k++) { const u = ((t - tProfit) * 0.8 + k / 8) % 1; const x = lerp(cx + 220, 1680, u), y = cy + 40 - Math.sin(u * Math.PI) * 120; text(ctx, '¥', x, y, { family: F.archivo, size: 54, color: '#8c6a14', align: 'center', alpha: oq * (1 - u * 0.3) }); }
        text(ctx, '利益', 1680, cy - 100, { family: F.mincho, size: 56, weight: 900, color: '#2a2016', align: 'center', alpha: oq });
      }
      // leader-line labels
      const lq = since(t, tExact + 0.4, 0.5);
      ctx.save(); ctx.globalAlpha = lq;
      line(ctx, cx + 120, cy + 180, 1300, 800, '#2a2016', 2);
      text(ctx, '生成コスト ≈ 0 の世界で生きる', 1310, 810, { family: F.mincho, size: 32, weight: 700, color: '#2a2016' });
      ctx.restore();
      // the definition, typed
      const dq = since(t, tExact + 0.2, 0.3);
      if (dq > 0) {
        fillRR(ctx, 160, 900 - 64, 1600, 60, 8, 'rgba(42,32,22,.9)');
        const def = '生成コストがほぼゼロの世界で、他人の注意力と検証時間を食べて利益に変える仕組み';
        text(ctx, typed(def, clamp((t - tExact - 0.2) / 6.5)), 960, 900 - 22, { family: F.mincho, size: 32, weight: 900, color: '#f4efe4', align: 'center' });
      }
    },
  };

  // ------------------------------------------------ S78: the engagement pachinko — every path is +1
  const S78 = {
    id: 'S78', start: cue(159, 'あなたが') - 0.25, trans: { type: 'whip', d: 0.45, dir: [0, -1] }, chapter: CH,
    look: { vign: 0.45, bloom: 0.4, bloomThresh: 0.55 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const drops = [[cs(159, '十秒') - 0.4, '10秒見る', 0, '投稿者が儲かる', cs(159, '儲かる') - 0.3], [cs(160, '怒って') - 0.3, '怒ってコメント', 1, 'さらに伸びる', cs(160, '伸びる') - 0.3], [cs(161, '訂正') - 0.6, '「これ偽物だろ」と訂正', 2, 'エンゲージメント +1', cs(161, '一件') - 0.3]];
      // board
      const bx = 960, top = 150, bottom = 800;
      fillRR(ctx, bx - 520, top - 40, 1040, 780, 30, '#121216'); strokeRR(ctx, bx - 520, top - 40, 1040, 780, 30, 'rgba(255,255,255,.1)', 2);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 11; c++) { const x = bx - 450 + c * 90 + (r % 2) * 45, y = top + 80 + r * 70; if (x > bx + 470) continue; circle(ctx, x, y, 7, '#5a5a66'); }
      // three chutes at the top, all funnel into one pocket
      const chx = [bx - 330, bx, bx + 330];
      drops.forEach(([tt, lab, i]) => { const q = since(t, tt - 0.3, 0.3); fillRR(ctx, chx[i] - 140, top - 20, 280, 56, 12, rgba(C.human, 0.18 + 0.5 * q)); text(ctx, lab, chx[i], top + 18, { family: F.jpHeavy, size: 26, weight: 900, color: C.paper, align: 'center', alpha: 0.4 + 0.6 * q }); });
      fillRR(ctx, bx - 150, bottom - 10, 300, 90, 16, C.slop);
      text(ctx, '+1', bx, bottom + 60, { family: F.bebas, size: 80, color: C.ink, align: 'center' });
      text(ctx, 'エンゲージメント', bx, bottom + 110, { family: F.jpHeavy, size: 26, weight: 900, color: C.slop, align: 'center' });
      // balls
      let score = 0;
      drops.forEach(([tt, lab, i, res, tRes]) => {
        const u = clamp((t - tt) / 1.8);
        if (t < tt) return;
        if (u >= 1) score++;
        const x0 = chx[i], x1 = bx;
        const x = lerp(x0, x1, E.inOutSine(u)) + Math.sin(u * 22 + i) * 40 * (1 - u), y = lerp(top + 40, bottom + 20, u * u);
        if (u < 1) { glow(ctx, x, y, 50, C.human, 0.5); circle(ctx, x, y, 24, '#ffd9a0'); text(ctx, 'あなた', x, y - 34, { family: F.jpHeavy, size: 22, weight: 900, color: C.paper, align: 'center' }); }
        const rq = since(t, tRes, 0.4, E.outBack);
        if (rq > 0) { ctx.save(); ctx.translate(1660, 330 + i * 150); ctx.scale(rq, rq); fillRR(ctx, -200, -46, 400, 92, 46, i === 2 ? C.slop : '#26262d'); text(ctx, res, 0, 14, { family: F.jpHeavy, size: 32, weight: 900, color: i === 2 ? C.ink : C.paper, align: 'center' }); ctx.restore(); }
      });
      text(ctx, 'ENGAGEMENT', 260, 330, { family: F.mono, size: 26, weight: 700, color: C.mute2, align: 'center' });
      odometer(ctx, 1204 + score, 260, 450, { family: F.bebas, size: 110, color: C.slop, align: 'center' });
      text(ctx, 'どの道を選んでも', 260, 560, { family: F.jpHeavy, size: 34, weight: 900, color: C.paper, align: 'center', alpha: since(t, drops[2][0] + 1.8, 0.4) });
      text(ctx, '＋1', 260, 640, { family: F.bebas, size: 90, color: C.slop, align: 'center', alpha: since(t, drops[2][0] + 1.8, 0.4) });
    },
  };

  // ------------------------------------------------ S79: no need to be liked — stopping is winning
  let feedT;
  const S79 = {
    id: 'S79', start: cue(162, 'AI') - 0.25, trans: { type: 'cut', d: 0 }, chapter: CH,
    look: (t) => ({ vign: 0.5, bloom: 0.4 }),
    mblur: (t) => (t < 3.2 ? { n: 3, shutter: 0.6 } : null),
    setup() { feedT = atlas(24, 320, 180, 6, (ctx, x, y, w, h, i) => videoThumb(ctx, x, y, w, h, i * 9 + 300, 'slop')); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tLike = cs(162, '好かれる') - 0.3, tStop = cs(163, '止まって') - 0.1, tWin = cs(163, '勝ち') - 0.3;
      // phone feed scrolling, then a hard stop
      const px = 960, pw = 440, ph = 820, py = 540;
      fillRR(ctx, px - pw / 2 - 16, py - ph / 2 - 16, pw + 32, ph + 32, 60, '#0e0e11');
      ctx.save(); rr(ctx, px - pw / 2, py - ph / 2, pw, ph, 46); ctx.clip();
      ctx.fillStyle = '#000'; ctx.fillRect(px - pw / 2, py - ph / 2, pw, ph);
      const v = t < tStop ? t * 2600 : tStop * 2600 + 2600 * 0.12 * (1 - Math.exp(-(t - tStop) / 0.12));
      const ch = pw * 9 / 16 + 14;
      const off = v % ch;
      for (let k = -1; k < 7; k++) { const idx = Math.floor(v / ch) + k; feedT.draw(ctx, idx % 24, px - pw / 2, py - ph / 2 + k * ch - off, pw, pw * 9 / 16); }
      ctx.restore();
      // like button crossed out
      const lq = since(t, tLike, 0.4, E.outBack);
      if (lq > 0) { ctx.save(); ctx.translate(430, 470); ctx.scale(lq, lq); icon(ctx, 'heart', 0, 0, 150, { color: C.paper, lw: 1.5 }); cross(ctx, 0, 0, 170, since(t, tLike + 0.2, 0.3), C.alert, 12); ctx.restore(); text(ctx, '好かれる必要すらない', 430, 640, { family: F.jpHeavy, size: 44, weight: 900, color: C.paper, align: 'center', alpha: lq }); }
      // stop = win
      if (t > tStop) {
        const sq = pulse(t, tStop, 0.02, 0.25);
        ctx.save(); ctx.fillStyle = `rgba(198,244,50,${0.25 * sq})`; ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
        strokeRR(ctx, px - pw / 2 - 30, py - ph / 2 - 30, pw + 60, ph + 60, 70, rgba(C.slop, 0.9), 6);
        text(ctx, 'STOP', 1480, 420, { family: F.archivo, size: 120, color: C.paper, align: 'center', alpha: since(t, tStop, 0.2) });
        text(ctx, '＝ WIN', 1480, 580, { family: F.archivo, size: 120, color: C.slop, align: 'center', each: popEach(since(t, tWin, 0.35), 0.3) });
        text(ctx, '止まってもらえば勝ち', 1480, 690, { family: F.jpHeavy, size: 44, weight: 900, color: C.paper, align: 'center', alpha: since(t, tWin, 0.4) });
      }
    },
  };

  // ------------------------------------------------ S80: the emotion bait archetypes
  function archetype(ctx, k, x, y, w, h, t) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x, y);
    const g = ctx.createLinearGradient(0, 0, w, h);
    const bgs = [['#2d0b4e', '#ff00a8'], ['#ffd7a8', '#ff8a3d'], ['#062f4f', '#58c4ff'], ['#3a0000', '#ff2e2e'], ['#3a2400', '#ffd36b']];
    g.addColorStop(0, bgs[k][0]); g.addColorStop(1, bgs[k][1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    if (k === 0) { // weird: melting clock face
      ctx.fillStyle = '#e8e2d4'; ctx.beginPath(); ctx.moveTo(cx - 120, cy - 60); ctx.bezierCurveTo(cx - 140, cy + 120, cx + 40, cy + 60 + Math.sin(t * 2) * 20, cx + 20, cy + 200); ctx.bezierCurveTo(cx + 140, cy + 60, cx + 140, cy - 90, cx + 20, cy - 110); ctx.closePath(); ctx.fill();
      line(ctx, cx, cy, cx + 50, cy - 40, '#111', 6); line(ctx, cx, cy, cx - 10, cy + 70, '#111', 6);
      text(ctx, '奇妙', 30, 80, { family: F.dela, size: 60, color: '#fff', stroke: '#000', strokeW: 10 });
    } else if (k === 1) { // crying animal
      ctx.fillStyle = '#f4f1ea'; circle(ctx, cx, cy + 30, 130, '#f4f1ea');
      ctx.beginPath(); ctx.moveTo(cx - 120, cy - 40); ctx.lineTo(cx - 90, cy - 170); ctx.lineTo(cx - 30, cy - 90); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx + 120, cy - 40); ctx.lineTo(cx + 90, cy - 170); ctx.lineTo(cx + 30, cy - 90); ctx.fill();
      circle(ctx, cx - 50, cy + 10, 36, '#1a2a3a'); circle(ctx, cx + 50, cy + 10, 36, '#1a2a3a'); circle(ctx, cx - 40, cy, 12, '#fff'); circle(ctx, cx + 60, cy, 12, '#fff');
      for (const s of [-1, 1]) { const a = (t * 0.8) % 1; ctx.fillStyle = 'rgba(140,210,255,.95)'; ctx.beginPath(); ctx.ellipse(cx + s * 60, cy + 60 + a * 60, 12, 24, 0, 0, Math.PI * 2); ctx.fill(); }
      text(ctx, '号泣', 30, 80, { family: F.dela, size: 60, color: '#fff', stroke: '#c00', strokeW: 10 });
    } else if (k === 2) { // impossible rescue
      ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.moveTo(-20, h); ctx.quadraticCurveTo(w * 0.3, -60, w * 0.9, 40); ctx.quadraticCurveTo(w * 0.5, 80, w * 0.7, h); ctx.fill();
      ctx.fillStyle = '#ff5722'; ctx.fillRect(cx - 30, cy + 70, 60, 24); circle(ctx, cx, cy + 60, 12, '#ffcc80');
      text(ctx, '奇跡の救出', 30, 80, { family: F.dela, size: 52, color: '#fff', stroke: '#000', strokeW: 10 });
    } else if (k === 3) { // outrage
      text(ctx, '許せない', cx, cy + 20, { family: F.dela, size: 110, color: '#fff', align: 'center', stroke: '#000', strokeW: 14 });
      text(ctx, '!!!', cx + 150, cy - 70, { family: F.dela, size: 90, color: '#ffe600', align: 'center', stroke: '#000', strokeW: 10 });
    } else { // moving old-man story
      const gg = ctx.createRadialGradient(cx + 60, cy - 60, 10, cx, cy, 300); gg.addColorStop(0, '#fff6d0'); gg.addColorStop(1, 'rgba(255,170,60,0)'); ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h);
      circle(ctx, cx, cy - 20, 60, '#3a2a1a'); ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.moveTo(cx - 120, h); ctx.quadraticCurveTo(cx, cy + 20, cx + 120, h); ctx.fill();
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy - 30, 62, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      text(ctx, '90歳の最後の言葉', 30, 80, { family: F.dela, size: 44, color: '#fff', stroke: '#6b3d00', strokeW: 10 });
    }
    ctx.restore();
  }
  let slopWall;
  const S80 = {
    id: 'S80', start: cue(164, 'だから') - 0.2, trans: { type: 'glitch', d: 0.4 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.35, sat: 1.1 },
    setup() { slopWall = atlas(40, 320, 180, 8, (ctx, x, y, w, h, i) => videoThumb(ctx, x, y, w, h, i * 13 + 500, 'slop')); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const ks = [cs(164, '奇妙') - 0.3, cs(164, '泣いている') - 0.3, cs(164, 'あり得ない') - 0.3, cs(164, '怒りを') - 0.3, cs(164, '妙に感動') - 0.3];
      const labs = ['奇妙な動画', '泣いている動物', 'あり得ない救出劇', '怒りを誘う話', '妙に感動的な老人の物語'];
      const tMass = cs(164, '量産') - 0.5;
      const mk = E.inOutCubic(clamp((t - tMass) / 1.0));
      if (mk > 0) {
        const cols = 12, rows = 8;
        ctx.save(); ctx.globalAlpha = mk;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const i = r * cols + c; const x = c * 164 - 20 + ((t * 40 * (r % 2 ? 1 : -1)) % 164), y = r * 140 - 20;
          slopWall.draw(ctx, i % 40, x, y, 156, 88 * 1.5);
        }
        ctx.restore();
        ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.35 * mk})`; ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
        text(ctx, '量産される', 960, 580, { family: F.jpHeavy, size: 170, weight: 900, color: C.paper, align: 'center', each: popEach(since(t, tMass + 0.3, 0.4), 0.3), shadow: 'rgba(0,0,0,.9)', shadowBlur: 40 });
        if (mk >= 1) return;
      }
      ks.forEach((tt, k) => {
        const q = since(t, tt, 0.45, E.outBack) * (1 - mk);
        if (q <= 0) return;
        const w = 520, h = 293;
        const x = [110, 700, 1290, 400, 1000][k], y = [150, 150, 150, 520, 520][k];
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(q, q); ctx.rotate((k % 2 ? 1 : -1) * 0.02); ctx.translate(-w / 2, -h / 2);
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30;
        archetype(ctx, k, 0, 0, w, h, t);
        ctx.shadowBlur = 0;
        ctx.restore();
        text(ctx, labs[k], x + w / 2, y + h + 44, { family: F.jpHeavy, size: 32, weight: 900, color: C.paper, align: 'center', alpha: q });
      });
    },
  };

  // ------------------------------------------------ S81: the emotion buttons get mashed
  const EMO = ['怒り', '感動', '恐怖', '可愛い', '驚き', '義憤', '懐かしさ', '不安', '優越感'];
  const S81 = {
    id: 'S81', start: cue(165, '人間の') - 0.2, trans: { type: 'zoom', d: 0.45 }, chapter: CH,
    look: (t) => ({ vign: 0.55, bloom: 0.55, bloomThresh: 0.45, ca: 0.2 + 0.4 * clamp((t - 3) / 2), glitch: 0.25 * clamp((t - 4.5) / 1.2) }),
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tBtn = cs(165, 'ボタン') - 0.4, tFac = cs(166, 'AI') - 0.2, tMash = cs(166, '片っ端') - 0.4;
      // head silhouette (profile)
      const hx = 720, hy = 540;
      ctx.save();
      ctx.fillStyle = '#16161b'; ctx.strokeStyle = rgba(C.paper, 0.35); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hx - 250, hy + 380); ctx.bezierCurveTo(hx - 300, hy + 120, hx - 360, hy - 60, hx - 220, hy - 300); ctx.bezierCurveTo(hx - 80, hy - 440, hx + 220, hy - 420, hx + 280, hy - 200);
      ctx.bezierCurveTo(hx + 300, hy - 120, hx + 330, hy - 70, hx + 360, hy - 20); ctx.lineTo(hx + 320, hy + 10); ctx.bezierCurveTo(hx + 330, hy + 60, hx + 310, hy + 90, hx + 290, hy + 110); ctx.bezierCurveTo(hx + 300, hy + 160, hx + 250, hy + 200, hx + 180, hy + 200); ctx.lineTo(hx + 160, hy + 380); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      // control panel of emotion buttons embedded in the head
      const mashRate = t > tMash ? 6 + (t - tMash) * 10 : 0;
      EMO.forEach((lab, i) => {
        const bx = hx - 170 + (i % 3) * 140, by = hy - 230 + Math.floor(i / 3) * 130;
        const q = since(t, tBtn + i * 0.06, 0.3, E.outBack);
        if (q <= 0) return;
        let press = 0;
        if (mashRate > 0) { const ph = ((t - tMash) * mashRate + hash(i * 7) * 3) % 1; press = ph < 0.35 ? Math.sin(ph / 0.35 * Math.PI) : 0; }
        ctx.save(); ctx.translate(bx, by); ctx.scale(q, q);
        circle(ctx, 0, 10, 52, '#08080a');
        const col = press > 0.2 ? '#ff5a4e' : '#c62828';
        circle(ctx, 0, 10 - 10 * (1 - press), 52, col);
        if (press > 0.2) glow(ctx, 0, 0, 120, '#ff3b30', 0.5 * press);
        text(ctx, lab, 0, 90, { family: F.jpHeavy, size: 26, weight: 900, color: C.paper, align: 'center' });
        ctx.restore();
        // robot finger / cursor hitting it
        if (press > 0.05) handCursor(ctx, bx + 10, by - 30 + (1 - press) * -60, 1.8, press);
      });
      text(ctx, '人間の感情にはボタンがある', 1460, 300, { family: F.jpHeavy, size: 46, weight: 900, color: C.paper, align: 'center', alpha: since(t, tBtn, 0.5) });
      const fq = since(t, tFac, 0.4);
      if (fq > 0) {
        text(ctx, 'AI slop工場は', 1460, 520, { family: F.jpHeavy, size: 50, weight: 900, color: C.slop, align: 'center', alpha: fq });
        text(ctx, '片っ端から連打する', 1460, 640, { family: F.jpHeavy, size: 70, weight: 900, color: C.alert, align: 'center', each: popEach(since(t, tMash, 0.4), 0.3) });
        if (t > tMash) { const presses = Math.floor((t - tMash) * (6 + (t - tMash) * 5) * 9); text(ctx, `PRESS × ${fmt(presses)}`, 1460, 760, { family: F.mono, size: 40, weight: 700, color: C.paper, align: 'center' }); }
      }
    },
  };

  return [S75, S76, S77, S78, S79, S80, S81];
}

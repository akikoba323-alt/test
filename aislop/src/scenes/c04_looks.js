// Chapter 04 — why it's worse than old spam: it looks legit (2:52–3:26)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure, para, wrap } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, check, cross, marker, sketchCircle, underline, cursor } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { photo } from '../lib/thumbs.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

// suspicion meter: v 0..1
function meter(ctx, x, y, r, v, label = '怪しさメーター') {
  ctx.save();
  ctx.lineCap = 'butt';
  const segs = 30;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI + (i / segs) * Math.PI, a1 = Math.PI + ((i + 0.8) / segs) * Math.PI;
    const k = i / (segs - 1);
    ctx.strokeStyle = k < 0.4 ? '#3fae5a' : k < 0.7 ? '#e0b12a' : '#e0402a';
    ctx.globalAlpha = 0.35 + 0.65 * (k <= v ? 1 : 0.25);
    ctx.lineWidth = r * 0.16;
    ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const a = Math.PI + v * Math.PI;
  ctx.strokeStyle = C.paper; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86); ctx.stroke();
  circle(ctx, x, y, 14, C.paper);
  text(ctx, label, x, y + 58, { family: F.jpHeavy, size: 28, weight: 700, color: C.mute2, align: 'center' });
  text(ctx, '安全', x - r, y + 30, { family: F.jp, size: 20, weight: 700, color: '#3fae5a', align: 'center' });
  text(ctx, '怪しい', x + r, y + 30, { family: F.jp, size: 20, weight: 700, color: '#e0402a', align: 'center' });
  ctx.restore();
}

// retro OS window (generic 2000s style)
function retroWin(ctx, x, y, w, h, title) {
  ctx.fillStyle = '#c3c3c3'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = '#7b7b7b'; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x + w - 2, y, 2, h);
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#0a246a'); g.addColorStop(1, '#3a6ea5');
  ctx.fillStyle = g; ctx.fillRect(x + 4, y + 4, w - 8, 30);
  text(ctx, title, x + 14, y + 26, { family: F.jp, size: 18, weight: 700, color: '#fff' });
  for (let k = 0; k < 3; k++) { ctx.fillStyle = '#c3c3c3'; ctx.fillRect(x + w - 32 - k * 26, y + 8, 22, 20); ctx.fillStyle = '#000'; ctx.fillRect(x + w - 26 - k * 26, y + 20, 10, 2); }
}

export function looksScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('04', '見た目', 'APPEARANCE', cue(33, 'これ') - 0.2);

  // ------------------------------------------------ S22–S23: old spam
  const SPAMS = ['【当選】おめでとうございます!!!', '至急ご確認ください!!!!', '★☆激安☆★ 今だけ90%OFF', 'ナイジェリアの王子より', 'あなたに三億円を送ります', 'RE: RE: RE: 大切なお知らせ', '【重要】口座が凍結されました'];
  const S22 = {
    id: 'S22', start: cue(33, 'これ') - 0.2, trans: { type: 'pixel', d: 0.5 }, chapter: CH,
    look: (t) => ({ vign: 0.45, bloom: 0.2, sat: 1.05 }),
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tQ = cs(33, 'スパム') - 0.4, tFear = cs(34, '一番') - 0.2, tLook = cs(34, '見た目') - 0.3;
      const tOld = cs(35, '昔の迷惑') - 0.3, tPrince = cs(35, 'ナイジェリア') - 0.5, tMoney = cs(35, '三億') - 0.4, tSus = cs(35, '怪しかった') - 0.6;
      // desktop
      const zoom = E.inOutCubic(clamp((t - tOld) / 0.9));
      ctx.save();
      ctx.translate(960, 540); ctx.scale(1 + zoom * 0.5, 1 + zoom * 0.5); ctx.translate(-960 + zoom * 380, -540 + zoom * 60);
      ctx.fillStyle = '#008080'; ctx.fillRect(-400, -200, 2800, 1600);
      const wx = 150, wy = 150, ww = 980, wh = 640;
      retroWin(ctx, wx, wy, ww, wh, '受信トレイ - メール');
      ctx.fillStyle = '#fff'; ctx.fillRect(wx + 10, wy + 44, ww - 20, wh - 54);
      text(ctx, '差出人', wx + 24, wy + 70, { family: F.jp, size: 16, weight: 700, color: '#000' });
      text(ctx, '件名', wx + 300, wy + 70, { family: F.jp, size: 16, weight: 700, color: '#000' });
      ctx.fillStyle = '#999'; ctx.fillRect(wx + 10, wy + 80, ww - 20, 1);
      SPAMS.forEach((sbj, i) => {
        const y = wy + 110 + i * 40;
        const a = since(t, 0.1 + i * 0.08, 0.2);
        if (a <= 0) return;
        const sel = sbj.includes('王子') && t > tPrince - 0.6;
        if (sel) { ctx.fillStyle = '#0a246a'; ctx.fillRect(wx + 12, y - 26, ww - 24, 36); }
        icon(ctx, 'mail', wx + 34, y - 8, 20, { color: sel ? '#fff' : '#b08a00' });
        text(ctx, ['prince@royal-xx', 'winner@lucky-xx', 'info@sale-xx', 'prince@royal-xx', 'bank@secure-xx', 'no-reply@xx', 'support@xx'][i], wx + 56, y, { family: F.comic, size: 18, weight: 700, color: sel ? '#fff' : '#000' });
        text(ctx, sbj, wx + 300, y, { family: F.jp, size: 19, weight: 700, color: sel ? '#fff' : i % 2 ? '#c00' : '#000' });
      });
      // opened message
      if (t > tPrince - 0.2) {
        const mq = since(t, tPrince - 0.2, 0.25, E.outBack);
        const mx = 520, my = 330, mw = 760, mh = 470;
        ctx.save(); ctx.translate(mx + mw / 2, my + mh / 2); ctx.scale(mq, mq); ctx.translate(-(mx + mw / 2), -(my + mh / 2));
        retroWin(ctx, mx, my, mw, mh, 'ナイジェリアの王子より');
        ctx.fillStyle = '#ffffe0'; ctx.fillRect(mx + 10, my + 44, mw - 20, mh - 54);
        const blink = Math.floor(t * 3) % 2 === 0;
        text(ctx, '親愛なる友人へ!!!', mx + 30, my + 92, { family: F.comic, size: 30, weight: 700, color: '#0000cc' });
        text(ctx, '私わナイジェリアの王子です。', mx + 30, my + 150, { family: F.jp, size: 32, weight: 700, color: '#000' });
        if (t > tMoney - 0.2) {
          text(ctx, 'あなたに', mx + 30, my + 214, { family: F.jp, size: 32, weight: 700, color: '#000' });
          text(ctx, '３億円', mx + 170, my + 220, { family: F.dela, size: 54, color: blink ? '#ff0000' : '#ff00ff', stroke: '#ffff00', strokeW: 6 });
          text(ctx, 'を送ります！！', mx + 360, my + 214, { family: F.jp, size: 32, weight: 700, color: '#000' });
          text(ctx, '★口座番号を教えて下さい★', mx + 30, my + 290, { family: F.jp, size: 28, weight: 700, color: blink ? '#008000' : '#cc0000' });
          text(ctx, '今すぐ返信!!!!!!!!', mx + 30, my + 350, { family: F.comic, size: 34, weight: 700, color: '#ff6600' });
          text(ctx, '(^o^)v', mx + mw - 60, my + 420, { family: F.comic, size: 30, weight: 700, color: '#999', align: 'right' });
        }
        ctx.restore();
      }
      ctx.restore();
      // question overlay
      const qq = since(t, tQ - 0.2, 0.4) * (1 - since(t, tOld, 0.3));
      if (qq > 0) {
        ctx.save(); ctx.globalAlpha = qq;
        fillRR(ctx, 1180, 170, 620, 150, 16, 'rgba(11,11,13,.92)');
        text(ctx, '昔のスパムと', 1490, 235, { family: F.jpHeavy, size: 44, weight: 900, color: C.paper, align: 'center' });
        text(ctx, '何が違うのか', 1490, 295, { family: F.jpHeavy, size: 44, weight: 900, color: C.slop, align: 'center' });
        ctx.restore();
      }
      // "looks legit" preview card
      const lq = since(t, tFear, 0.5, E.outBack) * (1 - since(t, tOld, 0.3));
      if (lq > 0) {
        ctx.save(); ctx.globalAlpha = lq; ctx.translate(1490, 640); ctx.scale(lq, lq);
        fillRR(ctx, -300, -230, 600, 460, 14, '#fbfaf7');
        ctx.fillStyle = '#1b1b1f'; ctx.fillRect(-260, -190, 380, 22); ctx.fillRect(-260, -158, 300, 22);
        photo(ctx, -260, -110, 520, 150, 4, { mood: 'day' });
        for (let k = 0; k < 5; k++) { ctx.fillStyle = '#cfcac0'; ctx.fillRect(-260, 70 + k * 26, 520 - (k === 4 ? 200 : 0), 10); }
        ctx.restore();
        const tl = since(t, tLook, 0.4, E.outBack);
        if (tl > 0) {
          fillRR(ctx, 1260, 890 - 60, 460, 56, 28, C.slop);
          text(ctx, '見た目がちゃんとしている', 1490, 868, { family: F.jpHeavy, size: 30, weight: 900, color: C.ink, align: 'center', alpha: tl });
        }
      }
      // suspicion meter pegs
      if (t > tSus - 0.8) {
        const v = spring(t - tSus, 1.8, 0.35) * 0.97;
        const mq = since(t, tSus - 0.8, 0.4);
        ctx.save(); ctx.globalAlpha = mq;
        fillRR(ctx, 1450, 690, 400, 250, 18, 'rgba(11,11,13,.92)');
        meter(ctx, 1650, 860, 130, v);
        ctx.restore();
      }
    },
  };

  // ------------------------------------------------ S24: the polished slop article
  const S24 = {
    id: 'S24', start: cue(36, 'でも') - 0.2, trans: { type: 'glitch', d: 0.4 }, chapter: CH,
    look: { vign: 0.4, bloom: 0.2 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tSmooth = cs(36, '滑らか') - 0.6, tHead = cs(37, '見出し') - 0.3, tQuote = cs(38, '引用') - 0.3, tJar = cs(39, '専門用語') - 0.3, tWrong = cs(40, '間違って') - 0.3, tPolite = cs(40, '丁寧') - 0.5;
      // article sheet
      const ax = 170, ay = 110, aw = 1060, ah = 800;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40; fillRR(ctx, ax, ay, aw, ah, 12, '#fbfaf7'); ctx.restore();
      text(ctx, 'LIFESTYLE ／ 2026.09', ax + 60, ay + 64, { family: F.mono, size: 18, weight: 700, color: '#8a8478', ls: 3 });
      // headline
      const hq = since(t, tHead, 0.6, E.outExpo);
      text(ctx, '専門家が解説：', ax + 60, ay + 140, { family: F.jpHeavy, size: 40, weight: 700, color: '#1b1b1f', alpha: hq });
      text(ctx, '健康的な睡眠を支える、7つの習慣', ax + 60, ay + 210, { family: F.jpHeavy, size: 56, weight: 900, color: '#111', each: riseEach(hq, 30, 0.2) });
      // body paragraphs (smooth prose)
      const bq = since(t, tSmooth, 1.2, E.outCubic);
      const body = '質の高い睡眠は、日々のパフォーマンスを最適化するうえで欠かせない要素です。近年の研究では、就寝前のルーティンが心身のバランスに大きく影響することが示唆されています。';
      const lines = wrap(ctx, body, aw - 120, { family: F.jp, size: 27, weight: 400 });
      lines.forEach((ln, i) => text(ctx, ln, ax + 60, ay + 290 + i * 46, { family: F.jp, size: 27, weight: 400, color: '#2a2a2e', alpha: clamp(bq * lines.length - i) }));
      // pull quote
      const qq = since(t, tQuote, 0.5, E.outExpo);
      if (qq > 0) {
        ctx.save(); ctx.globalAlpha = qq;
        ctx.fillStyle = C.slop; ctx.fillRect(ax + 60, ay + 430, 8, 110);
        text(ctx, '“', ax + 90, ay + 500, { family: F.playfair, size: 110, weight: 900, color: '#cfcac0' });
        text(ctx, '睡眠は最高の自己投資である', ax + 150, ay + 480, { family: F.mincho, size: 40, weight: 700, color: '#111' });
        text(ctx, '— ある睡眠研究者', ax + 150, ay + 526, { family: F.jp, size: 22, weight: 500, color: '#8a8478' });
        ctx.restore();
      }
      // jargon paragraph
      const jq = since(t, tJar, 0.6);
      const jar = [['エビデンス', 0], ['サーカディアンリズム', 1], ['メラトニン', 2]];
      if (jq > 0) {
        const y = ay + 610;
        text(ctx, 'エビデンスに基づけば、サーカディアンリズムを整え、', ax + 60, y, { family: F.jp, size: 27, weight: 400, color: '#2a2a2e', alpha: jq });
        text(ctx, 'メラトニンの分泌を促すことが重要です。', ax + 60, y + 46, { family: F.jp, size: 27, weight: 400, color: '#2a2a2e', alpha: jq });
        // underline jargon
        const x1 = ax + 60, w1 = measure(ctx, 'エビデンス', { family: F.jp, size: 27 });
        const x2 = ax + 60 + measure(ctx, 'エビデンスに基づけば、', { family: F.jp, size: 27 }), w2 = measure(ctx, 'サーカディアンリズム', { family: F.jp, size: 27 });
        const w3 = measure(ctx, 'メラトニン', { family: F.jp, size: 27 });
        underline(ctx, x1, y + 10, w1, since(t, tJar + 0.2, 0.3), '#1d4ed8', 4);
        underline(ctx, x2, y + 10, w2, since(t, tJar + 0.4, 0.3), '#1d4ed8', 4);
        underline(ctx, ax + 60, y + 56, w3, since(t, tJar + 0.6, 0.3), '#1d4ed8', 4);
      }
      // wrong but polite
      const wq = since(t, tWrong, 0.5);
      if (wq > 0) {
        const y = ay + 740;
        text(ctx, '※ 人間は1日に平均14時間の睡眠を必要とします。', ax + 60, y, { family: F.jp, size: 27, weight: 700, color: '#2a2a2e', alpha: wq });
        const w = measure(ctx, '※ 人間は1日に平均14時間の睡眠を必要とします。', { family: F.jp, size: 27, weight: 700 });
        sketchCircle(ctx, ax + 60 + w / 2, y - 10, w / 2 + 30, 34, since(t, tPolite - 0.2, 0.6), C.alert, 5);
        text(ctx, '誤り', ax + 60 + w + 60, y - 30, { family: F.jpHeavy, size: 34, weight: 900, color: C.alert, alpha: since(t, tPolite, 0.3) });
      }
      // labels on the right
      const labs = [[tHead, '見出しもある'], [tQuote, '引用っぽいものもある'], [tJar, '専門用語も使う'], [tPolite, '間違い方が丁寧']];
      labs.forEach(([tt, s], i) => {
        const q = since(t, tt, 0.4, E.outBack);
        if (q <= 0) return;
        const x = 1320, y = 190 + i * 110;
        ctx.save(); ctx.globalAlpha = q;
        (i === 3 ? cross : check)(ctx, x + 20, y - 12, 34, since(t, tt + 0.1, 0.3), i === 3 ? C.alert : C.slop, 7);
        text(ctx, s, x + 70, y, { family: F.jpHeavy, size: 40, weight: 900, color: i === 3 ? C.alert : C.paper });
        ctx.restore();
      });
      // meter stays at zero — that's the scary part
      const mq = since(t, tSmooth, 0.5);
      ctx.save(); ctx.globalAlpha = mq;
      fillRR(ctx, 1380, 640, 420, 270, 18, 'rgba(20,20,24,.95)');
      const v = 0.04 + 0.02 * Math.sin(t * 6) * (t > tPolite ? 1 : 0);
      meter(ctx, 1590, 820, 130, v);
      if (t > tPolite + 0.3) text(ctx, '反応しない', 1590, 690, { family: F.jpHeavy, size: 30, weight: 900, color: C.alert, align: 'center', alpha: since(t, tPolite + 0.3, 0.3) });
      ctx.restore();
    },
  };

  // ------------------------------------------------ S25: drunk lie vs suited lie
  function usoChar(ctx, x, y, s, mode, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (mode === 'drunk') {
      ctx.rotate(Math.sin(t * 2.4) * 0.18);
      ctx.translate(Math.sin(t * 1.3) * 20, Math.abs(Math.sin(t * 2.4)) * -14);
    }
    // legs
    ctx.strokeStyle = C.paper; ctx.lineWidth = 12; ctx.lineCap = 'round';
    const lk = mode === 'drunk' ? Math.sin(t * 5) * 0.5 : 0;
    ctx.beginPath(); ctx.moveTo(-40, 110); ctx.lineTo(-60 + lk * 30, 230); ctx.moveTo(40, 110); ctx.lineTo(60 - lk * 30, 230); ctx.stroke();
    if (mode === 'suit') { ctx.fillStyle = '#1e2a44'; rr(ctx, -110, 30, 220, 110, 20); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-26, 30); ctx.lineTo(26, 30); ctx.lineTo(0, 80); ctx.fill(); ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.moveTo(-8, 36); ctx.lineTo(8, 36); ctx.lineTo(12, 110); ctx.lineTo(0, 124); ctx.lineTo(-12, 110); ctx.fill(); }
    // body glyphs
    text(ctx, 'ウソ', 0, 60, { family: F.dela, size: 190, color: mode === 'drunk' ? '#ffb4a8' : C.paper, align: 'center' });
    // face
    const ey = -40;
    if (mode === 'drunk') {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-60, ey); ctx.lineTo(-30, ey + 8); ctx.moveTo(30, ey + 8); ctx.lineTo(60, ey); ctx.stroke();
      circle(ctx, -70, ey + 40, 18, 'rgba(255,60,60,.6)'); circle(ctx, 70, ey + 40, 18, 'rgba(255,60,60,.6)');
      // necktie tied around the head
      ctx.fillStyle = '#c62828'; ctx.fillRect(-100, -120, 200, 18); ctx.beginPath(); ctx.moveTo(90, -115); ctx.lineTo(150, -150 + Math.sin(t * 6) * 10); ctx.lineTo(140, -100); ctx.fill();
    } else {
      circle(ctx, -40, ey, 9, '#111'); circle(ctx, 40, ey, 9, '#111');
      ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, ey + 10, 30, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      // glasses
      ctx.lineWidth = 4; strokeRR(ctx, -70, ey - 22, 56, 40, 10, '#111', 4); strokeRR(ctx, 14, ey - 22, 56, 40, 10, '#111', 4); line(ctx, -14, ey - 4, 14, ey - 4, '#111', 4);
    }
    ctx.restore();
  }
  const S25 = {
    id: 'S25', start: cue(41, '言って') - 0.2, trans: { type: 'slice', d: 0.6 }, chapter: CH,
    look: { vign: 0.4, bloom: 0.2 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tDrunk = cs(41, '酔っ払い') - 0.6, tNow = cs(42, '今の') - 0.2, tSuit = cs(42, 'スーツ') - 0.3, tPPT = cs(42, 'PowerPoint') - 0.3;
      // split
      const split = E.inOutCubic(clamp((t - tNow) / 0.7));
      const lx = lerp(960, 480, split);
      ctx.fillStyle = '#1b1414'; ctx.fillRect(0, 0, lerp(1920, 960, split), 1080);
      ctx.fillStyle = '#0e1320'; ctx.fillRect(lerp(1920, 960, split), 0, 1920, 1080);
      // left: old lie (drunk)
      const dq = since(t, 0, 0.5, E.outBack);
      text(ctx, '昔のウソ', lx, 180, { family: F.jpHeavy, size: 56, weight: 900, color: C.mute2, align: 'center', alpha: dq });
      usoChar(ctx, lx, 520, 0.95 * dq, 'drunk', t);
      if (t > tDrunk) {
        const hq = since(t, tDrunk, 0.3, E.outBack);
        ['ヒック', 'ヒック'].forEach((s, i) => { const k = (t - tDrunk - i * 0.6); if (k < 0) return; text(ctx, s, lx + 170 + i * 30, 360 - k * 40, { family: F.pop, size: 40, color: C.paper, alpha: clamp(1 - k / 2) * hq }); });
        text(ctx, '＝ 酔っ払い', lx, 900 - 40, { family: F.jpHeavy, size: 50, weight: 900, color: '#ff8f7a', align: 'center', alpha: hq });
      }
      // right: new lie in a suit with a slide
      if (split > 0) {
        const rx = 1440;
        text(ctx, '今のウソ', rx, 180, { family: F.jpHeavy, size: 56, weight: 900, color: C.mute2, align: 'center', alpha: split });
        const sq = since(t, tSuit, 0.5, E.outBack);
        usoChar(ctx, rx - 180, 540, 0.8 * sq, 'suit', t);
        const pq = since(t, tPPT, 0.5, E.outBack);
        if (pq > 0) {
          ctx.save(); ctx.translate(rx + 170, 470); ctx.scale(pq, pq);
          fillRR(ctx, -190, -140, 380, 250, 8, '#fff');
          ctx.fillStyle = '#1e3a8a'; ctx.fillRect(-190, -140, 380, 40);
          text(ctx, '信頼性レポート', -170, -112, { family: F.jpHeavy, size: 22, weight: 700, color: '#fff' });
          const bars = [0.4, 0.55, 0.72, 0.987];
          bars.forEach((b, i) => { const bh = 150 * b * since(t, tPPT + 0.3 + i * 0.1, 0.4); ctx.fillStyle = i === 3 ? '#16a34a' : '#93c5fd'; ctx.fillRect(-150 + i * 80, 90 - bh, 50, bh); });
          text(ctx, '98.7%', 110, -60, { family: F.bebas, size: 44, color: '#16a34a', align: 'center' });
          ctx.restore();
          // pointer
          ctx.strokeStyle = '#aaa'; ctx.lineWidth = 5; line(ctx, rx - 110, 520, rx + 225, 400 + Math.sin(t * 2) * 10, '#bbb', 4);
        }
        text(ctx, '＝ スーツ ＋ パワポ', rx, 900 - 40, { family: F.jpHeavy, size: 50, weight: 900, color: '#8fb3ff', align: 'center', alpha: since(t, tPPT + 0.4, 0.4) });
      }
    },
  };

  return [S22, S24, S25];
}

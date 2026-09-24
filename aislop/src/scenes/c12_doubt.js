// Chapter 12 — the liar's dividend: real things get doubted (11:31–12:31)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, check, cross } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag, chapterCard } from '../lib/hud.js';
import { photo, videoThumb } from '../lib/thumbs.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

function stampAI(ctx, x, y, s, q, label = 'AI?') {
  if (q <= 0) return;
  const k = lerp(2.0, 1, E.outQuad(clamp(q)));
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.16); ctx.scale(s * k, s * k); ctx.globalAlpha *= clamp(q * 1.5);
  strokeRR(ctx, -95, -52, 190, 104, 14, C.alert, 9);
  text(ctx, label, 0, 26, { family: F.archivo, size: 70, color: C.alert, align: 'center' });
  ctx.restore();
}
function bubble(ctx, x, y, s, str, q, col = C.paper, ink = C.ink) {
  if (q <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(q, q);
  const w = measure(ctx, str, { family: F.jpHeavy, size: 34 * s, weight: 900 }) + 60 * s;
  fillRR(ctx, -w / 2, -40 * s, w, 80 * s, 40 * s, col);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-20 * s, 36 * s); ctx.lineTo(-40 * s, 70 * s); ctx.lineTo(4 * s, 38 * s); ctx.fill();
  text(ctx, str, 0, 12 * s, { family: F.jpHeavy, size: 34 * s, weight: 900, color: ink, align: 'center' });
  ctx.restore();
}

export function doubtScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('12', '疑い', 'DOUBT', cue(134, 'ただ') - 0.2);

  // ------------------------------------------------ S70: the real photo, doubted
  const S70 = {
    id: 'S70', start: cue(134, 'ただ') - 0.2, trans: { type: 'dip', d: 0.5, color: '#000000' }, chapter: CH,
    look: { vign: 0.55, bloom: 0.25, grain: 0.06 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tFake = cs(135, '偽物') - 0.3, tReal = cs(135, '本物まで') - 0.3;
      chapterCard(ctx, t - 0.05, CH, 2.2, { x: 120, y: 470 });
      const q = since(t, 0.3, 0.8);
      ctx.save(); ctx.globalAlpha = q; ctx.translate(1150, 520); ctx.rotate(0.03);
      fillRR(ctx, -380, -270, 760, 560, 6, '#f4f1ea');
      photo(ctx, -350, -240, 700, 440, 12, { mood: 'dusk' });
      text(ctx, 'IMG_2031.JPG', -350, 250, { family: F.mono, size: 22, color: '#555' });
      ctx.restore();
      const n = Math.floor(clamp((t - tReal) / 1.2) * 18);
      for (let i = 0; i < n; i++) { const x = 820 + hash(i * 3) * 660, y = 300 + hash(i * 7) * 460; stampAI(ctx, x, y, 0.55 + hash(i * 11) * 0.3, clamp((t - tReal - i * 0.06) / 0.15)); }
      if (t > tFake) text(ctx, '本物まで疑われる', 1150, 900 - 40, { family: F.jpHeavy, size: 56, weight: 900, color: C.paper, align: 'center', alpha: since(t, tReal, 0.4), shadow: 'rgba(0,0,0,.9)', shadowBlur: 20 });
    },
  };

  // ------------------------------------------------ S71: 5 detectors × 15 real photos
  const S71 = {
    id: 'S71', start: cue(136, '二千二十六') - 0.2, trans: { type: 'glitch', d: 0.4 }, chapter: CH,
    source: 'NewsGuard（2026）：AI画像判定ツール5種 × 本物の写真15枚', sourceAt: 0.5,
    look: { vign: 0.45, bloom: 0.25 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tTools = cs(136, '五つ') - 0.3, tPhotos = cs(136, '十五枚') - 0.6, tScan = cs(137, 'すると') - 0.2, tPct = cs(137, '十三') - 0.5, t40 = cs(138, 'ある') - 0.2;
      // which cells are false positives: tool A 6/15 (40%), others 2,1,1,0  → 10/75 = 13.33%
      const bad = (tool, ph) => { const sets = [[1, 4, 6, 9, 11, 14], [3, 12], [7], [10], []]; return sets[tool].includes(ph); };
      const x0 = 330, y0 = 300, cw = 86, ch = 96;
      const hq0 = since(t, 0.05, 0.4) * (1 - since(t, tPhotos - 0.3, 0.3));
      if (hq0 > 0) { text(ctx, 'AI画像判定ツールのテスト', 960, 500, { family: F.jpHeavy, size: 76, weight: 900, color: C.paper, align: 'center', alpha: hq0 }); text(ctx, 'NewsGuard（2026）', 960, 580, { family: F.mono, size: 30, color: C.mute2, align: 'center', alpha: hq0 }); }
      // photo header
      for (let p = 0; p < 15; p++) {
        const q = since(t, tPhotos + p * 0.05, 0.3, E.outBack);
        if (q <= 0) continue;
        ctx.save(); ctx.translate(x0 + p * cw + cw / 2, y0 - 70); ctx.scale(q, q);
        photo(ctx, -40, -30, 80, 60, 100 + p);
        ctx.restore();
      }
      if (t > tPhotos) text(ctx, '本物の写真 15枚', x0, y0 - 130, { family: F.jpHeavy, size: 34, weight: 900, color: C.paper });
      // tools
      const scanN = Math.floor(clamp((t - tScan) / 3.0) * 75);
      for (let tool = 0; tool < 5; tool++) {
        const q = since(t, tTools + tool * 0.08, 0.3);
        if (q <= 0) continue;
        const y = y0 + tool * ch;
        const hl = tool === 0 ? since(t, t40, 0.4) : 0;
        if (hl > 0) fillRR(ctx, x0 - 190, y + 6, 190 + 15 * cw + 20, ch - 12, 10, rgba(C.alert, 0.14 * hl));
        ctx.save(); ctx.globalAlpha = q;
        text(ctx, 'ツール ' + 'ABCDE'[tool], x0 - 30, y + ch / 2 + 12, { family: F.jpHeavy, size: 32, weight: 900, color: hl > 0 ? C.alert : C.paper, align: 'right' });
        for (let p = 0; p < 15; p++) {
          const idx = tool * 15 + p;
          const x = x0 + p * cw;
          fillRR(ctx, x + 6, y + 10, cw - 12, ch - 20, 8, '#17171c');
          if (idx < scanN) {
            if (bad(tool, p)) { fillRR(ctx, x + 6, y + 10, cw - 12, ch - 20, 8, rgba(C.alert, 0.85)); text(ctx, 'AI', x + cw / 2, y + ch / 2 + 12, { family: F.archivo, size: 30, color: '#fff', align: 'center' }); }
            else check(ctx, x + cw / 2, y + ch / 2, 34, 1, '#6fbf73', 6);
          }
        }
        ctx.restore();
        if (hl > 0) text(ctx, '40% 誤判定', x0 + 15 * cw + 30, y + ch / 2 + 12, { family: F.jpHeavy, size: 40, weight: 900, color: C.alert, alpha: hl });
      }
      // scan cursor
      if (scanN > 0 && scanN < 75) { const tool = Math.floor(scanN / 15), p = scanN % 15; strokeRR(ctx, x0 + p * cw + 2, y0 + tool * ch + 6, cw - 4, ch - 12, 10, C.slop, 4); }
      // tally
      const errs = (() => { let e = 0; for (let i = 0; i < scanN; i++) if (bad(Math.floor(i / 15), i % 15)) e++; return e; })();
      if (t > tScan) {
        fillRR(ctx, 330, 820 - 20, 1300, 100, 16, 'rgba(11,11,13,.92)');
        text(ctx, '本物を「AI生成」と誤認', 360, 862, { family: F.jpHeavy, size: 36, weight: 900, color: C.paper });
        text(ctx, `${errs} / 75`, 880, 866, { family: F.mono, size: 40, weight: 700, color: C.alert });
        const pq = since(t, tPct, 0.4);
        text(ctx, '＝ 13.33%', 1100, 870, { family: F.bebas, size: 80, color: C.alert, alpha: pq });
      }
      noteTag(ctx, t - 2, '※ 全体13.33%・最大40%は発表値。ツール別の内訳は模式', 1880, 1000 - 50);
    },
  };

  // ------------------------------------------------ S72: "that's AI, right?" — the escape hatch
  const S72 = {
    id: 'S72', start: cue(139, 'これが') - 0.2, trans: { type: 'slice', d: 0.55 }, chapter: CH,
    look: { vign: 0.5, bloom: 0.25 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tOnly = cs(139, 'だけ') - 0.3, tShow = cs(140, '本物を見せても') - 0.3, tAI = cs(140, 'それAI') - 0.3, tSoc = cs(140, '社会') - 0.4;
      const q0 = since(t, 0.05, 0.5) * (1 - since(t, tShow - 0.2, 0.4));
      if (q0 > 0) {
        text(ctx, '「AIで偽物を作れる」', 960, 470, { family: F.jpHeavy, size: 84, weight: 900, color: C.paper, align: 'center', alpha: q0 });
        text(ctx, 'だけではない', 960, 590, { family: F.jpHeavy, size: 64, weight: 900, color: C.slop, align: 'center', alpha: since(t, tOnly, 0.4) * q0 });
      }
      if (t < tShow - 0.3) return;
      // a hand holding up a real photo
      const hq = since(t, tShow - 0.3, 0.6, E.outExpo);
      ctx.save(); ctx.translate(960, 560 + (1 - hq) * 400); ctx.rotate(-0.04);
      fillRR(ctx, -300, -220, 600, 440, 6, '#f4f1ea');
      photo(ctx, -276, -196, 552, 340, 21, { mood: 'day' });
      text(ctx, '証拠', 0, 190, { family: F.jpHeavy, size: 36, weight: 900, color: '#333', align: 'center' });
      ctx.fillStyle = '#e0a878'; rr(ctx, -60, 190, 120, 220, 40); ctx.fill();
      ctx.restore();
      // a crowd of "that's AI" bubbles
      const n = Math.floor(clamp((t - tAI) / 2.0) * 26);
      for (let i = 0; i < n; i++) {
        const a = hash(i * 5) * Math.PI * 2, r = 330 + hash(i * 9) * 320;
        const x = 960 + Math.cos(a) * r * 1.35, y = 520 + Math.sin(a) * r * 0.75;
        bubble(ctx, x, y, 0.7 + hash(i * 13) * 0.4, ['それAIでしょ', 'AIでしょ？', 'どうせAI', 'フェイクでは？'][i % 4], since(t, tAI + i * 0.07, 0.25, E.outBack), i % 5 === 0 ? C.slop : C.paper);
      }
      const sq = since(t, tSoc, 0.5, E.outExpo);
      if (sq > 0) { fillRR(ctx, 360, 860 - 70, 1200, 100, 16, 'rgba(11,11,13,.92)'); text(ctx, '本物を見せても、逃げられる社会', 960, 866, { family: F.jpHeavy, size: 50, weight: 900, color: C.alert, align: 'center', each: riseEach(sq, 30, 0.3) }); }
    },
  };

  // ------------------------------------------------ S73: evidence bags — photo / recording / video / text
  const S73 = {
    id: 'S73', start: cue(141, '証拠写真') - 0.35, trans: { type: 'whip', d: 0.4, dir: [0, 1] }, chapter: CH,
    look: { vign: 0.45, bloom: 0.3 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const items = [
        ['証拠写真', cs(141, '証拠写真') - 0.2, cs(142, 'AIじゃない') - 0.2, 'AIじゃないの？'],
        ['録音', cs(142, '録音') - 0.2, cs(143, '声クローン') - 0.2, '声クローンじゃないの？'],
        ['動画', cs(143, '動画') - 0.2, cs(144, '生成動画') - 0.2, '生成動画でしょ？'],
        ['文章', cs(144, '文章') - 0.2, cs(145, 'ChatGPT') - 0.2, 'ChatGPTに書かせたんでしょ？'],
      ];
      const audio = f.eng.audio;
      items.forEach(([lab, tIn, tQ, quote], i) => {
        const q = since(t, tIn, 0.45, E.outBack);
        if (q <= 0) return;
        const x = 250 + i * 473, y = 470;
        ctx.save(); ctx.translate(x, y + (1 - q) * 300); ctx.rotate((i % 2 ? 1 : -1) * 0.03);
        // bag
        fillRR(ctx, -190, -250, 380, 500, 14, 'rgba(220,230,240,.12)'); strokeRR(ctx, -190, -250, 380, 500, 14, 'rgba(230,240,255,.35)', 3);
        ctx.fillStyle = '#c62828'; ctx.fillRect(-190, -250, 380, 34);
        text(ctx, 'EVIDENCE #' + (i + 1), -170, -226, { family: F.mono, size: 20, weight: 700, color: '#fff' });
        // contents
        if (i === 0) { fillRR(ctx, -150, -180, 300, 220, 4, '#f4f1ea'); photo(ctx, -138, -168, 276, 180, 55, { mood: 'overcast' }); }
        if (i === 1) {
          fillRR(ctx, -160, -180, 320, 220, 10, '#10141c');
          // the narrator's own voice: real waveform of this very line
          const a0 = Math.floor(cue(142, '録音') * audio.wps), a1 = Math.floor(eng.cues.end(142, '録音がある') * audio.wps + 20);
          ctx.strokeStyle = '#7fb3ff'; ctx.lineWidth = 2; ctx.beginPath();
          for (let k = 0; k < 140; k++) { const idx = Math.floor(lerp(a0, a1, k / 139)); const v = audio.wave[idx] || 0; const xx = -150 + k * 300 / 139; ctx.moveTo(xx, -70 - v * 90); ctx.lineTo(xx, -70 + v * 90); }
          ctx.stroke();
          icon(ctx, 'mic', -130, -150, 26, { color: '#fff' });
        }
        if (i === 2) { videoThumb(ctx, -160, -170, 320, 180, 77); circle(ctx, 0, -80, 30, 'rgba(0,0,0,.6)'); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-10, -95); ctx.lineTo(16, -80); ctx.lineTo(-10, -65); ctx.fill(); }
        if (i === 3) { fillRR(ctx, -150, -190, 300, 240, 4, '#fbfaf7'); for (let k = 0; k < 9; k++) { ctx.fillStyle = '#bbb'; ctx.fillRect(-126, -160 + k * 24, 250 - (k % 3) * 40, 8); } }
        text(ctx, lab + 'がある', 0, 120, { family: F.jpHeavy, size: 40, weight: 900, color: C.paper, align: 'center' });
        ctx.restore();
        const sq = since(t, tQ, 0.2);
        stampAI(ctx, x, y - 60, 1.1, sq);
        bubble(ctx, x, y + 250, i === 3 ? 0.78 : 0.95, quote, since(t, tQ + 0.1, 0.35, E.outBack), C.alert, '#fff');
      });
    },
  };

  // ------------------------------------------------ S74: the burden of proof flips
  function figure(ctx, x, y, s, col, load, box, boxCol) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const squash = load * 0.12;
    circle(ctx, 0, -130 + squash * 60, 34, col);
    fillRR(ctx, -44, -88 + squash * 60, 88, 120 - squash * 60, 30, col);
    fillRR(ctx, -38, 30, 30, 90, 14, col); fillRR(ctx, 8, 30, 30, 90, 14, col);
    // box on the back
    const bw = box, bh = box * 0.8;
    fillRR(ctx, -bw / 2, -170 - bh + squash * 60, bw, bh, 10, boxCol);
    ctx.restore();
  }
  const S74 = {
    id: 'S74', start: cue(146, 'AI以前') - 0.25, trans: { type: 'fade', d: 0.5 }, chapter: CH,
    look: { vign: 0.45, bloom: 0.25 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tBefore = 0.1, tFaker = cs(146, '偽物を作る側') - 0.3, tAfter = cs(147, 'AI以後') - 0.2, tReal = cs(147, '本物を出した側') - 0.3, tProve = cs(147, '証明') - 0.4;
      line(ctx, 960, 170, 960, 880, rgba(C.paper, 0.2), 2);
      text(ctx, 'AI以前', 480, 160, { family: F.jpHeavy, size: 56, weight: 900, color: C.mute2, align: 'center', alpha: since(t, tBefore, 0.4) });
      text(ctx, 'AI以後', 1300, 160, { family: F.jpHeavy, size: 56, weight: 900, color: C.paper, align: 'center', alpha: since(t, tAfter, 0.4) });
      // before: faker carries the burden, the honest person is light
      const fq = since(t, tFaker, 0.6, E.outBounce);
      figure(ctx, 360, 640, 1.15, C.alert, fq, 60 + 160 * fq, '#6b1d1a');
      figure(ctx, 620, 640, 1.15, C.human, 0, 0.01, '#000');
      text(ctx, '偽物を作る側', 360, 820, { family: F.jpHeavy, size: 30, weight: 900, color: C.alert, align: 'center', alpha: since(t, tFaker, 0.4) });
      text(ctx, '「証拠を用意」', 360, 300, { family: F.jpHeavy, size: 34, weight: 900, color: C.paper, align: 'center', alpha: fq });
      text(ctx, '本物側', 620, 820, { family: F.jpHeavy, size: 30, weight: 900, color: C.human, align: 'center', alpha: since(t, tFaker, 0.4) });
      // after: roles flip
      if (t > tAfter) {
        const rq = since(t, tProve, 0.7, E.outBounce);
        figure(ctx, 1300, 640, 1.15, C.alert, 0, 0.01, '#000');
        figure(ctx, 1600, 640, 1.15, C.human, rq, 80 + 200 * rq, '#7a4a12');
        text(ctx, '偽物側', 1300, 820, { family: F.jpHeavy, size: 30, weight: 900, color: C.alert, align: 'center' });
        text(ctx, '本物を出した側', 1600, 820, { family: F.jpHeavy, size: 30, weight: 900, color: C.human, align: 'center', alpha: since(t, tReal, 0.4) });
        text(ctx, '「これは本物です」', 1600, 290, { family: F.jpHeavy, size: 34, weight: 900, color: C.paper, align: 'center', alpha: rq });
        text(ctx, 'と証明する仕事', 1600, 336, { family: F.jpHeavy, size: 34, weight: 900, color: C.paper, align: 'center', alpha: rq });
        if (rq > 0.8) for (let k = 0; k < 3; k++) { const a = (t * 1.2 + k * 0.33) % 1; circle(ctx, 1660 + k * 12, 560 + a * 40, 5, `rgba(120,190,255,${1 - a})`); }
      }
    },
  };

  return [S70, S71, S72, S73, S74];
}

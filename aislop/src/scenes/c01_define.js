// Chapter 01 — what is AI slop (0:32–1:32)
import { C, F, rgba, mixHex } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, font, decodeEach, riseEach, popEach, measure, para } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, marker, check, cross, poly, arrow, sketchCircle, underline } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { paper, vignette2d } from '../lib/textures.js';
import { specimen, MEDIA } from '../lib/media.js';
import { videoThumb, webCard, postCard, photo, bookCover, albumArt, atlas } from '../lib/thumbs.js';
import { slime } from '../lib/slime.js';
import { blurTex, mat } from '../lib/glfx.js';
import { THREE } from '../engine/gl.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

export function defineScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('01', '定義', 'DEFINITION', cue(5, 'これが') - 0.2);

  // ------------------------------------------------ S06–S07: slime title → dictionary
  let drops;
  const S06 = {
    id: 'S06', start: cue(5, 'これが') - 0.25, trans: { type: 'goo', d: 0.9 }, hud: false,
    look: (t) => ({ vign: 0.5, bloom: 0.45, bloomThresh: 0.6, ca: 0.15 }),
    setup() { const r = rng(4); drops = Array.from({ length: 14 }, () => ({ x: r.range(380, 1540), t0: r.range(1.2, 6), sp: r.range(0.8, 1.4), r: r.range(7, 13) })); },
    draw(f) {
      const { ctx, t } = f;
      const tDict = cue(6, '直訳') - f.S.start;
      const up = E.inOutCubic(clamp((t - tDict + 0.3) / 0.9));
      const ty = lerp(500, 250, up), ts = lerp(1, 0.6, up);
      glow(ctx, 960, ty, 900, '#1d2a05', 0.55);
      // --- mask: title + falling droplets
      ctx.save();
      ctx.translate(960, ty); ctx.scale(ts, ts);
      const pop = spring(t - 0.05, 1.6, 0.5);
      ctx.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);
      text(ctx, 'AI SLOP', 0, 105, { family: F.archivo, size: 300, color: '#fff', align: 'center', ls: 6 });
      ctx.restore();
      for (const d of drops) {
        const a = t - d.t0; if (a < 0) continue;
        const yy = ty + 150 * ts + 120 * ts + 0.5 * 900 * (a * d.sp) * (a * d.sp) * 0.5;
        if (yy > 1200) continue;
        circle(ctx, d.x, yy, d.r * ts, '#fff');
      }
      const maskTex = f.grab2d('title_mask');
      slime(f, maskTex, { grow: E.inQuad(clamp((t - 0.3) / 7)) * 1.2 + 0.08, maxLen: 300, blur: 7, seed: 2.3 });
      // subtitle
      const sa = since(t, 0.6, 0.8);
      text(ctx, 'インターネットがAIの残飯で埋まる日', 960, lerp(760, 470, up), { family: F.mincho, size: lerp(58, 40, up), weight: 900, color: C.paper, align: 'center', ls: 4, alpha: sa, each: decodeEach(clamp((t - 0.6) / 1.2), t, 21, false, C.paper, C.slop) });
      // dictionary entry
      if (t > tDict - 0.2) {
        const p = since(t, tDict, 0.6, E.outExpo);
        const x0 = 520, y0 = 620;
        ctx.save(); ctx.globalAlpha = p;
        line(ctx, x0, y0 - 70, x0 + 880 * p, y0 - 70, rgba(C.paper, 0.35), 2);
        text(ctx, 'slop', x0, y0, { family: F.garamond, size: 96, weight: 500, style: 'italic', color: C.paper });
        text(ctx, '/slɑːp/', x0 + 210, y0 - 6, { family: F.garamond, size: 40, color: C.mute2 });
        text(ctx, '名詞', x0 + 380, y0 - 8, { family: F.jp, size: 30, weight: 700, color: C.ink, each: null });
        fillRR(ctx, x0 + 370, y0 - 44, 80, 46, 8, C.paperDim);
        text(ctx, '名詞', x0 + 410, y0 - 10, { family: F.jp, size: 28, weight: 700, color: C.ink, align: 'center' });
        const t1 = cue(6, '残飯') - f.S.start - 0.45, t2 = cue(6, 'どろどろ') - f.S.start - 0.45;
        const defs = [[t1, '①', 'AIの', '残飯'], [t2, '②', 'AIの', 'どろどろした餌']];
        defs.forEach(([tt, n, ai, w], i) => {
          const q = since(t, tt, 0.5, E.outExpo);
          if (q <= 0) return;
          const y = y0 + 110 + i * 92;
          text(ctx, n, x0, y, { family: F.jp, size: 44, weight: 700, color: C.mute2, alpha: q });
          text(ctx, ai, x0 + 70, y, { family: F.jpHeavy, size: 60, weight: 900, color: C.slop, alpha: q, each: riseEach(q, 40, 0.3) });
          const aw = measure(ctx, ai, { family: F.jpHeavy, size: 60, weight: 900 });
          text(ctx, w, x0 + 74 + aw, y, { family: F.jpHeavy, size: 60, weight: 900, color: C.paper, alpha: q, each: riseEach(clamp(q * 1.2 - 0.1), 40, 0.3) });
        });
        ctx.restore();
      }
    },
  };

  // ------------------------------------------------ S08–S09: word of the year certificate → definition
  const S08 = {
    id: 'S08', start: cue(7, '二千二十五') - 0.3, trans: { type: 'slice', d: 0.7 }, chapter: CH,
    source: 'American Dialect Society — 2025 Word of the Year', sourceAt: 0.6,
    look: { vign: 0.45, bloom: 0.2, grain: 0.05 },
    draw(f) {
      const { ctx, t } = f;
      const tDef = cue(8, '意味は') - f.S.start;
      const slide = E.inOutCubic(clamp((t - tDef + 0.2) / 0.9));
      // certificate on paper
      const push = 1 + t * 0.012;
      ctx.save();
      ctx.translate(960 - slide * 520, 470 - slide * 20); ctx.scale(push * (1 - slide * 0.42), push * (1 - slide * 0.42)); ctx.rotate(-0.015 + slide * -0.03);
      const w = 1180, h = 760;
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
      ctx.drawImage(paper('#f1e9d6'), 0, 0, 1920, 1080, -w / 2, -h / 2, w, h);
      ctx.shadowColor = 'transparent';
      strokeRR(ctx, -w / 2 + 26, -h / 2 + 26, w - 52, h - 52, 4, '#8a6d2c', 3);
      strokeRR(ctx, -w / 2 + 38, -h / 2 + 38, w - 76, h - 76, 2, '#8a6d2c', 1.5);
      // corner ornaments
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circle(ctx, sx * (w / 2 - 38), sy * (h / 2 - 38), 10, '#8a6d2c'); }
      text(ctx, 'AMERICAN DIALECT SOCIETY', 0, -h / 2 + 118, { family: F.playfair, size: 34, weight: 700, color: '#3b2f1a', align: 'center', ls: 8 });
      text(ctx, 'アメリカ方言学会', 0, -h / 2 + 162, { family: F.mincho, size: 28, weight: 700, color: '#6b5a3a', align: 'center', ls: 6 });
      line(ctx, -260, -h / 2 + 190, 260, -h / 2 + 190, '#8a6d2c', 1.5);
      text(ctx, 'WORD OF THE YEAR', 0, -h / 2 + 250, { family: F.garamond, size: 44, weight: 600, color: '#3b2f1a', align: 'center', ls: 10 });
      const wp = since(t, 0.5, 0.8, E.outExpo);
      text(ctx, 'slop', 0, 110, { family: F.iserif, size: 290, style: 'italic', color: '#1c160c', align: 'center', alpha: wp, each: riseEach(wp, 80, 0.3) });
      text(ctx, '2025', 0, 230, { family: F.garamond, size: 56, weight: 700, color: '#8a6d2c', align: 'center', ls: 20 });
      // gold seal
      const sp = spring(t - 1.3, 2.2, 0.45);
      if (t > 1.3) {
        ctx.save(); ctx.translate(w / 2 - 170, h / 2 - 150); ctx.rotate(-0.2 + (1 - sp) * 0.6); ctx.scale(sp, sp);
        for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; ctx.fillStyle = '#b8912a'; ctx.beginPath(); ctx.arc(Math.cos(a) * 88, Math.sin(a) * 88, 16, 0, Math.PI * 2); ctx.fill(); }
        const g = ctx.createRadialGradient(-20, -30, 10, 0, 0, 95); g.addColorStop(0, '#fff2b8'); g.addColorStop(0.5, '#d9b04a'); g.addColorStop(1, '#8c6a14');
        circle(ctx, 0, 0, 92, g); circle(ctx, 0, 0, 72, null, 'rgba(90,60,0,.55)', 2);
        text(ctx, '2025', 0, -8, { family: F.garamond, size: 34, weight: 700, color: '#4a3406', align: 'center' });
        text(ctx, 'WOTY', 0, 30, { family: F.garamond, size: 26, weight: 700, color: '#4a3406', align: 'center', ls: 4 });
        ctx.restore();
      }
      ctx.restore();
      // definition (right side)
      if (slide > 0) {
        const x0 = 880, a = slide;
        ctx.save(); ctx.globalAlpha = a;
        text(ctx, '意味', x0, 300, { family: F.jpHeavy, size: 34, weight: 700, color: C.mute2 });
        line(ctx, x0, 320, x0 + 880 * a, 320, rgba(C.paper, 0.3), 2);
        const tq = cue(8, '低品質') - f.S.start, tm = cue(8, '大量生産') - f.S.start;
        const y1 = 430;
        text(ctx, '低品質', x0, y1, { family: F.jpHeavy, size: 92, weight: 900, color: C.paper, each: riseEach(since(t, tq - 0.3, 0.5), 50) });
        const w1 = measure(ctx, '低品質', { family: F.jpHeavy, size: 92, weight: 900 });
        text(ctx, '×', x0 + w1 + 24, y1 - 6, { family: F.sans, size: 70, weight: 300, color: C.mute2, alpha: since(t, tm - 0.4, 0.3) });
        text(ctx, '大量生産', x0 + w1 + 100, y1, { family: F.jpHeavy, size: 92, weight: 900, color: C.slop, each: riseEach(since(t, tm - 0.3, 0.5), 50) });
        marker(ctx, x0 - 6, y1 + 12, w1 + 12, 14, since(t, tq + 0.2, 0.4), rgba(C.alert, 0.7));
        text(ctx, 'のコンテンツ', x0, y1 + 100, { family: F.jpHeavy, size: 56, weight: 700, color: C.paper, alpha: since(t, tm + 0.4, 0.4) });
        const tg = cue(9, '典型的') - f.S.start, tai = cue(9, '生成') - f.S.start;
        const q = since(t, tg - 0.2, 0.5);
        text(ctx, '典型的には', x0, y1 + 230, { family: F.jp, size: 40, weight: 500, color: C.mute2, alpha: q });
        text(ctx, '生成AI', x0 + 210, y1 + 230, { family: F.jpHeavy, size: 52, weight: 900, color: C.ink, alpha: q });
        const gw = measure(ctx, '生成AI', { family: F.jpHeavy, size: 52, weight: 900 });
        const hp = since(t, tai - 0.1, 0.35, E.outExpo);
        ctx.save(); ctx.globalAlpha *= q; fillRR(ctx, x0 + 200, y1 + 180, (gw + 20) * hp, 66, 8, C.slop); ctx.restore();
        text(ctx, '生成AI', x0 + 210, y1 + 230, { family: F.jpHeavy, size: 52, weight: 900, color: hp > 0.5 ? C.ink : C.paper, alpha: q });
        text(ctx, 'で作られるもの', x0 + 230 + gw, y1 + 230, { family: F.jp, size: 40, weight: 500, color: C.mute2, alpha: q });
        ctx.restore();
      }
    },
  };

  // ------------------------------------------------ S10: six fingers → zoom out to all media → infection
  let mosaic, mosaicCats;
  const CATS = [
    { w: '文章', k: 'text' }, { w: '動画', k: 'video' }, { w: '音声', k: 'voice' }, { w: '音楽', k: 'music' },
    { w: '検索結果', k: 'search' }, { w: '電子書籍', k: 'ebook' }, { w: 'ニュース', k: 'news' }, { w: 'SNS投稿', k: 'sns' },
  ];
  const MC = 12, MR = 8, MTW = 150, MTH = 100, MG = 12;
  const handTile = { c: 5, r: 3 };
  function buildMosaic() {
    const cw = MC * (MTW + MG), chh = MR * (MTH + MG);
    const c = document.createElement('canvas'); c.width = cw; c.height = chh;
    const ctx = c.getContext('2d');
    const r = rng(12);
    mosaicCats = [];
    for (let j = 0; j < MR; j++) for (let i = 0; i < MC; i++) {
      const x = i * (MTW + MG), y = j * (MTH + MG);
      if (i === handTile.c && j === handTile.r) { mosaicCats.push(-1); continue; }
      const k = Math.floor(r() * CATS.length);
      mosaicCats.push(k);
      drawCatTile(ctx, CATS[k].k, x, y, MTW, MTH, i * 31 + j * 7);
    }
    return c;
  }
  function drawCatTile(ctx, k, x, y, w, h, seed) {
    const r = rng(seed + 3);
    ctx.save(); rr(ctx, x, y, w, h, 8); ctx.clip();
    switch (k) {
      case 'text': ctx.fillStyle = '#f3f0e8'; ctx.fillRect(x, y, w, h); for (let i = 0; i < 6; i++) { ctx.fillStyle = '#c3bdb0'; ctx.fillRect(x + 12, y + 16 + i * 13, (w - 24) * (i === 5 ? 0.5 : 0.9 + r() * 0.1), 5); } break;
      case 'video': videoThumb(ctx, x, y, w, h, seed); break;
      case 'voice': { ctx.fillStyle = '#17233a'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#7fb3ff'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 60; i++) { const xx = x + 10 + i * (w - 20) / 60; const a = Math.sin(i * 0.7 + seed) * Math.sin(i * 0.13) * 28; ctx.moveTo(xx, y + h / 2 - a); ctx.lineTo(xx, y + h / 2 + a); } ctx.stroke(); icon(ctx, 'mic', x + 18, y + 18, 18, { color: '#fff' }); break; }
      case 'music': albumArt(ctx, x + (w - h) / 2, y, h, seed); ctx.fillStyle = 'rgba(0,0,0,.2)'; break;
      case 'search': { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); fillRR(ctx, x + 8, y + 8, w - 16, 18, 9, '#eee'); for (let i = 0; i < 3; i++) { ctx.fillStyle = '#1a55c9'; ctx.fillRect(x + 12, y + 36 + i * 22, (w - 40) * (0.6 + r() * 0.4), 6); ctx.fillStyle = '#bbb'; ctx.fillRect(x + 12, y + 45 + i * 22, w - 30, 4); } break; }
      case 'ebook': { ctx.fillStyle = '#2b2b2f'; ctx.fillRect(x, y, w, h); fillRR(ctx, x + w / 2 - 34, y + 6, 68, h - 12, 6, '#e9e6de'); for (let i = 0; i < 6; i++) { ctx.fillStyle = '#9d988c'; ctx.fillRect(x + w / 2 - 26, y + 16 + i * 11, 52, 3); } break; }
      case 'news': { ctx.fillStyle = '#f7f4ec'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#111'; ctx.fillRect(x + 10, y + 10, w - 20, 10); ctx.fillStyle = '#b3261e'; ctx.fillRect(x + 10, y + 28, 40, 14); ctx.fillStyle = '#999'; ctx.fillRect(x + 10, y + 50, 58, 40); for (let i = 0; i < 5; i++) { ctx.fillStyle = '#bbb'; ctx.fillRect(x + 76, y + 50 + i * 8, w - 88, 4); } break; }
      case 'sns': postCard(ctx, x, y, w, h, seed, { dark: seed % 2 === 0 }); break;
    }
    ctx.restore();
  }
  function drawHand(ctx, x, y, s, fingersShown = 6) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const skin = ctx.createLinearGradient(-120, -200, 120, 200); skin.addColorStop(0, '#f6d2b4'); skin.addColorStop(1, '#d99a73');
    ctx.fillStyle = skin; ctx.strokeStyle = 'rgba(90,40,20,.55)'; ctx.lineWidth = 3;
    // fingers (6)
    const F6 = [[-102, -60, -0.42, 118], [-66, -120, -0.22, 170], [-22, -140, -0.06, 190], [22, -138, 0.08, 186], [62, -118, 0.22, 168], [98, -84, 0.36, 132]];
    F6.slice(0, fingersShown).forEach(([fx, fy, a, L]) => {
      ctx.save(); ctx.translate(fx, fy + 60); ctx.rotate(a);
      rr(ctx, -19, -L, 38, L + 30, 19); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,235,225,.8)'; rr(ctx, -12, -L + 6, 24, 26, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(120,60,30,.35)'; ctx.lineWidth = 2; line(ctx, -10, -L * 0.45, 10, -L * 0.45, 'rgba(120,60,30,.35)', 2); line(ctx, -10, -L * 0.2, 10, -L * 0.2, 'rgba(120,60,30,.35)', 2);
      ctx.fillStyle = skin; ctx.strokeStyle = 'rgba(90,40,20,.55)'; ctx.lineWidth = 3;
      ctx.restore();
    });
    // thumb
    ctx.save(); ctx.translate(-120, 70); ctx.rotate(-1.05); rr(ctx, -22, -120, 44, 140, 22); ctx.fill(); ctx.stroke(); ctx.restore();
    // palm
    ctx.beginPath(); ctx.moveTo(-125, -10); ctx.quadraticCurveTo(-140, 170, -60, 230); ctx.lineTo(70, 230); ctx.quadraticCurveTo(140, 160, 130, -20); ctx.quadraticCurveTo(0, -40, -125, -10); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,60,30,.3)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-90, 80); ctx.quadraticCurveTo(0, 50, 100, 60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-70, 130); ctx.quadraticCurveTo(10, 110, 90, 120); ctx.stroke();
    // sleeve
    ctx.fillStyle = '#2d3a5a'; rr(ctx, -95, 220, 190, 120, 10); ctx.fill();
    ctx.restore();
    return F6;
  }
  const INFECT = /* glsl */ `
  uniform sampler2D src; uniform float prog, time; uniform vec2 res; uniform vec3 seeds[5];
  varying vec2 vUv;
  void main(){
    vec4 c = texture2D(src, vUv);
    vec2 p = vUv * vec2(res.x/res.y, 1.);
    float d = 9.;
    for (int i = 0; i < 5; i++) d = min(d, length(p - seeds[i].xy) - seeds[i].z);
    float n = vnoise(p * 7.) * .18 + vnoise(p * 23.) * .06;
    float front = prog * 2.2;
    float m = smoothstep(front, front - .06, d + n);
    // glossy goo layer
    float h = vnoise(p * 14. + vec2(0., time * .3)) * .6 + vnoise(p * 35.) * .4;
    vec3 goo = mix(vec3(.24,.33,.05), vec3(.78,.96,.2), h);
    float edge = smoothstep(.03, 0., abs(d + n - front)) * step(.001, prog);
    float spec = pow(h, 8.) * 1.4;
    vec3 col = mix(c.rgb, mix(c.rgb * vec3(.55,.8,.1), goo, .72) + spec, m);
    col += vec3(.78,.96,.2) * edge * .9;
    gl_FragColor = vec4(col, 1.);
  }`;
  const S10 = {
    id: 'S10', start: cue(10, 'つまり') - 0.2, trans: { type: 'whip', d: 0.45, dir: [0, 1] }, chapter: CH,
    look: { vign: 0.45, bloom: 0.25 },
    setup() { mosaic = buildMosaic(); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tSix = cs(10, '六本') - 0.9;
      const tNot = cs(10, 'だけの話') - 0.1;
      const tAll = cs(11, '全部が') - 0.05;
      // zoom from hand tile to whole mosaic
      const mw = MC * (MTW + MG), mh = MR * (MTH + MG);
      const baseS = 1380 / mw;
      const zoomOut = E.inOutCubic(clamp((t - tNot) / 1.6));
      const handS = 6.2;
      const s = lerp(handS, 1, zoomOut) * baseS;
      const hx = handTile.c * (MTW + MG) + MTW / 2, hy = handTile.r * (MTH + MG) + MTH / 2;
      const cx = lerp(hx, mw / 2, zoomOut), cy = lerp(hy, mh / 2, zoomOut);
      ctx.save();
      ctx.translate(960, 440); ctx.scale(s, s); ctx.translate(-cx, -cy);
      ctx.globalAlpha = clamp(zoomOut * 3);
      if (zoomOut > 0) ctx.drawImage(mosaic, 0, 0);
      ctx.globalAlpha = 1;
      // hand tile (AI image frame)
      const tx = handTile.c * (MTW + MG), ty = handTile.r * (MTH + MG);
      ctx.save(); rr(ctx, tx, ty, MTW, MTH, 8 / (s / baseS) + 2); ctx.clip();
      const bg = ctx.createLinearGradient(tx, ty, tx + MTW, ty + MTH); bg.addColorStop(0, '#b6c8ff'); bg.addColorStop(1, '#ffd0e8');
      ctx.fillStyle = bg; ctx.fillRect(tx, ty, MTW, MTH);
      const F6 = drawHand(ctx, tx + MTW / 2, ty + MTH * 0.66, 0.235);
      ctx.restore();
      // counting marks (in tile space)
      F6.forEach(([fx, fy, a, L], i) => {
        const tc = tSix + i * 0.14;
        const q = since(t, tc, 0.25, E.outBack);
        if (q <= 0) return;
        const px = tx + MTW / 2 + 0.235 * (fx + Math.sin(a) * (L + 22)), py = ty + MTH * 0.66 + 0.235 * (fy + 60 - Math.cos(a) * (L + 22));
        ctx.save(); ctx.globalAlpha = clamp(1 - zoomOut * 3);
        circle(ctx, px, py - 6, 7.5 * q, i === 5 ? C.alert : C.ink, i === 5 ? null : C.paper, 0.7);
        text(ctx, String(i + 1), px, py - 2.6, { family: F.grotesk, size: 10 * q, weight: 700, color: '#fff', align: 'center' });
        ctx.restore();
      });
      ctx.restore();
      // "6本" callout in screen space
      const cq = since(t, tSix + 0.9, 0.4, E.outBack);
      if (cq > 0 && zoomOut < 1) {
        ctx.save(); ctx.globalAlpha = clamp(1 - zoomOut * 3);
        text(ctx, '指が', 1420, 330, { family: F.jpHeavy, size: 54, weight: 700, color: C.paper, alpha: cq });
        text(ctx, '6本', 1420, 470, { family: F.jpHeavy, size: 150, weight: 900, color: C.alert, each: popEach(cq, 0.3) });
        text(ctx, 'AI-GENERATED IMAGE', 190, 170, { family: F.mono, size: 20, weight: 700, color: C.mute2, ls: 3, alpha: 1 - zoomOut });
        ctx.restore();
      }
      // category callouts while zoomed out
      if (zoomOut > 0.95) {
        const k = CATS.reduce((acc, c, i) => (t >= cs(11, c.w) - 0.15 ? i : acc), -1);
        const all = t >= tAll;
        const mx0 = 960 - mw * baseS / 2, my0 = 440 - mh * baseS / 2;
        for (let i = 0; i < mosaicCats.length; i++) {
          const ci = mosaicCats[i]; if (ci < 0) continue;
          const on = ci <= k && !all;
          if (!on && !all) { ctx.fillStyle = 'rgba(11,11,13,.55)'; }
          const c = i % MC, r = Math.floor(i / MC);
          const x = mx0 + c * (MTW + MG) * baseS, y = my0 + r * (MTH + MG) * baseS;
          if (ci === k && !all) strokeRR(ctx, x - 2, y - 2, MTW * baseS + 4, MTH * baseS + 4, 7, C.slop, 3);
          else if (!on && !all) { ctx.fillRect(x, y, MTW * baseS, MTH * baseS); }
        }
        // label chips row
        CATS.forEach((c, i) => {
          const q = since(t, cs(11, c.w) - 0.15, 0.3, E.outBack);
          if (q <= 0) return;
          const lx = 312 + (i % 8) * 185, ly = 868;
          ctx.save(); ctx.globalAlpha = q;
          fillRR(ctx, lx - 80, ly - 36, 170, 50, 25, i === k && !all ? C.slop : 'rgba(255,255,255,.1)');
          text(ctx, c.w, lx + 5, ly - 2, { family: F.jpHeavy, size: 26, weight: 700, color: i === k && !all ? C.ink : C.paper, align: 'center' });
          ctx.restore();
        });
      }
      if (t > tAll - 0.2) {
        const m = mat(f.gl, 'infect', INFECT, { src: { value: null }, prog: { value: 0 }, time: { value: 0 }, res: { value: new THREE.Vector2(f.gl.W, f.gl.H) }, seeds: { value: [new THREE.Vector3(0.3, 0.7, 0), new THREE.Vector3(1.4, 0.3, 0), new THREE.Vector3(0.9, 0.5, 0), new THREE.Vector3(1.6, 0.8, 0), new THREE.Vector3(0.5, 0.2, 0)] } });
        m.uniforms.prog.value = E.inOutSine(clamp((t - tAll) / 1.8)); m.uniforms.time.value = t;
        f.fx(m);
        const q = since(t, tAll + 0.3, 0.5, E.outBack);
        text(ctx, '全部が対象', 960, 520, { family: F.jpHeavy, size: 140, weight: 900, color: C.ink, align: 'center', stroke: C.slop, strokeW: 0, each: popEach(q, 0.3), shadow: 'rgba(0,0,0,.6)', shadowBlur: 30 });
      }
    },
  };

  // ------------------------------------------------ S12: AI-assisted ≠ slop; the human pipeline
  const STEPS = [['企画', 'lightbulb', '企画して'], ['調査', 'search', '調べて'], ['編集', 'scissors', '編集して'], ['責任', 'pen-line', '責任を持って']];
  const S12 = {
    id: 'S12', start: cue(12, 'AIを使った') - 0.2, trans: { type: 'glitch', d: 0.5 }, chapter: CH,
    look: { vign: 0.4, bloom: 0.25, gain: [1.02, 1, 0.97] },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      grid(ctx, 60, 'rgba(255,255,255,0.035)');
      const tNe = cs(12, 'ではありません') - 0.2;
      const up = E.inOutCubic(clamp((t - cs(13, '人間が') + 0.4) / 0.8));
      const ey = lerp(470, 200, up), es = lerp(1, 0.62, up);
      ctx.save(); ctx.translate(960, ey); ctx.scale(es, es);
      const p1 = since(t, 0, 0.5, E.outExpo);
      text(ctx, 'AIを使った作品', -120, 0, { family: F.jpHeavy, size: 86, weight: 900, color: C.paper, align: 'right', each: riseEach(p1, 40, 0.3) });
      text(ctx, 'AI slop', 120, 0, { family: F.archivo, size: 92, color: C.slop, align: 'left', each: riseEach(since(t, 0.4, 0.5, E.outExpo), 40, 0.3) });
      // = → ≠
      const eqa = since(t, 0.6, 0.3);
      ctx.save(); ctx.globalAlpha = eqa; ctx.fillStyle = C.paper; ctx.fillRect(-50, -46, 100, 12); ctx.fillRect(-50, -18, 100, 12); ctx.restore();
      const sl = since(t, tNe, 0.3, E.outBack);
      if (sl > 0) { ctx.save(); ctx.translate(0, -30); ctx.rotate(-1.05); ctx.fillStyle = C.alert; ctx.fillRect(-60 * sl, -7, 120 * sl, 14); ctx.restore(); }
      ctx.restore();
      // pipeline
      if (up > 0) {
        const y = 560, x0 = 330, gap = 330;
        STEPS.forEach(([lab, ic, sub], i) => {
          const ts = cs(13, sub) - 0.15;
          const q = since(t, ts, 0.45, E.outBack);
          const x = x0 + i * gap;
          if (i > 0) { const lq = since(t, ts - 0.3, 0.35); line(ctx, x - gap + 90, y, x - 90, y, rgba(C.human, 0.6), 4, lq); }
          ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * clamp(q);
          circle(ctx, x, y, 78 * (0.8 + 0.2 * q), q > 0 ? '#2b1d0b' : 'rgba(255,255,255,.04)', q > 0 ? C.human : 'rgba(255,255,255,.2)', 3);
          icon(ctx, ic, x, y - 8, 56, { color: q > 0 ? C.human : C.mute, lw: 1.8 });
          text(ctx, lab, x, y + 140, { family: F.jpHeavy, size: 44, weight: 900, color: q > 0 ? C.paper : C.mute, align: 'center' });
          // person pip
          if (q > 0) { circle(ctx, x + 58, y - 58, 22, C.human); icon(ctx, 'user', x + 58, y - 58, 28, { color: C.ink, lw: 2.4 }); }
          // AI tool badge on some steps
          if (q > 0 && (i === 1 || i === 2)) { fillRR(ctx, x - 96, y - 86, 58, 28, 8, C.slop); text(ctx, 'AI', x - 67, y - 64, { family: F.grotesk, size: 18, weight: 700, color: C.ink, align: 'center' }); }
          ctx.restore();
        });
        const tw = cs(13, '普通に作品') - 0.2;
        const wq = since(t, tw, 0.5, E.outBack);
        if (wq > 0) {
          const x = x0 + 3 * gap + 250;
          arrow(ctx, x0 + 3 * gap + 95, y, x - 90, y, { color: C.human, lw: 4, p: since(t, tw - 0.2, 0.3) });
          ctx.save(); ctx.translate(x, y); ctx.scale(wq, wq);
          fillRR(ctx, -80, -80, 160, 160, 20, C.human);
          icon(ctx, 'award', 0, -10, 80, { color: C.ink, lw: 2 });
          ctx.restore();
          text(ctx, '作品', x, y + 140, { family: F.jpHeavy, size: 48, weight: 900, color: C.human, align: 'center', alpha: wq });
          check(ctx, x + 70, y - 90, 50, since(t, tw + 0.3, 0.4), C.slop, 8);
        }
      }
    },
  };

  // ------------------------------------------------ S13: the scale tips
  const S13 = {
    id: 'S13', start: cue(14, 'slop') - 0.25, trans: { type: 'wipe', d: 0.6, dir: [1, 0], color: '#c6f432' }, chapter: CH,
    look: { vign: 0.4, bloom: 0.2 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tL = cs(14, '伝えること') - 0.2, tR = cs(14, 'とにかく') - 0.1, tTip = cs(14, '瞬間') - 0.15;
      // pile grows on the right from tR
      const pile = Math.floor(clamp((t - tR) / (tTip - tR)) * 34);
      // angle: slight left lean → balanced → slam to right
      let ang = -0.12 * since(t, tL, 0.6);
      ang += 0.12 * clamp((t - tR) / (tTip - tR)) * 0.9;
      const slam = t > tTip ? spring(t - tTip, 1.5, 0.28) : 0;
      ang = lerp(ang, 0.3, slam);
      const px = 960, py = 280;
      // stand
      ctx.fillStyle = '#26262d'; ctx.beginPath(); ctx.moveTo(px - 30, py); ctx.lineTo(px + 30, py); ctx.lineTo(px + 70, 780); ctx.lineTo(px - 70, 780); ctx.fill();
      fillRR(ctx, px - 200, 770, 400, 26, 8, '#26262d');
      circle(ctx, px, py, 20, C.paperDim);
      text(ctx, '目的', px, py - 50, { family: F.jpHeavy, size: 40, weight: 900, color: C.mute2, align: 'center' });
      // beam
      const L = 520;
      const lx = px - Math.cos(ang) * L, ly = py - Math.sin(ang) * L;
      const rx = px + Math.cos(ang) * L, ry = py + Math.sin(ang) * L;
      ctx.save(); ctx.lineCap = 'round'; line(ctx, lx, ly, rx, ry, C.paperDim, 14); ctx.restore();
      const pan = (x, y, col) => {
        line(ctx, x, y, x - 130, y + 210, rgba(C.paper, 0.5), 2); line(ctx, x, y, x + 130, y + 210, rgba(C.paper, 0.5), 2);
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 160, y + 210); ctx.lineTo(x + 160, y + 210); ctx.quadraticCurveTo(x, y + 290, x - 160, y + 210); ctx.fill();
      };
      pan(lx, ly, '#3a2a12'); pan(rx, ry, '#27330a');
      // left: 伝えること (single envelope)
      const lq = since(t, tL, 0.5, E.outBack);
      ctx.save(); ctx.translate(lx, ly + 170); ctx.scale(lq, lq);
      icon(ctx, 'mail-open', 0, -20, 110, { color: C.human, lw: 1.6 });
      ctx.restore();
      text(ctx, '伝えること', lx, ly + 340, { family: F.jpHeavy, size: 46, weight: 900, color: C.human, align: 'center', alpha: lq });
      // right: pile of lime cards + cursor
      for (let i = 0; i < pile; i++) {
        const r = hash(i * 7 + 1), r2 = hash(i * 13 + 5);
        const x = rx - 120 + r * 240, yb = ry + 200 - Math.floor(i / 7) * 20 - r2 * 6;
        const drop = clamp((t - (tR + i * (tTip - tR) / 34)) / 0.25);
        const yy = lerp(yb - 300, yb, E.outBounce(drop));
        ctx.save(); ctx.translate(x, yy); ctx.rotate((r - 0.5) * 0.8);
        fillRR(ctx, -26, -16, 52, 32, 4, i % 3 ? C.slop : '#9fc21f'); fillRR(ctx, -20, -10, 22, 14, 2, 'rgba(0,0,0,.25)');
        ctx.restore();
      }
      const rq = since(t, tR, 0.4);
      text(ctx, '量・クリック', rx, Math.min(ry + 340, 860), { family: F.jpHeavy, size: 46, weight: 900, color: C.slop, align: 'center', alpha: rq });
      if (slam > 0) {
        const q = since(t, tTip + 0.1, 0.4, E.outBack);
        text(ctx, 'slop化', rx + 250, ry + 120, { family: F.jpHeavy, size: 72, weight: 900, color: C.slop, align: 'center', each: popEach(q) });
      }
    },
  };

  // ------------------------------------------------ S14: essence — mass production, nobody responsible (3D empty chair)
  let S3, cam3, chair, spot, boxes, deskTex;
  const S14 = {
    id: 'S14', start: cue(15, '言い換える') - 0.2, trans: { type: 'dip', d: 0.6, color: '#000000' }, chapter: CH,
    look: (t) => ({ vign: 0.6, bloom: 0.35, bloomThresh: 0.55, grain: 0.06, contrast: 1.05 }),
    setup(eng) {
      S3 = new THREE.Scene();
      S3.fog = new THREE.FogExp2(0x07070a, 0.045);
      cam3 = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x16161b, roughness: 0.85 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S3.add(floor);
      // chair (realistic proportions: seat 0.48m)
      chair = new THREE.Group();
      const dark = new THREE.MeshStandardMaterial({ color: 0x1f1f24, roughness: 0.5, metalness: 0.2 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.3, metalness: 0.9 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.48), dark); seat.position.y = 0.48; seat.castShadow = true; chair.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.06), dark); back.position.set(0, 0.86, -0.22); back.rotation.x = -0.12; back.castShadow = true; chair.add(back);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36), metal); stem.position.y = 0.26; stem.castShadow = true; chair.add(stem);
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.3), metal); leg.position.set(Math.sin(a) * 0.15, 0.08, Math.cos(a) * 0.15); leg.rotation.y = a; leg.castShadow = true; chair.add(leg); const wh = new THREE.Mesh(new THREE.SphereGeometry(0.03), dark); wh.position.set(Math.sin(a) * 0.29, 0.03, Math.cos(a) * 0.29); chair.add(wh); }
      for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.34), dark); arm.position.set(sx * 0.27, 0.68, -0.02); chair.add(arm); const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), metal); post.position.set(sx * 0.27, 0.58, 0.06); chair.add(post); }
      chair.position.set(0.62, 0, -0.2); S3.add(chair);
      // desk with nameplate (top 0.74m)
      const deskMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.55 });
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.7), deskMat); desk.position.set(0, 0.74, 0.3); desk.castShadow = true; desk.receiveShadow = true; S3.add(desk);
      const modesty = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.5, 0.03), deskMat); modesty.position.set(0, 0.45, 0.62); modesty.castShadow = true; S3.add(modesty);
      for (const sx of [-0.7, 0.7]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.64), deskMat); l.position.set(sx, 0.36, 0.3); S3.add(l); }
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
      const c2 = cv.getContext('2d'); c2.fillStyle = '#d8d2c4'; c2.fillRect(0, 0, 512, 160); c2.fillStyle = '#1a1a1a'; c2.font = `900 92px ZenKaku, NotoSansJP`; c2.textAlign = 'center'; c2.fillText('責任者', 256, 116);
      deskTex = new THREE.CanvasTexture(cv); deskTex.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.02), [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshStandardMaterial(i === 4 ? { map: deskTex, roughness: 0.45 } : { color: 0x8a7a5a, metalness: 0.6, roughness: 0.4 })));
      plate.position.set(0, 0.82, 0.55); plate.rotation.x = -0.35; S3.add(plate);
      // spotlight
      spot = new THREE.SpotLight(0xfff1dc, 14, 12, 0.32, 0.55, 1.2);
      spot.position.set(0, 4.6, 0.1); spot.target.position.set(0, 0.5, 0.05); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005;
      S3.add(spot); S3.add(spot.target);
      // light cone (fake volumetric)
      const coneMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { col: { value: new THREE.Color(1, 0.93, 0.8) } },
        vertexShader: 'varying float vy; varying vec3 vN; varying vec3 vV; void main(){ vy = position.y; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 col; varying float vy; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 3.); float h = smoothstep(-2.3, 2.3, vy); gl_FragColor = vec4(col * f * (.015 + .05*h), 1.); }', side: THREE.DoubleSide });
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 1.55, 4.6, 48, 1, true), coneMat); cone.position.set(0, 2.3, 0.08); S3.add(cone);
      S3.add(new THREE.AmbientLight(0x404058, 0.25));
      // conveyor of boxes far behind (mass production)
      boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.28, 0.34), new THREE.MeshStandardMaterial({ color: 0x9fc21f, roughness: 0.6, emissive: 0x1a2403, emissiveIntensity: 0.4 }), 60);
      S3.add(boxes);
      const belt = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.7 })); belt.position.set(0, 0.45, -7.5); S3.add(belt);
      const rim = new THREE.PointLight(0xc6f432, 2.2, 10, 1.6); rim.position.set(0, 1.8, -6.5); S3.add(rim);
      const backL = new THREE.DirectionalLight(0x8899ff, 0.28); backL.position.set(-2, 2, -4); S3.add(backL);
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tQ = cs(16, '大量生産') - 0.2, tN = cs(16, '責任者') - 0.2;
      // boxes move right→left continuously
      const o = new THREE.Object3D();
      for (let i = 0; i < 60; i++) { const x = ((i * 1.2 - t * 1.6) % 72 + 72) % 72 - 36; o.position.set(x * 0.9, 0.69, -7.5); o.rotation.y = 0; o.updateMatrix(); boxes.setMatrixAt(i, o.matrix); }
      boxes.instanceMatrix.needsUpdate = true;
      chair.rotation.y = -0.75 + Math.sin(t * 0.35) * 0.04 + t * 0.02;
      const dolly = t / f.dur;
      cam3.position.set(lerp(0.5, 0.35, dolly), lerp(1.3, 1.2, dolly), lerp(4.6, 4.0, dolly));
      cam3.lookAt(-0.32, 0.62, 0.0);
      f.three(S3, cam3, { exposure: 1.0, clear: [0.02, 0.02, 0.028, 1] });
      { const g = ctx.createLinearGradient(0, 0, 900, 0); g.addColorStop(0, 'rgba(6,6,8,.78)'); g.addColorStop(1, 'rgba(6,6,8,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 900, 1080); }
      // typography
      const p0 = since(t, 0.1, 0.5);
      if (t < tQ - 0.3) {
        text(ctx, '本質は', 120, 300, { family: F.jpHeavy, size: 54, weight: 700, color: C.mute2, alpha: p0 });
        text(ctx, 'AIではない', 120, 420, { family: F.jpHeavy, size: 110, weight: 900, color: C.paper, each: riseEach(since(t, 0.5, 0.6, E.outExpo), 50, 0.3) });
      } else {
        const q1 = since(t, tQ, 0.5, E.outExpo), q2 = since(t, tN, 0.5, E.outExpo);
        text(ctx, '大量生産', 120, 300, { family: F.jpHeavy, size: 104, weight: 900, color: C.slop, each: riseEach(q1, 50, 0.3) });
        text(ctx, 'なのに', 128, 380, { family: F.jp, size: 44, weight: 500, color: C.mute2, alpha: q1 });
        text(ctx, '責任者がいない', 120, 490, { family: F.jpHeavy, size: 104, weight: 900, color: C.paper, each: riseEach(q2, 50, 0.3) });
        underline(ctx, 120, 516, measure(ctx, '責任者がいない', { family: F.jpHeavy, size: 104, weight: 900 }), since(t, tN + 0.5, 0.6), C.alert, 8);
      }
    },
  };

  return [S06, S08, S10, S12, S13, S14];
}

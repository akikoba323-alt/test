// Chapter 03 — AI news farms (2:17–2:52)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure, font } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, carrow, check } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag } from '../lib/hud.js';
import { atlas } from '../lib/thumbs.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

const LANGS = [
  ['أخبار', 'Arabic', 'NotoArabic'], ['新闻', 'Chinese', 'Noto Sans CJK SC'], ['Zprávy', 'Czech'], ['Nieuws', 'Dutch'], ['News', 'English'], ['Actualités', 'French'],
  ['Nachrichten', 'German'], ['Berita', 'Indonesian'], ['Notizie', 'Italian'], ['뉴스', 'Korean', 'Noto Sans CJK KR'], ['Notícias', 'Portuguese'], ['Новости', 'Russian'],
  ['Noticias', 'Spanish'], ['Balita', 'Tagalog'], ['ข่าว', 'Thai', 'NotoThai'], ['Haberler', 'Turkish'],
];
const PREFIX = ['Daily', 'Business', 'Global', 'Metro', 'City', 'Tech', 'Finance', 'Health', 'Local', 'World'];
const SUFFIX = ['News', 'Times', 'Today', 'Post', 'Wire', 'Hub', 'Report', 'Journal', 'Update', 'Insider'];
const HEAD = ['市場の最新動向：知っておくべき10のこと', '専門家が警告、今後の見通しとは', '地域経済に新たな動き', '話題の新サービス、その理由を徹底解説', '驚きの結果が明らかに', '今すぐ確認したい5つのポイント', '業界に激震、その背景を解説', '知らないと損する最新トレンド', '住民の間で話題に、その真相は', '最新ランキング発表：意外な結果', '今週の注目ニュースまとめ', '専門家が語る「これからの時代」'];

function miniSite(ctx, x, y, w, h, seed) {
  const r = rng(seed);
  const acc = ['#c62828', '#1d4ed8', '#0f766e', '#6d28d9', '#b45309', '#111827', '#be185d', '#15803d'][Math.floor(r() * 8)];
  ctx.fillStyle = '#f5f3ee'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = acc; ctx.fillRect(x, y, w, h * 0.18);
  ctx.fillStyle = '#1b1b1f'; ctx.fillRect(x + w * 0.08, y + h * 0.28, w * 0.84, h * 0.08);
  ctx.fillStyle = '#9d988c'; ctx.fillRect(x + w * 0.08, y + h * 0.44, w * 0.4, h * 0.38);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = '#c8c3b8'; ctx.fillRect(x + w * 0.54, y + h * (0.46 + i * 0.1), w * 0.38, h * 0.04); }
}

export function newsScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('03', 'ニュース', 'NEWS', cue(24, 'もっと') - 0.1);

  // ------------------------------------------------ S19: 3,749 AI content farm sites, 16 languages
  let siteAtlas;
  const COLS = 79, ROWS = 48, NS = 3749;
  const S19 = {
    id: 'S19', start: cue(24, 'もっと') - 0.1, trans: { type: 'glitch', d: 0.45 }, chapter: CH,
    source: 'NewsGuard AI Tracking Center (2026.06.23)', sourceAt: 1.4,
    look: { vign: 0.45, bloom: 0.25 },
    setup() { siteAtlas = atlas(64, 60, 42, 8, (ctx, x, y, w, h, i) => miniSite(ctx, x + 1, y + 1, w - 2, h - 2, i * 17 + 3)); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tNG = cs(25, 'NewsGuard') - 0.2, tN = cs(25, '三千七百') - 1.6, tL = cs(26, '十六') - 0.2;
      // opening: breaking-news bar
      const bq = since(t, 0, 0.4, E.outExpo) * (1 - since(t, tNG, 0.4));
      if (bq > 0) {
        ctx.save(); ctx.globalAlpha = bq;
        fillRR(ctx, 360 * bq + (1 - bq) * -800, 440, 1200, 150, 4, '#c62828');
        text(ctx, 'もっと露骨なのが', 400, 505, { family: F.jpHeavy, size: 44, weight: 700, color: '#fff' });
        text(ctx, 'ニュース', 400, 570, { family: F.jpHeavy, size: 64, weight: 900, color: '#fff' });
        fillRR(ctx, 1260, 470, 260, 90, 6, '#fff');
        text(ctx, 'NEWS', 1390, 538, { family: F.archivo, size: 58, color: '#c62828', align: 'center' });
        ctx.restore();
      }
      if (t > tNG - 0.3) {
        // mosaic of sites: they appear outward from one site (like an infection), camera pulls back
        const cw = 18, chh = 13, gw = COLS * cw, gh = ROWS * chh;
        const x0 = 1880 - gw, y0 = 540 - gh / 2 + 10;
        const fc = 30, fr = 20;
        const fx = x0 + fc * cw + cw / 2, fy = y0 + fr * chh + chh / 2;
        const tDone = tN + 1.5;
        const grow = clamp((t - tNG) / (tDone - tNG));
        const zoom = lerp(7, 1, E.inOutCubic(clamp((t - tNG - 0.5) / (tDone - tNG - 0.3))));
        const cxz = lerp(fx, x0 + gw / 2, E.inOutCubic(clamp((t - tNG - 0.5) / (tDone - tNG - 0.3))));
        const cyz = lerp(fy, y0 + gh / 2, E.inOutCubic(clamp((t - tNG - 0.5) / (tDone - tNG - 0.3))));
        const nShow = Math.floor(1 + (NS - 1) * Math.pow(grow, 2.2));
        ctx.save();
        const scx = lerp(1100, x0 + gw / 2, E.inOutCubic(clamp((t - tNG - 0.5) / (tDone - tNG - 0.3))));
        ctx.translate(scx, 540); ctx.scale(zoom, zoom); ctx.translate(-cxz, -cyz);
        if (!siteAtlas.rank) {
          const arr = [];
          for (let k = 0; k < NS; k++) { const c = k % COLS, r = Math.floor(k / COLS); arr.push([Math.hypot(c - fc, (r - fr) * 1.4) + hash(k * 7 + 3) * 9, k]); }
          arr.sort((a, b) => a[0] - b[0]);
          siteAtlas.rank = new Int32Array(NS); arr.forEach(([, k], i) => { siteAtlas.rank[k] = i; });
        }
        for (let k = 0; k < NS; k++) {
          const c = k % COLS, r = Math.floor(k / COLS);
          const x = x0 + c * cw, y = y0 + r * chh;
          const rk = siteAtlas.rank[k];
          if (rk >= nShow) { ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(x, y, cw - 3, chh - 3); continue; }
          siteAtlas.draw(ctx, k % 64, x, y, cw - 3, chh - 3);
          const age = (nShow - rk) / 60;
          if (age < 1) { ctx.fillStyle = rgba(C.slop, 0.8 * (1 - age)); ctx.fillRect(x, y, cw - 3, chh - 3); }
        }
        ctx.restore();
        // labels on a dark side panel
        const q = since(t, tNG, 0.5);
        { const g = ctx.createLinearGradient(0, 0, 640, 0); g.addColorStop(0, 'rgba(11,11,13,.96)'); g.addColorStop(0.7, 'rgba(11,11,13,.85)'); g.addColorStop(1, 'rgba(11,11,13,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 640, 1080); }
        text(ctx, 'NewsGuardが確認した', 80, 340, { family: F.jp, size: 28, weight: 700, color: C.mute2, alpha: q });
        text(ctx, 'AIニュース・', 80, 392, { family: F.jpHeavy, size: 38, weight: 900, color: C.paper, alpha: q });
        text(ctx, '情報サイト', 80, 440, { family: F.jpHeavy, size: 38, weight: 900, color: C.paper, alpha: q });
        text(ctx, '人間の監督がほぼない', 80, 486, { family: F.jp, size: 24, weight: 700, color: C.alert, alpha: q });
        odometer(ctx, nShow, 80, 640, { family: F.bebas, size: 130, color: C.slop });
        text(ctx, 'サイト', 84, 700, { family: F.jpHeavy, size: 40, weight: 900, color: C.slop, alpha: since(t, tDone, 0.4) });
        ctx.save(); ctx.fillStyle = 'rgba(11,11,13,.0)'; ctx.restore();
      }
      // 16 languages ring
      if (t > tL - 0.2) {
        const q = since(t, tL, 0.5);
        ctx.save(); ctx.fillStyle = rgba(C.ink, 0.72 * q); ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
        text(ctx, '16', 960, 600, { family: F.bebas, size: 300, color: C.paper, align: 'center', each: popEach(q, 0.3) });
        text(ctx, '言語', 960, 690, { family: F.jpHeavy, size: 64, weight: 900, color: C.paper, align: 'center', alpha: q });
        LANGS.forEach(([w, en, fam], i) => {
          const a = (i / 16) * Math.PI * 2 - Math.PI / 2 + t * 0.12;
          const R = 390, x = 960 + Math.cos(a) * R * 1.35, y = 520 + Math.sin(a) * R * 0.9;
          const li = since(t, tL + 0.05 + i * 0.04, 0.3, E.outBack);
          text(ctx, w, x, y, { family: fam || F.sans, size: 38, weight: 700, color: i % 4 === 0 ? C.slop : C.paper, align: 'center', alpha: li, fallback: 'NotoSansJP' });
          text(ctx, en.toUpperCase(), x, y + 28, { family: F.mono, size: 13, color: C.mute, align: 'center', alpha: li * 0.8 });
        });
      }
    },
  };

  // ------------------------------------------------ S20: generic names + articles spewed out
  const S20 = {
    id: 'S20', start: cue(27, '名前は') - 0.2, trans: { type: 'whip', d: 0.4, dir: [0, -1] }, chapter: CH,
    look: { vign: 0.45, bloom: 0.25 },
    mblur: (t) => ({ n: 3, shutter: 0.5 }),
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tB = cs(28, 'Business') - 0.8, tD = cs(28, 'Daily') - 0.7, tLocal = cs(28, '一見') - 0.2, tSpew = cs(28, 'AIが一日') - 0.3;
      grid(ctx, 60, 'rgba(255,255,255,0.03)');
      const phaseSpew = since(t, tSpew, 0.6, E.inOutCubic);
      // ---- slot machine
      const mx = 960 - phaseSpew * 480, my = 330;
      ctx.save(); ctx.translate(mx, my); ctx.scale(1 - phaseSpew * 0.35, 1 - phaseSpew * 0.35);
      fillRR(ctx, -560, -150, 1120, 300, 26, '#17171c'); strokeRR(ctx, -560, -150, 1120, 300, 26, rgba(C.paper, 0.2), 2);
      text(ctx, 'NEWS SITE NAME GENERATOR', 0, -104, { family: F.mono, size: 20, weight: 700, color: C.mute, align: 'center', ls: 4 });
      const reel = (x, w, list, stopT, target, spinFrom, redacted) => {
        ctx.save(); rr(ctx, x - w / 2, -70, w, 150, 12); ctx.fillStyle = '#f3f0e8'; ctx.fill(); ctx.clip();
        const lh = 90;
        let pos;
        if (t < spinFrom) pos = target;
        else if (t < stopT) pos = target + (stopT - t) * 14 + 0.0;
        else pos = target - Math.sin(Math.min(1, (t - stopT) / 0.3) * Math.PI) * 0.12;
        const base = Math.floor(pos), frac = pos - base;
        for (let k = -2; k <= 2; k++) {
          const idx = ((base + k) % list.length + list.length) % list.length;
          const yy = 30 + (k - frac) * lh;
          if (redacted) { fillRR(ctx, x - w / 2 + 30, yy - 50, w - 60, 56, 4, '#111'); }
          else text(ctx, list[idx], x, yy, { family: F.archivo, size: 54, color: '#111', align: 'center' });
        }
        const g = ctx.createLinearGradient(0, -70, 0, 80); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(0.3, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
        ctx.fillStyle = g; ctx.fillRect(x - w / 2, -70, w, 150);
        ctx.restore();
      };
      const second = t > tD - 0.4;
      reel(-330, 400, PREFIX, second ? tD : tB, second ? 0 : 1, second ? tD - 0.9 : 0, false);
      reel(80, 360, PREFIX, second ? tD + 0.25 : tB + 0.25, 3, second ? tD - 0.9 : 0, true);
      reel(420, 260, SUFFIX, second ? tD + 0.5 : tB + 0.5, second ? 2 : 4, second ? tD - 0.9 : 0, false);
      ctx.restore();
      text(ctx, '※ 実在サイト名は伏せています', mx + 540 * (1 - phaseSpew * 0.35), my + 190, { family: F.jp, size: 20, color: C.mute, align: 'right', alpha: 1 - phaseSpew });
      // ---- mastheads (local news / trade media look)
      const mq = since(t, tLocal, 0.5, E.outBack) * (1 - phaseSpew);
      if (mq > 0) {
        [['Daily', '地域ニュース風', '#1d4ed8'], ['Business', '業界メディア風', '#0f766e']].forEach(([p, lab, colr], i) => {
          const x = 560 + i * 800, y = 720;
          ctx.save(); ctx.translate(x, y); ctx.scale(mq, mq);
          fillRR(ctx, -330, -110, 660, 220, 10, '#f7f4ec');
          ctx.fillStyle = colr; ctx.fillRect(-330, -110, 660, 16);
          text(ctx, p, -250, -20, { family: F.playfair, size: 60, weight: 900, color: '#111' });
          const pw = measure(ctx, p, { family: F.playfair, size: 60, weight: 900 });
          fillRR(ctx, -240 + pw, -66, 200, 56, 4, '#111');
          ctx.fillStyle = '#bbb'; for (let k = 0; k < 3; k++) ctx.fillRect(-290, 20 + k * 22, 580 - k * 90, 9);
          ctx.restore();
          text(ctx, lab, x, y + 150, { family: F.jpHeavy, size: 30, weight: 700, color: C.mute2, align: 'center', alpha: mq });
        });
      }
      // ---- article printer
      if (phaseSpew > 0) {
        const px = 1180, pw = 620;
        ctx.save(); ctx.globalAlpha = phaseSpew;
        fillRR(ctx, px - 20, 130, pw + 40, 70, 12, '#26262d');
        text(ctx, 'AI 自動生成エンジン', px, 176, { family: F.jpHeavy, size: 26, weight: 700, color: C.slop });
        circle(ctx, px + pw - 10, 165, 8, flick(t, 6) > 0.5 ? C.slop : '#2a3a0a');
        ctx.beginPath(); ctx.rect(px - 10, 200, pw + 20, 690); ctx.clip();
        const tt = Math.max(0, t - tSpew);
        const off = 8 * 118 + tt * 260 + tt * tt * 140;
        const card = 118;
        const nCards = 8;
        const first = Math.floor(off / card);
        for (let k = first - nCards; k <= first; k++) {
          if (k < 0) continue;
          const y = 200 + (off - k * card) - card;
          const h = HEAD[k % HEAD.length];
          const hh = 6 + Math.floor(k * 7 / 60);
          const mm = (2 + k * 7) % 60;
          fillRR(ctx, px, y + 8, pw, card - 14, 8, '#f3f0e8');
          text(ctx, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, px + 18, y + 42, { family: F.mono, size: 20, weight: 700, color: '#c62828' });
          text(ctx, h, px + 100, y + 44, { family: F.jpHeavy, size: 26, weight: 700, color: '#111' });
          ctx.fillStyle = '#c9c4b8'; ctx.fillRect(px + 100, y + 62, pw - 140, 7); ctx.fillRect(px + 100, y + 78, pw - 240, 7);
          fillRR(ctx, px + pw - 70, y + 20, 50, 22, 4, C.slop); text(ctx, 'AI', px + pw - 45, y + 37, { family: F.grotesk, size: 14, weight: 700, color: C.ink, align: 'center' });
        }
        ctx.restore();
        const count = Math.floor(8 + off / 118);
        text(ctx, '本日の記事', 330, 700, { family: F.jpHeavy, size: 40, weight: 700, color: C.mute2, alpha: phaseSpew });
        odometer(ctx, count, 330, 850, { family: F.bebas, size: 170, color: C.slop });
        text(ctx, '本', 330 + measure(ctx, String(count), { family: F.bebas, size: 170 }) + 20, 850, { family: F.jpHeavy, size: 60, weight: 900, color: C.slop, alpha: phaseSpew });
      }
    },
  };

  // ------------------------------------------------ S21: ad economy loop
  const S21 = {
    id: 'S21', start: cue(29, 'ページには') - 0.2, trans: { type: 'wipe', d: 0.55, dir: [0, 1], color: '#c6f432' }, chapter: CH,
    look: { vign: 0.4, bloom: 0.28 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tAd = cs(29, '広告'), tRead = cs(30, '読む') - 0.5, tPay = cs(31, '広告費') - 0.2, tThin = cs(32, '薄くても') - 0.4, tFree = cs(32, 'ほぼタダ') - 0.3;
      grid(ctx, 60, 'rgba(255,255,255,0.03)');
      const cx = 700, cy = 480, R = 260;
      const nodes = [
        { a: -Math.PI / 2, lab: 'AI記事', ic: 'file-text', col: C.slop, t: -0.1 },
        { a: 0, lab: '広告が載る', ic: 'badge-dollar-sign', col: '#ffd24a', t: tAd - 0.1 },
        { a: Math.PI / 2, lab: '誰かが読む', ic: 'eye', col: C.paper, t: tRead },
        { a: Math.PI, lab: '広告費が入る', ic: 'coins', col: C.human, t: tPay },
      ];
      // ring arrows
      for (let i = 0; i < 4; i++) {
        const n = nodes[i], m = nodes[(i + 1) % 4];
        const q = since(t, m.t - 0.2, 0.4);
        if (q <= 0) continue;
        const a0 = n.a + 0.35, a1 = m.a - 0.35 + (i === 3 ? Math.PI * 2 : 0);
        ctx.save(); ctx.strokeStyle = rgba(C.paper, 0.5); ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + (a1 - a0) * q); ctx.stroke(); ctx.restore();
        if (q >= 1) { const ah = a1; const hx = cx + Math.cos(ah) * R, hy = cy + Math.sin(ah) * R; arrow(ctx, hx - Math.cos(ah + Math.PI / 2) * 20, hy - Math.sin(ah + Math.PI / 2) * 20, hx, hy, { color: rgba(C.paper, 0.8), lw: 4, head: 20 }); }
      }
      // flowing dots along the loop once closed
      if (t > tPay + 0.3) {
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + ((t - tPay) * 1.3 + k / 10) * Math.PI * 2; circle(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 6, k % 2 ? '#ffd24a' : C.slop); }
      }
      nodes.forEach((n, i) => {
        const q = since(t, n.t, 0.45, E.outBack);
        if (q <= 0) return;
        const x = cx + Math.cos(n.a) * R, y = cy + Math.sin(n.a) * R;
        const thin = i === 0 ? since(t, tThin, 0.8) : 0;
        ctx.save(); ctx.translate(x, y); ctx.scale(q, q);
        ctx.globalAlpha = 1 - thin * 0.75;
        circle(ctx, 0, 0, 86, '#16161b', n.col, 3);
        icon(ctx, n.ic, 0, -6, 64, { color: n.col, lw: 1.8 });
        ctx.restore();
        const ly = y + (i === 2 ? 130 : i === 0 ? -115 : 125);
        text(ctx, n.lab, x, ly, { family: F.jpHeavy, size: 34, weight: 900, color: n.col, align: 'center', alpha: q * (1 - thin * 0.6) });
        if (i === 0 && thin > 0) text(ctx, '内容が薄くても', x, y - 160, { family: F.jp, size: 26, weight: 500, color: C.mute2, align: 'center', alpha: thin });
      });
      // equation
      const eq = since(t, tFree - 0.6, 0.5, E.outExpo);
      if (eq > 0) {
        const x0 = 1170, y0 = 300;
        ctx.save(); ctx.globalAlpha = eq;
        text(ctx, '1本あたりの損益', x0, y0, { family: F.jp, size: 30, weight: 700, color: C.mute2 });
        const rowsE = [['広告収入', '+ ¥ わずか', C.human], ['生成コスト', '− ¥ ≈0', C.slop]];
        rowsE.forEach(([k, v, col], i) => {
          const y = y0 + 90 + i * 80;
          text(ctx, k, x0, y, { family: F.jpHeavy, size: 40, weight: 700, color: C.paper });
          text(ctx, v, x0 + 560, y, { family: F.jpHeavy, size: 40, weight: 900, color: col, align: 'right' });
        });
        line(ctx, x0, y0 + 230, x0 + 560, y0 + 230, C.paper, 3, eq);
        const fq = since(t, tFree + 0.3, 0.5, E.outBack);
        text(ctx, '＝ 成立', x0 + 560, y0 + 320, { family: F.jpHeavy, size: 84, weight: 900, color: C.slop, align: 'right', each: popEach(fq, 0.3) });
        check(ctx, x0 + 40, y0 + 290, 70, since(t, tFree + 0.5, 0.4), C.slop, 10);
        ctx.restore();
      }
    },
  };

  return [S19, S20, S21];
}

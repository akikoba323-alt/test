// Procedural "content" imagery: video thumbnails, web pages, photos, posts, book covers, album art.
// Everything is fictional and generic; atlases are rendered once and reused.
import { rng } from '../engine/rng.js';
import { noise } from '../engine/noise.js';
import { C, F, fs } from '../engine/theme.js';
import { rr, fillRR, circle, star } from './draw.js';

const BAIT = ['衝撃', '神回', '閲覧注意', 'ヤバすぎ', '号泣', '99%が知らない', '実話', 'まさか…', 'TOP10', '最強', '激変', '禁断', '真相', '感動', 'ガチ', '1億円', '!?', '絶句', '奇跡', '泣ける', '人生逆転', '最後に…', '知らないと損', '限界'];
const SAT = [['#ff2e2e', '#ffd000'], ['#0057ff', '#00e0ff'], ['#8a00ff', '#ff00a8'], ['#00b85c', '#d4ff00'], ['#ff6a00', '#ffe600'], ['#111', '#ff2e2e'], ['#0b1a4a', '#3b82f6'], ['#2a0033', '#ff4fd8'], ['#003d33', '#1de9b6'], ['#1a1a1a', '#ffd000']];

function outlined(ctx, s, x, y, size, fill = '#fff', stroke = '#000', family = F.dela, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `${size}px ${fs(family)}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.22; ctx.strokeStyle = stroke; ctx.strokeText(s, 0, 0);
  ctx.fillStyle = fill; ctx.fillText(s, 0, 0);
  ctx.restore();
}
function face(ctx, x, y, r, r0, mood = 'shock') {
  const skin = r0.pick(['#f2c9a0', '#e0a878', '#c68642', '#ffdbac', '#8d5524']);
  circle(ctx, x, y, r, skin);
  ctx.fillStyle = '#1a1a1a';
  circle(ctx, x - r * 0.35, y - r * 0.15, r * 0.13, '#fff'); circle(ctx, x + r * 0.35, y - r * 0.15, r * 0.13, '#fff');
  circle(ctx, x - r * 0.35, y - r * 0.13, r * 0.07, '#111'); circle(ctx, x + r * 0.35, y - r * 0.13, r * 0.07, '#111');
  if (mood === 'shock') { ctx.beginPath(); ctx.ellipse(x, y + r * 0.38, r * 0.16, r * 0.22, 0, 0, Math.PI * 2); ctx.fillStyle = '#5a1010'; ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(x, y + r * 0.2, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = r * 0.08; ctx.strokeStyle = '#5a1010'; ctx.stroke(); }
  // hair
  ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = r * 0.35; ctx.strokeStyle = r0.pick(['#2b1b0e', '#111', '#6b3d1f', '#d9b36c']); ctx.stroke();
}
function cat(ctx, x, y, r, col, tear = false) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 0.3); ctx.lineTo(x - r * 0.7, y - r * 1.25); ctx.lineTo(x - r * 0.2, y - r * 0.8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + r * 0.9, y - r * 0.3); ctx.lineTo(x + r * 0.7, y - r * 1.25); ctx.lineTo(x + r * 0.2, y - r * 0.8); ctx.fill();
  circle(ctx, x, y, r, col);
  circle(ctx, x - r * 0.38, y - r * 0.05, r * 0.26, '#fff'); circle(ctx, x + r * 0.38, y - r * 0.05, r * 0.26, '#fff');
  circle(ctx, x - r * 0.36, y, r * 0.18, '#1a2a3a'); circle(ctx, x + r * 0.36, y, r * 0.18, '#1a2a3a');
  circle(ctx, x - r * 0.3, y - r * 0.08, r * 0.06, '#fff'); circle(ctx, x + r * 0.42, y - r * 0.08, r * 0.06, '#fff');
  ctx.fillStyle = '#f48fb1'; ctx.beginPath(); ctx.moveTo(x - r * 0.08, y + r * 0.28); ctx.lineTo(x + r * 0.08, y + r * 0.28); ctx.lineTo(x, y + r * 0.38); ctx.fill();
  if (tear) { ctx.fillStyle = 'rgba(140,210,255,.95)'; ctx.beginPath(); ctx.ellipse(x - r * 0.42, y + r * 0.42, r * 0.07, r * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + r * 0.46, y + r * 0.5, r * 0.06, r * 0.13, 0, 0, Math.PI * 2); ctx.fill(); }
}
function burst(ctx, x, y, R, n, c1, c2) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.5) / n) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? c1 : c2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R); ctx.lineTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R); ctx.fill();
  }
}

// ---------- video thumbnail
export function videoThumb(ctx, x, y, w, h, seed, style = 'bait') {
  const r = rng(seed * 7 + 3);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x, y); ctx.scale(w / 320, h / 180);
  const [c1, c2] = r.pick(SAT);
  const g = ctx.createLinearGradient(0, 0, 320, 180); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 180);
  const kind = style === 'slop' ? r.pick(['cat', 'elder', 'rescue', 'gold']) : r.pick(['face', 'face', 'cat', 'money', 'planet', 'house', 'elder']);
  if (r() < 0.5) { ctx.globalAlpha = 0.22; burst(ctx, 230, 90, 400, 24, '#fff', 'rgba(255,255,255,0)'); ctx.globalAlpha = 1; }
  if (kind === 'face') face(ctx, 235, 100, 58, r);
  else if (kind === 'cat') cat(ctx, 225, 105, 52, r.pick(['#f5a623', '#ddd', '#555', '#fff', '#c47a3a']), style === 'slop' || r() < 0.4);
  else if (kind === 'money') { for (let k = 0; k < 6; k++) { fillRR(ctx, 175 + k * 6, 60 + k * 14, 110, 44, 5, '#1f8f3a'); ctx.strokeStyle = '#9fe8a8'; ctx.lineWidth = 2; ctx.strokeRect(181 + k * 6, 66 + k * 14, 98, 32); } outlined(ctx, '$', 285, 60, 48, '#ffe600', '#000', F.archivo); }
  else if (kind === 'planet') { circle(ctx, 230, 95, 62, '#3b6ea5'); ctx.globalAlpha = 0.6; circle(ctx, 212, 80, 22, '#7fb3e8'); ctx.globalAlpha = 1; ctx.strokeStyle = '#ffd27f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(230, 95, 100, 22, -0.3, 0, Math.PI * 2); ctx.stroke(); }
  else if (kind === 'house') { ctx.fillStyle = '#fff4e0'; ctx.fillRect(185, 85, 100, 70); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(175, 88); ctx.lineTo(235, 40); ctx.lineTo(295, 88); ctx.fill(); ctx.fillStyle = '#4a90d9'; ctx.fillRect(200, 100, 24, 22); ctx.fillRect(248, 100, 24, 22); }
  else if (kind === 'elder') {
    const gg = ctx.createRadialGradient(240, 70, 10, 240, 70, 200); gg.addColorStop(0, '#ffe7a8'); gg.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = gg; ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#3a2a1a'; circle(ctx, 238, 78, 30, '#3a2a1a'); ctx.beginPath(); ctx.moveTo(190, 180); ctx.quadraticCurveTo(238, 90, 286, 180); ctx.fill();
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(238, 70, 32, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  } else if (kind === 'rescue') {
    ctx.fillStyle = '#0b3d5c'; ctx.fillRect(0, 100, 320, 80);
    ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.moveTo(60, 180); ctx.quadraticCurveTo(120, 10, 250, 60); ctx.quadraticCurveTo(160, 70, 200, 180); ctx.fill();
    ctx.fillStyle = '#ff5722'; ctx.fillRect(150, 118, 34, 14); circle(ctx, 167, 112, 7, '#ffcc80');
  } else if (kind === 'gold') { const gg = ctx.createRadialGradient(230, 90, 5, 230, 90, 120); gg.addColorStop(0, '#fff8d0'); gg.addColorStop(0.4, '#ffc93c'); gg.addColorStop(1, 'rgba(120,60,0,0)'); ctx.fillStyle = gg; ctx.fillRect(0, 0, 320, 180); cat(ctx, 230, 100, 44, '#fff', true); }
  // red arrow / ring
  if (r() < 0.6) { ctx.strokeStyle = '#ff1a1a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(235, 100, 70, 60, 0, 0, Math.PI * 2); ctx.stroke(); }
  if (r() < 0.5) { ctx.save(); ctx.translate(150, 130); ctx.rotate(-0.5); ctx.fillStyle = '#ff1a1a'; ctx.fillRect(-30, -8, 44, 16); ctx.beginPath(); ctx.moveTo(14, -20); ctx.lineTo(40, 0); ctx.lineTo(14, 20); ctx.fill(); ctx.restore(); }
  const bait = r.pick(BAIT);
  const size = bait.length > 5 ? 30 : bait.length > 3 ? 40 : 54;
  outlined(ctx, bait, 90, 60, size, r.pick(['#fff', '#ffe600', '#fff', '#ff2e2e']), '#000', r.pick([F.dela, F.jpHeavy]), -0.06);
  if (r() < 0.7) outlined(ctx, r.pick(['【実話】', '【検証】', '【完全版】', '【保存版】', '【速報】', '【総集編】']), 88, 118, 22, '#fff', '#c00', F.jpHeavy);
  // duration badge
  const dur = `${r.int(1, 59)}:${String(r.int(0, 59)).padStart(2, '0')}`;
  fillRR(ctx, 262, 152, 52, 22, 4, 'rgba(0,0,0,.85)');
  ctx.font = `600 15px ${fs(F.sans)}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(dur, 288, 163);
  ctx.restore();
}

// ---------- web page card (screenshot-like, gray-bar text)
export function webCard(ctx, x, y, w, h, seed, o = {}) {
  const r = rng(seed * 13 + 1);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x, y); ctx.scale(w / 320, h / 200);
  const dark = o.dark ?? r() < 0.25;
  const bg = dark ? '#16161b' : '#f7f5f0', fg = dark ? '#3a3a44' : '#d6d2c8', fg2 = dark ? '#55555f' : '#b9b4a8';
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 320, 200);
  const accent = r.pick(['#d62828', '#1d4ed8', '#0f766e', '#7c3aed', '#ea580c', '#111827', '#be185d']);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 320, 22);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(10, 8, 50 + r() * 30, 6);
  for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(180 + k * 34, 9, 24, 4); }
  const layout = r.int(0, 2);
  const tl = (yy, n, ww = 300, col = fg) => { for (let i = 0; i < n; i++) { ctx.fillStyle = col; ctx.fillRect(10, yy + i * 9, (i === n - 1 ? 0.6 : 1) * (ww - r() * 30), 4); } };
  if (layout === 0) {
    ctx.fillStyle = dark ? '#e8e8ee' : '#1b1b1f'; ctx.fillRect(10, 32, 250, 9); ctx.fillRect(10, 45, 180, 9);
    const g = ctx.createLinearGradient(0, 62, 320, 132); const [a, b] = r.pick(SAT); g.addColorStop(0, a); g.addColorStop(1, b);
    ctx.globalAlpha = 0.85; ctx.fillStyle = g; ctx.fillRect(10, 62, 300, 70); ctx.globalAlpha = 1;
    tl(142, 5);
  } else if (layout === 1) {
    const g = ctx.createLinearGradient(0, 30, 140, 120); const [a, b] = r.pick(SAT); g.addColorStop(0, a); g.addColorStop(1, b);
    ctx.fillStyle = g; ctx.fillRect(10, 30, 130, 90);
    ctx.fillStyle = dark ? '#e8e8ee' : '#1b1b1f'; ctx.fillRect(150, 32, 160, 8); ctx.fillRect(150, 44, 120, 8);
    for (let i = 0; i < 7; i++) { ctx.fillStyle = fg; ctx.fillRect(150, 62 + i * 8, 150 - r() * 30, 3); }
    tl(130, 6);
  } else {
    ctx.fillStyle = dark ? '#e8e8ee' : '#1b1b1f'; ctx.fillRect(10, 34, 270, 10); ctx.fillRect(10, 48, 220, 10);
    tl(70, 11, 300, fg);
    if (o.ads !== false) { fillRR(ctx, 200, 150, 110, 42, 4, '#ffe16b'); ctx.fillStyle = '#7a5b00'; ctx.font = `700 11px ${fs(F.sans)}`; ctx.fillText('AD', 208, 165); }
  }
  if (o.ads !== false && r() < 0.6) { ctx.fillStyle = dark ? '#2a2a33' : '#ecebe5'; ctx.fillRect(0, 186, 320, 14); ctx.fillStyle = fg2; ctx.font = `700 8px ${fs(F.sans)}`; ctx.fillText('SPONSORED', 6, 196); }
  ctx.restore();
}

// ---------- "photo": procedural landscape rendered naturally (used as believable real photos)
export function photo(ctx, x, y, w, h, seed, o = {}) {
  const r = rng(seed * 31 + 5);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x, y);
  const mood = o.mood || r.pick(['dusk', 'day', 'dawn', 'night', 'overcast']);
  const skies = { dusk: ['#1c2a4a', '#e0765a', '#ffcf8a'], day: ['#3d7cc9', '#8fc1ea', '#dcecf7'], dawn: ['#28304f', '#b48bb0', '#ffd7b8'], night: ['#05070f', '#101a33', '#26324f'], overcast: ['#8c939c', '#b6bcc3', '#d7dadd'] };
  const [s0, s1, s2] = skies[mood];
  const hz = h * (0.52 + r() * 0.12);
  const g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, s0); g.addColorStop(0.7, s1); g.addColorStop(1, s2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz + 2);
  if (mood !== 'overcast') { const sx = w * (0.2 + r() * 0.6), sy = hz * (0.55 + r() * 0.35); const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.25); sg.addColorStop(0, mood === 'night' ? 'rgba(230,235,255,.9)' : 'rgba(255,250,230,1)'); sg.addColorStop(0.08, mood === 'night' ? 'rgba(200,210,255,.3)' : 'rgba(255,220,160,.6)'); sg.addColorStop(1, 'rgba(255,200,150,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, w, hz); }
  if (mood === 'night') { for (let k = 0; k < 120; k++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.8})`; ctx.fillRect(r() * w, r() * hz * 0.8, 1.2, 1.2); } }
  // clouds
  ctx.globalAlpha = mood === 'overcast' ? 0.5 : 0.28;
  for (let k = 0; k < 7; k++) { const cx = r() * w, cy = r() * hz * 0.7, cw = w * (0.1 + r() * 0.25); ctx.fillStyle = mood === 'night' ? '#2a3350' : '#fff'; ctx.beginPath(); ctx.ellipse(cx, cy, cw, cw * 0.18, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  // mountains layers
  const layers = 3;
  for (let L = 0; L < layers; L++) {
    const base = hz - h * 0.02 * (layers - L);
    const col = ['#5a6b86', '#3c4a61', '#232c3b'][L];
    ctx.fillStyle = mood === 'day' ? ['#7d94ad', '#56708a', '#35495c'][L] : mood === 'overcast' ? ['#8d949b', '#6f767e', '#50565d'][L] : col;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let xx = 0; xx <= w; xx += 4) { const n = noise.fbm2(xx / (w * 0.35) + seed * 3 + L * 10, L * 7.1, 4); ctx.lineTo(xx, base - (n * 0.5 + 0.35) * h * (0.14 + L * 0.03)); }
    ctx.lineTo(w, h); ctx.fill();
  }
  // water or field
  if (r() < 0.55) {
    const wg = ctx.createLinearGradient(0, hz, 0, h); wg.addColorStop(0, s2); wg.addColorStop(1, s0);
    ctx.fillStyle = wg; ctx.fillRect(0, hz, w, h - hz);
    ctx.globalAlpha = 0.25; for (let k = 0; k < 60; k++) { ctx.fillStyle = '#fff'; ctx.fillRect(r() * w, hz + r() * (h - hz), 10 + r() * 40, 1); } ctx.globalAlpha = 1;
  } else {
    const fg2 = ctx.createLinearGradient(0, hz, 0, h); fg2.addColorStop(0, mood === 'day' ? '#4f7a3a' : '#2a3326'); fg2.addColorStop(1, '#101510');
    ctx.fillStyle = fg2; ctx.fillRect(0, hz, w, h - hz);
    // trees
    for (let k = 0; k < 14; k++) { const tx = r() * w, th = h * (0.06 + r() * 0.12); ctx.fillStyle = '#0d120d'; ctx.beginPath(); ctx.moveTo(tx, hz + 4 - th); ctx.lineTo(tx - th * 0.25, hz + 6); ctx.lineTo(tx + th * 0.25, hz + 6); ctx.fill(); }
  }
  // lens: slight vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ---------- social post card
export function postCard(ctx, x, y, w, h, seed, o = {}) {
  const r = rng(seed * 17 + 9);
  ctx.save(); ctx.translate(x, y); ctx.scale(w / 320, h / 160);
  fillRR(ctx, 0, 0, 320, 160, 12, o.dark ? '#1a1a20' : '#ffffff');
  const [a, b] = r.pick(SAT); const g = ctx.createLinearGradient(12, 12, 48, 48); g.addColorStop(0, a); g.addColorStop(1, b);
  circle(ctx, 30, 30, 18, g);
  ctx.fillStyle = o.dark ? '#e6e6ea' : '#1b1b1f'; ctx.fillRect(56, 18, 70 + r() * 40, 8);
  ctx.fillStyle = o.dark ? '#555' : '#aaa'; ctx.fillRect(56, 32, 50, 6);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = o.dark ? '#44444c' : '#cfcfd4'; ctx.fillRect(16, 62 + i * 14, (i === 3 ? 150 : 280) - r() * 30, 7); }
  ctx.fillStyle = o.dark ? '#666' : '#999';
  for (let k = 0; k < 4; k++) { circle(ctx, 30 + k * 70, 140, 6, null, o.dark ? '#666' : '#999', 2); ctx.fillRect(42 + k * 70, 137, 18, 5); }
  ctx.restore();
}

// ---------- book cover (template-driven, used for "mass-produced" books)
const THEMES = {
  dog: { t: '犬のしつけ', sub: '完全ガイド', cols: ['#f6c945', '#2d6a4f', '#fef6e4'], motif: 'paw' },
  hokkaido: { t: '北海道旅行', sub: '絶景ベスト100', cols: ['#4ea8de', '#fefae0', '#1d3557'], motif: 'mount' },
  invest: { t: '初心者向け投資', sub: 'ゼロから資産1億', cols: ['#1b4332', '#d4af37', '#f1faee'], motif: 'chart' },
  mushroom: { t: 'キノコ採集', sub: '見分け方ハンドブック', cols: ['#7f5539', '#ede0d4', '#b5651d'], motif: 'mushroom' },
};
export function bookCover(ctx, x, y, w, h, seed, theme = 'dog', o = {}) {
  const r = rng(seed * 23 + 7);
  const T = THEMES[theme] || THEMES.dog;
  ctx.save(); ctx.translate(x, y); ctx.scale(w / 200, h / 300);
  const [c1, c2, c3] = T.cols;
  const v = o.variant ?? r.int(0, 2);
  ctx.fillStyle = v === 1 ? c2 : c1; ctx.fillRect(0, 0, 200, 300);
  ctx.fillStyle = v === 1 ? c1 : c2; ctx.fillRect(0, 200 - v * 20, 200, 100 + v * 20);
  // motif
  ctx.save(); ctx.translate(100, 150 - v * 12);
  ctx.fillStyle = c3; ctx.strokeStyle = c3; ctx.lineWidth = 6;
  if (T.motif === 'paw') { circle(ctx, 0, 10, 26, c3); for (let k = 0; k < 4; k++) circle(ctx, -30 + k * 20, -24 - (k === 1 || k === 2 ? 8 : 0), 10, c3); }
  else if (T.motif === 'mount') { ctx.beginPath(); ctx.moveTo(-60, 30); ctx.lineTo(-10, -40); ctx.lineTo(20, 0); ctx.lineTo(35, -20); ctx.lineTo(70, 30); ctx.fill(); }
  else if (T.motif === 'chart') { ctx.beginPath(); ctx.moveTo(-60, 30); ctx.lineTo(-25, 5); ctx.lineTo(5, 15); ctx.lineTo(55, -35); ctx.stroke(); ctx.beginPath(); ctx.moveTo(55, -35); ctx.lineTo(40, -33); ctx.lineTo(53, -20); ctx.fill(); }
  else if (T.motif === 'mushroom') { ctx.beginPath(); ctx.ellipse(0, -8, 50, 32, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-12, -8, 24, 44); ctx.fillStyle = v === 1 ? c1 : c2; circle(ctx, -20, -22, 6, ctx.fillStyle); circle(ctx, 14, -28, 5, ctx.fillStyle); }
  ctx.restore();
  // title
  ctx.fillStyle = v === 1 ? c3 : c2;
  ctx.font = `900 ${T.t.length > 5 ? 26 : 32}px ${fs(F.jpHeavy)}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(T.t, 100, 62);
  ctx.font = `700 14px ${fs(F.jp)}`; ctx.fillText(T.sub, 100, 86);
  ctx.fillStyle = v === 1 ? c2 : c3; ctx.font = `600 12px ${fs(F.jp)}`;
  ctx.fillText(o.author || r.pick(['山田 太郎', 'AI編集部', '佐藤 花子', 'J. Smith', '編集部', 'K. Tanaka']), 100, 282);
  if (o.stamp !== false && r() < 0.5) { ctx.save(); ctx.translate(160, 110); ctx.rotate(0.3); star(ctx, 0, 0, 26, '#e63946', 12, 0.75); ctx.fillStyle = '#fff'; ctx.font = `900 11px ${fs(F.jpHeavy)}`; ctx.fillText('最新版', 0, 4); ctx.restore(); }
  ctx.restore();
}

// ---------- album art (square)
export function albumArt(ctx, x, y, s, seed, o = {}) {
  const r = rng(seed * 29 + 11);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip(); ctx.translate(x, y); ctx.scale(s / 200, s / 200);
  const [a, b] = r.pick(SAT);
  const g = ctx.createLinearGradient(0, 0, 200, 200); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(0, 0, 200, 200);
  const k = r.int(0, 3);
  ctx.globalAlpha = 0.8;
  if (k === 0) for (let i = 0; i < 6; i++) circle(ctx, 100, 100, 90 - i * 15, null, 'rgba(255,255,255,.5)', 2);
  else if (k === 1) { circle(ctx, 100, 110, 60, 'rgba(255,240,200,.9)'); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 130, 200, 70); }
  else if (k === 2) for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.4})`; ctx.fillRect(r() * 200, r() * 200, 20 + r() * 80, 3); }
  else { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(0, 200); for (let i = 0; i <= 20; i++) ctx.lineTo(i * 10, 140 - Math.abs(Math.sin(i * 1.3 + seed)) * 60); ctx.lineTo(200, 200); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.font = `700 16px ${fs(F.grotesk)}`; ctx.textAlign = 'left';
  ctx.fillText(o.title || r.pick(['Lofi Dreams', 'Chill Vibes 24/7', 'Relaxing Piano', 'Deep Focus', 'Sleep Rain', 'Morning Coffee', 'Night Drive', 'Study Beats', 'Ocean Calm']), 12, 186);
  ctx.restore();
}

// ---------- generic atlas builder
export function atlas(n, cw, ch, cols, drawFn) {
  const rows = Math.ceil(n / cols);
  const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch;
  const ctx = c.getContext('2d');
  for (let i = 0; i < n; i++) drawFn(ctx, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch, i);
  return { canvas: c, n, cw, ch, cols, draw(ctx2, i, x, y, w, h) { i = ((i % n) + n) % n; ctx2.drawImage(c, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch, x, y, w, h); } };
}

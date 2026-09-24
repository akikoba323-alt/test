// 2D drawing primitives shared by all scenes.
import { clamp, E, lerp } from '../engine/ease.js';
import { C, rgba } from '../engine/theme.js';

export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function fillRR(ctx, x, y, w, h, r, color) { rr(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); }
export function strokeRR(ctx, x, y, w, h, r, color, lw = 2) { rr(ctx, x, y, w, h, r); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); }
export function circle(ctx, x, y, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
export function line(ctx, x1, y1, x2, y2, color, lw = 2, p = 1) {
  if (p <= 0) return;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, p), lerp(y1, y2, p));
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
}
// polyline drawn on up to fraction p of its total length
export function poly(ctx, pts, p = 1, color = '#fff', lw = 2, close = false) {
  if (p <= 0 || pts.length < 2) return;
  const segs = []; let L = 0;
  const all = close ? [...pts, pts[0]] : pts;
  for (let i = 1; i < all.length; i++) { const d = Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1]); segs.push(d); L += d; }
  let rem = L * clamp(p);
  ctx.beginPath(); ctx.moveTo(all[0][0], all[0][1]);
  for (let i = 1; i < all.length; i++) {
    const d = segs[i - 1];
    if (rem >= d) { ctx.lineTo(all[i][0], all[i][1]); rem -= d; }
    else { const u = d > 0 ? rem / d : 0; ctx.lineTo(lerp(all[i - 1][0], all[i][0], u), lerp(all[i - 1][1], all[i][1], u)); break; }
  }
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
}
export function arrow(ctx, x1, y1, x2, y2, o = {}) {
  const p = o.p == null ? 1 : clamp(o.p);
  if (p <= 0) return;
  const x = lerp(x1, x2, p), y = lerp(y1, y2, p);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hs = o.head || 16, lw = o.lw || 3, col = o.color || C.paper;
  ctx.save();
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x - Math.cos(a) * hs * 0.6, y - Math.sin(a) * hs * 0.6); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(a - 0.45) * hs, y - Math.sin(a - 0.45) * hs);
  ctx.lineTo(x - Math.cos(a + 0.45) * hs, y - Math.sin(a + 0.45) * hs);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
// curved arrow via quadratic control point
export function carrow(ctx, x1, y1, cx, cy, x2, y2, o = {}) {
  const p = o.p == null ? 1 : clamp(o.p);
  if (p <= 0) return;
  const N = 40, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * p, u = 1 - t;
    pts.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2]);
  }
  ctx.save();
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.lineCap = 'round';
  poly(ctx, pts, 1, o.color || C.paper, o.lw || 3);
  ctx.restore();
  const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2];
  const a = Math.atan2(ay - by, ax - bx), hs = o.head || 16;
  ctx.fillStyle = o.color || C.paper;
  ctx.beginPath(); ctx.moveTo(ax, ay);
  ctx.lineTo(ax - Math.cos(a - 0.45) * hs, ay - Math.sin(a - 0.45) * hs);
  ctx.lineTo(ax - Math.cos(a + 0.45) * hs, ay - Math.sin(a + 0.45) * hs);
  ctx.closePath(); ctx.fill();
}
export function check(ctx, x, y, s, p, color = C.slop, lw = 6) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  poly(ctx, [[x - s * 0.5, y], [x - s * 0.15, y + s * 0.35], [x + s * 0.55, y - s * 0.4]], p, color, lw);
  ctx.restore();
}
export function cross(ctx, x, y, s, p, color = C.alert, lw = 6) {
  ctx.save(); ctx.lineCap = 'round';
  const a = clamp(p * 2), b = clamp(p * 2 - 1);
  line(ctx, x - s / 2, y - s / 2, x + s / 2, y + s / 2, color, lw, a);
  line(ctx, x + s / 2, y - s / 2, x - s / 2, y + s / 2, color, lw, b);
  ctx.restore();
}
// macOS-like arrow pointer; click: 0..1 press amount
export function cursor(ctx, x, y, s = 1, click = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 - click * 0.12), s * (1 - click * 0.12));
  const p = new Path2D('M0 0 L0 30 L7.2 23.4 L12 34.8 L17.4 32.4 L12.6 21.6 L22 21.6 Z');
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#fff'; ctx.fill(p);
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.8; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.stroke(p);
  ctx.restore();
  if (click > 0) { ctx.save(); ctx.globalAlpha = click * 0.8; circle(ctx, x, y, 14 + 26 * (1 - click), null, '#fff', 2); ctx.restore(); }
}
// pointing hand cursor
export function handCursor(ctx, x, y, s = 1, click = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-8, -2);
  const sc = 1 - click * 0.1; ctx.scale(sc, sc);
  const p = new Path2D('M8 2c1.7 0 3 1.3 3 3v10.5c.6-.4 1.3-.6 2-.6 1.2 0 2.2.6 2.7 1.5.5-.3 1.1-.4 1.7-.4 1.4 0 2.5.8 2.9 2 .4-.2.9-.3 1.4-.3 1.7 0 3 1.3 3 3V32c0 5-4 9-9 9h-3c-3.4 0-6.5-1.9-8-4.9L-1 28c-.8-1.5-.2-3.3 1.2-4.1 1.4-.8 3.1-.4 4 .9L5 26V5c0-1.7 1.3-3 3-3z');
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#fff'; ctx.fill(p); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.8; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.stroke(p);
  ctx.restore();
}
export function spinner(ctx, x, y, r, t, color = C.paper, lw = 4) {
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.floor(t * 12) * (Math.PI * 2 / 12);
    ctx.globalAlpha = 0.15 + 0.85 * (i / 11);
    line(ctx, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, x + Math.cos(a) * r, y + Math.sin(a) * r, color, lw);
  }
  ctx.restore();
}
export function ring(ctx, x, y, r, p, color = C.slop, lw = 6, start = -Math.PI / 2) {
  if (p <= 0) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r, start, start + Math.PI * 2 * clamp(p)); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); ctx.restore();
}
// soft glow blob (for light, bloom-like accents)
export function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
export function vgrad(ctx, x, y, w, h, c0, c1) {
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}
// dotted/fine grid background
export function grid(ctx, step = 60, color = 'rgba(255,255,255,0.05)', ox = 0, oy = 0, W = 1920, H = 1080, dots = false) {
  ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 1;
  const x0 = ((ox % step) + step) % step, y0 = ((oy % step) + step) % step;
  if (dots) { for (let x = x0; x < W; x += step) for (let y = y0; y < H; y += step) ctx.fillRect(x - 1, y - 1, 2, 2); }
  else {
    ctx.beginPath();
    for (let x = x0; x < W; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = y0; y < H; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();
  }
  ctx.restore();
}
// rectangular reveal clip helper: runs fn inside a clip rect
export function clip(ctx, x, y, w, h, fn) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); fn(); ctx.restore(); }
// camera-ish transform around a focus point: zoom s, pan (px,py), rotation r
export function cam(ctx, s = 1, px = 0, py = 0, r = 0, cx = 960, cy = 540) {
  ctx.translate(cx, cy); ctx.rotate(r); ctx.scale(s, s); ctx.translate(-cx + px, -cy + py);
}
// highlighter stroke behind text
export function marker(ctx, x, y, w, h, p, color = rgba(C.slop, 0.35)) {
  if (p <= 0) return;
  ctx.save(); ctx.fillStyle = color;
  const ww = w * clamp(p);
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.1); ctx.lineTo(x + ww, y); ctx.lineTo(x + ww + 4, y + h); ctx.lineTo(x - 2, y + h * 0.95); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// underline sweep
export function underline(ctx, x, y, w, p, color = C.slop, lw = 6) { line(ctx, x, y, x + w, y, color, lw, E.outExpo(clamp(p))); }
// star shape
export function star(ctx, x, y, r, fill, pts = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2, rr2 = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
// shaky hand-drawn line (for human/paper sections)
export function sketchLine(ctx, x1, y1, x2, y2, p, color, lw = 3, seed = 1) {
  const n = 24, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const j = Math.sin((u * 7 + seed) * 3.1) * 1.4 + Math.sin((u * 13 + seed * 2) * 2.3) * 0.8;
    const nx = -(y2 - y1), ny = x2 - x1, L = Math.hypot(nx, ny) || 1;
    pts.push([lerp(x1, x2, u) + (nx / L) * j, lerp(y1, y2, u) + (ny / L) * j]);
  }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; poly(ctx, pts, p, color, lw); ctx.restore();
}
// hand-drawn circle (ellipse with overshoot) around a region
export function sketchCircle(ctx, x, y, rx, ry, p, color = C.alert, lw = 5, seed = 3) {
  const n = 64, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = -2.2 + u * Math.PI * 2.15;
    const w = 1 + Math.sin(u * 9 + seed) * 0.03 + u * 0.05;
    pts.push([x + Math.cos(a) * rx * w, y + Math.sin(a) * ry * w]);
  }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; poly(ctx, pts, p, color, lw); ctx.restore();
}

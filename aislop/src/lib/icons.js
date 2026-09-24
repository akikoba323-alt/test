// Lucide line icons (ISC) drawn with Path2D on a 24-unit grid.
import ICONS from './icondata.js';

const cache = new Map();
function paths(name) {
  let p = cache.get(name);
  if (!p) {
    const d = ICONS[name];
    if (!d) throw new Error('unknown icon ' + name);
    p = d.map((s) => new Path2D(s));
    cache.set(name, p);
  }
  return p;
}
export function hasIcon(name) { return !!ICONS[name]; }

// draw icon centered at (x,y) with pixel size; o: {color, lw (in 24-grid units), alpha, fill, p (0..1 draw-on progress)}
export function icon(ctx, name, x, y, size, o = {}) {
  const ps = paths(name);
  const s = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(s, s);
  ctx.lineWidth = o.lw || 2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = o.color || '#fff';
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  if (o.p != null && o.p < 1) { ctx.setLineDash([60 * o.p, 200]); }
  if (o.fill) { ctx.fillStyle = o.fill; for (const p of ps) ctx.fill(p); }
  for (const p of ps) ctx.stroke(p);
  ctx.restore();
}

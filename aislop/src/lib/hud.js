// Documentary HUD: chapter tag (top-left) and source citation (top-right).
import { text, decodeEach, font } from '../engine/text.js';
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E } from '../engine/ease.js';
import { line } from './draw.js';

export function chapterTag(ctx, t, ch, o = {}) {
  // ch: {n:'02', jp:'規模', en:'SCALE'}; t: time since chapter start; o.alpha
  const a = (o.alpha ?? 1) * clamp(t / 0.25);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const x = 64, y = 70;
  const p = E.outExpo(clamp(t / 0.9));
  line(ctx, x, y + 16, x + 44 * p, y + 16, C.slop, 3);
  text(ctx, ch.n, x, y, { family: F.mono, size: 22, weight: 700, color: C.slop, each: decodeEach(clamp(t / 0.5), t, 3, true, C.slop) });
  text(ctx, ch.jp, x + 48, y, { family: F.jpHeavy, size: 24, weight: 700, color: C.paper, each: decodeEach(clamp((t - 0.1) / 0.6), t, 5, false, C.paper, C.mute2) });
  font(ctx, F.jpHeavy, 24, 700);
  const w = ctx.measureText(ch.jp).width;
  text(ctx, ch.en, x + 60 + w, y, { family: F.grotesk, size: 16, weight: 500, color: C.mute, ls: 3, each: decodeEach(clamp((t - 0.2) / 0.6), t, 9, true, C.mute) });
  ctx.restore();
}

export function sourceTag(ctx, t, src, o = {}) {
  const a = (o.alpha ?? 1) * clamp(t / 0.3);
  if (a <= 0 || !src) return;
  ctx.save();
  ctx.globalAlpha *= a * 0.9;
  const x = o.x ?? 1856, y = o.y ?? 70;
  text(ctx, src, x, y, { family: F.mono, size: 17, weight: 400, color: C.mute2, align: 'right', ls: 0.5, each: decodeEach(clamp(t / 0.8), t, 11, true, C.mute2) });
  text(ctx, 'SOURCE', x, y - 24, { family: F.mono, size: 12, weight: 700, color: C.mute, align: 'right', ls: 3 });
  ctx.restore();
}

// small caption label like "※イメージ" for illustrative content
export function noteTag(ctx, t, s, x = 1856, y = 868, align = 'right') {
  const a = clamp(t / 0.3);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a * 0.75;
  text(ctx, s, x, y, { family: F.jp, size: 18, weight: 400, color: C.mute2, align });
  ctx.restore();
}

// debug narration overlay for previews (not rendered in final)
export function debugSub(ctx, s) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 960, 1920, 120);
  text(ctx, s, 960, 1030, { family: F.jp, size: 30, weight: 500, color: '#ffe066', align: 'center' });
  ctx.restore();
}
export { rgba };

// big chapter card (center-left), t = time since card start, dur = total display time
export function chapterCard(ctx, t, ch, dur = 2.6, o = {}) {
  if (t < 0 || t > dur) return;
  const a = Math.min(clamp(t / 0.25), clamp((dur - t) / 0.4));
  const x = o.x ?? 150, y = o.y ?? 470;
  ctx.save(); ctx.globalAlpha *= a;
  if (o.dim !== false) { const g = ctx.createLinearGradient(0, 0, 1300, 0); g.addColorStop(0, 'rgba(8,8,10,.85)'); g.addColorStop(1, 'rgba(8,8,10,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1300, 1080); }
  const p = E.outExpo(clamp(t / 0.8));
  text(ctx, 'CHAPTER ' + ch.n, x, y - 120, { family: F.mono, size: 26, weight: 700, color: C.slop, ls: 8, each: decodeEach(clamp(t / 0.5), t, 13, true, C.slop) });
  line(ctx, x, y - 96, x + 520 * p, y - 96, C.slop, 3);
  text(ctx, ch.jp, x - 6, y + 40, { family: F.jpHeavy, size: 150, weight: 900, color: C.paper, each: (g, i, n) => { const u = E.outExpo(clamp((t - 0.1 - i * 0.06) / 0.6)); return { dy: (1 - u) * 60, a: u }; } });
  text(ctx, ch.en, x, y + 100, { family: F.grotesk, size: 30, weight: 500, color: C.mute2, ls: 10, each: decodeEach(clamp((t - 0.3) / 0.6), t, 17, true, C.mute2) });
  ctx.restore();
}

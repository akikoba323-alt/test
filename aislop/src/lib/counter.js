// Numbers: rolling odometer digits, formatted counters.
import { text, font } from '../engine/text.js';
import { clamp } from '../engine/ease.js';

export const fmt = (n, dec = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Odometer: value v (float), draws integer part with rolling digits (with thousands separators).
// o: {family,size,weight,color,align,sep:true,minDigits,ls}
export function odometer(ctx, v, x, y, o = {}) {
  const size = o.size || 120;
  font(ctx, o.family, size, o.weight || 700);
  const iv = Math.max(0, v);
  const nd = Math.max(o.minDigits || 1, String(Math.floor(iv)).length);
  const cw = ctx.measureText('0').width + (o.ls || 0);
  const sw = ctx.measureText(',').width * 0.9;
  const seps = o.sep === false ? 0 : Math.floor((nd - 1) / 3);
  const W = nd * cw + seps * sw;
  let x0 = x;
  if (o.align === 'center') x0 = x - W / 2; else if (o.align === 'right') x0 = x - W;
  const lh = size * 1.05;
  ctx.save();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.beginPath(); ctx.rect(x0 - 10, y - size * 0.95, W + 20, size * 1.2); ctx.clip();
  let cx = x0;
  for (let k = nd - 1; k >= 0; k--) {
    const p10 = Math.pow(10, k);
    const q = iv / p10;
    const d = Math.floor(q) % 10;
    let roll = 0;
    if (k === 0) roll = q - Math.floor(q);
    else { const lower = iv % p10; roll = clamp((lower - (p10 - 1)) / 1); }
    const leading = k > 0 && Math.floor(iv / p10) === 0 && k >= String(Math.floor(iv)).length && !(o.minDigits && k < o.minDigits);
    ctx.fillStyle = o.color || '#fff';
    if (!leading) {
      ctx.fillText(String(d), cx, y - roll * lh);
      ctx.fillText(String((d + 1) % 10), cx, y + lh - roll * lh);
    }
    cx += cw;
    if (seps && k > 0 && k % 3 === 0) { if (!leading) ctx.fillText(',', cx - cw * 0.08, y); cx += sw; }
  }
  ctx.restore();
  return W;
}

// eased count-up display
export function countText(ctx, v, x, y, o = {}) {
  const s = (o.prefix || '') + fmt(v, o.dec || 0) + (o.suffix || '');
  return text(ctx, s, x, y, o);
}

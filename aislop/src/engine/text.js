// Typography helpers for Canvas2D: fonts, per-glyph animation, Japanese wrapping, decode/type effects.
import { fs } from './theme.js';
import { clamp, E } from './ease.js';
import { hash } from './rng.js';

export function font(ctx, family, size, weight = 400, style = 'normal', fallback) {
  ctx.font = `${style} ${weight} ${size}px ${fs(family, fallback)}`;
}

const TIGHT_R = '、。，．」』）】〕〉》'; // glyph sits left in its em box
const TIGHT_L = '「『（【〔〈《'; // glyph sits right in its em box
const TIGHT_C = '・：；'; // centered
const NO_START = '、。，．・：；？！゛゜ヽヾゝゞ々ー）」』】〕〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ%％';
const NO_END = '（「『【〔〈《';

// layout glyphs of a single line; returns {glyphs:[{ch,x,w}], width}
export function layout(ctx, str, ls = 0, tight = false) {
  const glyphs = [];
  let x = 0;
  const em = parseFloat(ctx.font.match(/(\d+(?:\.\d+)?)px/)[1]);
  const chars = Array.from(str);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    let w = ctx.measureText(ch).width;
    let ox = 0;
    if (tight) {
      if (TIGHT_R.includes(ch)) { w *= 0.55; }
      else if (TIGHT_L.includes(ch)) { ox = -em * 0.45; w *= 0.55; }
      else if (TIGHT_C.includes(ch)) { ox = -em * 0.25; w *= 0.5; }
    }
    glyphs.push({ ch, x: x + ox, w, i });
    x += w + ls;
  }
  return { glyphs, width: Math.max(0, x - ls) };
}

// Draw a line of text. o: {family,size,weight,style,color,align,baseline,ls,alpha,tight,
//   stroke,strokeW,shadow,shadowBlur,each:(g,i,n)=>({dx,dy,s,r,a,color,ch})}
export function text(ctx, str, x, y, o = {}) {
  str = String(str);
  if (o.family) font(ctx, o.family, o.size || 48, o.weight || 400, o.style || 'normal', o.fallback);
  const ls = o.ls || 0;
  const align = o.align || 'left';
  ctx.textBaseline = o.baseline || 'alphabetic';
  ctx.textAlign = 'left';
  const L = layout(ctx, str, ls, o.tight);
  let x0 = x;
  if (align === 'center') x0 = x - L.width / 2;
  else if (align === 'right') x0 = x - L.width;
  const ga = o.alpha == null ? 1 : o.alpha;
  if (ga <= 0) return L.width;
  ctx.save();
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.shadowBlur || 20; }
  const n = L.glyphs.length;
  if (!o.each && !o.tight && !ls && !o.perGlyph) {
    ctx.globalAlpha *= ga;
    if (o.stroke) { ctx.lineWidth = o.strokeW || 4; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, x0, y); }
    if (o.color !== null) { ctx.fillStyle = o.color || '#fff'; ctx.fillText(str, x0, y); }
    ctx.restore();
    return L.width;
  }
  const baseAlpha = ctx.globalAlpha;
  for (let i = 0; i < n; i++) {
    const g = L.glyphs[i];
    const m = o.each ? o.each(g, i, n) : null;
    const a = (m && m.a != null ? m.a : 1) * ga;
    if (a <= 0.001) continue;
    const ch = (m && m.ch) || g.ch;
    const gx = x0 + g.x + (m && m.dx || 0);
    const gy = y + (m && m.dy || 0);
    ctx.globalAlpha = baseAlpha * a;
    const col = (m && m.color) || o.color || '#fff';
    if ((m && (m.s != null || m.r)) ) {
      ctx.save();
      const cx = gx + g.w / 2;
      ctx.translate(cx, gy);
      if (m.r) ctx.rotate(m.r);
      if (m.s != null) ctx.scale(m.s, m.sy != null ? m.sy : m.s);
      if (o.stroke) { ctx.lineWidth = o.strokeW || 4; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(ch, -g.w / 2, 0); }
      if (col !== null) { ctx.fillStyle = col; ctx.fillText(ch, -g.w / 2, 0); }
      ctx.restore();
    } else {
      if (o.stroke) { ctx.lineWidth = o.strokeW || 4; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(ch, gx, gy); }
      if (col !== null) { ctx.fillStyle = col; ctx.fillText(ch, gx, gy); }
    }
  }
  ctx.globalAlpha = baseAlpha;
  ctx.restore();
  return L.width;
}

export function measure(ctx, str, o = {}) {
  if (o.family) font(ctx, o.family, o.size || 48, o.weight || 400, o.style || 'normal', o.fallback);
  return layout(ctx, String(str), o.ls || 0, o.tight).width;
}

// Japanese-aware wrapping. Returns array of lines.
export function wrap(ctx, str, maxW, o = {}) {
  if (o.family) font(ctx, o.family, o.size || 48, o.weight || 400, o.style || 'normal', o.fallback);
  const out = [];
  for (const para of String(str).split('\n')) {
    const chars = Array.from(para);
    let line = '';
    let lastSpace = -1;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const test = line + ch;
      if (line && layout(ctx, test, o.ls || 0, o.tight).width > maxW) {
        // latin word wrap: break at last space if available
        if (/[A-Za-z0-9]/.test(ch) && lastSpace > 0) {
          const head = line.slice(0, lastSpace), tail = line.slice(lastSpace + 1);
          out.push(head); line = tail + ch; lastSpace = -1; continue;
        }
        if (NO_START.includes(ch)) { line = test; continue; } // hang punctuation
        let carry = '';
        while (line.length > 1 && NO_END.includes(line[line.length - 1])) { carry = line[line.length - 1] + carry; line = line.slice(0, -1); }
        out.push(line); line = carry + ch; lastSpace = -1;
      } else {
        if (ch === ' ') lastSpace = line.length;
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

// Paragraph: wrapped lines drawn with line height; supports per-line/each animation through o.each(g,i,n,lineIdx,globalIdx)
export function para(ctx, str, x, y, o = {}) {
  const lines = o.lines || wrap(ctx, str, o.maxW || 1200, o);
  const lh = o.lh || (o.size || 48) * 1.5;
  let gi = 0;
  lines.forEach((ln, li) => {
    const base = gi;
    const each = o.each ? (g, i, n) => o.each(g, base + i, n, li) : undefined;
    text(ctx, ln, x, y + li * lh, { ...o, family: null, each, perGlyph: !!o.each });
    gi += Array.from(ln).length;
  });
  return { lines, height: lines.length * lh, count: gi };
}

// Typewriter: number of visible chars for progress p
export const typed = (str, p) => Array.from(str).slice(0, Math.floor(Array.from(str).length * clamp(p) + 1e-6)).join('');

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFXYZ#$%&*+=<>/\\|';
const GLYPHS_L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/\\|';
// Decode/scramble effect: returns per-glyph "each" function for text()
// p: 0..1 progress of reveal (left to right), t: time for flicker, seed
export function decodeEach(p, t, seed = 1, latin = false, color, scrambleColor) {
  const set = latin ? GLYPHS_L : GLYPHS;
  return (g, i, n) => {
    const r = hash(seed * 997 + i * 31);
    const reveal = clamp(p * (n + 6) - i - r * 4); // 0..1 per char
    if (reveal >= 1) return { color };
    if (reveal <= 0 && p * (n + 6) < i - 2) return { a: 0 };
    if (g.ch === ' ' || g.ch === '　') return { a: 0 };
    const k = Math.floor(t * 24 + r * 50);
    return { ch: set[Math.floor(hash(k * 131 + i * 7 + seed) * set.length)], color: scrambleColor || color, a: 0.9 };
  };
}

// Rise-in per glyph (use with ctx clip to mask), p: 0..1, stagger fraction across the line
export function riseEach(p, size, stagger = 0.5, ease = E.outExpo, from = 1.0) {
  return (g, i, n) => {
    const k = n > 1 ? i / (n - 1) : 0;
    const u = ease(clamp((p - k * stagger) / (1 - stagger)));
    return { dy: (1 - u) * size * from, a: clamp(u * 3) };
  };
}
// per-glyph fade/scale pop
export function popEach(p, stagger = 0.6, ease = E.outBack) {
  return (g, i, n) => {
    const k = n > 1 ? i / (n - 1) : 0;
    const u = clamp((p - k * stagger) / (1 - stagger));
    return { s: ease(u), a: clamp(u * 4) };
  };
}

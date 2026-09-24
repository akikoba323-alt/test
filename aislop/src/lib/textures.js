// Cached procedural textures (offscreen canvases): paper, noise, halftone, scanlines, vignette.
import { rng } from '../engine/rng.js';
import { noise } from '../engine/noise.js';

const cache = new Map();
function make(key, w, h, fn) {
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    cache.set(key, c);
  }
  return c;
}

// warm paper with fibers and blotches
export function paper(tone = '#efe7d6', key = 'paper') {
  return make(key + tone, 1920, 1080, (ctx, w, h) => {
    ctx.fillStyle = tone; ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h); const d = img.data;
    const r = rng(42);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = noise.n2(x / 180, y / 180) * 7 + noise.n2(x / 30, y / 30) * 3 + (r() - 0.5) * 9;
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.06; ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 0.7;
    for (let k = 0; k < 900; k++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI, L = 6 + r() * 26;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * L * 0.5, y + Math.sin(a + 0.4) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
    }
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,40,10,0.28)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}

// monochrome noise tile (for 2D grain/static overlays)
export function noiseTile(seed = 1, size = 256) {
  return make('noise' + seed + '_' + size, size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h); const d = img.data; const r = rng(seed);
    for (let i = 0; i < d.length; i += 4) { const v = r() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  });
}

// halftone dot pattern tile
export function halftone(step = 8, color = '#000', key = '') {
  return make('ht' + step + color + key, step * 16, step * 16, (ctx, w, h) => {
    ctx.fillStyle = color;
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.arc(x + step / 2, y + step / 2, step * 0.32, 0, Math.PI * 2); ctx.fill();
    }
  });
}

// draw a static-noise overlay (TV snow) at time t
export function snow(ctx, t, alpha = 0.3, x = 0, y = 0, w = 1920, h = 1080) {
  const tile = noiseTile(7, 256);
  ctx.save(); ctx.globalAlpha *= alpha;
  const k = Math.floor(t * 30);
  const ox = (k * 97) % 256, oy = (k * 57) % 256;
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let yy = y - oy; yy < y + h; yy += 256) for (let xx = x - ox; xx < x + w; xx += 256) ctx.drawImage(tile, xx, yy);
  ctx.restore();
}

export function scanlines(ctx, alpha = 0.15, step = 4, x = 0, y = 0, w = 1920, h = 1080) {
  ctx.save(); ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let yy = y; yy < y + h; yy += step) ctx.fillRect(x, yy, w, step / 2);
  ctx.restore();
}

export function vignette2d(ctx, amt = 0.6, color = '0,0,0', W = 1920, H = 1080) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(1, `rgba(${color},${amt})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

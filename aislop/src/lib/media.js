// "Specimen" tiles for each medium (photo, video, news, blog, music, book, review, legal, paper).
import { C, F, rgba } from '../engine/theme.js';
import { text, font } from '../engine/text.js';
import { rr, fillRR, strokeRR, circle, star, line } from './draw.js';
import { icon } from './icons.js';
import { photo, videoThumb, bookCover } from './thumbs.js';
import { rng } from '../engine/rng.js';

export const MEDIA = [
  { k: 'photo', jp: '写真', en: 'PHOTO', icon: 'image' },
  { k: 'video', jp: '動画', en: 'VIDEO', icon: 'play' },
  { k: 'news', jp: 'ニュース', en: 'NEWS', icon: 'newspaper' },
  { k: 'blog', jp: 'ブログ', en: 'BLOG', icon: 'pen-line' },
  { k: 'music', jp: '音楽', en: 'MUSIC', icon: 'music' },
  { k: 'book', jp: '本', en: 'BOOK', icon: 'book-open' },
  { k: 'review', jp: 'レビュー', en: 'REVIEW', icon: 'star' },
  { k: 'legal', jp: '裁判資料', en: 'LEGAL', icon: 'scale' },
  { k: 'paper', jp: '研究論文', en: 'PAPER', icon: 'file-text' },
];

// draw specimen of medium k inside box (x,y,w,h); t = time for small internal motion
export function specimen(ctx, k, x, y, w, h, t = 0, o = {}) {
  const r = rng(o.seed || 5);
  ctx.save();
  rr(ctx, x, y, w, h, 14); ctx.clip();
  const light = '#f4f1ea', ink = '#1c1b19', mid = '#bdb8ad';
  const bars = (bx, by, n, bw, gap = 14, col = mid, th = 6) => { for (let i = 0; i < n; i++) { ctx.fillStyle = col; ctx.fillRect(bx, by + i * gap, (i === n - 1 ? 0.55 : 1) * bw * (0.85 + 0.15 * Math.sin(i * 7.1 + (o.seed || 0))), th); } };
  switch (k) {
    case 'photo': {
      ctx.fillStyle = '#e9e5dc'; ctx.fillRect(x, y, w, h);
      photo(ctx, x + 16, y + 16, w - 32, h - 32, o.seed || 3, { mood: o.mood || 'dusk' });
      break;
    }
    case 'video': {
      videoThumb(ctx, x, y, w, h, o.seed || 11);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y + h - 10, w, 10);
      ctx.fillStyle = '#ff2e2e'; ctx.fillRect(x, y + h - 10, w * ((t * 0.12) % 1), 10);
      circle(ctx, x + w / 2, y + h / 2, 34, 'rgba(0,0,0,.55)');
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + w / 2 - 11, y + h / 2 - 16); ctx.lineTo(x + w / 2 + 17, y + h / 2); ctx.lineTo(x + w / 2 - 11, y + h / 2 + 16); ctx.fill();
      break;
    }
    case 'news': {
      ctx.fillStyle = light; ctx.fillRect(x, y, w, h);
      text(ctx, 'THE DAILY', x + w / 2, y + 44, { family: F.fraktur, size: 36, color: ink, align: 'center' });
      line(ctx, x + 16, y + 56, x + w - 16, y + 56, ink, 2); line(ctx, x + 16, y + 61, x + w - 16, y + 61, ink, 1);
      text(ctx, '速報', x + 18, y + 100, { family: F.jpHeavy, size: 34, weight: 900, color: '#b3261e' });
      ctx.fillStyle = ink; ctx.fillRect(x + 100, y + 76, w - 120, 12); ctx.fillRect(x + 100, y + 94, w - 170, 12);
      ctx.fillStyle = '#9d978a'; ctx.fillRect(x + 18, y + 118, (w - 36) * 0.45, h - 136);
      bars(x + 18 + (w - 36) * 0.5, y + 122, Math.floor((h - 140) / 14), (w - 36) * 0.5);
      break;
    }
    case 'blog': {
      ctx.fillStyle = '#fbfaf7'; ctx.fillRect(x, y, w, h);
      circle(ctx, x + 40, y + 40, 20, '#e0a458');
      text(ctx, 'my diary', x + 72, y + 38, { family: F.garamond, size: 24, style: 'italic', color: ink });
      ctx.fillStyle = '#aaa'; ctx.fillRect(x + 72, y + 48, 70, 5);
      text(ctx, '週末、海へ。', x + 22, y + 104, { family: F.jp, size: 28, weight: 700, color: ink });
      bars(x + 22, y + 124, Math.floor((h - 140) / 14), w - 44);
      break;
    }
    case 'music': {
      const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#1b1036'); g.addColorStop(1, '#3a1756');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      const n = 36, bw = (w - 40) / n;
      for (let i = 0; i < n; i++) {
        const a = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.9 + t * 3.1) * Math.sin(i * 0.37 + t * 1.3));
        const bh = a * (h * 0.5);
        ctx.fillStyle = i / n < ((t * 0.1) % 1) ? '#ff7bd5' : 'rgba(255,255,255,.55)';
        ctx.fillRect(x + 20 + i * bw, y + h * 0.5 - bh / 2, bw * 0.6, bh);
      }
      icon(ctx, 'music', x + 34, y + h - 32, 28, { color: '#fff' });
      text(ctx, '0:42 / 3:15', x + w - 20, y + h - 22, { family: F.mono, size: 18, color: '#ddd', align: 'right' });
      break;
    }
    case 'book': {
      ctx.fillStyle = '#2b2622'; ctx.fillRect(x, y, w, h);
      const bw = h * 0.62;
      bookCover(ctx, x + w / 2 - bw * 0.5 - 20, y + 14, bw * 0.95, h - 28, o.seed || 2, 'hokkaido', { stamp: false, author: '著者名' });
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + w / 2 - bw * 0.5 - 20, y + 14, 6, h - 28);
      ctx.fillStyle = '#efe8da'; ctx.fillRect(x + w / 2 + bw * 0.5 - 16, y + 20, 20, h - 40);
      break;
    }
    case 'review': {
      ctx.fillStyle = '#fbfaf7'; ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 5; i++) star(ctx, x + 36 + i * 44, y + 48, 18, '#f5a623');
      text(ctx, '最高でした！また買います', x + 20, y + 110, { family: F.jp, size: 26, weight: 700, color: ink });
      bars(x + 20, y + 130, Math.floor((h - 150) / 14), w - 40);
      text(ctx, '購入者 ✓', x + w - 20, y + 48, { family: F.jp, size: 18, weight: 500, color: '#2e7d32', align: 'right' });
      break;
    }
    case 'legal': {
      ctx.fillStyle = '#f7f4ec'; ctx.fillRect(x, y, w, h);
      text(ctx, '準 備 書 面', x + w / 2, y + 48, { family: F.mincho, size: 30, weight: 700, color: ink, align: 'center' });
      bars(x + 30, y + 72, Math.floor((h - 90) / 16), w - 60, 16, '#c9c3b6', 5);
      circle(ctx, x + w - 60, y + h - 50, 30, null, '#c62828', 4);
      text(ctx, '印', x + w - 60, y + h - 40, { family: F.mincho, size: 28, weight: 900, color: '#c62828', align: 'center' });
      break;
    }
    case 'paper': {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h);
      text(ctx, 'On the Emergence of', x + w / 2, y + 40, { family: F.times, size: 22, weight: 700, color: ink, align: 'center' });
      text(ctx, 'Recursive Structures', x + w / 2, y + 64, { family: F.times, size: 22, weight: 700, color: ink, align: 'center' });
      text(ctx, 'Abstract', x + 24, y + 96, { family: F.times, size: 15, weight: 700, color: ink });
      bars(x + 24, y + 106, 4, w * 0.5 - 30, 11, '#bbb', 4);
      ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.strokeRect(x + w * 0.55, y + 92, w * 0.4 - 12, h - 110);
      ctx.beginPath(); for (let i = 0; i <= 20; i++) { const px = x + w * 0.55 + 8 + i * (w * 0.4 - 28) / 20; const py = y + h - 30 - (1 - Math.exp(-i / 6)) * (h - 150); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.strokeStyle = '#1d4ed8'; ctx.stroke();
      bars(x + 24, y + 160, Math.floor((h - 170) / 11), w * 0.5 - 30, 11, '#ccc', 4);
      break;
    }
  }
  ctx.restore();
}

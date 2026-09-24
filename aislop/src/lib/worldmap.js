// Equirectangular land mask + dot-matrix sampling (Natural Earth via world-atlas, public domain).
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';

let mask = null;
const LAT0 = 84, LAT1 = -58; // crop Antarctica
export function landMask(w = 2000, h = 900) {
  if (mask && mask.width === w) return mask;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  const geo = feature(land110, land110.objects.land);
  const px = (lon) => ((lon + 180) / 360) * w, py = (lat) => ((LAT0 - lat) / (LAT0 - LAT1)) * h;
  ctx.beginPath();
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) {
      ring.forEach(([lon, lat], i) => (i ? ctx.lineTo(px(lon), py(lat)) : ctx.moveTo(px(lon), py(lat))));
      ctx.closePath();
    }
  }
  ctx.fill('evenodd');
  mask = c;
  mask.data = ctx.getImageData(0, 0, w, h).data;
  return mask;
}
// grid dots on land inside rect (x,y,w,h) with pitch; returns [[x,y],...]
export function landDots(x, y, w, h, pitch) {
  const m = landMask();
  const out = [];
  for (let j = 0; j * pitch < h; j++) for (let i = 0; i * pitch < w; i++) {
    const px = i * pitch + (j % 2) * pitch * 0.5, py = j * pitch;
    const mx = Math.floor((px / w) * m.width), my = Math.floor((py / h) * m.height);
    if (mx < 0 || my < 0 || mx >= m.width || my >= m.height) continue;
    if (m.data[(my * m.width + mx) * 4] > 127) out.push([x + px, y + py]);
  }
  return out;
}

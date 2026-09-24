// Preview stills: node tools/shot.mjs --t 1,2.5 | --scene ID [--n 8] | --from A --to B --n 12  [--w 960] [--sheet 4] [--out prefix]
// Saves JPGs (and an optional contact sheet) for visual review.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
import { openPage } from './browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const W = Number(args.w || 960), H = Math.round(W * 9 / 16);
const out = args.out || path.resolve('out/shots/s');
fs.mkdirSync(path.dirname(out), { recursive: true });
const server = await serve({ port: 0 });
const port = server.address().port;
const t0 = Date.now();
const { browser, page } = await openPage(`http://127.0.0.1:${port}/index.html?w=${W}&h=${H}${args.subs ? '&subs=1' : ''}`, { W, H, quiet: !!args.quiet });
console.log(`init ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const info = await page.evaluate(() => window.__info());
let times = [];
if (args.t) times = args.t.split(',').map(Number);
else if (args.scene) {
  const ids = args.scene.split(',');
  for (const id of ids) {
    const s = info.scenes.find((x) => x.id === id);
    if (!s) { console.log('no scene', id, info.scenes.map((x) => x.id).join(' ')); process.exit(1); }
    const n = Number(args.n || 8);
    for (let k = 0; k < n; k++) times.push(s.start + (s.end - s.start) * (k + 0.5) / n);
  }
} else if (args.from) {
  const a = Number(args.from), b = Number(args.to), n = Number(args.n || 8);
  for (let k = 0; k < n; k++) times.push(a + (b - a) * (n === 1 ? 0 : k / (n - 1)));
}
const files = [];
for (const [i, t] of times.entries()) {
  const t1 = Date.now();
  const url = await page.evaluate(async (tt) => await window.__shot(tt), t);
  const file = `${out}_${String(i).padStart(3, '0')}.jpg`;
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  files.push(file);
  if (!args.quiet) console.log(`t=${t.toFixed(2)} -> ${file} (${((Date.now() - t1) / 1000).toFixed(2)}s)`);
}
await browser.close();
server.close();
if (args.sheet) {
  execFileSync('python3', [path.join(path.dirname(new URL(import.meta.url).pathname), 'sheet.py'), String(args.sheet), `${out}_sheet.jpg`, ...times.map(String), '--', ...files], { stdio: 'inherit' });
}

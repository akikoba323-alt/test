// Headless capture tool (SwiftShader WebGL2).
//   node tools/shot.mjs --t 1,2.5,3 [--w 960 --h 404] [--q high] [--p "key=val&..."] [--out dir/prefix] [--sheet 4] [--step 0.0333 --n 12]
// Seeks the sequence to each playback time and saves PNG frames; --sheet N builds a contact sheet with N columns.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const W = Number(args.w || 960), H = Number(args.h || 404);
let times = (args.t || '0').split(',').map(Number);
if (args.n) {
  const n = Number(args.n), step = Number(args.step || 1 / 30);
  times = Array.from({ length: n }, (_, i) => times[0] + i * step);
}
const out = args.out || '/tmp/claude-0/-home-user-test/69f44d0d-9d29-5d59-88a6-d608b4d309a6/scratchpad/shots/f';
fs.mkdirSync(path.dirname(out), { recursive: true });

const server = await serve(0);
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--js-flags=--max-old-space-size=6144'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => { const t = m.text(); logs.push(t); if (!args.quiet || m.type() === 'error') console.log(`[${m.type()}] ${t.slice(0, 2000)}`); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')));
const q = `offline=1&w=${W}&h=${H}&q=${args.q || 'high'}${args.p ? '&' + args.p : ''}`;
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html?${q}`);
await page.waitForFunction(() => window.__ready === true || window.__failed, null, { timeout: 600000, polling: 200 });
if (await page.evaluate(() => window.__failed)) { console.log('init failed'); await browser.close(); server.close(); process.exit(1); }
console.log(`init ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (args.eval) await page.evaluate(args.eval);
const files = [];
for (const [i, t] of times.entries()) {
  const t1 = Date.now();
  const url = await page.evaluate(async (tt) => await window.__captureAt(tt), t);
  const file = `${out}_${String(i).padStart(3, '0')}.png`;
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  files.push(file);
  console.log(`t=${t.toFixed(3)} -> ${file} (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
}
if (args.stats) console.log(await page.evaluate(() => JSON.stringify(window.__stats?.())));
await browser.close();
server.close();
if (args.sheet) {
  execFileSync('python3', [path.join(path.dirname(new URL(import.meta.url).pathname), 'sheet.py'), String(args.sheet), `${out}_sheet.png`, ...files], { stdio: 'inherit' });
}

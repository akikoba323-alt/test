// Scan the film for animation onsets (pop-ins, text rises, clicks) and scene transitions, for the sound-effects track.
//   node tools/sfx_scan.mjs [--fps 15] [--out out/sfx/onsets.json]
// Builds a separate bundle into dist/sfx/ (the main dist/bundle.js is left alone) and plays the film at low resolution,
// recording every since()/pulse() onset that is actually crossed on screen.
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { serve } from './serve.mjs';
import { openPage } from './browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const FPS = Number(args.fps || 15);
const out = path.resolve(args.out || 'out/sfx/onsets.json');
const dir = path.resolve('dist/sfx');
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });
await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, format: 'esm', outfile: path.join(dir, 'bundle.js'), target: 'chrome120', logLevel: 'warning', loader: { '.glsl': 'text' } });
fs.copyFileSync('src/index.html', path.join(dir, 'index.html'));

const srv = await serve({ port: 0 });
const { browser, page } = await openPage(`http://127.0.0.1:${srv.address().port}/sfx/index.html?w=320&h=180&fps=30`, { W: 320, H: 180, quiet: true });
const res = await page.evaluate(async (fps) => {
  const eng = window.__eng;
  const seen = new Map();
  let T = 0;
  globalThis.__onset = (a, d, kind) => {
    const S = globalThis.__scene;
    if (!S || !Number.isFinite(a)) return;
    const t = T - S.start;
    const key = `${S.id}|${a.toFixed(3)}|${kind}`;
    let o = seen.get(key);
    if (!o) seen.set(key, (o = { scene: S.id, a, d, kind, T: S.start + a, n: 0, tmin: t, tmax: t }));
    o.n++; o.tmin = Math.min(o.tmin, t); o.tmax = Math.max(o.tmax, t);
  };
  const N = Math.ceil(eng.duration * fps);
  for (let i = 0; i < N; i++) { T = i / fps; eng.render(T); if (i % 600 === 0) await new Promise((r) => setTimeout(r, 0)); }
  globalThis.__onset = null;
  // an onset counts when it is crossed on screen: either seen before and after it, or first called right as it starts
  // (calls guarded by "if (t > a)" only begin once the onset has passed)
  const onsets = [...seen.values()].filter((o) => o.n >= 2 && o.tmax >= o.a && o.tmin - o.a <= 1.5 / fps).map(({ scene, a, d, kind, T }) => ({ scene, T: +T.toFixed(3), a: +a.toFixed(3), d: +d.toFixed(3), kind }));
  onsets.sort((x, y) => x.T - y.T);
  const scenes = eng.scenes.map((s) => ({ id: s.id, start: +s.start.toFixed(3), end: +s.end.toFixed(3), trans: s.trans?.type || 'cut', td: s.trans?.d || 0 }));
  return { duration: eng.duration, onsets, scenes };
}, FPS);
await browser.close(); srv.close();
fs.writeFileSync(out, JSON.stringify(res, null, 1));
const byKind = {};
for (const o of res.onsets) byKind[o.kind] = (byKind[o.kind] || 0) + 1;
console.log(`wrote ${out}: ${res.onsets.length} onsets`, byKind, `${res.scenes.length} scenes`);

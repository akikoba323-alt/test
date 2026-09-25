// Render the whole film in short segments (resumable), join them into chapters, then into one master.
//   node tools/render_film.mjs [--dir out/film] [--workers 2] [--seg 600] [--threads 2] [--crf 19] [--preset medium] [--grain 0.5] [--grainsize 1.25] [--only 03,04]
// Segments land in <dir>/seg/ with a .ok marker each (finished segments are skipped on the next run);
// chapters become <dir>/chNN_<name>.mp4 and the joined master <dir>/aislop_visual_1080p30.mp4 (video only, 1920x1080, 30 fps, BT.709).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
import { openPage } from './browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const FPS = 30;
const dir = path.resolve(args.dir || 'out/film');
const segDir = path.join(dir, 'seg');
const workers = Number(args.workers || 2);
const SEG = Number(args.seg || 600);
const defaults = { crf: '19', preset: 'medium', grain: '0.5', grainsize: '1.25', threads: '2' };
const pass = Object.keys(defaults).flatMap((k) => ['--' + k, args[k] || defaults[k]]);
fs.mkdirSync(segDir, { recursive: true });
const logFile = path.join(dir, 'render.log');
const log = (s) => { const line = `${new Date().toISOString().slice(11, 19)} ${s}`; console.log(line); fs.appendFileSync(logFile, line + '\n'); };
const concat = (files, out) => {
  const list = out + '.txt';
  fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
  fs.unlinkSync(list);
};
const countFrames = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', f]).toString().trim());

// chapter boundaries from the scene list
const srv = await serve({ port: 0 });
const { browser, page } = await openPage(`http://127.0.0.1:${srv.address().port}/index.html?w=320&h=180`, { W: 320, H: 180, quiet: true });
const info = await page.evaluate(() => window.__info());
await browser.close(); srv.close();
const chs = [{ n: '00', en: 'OPEN', jp: 'オープニング', t0: 0 }, ...info.chapters.filter((c) => c.n !== '00')];
const chapters = chs.map((c, i) => {
  const t1 = i + 1 < chs.length ? chs[i + 1].t0 : info.duration;
  const slug = (c.en || 'ch').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const f0 = Math.round(c.t0 * FPS), f1 = Math.round(t1 * FPS);
  const segs = [];
  for (let a = f0, k = 0; a < f1; a += SEG, k++) segs.push({ ch: c.n, k, f0: a, f1: Math.min(f1, a + SEG), file: path.join(segDir, `ch${c.n}_${String(k).padStart(2, '0')}.mp4`) });
  return { n: c.n, jp: c.jp, t0: c.t0, t1, f0, f1, segs, file: path.join(dir, `ch${c.n}_${slug}.mp4`) };
});
fs.writeFileSync(path.join(dir, 'chapters.json'), JSON.stringify(chapters.map(({ n, jp, t0, t1, f0, f1, file }) => ({ n, jp, t0, t1, f0, f1, file: path.basename(file) })), null, 2));
const only = args.only ? new Set(args.only.split(',')) : null;
const todo = chapters.filter((c) => !only || only.has(c.n)).flatMap((c) => c.segs).filter((s) => !fs.existsSync(s.file + '.ok'));
log(`film ${info.duration.toFixed(2)}s, ${chapters.length} chapters, ${todo.length} segments to render, workers=${workers} [${pass.join(' ')}]`);

const T0 = Date.now();
let doneFrames = 0;
const totalFrames = todo.reduce((n, s) => n + s.f1 - s.f0, 0);
function finishChapter(c) {
  if (fs.existsSync(c.file + '.ok') || !c.segs.every((s) => fs.existsSync(s.file + '.ok'))) return;
  concat(c.segs.map((s) => s.file), c.file);
  const n = countFrames(c.file);
  if (n !== c.f1 - c.f0) { log(`!! ch${c.n}: ${n} frames, expected ${c.f1 - c.f0}`); return; }
  fs.writeFileSync(c.file + '.ok', new Date().toISOString());
  log(`chapter ch${c.n} ${c.jp} ready: ${path.basename(c.file)} (${n} frames, ${(fs.statSync(c.file).size / 1e6).toFixed(0)} MB)`);
}
async function run(s) {
  const t = Date.now();
  await new Promise((res, rej) => {
    const c = spawn('node', ['tools/render.mjs', '--from', String(s.f0 / FPS), '--to', String(s.f1 / FPS), '--out', s.file, ...pass], { stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const keep = (d) => { tail = (tail + d).slice(-2000); };
    c.stdout.on('data', keep); c.stderr.on('data', keep);
    c.on('close', (code) => (code === 0 ? res() : rej(new Error(`segment ch${s.ch}_${s.k} exit ${code}: ${tail}`))));
  });
  const n = countFrames(s.file);
  if (n !== s.f1 - s.f0) throw new Error(`segment ch${s.ch}_${s.k}: ${n} frames, expected ${s.f1 - s.f0}`);
  fs.writeFileSync(s.file + '.ok', new Date().toISOString());
  doneFrames += s.f1 - s.f0;
  const el = (Date.now() - T0) / 1000;
  log(`seg ch${s.ch}_${s.k} ${s.f1 - s.f0}f in ${((Date.now() - t) / 1000).toFixed(0)}s | ${doneFrames}/${totalFrames} frames, eta ${((totalFrames - doneFrames) * el / doneFrames / 60).toFixed(0)} min`);
  finishChapter(chapters.find((c) => c.n === s.ch));
}
const queue = [...todo];
await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, async () => {
  while (queue.length) {
    const s = queue.shift();
    try { await run(s); } catch (e) { log('!! ' + e.message); }
  }
}));
for (const c of chapters) finishChapter(c);

if (chapters.every((c) => fs.existsSync(c.file + '.ok'))) {
  const master = path.join(dir, 'aislop_visual_1080p30.mp4');
  concat(chapters.map((c) => c.file), master);
  log(`master ${path.basename(master)}: ${countFrames(master)} frames (expected ${Math.round(info.duration * FPS)}), ${(fs.statSync(master).size / 1e6).toFixed(0)} MB`);
}
log(`total ${((Date.now() - T0) / 60000).toFixed(1)} min`);

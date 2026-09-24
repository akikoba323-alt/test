// Render the whole film chapter by chapter (resumable), then join the chapters into one master.
//   node tools/render_film.mjs [--dir out/film] [--workers 2] [--threads 2] [--crf 18] [--preset medium] [--grain 0.6] [--grainsize 1.25] [--only 03,04]
// Each chapter becomes <dir>/chNN_<name>.mp4 (a finished chapter gets a .ok marker and is skipped next time);
// the joined master is <dir>/aislop_visual_1080p30.mp4 (video only, 1920x1080, 30 fps, BT.709).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
import { openPage } from './browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const dir = path.resolve(args.dir || 'out/film');
const workers = Number(args.workers || 2);
const pass = ['crf', 'preset', 'grain', 'grainsize', 'threads'].flatMap((k) => (args[k] ? ['--' + k, args[k]] : []));
const defaults = { crf: '18', preset: 'medium', grain: '0.6', grainsize: '1.25', threads: '2' };
for (const [k, v] of Object.entries(defaults)) if (!args[k]) pass.push('--' + k, v);
fs.mkdirSync(dir, { recursive: true });
const logFile = path.join(dir, 'render.log');
const log = (s) => { const line = `${new Date().toISOString().slice(11, 19)} ${s}`; console.log(line); fs.appendFileSync(logFile, line + '\n'); };

// chapter boundaries from the scene list
const srv = await serve({ port: 0 });
const { browser, page } = await openPage(`http://127.0.0.1:${srv.address().port}/index.html?w=320&h=180`, { W: 320, H: 180, quiet: true });
const info = await page.evaluate(() => window.__info());
await browser.close(); srv.close();
const EN = { '00': 'open' };
const chs = [{ n: '00', en: 'OPEN', t0: 0 }, ...info.chapters.filter((c) => c.n !== '00')];
const parts = chs.map((c, i) => {
  const t1 = i + 1 < chs.length ? chs[i + 1].t0 : info.duration;
  const slug = (EN[c.n] || c.en || 'ch').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return { n: c.n, jp: c.jp || 'オープニング', t0: c.t0, t1, file: path.join(dir, `ch${c.n}_${slug}.mp4`) };
});
fs.writeFileSync(path.join(dir, 'chapters.json'), JSON.stringify(parts.map(({ n, jp, t0, t1, file }) => ({ n, jp, t0, t1, file: path.basename(file) })), null, 2));
const only = args.only ? new Set(args.only.split(',')) : null;
const todo = parts.filter((p) => (!only || only.has(p.n)) && !fs.existsSync(p.file + '.ok')).sort((a, b) => (b.t1 - b.t0) - (a.t1 - a.t0));
log(`film ${info.duration.toFixed(2)}s, ${parts.length} chapters, ${todo.length} to render, workers=${workers} [${pass.join(' ')}]`);

const T0 = Date.now();
async function run(p) {
  const t = Date.now();
  log(`start ch${p.n} ${p.jp} ${p.t0.toFixed(2)}..${p.t1.toFixed(2)} (${Math.round((p.t1 - p.t0) * 30)} frames)`);
  await new Promise((res, rej) => {
    const c = spawn('node', ['tools/render.mjs', '--from', String(p.t0), '--to', String(p.t1), '--out', p.file, ...pass], { stdio: ['ignore', 'pipe', 'pipe'] });
    const fwd = (d) => { for (const line of String(d).split('\n')) if (line.trim()) log(`  ch${p.n} ${line.trim()}`); };
    c.stdout.on('data', fwd); c.stderr.on('data', fwd);
    c.on('close', (code) => (code === 0 ? res() : rej(new Error(`ch${p.n} exit ${code}`))));
  });
  fs.writeFileSync(p.file + '.ok', new Date().toISOString());
  log(`done ch${p.n} in ${((Date.now() - t) / 60000).toFixed(1)} min`);
}
const queue = [...todo];
await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));

if (parts.every((p) => fs.existsSync(p.file + '.ok'))) {
  const list = path.join(dir, 'concat.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.file}'`).join('\n'));
  const master = path.join(dir, 'aislop_visual_1080p30.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', master]);
  const frames = execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', master]).toString().trim();
  log(`master ${master}: ${frames} frames (expected ${Math.round(info.duration * 30)})`);
}
log(`total ${((Date.now() - T0) / 60000).toFixed(1)} min`);

// Video render: node tools/render.mjs [--from S --to S | --scene ID[,ID] | --all] [--w 1920] [--fps 30] [--jobs 3] [--crf 16] [--preset medium] --out file.mp4
// Frames are rendered headlessly, streamed as raw RGBA over localhost and encoded by ffmpeg (BT.709).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
import { openPage } from './browser.mjs';
import wsPkg from '../node_modules/ws/index.js';
const { WebSocketServer } = wsPkg;

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const W = Number(args.w || 1920), H = Math.round(W * 9 / 16), FPS = Number(args.fps || 30);
const jobs = Number(args.jobs || 1);
const out = path.resolve(args.out || 'out/render.mp4');
fs.mkdirSync(path.dirname(out), { recursive: true });

function ffmpegArgs(file) {
  return ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', args.preset || 'medium', '-crf', String(args.crf || 16), '-g', String(FPS * 2), '-bf', '2',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', file];
}

async function renderChunk(i0, i1, file, tag) {
  const ff = spawn('ffmpeg', ffmpegArgs(file), { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  let got = 0; const t0 = Date.now();
  const frameBytes = W * H * 1.5;
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0, maxPayload: frameBytes * 2 });
  wss.on('connection', (sock) => {
    sock.on('message', (data) => {
      if (data.length !== frameBytes) { console.log(`[${tag}] bad frame size ${data.length}`); return; }
      got++;
      if (!ff.stdin.write(data)) { sock._socket.pause(); ff.stdin.once('drain', () => sock._socket.resume()); }
      if (got % 10 === 0 || got === i1 - i0) sock.send(String(got));
      if (got % 300 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`[${tag}] ${got}/${i1 - i0} frames  ${(el / got).toFixed(3)}s/f  eta ${((i1 - i0 - got) * el / got / 60).toFixed(1)}min`);
      }
    });
  });
  const server = await serve({ port: 0 });
  const port = server.address().port;
  const { browser, page } = await openPage(`http://127.0.0.1:${port}/index.html?w=${W}&h=${H}&fps=${FPS}${args.grain ? '&grain=' + args.grain : ''}${args.grainsize ? '&grainsize=' + args.grainsize : ''}`, { W, H, quiet: true, threads: args.threads ? Number(args.threads) : undefined });
  const stats = await page.evaluate(async ([a, b, wp]) => await window.__renderRange(a, b, wp), [i0, i1, wss.address().port]);
  await browser.close();
  server.close(); wss.close();
  ff.stdin.end();
  await ffDone;
  console.log(`[${tag}] done ${i1 - i0} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s (page ${(stats.t / stats.n).toFixed(0)}ms/f)`);
}

// resolve frame range
const probe = await serve({ port: 0 });
const { browser: b0, page: p0 } = await openPage(`http://127.0.0.1:${probe.address().port}/index.html?w=320&h=180&fps=${FPS}`, { W: 320, H: 180, quiet: true });
const info = await p0.evaluate(() => window.__info());
await b0.close(); probe.close();
let t0s = 0, t1s = info.duration;
if (args.scene) {
  const ids = args.scene.split(',');
  const sc = info.scenes.filter((s) => ids.includes(s.id));
  t0s = Math.min(...sc.map((s) => s.start)); t1s = Math.max(...sc.map((s) => s.end));
} else if (args.from) { t0s = Number(args.from); t1s = Number(args.to || info.duration); }
const f0 = Math.round(t0s * FPS), f1 = Math.round(t1s * FPS);
console.log(`render ${t0s.toFixed(2)}s..${t1s.toFixed(2)}s = ${f1 - f0} frames @${W}x${H} jobs=${jobs}`);
const T0 = Date.now();
if (jobs <= 1) await renderChunk(f0, f1, out, 'r');
else {
  const n = f1 - f0, per = Math.ceil(n / jobs);
  const parts = [];
  const tasks = [];
  for (let k = 0; k < jobs; k++) {
    const a = f0 + k * per, b = Math.min(f1, a + per);
    if (a >= b) break;
    const file = out.replace(/\.mp4$/, `.part${k}.mp4`);
    parts.push(file);
    tasks.push(renderChunk(a, b, file, 'j' + k));
  }
  await Promise.all(tasks);
  const list = out.replace(/\.mp4$/, '.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
  for (const p of parts) fs.unlinkSync(p);
  fs.unlinkSync(list);
}
console.log(`wrote ${out} in ${((Date.now() - T0) / 60000).toFixed(1)} min`);

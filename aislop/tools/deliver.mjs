// Delivery copies (small enough for GitHub and the chat), made from the rendered master chapters in out/film/.
//   node tools/deliver.mjs video   [--only 00,01]   1080p30 H.264 per chapter -> deliver/video/ (each file < 95 MB, long chapters split)
//   node tools/deliver.mjs audio                    SE stem (FLAC + AAC) and subtitles -> deliver/audio/, deliver/
//   node tools/deliver.mjs preview --voice n.mp3    720p previews with narration + SE, in parts under 27 MiB -> out/film/preview/
//   node tools/deliver.mjs complete --voice n.mp3 [--h 720] [--size 95] [--out f.mp4]   the whole film with sound in ONE file of at most --size MB
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [cmd, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const film = path.resolve('out/film');
const out = path.resolve('deliver');
const chapters = JSON.parse(fs.readFileSync(path.join(film, 'chapters.json'), 'utf8'));
const ff = (a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const MB = (f) => fs.statSync(f).size / 1e6;
const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const LIMIT = 95;

if (cmd === 'video') {
  const dir = path.join(out, 'video');
  fs.mkdirSync(dir, { recursive: true });
  const only = args.only ? new Set(args.only.split(',')) : null;
  for (const c of chapters) {
    if (only && !only.has(c.n)) continue;
    const src = path.join(film, c.file);
    if (!fs.existsSync(src + '.ok')) { console.log(`ch${c.n}: not rendered yet`); continue; }
    const base = c.file.replace(/\.mp4$/, '');
    if (fs.readdirSync(dir).some((f) => f.startsWith(base))) { console.log(`ch${c.n}: already delivered`); continue; }
    const D = dur(src);
    // x264 at CRF 20 with a 10 Mb/s ceiling: roughly 6-9 Mb/s for this material. Split long chapters so every file stays under the limit.
    const parts = Math.max(1, Math.ceil((D * 10.5) / 8 / LIMIT));
    const frames = Math.round(D * 30), per = Math.ceil(frames / parts);
    const done = [];  // all parts of a chapter appear together, once every part is complete
    for (let k = 0; k < parts; k++) {
      const a = k * per, b = Math.min(frames, a + per);
      const name = parts > 1 ? `${base}_${'abcdefgh'[k]}.mp4` : `${base}.mp4`;
      const dst = path.join(dir, name);
      // encode under a temporary name and rename when complete, so a half-written file is never picked up
      ff(['-i', src, '-vf', `trim=start_frame=${a}:end_frame=${b},setpts=PTS-STARTPTS`, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '10M', '-bufsize', '20M',
        '-pix_fmt', 'yuv420p', '-g', '60', ...BT709, '-movflags', '+faststart', '-f', 'mp4', dst + '.tmp']);
      done.push(dst);
      console.log(`ch${c.n}: ${name} ${(b - a)} frames, ${MB(dst + '.tmp').toFixed(1)} MB`);
    }
    for (const dst of done) fs.renameSync(dst + '.tmp', dst);
  }
} else if (cmd === 'audio') {
  const dir = path.join(out, 'audio');
  fs.mkdirSync(dir, { recursive: true });
  const se = path.join(film, 'aislop_se.wav');
  ff(['-i', se, '-c:a', 'flac', '-sample_fmt', 's32', '-compression_level', '8', path.join(dir, 'aislop_se.flac')]);
  ff(['-i', se, '-c:a', 'aac', '-b:a', '192k', path.join(dir, 'aislop_se.m4a')]);
  fs.copyFileSync(path.join(film, 'aislop_narration.srt'), path.join(out, 'aislop_narration.srt'));
  fs.writeFileSync(path.join(out, 'chapters.json'), JSON.stringify(chapters.map(({ n, jp, t0, t1 }) => ({ n, jp, start: +t0.toFixed(3), end: +t1.toFixed(3) })), null, 2));
  for (const f of ['audio/aislop_se.flac', 'audio/aislop_se.m4a', 'aislop_narration.srt']) console.log(f, MB(path.join(out, f)).toFixed(1), 'MB');
} else if (cmd === 'preview') {
  const voice = args.voice;
  const dir = path.join(film, 'preview');
  fs.mkdirSync(dir, { recursive: true });
  const master = path.join(film, 'aislop_visual_1080p30.mp4');
  const groups = (args.groups || '00-04,05-07,08-10,11-13,14-15').split(',').map((g) => g.split('-'));
  const se = path.join(film, 'aislop_se.wav');
  for (const [i, [a, b]] of groups.entries()) {
    const c0 = chapters.find((c) => c.n === a), c1 = chapters.find((c) => c.n === b);
    const t0 = c0.t0, t1 = c1.t1, D = t1 - t0;
    const kbps = Math.floor((27 * 8 * 1024 * 1024) / D / 1000) - 96 - 12;  // 27 MiB minus audio and container overhead
    const dst = path.join(dir, `aislop_preview_${i + 1}_ch${a}-${b}.mp4`);
    const af = `[1:a]atrim=${t0}:${t1},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,asplit=2[v1][v2];` +
      `[2:a]atrim=${t0}:${t1},asetpts=PTS-STARTPTS[s];[s][v2]sidechaincompress=threshold=0.03:ratio=3:attack=15:release=350[sd];` +
      `[v1][sd]amix=inputs=2:duration=longest:normalize=0,volume=4dB,alimiter=limit=0.84:attack=3:release=60[a]`;
    const vf = `[0:v]trim=${t0}:${t1},setpts=PTS-STARTPTS,hqdn3d=1.5:1.5:4:4,scale=1280:720:flags=lanczos[v]`;
    const common = ['-i', master, '-i', voice, '-i', se, '-filter_complex', `${af};${vf}`, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${kbps}k`, '-pix_fmt', 'yuv420p', ...BT709];
    const log = path.join(dir, 'x264pass');
    ff([...common, '-pass', '1', '-passlogfile', log, '-c:a', 'aac', '-b:a', '96k', '-f', 'null', '-']);
    ff([...common, '-pass', '2', '-passlogfile', log, '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', dst]);
    console.log(`${path.basename(dst)}: ${D.toFixed(1)} s, ${kbps} kb/s, ${(fs.statSync(dst).size / 1048576).toFixed(1)} MiB`);
  }
} else if (cmd === 'complete') {
  // the finished film in ONE file: picture + narration + SFX, two-pass sized to a hard limit (GitHub: 100 MB per file, chat: 30 MiB)
  const voice = args.voice;
  const master = path.join(film, 'aislop_visual_1080p30.mp4');
  const se = path.join(film, 'aislop_se.wav');
  const H = Number(args.h || 720), W = Math.round(H * 16 / 9 / 2) * 2;
  const limitMB = Number(args.size || 95), abr = Number(args.abr || 96);
  const D = dur(master);
  const kbps = Math.floor((limitMB * 1e6 * 8) / D / 1000 * 0.985) - abr;  // 1.5 % headroom for the container
  const dst = path.resolve(args.out || `deliver/aislop_complete_${H}p.mp4`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const mono = args.mono === 'true';
  const af = '[1:a]aresample=48000,aformat=channel_layouts=stereo,apad,asplit=2[v1][v2];' +
    '[2:a]aresample=48000[s];[s][v2]sidechaincompress=threshold=0.03:ratio=3:attack=15:release=350[sd];' +
    `[v1][sd]amix=inputs=2:duration=first:normalize=0,volume=4dB,alimiter=limit=0.84:attack=3:release=60${mono ? ',pan=mono|c0=0.5*c0+0.5*c1' : ''}[a]`;
  const vf = `[0:v]hqdn3d=2:2:5:5,scale=${W}:${H}:flags=lanczos[v]`;
  const common = ['-i', master, '-i', voice, '-i', se, '-filter_complex', `${af};${vf}`, '-map', '[v]', '-map', '[a]', '-t', D.toFixed(3),
    '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-b:v', `${kbps}k`, '-pix_fmt', 'yuv420p', '-g', '120', ...BT709];
  const log = dst + '.x264pass';
  const t0 = Date.now();
  ff([...common, '-pass', '1', '-passlogfile', log, '-c:a', 'aac', '-b:a', `${abr}k`, '-f', 'null', '-']);
  ff([...common, '-pass', '2', '-passlogfile', log, '-c:a', 'aac', '-b:a', `${abr}k`, '-movflags', '+faststart', '-f', 'mp4', dst + '.tmp']);
  fs.renameSync(dst + '.tmp', dst);
  for (const f of fs.readdirSync(path.dirname(dst))) if (f.startsWith(path.basename(log))) fs.unlinkSync(path.join(path.dirname(dst), f));
  console.log(`${path.basename(dst)}: ${W}x${H}, ${D.toFixed(2)} s, video ${kbps} kb/s, ${MB(dst).toFixed(1)} MB (${(fs.statSync(dst).size / 1048576).toFixed(1)} MiB) in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
} else {
  console.log('usage: node tools/deliver.mjs video|audio|preview|complete');
}

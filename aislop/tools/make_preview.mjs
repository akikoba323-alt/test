// Preview with sound: the visual master + narration + (optional) SFX stem, ducked under the voice and normalised for listening.
//   node tools/make_preview.mjs --voice narration.mp3 [--se out/film/aislop_se.wav] [--video out/film/aislop_visual_1080p30.mp4]
//                               [--h 720] [--crf 23] [--out out/film/aislop_preview_voice_se.mp4]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const video = path.resolve(args.video || 'out/film/aislop_visual_1080p30.mp4');
const voice = args.voice;
const se = args.se === 'none' ? null : path.resolve(args.se || 'out/film/aislop_se.wav');
const H = Number(args.h || 720), W = Math.round(H * 16 / 9);
const out = path.resolve(args.out || `out/film/aislop_preview_voice${se ? '_se' : ''}.mp4`);
if (!voice || !fs.existsSync(voice)) throw new Error('--voice <narration audio> is required');
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString());

const inputs = ['-i', video, '-i', voice, ...(se && fs.existsSync(se) ? ['-i', se] : [])];
const withSE = inputs.length === 6;
// voice at unity; SE ducked a little while the voice speaks; +3 dB make-up into a limiter (the mono narration sits at about -23 LUFS, -20 once spread to stereo)
const af = withSE
  ? '[1:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[v1][v2];' +
    '[2:a]aresample=48000[s];[s][v2]sidechaincompress=threshold=0.03:ratio=3:attack=15:release=350:makeup=1[sd];' +
    '[v1][sd]amix=inputs=2:duration=longest:normalize=0,volume=3dB,alimiter=limit=0.84:attack=3:release=60,apad[a]'
  : '[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=3dB,alimiter=limit=0.84:attack=3:release=60,apad[a]';
const vf = H === 1080 ? 'null' : `scale=${W}:${H}:flags=lanczos`;
const t0 = Date.now();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', af + `;[0:v]${vf}[v]`, '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', String(args.crf || 23), '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '192k', '-t', dur.toFixed(3), '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log(`wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(0)} MB) in ${((Date.now() - t0) / 60000).toFixed(1)} min`);

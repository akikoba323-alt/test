// Subtitles from the aligned narration: node tools/make_srt.mjs [--max 26] [--out out/film/aislop_narration.srt]
// Sentences are cut at punctuation into readable chunks; each chunk is timed from the per-character alignment.
import fs from 'node:fs';
import path from 'node:path';
import { norm } from '../src/engine/cues.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const MAX = Number(args.max || 26);
const out = path.resolve(args.out || 'out/film/aislop_narration.srt');
const tl = JSON.parse(fs.readFileSync('data/timeline.json', 'utf8'));

const len = (s) => Array.from(s).length;
// split a sentence after 、。？！ (a closing bracket stays with its punctuation; a short fragment inside a quote is not split off)
function phrases(text) {
  const out = []; let cur = '', depth = 0;
  const chars = Array.from(text);
  chars.forEach((c, i) => {
    cur += c;
    if (c === '「' || c === '『') depth++;
    if (c === '」' || c === '』') depth = Math.max(0, depth - 1);
    const next = chars[i + 1];
    if (c === '、' && depth > 0 && len(cur) < 8) return;
    if ('、。？！?!'.includes(c) && next !== '」' && next !== '』') { out.push(cur); cur = ''; }
  });
  if (cur) out.push(cur);
  return out;
}
// where a too-long phrase may be cut: after a closing bracket or a particle, or before an opening bracket;
// never inside Latin words or numbers, never so that the next line starts with a particle or punctuation
const PART = 'はがをにでともへやの';
function bestCut(a) {
  const mid = Math.min(a.length / 2, MAX - 2);
  let best = -1, bestScore = -1e9;
  for (let i = 3; i < a.length - 3; i++) {
    const c = a[i], n = a[i + 1];
    if (/[A-Za-z0-9.,％%]/.test(c) && /[A-Za-z0-9.,％%]/.test(n)) continue;
    if (PART.includes(n) || '、。」』？！）'.includes(n)) continue;
    let q = 0;
    const lat = (x) => /[A-Za-z0-9]/.test(x);
    if (c === '」' || c === '』') q = 3; else if (n === '「' || n === '『') q = 3; else if (PART.includes(c)) q = 2; else if (lat(c) !== lat(n) && n !== ' ' && c !== ' ') q = 1; else if (/[ぁ-ん]/.test(c) && /[一-龯ァ-ヶ]/.test(n)) q = 0.5;
    if (q <= 0) continue;
    const score = q * 3 - Math.abs(i + 1 - mid) * 0.6 - (i + 1 > MAX ? 50 : 0);
    if (score > bestScore) { bestScore = score; best = i + 1; }
  }
  return best > 0 ? best : Math.ceil(a.length / 2);
}
// greedy packing of phrases into chunks of at most MAX chars; long phrases are cut at natural points
function chunks(text) {
  const res = []; let cur = '';
  for (let p of phrases(text)) {
    while (len(p) > MAX) {
      if (cur) { res.push(cur); cur = ''; }
      const a = Array.from(p), cut = bestCut(a);
      res.push(a.slice(0, cut).join('')); p = a.slice(cut).join('');
    }
    if (len(cur) + len(p) > MAX && cur) { res.push(cur); cur = ''; }
    cur += p;
  }
  if (cur) res.push(cur);
  return res;
}
const clean = (s) => s.replace(/[、]$/u, '');
const events = [];
for (const s of tl.sentences) {
  let off = 0;
  const parts = chunks(s.text);
  parts.forEach((c, i) => {
    const q = norm(c);
    let k = q ? s.norm.indexOf(q, off) : -1;
    let t0, t1;
    if (k >= 0 && s.ct && s.ct.length) {
      t0 = s.ct[k]; t1 = s.ct[Math.min(s.ct.length - 1, k + q.length - 1)] + 0.18; off = k + q.length;
    } else {
      // fall back to proportional timing inside the sentence
      const a = parts.slice(0, i).reduce((n, x) => n + len(x), 0), b = a + len(c), n = len(s.text);
      t0 = s.start + (s.end - s.start) * (a / n); t1 = s.start + (s.end - s.start) * (b / n);
    }
    if (i === 0) t0 = Math.min(t0, s.start);
    if (i === parts.length - 1) t1 = Math.max(t1, s.end);
    events.push({ t0, t1, text: clean(c) });
  });
}
// tidy: minimum duration, no overlaps, close tiny gaps
for (let i = 0; i < events.length; i++) {
  const e = events[i], nx = events[i + 1];
  e.t1 = Math.max(e.t1, e.t0 + 0.9);
  if (nx) { if (nx.t0 - e.t1 < 0.35) e.t1 = nx.t0 - 0.04; if (e.t1 > nx.t0 - 0.04) e.t1 = nx.t0 - 0.04; }
}
const tc = (t) => { const ms = Math.max(0, Math.round(t * 1000)); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`; };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, events.map((e, i) => `${i + 1}\n${tc(e.t0)} --> ${tc(e.t1)}\n${e.text}\n`).join('\n'));
console.log(`wrote ${out}: ${events.length} events, longest ${Math.max(...events.map((e) => len(e.text)))} chars`);

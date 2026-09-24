// Narration timeline: sentence and phrase-level cue times (seconds, global).
const DIG = '〇一二三四五六七八九';
function small(n) {
  let s = '';
  for (const [v, u] of [[1000, '千'], [100, '百'], [10, '十']]) {
    const d = Math.floor(n / v); n %= v;
    if (d) s += (d === 1 ? '' : DIG[d]) + u;
  }
  if (n) s += DIG[n];
  return s;
}
function num2k(n) {
  if (n === 0) return '零';
  let s = '';
  for (const [v, u] of [[1e8, '億'], [1e4, '万']]) {
    const d = Math.floor(n / v); n %= v;
    if (d) s += small(d) + u;
  }
  return s + small(n);
}
const PUNCT = new Set(Array.from('、。「」『』？！?!・（）()　 ,.，．:：;；-―—…"\'“”'));
export function norm(str) {
  str = str.replace(/(\d+)\.(\d+)/g, (m, a, b) => num2k(+a) + '．' + num2k(+b)).replace(/\d+/g, (m) => num2k(+m));
  let out = '';
  for (const ch of str) {
    for (const c of ch.normalize('NFKC').toLowerCase()) if (!PUNCT.has(c) && c.trim()) out += c;
  }
  return out;
}

export class Cues {
  constructor(tl) {
    this.S = tl.sentences;
    this.duration = tl.duration;
  }
  // start time of sentence id, or of a phrase inside it (sub), plus optional 'end'
  at(id, sub, which = 'start') {
    const s = this.S[id];
    if (!s) throw new Error('no sentence ' + id);
    if (sub == null) return which === 'end' ? s.end : s.start;
    const q = norm(sub);
    const k = s.norm.indexOf(q);
    if (k < 0) { console.warn(`cue miss: #${id} "${sub}"`); return s.start; }
    if (which === 'end') return s.ct[Math.min(s.ct.length - 1, k + q.length - 1)] + 0.12;
    return s.ct[k];
  }
  end(id, sub) { return this.at(id, sub, 'end'); }
  text(id) { return this.S[id].text; }
}

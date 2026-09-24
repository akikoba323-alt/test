// Design tokens for the whole film.
// Semantics: SLOP (acid lime) = AI-generated / synthetic.  HUMAN (amber) = human work / trust.
// ALERT (red) = false / danger.  PAPER = neutral text.  INK = background.
export const C = {
  ink: '#0b0b0d',
  ink2: '#121216',
  panel: '#18181d',
  panel2: '#222229',
  line: '#2e2e37',
  mute: '#7c7c88',
  mute2: '#a3a3ad',
  paper: '#efebe3',
  paperDim: '#cfcac0',
  white: '#ffffff',
  slop: '#c6f432',
  slopDim: '#7d9a1f',
  slopDeep: '#3a4a0c',
  human: '#ffab3d',
  humanDim: '#b8741f',
  alert: '#ff3b30',
  alertDim: '#9e1f18',
  cyan: '#5fd7e8',
  violet: '#9d7bff',
  gold: '#e8c25a',
  // "slop" goo, fleshy processed tone
  goo: '#cdbfa8',
  gooDark: '#6f6454',
  pink: '#ff8fa3',
};

export const F = {
  // Japanese
  jp: 'NotoSansJP',
  jpHeavy: 'ZenKaku',
  dela: 'DelaGothic',
  mincho: 'ZenOldMincho',
  shippori: 'Shippori',
  serifJP: 'NotoSerifJP',
  dot: 'DotGothic',
  hand: 'Klee',
  hand2: 'Yomogi',
  pop: 'HachiMaru',
  maru: 'ZenMaru',
  mochiy: 'MochiyPop',
  brush: 'YujiSyuku',
  jpMono: 'MPlusCode',
  rampart: 'Rampart',
  train: 'TrainOne',
  reggae: 'Reggae',
  // Latin
  sans: 'Inter',
  mono: 'JBMono',
  grotesk: 'SpaceGrotesk',
  bebas: 'Bebas',
  anton: 'Anton',
  iserif: 'InstrumentSerif',
  garamond: 'Garamond',
  times: 'LibSerif',
  courier: 'CourierPrime',
  vt: 'VT323',
  pixel: 'PressStart',
  comic: 'ComicNeue',
  fraktur: 'Fraktur',
  playfair: 'Playfair',
  archivo: 'ArchivoBlack',
  oswald: 'Oswald',
  arabic: 'NotoArabic',
  thai: 'NotoThai',
  kr: 'Noto Sans CJK KR',
  sc: 'Noto Sans CJK SC',
};

// font stacks: Latin display fonts fall back to a Japanese face for kana/kanji
export function fs(family, fallback = 'NotoSansJP') {
  return `"${family}", "${fallback}", "Noto Sans CJK JP", sans-serif`;
}

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(h, a = 1) {
  const [r, g, b] = hexToRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}
export function mixHex(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  const r = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return `rgb(${r[0]},${r[1]},${r[2]})`;
}
export const W = 1920, H = 1080;
// keep critical content above this line: the creator's subtitles live below
export const SUB_TOP = 890;

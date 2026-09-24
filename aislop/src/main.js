// Page entry: loads fonts + data, builds the engine, exposes capture hooks for tools/shot.mjs and tools/render.mjs.
import { Engine } from './engine/engine.js';
import { Cues } from './engine/cues.js';
import { buildScenes } from './scenes/index.js';

const P = new URLSearchParams(location.search);
const W = Number(P.get('w') || 1920), H = Number(P.get('h') || 1080), FPS = Number(P.get('fps') || 30);

const FONT_LOADS = [
  '400 20px NotoSansJP', '700 20px NotoSansJP', '900 20px NotoSansJP', '400 20px NotoSerifJP', '900 20px NotoSerifJP',
  '20px DelaGothic', '20px DotGothic', '400 20px ZenKaku', '500 20px ZenKaku', '700 20px ZenKaku', '900 20px ZenKaku',
  '400 20px ZenOldMincho', '700 20px ZenOldMincho', '900 20px ZenOldMincho', '400 20px Shippori', '700 20px Shippori', '800 20px Shippori',
  '400 20px Klee', '600 20px Klee', '20px Yomogi', '20px HachiMaru', '400 20px MPlusCode', '700 20px MPlusCode', '700 20px ZenMaru', '900 20px ZenMaru',
  '20px MochiyPop', '20px YujiSyuku', '20px Rampart', '20px TrainOne', '20px Reggae',
  '400 20px Inter', '600 20px Inter', '800 20px Inter', '900 20px Inter', '400 20px JBMono', '700 20px JBMono', '400 20px SpaceGrotesk', '700 20px SpaceGrotesk',
  '20px Bebas', '20px Anton', '20px InstrumentSerif', 'italic 20px InstrumentSerif', '400 20px Garamond', 'italic 400 20px Garamond', '700 20px Garamond',
  '400 20px LibSerif', '700 20px LibSerif', 'italic 20px LibSerif', '400 20px CourierPrime', '700 20px CourierPrime', '20px VT323', '20px PressStart',
  '400 20px ComicNeue', '700 20px ComicNeue', '400 20px NotoArabic', '400 20px NotoThai', '20px Fraktur', '700 20px Playfair', '900 20px Playfair',
  '20px ArchivoBlack', '500 20px Oswald', '700 20px Oswald',
];

async function boot() {
  const t0 = performance.now();
  await Promise.all(FONT_LOADS.map((f) => document.fonts.load(f, 'あ漢A1').catch((e) => console.warn('font', f, e))));
  const [tl, audio] = await Promise.all([fetch('/data/timeline.json').then((r) => r.json()), fetch('/data/audio.json').then((r) => r.json())]);
  const cues = new Cues(tl);
  const eng = new Engine({ W, H, fps: FPS, cues, audio });
  eng.debugSubs = P.get('subs') === '1';
  document.body.appendChild(eng.canvas);
  const scenes = await buildScenes(eng);
  eng.setScenes(scenes);
  window.__eng = eng;
  window.__info = () => ({ duration: eng.duration, fps: FPS, frames: Math.ceil(eng.duration * FPS), scenes: eng.scenes.map((s) => ({ id: s.id, start: s.start, end: s.end })) });
  window.__shot = async (T, type = 'image/jpeg') => { eng.render(T); return eng.canvas.toDataURL(type, 0.92); };
  // Stream frames [i0,i1) as yuv420p over a WebSocket; rendering of frame n+1 overlaps the transfer of frame n.
  window.__renderRange = async (i0, i1, wsPort) => {
    const ws = new WebSocket('ws://127.0.0.1:' + wsPort);
    ws.binaryType = 'arraybuffer';
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let acked = 0;
    ws.onmessage = (m) => { acked = Number(m.data); };
    const stats = { t: 0, n: 0 };
    const size = W * H * 1.5;
    for (let i = i0; i < i1; i++) {
      const a = performance.now();
      const buf = eng.renderYUV(i / FPS, i);
      stats.t += performance.now() - a; stats.n++;
      ws.send(buf);
      while (ws.bufferedAmount > size * 3) await new Promise((r) => setTimeout(r, 4));
    }
    while (acked < i1 - i0) await new Promise((r) => setTimeout(r, 20));
    ws.close();
    return stats;
  };
  console.log(`boot ${((performance.now() - t0) / 1000).toFixed(1)}s, ${scenes.length} scenes, ${eng.duration.toFixed(1)}s`);
  window.__ready = true;
}
boot().catch((e) => { console.error('boot failed', e.stack || e); window.__failed = String(e.stack || e); });

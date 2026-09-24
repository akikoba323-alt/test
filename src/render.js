// Offline frame renderer for video export (?render=1&w=..&h=..&fps=..). Driven by tools/render.mjs.
import { Engine } from './engine.js';
import { Film } from './film.js';

export async function runRender(canvas, W, H, params) {
  const eng = new Engine(canvas, { offline: true, quality: params.get('q') || 'high' });
  await eng.init(() => {});
  eng.setSize(W, H);
  const film = new Film(eng, {});
  film.aspect = 2.39;
  film.build();
  const fps = Number(params.get('fps') || 30);
  // record cues with playback time + listener pose for the offline soundtrack
  const cues = [];
  film.cueListeners.push((c) => {
    const cam = eng.camera;
    const p = { ...c.p };
    if (p.pos && p.pos.isVector3) p.pos = [p.pos.x, p.pos.y, p.pos.z];
    cues.push({ P: film.pStep ?? film.P, name: c.name, p, cam: [cam.position.x, cam.position.y, cam.position.z], right: cam.matrixWorld.elements.slice(0, 3) });
  });
  const debris = [];
  let frame = 0;
  window.__info = () => ({ endP: film.endP, fps, frames: Math.ceil(film.endP * fps) });
  window.__renderFrame = async (i) => {
    const P = i / fps;
    while (frame < i) { frame++; film.pStep = frame / fps; film.update(1 / fps); for (const d of eng.debris.events) if (d.speed > 3.5) debris.push({ P: frame / fps, pos: [d.pos.x, d.pos.y, d.pos.z], mass: d.mass, speed: d.speed, kind: d.kind }); eng.debris.events.length = 0; }
    const cam = film.frame();
    eng.render(cam);
    return canvas.toDataURL('image/jpeg', 0.92);
  };
  window.__audioLog = () => ({ cues, debris, rates: Array.from({ length: Math.ceil(film.endP * 20) }, (_, k) => film.tm.rate(k / 20)), looks: Array.from({ length: Math.ceil(film.endP * 2) }, (_, k) => (film.lookTrack.sample(film.tm.W(k / 2)).amb || null)) });
  window.__ready = true;
}

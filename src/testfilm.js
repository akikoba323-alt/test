// Film review harness: ?test=film[&tw=1]  captures frames at playback (or world) times.
import { Engine } from './engine.js';
import { Film } from './film.js';

export async function runFilmTest(canvas, W, H, params) {
  const eng = new Engine(canvas, { offline: true, quality: params.get('q') || 'high' });
  await eng.init(() => {});
  eng.setSize(W, H);
  const film = new Film(eng, {});
  film.build();
  const worldTimes = params.get('tw') === '1';
  console.log('film', JSON.stringify({ endW: film.endW, endP: +film.endP.toFixed(2) }));
  window.__film = film;
  window.__captureAt = async (t) => {
    const P = worldTimes ? film.tm.P(t) : t;
    const Pw = Math.max(0, P - 1 / 60);
    if (Pw < film.P - 1e-6) film.seek(Pw);
    while (film.P < Pw - 1e-6) film.update(Math.min(1 / 60, Pw - film.P));
    // warm-up frame one tick earlier so motion blur uses a real previous frame
    eng.render(film.frame());
    while (film.P < P - 1e-6) film.update(Math.min(1 / 60, P - film.P));
    const cam = film.frame();
    eng.renderer.info.reset();
    eng.render(cam);
    console.log('frame', JSON.stringify({ P: +film.P.toFixed(3), W: +film.W.toFixed(3), shot: cam.shotName, calls: eng.renderer.info.render.calls, bodies: eng.debris.bodies.length }));
    return canvas.toDataURL('image/png');
  };
  // fighter trajectories (world times) for choreography checks
  window.__traj = (t0, t1, step) => {
    const out = [];
    film.seek(film.tm.P(t0));
    const B = ['hips', 'head', 'chest', 'hand.L', 'hand.R', 'foot.L', 'foot.R'];
    for (let w = t0; w <= t1 + 1e-6; w += step) {
      film.pTarget = film.tm.P(w);
      film.advanceTo(w, 1 / 90);
      film.P = film.tm.P(w); film.W = w;
      const rec = { w: +w.toFixed(3) };
      for (const [n, f] of [['k', eng.kai], ['g', eng.gou]]) rec[n] = Object.fromEntries(B.map((b) => [b, f.anim.bonePos[b].toArray().map((v) => +v.toFixed(3))]));
      out.push(rec);
    }
    return out;
  };
  window.__ready = true;
}

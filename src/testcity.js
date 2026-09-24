// City look-dev: ?test=city&cam=x,y,z,tx,ty,tz,fov
import * as THREE from 'three';
import { Engine } from './engine.js';

export async function runCityTest(canvas, W, H, params) {
  const eng = new Engine(canvas, { offline: true, quality: params.get('q') || 'high' });
  const t0 = performance.now();
  await eng.init((m, f) => console.log('init', m, f));
  console.log('init ms', Math.round(performance.now() - t0));
  eng.setSize(W, H);
  eng.kai.anim.track.key(0, { pos: [-18, 0, 2], yaw: 90, hipY: -0.06, hips: [0, -28, 0], stanceL: [0.13, 0, 0.24], stanceR: [-0.13, 0, -0.2], ikHandL: [0.12, 1.36, 0.36], ikHandR: [-0.1, 1.4, 0.22], ikHandLw: 1, ikHandRw: 1, look: 1 });
  eng.gou.anim.track.key(0, { pos: [18, 0, -2], yaw: -90, hipY: -0.08, hips: [0, 20, 0], stanceL: [0.2, 0, 0.25], stanceR: [-0.2, 0, -0.25], ikHandL: [0.3, 1.5, 0.45], ikHandR: [-0.3, 1.45, 0.3], ikHandLw: 1, ikHandRw: 1, look: 1 });
  for (let i = 0; i < 20; i++) { eng.kai.anim.evaluate(i / 60, 1 / 60); eng.gou.anim.evaluate(i / 60, 1 / 60); }
  const views = (params.get('cams') || '0,1.6,34,0,6,-20,40').split(';').map((s) => s.split(',').map(Number));
  window.__captureAt = async (t) => {
    const v = views[Math.round(t) % views.length];
    eng.camera.position.set(v[0], v[1], v[2]);
    eng.camera.lookAt(v[3], v[4], v[5]);
    eng.camera.fov = v[6] || 40;
    eng.camera.near = 0.1;
    eng.camera.far = 20000;
    eng.camera.updateProjectionMatrix();
    eng.time = 10;
    eng.city.wires.updateGeometry();
    eng.renderer.info.reset();
    eng.render({ dof: { focus: 30, aperture: 0 }, mb: { strength: 0 } });
    console.log('frame', JSON.stringify({ calls: eng.renderer.info.render.calls, tris: eng.renderer.info.render.triangles }));
    return canvas.toDataURL('image/png');
  };
  window.__stats = () => ({ calls: eng.renderer.info.render.calls, tris: eng.renderer.info.render.triangles, geos: eng.renderer.info.memory.geometries });
  window.__ready = true;
}

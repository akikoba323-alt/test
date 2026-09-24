// Destruction look-dev: ?test=fx&cams=...  steps the world at 60 Hz between captures.
import * as THREE from 'three';
import { Engine } from './engine.js';
import { PT } from './fx/particles.js';

export async function runFxTest(canvas, W, H, params) {
  const eng = new Engine(canvas, { offline: true, quality: params.get('q') || 'high' });
  await eng.init(() => {});
  eng.setSize(W, H);
  const k = eng.kai.anim.track, g = eng.gou.anim.track;
  k.key(0, { pos: [-18, 0, 2], yaw: 90, hipY: -0.06, hips: [0, -28, 0], stanceL: [0.13, 0, 0.24], stanceR: [-0.13, 0, -0.2], ikHandL: [0.12, 1.36, 0.36], ikHandR: [-0.1, 1.4, 0.22], ikHandLw: 1, ikHandRw: 1, look: 1 });
  g.key(0, { pos: [18, 0, -2], yaw: -90, hipY: -0.08, hips: [0, 20, 0], stanceL: [0.2, 0, 0.25], stanceR: [-0.2, 0, -0.25], ikHandL: [0.3, 1.5, 0.45], ikHandR: [-0.3, 1.45, 0.3], ikHandLw: 1, ikHandRw: 1, look: 1 });
  const events = [
    { t: 0.3, fn: () => {
      const p = new THREE.Vector3(0, 0.1, 0);
      eng.fx.groundSlam(p, 1.0);
      eng.fx.flash(0.6, 0.08);
      for (const car of eng.city.cars.slice(0, 6)) {
        const d = car.mesh.position.clone().sub(p); const dist = d.length();
        if (dist < 45) eng.debris.addProp(car.mesh, car.half, car.mass, { vel: d.normalize().multiplyScalar(40 / Math.max(dist, 8) * 6).setY(8 + 40 / dist), spin: new THREE.Vector3(Math.random() * 3, Math.random() * 2, Math.random() * 3) });
      }
      eng.city.wires.blast(p, 60, 12);
    } },
    { t: 0.5, fn: () => {
      // blast into the T1 lobby storefront
      const c = new THREE.Vector3(38, 2.5, -25.5);
      const hits = eng.city.querySphere(c.x, c.y, c.z, 5.5);
      for (const h of hits) eng.debris.breakElement(h.store, h.id, { impact: c, blast: { pos: c.clone().add(new THREE.Vector3(0, 0, 3)), speed: 16, radius: 4 }, jitter: 2 });
      eng.fx.hit(c, new THREE.Vector3(0, 0, -1), 1.0, 'heavy');
      eng.fx.crack(c, 7, { grow: 0.2 });
    } },
  ];
  let simT = 0;
  window.__captureAt = async (t) => {
    const views = (params.get('cams') || '').split(';').map((s) => s.split(',').map(Number));
    while (simT < t - 1e-6) {
      const dt = Math.min(1 / 60, t - simT);
      const t1 = simT + dt;
      for (const e of events) if (!e.done && e.t <= t1) { e.done = true; eng.time = e.t; e.fn(); }
      eng.stepWorld(t1, dt);
      simT = t1;
    }
    const v = views[Math.min(views.length - 1, Math.floor(t / 100))] || [10, 4, 40, 20, 3, -20, 50];
    eng.camera.position.set(v[0], v[1], v[2]); eng.camera.lookAt(v[3], v[4], v[5]); eng.camera.fov = v[6] || 50; eng.camera.near = 0.1; eng.camera.far = 20000; eng.camera.updateProjectionMatrix();
    eng.renderer.info.reset();
    eng.render({ dof: { focus: 30, aperture: 0 }, mb: { strength: 0.3 } });
    console.log('frame', t.toFixed(2), JSON.stringify({ calls: eng.renderer.info.render.calls, tris: eng.renderer.info.render.triangles, bodies: eng.debris.bodies.length }));
    return canvas.toDataURL('image/png');
  };
  window.__ready = true;
}

// 崩界 — the film. World-time choreography, camera, lighting and events.
import * as THREE from 'three';
import * as mv from './moves.js';
import { PT } from '../fx/particles.js';
import { act01 } from './acts/act01.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildScript(S, film) {
  const K = S.kai, G = S.gou;
  const E = S.e;

  // ============================================================================================
  // LIGHTING — color script
  S.look(0, { sunElev: 3.4, sunAz: -90, sunColor: [1.0, 0.58, 0.3], sunIntensity: 4.6, cloudCover: 0.42, night: 0.15, exposure: 1.75, envIntensity: 1.25, fogDensity: 0.0014, sunScatter: 0.9,
    grade: { sat: 1.06, contrast: 1.1, temp: 0.04, lift: [0.0, 0.004, 0.014], gain: [1.03, 1.0, 0.97], splitShadow: [-0.14, 0.03, 0.24], splitHigh: [0.2, 0.07, -0.1] } });
  S.look(10.9, { fogDensity: 0.0014 });
  S.look(11.2, { fogDensity: 0.0009, sunScatter: 0.7 });
  S.look(29, { sunElev: 2.8, sunColor: [1.0, 0.5, 0.24] });

  const a1 = act01(S, film);
  const act1End = a1.end;

  S.finish(act1End + 2);
}

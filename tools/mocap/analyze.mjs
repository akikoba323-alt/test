// Mocap exploration: per clip, sample joint world positions at a fixed rate and detect strike
// events (hand/foot speed peaks with extension), jumps and contacts. Writes JSON for the
// stick-figure contact sheets (tools/mocap/strip.py).
//   node tools/mocap/analyze.mjs <rawDir> <outDir> [ids...]
import fs from 'node:fs';
import path from 'node:path';
import { parseBVH, fkFrame } from './bvh.mjs';

const [rawDir, outDir, ...ids] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const files = (ids.length ? ids.map((i) => i + '.bvh') : fs.readdirSync(rawDir).filter((f) => f.endsWith('.bvh'))).sort();
const KEY = ['Hips', 'Spine1', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'Neck1'];
for (const file of files) {
  const bvh = parseBVH(fs.readFileSync(path.join(rawDir, file), 'utf8'));
  const rate = 30, step = Math.max(1, Math.round(1 / (rate * bvh.dt)));
  const Q = [], P = [];
  const idx = KEY.map((k) => bvh.byName[k]?.index ?? -1);
  // scale: leg length hip->ankle from offsets
  const off = (n) => bvh.byName[n].offset;
  const len = (o) => Math.hypot(o[0], o[1], o[2]);
  const leg = len(off('LeftLeg')) + len(off('LeftFoot'));
  const s = 0.88 / leg; // metres for a 0.88 m thigh+shin
  const frames = [];
  for (let f = 0; f < bvh.nFrames; f += step) {
    fkFrame(bvh, f, Q, P);
    frames.push(idx.map((i) => (i < 0 ? [0, 0, 0] : [+(P[i].x * s).toFixed(3), +(P[i].y * s).toFixed(3), +(P[i].z * s).toFixed(3)])));
  }
  // speeds of end effectors relative to hips (strikes) and absolute hips speed
  const ee = { LH: 5, RH: 8, LF: 11, RF: 15 };
  const events = [];
  const dtS = step * bvh.dt;
  for (const [k, j] of Object.entries(ee)) {
    const sp = frames.map((fr, i) => {
      if (i === 0 || i === frames.length - 1) return 0;
      const a = frames[i - 1][j], b = frames[i + 1][j], ha = frames[i - 1][0], hb = frames[i + 1][0];
      return Math.hypot(b[0] - a[0] - (hb[0] - ha[0]), b[1] - a[1] - (hb[1] - ha[1]), b[2] - a[2] - (hb[2] - ha[2])) / (2 * dtS);
    });
    for (let i = 2; i < sp.length - 2; i++) {
      if (sp[i] > 4.0 && sp[i] >= sp[i - 1] && sp[i] >= sp[i + 1] && sp[i] >= sp[i - 2] && sp[i] >= sp[i + 2]) {
        // extension after the peak: distance from the hips at the next local max of distance
        let best = i, bd = 0;
        for (let m = i; m < Math.min(sp.length, i + 8); m++) {
          const d = Math.hypot(frames[m][j][0] - frames[m][0][0], frames[m][j][1] - frames[m][0][1], frames[m][j][2] - frames[m][0][2]);
          if (d > bd) { bd = d; best = m; }
        }
        events.push({ limb: k, t: +(i * dtS).toFixed(2), peak: +sp[i].toFixed(1), ext: +(best * dtS).toFixed(2), reach: +bd.toFixed(2), h: frames[best][j][1] });
      }
    }
  }
  events.sort((a, b) => a.t - b.t);
  const hipsY = frames.map((f) => f[0][1]);
  const out = { file, dt: dtS, n: frames.length, dur: +(frames.length * dtS).toFixed(2), keys: KEY, frames, events, hipsMin: Math.min(...hipsY), hipsMax: Math.max(...hipsY) };
  fs.writeFileSync(path.join(outDir, file.replace('.bvh', '.json')), JSON.stringify(out));
  console.log(file, 'dur', out.dur, 'events', events.map((e) => `${e.limb}@${e.t}(${e.peak}m/s,h${e.h})`).join(' ').slice(0, 400));
}

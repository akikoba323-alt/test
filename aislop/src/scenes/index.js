// Scene list for the whole film (chapters in order).
import { openScenes } from './c00_open.js';
import { defineScenes } from './c01_define.js';
import { scaleScenes } from './c02_scale.js';
import { newsScenes } from './c03_news.js';
import { looksScenes } from './c04_looks.js';
import { videoScenes } from './c05_video.js';
import { econScenes } from './c06_econ.js';
import { musicScenes } from './c07_music.js';
import { bookScenes } from './c08_books.js';
import { courtScenes } from './c09_court.js';
import { scienceScenes } from './c10_science.js';
import { collapseScenes } from './c11_collapse.js';
import { doubtScenes } from './c12_doubt.js';
import { costScenes } from './c13_cost.js';

export async function buildScenes(eng) {
  const list = [...openScenes(eng), ...defineScenes(eng), ...scaleScenes(eng), ...newsScenes(eng), ...looksScenes(eng), ...videoScenes(eng), ...econScenes(eng), ...musicScenes(eng), ...bookScenes(eng), ...courtScenes(eng), ...scienceScenes(eng), ...collapseScenes(eng), ...doubtScenes(eng), ...costScenes(eng)];
  // temporary tail so the timeline covers the narration while chapters are in progress
  list.push({ id: 'END', start: eng.cues.at(167) - 0.3, hud: false, draw() {} });
  return list;
}

// Player application: boot, title screen, playback loop, audio, controls.
import * as THREE from 'three';
import { Engine, QUALITY } from './engine.js';
import { Film } from './film.js';
import { SoundEngine } from './audio/audio.js';

const $ = (id) => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

export async function runApp(canvas, params) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const qSel = $('q'), flashBox = $('flash'), sndBox = $('snd');
  qSel.value = params.get('q') || store.get('houkai.q') || 'auto';
  flashBox.checked = store.get('houkai.flash') === '1' || reduceMotion;
  sndBox.checked = store.get('houkai.snd') !== '0';
  const pickQuality = () => {
    if (qSel.value !== 'auto') return qSel.value;
    const mobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 600;
    return mobile ? 'low' : 'high';
  };
  let quality = pickQuality();
  const progress = (msg, f) => {
    const names = { textures: 'テクスチャ生成', city: '街区を構築', streets: '道路', buildings: '建造物', props: '街路設備', skyline: 'スカイライン', fighters: '人物をスカルプト', environment: '環境光', ready: '準備完了' };
    $('ptxt').textContent = (names[msg] || msg) + ' — ' + Math.round((f ?? 0) * 100) + '%';
    $('bar').firstElementChild.style.width = Math.round((f ?? 0) * 100) + '%';
  };
  const engine = new Engine(canvas, { quality });
  await engine.init(progress);
  const film = new Film(engine, { reduceShake: flashBox.checked });
  const resize = () => {
    const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight);
    engine.setSize(w * Math.min(devicePixelRatio || 1, quality === 'ultra' ? 2 : 1.25), h * Math.min(devicePixelRatio || 1, quality === 'ultra' ? 2 : 1.25));
    film.aspect = 2.39;
    engine.camera.aspect = w / h;
  };
  resize();
  addEventListener('resize', resize);
  film.build();
  // backdrop: the opening telephoto frame behind the title
  film.seek(0.9);
  const renderFrame = () => {
    const cam = film.frame();
    if (film.opts.reduceFlash) { cam.flash = 0; }
    const F = engine.fx.frameFx;
    if (film.opts.reduceFlash) { F.flash = (F.flash || 0) * 0.2; if (F.impact) F.impact = { mode: 1, amount: 0.25 }; }
    engine.render(cam);
  };
  renderFrame();
  progress('ready', 1);
  $('play').disabled = false;
  $('ptxt').textContent = '準備完了 — ' + (film.endP / 60 | 0) + '分' + Math.round(film.endP % 60) + '秒';

  // ---- audio
  let audio = null, sound = null, muted = !sndBox.checked;
  const startAudio = () => {
    if (audio) return;
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      sound = new SoundEngine(audio);
      sound.startAmbience(audio.currentTime + 0.05);
      sound.master.gain.value = muted ? 0 : 0.9;
    } catch { audio = null; }
  };
  film.cueListeners.push((c) => {
    if (!sound || muted) return;
    const p = { ...c.p };
    if (p.pos && p.pos.isVector3) p.pos = [p.pos.x, p.pos.y, p.pos.z];
    if (c.name === 'silence') { sound.silence(p.dur ?? 0.4, audio.currentTime); return; }
    sound.play(c.name, p, audio.currentTime);
  });

  // ---- playback state
  let playing = false, started = false, last = performance.now(), stepReq = 0;
  const hud = $('hud');
  const chapters = film.chapters;
  const track = $('track');
  for (const c of chapters) {
    const m = document.createElement('div');
    m.className = 'mark';
    m.style.left = (c.p / film.endP * 100) + '%';
    m.innerHTML = `<span>${c.title}</span>`;
    track.appendChild(m);
  }
  const toast = (t) => { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('on'), 1400); };
  const setSpeed = (v) => {
    film.speed = v;
    document.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === v)));
    toast('速度 ' + (v === 1 ? '1×' : v + '×'));
  };
  const setPlaying = (v) => { playing = v; $('bplay').textContent = v ? '❚❚' : '▶'; $('bplay').setAttribute('aria-label', v ? '一時停止' : '再生'); if (audio) (v ? audio.resume() : audio.suspend()).catch(() => {}); };
  const seekTo = async (P) => {
    toast('シーク中…');
    await new Promise((r) => setTimeout(r, 30));
    film.seek(Math.max(0, Math.min(film.endP - 0.05, P)));
    $('end').classList.remove('on');
    last = performance.now();
  };
  $('play').onclick = () => {
    quality = pickQuality();
    store.set('houkai.q', qSel.value); store.set('houkai.flash', flashBox.checked ? '1' : '0'); store.set('houkai.snd', sndBox.checked ? '1' : '0');
    film.opts.reduceFlash = flashBox.checked; film.opts.reduceShake = flashBox.checked;
    muted = !sndBox.checked;
    startAudio();
    $('intro').classList.add('gone');
    hud.hidden = false;
    started = true;
    film.seek(0);
    setPlaying(true);
    last = performance.now();
    wake();
  };
  $('bplay').onclick = () => setPlaying(!playing);
  $('bstep').onclick = () => { setPlaying(false); stepReq++; };
  document.querySelectorAll('[data-speed]').forEach((b) => (b.onclick = () => setSpeed(Number(b.dataset.speed))));
  $('bmute').onclick = () => { muted = !muted; $('bmute').setAttribute('aria-pressed', String(muted)); if (sound) sound.master.gain.value = muted ? 0 : 0.9; toast(muted ? 'ミュート' : '音声オン'); };
  $('bfs').onclick = () => { const el = document.documentElement; (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.())?.catch?.(() => {}); };
  $('replay').onclick = () => { seekTo(0).then(() => setPlaying(true)); };
  const trackSeek = (ev) => { const r = track.getBoundingClientRect(); seekTo(((ev.clientX - r.left) / r.width) * film.endP); };
  track.addEventListener('pointerdown', trackSeek);
  const chapterJump = (dir) => {
    const idx = chapters.findIndex((c, i) => (chapters[i + 1]?.p ?? 1e9) > film.P + 0.3);
    const target = chapters[Math.max(0, Math.min(chapters.length - 1, idx + dir))];
    if (target) seekTo(target.p);
  };
  addEventListener('keydown', (e) => {
    if (!started) return;
    if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
    else if (e.key === '.') { setPlaying(false); stepReq++; }
    else if (e.key === 'ArrowRight') chapterJump(1);
    else if (e.key === 'ArrowLeft') chapterJump(-1);
    else if (e.key === 's' || e.key === 'S') { const seq = [1, 0.5, 0.25, 0.1]; setSpeed(seq[(seq.indexOf(film.speed) + 1) % seq.length]); }
    else if (e.key === 'f' || e.key === 'F') $('bfs').onclick();
    else if (e.key === 'm' || e.key === 'M') $('bmute').onclick();
    wake();
  });
  // auto-hide controls
  let idleT = 0;
  const wake = () => { hud.classList.remove('idle'); idleT = performance.now(); };
  addEventListener('pointermove', wake);
  addEventListener('touchstart', wake, { passive: true });

  // ---- adaptive quality
  const frameTimes = [];
  let qLevel = ['ultra', 'high', 'medium', 'low'].indexOf(quality);
  const adapt = (ms) => {
    if (qSel.value !== 'auto' || !playing) return;
    frameTimes.push(ms);
    if (frameTimes.length < 90) return;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    frameTimes.length = 0;
    if (avg > 45 && qLevel < 3) {
      qLevel++;
      const next = ['ultra', 'high', 'medium', 'low'][qLevel];
      Object.assign(engine.q, QUALITY[next]);
      engine.post.q = engine.q;
      resize();
      toast('画質を自動調整: ' + ['最高', '高', '中', '低'][qLevel]);
    }
  };

  // ---- main loop
  const tc = $('tc'), wtc = $('wtc'), chapEl = $('chap'), fill = track.querySelector('.fill'), knob = track.querySelector('.knob');
  let lastChap = null, debrisBudget = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    const dtMs = now - last;
    last = now;
    const dt = Math.min(0.1, dtMs / 1000);
    if (started) {
      if (playing) film.update(dt);
      else if (stepReq > 0) { film.update(1 / 60 / Math.max(film.speed, 0.1)); stepReq--; }
      else film.update(0);
      if (film.P >= film.endP - 0.02 && playing) { setPlaying(false); $('end').classList.add('on'); }
    }
    renderFrame();
    // audio: listener, slow motion, debris clatter
    if (sound && started) {
      const cam = engine.camera;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      sound.setListener([cam.position.x, cam.position.y, cam.position.z], [right.x, right.y, right.z], [fwd.x, fwd.y, fwd.z]);
      sound.setSlow(film.tm.rate(film.P), audio.currentTime);
      const L = engine.look;
      if (L.amb) sound.setAmbience(L.amb, audio.currentTime);
      debrisBudget = Math.min(10, debrisBudget + dt * 60);
      const ev = engine.debris.events;
      ev.sort((a, b) => b.speed * Math.cbrt(b.mass + 1) - a.speed * Math.cbrt(a.mass + 1));
      for (const d of ev) {
        if (debrisBudget < 1) break;
        if (d.speed < 3.5) continue;
        debrisBudget--;
        if (!muted) sound.play('debris', { pos: [d.pos.x, d.pos.y, d.pos.z], mass: d.mass, speed: d.speed, kind: d.kind }, audio.currentTime);
      }
    }
    engine.debris.events.length = 0;
    // HUD
    if (started) {
      const P = film.P;
      const f = Math.floor(P * 24) % 24, sec = Math.floor(P) % 60, min = Math.floor(P / 60);
      tc.firstChild.nodeValue = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
      wtc.textContent = `W ${film.W.toFixed(2)}${film.tm.rate(P) < 0.9 ? '  ×' + film.tm.rate(P).toFixed(2) : ''}`;
      const pct = (P / film.endP) * 100;
      fill.style.width = pct + '%'; knob.style.left = pct + '%';
      track.setAttribute('aria-valuenow', String(Math.round(pct)));
      const ch = [...chapters].reverse().find((c) => c.p <= P + 0.01);
      if (ch && ch !== lastChap) { lastChap = ch; chapEl.innerHTML = `${ch.title} <small>${ch.sub}</small>`; }
      if (playing && performance.now() - idleT > 2600) hud.classList.add('idle');
      adapt(dtMs);
    }
  };
  requestAnimationFrame(loop);
  window.__film = film; window.__engine = engine;
}

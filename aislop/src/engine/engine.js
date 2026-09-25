// Scene scheduler + per-frame orchestration.
// A scene: { id, start (global s), trans: {type, d, dir, color}, look: obj | (t)=>obj, bg, setup(eng), draw(f), mblur: {n, shutter} }
// Scenes draw in a 1920x1080 design space; f.ctx is pre-scaled to the output size.
import { GL, THREE } from './gl.js';
import { Post, DEFAULT_LOOK, mixLook } from './post.js';
import { clamp } from './ease.js';
import { chapterTag, sourceTag, debugSub } from '../lib/hud.js';

export class Engine {
  constructor({ W = 1920, H = 1080, fps = 30, cues, audio }) {
    this.W = W; this.H = H; this.fps = fps; this.k = W / 1920;
    this.cues = cues; this.audio = audio;
    this.gl = new GL(W, H);
    this.post = new Post(this.gl);
    this.canvas = this.gl.canvas;
    this.slots = [0, 1].map((i) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      return { canvas: c, ctx, rt: this.gl.rt('slot' + i), id: i };
    });
    this.pixbuf = new Uint8Array(W * H * 4);
    this.frameNo = 0;
  }
  setScenes(list) {
    this.scenes = list.slice().sort((a, b) => a.start - b.start);
    for (let i = 0; i < this.scenes.length; i++) {
      const s = this.scenes[i];
      s.end = i + 1 < this.scenes.length ? this.scenes[i + 1].start : (s.end ?? this.cues.duration + 6);
      s.dur = s.end - s.start;
    }
    this.duration = this.scenes[this.scenes.length - 1].end;
  }
  indexAt(T) {
    const S = this.scenes;
    let lo = 0, hi = S.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m].start <= T) lo = m; else hi = m - 1; }
    return lo;
  }
  lookOf(S, t) {
    const l = typeof S.look === 'function' ? S.look(t, this) : S.look;
    return { ...DEFAULT_LOOK, ...(l || {}) };
  }
  render(T, frameNo = Math.round(T * this.fps), target = null) {
    this.frameNo = frameNo;
    const i = this.indexAt(T);
    const S = this.scenes[i];
    let A = S, B = null, p = 0, tr = null;
    const tin = S.trans;
    if (i > 0 && tin && tin.d > 0 && T < S.start + tin.d / 2) { A = this.scenes[i - 1]; B = S; tr = tin; p = (T - (S.start - tin.d / 2)) / tin.d; }
    const nx = this.scenes[i + 1];
    if (!B && nx && nx.trans && nx.trans.d > 0 && T >= nx.start - nx.trans.d / 2) { A = S; B = nx; tr = nx.trans; p = (T - (nx.start - nx.trans.d / 2)) / nx.trans.d; }
    p = clamp(p);
    this.drawScene(A, T, this.slots[0]);
    if (B) this.drawScene(B, T, this.slots[1]);
    const look = B ? mixLook(this.lookOf(A, T - A.start), this.lookOf(B, T - B.start), tr.type === 'cut' ? (p < 0.5 ? 0 : 1) : p) : this.lookOf(A, T - A.start);
    this.post.render(this.slots[0].rt.texture, B ? this.slots[1].rt.texture : null, tr, p, look, T, frameNo, target);
  }
  // render + pack to yuv420p; returns a fresh Uint8Array (W*H*1.5 bytes)
  renderYUV(T, frameNo) {
    const fin = this.gl.rt('final');
    this.render(T, frameNo, fin);
    const rt = this.post.packYUV(fin.texture);
    const buf = new Uint8Array(this.W * this.H * 1.5);
    this.gl.renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
    return buf;
  }
  ensure(S) {
    if (!S._ready) { S.setup?.(this); S._ready = true; }
  }
  drawScene(S, T, slot) {
    this.ensure(S);
    const gl = this.gl;
    const mb = S.mblur && (typeof S.mblur === 'function' ? S.mblur(T - S.start) : S.mblur);
    if (mb && mb.n > 1) {
      const acc = gl.rt('mb_acc', { float: true });
      const tmp = gl.rt('mb_tmp');
      gl.clear(acc, 0, 0, 0, 0);
      for (let k = 0; k < mb.n; k++) {
        const dt = ((k + 0.5) / mb.n - 0.5) * (mb.shutter ?? 0.5) / this.fps;
        this.drawOnce(S, T + dt, { ...slot, rt: tmp });
        gl.blit(tmp.texture, acc, { blend: 'add', opacity: 1 / mb.n });
      }
      gl.blit(acc.texture, slot.rt, { blend: 'replace' });
    } else this.drawOnce(S, T, slot);
  }
  drawOnce(S, T, slot) {
    const gl = this.gl;
    const t = T - S.start;
    const bg = new THREE.Color(S.bg || '#0b0b0d');
    gl.clear(slot.rt, bg.r, bg.g, bg.b, 1);
    const f = new Frame(this, S, slot, t, T);
    globalThis.__scene = S;
    S.draw(f);
    if (S.hud !== false) {
      const ctx = f.ctx;
      ctx.save(); ctx.setTransform(this.k, 0, 0, this.k, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
      const chp = Array.isArray(S.chapter) ? S.chapter.filter((c) => c.t0 <= T).pop() : S.chapter;
      if (chp) chapterTag(ctx, T - chp.t0, chp, { alpha: S.hudAlpha ? S.hudAlpha(t) : 1 });
      if (S.source) sourceTag(ctx, t - (S.sourceAt || 0), S.source, { alpha: S.hudAlpha ? S.hudAlpha(t) : 1 });
      ctx.restore();
    }
    if (this.debugSubs) {
      const cs = this.cues.S;
      let cur = null;
      for (const s of cs) if (s.start <= T && T <= s.end + 0.3) cur = s;
      if (cur) { const ctx = f.ctx; ctx.save(); ctx.setTransform(this.k, 0, 0, this.k, 0, 0); debugSub(ctx, `#${cur.id} ${cur.text}`); ctx.restore(); }
      const ctx = f.ctx; ctx.save(); ctx.setTransform(this.k, 0, 0, this.k, 0, 0); ctx.font = '600 24px JBMono'; ctx.fillStyle = '#ffe066'; ctx.fillText(`${S.id}  T=${T.toFixed(2)}  t=${t.toFixed(2)}`, 20, 1070); ctx.restore();
    }
    f.flush();
  }
  read() { return this.gl.read(this.pixbuf); }
}

export class Frame {
  constructor(eng, S, slot, t, T) {
    this.eng = eng; this.S = S; this.slot = slot; this.t = t; this.T = T;
    this.dur = S.dur; this.gl = eng.gl; this.W = 1920; this.H = 1080; this.fps = eng.fps;
    const ctx = slot.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, eng.W, eng.H);
    ctx.setTransform(eng.k, 0, 0, eng.k, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    ctx.letterSpacing = '0px';
    this.ctx = ctx;
    this.dirty = true;
  }
  // local time of a narration cue (sentence id [, phrase])
  c(id, sub) { return this.eng.cues.at(id, sub) - this.S.start; }
  ce(id, sub) { return this.eng.cues.end(id, sub) - this.S.start; }
  // narration loudness 0..1 at time offset
  voice(dt = 0) { const a = this.eng.audio; if (!a) return 0; const i = Math.round((this.T + dt) * a.fps); return a.env[Math.max(0, Math.min(a.env.length - 1, i))] || 0; }
  flush(opts = {}) {
    if (!this.dirty) return;
    const tex = this.gl.canvasTex(this.slot.canvas);
    this.gl.blit(tex, this.slot.rt, { blend: opts.blend || 'normal', opacity: opts.opacity ?? 1 });
    const ctx = this.ctx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.eng.W, this.eng.H); ctx.restore();
    this.dirty = false;
    this.dirty = true; // canvas state unknown after scene drawing; always upload
  }
  // draw a GL texture as a layer (flushes pending 2D first)
  tex(texture, o = {}) { this.flush(); this.gl.blit(texture, this.slot.rt, o); }
  // run a fullscreen material directly onto the scene target (uses material's blending)
  pass(mat) { this.flush(); this.gl.pass(mat, this.slot.rt); }
  // render a three.js scene (linear HDR) and composite it with a filmic curve
  three(scene, camera, o = {}) {
    this.flush();
    const gl = this.gl;
    const rt = gl.rt(o.rt || 'three_hdr' + (o.msaa ?? 4), { float: true, depth: true, msaa: o.msaa ?? 4 });
    gl.renderer.setRenderTarget(rt);
    const bg = o.clear || [0, 0, 0, 0];
    gl.renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), bg[3]);
    gl.renderer.clear(true, true, false);
    gl.renderer.render(scene, camera);
    if (o.returnTarget) return rt;
    gl.blit(rt.texture, this.slot.rt, { hdr: !o.ldr, exposure: o.exposure ?? 1, blend: o.blend || 'normal', opacity: o.opacity ?? 1 });
    return rt;
  }
  // copy current scene image into a named target, returns its texture
  snapshot(name = 'snap') {
    this.flush();
    const rt = this.gl.rt(name);
    this.gl.blit(this.slot.rt.texture, rt, { blend: 'replace' });
    return rt.texture;
  }
  // full-screen effect reading the current image (uniform 'src'), writing back
  fx(mat) {
    const src = this.snapshot('fx_src');
    mat.uniforms.src.value = src;
    this.gl.pass(mat, this.slot.rt);
  }
  // upload the current 2D canvas as a texture WITHOUT compositing it (for shader input); clears canvas
  grab2d(name = 'grab2d') {
    const tex = this.gl.canvasTex(this.slot.canvas);
    const rt = this.gl.rt(name);
    this.gl.clear(rt, 0, 0, 0, 0);
    this.gl.blit(tex, rt, { blend: 'replace' });
    const ctx = this.ctx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.eng.W, this.eng.H); ctx.restore();
    return rt.texture;
  }
}

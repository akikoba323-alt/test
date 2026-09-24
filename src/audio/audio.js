// Procedural sound design (Web Audio). Every sound is synthesized: layered transients, sub drops,
// filtered noise, inharmonic metal partials, granular debris, formant growls. Sounds are placed
// in 3D relative to the camera (gain, low-pass and propagation delay by distance, stereo pan),
// sent to a generated convolution reverb, and mixed through a limiter. Works with both a live
// AudioContext and an OfflineAudioContext (for rendering the video soundtrack).

export class SoundEngine {
  constructor(ctx) {
    this.ctx = ctx;
    const c = ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 8; this.comp.ratio.value = 5; this.comp.attack.value = 0.003; this.comp.release.value = 0.22;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -2; this.limiter.knee.value = 0; this.limiter.ratio.value = 20; this.limiter.attack.value = 0.001; this.limiter.release.value = 0.08;
    this.slowLP = c.createBiquadFilter();
    this.slowLP.type = 'lowpass'; this.slowLP.frequency.value = 20000; this.slowLP.Q.value = 0.5;
    this.duck = c.createGain();
    this.bus = c.createGain();
    this.bus.connect(this.slowLP);
    this.slowLP.connect(this.duck);
    this.duck.connect(this.comp);
    this.comp.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.connect(c.destination);
    // reverb send
    this.verb = c.createConvolver();
    this.verb.buffer = this.makeIR(2.6, 2.2);
    this.verbIn = c.createGain(); this.verbIn.gain.value = 0.5;
    this.verbIn.connect(this.verb); this.verb.connect(this.bus);
    this.bigVerb = c.createConvolver();
    this.bigVerb.buffer = this.makeIR(6.5, 1.4);
    this.bigIn = c.createGain(); this.bigIn.gain.value = 0.45;
    this.bigIn.connect(this.bigVerb); this.bigVerb.connect(this.bus);
    // noise buffers
    this.white = this.noiseBuffer('white', 3);
    this.pink = this.noiseBuffer('pink', 3);
    this.brown = this.noiseBuffer('brown', 4);
    this.listener = { pos: [0, 0, 0], right: [1, 0, 0], fwd: [0, 0, -1] };
    this.rateMul = 1;
    this.seed = 1;
  }

  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  noiseBuffer(kind, secs) {
    const c = this.ctx, n = Math.floor(c.sampleRate * secs);
    const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    let s = 12345;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 * 2 - 1; };
    for (let i = 0; i < n; i++) {
      const w = r();
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return b;
  }

  makeIR(secs, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * secs);
    const b = c.createBuffer(2, n, c.sampleRate);
    let s = 777;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 * 2 - 1; };
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / c.sampleRate;
        // early reflections off facades + diffuse tail
        let v = r() * Math.pow(1 - t / secs, decay) * Math.exp(-t * 1.2);
        for (const er of [0.011, 0.023, 0.041, 0.067, 0.097, 0.13]) if (Math.abs(t - er - ch * 0.003) < 0.0015) v += r() * 0.8 * Math.exp(-er * 8);
        d[i] = v * 0.6;
      }
    }
    return b;
  }

  setListener(pos, right, fwd) { this.listener.pos = pos; this.listener.right = right; this.listener.fwd = fwd; }

  // spatial output node for a world position; returns {input, delay}
  spatial(pos, when, opts = {}) {
    const c = this.ctx;
    const L = this.listener;
    let d = 1, pan = 0;
    if (pos) {
      const dx = pos[0] - L.pos[0], dy = pos[1] - L.pos[1], dz = pos[2] - L.pos[2];
      d = Math.max(0.5, Math.sqrt(dx * dx + dy * dy + dz * dz));
      pan = Math.max(-1, Math.min(1, (dx * L.right[0] + dy * L.right[1] + dz * L.right[2]) / d));
    }
    const ref = opts.ref ?? 12;
    const g = c.createGain();
    g.gain.value = (opts.gain ?? 1) * Math.min(1.4, ref / (ref + Math.max(0, d - 2) * (opts.roll ?? 1)));
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(400, 20000 / (1 + d / (opts.air ?? 60)));
    const p = c.createStereoPanner();
    p.pan.value = pan * 0.8;
    g.connect(lp); lp.connect(p); p.connect(this.bus);
    const send = c.createGain();
    send.gain.value = Math.min(1, 0.15 + d / 120) * (opts.verb ?? 1);
    p.connect(send); send.connect(opts.big ? this.bigIn : this.verbIn);
    // propagation delay (compressed so it reads without lagging too far behind the image)
    const delay = opts.noDelay ? 0 : Math.min(3.5, Math.max(0, d - 25) / 343 * (opts.delayScale ?? 0.85));
    return { input: g, t: when + delay, dist: d };
  }

  // ---- primitives --------------------------------------------------------------------
  env(param, t, a, peak, dcy, sustain = 0) {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + dcy);
  }
  noise(dst, t, dur, o = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = o.buffer || this.white;
    src.loop = true;
    src.playbackRate.value = (o.rate ?? 1) * this.rateMul;
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f0 ?? 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    f.Q.value = o.q ?? 1;
    const g = c.createGain();
    this.env(g.gain, t, o.a ?? 0.003, o.gain ?? 0.5, dur);
    src.connect(f); f.connect(g); g.connect(dst);
    src.start(t, this.rnd() * 2);
    src.stop(t + dur + (o.a ?? 0.003) + 0.05);
    return g;
  }
  tone(dst, t, dur, o = {}) {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = o.wave || 'sine';
    osc.frequency.setValueAtTime((o.f0 ?? 100) * this.rateMul, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(10, o.f1 * this.rateMul), t + (o.glide ?? dur));
    const g = c.createGain();
    this.env(g.gain, t, o.a ?? 0.002, o.gain ?? 0.5, dur);
    let node = osc;
    if (o.drive) { const ws = c.createWaveShaper(); ws.curve = this.curve(o.drive); node.connect(ws); node = ws; }
    node.connect(g); g.connect(dst);
    osc.start(t); osc.stop(t + dur + (o.a ?? 0.002) + 0.05);
    return g;
  }
  curve(k) {
    const n = 1024, cv = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; cv[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return cv;
  }
  // bundle of inharmonic partials (metal)
  metal(dst, t, dur, o = {}) {
    const base = o.f ?? 420;
    const ratios = o.ratios || [1, 2.76, 5.4, 8.93, 13.3, 1.51, 3.9];
    ratios.forEach((r, i) => this.tone(dst, t, dur * (1 - i * 0.08), { f0: base * r * (1 + (this.rnd() - 0.5) * 0.02), gain: (o.gain ?? 0.2) / (1 + i * 0.7), a: 0.001, wave: i < 2 ? 'triangle' : 'sine' }));
  }
  // granular debris rattle
  rattle(dst, t, dur, o = {}) {
    const n = Math.round((o.density ?? 30) * dur);
    for (let i = 0; i < n; i++) {
      const tt = t + Math.pow(this.rnd(), o.skew ?? 1.6) * dur;
      const f = (o.f ?? 2400) * (0.4 + this.rnd() * 1.4);
      this.noise(dst, tt, 0.012 + this.rnd() * 0.05, { f0: f, q: 2 + this.rnd() * 4, gain: (o.gain ?? 0.25) * (0.3 + this.rnd()), a: 0.0008 });
    }
  }

  // ---- sound library -------------------------------------------------------------------
  play(name, p = {}, when = this.ctx.currentTime) {
    const fn = this['s_' + name];
    if (!fn) return;
    try { fn.call(this, p, when); } catch (e) { /* ignore */ }
  }

  s_step(p, when) {
    const o = this.spatial(p.pos, when, { gain: p.heavy ? 0.8 : 0.35, ref: 8 });
    this.noise(o.input, o.t, p.heavy ? 0.12 : 0.05, { f0: p.heavy ? 180 : 900, q: 0.8, gain: 0.5, buffer: this.pink });
    if (p.heavy) this.tone(o.input, o.t, 0.25, { f0: 70, f1: 38, gain: 0.8 });
  }
  s_stomp(p, when) {
    const o = this.spatial(p.pos, when, { gain: 1.2, ref: 14 });
    this.tone(o.input, o.t, 0.5, { f0: 90, f1: 32, gain: 1.0, drive: 2 });
    this.noise(o.input, o.t, 0.2, { f0: 300, f1: 120, q: 0.7, gain: 0.7, buffer: this.brown, type: 'lowpass' });
    this.rattle(o.input, o.t + 0.02, 0.4, { density: 40, f: 1800, gain: 0.12 });
  }
  whoosh(o, t, dur, f0, f1, gain) {
    this.noise(o, t, dur, { f0, f1, q: 1.4, gain, a: dur * 0.45, buffer: this.pink });
  }
  s_whoosh(p, when) { const o = this.spatial(p.pos, when, { gain: 0.6, noDelay: true }); this.whoosh(o.input, o.t, 0.22, 500, 2400, 0.6); }
  s_whooshHeavy(p, when) {
    const o = this.spatial(p.pos, when, { gain: 1.1, noDelay: true });
    this.whoosh(o.input, o.t, 0.45, 180, 900, 0.9);
    this.tone(o.input, o.t + 0.1, 0.5, { f0: 55, f1: 40, gain: 0.5, a: 0.15 });
  }
  s_hit(p, when) {
    const s = p.strength ?? 0.5;
    const o = this.spatial(p.pos, when, { gain: 0.9 + s, noDelay: true });
    // snap transient + fleshy body + air
    this.noise(o.input, o.t, 0.03, { f0: 3500, q: 0.9, gain: 0.8, type: 'highpass' });
    this.tone(o.input, o.t, 0.18, { f0: 160 + 40 * s, f1: 60, gain: 0.9, drive: 3 });
    this.noise(o.input, o.t, 0.12, { f0: 700, f1: 250, q: 1.2, gain: 0.7, buffer: this.pink });
    this.tone(o.input, o.t, 0.35, { f0: 55, f1: 38, gain: 0.6 * s });
  }
  s_heavyHit(p, when) {
    const s = p.strength ?? 1;
    const o = this.spatial(p.pos, when, { gain: 1.5, noDelay: true, big: s > 1.2 });
    this.noise(o.input, o.t, 0.04, { f0: 2500, q: 0.7, gain: 1.0, type: 'highpass' });
    this.tone(o.input, o.t, 0.3, { f0: 220, f1: 70, gain: 1.0, drive: 6 });
    this.tone(o.input, o.t, 1.2 + s * 0.5, { f0: 62, f1: 26, glide: 1.0, gain: 1.2, drive: 1.5 });
    this.noise(o.input, o.t, 0.6, { f0: 400, f1: 90, q: 0.6, gain: 0.9, buffer: this.brown, type: 'lowpass' });
    this.noise(o.input, o.t + 0.01, 0.25, { f0: 1200, f1: 300, q: 1, gain: 0.6, buffer: this.pink });
  }
  s_block(p, when) {
    const s = p.strength ?? 0.6;
    const o = this.spatial(p.pos, when, { gain: 1.0 + s * 0.6, noDelay: true });
    this.metal(o.input, o.t, 0.5 + s * 0.4, { f: 380 + this.rnd() * 120, gain: 0.35 });
    this.noise(o.input, o.t, 0.05, { f0: 5000, q: 0.8, gain: 0.8, type: 'highpass' });
    this.tone(o.input, o.t, 0.25, { f0: 140, f1: 60, gain: 0.8, drive: 2 });
    this.noise(o.input, o.t + 0.02, 0.35, { f0: 2600, f1: 900, q: 3, gain: 0.25 });
  }
  s_clash(p, when) {
    const o = this.spatial(p.pos, when, { gain: 1.6, noDelay: true, big: true });
    this.metal(o.input, o.t, 1.8, { f: 260, gain: 0.45 });
    this.tone(o.input, o.t, 1.6, { f0: 70, f1: 28, glide: 1.4, gain: 1.4, drive: 2 });
    this.noise(o.input, o.t, 0.08, { f0: 3000, q: 0.5, gain: 1.2, type: 'highpass' });
    this.noise(o.input, o.t, 1.2, { f0: 600, f1: 80, q: 0.5, gain: 0.9, buffer: this.brown, type: 'lowpass' });
  }
  s_megaClash(p, when) {
    const o = this.spatial(p.pos, when, { gain: 2.0, noDelay: true, big: true });
    this.s_clash(p, when);
    // pressure wave, long sub, air rush, city-wide glass rain afterwards
    this.tone(o.input, o.t, 3.5, { f0: 48, f1: 22, glide: 3, gain: 1.6, drive: 1.2 });
    this.noise(o.input, o.t + 0.05, 2.5, { f0: 200, f1: 1800, q: 0.5, gain: 0.8, a: 0.3, buffer: this.pink });
    this.noise(o.input, o.t, 4, { f0: 90, q: 0.4, gain: 1.0, buffer: this.brown, type: 'lowpass' });
    this.rattle(o.input, o.t + 0.4, 3.0, { density: 60, f: 5000, gain: 0.15, skew: 2 });
  }
  s_launch(p, when) {
    const o = this.spatial(p.pos, when, { gain: 1.0 * (p.strength ?? 1) });
    this.tone(o.input, o.t, 0.4, { f0: 110, f1: 40, gain: 0.9, drive: 3 });
    this.noise(o.input, o.t, 0.3, { f0: 800, f1: 200, q: 0.7, gain: 0.8, buffer: this.pink });
    this.rattle(o.input, o.t + 0.05, 0.6, { density: 50, f: 2000, gain: 0.15 });
    this.whoosh(o.input, o.t + 0.02, 0.5, 300, 3000, 0.7);
  }
  s_skid(p, when) {
    const o = this.spatial(p.pos, when, { gain: 0.9 });
    this.noise(o.input, o.t, 0.7, { f0: 1800, f1: 600, q: 2, gain: 0.5, a: 0.02 });
    this.noise(o.input, o.t, 0.6, { f0: 250, q: 0.7, gain: 0.4, buffer: this.brown });
    this.rattle(o.input, o.t, 0.7, { density: 40, f: 3000, gain: 0.1 });
  }
  s_crater(p, when) {
    const s = p.strength ?? 1;
    const o = this.spatial(p.pos, when, { gain: 1.8 * Math.min(1.5, s), big: true, ref: 30 });
    this.tone(o.input, o.t, 2.2, { f0: 75, f1: 24, glide: 1.8, gain: 1.6, drive: 2.5 });
    this.noise(o.input, o.t, 0.08, { f0: 2000, q: 0.5, gain: 1.2, type: 'highpass' });
    this.noise(o.input, o.t, 1.6, { f0: 500, f1: 70, q: 0.5, gain: 1.2, buffer: this.brown, type: 'lowpass' });
    this.noise(o.input, o.t + 0.03, 0.5, { f0: 1500, f1: 400, q: 0.8, gain: 0.8, buffer: this.pink });
    this.rattle(o.input, o.t + 0.1, 2.2, { density: 70, f: 1500, gain: 0.22 });
  }
  s_crumble(p, when) {
    const s = p.strength ?? 0.5;
    const o = this.spatial(p.pos, when, { gain: 0.8 + s, ref: 20 });
    this.noise(o.input, o.t, 0.9 + s, { f0: 700, f1: 200, q: 0.7, gain: 0.8, buffer: this.pink });
    this.rattle(o.input, o.t, 1.2 + s, { density: 45, f: 1400, gain: 0.2 });
    this.tone(o.input, o.t, 0.6, { f0: 80, f1: 40, gain: 0.6 * s });
  }
  s_glassBurst(p, when) {
    const s = p.strength ?? 0.6;
    const o = this.spatial(p.pos, when, { gain: 0.5 + s * 0.6, ref: 18 });
    this.noise(o.input, o.t, 0.08, { f0: 6000, q: 0.6, gain: 0.8, type: 'highpass' });
    const n = 10 + Math.round(20 * s);
    for (let i = 0; i < n; i++) this.tone(o.input, o.t + this.rnd() * 0.6, 0.05 + this.rnd() * 0.18, { f0: 2500 + this.rnd() * 7000, gain: 0.05 + this.rnd() * 0.08, a: 0.0005 });
    this.rattle(o.input, o.t + 0.35, 1.3, { density: 25, f: 6000, gain: 0.12, skew: 1.3 });
  }
  s_crash(p, when) {
    const s = p.strength ?? 1;
    const o = this.spatial(p.pos, when, { gain: 1.4 * s, big: s > 1.2, ref: 20 });
    this.s_glassBurst({ pos: p.pos, strength: 1 }, when);
    this.tone(o.input, o.t, 1.3, { f0: 90, f1: 30, gain: 1.3, drive: 3 });
    this.noise(o.input, o.t, 1.2, { f0: 800, f1: 150, q: 0.6, gain: 1.0, buffer: this.pink });
    this.metal(o.input, o.t + 0.05, 0.8, { f: 180, gain: 0.2 });
    this.rattle(o.input, o.t + 0.1, 2.0, { density: 60, f: 1800, gain: 0.2 });
  }
  s_carImpact(p, when) {
    const o = this.spatial(p.pos, when, { gain: 1.2 });
    this.metal(o.input, o.t, 0.6, { f: 150, gain: 0.35, ratios: [1, 1.8, 2.7, 4.1, 6.3] });
    this.noise(o.input, o.t, 0.4, { f0: 900, f1: 300, q: 1, gain: 0.8, buffer: this.pink });
    this.tone(o.input, o.t, 0.5, { f0: 100, f1: 45, gain: 0.9, drive: 4 });
    this.s_glassBurst({ pos: p.pos, strength: 0.5 }, when + 0.02);
  }
  s_carKick(p, when) { this.s_carImpact(p, when); this.s_heavyHit({ pos: p.pos, strength: 0.8 }, when); }
  s_metalGroan(p, when) {
    const o = this.spatial(p.pos, when, { gain: 0.8 });
    const c = this.ctx;
    const osc = c.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, o.t); osc.frequency.linearRampToValueAtTime(95, o.t + 0.6); osc.frequency.linearRampToValueAtTime(60, o.t + 1.2);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 12; f.frequency.setValueAtTime(400, o.t); f.frequency.linearRampToValueAtTime(900, o.t + 1.2);
    const g = c.createGain(); this.env(g.gain, o.t, 0.1, 0.35, 1.3);
    osc.connect(f); f.connect(g); g.connect(o.input); osc.start(o.t); osc.stop(o.t + 1.5);
  }
  s_poleSnap(p, when) {
    const o = this.spatial(p.pos, when, { gain: 1.3 });
    this.metal(o.input, o.t, 1.2, { f: 210, gain: 0.35 });
    this.s_metalGroan(p, when);
    // electrical arcing: buzzy bursts
    for (let i = 0; i < 6; i++) this.tone(o.input, o.t + 0.1 + i * 0.13 + this.rnd() * 0.05, 0.07, { f0: 120, wave: 'sawtooth', gain: 0.25, drive: 8 });
    this.noise(o.input, o.t + 0.1, 0.9, { f0: 4000, q: 0.5, gain: 0.3, type: 'highpass' });
  }
  s_energyRise(p, when) {
    const o = this.spatial(null, when, { gain: 0.7, noDelay: true });
    const c = this.ctx;
    for (const [f0, f1] of [[110, 440], [165, 660], [220, 880]]) {
      const osc = c.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0, o.t); osc.frequency.exponentialRampToValueAtTime(f1, o.t + 1.1);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, o.t); lp.frequency.exponentialRampToValueAtTime(5000, o.t + 1.1);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, o.t); g.gain.linearRampToValueAtTime(0.09, o.t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, o.t + 1.4);
      osc.connect(lp); lp.connect(g); g.connect(o.input); osc.start(o.t); osc.stop(o.t + 1.5);
    }
    this.noise(o.input, o.t, 1.2, { f0: 3000, f1: 9000, q: 3, gain: 0.2, a: 0.8 });
  }
  s_energyHit(p, when) {
    const o = this.spatial(p.pos, when, { gain: 1.4, noDelay: true, big: true });
    this.s_heavyHit(p, when);
    this.tone(o.input, o.t, 0.8, { f0: 1800, f1: 120, gain: 0.35, wave: 'square', drive: 2 });
    this.noise(o.input, o.t, 0.5, { f0: 8000, f1: 2000, q: 1, gain: 0.4 });
  }
  s_roar(p, when) {
    const o = this.spatial(p.pos, when, { gain: 1.4, big: true, ref: 25 });
    const c = this.ctx;
    const osc = c.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, o.t); osc.frequency.linearRampToValueAtTime(120, o.t + 0.4); osc.frequency.linearRampToValueAtTime(85, o.t + 1.6);
    const lfo = c.createOscillator(); lfo.frequency.value = 28; const lg = c.createGain(); lg.gain.value = 12; lfo.connect(lg); lg.connect(osc.frequency);
    const ws = c.createWaveShaper(); ws.curve = this.curve(12);
    const g = c.createGain(); this.env(g.gain, o.t, 0.12, 0.5, 1.7);
    osc.connect(ws);
    for (const [f, q, gg] of [[600, 5, 1], [1200, 6, 0.6], [2600, 8, 0.3]]) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const fg = c.createGain(); fg.gain.value = gg; ws.connect(bp); bp.connect(fg); fg.connect(g);
    }
    g.connect(o.input);
    osc.start(o.t); osc.stop(o.t + 1.9); lfo.start(o.t); lfo.stop(o.t + 1.9);
    this.noise(o.input, o.t, 1.6, { f0: 250, q: 0.6, gain: 0.5, buffer: this.brown, a: 0.1 });
  }
  s_creak(p, when) {
    const o = this.spatial(p.pos, when, { gain: 0.6 });
    this.rattle(o.input, o.t, 0.5, { density: 30, f: 900, gain: 0.12 });
    this.tone(o.input, o.t, 0.6, { f0: 50, f1: 45, gain: 0.3 });
  }
  s_carAlarm(p, when) {
    const o = this.spatial(p.pos, when, { gain: 0.35, ref: 20 });
    for (let i = 0; i < 16; i++) this.tone(o.input, o.t + i * 0.28, 0.24, { f0: i % 2 ? 880 : 1180, wave: 'square', gain: 0.07, a: 0.01 });
  }
  s_debris(p, when) {
    const m = p.mass ?? 20, sp = p.speed ?? 5;
    const o = this.spatial(p.pos, when, { gain: Math.min(1, 0.06 + Math.cbrt(m) * 0.05) * Math.min(1, sp / 8), ref: 10 });
    if (p.kind === 'glass') { for (let i = 0; i < 4; i++) this.tone(o.input, o.t + this.rnd() * 0.05, 0.05, { f0: 3000 + this.rnd() * 5000, gain: 0.06 }); return; }
    if (p.kind === 'metal') { this.metal(o.input, o.t, 0.25, { f: 500 + this.rnd() * 900, gain: 0.08 }); return; }
    this.noise(o.input, o.t, 0.08 + Math.min(0.3, m / 800), { f0: 300 + 3000 / Math.cbrt(m + 1), q: 1, gain: 0.5, buffer: this.pink });
    if (m > 200) this.tone(o.input, o.t, 0.3, { f0: 70, f1: 40, gain: 0.3 });
  }

  // ---- ambience ----------------------------------------------------------------------
  startAmbience(when) {
    const c = this.ctx;
    const mk = (buf, type, f, q, gain) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = gain;
      s.connect(fl); fl.connect(g); g.connect(this.bus); s.start(when);
      return { s, fl, g };
    };
    this.amb = {
      wind: mk(this.pink, 'bandpass', 500, 0.5, 0.05),
      city: mk(this.brown, 'lowpass', 180, 0.5, 0.05),
      rumble: mk(this.brown, 'lowpass', 70, 0.7, 0.0),
      fire: mk(this.white, 'bandpass', 2500, 0.8, 0.0),
    };
  }
  setAmbience(p, when) {
    if (!this.amb) return;
    const t = when;
    this.amb.wind.g.gain.setTargetAtTime(p.wind ?? 0.05, t, 0.5);
    this.amb.city.g.gain.setTargetAtTime(p.city ?? 0.05, t, 0.8);
    this.amb.rumble.g.gain.setTargetAtTime(p.rumble ?? 0, t, 0.6);
    this.amb.fire.g.gain.setTargetAtTime(p.fire ?? 0, t, 0.6);
  }
  // slow motion: muffle and pitch down; silence: duck everything
  setSlow(rate, when) {
    const f = rate < 0.95 ? 600 + 9000 * Math.pow(rate, 0.8) : 20000;
    this.slowLP.frequency.setTargetAtTime(f, when, 0.05);
    this.rateMul = rate < 0.95 ? 0.55 + 0.45 * rate : 1;
  }
  silence(dur, when) {
    this.duck.gain.setTargetAtTime(0.05, when, 0.05);
    this.duck.gain.setTargetAtTime(1, when + dur, 0.02);
  }
}

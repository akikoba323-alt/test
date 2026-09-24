// Chapter 02 — scale of the web (1:32–2:17)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { fillRR, strokeRR, circle, line, grid, glow, marker, arrow } from '../lib/draw.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag } from '../lib/hud.js';
import { mat } from '../lib/glfx.js';
import { THREE } from '../engine/gl.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

export function scaleScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('02', '規模', 'SCALE', cue(17, 'そして') - 0.1);

  // ------------------------------------------------ S15: "量" typographic zoom-out
  const S15 = {
    id: 'S15', start: cue(17, 'そして') - 0.1, trans: { type: 'cut', d: 0 }, chapter: CH,
    look: { vign: 0.5, bloom: 0.3 },
    mblur: (t) => (t > 0.3 && t < 2.6 ? { n: 3, shutter: 0.6 } : null),
    draw(f) {
      const { ctx, t } = f;
      const z = keys(t, [[0, 1], [0.35, 1, E.linear], [2.6, 0.035, E.inOutCubic], [3.6, 0.03]]);
      const cell = 520 * z;
      const cols = Math.ceil(1920 / cell) + 2, rows = Math.ceil(1080 / cell) + 2;
      const tFun = cue(17, '笑えない') - f.S.start;
      ctx.save();
      ctx.font = `900 ${cell * 0.86}px ZenKaku, NotoSansJP`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const n = Math.min(cols * rows, 6000);
      for (let j = -Math.floor(rows / 2); j <= Math.floor(rows / 2); j++) for (let i = -Math.floor(cols / 2); i <= Math.floor(cols / 2); i++) {
        const x = 960 + i * cell, y = 540 + j * cell;
        const id = (i + 500) * 1000 + (j + 500);
        const lime = t > tFun && hash(id) < clamp((t - tFun) / 0.8) * 0.5;
        ctx.fillStyle = lime ? C.slop : (i === 0 && j === 0 ? C.paper : 'rgba(239,235,227,0.75)');
        if (cell > 3) ctx.fillText('量', x, y); else { ctx.fillRect(x - cell * 0.35, y - cell * 0.35, cell * 0.7, cell * 0.7); }
      }
      ctx.restore();
      if (t > 2.4) {
        const q = since(t, 2.4, 0.5, E.outExpo);
        ctx.save(); ctx.fillStyle = rgba(C.ink, 0.6 * q); ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
        text(ctx, 'ちょっと笑えない量', 960, 560, { family: F.jpHeavy, size: 110, weight: 900, color: C.paper, align: 'center', each: riseEach(q, 60, 0.3) });
      }
    },
  };

  // ------------------------------------------------ S16–S17: 490,000 pages (GPU unit chart)
  const N = 490000, SIDE = 700;
  let pts, ptsMat, ptsScene, ptsCam, binInfo;
  const PVERT = /* glsl */ `
  attribute vec2 aA; attribute vec2 aB; attribute vec2 aC; attribute vec2 aD; attribute float aAI; attribute float aR; attribute float aPost;
  uniform float mAB, mBC, mCD, lime, dimPre, px, zoom; uniform vec2 zc;
  varying vec3 vCol; varying float vAlpha;
  void main(){
    float d = aR * .35;
    vec2 p = mix(aA, aB, smoothstep(d, d + .65, mAB));
    p = mix(p, aC, smoothstep(d, d + .65, mBC));
    p = mix(p, aD, smoothstep(d, d + .65, mCD));
    p = zc + (p - zc) * zoom;
    gl_Position = vec4(p.x / 960. - 1., 1. - p.y / 540., 0., 1.);
    gl_PointSize = px * max(1., zoom * .8);
    float isL = aAI * smoothstep(aR * .8, aR * .8 + .2, lime);
    vec3 gray = vec3(.36, .36, .4);
    vCol = mix(gray, vec3(.776, .957, .196), isL);
    vAlpha = mix(1., .18, dimPre * (1. - aPost));
  }`;
  const PFRAG = /* glsl */ `varying vec3 vCol; varying float vAlpha; void main(){ gl_FragColor = vec4(vCol * vAlpha, 1.); }`;
  function buildPoints() {
    const r = rng(2026);
    const aA = new Float32Array(N * 2), aB = new Float32Array(N * 2), aC = new Float32Array(N * 2), aD = new Float32Array(N * 2);
    const aAI = new Float32Array(N), aR = new Float32Array(N), aPost = new Float32Array(N);
    // page "dates": weights grow over the years (schematic), 31 years 1996..2026 in half-year bins
    const bins = 62, w = [];
    for (let b = 0; b < bins; b++) w.push(Math.pow(1.075, b) * (b >= 53 ? 1.15 : 1));
    const W = w.reduce((a, b) => a + b, 0);
    const counts = w.map((v) => Math.floor(v / W * N));
    let rem = N - counts.reduce((a, b) => a + b, 0); counts[bins - 1] += rem;
    const postBin = 53; // 2022 H2
    const post = counts.slice(postBin).reduce((a, b) => a + b, 0);
    const aiPost = Math.round(post * 0.36), aiPre = 49000 - aiPost;
    const pre = N - post;
    // assign
    let i = 0;
    const cx = 960, cy = 470, S = 1.3; // grid geometry: SIDE x SIDE dots, 1.3px pitch
    const gx0 = cx - SIDE * S / 2, gy0 = cy - SIDE * S / 2;
    const hx0 = 250, hx1 = 1680, hy = 800, hmax = 560;
    const maxC = Math.max(...counts);
    binInfo = { hx0, hx1, hy, hmax, bins, postBin, counts, maxC };
    const binW = (hx1 - hx0) / bins;
    let preAIleft = aiPre, postAIleft = aiPost, preLeft = pre, postLeft = post;
    const order = [];
    for (let b = 0; b < bins; b++) {
      const hgt = counts[b] / maxC * hmax;
      for (let k = 0; k < counts[b]; k++, i++) {
        const isPost = b >= postBin;
        let ai = 0;
        if (isPost) { if (r() < postAIleft / postLeft) { ai = 1; postAIleft--; } postLeft--; }
        else { if (r() < preAIleft / preLeft) { ai = 1; preAIleft--; } preLeft--; }
        aAI[i] = ai; aR[i] = r(); aPost[i] = isPost ? 1 : 0;
        aD[i * 2] = hx0 + b * binW + r() * (binW - 3); aD[i * 2 + 1] = hy - r() * hgt;
        const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * 30;
        aA[i * 2] = cx + Math.cos(ang) * rad; aA[i * 2 + 1] = cy + Math.sin(ang) * rad;
        order.push(i);
      }
    }
    // grid B: random placement; grid C: AI dots at the bottom
    const shuffled = r.shuffle(order);
    shuffled.forEach((id, k) => { aB[id * 2] = gx0 + (k % SIDE) * S; aB[id * 2 + 1] = gy0 + Math.floor(k / SIDE) * S; });
    const byAI = shuffled.slice().sort((a, b) => aAI[a] - aAI[b]);
    byAI.forEach((id, k) => { aC[id * 2] = gx0 + (k % SIDE) * S; aC[id * 2 + 1] = gy0 + Math.floor(k / SIDE) * S; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    for (const [n, a, sz] of [['aA', aA, 2], ['aB', aB, 2], ['aC', aC, 2], ['aD', aD, 2], ['aAI', aAI, 1], ['aR', aR, 1], ['aPost', aPost, 1]]) g.setAttribute(n, new THREE.BufferAttribute(a, sz));
    ptsMat = new THREE.ShaderMaterial({ vertexShader: PVERT, fragmentShader: PFRAG, uniforms: { mAB: { value: 0 }, mBC: { value: 0 }, mCD: { value: 0 }, lime: { value: 0 }, dimPre: { value: 0 }, px: { value: 1.6 }, zoom: { value: 1 }, zc: { value: new THREE.Vector2(960, 540) } }, depthTest: false });
    pts = new THREE.Points(g, ptsMat); pts.frustumCulled = false;
    ptsScene = new THREE.Scene(); ptsScene.add(pts);
    ptsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  const S16 = {
    id: 'S16', start: cue(18, '二千二十六年八月') - 0.2, trans: { type: 'fade', d: 0.5 }, chapter: CH,
    source: 'Pew Research Center (2026.08.20) — 約49万の英語ウェブページ', sourceAt: 0.4,
    look: { vign: 0.4, bloom: 0.3, bloomThresh: 0.55 },
    setup() { buildPoints(); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tTen = cs(19, '十') - 0.4, tWhole = cs(20, '全体で') - 0.1, tOld = cs(21, 'ただし') - 0.1, tGPT = cs(22, 'ChatGPT') - 0.2, tThird = cs(22, '三分の一') - 0.4;
      const u = ptsMat.uniforms;
      u.px.value = Math.max(1, 1.15 * f.gl.W / 1920);
      u.mAB.value = clamp((t - 0.2) / 2.2);
      u.lime.value = clamp((t - tTen) / 1.4);
      u.mBC.value = clamp((t - tWhole) / 1.6) * (1 - clamp((t - tOld) / 0.01));
      u.mCD.value = clamp((t - tOld) / 1.8);
      u.dimPre.value = E.inOutCubic(clamp((t - tGPT) / 0.8));
      const zoomIn = E.inOutCubic(clamp((t - tGPT - 0.4) / 1.4));
      u.zoom.value = 1 + zoomIn * 1.5;
      const bi = binInfo; const binW = (bi.hx1 - bi.hx0) / bi.bins;
      const xPost = bi.hx0 + bi.postBin * binW;
      u.zc.value.set(lerp(960, 1560, zoomIn), lerp(540, 560, zoomIn));
      // when leaving the grid-C state for the histogram, blend C back to B first (mBC resets): handled by snapping mBC off at tOld (dots animate from C to D)
      if (t >= tOld) { u.mBC.value = 1; }
      f.three(ptsScene, ptsCam, { ldr: true, msaa: 0, clear: [0, 0, 0, 0] });
      // magnifier: the square is made of individual pages
      const magA = since(t, 1.8, 0.5, E.outBack) * (1 - since(t, tWhole - 0.4, 0.4));
      if (magA > 0.01 && t < tOld) {
        const zc0 = u.zc.value.clone(), z0 = u.zoom.value, px0 = u.px.value;
        const fx = 1000, fy = 560; // focus point inside the square
        u.zc.value.set(fx, fy); u.zoom.value = 16; u.px.value = Math.max(1, 13 * f.gl.W / 1920) / 12.8;
        const rt = f.three(ptsScene, ptsCam, { ldr: true, msaa: 0, clear: [0.05, 0.05, 0.06, 1], returnTarget: true, rt: 'mag_rt' });
        u.zc.value.copy(zc0); u.zoom.value = z0; u.px.value = px0;
        const bx = 1600, by = 735, bw = 330 * magA, bh = 330 * magA;
        // crop a window around the focus point of the zoomed render
        const cw = 330 / 1920, chh = 330 / 1080;
        f.tex(rt.texture, { rect: [(bx - bw / 2) / 1920, 1 - (by + bh / 2) / 1080, bw / 1920, bh / 1080], uvRect: [fx / 1920 - cw / 2, 1 - fy / 1080 - chh / 2, cw, chh] });
        ctx.save(); ctx.globalAlpha = magA;
        strokeRR(ctx, bx - bw / 2, by - bh / 2, bw, bh, 6, C.paper, 3);
        strokeRR(ctx, fx - 12, fy - 12, 24, 24, 3, C.paper, 2);
        line(ctx, fx + 12, fy - 12, bx - bw / 2, by - bh / 2, rgba(C.paper, 0.6), 2);
        line(ctx, fx + 12, fy + 12, bx - bw / 2, by + bh / 2, rgba(C.paper, 0.6), 2);
        text(ctx, '×16', bx + bw / 2 - 12, by - bh / 2 - 14, { family: F.mono, size: 22, weight: 700, color: C.paper, align: 'right' });
        text(ctx, '1ドット = 1ページ', bx, by + bh / 2 + 44, { family: F.jpHeavy, size: 28, weight: 700, color: C.paper, align: 'center' });
        ctx.restore();
      }
      // overlays
      const inGrid = t < tOld;
      const gxl = 960 - SIDE * 1.3 / 2 - 60, gxr = 960 + SIDE * 1.3 / 2 + 60;
      if (inGrid) {
        const cnt = N * E.outCubic(clamp((t - 0.2) / 2.2));
        text(ctx, 'ウェブページ', gxl - 10, 250, { family: F.jpHeavy, size: 34, weight: 700, color: C.mute2, align: 'right', alpha: since(t, 0.3, 0.4) });
        odometer(ctx, cnt, gxl - 10, 360, { family: F.bebas, size: 110, color: C.paper, align: 'right' });

        const lq = since(t, tTen, 0.5);
        if (lq > 0) {
          text(ctx, 'AIが書いた／大幅に', gxr + 10, 250, { family: F.jp, size: 28, weight: 700, color: C.slop, alpha: lq });
          text(ctx, 'AI編集した強い兆候', gxr + 10, 290, { family: F.jp, size: 28, weight: 700, color: C.slop, alpha: lq });
          const pct = 10 * E.outCubic(clamp((t - tTen) / 1.4));
          text(ctx, pct.toFixed(0) + '%', gxr + 10, 440, { family: F.bebas, size: 170, color: C.slop, alpha: lq });
          text(ctx, '≈ ' + fmt(49000 * E.outCubic(clamp((t - tTen) / 1.4))) + ' ページ', gxr + 14, 490, { family: F.mono, size: 26, color: C.mute2, alpha: lq });
        }
        if (t > tWhole) {
          const q = since(t, tWhole + 1.0, 0.4);
          const y = 470 + SIDE * 1.3 / 2;
          ctx.save(); ctx.globalAlpha = q;
          line(ctx, gxr - 40, y - 70 * 1.3, gxr - 40, y, C.slop, 3);
          text(ctx, '← 全体の10%', gxr - 20, y - 30, { family: F.jpHeavy, size: 34, weight: 900, color: C.slop });
          ctx.restore();
        }
      } else {
        // histogram axes
        const q = since(t, tOld + 0.8, 0.6);
        ctx.save(); ctx.globalAlpha = q * (1 - zoomIn * 0.85);
        line(ctx, bi.hx0 - 10, bi.hy + 8, bi.hx1 + 10, bi.hy + 8, rgba(C.paper, 0.6), 2);
        for (let y = 1996; y <= 2026; y += 5) { const x = bi.hx0 + ((y - 1996) * 2 + 0.5) * binW; line(ctx, x, bi.hy + 8, x, bi.hy + 20, rgba(C.paper, 0.6), 2); text(ctx, String(y), x, bi.hy + 52, { family: F.mono, size: 22, color: C.mute2, align: 'center' }); }
        text(ctx, 'ページの公開時期（模式図）', bi.hx0, 190, { family: F.jp, size: 26, weight: 500, color: C.mute2 });
        text(ctx, '全体では 10%', bi.hx0, 250, { family: F.jpHeavy, size: 46, weight: 900, color: C.paper });
        ctx.restore();
        // ChatGPT line
        const gq = since(t, tGPT - 0.2, 0.5);
        if (gq > 0) {
          const zx = (x) => u.zc.value.x + (x - u.zc.value.x) * u.zoom.value, zy = (y) => u.zc.value.y + (y - u.zc.value.y) * u.zoom.value;
          const X = zx(xPost - 1);
          ctx.save(); ctx.setLineDash([10, 8]); line(ctx, X, 140, X, zy(bi.hy) + 10, rgba(C.paper, 0.85 * gq), 3); ctx.restore();
          text(ctx, 'ChatGPT公開', X - 16, 190, { family: F.jpHeavy, size: 30, weight: 700, color: C.paper, align: 'right', alpha: gq });
          text(ctx, '2022.11.30', X - 16, 226, { family: F.mono, size: 22, color: C.mute2, align: 'right', alpha: gq });
          text(ctx, '以後', X + 16, 190, { family: F.jpHeavy, size: 30, weight: 700, color: C.slop, alpha: gq });
          const tq = since(t, tThird, 0.6, E.outBack);
          if (tq > 0) {
            // badge
            const bx = 560, by = 520;
            ctx.save(); ctx.translate(bx, by); ctx.scale(tq, tq);
            circle(ctx, 0, 0, 170, rgba(C.ink, 0.85), rgba(C.paper, 0.2), 2);
            // pie: 1/3+
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 150, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.355 * clamp((t - tThird) / 0.8)); ctx.closePath(); ctx.fillStyle = C.slop; ctx.fill();
            circle(ctx, 0, 0, 150, null, rgba(C.paper, 0.4), 2);
            ctx.restore();
            text(ctx, '3分の1超', bx, by + 250, { family: F.jpHeavy, size: 72, weight: 900, color: C.slop, align: 'center', alpha: tq });
            text(ctx, 'ChatGPT公開後のページのうち', bx, by + 300, { family: F.jp, size: 26, weight: 500, color: C.mute2, align: 'center', alpha: tq });
          }
        }
      }
    },
  };

  // ------------------------------------------------ S18: the glyph ocean
  let glyphTex;
  const GLYPHS = ' ・、。一ーニ二ハ人入ノ口日月田由目白自甲申曲国回困図園圏鬱';
  function buildGlyphAtlas() {
    const n = GLYPHS.length, cs = 64;
    const c = document.createElement('canvas'); c.width = n * cs; c.height = cs;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${cs * 0.82}px NotoSansJP`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) ctx.fillText(GLYPHS[i], i * cs + cs / 2, cs / 2 + 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return { tex: t, n };
  }
  const OCEAN = /* glsl */ `
  uniform sampler2D glyphs; uniform float nG, time, mixAmt, dyeAmt, travel; uniform vec2 res;
  varying vec2 vUv;
  float wave(vec2 p, float t){
    float h = 0.;
    h += sin(p.y * .9 - t * 1.3 + sin(p.x * .15) * 1.5) * .55;
    h += sin(dot(p, vec2(.6, .8)) * 1.3 - t * 1.7) * .25;
    h += sin(dot(p, vec2(-.7, .7)) * 2.1 - t * 2.3) * .12;
    h += (vnoise(p * .45 + vec2(t * .2, -t * .3)) - .5) * .6;
    return h;
  }
  float lightAt(vec2 wp, float t, out vec3 N){
    float e = .05;
    float h = wave(wp, t);
    float hx = wave(wp + vec2(e, 0.), t) - h, hz = wave(wp + vec2(0., e), t) - h;
    N = normalize(vec3(-hx / e * .5, 1., -hz / e * .5));
    vec3 V = normalize(vec3(0., .28, 1.));
    vec3 L = normalize(vec3(-.25, .35, -1.));
    float spec = pow(max(dot(reflect(-L, N), V), 0.), 40.);
    float fres = pow(1. - max(dot(N, V), 0.), 4.);
    return clamp(.05 + .7 * pow(h * .5 + .5, 1.6) + spec * 1.8 + fres * .3, 0., 1.4);
  }
  void main(){
    vec2 uv = vUv; float asp = res.x / res.y;
    float horizon = .60;
    vec3 human = vec3(.93, .92, .89), ai = vec3(.776, .957, .196);
    vec3 col;
    if (uv.y < horizon) {
      float yy = horizon - uv.y;
      float z = .55 / (yy + .002);
      float x = (uv.x - .5) * asp * z * .9;
      vec2 wp = vec2(x, z + travel);
      float t = time;
      // glyph cells live on the water plane
      vec2 g = wp / vec2(.3, .3);
      vec2 cid = floor(g), cuv = fract(g);
      vec2 cw = (cid + .5) * .3;
      vec3 N;
      float b = lightAt(cw, t, N);
      float gi = floor(clamp(b, 0., .999) * nG);
      if (hash12(cid + floor(t * 3.)) > .93) gi = min(nG - 1., gi + 1.);
      float gs = texture2D(glyphs, vec2((gi + cuv.x) / nG, cuv.y)).r;
      float fw = max(fwidth(g.x), fwidth(g.y));
      float cov = mix(gs, .18 + .5 * gi / nG, smoothstep(.25, .9, fw));
      float blobs = smoothstep(.6, .72, vnoise(cw * .22 + vec2(t * .05, 0.)) * .75 + vnoise(cw * .9) * .25);
      float spread = .38 + (vnoise(cw * .08) - .5) * .15;
      float dye = mix(blobs, spread, mixAmt) * dyeAmt;
      vec3 tint = mix(human, ai, dye);
      float fog = smoothstep(.0, .25, yy);
      col = tint * cov * (.25 + b * .95) * (.35 + .65 * fog);
      col += tint * (1. - fog) * .08;
    } else {
      float s = (uv.y - horizon) / (1. - horizon);
      col = mix(vec3(.06, .07, .08), vec3(.012, .012, .016), smoothstep(0., .6, s));
      col += vec3(.35, .36, .33) * pow(1. - s, 18.) * .35;
    }
    gl_FragColor = vec4(col, 1.);
  }`;
  const S18 = {
    id: 'S18', start: cue(23, 'つまり') - 0.2, trans: { type: 'dissolve', d: 0.8 }, chapter: CH,
    look: { vign: 0.55, bloom: 0.35, bloomThresh: 0.5, grain: 0.04 },
    setup() { glyphTex = buildGlyphAtlas(); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tA = cs(23, '人間の文章'), tB = cs(23, 'ではなく') + 0.3, tC = cs(23, '同じ海水') - 0.5;
      const m = mat(f.gl, 'ocean', OCEAN, { glyphs: { value: null }, nG: { value: 1 }, time: { value: 0 }, mixAmt: { value: 0 }, dyeAmt: { value: 0 }, travel: { value: 0 }, res: { value: new THREE.Vector2(f.gl.W, f.gl.H) } });
      m.uniforms.glyphs.value = glyphTex.tex; m.uniforms.nG.value = glyphTex.n; m.uniforms.time.value = f.T * 0.7;
      m.uniforms.travel.value = t * 0.9;
      m.uniforms.dyeAmt.value = since(t, tA - 0.3, 1.0);
      m.uniforms.mixAmt.value = E.inOutCubic(clamp((t - tB) / 3.2));
      f.pass(m);
      // captions
      const q1 = since(t, tA - 0.2, 0.5);
      const strike = since(t, tB - 0.35, 0.4, E.outExpo);
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 420);
      ctx.restore();
      const y1 = 190;
      text(ctx, '人間の文章の海に、AI文章が混じっている', 960, y1, { family: F.jpHeavy, size: 56, weight: 700, color: C.paper, align: 'center', alpha: q1 * (1 - 0.5 * strike), each: riseEach(q1, 30, 0.3) });
      if (strike > 0) { const w = measure(ctx, '人間の文章の海に、AI文章が混じっている', { family: F.jpHeavy, size: 56, weight: 700 }); ctx.fillStyle = C.alert; ctx.fillRect(960 - w / 2 - 10, y1 - 24, (w + 20) * strike, 7); }
      const q2 = since(t, tC, 0.6, E.outExpo);
      text(ctx, '同じ海水になり始めている', 960, 320, { family: F.mincho, size: 92, weight: 900, color: '#e8f5c8', align: 'center', each: riseEach(q2, 50, 0.3), shadow: 'rgba(0,0,0,.8)', shadowBlur: 24 });
    },
  };

  return [S15, S16, S18];
}

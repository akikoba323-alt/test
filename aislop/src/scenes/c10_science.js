// Chapter 10 — science: phantom citations (9:08–10:13)
import { C, F, rgba } from '../engine/theme.js';
import { clamp, E, lerp, keys, spring } from '../engine/ease.js';
import { text, decodeEach, riseEach, popEach, measure } from '../engine/text.js';
import { rng, hash } from '../engine/rng.js';
import { rr, fillRR, strokeRR, circle, line, grid, glow, arrow, carrow, check, cross, poly } from '../lib/draw.js';
import { icon } from '../lib/icons.js';
import { odometer, fmt } from '../lib/counter.js';
import { noteTag, chapterCard } from '../lib/hud.js';
import { THREE } from '../engine/gl.js';
import { cueFn, chapter, since, pulse, flick } from './util.js';

export function scienceScenes(eng) {
  const cue = cueFn(eng);
  const CH = chapter('10', '科学', 'SCIENCE', cue(107, '科学') - 0.2);

  // ------------------------------------------------ S59: the citation galaxy (3D points)
  let gal;
  const REPOS = [['arXiv', 0x8fb3ff, [-9, 1, -2]], ['bioRxiv', 0x9be8b0, [8, -1, -4]], ['SSRN', 0xffc98a, [-4, -2, 8]], ['PubMed Central', 0xd2a8ff, [6, 2, 7]]];
  const NP = 500000, NG = 28000;
  const GV = /* glsl */ `
  attribute float aK; attribute float aGhost; attribute float aR;
  uniform float appear, ghost, px; varying vec3 vCol; varying float vA;
  uniform vec3 cols[4];
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    gl_Position = projectionMatrix * mv;
    float isG = aGhost * step(aR, ghost);
    gl_PointSize = px * (isG > .5 ? 3.2 : 1.) * clamp(14. / -mv.z, .5, 3.);
    int k = int(aK);
    vec3 c = k == 0 ? cols[0] : k == 1 ? cols[1] : k == 2 ? cols[2] : cols[3];
    vCol = mix(c, vec3(1., .23, .19), isG);
    vA = step(aR, appear) * (aGhost > .5 ? isG : 1.);
  }`;
  const GF = /* glsl */ `varying vec3 vCol; varying float vA; void main(){ if (vA < .5) discard; vec2 d = gl_PointCoord - .5; float r = length(d); if (r > .5) discard; gl_FragColor = vec4(vCol * (1. - r * 1.2), 1.); }`;
  const S59 = {
    id: 'S59', start: cue(107, '科学') - 0.2, trans: { type: 'dip', d: 0.5, color: '#000000' }, chapter: CH,
    source: 'Nature（2026）が紹介した大規模研究', sourceAt: 3.0,
    look: { vign: 0.55, bloom: 0.55, bloomThresh: 0.35, grain: 0.04 },
    setup() {
      const r = rng(250);
      const pos = new Float32Array((NP + NG) * 3), aK = new Float32Array(NP + NG), aG = new Float32Array(NP + NG), aR = new Float32Array(NP + NG);
      for (let i = 0; i < NP + NG; i++) {
        const k = i < NP ? Math.floor(r() * 4) : Math.floor(r() * 4);
        const [, , c] = REPOS[k];
        // spiral galaxy
        const arm = Math.floor(r() * 3), rad = Math.pow(r(), 0.7) * 5.2;
        const ang = arm * 2.094 + rad * 0.9 + r.gauss() * 0.35;
        const y = r.gauss() * 0.35 * (1 - rad / 6);
        pos[i * 3] = c[0] + Math.cos(ang) * rad; pos[i * 3 + 1] = c[1] + y; pos[i * 3 + 2] = c[2] + Math.sin(ang) * rad;
        aK[i] = k; aG[i] = i >= NP ? 1 : 0; aR[i] = r();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aK', new THREE.BufferAttribute(aK, 1)); g.setAttribute('aGhost', new THREE.BufferAttribute(aG, 1)); g.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
      const m = new THREE.ShaderMaterial({ vertexShader: GV, fragmentShader: GF, uniforms: { appear: { value: 0 }, ghost: { value: 0 }, px: { value: 2 }, cols: { value: REPOS.map(([, c]) => new THREE.Color(c)) } }, depthWrite: false, transparent: false, blending: THREE.AdditiveBlending });
      const pts = new THREE.Points(g, m); pts.frustumCulled = false;
      // reference web: a few thousand faint lines
      const lp = [];
      for (let k = 0; k < 2500; k++) { const a = Math.floor(r() * NP), b = Math.floor(r() * NP); lp.push(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lp), 3));
      const lm = new THREE.LineBasicMaterial({ color: 0x6070a0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
      const lines = new THREE.LineSegments(lg, lm);
      const scene = new THREE.Scene(); scene.add(pts, lines);
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
      gal = { scene, camera, m, lm };
    },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tNat = cs(108, 'Nature') - 0.3, tRepo = cs(108, 'arXiv') - 0.3, t250 = cs(108, '二百五十万') - 0.6, tRef = cs(108, '一億') - 0.6, t14 = cs(108, '十四万') - 0.8, tNone = cs(108, '存在しない') - 0.3;
      const u = gal.m.uniforms;
      u.px.value = 2.2 * f.gl.W / 1920;
      u.appear.value = clamp((t - 0.6) / Math.max(1, tRepo + 2.6 - 0.6));
      u.ghost.value = clamp((t - t14) / 2.2);
      gal.lm.opacity = 0.18 * clamp((t - tRef) / 1.5);
      const ang = 0.4 + t * 0.045;
      const dist = keys(t, [[0, 34], [tRepo, 30], [t14, 24, E.inOutCubic], [f.dur, 21]]);
      gal.camera.position.set(Math.cos(ang) * dist, 9 + Math.sin(t * 0.1) * 2, Math.sin(ang) * dist);
      gal.camera.lookAt(0, 0, 2);
      f.three(gal.scene, gal.camera, { ldr: true, msaa: 0, clear: [0.005, 0.006, 0.012, 1] });
      // labels for repositories (projected)
      const rq = since(t, tRepo, 0.5);
      if (rq > 0) REPOS.forEach(([name, col, c], i) => {
        const v = new THREE.Vector3(c[0], c[1] + 2.4, c[2]).project(gal.camera);
        const x = (v.x * 0.5 + 0.5) * 1920, y = (-v.y * 0.5 + 0.5) * 1080;
        const q = since(t, tRepo + i * 0.35, 0.4);
        text(ctx, name, x, y, { family: F.grotesk, size: 30, weight: 700, color: '#' + col.toString(16).padStart(6, '0'), align: 'center', alpha: q * (1 - since(t, t14 - 0.5, 0.5) * 0.6) });
      });
      chapterCard(ctx, t - 0.05, CH, 2.4);
      // numbers panel
      const pq = since(t, t250, 0.5);
      if (pq > 0) {
        fillRR(ctx, 90, 610, 620, 290, 18, 'rgba(6,6,10,.94)'); strokeRR(ctx, 90, 610, 620, 290, 18, 'rgba(255,255,255,.12)', 2);
        text(ctx, '論文・プレプリント', 120, 668, { family: F.jp, size: 28, weight: 700, color: C.mute2 });
        text(ctx, '約 250万本', 120, 740, { family: F.jpHeavy, size: 60, weight: 900, color: C.paper });
        const fq = since(t, tRef, 0.5);
        text(ctx, '参考文献', 120, 800, { family: F.jp, size: 28, weight: 700, color: C.mute2, alpha: fq });
        text(ctx, '1億1100万件', 120, 870, { family: F.jpHeavy, size: 60, weight: 900, color: C.paper, alpha: fq });
      }
      const gq = since(t, t14, 0.5);
      if (gq > 0) {
        fillRR(ctx, 1180, 610, 660, 290, 18, 'rgba(10,4,4,.95)'); strokeRR(ctx, 1180, 610, 660, 290, 18, rgba(C.alert, 0.5), 2);
        text(ctx, '2025年だけで', 1210, 668, { family: F.jp, size: 28, weight: 700, color: C.mute2 });
        odometer(ctx, 140000 * E.outCubic(clamp((t - t14) / 1.6)), 1210, 790, { family: F.bebas, size: 120, color: C.alert });
        text(ctx, '件超', 1560, 790, { family: F.jpHeavy, size: 50, weight: 900, color: C.alert });
        text(ctx, '「存在しない引用」', 1210, 866, { family: F.jpHeavy, size: 50, weight: 900, color: C.paper, alpha: since(t, tNone, 0.4) });
      }
      text(ctx, '1点 = 約5本（推定値の可視化）', 1860, 1000 - 60, { family: F.jp, size: 18, color: C.mute, align: 'right', alpha: pq * 0.8 });
    },
  };

  // ------------------------------------------------ S60: caveat + trend (schematic)
  const S60 = {
    id: 'S60', start: cue(109, 'もちろん') - 0.2, trans: { type: 'fade', d: 0.5 }, chapter: CH,
    look: { vign: 0.4, bloom: 0.25 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tBut = cs(110, 'しかし') - 0.2, tRise = cs(110, '急増') - 0.6, tStrong = cs(110, '特徴が強い') - 0.3;
      // caveat banner
      const cq = since(t, 0, 0.4) * (1 - 0.6 * since(t, tBut, 0.4));
      fillRR(ctx, 360, 120, 1200, 100, 16, rgba(C.paper, 0.08 * cq + 0.02));
      text(ctx, '※ すべてがAI由来と確定したわけではない', 960, 185, { family: F.jpHeavy, size: 46, weight: 900, color: C.paper, align: 'center', alpha: cq });
      // chart 1: over time
      const x0 = 160, x1 = 1000, yB = 820, yT = 330;
      const aq = 0.3 + 0.7 * since(t, tBut - 0.2, 0.5);
      ctx.save(); ctx.globalAlpha = aq;
      line(ctx, x0, yB, x1, yB, rgba(C.paper, 0.5), 2); line(ctx, x0, yT, x0, yB, rgba(C.paper, 0.5), 2);
      text(ctx, '存在しない引用', x0, yT - 20, { family: F.jpHeavy, size: 30, weight: 900, color: C.paper });
      ['2019', '2020', '2021', '2022', '2023', '2024', '2025'].forEach((y, i) => text(ctx, y, lerp(x0 + 40, x1 - 20, i / 6), yB + 40, { family: F.mono, size: 20, color: C.mute2, align: 'center' }));
      const xg = lerp(x0 + 40, x1 - 20, 3.9 / 6);
      ctx.save(); ctx.setLineDash([8, 8]); line(ctx, xg, yT, xg, yB, rgba(C.slop, 0.7), 2); ctx.restore();
      text(ctx, 'ChatGPT', xg + 8, yT + 20, { family: F.grotesk, size: 22, weight: 700, color: C.slop });
      const p = clamp((t - tRise) / 1.5);
      const pts = [];
      for (let i = 0; i <= 60; i++) { const u = i / 60; if (u > p) break; const x = lerp(x0 + 40, x1 - 20, u); const y = u < 0.62 ? yB - 40 - Math.sin(u * 20) * 4 : yB - 40 - Math.pow((u - 0.62) / 0.38, 1.8) * 400; pts.push([x, y]); }
      ctx.lineCap = 'round'; poly(ctx, pts, 1, C.alert, 6);
      text(ctx, '急増', x1 - 40, yT + 60, { family: F.jpHeavy, size: 64, weight: 900, color: C.alert, align: 'right', alpha: since(t, tRise + 1.2, 0.4) });
      ctx.restore();
      // chart 2: stronger AI-writing features → more phantom citations
      const bq = since(t, tStrong, 0.5);
      if (bq > 0) {
        const X0 = 1120, X1 = 1780;
        ctx.save(); ctx.globalAlpha = bq;
        line(ctx, X0, yB, X1, yB, rgba(C.paper, 0.5), 2); line(ctx, X0, yT, X0, yB, rgba(C.paper, 0.5), 2);
        text(ctx, 'AI支援文章の特徴', X1, yB + 44, { family: F.jp, size: 24, weight: 700, color: C.mute2, align: 'right' });
        text(ctx, '強い →', X1, yB + 76, { family: F.jp, size: 22, color: C.mute, align: 'right' });
        for (let k = 0; k < 5; k++) { const h = (60 + k * 80) * clamp((t - tStrong - k * 0.12) / 0.4); fillRR(ctx, X0 + 40 + k * 125, yB - h, 80, h, 6, rgba(C.alert, 0.35 + k * 0.13)); }
        text(ctx, 'ほど多い', X1, yT + 40, { family: F.jpHeavy, size: 54, weight: 900, color: C.alert, align: 'right' });
        ctx.restore();
      }
      noteTag(ctx, t - 1, '※ 傾向を示す概念図（数値は目盛りなし）', 1880, 1000 - 60);
    },
  };

  // ------------------------------------------------ S61: the foundation of knowledge
  const S61 = {
    id: 'S61', start: cue(111, 'これが') - 0.2, trans: { type: 'wipe', d: 0.6, dir: [0, -1], color: '#ff3b30' }, chapter: CH,
    look: { vign: 0.55, bloom: 0.35 },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tSearch = cs(111, '検索結果') - 0.3, tBase = cs(111, '知識の土台') - 0.5;
      const pan = E.inOutCubic(clamp((t - tBase + 0.4) / 1.6));
      ctx.save(); ctx.translate(0, -pan * 560);
      // sky/surface
      const g = ctx.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, '#0e1016'); g.addColorStop(1, '#1a1d26'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 420);
      // surface: search results cards
      for (let k = 0; k < 6; k++) { const x = 180 + k * 270; fillRR(ctx, x, 250, 230, 150, 10, '#e9e7e1'); ctx.fillStyle = '#1a55c9'; ctx.fillRect(x + 16, 276, 160, 10); for (let j = 0; j < 4; j++) { ctx.fillStyle = '#aaa'; ctx.fillRect(x + 16, 300 + j * 18, 190 - j * 20, 7); } }
      text(ctx, '検索結果', 960, 200, { family: F.jpHeavy, size: 50, weight: 900, color: C.paper, align: 'center', alpha: since(t, tSearch, 0.4) });
      // strata of bricks (papers)
      for (let row = 0; row < 12; row++) {
        const y = 440 + row * 70;
        const off = (row % 2) * 60;
        for (let c = -1; c < 17; c++) {
          const x = c * 120 + off;
          const fake = row === 9 && c === 7;
          const shade = 0.12 + row * 0.012;
          fillRR(ctx, x + 3, y + 3, 114, 64, 4, fake ? (flick(t, 5) > 0.25 ? '#3a0c0a' : '#25080a') : `rgba(${Math.round(210 * shade + 20)},${Math.round(200 * shade + 20)},${Math.round(180 * shade + 20)},1)`);
          if (!fake) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + 14, y + 20, 70, 5); ctx.fillRect(x + 14, y + 34, 50, 5); }
          else { strokeRR(ctx, x + 3, y + 3, 114, 64, 4, C.alert, 3); text(ctx, 'B?', x + 60, y + 47, { family: F.mincho, size: 36, weight: 900, color: C.alert, align: 'center' }); glow(ctx, x + 60, y + 35, 160, C.alert, 0.25 + 0.15 * Math.sin(t * 5)); }
        }
      }
      ctx.restore();
      const bq = since(t, tBase + 0.6, 0.6, E.outExpo);
      text(ctx, '知識の土台', 960, 300, { family: F.mincho, size: 110, weight: 900, color: C.paper, align: 'center', each: riseEach(bq, 40, 0.3), shadow: 'rgba(0,0,0,.9)', shadowBlur: 20 });
      text(ctx, 'に混ざる', 960, 400, { family: F.mincho, size: 64, weight: 900, color: C.alert, align: 'center', alpha: since(t, tBase + 1.2, 0.5), shadow: 'rgba(0,0,0,.9)', shadowBlur: 20 });
    },
  };

  // ------------------------------------------------ S62: paper B, the ghost that walks
  let graph;
  function buildGraph() {
    const r = rng(612);
    const nodes = [];
    for (let i = 0; i < 90; i++) nodes.push({ x: 960 + r.gauss() * 520, y: 520 + r.gauss() * 240, vx: 0, vy: 0, t: i });
    const edges = [];
    for (let i = 1; i < nodes.length; i++) { const j = Math.floor(r() * i); edges.push([i, j]); if (r() < 0.4) edges.push([i, Math.floor(r() * i)]); }
    for (let it = 0; it < 400; it++) {
      for (const a of nodes) for (const b of nodes) { if (a === b) continue; const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 1; const fr = 3000 / d2; a.vx += dx * fr * 0.01; a.vy += dy * fr * 0.01; }
      for (const [i, j] of edges) { const a = nodes[i], b = nodes[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; const k = (d - 110) * 0.004; a.vx += dx / d * k * d * 0.1; a.vy += dy / d * k * d * 0.1; b.vx -= dx / d * k * d * 0.1; b.vy -= dy / d * k * d * 0.1; }
      for (const a of nodes) { a.vx += (960 - a.x) * 0.002; a.vy += (520 - a.y) * 0.004; a.x += a.vx * 0.5; a.y += a.vy * 0.5; a.vx *= 0.6; a.vy *= 0.6; a.x = clamp(a.x, 120, 1800); a.y = clamp(a.y, 170, 860); }
    }
    return { nodes, edges };
  }
  function paperNode(ctx, x, y, s, col, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    fillRR(ctx, -26, -34, 52, 68, 5, o.fill || '#1b1b20'); strokeRR(ctx, -26, -34, 52, 68, 5, col, 2.5);
    ctx.fillStyle = col; for (let k = 0; k < 4; k++) ctx.fillRect(-16, -20 + k * 12, 32 - (k === 3 ? 12 : 0), 4);
    if (o.label) text(ctx, o.label, 0, 70, { family: F.grotesk, size: 26, weight: 700, color: col, align: 'center' });
    ctx.restore();
  }
  const S62 = {
    id: 'S62', start: cue(112, '論文A') - 0.3, trans: { type: 'dissolve', d: 0.6 }, chapter: CH,
    look: (t) => ({ vign: 0.6, bloom: 0.45, bloomThresh: 0.4, grain: 0.06, glitch: 0 }),
    setup() { graph = buildGraph(); },
    draw(f) {
      const { ctx, t } = f;
      const cs = (id, sub) => cue(id, sub) - f.S.start;
      const tAB = 0.3, tReader = cs(113, '次の人') - 0.3, tAI = cs(114, 'さらに') - 0.2, tThen = cs(115, 'すると') - 0.2, tWalk = cs(115, '幽霊') - 0.6, tReal = cs(116, '架空') - 0.3, tCite = cs(116, '引用だけ') - 0.3;
      ctx.fillStyle = '#07070a'; ctx.fillRect(0, 0, 1920, 1080);
      const grow = clamp((t - tThen) / 5.0);
      const nShow = Math.floor(grow * graph.nodes.length);
      // B position: fixed, then walks through the graph
      const walkK = clamp((t - tWalk) / 6);
      const path = [3, 17, 29, 44, 58, 71, 80, 66, 38];
      const pi = walkK * (path.length - 1), p0 = Math.floor(pi), p1 = Math.min(path.length - 1, p0 + 1), pf = E.inOutSine(pi - p0);
      const bx0 = 1200, by0 = 520;
      let bx = bx0, by = by0;
      if (t > tWalk) { const a = graph.nodes[path[p0]], b = graph.nodes[path[p1]]; bx = lerp(a.x, b.x, pf); by = lerp(a.y, b.y, pf); bx = lerp(bx0, bx, clamp((t - tWalk) / 0.8)); by = lerp(by0, by, clamp((t - tWalk) / 0.8)); }
      // growing graph: every new node cites B
      if (nShow > 0) {
        for (const [i, j] of graph.edges) { if (i >= nShow || j >= nShow) continue; const a = graph.nodes[i], b = graph.nodes[j]; line(ctx, a.x, a.y, b.x, b.y, 'rgba(140,150,180,.18)', 1.5); }
        for (let i = 0; i < nShow; i++) {
          const n = graph.nodes[i];
          const q = clamp((grow * graph.nodes.length - i) / 3);
          ctx.save(); ctx.globalAlpha = q * 0.55; ctx.setLineDash([6, 6]); line(ctx, n.x, n.y, bx, by, rgba(C.alert, 0.5), 1.5); ctx.restore();
          paperNode(ctx, n.x, n.y, 0.45 * q, 'rgba(200,205,220,.7)');
        }
      }
      // A, reader, AI (first beats)
      const early = 1 - since(t, tThen + 0.8, 0.8);
      if (early > 0) {
        ctx.save(); ctx.globalAlpha = early;
        const ax = 600, ay = 520;
        paperNode(ctx, ax, ay, 2.0, C.paper, { label: '論文A', fill: '#1d1d24' });
        const aq = since(t, tAB, 0.5);
        ctx.save(); ctx.setLineDash([12, 10]); arrow(ctx, ax + 70, ay, bx0 - 80, by0, { color: rgba(C.alert, 0.9), lw: 4, p: aq }); ctx.restore();
        text(ctx, '引用', (ax + bx0) / 2, ay - 26, { family: F.jpHeavy, size: 30, weight: 900, color: C.alert, align: 'center', alpha: aq });
        const rq = since(t, tReader, 0.5, E.outBack);
        if (rq > 0) {
          ctx.save(); ctx.translate(560, 820); ctx.scale(rq, rq);
          circle(ctx, 0, -40, 28, C.human); fillRR(ctx, -38, -6, 76, 80, 30, C.human);
          ctx.restore();
          arrow(ctx, 600, 760, 600, 610, { color: rgba(C.human, 0.8), lw: 3, p: rq });
          fillRR(ctx, 640, 800, 360, 70, 35, C.paper); text(ctx, '「Bは実在する」', 820, 848, { family: F.jpHeavy, size: 32, weight: 900, color: C.ink, align: 'center', alpha: rq });
        }
        const iq = since(t, tAI, 0.5, E.outBack);
        if (iq > 0) {
          ctx.save(); ctx.translate(560, 230); ctx.scale(iq, iq);
          fillRR(ctx, -70, -60, 140, 120, 24, '#1d2408'); strokeRR(ctx, -70, -60, 140, 120, 24, C.slop, 3); icon(ctx, 'bot', 0, 0, 70, { color: C.slop, lw: 1.8 });
          ctx.restore();
          arrow(ctx, 590, 440, 575, 310, { color: rgba(C.slop, 0.9), lw: 3, p: iq });
          text(ctx, 'AIが学習', 700, 240, { family: F.jpHeavy, size: 34, weight: 900, color: C.slop, alpha: iq });
        }
        ctx.restore();
      }
      // ghost B: more solid with every citation
      const solidity = clamp(0.25 + grow * 0.9);
      const jit = (1 - solidity) * 8;
      for (let k = 0; k < 3; k++) {
        const ox = Math.sin(t * 9 + k * 2) * jit + (k - 1) * 4 * (1 - solidity), oy = Math.cos(t * 7 + k) * jit;
        ctx.save(); ctx.globalAlpha = (0.35 + 0.65 * solidity) * (k === 1 ? 1 : 0.5);
        paperNode(ctx, bx + ox, by + oy, 2.0, k === 0 ? 'rgba(255,60,60,.9)' : k === 2 ? 'rgba(80,200,255,.8)' : '#ffd6d0', { fill: `rgba(40,10,10,${solidity})` });
        ctx.restore();
      }
      glow(ctx, bx, by, 180, C.alert, 0.2 + 0.2 * solidity);
      text(ctx, '論文B', bx, by + 110, { family: F.grotesk, size: 30, weight: 700, color: '#ffd6d0', align: 'center' });
      text(ctx, t < tThen + 1.5 ? '（存在しない）' : '', bx, by + 146, { family: F.jp, size: 24, weight: 700, color: C.alert, align: 'center' });
      // citation counter of B
      if (t > tThen) {
        const cites = Math.floor(3 + grow * 1281);
        fillRR(ctx, bx + 80, by - 150, 300, 70, 12, 'rgba(10,4,4,.9)');
        text(ctx, '被引用 ' + fmt(cites), bx + 100, by - 103, { family: F.mono, size: 30, weight: 700, color: C.alert });
      }
      const wq = since(t, tWalk + 0.3, 0.6, E.outExpo);
      if (wq > 0 && t < tReal) text(ctx, '幽霊みたいに、知識体系の中を歩き始める', 960, 150, { family: F.mincho, size: 56, weight: 900, color: '#ffd6d0', align: 'center', each: riseEach(wq, 30, 0.2), shadow: 'rgba(0,0,0,.9)', shadowBlur: 16 });
      if (t > tReal) {
        const q1 = since(t, tReal, 0.6, E.outExpo), q2 = since(t, tCite, 0.6, E.outExpo);
        ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.5 * q1})`; ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
        text(ctx, '架空の論文が、', 960, 440, { family: F.mincho, size: 80, weight: 900, color: C.paper, align: 'center', each: riseEach(q1, 30, 0.3) });
        text(ctx, '引用だけは本物になる', 960, 580, { family: F.mincho, size: 110, weight: 900, color: C.alert, align: 'center', each: riseEach(q2, 40, 0.3) });
      }
    },
  };

  return [S59, S60, S61, S62];
}

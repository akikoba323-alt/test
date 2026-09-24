// Camera director: evaluates the active shot at (playback P, world W) into a camera pose plus
// lens/post parameters. Shots are declared in the script; the director adds handheld drift,
// trauma-driven shake, auto-focus and cut detection.
import * as THREE from 'three';
import { easeFn, clamp, clamp01, lerp, smoothstep } from '../core/math.js';
import { noise2 } from '../core/rng.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class Director {
  constructor(film, shots) {
    this.film = film;
    this.e = film.e;
    this.shots = shots;
    this.idx = -1;
    this.focusS = 10;
    this.lastCut = -1;
    this.smooth = new THREE.Vector3();
    this.smoothT = new THREE.Vector3();
    this.cut = false;
    // camera operator state (critically damped springs on position, aim point and focal length)
    this.op = { p: new THREE.Vector3(), pv: new THREE.Vector3(), a: new THREE.Vector3(), av: new THREE.Vector3(), fov: 40, fv: 0, init: false };
    // stabilised fight axis (horizontal, Kai -> Gou); persists across cuts so screen direction holds
    this.axis = new THREE.Vector3(1, 0, 0);
    this.axisInit = false;
  }

  // horizontal unit axis from a to b, rotating slowly and never flipping (the 180° line)
  updateAxis(aRef, bRef, dt, rate, snap) {
    const a = this.ref(aRef, _c), b = this.ref(bRef, _d);
    const d = b.clone().sub(a).setY(0);
    if (d.lengthSq() < 1e-4) return this.axis;
    d.normalize();
    if (snap || !this.axisInit) { this.axis.copy(d); this.axisInit = true; return this.axis; }
    if (d.dot(this.axis) < -0.1) return this.axis; // subjects crossed: hold the line
    this.axis.lerp(d, clamp(dt * rate, 0, 1)).normalize();
    return this.axis;
  }

  // Exact two-subject framing (toric-style): subjects A and B land on screen x positions sa, sb
  // (-1..1 of frame width) with the pair's mean at screen y. Camera looks along a direction set by
  // the fight axis, the side of the line, azimuth and elevation; distance and lateral offset
  // are solved in closed form. If the distance leaves [minD, maxD] the operator zooms instead.
  solveTwo(p, A, B, fovIn, aspect, out) {
    const axis = this.axis;
    const side = p.side ?? 1;
    // camera sits on the side where A reads left of B
    const n = new THREE.Vector3(-axis.z * side, 0, axis.x * side);
    const az = (p.az ?? 0) * Math.PI / 180, el = (p.elev ?? 6) * Math.PI / 180;
    const vh = n.clone().negate().applyAxisAngle(new THREE.Vector3(0, 1, 0), az);
    const v = new THREE.Vector3(vh.x * Math.cos(el), -Math.sin(el), vh.z * Math.cos(el)).normalize();
    const right = new THREE.Vector3().crossVectors(v, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, v);
    const M = A.clone().add(B).multiplyScalar(0.5);
    const sa = p.sa || [-0.34, 0], sb = p.sb || [0.34, 0];
    const ar = A.clone().sub(M).dot(right), av = A.clone().sub(M).dot(v), br = B.clone().sub(M).dot(right), bv = B.clone().sub(M).dot(v);
    let fov = fovIn;
    const solveD = (fv) => {
      const t = Math.tan(fv * Math.PI / 360) * aspect;
      const tA = sa[0] * t, tB = sb[0] * t;
      return (ar - br - tA * av + tB * bv) / (tA - tB);
    };
    let D = solveD(fov);
    const minD = p.minD ?? 2.2, maxD = p.maxD ?? 400;
    if (!(D > minD && D < maxD) && p.zoom !== false) {
      const Dw = clamp(isFinite(D) && D > 0 ? D : minD, minD, maxD);
      const den = Dw * (sa[0] - sb[0]) + sa[0] * av - sb[0] * bv;
      if (Math.abs(den) > 1e-6) {
        const t = (ar - br) / den;
        if (t > 0) fov = clamp(Math.atan(t / aspect) * 360 / Math.PI, p.fovMin ?? 8, p.fovMax ?? 75);
      }
      D = solveD(fov);
    }
    if (!(D > 0.5) || !isFinite(D)) D = Math.max(minD, A.distanceTo(B) * 1.2);
    const t = Math.tan(fov * Math.PI / 360) * aspect;
    const s = ar - sa[0] * t * (av + D);
    const vt = Math.tan(fov * Math.PI / 360);
    const sy = ((sa[1] ?? 0) + (sb[1] ?? 0)) / 2;
    const u = -sy * D * vt;
    out.pos.copy(M).addScaledVector(v, -D).addScaledVector(right, s).addScaledVector(up, u);
    out.tgt.copy(out.pos).addScaledVector(v, D);
    out.fov = fov;
    out.focus = D;
    return out;
  }

  // Single subject at screen (sx, sy), seen from az/elev relative to the fight axis (or world),
  // at a distance or so that `size` metres fill `frac` of the frame height.
  solveSingle(p, P, fovIn, aspect, out) {
    const base = p.world ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(-this.axis.z * (p.side ?? 1), 0, this.axis.x * (p.side ?? 1)).negate();
    const az = (p.az ?? 0) * Math.PI / 180, el = (p.elev ?? 5) * Math.PI / 180;
    const vh = base.applyAxisAngle(new THREE.Vector3(0, 1, 0), az);
    const v = new THREE.Vector3(vh.x * Math.cos(el), -Math.sin(el), vh.z * Math.cos(el)).normalize();
    const right = new THREE.Vector3().crossVectors(v, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, v);
    const fov = fovIn, vt = Math.tan(fov * Math.PI / 360), ht = vt * aspect;
    const D = p.dist ?? (p.size ?? 2) / (2 * (p.frac ?? 0.6) * vt);
    const sp = p.s || [0, 0];
    out.pos.copy(P).addScaledVector(v, -D).addScaledVector(right, -sp[0] * D * ht).addScaledVector(up, -sp[1] * D * vt);
    out.tgt.copy(out.pos).addScaledVector(v, D);
    out.fov = fov;
    out.focus = D;
    return out;
  }

  reset() { this.idx = -1; this.shotStart = 0; }

  // resolve a subject reference to a world position
  ref(r, out = new THREE.Vector3()) {
    if (!r) return out.set(0, 1.5, 0);
    if (Array.isArray(r)) return out.set(r[0], r[1], r[2]);
    if (r.isVector3) return out.copy(r);
    if (typeof r === 'function') return out.copy(r(this.film));
    const [who, bone] = r.split('.');
    const bn = r.includes('.') ? r.slice(who.length + 1) : 'chest';
    if (who === 'mid') { const k = this.e.kai.anim.bonePos.chest, g = this.e.gou.anim.bonePos.chest; return out.copy(k).add(g).multiplyScalar(0.5); }
    const f = who === 'kai' ? this.e.kai : this.e.gou;
    return out.copy(f.anim.bonePos[bn] || f.anim.bonePos.chest);
  }

  find(W) {
    const S = this.shots;
    let i = this.idx >= 0 && this.idx < S.length && S[this.idx].w <= W ? this.idx : 0;
    while (i + 1 < S.length && S[i + 1].w <= W) i++;
    while (i > 0 && S[i].w > W) i--;
    return i;
  }

  update(P, W) {
    const cam = this.e.camera;
    const i = this.find(W);
    this.cut = i !== this.idx;
    if (this.cut) { this.idx = i; this.shotP0 = this.film.tm.P(this.shots[i].w); }
    const sh = this.shots[i];
    const next = this.shots[i + 1];
    const w0 = sh.w, w1 = next ? next.w : this.film.endW;
    const p = sh.p;
    const basePlay = p.timeBase === 'play';
    const u = basePlay ? clamp01((P - this.shotP0) / Math.max(1e-3, this.film.tm.P(w1) - this.shotP0)) : clamp01((W - w0) / Math.max(1e-3, w1 - w0));
    const e = easeFn(p.ease || 'inOutSine')(u);
    const pos = _a, tgt = _b;
    let fov = p.fov ?? 40, roll = p.roll ?? 0;
    switch (sh.type) {
      case 'static':
        pos.copy(this.ref(p.pos)); tgt.copy(this.ref(p.target));
        break;
      case 'dolly':
        pos.copy(this.ref(p.from)).lerp(this.ref(p.to, _c), e);
        if (p.targetTo) tgt.copy(this.ref(p.target)).lerp(this.ref(p.targetTo, _d), e); else tgt.copy(this.ref(p.target));
        if (p.fovTo !== undefined) fov = lerp(p.fov ?? 40, p.fovTo, e);
        if (p.rollTo !== undefined) roll = lerp(p.roll ?? 0, p.rollTo, e);
        break;
      case 'orbit': {
        const c = this.ref(p.center, _c);
        const a = lerp(p.a0 ?? 0, p.a1 ?? 90, e) * Math.PI / 180;
        const r = lerp(p.r0 ?? p.radius ?? 5, p.r1 ?? p.radius ?? 5, e);
        const h = lerp(p.h0 ?? p.height ?? 1.5, p.h1 ?? p.height ?? 1.5, e);
        pos.set(c.x + Math.sin(a) * r, c.y + h, c.z + Math.cos(a) * r);
        tgt.copy(c).add(_d.set(0, p.lookY ?? 0, 0));
        if (p.fovTo !== undefined) fov = lerp(p.fov ?? 40, p.fovTo, e);
        break;
      }
      case 'track': {
        // follow a subject; offset in world or in a frame aligned with the subject's facing
        const s = this.ref(p.subject, _c);
        let off = _d.set(...(p.offset || [0, 1.5, 5]));
        if (p.offsetTo) off.lerp(_a.set(...p.offsetTo), e);
        if (p.frame) { const f = p.frame === 'kai' ? this.e.kai : this.e.gou; off.applyQuaternion(f.anim.yawQuat || _q.identity()); }
        const want = _a.copy(s).add(off);
        if (this.cut || !p.lag) { this.smooth.copy(want); }
        else this.smooth.lerp(want, clamp(1 - Math.exp(-this.film.lastDtReal * (p.lag ?? 8)), 0, 1));
        pos.copy(this.smooth);
        tgt.copy(this.ref(p.target || p.subject, _b));
        if (p.lookOff) tgt.add(_d.set(...p.lookOff));
        break;
      }
      case 'path': {
        // spline flythrough with banking
        const pts = p.points;
        const catm = (uu, out) => {
          const n = pts.length - 1, f = uu * n, k = Math.min(n - 1, Math.floor(f)), t = f - k;
          const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(n, k + 2)];
          const t2 = t * t, t3 = t2 * t;
          for (let j = 0; j < 3; j++) out.setComponent(j, 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3));
          return out;
        };
        catm(e, pos);
        if (p.target) tgt.copy(this.ref(p.target)); else catm(Math.min(1, e + 0.02), tgt);
        if (p.bank) {
          const ahead = catm(Math.min(1, e + 0.03), _d), behind = catm(Math.max(0, e - 0.03), _c);
          const turn = (ahead.x - pos.x) * (pos.z - behind.z) - (ahead.z - pos.z) * (pos.x - behind.x);
          roll += clamp(turn * p.bank, -35, 35);
        }
        if (p.fovTo !== undefined) fov = lerp(p.fov ?? 40, p.fovTo, e);
        break;
      }
      case 'cover': {
        // auto-framing: keep the subjects inside the frame from a chosen side of the action line
        const subs = (p.subjects || ['kai.chest', 'gou.chest']).map((r) => this.ref(r, new THREE.Vector3()));
        const M = new THREE.Vector3();
        for (const q of subs) M.add(q);
        M.divideScalar(subs.length);
        M.y += p.lift ?? 0;
        let R = p.minR ?? 1.1;
        for (const q of subs) R = Math.max(R, q.distanceTo(M) + (p.pad ?? 0.9));
        // action axis (horizontal), stabilised over the shot
        let ax = subs.length > 1 ? subs[1].clone().sub(subs[0]).setY(0) : new THREE.Vector3(1, 0, 0);
        if (p.axis) ax.set(p.axis[0], 0, p.axis[1]);
        if (ax.lengthSq() < 1e-4) ax.set(1, 0, 0);
        ax.normalize();
        if (this.cut || !this.coverAxis) this.coverAxis = ax.clone();
        else this.coverAxis.lerp(ax, clamp(this.film.lastDtReal * (p.axisLag ?? 1.5), 0, 1)).normalize();
        const az = ((p.side ?? 90) + (p.orbit ?? 0) * u) * Math.PI / 180;
        const a2 = this.coverAxis;
        const dir = new THREE.Vector3(a2.x * Math.cos(az) - a2.z * Math.sin(az), 0, a2.x * Math.sin(az) + a2.z * Math.cos(az));
        const el = lerp(p.elev ?? 8, p.elevTo ?? p.elev ?? 8, e) * Math.PI / 180;
        dir.multiplyScalar(Math.cos(el)).setY(Math.sin(el));
        fov = lerp(p.fov ?? 40, p.fovTo ?? p.fov ?? 40, e);
        const vf = fov * Math.PI / 360, aspect = this.film.aspect || 2.39;
        const hf = Math.atan(Math.tan(vf) * aspect);
        const fill = lerp(p.fill ?? 0.7, p.fillTo ?? p.fill ?? 0.7, e);
        // extents of the subjects across the view (right) and vertically, plus body size padding
        const fwd = dir.clone().negate();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
        const upv = new THREE.Vector3().crossVectors(right, fwd).normalize();
        let halfW = p.padW ?? 0.7, halfH = p.padH ?? 1.1;
        for (const q of subs) {
          const d0 = q.clone().sub(M);
          halfW = Math.max(halfW, Math.abs(d0.dot(right)) + (p.padW ?? 0.7));
          halfH = Math.max(halfH, Math.abs(d0.dot(upv)) + (p.padH ?? 1.1));
        }
        const dist = Math.max(p.minDist ?? 1.2, halfW / Math.tan(hf * fill), halfH / Math.tan(vf * fill));
        const want = M.clone().addScaledVector(dir, dist);
        if (want.y < (p.minY ?? 0.25)) want.y = p.minY ?? 0.25;
        if (this.cut || !p.lag) { this.smooth.copy(want); this.smoothT.copy(M); }
        else {
          const k = clamp(1 - Math.exp(-this.film.lastDtReal * p.lag), 0, 1);
          this.smooth.lerp(want, k);
          this.smoothT.lerp(M, clamp(1 - Math.exp(-this.film.lastDtReal * p.lag * 2), 0, 1));
        }
        pos.copy(this.smooth);
        tgt.copy(this.smoothT);
        if (p.lookOff) tgt.add(_d.set(...p.lookOff));
        break;
      }
      case 'two': {
        this.updateAxis(p.a || 'kai.chest', p.b || 'gou.chest', this.film.lastDtReal, p.axisRate ?? 0.6, this.cut && p.newAxis);
        const A = this.ref(p.a || 'kai.chest', new THREE.Vector3()), B = this.ref(p.b || 'gou.chest', new THREE.Vector3());
        if (p.lift) { A.y += p.lift; B.y += p.lift; }
        const o = this.solveTwo({ ...p, az: lerp(p.az ?? 0, p.azTo ?? p.az ?? 0, e), elev: lerp(p.elev ?? 6, p.elevTo ?? p.elev ?? 6, e) }, A, B, lerp(p.fov ?? 35, p.fovTo ?? p.fov ?? 35, e), this.film.aspect || 2.39, { pos: pos, tgt: tgt, fov: 0 });
        fov = o.fov;
        this.solvedFocus = o.focus;
        break;
      }
      case 'single': {
        if (p.axisFrom) this.updateAxis(p.axisFrom[0], p.axisFrom[1], this.film.lastDtReal, p.axisRate ?? 0.6, this.cut && p.newAxis);
        const P0 = this.ref(p.subject || 'kai.chest', new THREE.Vector3());
        if (p.lift) P0.y += p.lift;
        const o = this.solveSingle({ ...p, az: lerp(p.az ?? 0, p.azTo ?? p.az ?? 0, e), elev: lerp(p.elev ?? 5, p.elevTo ?? p.elev ?? 5, e), dist: p.dist !== undefined ? lerp(p.dist, p.distTo ?? p.dist, e) : undefined }, P0, lerp(p.fov ?? 35, p.fovTo ?? p.fov ?? 35, e), this.film.aspect || 2.39, { pos: pos, tgt: tgt, fov: 0 });
        fov = o.fov;
        this.solvedFocus = o.focus;
        break;
      }
      case 'pov': {
        const f = p.who === 'kai' ? this.e.kai : this.e.gou;
        pos.copy(f.anim.bonePos.head).add(_d.set(0, 0.08, 0));
        tgt.copy(this.ref(p.target));
        break;
      }
      case 'whip': {
        // rotate quickly from one look target to another around a fixed position
        pos.copy(this.ref(p.pos));
        const k = easeFn(p.ease || 'inOutExpo')(u);
        tgt.copy(this.ref(p.from)).lerp(this.ref(p.to, _c), k);
        break;
      }
    }
    // camera operator: springs on position / aim point / focal length (snap on cuts)
    const opP = p.op || ((sh.type === 'two' || sh.type === 'single') ? { pos: 2.4, aim: 4, zoom: 1.6 } : null);
    const O = this.op;
    if (this.cut || !O.init || !opP) {
      O.p.copy(pos); O.pv.set(0, 0, 0); O.a.copy(tgt); O.av.set(0, 0, 0); O.fov = fov; O.fv = 0; O.init = true;
    } else {
      const dt = clamp(this.film.lastDtReal, 0, 0.1);
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      const hdt = dt / n;
      const spring = (x, v, target, f) => {
        const w = 2 * Math.PI * f;
        for (let i = 0; i < n; i++) { v.addScaledVector(_d.copy(target).sub(x), w * w * hdt).addScaledVector(v, -2 * w * hdt); x.addScaledVector(v, hdt); }
      };
      if (opP.pos) spring(O.p, O.pv, pos, opP.pos); else O.p.copy(pos);
      if (opP.aim) spring(O.a, O.av, tgt, opP.aim); else O.a.copy(tgt);
      if (opP.zoom) { const w = 2 * Math.PI * opP.zoom; for (let i = 0; i < n; i++) { O.fv += (w * w * (fov - O.fov) - 2 * w * O.fv) * hdt; O.fov += O.fv * hdt; } } else O.fov = fov;
      pos.copy(O.p); tgt.copy(O.a); fov = O.fov;
    }
    // subtle handheld
    const hh = (p.handheld ?? 0.25) * (this.film.opts.reduceShake ? 0.3 : 1);
    const t = basePlay ? P : W;
    const hx = noise2(t * 0.7, 3.1) * hh * 0.012, hy = noise2(t * 0.6, 7.7) * hh * 0.01;
    // trauma shake (rotation dominant, directional kick)
    const trauma = (this.e.fx.frameFx.trauma || 0) * (p.shake ?? 1) * (this.film.opts.reduceShake ? 0.35 : 1);
    const sh2 = Math.min(trauma, 2.2) ** 2 * 0.5;
    const fq = 22;
    const sx = noise2(W * fq, 11.3) * sh2 * 0.035, sy = noise2(W * fq, 23.9) * sh2 * 0.03, sr = noise2(W * fq * 0.8, 41.7) * sh2 * 1.4;
    cam.position.copy(pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(tgt);
    cam.rotateY(hx + sx);
    cam.rotateX(hy + sy);
    cam.rotateZ((roll + sr) * Math.PI / 180);
    cam.fov = fov;
    const dist = p.focus ? pos.distanceTo(this.ref(p.focus, _c)) : (sh.type === 'two' || sh.type === 'single') ? (this.solvedFocus ?? pos.distanceTo(tgt)) : pos.distanceTo(tgt);
    this.focusS = this.cut ? dist : lerp(this.focusS, dist, clamp(this.film.lastDtReal * 10, 0, 1));
    cam.near = p.near ?? clamp(dist * 0.02, 0.03, 2.5);
    cam.far = p.far ?? 30000;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    return {
      cut: this.cut,
      dof: { focus: p.focusDist ?? this.focusS, aperture: p.aperture ?? 0, maxCoc: p.maxCoc ?? 12 },
      mb: { strength: p.mb ?? 0.5, radial: p.radial ?? 0, maxLen: p.mbMax ?? 0.07 },
      lensK: p.lensK ?? (fov > 80 ? 0.12 : 0), ca: p.ca ?? 0.0012, aspect: p.aspect, streak: p.streak,
      exposure: p.exposure ?? 0, speedLines: p.speedLines ?? 0,
      shotName: p.name || sh.type,
    };
  }
}

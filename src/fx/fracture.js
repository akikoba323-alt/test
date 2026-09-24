// Convex Voronoi fracture. A convex polyhedron (list of polygon faces) is clipped by the
// bisector planes between seed points; each cell becomes a chunk. Faces lying on the original
// surface keep the element's finish, new faces are flagged as fresh fracture surfaces.
// Glass panes use a 2D radial/Voronoi pattern extruded to shard prisms.

export function boxPolyhedron(hx, hy, hz) {
  const v = (x, y, z) => [x * hx, y * hy, z * hz];
  // faces CCW seen from outside, with a tag = original face (outer surface)
  return [
    { pts: [v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], n: [1, 0, 0], outer: true },
    { pts: [v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), v(-1, -1, -1)], n: [-1, 0, 0], outer: true },
    { pts: [v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], n: [0, 1, 0], outer: true },
    { pts: [v(-1, -1, 1), v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1)], n: [0, -1, 0], outer: true },
    { pts: [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], n: [0, 0, 1], outer: true },
    { pts: [v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1)], n: [0, 0, -1], outer: true },
  ];
}

// clip a convex polyhedron by plane n·x <= d (keep inside). Returns new face list.
export function clipPoly(faces, n, d) {
  const out = [];
  const capPts = [];
  const eps = 1e-7;
  for (const f of faces) {
    const P = f.pts, res = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const da = n[0] * a[0] + n[1] * a[1] + n[2] * a[2] - d;
      const db = n[0] * b[0] + n[1] * b[1] + n[2] * b[2] - d;
      if (da <= eps) res.push(a);
      if ((da < -eps && db > eps) || (da > eps && db < -eps)) {
        const t = da / (da - db);
        const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        res.push(p);
        capPts.push(p);
      } else if (Math.abs(da) <= eps) capPts.push(a);
    }
    if (res.length >= 3) out.push({ pts: res, n: f.n, outer: f.outer });
  }
  if (capPts.length >= 3) {
    // order cap points around their centroid in the plane
    let cx = 0, cy = 0, cz = 0;
    for (const p of capPts) { cx += p[0]; cy += p[1]; cz += p[2]; }
    cx /= capPts.length; cy /= capPts.length; cz /= capPts.length;
    // basis in plane
    let ux = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = cross(n, ux); norm(u);
    const w = cross(n, u);
    const pts = capPts.map((p) => ({ p, a: Math.atan2((p[0] - cx) * w[0] + (p[1] - cy) * w[1] + (p[2] - cz) * w[2], (p[0] - cx) * u[0] + (p[1] - cy) * u[1] + (p[2] - cz) * u[2]) }));
    pts.sort((a, b) => a.a - b.a);
    // dedupe
    const uniq = [];
    for (const q of pts) {
      const l = uniq[uniq.length - 1];
      if (!l || Math.abs(l[0] - q.p[0]) + Math.abs(l[1] - q.p[1]) + Math.abs(l[2] - q.p[2]) > 1e-6) uniq.push(q.p);
    }
    if (uniq.length >= 3) {
      // outward normal of the cap is +n; with the (u, w) basis increasing angle is CCW about n
      out.push({ pts: uniq, n: [n[0], n[1], n[2]], outer: false });
    }
  }
  return out;
}

function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; a[0] /= l; a[1] /= l; a[2] /= l; return a; }

function polyVolumeCentroid(faces) {
  // decompose into tetrahedra from an interior reference point
  let rx = 0, ry = 0, rz = 0, n = 0;
  for (const f of faces) for (const p of f.pts) { rx += p[0]; ry += p[1]; rz += p[2]; n++; }
  rx /= n; ry /= n; rz /= n;
  let V = 0, cx = 0, cy = 0, cz = 0;
  for (const f of faces) {
    const a = f.pts[0];
    for (let i = 1; i < f.pts.length - 1; i++) {
      const b = f.pts[i], c = f.pts[i + 1];
      const ax = a[0] - rx, ay = a[1] - ry, az = a[2] - rz;
      const bx = b[0] - rx, by = b[1] - ry, bz = b[2] - rz;
      const qx = c[0] - rx, qy = c[1] - ry, qz = c[2] - rz;
      const v = (ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx)) / 6;
      V += v;
      cx += v * (rx + a[0] + b[0] + c[0]) / 4; cy += v * (ry + a[1] + b[1] + c[1]) / 4; cz += v * (rz + a[2] + b[2] + c[2]) / 4;
    }
  }
  if (Math.abs(V) < 1e-12) return { V: 0, c: [rx, ry, rz] };
  return { V: Math.abs(V), c: [cx / V, cy / V, cz / V] };
}

// Fracture a box (half extents) into Voronoi cells. seeds: array of [x,y,z] in local coords.
export function voronoiCells(hx, hy, hz, seeds, maxNeighbors = 14) {
  const cells = [];
  for (let i = 0; i < seeds.length; i++) {
    const si = seeds[i];
    const others = [];
    for (let j = 0; j < seeds.length; j++) {
      if (j === i) continue;
      const sj = seeds[j];
      const d2 = (sj[0] - si[0]) ** 2 + (sj[1] - si[1]) ** 2 + (sj[2] - si[2]) ** 2;
      others.push([d2, sj]);
    }
    others.sort((a, b) => a[0] - b[0]);
    let faces = boxPolyhedron(hx, hy, hz);
    for (let k = 0; k < Math.min(maxNeighbors, others.length); k++) {
      const sj = others[k][1];
      const n = norm([sj[0] - si[0], sj[1] - si[1], sj[2] - si[2]]);
      const mid = [(si[0] + sj[0]) / 2, (si[1] + sj[1]) / 2, (si[2] + sj[2]) / 2];
      const d = n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2];
      faces = clipPoly(faces, n, d);
      if (faces.length < 4) break;
    }
    if (faces.length < 4) continue;
    const { V, c } = polyVolumeCentroid(faces);
    if (V < 1e-7) continue;
    cells.push({ faces, volume: V, centroid: c });
  }
  return cells;
}

// Generate seeds biased toward an impact point (local coords), count n.
export function impactSeeds(hx, hy, hz, impact, n, rng, focus = 0.6) {
  const seeds = [];
  const sx = Math.max(hx, 0.05), sy = Math.max(hy, 0.05), sz = Math.max(hz, 0.05);
  const sigma = Math.max(sx, sy, sz) * 0.35;
  for (let i = 0; i < n; i++) {
    let p;
    if (impact && rng.next() < focus) {
      p = [impact[0] + rng.gauss() * sigma * (0.3 + rng.next()), impact[1] + rng.gauss() * sigma * (0.3 + rng.next()), impact[2] + rng.gauss() * sigma * (0.3 + rng.next())];
      p[0] = Math.max(-sx * 0.98, Math.min(sx * 0.98, p[0]));
      p[1] = Math.max(-sy * 0.98, Math.min(sy * 0.98, p[1]));
      p[2] = Math.max(-sz * 0.98, Math.min(sz * 0.98, p[2]));
    } else p = [(rng.next() * 2 - 1) * sx * 0.98, (rng.next() * 2 - 1) * sy * 0.98, (rng.next() * 2 - 1) * sz * 0.98];
    seeds.push(p);
  }
  return seeds;
}

// Glass: 2D pattern in the pane plane (local x,y), extruded in z by thickness.
export function glassSeeds(hx, hy, impact, n, rng) {
  const seeds = [];
  const ix = impact ? impact[0] : (rng.next() - 0.5) * hx, iy = impact ? impact[1] : (rng.next() - 0.5) * hy;
  const R = Math.hypot(hx, hy) * 2;
  const rings = Math.max(2, Math.round(Math.sqrt(n) * 0.9));
  let k = 0;
  for (let r = 0; r < rings && k < n; r++) {
    const rad = R * Math.pow((r + 0.5) / rings, 1.8);
    const cnt = Math.max(3, Math.round((n / rings) * (0.6 + r / rings)));
    for (let i = 0; i < cnt && k < n; i++, k++) {
      const a = (i + rng.next() * 0.7) / cnt * Math.PI * 2;
      const x = Math.max(-hx * 0.98, Math.min(hx * 0.98, ix + Math.cos(a) * rad * (0.8 + rng.next() * 0.4)));
      const y = Math.max(-hy * 0.98, Math.min(hy * 0.98, iy + Math.sin(a) * rad * (0.8 + rng.next() * 0.4)));
      seeds.push([x, y, 0]);
    }
  }
  return seeds;
}

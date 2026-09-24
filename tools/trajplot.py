#!/usr/bin/env python3
"""Plot fighter trajectories: top view + effector-to-target distances.  trajplot.py traj.json out.png [marks=w1,w2,...]"""
import json, sys, math
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1])); out = sys.argv[2]
marks = [float(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 and sys.argv[3] else []
W, H = 1600, 900
img = Image.new('RGB', (W, H), (16, 16, 20)); dr = ImageDraw.Draw(img)
# top view (left half)
xs = [r[f]['hips'][0] for r in d for f in 'kg']; zs = [r[f]['hips'][2] for r in d for f in 'kg']
cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
span = max(max(xs) - min(xs), max(zs) - min(zs), 4) * 1.15
S = 760 / span
def tp(p): return (400 + (p[0] - cx) * S, 450 + (p[2] - cz) * S)
for k in range(-60, 61, 2):
    x0 = tp([k, 0, -1e3]); dr.line([(400 + (k - cx) * S, 40), (400 + (k - cx) * S, 860)], fill=(30, 30, 36) if k % 10 else (50, 50, 60))
    dr.line([(20, 450 + (k - cz) * S), (780, 450 + (k - cz) * S)], fill=(30, 30, 36) if k % 10 else (50, 50, 60))
for f, col in (('k', (90, 180, 255)), ('g', (255, 120, 70))):
    pts = [tp(r[f]['hips']) for r in d]
    dr.line(pts, fill=col, width=2)
    for i in range(0, len(d), max(1, len(d) // 20)):
        p = tp(d[i][f]['hips']); dr.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill=col); dr.text((p[0] + 4, p[1] - 12), f"{d[i]['w']:.1f}", fill=col)
dr.text((20, 10), f"top view  x right, z down   grid 2 m   center ({cx:.1f},{cz:.1f})", fill=(200, 200, 200))
# distances (right half)
t0, t1 = d[0]['w'], d[-1]['w']
def gx(w): return 830 + (w - t0) / max(1e-6, t1 - t0) * 740
def gy(v): return 860 - min(v, 4) / 4 * 800
for v in [0, 0.25, 0.5, 1, 2, 3, 4]:
    dr.line([(830, gy(v)), (1570, gy(v))], fill=(40, 40, 48)); dr.text((800, gy(v) - 6), f"{v}", fill=(150, 150, 150))
dist = lambda a, b: math.dist(a, b)
series = [('k hand.R>g head', 'k', 'hand.R', 'g', 'head', (120, 200, 255)), ('k hand.L>g head', 'k', 'hand.L', 'g', 'head', (80, 140, 220)),
          ('k foot.R>g head', 'k', 'foot.R', 'g', 'head', (150, 255, 180)), ('k foot.R>g chest', 'k', 'foot.R', 'g', 'chest', (90, 200, 120)),
          ('g hand.R>k head', 'g', 'hand.R', 'k', 'head', (255, 140, 90)), ('hips-hips', 'k', 'hips', 'g', 'hips', (180, 180, 180))]
for i, (name, fa, ba, fb, bb, col) in enumerate(series):
    pts = [(gx(r['w']), gy(dist(r[fa][ba], r[fb][bb]))) for r in d]
    dr.line(pts, fill=col, width=2); dr.text((840, 30 + i * 14), name, fill=col)
for m in marks:
    dr.line([(gx(m), 40), (gx(m), 860)], fill=(255, 230, 80)); dr.text((gx(m) + 2, 44), f"{m:.2f}", fill=(255, 230, 80))
for w in range(math.ceil(t0), math.floor(t1) + 1):
    dr.text((gx(w) - 6, 866), str(w), fill=(170, 170, 170))
img.save(out); print(out)

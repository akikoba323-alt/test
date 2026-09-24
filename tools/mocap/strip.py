#!/usr/bin/env python3
"""Stick-figure filmstrips for mocap exploration.
   strip.py clip.json out.png [t0] [t1] [step] [azimuth_deg]"""
import json, math, sys
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))
t0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
t1 = float(sys.argv[4]) if len(sys.argv) > 4 else d['dur']
step = float(sys.argv[5]) if len(sys.argv) > 5 else 0.2
az = math.radians(float(sys.argv[6]) if len(sys.argv) > 6 else 35)
K = {k: i for i, k in enumerate(d['keys'])}
EDGES = [('Hips', 'Spine1'), ('Spine1', 'Neck1'), ('Neck1', 'Head'), ('Spine1', 'LeftArm'), ('LeftArm', 'LeftForeArm'), ('LeftForeArm', 'LeftHand'),
         ('Spine1', 'RightArm'), ('RightArm', 'RightForeArm'), ('RightForeArm', 'RightHand'), ('Hips', 'LeftUpLeg'), ('LeftUpLeg', 'LeftLeg'), ('LeftLeg', 'LeftFoot'),
         ('LeftFoot', 'LeftToeBase'), ('Hips', 'RightUpLeg'), ('RightUpLeg', 'RightLeg'), ('RightLeg', 'RightFoot'), ('RightFoot', 'RightToeBase')]
W, H = int(__import__("os").environ.get("SW", 150)), int(__import__("os").environ.get("SH", 190))
dt = d['dt']
frames = d['frames']
idxs = []
t = t0
while t <= min(t1, d['dur'] - dt) + 1e-6:
    idxs.append(min(len(frames) - 1, int(round(t / dt))))
    t += step
cols = min(int(__import__("os").environ.get("SC", 12)), len(idxs))
rows = (len(idxs) + cols - 1) // cols
img = Image.new('RGB', (cols * W, rows * H + 20), (18, 18, 22))
dr = ImageDraw.Draw(img)
dr.text((4, 4), f"{d['file']}  {t0:.2f}-{t1:.2f}s step {step}  az {math.degrees(az):.0f}", fill=(220, 220, 220))
ca, sa = math.cos(az), math.sin(az)
def proj(p, cx, cy, hx, hz):
    x, y, z = p[0] - hx, p[1], p[2] - hz
    u = x * ca - z * sa
    w = x * sa + z * ca
    return (cx + u * 55, cy - y * 55 + w * 8)
ev = d.get('events', [])
for n, fi in enumerate(idxs):
    r, c = divmod(n, cols)
    ox, oy = c * W, r * H + 20
    fr = frames[fi]
    hx, hz = fr[K['Hips']][0], fr[K['Hips']][2]
    cx, cy = ox + W / 2, oy + H - 22
    dr.line([(ox + 5, cy), (ox + W - 5, cy)], fill=(60, 60, 70))
    for a, b in EDGES:
        pa, pb = proj(fr[K[a]], cx, cy, hx, hz), proj(fr[K[b]], cx, cy, hx, hz)
        col = (90, 180, 255) if 'Left' in a or 'Left' in b else (255, 120, 90) if 'Right' in a or 'Right' in b else (230, 230, 230)
        dr.line([pa, pb], fill=col, width=3)
    hp = proj(fr[K['Head']], cx, cy, hx, hz)
    dr.ellipse([hp[0] - 6, hp[1] - 9, hp[0] + 6, hp[1] + 3], outline=(230, 230, 230), width=2)
    tt = fi * dt
    mark = [e for e in ev if abs(e['ext'] - tt) < step / 2]
    dr.text((ox + 4, oy + 2), f"{tt:.2f}", fill=(255, 220, 90) if mark else (160, 160, 170))
    if mark:
        dr.text((ox + 4, oy + 14), ' '.join(e['limb'] for e in mark), fill=(255, 220, 90))
    dr.text((ox + 4, oy + H - 16), f"x{hx:+.1f} z{hz:+.1f} y{fr[K['Hips']][1]:.2f}", fill=(120, 120, 130))
img.save(out)
print(out, img.size)

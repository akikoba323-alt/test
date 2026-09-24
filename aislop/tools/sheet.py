# Contact sheet: python3 sheet.py COLS OUT t1 t2 ... -- f1 f2 ...
import sys
from PIL import Image, ImageDraw
cols = int(sys.argv[1]); out = sys.argv[2]
k = sys.argv.index('--')
times = sys.argv[3:k]; files = sys.argv[k + 1:]
ims = [Image.open(f) for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
pad = 6
sheet = Image.new('RGB', (cols * (w + pad) + pad, rows * (h + pad + 18) + pad), (40, 40, 44))
d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x = pad + (i % cols) * (w + pad); y = pad + (i // cols) * (h + pad + 18)
    sheet.paste(im, (x, y + 18))
    d.text((x + 2, y + 3), f't={float(times[i]):.2f}' if i < len(times) else '', fill=(230, 230, 230))
sheet.save(out, quality=88)
print('sheet', out, sheet.size)

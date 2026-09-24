# Contact sheet: python3 sheet.py COLS OUT.png frame1.png frame2.png ...
import sys
from PIL import Image, ImageDraw
cols = int(sys.argv[1]); out = sys.argv[2]; files = sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
scale = min(1.0, 1800 / (w * cols))
tw, th = int(w * scale), int(h * scale)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (tw * cols + (cols - 1) * 4, th * rows + (rows - 1) * 4), (40, 40, 40))
d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x, y = (i % cols) * (tw + 4), (i // cols) * (th + 4)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
    d.text((x + 6, y + 4), str(i), fill=(255, 255, 0))
sheet.save(out)
print('sheet ->', out)

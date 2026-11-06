#!/usr/bin/env python3
"""Finds character images that look alike (same face recoloured, same pose) so they can be redrawn.
    python3 tools/lookalikes.py            # prints the closest pairs and writes /tmp/lookalikes.png (side by side)
Uses a coarse structure hash + colour layout. Always eyeball the sheet: the numbers only shortlist.
"""
import glob, itertools, os, sys
from PIL import Image, ImageDraw
root = os.path.join(os.path.dirname(__file__), '..', 'assets', 'characters')
files = sorted(glob.glob(os.path.join(root, '*.jpg')))
def feats(f):
    im = Image.open(f).convert('RGB')
    g = im.convert('L').resize((9, 8)); px = list(g.get_flattened_data() if hasattr(g, 'get_flattened_data') else g.getdata())
    dh = [1 if px[r * 9 + c] > px[r * 9 + c + 1] else 0 for r in range(8) for c in range(8)]
    return dh
F = {os.path.basename(f)[:-4]: feats(f) for f in files}
res = sorted((sum(x != y for x, y in zip(F[a], F[b])), a, b) for a, b in itertools.combinations(F, 2))
top = res[:int(sys.argv[1]) if len(sys.argv) > 1 else 12]
for d, a, b in top: print(f'{a:15s} {b:15s} distance {d}')
W = 180
sheet = Image.new('RGB', (W * 2 * 3 + 40, (W + 24) * ((len(top) + 2) // 3)), (20, 20, 20)); dr = ImageDraw.Draw(sheet)
for i, (d, a, b) in enumerate(top):
    x, y = (i % 3) * (W * 2 + 13), (i // 3) * (W + 24)
    for k, n in enumerate((a, b)): sheet.paste(Image.open(os.path.join(root, n + '.jpg')).convert('RGB').resize((W, W)), (x + k * W, y + 16))
    dr.text((x + 4, y + 2), f'{a} | {b} ({d})', fill=(255, 255, 255))
sheet.save('/tmp/lookalikes.png'); print('sheet: /tmp/lookalikes.png')

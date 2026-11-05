#!/usr/bin/env python3
"""Prepare a character image for the game:
    python3 tools/prep-image.py <source> <character_id> [left top right bottom]
Crops (optionally to the given box), pads to a square with a blurred copy of itself,
resizes to 768x768 and saves assets/characters/<id>.jpg. Then run: node tools/scan-images.js
"""
import sys, os
from PIL import Image, ImageFilter
src, cid = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
if len(sys.argv) >= 7:
    im = im.crop(tuple(int(v) for v in sys.argv[3:7]))
w, h = im.size
S = max(w, h)
if w != h:   # pad to square with a blurred copy instead of empty bars
    bg = im.resize((S, S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(S // 12))
    bg.paste(im, ((S - w) // 2, (S - h) // 2)); im = bg
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'characters', cid + '.jpg')
im.resize((768, 768), Image.LANCZOS).save(out, quality=92)
print('saved', os.path.normpath(out))

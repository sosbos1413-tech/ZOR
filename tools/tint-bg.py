#!/usr/bin/env python3
"""Replace a flat white/grey portrait background with the hero's world gradient (like the other heroes):
    python3 tools/tint-bg.py <id> <world> [tolerance] [--preview out.png]
Reads assets/characters/originals/<id>.jpg (the untouched art; copied there on the first run),
finds the background as the low-saturation region connected to the image border whose colour is
close to the border colour, feathers that mask and paints the world gradient under the character
(keeping a little of the original shading so walls/texture still read). Writes assets/characters/<id>.jpg.
"""
import sys, os, shutil
import numpy as np
from PIL import Image, ImageFilter

WORLD = {  # colour from core/data.js WORLDS, dark end like the in-game portrait gradient (#1a1412)
    'ember': (255, 122, 69), 'tide': (62, 201, 255), 'neon': (196, 92, 255), 'sylvan': (82, 214, 124)}
DARK = np.array((26, 20, 18), float)

preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
args = [a for a in sys.argv[1:] if not a.startswith('--') and a != preview]
cid, world = args[0], args[1]
tol = float(args[2]) if len(args) > 2 else 28
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'characters')
src, orig = os.path.join(root, cid + '.jpg'), os.path.join(root, 'originals', cid + '.jpg')
if not os.path.exists(orig):
    os.makedirs(os.path.dirname(orig), exist_ok=True); shutil.copyfile(src, orig)

im = np.asarray(Image.open(orig).convert('RGB')).astype(float)
H, W, _ = im.shape
border = np.concatenate([im[:4].reshape(-1, 3), im[:, :4].reshape(-1, 3), im[:, -4:].reshape(-1, 3)])
ref = np.median(border, axis=0)
sat = im.max(2) - im.min(2)
# candidates: close to the background colour (lightness may drift: walls, vignettes) and nearly grey
lum, rlum = im.mean(2), ref.mean()
cand = (np.abs(lum - rlum) < tol * 1.6) & (np.abs(im - ref).max(2) < tol * 1.9) & (sat < 22)
if '--white-rim' in sys.argv:   # the art has white outline strokes that only read as a halo once the background is coloured: take them too
    cand |= (lum >= rlum) & (sat < 12)
# grow from the top/left/right border through candidates (the bottom is usually the character's body)
mask = np.zeros((H, W), bool)
mask[0, :] = cand[0, :]; mask[:, 0] = cand[:, 0]; mask[:, -1] = cand[:, -1]
while True:
    g = mask.copy()
    g[1:] |= mask[:-1]; g[:-1] |= mask[1:]; g[:, 1:] |= mask[:, :-1]; g[:, :-1] |= mask[:, 1:]
    g &= cand
    if (g == mask).all(): break
    mask = g
# close pin holes, then feather the edge
m = Image.fromarray((mask * 255).astype(np.uint8))
m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
if rlum > 150: m = m.filter(ImageFilter.MaxFilter(5))   # light backgrounds leave a pale anti-aliased fringe around the line art: eat it
m = m.filter(ImageFilter.GaussianBlur(1.6))
a = np.asarray(m).astype(float)[..., None] / 255

# world gradient: top-left world colour -> bottom-right dark (same direction as the SVG portrait gradient), with a soft glow behind the head
yy, xx = np.mgrid[0:H, 0:W] / max(H, W)
t = np.clip((xx * 0.45 + yy * 0.75) / 1.2, 0, 1)[..., None]
col = np.array(WORLD[world], float)
grad = col * 0.78 * (1 - t) + DARK * t
glow = np.exp(-(((xx - 0.5) ** 2) / 0.09 + ((yy - 0.32) ** 2) / 0.07))[..., None]
grad = grad + (col - grad) * glow * 0.35
# keep a little of the original shading (relative to the flat colour) so texture survives
shade = np.clip((lum / max(rlum, 1))[..., None], 0.6, 1.25)
bg = np.clip(grad * (0.7 + 0.3 * shade), 0, 255)
out = im * (1 - a) + bg * a
res = Image.fromarray(out.astype(np.uint8))
if preview:
    res.save(preview); print('preview', preview, 'bg share %.0f%%' % (mask.mean() * 100))
else:
    res.save(src, quality=90); print('saved', os.path.normpath(src), 'bg share %.0f%%' % (mask.mean() * 100))

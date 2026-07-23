#!/usr/bin/env node
/* Resize + quantize every wheel photo under assets/wheels/.
   Manufacturer renders arrive ~1000px and 300-800KB each; the grid never
   shows them bigger than ~300px. Shrinks the set by roughly 4x.
   Requires Pillow (pip3 install pillow).  Usage: node tools/optimize-wheels.js */
const { execFileSync } = require("child_process");
const path = require("path");

const py = `
from PIL import Image
import os, glob, sys
root = sys.argv[1]
before = after = 0
n = skipped = 0
for p in sorted(glob.glob(os.path.join(root, 'assets/wheels/*/*'))):
    if not p.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
        continue
    before += os.path.getsize(p)
    try:
        im = Image.open(p)
    except Exception as e:
        print('  !! unreadable', os.path.basename(p), e); skipped += 1; continue
    # already processed: palette mode and within bounds
    if im.mode == 'P' and max(im.size) <= 680:
        after += os.path.getsize(p); continue
    im = im.convert('RGBA')
    # jpgs have no alpha - flatten onto white so cards stay clean
    dest = p
    if p.lower().endswith(('.jpg', '.jpeg')):
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
        dest = os.path.splitext(p)[0] + '.png'
    im.thumbnail((680, 680), Image.LANCZOS)
    im = im.quantize(colors=255, method=Image.FASTOCTREE)
    im.save(dest, optimize=True)
    if dest != p:
        os.remove(p)
    after += os.path.getsize(dest); n += 1
print('optimized %d images  %.1f MB -> %.1f MB  (%d skipped)' % (n, before/1e6, after/1e6, skipped))
`;

const ROOT = path.resolve(__dirname, "..");
process.stdout.write(execFileSync("python3", ["-c", py, ROOT], { encoding: "utf8" }));

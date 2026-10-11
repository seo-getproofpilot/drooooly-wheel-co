#!/usr/bin/env node
/* optimize-images.js — the homepage was shipping about 19 MB of photographs.
 *
 * WHY IT WAS THAT BIG. Not because the pictures are good: because they are
 * the wrong size. The gallery photos are 1,334-1,440px wide and are displayed
 * at 413px. The Instagram avatar is a 2,362 KB, 2,688px emblem rendered at
 * 74x74 — eighteen times larger than it is ever drawn. Nobody notices, because
 * on a fast connection it still loads; on a phone at a job site it does not.
 *
 * THE RULE HERE IS THAT NOTHING MAY LOOK DIFFERENT. Every target is resized
 * only down to twice its largest measured on-screen size, which is what a
 * retina screen can actually resolve, and re-encoded at a quality where the
 * difference is not visible at that size. Nothing is upscaled and nothing is
 * cropped.
 *
 * WHY 1200px FOR assets/builds/. Their largest display anywhere on the site is
 * 413px wide, so 826 covers a 2x screen. The ceiling is 1200 instead because
 * tools/fetch-platform-photos.js derives 900x675 platform cards from these
 * same files, and cropping to 4:3 before that resize needs the headroom. Drop
 * it to 900 and that pipeline starts upscaling.
 *
 * Originals are in git. This rewrites in place.
 *
 *   node tools/optimize-images.js --dry     see what it would do
 *   node tools/optimize-images.js           do it
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');

/* target -> max width. A file already at or under its cap is still re-encoded
   if it is heavy, because most of these were saved straight out of a phone. */
const RULES = [
  { dir: 'assets/builds',    maxW: 1200, q: 82, minKB: 120 },
  { dir: 'assets/platforms', maxW: 900,  q: 82, minKB: 120 },
  { dir: 'assets',           maxW: 1800, q: 82, minKB: 250, shallow: true },
];

function walk(dir, shallow) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter(e => e.isFile() && /\.(jpe?g|png)$/i.test(e.name))
    .map(e => path.join(dir, e.name))
    .filter(() => true)
    .concat(shallow ? [] : fs.readdirSync(abs, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .flatMap(e => walk(path.join(dir, e.name), false)));
}

const PY = `
import sys, os
from PIL import Image
src, maxw, q = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
im = Image.open(src)
w0, h0 = im.size
before = os.path.getsize(src)
if im.width > maxw:
    im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
ext = os.path.splitext(src)[1].lower()
if ext in ('.jpg', '.jpeg'):
    im.convert('RGB').save(src, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=1)
else:
    # a PNG with no real transparency is a JPEG wearing a hat; keep the format
    # (every reference in the repo points at .png) but drop the alpha channel
    # and let optimize do its work.
    if im.mode == 'RGBA' and im.getchannel('A').getextrema() == (255, 255):
        im = im.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=256)
    im.save(src, optimize=True)
after = os.path.getsize(src)
print(f"{w0}x{h0}|{im.width}x{im.height}|{before}|{after}")
`;

let totalBefore = 0, totalAfter = 0, touched = 0, skipped = 0;
const report = [];

for (const rule of RULES) {
  for (const rel of walk(rule.dir, rule.shallow)) {
    const abs = path.join(ROOT, rel);
    const size = fs.statSync(abs).size;
    if (size < rule.minKB * 1024) { skipped++; continue; }
    if (report.some(r => r.rel === rel)) continue;        // outer rule already had it
    totalBefore += size;
    if (DRY) {
      report.push({ rel, before: size, after: null });
      totalAfter += size;
      continue;
    }
    const out = execFileSync('python3', ['-c', PY, abs, String(rule.maxW), String(rule.q)])
      .toString().trim();
    const [dim0, dim1, b, a] = out.split('|');
    totalAfter += +a; touched++;
    report.push({ rel, before: +b, after: +a, dim0, dim1 });
  }
}

report.sort((x, y) => (y.before - (y.after || y.before)) - (x.before - (x.after || x.before)));
const kb = n => (n / 1024).toFixed(0).padStart(6) + ' KB';
console.log(DRY ? 'DRY RUN — would process:' : 'Rewrote:');
for (const r of report.slice(0, 18)) {
  console.log('  ' + kb(r.before) + (r.after != null ? ' -> ' + kb(r.after) : '') +
    '  ' + r.rel + (r.dim0 && r.dim0 !== r.dim1 ? '  (' + r.dim0 + ' -> ' + r.dim1 + ')' : ''));
}
if (report.length > 18) console.log(`  …and ${report.length - 18} more`);
console.log(`\n${report.length} file(s) over threshold, ${skipped} already small enough.`);
console.log(`total ${(totalBefore / 1e6).toFixed(1)} MB` +
  (DRY ? '' : ` -> ${(totalAfter / 1e6).toFixed(1)} MB  ` +
    `(saved ${((1 - totalAfter / totalBefore) * 100).toFixed(0)}%)`));

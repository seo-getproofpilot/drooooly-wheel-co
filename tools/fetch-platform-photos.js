#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — a photograph of each machine, for the Price Designs chooser

   Chris sent a screenshot of pricedesigns-pd.com/pages/shop-by-collection and
   said: "this is how I want it to look when somebody goes to click on Price
   Designs Wheels, because he has so many options... obviously when they click
   on truck, it goes to truck wheel pattern, and then it asks what wheel they
   want to build, the lug pattern it's in."

   That grid is pictures of MACHINES — a Raptor, a Maverick R, a Pro R, a
   sand car — not pictures of wheels. Which is right: someone arriving at a
   brand with seven configurators knows what they drive long before they know
   which face they want, so the first question should be answerable at a
   glance from a photograph.

   WHY WE CANNOT SHOOT OUR OWN. assets/builds/ holds 40 photographs: 21 lifted
   trucks, 9 duallies, 5 lowered, 4 cars and exactly ONE UTV. The truck tile is
   therefore ours, from our own build gallery. A Maverick R, a Pro R, an X3, a
   RZR, a Defender and a sand rail are six visually distinct machines and we
   have none of them, so those six come from his page — the same images his own
   grid uses, which are also the correct machines.

   RIGHTS: six of these seven are his photography. LAUNCH-CHECKLIST 1.13, the
   same ask as his wheel renders. Two of them are literally named
   "Screenshot_2025-02-07_at_4.03.12_PM.png", so a real asset pack would
   improve the page as well as settle the rights.

   ONE TREATMENT FOR ALL SEVEN. The last version of this grid mixed a studio
   render, an Instagram close-up and a desert vehicle shot, and Chris read the
   result as broken. Mixed provenance is fine; mixed FRAMING is not. Every tile
   is centre-cropped to the same 4:3, resized to the same pixels and saved at
   the same quality, so the grid reads as one set whoever shot it.

   Usage:  node tools/fetch-platform-photos.js [--force]
   Needs:  python3 with Pillow
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUTDIR = path.join(ROOT, 'assets/platforms');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const FORCE = process.argv.includes('--force');
const W = 900, H = 675;                       // 4:3, same as the picker tile

const CDN = 'https://pricedesigns-pd.com/cdn/shop/files/';

/* builderId -> where its photograph comes from.

   `local` is one of our own build photographs; `remote` is a file from his
   shop-by-collection grid. Read 2026-10-03 off that page, which is rendered by
   JS — curl sees nothing, so these were lifted from the live DOM. */
const SOURCES = [
  { id: 'pd-truck-17x9', local: 'assets/builds/lifted-1.jpg',
    note: 'ours — assets/builds has 21 lifted trucks' },
  { id: 'pd-pro-r',      remote: CDN + 'Screenshot_2025-02-07_at_4.03.12_PM.png' },
  { id: 'pd-maverick-r', remote: CDN + 'MAVERICK_R_OPTION_1.jpg' },
  { id: 'pd-x3',         remote: CDN + 'Screenshot_2025-02-07_at_4.04.13_PM.png' },
  { id: 'pd-rzr',        remote: CDN + 'POLARIS_RZR_2.heic' },
  { id: 'pd-expedition', remote: CDN + 'IMG_3040.jpg' },
  { id: 'pd-sand-car',   remote: CDN + 'IMG_3156.jpg' }
];

fs.mkdirSync(OUTDIR, { recursive: true });

/* Centre-crop to the target aspect, then resize once. Cropping before the
   resize keeps the full sensor detail in the part we keep; resizing first and
   then cropping throws pixels away and then enlarges what is left. */
const PY = `
import sys, json
from PIL import Image, ImageOps
spec = json.loads(sys.argv[1])
im = Image.open(spec["src"])
im = ImageOps.exif_transpose(im)          # phone shots carry a rotation flag
im = im.convert("RGB")
W, H = spec["w"], spec["h"]
want = W / H
iw, ih = im.size
have = iw / ih
if have > want:                            # too wide: trim the sides
    new = int(ih * want)
    im = im.crop(((iw - new) // 2, 0, (iw + new) // 2, ih))
else:                                      # too tall: trim top and bottom,
    new = int(iw / want)                   # biased up, because the sky is
    top = int((ih - new) * 0.40)           # less interesting than the machine
    im = im.crop((0, top, iw, top + new))
im = im.resize((W, H), Image.LANCZOS)
im.save(spec["out"], "JPEG", quality=84, optimize=True, progressive=True)
print(f"{im.width}x{im.height}")
`;

let made = 0, skipped = 0, failed = [];

SOURCES.forEach(s => {
  const out = path.join(OUTDIR, s.id + '.jpg');
  process.stdout.write('  ' + s.id.padEnd(16));
  if (fs.existsSync(out) && !FORCE) { console.log('exists (--force to rebuild)'); skipped++; return; }

  let src;
  if (s.local) {
    src = path.join(ROOT, s.local);
    if (!fs.existsSync(src)) { console.log('MISSING ' + s.local); failed.push(s.id); return; }
  } else {
    /* .heic will not open in Pillow without a plugin, so ask his CDN for a
       jpg — Shopify's image service converts on the fly via the format param,
       which is also how his own page serves it to a browser. */
    const url = /\.heic$/i.test(s.remote) ? s.remote + '?format=jpg' : s.remote;
    src = path.join(OUTDIR, '.src-' + s.id + path.extname(url.split('?')[0]).replace('.heic', '.jpg'));
    try {
      execFileSync('curl', ['-sS', '-L', '--max-time', '60', '-A', UA, '-o', src, url]);
      if (!fs.existsSync(src) || fs.statSync(src).size < 4000) throw new Error('too small');
    } catch (e) {
      console.log('FETCH FAILED ' + String(e.message || e).slice(0, 40)); failed.push(s.id); return;
    }
  }

  try {
    const dims = execFileSync('python3', ['-c', PY, JSON.stringify({ src: src, out: out, w: W, h: H })],
      { encoding: 'utf8' }).trim();
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(`${dims} · ${kb}KB${s.local ? '  (ours)' : '  (his)'}`);
    made++;
  } catch (e) {
    console.log('CONVERT FAILED ' + String(e.message || e).split('\n')[0].slice(0, 50));
    failed.push(s.id);
  }
  if (!s.local) { try { fs.unlinkSync(src); } catch (e) {} }
});

console.log(`\n  ${made} written, ${skipped} already there` +
            (failed.length ? `, ${failed.length} FAILED: ${failed.join(', ')}` : ''));
if (failed.length) process.exit(1);
console.log('  next: node tools/build-builders.js');

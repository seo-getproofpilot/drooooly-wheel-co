#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — replace a generic wheel photo with the real one

   Chris: "there are a few wheels on the front page ... you click on them, and
   the first image looks different than the wheels after you click on it. It
   pulls up a totally different wheel ... go through all the wheels and make
   sure that they're correct."

   THE FRONT PAGE WAS THE EASY HALF. The eight showcase cards carried their
   own hand-placed photographs at assets/wheels/<brand>-<model>.png while the
   wheel pages used the catalogue's at assets/wheels/<brand>/<model>.png, and
   five of the seven wheels were two different files. Those cards now read
   `img` off the catalogue, so a card and its wheel page cannot disagree
   again, and tools/test-pages.js pins it.

   THIS FILE IS THE HARDER HALF: three models were pointed at GENERIC art
   with no provenance tying it to that model —

     jtx/Major                      assets/wheel-face-1.png
     american-force/Independence SS assets/wheel-americanforce.png
     hostile/H401 Sprocket          assets/wheel-hostile.png

   — a stock JTX face, a screenshot still carrying a grey backdrop and a
   "NEW" badge, and a stock Hostile wheel. Each is a real wheel by that
   brand. None of them is necessarily THE wheel named on the card, and a
   customer ordering a Major should not be looking at whatever JTX wheel
   happened to be lying around.

   Every replacement below is the manufacturer's own file, found on that
   model's own product page, and the `why` says how it is tied to the model —
   which is the standard tools/scrape-american-force.js already sets:
   "Never match on names alone across brands."

   Usage:  node tools/fix-wheel-art.js [--dry]
   Needs:  python3 with Pillow
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const DRY = process.argv.includes('--dry');

const FIXES = [
  {
    brand: 'jtx', model: 'Major',
    was: 'assets/wheel-face-1.png',
    url: 'https://jtxforged.com/wp-content/uploads/2024/05/26-AST-DUALLY-MAJOR-FRONT-P.png',
    page: 'https://jtxforged.com/major-dually/',
    why: 'JTX name the file 26-AST-DUALLY-MAJOR-FRONT-P — the 26" dually ' +
         'Major front in polished. The model is in the filename AND it is ' +
         'the only art on their Major page.'
  },
  {
    brand: 'american-force', model: 'Independence SS',
    was: 'assets/wheel-americanforce.png',
    url: 'https://www.americanforce.com/media/catalog/product/7/8/' +
         '781db9b835ea3f61d4d0c785a6d2bec9b3ee911401f7023ae8683f4cf65bf4b3.jpeg',
    page: 'https://www.americanforce.com/american-force-aw-11-independence-ss',
    why: 'American Force hash their media filenames, so the filename proves ' +
         'nothing. This is the canonical product image declared in the ' +
         'JSON-LD of the 11 INDEPENDENCE SS page — the manufacturer saying ' +
         'which render belongs to which wheel, same basis as ' +
         'tools/scrape-american-force.js.'
  },
  {
    brand: 'hostile', model: 'H401 Sprocket',
    was: 'assets/wheel-hostile.png',
    url: 'https://images.iconfigurators.app/images/wheels/large/' +
         'H401-22X8-F-Asphalt-500_2375_4598.png',
    page: 'https://hostilewheels.com/wheel/15221/hostile-h401-sprocket/',
    why: 'Named H401-22X8-F-Asphalt: the H401 in 22x8 front, asphalt finish. ' +
         'Hostile carry three Sprockets — H108, H401 and HF108 — so the part ' +
         'number in the filename is what separates this from the other two.'
  },
  {
    brand: 'fuel', model: 'FF19',
    was: 'assets/wheels/fuel-ff19.png',
    url: 'https://www.fueloffroad.com/media/catalog/product/f/f/' +
         'ff19_22x12_polished_a1_1000_8558.png',
    page: 'https://www.fueloffroad.com/fuel-forged-ff19',
    why: 'Named ff19_22x12_polished — the model, the size and the finish. ' +
         'Replaces a hand-placed file that sat outside the brand folder with ' +
         'no record of where it came from.'
  },
  {
    brand: 'hostile', model: 'HF08 Savage',
    was: 'assets/wheels/hostile-savage.png',
    url: 'https://images.iconfigurators.app/images/wheels/large/' +
         'hostile-hf08-wheel-6lug-polished-26x16-500_5012.png',
    page: 'https://hostilewheels.com/wheel/13857/hostile-hf08-savage/',
    why: 'Named hostile-hf08-...-26x16: the HF08 specifically, which matters ' +
         'because Hostile also build an H108 and an HF108 Sprocket.'
  },
  {
    brand: 'amani', model: 'Napoliano',
    was: 'assets/wheels/amani-napoliano.png',
    local: 'assets/wheels/amani-napoliano.png',
    page: null,
    why: 'MOVED, NOT RESOURCED. Amani do not list a Napoliano on their ' +
         'in-stock pages or their sitemap, so there is no product page to ' +
         'take it from. The only thing tying this photo to the model is its ' +
         'own filename, which is weaker evidence than the rest of this list ' +
         'and is why it is called out here rather than passed off as sourced. ' +
         'It moves into the brand folder so the catalogue is consistent; ' +
         'ask Amani for the real render, or drop the model.'
  }
];

/* Same treatment as every other card photo, so the set stays one set:
   knock out a white studio background from the edges inward, cap at 680px,
   quantize. Lifted verbatim from tools/build-featured.js. */
const NORMALIZE_PY = `
from PIL import Image, ImageDraw
import os, sys

def debg(im, tol=30):
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    pts = []
    for i in range(0, w, max(1, w // 24)):
        pts += [(i, 0), (i, h - 1)]
    for j in range(0, h, max(1, h // 24)):
        pts += [(0, j), (w - 1, j)]
    light = [p for p in pts if px[p][0] > 228 and px[p][1] > 228 and px[p][2] > 228]
    if len(light) < len(pts) * 0.45:
        return im
    for s in light:
        try: ImageDraw.floodfill(im, s, (0,0,0,0), thresh=tol)
        except Exception: pass
    return im

for raw in sys.argv[1:]:
    dest = raw.replace('.raw.', '.').rsplit('.', 1)[0] + '.png'
    im = Image.open(raw).convert('RGBA')
    if min(im.getchannel('A').getdata()) > 250:
        im = debg(im)
    im.thumbnail((680, 680), Image.LANCZOS)
    im.quantize(colors=255, method=Image.FASTOCTREE).save(dest, optimize=True)
    os.remove(raw)
`;

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'brands.js'), 'utf8'), ctx);
const BRANDS = ctx.window.BRANDS;

let done = 0;
const pending = [];
FIXES.forEach(f => {
  const brand = BRANDS.filter(b => b.slug === f.brand)[0];
  const model = brand && brand.models.filter(m => m.model === f.model)[0];
  if (!model) { console.log('  ' + f.brand + '/' + f.model + ': not in the catalogue'); return; }
  if (model.img !== f.was) {
    console.log('  ' + f.brand + '/' + f.model + ': already points at ' + model.img + ', left alone');
    return;
  }
  const dir = path.join(ROOT, 'assets/wheels', f.brand);
  const rel = 'assets/wheels/' + f.brand + '/' + slug(f.model) + '.png';
  console.log('\n  ' + f.brand + '/' + f.model);
  console.log('      was   ' + f.was);
  console.log('      now   ' + rel);
  console.log('      from  ' + f.page);
  console.log('      why   ' + f.why);
  if (DRY) return;

  fs.mkdirSync(dir, { recursive: true });
  if (f.local) {
    /* Already on disk and unsourceable — move it where it belongs and leave
       imgSource unset, so `imgSource` means "we know where this came from"
       and its absence is not quietly the same thing. */
    const src = path.join(ROOT, f.local);
    if (!fs.existsSync(src)) { console.log('      MISSING ' + f.local); return; }
    fs.copyFileSync(src, path.join(ROOT, rel));
    model.img = rel;
    done++;
    console.log('      moved (provenance: filename only)');
    return;
  }
  const ext = (f.url.match(/\.(png|jpe?g|webp)(?:\?|$)/i) || [, 'png'])[1].toLowerCase();
  const raw = path.join(dir, slug(f.model) + '.raw.' + ext);
  try {
    const code = execFileSync('curl', ['-sS', '-L', '--max-time', '40', '-A', UA,
      '-o', raw, '-w', '%{http_code}', f.url], { encoding: 'utf8' }).trim();
    if (code !== '200' || !fs.existsSync(raw) || fs.statSync(raw).size < 2000) {
      console.log('      FETCH FAILED (' + code + ')');
      if (fs.existsSync(raw)) fs.unlinkSync(raw);
      return;
    }
  } catch (e) { console.log('      FETCH FAILED ' + e.message); return; }
  pending.push(raw);
  model.img = rel;
  model.imgSource = f.page;          // provenance, written into brands.js
  done++;
});

if (pending.length) {
  execFileSync('python3', ['-c', NORMALIZE_PY].concat(pending), { stdio: 'inherit' });
  pending.forEach(r => {
    const out = r.replace('.raw.', '.').replace(/\.[^.]+$/, '.png');
    const kb = fs.existsSync(out) ? Math.round(fs.statSync(out).size / 1024) : 0;
    console.log('  wrote ' + path.relative(ROOT, out) + '  ' + kb + 'KB');
  });
}

if (!DRY && done) {
  fs.writeFileSync(path.join(ROOT, 'brands.js'),
    require('./lib/serialize-brands').serialize(BRANDS));
  console.log('\n  ' + done + ' model(s) repointed; brands.js written');
  console.log('  next: node tools/qc-catalog.js && node tools/test-pages.js');
} else if (DRY) {
  console.log('\n  --dry, nothing written');
}

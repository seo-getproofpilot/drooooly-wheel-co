#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — a real photograph for every wheel we can get one for

   Chris: "do your absolute best to go through everybody you can to get photos
   of the wheels and proper designs... keep in mind when we're applying to
   dealers that they're gonna be given this site link."

   182 of 775 models had no photograph and fell back to a drawn neutral mark.
   That mark is honest, but a brand rep opening their own page and finding
   half their line as grey outlines is not the pitch.

   THE RULE IS THE SAME ONE tools/fix-wheel-art.js set, and it is the whole
   reason this is a tool and not a bulk download: a photo is only used when
   the page it came from is KNOWN to be that model's. In practice that means
   one of two things —

     the URL was VERIFIED by tools/scrape-wheel-sizes.js, i.e. that page
     returned that model's own size table, or

     the filename names the model (KG1 serve LUXOR.png on the Luxor page)

   — and never "the first product image on a page that might be the right
   one". Matching art by filename across brands once offered an American
   Force "Dynamo" a Fuel photograph.

   Every fetch records `imgSource`, so a photo with no recorded source is
   visibly a photo nobody checked.

   Usage:  node tools/fetch-wheel-photos.js [--brand <slug>] [--dry] [--limit N]
           --dry  resolve and report, download nothing
   Writes: assets/wheels/<brand>/<model>.png, then brands.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const DRY = process.argv.includes('--dry');
const ONLY = process.argv.indexOf('--brand') > -1 ? process.argv[process.argv.indexOf('--brand') + 1] : null;
const LIMIT = process.argv.indexOf('--limit') > -1 ? +process.argv[process.argv.indexOf('--limit') + 1] : Infinity;

const CACHE = path.join(require('os').tmpdir(), 'drooooly-photo-cache');
fs.mkdirSync(CACHE, { recursive: true });
function get(url) {
  const key = path.join(CACHE, require('crypto').createHash('sha1').update(url).digest('hex'));
  if (fs.existsSync(key)) return fs.readFileSync(key, 'utf8');
  try {
    const body = execFileSync('curl', ['-sS', '-L', '--compressed', '--max-time', '35', '-A', UA, url],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    fs.writeFileSync(key, body);
    return body;
  } catch (e) { return ''; }
}
const sleep = ms => { try { execFileSync('sleep', [String(ms / 1000)]); } catch (e) {} };
const slugOf = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- image pickers, per page shape ---------------------------------- */
function jsonLdImage(html) {
  const m = /"image"\s*:\s*"([^"]{12,})"/.exec(html);
  if (!m) return null;
  const u = m[1].replace(/\\\//g, '/');
  return /^https?:\/\//.test(u) ? u.split('?')[0] : null;
}
function ogImage(html) {
  let m = /property=["']og:image["'][^>]*content=["']([^"']+)/.exec(html) ||
          /content=["']([^"']+)["'][^>]*property=["']og:image/.exec(html);
  if (!m) return null;
  const u = m[1].replace(/&amp;/g, '&').split('?')[0];
  return /^https?:\/\//.test(u) ? u : null;
}

/* ---- where a verified page URL comes from ---------------------------
   data/sizes keys its models by whatever the scraper could key on: our own
   model name for the Wheel Pros brands, a part code for Vision ("56", not
   "56 Midway"). So the index is built under every spelling the shared
   part-key rule produces, and our model is looked up the same way. */
const { partKey } = require('./lib/part-key');

function verifiedUrls(slug, brand) {
  const out = {};
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sizes', slug + '.json'), 'utf8'));
    j.models.forEach(m => {
      /* VERIFIED means the page gave up this model's own size table. A URL
         that was merely tried and returned nothing proves nothing about
         whose wheel is pictured on it — three Fuel models share the
         fallback "fuel-1pc-d", and using that would be a guess. */
      const sized = Object.keys(m.byConfig || {}).some(k => (m.byConfig[k] || []).length);
      if (!sized || !m.urls || !m.urls[0]) return;
      const raw = String(m.match);
      [raw, partKey(brand, raw)].forEach(k => { if (k && !out[k]) out[k] = m.urls[0]; });
    });
  } catch (e) {}
  return out;
}

/* ---- per-brand resolvers -------------------------------------------- */
const RESOLVE = {
  /* Wheel Pros brands declare the canonical product render in JSON-LD. */
  'fuel':           { pick: jsonLdImage },
  'black-rhino':    { pick: jsonLdImage },
  'kmc':            { pick: jsonLdImage },
  'american-force': { pick: jsonLdImage },

  /* KG1 name the file after the model — LUXOR.png on the Luxor page — so the
     page URL and the filename agree with each other and with us. */
  'kg1': { pick: ogImage, wantName: true },

  /* Vision's SKU pages carry the render for that finish. */
  'vision': { pick: function (html) {
      const m = html.match(/https:\/\/[^"']*visionwheel[^"']*\/(?:wp-content|uploads)[^"']*?\.(?:png|jpg)/gi) || [];
      /* Their SKU pages open with a section banner — HDheader, OFFROAD_HERO —
         and the first uploads image on the page is that banner, not the
         wheel. Those names are page furniture, never a product render. */
      const prod = m.filter(u => !/logo|icon|banner|favicon|sprite|header|hero|_vw_|placeholder/i.test(u));
      return prod[0] || null;
    } },

  /* Hardrock's og:image is a social card, not the product render; take the
     product image out of the page body and fall back to og only if the body
     has nothing. */
  'hardrock': {
    pick: function (html) {
      const m = html.match(/https:\/\/hardrockoffroad\.com\/wp-content\/uploads\/[^"']*?\.(?:png|jpg)/gi) || [];
      const prod = m.filter(u => !/open-graph|logo|icon|banner|favicon/i.test(u));
      return prod[0] || ogImage(html);
    }
  },

  /* Fenix is Shopify: the product JSON lists its own images. */
  'fenix': {
    direct: function (model) {
      const code = (String(model).toUpperCase().match(/\b[A-Z]{1,4}\d{3,4}\b/) || [])[0];
      if (!code) return null;
      const tries = [code.toLowerCase() + '-flat-face', code.toLowerCase() + '-concave',
                     code.toLowerCase() + '-super-single-dually', code.toLowerCase() + '-dually'];
      for (let i = 0; i < tries.length; i++) {
        const raw = get('https://fenixforged.com/products/' + tries[i] + '.json');
        if (!raw) { sleep(200); continue; }
        let p; try { p = JSON.parse(raw).product; } catch (e) { continue; }
        if (!p) continue;
        /* the product title must still carry our part code */
        if (String(p.title).toUpperCase().indexOf(code) < 0) continue;
        const img = (p.images && p.images[0] && p.images[0].src) || (p.image && p.image.src);
        if (img) return { url: img.split('?')[0], page: 'https://fenixforged.com/products/' + tries[i],
                          why: 'Shopify product "' + p.title + '" carries the part code ' + code };
      }
      return null;
    }
  }
};

/* ---- the same normalisation every other card photo gets -------------- */
const NORMALIZE_PY = `
from PIL import Image, ImageDraw
import os, sys
def debg(im, tol=30):
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    pts = []
    for i in range(0, w, max(1, w // 24)): pts += [(i, 0), (i, h - 1)]
    for j in range(0, h, max(1, h // 24)): pts += [(0, j), (w - 1, j)]
    light = [p for p in pts if px[p][0] > 228 and px[p][1] > 228 and px[p][2] > 228]
    if len(light) < len(pts) * 0.45: return im
    for s in light:
        try: ImageDraw.floodfill(im, s, (0,0,0,0), thresh=tol)
        except Exception: pass
    return im
for raw in sys.argv[1:]:
    dest = raw.replace('.raw.', '.').rsplit('.', 1)[0] + '.png'
    im = Image.open(raw).convert('RGBA')
    if min(im.getchannel('A').getdata()) > 250: im = debg(im)
    im.thumbnail((680, 680), Image.LANCZOS)
    im.quantize(colors=255, method=Image.FASTOCTREE).save(dest, optimize=True)
    os.remove(raw)
`;

/* --------------------------------------------------------------------- */
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'brands.js'), 'utf8'), ctx);
const BRANDS = ctx.window.BRANDS;

let found = 0, fetched = 0, skipped = 0;
const pending = [], report = [];
const claims = Object.create(null);

BRANDS.forEach(brand => {
  if (ONLY && brand.slug !== ONLY) return;
  const res = RESOLVE[brand.slug];
  if (!res) return;
  const verified = verifiedUrls(brand.slug, brand);
  const want = brand.models.filter(m => !m.img);
  if (!want.length) return;
  console.log('\n' + brand.slug + '  (' + want.length + ' without a photograph)');

  want.forEach(model => {
    if (fetched >= LIMIT) return;
    let url = null, page = null, why = null;

    if (res.direct) {
      const d = res.direct(model.model);
      if (d) { url = d.url; page = d.page; why = d.why; }
    } else {
      /* EXACT MATCH ONLY. The part-NUMBER fallback that resolves a size
         table is too loose for a photograph: it maps Fuel's FF09D onto the
         FF09 page, and the D is the dually — a different wheel with an 8.25
         rear. A size matrix read off the wrong page is wrong; a photograph
         read off the wrong page is wrong AND looks right. */
      page = verified[model.model] || verified[partKey(brand, model.model)];
      if (!page) { skipped++; return; }
      const html = get(page);
      if (!html) { skipped++; return; }
      url = res.pick(html);
      why = 'canonical product image on the page that returned this model\'s own size table';
      if (url && res.wantName && norm(url).indexOf(norm(model.model.replace(/\(.*?\)/g, ''))) < 0) {
        /* KG1 promise the model name in the filename; if it is absent the
           page is not the one we think it is. */
        console.log('    ' + model.model.padEnd(26) + 'filename does not name the model — skipped');
        skipped++; return;
      }
      sleep(200);
    }

    if (!url) { skipped++; return; }
    (claims[url] = claims[url] || []).push({ brand: brand, model: model, page: page, why: why });
  });
});

/* ---- ONE PHOTOGRAPH CANNOT BE TWO WHEELS ----------------------------
   A picker that lands on page furniture returns the SAME file for every
   model on the site: Vision's HDheader banner came back for five dually
   models at once, and their 360spins.png for six. A URL claimed by more
   than one model is furniture by definition, so every claim on it is
   dropped — including the first, which is only "first" by iteration order
   and no more likely to be right than the rest. */
Object.keys(claims).forEach(function (url) {
  const cs = claims[url];
  if (cs.length === 1) return;
  console.log('\n  ' + url.replace(/^https?:\/\/[^/]+/, '').slice(-60));
  console.log('    claimed by ' + cs.length + ' models — page furniture, all dropped: ' +
    cs.map(c => c.model.model).slice(0, 4).join(', ') + (cs.length > 4 ? '…' : ''));
  skipped += cs.length;
  delete claims[url];
});

Object.keys(claims).forEach(function (url) {
  if (fetched >= LIMIT) return;
  const c = claims[url][0];
  const brand = c.brand, model = c.model, page = c.page, why = c.why;
  found++;
  console.log('  ' + (brand.slug + '/' + model.model).padEnd(34) +
    url.replace(/^https?:\/\/[^/]+/, '').slice(-46));
  report.push({ brand: brand.slug, model: model.model, url: url, page: page, why: why });
  if (DRY) return;

  (function () {
    const dir = path.join(ROOT, 'assets/wheels', brand.slug);
    fs.mkdirSync(dir, { recursive: true });
    const ext = (url.match(/\.(png|jpe?g|webp)$/i) || [, 'png'])[1].toLowerCase();
    const raw = path.join(dir, norm(model.model) + '.raw.' + ext);
    try {
      const code = execFileSync('curl', ['-sS', '-L', '--max-time', '40', '-A', UA,
        '-o', raw, '-w', '%{http_code}', url], { encoding: 'utf8' }).trim();
      if (code !== '200' || !fs.existsSync(raw) || fs.statSync(raw).size < 2500) {
        if (fs.existsSync(raw)) fs.unlinkSync(raw);
        console.log('      fetch failed (' + code + ')');
        return;
      }
    } catch (e) { return; }
    pending.push(raw);
    model.img = 'assets/wheels/' + brand.slug + '/' + norm(model.model) + '.png';
    model.imgSource = page;
    fetched++;
    sleep(250);
  })();
});

if (pending.length) {
  execFileSync('python3', ['-c', NORMALIZE_PY].concat(pending), { stdio: 'inherit' });
}

console.log('\n' + '-'.repeat(60));
console.log('  resolved an image for ' + found + ' model(s); ' + skipped + ' had no verified page');
if (!DRY && fetched) {
  fs.writeFileSync(path.join(ROOT, 'brands.js'),
    require('./lib/serialize-brands').serialize(BRANDS));
  console.log('  downloaded ' + fetched + ', brands.js written');
  console.log('  next: node tools/test-pages.js && node tools/qc-catalog.js');
} else if (DRY) {
  console.log('  --dry, nothing downloaded');
}

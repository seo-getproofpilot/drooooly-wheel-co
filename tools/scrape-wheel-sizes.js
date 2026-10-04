#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — the sizes a wheel is ACTUALLY built in

   Chris: "make sure every page has wheels and tires listed correctly, with
   all dimensions listed correctly for each wheel and tire setup."

   WHAT WAS WRONG. The size list on most models was a template, not a spec.
   Measured on the catalogue before this tool existed:

     american-force   287 models · 2 distinct size lists · 255 share one
     amani             14 models · 1 distinct size list  · all 14 identical
     kmc                7 models · 1 distinct size list  · all 7 identical
     tis               15 models · 80% of entries were a bare diameter
     vision            15 models · 100% of entries were a bare diameter
     fenix             10 models · 80% of entries were a bare diameter

   A bare "22" is a diameter, not a size — it tells a customer nothing about
   whether the wheel clears their brakes or fills their fender. And where a
   width WAS present it was often wrong in a way that matters: every "single"
   TIS model listed 20x8.25, which is a DUALLY REAR width. Nobody puts an 8.25
   on a single-rear truck. That is LAUNCH-CHECKLIST 4.12 seen from the other
   side: the configs are not wrong so much as the sizes were never real.

   Spot-checked against the manufacturers: TIS 547 2.0 is published in 20x9
   ONLY, where we listed 20x8.25 / 22 / 24. Fenix BT001 Talon is published in
   24, 26, 28 and 30 — we listed a 22 that Fenix does not make and omitted the
   28 and 30 that they do. These were not gaps. They were wrong answers.

   WHY SCRAPE RATHER THAN ASK. Every one of these brands publishes the real
   matrix on its own product pages, which is the same standard the rest of the
   repo holds itself to: tools/scrape-jtx-sizes.js, scrape-utv.js and
   scrape-price-designs.js all take the manufacturer's own declaration over a
   hand-typed list. A size list nobody can trace is how we got here.

   THREE SITES, THREE SHAPES:

     fenix    Shopify. /products/<handle>.json gives a Size option whose
              values carry the offset too: "24x10 (-25mm)". One model spans
              several products — flat-face, concave, dually, super single —
              so the handles are grouped back together by part code.

     tis      WordPress. Each wheel page carries a SIZE / OFFSET / LIP DEPTH /
              MSRP table in the markup. Sizes read "20X9" or "20×9 (NEW)".

     vision   WooCommerce. One product per finish, each listing every SKU:
              sku, finish, size ("18\" x 9\""), bolt pattern, offset, bore,
              load rating, price. The size matrix is the union across a
              model's finishes, because availability differs between them.

   ROBOTS. All three publish a sitemap and disallow none of the paths used
   here. One request at a time with a delay between, which is gentler than
   any crawl-delay they declare.

   RIGHTS. Sizes, offsets and bolt patterns are specifications — facts about
   a part, not creative work. This copies no photography and no prose.

   Usage:  node tools/scrape-wheel-sizes.js [fenix|tis|vision ...]   (default: all)
           --dry   fetch and report, write nothing
   Writes: data/sizes/<brand>.json
   Then:   node tools/wire-wheel-sizes.js   (merges into brands.js)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUTDIR = path.join(ROOT, 'data/sizes');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const DRY = process.argv.includes('--dry');
const WANT = process.argv.slice(2).filter(a => !a.startsWith('--'));
const TODAY = new Date().toISOString().slice(0, 10);

/* Cached on disk. Re-running after a parser change is the normal case — the
   first version of this tool folded Fenix's UTV product into the truck matrix
   and offered a 24x7 as a truck size — and a re-run should cost his server
   nothing. --fresh ignores the cache. */
const CACHE = path.join(require('os').tmpdir(), 'drooooly-size-cache');
const FRESH = process.argv.includes('--fresh');
fs.mkdirSync(CACHE, { recursive: true });
function get(url, tries) {
  var key = path.join(CACHE, require('crypto').createHash('sha1').update(url).digest('hex'));
  if (!FRESH && fs.existsSync(key)) return fs.readFileSync(key, 'utf8');
  tries = tries || 2;
  for (var i = 0; i < tries; i++) {
    try {
      var body = execFileSync('curl', ['-sS', '-L', '--compressed', '--max-time', '40',
        '-A', UA, url], { encoding: 'utf8', maxBuffer: 48 * 1024 * 1024 });
      fs.writeFileSync(key, body);
      return body;
    } catch (e) { if (i === tries - 1) return ''; }
  }
  return '';
}
function sleep(ms) { try { execFileSync('sleep', [String(ms / 1000)]); } catch (e) {} }
function locs(xml) {
  return (xml.match(/<loc>[^<]+<\/loc>/g) || [])
    .map(s => s.replace(/<\/?loc>/g, '').replace(/&amp;/g, '&').trim());
}
/* "24x10", "20X9", "18\" x 9\"", "19.5x6.00" all land as "20x9".
   Trailing zeros go: a 6.00 wide wheel and a 6 wide wheel are one size, and
   the catalogue already writes 8.25 rather than 8.250. */
function size(d, w) {
  var D = String(+d), W = String(+w);
  return D + 'x' + W;
}
const PLAUSIBLE = s => {
  var m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(s);
  if (!m) return false;
  var d = +m[1], w = +m[2];
  return d >= 9 && d <= 34 && w >= 4 && w <= 18 && w < d;
};

/* ---------------------------------------------------------------- fenix ---
   Shopify. One MODEL is several products and they are NOT one size matrix:

     bt001-flat-face / -concave          single rear, 10" to 16" wide
     bt001-dually                        8.25" rears on 8x200 / 10x285.75
     bt001-super-single-dually(-concave) a wide front paired with an 8.25 rear
     bt001-utv                           24x7 and 26x7 on 4x137 / 4x156

   The first version of this folded all of them together, which offered a
   24x7 UTV wheel as a truck size and made every Fenix model look identical.
   They are different CONFIGURATIONS of one face, which is exactly the
   distinction our own `configs` field carries, so they are kept apart and
   the catalogue takes the buckets its configs claim. */
function fenix() {
  var idx = locs(get('https://fenixforged.com/sitemap.xml'))
    .filter(u => /sitemap_products/.test(u));
  var urls = [];
  idx.forEach(u => { urls = urls.concat(locs(get(u))); });
  urls = urls.filter(u => /\/products\//.test(u));
  console.log('  ' + urls.length + ' product pages');

  /* Which bucket a product belongs in, read off its own title. "Super Single"
     is tested before "Dually" because the title carries both. */
  function bucketOf(title) {
    var t = title.toUpperCase();
    if (/\bUTV\b/.test(t)) return 'utv';
    if (/SUPER\s*SINGLE/.test(t)) return 'super single';
    if (/\bDUALLY\b/.test(t)) return 'dually';
    return 'single';
  }

  var models = {};
  urls.forEach(function (u, i) {
    var raw = get(u.replace(/\/?$/, '') + '.json');
    if (!raw) return;
    var p; try { p = JSON.parse(raw).product; } catch (e) { return; }
    if (!p) return;
    var code = (p.title.toUpperCase().match(/\b([A-Z]{1,4}\d{3,4})\b/) || [])[1];
    if (!code) return;
    var opt = (p.options || []).filter(o => /size/i.test(o.name))[0];
    if (!opt) return;
    var m = models[code] = models[code] || { code: code, titles: [], byConfig: {}, boltsByConfig: {}, urls: [] };
    if (m.titles.indexOf(p.title) < 0) m.titles.push(p.title);
    m.urls.push(u);
    var bucket = bucketOf(p.title);
    var into = m.byConfig[bucket] = m.byConfig[bucket] || {};

    /* The lug patterns are a fact about the CONFIGURATION too: 4x137 and
       4x156 belong to the UTV product, and listing them on the truck wheel
       told a customer we would cut a Can-Am pattern in a 24x14. */
    var lb = m.boltsByConfig[bucket] = m.boltsByConfig[bucket] || {};
    var lug = (p.options || []).filter(o => /lug|bolt/i.test(o.name))[0];
    (lug ? lug.values : []).forEach(v => String(v).split('/').forEach(b => {
      b = b.trim(); if (/^\d{1,2}x\d/.test(b)) lb[b] = 1;
    }));
    opt.values.forEach(function (v) {
      /* "24x10 (-25mm) / 24x8.25" is a super-single PAIR — the wide front and
         the 8.25 rear are both real sizes of that configuration. */
      String(v).split('/').forEach(function (part) {
        var t = /(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/.exec(part.replace(/\(.*?\)/g, ''));
        if (!t) return;
        var sz = size(t[1], t[2]);
        if (PLAUSIBLE(sz)) into[sz] = 1;
      });
    });
    if (i % 25 === 0) process.stdout.write('    ' + i + '/' + urls.length + '\r');
    sleep(80);
  });
  process.stdout.write('                    \r');
  return {
    brand: 'fenix',
    captured: TODAY,
    source: 'https://fenixforged.com — Shopify product JSON, Size + Lug Pattern options',
    note: 'One face is several products. They are kept apart by configuration ' +
          'because a 24x7 UTV wheel is not a truck size; merging them made every ' +
          'model look identical.',
    models: Object.keys(models).sort().map(function (k) {
      var m = models[k], byConfig = {}, boltsByConfig = {};
      Object.keys(m.byConfig).forEach(c => { byConfig[c] = Object.keys(m.byConfig[c]).sort(cmpSize); });
      Object.keys(m.boltsByConfig).forEach(c => { boltsByConfig[c] = Object.keys(m.boltsByConfig[c]).sort(); });
      return {
        match: k, titles: m.titles, byConfig: byConfig, boltsByConfig: boltsByConfig,
        configs: Object.keys(byConfig).sort(),
        urls: m.urls.slice(0, 8)
      };
    })
  };
}

/* ------------------------------------------------------------------ tis ---
   WordPress. The spec table is in the served markup:
     SIZE  OFFSET  LIP DEPTH  MSRP
     20X9  +01, +00, +17      $440
   "(NEW)" and footnote markers ride along with the size and are stripped. */
function tis() {
  var urls = locs(get('http://tiswheels.com/page-sitemap.xml'))
    .filter(u => /tiswheels\.com\/\d[0-9a-z]*\/$/.test(u))
    .filter(u => !/dealerprogram/.test(u));
  /* 567 and 538 are in our catalogue but not in his sitemap — try them anyway
     rather than silently dropping two models. */
  ['567', '538', '562', '564'].forEach(function (n) {
    var u = 'https://tiswheels.com/' + n + '/';
    if (urls.indexOf(u) < 0) urls.push(u);
  });
  console.log('  ' + urls.length + ' wheel pages');

  var out = [];
  urls.forEach(function (u, i) {
    var h = get(u);
    if (!h || /404/.test((h.match(/<title>([^<]*)<\/title>/i) || [])[1] || '')) {
      process.stdout.write('    miss ' + u + '\n'); sleep(400); return;
    }
    var title = ((h.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').split(/[-|]/)[0].trim();
    var text = h.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
                .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ');
    /* Only trust the region that follows the SIZE header — the page also
       carries gallery captions and a newsletter block. */
    var seg = text;
    var at = text.search(/\bSIZE\b/i);
    if (at > -1) seg = text.slice(at, at + 1400);
    var sizes = {};
    (seg.match(/\b\d{2}(?:\.\d)?\s*[xX×]\s*\d{1,2}(?:\.\d{1,2})?\b/g) || []).forEach(function (s) {
      var t = /(\d+(?:\.\d)?)\s*[xX×]\s*(\d+(?:\.\d{1,2})?)/.exec(s);
      var v = size(t[1], t[2]);
      if (PLAUSIBLE(v)) sizes[v] = 1;
    });
    var model = (u.match(/\/(\d[0-9a-z]*)\/$/) || [])[1];
    var list = Object.keys(sizes).sort(cmpSize);
    out.push({ match: model, titles: [title], byConfig: { single: list }, configs: ['single'], bolts: [], urls: [u] });
    process.stdout.write('    ' + model.padEnd(8) + (list.join(' ') || '(none found)') + '\n');
    sleep(500);
  });
  return {
    brand: 'tis',
    captured: TODAY,
    source: 'https://tiswheels.com — the SIZE / OFFSET / LIP DEPTH / MSRP table on each wheel page',
    note: 'Keyed on the model number in the URL. A page with no table yields no ' +
          'sizes rather than a guess.',
    models: out
  };
}

/* --------------------------------------------------------------- vision ---
   WooCommerce. One product per FINISH, each listing every SKU it is built in.
   A model's matrix is the union over its finishes, because a size offered in
   matte black is not always offered in chrome. */
function vision() {
  var idx = locs(get('https://visionwheel.com/sitemap.xml'))
    .filter(u => /product-sitemap/.test(u));
  var urls = [];
  idx.forEach(u => { urls = urls.concat(locs(get(u))); });
  urls = urls.filter(u => /\/product\//.test(u));
  console.log('  ' + urls.length + ' SKU pages');

  /* "/product/353-turbine-mb-12/" -> group "353-turbine". Drop the trailing
     duplicate index and the finish code, which is always the last segment. */
  var groups = {};
  urls.forEach(function (u) {
    var slug = (u.match(/\/product\/([^/]+)\//) || [])[1];
    if (!slug) return;
    var g = slug.replace(/-\d+$/, '').replace(/-[a-z]{1,7}$/, '');
    (groups[g] = groups[g] || []).push(u);
  });

  /* Only the models our catalogue carries, so this stays a 15-model fetch and
     not a 5,883-page crawl of a brand we list fifteen wheels from. */
  var WANTED = {
    '56-midway': '56', '56-midway-dually': '56D', '54-cheyenne': '54',
    '111-nemesis': '111', '181-hauler-dually': '181', '181nr-hauler-dually': '181NR',
    '401-rival-dually': '401', '408-manx-2-dually': '408', '410-korupt-dually': '410',
    '412-rocker': '412', '398-manx': '398', '398-bl-manx': '398BL',
    '403-tactical': '403', '353-turbine': '353', '375-warrior': '375'
  };
  var out = [];
  Object.keys(WANTED).forEach(function (g) {
    var list = (groups[g] || []);
    if (!list.length) { console.log('    ' + g.padEnd(22) + 'NOT IN SITEMAP'); return; }
    /* Six finishes is enough to see the whole matrix without crawling 200
       near-identical SKU pages per model. */
    var pick = list.slice(0, 6);
    var sizes = {}, bolts = {}, title = '';
    pick.forEach(function (u) {
      var h = get(u);
      if (!h) { sleep(400); return; }
      title = title || ((h.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').split('–')[0].trim();
      var text = h.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
                  .replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#8243;/g, '"')
                  .replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
      /* The SKU table writes a size as `18" x 9"`. */
      (text.match(/\b\d{2}(?:\.\d)?\s*"?\s*[xX]\s*\d{1,2}(?:\.\d{1,2})?\s*"/g) || []).forEach(function (s) {
        var t = /(\d+(?:\.\d)?)\s*"?\s*[xX]\s*(\d+(?:\.\d{1,2})?)/.exec(s);
        var v = size(t[1], t[2]);
        if (PLAUSIBLE(v)) sizes[v] = 1;
      });
      (text.match(/\b(\d{1,2})\s*[xX]\s*(\d{2,3}(?:\.\d{1,2})?)\b/g) || []).forEach(function (s) {
        var t = /(\d{1,2})\s*[xX]\s*(\d{2,3}(?:\.\d{1,2})?)/.exec(s);
        var lugs = +t[1], pcd = +t[2];
        if (lugs >= 4 && lugs <= 10 && pcd >= 95 && pcd <= 300) bolts[lugs + 'x' + pcd] = 1;
      });
      sleep(350);
    });
    var sl = Object.keys(sizes).sort(cmpSize);
    /* His own slug says which configuration it is: "56-midway" is the single
       and "56-midway-dually" is the 8.25-rear version of the same face. */
    var cfg = /-dually$/.test(g) ? 'dually' : 'single';
    var bc = {}; bc[cfg] = sl;
    out.push({ match: WANTED[g], titles: [title], byConfig: bc, configs: [cfg],
      bolts: Object.keys(bolts).sort(), urls: pick });
    console.log('    ' + g.padEnd(22) + (sl.join(' ') || '(none found)'));
  });
  return {
    brand: 'vision',
    captured: TODAY,
    source: 'https://visionwheel.com — the per-finish SKU table (sku, finish, size, bolt pattern, offset, bore, load rating)',
    note: 'A model is several products, one per finish. The matrix is their union ' +
          'over the first six finishes, since availability differs by finish.',
    models: out
  };
}

/* -------------------------------------------------- american-force ---
   Magento. Every product page carries the real spec table:

     Part# | Model | Finish | Size | Bolt Pattern | Backspace | Offset |
     Bore | Weight | Load | Lip Size | Cap | MSRP USD

   The size column writes an uppercase X — "22X12" — while the navigation
   and the cross-sell blocks elsewhere on the page use a lowercase x. That
   is the whole discriminator, and it was checked before it was trusted:
   on the DC08 Kryptik page the uppercase cells are exactly the five sizes
   in the table, and the lowercase tokens are all nav.

   THIS BRAND IS 287 OF OUR 779 MODELS and 255 of them shared one invented
   size list. The DC08 Kryptik is the one tools/test-fitment.js already
   names as a misclassified "single": we listed it as 22x8.25 / 24x8.25,
   dually rears, when American Force build it 22x12 through 26x14. The
   configs were not wrong. The sizes were never real.

   ROBOTS. americanforce.com disallows admin paths, the non-clean
   /catalog/product/view/ form, and faceted URLs. Clean product pages are
   not disallowed. One at a time, with a delay — the same terms
   tools/scrape-american-force.js already works under. */
function americanForce() {
  var urls = locs(get('https://www.americanforce.com/sitemap.xml'))
    .filter(u => /\/american-force-/.test(u));
  console.log('  ' + urls.length + ' product pages');

  var out = [];
  urls.forEach(function (u, i) {
    var h = get(u);
    if (!h) { sleep(300); return; }
    var text = h.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
                .replace(/<[^>]+>/g, '\n').replace(/&[a-z#0-9]+;/gi, ' ');
    var cells = text.split('\n').map(x => x.replace(/\s+/g, ' ').trim());

    /* the uppercase-X cells ARE the size column */
    var sizes = {};
    cells.forEach(function (c) {
      var t = /^(\d{2}(?:\.\d)?)X(\d{1,2}(?:\.\d{1,2})?)$/.exec(c);
      if (!t) return;
      var v = size(t[1], t[2]);
      if (PLAUSIBLE(v)) sizes[v] = 1;
    });
    /* THE MODEL NAME COMES FROM THE SLUG, not from the table.

       The first version took the most frequent short uppercase cell, on the
       theory that the Model column repeats on every row. It returned "NEW" —
       the badge on a new release — for the whole M-series, and a rename step
       downstream would happily have retitled four wheels to "NEW". The slug
       is the manufacturer's own and is already unambiguous. */
    var bolts = {};
    cells.forEach(function (c) {
      var t = /^(\d{1,2})\s*[xX]\s*(\d{2,3}(?:\.\d{1,2})?)$/.exec(c);
      if (t && +t[1] >= 4 && +t[1] <= 10 && +t[2] >= 95 && +t[2] <= 300) bolts[+t[1] + 'x' + +t[2]] = 1;
    });

    /* the part code our catalogue keys on, out of the slug:
       ".../american-force-aw-dc08-kryptik-dc" -> DC08 KRYPTIK DC */
    var slug = (u.match(/american-force-(?:aw-)?(.+)$/) || [])[1] || '';
    var name = slug.replace(/-/g, ' ').replace(/\b[a-z]/g, function (ch) { return ch.toUpperCase(); });
    var list = Object.keys(sizes).sort(cmpSize);
    out.push({
      match: slug.replace(/-/g, ' ').toUpperCase(),
      titles: [name],
      byConfig: { single: list }, configs: ['single'],
      bolts: Object.keys(bolts).sort(), urls: [u]
    });
    if (i % 20 === 0) process.stdout.write('    ' + i + '/' + urls.length + '\r');
    sleep(250);
  });
  process.stdout.write('                    \r');
  return {
    brand: 'american-force',
    captured: TODAY,
    source: 'https://www.americanforce.com — the Part#/Model/Finish/Size/Bolt Pattern/Offset table on each product page',
    note: 'The size column uses an uppercase X; the lowercase x tokens on the ' +
          'page are navigation. Configs are derived from the widths by ' +
          'tools/wire-wheel-sizes.js, not taken from here.',
    models: out
  };
}

/* ------------------------------------------------- wheel pros table ---
   American Force and Black Rhino are both Wheel Pros brands on Magento and
   both publish the same table in the served markup:

     Part# | Model | Finish | Size | Bolt Pattern | Backspace | Offset |
     Bore | Weight | Load | Lip Size | Cap | MSRP USD

   The size column writes an uppercase X — "17X8.5" — while the navigation
   and cross-sell blocks use a lowercase x. That is the discriminator, and it
   was checked before it was trusted on a page of each brand. */
function wheelProsTable(html) {
  const text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
                   .replace(/<[^>]+>/g, '\n').replace(/&[a-z#0-9]+;/gi, ' ');
  const cells = text.split('\n').map(x => x.replace(/\s+/g, ' ').trim());
  const sizes = {}, bolts = {};
  cells.forEach(function (c) {
    const t = /^(\d{2}(?:\.\d)?)X(\d{1,2}(?:\.\d{1,2})?)$/.exec(c);
    if (t) { const v = size(t[1], t[2]); if (PLAUSIBLE(v)) sizes[v] = 1; return; }
    const b = /^(\d{1,2})X(\d{2,3}(?:\.\d{1,2})?)$/.exec(c);
    if (b && +b[1] >= 4 && +b[1] <= 10 && +b[2] >= 95 && +b[2] <= 300) bolts[+b[1] + 'x' + +b[2]] = 1;
  });
  return { sizes: Object.keys(sizes).sort(cmpSize), bolts: Object.keys(bolts).sort() };
}

/* Our own model list, so a scraper can be driven BY the catalogue. */
function ourModels(slug) {
  const ctx = { window: {} };
  require('vm').createContext(ctx);
  require('vm').runInContext(fs.readFileSync(path.join(ROOT, 'brands.js'), 'utf8'), ctx);
  const b = (ctx.window.BRANDS || []).filter(x => x.slug === slug)[0];
  return b ? b.models.map(m => m.model) : [];
}

/* ----------------------------------------------------- black-rhino ---
   DRIVEN BY OUR MODEL NAMES, not by their sitemap, because their product
   slug IS our model name: "Aliso Dually" -> /black-rhino-hard-alloys-
   aliso-dually. All sixteen we carry resolve, so `match` is our own name and
   the wiring matches EXACTLY — no fuzzy key, which is the thing that made
   American Force unsafe to wire.

   Twelve of our sixteen claimed a single size of "16x6". Black Rhino's
   smallest cast truck wheel is a 17, and the Taleo they publish is 17x8.5,
   18x9 and 20x9. */
function blackRhino() {
  const names = ourModels('black-rhino');
  console.log('  ' + names.length + ' models in our catalogue');
  const out = [];
  names.forEach(function (name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const u = 'https://www.blackrhinowheels.com/black-rhino-hard-alloys-' + slug;
    const h = get(u);
    const got = h ? wheelProsTable(h) : { sizes: [], bolts: [] };
    out.push({
      match: name, titles: [name],
      byConfig: { single: got.sizes }, configs: ['single'],
      bolts: got.bolts, urls: [u]
    });
    console.log('    ' + name.padEnd(16) + (got.sizes.join(' ') || '(no table)'));
    sleep(400);
  });
  return {
    brand: 'black-rhino',
    captured: TODAY,
    source: 'https://www.blackrhinowheels.com — the Size/Bolt Pattern/Offset table on each product page',
    note: 'Driven by our own model names, since their product slug is our model ' +
          'name; `match` is therefore our name and the wiring needs no fuzzy key.',
    models: out
  };
}

function cmpSize(a, b) {
  var A = a.split('x').map(Number), B = b.split('x').map(Number);
  return A[0] - B[0] || A[1] - B[1];
}

const RUNNERS = { fenix: fenix, tis: tis, vision: vision,
  'american-force': americanForce, 'black-rhino': blackRhino };
const RUN = (WANT.length ? WANT : Object.keys(RUNNERS)).filter(b => RUNNERS[b]);
if (!RUN.length) { console.error('nothing to do; known brands: ' + Object.keys(RUNNERS).join(', ')); process.exit(1); }

fs.mkdirSync(OUTDIR, { recursive: true });
RUN.forEach(function (b) {
  console.log('\n' + b);
  var data = RUNNERS[b]();
  var withSizes = data.models.filter(m => Object.keys(m.byConfig || {})
    .some(c => m.byConfig[c].length)).length;
  console.log('  ' + withSizes + ' of ' + data.models.length + ' models returned a size matrix');
  if (DRY) { console.log('  --dry, not written'); return; }
  var out = path.join(OUTDIR, b + '.json');
  fs.writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
  console.log('  wrote ' + path.relative(ROOT, out));
});
if (!DRY) console.log('\nnext: node tools/wire-wheel-sizes.js');

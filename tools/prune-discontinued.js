#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — drop the wheels the manufacturer no longer makes

   Chris: "If the photos truly aren't available on their own website and the
   wheels are possibly looking like they're discontinued or no longer there,
   then just exclude them from our site for now. If they are real and there is
   real photos, I can always add that later."

   THE BAR IS EVIDENCE, NOT ABSENCE OF EFFORT. A model is removed only when
   BOTH are true:

     1. we hold no photograph of it, and
     2. we have CRAWLED that brand's own site and the model is not on it.

   Condition 2 is the one that matters, and it is why this tool carries an
   explicit list of brands rather than running over the catalogue. For a brand
   we never crawled, "no verified page" means "nobody looked", which is not
   evidence of anything. Removing on that basis would delete live product.

   WHAT THAT RULE SPARES. Vision's 111 Nemesis, 181 Hauler, 181NR, 401 Rival,
   408 Manx 2 and 410 Korupt have no photograph here — their SKU pages serve a
   section banner where the render should be — but every one of those pages
   returns 200. They are current product and they stay, listed without a
   picture, which is honest.

   WHAT IT REMOVES. American Force list 194 of our 286 in their sitemap; the
   other 92 are absent from it and 404 individually. Fuel's FF09D, FF19D and
   FF39D and the Triton D581 404 on every URL shape their own site uses.

   Nothing is lost: it is all in git, and `node tools/prune-discontinued.js
   --dry` prints exactly what would go before anything does.

   Usage:  node tools/prune-discontinued.js [--dry]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');

/* Brands whose own site we have crawled end to end, so absence from it is a
   fact about the product rather than a fact about our effort. */
const CRAWLED = {
  'american-force': 'their sitemap, 314 product pages',
  'fuel': 'their product pages, every URL shape they use',
  'black-rhino': 'their product pages, driven by our own model names',
  'kmc': 'their product pages',
  'kg1': 'their portfolio sitemap',
  'hardrock': 'their wheel pages',
  'vision': 'their product sitemap, 5,883 SKU pages',
  'tis': 'their page sitemap',
  'fenix': 'their Shopify product feed'
};

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'brands.js'), 'utf8'), ctx);
const BRANDS = ctx.window.BRANDS;

/* A model has a live page when the crawl got that model's OWN SIZE TABLE back
   from it. A recorded URL on its own is not evidence: the scrapers write down
   the first URL they tried, so Fuel's FF09D, FF19D and FF39D each carry one
   even though all three 404 — the page never answered. Requiring the table
   is what separates "their site lists this" from "we guessed an address".

   Indexed under every spelling the shared part-key rule produces, because
   data/sizes keys Vision by part code ("181") and the catalogue by name
   ("181 Hauler Dually"). Without that the six live Vision duallies read as
   absent and would have been deleted. */
const { partKey, numberKeys } = require('./lib/part-key');

function livePages(slug, brand) {
  const live = new Set();
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sizes', slug + '.json'), 'utf8'));
    j.models.forEach(m => {
      const answered = Object.keys(m.byConfig || {}).some(k => (m.byConfig[k] || []).length);
      if (!answered || !m.urls || !m.urls[0]) return;
      const raw = String(m.match);
      [raw, partKey(brand, raw)].concat(numberKeys(brand, raw))
        .forEach(k => { if (k) live.add(k); });
    });
  } catch (e) {}
  return live;
}

/* THE PART-NUMBER FALLBACK BELONGS HERE AND NOT IN THE PHOTO TOOL, and the
   asymmetry is deliberate. A loose match on a PHOTOGRAPH puts the wrong wheel
   on a card — Fuel's FF09D would wear the FF09's picture, and a dually is not
   a single. A loose match on LIVENESS only decides whether to keep a listing,
   so it errs toward keeping product that may still be sold. Deleting a live
   wheel is the worse mistake of the two. */
function isLive(live, brand, name) {
  if (live.has(name)) return true;
  const k = partKey(brand, name);
  if (k && live.has(k)) return true;
  return numberKeys(brand, name).some(c => live.has(c));
}

let removed = 0, kept = 0;
const log = [];

BRANDS.forEach(brand => {
  if (!CRAWLED[brand.slug]) return;
  const live = livePages(brand.slug, brand);
  if (!live.size) return;                    // no crawl data: do nothing
  const drop = [];
  brand.models.forEach(m => {
    if (m.img) return;                       // photographed: keep, whatever else
    if (isLive(live, brand, m.model)) { kept++; return; }   // on their site: keep
    drop.push(m);
  });
  if (!drop.length) return;
  console.log('\n' + brand.slug + '  — crawled: ' + CRAWLED[brand.slug]);
  console.log('  removing ' + drop.length + ' of ' + brand.models.length +
    ' (no photograph here, and not on their site)');
  console.log('  ' + drop.map(m => m.model).slice(0, 10).join(', ') +
    (drop.length > 10 ? ', …' : ''));
  log.push({ brand: brand.slug, n: drop.length, models: drop.map(m => m.model) });
  removed += drop.length;
  const gone = new Set(drop);
  brand.models = brand.models.filter(m => !gone.has(m));
});

console.log('\n' + '-'.repeat(62));
console.log('  ' + removed + ' model(s) removed, ' + kept +
  ' kept without a photograph because their page is still live');
const total = BRANDS.reduce((a, b) => a + b.models.length, 0);
console.log('  catalogue is now ' + total + ' models');

if (DRY) { console.log('  --dry, brands.js not written'); process.exit(0); }
if (!removed) process.exit(0);

fs.writeFileSync(path.join(ROOT, 'brands.js'),
  require('./lib/serialize-brands').serialize(BRANDS));
fs.writeFileSync(path.join(ROOT, 'data/removed-discontinued.json'),
  JSON.stringify({ when: new Date().toISOString().slice(0, 10),
    why: 'no photograph held and absent from the manufacturer\'s own site',
    brands: log }, null, 1) + '\n');
console.log('  wrote brands.js and data/removed-discontinued.json');
console.log('  next: node tools/qc-catalog.js && node tools/test-pages.js');

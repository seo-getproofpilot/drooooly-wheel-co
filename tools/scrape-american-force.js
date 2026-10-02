#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — American Force product renders

   WHY. 369 of 781 wheels had no photograph and 254 of them were American
   Force — two thirds of the whole gap in one brand. Those cards fall back to
   a CSS emblem, which reads as a broken image rather than a design choice.

   WHY A SCRAPER AND NOT A DOWNLOAD. American Force runs Magento, not Shopify,
   so there is no /products.json the way Method and Raceline have (see
   scrape-utv.js). What they do publish is a sitemap of clean product URLs and
   a JSON-LD block on each page carrying the canonical product image. That is
   the manufacturer's own declaration of which render belongs to which wheel —
   which matters, because matching art by FILENAME offered an American Force
   "Dynamo" a Fuel photo and an Amani "Empire" a JTX one. Never match on names
   alone across brands.

   ROBOTS. americanforce.com/robots.txt disallows admin paths, the non-clean
   /catalog/product/view/ form, and faceted or sorted URLs. Clean product
   pages and /media/catalog/product/ are not disallowed. We request one page
   at a time with a delay, which is more conservative than the crawl-delay
   they publish for GoogleOther.

   RIGHTS. These are American Force's renders. This makes LAUNCH-CHECKLIST 1.2
   bigger, not smaller — log it, do not quietly grow it.

   Usage:  node tools/scrape-american-force.js [--limit N] [--dry]
   Then:   node tools/optimize-wheels.js     (1000px/1MB -> 680px/~55KB)
           node tools/wire-wheel-art.js      (writes the paths into brands.js)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://www.americanforce.com';
const SITEMAP = HOST + '/sitemap.xml';
const OUTDIR = path.join(ROOT, 'assets/wheels/american-force');
const REPORT = path.join(ROOT, 'data/specs/american-force-art.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DELAY_MS = 1200;

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIMIT = (() => { const i = args.indexOf('--limit'); return i > -1 ? parseInt(args[i + 1], 10) : Infinity; })();

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function get(url, binary) {
  const a = ['-sS', '-L', '--max-time', '45', '-A', UA, url];
  return execFileSync('curl', binary ? a.concat(['--output', '-']) : a,
    { encoding: binary ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/* ---- 1. our side: which models still have no art --------------------- */
global.window = {};
require(path.join(ROOT, 'brands.js'));
const af = (global.window.BRANDS || []).find(b => b.slug === 'american-force');
if (!af) { console.error('american-force is not in brands.js'); process.exit(1); }
const need = af.models.filter(m => !m.img);
console.log(`American Force: ${af.models.length} models, ${need.length} with no art`);

/* ---- 2. their side: the sitemap -------------------------------------- */
const xml = get(SITEMAP);
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).filter(u => /\/american-force-/.test(u));
console.log(`their sitemap: ${urls.length} product URLs`);

/* Their URL is american-force-aw-<part>-<name>-<series>; our model name is
   usually "<name> <series>" with no part number, but sometimes carries it
   ("6N33 Barrage SD"). Index each URL under both spellings. */
const idx = new Map();
urls.forEach(u => {
  const tail = u.split('/').pop().replace(/^american-force-(aw-)?/, '');
  const full = slug(tail);
  const noPart = slug(tail.split('-').slice(1).join('-'));
  if (full && !idx.has(full)) idx.set(full, u);
  if (noPart && !idx.has(noPart)) idx.set(noPart, u);
});

const pairs = [];
const unmatched = [];
need.forEach(m => {
  const u = idx.get(slug(m.model));
  if (u) pairs.push({ model: m.model, url: u, file: slug(m.model) + '.png' });
  else unmatched.push(m.model);
});
console.log(`matched to a product page: ${pairs.length}   no page found: ${unmatched.length}`);
if (DRY) {
  console.log('\n--dry, stopping before any request.');
  pairs.slice(0, 10).forEach(p => console.log('   ' + p.model.padEnd(24) + p.url.replace(HOST, '')));
  process.exit(0);
}

/* ---- 3. fetch, extract, download ------------------------------------- */
if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });
const got = [], skipped = [], failed = [];
const hashes = new Map();

pairs.slice(0, LIMIT === Infinity ? pairs.length : LIMIT).forEach((p, i) => {
  const dest = path.join(OUTDIR, p.file);
  if (fs.existsSync(dest)) { skipped.push([p.model, 'already on disk']); return; }
  process.stdout.write(`  [${i + 1}/${Math.min(pairs.length, LIMIT)}] ${p.model.padEnd(24)}`);
  try {
    const html = get(p.url);
    const m = html.match(/"image"\s*:\s*"([^"]+)"/);
    if (!m) { failed.push([p.model, 'no JSON-LD image on the page']); console.log('no image'); return; }
    const src = m[1].replace(/\\\//g, '/');
    /* Their own "coming soon" tile is worse than our placeholder, because it
       looks like a real product photo failed rather than like art we have not
       sourced yet. */
    if (/Image_Coming_Soon|placeholder/i.test(src)) { skipped.push([p.model, 'they have no photo either']); console.log('placeholder'); return; }
    const buf = get(src, true);
    if (buf.length < 8000) { failed.push([p.model, 'image too small to be a render']); console.log('too small'); return; }
    const h = crypto.createHash('sha1').update(buf).digest('hex');
    hashes.set(h, (hashes.get(h) || []).concat(p.model));
    fs.writeFileSync(dest, buf);
    got.push({ model: p.model, file: 'assets/wheels/american-force/' + p.file, src: src, sha1: h, bytes: buf.length });
    console.log(`${Math.round(buf.length / 1024)}KB`);
  } catch (e) {
    failed.push([p.model, String(e.message || e).slice(0, 60)]); console.log('ERROR');
  }
  sleep(DELAY_MS);
});

/* ---- 4. a render shared by several models is a placeholder ------------ */
const shared = [...hashes.entries()].filter(([, models]) => models.length >= 3);
let dropped = 0;
shared.forEach(([h, models]) => {
  console.log(`\n  ${models.length} models returned the SAME image (${h.slice(0, 8)}) — treating it as a placeholder:`);
  models.forEach(name => {
    console.log('     - ' + name);
    const row = got.find(g => g.model === name);
    if (row) { try { fs.unlinkSync(path.join(ROOT, row.file)); } catch (e) {} got.splice(got.indexOf(row), 1); dropped++; }
  });
});

/* ---- 5. report ------------------------------------------------------- */
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, JSON.stringify({
  scraped: new Date().toISOString().slice(0, 10),
  source: HOST,
  note: 'American Force renders, taken from the product page JSON-LD each wheel declares. Rights: LAUNCH-CHECKLIST 1.2.',
  art: got.sort((a, b) => a.model.localeCompare(b.model)),
  noPageFound: unmatched.sort(),
  skipped: skipped, failed: failed
}, null, 1) + '\n');

console.log(`\n  downloaded ${got.length}` + (dropped ? `  (dropped ${dropped} shared placeholders)` : ''));
console.log(`  skipped ${skipped.length} · failed ${failed.length} · no product page ${unmatched.length}`);
console.log(`  report: ${path.relative(ROOT, REPORT)}`);
console.log('\n  next: node tools/optimize-wheels.js  then  node tools/wire-wheel-art.js');

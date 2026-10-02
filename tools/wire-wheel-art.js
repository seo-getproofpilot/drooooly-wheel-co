#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — write scraped art paths into brands.js

   Takes the report a scraper wrote (data/specs/<brand>-art.json) and sets
   `img:` on each matching model. Separate from the scraper on purpose: the
   download is slow and網 network-bound, this is instant and reversible, and
   keeping them apart means a bad match can be fixed and re-applied without
   re-fetching 163 pages.

   SAFETY RAILS, because this edits the catalogue in place:
     - only fills a model that has NO img; never overwrites existing art
     - only touches models inside the named brand's block, so a model name
       shared across brands cannot cross-contaminate (an American Force
       "Dynamo" and a Fuel "Dynamo" both exist)
     - refuses to run if the file it is about to write does not exist on disk
     - verifies the result parses and the count went up by exactly what it
       claimed, or restores the original

   Usage:  node tools/wire-wheel-art.js [data/specs/american-force-art.json]
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BRANDS = path.join(ROOT, 'brands.js');
const report = path.resolve(ROOT, process.argv[2] || 'data/specs/american-force-art.json');

const rep = JSON.parse(fs.readFileSync(report, 'utf8'));
const brandSlug = path.basename(report).replace(/-art\.json$/, '');

const before = fs.readFileSync(BRANDS, 'utf8');
let src = before;

/* Find this brand's block so edits cannot leak into a neighbour. */
const start = src.indexOf(`slug: "${brandSlug}"`) > -1 ? src.indexOf(`slug: "${brandSlug}"`) : src.indexOf(`slug:"${brandSlug}"`);
if (start < 0) { console.error(`brands.js has no brand with slug "${brandSlug}"`); process.exit(1); }
let end = src.length;
for (const m of src.slice(start + 8).matchAll(/slug:\s*"/g)) { end = start + 8 + m.index; break; }
let block = src.slice(start, end);

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let wired = 0, missingFile = [], notFound = [], already = [];

(rep.art || []).forEach(a => {
  if (!fs.existsSync(path.join(ROOT, a.file))) { missingFile.push(a.model); return; }
  /* Match the model object by its `model:` key, then look only as far as that
     object's closing brace so we never read a sibling's fields. */
  const re = new RegExp(`\\{\\s*model:\\s*"${esc(a.model)}"\\s*,`, 'g');
  const m = re.exec(block);
  if (!m) { notFound.push(a.model); return; }
  const objEnd = block.indexOf('}', m.index);
  if (/\bimg\s*:/.test(block.slice(m.index, objEnd))) { already.push(a.model); return; }
  const at = m.index + m[0].length;
  block = block.slice(0, at) + ` img: "${a.file}",` + block.slice(at);
  wired++;
});

if (!wired) { console.log('nothing to wire.'); process.exit(0); }

src = src.slice(0, start) + block + src.slice(end);
fs.writeFileSync(BRANDS, src);

/* ---- verify, or put it back ------------------------------------------ */
function countArt() {
  delete require.cache[require.resolve(BRANDS)];
  global.window = {};
  require(BRANDS);
  const b = (global.window.BRANDS || []).find(x => x.slug === brandSlug);
  return { total: b ? b.models.length : 0, withArt: b ? b.models.filter(m => m.img).length : 0, brands: (global.window.BRANDS || []).length };
}
let after;
try { after = countArt(); } catch (e) {
  fs.writeFileSync(BRANDS, before);
  console.error('brands.js stopped parsing — restored. ' + e.message);
  process.exit(1);
}
global.window = {};
delete require.cache[require.resolve(BRANDS)];
const tmp = path.join(require('os').tmpdir(), 'brands-before.js');
fs.writeFileSync(tmp, before);
delete require.cache[require.resolve(tmp)];
require(tmp);
const prev = (global.window.BRANDS || []).find(x => x.slug === brandSlug);
const prevArt = prev ? prev.models.filter(m => m.img).length : 0;

if (after.withArt - prevArt !== wired) {
  fs.writeFileSync(BRANDS, before);
  console.error(`expected +${wired} images, got +${after.withArt - prevArt} — restored brands.js`);
  process.exit(1);
}

console.log(`  ${brandSlug}: ${prevArt} -> ${after.withArt} of ${after.total} models have art  (+${wired})`);
if (already.length) console.log(`  ${already.length} already had art, left alone`);
if (notFound.length) console.log(`  ${notFound.length} not found in the brand block: ${notFound.slice(0, 5).join(', ')}`);
if (missingFile.length) console.log(`  ${missingFile.length} reported but not on disk: ${missingFile.slice(0, 5).join(', ')}`);

#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — bring the Price Designs layer art in-house

   WHY IT IS NOT ALREADY LOCAL. The seven builders reference 1,542 layer
   renders and 531 swatches. At ~60KB each that is roughly 100MB of someone
   else's photography in a static repo that is otherwise 40MB, and every one of
   those files is Price Designs' own work. So the specs store a bare filename
   against `layerBase`, which points at the Google bucket his builder app
   already serves them from — both hosts it uses are the same bucket and both
   send `access-control-allow-origin: *` with no referrer check.

   WHY YOU MIGHT STILL RUN THIS. Hotlinking means his CDN decides whether our
   builder renders. If he migrates off The Custom Product Builder, or the app
   re-keys its files, every wheel on our site goes blank at once and we find
   out from a customer. That is LAUNCH-CHECKLIST 4.42, and it is the single
   biggest fragility in the builder.

   Run this when any of these becomes true:
     - Kade sends an asset pack, or says in writing we may host his renders
     - we are close enough to launch that a silent dependency is not acceptable
     - his CDN starts rate-limiting or 404ing (the builder page will show gaps)

   WHAT IT DOES. Downloads every file the specs reference, verifies each one is
   a real image rather than an error page, writes them under
   assets/wheels/price-designs/layers/, and rewrites `layerBase` in all seven
   specs to that path. Then re-run tools/build-builders.js. Idempotent and
   resumable — a file already on disk at a sane size is left alone, so an
   interrupted run picks up where it stopped.

   --revert puts layerBase back to his CDN without deleting anything.

   Usage:  node tools/mirror-pd-art.js [--dry] [--revert] [--only <builder-id>]
   Then:   node tools/build-builders.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRCDIR = path.join(ROOT, 'data/builders');
const OUTREL = 'assets/wheels/price-designs/layers/';
const OUTDIR = path.join(ROOT, OUTREL);
const CDN = 'https://cdn.thecustomproductbuilder.com/61433217254/images/products/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const DRY = process.argv.includes('--dry');
const REVERT = process.argv.includes('--revert');
const ONLY = process.argv.indexOf('--only') > -1 ? process.argv[process.argv.indexOf('--only') + 1] : null;

const specFiles = fs.readdirSync(SRCDIR).filter(f => f.endsWith('.json'));
const specs = specFiles.map(f => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(SRCDIR, f), 'utf8')) }))
  .filter(s => !ONLY || s.data.id === ONLY);

/* ---- revert ---------------------------------------------------------- */
if (REVERT) {
  specs.forEach(s => {
    s.data.layerBase = CDN;
    if (!DRY) fs.writeFileSync(path.join(SRCDIR, s.file), JSON.stringify(s.data, null, 2) + '\n');
    console.log('  ' + s.data.id.padEnd(16) + 'layerBase -> his CDN');
  });
  console.log(`\n  ${DRY ? '(dry run) ' : ''}run node tools/build-builders.js next`);
  process.exit(0);
}

/* ---- what the specs reference ---------------------------------------- */
const wanted = new Map();              // filename -> [builder ids]
specs.forEach(s => s.data.steps.forEach(st => (st.options || []).forEach(o => {
  [o.layer, o.swatch].forEach(f => {
    if (!f || /^https?:/.test(f)) return;     // absolute ones are not ours to move
    if (!wanted.has(f)) wanted.set(f, []);
    if (wanted.get(f).indexOf(s.data.id) < 0) wanted.get(f).push(s.data.id);
  });
})));

const files = [...wanted.keys()].sort();
console.log(`  ${files.length} distinct files across ${specs.length} builders`);

if (DRY) {
  const have = files.filter(f => fs.existsSync(path.join(OUTDIR, f)));
  console.log(`  ${have.length} already on disk, ${files.length - have.length} to fetch`);
  console.log(`  (dry run — nothing written)`);
  process.exit(0);
}

fs.mkdirSync(OUTDIR, { recursive: true });

/* A CDN that has started returning an HTML error page will happily write 900
   bytes of "Not Found" over a wheel. Check the magic bytes, not the status
   code — curl -f is not enough when a proxy answers 200 with junk. */
function looksLikeImage(buf) {
  if (buf.length < 512) return false;
  const s = buf.slice(0, 16).toString('latin1');
  return s.startsWith('RIFF') && buf.slice(8, 12).toString('latin1') === 'WEBP'   // webp
      || s.startsWith('\x89PNG')
      || s.startsWith('\xff\xd8\xff');                                            // jpeg
}

let got = 0, had = 0, failed = [];
let bytes = 0;

files.forEach((f, i) => {
  const dest = path.join(OUTDIR, f);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 512) {
    had++; bytes += fs.statSync(dest).size;
    return;
  }
  try {
    const buf = execFileSync('curl', ['-sS', '-L', '--max-time', '45', '-A', UA, CDN + f],
      { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
    if (!looksLikeImage(buf)) throw new Error('not an image (' + buf.length + ' bytes)');
    fs.writeFileSync(dest, buf);
    got++; bytes += buf.length;
  } catch (e) {
    failed.push([f, String(e.message || e).slice(0, 50)]);
  }
  if ((i + 1) % 50 === 0) {
    process.stdout.write(`  ${i + 1}/${files.length}  ${got} fetched, ${had} cached, ` +
      `${failed.length} failed, ${(bytes / 1048576).toFixed(0)}MB\n`);
  }
});

console.log(`\n  ${got} fetched, ${had} already there, ${failed.length} failed · ` +
  `${(bytes / 1048576).toFixed(0)}MB on disk`);
if (failed.length) {
  console.log('\n  FAILED — layerBase NOT rewritten, because a spec pointing at a');
  console.log('  local folder with holes in it renders gaps rather than falling back:');
  failed.slice(0, 12).forEach(([f, why]) => console.log('    ' + f + '  ' + why));
  if (failed.length > 12) console.log(`    …and ${failed.length - 12} more`);
  console.log('\n  Re-run to retry just the missing ones.');
  process.exit(1);
}

specs.forEach(s => {
  s.data.layerBase = OUTREL;
  fs.writeFileSync(path.join(SRCDIR, s.file), JSON.stringify(s.data, null, 2) + '\n');
  console.log('  ' + s.data.id.padEnd(16) + 'layerBase -> ' + OUTREL);
});

console.log('\n  next: node tools/build-builders.js');
console.log('  and tick LAUNCH-CHECKLIST 4.42 — the builder no longer depends on his CDN.');

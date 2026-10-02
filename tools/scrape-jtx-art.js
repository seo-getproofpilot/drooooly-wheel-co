#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — JTX dually renders

   19 JTX models had no art: Avalon and the whole D-200..D-217 dually run.
   Chris spotted D-204/205/206 on the shop page and asked whether to pull them
   from the catalogue. They do not need pulling — JTX publishes a render for
   every one of them, right on the dually-series index. We just never read it,
   because scrape-jtx-sizes.js was after sizes, not pictures.

   Their index embeds each model's render with the model in the filename
   (26-AST-DUALLY-D-204-1-3-25-MAIN-P.png), and WordPress emits several
   scaled copies of each; we take the largest. One page fetch, then one
   request per image.

   RIGHTS: JTX's own renders — LAUNCH-CHECKLIST 1.1, the same media-kit ask
   that already covers their single-series art.

   Usage:  node tools/scrape-jtx-art.js [--dry]
   Then:   node tools/optimize-wheels.js  &&  node tools/wire-wheel-art.js data/specs/jtx-art.json
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INDEX = 'https://jtxforged.com/dually-series/';
const OUTDIR = path.join(ROOT, 'assets/wheels/jtx');
const REPORT = path.join(ROOT, 'data/specs/jtx-art.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DRY = process.argv.includes('--dry');
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const get = (u, bin) => execFileSync('curl', ['-sS', '-L', '--max-time', '45', '-A', UA, u],
  { encoding: bin ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024 });

global.window = {};
require(path.join(ROOT, 'brands.js'));
const jtx = (global.window.BRANDS || []).find(b => b.slug === 'jtx');
const need = jtx.models.filter(m => !m.img);
console.log(`JTX: ${jtx.models.length} models, ${need.length} with no art`);

const html = get(INDEX);
/* WordPress emits -1024x719, -1536x1078, -2048x1438 and the original beside
   each other. Group by the base name and keep the widest. */
const best = {};
[...new Set([...html.matchAll(/https:\/\/jtxforged\.com\/wp-content\/uploads\/[^"' ]+\.(?:png|jpg|webp)/g)].map(m => m[0]))]
  .forEach(u => {
    const base = u.replace(/-\d+x\d+(\.\w+)$/, '$1');
    const m = u.match(/-(\d+)x(\d+)\.\w+$/);
    const w = m ? +m[1] : 99999;              // no suffix = the original
    if (!best[base] || w > best[base].w) best[base] = { u: u, w: w };
  });
const files = Object.values(best).map(x => x.u);
console.log(`${files.length} distinct renders on the index`);

const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const pairs = [];
const unmatched = [];
need.forEach(m => {
  const k = norm(m.model);
  const f = files.find(u => norm(u.split('/').pop()).includes('dually' + k));
  if (f) pairs.push({ model: m.model, src: f, file: norm(m.model) + '.png' });
  else unmatched.push(m.model);
});
console.log(`matched ${pairs.length}, unmatched ${unmatched.length}`);
if (DRY) { pairs.forEach(p => console.log('   ' + p.model.padEnd(10) + p.src.split('/').pop())); process.exit(0); }

const got = [], failed = [], hashes = new Map();
pairs.forEach((p, i) => {
  const dest = path.join(OUTDIR, p.file);
  process.stdout.write(`  [${i + 1}/${pairs.length}] ${p.model.padEnd(10)}`);
  try {
    const buf = get(p.src, true);
    if (buf.length < 8000) { failed.push([p.model, 'too small']); console.log('too small'); return; }
    const h = crypto.createHash('sha1').update(buf).digest('hex');
    hashes.set(h, (hashes.get(h) || []).concat(p.model));
    fs.writeFileSync(dest, buf);
    got.push({ model: p.model, file: 'assets/wheels/jtx/' + p.file, src: p.src, sha1: h, bytes: buf.length });
    console.log(`${Math.round(buf.length / 1024)}KB`);
  } catch (e) { failed.push([p.model, String(e.message || e).slice(0, 50)]); console.log('ERROR'); }
  sleep(900);
});

/* One render answering for several models is a placeholder, whatever it looks like. */
let dropped = 0;
[...hashes.entries()].filter(([, m]) => m.length >= 3).forEach(([h, models]) => {
  console.log(`\n  ${models.length} models share one image (${h.slice(0, 8)}) — dropping as a placeholder`);
  models.forEach(name => {
    const row = got.find(g => g.model === name);
    if (row) { try { fs.unlinkSync(path.join(ROOT, row.file)); } catch (e) {} got.splice(got.indexOf(row), 1); dropped++; }
  });
});

fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, JSON.stringify({
  scraped: new Date().toISOString().slice(0, 10), source: INDEX,
  note: "JTX dually renders from their own dually-series index. Rights: LAUNCH-CHECKLIST 1.1.",
  art: got.sort((a, b) => a.model.localeCompare(b.model)), noRenderFound: unmatched, failed: failed
}, null, 1) + '\n');

console.log(`\n  downloaded ${got.length}${dropped ? ` (dropped ${dropped})` : ''} · failed ${failed.length}`);
console.log(`  report: ${path.relative(ROOT, REPORT)}`);

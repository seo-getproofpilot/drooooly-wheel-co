#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — the homepage gallery, built from brand-sourced photos

   WHAT CHANGED. The #builds grid used to be forty generic truck photographs
   from assets/builds/ carrying captions nobody could stand behind — "Ford
   F-250 · 6" lift · 24×14 · 37s" was written to look plausible, not read off
   anything. That is why showGalleryCaptions existed: a switch to hide copy we
   knew was invented.

   Chris, 2026-11-09: "only brand-specific photos, like JTX, Price Designs,
   and photos from actual wheel brands... let's actually make it like we have
   a gallery. We showed off what brands we had offered wheels or tires
   through."

   So the grid is now generated from data/builds/*.json, and a photo only
   qualifies if its lane carries a `credit` — i.e. we know which brand it came
   from. Every caption is read off that record: the real vehicle, the real
   width, the real wheel. Nothing is composed here. The uncredited local
   dually stock in jtx.json's second lane is deliberately NOT eligible; it is
   the thing being replaced.

   Brands are interleaved rather than grouped so the grid reads as a range of
   what we build on instead of one brand followed by another.

   Usage:  node tools/build-gallery.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'data/builds');
const PAGE = path.join(ROOT, 'index.html');
const START = '<!-- gallery:start -->';
const END = '<!-- gallery:end -->';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* 26x14 is how a wheel is written down; 26×14 is how it is set. */
const niceSize = s => String(s || '').replace(/\s*[x×]\s*/i, '×');

const byBrand = [];
fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort().forEach(f => {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const tiles = [];
  Object.keys(d.lanes || {}).forEach(lane => {
    const L = d.lanes[lane];
    /* No credit means we cannot say whose photograph it is, which is exactly
       the material this rebuild exists to drop. */
    if (!L.credit) return;
    (L.photos || []).forEach(p => {
      if (!p.url) return;
      const bits = [p.vehicle, niceSize(p.size)].filter(Boolean);
      const wheel = [d.brand, p.model].filter(Boolean).join(' ');
      if (wheel) bits.push(wheel);
      tiles.push({ url: p.url, brand: d.brand, caption: bits.join(' · '),
                   alt: [p.vehicle, 'on', wheel].filter(Boolean).join(' ') });
    });
  });
  if (tiles.length) byBrand.push({ brand: d.brand, tiles });
});

/* Round-robin so no brand owns a run of the grid. */
const out = [];
for (let i = 0; out.length < byBrand.reduce((n, b) => n + b.tiles.length, 0); i++) {
  byBrand.forEach(b => { if (b.tiles[i]) out.push(b.tiles[i]); });
}

const html = out.map(t =>
  '      <figure class="gallery-item">' +
  '<img src="' + esc(t.url) + '" alt="' + esc(t.alt) + '" loading="lazy" />' +
  '<figcaption class="gallery-cap">' + esc(t.caption) + '</figcaption>' +
  '</figure>').join('\n');

let page = fs.readFileSync(PAGE, 'utf8');
const a = page.indexOf(START), b = page.indexOf(END);
if (a < 0 || b < 0) {
  console.error('  markers missing in index.html — add ' + START + ' / ' + END +
    ' around the gallery grid contents');
  process.exit(1);
}
page = page.slice(0, a + START.length) + '\n' + html + '\n    ' + page.slice(b);
fs.writeFileSync(PAGE, page);

byBrand.forEach(b => console.log('  ' + b.brand.padEnd(16) + b.tiles.length + ' photos'));
console.log('  ' + out.length + ' tiles written to index.html');

#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — is every wheel and tire listed correctly?

   Chris: "go through and make sure every page has wheels and tires listed
   correctly, with all the dimensions listed correctly for each wheel and
   tire setup."

   tools/test-fitment.js already checks that the catalogue is well-FORMED.
   This asks the harder question: are the dimensions TRUE, and would a
   customer reading a card learn the right thing from it?

   The checks, and why each one is here rather than being obvious:

   1  A SIZE IS A DIAMETER AND A WIDTH. "22" is not a size. It tells a
      customer nothing about whether the wheel clears their calipers or
      fills their fender, and it makes the lifted/dually lanes guess —
      catalog.js carries an explicit `x.w === null` branch to cope.

   2  WIDTHS MUST SUIT THE CONFIG. 8.25" is the dually REAR width and
      nothing else; no single-rear truck takes one. A model flagged
      "single" whose only widths are 8.25 is either mis-flagged or has
      placeholder sizes (LAUNCH-CHECKLIST 4.12). A model flagged "dually"
      with no 8.25 at all cannot be a dually.

   3  PLACEHOLDER SIZE LISTS. The signature is many models in one brand
      sharing one identical list. Real published matrices differ per model
      because the moulds differ. Measured before tools/scrape-wheel-sizes.js
      existed: american-force 255 of 287 models shared ONE list; amani and
      kmc had exactly one list for the whole brand. That is not a catalogue,
      it is a template, and it will quote a customer a size nobody makes.

   4  TIRE SIZES MUST PARSE AS TIRE SIZES, in either convention — metric
      (LT285/70R17) or flotation (35x12.50R20LT) — and the `rims` array has
      to agree with the sizes it was derived from, or the rim filter lies.

   5  A FLOTATION TIRE'S OVERALL DIAMETER MUST EXCEED ITS RIM. A 33x12.50R35
      is a typo, not a tire, and it would sort into the wrong rim bucket.

   6  ONE NAME PER THING. "Highway / Street" and "Street / Highway" are the
      same tread and render as two separate filter chips. Same for a wheel
      carried twice under two spellings — "547" and "TIS 547" are one wheel,
      and a shopper who sees both assumes they are different.

   Exit code is 1 if anything in the ERROR tier fires, so this can gate a
   commit. The WARN tier is the standing debt, printed with a count so it is
   measured rather than forgotten.

   Usage:  node tools/qc-catalog.js [--verbose] [--brand <slug>]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { partKey, collapseNumbered } = require('./lib/part-key');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const ONLY = process.argv.indexOf('--brand') > -1 ? process.argv[process.argv.indexOf('--brand') + 1] : null;

const ctx = { window: {} };
vm.createContext(ctx);
['brands.js', 'tires.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx));
let BRANDS = ctx.window.BRANDS, TIRES = ctx.window.TIRES;
if (ONLY) { BRANDS = BRANDS.filter(b => b.slug === ONLY); TIRES = TIRES.filter(b => b.slug === ONLY); }

const errors = [], warns = [];
const E = (where, msg) => errors.push({ where, msg });
const W = (where, msg) => warns.push({ where, msg });

const DUALLY_REAR = 8.25;

/* ---------------------------------------------------------------- wheels -- */
const wsize = s => {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(String(s));
  return m ? { d: +m[1], w: +m[2] } : null;
};

let wheelModels = 0, wheelSizes = 0, bareSizes = 0;
const bareModels = [], placeholderBrands = [];

BRANDS.forEach(b => {
  const ms = b.models || [];
  const lists = {};

  ms.forEach(m => {
    wheelModels++;
    const where = b.slug + '/' + m.model;
    const sizes = m.sizes || [];
    const cfg = m.configs || [];

    if (!sizes.length) { E(where, 'no sizes at all'); return; }

    /* A WHEEL'S FINISH IS NOT OPTIONAL — a TIRE's does not exist, which is
       why this lives in the wheel loop and not beside the shared size check;
       put in both, it called every tread a fault. Eight Raceline UTV models carried
       `finishes: null` from tools/scrape-utv.js, so their cards offered no
       colour at all and their wheel pages had nothing to put in the finish
       row. Raceline publish the finish as the third segment of every product
       title, so it was recoverable — but nothing was watching for its
       absence. */
    if (!(m.finishes || []).length) E(where, 'no finishes listed');
    lists[JSON.stringify(sizes)] = (lists[JSON.stringify(sizes)] || 0) + 1;

    /* 1 — a size is a diameter AND a width */
    const bare = sizes.filter(s => !/x/.test(String(s)));
    if (bare.length) {
      bareSizes += bare.length;
      bareModels.push(where + ' [' + bare.join(', ') + ']');
    }

    const parsed = [];
    sizes.forEach(s => {
      wheelSizes++;
      if (!/x/.test(String(s))) return;          // counted above
      const p = wsize(s);
      if (!p) { E(where, 'size "' + s + '" does not parse as DIAxWIDTH'); return; }
      if (p.d < 9 || p.d > 34) E(where, 'size "' + s + '" has an implausible diameter');
      if (p.w < 4 || p.w > 18) E(where, 'size "' + s + '" has an implausible width');
      if (p.w >= p.d) E(where, 'size "' + s + '" is wider than it is tall');
      parsed.push(p);
    });

    /* duplicates inside one model */
    const seen = {};
    sizes.forEach(s => { if (seen[s]) E(where, 'size "' + s + '" listed twice'); seen[s] = 1; });

    /* display order — the card shows the first four, so order is customer-facing */
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i].d < parsed[i - 1].d) {
        W(where, 'sizes are not in ascending order (' + sizes.join(' ') + ')');
        break;
      }
    }

    /* 2 — WIDTHS MUST SUIT THE CONFIG.

       8.25" is the dually rear on a 1-ton pickup, but it is not the only
       dually rear: Vision's 181 Hauler is a commercial dually in 16x6,
       17x6.5 and 19.5x6.75, and the first version of this check called all
       three of them "not a dually". So the test is NARROW vs WIDE rather
       than one magic number —

         a dually has at least one rear no wider than 8.25
         a single has at least one wheel WIDER than 8.25

       8.25 is the specific number because it is the dually rear width and
       nothing else is built at it. The threshold is not "10 or wider": a
       17x9 beadlock and a 20x9.5 are ordinary single-rear wheels, and
       calling Vision's 111 Nemesis a dually because its widest is 9" was
       the second thing this check got wrong. */
    if (parsed.length) {
      const widths = parsed.map(p => p.w);
      if (cfg.indexOf('single') > -1 && !widths.some(w => w > DUALLY_REAR)) {
        W(where, 'flagged "single" but every width is ' + DUALLY_REAR +
          '" or narrower — that is the dually rear, not a single-rear size');
      }
      if (cfg.indexOf('dually') > -1 && !widths.some(w => w <= DUALLY_REAR) &&
          cfg.indexOf('super single') < 0) {
        W(where, 'flagged "dually" but nothing is ' + DUALLY_REAR + '" or narrower');
      }
      if (cfg.indexOf('utv') > -1 && parsed.some(p => p.d > 20)) {
        W(where, 'flagged "utv" but is listed up to ' + Math.max.apply(null, parsed.map(p => p.d)) + '"');
      }
    }

    /* bolt patterns, where the brand publishes them */
    (b.bolts || []).forEach(bp => {
      if (!/^\d{1,2}x\d{2,3}(\.\d{1,2})?$/.test(bp)) E(b.slug, 'bolt pattern "' + bp + '" is malformed');
    });
  });

  /* 3 — placeholder signature */
  const counts = Object.keys(lists).map(k => lists[k]).sort((a, c) => c - a);
  if (ms.length >= 7 && counts[0] / ms.length >= 0.6) {
    const biggest = Object.keys(lists).filter(k => lists[k] === counts[0])[0];
    placeholderBrands.push({
      slug: b.slug, models: ms.length, shared: counts[0],
      distinct: Object.keys(lists).length, list: JSON.parse(biggest)
    });
  }

  /* 6 — ONE NAME PER THING, and the rule has to be narrow or it libels the
     catalogue. The first version keyed on the part number alone and called
     JTX's D-200 and SS-200 the same wheel: they are the dually and the super
     single, two different parts. Method's "305 NV" and "305 NV HD" went the
     same way, and so did Raceline's Alpha and Alpha Beadlock.

     So two entries are one wheel only when their names are IDENTICAL after
     removing (a) the brand's own name, which is how "547" and "TIS 547" got
     in, and (b) a TRAILING configuration word, which is how "Summit" and
     "Summit Dually" did. Nothing else is stripped — "HD", "Beadlock",
     "Bead Grip" and an "-R" suffix all name a different part.

     One more pass catches the other real case: a model carried both with and
     without its leading part number, which is how Vision ended up listing
     "56 Midway" and "Midway" as two wheels. */
  const byKey = {};
  (ms || []).forEach(m => { const k = partKey(b, m.model); if (k) (byKey[k] = byKey[k] || []).push(m.model); });
  collapseNumbered(byKey);
  Object.keys(byKey).forEach(k => {
    if (byKey[k].length > 1) E(b.slug, 'one wheel listed ' + byKey[k].length + ' times: ' + byKey[k].join(' / '));
  });
});

/* ----------------------------------------------------------------- tires -- */
/* Both conventions, and nothing else. A size that matches neither would show
   on the card verbatim and sort into no rim bucket at all. */
const FLOTATION = /^(\d{2}(?:\.\d)?)x(\d{1,2}(?:\.\d{1,2})?)(R|D|B)(\d{2}(?:\.\d)?)(LT|XL|C)?$/;
const METRIC    = /^(P|LT)?(\d{3})\/(\d{2})(R|ZR|D)(\d{2}(?:\.\d)?)(XL|LT|C|E)?$/;

let tireModels = 0, tireSizes = 0;
const treadNames = {};

TIRES.forEach(b => {
  (b.models || []).forEach(m => {
    tireModels++;
    const where = b.slug + '/' + m.model;
    const sizes = m.sizes || [];
    if (!sizes.length) { E(where, 'no sizes at all'); return; }

    (treadNames[m.tread] = treadNames[m.tread] || []).push(where);

    const rims = [];
    const seen = {};
    sizes.forEach(s => {
      tireSizes++;
      if (seen[s]) E(where, 'size "' + s + '" listed twice');
      seen[s] = 1;
      const f = FLOTATION.exec(s), t = METRIC.exec(s);
      if (f) {
        const od = +f[1], w = +f[2], rim = +f[4];
        rims.push(rim);
        /* 5 — a tire is taller than the wheel inside it */
        if (od <= rim) E(where, 'size "' + s + '" is ' + od + '" tall on a ' + rim + '" rim');
        if (w >= od) E(where, 'size "' + s + '" is wider than it is tall');
        if (od - rim < 2) W(where, 'size "' + s + '" leaves under 1" of sidewall');
      } else if (t) {
        const sec = +t[2], ar = +t[3], rim = +t[5];
        rims.push(rim);
        const od = rim + 2 * (sec * ar / 100) / 25.4;
        if (od < rim + 1) E(where, 'size "' + s + '" computes to ' + od.toFixed(1) + '" overall');
        if (sec < 125 || sec > 475) E(where, 'size "' + s + '" has an implausible section width');
        if (ar < 25 || ar > 90) E(where, 'size "' + s + '" has an implausible aspect ratio');
      } else {
        E(where, 'size "' + s + '" parses as neither metric nor flotation');
      }
    });

    /* 4 — rims[] must agree with the sizes it describes */
    const want = [...new Set(rims)].sort((a, c) => a - c);
    const got = (m.rims || []).slice().sort((a, c) => a - c);
    if (JSON.stringify(want) !== JSON.stringify(got)) {
      E(where, 'rims [' + got.join(', ') + '] disagrees with the sizes, which imply [' + want.join(', ') + ']');
    }

    /* sorted by rim diameter, which is the order the card prints them in */
    let last = 0;
    sizes.forEach(s => {
      const f = FLOTATION.exec(s), t = METRIC.exec(s);
      const rim = f ? +f[4] : t ? +t[5] : 0;
      if (rim && rim < last) { W(where, 'sizes are not in rim order'); last = 999; }
      else if (rim) last = rim;
    });
  });
});

/* 6 — one name per tread */
const norm = s => String(s).toLowerCase().split(/[^a-z]+/).filter(Boolean).sort().join(' ');
const byTread = {};
Object.keys(treadNames).forEach(t => { (byTread[norm(t)] = byTread[norm(t)] || []).push(t); });
Object.keys(byTread).forEach(k => {
  if (byTread[k].length > 1) {
    E('tires', 'one tread spelled ' + byTread[k].length + ' ways: ' +
      byTread[k].map(t => '"' + t + '" (' + treadNames[t].length + ')').join(' vs '));
  }
});

/* ---------------------------------------------------------------- report -- */
console.log('Catalogue');
console.log('  ' + BRANDS.length + ' wheel brands · ' + wheelModels + ' models · ' + wheelSizes + ' size entries');
console.log('  ' + TIRES.length + ' tire brands  · ' + tireModels + ' models · ' + tireSizes + ' size entries');

if (bareModels.length) {
  console.log('\n  ' + bareSizes + ' size entries on ' + bareModels.length +
    ' models are a bare diameter with no width:');
  (VERBOSE ? bareModels : bareModels.slice(0, 12)).forEach(m => console.log('    ' + m));
  if (!VERBOSE && bareModels.length > 12) console.log('    …and ' + (bareModels.length - 12) + ' more (--verbose)');
  E('(catalogue)', bareSizes + ' bare diameters across ' + bareModels.length + ' models');
}

if (placeholderBrands.length) {
  console.log('\n  brands whose size lists look templated rather than published:');
  placeholderBrands.forEach(p => {
    console.log('    ' + p.slug.padEnd(16) + p.shared + ' of ' + p.models +
      ' models share one list · ' + p.distinct + ' distinct in all');
    if (VERBOSE) console.log('      ' + JSON.stringify(p.list));
    W(p.slug, p.shared + ' of ' + p.models + ' models share one size list');
  });
}

function tier(name, rows) {
  if (!rows.length) return;
  console.log('\n' + name + ' (' + rows.length + ')');
  const by = {};
  rows.forEach(r => { (by[r.where] = by[r.where] || []).push(r.msg); });
  const keys = Object.keys(by);
  (VERBOSE ? keys : keys.slice(0, 24)).forEach(k => {
    console.log('  ' + k);
    by[k].slice(0, VERBOSE ? 99 : 3).forEach(m => console.log('    ' + m));
    if (!VERBOSE && by[k].length > 3) console.log('    …and ' + (by[k].length - 3) + ' more');
  });
  if (!VERBOSE && keys.length > 24) console.log('  …and ' + (keys.length - 24) + ' more (--verbose)');
}
tier('ERRORS — a customer would read something untrue', errors);
tier('WARNINGS — standing debt, measured', warns);

console.log('\n' + '─'.repeat(64));
if (!errors.length) {
  console.log('  No errors.' + (warns.length ? '  ' + warns.length + ' warning(s).' : ''));
  process.exit(0);
}
console.log('  ' + errors.length + ' error(s), ' + warns.length + ' warning(s)');
process.exit(1);

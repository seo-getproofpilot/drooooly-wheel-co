#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — put the manufacturer's real sizes into the catalogue

   Reads data/sizes/<brand>.json (written by tools/scrape-wheel-sizes.js) and
   rewrites the `sizes` and `configs` of the matching models in brands.js.

   WHY configs TOO, AND NOT JUST sizes. The two are the same fact. A model is
   a dually because it is built with an 8.25" rear; it is a single because it
   is built 10" and wider. Our configs were set by inferConfigs() in
   tools/build-featured.js, which guesses from suffix codes in the model NAME
   — "SD", "DRW", "DUALLY" — and gets it wrong whenever the name does not say.
   That is LAUNCH-CHECKLIST 4.12: 42 models flagged "single" whose only width
   is the dually rear. With the real matrix in hand the configs are derived,
   not guessed:

       any 8.25 rear           -> dually
       any width >= 10         -> single
       a wide front AND an 8.25 -> super single
       published 14" or 15" on 4x137 / 4x156 -> utv

   WHY NAMES ARE LEFT MOSTLY ALONE. Fenix call the FD014 "Throwback Pro" and
   we call it "Throwback". Correcting that is right, but only where our name
   is a strict prefix of theirs — anything looser starts renaming wheels on a
   fuzzy match, which is how an American Force "Dynamo" once got a Fuel photo.
   Everything else is reported for a human to settle.

   MERGING DUPLICATES. Where two of our entries resolve to the same
   manufacturer part, they are one wheel and the catalogue said otherwise —
   "547" and "TIS 547", "Midway" and "56 Midway". The survivor keeps the
   richer record: the photograph, the feat rank and the prices, since those
   were earned by whichever entry the art pipeline wired up.

   Usage:  node tools/wire-wheel-sizes.js [--dry] [--brand <slug>]
   Then:   node tools/qc-catalog.js
           node tools/test-fitment.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SRCDIR = path.join(ROOT, 'data/sizes');
const BRANDS_JS = path.join(ROOT, 'brands.js');
const DRY = process.argv.includes('--dry');
const ONLY = process.argv.indexOf('--brand') > -1 ? process.argv[process.argv.indexOf('--brand') + 1] : null;

if (!fs.existsSync(SRCDIR)) { console.error('no data/sizes — run tools/scrape-wheel-sizes.js first'); process.exit(1); }

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(BRANDS_JS, 'utf8'), ctx);
const BRANDS = ctx.window.BRANDS;

const cmpSize = (a, b) => {
  const A = String(a).split('x').map(Number), B = String(b).split('x').map(Number);
  return A[0] - B[0] || A[1] - B[1];
};

/* Our model name -> the manufacturer's part key. One rule, in
   tools/lib/part-key.js, shared with tools/build-featured.js and
   tools/qc-catalog.js — see the note there for why it is narrow. */
const { partKey, collapseNumbered, numberKey, numberKeys } = require('./lib/part-key');

/* The manufacturer's title, reduced to a MODEL NAME.

   Vision's pages are one per SKU, so their <title> is
   "401 Rival Dually SB &#8211; Vision Wheel": an HTML entity for the dash,
   the brand name, and "SB" — a FINISH code, not part of the model. The first
   version of this renamed six Vision wheels to things like
   "401 Rival Dually SB &#8211; Vision Wheel" and put that on a card. */
const ENT = { '&#8211;': '-', '&#8212;': '-', '&ndash;': '-', '&mdash;': '-',
  '&amp;': '&', '&quot;': '"', '&#039;': "'", '&#8217;': "'", '&nbsp;': ' ' };
function cleanTitle(brand, t) {
  let s = String(t || '');
  Object.keys(ENT).forEach(k => { s = s.split(k).join(ENT[k]); });
  s = s.replace(/&#\d+;/g, ' ');
  /* cut at the brand's own name, however it is separated */
  const bn = String(brand.name || '').replace(/[^A-Za-z0-9]+/g, '[ -]?');
  s = s.replace(new RegExp('[\\s|\\-\u2013\u2014]*' + bn + '.*$', 'i'), '');
  s = s.split(' - ')[0];
  /* a trailing all-caps run of 2-5 letters is a finish code (SB, GBMS, ABL, MB) */
  s = s.replace(/\s+[A-Z]{2,5}(\s+\d\.\d)?\s*$/, '');
  return s.replace(/\s+/g, ' ').trim();
}

/* Our name -> their part, by NAME where there is no part number in ours.
   Vision carry the Midway as part 56 and the Rocker as 412; our catalogue
   lists some of them by name only, which is why "Midway" and "56 Midway"
   both existed as separate wheels. */
function nameKey(brand, s) {
  return cleanTitle(brand, s)
    .toUpperCase()
    .replace(new RegExp('\\b(' + brand.slug.toUpperCase().replace(/-/g, '[ -]?') + ')\\b', 'g'), ' ')
    .replace(/\b(DUALLY|DRW|SUPER\s*SINGLE|BEADLOCK|FORGED)\b/g, ' ')
    .replace(/^\d+[A-Z]{0,2}\s*/, '')
    .replace(/[^A-Z0-9]+/g, '');
}

/* configs, derived from the widths the manufacturer actually publishes */
function configsFrom(byConfig) {
  const out = {};
  Object.keys(byConfig).forEach(c => { if (byConfig[c] && byConfig[c].length) out[c] = 1; });
  const all = [].concat.apply([], Object.keys(byConfig).map(c => byConfig[c] || []));
  const w = all.map(s => +String(s).split('x')[1]).filter(n => !isNaN(n));
  if (w.some(x => x === 8.25)) out.dually = 1;
  if (w.some(x => x >= 10)) out.single = 1;
  const order = ['single', 'dually', 'super single', 'utv'];
  return order.filter(c => out[c]);
}

/* WIRING IS OPT-IN PER BRAND, and the reason is American Force.

   tools/scrape-wheel-sizes.js can read their table fine — 258 of 314 product
   pages give a real size matrix. What cannot be done safely yet is MATCH
   those parts to our 287 listings, because our names omit the part code
   their slugs carry and their sub-lines differ only by a suffix: for one
   face they publish "1 Classic SS", "601 Classic SSBR", "601 Classic SD",
   "1 Classic DBO" and "1 Classic DRW", which are a super single, a big-rig
   super single, a single, a bolt-on dually and a dually. We carry three of
   the five under names that do not say which.

   The dry run resolved 48 of 287 and got some of them wrong in a way that is
   obvious once seen: it offered "Classic SS" — a SUPER SINGLE — four sizes
   that are all 8.25" dually rears. Wrong dimensions are worse than templated
   ones: a templated list at least reads as generic, while a wrong one reads
   as a specification and will be quoted.

   So a brand is wired only once someone has read its dry run and agreed with
   it. Scraping stays unrestricted — data/sizes/american-force.json is real,
   traceable and ready for whoever does the mapping pass.

   To wire a brand: run with --brand <slug> --dry, READ IT, then add it here. */
const WIRED = { fenix: 1, tis: 1, vision: 1 };
const FORCE = process.argv.includes('--force');

let changed = 0, merged = 0, unmatched = [], renamed = [], report = [];

fs.readdirSync(SRCDIR).filter(f => f.endsWith('.json')).forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join(SRCDIR, file), 'utf8'));
  if (ONLY && data.brand !== ONLY) return;
  if (!WIRED[data.brand] && !DRY && !FORCE) {
    console.log('\n' + data.brand + ': scraped but NOT WIRED — see the note in this file. ' +
      'Run --brand ' + data.brand + ' --dry to read what it would do.');
    return;
  }
  const brand = BRANDS.filter(b => b.slug === data.brand)[0];
  if (!brand) { console.log('  ' + data.brand + ': not a brand in brands.js'); return; }

  /* index the manufacturer's records by part key */
  /* Index their parts under every spelling we might arrive with. `match` is
     whatever the scraper could key on — a number for TIS, a part code for
     Fenix, a slug-derived name for American Force — so it goes through the
     SAME normaliser as ours. Indexing the raw string meant
     "M54 EVOLVE HO" never met our "M54EVOLVEHO" and 246 of American Force's
     287 models silently failed to resolve. */
  /* Index their parts under every spelling we might arrive with — `match` is
     a number for TIS, a part code for Fenix, a slug-derived name for American
     Force — through the SAME normaliser as ours, since indexing the raw
     string meant "M54 EVOLVE HO" never met our "M54EVOLVEHO".

     AN AMBIGUOUS KEY IS NOT A MATCH. The first version kept the first part to
     claim a key ("if (!byPart[k])") and that is how four American Force
     wheels — Classic SS, Independence SS, Shift SSBR and Liberty SS — all
     resolved to one unrelated part, 6H01 CONTRA SSBR, and would have been
     written with its sizes. nameKey() is deliberately lossy, so collisions
     are expected; what matters is that a collision DISQUALIFIES the key
     rather than picking a winner. Wrong dimensions are worse than templated
     ones, because a templated list at least looks generic. */
  /* TWO PASSES, STRONG KEYS FIRST. A part's own key is a strong claim; a key
     merely DERIVED from it is weak. TIS publish 544, 544rb and 544bm2 — the
     base wheel and two finish/version pages — and all three derive the number
     544. Treating those as a three-way collision disqualified 544 entirely
     and left "TIS 544" unresolved with its data sitting right there. A weak
     key that lands on an already-claimed strong key simply steps aside. */
  const byPart = {}, byName = {}, clash = {};
  function index(into, k, m, weak) {
    if (!k) return;
    if (into[k]) {
      if (into[k] !== m && !weak) clash[k] = true;
      return;                               // weak keys never displace or clash
    }
    into[k] = m;
  }
  const strong = [];
  data.models.forEach(m => {
    const raw = String(m.match);
    [raw.toUpperCase(), partKey(brand, raw)].forEach(k => index(byPart, k, m, false));
    strong.push([m, raw]);
  });
  strong.forEach(pair => {
    numberKeys(brand, pair[1]).forEach(k => index(byPart, k, pair[0], true));
  });
  data.models.forEach(m => {
    (m.titles || []).forEach(t => index(byName, nameKey(brand, t), m, false));
  });
  Object.keys(clash).forEach(k => { delete byPart[k]; delete byName[k]; });
  if (Object.keys(clash).length) {
    console.log('  ' + Object.keys(clash).length + ' key(s) are ambiguous and were dropped rather than guessed');
  }

  console.log('\n' + data.brand + '  (' + brand.models.length + ' models in our catalogue, ' +
    data.models.length + ' from ' + (data.source || '').split(' ')[0] + ')');

  /* resolve every one of our models to a part, then group */
  const groups = {};
  brand.models.forEach(m => {
    /* part number first, then the model NAME, so a wheel carried without its
       number still finds its specs — and lands in the same group as the entry
       that does carry the number, which is what collapses the duplicate. */
    /* three ways in, narrowest first: the whole part key, then the part
       NUMBER (ours is "111 Nemesis Forged Beadlock", theirs is 111), then
       the model NAME, which is the only way a listing carried without its
       number — Vision's "Midway" — finds its specs and lands in the same
       group as the entry that does carry it. */
    let k = partKey(brand, m.model);
    let hit = k && byPart[k];
    if (!hit) {
      /* most specific first, so "181NR" never falls through to "181" */
      const cands = numberKeys(brand, m.model);
      for (let i = 0; i < cands.length && !hit; i++) {
        if (byPart[cands[i]]) { hit = byPart[cands[i]]; k = cands[i]; }
      }
    }
    if (!hit) {
      const n = nameKey(brand, m.model);
      if (n && byName[n]) { hit = byName[n]; k = String(hit.match).toUpperCase(); }
    }
    if (!hit) { unmatched.push(brand.slug + '/' + m.model + (k ? ' (key ' + k + ')' : ' (no key)')); return; }
    (groups[k] = groups[k] || { part: hit, ours: [] }).ours.push(m);
  });

  const drop = new Set();
  Object.keys(groups).sort().forEach(k => {
    const g = groups[k];
    const bc = g.part.byConfig || {};
    /* Only the configurations our catalogue claims to sell. A UTV bucket on a
       truck model is a real Fenix product but it is not this listing. */
    const claimed = g.ours.reduce((acc, m) => acc.concat(m.configs || []), []);
    const wantUtv = claimed.indexOf('utv') > -1;
    const buckets = Object.keys(bc).filter(c => c !== 'utv' || wantUtv);
    let sizes = [];
    buckets.forEach(c => { sizes = sizes.concat(bc[c] || []); });
    sizes = [...new Set(sizes)].sort(cmpSize);
    if (!sizes.length) { report.push(brand.slug + '/' + k + ': manufacturer published no sizes, left as-is'); return; }

    const cfg = configsFrom(buckets.reduce((o, c) => (o[c] = bc[c], o), {}));

    /* the survivor keeps the richer record */
    const score = m => (m.feat ? 8 : 0) + (m.img ? 4 : 0) + (m.priceFrom ? 2 : 0) + (m.model.length > 6 ? 1 : 0);
    g.ours.sort((a, b) => score(b) - score(a));
    const keep = g.ours[0];
    g.ours.slice(1).forEach(m => {
      /* fold anything the survivor lacks up into it before dropping it */
      ['img', 'feat', 'priceFrom', 'priceSet', 'priceSetQty', 'finishes'].forEach(f => {
        if (keep[f] === undefined && m[f] !== undefined) keep[f] = m[f];
      });
      drop.add(m);
      merged++;
      report.push(brand.slug + ': merged "' + m.model + '" into "' + keep.model + '" (both are part ' + k + ')');
    });

    /* a fuller manufacturer name, but only as a strict prefix extension */
    const theirs = (g.part.titles || [])
      .map(t => cleanTitle(brand, t))
      .filter(Boolean)
      .sort((a, b) => a.length - b.length)[0];
    /* Accept their name when ours is a PREFIX of it ("FD014 Throwback" ->
       "FD014 Throwback Pro") or a SUFFIX of it ("Rocker" -> "412 Rocker"),
       since both only ADD what they publish and we were missing. Anything
       looser starts renaming wheels on a fuzzy match, which is how an
       American Force "Dynamo" once ended up with a Fuel photograph. */
    const T = theirs ? theirs.toUpperCase() : '', K = keep.model.toUpperCase();
    const GENERIC = /^(NEW|SALE|SOLD OUT|COMING SOON|FEATURED|MODEL|SIZE)$/;
    if (theirs && !GENERIC.test(T) && T !== K &&
        (T.indexOf(K) === 0 || T.lastIndexOf(K) === T.length - K.length)) {
      renamed.push(brand.slug + ': "' + keep.model + '" -> "' + theirs + '"');
      keep.model = theirs;
    }

    const before = (keep.sizes || []).join(' ');
    if (before !== sizes.join(' ')) changed++;
    console.log('  ' + keep.model.padEnd(26) + sizes.length + ' sizes  ' +
      '[' + cfg.join(', ') + ']');
    console.log('      was ' + (before || '(none)'));
    console.log('      now ' + sizes.join(' '));
    keep.sizes = sizes;
    keep.configs = cfg;
    keep.sizeSource = data.brand;           // provenance, printed in brands.js
    /* Bolt patterns from the claimed configurations ONLY. Fenix's UTV
       product is 4x137 / 4x156; those were appearing on the truck listing,
       which read as an offer to cut a Can-Am pattern in a 24x14. */
    let bolts = [];
    if (g.part.boltsByConfig) {
      buckets.forEach(c => { bolts = bolts.concat(g.part.boltsByConfig[c] || []); });
    } else if ((g.part.bolts || []).length) {
      bolts = g.part.bolts.slice();
    }
    bolts = [...new Set(bolts)].sort((a, b) => {
      const A = a.split('x').map(Number), B = b.split('x').map(Number);
      return A[0] - B[0] || A[1] - B[1];
    });
    if (bolts.length) keep.bolts = bolts;
  });

  brand.models = brand.models.filter(m => !drop.has(m));
});

/* ------------------------------------------------------- rewrite brands.js --
   Through the shared writer in tools/lib/serialize-brands.js, so this tool and
   tools/build-featured.js cannot disagree about the file's shape or quietly
   drop each other's fields. */
const { serialize } = require('./lib/serialize-brands');

console.log('\n' + '─'.repeat(64));
report.forEach(r => console.log('  ' + r));
if (renamed.length) { console.log('\n  renamed to the manufacturer\'s own fuller name:'); renamed.forEach(r => console.log('    ' + r)); }
if (unmatched.length) {
  console.log('\n  ' + unmatched.length + ' of our models did not resolve to a published part — LEFT UNTOUCHED:');
  unmatched.forEach(u => console.log('    ' + u));
}
console.log('\n  ' + changed + ' models re-sized, ' + merged + ' duplicates merged');

if (DRY) { console.log('  --dry, brands.js not written'); process.exit(0); }
fs.writeFileSync(BRANDS_JS, serialize(BRANDS));
console.log('  wrote brands.js');
console.log('\nnext: node tools/qc-catalog.js && node tools/test-fitment.js');

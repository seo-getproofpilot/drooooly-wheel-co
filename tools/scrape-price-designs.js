#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — Price Designs' seven builders, read from source

   Chris: "it gives you the option to pick: truck, Maverick R, Pro R, Turbo R,
   a buggy, a sand car. We should do the same thing... it shows you an actual
   rendering of the wheel, and as you select the options it changes the
   rendering. We should build the same exact setup."

   WHAT THIS IS NOT. It is not a browser crawl. His storefront runs The Custom
   Product Builder (a Shopify app), and that app does not compute the option
   tree — it DOWNLOADS it, as one static JSON per product:

       https://cdn.thecustomproductbuilder.com/61433217254/<shopifyProductId>.json

   One request per builder yields every category, every option, every price and
   every layer image, exactly as he configured them. Nothing is inferred and
   nothing is clicked.

   THE HIDE RULE, which is the whole ballgame. Each category carries
   `logic: {rules:[...], action:"hide"}`. The rules are a FLAT OR and the
   action fires when ANY of them matches:

       hidden  ⇔  ∃ rule r : selection[r.category] === r.option

   A category with nothing selected makes its own rules false. That reading was
   not obvious — `operator:"||"` sits on every rule, several categories group
   rules across two different categories, and two other readings (AND-across-
   categories, and show-when-matched) each fit part of the data. It was settled
   on 2026-10-02 by driving the live builder and comparing the rendered category
   list against all three predictions across eleven states (five lug patterns,
   three models, three wheel finishes). Flat-OR-hide-when-matched was the only
   one that got all eleven right. tools/test-builders.js pins four of those
   states as fixtures so a future change to the evaluator cannot quietly drift.

   THE TRUCK TREE BRANCHES ON THE LUG PATTERN, and his duplicate category
   titles are that branch rather than leftovers. Six lug gets SELECT MODEL with
   TURBINE / GALAXY / NEBULA; eight lug gets a different SELECT MODEL with
   TURBINE (+$200) / GALAXY / NOVA / CROWN, and each arm carries its own finish
   and post-cut categories. That is why a dozen titles appear twice, and why
   the step ids carry a numeric suffix — read a step's `when` line to see which
   arm it belongs to.

   VERIFIED AGAINST THE LIVE BUILDER, not just parsed. With FORD 6X135 his page
   renders ten steps and this decoder predicts the same ten in the same order;
   with GM 8X180 it renders sixteen — four wheel-finish steps and two POST-CUT
   WHEEL? at once, because the 8-lug arm opens every finish until a model is
   picked — and the decoder predicts the same sixteen. Both are pinned as
   fixtures in tools/test-builders.js.

   PRICES ARE HIS, UNTOUCHED. `price` arrives as a number on some options and a
   STRING ("600.00") on others; both are coerced to a number here, because a
   string would concatenate into the total downstream. Nothing is rounded,
   marked up or estimated.

   LAYER ART IS REFERENCED, NOT COPIED. 1,542 layer renders across the seven
   builders is ~100MB — too much to carry in a static repo, and all of it his
   photography. Both hosts his app uses are the same Google bucket
   (cdn.thecustomproductbuilder.com/<shop>/ ≡
   storage.googleapis.com/custom-product-builder/<shop>/), both serve
   `access-control-allow-origin: *` with no referrer check, so the specs store a
   bare filename against one `layerBase` and the render points at his CDN. Run
   tools/mirror-pd-art.js to pull every referenced file local and rewrite
   `layerBase` to our own path — one command, when he sends an asset pack or we
   decide to self-host. LAUNCH-CHECKLIST 1.13 carries the rights ask and 4.42
   the hotlink dependency.

   Usage:  node tools/scrape-price-designs.js [--dry] [--only <handle>]
   Then:   node tools/build-builders.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SHOP = 'pricedesigns-pd.com';
const SHOP_ID = '61433217254';
const LAYER_BASE = 'https://cdn.thecustomproductbuilder.com/' + SHOP_ID + '/images/products/';
const OUTDIR = path.join(ROOT, 'data/builders');
const REPORT = path.join(ROOT, 'data/specs/price-designs-builders.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DRY = process.argv.includes('--dry');
const ONLY = (process.argv.indexOf('--only') > -1) ? process.argv[process.argv.indexOf('--only') + 1] : null;

const get = u => execFileSync('curl', ['-sS', '-L', '--max-time', '60', '-A', UA, u],
  { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/* ------------------------------------------------------------------
   The seven builders, and how each presents on our site.

   `lane` ties into fitment.js's LANES so the shop page can file a builder
   under the same category lanes the catalogue already uses. `bolt` is the
   pattern the machine itself is drilled to — for the UTVs that is a property
   of the vehicle, not a choice, which is why only the truck has a lug step.
   ------------------------------------------------------------------ */
const BUILDERS = [
  { handle: 'truck-17x9',             id: 'pd-truck-17x9',   lane: 'single',
    platform: 'Lifted truck',          title: '17×9 simulated beadlock',
    bolt: null,  image: 'assets/wheels/price-designs/beadlock-titanium.jpg' },
  { handle: 'utv-pro-r-wheels',        id: 'pd-pro-r',        lane: 'sxs',
    platform: 'Polaris Pro R / Turbo R', title: 'Pro R & Turbo R beadlock',
    bolt: '4x156', image: 'assets/wheels/price-designs/utv-beadlock.png' },
  { handle: 'utv-maverick-r-wheels',   id: 'pd-maverick-r',   lane: 'sxs',
    platform: 'Can-Am Maverick R',     title: 'Maverick R beadlock',
    bolt: '4x137', image: 'assets/wheels/price-designs/utv-beadlock.png' },
  { handle: 'utv-x3-wheels',           id: 'pd-x3',           lane: 'sxs',
    platform: 'Can-Am Maverick X3',    title: 'X3 beadlock',
    bolt: '4x137', image: 'assets/wheels/price-designs/x3-desert.jpg' },
  { handle: 'utv-rzr-wheels',          id: 'pd-rzr',          lane: 'sxs',
    platform: 'Polaris RZR',           title: 'RZR beadlock',
    bolt: '4x156', image: 'assets/wheels/price-designs/utv-beadlock.png' },
  { handle: 'utv-expedition-wheels',   id: 'pd-expedition',   lane: 'sxs',
    platform: 'Can-Am Defender & Expedition', title: 'Expedition beadlock',
    bolt: '4x137', image: 'assets/wheels/price-designs/utv-beadlock.png' },
  { handle: 'utv-sand-car-wheels',     id: 'pd-sand-car',     lane: 'sand',
    platform: 'Sand car & buggy',      title: 'Sand car beadlock',
    bolt: '5x205', image: 'assets/wheels/price-designs/utv-beadlock.png' }
];

/* His lug labels, in the site's own bolt notation. This is the whole DROOOLY
   difference on the truck builder: his page makes the customer know their own
   pattern, ours reads it off the truck they already told the finder about, so
   builder.js can pre-select the chip. Every value here must exist in
   data/fitment/vehicle-bolt-patterns.json or build-builders.js refuses to
   write — a typo would make the preselect silently never fire.

   GM 6X5.5 and RAM 8X6.5 are the same patterns as 6x139.7 and 8x165.1; he
   writes them in inches, the fitment table in millimetres. */
const LUG_BOLTS = {
  'Ford 6x135': '6x135',
  'GM 6x5.5':   '6x139.7',
  'Ford 8x170': '8x170',
  'GM 8x180':   '8x180',
  'RAM 8x6.5':  '8x165.1'
};

/* ---- reading his shapes --------------------------------------------- */
const label  = o => ((o.option  || {}).data || {}).label;
const swatch = o => ((o.option  || {}).data || {}).value;
const layer  = o => ((o.preview || {}).data || {}).front;
const money  = o => { const n = parseFloat(o.price); return isFinite(n) && n > 0 ? n : 0; };

/* A layer URL from either host reduces to the same filename in the same
   bucket, so the specs store the filename and nothing else. Anything that is
   not on that bucket is kept absolute and reported, rather than silently
   rewritten into a path that would 404. */
function fileOf(url) {
  if (typeof url !== 'string' || !/^https?:/.test(url)) return null;
  const m = url.match(/\/(?:custom-product-builder\/)?61433217254\/images\/products\/([^/?#]+)$/);
  return m ? m[1] : url;
}

/* His titles are shouted and ours are not. "TURBINE WHEEL FINISH" becomes
   "Turbine wheel finish"; a token he writes as a bare model name stays a bare
   model name. Acronyms and sizes that would read wrong in sentence case are
   held back. */
const KEEP_CAPS = /^(RZR|UTV|TPMS|USA|ADA|GM|RAM|BRP|OEM|X3|XD|HD|SS|BB\d*|CC|R|[IVX]+)$/i;
const ALL_CAPS = ['RZR', 'UTV', 'TPMS', 'USA', 'ADA', 'GM', 'RAM', 'BRP', 'OEM', 'X3', 'XD', 'HD', 'SS', 'CC'];
function sentence(s) {
  /* He disambiguates his own duplicate categories by hanging the lug count on
     the end — "POST-CUT CENTER CAP? 6" and "POST-CUT CENTER CAP? 8" are the
     six-lug and eight-lug versions of the same question. That is a note to
     himself, and on a customer's screen it reads as a typo. Our tree already
     branches correctly, and the step ids stay unique on their own, so the
     marker goes. Only a bare 6 or 8 trailing a question mark — never a size,
     a price or a real word. */
  s = String(s || '').replace(/\?\s*[68]\s*$/, '?');
  return String(s || '').trim().replace(/\s+/g, ' ')
    .split(' ').map((w, i) => {
      const bare = w.replace(/[?,.:]+$/, ''), tail = w.slice(bare.length);
      /* a size reads as 17x9 or 6x135, never 17X9 */
      if (/^[0-9]+(\.[0-9]+)?[Xx][0-9.]+$/.test(bare)) return bare.replace(/X/, 'x') + tail;
      /* anything with a digit in it is a size, a code or a price — leave it */
      if (/[0-9]/.test(bare) && !ALL_CAPS.includes(bare.toUpperCase())) return w;
      const up = bare.toUpperCase();
      if (ALL_CAPS.includes(up)) return up + tail;
      if (KEEP_CAPS.test(bare) && bare === up && bare.length <= 3) return w;
      const lower = bare.toLowerCase();
      return (i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower) + tail;
    }).join(' ');
}

/* A step's condition, in English, written into the spec beside the rules.
   `hideWhen` is correct but unreadable, and the thing a maintainer actually
   needs to know about `model-2` is that it is the eight-lug arm. */
function whenLine(hideWhen, labelOf) {
  const by = {};
  hideWhen.forEach(r => { (by[r.step] = by[r.step] || []).push(r.value); });
  const parts = Object.keys(by).map(sid => {
    const vals = by[sid];
    const list = vals.length === 1 ? vals[0]
      : vals.slice(0, -1).join(', ') + ' or ' + vals[vals.length - 1];
    return (labelOf(sid) || sid).toLowerCase() + ' is ' + list;
  });
  return 'Shown unless ' + parts.join(', or ') + '.';
}

/* Step ids have to be stable across re-runs (they key the saved build and the
   hideWhen references) and unique within a builder, including across his
   duplicate titles. Slug of the title, then a numeric suffix in category
   order. */
function stepIds(cats) {
  const used = {}, out = {};
  cats.forEach(c => {
    let base = String(c.title || 'step').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/^(select|choose)-/, '') || 'step';
    used[base] = (used[base] || 0) + 1;
    out[c.id] = used[base] === 1 ? base : base + '-' + used[base];
  });
  return out;
}

/* The visibility rule lives in builder-logic.js so the engine, the card tool,
   the price ceiling and this cannot drift. Reachability is computed with
   GATING OFF, because a step that only ever appears once another is answered
   is still a step we must keep and whose art we must reference — gating is a
   presentation decision, not a statement about what exists. */
const LOGIC = require(path.join(ROOT, 'builder-logic.js'));
const visible = (steps, pick) => LOGIC.visible(steps, pick, { gate: false });

/* Which categories can ever be seen? Pulling layer art for a category no
   customer can reach would mean referencing a few hundred renders for nothing.
   Rather than hand-pick, walk the tree: a step only becomes reachable once the
   steps it hangs off are themselves visible and answered a particular way.

   The walk is randomised because the deep steps need a specific combination —
   POST-CUT HALO RING? wants HALO chosen AND its finish set to a colour — and
   enumerating every combination is exponential. Seeded, so a re-run produces
   byte-identical specs. */
function reachable(steps, defaults, rounds) {
  const seen = new Set();
  /* xorshift32 via Math.imul, NOT a textbook LCG. `seed * 1103515245` runs to
     ~2e18 on a 31-bit seed, past Number.MAX_SAFE_INTEGER, and the generator
     quietly collapses to a near-constant — which silently pruned every ring
     finish except the first, because the ring style never varied. */
  let seed = 20261002;
  const rnd = n => {
    seed ^= seed << 13; seed |= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;  seed |= 0;
    return Math.abs(seed) % n;
  };

  visible(steps, defaults).steps.forEach(s => seen.add(s.id));
  for (let i = 0; i < rounds; i++) {
    let pick = {};
    /* Several passes: answering the steps visible now can open steps that were
       not, and those need answering too before the next layer appears. */
    for (let pass = 0; pass < 6; pass++) {
      const v = visible(steps, pick);
      pick = v.pick;
      v.steps.forEach(s => {
        const opts = s.options || [];
        if (opts.length) pick[s.id] = opts[rnd(opts.length)].v;
      });
    }
    visible(steps, pick).steps.forEach(s => seen.add(s.id));
  }
  return seen;
}

/* ---- decode one builder --------------------------------------------- */
function decode(meta, cfg) {
  const d = cfg.data;
  const panel = d.panels[0];
  const cats = panel.categories;
  const ids = stepIds(cats);

  /* label -> option id, per category, so a rule's option id can be turned
     into the value our engine compares against */
  const optLabel = {};
  cats.forEach(c => (c.options || []).forEach(o => { optLabel[o.id] = label(o); }));

  const extras = { offBucket: [], dupTitles: {}, stringPrices: 0 };

  const steps = cats.map(c => {
    const isText = c.type === 'input';
    const opts = (c.options || []).map(o => {
      if (typeof o.price === 'string' && parseFloat(o.price) > 0) extras.stringPrices++;
      const lay = fileOf(layer(o));
      const sw = fileOf(swatch(o));
      if (lay && /^https?:/.test(lay)) extras.offBucket.push(lay);
      const out = { v: sentence(label(o)) };
      const add = money(o);
      if (add) out.add = add;
      if (LUG_BOLTS[out.v]) out.bolt = LUG_BOLTS[out.v];
      if (lay) out.layer = lay;
      /* The swatch is the little image on his chip. Only keep it when it is a
         real picture — plenty of options carry a hex colour or the layer URL
         over again, and neither earns a thumbnail. */
      if (sw && !/^https?:/.test(sw) && sw !== lay) out.swatch = sw;
      return out;
    });

    /* His rules reference (category, option) pairs; ours reference
       (stepId, value), because the engine only ever knows values. A rule
       whose option no longer exists is dropped and reported — a dangling
       reference would evaluate false forever and silently pin a step open. */
    const dangling = [];
    const hideWhen = (((c.logic || {}).rules) || []).map(r => {
      const sid = ids[r.category], val = optLabel[r.option];
      if (!sid || val == null) { dangling.push(r.option); return null; }
      return { step: sid, value: sentence(val) };
    }).filter(Boolean);

    const st = {
      id: ids[c.id],
      label: sentence(c.title) || 'Options',
      type: isText ? 'text' : 'chips',
      required: !!c.required
    };
    if (typeof c.zIndex === 'number') st.z = c.zIndex;
    if (hideWhen.length) st.hideWhen = hideWhen;
    if (isText) {
      st.placeholder = 'Lift, tyre size, offset you’re after, a deadline — anything that changes the build.';
    } else {
      st.options = opts;
      /* A category with exactly one option is not a question. He builds only
         the Turbine for the RZR, so "SELECT MODEL / [TURBINE]" is a one-button
         row that asks the customer to agree with the only thing on offer.
         Typed as a fact instead: the engine selects it, prices it and stacks
         its layer, and the page states it rather than asking. */
      if (opts.length === 1) st.type = 'fact';
    }
    if (dangling.length) extras.dangling = (extras.dangling || []).concat(dangling);
    return st;
  });

  /* His own opening state. Everything the customer sees first — including
     which finish step is open — follows from these. */
  const defaults = {};
  const dop = (cfg.settings || {}).defaultOptions || {};
  Object.keys(dop).forEach(p => Object.keys(dop[p] || {}).forEach(cid => {
    const chosenIds = dop[p][cid] || [];
    if (!chosenIds.length || !ids[cid]) return;
    const v = optLabel[chosenIds[0]];
    if (v != null) defaults[ids[cid]] = sentence(v);
  }));

  const live = reachable(steps, defaults, 4000);
  const dead = steps.filter(s => !live.has(s.id));
  const kept = steps.filter(s => live.has(s.id));

  /* A rule pointing at a pruned step can never fire, so it would only confuse
     the engine and anyone reading the spec. */
  const labelOf = id => (kept.filter(s => s.id === id)[0] || {}).label;
  kept.forEach(s => {
    if (!s.hideWhen) return;
    s.hideWhen = s.hideWhen.filter(r => live.has(r.step));
    if (!s.hideWhen.length) { delete s.hideWhen; return; }
    s.when = whenLine(s.hideWhen, labelOf);
  });

  /* Only keep the default for a step that survived. */
  Object.keys(defaults).forEach(k => { if (!live.has(k)) delete defaults[k]; });

  const titles = {};
  kept.forEach(s => { titles[s.label] = (titles[s.label] || 0) + 1; });
  extras.dupTitles = Object.keys(titles).filter(t => titles[t] > 1);

  return { steps: kept, dead: dead.map(s => s.id), defaults, extras, raw: { cats: cats.length } };
}

/* ---- the file we write ---------------------------------------------- */
function spec(meta, cfg, dec) {
  const layers = new Set();
  dec.steps.forEach(s => (s.options || []).forEach(o => { if (o.layer) layers.add(o.layer); }));

  const about = [
    meta.platform + ' — Price Designs\' own configurator, rebuilt here.',
    '',
    'GENERATED by tools/scrape-price-designs.js from the builder config his',
    'storefront downloads: cdn.thecustomproductbuilder.com/' + SHOP_ID + '/' +
      cfg.__productId + '.json, read on ' + new Date().toISOString().slice(0, 10) + '.',
    'Do not hand-edit — re-run the tool. Read that file\'s header before',
    'changing anything here; it documents the hide rule and why it is not the',
    'obvious one.',
    '',
    'EVERY FIGURE IS HIS. Base price and every upcharge come from his config',
    'untouched — nothing estimated, marked up or rounded.',
    '',
    'THE WORD \'SIMULATED\' IS LOAD-BEARING and he capitalises it himself. A',
    'simulated beadlock ring is cosmetic: it does not clamp the tyre bead the',
    'way a true beadlock does. Never shorten it to \'beadlock\' in copy — that',
    'is a safety claim, not a style one.',
    '',
    'LAYER ART IS HIS AND IS NOT COPIED INTO THIS REPO. Every `layer` is a',
    'filename under `layerBase`, which points at his CDN. Run',
    'tools/mirror-pd-art.js to pull them local and rewrite layerBase.',
    'LAUNCH-CHECKLIST 1.13 (rights) and 4.42 (the hotlink dependency).'
  ];
  if (meta.bolt) {
    about.push('',
      'NO LUG STEP. A ' + meta.platform + ' is drilled ' + meta.bolt + ' from the factory,',
      'so the pattern is a fact about the machine rather than a choice. It is',
      'recorded as `bolt` and stated on the page instead of asked.');
  }

  return {
    id: meta.id,
    brand: 'price-designs',
    brandName: 'Price Designs',
    platform: meta.platform,
    lane: meta.lane,
    /* Where this sits in its lane on the picker. The BUILDERS table above is
       already in the order a customer should meet them — truck first, then the
       side-by-sides by how many he sells, then the sand car — so that order is
       published rather than re-stated as a sort rule inside builder.js. Keeping
       it here means the engine carries no product knowledge, which is the whole
       reason the specs exist. */
    rank: BUILDERS.indexOf(meta),
    title: meta.title,
    subtitle: 'Build your own — set of four',
    setOf: 4,
    basePrice: Number(cfg.data.base.price),
    bolt: meta.bolt,
    image: meta.image,
    /* The picker card. Composited from this builder's own default layer stack
       by tools/make-builder-cards.js, because four of the seven platforms had
       no photograph of their own and were sharing one stock UTV shot — see
       that tool's header. `image` stays the real photograph where we have one
       (the truck), since it is what the stage falls back to and what a sent
       build carries. */
    card: 'assets/wheels/price-designs/' + meta.id + '-card.jpg',
    layerBase: LAYER_BASE,
    stage: { w: 1000, h: 1000 },
    baseLayer: fileOf(((cfg.data.base.image || {}).front) || null),
    source: 'https://' + SHOP + '/products/' + meta.handle,
    about: about,
    includes: 'Billet centre caps, SIMULATED beadlock rings, titanium hardware and TPMS valve stems are included.',
    madeIn: 'Forged in the USA from 6061-T6 aluminium and machined in their own facility in Gilbert, Arizona.',
    defaults: dec.defaults,
    steps: dec.steps
  };
}

/* ---- run ------------------------------------------------------------ */
const report = { scraped: new Date().toISOString().slice(0, 10), shop: SHOP, shopId: SHOP_ID,
  layerBase: LAYER_BASE, builders: [] };
let allLayers = new Set(), allSwatches = new Set();

BUILDERS.filter(b => !ONLY || b.handle === ONLY).forEach(meta => {
  process.stdout.write('  ' + meta.handle.padEnd(24));
  let pid, cfg;
  try {
    pid = JSON.parse(get('https://' + SHOP + '/products/' + meta.handle + '.json')).product.id;
    cfg = JSON.parse(get('https://cdn.thecustomproductbuilder.com/' + SHOP_ID + '/' + pid + '.json'));
  } catch (e) {
    console.log('FAILED ' + String(e.message || e).slice(0, 60));
    report.builders.push({ id: meta.id, handle: meta.handle, error: String(e.message || e).slice(0, 200) });
    return;
  }
  cfg.__productId = pid;

  const dec = decode(meta, cfg);
  const out = spec(meta, cfg, dec);

  const lay = new Set(), sw = new Set();
  dec.steps.forEach(s => (s.options || []).forEach(o => {
    if (o.layer) lay.add(o.layer);
    if (o.swatch) sw.add(o.swatch);
  }));
  allLayers = new Set([...allLayers, ...lay]);
  allSwatches = new Set([...allSwatches, ...sw]);

  console.log(`$${out.basePrice} · ${dec.raw.cats} cats → ${dec.steps.length} steps ` +
              `(${dec.dead.length} dead) · ${lay.size} layers`);

  report.builders.push({
    id: meta.id, handle: meta.handle, productId: pid, platform: meta.platform,
    basePrice: out.basePrice, categories: dec.raw.cats, steps: dec.steps.length,
    deadCategories: dec.dead, layers: lay.size, swatches: sw.size,
    duplicateTitles: dec.extras.dupTitles,
    stringPricesCoerced: dec.extras.stringPrices,
    danglingRules: (dec.extras.dangling || []).length,
    offBucketImages: dec.extras.offBucket
  });

  if (!DRY) fs.writeFileSync(path.join(OUTDIR, meta.id + '.json'), JSON.stringify(out, null, 2) + '\n');
  sleep(700);
});

report.totals = { layers: allLayers.size, swatches: allSwatches.size };
if (!DRY) {
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1) + '\n');
  fs.writeFileSync(path.join(path.dirname(REPORT), 'price-designs-art.txt'),
    [...allLayers, ...allSwatches].sort().join('\n') + '\n');
}
console.log(`\n  ${report.totals.layers} distinct layer renders, ${report.totals.swatches} swatches`);
console.log(`  ${DRY ? '(dry run — nothing written)' : 'report: ' + path.relative(ROOT, REPORT)}`);

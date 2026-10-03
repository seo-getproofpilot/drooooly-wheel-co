#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — put the seven builders into the catalogue

   The specs under data/builders/ know everything about a Price Designs
   product: its platform, its real sizes, its bolt pattern, its base price and
   what it looks like. brands.js was carrying a hand-written guess from before
   any of that existed — "15x6, 15x7, 15x8" for every UTV, when the Pro R
   actually comes 15x8 (5+3), 15x8 (4+4), 15x10.5 (5+5.5), 17x8 (5+3),
   17x8 (4+4) and 17x11 (5+6) — one shared stock photo across five models, and
   no Expedition at all.

   So rather than retype it, read it. This rewrites the Price Designs models in
   brands.js from the specs: one model per builder, each with its own card
   image, its own sizes, its own pattern and a `builder` link that makes the
   shop card say "Build yours" and go to build.html.

   IT EDITS brands.js IN PLACE, matching only the price-designs block, because
   brands.js is 900 lines of other brands that must not move. Re-runnable: it
   replaces the models array each time rather than appending.

   RUN IT AFTER tools/scrape-price-designs.js and tools/make-builder-cards.js.
   tools/test-builders.js checks the catalogue and the specs still agree.

   Usage:  node tools/wire-builders.js [--dry]
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BRANDS = path.join(ROOT, 'brands.js');
const SRCDIR = path.join(ROOT, 'data/builders');
const DRY = process.argv.includes('--dry');

const specs = fs.readdirSync(SRCDIR).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(SRCDIR, f), 'utf8')));

/* The lane the catalogue files a product under. `single` is a one-wheel-per-
   corner truck; `utv` covers the side-by-sides and the sand cars, which is
   how catalog.js already groups them. */
const CONFIG = { single: ['single'], sxs: ['utv'], sand: ['utv'] };

/* Sizes, read off the builder rather than guessed. His size steps are the only
   place the real ones are written down, and he labels them with the backspace
   as well ("15x10.5 (5+5.5)"), which the catalogue has no field for — so the
   bare size is kept and the rest dropped. */
function sizesOf(spec) {
  const out = [];
  spec.steps.forEach(st => {
    if (!/wheel size|^size/i.test(st.label)) return;
    (st.options || []).forEach(o => {
      const m = String(o.v).match(/^(\d+(?:\.\d+)?x\d+(?:\.\d+)?)/i);
      if (m && out.indexOf(m[1]) < 0) out.push(m[1]);
    });
  });
  if (out.length) return out.sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));

  /* His RZR and truck builders do not ask for a size, and his pages do not
     state one — so there is nothing to read. Rather than invent a figure or
     emit nothing (catalog.js minDia/maxDia fall back to 22", which would file
     a 15" RZR wheel under the 22" filter), fall back to what the title says,
     then to what the catalogue already carried.

     The RZR row is the only one reaching the last fallback and it is NOT
     verified — it predates this tool. LAUNCH-CHECKLIST 4.43: ask Kade what
     sizes the RZR beadlock actually comes in. */
  const fromTitle = String(spec.title).match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/);
  if (fromTitle) return [fromTitle[1] + 'x' + fromTitle[2]];
  return CARRIED[spec.id] || [];
}

/* What brands.js held before this tool existed, kept only where his builder
   gives us nothing better. Unverified — see sizesOf(). */
const CARRIED = { 'pd-rzr': ['15x6', '15x7', '15x8'] };

/* The models he offers, which is what a shopper recognises — TURBINE, GALAXY,
   NOVA. Taken from whichever step actually names them. */
function finishesOf(spec) {
  const out = [];
  spec.steps.forEach(st => {
    if (!/^(select )?model$/i.test(st.label)) return;
    (st.options || []).forEach(o => { if (out.indexOf(o.v) < 0) out.push(o.v); });
  });
  return out.length ? out : ['Machined', 'Gloss black'];
}

const q = s => JSON.stringify(String(s));
const arr = a => '[' + a.map(q).join(',') + ']';

const shared = {};
specs.forEach(s => { shared[s.image] = (shared[s.image] || 0) + 1; });

const models = specs.map(s => {
  const sizes = sizesOf(s);
  const fin = finishesOf(s);
  /* The card shows the PRODUCT name — "Pro R & Turbo R beadlock" — while the
     platform is what the builder page kickers with. Using the platform here
     would put "Lifted truck" on a shop card. */
  /* A real photograph beats a composite, but only where we have one of its
     own — four of these platforms were sharing a single stock UTV shot, which
     is the clone the card images exist to break. So: the spec's photo when no
     other builder is using it, the composite otherwise. */
  const img = (shared[s.image] === 1) ? s.image : s.card;
  let line = `      { model: ${q(s.title)}, configs: ${arr(CONFIG[s.lane] || ['utv'])}, ` +
             `sizes: ${arr(sizes)}, finishes: ${arr(fin)}` +
             `, img: ${q(img)}`;
  line += `, priceSet: ${s.basePrice}, priceSetQty: ${s.setOf}`;
  if (s.bolt) line += `, bolts: ${arr([s.bolt])}`;
  line += `, builder: ${q(s.id)}`;
  /* EVERY builder is featured. `feat` decides what the brand page shows, and
     it exists because most brands have 150 styles and we show the popular
     ones. Price Designs has seven products in total and all seven are
     configurators — so "most popular styles" is the whole catalogue, and
     flagging only the truck left the brand page showing one of seven with no
     way to see the rest. The rank doubles as the order. */
  line += `, feat: ${s.rank + 1}`;
  return line + ' }';
});

const block =
`    models: [
      /* GENERATED by tools/wire-builders.js from data/builders/*.json.
         Do not hand-edit — re-run the tool.

         \`builder\` makes a model configurable: the card links to build.html
         instead of wheel.html and offers "Build yours" rather than add-to-cart,
         because adding an unconfigured build-your-own to a cart at base price
         would be a lie. priceSet is Price Designs' own published base for the
         set of four; the builder prices every option from the same figures.

         \`img\` is a composite of that builder's own default layer stack, not a
         photograph — four of these platforms had no photo of their own and
         were sharing one stock UTV shot. See tools/make-builder-cards.js. */
${models.join(',\n')}
    ]`;

const src = fs.readFileSync(BRANDS, 'utf8');

/* Match the price-designs object's models array and nothing else. Anchored on
   the slug so the 900 lines of other brands cannot be touched. */
const start = src.indexOf('slug: "price-designs"');
if (start < 0) { console.error('wire-builders: no price-designs block in brands.js'); process.exit(1); }
const mStart = src.indexOf('    models: [', start);
if (mStart < 0) { console.error('wire-builders: price-designs has no models array'); process.exit(1); }

/* Walk the brackets, because the array holds nested [] in every row. */
let depth = 0, mEnd = -1;
for (let i = src.indexOf('[', mStart); i < src.length; i++) {
  if (src[i] === '[') depth++;
  else if (src[i] === ']') { depth--; if (!depth) { mEnd = i + 1; break; } }
}
if (mEnd < 0) { console.error('wire-builders: unbalanced models array'); process.exit(1); }

const out = src.slice(0, mStart) + block + src.slice(mEnd);

/* Never write a brands.js that will not parse — it is loaded by every page. */
try {
  const sandbox = {};
  new Function('window', out.replace(/^/, ''))(sandbox);
  if (!Array.isArray(sandbox.BRANDS)) throw new Error('window.BRANDS is not an array');
  const pd = sandbox.BRANDS.filter(b => b.slug === 'price-designs')[0];
  if (!pd || pd.models.length !== specs.length) {
    throw new Error('expected ' + specs.length + ' Price Designs models, got ' + (pd ? pd.models.length : 0));
  }
} catch (e) {
  console.error('wire-builders: refusing to write — ' + e.message);
  process.exit(1);
}

if (!DRY) fs.writeFileSync(BRANDS, out);
specs.forEach(s => console.log(`  ${s.id.padEnd(16)} ${s.platform.padEnd(30)} ` +
  `${(sizesOf(s).length || 1)} sizes · $${s.basePrice.toLocaleString()} · ${s.bolt || 'asks'}`));
console.log(`\n  ${specs.length} models ${DRY ? '(dry run)' : 'written to brands.js'}`);

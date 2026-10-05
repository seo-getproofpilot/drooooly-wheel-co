'use strict';
/* ============================================================
   DROOOLY — the one serialiser for brands.js

   WHY THIS IS ITS OWN FILE. brands.js is written by more than one tool —
   tools/build-featured.js wires up photography and prices,
   tools/wire-wheel-sizes.js wires up the manufacturers' published size
   matrices — and for a while they each had their own copy of the writer.
   Two writers for one file has already cost this repo real data: `builder`
   was missing from build-featured.js's copy until 2026-10-02, so every run
   of it silently deleted the build-your-own link from seven products.

   A field that is not in FIELDS is a field the next tool run DELETES. That
   is the whole reason this is one list in one place, and why
   tools/test-fitment.js pins a round trip through it.

   Any tool that writes brands.js requires this. None of them format a model
   themselves.
   ============================================================ */

/* Every field a model may carry, in the order it is written. Appending here
   is how a new field survives; forgetting to is how one disappears. */
const FIELDS = [
  'model',        // display name, the manufacturer's own where we know it
  'configs',      // "single" | "dually" | "super single" | "utv"
  'sizes',        // "DIAxWIDTH", ascending; never a bare diameter
  'finishes',
  'finishSource', // where a finish list was read from, when it was sourced
  'img',
  'imgSource',    // the manufacturer page this photo was taken from, where a
                  // generic stand-in was replaced (tools/fix-wheel-art.js)
  'imgs',         // [{finish, img}] — per-finish art where we hold it
  'priceFrom',    // lowest publishable "starting at", whole dollars
  'priceSet',
  'priceSetQty',
  'bolts',
  'sizeSource',   // brand slug whose own published spec data these sizes came
                  // from — data/sizes/<slug>.json, or data/specs/<slug>-sizes.json
                  // for the brands scraped before that directory existed
  'builder',      // makes the model configurable — links to build.html
  'short',
  'photo',
  'feat'          // featured rank on the brand page
];

const q = s => JSON.stringify(s);
const arr = a => '[' + (a || []).map(q).join(',') + ']';

function model(m) {
  const parts = [];
  FIELDS.forEach(function (k) {
    const v = m[k];
    if (v === undefined || v === null) return;
    if (k === 'imgs') {
      parts.push('imgs: [' + v.map(x => '{finish:' + q(x.finish) + ',img:' + q(x.img) + '}').join(',') + ']');
    } else if (Array.isArray(v)) {
      if (!v.length) return;
      parts.push(k + ': ' + arr(v));
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      parts.push(k + ': ' + v);
    } else {
      parts.push(k + ': ' + q(v));
    }
  });
  /* Anything the catalogue grew that nobody added to FIELDS. Carried through
     rather than dropped, and announced, because silence is how `builder`
     disappeared. */
  Object.keys(m).forEach(function (k) {
    if (FIELDS.indexOf(k) < 0) {
      parts.push(k + ': ' + JSON.stringify(m[k]));
      if (!model._warned) model._warned = {};
      if (!model._warned[k]) {
        model._warned[k] = 1;
        console.log('  note: model field "' + k + '" is not in serialize-brands FIELDS — ' +
                    'carried through, but add it to the list');
      }
    }
  });
  return '      { ' + parts.join(', ') + ' }';
}

function brand(b) {
  let h = '  {\n    slug: ' + q(b.slug) + ', name: ' + q(b.name) + ', kind: ' + q(b.kind) +
          ', featured: ' + !!b.featured + ',\n';
  h += '    site: ' + q(b.site || '') + ', tagline: ' + q(b.tagline || '') + ',\n';
  h += '    pricing: ' + q(b.pricing || 'quote') + ',\n';
  if (typeof b.priceFrom === 'number') h += '    priceFrom: ' + b.priceFrom + ',\n';
  if (b.priceNote) h += '    priceNote: ' + q(b.priceNote) + ',\n';
  if (b.bolts && b.bolts.length) h += '    bolts: ' + arr(b.bolts) + ',\n';
  h += '    models: [\n' + b.models.map(model).join(',\n') + '\n    ]\n  }';
  return h;
}

const HEADER = `/* ============================================================
   DROOOLY Wheel & Tire — brand + wheel catalog data
   configs: "single" | "dually" | "super single" | "utv"
   sizes:   "DIAxWIDTH" — a bare diameter is not a size, and
            tools/qc-catalog.js fails the build on one
   img  (optional): local product photo under assets/wheels/<brand>/
   feat (optional): featured rank — these show on the brand page;
                    everything else lives behind "view the full lineup"
   sizeSource (optional): these sizes and configs are the MANUFACTURER'S own
                    published matrix, read from data/sizes/<slug>.json by
                    tools/wire-wheel-sizes.js — not ours.
   GENERATED FILE — written only through tools/lib/serialize-brands.js, by
                    tools/build-featured.js and tools/wire-wheel-sizes.js
   ============================================================ */
window.BRANDS = [
`;

function serialize(brands) {
  return HEADER + brands.map(brand).join(',\n') + '\n];\n';
}

module.exports = { serialize, FIELDS, model, brand, HEADER };

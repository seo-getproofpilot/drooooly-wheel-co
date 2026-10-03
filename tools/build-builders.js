#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — compile the builder specs into builders-data.js

   The site is static and is opened from file:// as often as from a server,
   so it cannot fetch() a JSON file. Same arrangement brands.js, builds-data.js
   and fitment-data.js already use: author the data as JSON, ship a generated
   .js that assigns to window.

   It validates before it writes, because a bad spec here is a customer
   ordering a wheel that cannot be built:
     - every step has an id, a label and a type we handle
     - every chips step has at least two options, and no duplicate values
     - every `add` is a non-negative number (a missing `add` means zero, but a
       STRING "600" would silently concatenate into the total)
     - every {token} in a label names a step that appears BEFORE it, or the
       heading renders with an unresolved placeholder in front of a customer
     - every lug `bolt` is a pattern the fitment table actually knows, or the
       preselect can never match and the tie-in is dead on arrival

   Usage:  node tools/build-builders.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRCDIR = path.join(ROOT, 'data/builders');
const OUT = path.join(ROOT, 'builders-data.js');

const errs = [];
const TYPES = ['chips', 'text', 'fact'];

/* the patterns the finder can resolve, so a lug step cannot reference one
   that will never match a real truck */
const VEH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/fitment/vehicle-bolt-patterns.json'), 'utf8'));
const KNOWN_BOLTS = new Set(VEH.patterns.map(r => r.bolt));

const specs = {};
const files = fs.readdirSync(SRCDIR).filter(f => f.endsWith('.json')).sort();

files.forEach(f => {
  const spec = JSON.parse(fs.readFileSync(path.join(SRCDIR, f), 'utf8'));
  const where = f;
  if (!spec.id) errs.push(`${where}: no id`);
  if (!(spec.basePrice >= 0)) errs.push(`${where}: basePrice must be a number`);
  if (!spec.image) errs.push(`${where}: no image`);
  if (spec.image && !fs.existsSync(path.join(ROOT, spec.image))) errs.push(`${where}: image not on disk — ${spec.image}`);
  /* The picker shows `card`; a missing one is a broken tile in a seven-tile
     grid, which is exactly the failure make-builder-cards.js exists to stop.
     Run `node tools/make-builder-cards.js` after re-scraping. */
  if (spec.card && !fs.existsSync(path.join(ROOT, spec.card))) errs.push(`${where}: card not on disk — ${spec.card} (run tools/make-builder-cards.js)`);
  if (!Array.isArray(spec.steps) || !spec.steps.length) { errs.push(`${where}: no steps`); return; }

  const seenIds = [];
  spec.steps.forEach((st, i) => {
    const w = `${where} step[${i}] ${st.id || '(no id)'}`;
    if (!st.id) errs.push(`${w}: no id`);
    if (seenIds.indexOf(st.id) > -1) errs.push(`${w}: duplicate step id`);
    if (!st.label) errs.push(`${w}: no label`);
    if (TYPES.indexOf(st.type) < 0) errs.push(`${w}: type must be one of ${TYPES.join('/')}`);

    /* a {token} must name a step we have ALREADY seen */
    (String(st.label).match(/\{(\w+)\}/g) || []).forEach(tok => {
      const ref = tok.slice(1, -1);
      if (seenIds.indexOf(ref) < 0) {
        errs.push(`${w}: label references {${ref}}, which is not an earlier step`);
      }
    });

    if (st.type === 'fact' && (st.options || []).length !== 1) {
      errs.push(`${w}: a fact step states exactly one option, got ${(st.options || []).length}`);
    }

    if (st.type === 'chips' || st.type === 'fact') {
      const opts = st.options || [];
      if (st.type === 'chips' && opts.length < 2) errs.push(`${w}: a chips step needs at least two options`);
      const vals = [];
      opts.forEach(o => {
        if (!o.v) errs.push(`${w}: an option has no value`);
        if (vals.indexOf(o.v) > -1) errs.push(`${w}: duplicate option "${o.v}"`);
        vals.push(o.v);
        if (o.add !== undefined && (typeof o.add !== 'number' || o.add < 0 || !isFinite(o.add))) {
          errs.push(`${w}: "${o.v}" has add=${JSON.stringify(o.add)} — must be a non-negative number`);
        }
        if (o.bolt && !KNOWN_BOLTS.has(o.bolt)) {
          errs.push(`${w}: "${o.v}" claims bolt ${o.bolt}, which no vehicle in the fitment table uses`);
        }
      });
    }
    seenIds.push(st.id);
  });

  /* ---- a second pass, now that every step id and value is known --------
     These are the checks that catch the failures you cannot see by reading a
     7,000-line generated spec: a rule naming a step that no longer exists, or
     a value that no longer exists on it. Either one evaluates false forever,
     which does not throw — it silently pins a step open, so the customer is
     offered a HALO ring finish on a wheel with a SAWBLADE ring. */
  const byId = {};
  spec.steps.forEach(st => { byId[st.id] = st; });

  spec.steps.forEach((st, i) => {
    const w = `${where} step[${i}] ${st.id}`;
    (st.hideWhen || []).forEach(r => {
      const ref = byId[r.step];
      if (!ref) { errs.push(`${w}: hideWhen names step "${r.step}", which does not exist`); return; }
      if (ref === st) { errs.push(`${w}: hideWhen references itself`); return; }
      const vals = (ref.options || []).map(o => o.v);
      if (vals.indexOf(r.value) < 0) {
        errs.push(`${w}: hideWhen wants ${r.step} = "${r.value}", which is not one of its options`);
      }
    });

    /* A step hidden by every value of a step that is always answered can never
       be seen. The scraper prunes these; this catches a hand edit that creates
       one. */
    const covered = {};
    (st.hideWhen || []).forEach(r => { (covered[r.step] = covered[r.step] || []).push(r.value); });
    Object.keys(covered).forEach(sid => {
      const ref = byId[sid];
      if (!ref || ref.type !== 'fact') return;
      if (covered[sid].indexOf(ref.options[0].v) > -1) {
        errs.push(`${w}: hidden by ${sid}, which is a fact always set to "${ref.options[0].v}" — this step can never be seen`);
      }
    });
  });

  /* Layer art is referenced by filename against one base, so a spec that has
     layers and no base would render a page of broken images. */
  const hasLayers = spec.steps.some(st => (st.options || []).some(o => o.layer));
  if (hasLayers && !spec.layerBase) errs.push(`${where}: options carry layers but there is no layerBase`);
  if (hasLayers && !(spec.stage && spec.stage.w > 0 && spec.stage.h > 0)) {
    errs.push(`${where}: layered builders need stage {w,h} to reserve the aspect box`);
  }

  /* The defaults decide what the customer sees on arrival; one naming a step
     or a value that does not exist means the page opens in a state the engine
     never intended. */
  Object.keys(spec.defaults || {}).forEach(sid => {
    const ref = byId[sid];
    if (!ref) { errs.push(`${where}: defaults name step "${sid}", which does not exist`); return; }
    if ((ref.options || []).map(o => o.v).indexOf(spec.defaults[sid]) < 0) {
      errs.push(`${where}: default ${sid} = "${spec.defaults[sid]}" is not one of its options`);
    }
  });

  specs[spec.id] = spec;
});

if (errs.length) {
  console.error('build-builders: refusing to write.\n');
  errs.forEach(e => console.error('  ' + e));
  process.exit(1);
}

fs.writeFileSync(OUT,
  '/* GENERATED by tools/build-builders.js from data/builders/*.json.\n' +
  '   Do not edit — edit the JSON and re-run the tool. */\n' +
  'window.BUILDERS = ' + JSON.stringify(specs) + ';\n');

/* The top of the range, honestly. Summing the dearest option of every step
   overstates it badly — the truck carries a six-lug arm and an eight-lug arm
   and no customer can buy both, which is how that number came out at $28,800
   against a real ceiling nearer $9,000. So price only configurations that can
   actually exist: walk the tree the way the engine will, greedily taking the
   dearest visible option, and report the best a real build can reach. */
const LOGIC = require(path.join(ROOT, 'builder-logic.js'));

function ceiling(spec) {
  const v = LOGIC.complete(spec, {}, { gate: false, dearest: true });
  return LOGIC.total(spec, v);
}

Object.values(specs).forEach(s => {
  const layers = new Set();
  s.steps.forEach(st => (st.options || []).forEach(o => { if (o.layer) layers.add(o.layer); }));
  console.log(`  ${s.id}: ${s.steps.length} steps · ${layers.size} layers · ` +
              `base $${s.basePrice.toLocaleString()} · dearest real build $${ceiling(s).toLocaleString()}`);
});
console.log(`  wrote ${path.relative(ROOT, OUT)}`);

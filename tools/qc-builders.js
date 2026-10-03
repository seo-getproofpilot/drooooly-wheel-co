#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — drive every builder, every option, and check the render

   Chris: "go through and refine all of this and every section, all the way
   from the truck all the way down to the buggy and the sand car. Click through
   all the options, use all the options... I've already noticed some of them:
   the options are missing, or they're not there, or the wheel is halfway there
   and the other half of the wheel is nonexistent."

   "HALF THE WHEEL" IS THE SYMPTOM OF A LAYER THAT DOES NOT RESOLVE. The stage
   composites one transparent render per answered step — barrel, face, ring,
   caps, hardware. If one of those files 404s, paintLayers() drops it and the
   customer sees the rest of the wheel with a hole where that part should be.
   It fails silently by design: the alternative is leaving the PREVIOUS colour
   on screen, which would be a lie about what they picked.

   Clicking 2,951 options by hand is not QC, it is a weekend. This drives the
   same engine the page runs (builder-logic.js), selects every option of every
   step of every builder, and checks what the stage WOULD show:

     - every layer and swatch URL resolves to a real image, not an error page
     - no reachable state composites fewer layers than its builder's floor,
       which is what "half the wheel" looks like from the data side
     - every chips step a customer can reach has at least two options
     - no step is unreachable, and no required step can be left unanswerable
     - the price is a finite number in every state

   Usage:  node tools/qc-builders.js [--quick] [--only <builder-id>]
           --quick skips the network pass and checks structure only
   ============================================================ */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const L = require(path.join(ROOT, 'builder-logic.js'));
const SRCDIR = path.join(ROOT, 'data/builders');
const QUICK = process.argv.includes('--quick');
const ONLY = process.argv.indexOf('--only') > -1 ? process.argv[process.argv.indexOf('--only') + 1] : null;

const specs = fs.readdirSync(SRCDIR).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(SRCDIR, f), 'utf8')))
  .filter(s => !ONLY || s.id === ONLY)
  .sort((a, b) => (a.rank || 0) - (b.rank || 0));

const problems = [];
const urls = new Map();            // url -> [where it is used]

function note(spec, kind, msg) { problems.push({ id: spec.id, kind: kind, msg: msg }); }
function url(spec, file) { return /^https?:/.test(file) ? file : spec.layerBase + file; }

/* ---- 1. structure, and every state's layer stack --------------------- */
console.log('Driving every option of every builder\n');

specs.forEach(spec => {
  const defaults = spec.defaults || {};
  const base = L.visible(spec.steps, defaults);

  /* THE FLOOR IS WHAT THE STAGE DRAWS, not what the live answers draw.
     builder.js completes the render before stacking it — the customer's answers
     over the opening state, blanks filled from the first no-cost option — so
     the wheel is whole from the first paint. The first version of this check
     counted the LIVE plan and flagged every early state, which is a page that
     was working as designed.

     What is worth flagging is a state where the COMPLETED render still comes up
     short, because that means a part has no art at all. */
  const renderPlan = pick => {
    const live = L.visible(spec.steps, pick);
    const merged = Object.assign({}, defaults, live.pick);
    return L.layerPlan(spec, L.complete(spec, merged, { gate: false }));
  };
  /* Measured from the same completed render the page draws, so the number means
     "this is a whole wheel" rather than "this is what the live answers cover". */
  const floor = renderPlan(defaults).length;

  let states = 0, thinStates = [], emptySteps = [], noOptions = [];
  const seenSteps = new Set();

  spec.steps.forEach(step => {
    (step.options || []).forEach(o => {
      if (o.layer) urls.set(url(spec, o.layer), (urls.get(url(spec, o.layer)) || []).concat(spec.id + '/' + step.id + '/' + o.v));
      if (o.swatch) urls.set(url(spec, o.swatch), (urls.get(url(spec, o.swatch)) || []).concat(spec.id + '/' + step.id + '/' + o.v + ' (swatch)'));
    });
  });
  if (spec.baseLayer) urls.set(url(spec, spec.baseLayer), [spec.id + '/base']);

  /* Select each option in turn, on top of the opening state, exactly as a
     customer clicking down the page would. */
  spec.steps.forEach(step => {
    if (step.type === 'text') return;
    const opts = step.options || [];
    if (!opts.length) { noOptions.push(step.id); return; }
    if (step.type === 'chips' && opts.length < 2) noOptions.push(step.id + ' (only ' + opts.length + ')');

    opts.forEach(o => {
      const pick = Object.assign({}, defaults);
      pick[step.id] = o.v;
      const v = L.visible(spec.steps, pick);
      v.steps.forEach(s => seenSteps.add(s.id));

      /* The step we just answered must actually be ON the page in the state
         it produces — otherwise this option is unreachable from the defaults
         and the customer can never choose it. */
      const onPage = v.steps.some(s => s.id === step.id);
      if (!onPage) return;                       // reached via another branch; covered below

      const plan = renderPlan(pick);
      states++;
      if (plan.length < floor) {
        thinStates.push(`${step.id}="${o.v}" -> ${plan.length} layers (floor ${floor})`);
      }
      const t = L.total(spec, v);
      if (!isFinite(t) || t < spec.basePrice) {
        note(spec, 'price', `${step.id}="${o.v}" totals ${t}`);
      }
      v.steps.forEach(s => {
        if (s.type === 'chips' && !(s.options || []).length) emptySteps.push(s.id);
      });
    });
  });

  /* Deeper states: answer a whole build at random many times, so steps that
     only appear two or three choices in are exercised too. */
  let seed = 424242;
  const rnd = n => { seed ^= seed << 13; seed |= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed |= 0; return Math.abs(seed) % n; };
  for (let i = 0; i < 4000; i++) {
    let pick = {};
    for (let pass = 0; pass < 6; pass++) {
      const v = L.visible(spec.steps, pick);
      pick = v.pick;
      v.steps.forEach(s => {
        const o = s.options || [];
        if (o.length) pick[s.id] = o[rnd(o.length)].v;
      });
    }
    const v = L.visible(spec.steps, pick);
    v.steps.forEach(s => seenSteps.add(s.id));
    const plan = renderPlan(pick);
    states++;
    if (plan.length < floor) {
      const why = v.steps.filter(s => (s.type === 'chips' || s.type === 'fact') &&
        (L.optionOf(s, v.pick[s.id]) || {}).noRender).map(s => s.id + '=' + v.pick[s.id]);
      thinStates.push(`random build -> ${plan.length} layers (floor ${floor}); no layer on: ${why.join(', ') || '—'}`);
    }
  }

  const unreachable = spec.steps.filter(s => !seenSteps.has(s.id)).map(s => s.id);
  if (unreachable.length) note(spec, 'unreachable', unreachable.join(', '));
  if (noOptions.length) note(spec, 'thin step', [...new Set(noOptions)].join(', '));
  if (emptySteps.length) note(spec, 'empty step', [...new Set(emptySteps)].join(', '));
  [...new Set(thinStates)].slice(0, 6).forEach(t => note(spec, 'thin render', t));

  const layerCount = new Set();
  spec.steps.forEach(s => (s.options || []).forEach(o => { if (o.layer) layerCount.add(o.layer); }));
  console.log(`  ${spec.short.padEnd(18)} ${String(spec.steps.length).padStart(2)} steps · ` +
    `${String(states).padStart(5)} states driven · ${String(layerCount.size).padStart(3)} layers · ` +
    `floor ${floor}` +
    ([...new Set(thinStates)].length ? `  ⚠ ${[...new Set(thinStates)].length} thin` : ''));
});

/* ---- 2. does every image actually exist? ----------------------------- */
function head(u) {
  return new Promise(resolve => {
    const req = https.request(u, { method: 'GET', headers: { Range: 'bytes=0-511' } }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const sig = buf.slice(0, 16).toString('latin1');
        const isImg = (sig.startsWith('RIFF') && buf.slice(8, 12).toString('latin1') === 'WEBP') ||
                      sig.startsWith('\x89PNG') || sig.startsWith('\xff\xd8\xff');
        resolve({ u: u, status: res.statusCode, type: res.headers['content-type'] || '', isImg: isImg });
      });
    });
    req.on('error', e => resolve({ u: u, status: 0, type: '', isImg: false, err: String(e.message).slice(0, 40) }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ u: u, status: 0, type: '', isImg: false, err: 'timeout' }); });
    req.end();
  });
}

(async () => {
  if (QUICK) { report(); return; }
  const list = [...urls.keys()];
  console.log(`\nVerifying ${list.length} distinct images…`);
  const bad = [];
  const CONC = 24;
  let done = 0;
  for (let i = 0; i < list.length; i += CONC) {
    const batch = list.slice(i, i + CONC);
    const res = await Promise.all(batch.map(head));
    res.forEach(r => {
      done++;
      if (r.status !== 200 && r.status !== 206) bad.push(`${r.status || r.err} ${r.u}`);
      else if (!r.isImg) bad.push(`not an image (${r.type}) ${r.u}`);
    });
    if (done % 480 === 0 || done === list.length) process.stdout.write(`  ${done}/${list.length}\n`);
  }
  if (bad.length) {
    console.log(`\n  ${bad.length} BROKEN IMAGES — this is what "half the wheel" looks like:`);
    bad.slice(0, 25).forEach(b => {
      const where = (urls.get(b.replace(/^\S+ /, '')) || []).slice(0, 2).join(', ');
      console.log('    ' + b.slice(0, 110) + (where ? '\n        used by: ' + where : ''));
    });
    if (bad.length > 25) console.log(`    …and ${bad.length - 25} more`);
    problems.push({ id: '(all)', kind: 'broken image', msg: bad.length + ' of ' + list.length });
  } else {
    console.log(`  all ${list.length} resolve to real images`);
  }
  report();
})();

function report() {
  console.log('\n' + '─'.repeat(64));
  if (!problems.length) { console.log('  No problems found.'); process.exit(0); }
  const byId = {};
  problems.forEach(p => { (byId[p.id] = byId[p.id] || []).push(p); });
  Object.keys(byId).forEach(id => {
    console.log('\n  ' + id);
    byId[id].forEach(p => console.log(`    [${p.kind}] ${p.msg}`));
  });
  console.log(`\n  ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
  process.exit(1);
}

#!/usr/bin/env node
/* backfill-size-source.js — give JTX's sizes the provenance they earned.
 *
 * WHY THIS EXISTS. The dealer sheet counts a model as carrying the brand's own
 * published sizes only when it holds a `sizeSource`. On that count JTX scored
 * 0 of 154, and the sheet we would have emailed them said "none sourced from
 * you — every size shown is our own working assumption."
 *
 * That was false, and false in the direction that costs us. JTX's sizes were
 * read off jtxforged.com on 2026-09-07 by tools/scrape-jtx-sizes.js, which
 * refuses to write unless 80+ product pages agree. build-featured.js stamps
 * those onto the models — it just predates the `sizeSource` convention and
 * never recorded that it had.
 *
 * HOW IT DECIDES, rather than assuming. It recomputes, per model, exactly what
 * data/specs/jtx-sizes.json would produce, and stamps provenance ONLY where
 * that equals the sizes the model is carrying right now. A model whose sizes
 * have since drifted, or that JTX publish no page for, is left alone and
 * named in the output — those are genuinely unsourced and the sheet should go
 * on saying so.
 *
 *   node tools/backfill-size-source.js [--dry]
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const DRY = process.argv.includes("--dry");

const { serialize } = require("./lib/serialize-brands.js");

global.window = {};
require(path.join(ROOT, "brands.js"));
const BRANDS = global.window.BRANDS;

/* the same lookup build-featured.js uses — kept identical on purpose */
const pageSlug = (x) =>
  String(x).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function wanted(spec, m) {
  const mslug = pageSlug(m.model);
  const lookup = (role) =>
    (spec.models && spec.models[mslug] && spec.models[mslug][role]) ||
    (spec.roles && spec.roles[role]) || null;
  const cfg = m.configs || [];
  const roles = [];
  if (cfg.includes("single")) roles.push("single");
  if (cfg.includes("dually") || cfg.includes("super single"))
    roles.push("duallyFront", "superSingle");
  const out = new Set();
  roles.forEach((r) => {
    const tbl = lookup(r);
    if (!tbl) return;
    Object.keys(tbl).forEach((d) => tbl[d].forEach((w) => out.add(d + "x" + w)));
  });
  if (!out.size) return null;
  return [...out].sort((x, y) => {
    const [xd, xw] = x.split("x").map(Number), [yd, yw] = y.split("x").map(Number);
    return xd - yd || xw - yw;
  });
}

let stamped = 0, already = 0;
const noPage = [], drifted = [];

BRANDS.forEach((b) => {
  const file = path.join(ROOT, "data/specs", b.slug + "-sizes.json");
  if (!fs.existsSync(file)) return;
  const spec = JSON.parse(fs.readFileSync(file, "utf8"));

  (b.models || []).forEach((m) => {
    if (m.sizeSource) { already++; return; }
    const want = wanted(spec, m);
    if (!want) { noPage.push(m.model); return; }
    if (want.join() !== (m.sizes || []).join()) { drifted.push(m.model); return; }
    m.sizeSource = b.slug;
    stamped++;
  });

  console.log(b.name + ' — captured ' + spec.captured + ' by ' + spec.generator);
});

console.log('  stamped   ' + stamped + ' model(s) whose sizes match the scrape exactly');
if (already) console.log('  already   ' + already + ' had a sizeSource');
if (noPage.length) console.log('  no page   ' + noPage.length +
  ' model(s) the manufacturer publishes no size list for: ' +
  noPage.slice(0, 8).join(', ') + (noPage.length > 8 ? ', +' + (noPage.length - 8) + ' more' : ''));
if (drifted.length) console.log('  DRIFTED   ' + drifted.length +
  ' model(s) carry sizes the scrape does not produce — left unsourced: ' +
  drifted.slice(0, 8).join(', ') + (drifted.length > 8 ? ', +' + (drifted.length - 8) + ' more' : ''));

if (DRY) { console.log('\n--dry: brands.js not written'); process.exit(0); }
fs.writeFileSync(path.join(ROOT, 'brands.js'), serialize(BRANDS));
console.log('\nbrands.js written.');

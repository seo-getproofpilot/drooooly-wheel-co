#!/usr/bin/env node
/* tools/test-export-catalog.js
   Checks configurator/src/data/catalog.json, written by tools/export-catalog.js.
   Run the exporter first: node tools/export-catalog.js && node tools/test-export-catalog.js */
const path = require("path"), fs = require("fs");
const F = require(path.resolve(__dirname, "..", "fitment.js"));
const out = path.resolve(__dirname, "..", "configurator", "src", "data", "catalog.json");
const allowed = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "configurator", "allowed-brands.json"), "utf8"));
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log("  FAIL " + name + (extra ? "\n       " + extra : "")); } }
if (!fs.existsSync(out)) { console.log("  FAIL catalog.json missing: run node tools/export-catalog.js\n\n0 passed, 1 failed"); process.exit(1); }
const c = JSON.parse(fs.readFileSync(out, "utf8"));
ok("has vehicles", c.vehicles.length >= 2);
ok("f250 has model block", !!c.vehicles.find(v => v.id === "f250").model);
ok("f150 has model block", !!c.vehicles.find(v => v.id === "f150").model);
ok("allowed-brands is jtx only for the slice", JSON.stringify(allowed) === '["jtx"]', JSON.stringify(allowed));
ok("only allowed brands", c.brands.length > 0 && c.brands.every(b => allowed.includes(b.slug)), c.brands.map(b => b.slug).join(","));
let bad = [];
c.brands.forEach(b => b.models.forEach(m => m.sizes.forEach(s => { const p = F.parseSize(s); if (!p || !p.widthKnown) bad.push(b.slug + " " + m.model + " " + s); })));
ok("every wheel size has a known width", bad.length === 0, bad.slice(0, 5).join("; "));
ok("no wheel model left with zero sizes", c.brands.every(b => b.models.every(m => m.sizes.length > 0)));
let badT = [];
c.tires.forEach(b => b.models.forEach(m => m.sizes.forEach(s => { if (!F.parseTireSize(s)) badT.push(b.slug + " " + s); })));
ok("every tire size parses", badT.length === 0, badT.slice(0, 5).join("; "));
ok("paints", c.paints.length === 10);
ok("offsets roles", !!c.offsets.roles.duallyRear);
ok("finishes carried", !!c.finishes && Array.isArray(c.finishes.orderable));
ok("f450 dialled data carried", !!c.f450);

/* Review focus 1: a bare-diameter size ("20", widthKnown:false) must never
   reach the configurator as a buildable size. Run the exporter's filter over a
   synthetic model to prove it drops, rather than relying on today's catalog
   happening to have none. */
const { exportBrands } = require(path.resolve(__dirname, "export-catalog.js"));
const synth = exportBrands([{ slug: "jtx", name: "JTX", kind: "Forged", bolts: [], models: [
  { model: "Mixed", configs: ["single"], sizes: ["20", "22x12", "24"] },
  { model: "DiaOnly", configs: ["single"], sizes: ["20", "22"] }
] }, { slug: "fuel", name: "Fuel", kind: "Forged", bolts: [], models: [{ model: "X", configs: ["single"], sizes: ["20x10"] }] }], ["jtx"]);
ok("bare diameter dropped, sized kept", JSON.stringify(synth[0].models[0].sizes) === '["22x12"]', JSON.stringify(synth[0].models[0].sizes));
ok("model with only bare diameters dropped", !synth[0].models.find(m => m.model === "DiaOnly"));
ok("unlisted brand dropped", synth.length === 1 && synth[0].slug === "jtx");
ok("pricing defaults to null", synth[0].pricing === null);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

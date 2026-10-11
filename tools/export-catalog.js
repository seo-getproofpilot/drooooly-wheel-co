#!/usr/bin/env node
/* tools/export-catalog.js
   Loads the site's window.* data files in a sandbox and writes one JSON for
   the 3D configurator (configurator/src/data/catalog.json). No product
   knowledge lives in the configurator: it reads only what this writes.

   Brand gate: only slugs listed in configurator/allowed-brands.json are
   exported (CLAUDE.md rule 3, never show a brand we are not authorized to sell).
   Size gate: a wheel size with no published width ("20", widthKnown:false)
   cannot be rendered or built, so it is dropped here, and a model left with
   no sizes is dropped with it. Tire sizes that do not parse are dropped too.

   Run: node tools/export-catalog.js   (also runs as the configurator's prebuild) */
const vm = require("vm"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const F = require(path.join(ROOT, "fitment.js"));

function load(file) {
  const ctx = { window: {}, module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  return ctx.window;
}

function exportBrands(brands, allowed) {
  return brands.filter(x => allowed.includes(x.slug)).map(x => ({
    slug: x.slug, name: x.name, kind: x.kind, bolts: x.bolts || [], pricing: x.pricing || null,
    models: (x.models || []).map(m => ({ model: m.model, configs: m.configs || [], img: m.img || null,
      finishes: m.finishes || [],
      sizes: (m.sizes || []).filter(s => { const p = F.parseSize(s); return !!p && p.widthKnown; }) }))
      .filter(m => m.sizes.length)
  })).filter(b => b.models.length);
}

function exportTires(tires) {
  return tires.map(x => ({ slug: x.slug, name: x.name,
    models: (x.models || []).map(m => ({ model: m.model, tread: m.tread, img: m.img || null, priceFrom: m.priceFrom ?? null,
      sizes: (m.sizes || []).filter(s => !!F.parseTireSize(s)) }))
      .filter(m => m.sizes.length) }))
    .filter(b => b.models.length);
}

function main() {
  const allowed = JSON.parse(fs.readFileSync(path.join(ROOT, "configurator", "allowed-brands.json"), "utf8"));
  const v = load("vehicles.js"), b = load("brands.js"), t = load("tires.js"), fin = load("finishes.js");
  const json = f => JSON.parse(fs.readFileSync(path.join(ROOT, "data", "specs", f), "utf8"));
  const brands = exportBrands(b.BRANDS, allowed);
  const tires = exportTires(t.TIRES);
  const out = { generated: new Date().toISOString().slice(0, 10), vehicles: v.VEHICLES, paints: v.VEHICLE_PAINT,
    brands, tires, offsets: json("offsets.json"), f450: json("f450-fitment.json"), finishes: fin.WHEEL_FINISHES };
  const dest = path.join(ROOT, "configurator", "src", "data", "catalog.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 1) + "\n");
  console.log("catalog:", out.vehicles.length, "vehicles,", brands.length, "brands,",
    brands.reduce((n, x) => n + x.models.length, 0), "wheel models,", tires.length, "tire brands");
}

module.exports = { exportBrands, exportTires };
if (require.main === module) main();

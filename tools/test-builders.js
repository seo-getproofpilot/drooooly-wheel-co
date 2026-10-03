#!/usr/bin/env node
/* ============================================================
   Tests for builder-logic.js and the seven generated specs.
   Plain node, no dependencies.   node tools/test-builders.js

   THE TWO FIXTURES THAT MATTER are LIVE READINGS, not expectations. On
   2026-10-02 Price Designs' own builder was driven in a browser and the
   rendered step list recorded for two states. If a change to the hide rule
   makes either of these drift, our builder has stopped matching his — which
   is the whole promise of the page.

   They are checked with GATING OFF, because gating is ours and his page does
   not do it (he auto-selects the first lug pattern instead; see
   builder-logic.js). The gating tests below check our layer separately.
   ============================================================ */
const path = require("path");
const fs = require("fs");
const ROOT = path.resolve(__dirname, "..");
const L = require(path.join(ROOT, "builder-logic.js"));

const SPECS = {};
fs.readdirSync(path.join(ROOT, "data/builders")).filter(f => f.endsWith(".json")).forEach(f => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, "data/builders", f), "utf8"));
  SPECS[s.id] = s;
});

let pass = 0, fail = 0;
function ok(name, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) pass++;
  else { fail++; console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`); }
}
function truthy(name, v) { ok(name, !!v, true); }
function section(s) { console.log("\n" + s); }

const spec = id => SPECS[id];
const labels = (id, pick, opts) =>
  L.visible(spec(id).steps, pick, opts).steps.map(s => s.label);
const ids = (id, pick, opts) =>
  L.visible(spec(id).steps, pick, opts).steps.map(s => s.id);

/* ================================================================
   1. THE LIVE FIXTURES
   ================================================================ */
section("his live builder, 2026-10-02 — truck, FORD 6X135 (10 steps)");
{
  const t = spec("pd-truck-17x9");
  const pick = Object.assign({}, t.defaults, { "lug-pattern": "Ford 6x135" });
  ok("the tree he renders", labels("pd-truck-17x9", pick, { gate: false }), [
    "Select lug pattern",
    "Select model",
    "Turbine wheel finish",
    "Beadlock ring model",
    "Sawblade ring finish",
    "Floating center caps?",
    "Center cap hardware finish",
    "Ring hardware finish",
    "Lug nuts",
    "Notes"
  ]);
  const m = L.visible(t.steps, pick, { gate: false }).steps.filter(s => s.label === "Select model")[0];
  ok("six lug offers three models", m.options.map(o => o.v), ["Turbine", "Galaxy", "Nebula"]);
}

section("his live builder, 2026-10-02 — truck, GM 8X180 (16 steps)");
{
  const t = spec("pd-truck-17x9");
  const pick = Object.assign({}, t.defaults, { "lug-pattern": "GM 8x180" });
  ok("the tree he renders", labels("pd-truck-17x9", pick, { gate: false }), [
    "Select lug pattern",
    "Select model",
    "Turbine wheel finish",
    "Galaxy wheel finish",
    "Nova wheel finish",
    "Crown wheel finish",
    "Post-cut wheel?",
    "Post-cut wheel?",
    "Beadlock ring model",
    "Sawblade ring finish",
    "Post-cut center cap? 8",
    "Floating center caps?",
    "Center cap hardware finish",
    "Ring hardware finish",
    "Lug nuts",
    "Notes"
  ]);
  const m = L.visible(t.steps, pick, { gate: false }).steps.filter(s => s.label === "Select model")[0];
  ok("eight lug offers four models", m.options.map(o => o.v), ["Turbine", "Galaxy", "Nova", "Crown"]);
  ok("the eight-lug Turbine carries his +$200", m.options[0].add, 200);
}

/* ================================================================
   2. GATING — ours, not his
   ================================================================ */
section("gating: an undecided branch stays shut");
{
  const t = spec("pd-truck-17x9");
  /* With no lug pattern chosen, his raw rule shows BOTH arms at once. */
  const raw = labels("pd-truck-17x9", t.defaults, { gate: false });
  ok("his raw rule shows two SELECT MODEL", raw.filter(x => x === "Select model").length, 2);
  /* Five, not four: with no pattern chosen the six-lug Turbine arm and the
     whole eight-lug arm are both open, and TURBINE WHEEL FINISH appears twice
     under the same heading. Exactly the mess gating exists to prevent. */
  ok("...and five wheel finishes, two of them identical headings",
    raw.filter(x => /wheel finish$/.test(x)), [
      "Turbine wheel finish", "Turbine wheel finish",
      "Galaxy wheel finish", "Nova wheel finish", "Crown wheel finish"
    ]);

  const gated = labels("pd-truck-17x9", t.defaults);
  ok("gated shows neither until a pattern is picked",
    gated.filter(x => x === "Select model").length, 0);
  ok("...and no wheel finish", gated.filter(x => /wheel finish$/.test(x)).length, 0);
  ok("...but still asks for the pattern", gated[0], "Select lug pattern");

  const withLug = labels("pd-truck-17x9", Object.assign({}, t.defaults, { "lug-pattern": "GM 8x180" }));
  ok("one pattern -> exactly one SELECT MODEL",
    withLug.filter(x => x === "Select model").length, 1);
  ok("...and no finish until a model is picked",
    withLug.filter(x => /wheel finish$/.test(x)).length, 0);

  const withModel = labels("pd-truck-17x9",
    Object.assign({}, t.defaults, { "lug-pattern": "GM 8x180", "model-2": "Nova" }));
  ok("a model -> exactly its own finish",
    withModel.filter(x => /wheel finish$/.test(x)), ["Nova wheel finish"]);
}

/* ================================================================
   3. A HIDDEN STEP HOLDS NO ANSWER
   ================================================================ */
section("a hidden step holds no answer");
{
  const p = spec("pd-pro-r");
  const halo = { "beadlock-ring-style": "Halo", "halo-ring-finish": "Gloss black" };
  truthy("halo chosen -> halo finish is on the page",
    ids("pd-pro-r", halo, { gate: false }).indexOf("halo-ring-finish") > -1);

  const back = Object.assign({}, halo, { "beadlock-ring-style": "Sawblade" });
  const v = L.visible(p.steps, back, { gate: false });
  ok("switch back to sawblade -> halo finish is gone",
    v.steps.map(s => s.id).indexOf("halo-ring-finish"), -1);
  ok("...and its answer is cleared, not just hidden", v.pick["halo-ring-finish"], undefined);
  ok("...so its layer leaves the render",
    L.layerPlan(p, v).some(x => x.key === "halo-ring-finish"), false);

  /* And the answer survives in the caller's own pick, so going back restores it. */
  ok("the caller's pick is never mutated", back["halo-ring-finish"], "Gloss black");
  ok("...so flipping back restores the finish",
    L.visible(p.steps, back, { gate: false }) &&
    L.visible(p.steps, halo, { gate: false }).pick["halo-ring-finish"], "Gloss black");
}

/* ================================================================
   4. PRICING — his figures, arithmetic ours
   ================================================================ */
section("pricing");
{
  const t = spec("pd-truck-17x9");
  const build = Object.assign({}, t.defaults, {
    "lug-pattern": "Ford 8x170",
    "model-2": "Turbine",                     // +200 on the eight-lug arm
    "turbine-wheel-finish-2": "Triple chrome plating",  // +2400
    "beadlock-ring-model": "Sawblade",
    "sawblade-ring-finish": "Machined"        // +0
  });
  const v = L.visible(t.steps, build);
  ok("5400 base + 200 model + 2400 chrome", L.total(t, v), 8000);

  ok("base is his", t.basePrice, 5400);
  ok("sand car base is his", spec("pd-sand-car").basePrice, 4400);
  ok("UTV base is his", spec("pd-pro-r").basePrice, 3000);

  /* The ceiling the plan recorded by hand off his live builder. */
  const top = L.complete(t, {}, { gate: false, dearest: true });
  ok("dearest truck build he sells", L.total(t, top), 9500);
}

section("every price is a non-negative number");
{
  let bad = [];
  Object.values(SPECS).forEach(s => s.steps.forEach(st => (st.options || []).forEach(o => {
    if (o.add === undefined) return;
    if (typeof o.add !== "number" || !isFinite(o.add) || o.add < 0) bad.push(s.id + "/" + st.id + "/" + o.v);
  })));
  ok("no string or negative upcharges", bad, []);
}

/* ================================================================
   5. THE SPECS THEMSELVES
   ================================================================ */
section("spec integrity");
{
  ok("seven builders", Object.keys(SPECS).length, 7);

  let dupes = [], danglingStep = [], danglingVal = [], noBase = [], noCard = [];
  Object.values(SPECS).forEach(s => {
    const seen = {}, byId = {};
    s.steps.forEach(st => {
      if (seen[st.id]) dupes.push(s.id + "/" + st.id);
      seen[st.id] = 1; byId[st.id] = st;
    });
    s.steps.forEach(st => (st.hideWhen || []).forEach(r => {
      const g = byId[r.step];
      if (!g) { danglingStep.push(s.id + "/" + st.id + " -> " + r.step); return; }
      if (!(g.options || []).some(o => o.v === r.value)) {
        danglingVal.push(s.id + "/" + st.id + " -> " + r.step + "=" + r.value);
      }
    }));
    const hasLayer = s.steps.some(st => (st.options || []).some(o => o.layer));
    if (hasLayer && !s.layerBase) noBase.push(s.id);
    if (!s.card || !fs.existsSync(path.join(ROOT, s.card))) noCard.push(s.id);
  });
  ok("no duplicate step ids", dupes, []);
  ok("no rule names a missing step", danglingStep, []);
  ok("no rule names a missing value", danglingVal, []);
  ok("every layered spec has a layerBase", noBase, []);
  ok("every builder has a card image on disk", noCard, []);
}

section("every builder opens on a wheel, not a blank stage");
{
  const thin = [];
  Object.values(SPECS).forEach(s => {
    const v = L.visible(s.steps, s.defaults || {});
    const n = L.layerPlan(s, v).length;
    if (n < 3) thin.push(s.id + " (" + n + " layers)");
  });
  ok("at least three layers from the defaults", thin, []);
}

section("the truck keeps its fitment tie-in");
{
  const t = spec("pd-truck-17x9");
  const lug = t.steps.filter(st => (st.options || []).some(o => o.bolt))[0];
  truthy("a step carries bolt patterns", lug);
  ok("all five are mapped", lug.options.filter(o => o.bolt).length, 5);
  ok("GM 6x5.5 is 6x139.7", lug.options.filter(o => o.v === "GM 6x5.5")[0].bolt, "6x139.7");
  ok("RAM 8x6.5 is 8x165.1", lug.options.filter(o => o.v === "RAM 8x6.5")[0].bolt, "8x165.1");

  const VEH = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fitment/vehicle-bolt-patterns.json"), "utf8"));
  const known = new Set(VEH.patterns.map(r => r.bolt));
  ok("every pattern is one the finder can resolve",
    lug.options.filter(o => o.bolt && !known.has(o.bolt)).map(o => o.bolt), []);

  /* The UTVs ask no lug question, because the machine is drilled at the
     factory — they state it instead. */
  ["pd-pro-r", "pd-x3", "pd-rzr", "pd-sand-car", "pd-maverick-r", "pd-expedition"].forEach(id => {
    ok(id + " asks no lug question",
      spec(id).steps.some(st => (st.options || []).some(o => o.bolt)), false);
    truthy(id + " states its pattern", spec(id).bolt);
  });
}

section("a fact is answered for you");
{
  const r = spec("pd-rzr");
  const f = r.steps.filter(st => st.type === "fact")[0];
  truthy("the RZR model is a fact, not a one-button choice", f);
  ok("...with exactly one option", f.options.length, 1);
  const v = L.visible(r.steps, {});
  ok("...already in force with nothing picked", v.pick[f.id], f.options[0].v);
  ok("...and never counted as a question",
    L.visible(r.steps, {}).steps.filter(s => s.type === "chips").indexOf(f), -1);
}

/* ================================================================
   6. REACHABILITY — nothing shipped that cannot be seen
   ================================================================ */
section("every step can be reached, and every layer is referenced");
{
  const unreachable = [];
  Object.values(SPECS).forEach(s => {
    const seen = new Set();
    let seed = 7919;
    const rnd = n => {
      seed ^= seed << 13; seed |= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed |= 0;
      return Math.abs(seed) % n;
    };
    L.visible(s.steps, s.defaults || {}, { gate: false }).steps.forEach(x => seen.add(x.id));
    for (let i = 0; i < 3000; i++) {
      let pick = {};
      for (let p = 0; p < 6; p++) {
        const v = L.visible(s.steps, pick, { gate: false });
        pick = v.pick;
        v.steps.forEach(st => {
          const o = st.options || [];
          if (o.length) pick[st.id] = o[rnd(o.length)].v;
        });
      }
      L.visible(s.steps, pick, { gate: false }).steps.forEach(x => seen.add(x.id));
    }
    s.steps.forEach(st => { if (!seen.has(st.id)) unreachable.push(s.id + "/" + st.id); });
  });
  ok("no step is unreachable", unreachable, []);
}

section("layer and swatch filenames are usable");
{
  const bad = [];
  Object.values(SPECS).forEach(s => s.steps.forEach(st => (st.options || []).forEach(o => {
    [["layer", o.layer], ["swatch", o.swatch]].forEach(([k, f]) => {
      if (f === undefined) return;
      if (typeof f !== "string" || !f) { bad.push(`${s.id}/${st.id}/${o.v} ${k} empty`); return; }
      /* A bare filename is resolved against layerBase; anything else must be
         an absolute URL we can actually load. */
      if (!/^https?:/.test(f) && !/^[\w.@-]+\.(webp|png|jpg|jpeg)$/i.test(f)) {
        bad.push(`${s.id}/${st.id}/${o.v} ${k} = ${f}`);
      }
    });
  })));
  ok("no malformed art references", bad, []);
}

section("the patterns the truck builder deliberately does NOT cut");
{
  const lug = spec("pd-truck-17x9").steps.filter(st => (st.options || []).some(o => o.bolt))[0];
  const bolts = lug.options.map(o => o.bolt);
  ok("an F-250's 8x170 is offered", bolts.indexOf("8x170") > -1, true);
  /* Both of these resolve in the finder, so a customer CAN arrive holding one.
     builder.js has to say so rather than leave the step mysteriously blank —
     see its prefillLug() noFit branch. */
  ok("the F-450's ten-lug is not", bolts.indexOf("10x225"), -1);
  ok("a half-ton Ram's 5x139.7 is not", bolts.indexOf("5x139.7"), -1);
}

section("SIMULATED is a safety word, not a style word");
{
  /* A simulated beadlock ring is cosmetic — it does not clamp the tyre bead.
     He capitalises it himself and so must we, in every builder. */
  const quiet = Object.values(SPECS).filter(s => !/SIMULATED/.test(s.includes));
  ok("every builder keeps it in the included line", quiet.map(s => s.id), []);
}

section("the catalogue and the specs agree");
{
  global.window = global.window || {};
  require(path.join(ROOT, "brands.js"));
  const pd = (global.window.BRANDS || []).filter(b => b.slug === "price-designs")[0];
  truthy("Price Designs is in the catalogue", pd);

  const buildable = (pd.models || []).filter(m => m.builder);
  truthy("at least one model is marked buildable", buildable.length > 0);

  const bad = [], priceOff = [], qtyOff = [];
  buildable.forEach(m => {
    const s = SPECS[m.builder];
    if (!s) { bad.push(m.model + " -> " + m.builder); return; }
    if (m.priceSet !== s.basePrice) priceOff.push(`${m.model}: card ${m.priceSet} vs spec ${s.basePrice}`);
    if (m.priceSetQty !== s.setOf) qtyOff.push(`${m.model}: card ${m.priceSetQty} vs spec ${s.setOf}`);
  });
  ok("every builder link resolves to a spec", bad, []);
  ok("...quoting the same set price", priceOff, []);
  ok("...for the same number of wheels", qtyOff, []);
}

section("tools/build-featured.js round-trips the builder link");
{
  /* It rewrites brands.js wholesale from the parsed model objects. Any field
     its serialiser forgets is deleted on the next run — which is exactly what
     happened to `builder`, silently turning build-your-own products back into
     plain cards. Pin the serialiser against the fields the catalogue uses. */
  const src = fs.readFileSync(path.join(ROOT, "tools/build-featured.js"), "utf8");
  const missing = ["builder", "priceSet", "priceSetQty", "bolts", "img", "feat"]
    .filter(f => !new RegExp("m\\." + f).test(src));
  ok("no catalogue field is dropped on rewrite", missing, []);
}

/* ================================================================ */
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

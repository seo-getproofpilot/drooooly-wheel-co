#!/usr/bin/env node
/* Tests for fitment.js — plain node, no dependencies.
   node tools/test-fitment.js                                             */
const path = require("path");
const F = require(path.resolve(__dirname, "..", "fitment.js"));

let pass = 0, fail = 0;
function ok(name, got, want, tol) {
  const good = tol === undefined ? got === want : Math.abs(got - want) <= tol;
  if (good) { pass++; }
  else { fail++; console.log(`  FAIL ${name}\n       got ${got}, want ${want}${tol ? ` ±${tol}` : ""}`); }
}
function section(s) { console.log("\n" + s); }

/* ---- size parsing ---- */
section("sizes");
ok("24x14 diameter", F.parseSize("24x14").d, 24);
ok("24x14 width", F.parseSize("24x14").w, 14);
ok("24x8.25 dually width", F.parseSize("24x8.25").w, 8.25);
ok("bare 20 has no width", F.parseSize("20").w, null);
ok("bare 20 flags unknown", F.parseSize("20").widthKnown, false);
ok("17x8.5 width", F.parseSize("17x8.5").w, 8.5);

const jtxAce = { sizes: ["22x12", "22x8.25", "24x14", "24x8.25", "26x16", "26x8.25", "28x8.25"] };
ok("Ace diameters", F.diametersFor(jtxAce).join(","), "22,24,26,28");
ok("Ace widths @22", F.widthsFor(jtxAce, 22).join(","), "8.25,12");
ok("Ace widths @28 (dually only)", F.widthsFor(jtxAce, 28).join(","), "8.25");
ok("bare-diameter brand yields no widths", F.widthsFor({ sizes: ["20", "22"] }, 20).length, 0);

/* ---- tires ---- */
section("tires");
ok("35x12.50R20 OD", F.parseTireSize("35x12.50R20LT").od, 35.0, 0.001);
ok("285/70R17 OD", F.parseTireSize("285/70R17").od, 32.71, 0.01);
ok("LT275/60R20 OD", F.parseTireSize("LT275/60R20").od, 33.0, 0.02);
ok("37x13.50R20 section", F.parseTireSize("37x13.50R20LT").section, 13.5, 0.001);

/* ---- geometry ---- */
section("geometry");
const F250 = { fenderRadiusIn: 20.5, faceToFenderIn: 9.2, config: "srw", measured: false };
const g1 = F.geometry({ widthIn: 14, offsetMm: -76, tireOdIn: 35, wheelDiaIn: 24, lift: 0, vehicle: F250 });
// backspacing = 14/2 + (-76/25.4) + 0.5 = 7 - 2.992 + 0.5
ok("24x14 ET-76 backspacing", g1.backspacing, 4.508, 0.01);
ok("24x14 ET-76 outer from face", g1.outerFromFace, 9.992, 0.01);
ok("24x14 ET-76 poke", g1.poke, 0.792, 0.01);
ok("35 on 24 sidewall", g1.sidewall, 5.5, 0.001);

// negative offset must push the wheel OUT — the core visual claim
const sweep = [25, 0, -25, -76, -127, -152].map(function (o) {
  return F.geometry({ widthIn: 14, offsetMm: o, tireOdIn: 35, wheelDiaIn: 24, lift: 0, vehicle: F250 }).poke;
});
let monotonic = true;
for (let i = 1; i < sweep.length; i++) if (sweep[i] <= sweep[i - 1]) monotonic = false;
ok("poke increases as offset goes negative", monotonic, true);
ok("ET+25 is tucked", sweep[0] < 0, true);
ok("ET-152 is poked", sweep[5] > 0, true);

// lift raises the arch, not the wheel
const lifted = F.geometry({ widthIn: 14, offsetMm: -76, tireOdIn: 35, wheelDiaIn: 24, lift: 4, vehicle: F250 });
ok("lift raises fender radius", lifted.fenderRadius, 24.5, 0.001);
ok("lift does not change poke", lifted.poke, g1.poke, 0.001);

/* ---- placement (the wheel-render mounting maths) ---- */
section("placement");
// face centred at 0.5/0.5 with r = 0.25 of width, on a 680x680 image,
// mounted at (100, 200) with a 50px target radius => scale 50/170
const p = F.placement([0.5, 0.5, 0.25], { w: 680, h: 680 }, 100, 200, 50);
ok("placement scale", p.scale, 50 / 170, 0.0001);
ok("placement centres face on x", p.x + 0.5 * 680 * p.scale, 100, 0.001);
ok("placement centres face on y", p.y + 0.5 * 680 * p.scale, 200, 0.001);
// off-centre face must still land on target — this is the bug the face map fixes
const p2 = F.placement([0.62, 0.48, 0.30], { w: 680, h: 550 }, 300, 150, 90);
ok("off-centre face still centres x", p2.x + 0.62 * 680 * p2.scale, 300, 0.001);
ok("off-centre face still centres y", p2.y + 0.48 * 550 * p2.scale, 150, 0.001);

/* ---- language guard ----
   CLAUDE.md rule 1: never promise fitment. This tool shows a LOOK, not a
   clearance outcome, so no string it can emit may imply one.               */
section("language");
const BANNED = /guarantee|will fit|fits perfectly|bolt right up|approved|rub|clearance|safe to/i;
const strings = [];
[-152, -127, -76, -25, 0, 25].forEach(function (o) {
  [true, false].forEach(function (measured) {
    const g = F.geometry({ widthIn: 14, offsetMm: o, tireOdIn: 35, wheelDiaIn: 24, lift: 0, vehicle: F250 });
    strings.push(F.stance(g).label, F.pokeText(g, measured));
  });
});
const offenders = strings.filter(function (s) { return BANNED.test(s); });
ok("no clearance-claim language in any emitted string", offenders.length, 0);
if (offenders.length) console.log("       offenders:", offenders);

/* The guard above only sees what fitment.js emits. Most of the copy a customer
   actually reads lives in the page scripts — the spec block, the offset
   explainer, the cut-to-order line, the build-lane headers. Those were outside
   the guard.

   This scans the whole comment-stripped source rather than trying to pick out
   string literals. The literal-extracting version this replaces looked healthy
   (766 literals found) while being silently WRONG: six trailing `//` comments
   contain apostrophes ("can't", "you're"), each opened a bogus single-quoted
   string that swallowed everything to the next apostrophe, and the scan walked
   out of alignment and skipped whole regions — including, when tested, an
   injected violation. A count is not a proof of coverage.

   Scanning everything can in principle flag an identifier (a variable called
   `approved`). That is the right failure mode: loud and visible, rather than a
   guard that quietly checks nothing. */
["wheel.js", "catalog.js", "builds.js", "script.js"].forEach(function (file) {
  const raw = require("fs").readFileSync(path.resolve(__dirname, "..", file), "utf8");
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, " ")          // block comments
    /* Line comments anywhere, not just at line start. The (^|[^:]) guard keeps
       "https://" intact. */
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const hits = [];
  src.split("\n").forEach(function (ln, i) {
    const m = ln.match(BANNED);
    if (m) hits.push(file + ":" + (i + 1) + " [" + m[0] + "] " + ln.trim().slice(0, 70));
  });
  ok("no clearance-claim language in " + file, hits.length, 0);
  if (hits.length) hits.slice(0, 5).forEach(function (h) { console.log("       " + h); });
  // Comment-stripping must not have eaten the file.
  ok(file + " survived comment-stripping", src.length > raw.length * 0.5, true);
});

/* ---- shipped vehicle data ----
   The formula being right is worth nothing if the numbers behind it are wrong:
   a factory truck on its factory wheel must read as roughly flush, not as
   "well inside the fender". This is the check that caught faceToFenderIn
   being off by five inches.                                              */
section("vehicle data");
try {
  global.window = global.window || {};
  require(path.resolve(__dirname, "..", "vehicles.js"));
  const vs = global.window.VEHICLES || [];
  ok("vehicle library is populated", vs.length >= 9, true);
  const wrong = vs.filter(function (v) {
    // Use the truck's real factory rim width where we have it. The F-450 runs a
    // 19.5x6 ET+136, so assuming 8.25 for every dually made it look wrong when
    // the data was in fact right.
    const stockWidth = v.stockWidthIn || (v.config === "drw" ? 8.25 : (v.hd ? 8 : 8.5));
    const g = F.geometry({ widthIn: stockWidth, offsetMm: v.stockOffsetMm,
      tireOdIn: 33, wheelDiaIn: 18, lift: 0, vehicle: v });
    return g.poke > 0.5 || g.poke < -1.6;      // factory = flush to slightly tucked
  }).map(function (v) { return v.id; });
  ok("every truck reads near flush on its factory wheel", wrong.length, 0);
  if (wrong.length) console.log("       offenders:", wrong.join(", "));

  // the homepage finder hands off by name; a dually must not land on the
  // single-rear truck of the same number
  const M = global.window.matchVehicle;
  ok("RAM 3500 DRW resolves to the dually", (M(2023, "RAM", "3500 DRW") || {}).id, "ram3500drw");
  ok("RAM 3500 resolves to the single-rear", (M(2023, "RAM", "3500") || {}).id, "ram2500");
  ok("Silverado 3500HD DRW resolves to the dually", (M(2023, "Chevrolet", "Silverado 3500HD DRW") || {}).id, "gm3500drw");
  ok("F-450 resolves", (M(2023, "Ford", "F-450 Super Duty") || {}).id, "f450");

  // and a wide aggressive wheel must read as poked on every one of them
  const notPoked = vs.filter(function (v) {
    const g = F.geometry({ widthIn: 14, offsetMm: -76, tireOdIn: 35, wheelDiaIn: 24, lift: 0, vehicle: v });
    return g.poke <= 0.75;
  }).map(function (v) { return v.id; });
  ok("24x14 ET-76 reads as poked on every platform", notPoked.length, 0);
  if (notPoked.length) console.log("       offenders:", notPoked.join(", "));
} catch (e) {
  console.log("  (vehicles.js not loadable: " + e.message + ")");
}

/* ---- spec-driven options ----
   The whole point of the specs layer: a customer must never be offered a size,
   width or offset that nobody builds. These assert the picker can only ever
   emit real combinations.                                                   */
section("specs");
try {
  global.window = global.window || {};
  require(path.resolve(__dirname, "..", "wheel-specs.js"));
  const SP = global.window.WHEEL_SPECS;
  const JTX = SP.wheels.jtx, F450 = SP.vehicles.f450;

  ok("five JTX dually models", JTX.models.length, 5);
  ok("rears are always 8.25", JTX.rearWidth, 8.25);
  ok("JTX publishes no offset", JTX.offsetPublished, false);

  // Every diameter must carry a standard width, and every super-single width
  // must be wider than the rear — otherwise it isn't a wide front.
  const badStd = JTX.diameters.filter(function (d) {
    const w = JTX.front.standard[String(d)];
    return !w || w.length !== 1 || w[0] !== JTX.rearWidth;
  });
  ok("every diameter offers the matched 8.25 front", badStd.length, 0);

  const badWide = [];
  Object.keys(JTX.front.superSingle).forEach(function (d) {
    JTX.front.superSingle[d].forEach(function (w) {
      if (w <= JTX.rearWidth) badWide.push(d + "x" + w);
      if (JTX.diameters.indexOf(+d) < 0) badWide.push("orphan diameter " + d);
    });
  });
  ok("every wide-front width is wider than the rear", badWide.length, 0);
  if (badWide.length) console.log("       offenders:", badWide.join(", "));

  // 30" is dually-only in JTX's list — it must not offer a 10" front.
  ok("30\" offers only a 16\" wide front", JTX.front.superSingle["30"].join(","), "16");

  // Offsets shown must sit inside the researched range for this truck, and the
  // range itself must bracket sanely below the factory figure.
  const o = F450.rear.offsetMm;
  ok("rear offset range is ordered", o.min < o.typical && o.typical < o.max, true);
  ok("rear offsets sit below the factory figure", o.max < F450.oem.offsetMm, true);
  ok("front super-single offset is left unknown, not invented",
     F450.frontSuperSingle.offsetMm, null);

  // Every rendered finish must name art that exists on disk.
  const fsx = require("fs");
  const missingArt = [];
  JTX.models.forEach(function (m) {
    JTX.finishes.filter(function (f) { return f.rendered; }).forEach(function (f) {
      ["front", "rear", "supersingle"].forEach(function (pos) {
        const rel = JTX.artPattern.replace("{model}", m.slug)
          .replace("{position}", pos).replace("{finish}", f.code);
        if (!fsx.existsSync(path.resolve(__dirname, "..", rel))) missingArt.push(rel);
      });
    });
  });
  ok("every rendered finish has art on disk", missingArt.length, 0);
  if (missingArt.length) console.log("       missing:", missingArt.slice(0, 5).join(", "));
} catch (e) {
  console.log("  (wheel-specs.js not built yet — run tools/build-specs.js: " + e.message + ")");
}

/* ---- tires must be real ---- */
section("tires we actually carry");
try {
  global.window = global.window || {};
  require(path.resolve(__dirname, "..", "tires.js"));
  const T = global.window.TIRES || [];
  ok("tire catalog loaded", T.length > 0, true);

  // A dual pair can't run a 14.50; a wide front is the only home for those.
  const dual26 = F.tiresFor(T, 26, "dual");
  const wrongWidth = dual26.filter(function (t) { return t.section > F.DUAL_MAX_SECTION; });
  ok("no over-wide tire offered for a dual pair", wrongWidth.length, 0);
  ok("26\" dual pair has a real option", dual26.length > 0, true);
  ok("26\" dual option is the one the builds run",
     dual26.map(function (t) { return t.size; }).join(","), "37x13.50R26");

  // Diameter must match exactly — a 24" tire must never appear under 26".
  const mismatched = [22, 24, 26].some(function (d) {
    return F.tiresFor(T, d, "dual").concat(F.tiresFor(T, d, "wide"))
      .some(function (t) { return Math.abs(t.rim - d) > 0.01; });
  });
  ok("every offered tire matches the chosen diameter", mismatched, false);

  // Sizes we don't stock must come back empty rather than approximated.
  ok("a diameter we carry nothing in returns nothing", F.tiresFor(T, 30, "dual").length, 0);
} catch (e) {
  console.log("  (tires.js not loadable: " + e.message + ")");
}

/* ---- series filtering ----
   The Single Series page must not advertise 8.25", which is the dually width.
   The guard matters more than the filter: 42 models carry configs including
   "single" but publish ONLY 8.25 widths, and filtering them strictly would
   blank their size table. */
section("series filtering");
try {
  global.window = global.window || {};
  require(path.resolve(__dirname, "..", "brands.js"));
  const BR = global.window.BRANDS;
  const pick = (slug, name) => BR.find((b) => b.slug === slug).models.find((m) => m.model === name);
  const rows = (m, k) => F.sizeRowsFor(m, k).map((r) => r.dia + ":" + r.widths.join("/")).join(" ");

  const cf = pick("jtx", "Centerfire");
  const cfSingle = F.sizeRowsFor(cf, "single");
  /* These assert JTX's PUBLISHED list, scraped from their product pages. The
     previous expectation here ("22:12 24:14 26:16") was three sizes that nobody
     ever published — it came from a hardcoded fallback in build-featured.js and
     this test was locking it in. */
  ok("Centerfire single spans all six published diameters",
     cfSingle.map((r) => r.dia).join("/"), "20/22/24/26/28/30");
  ok("Centerfire single never advertises the dually width",
     cfSingle.some((r) => r.widths.indexOf(8.25) > -1), false);
  ok("Centerfire single carries the 22x11 JTX actually build",
     cfSingle.find((r) => r.dia === 22).widths.join("/"), "10/11/12/14");
  ok("Centerfire dually still shows the rear width",
     F.sizeRowsFor(cf, "dually").some((r) => r.widths.indexOf(8.25) > -1), true);
  ok("no series context shows everything", rows(cf, null), rows(cf, "dually"));

  /* The scrape found JTX vary the dually front list style to style — 60 pages
     start at 22", eight at 24", and Widow at 26". Collapsing that back to one
     line-wide list would be the same invention in a new place. */
  const widow = pick("jtx", "Widow");
  ok("per-model dually variation survives — Widow has no 22\" or 24\" rear",
     (widow.sizes || []).filter((x) => /x8\.25$/.test(x)).join(","),
     "26x8.25,28x8.25,30x8.25");

  const INVENTED = ["22x12,24x14,26x16,28x16,30x16", "22x12,24x14,26x16"];
  const stale = BR.find((b) => b.slug === "jtx").models
    .filter((m) => INVENTED.indexOf((m.sizes || []).join(",")) > -1);
  ok("no JTX model still carries an invented size list", stale.length, 0);
  if (stale.length) console.log("       offenders:", stale.slice(0, 5).map((m) => m.model).join(", "));

  // dually-only style asked for as a single: the guard must fire
  const combat = pick("jtx", "Combat");
  ok("dually-only style still lists sizes when asked as single",
     F.sizeRowsFor(combat, "single").length > 0, true);

  // the 42-model case — configs say single, widths say dually
  const kryptik = BR.find((b) => b.slug === "american-force").models
    .find((m) => m.model === "DC08 Kryptik DC");
  ok("misclassified single still lists sizes",
     F.sizeRowsFor(kryptik, "single").length > 0, true);

  /* Sweep every model: no series may ever empty a size table. This is the
     check that would have caught the 42 before they shipped. */
  const emptied = [];
  BR.forEach((b) => b.models.forEach((m) => {
    ["single", "dually", null].forEach((k) => {
      if (F.sizeRowsFor(m, k).length === 0 && (m.sizes || []).length) {
        emptied.push(b.slug + "/" + m.model + " @" + k);
      }
    });
  }));
  ok("no model empties its size table under any series", emptied.length, 0);
  if (emptied.length) console.log("       offenders:", emptied.slice(0, 5).join(", "));

  /* NO MODEL MAY LIST A BARE DIAMETER. "22" is not a size — it says nothing
     about whether the wheel clears the calipers or fills the fender. Fenix,
     TIS and Vision between them had 99 of them across 38 models until
     tools/scrape-wheel-sizes.js replaced the lot with the manufacturers' own
     published matrices. This pins that; tools/qc-catalog.js fails on it too. */
  const bareModels = [];
  BR.forEach((b) => b.models.forEach((m) => {
    const bare = (m.sizes || []).filter((x) => !/x/.test(String(x)));
    if (bare.length) bareModels.push(b.slug + "/" + m.model + " [" + bare.join(",") + "]");
  }));
  ok("no model lists a bare diameter", bareModels.length, 0);
  if (bareModels.length) console.log("       offenders:", bareModels.slice(0, 5).join(", "));

  /* The engine's tolerance for one is still tested, against a SYNTHETIC model
     rather than a real listing. fitment.js keeps the widthKnown:false path
     because a brand may yet publish diameters only, and a path with no data
     exercising it is a path that rots. */
  const synthetic = { model: "(synthetic)", configs: ["single"], sizes: ["20", "22"], finishes: [] };
  const br = F.sizeRowsFor(synthetic, "single");
  ok("bare-diameter model keeps every diameter", br.length, F.sizeRowsFor(synthetic, null).length);
  ok("bare-diameter model reports no known width", br.every((r) => !r.widthKnown), true);
} catch (e) {
  console.log("  (brands.js not loadable: " + e.message + ")");
}

/* ---- offset lookup ----
   A lookup, never a calculation. Anything unknown must come back null so the
   UI can say "not published" instead of printing a plausible number. */
section("offsets");
try {
  const OFF = JSON.parse(require("fs").readFileSync(
    path.resolve(__dirname, "..", "data", "specs", "offsets.json"), "utf8"));

  ok("14\" single resolves", F.offsetFor(OFF, "single", 24, 14).typical, -76);
  ok("12\" single resolves", F.offsetFor(OFF, "single", 22, 12).typical, -44);
  ok("bySize beats widths for 24x12", F.offsetFor(OFF, "single", 24, 12).typical, -51);
  ok("16\" single resolves", F.offsetFor(OFF, "single", 26, 16).typical, -101);
  ok("10\" is an explicit gap, not a guess", F.offsetFor(OFF, "single", 22, 10), null);
  // JTX build 22x11; nobody publishes an ET for it. Declared, not omitted.
  ok("11\" is a declared gap, not a missing key", F.offsetFor(OFF, "single", 22, 11), null);
  ok("dually rear resolves", F.offsetFor(OFF, "duallyRear", 24, 8.25).typical, 120);
  ok("wide front has no published figure", F.offsetFor(OFF, "superSingle", 26, 16), null);
  ok("unknown role returns null", F.offsetFor(OFF, "nonsense", 24, 14), null);

  ok("8.25 routes to the dually bucket", F.offsetRole(8.25, "single"), "duallyRear");
  ok("wide width on a dually page routes to super single", F.offsetRole(14, "dually"), "superSingle");
  ok("wide width on a single page routes to single", F.offsetRole(14, "single"), "single");

  /* Every stated figure must carry a source — the generator enforces this too,
     but assert it here so a bad edit fails the suite as well as the build. */
  const unsourced = [];
  Object.keys(OFF.roles).forEach((role) => {
    [OFF.roles[role].widths, OFF.roles[role].bySize].forEach((bucket) => {
      Object.keys(bucket || {}).forEach((k) => {
        const e = bucket[k];
        const stated = ["typical", "min", "max"].some((f) => typeof e[f] === "number");
        if (stated && !e.source) unsourced.push(role + "." + k);
      });
    });
  });
  ok("no offset figure without a source", unsourced.length, 0);
  if (unsourced.length) console.log("       offenders:", unsourced.join(", "));
} catch (e) {
  console.log("  (offsets.json not loadable: " + e.message + ")");
}

/* ---- bolt patterns ----
   These are the entries that send someone the wrong wheels if they drift,
   so they are asserted by value rather than by "a pattern came back". */
section("bolt patterns");
const BT = require(path.resolve(__dirname, "..", "data/fitment/vehicle-bolt-patterns.json"));
const bp = (y, mk, md) => { const r = F.boltPattern({ year: y, make: mk, model: md }, BT); return r ? r.bolt : null; };

ok("Super Duty is 8x170, not the GM 8x180", bp(2020, "Ford", "F-250 Super Duty"), "8x170");
ok("Super Duty back in 2001", bp(2001, "Ford", "F-350 Super Duty"), "8x170");
ok("GM HD before the 2011 change", bp(2010, "Chevrolet", "Silverado 2500HD"), "8x165.1");
ok("GM HD after the 2011 change", bp(2011, "Chevrolet", "Silverado 2500HD"), "8x180");
ok("GMC follows Chevrolet", bp(2020, "GMC", "Sierra 3500HD"), "8x180");
ok("Ram HD is its own eight-lug", bp(2020, "RAM", "2500"), "8x165.1");
ok("three different eight-lugs stay different",
   new Set([bp(2020, "Ford", "F-250 Super Duty"), bp(2020, "Chevrolet", "Silverado 2500HD"), bp(2020, "RAM", "2500")]).size, 3);

ok("Ram 1500 DT is six lug", bp(2020, "RAM", "1500"), "6x139.7");
ok("Ram 1500 Classic the same year is five", bp(2020, "RAM", "1500 Classic"), "5x139.7");
ok("Ram 1500 before the DT", bp(2015, "RAM", "1500"), "5x139.7");
ok("Dodge resolves to RAM", bp(2008, "Dodge", "2500"), "8x165.1");

ok("F-450 pickup is a ten-lug", bp(2020, "Ford", "F-450 Super Duty"), "10x225");
ok("F-350 DRW is still 8x170", bp(2020, "Ford", "F-350 Super Duty DRW"), "8x170");
ok("3500 DRW does not collapse onto 3500",
   F.boltPattern({ year: 2020, make: "RAM", model: "3500 DRW" }, BT).config, "drw");
ok("3500 stays single-rear",
   F.boltPattern({ year: 2020, make: "RAM", model: "3500" }, BT).config, "srw");

ok("Tundra five-lug years", bp(2015, "Toyota", "Tundra"), "5x150");
ok("Tundra six-lug before them", bp(2005, "Toyota", "Tundra"), "6x139.7");
ok("Tundra six-lug after them", bp(2023, "Toyota", "Tundra"), "6x139.7");
ok("Titan XD is eight, Titan is six",
   bp(2020, "Nissan", "Titan XD") + "/" + bp(2020, "Nissan", "Titan"), "8x180/6x139.7");

ok("RZR is 4x156", bp(2022, "Polaris", "RZR"), "4x156");
ok("Maverick X3 is 4x137", bp(2022, "Can-Am", "Maverick X3"), "4x137");
ok("a year outside every range is a miss, not a guess", bp(1998, "Ford", "F-250 Super Duty"), null);
ok("an unknown make is a miss", bp(2020, "Scania", "R500"), null);

ok("lanes map from config", F.laneForConfig("drw") + "/" + F.laneForConfig("utv") + "/" + F.laneForConfig("srw"),
   "dually/utv/truck");
ok("makes list is populated", F.boltMakes(BT).length > 10, true);
ok("a 2006 truck is a Dodge Ram", bp(2006, "Dodge", "Ram 2500"), "8x165.1");
ok("the same truck in 2020 is a RAM", bp(2020, "RAM", "2500"), "8x165.1");
ok("RAM did not exist in 2006", bp(2006, "RAM", "2500"), null);
ok("Dodge Ram did not exist in 2020", bp(2020, "Dodge", "Ram 2500"), null);
ok("the Dakota stayed a Dodge", bp(2008, "Dodge", "Dakota"), "6x114.3");
ok("2006 offers Dodge and not RAM",
   F.boltMakes(2006, BT).indexOf("Dodge") > -1 && F.boltMakes(2006, BT).indexOf("RAM") < 0, true);
ok("2020 offers RAM and not Dodge",
   F.boltMakes(2020, BT).indexOf("RAM") > -1 && F.boltMakes(2020, BT).indexOf("Dodge") < 0, true);
ok("2006 has no side-by-side group", F.boltMakeGroups(2006, BT).length, 1);
ok("2020 groups trucks and side-by-sides", F.boltMakeGroups(2020, BT).length, 2);
ok("Honda is in both groups, since it builds a Ridgeline and a Talon",
   F.boltMakeGroups(2020, BT).filter(g => g.makes.indexOf("Honda") > -1).length, 2);
ok("no make is lost by grouping",
   F.boltMakeGroups(2020, BT).reduce((a2, g) => a2.concat(g.makes), []).filter((v2, i2, a2) => a2.indexOf(v2) === i2).sort().join(","),
   F.boltMakes(2020, BT).sort().join(","));
ok("models narrow by year", F.boltModels("Toyota", 2015, BT).indexOf("Tundra") > -1, true);
ok("every entry declares its confidence",
   BT.patterns.filter(r => r.confidence !== "high" && r.confidence !== "check").length, 0);

/* ---- wheel side: can this wheel be had in that pattern ---- */
section("wheel bolt matching");
const DT = require(path.resolve(__dirname, "..", "data/fitment/brand-drilling.json"));
{
  global.window = global.window || {};
  require(path.resolve(__dirname, "..", "brands.js"));
  const BR = global.window.BRANDS || [];
  const bySlug = s2 => BR.find(b => b.slug === s2);

  const jtxAny = bySlug("jtx").models[0];
  ok("made-to-order brand takes a pattern it cuts",
     F.wheelBolt("jtx", jtxAny, "8x170", DT).match, true);
  ok("...and its basis is made-to-order, not listed",
     F.wheelBolt("jtx", jtxAny, "8x170", DT).basis, "made-to-order");
  ok("made-to-order brand REFUSES a pattern it does not cut",
     F.wheelBolt("jtx", jtxAny, "10x225", DT).match, false);
  ok("the F-450 ten-lug is not offered by everyone",
     F.wheelBolt("kg1", bySlug("kg1").models[0], "10x225", DT).match, false);

  const m401 = bySlug("method").models.find(m => /401 UTV Beadlock/.test(m.model));
  ok("a listed model matches a pattern it lists", F.wheelBolt("method", m401, "4x156", DT).match, true);
  ok("a listed model refuses one it does not", F.wheelBolt("method", m401, "4x137", DT).match, false);
  ok("listed beats the brand policy", F.wheelBolt("method", m401, "4x156", DT).basis, "listed");

  /* "We don't know this wheel's bolt pattern" is the case that must never
     quietly become "yes it fits". It used to be tested through
     bySlug("fuel").models[0], which was an unlisted model at the time —
     until tools/scrape-wheel-sizes.js read Fuel's own table and gave Ascend
     a real 5x127 / 6x135 / 6x139.7, at which point the assertion was
     testing the LISTED path under the name of the unknown one.

     685 of 778 models still carry no bolt list, so the case is real; it is
     exercised here through a model with none rather than through whichever
     model happens to sort first. */
  /* Sweep the whole catalogue for the "unknown" verdict rather than naming a
     model that happens to produce it today. Both the brand policy and the
     per-model bolt list move under us — this assertion broke the moment
     tools/scrape-wheel-sizes.js gave Fuel's Ascend a real 5x127 / 6x135 /
     6x139.7 and it started answering "listed" under the name of the unknown
     case. The INVARIANT is what matters: wherever we do not know, the wheel
     is still shown and the basis still says we do not know. */
  const unknowns = [];
  BR.forEach(b => (b.models || []).forEach(m => {
    const r = F.wheelBolt(b.slug, m, "8x170", DT);
    if (r.basis === "unknown") unknowns.push([b.slug, m, r]);
  }));
  ok("the catalogue still has wheels whose pattern we cannot vouch for", unknowns.length > 0, true);
  ok("every one of them is SHOWN, never hidden", unknowns.filter(u => u[2].match !== true).length, 0);

  /* And the brands we DID read a table for now answer from it. */
  const ascend = bySlug("fuel").models.find(m => m.model === "Ascend");
  ok("a scraped model answers from its own listed patterns",
     F.wheelBolt("fuel", ascend, "6x135", DT).basis, "listed");
  ok("...and refuses one Fuel do not cut it in",
     F.wheelBolt("fuel", ascend, "8x170", DT).match, false);

  /* The split must never fold "we would have to ask" into "we can stand
     behind this" — that is the whole liability line. */
  const sd = F.splitByBolt(BR, "8x170", "truck", DT);
  ok("the two buckets stay separate", sd.sure.length > 0 && sd.confirm.length > 0, true);
  ok("nothing we stand behind has an unknown basis",
     sd.sure.filter(r => r.basis === "unknown").length, 0);
  ok("everything we would ask about is marked unknown",
     sd.confirm.filter(r => r.basis !== "unknown").length, 0);
  ok("every row we stand behind carries a label a human can read",
     sd.sure.filter(r => !r.label).length, 0);

  /* Lanes have to actually narrow, or the category cards are fake doors. */
  const truck = F.splitByBolt(BR, "8x170", "truck", DT);
  const dually = F.splitByBolt(BR, "8x170", "dually", DT);
  ok("the dually lane is smaller than the truck lane", dually.sure.length < truck.sure.length, true);
  ok("the dually lane only contains dually-capable models",
     dually.sure.filter(r => !(r.model.configs || []).some(c => c === "dually" || c === "super single")).length, 0);
  ok("the utv lane only contains utv models",
     F.splitByBolt(BR, "4x156", "utv", DT).sure.filter(r => (r.model.configs || []).indexOf("utv") < 0).length, 0);
  /* The UTV lane used to be 100% exact because Method and Raceline were the
     only brands in it and both publish per-model patterns. Price Designs
     sells through a configurator, so its Sand Car entry has no published
     pattern and correctly lands in "confirm". The assertion that still
     matters is that every brand which DOES publish patterns stays exact. */
  {
    const rzr = F.splitByBolt(BR, "4x156", "utv", DT);
    ok("every listed-pattern brand answers a RZR exactly",
       rzr.confirm.filter(r => r.brand.slug === "method" || r.brand.slug === "raceline").length, 0);
    ok("a RZR still gets a real list to stand behind", rzr.sure.length > 10, true);
    ok("anything we would ask about is a brand that publishes no patterns",
       rzr.confirm.filter(r => (r.model.bolts || []).length > 0).length, 0);
  }

  /* Patterns that nobody cuts must come back empty rather than showing
     everything — an empty result is an honest answer. */
  ok("a pattern no brand offers returns nothing to stand behind",
     F.splitByBolt(BR, "5x205", "truck", DT).sure.length, 0);

  ok("sand patterns are published for the picker", F.sandPatterns(DT).length >= 4, true);
  ok("every sand pattern has a reason attached",
     F.sandPatterns(DT).filter(p2 => !p2.note).length, 0);
}

/* vehicles.js and the bolt table describe the same trucks and must agree —
   they were out of step on two platforms, which is what prompted this. */
section("vehicles.js agrees with the bolt table");
{
  global.window = global.window || {};
  require(path.resolve(__dirname, "..", "vehicles.js"));
  const mismatches = [];
  (global.window.VEHICLES || []).forEach(v => {
    v.models.forEach(m => {
      const r = F.boltPattern({ year: v.years[1], make: v.make, model: m }, BT);
      if (r && r.bolt !== v.bolt) mismatches.push(`${v.make} ${m} ${v.years[1]}: vehicles.js ${v.bolt} vs table ${r.bolt}`);
    });
  });
  ok("no platform disagrees about its own bolt pattern", mismatches.length, 0);
  if (mismatches.length) mismatches.forEach(x => console.log("       " + x));
}

/* ---- the wheel builder ----
   Moved to tools/test-builders.js. The builder specs are now GENERATED from
   Price Designs' own configurator for all seven platforms, with his hide
   rules and his layer art, so they are tested against two live readings of
   his page rather than against a hand-written ten-step file. Run both:
       node tools/test-fitment.js && node tools/test-builders.js
   The bolt-pattern half of the tie-in is still checked there too.
   ---------------------------------------------------------------- */

/* ---- catalogue integrity ----
   Every one of these is a bug that actually shipped. */
section("catalogue integrity");
{
  const fs = require("fs");
  global.window = global.window || {};
  require(path.resolve(__dirname, "..", "brands.js"));
  const BR = global.window.BRANDS || [];
  const models = BR.flatMap(b => (b.models || []).map(m => ({ b: b, m: m })));

  /* Every image path that IS set must resolve. A 404 here is a blank tile. */
  const missingFile = models.filter(x => x.m.img && !fs.existsSync(path.resolve(__dirname, "..", x.m.img.split("?")[0])));
  ok("no model points at an image that is not on disk", missingFile.length, 0);
  if (missingFile.length) missingFile.slice(0, 5).forEach(x => console.log("       " + x.b.slug + " / " + x.m.model + " -> " + x.m.img));

  /* A photo filed under another brand's folder is almost always a name
     collision, not a shared render — matching on filename alone offered an
     American Force "Dynamo" a Fuel photo and an Amani "Empire" a JTX one.
     Both would have put a competitor's wheel on the page. */
  const BRAND_DIRS = fs.readdirSync(path.resolve(__dirname, "..", "assets/wheels"), { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
  const crossBrand = models.filter(x => {
    if (!x.m.img) return false;
    const parts = x.m.img.split("/");
    const dir = parts.length > 2 ? parts[2] : "";
    return BRAND_DIRS.indexOf(dir) > -1 && dir !== x.b.slug &&
           !(x.b.slug === "american-force" && dir === "american-force");
  });
  ok("no wheel is illustrated with another brand's photo", crossBrand.length, 0);
  if (crossBrand.length) crossBrand.slice(0, 5).forEach(x => console.log("       " + x.b.slug + " / " + x.m.model + " -> " + x.m.img));

  /* Diameter filing. A model built in 20 AND 26 has to answer to both
     filters; it used to answer only to the larger. */
  const bucketOf = d => d >= 26 ? "26" : d >= 24 ? "24" : d >= 22 ? "22" : d >= 16 ? "20" : "15";
  const bucketsFor = m => [...new Set((m.sizes || []).map(sz => bucketOf(parseFloat(sz) || 0)))];
  const multi = models.filter(x => bucketsFor(x.m).length > 1);
  ok("most of the catalogue spans more than one diameter bucket", multi.length > 400, true);
  const ace = models.find(x => x.b.slug === "jtx" && x.m.model === "Ace");
  ok("a 20-through-30 wheel is filed under 20 as well as 26",
     bucketsFor(ace.m).sort().join(","), "20,22,24,26");
  const twentyTwo = models.filter(x => bucketsFor(x.m).indexOf("22") > -1).length;
  ok("the 22-inch bucket holds hundreds, not dozens", twentyTwo > 600, true);

  /* Every model must be reachable: the shop card links by exact model name. */
  const unreachable = models.filter(x => {
    const url = "wheel.html?brand=" + encodeURIComponent(x.b.slug) + "&model=" + encodeURIComponent(x.m.model);
    const got = new URLSearchParams(url.split("?")[1]);
    const b2 = BR.find(z => z.slug === got.get("brand"));
    return !b2 || !(b2.models || []).some(z => z.model === got.get("model"));
  });
  ok("every wheel's own link resolves back to it", unreachable.length, 0);

  /* Duplicate names inside one brand would make two wheels share a page. */
  const dupes = [];
  BR.forEach(b => {
    const seen = {};
    (b.models || []).forEach(m => { if (seen[m.model]) dupes.push(b.slug + " / " + m.model); seen[m.model] = 1; });
  });
  ok("no two wheels in a brand share a name", dupes.length, 0);
  if (dupes.length) dupes.slice(0, 5).forEach(x => console.log("       " + x));
}

/* ---- face map sanity (if built) ---- */
section("face map");
try {
  global.window = {};
  require(path.resolve(__dirname, "..", "wheel-faces.js"));
  const faces = global.window.WHEEL_FACES || {};
  const keys = Object.keys(faces);
  ok("face map is populated", keys.length > 300, true);
  const bad = keys.filter(function (k) {
    const f = faces[k];
    return !(f && f.length === 3 && f[2] > 0.15 && f[2] < 0.8 && f[0] > 0.2 && f[0] < 0.9);
  });
  ok("every face radius/centre is plausible", bad.length, 0);
  if (bad.length) console.log("       first offenders:", bad.slice(0, 5));
} catch (e) {
  console.log("  (wheel-faces.js not built yet — run tools/build-facemap.js)");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

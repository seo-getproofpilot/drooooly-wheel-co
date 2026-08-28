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
    const stockWidth = v.config === "drw" ? 8.25 : (v.hd ? 8 : 8.5);
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

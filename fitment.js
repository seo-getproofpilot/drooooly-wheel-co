/* ============================================================
   DROOOLY — fitment geometry
   CLAUDE.md: "Fitment logic lives in one module, testable independently of UI."
   This file is that module. It has ZERO DOM references and is loaded both by
   the browser and by tools/test-fitment.js under node.

   SCOPE: this computes where a wheel SITS — how far it stands proud of or
   tucks inside the fender line, and how to place its render in an arch. That
   is the whole point of the visualizer: the same wheel looks like a different
   product tucked vs poked.

   It deliberately does NOT model steering lock, rubbing, trimming or load.
   Those are a conversation, not a computation, and nothing here should ever
   read as a clearance approval.
   ============================================================ */
(function () {
  var MM_PER_IN = 25.4;
  var LIP = 0.5;              // mounting-pad allowance, inches

  /* ---- sizes -------------------------------------------------------- */

  // "24x14" -> {d:24, w:14, widthKnown:true}
  // "20"    -> {d:20, w:null, widthKnown:false}   (vision / tis / fenix)
  function parseSize(str) {
    var s = String(str).trim();
    var m = s.match(/^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)$/);
    if (m) return { d: parseFloat(m[1]), w: parseFloat(m[2]), widthKnown: true };
    var d = parseFloat(s);
    return isNaN(d) ? null : { d: d, w: null, widthKnown: false };
  }

  // Distinct, sorted sizes for a catalog model.
  function sizesFor(model) {
    var out = [], seen = {};
    (model && model.sizes || []).forEach(function (s) {
      var p = parseSize(s);
      if (!p) return;
      var key = p.d + "x" + (p.w === null ? "?" : p.w);
      if (seen[key]) return;
      seen[key] = 1;
      p.label = p.widthKnown ? (p.d + "x" + p.w) : String(p.d);
      out.push(p);
    });
    out.sort(function (a, b) { return a.d - b.d || (a.w || 0) - (b.w || 0); });
    return out;
  }

  function diametersFor(model) {
    var seen = {}, out = [];
    sizesFor(model).forEach(function (s) { if (!seen[s.d]) { seen[s.d] = 1; out.push(s.d); } });
    return out;
  }

  // Widths offered at a given diameter. Empty array = brand publishes by
  // diameter only, which the UI must surface rather than hide.
  function widthsFor(model, dia) {
    var out = [];
    sizesFor(model).forEach(function (s) {
      if (s.d === dia && s.widthKnown && out.indexOf(s.w) < 0) out.push(s.w);
    });
    return out.sort(function (a, b) { return a - b; });
  }

  /* The dually rear width, matched EXACTLY. Not a threshold — single-config
     models legitimately publish 8", 8.5", 9" and 9.5" street sizes, so any
     "narrow means dually" rule would eat them. 8.25 is the only width in this
     catalog that is unambiguously a dually rear, and it is the documented
     rearWidth in data/specs/jtx-dually.json. */
  var DUALLY_REAR_WIDTH = 8.25;

  /* Which sizes belong on the page you are actually looking at.

     A single-rear truck cannot use an 8.25 — that is the dually width — so
     showing it on a Single Series page offers a fitment the visitor can't buy.
     Dually and "no series context" both show everything.

     THE GUARD MATTERS: 42 models across kg1, fittipaldi, tis, american-force,
     amani and axe carry configs including "single" but publish ONLY 8.25
     widths. They are misclassified dually wheels. Filtering them strictly
     would blank their size table entirely, so an empty result falls back to
     the full list — a slightly wrong row beats a missing one. */
  function visibleSizes(model, seriesKey) {
    var all = sizesFor(model);
    if (seriesKey !== "single") return all;
    var keep = all.filter(function (s) {
      // widthKnown:false means we don't know the width, NOT that it is 8.25
      return !s.widthKnown || s.w !== DUALLY_REAR_WIDTH;
    });
    return keep.length ? keep : all;
  }

  /* Group visible sizes into one row per diameter. A diameter whose widths all
     filter out disappears rather than rendering an empty row — Centerfire's
     only 28" size is 28x8.25, so on a single page there is no 28". */
  function sizeRowsFor(model, seriesKey) {
    var rows = [], byDia = {};
    visibleSizes(model, seriesKey).forEach(function (s) {
      if (!byDia[s.d]) { byDia[s.d] = { dia: s.d, widths: [], widthKnown: false }; rows.push(byDia[s.d]); }
      if (s.widthKnown) { byDia[s.d].widths.push(s.w); byDia[s.d].widthKnown = true; }
    });
    rows.sort(function (a, b) { return a.dia - b.dia; });
    rows.forEach(function (r) { r.widths.sort(function (a, b) { return a - b; }); });
    return rows;
  }

  /* ---- offsets -------------------------------------------------------
     A lookup, not a calculation. Returns the recorded entry or null — never a
     derived or interpolated number, because "we don't know" is a real answer
     and inventing one is the failure mode this whole file exists to avoid. */
  function offsetFor(offsets, role, dia, width) {
    var r = offsets && offsets.roles && offsets.roles[role];
    if (!r) return null;
    var exact = r.bySize && r.bySize[String(dia) + "x" + String(width)];
    if (exact && typeof exact.typical === "number") return exact;
    var byW = r.widths && r.widths[String(width)];
    if (byW && (typeof byW.typical === "number" || typeof byW.min === "number")) return byW;
    return null;
  }

  /* Which offset bucket a given width sits in on a given page. */
  function offsetRole(width, seriesKey) {
    if (width === DUALLY_REAR_WIDTH) return "duallyRear";
    return seriesKey === "dually" ? "superSingle" : "single";
  }

  /* ---- tires -------------------------------------------------------- */

  // Flotation "35x12.50R20LT" -> od 35. Metric "285/70R17" -> od 32.71.
  function parseTireSize(str) {
    var s = String(str).trim();
    var f = s.match(/^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*R\s*(\d+(?:\.\d+)?)/i);
    if (f) return { od: parseFloat(f[1]), section: parseFloat(f[2]), rim: parseFloat(f[3]) };
    var m = s.match(/^(?:LT|P)?\s*(\d+)\s*\/\s*(\d+)\s*R\s*(\d+(?:\.\d+)?)/i);
    if (m) {
      var secMm = parseFloat(m[1]), ratio = parseFloat(m[2]), rim = parseFloat(m[3]);
      var sidewall = secMm * (ratio / 100) / MM_PER_IN;
      return { od: rim + 2 * sidewall, section: secMm / MM_PER_IN, rim: rim };
    }
    return null;
  }

  /* A tire only belongs on this truck if we actually sell it in that size AND
     it physically suits the position. On a dually the rear pair is the
     constraint: two 12.50s on 8.25" wheels is the standard dually package, and
     anything wider is a wide-front-only size. Deriving the list from the real
     tire catalog means the picker can never offer a size that doesn't exist —
     which is the whole point of doing this from specs.

     The cap is 13.50, not 12.50: dually retailers list 8.25" wheels as fitting
     "up to 13.50 tire", and 37x13.50R26 is exactly what the 26" JTX builds
     run. Capping at 12.50 wrongly emptied the flagship size.

     tires: window.TIRES  |  mode: "dual" (narrow pair) or "wide" (wide front) */
  var DUAL_MAX_SECTION = 13.5;      // inches, section width

  function tireDualCapable(p) {
    return !!p && p.section <= DUAL_MAX_SECTION + 0.01;
  }

  function tiresFor(tires, diaIn, mode) {
    var seen = {}, out = [];
    (tires || []).forEach(function (b) {
      (b.models || []).forEach(function (m) {
        (m.sizes || []).forEach(function (s) {
          var p = parseTireSize(s);
          if (!p || Math.abs(p.rim - diaIn) > 0.01) return;
          if (mode === "dual" && !tireDualCapable(p)) return;
          if (mode === "wide" && tireDualCapable(p)) return;
          var rec = seen[s];
          if (!rec) {
            rec = seen[s] = { size: s, od: p.od, section: p.section, rim: p.rim, fitments: [] };
            out.push(rec);
          }
          rec.fitments.push(b.name + " " + m.model);
        });
      });
    });
    out.sort(function (a, b) { return a.od - b.od || a.section - b.section; });
    return out;
  }

  /* ---- geometry ------------------------------------------------------ */

  /* cfg: { widthIn, offsetMm, tireOdIn, wheelDiaIn, lift, vehicle }
     vehicle: { fenderRadiusIn, faceToFenderIn, config:'srw'|'drw', measured }

     Sign convention: offset is the distance from the wheel's centreline to its
     mounting face. NEGATIVE offset moves the wheel OUTBOARD — which is the
     whole aggressive-stance look.                                          */
  function geometry(cfg) {
    var w = cfg.widthIn, offIn = cfg.offsetMm / MM_PER_IN;
    var outerFromFace = w / 2 - offIn;   // hub face -> outer lip
    var innerFromFace = w / 2 + offIn;   // hub face -> inner lip
    var v = cfg.vehicle || {};
    var fenderRadius = (v.fenderRadiusIn || 20) + (cfg.lift || 0);
    var poke = outerFromFace - (v.faceToFenderIn || 9);

    return {
      offsetIn: offIn,
      outerFromFace: outerFromFace,
      innerFromFace: innerFromFace,
      backspacing: innerFromFace + LIP,
      poke: poke,                                   // + proud of fender, - tucked
      sidewall: (cfg.tireOdIn - cfg.wheelDiaIn) / 2,
      fenderRadius: fenderRadius,
      archGap: fenderRadius - cfg.tireOdIn / 2,      // drawing input, not a verdict
      isDually: (v.config === "drw")
    };
  }

  /* Stance descriptor. Neutral language only — this names a LOOK, never a
     fitment outcome. Anything resembling "will fit" / "will rub" is out of
     scope by design and is asserted against in tools/test-fitment.js. */
  function stance(g) {
    var p = g.poke;
    if (p > 2.5)  return { key: "deep",    label: "Deep poke" };
    if (p > 0.75) return { key: "poke",    label: "Poked past the fender" };
    if (p > -0.5) return { key: "flush",   label: "About flush with the fender" };
    if (p > -2)   return { key: "tucked",  label: "Tucked inside the fender" };
    return { key: "deeptuck", label: "Well inside the fender" };
  }

  /* How far past (or inside) the fender, phrased as a plain measurement.
     `measured` gates the decimal: until someone has actually put a tape on
     that truck, the vehicle numbers are estimates and printing 1.8" would be
     inventing precision. */
  function pokeText(g, measured) {
    var p = g.poke, a = Math.abs(p).toFixed(1);
    if (!measured) {
      if (p > 0.75) return "Sits noticeably past the fender line";
      if (p > -0.5) return "Sits about even with the fender line";
      return "Sits inside the fender line";
    }
    if (p > 0.25)  return a + '" past the fender';
    if (p < -0.25) return a + '" inside the fender';
    return "Even with the fender";
  }

  /* ---- placing the render -------------------------------------------- */

  /* The wheel PNG's face is not its bounding box — the barrel hangs left and
     padding varies per brand — so wheel-faces.js carries a per-image
     [cx, cy, r] normalised to the image. Scale by the RADIUS, then offset by
     the face centre, so the barrel lands where it belongs instead of being
     clipped away.

     face: [cx, cy, r] normalised  |  img: {w, h} natural px
     Returns SVG <image> attrs that put the face centre exactly on (targetX, targetY). */
  function placement(face, img, targetX, targetY, targetRadiusPx) {
    if (!face || !img || !img.w) return null;
    var faceRpx = face[2] * img.w;
    if (!faceRpx) return null;
    var scale = targetRadiusPx / faceRpx;
    return {
      x: targetX - face[0] * img.w * scale,
      y: targetY - face[1] * img.h * scale,
      width: img.w * scale,
      height: img.h * scale,
      scale: scale
    };
  }

  var API = {
    MM_PER_IN: MM_PER_IN,
    parseSize: parseSize,
    sizesFor: sizesFor,
    diametersFor: diametersFor,
    widthsFor: widthsFor,
    parseTireSize: parseTireSize,
    DUALLY_REAR_WIDTH: DUALLY_REAR_WIDTH,
    visibleSizes: visibleSizes,
    sizeRowsFor: sizeRowsFor,
    offsetFor: offsetFor,
    offsetRole: offsetRole,
    tireDualCapable: tireDualCapable,
    tiresFor: tiresFor,
    DUAL_MAX_SECTION: DUAL_MAX_SECTION,
    geometry: geometry,
    stance: stance,
    pokeText: pokeText,
    placement: placement
  };

  if (typeof window !== "undefined") window.Fitment = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();

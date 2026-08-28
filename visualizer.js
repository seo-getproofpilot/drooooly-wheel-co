/* ============================================================
   DROOOLY — wheel preview visualizer (DOM/SVG only)

   SCOPE, deliberately narrow: one truck (F-450 Super Duty DRW) and one wheel
   program (JTX Forged Dually Series). Everything offered here is a real,
   published option — see data/specs/*.json. Nothing is a free-form slider,
   because a slider invites a customer to build a setup that nobody makes.

   Custom sizes and offsets are a real part of the business, but they are an
   ORDERING conversation, not a rendering: we say so rather than draw them.

   Geometry comes from window.Fitment. This file draws.
   ============================================================ */
(function () {
  var root = document.getElementById("viz");
  if (!root || !window.Fitment || !window.WHEEL_SPECS) return;

  var F = window.Fitment;
  var SPEC = window.WHEEL_SPECS;
  var JTX = SPEC.wheels.jtx;
  var FIT = SPEC.vehicles.f450;
  var PAINT = window.VEHICLE_PAINT || [];
  var VEHICLE = (window.VEHICLES || []).filter(function (v) { return v.id === "f450"; })[0];
  if (!VEHICLE) return;

  /* The JTX renders are cropped to the wheel and dead square — measured aspect
     1.000 — so the face circle is simply the image. No face map needed for
     this art set, unlike the mixed-padding catalog photos. */
  var FACE = [0.5, 0.5, 0.5];

  /* The photo plate: a real truck picture with calibrated wheel anchors. This
     is the view customers actually want — the wheel on a truck, not a diagram.
     Only anchors marked usable are drawn; an oblique wheel gets left alone
     rather than having a head-on render pasted into an ellipse. */
  var PLATE = (SPEC.plates || []).filter(function (p) { return p.vehicle === "f450"; })[0] || null;
  var RENDERED = JTX.finishes.filter(function (f) { return f.rendered; });
  var QUOTE_ONLY = JTX.finishes.filter(function (f) { return !f.rendered; });

  var OFFSETS = (function () {
    var o = FIT.rear.offsetMm;
    return [
      { mm: o.min, sub: "widest" },
      { mm: o.typical, sub: "most common" },
      { mm: o.max, sub: "most tucked" }
    ];
  })();

  var S = {
    model: JTX.models[0],
    finish: RENDERED[0],
    dia: 26,
    frontMode: "standard",       // "standard" (matched 8.25) | "wide"
    frontWidth: null,
    offset: FIT.rear.offsetMm.typical,
    tire: null,
    axle: "rear",                // which end the stage is showing
    paint: PAINT[1] || PAINT[0],
    lift: 0,
    imgDims: {}
  };

  var $ = function (s) { return root.querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function el(t, a, h) {
    var n = document.createElement(t);
    if (a) Object.keys(a).forEach(function (k) { n.setAttribute(k, a[k]); });
    if (h !== undefined) n.innerHTML = h;
    return n;
  }
  function chips(host, items, isOn, onPick, cls) {
    host.innerHTML = "";
    items.forEach(function (it) {
      var b = el("button", { class: "vchip" + (isOn(it) ? " on" : "") + (cls ? " " + cls : ""),
        type: "button" }, it.html !== undefined ? it.html : esc(it.label));
      b.onclick = function () { onPick(it); };
      host.appendChild(b);
    });
  }

  /* ---- what art exists for the current selection ---- */
  function artPath(position, finish) {
    return JTX.artPattern
      .replace("{model}", S.model.slug)
      .replace("{position}", position)
      .replace("{finish}", (finish || S.finish).code);
  }
  // On this truck the rear is always a dual pair of 8.25s; the front is either
  // a matched 8.25 or one wide wheel, which is a different casting entirely.
  function positionFor(axle) {
    if (axle === "rear") return "rear";
    return S.frontMode === "wide" ? "supersingle" : "front";
  }
  function widthFor(axle) {
    if (axle === "rear") return JTX.rearWidth;
    return S.frontMode === "wide" ? S.frontWidth : JTX.rearWidth;
  }

  function preload(path, done) {
    if (S.imgDims[path] !== undefined) return done();
    var im = new Image();
    im.onload = function () { S.imgDims[path] = { w: im.naturalWidth, h: im.naturalHeight }; done(); };
    im.onerror = function () { S.imgDims[path] = null; done(); };
    im.src = path;
  }

  /* ---- controls ---- */
  function buildControls() {
    $("#vTruck").textContent = VEHICLE.make + " " + VEHICLE.models[0];
    $("#vTruckSub").textContent = FIT.detail + " · " + FIT.bolt + " · " +
      FIT.hubBoreMm + "mm bore · factory " + FIT.oem.wheel + " ET+" + FIT.oem.offsetMm;

    var ps = $("#vPaint");
    PAINT.forEach(function (p) {
      var b = el("button", { class: "vsw" + (p === S.paint ? " on" : ""), type: "button",
        title: p.name, "aria-label": p.name });
      b.style.background = p.hex;
      b.onclick = function () {
        S.paint = p;
        ps.querySelectorAll(".vsw").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on"); render();
      };
      ps.appendChild(b);
    });

    var ms = $("#vModel");
    JTX.models.forEach(function (m, i) { ms.appendChild(el("option", { value: i }, esc(m.name))); });
    ms.onchange = function () { S.model = JTX.models[+this.value]; sync(); };

    root.querySelectorAll(".vaxle").forEach(function (t) {
      t.onclick = function () {
        S.axle = t.dataset.axle;
        root.querySelectorAll(".vaxle").forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on");
        sync();
      };
    });

    root.querySelectorAll(".vtab").forEach(function (t) {
      t.onclick = function () {
        root.querySelectorAll(".vtab").forEach(function (x) { x.classList.remove("on"); });
        root.querySelectorAll(".vview").forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on");
        root.querySelector("#vv-" + t.dataset.v).classList.add("on");
        render();
      };
    });

    $("#vLift").oninput = function () { S.lift = +this.value; render(); };
    $("#vQuoteOnly").textContent = QUOTE_ONLY.map(function (f) { return f.name; }).join(" and ");
  }

  /* Rebuild every dependent control from the spec. Anything not published is
     absent, not greyed out and not guessed. */
  function sync() {
    chips($("#vFinish"), RENDERED.map(function (f) { return { label: f.name, f: f }; }),
      function (it) { return it.f === S.finish; },
      function (it) { S.finish = it.f; sync(); });

    chips($("#vDia"), JTX.diameters.map(function (d) { return { label: d + '"', d: d }; }),
      function (it) { return it.d === S.dia; },
      function (it) { S.dia = it.d; S.frontWidth = null; S.tire = null; sync(); });

    var wide = JTX.front.superSingle[String(S.dia)] || [];
    chips($("#vFrontMode"), [
      { label: 'Matched 8.25"', mode: "standard" },
      { label: "Wide front", mode: "wide", off: !wide.length }
    ].filter(function (o) { return !o.off; }),
      function (it) { return it.mode === S.frontMode; },
      function (it) { S.frontMode = it.mode; S.frontWidth = null; sync(); });

    var fw = $("#vFrontWidth"), fwWrap = $("#vFrontWidthWrap");
    if (S.frontMode === "wide" && wide.length) {
      fwWrap.style.display = "";
      if (wide.indexOf(S.frontWidth) < 0) S.frontWidth = wide[wide.length - 1];
      chips(fw, wide.map(function (w) { return { label: w + '"', w: w }; }),
        function (it) { return it.w === S.frontWidth; },
        function (it) { S.frontWidth = it.w; sync(); });
    } else {
      fwWrap.style.display = "none";
      S.frontWidth = null;
    }

    chips($("#vOffset"), OFFSETS.map(function (o) {
      return { html: "ET+" + o.mm + "<i>" + esc(o.sub) + "</i>", mm: o.mm };
    }), function (it) { return it.mm === S.offset; },
      function (it) { S.offset = it.mm; sync(); }, "vchip--stack");

    // tires we actually carry in this diameter, for this position
    var mode = (S.axle === "front" && S.frontMode === "wide") ? "wide" : "dual";
    var list = F.tiresFor(window.TIRES || [], S.dia, mode);
    var ts = $("#vTire"), note = $("#vTireNote");
    ts.innerHTML = "";
    if (list.length) {
      note.style.display = "none";
      ts.disabled = false;
      if (!S.tire || !list.some(function (t) { return t.size === S.tire.size; })) S.tire = list[0];
      list.forEach(function (t) {
        ts.appendChild(el("option", { value: t.size },
          esc(t.size + "  ·  " + t.od.toFixed(1) + '" tall')));
      });
      ts.value = S.tire.size;
      ts.onchange = function () {
        var v = this.value;
        S.tire = list.filter(function (t) { return t.size === v; })[0];
        render();
      };
      $("#vTireWho").textContent = S.tire.fitments.slice(0, 3).join(" · ") +
        (S.tire.fitments.length > 3 ? " and " + (S.tire.fitments.length - 3) + " more" : "");
    } else {
      /* A real gap in what we stock, said plainly rather than papered over. */
      note.style.display = "";
      note.textContent = "We don't currently list a " + S.dia + '" tire that suits ' +
        (mode === "dual" ? "a dual pair" : "a wide front") + ". Ask us and we'll source one.";
      ts.disabled = true;
      S.tire = null;
      $("#vTireWho").textContent = "";
    }

    render();
  }

  /* True when we're drawing an axle whose offset nobody publishes. Everything
     downstream must then stop short of a number — no stance verdict, no poke
     dimension. Saying "Deep poke" one line under "we don't know this offset"
     is exactly the invented precision this rebuild exists to remove. */
  function offsetUnknown() {
    return S.axle === "front" && S.frontMode === "wide" &&
           FIT.frontSuperSingle.offsetMm === null;
  }

  /* ---- geometry for the current pick ---- */

  /* With no published offset there is no honest place to put the wheel, so we
     draw it sitting flush with the fender and say that is a placeholder. Using
     the rear's ET on a 16" front put it 5" outside the bodywork — a picture of
     a setup nobody sells. */
  function drawOffsetMm(axle) {
    if (!offsetUnknown()) return S.offset;
    return Math.round((widthFor(axle) / 2 - VEHICLE.faceToFenderIn) * F.MM_PER_IN);
  }

  function geom(axle) {
    return F.geometry({
      widthIn: widthFor(axle),
      offsetMm: drawOffsetMm(axle),
      tireOdIn: S.tire ? S.tire.od : S.dia + 8,
      wheelDiaIn: S.dia,
      lift: S.lift,
      vehicle: VEHICLE
    });
  }

  /* Draw the plate photo with the chosen wheel composited into each usable
     anchor. The wheel scales against the plate's own reference diameter, so
     picking a 22 instead of a 26 shrinks the wheel inside the same tire —
     which is exactly what happens on a truck when overall tire height is held
     and you change rim size. */
  function drawPlate() {
    if (!PLATE) return;
    var W = PLATE.width, H = PLATE.height, s = "";
    s += '<image href="' + esc(PLATE.image) + '" x="0" y="0" width="' + W + '" height="' + H + '"/>';

    var scale = S.dia / PLATE.referenceWheelDiaIn;
    var drawn = 0;

    PLATE.wheels.forEach(function (a) {
      if (!a.usable) return;
      var axle = a.axle;
      var path = artPath(axle === "rear" ? "rear" : (S.frontMode === "wide" ? "supersingle" : "front"));
      var dim = S.imgDims[path];
      if (dim === undefined) { preload(path, drawPlate); return; }
      if (!dim) return;
      var r = a.faceRadiusPx * scale;
      s += '<image href="' + esc(path) + '" x="' + (a.cx - r).toFixed(1) + '" y="' + (a.cy - r).toFixed(1) +
           '" width="' + (r * 2).toFixed(1) + '" height="' + (r * 2).toFixed(1) + '"/>';
      drawn++;
    });

    /* Say what the picture is and isn't. An unusable anchor means the truck in
       the photo still wears its own wheel there — the customer must not be
       left to think that is what they picked. */
    var unusable = PLATE.wheels.filter(function (a) { return !a.usable; });
    var msgs = [];
    if (unusable.length) {
      msgs.push("Only the " + PLATE.wheels.filter(function (a) { return a.usable; })
        .map(function (a) { return a.axle; }).join(" and ") +
        " wheel is swapped here — the " + unusable.map(function (a) { return a.axle; }).join(" and ") +
        " sits too oblique in this shot to place a wheel honestly.");
    }
    if (!PLATE.referenceMeasured) {
      msgs.push("Relative sizing between diameters is exact; absolute scale is estimated from the photo.");
    }
    $("#vPlateNote").textContent = msgs.join(" ");
    $("#vPlateNote").style.display = msgs.length ? "" : "none";
    $("#vPlateWarn").style.display = (PLATE.cleared && PLATE.layered) ? "none" : "";

    $("#svgPlate").setAttribute("viewBox", "0 0 " + W + " " + H);
    $("#svgPlate").innerHTML = s;
  }

  var PPI_SIDE = 7.4, PPI_TOP = 26;
  function svg(tag, attrs) {
    var s = "<" + tag;
    Object.keys(attrs).forEach(function (k) { s += " " + k + '="' + attrs[k] + '"'; });
    return s + "/>";
  }

  function drawSide() {
    var W = 920, H = 520, g = geom(S.axle);
    var cx = W * 0.5, ground = H - 66;
    var tireR = ((S.tire ? S.tire.od : S.dia + 8) / 2) * PPI_SIDE;
    var rimR = (S.dia / 2) * PPI_SIDE;
    var cy = ground - tireR;
    var fR = g.fenderRadius * PPI_SIDE;
    var paint = S.paint.hex;
    var s = "";

    var pokeIn = Math.max(-4, Math.min(5, g.poke));
    var dx = pokeIn * PPI_SIDE * 0.26;
    var sc = 1 + pokeIn * 0.011;
    var wx = cx + dx, wTire = tireR * sc, wRim = rimR * sc, wy = ground - wTire;

    // bodywork — a cropped quarter, outlined so light paint still reads
    var panelTop = Math.max(30, cy - fR - 108);
    s += '<defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">' +
         '<stop offset="0" stop-color="#ffffff" stop-opacity=".16"/>' +
         '<stop offset=".45" stop-color="#ffffff" stop-opacity="0"/>' +
         '<stop offset="1" stop-color="#000000" stop-opacity=".30"/></linearGradient></defs>';
    s += svg("rect", { x: 0, y: panelTop, width: W, height: (cy + 22) - panelTop, fill: paint });
    s += svg("rect", { x: 0, y: panelTop, width: W, height: (cy + 22) - panelTop, fill: "url(#pg)" });
    s += svg("line", { x1: 0, y1: panelTop, x2: W, y2: panelTop, stroke: "#111214", "stroke-opacity": ".22", "stroke-width": 1.5 });
    var crease = panelTop + ((cy + 22) - panelTop) * 0.42;
    s += svg("line", { x1: 0, y1: crease, x2: W, y2: crease, stroke: "#fff", "stroke-opacity": ".14", "stroke-width": 2 });
    s += svg("line", { x1: 0, y1: crease + 3, x2: W, y2: crease + 3, stroke: "#000", "stroke-opacity": ".22", "stroke-width": 3 });
    s += '<path d="M ' + (cx - fR - 13) + ' ' + (cy + 6) +
         ' A ' + (fR + 13) + ' ' + (fR + 13) + ' 0 0 1 ' + (cx + fR + 13) + ' ' + (cy + 6) +
         '" fill="none" stroke="#ffffff" stroke-opacity=".10" stroke-width="16"/>';
    s += '<path d="M ' + (cx - fR) + ' ' + (cy + 6) +
         ' A ' + fR + ' ' + fR + ' 0 0 1 ' + (cx + fR) + ' ' + (cy + 6) +
         ' L ' + (cx + fR) + ' ' + (cy + 42) + ' L ' + (cx - fR) + ' ' + (cy + 42) + ' Z" fill="#07080b"/>';
    s += svg("rect", { x: 0, y: cy + 22, width: W, height: 20, fill: "#000", opacity: ".55" });
    s += '<path d="M ' + (cx - fR) + ' ' + (cy + 6) + ' A ' + fR + ' ' + fR + ' 0 0 1 ' +
         (cx + fR) + ' ' + (cy + 6) + '" fill="none" stroke="#111214" stroke-opacity=".7" stroke-width="2.5"/>';
    s += svg("ellipse", { cx: cx + dx, cy: ground + 4, rx: tireR * 0.95, ry: 11, fill: "#000", opacity: ".28" });
    s += svg("line", { x1: 0, y1: ground, x2: W, y2: ground, stroke: "#111214", "stroke-opacity": ".35", "stroke-width": 2 });

    // On the rear you are looking at a PAIR — the inner tire sits behind the outer.
    if (S.axle === "rear") {
      s += svg("circle", { cx: wx - JTX.rearWidth * PPI_SIDE * 0.26, cy: wy, r: wTire * 0.985,
        fill: "#0b0e11", stroke: "#000", "stroke-width": 2 });
    }
    s += wheelGroup(wx, wy, wTire, wRim);

    if (g.poke < -0.15) {
      var bite = Math.min(Math.abs(g.poke), 3.2) * PPI_SIDE * 0.9;
      s += '<clipPath id="archClip"><path d="M ' + (cx - fR - 4) + ' ' + (cy + 8) +
           ' A ' + (fR + 4) + ' ' + (fR + 4) + ' 0 0 1 ' + (cx + fR + 4) + ' ' + (cy + 8) +
           ' L ' + (cx + fR + 4) + ' ' + (cy - fR - 160) + ' L ' + (cx - fR - 4) + ' ' + (cy - fR - 160) + ' Z"/></clipPath>';
      s += '<path clip-path="url(#archClip)" d="M ' + (cx - fR) + ' ' + (cy + 6) +
           ' A ' + fR + ' ' + fR + ' 0 0 1 ' + (cx + fR) + ' ' + (cy + 6) +
           '" fill="none" stroke="' + paint + '" stroke-width="' + bite.toFixed(1) + '"/>';
      s += '<path clip-path="url(#archClip)" d="M ' + (cx - fR) + ' ' + (cy + 6) +
           ' A ' + fR + ' ' + fR + ' 0 0 1 ' + (cx + fR) + ' ' + (cy + 6) +
           '" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="' + bite.toFixed(1) + '"/>';
      s += '<path d="M ' + (cx - fR) + ' ' + (cy + 6) + ' A ' + fR + ' ' + fR + ' 0 0 1 ' +
           (cx + fR) + ' ' + (cy + 6) + '" fill="none" stroke="#111214" stroke-opacity=".7" stroke-width="2.5"/>';
    } else if (g.poke > 0.4) {
      s += '<clipPath id="wellClip"><path d="M ' + (cx - fR) + ' ' + (cy + 6) +
           ' A ' + fR + ' ' + fR + ' 0 0 1 ' + (cx + fR) + ' ' + (cy + 6) +
           ' L ' + (cx + fR) + ' ' + (cy + 42) + ' L ' + (cx - fR) + ' ' + (cy + 42) + ' Z"/></clipPath>';
      s += '<ellipse clip-path="url(#wellClip)" cx="' + wx.toFixed(1) + '" cy="' + (cy - fR + 26).toFixed(1) +
           '" rx="' + (wTire * 0.8).toFixed(1) + '" ry="26" fill="#000" opacity="' +
           Math.min(0.42, 0.16 + g.poke * 0.06).toFixed(2) + '"/>';
    }

    s += '<text x="40" y="' + (ground + 30) + '" fill="#111214" font-family="Inter" font-size="13">' +
         esc(S.dia + "x" + widthFor(S.axle) + "   " +
             (offsetUnknown() ? "offset spec'd by JTX" : "ET+" + S.offset) +
             (S.tire ? "   " + S.tire.size : "")) + "</text>";
    s += '<text x="40" y="' + (ground + 50) + '" fill="' +
         (offsetUnknown() ? "#a35a00" : (g.poke > 0.4 ? "#a35a00" : "#5b6069")) +
         '" font-family="Inter" font-size="12.5">' +
         esc(offsetUnknown() ? "Front offset is spec'd to the truck — stance not drawn to a published figure"
                             : F.pokeText(g, !!VEHICLE.measured)) + "</text>";
    s += '<text x="' + (W - 40) + '" y="' + (ground + 30) + '" text-anchor="end" fill="#8b9099" ' +
         'font-family="Inter" font-size="11.5">' +
         esc(S.axle === "rear" ? "rear · dual pair" : "front · " + (S.frontMode === "wide" ? "wide" : "matched 8.25")) +
         "</text>";

    $("#svgSide").setAttribute("viewBox", "0 0 " + W + " " + H);
    $("#svgSide").innerHTML = s;
  }

  function wheelGroup(cx, cy, tireR, rimR) {
    var s = "";
    s += svg("circle", { cx: cx, cy: cy, r: tireR, fill: "#15181c" });
    s += svg("circle", { cx: cx, cy: cy, r: tireR - 3, fill: "none",
      stroke: "#22272d", "stroke-width": 6, "stroke-opacity": ".9" });
    s += svg("circle", { cx: cx, cy: cy, r: (tireR + rimR) / 2 + 2, fill: "none",
      stroke: "#0d1013", "stroke-width": Math.max(3, (tireR - rimR) * 0.55) });
    s += svg("circle", { cx: cx, cy: cy, r: rimR + 6, fill: "none",
      stroke: "#2b3138", "stroke-width": 3, "stroke-opacity": ".8" });
    s += svg("circle", { cx: cx, cy: cy, r: tireR, fill: "none", stroke: "#000", "stroke-width": 2 });
    s += svg("circle", { cx: cx, cy: cy, r: rimR + 2, fill: "#08090c" });

    var path = artPath(positionFor(S.axle));
    var dim = S.imgDims[path];
    if (dim) {
      var p = F.placement(FACE, dim, cx, cy, rimR);
      if (p) {
        s += '<image href="' + esc(path) + '" x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) +
             '" width="' + p.width.toFixed(1) + '" height="' + p.height.toFixed(1) + '"/>';
      }
    }
    return s;
  }

  function drawTop() {
    var W = 920, H = 470, g = geom(S.axle);
    var hubX = W * 0.42, midY = H / 2 - 4;
    var fendX = hubX + VEHICLE.faceToFenderIn * PPI_TOP;
    var paint = S.paint.hex;
    var s = "";

    s += '<text x="26" y="30" fill="#5b6069" font-family="Inter" font-size="12.5">' +
         'Looking straight down at one corner, cutaway. The truck is on the left. On a dually the hub</text>';
    s += '<text x="26" y="48" fill="#5b6069" font-family="Inter" font-size="12.5">' +
         'stands proud on a pedestal and both wheels hang inboard of it — which is why they look dished.</text>';

    s += svg("rect", { x: 0, y: midY - 150, width: Math.max(0, fendX), height: 300, fill: paint });
    s += svg("rect", { x: 0, y: midY - 150, width: Math.max(0, fendX), height: 300, fill: "none",
      stroke: "#111214", "stroke-opacity": ".22", "stroke-width": 1.5 });

    s += svg("line", { x1: hubX, y1: midY - 126, x2: hubX, y2: midY + 126,
      stroke: "#111214", "stroke-width": 2, "stroke-dasharray": "6 5", "stroke-opacity": ".55" });
    s += '<text x="' + (hubX + 8) + '" y="' + (midY - 132) + '" fill="#111214" font-family="Inter" ' +
         'font-size="11.5" opacity=".8">hub face</text>';

    function barrel(gg, y, h) {
      var inX = hubX - gg.innerFromFace * PPI_TOP, outX = hubX + gg.outerFromFace * PPI_TOP;
      var t = svg("rect", { x: inX, y: y, width: outX - inX, height: h,
        fill: offsetUnknown() ? "#8b9099" : "#1b2027",
        stroke: offsetUnknown() ? "#6d757f" : "#3a434d",
        "stroke-width": 2, "stroke-dasharray": offsetUnknown() ? "8 5" : "" });
      if (outX > fendX && !offsetUnknown()) {
        t += svg("rect", { x: fendX, y: y, width: outX - fendX, height: h, fill: "#f0a02a", opacity: ".55" });
      }
      t += svg("rect", { x: outX - 8, y: y - 6, width: 8, height: h + 12, fill: "#cfd6dd" });
      return t;
    }

    if (S.axle === "rear") {
      var inner = { innerFromFace: g.innerFromFace + JTX.rearWidth,
                    outerFromFace: g.outerFromFace - JTX.rearWidth };
      s += barrel(inner, midY - 84, 62);
      s += barrel(g, midY + 22, 62);
      s += '<text x="14" y="' + (midY - 92) + '" fill="#5b6069" font-family="Inter" font-size="11.5">inner wheel</text>';
      s += '<text x="14" y="' + (midY + 100) + '" fill="#5b6069" font-family="Inter" font-size="11.5">outer wheel + floater cap</text>';
    } else {
      s += barrel(g, midY - 80, 154);
      s += '<text x="' + (hubX - g.innerFromFace * PPI_TOP + 10) + '" y="' + (midY + 6) +
           '" fill="#e6ebef" font-family="Inter" font-size="12.5">' + widthFor("front") + '" wide</text>';
    }

    s += svg("line", { x1: fendX, y1: midY - 156, x2: fendX, y2: midY + 156,
      stroke: "#111214", "stroke-width": 2.5, "stroke-opacity": ".9" });
    s += '<text x="' + (fendX + 10) + '" y="' + (midY - 162) + '" fill="#111214" font-family="Inter" font-size="12.5">fender edge</text>';

    var dimY = midY + 186;
    if (offsetUnknown()) {
      s += '<text x="' + hubX + '" y="' + (dimY + 14) + '" text-anchor="middle" fill="#a35a00" ' +
           'font-family="Inter" font-size="13">No published offset for a wide front on this truck — ' +
           'JTX spec it to the build, so there is nothing honest to dimension here.</text>';
    } else {
      var outX = hubX + g.outerFromFace * PPI_TOP;
      var col = g.poke > 0.4 ? "#a35a00" : (g.poke > -0.5 ? "#1f6fe0" : "#1f7a4d");
      var a = Math.min(fendX, outX), b2 = Math.max(fendX, outX);
      s += svg("line", { x1: fendX, y1: midY + 156, x2: fendX, y2: dimY + 6, stroke: col, "stroke-width": 1, "stroke-opacity": ".6" });
      s += svg("line", { x1: outX, y1: midY + 156, x2: outX, y2: dimY + 6, stroke: col, "stroke-width": 1, "stroke-opacity": ".6" });
      s += svg("line", { x1: a, y1: dimY, x2: b2, y2: dimY, stroke: col, "stroke-width": 3 });
      s += '<text x="' + ((a + b2) / 2) + '" y="' + (dimY + 22) + '" text-anchor="middle" fill="' + col +
           '" font-family="Inter" font-size="13">' + esc(F.pokeText(g, !!VEHICLE.measured)) + "</text>";
    }

    $("#svgTop").setAttribute("viewBox", "0 0 " + W + " " + H);
    $("#svgTop").innerHTML = s;
  }

  /* Draw synchronously from whatever we already have, then kick off the art
     load and redraw when it lands. Waiting on the image before updating the
     numbers left the readout describing the PREVIOUS selection for as long as
     the fetch took — which on a job-site phone is exactly when it matters. */
  function render() {
    var g = geom(S.axle);
    var st = F.stance(g);
    var unknown = offsetUnknown();

    $("#vWheelName").textContent = "JTX " + S.model.name + " · " + S.finish.name;
    $("#vSize").textContent = S.dia + "x" + widthFor(S.axle);
    $("#vOffRead").textContent = unknown ? "not published" : "ET+" + S.offset;
    $("#vStance").textContent = unknown ? "Spec'd by JTX" : st.label;
    $("#vStance").className = "vstance" + (unknown ? " vstance--unknown" : " vstance--" + st.key);
    $("#vTireRead").textContent = S.tire ? S.tire.size : "—";
    $("#vLiftV").textContent = S.lift + '"';

    /* Front offsets are the one number nobody publishes for this platform,
       so the readout says that instead of showing a figure we made up. */
    $("#vOffNote").textContent = unknown
      ? "JTX spec the wide front to the truck and publish no offset for it, so we don't draw a stance for it — we confirm the figure with them on your build."
      : "These are the offsets this truck actually runs, from published aftermarket dually fitments. Factory is ET+" + FIT.oem.offsetMm + ".";
    $("#vOffNote").className = "vnote" + (unknown ? " vnote--flag" : "");

    drawPlate();
    drawSide();
    drawTop();

    var path = artPath(positionFor(S.axle));
    if (S.imgDims[path] === undefined) preload(path, drawSide);
  }

  /* Deep link from a wheel card: ?model=Combat. The card only emits this for
     models the spec bundle covers, so an unknown value just means someone
     edited the URL — fall through to the default rather than erroring. */
  (function preselect() {
    try {
      var want = new URLSearchParams(location.search).get("model");
      if (!want) return;
      var hit = JTX.models.filter(function (m) { return m.name === want; })[0];
      if (hit) S.model = hit;
    } catch (e) {}
  })();

  buildControls();
  $("#vModel").value = JTX.models.indexOf(S.model);
  sync();
})();

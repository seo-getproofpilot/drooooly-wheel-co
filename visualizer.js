/* ============================================================
   DROOOLY — wheel preview visualizer (DOM/SVG only)
   All geometry comes from window.Fitment. This file draws.
   ============================================================ */
(function () {
  var root = document.getElementById("viz");
  if (!root || !window.Fitment) return;

  var F = window.Fitment;
  var VEHICLES = window.VEHICLES || [];
  var PAINT = window.VEHICLE_PAINT || [];
  var FACES = window.WHEEL_FACES || {};

  /* ---- catalog: featured wheels that have a photo ---- */
  var WHEELS = [];
  (window.BRANDS || []).forEach(function (b) {
    b.models.forEach(function (m) {
      if (m.feat && m.img) WHEELS.push({ brand: b.name, slug: b.slug, model: m, img: m.img });
    });
  });
  WHEELS.sort(function (a, b) {
    return a.brand.localeCompare(b.brand) || a.model.model.localeCompare(b.model.model);
  });

  var BRAND_NAMES = [];
  WHEELS.forEach(function (w) { if (BRAND_NAMES.indexOf(w.brand) < 0) BRAND_NAMES.push(w.brand); });

  /* stance presets — a way in for someone who doesn't know what ET-76 means */
  var PRESETS = [
    { key: "tuck",   label: "Factory tuck", pick: function (v) { return v.stockOffsetMm; } },
    { key: "flush",  label: "Flush",        pick: function (v, w) { return Math.round((w / 2 - v.faceToFenderIn) * F.MM_PER_IN); } },
    { key: "poke",   label: "Aggressive",   pick: function (v, w) { return Math.round((w / 2 - v.faceToFenderIn - 2.25) * F.MM_PER_IN); } }
  ];

  var S = {
    vehicle: VEHICLES[0],
    paint: PAINT[1] || PAINT[0],
    wheel: null,
    dia: 24, wid: 14, offset: (VEHICLES[0] || {}).stockOffsetMm || 0, tireOd: 35, lift: 0,
    touchedOffset: false,
    imgDims: null,
    ghost: null            // pinned comparison setup
  };

  var $ = function (s) { return root.querySelector(s); };
  var el = function (t, a, h) {
    var n = document.createElement(t);
    if (a) Object.keys(a).forEach(function (k) { n.setAttribute(k, a[k]); });
    if (h !== undefined) n.innerHTML = h;
    return n;
  };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  /* ---- build the control panel ---- */
  function buildControls() {
    // vehicle
    var vs = $("#vVehicle");
    VEHICLES.forEach(function (v, i) {
      vs.appendChild(el("option", { value: i }, esc(v.make + " " + v.models[0] +
        (v.config === "drw" ? " (dually)" : ""))));
    });
    vs.onchange = function () {
      S.vehicle = VEHICLES[+this.value];
      if (!S.touchedOffset) S.offset = S.vehicle.stockOffsetMm;
      syncOffsetRange(); render();
    };

    // brand → model
    var bs = $("#vBrand");
    BRAND_NAMES.forEach(function (b) { bs.appendChild(el("option", { value: b }, esc(b))); });
    bs.onchange = function () { fillModels(this.value); pickWheel(0); };
    fillModels(BRAND_NAMES[0]);
    $("#vModel").onchange = function () { pickWheel(); };

    // paint
    var ps = $("#vPaint");
    PAINT.forEach(function (p, i) {
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

    // presets
    var pr = $("#vPresets");
    PRESETS.forEach(function (p) {
      var b = el("button", { class: "vpreset", type: "button" }, p.label);
      b.onclick = function () {
        var want = p.pick(S.vehicle, S.wid);
        S.offset = clampOffset(want);
        S.touchedOffset = true;
        $("#vOffset").value = S.offset;
        pr.querySelectorAll(".vpreset").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        /* A wide wheel physically cannot be tucked in as far as a narrow one —
           when the preset runs off the end of what this wheel can be built as,
           say so instead of silently landing somewhere else. */
        var note = $("#vPresetNote");
        if (Math.abs(want - S.offset) > 2) {
          note.textContent = 'A ' + S.wid + '" wide wheel can\'t reach ' + p.label.toLowerCase() +
            ' on this truck — this is as ' + (want > S.offset ? "far in" : "far out") + ' as it is built.';
          note.style.display = "";
        } else { note.style.display = "none"; }
        render();
      };
      pr.appendChild(b);
    });

    // sliders
    $("#vOffset").oninput = function () { S.offset = +this.value; S.touchedOffset = true; render(); };
    $("#vLift").oninput   = function () { S.lift   = +this.value; render(); };
    $("#vTire").oninput   = function () { S.tireOd = +this.value; render(); };

    // compare
    $("#vPin").onclick = function () {
      S.ghost = S.ghost ? null : { dia: S.dia, wid: S.wid, offset: S.offset, tireOd: S.tireOd };
      this.textContent = S.ghost ? "Clear comparison" : "Pin this setup to compare";
      render();
    };

    // view tabs
    root.querySelectorAll(".vtab").forEach(function (t) {
      t.onclick = function () {
        root.querySelectorAll(".vtab").forEach(function (x) { x.classList.remove("on"); });
        root.querySelectorAll(".vview").forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on");
        root.querySelector("#vv-" + t.dataset.v).classList.add("on");
        render();
      };
    });
  }

  function fillModels(brand) {
    var ms = $("#vModel");
    ms.innerHTML = "";
    WHEELS.forEach(function (w, i) {
      if (w.brand === brand) ms.appendChild(el("option", { value: i }, esc(w.model.model)));
    });
  }

  /* ---- wheel selection drives the real size options ---- */
  function pickWheel(idxOrFirst) {
    var ms = $("#vModel");
    var idx = typeof idxOrFirst === "number" && ms.options.length
      ? +(ms.options[idxOrFirst] || ms.options[0]).value : +ms.value;
    S.wheel = WHEELS[idx];
    ms.value = idx;

    // preload natural dimensions — placement needs them
    S.imgDims = null;
    var im = new Image();
    im.onload = function () { S.imgDims = { w: im.naturalWidth, h: im.naturalHeight }; render(); };
    im.src = S.wheel.img;

    buildSizeChips();
    render();
  }

  function buildSizeChips() {
    var m = S.wheel.model;
    var dias = F.diametersFor(m);
    if (dias.indexOf(S.dia) < 0) S.dia = dias[Math.floor(dias.length / 2)] || 24;

    var dc = $("#vDia"); dc.innerHTML = "";
    dias.forEach(function (d) {
      var b = el("button", { class: "vchip" + (d === S.dia ? " on" : ""), type: "button" }, d + '"');
      b.onclick = function () { S.dia = d; buildSizeChips(); render(); };
      dc.appendChild(b);
    });

    var widths = F.widthsFor(m, S.dia);
    var wc = $("#vWid"); wc.innerHTML = "";
    var note = $("#vWidNote");
    if (widths.length) {
      note.style.display = "none";
      if (widths.indexOf(S.wid) < 0) S.wid = defaultWidth(widths);
      widths.forEach(function (w) {
        var b = el("button", { class: "vchip" + (w === S.wid ? " on" : ""), type: "button" }, w + '"');
        b.onclick = function () { S.wid = w; buildSizeChips(); syncOffsetRange(); render(); };
        wc.appendChild(b);
      });
    } else {
      // vision / tis / fenix publish by diameter only — say so rather than guess
      note.style.display = "";
      note.textContent = S.wheel.brand + " publishes this style by diameter. We confirm the width when we quote.";
      [10, 12, 14].forEach(function (w) {
        var b = el("button", { class: "vchip vchip--unsure" + (w === S.wid ? " on" : ""), type: "button" }, w + '"');
        b.onclick = function () { S.wid = w; buildSizeChips(); syncOffsetRange(); render(); };
        wc.appendChild(b);
      });
      if ([10, 12, 14].indexOf(S.wid) < 0) S.wid = 12;
    }
    syncTireRange();
    syncOffsetRange();
  }

  function syncTireRange() {
    var t = $("#vTire");
    t.min = Math.ceil(S.dia) + 2;
    t.max = Math.ceil(S.dia) + 16;
    S.tireOd = Math.max(+t.min, Math.min(+t.max, S.tireOd));
    t.value = S.tireOd;
  }

  /* A dually runs a narrow rear (8-8.5"); a single-rear truck runs the wide
     one. Both widths stay on offer — super singles and dually fronts are real —
     but the first thing you see should be the width that truck actually wears. */
  function defaultWidth(widths) {
    if (!widths.length) return S.wid;
    if (S.vehicle.config === "drw") {
      var narrow = widths.filter(function (w) { return w <= 8.6; });
      if (narrow.length) return narrow[0];
    }
    var wide = widths.filter(function (w) { return w >= 9; });
    return wide.length ? wide[wide.length - 1] : widths[widths.length - 1];
  }

  function clampOffset(v) {
    var s = $("#vOffset");
    return Math.max(+s.min, Math.min(+s.max, v));
  }
  /* Offset is bounded by the wheel itself, not by a round number. Backspacing
     is w/2 + offset + lip, and no wheel is built with less than about 1.5" of
     it — so a narrow wheel simply cannot be run as far out as a wide one. Let
     the slider stop where the hardware does instead of computing a wheel that
     nobody can make. */
  function syncOffsetRange() {
    var s = $("#vOffset");
    var minOff = Math.round((1.5 - 0.5 - S.wid / 2) * F.MM_PER_IN);
    var maxOff = Math.max(Math.min(Math.round((S.wid / 2 - 1.0) * F.MM_PER_IN), 60),
                          (S.vehicle.stockOffsetMm || 0) + 30);
    minOff = Math.min(minOff, S.vehicle.stockOffsetMm || 0);
    s.min = minOff; s.max = maxOff;
    S.offset = clampOffset(S.offset);
    s.value = S.offset;
    $("#vOffMin").textContent = "ET" + minOff;
    $("#vOffMax").textContent = "ET+" + maxOff;
  }

  /* ---- drawing ---- */
  var PPI_SIDE = 7.4, PPI_TOP = 26;

  function svg(tag, attrs) {
    var s = "<" + tag;
    Object.keys(attrs).forEach(function (k) { s += " " + k + '="' + attrs[k] + '"'; });
    return s + "/>";
  }

  function currentGeom(over) {
    return F.geometry({
      widthIn: over ? over.wid : S.wid,
      offsetMm: over ? over.offset : S.offset,
      tireOdIn: over ? over.tireOd : S.tireOd,
      wheelDiaIn: over ? over.dia : S.dia,
      lift: S.lift,
      vehicle: S.vehicle
    });
  }

  /* Side view: the beauty shot. You look at the wheel FACE from here, which is
     exactly what the manufacturer renders show — so this is where the wheel
     itself reads. A poked wheel is drawn OVER the fender lip because that is
     what actually happens when it stands proud of the bodywork. */
  function drawSide() {
    var W = 920, H = 520, g = currentGeom();
    var cx = W * 0.5, ground = H - 66;
    var tireR = (S.tireOd / 2) * PPI_SIDE;
    var rimR  = (S.dia / 2) * PPI_SIDE;
    var cy = ground - tireR;
    var fR = g.fenderRadius * PPI_SIDE;
    var paint = S.paint.hex;
    var s = "";

    /* The manufacturer renders sit ~15 deg off head-on, so a wheel moving
       outboard genuinely does travel sideways in the image plane. That, plus a
       touch of scale for being nearer the camera, is what makes the offset
       readable in a view that is otherwise flat. Clamped so an extreme number
       can never distort the wheel into something dishonest. */
    var pokeIn = Math.max(-4, Math.min(5, g.poke));
    var dx = pokeIn * PPI_SIDE * 0.26, dxPre = dx;
    var sc = 1 + pokeIn * 0.011;
    var wx = cx + dx, wTire = tireR * sc, wRim = rimR * sc, wy = ground - wTire;

    /* Bodywork: a cropped rear quarter, not a floating box. Panel, bodyline,
       arch flare, rocker — enough for the eye to read "truck" and to judge the
       wheel against a real fender line. */
    var panelTop = Math.max(30, cy - fR - 108);
    s += '<defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">' +
         '<stop offset="0" stop-color="#ffffff" stop-opacity=".16"/>' +
         '<stop offset=".45" stop-color="#ffffff" stop-opacity="0"/>' +
         '<stop offset="1" stop-color="#000000" stop-opacity=".30"/></linearGradient></defs>';
    s += svg("rect", { x: 0, y: panelTop, width: W, height: (cy + 22) - panelTop, fill: paint });
    s += svg("rect", { x: 0, y: panelTop, width: W, height: (cy + 22) - panelTop, fill: "url(#pg)" });
    // outline, or a white truck disappears into a light page
    s += svg("line", { x1: 0, y1: panelTop, x2: W, y2: panelTop, stroke: "#111214", "stroke-opacity": ".22", "stroke-width": 1.5 });
    // bodyline crease
    var crease = panelTop + ((cy + 22) - panelTop) * 0.42;
    s += svg("line", { x1: 0, y1: crease, x2: W, y2: crease, stroke: "#fff", "stroke-opacity": ".14", "stroke-width": 2 });
    s += svg("line", { x1: 0, y1: crease + 3, x2: W, y2: crease + 3, stroke: "#000", "stroke-opacity": ".22", "stroke-width": 3 });
    // arch flare, then the cut itself
    s += '<path d="M ' + (cx - fR - 13) + ' ' + (cy + 6) +
         ' A ' + (fR + 13) + ' ' + (fR + 13) + ' 0 0 1 ' + (cx + fR + 13) + ' ' + (cy + 6) +
         '" fill="none" stroke="#ffffff" stroke-opacity=".10" stroke-width="16"/>';
    s += '<path d="M ' + (cx - fR) + ' ' + (cy + 6) +
         ' A ' + fR + ' ' + fR + ' 0 0 1 ' + (cx + fR) + ' ' + (cy + 6) +
         ' L ' + (cx + fR) + ' ' + (cy + 42) + ' L ' + (cx - fR) + ' ' + (cy + 42) + ' Z" fill="#07080b"/>';
    // rocker below the panel
    s += svg("rect", { x: 0, y: cy + 22, width: W, height: 20, fill: "#000", opacity: ".55" });
    // fender lip — the reference line every stance is read against
    s += '<path d="M ' + (cx - fR) + ' ' + (cy + 6) + ' A ' + fR + ' ' + fR + ' 0 0 1 ' +
         (cx + fR) + ' ' + (cy + 6) + '" fill="none" stroke="#111214" stroke-opacity=".7" stroke-width="2.5"/>';
    // ground + contact shadow
    s += svg("ellipse", { cx: cx + dxPre, cy: ground + 4, rx: tireR * 0.95, ry: 11, fill: "#000", opacity: ".28" });
    s += svg("line", { x1: 0, y1: ground, x2: W, y2: ground, stroke: "#111214", "stroke-opacity": ".35", "stroke-width": 2 });

    // pinned comparison, drawn behind as an outline
    if (S.ghost) {
      var gg = currentGeom(S.ghost);
      var gPoke = Math.max(-4, Math.min(5, gg.poke));
      var gTire = (S.ghost.tireOd / 2) * PPI_SIDE * (1 + gPoke * 0.011);
      s += svg("circle", { cx: cx + gPoke * PPI_SIDE * 0.26, cy: ground - gTire, r: gTire, fill: "none",
        stroke: "#1f6fe0", "stroke-opacity": ".8", "stroke-width": 2, "stroke-dasharray": "7 5" });
    }

    if (g.isDually) {
      // the inner tire, sitting one rim width further in and mostly hidden
      s += svg("circle", { cx: wx - S.wid * PPI_SIDE * 0.26, cy: wy, r: wTire * 0.985,
        fill: "#0b0e11", stroke: "#000", "stroke-width": 2 });
    }
    s += wheelGroup(wx, wy, wTire, wRim);

    /* Occlusion is what sells it. Tucked, the sheet metal hangs over the tire
       and eats its top edge; poked, the wheel crosses in front of the lip —
       which it already does, because it is drawn after the body. */
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
           (cx + fR) + ' ' + (cy + 6) + '" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="2.5"/>';
    } else if (g.poke > 0.4) {
      /* Standing proud, the wheel throws its shadow UP INTO the wheel well —
         clipped to the arch, or it reads as a smudge on the paint. */
      s += '<clipPath id="wellClip"><path d="M ' + (cx - fR) + ' ' + (cy + 6) +
           ' A ' + fR + ' ' + fR + ' 0 0 1 ' + (cx + fR) + ' ' + (cy + 6) +
           ' L ' + (cx + fR) + ' ' + (cy + 42) + ' L ' + (cx - fR) + ' ' + (cy + 42) + ' Z"/></clipPath>';
      s += '<ellipse clip-path="url(#wellClip)" cx="' + wx.toFixed(1) + '" cy="' + (cy - fR + 26).toFixed(1) +
           '" rx="' + (wTire * 0.8).toFixed(1) + '" ry="26" fill="#000" opacity="' +
           Math.min(0.42, 0.16 + g.poke * 0.06).toFixed(2) + '"/>';
    }

    // caption strip
    var measured = !!S.vehicle.measured;
    s += '<text x="40" y="' + (ground + 30) + '" fill="#111214" font-family="Inter" font-size="13">' +
         esc(S.dia + 'x' + S.wid + '   ET' + (S.offset > 0 ? "+" : "") + S.offset +
             '   ' + S.tireOd + '" tire') + '</text>';
    s += '<text x="40" y="' + (ground + 50) + '" fill="' + (g.poke > 0.4 ? "#a35a00" : "#5b6069") +
         '" font-family="Inter" font-size="12.5">' + esc(F.pokeText(g, measured)) + '</text>';
    s += '<text x="' + (W - 40) + '" y="' + (ground + 30) + '" text-anchor="end" fill="#8b9099" ' +
         'font-family="Inter" font-size="11.5">dark line = fender lip</text>';

    $("#svgSide").setAttribute("viewBox", "0 0 " + W + " " + H);
    $("#svgSide").innerHTML = s;
  }

  /* one wheel + tire, mounted via the face map */
  function wheelGroup(cx, cy, tireR, rimR) {
    var s = "";
    // tire
    s += svg("circle", { cx: cx, cy: cy, r: tireR, fill: "#15181c" });
    s += svg("circle", { cx: cx, cy: cy, r: tireR - 3, fill: "none",
      stroke: "#22272d", "stroke-width": 6, "stroke-opacity": ".9" });          // shoulder
    s += svg("circle", { cx: cx, cy: cy, r: (tireR + rimR) / 2 + 2, fill: "none",
      stroke: "#0d1013", "stroke-width": Math.max(3, (tireR - rimR) * 0.55) }); // sidewall dish
    s += svg("circle", { cx: cx, cy: cy, r: rimR + 6, fill: "none",
      stroke: "#2b3138", "stroke-width": 3, "stroke-opacity": ".8" });          // bead
    s += svg("circle", { cx: cx, cy: cy, r: tireR, fill: "none", stroke: "#000", "stroke-width": 2 });
    // seat: dark disc just under the rim so the render doesn't float
    s += svg("circle", { cx: cx, cy: cy, r: rimR + 2, fill: "#08090c" });

    var face = FACES[S.wheel && S.wheel.img];
    if (face && S.imgDims) {
      var p = F.placement(face, S.imgDims, cx, cy, rimR);
      if (p) {
        s += '<image href="' + esc(S.wheel.img) + '" x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) +
             '" width="' + p.width.toFixed(1) + '" height="' + p.height.toFixed(1) + '"/>';
      }
    }
    return s;
  }

  /* Cross-section: the instrument. Looking straight down at one corner, with
     the truck's sheet metal on the left and the wheel poking out of it. This is
     where "ET-113" stops being a number and becomes a distance you can see. */
  function drawTop() {
    var W = 920, H = 470, g = currentGeom(), v = S.vehicle;
    var hubX = W * 0.30, midY = H / 2 - 4;
    var fendX = hubX + v.faceToFenderIn * PPI_TOP;
    var paint = S.paint.hex;
    var s = "";

    s += '<text x="26" y="30" fill="#5b6069" font-family="Inter" font-size="12.5">' +
         'Looking straight down at one corner, cutaway. The truck is on the left; negative ' +
         'offset pushes the wheel to the right, out past the bodywork.</text>';

    // the truck, seen from above — everything inboard of the fender edge
    s += svg("rect", { x: 0, y: midY - 150, width: fendX, height: 300, fill: paint });
    s += svg("rect", { x: 0, y: midY - 150, width: fendX, height: 300, fill: "none",
      stroke: "#111214", "stroke-opacity": ".22", "stroke-width": 1.5 });
    s += svg("rect", { x: 0, y: midY - 150, width: fendX, height: 26, fill: "#000", opacity: ".2" });
    s += svg("rect", { x: 0, y: midY + 124, width: fendX, height: 26, fill: "#000", opacity: ".2" });

    // hub mounting face — where the wheel bolts on
    s += svg("line", { x1: hubX, y1: midY - 126, x2: hubX, y2: midY + 126,
      stroke: "#0b0d10", "stroke-width": 2, "stroke-dasharray": "6 5", "stroke-opacity": ".7" });
    s += '<text x="' + (hubX + 8) + '" y="' + (midY - 132) + '" fill="#0b0d10" font-family="Inter" ' +
         'font-size="11.5" opacity=".8">hub face</text>';

    /* One barrel. `solid` draws the real wheel; the dashed form is the pinned
       comparison. The portion outboard of the fender edge is called out in the
       stance colour — that overhang IS the poke. */
    function barrel(gg, y, h, solid) {
      var inX = hubX - gg.innerFromFace * PPI_TOP, outX = hubX + gg.outerFromFace * PPI_TOP;
      var t = "";
      if (!solid) {
        return svg("rect", { x: inX, y: y, width: outX - inX, height: h, fill: "none",
          stroke: "#1f6fe0", "stroke-width": 2, "stroke-dasharray": "7 5", "stroke-opacity": ".85" });
      }
      t += svg("rect", { x: inX, y: y, width: outX - inX, height: h, fill: "#1b2027", stroke: "#3a434d", "stroke-width": 2 });
      if (outX > fendX) {
        t += svg("rect", { x: fendX, y: y, width: outX - fendX, height: h, fill: "#f0a02a", opacity: ".55" });
      }
      // outer lip — the face you look at from the side
      t += svg("rect", { x: outX - 8, y: y - 6, width: 8, height: h + 12, fill: "#cfd6dd" });
      return t;
    }

    if (g.isDually) {
      // dual rear: the inner wheel sits one full width further in
      var inner = { innerFromFace: g.innerFromFace + S.wid, outerFromFace: g.outerFromFace - S.wid };
      s += barrel(inner, midY - 84, 62, true);
      s += barrel(g,     midY + 22, 62, true);
      s += '<text x="14" y="' + (midY - 92) + '" fill="#5b6069" font-family="Inter" font-size="11.5">inner wheel</text>';
      s += '<text x="14" y="' + (midY + 100) + '" fill="#5b6069" font-family="Inter" font-size="11.5">outer wheel + floater cap</text>';
    } else {
      if (S.ghost) s += barrel(currentGeom(S.ghost), midY - 92, 178, false);
      s += barrel(g, midY - 80, 154, true);
      s += '<text x="' + (hubX - g.innerFromFace * PPI_TOP + 10) + '" y="' + (midY + 6) +
           '" fill="#e6ebef" font-family="Inter" font-size="12.5">' + S.wid + '" wide</text>';
    }

    // fender edge drawn LAST so it stays readable where the wheel crosses it
    s += svg("line", { x1: fendX, y1: midY - 156, x2: fendX, y2: midY + 156,
      stroke: "#111214", "stroke-width": 2.5, "stroke-opacity": ".9" });
    s += '<text x="' + (fendX + 10) + '" y="' + (midY - 162) + '" fill="#111214" font-family="Inter" font-size="12.5">fender edge</text>';

    // the measurement
    var outX = hubX + g.outerFromFace * PPI_TOP;
    var col = g.poke > 0.4 ? "#a35a00" : (g.poke > -0.5 ? "#1f6fe0" : "#1f7a4d");
    var dimY = midY + 186, a = Math.min(fendX, outX), b2 = Math.max(fendX, outX);
    s += svg("line", { x1: fendX, y1: midY + 156, x2: fendX, y2: dimY + 6, stroke: col, "stroke-width": 1, "stroke-opacity": ".6" });
    s += svg("line", { x1: outX, y1: midY + 156, x2: outX, y2: dimY + 6, stroke: col, "stroke-width": 1, "stroke-opacity": ".6" });
    s += svg("line", { x1: a, y1: dimY, x2: b2, y2: dimY, stroke: col, "stroke-width": 3 });
    s += '<text x="' + ((a + b2) / 2) + '" y="' + (dimY + 22) + '" text-anchor="middle" fill="' + col +
         '" font-family="Inter" font-size="13">' + esc(F.pokeText(g, !!v.measured)) + '</text>';

    $("#svgTop").setAttribute("viewBox", "0 0 " + W + " " + H);
    $("#svgTop").innerHTML = s;
  }

  function render() {
    if (!S.wheel) return;
    var g = currentGeom();
    var st = F.stance(g);

    $("#vDiaV").textContent = S.dia + '"';
    $("#vWidV").textContent = S.wid + '"';
    $("#vOffV").textContent = (S.offset > 0 ? "+" : "") + S.offset + "mm";
    $("#vLiftV").textContent = S.lift + '"';
    $("#vTireV").textContent = S.tireOd + '"';

    $("#vStance").textContent = st.label;
    $("#vStance").className = "vstance vstance--" + st.key;
    $("#vPokeRead").textContent = F.pokeText(g, !!S.vehicle.measured);
    $("#vBack").textContent = g.backspacing.toFixed(2) + '"';
    $("#vSide").textContent = g.sidewall.toFixed(1) + '"';
    $("#vWheelName").textContent = S.wheel.brand + " " + S.wheel.model.model;

    drawSide();
    drawTop();
  }

  /* ---- deep link + homepage handoff ---- */
  function preselect() {
    var q = new URLSearchParams(location.search);
    var bslug = q.get("brand"), mname = q.get("model"), picked = false;
    if (bslug) {
      for (var i = 0; i < WHEELS.length; i++) {
        if (WHEELS[i].slug === bslug && (!mname || WHEELS[i].model.model === mname)) {
          $("#vBrand").value = WHEELS[i].brand;
          fillModels(WHEELS[i].brand);
          $("#vModel").value = i;
          picked = true;
          break;
        }
      }
    }
    // vehicle from the homepage finder
    try {
      var stored = JSON.parse(localStorage.getItem("drooolyVehicle") || "null");
      if (stored && window.matchVehicle) {
        var v = window.matchVehicle(stored.year, stored.make, stored.model);
        if (v) {
          S.vehicle = v;
          if (!S.touchedOffset) S.offset = v.stockOffsetMm;
          $("#vVehicle").value = VEHICLES.indexOf(v);
          $("#vFrom").textContent = "Set from your saved truck: " + stored.year + " " + stored.make + " " + stored.model;
          $("#vFrom").style.display = "";
        }
      }
    } catch (e) {}
    return picked;
  }

  buildControls();
  var pre = preselect();
  pickWheel(pre ? undefined : 0);
})();

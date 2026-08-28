/* ============================================================
   DROOOLY — single wheel page

   Clicking a wheel used to dump you on the homepage enquiry form, which told
   you nothing about the wheel you'd just clicked. This is that page: what it
   looks like, what finishes it comes in, what sizes and bolt patterns are
   real, what it costs — and at the bottom, the same wheel bolted to trucks.

   Finishes are two separate ideas and the page keeps them apart. What JTX will
   BUILD is the full list. What we can SHOW is Polished and Black Milled, since
   a finish is a different render and not a hue shift. Offering the choice is
   truthful; faking the photo isn't, so an unrendered finish says which render
   is standing in for it.
   ============================================================ */
(function () {
  var root = document.getElementById("wheelPage");
  if (!root || !window.BRANDS) return;

  var q = new URLSearchParams(location.search);
  var slug = q.get("brand"), name = q.get("model");
  var FIN = window.WHEEL_FINISHES;
  var BUILDS = window.WHEEL_BUILDS;

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var money = function (n) { return "$" + Number(n).toLocaleString("en-US"); };

  var brand = (window.BRANDS || []).filter(function (b) { return b.slug === slug; })[0];
  var model = brand && (brand.models || []).filter(function (m) { return m.model === name; })[0];

  if (!brand || !model) {
    root.innerHTML = '<section class="whead"><a class="bback" href="shop.html">← All wheels</a>' +
      "<h1>We couldn't find that wheel</h1>" +
      '<p class="whead__lead">It may have been renamed. ' +
      '<a class="blink" href="shop.html">Browse every style →</a></p></section>';
    return;
  }

  /* ---- finishes ---- */
  var art = (FIN && FIN.brandSlug === brand.slug && FIN.models[model.model]) || null;
  // What this wheel can be ordered in: the model's own list where it has one,
  // otherwise the brand programme's.
  var orderable = (model.finishes && model.finishes.length)
    ? model.finishes
    : (FIN ? FIN.finishes.map(function (f) { return f.name; }) : []);

  function finMeta(nm) {
    var f = FIN && FIN.finishes.filter(function (x) {
      return x.name.toLowerCase() === String(nm).toLowerCase(); })[0];
    return f || { code: String(nm).toLowerCase().replace(/\s+/g, "-"), name: nm, hex: "#9aa1a9" };
  }
  var options = orderable.map(function (nm) {
    var f = finMeta(nm);
    return { code: f.code, name: f.name, hex: f.hex, img: art && art[f.code] ? art[f.code] : null };
  });
  // whichever we can actually show comes first
  var initial = options.filter(function (o) { return o.img; })[0] || options[0];
  var fallbackImg = (art && (art.polished || art["black-milled"])) || model.img;

  var state = { finish: initial };

  /* ---- specs ---- */
  function parseSizes() {
    var dia = [], byDia = {};
    (model.sizes || []).forEach(function (s) {
      var m = String(s).match(/^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)$/);
      if (!m) { var d = parseFloat(s); if (!isNaN(d) && dia.indexOf(d) < 0) dia.push(d); return; }
      var d2 = parseFloat(m[1]), w = parseFloat(m[2]);
      if (dia.indexOf(d2) < 0) dia.push(d2);
      (byDia[d2] = byDia[d2] || []).push(w);
    });
    dia.sort(function (a, b) { return a - b; });
    Object.keys(byDia).forEach(function (k) {
      byDia[k] = byDia[k].filter(function (v, i, a) { return a.indexOf(v) === i; })
        .sort(function (a, b) { return a - b; });
    });
    return { dia: dia, byDia: byDia };
  }
  var sizes = parseSizes();

  var CFG = { single: "Single", dually: "Dually", "super single": "Super single" };
  function configs() {
    return (model.configs || []).map(function (c) { return CFG[c] || c; });
  }

  function priceBlock() {
    if (brand.pricing === "from" && typeof model.priceFrom === "number" && model.priceFrom > 0) {
      var set = model.priceSet && model.priceSetQty
        ? '<small>Set of ' + model.priceSetQty + " from " + money(model.priceSet) + "</small>"
        : "";
      return '<p class="wprice">From <b>' + money(model.priceFrom) + "</b> <i>/ wheel</i>" + set + "</p>";
    }
    return '<p class="wprice wprice--quote">Priced on request</p>';
  }

  function specRow(label, value) {
    if (!value) return "";
    return '<div class="wspec"><span>' + esc(label) + "</span><b>" + value + "</b></div>";
  }

  /* ---- builds strip ----
     JTX only for now, and only above the photo floor. Everything else gets no
     strip rather than a link into an empty gallery. */
  function buildsStrip() {
    if (!BUILDS || BUILDS.brandSlug !== brand.slug) return "";
    var shots = (BUILDS.models && BUILDS.models[model.model]) || [];
    if (shots.length < BUILDS.minPhotos) return "";
    var thumbs = shots.slice(0, 4).map(function (s) {
      return '<img src="' + esc(s.url) + '" alt="' + esc(brand.name + " " + model.model + " on " +
        (s.vehicle || "a truck")) + '" loading="lazy" />';
    }).join("");
    return '<section class="wbuilds">' +
      '<a class="wbuilds__link" href="builds.html?model=' + encodeURIComponent(model.model) + '">' +
      '<div class="wbuilds__thumbs">' + thumbs + "</div>" +
      '<div class="wbuilds__copy"><b>See this wheel on ' + shots.length + " real trucks</b>" +
      "<span>A render shows you the spoke pattern. This shows you what it looks like " +
      "bolted on, at ride height, in daylight. →</span></div></a></section>";
  }

  /* ---- render ---- */
  function paint() {
    var img = state.finish.img || fallbackImg;
    var standIn = !state.finish.img;

    root.innerHTML =
      '<section class="whead"><a class="bback" href="brand.html?brand=' + esc(brand.slug) + '">← All ' +
        esc(brand.name) + " wheels</a></section>" +

      '<div class="wgrid">' +
        '<div class="wmedia">' +
          '<div class="wmedia__stage"><img id="wImg" src="' + esc(img) + '" alt="' +
            esc(brand.name + " " + model.model + " — " + state.finish.name) + '" /></div>' +
          (standIn
            ? '<p class="vnote vnote--flag">Shown in ' +
              esc((options.filter(function (o) { return o.img; })[0] || { name: "Polished" }).name) +
              ". We don't hold a photo of this style in " + esc(state.finish.name) +
              " — JTX build it, and we'll send you a real one before you commit.</p>"
            : "") +
          '<div class="wfin" id="wFin"></div>' +
        "</div>" +

        '<div class="winfo">' +
          '<p class="weyebrow">' + esc(brand.name) + "</p>" +
          "<h1>" + esc(model.model) + "</h1>" +
          priceBlock() +
          '<div class="wspecs">' +
            specRow("Finish", esc(state.finish.name)) +
            specRow("Configurations", esc(configs().join(" · "))) +
            specRow("Diameters", sizes.dia.map(function (d) { return d + '"'; }).join(" · ")) +
            specRow("Widths", (function () {
              var all = [];
              Object.keys(sizes.byDia).forEach(function (k) {
                sizes.byDia[k].forEach(function (w) { if (all.indexOf(w) < 0) all.push(w); });
              });
              return all.sort(function (a, b) { return a - b; })
                .map(function (w) { return w + '"'; }).join(" · ");
            })()) +
            specRow("Bolt patterns", esc(((model.bolts && model.bolts.length ? model.bolts : brand.bolts) || []).join(" · "))) +
          "</div>" +
          '<p class="wnote">Forged to order and drilled to your truck. Sizes shown are what ' +
            esc(brand.name) + " publishes for this style — we confirm the exact build with them before anything is cut.</p>" +
          '<div class="wcta">' +
            '<a class="btn btn--chrome" href="index.html?w=' +
              encodeURIComponent(brand.name + " " + model.model) + '#fitment">' +
              '<span class="btn-txt">Get this wheel quoted</span></a>' +
          "</div>" +
        "</div>" +
      "</div>" +
      buildsStrip();

    // finish swatches
    var host = root.querySelector("#wFin");
    options.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "wsw" + (o === state.finish ? " on" : "") + (o.img ? "" : " wsw--noart");
      b.title = o.name + (o.img ? "" : " — no photo held");
      b.setAttribute("aria-label", o.name);
      b.innerHTML = '<i style="background:' + (o.hex || "linear-gradient(135deg,#c7ccd2,#6f767e)") +
        '"></i><span>' + esc(o.name) + "</span>";
      b.onclick = function () { state.finish = o; paint(); };
      host.appendChild(b);
    });
  }

  paint();
  document.title = brand.name + " " + model.model + " — DROOOLY Wheel Co.";
})();

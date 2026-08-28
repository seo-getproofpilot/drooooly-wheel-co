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
  var slug = q.get("brand"), name = q.get("model"), series = q.get("series");
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

  /* ---- finishes ----
     Only the finishes we hold a real render for get a swatch. A finish is a
     different casting, not a hue shift, so a swatch that can't change the photo
     is a dead control — better to show the two that work and mention the rest
     as options in words. */
  /* Which series' renders to show. A style can exist as a single AND as a
     dually with different art, so the link carries which one was clicked; fall
     back to whichever we hold. */
  function artFor(k) {
    return (FIN && FIN.brandSlug === brand.slug && FIN.series &&
            FIN.series[k] && FIN.series[k][model.model]) || null;
  }
  var activeSeries = (series && artFor(series)) ? series
    : (artFor("single") ? "single" : (artFor("dually") ? "dually" : null));
  var art = activeSeries ? artFor(activeSeries) : null;

  function finMeta(nm) {
    var f = FIN && FIN.finishes.filter(function (x) {
      return x.name.toLowerCase() === String(nm).toLowerCase(); })[0];
    return f || { code: String(nm).toLowerCase().replace(/\s+/g, "-"), name: nm, hex: "#9aa1a9" };
  }

  var options = [];
  if (art && FIN) {
    FIN.finishes.forEach(function (f) {
      if (art[f.code]) options.push({ code: f.code, name: f.name, hex: f.hex, img: art[f.code], note: f.note });
    });
  } else if (model.imgs && model.imgs.length) {
    model.imgs.forEach(function (v) {
      var f = finMeta(v.finish);
      options.push({ code: f.code, name: v.finish, hex: f.hex, img: v.img });
    });
  }
  if (!options.length) {
    var first = (model.finishes && model.finishes[0]) || "Polished";
    var fm = finMeta(first);
    options.push({ code: fm.code, name: first, hex: fm.hex, img: model.img });
  }

  /* Everything the brand will build beyond what we can show, phrased as more
     choice — which is what it is. */
  var shownNames = options.map(function (o) { return o.name.toLowerCase(); });
  var extraFinishes = ((FIN && FIN.orderable) || model.finishes || [])
    .filter(function (nm) { return shownNames.indexOf(String(nm).toLowerCase()) < 0; });

  /* If a style comes both ways, offer the other one rather than stranding
     someone on the single when they drive a dually. */
  var otherSeries = null;
  if (activeSeries === "single" && artFor("dually")) otherSeries = "dually";
  else if (activeSeries === "dually" && artFor("single")) otherSeries = "single";

  var state = { finish: options[0] };

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

  /* The pattern itself, not a list of makes. Anyone shopping forged wheels
     knows their bolt pattern; translating it into "Ford · Chevy/GMC · Ram"
     costs a line and tells them less than the number they came with. */
  function boltPatterns() {
    var bolts = (model.bolts && model.bolts.length) ? model.bolts : (brand.bolts || []);
    return bolts.join(" · ");
  }

  /* Widths belong UNDER their diameter, not in a separate list. Centerfire
     comes 22x12 but 28x8.25 only — two flat lists quietly advertise a 28x16
     that nobody builds. Same trap as the offsets. */
  function sizeRows() {
    var rows = [];
    sizes.dia.forEach(function (d) {
      var w = sizes.byDia[d] || [];
      rows.push({ dia: d, widths: w });
    });
    return rows;
  }

  var CFG = { single: "Single", dually: "Dually", "super single": "Super single" };
  function configs() {
    return (model.configs || []).map(function (c) { return CFG[c] || c; });
  }

  function priceBlock() {
    if (brand.pricing === "from" && typeof model.priceFrom === "number" && model.priceFrom > 0) {
      /* Six wheels on a dually, and the stored set price is for four. Don't
         restate a total that doesn't apply to what is being looked at. */
      var set = activeSeries === "dually"
        ? '<small>Six-wheel set, quoted to your truck</small>'
        : (model.priceSet && model.priceSetQty
            ? '<small>Set of ' + model.priceSetQty + " from " + money(model.priceSet) + "</small>"
            : "");
      return '<p class="wprice">From <b>' + money(model.priceFrom) + "</b> <i>/ wheel</i>" + set + "</p>";
    }
    return '<p class="wprice wprice--quote">Priced on request</p>';
  }

  function specRow(label, value) {
    if (!value) return "";
    return '<div class="wspec"><span>' + esc(label) + "</span><b>" + value + "</b></div>";
  }

  /* ---- builds, shown inline ----
     No click-through. If the point is reassurance, making someone navigate for
     it defeats the point — put the trucks on the page. JTX only for now, and
     still gated on the photo floor. */
  function buildsSection() {
    if (!BUILDS || BUILDS.brandSlug !== brand.slug) return "";
    var shots = (BUILDS.models && BUILDS.models[model.model]) || [];
    if (shots.length < BUILDS.minPhotos) return "";
    var show = shots.slice(0, 6);
    var more = shots.length - show.length;
    return '<section class="wbuilds">' +
      '<div class="wbuilds__head"><h2>' + esc(model.model) + " on real builds</h2>" +
      "<p>A render shows you the spoke pattern. These show the same wheel bolted on — " +
      "at ride height, in daylight, on trucks people actually drive.</p></div>" +
      '<div class="wbuilds__grid">' + show.map(function (s2) {
        var cap = [s2.vehicle, s2.size, s2.finish].filter(Boolean).join(" · ");
        return '<a class="wbshot" href="' + esc(s2.url) + '" target="_blank" rel="noopener">' +
          '<img src="' + esc(s2.url) + '" alt="' + esc(brand.name + " " + model.model + " on " +
            (s2.vehicle || "a truck")) + '" loading="lazy" />' +
          (cap ? '<span class="wbshot__cap">' + esc(cap) + "</span>" : "") + "</a>";
      }).join("") + "</div>" +
      (more > 0
        ? '<a class="wbuilds__all" href="builds.html?model=' + encodeURIComponent(model.model) +
          '">See more →</a>'
        : "") +
      '<p class="wbuilds__credit">Photos by ' + esc(brand.name) + ".</p>" +
      "</section>";
  }

  /* ---- render ---- */
  function paint() {
    root.innerHTML =
      '<a class="wback" href="brand.html?brand=' + esc(brand.slug) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>' +
        "<span>All " + esc(brand.name) + " wheels</span></a>" +

      '<div class="wgrid">' +
        '<div class="wmedia">' +
          '<div class="wmedia__stage' + (activeSeries === "dually" ? " wmedia__stage--pair" : "") +
            '"><img id="wImg" src="' + esc(state.finish.img) + '" alt="' +
            esc(brand.name + " " + model.model + " — " + state.finish.name) + '" /></div>' +
          '<div class="wfin" id="wFin"></div>' +
        "</div>" +

        '<div class="winfo">' +
          '<p class="weyebrow">' + esc(brand.name) +
            (activeSeries ? " · " + (activeSeries === "dually" ? "Dually Series" : "Single Series") : "") + "</p>" +
          "<h1>" + esc(model.model) + "</h1>" +
          (activeSeries === "dually"
            ? '<p class="wseriesnote">Front and rear wheel shown. A dually set is six wheels.</p>' : "") +
          (otherSeries
            ? '<a class="wswitch" href="wheel.html?brand=' + esc(brand.slug) + "&model=" +
              encodeURIComponent(model.model) + "&series=" + otherSeries + '">' + (otherSeries === "dually"
                ? "Also built for dual-rear trucks — see the front and rear pair"
                : "Also built as a single wheel") + " →</a>"
            : "") +
          priceBlock() +
          '<div class="wspecs">' +
            specRow("Finish", esc(state.finish.name)) +
          "</div>" +
          (state.finish.note ? '<p class="wfinnote">' + esc(state.finish.note) + "</p>" : "") +
          '<div class="wspecs wspecs--rest">' +
            /* One row per diameter, so what you read is what JTX will cut. */
            '<div class="wspec wspec--sizes"><span>Sizes</span><b>' +
              sizeRows().map(function (r) {
                return '<span class="wsize"><i>' + r.dia + '"</i>' +
                  (r.widths.length
                    ? r.widths.map(function (w) { return w + '"'; }).join(" · ")
                    : "width confirmed at quote") + "</span>";
              }).join("") +
            "</b></div>" +
            specRow("Built as", esc(configs().join(" · "))) +
            /* A six-pattern list has no business being squeezed into a right
               hand column — it wraps and orphans. Own line, label above. */
            '<div class="wspec wspec--wide"><span>Bolt patterns</span><b>' +
              esc(boltPatterns()) + "</b></div>" +
          "</div>" +

          /* Extra finishes read as more choice, not as a gap. */
          (extraFinishes.length
            ? '<div class="wextra"><b>More finishes to order</b>' +
              "<p>" + esc(model.model) + " is also built in " +
              esc(extraFinishes.slice(0, -1).join(", ")) +
              (extraFinishes.length > 1 ? " and " : "") +
              esc(extraFinishes[extraFinishes.length - 1]) +
              ". Mention it when you get quoted and we'll spec it with " + esc(brand.name) + ".</p></div>"
            : "") +

          '<p class="wnote">Forged to order in your size, width and bolt pattern. ' +
            "Everything above is what " + esc(brand.name) + " publishes for this style — " +
            "we confirm the build with them before anything is cut.</p>" +
          '<div class="wcta">' +
            '<a class="btn btn--chrome" href="index.html?w=' +
              encodeURIComponent(brand.name + " " + model.model) + '#fitment">' +
              '<span class="btn-txt">Get this wheel quoted</span></a>' +
          "</div>" +
        "</div>" +
      "</div>" +
      buildsSection();

    var host = root.querySelector("#wFin");
    if (options.length < 2) { host.style.display = "none"; return; }
    options.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "wsw" + (o === state.finish ? " on" : "");
      b.title = o.name;
      b.setAttribute("aria-label", o.name);
      b.innerHTML = '<i style="background:' + (o.hex || "#9aa1a9") + '"></i><span>' + esc(o.name) + "</span>";
      // hover previews, click commits — same feel as the wheel grid
      b.onmouseenter = function () { root.querySelector("#wImg").src = o.img; };
      b.onclick = function () { state.finish = o; paint(); };
      host.appendChild(b);
    });
    host.onmouseleave = function () { root.querySelector("#wImg").src = state.finish.img; };
  }

  paint();
  document.title = brand.name + " " + model.model + " — DROOOLY Wheel Co.";
})();

/* ============================================================
   DROOOLY Wheel & Tire — JTX Forged sales page
   Reads the same data the rest of the site does: brands.js for the
   154 JTX models, finishes.js for JTX's own renders. Nothing about a
   wheel is typed into this file, so the page cannot drift from the
   catalog.

   URL params (so each ad lands on its own angle):
     ?angle=dually | super-single | lifted   swaps the hero
     ?config=single | dually | super-single  preselects the builder
     ?style=<Model>                          preselects a style
   ============================================================ */
(function () {
  var BRAND = (window.BRANDS || []).filter(function (b) { return b.slug === "jtx"; })[0];
  var FIN = window.WHEEL_FINISHES || { series: {}, finishes: [], orderable: [] };
  if (!BRAND) return;
  var MODELS = BRAND.models;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function qs(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } }
  function $(id) { return document.getElementById(id); }

  /* ---------- configurations ----------
     A size belongs to a configuration by its width: 8.25" is the dually
     width, anything 10" and up on a dually-capable style is a super single. */
  var CONFIGS = {
    "single": {
      key: "single", label: "Single rear wheel", short: "Single", series: "single", qty: 4,
      fits: function (m) { return m.configs.indexOf("single") > -1; },
      size: function (w) { return w >= 10; }
    },
    "dually": {
      key: "dually", label: "Dually", short: "Dually", series: "dually", qty: 6,
      fits: function (m) { return m.configs.indexOf("dually") > -1; },
      size: function (w) { return w === 8.25; }
    },
    "super single": {
      key: "super single", label: "Super single", short: "Super single", series: "dually", qty: 4,
      fits: function (m) { return m.configs.indexOf("super single") > -1; },
      size: function (w) { return w >= 10; }
    }
  };
  function cfgFromParam(v) {
    if (!v) return null;
    v = v.replace(/-/g, " ").toLowerCase();
    return CONFIGS[v] ? v : null;
  }

  /* Commonly run offsets, from data/specs/offsets.json. These describe what
     people run, not a promise of what fits a given truck. */
  var OFFSET = { "12": "around ET-44", "14": "around ET-76", "16": "around ET-101", "8.25": "around ET+110 to +130 on the rear pair" };

  function parseSize(s) { var p = s.split("x"); return { d: +p[0], w: +p[1], raw: s }; }
  function sizesFor(m, cfg) {
    return m.sizes.map(parseSize).filter(function (z) { return CONFIGS[cfg].size(z.w); });
  }
  function renderFor(m, cfg, finishCode) {
    var series = FIN.series[CONFIGS[cfg].series] || {};
    var art = series[m.model];
    if (art) return art[finishCode] || art.polished || art["black-milled"];
    // a single-series style can still borrow its dually art and vice versa
    var other = FIN.series[CONFIGS[cfg].series === "single" ? "dually" : "single"] || {};
    if (other[m.model]) return other[m.model][finishCode] || other[m.model].polished;
    return m.img || "assets/wheel-placeholder.svg";
  }
  function hasArt(m, cfg) { var ser = FIN.series[CONFIGS[cfg].series] || {}; return ser[m.model] ? 1 : 0; }
  function stylesFor(cfg) {
    return MODELS.filter(function (m) { return CONFIGS[cfg].fits(m) && sizesFor(m, cfg).length; })
      // styles with JTX's own series render first, so the grid opens on matching art
      .sort(function (a, b) { return hasArt(b, cfg) - hasArt(a, cfg) || (a.feat || 999) - (b.feat || 999) || a.model.localeCompare(b.model); });
  }
  function priceLine(m, cfg) {
    if (!m.priceFrom) return "Priced on request";
    var line = "From " + money(m.priceFrom) + " / wheel";
    if (cfg === "single" && m.priceSet) line += " · set of 4 from " + money(m.priceSet);
    return line;
  }

  /* ---------- counts used in the copy ---------- */
  function fillCounts() {
    var total = MODELS.length;
    var bySeries = {};
    Object.keys(CONFIGS).forEach(function (k) { bySeries[k] = stylesFor(k).length; });
    document.querySelectorAll("[data-count]").forEach(function (el) {
      var k = el.getAttribute("data-count");
      el.textContent = k === "all" ? total : (bySeries[k.replace(/-/g, " ")] || 0);
    });
  }

  /* ---------- hero angles (ad-to-page match) ---------- */
  var ANGLES = {
    "dually": {
      eyebrow: "JTX Forged dually wheels · front and rear, built as a set",
      title: 'Six forged JTX wheels for your <span class="accent">dually</span>, built to your truck',
      sub: "Pick a style, a diameter from 22 to 30 inches and a finish. We confirm the front and rear specs with JTX before they cut a thing.",
      img: "https://jtxforged.com/wp-content/uploads/2020/03/2020-F350-Dually-King-Ranch-24-inch-Flight-Dually-JTX-Forged-Wheels.jpg",
      alt: "2020 Ford F-350 King Ranch dually on 24-inch JTX Forged Flight wheels",
      cap: "2020 F-350 King Ranch · 24\" JTX Flight dually",
      config: "dually"
    },
    "super-single": {
      eyebrow: "JTX Forged super singles · four wide wheels on a dually",
      title: 'Turn your dually into a <span class="accent">super single</span> on four forged JTX wheels',
      sub: "JTX cut super singles in 10 to 16 inch widths for dual-rear-wheel trucks. Pick the style and the stance, and we spec the offsets with JTX before anything is machined.",
      img: "https://jtxforged.com/wp-content/uploads/2020/03/F450-Dually-Black-24-inch-Flight-JTX-Forged-Wheels.jpg",
      alt: "Black Ford F-450 on JTX Forged wheels outside a wheel shop",
      cap: "F-450 · JTX Flight",
      config: "super single"
    },
    "lifted": {
      eyebrow: "JTX Forged single-series wheels · 20 to 30 inches",
      title: 'Forged JTX wheels in <span class="accent">26x14</span> and beyond, cut for your lifted truck',
      sub: "Pick a style, a size from 20x10 to 30x16 and a finish. We confirm the bolt pattern and offset with JTX before they machine your set.",
      img: "https://jtxforged.com/wp-content/uploads/2020/03/2019-F350-26x14-Silencer-JTX-Forged-Wheels-scaled.jpeg",
      alt: "Lifted 2019 Ford F-350 on 26x14 JTX Forged Silencer wheels",
      cap: "2019 F-350 · 26x14 JTX Silencer",
      config: "single"
    }
  };
  function applyAngle() {
    var a = ANGLES[(qs("angle") || "").toLowerCase()];
    if (!a) return;
    $("heroEyebrow").textContent = a.eyebrow;
    $("heroTitle").innerHTML = a.title;
    $("heroSub").textContent = a.sub;
    var img = $("heroImg"); img.src = a.img; img.alt = a.alt;
    $("heroCap").textContent = a.cap;
    if (!cfgFromParam(qs("config"))) state.config = a.config;
  }

  /* ---------- configuration cards ---------- */
  function renderConfigCards() {
    var host = $("cfgCards"); if (!host) return;
    host.querySelectorAll("[data-pick-config]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setConfig(btn.getAttribute("data-pick-config").replace(/-/g, " "));
        $("build").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ---------- curated lineup (tabs) ---------- */
  var LINEUP_N = 8;
  function renderLineup(cfg) {
    var host = $("lineupGrid"); if (!host) return;
    document.querySelectorAll("#lineupTabs [role=tab]").forEach(function (t) {
      var on = t.getAttribute("data-cfg").replace(/-/g, " ") === cfg;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    var list = stylesFor(cfg).slice(0, LINEUP_N);
    host.innerHTML = list.map(function (m) {
      var sz = sizesFor(m, cfg).map(function (z) { return z.d; });
      var lo = Math.min.apply(null, sz), hi = Math.max.apply(null, sz);
      return '<article class="jl-card">' +
        '<div class="jl-card__art" data-model="' + esc(m.model) + '">' +
          '<img src="' + esc(renderFor(m, cfg, "polished")) + '" alt="JTX Forged ' + esc(m.model) + ' ' + esc(CONFIGS[cfg].label.toLowerCase()) + ' wheel, polished" loading="lazy" />' +
        "</div>" +
        '<div class="jl-card__body">' +
          '<div class="jl-swatches" role="group" aria-label="Finish preview">' +
            '<button type="button" class="jl-sw jl-sw--pol is-on" data-fin="polished" aria-label="Polished" aria-pressed="true"></button>' +
            '<button type="button" class="jl-sw jl-sw--blk" data-fin="black-milled" aria-label="Black Milled" aria-pressed="false"></button>' +
          "</div>" +
          "<h3>" + esc(m.model) + "</h3>" +
          '<p class="jl-card__spec">' + lo + "–" + hi + '" · ' + esc(CONFIGS[cfg].short) + "</p>" +
          '<p class="jl-card__price">' + esc(priceLine(m, cfg)) + "</p>" +
          '<button type="button" class="jl-card__go" data-build="' + esc(m.model) + '">Build this set <span aria-hidden="true">→</span></button>' +
        "</div>" +
      "</article>";
    }).join("");

    host.querySelectorAll(".jl-card").forEach(function (card) {
      var model = card.querySelector(".jl-card__art").getAttribute("data-model");
      var m = MODELS.filter(function (x) { return x.model === model; })[0];
      var img = card.querySelector("img");
      card.querySelectorAll(".jl-sw").forEach(function (sw) {
        sw.addEventListener("click", function () {
          card.querySelectorAll(".jl-sw").forEach(function (o) { o.classList.remove("is-on"); o.setAttribute("aria-pressed", "false"); });
          sw.classList.add("is-on"); sw.setAttribute("aria-pressed", "true");
          var code = sw.getAttribute("data-fin");
          img.src = renderFor(m, cfg, code);
          img.alt = "JTX Forged " + m.model + " wheel, " + (code === "polished" ? "polished" : "black milled");
        });
      });
      card.querySelector(".jl-card__go").addEventListener("click", function () {
        setConfig(cfg); setModel(model);
        $("build").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
  function bindLineupTabs() {
    var tabs = document.querySelectorAll("#lineupTabs [role=tab]");
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { renderLineup(t.getAttribute("data-cfg").replace(/-/g, " ")); });
      t.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        n.focus(); n.click();
      });
    });
  }

  /* ---------- the builder ---------- */
  var state = { config: "single", model: null, d: null, w: null, finish: "Polished", showAll: false };

  function setConfig(cfg) {
    if (!CONFIGS[cfg]) return;
    if (state.config !== cfg) { state.model = null; state.d = null; state.w = null; state.showAll = false; }
    state.config = cfg;
    renderBuilder();
  }
  function setModel(name) {
    var m = MODELS.filter(function (x) { return x.model === name; })[0];
    if (!m || !CONFIGS[state.config].fits(m)) return;
    state.model = name;
    var sizes = sizesFor(m, state.config);
    if (!sizes.some(function (z) { return z.d === state.d && z.w === state.w; })) { state.d = null; state.w = null; }
    renderBuilder();
  }

  function stepConfig() {
    return Object.keys(CONFIGS).map(function (k) {
      var c = CONFIGS[k], on = state.config === k;
      return '<button type="button" class="jb-opt' + (on ? " is-on" : "") + '" data-cfg="' + esc(k) + '" aria-pressed="' + on + '">' +
        "<b>" + esc(c.label) + "</b><small>" + stylesFor(k).length + " styles · set of " + c.qty + "</small></button>";
    }).join("");
  }
  function stepStyle() {
    var list = stylesFor(state.config);
    var shown = state.showAll ? list : list.slice(0, 12);
    if (state.model && shown.every(function (m) { return m.model !== state.model; })) {
      shown = shown.concat(list.filter(function (m) { return m.model === state.model; }));
    }
    var fcode = state.finish === "Black Milled" ? "black-milled" : "polished";
    var html = shown.map(function (m) {
      var on = state.model === m.model;
      return '<button type="button" class="jb-style' + (on ? " is-on" : "") + '" data-model="' + esc(m.model) + '" aria-pressed="' + on + '">' +
        '<img src="' + esc(renderFor(m, state.config, fcode)) + '" alt="" loading="lazy" />' +
        "<b>" + esc(m.model) + "</b><small>" + esc(m.priceFrom ? "from " + money(m.priceFrom) : "on request") + "</small></button>";
    }).join("");
    if (!state.showAll && list.length > 12) {
      html += '<button type="button" class="jb-more" id="jbMore">Show all ' + list.length + " " + esc(CONFIGS[state.config].short.toLowerCase()) + " styles</button>";
    }
    return html;
  }
  function stepSize() {
    if (!state.model) return '<p class="jb-hint">Pick a style first. Each one has its own size list from JTX.</p>';
    var m = MODELS.filter(function (x) { return x.model === state.model; })[0];
    var sizes = sizesFor(m, state.config);
    var dias = []; sizes.forEach(function (z) { if (dias.indexOf(z.d) < 0) dias.push(z.d); });
    dias.sort(function (a, b) { return a - b; });
    var html = '<div class="jb-row"><span class="jb-row__lbl">Diameter</span><div class="jb-chips">' +
      dias.map(function (d) {
        var on = state.d === d;
        return '<button type="button" class="jb-chip' + (on ? " is-on" : "") + '" data-d="' + d + '" aria-pressed="' + on + '">' + d + '"</button>';
      }).join("") + "</div></div>";
    if (state.d) {
      var widths = sizes.filter(function (z) { return z.d === state.d; }).map(function (z) { return z.w; }).sort(function (a, b) { return a - b; });
      html += '<div class="jb-row"><span class="jb-row__lbl">Width</span><div class="jb-chips">' +
        widths.map(function (w) {
          var on = state.w === w;
          return '<button type="button" class="jb-chip' + (on ? " is-on" : "") + '" data-w="' + w + '" aria-pressed="' + on + '">' + w + '"</button>';
        }).join("") + "</div></div>";
    }
    if (state.d && state.w) {
      var off = OFFSET[String(state.w)];
      html += '<p class="jb-note">' + (off
        ? "Trucks on " + state.d + "x" + state.w + " commonly run " + off + ". We confirm the exact offset for your truck with JTX before they cut."
        : "No reliable public offset figure exists for this width. We spec it with JTX for your truck before they cut.") + "</p>";
    }
    return html;
  }
  function stepFinish() {
    var list = FIN.orderable && FIN.orderable.length ? FIN.orderable : ["Polished", "Brushed", "Black", "Black Milled", "Chrome", "Custom"];
    return list.map(function (f) {
      var on = state.finish === f;
      var rendered = f === "Polished" || f === "Black Milled";
      return '<button type="button" class="jb-fin' + (on ? " is-on" : "") + '" data-fin="' + esc(f) + '" aria-pressed="' + on + '">' +
        '<i class="jb-fin__sw jb-fin__sw--' + esc(f.toLowerCase().replace(/\s+/g, "-")) + '"></i>' +
        "<b>" + esc(f) + "</b><small>" + (rendered ? "Shown in the preview" : "Built to order") + "</small></button>";
    }).join("");
  }

  function summary() {
    var c = CONFIGS[state.config];
    var m = state.model ? MODELS.filter(function (x) { return x.model === state.model; })[0] : null;
    var fcode = state.finish === "Black Milled" ? "black-milled" : "polished";
    var art = m ? renderFor(m, state.config, fcode) : "assets/wheel-placeholder.svg";
    var size = state.d && state.w ? state.d + "x" + state.w : "Pick a size";
    var price = "";
    if (m && m.priceFrom) {
      price = '<p class="jb-sum__price"><b>' + money(m.priceFrom) + "</b> / wheel and up</p>" +
        (state.config === "single" && m.priceSet
          ? '<p class="jb-sum__set">Set of 4 from ' + money(m.priceSet) + ". Your quote prices your exact size and finish.</p>"
          : '<p class="jb-sum__set">Set of ' + c.qty + ", quoted to your truck. Front and rear specs are confirmed with JTX first.</p>");
    } else if (m) {
      price = '<p class="jb-sum__set">Priced on your quote.</p>';
    }
    var ready = !!(m && state.d && state.w);
    return '<div class="jb-sum__art"><img src="' + esc(art) + '" alt="' + (m ? "JTX Forged " + esc(m.model) + " preview" : "") + '" /></div>' +
      '<p class="jb-sum__kicker">Your JTX set</p>' +
      "<h3>" + (m ? esc(m.model) : "Pick a style") + "</h3>" +
      "<dl>" +
        "<div><dt>Setup</dt><dd>" + esc(c.label) + " · set of " + c.qty + "</dd></div>" +
        "<div><dt>Size</dt><dd>" + esc(size) + "</dd></div>" +
        "<div><dt>Finish</dt><dd>" + esc(state.finish) + "</dd></div>" +
      "</dl>" + price +
      '<a href="#quote" class="btn btn--primary btn--block jb-sum__cta' + (ready ? "" : " is-wait") + '"><span class="btn-txt">' +
        (ready ? "Get my JTX quote" : "Finish your picks") + "</span></a>";
  }

  function buildString() {
    if (!state.model) return "";
    return "JTX " + state.model + " · " + CONFIGS[state.config].label +
      (state.d && state.w ? " · " + state.d + "x" + state.w : "") + " · " + state.finish +
      " · set of " + CONFIGS[state.config].qty;
  }

  function renderBuilder() {
    if (!$("jbConfig")) return;
    $("jbConfig").innerHTML = stepConfig();
    $("jbStyle").innerHTML = stepStyle();
    $("jbSize").innerHTML = stepSize();
    $("jbFinish").innerHTML = stepFinish();
    $("jbSummary").innerHTML = summary();
    var field = $("quoteBuild");
    if (field) field.value = buildString();
    var mob = $("jbMobileSum");
    if (mob) mob.textContent = state.model ? buildString() : "Pick a style to start";

    $("jbConfig").querySelectorAll("[data-cfg]").forEach(function (b) {
      b.addEventListener("click", function () { setConfig(b.getAttribute("data-cfg")); });
    });
    $("jbStyle").querySelectorAll("[data-model]").forEach(function (b) {
      b.addEventListener("click", function () { setModel(b.getAttribute("data-model")); });
    });
    var more = $("jbMore");
    if (more) more.addEventListener("click", function () { state.showAll = true; renderBuilder(); });
    $("jbSize").querySelectorAll("[data-d]").forEach(function (b) {
      b.addEventListener("click", function () { state.d = +b.getAttribute("data-d"); state.w = null; renderBuilder(); });
    });
    $("jbSize").querySelectorAll("[data-w]").forEach(function (b) {
      b.addEventListener("click", function () { state.w = +b.getAttribute("data-w"); renderBuilder(); });
    });
    $("jbFinish").querySelectorAll("[data-fin]").forEach(function (b) {
      b.addEventListener("click", function () { state.finish = b.getAttribute("data-fin"); renderBuilder(); });
    });
  }

  /* ---------- real builds strip (JTX's own gallery) ---------- */
  function renderBuilds() {
    var host = $("buildStrip"); if (!host) return;
    var data = window.WHEEL_BUILDS;
    if (!data || !data.lanes) return;
    var photos = [];
    Object.keys(data.lanes).forEach(function (k) {
      var lane = data.lanes[k];
      if (lane.source === "gallery") photos = photos.concat(lane.photos);
    });
    var picked = [], seen = {};
    // one per model first, so the strip shows range rather than ten Silencers
    photos.forEach(function (p) { if (!seen[p.model] && p.vehicle) { seen[p.model] = 1; picked.push(p); } });
    photos.forEach(function (p) { if (picked.length < 12 && picked.indexOf(p) < 0 && p.vehicle) picked.push(p); });
    host.innerHTML = picked.slice(0, 12).map(function (p) {
      var cap = p.vehicle + (p.size ? " · " + p.size : "") + " · " + p.model + (p.finish ? " " + p.finish.toLowerCase() : "");
      return '<figure class="jx-build"><img src="' + esc(p.url) + '" alt="' + esc(p.vehicle + " on JTX Forged " + p.model + " wheels") +
        '" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest(\'figure\').remove()" />' +
        "<figcaption>" + esc(cap) + "</figcaption></figure>";
    }).join("");
  }

  /* ---------- quote form ---------- */
  function bindQuote() {
    var form = $("quoteForm"), ok = $("quoteOk");
    if (!form) return;
    /* The visualizer hands its build over as /jtx.html#quote?build=... so the
       customer lands on the form with the set they just looked at filled in. */
    var hq = (location.hash.split("?")[1] || "");
    var handed = hq ? new URLSearchParams(hq).get("build") : null;
    if (handed && $("quoteBuild") && !$("quoteBuild").value) $("quoteBuild").value = handed;
    /* The hash is "#quote?build=...", so the browser finds no element to jump
       to. Put the form in view ourselves. */
    if (handed && $("quote")) setTimeout(function () { $("quote").scrollIntoView({ block: "start" }); }, 0);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (ok) ok.hidden = false;
      form.querySelector("button[type=submit] .btn-txt").textContent = "Sent";
    });
  }

  /* ---------- sticky mobile bar ---------- */
  function bindSticky() {
    var bar = $("jxSticky"), hero = document.querySelector(".jx-hero"), quote = $("quote");
    if (!bar || !hero || !("IntersectionObserver" in window)) return;
    var pastHero = false, atQuote = false;
    function sync() { bar.classList.toggle("is-on", pastHero && !atQuote); }
    new IntersectionObserver(function (es) { pastHero = !es[0].isIntersecting; sync(); }).observe(hero);
    if (quote) new IntersectionObserver(function (es) { atQuote = es[0].isIntersecting; sync(); }, { threshold: 0.15 }).observe(quote);
  }

  /* ---------- boot ---------- */
  var pc = cfgFromParam(qs("config"));
  if (pc) state.config = pc;
  applyAngle();
  var ps = qs("style");
  fillCounts();
  renderConfigCards();
  bindLineupTabs();
  renderLineup(state.config);
  renderBuilder();
  if (ps) setModel(ps);
  renderBuilds();
  bindQuote();
  bindSticky();
  if (window.__observeFades) window.__observeFades();
})();

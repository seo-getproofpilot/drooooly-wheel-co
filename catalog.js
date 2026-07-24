/* ============================================================
   DROOOLY Wheel Co. — storefront catalog
   ============================================================ */
(function () {
  var BRANDS = window.BRANDS || [];
  var bySlug = {}; BRANDS.forEach(function (b) { bySlug[b.slug] = b; });

  var LOGO = {
    "jtx":"jtx.png","american-force":"american-force.svg","kg1":"kg1.png","fuel":"fuel.svg","hostile":"hostile.png",
    "amani":"amani.png","fenix":"fenix.jpg","liberty":"liberty.png","axe":"axe.png","tis":"tis.webp","vision":"vision.png",
    "fittipaldi":"fittipaldi.png","arkon":"arkon.png","cali":"cali.png","hardrock":"hardrock.png","hardcore":"hardcore.png",
    "xf":"xf.png","method":"method.png","kmc":"kmc.svg","raceline":"raceline.png","black-rhino":"black-rhino.svg"
  };
  // white-card treatment: white-art logos → solid black; black-bg logos → dark chip
  var FX = { "jtx":"blogo--dark","amani":"blogo--dark","arkon":"blogo--dark","xf":"blogo--dark",
    "kmc":"blogo--dark","black-rhino":"blogo--dark","liberty":"blogo--dark",
    "fenix":"blogo--chip","fittipaldi":"blogo--chip","fuel":"blogo--chip","vision":"blogo--chip" };
  function logoSrc(b) { return "assets/brands/" + (LOGO[b.slug] || (b.slug + ".png")); }
  function logoFx(b) { return FX[b.slug] || ""; }

  var CONFIG_ORDER = ["single", "dually", "super single"];
  function cfgLabel(c) { return { "single":"Single","dually":"Dually","super single":"Super Single" }[c] || c; }
  function cfgKey(c) { return c.replace(/\s+/g, "-"); }
  function money(n) { return "$" + n.toLocaleString("en-US"); }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
  function maxDia(m) { var d = 0; m.sizes.forEach(function (s) { var n = parseInt(s, 10); if (n > d) d = n; }); return d || 22; }
  function minDia(m) { var d = 99; m.sizes.forEach(function (s) { var n = parseInt(s, 10); if (n < d) d = n; }); return d === 99 ? 22 : d; }
  function isDually(m) { return m.configs.indexOf("dually") > -1 || m.configs.indexOf("super single") > -1; }

  // Per-wheel pricing calibrated to real authorized-dealer forged pricing
  // (e.g. JTX dually sets run $8,062–$17,866 for 6 wheels, 20"–30").
  function priceEach(brand, m) {
    var d = minDia(m); // starting ("from") price — smallest diameter offered
    var forged = brand.kind === "Forged";
    var base = forged ? 1290 : (/HD|Dually/.test(brand.kind) ? 430 : 340);
    var step = forged
      ? (d <= 22 ? (d - 20) * 55 : d <= 26 ? 110 + (d - 22) * 105 : 530 + (d - 26) * 230)
      : Math.max(0, (d - 20)) * 45;
    var jit = (hash(brand.slug + m.model) % 10) * 15;
    return Math.round((base + step + jit) / 5) * 5;
  }
  // duallies sell as 6 (4 rear + 2 front); everything else as a set of 4
  function setQty(m) { return isDually(m) ? 6 : 4; }
  function rating(brand, m) { var h = hash(m.model + brand.slug); var v = (43 + (h % 8)) / 10; return { v: v.toFixed(1), n: 6 + (h % 150) }; }
  function thumb(m) { return m.img || "assets/wheel-face-1.png"; }

  // ---- media ----
  function finishVariant(m) {
    var f = (m.finishes[0] || "").toLowerCase();
    if (/black|satin|matte|asphalt|anthracite/.test(f)) return " is-black";
    if (/bronze/.test(f)) return " is-bronze";
    if (/chrome/.test(f)) return " is-chrome";
    return "";
  }
  function emblem(brand, m) {
    return '<span class="emblem' + finishVariant(m) + '" aria-hidden="true"><span class="emblem__lip"></span><span class="emblem__disc"></span><span class="emblem__cap"></span></span><span class="emblem__wm">' + brand.name + '</span>';
  }
  function badges(m) { return m.configs.map(function (c) { return '<span class="cfg cfg--' + cfgKey(c) + '">' + cfgLabel(c) + '</span>'; }).join(""); }
  function esc(s) { return String(s).replace(/"/g, "&quot;"); }

  // ---- product card ----
  function productCard(brand, m, tag) {
    var p = priceEach(brand, m), r = rating(brand, m);
    var mediaInner = m.img
      ? '<img src="' + m.img + '" alt="' + brand.name + ' ' + m.model + '" loading="lazy">'
      : emblem(brand, m);
    var key = brand.slug + "|" + m.model;
    return '<article class="prod fade">' +
      '<div class="prod__media' + (m.img ? '' : ' pkg__media--emblem') + '">' +
        (tag ? '<span class="prod__tag">' + tag + '</span>' : '') +
        '<button class="prod__fav" aria-label="Save"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></button>' +
        mediaInner +
      '</div>' +
      '<div class="prod__body">' +
        '<div class="prod__brand">' + brand.name + '</div>' +
        '<h3 class="prod__name">' + m.model + '</h3>' +
        '<div class="prod__rate"><span class="prod__stars">★★★★★</span> ' + r.v + ' <span>(' + r.n + ')</span></div>' +
        '<div class="prod__badges">' + badges(m) + '</div>' +
        '<div class="prod__price"><b>' + money(p) + '</b><small>/ wheel</small></div>' +
        '<div class="prod__set">Full set &amp; tire pricing at fitment</div>' +
        '<div class="prod__actions">' +
          '<button class="btn-add" data-key="' + esc(key) + '" data-brand="' + esc(brand.name) + '" data-name="' + esc(m.model) + '" data-price="' + p + '" data-img="' + thumb(m) + '">' +
            '<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg> Add to cart' +
          '</button>' +
        '</div>' +
      '</div></article>';
  }
  var ADD_LABEL = '<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg> Add to cart';

  // add-to-cart + fav (event delegation, once)
  document.addEventListener("click", function (e) {
    var add = e.target.closest(".btn-add");
    if (add) {
      window.Cart && window.Cart.add({ key: add.dataset.key, brand: add.dataset.brand, name: add.dataset.name, price: +add.dataset.price, img: add.dataset.img });
      add.classList.add("added"); add.innerHTML = "Added ✓";
      setTimeout(function () { add.classList.remove("added"); add.innerHTML = ADD_LABEL; }, 1300);
      return;
    }
    var fav = e.target.closest(".prod__fav");
    if (fav) { fav.classList.toggle("on"); }
  });

  // ---- home: brand logo wall (collapsed to first 8; "show all" reveals the rest) ----
  function renderBrandGrid(el) {
    var VISIBLE = 8;
    el.innerHTML = BRANDS.map(function (b, i) {
      var extra = i >= VISIBLE ? " blogo-tile--extra" : "";
      return '<a class="blogo-tile fade' + extra + '" data-d="' + ((i % 6) + 1) + '" href="brand.html?brand=' + b.slug + '" aria-label="Shop ' + b.name + '">' +
        '<img class="blogo ' + logoFx(b) + '" src="' + logoSrc(b) + '" alt="' + b.name + '" loading="lazy">' +
        '<span class="blogo-tag">Shop ' + b.name + ' <em>→</em></span></a>';
    }).join("");

    // add the show-all / show-fewer toggle once
    if (BRANDS.length > VISIBLE && el.parentNode && !el.parentNode.querySelector(".brands-toggle-wrap")) {
      var wrap = document.createElement("div");
      wrap.className = "brands-toggle-wrap";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "brands-toggle";
      btn.setAttribute("aria-expanded", "false");
      var labelClosed = '<span class="btn-txt">Show all ' + BRANDS.length + ' brands</span> <span class="brands-toggle__ic" aria-hidden="true">↓</span>';
      var labelOpen = '<span class="btn-txt">Show fewer</span> <span class="brands-toggle__ic" aria-hidden="true">↑</span>';
      btn.innerHTML = labelClosed;
      btn.addEventListener("click", function () {
        var open = el.classList.toggle("is-expanded");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.innerHTML = open ? labelOpen : labelClosed;
        if (open) {
          el.querySelectorAll(".blogo-tile--extra").forEach(function (t) { t.classList.add("in"); });
        } else {
          el.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      });
      wrap.appendChild(btn);
      el.parentNode.insertBefore(wrap, el.nextSibling);
    }
    if (window.__observeFades) window.__observeFades();
  }

  // ---- home: featured products ----
  var FEATURED = [["jtx","Cannon","Best seller"],["jtx","Reaper","New"],["american-force","11 Independence DRW",""],
    ["kg1","Master (KD001)",""],["fuel","FF19D",""],["hostile","H401 Sprocket",""],["amani","Allora",""],["fittipaldi","FDF600 Dually",""]];
  function renderFeatured(el) {
    el.innerHTML = FEATURED.map(function (f) {
      var b = bySlug[f[0]]; if (!b) return "";
      var m = b.models.filter(function (x) { return x.model === f[1]; })[0]; if (!m) return "";
      return productCard(b, m, f[2]);
    }).join("");
    if (window.__observeFades) window.__observeFades();
  }

  // ---- shop page ----
  function allProducts() {
    var out = [];
    BRANDS.forEach(function (b, bi) { b.models.forEach(function (m, mi) { out.push({ b: b, m: m, order: bi * 100 + mi, price: priceEach(b, m) }); }); });
    return out;
  }
  var DIA_BUCKETS = [["20","20\""],["22","22\""],["24","24\""],["26","26\"+"]];
  function diaBucket(m) { var d = maxDia(m); if (d >= 26) return "26"; if (d >= 24) return "24"; if (d >= 22) return "22"; return "20"; }

  function renderShop(root) {
    var params = new URLSearchParams(location.search);
    var products = allProducts();

    var state = {
      brands: params.get("brand") ? [params.get("brand")] : [],
      configs: params.get("config") ? [params.get("config")] : [],
      dias: [],
      q: (params.get("q") || "").trim().toLowerCase(),
      sort: "featured"
    };
    var cat = params.get("cat");

    // heading
    var title = "All wheels", sub = "Every forged wheel we carry — hand-spec'd for your exact truck.";
    if (state.brands.length === 1 && bySlug[state.brands[0]]) { var bb = bySlug[state.brands[0]]; title = bb.name; sub = bb.tagline || sub; }
    else if (cat === "packages") { title = "Wheel &amp; Tire Packages"; sub = "Complete, mounted &amp; balanced — wheels, tires, TPMS and lugs, out the door."; }
    else if (state.configs.indexOf("dually") > -1 || state.configs.indexOf("super single") > -1) { title = "Dually &amp; Super Single"; sub = "Big-and-bold forged dually and super-single setups that own the lane."; }
    else if (state.q) { title = "Results for “" + state.q + "”"; }
    document.getElementById("shopTitle").innerHTML = title;
    document.getElementById("shopSub").innerHTML = sub;
    document.getElementById("shopCrumbNow").textContent = title.replace(/&amp;/g, "&");

    // counts for filters
    function count(fn) { return products.filter(fn).length; }

    function buildSidebar() {
      var side = document.getElementById("filtersSide");
      var brandOpts = BRANDS.map(function (b) {
        var n = b.models.length;
        return '<label class="fopt"><input type="checkbox" data-f="brand" value="' + b.slug + '"' + (state.brands.indexOf(b.slug) > -1 ? " checked" : "") + '>' + b.name + '<span class="n">' + n + '</span></label>';
      }).join("");
      var cfgOpts = CONFIG_ORDER.map(function (c) {
        var n = count(function (p) { return p.m.configs.indexOf(c) > -1; });
        return '<label class="fopt"><input type="checkbox" data-f="config" value="' + cfgKey(c) + '">' + cfgLabel(c) + '<span class="n">' + n + '</span></label>';
      }).join("");
      var diaOpts = DIA_BUCKETS.map(function (d) {
        var n = count(function (p) { return diaBucket(p.m) === d[0]; });
        return '<label class="fopt"><input type="checkbox" data-f="dia" value="' + d[0] + '">' + d[1] + '<span class="n">' + n + '</span></label>';
      }).join("");
      side.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">' +
          '<h4 style="margin:0">Filters</h4><button class="filters-clear" id="clearF">Clear all</button></div>' +
        '<div class="fgroup"><h4>Configuration</h4>' + cfgOpts + '</div>' +
        '<div class="fgroup"><h4>Diameter</h4>' + diaOpts + '</div>' +
        '<div class="fgroup" style="border:0"><h4>Brand</h4>' + brandOpts + '</div>';
      // reflect config prefilter
      side.querySelectorAll('input[data-f="config"]').forEach(function (i) { if (state.configs.indexOf(i.value) > -1) i.checked = true; });
      side.addEventListener("change", function (e) {
        var i = e.target; if (i.type !== "checkbox") return;
        var arr = i.dataset.f === "brand" ? state.brands : i.dataset.f === "config" ? state.configs : state.dias;
        if (i.checked) { if (arr.indexOf(i.value) < 0) arr.push(i.value); }
        else { var k = arr.indexOf(i.value); if (k > -1) arr.splice(k, 1); }
        draw();
      });
      document.getElementById("clearF").addEventListener("click", function () {
        state.brands = []; state.configs = []; state.dias = []; state.q = "";
        side.querySelectorAll("input").forEach(function (i) { i.checked = false; });
        draw();
      });
    }

    function filtered() {
      return products.filter(function (p) {
        if (state.brands.length && state.brands.indexOf(p.b.slug) < 0) return false;
        if (state.configs.length && !state.configs.some(function (c) { return p.m.configs.map(cfgKey).indexOf(c) > -1; })) return false;
        if (state.dias.length && state.dias.indexOf(diaBucket(p.m)) < 0) return false;
        if (state.q) { var hay = (p.b.name + " " + p.m.model).toLowerCase(); if (hay.indexOf(state.q) < 0) return false; }
        return true;
      });
    }
    function sortList(list) {
      var l = list.slice();
      if (state.sort === "price-asc") l.sort(function (a, b) { return a.price - b.price; });
      else if (state.sort === "price-desc") l.sort(function (a, b) { return b.price - a.price; });
      else if (state.sort === "name") l.sort(function (a, b) { return (a.b.name + a.m.model).localeCompare(b.b.name + b.m.model); });
      else l.sort(function (a, b) { return a.order - b.order; });
      return l;
    }
    function draw() {
      var list = sortList(filtered());
      document.getElementById("shopCount").innerHTML = "<b>" + list.length + "</b> product" + (list.length === 1 ? "" : "s");
      var grid = document.getElementById("shopGrid");
      grid.innerHTML = list.length ? list.map(function (p) { return productCard(p.b, p.m); }).join("")
        : '<div class="shop-empty">No wheels match those filters. <button class="filters-clear" id="ce">Clear filters</button></div>';
      var ce = document.getElementById("ce"); if (ce) ce.addEventListener("click", function () { document.getElementById("clearF").click(); });
      if (window.__observeFades) window.__observeFades();
    }

    buildSidebar();
    var sortSel = document.getElementById("shopSort");
    if (params.get("q")) { var s = document.querySelector(".search input"); if (s) s.value = params.get("q"); }
    sortSel.addEventListener("change", function () { state.sort = sortSel.value; draw(); });
    // mobile filter toggle
    var mb = document.getElementById("filterMobileBtn");
    if (mb) mb.addEventListener("click", function () { document.getElementById("filtersSide").classList.toggle("open"); });
    draw();
  }

  function renderWheelsMenu(el) {
    el.innerHTML = BRANDS.map(function (b) {
      return '<a href="brand.html?brand=' + b.slug + '">' + b.name + '</a>';
    }).join("");
  }

  // ---- dedicated brand page: brand logo + every wheel style w/ per-wheel & set-of-4 pricing ----
  // Showroom card: wheel + name only. No prices until real dealer pricing
  // lands — invented numbers on forged wheels are a promise we can't keep.
  // Swatch colour used for the finish dots — approximate, purely a UI cue;
  // the photo underneath is the real article.
  var FINISH_DOT = {
    polished: "linear-gradient(135deg,#fdfdfe,#c8ccd2 45%,#9aa0a8 62%,#f2f4f6)",
    chrome: "linear-gradient(135deg,#ffffff,#cdd2d8 45%,#8f959d 62%,#f4f6f8)",
    brushed: "linear-gradient(135deg,#e7e9ec,#c3c7cc 50%,#aeb3b9)",
    black: "linear-gradient(135deg,#3a3a3e,#0c0c0e)",
    blackmilled: "linear-gradient(135deg,#4a4a4f,#111114 55%,#8b9097)",
    bronze: "linear-gradient(135deg,#c69256,#7d5527)",
    gunmetal: "linear-gradient(135deg,#7a8189,#3c4249)",
  };
  function finishDot(name) {
    var k = String(name).toLowerCase().replace(/[^a-z]/g, "");
    return FINISH_DOT[k] || FINISH_DOT[k.replace(/milled|clear|gloss|matte|satin/g, "")] || FINISH_DOT.polished;
  }

  // Showroom cards state the fitments as a plain note rather than chips —
  // chips read as buttons you're meant to pick, and the picking happens
  // later, at ordering.
  var CFG_ORDER = ["single", "dually", "super single"];
  function availText(m) {
    var list = CFG_ORDER.filter(function (c) {
      return m.configs.some(function (x) { return cfgKey(x) === cfgKey(c); });
    });
    if (!list.length) return "";
    var names = list.map(cfgLabel);
    var joined = names.length === 1 ? names[0]
      : names.slice(0, -1).join(", ") + " &amp; " + names[names.length - 1];
    return "Available in " + joined;
  }

  // Hybrid pricing. A brand only shows "starting at" once its agreement says
  // we may (brand.pricing === "from") AND that style has a real published
  // figure. Custom forged stays quote-gated — a single number can't describe
  // a 24x14 in a custom finish, mounted, with TPMS and hardware. Everything
  // is quote-gated today because no dealer cost has landed yet; the fields
  // exist so switching a brand on is a data change, not a rebuild.
  function priceLine(brand, m) {
    if (brand.pricing === "from" && typeof m.priceFrom === "number" && m.priceFrom > 0) {
      // These wheels are sold as sets, so show the set alongside the per-wheel
      // figure — a per-wheel number on its own reads as the real cost of entry
      // when the actual check is 4x or 6x that.
      var sub = m.priceSet && m.priceSetQty
        ? "set of " + m.priceSetQty + " from " + money(m.priceSet)
        : "per wheel";
      return '<span class="wheel__price">' +
        '<span class="wheel__price-main">From <b>' + money(m.priceFrom) + '</b> / wheel</span>' +
        '<small>' + sub + '</small></span>';
    }
    return '<span class="wheel__quote">Get pricing →</span>';
  }

  function wheelCard(brand, m) {
    var vars = m.imgs && m.imgs.length > 1 ? m.imgs : null;
    var mediaInner = m.img
      ? '<img src="' + m.img + '" alt="' + esc(brand.name + " " + m.model) + '" loading="lazy">'
      : emblem(brand, m);
    var quote = "index.html?w=" + encodeURIComponent(brand.name + " " + m.model) + "#fitment";
    return '<a class="wheel fade' + (vars ? ' wheel--vars' : '') + '" href="' + esc(quote) + '">' +
      '<div class="wheel__media' + (m.img ? '' : ' pkg__media--emblem') + '">' + mediaInner + '</div>' +
      '<h3 class="wheel__name">' + m.model + '</h3>' +
      (vars
        ? '<div class="wheel__fin" role="group" aria-label="Finishes">' +
            vars.map(function (v, i) {
              return '<button type="button" class="wheel__sw' + (i === 0 ? ' is-on' : '') + '"' +
                ' data-img="' + esc(v.img) + '" title="' + esc(v.finish) + '"' +
                ' aria-label="' + esc(v.finish) + '" style="background:' + finishDot(v.finish) + '"></button>';
            }).join("") +
            '<span class="wheel__finname">' + esc(vars[0].finish) + '</span>' +
          '</div>'
        : '') +
      '<p class="wheel__avail">' + availText(m) + '</p>' +
      priceLine(brand, m) +
      '</a>';
  }

  // Finish swatches: hover (or tap) to swap the photo without leaving the page.
  function bindFinishSwatches(root) {
    function show(sw) {
      var card = sw.closest(".wheel");
      var img = card && card.querySelector(".wheel__media img");
      if (!img) return;
      img.src = sw.dataset.img;
      card.querySelectorAll(".wheel__sw").forEach(function (o) { o.classList.toggle("is-on", o === sw); });
      var label = card.querySelector(".wheel__finname");
      if (label) label.textContent = sw.getAttribute("title");
    }
    root.addEventListener("mouseover", function (e) {
      var sw = e.target.closest(".wheel__sw");
      if (sw) show(sw);
    });
    // Tap on touch devices must swap the finish, not follow the card link.
    root.addEventListener("click", function (e) {
      var sw = e.target.closest(".wheel__sw");
      if (!sw) return;
      e.preventDefault();
      e.stopPropagation();
      show(sw);
    });
  }

  // Brand pages show a curated showroom, not the whole lineup — the rest
  // lives on the manufacturer's own site, and they come back to us to order.
  var FEAT_MAX = 24;
  function featuredModels(b) {
    var ranked = b.models.filter(function (m) { return typeof m.feat === "number"; });
    if (ranked.length) {
      return ranked.sort(function (x, y) { return x.feat - y.feat; }).slice(0, FEAT_MAX);
    }
    var shot = b.models.filter(function (m) { return m.img; });
    return (shot.length >= 6 ? shot : b.models).slice(0, FEAT_MAX);
  }

  function renderBrandPage(root) {
    var q = new URLSearchParams(location.search);
    var slug = q.get("brand") || q.get("b");
    var b = slug && bySlug[slug];
    if (!b) {
      root.innerHTML = '<section class="wheelhero"><a class="wheelhero__back" href="index.html#brands">← Home</a>' +
        '<h1>Shop by brand</h1><p class="wheelhero__tag">Pick a brand to see every wheel style with pricing.</p></section>' +
        '<section class="wheelwrap"><div class="wheelgrid wheelgrid--brands">' +
        BRANDS.map(function (x) {
          return '<a class="wheelbrand" href="brand.html?brand=' + x.slug + '">' +
            '<img class="' + logoFx(x) + '" src="' + logoSrc(x) + '" alt="' + esc(x.name) + '">' +
            '<span>' + x.name + '</span></a>';
        }).join("") + '</div></section>';
      if (window.__observeFades) window.__observeFades();
      return;
    }
    document.title = b.name + " Wheels — DROOOLY Wheel Co.";
    var show = featuredModels(b);
    var total = b.models.length;
    var more = total - show.length;
    var host = (b.site || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

    root.innerHTML =
      '<section class="wheelhero">' +
        '<a class="wheelhero__back" href="index.html#brands">← All brands</a>' +
        '<img class="wheelhero__logo ' + logoFx(b) + '" src="' + logoSrc(b) + '" alt="' + esc(b.name) + '">' +
        // The logo already says the brand name — keep the h1 for search
        // engines and screen readers, but don't print it twice.
        '<h1 class="sr-only">' + b.name + '</h1>' +
        (b.tagline ? '<p class="wheelhero__tag">' + b.tagline + '</p>' : '') +
        '<p class="wheelhero__meta">' + (more > 0 ? "Most popular styles" : total + ' wheel style' + (total === 1 ? '' : 's')) +
          ' · built to order in your size &amp; finish</p>' +
        // Brand-level floor, for brands that price per model rather than per
        // series. Putting one brand figure on every card would underquote the
        // expensive styles; stating it once, here, stays true.
        (b.priceFrom
          ? '<p class="wheelhero__from">Styles from <b>' + money(b.priceFrom) + '</b> per wheel' +
            (b.priceNote ? ' · ' + esc(b.priceNote) : '') + '</p>'
          : '') +
      '</section>' +
      '<section class="wheelwrap">' +
        '<div class="wheelgrid">' + show.map(function (m) { return wheelCard(b, m); }).join("") + '</div>' +
        (b.site
          ? '<div class="wheelmore">' +
              '<h3>' + (more > 0 ? 'See all ' + total + ' ' + esc(b.name) + ' styles'
                                 : 'See the full ' + esc(b.name) + ' lineup') + '</h3>' +
              '<p>Browse the full lineup on ' + esc(b.name) + '&rsquo;s site — then come back to us and we&rsquo;ll build the set, mount the tires and quote you out the door.</p>' +
              '<div class="wheelmore__btns">' +
                '<a class="btn btn--chrome" href="' + esc(b.site) + '" target="_blank" rel="noopener noreferrer">' +
                  '<span class="btn-txt">View more at ' + esc(host) + '</span></a>' +
                '<a class="btn btn--ghost" href="index.html#fitment">Get fitted</a>' +
              '</div>' +
            '</div>'
          : '') +
        '<p class="wheelwrap__note">Every style is built to order in your choice of finish and size. Dually &amp; super-single sets are 6 wheels — <a href="index.html#fitment">get fitted</a> for your exact out-the-door price.</p>' +
      '</section>';
    bindFinishSwatches(root);
    if (window.__observeFades) window.__observeFades();
  }

  // Showroom cards link here with ?w=<brand + model> — drop it straight into
  // the form so they don't retype the wheel they just clicked.
  function prefillWheel() {
    var w = new URLSearchParams(location.search).get("w");
    if (!w) return;
    var f = document.querySelector('.fit-form [name="wheel"]');
    if (f && !f.value) f.value = w;
  }

  // ---- tires ----
  var TIRES = window.TIRES || [];
  var tireBySlug = {};
  TIRES.forEach(function (b) { tireBySlug[b.slug] = b; });

  function tireCard(brand, m) {
    var quote = "index.html?w=" + encodeURIComponent(brand.name + " " + m.model) + "#fitment";
    var rims = m.rims && m.rims.length
      ? m.rims.map(function (r) { return r + '"'; }).join(" · ")
      : "";
    return '<a class="tire fade" href="' + esc(quote) + '">' +
      '<div class="tire__media"><img src="' + m.img + '" alt="' + esc(brand.name + " " + m.model) + '" loading="lazy"></div>' +
      '<h3 class="tire__name">' + m.model + '</h3>' +
      (m.tread ? '<p class="tire__tread">' + esc(m.tread) + '</p>' : '') +
      (rims ? '<p class="tire__rims">Fits ' + rims + ' wheels</p>' : '') +
      (m.sizes && m.sizes.length
        ? '<details class="tire__sizes"><summary>' + m.sizes.length + ' size' +
          (m.sizes.length === 1 ? '' : 's') + '</summary><span>' +
          m.sizes.map(esc).join(" · ") + '</span></details>'
        : '') +
      (brand.pricing === "from" && m.priceFrom
        ? '<span class="wheel__price"><span class="wheel__price-main">From <b>' + money(m.priceFrom) +
          '</b> / tire</span><small>set of 4 from ' + money(m.priceFrom * 4) + '</small></span>'
        : '<span class="wheel__quote">Get pricing →</span>') +
      '</a>';
  }

  function renderTirePage(root) {
    var q = new URLSearchParams(location.search);
    var slug = q.get("brand") || q.get("b");
    var b = slug && tireBySlug[slug];
    if (!b) {
      root.innerHTML = '<section class="wheelhero"><a class="wheelhero__back" href="tires.html">← All tire brands</a>' +
        '<h1>Shop tires by brand</h1><p class="wheelhero__tag">Pick a brand to see its treads and sizes.</p></section>';
      if (window.__observeFades) window.__observeFades();
      return;
    }
    document.title = b.name + " Tires — DROOOLY Wheel Co.";
    var host = (b.site || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    var sizeCount = b.models.reduce(function (a, m) { return a + (m.sizes ? m.sizes.length : 0); }, 0);

    root.innerHTML =
      '<section class="wheelhero">' +
        '<a class="wheelhero__back" href="tires.html">← All tire brands</a>' +
        (b.logo ? '<img class="wheelhero__logo tirelogo" src="' + b.logo + '" alt="' + esc(b.name) + '">' : '') +
        '<h1' + (b.logo ? ' class="sr-only"' : '') + '>' + b.name + '</h1>' +
        (b.tagline ? '<p class="wheelhero__tag">' + b.tagline + '</p>' : '') +
        '<p class="wheelhero__meta">' + b.models.length + ' tread' + (b.models.length === 1 ? '' : 's') +
          ' · ' + sizeCount + ' sizes · mounted &amp; balanced with your set</p>' +
      '</section>' +
      '<section class="wheelwrap">' +
        '<div class="wheelgrid tiregrid">' + b.models.map(function (m) { return tireCard(b, m); }).join("") + '</div>' +
        (b.site
          ? '<div class="wheelmore"><h3>See the full ' + esc(b.name) + ' range</h3>' +
            '<p>Browse every tread on ' + esc(b.name) + '&rsquo;s site — then come back and we&rsquo;ll mount and balance them to your wheels.</p>' +
            '<div class="wheelmore__btns">' +
              '<a class="btn btn--chrome" href="' + esc(b.site) + '" target="_blank" rel="noopener noreferrer">' +
                '<span class="btn-txt">View more at ' + esc(host) + '</span></a>' +
              '<a class="btn btn--ghost" href="index.html#fitment">Get fitted</a></div></div>'
          : '') +
        '<p class="wheelwrap__note">Sizes shown are what we stock for truck fitments. Tell us your wheels and we&rsquo;ll confirm the right size — <a href="index.html#fitment">get fitted</a>.</p>' +
      '</section>';
    if (window.__observeFades) window.__observeFades();
  }

  function renderTireBrandGrid(root) {
    root.innerHTML = TIRES.map(function (b) {
      var treads = [...new Set(b.models.map(function (m) { return (m.tread || "").split(" / ")[0]; }))]
        .filter(Boolean).slice(0, 2).join(" · ");
      return '<a class="tbrand" href="tire.html?brand=' + b.slug + '">' +
        (b.logo
          ? '<img class="tbrand__logo" src="' + b.logo + '" alt="' + esc(b.name) + '">'
          : '<span class="tbrand__name">' + esc(b.name) + '</span>') +
        '<span class="tbrand__cat">' + esc(treads || "Truck tires") + '</span></a>';
    }).join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    prefillWheel();
    var tp = document.getElementById("tirePage"); if (tp) renderTirePage(tp);
    var tg = document.getElementById("tireBrandGrid"); if (tg) renderTireBrandGrid(tg);
    var bg = document.getElementById("brandGrid"); if (bg) renderBrandGrid(bg);
    var fg = document.getElementById("featuredGrid"); if (fg) renderFeatured(fg);
    var sp = document.getElementById("shopPage"); if (sp) renderShop(sp);
    var bp = document.getElementById("brandPage"); if (bp) renderBrandPage(bp);
    var wm = document.getElementById("wheelsBrands"); if (wm) renderWheelsMenu(wm);
  });
})();

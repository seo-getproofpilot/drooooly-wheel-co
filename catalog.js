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
  function isDually(m) { return m.configs.indexOf("dually") > -1 || m.configs.indexOf("super single") > -1; }

  function priceEach(brand, m) {
    var base = brand.kind === "Forged" ? 1550 : (/HD|Dually/.test(brand.kind) ? 480 : 560);
    var cfg = isDually(m) ? 850 : 0;
    var size = Math.max(0, (maxDia(m) - 20)) * 95;
    var jit = (hash(brand.slug + m.model) % 12) * 20;
    return Math.round((base + cfg + size + jit) / 5) * 5;
  }
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

  // ---- home: brand logo wall ----
  function renderBrandGrid(el) {
    el.innerHTML = BRANDS.map(function (b, i) {
      return '<a class="blogo-tile fade" data-d="' + ((i % 6) + 1) + '" href="shop.html?brand=' + b.slug + '" aria-label="Shop ' + b.name + '">' +
        '<img class="blogo ' + logoFx(b) + '" src="' + logoSrc(b) + '" alt="' + b.name + '" loading="lazy">' +
        '<span class="blogo-tag">Shop ' + b.name + ' <em>→</em></span></a>';
    }).join("");
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
      return '<a href="shop.html?brand=' + b.slug + '">' + b.name + '</a>';
    }).join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var bg = document.getElementById("brandGrid"); if (bg) renderBrandGrid(bg);
    var fg = document.getElementById("featuredGrid"); if (fg) renderFeatured(fg);
    var sp = document.getElementById("shopPage"); if (sp) renderShop(sp);
    var wm = document.getElementById("wheelsBrands"); if (wm) renderWheelsMenu(wm);
  });
})();

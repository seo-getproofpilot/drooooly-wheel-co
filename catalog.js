/* ============================================================
   DROOOLY Wheel & Tire — storefront catalog
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
  /* Which treatment a logo needs is a fact about the artwork, so it was
     measured rather than eyeballed: mean luminance of the opaque pixels in
     each file. Anything over ~185 is white-ink art that disappears on a
     white tile.

       blogo--dark  forces the art to solid black. Right for white line art
                    with no colour worth keeping (jtx, amani, arkon, xf).
       blogo--chip  sets it on a dark chip. Right when the colour IS the
                    logo and flattening it to black would lose the brand.

     cali (199), hardrock (224) and tis (196) had NO treatment at all and
     were washing out — hardrock worst of the three, since its wordmark is
     white and only the red accent was showing. */
  var FX = { "jtx":"blogo--dark","amani":"blogo--dark","arkon":"blogo--dark","xf":"blogo--dark",
    "kmc":"blogo--dark","black-rhino":"blogo--dark","liberty":"blogo--dark",
    "fenix":"blogo--chip","fittipaldi":"blogo--chip","fuel":"blogo--chip","vision":"blogo--chip",
    "cali":"blogo--chip","hardrock":"blogo--chip","tis":"blogo--chip" };
  /* A brand's own header texture, where we hold one. Keyed here rather than in
     brands.js because that file is generated and drops hand-added fields. */
  var TEXTURE = { "jtx": "assets/brand/jtx-texture.webp" };
  function textureFor(b) { return TEXTURE[b.slug] || null; }

  function logoSrc(b) { return "assets/brands/" + (LOGO[b.slug] || (b.slug + ".png")); }
  function logoFx(b) { return FX[b.slug] || ""; }

  var CONFIG_ORDER = ["single", "dually", "super single", "utv"];
  function cfgLabel(c) { return { "single":"Single","dually":"Dually","super single":"Super Single","utv":"Side-by-side" }[c] || c; }
  function cfgKey(c) { return c.replace(/\s+/g, "-"); }
  function money(n) { return "$" + n.toLocaleString("en-US"); }
  function maxDia(m) { var d = 0; m.sizes.forEach(function (s) { var n = parseInt(s, 10); if (n > d) d = n; }); return d || 22; }
  function isDually(m) { return m.configs.indexOf("dually") > -1 || m.configs.indexOf("super single") > -1; }

  /* THE ONLY PRICE THIS FILE WILL PUBLISH.

     CLAUDE.md rule 4: "Most wheel brands enforce Minimum Advertised Price;
     some prohibit advertising price at all. Build price fields into the
     schema now, leave them null, and gate display per-brand."

     What stood here was priceEach() — a formula over brand kind and smallest
     diameter, plus `(hash(slug + model) % 10) * 15` of jitter so the numbers
     would not look generated. It priced every card in the grid, including the
     538 models we hold no price for at all, and never read the real figure on
     the 144 we do. Measured before it came out:

       all 144 were contradicted by their own wheel page
       Fittipaldi FT100   grid $1,400/wheel   its own page $225
       Fittipaldi FA16    grid $1,415         its own page $161

     and the drawer carried it to a subtotal — a JTX 404, which has no stored
     price, added at $1,445.

     A price is publishable only when the BRAND is cleared to show one and the
     MODEL carries a real figure. Everything else is null, and the UI says
     "priced on request", which is true and is what the fitment consult is
     for. The builders already worked this way, and the comment on their card
     called the alternative "the site contradicting itself". It was right
     about the rest of the grid too. */
  function realPrice(brand, m) {
    if (!brand || brand.pricing !== "from") return null;
    return (typeof m.priceFrom === "number" && m.priceFrom > 0) ? m.priceFrom : null;
  }
  // duallies sell as 6 (4 rear + 2 front); everything else as a set of 4
  function setQty(m) { return isDually(m) ? 6 : 4; }
  /* The cart thumbnail. 182 of 778 models have no photograph yet, and the
     fallback used to be assets/wheel-face-1.png — a JTX wheel. That put a
     JTX wheel in the cart beside an American Force or Hostile product name,
     which is the same "wrong wheel on the card" problem Chris found on the
     homepage, just one screen later. A brand-neutral mark says "no photo"
     instead of naming the wrong manufacturer. */
  function thumb(m) { return m.img || "assets/wheel-placeholder.svg"; }

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

  /* The brand's logo file. Extensions vary across the 21 (png/svg/jpg/webp),
     so read it from the manifest rather than guessing one. */
  var BRAND_LOGO = {"amani":"png","american-force":"svg","arkon":"png","axe":"png","black-rhino":"svg",
    "cali":"png","fenix":"jpg","fittipaldi":"png","fuel":"svg","hardcore":"png","hardrock":"png",
    "hostile":"png","jtx":"png","kg1":"png","kmc":"svg","liberty":"png","method":"png",
    "raceline":"png","tis":"webp","vision":"png","xf":"png","price-designs":"png"};
  function brandLogo(b) { return "assets/brands/" + b.slug + "." + (BRAND_LOGO[b.slug] || "png"); }

  /* "Dually · Polished · 22\u2033\u201330\u2033". Every part read from the catalogue —
     if a brand publishes no width we say the diameter range only, and if it
     publishes nothing we leave that part out rather than inventing a range. */
  function specLine(b, m) {
    var parts = [];
    var cfg = (m.configs || []).map(cfgLabel);
    /* "Single +2" told nobody anything. Three configs is the most any wheel
       carries, so say all of them. */
    if (cfg.length) parts.push(cfg.join(" · "));
    if (m.finishes && m.finishes[0]) parts.push(m.finishes[0]);
    var dias = (window.Fitment ? window.Fitment.diametersFor(m) : []);
    if (dias.length === 1) parts.push(dias[0] + "\u2033");
    else if (dias.length > 1) parts.push(dias[0] + "\u2033\u2013" + dias[dias.length - 1] + "\u2033");
    return parts.join(" · ");
  }

  // ---- product card ----
  function productCard(brand, m, tag, lane, bolt) {
    var p = realPrice(brand, m);
    var mediaInner = m.img
      ? '<img src="' + m.img + '" alt="' + brand.name + ' ' + m.model + '" loading="lazy">'
      : emblem(brand, m);
    var key = brand.slug + "|" + m.model;
    /* The shop grid was a dead end: this card rendered an <article> with no
       link, so the only page listing all 756 wheels could not reach any of
       their pages. Brand pages have always linked through (wheelCard); this
       one never did. */
    var href = m.builder
      ? "build.html?b=" + encodeURIComponent(m.builder)
      : "wheel.html?brand=" + encodeURIComponent(brand.slug) + "&model=" + encodeURIComponent(m.model);
    var sizes = lane ? laneSizes(lane, m) : [];
    return '<article class="prod fade">' +
      '<a class="prod__link" href="' + esc(href) + '" aria-label="' +
        esc(brand.name + " " + m.model) + '"></a>' +
      '<div class="prod__media' + (m.img ? '' : ' pkg__media--emblem') + '">' +
        (tag ? '<span class="prod__tag">' + tag + '</span>' : '') +
        '<button class="prod__fav" aria-label="Save"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></button>' +
        mediaInner +
      '</div>' +
      '<div class="prod__body">' +
        /* The brand's own mark, not its name set in blue. The curated
           showcase on the homepage has always done this; the shop grid was
           the one place a brand showed up as blue text, which is most of why
           the page read as "everything is blue". All 22 brands have a logo. */
        '<img class="prod__logo" src="' + esc(brandLogo(brand)) + '" alt="' + esc(brand.name) + '" loading="lazy" />' +
        '<h3 class="prod__name">' + m.model + '</h3>' +
        /* One spec line in the showcase's own words — "Dually · Polished ·
           22\u2033\u201330\u2033" — in place of a star rating and a row of blue
           pills. The rating was invented from a hash of the model name
           (LAUNCH-CHECKLIST 5.x): it looked like data, carried none, and
           every card wore the same blue. This line is read off the catalogue. */
        '<div class="prod__meta">' + esc(specLine(brand, m)) + '</div>' +
        /* The basis is on the card, not just in the header, because the
           customer scrolling past twelve wheels never reads the header
           twice. "Cut to" is a process we control; "confirm" is one we do
           not. Both are true, and they are not the same sentence. */
        (bolt && bolt.label
          ? '<div class="prod__bolt prod__bolt--' + esc(bolt.basis) + '">' + esc(bolt.label) + '</div>'
          : '') +
        (sizes.length
          ? '<div class="prod__lane"><span>' + esc(lane.note) + '</span>' +
            sizes.slice(0, 4).map(function (x) { return "<b>" + fmtSize(x) + "</b>"; }).join("") +
            (sizes.length > 4 ? '<i>+' + (sizes.length - 4) + " more</i>" : "") + "</div>"
          : "") +
        /* A size tells a truck buyer what they need to know. A side-by-side
           buyer needs the bolt pattern first — 4x137 Can-Am and 4x156 Polaris
           are the same wheel in two incompatible drillings, and picking the
           wrong one is the single most common way this order goes wrong. */
        (lane && lane.bolts && m.bolts && m.bolts.length
          ? '<div class="prod__lane"><span>Bolt patterns</span>' +
            m.bolts.slice(0, 4).map(function (x) { return "<b>" + esc(x) + "</b>"; }).join("") +
            (m.bolts.length > 4 ? '<i>+' + (m.bolts.length - 4) + " more</i>" : "") + "</div>"
          : "") +
        /* A buildable product prices from the vendor's own published set
           figure, not from priceEach()'s synthetic per-wheel estimate. An
           invented $1,805/wheel on a card that leads to a builder quoting a
           real $5,400 set is the site contradicting itself. */
        (m.builder
          ? '<div class="prod__price"><b>' + money(m.priceSet) + '</b><small>/ set of ' + (m.priceSetQty || 4) + '</small></div>' +
            '<div class="prod__set">Built to order \u2014 options priced as you build</div>'
          : p !== null
            ? '<div class="prod__price"><b>From ' + money(p) + '</b><small>/ wheel</small></div>' +
              '<div class="prod__set">Full set &amp; tire pricing at fitment</div>'
            : '<div class="prod__price prod__price--ask">Priced on request</div>' +
              '<div class="prod__set">We quote it with the brand on your fitment consult</div>') +
        '<div class="prod__actions">' +
          /* A configurable product has nothing to add until it is configured,
             so the primary action is the builder rather than the cart. The
             same chrome button either way — it is the same weight of decision. */
          (m.builder
            ? '<a class="btn-add" href="' + esc(href) + '"><span class="btn-txt">Build yours \u2192</span></a>'
            : '<button class="btn-add" data-key="' + esc(key) + '" data-brand="' + esc(brand.name) + '" data-name="' + esc(m.model) + '" data-price="' + (p === null ? "" : p) + '" data-img="' + thumb(m) + '">' +
              '<span class="btn-txt"><svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg> Add to build</span>' +
              '</button>') +
          /* Two actions, not one. Every card carried the same grey slab and
             nothing else, so the grid had one weight all the way down and no
             way to say "show me this one" without committing to the cart. */
          (m.builder ? '' : '<a class="prod__see" href="' + esc(href) + '">See the wheel <i>\u2192</i></a>') +
        '</div>' +
      '</div></article>';
  }
  var ADD_LABEL = '<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg> Add to build';

  // add-to-cart + fav (event delegation, once)
  document.addEventListener("click", function (e) {
    var add = e.target.closest(".btn-add");
    if (add) {
      /* An empty data-price means we hold no publishable price — NOT zero.
         `+""` is 0, which would have put a free wheel in the drawer. */
      var praw = add.dataset.price;
      window.Cart && window.Cart.add({ key: add.dataset.key, brand: add.dataset.brand,
        name: add.dataset.name, price: (praw === "" || praw == null) ? null : +praw,
        img: add.dataset.img });
      add.classList.add("added"); add.innerHTML = "Added ✓";
      setTimeout(function () { add.classList.remove("added"); add.innerHTML = ADD_LABEL; }, 1300);
      return;
    }
    var fav = e.target.closest(".prod__fav");
    if (fav) { fav.classList.toggle("on"); }
  });

  // ---- home: brand logo wall (collapsed to first 8; "show all" reveals the rest) ----
  /* The flyout kept vanishing before you could reach it: it sat in the same
     stacking context as the brand list, so the neighbouring column's links
     covered it, and the gap between the row and the panel meant the cursor
     left the hover region on the way across.

     Hover state is held in JS with a close delay rather than left to :hover,
     and the open row is lifted above its siblings while the rest of the list
     dims — so there is one obvious thing to aim at. */
  function bindMegaFlyouts(el) {
    var CLOSE_MS = 260;
    var timer = null;
    function closeAll() {
      el.classList.remove("mega__grid--open");
      el.querySelectorAll(".mega__b").forEach(function (b) {
        b.classList.remove("is-open");
        b.classList.remove("is-dim");
      });
    }
    el.querySelectorAll(".mega__b--has-sub").forEach(function (b) {
      b.addEventListener("mouseenter", function () {
        clearTimeout(timer);
        closeAll();
        b.classList.add("is-open");
        el.classList.add("mega__grid--open");
        /* Dim the siblings from JS rather than a descendant selector — the
           class is on the element itself, so nothing in the cascade can quietly
           outrank it. */
        el.querySelectorAll(".mega__b").forEach(function (o) {
          if (o !== b) o.classList.add("is-dim");
        });
      });
      b.addEventListener("mouseleave", function () {
        clearTimeout(timer);
        timer = setTimeout(closeAll, CLOSE_MS);
      });
    });
    // leaving the whole menu closes immediately
    var mega = el.closest(".mega");
    if (mega) mega.addEventListener("mouseleave", function () { clearTimeout(timer); closeAll(); });
  }

  function renderBrandGrid(el) {
    var VISIBLE = 8;
    el.innerHTML = BRANDS.map(function (b, i) {
      var extra = i >= VISIBLE ? " blogo-tile--extra" : "";
      return '<a class="blogo-tile fade' + extra + '" data-d="' + ((i % 6) + 1) + '" href="brand.html?brand=' + b.slug + '" aria-label="Shop ' + b.name + '">' +
        '<img class="blogo ' + logoFx(b) + '" src="' + logoSrc(b) + '" alt="' + b.name + '" loading="lazy">' +
        '<span class="blogo-tag">Shop ' + b.name + ' <i>→</i></span></a>';
    }).join("");

    // add the show-all / show-fewer toggle once
    if (BRANDS.length > VISIBLE && el.parentNode && !el.parentNode.querySelector(".brands-toggle-wrap")) {
      var wrap = document.createElement("div");
      wrap.className = "brands-toggle-wrap";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "brands-toggle";
      btn.setAttribute("aria-expanded", "false");
      var labelClosed = '<span class="btn-txt">All ' + BRANDS.length + ' brands</span>';
      var labelOpen = '<span class="btn-txt">Show fewer</span>';
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
  /* THE HOMEPAGE LINEUP IS LITERAL MARKUP, not rendered from here.

     There used to be a FEATURED list and a renderFeatured() mounted on an
     element id "featuredGrid". No page has ever declared that id, so the
     function never ran once — and it had rotted accordingly: it asked for
     "Master (KD001)" and "Reaper", names the catalogue does not carry, and
     its own `if (!m) return ""` would have silently dropped them.

     Dead code that looks live is a trap: the next person to fix a wrong
     price on the homepage would have edited brands.js and watched nothing
     happen. The cards live in index.html, and tools/test-pages.js pins each
     one's diameter range, finish and configuration against the model it
     links to — which is how six wrong cards were found. */

  // ---- shop page ----
  function allProducts() {
    var out = [];
    BRANDS.forEach(function (b, bi) { b.models.forEach(function (m, mi) { out.push({ b: b, m: m, order: bi * 100 + mi, price: realPrice(b, m) }); }); });
    return out;
  }
  /* ---- build lanes ----------------------------------------------------
     The two things the catalog actually supports. There used to be four
     audience cards, three of which resolved to the same two URLs, and two of
     which pointed at street/car inventory we do not carry.

     A lane FILTERS on configuration, which is a fact about the wheel, and
     ANNOTATES with the sizes that suit the build, which is guidance. It never
     hides a size: a 20x10 is a legitimate thing to put on a lifted truck, it
     just isn't what most people come here for. Hiding it would be us deciding
     for the customer, and the whole point of forged is that they decide. */
  var LANES = {
    lifted: {
      title: "Lifted trucks",
      sub: "Big-lip forged for single-rear trucks — 20s through 30s, 10 to 16 inches wide. " +
           "The wider the wheel and the more negative the offset, the more room the truck needs. " +
           "Tell us your lift and we'll spec it.",
      note: "Wide sizes in each style",
      common: ["22x12", "24x14", "26x14", "26x16"],
      /* Single-rear, AND actually built in a wide size. 106 single-config models
         have no width over 8.25 — the dually rear width — because their configs
         are wrong (LAUNCH-CHECKLIST 4.12). A dually wheel in the lifted lane is
         a data bug on display. Styles whose widths are simply unpublished stay:
         "we don't know" is not "no". */
      match: function (m) {
        if ((m.configs || []).indexOf("single") < 0) return false;
        var sz = (m.sizes || []).map(parseSz).filter(Boolean);
        return sz.some(function (x) { return x.w === null || (x.w !== 8.25 && x.w >= 12); });
      },
      // 8.25 is a dually rear, never a lifted single-rear size, however wide the truck.
      suits: function (sz) { return sz.w !== null && sz.w !== 8.25 && sz.w >= 12; }
    },
    dually: {
      title: "Dually & super single",
      sub: "Rear pairs run 8.25 wide at every diameter. The front is your call — a matched " +
           "narrow wheel, or a wide super single. A set is six wheels, not four.",
      note: "Super single fronts",
      common: ["24x8.25", "24x14", "26x16"],
      match: function (m) {
        var c = m.configs || [];
        return c.indexOf("dually") > -1 || c.indexOf("super single") > -1;
      },
      suits: function (sz) { return sz.w !== null && sz.w !== 8.25; }
    },
    /* Side-by-sides and sand cars. The only lane that isn't a truck, and the
       only one whose wheels the catalog didn't carry until we pulled Method's
       and Raceline's own UTV listings in (tools/scrape-utv.js). Both brands
       were already here, so this is a product line we added, not a brand.

       Bolt pattern does the work this lane's customer actually cares about:
       4x137 is Can-Am, 4x156 is Polaris, and the two are not interchangeable. */
    utv: {
      title: "Side-by-sides & sand cars",
      sub: "Beadlock and bead-grip in 14s and 15s, on 4x137 for a Can-Am or 4x156 for a RZR. " +
           "Sand cars run the wide rear and the narrow front off the same shelf. " +
           "Tell us the machine and where you ride it and we'll spec the set.",
      note: "Sizes for a side-by-side",
      common: ["14x7", "15x7", "15x10"],
      bolts: true,
      match: function (m) { return (m.configs || []).indexOf("utv") > -1; },
      /* Raceline's utv-atv line runs down to 9x8 and 10x5 — genuine quad
         sizes, kept in the catalog because they publish them, but a sport
         quad wheel is not what someone building a side-by-side is shopping
         for. 14 is the smallest wheel any of these machines takes. */
      suits: function (sz) { return sz.d >= 14; }
    }
  };

  function parseSz(str) {
    var m = /^(\d+)(?:x([\d.]+))?$/.exec(str);
    return m ? { d: +m[1], w: m[2] ? +m[2] : null, s: str } : null;
  }
  /* The sizes in THIS style that suit THIS lane. Same wheel, different answer
     per lane — Centerfire is 24x14/26x16 under Lifted and 24x8.25 under Dually. */
  function laneSizes(lane, m) {
    return (m.sizes || []).map(parseSz).filter(Boolean).filter(lane.suits)
      .sort(function (a, b) { return a.d - b.d || a.w - b.w; })
      .map(function (x) { return x.s; });
  }
  function fmtSize(s) { return s.replace("x", "×") + '"'; }

  /* 15 exists because the UTV line is 14s and 15s. Without it every
     side-by-side wheel answered to the "20"" filter, which is just wrong. */
  var DIA_BUCKETS = [["15","14\u201315\""],["20","20\""],["22","22\""],["24","24\""],["26","26\"+"]];
  function bucketOf(d) { return d >= 26 ? "26" : d >= 24 ? "24" : d >= 22 ? "22" : d >= 16 ? "20" : "15"; }
  /* EVERY bucket the model is actually built in, not just the biggest one.
     It used to file each model under bucketOf(maxDia(m)) — a single bucket —
     so a wheel offered in 20, 22, 24 and 26 answered only to the 26"+ filter.
     MEASURED on the live catalogue: the 22" filter returned 34 wheels when
     693 are built in a 22, and 24" returned 109 of 664. The filter was hiding
     more than it showed. */
  function diaBuckets(m) {
    var out = [];
    (m.sizes || []).forEach(function (s) {
      var k = bucketOf(parseFloat(s) || 0);
      if (out.indexOf(k) < 0) out.push(k);
    });
    return out.length ? out : [bucketOf(maxDia(m))];
  }

  function renderShop(root) {
    var params = new URLSearchParams(location.search);
    var products = allProducts();

    var state = {
      brands: params.get("brand") ? [params.get("brand")] : [],
      configs: params.get("config") ? [params.get("config")] : [],
      dias: [],
      q: (params.get("q") || "").trim().toLowerCase(),
      /* The bolt pattern the finder worked out, and the truck it came from,
         carried as plain query params so the result is a shareable link. */
      bolt: (params.get("bolt") || "").trim(),
      veh: (params.get("veh") || "").trim(),
      sort: "featured"
    };
    var cat = params.get("cat");
    var lane = LANES[params.get("build")] || null;

    // heading
    /* Not "every forged wheel ... for your exact truck" any more: the grid now
       also holds 25 cast and bead-grip UTV styles, which are neither forged nor
       for a truck. */
    var title = "All wheels", sub = "Every wheel we carry — trucks, duallies and side-by-sides, hand-spec'd to your setup.";
    if (state.brands.length === 1 && bySlug[state.brands[0]]) { var bb = bySlug[state.brands[0]]; title = bb.name; sub = bb.tagline || sub; }
    else if (cat === "packages") { title = "Wheel &amp; Tire Packages"; sub = "Complete, mounted &amp; balanced — wheels, tires, TPMS and lugs, out the door."; }
    else if (state.configs.indexOf("dually") > -1 || state.configs.indexOf("super single") > -1) { title = "Dually &amp; Super Single"; sub = "Big-and-bold forged dually and super-single setups that own the lane."; }
    else if (lane) { title = lane.title; sub = lane.sub; }
    else if (state.q) { title = "Results for “" + state.q + "”"; }
    if (state.bolt) {
      title = esc(state.bolt) + " wheels";
      sub = (state.veh ? esc(state.veh) + " runs a " + esc(state.bolt) + " bolt pattern. " : "") +
            "Everything below can be had in it — we confirm the pattern with the manufacturer before anything is built.";
    }
    document.getElementById("shopTitle").innerHTML = title;
    document.getElementById("shopSub").innerHTML = sub;
    document.getElementById("shopCrumbNow").textContent = title.replace(/&amp;/g, "&");

    var laneEl = document.getElementById("shopLane");
    /* The bolt bar replaces the lane bar when a pattern is in play, and says
       in words what the two groups below mean. Never "fits" — CLAUDE.md rule
       1. What we know is the drilling, not the clearance. */
    if (laneEl && state.bolt) {
      var pre = filtered();
      var ask = pre.filter(function (p) { return p.basis === "unknown"; }).length;
      laneEl.innerHTML = '<div class="boltbar">' +
        '<span class="boltbar__p">' + esc(state.bolt) + '</span>' +
        '<span class="boltbar__t">' +
          (state.veh ? "<b>" + esc(state.veh) + "</b> — " : "") +
          (pre.length - ask) + " we can cut to this pattern" +
          (ask ? ", " + ask + " more we would confirm with the maker first" : "") + ". " +
          '<span class="boltbar__tail">Width, offset and what clears your fender is the next conversation.</span>' +
        "</span>" +
        '<a class="boltbar__x" href="shop.html">Clear</a></div>';
    } else if (laneEl && lane) {
      laneEl.innerHTML = '<div class="lanebar"><span class="lanebar__h">Common sizes</span>' +
        lane.common.map(function (x) { return "<b>" + fmtSize(x) + "</b>"; }).join("") + "</div>";
    }

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
        var n = count(function (p) { return diaBuckets(p.m).indexOf(d[0]) > -1; });
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
        if (lane && !lane.match(p.m)) return false;
        if (state.brands.length && state.brands.indexOf(p.b.slug) < 0) return false;
        if (state.configs.length && !state.configs.some(function (c) { return p.m.configs.map(cfgKey).indexOf(c) > -1; })) return false;
        if (state.dias.length && !diaBuckets(p.m).some(function (k) { return state.dias.indexOf(k) > -1; })) return false;
        if (state.q) { var hay = (p.b.name + " " + p.m.model).toLowerCase(); if (hay.indexOf(state.q) < 0) return false; }
        if (state.bolt && window.Fitment) {
          var r = window.Fitment.wheelBolt(p.b.slug, p.m, state.bolt);
          if (!r.match) return false;
          p.basis = r.basis; p.boltLabel = r.label;   // the card reads these
        }
        return true;
      });
    }
    function sortList(list) {
      var l = list.slice();
      /* A wheel with no published price is not the cheapest one, it is
         unknown. Either direction sends the unpriced to the end rather than
         letting null sort as zero. */
      if (state.sort === "price-asc" || state.sort === "price-desc") {
        var dir = state.sort === "price-asc" ? 1 : -1;
        l.sort(function (a, b) {
          if (a.price === null && b.price === null) return a.order - b.order;
          if (a.price === null) return 1;
          if (b.price === null) return -1;
          return (a.price - b.price) * dir;
        });
      }
      else if (state.sort === "name") l.sort(function (a, b) { return (a.b.name + a.m.model).localeCompare(b.b.name + b.m.model); });
      else l.sort(function (a, b) { return a.order - b.order; });
      return l;
    }
    var first = true;
    function draw() {
      var list = sortList(filtered());
      /* Whatever the sort, the wheels we can stand behind come first and the
         ones we would have to ask the manufacturer about come after. A maybe
         that outranks a yes is how a maybe turns into a promise. */
      if (state.bolt) list = list.slice().sort(function (x, y2) {
        return (x.basis === "unknown" ? 1 : 0) - (y2.basis === "unknown" ? 1 : 0);
      });
      document.getElementById("shopCount").innerHTML = "<b>" + list.length + "</b> product" + (list.length === 1 ? "" : "s");
      if (window.__syncShowBar) window.__syncShowBar(list.length);
      var grid = document.getElementById("shopGrid");
      grid.innerHTML = list.length ? list.map(function (p) {
          return productCard(p.b, p.m, null, lane, state.bolt ? { basis: p.basis, label: p.boltLabel } : null);
        }).join("")
        : '<div class="shop-empty">No wheels match those filters. <button class="filters-clear" id="ce">Clear filters</button></div>';
      var ce = document.getElementById("ce"); if (ce) ce.addEventListener("click", function () { document.getElementById("clearF").click(); });
      if (window.__observeFades) window.__observeFades();

      /* Narrowing the grid shortens the page under you. The browser keeps the
         scroll offset, so filtering 781 wheels down to 35 took the document
         from 155,679px to 8,607 and left the top of the results 3,073px ABOVE
         the viewport — you were looking at the footer and the results were
         gone. MEASURED, and it is what "it sends you to the bottom of the
         page" was.

         Only corrects when the results have actually gone off the top, and
         never on the first paint, so landing on a deep link still works. */
      if (!first) {
        var top = grid.getBoundingClientRect().top;
        if (top < 0) {
          var anchor = document.getElementById("shopCount") || grid;
          var y = anchor.getBoundingClientRect().top + (window.pageYOffset || 0) - 90;
          window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
        }
      }
      first = false;
    }

    /* Real trucks wearing these wheels. The generator decides per lane whether
       the photos come from the manufacturer's gallery (hot-linked, credited,
       each tile linking back) or from our own assets/builds — and gives us only
       ONE source per lane, so the credit line below is always true. A lane with
       too few of either gets no strip at all rather than a thin one. */
    (function laneBuilds() {
      var host = document.getElementById("shopBuilds");
      if (!host || !lane) return;
      var B = window.WHEEL_BUILDS;
      var entry = B && B.lanes && B.lanes[params.get("build")];
      if (!entry || !entry.photos || !entry.photos.length) return;

      var show = entry.photos.slice(0, 12);
      host.innerHTML =
        '<section class="wbuilds lanebuilds"><div class="wbuilds__head">' +
          "<h2>" + esc(lane.title) + " on real builds</h2>" +
          "<p>A render shows the spoke pattern. These show what it looks like bolted on.</p>" +
        '</div><div class="wbuilds__grid">' +
        show.map(function (sh) {
          var cap = [sh.vehicle, sh.size, sh.finish].filter(Boolean).join(" · ");
          var alt = esc(lane.title + " build" + (sh.vehicle ? " — " + sh.vehicle : ""));
          var img = '<img src="' + esc(sh.url) + '" alt="' + alt + '" loading="lazy" />';
          /* Our own photos are not links to anywhere, and carry no caption: the
             captions on these same files elsewhere on the site are invented, and
             repeating a made-up size under a real photo is the part that would
             actually mislead. */
          if (sh.local) {
            return '<figure class="wbshot wbshot--own">' + img + "</figure>";
          }
          return '<a class="wbshot" href="' + esc(sh.url) + '" target="_blank" rel="noopener">' +
            img + (cap ? '<span class="wbshot__cap">' + esc(cap) + "</span>" : "") + "</a>";
        }).join("") + "</div>" +
        (entry.credit
          ? '<p class="wbuilds__credit">Photos by ' + esc(entry.credit) +
            ', shown from their gallery — every photo links back to them. ' +
            '<a href="' + esc(B.source) + '" target="_blank" rel="noopener">See the full gallery →</a></p>'
          : '<p class="wbuilds__credit">Builds wearing this setup. ' +
            "We're photographing our own installs as they go out.</p>") +
        "</section>";
      if (window.__observeFades) window.__observeFades();
    })();

    buildSidebar();
    var sortSel = document.getElementById("shopSort");
    if (params.get("q")) { var s = document.querySelector(".search input"); if (s) s.value = params.get("q"); }
    sortSel.addEventListener("change", function () { state.sort = sortSel.value; draw(); });
    // mobile filter toggle
    /* MOBILE DRAWER. The sidebar is a full-height fixed overlay on a phone
       with no backdrop and no close control — the Filters button that opened
       it is behind it. So you tick "22 inch", the count changes somewhere you
       cannot see, and there is no way back to the results. Same complaint as
       the desktop scroll jump, different cause.

       Two additions, both mobile-only: tap the backdrop to dismiss, and a
       sticky bar that says how many wheels are waiting and takes you to
       them. */
    var side = document.getElementById("filtersSide");
    var backdrop = document.createElement("div");
    backdrop.className = "filters-backdrop";
    document.body.appendChild(backdrop);

    var showBar = document.createElement("button");
    showBar.className = "filters-show";
    showBar.type = "button";
    side.appendChild(showBar);

    function closeDrawer() {
      side.classList.remove("open");
      document.body.classList.remove("filters-open");
      var g = document.getElementById("shopCount");
      if (g) {
        var top = g.getBoundingClientRect().top + (window.pageYOffset || 0) - 80;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }
    function openDrawer() { side.classList.add("open"); document.body.classList.add("filters-open"); }
    window.__syncShowBar = function (n) {
      showBar.textContent = n ? "Show " + n + " wheel" + (n === 1 ? "" : "s") : "No wheels match";
      showBar.disabled = !n;
    };
    backdrop.addEventListener("click", closeDrawer);
    showBar.addEventListener("click", closeDrawer);
    var mb = document.getElementById("filterMobileBtn");
    if (mb) mb.addEventListener("click", function () {
      side.classList.contains("open") ? closeDrawer() : openDrawer();
    });
    draw();
  }

  /* Which series a brand is split into, if any. Read from the finish data so
     the menu can never offer a series with nothing behind it. */
  function seriesFor(b) {
    var F = window.WHEEL_FINISHES;
    if (!F || F.brandSlug !== b.slug || !F.series) return [];
    return SERIES_DEFS.filter(function (d) {
      return F.series[d.key] && Object.keys(F.series[d.key]).length;
    });
  }

  /* Brands that come in single and dually get a flyout, so you can go straight
     to the list that fits your truck instead of scrolling past the one that
     doesn't. */
  function renderWheelsMenu(el) {
    el.innerHTML = BRANDS.map(function (b) {
      /* NO FLYOUT FOR A BUILD-TO-ORDER BRAND. I briefly put the seven machines
         in the dropdown here; Chris: "I don't want it built so that when you
         hover over Price Designs, it gives you the option... The next page
         should be the menu page. It shouldn't do it on the dropdown bar."

         He is right, and not only as a preference: the machine tiles are
         photographs, and a photograph is the entire reason that screen works.
         A hover flyout can only carry a list of words, which is the version
         that does NOT answer "what are you building for" at a glance. So the
         brand name is a plain link and the page behind it does the job. */
      if (allBuildable(b)) {
        return '<div class="mega__b">' +
          '<a href="brand.html?brand=' + b.slug + '">' + esc(b.name) + "</a></div>";
      }

      var ser = seriesFor(b);
      var top = '<a href="brand.html?brand=' + b.slug + '">' + esc(b.name) +
        (ser.length ? ' <i class="mega__car" aria-hidden="true">›</i>' : "") + "</a>";
      if (!ser.length) return '<div class="mega__b">' + top + "</div>";
      return '<div class="mega__b mega__b--has-sub">' + top +
        '<div class="mega__sub">' +
          ser.map(function (d) {
            return '<a href="brand.html?brand=' + b.slug + "&series=" + d.key + '">' +
              esc(d.menu) + "</a>";
          }).join("") +
          '<a class="mega__sub-all" href="brand.html?brand=' + b.slug + '">All ' + esc(b.name) + " styles</a>" +
        "</div></div>";
    }).join("");
  }

  /* THE PHONE MENU HAD SIX LINKS AND NO BRANDS.

     Chris: "on mobile version, there's less options than there is for the web
     version. The web version shows all of his wheels, styles, and designs...
     This should work the same on both ends."

     He is describing a real gap, not a rendering difference. On a wide screen
     the Wheels nav opens a mega-menu built by renderWheelsMenu() over all 22
     brands. The phone menu is hand-written markup in all nine HTML files and
     carries one link — "Wheels · all brands" to shop.html — so a phone could
     reach the 775-wheel grid but could not reach a BRAND, and therefore could
     not reach the Price Designs chooser with his seven machines on it at all.

     It is rendered here rather than written into the nine files so it cannot
     drift from the catalogue the way the hand-written copy did. Wheels opens
     by default because showing the brands is the whole point; tires are a
     shorter list behind one tap. */
  function renderMobileNav(el) {
    function group(label, items, open) {
      return '<details class="mnav__grp"' + (open ? " open" : "") + ">" +
        "<summary>" + esc(label) +
          '<span class="mnav__n">' + items.length + "</span></summary>" +
        '<div class="mnav__brands">' + items.join("") + "</div></details>";
    }

    var wheels = BRANDS.map(function (b) {
      /* A build-to-order brand says so: its page is a machine chooser, not a
         grid, and that is worth knowing before the tap. */
      return '<a href="brand.html?brand=' + b.slug + '">' + esc(b.name) +
        (allBuildable(b) ? '<i class="mnav__tag">build to order</i>'
                         : '<i class="mnav__ct">' + b.models.length + "</i>") + "</a>";
    });
    var tires = TIRES.map(function (b) {
      return '<a href="tire.html?brand=' + b.slug + '">' + esc(b.name) +
        '<i class="mnav__ct">' + b.models.length + "</i></a>";
    });

    var wheelLink = el.querySelector('a[href="shop.html"]');
    var tireLink = el.querySelector('a[href="tires.html"]');
    if (wheelLink) wheelLink.insertAdjacentHTML("afterend", group("Shop a wheel brand", wheels, true));
    if (tireLink) tireLink.insertAdjacentHTML("afterend", group("Shop a tire brand", tires, false));
  }

  // ---- dedicated brand page: brand logo + every wheel style w/ per-wheel & set-of-4 pricing ----
  // Showroom card: wheel + name only. No prices until real dealer pricing
  // lands — invented numbers on forged wheels are a promise we can't keep.
  // Swatch colour used for the finish dots — approximate, purely a UI cue;
  // the photo underneath is the real article.
  /* Flat fills, no gradients. A gradient inside a dot this small reads as
     texture sitting on top of the colour rather than as polished metal — the
     brightness is what says chrome, so carry it with a light value and a crisp
     ring instead. */
  var FINISH_DOT = {
    polished:    "#eaeff5",
    chrome:      "#edf2f7",
    brushed:     "#d2d7dd",
    black:       "#141519",
    blackmilled: "#17181d",
    bronze:      "#a8763c",
    gunmetal:    "#5a6069"
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
  function priceLine(brand, m, series) {
    if (brand.pricing === "from" && typeof m.priceFrom === "number" && m.priceFrom > 0) {
      // These wheels are sold as sets, so show the set alongside the per-wheel
      // figure — a per-wheel number on its own reads as the real cost of entry
      // when the actual check is 4x or 6x that.
      /* A dually set is six wheels, and the stored set price is for four — so
         on a dually card that line is simply wrong. Say what the set is and
         leave the total to the quote rather than inventing a six-wheel figure
         by multiplying. */
      var sub = series === "dually"
        ? "6-wheel set · quoted to your truck"
        : (m.priceSet && m.priceSetQty
            ? "set of " + m.priceSetQty + " from " + money(m.priceSet)
            : "per wheel");
      return '<span class="wheel__price">' +
        '<span class="wheel__price-main">From <b>' + money(m.priceFrom) + '</b> / wheel</span>' +
        '<small>' + sub + '</small></span>';
    }
    return '<span class="wheel__quote">Get pricing →</span>';
  }

  // Bolt pattern -> the trucks that actually wear it. Buyers shop by truck,
  // not by PCD, so the card leads with the make and keeps the pattern as the
  // supporting detail. Patterns are sourced per style, never inferred.
  // Bolt pattern -> the makes that wear it. Buyers shop by truck, not by PCD,
  // so the card leads with the make and keeps the pattern as supporting
  // detail. Sourced per style (cast) or per brand (forged, drilled to order)
  // — never inferred, because this is fitment data.

  /* Every series render we hold for this model, in display order. Used for the
     hero image whether or not there is more than one. */
  function seriesArt(brand, m, series) {
    var F = window.WHEEL_FINISHES;
    if (!F || F.brandSlug !== brand.slug || !F.series) return [];
    var art = (F.series[series || "single"] || {})[m.model];
    if (!art) return [];
    var out = [];
    F.finishes.forEach(function (f) {
      if (art[f.code]) out.push({ finish: f.name, img: art[f.code] });
    });
    return out;
  }

  /* The hero is the series render if we hold ONE — the swatch row is a separate
     question. Conflating the two is what made Capo the odd one out: it is the
     only single with just a polished shot, so it fell through to the old
     low-res catalogue photo and rendered visibly smaller than its neighbours. */
  function heroImage(brand, m, series) {
    var art = seriesArt(brand, m, series);
    if (art.length) return art[0].img;
    if (m.imgs && m.imgs.length) return m.imgs[0].img;
    return m.img;
  }

  /* Swatches only where there is actually a choice to make. */
  function finishVariants(brand, m, series) {
    var art = seriesArt(brand, m, series);
    if (art.length > 1) return art;
    if (!art.length && m.imgs && m.imgs.length > 1) return m.imgs;
    return null;
  }

  /* The card carries the style, what it fits, and the price. Nothing else —
     on a grid you are scanning shapes, not reading specs. Bolt patterns and
     sizes live on the wheel's own page, where there is room. */
  /* Every model is a configurator — nothing is made until it is ordered, so
     there is no catalogue to browse, only a machine to pick. */
  function allBuildable(b) {
    var models = b.models || [];
    return models.length > 0 && models.every(function (m) { return m.builder; });
  }

  /* The machine tiles. Same markup and the same .mpick CSS the chooser at
     build.html uses, fed from brands.js — brand.html does not load
     builders-data.js, so tools/wire-builders.js copies `short` and `photo`
     onto the catalogue rows for exactly this. */
  function machineChooser(b) {
    if (!allBuildable(b)) return "";
    var rows = (b.models || []).slice().sort(function (x, y) {
      return (x.feat || 99) - (y.feat || 99);
    });
    return '<div class="mpick mpick--brand">' +
      rows.map(function (m) {
        /* No `bolts` means the blank is cut to order in several patterns —
           the truck. Say that rather than falling back to the wheel size,
           which answers a question nobody asked at this point. */
        var pattern = (m.bolts && m.bolts.length)
          ? m.bolts.join(" · ") : "Cut to your pattern";
        return '<a class="mpick__c" href="build.html?b=' + encodeURIComponent(m.builder) + '">' +
          '<span class="mpick__img"><img src="' + esc(m.photo || m.img) + '" alt="' +
            esc(m.short || m.model) + '" loading="lazy"></span>' +
          '<span class="mpick__t">' + esc(m.short || m.model) + "</span>" +
          '<span class="mpick__f">' + esc(pattern) +
            (m.priceSet ? " · from " + money(m.priceSet) : "") + "</span>" +
          '<span class="mpick__go">Build yours</span>' +
        "</a>";
      }).join("") +
    "</div>" +
    '<p class="mpick__note">Set of four, ' + esc(b.name) + '&rsquo;s own prices. ' +
      "Pick the machine and the bolt pattern comes with it — then the wheel builds " +
      "itself on screen as you choose. Fitment verified before we build.</p>";
  }

  function wheelCard(brand, m, series) {
    var vars = finishVariants(brand, m, series);
    var hero = heroImage(brand, m, series);
    var mediaInner = hero
      ? '<img src="' + esc(hero) + '" alt="' + esc(brand.name + " " + m.model +
          (series === "dually" ? " front and rear wheel" : "")) + '" loading="lazy">'
      : emblem(brand, m);
    /* A build-to-order model has no spec page to show — there is no single
       wheel until it is configured. The shop card has handled that since the
       builder shipped (prodCard, above); the BRAND page never learned, so
       every Price Designs style here pointed at wheel.html and said "Get
       pricing", which is the one thing it cannot do. */
    var href = m.builder
      ? "build.html?b=" + encodeURIComponent(m.builder)
      : "wheel.html?brand=" + encodeURIComponent(brand.slug) +
        "&model=" + encodeURIComponent(m.model) +
        (series ? "&series=" + series : "");
    return '<a class="wheel fade' + (vars ? ' wheel--vars' : '') +
      (series === "dually" ? ' wheel--pair' : '') + '" href="' + esc(href) + '">' +
      '<div class="wheel__media' + (hero ? '' : ' pkg__media--emblem') + '">' + mediaInner + '</div>' +
      (!vars
        /* Reserve the swatch row even with one finish, so a card with a single
           render lines up with the rest of the grid instead of riding high. */
        ? '<div class="wheel__fin wheel__fin--none" aria-hidden="true"></div>'
        : '<div class="wheel__fin" role="group" aria-label="Finishes">' +
            vars.map(function (v, i) {
              return '<button type="button" class="wheel__sw' + (i === 0 ? ' is-on is-shown' : '') + '"' +
                ' data-img="' + esc(v.img) + '" title="' + esc(v.finish) + '"' +
                ' aria-label="' + esc(v.finish) + '" style="background:' + finishDot(v.finish) + '"></button>';
            }).join("") +
            '<span class="wheel__finname">' + esc(vars[0].finish) + '</span>' +
          '</div>') +
      '<h3 class="wheel__name">' + m.model + '</h3>' +
      '<p class="wheel__avail">' +
        (series === "dually" ? "Front &amp; rear · 6-wheel set"
         : series === "single" ? "Single rear wheel"
         /* On a build-to-order card "Available in single" is both true and
            useless — every one of them is available in everything, because
            nothing is made until it is ordered. The pattern is the fact that
            decides whether it fits your machine, so that is the line. The
            truck carries none because it is cut to order in five of them. */
         : m.builder
           ? (m.bolts && m.bolts.length
                ? "Drilled " + esc(m.bolts.join(" · "))
                : "Cut to your bolt pattern")
         : availText(m)) + '</p>' +
      (m.builder
        ? '<span class="wheel__quote wheel__quote--build">Build yours \u2192</span>'
        : priceLine(brand, m, series)) +
      '</a>';
  }

  /* Finish swatches. Hover PREVIEWS — image, label and the selection ring all
     move together, so the ring always marks the finish you are looking at.
     Leaving reverts to the committed finish; tapping commits, since touch has
     no hover to preview with.

     The revert is delayed a beat. Without it, dragging a cursor across a row of
     16px dots fires a leave between every pair and the card strobes. */
  var REVERT_MS = 130;

  function bindFinishSwatches(root) {
    var timers = new WeakMap();
    var warmed = new WeakSet();

    /* Decode the other finish before it is asked for. Swapping to a cold image
       leaves a blank frame while it loads, which on a fast cursor reads as the
       swatch flickering between the two. */
    function warm(card) {
      if (warmed.has(card)) return;
      warmed.add(card);
      card.querySelectorAll(".wheel__sw").forEach(function (o) {
        if (o.dataset.img) { var i = new Image(); i.src = o.dataset.img; }
      });
    }

    function apply(card, sw) {
      if (!card || !sw) return;
      var img = card.querySelector(".wheel__media img");
      if (img && img.getAttribute("src") !== sw.dataset.img) img.src = sw.dataset.img;
      var label = card.querySelector(".wheel__finname");
      if (label) label.textContent = sw.getAttribute("title");
      card.querySelectorAll(".wheel__sw").forEach(function (o) {
        o.classList.toggle("is-shown", o === sw);
      });
    }
    function committed(card) {
      return card.querySelector(".wheel__sw.is-on") || card.querySelector(".wheel__sw");
    }
    function cancel(card) {
      var t = timers.get(card);
      if (t) { clearTimeout(t); timers.delete(card); }
    }

    /* Warm the card's images as soon as the cursor is anywhere near it, well
       before the swatches are reached. */
    root.addEventListener("mouseover", function (e) {
      var card = e.target.closest && e.target.closest(".wheel");
      if (card) warm(card);
      var sw = e.target.closest && e.target.closest(".wheel__sw");
      if (!sw) return;
      cancel(sw.closest(".wheel"));
      apply(sw.closest(".wheel"), sw);
    });

    /* Watch the whole swatch GROUP, not the individual dots. Leaving a dot
       sideways onto the "POLISHED" label is not leaving the picker, but it is
       also not hovering a dot — and the old handler only listened on dots, so
       exiting that way left the card stuck showing black forever. */
    root.addEventListener("mouseout", function (e) {
      var fin = e.target.closest && e.target.closest(".wheel__fin");
      if (!fin) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(".wheel__fin") === fin) return;   // still inside
      var card = fin.closest(".wheel");
      cancel(card);
      timers.set(card, setTimeout(function () {
        timers.delete(card);
        apply(card, committed(card));
      }, REVERT_MS));
    });

    /* Belt and braces: leaving the card at all settles it back. Covers the
       cursor jumping straight off the card without a clean mouseout. */
    root.addEventListener("mouseleave", function (e) {
      var card = e.target.closest && e.target.closest(".wheel");
      if (!card) return;
      cancel(card);
      apply(card, committed(card));
    }, true);

    root.addEventListener("click", function (e) {
      var sw = e.target.closest && e.target.closest(".wheel__sw");
      if (!sw) return;
      e.preventDefault();
      e.stopPropagation();
      var card = sw.closest(".wheel");
      cancel(card);
      card.querySelectorAll(".wheel__sw").forEach(function (o) { o.classList.toggle("is-on", o === sw); });
      apply(card, sw);
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

  /* "TIS Wheels" + " Wheels" read as "TIS Wheels Wheels" in the browser tab
     and in search results. Five brands name the category themselves — TIS
     Wheels, Vision Wheel, Method Race Wheels, Raceline Wheels and Toyo
     Tires — so the noun is only appended when it is not already there. */
  function titleFor(name, noun) {
    var n = String(name || "");
    return (new RegExp("\\b" + noun + "s?$", "i").test(n) ? n : n + " " + noun + "s") +
      " \u2014 DROOOLY Wheel & Tire";
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
    document.title = titleFor(b.name, "Wheel");
    var show = featuredModels(b);
    var total = b.models.length;
    var more = total - show.length;
    var host = (b.site || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

    /* ?series=single|dually gives each series its own page, so a dually owner
       is not scrolling through single-rear styles to reach theirs. */
    var wantSeries = new URLSearchParams(location.search).get("series");
    var avail = seriesFor(b);
    if (wantSeries && !avail.some(function (d) { return d.key === wantSeries; })) wantSeries = null;
    var seriesDef = wantSeries ? SERIES_DEFS.filter(function (d) { return d.key === wantSeries; })[0] : null;
    if (seriesDef) document.title = b.name + " " + seriesDef.title + " — DROOOLY Wheel & Tire";

    root.innerHTML =
      '<section class="wheelhero' + (textureFor(b) ? " wheelhero--brand" : "") + '"' +
        (textureFor(b) ? ' style="--brand-tex:url(' + textureFor(b) + ')"' : "") + ">" +
        '<a class="wheelhero__back" href="index.html#brands">← All brands</a>' +
        /* On the brand's own texture the logo is already white — inverting it
           for a light page would erase it. */
        '<img class="wheelhero__logo ' + (textureFor(b) ? "" : logoFx(b)) + '" src="' + logoSrc(b) + '" alt="' + esc(b.name) + '">' +
        // The logo already says the brand name — keep the h1 for search
        // engines and screen readers, but don't print it twice.
        /* On a series page the H1 names the category you are in — that is the
           one thing you need at the top. The switcher moves to the foot of the
           page, where changing lists is a next step rather than a first one. */
        /* On a series page the H1 moves down to sit directly above the grid —
           it labels the wheels, so it belongs next to them rather than shouting
           from the banner. */
        (seriesDef ? "" : '<h1 class="sr-only">' + b.name + "</h1>") +
        (b.tagline && !seriesDef ? '<p class="wheelhero__tag">' + b.tagline + '</p>' : '') +
        (seriesDef ? "" :
          '<p class="wheelhero__meta">' +
          ((more > 0 ? "Most popular styles" : total + ' wheel style' + (total === 1 ? '' : 's')) +
           ' · built to order in your size &amp; finish') + '</p>') +
        (b.priceFrom
          ? '<p class="wheelhero__from">Styles from <b>' + money(b.priceFrom) + '</b> per wheel' +
            (b.priceNote ? ' · ' + esc(b.priceNote) : '') + '</p>'
          : '') +
      '</section>' +
      '<section class="wheelwrap">' +
        /* ================================================================
           A BUILD-TO-ORDER BRAND'S PAGE IS THE CHOOSER.

           Chris: "when I click on Price Design Wheels, it just shows me all
           the wheels. It doesn't give me the option layout that I wanted."

           He was right and the machine chooser was unreachable from the menu.
           Every route into a brand — the mega menu, the brand tiles, the
           wheelbrand links — lands on brand.html?brand=<slug>, and the chooser
           only existed at build.html behind a button at the foot of this page.

           The fix is here rather than on the six link sites, because changing
           those would leave brand.html?brand=price-designs working but wrong,
           and it is the URL already in the menu, in sitemaps and in anything
           anyone has bookmarked. One page learns the difference; every route
           is fixed at once and nothing 404s or redirects.

           Gated on the DATA — every model buildable — not on a brand name, so
           the next build-to-order brand gets it for free, and a brand that
           mixes catalogue styles with a configurator keeps the normal grid.
           ================================================================ */
        machineChooser(b) +
        (allBuildable(b) ? "" : seriesSections(b, show, wantSeries)) +
        (avail.length > 1 && !allBuildable(b)
          ? '<nav class="seriesfoot" aria-label="Other series">' +
              "<span>More from " + esc(b.name) + "</span>" +
              avail.map(function (d) {
                return '<a' + (d.key === wantSeries ? ' class="on"' : "") +
                  ' href="brand.html?brand=' + b.slug + "&series=" + d.key + '">' + esc(d.menu) + "</a>";
              }).join("") +
              '<a' + (wantSeries ? "" : ' class="on"') + ' href="brand.html?brand=' + b.slug + '">Everything</a>' +
            "</nav>"
          : "") +
        /* WHERE THIS BLOCK SENDS PEOPLE MATTERS.

           For a catalogue brand it is right: we show the popular styles, the
           rest live on the manufacturer's site, and the customer comes back to
           us to buy. For a brand where EVERY product is a configurator we
           host, it was sending them to the maker's own storefront to buy from
           him instead — past our builder, our fitment and our checkout. That
           is the opposite of the point.

           So when every model is buildable here, the block points at our own
           chooser. `allBuildable` is a test of the data, not a brand name, so
           the next build-to-order brand gets the same treatment. */
        (function () {
          var models = b.models || [];
          var allBuildable = models.length > 0 && models.every(function (m) { return m.builder; });
          if (allBuildable) {
            return '<div class="wheelmore' + (textureFor(b) ? " wheelmore--brand" : "") + '"' +
              (textureFor(b) ? ' style="--brand-tex:url(' + textureFor(b) + ')"' : "") + ">" +
              (textureFor(b)
                ? '<img class="wheelmore__logo" src="' + logoSrc(b) + '" alt="' + esc(b.name) + '">'
                : "") +
              '<h3>Build it to your machine</h3>' +
              '<p>' + esc(b.name) + ' cuts every set to order — there is no off-the-shelf ' +
                'version. Pick what you are building for and the pattern, the sizes and the ' +
                'finishes follow; the wheel renders on screen as you choose.</p>' +
              '<div class="wheelmore__btns">' +
                '<a class="btn btn--primary" href="build.html">' +
                  '<span class="btn-txt">Build your own \u2192</span></a>' +
              '</div>' +
            '</div>';
          }
          if (!b.site) return "";
          return '<div class="wheelmore' + (textureFor(b) ? " wheelmore--brand" : "") + '"' +
              (textureFor(b) ? ' style="--brand-tex:url(' + textureFor(b) + ')"' : "") + ">" +
              (textureFor(b)
                ? '<img class="wheelmore__logo" src="' + logoSrc(b) + '" alt="' + esc(b.name) + '">'
                : "") +
              '<h3>' + (more > 0 ? 'See all ' + total + ' ' + esc(b.name) + ' styles'
                                 : 'See the full ' + esc(b.name) + ' lineup') + '</h3>' +
              '<p>We show the most popular styles. See the whole lineup on ' + esc(b.name) +
                '&rsquo;s site, then come back with the one you want — we build the set, mount the tires and quote it out the door.</p>' +
              '<div class="wheelmore__btns">' +
                '<a class="btn btn--primary" href="' + esc(b.site) + '" target="_blank" rel="noopener noreferrer">' +
                  '<span class="btn-txt">View more at ' + esc(host) + '</span></a>' +
              '</div>' +
            '</div>';
        })() +
      '</section>';
    bindFinishSwatches(root);
    if (window.__observeFades) window.__observeFades();
  }

  /* A dually wheel will not bolt to a single-rear truck, so showing both in
     one grid is misleading — the buyer has to know which list is theirs before
     they fall for a shape. JTX split them and so do we: singles first, then
     duallies, each with the render for that series. A style that exists as
     both appears in both, which is correct, not a duplicate.

     Brands with no series art fall back to one grid, unchanged. */
  var SERIES_DEFS = [
    { key: "single", title: "Single Series", menu: "Single rear wheel" },
    { key: "dually", title: "Dually Series", menu: "Dual rear wheel" }
  ];

  function seriesSections(b, models, only) {
    var F = window.WHEEL_FINISHES;
    if (!F || F.brandSlug !== b.slug || !F.series) {
      return '<div class="wheelgrid">' +
        models.map(function (m) { return wheelCard(b, m); }).join("") + "</div>";
    }
    var defs = only ? SERIES_DEFS.filter(function (d) { return d.key === only; }) : SERIES_DEFS;
    var out = "", spare = models.slice();
    defs.forEach(function (d) {
      var list = models.filter(function (m) { return F.series[d.key] && F.series[d.key][m.model]; });
      if (!list.length) return;
      list.forEach(function (m) {
        var i = spare.indexOf(m); if (i > -1) spare.splice(i, 1);
      });
      out += '<div class="wheelseries">' +
        /* Same heading in both views so the pages read identically — the
           dedicated page just promotes it to the H1, since there it IS the
           subject of the page rather than one section of it. */
        '<div class="wheelseries__head">' +
          (only ? "<h1>" : "<h2>") + esc(d.title) + (only ? "</h1>" : "</h2>") +
        "</div>" +
        '<div class="wheelgrid' + (d.key === "dually" ? " wheelgrid--pairs" : "") + '">' +
        list.map(function (m) { return wheelCard(b, m, d.key); }).join("") + "</div></div>";
    });
    /* Styles with no series render get no heading of their own — a "More
       styles" bucket reads as an afterthought sitting next to two real series.
       They are covered by the view-more link to the manufacturer, which is
       where the full lineup lives anyway. */
    return out;
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
    /* A WHEEL card opens that wheel's own page. A TREAD has no page of its
       own — the sizes are on this card already — so it carries the tread into
       the enquiry form instead. It used to point at
       wheel.html?brand=<tire slug>, which looks the slug up in BRANDS, misses
       every time, and showed "we couldn't find that wheel" for all 23 treads. */
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
    document.title = titleFor(b.name, "Tire");
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
        /* No series nav here. This block was copied from renderBrandPage and
           still referenced its `avail` and `wantSeries` locals, so
           renderTirePage threw ReferenceError on load and EVERY tire brand
           page rendered as a bare header and footer. A tread has no series
           to switch between, and the links it built pointed at brand.html,
           which is the wheel page. */
        (b.site
          ? '<div class="wheelmore"><h3>See the full ' + esc(b.name) + ' range</h3>' +
            '<p>Browse every tread on ' + esc(b.name) + '&rsquo;s site — then come back and we&rsquo;ll mount and balance them to your wheels.</p>' +
            '<div class="wheelmore__btns">' +
              '<a class="btn btn--primary" href="' + esc(b.site) + '" target="_blank" rel="noopener noreferrer">' +
                '<span class="btn-txt">View more at ' + esc(host) + '</span></a>' +
              '<a class="btn btn--secondary" href="index.html#fitment">Get fitted</a></div></div>'
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
    var sp = document.getElementById("shopPage"); if (sp) renderShop(sp);
    var bp = document.getElementById("brandPage"); if (bp) renderBrandPage(bp);
    var wm = document.getElementById("wheelsBrands");
    if (wm) { renderWheelsMenu(wm); bindMegaFlyouts(wm); }
    var mn = document.getElementById("mobileNav");
    if (mn) renderMobileNav(mn);
  });
})();

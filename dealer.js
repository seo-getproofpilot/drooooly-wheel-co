/* dealer.js — the sheet we hand a brand when we apply for a dealer account.
 *
 * THE POINT OF THIS PAGE. We are about to email twenty-odd wheel brands asking
 * for an account, with no trading history to point at. The one thing we can
 * show is that their line is already laid out properly on our site, with their
 * own published sizes against their own wheels — and, just as usefully, an
 * honest list of what we could NOT find. A gap we name first is an ask; a gap
 * they find themselves is a reason to pass.
 *
 * EVERY NUMBER HERE IS COUNTED, NOT WRITTEN DOWN. The hero spent weeks saying
 * "780+ Models" after the catalogue dropped to 682, because that figure was
 * typed once and never recounted. Nothing on a page we send to the brand itself
 * gets to drift like that, so this file derives all of it from BRANDS at render
 * time. The only authored strings are the boilerplate below and the parent
 * companies, which are checked rather than assumed.
 *
 * WHAT IT MUST NEVER DO. It must not imply we hold an account (CLAUDE.md
 * rule 3), must not promise fitment as a guarantee (rule 1), and must not show
 * a price for a brand that has not told us what we may advertise (rule 4).
 * The honesty block at the foot of the sheet is not decoration — the
 * photography disclosure in it is the single most load-bearing sentence on the
 * page, because every wheel image we hold was taken from their public product
 * pages and we have licensed none of it.
 */
(function () {
  "use strict";

  /* Verified 2026-10-05 by reading each brand's own footer: all four link to
     hoonigangroup.com. It matters because it is ONE application, not four —
     but that is our planning problem, so it appears on the index we keep and
     never on the sheet we send. */
  var PARENT = {
    "american-force": "Hoonigan Group",
    "fuel": "Hoonigan Group",
    "black-rhino": "Hoonigan Group",
    "kmc": "Hoonigan Group"
  };

  var PRUNED = (window.DEALER_PRUNED || { byBrand: {} });

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function plural(n, one, many) { return n === 1 ? one : (many || one + "s"); }

  /* ---- the measurement ------------------------------------------------- */

  function coverage(b) {
    var M = b.models || [];
    var sized = M.filter(function (m) { return !!m.sizeSource; });
    var photo = M.filter(function (m) { return !!m.img; });
    var fin = M.filter(function (m) { return (m.finishes || []).length; });
    var bolt = M.filter(function (m) { return (m.bolts || []).length; });
    var configs = {};
    M.forEach(function (m) {
      (m.configs || []).forEach(function (c) { configs[c] = (configs[c] || 0) + 1; });
    });
    var dia = {};
    M.forEach(function (m) {
      (m.sizes || []).forEach(function (s) {
        var d = parseInt(String(s).split("x")[0], 10);
        if (d) dia[d] = true;
      });
    });
    var dias = Object.keys(dia).map(Number).sort(function (a, z) { return a - z; });
    return {
      brand: b,
      total: M.length,
      sized: sized.length,
      photo: photo.length,
      fin: fin.length,
      bolt: bolt.length,
      noPhoto: M.filter(function (m) { return !m.img; }),
      noSize: M.filter(function (m) { return !m.sizeSource; }),
      noBolt: M.filter(function (m) { return !(m.bolts || []).length; }),
      configs: configs,
      dias: dias,
      pruned: PRUNED.byBrand[b.slug] || null
    };
  }

  function configLine(c) {
    var order = ["single", "dually", "super single", "utv"];
    var label = { single: "single", dually: "dually", "super single": "super single", utv: "side-by-side" };
    var parts = [];
    order.forEach(function (k) {
      if (c.configs[k]) parts.push(c.configs[k] + " " + label[k]);
    });
    return parts.join(" · ");
  }

  /* ---- the sheet ------------------------------------------------------- */

  function renderSheet(el, b) {
    var c = coverage(b);
    var name = esc(b.name);
    var today = new Date().toLocaleDateString("en-US",
      { year: "numeric", month: "long", day: "numeric" });

    var h = "";

    h += '<header class="dlr__top">' +
      '<a class="dlr__home" href="index.html">DROOOLY <i>Wheel &amp; Tire</i></a>' +
      '<span class="dlr__kicker">Dealer preview</span>' +
      '</header>';

    h += '<section class="dlr__mast">' +
      '<p class="dlr__eyebrow">Prepared for</p>' +
      '<h1 class="dlr__h1">' + name + '</h1>' +
      '<p class="dlr__sub">How your line is laid out on drooolywheel.co today — ' +
      'what we hold, where it came from, and what we are missing.</p>' +
      '<p class="dlr__meta">DROOOLY Wheel &amp; Tire · Grimsley, Tennessee · ' +
      esc(today) + '</p>' +
      '</section>';

    /* the lead — states plainly that we are not a dealer yet */
    h += '<section class="dlr__lede"><p>' +
      'We are a new wheel and tire shop in the Upper Cumberland, specializing in ' +
      'lifted trucks, duallys and 8-lug HD fitments — the setups most shops turn ' +
      'away. <b>We do not hold a ' + name + ' account.</b> This page exists so that ' +
      'when we ask for one you can see exactly how your wheels are already ' +
      'presented, rather than take our word for it.' +
      '</p><p>' +
      'Every figure below is counted from our live catalogue when this page ' +
      'loads. None of it is typed in, so none of it can quietly go out of date.' +
      '</p></section>';

    /* the numbers */
    h += '<section class="dlr__stats">' +
      stat(c.total, "models listed") +
      stat(c.photo, "photographed", pct(c.photo, c.total) + "%") +
      stat(c.sized, "with your published sizes", pct(c.sized, c.total) + "%") +
      stat(c.fin, "with finishes listed", pct(c.fin, c.total) + "%") +
      stat(c.bolt, "with bolt patterns", pct(c.bolt, c.total) + "%") +
      '</section>';

    if (c.dias.length) {
      /* The config tallies deliberately overlap — one wheel is commonly built
         single AND dually — so they sum past the model count. Say so, or it
         reads as an arithmetic mistake on a page whose whole claim is that the
         numbers are counted carefully. */
      var over = Object.keys(c.configs).reduce(function (a, k) {
        return a + c.configs[k];
      }, 0) > c.total;
      h += '<p class="dlr__note">Diameters represented: ' +
        c.dias[0] + '&Prime;&ndash;' + c.dias[c.dias.length - 1] + '&Prime;.' +
        (configLine(c) ? ' Built in ' + configLine(c) +
          (over ? ' — styles offered in more than one configuration are counted ' +
                  'under each.' : '.') : '') + '</p>';
    }

    /* provenance — the credibility core */
    h += '<section class="dlr__sec"><h2>Where each of those came from</h2>' +
      '<table class="dlr__tbl"><tbody>';

    h += row("Sizes",
      c.sized === c.total && c.total
        ? "All " + c.total + " read off your own published spec tables at " +
          hostOf(b.site) + "."
        : c.sized
          ? c.sized + " of " + c.total + " read off your own published spec " +
            "tables at " + hostOf(b.site) + ". The remaining " + (c.total - c.sized) +
            " carry our working sizes and are flagged in our data as unsourced."
          : "None sourced from you. Every size shown is our own working " +
            "assumption and we would replace all " + c.total +
            " with your spec sheet.");

    h += row("Photography",
      c.photo + " of " + c.total + " models carry an image, taken from your " +
      "public product pages while building this preview. " +
      (c.noPhoto.length
        ? c.noPhoto.length + " " + plural(c.noPhoto.length, "model has", "models have") +
          " no photograph and " +
          plural(c.noPhoto.length, "shows", "show") + " a neutral placeholder — " +
          "we would rather show nothing than show the wrong wheel."
        : "We have not left a single one on a placeholder."));

    h += row("Finishes",
      c.fin + " of " + c.total + " list the finishes you publish. We do not " +
      "invent a colorway, and we do not carry one brand's finish list onto another.");

    h += row("Bolt patterns",
      c.bolt
        ? c.bolt + " of " + c.total + " carry patterns you publish. The rest say " +
          (b.kind === "Forged" ? '"drilled to order"' : '"not published for this style"') +
          " rather than a blank or a guess."
        : "None published for your line that we could find, so every model says " +
          (b.kind === "Forged" ? '"drilled to order"' : '"not published for this style"') +
          " rather than a guess.");

    h += '</tbody></table></section>';

    /* the ask */
    var asks = [];
    if (c.noPhoto.length) {
      asks.push("<b>A media kit.</b> " + c.noPhoto.length + " " +
        plural(c.noPhoto.length, "model is", "models are") +
        " listed without a photograph: " +
        listOf(c.noPhoto.map(function (m) { return m.model; })) +
        ". Those light up the day we have art.");
    }
    if (c.noSize.length) {
      asks.push("<b>A spec sheet for " + c.noSize.length + " " +
        plural(c.noSize.length, "model", "models") + ".</b> We could not find " +
        "published sizes for " +
        (c.noSize.length === c.total ? "any of your line" :
          listOf(c.noSize.slice(0, 8).map(function (m) { return m.model; })) +
          (c.noSize.length > 8 ? " and " + (c.noSize.length - 8) + " others" : "")) +
        ". Sizes are the thing customers get wrong, so we would rather have yours " +
        "than our own.");
    }
    asks.push("<b>Your MAP terms in writing.</b> " + mapLine(b, c));
    asks.push("<b>Dealer pricing and freight.</b> Including whether you drop-ship " +
      "to the customer, since a six-wheel dually set is the sale we chase and " +
      "freight on it is real money.");

    h += '<section class="dlr__sec dlr__sec--ask"><h2>What we would need from you</h2>' +
      '<ol class="dlr__asks"><li>' + asks.join("</li><li>") + '</li></ol></section>';

    /* models we took down */
    if (c.pruned) {
      var one = c.pruned.n === 1;
      h += '<section class="dlr__sec"><h2>' + c.pruned.n + ' ' +
        plural(c.pruned.n, "model") + ' we took down — tell us if we were wrong</h2>' +
        '<p>On ' + esc(prettyDate(PRUNED.when)) + ' we removed every model we held ' +
        'no photograph for and could not find on ' + hostOf(b.site) + '. We assumed ' +
        (one ? 'it was' : 'they were') + ' discontinued. That is a guess, and it is ' +
        'yours to correct — <b>if ' + (one ? 'it is' : 'any of these are') +
        ' current, say so and ' + (one ? 'it goes' : 'they go') +
        ' straight back.</b></p>' +
        '<p class="dlr__pruned">' +
        c.pruned.models.map(esc).join(' &middot; ') + '</p></section>';
    }

    /* how we handle the two things brands get burned on */
    h += '<section class="dlr__sec"><h2>Two things you are probably checking for</h2>' +
      '<div class="dlr__pair">' +
      '<div class="dlr__card"><h3>We do not advertise under your floor</h3><p>' +
      mapLine(b, c) + ' Our catalogue carries a per-brand price gate, so a line ' +
      'publishes a figure only once we have been told we may. It is a switch, ' +
      'not a rewrite.</p></div>' +
      '<div class="dlr__card"><h3>We verify fitment before we build</h3><p>' +
      'We never promise a wheel will bolt up. We promise the process: every order ' +
      'runs through a fitment check against the customer’s truck, and if a ' +
      'tow weight outruns the assembly’s load rating the buy button is ' +
      'replaced with a phone call. Returns from bad fitment cost you money as well ' +
      'as us.</p></div>' +
      '</div></section>';

    /* how it looks */
    var shots = (b.models || []).filter(function (m) { return m.img; }).slice(0, 12);
    if (shots.length) {
      h += '<section class="dlr__sec"><h2>How your wheels appear on the site</h2>' +
        '<div class="dlr__grid">' +
        shots.map(function (m) {
          return '<figure class="dlr__fig"><img src="' + esc(m.img) +
            '" alt="' + name + " " + esc(m.model) + '" loading="lazy" />' +
            '<figcaption>' + esc(m.model) + '</figcaption></figure>';
        }).join("") +
        '</div>' +
        '<p class="dlr__cta"><a class="btn btn--primary" href="brand.html?brand=' +
        encodeURIComponent(b.slug) + '">See the live ' + name + ' page &rarr;</a></p>' +
        '</section>';
    }

    /* the honesty block — the most important section on the page */
    h += '<section class="dlr__sec dlr__sec--plain"><h2>What we are not claiming</h2>' +
      '<ul class="dlr__plain">' +
      '<li><b>We are not a ' + name + ' dealer.</b> Nothing on our site says we ' +
      'are, and the site is closed to search engines until that changes.</li>' +
      '<li><b>The photographs are yours, not ours.</b> Every image of your wheels ' +
      'was taken from your public product pages to build this preview. We have ' +
      'not licensed them and we are not using them commercially. Tell us what we ' +
      'should use and we will replace them — a media kit is the single most ' +
      'useful thing you can send.</li>' +
      '<li><b>We have no trading history to point at.</b> We are new. We are not ' +
      'going to tell you we move fifty sets a quarter.</li>' +
      '<li><b>Anything we could not source, we left marked unsourced</b> rather ' +
      'than filling the gap with something plausible. That is why the numbers ' +
      'above are not all 100%.</li>' +
      '</ul></section>';

    h += '<footer class="dlr__foot">' +
      '<p><b>DROOOLY Wheel &amp; Tire</b> · Grimsley, Tennessee</p>' +
      '<p><a href="tel:+16023325400">(602) 332-5400</a> · ' +
      '<a href="index.html">drooolywheel.co</a></p>' +
      '<p class="dlr__gen">Counted from our live catalogue on ' + esc(today) +
      '. Reload and the figures recount themselves.</p>' +
      '</footer>';

    el.innerHTML = h;
    document.title = "Dealer preview — " + b.name + " · DROOOLY Wheel & Tire";
  }

  function mapLine(b, c) {
    return b.pricing === "from"
      ? "We currently publish a per-wheel figure for " +
        (b.models || []).filter(function (m) { return m.priceFrom > 0; }).length +
        " of your models, taken from your own published retail. If that sits " +
        "wrong against your MAP, give us the number and we will move or pull it."
      : "We publish no price for your line at all — every card reads " +
        "“priced on request” until you tell us what we may advertise.";
  }

  function stat(n, label, sub) {
    return '<div class="dlr__stat"><b>' + n + '</b>' +
      (sub ? '<i>' + sub + '</i>' : '') +
      '<span>' + label + '</span></div>';
  }
  function row(k, v) {
    return '<tr><th>' + esc(k) + '</th><td>' + v + '</td></tr>';
  }
  /* "On 2026-10-05 we removed…" reads like a log line, not a letter. */
  function prettyDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return iso;
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-US",
      { year: "numeric", month: "long", day: "numeric" });
  }
  function hostOf(url) {
    if (!url) return "your site";
    return esc(String(url).replace(/^https?:\/\//, "").replace(/\/$/, ""));
  }
  function listOf(names) {
    if (!names.length) return "";
    if (names.length === 1) return esc(names[0]);
    return esc(names.slice(0, -1).join(", ")) + " and " + esc(names[names.length - 1]);
  }

  /* ---- the index we keep for ourselves --------------------------------- */

  function renderIndex(el) {
    var rows = (window.BRANDS || []).map(coverage).sort(function (a, z) {
      return z.total - a.total;
    });
    var totals = rows.reduce(function (a, c) {
      a.total += c.total; a.sized += c.sized; a.photo += c.photo; return a;
    }, { total: 0, sized: 0, photo: 0 });

    var h = '<header class="dlr__top">' +
      '<a class="dlr__home" href="index.html">DROOOLY <i>Wheel &amp; Tire</i></a>' +
      '<span class="dlr__kicker">Dealer sheets — internal</span></header>';

    h += '<section class="dlr__mast">' +
      '<h1 class="dlr__h1">Dealer sheets</h1>' +
      '<p class="dlr__sub">One sheet per brand, counted live. Send the link with ' +
      'the application — it shows them their own line laid out, and names the ' +
      'gaps before they find them.</p>' +
      '<p class="dlr__meta">' + rows.length + ' brands · ' + totals.total +
      ' models · ' + pct(totals.photo, totals.total) + '% photographed · ' +
      pct(totals.sized, totals.total) + '% on the brand’s own published sizes</p>' +
      '</section>';

    h += '<p class="dlr__note dlr__note--warn"><b>This index is ours, not theirs.</b> ' +
      'It names parent companies and ranks brands by how thin our data is. Send ' +
      'the individual sheet, not this page.</p>';

    /* the one grouping that changes the application plan */
    var group = {};
    Object.keys(PARENT).forEach(function (s) {
      (group[PARENT[s]] = group[PARENT[s]] || []).push(s);
    });
    Object.keys(group).forEach(function (p) {
      var kids = group[p].filter(function (s) {
        return (window.BRANDS || []).some(function (b) { return b.slug === s; });
      });
      var n = kids.reduce(function (a, s) {
        var b = (window.BRANDS || []).filter(function (x) { return x.slug === s; })[0];
        return a + (b ? b.models.length : 0);
      }, 0);
      h += '<p class="dlr__note"><b>' + esc(p) + ' owns ' + kids.length +
        ' of these brands</b> — ' + kids.map(function (s) {
          var b = (window.BRANDS || []).filter(function (x) { return x.slug === s; })[0];
          return esc(b ? b.name : s);
        }).join(", ") + ' — so that is one application covering ' + n +
        ' models. Verified ' + esc(prettyDate(PRUNED.when)) +
        ' from each brand’s own site footer.</p>';
    });

    h += '<table class="dlr__tbl dlr__tbl--index"><thead><tr>' +
      '<th>Brand</th><th>Models</th><th>Photographed</th>' +
      '<th>Their sizes</th><th>Price</th><th></th></tr></thead><tbody>';

    rows.forEach(function (c) {
      var b = c.brand;
      h += '<tr>' +
        '<td><b><a class="dlr__rowlink" href="dealer.html?brand=' +
        encodeURIComponent(b.slug) + '">' + esc(b.name) + '</a></b>' +
        (PARENT[b.slug] ? '<i class="dlr__parent">' + esc(PARENT[b.slug]) + '</i>' : '') +
        '</td>' +
        '<td>' + c.total + '</td>' +
        '<td class="' + band(pct(c.photo, c.total)) + '">' + pct(c.photo, c.total) + '%</td>' +
        '<td class="' + band(pct(c.sized, c.total)) + '">' + pct(c.sized, c.total) + '%</td>' +
        '<td>' + (b.pricing === "from" ? "shown" : "on request") + '</td>' +
        '<td><a href="dealer.html?brand=' + encodeURIComponent(b.slug) + '">Sheet &rarr;</a></td>' +
        '</tr>';
    });
    h += '</tbody></table>';

    el.innerHTML = h;
  }

  function band(p) {
    return p >= 90 ? "dlr--good" : p >= 50 ? "dlr--mid" : "dlr--thin";
  }

  /* ---- mount ----------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", function () {
    var el = document.getElementById("dealerPage");
    if (!el) return;
    var slug = new URLSearchParams(location.search).get("brand");
    var b = slug && (window.BRANDS || []).filter(function (x) {
      return x.slug === slug;
    })[0];
    if (slug && !b) {
      el.innerHTML = '<section class="dlr__mast"><h1 class="dlr__h1">No such brand</h1>' +
        '<p class="dlr__sub">We do not list a brand called &ldquo;' + esc(slug) +
        '&rdquo;. <a href="dealer.html">All dealer sheets &rarr;</a></p></section>';
      return;
    }
    if (b) renderSheet(el, b); else renderIndex(el);
    if (window.__observeFades) window.__observeFades();
  });
})();

/* ============================================================
   DROOOLY — the wheel builder

   Price Designs sells through a configurator: lug pattern, model, finish,
   ring, ring finish, caps, hardware, lug nuts, notes, priced live. This is
   that, on our site, in our language — and with the one thing his cannot do,
   because we already know the customer's truck.

   SPEC-DRIVEN. Every step, option and price comes from window.BUILDERS
   (generated from data/builders/*.json). There is no product knowledge in
   this file. A second builder — his UTV tree, a $3,000 base and a shorter
   list — is another JSON file, not another engine.

   WHY A WHOLESALE RE-RENDER. render() rebuilds every control from state
   rather than patching the one that changed. Two of the headings are derived
   from earlier answers ("{model} wheel finish" → "TURBINE WHEEL FINISH") and
   the total is derived from all of them, so a partial update is how a heading
   or a price silently stops matching the picks. ~10 steps x ~8 options is
   nothing to rebuild.

   THE ONE EXCEPTION is the notes textarea: a rebuild would destroy the caret
   mid-sentence. It is built once at mount and skipped by render(), with an
   input listener keeping S.text fed. Do not "simplify" it back into the loop.
   ============================================================ */
(function () {
  var root = document.getElementById("builderPage");
  if (!root || !window.BUILDERS) return;

  var q = new URLSearchParams(location.search);
  var SPEC = window.BUILDERS[q.get("b") || "pd-truck-17x9"];
  if (!SPEC) {
    root.innerHTML = '<section class="vizhead"><h1>We couldn’t find that builder</h1>' +
      '<p class="vizhead__lead">It may have been renamed. ' +
      '<a class="blink" href="shop.html">Browse every wheel →</a></p></section>';
    return;
  }

  /* Fitment is SOFT on purpose. wheel.js hard-requires it and a missing
     script tag silently blanks the whole page; here a missing Fitment just
     means we cannot pre-select a lug pattern, which is a lost bonus rather
     than a broken page. */
  var F = window.Fitment || null;

  /* ---- tiny helpers (same shapes visualizer.js uses) ------------------ */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) { return "$" + Number(n).toLocaleString("en-US"); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  /* ---- state ---------------------------------------------------------- */
  var S = {
    pick: {},       // stepId -> option value
    text: {},       // stepId -> string
    touched: {},    // stepId -> true, set ONLY by a real click
    prefill: null,  // {why, bolt, confidence, exact} when we chose the lug for them
    noFit: null,    // {bolt, why} when their truck's pattern is not one we build
    vehicle: null,
    showErrors: false
  };

  function stepById(id) {
    for (var i = 0; i < SPEC.steps.length; i++) if (SPEC.steps[i].id === id) return SPEC.steps[i];
    return null;
  }
  function optionOf(step, v) {
    var o = (step.options || []).filter(function (x) { return x.v === v; });
    return o.length ? o[0] : null;
  }
  function chosen(stepId) {
    var st = stepById(stepId); if (!st) return null;
    return S.pick[stepId] ? optionOf(st, S.pick[stepId]) : null;
  }

  /* "{model} wheel finish" -> "Turbine wheel finish". Unanswered tokens
     collapse out rather than rendering braces at a customer. */
  function labelFor(step) {
    return String(step.label).replace(/\{(\w+)\}/g, function (_, id) {
      var o = chosen(id);
      return o ? o.v : "";
    }).replace(/\s+/g, " ").trim();
  }

  function total() {
    return SPEC.steps.reduce(function (n, st) {
      var o = chosen(st.id);
      return n + (o && typeof o.add === "number" ? o.add : 0);
    }, SPEC.basePrice);
  }

  function missing() {
    return SPEC.steps.filter(function (st) {
      if (!st.required) return false;
      return st.type === "text" ? !String(S.text[st.id] || "").trim() : !S.pick[st.id];
    });
  }

  function configId() {
    return SPEC.id + ":" + SPEC.steps.filter(function (s) { return s.type === "chips"; })
      .map(function (s) { return S.pick[s.id] ? slug(S.pick[s.id]) : "-"; }).join(".");
  }

  function summaryLine() {
    return SPEC.steps.filter(function (s) { return s.type === "chips" && S.pick[s.id]; })
      .map(function (s) { return S.pick[s.id]; }).join(" · ");
  }

  function serialise() {
    return {
      v: 1,
      builderId: SPEC.id,
      brand: SPEC.brandName,
      brandSlug: SPEC.brand,
      title: SPEC.title + " — " + SPEC.subtitle.toLowerCase(),
      setOf: SPEC.setOf,
      basePrice: SPEC.basePrice,
      total: total(),
      perWheel: Math.round(total() / SPEC.setOf),
      currency: "USD",
      img: SPEC.image,
      configId: configId(),
      choices: SPEC.steps.filter(function (s) { return s.type === "chips" && S.pick[s.id]; })
        .map(function (s) {
          var o = chosen(s.id);
          return { stepId: s.id, step: labelFor(s), value: o.v, add: o.add || 0 };
        }),
      notes: String(S.text.notes || "").trim(),
      summary: summaryLine(),
      vehicle: S.vehicle || null,
      boltPattern: (function () { var o = chosen("lug"); return o ? o.bolt : null; })(),
      lugSource: S.prefill ? "finder" : "customer",
      builtAt: new Date().toISOString()
    };
  }

  /* ---- the fitment tie-in --------------------------------------------- */
  /* Read localStorage directly rather than calling script.js's getVeh():
     script.js loads LAST on every page and this IIFE runs at parse time, so
     getVeh is not defined yet. Three lines beats a load-order dependency that
     fails silently. */
  function readVeh() {
    try { return JSON.parse(localStorage.getItem("drooolyVehicle")); } catch (e) { return null; }
  }

  function prefillLug() {
    var st = stepById("lug");
    if (!st || !F || S.touched.lug) return;        // never overwrite a real choice
    var v = readVeh();
    if (!v || !v.make || !v.model) return;
    var hit = F.boltPattern({ year: v.year, make: v.make, model: v.model });
    if (!hit) return;
    S.vehicle = v;
    var o = (st.options || []).filter(function (x) { return x.bolt === hit.bolt; })[0];
    if (!o) {
      /* An honest negative. Their truck resolved, we just do not build this
         wheel in its pattern — an F-450's 10x225, a Ram 1500's 5x139.7. Say
         so rather than leaving the step mysteriously blank. */
      S.noFit = { bolt: hit.bolt, why: [v.year, v.make, v.model].join(" ") };
      return;
    }
    S.pick.lug = o.v;
    S.prefill = { why: [v.year, v.make, v.model].join(" "), bolt: hit.bolt,
                  confidence: hit.confidence, exact: hit.exact };
  }

  /* ---- rendering ------------------------------------------------------ */
  function chipsFor(step) {
    var anyPrice = (step.options || []).some(function (o) { return o.add; });
    return '<div class="vchips" data-step="' + esc(step.id) + '">' +
      (step.options || []).map(function (o) {
        var on = S.pick[step.id] === o.v;
        return '<button type="button" class="vchip' + (anyPrice ? " vchip--stack" : "") +
          (on ? " on" : "") + '" data-v="' + esc(o.v) + '"' +
          (on ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' +
          esc(o.v) + (o.add ? '<i>+' + money(o.add) + "</i>" : "") + "</button>";
      }).join("") + "</div>";
  }

  function noteFor(step) {
    if (step.id !== "lug") return "";
    if (S.noFit) {
      return '<p class="vnote vnote--flag">Your ' + esc(S.noFit.why) + " runs " + esc(S.noFit.bolt) +
        ", and this set is not built in that pattern. " +
        '<a class="blink" href="index.html#fitment">Tell us what you’re building</a> ' +
        "and we’ll find the wheel that is.</p>";
    }
    if (S.prefill) {
      var soft = S.prefill.confidence === "check" || !S.prefill.exact;
      return '<p class="vnote' + (soft ? " vnote--flag" : "") + '">Pre-selected from your ' +
        esc(S.prefill.why) + " — " + esc(S.prefill.bolt) + ". Change it if that’s not the truck. " +
        (soft ? "We’ll confirm this pattern with you before anything is cut."
              : "Fitment verified before we build.") + "</p>";
    }
    return "";
  }

  function renderSteps() {
    var host = document.getElementById("bSteps");
    var missIds = S.showErrors ? missing().map(function (s) { return s.id; }) : [];
    host.innerHTML = SPEC.steps.map(function (st) {
      if (st.type === "text") return '<div class="vfld" data-step="' + esc(st.id) + '" data-text="1"></div>';
      var o = chosen(st.id);
      var bad = missIds.indexOf(st.id) > -1;
      return '<div class="vfld' + (bad ? " vfld--hero" : "") + '" data-step="' + esc(st.id) + '">' +
        "<label>" + esc(labelFor(st)) + "<b>" + (o ? esc(o.v) : "—") + "</b></label>" +
        chipsFor(st) +
        (bad ? '<p class="vnote vnote--flag">Pick one to finish your build.</p>' : noteFor(st)) +
        "</div>";
    }).join("");
    mountText();
  }

  /* The textarea is built once and never re-rendered — a rebuild mid-sentence
     would drop the caret. renderSteps() leaves an empty shell for it. */
  var textEl = null;
  function mountText() {
    var st = SPEC.steps.filter(function (s) { return s.type === "text"; })[0];
    if (!st) return;
    var shell = document.querySelector('.vfld[data-step="' + st.id + '"][data-text="1"]');
    if (!shell) return;
    if (!textEl) {
      textEl = document.createElement("textarea");
      textEl.id = "bNotes";
      textEl.rows = 3;
      textEl.placeholder = st.placeholder || "";
      textEl.addEventListener("input", function () { S.text[st.id] = textEl.value; });
    }
    shell.innerHTML = "<label>" + esc(labelFor(st)) + "<b>optional</b></label>";
    shell.appendChild(textEl);
  }

  function renderStage() {
    var t = total();
    var done = SPEC.steps.filter(function (s) { return s.type === "chips" && S.pick[s.id]; }).length;
    var all = SPEC.steps.filter(function (s) { return s.type === "chips"; }).length;
    document.getElementById("bTotal").innerHTML =
      "<span>Set of " + SPEC.setOf + " · " + done + " of " + all + " chosen</span>" +
      "<b>" + money(t) + "</b>";
    document.getElementById("bPer").textContent = money(Math.round(t / SPEC.setOf)) + " per wheel";

    var rows = SPEC.steps.filter(function (s) { return s.type === "chips"; }).map(function (s) {
      var o = chosen(s.id);
      return '<div class="vstat"><span>' + esc(labelFor(s)) + "</span><b>" +
        (o ? esc(o.v) + (o.add ? " · +" + money(o.add) : "") : "—") + "</b></div>";
    }).join("");
    document.getElementById("bReadout").innerHTML = rows;
  }

  /* On a phone the stage scrolls away above ten steps, taking the running
     total with it. A fixed bar keeps the number and the action in reach —
     desktop hides it, because there the stage is sticky already. */
  var bbar = null;
  function renderBar() {
    if (!bbar) {
      bbar = document.createElement("div");
      bbar.className = "bbar";
      bbar.innerHTML = '<div class="bbar__v"><span></span><b></b></div>' +
        '<button class="btn btn--primary btn--sm" type="button"><span class="btn-txt">Send build</span></button>';
      bbar.querySelector("button").addEventListener("click", function () {
        document.getElementById("bSubmit").click();
      });
      document.body.appendChild(bbar);
      document.body.classList.add("has-bbar");
    }
    var done = SPEC.steps.filter(function (s) { return s.type === "chips" && S.pick[s.id]; }).length;
    var all = SPEC.steps.filter(function (s) { return s.type === "chips"; }).length;
    bbar.querySelector("span").textContent = "Set of " + SPEC.setOf + " \u00b7 " + done + "/" + all;
    bbar.querySelector("b").textContent = money(total());
  }

  function render() { renderSteps(); renderStage(); renderBar(); }

  /* ---- actions -------------------------------------------------------- */
  function pick(stepId, v) {
    S.pick[stepId] = v;
    S.touched[stepId] = true;
    if (stepId === "lug") { S.prefill = null; S.noFit = null; }
    if (S.showErrors && !missing().length) S.showErrors = false;
    render();
  }

  function reset() {
    S.pick = {}; S.text = {}; S.touched = {}; S.prefill = null; S.noFit = null;
    S.showErrors = false;
    if (textEl) textEl.value = "";
    prefillLug();                 // back to what we know, not to blank
    render();
  }

  /* ---- page ----------------------------------------------------------- */
  root.innerHTML =
    '<section class="vizhead fade">' +
      '<p class="kicker"><b>' + esc(SPEC.brandName) + "</b> · built to order</p>" +
      "<h1>" + esc(SPEC.title) + "</h1>" +
      '<p class="vizhead__lead">' + esc(SPEC.subtitle) + ". " + esc(SPEC.madeIn) + "</p>" +
      '<p class="vizhead__note">' + esc(SPEC.includes) + "</p>" +
    "</section>" +
    '<div class="vizgrid vizgrid--build">' +
      '<section class="vizpanel" id="bSteps"></section>' +
      '<aside class="vizstage fade">' +
        '<img class="bhero" src="' + esc(SPEC.image) + '" alt="' + esc(SPEC.brandName + " " + SPEC.title) + '" />' +
        '<div class="vfld--hero bprice" id="bTotal"></div>' +
        '<p class="vnote" id="bPer"></p>' +
        '<div class="vreadout" id="bReadout"></div>' +
        '<div class="vcta">' +
          '<button class="btn btn--primary" id="bSubmit"><span class="btn-txt">Send this build to DROOOLY</span></button>' +
          '<button class="vpin" id="bReset">Start over</button>' +
        "</div>" +
        '<p class="vnote">Prices are ' + esc(SPEC.brandName) + "’s own, for the set. " +
          "Fitment verified before we build — we confirm the pattern and the offset with you first.</p>" +
      "</aside>" +
    "</div>";

  /* one delegated listener, so re-rendering the chips never leaks handlers */
  document.getElementById("bSteps").addEventListener("click", function (e) {
    var chip = e.target.closest(".vchip");
    if (!chip) return;
    var wrap = chip.closest(".vchips");
    pick(wrap.dataset.step, chip.dataset.v);
  });

  document.getElementById("bReset").addEventListener("click", reset);

  document.getElementById("bSubmit").addEventListener("click", function () {
    var miss = missing();
    if (miss.length) {
      S.showErrors = true; render();
      var el = document.querySelector('.vfld[data-step="' + miss[0].id + '"]');
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    var build = serialise();
    try { localStorage.setItem("drooolyBuild", JSON.stringify(build)); } catch (e) {}

    /* ---- CART SEAM ---------------------------------------------------
       Deferred deliberately — Chris: "the payment side of it, or how you
       can add it to your cart, let's do that at the very end." This is the
       ONLY call site, so that decision is one edit.

       Three things have to change in cart.js first, and none of them are
       cosmetic:
         1. cart.js:18 — the stored literal is exactly
            {key, brand, name, price, img, qty}. It DROPS unknown fields, so
            `choices` and `notes` would vanish on the way in.
         2. cart.js render() concatenates brand/name into innerHTML with no
            escaping. Nothing user-controlled reaches it today; a build
            carrying a free-text note would be the first, and that is an XSS
            hole. Escape it before wiring this up.
         3. `key` is the dedupe identity. configId is already the right one —
            two different builds of the same wheel must not merge into a
            single line with qty 2.

       window.Cart.add({ key: build.configId, brand: build.brand,
                         name: build.title, price: build.total,
                         img: build.img, qty: 1, build: build });
    -------------------------------------------------------------------- */

    location.href = "index.html?w=" + encodeURIComponent(build.brand + " " + build.title +
      " — " + build.summary + " (" + money(build.total) + ")") + "#fitment";
  });

  /* public surface, so whoever closes the cart seam has one thing to call */
  window.Builder = { get: serialise, summary: summaryLine, reset: reset, total: total };

  prefillLug();
  render();
  if (window.__observeFades) window.__observeFades();
})();

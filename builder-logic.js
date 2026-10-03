/* ============================================================
   DROOOLY — builder rules, with no DOM in sight

   CLAUDE.md: "Fitment logic lives in one module, testable independently of
   UI." The same argument applies here, and harder. Four things need to agree
   about which steps a builder shows:

     builder.js                   renders them
     tools/scrape-price-designs.js  decides which are reachable, and so which
                                  survive into the spec at all
     tools/make-builder-cards.js   composites a card from a state the engine
                                  must also be able to reach
     tools/build-builders.js       prices the dearest build that can exist

   They were four copies for about an hour, and the copies had already started
   to disagree. This is the one copy. It is loaded by a <script> tag on
   build.html and require()d by the three tools and by tools/test-builders.js.

   ------------------------------------------------------------------
   THE HIDE RULE, which is not the obvious one
   ------------------------------------------------------------------
   Each step carries `hideWhen: [{step, value}, ...]`, read off the `logic`
   block in Price Designs' own builder config. The rules are a FLAT OR and
   they HIDE:

       hidden  ⇔  ∃ rule r : pick[r.step] === r.value

   `operator:"||"` sits on every rule in his data and several steps draw rules
   from two different categories, which makes an AND-across-categories reading
   look right until you test it. It was settled on 2026-10-02 against his live
   builder: with FORD 6X135 his page renders ten steps and this predicts the
   same ten in order; with GM 8X180 it renders sixteen and this predicts the
   same sixteen. tools/test-builders.js pins both as fixtures.

   TWO THINGS ON TOP OF HIS RULE, both in visible():

   A. A HIDDEN STEP HOLDS NO ANSWER. Choose HALO, answer HALO RING FINISH,
      then go back to SAWBLADE: the halo finish step disappears, and if its
      answer survived it would keep firing the rules other steps hang off —
      POST-CUT HALO RING? would stay open on a wheel with no halo ring, and
      its layer would stay in the render. Clearing can itself un-hide a step,
      which can hide another, so this iterates to a fixed point. It always
      terminates: every pass only deletes, so the answer set shrinks.

   B. GATING — a branch nobody has chosen yet stays shut. His truck tree
      branches on the lug pattern, and each arm hides itself when the OTHER
      patterns are chosen. With no pattern chosen at all neither arm is
      hidden, so the raw rule shows two SELECT MODEL steps, four wheel-finish
      steps and two POST-CUT WHEEL?. His page only avoids that by
      auto-selecting the first lug pattern on load.

      We will not auto-select a bolt pattern — picking 6x135 for a customer
      and pricing it is the kind of quiet assumption the fitment rules exist
      to stop. So a step waits while any choice it hangs off is on the page
      and unanswered. Gating reads EVERY branch choice as a gate, not only the
      ones he flagged required, because his flags do not track which ones
      branch: the eight-lug SELECT MODEL is flagged optional and is the most
      branch-y step in the tree.

      Pass {gate:false} to get his raw behaviour — that is what the live
      fixtures are checked against, since it is his page they were read from.
   ============================================================ */
(function () {
  "use strict";

  /* Which steps are on the page, and what the answers effectively are.
     `pick` is never mutated. */
  function visible(steps, pick, opts) {
    var gate = !opts || opts.gate !== false;
    var byId = {}, eff = {}, k;
    steps.forEach(function (st) { byId[st.id] = st; });
    for (k in pick) if (Object.prototype.hasOwnProperty.call(pick, k) && pick[k] !== undefined) eff[k] = pick[k];

    /* A fact is not a question — it is always in force, so it is seeded before
       anything is evaluated and may legitimately hide other steps. */
    steps.forEach(function (st) {
      if (st.type === "fact" && st.options && st.options.length) eff[st.id] = st.options[0].v;
    });

    var hid = {};
    for (var i = 0; i <= steps.length; i++) {           // (A) clear to a fixed point
      var changed = false;
      hid = {};
      steps.forEach(function (st) {
        var h = (st.hideWhen || []).some(function (r) { return eff[r.step] === r.value; });
        hid[st.id] = h;
        if (h && eff[st.id] !== undefined) { delete eff[st.id]; changed = true; }
      });
      if (!changed) break;
    }

    if (gate) {                                          // (B) shut undecided branches
      for (var pass = 0; pass <= steps.length; pass++) {
        var more = false;
        steps.forEach(function (st) {
          if (hid[st.id] || !st.hideWhen) return;
          var waiting = st.hideWhen.some(function (r) {
            if (r.step === st.id) return false;
            var g = byId[r.step];
            return g && g.type === "chips" && !hid[g.id] && eff[g.id] === undefined;
          });
          if (waiting) { hid[st.id] = true; more = true; }
        });
        if (!more) break;
      }
    }

    return {
      steps: steps.filter(function (st) { return !hid[st.id]; }),
      pick: eff
    };
  }

  /* Steps that carry money and art. A text note is neither. */
  function priced(vis) {
    return vis.steps.filter(function (s) { return s.type === "chips" || s.type === "fact"; });
  }

  function optionOf(step, v) {
    var o = (step.options || []).filter(function (x) { return x.v === v; });
    return o.length ? o[0] : null;
  }

  function total(spec, vis) {
    return priced(vis).reduce(function (n, st) {
      var o = optionOf(st, vis.pick[st.id]);
      return n + (o && typeof o.add === "number" ? o.add : 0);
    }, spec.basePrice);
  }

  /* The stack, bottom to top. A step's z is his own category order, which is
     what puts the barrel under the face and the ring hardware over everything. */
  function layerPlan(spec, vis) {
    var out = [];
    if (spec.baseLayer) out.push({ key: "__base", z: -1, file: spec.baseLayer });
    priced(vis).forEach(function (st) {
      var o = optionOf(st, vis.pick[st.id]);
      if (o && o.layer) out.push({ key: st.id, z: (typeof st.z === "number" ? st.z : 0), file: o.layer });
    });
    return out.sort(function (a, b) { return a.z - b.z; });
  }

  /* Fill in anything still blank with its first option, re-evaluating as it
     goes because answering one step can open another. Used where there is
     nobody to ask — the card images, and the price ceiling. The page does NOT
     use this; it asks. */
  function complete(spec, pick, opts) {
    var p = {}, k;
    for (k in (pick || {})) p[k] = pick[k];
    for (var pass = 0; pass < 8; pass++) {
      var v = visible(spec.steps, p, opts);
      p = v.pick;
      v.steps.forEach(function (st) {
        if (st.type !== "chips" || p[st.id] !== undefined) return;
        var o = st.options || [];
        if (!o.length) return;
        p[st.id] = opts && opts.dearest
          ? o.reduce(function (a, b) { return (b.add || 0) > (a.add || 0) ? b : a; }).v
          : o[0].v;
      });
    }
    return visible(spec.steps, p, opts);
  }

  var API = {
    visible: visible,
    priced: priced,
    optionOf: optionOf,
    total: total,
    layerPlan: layerPlan,
    complete: complete
  };

  if (typeof window !== "undefined") window.BuilderLogic = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();

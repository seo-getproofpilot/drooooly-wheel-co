/* site-flags.js — the one switchboard for everything we are hiding pre-launch.
 *
 * WHY THIS EXISTS. Most of what came off the site on 2026-10-11 is coming back:
 * prices once MAP terms are confirmed per brand, financing once a lender
 * approves us, the trust stats once they are real, mount and balance once we
 * actually offer it. None of it was deleted. It is tagged, gated, and recorded
 * in PARKED.md with the original wording.
 *
 * TURNING SOMETHING BACK ON IS ONE LINE HERE. If you ever find yourself
 * rebuilding a thing rather than flipping a flag, something has gone wrong and
 * PARKED.md is where the original lives.
 *
 * LOADS FIRST, on every page, before any other script — the renderers read
 * these at module scope and the static-markup sweep runs on DOMContentLoaded.
 */
window.DROOOLY_FLAGS = {
  /* Dollar figures anywhere a customer can see them. Off until MAP terms are
     in writing per brand (CLAUDE.md rule 4, LAUNCH-CHECKLIST 2.2). The prices
     themselves stay in brands.js / builders-data.js / tires.js untouched. */
  showPrices: false,

  /* "0% financing available", "$0 down", "terms up to 24 months", the lender
     logo row, and the APR fine print. Off until a lender actually approves us
     — displaying their marks without a merchant agreement is the problem, not
     the copy (LAUNCH-CHECKLIST 1.10, 2.7). */
  showFinancingClaims: false,

  /* "4.9 · 1,200+ trucks fitted" and the Instagram counts. A shop that has not
     opened has not fitted 1,200 trucks. Off until the numbers are real. */
  showTrustStats: false,

  /* We are launching drop-ship and unmounted. Off until we have a bay and
     actually mount wheels. */
  showMountBalance: false,

  /* Manufacturer logos for brands we hold no dealer account with. Price
     Designs is signed; everyone else shows as plain type until they are.

     ON as of 2026-10-12, Chris's call. The footer disclaimer and terms.html
     are what make this defensible: they say in writing that we are an
     independent retailer, that the marks belong to their owners, that they
     appear only to identify products we can source, and that we will take a
     listing down on request. That is nominative use, not a claim of
     endorsement. Flip it back to false and every mark becomes plain type
     again with no other change. */
  showUnsignedBrandLogos: true,

  /* No mailing list yet. Note there is currently NO newsletter markup on any
     page — script.js's `.news form` handler matches nothing and has done for
     a while. The flag is here so that whoever adds the markup back has an
     obvious gate to hang it on rather than shipping a signup to nowhere. */
  showNewsletter: false,

  /* The Instagram section quotes a follower count we do not have and embeds
     a grid of posts that are not ours. Off until the account is real and the
     posts are our own work. */
  showInstagram: false,

  /* The whole financing story, not just its claims. Off until a lender has
     approved us -- see PAYMENTS.md. showFinancingClaims below still governs
     the individual numbers if the section ever comes back partially. */
  showFinancing: false,

  /* The build gallery photographs. Not the captions -- the pictures. They are
     other people's trucks and we have not licensed them
     (LAUNCH-CHECKLIST section 1). Off until the gallery is our own work,
     which the local trucks fitted between November and March will supply. */
  showBuildGallery: false,

  /* The tyre catalogue lists seven makers. We are only pursuing two accounts
     right now -- Fury and Venom Power -- so only those two are shown. The
     other five stay in tires.js and data/tires/ untouched and come back with
     one value. */
  showAllTireBrands: false,

  /* Build-gallery captions describing trucks that are not ours. Off until the
     gallery is our own work. The photographs are a separate question
     (LAUNCH-CHECKLIST section 1) and are untouched by this flag. */
  showGalleryCaptions: false
};

/* Small shared API so render code reads the same way everywhere. */
window.DROOOLY = window.DROOOLY || {};
window.DROOOLY.flag = function (name) {
  return !!(window.DROOOLY_FLAGS && window.DROOOLY_FLAGS[name]);
};
/* The standard replacement wherever a figure used to sit. */
window.DROOOLY.QUOTE = "Get a quote";
window.DROOOLY.QUOTE_LONG = "Priced on your quote";

/* Static markup: tag an element data-flag="showPrices" and it disappears when
   that flag is false. The CSS rule below is injected rather than living in
   styles.css so a page that forgets the stylesheet still hides correctly, and
   it runs before first paint so nothing flashes on screen and then vanishes. */
(function () {
  "use strict";
  var F = window.DROOOLY_FLAGS || {};
  var off = Object.keys(F).filter(function (k) { return !F[k]; });
  var on = Object.keys(F).filter(function (k) { return !!F[k]; });
  /* data-flag       — show only while the flag is ON  (hidden now)
     data-flag-not   — show only while the flag is OFF (the stand-in copy),
                       so a section that would otherwise read empty can say
                       something honest instead of disappearing. */
  var css = off.map(function (k) { return '[data-flag="' + k + '"]'; })
    .concat(on.map(function (k) { return '[data-flag-not="' + k + '"]'; }))
    .join(",") + "{display:none!important}";
  var el = document.createElement("style");
  el.id = "drooooly-flags";
  el.textContent = css;
  (document.head || document.documentElement).appendChild(el);

  /* <option> ignores display:none in several browsers, so a flagged option
     has to actually leave the DOM or the customer can still pick "Price:
     low to high" on a site with no prices. */
  document.addEventListener("DOMContentLoaded", function () {
    off.forEach(function (k) {
      document.querySelectorAll('option[data-flag="' + k + '"]').forEach(function (o) {
        o.remove();
      });
    });
  });
})();

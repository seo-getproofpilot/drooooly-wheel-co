/* ============================================================
   DROOOLY — "on real trucks" gallery

   Seeing a wheel render is not the same as seeing it bolted to a truck, and
   that gap is where people lose their nerve before spending five figures.
   This closes it with photographs of the actual wheel in the wild.

   We host NOTHING. Every tile points at the manufacturer's own file on their
   own server and links back to their gallery. That is what keeps this a
   link-out feature. See LAUNCH-CHECKLIST.md.
   ============================================================ */
(function () {
  var root = document.getElementById("buildsPage");
  if (!root) return;

  var DATA = window.WHEEL_BUILDS;
  var q = new URLSearchParams(location.search);
  var wantModel = q.get("model");

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  function empty(msg, sub) {
    root.innerHTML =
      '<section class="bhead"><a class="bback" href="shop.html">← All wheels</a>' +
      '<h1>' + esc(msg) + "</h1>" +
      (sub ? '<p class="bhead__lead">' + esc(sub) + "</p>" : "") +
      (DATA ? '<p class="bhead__lead"><a class="blink" href="' + esc(DATA.source) +
        '" target="_blank" rel="noopener">Browse the full ' + esc(DATA.brand) +
        " gallery →</a></p>" : "") +
      "</section>";
  }

  if (!DATA) return empty("Nothing to show yet", "The build gallery hasn't been generated.");

  var shots = wantModel ? (DATA.models[wantModel] || []) : [];
  if (!wantModel) {
    /* No model asked for: list what we do have, so the page is still useful
       rather than a dead end. */
    var have = Object.keys(DATA.models)
      .filter(function (m) { return DATA.models[m].length >= DATA.minPhotos; })
      .sort(function (a, b) { return DATA.models[b].length - DATA.models[a].length; });
    root.innerHTML =
      '<section class="bhead"><a class="bback" href="shop.html">← All wheels</a>' +
      "<h1>" + esc(DATA.brand) + " on real builds</h1>" +
      '<p class="bhead__lead">A wheel looks like a different product once it is bolted on. ' +
      "These are the builds wearing them.</p></section>" +
      '<div class="bindex">' + have.map(function (m) {
        return '<a class="bindex__item" href="builds.html?model=' + encodeURIComponent(m) + '">' +
          "<b>" + esc(m) + "</b><span>" + DATA.models[m].length + " builds</span></a>";
      }).join("") + "</div>" + credit();
    return;
  }

  if (shots.length < DATA.minPhotos) {
    /* Below the floor we say so and hand them the manufacturer's gallery.
       A link promising builds and delivering one photo is worse than no link. */
    return empty(
      wantModel + " — not enough build photos yet",
      "We only have " + shots.length + " photo" + (shots.length === 1 ? "" : "s") +
      " of this style on a truck, which isn't enough to be worth your time. " +
      "It's on the list to fix as we photograph our own installs."
    );
  }

  function caption(s) {
    var bits = [s.vehicle, s.size, s.finish].filter(Boolean);
    return bits.length ? bits.join(" · ") : DATA.brand + " " + s.model;
  }

  function credit() {
    return '<p class="bcredit">Photos by ' + esc(DATA.brand) +
      ". Shown from their gallery — every photo links back to them. " +
      '<a class="blink" href="' + esc(DATA.source) + '" target="_blank" rel="noopener">' +
      "See the full gallery →</a></p>";
  }

  root.innerHTML =
    '<section class="bhead">' +
    '<a class="bback" href="brand.html?brand=' + esc(DATA.brandSlug) + '">← All ' + esc(DATA.brand) + " wheels</a>" +
    "<h1>" + esc(DATA.brand + " " + wantModel) + " on real builds</h1>" +
    '<p class="bhead__lead">' + shots.length + " builds running this style. " +
    "A render tells you the spoke pattern; these tell you how it wears on a truck.</p>" +
    "</section>" +
    '<div class="bgrid">' + shots.map(function (s) {
      return '<a class="bshot" href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(s.url) + '" alt="' + esc(DATA.brand + " " + s.model + " on " + (s.vehicle || "a truck")) +
        '" loading="lazy" />' +
        '<span class="bshot__cap">' + esc(caption(s)) + "</span></a>";
    }).join("") + "</div>" +
    credit();
})();

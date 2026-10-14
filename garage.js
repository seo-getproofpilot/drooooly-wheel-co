/* ============================================================
   DROOOLY — My garage (garage.html)

   Lists the builds the signed-in shopper saved: visualizer builds open at
   /visualize/ with their share string, builder builds reopen the brand
   builder with the picks restored (builder.js reads the handoff in
   localStorage). A visitor who is not signed in gets the sign-in sheet and
   a plain explanation, never a wall.
   ============================================================ */
(function () {
  var root = document.getElementById("garageList");
  var who = document.getElementById("garageWho");
  if (!root) return;
  var acct = window.DrooolyAccount;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  if (!acct) {
    root.innerHTML = '<div class="garage__empty">Sign-in is not available right now. Your builds still work as share links.</div>';
    return;
  }

  /* only same-site paths and page names open from a saved row */
  function safeHref(url) {
    var u = String(url || "");
    if (/^\/(visualize\/|[a-z0-9-]+\.html)/.test(u) || /^[a-z0-9-]+\.html/.test(u)) return u;
    return null;
  }
  function when(iso) {
    try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; }
  }
  function stillUrl(r) {
    if (!r.still_key) return null;
    var base = (window.DROOOLY_RENDER_URL || "https://render-staging-3d31.up.railway.app").replace(/\/$/, "");
    return base + "/stills/" + encodeURIComponent(r.still_key) + ".jpg";
  }
  function card(r) {
    var href = safeHref(r.url);
    var img = stillUrl(r) || (r.data && r.data.img) || null;
    var name = r.name || (r.source === "builder" ? (r.data && r.data.title) || "Builder build" : "Visualizer build");
    var meta = r.source === "builder" ? "Brand builder · " + esc(r.data && r.data.brand || "") : "3D visualizer";
    return '<article class="gcard" data-id="' + esc(r.id) + '">' +
      '<div class="gcard__img">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" />' : 'No photo yet') + '</div>' +
      '<div class="gcard__body">' +
        '<h2 class="gcard__name">' + esc(name) + '</h2>' +
        '<div class="gcard__meta">' + meta + ' · saved ' + esc(when(r.created_at)) + '</div>' +
        '<div class="gcard__row">' +
          (href ? '<a class="btn btn--primary" href="' + esc(href) + '" data-open="' + esc(r.id) + '"><span class="btn-txt">Open</span></a>' : '') +
          (href && r.source === "visualize" ? '<button class="btn" type="button" data-share="' + esc(href) + '"><span class="btn-txt">Copy link</span></button>' : '') +
          '<button class="gcard__link" type="button" data-rename="' + esc(r.id) + '">Rename</button>' +
          '<button class="gcard__link" type="button" data-remove="' + esc(r.id) + '">Delete</button>' +
        '</div>' +
      '</div></article>';
  }
  var rows = [];
  function paint() {
    if (!rows.length) {
      root.innerHTML = '<div class="garage__empty">Nothing saved yet. Build a set on your truck and tap Save my build, and it lands here.</div>';
      return;
    }
    root.innerHTML = '<div class="garage__grid">' + rows.map(card).join("") + '</div>';
  }
  function load() {
    acct.list().then(function (list) { rows = list || []; paint(); }).catch(function () {
      root.innerHTML = '<div class="garage__empty">We could not load your garage right now. Try again in a minute.</div>';
    });
  }
  function signedOut() {
    who.innerHTML = 'Sign in to see the builds you saved. <button type="button" id="garageSignIn">Sign in</button>';
    root.innerHTML = '<div class="garage__empty">Your saved builds show here once you sign in with your email. No password needed.</div>';
    document.getElementById("garageSignIn").addEventListener("click", function () { acct.signIn({ lead: "Enter the email you saved your builds with." }); });
  }
  acct.onChange(function (u) {
    if (!u) { signedOut(); return; }
    who.innerHTML = 'Signed in as <b>' + esc(u.email) + '</b><button type="button" id="garageOut">Sign out</button>';
    document.getElementById("garageOut").addEventListener("click", function () { acct.signOut(); });
    load();
  });

  root.addEventListener("click", function (e) {
    var open = e.target.closest("[data-open]");
    if (open) {
      var r = rows.filter(function (x) { return x.id === open.dataset.open; })[0];
      /* the brand builder restores picks from this handoff on load */
      if (r && r.source === "builder" && r.data) { try { localStorage.setItem("drooolyRestoreBuild", JSON.stringify(r.data)); } catch (err) { /* private mode */ } }
      return;
    }
    var share = e.target.closest("[data-share]");
    if (share) {
      var url = location.origin + share.dataset.share;
      navigator.clipboard.writeText(url).then(function () { share.querySelector(".btn-txt").textContent = "Link copied"; setTimeout(function () { share.querySelector(".btn-txt").textContent = "Copy link"; }, 2500); })
        .catch(function () { window.prompt("Copy this link", url); });
      return;
    }
    var ren = e.target.closest("[data-rename]");
    if (ren) {
      var art = ren.closest(".gcard"); var id = ren.dataset.rename;
      var cur = rows.filter(function (x) { return x.id === id; })[0];
      if (art.querySelector(".gcard__rename")) return;
      var box = document.createElement("form"); box.className = "gcard__rename";
      box.innerHTML = '<input type="text" maxlength="80" value="' + esc(cur && cur.name || "") + '" aria-label="Build name" /><button class="btn btn--primary" type="submit"><span class="btn-txt">Save</span></button>';
      art.querySelector(".gcard__body").appendChild(box);
      box.querySelector("input").focus();
      box.addEventListener("submit", function (ev) {
        ev.preventDefault();
        acct.rename(id, box.querySelector("input").value.trim()).then(function (row) { rows = rows.map(function (x) { return x.id === id ? row : x; }); paint(); }).catch(function () { box.querySelector("input").setAttribute("aria-invalid", "true"); });
      });
      return;
    }
    var rm = e.target.closest("[data-remove]");
    if (rm) {
      var rid = rm.dataset.remove;
      if (rm.dataset.armed !== "1") { rm.dataset.armed = "1"; rm.textContent = "Delete for good?"; setTimeout(function () { rm.dataset.armed = "0"; rm.textContent = "Delete"; }, 4000); return; }
      acct.remove(rid).then(function () { rows = rows.filter(function (x) { return x.id !== rid; }); paint(); }).catch(function () { rm.textContent = "Could not delete"; });
    }
  });
})();

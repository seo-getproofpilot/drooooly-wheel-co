/* ============================================================
   DROOOLY — one sign-in for the whole site (account.js)

   Email code sign-in on Supabase, a "Sign in" / "My garage" control in the
   header, a slide-in sheet for the code, and window.DrooolyAccount for the
   pages that save and list builds (builder.js, garage.js, the visualizer
   shares the session through the same origin). Loads after the Supabase UMD
   bundle and account-config.js. If either is missing, the header shows
   nothing and the save buttons stay hidden: a sign-in that cannot work is
   never shown. No passwords, no modals, email is the only field.
   ============================================================ */
(function () {
  var cfg = window.DROOOLY_ACCOUNT;
  var lib = window.supabase;
  if (!cfg || !cfg.URL || !cfg.KEY || !lib || !lib.createClient) return;

  var client = lib.createClient(cfg.URL, cfg.KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  var user = null;
  var listeners = [];
  var ready = client.auth.getSession().then(function (r) { setUser(r.data && r.data.session ? r.data.session.user : null); }).catch(function () { setUser(null); });
  client.auth.onAuthStateChange(function (_evt, session) { setUser(session ? session.user : null); });

  function setUser(u) {
    user = u;
    renderHeader();
    listeners.forEach(function (fn) { try { fn(u); } catch (e) { /* a listener's problem */ } });
  }

  /* ---- header control ------------------------------------------------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function renderHeader() {
    var actions = document.querySelector(".nav__actions");
    if (actions && !actions.querySelector(".nav__acct")) {
      var a = document.createElement("a");
      a.className = "nav__acct";
      a.href = "garage.html";
      actions.insertBefore(a, actions.querySelector(".cart-btn") || null);
      a.addEventListener("click", function (e) { if (!user) { e.preventDefault(); open(); } });
    }
    var el = document.querySelector(".nav__acct");
    if (el) { el.textContent = user ? "My garage" : "Sign in"; el.setAttribute("aria-label", user ? "My garage, signed in as " + user.email : "Sign in"); }
    var mob = document.getElementById("mobileNav");
    if (mob && !mob.querySelector(".mobile-nav__acct")) {
      var m = document.createElement("a");
      m.className = "mobile-nav__acct";
      m.href = "garage.html";
      m.addEventListener("click", function (e) { if (!user) { e.preventDefault(); mob.classList.remove("open"); open(); } });
      var last = mob.querySelector("a:last-child");
      mob.insertBefore(m, last);
    }
    var ml = document.querySelector(".mobile-nav__acct");
    if (ml) ml.textContent = user ? "My garage" : "Sign in";
    document.documentElement.setAttribute("data-signed-in", user ? "1" : "0");
  }

  /* ---- the sheet ------------------------------------------------------ */
  var overlay, sheet, state, onDone;
  function ensureSheet() {
    if (sheet) return;
    overlay = document.createElement("div"); overlay.className = "acct-overlay"; overlay.addEventListener("click", close);
    sheet = document.createElement("aside"); sheet.className = "acct-sheet"; sheet.setAttribute("aria-label", "Sign in");
    document.body.appendChild(overlay); document.body.appendChild(sheet);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheet.classList.contains("open")) close(); });
  }
  function render() {
    var s = state;
    sheet.innerHTML =
      '<div class="acct-sheet__head"><h3>' + (s.step === "code" ? "Check your email" : "Save it to your garage") + '</h3>' +
      '<button class="acct-sheet__close" type="button" aria-label="Close">✕</button></div>' +
      '<form class="acct-form" novalidate>' +
      (s.step === "code"
        ? '<p class="acct-lead">We sent a six digit code to <b>' + esc(s.email) + '</b>. It works for one hour.</p>' +
          '<label class="acct-label" for="acctCode">Your code</label>' +
          '<input class="acct-input acct-input--code" id="acctCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required ' + (s.busy ? "disabled" : "") + ' />' +
          '<p class="acct-err" ' + (s.error ? "" : "hidden") + '>' + esc(s.error) + '</p>' +
          '<button class="btn btn--primary acct-submit" type="submit" ' + (s.busy ? "disabled" : "") + '><span class="btn-txt">' + (s.busy ? "Checking" : "Sign in") + '</span></button>' +
          '<button class="acct-link" type="button" data-act="back">Use another email</button>'
        : '<p class="acct-lead">' + esc(s.lead || "Sign in with your email and every build you save is waiting in your garage, on any device.") + '</p>' +
          '<label class="acct-label" for="acctEmail">Email</label>' +
          '<input class="acct-input" id="acctEmail" name="email" type="email" autocomplete="email" required value="' + esc(s.email || "") + '" ' + (s.busy ? "disabled" : "") + ' />' +
          '<p class="acct-err" ' + (s.error ? "" : "hidden") + '>' + esc(s.error) + '</p>' +
          '<button class="btn btn--primary acct-submit" type="submit" ' + (s.busy ? "disabled" : "") + '><span class="btn-txt">' + (s.busy ? "Sending" : "Send my code") + '</span></button>' +
          '<p class="acct-fine">Your email is used to sign you in and nothing else. No password to remember.</p>') +
      '</form>';
    sheet.querySelector(".acct-sheet__close").addEventListener("click", close);
    var form = sheet.querySelector("form");
    form.addEventListener("submit", submit);
    var back = sheet.querySelector('[data-act="back"]');
    if (back) back.addEventListener("click", function () { state = { step: "email", email: s.email, lead: s.lead }; render(); });
    var field = sheet.querySelector(".acct-input");
    if (field && !s.busy) setTimeout(function () { field.focus(); }, 30);
  }
  function submit(e) {
    e.preventDefault();
    var form = e.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (state.step === "email") {
      var email = form.email.value.trim().toLowerCase();
      state = { step: "email", email: email, lead: state.lead, busy: true };
      render();
      client.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } }).then(function (r) {
        if (r.error) throw r.error;
        state = { step: "code", email: email, lead: state.lead };
        render();
      }).catch(function (err) {
        state = { step: "email", email: email, lead: state.lead, error: sendError(err) };
        render();
      });
    } else {
      var code = form.code.value.replace(/\D/g, "");
      state = { step: "code", email: state.email, lead: state.lead, busy: true };
      render();
      client.auth.verifyOtp({ email: state.email, token: code, type: "email" }).then(function (r) {
        if (r.error) throw r.error;
        var cb = onDone; onDone = null;
        close();
        if (cb) cb(r.data.user);
      }).catch(function (err) {
        state = { step: "code", email: state.email, lead: state.lead, error: /expired|invalid/i.test(String(err && err.message)) ? "That code did not match. Check the email and try again, or ask for a new one." : "We could not check that code right now. Try again in a minute." };
        render();
      });
    }
  }
  function sendError(err) {
    var m = String(err && err.message || "");
    if (/rate|too many|seconds/i.test(m)) return "Too many codes in a row. Wait a minute and try again.";
    return "We could not send a code right now. Your build still works as a share link, and you can try again in a minute.";
  }
  function open(opts) {
    ensureSheet();
    state = { step: "email", email: "", lead: opts && opts.lead };
    onDone = opts && opts.then;
    render();
    overlay.classList.add("open"); sheet.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function close() {
    if (!sheet) return;
    overlay.classList.remove("open"); sheet.classList.remove("open");
    document.body.style.overflow = "";
    onDone = null;
  }

  /* ---- builds ---------------------------------------------------------- */
  function need() { if (!user) return Promise.reject(new Error("not signed in")); return Promise.resolve(user); }
  function row(r) { if (r.error) throw r.error; return r.data; }
  var api = {
    client: client,
    ready: ready,
    user: function () { return user; },
    onChange: function (fn) { listeners.push(fn); if (user !== undefined) fn(user); },
    /** Opens the sheet; `then(user)` runs after a successful sign-in. Resolves at once when already signed in. */
    signIn: function (opts) {
      if (user) { if (opts && opts.then) opts.then(user); return; }
      open(opts);
    },
    signOut: function () { return client.auth.signOut(); },
    /** { source: "visualize"|"builder", name, url, data?, still_key? } */
    save: function (b) {
      return need().then(function (u) {
        return client.from("builds").insert({ user_id: u.id, source: b.source, name: String(b.name || "").slice(0, 80), url: String(b.url || "").slice(0, 2048), data: b.data || null, still_key: b.still_key || null }).select().single().then(row);
      });
    },
    list: function () { return need().then(function () { return client.from("builds").select("id,source,name,url,data,still_key,created_at").order("created_at", { ascending: false }).then(row); }); },
    rename: function (id, name) { return need().then(function () { return client.from("builds").update({ name: String(name || "").slice(0, 80) }).eq("id", id).select().single().then(row); }); },
    remove: function (id) { return need().then(function () { return client.from("builds").delete().eq("id", id).then(row); }); }
  };
  window.DrooolyAccount = api;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderHeader); else renderHeader();
})();

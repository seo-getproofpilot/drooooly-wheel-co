// DROOOLY Wheel & Tire — site behaviors

// ---- nav scroll state ----
var nav = document.getElementById('nav');
function onScroll() { if (nav && !nav.classList.contains('lock')) nav.classList.toggle('scrolled', window.scrollY > 20); }
onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

// ---- mobile nav ----
var hamburger = document.getElementById('hamburger');
var mobileNav = document.getElementById('mobileNav');
if (hamburger && mobileNav) {
  hamburger.addEventListener('click', function () {
    var open = mobileNav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  mobileNav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { mobileNav.classList.remove('open'); hamburger.setAttribute('aria-expanded', 'false'); });
  });
}

// ---- scroll reveal ----
var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
  entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
}, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }) : null;
window.__observeFades = function () {
  var els = document.querySelectorAll('.fade:not(.in), .mask:not(.in)');
  if (!io) { els.forEach(function (e) { e.classList.add('in'); }); return; }
  els.forEach(function (e) { if (!e.__obs) { e.__obs = true; io.observe(e); } });
};
window.__observeFades();

// ---- vehicle selector ----
/* Derived from window.VEHICLES, not hand-listed. vehicles.js has always
   claimed to be the single source of truth for these lists; that derivation
   did not actually exist, so the finder offered four makes while the fitment
   data knew about nine platforms — including the DRW variants, which are the
   whole reason this dropdown matters. Falls back to the old literal if
   vehicles.js is not on the page. */
var VEH = (function () {
  var list = window.VEHICLES;
  if (!list || !list.length) {
    return {
      years: (function () { var a = []; for (var y = 2026; y >= 2015; y--) a.push(y); return a; })(),
      makes: {
        "Ford": ["F-250 Super Duty", "F-350 Super Duty", "F-450 Super Duty"],
        "RAM": ["2500", "3500", "4500", "5500"],
        "Chevrolet": ["Silverado 2500HD", "Silverado 3500HD"],
        "GMC": ["Sierra 2500HD", "Sierra 3500HD"]
      }
    };
  }
  /* Years are customer context for the quote, not a fitment input — matchVehicle
     matches on make and model and ignores the year entirely. So the range stays
     as wide as it was rather than shrinking to the oldest platform we model
     (2017): a 2016 Super Duty owner still routes to the right single/dual lane,
     and narrowing a lead form buys nothing. */
  var YEAR_FLOOR = 2015;
  var newest = 0, oldest = 9999, makes = {};
  list.forEach(function (v) {
    if (v.years[1] > newest) newest = v.years[1];
    if (v.years[0] < oldest) oldest = v.years[0];
    makes[v.make] = makes[v.make] || [];
    v.models.forEach(function (m) { if (makes[v.make].indexOf(m) < 0) makes[v.make].push(m); });
  });
  Object.keys(makes).forEach(function (k) { makes[k].sort(); });
  var years = [];
  for (var y = newest; y >= Math.min(oldest, YEAR_FLOOR); y--) years.push(y);
  return { years: years, makes: makes };
})();
function getVeh() { try { return JSON.parse(localStorage.getItem('drooolyVehicle')); } catch (e) { return null; } }
function setVeh(v) { try { localStorage.setItem('drooolyVehicle', JSON.stringify(v)); } catch (e) {} }
function clearVeh() { try { localStorage.removeItem('drooolyVehicle'); } catch (e) {} updateVehUI(); }

function fillSelect(sel, items, ph) {
  if (!sel) return;
  sel.innerHTML = '<option value="">' + ph + '</option>' + items.map(function (i) { return '<option>' + i + '</option>'; }).join('');
}
function initVehModule() {
  var y = document.getElementById('vehYear'), mk = document.getElementById('vehMake'), md = document.getElementById('vehModel');
  if (!y) return;
  /* The bolt table is the better list when it is on the page: 97 platforms
     across 15 makes back to 1997, against the nine the visualizer models.
     Models narrow by the YEAR as well as the make, because a 2010 Silverado
     HD and a 2011 are different wheels and offering both under one year
     would be offering a wrong answer. */
  var BOLTS = window.Fitment && window.VEHICLE_BOLTS ? window.Fitment : null;
  function modelsList(make, year) { return BOLTS ? BOLTS.boltModels(make, year) : (VEH.makes[make] || []); }

  /* Trucks and side-by-sides in separate <optgroup>s. Native to a select, so
     it costs nothing in behaviour and stops "Can-Am" reading as a typo
     between Cadillac and Chevrolet. */
  function fillMakes(year) {
    var keep = mk.value;
    if (!BOLTS) { fillSelect(mk, Object.keys(VEH.makes), 'Make'); if (keep) mk.value = keep; return; }
    var groups = BOLTS.boltMakeGroups(year);
    var html = '<option value="">Make</option>';
    groups.forEach(function (g) {
      html += '<optgroup label="' + g.label + '">' +
        g.makes.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</optgroup>';
    });
    mk.innerHTML = html;
    /* The make itself can expire: Dodge does not exist after 2010 and RAM does
       not exist before 2011, so a year change can invalidate the selection. */
    if (keep) { mk.value = keep; if (mk.value !== keep) mk.value = ''; }
  }
  function refillModels() {
    var keep = md.value;
    fillSelect(md, modelsList(mk.value, y.value), 'Model');
    if (keep) { md.value = keep; if (md.value !== keep) md.value = ''; }
  }

  fillSelect(y, BOLTS ? BOLTS.boltYears() : VEH.years, 'Year');
  fillMakes('');
  fillSelect(md, [], 'Model');
  mk.addEventListener('change', refillModels);
  y.addEventListener('change', function () { fillMakes(y.value); refillModels(); });
  var v = getVeh();
  if (v) { y.value = v.year; fillMakes(v.year); mk.value = v.make; fillSelect(md, modelsList(v.make, v.year), 'Model'); md.value = v.model; }
  var btn = document.getElementById('vehFind');
  if (btn) btn.addEventListener('click', function () {
    if (!y.value || !mk.value || !md.value) { [y, mk, md].forEach(function (s) { if (!s.value) s.style.borderColor = '#c0392b'; }); return; }
    setVeh({ year: y.value, make: mk.value, model: md.value }); updateVehUI();
    /* It used to save the truck and scroll to the same grid it showed
       everyone, which is not finding a fitment. Then it narrowed on the axle
       alone. Now it resolves the actual bolt pattern and narrows on that —
       which is the one thing about a wheel that is binary. Width, offset and
       what clears the fender stay a conversation; the drilling does not. */
    var bp = BOLTS ? BOLTS.boltPattern({ year: y.value, make: mk.value, model: md.value }) : null;
    if (bp) {
      /* Only the lanes that are a FACT about the truck get sent. A dually has
         six wheels and a side-by-side is a side-by-side, so those narrow
         honestly. "Lifted" is not a fact about a truck the customer just
         picked from a dropdown — and the catalog's lifted lane also filters
         to 12"+ widths, which would quietly hide every narrow wheel from a
         single-rear owner who never said they were lifted. For those, the
         bolt pattern alone does the narrowing. */
      var lane = BOLTS.laneForConfig(bp.config);
      var narrow = lane === 'dually' ? 'build=dually'
                 : lane === 'utv'    ? 'build=utv'
                 : 'config=single';   /* the axle, not the lift */
      location.href = 'shop.html?bolt=' + encodeURIComponent(bp.bolt) +
        '&' + narrow +
        '&veh=' + encodeURIComponent(y.value + ' ' + mk.value + ' ' + md.value);
      return;
    }
    /* No row for that truck is a real answer, not a dead end — fall back to
       the axle lane so the customer still lands somewhere narrower. */
    var v = window.matchVehicle ? window.matchVehicle(y.value, mk.value, md.value) : null;
    if (v) { location.href = 'shop.html?' + (v.config === 'drw' ? 'build=dually' : 'config=single'); return; }
    var f = document.getElementById('featured') || document.getElementById('shopPage');
    if (f) { document.documentElement.style.scrollBehavior = 'smooth'; f.scrollIntoView({ block: 'start' }); }
  });
}
function vehLabel(v) { return v.year + ' ' + v.make.replace(' Super Duty', '') + ' ' + v.model.replace(' Super Duty', ''); }
function updateVehUI() {
  var v = getVeh();
  document.querySelectorAll('.veh-btn').forEach(function (b) {
    var t = b.querySelector('.veh-btn__txt');
    if (v) { b.classList.add('is-set'); if (t) t.innerHTML = '<small>YOUR TRUCK</small><b>' + vehLabel(v) + '</b>'; }
    else { b.classList.remove('is-set'); if (t) t.innerHTML = '<small>SHOP BY VEHICLE</small><b>Select your truck</b>'; }
  });
  document.querySelectorAll('.veh-chip').forEach(function (c) {
    if (v) { c.style.display = ''; c.querySelector('.veh-chip__t').textContent = 'Fits ' + vehLabel(v); }
    else { c.style.display = 'none'; }
  });
}
// header vehicle button -> scroll to module or go home
document.querySelectorAll('.veh-btn').forEach(function (b) {
  b.addEventListener('click', function () {
    var mod = document.getElementById('vehicle');
    if (mod) { document.documentElement.style.scrollBehavior = 'smooth'; mod.scrollIntoView({ block: 'center' }); }
    else { location.href = 'index.html#vehicle'; }
  });
});
document.querySelectorAll('.veh-chip button').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); clearVeh(); }); });

// ---- search ----
document.querySelectorAll('.search').forEach(function (f) {
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = f.querySelector('input').value.trim();
    location.href = 'shop.html' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
});

// ---- fitment form (demo) ----
var form = document.getElementById('fitForm'), ok = document.getElementById('fitOk');
if (form) form.addEventListener('submit', function (e) {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  if (ok) ok.hidden = false;
  form.querySelector('button[type=submit]').textContent = 'Sent ✓';
  setTimeout(function () { form.reset(); }, 200);
});

// ---- newsletter (demo) ----
document.querySelectorAll('.news form').forEach(function (f) {
  f.addEventListener('submit', function (e) { e.preventDefault(); f.innerHTML = '<p style="color:#38d07a;font-family:var(--label);text-transform:uppercase;letter-spacing:.08em;font-size:13px">✓ You\'re in — watch your inbox for drops &amp; deals.</p>'; });
});

document.addEventListener('DOMContentLoaded', function () { initVehModule(); updateVehUI(); });

// Rotisserie: truly seamless infinite loop.
// Clone enough copies to always overflow the viewport, then shift by the EXACT
// width of one set (measured), so it never runs out or chops mid-cycle.
(function () {
  var track = document.getElementById('mqTrack');
  if (!track) return;
  var originals = Array.prototype.slice.call(track.children);
  var setCount = originals.length;
  if (!setCount) return;
  var SPEED = 34; // px per second — keeps pace consistent across breakpoints

  function build() {
    // reset to the original set only
    track.style.animation = 'none';
    while (track.children.length > setCount) track.removeChild(track.lastChild);

    var oneSet = track.scrollWidth || 1;
    var view = Math.max(
      track.parentElement ? track.parentElement.offsetWidth : 0,
      window.innerWidth || 0,
      document.documentElement.clientWidth || 0
    ) || 1920;
    // need enough copies that after shifting one set, content always overflows the view
    var copies = Math.max(4, Math.ceil(view / oneSet) + 3);
    for (var c = 1; c < copies; c++) {
      for (var i = 0; i < setCount; i++) track.appendChild(originals[i].cloneNode(true));
    }

    // exact advance of one full set = left edge of the first card in the 2nd set
    var shift = track.children[setCount].offsetLeft - track.children[0].offsetLeft;
    if (!shift) return;
    track.style.setProperty('--rot-shift', '-' + shift + 'px');
    track.style.setProperty('--rot-dur', (shift / SPEED).toFixed(2) + 's');
    // force reflow then (re)start the animation cleanly
    void track.offsetWidth;
    track.style.animation = '';
  }

  build();
  window.addEventListener('load', build);
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 250); });
})();

/* Liquid-chrome buttons: the brightest reflection follows the pointer, so
   the metal looks like it moves rather than the button. Progressive — the
   button has a perfectly good fixed reflection if this never runs. */
(function () {
  var sel = ".cta .fit-form .btn--primary, .fin-hero .btn--primary, .cine__cta .btn--hero";
  function bind(el) {
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
    });
    el.addEventListener("pointerleave", function () {
      // back to the rest position, which is NOT centre: the approved hero
      // has its highlight up in the top-left, and returning to 50%/50%
      // left a white blob in the middle that nothing else in the design has.
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
    });
  }
  document.querySelectorAll(sel).forEach(bind);
})();

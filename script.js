// DROOOLY Wheel Co. — site behaviors

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
var VEH = {
  years: (function () { var a = []; for (var y = 2026; y >= 2015; y--) a.push(y); return a; })(),
  makes: {
    "Ford": ["F-250 Super Duty", "F-350 Super Duty", "F-450 Super Duty"],
    "RAM": ["2500", "3500", "4500", "5500"],
    "Chevrolet": ["Silverado 2500HD", "Silverado 3500HD"],
    "GMC": ["Sierra 2500HD", "Sierra 3500HD"]
  }
};
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
  fillSelect(y, VEH.years, 'Year');
  fillSelect(mk, Object.keys(VEH.makes), 'Make');
  fillSelect(md, [], 'Model');
  mk.addEventListener('change', function () { fillSelect(md, VEH.makes[mk.value] || [], 'Model'); });
  var v = getVeh();
  if (v) { y.value = v.year; fillSelect(mk, Object.keys(VEH.makes), 'Make'); mk.value = v.make; fillSelect(md, VEH.makes[v.make] || [], 'Model'); md.value = v.model; }
  var btn = document.getElementById('vehFind');
  if (btn) btn.addEventListener('click', function () {
    if (!y.value || !mk.value || !md.value) { [y, mk, md].forEach(function (s) { if (!s.value) s.style.borderColor = '#c0392b'; }); return; }
    setVeh({ year: y.value, make: mk.value, model: md.value }); updateVehUI();
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

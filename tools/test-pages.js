#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — every page renderer, on every brand, headless

   WHY THIS EXISTS. tire.html shipped completely blank. renderTirePage in
   catalog.js carried a "More from this brand" series nav that had been
   copy-pasted out of renderBrandPage and still referenced ITS locals,
   `avail` and `wantSeries`. In renderTirePage those are undefined, so the
   function threw ReferenceError before it wrote anything, and all SEVEN
   tire brand pages rendered as a bare header and footer. Nothing caught it:
   node --check passes (the syntax is fine), the data tests pass (the data
   is fine), and the page is only reachable from a card on tires.html.

   A second bug rode along in the same function: every tread's card linked to
   wheel.html?brand=<tire slug>, which looks the slug up in BRANDS, misses,
   and shows "we couldn't find that wheel" — all 23 treads.

   So: load the real catalog.js against a DOM small enough to be honest
   about what it is, mount every render hook for every brand, and require
   that each one writes something and throws nothing. This is a SMOKE test.
   It does not check layout — it checks that the renderer runs at all, which
   is the thing that was broken.

   Usage:  node tools/test-pages.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  console.log('  FAIL ' + name + '\n       got  ' + g + '\n       want ' + w);
}
function section(n) { console.log('\n' + n); }

/* ---- a DOM just big enough to run a renderer ------------------------------
   Deliberately thin. Anything a renderer needs that is missing here shows up
   as a loud failure, which is the point: a renderer that reaches for more of
   the document than this should say so. */
function makeEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    innerHTML: '', textContent: '', className: '', id: '',
    style: {}, children: [], attrs: {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    addEventListener() {}, removeEventListener() {},
    querySelector(sel) {
      const m = /^#([\w-]+)$/.exec(String(sel || ''));
      if (!m) return null;
      if (String(this.innerHTML).indexOf('id="' + m[1] + '"') < 0) return null;
      return (this._stubs[m[1]] = this._stubs[m[1]] || makeEl('div'));
    },
    querySelectorAll() { return []; },
    closest() { return null; }, focus() {}, click() {},
    /* Resolve "#id" against the markup this element was just given, the way a
       browser would. wheel.js paints its HTML and then reaches for
       root.querySelector("#wFin") to attach the finish buttons; without this
       the shim hands it null and reports a crash that cannot happen. */
    _stubs: {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
    scrollIntoView() {}
  };
  return el;
}

/* Every id= a page declares. Handing the renderer exactly these means a
   renderer that reaches for an element its own page does not carry fails
   here rather than in front of a customer — catalog.js writes straight to
   .innerHTML on shopTitle, shopSub and shopCrumbNow with no null guard, so
   losing one of those ids from shop.html would blank the page the way
   `avail` blanked tire.html. */
function idsOf(page) {
  const h = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const out = [];
  (h.match(/\sid="[^"]+"/g) || []).forEach(m => out.push(m.replace(/\sid="|"/g, '')));
  return out;
}

function run(pageHooks, search, scripts) {
  const hooks = {};
  pageHooks.forEach(id => { hooks[id] = makeEl('main'); hooks[id].id = id; });
  const listeners = [];
  const doc = {
    title: '',
    body: makeEl('body'),
    documentElement: makeEl('html'),
    getElementById: function (id) {
      if (hooks[id]) return hooks[id];
      /* An id the renderer wrote into a hook's innerHTML a moment ago. In a
         browser that element exists; without this the shim invents failures
         in renderShop, which injects its filter panel and then looks up
         clearF and shopSort by id. */
      const written = Object.keys(hooks).some(function (k) {
        return String(hooks[k].innerHTML).indexOf('id="' + id + '"') > -1;
      });
      if (!written) return null;
      hooks[id] = makeEl('div');
      hooks[id].id = id;
      return hooks[id];
    },
    createElement: makeEl,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') listeners.push(fn); },
    removeEventListener() {}
  };
  const win = {
    location: { search: search || '', hash: '', href: 'http://localhost/' + (search || '') },
    URLSearchParams: global.URLSearchParams,
    addEventListener() {}, removeEventListener() {},
    scrollTo() {}, pageYOffset: 0,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: fn => fn(),
    IntersectionObserver: function () { this.observe = function () {}; this.disconnect = function () {}; },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    console: console
  };
  const ctx = {
    window: win, document: doc, location: win.location,
    URLSearchParams: global.URLSearchParams, console: console,
    IntersectionObserver: win.IntersectionObserver,
    requestAnimationFrame: win.requestAnimationFrame,
    setTimeout: setTimeout, clearTimeout: clearTimeout, Image: function () {}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  /* The data files and the renderer, in the order the pages load them. */
  (scripts || ['brands.js', 'tires.js', 'builds-data.js', 'fitment-data.js', 'finishes.js',
   'wheel-faces.js', 'wheel-specs.js', 'fitment.js', 'catalog.js'])
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  let err = null;
  try { listeners.forEach(fn => fn()); } catch (e) { err = e; }
  return { hooks: hooks, err: err, title: doc.title, win: win };
}

/* ---- the catalogue, for the slugs to sweep ---- */
const dctx = { window: {} };
vm.createContext(dctx);
['brands.js', 'tires.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), dctx));
const BRANDS = dctx.window.BRANDS, TIRES = dctx.window.TIRES;

section('the renderer runs at all');
{
  const probe = run(idsOf('index.html'), '');
  ok('catalog.js loads and mounts', probe.err ? String(probe.err.message) : null, null);
  if (probe.err) console.log('       ' + probe.err.stack.split('\n').slice(0, 3).join('\n       '));
  ok('the brand grid writes something', probe.hooks.brandGrid.innerHTML.length > 50, true);
}

section('every tire brand page renders — tire.html was blank for all 7');
{
  const broke = [], empty = [], badLink = [];
  TIRES.forEach(b => {
    const r = run(idsOf('tire.html'), '?brand=' + b.slug);
    if (r.err) { broke.push(b.slug + ': ' + r.err.message); return; }
    const html = r.hooks.tirePage.innerHTML;
    if (html.length < 200) { empty.push(b.slug + ' (' + html.length + ' chars)'); return; }
    /* a tread has no page of its own, so its card must not point at one */
    if (/wheel\.html\?brand=/.test(html)) badLink.push(b.slug);
    /* and every size it lists must be on the card */
    b.models.forEach(m => (m.sizes || []).forEach(sz => {
      if (html.indexOf(sz) < 0) badLink.push(b.slug + '/' + m.model + ' omits ' + sz);
    }));
  });
  ok('no tire brand page throws', broke, []);
  ok('no tire brand page renders empty', empty, []);
  ok('no tread links to a wheel page, and every size is printed', badLink, []);
}

section('every wheel brand page renders');
{
  const broke = [], empty = [];
  BRANDS.forEach(b => {
    const r = run(idsOf('brand.html'), '?brand=' + b.slug);
    if (r.err) { broke.push(b.slug + ': ' + r.err.message); return; }
    if (r.hooks.brandPage.innerHTML.length < 200) empty.push(b.slug);
  });
  ok('no wheel brand page throws', broke, []);
  ok('no wheel brand page renders empty', empty, []);
}

section('the shop, the grids and an unknown slug');
{
  [['shopGrid', 'shop.html'], ['shopTitle', 'shop.html'], ['brandGrid', 'index.html'],
   ['tireBrandGrid', 'tires.html'], ['wheelsBrands', 'index.html']].forEach(pair => {
    const r = run(idsOf(pair[1]), '');
    const el = r.hooks[pair[0]];
    /* "All wheels" is a legitimate ten-character heading, so the bar is
       "wrote something", not "wrote a lot". */
    ok(pair[0] + ' renders (' + pair[1] + ')',
       r.err ? r.err.message : !el ? 'no #' + pair[0] + ' on ' + pair[1] : el.innerHTML.length > 3, true);
  });

  /* EVERY render hook catalog.js dispatches on must exist on some page, or
     the renderer behind it is dead code. renderFeatured was mounted on
     "featuredGrid" and no page has ever declared that id — the homepage
     lineup is hand-written markup, so the function never ran. */
  const dispatch = fs.readFileSync(path.join(ROOT, 'catalog.js'), 'utf8');
  const dispatched = [];
  const re = /var \w+ = document\.getElementById\("(\w+)"\);/g;
  let hit;
  while ((hit = re.exec(dispatch))) dispatched.push(hit[1]);
  const everyId = new Set();
  fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).forEach(f => idsOf(f).forEach(i => everyId.add(i)));
  /* ids the renderer writes itself are not page hooks */
  dispatch.replace(/id="(\w+)"/g, function (_, i) { everyId.add(i); return _; });
  ok('every render hook exists on some page', dispatched.filter(d => !everyId.has(d)), []);
  /* a bad slug must say so, not throw and not render blank */
  [['tirePage', 'tire.html'], ['brandPage', 'brand.html']].forEach(pair => {
    const r = run(idsOf(pair[1]), '?brand=not-a-real-brand');
    ok(pair[0] + ' handles an unknown brand',
       r.err ? r.err.message : r.hooks[pair[0]].innerHTML.length > 50, true);
  });
}

section('the page title never says the noun twice');
{
  const doubled = [];
  BRANDS.forEach(b => {
    const r = run(idsOf('brand.html'), '?brand=' + b.slug);
    if (!r.err && /\b(Wheels?)\s+Wheels\b/i.test(r.title)) doubled.push(b.slug + ': ' + r.title);
  });
  TIRES.forEach(b => {
    const r = run(idsOf('tire.html'), '?brand=' + b.slug);
    if (!r.err && /\b(Tires?)\s+Tires\b/i.test(r.title)) doubled.push(b.slug + ': ' + r.title);
  });
  ok('"TIS Wheels Wheels" and "Toyo Tires Tires" stay fixed', doubled, []);
}

section('the wheel page does not claim how a wheel was made');
{
  /* Two over-claims that were on every wheel page in the catalogue.

     1. "Forged to order ... before anything is cut" was hardcoded, and ten of
        our twenty-two brands are not forged — TIS, Vision, Arkon, Cali,
        Hardrock, Hardcore, XF, Method, Raceline and Black Rhino are cast or
        flow-formed. Black Rhino's Taleo is one of their "hard alloys", a cast
        wheel, and the page said it was forged and machined to order.

     2. finishes.js is generated from JTX's own renders and says so with
        `brandSlug: "jtx"`, but wheel.js read its `orderable` list for EVERY
        brand — so a Black Rhino Taleo was advertised as "also built in
        Polished, Brushed, Black, Black Milled, Chrome and Custom", which is
        JTX's list, not Black Rhino's. */
  const WHEEL_SCRIPTS = ['brands.js', 'fitment-data.js', 'fitment.js',
    'wheel-specs.js', 'finishes.js', 'builds-data.js', 'wheel-faces.js', 'wheel.js'];
  const ids = idsOf('wheel.html');
  const forgedClaim = [], finishLeak = [];

  const fctx = { window: {} };
  vm.createContext(fctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'finishes.js'), 'utf8'), fctx);
  const JTX_ORDERABLE = ((fctx.window.WHEEL_FINISHES || {}).orderable || []).map(x => x.toLowerCase());

  BRANDS.forEach(b => {
    const m = (b.models || [])[0];
    if (!m) return;
    const r = run(ids, '?brand=' + b.slug + '&model=' + encodeURIComponent(m.model), WHEEL_SCRIPTS);
    if (r.err) { forgedClaim.push(b.slug + ' threw: ' + r.err.message); return; }
    const html = r.hooks.wheelPage.innerHTML;
    if (!html) return;
    if (b.kind !== 'Forged' && /Forged to order/.test(html)) {
      forgedClaim.push(b.slug + ' (' + b.kind + ') says "Forged to order"');
    }
    /* Read the finishes the PAGE offers out of its own sentence and compare
       whole names. Matching substrings instead flagged "black" inside
       "Gloss Black" on fifteen brands, which is the page being right. */
    if (b.slug !== 'jtx') {
      const own = (m.finishes || []).map(x => x.toLowerCase().trim());
      const sentence = (/also built in ([^.]*)\./i.exec(html) || [])[1] || '';
      sentence.split(/,| and /).map(x => x.replace(/<[^>]*>/g, '').toLowerCase().trim())
        .filter(Boolean)
        .forEach(f => {
          if (own.indexOf(f) < 0) {
            finishLeak.push(b.slug + '/' + m.model + ' offers "' + f +
              '", which it does not list [' + (m.finishes || []).join(', ') + ']');
          }
        });
    }
  });
  ok('no cast or flow-formed brand is described as forged', forgedClaim, []);
  ok("no brand inherits JTX's finish list", finishLeak, []);
}

section('the hand-written homepage lineup agrees with the catalogue');
{
  /* The eight cards under "Wheels that hit different" are literal markup, not
     rendered from brands.js — renderFeatured was wired to a "featuredGrid"
     id that no page has ever declared, so it never ran. Hand-written claims
     drift, and these had: six of the seven wheel cards stated a diameter
     range, a configuration or a finish the catalogue contradicts. Ace was
     sold as 22-30 when it starts at 20; Master as Machined, a finish KG1 do
     not list for it; Allora as Gloss Black 22-30 when Amani publish Brushed
     Silver 22-26.

     Each card carries the model's own link, so the link is the source of
     truth for which wheel the card is about. */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const bySlug = {};
  BRANDS.forEach(b => { bySlug[b.slug] = b; });
  const cards = [];
  const re = /<article class="show2-card[^]*?<\/article>/g;
  (html.match(/<article class="show2-card[\s\S]*?<\/article>/g) || []).forEach(block => {
    const link = /href="wheel\.html\?brand=([^&"]+)&(?:amp;)?model=([^"]+)"/.exec(block);
    const meta = /class="show2-meta">([^<]*)</.exec(block);
    const name = /class="show2-name">([^<]*)</.exec(block);
    if (!link || !meta) return;
    cards.push({
      slug: decodeURIComponent(link[1]),
      model: decodeURIComponent(link[2].replace(/&amp;/g, '&')),
      meta: meta[1].replace(/&amp;/g, '&'),
      name: name ? name[1] : ''
    });
  });
  ok('every wheel card was found', cards.length > 0, true);

  const wrongModel = [], wrongRange = [], wrongFinish = [], wrongConfig = [];
  cards.forEach(c => {
    const b = bySlug[c.slug];
    const m = b && (b.models || []).filter(x => x.model === c.model)[0];
    if (!m) { wrongModel.push(c.slug + '/' + c.model); return; }

    /* the diameter range the card prints must be the model's real one */
    const dia = [...new Set((m.sizes || []).map(s => +String(s).split('x')[0]))].sort((a, z) => a - z);
    const shown = (c.meta.match(/(\d+)\u2033\u2013(\d+)\u2033/) || []);
    if (shown.length) {
      if (+shown[1] !== dia[0] || +shown[2] !== dia[dia.length - 1]) {
        wrongRange.push(c.name + ': card ' + shown[1] + '-' + shown[2] +
          ', catalogue ' + dia[0] + '-' + dia[dia.length - 1]);
      }
    }

    /* the finish it names must be one the brand actually offers */
    const parts = c.meta.split(' \u00b7 ').map(x => x.trim());
    const fin = (m.finishes || []).map(f => f.toLowerCase());
    parts.forEach(pt => {
      const low = pt.toLowerCase();
      if (/\u2033/.test(pt)) return;                       // the size range
      if (/^(single|dually|super single|concave|utv)/i.test(low.replace(/ & /g, ' '))) return;
      if (fin.length && fin.indexOf(low) < 0 && /black|polish|brush|machin|chrome|bronze|silver|gray|grey|gold/.test(low)) {
        wrongFinish.push(c.name + ': card "' + pt + '", catalogue [' + (m.finishes || []).join(', ') + ']');
      }
    });

    /* and a configuration it claims must be one the model is built in */
    parts.forEach(pt => {
      pt.split(' & ').forEach(w => {
        const k = w.trim().toLowerCase();
        if (['single', 'dually', 'super single', 'utv'].indexOf(k) > -1 &&
            (m.configs || []).indexOf(k) < 0) {
          wrongConfig.push(c.name + ': card says "' + k + '", catalogue [' + (m.configs || []).join(', ') + ']');
        }
      });
    });
  });
  ok('every card links to a model that exists', wrongModel, []);
  ok('every card states the catalogue diameter range', wrongRange, []);
  ok('every card names a finish the brand offers', wrongFinish, []);
  ok('every card names a configuration the model is built in', wrongConfig, []);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

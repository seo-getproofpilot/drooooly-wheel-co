#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — the dealer sheet, on every brand

   WHY THIS EXISTS. This is the one page in the repo that gets EMAILED TO THE
   BRAND. A wrong figure on the shop grid loses a sale; a wrong figure here is
   read by the person deciding whether to give us an account, about their own
   product, which they know better than we do.

   The sheet already caught itself out once. It counted a model as carrying
   the brand's published sizes only when it held a `sizeSource`, and JTX's 154
   models had never been given one — so the sheet was ready to tell JTX that
   their own published sizes, scraped from 80-odd of their own product pages,
   were our guesswork. Nothing failed. The page rendered beautifully and said
   something false.

   So these tests check the two things that cannot be eyeballed across 22
   brands: that every number on the sheet is one the catalogue actually holds,
   and that the disclosures which make the page honest are present on every
   single one of them.

   Usage:  node tools/test-dealer.js
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

/* ---- render the real dealer.js for one query string ---------------------- */
function render(search) {
  const el = { innerHTML: '', id: 'dealerPage' };
  let onReady = null;
  const sandbox = {
    window: {},
    document: {
      getElementById: (id) => (id === 'dealerPage' ? el : null),
      addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') onReady = fn; },
      title: ''
    },
    location: { search: search },
    URLSearchParams, Date, JSON, Math, encodeURIComponent, console
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  ['brands.js', 'dealer-data.js', 'dealer.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  });
  if (!onReady) throw new Error('dealer.js never registered DOMContentLoaded');
  onReady();
  return { html: el.innerHTML, title: sandbox.document.title, BRANDS: sandbox.window.BRANDS };
}

const BRANDS = render('').BRANDS;
const text = (h) => String(h).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&')
  .replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------------------------------------------------------------- */
section('every brand renders a sheet');
{
  const empty = [], threw = [];
  BRANDS.forEach(b => {
    let r;
    try { r = render('?brand=' + encodeURIComponent(b.slug)); }
    catch (e) { threw.push(b.slug + ': ' + e.message); return; }
    if (!r.html || r.html.length < 2000) empty.push(b.slug + ' (' + (r.html || '').length + ' chars)');
  });
  ok('none threw', threw, []);
  ok('none rendered thin', empty, []);
  ok('the index renders too', render('').html.length > 2000, true);

  /* an unknown slug must say so rather than silently showing the index,
     because the index is the page we must NOT send to a brand */
  const bogus = render('?brand=not-a-brand');
  ok('an unknown slug is named, not swallowed',
    /No such brand/.test(bogus.html) && !/Dealer sheets/.test(bogus.html), true);
}

section('every number on a sheet is one the catalogue holds');
{
  const wrong = [];
  BRANDS.forEach(b => {
    const h = text(render('?brand=' + encodeURIComponent(b.slug)).html);
    const M = b.models || [];
    const real = {
      total: M.length,
      photo: M.filter(m => m.img).length,
      sized: M.filter(m => m.sizeSource).length,
      fin: M.filter(m => (m.finishes || []).length).length,
      bolt: M.filter(m => (m.bolts || []).length).length
    };
    /* the stat strip, in the order the renderer writes it */
    const strip = [real.total, real.photo, real.sized, real.fin, real.bolt];
    const seen = (h.match(/(\d+) models listed/) || [])[1];
    if (+seen !== real.total) {
      wrong.push(b.slug + ': header says ' + seen + ' models, catalogue has ' + real.total);
    }
    /* "N of M" claims in the provenance table must use the real M */
    (h.match(/(\d+) of (\d+)/g) || []).forEach(s => {
      const m = /(\d+) of (\d+)/.exec(s);
      if (+m[2] !== real.total) {
        wrong.push(b.slug + ': "' + s + '" — the brand has ' + real.total + ' models');
      }
      if (strip.indexOf(+m[1]) < 0) {
        wrong.push(b.slug + ': "' + s + '" — ' + m[1] + ' is not one of the counts ' +
          strip.join('/'));
      }
    });
  });
  ok('no sheet states a count the catalogue does not back', wrong, []);
}

section('the disclosures are on every sheet, not just the ones we looked at');
{
  const missing = [];
  BRANDS.forEach(b => {
    const h = text(render('?brand=' + encodeURIComponent(b.slug)).html);
    /* CLAUDE.md rule 3 — we must never read as an authorised dealer */
    if (!new RegExp('We do not hold a ' + b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      ' account', 'i').test(h)) missing.push(b.slug + ': no "we do not hold an account"');
    if (!/not a .* dealer/i.test(h)) missing.push(b.slug + ': no "we are not a dealer"');
    /* the photography disclosure is the load-bearing sentence on the page */
    if (!/photographs are yours, not ours/i.test(h)) missing.push(b.slug + ': no photo disclosure');
    if (!/have not licensed them/i.test(h)) missing.push(b.slug + ': no licensing disclosure');
    if (!/no trading history/i.test(h)) missing.push(b.slug + ': no "we are new"');
    /* CLAUDE.md rule 1 — never a fitment guarantee */
    if (/guarantee|guaranteed to (?:fit|bolt)/i.test(h)) missing.push(b.slug + ': promises a guarantee');
  });
  ok('every sheet carries all of them', missing, []);
}

section('a quote-only brand never shows a price on its own sheet');
{
  /* CLAUDE.md rule 4. The sheet says what we publish about their pricing, so
     a brand gated to "on request" must not find a dollar figure here either. */
  const leaked = [];
  BRANDS.filter(b => b.pricing !== 'from').forEach(b => {
    const h = text(render('?brand=' + encodeURIComponent(b.slug)).html);
    const money = h.match(/\$[\d,]+/g);
    if (money) leaked.push(b.slug + ': ' + money.join(', '));
    if (!/we publish no price for your line/i.test(h)) {
      leaked.push(b.slug + ': does not state that we publish no price');
    }
  });
  ok('no quote-only sheet shows a figure', leaked, []);
}

section('the pruned list appears only where something was pruned');
{
  const PR = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/removed-discontinued.json'), 'utf8'));
  const byBrand = {};
  PR.brands.forEach(b => { byBrand[b.brand] = b; });
  const bad = [];
  BRANDS.forEach(b => {
    const h = text(render('?brand=' + encodeURIComponent(b.slug)).html);
    const shows = /we took down/.test(h);
    const should = !!byBrand[b.slug];
    if (shows !== should) {
      bad.push(b.slug + ': ' + (shows ? 'shows' : 'omits') + ' a prune section, ' +
        (should ? 'should show' : 'should not'));
    }
    if (should) {
      const n = byBrand[b.slug].n;
      if (!new RegExp('\\b' + n + ' models? we took down').test(h)) {
        bad.push(b.slug + ': prune heading does not say ' + n);
      }
      /* and it must name them, so the brand can actually correct us */
      const sample = byBrand[b.slug].models[0];
      if (h.indexOf(sample) < 0) bad.push(b.slug + ': does not list "' + sample + '"');
      /* singular/plural */
      if (n === 1 && /\b1 models\b/.test(h)) bad.push(b.slug + ': says "1 models"');
    }
  });
  ok('it matches the prune record exactly', bad, []);

  /* the record itself must still describe the live catalogue */
  const stale = PR.brands.filter(r => !BRANDS.some(b => b.slug === r.brand));
  ok('every pruned brand is still a brand we list', stale.map(r => r.brand), []);
}

section('the index is marked as ours and the sheets are not');
{
  const idx = text(render('').html);
  ok('the index warns it is internal', /This index is ours, not theirs/.test(idx), true);
  ok('the index names the parent company', /Hoonigan Group owns/.test(idx), true);

  /* A parent company must NEVER appear on a sheet we send: it is our
     application planning, and it reads as though we are shopping them. */
  const leaked = [];
  BRANDS.forEach(b => {
    const h = text(render('?brand=' + encodeURIComponent(b.slug)).html);
    if (/Hoonigan/i.test(h)) leaked.push(b.slug);
  });
  ok('no sheet mentions a parent company', leaked, []);
}

section('the sheet is never indexable');
{
  const html = fs.readFileSync(path.join(ROOT, 'dealer.html'), 'utf8');
  ok('dealer.html is noindex', /name="robots" content="noindex/.test(html), true);
  ok('it carries no cart or shop nav', !/cart-btn|mega__grid/.test(html), true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

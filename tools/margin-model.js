#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — what a sale is worth at a given dealer discount

   Chris: "come up with what I should expect margin-wise from a wheel and
   tire sale, or just a wheel sale, or just a tire sale ... so that when I go
   forward to each brand I know how to vouch for myself ... if somebody shoots
   me really low, I know how to counter that."

   WHAT THIS IS AND IS NOT. The retail side is OURS — every price below is
   read live out of brands.js and tires.js, which are the prices the site
   actually quotes. The cost side is NOT ours: we have no signed dealer
   pricing yet, so cost is expressed as a DISCOUNT OFF RETAIL and the whole
   table is swept across the range a new dealer realistically sees. Nothing
   here is a claim about what any brand will offer.

   THE TWO NUMBERS PEOPLE MIX UP. A supplier saying "50 points" almost always
   means 50% OFF RETAIL, which is a 50% MARGIN. A supplier saying "keystone"
   means the same thing. But "100% markup" is also that same deal. Margin and
   markup are not the same number and the gap widens fast:

       40% off retail  = 40% margin = 67% markup
       50% off retail  = 50% margin = 100% markup

   Quoting margin when they quote markup is how a dealer talks themselves
   into a worse deal than they were offered.

   Usage:  node tools/margin-model.js [--discount 45]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
['brands.js', 'tires.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx));
const BRANDS = ctx.window.BRANDS, TIRES = ctx.window.TIRES;

const money = n => '$' + Math.round(n).toLocaleString('en-US');
const med = a => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : 0; };

/* ---- what the site actually quotes ------------------------------------- */
const wheelPer = [], set4 = [], set6 = [];
BRANDS.forEach(b => (b.models || []).forEach(m => {
  if (typeof m.priceFrom === 'number') wheelPer.push(m.priceFrom);
  if (typeof m.priceSet === 'number') (m.priceSetQty === 6 ? set6 : set4).push(m.priceSet);
}));
const tirePer = [];
TIRES.forEach(b => (b.models || []).forEach(m => {
  if (typeof m.priceFrom === 'number') tirePer.push(m.priceFrom);
}));

/* The Price Designs builders price themselves — base to dearest real build. */
let pdLow = Infinity, pdHigh = 0;
try {
  const B = {};
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'builders-data.js'), 'utf8'), ctx);
  Object.keys(ctx.window.BUILDERS || {}).forEach(k => {
    const s = ctx.window.BUILDERS[k];
    if (s.basePrice < pdLow) pdLow = s.basePrice;
  });
  pdHigh = 9500;                                   // the truck ceiling, from tools/build-builders.js
} catch (e) { pdLow = 3000; pdHigh = 9500; }

const W1 = med(wheelPer), S4 = med(set4), S6 = med(set6), T1 = med(tirePer);

/* ---- labour, which is where the blended margin actually comes from ------
   Mount, balance, road-force and TPMS service. Priced per wheel. These are
   OUR numbers to set, not a supplier's, and the trade runs them at a high
   margin because the cost is time on a machine we would be paying for
   anyway. Held conservative here. */
const LABOUR_PER_WHEEL = 45;
const LABOUR_MARGIN = 0.75;

function basket(name, wheelRetail, tireRetail, wheels) {
  return { name, wheelRetail, tireRetail, wheels, labour: wheels * LABOUR_PER_WHEEL };
}
const BASKETS = [
  basket('Wheels only, set of 4', S4, 0, 4),
  basket('Tires only, set of 4', 0, T1 * 4, 4),
  basket('Wheel + tire package, 4', S4, T1 * 4, 4),
  basket('Dually set of 6 + 6 tires', S6, T1 * 6, 6),
  basket('Price Designs build, set of 4', pdLow, T1 * 4, 4)
];

const WHEEL_DISC = [30, 35, 40, 45, 50];
const TIRE_DISC = [18, 22, 25, 28];

console.log('\nWHAT THE SITE QUOTES TODAY  (median of the published prices in the catalogue)');
console.log('  wheel, each            ' + money(W1) + '   (' + wheelPer.length + ' models priced, ' +
  money(Math.min.apply(null, wheelPer)) + '-' + money(Math.max.apply(null, wheelPer)) + ')');
console.log('  wheel set of 4         ' + money(S4) + '   (' + set4.length + ' priced)');
console.log('  dually set of 6        ' + money(S6) + '   (' + set6.length + ' priced — thin sample)');
console.log('  tire, each             ' + money(T1) + '   (' + tirePer.length + ' treads priced, ' +
  money(Math.min.apply(null, tirePer)) + '-' + money(Math.max.apply(null, tirePer)) + ')');
console.log('  Price Designs builder  ' + money(pdLow) + ' base to ' + money(pdHigh) + ' loaded');

console.log('\nGROSS PROFIT PER SALE, swept across the dealer discount you might be offered');
console.log('  (wheels at the column discount; tires held at 25% off, the trade norm;');
console.log('   fitting at ' + money(LABOUR_PER_WHEEL) + '/wheel at ' + Math.round(LABOUR_MARGIN * 100) + '% margin)\n');

const head = 'Basket'.padEnd(30) + 'Retail'.padStart(9) +
  WHEEL_DISC.map(d => (d + '% off').padStart(11)).join('');
console.log('  ' + head);
console.log('  ' + '-'.repeat(head.length));
BASKETS.forEach(b => {
  const retail = b.wheelRetail + b.tireRetail + b.labour;
  const row = WHEEL_DISC.map(function (d) {
    const gpWheel = b.wheelRetail * (d / 100);
    const gpTire = b.tireRetail * 0.25;
    const gpLabour = b.labour * LABOUR_MARGIN;
    const gp = gpWheel + gpTire + gpLabour;
    return (money(gp) + ' / ' + Math.round((gp / retail) * 100) + '%').padStart(11);
  }).join('');
  console.log('  ' + b.name.padEnd(30) + money(retail).padStart(9) + row);
});

console.log('\nTHE SAME DEAL, SAID FOUR WAYS — so nobody can reframe it past you\n');
console.log('  ' + 'off retail'.padStart(11) + 'margin'.padStart(10) + 'markup'.padStart(10) +
  'multiple'.padStart(11) + '   cost of a ' + money(S4) + ' set');
console.log('  ' + '-'.repeat(64));
[25, 30, 35, 40, 45, 50, 55].forEach(function (d) {
  const margin = d, markup = (d / (100 - d)) * 100, mult = 100 / (100 - d);
  console.log('  ' + (d + '%').padStart(11) + (margin + '%').padStart(10) +
    (Math.round(markup) + '%').padStart(10) + (mult.toFixed(2) + 'x').padStart(11) +
    '   ' + money(S4 * (1 - d / 100)));
});

console.log('\nTIRES ARE A DIFFERENT BUSINESS AND SHOULD BE ARGUED SEPARATELY\n');
console.log('  ' + 'off retail'.padStart(11) + '   GP on a set of 4 at ' + money(T1) + ' each (' + money(T1 * 4) + ')');
TIRE_DISC.forEach(function (d) {
  console.log('  ' + (d + '%').padStart(11) + '   ' + money(T1 * 4 * (d / 100)) +
    (d === 25 ? '   <- the independent-dealer norm' : ''));
});

console.log('\n  Fitting ' + money(LABOUR_PER_WHEEL) + '/wheel at ' + Math.round(LABOUR_MARGIN * 100) +
  '% adds ' + money(4 * LABOUR_PER_WHEEL * LABOUR_MARGIN) + ' on a four and ' +
  money(6 * LABOUR_PER_WHEEL * LABOUR_MARGIN) + ' on a six — which is why the package');
console.log('  is the sale to chase and the tire-only sale is the one to stop discounting.\n');

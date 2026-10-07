#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — the marketing model's arithmetic

   WHY. This model decides what we spend to get a customer. A wrong figure
   here does not show up as a broken page; it shows up months later as an ad
   budget that was never going to pay back. The first version of it was
   checked by recomputing every published number by hand, which worked but
   does not survive an edit. These tests do.

   The sharpest check is the last one: the headline cost per lead and close
   rate must fall out of the per-buyer mix rather than being set beside it.
   That is how the first model worked, and flattening it quietly inflated the
   expensive segments, which are the ones worth the most.

   Usage:  node tools/test-marketing-math.js
   ============================================================ */
const path = require('path');
const M = require(path.join(__dirname, '..', 'marketing-math.js'));

let pass = 0, fail = 0;
function ok(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  console.log('  FAIL ' + name + '\n       got  ' + g + '\n       want ' + w);
}
function near(name, got, want, tol) {
  if (Math.abs(got - want) <= (tol == null ? 0.5 : tol)) { pass++; return; }
  fail++;
  console.log('  FAIL ' + name + '\n       got  ' + got + '\n       want ~' + want);
}
function section(n) { console.log('\n' + n); }
const S = (over) => Object.assign({}, M.DEFAULTS, over || {});

/* ---------------------------------------------------------------- */
section('one sale, line by line');
{
  const s = S();
  const r = M.netPerSale(s, 7260);

  /* ticket is wheels + four tyres + four wheels of fitting */
  near('ticket', r.ticket, 7260 + 387 * 4 + 120 * 4);

  /* gross takes OUR margin on each line, not one blended rate */
  near('gross', r.gross, 7260 * 0.20 + 1548 * 0.25 + 480 * 0.75);

  /* the card is charged on the WHOLE ticket, not on our share of it —
     getting this wrong was the single biggest error in the first model */
  near('card fee is on the ticket', r.card, r.ticket * 0.029 + 0.30, 0.01);
  ok('a 1% - of - ticket card fee would understate it',
    r.card > r.ticket * 0.015, true);

  /* and freight and the hold-back come off after */
  near('net', r.net, r.gross - r.card - 180 - r.gross * 0.02);
  near('target is a third of net', r.target, r.net * 0.33, 0.01);
  near('ceiling is half of net', r.ceiling, r.net * 0.50, 0.01);
  ok('target sits under the ceiling', r.target < r.ceiling, true);
}

section('the package is the business');
{
  /* Selling a bare set at the same discount has to come out materially worse,
     or the model is not reflecting what we actually do. */
  const on = M.netPerSale(S(), 7260);
  const off = M.netPerSale(S({ pkg: false }), 7260);
  ok('a bare set nets less', off.net < on.net, true);
  ok('and by a lot, not a rounding', on.net / off.net > 1.4, true);
  ok('the bare ticket is the wheels alone', Math.round(off.ticket), 7260);

  /* every order size, not just the one we looked at */
  const worse = M.ORDERS.filter(o =>
    M.netPerSale(S({ pkg: false }), o.w).net >= M.netPerSale(S(), o.w).net);
  ok('true at every order size', worse.map(o => o.w), []);
}

section('the knobs move the right way');
{
  const base = M.netPerSale(S(), 7260).net;
  ok('a bigger cut nets more', M.netPerSale(S({ split: 0.30 }), 7260).net > base, true);
  ok('a smaller cut nets less', M.netPerSale(S({ split: 0.15 }), 7260).net < base, true);
  ok('freight comes off', M.netPerSale(S({ freightPerOrder: 400 }), 7260).net < base, true);
  ok('the brand billing saves us the card',
    M.netPerSale(S({ merchant: false }), 7260).net > base, true);
  ok('a hold-back costs us', M.netPerSale(S({ holdback: 0.10 }), 7260).net < base, true);

  /* net must rise with order size at a fixed discount */
  const nets = M.ORDERS.map(o => M.netPerSale(S(), o.w).net);
  ok('net rises with order size',
    nets.every((n, i) => i === 0 || n > nets[i - 1]), true);
}

section('the month is rolled up from the buyers, not typed beside them');
{
  const m = M.month(S());

  /* THE CHECK THAT MATTERS. The headline cost per lead and close rate must be
     derived. Reconstructed from the first model's own per-buyer rates they
     come to $49.35 and 10.9%, which is what its headline said — so if these
     drift, the mix underneath has changed and the top of the page is lying. */
  near('blended cost per lead is derived', m.blendedCpl, 49.35, 0.15);
  near('blended close rate is derived', m.blendedClose * 100, 11.0, 0.3);
  near('leads', m.leads, 60.8, 0.3);

  /* internal consistency */
  near('cost per customer is budget over sales', m.costPerCustomer,
    S().adBudget / m.sales, 0.01);
  near('left over is net minus all marketing', m.left, m.net - m.marketing, 0.01);
  near('marketing is ads plus the fixed line', m.marketing,
    S().adBudget + S().otherMarketing, 0.01);
  near('return on ad spend', m.roas, m.net / S().adBudget, 0.001);

  /* spending nothing on ads sells nothing */
  const zero = M.month(S({ adBudget: 0 }));
  ok('no budget, no leads', Math.round(zero.leads), 0);
  ok('no budget, no sales', Math.round(zero.sales), 0);

  /* dearer leads must mean fewer of them */
  ok('dearer leads buy fewer', M.month(S({ leadCostMult: 2 })).leads < m.leads, true);
}

section('break-even is really break-even');
{
  const s = S();
  const m = M.month(s);
  ok('a break-even point exists at these inputs', m.breakEven > 0, true);

  /* run the model AT that budget and the month should come out flat */
  const at = M.month(S({ adBudget: m.breakEven }));
  near('spending exactly that leaves nothing', at.left, 0, 1);

  /* a dollar either side should straddle it */
  ok('a little less loses money', M.month(S({ adBudget: m.breakEven * 0.9 })).left < 0, true);
  ok('a little more makes money', M.month(S({ adBudget: m.breakEven * 1.1 })).left > 0, true);

  /* and a worse deal must raise the bar */
  ok('a thinner cut raises break-even',
    M.month(S({ split: 0.15 })).breakEven > m.breakEven, true);
  ok('dropping the package raises it too',
    M.month(S({ pkg: false })).breakEven > m.breakEven, true);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

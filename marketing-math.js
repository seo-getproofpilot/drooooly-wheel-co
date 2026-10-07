/* marketing-math.js — what we can pay to get a customer, and what a month buys.
 *
 * WHERE THIS CAME FROM. Matthew built the first version of this model. Its
 * arithmetic is sound — every one of its published figures recomputes exactly
 * from its own stated rules, and its two sharpest observations are kept here
 * verbatim in spirit: that a full-margin dealer can outbid us in the same ad
 * auction, and that lease-to-own approvals die right below where our sets
 * start. This is that model in our own styling, with three gaps closed.
 *
 * WHAT CHANGED, AND WHY IT MATTERS.
 *
 * 1. IT PRICED WHEELS ONLY. The original took a split of the wheel order and
 *    stopped. We do not sell wheels, we sell packages: four tyres at the trade
 *    margin and beadlock assembly at shop-labour margin ride on the same sale
 *    and the same customer. Including them raises net per sale by 44-73%,
 *    which raises everything downstream — what we can pay for a customer, what
 *    a lead is worth, how many sales a month has to produce. The PACKAGE
 *    toggle switches between the two, because drop-shipping a bare set is a
 *    real scenario and it should be visible how much worse it is.
 *
 * 2. THE CARD FEE WAS 1% OF TICKET. Real card cost is 2.9% + 30c when we are
 *    the merchant of record. On the modelled month that is $951 a month, about
 *    10% of net commission, and it compounds with volume. Who takes payment is
 *    now an explicit input rather than an assumed rate.
 *
 * 3. FREIGHT WAS MISSING ENTIRELY. A six-wheel dually set is heavy and it
 *    comes out of our side unless the brand drop-ships. It is a line now.
 *
 * STILL NOT KNOWN, AND SAID SO ON THE PAGE: our close rate, our cost per lead,
 * and our real labour rate. The defaults are starting estimates. The original
 * said to replace them after the first 50 leads; that instruction is right and
 * it is repeated here.
 */
(function () {
  "use strict";

  /* ---- the model, as one pure function so it can be tested -------------- */

  var DEFAULTS = {
    split: 0.20,          // our discount off the brand's retail
    pkg: true,            // sell tyres + fitting with the wheels
    tirePerWheel: 387,    // Fury 17in, from tires.js
    tireMargin: 0.25,     // trade norm, MARGINS.md
    labourPerWheel: 120,  // beadlock assembly — an estimate, not our books
    labourMargin: 0.75,
    wheels: 4,
    freightPerOrder: 180, // our side unless the brand drop-ships
    merchant: true,       // we take the card
    cardPct: 0.029, cardFixed: 0.30,
    holdback: 0.02,       // cancellations and remakes
    targetPct: 0.33,      // acquisition as a share of net
    ceilingPct: 0.50,
    adBudget: 3000,
    otherMarketing: 500,
    leadCostMult: 1.0     // 1.0 = the per-buyer estimates as written
  };

  /* net to us on ONE order of this wheel price */
  function netPerSale(S, wheelPrice) {
    var tyres = S.pkg ? S.tirePerWheel * S.wheels : 0;
    var labour = S.pkg ? S.labourPerWheel * S.wheels : 0;
    var ticket = wheelPrice + tyres + labour;

    var gross = wheelPrice * S.split +
                tyres * S.tireMargin +
                labour * S.labourMargin;

    var card = S.merchant ? (ticket * S.cardPct + S.cardFixed) : 0;
    var net = gross - card - S.freightPerOrder - gross * S.holdback;
    return { ticket: ticket, gross: gross, card: card, net: net,
             target: net * S.targetPct, ceiling: net * S.ceilingPct };
  }

  /* Cost per lead is PER BUYER. A "24x14 forged" size search costs several
     times what a dream-truck reel view costs, and flattening it quietly
     inflates exactly the segments worth the most. The headline cost per lead
     and close rate are DERIVED from this mix, never typed over the top of it. */
  function month(S) {
    var share = S.adBudget / BUYERS.reduce(function (a, b) { return a + b.spend; }, 0);
    var leads = 0, sales = 0, revenue = 0, net = 0, wheelRev = 0;
    BUYERS.forEach(function (b) {
      var spend = b.spend * share;
      var cpl = b.cpl * S.leadCostMult;
      var l = cpl > 0 ? spend / cpl : 0, sl = l * b.close;
      var r = netPerSale(S, b.w);
      leads += l; sales += sl; revenue += sl * r.ticket; net += sl * r.net;
      wheelRev += sl * b.w;
    });
    var per = netPerSale(S, sales > 0 ? wheelRev / sales : 7260);
    var marketing = S.adBudget + S.otherMarketing;
    return {
      leads: leads, sales: sales, per: per, revenue: revenue, net: net,
      costPerCustomer: sales > 0 ? S.adBudget / sales : 0,
      marketing: marketing, left: net - marketing,
      roas: S.adBudget > 0 ? net / S.adBudget : 0,
      blendedCpl: leads > 0 ? S.adBudget / leads : 0,
      blendedClose: leads > 0 ? sales / leads : 0,
      /* ad spend at which net finally covers the fixed marketing line */
      breakEven: (function () {
        var perAdDollar = S.adBudget > 0 ? net / S.adBudget : 0;
        return perAdDollar > 1 ? S.otherMarketing / (perAdDollar - 1) : null;
      })()
    };
  }

  /* the wheel prices our catalogue actually quotes */
  var ORDERS = [
    { w: 3000,  label: "Base UTV set",            note: "Price Designs opening price" },
    { w: 4000,  label: "Payment shopper",         note: "where the finance crowd sits" },
    { w: 5400,  label: "Homepage “From”", note: "PD truck 17×9 base" },
    { w: 6500,  label: "Cash lifted truck",       note: "" },
    { w: 7260,  label: "Popular beadlock build",  note: "black, caps, Ti lugs" },
    { w: 9500,  label: "Fully loaded set",        note: "triple chrome" },
    { w: 10418, label: "Dually package median",   note: "4 data points, all JTX — treat as indicative" }
  ];

  var BUYERS = [
    { k: "payment", name: "Payment shopper", w: 4000, close: 0.048, spend: 300, cpl: 17.96,
      who: "Under 40, half-ton or ¾-ton, shops by monthly payment. Instagram, TikTok, reels." },
    { k: "cash", name: "Cash lifted truck", w: 6500, close: 0.12, spend: 1500, cpl: 50.00,
      who: "30 to 50, works a trade, already lifted. Google size searches, then Instagram." },
    { k: "hd", name: "Dually / HD", w: 10418, close: 0.163, spend: 1200, cpl: 85.11,
      who: "35 to 60, business owner, hotshot, towing or show dually. Google, groups, shows, referrals." }
  ];

  var S = {};
  Object.keys(DEFAULTS).forEach(function (k) { S[k] = DEFAULTS[k]; });

  /* ---- rendering -------------------------------------------------------- */

  function money(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }
  function money2(n) {
    return "$" + (Math.round(n * 100) / 100).toLocaleString("en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function bandOf(cost, t) {
    return cost <= t.target ? "mm--good" : cost <= t.ceiling ? "mm--mid" : "mm--bad";
  }
  function bandWord(cost, t) {
    return cost <= t.target ? "Under target" : cost <= t.ceiling ? "Under ceiling" : "Past ceiling";
  }

  function render() {
    var el = document.getElementById("mmPage");
    if (!el) return;
    var M = month(S);
    var h = "";

    h += '<header class="mm__top">' +
      '<a class="mm__home" href="index.html">DROOOLY <i>Wheel &amp; Tire</i></a>' +
      '<span class="mm__kicker">Marketing math &mdash; internal</span></header>';

    h += '<section class="mm__mast">' +
      '<h1 class="mm__h1">What a customer costs</h1>' +
      '<p class="mm__sub">What a month of advertising buys, what we can pay to land ' +
      'one customer, and which buyer is worth chasing. Built on Matthew’s model ' +
      'with the package, the card fee and freight put back in.</p>' +
      '</section>';

    /* ---- the month ---- */
    h += '<section class="mm__sec"><div class="mm__sechead"><h2>This month at this budget</h2></div>';
    h += '<p class="mm__say">At ' + money(S.adBudget) + ' in ads, this mix brings about <b>' +
      M.sales.toFixed(1) + ' sales</b> and leaves <b>' + money(M.left) +
      '</b> after everything we spend to get them.</p>';

    h += '<div class="mm__stats">' +
      stat("Leads", M.leads.toFixed(1), money2(M.blendedCpl) + " per lead, blended") +
      stat("Sales", M.sales.toFixed(1),
        (Math.round(M.blendedClose * 1000) / 10) + "% of leads buy, blended") +
      stat("Cost per customer", money(M.costPerCustomer),
        bandWord(M.costPerCustomer, M.per) + " · ceiling " + money(M.per.ceiling),
        bandOf(M.costPerCustomer, M.per)) +
      stat("Average ticket", money(M.per.ticket), money(M.revenue) + " in sales") +
      stat("Our net", money(M.net), money2(M.roas) + " back per ad dollar") +
      stat("Left after marketing", money(M.left),
        M.net > 0 ? Math.round(M.marketing / M.net * 100) + "% of net went to marketing" : "—",
        M.left > 0 ? "mm--good" : "mm--bad") +
      '</div>';

    h += '<p class="mm__note">Custom wheel buyers take 30 to 90 days from first DM to ' +
      'deposit. Judge a month of spend on the sales it produces over the next 90 days, ' +
      'not inside the month.' +
      (M.breakEven ? ' Break-even ad spend at these inputs is <b>' + money(M.breakEven) +
        '</b>.' : ' <b>At these inputs no budget breaks even</b> — the net on a sale ' +
        'does not cover what it costs to find one.') +
      '</p></section>';

    /* ---- controls ---- */
    h += '<section class="mm__sec"><div class="mm__sechead"><h2>The inputs</h2></div>' +
      '<div class="mm__calc">' +
      '<div class="mm__ctls">' +
      slider("split", "Our cut of the wheel price", S.split * 100, 10, 45, 1, "%") +
      slider("adBudget", "Monthly ad budget", S.adBudget, 0, 15000, 250, "$") +
      slider("leadCostMult", "Lead costs vs estimate", S.leadCostMult * 100, 40, 250, 5, "%") +
      slider("freightPerOrder", "Freight per order", S.freightPerOrder, 0, 600, 10, "$") +
      slider("labourPerWheel", "Fitting per wheel", S.labourPerWheel, 0, 250, 5, "$") +
      '</div>' +
      '<div class="mm__toggles">' +
      toggle("pkg", "Sell tyres &amp; fitting with it", S.pkg,
        "Off = drop-ship bare wheels. Watch what it does to everything below.") +
      toggle("merchant", "We take the card", S.merchant,
        "On = 2.9% + 30&cent; on the whole ticket. Off = the brand bills the customer.") +
      '</div></div></section>';

    /* ---- what we can pay by order size ---- */
    h += '<section class="mm__sec"><div class="mm__sechead"><h2>What we can pay, by order size</h2></div>' +
      '<p>Per sale at the inputs above. <b>Target</b> is ' + Math.round(S.targetPct * 100) +
      '% of net and is the number to plan on; <b>ceiling</b> is ' +
      Math.round(S.ceilingPct * 100) + '% and is where it stops being worth doing.</p>' +
      '<div class="mm__scroll"><table class="mm__tbl"><thead><tr>' +
      '<th>Wheel order</th><th>Ticket</th><th>Net to us</th>' +
      '<th>Target</th><th>Ceiling</th><th>Break-even</th></tr></thead><tbody>';

    ORDERS.forEach(function (o) {
      var r = netPerSale(S, o.w);
      h += '<tr><td><b>' + money(o.w) + '</b><i>' + esc(o.label) +
        (o.note ? ' — ' + esc(o.note) : '') + '</i></td>' +
        '<td>' + money(r.ticket) + '</td>' +
        '<td><b>' + money(r.net) + '</b></td>' +
        '<td>' + money(r.target) + '</td>' +
        '<td>' + money(r.ceiling) + '</td>' +
        '<td>' + money(r.net) + '</td></tr>';
    });
    h += '</tbody></table></div>';

    /* most we can pay per lead */
    h += '<h3 class="mm__h3">Most we can pay per lead</h3>' +
      '<p>Target per customer times the share of leads that buy.</p>' +
      '<div class="mm__scroll"><table class="mm__tbl mm__tbl--lead"><thead><tr><th>Order</th>' +
      '<th>1 in 20</th><th>1 in 10</th><th>3 in 20</th><th>1 in 5</th></tr></thead><tbody>';
    [3000, 5400, 7260, 9500, 10418].forEach(function (w) {
      var r = netPerSale(S, w);
      h += '<tr><td><b>' + money(w) + '</b></td>' +
        [0.05, 0.10, 0.15, 0.20].map(function (c) {
          return '<td>' + money2(r.target * c) + '<i>' + money2(r.ceiling * c) + ' ceiling</i></td>';
        }).join("") + '</tr>';
    });
    h += '</tbody></table></div></section>';

    /* ---- buyers ---- */
    h += '<section class="mm__sec"><div class="mm__sechead"><h2>By buyer type</h2></div>' +
      '<p>Where the ad money goes, and what each kind of customer is actually worth. ' +
      'The close rates are estimates, not data.</p><div class="mm__buyers">';
    BUYERS.forEach(function (b) {
      var r = netPerSale(S, b.w);
      var cpl = b.cpl * S.leadCostMult;
      var leads = cpl > 0 ? b.spend / cpl : 0;
      var sales = leads * b.close;
      var cpc = sales > 0 ? b.spend / sales : 0;
      h += '<div class="mm__buyer ' + bandOf(cpc, r) + '">' +
        '<div class="mm__buyerhead"><h3>' + esc(b.name) + '</h3>' +
        '<span class="mm__band">' + bandWord(cpc, r) + '</span></div>' +
        '<p class="mm__who">' + esc(b.who) + '</p>' +
        '<dl class="mm__dl">' +
        dd("Net per sale", money(r.net)) +
        dd("Cost per customer", money(cpc)) +
        dd("Target / ceiling", money(r.target) + " / " + money(r.ceiling)) +
        dd("Max per lead", money2(r.target * b.close) + " / " + money2(r.ceiling * b.close)) +
        dd("Leads / sales", leads.toFixed(1) + " / " + sales.toFixed(1)) +
        dd("Cost per lead", money2(cpl)) +
        dd("Ad spend", money(b.spend)) +
        '</dl></div>';
    });
    h += '</div></section>';

    el.innerHTML = h + staticTail();
    bind();
  }

  function stat(k, v, s, cls) {
    return '<div class="mm__stat ' + (cls || "") + '"><span class="mm__k">' + k +
      '</span><b>' + v + '</b><span class="mm__s">' + s + '</span></div>';
  }
  function dd(k, v) {
    return '<dt>' + k + '</dt><dd>' + v + '</dd>';
  }
  function slider(id, label, val, min, max, step, unit) {
    var shown = unit === "$" ? money(val) : (Math.round(val * 10) / 10) + "%";
    return '<div class="mm__ctl"><label for="mm_' + id + '">' + label +
      '<b id="mm_' + id + '_v">' + shown + '</b></label>' +
      '<input type="range" id="mm_' + id + '" data-k="' + id + '" data-unit="' + unit +
      '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></div>';
  }
  function toggle(id, label, on, help) {
    return '<label class="mm__toggle"><input type="checkbox" id="mm_' + id +
      '" data-k="' + id + '"' + (on ? " checked" : "") + '><span><b>' + label +
      '</b><i>' + help + '</i></span></label>';
  }

  function bind() {
    var el = document.getElementById("mmPage");
    Array.prototype.forEach.call(el.querySelectorAll('input[type=range]'), function (r) {
      r.addEventListener("input", function () {
        var k = r.dataset.k, v = +r.value;
        S[k] = (k === "split" || k === "leadCostMult") ? v / 100 : v;
        render();
        /* keep the control the user is dragging under the thumb */
        var again = document.getElementById(r.id);
        if (again) again.focus({ preventScroll: true });
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('input[type=checkbox]'), function (c) {
      c.addEventListener("change", function () { S[c.dataset.k] = c.checked; render(); });
    });
  }

  function staticTail() {
    return '<section class="mm__sec"><div class="mm__sechead">' +
      '<h2>What truck buyers do differently</h2></div><div class="mm__facts">' +
      fact("Lease-to-own approvals stop near $5,000.",
        "Snap and Acima cap around there and our forged sets start at $5,400, so a lot " +
        "of the people answering a monthly-payment ad cannot get approved for the thing " +
        "we are advertising. <b>Our financing page currently leads with “as low as " +
        "$312/mo”.</b> That is selling to a customer the lender will decline.") +
      fact("Most leads are DMs, not forms.",
        "“Price?” comments and Instagram messages outnumber form fills. Count " +
        "them as leads or cost per lead reads far too high and we throttle spend that " +
        "is actually working.") +
      fact("Fitment fear kills more deals than price.",
        "“Will 26×14 rub on a 6-inch lift?” is the question that stalls " +
        "the sale. The verified-fitment check is the answer and it belongs in the ad, " +
        "not three clicks deep.") +
      fact("Local buyers close far better.",
        "We can mount and assemble in the Upper Cumberland. Lift shops building $8,000 " +
        "to $15,000 trucks need a wheel source and they buy repeatedly.") +
      fact("Search buyers are already shopping.",
        "Size searches — “24x14 forged”, “8x170 dually set” — " +
        "are worth far more per lead than cold dream-truck video viewers.") +
      fact("A full-margin dealer can outbid us.",
        "This is the one that should decide how hard we push on terms. A shop keeping " +
        "40% of a $5,400 set clears about $2,160 and can comfortably pay $700–$1,000 " +
        "a customer. Selling that same set as a package at a 20% cut we can plan on " +
        "<b>$460</b> and stretch to $697. <b>In the same auction, for the same keyword, " +
        "they outbid us.</b> Drop-shipping it bare we can plan on $238 and they beat us " +
        "three to one. Every point on dealer terms is bidding power — and every " +
        "package we sell instead of a bare set is worth more than the points.") +
      '</div></section>' +

      '<section class="mm__sec mm__sec--qc"><div class="mm__sechead">' +
      '<h2>What we changed from the first version, and why</h2></div>' +
      '<p>Matthew built this model first. <b>Its arithmetic is sound</b> — every ' +
      'published figure in it recomputes exactly from its own stated rules, and the two ' +
      'sharpest things in it, the outbidding problem and the lease-to-own ceiling, are ' +
      'kept here. Three things were missing:</p><ol class="mm__qc">' +
      '<li><b>It priced wheels only.</b> We do not sell wheels, we sell packages. Four ' +
      'tyres at the trade margin and the fitting on top ride on the same customer, and ' +
      'they raise net per sale by <b>44–73%</b>. That changes every number ' +
      'downstream. The toggle above switches it off so the drop-ship case stays ' +
      'visible.</li>' +
      '<li><b>The card fee was 1% of the ticket.</b> Real cost is 2.9% + 30&cent; when ' +
      'we are the merchant of record — about <b>$950 a month</b> at the modelled ' +
      'volume, roughly 10% of net. Who takes payment is now an input.</li>' +
      '<li><b>Freight was not in it.</b> A six-wheel dually set is heavy and it comes ' +
      'out of our side unless the brand drop-ships.</li></ol>' +
      '<p>One figure to treat carefully: the <b>$10,418 dually median</b> rests on four ' +
      'data points, all JTX forged. It drives the most valuable buyer in the model, so ' +
      'it is the number most worth replacing with real orders.</p></section>' +

      '<section class="mm__sec mm__sec--plain"><div class="mm__sechead">' +
      '<h2>What this does not know</h2></div><ul class="mm__plain">' +
      '<li><b>Our close rate and our cost per lead.</b> The defaults are starting ' +
      'estimates. Replace them after the first 50 leads — they move the answer ' +
      'more than anything else here.</li>' +
      '<li><b>Our real fitting rate.</b> $120 a wheel for beadlock assembly is an ' +
      'estimate from the job, not from our books.</li>' +
      '<li><b>Dealer terms.</b> Nothing is signed. 20% is an assumption.</li>' +
      '<li><b>Outside benchmarks are nearby industries, not ours.</b> Nobody publishes ' +
      'forged truck wheel numbers. Google Ads auto repair cost per lead $28.50 and all ' +
      'industries $70.11 (Search Engine Land); Meta ~$27.66 (AdWave); car dealers close ' +
      '12–14% of their own leads and 6–8% of bought leads (DealerRefresh); ' +
      'tire e-commerce converts 1.4% (Promodo). Read them as ranges.</li>' +
      '</ul></section>';
  }
  function fact(h, b) {
    return '<div class="mm__fact"><h3>' + h + '</h3><p>' + b + '</p></div>';
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { netPerSale: netPerSale, month: month, DEFAULTS: DEFAULTS, ORDERS: ORDERS };
  } else {
    document.addEventListener("DOMContentLoaded", render);
  }
})();

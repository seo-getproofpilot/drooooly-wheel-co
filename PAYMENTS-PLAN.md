# Payments plan: how we take money, finance builds, and handle "affiliate"

The question:

> "I want to include all the payment options, since a lot of these people will
> want Afterpay, Klarna, or even what Synchrony offers. How do we also do the
> payment plus an affiliate for the brands we're actually selling for? How does
> that work if we're just a dealer for them? What systems do we need? What
> processes do we need? How does that correlate to our payment processor? Look
> at how Custom Offsets and larger brands that do the same dealer-type stuff do
> it."

`PAYMENTS.md` answered most of this from the category without seeing a single
checkout. This file is the follow-up: ten retailers' real payment stacks, the
provider claims checked against primary sources, and a phased plan built on
both. Where the two files disagree, **this one wins**. See §9 for the
corrections.

Research read 2026-10-10. Sources are listed at the end of each section.

---

## The answer on one page

1. **Every package seller we looked at uses the same core: card + PayPal + Affirm.**
   Affirm is on every one except 4 Wheel Parts, which uses its own Synchrony card
   instead. Copy that core. It's not where we should be different.
2. **Afterpay and Klarna are cheap to add, but they won't carry a $9k set.** Their
   pay-in-4 products cap around $2,000. Klarna's monthly financing stops at $10,000.
   Afterpay's monthly product now reaches $20,000, but only if Afterpay approves
   that limit for us. Only Tire Agent and SimpleTire, both lower-ticket tire
   stores, offer either one. **Customers who ask for Afterpay or Klarna want
   "pay over time without a bank," and Affirm is that at our ticket.**
3. **Synchrony is a real merchant program, and `PAYMENTS.md` undersold it.** With
   the right merchant code (MCC), cardholders can already use Synchrony Car Care
   at our checkout, with the 6-month promo on $199+. **Enrolling** gets us
   12-month promos, an apply-through-us link, and listing tools. Discount Tire,
   Tire Rack, 4 Wheel Parts and Belle Tire are all Synchrony partners. Apply.
4. **The second-look tier is the real gap, and Custom Offsets hasn't solved it
   either.** Their fallback, Katapult, caps at $3,500 elsewhere and "up to $5,000"
   on their own FAQ. Our sets start at $5,400. Only one competitor we found has
   true second-look coverage at our ticket: National Tire & Wheel uses
   **PayTomorrow**, which runs a declined customer through more lenders (prime
   up to $20,000, then $6,500, then $5,000 no-credit).
5. **Dealer vs affiliate:** for any one sale, either we charge the customer as
   the dealer or someone else does. **None of the wheel or tire brands on our
   list runs a consumer affiliate program**, so the "earn a commission from the
   brand" option mostly doesn't exist. The dealer-side money that works like
   affiliate income is **tire-program volume rebates and dealer-locator listings**
   (Nitto, Toyo, Michelin/BFG, Falken). It's paid through distributors, never
   through our processor.
6. **The affiliate program worth building is our own, paying builders and
   creators to send us trucks.** Custom Offsets runs exactly this. They pay
   1–1.5% on wheels and tires **in store credit**, tracked by a referral link
   **or a "Who sent you?" dropdown at checkout**. It's cheap, it fits our
   quote-first flow, and it stays well inside what a customer is worth to us.
7. **Drop-ship means no float.** Distributors want drop-ships prepaid. We pay
   the brand the day the customer pays us, often before the processor has paid
   *us* out. A rolling reserve on top of that is a cash-flow problem, not just a
   fee.
8. **Nobody in this category takes deposits.** Every seller charges in full when
   the order is placed and protects itself with rules instead: forged and
   built-to-order wheels can't be cancelled once production starts, and returns
   carry a 10–25% restocking fee. We should do the same, in writing, at checkout.
9. **Quote-first still needs a processor from the first sale.** You can't
   invoice a customer, even for a deposit, without a merchant account. What
   quote-first saves us is the cart integration, not the underwriting. Apply
   now.

---

## 1. What the competition actually runs

### Custom Offsets (customwheeloffset.com): read live in a real browser

Custom Offsets and Fitment Industries are **the same company**, Enthusiast
Enterprises, running one back end with a custom platform behind an AWS bot
gate. So these findings count once, not twice.

| | What they do |
|---|---|
| **Financing** | **Affirm** (0% or 10–36% APR) plus **Katapult** lease-to-own as the fallback. Their copy: "If Affirm isn't able to offer you a plan, Katapult is usually the path that still gets you to checkout today." Katapult is described as "an Affirm partner," so it runs as one flow. |
| **On every product card** | Two payment lines under the price: `STARTING AT $101/MO` (Affirm) and `STARTING AT $67/WEEK, No credit required` (Katapult). Plus "Save up to $156 by adding tires." |
| **Other payment** | Cards, PayPal (no account needed), gift cards. No Klarna, Afterpay or Synchrony. |
| **Deposits** | None. Full payment at checkout. |
| **Cancellation** | Free within 24 hours. After that, a restocking fee "typically 10 to 25 percent." **Forged, custom-built, made-to-order and special-order products can't be cancelled or returned.** |
| **Shipping & mounting** | Free lower-48 shipping on wheels, tires and most packages. Mount, balance and TPMS install free on packages. |
| **Add-on** | A paid **Shipping Protection Plan**. They handle lost, stolen or damaged claims themselves instead of the customer going to the carrier. It's revenue, and it cuts "not received" disputes. |
| **Sales tax** | Calculated at checkout from the ship-to address. |
| **Fulfilment** | "Our fulfillment runs out of distribution and manufacturer warehouses, not a retail counter." Drop-ship, same as us. |
| **Affiliate** | "Brand Ambassador" program. 1 point = $1 **store credit**, minimum 60 points to redeem. Wheels and tires pay **1.0% (Bronze) / 1.5% (Silver, Gold)**. Suspension and accessories pay 2–3%. Attribution is a personal link (`team.customoffset.com/username`) **or the customer picking the ambassador's name from a "Who Sent You" dropdown at checkout**. Applicants need 1,000+ followers and two posts a month. |
| **Wholesale** | They own **SD Wheel Wholesale**, a distributor, with house brands **Arkon Off-Road, Anthem Off-Road and Anovia**, plus Nitto, Toyo, Venom Power, Moto Metal, **Vision and TIS**. |
| **Fitment promise** | A "No Rub Guarantee" with free returns. **We do not copy this.** It's exactly what CLAUDE.md rule 1 forbids. We promise the process ("fitment verified before we build it"), not the result. |

**The SD Wheel finding matters more than anything on their checkout:**

- **Arkon is Custom Offsets' own house brand.** It's the "BEST SELLER!" at the
  top of their wheel grid.
- `PAYMENTS.md` used "Buy direct from Arkon →" as its example of an affiliate
  referral card. That would be a link sending our customer into our largest
  competitor's ecosystem.
- If we want Arkon, Vision or TIS, one way in is **buying from our biggest
  competitor's parent company**. That's workable. Plenty of dealers do it. But
  we should do it knowingly: they'll see every order we place.

### The rest of the field

| Retailer | Financing | Store card | Second look | Platform | Affiliate | Custom-order terms |
|---|---|---|---|---|---|---|
| **Custom Offsets / Fitment Ind.** | Affirm | – | Katapult (≤$5k) | custom | ambassador, 1–1.5% credit | full up front; forged non-cancellable |
| **Tire Rack** | Affirm (to 36 mo) | Synchrony (also works at Discount Tire) | – | Adobe AEM | in-house, **6%**, 60-day cookie | – |
| **Discount Tire** | Affirm | **Synchrony** (6/9/12 mo by spend) | **Sunbit** loan, ~$3k | SAP Hybris | CJ, ~4% | – |
| **4 Wheel Parts** | PayPal Pay Later messaging only | **Synchrony** (6 mo on $199+) | – | Magento 2 | FlexOffers ~2.4% | special orders non-returnable; 25% restock |
| **CARiD** | Affirm (to 24 mo) | – | – | custom | ~1% | packages non-cancellable once built |
| **RealTruck** | Affirm, PayPal Pay Later | – | – | Nuxt + Adyen | Impact/AvantLink 4–7% | charged same day; custom non-returnable |
| **SimpleTire** | Affirm, **Klarna**, PayPal Credit | Synchrony Car Care (co-branded with Continental) | Katapult ≤$3.5k | Next.js | CJ 5% | – |
| **National Tire & Wheel** (sells 8-lug and dually packages) | Affirm, PayPal | – | **PayTomorrow** (prime ≤$20k / $6.5k / no-credit $5k), Acima | BigCommerce | – | – |
| **Tire Agent** | Affirm, **Afterpay** | – | six lease-to-own companies ($300–$5k, Acima $6k) | custom | FlexOffers 3.2% | 1-hour cancel window; leases ship to billing address only |
| **Wheelership** | Affirm (via Bolt checkout) | – | – | Magento 2 | – | 10% restock; mounted = no return |

**Not readable:**

- **Boosted Wheels & Tires**, whose layout our homepage borrows, has no
  e-commerce site we could find. It sells through TikTok and the phone. There's
  no checkout to copy.
- **Lifted Trucks** sells vehicles, not wheels, and its financing is car loans.

### Patterns that decide things

- **Card + PayPal + Affirm is the standard checkout.** Nobody here offers ACH,
  wire, check, Amazon Pay or Shop Pay at checkout. Everyone pushes cards, which
  are the most expensive way for them to get paid (see §3).
- **Store cards belong to chains with physical stores** (Discount Tire, Tire
  Rack, 4 Wheel Parts). No online-only package seller has one. Synchrony Car
  Care enrolment is the way for a small shop to get the same thing.
- **No deposits anywhere.** Everyone charges in full and relies on
  non-cancellation rules for custom work.
- **Free mounting and free lower-48 shipping is normal for packages.** 4 Wheel
  Parts is the exception for oversize tires: $69.95 for a set of four under 38",
  $199.95 at 38.5" and up. CLAUDE.md rule 6, that mounted mail-order is a
  premium service with freight shown separately, makes us different from most
  of the field. **The page has to explain why** (8-lug HD sets, freight weight,
  a liftgate) or it reads as a worse deal than Custom Offsets.
- **The leaders' affiliate rates are low.** Payouts run 1–6%, and the biggest
  truck-package seller pays 1–1.5% in store credit.

*Sources: customwheeloffset.com `/financing`, `/faq`, `/ambassador`, `/wholesale`,
sdwheelwholesale.com `/faq`, read live 2026-10-10. Others: retailers' own
financing, FAQ and affiliate pages, with Wayback snapshots where a live site
blocked us (Fitment Industries, CARiD, Tire Rack), and FlexOffers, LinkClicky
and Lasso for affiliate rates.*

---

## 2. The financing stack: what covers a $5k–$12k ticket

Checked against provider and processor documentation, 2026-10-10.

| Product | Range | Merchant cost | Covers our ticket? |
|---|---|---|---|
| **Affirm** (direct, via Stripe, or as Shop Pay Installments) | $35 – **$30,000**, 3–36 mo | Stripe: **6% + 30¢** standard; **7.99% + 30¢** to unlock 12-mo 0% | **Yes, all of it** |
| **Shop Pay Installments** (Affirm, Shopify only) | $35 – **$30,000** | ~5.9% + 30¢ reported; not published | Yes, if we're on Shopify |
| **Synchrony Car Care** | revolving card; 6 mo on $199+ automatic, 12 mo for enrolled merchants | not published; ask the rep | **Yes**, for cardholders and approved applicants |
| **Afterpay Pay Monthly** | $100 – $20,000, up to 24 mo; the limit is set per merchant | Stripe: 6% + 30¢ | Maybe; depends on what limit they give us |
| **Klarna Financing** | $45 – **$10,000**, up to 36 mo (not available in IA, WV, MA) | Stripe: 5.99% + 30¢, + $15 per lost dispute | Up to $10k only |
| **PayPal Pay Monthly** | $49 – $10,000 | 4.99% + 49¢ | Up to $10k only |
| **PayPal Credit** (issued by Synchrony) | revolving; 6 mo deferred interest on $99+ | standard PayPal rate, unconfirmed | Yes, for existing holders |
| **Sunbit** (loan, not a lease) | $60 – $10,000 for auto, down payment required | ~4.99% + 10¢ | Up to $10k |
| **PayTomorrow** (one application tried against several lenders; part of Bread Financial) | up to ~$20k at the prime tier, lower tiers after | not published | The only second-look product that reaches our ticket |
| Katapult / Snap / Acima / Koalafi (lease-to-own) | caps $3,500 / $5,000 / $5,000 / ~$7,500 | often little or nothing to the merchant | **No**, except wheels-only or with a large down payment |
| Afterpay / Klarna / PayPal **Pay in 4** | up to ~$2,000 | ~6% | **No** |

### Recommended stack

| Tier | Product | Why |
|---|---|---|
| **Primary** | **Affirm** | Covers the whole range. It's what every competitor uses and what customers expect. Works from an emailed invoice, so it fits quote-first. |
| **Already in their wallet** | **Synchrony Car Care, enrolled** | 4 Wheel Parts and Discount Tire run their whole financing on it. Our audience already carries the card. Enrolling adds 12-month promos and an apply link. |
| **Free with PayPal** | **PayPal + PayPal Credit / Pay Monthly** | Comes with PayPal acceptance, with no extra agreement. It's how "I want Klarna" customers get pay-later up to $10k. |
| **Second look** | **PayTomorrow** or Affirm's Katapult fallback | Decide on approval data. PayTomorrow reaches our ticket. Katapult doesn't, but it's one integration with Affirm. |
| **Business buyers** | **ACH or wire, then net terms later** | Fleet, hotshot and builder customers. Keep them away from consumer BNPL entirely. |
| **Not at launch** | Klarna, Afterpay | Same ~6% cost as Affirm with a lower ceiling. Add only if Affirm declines are high *and* the data says these approve people Affirm won't. On Stripe each is a settings toggle, so there's no reason to rush. |

**What to tell a customer who asks for Afterpay or Klarna:** "We finance
through Affirm. It's the same idea, split into monthly payments, and it covers
a full set where Afterpay's pay-in-4 stops around $2,000. PayPal Pay Monthly
works too if you'd rather."

### 0% promos cost more than plain financing

On the common $9,288 package ($2,199 gross, `MARGINS.md` §4c):

| How they pay | Cost to us | Share of our gross |
|---|---|---|
| **ACH** (Stripe: 0.8%, capped at $5) | **$5** | 0.2% |
| Card (~2.9% + 30¢) | $270 | 12% |
| Affirm standard (6% + 30¢) | $558 | 25% |
| **Affirm with 12-mo 0%** (7.99% + 30¢) | **$742** | **34%** |

`PAYMENTS.md` said financing costs about 13% of gross. That figure is the
*difference* between Affirm and a card. Measured against an ACH payment, Affirm
standard costs a quarter of the gross, and **a 0% promo costs a third**. Two
consequences:

- **Never advertise 0% as the default.** The financing page currently says
  "0% APR offers on qualifying builds." Every customer who takes that offer
  costs us $742 instead of $558.
- **Give a bank-transfer discount on big tickets.** A 2% discount for ACH or
  wire is $186 to the customer and still saves us $79 against a card. Card
  surcharging is legal in Tennessee (capped at 3% by Visa, credit cards only,
  30 days' notice to the processor, disclosed at checkout and on the receipt).
  But a discount reads better than a surcharge to this audience, and the rules
  are simpler.

*Sources: docs.stripe.com/payments/affirm, /klarna; stripe.com/pricing/local-payment-methods;
docs.affirm.com virtual-terminal and prequalification docs; help.shopify.com
Shop Pay Installments; afterpay.com help "Monthly Payments"; klarna.com
"what is financing"; paypal.com business fees and Pay Later terms; synchrony.com
car-care prospecting, automotive partner and Shopify integration pages;
sunbit.com auto; ntwonline.com/financing; Visa merchant surcharging Q&A.*

---

## 3. The processor, and how all of this connects

### What hangs off the merchant account

```
                       ┌─────────────────────────────┐
  customer ──card────▶ │  OUR MERCHANT ACCOUNT        │──payout (T+2, minus reserve)──▶ our bank
           ──ACH─────▶ │  MCC 5532 or 5533            │
           ──Affirm──▶ │  Affirm / Klarna through it  │
                       └─────────────────────────────┘
  customer ──Synchrony card──▶ works only if our MCC is automotive (separate enrolment for promos)
  customer ──PayPal──────────▶ PayPal account (separate payout)

  our bank ──prepaid PO──▶ distributor / brand ──drop-ship──▶ customer
  distributor ──rebate credit / invoice discount──▶ us        (never touches the processor)
  us ──commission (store credit or ACH)──▶ ambassador         (never touches the processor)
```

Everything that touches the customer's money goes through our merchant account.
Brand rebates and our own affiliate payouts happen **outside** it. That's how
dealer and affiliate "correlate to our payment processor": the processor only
sees the customer side.

### The four things the processor decides for us

1. **The merchant code (MCC).** Ask for **5532** (Automotive Tire Stores) or
   **5533** (Automotive Parts & Accessories). Not 5999 (miscellaneous) and not
   5964 (catalog / mail order), which Stripe restricts for Affirm. The MCC is
   what lets a Synchrony Car Care card work at all. On Stripe it's set by the
   business category we choose. Check it in the dashboard after onboarding.
2. **The reserve.** For new, high-ticket businesses with long delivery times,
   expect **5–15% held for 30–180 days** (secondary sources; a common example is
   10% for 90 days). At $50k a month and 10% for 90 days, that's up to ~$15k of
   our money held at steady state. Distributors want drop-ships **prepaid**, so
   that money is gone from working capital the whole time.
3. **Payment facilitator vs dedicated merchant account:**
   - **Payment facilitators** (Stripe, Shopify Payments, Square, PayPal): we
     can be live in days, but they can freeze funds on their own decision.
   - **Dedicated merchant account** (through a sales agent or acquiring bank):
     slower to open, but the reserve is negotiated up front and is usually more
     stable.
   - **Plan: start on Stripe, and open a dedicated account once we have 3–6
     months of history.**
4. **Built-to-order.** Stripe's Affirm terms list **"pre-orders" as
   prohibited**, and Stripe asks businesses with long gaps between payment and
   delivery to "get in touch with us first." **Ask Stripe in writing, before the
   first charge,** whether a built-to-order wheel taking 4–10 weeks counts as a
   pre-order. If it does, Affirm goes direct with Affirm instead of through
   Stripe.

### Chargebacks: our biggest risk, and our defence

- The "item not received" dispute window (Visa 13.1, Mastercard 4853) runs
  **120 days from the expected delivery date**, up to 540 days at most.
- **A vague lead time stretches that window. A stated expected date puts a
  limit on it.**
- The order confirmation must carry **an expected delivery date**, not only a
  number of weeks.

Our documentary defence, for every order:

- Terms of Sale **accepted with a timestamp** at the moment of payment, covering
  the non-cancellation rules for custom work.
- The **verified fitment spec** the customer approved (the fitment record from
  `specs/03-copy-rules.md`).
- **Expected delivery date** on the confirmation.
- AVS/CVV match. 3D Secure on card orders over a threshold, $3,000 to start.
- **Freight delivered with a signature.** Turn 14's own chargeback protection
  only covers losses where a delivery signature was missing, which tells us how
  often these disputes happen.

**The gap no distributor covers:** a customer can win a chargeback on a
built-to-order wheel the distributor will never take back. Distributors don't
accept returns on special orders, but the card networks still let the customer
dispute. That loss is ours. The defences above are what keep it small.

*Sources: stripe.com/blog/why-some-businesses-arent-allowed; support.stripe.com
reserved funds; WooPayments reserves policy; Visa dispute-rule updates;
Kount / Chargeflow on 13.1 and 4853; turn14.com/terms; Citi and U.S. Bank MCC
lists.*

---

## 4. Dealer vs affiliate, now with the brand side checked

### Three different "affiliate" ideas, and which are real for us

| Idea | Who charges the customer | Real for us? |
|---|---|---|
| **A. We earn commission from a brand** for sending them a sale | the brand | **Mostly no.** No brand on our list (American Force, Fuel, JTX, Hostile, Price Designs, Liberty, Raceline, Fenix, TIS, Vision, Arkon; Nitto, Toyo, BFG, Falken, Mickey Thompson, AMP, Fury) runs a consumer affiliate program. They sell through dealers. The referral fallback in `PAYMENTS.md` only works through a *retailer's* program (Tire Rack 6%), which means handing the customer to a competitor. |
| **B. Dealer-side incentive money**: rebates, programs, locator listings | we do, as dealer | **Yes, for tires.** Small money per set, but it puts us on the brand's dealer locator. See below. |
| **C. We pay creators and shops** to send us customers | we do | **Yes. This is the one to build.** See §5. |

### B in detail: the money a dealer gets that works like affiliate income

All of it comes through **distributor programs**, paid as invoice credits or
quarterly rebates. It never comes through our processor. Book it as a
reduction in cost, not as revenue.

| Program | Entry | Pays | Also gets us |
|---|---|---|---|
| **Nitto Enthusiast Circuit** (US AutoForce) | 24-tire opening order | $6 / $8 / $10 per LT tire at 50 / 125 / 200+ tires a quarter, plus SKU bonuses (e.g. +$8 Terra Grappler G3) | **listing on nittotire.com's dealer locator** |
| **Toyo Driven** | 60 tires a quarter per location | quarterly + annual bonuses | **Toyo dealer-finder listing** |
| **Michelin Alliance (AAD)** (covers BFGoodrich) | 250 tires/yr per location, 75% retail | $10/tire instant + $5/tire marketing funds | – |
| **Falken Fanatic / Boost** | 30+ tires a quarter | $1–3/tire | – |
| **Consumer mail-in rebates** (e.g. Toyo $100 per set) | must be a *participating* dealer | the manufacturer pays the customer | a reason to buy now. **Check each rebate's rules; some exclude online purchases.** |

**Scale it honestly.** Four Nitto LTs at Pro I is $24 a set. The money isn't
the point. The **dealer-locator listing is the closest thing to a brand
affiliate link we'll get**: the brand sends buyers to us, for free.

**Wheel brands publish no co-op, rebate or marketing-fund programs.** Ask for
them on every dealer call (§8). Most owners have something they don't
advertise.

### MAP shapes how payment shows on the page

Nitto's policy (2024-07-01) is the only full wheel or tire MAP policy we could
read. Assume the others are at least this strict until we see them:

- **"Add to cart to see price" is a violation.** So is showing no price next to
  an add-to-cart button.
- **"Call, chat or email for price" is allowed.** A price given in reply to a
  customer's own enquiry isn't advertising. **Our quote-first flow is
  MAP-compliant by design. Keep it that way.**
- **Bundles, free gifts and other incentives get valued and subtracted from the
  advertised price.** Free mounting or free shipping on a package can push the
  effective price below MAP.
- **"$X/mo" isn't covered by any wheel or tire MAP policy.** Rule for us:
  only show a monthly figure that's **calculated from a price at or above MAP**.
  Never show one for a brand that bans price advertising, because the monthly
  figure gives the price away. Get each brand's answer in writing.
- **Breaking MAP costs the rebate money above.** Nitto's third strike forfeits
  incentive money for 3 months and stops shipments of the affected SKUs for 2.

This ties into CLAUDE.md rule 4: the schema's per-brand price gate also has to
gate the `$/mo` line. Custom Offsets puts `$/MO` and `$/WEEK` on every card.
We can only do that for brands that allow price advertising.

*Sources: Nitto MAP policy PDF (2024-07-01); Raceline MAP page; US AutoForce
Enthusiasts Circuit Q1-2026 brochure, Toyo Driven 2025 terms, 2026 AAD program
guide; Tire Review / MTD on Falken; Toyo rebate PDF via Tire Rack; Otter/LifeProof
MAP FAQs for the financing precedent.*

---

## 5. Our own ambassador program (affiliate idea C)

Modelled on Custom Offsets, adjusted for quote-first.

| Decision | Recommendation | Why |
|---|---|---|
| **Who** | Truck builders, shops, creators with real trucks. The builders already in `builders-data.js` are the obvious first ten. | Our differentiator is the hard setups. The people running them are the proof. |
| **Rate** | **2% on the full ticket** to start | Custom Offsets pays 1–1.5% on wheels and tires. On $9,288, 2% is **$186**, well inside our **$440–$730** customer acquisition ceiling (`MARGINS.md` §4c). Room to raise it for top performers. |
| **Paid as** | **Store credit by default, cash (ACH) on request above a minimum** | Store credit is what Custom Offsets does. It costs us product at cost, not cash, and keeps reporting simple. |
| **Attribution** | Referral link **plus a "Who sent you?" field on the quote form and the invoice** | Most of our sales close by phone or email, where links don't track. Custom Offsets' checkout dropdown proves people will name who sent them. |
| **When it pays** | **After delivery + 30 days**, never at order | Lead times are 4–10 weeks. A typical 30-day affiliate lock would pay out on orders that later cancel or charge back. |
| **Tax** | W-9 from everyone paid in cash; 1099-NEC at **$2,000+** a year (threshold raised for 2026 payments, so confirm with the CPA) | Store credit may still count as reportable income. Ask the CPA. |
| **Disclosure** | Ambassadors must label links "paid link" or similar; we give them written guidance and check | FTC Endorsement Guides (2023): the advertiser is liable, not just the creator. "Affiliate link" alone isn't enough. |
| **Tool** | A **spreadsheet and the CRM source field** until ~20 ambassadors; then Refersion or UpPromote on whatever cart we pick | Software buys nothing at 5 referrals a month. |

Rule 1 applies to ambassadors too. Their posts can't promise fitment either.
The guidance we give them includes `specs/03-copy-rules.md`'s forbidden list.

---

## 6. Systems we need

| # | System | Pick | When | Cost / note |
|---|---|---|---|---|
| 1 | **Processor / merchant account** | **Stripe**, with built-to-order disclosed in writing at signup. Dedicated merchant account later. | **Now**, before the first quote is accepted | ~2.9% + 30¢; reserve likely |
| 2 | **Invoicing** | **Stripe Invoicing**: card, ACH and Affirm (and Klarna if switched on) from one emailed invoice | Now | ~0.4–0.5% per paid invoice |
| 3 | **Affirm** | Through Stripe if pre-orders are cleared, otherwise direct. Prequalification button on `financing.html`. | Now | 6% + 30¢; 7.99% for 0% promos |
| 4 | **Synchrony Car Care enrolment** | synchrony.com/why-synchrony/automotive.html · 1-844-866-8014 opt 3 · or through Tire Industry Association membership | Apply now | rate from rep |
| 5 | **PayPal** | PayPal business account (Credit and Pay Monthly come with it) | At cart | 3.49% + 49¢ |
| 6 | **Second look** | Ask PayTomorrow and Affirm/Katapult for terms. Decide after ~30 financing applications. | Jan | – |
| 7 | **Sales tax** | Stripe Tax (or the cart platform's own). TN registration now; other states as we pass nexus thresholds (TN: $100k over 12 months). | Before first TN sale | ~0.5% |
| 8 | **Tire fees** | TN pre-disposal fee **$1.35 per new tire** on Tennessee deliveries (we keep $0.10), filed quarterly. Other states have their own fees (CA $1.75; FL charges remote sellers). | Before first tire sale | – |
| 9 | **Fraud screening** | Stripe Radar + 3D Secure over $3k; manual check on any order where billing and shipping don't match | With #1 | included / small |
| 10 | **Terms of Sale with timestamped acceptance** | On the invoice and at checkout. Not just a footer link. | Before first sale | lawyer |
| 11 | **Order → PO → tracking** | Email and spreadsheet at launch; Flxpoint or a distributor API when volume justifies it (Wheel Pros, ATD, Keystone and Meyer all have APIs) | Now (manual) | – |
| 12 | **Cart platform** | **Undecided, and it's the decision that sets #2–#7.** Shopify gets Shop Pay Installments (Affirm to $30k), the Synchrony app and affiliate apps off the shelf. Staying on our own site plus Stripe keeps the site as-is. | Decide by Dec | – |
| 13 | **Ambassador tracking** | CRM source field + sheet | At launch | free |
| 14 | **Shipping protection** (optional) | An add-on like Custom Offsets'. Decide after seeing claim rates. | Later | revenue line |

---

## 7. Processes: where money moves in an order

```
 1  Quote request ─ "Who sent you?" captured ─ fitment verified (spec record)
 2  Quote sent ─ price at/above MAP, freight & mounting stated separately (rule 6)
 3  Customer commits:
      • Terms of Sale accepted (timestamp) — custom/forged non-cancellable stated
      • Expected delivery DATE stated
      • Paid in full: invoice (card / ACH -2% / Affirm) or financed (Synchrony, PayPal)
      • Tow/haul hard stop already applied (rule 5) — no payment link if it fails
 4  PO to distributor — prepaid — same day
 5  Tracking received → customer notified → expected date updated if it moves
 6  Delivered with signature → order closed
 7  +30 days: ambassador credit released · tire rebate units logged for the quarter
 8  Month end: reconcile processor payouts ⇄ distributor invoices ⇄ orders;
              sales tax and TN tire fee set aside
```

**Process rules**

- **Charge in full at commitment.** That's what every competitor does, and
  financed orders are funded in full anyway. If we offer a deposit at all, it
  should be the exception for card and ACH customers who ask. Two charges per
  order doubles the paperwork and leaves a balance we have to chase.
- **Affirm invoice links expire after 7 days, and charges must be captured
  within 30.** So we take payment when the customer commits, not when the
  order ships.
- **Cancellation rules match the distributor's.** Free within 24 hours on stock
  items. Restocking 10–25% after that. **No cancellation once a custom or forged
  build is ordered.** If our terms are looser than Turn 14's or Wheel Pros', we
  carry the difference ourselves.
- **Refunds go back the way the money came in.** Card refunds go to the card.
  An Affirm refund cancels the loan. Never refund a financed order by cheque.
- **Every chargeback gets the same evidence pack:** terms acceptance, fitment
  spec, expected date, tracking, signature.

---

## 8. Phasing

**Now through November: quote-first, but able to take money**

- Open Stripe and disclose built-to-order in writing. Get the pre-order
  question answered.
- Set the MCC to 5532 or 5533 and confirm it in the dashboard.
- Switch on Stripe Invoicing with card, ACH and Affirm.
- Apply to Synchrony Car Care and PayPal.
- Write the Terms of Sale.
- Add "Who sent you?" to the quote form.
- **Rewrite `financing.html`** (it's in §10 below and on the launch checklist).
  It currently names six lenders, five without agreements. It sells Klarna
  pay-in-4 for a forged package, advertises 0% as normal, and shows an in-house
  credit line that doesn't exist.

**December–January: decide the cart**

- Choose the cart platform (system #12) using a month or two of real quotes.
- Choose the second-look provider using approval data.
- Start the dedicated merchant account application now that there's history.

**January onward: checkout**

- Cart with card, PayPal, Affirm and Synchrony.
- `$/mo` on product cards **only for brands whose MAP terms allow it**.

**As brands open accounts**

- Enrol in each tire program as soon as the account opens (Nitto, Toyo, Falken,
  Michelin/BFG) to get the locator listings.
- Ask every wheel brand the questions below.

### Questions for every wheel and tire brand rep

1. Send us your **MAP / unilateral pricing policy** in writing. **Does a monthly
   payment figure count as an advertised price?** Do free mounting and free
   shipping count against MAP?
2. Do you run **co-op, marketing funds, volume rebates or spiffs**? What are the
   tiers?
3. Do you have a **dealer locator**, and what gets us listed?
4. **How do we pay you?** Card on file, prepaid, net terms? Is there a card
   surcharge, a drop-ship fee, or freight on drop-ships?
5. **What's your cancellation and return policy on built-to-order and special
   orders?** Will you back us with evidence if a customer disputes the charge?
6. Is there an **authorised online dealer list**, and do you restrict
   marketplace or social-commerce selling?

### Questions for every payment provider

`PAYMENTS.md` §6 lists eight questions. Add these three:

- **Stripe:** "Does a built-to-order wheel with a 4–10 week lead time count as
  a 'pre-order' under your Affirm terms?"
- **Synchrony:** "What's our discount rate on 6- and 12-month promos, and does
  enrolment work for an online-only shop with no counter?"
- **Affirm:** "What approval rate do you see on $5k–$12k automotive orders, and
  can Katapult or another partner handle declines above $5k?"

---

## 9. What this changes in `PAYMENTS.md`

| `PAYMENTS.md` said | Correct version |
|---|---|
| "Synchrony is not something we sign up for… needs no action from us" | Half right. The MCC does decide whether the card works, and the 6-month promo then applies automatically. But **there's a merchant program, and the category leaders are all on it.** Enrolling adds 12-month promos and an apply link. **Apply.** |
| Afterpay Pay Monthly "only above $400 and nowhere near our range" | That's the 2022 launch range. Pay Monthly now runs **$100–$20,000, depending on the limit we're given**. It's still not our first choice (§2). |
| Klarna "marginal" | Klarna Financing runs **$45–$10,000**, so it covers up to $10k, not the $12k top end. Still not needed at launch. |
| Affirm "~6% + $0.30" | Correct for standard. **0% promos cost 7.99% + 30¢.** |
| "Financing costs about 13% of the gross" | 13% is Affirm *compared with a card*. Compared with ACH it's 25% (standard) or 34% (0% promo). |
| Lease-to-own "caps near $5,000" | Mostly right, but **Katapult is $3,500** at most sellers. Koalafi reaches ~$7,500. **PayTomorrow's prime tier (~$20k) is the one second-look option that reaches our ticket.** |
| "Quote-first… no merchant account needed to be open for business" | Invoicing a customer, even for a deposit, needs a processor. Quote-first only shortens the integration work. **Apply now, not in December.** |
| Affiliate fallback example "Buy direct from Arkon →" | **Arkon is Custom Offsets' house brand.** That link would send our customer to our largest competitor. More generally, **none of our brands runs a consumer affiliate program**, so the fallback mostly doesn't exist. |
| "Custom Offsets' real stack… behind a bot gate" | Read live in a real browser. See §1. |

---

## 10. Site changes this implies (not made in this commit)

- **`financing.html`:**
  - Drop Klarna, Snap, Acima and the "Fitment Line" card until there's an
    agreement for each.
  - Stop presenting Klarna pay-in-4 as financing for a package.
  - Stop advertising 0% as the norm.
  - Lead with Affirm, Synchrony Car Care and PayPal, and state each one's real
    range.
  - Already on the launch checklist at 1.10, 2.7 and 4.33.
- **Footer payment marks** (`assets/pay/`): drop Affirm and Klarna until the
  agreements are signed (checklist 1.10). Keep the Apple Pay and Google Pay
  marks only if the processor actually turns them on (1.9).
- **Product and shop cards:** the per-brand MAP gate must hide `$/mo` along
  with the price.
- **Quote form:** add "Who sent you?".
- **Order confirmation template:** add the expected delivery date and the
  terms-acceptance timestamp.

---

## 11. What we still don't know

- **Our actual rates and reserve.** Every figure above is published or reported.
  Ours come from underwriting.
- **Synchrony's merchant rate**, and whether it enrols online-only shops without
  a storefront.
- **Whether Stripe treats built-to-order as a pre-order.** This decides
  whether Affirm runs through Stripe.
- **Every wheel brand's MAP sheet**, and above all what they say about
  monthly-payment display.
- **Distributor drop-ship fees, card surcharges and credit terms.** Only Turn 14
  publishes theirs. Everyone else needs a rep call.
- **Approval rates at our ticket.** We'll only know after sending real
  customers through.
- **Fitment Industries' and Tire Rack's live checkouts.** Both blocked
  automated reads, so they come from snapshots and search excerpts. Custom
  Offsets, the closest comparable, was read live.

---

*Companion to `PAYMENTS.md` (the dealer-vs-affiliate reasoning), `MARGINS.md`
§4c (gross and acquisition-cost figures), and `LAUNCH-CHECKLIST.md` 1.9,
1.10, 2.7, 2.12, 4.33, 4.41.*

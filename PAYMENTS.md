# Taking money, and the two different ways to sell a brand

> **Superseded in part by `PAYMENTS-PLAN.md` (2026-10-10).** That file reads the
> real competitor checkouts and corrects several claims below — Synchrony has a
> merchant program worth joining, Afterpay/Klarna ranges are higher than stated,
> 13% is Affirm *vs card* not vs ACH, quote-first still needs a processor, and the
> Arkon referral example points at Custom Offsets' own house brand. See its §9.

Chris: *"how do we also do the payment plus an affiliate for the brands we're
actually selling for? How does that work if we're just a dealer for them?"*

Short version, before the detail:

- **Dealer and affiliate are alternatives, not a stack.** For any one brand you
  are one or the other, and dealer is worth about **five times** as much.
- **Afterpay and Klarna Pay-in-4 do not matter at our ticket.** Nobody splits a
  $9,288 package into four payments of $2,322, and the providers cap it anyway.
  Our real financing is **Affirm, plus a second-look tier for weaker credit.**
- **Synchrony is not something we sign up for.** It's a consumer card. Whether
  it works at our checkout is decided by our merchant category code.
- **Financing is not free. It costs about 13% of the gross on every sale** —
  consistently, at every ticket size. That is the number nobody expects.
- **Don't build checkout for November.** Quote-first, invoice the deposit, add
  real checkout in January with trading history behind us. The longest-lead item
  on this whole page is merchant underwriting, and quote-first removes it from
  the critical path.

---

## 1. Dealer vs affiliate — the distinction the question is really about

These are two different businesses and they are mutually exclusive per brand.

| | **Dealer / reseller** | **Affiliate** |
|---|---|---|
| Who takes the money | **We do.** Merchant of record. | **They do.** |
| What we earn | the discount — 15–30% on wheels | a commission — **4–6%** |
| Who owns the customer | us | them |
| Sales tax | ours to collect and remit | theirs |
| Chargebacks | ours | theirs |
| Warranty front line | us | them |
| Freight risk | usually ours | theirs |
| What it takes to start | dealer account, resale cert, **merchant account** | a signup form and a tracking link |

Real industry rates, for calibration: Tire Rack's own affiliate page publishes
**6%**, Discount Tire **4%**, SimpleTire **5%**. So affiliate in this category is
single digits, and that is the ceiling, not the opening offer.

**On our common $9,288 package:**

| | |
|---|---|
| Dealer, 20% on wheels plus tires and fitting | **$2,199** |
| Affiliate at 6% | $557 |
| Affiliate at 5% | $464 |
| Affiliate at 4% | $372 |

**Dealer is 4.7× affiliate.** There is no version of this where we take an
affiliate deal from a brand that would give us an account. The question answers
itself the moment the numbers are side by side.

### Where affiliate genuinely earns its place

**The brands that turn us down.** The roadmap currently says brands we don't get
accounts for come off the site. There is a third option: that brand's card stops
being a product and becomes a referral. 4–6% of a sale we could not otherwise
make beats 0%, and it costs nothing to run — no account, no stock, no tax, no
chargeback, no freight.

Two conditions on that, and they are not optional:

1. **CLAUDE.md rule 3 still applies.** Never display a brand we aren't
   authorised to sell. A referral card is not selling, but it has to *read* as a
   referral — "Buy direct from Arkon →", leaving our site — and never as DROOOLY
   inventory in our cart. If it looks like we stock it, we are breaking the rule
   whatever the link does underneath.
2. **It leaks the customer, permanently.** They land on the brand's site, buy
   there, and the brand owns them from then on. For a wheel we can't source
   anyway, fine. For anything we might get an account for later, it's a bad
   trade.

### The model we are actually running: drop-ship dealer

Worth naming because it is a third thing and it is what Custom Offsets does.
**We are the merchant of record; the brand ships to the customer.** No stock, no
warehouse — but every obligation in the dealer column above is still ours. The
customer's card is charged by DROOOLY. If the brand ships late, the chargeback
comes to us.

---

## 2. The financing stack, for the tickets we actually sell

Our packages run **$5,000 to $12,000**. That single fact rules most of the
popular names out, and it is why a generic "add BNPL" answer is wrong here.

| Provider | Fits us? | Why |
|---|---|---|
| **Affirm** | **Yes — the primary** | Serves $50 up to about $30,000, built for high-ticket. ~6% + $0.30 to us. |
| **Synchrony Car Care** | **Yes, and free** | A consumer card, not a merchant program. See below. |
| **Klarna** | Marginal | Broad, but its structure suits general retail, not $9k custom. Its Pay-in-4 is irrelevant here. |
| **Afterpay** | **No** | Pay-in-4 over six weeks; Pay Monthly only above $400 and nowhere near our range. |
| **Snap / Acima / Katapult** | **For the second look only** | Lease-to-own for weaker credit. **Approvals cap near $5,000.** |

### The gap, and it is a real one

**Lease-to-own stops at about $5,000. Our sets start at $5,400.** A customer with
bruised credit cannot be approved for the cheapest thing we sell. Matthew's
marketing model found the same thing independently.

That has a direct consequence for the site: **the financing page currently leads
with "as low as $312/mo", which is written for exactly the customer the lender
will decline.** It is already 🔴 on the launch checklist for naming six lenders
we have no agreements with. This is the second reason to rewrite it.

Who the tiers actually serve:
- **Good credit → Affirm.** Covers the whole range. This is most of the money.
- **Thin or bruised credit → LTO, but only below $5,000.** In practice: a wheels-
  only order, or a package where they pay part down to get under the cap.
- **Business buyers → net terms or their own card.** Fleet, hotshot, builders.
  Don't route them through consumer BNPL at all.

### What financing costs us — the number to internalise

Affirm is roughly **6% + $0.30**. A card is roughly **2.9% + $0.30**. Both come
out of the same gross.

| Ticket | Card | Affirm | Difference | Our gross | **Difference as % of gross** |
|---|---|---|---|---|---|
| $5,400 | $157 | $324 | $167 | $1,395 | **12%** |
| $7,428 | $216 | $446 | $230 | $1,827 | **13%** |
| $9,288 | $270 | $558 | $288 | $2,199 | **13%** |
| $12,056 | $350 | $724 | $374 | $2,779 | **13%** |

**Every financed sale costs us about an eighth of the profit on it.** That is not
a reason to refuse financing — it closes sales that otherwise don't happen, and
13% of a sale beats 100% of nothing. It is a reason to know the number, to stop
treating "we offer financing" as free marketing, and to keep card and ACH the
path of least resistance for anybody who can use them.

### Synchrony — the premise to correct

Synchrony Car Care is **a card consumers already carry**, not a merchant program
we join. Whether it works at our counter is determined by our **merchant category
code**, which the processor assigns and Synchrony does not control. The promotional
financing needs no action from us or the cardholder.

So the action here isn't "apply to Synchrony." It is **make sure our MCC is an
automotive parts/accessories code** when the merchant account is set up, and
confirm with Synchrony that the code is eligible. Get the MCC wrong and we have
quietly turned off a card a chunk of this audience is already holding.

---

## 3. The processor problem, which is the real risk

Our profile is, from an underwriter's point of view, close to a worst case:

- **Brand-new entity**, no processing history
- **High average ticket** — $5k to $12k
- **Drop-ship** — we don't hold what we sell
- **Custom and built-to-order** — non-returnable, long lead times
- **Long fulfilment window** — weeks between charge and delivery

That combination predicts two things, and we should plan for both:

**A rolling reserve.** Commonly 5–10% held for 90–180 days. On $50,000 a month
that is $2,500–$5,000 of our own money sitting with the processor at all times.

**A volume cap**, and a freeze if we blow through it. The classic failure is a
good month in month two triggering a review that holds the funds we need to pay
the brand.

**Chargebacks are the thing that actually kills accounts here.** The scenario
writes itself: ordered in November, built to order, arrives in January, customer
disputes "item not received" in December. Our defence is entirely documentary:

- Terms of Sale **agreed at checkout with a timestamp**, not linked in the footer
- Lead time stated **in weeks, on the product page and in the order confirmation**
- Deposit and non-refundable terms stated before payment
- Delivery confirmation with signature on freight
- AVS/CVV match, and 3D Secure on anything over a threshold we set

---

## 4. What we actually need to stand up

| # | System | Why | When |
|---|---|---|---|
| 1 | **Merchant account** | Everything else hangs off it. Expect underwriting questions about drop-ship and lead times — answer them honestly up front; a surprise later is what causes freezes. | Dec–Jan |
| 2 | **Affirm merchant account** | The primary financing tier. Separate application, separate underwriting. | Dec–Jan |
| 3 | **Correct MCC** | Decides whether Synchrony Car Care and similar cards work at all. Costs nothing, easy to get wrong. | at #1 |
| 4 | **Sales tax calculation + remittance** | TN first, then economic nexus as we ship nationwide. Stripe Tax / TaxJar / Avalara. | Dec |
| 5 | **Order routing to the brand** | The unglamorous one that breaks. Order in → PO to the brand → tracking back → customer notified. Manual by email is fine at low volume; it is not fine undocumented. | Nov |
| 6 | **Terms of Sale, agreed at checkout** | The chargeback defence. Worth paying for. | before checkout |
| 7 | **Fraud screening** | AVS/CVV, 3DS on high ticket. One fraudulent $9k order wipes out four good ones. | at #1 |
| 8 | **Affiliate links, where used** | Only for brands that declined us. Signup + tracking link, nothing more. | as needed |

---

## 5. Sequencing — what not to build yet

The temptation is to stand up checkout, financing and affiliate at once. Don't.
Merchant underwriting is the longest-lead item here and it gets easier, not
harder, with a few months of history.

**November — quote-first, no checkout.**
Primary action is "get fitted". We quote, then invoice the deposit directly.
No merchant account needed to be open for business. The site is already built
this way. Financing can still be offered as a **pre-qualification link** rather
than a checkout integration — confirm the exact form with Affirm, but it does not
require a working cart.

**December–January — apply for the processor and Affirm.**
With real quotes and real orders behind us, the underwriting conversation is
different. Set the MCC correctly. Get Terms of Sale written.

**January onward — turn on checkout.**
Card, ACH for larger business orders, Affirm at the financing tier. The cart
seam in `cart.js` / `builder.js` is already written up and deliberately deferred
(`x-cart` on the roadmap) — that work lands here, not before.

**Affiliate, only as brands decline us.** Not a launch feature. A fallback that
turns a rejection into 4–6% instead of a deleted page.

---

## 6. Ask every provider the same questions

Written down because the answers are what decide this, and none of them are
published:

1. **What is our rate**, all in, including the per-transaction fee?
2. **Is there a rolling reserve?** How much, held how long, released how?
3. **What is our monthly volume cap**, and what happens when we exceed it?
4. **What MCC are you assigning us?** (Then check it against Synchrony's
   eligible categories.)
5. **How do you treat drop-ship and built-to-order**, where delivery is weeks
   after the charge? Does that change the reserve?
6. **What is the chargeback process** and what evidence do you accept?
7. **How fast are payouts**, and does that change for a large order?
8. For Affirm: **what is the approval range** for our ticket sizes, and what
   share of applicants typically approve in this category?

---

## 7. What this plan does not know

- **Our actual rates.** Every figure above is a published range or a secondary
  source. Affirm at ~6% + $0.30 and card at ~2.9% + $0.30 are planning numbers,
  not quotes. The 13%-of-gross finding holds its shape across a wide range of
  rates, but the exact figure will move.
- **Custom Offsets' real stack.** Their site is behind a bot gate, so this is
  reasoned from the category rather than read off their checkout. Their marketing
  names Affirm; Klarna and Snap appear nowhere I could verify.
- **Whether a processor will take us at all on day one**, and on what terms.
  That is the single biggest open question and nobody can answer it until we
  apply with a real entity.
- **Approval rates.** What share of our customers get approved at what tier is
  unknowable until we have sent people through it.
- **Whether any brand we want has an affiliate program at all.** Most of the
  manufacturers on our list sell through dealers, not affiliates. The affiliate
  fallback may simply not exist for them — worth checking before relying on it.

---

*Companion to `MARGINS.md` (what a sale is worth, §4c for the gross figures used
here) and `marketing-math.html` (what a customer costs). Rates for Tire Rack,
Discount Tire and SimpleTire are from their own affiliate pages and third-party
directories, read 2026-10-10.*

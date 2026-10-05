# What to expect on margin — and how to hold your ground

Chris: *"when I go forward to each brand, I know how to not necessarily argue
but vouch for myself in terms of what I expect in return… if somebody shoots me
really low, I know how to counter that."*

**Rebuild the tables with `node tools/margin-model.js`.** Every retail figure in
here is read live out of `brands.js` and `tires.js` — they are the prices the
site actually quotes, so they move when the catalogue moves.

> **The cost side is not ours yet.** We have no signed dealer pricing, so cost
> is written as a *discount off retail* and swept across the range. Nothing
> below is a claim about what any brand will offer you. It is the shape of the
> deal so you can tell a fair one from a poor one in the room.

---

## 1. The one-line answer

| Sale | What a competent independent earns | Where you'll start |
|---|---|---|
| **Wheels only** | **35–45%** gross | 30–35% |
| **Tires only** | **22–28%** gross | 20–25% |
| **Wheel + tire package, fitted** | **33–40%** blended | ~30% |

Wheels are the margin. Tires are the traffic. Fitting is the quiet 75%.

In dollars, on the median set the site quotes today:

- **Wheel set of four, $1,596 retail** — $614 gross at 30% off, **$853 at 45%**
- **Four tires, $1,272 retail** — ~$318 gross at the 25% trade norm
- **Package of four, $3,048 all-in** — $932 at 30%, **$1,171 at 45%**
- **Dually six-wheel package, $10,418** — $3,152 at 30%, **$4,388 at 45%**

---

## 2. Know which number they're quoting

This is the single most useful thing in this document. **"50 points", "keystone"
and "100% markup" are all the same deal.** Margin and markup are different
numbers and the gap widens fast — quoting margin back at someone who quoted
markup is how you talk yourself into a worse deal than you were offered.

| Off retail | = Margin | = Markup | = Multiple | Your cost on a $1,596 set |
|---|---|---|---|---|
| 25% | 25% | 33% | 1.33× | $1,197 |
| 30% | 30% | 43% | 1.43× | $1,117 |
| 35% | 35% | 54% | 1.54× | $1,037 |
| **40%** | **40%** | **67%** | **1.67×** | **$958** |
| **45%** | **45%** | **82%** | **1.82×** | **$878** |
| 50% | 50% | 100% | 2.00× | $798 |

If someone says *"we'll do 60% markup"* — that is **37.5% off**, not 60%. Write
the cost-per-set number down and talk about that instead. It cannot be reframed.

---

## 3. What to say when the number comes in low

**If they open at 25–30% on wheels.** That is distributor-to-reseller pricing,
not dealer pricing. The counter is not "that's too low", it is a question:
*"Is that your opening tier, and what's the volume that moves me to the next
one?"* Almost every wheel brand runs tiers. A low first number usually means
they have put you in the bottom one by default.

**If they won't move on the percentage.** Move the conversation to the things
that are worth real money and cost them less to give:

- **Freight.** Free or capped freight on a six-wheel dually set is worth
  $150–$400 a sale. On a $10,418 basket that is a point or two of margin
  without them touching the discount.
- **Terms.** Net 30 instead of card-on-order is working capital you don't have
  to borrow. For a new shop this is often worth more than two points.
- **Drop-ship to the customer or to us, at dealer cost.** Kills the stocking
  requirement, which is the real barrier at your stage.
- **MAP enforcement, in writing.** A great discount in a brand that lets
  everyone advertise at cost is worth less than a middling discount in a brand
  that polices its floor. Ask specifically: *who enforces it, and what happens
  to a dealer who breaks it?*
- **No minimum opening order, or a small one.** Published programs run from a
  5-set buy-in to 25 sets. Ask where the floor is before you agree to a tier.

**If they ask what you're doing in volume.** Don't inflate it. The honest
position is stronger than it feels: *"I'm new, I'm not going to pretend I'm
doing fifty sets a quarter. What I will do is sell your brand properly —
published sizes, real fitment, and I won't advertise under your MAP. Start me
where that's fair and move me when I earn it."* Brands have been burned far
more often by dealers who overstated volume than by dealers who were straight.

**The leverage you actually have.** The site quotes real published sizes,
offsets and bolt patterns for 45+ models straight off the manufacturers' own
tables, and it confirms fitment before anything ships. That is the thing most
small dealers do badly and it costs brands money in returns. It is worth saying
out loud.

---

## 4. Where the money really is

The package is the sale to chase, and the arithmetic says so plainly:

- Fitting at **$45/wheel at 75% margin** adds **$135** on a set of four and
  **$203** on a six. That is pure labour on machines you're paying for anyway.
- A **tire-only** sale at 25% nets ~$318 on $1,272 and ties up a bay. It is the
  one to stop discounting, not the one to lead with.
- A **dually package** is six wheels and six tires — $10,418 retail on the
  median, **$4,388 gross at 45%**. One of those is worth five tire-only sales.
- The **Price Designs builders** price themselves from **$3,000 to $9,500** a
  set. They are build-to-order, so there is no stock risk, and the customer has
  configured it themselves before you quote.

---

## 5. Things I could not tell you, and you should find out

- **Nobody's actual dealer cost.** This is all discount-off-retail arithmetic.
  The first real cost sheet you get replaces the guesswork — put it in
  `tools/margin-model.js` and rerun.
- **Whether our retail equals their MAP.** The site shows the brands' published
  prices as ours. If a brand's MAP sits *below* what we show, we are quoting
  high; if above, we are undercutting their floor on day one. Worth checking per
  brand — this is LAUNCH-CHECKLIST 2.8 and it is still open.
- **The $45/wheel fitting figure is a placeholder.** Set it to your real labour
  rate and the blended numbers move.
- **The dually set-of-six median is four data points** — all JTX forged. Treat
  $8,240 as indicative, not typical.

---

*Generated alongside `tools/margin-model.js`. Industry ranges for tire gross
margin (22–28%, independents mid-20s) and service margin from Tire Review and
Modern Tire Dealer; wheel figures are the arithmetic of discount-off-retail
against our own published prices.*

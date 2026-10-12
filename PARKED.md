# Parked — what came off the site on 11 October 2026, and how to put it back

Nothing in this file was deleted. Every item is still in the repo, behind a
flag in [`site-flags.js`](site-flags.js). **Turning something back on is one
value, not a rebuild.** If you ever find yourself retyping copy from this file,
check the flag first — the original is almost certainly still in the markup.

```js
window.DROOOLY_FLAGS = {
  showPrices: false,
  showFinancingClaims: false,
  showTrustStats: false,
  showMountBalance: false,
  showUnsignedBrandLogos: false,
  showNewsletter: false,
  showGalleryCaptions: false
};
```

Two mechanisms:

- **Static markup** — `data-flag="showPrices"` hides while the flag is false.
  `data-flag-not="showPrices"` is the inverse, used for the stand-in copy that
  appears in its place.
- **Rendered markup** — the render function checks `DF("showPrices")` and the
  original branch sits directly underneath, untouched.

---

## `showPrices`

**Comes back when:** MAP terms are confirmed in writing, per brand
(CLAUDE.md rule 4, LAUNCH-CHECKLIST 2.2). Not before — some brands forbid
advertising a price at all.

**The data never moved.** `priceFrom` and `priceSet` in `brands.js`, every
option price in `builders-data.js` and `data/builders/*.json`, and the tire
prices in `tires.js` are exactly as they were.

| Where | File | What it said | What it says now |
|---|---|---|---|
| Shop grid card | `catalog.js` `productCard()` | `From $1,445 / wheel` + "Full set & tire pricing at fitment" | "Get a quote" + "Send us the set and we price it with the brand" |
| Shop card, builder product | `catalog.js` `productCard()` | `$5,400 / set of 4` + "Built to order — options priced as you build" | "Get a quote" + "Built to order — send us the build and we price it" |
| Brand page wheel card | `catalog.js` `wheelCard()` | `From $X / wheel` + "set of 4 from $Y" | "Get a quote →" |
| Brand hero | `catalog.js` `renderBrandPage()` | `Styles from $X per wheel` | hidden |
| Tire card | `catalog.js` | `From $X / tire` + "set of 4 from $Y" | "Get a quote →" |
| Wheel page | `wheel.js` `priceBlock()` | `From $X / wheel`, "Set of 4 from $Y", "Six-wheel set, quoted to your truck" | "Get a quote" |
| JTX style tiles | `jtx.js` | `from $X` under each model | "on your quote" |
| JTX price line | `jtx.js` `priceLine()` | `From $X / wheel · set of 4 from $Y` | "Priced on your quote" |
| JTX build summary | `jtx.js` | `$X / wheel and up` + set line | "Priced on your quote. We confirm your exact size, finish and set count with JTX before any number goes out." |
| Builder chooser | `builder.js` | `· from $3,000` | `· built to order` |
| Builder option chips | `builder.js` | `+$600`, `+$2,400` etc. | nothing |
| Builder option names | `builder.js` `ov()` | `Yes (+$200)`, `Yes / machined insert (+$800)` | `Yes`, `Yes / machined insert` |
| Builder running total | `builder.js` | `$7,260` and `$1,815 per wheel` | "Get a quote" / "Send the build and we price it" |
| Builder sticky bar | `builder.js` | `$7,260` | "Get a quote" |
| Builder quote prefill | `builder.js` | `… — Turbine · Gloss black ($7,260)` | summary only, no figure |
| Cart line | `cart.js` | `$1,445` or "Priced on request" | "On your quote" |
| Cart footer | `cart.js` | "Subtotal $X" / "Priced so far $X" / "On request" | "3 items — Priced on your quote" |
| Cart note | `cart.js` | "Per-wheel pricing. A DROOOLY specialist confirms your dually/super-single set count, tires & final out-the-door total on your fitment consult." | "Nothing is charged here. Send the build and we come back with a price on your quote, once we have confirmed fitment and availability." |
| Homepage showcase ×8 | `index.html` | `As low as $312/mo`, `From $5,400` | hidden (`data-flag`) |
| Builder chooser on the brand page | `catalog.js` | `4x137 · from $3,000` | `4x137 · built to order` |

**There are two copies of the builder chooser** — `builder.js` renders the
standalone one and `catalog.js` renders the one embedded in the Price Designs
brand page. The second was found by the QC sweep after the first was fixed. If
you add a third, gate it.

**Note the builder still computes its total internally** — that is what we
quote from. It just stops printing it.

---

## `showFinancingClaims`

**Comes back when:** a lender has actually approved us as a merchant. Showing
Affirm's or Klarna's mark without an agreement is the problem, not the copy
(LAUNCH-CHECKLIST 1.10). Separately, Snap and Acima approvals cap near $5,000
and our sets start at $5,400, so the "$312/mo" framing was aimed at a customer
the lender would decline — see `PAYMENTS.md`.

| Where | File | Parked content |
|---|---|---|
| Hero trust strip | `index.html` | `0% financing` item, with its card icon |
| Homepage heading | `index.html` | "Roll now. Pay over time." → stand-in: "Ask about payment plans." |
| Homepage copy | `index.html` | "Prequalify in minutes — no hit to your credit. Multiple lenders, 0% intro offers for qualified buyers, and terms that fit any budget from a $4k street set to a $30k show dually." → stand-in: "Financing options are on the way. Ask about payment plans when you send your build and we'll tell you what we can do on your quote." |
| Homepage lender row | `index.html` | Affirm, Klarna, PayPal Credit, Snap marks |
| Homepage CTA | `index.html` | "Prequalify now" → stand-in: "Start your build" |
| Homepage fine print | `index.html` | "*0% APR offers subject to lender approval and credit qualification. Prequalification is a soft pull and does not affect your credit score." |
| Homepage cards | `index.html` | "As low as **$0 down** for qualified buyers" and "Terms up to **24 months** lease-to-own available" |
| Financing hero copy | `financing.html` | "Forged wheel & tire packages aren't cheap — so we make them easy. Prequalify in seconds with no impact to your credit…" |
| Financing intro | `financing.html` | "Six ways to finance your build." + "Pick the plan that fits your credit and your cash flow. We'll show your options at checkout — you choose the one that works." |
| Six lender cards | `financing.html` | Affirm, Klarna, PayPal Credit, Snap, Acima, and **"Fitment Line"** — the sixth promised "our in-house extended terms and commercial fleet financing", which does not exist |
| Prequalify section | `financing.html` | whole section |
| Payment calculator | `financing.html` | `$4,500` amount, `9.9%` APR, `$395/mo` output |
| Financing FAQ | `financing.html` | five Q&As naming lenders and 0% APR |
| Footer payment row | 10 pages | Visa, Mastercard, Amex, Discover, Apple Pay, Google Pay, PayPal, Affirm, Klarna |

Also **rewritten, not parked** (they travel with every shared link, so a hidden
version is no use): `financing.html`'s three meta descriptions said "Roll now,
pay over time. DROOOLY Wheel & Tire offers 0% and low-APR financing on forged
wheel & tire packages through Affirm, Klarna, PayPal…".

---

## `showTrustStats`

**Comes back when:** the numbers are real and we can point at where they came
from.

| Where | File | Parked content |
|---|---|---|
| Hero trust strip | `index.html` | `★ **4.9** · 1,200+ trucks fitted` |
| Instagram section | `index.html` | `**438** posts · **41.2k** followers · **163** following` |

The strip keeps "Fitment verified before we build" and "50-state shipping", and
balances at two items.

---

## `showMountBalance` — reworded, not hidden

We launch drop-ship and unmounted. These are string edits (metas and JSON-LD
can't carry a flag), so the originals live **here** rather than in the markup.
Put these back when we have a bay.

| File | Original | Now |
|---|---|---|
| `index.html` Store JSON-LD `description` | "Single, dually and super-single fitments, mounted and balanced." | "…shipped to you or your installer." |
| `financing.html` step 3 | "Approved? We ship your package — mounted, balanced and ready to install — and you pay it off in fixed monthly installments." | "…We ship your package to you or your installer…" |
| `tires.html` ×3 metas | "…from every major maker, mounted & balanced to your forged setup." | "…shipped to you or your installer." |
| `tires.html` hero | "Every set ships mounted, balanced & road-force tested on your forged wheels." | "Every set ships to you or your installer, sized to your forged wheels." |
| `tire.html` ×3 metas | "Mounted & balanced to your forged wheels." | "Shipped to you or your installer." |
| `jtx.html` how-it-works | "Tires mounted and balanced is an option, priced on the quote with freight listed on its own line." | "Tires can go on the same quote, with freight listed on its own line." |
| `jtx.html` quote list | "Tire options and mount and balance pricing, if you want them" | "Tire options, if you want them on the same quote" |
| `catalog.js` packages subtitle | "Complete, mounted & balanced — wheels, tires, TPMS and lugs, out the door." | "Wheels, tires, TPMS and lugs — shipped to you or your installer." |
| `catalog.js` brand handoff | "we build the set, mount the tires and quote it out the door." | "we spec the set and quote it with the tires." |
| `catalog.js` tire brand hero | "· mounted & balanced with your set" | "· quoted with your set" |
| `catalog.js` tire handoff | "then come back and we'll mount and balance them to your wheels." | "then come back and we'll quote them with your wheels." |

None of the replacements promise fitment (CLAUDE.md rule 1).

---

## `showUnsignedBrandLogos`

**Comes back per brand, not all at once** — a brand's logo should appear the day
we hold its account. Set `authorized: true` on that brand in `brands.js` and its
mark returns on its own; the flag is only the blanket override.

`brands.js` carries `authorized` explicitly on all 22 brands, true or false, so
an omission can never read as "yes". Today only `price-designs` is true.

| Where | File | Behaviour while off |
|---|---|---|
| Brand wall | `catalog.js` `brandMark()` | name in display type on the white card |
| Brand switcher | `catalog.js` `brandMark()` | name, small |
| Brand page hero | `catalog.js` `brandMark()` | name, large, white |
| Hero marquee ×8 | `index.html` | `<img>` tagged `data-flag`, name beside it with `data-flag-not` |
| Showcase cards ×7 | `index.html` | same (the Price Designs card keeps its logo unconditionally) |
| Product card, every tile in the shop grid | `catalog.js` `brandMark()` | name, small, left-aligned |
| "View more at <brand>.com" handoff ×2 | `catalog.js` `brandMark()` | name |
| JTX sales page ×3 | `jtx.html` | `<img>` tagged `data-flag`, name beside it |

The product-card logo was the bulk of them — one per tile across 682 cards —
and it was missed on the first pass because it uses `brandLogo()` rather than
`logoSrc()`. The QC sweep caught it by counting visible `assets/brands/` images
per page rather than trusting the code path.

Nothing was removed from `assets/brands/`.

---

## `showGalleryCaptions`

**Comes back when:** the gallery is our own work. 37 captions on `index.html`
like `Ford F-250 · 6" lift · 24×14 · 37s`, describing trucks we didn't build.
The photographs are untouched and are a separate question
(LAUNCH-CHECKLIST section 1).

---

## `showNewsletter`

Nothing is parked behind this one. **There is no newsletter markup on any
page** — `script.js`'s `.news form` handler has been matching nothing. The flag
exists so whoever adds the markup has a gate to hang it on rather than shipping
a signup that goes nowhere.

---

## Not parked — deliberately gone

- **The fake form success.** Every form used to show "Sent ✓" and deliver
  nothing. That is not coming back under any flag. See `form-config.js`.
- **"Checkout & get fitted"** on the cart button, now "Request my quote".
  Nothing is charged on this site, so it was never a checkout.

---

## Round two — 12 October 2026

Chris's call after seeing the first pass live.

### `showUnsignedBrandLogos` is now **true**

The manufacturer marks are back. The footer disclaimer and `terms.html` are
what make that defensible: they say in writing that we are an independent
retailer, that the marks belong to their owners, that they appear only to
identify products we can source, and that we remove a listing on request.
Flip it to `false` and every mark becomes plain type again with no other
change — `brandMark()` in `catalog.js` is still the single gate.

### `showInstagram` — the whole section

Not just the counts. The section quotes a follower count we do not have and
embeds a grid of posts that are not ours. Back when the account is real.

### `showFinancing` — the whole financing story

Supersedes `showFinancingClaims` for now. The homepage section, every nav and
footer link to `financing.html`, and the page's own six sections are gated.
`financing.html` is still reachable directly and now carries a stand-in that
says plainly: we are setting up payment plans, we will not name a lender
before one has approved us, ask on your quote.

### `showBuildGallery` — the photographs, not just the captions

The whole `#builds` section on the homepage. Other people's trucks, unlicensed
(LAUNCH-CHECKLIST section 1). Back when the gallery is our own work.

**Left alone on purpose:** `jtx.html` has its own `#builds` section. Those are
JTX Forged's customer-gallery photos and the page *credits them as such* —
"Photos from JTX Forged's customer gallery." That is a different thing from
presenting someone else's truck as ours with an invented caption. Still
third-party photography, still on the checklist, but not dishonest.

### `showAllTireBrands` — down to the two we are pursuing

`TIRE_LIVE = ["fury", "venom-power"]` in `catalog.js`. AMP, BFGoodrich,
Falken, Mickey Thompson, Nitto and Toyo stay in `tires.js` and
`data/tires/*.json` untouched.

Corrections made while doing it, all from the brands' own sites:

| | Was | Now |
|---|---|---|
| Fury name | Fury Offroad | **Fury Tires** — their page title and copyright line both say so |
| Fury domain | furyoffroad.com | **furytires.com** — furyoffroadtires.com 301s there |
| Fury logo | a dead `furyoffroad.com` URL | their current mark, downloaded |
| Venom Power | not on the site at all | **Venom Power Tires**, 9 light-truck lines, logo downloaded |

Venom Power has **no tread photography** — their cards show the neutral mark
rather than borrowing another brand's tyre, and no sizes, because we have not
captured their size matrix. Both are recorded as `_note_` fields in
`data/tires/venom-power.json`.

Two fixes to `tools/build-tires.js` that this needed: it crashed on a tread
with no art URL, and it silently *dropped* any tread it could not download a
photo for — which would have left Venom Power on the site as a brand with
zero products.

# LAUNCH CHECKLIST — DROOOLY Wheel & Tire

**This build is not ready to be public.** It carries invented pricing, brand logos we
are not yet authorised to display, and third-party photography we have not licensed.

Everything below is deliberate — we agreed to build with what we have and clear it
later, rather than block on approvals. This file is the tally so nothing gets
forgotten. Add to it whenever you ship something on an assumption.

**Status key:** 🔴 blocks launch · 🟡 fix before launch · 🟢 done

---

## 0. The site is publicly reachable right now

🔴 **This one surprised us, so it goes first.** The repo is public and GitHub Pages
serves it to anyone with the URL — it was never actually private. Until 2026-08-27 it
also shipped `robots.txt: Allow: /` plus a sitemap, i.e. it was actively inviting
Google to index a draft full of placeholder prices.

- 🟢 `robots.txt` now `Disallow: /`
- 🟢 `<meta name="robots" content="noindex, nofollow">` on every page
- 🔴 **Reverse both at launch** — instructions are in `robots.txt`. Nothing ranks
  while they're in place, so this must not be forgotten on the way out.
- 🟡 If you want it genuinely private before then, GitHub Pages on a free plan can't
  do it. Options: private repo + Netlify/Cloudflare Pages with password protection,
  or move it to a staging subdomain behind basic auth.

---

## 1. Photography and image rights

| # | What | Where | Status |
|---|---|---|---|
| 1.1 | **JTX product renders** — their own three-quarter shots: 39 single-series and 28 dually front/rear images, composited into front+rear pairs | `assets/wheels/jtx/single/`, `assets/wheels/jtx/dually/` | 🔴 Ask JTX for media-kit permission. Routine request; they want dealers showing their wheels. |
| 1.1b | **Head-on renders** kept for the on-hold visualiser only; not shown anywhere | `assets/wheels/jtx/drw/` | 🟡 Delete if the visualiser is abandoned. |
| 1.2 | **All other brands' wheel photos** — scraped from manufacturer/dealer sites | `assets/wheels/**` | 🔴 Same ask, per brand. Roll into the distributor conversation. |
| 1.7 | **JTX's header texture** used as the brand band on their pages | `assets/brand/jtx-texture.webp` | 🔴 Their asset, taken from their theme. Include it in the same media-kit permission ask. |
| 1.3 | **JTX build photos hotlinked on the builds gallery** — displayed from their server, not copied here | `builds.html`, `data/builds/jtx.json` | 🟡 We host nothing and every tile links back, which is the lightest possible footing — but get written permission before this is public, or replace with our own installs. |
| 1.8b | **The share card is now the hero photo** — `assets/og-share.jpg` is generated from `assets/hero-c10.jpg` by `tools/make-og.js`, so the hero's rights question (1.8) is now also the link-preview's rights question, and the image travels further: every link anyone sends carries it into iMessage, Facebook and Slack. | `assets/og-share.jpg` | 🔴 Clearing 1.8 clears this. Until then the unlicensed photo is being redistributed by every share, not just viewed on the site. |
| 1.9 | **Payment-network marks in the footer** — Visa, Mastercard, Amex, Discover and PayPal from `aaronfagan/svg-credit-card-payment-icons` (Apache-2.0); Apple Pay and Google Pay from `simple-icons` (CC0). The licence covers the *files*; it does not license the trademarks. | `assets/pay/` | 🟡 Normal acceptance-mark use, but each network publishes rules: Visa and Mastercard specify minimum size and clear space, Apple requires the Apple Pay mark only where Apple Pay is actually accepted and Google the same for Google Pay. Confirm against the real processor line-up before launch and drop any mark we do not in fact accept. |
| 1.10 | **Affirm and Klarna marks** reused from `assets/lenders/`, now also in the footer as accepted payment | `assets/pay/affirm.svg`, `assets/pay/klarna.svg` | 🔴 Both require an active merchant agreement before their mark may be displayed. Tied to 2.7 and 4.33 — the footer now makes the claim twice as hard as the text badges did. |
| 1.11 | **Instagram and Facebook glyphs** from `simple-icons` (CC0 files, Meta trademarks) | `assets/social/` | 🟡 Standard profile-link use. Fine as long as each links to a real DROOOLY account — see 4.34. |
| 1.4 | **Truck photography** — 40 files, rights unconfirmed, predates this work | `assets/builds/` | 🔴 Still used on the homepage build gallery. Replace with owned photos or license. |
| 1.5 | **Fabricated captions** on the homepage build gallery | `index.html` | 🔴 Captions describe builds that aren't ours. Rewrite or remove. |
| 1.6 | **Visualizer placeholder plate** | `data/plates/f450-dually-16.json` (`cleared: false`) | 🟢 Page removed; data retained but no longer rendered anywhere. |

**The fix that retires most of this:** photograph every set DROOOLY installs. Phone is
fine — walk around it, get a true side profile. Owned, on-brand, and it's the one
asset a competitor can't copy. Start before launch and 1.3/1.4/1.5 mostly evaporate.

---

- 🔴 **1.8 · The homepage hero photograph** (`assets/hero-c10.jpg`). Supplied by Chris on
  2026-09-30, replacing the white F-450 dually that was there before. A reframed version
  (`hero-c10-v2.jpg`) was live briefly and reverted — it was a full regeneration rather than
  a reposition, and lost grille, bumper and wheel detail. Provenance
  unknown: nobody has said who shot it, whether it is licensed, or whether it is generated
  rather than photographed. It is the first thing anyone sees on the site, so it is the
  worst one to be unsure about — establish the source before launch. The previous hero is
  **kept on disk and unused** (`assets/truck-hero.jpg` plus its portrait crop
  `assets/truck-hero-mobile.jpg`) so the swap can be reversed by changing two `src` values
  in `index.html`; its own rights were never confirmed either, so reverting does not clear
  this item, it only changes which photo it is about.

- 🔴 **1.6 · The side-by-side card photo** (`assets/builds/utv-1.jpg`). Cropped from a
  Raceline marketing image (`Product_Detail_1500x1200_OffroadProven1.jpg`) — their logo
  and headline were cropped off, but the photograph underneath is still theirs and we
  now host it. Same footing as 1.4, and the same permission is needed.

## 2. Pricing — CLAUDE.md rule 4

| # | What | Status |
|---|---|---|
| 2.1 | `shop.html` shows **formula-generated prices**. They are invented. | 🔴 Replace with real dealer cost + MAP, or gate to "get pricing". |
| 2.2 | MAP terms not verified per brand; some brands forbid advertising price at all. | 🔴 Confirm per brand before any number is public. |
| 2.3 | Brand-level "starting at" figures came from authorised-dealer listings, not our own cost. | 🟡 Re-derive once distributor accounts clear. |
| 2.4 | **The stored set price is for four wheels.** A dually set is six, so dually cards and dually wheel pages no longer restate a four-wheel total — they say the set is six and leave the figure to the quote rather than inventing one by multiplying. | 🟢 |
| 2.5 | **The shop cards show invented star ratings.** `★★★★★ 4.6 (17)` is generated by `hash(model + slug)` in `catalog.js` — the score and the review count are both fabricated, on every one of 756 cards. This is a worse honesty problem than the invented prices: a made-up price reads as an estimate, a made-up review count is a claim that specific customers said something. | 🔴 Kept deliberately for now — flagged and accepted as temporary (2026-09-15). Remove or replace with real reviews before launch. |
| 2.6 | **"Free shipping over $999" is gone** (2026-09-29). It sat in the trust strip under the hero and contradicted CLAUDE.md rule 6 — "Mounted mail-order is not a default option… Never present it as free shipping." Replaced with "Fitment verified before we build", which is the approved phrase from rule 1. | 🟢 |
| 2.7 | **"4.9 · 1,200+ trucks fitted" is fabricated**, and so are the Instagram counts (438 posts / 41.2k followers / 163 following) and the financing figures ("as low as $312/mo", "$0 down", "terms up to 24 months", "0% intro offers"). A launching shop has not fitted 1,200 trucks. These are the claims most likely to be challenged by a brand rep or a lender. | 🔴 Decide per claim: substantiate, soften, or remove. |

---

- 🔴 **2.8 · The shop grid ignores every real price we hold.** `allProducts()` prices each
  card with `priceEach()` (`catalog.js:37`) — a formula over brand kind and diameter with a
  hash for jitter. It never reads `model.priceFrom`, so JTX Ace shows **$1,320** against a
  stored `priceFrom: 897`, and the 25 UTV styles show formula numbers against Method's and
  Raceline's own advertised prices. Preferring `priceFrom` is a one-line change, but it moves
  the displayed price on ~241 models, so it needs a MAP decision rather than a quiet fix.
- 🟡 **2.9 · UTV prices are the manufacturer's advertised price**, read from Method's and
  Raceline's storefronts (per wheel; set-of-four is that times four). Real numbers, but not
  yet checked against dealer cost or either brand's MAP terms. One style — Method 413 UTV
  Forged Beadlock — is sold out at every variant, so it has no published price and still
  falls back to the formula.

## 3. Brands — CLAUDE.md rule 3

| # | What | Status |
|---|---|---|
| 3.1 | The brand wall displays brands we are **not yet authorised to sell**. | 🔴 Rule 3 says placeholder-driven until distributor accounts clear. Data is in one file (`brands.js`) so this is a fast swap. |
| 3.2 | 13 tire brands referenced but never loaded with real data. | 🟡 |
| 3.3 | Liberty Forged listed but unstocked. | 🟡 |
| 3.4 | **"Lowered & street" and "Cars & vans" were removed from the homepage** (2026-09-07). Both pointed at inventory we do not carry: Weld, Cosmis, HRE, Vossen, Cragar, Enkei and BBS are not in the catalog, and all 21 brands we do carry are forged truck, off-road or dually. Rule 3 forbids showing brands we are not authorised to sell, so the honest move was to cut the lanes rather than fill them. | 🟡 Restore both when those distributor accounts clear. |

---

## 4. Data gaps we are papering over honestly

These are all *surfaced in the UI* rather than hidden, so they are not blockers — but
each one is a phone call away from being better.

| # | What | Status |
|---|---|---|
| 4.1 | **F-450 wide-front offset** — nobody publishes it. UI says "spec'd by JTX" and declines to draw a stance. | 🟡 One call to JTX fills it in. `data/specs/f450-fitment.json` |
| 4.2 | **Vehicle body measurements** are estimates (`measured: false`), so stance is described in words, not decimals. | 🟡 An afternoon with a tape on a real truck. |
| 4.3 | **Plate scale** is estimated off the photo (`referenceMeasured: false`). Relative sizing is exact; absolute carries the error. | 🟡 |
| 4.4 | **JTX sizes are now scraped, not guessed.** `tools/scrape-jtx-sizes.js` reads all 84 single and 69 dually product pages and refuses to write if they disagree. 142 of 154 models carry published sizes; only the F-450 has real fitment data. | 🟢 Was: 5 of 154 had real specs. |
| 4.5b | **JTX shoot two finishes and only two.** Probed their uploads for B, GB, MB, BR, C and every other plausible code — all 404. There is no plain all-black render. | 🟡 Ask JTX whether a plain-black render exists internally. |
| 4.5d | **Our black render is byte-for-byte the file JTX serve on their own product page** (`26X14-<MODEL>-8-LUG-BM.png`, linked from jtxforged.com/<model>-single/). Nothing was re-cut or re-coloured, so what the site shows is what JTX shows. | 🟢 Verified 2026-08-27. |
| 4.5c | **What "Black Milled" actually looks like in JTX's render:** solid black spoke faces with the bare aluminium on the spoke sides, the undercuts and the surfaces behind. Checked on Centerfire, Silencer, Psycho and Dime — consistent, so it is house style, not a bad file. It reads oddly at a glance because the metal sits behind the faces rather than across them. | 🟡 Worth confirming with JTX that this render represents the black finish they would actually build, since customers read it as chrome bleeding through. |
| 4.5 | **Finish photos exist for two of six finishes.** JTX build Polished, Brushed, Black, Black Milled, Chrome and Custom; they publish renders for Polished and Black Milled only. Swatches show just those two; the rest are named in a "more finishes to order" note. | 🟡 Ask JTX for the missing four and the swatches light up automatically. |
| 4.9 | **Series coverage:** 20 models have single-series art, 14 have a complete dually front+rear pair. Capo's single exists only in polished — JTX publish no three-quarter black for it, only a head-on, which would clash with the rest. Ace has no series render at all and is covered by the view-more link. | 🟡 Ask JTX for the three-quarter black Capo and for Ace. |
| 4.7 | **Ace and Monarch** have no finish art at all (dually-only styles with no single-series render). They fall back to the catalog photo. | 🟡 |
| 4.8 | Other brands have **one photo per model**, so their wheel pages show finishes as text options with no image switching. | 🟡 |
| 4.6 | **Tire width** is not visually represented — a 22x12 and 22x14 share one render. | 🟡 Needs per-width art. |
| 4.10 | **Offset coverage: 4 sourced figures, 1 explicit gap.** 8.25" dually rear (ET+110–130) from the documented aftermarket range; 12" ≈ ET-44, 24x12 ≈ ET-51, 14" ≈ ET-76, 16" ≈ ET-101 from Custom Offsets / Luxxx HD / Specialty Forged / Fittipaldi listings. **10" has no reliable public figure** and carries an explicit null — the page prints "Not published", never a guess. Wide-front (super single) offsets are a known gap for every DRW platform. `data/specs/offsets.json`; `tools/build-specs.js` fails the build if any figure lacks a `source`. | 🟡 One call to JTX would fill the wide-front gap. |
| 4.11 | **602 of 756 models have no sourced bolt pattern.** Only `jtx` carries a `bolts` array; zero models carry their own. Surfaced honestly — forged brands say "Drilled to order", cast brands say "Not published for this style" — never a blank. `tools/build-featured.js` already reads and emits `e.bolts`, so this is a pure data task: populate `data/featured/<brand>.json`. | 🟡 |
| 4.12 | **42 models are misclassified.** Their `configs` include `"single"` but their only published widths are 8.25" — the dually width (kg1 12, fittipaldi 12, tis 9, american-force 5, amani 3, axe 1). The size filter carries a never-empty guard so their tables still render, but the underlying `configs` in `data/featured/<brand>.json` are wrong. | 🟡 One pass over those files fixes it properly. |
| 4.13 | **377 of 756 models have no photo.** The wheel page now shows a named placeholder ("Photo coming — ask us and we'll send one") instead of requesting `/undefined`, which was firing a 404 on every one of those pages. | 🟡 Fixed in the UI; the art is still missing. |
| 4.14 | **The invented sizes are gone, and so is the thing that invented them.** `tools/build-featured.js:160` carried a hardcoded `["22x12","24x14","26x14"]` fallback, and new models otherwise inherited `brand.models[0].sizes` — which is how 154 JTX models came to share three size-lists. JTX publish **18** sizes per single-series wheel; we were showing 3 or 5. The literal is deleted; sizes are now stamped from `data/specs/jtx-sizes.json`. | 🟢 |
| 4.15 | **12 JTX dually models have no product page to verify against** — `D-206`–`D-217`. `D-200`–`D-205` do have pages, so this is a gap on JTX's site. Their sizes are left exactly as they were rather than blanked or invented, and the generator names them on every run. | 🟡 Ask JTX for the sizes on these twelve. |
| 4.16 | **28 JTX single models carry the line-wide list rather than their own page** — `Grip` and `SS-200`–`SS-226`. This is inference, not invention: all 84 published single pages carry a byte-identical 18-size list, and `SS-###` is JTX's own Single Series naming. Recorded because it is still inference. | 🟡 |
| 4.17 | **The dually lists are genuinely per-model, and we nearly missed it.** A nine-page sample all agreed, which suggested one line-wide list; scraping all 69 found three variants of the front-standard list (60 start at 22", 8 at 24", `Widow` at 26") and two of the super-single list. The scraper stores per model whenever pages disagree and only shares a list when every page matches. | 🟢 The consensus check is what caught it. |
| 4.18 | **`proto.sizes` inheritance still invents sizes for the other 20 brands.** New models added by `build-featured.js` copy the alphabetically-first model's sizes when the data file gives none. Fixed for JTX by real data; unfixed elsewhere because we have no ground truth to replace it with. | 🔴 Same class of defect as 4.14, just without a source yet. |
| 4.19 | **Shop prices moved as a side effect.** `catalog.js:38` derives a card's "from" price from the smallest diameter offered; correcting JTX singles pulled that from 22" to 20", so 91 formula-priced JTX cards dropped $110. The formula behaving correctly on corrected input — and those figures are placeholders anyway (see 2.1). | 🟡 Noted so it is not mistaken for a pricing bug. |
| 4.20 | **The dually lane runs on our own photos, because no manufacturer has any.** JTX's gallery contains no dually trucks (all 70 cached URLs checked), their dually product pages carry no truck photography, and of the other dually brands we carry none has a scrapeable gallery — Vision's 510-image gallery has exactly one dually in it. So the lane falls back to the nine `assets/builds/dually-*.jpg` already in this repo and already on the homepage. Each lane uses **one** source so its credit line stays true: lifted shows 12 hot-linked JTX photos and credits them; dually shows ours and claims nothing. Local tiles carry **no caption** — the captions on these same files elsewhere are fabricated (1.5), and repeating an invented size under a real photo is the part that would actually mislead. | 🟡 Rights on `assets/builds/` are still unconfirmed (1.4). |
| 4.21 | **The lifted lane hides 106 single-config models on purpose.** They have no published width over 8.25 — the dually rear width — because their `configs` are wrong (see 4.12). Showing a dually wheel in a lifted lane would put a data bug on display. Styles whose widths are simply unpublished are still shown: "we don't know" is not "no". | 🟡 Fixing 4.12 removes the need for this. |
| 4.22 | **The homepage hero now has a real mobile image.** `truck-hero.jpg` is a 1672x941 landscape; on a phone `object-fit:cover` showed about a quarter of its width — a vertical slice through the truck's rear door — and the old fix layered a blurred, scaled copy of the same photo underneath to fill the gaps. `assets/truck-hero-mobile.jpg` is that photo cropped to 621x941 around the grille and front wheel, served by a `<source>` at <=560px, so the blur hack is gone. | 🟢 |
| 4.23 | **The mobile CTA photo was cropped** so the truck is visible. The section is a photo with a white form card on it; the card covered the truck entirely, leaving sky and two 22px slivers. The top ~35% of `assets/cta-truck-mobile.jpg` was dead sky, now removed (1080x1600 -> 1080x1040). The original is in git at `65d08b6` if a different framing is wanted. | 🟢 |
| 4.24 | **iOS was zooming the page on every form tap.** Safari zooms in — and stays zoomed — when an input, select or textarea under 16px is focused. It affected the three selects in the homepage fitment finder (14px), the shop sort (13px) and the CTA form inputs (15px): the primary conversion control and the main catalogue control. All raised to 16px under 560px. | 🟢 |

---

- 🟡 **4.25 · The UTV line is a new product category from existing brands.** Method and
  Raceline were already in the catalog as truck brands, so rule 3 is satisfied on the brand —
  but a distributor agreement for truck wheels does not automatically cover a side-by-side
  programme. Confirm both lines are on the same account before launch.
- 🟡 **4.26 · Nine UTV styles ship with no finish.** Raceline's older listings state the
  finish only in the product photograph, in no field we can read. Left empty rather than
  guessed — a swatch we invented would be a colour the customer can't order.
- 🟡 **4.27 · No build photos for the side-by-side lane.** `shop.html?build=utv` renders no
  photo strip because `builds-data.js` has no `utv` entry. Correct behaviour, but it means
  the newest lane is the one with no proof underneath it.

- 🟡 **4.28 · The Instagram links point at instagram.com/drooolywheelco.** They were all
  `href="#"`, which reads as broken when a client clicks one, so they now go to the handle
  the page already prints in three places. Nobody has confirmed that account exists or is
  the right one — check before launch, and note the follower counts on that section are
  still fabricated (see 1.x).

- 🔴 **4.29 · The header phone number is a personal cell, and its area code is wrong for
  the business.** `602-332-5400` is Chris's own number, supplied as a placeholder — "we will
  change this later." It now sits in the header of all eight pages, in the footer, and in
  the `telephone` field of the homepage Store JSON-LD, which is the copy search engines and
  map listings read. Two separate problems: (a) every enquiry from the site rings a personal
  phone, and (b) **602 is Phoenix** while the business is in Grimsley, TN — a 931 or 615
  number is what a local customer expects, and a mismatched area code in structured data
  works against local search. Replace with the business line before launch; the string
  appears as both `602-332-5400` (display) and `+16023325400` / `+1-602-332-5400` (tel: and
  JSON-LD), so grep for all three.

- 🟡 **4.30 · buddy.html is a one-off page that must not survive launch.** Built
  2026-09-30 to show one person one truck: a green '73 C10 belonging to a friend of
  Chris's, composited onto the homepage sunset plate. It is `noindex, nofollow`, it is
  not in the nav, not in `sitemap.xml`, and nothing links to it — you only reach it if
  you have the URL. Two things to settle before launch: **delete it** (it has nothing to
  do with the business), and note that the photograph is a third party's vehicle supplied
  by Chris, so the same rights question as section 1 applies to `assets/buddy-c10.jpg`
  if it is ever reused. The original photo was uploaded to Chris's own Canva account to
  cut the truck out of its background; that asset can be deleted there too.

- 🟡 **4.31 · 377 of 781 wheel models have no photograph.** Every `img` path that IS
  recorded resolves on disk — nothing is broken — but nearly half the catalogue has no
  art at all, and it is very unevenly spread: JTX 135 of 154 and Hardrock 24 of 25
  against American Force **32 of 287** and Liberty Forged **0 of 7**. Brand pages degrade
  honestly (Liberty shows series and "get pricing" rather than empty frames) so this is
  not a bug, but a brand page with no wheel on it does not sell a wheel. American Force
  is the one to fix first on volume alone.

- 🟡 **4.32 · Tyre brand logos are hotlinked or absent.** Of seven brands, three
  (BFGoodrich, Nitto, Toyo) load a logo from Wikipedia or the manufacturer's own server;
  **Fury Offroad's URL is dead** (`furyoffroad.com/wp-content/uploads/2021/03/fury-logo.png`
  returns nothing) and AMP, Falken and Mickey Thompson are `"logo": null` in
  `data/tires/*.json`. Those four fall back to the brand name in text. Host all seven
  locally and the rights question joins section 1.

- 🟡 **4.33 · The financing page claims an in-house credit line.** The sixth partner card
  ("Fitment line — full dually packages running $8k+? Talk to a specialist about our
  in-house extended terms and commercial fleet financing") describes a facility nobody
  has confirmed exists. Related to 2.7, which covers the financing *figures*; this is the
  existence of the product itself. The heading was corrected from "Five ways" to "Six"
  to match the six cards on the page — if the in-house line is not real, the card goes
  and the heading goes back to five.

- 🔴 **4.34 — the Facebook link is a guess.** The footer's Follow column now carries an
  Instagram mark (real: `instagram.com/drooolywheelco`) and a Facebook mark pointing at
  `facebook.com/drooolywheelco`, which was assumed from the Instagram handle and has not
  been verified. Nobody supplied a Facebook URL. Either confirm the page exists at that
  handle, replace the URL, or delete the Facebook mark — a social icon that 404s on a
  shop's own footer is worse than no icon. The handle appears in all eight page footers.

- 🔴 **4.35 — the vehicle bolt-pattern table is researched, not verified.**
  `data/fitment/vehicle-bolt-patterns.json` carries 97 entries across 15 makes,
  1997-2026. 79 are marked `high` (widely published and consistent across
  sources) and 18 are marked `check` — mostly vans, chassis cabs and older
  compacts where a trim or chassis split could move the pattern. **Nothing in
  it has been checked against a physical vehicle.** A wrong row here does not
  produce a bad page, it produces a customer receiving wheels that will not
  bolt on, so the UI must keep saying the pattern is confirmed before the
  wheels are built rather than that they fit. Work the `check` rows first.

- 🔴 **4.36 — the wheels have no bolt patterns, so nothing can actually be
  filtered yet.** 25 of 781 models carry a `bolts` field, and all 25 are the
  UTV models scraped from Method's and Raceline's own feeds. Every truck and
  dually wheel — American Force 287, JTX 154, KG1 35, Fuel 34, Hostile 34,
  Amani 14 — has none. JTX is the one brand with a list, and only at brand
  level: 8x170, 8x180, 8x165.1, 6x135, 6x139.7, 5x150. Until this is sourced,
  the finder can tell a customer what their truck is drilled to but cannot
  honestly narrow the catalogue to it.

- 🟡 **4.37 — six brands are marked "made to order" on reasoning, not on a rep's
  word.** `data/fitment/brand-drilling.json` treats JTX, American Force, Amani,
  KG1, Fenix and Liberty as cut-per-order, which is what custom forged is and
  what Chris said of JTX. Only JTX's pattern list came from data already in the
  repo; the other five were reasoned from the product. **Confirm each brand's
  actual pattern range with the rep before launch** — especially American
  Force, which is the only brand currently claiming the 10x225 F-450 pattern,
  so an F-450 owner sees 27 wheels and all 27 rest on that one assumption.
  Three more brands carry forged lines that are probably also made to order —
  Fuel Forged, Hostile's forged range, KMC Forged — and sit in `unknown` until
  someone asks. Moving them is a sales call, not a research task.

- 🔴 **4.38 — 369 of 781 wheels have no photograph.** Every path that IS set
  resolves (0 broken), so this is coverage, not rot. The gap is concentrated:
  **American Force 254 of 287**, then JTX 19, Fuel 9, Hostile 9, Vision 8,
  Amani 7, Fenix 7, Liberty 7 (all of them). Those cards render the CSS emblem
  placeholder, which reads as a missing photo rather than a design choice.
  There is nothing on disk to wire up — 108 unused files exist but they are
  finish variants of models that already have art. These have to be sourced
  from the manufacturers, which also makes 1.2 (wheel photo rights) bigger.

  **Do not match photos by filename alone.** It offered an American Force
  "Dynamo" a Fuel photo and an Amani "Empire" a JTX one — both would have put
  a competitor's wheel on the page. A test now blocks cross-brand art.

## 5. Feature debt

| # | What | Status |
|---|---|---|
| 5.1 | **Wheel visualizer removed from the site** (2026-08-27). `visualizer.html` and the superseded `fitment.html` prototype are deleted; nav, footer, sitemap and card links cleaned. Replaced by the builds gallery, which does the same job with photographs. | 🟢 |
| 5.2 | **Visualizer code and data kept, unreferenced** — `visualizer.js`, `fitment.js`, `vehicles.js`, `wheel-specs.js`, `data/specs/`, `data/plates/`, `tools/build-specs.js` and their 54 tests all remain. The spec research (real JTX sizes, F-450 fitment, tire rules) is the valuable part and still guards against invented options. | 🟡 On hold, not abandoned. Resuming needs a layered plate: background with wheels removed, separable body, foreground fender lips. |
| 5.3 | Builds gallery covers **JTX only**. The filename-parsing trick needs verifying per brand before extending it. | 🟡 |
| 5.5 | **Brand pages split by series** — singles and duallies are separate lists, because a dually wheel does not fit a single-rear truck and interleaving them invites the wrong order. A style built both ways appears in both, with the right render for each. | 🟢 |
| 5.4 | **Wheel pages now exist** (`wheel.html`). Clicking a wheel used to dump you on the homepage enquiry form; it now opens that wheel's own page with finishes, sizes, bolt patterns, price and — for JTX above the photo floor — a link to that wheel on real trucks. | 🟢 |
| 5.6 | **The shop grid was a dead end.** `productCard()` rendered an `<article>` with no link, so the one page listing all 756 wheels could not reach a single wheel page — every size, offset and bolt pattern was unreachable from it. Brand pages have always linked through with a different card component. Fixed with a full-card overlay link; the two real buttons on the card still work. | 🟢 |
| 5.7 | **Two card components still exist** — `productCard()` (shop + homepage) and `wheelCard()` (brand pages, with finish swatches). They render the same product differently. Worth collapsing into one. | 🟡 |
| 5.8 | **Find my fitment now finds something.** It used to save the truck to `localStorage` and scroll to the same grid it showed everyone. It now resolves the truck through `matchVehicle()` and lands on the dually or single-rear lane — narrowing on axle configuration, which is a fact about the truck, not a clearance claim. | 🟢 |
| 5.9 | **The homepage vehicle list is no longer hand-written.** `script.js` carried its own literal while `vehicles.js` claimed to be the single source of truth; the finder offered four makes against nine known platforms and omitted every DRW variant — the ones that matter most here. Now derived from `window.VEHICLES`. | 🟢 |

---

## 6. Verified good

- 🟢 No fitment guarantees anywhere — asserted by a language guard in `tools/test-fitment.js`,
  which now scans the whole comment-stripped source of `wheel.js`, `catalog.js`, `builds.js`
  and `script.js`, not just what `fitment.js` emits.
- 🟡 **That guard was silently broken and is worth knowing about.** It used to extract string
  literals; six trailing `//` comments contain apostrophes (`can't`, `you're`), each opened a
  bogus single-quoted string that swallowed text to the next apostrophe, and the scan walked
  out of alignment and skipped whole regions — including an injected violation, while
  reporting 766 literals found and passing. A count is not proof of coverage. Both negative
  tests now pass against two different files.
- 🟢 No warning modals or interstitials (rule 2).
- 🟢 Fitment logic isolated in one DOM-free module (`fitment.js`), 54 tests passing.
- 🟢 Product data is file-driven — `data/specs`, `data/plates`, `data/builds`, `data/tires`, `data/featured`.
- 🟢 The builds gallery hosts no images — URLs and metadata only, every tile links back to the source.
- 🟢 The gallery link only appears above a three-photo floor, so it never promises more than it delivers.
- 🟢 Mobile-first; no horizontal scroll at 375px — re-verified 2026-09-29 across index, shop,
  tires, financing, builds, brand and wheel pages, with a clear console on each.
- 🟢 No dead links or missing image files on the homepage; every in-page anchor resolves.
- 🟢 `styles.css` braces balance. A stray top-level `}` (left over from an old media query)
  was removed; browsers had been discarding it.
- 🟢 UTV sizes, bolt patterns and prices are scraped from Method's and Raceline's own
  product feeds (`tools/scrape-utv.js` → `data/specs/utv-models.json`) — published specs,
  nothing inferred. Quad sizes are kept as published and filtered at display, not deleted.
- 🟢 The UTV merge refuses to overwrite a same-named truck wheel. Raceline builds both a
  truck Hostage and a UTV A92 Hostage; the first pass collapsed them and took the truck
  wheel's sizes, finishes, price and featured rank with it. The merge now throws instead.
- 🟢 The language guard covers the new lane copy — proven by injecting a violation into
  `catalog.js` and watching the suite fail, then pass again once removed.

---

## Before flipping the switch

1. Clear or replace everything 🔴 above.
2. Restore `robots.txt` and strip the `noindex` tags — **see section 0**.
3. Re-run `node tools/test-fitment.js` (expect 81+ passing).
4. Re-run `node tools/scrape-jtx-sizes.js` — it must report every page agreeing before it writes.
5. Re-run `node tools/build-specs.js` and confirm it prints **no** uncleared-plate warning.
6. Confirm the Pages build commit matches local `HEAD`.

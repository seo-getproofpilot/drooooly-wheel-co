# LAUNCH CHECKLIST — DROOOLY Wheel Co.

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
| 1.4 | **Truck photography** — 40 files, rights unconfirmed, predates this work | `assets/builds/` | 🔴 Still used on the homepage build gallery. Replace with owned photos or license. |
| 1.5 | **Fabricated captions** on the homepage build gallery | `index.html` | 🔴 Captions describe builds that aren't ours. Rewrite or remove. |
| 1.6 | **Visualizer placeholder plate** | `data/plates/f450-dually-16.json` (`cleared: false`) | 🟢 Page removed; data retained but no longer rendered anywhere. |

**The fix that retires most of this:** photograph every set DROOOLY installs. Phone is
fine — walk around it, get a true side profile. Owned, on-brand, and it's the one
asset a competitor can't copy. Start before launch and 1.3/1.4/1.5 mostly evaporate.

---

## 2. Pricing — CLAUDE.md rule 4

| # | What | Status |
|---|---|---|
| 2.1 | `shop.html` shows **formula-generated prices**. They are invented. | 🔴 Replace with real dealer cost + MAP, or gate to "get pricing". |
| 2.2 | MAP terms not verified per brand; some brands forbid advertising price at all. | 🔴 Confirm per brand before any number is public. |
| 2.3 | Brand-level "starting at" figures came from authorised-dealer listings, not our own cost. | 🟡 Re-derive once distributor accounts clear. |
| 2.4 | **The stored set price is for four wheels.** A dually set is six, so dually cards and dually wheel pages no longer restate a four-wheel total — they say the set is six and leave the figure to the quote rather than inventing one by multiplying. | 🟢 |

---

## 3. Brands — CLAUDE.md rule 3

| # | What | Status |
|---|---|---|
| 3.1 | The brand wall displays brands we are **not yet authorised to sell**. | 🔴 Rule 3 says placeholder-driven until distributor accounts clear. Data is in one file (`brands.js`) so this is a fast swap. |
| 3.2 | 13 tire brands referenced but never loaded with real data. | 🟡 |
| 3.3 | Liberty Forged listed but unstocked. | 🟡 |

---

## 4. Data gaps we are papering over honestly

These are all *surfaced in the UI* rather than hidden, so they are not blockers — but
each one is a phone call away from being better.

| # | What | Status |
|---|---|---|
| 4.1 | **F-450 wide-front offset** — nobody publishes it. UI says "spec'd by JTX" and declines to draw a stance. | 🟡 One call to JTX fills it in. `data/specs/f450-fitment.json` |
| 4.2 | **Vehicle body measurements** are estimates (`measured: false`), so stance is described in words, not decimals. | 🟡 An afternoon with a tape on a real truck. |
| 4.3 | **Plate scale** is estimated off the photo (`referenceMeasured: false`). Relative sizing is exact; absolute carries the error. | 🟡 |
| 4.4 | Only **5 of 154** JTX models have real specs; only the F-450 has real fitment data. | 🟡 Deliberate — narrow and correct beats broad and invented. |
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

---

## 5. Feature debt

| # | What | Status |
|---|---|---|
| 5.1 | **Wheel visualizer removed from the site** (2026-08-27). `visualizer.html` and the superseded `fitment.html` prototype are deleted; nav, footer, sitemap and card links cleaned. Replaced by the builds gallery, which does the same job with photographs. | 🟢 |
| 5.2 | **Visualizer code and data kept, unreferenced** — `visualizer.js`, `fitment.js`, `vehicles.js`, `wheel-specs.js`, `data/specs/`, `data/plates/`, `tools/build-specs.js` and their 54 tests all remain. The spec research (real JTX sizes, F-450 fitment, tire rules) is the valuable part and still guards against invented options. | 🟡 On hold, not abandoned. Resuming needs a layered plate: background with wheels removed, separable body, foreground fender lips. |
| 5.3 | Builds gallery covers **JTX only**. The filename-parsing trick needs verifying per brand before extending it. | 🟡 |
| 5.5 | **Brand pages split by series** — singles and duallies are separate lists, because a dually wheel does not fit a single-rear truck and interleaving them invites the wrong order. A style built both ways appears in both, with the right render for each. | 🟢 |
| 5.4 | **Wheel pages now exist** (`wheel.html`). Clicking a wheel used to dump you on the homepage enquiry form; it now opens that wheel's own page with finishes, sizes, bolt patterns, price and — for JTX above the photo floor — a link to that wheel on real trucks. | 🟢 |

---

## 6. Verified good

- 🟢 No fitment guarantees anywhere — asserted by a language guard in `tools/test-fitment.js`.
- 🟢 No warning modals or interstitials (rule 2).
- 🟢 Fitment logic isolated in one DOM-free module (`fitment.js`), 54 tests passing.
- 🟢 Product data is file-driven — `data/specs`, `data/plates`, `data/builds`, `data/tires`, `data/featured`.
- 🟢 The builds gallery hosts no images — URLs and metadata only, every tile links back to the source.
- 🟢 The gallery link only appears above a three-photo floor, so it never promises more than it delivers.
- 🟢 Mobile-first; no horizontal scroll at 375px.

---

## Before flipping the switch

1. Clear or replace everything 🔴 above.
2. Restore `robots.txt` and strip the `noindex` tags — **see section 0**.
3. Re-run `node tools/test-fitment.js` (expect 54+ passing).
4. Re-run `node tools/build-specs.js` and confirm it prints **no** uncleared-plate warning.
5. Confirm the Pages build commit matches local `HEAD`.

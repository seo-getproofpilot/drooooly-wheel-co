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
| 1.1 | **JTX wheel renders** — 70 head-on images pulled from `jtxforged.com` uploads (30 dually + 40 single-series finish art) | `assets/wheels/jtx/drw/`, `assets/wheels/jtx/finish/` | 🔴 Ask JTX for media-kit permission. Routine request; they want dealers showing their wheels. |
| 1.2 | **All other brands' wheel photos** — scraped from manufacturer/dealer sites | `assets/wheels/**` | 🔴 Same ask, per brand. Roll into the distributor conversation. |
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
| 4.5 | **Finish photos exist for two of six finishes.** JTX build Polished, Brushed, Black, Black Milled, Chrome and Custom; they only publish renders for Polished and Black Milled. All six are offered on the wheel page — a finish is a different casting, not a hue shift, so the unrendered ones show a swatch and say which render is standing in rather than tinting a fake. | 🟡 Ask JTX for the missing four. Data acquisition, not code. |
| 4.7 | **Ace and Monarch** have no finish art at all (dually-only styles with no single-series render). They fall back to the catalog photo. | 🟡 |
| 4.8 | Other brands have **one photo per model**, so their wheel pages show finishes as text options with no image switching. | 🟡 |
| 4.6 | **Tire width** is not visually represented — a 22x12 and 22x14 share one render. | 🟡 Needs per-width art. |

---

## 5. Feature debt

| # | What | Status |
|---|---|---|
| 5.1 | **Wheel visualizer removed from the site** (2026-08-27). `visualizer.html` and the superseded `fitment.html` prototype are deleted; nav, footer, sitemap and card links cleaned. Replaced by the builds gallery, which does the same job with photographs. | 🟢 |
| 5.2 | **Visualizer code and data kept, unreferenced** — `visualizer.js`, `fitment.js`, `vehicles.js`, `wheel-specs.js`, `data/specs/`, `data/plates/`, `tools/build-specs.js` and their 54 tests all remain. The spec research (real JTX sizes, F-450 fitment, tire rules) is the valuable part and still guards against invented options. | 🟡 On hold, not abandoned. Resuming needs a layered plate: background with wheels removed, separable body, foreground fender lips. |
| 5.3 | Builds gallery covers **JTX only**. The filename-parsing trick needs verifying per brand before extending it. | 🟡 |
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

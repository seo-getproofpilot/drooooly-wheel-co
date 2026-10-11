# DROOOLY 3D wheel configurator: design spec (vertical slice)

Date: 2026-10-10. Status: approved by Matthew in chat, 2026-10-10 9:55pm CDT.

## Intent

A guided, truck-first 3D visualizer that takes a customer from "this is my truck" (or "this is
the truck I am buying") to a rendered wheel, tire and lift setup they can share, then into a
quote request. It must look like the real DROOOLY store and feel premium on a phone. It must be
honest: only published sizes, fitment stated in words until a platform is measured, never a
guarantee.

What exists in the market (research in `~/clients/droooly/work/3d-configurator/research/`):
the incumbent (Autosync / iConfigurators) is a 2D photo composite with three angles and canned
lift steps; offset is text, not geometry; no real-time 3D tool covers a Super Duty, Ram HD or GM
HD; the only honest lifted data is Custom Offsets' real-build photos, which cannot swap a wheel.

## Decisions (made, not open)

| Decision | Choice | Why |
|---|---|---|
| First trucks | F-250 Super Duty and F-150, in parallel | One hero per tier; HD is the niche, half-ton is the audience |
| Fitment freedom | Published options only, shown honestly | Every real diameter, width, offset and tire size the wheel is made in, rendered true to scale. Poke, tuck and rub shown in words. Custom offsets stay an ordering conversation |
| First milestone | Vertical slice | Proves the look and the pipeline before scaling to every truck |
| Truck meshes | Unbadged lookalike bodies per body family, exact fitment data, named nominatively | Marketplace licenses block raw glTF delivery; Ford and GM models need OEM approval; Farming Simulator's pickups are unlicensed lookalikes ("Lizard"). Same posture as FS, BeamNG and today's 2D visualizers. Lawyer read before public launch |
| Rendering | Real-time WebGL (Three.js), not pre-rendered | Catalog is ~3 billion configurations; a new SKU is one GLB, not millions of frames |

## 1. What the customer sees

Standalone page at `/visualize/` on drooolywt.com. Mobile first (works at 390px), desktop at 1280.
Five guided steps, one screen each, with a persistent 3D stage:

1. **Your truck.** Make, model, year, cab. "Shopping for a truck" picks from the same list.
2. **Paint.** The ten named colors in `vehicles.js` `VEHICLE_PAINT`.
3. **Stance.** Stock, leveled, 2.5, 4 or 6 inch lift. Tire diameters offered are the ones the
   platform runs at that lift (from catalog data, never free-form).
4. **Wheels.** Brand, model, size (diameter x width), finish. Only sizes and configs the brand
   publishes in `brands.js`. Dually configs render the rear pair. Brands not authorized never
   appear (site rule 3).
5. **Summary.** Fitment call in words (tuck / flush / poke, rub risk), load-rating hard stop
   (site rule 5: buy button becomes contact CTA), then quote request or financing pre-qual.

Camera: four presets (low front three-quarter, side profile at axle height, rear three-quarter,
wheel close-up) plus damped free orbit. Every state is a shareable URL and a PNG snapshot.

## 2. Architecture

- Stack: Three.js r186+, React Three Fiber 9, drei 10, Vite, TypeScript, vitest, Playwright.
- Lives in `configurator/` in this repo. Builds to static `visualize/` so the vanilla site stays
  no-build. WebGL2 baseline; WebGPU later behind feature detection.
- Modules, one job each:
  - `fitment-core`: pure math, no DOM. Extends the existing `fitment.js` (do not fork its
    parseSize and stance rules; import or port them with the existing tests still passing).
  - `catalog`: reads `brands.js`, `tires.js`, `vehicles.js`, `finishes.js`,
    `data/specs/offsets.json`, `data/specs/f450-fitment.json` as data, via a build-time export
    to JSON (`tools/export-catalog.js`). No product knowledge in components.
  - `scene`: truck and wheel loaders, materials, lighting, shadows, camera presets.
  - `flow`: step state machine, URL state (`?v=f250&y=2024&p=agate&l=6&w=jtx-ace-24x14&f=polished&t=37x13.5r24`).
  - `quote`: hands the config string to the existing quote form pattern (`jtx.html` `#quote`).
- Assets served with the site for the slice; Cloudflare R2 when the library grows.

## 3. Truck model library

- One unbadged body mesh per body family: Super Duty 2023+ crew cab (platform `f250`) and
  F-150 2021+ crew cab (platform `f150`) first.
- Geometry truth: wheelbase, track, overall width and height, fender arch radius and fender
  edge from published OEM dimensions and blueprints. No grille logo, no badges, no OEM lettering.
- Named nodes the code depends on: `body`, `glass`, `chassis`, `bed`, `hub_FL`, `hub_FR`,
  `hub_RL`, `hub_RR` (empties at axle centre, +X outward), `fender_FL..RR` (arch-edge anchors),
  `shock_*`. Dually rears add `hub_RL_inner`, `hub_RR_inner`.
- Paint is a `KHR_materials_variants` variant (clearcoat + flake normal). Lift moves nodes; it
  is never a second mesh.
- Pipeline: Blender headless export, `gltf-transform` (prune, dedup, weld, simplify, meshopt,
  KTX2), then a CI gate (`tools/check-3d-budgets.js`) that fails any truck over 5 MB or 200k
  triangles and any wheel over 0.6 MB.
- Sourcing: commissioned from a Blender modeler per body family (estimate $500 to $1,500 and
  about a week each; unverified). Until they land, a CC0 generic pickup stands in so every other
  module is built and tested now. The stand-in never ships.
- Each `vehicles.js` entry gains a `model` block (`file`, `wheelbaseIn`, `trackIn`,
  `stockTireOdIn`, `measured`). The catalog stays the single source of truth.

## 4. Wheels and tires

- Slice: three to five JTX programs (pick from `finishes.js` captured renders) as meshes with
  finishes as physical materials: polished, brushed, black, black milled.
- Path to 682 models: a parametric generator (spoke silhouette traced from the brand's product
  render, barrel lathed to diameter and width). Hero models hand-built.
- Tire: one parametric mesh scaled from the size string (metric and flotation), tread as a normal
  map per family (all-terrain, mud-terrain), sidewall lettering limited to the size for now.

## 5. Fitment math and honesty rules

One pure function in `fitment-core`:
`fit({platform, lift, wheel:{d,w,offsetMm}, tire, config, towWeight?})` returns per-corner hub
offset, tire scale, body height, arch gap, poke in mm, class (tuck / flush / poke), rub risk,
load-rating pass. Offsets come from `offsets.json` roles and the F-450 dialled data.

Rules that are not negotiable (from `CLAUDE.md` and `vehicles.js`):
- While a platform is `measured:false`, the UI describes stance in words, no decimals.
- Never "guaranteed fit". Copy says "fitment verified before we build it".
- Load-rating shortfall replaces the buy button with a contact CTA.
- Unauthorized brands never appear. Price display is gated per brand (MAP).
- Mounted mail-order is never "free shipping".
- No popups, modals or interstitials.

## 6. Rendering and load

- Studio HDRI (Poly Haven, CC0). Baked contact shadow per truck plus a cheap real-time shadow.
- Paint: `MeshPhysicalMaterial` clearcoat with a tileable flake normal, sheen for pearls.
- TAA and GTAO only when a frame-time check passes.
- Poster image first, truck streamed (under 5 MB), wheels on interaction (under 0.6 MB each).
- Target: interactive under 10 s on a 4G iPhone. Dispose textures on swap (iOS memory).

## 7. Testing

- `fitment-core` unit tests with fixtures: factory F-450 (dialled), 22x12 -44 on a 6 inch F-250,
  stock F-150. Existing `tools/test-fitment.js` keeps passing.
- Catalog test parses every size string in `brands.js` and `tires.js`.
- Playwright end to end at 390 and 1280 with screenshots, bundled Chromium only.
- Asset budget gate in CI. axe on the flow.

## 8. Slice scope

In: F-250 and F-150, ten paints, lifts 0 / 2.5 / 6, three to five JTX programs with every
published size and finish, one all-terrain and one mud-terrain tire family, full flow into quote
request, share URL and snapshot.

Out until the next cycle: duallies, GM and RAM, UTV, cars, AR, saved accounts, photo upload,
WebGPU, R2 hosting.

## 9. Risks

- Mesh commissioning is the critical path; the stand-in starts everything else now.
- Trade dress: lawyer read before public launch; entry in `LAUNCH-CHECKLIST.md`.
- Wheel count is solved by the generator, not by hand.
- iOS memory pressure: dispose textures, enforce budgets.

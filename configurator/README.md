# DROOOLY 3D configurator

The guided wheel-on-truck visualizer served at `/visualize/`. A Vite + React Three Fiber app
that builds to the static `visualize/` folder at the repo root, so the rest of the site stays
no-build. Spec: `docs/superpowers/specs/2026-10-10-3d-configurator-design.md`. Plan:
`docs/superpowers/plans/2026-10-10-3d-configurator-slice.md`.

## Build

```
cd configurator
npm ci
npm run build        # exports the catalog, typechecks, writes ../visualize/
npm test             # vitest
npm run e2e          # Playwright, bundled Chromium, desktop and mobile
```

`npm run build` runs `tools/export-catalog.js` first, so a change to `brands.js`, `tires.js`,
`vehicles.js`, `finishes.js` or `data/specs/offsets.json` lands in the app on the next build.
Commit `visualize/` with the source; Railway and Pages serve it as static files.

## Where things live

| Folder | Job |
|---|---|
| `src/data/` | `catalog.json` (generated, never hand-edited), its types, the JTX program styles, the placeholder load rating |
| `src/fitment/` | `fitment3d.ts`, the placement layer over the site's `fitment.js`. Metres, axle on X, +X driver's side, +Y up, +Z forward, origin on the ground under the front axle |
| `src/geometry/` | Parametric wheel and tire meshes from catalog sizes |
| `src/materials/` | Finish materials (polished, brushed, black, black milled) |
| `src/scene/` | Stage (canvas, HDRI, shadows, cameras), Truck (glTF, paint, rake, lift), WheelSet, Poster fallback |
| `src/flow/` | Build state, URL encoding (`o` is the offset in mm), option lists, seeding a whole build, prefill from the URL or the homepage finder. No DOM |
| `src/ui/` | The truck sheet (first step on a cold open), the live panel and its sections, the callout words, and `copy.ts`, which holds every customer-facing string |
| `public/models/` | Truck GLBs and their licenses. `public/hdri/` the studio HDRI. `public/poster/` the no-WebGL images |

## Adding a truck

1. Add a `model` block to its entry in `vehicles.js`: `file`, `wheelbaseIn`, `trackIn`, `stockTireOdIn`, `stockWheelDiaIn`, `cab`.
2. Produce the GLB with the node contract: meshes `body`, `glass`, `chassis`, empty `bed`, empties `hub_FL`, `hub_FR`, `hub_RL`, `hub_RR` at x = ±track/2, y = stock tire radius, z = 0 (front) and -wheelbase (rear). No wheel or tire meshes. For a stand-in, add it to `tools/3d/truck-dims.json` and run the commands in `public/models/LICENSES.md`.
3. `node tools/test-3d-models.js && node tools/check-3d-budgets.js configurator/public/models/*.glb` (truck under 5 MB and 200k triangles).
4. Render its poster: `node tools/3d/render-posters.mjs`.

## Adding a wheel program

Add an entry to `src/data/jtx-programs.ts` with the spoke count, split or solid, dish and sweep read off the product image in `assets/wheels/jtx/`. Sizes, configs and finishes come from the catalog; nothing is typed twice.

## Rules the code enforces

Only published sizes and tire sizes are offered. Offsets come from `data/specs/offsets.json` or are stated as unknown. Stance is words while a platform is `measured:false`. The tow-weight check swaps the quote button for a contact link. Brands not in `allowed-brands.json` never appear. Every string a customer reads is in `src/ui/copy.ts` and passes the copywriting checker.

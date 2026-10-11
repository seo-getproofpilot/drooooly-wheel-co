# 3D Configurator Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/visualize/`, a guided five-step 3D wheel-on-truck configurator for the F-250 and F-150 with JTX wheels, honest fitment, and a quote handoff, built on the storefront's existing catalog and fitment module.

**Architecture:** A Vite + React Three Fiber app in `configurator/` that builds to the static `visualize/` folder, so the vanilla site stays no-build. Product data is exported from the site's `window.*` data files into one JSON at build time. Fitment math reuses `fitment.js` and adds a 3D placement layer. Trucks are glTF with named hub empties; wheels and tires are generated parametrically from catalog sizes.

**Tech Stack:** Node 22, npm, Vite 6, React 19, three r186+, @react-three/fiber 9, @react-three/drei 10, TypeScript, vitest, Playwright (bundled Chromium), @gltf-transform/cli, Blender 4+ headless (`/opt/homebrew/bin/blender`).

**Spec:** `docs/superpowers/specs/2026-10-10-3d-configurator-design.md`

## Global Constraints

- Site rules from `CLAUDE.md` apply to every string a customer sees: never "guaranteed fit" (say "fitment verified before we build it"); no popups, modals or interstitials; never show a brand not in `configurator/allowed-brands.json`; prices gated per brand (MAP), null means not shown; load-rating shortfall replaces buy with a contact CTA; mounted mail-order is never "free shipping".
- While a platform is `measured:false`, stance is words, never a decimal. Use `Fitment.pokeText(g, measured)` and `Fitment.stance(g)` from `fitment.js`; never reimplement them.
- Only sizes from `brands.js` and tire sizes from `tires.js` are ever offered. No free-form sizes, no interpolated offsets (`Fitment.offsetFor` returns null when unknown; the UI says so).
- Copy: no em dashes anywhere, no "it's not X, it's Y", no colon-label fragments. Run `python3 ~/.claude/skills/proofpilot-copywriting/scripts/slopcheck.py --channel web <file>` on any file with customer-facing strings.
- Units: scene is metres. `IN = 0.0254`. Axle is the X axis, +X is the driver's side (the truck's left: with +Y up and +Z forward, +X points left), +Y up, +Z forward.
- Playwright uses bundled Chromium only. Never `channel: "chrome"`. Never launch Google Chrome.
- Asset budgets: truck GLB <= 5 MB and <= 200,000 triangles; wheel GLB <= 0.6 MB. `tools/check-3d-budgets.js` enforces it.
- The stand-in truck is CC0 and never ships as "the" truck: its license and source go in `configurator/public/models/LICENSES.md` and a `LAUNCH-CHECKLIST.md` entry.
- Do not commit. Matthew commits when he asks. Leave the working tree clean of stray files (scratch goes in the session scratchpad).
- Existing tests keep passing: `node tools/test-fitment.js`, `node tools/test-pages.js`, `node tools/test-builders.js`.

## Review Focus

1. A catalog size with no width (`"20"`, `widthKnown:false`) must not be offered as a buildable size; the wheel step lists only `widthKnown` sizes. Test in Task 2.
2. A diameter with no tire we sell at that rim (e.g. 30 inch) must show "No tire we sell in that size" and keep the flow usable, not crash or offer nothing silently. Test in Task 7.
3. A share URL with an unknown platform, wheel or finish must reset to step 1 with the known parts kept, never throw. Test in Task 7.
4. No WebGL (or context lost on iOS memory pressure) must show the poster image and the steps still work to a quote. Test in Task 6.
5. A tow weight above the assembly load rating must hide the quote button and show the contact CTA, with the words "fitment verified before we build it" and never "guaranteed". Test in Task 7.

---

### Task 1: Scaffold the configurator app

**Files:**
- Create: `configurator/package.json`, `configurator/vite.config.ts`, `configurator/tsconfig.json`, `configurator/index.html`, `configurator/src/main.tsx`, `configurator/src/App.tsx`, `configurator/vitest.config.ts`, `configurator/playwright.config.ts`, `configurator/tests/smoke.test.ts`, `configurator/e2e/smoke.spec.ts`, `configurator/.gitignore`
- Modify: `.gitignore` (add `configurator/node_modules/`, `configurator/test-results/`, `configurator/playwright-report/`)

**Interfaces:**
- Produces: `npm run build` in `configurator/` writes `visualize/index.html` and `visualize/assets/*` at the repo root. `npm test` runs vitest. `npm run e2e` runs Playwright against `vite preview`.

- [x] **Step 1: Write the failing smoke test**

```ts
// configurator/tests/smoke.test.ts
import { describe, it, expect } from "vitest";
import { APP_NAME } from "../src/App";
describe("app", () => {
  it("names itself", () => { expect(APP_NAME).toBe("DROOOLY Visualize"); });
});
```

- [x] **Step 2: Create the project**

```bash
cd configurator
npm init -y
npm i react@19 react-dom@19 three @react-three/fiber@9 @react-three/drei@10
npm i -D vite@6 typescript @types/react @types/react-dom @types/three @vitejs/plugin-react vitest jsdom @playwright/test @react-three/test-renderer
npx playwright install chromium
```

`configurator/package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173",
    "test": "vitest run",
    "e2e": "playwright test"
  }
}
```

`configurator/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  base: "/visualize/",
  build: { outDir: path.resolve(__dirname, "../visualize"), emptyOutDir: true },
  resolve: { alias: { "@site": path.resolve(__dirname, "..") } },
});
```

`configurator/src/App.tsx`:

```tsx
export const APP_NAME = "DROOOLY Visualize";
export default function App() { return <main id="app"><h1>{APP_NAME}</h1></main>; }
```

`configurator/src/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(<App />);
```

`configurator/index.html`: doctype, `<meta name="viewport" content="width=device-width,initial-scale=1">`, Google Fonts `Michroma` and `Inter:wght@400;500;600;700`, `<link rel="stylesheet" href="/styles.css">` is NOT used (the site CSS is copied in Task 7), `<div id="root"></div>`, `<script type="module" src="/src/main.tsx"></script>`.

`configurator/vitest.config.ts`: `environment: "jsdom"`, include `tests/**/*.test.ts?(x)`.

`configurator/playwright.config.ts`: `webServer: { command: "npm run preview", port: 4173, reuseExistingServer: true }`, `use: { baseURL: "http://localhost:4173/visualize/" }`, projects `desktop` (viewport 1280x800) and `mobile` (viewport 390x844, isMobile true, hasTouch true), both `browserName: "chromium"`.

- [x] **Step 3: Run the unit test**

Run: `cd configurator && npm test`
Expected: PASS (1 test).

- [x] **Step 4: Build and verify output location**

Run: `cd configurator && npm run build && ls ../visualize/index.html`
Expected: file exists; `visualize/index.html` references `/visualize/assets/...`.

- [x] **Step 5: Playwright smoke**

```ts
// configurator/e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";
test("loads", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("h1")).toHaveText("DROOOLY Visualize");
});
```

Run: `cd configurator && npm run build && npm run e2e`
Expected: PASS on desktop and mobile projects.

---

### Task 2: Export the catalog to JSON

**Files:**
- Create: `tools/export-catalog.js`, `configurator/allowed-brands.json`, `tools/test-export-catalog.js`, `configurator/src/data/catalog.json` (generated), `configurator/src/data/catalog.ts` (typed loader), `configurator/tests/catalog.test.ts`
- Modify: `vehicles.js` (add `model` block to `f250` and `f150`), `configurator/package.json` (script `"catalog": "node ../tools/export-catalog.js"`, and `prebuild` runs it)

**Interfaces:**
- Produces `Catalog` type:

```ts
export interface Vehicle { id: string; make: string; models: string[]; years: [number, number]; config: "srw"|"drw"; hd: boolean; bolt: string; stockOffsetMm: number; stockWidthIn?: number; fenderRadiusIn: number; faceToFenderIn: number; measured: boolean; model?: { file: string; wheelbaseIn: number; trackIn: number; stockTireOdIn: number; stockWheelDiaIn: number; cab: string; }; }
export interface WheelModel { model: string; configs: string[]; sizes: string[]; finishes: string[]; img?: string; }
export interface Brand { slug: string; name: string; kind: string; bolts: string[]; pricing?: string; models: WheelModel[]; }
export interface TireModel { model: string; tread: string; sizes: string[]; img?: string; priceFrom?: number; }
export interface TireBrand { slug: string; name: string; models: TireModel[]; }
export interface Catalog { generated: string; vehicles: Vehicle[]; paints: {name: string; hex: string}[]; brands: Brand[]; tires: TireBrand[]; offsets: any; f450: any; finishes: any; }
export function loadCatalog(): Catalog;
```

- [x] **Step 1: Add `model` blocks to `vehicles.js`**

In the `f250` entry add after `measured:false,`:

```js
    model:{ file:"models/f250-crew.glb", wheelbaseIn:159.8, trackIn:68.3, stockTireOdIn:33.2, stockWheelDiaIn:18, cab:"crew" },
```

In the `f150` entry add:

```js
    model:{ file:"models/f150-crew.glb", wheelbaseIn:145.4, trackIn:67.6, stockTireOdIn:31.8, stockWheelDiaIn:18, cab:"crew" },
```

Source note for each (as a comment above the line): "Published OEM spec sheet figures for crew cab, 6.75 ft bed (F-250) and crew cab, 5.5 ft bed (F-150); estimates until a tape confirms them." Run `node tools/test-fitment.js` and `node tools/test-pages.js`; both must still pass.

- [x] **Step 2: Write the failing node test**

```js
// tools/test-export-catalog.js
#!/usr/bin/env node
const path = require("path"), fs = require("fs");
const F = require(path.resolve(__dirname, "..", "fitment.js"));
const out = path.resolve(__dirname, "..", "configurator", "src", "data", "catalog.json");
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log("  FAIL " + name + (extra ? "\n       " + extra : "")); } }
const c = JSON.parse(fs.readFileSync(out, "utf8"));
ok("has vehicles", c.vehicles.length >= 2);
ok("f250 has model block", !!c.vehicles.find(v => v.id === "f250").model);
ok("only allowed brands", c.brands.every(b => ["jtx"].includes(b.slug)), c.brands.map(b => b.slug).join(","));
let bad = [];
c.brands.forEach(b => b.models.forEach(m => m.sizes.forEach(s => { const p = F.parseSize(s); if (!p || !p.widthKnown) bad.push(b.slug + " " + m.model + " " + s); })));
ok("every wheel size has a known width", bad.length === 0, bad.slice(0, 5).join("; "));
let badT = [];
c.tires.forEach(b => b.models.forEach(m => m.sizes.forEach(s => { if (!F.parseTireSize(s)) badT.push(b.slug + " " + s); })));
ok("every tire size parses", badT.length === 0, badT.slice(0, 5).join("; "));
ok("paints", c.paints.length === 10);
ok("offsets roles", !!c.offsets.roles.duallyRear);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
```

Run: `node tools/test-export-catalog.js`
Expected: FAIL (catalog.json missing).

- [x] **Step 3: Write the exporter**

```js
// tools/export-catalog.js
#!/usr/bin/env node
/* Loads the site's window.* data files in a sandbox and writes one JSON for
   the configurator. No product knowledge lives in the configurator. */
const vm = require("vm"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
function load(file) {
  const ctx = { window: {}, module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  return ctx.window;
}
const F = require(path.join(ROOT, "fitment.js"));
const allowed = JSON.parse(fs.readFileSync(path.join(ROOT, "configurator", "allowed-brands.json"), "utf8"));
const v = load("vehicles.js"), b = load("brands.js"), t = load("tires.js"), fin = load("finishes.js");
const json = f => JSON.parse(fs.readFileSync(path.join(ROOT, "data", "specs", f), "utf8"));
const brands = b.BRANDS.filter(x => allowed.includes(x.slug)).map(x => ({
  slug: x.slug, name: x.name, kind: x.kind, bolts: x.bolts, pricing: x.pricing || null,
  models: x.models.map(m => ({ model: m.model, configs: m.configs, img: m.img || null,
    finishes: m.finishes || [],
    sizes: m.sizes.filter(s => { const p = F.parseSize(s); return p && p.widthKnown; }) }))
    .filter(m => m.sizes.length)
}));
const tires = t.TIRES.map(x => ({ slug: x.slug, name: x.name,
  models: x.models.map(m => ({ model: m.model, tread: m.tread, img: m.img || null, priceFrom: m.priceFrom ?? null, sizes: m.sizes })) }));
const out = { generated: new Date().toISOString().slice(0, 10), vehicles: v.VEHICLES, paints: v.VEHICLE_PAINT,
  brands, tires, offsets: json("offsets.json"), f450: json("f450-fitment.json"), finishes: fin.WHEEL_FINISHES };
const dest = path.join(ROOT, "configurator", "src", "data", "catalog.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log("catalog:", out.vehicles.length, "vehicles,", brands.length, "brands,", brands.reduce((n, x) => n + x.models.length, 0), "wheel models,", tires.length, "tire brands");
```

`configurator/allowed-brands.json`: `["jtx"]`.

- [x] **Step 4: Run exporter and test**

Run: `node tools/export-catalog.js && node tools/test-export-catalog.js`
Expected: all pass. Note the wheel model count in the output.

- [x] **Step 5: Typed loader and vitest**

```ts
// configurator/src/data/catalog.ts
import raw from "./catalog.json";
export type { Catalog, Vehicle, Brand, WheelModel, TireBrand, TireModel } from "./types";
import type { Catalog } from "./types";
export function loadCatalog(): Catalog { return raw as unknown as Catalog; }
```

Put the interfaces from this task's Interfaces block in `configurator/src/data/types.ts`.

```ts
// configurator/tests/catalog.test.ts
import { describe, it, expect } from "vitest";
import { loadCatalog } from "../src/data/catalog";
describe("catalog", () => {
  const c = loadCatalog();
  it("has f250 and f150 with model blocks", () => {
    for (const id of ["f250", "f150"]) expect(c.vehicles.find(v => v.id === id)?.model?.file).toMatch(/\.glb$/);
  });
  it("only allowed brands", () => { expect(c.brands.map(b => b.slug)).toEqual(["jtx"]); });
});
```

Run: `cd configurator && npm test`
Expected: PASS.

---

### Task 3: fitment3d, the placement layer over fitment.js

**Files:**
- Create: `configurator/src/fitment/fitment3d.ts`, `configurator/src/fitment/site.d.ts`, `configurator/tests/fitment3d.test.ts`
- Modify: `configurator/vite.config.ts` (alias `@site` already exists; add `optimizeDeps.include: []` only if needed)

**Interfaces:**
- Consumes: `fitment.js` API via `import Fitment from "@site/fitment.js"` (CommonJS; Vite handles it; declare types in `site.d.ts`), `Vehicle` from Task 2.
- Produces:

```ts
export const IN = 0.0254;
export interface FitInput { vehicle: Vehicle; liftIn: 0 | 2.5 | 4 | 6; leveled?: boolean; wheel: { diaIn: number; widthIn: number; offsetMm: number | null }; tire: { od: number; section: number; rim: number }; config: "single" | "dually" | "super single"; towWeightLb?: number; loadRatingLb?: number | null; }
export interface Corner { name: "FL"|"FR"|"RL"|"RR"|"RL_inner"|"RR_inner"; x: number; y: number; z: number; mirror: boolean; }
export interface FitResult { g: ReturnType<typeof Fitment.geometry>; stance: { key: string; label: string }; pokeText: string; offsetKnown: boolean; bodyLiftM: number; wheelRadiusM: number; tireRadiusM: number; tireWidthM: number; wheelWidthM: number; corners: Corner[]; loadOk: boolean | null; }
export function fit(i: FitInput): FitResult;
```

- [x] **Step 1: Write the failing tests**

```ts
// configurator/tests/fitment3d.test.ts
import { describe, it, expect } from "vitest";
import { fit, IN } from "../src/fitment/fitment3d";
import { loadCatalog } from "../src/data/catalog";
const c = loadCatalog();
const f250 = c.vehicles.find(v => v.id === "f250")!;
const f150 = c.vehicles.find(v => v.id === "f150")!;
describe("fit", () => {
  it("places four corners on the track for a single-wheel truck", () => {
    const r = fit({ vehicle: f250, liftIn: 0, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" });
    expect(r.corners.map(k => k.name)).toEqual(["FL", "FR", "RL", "RR"]);
    const fr = r.corners.find(k => k.name === "FR")!;
    expect(fr.x).toBeCloseTo((68.3 / 2) * IN + (10 / 2 - (-18) / 25.4) * IN - (10 / 2) * IN, 3); // hub face at half track, wheel centre shifted by offset
    expect(fr.z).toBeCloseTo(0, 3);
    expect(r.corners.find(k => k.name === "RR")!.z).toBeCloseTo(-159.8 * IN, 3);
  });
  it("raises the body by the lift, wheels stay on the ground", () => {
    const a = fit({ vehicle: f250, liftIn: 0, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" });
    const b = fit({ vehicle: f250, liftIn: 6, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" });
    expect(b.bodyLiftM - a.bodyLiftM).toBeCloseTo(6 * IN, 4);
    expect(a.corners[0].y).toBeCloseTo(35 / 2 * IN, 4);
    expect(b.corners[0].y).toBeCloseTo(35 / 2 * IN, 4);
  });
  it("uses words, not decimals, while measured is false", () => {
    const r = fit({ vehicle: f150, liftIn: 0, wheel: { diaIn: 22, widthIn: 12, offsetMm: -44 }, tire: { od: 33, section: 12.5, rim: 22 }, config: "single" });
    expect(r.pokeText).not.toMatch(/\d\.\d"/);
    expect(r.stance.label).toBeTruthy();
    expect(r.stance.label.toLowerCase()).not.toMatch(/fit|rub|guarantee/);
  });
  it("marks offset unknown without inventing one", () => {
    const r = fit({ vehicle: f250, liftIn: 0, wheel: { diaIn: 24, widthIn: 14, offsetMm: null }, tire: { od: 37, section: 13.5, rim: 24 }, config: "single" });
    expect(r.offsetKnown).toBe(false);
    expect(r.corners.length).toBe(4);
  });
  it("dually adds inner rears", () => {
    const f450 = c.vehicles.find(v => v.id === "f450")!;
    const r = fit({ vehicle: f450, liftIn: 0, wheel: { diaIn: 24, widthIn: 8.25, offsetMm: 120 }, tire: { od: 37, section: 13.5, rim: 24 }, config: "dually" });
    expect(r.corners.map(k => k.name)).toContain("RL_inner");
    expect(r.corners.find(k => k.name === "RR_inner")!.x).toBeLessThan(r.corners.find(k => k.name === "RR")!.x);
  });
  it("load rating hard stop", () => {
    const r = fit({ vehicle: f250, liftIn: 0, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single", towWeightLb: 14000, loadRatingLb: 3195 });
    expect(r.loadOk).toBe(false);
  });
});
```

Run: `cd configurator && npm test`
Expected: FAIL (module missing).

- [x] **Step 2: Implement**

```ts
// configurator/src/fitment/site.d.ts
declare module "@site/fitment.js" {
  const Fitment: {
    MM_PER_IN: number;
    parseSize(s: string): { d: number; w: number | null; widthKnown: boolean } | null;
    parseTireSize(s: string): { od: number; section: number; rim: number } | null;
    offsetFor(offsets: any, role: string, dia: number, width: number): { min?: number; max?: number; typical?: number } | null;
    offsetRole(width: number, seriesKey: string): string;
    tiresFor(tires: any, diaIn: number, mode?: string): { size: string; od: number; section: number; rim: number; fitments: string[] }[];
    geometry(cfg: any): { offsetIn: number; outerFromFace: number; innerFromFace: number; backspacing: number; poke: number; sidewall: number; fenderRadius: number; archGap: number; isDually: boolean };
    stance(g: any): { key: string; label: string };
    pokeText(g: any, measured: boolean): string;
  };
  export default Fitment;
}
```

```ts
// configurator/src/fitment/fitment3d.ts
import Fitment from "@site/fitment.js";
import type { Vehicle } from "../data/types";
export const IN = 0.0254;
export interface FitInput { vehicle: Vehicle; liftIn: 0 | 2.5 | 4 | 6; leveled?: boolean; wheel: { diaIn: number; widthIn: number; offsetMm: number | null }; tire: { od: number; section: number; rim: number }; config: "single" | "dually" | "super single"; towWeightLb?: number; loadRatingLb?: number | null; }
export interface Corner { name: "FL"|"FR"|"RL"|"RR"|"RL_inner"|"RR_inner"; x: number; y: number; z: number; mirror: boolean; }
export interface FitResult { g: ReturnType<typeof Fitment.geometry>; stance: { key: string; label: string }; pokeText: string; offsetKnown: boolean; bodyLiftM: number; wheelRadiusM: number; tireRadiusM: number; tireWidthM: number; wheelWidthM: number; corners: Corner[]; loadOk: boolean | null; }

/* Offset null means "we do not know"; the render uses the platform's stock
   offset so the wheel still sits in the arch, and offsetKnown:false tells the
   UI to say so. It never prints an invented number. */
export function fit(i: FitInput): FitResult {
  const v = i.vehicle;
  const offsetKnown = typeof i.wheel.offsetMm === "number";
  const offsetMm = offsetKnown ? (i.wheel.offsetMm as number) : v.stockOffsetMm;
  const lift = i.liftIn + (i.leveled ? 0 : 0);
  const g = Fitment.geometry({ widthIn: i.wheel.widthIn, offsetMm, tireOdIn: i.tire.od, wheelDiaIn: i.wheel.diaIn, lift, vehicle: v });
  const track = (v.model?.trackIn ?? 68) * IN, wb = (v.model?.wheelbaseIn ?? 150) * IN;
  const tireR = (i.tire.od / 2) * IN;
  // wheel centre sits (width/2 - offset) outboard of the hub face: outerFromFace - width/2
  const centreFromFace = (g.outerFromFace - i.wheel.widthIn / 2) * IN;
  const halfTrack = track / 2;
  const corner = (name: Corner["name"], side: 1 | -1, z: number, inboard = 0): Corner =>
    ({ name, x: side * (halfTrack + centreFromFace - inboard), y: tireR, z, mirror: side < 0 });
  const corners: Corner[] = [corner("FL", -1, 0), corner("FR", 1, 0), corner("RL", -1, -wb), corner("RR", 1, -wb)];
  if (i.config === "dually") {
    const pair = (i.tire.section + 1) * IN; // inner wheel sits one section width plus a lip inboard
    corners.push(corner("RL_inner", -1, -wb, pair), corner("RR_inner", 1, -wb, pair));
  }
  const loadOk = (typeof i.towWeightLb === "number" && typeof i.loadRatingLb === "number") ? i.loadRatingLb * 4 >= i.towWeightLb : null;
  return { g, stance: Fitment.stance(g), pokeText: Fitment.pokeText(g, !!v.measured), offsetKnown,
    bodyLiftM: lift * IN + (tireR - (v.model?.stockTireOdIn ?? i.tire.od) / 2 * IN),
    wheelRadiusM: (i.wheel.diaIn / 2) * IN, tireRadiusM: tireR, tireWidthM: i.tire.section * IN, wheelWidthM: i.wheel.widthIn * IN, corners, loadOk };
}
```

Note on `loadOk`: the slice compares four times the per-wheel rating to the disclosed tow weight. That is a simplification stated in the summary copy ("rated against your trailer weight") and in `LAUNCH-CHECKLIST.md`. Rule 5 only needs the hard stop to exist and to replace the buy button.

- [x] **Step 3: Run tests**

Run: `cd configurator && npm test`
Expected: PASS. If the FR x assertion fails by sign, the test encodes the convention; fix the code, not the test.

---

### Task 4: Stand-in truck and the model pipeline

**Files:**
- Create: `tools/3d/prepare-truck.py` (Blender), `tools/3d/optimize-glb.sh`, `tools/3d/truck-dims.json`, `tools/check-3d-budgets.js`, `tools/test-3d-models.js`, `configurator/public/models/f250-crew.glb`, `configurator/public/models/f150-crew.glb`, `configurator/public/models/LICENSES.md`, `configurator/public/models/.source/` (downloaded CC0 original, gitignored)
- Modify: `.gitignore` (add `configurator/public/models/.source/`), `LAUNCH-CHECKLIST.md` (new item: stand-in truck meshes are CC0 placeholders, commissioned unbadged bodies replace them before launch; trade dress lawyer read before launch)

**Interfaces:**
- Produces GLBs whose scene contains nodes named exactly `body`, `glass`, `chassis`, `bed`, `hub_FL`, `hub_FR`, `hub_RL`, `hub_RR` (empties at the axle centres, metres, wheelbase and track from `truck-dims.json`), no wheel meshes, origin at the ground under the front axle centre, +Z forward.
- `node tools/check-3d-budgets.js <glb...>` exits 1 when a truck exceeds 5 MB or 200k tris, or a wheel exceeds 0.6 MB.

- [x] **Step 1: Find and record the stand-in**

Search Poly Pizza (`https://poly.pizza`) and Kenney (`https://kenney.nl/assets/car-kit`) for a CC0 pickup truck glTF/GLB with separate wheel meshes. Download to `configurator/public/models/.source/`. Write `LICENSES.md` with: file, author, URL, license (must be CC0 1.0), date, and the sentence "Stand-in for development. Never ships as a named truck."

- [x] **Step 2: Write the failing node test**

```js
// tools/test-3d-models.js
#!/usr/bin/env node
/* Reads the JSON chunk of each GLB (no deps) and checks the node contract. */
const fs = require("fs"), path = require("path");
const dir = path.resolve(__dirname, "..", "configurator", "public", "models");
const want = ["body", "glass", "chassis", "bed", "hub_FL", "hub_FR", "hub_RL", "hub_RR"];
let fail = 0;
function nodesOf(file) {
  const b = fs.readFileSync(file); const len = b.readUInt32LE(12);
  return JSON.parse(b.slice(20, 20 + len).toString("utf8")).nodes.map(n => n.name || "");
}
for (const f of ["f250-crew.glb", "f150-crew.glb"]) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) { console.log("  FAIL missing " + f); fail++; continue; }
  const names = nodesOf(p);
  for (const w of want) if (!names.includes(w)) { console.log(`  FAIL ${f} lacks node ${w}`); fail++; }
  if (names.some(n => /wheel|tire|tyre/i.test(n))) { console.log(`  FAIL ${f} still carries a wheel node`); fail++; }
}
console.log(fail ? `${fail} failed` : "3d models ok"); process.exit(fail ? 1 : 0);
```

Run: `node tools/test-3d-models.js`
Expected: FAIL (missing files).

- [x] **Step 3: Dims file and Blender script**

```json
// tools/3d/truck-dims.json
{ "f250-crew": { "source": ".source/<file>.glb", "wheelbaseIn": 159.8, "trackIn": 68.3, "stockTireOdIn": 33.2 },
  "f150-crew": { "source": ".source/<file>.glb", "wheelbaseIn": 145.4, "trackIn": 67.6, "stockTireOdIn": 31.8 } }
```

```python
# tools/3d/prepare-truck.py
# blender -b -P tools/3d/prepare-truck.py -- <key> <out.glb>
import bpy, json, sys, os, re
from mathutils import Vector
IN = 0.0254
argv = sys.argv[sys.argv.index("--") + 1:]
key, out = argv[0], argv[1]
root = os.path.dirname(os.path.abspath(__file__))
dims = json.load(open(os.path.join(root, "truck-dims.json")))[key]
models = os.path.join(root, "..", "..", "configurator", "public", "models")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(models, dims["source"]))
# 1. drop wheels and tires
for o in list(bpy.data.objects):
    if re.search(r"wheel|tire|tyre", o.name, re.I): bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
# 2. measure the source's axle span along its longest horizontal axis and scale to the real wheelbase
bbox = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
length = max(v.y for v in bbox) - min(v.y for v in bbox)
scale = (dims["wheelbaseIn"] * IN * 1.35) / length   # a crew cab pickup is ~1.35 wheelbases long; stand-in only
for o in meshes: o.scale *= scale
bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.transform_apply(scale=True)
# 3. name the contract nodes: biggest mesh is body, anything with glass/window in the name is glass, rest joins chassis
meshes.sort(key=lambda o: -sum(o.dimensions))
meshes[0].name = "body"
for o in meshes[1:]:
    o.name = "glass" if re.search(r"glass|window", o.name, re.I) else "chassis"
if not any(o.name == "glass" for o in bpy.data.objects):
    g = bpy.data.objects.new("glass", bpy.data.meshes.new("glass")); bpy.context.scene.collection.objects.link(g)
bed = bpy.data.objects.new("bed", None); bpy.context.scene.collection.objects.link(bed)
# 4. hub empties: origin is the ground under the front axle, +Y forward in Blender (exporter converts to +Z forward / +Y up in glTF)
half = dims["trackIn"] / 2 * IN; r = dims["stockTireOdIn"] / 2 * IN; wb = dims["wheelbaseIn"] * IN
for name, x, y in (("hub_FL", -half, 0), ("hub_FR", half, 0), ("hub_RL", -half, -wb), ("hub_RR", half, -wb)):
    e = bpy.data.objects.new(name, None); e.location = (x, y, r); bpy.context.scene.collection.objects.link(e)
# 5. drop the body so the stand-in's underside sits at stock tire radius + a little clearance
zmin = min(v.z for v in [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box])
for o in meshes: o.location.z += (r * 0.55) - zmin
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_yup=True, export_apply=True)
```

```bash
# tools/3d/optimize-glb.sh  <in.glb> <out.glb>
set -euo pipefail
npx --yes @gltf-transform/cli optimize "$1" "$2" --compress meshopt --texture-compress webp --simplify-error 0.001
```

- [x] **Step 4: Budgets checker**

```js
// tools/check-3d-budgets.js  <glb...>
#!/usr/bin/env node
const fs = require("fs"), path = require("path");
const LIMITS = { truck: { bytes: 5 * 1024 * 1024, tris: 200000 }, wheel: { bytes: 0.6 * 1024 * 1024, tris: 60000 } };
let fail = 0;
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f), len = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + len).toString("utf8"));
  const kind = /wheel/i.test(path.basename(f)) ? "wheel" : "truck", lim = LIMITS[kind];
  let tris = 0;
  for (const m of j.meshes || []) for (const p of m.primitives || []) {
    const acc = j.accessors[p.indices ?? p.attributes.POSITION]; tris += (p.indices !== undefined ? acc.count / 3 : acc.count / 3);
  }
  const over = b.length > lim.bytes || tris > lim.tris;
  console.log(`${over ? "FAIL" : "ok  "} ${path.basename(f)} ${(b.length / 1048576).toFixed(2)} MB, ${Math.round(tris)} tris (${kind} limit ${(lim.bytes / 1048576).toFixed(1)} MB / ${lim.tris})`);
  if (over) fail++;
}
process.exit(fail ? 1 : 0);
```

- [x] **Step 5: Produce both trucks and run checks**

```bash
for k in f250-crew f150-crew; do
  /opt/homebrew/bin/blender -b -P tools/3d/prepare-truck.py -- $k /tmp/$k-raw.glb
  bash tools/3d/optimize-glb.sh /tmp/$k-raw.glb configurator/public/models/$k.glb
done
node tools/test-3d-models.js && node tools/check-3d-budgets.js configurator/public/models/*.glb
```

Expected: both ok. If `--compress meshopt` output fails to load later in three, re-run without `--compress` (the stand-in is small) and note it in `LICENSES.md`.

---

### Task 5: Parametric wheel and tire geometry, finish materials

**Files:**
- Create: `configurator/src/geometry/wheel.ts`, `configurator/src/geometry/tire.ts`, `configurator/src/materials/finishes.ts`, `configurator/src/data/jtx-programs.ts`, `configurator/tests/geometry.test.ts`

**Interfaces:**
- Produces:

```ts
export interface WheelStyle { spokes: number; spokeWidth: number /*0..1 of pitch*/; dish: number /*0..1, 0 flat face*/; split: boolean; }
export function makeWheel(diaIn: number, widthIn: number, style: WheelStyle): THREE.Group; // children: "barrel","face","lip"; centred on origin, axle along +X, face at +X (outboard)
export function makeTire(od: number, section: number, rim: number, tread: "AT"|"MT"): THREE.Mesh; // torus-like, axle along +X
export type FinishCode = "polished"|"brushed"|"black"|"black-milled";
export function finishMaterial(code: FinishCode): THREE.MeshPhysicalMaterial;
export const JTX_PROGRAMS: { model: string; style: WheelStyle }[]; // Ace, Alpha, 404, Ballistic, Capo
```

- [x] **Step 1: Failing tests**

```ts
// configurator/tests/geometry.test.ts
import { describe, it, expect } from "vitest";
import { Box3 } from "three";
import { makeWheel } from "../src/geometry/wheel";
import { makeTire } from "../src/geometry/tire";
import { finishMaterial } from "../src/materials/finishes";
import { JTX_PROGRAMS } from "../src/data/jtx-programs";
const IN = 0.0254;
describe("geometry", () => {
  it("wheel bounding box matches diameter and width", () => {
    const g = makeWheel(24, 14, { spokes: 6, spokeWidth: 0.5, dish: 0.3, split: false });
    const b = new Box3().setFromObject(g);
    expect(b.max.y - b.min.y).toBeCloseTo(24 * IN, 2);
    expect(b.max.x - b.min.x).toBeCloseTo(14 * IN, 2);
  });
  it("tire bounding box matches od and section", () => {
    const t = makeTire(37, 13.5, 24, "MT");
    const b = new Box3().setFromObject(t);
    expect(b.max.y - b.min.y).toBeCloseTo(37 * IN, 2);
    expect(b.max.x - b.min.x).toBeCloseTo(13.5 * IN, 2);
  });
  it("finishes differ in roughness", () => {
    expect(finishMaterial("polished").roughness).toBeLessThan(finishMaterial("brushed").roughness);
    expect(finishMaterial("black").color.getHexString()).not.toBe(finishMaterial("polished").color.getHexString());
  });
  it("five JTX programs with distinct spoke counts or styles", () => {
    expect(JTX_PROGRAMS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(JTX_PROGRAMS.map(p => JSON.stringify(p.style))).size).toBe(JTX_PROGRAMS.length);
  });
});
```

- [x] **Step 2: Implement**

`wheel.ts`: barrel is a `LatheGeometry` of a profile (inner lip, barrel wall, outer lip) revolved around X (build around Y with Lathe then rotate the group so the axle is X). Face is a `ShapeGeometry` disc with N spoke windows cut out (`Shape.holes`) extruded via `ExtrudeGeometry` depth 0.6 inch, offset inboard by `dish * widthIn * 0.6` inches. Lip is a thin torus at the outer edge. Names on children: `barrel`, `face`, `lip`. Each child's `material` is set later by the scene; give them a default `MeshStandardMaterial`.

`tire.ts`: profile of half the tire cross-section (bead at `rim/2`, sidewall curve out to `section/2` at the tread shoulder, flat tread) revolved with `LatheGeometry` (64 segments), rotated so the axle is X. Material `MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 })`; for `"MT"` set `userData.tread = "MT"` and give the lathe 96 segments (normal map arrives in Task 6).

`finishes.ts`:

```ts
import { MeshPhysicalMaterial, Color } from "three";
export type FinishCode = "polished"|"brushed"|"black"|"black-milled";
const DEF: Record<FinishCode, { color: number; metalness: number; roughness: number; clearcoat: number; anisotropy?: number }> = {
  polished: { color: 0xe6e9ec, metalness: 1, roughness: 0.08, clearcoat: 0.6 },
  brushed: { color: 0xc9ced3, metalness: 1, roughness: 0.38, clearcoat: 0, anisotropy: 0.8 },
  black: { color: 0x121316, metalness: 0.7, roughness: 0.55, clearcoat: 0.3 },
  "black-milled": { color: 0x1b1d20, metalness: 0.85, roughness: 0.35, clearcoat: 0.4 },
};
export function finishMaterial(code: FinishCode) {
  const d = DEF[code]; const m = new MeshPhysicalMaterial({ color: new Color(d.color), metalness: d.metalness, roughness: d.roughness, clearcoat: d.clearcoat });
  if (d.anisotropy) m.anisotropy = d.anisotropy;
  return m;
}
export function finishCode(name: string): FinishCode {
  const n = name.toLowerCase();
  if (n.includes("mill")) return "black-milled"; if (n.includes("black")) return "black"; if (n.includes("brush")) return "brushed"; return "polished";
}
```

`jtx-programs.ts`: five entries chosen from `catalog.json` models that exist (Ace, Alpha, 404, Ballistic, Capo), each with a distinct `WheelStyle` chosen by looking at `assets/wheels/jtx/<model>.png` (count the spokes in the image; record the count in a comment).

- [x] **Step 3: Run tests**

Run: `cd configurator && npm test`
Expected: PASS.

---

### Task 6: Scene, materials, lighting, cameras

**Files:**
- Create: `configurator/src/scene/Stage.tsx`, `configurator/src/scene/Truck.tsx`, `configurator/src/scene/WheelSet.tsx`, `configurator/src/scene/cameras.ts`, `configurator/src/scene/paint.ts`, `configurator/src/scene/Poster.tsx`, `configurator/public/hdri/studio.hdr` (Poly Haven CC0 `studio_small_09`, 1K downsampled to 512x256 to fit the 1 MB budget; recorded in `configurator/public/hdri/LICENSES.md`), `configurator/public/poster/f250.jpg`, `configurator/public/poster/f150.jpg` (rendered from the scene with Playwright at the end of this task), `configurator/tests/scene.test.tsx`, `configurator/e2e/scene.spec.ts`, `tools/3d/render-posters.mjs`

**Interfaces:**
- Consumes: `fit()` from Task 3, `makeWheel`, `makeTire`, `finishMaterial` from Task 5, `Vehicle.model.file` from Task 2.
- Produces:

```tsx
export type CameraPreset = "hero"|"side"|"rear"|"wheel";
export const PRESETS: Record<CameraPreset, { position: [number,number,number]; target: [number,number,number] }>;
export function Stage(props: { children: React.ReactNode; preset: CameraPreset; frame?: Box3 | null; shadowKey?: string; onContextLost?: () => void }): JSX.Element; // Canvas + Environment + ContactShadows + CameraControls, dpr [1,2], gl.antialias
export function Truck(props: { vehicle: Vehicle; paintHex: string; bodyLiftM: number; rakeDeg?: number; onBounds?: (b: Box3) => void }): JSX.Element; // useGLTF(vehicle.model.file) clone, body material = paintMaterial(hex), glass transmission, moves body/glass/chassis up by bodyLiftM, tips it rakeDeg nose-down about the rear axle
export const FACTORY_RAKE_DEG = 1.2;
export function rakeFor(leveled: boolean, liftIn: number): number; // leveled 0, otherwise the factory 1.2 degree nose-down rake (a full lift raises both ends and keeps it)
export function framedView(preset: CameraPreset, aspect: number, box: Box3 | null): { position; target }; // hero/side/rear keep the preset's direction, solve distance and aim so the whole truck fills and centres the frame at any aspect
export function WheelSet(props: { fit: FitResult; style: WheelStyle; finish: FinishCode; tread: "AT"|"MT" }): JSX.Element; // one wheel+tire group per corner, mirrored on the left
export function paintMaterial(hex: string): THREE.MeshPhysicalMaterial; // clearcoat 1, clearcoatRoughness 0.03, metalness 0.6, roughness 0.45, flake normal map (procedural 256px noise, tiled)
export function Poster(props: { vehicle: Vehicle }): JSX.Element; // <img> fallback
```

- [x] **Step 1: Failing render test**

```tsx
// configurator/tests/scene.test.tsx
import { describe, it, expect } from "vitest";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { WheelSet } from "../src/scene/WheelSet";
import { fit } from "../src/fitment/fitment3d";
import { loadCatalog } from "../src/data/catalog";
describe("WheelSet", () => {
  it("mounts four wheel groups for a single truck", async () => {
    const v = loadCatalog().vehicles.find(x => x.id === "f250")!;
    const f = fit({ vehicle: v, liftIn: 0, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" });
    const r = await ReactThreeTestRenderer.create(<WheelSet fit={f} style={{ spokes: 6, spokeWidth: 0.5, dish: 0.3, split: false }} finish="polished" tread="AT" />);
    expect(r.scene.findAllByProps({ name: "corner" }).length).toBe(4);
  });
});
```

- [x] **Step 2: Implement scene files**

`cameras.ts`: presets in metres relative to the truck origin (front axle on the ground). `hero: position [3.2, 1.1, 2.6], target [0, 0.9, -1.9]`; `side: [6.5, 0.9, -1.9] -> [0, 0.9, -1.9]`; `rear: [-3.2, 1.1, -6.2] -> [0, 0.9, -1.9]`; `wheel: [1.6, 0.5, 0.9] -> [0.95, 0.45, 0]`.

`Stage.tsx`: `<Canvas dpr={[1, 2]} gl={{ antialias: true, powerPreference: "high-performance" }} camera={{ fov: 32 }} onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", e => { e.preventDefault(); props.onContextLost?.(); })}>`, `<Environment files="/visualize/hdri/studio.hdr" />` (hidden background; scene background is the site's `--bg` colour), `<ContactShadows key={shadowKey} position={[0,-0.001,0]} opacity={0.6} scale={16} blur={2.2} far={2} resolution={1024} frames={4} />` (drei draws its blur quad at the world origin through the shadow camera, so the shadow must sit at x = z = 0 just under the ground or it renders empty; it re-renders only when `shadowKey` changes), `<CameraControls ref>` and a `useEffect` that calls `setLookAt(...framedView(preset, aspect, frame).position, ...framedView(...).target, true)` when `preset`, the viewport aspect or the truck bounds change (hero, side and rear keep the whole truck in frame and centred on a 390px phone and a desktop alike; the wheel close-up uses its preset as written), `smoothTime 0.6`, min/max polar angle so the camera never goes under the floor.

`Truck.tsx`: `useGLTF("/visualize/" + vehicle.model.file)`; the clone sits in a group lifted by `bodyLiftM` and rotated `rakeDeg` about X at the rear axle (`z = -wheelbase`, stock axle height). A leveling kit raises the front only, so leveled is body rake, not extra lift: `rakeFor(leveled, liftIn)` returns 0 when leveled and the factory 1.2 degree nose-down rake otherwise; `scene.clone()` once; traverse: node named `body` gets `paintMaterial(paintHex)`, `glass` gets `MeshPhysicalMaterial({ transmission: 0.9, roughness: 0.05, thickness: 0.01, color: 0x9fb3c8 })`, every other mesh gets `MeshStandardMaterial({ color: 0x202226, roughness: 0.8 })`. Group `position-y={bodyLiftM}` for body/glass/chassis/bed; hub empties are not moved (wheels are placed by `WheelSet` from `fit.corners`). Dispose cloned materials on unmount.

`WheelSet.tsx`: for each `corner` in `fit.corners`, a `<group name="corner" position={[x,y,z]} scale-x={mirror ? -1 : 1}>` containing `makeWheel(diaIn, widthIn, style)` with `finishMaterial(finish)` applied to `face` and `lip` and a darker variant to `barrel`, plus `makeTire(...)`. Memoise geometry by `(diaIn, widthIn, style)` and `(od, section, rim, tread)`; dispose on change. `useFrame` rotates each corner group around X slowly only while a `spin` prop is true (default false).

`paint.ts`: `paintMaterial(hex)` as in Interfaces; the flake normal map is a `DataTexture` of 256x256 random unit-ish normals, `RepeatWrapping`, `repeat 40`, created once and shared.

`Poster.tsx`: `<img src={"/visualize/poster/" + vehicle.id + ".jpg"} alt={vehicle.make + " " + vehicle.models[0] + " in the DROOOLY visualizer"} />` with the copy "3D is not available on this device. Your picks still get a quote." under it.

- [x] **Step 3: Run tests**

Run: `cd configurator && npm test`
Expected: PASS.

- [x] **Step 4: Playwright screenshot and the no-WebGL path**

```ts
// configurator/e2e/scene.spec.ts
import { test, expect } from "@playwright/test";
test("renders the stage", async ({ page }) => {
  await page.goto("./?v=f250&y=2024");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: process.env.SHOT_DIR + "/stage-" + test.info().project.name + ".png", fullPage: true });
});
test("falls back to the poster without WebGL", async ({ browser }) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t: any, ...a: any[]) { return /webgl/.test(String(t)) ? null : (g as any).call(this, t, ...a); }; });
  await page.goto("./?v=f250&y=2024");
  await expect(page.locator("img[src*='/poster/']")).toBeVisible();
});
```

Temporary wiring for this task: `App.tsx` reads `v` from the URL, renders `<Stage preset="hero"><Truck .../><WheelSet .../></Stage>` with a default JTX Ace 22x12 and a 35x12.50R22, and renders `<Poster>` when `onContextLost` fired or when `document.createElement("canvas").getContext("webgl2") === null`. Task 7 replaces this wiring. Look at both screenshots yourself (`SHOT_DIR` is the session scratchpad): the truck must sit on the shadow, wheels inside the arches at stock, no horizontal scroll at 390.

- [x] **Step 5: Posters**

Render `poster/f250.jpg` and `poster/f150.jpg` with a Playwright script at 1200x750 from the hero preset, JPEG quality 80, and keep them under 150 KB each. Script: `node tools/3d/render-posters.mjs` against `vite preview` (it loads `?v=<id>&poster=1` and fails over 150 KB).

---

### Task 7: The guided flow, summary, quote handoff, share

**Files:**
- Create: `configurator/src/flow/state.ts`, `configurator/src/flow/url.ts`, `configurator/src/flow/options.ts`, `configurator/src/ui/Steps.tsx`, `configurator/src/ui/TruckStep.tsx`, `configurator/src/ui/PaintStep.tsx`, `configurator/src/ui/StanceStep.tsx`, `configurator/src/ui/WheelStep.tsx`, `configurator/src/ui/Summary.tsx`, `configurator/src/ui/copy.ts`, `configurator/src/styles.css` (site tokens copied from `styles.css` `:root`, plus layout), `configurator/tests/flow.test.ts`, `configurator/e2e/flow.spec.ts`
- Modify: `configurator/src/App.tsx` (real wiring), `configurator/index.html` (title "Visualize your truck | DROOOLY Wheel & Tire", `noindex` until launch to match the site)

**Interfaces:**
- Produces:

```ts
export type Step = 1|2|3|4|5;
export interface Build { v: string | null; y: number | null; p: string | null; l: 0|2.5|4|6; lv: boolean; b: string | null; m: string | null; s: string | null; f: string | null; t: string | null; tow: number | null; }
export type Action = { type: "set"; patch: Partial<Build> } | { type: "reset" } | { type: "hydrate"; build: Build };
export function reduce(b: Build, a: Action): Build;           // setting an earlier field clears dependent later fields (v clears s,t; m clears s,f,t; s clears t)
export function firstIncomplete(b: Build): Step;              // the step the UI shows
export function encode(b: Build): string;                     // query string, omits nulls
export function decode(qs: string, cat: Catalog): Build;      // unknown values become null, never throws
export function wheelSizes(cat: Catalog, brand: string, model: string, config: string): string[];  // only widthKnown sizes for that config
export function tireChoices(cat: Catalog, diaIn: number, mode: "wide"|"dual"|"any"): ReturnType<typeof Fitment.tiresFor>;
export function offsetFor(cat: Catalog, widthIn: number, config: string, diaIn: number): number | null; // Fitment.offsetFor(...).typical or null
```

- [x] **Step 1: Failing tests**

```ts
// configurator/tests/flow.test.ts
import { describe, it, expect } from "vitest";
import { reduce, firstIncomplete, encode, decode, wheelSizes, tireChoices, offsetFor } from "../src/flow";
import { loadCatalog } from "../src/data/catalog";
const cat = loadCatalog();
const empty = { v: null, y: null, p: null, l: 0 as const, lv: false, b: null, m: null, s: null, f: null, t: null, tow: null };
describe("flow", () => {
  it("starts at step 1 and advances", () => {
    expect(firstIncomplete(empty)).toBe(1);
    const b1 = reduce(empty, { type: "set", patch: { v: "f250", y: 2024 } });
    expect(firstIncomplete(b1)).toBe(2);
    const b2 = reduce(b1, { type: "set", patch: { p: "agate-black" } });
    expect(firstIncomplete(b2)).toBe(3);
  });
  it("changing the wheel model clears size, finish and tire", () => {
    const b = { ...empty, v: "f250", y: 2024, p: "black", b: "jtx", m: "Ace", s: "22x12", f: "polished", t: "35x12.50R22" };
    const n = reduce(b, { type: "set", patch: { m: "Alpha" } });
    expect(n.s).toBeNull(); expect(n.f).toBeNull(); expect(n.t).toBeNull();
  });
  it("url round trips", () => {
    const b = { ...empty, v: "f250", y: 2024, p: "race-red", l: 6 as const, b: "jtx", m: "Ace", s: "24x14", f: "black-milled", t: "37x13.50R24" };
    expect(decode(encode(b), cat)).toEqual(b);
  });
  it("unknown url parts become null, never throw", () => {
    const d = decode("?v=nope&y=2024&b=jtx&m=Nope&s=99x99&f=gold&l=12", cat);
    expect(d.v).toBeNull(); expect(d.m).toBeNull(); expect(d.s).toBeNull(); expect(d.f).toBeNull(); expect(d.l).toBe(0);
    expect(firstIncomplete(d)).toBe(1);
  });
  it("only published, width-known sizes for the config", () => {
    const sizes = wheelSizes(cat, "jtx", "Ace", "single");
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every(s => /^\d+x\d+(\.\d+)?$/.test(s))).toBe(true);
  });
  it("tire choices at 30 inch are empty and that is a real answer", () => {
    expect(tireChoices(cat, 30, "any")).toEqual([]);
  });
  it("offset lookup returns null when unknown", () => {
    expect(offsetFor(cat, 14, "single", 24)).toBeTypeOf("number");
    expect(offsetFor(cat, 99, "single", 24)).toBeNull();
  });
});
```

- [x] **Step 2: Implement state, url, options**

`state.ts`: `reduce` applies the patch, then clears dependents: if `v` or `y` changed clear `s,t`; if `b` or `m` changed clear `s,f,t`; if `s` changed clear `t`. `firstIncomplete`: 1 if `!v||!y`, 2 if `!p`, 3 if `l===undefined` (lift always has a value, so 3 is shown until the user confirms stance: track `stanceDone` as `b.l !== 0 || b.lv || b.t !== null`; simpler: step 3 is complete once step 4 has any value or the user pressed "Keep stock"; store that as `patch {l:0}` and treat `l` as `number|null` initially null). Pick the simpler rule: make `l: number | null` with `null` meaning not chosen; `encode` writes `l` only when non-null; `decode` maps unknown lift values to null. Update the tests' `empty` and the Build type accordingly (lift `0|2.5|4|6|null`).

`url.ts`: `encode` uses `URLSearchParams` with keys `v,y,p,l,lv,b,m,s,f,t,tow`; `decode` validates each against the catalog: `v` must be a vehicle id; `y` within `years`; `p` must match a paint slug (`slugify(name)`); `l` in `[0,2.5,4,6]`; `b` in brands; `m` in that brand's models; `s` in `wheelSizes(...)`; `f` in `["polished","brushed","black","black-milled"]`; `t` must parse with `Fitment.parseTireSize` and exist in `tireChoices(cat, dia, "any")`.

`options.ts`: `wheelSizes` filters `model.sizes` by `Fitment.parseSize(s).widthKnown` and, for `"dually"`, keeps only sizes with width 8.25; `tireChoices` wraps `Fitment.tiresFor(cat.tires, diaIn, mode === "any" ? undefined : mode)`; `offsetFor` uses `Fitment.offsetRole(widthIn, config === "dually" ? "dually" : "single")` then `Fitment.offsetFor(cat.offsets, role, diaIn, widthIn)?.typical ?? null`.

`flow/index.ts` re-exports all of the above.

- [x] **Step 3: Run tests**

Run: `cd configurator && npm test`
Expected: PASS.

- [x] **Step 4: UI**

`styles.css`: copy the `:root` tokens from the site's `styles.css` (`--blue`, `--ink`, `--line`, `--display`, `--bg` and friends) verbatim, then the layout: on mobile the stage is a 56vh sticky top block and the step panel scrolls under it; on desktop (>= 960px) a two-column grid, stage left (sticky), panel right (max 440px). Buttons reuse the site's `.btn` and `.btn--primary` rules copied verbatim. No modals.

`Steps.tsx`: header with the five step names, the active one in `--blue`, earlier ones tappable to go back. Each step screen is one component:

- `TruckStep`: make chips (from `cat.vehicles` makes), then model (from `vehicle.models`), then year (range `vehicle.years`). A toggle "I'm shopping for this truck" sets nothing extra in the slice but changes the heading to "Pick the truck you're looking at".
- `PaintStep`: ten swatches from `cat.paints`, name under each.
- `StanceStep`: chips Stock, Leveled, 2.5", 4", 6"; under them the tire diameters available for the chosen wheel diameter will appear in WheelStep, so this step only shows the words "Lift moves the body up. Tires come next, sized to what we sell." and a "Keep stock" button that sets `l:0`.
- `WheelStep`: brand (only `cat.brands`), model grid with the catalog `img`, size chips from `wheelSizes`, finish chips from the model's `finishes` mapped through `finishCode`, then tire chips from `tireChoices(cat, dia, config === "dually" ? "dual" : "any")`. When the tire list is empty show `copy.noTire(dia)`: "No tire we sell comes in a {dia} inch size yet. Pick another wheel size, or ask us on the quote." and keep the size selectable.
- `Summary`: the truck, paint, stance, wheel, finish, tire as a list; `fit.stance.label`, `fit.pokeText`; when `!fit.offsetKnown`: "Offset is cut to your truck on a forged set. Your quote shows the number we confirm." A numeric "Trailer weight, if you tow" input sets `tow`. If `fit.loadOk === false`: hide the quote button, show the contact CTA ("Talk to us about this setup", `tel:` link from the site header) and the line "This size comes up short for that trailer weight. We point you to one that covers it." Otherwise show "Get my quote" (`<a href={quoteHref}>`), "Share this build" (copies `location.origin + "/visualize/" + encode(b)`), and "Save a photo" (`gl.domElement.toDataURL("image/png")` via a ref exposed from `Stage`; render with `preserveDrawingBuffer: true` only for that frame by calling `gl.render` then reading). Fine print, verbatim: "Fitment verified before we build it. Mounted and balanced is an option priced on the quote, with freight on its own line."

`quoteHref`: `/jtx.html#quote?build=` + encode(b). (The JTX page reads `quoteBuild` into a hidden field today; Task 8 wires the query into it.)

`copy.ts` holds every customer-facing string. Run slopcheck on it: `python3 ~/.claude/skills/proofpilot-copywriting/scripts/slopcheck.py --channel web configurator/src/ui/copy.ts` and fix every BLOCK.

`App.tsx`: `useReducer(reduce, decode(location.search, cat))`; `useEffect` writes `history.replaceState` with `encode(b)` on change; derives `fit` from the build (defaults: offset from `offsetFor`, tire parsed), chooses `preset` by step (1 hero, 2 hero, 3 side, 4 wheel, 5 hero); renders `Stage` or `Poster`.

- [x] **Step 5: Playwright end to end**

```ts
// configurator/e2e/flow.spec.ts
import { test, expect } from "@playwright/test";
test("builds an F-250 to a quote", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Ford" }).click();
  await page.getByRole("button", { name: /F-250/ }).click();
  await page.getByRole("button", { name: "2024" }).click();
  await page.getByRole("button", { name: /Race Red/ }).click();
  await page.getByRole("button", { name: '6"' }).click();
  await page.getByRole("button", { name: /^Ace$/ }).click();
  await page.getByRole("button", { name: "24x14" }).click();
  await page.getByRole("button", { name: /Polished/ }).click();
  await page.getByRole("button", { name: /37x13\.50R24/ }).click();
  await expect(page.getByText(/fender/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Get my quote" })).toHaveAttribute("href", /jtx\.html#quote\?build=.*v=f250/);
  await expect(page.locator("body")).not.toContainText(/guarantee/i);
  const url = page.url(); expect(url).toContain("v=f250"); expect(url).toContain("s=24x14");
  const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth); expect(sw).toBe(true);
  await page.screenshot({ path: process.env.SHOT_DIR + "/flow-summary-" + test.info().project.name + ".png", fullPage: true });
});
test("tow weight above rating hides the quote button", async ({ page }) => {
  await page.goto("./?v=f250&y=2024&p=race-red&l=6&b=jtx&m=Ace&s=24x14&f=polished&t=37x13.50R24");
  await page.getByLabel(/trailer weight/i).fill("30000");
  await expect(page.getByRole("link", { name: "Get my quote" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /talk to us/i })).toBeVisible();
});
test("bad share url lands on step 1 without crashing", async ({ page }) => {
  await page.goto("./?v=nope&m=Nope&s=99x99");
  await expect(page.getByRole("button", { name: "Ford" })).toBeVisible();
});
```

`loadRatingLb` for the slice: a single constant `JTX_LOAD_RATING_LB = 3195` in `copy.ts`'s neighbour `src/data/ratings.ts` with a comment that it is a placeholder until JTX confirms per size, and an entry in `LAUNCH-CHECKLIST.md`.

Run: `cd configurator && npm run build && npm run e2e`
Expected: PASS on desktop and mobile. Open the screenshots and check them yourself.

---

### Task 8: Wire into the site

**Files:**
- Modify: `index.html`, `shop.html`, `jtx.html` (nav link "Visualize" to `/visualize/`), `jtx.js` (read `build=` from the hash query into the hidden `quoteBuild` field: `location.hash.split("?")[1]`), `LAUNCH-CHECKLIST.md` (items: stand-in trucks, trade dress review, placeholder load rating, simplified tow check), `README.md` section "Configurator" (how to build: `cd configurator && npm ci && npm run build`, where the output lands, how to add a truck or a wheel program), `tools/test-pages.js` only if it enumerates pages and needs `visualize/` excluded
- Create: `configurator/README.md` (same content as the README section, plus the node-name contract and budgets)

- [ ] **Step 1: Failing check**

Run: `node tools/test-pages.js && grep -c 'href="/visualize/"' index.html shop.html jtx.html`
Expected: test passes; grep shows 0 for each file.

- [ ] **Step 2: Add the links and the quote handoff**

Add `<a href="/visualize/">Visualize</a>` in each page's nav next to the existing shop link. In `jtx.js` inside `bindQuote()`, before the submit handler: `var q = (location.hash.split("?")[1] || ""); var mb = new URLSearchParams(q).get("build"); if (mb && $("quoteBuild")) $("quoteBuild").value = mb;`.

- [ ] **Step 3: Verify**

Run: `node tools/test-pages.js && node tools/test-fitment.js && node tools/test-builders.js && node tools/test-export-catalog.js && node tools/test-3d-models.js && node tools/check-3d-budgets.js configurator/public/models/*.glb && cd configurator && npm test && npm run build && npm run e2e`
Expected: everything passes. Serve the repo root with `python3 -m http.server 8080` and open `http://localhost:8080/visualize/` in Playwright at 390 and 1280; the page must load with the site fonts and no 404s in the network log.

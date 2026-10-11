#!/usr/bin/env node
/* Renders the no-WebGL fallback posters, configurator/public/poster/<id>.jpg,
   from the live scene at the hero preset. Rerun whenever a truck model, the
   default build or the lighting changes, then rebuild the configurator.

     cd configurator && npm run build && npx vite preview --port 4173 &
     node ../tools/3d/render-posters.mjs

   Bundled Chromium only (Playwright's own build), never the installed Chrome. */
import { chromium } from "../../configurator/node_modules/playwright/index.mjs";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../configurator/public/poster");
const base = process.env.BASE_URL || "http://localhost:4173/visualize/";
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["f250", "f150"];
const MAX_BYTES = 150 * 1024;

const browser = await chromium.launch();
let fail = 0;
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1 });
  await page.goto(`${base}?v=${id}&poster=1`);
  await page.waitForSelector("[data-ready='1']", { timeout: 30000 });
  await page.waitForTimeout(2000); // camera settle and shadow frames
  const file = path.join(out, `${id}.jpg`);
  await page.locator("section canvas").screenshot({ path: file, type: "jpeg", quality: 80 });
  const size = statSync(file).size;
  console.log(`${id}.jpg ${(size / 1024).toFixed(1)} KB`);
  if (size > MAX_BYTES) { console.log(`  FAIL ${id}.jpg is over 150 KB`); fail++; }
  await page.close();
}
await browser.close();
process.exit(fail ? 1 : 0);

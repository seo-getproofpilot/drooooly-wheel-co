import { test, expect } from "@playwright/test";

const SHOT_DIR = process.env.SHOT_DIR;

test("renders the stage", async ({ page }) => {
  await page.goto("./?v=f250&y=2024");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("[data-ready='1']")).toHaveCount(1, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (SHOT_DIR) await page.screenshot({ path: SHOT_DIR + "/stage-" + test.info().project.name + ".png", fullPage: true });
});

test("falls back to the poster without WebGL", async ({ browser }) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, t: any, ...a: any[]) { return /webgl/.test(String(t)) ? null : (g as any).call(this, t, ...a); } as any; });
  await page.goto("./?v=f250&y=2024");
  await expect(page.locator("img[src*='/poster/']")).toBeVisible();
  await expect(page.getByText("Your picks still get a quote.")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await ctx.close();
});

import { test, expect } from "@playwright/test";
import { copy } from "../src/ui/copy";
test("loads", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("h1")).toHaveText(copy.pageTitle);
  await expect(page).toHaveTitle("Visualize your truck | DROOOLY Wheel & Tire");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
test("deck layout: tabs, save, stage badge, camera chips, no horizontal scroll", async ({ page }) => {
  await page.goto("./?v=f250&mn=F-350+Super+Duty&y=2019");
  for (const t of copy.tabs) await expect(page.getByRole("navigation", { name: copy.tabsLabel }).getByRole("button", { name: new RegExp(t) })).toBeVisible();
  await expect(page.getByRole("button", { name: copy.saveBuild })).toBeVisible();
  await expect(page.getByText(copy.stageBadge)).toBeVisible();
  await expect(page.getByText(copy.stageHint)).toBeVisible();
  for (const c of ["Front", "Three-quarter", "Side", "Rear", "Wheel"]) await expect(page.getByRole("group", { name: copy.cameraLabel }).getByRole("button", { name: c })).toBeVisible();
  const small = await page.locator(".chip, .cam, .dot, .tab").evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 44; }).length);
  expect(small).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

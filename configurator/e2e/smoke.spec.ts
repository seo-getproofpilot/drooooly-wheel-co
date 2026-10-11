import { test, expect } from "@playwright/test";
import { copy } from "../src/ui/copy";
test("loads", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("h1")).toHaveText(copy.pageTitle);
  await expect(page).toHaveTitle("Visualize your truck | DROOOLY Wheel & Tire");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

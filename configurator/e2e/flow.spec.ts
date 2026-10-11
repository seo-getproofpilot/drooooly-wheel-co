import { test, expect } from "@playwright/test";
const SHOT_DIR = process.env.SHOT_DIR;
const shot = async (page: any, name: string) => {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}-${test.info().project.name}.png`, fullPage: true });
};
const noOverflow = async (page: any) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

test("builds an F-250 to a quote", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await shot(page, "flow-1-truck");
  await page.getByRole("button", { name: "Ford" }).click();
  await page.getByRole("button", { name: /F-250/ }).click();
  await page.getByRole("button", { name: "2024" }).click();
  await shot(page, "flow-2-paint");
  await page.getByRole("button", { name: /Race Red/ }).click();
  await page.waitForTimeout(800);
  await shot(page, "flow-3-stance");
  await page.getByRole("button", { name: '6"' }).click();
  await page.getByRole("button", { name: /^Ace$/ }).click();
  await page.getByRole("button", { name: "24x14" }).click();
  await page.getByRole("button", { name: /Polished/ }).click();
  await page.waitForTimeout(1200);
  await shot(page, "flow-4-wheels");
  await page.getByRole("button", { name: /^37x13\.50R24 Sold/ }).click();
  await expect(page.getByText(/fender/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Get my quote" })).toHaveAttribute("href", /jtx\.html#quote\?build=.*v=f250/);
  await expect(page.locator("body")).not.toContainText(/guarantee/i);
  await expect(page.locator("body")).toContainText("Fitment verified before we build it.");
  const url = page.url(); expect(url).toContain("v=f250"); expect(url).toContain("s=24x14");
  await noOverflow(page);
  await page.waitForTimeout(1500);
  await shot(page, "flow-summary");
});

test("the phone stage stays on top and is never covered", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile");
  await page.goto("./?v=f250&y=2024&p=race-red&l=6&b=jtx&m=Ace");
  await page.mouse.wheel(0, 900);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(300);
  const box = await page.locator(".stage").boundingBox();
  expect(box!.y).toBeLessThanOrEqual(1);
  expect(box!.height).toBeGreaterThan(300);
  // whatever sits at the centre of the stage is the stage itself
  const top = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el?.closest(".stage"); }, [195, box!.height / 2]);
  expect(top).toBe(true);
});

test("tow weight above rating hides the quote button", async ({ page }) => {
  await page.goto("./?v=f250&y=2024&p=race-red&l=6&b=jtx&m=Ace&s=24x14&f=polished&t=37x13.50R24");
  await expect(page.getByRole("link", { name: "Get my quote" })).toBeVisible();
  await page.getByLabel(/trailer weight/i).fill("30000");
  await expect(page.getByRole("link", { name: "Get my quote" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /talk to us/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /talk to us/i })).toHaveAttribute("href", /^tel:/);
  await expect(page.getByText("This size comes up short for that trailer weight.", { exact: false })).toBeVisible();
  await expect(page.locator("body")).toContainText("Fitment verified before we build it.");
  await expect(page.locator("body")).not.toContainText(/guarantee/i);
  await shot(page, "flow-tow-stop");
  await page.getByLabel(/trailer weight/i).fill("9000");
  await expect(page.getByRole("link", { name: "Get my quote" })).toBeVisible();
});

test("a 30 inch wheel says no tire, and the flow stays usable", async ({ page }) => {
  await page.goto("./?v=f250&y=2024&p=race-red&l=6&b=jtx&m=Ace&f=polished");
  await page.getByRole("button", { name: "30x16" }).click();
  await expect(page.getByText("No tire we sell comes in a 30 inch size yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /ask about this size on the quote/i })).toHaveAttribute("href", /jtx\.html#quote\?build=.*s=30x16/);
  await shot(page, "flow-no-tire");
  await page.getByRole("button", { name: "24x14" }).click();
  await page.getByRole("button", { name: /^37x13\.50R24 Sold/ }).click();
  await expect(page.getByRole("link", { name: "Get my quote" })).toBeVisible();
});

test("bad share url lands on step 1 without crashing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("./?v=nope&m=Nope&s=99x99&p=race-red");
  await expect(page.getByRole("button", { name: "Ford" })).toBeVisible();
  expect(page.url()).toContain("p=race-red"); // the known part is kept
  expect(page.url()).not.toContain("v=nope");
  expect(errors).toEqual([]);
});

test("going back keeps the rest of the build", async ({ page }) => {
  await page.goto("./?v=f250&y=2024&p=race-red&l=6&b=jtx&m=Ace&s=24x14&f=polished&t=37x13.50R24");
  await page.getByRole("button", { name: /change paint/i }).click();
  await page.getByRole("button", { name: /Atlas Blue/ }).click();
  await page.getByRole("button", { name: "Back to your build" }).click();
  await expect(page.getByRole("link", { name: "Get my quote" })).toHaveAttribute("href", /p=atlas-blue/);
  expect(page.url()).toContain("t=37x13.50R24");
});

test("no WebGL still reaches a quote", async ({ browser }) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, t: any, ...a: any[]) { return /webgl/.test(String(t)) ? null : (g as any).call(this, t, ...a); } as any; });
  await page.goto("./?v=f250&y=2024&p=race-red&l=6&b=jtx&m=Ace&s=24x14&f=polished&t=37x13.50R24");
  await expect(page.locator("img[src*='/poster/']")).toBeVisible();
  await expect(page.getByRole("link", { name: "Get my quote" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save a photo" })).toHaveCount(0);
  await ctx.close();
});

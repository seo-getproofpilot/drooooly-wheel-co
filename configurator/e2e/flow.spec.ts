import { test, expect } from "@playwright/test";
const SHOT_DIR = process.env.SHOT_DIR;
const shot = async (page: any, name: string, full = true) => {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}-${test.info().project.name}.png`, fullPage: full });
};
const noOverflow = async (page: any) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
/* On a phone the stage is stuck over the top half of the screen. Playwright
   scrolls a target to the viewport centre, which is under the stage, so scroll
   it the way the page does (scroll-padding keeps it below the stage) first. */
const tap = async (l: any) => { await l.evaluate((el: Element) => el.scrollIntoView({ block: "center" })); await l.click(); };
/* Tests that only exercise the panel's logic run on the poster path: the flow
   is the same with or without WebGL, and software WebGL on a loaded CI box can
   starve the page for minutes. Tests about the stage keep WebGL. */
const noGL = (page: any) => page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, t: any, ...a: any[]) { return /webgl/.test(String(t)) ? null : (g as any).call(this, t, ...a); } as any; });
const BUILD = "./?v=f250&mn=F-350+Super+Duty&y=2019&p=race-red&l=4&b=jtx&m=Ace&s=26x14&f=polished&t=37x13.50R26";

test("the 3D stage draws the build with its callout and no page errors", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BUILD);
  await expect(page.locator(".stage canvas")).toBeVisible();
  await expect(page.locator(".stage")).toContainText("26x14 -76", { timeout: 120_000 });
  await expect(page.locator(".stage")).toContainText("JTX Ace, Polished");
  await expect(page.getByRole("link", { name: /Ford F-450 Twin Turbo 2021/ })).toHaveAttribute("href", /sketchfab\.com\/3d-models\/ford-f-450-twin-turbo-2021/);
  await page.waitForTimeout(3000);
  await shot(page, "stage-live", false);
  expect([...new Set(errors)]).toEqual([]);
});

test("picks a truck, then builds it in the live panel to a quote", async ({ page }) => {
  test.setTimeout(150_000);
  await noGL(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("./");
  const sheet = page.getByRole("dialog", { name: "Which truck are we building?" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(1500);
  await shot(page, "flow-1-sheet", false);
  await tap(sheet.getByRole("button", { name: "Ford", exact: true }));
  await tap(sheet.getByRole("button", { name: "F-350 Super Duty" }));
  await tap(sheet.getByRole("button", { name: "2019" }));
  await tap(sheet.getByRole("button", { name: "Race Red" }));
  await tap(sheet.getByRole("button", { name: "Open the visualizer" }));
  await expect(sheet).toHaveCount(0);

  // the live panel, seeded with a whole build
  const truck = page.getByRole("region", { name: "Your truck" });
  await expect(truck).toContainText("2019 Ford F-350 Super Duty");
  await expect(truck).toContainText("Crew cab, SRW");
  for (const name of ["Lift", "Wheel", "Size and offset", "Finish", "Tire", "Stance"]) await expect(page.getByRole("region", { name })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get my JTX quote" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Race Red" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("slider", { name: "Lift" }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("slider", { name: "Lift" })).toHaveAttribute("aria-valuetext", "6 inch lift");
  await tap(page.getByRole("button", { name: "26x14" }));
  await expect(page.getByRole("button", { name: "-76 mm offset" })).toHaveAttribute("aria-pressed", "true");
  await tap(page.getByRole("button", { name: "Black Milled" }));
  await tap(page.getByRole("button", { name: /^37x13\.50R26, sold as/ }));
  await expect(page.getByRole("meter", { name: /past the fender/ })).toHaveAttribute("aria-valuetext", /^Sits about/);
  await expect(page.getByRole("region", { name: "Stance" })).toContainText(/fender/);

  const quote = page.getByRole("link", { name: "Get my JTX quote" });
  await expect(quote).toHaveAttribute("href", /jtx\.html#quote\?build=.*v=f250.*s=26x14/);
  const url = page.url(); expect(url).toContain("s=26x14"); expect(url).toContain("l=6"); expect(url).toContain("f=black-milled");
  await expect(page.locator("body")).not.toContainText(/guarantee|will fit|rub free/i);
  await expect(page.locator("body")).toContainText("Fitment verified before we build it.");
  await noOverflow(page);
  await shot(page, "flow-2-live", false);
  await shot(page, "flow-2-live-full");
  expect([...new Set(errors)]).toEqual([]);
});

test("offset chips are the recorded values, and a gap says cut to your truck", async ({ page }) => {
  await noGL(page);
  await page.goto("./?v=f250&mn=F-250+Super+Duty&y=2024&b=jtx&m=Ace&s=24x8.25");
  await tap(page.getByRole("button", { name: "20x10" }));
  await expect(page.getByRole("button", { name: "Cut to your truck" })).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).not.toContain("o=");
  await expect(page.getByRole("region", { name: "Size and offset" })).toContainText("Offset is cut to your truck");
  await tap(page.getByRole("button", { name: "24x12" }));
  await tap(page.getByRole("button", { name: "-51 mm offset" }));
  expect(page.url()).toContain("o=-51");
  await expect(page.getByRole("link", { name: "Get my JTX quote" })).toHaveAttribute("href", /o=-51/);
});

test("the wheel card opens the style grid", async ({ page }) => {
  await noGL(page);
  await page.goto(BUILD);
  const card = page.getByRole("button", { name: /JTX Ace/ });
  await expect(card).toContainText("Single series, 8-lug");
  await tap(card);
  await tap(page.getByRole("group", { name: "JTX styles for your truck" }).getByRole("button", { name: "Ballistic" }));
  await expect(page.getByRole("button", { name: /JTX Ballistic/ })).toBeVisible();
  expect(page.url()).toContain("m=Ballistic");
  expect(page.url()).toContain("s=26x14"); // the size carries over when the new style is made in it
});

test("step tabs scroll to their section", async ({ page }) => {
  await noGL(page);
  await page.goto(BUILD);
  await tap(page.getByRole("button", { name: /Stance/ }).first());
  await page.waitForTimeout(900);
  const top = await page.getByRole("region", { name: "Stance" }).evaluate((el) => el.getBoundingClientRect().top);
  const stageH = await page.locator(".stage").evaluate((el) => (window.innerWidth < 960 ? el.getBoundingClientRect().height : 0));
  expect(top).toBeGreaterThanOrEqual(stageH - 2);
  expect(top).toBeLessThan(await page.evaluate(() => window.innerHeight - 100));
});

test("save my build asks a signed-out visitor for their email", async ({ page }) => {
  await noGL(page);
  await page.goto(BUILD);
  await tap(page.getByRole("button", { name: "Save my build" }));
  const sheet = page.getByRole("dialog", { name: "Save it to your garage" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Email")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("the phone stage stays on top and is never covered", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile");
  await page.goto(BUILD);
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(400);
  const box = (await page.locator(".stage").boundingBox())!;
  expect(box.y).toBeLessThanOrEqual(1);
  expect(box.height).toBeGreaterThan(300);
  const top = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".stage"), [195, box.height / 2]);
  expect(top).toBe(true);
  // camera chips sit on the stage's bottom edge, the quote button on the screen's
  const chips = (await page.getByRole("group", { name: "Camera angle" }).boundingBox())!;
  expect(chips.y + chips.height).toBeLessThanOrEqual(box.height + 1);
  const cta = (await page.getByRole("link", { name: "Get my JTX quote" }).boundingBox())!;
  expect(cta.y + cta.height).toBeLessThanOrEqual(844);
  expect(cta.y).toBeGreaterThan(box.height);
  await shot(page, "flow-mobile-scrolled", false);
});

test("tow weight above rating hides the quote button", async ({ page }) => {
  await noGL(page);
  await page.goto(BUILD);
  await expect(page.getByRole("link", { name: "Get my JTX quote" })).toBeVisible();
  await page.getByLabel(/trailer weight/i).fill("30000");
  await expect(page.getByRole("link", { name: "Get my JTX quote" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /talk to us/i })).toHaveAttribute("href", /^tel:/);
  await expect(page.getByText("This size comes up short for that trailer weight.", { exact: false })).toBeVisible();
  await expect(page.locator("body")).toContainText("Fitment verified before we build it.");
  await expect(page.locator("body")).not.toContainText(/guarantee/i);
  await shot(page, "flow-tow-stop");
  await page.getByLabel(/trailer weight/i).fill("9000");
  await expect(page.getByRole("link", { name: "Get my JTX quote" })).toBeVisible();
});

test("a 30 inch wheel says no tire, and the flow stays usable", async ({ page }) => {
  await noGL(page);
  await page.goto(BUILD);
  await tap(page.getByRole("button", { name: "30x16" }));
  await expect(page.getByText("No tire we sell comes in a 30 inch size yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /ask about this size on the quote/i })).toHaveAttribute("href", /jtx\.html#quote\?build=.*s=30x16/);
  await tap(page.getByRole("button", { name: "24x14" }));
  await tap(page.getByRole("button", { name: /^37x13\.50R24, sold as/ }));
  await expect(page.getByRole("link", { name: "Get my JTX quote" })).toBeVisible();
});

test("cold open shows the sheet and no panel; makes without a body are disabled", async ({ page }) => {
  await noGL(page);
  await page.goto("./");
  const sheet = page.getByRole("dialog", { name: "Which truck are we building?" });
  await expect(sheet).toBeVisible();
  await expect(page.getByRole("region", { name: "Your truck" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Get my JTX quote" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Open the visualizer" })).toBeDisabled();
  await expect(sheet).toContainText("every truck we sell for still gets a quote on the shop pages");
  const soon = sheet.getByRole("button", { name: /3D coming soon/ });
  if (await soon.count()) await expect(soon.first()).toBeDisabled();
});

test("a link that names the truck never shows the sheet", async ({ page }) => {
  await noGL(page);
  await page.goto("./?v=f250");
  await expect(page.getByRole("region", { name: "Your truck" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Get my JTX quote" })).toBeVisible();
});

test("the homepage finder's saved truck opens straight into the panel", async ({ page }) => {
  await noGL(page);
  await page.addInitScript(() => localStorage.setItem("drooolyVehicle", JSON.stringify({ year: "2019", make: "Ford", model: "F-350 Super Duty" })));
  await page.goto("./");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Your truck" })).toContainText("2019 Ford F-350 Super Duty");
});

test("the F-450 builds as a dually", async ({ page }) => {
  await noGL(page);
  await page.goto("./?v=f450&y=2020");
  await expect(page.getByRole("region", { name: "Your truck" })).toContainText("Crew cab, DRW");
  await expect(page.getByRole("button", { name: /JTX \w+/ }).first()).toContainText(/Dually series, 10-lug/) // the F-450 is 10x225;
  const sizes = await page.getByRole("group", { name: "Size" }).getByRole("button").allTextContents();
  expect(sizes.length).toBeGreaterThan(0);
  expect(sizes.every((t) => t.endsWith("x8.25"))).toBe(true);
  await tap(page.getByRole("button", { name: "24x8.25" }));
  for (const o of [110, 120, 130]) await expect(page.getByRole("button", { name: `${o} mm offset` })).toBeVisible();
  await tap(page.getByRole("button", { name: "130 mm offset" }));
  expect(page.url()).toContain("o=130");
  await expect(page.getByRole("link", { name: "Get my JTX quote" })).toHaveAttribute("href", /v=f450/);
  await shot(page, "flow-f450", false);
});

test("bad share url lands on the truck sheet without crashing", async ({ page }) => {
  await noGL(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("./?v=nope&m=Nope&s=99x99&p=race-red");
  await expect(page.getByRole("dialog").getByRole("button", { name: "Ford", exact: true })).toBeVisible();
  expect(page.url()).toContain("p=race-red");
  expect(page.url()).not.toContain("v=nope");
  expect(errors).toEqual([]);
});

test("changing the truck keeps the rest of the build", async ({ page }) => {
  await noGL(page);
  await page.goto(BUILD);
  await tap(page.getByRole("button", { name: /Change your truck/ }));
  await tap(page.getByRole("dialog").getByRole("button", { name: "2021" }));
  await tap(page.getByRole("button", { name: "Open the visualizer" }));
  await expect(page.getByRole("region", { name: "Your truck" })).toContainText("2021 Ford F-350");
  expect(page.url()).toContain("s=26x14");
  expect(page.url()).toContain("p=race-red");
});

test("no WebGL still reaches a quote", async ({ browser }) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, t: any, ...a: any[]) { return /webgl/.test(String(t)) ? null : (g as any).call(this, t, ...a); } as any; });
  await page.goto(BUILD);
  await expect(page.locator("img[src*='/poster/']")).toBeVisible();
  await expect(page.getByRole("link", { name: "Get my JTX quote" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save a photo" })).toHaveCount(0);
  await ctx.close();
});

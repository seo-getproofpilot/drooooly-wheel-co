import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { copy } from "../src/ui/copy";

const SHOT_DIR = process.env.SHOT_DIR;
const BUILD = "./?v=f250&y=2021&p=race-red&l=4&b=jtx&m=Ace&s=26x14&f=polished&t=37x13.50R26";
/* any real JPEG stands in for the rendered still */
const JPEG = readFileSync(new URL("../public/poster/f250.jpg", import.meta.url));
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

/* A fake render service: the POST queues at position 2, the first poll is
   running, the second is done. */
export async function fakeRenderService(page: Page) {
  const posts: any[] = [];
  let polls = 0;
  let key = "";
  const json = (status: number, body: unknown) => ({ status, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await page.route("**/api/stills", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = req.postDataJSON();
    posts.push(body);
    key = Buffer.from(JSON.stringify({ b: body.build, c: body.camera })).toString("base64url");
    const origin = new URL(req.url()).origin;
    return route.fulfill(json(202, { key, status: "queued", position: 2, etaSeconds: 90, url: `${origin}/stills/${key}.jpg` }));
  });
  await page.route("**/api/stills/*", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const origin = new URL(req.url()).origin;
    polls++;
    const url = `${origin}/stills/${key}.jpg`;
    return route.fulfill(polls < 2
      ? json(202, { key, status: "running", position: 1, etaSeconds: 40, url })
      : json(200, { key, status: "done", url }));
  });
  await page.route("**/stills/*.jpg", (route) => route.fulfill({ status: 200, headers: { ...CORS, "Content-Type": "image/jpeg" }, body: JPEG }));
  return { posts, polls: () => polls, key: () => key };
}

test("Studio shot renders the current camera and opens the still in a lightbox", async ({ page }) => {
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const svc = await fakeRenderService(page);
  await page.goto(BUILD);
  await expect(page.locator("[data-ready='1']")).toHaveCount(1, { timeout: 120_000 });

  const btn = page.getByRole("button", { name: copy.studioShot });
  await expect(btn).toBeVisible();
  await btn.evaluate((el) => el.scrollIntoView({ block: "center" }));
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/button-${test.info().project.name}.png` });
  await btn.click();

  const status = page.locator(".foot .status");
  await expect(status).toContainText(copy.studioWorking);
  await expect(status).toContainText(copy.studioInLine(2));
  await expect(btn).toBeDisabled();
  await expect(page.locator(".stage canvas")).toBeVisible();

  const box = page.getByRole("dialog", { name: copy.studioTitle });
  await expect(box).toBeVisible({ timeout: 60_000 });
  const img = box.locator("img");
  await expect(img).toHaveAttribute("src", new RegExp(`/stills/${svc.key()}\\.jpg$`));
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  await expect(box.getByRole("link", { name: copy.studioSave })).toHaveAttribute("download", /\.jpg$/);
  await expect(box.getByRole("button", { name: copy.studioCopy })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/lightbox-${test.info().project.name}.png` });

  // the request carries the share build and the rounded live camera
  expect(svc.posts).toHaveLength(1);
  const sent = svc.posts[0];
  expect(sent.build).toBe(new URL(page.url()).search.slice(1));
  expect(sent.build).toContain("v=f250&");
  expect(sent.build).toContain("&t=37x13.50R26");
  expect(sent.camera.position).toHaveLength(3);
  expect(sent.camera.target).toHaveLength(3);
  for (const n of [...sent.camera.position, ...sent.camera.target, sent.camera.fov, sent.camera.aspect]) {
    expect(typeof n).toBe("number");
    expect(Math.round(n * 1000) / 1000).toBe(n);
  }
  expect(sent.camera.fov).toBeGreaterThan(10);
  expect(sent.camera.aspect).toBeGreaterThan(0.3);

  // Escape closes it, focus goes back to the button, and the build is untouched
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
  await expect(btn).toBeFocused();
  await expect(btn).toBeEnabled();
  expect(new URL(page.url()).search).toBe("?" + sent.build);
  expect([...new Set(errors)]).toEqual([]);
});

test("a failed studio shot says so on the status line and keeps the 3D view", async ({ page }) => {
  test.setTimeout(360_000);
  await page.route("**/api/stills", (route) => route.fulfill({ status: 429, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: "queue full" }) }));
  await page.goto(BUILD);
  await expect(page.locator("[data-ready='1']")).toHaveCount(1, { timeout: 120_000 });
  const btn = page.getByRole("button", { name: copy.studioShot });
  await btn.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await btn.click();
  await expect(page.locator(".foot .status")).toHaveText(copy.studioFailed);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(btn).toBeEnabled();
  await expect(page.locator(".stage canvas")).toBeVisible();
});

test("no Studio shot button on the poster fallback", async ({ page }) => {
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, t: any, ...a: any[]) { return /webgl/.test(String(t)) ? null : (g as any).call(this, t, ...a); } as any; });
  await page.goto(BUILD);
  await expect(page.getByRole("button", { name: copy.share })).toBeVisible();
  await expect(page.getByRole("button", { name: copy.studioShot })).toHaveCount(0);
});

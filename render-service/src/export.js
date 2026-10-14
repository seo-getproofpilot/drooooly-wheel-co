/* One persistent headless Chromium that loads the baked configurator
   (served by this process at /visualize/) with ?export=1&poster=1 and hands
   back the build as a binary glTF from window.__droooly.exportScene().
   poster=1 fills the viewport with the stage and drops the panel, sheet and
   pins; the export hook carries the body credit for that mode. WebGL runs
   on SwiftShader, so no GPU is needed.

   The page stays open between jobs. A job after the first calls
   window.__droooly.setBuild(query), which swaps paint, wheels and body in
   place (a body seen before is already in the loader cache), so the cold
   path (navigate, compile the shaders, download the body) runs once per
   browser life, not once per still. The page is recycled after
   EXPORT_PAGE_REUSES jobs or on any failure. */
import { chromium } from "playwright";

/* --disable-accelerated-2d-canvas matters: with it off, GLTFExporter's
   texture encodes went through a GPU-backed 2D canvas on SwiftShader and
   seven small PNGs took 30 s; on the CPU canvas the same export is under 9 s. */
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
  "--mute-audio", "--disable-gpu-sandbox", "--disable-dev-shm-usage", "--disable-accelerated-2d-canvas"];
/* SwiftShader draws a frame of this scene in about 1 s at 480 px and 3 s at
   1200 px on a loaded 18-core Mac, and the page needs frames to reach ready.
   Only the glTF leaves the page, and the one view-dependent part of it (the
   sidewall lettering fade) is a share of the viewport's short side, so a small
   viewport with the request's aspect exports the same scene. */
const TIMEOUT_MS = Number(process.env.EXPORT_TIMEOUT_MS || 180_000);
const VIEW_LONG_SIDE = Number(process.env.EXPORT_VIEW_LONG_SIDE || 640);
const PAGE_REUSES = Number(process.env.EXPORT_PAGE_REUSES || 40);

/** Viewport for an aspect (width / height) with the long side at EXPORT_VIEW_LONG_SIDE. */
export function viewportFor(aspect, long = VIEW_LONG_SIDE) {
  return aspect >= 1
    ? { width: long, height: Math.round(long / aspect) }
    : { width: Math.round(long * aspect), height: long };
}

export class Exporter {
  /** @param {{ baseUrl: string, timeoutMs?: number, log?: (l: string) => void }} o */
  constructor(o) {
    this.baseUrl = o.baseUrl.replace(/\/?$/, "/");
    this.timeoutMs = o.timeoutMs ?? TIMEOUT_MS;
    this.log = o.log ?? ((l) => console.log(l));
    /** @type {Promise<import("playwright").Browser> | null} */
    this.browser = null;
    /** @type {{ context: import("playwright").BrowserContext, page: import("playwright").Page, uses: number, crashed: boolean } | null} */
    this.warm = null;
    this.pageReuses = o.pageReuses ?? PAGE_REUSES;
    /** exports run one at a time (the boot warm-up and the first job would otherwise race for the page) */
    this.chain = Promise.resolve();
  }

  async #browser() {
    if (!this.browser) {
      this.browser = chromium.launch({ headless: true, args: ARGS }).then((b) => {
        b.on("disconnected", () => { this.browser = null; });
        return b;
      }, (e) => { this.browser = null; throw e; });
    }
    return this.browser;
  }

  async #reset() {
    const b = this.browser;
    this.browser = null;
    this.warm = null;
    try { await (await b)?.close(); } catch { /* already gone */ }
  }

  async #dropPage() {
    const w = this.warm;
    this.warm = null;
    await w?.context.close().catch(() => {});
  }

  /** A page showing the build, cold (navigated) or warm (swapped in place), with the stage timings. */
  async #pageFor(req, left) {
    const t = { path: "warm", navMs: 0, swapMs: 0 };
    const view = viewportFor(req.camera.aspect);
    if (this.warm && !this.warm.crashed && this.warm.uses < this.pageReuses) {
      const { page } = this.warm;
      try {
        const t0 = Date.now();
        if (page.viewportSize()?.width !== view.width || page.viewportSize()?.height !== view.height) await page.setViewportSize(view);
        await Promise.race([
          page.evaluate((q) => window.__droooly.setBuild(q), req.build),
          new Promise((_, rej) => setTimeout(() => rej(new Error("setBuild timed out")), left()).unref?.()),
        ]);
        // textures and the environment finish uploading a beat after the commit
        await page.waitForTimeout(500);
        t.swapMs = Date.now() - t0;
        this.warm.uses++;
        return { page, t };
      } catch (e) {
        this.log(`export warm page dropped: ${e instanceof Error ? e.message : e}`);
        await this.#dropPage();
      }
    }
    await this.#dropPage();
    t.path = "cold";
    const browser = await this.#browser();
    const context = await browser.newContext({ viewport: view, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const warm = { context, page, uses: 1, crashed: false };
    page.on("crash", () => { warm.crashed = true; });
    page.on("pageerror", (e) => this.log(`export pageerror ${String(e.message).slice(0, 200)}`));
    const t0 = Date.now();
    await page.goto(`${this.baseUrl}?${req.build}&export=1&poster=1`, { timeout: left(), waitUntil: "load" });
    await page.waitForSelector("[data-ready='1']", { state: "attached", timeout: left() });
    await page.waitForFunction(() => !!window.__droooly?.exportScene, null, { timeout: left() });
    // textures and the environment finish uploading a beat after data-ready
    await page.waitForTimeout(1500);
    t.navMs = Date.now() - t0;
    this.warm = warm;
    return { page, t };
  }

  /**
   * @param {{ build: string, camera: import("./key.js").Camera }} req
   * @returns {Promise<{ glb: Buffer, credit: string, camera: object }>}
   */
  export(req) {
    const run = this.chain.then(() => this.#export(req));
    this.chain = run.catch(() => {});
    return run;
  }

  async #export(req) {
    const deadline = Date.now() + this.timeoutMs;
    const left = () => Math.max(1000, deadline - Date.now());
    let page = null;
    try {
      const got = await this.#pageFor(req, left);
      page = got.page;
      const t0 = Date.now();
      const r = await Promise.race([
        page.evaluate(async (camera) => {
          const t0 = performance.now();
          const { glb, camera: cam, credit } = await window.__droooly.exportScene({ camera: { position: camera.position, target: camera.target } });
          const sceneMs = Math.round(performance.now() - t0);
          const u8 = new Uint8Array(glb);
          let s = "";
          for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
          return { b64: btoa(s), camera: cam, credit, sceneMs };
        }, req.camera),
        new Promise((_, rej) => setTimeout(() => rej(new Error("export timed out")), left()).unref?.()),
      ]);
      const glb = Buffer.from(r.b64, "base64");
      const { t } = got;
      this.log(`export ${t.path}${t.path === "cold" ? ` nav ${t.navMs} ms` : ` swap ${t.swapMs} ms`} scene ${r.sceneMs} ms transfer ${Date.now() - t0 - r.sceneMs} ms glb ${glb.length} bytes`);
      return { glb, credit: r.credit ?? "", camera: r.camera };
    } catch (e) {
      const crashed = !!this.warm?.crashed;
      const browser = await this.browser?.catch(() => null);
      if (crashed || !browser?.isConnected()) await this.#reset();
      else await this.#dropPage();
      throw crashed ? new Error("export page crashed") : e;
    }
  }

  async close() { await this.#reset(); }
}

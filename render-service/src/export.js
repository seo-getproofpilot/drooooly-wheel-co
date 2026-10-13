/* One persistent headless Chromium that loads the baked configurator
   (served by this process at /visualize/) with ?export=1&poster=1 and hands
   back the build as a binary glTF from window.__droooly.exportScene().
   poster=1 fills the viewport with the stage and drops the panel, sheet and
   pins; the export hook still reads the body credit for that mode. WebGL runs
   on SwiftShader, so no GPU is needed. */
import { chromium } from "playwright";

const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
  "--mute-audio", "--disable-gpu-sandbox", "--disable-dev-shm-usage"];
/* SwiftShader draws a frame of this scene in about 1 s at 480 px and 3 s at
   1200 px on a loaded 18-core Mac, and the page needs frames to reach ready.
   Only the glTF leaves the page, and the one view-dependent part of it (the
   sidewall lettering fade) is a share of the viewport's short side, so a small
   viewport with the request's aspect exports the same scene. */
const TIMEOUT_MS = Number(process.env.EXPORT_TIMEOUT_MS || 180_000);
const VIEW_LONG_SIDE = Number(process.env.EXPORT_VIEW_LONG_SIDE || 640);

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
    try { await (await b)?.close(); } catch { /* already gone */ }
  }

  /**
   * @param {{ build: string, camera: import("./key.js").Camera }} req
   * @returns {Promise<{ glb: Buffer, credit: string, camera: object }>}
   */
  async export(req) {
    const browser = await this.#browser();
    const context = await browser.newContext({ viewport: viewportFor(req.camera.aspect), deviceScaleFactor: 1 });
    const page = await context.newPage();
    let crashed = false;
    page.on("crash", () => { crashed = true; });
    page.on("pageerror", (e) => this.log(`export pageerror ${String(e.message).slice(0, 200)}`));
    const deadline = Date.now() + this.timeoutMs;
    const left = () => Math.max(1000, deadline - Date.now());
    try {
      await page.goto(`${this.baseUrl}?${req.build}&export=1&poster=1`, { timeout: left(), waitUntil: "load" });
      await page.waitForSelector("[data-ready='1']", { state: "attached", timeout: left() });
      await page.waitForFunction(() => !!window.__droooly?.exportScene, null, { timeout: left() });
      // textures and the environment finish uploading a beat after data-ready
      await page.waitForTimeout(1500);
      const r = await Promise.race([
        page.evaluate(async (camera) => {
          const { glb, camera: cam, credit } = await window.__droooly.exportScene({ camera: { position: camera.position, target: camera.target } });
          const u8 = new Uint8Array(glb);
          let s = "";
          for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
          return { b64: btoa(s), camera: cam, credit };
        }, req.camera),
        new Promise((_, rej) => setTimeout(() => rej(new Error("export timed out")), left()).unref?.()),
      ]);
      return { glb: Buffer.from(r.b64, "base64"), credit: r.credit ?? "", camera: r.camera };
    } catch (e) {
      if (crashed || !browser.isConnected()) await this.#reset();
      throw crashed ? new Error("export page crashed") : e;
    } finally {
      await context.close().catch(() => {});
    }
  }

  async close() { await this.#reset(); }
}

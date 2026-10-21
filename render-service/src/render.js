/* Blender Cycles render of an exported scene, then the JPEG encode with the
   CC BY credit line drawn on the bottom edge (the body licenses require it on
   every image of the model). */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

/**
 * Output size: the long side is `longSide`, the short side follows the
 * request's aspect (width / height). Both even.
 * @param {number} aspect @param {number} longSide
 */
export function stillSize(aspect, longSide) {
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return aspect >= 1
    ? { width: even(longSide), height: even(longSide / aspect) }
    : { width: even(longSide * aspect), height: even(longSide) };
}

/**
 * @param {{
 *   glb: Buffer, camera: import("./key.js").Camera,
 *   blender: string, script: string, assetRoot?: string,
 *   samples: number, longSide: number, device: string, timeoutMs?: number,
 * }} o
 * @returns {Promise<{ png: Buffer, renderMs: number, blenderRenderS?: number, device?: string }>}
 */
export async function renderStill(o) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "still-"));
  try {
    const { width, height } = stillSize(o.camera.aspect, o.longSide);
    const glb = path.join(dir, "scene.glb");
    const cam = path.join(dir, "camera.json");
    const out = path.join(dir, "out.png");
    await writeFile(glb, o.glb);
    await writeFile(cam, JSON.stringify({ ...o.camera, width, height }));
    const args = ["-b", "--factory-startup", "-P", o.script, "--", glb, cam, out,
      "--samples", String(o.samples), "--width", String(width), "--height", String(height), "--device", o.device];
    const t0 = Date.now();
    const { stdout } = await run(o.blender, args, {
      cwd: dir, timeoutMs: o.timeoutMs ?? 600_000,
      env: { ...process.env, ...(o.assetRoot ? { DROOOLY_ASSET_ROOT: o.assetRoot } : {}) },
    });
    const renderMs = Date.now() - t0;
    const m = stdout.match(/render-offline: RESULT (\{.*\})/);
    const result = m ? JSON.parse(m[1]) : {};
    return { png: await readFile(out), renderMs, blenderRenderS: result.render_s, device: result.device };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * The same render on the Modal GPU service (render-service/modal_render.py):
 * the glTF goes up as the body, the camera in a header, the PNG comes back.
 * Rejects on any non-200 with the service's error line, so the caller can
 * fall back to the local Blender.
 * @param {{
 *   glb: Buffer, camera: import("./key.js").Camera, url: string, key: string,
 *   samples: number, longSide: number, timeoutMs?: number, fetchImpl?: typeof fetch,
 * }} o
 * @returns {Promise<{ png: Buffer, renderMs: number, blenderRenderS?: number, device?: string }>}
 */
export async function renderStillRemote(o) {
  const { width, height } = stillSize(o.camera.aspect, o.longSide);
  const u = new URL(o.url);
  u.searchParams.set("samples", String(o.samples));
  u.searchParams.set("width", String(width));
  u.searchParams.set("height", String(height));
  const { position, target, fov, aspect } = o.camera;
  const t0 = Date.now();
  const res = await (o.fetchImpl ?? fetch)(u, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-render-key": o.key,
      "x-render-camera": JSON.stringify({ position, target, fov, aspect }),
    },
    body: o.glb,
    signal: AbortSignal.timeout(o.timeoutMs ?? 240_000),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error ?? ""; } catch { /* not JSON */ }
    throw new Error(`remote render ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  let result = {};
  try { result = JSON.parse(res.headers.get("x-render-result") || "{}"); } catch { /* header optional */ }
  return { png: Buffer.from(await res.arrayBuffer()), renderMs: Date.now() - t0, blenderRenderS: result.render_s, device: result.device };
}

/**
 * Runs a process; rejects with the tail of its output on a non-zero exit or
 * a timeout.
 * @param {string} cmd @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, timeoutMs: number }} o
 */
export function run(cmd, args, o) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: o.cwd, env: o.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const keep = (s, d) => (s + d).slice(-200_000);
    p.stdout.on("data", (d) => { stdout = keep(stdout, d); });
    p.stderr.on("data", (d) => { stderr = keep(stderr, d); });
    const timer = setTimeout(() => { p.kill("SIGKILL"); }, o.timeoutMs);
    let timedOut = false;
    timer.unref?.();
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code, signal) => {
      clearTimeout(timer);
      if (signal === "SIGKILL") timedOut = true;
      if (code === 0) return resolve({ stdout, stderr });
      const tail = (stderr || stdout).trim().split("\n").filter(Boolean).slice(-3).join(" | ");
      reject(new Error(timedOut ? `blender timed out after ${Math.round(o.timeoutMs / 1000)} s` : `blender exited ${code ?? signal}: ${tail}`));
    });
  });
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const BRAND_LINE = "DROOOLY · 3D preview";

/**
 * The bottom-edge band: a 60 percent black strip with the credit on the left
 * and the brand line on the right, white sans at 13 px (scaled up past a 1600 px long side)
 * (scaled with the still's long side, never below 13 px).
 * @param {number} width @param {number} height @param {string} credit
 */
export function overlaySvg(width, height, credit) {
  const fs = Math.max(13, Math.round((13 * Math.max(width, height)) / 1600));
  const band = Math.round(fs * 2);
  const pad = Math.round(fs * 0.9);
  const y = height - Math.round(band / 2 - fs * 0.35);
  const font = `font-family="DejaVu Sans, Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${fs}" fill="#fff"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<rect x="0" y="${height - band}" width="${width}" height="${band}" fill="#000" fill-opacity="0.6"/>
${credit ? `<text x="${pad}" y="${y}" ${font}>${esc(credit)}</text>` : ""}
<text x="${width - pad}" y="${y}" text-anchor="end" ${font}>${esc(BRAND_LINE)}</text>
</svg>`;
}

/**
 * PNG (or any sharp input) to a progressive JPEG at quality 86 with the
 * credit band composited.
 * @param {Buffer} input @param {string} credit
 */
export async function encodeStill(input, credit) {
  const img = sharp(input);
  const { width = 0, height = 0 } = await img.metadata();
  return img
    .composite([{ input: Buffer.from(overlaySvg(width, height, credit)), top: 0, left: 0 }])
    .jpeg({ quality: 86, progressive: true, mozjpeg: false })
    .toBuffer();
}

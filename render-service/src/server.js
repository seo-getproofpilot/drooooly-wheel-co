/* Studio shot render service. API and env are fixed by
   docs/superpowers/specs/2026-10-13-studio-shot-design.md:

   POST /api/stills        { build, camera } -> 202 queued/running, 200 done, 429 busy
   GET  /api/stills/<key>  status (key or its sha256)
   GET  /stills/<key>.jpg  the JPEG, or 202 JSON while it renders (queues on a miss)
   GET  /api/health        { ok, blender, queue, running, cache }

   The baked configurator is served from /visualize/ for the headless export. */
import express from "express";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decodeKey, encodeKey, isHash, keyHash, validateRequest } from "./key.js";
import { QueueFullError, RateLimiter, RenderQueue } from "./queue.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

/**
 * @param {{
 *   cacheDir: string,
 *   exportJob: (job: import("./queue.js").Job) => Promise<any>,
 *   renderJob: (job: import("./queue.js").Job, exported: any) => Promise<{ jpeg: Buffer, renderMs?: number, encodeMs?: number }>,
 *   publicUrl?: string, allowedOrigins?: string[], visualizeDir?: string,
 *   blenderVersion?: () => string, maxQueued?: number, rateLimit?: number, initialAvgMs?: number,
 *   now?: () => number, log?: (l: string) => void,
 * }} o
 */
export async function createApp(o) {
  const log = o.log ?? ((l) => console.log(l));
  await mkdir(o.cacheDir, { recursive: true });
  let cacheCount = (await readdir(o.cacheDir)).filter((f) => f.endsWith(".jpg")).length;
  /** @type {Map<string, string>} sha256 -> key */
  const aliases = new Map();
  const jpgPath = (hash) => path.join(o.cacheDir, `${hash}.jpg`);
  const metaPath = (hash) => path.join(o.cacheDir, `${hash}.json`);
  const cached = (hash) => existsSync(jpgPath(hash));

  const queue = new RenderQueue({
    maxQueued: o.maxQueued ?? 20,
    initialAvgMs: o.initialAvgMs ?? 90_000,
    now: o.now, log,
    exportJob: (job) => o.exportJob(job),
    renderJob: async (job, exported) => {
      const r = await o.renderJob(job, exported);
      const tmp = jpgPath(job.hash) + `.${process.pid}.tmp`;
      await writeFile(tmp, r.jpeg);
      await writeFile(metaPath(job.hash), JSON.stringify({ key: job.key, ...job.request, credit: exported?.credit ?? "", at: new Date().toISOString(), timings: { ...job.timings, renderMs: r.renderMs, encodeMs: r.encodeMs } }));
      await rename(tmp, jpgPath(job.hash));
      cacheCount++;
      return { renderMs: r.renderMs, encodeMs: r.encodeMs };
    },
  });
  const limiter = new RateLimiter({ limit: o.rateLimit ?? 6, now: o.now });
  const origins = (o.allowedOrigins ?? []).filter(Boolean);

  /** The key for a path segment (the key itself or a sha256 alias seen before), or null. */
  async function resolve(id) {
    if (isHash(id)) {
      if (aliases.has(id)) return aliases.get(id);
      try {
        const meta = JSON.parse(await readFile(metaPath(id), "utf8"));
        if (typeof meta.key === "string" && keyHash(meta.key) === id) { aliases.set(id, meta.key); return meta.key; }
      } catch { /* never seen */ }
      return null;
    }
    return decodeKey(id) ? id : null;
  }

  const baseUrl = (req) => (o.publicUrl || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const stillUrl = (req, key) => `${baseUrl(req)}/stills/${key}.jpg`;
  const clientIp = (req) => req.ip || req.socket.remoteAddress || "?";

  function statusBody(req, key, job) {
    const url = stillUrl(req, key);
    if (!job) return { key, status: "done", url };
    if (job.status === "error") return { key, status: "error", error: job.error, url };
    return { key, status: job.status, position: queue.position(job), etaSeconds: queue.etaSeconds(job), url };
  }

  /** Queue the key if it is neither cached nor in line. Returns { job } or { http, body } to send. */
  function ensure(req, key, { retry = false, counted = false } = {}) {
    const hash = keyHash(key);
    aliases.set(hash, key);
    if (cached(hash)) return { done: true };
    const existing = queue.get(key);
    const active = existing && (existing.status === "queued" || existing.status === "running");
    if (!active && !counted && !limiter.hit(clientIp(req))) return { http: 429, body: { error: "Too many studio shots from this address. Try again in a minute." } };
    try {
      const request = /** @type {{ build: string, camera: any }} */ (decodeKey(key));
      return { job: queue.enqueue(key, hash, request, { retry }).job };
    } catch (e) {
      if (e instanceof QueueFullError) return { http: 429, body: { error: e.message } };
      throw e;
    }
  }

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (!origins.length) res.set("Access-Control-Allow-Origin", "*");
    else if (origin && origins.includes(origin)) { res.set("Access-Control-Allow-Origin", origin); res.vary("Origin"); }
    else res.vary("Origin");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", req.get("access-control-request-headers") || "Content-Type");
      res.set("Access-Control-Max-Age", "86400");
      return res.status(204).end();
    }
    next();
  });

  if (o.visualizeDir) app.use("/visualize", express.static(o.visualizeDir, { fallthrough: true, maxAge: "1h" }));

  app.get("/api/health", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, blender: o.blenderVersion?.() ?? "unknown", queue: queue.queued, running: queue.running, cache: cacheCount });
  });

  app.post("/api/stills", express.json({ limit: "8kb" }), (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!limiter.hit(clientIp(req))) return res.status(429).json({ error: "Too many studio shots from this address. Try again in a minute." });
    const v = validateRequest(req.body);
    if ("error" in v) return res.status(400).json({ error: v.error });
    const key = encodeKey(v.build, v.camera);
    const r = ensure(req, key, { retry: true, counted: true });
    if (r.http) return res.status(r.http).json(r.body);
    if (r.done) return res.status(200).json(statusBody(req, key, null));
    const body = statusBody(req, key, r.job);
    res.status(body.status === "error" ? 200 : 202).json(body);
  });

  app.get("/api/stills/:id", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const key = await resolve(req.params.id);
    if (!key) return res.status(404).json({ error: "Unknown still." });
    const job = queue.get(key);
    if (job && (job.status === "error" || job.status === "queued" || job.status === "running")) {
      const body = statusBody(req, key, job);
      return res.status(job.status === "error" ? 200 : 202).json(body);
    }
    const r = ensure(req, key);
    if (r.http) return res.status(r.http).json(r.body);
    if (r.done) return res.status(200).json(statusBody(req, key, null));
    res.status(r.job.status === "error" ? 200 : 202).json(statusBody(req, key, r.job));
  });

  app.get("/stills/:file", async (req, res) => {
    const m = /^(.+)\.jpg$/.exec(req.params.file);
    const key = m ? await resolve(m[1]) : null;
    if (!key) return res.status(404).json({ error: "Unknown still." });
    const hash = keyHash(key);
    if (cached(hash)) {
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      res.type("image/jpeg");
      return res.sendFile(jpgPath(hash));
    }
    res.set("Cache-Control", "no-store");
    const r = ensure(req, key);
    if (r.http) return res.status(r.http).json(r.body);
    if (r.done) return res.redirect(302, req.originalUrl);
    if (r.job.status === "error") return res.status(500).json(statusBody(req, key, r.job));
    res.status(202).json(statusBody(req, key, r.job));
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found." }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) log(`http error ${err.message}`);
    res.status(status).json({ error: status === 400 ? "Bad request." : "Something went wrong." });
  });

  return { app, queue };
}

/** "Blender 5.2.2 LTS" from `blender --version`, or "unavailable". */
function readBlenderVersion(bin) {
  return new Promise((r) => execFile(bin, ["--version"], { timeout: 60_000 }, (err, stdout) => {
    r(err ? "unavailable" : (String(stdout).split("\n").find((l) => l.startsWith("Blender")) ?? "unknown").trim());
  }));
}

async function main() {
  const env = process.env;
  const port = Number(env.PORT || 8080);
  const samples = Number(env.RENDER_SAMPLES || 32);
  const longSide = Number(env.RENDER_LONG_SIDE || 1400);
  const device = env.RENDER_DEVICE || "CPU";
  const blender = env.BLENDER_BIN || "/opt/blender/blender";
  const visualizeDir = path.resolve(env.VISUALIZE_DIR || path.join(ROOT, "visualize"));
  const script = path.resolve(env.RENDER_SCRIPT || path.join(ROOT, "tools", "3d", "render-offline.py"));
  const cacheDir = path.resolve(env.RENDER_CACHE_DIR || "./cache");

  const [{ Exporter }, { renderStill, encodeStill }] = await Promise.all([import("./export.js"), import("./render.js")]);
  const exporter = new Exporter({ baseUrl: `http://127.0.0.1:${port}/visualize/` });
  let blenderVersion = "checking";
  readBlenderVersion(blender).then((v) => { blenderVersion = v; console.log(`blender: ${v}`); });

  const { app } = await createApp({
    cacheDir, visualizeDir,
    publicUrl: env.PUBLIC_URL,
    allowedOrigins: (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
    blenderVersion: () => blenderVersion,
    exportJob: (job) => exporter.export(job.request),
    renderJob: async (job, exported) => {
      const r = await renderStill({ glb: exported.glb, camera: job.request.camera, blender, script, assetRoot: visualizeDir, samples, longSide, device });
      const t0 = Date.now();
      const jpeg = await encodeStill(r.png, exported.credit);
      return { jpeg, renderMs: r.renderMs, encodeMs: Date.now() - t0 };
    },
  });
  const server = app.listen(port, () => {
    console.log(`render service on :${port} samples ${samples} long side ${longSide} device ${device} cache ${cacheDir} cpus ${os.cpus().length}`);
  });
  const stop = async () => { server.close(); await exporter.close(); process.exit(0); };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  process.on("unhandledRejection", (e) => console.log(`unhandled rejection ${e instanceof Error ? e.message : e}`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

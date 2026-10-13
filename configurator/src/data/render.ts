/* The studio shot client: the render service URL, the request key and the
   request-then-poll loop. The contract is fixed in
   docs/superpowers/specs/2026-10-13-studio-shot-design.md; the service builds
   the same key from the same body, so nothing here may drift from it. */
import { encode, type Build } from "../flow";

export const RENDER_STAGING = "https://render-staging-3d31.up.railway.app";
const RENDER_LOCAL = "http://localhost:8080";

/* ?render=<origin> wins (read once at load, like ?export=1, before the app
   rewrites the URL to the build), then localhost, then staging. */
export function pickRenderUrl(loc: { search: string; hostname: string } = location): string {
  const o = new URLSearchParams(loc.search).get("render");
  if (o) {
    try {
      const u = new URL(o);
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    } catch { /* not a URL: fall through */ }
  }
  if (loc.hostname === "localhost" || loc.hostname === "127.0.0.1") return RENDER_LOCAL;
  return RENDER_STAGING;
}

export const RENDER_URL = typeof location === "undefined" ? RENDER_STAGING : pickRenderUrl();

export interface StudioCamera {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  aspect: number;
}

const DROP = new Set(["export", "post", "poster"]);

/* The share query string without its "?", minus the keys that only steer the
   page (export, post, poster). Parts are kept byte for byte, never re-encoded,
   so the service decodes exactly what a share link carries. */
export function cleanBuild(build: string | Build): string {
  const s = typeof build === "string" ? build.replace(/^\?/, "") : encode(build).slice(1);
  return s.split("&").filter((part) => {
    if (!part) return false;
    const k = part.split("=")[0];
    let key = k;
    try { key = decodeURIComponent(k.replace(/\+/g, " ")); } catch { /* keep raw */ }
    return !DROP.has(key);
  }).join("&");
}

const r3 = (n: number) => {
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? 0 : v;
};

export function roundCamera(c: StudioCamera): StudioCamera {
  return {
    position: [r3(c.position[0]), r3(c.position[1]), r3(c.position[2])],
    target: [r3(c.target[0]), r3(c.target[1]), r3(c.target[2])],
    fov: r3(c.fov),
    aspect: r3(c.aspect),
  };
}

function base64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* key = base64url(JSON.stringify({ b: build, c: camera })) */
export function buildKey(build: string | Build, camera: StudioCamera): string {
  return base64url(JSON.stringify({ b: cleanBuild(build), c: roundCamera(camera) }));
}

export type StillStatus = "queued" | "running" | "done" | "error";
export interface StillBody { key: string; status: StillStatus; url?: string; position?: number; etaSeconds?: number; error?: string }
export interface Still { url: string; key: string }

export interface RequestOptions {
  /** each status the service reports, for the queue position */
  onStatus?: (s: StillBody) => void;
  base?: string;
  fetch?: typeof fetch;
  intervalMs?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export const POLL_MS = 2000;
export const TIMEOUT_MS = 3 * 60 * 1000;

export class StillError extends Error {
  constructor(message: string, readonly reason: "timeout" | "error" | "busy" | "network") { super(message); this.name = "StillError"; }
}

const abortError = () => new DOMException("Aborted", "AbortError");

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const t = setTimeout(() => { signal?.removeEventListener("abort", stop); resolve(); }, ms);
    const stop = () => { clearTimeout(t); reject(abortError()); };
    signal?.addEventListener("abort", stop, { once: true });
  });
}

async function readBody(res: Response): Promise<StillBody | null> {
  try { return (await res.json()) as StillBody; } catch { return null; }
}

/* POST /api/stills, then GET /api/stills/<key> every 2 s until done or error,
   for at most 3 minutes. Resolves with the still's URL and key; rejects with
   a StillError (or an AbortError when the signal fires). */
export async function requestStill(build: string | Build, camera: StudioCamera, signal?: AbortSignal, opts: RequestOptions = {}): Promise<Still> {
  const f = opts.fetch ?? fetch;
  const base = (opts.base ?? RENDER_URL).replace(/\/$/, "");
  const interval = opts.intervalMs ?? POLL_MS;
  const limit = opts.timeoutMs ?? TIMEOUT_MS;
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? wait;
  const start = now();
  const payload = { build: cleanBuild(build), camera: roundCamera(camera) };
  const fallbackKey = buildKey(payload.build, payload.camera);

  const settle = (res: Response, body: StillBody | null): Still | null => {
    if (res.status === 429) throw new StillError(body?.error ?? "busy", "busy");
    if (!res.ok || !body) throw new StillError(body?.error ?? `HTTP ${res.status}`, "error");
    opts.onStatus?.(body);
    if (body.status === "error") throw new StillError(body.error ?? "render failed", "error");
    if (body.status === "done" && body.url) return { url: body.url, key: body.key ?? fallbackKey };
    return null;
  };

  let res: Response;
  try {
    res = await f(base + "/api/stills", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new StillError(String(e), "network");
  }
  let body = await readBody(res);
  const first = settle(res, body);
  if (first) return first;
  const key = body?.key ?? fallbackKey;

  for (;;) {
    if (now() - start + interval > limit) throw new StillError("timed out", "timeout");
    await sleep(interval, signal);
    try {
      res = await f(base + "/api/stills/" + encodeURIComponent(key), { signal });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      continue; // one dropped poll is not a failed render; the clock still runs
    }
    body = await readBody(res);
    const done = settle(res, body);
    if (done) return done;
  }
}

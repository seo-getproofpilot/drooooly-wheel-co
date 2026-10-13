/* The still key is the request itself (spec: docs/superpowers/specs/
   2026-10-13-studio-shot-design.md):

     key = base64url(JSON.stringify({ b: build, c: camera }))

   build is the share query string without "?" and without the export, post
   and poster keys; camera is position, target, fov, aspect rounded to 3
   decimals. These rules mirror configurator/src/data/render.ts byte for byte
   (parts kept raw, never re-encoded; -0 written as 0). A key decodes only if
   re-encoding its contents gives the same key back, so each still has
   exactly one URL. */
import { createHash } from "node:crypto";

const DROP = new Set(["export", "post", "poster"]);
const MAX_BUILD = 600;
const MAX_KEY = 2048;
const BUILD_RE = /^[A-Za-z0-9._~%+=&-]*$/;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const SHA_RE = /^[0-9a-f]{64}$/;

/** @param {string} build */
export function cleanBuild(build) {
  return String(build).replace(/^\?/, "").split("&").filter((part) => {
    if (!part) return false;
    const k = part.split("=")[0];
    let key = k;
    try { key = decodeURIComponent(k.replace(/\+/g, " ")); } catch { /* keep raw */ }
    return !DROP.has(key);
  }).join("&");
}

/** @param {number} n */
const r3 = (n) => {
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? 0 : v;
};

/**
 * @typedef {{ position: [number, number, number], target: [number, number, number], fov: number, aspect: number }} Camera
 * @param {Camera} c
 * @returns {Camera}
 */
export function roundCamera(c) {
  return {
    position: [r3(c.position[0]), r3(c.position[1]), r3(c.position[2])],
    target: [r3(c.target[0]), r3(c.target[1]), r3(c.target[2])],
    fov: r3(c.fov),
    aspect: r3(c.aspect),
  };
}

const vec3 = (v, lim) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= lim);

/**
 * Validates a request body. Returns the cleaned build and rounded camera, or
 * { error } naming the first problem.
 * @param {unknown} body
 * @returns {{ build: string, camera: Camera } | { error: string }}
 */
export function validateRequest(body) {
  if (!body || typeof body !== "object") return { error: "body must be { build, camera }" };
  const { build, camera } = /** @type {any} */ (body);
  if (typeof build !== "string") return { error: "build must be a string" };
  const b = cleanBuild(build);
  if (!b || b.length > MAX_BUILD || !BUILD_RE.test(b)) return { error: "build is not a share query string" };
  if (!/(^|&)v=[^&]+/.test(b)) return { error: "build names no vehicle (v=)" };
  if (!camera || typeof camera !== "object") return { error: "camera must be { position, target, fov, aspect }" };
  if (!vec3(camera.position, 100) || !vec3(camera.target, 100)) return { error: "camera position and target must be [x, y, z] within 100 m" };
  const { fov, aspect } = camera;
  if (typeof fov !== "number" || !(fov >= 5 && fov <= 120)) return { error: "camera fov must be 5 to 120 degrees" };
  if (typeof aspect !== "number" || !(aspect >= 0.25 && aspect <= 4)) return { error: "camera aspect must be 0.25 to 4" };
  const c = roundCamera(camera);
  const d = [0, 1, 2].map((i) => c.position[i] - c.target[i]);
  if (Math.hypot(...d) < 0.05) return { error: "camera position and target coincide" };
  return { build: b, camera: c };
}

/** @param {string} build @param {Camera} camera */
export function encodeKey(build, camera) {
  return Buffer.from(JSON.stringify({ b: cleanBuild(build), c: roundCamera(camera) }), "utf8").toString("base64url");
}

/**
 * The key's request, or null when the key is malformed, fails validation, or
 * is not the canonical encoding of what it holds.
 * @param {string} key
 * @returns {{ build: string, camera: Camera } | null}
 */
export function decodeKey(key) {
  if (typeof key !== "string" || !key || key.length > MAX_KEY || !B64URL_RE.test(key)) return null;
  let obj;
  try { obj = JSON.parse(Buffer.from(key, "base64url").toString("utf8")); } catch { return null; }
  if (!obj || typeof obj !== "object") return null;
  const v = validateRequest({ build: obj.b, camera: obj.c });
  if ("error" in v) return null;
  if (encodeKey(v.build, v.camera) !== key) return null;
  return v;
}

/** sha256 of the key, hex: the cache file name and the key's short alias. */
export const keyHash = (key) => createHash("sha256").update(key).digest("hex");
export const isHash = (s) => typeof s === "string" && SHA_RE.test(s);

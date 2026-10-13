import { describe, it, expect, vi } from "vitest";
import { buildKey, cleanBuild, pickRenderUrl, requestStill, roundCamera, RENDER_STAGING, StillError, type StudioCamera } from "../src/data/render";
import { EMPTY, encode, type Build } from "../src/flow";

const CAM: StudioCamera = { position: [4.123456, 1.98765, -6.0004], target: [0.00049, 0.8, -1.2345678], fov: 35.00001, aspect: 1.6000004 };
const BUILD = "v=f250&mn=F-350+Super+Duty&y=2019&p=race-red&l=4&b=jtx&m=Ace&s=26x14&f=polished&t=37x13.50R26";

const fromB64url = (s: string) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
};

describe("render URL", () => {
  it("takes ?render=<origin>, then localhost, then staging", () => {
    expect(pickRenderUrl({ search: "?render=https://r.example.com/x/y", hostname: "drooolywt.com" })).toBe("https://r.example.com");
    expect(pickRenderUrl({ search: "?render=javascript:alert(1)", hostname: "drooolywt.com" })).toBe(RENDER_STAGING);
    expect(pickRenderUrl({ search: "", hostname: "localhost" })).toBe("http://localhost:8080");
    expect(pickRenderUrl({ search: "", hostname: "staging.drooolywt.com" })).toBe("https://render-staging-3d31.up.railway.app");
  });
});

describe("buildKey", () => {
  it("rounds the camera to 3 decimals", () => {
    expect(roundCamera(CAM)).toEqual({ position: [4.123, 1.988, -6], target: [0, 0.8, -1.235], fov: 35, aspect: 1.6 });
    expect(Object.is(roundCamera({ ...CAM, position: [-0.0001, 0, 0] }).position[0], 0)).toBe(true);
  });

  it("is base64url of {b, c} with the build string as the share link carries it", () => {
    const key = buildKey("?" + BUILD, CAM);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromB64url(key)).toBe(JSON.stringify({ b: BUILD, c: roundCamera(CAM) }));
  });

  it("drops export, post and poster and keeps every other part byte for byte", () => {
    expect(cleanBuild("?export=1&" + BUILD + "&post=0&poster=1")).toBe(BUILD);
    expect(buildKey("export=1&" + BUILD, CAM)).toBe(buildKey(BUILD, CAM));
  });

  it("encodes a Build the same way shareUrl does", () => {
    const b: Build = { ...EMPTY, v: "f250", mn: "F-350 Super Duty", y: 2019, p: "race-red", l: 4, b: "jtx", m: "Ace", s: "26x14", f: "polished", t: "37x13.50R26" };
    expect(encode(b).slice(1)).toBe(BUILD);
    expect(buildKey(b, CAM)).toBe(buildKey(BUILD, CAM));
  });

  it("changes with the camera", () => {
    expect(buildKey(BUILD, CAM)).not.toBe(buildKey(BUILD, { ...CAM, fov: 40 }));
  });
});

type Reply = { status: number; body: unknown };
function fakeService(replies: Reply[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = replies.shift();
    if (!r) throw new Error("no more replies");
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  });
  return { f: f as unknown as typeof fetch, calls };
}
const clock = () => {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
};

describe("requestStill", () => {
  const KEY = buildKey(BUILD, CAM);
  const URL_ = "http://svc/stills/" + KEY + ".jpg";

  it("posts the build and camera, then polls queued, running, done", async () => {
    const { f, calls } = fakeService([
      { status: 202, body: { key: KEY, status: "queued", position: 3, etaSeconds: 120, url: URL_ } },
      { status: 202, body: { key: KEY, status: "queued", position: 2, etaSeconds: 90, url: URL_ } },
      { status: 202, body: { key: KEY, status: "running", position: 1, etaSeconds: 40, url: URL_ } },
      { status: 200, body: { key: KEY, status: "done", url: URL_ } },
    ]);
    const seen: unknown[] = [];
    const c = clock();
    const out = await requestStill("?" + BUILD, CAM, undefined, { base: "http://svc/", fetch: f, ...c, onStatus: (s) => seen.push([s.status, s.position]) });
    expect(out).toEqual({ url: URL_, key: KEY });
    expect(calls[0].url).toBe("http://svc/api/stills");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ build: BUILD, camera: roundCamera(CAM) });
    expect(calls.slice(1).map((x) => x.url)).toEqual(Array(3).fill("http://svc/api/stills/" + KEY));
    expect(seen).toEqual([["queued", 3], ["queued", 2], ["running", 1], ["done", undefined]]);
    expect(c.now()).toBe(6000);
  });

  it("returns at once when the still is cached", async () => {
    const { f, calls } = fakeService([{ status: 200, body: { key: KEY, status: "done", url: URL_ } }]);
    await expect(requestStill(BUILD, CAM, undefined, { base: "http://svc", fetch: f, ...clock() })).resolves.toEqual({ url: URL_, key: KEY });
    expect(calls).toHaveLength(1);
  });

  it("rejects when the render fails", async () => {
    const { f } = fakeService([
      { status: 202, body: { key: KEY, status: "running", position: 1, etaSeconds: 40, url: URL_ } },
      { status: 200, body: { key: KEY, status: "error", error: "blender exited 1" } },
    ]);
    await expect(requestStill(BUILD, CAM, undefined, { base: "http://svc", fetch: f, ...clock() })).rejects.toMatchObject({ reason: "error", message: "blender exited 1" });
  });

  it("rejects on a full queue (429)", async () => {
    const { f } = fakeService([{ status: 429, body: { error: "queue full" } }]);
    const p = requestStill(BUILD, CAM, undefined, { base: "http://svc", fetch: f, ...clock() });
    await expect(p).rejects.toBeInstanceOf(StillError);
    await expect(p).rejects.toMatchObject({ reason: "busy" });
  });

  it("times out after 3 minutes of polling", async () => {
    const running = { status: 202, body: { key: KEY, status: "running", position: 1, etaSeconds: 40, url: URL_ } };
    const { f, calls } = fakeService(Array(200).fill(0).map(() => ({ ...running })));
    const c = clock();
    await expect(requestStill(BUILD, CAM, undefined, { base: "http://svc", fetch: f, ...c })).rejects.toMatchObject({ reason: "timeout" });
    expect(c.now()).toBeLessThanOrEqual(180_000);
    expect(calls.length).toBe(1 + 90);
  });

  it("stops when the signal aborts", async () => {
    const { f } = fakeService([{ status: 202, body: { key: KEY, status: "queued", position: 1, etaSeconds: 60, url: URL_ } }]);
    const ctl = new AbortController();
    const p = requestStill(BUILD, CAM, ctl.signal, { base: "http://svc", fetch: f, intervalMs: 50 });
    ctl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});

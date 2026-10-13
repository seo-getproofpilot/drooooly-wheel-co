import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createApp } from "../src/server.js";
import { encodeKey, keyHash } from "../src/key.js";
import { QueueFullError, RateLimiter, RenderQueue } from "../src/queue.js";

const BUILD = "v=f250&y=2021&p=race-red&l=4&b=jtx&m=Ace&s=26x14&f=polished&t=37x13.50R26";
const cam = (x) => ({ position: [x, 1, 3], target: [0, 0.93, -1.9], fov: 28, aspect: 1.6 });
const req = (x) => ({ build: BUILD, camera: cam(x) });
const quiet = () => {};
const deferred = () => { let resolve, reject; const p = new Promise((a, b) => { resolve = a; reject = b; }); return { p, resolve, reject }; };

test("identical keys share one job; one render at a time, FIFO", async () => {
  const order = [];
  const gates = new Map();
  const q = new RenderQueue({
    log: quiet,
    exportJob: async (job) => ({ id: job.key }),
    renderJob: async (job) => { order.push(job.key); const d = deferred(); gates.set(job.key, d); await d.p; },
  });
  const a = q.enqueue("a", "ha", req(1));
  const a2 = q.enqueue("a", "ha", req(1));
  const b = q.enqueue("b", "hb", req(2));
  assert.equal(a.created, true);
  assert.equal(a2.created, false);
  assert.equal(a2.job, a.job);
  assert.equal(q.position(a.job), 1);
  assert.equal(q.position(b.job), 2);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(order, ["a"], "b waits for a's render");
  assert.equal(b.job.exported !== undefined, true, "b exported while a rendered");
  gates.get("a").resolve();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(order, ["a", "b"]);
  gates.get("b").resolve();
  await q.idle();
  assert.equal(q.order.length, 0);
});

test("a failed job is reported and the queue keeps going", async () => {
  const q = new RenderQueue({
    log: quiet,
    exportJob: async (job) => { if (job.key === "bad") throw new Error("page crashed\nstack"); return {}; },
    renderJob: async () => {},
  });
  const bad = q.enqueue("bad", "h1", req(1)).job;
  const good = q.enqueue("good", "h2", req(2)).job;
  await q.idle();
  assert.equal(bad.status, "error");
  assert.equal(bad.error, "page crashed");
  assert.equal(good.status, "done");
  assert.equal(q.enqueue("bad", "h1", req(1)).created, false, "no retry inside a minute");
  assert.equal(q.enqueue("bad", "h1", req(1), { retry: true }).created, true, "explicit retry");
  await q.idle();
});

test("queue cap throws QueueFullError", () => {
  const q = new RenderQueue({ log: quiet, maxQueued: 2, exportJob: () => new Promise(() => {}), renderJob: async () => {} });
  q.enqueue("a", "1", req(1));
  q.enqueue("b", "2", req(2));
  assert.throws(() => q.enqueue("c", "3", req(3)), QueueFullError);
  assert.equal(q.enqueue("a", "1", req(1)).created, false, "a duplicate is never refused");
});

test("eta is position times the measured average", async () => {
  let t = 0;
  const q = new RenderQueue({ log: quiet, now: () => t, exportJob: async () => ({}), renderJob: async () => { t += 30_000; } });
  assert.equal(q.avgMs, 90_000);
  q.enqueue("a", "1", req(1));
  await q.idle();
  assert.equal(q.avgMs, 30_000);
  const { job } = q.enqueue("b", "2", req(2));
  assert.equal(q.etaSeconds(job), 30);
  await q.idle();
});

test("rate limiter allows 6 a minute per address", () => {
  let t = 0;
  const r = new RateLimiter({ now: () => t });
  for (let i = 0; i < 6; i++) assert.ok(r.hit("1.1.1.1"));
  assert.equal(r.hit("1.1.1.1"), false);
  assert.ok(r.hit("2.2.2.2"));
  t = 60_001;
  assert.ok(r.hit("1.1.1.1"));
});

async function serve(opts) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "stills-test-"));
  const { app, queue } = await createApp({ cacheDir: dir, log: quiet, publicUrl: "https://render.test", ...opts });
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, queue, dir,
    post: (body, ip = "9.9.9.9") => fetch(`${base}/api/stills`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }),
    close: async () => { server.close(); await rm(dir, { recursive: true, force: true }); },
  };
}

test("HTTP: queued, deduped, done, image served, sha alias", async () => {
  const gate = deferred();
  const s = await serve({ exportJob: async () => ({ credit: "c" }), renderJob: async () => { await gate.p; return { jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }; } });
  try {
    const r1 = await s.post(req(1));
    assert.equal(r1.status, 202);
    const b1 = await r1.json();
    const key = encodeKey(BUILD, cam(1));
    assert.equal(b1.key, key);
    assert.equal(b1.url, `https://render.test/stills/${key}.jpg`);
    assert.equal(b1.position, 1);
    assert.ok(["queued", "running"].includes(b1.status));
    assert.equal(typeof b1.etaSeconds, "number");
    const r2 = await s.post(req(1));
    assert.equal(r2.status, 202);
    assert.equal(s.queue.order.length, 1, "deduped");
    const pending = await fetch(`${s.base}/stills/${key}.jpg`);
    assert.equal(pending.status, 202);
    assert.equal((await pending.json()).key, key);
    gate.resolve();
    await s.queue.idle();
    const st = await (await fetch(`${s.base}/api/stills/${key}`)).json();
    assert.equal(st.status, "done");
    const img = await fetch(`${s.base}/stills/${key}.jpg`);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get("content-type"), "image/jpeg");
    assert.match(img.headers.get("cache-control"), /immutable/);
    const alias = await fetch(`${s.base}/stills/${keyHash(key)}.jpg`);
    assert.equal(alias.status, 200);
    const again = await s.post(req(1));
    assert.equal(again.status, 200);
    assert.equal((await again.json()).status, "done");
    const health = await (await fetch(`${s.base}/api/health`)).json();
    assert.deepEqual({ ok: health.ok, queue: health.queue, running: health.running, cache: health.cache }, { ok: true, queue: 0, running: 0, cache: 1 });
    assert.equal((await fetch(`${s.base}/stills/garbage.jpg`)).status, 404);
    assert.equal((await fetch(`${s.base}/api/stills/garbage`)).status, 404);
    assert.equal((await s.post({ build: BUILD })).status, 400);
  } finally { await s.close(); }
});

test("HTTP: 429 over 6 requests a minute from one address", async () => {
  const s = await serve({ exportJob: () => new Promise(() => {}), renderJob: async () => ({ jpeg: Buffer.alloc(0) }) });
  try {
    for (let i = 0; i < 6; i++) assert.equal((await s.post(req(1 + i / 10), "5.5.5.5")).status, 202);
    const r = await s.post(req(2), "5.5.5.5");
    assert.equal(r.status, 429);
    assert.ok((await r.json()).error);
    assert.equal((await s.post(req(2), "6.6.6.6")).status, 202, "other addresses unaffected");
  } finally { await s.close(); }
});

test("HTTP: 429 when 20 jobs are in line", async () => {
  const s = await serve({ rateLimit: 1000, exportJob: () => new Promise(() => {}), renderJob: async () => ({ jpeg: Buffer.alloc(0) }) });
  try {
    for (let i = 0; i < 20; i++) assert.equal((await s.post(req(1 + i / 10))).status, 202);
    const r = await s.post(req(5));
    assert.equal(r.status, 429);
    assert.match((await r.json()).error, /full/);
  } finally { await s.close(); }
});

test("HTTP: errors come back as status error; CORS preflight", async () => {
  const s = await serve({ allowedOrigins: ["https://shop.test"], exportJob: async () => { throw new Error("no webgl"); }, renderJob: async () => ({ jpeg: Buffer.alloc(0) }) });
  try {
    const { key } = await (await s.post(req(1))).json();
    await s.queue.idle();
    const st = await (await fetch(`${s.base}/api/stills/${key}`)).json();
    assert.deepEqual([st.status, st.error], ["error", "no webgl"]);
    const pre = await fetch(`${s.base}/api/stills`, { method: "OPTIONS", headers: { origin: "https://shop.test", "access-control-request-method": "POST", "access-control-request-headers": "content-type" } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("access-control-allow-origin"), "https://shop.test");
    const other = await fetch(`${s.base}/api/health`, { headers: { origin: "https://evil.test" } });
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  } finally { await s.close(); }
});

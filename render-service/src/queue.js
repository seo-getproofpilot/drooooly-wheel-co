/* In-memory FIFO for still jobs. Two stages: export (headless Chromium hands
   over the glTF) and render (Blender, then the JPEG encode). One render runs
   at a time; the next job's export runs while the current one renders, and at
   most one exported job waits for Blender. Identical keys share one job. A
   failed job is marked "error" and never stops the queue. */

export class QueueFullError extends Error {
  constructor() { super("The render queue is full. Try again in a few minutes."); this.name = "QueueFullError"; }
}

/**
 * @typedef {{ build: string, camera: import("./key.js").Camera }} StillRequest
 * @typedef {{
 *   key: string, hash: string, request: StillRequest,
 *   status: "queued" | "running" | "done" | "error", error?: string,
 *   enqueuedAt: number, exported?: unknown, exporting?: boolean, rendering?: boolean,
 *   timings: { exportMs?: number, renderMs?: number, encodeMs?: number },
 * }} Job
 */

export class RenderQueue {
  /**
   * @param {{
   *   exportJob: (job: Job) => Promise<unknown>,
   *   renderJob: (job: Job, exported: any) => Promise<{ renderMs?: number, encodeMs?: number } | void>,
   *   maxQueued?: number, initialAvgMs?: number, retryAfterMs?: number,
   *   now?: () => number, log?: (line: string) => void,
   * }} opts
   */
  constructor(opts) {
    this.exportJob = opts.exportJob;
    this.renderJob = opts.renderJob;
    this.maxQueued = opts.maxQueued ?? 20;
    this.retryAfterMs = opts.retryAfterMs ?? 60_000;
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? ((l) => console.log(l));
    /** @type {Map<string, Job>} */
    this.jobs = new Map();
    /** @type {Job[]} active jobs, oldest first */
    this.order = [];
    /** @type {number[]} recent render stage durations (render + encode), ms */
    this.samples = [];
    this.initialAvgMs = opts.initialAvgMs ?? 90_000;
    this.exportBusy = false;
    this.renderBusy = false;
    /** @type {Set<() => void>} */
    this.idleWaiters = new Set();
  }

  get avgMs() {
    return this.samples.length ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length : this.initialAvgMs;
  }

  get queued() { return this.order.filter((j) => j.status === "queued").length; }
  get running() { return this.order.filter((j) => j.status === "running").length; }

  /** @param {string} key */
  get(key) { return this.jobs.get(key); }

  /** 1 for the job at the head of the line. */
  position(job) { const i = this.order.indexOf(job); return i < 0 ? 0 : i + 1; }

  etaSeconds(job) { return Math.max(5, Math.round((this.position(job) * this.avgMs) / 1000)); }

  /**
   * Adds a job, or returns the one already in line for this key. An errored
   * key is tried again when `retry` is set or the error is old enough.
   * @param {string} key @param {string} hash @param {StillRequest} request
   * @param {{ retry?: boolean }} [opts]
   * @returns {{ job: Job, created: boolean }}
   */
  enqueue(key, hash, request, opts = {}) {
    const old = this.jobs.get(key);
    if (old && (old.status === "queued" || old.status === "running")) return { job: old, created: false };
    if (old && old.status === "error" && !opts.retry && this.now() - (old.failedAt ?? 0) < this.retryAfterMs) return { job: old, created: false };
    if (this.order.length >= this.maxQueued) throw new QueueFullError();
    /** @type {Job} */
    const job = { key, hash, request, status: "queued", enqueuedAt: this.now(), timings: {} };
    this.jobs.set(key, job);
    this.order.push(job);
    this.pump();
    return { job, created: true };
  }

  pump() {
    // render first, so a finished export moves to Blender before the next export is weighed
    if (!this.renderBusy) {
      const next = this.order.find((j) => j.exported !== undefined && !j.rendering);
      if (next) this.#render(next);
    }
    if (!this.exportBusy) {
      const waiting = this.order.filter((j) => j.exported !== undefined && !j.rendering).length;
      const next = this.order.find((j) => j.exported === undefined && !j.exporting);
      if (next && waiting === 0) this.#export(next);
    }
    if (!this.order.length && !this.exportBusy && !this.renderBusy) {
      for (const f of this.idleWaiters) f();
      this.idleWaiters.clear();
    }
  }

  /** Resolves when nothing is queued or running (tests, shutdown). */
  idle() {
    if (!this.order.length && !this.exportBusy && !this.renderBusy) return Promise.resolve();
    return new Promise((r) => this.idleWaiters.add(r));
  }

  #export(job) {
    this.exportBusy = true;
    job.exporting = true;
    job.status = "running";
    const t0 = this.now();
    Promise.resolve().then(() => this.exportJob(job)).then((exported) => {
      job.timings.exportMs = this.now() - t0;
      job.exported = exported ?? true;
    }, (e) => this.#fail(job, "export", e)).finally(() => {
      job.exporting = false;
      this.exportBusy = false;
      this.pump();
    });
  }

  #render(job) {
    this.renderBusy = true;
    job.rendering = true;
    job.status = "running";
    const t0 = this.now();
    const exported = job.exported;
    Promise.resolve().then(() => this.renderJob(job, exported)).then((t) => {
      Object.assign(job.timings, t || {});
      const ms = this.now() - t0;
      this.samples.push(ms);
      if (this.samples.length > 10) this.samples.shift();
      job.status = "done";
      this.#remove(job);
      this.jobs.delete(job.key);
      const { exportMs = 0, renderMs = 0, encodeMs = 0 } = job.timings;
      this.log(`still done ${job.hash.slice(0, 12)} export ${exportMs} ms render ${renderMs} ms encode ${encodeMs} ms total ${this.now() - job.enqueuedAt} ms`);
    }, (e) => this.#fail(job, "render", e)).finally(() => {
      job.rendering = false;
      job.exported = undefined;
      this.renderBusy = false;
      this.pump();
    });
  }

  #fail(job, stage, e) {
    job.status = "error";
    job.error = shortError(e);
    job.failedAt = this.now();
    job.exported = undefined;
    this.#remove(job);
    this.log(`still error ${job.hash.slice(0, 12)} ${stage}: ${job.error} export ${job.timings.exportMs ?? "-"} ms`);
    // keep the last 200 failures for status reads
    const errs = [...this.jobs.values()].filter((j) => j.status === "error");
    for (const j of errs.slice(0, Math.max(0, errs.length - 200))) this.jobs.delete(j.key);
  }

  #remove(job) {
    const i = this.order.indexOf(job);
    if (i >= 0) this.order.splice(i, 1);
  }
}

/** @param {unknown} e */
export function shortError(e) {
  const m = e instanceof Error ? e.message : String(e);
  return m.split("\n")[0].slice(0, 200) || "render failed";
}

/** Sliding one-minute window per client address. */
export class RateLimiter {
  /** @param {{ limit?: number, windowMs?: number, now?: () => number }} [o] */
  constructor(o = {}) {
    this.limit = o.limit ?? 6;
    this.windowMs = o.windowMs ?? 60_000;
    this.now = o.now ?? Date.now;
    /** @type {Map<string, number[]>} */
    this.hits = new Map();
  }

  /** Records a request; false when the client is over the limit. */
  hit(ip) {
    const t = this.now();
    const list = (this.hits.get(ip) ?? []).filter((x) => t - x < this.windowMs);
    if (list.length >= this.limit) { this.hits.set(ip, list); return false; }
    list.push(t);
    this.hits.set(ip, list);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((x) => t - x < this.windowMs)) this.hits.delete(k);
    return true;
  }
}

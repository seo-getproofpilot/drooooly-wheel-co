#!/usr/bin/env node
/* Scrapes JTX Forged's published "Available Sizes" into data/specs/jtx-sizes.json.
   node tools/scrape-jtx-sizes.js  [--dry]

   Why this exists: brands.js carried three size-lists across 154 JTX models —
   the alphabetically-first model's sizes copied onto everything else by
   build-featured.js. JTX publish 18 sizes for every single-series wheel. This
   file goes and asks them.

   It is deliberately a CONSENSUS scraper, not a checker against an expected
   list. Hardcoding "we expect 18 sizes" would just move the invention here.
   Instead it reads every product page, groups them by what they say, and
   refuses to write anything if the pages disagree — because a disagreement
   means either JTX changed something or our parser is wrong, and both need a
   human. Consensus across 80+ pages is the evidence; the JSON records it.

   THE TRAP: every product page carries the size list TWICE. The second copy
   lives in a section marked `elementor-hidden-desktop` and is stale (14 sizes;
   JTX forgot to update it when they added the 20s and 24x16). Taking the first
   or last match gets this silently wrong, so we drop hidden-desktop sections
   and then independently assert the survivor is a superset of what we dropped. */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "specs", "jtx-sizes.json");
const DRY = process.argv.includes("--dry");
const USE_CACHE = process.argv.includes("--cache");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const INDEX = {
  single: "https://jtxforged.com/single-series/",
  dually: "https://jtxforged.com/dually-series/",
};
/* 4 at a time. Serial would take ~4 minutes for 150 pages and this is a
   WordPress site behind a CDN; four concurrent reads is well inside what a
   browser opening the same catalogue would do. */
const CONCURRENCY = 4;

/* ---------- fetch ---------- */
async function get(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
      if (r.status === 404) return null;              // model has no page — not an error
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } catch (e) {
      if (i === tries) throw new Error(url + " — " + e.message);
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

/* ---------- html ---------- */
const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'", "&nbsp;": " " };
function unescapeHtml(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
          .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
          .replace(/&(amp|lt|gt|quot|#039|nbsp);/g, (m) => ENT[m]);
}
function text(html) { return unescapeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " "); }

/* Split on <section boundaries and drop the ones whose opening tag carries
   elementor-hidden-desktop. Sections nest, so a "piece" runs from one <section
   to the next — which is enough here because no further <section opens between
   the stale block's own tag and its content. The superset check below is the
   independent confirmation that this reasoning held. */
function splitSections(html) {
  const parts = html.split(/(?=<section)/i);
  const keep = [], dropped = [];
  for (const p of parts) {
    const openTag = p.slice(0, p.indexOf(">") + 1 || 400);
    (/elementor-hidden-desktop/i.test(openTag) ? dropped : keep).push(p);
  }
  return { keep: keep.join(""), dropped: dropped.join("") };
}

const SIZE_RE = /(\d{2})\s*[x×]\s*(\d{1,2}(?:\.\d+)?)/gi;
function parseSizes(s) {
  const out = [];
  let m;
  SIZE_RE.lastIndex = 0;
  while ((m = SIZE_RE.exec(s))) out.push([+m[1], +m[2]]);
  return out;
}
/* Stable signature so pages can be grouped by what they actually say. */
function sig(pairs) {
  return [...new Set(pairs.map((p) => p[0] + "x" + p[1]))].sort((a, b) => {
    const [ad, aw] = a.split("x").map(Number), [bd, bw] = b.split("x").map(Number);
    return ad - bd || aw - bw;
  }).join(", ");
}
function toRole(pairs) {
  const r = {};
  for (const [d, w] of pairs) {
    (r[d] = r[d] || []);
    if (!r[d].includes(w)) r[d].push(w);
  }
  for (const k of Object.keys(r)) r[k].sort((a, b) => a - b);
  return r;
}

/* ---------- per-page extraction ---------- */
function extractSingle(html, url) {
  const { keep, dropped } = splitSections(html);
  const grab = (chunk) => {
    const t = text(chunk);
    const i = t.indexOf("Available Sizes");
    if (i < 0) return null;
    // Stop at the disclaimer that always follows the list.
    const tail = t.slice(i, i + 700).split(/Product image|Vehicle specific/i)[0];
    return parseSizes(tail);
  };
  const live = grab(keep);
  if (!live || !live.length) return { url, error: "no Available Sizes in desktop markup" };
  const stale = grab(dropped);
  let note = null;
  if (stale && stale.length) {
    const liveSet = new Set(live.map((p) => p.join("x")));
    const extra = stale.filter((p) => !liveSet.has(p.join("x")));
    // If the hidden copy carries sizes the visible one lacks, our section
    // reasoning is wrong and the "desktop is authoritative" call needs a human.
    if (extra.length) note = "hidden-desktop block had extra sizes: " + sig(extra);
  }
  return { url, sizes: live, note };
}

function extractDually(html, url) {
  const t = text(splitSections(html).keep);
  const i = t.indexOf("Available Sizes");
  if (i < 0) return { url, error: "no Available Sizes" };
  const blob = t.slice(i, i + 1200);
  const cut = (from, to) => {
    const a = blob.search(from);
    if (a < 0) return null;
    const rest = blob.slice(a);
    const b = to ? rest.slice(1).search(to) : -1;
    return b < 0 ? rest : rest.slice(0, b + 1);
  };
  const std = cut(/Front\s*[–-]\s*Standard/i, /Front\s*[–-]\s*Super\s*Single/i);
  const ss = cut(/Front\s*[–-]\s*Super\s*Single/i, /Rear\s*[–-]|Product image/i);
  if (!std || !ss) return { url, error: "could not find both Front groups" };
  const rear = /All rear wheels\s*([\d.]+)\s*wide/i.exec(blob);
  return {
    url,
    standard: parseSizes(std),
    superSingle: parseSizes(ss),
    rearWidth: rear ? +rear[1] : null,
  };
}

/* ---------- consensus ----------
   Group pages by what they actually published. A role that every page agrees on
   is stored once for the line; a role they disagree on is stored per model.
   Which of those it is, is JTX's decision to make, not ours to assume — the
   first pass through this assumed the dually lists were line-wide because nine
   sampled pages agreed, and 69 pages later that turned out to be false. */
function analyze(label, rows, pick) {
  const groups = new Map();
  for (const r of rows) {
    const s = sig(pick(r));
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s).push(r.slug);
  }
  const ordered = [...groups].sort((a, b) => b[1].length - a[1].length);
  if (groups.size === 1) {
    console.log(`  ${label}: all ${rows.length} pages agree — ${ordered[0][0].split(", ").length} sizes`);
  } else {
    console.log(`  ${label}: ${groups.size} distinct lists across ${rows.length} pages — stored per model`);
    for (const [s, slugs] of ordered) {
      console.log(`      [${String(slugs.length).padStart(3)}] ${s}`);
      console.log(`            ${slugs.slice(0, 10).join(", ")}${slugs.length > 10 ? ", …" : ""}`);
    }
  }
  return {
    uniform: groups.size === 1,
    value: pick(rows[0]),
    variants: ordered.map(([s, slugs]) => ({ sizes: s, count: slugs.length, models: slugs })),
  };
}

/* ---------- main ---------- */
(async function main() {
  const CACHE = path.join(ROOT, ".jtx-scrape-cache.json");
  let results;

  if (USE_CACHE && fs.existsSync(CACHE)) {
    results = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    console.log(`Using cached scrape (${results.single.length} single, ${results.dually.length} dually).`);
    console.log("Drop --cache to re-fetch from jtxforged.com.\n");
  } else {
    console.log("Reading JTX series indexes…");
    const slugs = {};
    for (const [kind, url] of Object.entries(INDEX)) {
      const html = await get(url);
      if (!html) throw new Error("index missing: " + url);
      const re = new RegExp("jtxforged\\.com/([a-z0-9-]+)-" + kind + "/", "gi");
      slugs[kind] = [...new Set([...html.matchAll(re)].map((m) => m[1]))].sort();
      console.log(`  ${kind}: ${slugs[kind].length} product pages listed`);
    }

    results = {};
    for (const kind of ["single", "dually"]) {
      console.log(`\nFetching ${slugs[kind].length} ${kind} pages…`);
      const rows = await pool(slugs[kind], async (slug) => {
        const url = `https://jtxforged.com/${slug}-${kind}/`;
        const html = await get(url);
        if (!html) return { slug, url, error: "404" };
        const r = kind === "single" ? extractSingle(html, url) : extractDually(html, url);
        return Object.assign({ slug }, r);
      });
      rows.filter((r) => r.error).forEach((r) => console.log(`  !! ${r.slug}: ${r.error}`));
      rows.filter((r) => r.note).forEach((r) => console.log(`  ?? ${r.slug}: ${r.note}`));
      const good = rows.filter((r) => !r.error);
      if (!good.length) { console.error("ERROR: no usable " + kind + " pages."); process.exit(1); }
      console.log(`  parsed ${good.length}/${rows.length}`);
      results[kind] = good;
    }
    fs.writeFileSync(CACHE, JSON.stringify(results));
  }

  console.log("\nWhat the pages say:");
  const single = analyze("single", results.single, (r) => r.sizes);
  const front = analyze("dually front standard", results.dually, (r) => r.standard);
  const superS = analyze("dually front super single", results.dually, (r) => r.superSingle);

  const rearWidths = [...new Set(results.dually.map((r) => r.rearWidth).filter((w) => w != null))];
  if (rearWidths.length !== 1) {
    console.error("ERROR: rear width not unanimous: " + JSON.stringify(rearWidths));
    process.exit(1);
  }
  console.log(`  rear width: ${rearWidths[0]}" on all ${results.dually.length} pages`);

  /* Uniform roles are stored once; anything that varies is stored per model, so
     the file never claims more uniformity than the pages support. */
  const roles = {};
  if (single.uniform) roles.single = toRole(single.value);
  if (front.uniform) roles.duallyFront = toRole(front.value);
  if (superS.uniform) roles.superSingle = toRole(superS.value);

  const models = {};
  const put = (slug, key, val) => { (models[slug] = models[slug] || {})[key] = toRole(val); };
  if (!single.uniform) results.single.forEach((r) => put(r.slug, "single", r.sizes));
  if (!front.uniform) results.dually.forEach((r) => put(r.slug, "duallyFront", r.standard));
  if (!superS.uniform) results.dually.forEach((r) => put(r.slug, "superSingle", r.superSingle));

  const payload = {
    id: "jtx-published-sizes",
    captured: new Date().toISOString().slice(0, 10),
    generator: "tools/scrape-jtx-sizes.js",
    _note_shape:
      "`roles` holds a list every product page agreed on, so it applies line-wide. " +
      "`models` holds lists that vary style to style, keyed by JTX's own page slug. " +
      "Look up `models[slug][role]` first and fall back to `roles[role]`. Which bucket a " +
      "role lands in is measured on every run, never assumed.",
    _note_stale_mobile:
      "Product pages carry the size list twice. The copy inside an elementor-hidden-desktop " +
      "section is stale (14 sizes, missing the 20s and 24x16) and is a strict subset of the " +
      "desktop block. The generator drops hidden-desktop sections, then asserts the survivor " +
      "is a superset of what it dropped.",
    _note_offsets:
      "JTX publish no offset anywhere — every product page defers to a salesperson. Offsets " +
      "live in offsets.json as researched real-world figures and never come from here.",
    sources: [INDEX.single, INDEX.dually, results.single[0].url, results.dually[0].url],
    pagesScraped: { single: results.single.length, dually: results.dually.length },
    verifiedPages: {
      single: results.single.map((r) => r.slug),
      dually: results.dually.map((r) => r.slug),
    },
    variants: {
      single: single.variants,
      duallyFront: front.variants,
      superSingle: superS.variants,
    },
    roles,
    models,
    rearWidth: rearWidths[0],
    customSizes: {
      offered: true,
      source: results.single[0].url,
      quote: "If you don't see your size, feel free to ask in the comment section below!",
    },
    customProfile: {
      offered: true,
      source: results.dually[0].url,
      quote: "Super Single Dually Wheels also available in concave.",
    },
    disclaimer: {
      source: results.single[0].url,
      _why: "JTX's own words, kept verbatim — they say the same thing CLAUDE.md rule 1 requires of us.",
      quote: "Product image shown not representative of all configurations. Vehicle specific " +
        "fitment may vary. Please contact your JTX Forged salesperson for vehicle-specific details.",
    },
  };

  if (DRY) {
    console.log("\n--dry: nothing written.");
    console.log("  line-wide roles: " + (Object.keys(roles).join(", ") || "(none)"));
    console.log("  per-model roles: " + (Object.keys(models).length
      ? [...new Set(Object.values(models).flatMap(Object.keys))].join(", ") +
        ` (${Object.keys(models).length} models)` : "(none)"));
    return;
  }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`\ndata/specs/jtx-sizes.json written — ${kb} KB.`);
  console.log("  line-wide: " + (Object.keys(roles).join(", ") || "(none)"));
  console.log("  per-model: " + (Object.keys(models).length
    ? `${Object.keys(models).length} models` : "(none)"));
  console.log("Next: node tools/build-specs.js && node tools/build-featured.js");
})().catch((e) => { console.error("\nERROR: " + e.message); process.exit(1); });

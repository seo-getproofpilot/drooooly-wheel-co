#!/usr/bin/env node
/* ============================================================
   DROOOLY — UTV / sand wheel scraper
   Writes data/specs/utv-models.json

   Why this exists
   ---------------
   The catalog is a lifted-truck catalog: 756 models, smallest
   diameter 16". A side-by-side runs 14" and 15" on 4x137 (Can-Am)
   or 4x156 (Polaris); a sand car runs 15" on 5x114.3. We carried
   none of it, so a "Side-by-sides & sand" lane would have been a
   door onto an empty room.

   Two brands already in the catalog — Method and Raceline — build
   the real thing. Both run Shopify, so /collections/<c>/products.json
   is the manufacturer's own published spec: model, size, bolt
   pattern, offset, SKU. No inference, no filling in the blanks.
   Same standard as tools/scrape-jtx-sizes.js: if the source doesn't
   say it, we don't write it.

   Usage:  node tools/scrape-utv.js
   Then:   node tools/build-featured.js   (merges into brands.js)
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const SOURCES = [
  { slug: "method",   host: "https://methodracewheels.com",   coll: "utv-wheels" },
  { slug: "method",   host: "https://methodracewheels.com",   coll: "utv-beadlock-wheels" },
  { slug: "raceline", host: "https://www.racelinewheels.com", coll: "utv-atv" },
];

function fetchJSON(url) {
  const raw = execFileSync("curl", ["-sS", "-L", "--max-time", "40", "-A", UA, url], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

/* Bolt patterns arrive in whichever unit the brand publishes. Method writes
   the common truck ones in inches ("5x4.5"), the UTV-native ones in mm
   ("4x156"). The catalog is metric everywhere else, so convert rather than
   letting one lane speak a different language. Only conversions we are sure
   of — an unrecognised inch pattern is passed through untouched, not guessed. */
const INCH_TO_MM = { "4.5": "114.3", "5.5": "139.7", "4.25": "108", "5": "127" };
function normBolt(s) {
  const m = /^(\d+)\s*[xX]\s*([\d.]+)$/.exec(String(s).trim());
  if (!m) return null;
  const [, n, v] = m;
  if (+v < 20) return INCH_TO_MM[v] ? `${n}x${INCH_TO_MM[v]}` : `${n}x${v}`;
  return `${n}x${v}`;
}
const normSize = (s) => {
  const m = /^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)$/.exec(String(s).trim());
  return m ? `${+m[1]}x${+m[2]}` : null;
};

// Closeouts, markdown duplicates and sale re-listings of a wheel we already
// have. They carry the same specs under a second title and would show twice.
const isNoise = (p) =>
  /markdown|\*\*\*/i.test(p.title) ||
  /package/i.test(p.product_type || "") ||
  /sale item/i.test(p.product_type || "");

/* A variant option value is a pipe-joined record, e.g.
   "15x10 | 4x156 | 25mm/6+4 | MR413510461164B". Field 0 is the size and
   field 1 is the bolt pattern on both sites. Anything that doesn't parse as
   a size is skipped rather than coerced. */
function specsFromVariants(p) {
  const sizes = new Set(), bolts = new Set();
  let low = null;
  for (const v of p.variants || []) {
    const parts = String(v.title || "").split("|").map((x) => x.trim());
    const sz = normSize(parts[0]);
    if (!sz) continue;
    sizes.add(sz);
    const b = normBolt(parts[1]);
    if (b) bolts.add(b);
    /* The manufacturer's own advertised price, per wheel. Worth carrying:
       without it catalog.js falls back to priceEach(), which is a formula
       over brand kind and diameter with a hash for jitter — it produces a
       number, not a price. Availability gates display, not this file. */
    const n = parseFloat(v.price);
    if (v.available !== false && n > 0 && (low === null || n < low)) low = n;
  }
  return { sizes, bolts, low };
}

/* Method puts the finish in the title; Raceline puts it in the image
   filename ("...-wheel-5lug-gloss-black-15x6-1000.png"). Both are the
   manufacturer's own words. */
const TITLECASE = (s) =>
  s.replace(/\s+/g, " ").trim().split(" ")
   .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");

function finishesFromImages(p) {
  const out = new Set();
  for (const im of p.images || []) {
    const name = (im.src || "").split("/").pop().split("?")[0];
    const m = /-wheel-\d+lug-([a-z-]+?)-\d+x\d/.exec(name);
    if (m) out.add(TITLECASE(m[1].replace(/-/g, " ")));
  }
  return out;
}

function parseMethod(p) {
  // "401-R | UTV Beadlock | High Offset | Machined - Raw"
  const seg = p.title.split("|").map((s) => s.replace(/®/g, "").trim()).filter(Boolean);
  if (seg.length < 3) return null;
  return { model: `${seg[0]} ${seg[1]}`, finish: seg[seg.length - 1] };
}

/* Raceline names the UTV line by code family: "A15GB Omega Beadlock" is the
   gloss-black A15 Omega. Keep the family code in the model name.

   Not cosmetic. Raceline builds a truck Hostage (17x9, 18x9) AND a UTV A92
   Hostage (14x7) — different wheels, same word. Merging on the bare name
   overwrote the truck one, taking its sizes, finishes, price and featured
   rank with it. The code is how Raceline tells them apart, so we do too. */
function parseRaceline(p) {
  const m = /^(A\d+)[A-Z]*\s*-?\s*(.+)$/.exec(p.title.replace(/\s+/g, " ").trim());
  if (!m) return null;
  return { model: `${m[1]} ${m[2].trim()}`, finish: null };
}

const add = (set, it) => it.forEach((x) => set.add(x));
const byBrand = { method: new Map(), raceline: new Map() };
const stats = [];

for (const src of SOURCES) {
  const url = `${src.host}/collections/${src.coll}/products.json?limit=250`;
  const products = fetchJSON(url).products || [];
  let kept = 0;
  for (const p of products) {
    if (isNoise(p)) continue;
    const parsed = src.slug === "method" ? parseMethod(p) : parseRaceline(p);
    if (!parsed) continue;
    const { sizes, bolts, low } = specsFromVariants(p);
    if (!sizes.size) continue;               // no published size = nothing to say
    kept++;
    const bucket = byBrand[src.slug];
    if (!bucket.has(parsed.model)) {
      bucket.set(parsed.model, {
        model: parsed.model, sizes: new Set(), bolts: new Set(), finishes: new Set(),
        url: `${src.host}/products/${p.handle}`,
        img: (p.images && p.images[0] && p.images[0].src) || null,
        priceFrom: null,
      });
    }
    const e = bucket.get(parsed.model);
    add(e.sizes, sizes); add(e.bolts, bolts);
    if (low !== null && (e.priceFrom === null || low < e.priceFrom)) e.priceFrom = low;
    if (parsed.finish) e.finishes.add(parsed.finish);
    else add(e.finishes, finishesFromImages(p));
  }
  stats.push(`${src.slug}/${src.coll}: ${products.length} products, ${kept} wheels kept`);
}

const numSort = (a, b) => {
  const pa = a.split("x").map(Number), pb = b.split("x").map(Number);
  return pa[0] - pb[0] || pa[1] - pb[1];
};
const out = { _generated: new Date().toISOString().slice(0, 10), _sources: SOURCES.map((s) => `${s.host}/collections/${s.coll}`), brands: {} };
for (const [slug, bucket] of Object.entries(byBrand)) {
  out.brands[slug] = [...bucket.values()]
    .map((e) => ({
      model: e.model,
      sizes: [...e.sizes].sort(numSort),
      bolts: [...e.bolts].sort(),
      finishes: [...e.finishes].sort(),
      priceFrom: e.priceFrom === null ? null : Math.round(e.priceFrom),
      url: e.url, img: e.img,
    }))
    .sort((a, b) => a.model.localeCompare(b.model));
}

const dest = path.join(ROOT, "data/specs/utv-models.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");

stats.forEach((s) => console.log("  " + s));
for (const [slug, list] of Object.entries(out.brands)) {
  console.log(`\n${slug}: ${list.length} models`);
  list.forEach((m) => console.log(`   ${m.model.padEnd(30)} ${(m.priceFrom ? "$" + m.priceFrom : "$  ?").padStart(5)}  ${m.sizes.join(" ")}  [${m.bolts.join(" ")}]  ${m.finishes.join(", ") || "(no finish published)"}`));
}
console.log(`\nwrote ${path.relative(ROOT, dest)}`);

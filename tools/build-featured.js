#!/usr/bin/env node
/* ============================================================
   DROOOLY — featured-wheel builder
   Reads data/featured/<brand-slug>.json  ([{model, url, configs?}])
   1. downloads each product photo from the manufacturer
   2. writes assets/wheels/<slug>/<modelslug>.png
   3. merges into brands.js: sets img + feat rank, adding the model
      if our catalog doesn't already have it under that name

   The name and the photo come from the SAME manufacturer page, so
   they can't drift apart the way a separate name list does.

   Usage:  node tools/build-featured.js [brand-slug ...]     (default: all)
   Then:   node tools/optimize-wheels.js                     (resize/quantize)
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Manufacturer part code, e.g. "KD006 Blitz" and "Blitz (KD006)" -> "KD006".
// Lets us recognize a model we already carry under a differently-formatted
// name instead of adding a near-duplicate card.
const code = (s) => {
  const m = String(s).toUpperCase().match(/\b([A-Z]{1,4}\d{2,4})\b/);
  return m ? m[1] : null;
};

// Config inference from the suffix codes brands use in model names.
function inferConfigs(model) {
  if (/\b(SD|DRW|DBO|DUALLY)\b/i.test(model)) return ["dually", "super single"];
  if (/\b(SS|SSBR|SUPER\s*SINGLE)\b/i.test(model)) return ["single", "super single"];
  return ["single"];
}

function download(url, dest) {
  try {
    const code = execFileSync("curl", [
      "-sS", "-L", "--max-time", "30", "-A", UA, "-o", dest, "-w", "%{http_code}", url,
    ], { encoding: "utf8" }).trim();
    if (code !== "200" || !fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
      fs.existsSync(dest) && fs.unlinkSync(dest);
      return code;
    }
    return "200";
  } catch (e) {
    fs.existsSync(dest) && fs.unlinkSync(dest);
    return "ERR";
  }
}

// Convert freshly downloaded "<name>.raw.<ext>" into an optimized "<name>.png".
// Photos that arrive opaque (JPEGs, some PNGs) sit on a white studio
// background, which shows as a white box against our card gradient. Flood
// fill inward from the edges to knock it out — edge-seeded rather than a
// global white threshold so the chrome highlights INSIDE the wheel survive.
const NORMALIZE_PY = `
from PIL import Image, ImageDraw
import os, sys

def debg(im, tol=30):
    """Knock out a white studio background.

    Samples the whole border, not just the four corners: product photos
    often bleed off one edge, which made an all-corners test bail and
    leave the white box in place. Only light border points are used as
    flood seeds, so interior chrome highlights survive.
    """
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    pts = []
    for i in range(0, w, max(1, w // 24)):
        pts += [(i, 0), (i, h - 1)]
    for j in range(0, h, max(1, h // 24)):
        pts += [(0, j), (w - 1, j)]
    light = [p for p in pts if px[p][0] > 228 and px[p][1] > 228 and px[p][2] > 228]
    if len(light) < len(pts) * 0.45:
        return im
    for s in light:
        try: ImageDraw.floodfill(im, s, (0,0,0,0), thresh=tol)
        except Exception: pass
    return im

for raw in sys.argv[1:]:
    dest = raw.replace('.raw.', '.').rsplit('.', 1)[0] + '.png'
    im = Image.open(raw).convert('RGBA')
    if min(im.getchannel('A').getdata()) > 250:
        im = debg(im)
    im.thumbnail((680, 680), Image.LANCZOS)
    im.quantize(colors=255, method=Image.FASTOCTREE).save(dest, optimize=True)
    os.remove(raw)
`;
function normalize(files) {
  execFileSync("python3", ["-c", NORMALIZE_PY, ...files], { stdio: "inherit" });
}

global.window = {};
require(path.join(ROOT, "brands.js"));
const BRANDS = window.BRANDS;

const dir = path.join(ROOT, "data/featured");
const only = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
  .filter((f) => !only.length || only.includes(path.basename(f, ".json")));

let totalNew = 0, totalImg = 0;
for (const file of files) {
  const slug = path.basename(file, ".json");
  const brand = BRANDS.find((b) => b.slug === slug);
  if (!brand) { console.log(`!! no brand "${slug}" in brands.js — skipped`); continue; }

  const entries = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const outDir = path.join(ROOT, "assets/wheels", slug);
  fs.mkdirSync(outDir, { recursive: true });

  // Defaults borrowed from an existing model so new entries stay consistent.
  // The data file is the whole truth for this brand's featured set. Clear
  // prior ranks first, otherwise styles dropped from the file stay featured
  // — and keep showing without whatever the new file adds (e.g. pricing).
  brand.models.forEach((m) => { delete m.feat; });

  const proto = brand.models[0] || {};
  const byName = {}, byCode = {};
  brand.models.forEach((m) => {
    byName[norm(m.model)] = m;
    const c = code(m.model);
    if (c) byCode[c] = m;
  });

  let got = 0, added = 0, failed = [], pending = [], noSizes = [];
  entries.forEach((e, i) => {
    const mslug = norm(e.model);
    // Always record .png — whatever the source format, normalize() below
    // converts it, so brands.js paths can't drift from what's on disk.
    const rel = `assets/wheels/${slug}/${mslug}.png`;
    const abs = path.join(ROOT, rel);
    const ext = (e.url.match(/\.(png|jpe?g|webp)(?:\?|$)/i) || [, "png"])[1].toLowerCase();
    const raw = path.join(outDir, `${mslug}.raw.${ext}`);

    let ok = fs.existsSync(abs);
    if (!ok) {
      ok = download(e.url, raw) === "200";
      if (ok) pending.push(raw);
    }
    if (!ok) { failed.push(e.model); return; }
    got++;

    const c = code(e.model);
    let m = byName[mslug] || (c && byCode[c]);
    if (m) {
      // We already carry it — adopt the manufacturer's spelling as canonical.
      m.model = e.model;
      if (e.configs) m.configs = e.configs;
    } else {
      m = {
        model: e.model,
        configs: e.configs || inferConfigs(e.model),
        // No literal fallback. A hardcoded size list here is how 154 JTX models
        // ended up sharing three invented size-lists — CLAUDE.md is explicit
        // that product data is file-driven. An empty list renders as "sizes not
        // published"; a wrong one renders as a lie.
        sizes: e.sizes || [],
        finishes: e.finishes || proto.finishes || ["Polished", "Black"],
      };
      if (!m.sizes.length) noSizes.push(e.model);
      brand.models.push(m);
      added++;
    }
    byName[norm(m.model)] = m;
    if (c) byCode[c] = m;
    m.img = rel;
    m.feat = i + 1;
    if (typeof e.priceFrom === "number") m.priceFrom = e.priceFrom;
    if (typeof e.priceSet === "number") m.priceSet = e.priceSet;
    if (typeof e.priceSetQty === "number") m.priceSetQty = e.priceSetQty;
    // Bolt patterns this style is actually offered in. Cast wheels have a
    // fixed pattern per SKU; forged are drilled to order, so those carry the
    // brand-level list instead. Never inferred — fitment has to be sourced.
    if (e.bolts) m.bolts = e.bolts;

    // Optional per-finish renders: [{finish, url}]. The default photo is
    // finish #1 so the card always has something to show.
    if (e.variants && e.variants.length) {
      const imgs = [];
      e.variants.forEach((v) => {
        const fslug = norm(v.finish);
        const vrel = `assets/wheels/${slug}/${mslug}--${fslug}.png`;
        const vabs = path.join(ROOT, vrel);
        const vext = (v.url.match(/\.(png|jpe?g|webp)(?:\?|$)/i) || [, "png"])[1].toLowerCase();
        const vraw = path.join(outDir, `${mslug}--${fslug}.raw.${vext}`);
        let vok = fs.existsSync(vabs);
        if (!vok) {
          vok = download(v.url, vraw) === "200";
          if (vok) pending.push(vraw);
        }
        if (vok) imgs.push({ finish: v.finish, img: vrel });
        else failed.push(`${e.model} (${v.finish})`);
      });
      if (imgs.length) {
        m.imgs = imgs;
        m.img = imgs[0].img;
      }
    }
  });

  if (pending.length) normalize(pending);

  // Collapse models that are the same wheel under two spellings
  // ("Blitz (KD006)" + "KD006 Blitz"). Keep the featured/photographed one.
  const groups = new Map();
  brand.models.forEach((m) => {
    const c = code(m.model);
    if (!c) return;
    (groups.get(c) || groups.set(c, []).get(c)).push(m);
  });
  const drop = new Set();
  let merged = 0;
  groups.forEach((list) => {
    if (list.length < 2) return;
    const score = (m) => (m.feat ? 4 : 0) + (m.img ? 2 : 0) + (m.model.length > 8 ? 1 : 0);
    list.sort((a, b) => score(b) - score(a));
    const keep = list[0];
    list.slice(1).forEach((m) => {
      keep.sizes = [...new Set([...keep.sizes, ...m.sizes])];
      keep.finishes = [...new Set([...keep.finishes, ...m.finishes])];
      keep.configs = [...new Set([...keep.configs, ...m.configs])];
      drop.add(m);
      merged++;
    });
  });
  if (merged) {
    brand.models = brand.models.filter((m) => !drop.has(m));
    console.log(`  merged ${merged} duplicate model${merged === 1 ? "" : "s"}`);
  }

  /* Published sizes, when we have them on file.

     data/specs/<slug>-sizes.json is written by a scraper that reads the
     manufacturer's own product pages, so this replaces guessed sizes with
     stated ones. It runs over EVERY model in the brand, not just the featured
     entries above — data/featured/jtx.json holds 24 entries against 154 JTX
     models, so the loop above would reach a sixth of them.

     A role is looked up per model first, then falls back to a line-wide list.
     Which roles are line-wide is measured by the scraper, never assumed here:
     JTX publish one single-series list for the whole line but vary the dually
     front list from style to style. */
  const sizesFile = path.join(ROOT, "data/specs", `${slug}-sizes.json`);
  if (fs.existsSync(sizesFile)) {
    const spec = JSON.parse(fs.readFileSync(sizesFile, "utf8"));
    const pageSlug = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const lookup = (mslug, role) =>
      (spec.models && spec.models[mslug] && spec.models[mslug][role]) ||
      (spec.roles && spec.roles[role]) || null;

    let stamped = 0, unchanged = 0;
    const unverified = [];
    brand.models.forEach((m) => {
      const mslug = pageSlug(m.model);
      const cfg = m.configs || [];
      const want = [];
      if (cfg.includes("single")) want.push("single");
      if (cfg.includes("dually") || cfg.includes("super single")) want.push("duallyFront", "superSingle");

      const out = new Set();
      const missed = [];
      want.forEach((role) => {
        const tbl = lookup(mslug, role);
        if (!tbl) { missed.push(role); return; }
        Object.keys(tbl).forEach((d) => tbl[d].forEach((w) => out.add(d + "x" + w)));
      });

      if (!out.size) {
        // Nothing published for this style. Leave what is there rather than
        // blanking it, and name it so the gap stays on the record.
        unchanged++;
        if (want.length) unverified.push(m.model);
        return;
      }
      if (missed.length) unverified.push(`${m.model} (no ${missed.join("/")})`);
      const next = [...out].sort((x, y) => {
        const [xd, xw] = x.split("x").map(Number), [yd, yw] = y.split("x").map(Number);
        return xd - yd || xw - yw;
      });
      if (next.join() !== (m.sizes || []).join()) stamped++;
      m.sizes = next;
    });
    console.log(`  sizes: ${stamped} model(s) restamped from ${slug}-sizes.json` +
      (unchanged ? `, ${unchanged} left as-is (no published list)` : ""));
    if (unverified.length) {
      console.log(`         ${unverified.length} model(s) the manufacturer publishes no page for: ` +
        unverified.slice(0, 6).join(", ") + (unverified.length > 6 ? `, +${unverified.length - 6} more` : ""));
    }
  }

  brand.models.sort((a, b) => a.model.localeCompare(b.model, "en", { numeric: true }));
  totalNew += added; totalImg += got;
  console.log(`${slug}: ${got}/${entries.length} photos, ${added} new models` +
    (failed.length ? `  FAILED: ${failed.join(", ")}` : ""));
  if (noSizes.length) {
    console.log(`  !! ${noSizes.length} new model(s) added with NO sizes — nothing published and ` +
      `nothing to infer from: ${noSizes.slice(0, 8).join(", ")}`);
  }
}

/* ---- UTV / sand lane -------------------------------------------------
   data/specs/utv-models.json is written by tools/scrape-utv.js from Method's
   and Raceline's own product feeds. Both brands are already in the catalog,
   so this adds a product line we didn't carry, not a brand we can't sell.

   These merge like any other model. Their configs are ["utv"] alone, which
   keeps them out of the lifted and dually lanes — those match on "single"
   and "dually"/"super single" — without anything here having to know about
   those lanes.

   Sizes go in exactly as published, quad sizes included. Raceline's utv-atv
   line genuinely spans both, and the lane decides what to show; the catalog
   is not the place to edit the manufacturer down.                        */
const utvFile = path.join(ROOT, "data/specs/utv-models.json");
if (fs.existsSync(utvFile)) {
  const utv = JSON.parse(fs.readFileSync(utvFile, "utf8"));
  for (const [slug, list] of Object.entries(utv.brands || {})) {
    const brand = BRANDS.find((b) => b.slug === slug);
    if (!brand) { console.log(`utv: no "${slug}" brand in the catalog — ${list.length} model(s) skipped`); continue; }
    const dir = path.join(ROOT, "assets/wheels", slug);
    fs.mkdirSync(dir, { recursive: true });
    let added = 0, updated = 0, got = 0, noFinish = [], noPrice = [];
    const pending = [];
    for (const e of list) {
      if (!e.sizes || !e.sizes.length) continue;
      /* Match only models already marked utv. A truck wheel and a UTV wheel
         that share a name are two different wheels — Raceline's Hostage is
         both — and restamping the truck one would take its sizes, finishes,
         price and featured rank with it. Loud, not silent, if it happens. */
      const clash = brand.models.find((x) => norm(x.model) === norm(e.model) && (x.configs || []).indexOf("utv") < 0);
      if (clash) throw new Error(`utv ${slug}: "${e.model}" collides with the non-UTV model "${clash.model}" — give the UTV entry the manufacturer's code so they stay separate`);
      let m = brand.models.find((x) => norm(x.model) === norm(e.model));
      if (!m) { m = { model: e.model, configs: ["utv"], sizes: [], finishes: [] }; brand.models.push(m); added++; }
      else updated++;
      m.configs = ["utv"];
      m.sizes = e.sizes.slice();
      m.finishes = e.finishes.slice();
      if (e.bolts && e.bolts.length) m.bolts = e.bolts.slice();
      /* The manufacturer's own advertised price. Without it catalog.js falls
         back to priceEach(), a formula over brand kind and diameter — fine as
         a placeholder for a catalog we haven't costed, wrong to keep when the
         brand publishes the number. A set of these is four. */
      if (e.priceFrom) { m.priceFrom = e.priceFrom; m.priceSet = e.priceFrom * 4; m.priceSetQty = 4; }
      else noPrice.push(e.model);
      if (!m.finishes.length) noFinish.push(e.model);
      if (e.img) {
        const base = norm(e.model);
        const ext = (e.img.split("?")[0].match(/\.(png|jpe?g|webp)$/i) || [".png"])[0];
        const raw = path.join(dir, base + ".raw" + ext.toLowerCase());
        if (!fs.existsSync(path.join(dir, base + ".png")) && download(e.img, raw) === "200") {
          pending.push(raw); got++;
        }
        m.img = `assets/wheels/${slug}/${base}.png`;
      }
    }
    if (pending.length) normalize(pending);
    brand.models.sort((a, b) => a.model.localeCompare(b.model, "en", { numeric: true }));
    console.log(`utv ${slug}: ${added} new, ${updated} restamped, ${got} photo(s)`);
    /* A finish we can't source is left empty rather than named. Raceline's
       older listings put the finish only in the product photo, not in any
       field, and a swatch we invented would be a colour the customer can't
       actually order. */
    if (noFinish.length) console.log(`  no finish published: ${noFinish.join(", ")}`);
    if (noPrice.length) console.log(`  no price published (sold out everywhere): ${noPrice.join(", ")}`);
  }
}

// ---- serialize brands.js ----
const q = (s) => JSON.stringify(s);
const arr = (a) => "[" + a.map(q).join(",") + "]";
let out = `/* ============================================================
   DROOOLY Wheel & Tire — brand + wheel catalog data
   configs: "single" | "dually" | "super single"
   img  (optional): local product photo under assets/wheels/<brand>/
   feat (optional): featured rank — these show on the brand page;
                    everything else lives behind "view the full lineup"
   GENERATED FILE — rebuilt by tools/build-featured.js
   ============================================================ */
window.BRANDS = [
`;
out += BRANDS.map((b) => {
  let h = `  {\n    slug: ${q(b.slug)}, name: ${q(b.name)}, kind: ${q(b.kind)}, featured: ${!!b.featured},\n`;
  h += `    site: ${q(b.site || "")}, tagline: ${q(b.tagline || "")},\n`;
  // pricing: "quote" (default) or "from" once an agreement lets us publish
  h += `    pricing: ${q(b.pricing || "quote")},\n`;
  // brand-level floor for brands that price per model, not per series
  if (typeof b.priceFrom === "number") h += `    priceFrom: ${b.priceFrom},\n`;
  if (b.priceNote) h += `    priceNote: ${q(b.priceNote)},\n`;
  if (b.bolts && b.bolts.length) h += `    bolts: ${arr(b.bolts)},\n`;
  h += `    models: [\n`;
  h += b.models.map((m) => {
    let s = `      { model: ${q(m.model)}, configs: ${arr(m.configs)}, sizes: ${arr(m.sizes)}, finishes: ${arr(m.finishes)}`;
    if (m.img) s += `, img: ${q(m.img)}`;
    if (m.imgs) s += `, imgs: [` + m.imgs.map((v) => `{finish:${q(v.finish)},img:${q(v.img)}}`).join(",") + `]`;
    // priceFrom: lowest publishable "starting at", in whole dollars. Left
    // unset until dealer agreements say what we're allowed to show.
    if (typeof m.priceFrom === "number") s += `, priceFrom: ${m.priceFrom}`;
    if (typeof m.priceSet === "number") s += `, priceSet: ${m.priceSet}`;
    if (typeof m.priceSetQty === "number") s += `, priceSetQty: ${m.priceSetQty}`;
    if (m.bolts && m.bolts.length) s += `, bolts: ${arr(m.bolts)}`;
    if (m.feat) s += `, feat: ${m.feat}`;
    return s + " }";
  }).join(",\n");
  return h + "\n    ]\n  }";
}).join(",\n");
fs.writeFileSync(path.join(ROOT, "brands.js"), out + "\n];\n");

console.log(`\ntotal: ${totalImg} photos, ${totalNew} models added, ` +
  `${BRANDS.reduce((a, b) => a + b.models.length, 0)} styles across ${BRANDS.length} brands`);

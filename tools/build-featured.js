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

def debg(im, tol=26):
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    corners = [px[0,0], px[w-1,0], px[0,h-1], px[w-1,h-1]]
    # only strip if the frame really is a light studio background
    if not all(c[0] > 228 and c[1] > 228 and c[2] > 228 for c in corners):
        return im
    seeds = [(0,0), (w-1,0), (0,h-1), (w-1,h-1), (w//2,0), (w//2,h-1), (0,h//2), (w-1,h//2)]
    for s in seeds:
        try:
            ImageDraw.floodfill(im, s, (0,0,0,0), thresh=tol)
        except Exception:
            pass
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
  const proto = brand.models[0] || {};
  const byName = {}, byCode = {};
  brand.models.forEach((m) => {
    byName[norm(m.model)] = m;
    const c = code(m.model);
    if (c) byCode[c] = m;
  });

  let got = 0, added = 0, failed = [], pending = [];
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
        sizes: e.sizes || proto.sizes || ["22x12", "24x14", "26x14"],
        finishes: e.finishes || proto.finishes || ["Polished", "Black"],
      };
      brand.models.push(m);
      added++;
    }
    byName[norm(m.model)] = m;
    if (c) byCode[c] = m;
    m.img = rel;
    m.feat = i + 1;

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

  brand.models.sort((a, b) => a.model.localeCompare(b.model, "en", { numeric: true }));
  totalNew += added; totalImg += got;
  console.log(`${slug}: ${got}/${entries.length} photos, ${added} new models` +
    (failed.length ? `  FAILED: ${failed.join(", ")}` : ""));
}

// ---- serialize brands.js ----
const q = (s) => JSON.stringify(s);
const arr = (a) => "[" + a.map(q).join(",") + "]";
let out = `/* ============================================================
   DROOOLY Wheel Co. — brand + wheel catalog data
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
  h += `    site: ${q(b.site || "")}, tagline: ${q(b.tagline || "")},\n    models: [\n`;
  h += b.models.map((m) => {
    let s = `      { model: ${q(m.model)}, configs: ${arr(m.configs)}, sizes: ${arr(m.sizes)}, finishes: ${arr(m.finishes)}`;
    if (m.img) s += `, img: ${q(m.img)}`;
    if (m.imgs) s += `, imgs: [` + m.imgs.map((v) => `{finish:${q(v.finish)},img:${q(v.img)}}`).join(",") + `]`;
    if (m.feat) s += `, feat: ${m.feat}`;
    return s + " }";
  }).join(",\n");
  return h + "\n    ]\n  }";
}).join(",\n");
fs.writeFileSync(path.join(ROOT, "brands.js"), out + "\n];\n");

console.log(`\ntotal: ${totalImg} photos, ${totalNew} models added, ` +
  `${BRANDS.reduce((a, b) => a + b.models.length, 0)} styles across ${BRANDS.length} brands`);

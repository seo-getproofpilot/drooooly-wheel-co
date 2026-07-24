#!/usr/bin/env node
/* ============================================================
   DROOOLY — tire catalog builder
   Reads data/tires/<brand-slug>.json:
     { name, site, tagline, logo, models: [
         { model, tread, url, sizes:[...], priceFrom } ] }
   1. downloads each tread photo + the brand logo
   2. writes tires.js  (window.TIRES)

   Mirrors tools/build-featured.js: name, photo, sizes and price all
   come from the same listing, so they can't drift apart.

   Usage: node tools/build-tires.js [brand-slug ...]
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const NORMALIZE_PY = `
from PIL import Image, ImageDraw
import os, sys

def debg(im, tol=30):
    """Knock out a white studio background.

    Samples the whole border rather than just the four corners: product
    photos often bleed off one edge (a tire touching the bottom-right),
    which made an all-corners test bail and leave the white box in place.
    Only the light border points are used as flood seeds, so the subject
    is never seeded, and interior highlights survive.
    """
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    pts = []
    for i in range(0, w, max(1, w // 24)):
        pts += [(i, 0), (i, h - 1)]
    for j in range(0, h, max(1, h // 24)):
        pts += [(0, j), (w - 1, j)]
    light = [p for p in pts if px[p][0] > 228 and px[p][1] > 228 and px[p][2] > 228]
    if len(light) < len(pts) * 0.45:      # not a studio background - leave it
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

function download(url, dest) {
  try {
    const code = execFileSync("curl", [
      "-sS", "-L", "--max-time", "30", "-A", UA, "-o", dest, "-w", "%{http_code}", url,
    ], { encoding: "utf8" }).trim();
    if (code !== "200" || !fs.existsSync(dest) || fs.statSync(dest).size < 800) {
      fs.existsSync(dest) && fs.unlinkSync(dest);
      return false;
    }
    return true;
  } catch (e) {
    fs.existsSync(dest) && fs.unlinkSync(dest);
    return false;
  }
}

// "35x12.50R20LT" / "305/45R22XL" -> rim diameter in inches, for grouping
function rimOf(size) {
  const m = String(size).match(/R(\d{2}(?:\.\d)?)/i);
  return m ? parseFloat(m[1]) : null;
}

const dir = path.join(ROOT, "data/tires");
const only = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
  .filter((f) => !only.length || only.includes(path.basename(f, ".json")));

// keep brands we're not rebuilding
let TIRES = [];
const outPath = path.join(ROOT, "tires.js");
if (fs.existsSync(outPath)) {
  global.window = {};
  delete require.cache[require.resolve(outPath)];
  require(outPath);
  TIRES = window.TIRES || [];
}

let totalImgs = 0;
for (const file of files) {
  const slug = path.basename(file, ".json");
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const outDir = path.join(ROOT, "assets/tires", slug);
  fs.mkdirSync(outDir, { recursive: true });

  const pending = [];
  const failed = [];

  // brand logo
  let logoRel = null;
  if (data.logo) {
    const ext = (data.logo.match(/\.(png|jpe?g|webp|svg)(?:\?|$)/i) || [, "png"])[1].toLowerCase();
    if (ext === "svg") {
      logoRel = `assets/tires/${slug}/logo.svg`;
      if (!fs.existsSync(path.join(ROOT, logoRel)) && !download(data.logo, path.join(ROOT, logoRel))) {
        logoRel = null; failed.push("logo");
      }
    } else {
      logoRel = `assets/tires/${slug}/logo.png`;
      const raw = path.join(outDir, `logo.raw.${ext}`);
      if (!fs.existsSync(path.join(ROOT, logoRel))) {
        if (download(data.logo, raw)) pending.push(raw);
        else { logoRel = null; failed.push("logo"); }
      }
    }
  }

  const models = [];
  data.models.forEach((m, i) => {
    const mslug = norm(m.model);
    const rel = `assets/tires/${slug}/${mslug}.png`;
    const abs = path.join(ROOT, rel);
    const ext = (m.url.match(/\.(png|jpe?g|webp)(?:\?|$)/i) || [, "jpg"])[1].toLowerCase();
    const raw = path.join(outDir, `${mslug}.raw.${ext}`);

    let ok = fs.existsSync(abs);
    if (!ok) { ok = download(m.url, raw); if (ok) pending.push(raw); }
    if (!ok) { failed.push(m.model); return; }
    totalImgs++;

    const sizes = (m.sizes || []).slice().sort((a, b) => (rimOf(a) || 0) - (rimOf(b) || 0));
    const rims = [...new Set(sizes.map(rimOf).filter(Boolean))].sort((a, b) => a - b);
    models.push({
      model: m.model, tread: m.tread || "", img: rel,
      sizes, rims, priceFrom: m.priceFrom, feat: i + 1,
    });
  });

  if (pending.length) execFileSync("python3", ["-c", NORMALIZE_PY, ...pending], { stdio: "inherit" });

  const brand = {
    slug, name: data.name, site: data.site || "", tagline: data.tagline || "",
    logo: logoRel, pricing: data.pricing || "from", models,
  };
  const at = TIRES.findIndex((b) => b.slug === slug);
  if (at >= 0) TIRES[at] = brand; else TIRES.push(brand);

  console.log(`${slug}: ${models.length}/${data.models.length} treads` +
    (logoRel ? ", logo ok" : ", NO LOGO") +
    (failed.length ? `  FAILED: ${failed.join(", ")}` : ""));
}

TIRES.sort((a, b) => a.name.localeCompare(b.name));

const q = (s) => JSON.stringify(s);
const arr = (a) => "[" + a.map(q).join(",") + "]";
let out = `/* ============================================================
   DROOOLY Wheel Co. — tire catalog
   tread : "Mud-Terrain" | "All-Terrain" | "Highway" | "All-Season" ...
   sizes : every size we list for that tread, sorted by rim diameter
   rims  : distinct rim diameters, derived from sizes
   GENERATED FILE — rebuilt by tools/build-tires.js
   ============================================================ */
window.TIRES = [
`;
out += TIRES.map((b) => {
  let h = `  {\n    slug: ${q(b.slug)}, name: ${q(b.name)}, site: ${q(b.site)},\n`;
  h += `    tagline: ${q(b.tagline)}, logo: ${b.logo ? q(b.logo) : "null"}, pricing: ${q(b.pricing)},\n`;
  h += `    models: [\n`;
  h += b.models.map((m) => {
    let s = `      { model: ${q(m.model)}, tread: ${q(m.tread)}, img: ${q(m.img)}`;
    s += `, rims: [${m.rims.join(",")}], sizes: ${arr(m.sizes)}`;
    if (typeof m.priceFrom === "number") s += `, priceFrom: ${m.priceFrom}`;
    if (m.feat) s += `, feat: ${m.feat}`;
    return s + " }";
  }).join(",\n");
  return h + "\n    ]\n  }";
}).join(",\n");
fs.writeFileSync(outPath, out + "\n];\n");

console.log(`\ntotal: ${totalImgs} images, ${TIRES.length} tire brands, ` +
  `${TIRES.reduce((a, b) => a + b.models.length, 0)} treads`);

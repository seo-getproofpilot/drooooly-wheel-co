#!/usr/bin/env node
/* Builds the "see this wheel on a truck" index from a manufacturer's own
   gallery.  node tools/build-builds.js [--fetch]

   WE STORE URLS AND METADATA, NEVER IMAGE BYTES. Nothing is copied into this
   repo: each entry points at the manufacturer's own file on their own server,
   and every tile on the page links back to them. That keeps this a link-out
   feature rather than a hosting one, which is what it is cleared for.
   See LAUNCH-CHECKLIST.md before this ships.

   The gallery has no per-model URL and no structured metadata — but the
   filenames carry it all:
     2020-Silverado-HD-26x14-Black-Centerfire-JTX-Forged-Wheels.jpg
   which is vehicle, size, finish and model. Parse it and the gallery becomes
   filterable by wheel, which is the whole feature.                          */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CACHE = path.join(ROOT, "data", "builds", "jtx-gallery-urls.txt");
const OUT_JSON = path.join(ROOT, "data", "builds", "jtx.json");
const OUT_JS = path.join(ROOT, "builds-data.js");
const GALLERY = "https://jtxforged.com/gallery/";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/120 Safari/537.36";

/* A gallery is only worth linking to if there is enough there to be worth the
   click. One photo does not reassure anyone — it just advertises reassurance
   and then withholds it. */
const MIN_PHOTOS = 3;

function fetchGallery() {
  const html = execFileSync("curl", ["-s", "-A", UA, GALLERY], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024
  });
  const re = /https:\/\/jtxforged\.com\/wp-content\/uploads\/[0-9/]+\/[^"'\s)]+?\.(?:jpg|jpeg|png|webp)/gi;
  const seen = new Set();
  (html.match(re) || []).forEach((u) => {
    // strip WordPress' generated -1024x828 size suffix to get the original
    const full = u.replace(/-\d{2,4}x\d{2,4}\.(jpg|jpeg|png|webp)$/i, ".$1");
    if (/logo|stacked|icon|identity|favicon/i.test(full)) return;
    seen.add(full);
  });
  return [...seen].sort();
}

const SIZE = /\b(\d{2})\s*[xX]\s*(\d{1,2}(?:\.\d+)?)\b/;
const DIA_ONLY = /\b(\d{2})[\s-]*inch\b/i;
const FINISHES = ["Polished", "Brushed", "Black Milled", "Black", "Chrome", "Bronze", "Custom"];

/* Everything before the wheel model is the truck; everything the model, size
   and boilerplate leave behind is noise. Returns null rather than guessing
   when the vehicle can't be read cleanly. */
function parseVehicle(words, modelIdx) {
  const before = words.slice(0, modelIdx);
  const keep = before.filter((w) =>
    !SIZE.test(w) && !DIA_ONLY.test(w) &&
    !FINISHES.some((f) => f.toLowerCase().split(" ")[0] === w.toLowerCase()) &&
    !/^(jtx|forged|wheels?|lifted|custom|on|the|scaled|snapshot|concave)$/i.test(w) &&
    !/^\d{6,}$/.test(w)
  );
  const v = keep.join(" ").replace(/\s+/g, " ").trim();
  return v.length >= 3 ? v : null;
}

function parse(url, models) {
  const file = decodeURIComponent(url.split("/").pop()).replace(/\.(jpg|jpeg|png|webp)$/i, "");
  const words = file.split(/[-_]+/).filter(Boolean);
  const flat = words.join(" ");

  // longest matching model wins, so "Capo Max" beats "Capo"
  let model = null, modelIdx = -1;
  models.forEach((m) => {
    const re = new RegExp("\\b" + m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+") + "\\b", "i");
    if (re.test(flat) && (!model || m.length > model.length)) {
      model = m;
      modelIdx = words.findIndex((w) => new RegExp("^" + m.split(/\s+/)[0] + "$", "i").test(w));
    }
  });
  if (!model) return null;

  const sm = flat.match(SIZE), dm = flat.match(DIA_ONLY);
  const finish = FINISHES.find((f) =>
    new RegExp("\\b" + f.replace(/\s+/g, "[\\s-]+") + "\\b", "i").test(flat)) || null;

  return {
    model,
    url,
    vehicle: parseVehicle(words, modelIdx < 0 ? words.length : modelIdx),
    size: sm ? `${sm[1]}x${sm[2]}` : (dm ? `${dm[1]}"` : null),
    finish
  };
}

// ---- run ----
let urls;
if (process.argv.includes("--fetch") || !fs.existsSync(CACHE)) {
  urls = fetchGallery();
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, urls.join("\n") + "\n");
  console.log(`fetched ${urls.length} gallery images from jtxforged.com`);
} else {
  urls = fs.readFileSync(CACHE, "utf8").trim().split("\n").filter(Boolean);
  console.log(`using cached gallery list (${urls.length} images) — pass --fetch to refresh`);
}

global.window = {};
require(path.join(ROOT, "brands.js"));
const brand = window.BRANDS.find((b) => b.slug === "jtx");
const models = brand.models.map((m) => m.model).sort((a, b) => b.length - a.length);

const byModel = {};
let matched = 0;
urls.forEach((u) => {
  const rec = parse(u, models);
  if (!rec) return;
  matched++;
  (byModel[rec.model] = byModel[rec.model] || []).push(rec);
});

const payload = {
  brand: brand.name,
  brandSlug: brand.slug,
  source: GALLERY,
  captured: new Date().toISOString().slice(0, 10),
  hosted: false,
  minPhotos: MIN_PHOTOS,
  models: {}
};
Object.keys(byModel).sort().forEach((m) => { payload.models[m] = byModel[m]; });

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n");
fs.writeFileSync(OUT_JS,
  `/* GENERATED by tools/build-builds.js — do not edit.\n` +
  `   Source: ${GALLERY} (captured ${payload.captured})\n` +
  `   URLs only; no image bytes are copied into this repo. */\n` +
  "window.WHEEL_BUILDS = " + JSON.stringify(payload) + ";\n");

const shown = Object.keys(byModel).filter((m) => byModel[m].length >= MIN_PHOTOS);
console.log(`matched ${matched} of ${urls.length} photos to ${Object.keys(byModel).length} models`);
console.log(`${shown.length} model(s) clear the ${MIN_PHOTOS}-photo floor and will show a link:`);
Object.keys(byModel).sort((a, b) => byModel[b].length - byModel[a].length).forEach((m) => {
  const n = byModel[m].length;
  console.log(`  ${n >= MIN_PHOTOS ? "show" : "hide"}  ${m.padEnd(14)} ${n}`);
});

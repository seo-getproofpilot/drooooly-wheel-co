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
/* Which lane a photo belongs to. Read BEFORE parseVehicle strips its words —
   "lifted" is boilerplate in a vehicle name but it is the single most useful
   token in the whole filename, and it used to be thrown away. */
function lanesFor(flat, size) {
  const lanes = [];
  const m = size && /^(\d+)x([\d.]+)$/.exec(size);
  const w = m ? +m[2] : null;
  const dually = /\b(dually|drw|f-?450|f-?550|dbo)\b/i.test(flat) || w === 8.25;
  if (dually) lanes.push("dually");
  // A wide wheel on a single-rear truck is the lifted lane. 8.25 never is —
  // that is a dually rear, however wide the truck.
  if (!dually && (/\blifted\b/i.test(flat) || (w !== null && w >= 12))) lanes.push("lifted");
  return lanes;
}

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

  const size = sm ? `${sm[1]}x${sm[2]}` : (dm ? `${dm[1]}"` : null);
  return {
    model,
    url,
    vehicle: parseVehicle(words, modelIdx < 0 ? words.length : modelIdx),
    size,
    finish,
    lanes: lanesFor(flat, size)
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

/* ---- lane photos -------------------------------------------------------
   The homepage lanes ("lifted trucks", "dually & super single") need photos of
   the KIND of truck, not of one wheel model, so they are indexed separately
   from `models` — which stays exactly as it was, keyed by wheel, feeding the
   wheel pages.

   Two possible sources per lane, and a lane uses ONE of them so its credit line
   stays true:
     1. The manufacturer gallery, hot-linked, credited, every tile linking back.
     2. assets/builds/*.jpg — photos already in this repo and already on the
        homepage, named by build type.

   Manufacturer first, local only as a fallback, because a hot-linked photo
   carries its own attribution. The dually lane needs the fallback: JTX's
   gallery contains no dually trucks at all (checked all 70 cached URLs), their
   dually product pages carry no truck photography, and the other dually brands
   we carry have no scrapeable gallery — Vision's 510-image gallery has exactly
   one dually in it.

   Local photos carry NO caption. The homepage captions for these same files are
   fabricated (LAUNCH-CHECKLIST 1.5) — showing the photo is one thing, repeating
   an invented "6\" lift · 24x14 · 37s" under it is another. */
const LOCAL_DIR = path.join(ROOT, "assets", "builds");
const LOCAL_LANE = { lifted: "lifted", dually: "dually" };
function localLanePhotos() {
  if (!fs.existsSync(LOCAL_DIR)) return {};
  const out = {};
  fs.readdirSync(LOCAL_DIR).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort()
    .forEach((f) => {
      const lane = LOCAL_LANE[(f.split("-")[0] || "").toLowerCase()];
      if (!lane) return;
      (out[lane] = out[lane] || []).push({
        url: "assets/builds/" + f, vehicle: null, size: null, finish: null, local: true
      });
    });
  return out;
}

const laneFromGallery = {};
Object.keys(byModel).forEach((m) => byModel[m].forEach((rec) => {
  (rec.lanes || []).forEach((l) => { (laneFromGallery[l] = laneFromGallery[l] || []).push(rec); });
}));
const laneLocal = localLanePhotos();
const lanes = {};
[...new Set([...Object.keys(laneFromGallery), ...Object.keys(laneLocal)])].forEach((l) => {
  const g = laneFromGallery[l] || [], loc = laneLocal[l] || [];
  if (g.length >= MIN_PHOTOS) lanes[l] = { source: "gallery", credit: brand.name, photos: g };
  else if (loc.length >= MIN_PHOTOS) lanes[l] = { source: "local", credit: null, photos: loc };
  // Below the floor on both: the lane shows no strip at all.
});

const payload = {
  brand: brand.name,
  brandSlug: brand.slug,
  source: GALLERY,
  captured: new Date().toISOString().slice(0, 10),
  hosted: false,
  minPhotos: MIN_PHOTOS,
  lanes: lanes,
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

console.log("lane strips:");
["lifted", "dually"].forEach(function (l) {
  const e = lanes[l];
  const g = (laneFromGallery[l] || []).length, loc = (laneLocal[l] || []).length;
  console.log("  " + l.padEnd(8) + (e
    ? e.photos.length + " photo(s) from " + e.source + (e.credit ? " (" + e.credit + ")" : " (ours)")
    : "NO STRIP — gallery " + g + ", local " + loc + ", floor " + MIN_PHOTOS));
});

const shown = Object.keys(byModel).filter((m) => byModel[m].length >= MIN_PHOTOS);
console.log(`matched ${matched} of ${urls.length} photos to ${Object.keys(byModel).length} models`);
console.log(`${shown.length} model(s) clear the ${MIN_PHOTOS}-photo floor and will show a link:`);
Object.keys(byModel).sort((a, b) => byModel[b].length - byModel[a].length).forEach((m) => {
  const n = byModel[m].length;
  console.log(`  ${n >= MIN_PHOTOS ? "show" : "hide"}  ${m.padEnd(14)} ${n}`);
});

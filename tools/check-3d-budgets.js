#!/usr/bin/env node
/* node tools/check-3d-budgets.js <glb...>
   Exits 1 when a truck GLB is over 5 MB or 200k triangles, or a wheel GLB (filename contains
   "wheel") is over 0.6 MB or 60k triangles. Reads the GLB JSON chunk only, no deps. */
const fs = require("fs"), path = require("path");
const LIMITS = { truck: { bytes: 5 * 1024 * 1024, tris: 200000 }, wheel: { bytes: 0.6 * 1024 * 1024, tris: 60000 } };
let fail = 0;
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f), len = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + len).toString("utf8"));
  const kind = /wheel/i.test(path.basename(f)) ? "wheel" : "truck", lim = LIMITS[kind];
  let tris = 0;
  for (const m of j.meshes || []) for (const p of m.primitives || []) {
    if (p.mode !== undefined && p.mode !== 4) continue;            // count TRIANGLES primitives only
    const acc = j.accessors[p.indices ?? p.attributes.POSITION]; tris += acc.count / 3;
  }
  const over = b.length > lim.bytes || tris > lim.tris;
  console.log(`${over ? "FAIL" : "ok  "} ${path.basename(f)} ${(b.length / 1048576).toFixed(2)} MB, ${Math.round(tris)} tris (${kind} limit ${(lim.bytes / 1048576).toFixed(1)} MB / ${lim.tris})`);
  if (over) fail++;
}
process.exit(fail ? 1 : 0);

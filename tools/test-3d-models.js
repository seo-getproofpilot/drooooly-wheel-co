#!/usr/bin/env node
/* Reads the JSON chunk of each GLB (no deps) and checks the node contract. */
const fs = require("fs"), path = require("path");
const dir = path.resolve(__dirname, "..", "configurator", "public", "models");
const want = ["body", "glass", "chassis", "bed", "hub_FL", "hub_FR", "hub_RL", "hub_RR"];
let fail = 0;
function nodesOf(file) {
  const b = fs.readFileSync(file); const len = b.readUInt32LE(12);
  return JSON.parse(b.slice(20, 20 + len).toString("utf8")).nodes;
}
for (const f of ["f250-crew.glb", "f150-crew.glb"]) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) { console.log("  FAIL missing " + f); fail++; continue; }
  const nodes = nodesOf(p), names = nodes.map(n => n.name || "");
  for (const w of want) if (!names.includes(w)) { console.log(`  FAIL ${f} lacks node ${w}`); fail++; }
  // +X is the driver's (left) side: left hubs at +X, right hubs at -X.
  for (const n of nodes) {
    const m = /^hub_(F|R)(L|R)$/.exec(n.name || ""); if (!m) continue;
    const x = (n.translation || [0])[0];
    if (m[2] === "L" ? !(x > 0) : !(x < 0)) { console.log(`  FAIL ${f} ${n.name} sits at x=${x}, wrong side`); fail++; }
  }
  if (names.some(n => /wheel|tire|tyre/i.test(n))) { console.log(`  FAIL ${f} still carries a wheel node`); fail++; }
}
console.log(fail ? `${fail} failed` : "3d models ok"); process.exit(fail ? 1 : 0);

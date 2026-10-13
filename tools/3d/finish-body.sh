#!/usr/bin/env bash
# tools/3d/finish-body.sh <blender-export.gltf> <outdir> <name>
# The gltf-transform steps every body went through after its prepare-*.py export:
#   weld -> simplify (ratio 0.6, error 0.0008) -> resize textures to 1024 -> webp q80 ->
#   quantize -> prune (keeping the mesh-less hub_* and bed empties the configurator reads).
# SIMPLIFY=0 skips simplify: it collapses large flat panels (the F-150 tailgate) into
# visible shading blotches, so a body that fits the triangle budget without it skips it.
# Every step rewrites the shared <name>.bin, so only the last step's .gltf and .bin belong
# together. Textures come out as textures/<name>-<image>.webp so six bodies can share one
# textures/ folder. Then bake AO: blender -b -P tools/3d/bake-ao.py -- <outdir>/<name>-crew.gltf <outdir>
set -euo pipefail
in="$1"; out="$2"; name="$3"
GT="npx --yes @gltf-transform/cli@4.5.1"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
cp "$in" "$work/in.gltf"; srcdir="$(dirname "$in")"
cp "$srcdir"/*.bin "$work/" 2>/dev/null || true
[ -d "$srcdir/textures" ] && cp -R "$srcdir/textures" "$work/textures"
cd "$work"
$GT weld in.gltf a.gltf
if [ "${SIMPLIFY:-1}" = "1" ]; then $GT simplify a.gltf b.gltf --ratio 0.6 --error 0.0008; else cp a.gltf b.gltf; fi
$GT resize b.gltf c.gltf --width 1024 --height 1024
$GT webp c.gltf e.gltf --quality 80
$GT quantize e.gltf q.gltf
$GT prune q.gltf f.gltf --keep-leaves true
mkdir -p "$out/textures"
python3 - "$work/f.gltf" "$out" "$name" <<'EOF'
import json, os, shutil, sys
src, out, name = sys.argv[1:]
d = os.path.dirname(src); g = json.load(open(src))
for b in g.get("buffers", []):
    shutil.copy(os.path.join(d, b["uri"]), os.path.join(out, f"{name}-crew.bin")); b["uri"] = f"{name}-crew.bin"
for im in g.get("images", []):
    base = os.path.basename(im["uri"])
    new = f"textures/{name}-{base}"
    shutil.copy(os.path.join(d, im["uri"]), os.path.join(out, new)); im["uri"] = new
json.dump(g, open(os.path.join(out, f"{name}-crew.gltf"), "w"), separators=(",", ":"))
print("finished", name, len(g.get("images", [])), "textures")
EOF

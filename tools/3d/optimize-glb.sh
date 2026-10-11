#!/usr/bin/env bash
# tools/3d/optimize-glb.sh <in.glb> <out.glb>
# --join false and --flatten false keep body, glass and chassis as separate named nodes.
# --prune false keeps the hub and bed empties: prune deletes mesh-less leaf nodes, and the
# configurator places wheels from those empties. tools/test-3d-models.js checks they survive.
set -euo pipefail
npx --yes @gltf-transform/cli optimize "$1" "$2" \
  --compress meshopt --texture-compress webp --simplify-error 0.001 \
  --join false --flatten false --instance false --prune false

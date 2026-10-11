#!/usr/bin/env bash
# tools/3d/optimize-glb.sh <in.glb> <out.glb>
# --join false and --flatten false keep body, glass and chassis as separate named nodes.
# --prune false keeps the hub and bed empties: prune deletes mesh-less leaf nodes, and the
# configurator places wheels from those empties. tools/test-3d-models.js checks they survive.
# No meshopt and no texture compression on purpose: Railway's static host sends a CSP with
# no 'wasm-unsafe-eval' and no blob: in connect-src, so the meshopt WASM decoder and the
# blob URLs GLTFLoader makes for embedded textures are both refused (LAUNCH-CHECKLIST 7.5).
# The stand-ins are 18 KB uncompressed. Turn compression back on only once the host's
# headers allow it; the real bodies will want it.
set -euo pipefail
npx --yes @gltf-transform/cli optimize "$1" "$2" \
  --compress false --texture-compress false --simplify-error 0.001 \
  --join false --flatten false --instance false --prune false

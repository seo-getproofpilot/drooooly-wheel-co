# 3D model licenses

| File | Built from | Author | Source URL | License | Downloaded |
|---|---|---|---|---|---|
| `f250-crew.glb` | `truck.glb` from Car Kit 3.1 | Kenney (www.kenney.nl) | https://kenney.nl/assets/car-kit (zip: https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip) | Creative Commons Zero, CC0 1.0 (http://creativecommons.org/publicdomain/zero/1.0/), per `License.txt` in the zip | 2026-10-10 |
| `f150-crew.glb` | same `truck.glb` as above | Kenney (www.kenney.nl) | same as above | CC0 1.0 | 2026-10-10 |

Stand-in for development. Never ships as a named truck.

Both files are the same low-poly Kenney pickup, rescaled per axis by `tools/3d/prepare-truck.py`:
length so its axles match the real wheelbase, height so its wheel arches match the stock tire
radius, width to the published overall body width. The four source wheel meshes are removed,
the body is split into `body`, `glass` and `chassis` by colour-atlas cell, and the hub and bed
empties are added. Proportions are Kenney's, so overhangs and cab shape are not Ford's. Credit
to Kenney is optional under CC0 and is given here anyway.

The original download lives in `tools/3d/.source/` (gitignored). Rebuild with:

```bash
for k in f250-crew f150-crew; do
  /opt/homebrew/bin/blender -b --factory-startup -P tools/3d/prepare-truck.py -- $k <scratch>/$k-raw.glb
  bash tools/3d/optimize-glb.sh <scratch>/$k-raw.glb configurator/public/models/$k.glb
done
node tools/test-3d-models.js && node tools/check-3d-budgets.js configurator/public/models/*.glb
```

Output is meshopt-compressed (`EXT_meshopt_compression`) with a WebP texture
(`EXT_texture_webp`). The loader needs the meshopt decoder, which drei's `useGLTF` registers by
default.

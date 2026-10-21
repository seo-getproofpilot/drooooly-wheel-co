# Truck model licenses

## f250-crew.gltf (2026-10-13)

Built from the same CC-BY "Ford F-450 Twin Turbo 2021" model as f450-crew.gltf, by
`tools/3d/prepare-f250.py`. The 2017-2022 F-250 and F-450 crew cabs share the cab, doors, hood
and front fenders; the differences are the F-450's 8 ft bed and dual-rear-wheel fenders. On top
of everything prepare-f450.py does (badges, lettering, wheels and engine out, interior
decimated, plain materials by object name, paint joined into `body`, glass into `glass`, the
rest into `chassis`):

- a 16.4 in slice of the bed is cut out just behind the cab (bisected at two planes, the faces
  between deleted, everything aft slid forward, the cut loops welded), so the wheelbase is the
  F-250 crew cab 6.75 ft bed's 159.8 in. The source's fuel door sat in that slice and is gone;
- the dually flares, their marker lamps and the mud flaps are flattened into the bed side
  (vertices beyond 0.985 m from the centreline clamped to it, lamps painted), which keeps the
  round arch opening and reads as a single-rear-wheel bed side. The flare's outline survives as
  a faint crease in the paint;
- the front and rear axle ends are clipped at 0.78 m (frame at 0.80 m) so nothing pokes
  through an SRW wheel at the platform's 68.3 in track.

Quantized (`KHR_mesh_quantization`, no decoder), no meshopt, no textures (LAUNCH-CHECKLIST
7.5). 3.3 MB, 118k triangles. Since 2026-10-13 the POWER STROKE nameplate pad and trim letters
on each front door and the grille oval's pad, rim and cup are cut out too (same calls as the
F-450); the two slat rows the oval interrupted are rebuilt from the intact row above, and a
dark radiator plate closes the grille so no sky shows through. Ambient occlusion is baked into
`COLOR_0` by `tools/3d/bake-ao.py` (R=G=B, 1 open), read by the configurator's shader hook.

Required credit, which must appear wherever the model is shown:

> This work is based on "Ford F-450 Twin Turbo 2021"
> (https://sketchfab.com/3d-models/ford-f-450-twin-turbo-2021-610cecc94c9646e3826ac918917e997c)
> by DR1KING100K (https://sketchfab.com/DR1KING100K) licensed under CC-BY-4.0
> (http://creativecommons.org/licenses/by/4.0/)

- License: CC-BY-4.0, commercial use allowed, author must be credited. Source in
  `tools/3d/.source/ford-f450-2021/` (gitignored), see the f450 section.
- Trade dress: badges gone, OEM body shape kept (LAUNCH-CHECKLIST 7.1).

Rebuild:

```
/opt/homebrew/bin/blender -b -P tools/3d/prepare-f250.py -- /tmp/f250 --render   # --render writes QA views
cd configurator && npx @gltf-transform/cli weld /tmp/f250/f250-crew.gltf /tmp/f250/a.gltf \
  && npx @gltf-transform/cli simplify /tmp/f250/a.gltf /tmp/f250/b.gltf --ratio 0.6 --error 0.0008 \
  && npx @gltf-transform/cli quantize /tmp/f250/b.gltf /tmp/f250/c.gltf \
  && npx @gltf-transform/cli prune /tmp/f250/c.gltf /tmp/f250/out.gltf --keep-leaves && cd ..
# every step rewrites the shared /tmp/f250/f250-crew.bin, so copy out.gltf as f250-crew.gltf
# together with that .bin into configurator/public/models/
```

## f150-crew.gltf (2026-10-13)

Built from a CC-BY model of the 2024 F-150 Raptor R by `tools/3d/prepare-f150.py`. The Raptor
R is a wide-body trim of the 14th-gen F-150 SuperCrew 5.5 ft bed, the platform's shape, with
flared fenders and 37 in tires. The source is real scale at 1/100, faces the contract already,
and sits level on 34.4 in tires at a 73.7 in track; it is scaled uniformly so its wheelbase
matches the platform's 145.4 in and dropped onto the platform's stock tire. Deleted: the logo
decal atlases (ovals, RAPTOR, F-150, stickers and plate), the raised FORD letters in the grille
and on the tailgate and their surrounds, the F-150 and RAPTOR tailgate badges (loose parts cut
by bounding box), the wheels, brakes and engine. Interior decimated hard, heavy trim medium.
Paint joined into `body` (one clean `paint` slot), glass into `glass`, the rest into `chassis`
with its authored materials. Textures resized to 1024 and converted to WebP, external, renamed
`textures/f150-<name>`. Quantized, no meshopt. The paint mesh ships unsimplified since
2026-10-13 (`tools/3d/finish-body.sh` with `SIMPLIFY=0`): the gltf-transform simplify step
collapsed the flat tailgate into a lighter patch and left a dark wedge at the rear flare, and
decimating the paint dropped its custom normals. 4.0 MB, 133k triangles, 21 textures. Ambient
occlusion is baked into `COLOR_0` by `tools/3d/bake-ao.py` (R=G=B, 1 open).

Known residue: the wheels sit on the platform's 67.6 in track inside the Raptor's wide
flares, so the stance reads a little tucked next to a stock Raptor.

Required credit, which must appear wherever the model is shown:

> This work is based on "2024_ford_f-150_raptor_r"
> (https://sketchfab.com/3d-models/2024-ford-f-150-raptor-r-11b2d3c304ee474195f06fa8315d247b)
> by 007 (https://sketchfab.com/tangwang920) licensed under CC-BY-4.0
> (http://creativecommons.org/licenses/by/4.0/)

- License: CC-BY-4.0, commercial use allowed, author must be credited. Downloaded 2026-10-11 as
  the Sketchfab glTF archive (12 MB). Source in `tools/3d/.source/ford-f150-raptor-r/`
  (gitignored).
- Trade dress: badges gone, OEM body shape kept (LAUNCH-CHECKLIST 7.1).

Rebuild:

```
/opt/homebrew/bin/blender -b -P tools/3d/prepare-f150.py -- /tmp/f150
cd configurator && G="npx @gltf-transform/cli" && d=/tmp/f150 && f=f150-crew \
  && $G weld $d/$f.gltf $d/a.gltf && $G simplify $d/a.gltf $d/b.gltf --ratio 0.6 --error 0.0008 \
  && $G resize $d/b.gltf $d/c.gltf --width 1024 --height 1024 && $G webp $d/c.gltf $d/e.gltf --quality 80 \
  && $G quantize $d/e.gltf $d/g.gltf && mkdir -p $d/out && $G prune $d/g.gltf $d/out/$f.gltf --keep-leaves && cd ..
# copy the .gltf, .bin and referenced textures into configurator/public/models/, renaming each
# texture to textures/f150-<name> and rewriting its uri in the .gltf (avoids clashes between bodies)
node tools/test-3d-models.js && node tools/check-3d-budgets.js configurator/public/models/*.gltf
```

## f450-crew.gltf (2026-10-11)

Built from a CC-BY model of the 2017-2022 Super Duty crew cab, dual rear wheel, by
`tools/3d/prepare-f450.py`. Deleted: every badge, logo, emblem and plate mesh, the wheels and
engine, the grille oval's blue backing, and the lettering moulded onto panels as loose shells
(SUPER DUTY on the hood lip, the oval and script in the grille, the embossed letters on the
tailgate and the cut-out letters in its chrome band), each cut out by bounding box. The
exporter's clearcoat ghost shells over the paint (`bodyshell.001`, the bed's
`Glass_rgbaffffff99` piece) are deleted so they cannot frost the roof and fenders. The source's
material names are scrambled and its textures dropped, so every non-paint object gets one of
five plain materials by its object name (chrome, gloss black, lamp, interior, dark trim); the
roof, front fenders, pillars and dually flares, "EXT_Plastic" in the source, are painted. Body
paint meshes joined into `body`, glass into `glass` (black gloss trim stays out), the rest into
`chassis`, hub empties on the platform's published wheelbase and track. The front axle and its
hub ends reached 0.92 m outboard in the source, past the mounting face of a +120 dually front
wheel, so everything on those parts beyond 0.80 m is cut away (0.86 m on the frame piece). The
source is real scale. Quantized (`KHR_mesh_quantization`, no decoder), no meshopt, no textures
(LAUNCH-CHECKLIST 7.5). 3.3 MB, 119k triangles.

Since 2026-10-13 the POWER STROKE nameplate pad and trim letters on each front door and the
grille oval's pad, rim and cup are cut out as well; the two slat rows the oval interrupted are
rebuilt from the intact row above and a dark radiator plate closes the grille. Ambient
occlusion is baked into `COLOR_0` by `tools/3d/bake-ao.py` (R=G=B, 1 open). No known
lettering residue remains for the trade dress read (LAUNCH-CHECKLIST 7.1).

Required credit, which must appear wherever the model is shown:

> This work is based on "Ford F-450 Twin Turbo 2021"
> (https://sketchfab.com/3d-models/ford-f-450-twin-turbo-2021-610cecc94c9646e3826ac918917e997c)
> by DR1KING100K (https://sketchfab.com/DR1KING100K) licensed under CC-BY-4.0
> (http://creativecommons.org/licenses/by/4.0/)

- License: CC-BY-4.0, commercial use allowed, author must be credited. Downloaded 2026-10-11 as
  the Sketchfab glTF archive (36 MB). Source in `tools/3d/.source/ford-f450-2021/` (gitignored).
- Trade dress: the badges are gone but the body shape is the OEM's. This is the same exposure the
  2D visualizers in this market carry by showing photos of real trucks. A trademark lawyer reads
  it before public launch (LAUNCH-CHECKLIST 7.1).

Rebuild:

```
/opt/homebrew/bin/blender -b -P tools/3d/prepare-f450.py -- /tmp/f450
cd configurator && npx @gltf-transform/cli weld /tmp/f450/f450-crew.gltf /tmp/f450/a.gltf \
  && npx @gltf-transform/cli simplify /tmp/f450/a.gltf /tmp/f450/b.gltf --ratio 0.6 --error 0.0008 \
  && npx @gltf-transform/cli quantize /tmp/f450/b.gltf /tmp/f450/c.gltf \
  && npx @gltf-transform/cli prune /tmp/f450/c.gltf /tmp/f450/f450-crew.gltf --keep-leaves && cd ..
# copy the .gltf, .bin and referenced textures into configurator/public/models/
```

## gm2500-crew.gltf (stand-in, 2026-10-11)

Built from a CC-BY model of the **2015-2019** (K2) Silverado HD crew cab, standard bed, by
`tools/3d/prepare-gm2500.py` (shared steps in `tools/3d/bodykit.py`). The platform is the 2020+
(T1) truck, whose front end and bed sides differ, so this body is a stand-in until a T1 body
replaces it (LAUNCH-CHECKLIST 7.1). The source is in arbitrary units (one unit is 3.7 in) and the K2 has a 153.7 in
wheelbase; it is scaled uniformly to the platform's 158.9 in, levelled on its tire centres and
dropped onto the stock tire. Deleted: both bowties (the grille one and the one engraved in the
tailgate), the "2500 HD" letters on both front fenders, a "053" stamp on the frame rail, every
tire, rim, hub and brake part (several were merged into body meshes and were cut out by loose
part), and the fully transparent ghost shells the exporter left over the body. No logos are
painted into textures; the model has one texture, a rim, which is deleted. Quantized, no
meshopt, no embedded textures (LAUNCH-CHECKLIST 7.5). 1.0 MB, 59k triangles.

Required credit, which must appear wherever the model is shown:

> This work is based on "Chevy Silverado 2500HD"
> (https://sketchfab.com/3d-models/chevy-silverado-2500hd-f1b5b0c1a6484a6ba3d4af0934c5fe71)
> by David_Holiday (https://sketchfab.com/David_Holiday) licensed under CC-BY-4.0
> (http://creativecommons.org/licenses/by/4.0/)

- License: CC-BY-4.0, commercial use allowed, author must be credited. Downloaded 2026-10-11 as
  the Sketchfab glTF archive (1 MB). Source in `tools/3d/.source/chevy-silverado-2500hd/`
  (gitignored).
- Trade dress: badges gone, OEM body shape kept, same exposure as the f450 body (LAUNCH-CHECKLIST 7.1).

Rebuild:

```
/opt/homebrew/bin/blender -b -P tools/3d/prepare-gm2500.py -- /tmp/gm2500
cd configurator && G="npx @gltf-transform/cli" && d=/tmp/gm2500 && f=gm2500-crew \
  && $G weld $d/$f.gltf $d/a.gltf && $G simplify $d/a.gltf $d/b.gltf --ratio 0.8 --error 0.0008 \
  && $G resize $d/b.gltf $d/c.gltf --width 1024 --height 1024 && $G webp $d/c.gltf $d/e.gltf --quality 80 \
  && $G quantize $d/e.gltf $d/g.gltf && mkdir -p $d/out && $G prune $d/g.gltf $d/out/$f.gltf --keep-leaves && cd ..
# copy the .gltf, .bin and referenced textures into configurator/public/models/, renaming each
# texture to textures/gm2500-<name> and rewriting its uri in the .gltf (avoids clashes between bodies)
```

## gmc2500-crew.gltf (2026-10-11)

Built from a CC-BY model of the 2020+ Sierra HD (Denali) crew cab, standard bed, by
`tools/3d/prepare-gmc2500.py` (shared steps in `tools/3d/bodykit.py`). The source is about
1/2.5 scale and yawed 61 degrees in the ground plane; it is turned to the contract, levelled on
its tire centres, scaled uniformly to the platform's 158.9 in wheelbase (it measured 34.2 in
tires and a 67.5 in track at that scale) and dropped onto the stock tire. Deleted: the grille
GMC, the tailgate GMC and DENALI letters, the DENALI HD fender decals, the DURAMAX / Allison
badges, both Tamaulipas plates, a rear-window sticker, the windshield sun strip, the engine and
its photo plane, all four wheels (tires, rims, caps, brakes), and two trim meshes that sample
texture atlases with GMC lettering in them. Two kept atlases (materials 18 and 46) still contain
painted GMC lettering in regions no remaining mesh is known to show; the configurator draws all
trim in one flat material today, so no texture is visible on the stage. Quantized, no meshopt,
no embedded textures. 3.4 MB, 62k triangles, 28 textures at 1024 or less.

Required credit, which must appear wherever the model is shown:

> This work is based on "GMC SIERRA HD2500"
> (https://sketchfab.com/3d-models/gmc-sierra-hd2500-c31554882b074e168ddc65bd6d1e5464)
> by 01 (https://sketchfab.com/brayaj691) licensed under CC-BY-4.0
> (http://creativecommons.org/licenses/by/4.0/)

- License: CC-BY-4.0, commercial use allowed, author must be credited. Downloaded 2026-10-11 as
  the Sketchfab glTF archive (19 MB). Source in `tools/3d/.source/gmc-sierra-hd2500/` (gitignored).
- Trade dress: badges gone, OEM body shape kept (LAUNCH-CHECKLIST 7.1).

Rebuild:

```
/opt/homebrew/bin/blender -b -P tools/3d/prepare-gmc2500.py -- /tmp/gmc2500
cd configurator && G="npx @gltf-transform/cli" && d=/tmp/gmc2500 && f=gmc2500-crew \
  && $G weld $d/$f.gltf $d/a.gltf && $G simplify $d/a.gltf $d/b.gltf --ratio 0.8 --error 0.0008 \
  && $G resize $d/b.gltf $d/c.gltf --width 1024 --height 1024 && $G webp $d/c.gltf $d/e.gltf --quality 80 \
  && $G quantize $d/e.gltf $d/g.gltf && mkdir -p $d/out && $G prune $d/g.gltf $d/out/$f.gltf --keep-leaves && cd ..
# copy the .gltf, .bin and referenced textures into configurator/public/models/, renaming each
# texture to textures/gmc2500-<name> and rewriting its uri in the .gltf (avoids clashes between bodies)
```

## ram1500-crew.gltf (2026-10-11)

Built from a CC-BY model of the 2021 RAM 1500 TRX crew cab by `tools/3d/prepare-ram1500.py`
(shared steps in `tools/3d/bodykit.py`). The TRX is the right 5th-gen (DT) cab and bed with
wider fender flares and 35 in tires. The source is real scale x0.01 (145.2 in wheelbase, 73.1 in
track, 35.4 in tires); it is scaled to the platform's 144.6 in wheelbase and dropped onto the
platform's 34.1 in stock tire. The hubs sit on the platform's 68.4 in track, so wheels sit about
2.3 in further inboard of the flares than they would under a non-TRX 1500. Deleted: the RAM
letters on the grille and tailgate and the TRX side badges (one Badge mesh), the rear plate,
both wheel meshes, the calipers and the engine. Interior decimated to 30%. Quantized, no
meshopt, no embedded textures. 1.9 MB, 67k triangles.

Required credit, which must appear wherever the model is shown:

> This work is based on "2021-ram-1500-trx"
> (https://sketchfab.com/3d-models/2021-ram-1500-trx-d5dda94744b240d3b29c62c392155320)
> by 007 (https://sketchfab.com/tangwang920) licensed under CC-BY-4.0
> (http://creativecommons.org/licenses/by/4.0/)

- License: CC-BY-4.0, commercial use allowed, author must be credited. Downloaded 2026-10-11 as
  the Sketchfab glTF archive (8 MB). Source in `tools/3d/.source/ram-1500-trx-2021/` (gitignored).
- Trade dress: badges gone, OEM body shape kept (LAUNCH-CHECKLIST 7.1).

Rebuild:

```
/opt/homebrew/bin/blender -b -P tools/3d/prepare-ram1500.py -- /tmp/ram1500
cd configurator && G="npx @gltf-transform/cli" && d=/tmp/ram1500 && f=ram1500-crew \
  && $G weld $d/$f.gltf $d/a.gltf && $G simplify $d/a.gltf $d/b.gltf --ratio 0.6 --error 0.0008 \
  && $G resize $d/b.gltf $d/c.gltf --width 1024 --height 1024 && $G webp $d/c.gltf $d/e.gltf --quality 80 \
  && $G quantize $d/e.gltf $d/g.gltf && mkdir -p $d/out && $G prune $d/g.gltf $d/out/$f.gltf --keep-leaves && cd ..
# copy the .gltf, .bin and referenced textures into configurator/public/models/, renaming each
# texture to textures/ram1500-<name> and rewriting its uri in the .gltf (avoids clashes between bodies)
```

## Earlier stand-ins (retired)

- 2026-10-13: "Lightbody Lifted '85 - Low poly model"
  (https://sketchfab.com/3d-models/lightbody-lifted-85-low-poly-model-67beae18c3d24be68f9c8f0ec382d8e3)
  by Daniel Zhabotinsky (https://sketchfab.com/DanielZhabotinsky), CC-BY-4.0, a fictional
  unbadged pickup that stood in for f250 and f150 via `tools/3d/prepare-lightbody.py`. Source
  kept in `tools/3d/.source/lightbody-lifted-85/` (gitignored); no longer shipped, so no credit
  is shown.
- 2026-10-11: Kenney Car Kit 3.1 `truck.glb`, CC0 1.0 (https://kenney.nl/assets/car-kit), via
  `tools/3d/prepare-truck.py`. Kept for reference; no longer shipped.

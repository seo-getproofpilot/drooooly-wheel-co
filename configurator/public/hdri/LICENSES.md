# HDRI licenses

| File | Built from | Author | Source URL | License | Downloaded |
|---|---|---|---|---|---|
| `outdoor.hdr` | `derelict_airfield_01_1k.hdr` (1024x512 Radiance RGBE) | Alexander Scholten, Poly Haven | https://polyhaven.com/a/derelict_airfield_01 (file: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/derelict_airfield_01_1k.hdr) | Creative Commons Zero, CC0 1.0 (https://polyhaven.com/license) | 2026-10-11 |
| `studio.hdr` | `studio_small_09_1k.hdr` (1024x512 Radiance RGBE) | Poly Haven | https://polyhaven.com/a/studio_small_09 (file: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr) | Creative Commons Zero, CC0 1.0 (https://polyhaven.com/license) | 2026-10-10 |

Every Poly Haven 1K studio HDRI is 1.3 to 1.7 MB, over the 1 MB budget, so `studio.hdr` is the
1K file area-averaged 2x2 down to 512x256 in linear light and re-encoded as RLE RGBE (413 KB).
Reflections soften slightly. That is invisible on paint and acceptable on polished wheels at the
hero distance. Swap in the 1K file if the budget moves.

`outdoor.hdr` is the dark theme's location: a wide asphalt apron, trees on the horizon, sun
about 18 degrees up and warm. The stage projects it onto the ground (three's GroundedSkybox) and
aims its sun light at the sun in the image. The 1K file is 1.42 MB, over the 1.2 MB budget, so it
keeps its full resolution and drops the two low bits of each RGBE mantissa (6 of 8 bits kept,
about 2 percent steps) before RLE re-encoding: 1.18 MB. No banding shows in the sky at the stage's
exposure. Swap in the untouched file if the budget moves.

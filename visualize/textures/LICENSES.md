# Texture licenses

| File | Built from | Author | Source URL | License | Downloaded |
|---|---|---|---|---|---|
| `asphalt_02_diff.webp`, `asphalt_02_nor_gl.webp`, `asphalt_02_rough.webp` | `asphalt_02_diff_1k.jpg`, `asphalt_02_nor_gl_1k.jpg`, `asphalt_02_rough_1k.jpg` (1024x1024) | Rob Tuytel, Poly Haven | https://polyhaven.com/a/asphalt_02 (files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_02/) | Creative Commons Zero, CC0 1.0 (https://polyhaven.com/license) | 2026-10-11 |

The stage's near ground (`AsphaltGround` in `src/scene/Outdoor.tsx`). The scan covers 3 m x 3 m
(api.polyhaven.com/info/asphalt_02 reports 3000 mm), so the stage repeats it every 3 m.

Re-encoded with Pillow to WebP to stay inside the 800 KB budget for new downloads (566 KB in all):
the diffuse at 1024 px, quality 56 (250 KB); the OpenGL normal map at 1024 px, quality 70 (236 KB);
the roughness at 512 px, quality 80, single channel (66 KB). Roughness varies slowly across the
scan, so the half-size map is indistinguishable at the stage's distances.

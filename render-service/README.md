# render-service

Studio shots for the 3D configurator. A shopper asks for a still of the exact build and camera
they are looking at. This service loads its own baked copy of `visualize/` in headless Chromium
with `?export=1&poster=1`, moves the camera there, exports the truck and wheels as a binary glTF,
path-traces it in Blender Cycles with `tools/3d/render-offline.py`, and caches a JPEG with the
body's CC BY credit drawn on the bottom edge.

The API and the key format are fixed in `docs/superpowers/specs/2026-10-13-studio-shot-design.md`.
The client side lives in `configurator/src/data/render.ts`.

## Env

| Name | Default | Notes |
|---|---|---|
| `PORT` | `8080` | |
| `RENDER_SAMPLES` | `32` | Cycles samples (adaptive sampling and OpenImageDenoise are on) |
| `RENDER_LONG_SIDE` | `1400` | long side of the still in px; the short side follows the request's aspect |
| `RENDER_DEVICE` | `CPU` | `auto` picks Metal, OptiX, CUDA or HIP when present |
| `RENDER_CACHE_DIR` | `/data/stills` in the image, `./cache` locally | `<sha256>.jpg` plus `<sha256>.json` per still |
| `PUBLIC_URL` | request host | prefix for the `url` field |
| `ALLOWED_ORIGINS` | `*` | comma list for CORS |
| `BLENDER_BIN` | `/opt/blender/blender` | |
| `VISUALIZE_DIR` | `../visualize` | the baked configurator, served at `/visualize/` |
| `RENDER_SCRIPT` | `../tools/3d/render-offline.py` | |
| `EXPORT_TIMEOUT_MS` | `180000` | page load plus glTF export, per job |
| `EXPORT_VIEW_LONG_SIDE` | `640` | headless viewport; SwiftShader frames cost about 3x more at 1200 |

One Blender render runs at a time and the next export overlaps it. Identical requests share a job.
The queue holds 20 jobs, and each address gets 6 new requests a minute. Polls never count.

## Run locally

```
cd render-service && npm install
BLENDER_BIN=/opt/homebrew/bin/blender RENDER_DEVICE=auto RENDER_CACHE_DIR=./cache npm start
curl -X POST localhost:8080/api/stills -H 'content-type: application/json' \
  -d '{"build":"v=f250&y=2021&p=race-red&l=4&b=jtx&m=Ace&s=26x14&f=polished&t=37x13.50R26","camera":{"position":[3.6,1,3],"target":[0,0.93,-1.9],"fov":28,"aspect":1.6}}'
```

Poll `GET /api/stills/<key>` until `status` is `done`, then open the `url`.
`npm test` runs the unit tests with no Blender or browser needed.

Rebuild the configurator (`cd configurator && npm run build`) before running if `visualize/` is
stale, since the service renders whatever is baked there.

## Railway

The `render` service builds `render-service/Dockerfile` with the repo root as context
(`rootDirectory` `/`, `dockerfilePath` `render-service/Dockerfile`). The image carries Node 22,
Playwright's Chromium headless shell, Blender 5.2 LTS (checksum-pinned), this folder, the render
script and `visualize/`, so the renderer and the page are always the same version. Mount a volume
at `/data` for the cache. A redeploy keeps the stills, and a missing still re-renders from its URL.

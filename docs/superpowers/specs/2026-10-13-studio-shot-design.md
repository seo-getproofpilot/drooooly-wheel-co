# Studio shot: on-demand path-traced stills from the live configurator

Written 2026-10-13. Decided after the turntable-versus-stills comparison: the live 3D
configurator stays, and a shopper can ask for a studio-quality still of the exact build and
camera they are looking at. A pre-rendered library is out (531,000 builds, 2.65M frames at
five angles). This is how configurators with "high-quality photo" buttons work: the 3D view is
instant, the photo takes a minute and arrives in place.

## Shape

1. **Client** (`configurator/`). A "Studio shot" button next to Share. On click it captures the
   build (the same query string a share link carries) and the camera the visitor is looking
   through (position, target, fov, aspect), asks the render service for that still, shows
   progress without leaving the 3D view, then shows the still in a lightbox with Save and
   Share. The still's URL is the share payload; it stays valid because the service re-renders a
   missing still from its own URL.
2. **Render service** (`render-service/`, a Railway service named `render` in the storefront
   project, Docker, CPU). Node + Playwright Chromium + Blender. For a request it loads its own
   copy of the built configurator (`visualize/` is baked into the image, so renderer and page
   are always the same version) headless with `?export=1`, sets the camera, calls
   `window.__droooly.exportScene()` to get the binary glTF, path-traces it with
   `tools/3d/render-offline.py` in Cycles, encodes a JPEG and caches it on the volume at
   `/data/stills`.

## API (fixed contract between the two tracks)

The key is the request itself: `key = base64url(JSON.stringify({ b: build, c: camera }))`, with
`build` the share query string without the leading `?` and with `export`, `post`, `poster` keys
removed, and `camera` rounded to 3 decimals (position, target), fov and aspect to 3 decimals.
The service also accepts a sha256 of the key as an alias once it has seen the key.

- `POST /api/stills` body `{ build: string, camera: { position: [x,y,z], target: [x,y,z], fov: number, aspect: number } }`
  Returns `202 { key, status: "queued" | "running", position: number, etaSeconds: number, url }` or
  `200 { key, status: "done", url }` when cached. `url` is absolute (`PUBLIC_URL` + `/stills/<key>.jpg`).
  `429` with `{ error }` when the queue is full (cap 20) or the client exceeds 6 requests a minute.
- `GET /api/stills/<key>` same body shape; `status: "error"` with `{ error }` if the render failed.
- `GET /stills/<key>.jpg` the image when done (`Cache-Control: public, max-age=31536000, immutable`);
  `202` with the JSON status while rendering (it queues the render if nobody asked yet, so a
  shared link survives a cache wipe); `404` for a malformed key.
- `GET /api/health` `{ ok: true, blender: "<version>", queue: n, running: n, cache: n }`.
- CORS: `ALLOWED_ORIGINS` env (comma list) sets `Access-Control-Allow-Origin` per request; `*`
  when unset. `OPTIONS` preflight answered.

Env: `PORT` (8080), `RENDER_SAMPLES` (32), `RENDER_LONG_SIDE` (1400), `RENDER_CACHE_DIR`
(`/data/stills`), `ALLOWED_ORIGINS`, `PUBLIC_URL`, `BLENDER_BIN` (default `/opt/blender/blender`),
`RENDER_DEVICE` (`CPU` default; `auto` on a GPU host).

Render size: the long side is `RENDER_LONG_SIDE`, the short side follows the request's aspect
(portrait phones get a portrait still). One Blender render at a time; exports can overlap it.

## Client behaviour

- Button label "Studio shot". While waiting: "Rendering your studio shot. About a minute." with
  the queue position when it is above 1. The 3D view stays live.
- Done: a lightbox over the stage with the JPEG, "Save photo" (download) and "Copy link" (the
  still URL). Closing it returns to the 3D view. The build is unchanged.
- Error or timeout (3 minutes): "The studio shot did not come back. The 3D view is still yours;
  try again in a minute." No modal, no warning styling beyond the status line.
- Service URL: `RENDER_URL` in `configurator/src/data/render.ts`, staging
  `https://render-staging-3d31.up.railway.app`, with `?render=<origin>` as a dev override and
  `http://localhost:8080` when the page runs on localhost.
- Never on the poster fallback (no WebGL, no camera).

## Rules carried over

No "guaranteed fit" anywhere, no modal warnings, the CC-BY body credit stays visible on the
still (the service draws the credit line of the body on the image's bottom edge in small type,
because the license requires it wherever the model is shown).

## Verification

- Service: unit tests for the key encode/decode and the queue; a local end-to-end run against the
  built `visualize/` with the Mac's Blender; `docker build` of the image.
- Client: unit tests for the request builder and the status machine; e2e for the button with a
  mocked service; slopcheck on copy.
- Staging: `POST` to the live service from the staging page produces a JPEG.

"""Studio shot GPU renderer on Modal: Blender 5.2 LTS Cycles on an NVIDIA L4.

The Railway render service exports the glTF with headless Chromium, then (when
RENDER_REMOTE_URL is set) posts it here instead of running its own CPU Blender.
Same script, same assets, same image; only the device changes.

    modal deploy render-service/modal_render.py      # from the repo root
    modal secret create droooly-render RENDER_SHARED_KEY=<random>

POST <url>?samples=32&width=1400&height=875
    headers  x-render-key: <RENDER_SHARED_KEY>
             x-render-camera: {"position":[..],"target":[..],"fov":28,"aspect":1.6}
    body     the binary glTF (application/octet-stream)
    reply    200 image/png, header x-render-result: {"render_s":..,"device":"OPTIX",..}
             401 bad key, 400 bad camera or empty body, 500 with the Blender tail

The container stays warm for SCALEDOWN_S after a request, so a shopper's second
still skips the cold start (about 20 s: container boot plus Blender's first
kernel load).
"""
import hmac
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

import modal
from fastapi import Request, Response  # also needed locally: uv tool install modal --with "fastapi[standard]"

REPO = Path(__file__).resolve().parent.parent
BLENDER_VERSION = "5.2.2"
BLENDER_SHA256 = "84098912789dc450e95697c4184fb8a90acbe5111c2ba4aede3fecb57806a168"
GPU = os.environ.get("DROOOLY_RENDER_GPU", "L4")
SCALEDOWN_S = 180
MAX_GLB_BYTES = 64 * 1024 * 1024

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install(
        "ca-certificates", "curl", "xz-utils",
        "libxi6", "libxxf86vm1", "libxfixes3", "libxrender1", "libgl1", "libxkbcommon0",
        "libsm6", "libice6", "libegl1", "libgomp1",
    )
    .run_commands(
        "curl -fsSL -o /tmp/blender.tar.xz "
        f"https://download.blender.org/release/Blender{BLENDER_VERSION.rsplit('.', 1)[0]}/blender-{BLENDER_VERSION}-linux-x64.tar.xz",
        f"echo '{BLENDER_SHA256}  /tmp/blender.tar.xz' | sha256sum -c -",
        "mkdir -p /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 && rm /tmp/blender.tar.xz",
        "/opt/blender/blender --version | head -1",
    )
    .pip_install("fastapi[standard]==0.115.12")
    .add_local_file(REPO / "tools" / "3d" / "render-offline.py", "/app/tools/3d/render-offline.py")
    .add_local_dir(REPO / "visualize" / "hdri", "/app/visualize/hdri")
    .add_local_dir(REPO / "visualize" / "textures", "/app/visualize/textures")
)

app = modal.App("droooly-render", image=image)


def _bad(status: int, error: str):
    from fastapi.responses import JSONResponse
    return JSONResponse({"error": error}, status_code=status)


@app.function(
    gpu=GPU,
    timeout=300,
    scaledown_window=SCALEDOWN_S,
    max_containers=3,
    secrets=[modal.Secret.from_name("droooly-render")],
)
@modal.fastapi_endpoint(method="POST")
async def render(request: Request):
    expected = os.environ.get("RENDER_SHARED_KEY", "")
    given = request.headers.get("x-render-key", "")
    if not expected or not hmac.compare_digest(given, expected):
        return _bad(401, "bad render key")
    try:
        camera = json.loads(request.headers.get("x-render-camera", ""))
        position, target = camera["position"], camera["target"]
        fov, aspect = float(camera["fov"]), float(camera["aspect"])
        if len(position) != 3 or len(target) != 3 or not (1 < fov < 179) or not (0.1 < aspect < 10):
            raise ValueError("camera out of range")
    except (ValueError, KeyError, TypeError) as e:
        return _bad(400, f"bad camera: {e}")
    q = request.query_params
    try:
        samples = max(1, min(512, int(q.get("samples", "32"))))
        width = max(64, min(4096, int(q.get("width", "1400"))))
        height = max(64, min(4096, int(q.get("height", "875"))))
    except ValueError as e:
        return _bad(400, f"bad size: {e}")
    glb = await request.body()
    if not glb or len(glb) > MAX_GLB_BYTES:
        return _bad(400, f"glb must be 1 to {MAX_GLB_BYTES} bytes")

    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix="still-") as d:
        glb_path, cam_path, out = f"{d}/scene.glb", f"{d}/camera.json", f"{d}/out.png"
        Path(glb_path).write_bytes(glb)
        Path(cam_path).write_text(json.dumps({"position": position, "target": target, "fov": fov, "aspect": aspect,
                                              "width": width, "height": height}))
        args = ["/opt/blender/blender", "-b", "--factory-startup", "-P", "/app/tools/3d/render-offline.py", "--",
                glb_path, cam_path, out, "--samples", str(samples), "--width", str(width), "--height", str(height),
                "--device", "auto"]
        env = {**os.environ, "DROOOLY_ASSET_ROOT": "/app/visualize"}
        p = subprocess.run(args, cwd=d, env=env, capture_output=True, text=True, timeout=280)
        if p.returncode != 0 or not Path(out).exists():
            tail = " | ".join([l for l in (p.stderr or p.stdout).strip().splitlines() if l][-3:])
            print(f"render failed ({p.returncode}): {tail}")
            return _bad(500, f"blender exited {p.returncode}: {tail[:400]}")
        result = {}
        for line in p.stdout.splitlines():
            if line.startswith("render-offline: RESULT "):
                result = json.loads(line[len("render-offline: RESULT "):])
        png = Path(out).read_bytes()
    result["total_s"] = round(time.time() - t0, 2)
    result["glb_bytes"] = len(glb)
    print(f"still {width}x{height} {samples} spp {result.get('device')} render {result.get('render_s')} s total {result['total_s']} s")
    return Response(content=png, media_type="image/png", headers={"x-render-result": json.dumps(result)})

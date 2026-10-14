import assert from "node:assert/strict";
import { test } from "node:test";
import { renderStillRemote } from "../src/render.js";

const camera = { position: [3.6, 1, 3], target: [0, 0.93, -1.9], fov: 28, aspect: 1.6 };
const glb = Buffer.from("glTF-bytes");

test("remote render posts the glb with the camera header and size query, returns the png", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url: String(url), init };
    return new Response(Buffer.from("png-bytes"), { status: 200, headers: { "x-render-result": JSON.stringify({ render_s: 12.5, device: "OPTIX" }) } });
  };
  const r = await renderStillRemote({ glb, camera, url: "https://example.modal.run/", key: "k", samples: 32, longSide: 1400, fetchImpl });
  const u = new URL(seen.url);
  assert.equal(u.searchParams.get("samples"), "32");
  assert.equal(u.searchParams.get("width"), "1400");
  assert.equal(u.searchParams.get("height"), "876");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers["x-render-key"], "k");
  assert.deepEqual(JSON.parse(seen.init.headers["x-render-camera"]), camera);
  assert.equal(seen.init.body, glb);
  assert.equal(r.png.toString(), "png-bytes");
  assert.equal(r.device, "OPTIX");
  assert.equal(r.blenderRenderS, 12.5);
});

test("remote render rejects with the service's error on a non-200", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: "bad render key" }), { status: 401 });
  await assert.rejects(
    renderStillRemote({ glb, camera, url: "https://example.modal.run/", key: "wrong", samples: 32, longSide: 1400, fetchImpl }),
    /remote render 401: bad render key/,
  );
});

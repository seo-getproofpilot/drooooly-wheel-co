import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { encodeStill, overlaySvg, stillSize } from "../src/render.js";

const CREDIT = "Based on \"Ford F-450 Twin Turbo 2021\" by DR1KING100K, CC BY 4.0";

test("still size follows the aspect with the long side fixed", () => {
  assert.deepEqual(stillSize(1.6, 1600), { width: 1600, height: 1000 });
  assert.deepEqual(stillSize(1.45, 1600), { width: 1600, height: 1104 });
  assert.deepEqual(stillSize(0.5, 1600), { width: 800, height: 1600 });
});

test("overlay escapes the credit and carries the brand line", () => {
  const svg = overlaySvg(1600, 1000, CREDIT + " <&>");
  assert.match(svg, /&quot;Ford F-450 Twin Turbo 2021&quot;/);
  assert.match(svg, /&lt;&amp;&gt;/);
  assert.match(svg, /DROOOLY · 3D preview/);
  assert.match(svg, /font-size="13"/);
  assert.match(svg, /fill-opacity="0.6"/);
});

test("encode: PNG in, progressive JPEG out, bottom band darkened, top untouched", async () => {
  const png = await sharp({ create: { width: 400, height: 250, channels: 3, background: { r: 200, g: 200, b: 200 } } }).png().toBuffer();
  const jpeg = await encodeStill(png, CREDIT);
  const meta = await sharp(jpeg).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.isProgressive, true);
  assert.deepEqual([meta.width, meta.height], [400, 250]);
  const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => data[(y * info.width + x) * info.channels];
  assert.ok(Math.abs(px(200, 10) - 200) < 6, "top is the render");
  assert.ok(px(200, 248) < 120, "bottom band is dark");
  // some white text pixels inside the band on the left (the credit)
  let bright = 0;
  for (let x = 5; x < 200; x++) for (let y = 230; y < 250; y++) if (px(x, y) > 180) bright++;
  assert.ok(bright > 10, `credit text drawn (${bright} bright pixels)`);
});

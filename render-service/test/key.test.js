import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanBuild, decodeKey, encodeKey, isHash, keyHash, roundCamera, validateRequest } from "../src/key.js";

const BUILD = "v=f250&y=2021&p=race-red&l=4&b=jtx&m=Ace&s=26x14&f=polished&t=37x13.50R26";
const CAM = { position: [3.6, 1.0, 3.0], target: [0, 0.93, -1.9], fov: 28, aspect: 1.6 };

test("key is base64url of { b, c } and round-trips", () => {
  const key = encodeKey(BUILD, CAM);
  assert.equal(key, Buffer.from(JSON.stringify({ b: BUILD, c: CAM })).toString("base64url"));
  assert.match(key, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeKey(key), { build: BUILD, camera: CAM });
});

test("build drops ?, export, post and poster, keeps parts raw", () => {
  assert.equal(cleanBuild(`?${BUILD}&export=1&post=1&poster=1`), BUILD);
  assert.equal(cleanBuild("v=f250&m=Big%20Ace&&poster=1"), "v=f250&m=Big%20Ace");
  assert.equal(encodeKey(`?export=1&${BUILD}`, CAM), encodeKey(BUILD, CAM));
});

test("camera rounds to 3 decimals and writes -0 as 0", () => {
  const c = roundCamera({ position: [1.23456, -0.0001, 2], target: [0, 0, -1.9004], fov: 28.00049, aspect: 1.45678 });
  assert.deepEqual(c, { position: [1.235, 0, 2], target: [0, 0, -1.9], fov: 28, aspect: 1.457 });
  assert.ok(!Object.is(c.position[1], -0));
  assert.equal(encodeKey(BUILD, { ...CAM, position: [3.60001, 1, 3] }), encodeKey(BUILD, CAM));
});

test("key matches the client's encoding (camera key order position, target, fov, aspect)", () => {
  const json = `{"b":"${BUILD}","c":{"position":[3.6,1,3],"target":[0,0.93,-1.9],"fov":28,"aspect":1.6}}`;
  assert.equal(encodeKey(BUILD, CAM), Buffer.from(json).toString("base64url"));
});

test("malformed and non-canonical keys do not decode", () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  assert.equal(decodeKey(""), null);
  assert.equal(decodeKey("not a key!"), null);
  assert.equal(decodeKey(Buffer.from("{nope").toString("base64url")), null);
  assert.equal(decodeKey(b64({ b: BUILD })), null);
  assert.equal(decodeKey(b64({ b: BUILD, c: { ...CAM, fov: 500 } })), null);
  assert.equal(decodeKey(b64({ b: "y=2021", c: CAM })), null, "no vehicle");
  assert.equal(decodeKey(b64({ b: BUILD, c: { ...CAM, position: [3.60001, 1, 3] } })), null, "unrounded");
  assert.equal(decodeKey(b64({ c: CAM, b: BUILD })), null, "keys out of order");
  assert.equal(decodeKey(b64({ b: `${BUILD}&poster=1`, c: CAM })), null, "page-only key left in");
  assert.equal(decodeKey(b64({ b: "v=f250&x=<script>", c: CAM })), null, "unsafe characters");
  assert.equal(decodeKey("A".repeat(5000)), null);
});

test("request validation names the problem", () => {
  assert.match(validateRequest(null).error, /body/);
  assert.match(validateRequest({ build: 1, camera: CAM }).error, /build/);
  assert.match(validateRequest({ build: BUILD, camera: { ...CAM, position: [1, 2] } }).error, /position/);
  assert.match(validateRequest({ build: BUILD, camera: { ...CAM, target: [0, Number.NaN, 0] } }).error, /position/);
  assert.match(validateRequest({ build: BUILD, camera: { ...CAM, aspect: 10 } }).error, /aspect/);
  assert.match(validateRequest({ build: BUILD, camera: { ...CAM, target: CAM.position } }).error, /coincide/);
  assert.deepEqual(validateRequest({ build: `?${BUILD}&export=1`, camera: CAM }), { build: BUILD, camera: CAM });
});

test("sha256 alias", () => {
  const h = keyHash(encodeKey(BUILD, CAM));
  assert.ok(isHash(h));
  assert.ok(!isHash("abc"));
});

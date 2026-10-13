import { describe, it, expect } from "vitest";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { WheelSet, tireSpan, DECAL_FULL, DECAL_GONE } from "../src/scene/WheelSet";
import { rakeFor, FACTORY_RAKE_DEG } from "../src/scene/Truck";
import { paintMaterial } from "../src/scene/paint";
import { PRESETS, CAMERA_CHIPS, framedView, frameBox, wheelView, FOV, MAX_POLAR, MIN_POLAR, type CameraPreset } from "../src/scene/cameras";
import { Pins, PIN_MAX_W } from "../src/scene/Pins";
import { STAGE_BG_DARK, TURNTABLE_SECONDS, RESUME_MS } from "../src/scene/Stage";
import { sunDirection, HDRI_SUN, OUTDOOR_EXPOSURE, GROUND, MIN_POST_FPS, GradeEffect } from "../src/scene/Outdoor";
import { Box3, Object3D, PerspectiveCamera, Vector3 } from "three";
import { fit } from "../src/fitment/fitment3d";
import { loadCatalog } from "../src/data/catalog";

const v = loadCatalog().vehicles.find(x => x.id === "f250")!;
const style = { spokes: 6, spokeWidth: 0.5, dish: 0.3, split: false };

/* The assemblies mount through <primitive>, so their children are plain
   three objects, not test-renderer instances. */
const brakes = (r: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) => {
  const out: Object3D[] = [];
  for (const c of r.scene.findAllByProps({ name: "corner" })) (c.instance as Object3D).traverse((o) => { if (o.name === "brake") out.push(o); });
  return out;
};

describe("WheelSet", () => {
  it("mounts four wheel groups for a single truck", async () => {
    const f = fit({ vehicle: v, liftIn: 0, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" });
    const r = await ReactThreeTestRenderer.create(<WheelSet fit={f} style={style} finish="polished" tread="AT" />);
    expect(r.scene.findAllByProps({ name: "corner" }).length).toBe(4);
  });
  it("mounts six for a dually and mirrors the -X side", async () => {
    const f = fit({ vehicle: v, liftIn: 0, wheel: { diaIn: 20, widthIn: 8.25, offsetMm: 0 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "dually" });
    const r = await ReactThreeTestRenderer.create(<WheelSet fit={f} style={style} finish="black" tread="MT" />);
    const corners = r.scene.findAllByProps({ name: "corner" });
    expect(corners.length).toBe(6);
    for (const c of corners) expect(Math.sign(c.instance.scale.x)).toBe(c.instance.position.x < 0 ? -1 : 1);
  });
  it("mounts one brake per hub: four on a single truck, four on a dually (inner wheels share the hub)", async () => {
    const single = fit({ vehicle: v, liftIn: 0, wheel: { diaIn: 24, widthIn: 14, offsetMm: -76 }, tire: { od: 37, section: 13.5, rim: 24 }, config: "single" });
    const r1 = await ReactThreeTestRenderer.create(<WheelSet fit={single} style={style} finish="polished" tread="MT" />);
    expect(brakes(r1).length).toBe(4);
    const dually = fit({ vehicle: v, liftIn: 0, wheel: { diaIn: 20, widthIn: 8.25, offsetMm: 0 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "dually" });
    const r2 = await ReactThreeTestRenderer.create(<WheelSet fit={dually} style={style} finish="black" tread="MT" />);
    expect(brakes(r2).length).toBe(4);
  });
  it("puts 10 lug nuts on a dually and the vehicle's count when given its bolt pattern", async () => {
    const lugsOf = (r: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) => {
      const out = new Set<number>();
      for (const c of r.scene.findAllByProps({ name: "corner" })) (c.instance as Object3D).traverse((o) => { if (o.name === "wheel") out.add(o.userData.lugs); });
      return [...out];
    };
    const dually = fit({ vehicle: v, liftIn: 0, wheel: { diaIn: 20, widthIn: 8.25, offsetMm: 0 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "dually" });
    expect(lugsOf(await ReactThreeTestRenderer.create(<WheelSet fit={dually} style={style} finish="polished" tread="MT" />))).toEqual([10]);
    const single = fit({ vehicle: v, liftIn: 0, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" });
    expect(lugsOf(await ReactThreeTestRenderer.create(<WheelSet fit={single} style={style} finish="polished" tread="AT" />))).toEqual([8]);
    expect(lugsOf(await ReactThreeTestRenderer.create(<WheelSet fit={single} style={style} finish="polished" tread="AT" bolt="6x135" />))).toEqual([6]);
  });
  it("seats each brake behind the wheel face, inside the barrel", async () => {
    const f = fit({ vehicle: v, liftIn: 0, wheel: { diaIn: 24, widthIn: 14, offsetMm: -76 }, tire: { od: 37, section: 13.5, rim: 24 }, config: "single" });
    const r = await ReactThreeTestRenderer.create(<WheelSet fit={f} style={style} finish="polished" tread="MT" />);
    const found = brakes(r);
    expect(found.length).toBe(4);
    for (const b of found) {
      const wheel = b.parent!.children.find((c) => c.name === "wheel")!;
      expect(b.position.x).toBeLessThan((wheel.userData.faceFrontIn as number) * 0.0254);
      expect(b.position.x).toBeLessThanOrEqual((wheel.userData.hubBackIn as number) * 0.0254);
    }
  });
});

describe("sidewall lettering fade", () => {
  it("shows at the wheel close-up on desktop and phone, hides at the whole-truck front view", () => {
    const r = 0.444; // 35 in tire
    const wheelDesk = wheelView(1280 / 800, [1, 0.55, 0], r * 2.1);
    const wheelPhone = wheelView(390 / 560, [1, 0.55, 0], r * 2.1);
    const dist = (p: number[]) => new Vector3(...(p as [number, number, number])).distanceTo(new Vector3(1, 0.44, 0));
    expect(tireSpan(r, dist(wheelDesk.position), FOV, 1280, 800)).toBeGreaterThan(DECAL_FULL);
    expect(tireSpan(r, dist(wheelPhone.position), FOV, 390, 560)).toBeGreaterThan(DECAL_FULL);
    const box = new Box3(new Vector3(-1.02, 0, -5.3), new Vector3(1.02, 2.05, 1.25));
    const front = framedView("front", 1280 / 800, box);
    expect(tireSpan(r, dist(front.position), FOV, 1280, 800)).toBeLessThan(DECAL_GONE);
  });
});

describe("Pins", () => {
  const f = fit({ vehicle: v, liftIn: 0, wheel: { diaIn: 26, widthIn: 14, offsetMm: -76 }, tire: { od: 37, section: 13.5, rim: 26 }, config: "single" });
  it("anchors at the driver's front wheel centre", async () => {
    const r = await ReactThreeTestRenderer.create(<Pins fit={f} headline="26x14 -76" line2="JTX Silencer, polished" line3="stance" visible />);
    const fl = f.corners.find((c) => c.name === "FL")!;
    expect(fl.x).toBeGreaterThan(0);
    const g = r.scene.children[0];
    expect(g).toBeTruthy();
    expect([g.instance.position.x, g.instance.position.y, g.instance.position.z]).toEqual([fl.x, fl.y, fl.z]);
    expect(PIN_MAX_W).toBe(240);
  });
  it("renders nothing when hidden", async () => {
    const r = await ReactThreeTestRenderer.create(<Pins fit={f} headline="26x14 -76" visible={false} />);
    expect(r.scene.children.length).toBe(0);
  });
});

describe("outdoor location", () => {
  it("the sun keeps the HDRI's 18 degree elevation and stands on the driver's side, behind the front axle", () => {
    const s = sunDirection();
    expect(Math.asin(s.y) * 180 / Math.PI).toBeCloseTo(Math.asin(HDRI_SUN[1]) * 180 / Math.PI, 1);
    expect(Math.asin(s.y) * 180 / Math.PI).toBeGreaterThan(15);
    expect(s.x).toBeGreaterThan(0.8);
    expect(s.z).toBeLessThan(0);
  });
  it("tuning stays in sane photographic ranges and the guard is 30 fps", () => {
    expect(OUTDOOR_EXPOSURE).toBeGreaterThan(0.6);
    expect(OUTDOOR_EXPOSURE).toBeLessThan(1.4);
    expect(GROUND.radius).toBeGreaterThan(40); // past the farthest phone camera
    expect(MIN_POST_FPS).toBe(30);
    const g = new GradeEffect(0.9, 1);
    expect(g.uniforms.get("exposure")!.value).toBe(0.9);
  });
});

describe("stage", () => {
  it("dark backdrop and turntable timing match the brief", () => {
    expect(STAGE_BG_DARK).toBe("#0b0b0c");
    expect(TURNTABLE_SECONDS).toBe(8);
    expect(RESUME_MS).toBe(3000);
  });
});

describe("rakeFor", () => {
  it("stock trucks carry the factory nose-down rake, leveled is flat", () => {
    expect(FACTORY_RAKE_DEG).toBeCloseTo(1.2, 5);
    expect(rakeFor(false, 0)).toBeCloseTo(1.2, 5);
    expect(rakeFor(true, 0)).toBe(0);
  });
  it("a full lift raises both ends, so the rake stays", () => {
    expect(rakeFor(false, 6)).toBeCloseTo(1.2, 5);
    expect(rakeFor(true, 6)).toBe(0);
  });
});

describe("paintMaterial", () => {
  it("is a clearcoat physical paint with a shared tiled flake normal", () => {
    const a = paintMaterial("#8e1b22"), b = paintMaterial("#0d0f13");
    expect(a.clearcoat).toBe(1);
    expect(a.clearcoatRoughness).toBeCloseTo(0.03, 5);
    expect(a.metalness).toBeCloseTo(0.6, 5);
    expect(a.roughness).toBeCloseTo(0.45, 5);
    expect(a.color.getHexString()).toBe(new (a.color.constructor as any)("#8e1b22").getHexString());
    expect(a.normalMap).toBeTruthy();
    expect(a.normalMap).toBe(b.normalMap);
    expect(a.normalMap!.repeat.x).toBe(40);
  });
});

describe("camera presets", () => {
  it("never puts a preset camera under the floor", () => {
    for (const p of Object.values(PRESETS)) expect(p.position[1]).toBeGreaterThan(0.2);
    expect(Object.keys(PRESETS).sort()).toEqual(["front", "hero", "rear", "side", "threeQuarter", "wheel"]);
  });
  it("hero is an alias of front", () => {
    expect(PRESETS.hero).toEqual(PRESETS.front);
  });
  it("chips run Front, Three-quarter, Side, Rear, Wheel", () => {
    expect(CAMERA_CHIPS.map((c) => c.key)).toEqual(["front", "threeQuarter", "side", "rear", "wheel"]);
    expect(CAMERA_CHIPS.map((c) => c.label)).toEqual(["Front", "Three-quarter", "Side", "Rear", "Wheel"]);
  });
  it("front is lower than three-quarter, both on the driver's side ahead of the front axle", () => {
    expect(PRESETS.front.position[1]).toBeLessThan(PRESETS.threeQuarter.position[1]);
    for (const k of ["front", "threeQuarter"] as const) {
      expect(PRESETS[k].position[0]).toBeGreaterThan(0);
      expect(PRESETS[k].position[2]).toBeGreaterThan(0);
    }
  });
});

describe("framedView", () => {
  const box = new Box3(new Vector3(-1.02, 0, -5.3), new Vector3(1.02, 2.05, 1.25));
  const inside = (pos: number[], target: number[], aspect: number, b: Box3 = box) => {
    const cam = new PerspectiveCamera(FOV, aspect, 0.1, 200);
    cam.position.set(pos[0], pos[1], pos[2]); cam.lookAt(new Vector3(...(target as [number, number, number]))); cam.updateMatrixWorld();
    const pts = [b.min.x, b.max.x].flatMap(x => [b.min.y, b.max.y].flatMap(y => [b.min.z, b.max.z].map(z => new Vector3(x, y, z).project(cam))));
    return pts.every(n => Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1);
  };
  it("frames the whole truck on desktop and phone, further back on the phone", () => {
    const desk = framedView("threeQuarter", 1280 / 800, box), phone = framedView("threeQuarter", 390 / 560, box);
    expect(inside(desk.position, desk.target, 1280 / 800)).toBe(true);
    expect(inside(phone.position, phone.target, 390 / 560)).toBe(true);
    const dist = (v: { position: number[]; target: number[] }) => new Vector3(...(v.position as [number, number, number])).distanceTo(new Vector3(...(v.target as [number, number, number])));
    expect(dist(phone)).toBeGreaterThan(dist(desk));
  });
  it("the front hero on a phone frames the cab and front wheel, not the whole truck", () => {
    const aspect = 390 / 560;
    const cropped = frameBox("front", aspect, box), full = frameBox("front", 1280 / 800, box);
    expect(full).toBe(box);
    expect(cropped.max.z).toBe(box.max.z);
    expect(cropped.min.z).toBeGreaterThan(box.min.z);
    expect(cropped.min.z).toBeLessThan(-1); // the front wheel at z = 0 and the cab stay in
    const hero = framedView("hero", aspect, box), whole = framedView("threeQuarter", aspect, box);
    expect(inside(hero.position, hero.target, aspect, cropped)).toBe(true);
    const dist = (v: { position: number[]; target: number[] }) => new Vector3(...(v.position as [number, number, number])).distanceTo(new Vector3(...(v.target as [number, number, number])));
    expect(dist(hero)).toBeLessThan(dist(whole));
  });
  it("leaves the wheel close-up alone", () => {
    expect(framedView("wheel", 0.5, box)).toEqual(PRESETS.wheel);
  });
  it("every whole-truck preset frames the truck inside the orbit limits on desktop and phone", () => {
    for (const k of ["front", "threeQuarter", "side", "rear"] as CameraPreset[]) {
      for (const aspect of [1280 / 800, 390 / 560]) {
        const view = framedView(k, aspect, box);
        expect(inside(view.position, view.target, aspect, frameBox(k, aspect, box))).toBe(true);
        const d = new Vector3(...(view.position as [number, number, number])).sub(new Vector3(...(view.target as [number, number, number])));
        const polar = Math.acos(d.y / d.length());
        expect(polar).toBeGreaterThanOrEqual(MIN_POLAR - 1e-6);
        expect(polar).toBeLessThanOrEqual(MAX_POLAR + 1e-6);
      }
    }
  });
  it("the wheel close-up looks at the wheel face from outboard", () => {
    const w = wheelView(1280 / 800, [1.0, 0.5, 0], 0.9);
    expect(w.position[0]).toBeGreaterThan(1.0 + 0.5);
  });
});

import { describe, it, expect } from "vitest";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { WheelSet } from "../src/scene/WheelSet";
import { rakeFor, FACTORY_RAKE_DEG } from "../src/scene/Truck";
import { paintMaterial } from "../src/scene/paint";
import { PRESETS, framedView, FOV } from "../src/scene/cameras";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { fit } from "../src/fitment/fitment3d";
import { loadCatalog } from "../src/data/catalog";

const v = loadCatalog().vehicles.find(x => x.id === "f250")!;
const style = { spokes: 6, spokeWidth: 0.5, dish: 0.3, split: false };

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
    expect(Object.keys(PRESETS).sort()).toEqual(["hero", "rear", "side", "wheel"]);
  });
});

describe("framedView", () => {
  const box = new Box3(new Vector3(-1.02, 0, -5.3), new Vector3(1.02, 2.05, 1.25));
  const inside = (pos: number[], target: number[], aspect: number) => {
    const cam = new PerspectiveCamera(FOV, aspect, 0.1, 200);
    cam.position.set(pos[0], pos[1], pos[2]); cam.lookAt(new Vector3(...(target as [number, number, number]))); cam.updateMatrixWorld();
    const pts = [box.min.x, box.max.x].flatMap(x => [box.min.y, box.max.y].flatMap(y => [box.min.z, box.max.z].map(z => new Vector3(x, y, z).project(cam))));
    return pts.every(n => Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1);
  };
  it("frames the whole truck on desktop and phone, further back on the phone", () => {
    const desk = framedView("hero", 1280 / 800, box), phone = framedView("hero", 390 / 560, box);
    expect(inside(desk.position, desk.target, 1280 / 800)).toBe(true);
    expect(inside(phone.position, phone.target, 390 / 560)).toBe(true);
    const dist = (v: { position: number[]; target: number[] }) => new Vector3(...(v.position as [number, number, number])).distanceTo(new Vector3(...(v.target as [number, number, number])));
    expect(dist(phone)).toBeGreaterThan(dist(desk));
  });
  it("leaves the wheel close-up alone", () => {
    expect(framedView("wheel", 0.5, box)).toEqual(PRESETS.wheel);
  });
});

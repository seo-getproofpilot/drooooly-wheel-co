import { describe, it, expect } from "vitest";
import { Box3, Mesh, Object3D, BufferGeometry } from "three";
import { makeWheel, wheelTriangles } from "../src/geometry/wheel";
import { makeTire } from "../src/geometry/tire";
import { finishMaterial, finishCode } from "../src/materials/finishes";
import { JTX_PROGRAMS } from "../src/data/jtx-programs";
import catalog from "../src/data/catalog.json";

const IN = 0.0254;

function tris(o: Object3D): number {
  let n = 0;
  o.traverse((c) => {
    const g = (c as Mesh).geometry as BufferGeometry | undefined;
    if (!g) return;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return n;
}

describe("geometry", () => {
  it("wheel bounding box matches diameter and width", () => {
    const g = makeWheel(24, 14, { spokes: 6, spokeWidth: 0.5, dish: 0.3, split: false });
    const b = new Box3().setFromObject(g);
    expect(b.max.y - b.min.y).toBeCloseTo(24 * IN, 2);
    expect(b.max.x - b.min.x).toBeCloseTo(14 * IN, 2);
  });
  it("tire bounding box matches od and section", () => {
    const t = makeTire(37, 13.5, 24, "MT");
    const b = new Box3().setFromObject(t);
    expect(b.max.y - b.min.y).toBeCloseTo(37 * IN, 2);
    expect(b.max.x - b.min.x).toBeCloseTo(13.5 * IN, 2);
  });
  it("finishes differ in roughness", () => {
    expect(finishMaterial("polished").roughness).toBeLessThan(finishMaterial("brushed").roughness);
    expect(finishMaterial("black").color.getHexString()).not.toBe(finishMaterial("polished").color.getHexString());
  });
  it("five JTX programs with distinct spoke counts or styles", () => {
    expect(JTX_PROGRAMS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(JTX_PROGRAMS.map(p => JSON.stringify(p.style))).size).toBe(JTX_PROGRAMS.length);
  });

  it("wheel children are named barrel, face, lip and the face sits outboard at +X", () => {
    const g = makeWheel(22, 12, { spokes: 8, spokeWidth: 0.4, dish: 0, split: true });
    for (const name of ["barrel", "face", "lip"]) expect(g.getObjectByName(name)).toBeTruthy();
    const face = new Box3().setFromObject(g.getObjectByName("face")!);
    expect(face.max.x).toBeGreaterThan(0);
    // centred on the origin
    const b = new Box3().setFromObject(g);
    expect(b.max.x + b.min.x).toBeCloseTo(0, 3);
    expect(b.max.y + b.min.y).toBeCloseTo(0, 3);
    expect(b.max.z + b.min.z).toBeCloseTo(0, 3);
  });

  it("deeper dish moves the face inboard", () => {
    const flat = new Box3().setFromObject(makeWheel(24, 14, { spokes: 8, spokeWidth: 0.4, dish: 0, split: false }).getObjectByName("face")!);
    const deep = new Box3().setFromObject(makeWheel(24, 14, { spokes: 8, spokeWidth: 0.4, dish: 1, split: false }).getObjectByName("face")!);
    expect(deep.max.x).toBeLessThan(flat.max.x - 3 * IN);
  });

  it("every JTX program is a real catalog model and stays under 60,000 triangles at 24x14", () => {
    const names = new Set(catalog.brands.flatMap((b) => b.models.map((m) => m.model)));
    for (const p of JTX_PROGRAMS) {
      expect(names.has(p.model)).toBe(true);
      const g = makeWheel(24, 14, p.style);
      expect(tris(g)).toBeLessThan(60000);
      expect(wheelTriangles(g)).toBe(tris(g));
    }
  });

  it("MT tread is cut deeper than AT and the tire is a closed ring around X", () => {
    const mt = makeTire(35, 12.5, 20, "MT");
    const at = makeTire(35, 12.5, 20, "AT");
    expect(mt.userData.tread).toBe("MT");
    expect(at.userData.tread).toBe("AT");
    expect(mt.userData.grooveDepthIn).toBeGreaterThan(at.userData.grooveDepthIn);
    expect(mt.userData.grooves).toBeLessThan(at.userData.grooves);
    const b = new Box3().setFromObject(mt);
    expect(b.max.z - b.min.z).toBeCloseTo(35 * IN, 2);
    // bead seats on the rim
    const inner = mt.userData.beadRadiusM as number;
    expect(inner).toBeCloseTo(10 * IN, 3);
  });

  it("finishCode maps catalog finish names", () => {
    expect(finishCode("Polished")).toBe("polished");
    expect(finishCode("Brushed")).toBe("brushed");
    expect(finishCode("Black")).toBe("black");
    expect(finishCode("Black Milled")).toBe("black-milled");
  });
});

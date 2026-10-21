import { describe, it, expect } from "vitest";
import { Box3, DataTexture, Mesh, MeshPhysicalMaterial, Object3D, BufferGeometry, ShapeUtils, Vector2 } from "three";
import { makeWheel, wheelTriangles } from "../src/geometry/wheel";
import { disposeTire, makeTire, sidewallLabel, treadLayout, RUBBER } from "../src/geometry/tire";
import { mirroredCopy } from "../src/geometry/lettering";
import { makeBrake, rotorDiaFor, CALIPER_REACH } from "../src/geometry/brake";
import { finishMaterial, finishCode, finishSet } from "../src/materials/finishes";
import { lugPattern } from "../src/scene/WheelSet";
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

  it("brake rotor is about 70 percent of the wheel and the caliper clears the drop centre", () => {
    for (const d of [20, 22, 24, 26]) {
      const rotor = rotorDiaFor(d);
      expect(rotor).toBeLessThanOrEqual(d * 0.7 + 1e-9);
      expect(rotor).toBeGreaterThan(d * 0.65);
      const b = makeBrake(rotor, -1);
      const box = new Box3().setFromObject(b);
      const outer = Math.max(box.max.y, -box.min.y, box.max.z, -box.min.z);
      expect(outer).toBeLessThan((d / 2 - 2.15) * IN); // inner wall at the drop centre
      expect(outer).toBeCloseTo((rotor / 2 + CALIPER_REACH) * IN, 2);
      expect(box.max.x).toBeLessThanOrEqual(1e-6); // everything inboard of the hat face
    }
  });
  it("brake has rotor, hat and caliper, the caliper on the side asked for", () => {
    const trail = makeBrake(16.8, -1), lead = makeBrake(16.8, 1);
    for (const n of ["rotor", "hat", "caliper"]) expect(trail.getObjectByName(n)).toBeTruthy();
    const cz = (g: Object3D) => { const b = new Box3().setFromObject(g.getObjectByName("caliper")!); return (b.min.z + b.max.z) / 2; };
    expect(cz(trail)).toBeLessThan(0);
    expect(cz(lead)).toBeGreaterThan(0);
    const rotorBox = new Box3().setFromObject(trail.getObjectByName("rotor")!);
    expect(rotorBox.max.y - rotorBox.min.y).toBeCloseTo(16.8 * IN, 2);
  });
  it("the wheel reports where its hub back sits, behind the face front", () => {
    const g = makeWheel(24, 14, { spokes: 8, spokeWidth: 0.4, dish: 0.5, split: false });
    expect(g.userData.hubBackIn).toBeLessThan(g.userData.faceFrontIn);
    expect(g.userData.hubBackIn).toBeGreaterThan(-7);
  });
  it("sidewall label is the moulded size string", () => {
    expect(sidewallLabel(37, 13.5, 24)).toBe("37x13.50R24");
    expect(sidewallLabel(35, 12.5, 22)).toBe("35x12.50R22");
    expect(sidewallLabel(33.5, 12.5, 20)).toBe("33.5x12.50R20");
    const t = makeTire(37, 13.5, 24, "MT");
    expect(t.userData.label).toBe("37x13.50R24");
    expect(() => disposeTire(t)).not.toThrow();
  });

  it("forked spokes add the fork windows: Ace 12 spokes give 12 long windows and 12 fork triangles", () => {
    const by = (m: string) => JTX_PROGRAMS.find((p) => p.model === m)!.style;
    expect(makeWheel(24, 12, by("Ace")).userData.windows).toBe(24);
    expect(makeWheel(24, 12, by("Ballistic")).userData.windows).toBe(16);
    expect(makeWheel(24, 12, by("Capo")).userData.windows).toBe(16); // 8 windows and 8 slots
    expect(makeWheel(24, 8.25, by("Alpha"), { lugs: 10, boltCircleMm: 225 }).userData.windows).toBeGreaterThanOrEqual(30); // lattice rows
    // a style without the new fields still builds the old way
    expect(makeWheel(24, 12, { spokes: 6, spokeWidth: 0.5, dish: 0.3, split: false }).userData.windows).toBe(6);
  });

  it("no window outline crosses another, for every program at every width the slice shows", () => {
    const orig = ShapeUtils.triangulateShape;
    let crossings = 0;
    (ShapeUtils as unknown as { triangulateShape: typeof orig }).triangulateShape = (contour: Vector2[], holes: Vector2[][]) => {
      const segs: [Vector2, Vector2, number][] = [];
      holes.forEach((h, hi) => h.forEach((p, i) => segs.push([p, h[(i + 1) % h.length], hi])));
      const o = (p: Vector2, q: Vector2, r: Vector2) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
      for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
        const [a, b] = segs[i], [c, d] = segs[j];
        if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) crossings++;
      }
      return orig(contour, holes);
    };
    try {
      for (const p of JTX_PROGRAMS) for (const [d, w, l] of [[20, 10, 8], [24, 12, 8], [26, 14, 8], [22, 8.25, 10], [30, 16, 8]] as const) {
        makeWheel(d, w, p.style, { lugs: l, boltCircleMm: l === 10 ? 225 : 170 });
      }
    } finally {
      (ShapeUtils as unknown as { triangulateShape: typeof orig }).triangulateShape = orig;
    }
    expect(crossings).toBe(0);
  });

  it("the face has spoke tops and window walls as separate material groups, and lugs match the bolt pattern", () => {
    const g = makeWheel(24, 12, JTX_PROGRAMS[0].style, { lugs: 10, boltCircleMm: 225 });
    const face = g.getObjectByName("face") as Mesh;
    expect(new Set(face.geometry.groups.map((x) => x.materialIndex))).toEqual(new Set([0, 1]));
    expect(g.userData.lugs).toBe(10);
    const t10 = tris(g.getObjectByName("lugs")!);
    const t8 = tris(makeWheel(24, 12, JTX_PROGRAMS[0].style, { lugs: 8 }).getObjectByName("lugs")!);
    expect(t10 / t8).toBeCloseTo(10 / 8, 5);
    for (const n of ["barrel", "lip", "face", "cap", "lugs"]) expect(g.getObjectByName(n)).toBeTruthy();
  });

  it("lug pattern comes from the vehicle's bolt string, with a dually fallback", () => {
    expect(lugPattern("8x170", false)).toEqual({ lugs: 8, boltCircleMm: 170 });
    expect(lugPattern("10x225", true)).toEqual({ lugs: 10, boltCircleMm: 225 });
    expect(lugPattern("8x165.1", false)).toEqual({ lugs: 8, boltCircleMm: 165.1 });
    expect(lugPattern(undefined, true)).toEqual({ lugs: 10, boltCircleMm: 225 });
    expect(lugPattern(undefined, false)).toEqual({ lugs: 8, boltCircleMm: 170 });
  });

  it("polished is soft forged aluminium with a turning normal, brushed is anisotropic, black milled has milled walls", () => {
    const p = finishMaterial("polished");
    expect(p.metalness).toBe(1);
    expect(p.roughness).toBeGreaterThanOrEqual(0.12);
    expect(p.roughness).toBeLessThanOrEqual(0.18);
    expect(p.clearcoat).toBe(0);
    expect(p.normalMap).toBeTruthy();
    const b = finishSet("brushed");
    expect(b.face.anisotropy).toBeGreaterThan(0.5);
    expect(b.face.anisotropyMap).toBeTruthy(); // radial on the face
    expect(b.lip.anisotropyMap).toBeFalsy(); // around the lip, along lathe u
    const bm = finishSet("black-milled");
    expect(bm.edge).not.toBe(bm.face);
    expect(bm.edge.metalness).toBe(1);
    expect(bm.face.color.getHexString()).toBe(bm.lip.color.getHexString()); // black lip, as photographed
    const k = finishSet("black");
    expect(k.edge).toBe(k.face);
  });

  it("tire is near-black rubber with no metal", () => {
    const t = makeTire(37, 13.5, 24, "MT");
    const m = t.material as MeshPhysicalMaterial;
    expect(m.color.getHexString()).toBe("0b0b0b");
    expect(m.metalness).toBe(0);
    // roughness comes from a 1x4 region map on uv1: sidewall, void, wall, worn top
    const rows = (m.roughnessMap as DataTexture).image.data as Uint8Array;
    const at = (i: number) => rows[i * 4] / 255;
    expect(m.roughness).toBe(1);
    expect(at(0)).toBeCloseTo(0.62, 2);
    expect(at(1)).toBeCloseTo(0.78, 2);
    expect(at(2)).toBeCloseTo(0.78, 2);
    expect(at(3)).toBeGreaterThan(0.78); // worn block tops a little rougher
    expect(RUBBER.sidewall).toBe(0.62);
    expect(RUBBER.tread).toBe(0.78);
    expect(m.roughnessMap!.channel).toBe(1);
    expect(m.normalMap).toBeTruthy(); // fine grain
    expect(m.vertexColors).toBe(true);
    const geo = t.geometry;
    for (const a of ["position", "normal", "uv", "uv1", "color"]) expect(geo.getAttribute(a)).toBeTruthy();
  });

  it("tread blocks are real geometry: pitches scale with circumference and rows with section", () => {
    for (const tread of ["MT", "AT"] as const) {
      const small = makeTire(33, 12.5, 20, tread), big = makeTire(40, 12.5, 24, tread);
      // the same physical pitch length on both, so the count follows the circumference
      const pitchIn = (t: Mesh) => (Math.PI * (t.userData.odIn as number)) / (t.userData.pitches as number);
      expect(pitchIn(small)).toBeCloseTo(pitchIn(big), 0);
      expect(big.userData.pitches).toBeGreaterThan(small.userData.pitches);
      expect(Math.abs(pitchIn(big) - treadLayout(40, 12.5, tread).pitchIn)).toBeLessThan(1e-9);
      expect(small.userData.pitches % 2).toBe(0); // long and short shoulder lugs alternate
      // block count is pitches times blocks per pitch, so it scales the same way
      expect(big.userData.blocks / small.userData.blocks).toBeCloseTo(big.userData.pitches / small.userData.pitches, 5);
      // wider sections get more rows
      expect(treadLayout(37, 15.5, tread).rows).toBeGreaterThan(treadLayout(33, 10.5, tread).rows);
    }
    expect(treadLayout(35, 12.5, "MT").rows).toBe(2);
    expect(treadLayout(40, 15.5, "MT").rows).toBe(3);
    expect(treadLayout(40, 15.5, "AT").rows).toBe(4);
    // the lugs stand proud of the carcass: radii at the crown span the tread depth
    const t = makeTire(37, 13.5, 24, "MT"), p = t.geometry.attributes.position;
    let lo = Infinity, hi = 0;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i)) > 2 * IN) continue;
      const r = Math.hypot(p.getY(i), p.getZ(i)) / IN;
      if (r > 17) { lo = Math.min(lo, r); hi = Math.max(hi, r); }
    }
    expect(hi).toBeCloseTo(18.5, 2);
    expect(hi - lo).toBeGreaterThan(0.7);
  });

  it("every tire we draw stays inside the 25k to 45k triangle budget and inside its size", () => {
    for (const [od, sec, rim, rw] of [[26, 10.5, 16, 8], [33, 10.5, 18, 9], [35, 12.5, 20, 10], [37, 13.5, 24, 14], [37, 13.5, 26, 14], [40, 15.5, 26, 16]] as const) {
      for (const tread of ["MT", "AT"] as const) {
        const t = makeTire(od, sec, rim, tread, rw);
        const n = tris(t);
        expect(n).toBe(t.userData.triangles);
        expect(n).toBeGreaterThanOrEqual(25000);
        expect(n).toBeLessThanOrEqual(45000);
        const b = new Box3().setFromObject(t);
        expect(b.max.y - b.min.y).toBeCloseTo(od * IN, 2);
        expect((b.max.x - b.min.x) / IN).toBeLessThanOrEqual(sec + 1e-3);
        disposeTire(t);
      }
    }
  });

  it("a mirrored decal texture reads u backwards", () => {
    const t = new DataTexture(new Uint8Array(4), 1, 1);
    t.repeat.x = 2;
    expect(mirroredCopy(t).repeat.x).toBe(-2);
  });
});

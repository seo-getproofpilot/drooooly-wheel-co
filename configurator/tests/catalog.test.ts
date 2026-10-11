import { describe, it, expect } from "vitest";
import Fitment from "@site/fitment.js";
import { loadCatalog } from "../src/data/catalog";
describe("catalog", () => {
  const c = loadCatalog();
  it("has f250 and f150 with model blocks", () => {
    for (const id of ["f250", "f150"]) expect(c.vehicles.find(v => v.id === id)?.model?.file).toMatch(/\.gltf$/);
  });
  it("only allowed brands", () => { expect(c.brands.map(b => b.slug)).toEqual(["jtx"]); });
  it("offers only sizes with a known width", () => {
    const bad = c.brands.flatMap(b => b.models.flatMap(m => m.sizes.filter(s => !Fitment.parseSize(s)?.widthKnown)));
    expect(bad).toEqual([]);
  });
  it("every tire size parses", () => {
    const bad = c.tires.flatMap(b => b.models.flatMap(m => m.sizes.filter(s => !Fitment.parseTireSize(s))));
    expect(bad).toEqual([]);
  });
});

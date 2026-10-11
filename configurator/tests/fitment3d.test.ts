import { describe, it, expect } from "vitest";
import { fit, IN } from "../src/fitment/fitment3d";
import { loadCatalog } from "../src/data/catalog";
const c = loadCatalog();
const f250 = c.vehicles.find(v => v.id === "f250")!;
const f150 = c.vehicles.find(v => v.id === "f150")!;
describe("fit", () => {
  it("places four corners on the track for a single-wheel truck", () => {
    const r = fit({ vehicle: f250, liftIn: 0, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" });
    expect(r.corners.map(k => k.name)).toEqual(["FL", "FR", "RL", "RR"]);
    const fr = r.corners.find(k => k.name === "FR")!;
    expect(fr.x).toBeCloseTo(-((68.3 / 2) * IN + (10 / 2 - (-18) / 25.4) * IN - (10 / 2) * IN), 3); // right side is -X; hub face at half track, wheel centre shifted by offset
    expect(fr.z).toBeCloseTo(0, 3);
    expect(r.corners.find(k => k.name === "RR")!.z).toBeCloseTo(-159.8 * IN, 3);
  });
  it("mirrors the right (-X) side, left corners sit at +X", () => {
    const r = fit({ vehicle: f250, liftIn: 0, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" });
    const fl = r.corners.find(k => k.name === "FL")!, fr = r.corners.find(k => k.name === "FR")!;
    expect(fl.x).toBeCloseTo(-fr.x, 6);
    expect(fl.x).toBeGreaterThan(0);
    expect(fl.mirror).toBe(false);
    expect(fr.mirror).toBe(true);
  });
  it("raises the body by the lift, wheels stay on the ground", () => {
    const a = fit({ vehicle: f250, liftIn: 0, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" });
    const b = fit({ vehicle: f250, liftIn: 6, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" });
    expect(b.bodyLiftM - a.bodyLiftM).toBeCloseTo(6 * IN, 4);
    expect(a.corners[0].y).toBeCloseTo(35 / 2 * IN, 4);
    expect(b.corners[0].y).toBeCloseTo(35 / 2 * IN, 4);
  });
  it("a stock-size tire at stock height adds no body lift", () => {
    const r = fit({ vehicle: f250, liftIn: 0, wheel: { diaIn: 18, widthIn: 8, offsetMm: 13 }, tire: { od: 33.2, section: 10.5, rim: 18 }, config: "single" });
    expect(r.bodyLiftM).toBeCloseTo(0, 6);
  });
  it("uses words, not decimals, while measured is false", () => {
    const r = fit({ vehicle: f150, liftIn: 0, wheel: { diaIn: 22, widthIn: 12, offsetMm: -44 }, tire: { od: 33, section: 12.5, rim: 22 }, config: "single" });
    expect(r.pokeText).not.toMatch(/\d\.\d"/);
    expect(r.stance.label).toBeTruthy();
    expect(r.stance.label.toLowerCase()).not.toMatch(/fit|rub|guarantee/);
  });
  it("marks offset unknown without inventing one", () => {
    const r = fit({ vehicle: f250, liftIn: 0, wheel: { diaIn: 24, widthIn: 14, offsetMm: null }, tire: { od: 37, section: 13.5, rim: 24 }, config: "single" });
    expect(r.offsetKnown).toBe(false);
    expect(r.corners.length).toBe(4);
  });
  it("dually adds inner rears", () => {
    const f450 = c.vehicles.find(v => v.id === "f450")!;
    const r = fit({ vehicle: f450, liftIn: 0, wheel: { diaIn: 24, widthIn: 8.25, offsetMm: 120 }, tire: { od: 37, section: 13.5, rim: 24 }, config: "dually" });
    expect(r.corners.map(k => k.name)).toContain("RL_inner");
    expect(r.corners.find(k => k.name === "RR_inner")!.x).toBeGreaterThan(r.corners.find(k => k.name === "RR")!.x);
    expect(r.corners.find(k => k.name === "RL_inner")!.x).toBeLessThan(r.corners.find(k => k.name === "RL")!.x);
  });
  it("load rating hard stop", () => {
    const r = fit({ vehicle: f250, liftIn: 0, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single", towWeightLb: 14000, loadRatingLb: 3195 });
    expect(r.loadOk).toBe(false);
  });
  it("load rating passes when covered, and is null when nothing is disclosed", () => {
    const base = { vehicle: f250, liftIn: 0 as const, wheel: { diaIn: 20, widthIn: 10, offsetMm: -18 }, tire: { od: 35, section: 12.5, rim: 20 }, config: "single" as const };
    expect(fit({ ...base, towWeightLb: 10000, loadRatingLb: 3195 }).loadOk).toBe(true);
    expect(fit(base).loadOk).toBeNull();
    expect(fit({ ...base, towWeightLb: 10000, loadRatingLb: null }).loadOk).toBeNull();
  });
});

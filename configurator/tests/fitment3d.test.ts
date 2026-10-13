import { describe, it, expect } from "vitest";
import { fit, IN, pokeSentence } from "../src/fitment/fitment3d";
import Fitment from "@site/fitment.js";
import { callout } from "../src/ui/callout";
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
  it("draws the wheels on the body's own track when the body is a wider trim, poke maths untouched", () => {
    const wheel = { diaIn: 22, widthIn: 12, offsetMm: -44 }, tire = { od: 35, section: 12.5, rim: 22 };
    const r = fit({ vehicle: f150, liftIn: 0, wheel, tire, config: "single" });
    const stock = fit({ vehicle: { ...f150, model: { ...f150.model!, bodyTrackIn: undefined } }, liftIn: 0, wheel, tire, config: "single" });
    expect(f150.model!.bodyTrackIn).toBe(73.7);
    const fl = r.corners.find(k => k.name === "FL")!, sl = stock.corners.find(k => k.name === "FL")!;
    expect(fl.x - sl.x).toBeCloseTo(((73.7 - 67.6) / 2) * IN, 6);   // the Raptor body's wider track, per side
    expect(r.pokeText).toBe(stock.pokeText);                           // the sentence still describes the stock truck
    expect(r.g.poke).toBe(stock.g.poke);
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

describe("pokeSentence", () => {
  const g = (poke: number) => ({ poke } as any);
  const banned = /guarantee|will fit|rub free|rub-free/i;
  it("unmeasured: whole inches with about, never a decimal", () => {
    expect(pokeSentence(g(2.6), false)).toBe("Sits about 3 inches past the fender");
    expect(pokeSentence(g(1.2), false)).toBe("Sits about 1 inch past the fender");
    expect(pokeSentence(g(0.4), false)).toBe("Sits about even with the fender");
    expect(pokeSentence(g(-0.49), false)).toBe("Sits about even with the fender");
    expect(pokeSentence(g(-1.6), false)).toBe("Sits about 2 inches inside the fender");
    for (const p of [-5, -1.5, -0.2, 0, 0.6, 1.5, 3.3, 7.9]) {
      const s = pokeSentence(g(p), false);
      expect(s).not.toMatch(/\d\.\d/);
      expect(s).not.toMatch(banned);
    }
  });
  it("measured: fitment.js pokeText exactly", () => {
    for (const p of [-2.3, 0, 0.1, 1.84, 4]) expect(pokeSentence(g(p), true)).toBe(Fitment.pokeText(g(p), true));
  });
  it("feeds the callout lines", () => {
    const r = fit({ vehicle: f250, liftIn: 4, wheel: { diaIn: 26, widthIn: 14, offsetMm: -76 }, tire: { od: 37, section: 13.5, rim: 26 }, config: "single" });
    const c = callout({ size: "26x14", offsetMm: -76, brand: "JTX", model: "Ace", finish: "Polished", fit: r, measured: false, liftIn: 4 });
    expect(c.headline).toBe("26x14 -76");
    expect(c.line2).toBe("JTX Ace, Polished");
    expect(c.line3).toBe(pokeSentence(r.g, false) + ", at 4 inches of lift");
    expect(callout({ size: "20x10", offsetMm: null, brand: "JTX", model: "Ace", finish: "Black", fit: r, measured: false, liftIn: 0 }).headline).toBe("20x10");
    expect(callout({ size: "20x10", offsetMm: null, brand: "JTX", model: "Ace", finish: "Black", fit: r, measured: false, liftIn: 0 }).line3).not.toMatch(/lift/);
    expect(c.line3).not.toMatch(banned);
  });
});

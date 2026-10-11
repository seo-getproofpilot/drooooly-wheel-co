import { describe, it, expect } from "vitest";
import { reduce, firstIncomplete, encode, decode, wheelSizes, tireChoices, offsetFor, type Build } from "../src/flow";
import { loadCatalog } from "../src/data/catalog";
const cat = loadCatalog();
// Lift is null until the customer picks a stance.
const empty: Build = { v: null, mn: null, y: null, p: null, l: null, lv: false, b: null, m: null, s: null, f: null, t: null, tow: null };
describe("flow", () => {
  it("starts at step 1 and advances", () => {
    expect(firstIncomplete(empty)).toBe(1);
    const b1 = reduce(empty, { type: "set", patch: { v: "f250", y: 2024 } });
    expect(firstIncomplete(b1)).toBe(2);
    const b2 = reduce(b1, { type: "set", patch: { p: "agate-black" } });
    expect(firstIncomplete(b2)).toBe(3);
    const b3 = reduce(b2, { type: "set", patch: { l: 0 } });
    expect(firstIncomplete(b3)).toBe(4);
  });
  it("changing the wheel model clears size, finish and tire", () => {
    const b: Build = { ...empty, v: "f250", y: 2024, p: "black", l: 0, b: "jtx", m: "Ace", s: "22x12", f: "polished", t: "35x12.50R22" };
    const n = reduce(b, { type: "set", patch: { m: "Ballistic" } });
    expect(n.s).toBeNull(); expect(n.f).toBeNull(); expect(n.t).toBeNull();
    expect(n.p).toBe("black");
  });
  it("changing the size clears only the tire", () => {
    const b: Build = { ...empty, v: "f250", y: 2024, p: "black", l: 0, b: "jtx", m: "Ace", s: "22x12", f: "polished", t: "35x12.50R22" };
    const n = reduce(b, { type: "set", patch: { s: "24x14" } });
    expect(n.t).toBeNull(); expect(n.f).toBe("polished");
  });
  it("url round trips", () => {
    const b: Build = { ...empty, v: "f250", y: 2024, p: "race-red", l: 6, b: "jtx", m: "Ace", s: "24x14", f: "black-milled", t: "37x13.50R24", tow: 12000 };
    expect(decode(encode(b), cat)).toEqual(b);
    const lv: Build = { ...empty, v: "f150", y: 2022, p: "atlas-blue", l: 0, lv: true };
    expect(decode(encode(lv), cat)).toEqual(lv);
  });
  it("encode omits nulls", () => {
    expect(encode(empty)).toBe("");
    expect(encode({ ...empty, v: "f250" })).toBe("?v=f250");
  });
  it("unknown url parts become null, never throw", () => {
    const d = decode("?v=nope&y=2024&b=jtx&m=Nope&s=99x99&f=gold&l=12", cat);
    expect(d.v).toBeNull(); expect(d.m).toBeNull(); expect(d.s).toBeNull(); expect(d.f).toBeNull(); expect(d.l).toBeNull();
    expect(firstIncomplete(d)).toBe(1);
    expect(() => decode("?%E0%A4%A=&&==&t=garbage&tow=-5&y=abc", cat)).not.toThrow();
    expect(decode("?tow=-5", cat).tow).toBeNull();
  });
  it("keeps the known parts of a partly bad url", () => {
    const d = decode("?v=f250&y=1990&p=race-red&m=Ace&b=jtx&s=99x99", cat);
    expect(d.v).toBe("f250"); expect(d.y).toBeNull(); expect(d.p).toBe("race-red");
    expect(d.m).toBe("Ace"); expect(d.s).toBeNull();
    expect(firstIncomplete(d)).toBe(1);
  });
  it("only published, width-known sizes for the config", () => {
    const sizes = wheelSizes(cat, "jtx", "Ace", "single");
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every(s => /^\d+x\d+(\.\d+)?$/.test(s))).toBe(true);
    expect(sizes).not.toContain("22x8.25"); // the dually rear width is not a single-truck size
    expect(wheelSizes(cat, "jtx", "Ace", "dually").every(s => s.endsWith("x8.25"))).toBe(true);
    expect(wheelSizes(cat, "jtx", "Nope", "single")).toEqual([]);
  });
  it("tire choices at 30 inch are empty and that is a real answer", () => {
    expect(tireChoices(cat, 30, "any")).toEqual([]);
    expect(tireChoices(cat, 24, "any").map(t => t.size)).toContain("37x13.50R24");
  });
  it("offset lookup returns null when unknown", () => {
    expect(offsetFor(cat, 14, "single", 24)).toBeTypeOf("number");
    expect(offsetFor(cat, 99, "single", 24)).toBeNull();
    expect(offsetFor(cat, 10, "single", 20)).toBeNull(); // a declared gap stays a gap
  });
});

import { describe, it, expect } from "vitest";
import { reduce, firstIncomplete, encode, decode, wheelSizes, tireChoices, offsetFor, offsetChoices, seed, truckPicked, matchVehicle, fromFinder, initialBuild, platforms, wheelModels, type Build } from "../src/flow";
import { loadCatalog } from "../src/data/catalog";
const cat = loadCatalog();
// Lift is null until the customer picks a stance.
const empty: Build = { v: null, mn: null, y: null, p: null, l: null, lv: false, b: null, m: null, s: null, o: null, f: null, t: null, tow: null };
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

  it("offset choices are the recorded values for the size, never invented", () => {
    expect(offsetChoices(cat, 14, "single", 24)).toEqual([-76]);
    expect(offsetChoices(cat, 12, "single", 24)).toEqual([-51]); // the exact-size record wins over the width
    expect(offsetChoices(cat, 10, "single", 20)).toEqual([]);    // a declared gap: "cut to your truck"
    expect(offsetChoices(cat, 8.25, "dually", 24)).toEqual([110, 120, 130]); // min, typical, max
  });
  it("o round trips and is validated against the size's offsets", () => {
    const b: Build = { ...empty, v: "f250", mn: "F-350 Super Duty", y: 2019, p: "race-red", l: 4, b: "jtx", m: "Ace", s: "26x14", o: -76, f: "polished", t: "37x13.50R26" };
    expect(encode(b)).toContain("o=-76");
    expect(decode(encode(b), cat)).toEqual(b);
    expect(decode(encode({ ...b, o: -40 }), cat).o).toBeNull();                 // not a recorded value
    expect(decode(encode({ ...b, s: "20x10", t: null }), cat).o).toBeNull();     // no record at all for 20x10
    expect(decode("?v=f250&y=2019&b=jtx&m=Ace&s=26x14&o=-76.5", cat).o).toBeNull();
    expect(decode("?v=f250&y=2019&b=jtx&m=Ace&o=-76", cat).o).toBeNull();       // no size, no offset
  });
  it("changing the size clears the offset", () => {
    const b: Build = { ...empty, v: "f250", y: 2024, b: "jtx", m: "Ace", s: "24x14", o: -76 };
    expect(reduce(b, { type: "set", patch: { s: "26x14" } }).o).toBeNull();
  });
  it("seed fills a whole build once a truck is picked, and only then", () => {
    expect(seed(cat, { ...empty, p: "black" })).toEqual({ ...empty, p: "black" });
    // a shop link that names only the platform gets its first model name and newest year
    expect(seed(cat, { ...empty, v: "f250" })).toMatchObject({ v: "f250", mn: "F-250 Super Duty", y: 2026, m: "Ace" });
    const s = seed(cat, { ...empty, v: "f250", mn: "F-250 Super Duty", y: 2024 });
    expect(truckPicked(s)).toBe(true);
    expect(s).toMatchObject({ p: "iconic-silver", l: 0, b: "jtx", m: "Ace", s: "22x12", f: "polished", o: null });
    expect(s.t).toMatch(/R22$/);
    expect(decode(encode(s), cat)).toEqual(s);
  });
  it("seed keeps the customer's size, offset and tire across a style change when the new style offers them", () => {
    const prev: Build = { ...empty, v: "f250", y: 2024, p: "black", l: 6, b: "jtx", m: "Ace", s: "24x14", o: -76, f: "black", t: "37x13.50R24" };
    const next = seed(cat, reduce(prev, { type: "set", patch: { m: "Ballistic" } }), prev);
    expect(next).toMatchObject({ m: "Ballistic", s: "24x14", o: -76, f: "black", t: "37x13.50R24" });
  });

  it("the F-450 runs the dually path", () => {
    const veh = platforms(cat).find((v) => v.id === "f450")!;
    expect(veh.config).toBe("drw");
    const s = seed(cat, { ...empty, v: "f450", y: 2020 });
    expect(s.s).toMatch(/x8\.25$/);
    expect(wheelModels(cat, "jtx", "dually").map((m) => m.model)).toEqual(expect.arrayContaining(["Alpha", "404"]));
    expect(offsetChoices(cat, 8.25, "dually", 24)).toEqual([110, 120, 130]);
    const ps = s.s!.split("x").map(Number);
    expect(tireChoices(cat, ps[0], "dual").some((t) => t.size === s.t)).toBe(true);
    expect(decode(encode({ ...s, o: 130 }), cat).o).toBe(130);
  });
  it("matchVehicle mirrors the site's: exact name, else the longest match", () => {
    expect(matchVehicle(cat, "Ford", "F-350 Super Duty")?.id).toBe("f250");
    expect(matchVehicle(cat, "RAM", "3500 DRW")?.id).toBe("ram3500drw");
    expect(matchVehicle(cat, "Ford", "Ranger")).toBeNull();
  });
  it("prefill: the URL wins, then the homepage finder, else the sheet", () => {
    const saved = { year: "2019", make: "Ford", model: "F-350 Super Duty" };
    expect(initialBuild(cat, "?v=f150&y=2022", saved)).toMatchObject({ fromLink: true, build: { v: "f150", y: 2022 } });
    expect(initialBuild(cat, "", saved)).toMatchObject({ fromLink: true, build: { v: "f250", mn: "F-350 Super Duty", y: 2019 } });
    expect(initialBuild(cat, "?p=black", null)).toMatchObject({ fromLink: false, build: { v: null, p: "black" } });
    const noBody = cat.vehicles.find((v) => !v.model);
    if (noBody) expect(fromFinder(cat, { year: String(noBody.years[1]), make: noBody.make, model: noBody.models[0] })).toBeNull(); // no 3D body yet
    expect(fromFinder(cat, { year: "1990", make: "Ford", model: "F-250" })).toMatchObject({ v: "f250", y: null });
    expect(fromFinder(cat, "garbage")).toBeNull();
  });
});

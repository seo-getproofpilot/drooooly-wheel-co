/* The build the customer is putting together, and the one rule for how it
   changes: picking an earlier part clears the later parts that depended on
   it, so the flow never shows a size or tire that no longer applies. */
export type Step = 1 | 2 | 3 | 4 | 5;
export type LiftIn = 0 | 2.5 | 4 | 6;
export const LIFTS: LiftIn[] = [0, 2.5, 4, 6];

/** Short keys because they are the share URL. l is null until a stance is picked. */
export interface Build {
  v: string | null;      // platform id from the catalog (f250, f150)
  mn: string | null;     // the model name the customer picked within that platform
  y: number | null;      // model year
  p: string | null;      // paint slug
  l: LiftIn | null;      // lift in inches, 0 for stock or leveled
  lv: boolean;           // leveling kit (front only), with l = 0
  b: string | null;      // wheel brand slug
  m: string | null;      // wheel model name
  s: string | null;      // wheel size, "24x14"
  f: string | null;      // finish code
  t: string | null;      // tire size
  tow: number | null;    // disclosed trailer weight, lb
}

export type Action = { type: "set"; patch: Partial<Build> } | { type: "reset" } | { type: "hydrate"; build: Build };

export const EMPTY: Build = { v: null, mn: null, y: null, p: null, l: null, lv: false, b: null, m: null, s: null, f: null, t: null, tow: null };

const DEPENDENTS: [keyof Build, (keyof Build)[]][] = [
  ["v", ["s", "t"]], ["y", ["s", "t"]],
  ["b", ["s", "f", "t"]], ["m", ["s", "f", "t"]],
  ["s", ["t"]],
];

export function reduce(b: Build, a: Action): Build {
  if (a.type === "reset") return { ...EMPTY };
  if (a.type === "hydrate") return { ...a.build };
  const next: Build = { ...b, ...a.patch };
  for (const [key, deps] of DEPENDENTS) {
    if (!(key in a.patch) || a.patch[key] === b[key]) continue;
    // A dependent the same patch sets on purpose is kept.
    for (const d of deps) if (!(d in a.patch)) (next as any)[d] = null;
  }
  return next;
}

export function firstIncomplete(b: Build): Step {
  if (!b.v || !b.y) return 1;
  if (!b.p) return 2;
  if (b.l === null) return 3;
  if (!b.b || !b.m || !b.s || !b.f || !b.t) return 4;
  return 5;
}

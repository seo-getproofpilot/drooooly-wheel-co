/* What the customer may pick, straight from the catalog through fitment.js.
   Nothing here invents a size, a tire or an offset. */
import Fitment from "@site/fitment.js";
import type { Catalog, Vehicle } from "../data/types";
import allowed from "../../allowed-brands.json";
import { JTX_PROGRAMS } from "../data/jtx-programs";

export type Config = "single" | "dually";
export type TireChoice = ReturnType<typeof Fitment.tiresFor>[number];

export const configOf = (v: Vehicle): Config => (v.config === "drw" ? "dually" : "single");

/** Only platforms with a truck model in the slice. */
export const platforms = (cat: Catalog) => cat.vehicles.filter((v) => !!v.model);

/** Rule 3: a brand we are not authorised to sell never appears. */
export const brands = (cat: Catalog) => cat.brands.filter((b) => (allowed as string[]).includes(b.slug));

/** Wheel models the scene can draw, that the brand makes for this config. */
export function wheelModels(cat: Catalog, brand: string, config: Config) {
  const b = brands(cat).find((x) => x.slug === brand);
  if (!b) return [];
  return b.models.filter((m) => m.configs.includes(config) && JTX_PROGRAMS.some((p) => p.model === m.model));
}

/** Published sizes with a known width. A single-rear truck does not get the
    8.25 dually rear width (the site's visibleSizes rule, same fallback when a
    model publishes nothing else); a dually gets only that width. */
export function wheelSizes(cat: Catalog, brand: string, model: string, config: string): string[] {
  const b = brands(cat).find((x) => x.slug === brand);
  const m = b?.models.find((x) => x.model === model);
  if (!m) return [];
  const known = m.sizes.filter((s) => Fitment.parseSize(s)?.widthKnown);
  const isRear = (s: string) => Fitment.parseSize(s)!.w === Fitment.DUALLY_REAR_WIDTH;
  if (config === "dually") return known.filter(isRear);
  const single = known.filter((s) => !isRear(s));
  return single.length ? single : known;
}

export function tireChoices(cat: Catalog, diaIn: number, mode: "wide" | "dual" | "any"): TireChoice[] {
  return Fitment.tiresFor(cat.tires, diaIn, mode === "any" ? undefined : mode);
}

/** The recorded typical offset for this width and diameter, or null. Never interpolated. */
export function offsetFor(cat: Catalog, widthIn: number, config: string, diaIn: number): number | null {
  const role = Fitment.offsetRole(widthIn, config === "dually" ? "dually" : "single");
  const e = Fitment.offsetFor(cat.offsets, role, diaIn, widthIn);
  return typeof e?.typical === "number" ? e.typical : null;
}

/** The recorded offsets for this size: min, typical and max as published, in
    mm, low to high, duplicates removed. Empty when nothing is recorded, which
    the panel shows as "cut to your truck". Never interpolated. */
export function offsetChoices(cat: Catalog, widthIn: number, config: string, diaIn: number): number[] {
  const role = Fitment.offsetRole(widthIn, config === "dually" ? "dually" : "single");
  const e = Fitment.offsetFor(cat.offsets, role, diaIn, widthIn);
  if (!e) return [];
  const vals = [e.min, e.typical, e.max].filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return [...new Set(vals)].sort((a, b) => a - b);
}

/** The site's window.matchVehicle (vehicles.js), ported to the catalog the
    configurator carries: same make, exact model name wins, otherwise the
    longest name that contains or is contained in the other, so "3500 DRW"
    never lands on the single-rear 3500. Keep the two in step. */
export function matchVehicle(cat: Catalog, make: string, model: string): Vehicle | null {
  const m = String(model || "").toLowerCase().trim(), mk = String(make || "").toLowerCase().trim();
  let best: Vehicle | null = null, bestLen = -1;
  for (const v of cat.vehicles) {
    if (v.make.toLowerCase() !== mk) continue;
    for (const mm of v.models) {
      const a = mm.toLowerCase();
      if (a === m) return v;
      if ((m.includes(a) || a.includes(m)) && a.length > bestLen) { best = v; bestLen = a.length; }
    }
  }
  return best;
}

/** Tread family for the render: mud-terrain if any listing of the size is one. */
export function treadOf(cat: Catalog, size: string): "AT" | "MT" {
  for (const b of cat.tires) for (const m of b.models) if (m.sizes.includes(size) && /mud/i.test(m.tread)) return "MT";
  return "AT";
}

export const FINISH_CODES = ["polished", "brushed", "black", "black-milled"] as const;
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

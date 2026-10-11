/* The live panel always shows a whole build. Once a truck is picked, every
   part the customer has not chosen yet is filled: first with what they had
   before (a 24x14 stays a 24x14 when they switch styles, if the new style is
   made in it), then with the showroom default. Everything goes through
   decode, so a seeded part is always one the catalog offers. */
import Fitment from "@site/fitment.js";
import type { Catalog } from "../data/types";
import type { Build } from "./state";
import { decode, encode } from "./url";
import { brands, configOf, platforms, slugify, tireChoices, wheelModels, wheelSizes } from "./options";
import { finishCode } from "../materials/finishes";

export const SHOWROOM = { model: "Ace", size: "22x12", finish: "polished", tire: "35x12.50R22", paint: "Iconic Silver" } as const;

/* A truck is picked once the build names a platform. A link from a shop or
   brand page may carry only v; the model name and year then default to the
   platform's first name and newest year, both changeable on the card. */
export const truckPicked = (b: Build) => !!b.v;

/** The tire we sell for this rim that is closest to 35 inches, or null. */
export function defaultTire(cat: Catalog, diaIn: number, config: string): string | null {
  const list = tireChoices(cat, diaIn, config === "dually" ? "dual" : "any");
  if (!list.length) return null;
  return [...list].sort((a, c) => Math.abs(a.od - 35) - Math.abs(c.od - 35))[0].size;
}

export function seed(cat: Catalog, next: Build, prev?: Build): Build {
  if (!truckPicked(next)) return next;
  const keep = { ...next };
  if (prev) for (const k of ["s", "o", "f", "t"] as const) if (keep[k] === null) (keep as any)[k] = prev[k];
  const out = decode(encode(keep), cat);
  const veh = platforms(cat).find((v) => v.id === out.v);
  if (!veh) return out;
  if (!out.mn) out.mn = veh.models[0];
  if (!out.y) out.y = veh.years[1];
  const config = configOf(veh);
  if (!out.p) out.p = slugify(SHOWROOM.paint);
  if (out.l === null) { out.l = 0; out.lv = false; }
  if (!out.b) out.b = brands(cat)[0]?.slug ?? null;
  if (!out.b) return out;
  const models = wheelModels(cat, out.b, config);
  if (!out.m) out.m = (models.find((m) => m.model === SHOWROOM.model) ?? models[0])?.model ?? null;
  const model = models.find((m) => m.model === out.m);
  if (!model) return out;
  if (!out.f) out.f = model.finishes.map(finishCode).find((c) => c === SHOWROOM.finish) ?? finishCode(model.finishes[0]);
  if (!out.s) {
    const sizes = wheelSizes(cat, out.b, out.m!, config);
    out.s = sizes.includes(SHOWROOM.size) ? SHOWROOM.size : sizes[0] ?? null;
  }
  if (out.s && !out.t) out.t = defaultTire(cat, Fitment.parseSize(out.s)!.d, config);
  return out;
}

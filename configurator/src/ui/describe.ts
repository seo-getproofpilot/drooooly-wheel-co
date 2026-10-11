/* The build in words, for the summary rows and the quote form's build field. */
import type { Catalog } from "../data/types";
import { brands, encode, platforms, slugify, type Build } from "../flow";
import { finishCode } from "../materials/finishes";
import { copy } from "./copy";

export function describe(cat: Catalog, b: Build) {
  const veh = platforms(cat).find((v) => v.id === b.v);
  const paint = cat.paints.find((p) => slugify(p.name) === b.p);
  const brand = brands(cat).find((x) => x.slug === b.b);
  const model = brand?.models.find((m) => m.model === b.m);
  const finish = model?.finishes.find((n) => finishCode(n) === b.f) ?? null;
  return {
    truck: veh && b.y ? `${b.y} ${veh.make} ${b.mn ?? veh.models.join(" / ")}` : null,
    paint: paint?.name ?? null,
    stance: b.l === null ? null : b.lv ? copy.leveled : copy.lift(b.l),
    wheel: brand && model && b.s ? `${brand.name} ${model.model} ${b.s}` : null,
    finish,
    tire: b.t,
  };
}

/* The JTX quote form reads `build` from the hash query into its build field
   (Task 8). It gets the build in words; the short keys ride along after it so
   the shop can rebuild the exact setup from the same link. */
export function quoteHref(cat: Catalog, b: Build): string {
  const d = describe(cat, b);
  const words = [d.truck, d.paint, d.stance, d.wheel, d.finish, d.tire, b.tow ? copy.towing(b.tow) : null].filter(Boolean).join(", ");
  const keys = encode(b).slice(1);
  return "/jtx.html#quote?build=" + encodeURIComponent(words) + (keys ? "&" + keys : "");
}

export const shareUrl = (b: Build) => location.origin + "/visualize/" + encode(b);

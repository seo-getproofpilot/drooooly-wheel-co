/* The build as a query string. decode trusts nothing: every part is checked
   against the catalog, anything unknown becomes null, and it never throws. */
import Fitment from "@site/fitment.js";
import type { Catalog } from "../data/types";
import { LIFTS, type Build, type LiftIn, EMPTY } from "./state";
import { brands, configOf, platforms, slugify, tireChoices, wheelModels, wheelSizes } from "./options";
import { finishCode } from "../materials/finishes";

const KEYS: (keyof Build)[] = ["v", "mn", "y", "p", "l", "lv", "b", "m", "s", "f", "t", "tow"];

export function encode(b: Build): string {
  const q = new URLSearchParams();
  for (const k of KEYS) {
    const val = b[k];
    if (val === null || val === undefined) continue;
    if (k === "lv") { if (val) q.set("lv", "1"); continue; }
    q.set(k, String(val));
  }
  const s = q.toString();
  return s ? "?" + s : "";
}

export function decode(qs: string, cat: Catalog): Build {
  let q: URLSearchParams;
  try { q = new URLSearchParams(qs); } catch { return { ...EMPTY }; }
  const get = (k: string) => { const x = q.get(k); return x === null || x === "" ? null : x; };
  const out: Build = { ...EMPTY };

  const veh = platforms(cat).find((x) => x.id === get("v"));
  out.v = veh ? veh.id : null;
  const mn = get("mn");
  out.mn = veh && mn && veh.models.includes(mn) ? mn : null;
  const y = Number(get("y"));
  out.y = veh && Number.isInteger(y) && y >= veh.years[0] && y <= veh.years[1] ? y : null;

  const p = get("p");
  out.p = p && cat.paints.some((x) => slugify(x.name) === p) ? p : null;

  const l = Number(get("l"));
  out.l = get("l") !== null && LIFTS.includes(l as LiftIn) ? (l as LiftIn) : null;
  out.lv = out.l === 0 && get("lv") === "1";

  const tow = Number(get("tow"));
  out.tow = Number.isFinite(tow) && tow > 0 && tow < 100000 ? Math.round(tow) : null;

  const brand = brands(cat).find((x) => x.slug === get("b"));
  out.b = brand ? brand.slug : null;
  // A model is valid for the brand on its own; size, finish and tire need the truck too.
  const config = veh ? configOf(veh) : "single";
  const model = brand ? wheelModels(cat, brand.slug, config).find((x) => x.model === get("m")) : undefined;
  out.m = model ? model.model : null;
  if (!brand || !model) return out;

  const f = get("f");
  out.f = f && model.finishes.some((n) => finishCode(n) === f) ? f : null;

  if (!veh) return out;
  const s = get("s");
  out.s = s && wheelSizes(cat, brand.slug, model.model, config).includes(s) ? s : null;
  if (!out.s) return out;

  const t = get("t");
  const dia = Fitment.parseSize(out.s)!.d;
  out.t = t && Fitment.parseTireSize(t) && tireChoices(cat, dia, config === "dually" ? "dual" : "any").some((x) => x.size === t) ? t : null;
  return out;
}

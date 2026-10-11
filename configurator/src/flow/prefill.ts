/* Where a build starts. The URL wins (a share link, or a shop or brand page
   that names the truck). With no truck in the URL, the site's homepage finder
   may have saved one in localStorage as { year, make, model }; it is used
   when it resolves to a truck we can draw in a year that truck covers.
   Otherwise there is no truck and the picker sheet opens. */
import type { Catalog } from "../data/types";
import { decode } from "./url";
import { matchVehicle, platforms } from "./options";
import type { Build } from "./state";

export const FINDER_KEY = "drooolyVehicle";

export function fromFinder(cat: Catalog, saved: unknown): Partial<Build> | null {
  if (!saved || typeof saved !== "object") return null;
  const { year, make, model } = saved as Record<string, unknown>;
  const v = matchVehicle(cat, String(make ?? ""), String(model ?? ""));
  if (!v || !platforms(cat).some((p) => p.id === v.id)) return null;
  const y = Number(year);
  const want = String(model ?? "").toLowerCase().trim();
  const names = v.models.map((m) => m.toLowerCase());
  const i = names.indexOf(want) >= 0 ? names.indexOf(want) : names.findIndex((a) => a.includes(want) || want.includes(a));
  return { v: v.id, mn: v.models[Math.max(0, i)], y: Number.isInteger(y) && y >= v.years[0] && y <= v.years[1] ? y : null };
}

export function readFinder(): unknown {
  try { return JSON.parse(localStorage.getItem(FINDER_KEY) ?? "null"); } catch { return null; }
}

export function initialBuild(cat: Catalog, search: string, saved: unknown): { build: Build; fromLink: boolean } {
  const b = decode(search, cat);
  if (b.v) return { build: b, fromLink: true };
  const f = fromFinder(cat, saved);
  if (!f) return { build: b, fromLink: false };
  return { build: { ...b, ...f }, fromLink: true };
}

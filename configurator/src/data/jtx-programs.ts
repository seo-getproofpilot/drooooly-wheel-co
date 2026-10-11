/* The five JTX Forged programs the slice renders. Each model name exists in
   catalog.json (brand "jtx"). Styles were read off the brand's product render
   in assets/wheels/jtx/<model>.png; the parametric face is an approximation of
   the spoke silhouette, not a trace. Hero models get hand-built later (spec 4). */
import type { WheelStyle } from "../geometry/wheel";

export const JTX_PROGRAMS: { model: string; style: WheelStyle }[] = [
  // ace.png: 12 straight spokes that taper toward the hub, solid (no slot),
  // deep concave single with a wide polished lip.
  { model: "Ace", style: { spokes: 12, spokeWidth: 0.42, dish: 0.75, split: false } },
  // alpha.png: shown as a dually. A branched lattice, roughly 10 spokes that
  // fork into Y shapes toward the lip. Modelled as 10 split spokes on a
  // shallow dually face, the closest the parametric face gets to the forks.
  { model: "Alpha", style: { spokes: 10, spokeWidth: 0.55, dish: 0.15, split: true } },
  // 404.png: shown as a dually. About 16 thin directional blades that sweep
  // from hub to lip, solid, flat dually face. sweep carries the swirl.
  { model: "404", style: { spokes: 16, spokeWidth: 0.4, dish: 0.1, split: false, sweep: 0.45 } },
  // ballistic.png: 16 thin straight spokes, solid, evenly spaced, deep concave
  // single with a wide lip.
  { model: "Ballistic", style: { spokes: 16, spokeWidth: 0.36, dish: 0.8, split: false } },
  // capo.png: 8 spokes, each split down its length by a long slot, deep
  // concave single.
  { model: "Capo", style: { spokes: 8, spokeWidth: 0.5, dish: 0.7, split: true } },
];

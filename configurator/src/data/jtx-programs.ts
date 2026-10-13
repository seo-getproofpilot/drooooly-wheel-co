/* The five JTX Forged programs the slice renders. Each model name exists in
   catalog.json (brand "jtx"). Styles were read off the brand's product render
   in assets/wheels/jtx/<model>.png; the parametric face is an approximation of
   the spoke silhouette, not a trace. Hero models get hand-built later (spec 4). */
import type { WheelStyle } from "../geometry/wheel";

export const JTX_PROGRAMS: { model: string; style: WheelStyle }[] = [
  // ace.png: 12 straight spokes, each forking into a Y about 60 percent of the
  // way out. Neighbouring arms converge at the lip, so the
  // windows read as 12 long tapering openings and 12 small triangles inside
  // the forks. Deep concave, wide polished lip.
  { model: "Ace", style: { spokes: 12, spokeWidth: 0.32, dish: 0.75, split: false, taper: 1.1, fork: { at: 0.62, spread: 0.6, arm: 0.6 } } },
  // alpha.png: shown as a dually. A lattice: 10 thin spokes fork a third of
  // the way out and the arms zigzag out to their neighbours and back, so the
  // face reads as two rows of large polygon windows round a big hub. Shallow
  // dually face.
  { model: "Alpha", style: { spokes: 10, spokeWidth: 0.26, dish: 0.15, split: false, fork: { at: 0.3, spread: 1, arm: 0.7, zigzag: 2 } } },
  // 404.png: shown as a dually. 16 directional blades, narrow at the hub and
  // wide at the lip, sweeping hard from hub to rim. Flat dually face.
  { model: "404", style: { spokes: 16, spokeWidth: 0.56, dish: 0.1, split: false, sweep: 0.85, taper: 0.5 } },
  // ballistic.png: 16 thin straight spokes, evenly spaced, slightly wider at
  // the lip, deep concave single with a wide lip.
  { model: "Ballistic", style: { spokes: 16, spokeWidth: 0.34, dish: 0.8, split: false, taper: 0.8 } },
  // capo.png: 8 broad spokes, each split down nearly its whole length by a
  // slot, so it reads as 16 twin bars. Deep concave single.
  { model: "Capo", style: { spokes: 8, spokeWidth: 0.44, dish: 0.7, split: true, slot: 0.4 } },
];

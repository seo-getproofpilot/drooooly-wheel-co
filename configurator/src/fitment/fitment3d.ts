/* fitment3d: the 3D placement layer over the storefront's fitment.js.
   fitment.js stays the one source of fitment truth (geometry, stance words,
   the measured gate on decimals). This file only turns its answer into scene
   positions: metres, axle on X, +X the driver's side, +Y up, +Z forward, origin
   on the ground under the front axle centre. */
import Fitment from "@site/fitment.js";
import type { Vehicle } from "../data/types";

export const IN = 0.0254;
export type Lift = 0 | 2.5 | 4 | 6;
export interface FitInput { vehicle: Vehicle; liftIn: Lift; leveled?: boolean; wheel: { diaIn: number; widthIn: number; offsetMm: number | null }; tire: { od: number; section: number; rim: number }; config: "single" | "dually" | "super single"; towWeightLb?: number; loadRatingLb?: number | null; }
export interface Corner { name: "FL" | "FR" | "RL" | "RR" | "RL_inner" | "RR_inner"; x: number; y: number; z: number; mirror: boolean; }
export interface FitResult { g: ReturnType<typeof Fitment.geometry>; stance: { key: string; label: string }; pokeText: string; offsetKnown: boolean; bodyLiftM: number; wheelRadiusM: number; tireRadiusM: number; tireWidthM: number; wheelWidthM: number; corners: Corner[]; loadOk: boolean | null; }

/* Fallbacks only for platforms with no `model` block yet (none in the slice
   UI; the dually test platform uses them). Never shown to a customer. */
const DEFAULT_TRACK_IN = 68, DEFAULT_WHEELBASE_IN = 150;

/* Offset null means "we do not know". The render uses the platform's stock
   offset so the wheel still sits in the arch, and offsetKnown:false tells the
   UI to say so. It never prints an invented number.

   `leveled` is accepted but does not change the maths here: a leveling kit
   raises the front only, which the scene draws as body rake (Truck's rakeDeg,
   from rakeFor in src/scene/Truck.tsx), not as a different bodyLiftM. */
export function fit(i: FitInput): FitResult {
  const v = i.vehicle;
  const offsetKnown = typeof i.wheel.offsetMm === "number" && Number.isFinite(i.wheel.offsetMm);
  const offsetMm = offsetKnown ? (i.wheel.offsetMm as number) : v.stockOffsetMm;
  const lift = i.liftIn;
  const g = Fitment.geometry({ widthIn: i.wheel.widthIn, offsetMm, tireOdIn: i.tire.od, wheelDiaIn: i.wheel.diaIn, lift, vehicle: v });
  const track = (v.model?.trackIn ?? DEFAULT_TRACK_IN) * IN;
  const wb = (v.model?.wheelbaseIn ?? DEFAULT_WHEELBASE_IN) * IN;
  const tireR = (i.tire.od / 2) * IN;
  // The hub face sits at half track. The wheel centre sits (width/2 - offset)
  // minus width/2 outboard of it, which is just -offset: negative offset pushes out.
  const centreFromFace = (g.outerFromFace - i.wheel.widthIn / 2) * IN;
  const halfTrack = track / 2;
  const corner = (name: Corner["name"], side: 1 | -1, z: number, inboard = 0): Corner =>
    ({ name, x: side * (halfTrack + centreFromFace - inboard), y: tireR, z, mirror: side < 0 });
  // +X is the driver's (left) side, so the left corners sit at +X. The wheel
  // mesh faces +X outboard, so the right (-X) corners are the mirrored ones.
  const corners: Corner[] = [corner("FL", 1, 0), corner("FR", -1, 0), corner("RL", 1, -wb), corner("RR", -1, -wb)];
  if (i.config === "dually") {
    const pair = (i.tire.section + 1) * IN; // inner wheel sits one section width plus a lip inboard
    corners.push(corner("RL_inner", 1, -wb, pair), corner("RR_inner", -1, -wb, pair));
  }
  /* Rule 5 hard stop. Slice simplification: four times the per-wheel rating
     against the disclosed trailer weight (see LAUNCH-CHECKLIST.md). null when
     the customer has not disclosed a weight or the rating is unknown. */
  const loadOk = (typeof i.towWeightLb === "number" && typeof i.loadRatingLb === "number")
    ? i.loadRatingLb * 4 >= i.towWeightLb : null;
  const stockTireR = ((v.model?.stockTireOdIn ?? i.tire.od) / 2) * IN;
  return {
    g, stance: Fitment.stance(g), pokeText: Fitment.pokeText(g, !!v.measured), offsetKnown,
    bodyLiftM: lift * IN + (tireR - stockTireR),
    wheelRadiusM: (i.wheel.diaIn / 2) * IN, tireRadiusM: tireR, tireWidthM: i.tire.section * IN, wheelWidthM: i.wheel.widthIn * IN,
    corners, loadOk,
  };
}

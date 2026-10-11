/* The words on the callout pin and in the stance section. Pure, so it is tested. */
import { pokeSentence, type FitResult } from "../fitment/fitment3d";
import { copy } from "./copy";

export interface CalloutInput { size: string; offsetMm: number | null; brand: string; model: string; finish: string; fit: FitResult; measured: boolean; liftIn: number; }

export function callout(i: CalloutInput) {
  const stance = pokeSentence(i.fit.g, i.measured);
  return {
    headline: i.offsetMm === null ? i.size : `${i.size} ${i.offsetMm}`,
    line2: `${i.brand} ${i.model}, ${i.finish}`,
    line3: stance + (i.liftIn > 0 ? copy.atLift(i.liftIn) : ""),
    stance,
  };
}

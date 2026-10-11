/* Flush to full poke, driven by fitment.js's poke in inches. Tucked reads as
   flush on this scale; the sentence under it says which. */
import { copy } from "./copy";

export const POKE_FULL_IN = 4;
export const meterPct = (poke: number) => Math.round(Math.min(1, Math.max(0, poke / POKE_FULL_IN)) * 100);

export function StanceMeter({ poke, sentence }: { poke: number; sentence: string }) {
  const p = meterPct(poke);
  return (
    <div className="meter">
      <div className="meter__bar" role="meter" aria-label={copy.stanceMeterLabel} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={p} aria-valuetext={sentence}>
        <i className="meter__mark" style={{ left: p + "%" }} />
      </div>
      <div className="meter__scale" aria-hidden="true">{copy.stanceScale.map((s) => <span key={s}>{s}</span>)}</div>
      <p className="meter__say">{sentence}</p>
    </div>
  );
}

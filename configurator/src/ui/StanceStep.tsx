import type { Build, LiftIn } from "../flow";
import { Chip, StepHead } from "./Steps";
import { copy } from "./copy";

const OPTIONS: { key: string; l: LiftIn; lv: boolean }[] = [
  { key: "stock", l: 0, lv: false }, { key: "leveled", l: 0, lv: true },
  { key: "2.5", l: 2.5, lv: false }, { key: "4", l: 4, lv: false }, { key: "6", l: 6, lv: false },
];

export const stanceKey = (b: Build) => (b.l === null ? null : b.l === 0 ? (b.lv ? "leveled" : "stock") : String(b.l));

export function StanceStep({ b, set }: { b: Build; set: (p: Partial<Build>) => void }) {
  const cur = stanceKey(b);
  return (
    <section className="step" aria-labelledby="step-3">
      <StepHead n={3} title={copy.stanceTitle} note={copy.stanceNote} />
      <div className="group">
        <div className="chips" role="group" aria-label={copy.stanceTitle}>
          {OPTIONS.map((o) => (
            <Chip key={o.key} on={cur === o.key} onClick={() => set({ l: o.l, lv: o.lv })}>{copy.stanceLabels[o.key]}</Chip>
          ))}
        </div>
        <p className="stance-help" aria-live="polite">{cur ? copy.stanceHelp[cur] : ""}</p>
      </div>
    </section>
  );
}

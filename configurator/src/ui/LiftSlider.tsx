/* Lift as a slider. The track runs to 10 inches so it reads like the deck,
   but it snaps to the five lifts the catalog knows. Past 6 is drawn dimmed
   and never selectable until there is data for it. */
import type { KeyboardEvent } from "react";
import type { Build, LiftIn } from "../flow";
import { copy } from "./copy";

const MAX = 10;
export const DETENTS: { pos: number; l: LiftIn; lv: boolean }[] = [
  { pos: 0, l: 0, lv: false }, { pos: 1.25, l: 0, lv: true }, { pos: 2.5, l: 2.5, lv: false },
  { pos: 4, l: 4, lv: false }, { pos: 6, l: 6, lv: false },
];
export const nearestDetent = (v: number) => DETENTS.reduce((a, d) => (Math.abs(d.pos - v) < Math.abs(a.pos - v) ? d : a));
const pct = (v: number) => (v / MAX) * 100;

export function LiftSlider({ b, set }: { b: Build; set: (p: Partial<Build>) => void }) {
  const l = b.l ?? 0;
  const idx = Math.max(0, DETENTS.findIndex((d) => d.l === l && d.lv === b.lv));
  const cur = DETENTS[idx];
  const go = (i: number) => { const d = DETENTS[Math.min(DETENTS.length - 1, Math.max(0, i))]; set({ l: d.l, lv: d.lv }); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (e.key in step) { e.preventDefault(); go(idx + step[e.key]); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(DETENTS.length - 1); }
  };
  return (
    <div className="lift">
      <p className="lift__value" aria-hidden="true">{copy.liftValue(cur.l, cur.lv)}</p>
      <div className="lift__track" style={{ ["--fill" as any]: pct(cur.pos) + "%", ["--cap" as any]: pct(6) + "%" }}>
        <input type="range" min={0} max={MAX} step={0.05} value={cur.pos} aria-label={copy.lift}
          aria-valuetext={copy.liftSpoken(cur.l, cur.lv)}
          onChange={(e) => { const d = nearestDetent(Number(e.target.value)); if (d !== cur) set({ l: d.l, lv: d.lv }); }}
          onKeyDown={onKey} />
        {DETENTS.map((d) => <i key={d.pos} className={"lift__tick" + (d.pos <= cur.pos ? " is-on" : "")} style={{ left: pct(d.pos) + "%" }} aria-hidden="true" />)}
      </div>
      <div className="lift__ends" aria-hidden="true"><span>{copy.liftStock}</span><span>{copy.liftMax}</span></div>
      <p className="note">{copy.liftNote}</p>
    </div>
  );
}

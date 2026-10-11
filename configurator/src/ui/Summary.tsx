import { useState } from "react";
import type { Catalog } from "../data/types";
import type { FitResult } from "../fitment/fitment3d";
import type { Build, Step } from "../flow";
import { StepHead } from "./Steps";
import { describe, quoteHref, shareUrl } from "./describe";
import { copy } from "./copy";

export interface SummaryProps {
  cat: Catalog; b: Build; fit: FitResult; offsetMm: number | null;
  set: (p: Partial<Build>) => void; go: (s: Step) => void;
  snapshot: (() => string | null) | null;
}

export function Summary({ cat, b, fit, offsetMm, set, go, snapshot }: SummaryProps) {
  const d = describe(cat, b);
  const [tow, setTow] = useState(b.tow ? String(b.tow) : "");
  const [status, setStatus] = useState<{ text: string; url?: string } | null>(null);
  const rows: [string, string | null, Step][] = [
    [copy.rowTruck, d.truck, 1], [copy.rowPaint, d.paint, 2], [copy.rowStance, d.stance, 3],
    [copy.rowWheel, d.wheel, 4], [copy.rowFinish, d.finish, 4], [copy.rowTire, d.tire, 4],
  ];
  const onTow = (v: string) => {
    const clean = v.replace(/[^\d]/g, "").slice(0, 5);
    setTow(clean);
    const n = Number(clean);
    set({ tow: clean && n > 0 ? n : null });
  };
  const share = async () => {
    const url = shareUrl(b);
    try { await navigator.clipboard.writeText(url); setStatus({ text: copy.shareDone }); }
    catch { setStatus({ text: copy.shareFallback, url }); }
  };
  const photo = () => {
    const data = snapshot?.();
    if (!data) return;
    const a = document.createElement("a");
    a.href = data; a.download = "droooly-build.png"; a.click();
  };
  return (
    <section className="step" aria-labelledby="step-5">
      <StepHead n={5} title={copy.summaryTitle} />
      <dl className="spec">
        {rows.map(([k, v, s]) => (
          <div className="spec__row" key={k}>
            <dt>{k}</dt><dd>{v}</dd>
            <button type="button" className="spec__edit" onClick={() => go(s)} aria-label={copy.edit + " " + k.toLowerCase()}>{copy.edit}</button>
          </div>
        ))}
      </dl>
      <div className="fitcard">
        <h3>{copy.fitmentHeading}</h3>
        <p className="fitcard__call">{fit.stance.label}</p>
        <p>{fit.pokeText}.</p>
        <p>{fit.offsetKnown && offsetMm !== null ? copy.offsetKnown(offsetMm) : copy.offsetUnknown}</p>
      </div>
      <label className="field">
        <span>{copy.towLabel}</span>
        <input type="text" inputMode="numeric" autoComplete="off" value={tow} onChange={(e) => onTow(e.target.value)} />
        <small>{copy.towHint}</small>
      </label>
      {fit.loadOk === false && <p className="loadstop" role="status">{copy.loadShort}</p>}
      <div className="actions">
        {fit.loadOk === false
          ? <a className="btn btn--primary btn--block" href={copy.telHref}><span className="btn-txt">{copy.talkToUs}</span></a>
          : <a className="btn btn--primary btn--block" href={quoteHref(cat, b)}><span className="btn-txt">{copy.getQuote}</span></a>}
        <div className="actions__pair" style={snapshot ? undefined : { gridTemplateColumns: "1fr" }}>
          <button type="button" className="btn btn--secondary btn--sm" onClick={share}><span className="btn-txt">{copy.share}</span></button>
          {snapshot && <button type="button" className="btn btn--secondary btn--sm" onClick={photo}><span className="btn-txt">{copy.photo}</span></button>}
        </div>
      </div>
      <div className="status" aria-live="polite">
        {status?.text}
        {status?.url && <input readOnly value={status.url} aria-label={copy.share} onFocus={(e) => e.target.select()} />}
      </div>
      <p className="fine">{copy.finePrint}</p>
    </section>
  );
}

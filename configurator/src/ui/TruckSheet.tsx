/* The tool's first step: a sheet over the dimmed stage that picks the truck
   and its paint, then steps into the visualizer. It is the configurator's own
   opening, not a warning (site rule 2), and it never opens over a link that
   already names a truck. Makes we sell for but cannot draw yet show as
   disabled, so the list reads as the real one. */
import { useEffect, useRef, useState } from "react";
import type { Catalog } from "../data/types";
import { platforms, slugify, SHOWROOM, type Build } from "../flow";
import { Chip } from "./Chip";
import { copy } from "./copy";

export type TruckDraft = Pick<Build, "v" | "mn" | "y" | "p">;

export function TruckSheet({ cat, start, onDraft, onDone, onClose }: {
  cat: Catalog; start: TruckDraft; onDraft: (d: TruckDraft) => void; onDone: (d: TruckDraft) => void; onClose: (() => void) | null;
}) {
  const drawable = platforms(cat);
  const allMakes = [...new Set(cat.vehicles.map((v) => v.make))];
  const live = new Set(drawable.map((v) => v.make));
  const [d, setD] = useState<TruckDraft>({ ...start, p: start.p ?? slugify(SHOWROOM.paint) });
  const [make, setMake] = useState<string | null>(drawable.find((v) => v.id === start.v)?.make ?? null);
  const current = drawable.find((v) => v.id === d.v);
  const models = drawable.filter((v) => v.make === make).flatMap((v) => v.models.map((name) => ({ name, v })));
  const years = current ? Array.from({ length: current.years[1] - current.years[0] + 1 }, (_, i) => current.years[1] - i) : [];
  const ready = !!(d.v && d.mn && d.y);
  const update = (patch: Partial<TruckDraft>) => { const n = { ...d, ...patch }; setD(n); onDraft(n); };

  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, []);
  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h">
      <div className="sheet__card">
        <h2 id="sheet-h" ref={head} tabIndex={-1} className="sheet__title">{copy.truckTitle}</h2>
        <p className="sheet__lead">{copy.sheetLead}</p>
        <div className="group" role="group" aria-label={copy.make}>
          <span className="label">{copy.make}</span>
          <div className="chips">
            {allMakes.map((m) => live.has(m)
              ? <Chip key={m} on={make === m} onClick={() => { setMake(m); if (current?.make !== m) update({ v: null, mn: null, y: null }); }}>{m}</Chip>
              : <button key={m} type="button" className="chip chip--soon" disabled aria-label={`${m}, ${copy.comingSoon}`}>{m}<small>{copy.comingSoon}</small></button>)}
          </div>
        </div>
        {make && (
          <div className="group" role="group" aria-label={copy.model}>
            <span className="label">{copy.model}</span>
            <div className="chips">
              {models.map(({ name, v }) => (
                <Chip key={name} on={d.v === v.id && d.mn === name}
                  onClick={() => update({ v: v.id, mn: name, y: d.y && d.y >= v.years[0] && d.y <= v.years[1] ? d.y : null })}>{name}</Chip>
              ))}
            </div>
          </div>
        )}
        {current && d.mn && (
          <div className="group" role="group" aria-label={copy.year}>
            <span className="label">{copy.year}</span>
            <div className="chips chips--years">{years.map((y) => <Chip key={y} on={d.y === y} onClick={() => update({ y })}>{String(y)}</Chip>)}</div>
          </div>
        )}
        {current && d.y && (
          <div className="group">
            <span className="label">{copy.paint}</span>
            <div className="dots" role="group" aria-label={copy.paint}>
              {cat.paints.map((p) => {
                const slug = slugify(p.name);
                return (
                  <button key={slug} type="button" className="dot" aria-pressed={d.p === slug} aria-label={p.name} title={p.name} onClick={() => update({ p: slug })}>
                    <i style={{ background: p.hex }} />
                  </button>
                );
              })}
            </div>
            <p className="note">{cat.paints.find((p) => slugify(p.name) === d.p)?.name}</p>
          </div>
        )}
        <button type="button" className="btn btn--primary btn--block sheet__go" disabled={!ready} onClick={() => onDone(d)}>
          <span className="btn-txt">{copy.openVisualizer}</span>
        </button>
        {onClose && <button type="button" className="sheet__close" onClick={onClose}>{copy.closeSheet}</button>}
        <p className="note">{copy.truckNote}</p>
      </div>
    </div>
  );
}

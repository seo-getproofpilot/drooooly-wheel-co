import { useState } from "react";
import type { Catalog } from "../data/types";
import { platforms, type Build } from "../flow";
import { Chip, StepHead } from "./Steps";
import { copy } from "./copy";

export function TruckStep({ cat, b, set }: { cat: Catalog; b: Build; set: (p: Partial<Build>) => void }) {
  const list = platforms(cat);
  const current = list.find((v) => v.id === b.v);
  const makes = [...new Set(list.map((v) => v.make))];
  const [make, setMake] = useState<string | null>(current?.make ?? (makes.length === 1 ? null : null));
  const modelName = b.mn ?? null;
  const [shopping, setShopping] = useState(false);
  const models = list.filter((v) => v.make === make).flatMap((v) => v.models.map((name) => ({ name, v })));
  const years = current ? Array.from({ length: current.years[1] - current.years[0] + 1 }, (_, i) => current.years[1] - i) : [];
  return (
    <section className="step" aria-labelledby="step-1">
      <StepHead n={1} title={shopping ? copy.truckTitleShopping : copy.truckTitle} />
      <label className="toggle">
        <input type="checkbox" checked={shopping} onChange={(e) => setShopping(e.target.checked)} />
        {copy.shoppingToggle}
      </label>
      <div className="group" role="group" aria-label={copy.make}>
        <span className="group__label">{copy.make}</span>
        <div className="chips">{makes.map((m) => <Chip key={m} on={make === m} onClick={() => setMake(m)}>{m}</Chip>)}</div>
      </div>
      {make && (
        <div className="group" role="group" aria-label={copy.model}>
          <span className="group__label">{copy.model}</span>
          <div className="chips">
            {models.map(({ name, v }) => (
              <Chip key={name} on={b.v === v.id && modelName === name} onClick={() => { set({ v: v.id, mn: name, ...(b.y && (b.y < v.years[0] || b.y > v.years[1]) ? { y: null } : {}) }); }}>{name}</Chip>
            ))}
          </div>
        </div>
      )}
      {current && modelName && (
        <div className="group" role="group" aria-label={copy.year}>
          <span className="group__label">{copy.year}</span>
          <div className="chips">{years.map((y) => <Chip key={y} on={b.y === y} onClick={() => set({ y })}>{String(y)}</Chip>)}</div>
        </div>
      )}
      <p className="step__note" style={{ marginTop: 28 }}>{copy.truckNote}</p>
    </section>
  );
}

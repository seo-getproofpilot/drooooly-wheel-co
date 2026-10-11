import type { Catalog } from "../data/types";
import { slugify, type Build } from "../flow";
import { StepHead } from "./Steps";
import { copy } from "./copy";

export function PaintStep({ cat, b, set }: { cat: Catalog; b: Build; set: (p: Partial<Build>) => void }) {
  return (
    <section className="step" aria-labelledby="step-2">
      <StepHead n={2} title={copy.paintTitle} note={copy.paintNote} />
      <div className="group">
        <div className="swatches">
          {cat.paints.map((p) => {
            const slug = slugify(p.name);
            return (
              <button key={slug} type="button" className="swatch" aria-pressed={b.p === slug} onClick={() => set({ p: slug })}>
                <i style={{ background: p.hex }} aria-hidden="true" />
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

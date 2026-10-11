import Fitment from "@site/fitment.js";
import type { Catalog } from "../data/types";
import { brands, configOf, platforms, tireChoices, wheelModels, wheelSizes, type Build } from "../flow";
import { finishCode } from "../materials/finishes";
import { Chip, StepHead } from "./Steps";
import { copy } from "./copy";

export function WheelStep({ cat, b, set, quoteHref }: { cat: Catalog; b: Build; set: (p: Partial<Build>) => void; quoteHref: string }) {
  const veh = platforms(cat).find((v) => v.id === b.v)!;
  const config = configOf(veh);
  const brandList = brands(cat);
  const brand = brandList.find((x) => x.slug === b.b) ?? brandList[0];
  const models = brand ? wheelModels(cat, brand.slug, config) : [];
  const model = models.find((m) => m.model === b.m);
  const sizes = model ? wheelSizes(cat, brand.slug, model.model, config) : [];
  const byDia = new Map<number, string[]>();
  for (const s of sizes) { const d = Fitment.parseSize(s)!.d; byDia.set(d, [...(byDia.get(d) ?? []), s]); }
  const dia = b.s ? Fitment.parseSize(b.s)!.d : null;
  const tires = dia !== null ? tireChoices(cat, dia, config === "dually" ? "dual" : "any") : [];
  return (
    <section className="step" aria-labelledby="step-4">
      <StepHead n={4} title={copy.wheelTitle} />
      {brandList.length > 1 && (
        <div className="group" role="group" aria-label={copy.brand}>
          <span className="group__label">{copy.brand}</span>
          <div className="chips">{brandList.map((x) => <Chip key={x.slug} on={brand?.slug === x.slug} onClick={() => set({ b: x.slug, m: null })}>{x.name}</Chip>)}</div>
        </div>
      )}
      <div className="group" role="group" aria-label={copy.style}>
        <span className="group__label">{brand ? brand.name + " " + copy.style.toLowerCase() : copy.style}</span>
        <div className="models">
          {models.map((m) => (
            <button key={m.model} type="button" className="model" aria-pressed={b.m === m.model} onClick={() => set({ b: brand.slug, m: m.model })}>
              {m.img && <img src={"/" + m.img} alt="" width={680} height={550} />}
              <span>{m.model}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="group" role="group" aria-label={copy.size}>
        <span className="group__label">{copy.size}</span>
        {model ? (
          <>
            <p className="group__hint">{copy.sizeHint}</p>
            <div className="sizes">
              {[...byDia].map(([d, list]) => (
                <div className="sizes__row" key={d}>
                  <span className="sizes__dia" aria-hidden="true">{d}"</span>
                  <div className="chips">{list.map((s) => <Chip key={s} on={b.s === s} onClick={() => set({ s })}>{s}</Chip>)}</div>
                </div>
              ))}
            </div>
          </>
        ) : <p className="group__hint">{copy.pickStyleFirst}</p>}
      </div>
      {model && (
        <div className="group" role="group" aria-label={copy.finish}>
          <span className="group__label">{copy.finish}</span>
          <div className="chips">
            {model.finishes.map((n) => <Chip key={n} on={b.f === finishCode(n)} onClick={() => set({ f: finishCode(n) })}>{n}</Chip>)}
          </div>
        </div>
      )}
      {model && (
        <div className="group" role="group" aria-label={copy.tire}>
          <span className="group__label">{copy.tire}</span>
          {dia === null ? <p className="group__hint">{copy.pickSizeFirst}</p>
            : tires.length === 0 ? (
              <p className="empty" role="status">{copy.noTire(dia)}<br /><a href={quoteHref}>{copy.askOnQuote}</a></p>
            ) : (
              <div className="tires">
                {tires.map((t) => (
                  <button key={t.size} type="button" className="tire" aria-pressed={b.t === t.size} onClick={() => set({ t: t.size })}>
                    <b>{t.size}</b>
                    <small>{copy.tireSoldAs(t.fitments)}</small>
                  </button>
                ))}
              </div>
            )}
        </div>
      )}
    </section>
  );
}

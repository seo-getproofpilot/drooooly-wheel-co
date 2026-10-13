/* The live panel: one column of sections, top to bottom in the deck's order,
   every one editable in place. App owns the build; this only reads it and
   sends patches. */
import { useEffect, useRef, useState } from "react";
import Fitment from "@site/fitment.js";
import type { Catalog, Vehicle } from "../data/types";
import type { FitResult } from "../fitment/fitment3d";
import { brands, configOf, offsetChoices, slugify, tireChoices, wheelModels, wheelSizes, type Build } from "../flow";
import { finishCode } from "../materials/finishes";
import { Chip, Section } from "./Chip";
import { LiftSlider } from "./LiftSlider";
import { StanceMeter } from "./StanceMeter";
import { describe, quoteHref, shareUrl } from "./describe";
import { StudioLightbox } from "./StudioLightbox";
import { requestStill, type StudioCamera } from "../data/render";
import { copy } from "./copy";

export interface PanelProps {
  cat: Catalog; b: Build; vehicle: Vehicle; fit: FitResult; stanceSentence: string;
  set: (p: Partial<Build>) => void; editTruck: () => void; snapshot: (() => string | null) | null;
  /** the live camera pose for a studio shot; null on the poster or before the 3D camera exists */
  camera?: (() => StudioCamera | null) | null;
}

/* "37x13.50R26" shows as 37x13.50 (the rim is the wheel already picked). A metric size keeps its full name. */
const tireLabel = (size: string) => (/^\d+(\.\d+)?x/i.test(size) ? size.replace(/R\d+(\.\d+)?.*$/i, "") : size);

export function Panel({ cat, b, vehicle, fit, stanceSentence, set, editTruck, snapshot, camera = null }: PanelProps) {
  const config = configOf(vehicle);
  const dually = config === "dually";
  const lugs = /^(\d+)x/.exec(vehicle.bolt)?.[1] ?? null;
  const brand = brands(cat).find((x) => x.slug === b.b) ?? brands(cat)[0];
  const models = brand ? wheelModels(cat, brand.slug, config) : [];
  const model = models.find((m) => m.model === b.m);
  const sizes = model ? wheelSizes(cat, brand.slug, model.model, config) : [];
  const byDia = new Map<number, string[]>();
  for (const s of sizes) { const d = Fitment.parseSize(s)!.d; byDia.set(d, [...(byDia.get(d) ?? []), s]); }
  const ps = b.s ? Fitment.parseSize(b.s)! : null;
  const offsets = ps ? offsetChoices(cat, ps.w!, config, ps.d) : [];
  const typical = ps ? (() => { const role = Fitment.offsetRole(ps.w!, dually ? "dually" : "single"); const e = Fitment.offsetFor(cat.offsets, role, ps.d, ps.w!); return typeof e?.typical === "number" ? e.typical : null; })() : null;
  const offsetOn = b.o ?? typical;
  const tires = ps ? tireChoices(cat, ps.d, dually ? "dual" : "any") : [];
  const byOd = new Map<number, typeof tires>();
  for (const t of tires) { const k = Math.round(t.od); byOd.set(k, [...(byOd.get(k) ?? []), t]); }
  const [styles, setStyles] = useState(false);
  const [tow, setTow] = useState(b.tow ? String(b.tow) : "");
  const [status, setStatus] = useState<{ text: string; url?: string } | null>(null);
  const quote = quoteHref(cat, b);

  const onTow = (v: string) => {
    const clean = v.replace(/[^\d]/g, "").slice(0, 5);
    setTow(clean);
    const n = Number(clean);
    set({ tow: clean && n > 0 ? n : null });
  };
  const share = async () => {
    const url = shareUrl(b);
    try { await navigator.clipboard.writeText(url); setStatus({ text: copy.shareDone }); }
    catch { setStatus({ text: copy.copyThisLink, url }); }
  };
  const photo = () => {
    const data = snapshot?.();
    if (!data) return;
    const a = document.createElement("a");
    a.href = data; a.download = "droooly-build.png"; a.click();
  };

  /* Studio shot: the build and the camera go to the render service; the 3D
     view stays live while it works, and the still opens in the lightbox. */
  const [pending, setPending] = useState(false);
  const [still, setStill] = useState<string | null>(null);
  const job = useRef<AbortController | null>(null);
  const studioBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => () => job.current?.abort(), []);
  const studio = async () => {
    const cam = camera?.();
    if (!cam || pending) return;
    const ctl = new AbortController();
    job.current = ctl;
    setPending(true);
    setStatus({ text: copy.studioWorking });
    try {
      const { url } = await requestStill(b, cam, ctl.signal, {
        onStatus: (s) => {
          if (s.status === "done") return;
          setStatus({ text: s.position && s.position > 1 ? `${copy.studioWorking} ${copy.studioInLine(s.position)}` : copy.studioWorking });
        },
      });
      setStatus(null);
      setStill(url);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setStatus({ text: copy.studioFailed });
    } finally {
      if (job.current === ctl) job.current = null;
      setPending(false);
    }
  };
  const words = describe(cat, b);

  return (
    <div className="live">
      <Section id="sec-truck" label={copy.yourTruck}>
        <button type="button" className="card card--truck" onClick={editTruck} aria-label={`${b.y} ${vehicle.make} ${b.mn ?? vehicle.models[0]}. ${copy.changeTruck}`}>
          <b>{b.y} {vehicle.make} {b.mn ?? vehicle.models[0]}</b>
          <span>{copy.cab(vehicle.model?.cab ?? "crew", dually)}</span>
        </button>
        <div className="dots" role="group" aria-label={copy.paint}>
          {cat.paints.map((p) => {
            const slug = slugify(p.name);
            return (
              <button key={slug} type="button" className="dot" aria-pressed={b.p === slug} aria-label={p.name} title={p.name} onClick={() => set({ p: slug })}>
                <i style={{ background: p.hex }} />
              </button>
            );
          })}
        </div>
        <p className="note">{cat.paints.find((p) => slugify(p.name) === b.p)?.name}. {copy.paintNote}</p>
      </Section>

      <Section id="sec-lift" label={copy.lift}>
        <LiftSlider b={b} set={set} />
      </Section>

      <Section id="sec-wheel" label={copy.wheel}>
        {model && (
          <button type="button" className="card card--wheel" aria-expanded={styles} aria-controls="styles" onClick={() => setStyles(!styles)}>
            {model.img && <img src={"/" + model.img} alt="" width={680} height={550} />}
            <span className="card__txt">
              <b>{copy.brandShort(brand.name)} {model.model}</b>
              <span>{copy.series(dually, lugs)}</span>
            </span>
            <span className="card__go">{styles ? copy.closeStyles : copy.changeStyle}</span>
          </button>
        )}
        {styles && (
          <div className="models" id="styles" role="group" aria-label={copy.styleGrid}>
            {models.map((m) => (
              <button key={m.model} type="button" className="model" aria-pressed={b.m === m.model}
                onClick={() => { set({ b: brand.slug, m: m.model }); setStyles(false); }}>
                {m.img && <img src={"/" + m.img} alt="" width={680} height={550} />}
                <span>{m.model}</span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section id="sec-size" label={copy.sizeOffset}>
        <div className="sizes" role="group" aria-label={copy.size}>
          {[...byDia].map(([d, list]) => (
            <div className="sizes__row" key={d}>
              <span className="sizes__dia" aria-hidden="true">{d}"</span>
              <div className="chips">{list.map((s) => <Chip key={s} on={b.s === s} onClick={() => set({ s })}>{s}</Chip>)}</div>
            </div>
          ))}
        </div>
        {ps && (
          <div className="group" role="group" aria-label={copy.offset}>
            <span className="label">{copy.offset}</span>
            <div className="chips">
              {offsets.length
                ? offsets.map((o) => <Chip key={o} on={offsetOn === o} label={copy.offsetAria(o)} onClick={() => set({ o })}>{copy.offsetChip(o)}</Chip>)
                : <Chip on onClick={() => set({ o: null })}>{copy.offsetCut}</Chip>}
            </div>
            <p className="note">{offsets.length ? copy.offsetKnown : copy.offsetUnknown}</p>
          </div>
        )}
      </Section>

      {model && (
        <Section id="sec-finish" label={copy.finish} aside={<span className="sec__val">{model.finishes.find((n) => finishCode(n) === b.f)}</span>}>
          <div className="dots" role="group" aria-label={copy.finish}>
            {model.finishes.map((n) => (
              <button key={n} type="button" className={"dot dot--finish dot--" + finishCode(n)} aria-pressed={b.f === finishCode(n)}
                aria-label={n} title={n} onClick={() => set({ f: finishCode(n) })}><i /></button>
            ))}
          </div>
        </Section>
      )}

      <Section id="sec-tire" label={copy.tire}>
        {ps && tires.length === 0 ? (
          <p className="empty" role="status">{copy.noTire(ps.d)}<br /><a href={quote}>{copy.askOnQuote}</a></p>
        ) : (
          <div className="sizes" role="group" aria-label={copy.tire}>
            {[...byOd].map(([od, list]) => (
              <div className="sizes__row" key={od}>
                <span className="sizes__dia" aria-hidden="true">{od}"</span>
                <div className="chips">
                  {list.map((t) => (
                    <Chip key={t.size} on={b.t === t.size} label={copy.tireAria(t.size, t.fitments)} title={copy.tireAria(t.size, t.fitments)}
                      onClick={() => set({ t: t.size })}>{tireLabel(t.size)}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="sec-stance" label={copy.stance} aside={<span className="sec__val">{fit.stance.label}</span>}>
        <StanceMeter poke={fit.g.poke} sentence={stanceSentence} />
        <label className="field">
          <span>{copy.towLabel}</span>
          <input type="text" inputMode="numeric" autoComplete="off" value={tow} onChange={(e) => onTow(e.target.value)} />
          <small>{copy.towHint}</small>
        </label>
        {fit.loadOk === false && <p className="loadstop" role="status">{copy.loadShort}</p>}
      </Section>

      <div className="cta">
        {fit.loadOk === false
          ? <a className="btn btn--primary btn--block" href={copy.telHref}><span className="btn-txt">{copy.talkToUs}</span></a>
          : <a className="btn btn--primary btn--block" href={quote}><span className="btn-txt">{copy.getQuote}</span></a>}
      </div>

      <footer className="foot">
        <div className="foot__pair">
          <button type="button" className="btn btn--secondary btn--sm" onClick={share}><span className="btn-txt">{copy.share}</span></button>
          {snapshot && <button type="button" className="btn btn--secondary btn--sm" onClick={photo}><span className="btn-txt">{copy.photo}</span></button>}
          {camera && (
            <button type="button" className="btn btn--secondary btn--sm" ref={studioBtn} onClick={studio} disabled={pending} aria-busy={pending}>
              <span className="btn-txt">{copy.studioShot}</span>
            </button>
          )}
        </div>
        <div className="status" aria-live="polite">
          {status?.text}
          {status?.url && <input readOnly value={status.url} aria-label={copy.share} onFocus={(e) => e.target.select()} />}
        </div>
        <p className="fine">{copy.finePrint}</p>
      </footer>
      {still && <StudioLightbox url={still} alt={copy.studioAlt(words.truck ?? vehicle.make)} onClose={() => setStill(null)}
        returnFocus={() => studioBtn.current} />}
    </div>
  );
}

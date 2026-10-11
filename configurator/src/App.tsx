/* The guided flow. The build lives in the URL (every state is a share link),
   the step shown is the first one not finished unless the customer went back,
   and the stage always shows the closest renderable version of the build.
   ?poster=1 fills the viewport with the stage and nothing else, for
   tools/3d/render-posters.mjs. */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Box3 } from "three";
import Fitment from "@site/fitment.js";
import { loadCatalog } from "./data/catalog";
import { fit, type FitResult } from "./fitment/fitment3d";
import { JTX_PROGRAMS } from "./data/jtx-programs";
import { JTX_LOAD_RATING_LB } from "./data/ratings";
import { Stage, webglAvailable } from "./scene/Stage";
import type { CameraPreset } from "./scene/cameras";
import { Truck, rakeFor } from "./scene/Truck";
import { WheelSet } from "./scene/WheelSet";
import { Poster } from "./scene/Poster";
import { configOf, decode, encode, firstIncomplete, offsetFor, platforms, reduce, slugify, tireChoices, treadOf, type Build, type Step } from "./flow";
import type { FinishCode } from "./materials/finishes";
import { Steps } from "./ui/Steps";
import { TruckStep } from "./ui/TruckStep";
import { PaintStep } from "./ui/PaintStep";
import { StanceStep } from "./ui/StanceStep";
import { WheelStep } from "./ui/WheelStep";
import { Summary } from "./ui/Summary";
import { quoteHref } from "./ui/describe";
import { copy } from "./ui/copy";

export const APP_NAME = "DROOOLY Visualize";

const catalog = loadCatalog();
const PRESET_BY_STEP: Record<Step, CameraPreset> = { 1: "hero", 2: "hero", 3: "side", 4: "wheel", 5: "hero" };
/* What the truck wears before the customer has picked wheels. */
const SHOWROOM = { model: "Ace", size: "22x12", finish: "polished" as FinishCode, tire: "35x12.50R22" };
const DEFAULT_PAINT = "Iconic Silver";

interface Render { fit: FitResult; model: string; finish: FinishCode; tread: "AT" | "MT"; offsetMm: number | null; }

function renderFor(b: Build): Render | null {
  const vehicle = platforms(catalog).find((v) => v.id === b.v) ?? platforms(catalog).find((v) => v.id === "f250")!;
  const config = configOf(vehicle);
  const size = b.s ?? SHOWROOM.size;
  const ps = Fitment.parseSize(size)!;
  const model = b.m ?? SHOWROOM.model;
  // With no tire picked yet, preview the tire we sell for this rim that is
  // closest to 35 inches. With none at all, there is nothing honest to draw.
  let tire = b.t;
  if (!tire) {
    const list = tireChoices(catalog, ps.d, config === "dually" ? "dual" : "any");
    if (!b.s) tire = SHOWROOM.tire;
    else if (list.length) tire = [...list].sort((a, c) => Math.abs(a.od - 35) - Math.abs(c.od - 35))[0].size;
  }
  if (!tire) return null;
  const t = Fitment.parseTireSize(tire)!;
  const offsetMm = offsetFor(catalog, ps.w!, config, ps.d);
  const f = fit({ vehicle, liftIn: b.l ?? 0, leveled: b.lv, wheel: { diaIn: ps.d, widthIn: ps.w!, offsetMm }, tire: t, config,
    towWeightLb: b.tow ?? undefined, loadRatingLb: JTX_LOAD_RATING_LB });
  return { fit: f, model, finish: (b.f as FinishCode | null) ?? SHOWROOM.finish, tread: treadOf(catalog, tire), offsetMm };
}

export default function App() {
  const posterMode = new URLSearchParams(location.search).get("poster") === "1";
  const [b, dispatch] = useReducer(reduce, undefined, () => decode(location.search, catalog));
  const [view, setView] = useState<Step | null>(null);
  const reached = firstIncomplete(b);
  const step: Step = view !== null && view <= reached ? view : reached;

  useEffect(() => {
    if (posterMode) return;
    history.replaceState(null, "", location.pathname + encode(b));
  }, [b, posterMode]);

  /* First pass through the flow, a finished step moves on by itself. Going
     back to a step keeps you there until you press continue. */
  const set = useCallback((patch: Partial<Build>) => { dispatch({ type: "set", patch }); }, []);
  const go = useCallback((s: Step) => setView(s), []);

  /* A new step starts at its heading. On a phone the stage is stuck to the
     top, so the heading lands just under it, never behind it. */
  const panelRef = useRef<HTMLDivElement>(null);
  const shown = useRef<Step | null>(null);
  useEffect(() => {
    if (shown.current === null) { shown.current = step; return; }
    if (shown.current === step) return;
    shown.current = step;
    const nav = panelRef.current?.querySelector(".steps");
    const stageEl = document.querySelector(".stage") as HTMLElement | null;
    if (!nav) return;
    const offset = window.innerWidth < 960 && stageEl ? stageEl.offsetHeight : 0;
    const target = nav.getBoundingClientRect().top + window.scrollY - offset - 8;
    if (window.scrollY > target) window.scrollTo({ top: target, behavior: "smooth" });
  }, [step]);

  const vehicle = platforms(catalog).find((v) => v.id === b.v) ?? platforms(catalog).find((v) => v.id === "f250")!;
  const paintName = catalog.paints.find((p) => slugify(p.name) === b.p)?.name ?? DEFAULT_PAINT;
  const paint = catalog.paints.find((p) => p.name === paintName) ?? catalog.paints[0];

  const last = useRef<Render | null>(null);
  const r = useMemo(() => {
    const next = renderFor(b);
    if (next) last.current = next;
    return next ?? last.current ?? renderFor({ ...b, s: null, t: null })!;
  }, [b]);
  const f = r.fit;

  const [body, setBody] = useState<Box3 | null>(null);
  const onBounds = useCallback((box: Box3) => setBody(box.clone()), []);
  const frame = useMemo(() => {
    if (!body) return null;
    const box = body.clone();
    for (const c of f.corners) box.expandByPoint({ x: c.x + Math.sign(c.x) * f.tireWidthM / 2, y: 0, z: c.z } as any);
    return box;
  }, [body, f]);

  const [gl] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const show3d = gl && !lost;
  const snapRef = useRef<(() => string | null) | null>(null);
  const style = (JTX_PROGRAMS.find((p) => p.model === r.model) ?? JTX_PROGRAMS[0]).style;
  const rake = rakeFor(b.lv, b.l ?? 0);
  const shadowKey = [vehicle.id, f.bodyLiftM.toFixed(4), rake, f.corners.map((c) => c.x.toFixed(4)).join(","), body ? "b" : "-"].join("|");
  // The driver's front wheel (+X), with the fender above it in frame.
  const fl = f.corners.find((c) => c.name === "FL")!;
  const focus = useMemo(() => ({ center: [fl.x, fl.y + f.tireRadiusM * 0.25, fl.z] as [number, number, number], radius: f.tireRadiusM * 2.1 }),
    [fl.x, fl.y, fl.z, f.tireRadiusM]);
  const preset = posterMode ? "hero" : PRESET_BY_STEP[step];

  const stage = (
    <section className="stage" aria-label={copy.stageLabel} style={posterMode ? { height: "100vh", position: "static", border: 0 } : undefined}>
      {show3d ? (
        <Stage preset={preset} frame={frame} shadowKey={shadowKey} onContextLost={() => setLost(true)} snapshotRef={snapRef} focus={focus}>
          <Truck vehicle={vehicle} paintHex={paint.hex} bodyLiftM={f.bodyLiftM} rakeDeg={rake} onBounds={onBounds} />
          <WheelSet fit={f} style={style} finish={r.finish} tread={r.tread} />
        </Stage>
      ) : (
        <Poster vehicle={vehicle} />
      )}
      {show3d && !posterMode && <span className="stage__hint" aria-hidden="true">{copy.stageHint}</span>}
      {show3d && !posterMode && <span className="stage__badge">{copy.stageBadge}</span>}
    </section>
  );

  if (posterMode) return <main id="app"><h1 className="sr-only">{APP_NAME}</h1>{stage}</main>;

  const revisiting = view !== null && view < reached;
  return (
    <>
      <header className="topbar">
        <div className="topbar__in">
          <a href="/" aria-label="DROOOLY Wheel and Tire home"><img className="topbar__logo" src="/assets/logo-wordmark.png" alt="DROOOLY Wheel & Tire" width={240} height={30} /></a>
          <a className="topbar__back" href="/shop.html">{copy.backToShop}</a>
          <a className="topbar__tel" href={copy.telHref} aria-label={"Call DROOOLY Wheel and Tire, " + copy.callUs}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8.1 9.7a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2z"/></svg>
            <span>{copy.callUs}</span>
          </a>
        </div>
      </header>
      <main id="app" className="viz">
        {stage}
        <div className="panel" ref={panelRef}>
          <div className="intro">
            <p className="intro__eyebrow">{APP_NAME}</p>
            <h1>{copy.pageTitle}</h1>
            {step === 1 && <p>{copy.pageLead}</p>}
          </div>
          <Steps active={step} reached={reached} onGo={go} />
          {step === 1 && <TruckStep cat={catalog} b={b} set={set} />}
          {step === 2 && <PaintStep cat={catalog} b={b} set={set} />}
          {step === 3 && <StanceStep b={b} set={set} />}
          {step === 4 && <WheelStep cat={catalog} b={b} set={set} quoteHref={quoteHref(catalog, b)} />}
          {step === 5 && <Summary cat={catalog} b={b} fit={f} offsetMm={r.offsetMm} set={set} go={go}
            snapshot={show3d ? () => snapRef.current?.() ?? null : null} />}
          {revisiting && (
            <div className="continue">
              <button type="button" className="btn btn--primary btn--block" onClick={() => setView(null)}>
                <span className="btn-txt">{reached === 5 ? copy.backToSummary : copy.continueTo(copy.stepNames[reached - 1])}</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

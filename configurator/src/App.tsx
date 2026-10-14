/* The configurator. The build lives in the URL (every state is a share link).
   Before a truck is picked the panel is the truck picker and the stage turns
   the showroom build; after, the panel is one live column and every change
   redraws the stage. ?poster=1 fills the viewport with the stage and nothing
   else, for tools/3d/render-posters.mjs. */
import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box3 } from "three";
import Fitment from "@site/fitment.js";
import { loadCatalog } from "./data/catalog";
import { fit, pokeSentence, type FitResult } from "./fitment/fitment3d";
import { JTX_PROGRAMS } from "./data/jtx-programs";
import { JTX_LOAD_RATING_LB } from "./data/ratings";
import { Stage, webglAvailable } from "./scene/Stage";
import { CAMERA_CHIPS, type CameraPreset } from "./scene/cameras";
import { Pins } from "./scene/Pins";
import { Truck, rakeFor } from "./scene/Truck";
import { WheelSet } from "./scene/WheelSet";
import { Poster } from "./scene/Poster";
import { brands, configOf, decode, encode, initialBuild, platforms, readFinder, reduce, seed, slugify, treadOf, truckPicked, SHOWROOM, type Build } from "./flow";
import { registerBuildSetter } from "./dev/exportBridge";
import { finishCode, type FinishCode } from "./materials/finishes";
import { TruckSheet, type TruckDraft } from "./ui/TruckSheet";
import { Panel } from "./ui/Panel";
import { CameraProbe } from "./ui/CameraProbe";
import { SignInSheet } from "./ui/SignInSheet";
import { buildRow, onAuth, saveBuild, type AccountUser } from "./data/account";
import type { StudioCamera } from "./data/render";
import { callout } from "./ui/callout";
import { copy } from "./ui/copy";

export const APP_NAME = "DROOOLY Visualize";

const catalog = loadCatalog();
/* Dev-only scene export for the offline render comparison (vite dev or
   ?export=1); see dev/exportScene.ts. Never fetched otherwise. */
const EXPORT_ENABLED = import.meta.env.DEV || new URLSearchParams(location.search).get("export") === "1";
const ExportHook = EXPORT_ENABLED ? lazy(() => import("./dev/exportScene")) : null;
const PIN_PRESETS: CameraPreset[] = ["front", "threeQuarter", "wheel"];
const TAB_TARGETS = ["sec-truck", "sec-wheel", "sec-tire", "sec-stance"];
/* Truck lands on the front hero, Wheel and Tire on the wheel close-up,
   Stance on the side view, where ride height and poke read. */
const TAB_CAMERA: CameraPreset[] = ["front", "wheel", "wheel", "side"];

/* What the stage draws: the customer's build once a truck is picked, the
   showroom build on their truck (or the F-250) before that. */
function stageBuild(b: Build): Build {
  if (truckPicked(b)) return b;
  const v = platforms(catalog).find((x) => x.id === b.v) ?? platforms(catalog).find((x) => x.id === "f250")!;
  return seed(catalog, { ...b, v: v.id, y: v.years[1], p: b.p, s: null, o: null, t: null });
}

interface Render { fit: FitResult; model: string; finishCode: FinishCode; finishName: string; tread: "AT" | "MT"; offsetMm: number | null; }

function renderFor(b: Build): Render | null {
  const vehicle = platforms(catalog).find((v) => v.id === b.v)!;
  const config = configOf(vehicle);
  if (!b.s || !b.t) return null;
  const ps = Fitment.parseSize(b.s)!;
  const t = Fitment.parseTireSize(b.t)!;
  const role = Fitment.offsetRole(ps.w!, config === "dually" ? "dually" : "single");
  const e = Fitment.offsetFor(catalog.offsets, role, ps.d, ps.w!);
  const offsetMm = b.o ?? (typeof e?.typical === "number" ? e.typical : null);
  const f = fit({ vehicle, liftIn: b.l ?? 0, leveled: b.lv, wheel: { diaIn: ps.d, widthIn: ps.w!, offsetMm }, tire: t, config,
    towWeightLb: b.tow ?? undefined, loadRatingLb: JTX_LOAD_RATING_LB });
  const model = brands(catalog).find((x) => x.slug === b.b)?.models.find((m) => m.model === b.m);
  const fc = (b.f as FinishCode | null) ?? "polished";
  return { fit: f, model: b.m ?? SHOWROOM.model, finishCode: fc, finishName: model?.finishes.find((n) => finishCode(n) === fc) ?? "Polished",
    tread: treadOf(catalog, b.t), offsetMm };
}

export default function App() {
  const posterMode = new URLSearchParams(location.search).get("poster") === "1";
  const [start] = useState(() => initialBuild(catalog, location.search, readFinder()));
  const [b, setB] = useState<Build>(() => seed(catalog, start.build));
  const set = useCallback((patch: Partial<Build>) => {
    setB((prev) => seed(catalog, reduce(prev, { type: "set", patch }), prev));
  }, []);

  useEffect(() => {
    if (posterMode) return;
    history.replaceState(null, "", location.pathname + encode(b));
  }, [b, posterMode]);

  /* The render service's warm page swaps builds through the export hook
     (dev/exportBridge.ts). A transition keeps the current truck on stage
     while a new body downloads instead of dropping to the Suspense fallback. */
  useEffect(() => {
    if (!EXPORT_ENABLED) return;
    return registerBuildSetter((query) => {
      const next = seed(catalog, decode(query, catalog));
      startTransition(() => setB(next));
      return encode(next);
    });
  }, []);

  /* The sheet opens on a cold start only; a link or a saved finder truck goes
     straight to the panel. The truck card opens it again to change trucks. */
  const picked = truckPicked(b);
  const [sheet, setSheet] = useState(() => !start.fromLink && !posterMode);
  const showPicker = sheet || !picked;
  const [draft, setDraft] = useState<TruckDraft | null>(null);

  const sb = useMemo(() => {
    if (showPicker && draft?.v) return seed(catalog, reduce(b, { type: "set", patch: draft }), b);
    if (showPicker && draft?.p && !picked) return stageBuild({ ...b, p: draft.p });
    return stageBuild(b);
  }, [b, draft, showPicker, picked]);
  const vehicle = platforms(catalog).find((v) => v.id === sb.v)!;
  const paint = catalog.paints.find((p) => slugify(p.name) === sb.p) ?? catalog.paints.find((p) => p.name === SHOWROOM.paint) ?? catalog.paints[0];

  const last = useRef<Render | null>(null);
  const r = useMemo(() => {
    const next = renderFor(sb);
    if (next) last.current = next;
    return next ?? last.current ?? renderFor(stageBuild({ ...sb, v: sb.v, y: null }))!;
  }, [sb]);
  const f = r.fit;
  const brandName = copy.brandShort(brands(catalog).find((x) => x.slug === sb.b)?.name ?? "JTX");
  const words = callout({ size: sb.s ?? "", offsetMm: r.offsetMm, brand: brandName, model: r.model, finish: r.finishName, fit: f,
    measured: !!vehicle.measured, liftIn: sb.l ?? 0 });

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
  /* the live camera pose for the studio shot, filled from inside the Canvas */
  const camRef = useRef<(() => StudioCamera | null) | null>(null);
  const [camReady, setCamReady] = useState(false);
  const style = (JTX_PROGRAMS.find((p) => p.model === r.model) ?? JTX_PROGRAMS[0]).style;
  const rake = rakeFor(sb.lv, sb.l ?? 0);
  const shadowKey = [vehicle.id, f.bodyLiftM.toFixed(4), rake, f.corners.map((c) => c.x.toFixed(4)).join(","), body ? "b" : "-"].join("|");
  const fl = f.corners.find((c) => c.name === "FL")!;
  const focus = useMemo(() => ({ center: [fl.x, fl.y + f.tireRadiusM * 0.25, fl.z] as [number, number, number], radius: f.tireRadiusM * 2.1 }),
    [fl.x, fl.y, fl.z, f.tireRadiusM]);
  const [cam, setCam] = useState<CameraPreset>("front");
  const preset: CameraPreset = posterMode ? "threeQuarter" : cam;

  /* Step tabs scroll to their section. The one whose heading has passed the
     top of the panel's visible area is the active one. */
  const [tab, setTab] = useState(0);
  const goTab = (i: number) => {
    setTab(i); setCam(TAB_CAMERA[i]);
    requestAnimationFrame(() => document.getElementById(TAB_TARGETS[i])?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  useEffect(() => {
    if (showPicker) return;
    const onScroll = () => {
      const stageEl = document.querySelector(".stage") as HTMLElement | null;
      const line = (window.innerWidth < 960 && stageEl ? stageEl.offsetHeight : 0) + 120;
      let cur = 0;
      TAB_TARGETS.forEach((id, i) => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < line) cur = i; });
      setTab(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showPicker]);

  /* Save my build: into the shopper's garage (data/account.ts). Signed out,
     the sign-in sheet opens and the save runs the moment the code checks
     out. The share link stays on the panel's Share button. */
  const [acct, setAcct] = useState<AccountUser | null>(null);
  useEffect(() => onAuth(setAcct), []);
  const [stillKey, setStillKey] = useState<string | null>(null);
  useEffect(() => { setStillKey(null); }, [b]);
  const [signIn, setSignIn] = useState(false);
  const saveBtn = useRef<HTMLButtonElement>(null);
  const [saved, setSaved] = useState<{ text: string; href?: string } | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const note = (n: { text: string; href?: string } | null) => {
    setSaved(n);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(null), 8000);
  };
  const doSave = async () => {
    try { await saveBuild(buildRow(catalog, b, stillKey)); note({ text: copy.savedToGarage, href: "/garage.html" }); }
    catch { note({ text: copy.saveFailed }); }
  };
  const save = () => { if (acct) void doSave(); else setSignIn(true); };

  const bodyCredit = copy.bodyCredits[vehicle.model?.file ?? ""];
  const credit = !posterMode && bodyCredit && (
    <p className="credit"><a href={bodyCredit.url} target="_blank" rel="noopener">{bodyCredit.text}</a></p>
  );
  const stage = (
    <section className="stage" aria-label={copy.stageLabel} style={posterMode ? { height: "100vh", position: "static", border: 0 } : undefined}>
      <div className="stage__canvas">
        {show3d ? (
          <Stage preset={preset} frame={frame} shadowKey={shadowKey} onContextLost={() => setLost(true)} snapshotRef={snapRef} focus={focus}
            theme="dark" autoRotate={showPicker && !posterMode}>
            <Truck vehicle={vehicle} paintHex={paint.hex} bodyLiftM={f.bodyLiftM} rakeDeg={rake} onBounds={onBounds} />
            <WheelSet fit={f} style={style} finish={r.finishCode} tread={r.tread} bolt={vehicle.bolt} />
            {!posterMode && <Pins fit={f} headline={words.headline} line2={words.line2} line3={words.line3} visible={PIN_PRESETS.includes(preset)} />}
            {!posterMode && <CameraProbe target={camRef} onReady={setCamReady} />}
            {ExportHook && <Suspense fallback={null}><ExportHook build={encode(b)} credit={bodyCredit?.text ?? ""} /></Suspense>}
          </Stage>
        ) : (
          <Poster vehicle={vehicle} />
        )}
        {!posterMode && <span className="stage__badge" title={copy.stageBadgeTitle}>{copy.stageBadge}</span>}
      </div>
      {show3d && !posterMode && (
        <div className="cams">
          <div className="cams__chips" role="group" aria-label={copy.cameraLabel}>
            {CAMERA_CHIPS.map((c) => (
              <button key={c.key} type="button" className="cam" aria-pressed={cam === c.key} onClick={() => setCam(c.key)}>{c.label}</button>
            ))}
          </div>
          <span className="cams__hint" aria-hidden="true">{copy.stageHint}</span>
        </div>
      )}
      {credit}
    </section>
  );

  if (posterMode) return <main id="app"><h1 className="sr-only">{APP_NAME}</h1>{stage}</main>;

  return (
    <>
      <header className="topbar">
        <a className="topbar__home" href="/" aria-label={copy.homeLabel}><img className="topbar__logo" src="/assets/logo-wordmark.png" alt="DROOOLY Wheel & Tire" width={240} height={30} /></a>
        <nav className="tabs" aria-label={copy.tabsLabel}>
          {copy.tabs.map((name, i) => (
            <button key={name} type="button" className="tab" aria-current={!showPicker && tab === i ? "true" : undefined}
              disabled={showPicker} onClick={() => goTab(i)}>
              <b aria-hidden="true">{i + 1}</b>{name}
            </button>
          ))}
        </nav>
        <div className="topbar__save">
          <span className="topbar__saved" aria-live="polite">
            {saved ? <>{saved.text}{saved.href && <> · <a href={saved.href}>{copy.myGarage}</a></>}</> : acct && <a href="/garage.html">{copy.myGarage}</a>}
          </span>
          <button type="button" className="btn btn--sm btn--ghost" ref={saveBtn} onClick={save}><span className="btn-txt">{copy.saveBuild}</span></button>
        </div>
      </header>
      <main id="app" className={"viz" + (showPicker ? " viz--sheet" : "")}>
        <h1 className="sr-only">{copy.pageTitle}</h1>
        {stage}
        {!showPicker && (
          <div className="panel">
            <Panel cat={catalog} b={b} vehicle={vehicle} fit={f} stanceSentence={words.stance} set={set}
              editTruck={() => { setDraft(null); setSheet(true); }} snapshot={show3d ? () => snapRef.current?.() ?? null : null}
              camera={show3d && camReady ? () => camRef.current?.() ?? null : null} onStill={setStillKey} />
          </div>
        )}
        {signIn && <SignInSheet onDone={(u) => { setAcct(u); setSignIn(false); void doSave(); }} onClose={() => setSignIn(false)} returnFocus={() => saveBtn.current} />}
        {showPicker && (
          <TruckSheet cat={catalog} start={{ v: b.v, mn: b.mn, y: b.y, p: b.p }} onDraft={setDraft}
            onClose={picked ? () => { setDraft(null); setSheet(false); } : null}
            onDone={(d) => { set(d); setDraft(null); setSheet(false); setCam("front"); setTab(0); window.scrollTo({ top: 0 }); }} />
        )}
      </main>
    </>
  );
}

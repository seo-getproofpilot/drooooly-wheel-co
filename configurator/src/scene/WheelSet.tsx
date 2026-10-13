/* One wheel and tire per corner of fit(). Geometry is built once per size
   and style and shared by every corner (each corner gets a clone that points
   at the same buffers), and disposed when the size, style or tread changes.

   The parametric wheel's outboard face is +X, so corners on the -X side are
   mirrored with scale-x -1. Placement comes only from fit().corners; this
   component never computes a fitment number of its own.

   Lug count and bolt circle come from the vehicle's bolt pattern ("8x170",
   "10x225") when the caller passes it; without it a dually gets 10x225 and
   anything else 8x170, which covers every truck in the slice.

   Every decal (tire size, cap mark, lip engraving) swaps to its mirrored
   twin on mirrored corners so it never reads backwards. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Material, Mesh, Vector3 } from "three";
import type { FitResult } from "../fitment/fitment3d";
import { disposeWheel, makeWheel, overlayMirrored, IN, type WheelStyle } from "../geometry/wheel";
import { disposeTire, makeTire, sidewallMirrored } from "../geometry/tire";
import { disposeBrake, makeBrake, rotorDiaFor } from "../geometry/brake";
import { disposeFinishSet, finishSet, type FinishCode } from "../materials/finishes";

/** sidewall lettering: full opacity once the nearest tire spans this share of the stage's short side, none below DECAL_GONE */
export const DECAL_FULL = 0.4;
export const DECAL_GONE = 0.33;

/* How much of the stage's short side a tire of radius r at distance d spans. */
export function tireSpan(r: number, d: number, fovDeg: number, w: number, h: number): number {
  const px = (r * h) / (Math.max(d, 1e-6) * Math.tan((fovDeg * Math.PI) / 360));
  return px / Math.min(w, h);
}

export interface WheelSetProps { fit: FitResult; style: WheelStyle; finish: FinishCode; tread: "AT" | "MT"; spin?: boolean; /** the vehicle's bolt pattern, e.g. "8x170" */ bolt?: string; }

/** lug count and bolt circle (mm) from a pattern like "8x170"; fallback by axle config */
export function lugPattern(bolt: string | undefined, dually: boolean): { lugs: number; boltCircleMm: number } {
  const m = /^(\d+)\s*x\s*([\d.]+)/i.exec(bolt ?? "");
  if (m) return { lugs: Number(m[1]), boltCircleMm: Number(m[2]) };
  return dually ? { lugs: 10, boltCircleMm: 225 } : { lugs: 8, boltCircleMm: 170 };
}

const DECALS = new Set(["sidewall", "logo", "engrave"]);

export function WheelSet({ fit, style, finish, tread, spin = false, bolt }: WheelSetProps) {
  const diaIn = fit.wheelRadiusM * 2 / IN, widthIn = fit.wheelWidthM / IN;
  const od = fit.tireRadiusM * 2 / IN, section = fit.tireWidthM / IN;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const lp = lugPattern(bolt, fit.corners.some((c) => c.name.endsWith("_inner")));
  const wKey = `${r2(diaIn)}|${r2(widthIn)}|${JSON.stringify(style)}|${lp.lugs}x${lp.boltCircleMm}`;
  const tKey = `${r2(od)}|${r2(section)}|${r2(diaIn)}|${tread}|${r2(widthIn)}`;

  const wheel = useMemo(() => makeWheel(r2(diaIn), r2(widthIn), style, lp), [wKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const tire = useMemo(() => makeTire(r2(od), r2(section), r2(diaIn), tread, r2(widthIn)), [tKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => disposeWheel(wheel), [wheel]);
  useEffect(() => () => disposeTire(tire), [tire]);

  /* Rotor and caliper behind each face, seated at the back of the hub.
     Front calipers trail the axle, rear ones lead it. Inner dually wheels
     share the outer wheel's hub, so they get none. */
  const brakes = useMemo(() => {
    const d = rotorDiaFor(r2(diaIn));
    return { front: makeBrake(d, -1), rear: makeBrake(d, 1) };
  }, [r2(diaIn)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { disposeBrake(brakes.front); disposeBrake(brakes.rear); }, [brakes]);

  /* face: spoke tops and the window walls (black milled cuts the walls back
     to bare metal); lip: the lathed lip, the cap and the lug nuts; barrel:
     the inside of the rim. See materials/finishes.ts. */
  const mats = useMemo(() => finishSet(finish), [finish]);
  useEffect(() => () => disposeFinishSet(mats), [mats]);

  /* One clone per corner, sharing geometry; clone() keeps the source
     materials, which are replaced here by the finish. */
  const cornerKey = fit.corners.map((c) => c.name + (c.mirror ? "m" : "")).join(",");
  const assemblies = useMemo(() => fit.corners.map((c) => {
    const g = new Group();
    const w = wheel.clone(true);
    w.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (DECALS.has(m.name)) { const f = c.mirror ? overlayMirrored(m.material as Material) : undefined; if (f) m.material = f; return; }
      m.material = m.name === "barrel" ? mats.barrel : m.name === "face" ? [mats.face, mats.edge] : mats.lip;
    });
    const t = tire.clone();
    const decal = t.getObjectByName("sidewall") as Mesh | undefined;
    const flipped = decal && c.mirror ? sidewallMirrored(decal.material as Material) : undefined;
    if (decal && flipped) decal.material = flipped;
    g.add(w, t);
    if (!c.name.endsWith("_inner")) {
      const b = (c.name.startsWith("F") ? brakes.front : brakes.rear).clone(true);
      b.position.x = ((wheel.userData.hubBackIn as number) - 0.05) * IN;
      g.add(b);
    }
    return g;
  }), [cornerKey, wheel, tire, mats, brakes]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sidewall lettering fades with how big the nearest tire is on screen, as
     a share of the stage's short side, and the lip engraving with it: about 0.46 at the Wheel close-up on a
     phone or a desktop, 0.15 to 0.25 at the whole-truck presets, where the
     text would only read as noise. */
  const decalMats = useMemo(() => {
    const out: Material[] = [];
    const d = tire.getObjectByName("sidewall") as Mesh | undefined;
    if (d) { const m = d.material as Material; out.push(m); const f = sidewallMirrored(m); if (f) out.push(f); }
    // the lip engraving fades with the size string; the cap mark stays
    const e = wheel.getObjectByName("engrave") as Mesh | undefined;
    if (e) { const m = e.material as Material; out.push(m); const f = overlayMirrored(m); if (f) out.push(f); }
    return out;
  }, [tire, wheel]);
  const tmp = useMemo(() => new Vector3(), []);

  const refs = useRef<(Group | null)[]>([]);
  useFrame(({ camera, size }, dt) => {
    if (decalMats.length) {
      let near = Infinity;
      for (const r of refs.current) if (r) near = Math.min(near, camera.position.distanceTo(r.getWorldPosition(tmp)));
      const fov = (camera as { fov?: number }).fov ?? 32;
      const k = tireSpan(fit.tireRadiusM, near, fov, size.width, size.height);
      const a = Math.min(1, Math.max(0, (k - DECAL_GONE) / (DECAL_FULL - DECAL_GONE)));
      for (const m of decalMats) { m.opacity = a * ((m.userData.baseOpacity as number | undefined) ?? 1); m.visible = a > 0.01; }
    }
    if (!spin) return;
    for (const r of refs.current) if (r) r.rotation.x -= dt * 0.6;
  });

  return (
    <group name="wheelset">
      {fit.corners.map((c, i) => (
        <group key={c.name} name="corner" userData={{ corner: c.name }} position={[c.x, c.y, c.z]} scale-x={c.mirror ? -1 : 1}
          ref={(el) => { refs.current[i] = el; }}>
          <primitive object={assemblies[i]} />
        </group>
      ))}
    </group>
  );
}

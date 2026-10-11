/* One wheel and tire per corner of fit(). Geometry is built once per size
   and style and shared by every corner (each corner gets a clone that points
   at the same buffers), and disposed when the size, style or tread changes.

   The parametric wheel's outboard face is +X, so corners on the -X side are
   mirrored with scale-x -1. Placement comes only from fit().corners; this
   component never computes a fitment number of its own. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Group, Material, Mesh, MeshPhysicalMaterial, Object3D, Vector3 } from "three";
import type { FitResult } from "../fitment/fitment3d";
import { makeWheel, IN, type WheelStyle } from "../geometry/wheel";
import { disposeTire, makeTire, sidewallMirrored } from "../geometry/tire";
import { disposeBrake, makeBrake, rotorDiaFor } from "../geometry/brake";
import { finishMaterial, type FinishCode } from "../materials/finishes";

/** sidewall lettering: full opacity once the nearest tire spans this share of the stage's short side, none below DECAL_GONE */
export const DECAL_FULL = 0.4;
export const DECAL_GONE = 0.33;

/* How much of the stage's short side a tire of radius r at distance d spans. */
export function tireSpan(r: number, d: number, fovDeg: number, w: number, h: number): number {
  const px = (r * h) / (Math.max(d, 1e-6) * Math.tan((fovDeg * Math.PI) / 360));
  return px / Math.min(w, h);
}

export interface WheelSetProps { fit: FitResult; style: WheelStyle; finish: FinishCode; tread: "AT" | "MT"; spin?: boolean; }

function disposeTree(o: Object3D) {
  o.traverse((c) => { const g = (c as Mesh).geometry as BufferGeometry | undefined; g?.dispose(); });
}

/* The barrel is the inside of the rim: same finish, a shade darker, so the
   face and lip read in front of it. */
function barrelMaterial(face: MeshPhysicalMaterial): MeshPhysicalMaterial {
  const m = face.clone();
  m.color.multiplyScalar(0.55);
  m.roughness = Math.min(1, face.roughness + 0.15);
  m.name = face.name + "-barrel";
  return m;
}

export function WheelSet({ fit, style, finish, tread, spin = false }: WheelSetProps) {
  const diaIn = fit.wheelRadiusM * 2 / IN, widthIn = fit.wheelWidthM / IN;
  const od = fit.tireRadiusM * 2 / IN, section = fit.tireWidthM / IN;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const wKey = `${r2(diaIn)}|${r2(widthIn)}|${JSON.stringify(style)}`;
  const tKey = `${r2(od)}|${r2(section)}|${r2(diaIn)}|${tread}|${r2(widthIn)}`;

  const wheel = useMemo(() => makeWheel(r2(diaIn), r2(widthIn), style), [wKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const tire = useMemo(() => makeTire(r2(od), r2(section), r2(diaIn), tread, r2(widthIn)), [tKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => disposeTree(wheel), [wheel]);
  useEffect(() => () => disposeTire(tire), [tire]);

  /* Rotor and caliper behind each face, seated at the back of the hub.
     Front calipers trail the axle, rear ones lead it. Inner dually wheels
     share the outer wheel's hub, so they get none. */
  const brakes = useMemo(() => {
    const d = rotorDiaFor(r2(diaIn));
    return { front: makeBrake(d, -1), rear: makeBrake(d, 1) };
  }, [r2(diaIn)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { disposeBrake(brakes.front); disposeBrake(brakes.rear); }, [brakes]);

  /* Black milled is a black face with the lip and spoke edges cut back to
     bare metal, which is what the JTX product photos show. The lip carries
     that here; the face stays black. */
  const mats = useMemo(() => {
    const face = finishMaterial(finish);
    const lip = finish === "black-milled" ? finishMaterial("brushed") : face;
    return { face, barrel: barrelMaterial(face), lip };
  }, [finish]);
  useEffect(() => () => { mats.face.dispose(); mats.barrel.dispose(); if (mats.lip !== mats.face) mats.lip.dispose(); }, [mats]);

  /* One clone per corner, sharing geometry; clone() keeps the source
     materials, which are replaced here by the finish. */
  const cornerKey = fit.corners.map((c) => c.name + (c.mirror ? "m" : "")).join(",");
  const assemblies = useMemo(() => fit.corners.map((c) => {
    const g = new Group();
    const w = wheel.clone(true);
    w.traverse((o) => { const m = o as Mesh; if (m.isMesh) m.material = m.name === "barrel" ? mats.barrel : m.name === "lip" ? mats.lip : mats.face; });
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
     a share of the stage's short side: about 0.46 at the Wheel close-up on a
     phone or a desktop, 0.15 to 0.25 at the whole-truck presets, where the
     text would only read as noise. */
  const decalMats = useMemo(() => {
    const d = tire.getObjectByName("sidewall") as Mesh | undefined;
    if (!d) return [] as Material[];
    const m = d.material as Material, flipped = sidewallMirrored(m);
    return flipped ? [m, flipped] : [m];
  }, [tire]);
  const tmp = useMemo(() => new Vector3(), []);

  const refs = useRef<(Group | null)[]>([]);
  useFrame(({ camera, size }, dt) => {
    if (decalMats.length) {
      let near = Infinity;
      for (const r of refs.current) if (r) near = Math.min(near, camera.position.distanceTo(r.getWorldPosition(tmp)));
      const fov = (camera as { fov?: number }).fov ?? 32;
      const k = tireSpan(fit.tireRadiusM, near, fov, size.width, size.height);
      const a = Math.min(1, Math.max(0, (k - DECAL_GONE) / (DECAL_FULL - DECAL_GONE)));
      for (const m of decalMats) { m.opacity = a; m.visible = a > 0.01; }
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

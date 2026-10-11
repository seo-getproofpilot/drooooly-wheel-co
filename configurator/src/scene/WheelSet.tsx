/* One wheel and tire per corner of fit(). Geometry is built once per size
   and style and shared by every corner (each corner gets a clone that points
   at the same buffers), and disposed when the size, style or tread changes.

   The parametric wheel's outboard face is +X, so corners on the -X side are
   mirrored with scale-x -1. Placement comes only from fit().corners; this
   component never computes a fitment number of its own. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Group, Material, Mesh, MeshPhysicalMaterial, Object3D } from "three";
import type { FitResult } from "../fitment/fitment3d";
import { makeWheel, IN, type WheelStyle } from "../geometry/wheel";
import { makeTire } from "../geometry/tire";
import { finishMaterial, type FinishCode } from "../materials/finishes";

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
  useEffect(() => () => { tire.geometry.dispose(); (tire.material as Material).dispose(); }, [tire]);

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
  const assemblies = useMemo(() => fit.corners.map(() => {
    const g = new Group();
    const w = wheel.clone(true);
    w.traverse((c) => { const m = c as Mesh; if (m.isMesh) m.material = m.name === "barrel" ? mats.barrel : m.name === "lip" ? mats.lip : mats.face; });
    g.add(w, tire.clone());
    return g;
  }), [fit.corners.length, wheel, tire, mats]); // eslint-disable-line react-hooks/exhaustive-deps

  const refs = useRef<(Group | null)[]>([]);
  useFrame((_, dt) => {
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

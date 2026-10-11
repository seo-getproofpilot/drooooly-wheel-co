/* The truck body from its glTF. Wheels are not part of it: WheelSet places
   them from fit().corners, so the hub empties are never moved here.

   Stance has two parts. bodyLiftM (from fit) raises the body, glass, chassis
   and bed as one piece. rakeDeg tips that piece about the rear axle: stock
   Super Duty and F-150 trucks sit about 1.2 degrees nose-down from the
   factory, and a leveling kit raises the front only, which takes that rake
   out. A full lift kit raises both ends, so it keeps the factory rake. */
import { useEffect, useLayoutEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Color, Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, MathUtils, Object3D } from "three";
import type { Vehicle } from "../data/types";
import { IN } from "../fitment/fitment3d";
import { paintMaterial } from "./paint";

export const FACTORY_RAKE_DEG = 1.2;

/* liftIn is part of the signature so a kit-specific rake can land per lift
   height without touching callers. Today every lift keeps the factory rake. */
export function rakeFor(leveled: boolean, liftIn: number): number {
  void liftIn;
  return leveled ? 0 : FACTORY_RAKE_DEG;
}

export const modelUrl = (v: Vehicle) => import.meta.env.BASE_URL + (v.model?.file ?? "");

export interface TruckProps { vehicle: Vehicle; paintHex: string; bodyLiftM: number; rakeDeg?: number; onBounds?: (box: Box3) => void; }

export function Truck({ vehicle, paintHex, bodyLiftM, rakeDeg = FACTORY_RAKE_DEG, onBounds }: TruckProps) {
  // Draco on, meshopt off: the meshopt decoder instantiates WebAssembly the
  // moment it is wired up, and the static host's CSP refuses that
  // (LAUNCH-CHECKLIST 7.5). The stand-ins use neither.
  const gltf = useGLTF(modelUrl(vehicle), true, false);
  const { root, paint, owned } = useMemo(() => {
    const root = gltf.scene.clone(true);
    const paint = paintMaterial(paintHex);
    const glass = new MeshPhysicalMaterial({ transmission: 0.9, roughness: 0.05, thickness: 0.01, color: 0x9fb3c8, metalness: 0, ior: 1.5 });
    glass.name = "glass";
    const trim = new MeshStandardMaterial({ color: 0x202226, roughness: 0.8 });
    trim.name = "trim";
    // The hub empties stay where the glTF put them: they are reference
    // points, never moved with the body, and WheelSet does not read them.
    const hubs: Object3D[] = [];
    root.traverse((o: Object3D) => { if (o.name.startsWith("hub_")) hubs.push(o); });
    hubs.forEach((h) => h.removeFromParent());
    root.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.material = m.name === "body" ? paint : m.name === "glass" ? glass : trim;
    });
    return { root, paint, owned: [paint, glass, trim] as Material[] };
  }, [gltf]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => owned.forEach((m) => m.dispose()), [owned]);
  useEffect(() => { paint.color = new Color(paintHex); }, [paint, paintHex]);

  // Rear axle: the pivot for rake. Height is the stock axle, which is where
  // the glTF's hub empties sit.
  const wb = (vehicle.model?.wheelbaseIn ?? 0) * IN;
  const axleY = ((vehicle.model?.stockTireOdIn ?? 0) / 2) * IN;

  useLayoutEffect(() => {
    if (!onBounds) return;
    // The untouched source scene is in the truck's own frame; the clone in the
    // graph sits under the rake group, whose world matrix is not settled yet.
    gltf.scene.updateMatrixWorld(true);
    const b = new Box3().setFromObject(gltf.scene);
    b.min.y = 0; // the tires reach the ground even where the body does not
    b.max.y += Math.max(0, bodyLiftM);
    onBounds(b);
  }, [gltf, bodyLiftM, onBounds]);

  return (
    <group name="truck" position-y={bodyLiftM}>
      <group position={[0, axleY, -wb]} rotation-x={MathUtils.degToRad(rakeDeg)}>
        <primitive object={root} position={[0, -axleY, wb]} />
      </group>
    </group>
  );
}

/* Reads the camera the visitor is looking through, for the studio shot. It
   mounts inside the Canvas as a child of Stage (like Pins) and fills a ref
   App owns with a getter, so the pose is read at click time, never per frame.
   The target comes from the drei CameraControls that Rig sets as default. */
import { useEffect, type MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { roundCamera, type StudioCamera } from "../data/render";

interface Controls { getTarget(out: Vector3): Vector3 }

export function CameraProbe({ target, onReady }: { target: MutableRefObject<(() => StudioCamera | null) | null>; onReady?: (ready: boolean) => void }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const size = useThree((s) => s.size);
  useEffect(() => {
    if (!controls || typeof controls.getTarget !== "function") { target.current = null; onReady?.(false); return; }
    target.current = () => {
      const t = controls.getTarget(new Vector3());
      const p = camera.position;
      return roundCamera({
        position: [p.x, p.y, p.z], target: [t.x, t.y, t.z],
        fov: camera.fov, aspect: camera.aspect || size.width / Math.max(1, size.height),
      });
    };
    onReady?.(true);
    return () => { target.current = null; onReady?.(false); };
  }, [camera, controls, size.width, size.height, target, onReady]);
  return null;
}

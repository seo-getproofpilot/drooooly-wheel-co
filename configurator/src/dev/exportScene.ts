/* Dev export hook for the offline render comparison (tools/3d/render-offline.py).

   Mounted inside the Canvas only in vite dev or with ?export=1 (App reads the
   flag before it rewrites the URL) and App loads this module lazily, so the
   production bundle carries a chunk it never fetches. It sets window.__droooly.exportScene(), which returns the
   build on stage as a binary glTF (the objects named "truck" and "wheelset",
   so no location skybox, asphalt, sun or contact shadow) and the camera the
   visitor is looking through, read from CameraControls. GLTFExporter is
   imported on the first call, not before.

   The render service (render-service/src/export.js) passes a camera:
   exportScene({ camera: { position, target } }) moves CameraControls there
   with no transition and waits two frames, so distance-driven fades (the
   sidewall lettering) settle for that pose before the export. The result also
   carries `credit`, the CC BY line of the body on stage, which the license
   requires on every image of it.

   window.__droooly.setBuild(query) swaps the build in place (dev/exportBridge.ts)
   and resolves once the stage has committed it, so the service's warm page
   exports build after build without reloading. */
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Texture, TextureSource, Vector3, type Material, type Mesh, type Object3D, type PerspectiveCamera } from "three";
import { applyBuild, committedBuild, markCommitted } from "./exportBridge";

export interface ExportedCamera {
  position: [number, number, number];
  target: [number, number, number];
  /** vertical field of view, degrees (three.js convention) */
  fov: number;
  aspect: number;
  width: number;
  height: number;
}

export interface ExportResult {
  glb: ArrayBuffer;
  camera: ExportedCamera;
  /** CC BY credit line of the body on stage; "" when the body needs none */
  credit: string;
}

export interface ExportOptions { camera?: { position: [number, number, number]; target: [number, number, number] } }

declare global {
  interface Window {
    __droooly?: {
      exportScene(opts?: ExportOptions): Promise<ExportResult>;
      /** applies a share query string, resolves with the encoded build once the stage shows it */
      setBuild(query: string): Promise<string>;
    };
  }
}

interface Controls {
  getTarget(out: { x: number; y: number; z: number }): { x: number; y: number; z: number };
  setLookAt(px: number, py: number, pz: number, tx: number, ty: number, tz: number, transition?: boolean): Promise<void>;
  update(dt: number): boolean;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/* Resolves once the stage has committed `build`; rejects after `timeoutMs`
   (a body that never loads). Polled per frame, so it also waits out the
   Suspense fallback while a new body downloads. */
function whenCommitted(build: string, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (committedBuild() === build) return resolve();
      if (performance.now() > deadline) return reject(new Error(`setBuild: the stage did not show ${build} within ${timeoutMs} ms`));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export interface ExportHookProps {
  /** the build on stage, encoded (App passes encode(b)) */
  build: string;
  /** CC BY credit line of the body on stage; "" when it needs none */
  credit: string;
}

const ROOTS = ["truck", "wheelset"];

/* Meshes whose every material is switched off (the sidewall lettering and lip
   engraving fade to invisible at the whole-truck presets) are hidden for the
   export, so the glTF holds what the frame shows. Returns the undo. */
function hideInvisibleMaterials(roots: Object3D[]): () => void {
  const hidden: Object3D[] = [];
  for (const r of roots) r.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !o.visible) return;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]) as Material[];
    if (mats.length && mats.every((x) => !x.visible || x.opacity <= 0.01)) { o.visible = false; hidden.push(o); }
  });
  return () => hidden.forEach((o) => { o.visible = true; });
}

/* GLTFExporter (r186) redraws every map through a 2D canvas (flipping a
   normal map's green channel, merging metalness and roughness) and cannot
   draw a DataTexture, which is what the paint flake, the wheel turning maps
   and the tire maps are. Under the render service's software GL, drawing a
   body's ImageBitmap into that canvas is a slow readback as well (tens of
   seconds for the F-150's maps, every export). So every DataTexture and
   every ImageBitmap-backed map on a material is swapped for a copy backed by
   a plain canvas holding the same pixels, made once per texture for the life
   of the page and kept (a few MB per body). Returns the undo, which only
   puts the originals back on the materials. */
const canvasCopies = new Map<Texture, Texture>();

function canvasCopy(t: Texture & { isDataTexture?: boolean }): Texture {
  const hit = canvasCopies.get(t);
  if (hit) return hit;
  const c = document.createElement("canvas");
  if (t.isDataTexture) {
    const { data, width, height } = t.image as { data: ArrayLike<number> | null; width: number; height: number };
    // a DataTexture without a CPU copy of its pixels exports flat
    const ok = !!data && data.length === width * height * 4;
    if (!ok) console.warn(`exportScene: ${t.name || "texture"} has no pixel data (${data?.length ?? 0} for ${width}x${height}); exported flat`);
    c.width = ok ? width : 1; c.height = ok ? height : 1;
    const px = ok ? Uint8ClampedArray.from(data!) : new Uint8ClampedArray([128, 128, 255, 255]);
    c.getContext("2d")!.putImageData(new ImageData(px, c.width, c.height), 0, 0);
  } else {
    const img = t.image as ImageBitmap;
    c.width = img.width; c.height = img.height;
    c.getContext("2d", { willReadFrequently: true })!.drawImage(img, 0, 0);
  }
  // a plain Texture, so frames drawn while the export runs upload the canvas
  const out = new Texture().copy(t);
  out.source = new TextureSource(c);
  canvasCopies.set(t, out);
  return out;
}

function canvasBackedTextures(roots: Object3D[]): () => void {
  const seen = new Set<object>();
  const undo: (() => void)[] = [];
  for (const r of roots) r.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as unknown as Record<string, Texture | null>[]) {
      // a material shared by many meshes is swapped once and restored once
      if (seen.has(mat)) continue;
      seen.add(mat);
      for (const k of Object.keys(mat)) {
        const t = mat[k] as (Texture & { isDataTexture?: boolean }) | null | undefined;
        if (!t || typeof t !== "object" || !(t as Texture).isTexture) continue;
        const swap = t.isDataTexture || (typeof ImageBitmap !== "undefined" && t.image instanceof ImageBitmap);
        if (!swap) continue;
        mat[k] = canvasCopy(t);
        undo.push(() => { mat[k] = t; });
      }
    }
  });
  return () => { undo.reverse().forEach((f) => f()); };
}

export default function ExportHook({ build, credit }: ExportHookProps) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const size = useThree((s) => s.size);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const advance = useThree((s) => s.advance);
  const creditRef = useRef(credit);
  creditRef.current = credit;

  /* This effect commits in the same pass as the Truck and WheelSet for
     `build` (same Suspense boundary), so the mark means the stage shows it. */
  useEffect(() => { markCommitted(build); }, [build]);

  useEffect(() => {
    window.__droooly = {
      async setBuild(query: string) {
        const next = applyBuild(query);
        await whenCommitted(next, 60_000);
        await nextFrame();
        await nextFrame();
        return next;
      },
      async exportScene(opts?: ExportOptions) {
        if (opts?.camera) {
          if (!controls) throw new Error("exportScene: no camera controls on stage");
          const { position: p, target: t } = opts.camera;
          await controls.setLookAt(p[0], p[1], p[2], t[0], t[1], t[2], false);
          controls.update(0);
          await nextFrame();
          await nextFrame();
        }
        const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
        const roots = ROOTS.map((n) => scene.getObjectByName(n)).filter((o): o is Object3D => !!o);
        if (roots.length !== ROOTS.length) throw new Error("exportScene: truck or wheelset not on stage yet");
        scene.updateMatrixWorld(true);
        const restoreVisible = hideInvisibleMaterials(roots);
        const restoreMaps = canvasBackedTextures(roots);
        /* The exporter yields to the event loop many times (canvas encodes),
           and under a software renderer every yield let a whole frame draw
           (seconds each, with the post stack). The loop pauses for the export;
           one frame is drawn by hand after it so the stage is current. */
        setFrameloop("never");
        let glb: ArrayBuffer;
        try {
          glb = (await new GLTFExporter().parseAsync(roots, { binary: true, onlyVisible: true, maxTextureSize: 4096 })) as ArrayBuffer;
        } finally {
          restoreMaps(); restoreVisible();
          setFrameloop("always");
          advance(performance.now());
        }
        // camera-controls fills only a Vector3 it is given; the return value is always right
        const t = controls ? controls.getTarget(new Vector3()) : new Vector3();
        return {
          glb,
          camera: {
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [t.x, t.y, t.z],
            fov: camera.fov,
            aspect: camera.aspect,
            width: size.width,
            height: size.height,
          },
          credit: creditRef.current,
        };
      },
    };
    return () => { delete window.__droooly; };
  }, [scene, camera, controls, size.width, size.height, setFrameloop, advance]);
  return null;
}

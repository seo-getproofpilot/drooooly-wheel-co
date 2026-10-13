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
   requires on every image of it. */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Texture, TextureSource, Vector3, type DataTexture, type Material, type Mesh, type Object3D, type PerspectiveCamera } from "three";
import { loadCatalog } from "../data/catalog";
import { initialBuild, platforms } from "../flow";
import { copy } from "../ui/copy";

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
  interface Window { __droooly?: { exportScene(opts?: ExportOptions): Promise<ExportResult> } }
}

interface Controls {
  getTarget(out: { x: number; y: number; z: number }): { x: number; y: number; z: number };
  setLookAt(px: number, py: number, pz: number, tx: number, ty: number, tz: number, transition?: boolean): Promise<void>;
  update(dt: number): boolean;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/* The credit the stage shows (App renders it under the canvas). ?poster=1
   hides that line, so the fallback reads the same copy entry for the vehicle
   the URL asks for, the way App picks it (F-250 when the link names none). */
function bodyCredit(): string {
  const shown = document.querySelector(".stage .credit")?.textContent?.trim();
  if (shown) return shown;
  const cat = loadCatalog();
  const v = initialBuild(cat, location.search, null).build.v;
  const vehicle = platforms(cat).find((x) => x.id === v) ?? platforms(cat).find((x) => x.id === "f250");
  return copy.bodyCredits[vehicle?.model?.file ?? ""]?.text ?? "";
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

/* GLTFExporter (r186) redraws some maps through a 2D canvas (flipping a
   normal map's green channel, merging metalness and roughness) and cannot
   draw a DataTexture, which is what the paint flake, the wheel turning maps
   and the tire maps are. For the export every DataTexture on a material is
   swapped for a copy backed by a canvas holding the same pixels. Returns the
   undo. */
function canvasDataTextures(roots: Object3D[]): () => void {
  const copies = new Map<Texture, Texture>();
  const seen = new Set<object>();
  const undo: (() => void)[] = [];
  const toCanvas = (t: DataTexture): Texture => {
    const { data, width, height } = t.image as { data: ArrayLike<number> | null; width: number; height: number };
    const c = document.createElement("canvas");
    // a DataTexture without a CPU copy of its pixels exports flat
    const ok = !!data && data.length === width * height * 4;
    if (!ok) console.warn(`exportScene: ${t.name || "texture"} has no pixel data (${data?.length ?? 0} for ${width}x${height}); exported flat`);
    c.width = ok ? width : 1; c.height = ok ? height : 1;
    const px = ok ? Uint8ClampedArray.from(data!) : new Uint8ClampedArray([128, 128, 255, 255]);
    c.getContext("2d")!.putImageData(new ImageData(px, c.width, c.height), 0, 0);
    // a plain Texture, so frames drawn while the export runs upload the canvas
    const out = new Texture().copy(t);
    out.source = new TextureSource(c);
    return out;
  };
  for (const r of roots) r.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as unknown as Record<string, Texture | null>[]) {
      // a material shared by many meshes is swapped once and restored once
      if (seen.has(mat)) continue;
      seen.add(mat);
      for (const k of Object.keys(mat)) {
        const t = mat[k] as (Texture & { isDataTexture?: boolean }) | null | undefined;
        if (!t || typeof t !== "object" || !t.isDataTexture) continue;
        if (!copies.has(t)) copies.set(t, toCanvas(t as DataTexture));
        mat[k] = copies.get(t)!;
        undo.push(() => { mat[k] = t; });
      }
    }
  });
  return () => { undo.reverse().forEach((f) => f()); copies.forEach((c) => c.dispose()); };
}

export default function ExportHook() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const size = useThree((s) => s.size);

  useEffect(() => {
    window.__droooly = {
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
        const restoreMaps = canvasDataTextures(roots);
        let glb: ArrayBuffer;
        try {
          glb = (await new GLTFExporter().parseAsync(roots, { binary: true, onlyVisible: true, maxTextureSize: 4096 })) as ArrayBuffer;
        } finally { restoreMaps(); restoreVisible(); }
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
          credit: bodyCredit(),
        };
      },
    };
    return () => { delete window.__droooly; };
  }, [scene, camera, controls, size.width, size.height]);
  return null;
}

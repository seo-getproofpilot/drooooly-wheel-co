/* The 3D stage: canvas, studio light, contact shadow and the orbit camera.
   Presets move the camera with a smoothed transition; the whole-truck presets
   pull back as needed so the truck stays in frame on a tall phone.

   Two themes. Light is the original white studio. Dark is an outdoor
   location (Outdoor.tsx): a ground-projected late-afternoon HDRI, a sun light
   that casts the truck's shadow, and a photographic finish (grade, ACES,
   vignette, depth of field on the wheel close-up). The theme keeps its name
   "dark" because the UI around the stage is dark; the stage itself is a
   place, not a backdrop.

   autoRotate turns the camera about the truck once every TURNTABLE_SECONDS.
   It stops the moment a pointer goes down on the canvas, and starts again
   RESUME_MS after the last pointer up, wheel zoom or preset change. It never
   runs on the wheel close-up or for a visitor who asked for reduced motion. */
import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, ContactShadows, Environment } from "@react-three/drei";
import { ACESFilmicToneMapping, Box3, SRGBColorSpace } from "three";
import { OUTDOOR_EXPOSURE, OutdoorLocation, PostFX } from "./Outdoor";
import { FOV, MAX_POLAR, MIN_POLAR, PRESETS, framedView, wheelView, type CameraPreset } from "./cameras";
import { softwareRenderer } from "./gpu";
export { softwareRenderer };

/* The site's --bg (styles.css). The configurator does not load styles.css,
   so the value is mirrored here. */
export const STAGE_BG = "#ffffff";
export const STAGE_BG_DARK = "#0b0b0c";
export type StageTheme = "light" | "dark";
export const TURNTABLE_SECONDS = 8;
export const RESUME_MS = 3000;
export const HDRI_URL = import.meta.env.BASE_URL + "hdri/studio.hdr";
/* Outdoor contact shadow. A small blur keeps the dark patch under each tire
   the size of the patch (drei's blur spreads about 0.6 m a unit at scale 16),
   and a far of 1.2 m lets a lifted body's floor and axles still darken the
   ground under it. */
export const CONTACT = { opacity: 1, blur: 1.1, far: 1.2 };

/* True when this browser can make a WebGL context at all. Checked before the
   Canvas mounts, because R3F throws when it cannot get one. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export interface WheelFocus { center: [number, number, number]; radius: number }

function prefersReducedMotion(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

function Rig({ preset, frame, focus, autoRotate }: { preset: CameraPreset; frame: Box3 | null; focus: WheelFocus | null; autoRotate: boolean }) {
  const ref = useRef<CameraControls>(null);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const el = useThree((s) => s.gl.domElement);
  const first = useRef(true);
  const held = useRef(false);
  const idleSince = useRef(performance.now());
  const reduced = useMemo(prefersReducedMotion, []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { position: pos, target: t } = preset === "wheel" && focus
      ? wheelView(aspect, focus.center, focus.radius) : framedView(preset, aspect, frame);
    c.setLookAt(pos[0], pos[1], pos[2], t[0], t[1], t[2], !first.current);
    first.current = false;
    idleSince.current = performance.now();
  }, [preset, aspect, frame, focus?.center[0], focus?.center[1], focus?.center[2], focus?.radius]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Pointer down anywhere on the canvas holds the turntable; release (even
     off the canvas) starts the resume timer. A wheel zoom restarts it too. */
  useEffect(() => {
    const down = () => { held.current = true; };
    const up = () => { if (held.current) { held.current = false; idleSince.current = performance.now(); } };
    const zoom = () => { idleSince.current = performance.now(); };
    el.addEventListener("pointerdown", down);
    el.addEventListener("wheel", zoom, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("wheel", zoom);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [el]);

  useFrame((_, dt) => {
    const c = ref.current;
    if (!c || !autoRotate || reduced || held.current || preset === "wheel") return;
    if (performance.now() - idleSince.current < RESUME_MS) return;
    c.rotate((Math.min(dt, 0.1) * Math.PI * 2) / TURNTABLE_SECONDS, 0, false);
  });
  return (
    <CameraControls ref={ref} makeDefault smoothTime={0.6} minPolarAngle={MIN_POLAR} maxPolarAngle={MAX_POLAR}
      minDistance={1.2} maxDistance={30} />
  );
}

export interface StageProps {
  children: ReactNode;
  preset: CameraPreset;
  /** what hero, side and rear keep in frame; null frames the preset as given */
  frame?: Box3 | null;
  /** changes whenever the build changes; the contact shadow re-renders then and only then */
  shadowKey?: string;
  onContextLost?: () => void;
  className?: string;
  /** filled with a function that renders one frame and returns it as a PNG data URL */
  snapshotRef?: MutableRefObject<(() => string | null) | null>;
  /** where the wheel close-up looks; without it the preset is used as authored */
  focus?: WheelFocus | null;
  /** "light" (default) is the white studio, "dark" the near-black studio with a reflective floor */
  theme?: StageTheme;
  /** idle turntable about the truck, paused while the visitor drags */
  autoRotate?: boolean;
}

export function Stage({ children, preset, frame = null, shadowKey = "", onContextLost, className, snapshotRef, focus = null, theme = "light", autoRotate = false }: StageProps) {
  const [ready, setReady] = useState(false);
  const [post, setPost] = useState(true);
  const dark = theme === "dark";
  const postOn = dark && post;
  return (
    <div className={className} data-ready={ready ? "1" : "0"} data-theme={theme} data-post={postOn ? "1" : "0"}
      style={{ position: "relative", width: "100%", height: "100%", background: dark ? STAGE_BG_DARK : undefined }}>
      <Canvas
        dpr={[1, 2]}
        shadows={dark ? "percentage" : false}
        gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false }}
        camera={{ fov: FOV, near: 0.1, far: 400, position: PRESETS[preset].position }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.outputColorSpace = SRGBColorSpace;
          gl.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); onContextLost?.(); });
        }}
      >
        {!dark && <color attach="background" args={[STAGE_BG]} />}
        <Exposure value={dark && !postOn ? OUTDOOR_EXPOSURE : 1} />
        <Suspense fallback={null}>
          {dark ? <OutdoorLocation reflect={postOn && ready} /> : <Environment files={HDRI_URL} background={false} environmentIntensity={1} />}
          {children}
          {/* drei draws its blur quad at the world origin through the shadow
              camera, so the shadow must sit at x = z = 0 and just under the
              ground: anywhere else the quad falls behind or beside that camera
              and the shadow comes out empty. Scale 16 covers a long-bed truck
              from the front bumper (+1.3) to the rear (-5.6). It renders a few
              frames per build, not every frame (iOS battery and heat). Outside
              it is the skylight the truck blocks: tight and dark where each
              tire meets the asphalt, fading under the body. The sun casts
              the real shadow. */}
          <ContactShadows key={shadowKey + theme} position={[0, -0.001, 0]} opacity={dark ? CONTACT.opacity : 0.6} scale={16} blur={dark ? CONTACT.blur : 2.2} far={dark ? CONTACT.far : 2} resolution={1024} frames={4} />
          <Ready onReady={() => setReady(true)} />
        </Suspense>
        {postOn && ready && <PostFX wheel={preset === "wheel"} focus={focus?.center ?? null} onSlow={() => setPost(false)} />}
        <Rig preset={preset} frame={frame} focus={focus} autoRotate={autoRotate} />
        {snapshotRef && <Snapshot target={snapshotRef} />}
      </Canvas>
      {dark && !postOn && <div aria-hidden="true" data-vignette style={VIGNETTE} />}
    </div>
  );
}

/* Renderer exposure. With the composer running it stays 1 and the grade
   effect carries the exposure, so it is applied once either way. */
function Exposure({ value }: { value: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => { gl.toneMappingExposure = value; }, [gl, value]);
  return null;
}

/* Darkens the corners when the composer (and its vignette) is off. On top
   of the canvas, so it costs no render pass, and it ignores the pointer. */
const VIGNETTE = {
  position: "absolute", inset: 0, pointerEvents: "none",
  background: "radial-gradient(130% 100% at 50% 46%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.22) 84%, rgba(0,0,0,0.45) 100%)",
} as const;

/* Mounts only once everything inside Suspense has loaded; the e2e and the
   poster script wait on data-ready. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}

/* The canvas keeps no drawing buffer (cheaper on phones), so a snapshot
   renders one frame and reads it back in the same task, before the browser
   clears it. */
function Snapshot({ target }: { target: MutableRefObject<(() => string | null) | null> }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    target.current = () => {
      try { gl.render(scene, camera); return gl.domElement.toDataURL("image/png"); } catch { return null; }
    };
    return () => { target.current = null; };
  }, [gl, scene, camera, target]);
  return null;
}

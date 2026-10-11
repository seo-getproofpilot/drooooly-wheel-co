/* The 3D stage: canvas, studio light, contact shadow and the orbit camera.
   Presets move the camera with a smoothed transition; hero, side and rear
   pull back as needed so the whole truck stays in frame on a tall phone. */
import { Suspense, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls, ContactShadows, Environment } from "@react-three/drei";
import { ACESFilmicToneMapping, Box3, SRGBColorSpace } from "three";
import { FOV, MAX_POLAR, MIN_POLAR, PRESETS, framedView, wheelView, type CameraPreset } from "./cameras";

/* The site's --bg (styles.css). The configurator does not load styles.css,
   so the value is mirrored here. */
export const STAGE_BG = "#ffffff";
export const HDRI_URL = import.meta.env.BASE_URL + "hdri/studio.hdr";

/* True when this browser can make a WebGL context at all. Checked before the
   Canvas mounts, because R3F throws when it cannot get one. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export interface WheelFocus { center: [number, number, number]; radius: number }

function Rig({ preset, frame, focus }: { preset: CameraPreset; frame: Box3 | null; focus: WheelFocus | null }) {
  const ref = useRef<CameraControls>(null);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const first = useRef(true);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { position: pos, target: t } = preset === "wheel" && focus
      ? wheelView(aspect, focus.center, focus.radius) : framedView(preset, aspect, frame);
    c.setLookAt(pos[0], pos[1], pos[2], t[0], t[1], t[2], !first.current);
    first.current = false;
  }, [preset, aspect, frame, focus?.center[0], focus?.center[1], focus?.center[2], focus?.radius]); // eslint-disable-line react-hooks/exhaustive-deps
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
}

export function Stage({ children, preset, frame = null, shadowKey = "", onContextLost, className, snapshotRef, focus = null }: StageProps) {
  const [ready, setReady] = useState(false);
  return (
    <div className={className} data-ready={ready ? "1" : "0"} style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false }}
        camera={{ fov: FOV, near: 0.1, far: 200, position: PRESETS[preset].position }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.outputColorSpace = SRGBColorSpace;
          gl.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); onContextLost?.(); });
        }}
      >
        <color attach="background" args={[STAGE_BG]} />
        <Suspense fallback={null}>
          <Environment files={HDRI_URL} background={false} environmentIntensity={1} />
          {children}
          {/* drei draws its blur quad at the world origin through the shadow
              camera, so the shadow must sit at x = z = 0 and just under the
              ground: anywhere else the quad falls behind or beside that camera
              and the shadow comes out empty. Scale 16 covers a long-bed truck
              from the front bumper (+1.3) to the rear (-5.6). It renders a few
              frames per build, not every frame (iOS battery and heat). */}
          <ContactShadows key={shadowKey} position={[0, -0.001, 0]} opacity={0.6} scale={16} blur={2.2} far={2} resolution={1024} frames={4} />
          <Ready onReady={() => setReady(true)} />
        </Suspense>
        <Rig preset={preset} frame={frame} focus={focus} />
        {snapshotRef && <Snapshot target={snapshotRef} />}
      </Canvas>
    </div>
  );
}

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

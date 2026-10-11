/* The dark theme's location: a modded truck photographed outside, late in the
   afternoon, on a wide asphalt apron.

   The HDRI (public/hdri/outdoor.hdr, see LICENSES.md) does three jobs. It
   lights the paint and the wheels as the environment map, it is the sky
   behind the truck, and, projected onto the ground with three's
   GroundedSkybox, it is the asphalt the truck stands on. A directional light
   sits exactly where the sun is in the image and casts the truck's real
   shadow onto a shadow catcher on that ground. Image, lighting and shadow
   are all turned by the same OUTDOOR_ROTATION, so they always agree.

   PostFX is the photographic finish: exposure and a slight warm grade, ACES,
   a soft vignette, and depth of field on the wheel close-up only. A guard
   turns it off when the first second after it starts averages under 30 fps;
   the renderer then tone maps on its own and Stage draws a CSS vignette. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useEnvironment } from "@react-three/drei";
import { DepthOfField, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { Effect, ToneMappingMode } from "postprocessing";
import { Color, DirectionalLight, Object3D, Uniform, Vector3 } from "three";
import { GroundedSkybox } from "three/examples/jsm/objects/GroundedSkybox.js";

export const OUTDOOR_HDRI_URL = import.meta.env.BASE_URL + "hdri/outdoor.hdr";

/* The sun in outdoor.hdr, as a unit vector in three's equirect frame (found
   from the brightest 0.05 percent of pixels): about 18 degrees up. */
export const HDRI_SUN: [number, number, number] = [0.7678, 0.3125, 0.5594];
/* Sun colour from the same pixels, normalised: warm late-afternoon light. */
export const SUN_COLOR = new Color(1, 0.806, 0.658);

/* Turns the whole location about Y so the sun stands on the driver's side and
   slightly behind the front axle: the Front and Three-quarter presets see
   the paint and the wheel faces in sun, and the shadow falls away across the
   passenger side. */
export const OUTDOOR_ROTATION = (53.5 * Math.PI) / 180;

/** exposure for ACES; tuned so white paint keeps its shape and black paint keeps its reflections */
export const OUTDOOR_EXPOSURE = 0.9;
/** the HDRI's camera height and the projection's radius, metres */
export const GROUND = { height: 2.0, radius: 90 };
/** the truck's middle, where the projection is centred (least distortion) */
const CENTRE = new Vector3(0, 0, -1.9);

/* The sun direction after OUTDOOR_ROTATION, in world space. */
export function sunDirection(): Vector3 {
  return new Vector3(...HDRI_SUN).applyAxisAngle(new Vector3(0, 1, 0), OUTDOOR_ROTATION).normalize();
}

export function OutdoorLocation() {
  const texture = useEnvironment({ files: OUTDOOR_HDRI_URL });
  const scene = useThree((s) => s.scene);

  /* The HDRI as environment light, turned with the location. No
     scene.background: the grounded skybox is the background. */
  useEffect(() => {
    const prev = { env: scene.environment, rot: scene.environmentRotation.clone(), bg: scene.background };
    scene.environment = texture;
    scene.environmentRotation.set(0, OUTDOOR_ROTATION, 0);
    scene.environmentIntensity = 1;
    scene.background = null;
    return () => { scene.environment = prev.env; scene.environmentRotation.copy(prev.rot); scene.background = prev.bg; };
  }, [scene, texture]);

  const sky = useMemo(() => {
    const m = new GroundedSkybox(texture, GROUND.height, GROUND.radius, 96);
    // The projection's floor sits `height` under the mesh centre; a hair
    // under y = 0 so the shadow catcher wins the depth test.
    m.position.set(CENTRE.x, GROUND.height - 0.01, CENTRE.z);
    m.rotation.y = OUTDOOR_ROTATION;
    m.name = "location";
    return m;
  }, [texture]);
  useEffect(() => () => { sky.geometry.dispose(); (sky.material as { dispose(): void }).dispose(); }, [sky]);

  const sun = useMemo(() => {
    const l = new DirectionalLight(SUN_COLOR, 2.4);
    l.position.copy(sunDirection().multiplyScalar(20)).add(CENTRE);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    // Tight around the truck and the shadow it throws at an 18 degree sun.
    const c = l.shadow.camera;
    c.left = -7; c.right = 7; c.top = 7; c.bottom = -7; c.near = 5; c.far = 40;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 5;
    l.name = "sun";
    return l;
  }, []);
  const sunTarget = useMemo(() => { const o = new Object3D(); o.position.copy(CENTRE); return o; }, []);
  useEffect(() => { sun.target = sunTarget; }, [sun, sunTarget]);
  useEffect(() => () => sun.shadow.map?.dispose(), [sun]);

  return (
    <>
      <primitive object={sky} />
      <primitive object={sunTarget} />
      <primitive object={sun} />
      {/* Shadow catcher: invisible except where the sun is blocked. */}
      <mesh rotation-x={-Math.PI / 2} position={[CENTRE.x, 0.001, CENTRE.z]} receiveShadow name="shadow-catcher">
        <planeGeometry args={[30, 30]} />
        <shadowMaterial transparent opacity={0.55} color="#1b1410" />
      </mesh>
    </>
  );
}

/* Exposure and a slight warm grade, ahead of tone mapping (linear light). */
const GRADE_FRAG = /* glsl */ `
uniform float exposure;
uniform float warmth;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * exposure;
  c *= vec3(1.0 + 0.05 * warmth, 1.0 + 0.012 * warmth, 1.0 - 0.06 * warmth);
  outputColor = vec4(c, inputColor.a);
}`;

export class GradeEffect extends Effect {
  constructor(exposure = OUTDOOR_EXPOSURE, warmth = 1) {
    super("GradeEffect", GRADE_FRAG, { uniforms: new Map<string, Uniform>([["exposure", new Uniform(exposure)], ["warmth", new Uniform(warmth)]]) });
  }
}

export const MIN_POST_FPS = 30;

/* Read once at load: the app rewrites the URL as soon as it mounts. */
const KEEP_POST = (() => {
  try { const q = new URLSearchParams(location.search); return q.get("poster") === "1" || q.get("post") === "1"; } catch { return false; }
})();

export interface PostFXProps {
  /** depth of field on: the wheel close-up */
  wheel: boolean;
  /** where the close-up focuses */
  focus: [number, number, number] | null;
  /** called once when the first second averages under MIN_POST_FPS */
  onSlow: () => void;
}

export function PostFX({ wheel, focus, onSlow }: PostFXProps) {
  const grade = useMemo(() => new GradeEffect(), []);
  useEffect(() => () => grade.dispose(), [grade]);
  const target = useMemo(() => new Vector3(), []);
  if (focus) target.set(...focus);

  /* The guard: skip the first half second (shader compile, texture upload),
     then count frames for one second. Posters are one still frame and never
     trip it, and ?post=1 keeps it on for review shots (headless Chromium
     caps requestAnimationFrame near 15 fps even on a blank page). */
  const t0 = useRef<number | null>(null);
  const n = useRef(0);
  const done = useRef(KEEP_POST);
  useFrame(() => {
    if (done.current || document.visibilityState === "hidden") return;
    const now = performance.now();
    if (t0.current === null) { t0.current = now + 500; return; }
    if (now < t0.current) return;
    n.current++;
    const el = now - t0.current;
    if (el >= 1000) {
      done.current = true;
      if ((n.current * 1000) / el < MIN_POST_FPS) onSlow();
    }
  });

  return (
    <EffectComposer multisampling={4}>
      <primitive object={grade} />
      {wheel && focus ? <DepthOfField target={target} worldFocusRange={0.9} bokehScale={2.2} resolutionScale={0.5} /> : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.55} eskil={false} />
    </EffectComposer>
  );
}

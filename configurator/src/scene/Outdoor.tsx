/* The dark theme's location: a modded truck photographed outside, late in the
   afternoon, on a wide asphalt apron.

   The HDRI (public/hdri/outdoor.hdr, see LICENSES.md) does three jobs. It
   lights the paint and the wheels as the environment map, it is the sky
   behind the truck, and, projected onto the ground with three's
   GroundedSkybox, it is the far ground and the horizon. The HDRI is 1K, so
   its projected ground is soft; under the truck a real PBR asphalt surface
   (AsphaltGround, Poly Haven asphalt_02, public/textures/) takes over and
   fades into the projection between ASPHALT.fadeFrom and ASPHALT.fadeTo
   metres from the truck. A directional light sits exactly where the sun is
   in the image and casts the truck's real shadow onto that asphalt. Image,
   lighting and shadow are all turned by the same OUTDOOR_ROTATION, so they
   always agree.

   PostFX is the photographic finish: ambient occlusion (N8AO, so wheel
   wells, bumpers and panel gaps darken), exposure and a slight warm grade,
   ACES, a soft vignette, and depth of field on the wheel close-up only. A guard
   turns it off when the first second after it starts averages under 30 fps;
   the renderer then tone maps on its own and Stage draws a CSS vignette. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useEnvironment, useTexture } from "@react-three/drei";
import { DepthOfField, EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { Effect, ToneMappingMode } from "postprocessing";
import { CircleGeometry, Color, DirectionalLight, Mesh, MeshStandardMaterial, Object3D, RepeatWrapping, SRGBColorSpace, Uniform, Vector2, Vector3, type Texture } from "three";
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

/* The near ground. asphalt_02 is a 3 m x 3 m scan (api.polyhaven.com/info
   reports 3000 mm), so the texture repeats every `tile` metres in the world.
   Fully opaque out to fadeFrom, gone by fadeTo; past that the HDRI's own
   apron and grass carry on to the horizon. tint brings the scan's albedo to
   the brightness and hue of the HDRI apron under the same sun, sky and
   grade, so the fade shows no ring. It is a linear multiplier and may pass
   1: measured off screenshots of the same patch of ground with the asphalt
   shown and hidden, matched to within 2 of 255 per channel. */
export const ASPHALT = {
  urls: ["diff", "nor_gl", "rough"].map((m) => import.meta.env.BASE_URL + `textures/asphalt_02_${m}.webp`),
  tile: 3,
  radius: 28,
  fadeFrom: 10,
  fadeTo: 25,
  tint: [1.44, 1.2, 0.93] as [number, number, number],
  normalScale: 1,
  /* The HDRI's sun is also in the environment light, where no shadow can
     block it; turned down on the asphalt so the real sun light carries the
     ground and the truck's shadow reads at daylight contrast. */
  envIntensity: 0.15,
};

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
    // under the asphalt, which draws over it out to the fade.
    m.position.set(CENTRE.x, GROUND.height - 0.01, CENTRE.z);
    m.rotation.y = OUTDOOR_ROTATION;
    m.name = "location";
    return m;
  }, [texture]);
  useEffect(() => () => { sky.geometry.dispose(); (sky.material as { dispose(): void }).dispose(); }, [sky]);

  const sun = useMemo(() => {
    const l = new DirectionalLight(SUN_COLOR, SUN_INTENSITY);
    l.position.copy(sunDirection().multiplyScalar(20)).add(CENTRE);
    l.castShadow = true;
    const size = shadowMapSize();
    l.shadow.mapSize.set(size, size);
    // Tight around the truck and the shadow it throws at an 18 degree sun.
    const c = l.shadow.camera;
    c.left = -7; c.right = 7; c.top = 7; c.bottom = -7; c.near = 5; c.far = 40;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.02;
    // The sun is half a degree wide: its shadow is crisp where the tire meets
    // the ground and only a centimetre or two soft at the far end, so a small
    // filter radius on a dense map reads as daylight. 4096 texels over 14 m
    // is 3.4 mm a texel on desktop; phones get 2048.
    l.shadow.radius = 2.5;
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
      <AsphaltGround />
    </>
  );
}

/** up from 2.4: a crisper sun highlight on the paint and a darker shadow on the asphalt */
export const SUN_INTENSITY = 3.5;

/* 4096 on a desktop GPU, 2048 on a phone or any GPU that cannot hold it. */
export function shadowMapSize(maxTexture = 16384): number {
  let coarse = false;
  try { coarse = window.matchMedia("(pointer: coarse)").matches; } catch { /* no matchMedia: desktop */ }
  return coarse || maxTexture < 8192 ? 2048 : 4096;
}

/* Radial fade and anti-tiling, patched into MeshStandardMaterial so it keeps
   the full PBR path (sun, shadow, environment light). The diffuse is read
   twice, the second time rotated and at a different scale, and the two mix
   by a low-frequency noise: the 3 m tile no longer repeats on a grid across
   a 20 m apron. */
const GROUND_VERT_HEAD = "#include <common>\nvarying vec2 vGroundXZ;";
const GROUND_VERT_BODY = "#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;";
const GROUND_FRAG_HEAD = /* glsl */ `#include <common>
varying vec2 vGroundXZ;
uniform vec2 fadeCentre;
uniform vec2 fadeRange;
float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`;
const GROUND_MAP = /* glsl */ `#ifdef USE_MAP
  vec4 gA = texture2D(map, vMapUv);
  vec4 gB = texture2D(map, mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.71 + vec2(0.37, 0.11));
  float gW = smoothstep(0.25, 0.75, gNoise(vGroundXZ * 0.23));
  diffuseColor *= mix(gA, gB, gW);
#endif`;
const GROUND_FADE = "#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(fadeRange.x, fadeRange.y, distance(vGroundXZ, fadeCentre));";

export function patchGroundShader(shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string }) {
  shader.uniforms.fadeCentre = { value: new Vector2(CENTRE.x, CENTRE.z) };
  shader.uniforms.fadeRange = { value: new Vector2(ASPHALT.fadeFrom, ASPHALT.fadeTo) };
  shader.vertexShader = shader.vertexShader.replace("#include <common>", GROUND_VERT_HEAD).replace("#include <begin_vertex>", GROUND_VERT_BODY);
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", GROUND_FRAG_HEAD).replace("#include <map_fragment>", GROUND_MAP).replace("#include <dithering_fragment>", GROUND_FADE);
}

/* The asphalt the truck stands on. GroundedSkybox writes no depth, so this
   is the floor the ambient occlusion pass sees. It sits 2 mm down: Stage's
   ContactShadows lies at -1 mm and must stay above it (and above its own
   camera's view of it) to draw on top. Invisible at any camera distance. */
export function AsphaltGround() {
  const [map, normalMap, roughnessMap] = useTexture(ASPHALT.urls) as Texture[];
  const aniso = useThree((s) => Math.min(16, s.gl.capabilities.getMaxAnisotropy()));
  const mesh = useMemo(() => {
    const repeat = (ASPHALT.radius * 2) / ASPHALT.tile;
    for (const t of [map, normalMap, roughnessMap]) {
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.anisotropy = aniso;
      t.needsUpdate = true;
    }
    map.colorSpace = SRGBColorSpace;
    const mat = new MeshStandardMaterial({
      map, normalMap, roughnessMap, roughness: 1, metalness: 0,
      color: new Color(...ASPHALT.tint), normalScale: new Vector2(ASPHALT.normalScale, ASPHALT.normalScale),
      envMapIntensity: ASPHALT.envIntensity, transparent: true, depthWrite: true,
    });
    mat.onBeforeCompile = patchGroundShader;
    mat.customProgramCacheKey = () => "asphalt-ground";
    const geo = new CircleGeometry(ASPHALT.radius, 128);
    geo.rotateX(-Math.PI / 2);
    const m = new Mesh(geo, mat);
    m.position.set(CENTRE.x, -0.002, CENTRE.z);
    m.receiveShadow = true;
    m.renderOrder = -1;
    m.name = "asphalt";
    return m;
  }, [map, normalMap, roughnessMap, aniso]);
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose(); }, [mesh]);
  return <primitive object={mesh} />;
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

export const AO = { radius: 0.6, falloff: 1, intensity: 3, quality: "medium" as const };

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
      {/* Ambient occlusion in metres, tuned for a 6 m truck: half a metre
          reaches into a wheel well and under a bumper without greying the
          body sides, and the falloff keeps it off the sky behind the roof. */}
      <N8AO aoRadius={AO.radius} distanceFalloff={AO.falloff} intensity={AO.intensity} quality={AO.quality} halfRes screenSpaceRadius={false} />
      <primitive object={grade} />
      {wheel && focus ? <DepthOfField target={target} worldFocusRange={0.9} bokehScale={2.2} resolutionScale={0.5} /> : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.55} eskil={false} />
    </EffectComposer>
  );
}

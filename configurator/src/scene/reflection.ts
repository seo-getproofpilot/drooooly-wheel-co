/* Planar reflection for the asphalt.

   Dry asphalt is a rough dielectric: it reflects about 4 percent at normal
   incidence and much more at grazing angles, blurred by its roughness and
   broken up by its grain. three already computes that for the sky: the
   environment map lands in the asphalt's indirect specular, weighted by the
   material's Fresnel and roughness (EnvironmentBRDF). What it cannot know is
   that the truck stands between the ground and that sky.

   So a second camera, mirrored under the ground plane, renders only the
   truck and wheels (sky, ground and glass hidden; clear alpha 0) into a
   small half-float target with mipmaps. The asphalt shader swaps that image
   in for the environment radiance wherever it has coverage, before three
   applies Fresnel and roughness, at the same envMapIntensity as the sky it
   replaces. (In three r186 a material lit by scene.environment gets
   scene.environmentIntensity, not its own envMapIntensity, so today that is
   1 for the asphalt as well; the multiply keeps the two in step either way.) The result is never a wet floor: the
   ground's own BRDF decides the strength, so the mirror image is faint at
   eye height and grows towards grazing angles, and it is blurred by a mip
   level picked from the asphalt's roughness and offset by its normal map.

   Cost: one extra draw of the truck and wheels per frame at half the canvas
   resolution, no shadow pass, no transmission (the glass is hidden). Stage
   only turns it on while the post chain is on, so the fps guard that drops
   post drops this with it, and it is never built on a software renderer. */
import {
  DataTexture, HalfFloatType, LinearFilter, LinearMipmapLinearFilter, Matrix4, Object3D, PerspectiveCamera, Plane,
  RGBAFormat, Vector2, Vector3, Vector4, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer,
} from "three";

export const REFLECT = {
  /** render target size as a share of the drawing buffer */
  scale: 0.5,
  /** longest side cap, pixels */
  maxSize: 1024,
  /** mip level per unit of roughness: the scan's 0.78 median lands near mip 2.7, a soft dry sheen */
  lodPerRoughness: 3.5,
  /** screen-space offset from the normal map, so the grain breaks the image up */
  distortion: 0.06,
  /** on top of the material's envMapIntensity, which the mirror shares with the sky it replaces */
  gain: 0.55,
  /** radiance cap, in sky units, on the mirror image: a sun glint off a chrome lip is tens of
      times the sky and the mip blur cannot spread it, so uncapped it came back as a bright
      blob on the asphalt beside the wheel */
  clamp: 1.2,
};

/** Marks an object the reflection pass must not draw (sky, ground, glass).
    Glass is also kept out of the wheel environment capture (WheelSet), where
    a transmission pass per cube face would cost six extra scene draws. */
export function noReflect(o: Object3D, glass = false) {
  o.userData.noReflect = true;
  if (glass) o.userData.glass = true;
}

/* Every live asphalt mirror, so another render pass (the wheel environment
   capture) can switch them off: their uv matrix belongs to the main camera. */
const live = new Set<ReflectUniforms>();
export function withReflectionsOff(fn: () => void) {
  const prev = [...live].map((u) => [u, u.reflectOn.value] as const);
  for (const [u] of prev) u.reflectOn.value = 0;
  try { fn(); } finally { for (const [u, v] of prev) u.reflectOn.value = v; }
}

const EMPTY = (() => {
  const t = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat);
  t.needsUpdate = true;
  t.name = "reflect-empty";
  return t;
})();

export interface ReflectUniforms {
  tReflect: { value: unknown };
  reflectMatrix: { value: Matrix4 };
  reflectOn: { value: number };
  reflectLod: { value: number };
  reflectDistort: { value: number };
  reflectGain: { value: number };
  reflectClamp: { value: number };
}

export function reflectUniforms(): ReflectUniforms {
  return {
    tReflect: { value: EMPTY },
    reflectMatrix: { value: new Matrix4() },
    reflectOn: { value: 0 },
    reflectLod: { value: REFLECT.lodPerRoughness },
    reflectDistort: { value: REFLECT.distortion },
    reflectGain: { value: REFLECT.gain },
    reflectClamp: { value: REFLECT.clamp },
  };
}

/* Shader chunks. The vertex side needs the world position; the fragment side
   replaces environment radiance with the mirror image where it has coverage.
   The target holds premultiplied colour (opaque meshes over a clear of 0,
   averaged down the mips), so the blend is radiance * (1 - a) + rgb. */
export const REFLECT_VERT_HEAD = /* glsl */ `#include <common>
uniform mat4 reflectMatrix;
varying vec4 vReflectUv;`;
export const REFLECT_VERT_BODY = /* glsl */ `#include <worldpos_vertex>
vReflectUv = reflectMatrix * modelMatrix * vec4( transformed, 1.0 );`;
export const REFLECT_FRAG_HEAD = /* glsl */ `#include <common>
uniform sampler2D tReflect;
uniform float reflectOn;
uniform float reflectLod;
uniform float reflectDistort;
uniform float reflectGain;
uniform float reflectClamp;
varying vec4 vReflectUv;`;
export const REFLECT_FRAG = /* glsl */ `#include <lights_fragment_maps>
#if defined( RE_IndirectSpecular )
if ( reflectOn > 0.0 ) {
  vec2 rUv = vReflectUv.xy / vReflectUv.w + ( normal.xy - nonPerturbedNormal.xy ) * reflectDistort;
  // four taps a mip-texel apart on a rotated square hide the mip chain's box steps
  float rLod = material.roughness * reflectLod;
  vec2 rStep = exp2( rLod ) / vec2( textureSize( tReflect, 0 ) ) * 0.7;
  vec4 mirrorImage = 0.25 * (
    textureLod( tReflect, rUv + rStep * vec2( 0.92, 0.38 ), rLod ) +
    textureLod( tReflect, rUv + rStep * vec2( -0.38, 0.92 ), rLod ) +
    textureLod( tReflect, rUv + rStep * vec2( -0.92, -0.38 ), rLod ) +
    textureLod( tReflect, rUv + rStep * vec2( 0.38, -0.92 ), rLod ) ) * reflectOn;
  #ifdef USE_ENVMAP
    mirrorImage.rgb *= envMapIntensity;
  #endif
  // premultiplied, so the cap scales with coverage
  mirrorImage.rgb = min( mirrorImage.rgb, vec3( reflectClamp * mirrorImage.a ) );
  radiance = radiance * ( 1.0 - mirrorImage.a ) + mirrorImage.rgb * reflectGain;
}
#endif`;

export function patchReflectShader(shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string }, u: ReflectUniforms) {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", REFLECT_VERT_HEAD)
    .replace("#include <worldpos_vertex>", REFLECT_VERT_BODY);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", REFLECT_FRAG_HEAD)
    .replace("#include <lights_fragment_maps>", REFLECT_FRAG);
}

/* The mirrored camera and its target. Math after three's Reflector and
   drei's MeshReflectorMaterial: reflect position, look-at and up about the
   plane, then replace the near plane with the ground (Lengyel's oblique
   clip) so nothing under the ground leaks into the image. */
export class PlanarReflection {
  readonly target: WebGLRenderTarget;
  readonly camera = new PerspectiveCamera();
  private readonly normal = new Vector3(0, 1, 0);
  private readonly point = new Vector3();
  private readonly v = new Vector3();
  private readonly look = new Vector3();
  private readonly rot = new Matrix4();
  private readonly plane = new Plane();
  private readonly clip = new Vector4();
  private readonly q = new Vector4();
  private readonly hidden: Object3D[] = [];
  private readonly size = new Vector2();

  constructor(private readonly u: ReflectUniforms, private readonly planeY = 0) {
    live.add(u);
    this.target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType, format: RGBAFormat, depthBuffer: true,
      minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter, generateMipmaps: true,
    });
    this.target.texture.name = "ground-reflection";
    this.point.set(0, planeY, 0);
  }

  /** Renders the mirror image for `camera`; call once per frame before the main render. */
  render(gl: WebGLRenderer, scene: Scene, camera: Camera) {
    const cam = camera as PerspectiveCamera;
    const size = gl.getDrawingBufferSize(this.size);
    const k = Math.min(REFLECT.scale, REFLECT.maxSize / Math.max(1, size.x, size.y));
    const w = Math.max(1, Math.round(size.x * k)), h = Math.max(1, Math.round(size.y * k));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);

    const camPos = this.v.setFromMatrixPosition(cam.matrixWorld);
    if (camPos.y <= this.planeY) { this.u.reflectOn.value = 0; return; }

    // mirrored position
    const vc = this.camera;
    vc.position.set(camPos.x, 2 * this.planeY - camPos.y, camPos.z);
    // mirrored look-at
    this.rot.extractRotation(cam.matrixWorld);
    this.look.set(0, 0, -1).applyMatrix4(this.rot).add(camPos);
    this.look.y = 2 * this.planeY - this.look.y;
    vc.up.set(0, 1, 0).applyMatrix4(this.rot);
    vc.up.y = -vc.up.y;
    vc.lookAt(this.look);
    vc.far = cam.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(cam.projectionMatrix);

    // world to reflection uv
    this.u.reflectMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);

    // oblique near plane on the ground
    this.plane.setFromNormalAndCoplanarPoint(this.normal, this.point).applyMatrix4(vc.matrixWorldInverse);
    this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
    const p = vc.projectionMatrix.elements;
    this.q.set((Math.sign(this.clip.x) + p[8]) / p[0], (Math.sign(this.clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
    this.clip.multiplyScalar(2 / this.clip.dot(this.q));
    p[2] = this.clip.x; p[6] = this.clip.y; p[10] = this.clip.z + 1; p[14] = this.clip.w;
    vc.projectionMatrixInverse.copy(vc.projectionMatrix).invert();

    // hide what must not reflect
    this.hidden.length = 0;
    scene.traverseVisible((o) => { if (o.userData.noReflect) this.hidden.push(o); });
    for (const o of this.hidden) o.visible = false;
    const bg = scene.background;
    scene.background = null;
    const prevTarget = gl.getRenderTarget();
    const prevAlpha = gl.getClearAlpha();
    const prevAuto = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.setClearAlpha(0);
    gl.setRenderTarget(this.target);
    gl.clear(true, true, false);
    gl.render(scene, vc);
    gl.setRenderTarget(prevTarget);
    gl.setClearAlpha(prevAlpha);
    gl.shadowMap.autoUpdate = prevAuto;
    scene.background = bg;
    for (const o of this.hidden) o.visible = true;

    this.u.tReflect.value = this.target.texture;
    this.u.reflectOn.value = 1;
  }

  off() { this.u.reflectOn.value = 0; this.u.tReflect.value = EMPTY; }

  dispose() { live.delete(this.u); this.target.dispose(); }
}

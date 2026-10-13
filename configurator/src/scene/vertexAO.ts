/* Baked ambient occlusion from a vertex attribute.

   The body glTFs carry AO baked into COLOR_0 (three's "color" attribute):
   R = G = B = AO, linear, 1 open, 0 occluded. This hook makes a standard or
   physical material read that attribute the way three reads an aoMap
   (aomap_fragment): it scales indirect diffuse, indirect specular (through
   three's specular-occlusion approximation, so a glossy panel in a crease
   loses its sky reflection more gently than its fill light), and the
   clearcoat and sheen indirect terms. Direct light (the sun) is untouched:
   the shadow map already handles it, and AO on direct light reads as dirt.

   It never tints the base colour. GLTFLoader turns material.vertexColors on
   when COLOR_0 exists, which would multiply the albedo by the AO; the
   <color_fragment> chunk is emptied so the attribute only means occlusion.

   It is a no-op on geometry without the attribute: the material declares
   color = (1, 1, 1) as its default attribute value, which three binds with
   vertexAttrib3fv whenever the geometry has no "color" buffer. So one
   patched material can be shared by meshes with and without a bake. */
import { Material, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from "three";

type Shader = Pick<WebGLProgramParametersWithUniforms, "uniforms" | "vertexShader" | "fragmentShader">;

export const VERTEX_AO_VERT_HEAD = /* glsl */ `#include <common>
#if !defined( USE_COLOR ) && !defined( USE_COLOR_ALPHA )
attribute vec3 color;
#endif
varying float vVertexAO;`;

export const VERTEX_AO_VERT_BODY = /* glsl */ `#include <begin_vertex>
vVertexAO = color.r;`;

export const VERTEX_AO_FRAG_HEAD = /* glsl */ `#include <common>
varying float vVertexAO;
uniform float vertexAOIntensity;`;

/* Mirrors aomap_fragment, with the attribute in place of the texture. */
export const VERTEX_AO_FRAG = /* glsl */ `#include <aomap_fragment>
{
  float vertexAO = clamp( ( vVertexAO - 1.0 ) * vertexAOIntensity + 1.0, 0.0, 1.0 );
  reflectedLight.indirectDiffuse *= vertexAO;
  #if defined( USE_CLEARCOAT )
    clearcoatSpecularIndirect *= vertexAO;
  #endif
  #if defined( USE_SHEEN )
    sheenSpecularIndirect *= vertexAO;
  #endif
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( saturate( dot( geometryNormal, geometryViewDir ) ), vertexAO, material.roughness );
  #endif
}`;

/** Patches compiled shader source in place; exported for the unit test. */
export function patchVertexAOShader(shader: Shader, intensity: { value: number }) {
  shader.uniforms.vertexAOIntensity = intensity;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", VERTEX_AO_VERT_HEAD)
    .replace("#include <begin_vertex>", VERTEX_AO_VERT_BODY);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", VERTEX_AO_FRAG_HEAD)
    .replace("#include <color_fragment>", "")
    .replace("#include <aomap_fragment>", VERTEX_AO_FRAG);
}

interface Patched { vertexAO?: { value: number } }

/**
 * Makes a MeshStandardMaterial or MeshPhysicalMaterial read the "color"
 * vertex attribute as baked ambient occlusion. Safe to call twice (the
 * second call only updates the intensity). Returns the material.
 */
export function applyVertexAO<M extends Material>(material: M, intensity = 1): M {
  const data = material.userData as Patched;
  if (data.vertexAO) { data.vertexAO.value = intensity; return material; }
  const uniform = { value: intensity };
  data.vertexAO = uniform;
  const m = material as Material & { defaultAttributeValues?: Record<string, number[]> };
  m.defaultAttributeValues = { ...(m.defaultAttributeValues ?? {}), color: [1, 1, 1] };
  const prevCompile = material.onBeforeCompile.bind(material);
  // three's default key is the onBeforeCompile source, which is about to be
  // this wrapper's for every patched material: take the old one now
  const defaultKey = material.customProgramCacheKey === Material.prototype.customProgramCacheKey;
  const prevSrc = material.onBeforeCompile.toString();
  const prevKey = defaultKey ? () => prevSrc : material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => {
    prevCompile(shader, renderer);
    patchVertexAOShader(shader, uniform);
  };
  material.customProgramCacheKey = () => prevKey() + "|vertex-ao";
  material.needsUpdate = true;
  return material;
}

export function hasVertexAO(material: Material): boolean {
  return !!(material.userData as Patched).vertexAO;
}

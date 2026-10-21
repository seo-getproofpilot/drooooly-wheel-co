/* Truck paint: a clearcoat physical material over a pigment base.

   Two kinds, because factory paint comes in two kinds and they photograph
   differently:

     solid     White, Black, Race Red, Army Green. A pigment base with no
               metal in it under a gloss coat: the colour is flat and even,
               and every reflection (sun, sky, trees) comes from the coat.
               Rendering these as metallic is what made white read as a
               blotchy silver: a metal tints its reflections by its albedo,
               so the sky and asphalt came back grey across the panels.
     metallic  everything else (Agate Black, Iconic Silver, Carbonized Grey,
               Blue Jeans, Atlas Blue, Bronze Fire). Aluminium flake in the
               base: brighter face-on, darker towards the edges (the flop),
               and a fine sparkle up close from a tiled flake normal map.

   Both carry a clearcoat at near-mirror roughness, which is what gives a
   studio car its crisp sun highlight and its fresnel rim; under it, the
   base is kept fairly smooth so the colour holds its shape.

   The flake map is procedural (256px of jittered normals) and shared by
   every paint, so swapping colour never allocates a texture. Mipmapping
   averages the flakes away with distance, so the sparkle only shows close. */
import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshPhysicalMaterial, RepeatWrapping, RGBAFormat, Vector2 } from "three";
import { loadCatalog } from "../data/catalog";

let flake: DataTexture | null = null;

/* Seeded so every load (and every poster render) gets the same flakes. */
function rand(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function flakeNormalMap(): DataTexture {
  if (flake) return flake;
  const N = 256, data = new Uint8Array(N * N * 4), r = rand(250);
  for (let i = 0; i < N * N; i++) {
    // mostly up, tilted up to ~0.35 in a random direction: unit-ish normals
    const a = r() * Math.PI * 2, t = r() * 0.35;
    const x = Math.cos(a) * t, y = Math.sin(a) * t, z = Math.sqrt(1 - t * t);
    data[i * 4] = Math.round((x * 0.5 + 0.5) * 255);
    data[i * 4 + 1] = Math.round((y * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = Math.round((z * 0.5 + 0.5) * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, N, N, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(40, 40);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  tex.name = "paint-flake";
  flake = tex;
  return tex;
}

export type PaintKind = "solid" | "metallic";

/** Factory solids in the catalog, by name. Anything else is a metallic. */
export const SOLID_PAINTS = new Set(["white", "black", "race red", "army green"]);

/* The base under the coat, per kind. normalScale 0 on a solid keeps the
   flake map bound (no shader recompile when the visitor switches paint) but
   draws no flakes. */
export const PAINT = {
  solid: { metalness: 0, roughness: 0.38, specularIntensity: 0.5, flake: 0 },
  metallic: { metalness: 0.7, roughness: 0.32, specularIntensity: 1, flake: 0.18 },
  clearcoat: 1,
  clearcoatRoughness: 0.03,
} as const;

let byHex: Map<string, string> | null = null;
/** "solid" or "metallic" for a catalog paint hex; unknown hexes are metallic. */
export function paintKind(hex: string): PaintKind {
  if (!byHex) {
    byHex = new Map();
    try { for (const p of loadCatalog().paints) byHex.set(p.hex.toLowerCase(), p.name.toLowerCase()); } catch { /* no catalog: all metallic */ }
  }
  const name = byHex.get(hex.toLowerCase());
  return name && SOLID_PAINTS.has(name) ? "solid" : "metallic";
}

/** Sets colour and kind on an existing paint material without recompiling it. */
export function setPaint(m: MeshPhysicalMaterial, hex: string): MeshPhysicalMaterial {
  const k = PAINT[paintKind(hex)];
  m.color.set(new Color(hex));
  m.metalness = k.metalness;
  m.roughness = k.roughness;
  m.specularIntensity = k.specularIntensity;
  m.normalScale.set(k.flake, k.flake);
  m.userData.paintKind = paintKind(hex);
  return m;
}

export function paintMaterial(hex: string): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    clearcoat: PAINT.clearcoat,
    clearcoatRoughness: PAINT.clearcoatRoughness,
    normalMap: flakeNormalMap(),
    normalScale: new Vector2(),
  });
  m.name = "paint";
  return setPaint(m, hex);
}

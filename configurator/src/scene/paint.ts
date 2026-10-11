/* Truck paint: a clearcoat physical material over a metallic base, with a
   tiled flake normal map so highlights break up the way metallic paint does.
   The flake map is procedural (256px of jittered normals) and shared by every
   paint, so swapping colour never allocates a texture. */
import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshPhysicalMaterial, RepeatWrapping, RGBAFormat, Vector2 } from "three";

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
  tex.needsUpdate = true;
  tex.name = "paint-flake";
  flake = tex;
  return tex;
}

export function paintMaterial(hex: string): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: new Color(hex),
    metalness: 0.6,
    roughness: 0.45,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    normalMap: flakeNormalMap(),
    normalScale: new Vector2(0.15, 0.15),
  });
  m.name = "paint";
  return m;
}

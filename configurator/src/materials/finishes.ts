/* Wheel finishes as physical materials. The catalog lists finishes by name
   ("Polished", "Brushed", "Black", "Black Milled"); finishCode maps a name to
   one of these four.

   A finish is a set of four materials because the parts are mapped
   differently and a real wheel is finished differently part to part:

     face    the spoke face caps. Planar UVs (u, v across the wheel face, see
             wheel.ts), so the machining maps here are drawn as a disc.
     edge    the window walls and chamfers of the face (ExtrudeGeometry's side
             group). Black milled cuts these back to bright metal; every other
             finish uses the face material.
     lip     the lathed parts: lip, centre cap, lug nuts. Lathe UVs (u around,
             v along the profile by arclength), so lathe lines are stripes in v.
     barrel  the inside of the rim, a shade darker than the lip so the face
             and lip read in front of it.

   Polished forged aluminium is a touch warmer and softer than chrome, with no
   clearcoat. A very fine turning pattern (concentric on the face, around the
   lip) in the normal map plus a little anisotropy along the cut stretch the
   sun into the radial streaks a lathe-turned wheel shows. Brushed is the same
   metal with strong anisotropy: brushed radially on the face, around on the
   lip. Black is a satin powder coat. Black milled is that coat with the
   window walls and chamfers milled back to bare polished metal, which is what
   the JTX product photos show.

   The procedural maps are DataTextures built once and shared by every finish,
   like the paint flake map, so swapping finish never allocates a texture. */
import { ClampToEdgeWrapping, Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshPhysicalMaterial, RepeatWrapping, RGBAFormat, Vector2 } from "three";

export type FinishCode = "polished" | "brushed" | "black" | "black-milled";

interface Def { color: number; metalness: number; roughness: number; clearcoat: number; clearcoatRoughness?: number; anisotropy?: number; machined?: boolean }

export const FINISH_DEFS: Record<"polished" | "brushed" | "black", Def> = {
  polished: { color: 0xebe7e0, metalness: 1, roughness: 0.15, clearcoat: 0, anisotropy: 0.3, machined: true },
  brushed: { color: 0xc9ccd0, metalness: 1, roughness: 0.3, clearcoat: 0, anisotropy: 0.85 },
  black: { color: 0x0e0f11, metalness: 0.2, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.28 },
};

/** the black-milled window walls: bare cut aluminium, softer than the polished face */
export const MILLED_EDGE_ROUGHNESS = 0.24;

/* Seeded so every load (and every poster render) gets the same pattern. */
function rand(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function dataTex(data: Uint8Array, w: number, h: number, name: string): DataTexture {
  const tex = new DataTexture(data, w, h, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  tex.name = name;
  return tex;
}

const enc = (v: number) => Math.round((v * 0.5 + 0.5) * 255);

/* Turning grooves as a height profile across them: a groove every ~3 texels
   with a random depth per groove, so the pattern never moires into rings. */
function grooveSlope(n: number, seed: number): Float32Array {
  const r = rand(seed), P = 3.1, groove: number[] = [];
  for (let i = 0; i < n / P + 2; i++) groove.push(0.35 + 0.65 * r());
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const g = Math.floor(k / P), f = (k / P) % 1;
    out[k] = groove[g] * Math.cos(f * Math.PI * 2) * (2 * Math.PI / P) * 0.5;
  }
  return out;
}

let faceTurn: DataTexture | null = null, lipTurn: DataTexture | null = null;
let faceAround: DataTexture | null = null, faceRadial: DataTexture | null = null;

/** Concentric turning on the face, planar disc mapping, 1024 square. */
export function faceTurningMap(): DataTexture {
  if (faceTurn) return faceTurn;
  const N = 1024, slope = grooveSlope(Math.ceil(N * 0.75), 71), data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - N / 2, dy = y + 0.5 - N / 2, r = Math.hypot(dx, dy) || 1;
    const s = slope[Math.min(slope.length - 1, Math.floor(r))] * 0.18;
    const nx = -s * dx / r, ny = -s * dy / r, l = Math.hypot(nx, ny, 1), i = (y * N + x) * 4;
    data[i] = enc(nx / l); data[i + 1] = enc(ny / l); data[i + 2] = enc(1 / l); data[i + 3] = 255;
  }
  faceTurn = dataTex(data, N, N, "face-turning");
  return faceTurn;
}

/** Turning around the lathed parts: stripes across v. 4 x 1024; wheel.ts sets lathe v to arclength / 20 in. */
export function lipTurningMap(): DataTexture {
  if (lipTurn) return lipTurn;
  const W = 4, H = 1024, slope = grooveSlope(H, 113), data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const s = slope[y] * 0.18, l = Math.hypot(s, 1);
    for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; data[i] = 128; data[i + 1] = enc(-s / l); data[i + 2] = enc(1 / l); data[i + 3] = 255; }
  }
  lipTurn = dataTex(data, W, H, "lip-turning");
  return lipTurn;
}

/* Anisotropy direction maps for the face, planar disc mapping: RG is the
   brush direction in tangent space (u, v), B the strength. */
function directionMap(radial: boolean): DataTexture {
  const N = 256, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - N / 2, dy = y + 0.5 - N / 2, r = Math.hypot(dx, dy) || 1;
    const ux = radial ? dx / r : -dy / r, uy = radial ? dy / r : dx / r, i = (y * N + x) * 4;
    data[i] = enc(ux); data[i + 1] = enc(uy); data[i + 2] = 255; data[i + 3] = 255;
  }
  const t = dataTex(data, N, N, radial ? "face-radial" : "face-around");
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  return t;
}
const aroundMap = () => (faceAround ??= directionMap(false));
const radialMap = () => (faceRadial ??= directionMap(true));

function base(d: Def, name: string): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({ color: new Color(d.color), metalness: d.metalness, roughness: d.roughness, clearcoat: d.clearcoat });
  if (d.clearcoatRoughness !== undefined) m.clearcoatRoughness = d.clearcoatRoughness;
  m.name = name;
  return m;
}

/* One material in its face (planar) or lip (lathe) mapping. */
function mapped(key: keyof typeof FINISH_DEFS, mapping: "face" | "lip", name: string): MeshPhysicalMaterial {
  const d = FINISH_DEFS[key], m = base(d, name);
  if (d.machined) {
    m.normalMap = mapping === "face" ? faceTurningMap() : lipTurningMap();
    m.normalScale = new Vector2(0.4, 0.4);
  }
  if (d.anisotropy) {
    m.anisotropy = d.anisotropy;
    // lip: lathe u runs around, so rotation 0 is the turning direction
    if (mapping === "face") m.anisotropyMap = key === "brushed" ? radialMap() : aroundMap();
  }
  return m;
}

export interface FinishSet { face: MeshPhysicalMaterial; edge: MeshPhysicalMaterial; lip: MeshPhysicalMaterial; barrel: MeshPhysicalMaterial }

export function finishSet(code: FinishCode): FinishSet {
  const key = code === "black-milled" ? "black" : code;
  const face = mapped(key, "face", code);
  const edge = code === "black-milled" ? mapped("polished", "face", code + "-edge") : face;
  // the milled walls are thin, so a polished-mirror sun glint on them clips
  // into single white pixels; a freshly milled cut is a touch less mirror-like
  if (edge !== face) edge.roughness = MILLED_EDGE_ROUGHNESS;
  const lip = mapped(key, "lip", code + "-lip");
  const barrel = lip.clone();
  barrel.color.multiplyScalar(0.55);
  barrel.roughness = Math.min(1, lip.roughness + 0.15);
  barrel.name = code + "-barrel";
  return { face, edge, lip, barrel };
}

export function disposeFinishSet(s: FinishSet) {
  // the shared DataTextures stay: they are module singletons
  for (const m of new Set([s.face, s.edge, s.lip, s.barrel])) m.dispose();
}

/** The face material of a finish. */
export function finishMaterial(code: FinishCode): MeshPhysicalMaterial {
  const s = finishSet(code);
  if (s.edge !== s.face) s.edge.dispose();
  s.lip.dispose(); s.barrel.dispose();
  return s.face;
}

export function finishCode(name: string): FinishCode {
  const n = name.toLowerCase();
  if (n.includes("mill")) return "black-milled";
  if (n.includes("black")) return "black";
  if (n.includes("brush")) return "brushed";
  return "polished";
}

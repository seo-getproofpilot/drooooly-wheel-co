/* Wheel finishes as physical materials. The catalog lists finishes by name
   ("Polished", "Brushed", "Black", "Black Milled"); finishCode maps a name to
   one of these four. Environment and lighting arrive with the scene (Task 6),
   so these values are tuned for an HDRI-lit studio, not for a bare light. */
import { MeshPhysicalMaterial, Color } from "three";

export type FinishCode = "polished" | "brushed" | "black" | "black-milled";

const DEF: Record<FinishCode, { color: number; metalness: number; roughness: number; clearcoat: number; anisotropy?: number }> = {
  polished: { color: 0xe6e9ec, metalness: 1, roughness: 0.08, clearcoat: 0.6 },
  brushed: { color: 0xc9ced3, metalness: 1, roughness: 0.38, clearcoat: 0, anisotropy: 0.8 },
  black: { color: 0x121316, metalness: 0.7, roughness: 0.55, clearcoat: 0.3 },
  "black-milled": { color: 0x1b1d20, metalness: 0.85, roughness: 0.35, clearcoat: 0.4 },
};

export function finishMaterial(code: FinishCode): MeshPhysicalMaterial {
  const d = DEF[code];
  const m = new MeshPhysicalMaterial({ color: new Color(d.color), metalness: d.metalness, roughness: d.roughness, clearcoat: d.clearcoat });
  if (d.anisotropy) m.anisotropy = d.anisotropy;
  m.name = code;
  return m;
}

export function finishCode(name: string): FinishCode {
  const n = name.toLowerCase();
  if (n.includes("mill")) return "black-milled";
  if (n.includes("black")) return "black";
  if (n.includes("brush")) return "brushed";
  return "polished";
}

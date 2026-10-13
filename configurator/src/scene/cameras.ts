/* Camera presets, metres, relative to the truck origin (ground under the
   front axle centre, +Z forward, +X the driver's side). Front, three-quarter
   and side look at the driver's side.

   The chips under the stage are front, threeQuarter, side, rear and wheel.
   "hero" is kept as an alias of front so older callers and share links work. */
import { Box3, MathUtils, PerspectiveCamera, Vector3 } from "three";

export type CameraPreset = "front" | "threeQuarter" | "side" | "rear" | "wheel" | "hero";
type V3 = [number, number, number];

/* A slightly long lens (about a 45 mm on full frame at 16:10) flattens the
   perspective the way a car photographer's 50 to 85 mm does. */
export const FOV = 28;

/* Every whole-truck preset looks level or a little down: CameraControls
   clamps the polar angle to MAX_POLAR, so an upward view would be bent on
   arrival and land off its framing. framedView keeps each preset's view
   direction and only solves distance and aim, so the direction here is what
   the visitor sees. */
/* front is the hero and the landing view: eye height (the solver settles it
   near 1.25 m), half a degree down, from ahead of the driver's front wheel
   and about 35 degrees off the truck's axis, so the wheel face turns toward
   the lens. The front wheel and tire are the nearest thing to it and fill
   over a quarter of the frame height on a desktop while the whole truck
   still fits. threeQuarter is the same side
   from higher and further round, so more of the body shows. */
const FRONT = { position: [3.6, 1.0, 3.0] as V3, target: [0, 0.93, -1.9] as V3 };

export const PRESETS: Record<CameraPreset, { position: V3; target: V3 }> = {
  front: FRONT,
  threeQuarter: { position: [4.6, 2.3, 1.6], target: [0, 0.8, -1.9] },
  side: { position: [6.5, 1.15, -1.9], target: [0, 0.9, -1.9] },
  rear: { position: [-3.2, 1.1, -6.2], target: [0, 0.9, -1.9] },
  wheel: { position: [2.7, 0.62, 1.15], target: [0.95, 0.45, 0] },
  hero: FRONT,
};

/* The chips under the stage, in order. Labels are UI copy owned here by
   contract; the UI may still map them through copy.ts. */
export const CAMERA_CHIPS: { key: CameraPreset; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "threeQuarter", label: "Three-quarter" },
  { key: "side", label: "Side" },
  { key: "rear", label: "Rear" },
  { key: "wheel", label: "Wheel" },
];

/* Presets that frame the whole truck. The wheel close-up is left as is. */
const WHOLE: Record<CameraPreset, boolean> = { front: true, threeQuarter: true, side: true, rear: true, wheel: false, hero: true };

/* Where the camera goes for a preset at this viewport aspect. For the
   whole-truck presets the view direction is the preset's, but the distance and
   aim are solved so `box` fills the frame to `pad` and sits centred: a tall
   phone sees far less width than a desktop, and a 3/4 view of a long truck
   projects off-centre if the camera simply aims at the middle of the
   wheelbase. The wheel close-up is returned as authored. */
/* On a tall phone the whole truck only fits from far away, and the front
   wheel, which is what the page is about, shrinks to a sixth of the frame.
   Below PHONE_ASPECT the front hero frames the cab and the front wheel
   instead, the way a hero photo crops the tail, and a drag shows the rest.
   The other presets still fit the whole truck. */
export const PHONE_ASPECT = 1;
export const PHONE_FRONT_SHARE = 0.6;
export function frameBox(preset: CameraPreset, aspect: number, box: Box3): Box3 {
  if ((preset !== "front" && preset !== "hero") || aspect >= PHONE_ASPECT) return box;
  const b = box.clone();
  b.min.z = b.max.z - (b.max.z - b.min.z) * PHONE_FRONT_SHARE;
  return b;
}

export function framedView(preset: CameraPreset, aspect: number, box: Box3 | null, pad = 0.9): { position: V3; target: V3 } {
  const p = PRESETS[preset];
  if (!box || box.isEmpty() || !WHOLE[preset]) return { position: p.position, target: p.target };
  box = frameBox(preset, aspect, box);
  const target = new Vector3(...p.target);
  const dir = new Vector3(...p.position).sub(target).normalize();
  const cam = new PerspectiveCamera(FOV, aspect, 0.1, 200);
  const corners: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z));
  const place = (d: number) => { cam.position.copy(target).addScaledVector(dir, d); cam.lookAt(target); cam.updateMatrixWorld(); };
  const extent = () => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = false;
    for (const c of corners) { const n = c.clone().project(cam); if (n.z >= 1) behind = true; x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); }
    return { x0, x1, y0, y1, behind };
  };
  const fits = (d: number) => { place(d); const e = extent(); return !e.behind && e.x0 >= -pad && e.x1 <= pad && e.y0 >= -pad && e.y1 <= pad; };
  const solve = () => {
    let lo = 0.5, hi = 4;
    while (!fits(hi) && hi < 200) hi *= 1.5;
    for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    return hi;
  };
  let d = solve();
  // Re-aim at the centre of what the camera sees, then refit; three passes settle it.
  for (let k = 0; k < 3; k++) {
    place(d);
    const e = extent();
    const cx = (e.x0 + e.x1) / 2, cy = (e.y0 + e.y1) / 2;
    const halfH = Math.tan(MathUtils.degToRad(FOV / 2)) * d, halfW = halfH * aspect;
    const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    target.addScaledVector(right, cx * halfW).addScaledVector(up, cy * halfH);
    d = solve();
  }
  place(d);
  return { position: [cam.position.x, cam.position.y, cam.position.z], target: [target.x, target.y, target.z] };
}

/* Polar limits for the orbit: never straight down, and never below level, so
   never under the floor. 89.5 degrees lets the front hero sit at eye height. */
export const MIN_POLAR = MathUtils.degToRad(20);
export const MAX_POLAR = MathUtils.degToRad(89.5);

/* The wheel close-up, aimed at one corner and pulled back far enough that a
   sphere of `radius` around it fits the narrower side of the frame. The
   preset gives only the direction, so a tall phone and a wide desktop both
   see the whole wheel and some fender, whatever the tire size or lift. */
export function wheelView(aspect: number, center: V3, radius: number): { position: V3; target: V3 } {
  const p = PRESETS.wheel;
  const dir = new Vector3(...p.position).sub(new Vector3(...p.target)).normalize();
  const halfV = MathUtils.degToRad(FOV / 2);
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const d = radius / Math.sin(Math.min(halfV, halfH));
  const pos = new Vector3(...center).addScaledVector(dir, d);
  return { position: [pos.x, pos.y, pos.z], target: center };
}

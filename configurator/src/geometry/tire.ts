/* Parametric tire, scaled from the size string's numbers (od, section, rim,
   all inches). Axle on X, centred on the origin, same frame as makeWheel.

   The cross-section is lathed: bead on the rim radius, sidewall bulging out
   to the section width, a rounded shoulder, a flat tread band with
   circumferential grooves cut into the profile. Lateral shoulder voids are
   then pushed in ring by ring, so the tire reads as a tire in silhouette
   before the tread normal map lands (Task 6). Mud-terrain gets fewer, deeper
   grooves and staggered shoulder blocks; all-terrain gets more, shallower
   grooves and small shoulder notches.

   The outboard sidewall carries the size string (e.g. 37x13.50R24) as a
   thin decal mesh that follows the sidewall bulge a hair proud of it. The
   lettering is drawn twice around a ring on a 1024px canvas, tops outward
   the way a tire is moulded, and mapped by planar UVs across the wheel
   face. It is light grey at low opacity: legible at the Wheel preset, lost
   in the mip chain at whole-truck distances. Mirrored corners swap in
   sidewallMirrored(decal material) so the text never reads backwards. (Not
   kept in userData: Object3D.clone deep-copies userData through JSON, which
   would turn a material into a plain object.) Without a 2D
   canvas (tests under jsdom) the decal is left out.

   Built in inches and scaled last, for the same reason as wheel.ts. */
import { BufferGeometry, CanvasTexture, LatheGeometry, LinearMipmapLinearFilter, Material, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector2 } from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const IN = 0.0254;
export type Tread = "AT" | "MT";

const CREASE = (40 * Math.PI) / 180;

const SPEC = {
  // grooves: circumferential count; voids: shoulder pitches around the tire;
  // lowIn/lowOut: which rings of each pitch are pushed in, per side.
  // MT: 6 rings per pitch, two low, so blocks read square with a flat top
  // wider than the void. AT: 4 rings per pitch, one low, a shallow notch.
  MT: { grooves: 3, depth: 0.55, gw: 0.5, segments: 192, pitches: 32, voidDepth: 0.6, shoulder: 0.85, lowIn: [1, 2], lowOut: [4, 5] },
  AT: { grooves: 5, depth: 0.28, gw: 0.3, segments: 96, pitches: 24, voidDepth: 0.25, shoulder: 1.1, lowIn: [1], lowOut: [3] },
} as const;

type P = [number, number]; // [axial, radius] inches

/* "37x13.50R24": the size the way it is moulded on the sidewall. */
export function sidewallLabel(od: number, section: number, rim: number): string {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10));
  return `${n(od)}x${section.toFixed(2)}R${n(rim)}`;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function canvas2d(size: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: Ctx } | null {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(size, size);
      const ctx = c.getContext("2d");
      if (ctx) return { canvas: c, ctx };
    }
    if (typeof document === "undefined" || /jsdom/i.test(navigator.userAgent)) return null;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    return ctx ? { canvas: c, ctx } : null;
  } catch { return null; }
}

/* The size string twice around a ring, top and bottom, letter tops pointing
   out from the axle. rPx is the baseline-centre radius, hPx the cap height. */
function letteringTexture(label: string, rPx: number, hPx: number): CanvasTexture | null {
  const N = 1024, c = canvas2d(N);
  if (!c) return null;
  const { ctx } = c;
  ctx.clearRect(0, 0, N, N);
  ctx.font = `700 ${Math.round(hPx)}px Michroma, "Arial Black", Arial, sans-serif`;
  ctx.fillStyle = "rgba(196,198,202,0.34)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const track = hPx * 0.18;
  const widths = [...label].map((ch) => ctx.measureText(ch).width + track);
  const total = widths.reduce((a, b) => a + b, 0);
  for (const centre of [-Math.PI / 2, Math.PI / 2]) {
    let acc = -total / 2;
    for (let i = 0; i < label.length; i++) {
      const a = centre + (acc + widths[i] / 2) / rPx;
      acc += widths[i];
      ctx.save();
      ctx.translate(N / 2 + rPx * Math.cos(a), N / 2 + rPx * Math.sin(a));
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(label[i], 0, 0);
      ctx.restore();
    }
  }
  const tex = new CanvasTexture(c.canvas as HTMLCanvasElement);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  tex.name = "sidewall-" + label;
  return tex;
}

const MIRRORED = new WeakMap<Material, Material>();

/** The read-the-right-way-round material for a decal on a mirrored corner. */
export function sidewallMirrored(m: Material): Material | undefined { return MIRRORED.get(m); }

export function makeTire(od: number, section: number, rim: number, tread: Tread, rimWidthIn?: number, label?: string): Mesh {
  const s = SPEC[tread];
  const Rt = od / 2, rb = rim / 2, S2 = section / 2;
  const bx = rimWidthIn ? Math.min(rimWidthIn / 2 - 0.5, S2 - 0.6) : section * 0.42;
  const tw = S2 * 0.85;
  const sh = s.shoulder;
  const sideEnd = S2 * 0.96;

  // inboard half, bead to tread centre
  const half: P[] = [[-bx, rb], [-(bx + 0.25), rb + 0.35]];
  const r0 = rb + 0.35, r1 = Rt - sh, x0 = bx + 0.25;
  const e = (sideEnd - x0) / (S2 - x0);
  for (let k = 1; k <= 10; k++) {
    const t = k / 10;
    const bulge = t <= 0.5 ? Math.sin((Math.PI / 2) * (t / 0.5)) : 1 - (1 - e) * ((t - 0.5) / 0.5) ** 2;
    half.push([-(x0 + (S2 - x0) * bulge), r0 + t * (r1 - r0)]);
  }
  for (let k = 1; k <= 5; k++) {
    const f = (k / 5) * (Math.PI / 2);
    half.push([-tw - (sideEnd - tw) * Math.cos(f), Rt - sh + sh * Math.sin(f)]);
  }
  // tread: evenly spaced grooves across the band
  const gap = (2 * tw) / (s.grooves + 1);
  const treadPts: P[] = [];
  const firstGroove = -tw + gap;
  treadPts.push([(-tw + firstGroove - s.gw / 2) / 2, Rt]); // mid shoulder rib
  for (let i = 0; i < s.grooves; i++) {
    const g = -tw + gap * (i + 1);
    treadPts.push([g - s.gw / 2, Rt], [g - s.gw / 2 + 0.07, Rt - s.depth], [g + s.gw / 2 - 0.07, Rt - s.depth], [g + s.gw / 2, Rt]);
  }
  treadPts.push([-treadPts[0][0], Rt]);
  const outboard = half.slice().reverse().map(([x, r]) => [-x, r] as P);
  const profile: P[] = [...half, ...treadPts, ...outboard];

  const g = new LatheGeometry(profile.map(([x, r]) => new Vector2(r, x)), s.segments);

  // shoulder voids: profile points outboard of the outer grooves, on the tread
  // or the shoulder, pushed in on the "low" rings of each pitch
  const shoulderEdge = tw - gap + s.gw / 2 + 0.01;
  const P = profile.length, ringsPerPitch = s.segments / s.pitches;
  const pos = g.attributes.position;
  for (let i = 0; i <= s.segments; i++) {
    const m = i % ringsPerPitch;
    for (let j = 0; j < P; j++) {
      const [x, r] = profile[j];
      if (Math.abs(x) < shoulderEdge || r < Rt - sh - 0.01) continue;
      const low = x < 0 ? (s.lowIn as readonly number[]).includes(m) : (s.lowOut as readonly number[]).includes(m);
      if (!low) continue;
      const v = i * P + j, k = (r - s.voidDepth) / r;
      pos.setX(v, pos.getX(v) * k);
      pos.setZ(v, pos.getZ(v) * k);
    }
  }
  g.rotateZ(-Math.PI / 2);
  const geo: BufferGeometry = toCreasedNormals(g, CREASE);
  geo.scale(IN, IN, IN);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  const mesh = new Mesh(geo, new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0 }));
  mesh.name = "tire";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { tread, grooves: s.grooves, grooveDepthIn: s.depth, beadRadiusM: rb * IN, odIn: od, sectionIn: section, rimIn: rim };

  /* Sidewall lettering decal: the outboard sidewall between 18 and 82
     percent of its height, 0.04 in proud, with planar UVs over the face. */
  const text = label ?? sidewallLabel(od, section, rim);
  const band: Vector2[] = [];
  // outer to inner, the same direction as the tire's outboard wall, so the
  // lathe winds its faces outward (inner to outer is culled from outside)
  for (let k = 16; k >= 0; k--) {
    const t = 0.18 + (0.64 * k) / 16;
    const bulge = t <= 0.5 ? Math.sin((Math.PI / 2) * (t / 0.5)) : 1 - (1 - e) * ((t - 0.5) / 0.5) ** 2;
    band.push(new Vector2(r0 + t * (r1 - r0), x0 + (S2 - x0) * bulge + 0.04));
  }
  const rText = r0 + 0.5 * (r1 - r0), pxPerIn = 512 / Rt;
  const tex = letteringTexture(text, rText * pxPerIn, Math.min(0.24 * (r1 - r0), 1.3) * pxPerIn);
  if (tex) {
    const dg = new LatheGeometry(band, 128);
    dg.rotateZ(-Math.PI / 2); // lathe height onto +X (outboard): X = h, Y = -r sin, Z = r cos
    const p = dg.attributes.position, uv = dg.attributes.uv;
    // Seen from +X with +Y up, screen right is -Z, so u runs along -Z.
    for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 - p.getZ(i) / (2 * Rt), 0.5 + p.getY(i) / (2 * Rt));
    dg.scale(IN, IN, IN);
    dg.computeBoundingBox();
    dg.computeBoundingSphere();
    const mk = (map: CanvasTexture) => {
      const m = new MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      m.name = "sidewall";
      return m;
    };
    const mirrored = tex.clone();
    mirrored.repeat.x = -1;
    mirrored.offset.x = 1;
    mirrored.needsUpdate = true;
    const front = mk(tex);
    MIRRORED.set(front, mk(mirrored));
    const decal = new Mesh(dg, front);
    decal.name = "sidewall";
    decal.renderOrder = 1;
    decal.userData = { label: text };
    mesh.add(decal);
  }
  mesh.userData.label = text;
  return mesh;
}

/* Frees a tire from makeTire: its geometry and material, and the sidewall
   decal with both of its materials and textures. Call on the source mesh;
   clones share all of these. */
export function disposeTire(mesh: Mesh) {
  mesh.geometry.dispose();
  (mesh.material as Material).dispose();
  const d = mesh.getObjectByName("sidewall") as Mesh | undefined;
  if (!d) return;
  d.geometry.dispose();
  const m0 = d.material as MeshStandardMaterial;
  for (const m of [m0, MIRRORED.get(m0) as MeshStandardMaterial | undefined]) {
    if (!m) continue;
    m.map?.dispose();
    m.dispose();
  }
}

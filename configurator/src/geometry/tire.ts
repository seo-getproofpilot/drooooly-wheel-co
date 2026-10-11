/* Parametric tire, scaled from the size string's numbers (od, section, rim,
   all inches). Axle on X, centred on the origin, same frame as makeWheel.

   The cross-section is lathed: bead on the rim radius, sidewall bulging out
   to the section width, a rounded shoulder, a flat tread band with
   circumferential grooves cut into the profile. Lateral shoulder voids are
   then pushed in ring by ring, so the tire reads as a tire in silhouette
   before the tread normal map lands (Task 6). Mud-terrain gets fewer, deeper
   grooves and staggered shoulder blocks; all-terrain gets more, shallower
   grooves and small shoulder notches.

   Built in inches and scaled last, for the same reason as wheel.ts. */
import { BufferGeometry, LatheGeometry, Mesh, MeshStandardMaterial, Vector2 } from "three";
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

export function makeTire(od: number, section: number, rim: number, tread: Tread, rimWidthIn?: number): Mesh {
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
  return mesh;
}

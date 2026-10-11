/* Parametric forged truck wheel.

   Axes match fitment3d.ts: metres, axle on X, the outboard face toward +X.
   The wheel is centred on the origin (mid-width, on the axle), so the scene
   places it with the corner position from fit() and mirrors it on the -X
   (passenger) side.

   Everything is built in inches and scaled to metres last. That is not just
   for readability: toCreasedNormals hashes positions at 0.01 units, so in
   metres it would weld vertices up to a centimetre apart and smear the lip
   and spoke edges.

   Children:
     barrel  lathed shell: inboard flange, bead seats, drop centre, inner wall
     lip     lathed outboard flange plus the lip ring down to the face, its own
             mesh so a two-tone finish (black face, polished lip) is one swap
     face    face plate with spoke windows, centre bore and lug holes cut as
             Shape holes, extruded with a bevel so spoke edges catch light
     cap     centre cap dome
     lugs    lug nuts on the bolt circle */
import {
  BufferGeometry, CylinderGeometry, ExtrudeGeometry, Group, LatheGeometry, Mesh,
  MeshStandardMaterial, Object3D, Path, Shape, Vector2,
} from "three";
import { mergeGeometries, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const IN = 0.0254;

export interface WheelStyle {
  spokes: number;
  /** linear spoke width as a fraction of the spoke pitch at mid radius, 0..1 */
  spokeWidth: number;
  /** 0 flat face, 1 deepest concave the barrel allows */
  dish: number;
  /** a slot down each spoke */
  split: boolean;
  /** optional directional swirl: radians the spoke turns from hub to rim */
  sweep?: number;
}

export interface WheelOptions { lugs?: number; boltCircleMm?: number; boreMm?: number; segments?: number; }

const CREASE = (35 * Math.PI) / 180;
const FACE_T = 0.6; // face plate thickness, inches (plan: 0.6 inch)
const BEVEL = 0.14;
const DROP_D = 1.0;

type P = [number, number]; // [axial, radius] in inches, axial +outboard

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* Lathe a profile of [axial, radius] points around the axle, then turn the
   lathe's Y axis onto +X. */
function lathe(pts: P[], segments: number): BufferGeometry {
  const g = new LatheGeometry(pts.map(([ax, r]) => new Vector2(r, ax)), segments);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/* Built in a frame with the axle on +Z (Shape space): turn +Z onto +X. */
function zToX(g: BufferGeometry): BufferGeometry {
  g.rotateY(Math.PI / 2);
  return g;
}

function finishGeo(g: BufferGeometry): BufferGeometry {
  const out = toCreasedNormals(g, CREASE);
  out.scale(IN, IN, IN);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/* ---------- barrel and lip cross-section ---------- */

function profiles(W: number, R: number, xf: number) {
  const h = W / 2;
  const ri = R - 1.15; // inner wall radius under the lip and behind the face
  const seat = R - 0.78; // bead seat
  const dropStart = -h + 2.3, dropEnd = dropStart + 2.0;
  const lip: P[] = [
    [h - 1.3, seat], [h - 0.62, R - 0.76], [h - 0.45, R - 0.45], [h - 0.36, R - 0.12],
    [h - 0.26, R - 0.02], [h - 0.14, R], [h - 0.04, R - 0.05], [h, R - 0.18],
    [h, R - 0.48], [h - 0.08, R - 0.62], [h - 0.3, R - 0.92],
  ];
  if (xf < h - 0.7) lip.push([h - 0.6, ri]);
  lip.push([xf, ri]);
  const barrel: P[] = [[xf, ri]];
  if (dropEnd + 0.15 < xf - 0.05) barrel.push([dropEnd + 0.15, ri]);
  barrel.push(
    [dropEnd - 0.3, ri - DROP_D], [dropStart + 0.3, ri - DROP_D], [dropStart - 0.15, ri],
    [-h + 0.3, R - 0.92], [-h + 0.08, R - 0.62], [-h, R - 0.48], [-h, R - 0.18],
    [-h + 0.04, R - 0.05], [-h + 0.14, R], [-h + 0.26, R - 0.02], [-h + 0.36, R - 0.12],
    [-h + 0.45, R - 0.45], [-h + 0.62, R - 0.76], [-h + 1.3, seat], [-h + 1.5, R - 0.66],
    [-h + 1.75, seat], [dropStart - 0.3, seat], [dropStart + 0.15, seat - DROP_D],
    [dropEnd - 0.15, seat - DROP_D], [dropEnd + 0.3, seat], [h - 1.75, seat], [h - 1.5, R - 0.66],
    [h - 1.3, seat],
  );
  return { lip, barrel, ri, dropEnd, h };
}

/* ---------- face outline helpers ---------- */

type V = [number, number];
const add = (a: V, b: V, s = 1): V => [a[0] + b[0] * s, a[1] + b[1] * s];
const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function polyLength(p: V[]) { let L = 0; for (let i = 1; i < p.length; i++) L += dist(p[i - 1], p[i]); return L; }

function pointAt(p: V[], d: number): { pt: V; i: number } {
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const s = dist(p[i - 1], p[i]);
    if (acc + s >= d) { const t = s ? (d - acc) / s : 0; return { pt: [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t], i }; }
    acc += s;
  }
  return { pt: p[p.length - 1], i: p.length - 1 };
}

/* Trim a polyline by arclength at both ends. */
function trim(p: V[], d0: number, d1: number): V[] {
  const L = polyLength(p);
  const a = pointAt(p, d0), b = pointAt(p, L - d1);
  return [a.pt, ...p.slice(a.i, b.i), b.pt];
}

/* Closed outline from sides that meet at corners, each corner rounded with a
   quadratic through the original corner point. f[i] is the fillet length at
   the corner that ends side i. */
function filleted(sides: V[][], f: number[]): V[] {
  const n = sides.length;
  const len = sides.map(polyLength);
  const fl = f.map((v, i) => Math.min(v, 0.35 * len[i], 0.35 * len[(i + 1) % n]));
  const out: V[] = [];
  for (let i = 0; i < n; i++) {
    const start = fl[(i - 1 + n) % n], end = fl[i];
    const s = trim(sides[i], start, end);
    out.push(...s);
    const corner = sides[i][sides[i].length - 1];
    const next = trim(sides[(i + 1) % n], fl[i], fl[(i + 1) % n])[0];
    const p0 = s[s.length - 1];
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * corner[0] + t * t * next[0], u * u * p0[1] + 2 * u * t * corner[1] + t * t * next[1]]);
    }
  }
  return out;
}

function circle(c: V, r: number, n: number): V[] {
  const out: V[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  return out;
}

const toPath = (pts: V[], P: typeof Path | typeof Shape) => {
  const p = new P();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
};

/* ---------- the wheel ---------- */

export function makeWheel(diaIn: number, widthIn: number, style: WheelStyle, opts: WheelOptions = {}): Group {
  const R = diaIn / 2, W = widthIn;
  const segs = opts.segments ?? 128;
  const lugs = opts.lugs ?? 8;
  const boltR = (opts.boltCircleMm ?? 170) / 25.4 / 2;
  const boreR = (opts.boreMm ?? 125) / 25.4 / 2;
  const lugHoleR = 0.5;
  const dish = clamp(style.dish, 0, 1);
  const concave = 0.3 + dish * 1.2; // hub recessed behind the face rim

  // Face front, inches along the axle. Pushed inboard by dish (plan: dish *
  // width * 0.6), but never into the drop centre and never through the back.
  const h = W / 2;
  const dropEnd = -h + 4.3;
  const faceBack = FACE_T + 2 * BEVEL;
  let xf = h - 0.55 - dish * W * 0.6;
  xf = Math.max(xf, dropEnd + 0.6 + faceBack, -h + 0.6 + faceBack + concave);
  xf = Math.min(xf, h - 0.55);

  const pr = profiles(W, R, xf);
  const std = () => new MeshStandardMaterial({ color: 0xd8dce0, metalness: 1, roughness: 0.2 });
  const group = new Group();
  group.name = "wheel";

  const add3 = (name: string, geo: BufferGeometry) => {
    const m = new Mesh(finishGeo(geo), std());
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  add3("barrel", lathe(pr.barrel, segs));
  add3("lip", lathe(pr.lip, segs));

  /* Face plate: shape in the XY plane, extruded along +Z (outboard), then
     turned so +Z is +X. */
  const Rf = pr.ri + 0.12; // seats 0.12 in into the inner wall, no visible seam
  const rOut = Rf - 0.85; // outer ring band the windows stop at
  const rHub = Math.max(boltR + lugHoleR + 1.0, Rf * 0.36);
  const N = Math.max(3, Math.round(style.spokes));
  const pitch = (Math.PI * 2) / N;
  const rMid = (rHub + rOut) / 2;
  const w = clamp(style.spokeWidth * pitch * rMid, 0.5, rHub * pitch - 0.55);
  const sweep = style.sweep ?? 0;
  const theta = (a: number, rho: number) => a + sweep * (rho - rHub) / (rOut - rHub);
  const along = (a: number, rho: number, off: number): V => {
    const t = theta(a, rho);
    return [rho * Math.cos(t) - off * Math.sin(t), rho * Math.sin(t) + off * Math.cos(t)];
  };
  const M = 16;
  const edge = (a: number, off: number, r0: number, r1: number): V[] => {
    const p0 = Math.sqrt(Math.max(r0 * r0 - off * off, 0)), p1 = Math.sqrt(r1 * r1 - off * off);
    const out: V[] = [];
    for (let k = 0; k <= M; k++) out.push(along(a, p0 + ((p1 - p0) * k) / M, off));
    return out;
  };
  const arc = (r: number, a0: number, a1: number): V[] => {
    const n = Math.max(3, Math.ceil((Math.abs(a1 - a0) * r) / 0.3));
    const out: V[] = [];
    for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; out.push([r * Math.cos(a), r * Math.sin(a)]); }
    return out;
  };
  const ang = (p: V) => Math.atan2(p[1], p[0]);

  const shape = toPath(circle([0, 0], Rf, 192), Shape) as Shape;
  for (let k = 0; k < N; k++) {
    const a = k * pitch, b = (k + 1) * pitch;
    const A = edge(a, w / 2, rHub, rOut); // spoke k, leading edge, hub to rim
    const B = edge(b, -w / 2, rHub, rOut).reverse(); // spoke k+1, trailing edge, rim to hub
    let aA1 = ang(A[A.length - 1]), aB1 = ang(B[0]);
    while (aB1 <= aA1) aB1 += Math.PI * 2;
    let aB0 = ang(B[B.length - 1]), aA0 = ang(A[0]);
    while (aB0 <= aA0) aB0 += Math.PI * 2;
    const outer = arc(rOut, aA1, aB1);
    const hub = arc(rHub, aB0, aA0);
    // sides: A (ends at outer corner), outer arc, B (ends at hub corner), hub arc
    const win = filleted([A, outer, B, hub], [0.55, 0.55, 0.4, 0.4]);
    shape.holes.push(toPath(win, Path));
  }
  if (style.split) {
    const sw = Math.max(0.12, 0.14 * w);
    const r0 = rHub + 0.9, r1 = rOut - 0.9;
    for (let k = 0; k < N; k++) {
      const a = k * pitch;
      const pts: V[] = [];
      for (let j = 0; j <= M; j++) pts.push(along(a, r0 + ((r1 - r0) * j) / M, sw));
      const cOut = along(a, r1, 0), tO = theta(a, r1);
      const u1: V = [Math.cos(tO), Math.sin(tO)], n1: V = [-Math.sin(tO), Math.cos(tO)];
      for (let j = 1; j < 6; j++) { const f = (j / 6) * Math.PI; pts.push(add(add(cOut, n1, sw * Math.cos(f)), u1, sw * Math.sin(f))); }
      for (let j = M; j >= 0; j--) pts.push(along(a, r0 + ((r1 - r0) * j) / M, -sw));
      const cIn = along(a, r0, 0), tI = theta(a, r0);
      const u0: V = [Math.cos(tI), Math.sin(tI)], n0: V = [-Math.sin(tI), Math.cos(tI)];
      for (let j = 1; j < 6; j++) { const f = (j / 6) * Math.PI; pts.push(add(add(cIn, n0, -sw * Math.cos(f)), u0, -sw * Math.sin(f))); }
      shape.holes.push(toPath(pts, Path));
    }
  }
  const lugAng = (l: number) => (l / lugs) * Math.PI * 2 + Math.PI / lugs;
  for (let l = 0; l < lugs; l++) {
    const a = lugAng(l);
    shape.holes.push(toPath(circle([boltR * Math.cos(a), boltR * Math.sin(a)], lugHoleR, 20), Path));
  }
  shape.holes.push(toPath(circle([0, 0], boreR, 48), Path));

  const face = new ExtrudeGeometry(shape, {
    depth: FACE_T, steps: 1, curveSegments: 1,
    bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelOffset: -BEVEL, bevelSegments: 2,
  });
  face.translate(0, 0, xf - FACE_T - BEVEL); // front of the bevel lands on xf
  // Concave: the hub sits `concave` inches behind the face rim, eased out
  // along the spokes so the ring band stays flat where it meets the lip.
  const pos = face.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    const t = clamp((rOut - r) / (rOut - rHub), 0, 1);
    pos.setZ(i, pos.getZ(i) - concave * t * t * (3 - 2 * t));
  }
  add3("face", zToX(face));

  /* Centre cap: a low dome over the bore. */
  const hubFront = xf - concave;
  const capR = boreR + 0.25;
  const cap: P[] = [];
  for (let k = 0; k <= 8; k++) { const f = (k / 8) * (Math.PI / 2); cap.push([hubFront + 0.15 + 0.55 * Math.cos(f), capR * Math.sin(f)]); }
  cap.push([hubFront + 0.05, capR], [hubFront - 0.1, capR - 0.05]);
  add3("cap", lathe(cap.reverse(), 64)); // rim to pole, so the dome faces out

  /* Lug nuts: chamfered hex, seated in the counterbore. */
  const nuts: BufferGeometry[] = [];
  for (let l = 0; l < lugs; l++) {
    const a = lugAng(l);
    const nut = new CylinderGeometry(0.33, 0.42, 0.6, 6, 1).toNonIndexed();
    nut.deleteAttribute("uv");
    nut.rotateX(Math.PI / 2);
    nut.translate(boltR * Math.cos(a), boltR * Math.sin(a), hubFront + 0.15);
    nuts.push(nut);
  }
  add3("lugs", zToX(mergeGeometries(nuts)!));

  // hubBackIn: the back of the face plate at the hub, where a brake hat seats
  group.userData = { diaIn, widthIn, style, faceFrontIn: xf, concaveIn: concave, hubBackIn: hubFront - faceBack };
  return group;
}

export function wheelTriangles(o: Object3D): number {
  let n = 0;
  o.traverse((c) => {
    const g = (c as Mesh).geometry as BufferGeometry | undefined;
    if (!g) return;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return n;
}

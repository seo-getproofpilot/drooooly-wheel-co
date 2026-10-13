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
     barrel   lathed shell: inboard flange, bead seats, drop centre, inner wall
     lip      lathed outboard flange, the wide flat lip face, and the lip ring
              down to the spoke face, its own mesh so a two-tone finish is one
              swap
     face     the spoke face. Two extrusions merged: a base plate with the
              windows, centre bore and lug holes cut as Shape holes, and a
              thinner step layer on top whose windows are grown by `step`
              inches, so every spoke has a raised centre with a machined ledge
              down each side. Group 0 is the caps (spoke tops), group 1 the
              walls and chamfers, which is how black milled shows bright
              window walls on a black face
     cap      centre cap: a short drum with a shallow dome
     lugs     hex lug nuts with an acorn top, each on a washer seated in its
              pocket in the hub
     logo     the cap mark, a decal a hair proud of the dome (browser only)
     engrave  JTX FORGED twice around the lip face (browser only)

   Spoke shapes come from WheelStyle. Every window is the region between two
   neighbouring spoke edges, each edge an angle as a function of radius, so
   one builder covers straight, tapered, swept and forked spokes: a window
   that runs out of room closes to a rounded point instead of a slot and opens
   again where there is room, which is how forked spokes give the Y mesh of
   the Ace and the lattice of the Alpha.

   The two decals carry a mirrored twin (overlayMirrored) for corners drawn
   with scale-x -1, the way tire.ts handles the sidewall size. */
import {
  BufferGeometry, CylinderGeometry, ExtrudeGeometry, Group, LatheGeometry, Material, Mesh,
  MeshStandardMaterial, Object3D, Path, RepeatWrapping, RingGeometry, Shape, Vector2,
} from "three";
import { mergeGeometries, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvas2d, colourTexture, MARK_FONT, mirroredCopy } from "./lettering";

export const IN = 0.0254;
/** the only mark the wheel carries */
export const MARK = "JTX FORGED";

export interface WheelStyle {
  spokes: number;
  /** linear spoke width as a fraction of the spoke pitch at mid radius, 0..1 */
  spokeWidth: number;
  /** 0 flat face, 1 deepest concave the barrel allows */
  dish: number;
  /** a slot down each spoke (down the trunk, when the spoke forks) */
  split: boolean;
  /** optional directional swirl: radians the spoke turns from hub to rim */
  sweep?: number;
  /** spoke width at the hub as a fraction of its width at the rim end; 1 (default) is a constant width */
  taper?: number;
  /** each spoke splits into a Y. at: radius fraction, hub 0 to rim 1, where it splits.
      spread: how far each arm swings toward the neighbouring spoke by the rim, as a
      fraction of half the pitch; near 1 the arms of neighbours meet and close the window.
      arm: arm width as a fraction of the trunk width, default 0.6.
      zigzag: how many times the arms swing between the spoke line and the neighbour
      before the rim, default 1 (straight out). 3 swings out, back and out again, so the
      windows close and reopen in rows: a lattice */
  fork?: { at: number; spread: number; arm?: number; zigzag?: number };
  /** slot width as a fraction of the spoke width when split, default 0.28 */
  slot?: number;
  /** machined step down each spoke edge, inches; 0 for a flat extrude, default 0.18 */
  step?: number;
}

export interface WheelOptions { lugs?: number; boltCircleMm?: number; boreMm?: number; segments?: number; }

const CREASE = (35 * Math.PI) / 180;
const FACE_T = 0.6; // face plate thickness, inches (plan: 0.6 inch)
const BEVEL = 0.14;
const STEP_D = 0.12, STEP_B = 0.05; // step layer depth and chamfer, inches
const STEP_H = STEP_D + 2 * STEP_B - 0.02; // how far the step stands proud of the base: 0.2 in
const MIN_GAP = 0.3; // narrowest window, inches
const DROP_D = 1.0;

type P = [number, number]; // [axial, radius] in inches, axial +outboard

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* Lathe a profile of [axial, radius] points around the axle, then turn the
   lathe's Y axis onto +X. With arcIn, v runs along the profile by arclength
   (v = length / arcIn), so the finish's turning stripes keep a constant
   pitch on every part. */
function lathe(pts: P[], segments: number, arcIn = 0): BufferGeometry {
  const g = new LatheGeometry(pts.map(([ax, r]) => new Vector2(r, ax)), segments);
  if (arcIn > 0) {
    const n = pts.length, acc = [0];
    for (let j = 1; j < n; j++) acc.push(acc[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    const uv = g.attributes.uv;
    for (let i = 0; i <= segments; i++) for (let j = 0; j < n; j++) uv.setY(i * n + j, acc[j] / arcIn);
  }
  g.rotateZ(-Math.PI / 2);
  return g;
}

/* Built in a frame with the axle on +Z (Shape space): turn +Z onto +X. Seen
   from outboard (+X, Y up), shape +x lands on screen right. */
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
  // flange, then the wide flat lip face (R - 0.18 down to R - 0.85) that
  // carries the engraving, a small chamfer and the lip ring back to the face
  const lip: P[] = [
    [h - 1.3, seat], [h - 0.62, R - 0.76], [h - 0.45, R - 0.45], [h - 0.36, R - 0.12],
    [h - 0.26, R - 0.02], [h - 0.14, R], [h - 0.04, R - 0.05], [h, R - 0.18],
    [h, R - 0.85], [h - 0.08, R - 0.95], [h - 0.24, ri], [xf, ri],
  ];
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
const mid = (a: V, b: V): V => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const polar = (th: number, rho: number): V => [rho * Math.cos(th), rho * Math.sin(th)];

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

function arc(r: number, a0: number, a1: number): V[] {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / 0.35));
  const out: V[] = [];
  for (let k = 0; k <= n; k++) out.push(polar(a0 + ((a1 - a0) * k) / n, r));
  return out;
}

const toPath = (pts: V[], P: typeof Path | typeof Shape) => {
  const p = new P();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
};

/* The windows between a left edge L(rho) and a right edge R(rho), both
   angles, over the radii [rIn, rOut]: one per run of radii where the gap is
   at least MIN_GAP wide. An end that reaches rIn or rOut is closed with an
   arc; an end that runs out of width closes to a rounded point. */
function windowOutlines(L: (r: number) => number, R: (r: number) => number, rIn: number, rOut: number,
  extra: number[], fil: { inner: number; outer: number; point: number }): V[][] {
  const ok = (r: number) => (R(r) - L(r)) * r > MIN_GAP;
  const K = 200;
  const at = (k: number) => rIn + ((rOut - rIn) * k) / K;
  const runs: [number, number][] = [];
  let a = -1;
  for (let k = 0; k <= K; k++) {
    if (ok(at(k))) { if (a < 0) a = k; }
    else if (a >= 0) { runs.push([a, k - 1]); a = -1; }
  }
  if (a >= 0) runs.push([a, K]);
  const refine = (good: number, bad: number) => { for (let i = 0; i < 12; i++) { const m = (good + bad) / 2; if (ok(m)) good = m; else bad = m; } return good; };
  const out: V[][] = [];
  for (const [a0, b0] of runs) {
    const openIn = a0 === 0, openOut = b0 === K;
    // a pointed end stops a quarter inch short of where the gap runs out, so
    // two windows on either side of a pinch never touch
    const ra = openIn ? rIn : refine(at(a0), at(a0 - 1)) + 0.25;
    const rb = openOut ? rOut : refine(at(b0), at(b0 + 1)) - 0.25;
    if (rb - ra < 0.45) continue;
    out.push(oneWindow(L, R, ra, rb, openIn, openOut, extra, fil));
  }
  return out;
}

function oneWindow(L: (r: number) => number, R: (r: number) => number, ra: number, rb: number, openIn: boolean, openOut: boolean,
  extra: number[], fil: { inner: number; outer: number; point: number }): V[] {
  const n = 14, grid: number[] = [];
  for (let k = 0; k <= n; k++) grid.push(ra + ((rb - ra) * k) / n);
  for (const e of extra) if (e > ra + 0.05 && e < rb - 0.05) grid.push(e);
  grid.sort((x, y) => x - y);
  const A = grid.map((r) => polar(L(r), r));
  const B = grid.slice().reverse().map((r) => polar(R(r), r));
  const sides: V[][] = [], f: number[] = [];
  if (openOut) { sides.push(A, arc(rb, L(rb), R(rb))); f.push(fil.outer, fil.outer); }
  else { const m = mid(A[A.length - 1], B[0]); A[A.length - 1] = m; B[0] = m; sides.push(A); f.push(fil.point); }
  sides.push(B);
  if (openIn) { f.push(fil.inner); sides.push(arc(ra, R(ra), L(ra))); f.push(fil.inner); }
  else { const m = mid(B[B.length - 1], A[0]); B[B.length - 1] = m; A[0] = m; f.push(fil.point); }
  return filleted(sides, f);
}

/* ---------- decals ---------- */

const MIRRORED = new WeakMap<Material, Material>();

/** The read-the-right-way-round material for a wheel decal (logo, engrave) on a mirrored corner. */
export function overlayMirrored(m: Material): Material | undefined { return MIRRORED.get(m); }

/* Engraved and printed marks are frosted metal: rougher and greyer than the
   polished face, so on chrome they read as cut-in grey and on black as bright
   metal, like the product photos. */
function markMaterial(map: ReturnType<typeof colourTexture>, name: string, fade: boolean): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    map, color: 0x9a9ea5, metalness: 1, roughness: 0.55, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  m.name = name;
  m.userData = { fade, baseOpacity: 1 };
  return m;
}

function withMirror(tex: ReturnType<typeof colourTexture>, name: string, fade: boolean): MeshStandardMaterial {
  const front = markMaterial(tex, name, fade);
  MIRRORED.set(front, markMaterial(mirroredCopy(tex), name, fade));
  return front;
}

/* The lip engraving: a strip texture wrapped twice around the lip face, u
   clockwise from outboard, v from the inner to the outer edge, so each copy
   reads left to right with its letter tops toward the tyre. */
function lipEngraving(rIn: number, rOut: number): MeshStandardMaterial | null {
  const W = 2048, H = 64, c = canvas2d(W, H);
  if (!c) return null;
  const { ctx } = c;
  const rMid = (rIn + rOut) / 2, halfC = Math.PI * rMid, width = rOut - rIn;
  const pxU = W / halfC, pxV = H / width, capIn = width * 0.56;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(pxU / pxV, 1); // one inch is pxV wide and pxV tall from here on
  ctx.font = `700 ${Math.round(capIn * pxV * 1.32)}px ${MARK_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const track = capIn * pxV * 0.32;
  const chars = [...MARK], widths = chars.map((ch) => ctx.measureText(ch).width + track);
  let x = -widths.reduce((s, v) => s + v, 0) / 2;
  chars.forEach((ch, i) => { ctx.fillText(ch, x + widths[i] / 2, 1); x += widths[i]; });
  ctx.restore();
  const tex = colourTexture(c.canvas, "lip-engrave");
  tex.wrapS = RepeatWrapping;
  tex.repeat.x = 2;
  return withMirror(tex, "engrave", true);
}

/* The cap mark: JTX over FORGED inside a fine ring, upright from outboard. */
function capLogo(): MeshStandardMaterial | null {
  const N = 512, c = canvas2d(N);
  if (!c) return null;
  const { ctx } = c;
  ctx.clearRect(0, 0, N, N);
  ctx.fillStyle = ctx.strokeStyle = "#fff";
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(N / 2, N / 2, N * 0.43, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(N / 2, N * 0.45);
  ctx.transform(1, 0, -0.22, 1, 0, 0); // forward slant
  ctx.font = `700 ${Math.round(N * 0.22)}px ${MARK_FONT}`;
  ctx.fillText("JTX", 0, 0);
  ctx.restore();
  ctx.font = `700 ${Math.round(N * 0.075)}px ${MARK_FONT}`;
  const word = "FORGED", track = N * 0.03;
  const ws = [...word].map((ch) => ctx.measureText(ch).width + track);
  let x = N / 2 - ws.reduce((s, v) => s + v, 0) / 2;
  [...word].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, N * 0.62); x += ws[i]; });
  return withMirror(colourTexture(c.canvas, "cap-logo"), "logo", false);
}

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
  const step = Math.max(0, style.step ?? 0.18);
  const stepH = step > 0 ? STEP_H : 0;

  // Face front, inches along the axle. Pushed inboard by dish (plan: dish *
  // width * 0.6), but never into the drop centre and never through the back.
  const h = W / 2;
  const dropEnd = -h + 4.3;
  const faceBack = FACE_T + 2 * BEVEL;
  let xf = h - 0.55 - dish * W * 0.6;
  xf = Math.max(xf, dropEnd + 0.6 + faceBack + stepH, -h + 0.6 + faceBack + stepH + concave);
  xf = Math.min(xf, h - 0.55);

  const pr = profiles(W, R, xf);
  const std = () => new MeshStandardMaterial({ color: 0xd8dce0, metalness: 1, roughness: 0.2 });
  const group = new Group();
  group.name = "wheel";

  const add3 = (name: string, geo: BufferGeometry, mat: Material | Material[] = std()) => {
    const m = new Mesh(finishGeo(geo), mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  add3("barrel", lathe(pr.barrel, segs, 20));
  add3("lip", lathe(pr.lip, segs, 20));

  /* ---- face plan: spoke edges as angles over radius ---- */
  const Rf = pr.ri + 0.12; // seats 0.12 in into the inner wall, no visible seam
  const rOut = Rf - 0.85; // outer ring band the windows stop at
  const rHub = Math.max(boltR + lugHoleR + 1.0, Rf * 0.36);
  const N = Math.max(3, Math.round(style.spokes));
  const pitch = (Math.PI * 2) / N;
  const rMid = (rHub + rOut) / 2, span = rOut - rHub;
  const w = clamp(style.spokeWidth * pitch * rMid, 0.5, rHub * pitch - 0.55);
  const sweep = style.sweep ?? 0;
  const taper = clamp(style.taper ?? 1, 0.3, 2);
  const sOf = (rho: number) => clamp((rho - rHub) / span, 0, 1);
  const centre = (k: number, rho: number) => k * pitch + sweep * sOf(rho);
  const half = (lin: number, rho: number) => Math.asin(Math.min(0.95, lin / 2 / Math.max(rho, 0.1)));
  const trunkW = (rho: number) => (w * (taper + (1 - taper) * sOf(rho))) / ((taper + 1) / 2);
  const fork = style.fork;
  const rF = fork ? rHub + clamp(fork.at, 0.05, 0.9) * span : Infinity;
  const armW = fork ? w * clamp(fork.arm ?? 0.6, 0.3, 1) : 0;
  const psi = (rho: number) => {
    if (!fork) return 0;
    const z = Math.max(1, Math.round(fork.zigzag ?? 1));
    const ph = (clamp((rho - rF) / (rOut - rF), 0, 1) * z) % 2;
    const t = ph <= 1 ? ph : 2 - ph; // out, back, out: a triangle wave with z half-waves
    return half(trunkW(rF), rF) - half(armW, rF) + fork.spread * (pitch / 2) * t;
  };
  /** the spoke's outer half-angle at rho: trunk edge, then the outer arm edge past the fork */
  const outer = (rho: number) => (rho < rF ? half(trunkW(rho), rho) : psi(rho) + half(armW, rho));
  /** the inner arm edge past the fork, the crotch window's half-angle */
  const inner = (rho: number) => (rho < rF ? -1 : psi(rho) - half(armW, rho));

  /* The face outline with every window grown by g inches (0 for the base
     plate, `step` for the step layer) inside an outer circle of radius rim. */
  const faceShape = (g: number, rim: number): Shape => {
    const shape = toPath(circle([0, 0], rim, 192), Shape) as Shape;
    const fil = { inner: 0.4 + g, outer: 0.55 + g, point: 0.3 + g };
    const extra = fork ? [rF] : [];
    for (let k = 0; k < N; k++) {
      for (const win of windowOutlines((r) => centre(k, r) + outer(r) - g / r, (r) => centre(k + 1, r) - outer(r) + g / r,
        rHub - g, rOut + g, extra, fil)) shape.holes.push(toPath(win, Path));
      if (fork) {
        // never past half a pitch less a 0.3 in bar, where the arms of
        // neighbours overlap and their fork windows would run into each other
        const ci = (r: number) => Math.min(inner(r) + g / r, pitch / 2 - 0.15 / r);
        for (const crotch of windowOutlines((r) => centre(k, r) - ci(r), (r) => centre(k, r) + ci(r),
          rF, rOut + g, [], fil)) shape.holes.push(toPath(crotch, Path));
      }
    }
    if (style.split) {
      const sw = Math.max(0.12, ((style.slot ?? 0.28) * w) / 2) + g;
      const r0 = rHub + 0.9 - g, r1 = Math.min(rOut, rF - 0.4) - 0.9 + g;
      const M = 16;
      const along = (a: number, rho: number, off: number): V => {
        const t = centre(0, rho) + a;
        return [rho * Math.cos(t) - off * Math.sin(t), rho * Math.sin(t) + off * Math.cos(t)];
      };
      for (let k = 0; r1 - r0 > 1 && k < N; k++) {
        const a = k * pitch;
        const pts: V[] = [];
        for (let j = 0; j <= M; j++) pts.push(along(a, r0 + ((r1 - r0) * j) / M, sw));
        const cOut = along(a, r1, 0), tO = centre(k, r1);
        const u1: V = [Math.cos(tO), Math.sin(tO)], n1: V = [-Math.sin(tO), Math.cos(tO)];
        for (let j = 1; j < 6; j++) { const f = (j / 6) * Math.PI; pts.push(add(add(cOut, n1, sw * Math.cos(f)), u1, sw * Math.sin(f))); }
        for (let j = M; j >= 0; j--) pts.push(along(a, r0 + ((r1 - r0) * j) / M, -sw));
        const cIn = along(a, r0, 0), tI = centre(k, r0);
        const u0: V = [Math.cos(tI), Math.sin(tI)], n0: V = [-Math.sin(tI), Math.cos(tI)];
        for (let j = 1; j < 6; j++) { const f = (j / 6) * Math.PI; pts.push(add(add(cIn, n0, -sw * Math.cos(f)), u0, -sw * Math.sin(f))); }
        shape.holes.push(toPath(pts, Path));
      }
    }
    for (let l = 0; l < lugs; l++) {
      const a = lugAng(l);
      shape.holes.push(toPath(circle([boltR * Math.cos(a), boltR * Math.sin(a)], lugHoleR + g, 20), Path));
    }
    // the bore stays clear of the lug pockets (they meet under the cap on the step layer)
    shape.holes.push(toPath(circle([0, 0], Math.min(boreR + g, boltR - lugHoleR - g - 0.15), 48), Path));
    return shape;
  };
  const lugAng = (l: number) => (l / lugs) * Math.PI * 2 + Math.PI / lugs;

  /* Base plate, front at xf - stepH; step layer, front at xf, its back
     buried 0.02 in into the base so there is never a crack. */
  const parts: BufferGeometry[] = [];
  const baseShape = faceShape(0, Rf);
  const windows = baseShape.holes.length - lugs - 1; // spoke windows and slots, without lug holes and bore
  const base = new ExtrudeGeometry(baseShape, {
    depth: FACE_T, steps: 1, curveSegments: 1,
    bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelOffset: -BEVEL, bevelSegments: 1,
  });
  base.translate(0, 0, xf - stepH - FACE_T - BEVEL);
  parts.push(base);
  if (step > 0) {
    const top = new ExtrudeGeometry(faceShape(step, Rf - 0.32), {
      depth: STEP_D, steps: 1, curveSegments: 1,
      bevelEnabled: true, bevelThickness: STEP_B, bevelSize: STEP_B, bevelOffset: -STEP_B, bevelSegments: 1,
    });
    top.translate(0, 0, xf - STEP_D - STEP_B);
    parts.push(top);
  }
  const face = mergeGeometries(parts, false)!;
  face.clearGroups();
  let start = 0;
  for (const p of parts) {
    for (const gr of p.groups) face.addGroup(start + gr.start, gr.count, gr.materialIndex);
    start += p.attributes.position.count;
    p.dispose();
  }
  // Concave: the hub sits `concave` inches behind the face rim, eased out
  // along the spokes so the ring band stays flat where it meets the lip.
  // UVs are planar across the face disc: u right, v up, seen from outboard.
  const pos = face.attributes.position, uv = face.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), r = Math.hypot(x, y);
    const t = clamp((rOut - r) / (rOut - rHub), 0, 1);
    pos.setZ(i, pos.getZ(i) - concave * t * t * (3 - 2 * t));
    uv.setXY(i, 0.5 + x / (2 * Rf), 0.5 + y / (2 * Rf));
  }
  add3("face", zToX(face), [std(), std()]);

  /* Centre cap: a short drum over the bore with a shallow dome. */
  const hubFront = xf - concave; // the step layer's top at the hub
  const hubBase = hubFront - stepH; // the base plate's front, where the nuts seat
  const capR = boreR + 0.25, domeR = capR - 0.12, domeZ = hubFront + 0.3, domeH = 0.32;
  const cap: P[] = [[hubBase - 0.1, capR - 0.05], [hubBase + 0.05, capR], [domeZ - 0.06, capR], [domeZ, domeR + 0.04]];
  const dome: P[] = [];
  for (let k = 0; k <= 10; k++) { const f = (k / 10) * (Math.PI / 2); dome.push([domeZ + domeH * Math.sin(f), domeR * Math.cos(f)]); }
  add3("cap", lathe([...cap, ...dome], 64, 20)); // rim to pole, so the dome faces out

  /* Lug nuts: a washer on the hub, a hex body, a chamfer and an acorn top. */
  const nut = (() => {
    const pieces: BufferGeometry[] = [];
    const washer = new CylinderGeometry(0.52, 0.52, 0.08, 20, 1); washer.translate(0, 0.04, 0); pieces.push(washer);
    const hex = new CylinderGeometry(0.45, 0.45, 0.42, 6, 1); hex.translate(0, 0.29, 0); pieces.push(hex);
    const cham = new CylinderGeometry(0.37, 0.45, 0.07, 6, 1, true); cham.translate(0, 0.535, 0); pieces.push(cham);
    const acorn: Vector2[] = [];
    for (let k = 0; k <= 5; k++) { const f = (k / 5) * (Math.PI / 2); acorn.push(new Vector2(0.37 * Math.cos(f), 0.57 + 0.3 * Math.sin(f))); }
    pieces.push(new LatheGeometry(acorn, 12));
    const flat = pieces.map((p) => { const q = p.toNonIndexed(); p.dispose(); return q; });
    const g = mergeGeometries(flat, false)!;
    flat.forEach((p) => p.dispose());
    g.rotateX(Math.PI / 2); // axis Y onto +Z, outboard
    return g;
  })();
  const nuts: BufferGeometry[] = [];
  for (let l = 0; l < lugs; l++) {
    const a = lugAng(l);
    const n = nut.clone();
    n.rotateZ(a);
    n.translate(boltR * Math.cos(a), boltR * Math.sin(a), hubBase);
    nuts.push(n);
  }
  nut.dispose();
  add3("lugs", zToX(mergeGeometries(nuts, false)!));
  nuts.forEach((n) => n.dispose());

  /* Decals, browser only. */
  const logoMat = capLogo();
  if (logoMat) {
    const pts = dome.map(([ax, r]) => new Vector2(r, ax + 0.015));
    const dg = new LatheGeometry(pts, 64);
    dg.rotateZ(-Math.PI / 2); // X = axial, Y = -r sin, Z = r cos
    const p = dg.attributes.position, duv = dg.attributes.uv;
    // seen from +X with +Y up, screen right is -Z
    for (let i = 0; i < p.count; i++) duv.setXY(i, 0.5 - p.getZ(i) / (2 * domeR), 0.5 + p.getY(i) / (2 * domeR));
    const m = new Mesh(finishGeo(dg), logoMat);
    m.name = "logo";
    m.renderOrder = 1;
    group.add(m);
  }
  const lipIn = R - 0.8, lipOut = R - 0.22;
  const engraveMat = lipEngraving(lipIn, lipOut);
  if (engraveMat) {
    const T = 192, rg = new RingGeometry(lipIn, lipOut, T, 1);
    const ruv = rg.attributes.uv;
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= T; i++) ruv.setXY(j * (T + 1) + i, 1 - i / T, j);
    rg.translate(0, 0, h + 0.006);
    const m = new Mesh(finishGeo(zToX(rg)), engraveMat);
    m.name = "engrave";
    m.renderOrder = 1;
    group.add(m);
  }

  // hubBackIn: the back of the face plate at the hub, where a brake hat seats
  group.userData = { diaIn, widthIn, style, lugs, windows, faceFrontIn: xf, concaveIn: concave, hubBackIn: hubBase - faceBack };
  return group;
}

/* Frees a wheel from makeWheel: geometry, plus the decal materials and their
   textures (with their mirrored twins). Call on the source group; clones
   share all of these. */
export function disposeWheel(g: Object3D) {
  g.traverse((c) => {
    const m = c as Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    if (m.name !== "logo" && m.name !== "engrave") return;
    const m0 = m.material as MeshStandardMaterial;
    for (const x of [m0, MIRRORED.get(m0) as MeshStandardMaterial | undefined]) { if (!x) continue; x.map?.dispose(); x.dispose(); }
  });
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

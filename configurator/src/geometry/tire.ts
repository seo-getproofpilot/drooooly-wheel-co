/* Parametric tire, scaled from the size string's numbers (od, section, rim,
   all inches). Axle on X, centred on the origin, same frame as makeWheel.

   The tread is real geometry, not paint. Two parts go into one mesh:

   Carcass: a cross-section lathed around the axle. Bead on the rim radius,
   a sidewall that bulges out to the section width just below mid height and
   rolls back in to the shoulder with a vertical tangent, a raised rim guard
   ridge low on the wall, a rounded shoulder, and a flat base band across the
   tread at the bottom of the voids (od / 2 minus the tread depth).

   Lugs: beveled blocks standing on that carcass. A block is a quad in
   (a, t): a is arc length around the crown, t is arc length along the
   cross-section from the tread centre (negative inboard). Its top sits at the
   tread depth along the surface normal, so a block drawn across the shoulder
   wraps over it and down onto the sidewall. Each block gets a one-step 45
   degree chamfer between top and walls so the edges catch light, and walls
   that sink a little into the carcass so there is never a gap.

   Mud-terrain: big stepped centre blocks in two rows (three on wide tires),
   staggered half a pitch and angled, and long shoulder lugs that wrap over
   the shoulder into scalloped sidewall lugs, alternating long and short.
   All-terrain: three or four rows of smaller interlocking blocks cut by two
   sipes each (real gaps, not lines), and shoulder blocks with a sipe that
   just reach over the shoulder, alternating long and short.

   Size rules: the pitch count is the crown circumference over a fixed pitch
   length, rounded to an even number, so blocks keep their physical size on
   every tire; the number of centre rows comes from the tread width, so wider
   sections get more rows.

   Rubber: colour 0x0b0b0b. Vertex colours shade the parts: worn block tops a
   little lighter, voids darker. A 1x4 roughness map on the second uv channel
   gives sidewall 0.62, tread walls and voids 0.78, and the worn block tops
   0.86. A fine grain normal map on the first uv channel (inches) gives the
   moulded rubber texture; it is generated from numbers, so it exists under
   jsdom too.

   The outboard sidewall carries the size string (e.g. 37x13.50R24) top and
   bottom, and generic moulding text (MUD TERRAIN  RADIAL  TUBELESS) left and
   right, as one thin decal mesh that follows the sidewall bulge a hair proud
   of it. The letters are drawn on a 1024px canvas, tops outward the way a
   tire is moulded, mapped by planar UVs across the wheel face, and embossed
   by a normal map from the same letters. Mirrored corners swap in
   sidewallMirrored(decal material) so the text never reads backwards. (Not
   kept in userData: Object3D.clone deep-copies userData through JSON, which
   would turn a material into a plain object.) Without a 2D canvas (tests
   under jsdom) the decal is left out.

   Built in inches and scaled last, for the same reason as wheel.ts. */
import { BufferGeometry, CanvasTexture, Color, DataTexture, Float32BufferAttribute, LatheGeometry, LinearFilter, LinearMipmapLinearFilter, Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, NearestFilter, RepeatWrapping, RGBAFormat, Texture, Vector2 } from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvas2d, colourTexture, heightToNormal, MARK_FONT, mirroredCopy, ringText } from "./lettering";

export const IN = 0.0254;
export type Tread = "AT" | "MT";

const CREASE = (40 * Math.PI) / 180;
/** carcass segments around the axle: round at 390 px, and the lug tops carry the silhouette anyway */
const SEG = 144;
/** longest block edge before it is split, inches, so tops follow the curve */
const MAX_EDGE = 1.1;

const SPEC = {
  // depth: tread depth, inches. pitch: target pitch length around the crown.
  // groove: circumferential groove width. shoulder: shoulder lug share of the
  // tread width, per side. rowW: centre row width that sets the row count.
  // voidF / shVoidF: lateral void share of a pitch, centre and shoulder.
  // slant: lateral void angle (a per t). bevel: block chamfer. sideLug:
  // lug height left standing on the sidewall. sipes: cuts per centre block.
  MT: { depth: 0.72, pitch: 4.2, groove: 0.6, shoulder: 0.2, rowW: 2.0, minRows: 2, maxRows: 3, voidF: 0.34, shVoidF: 0.36, slant: 0.34, bevel: 0.1, sideLug: 0.3, sipes: 0, words: "MUD TERRAIN   RADIAL   TUBELESS" },
  AT: { depth: 0.5, pitch: 3.0, groove: 0.34, shoulder: 0.17, rowW: 1.7, minRows: 2, maxRows: 4, voidF: 0.24, shVoidF: 0.27, slant: 0.24, bevel: 0.07, sideLug: 0.18, sipes: 2, words: "ALL TERRAIN   RADIAL   TUBELESS" },
} as const;

/** sidewall 0.62, tread walls and voids 0.78, worn block tops a little rougher */
export const RUBBER = { colour: 0x0b0b0b, sidewall: 0.62, tread: 0.78, top: 0.86 } as const;
// vertex shade per part (multiplies the colour): worn tops lighter, voids darker
const SHADE = [1.0, 0.55, 0.85, 1.3]; // sidewall, void, wall, top
const SIDE = 0, VOID = 1, WALL = 2, TOP = 3;

type P = [number, number]; // [axial, radius] inches

/* "37x13.50R24": the size the way it is moulded on the sidewall. */
export function sidewallLabel(od: number, section: number, rim: number): string {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10));
  return `${n(od)}x${section.toFixed(2)}R${n(rim)}`;
}

/* The tread's size rules, for tests and for makeTire: pitches around the
   crown and centre rows across it. */
export function treadLayout(od: number, section: number, tread: Tread) {
  const s = SPEC[tread];
  const C = Math.PI * od;
  const pitches = Math.max(16, 2 * Math.round(C / (2 * s.pitch)));
  const S2 = section / 2;
  const sideTopX = S2 - s.depth - 0.1;
  const tw = Math.min(S2 * 0.8, sideTopX - 0.3);
  const ws = s.shoulder * 2 * tw;
  const centre = 2 * tw - 2 * ws - 2 * s.groove;
  const rows = Math.max(s.minRows, Math.min(s.maxRows, Math.floor(centre / s.rowW)));
  return { pitches, rows, pitchIn: C / pitches, tw, ws, centre, sideTopX };
}

/* ---------- lettering ---------- */

/* The size string top and bottom and the moulding words left and right, on
   one ring, letter tops pointing out from the axle. rPx is the baseline
   centre radius, hPx the size string's cap height; the words are smaller and
   shrink further if they would run into the size string. */
function letteringTexture(label: string, words: string, rPx: number, hPx: number): { map: CanvasTexture; normal: DataTexture } | null {
  const N = 1024, c = canvas2d(N);
  if (!c) return null;
  const { ctx } = c;
  ctx.clearRect(0, 0, N, N);
  ctx.fillStyle = "rgba(196,198,202,0.34)";
  ringText(ctx, N, label, rPx, hPx, [-Math.PI / 2, Math.PI / 2]);
  const arc = (text: string, h: number) => {
    ctx.font = `700 ${Math.round(h)}px ${MARK_FONT}`;
    return [...text].reduce((acc, ch) => acc + ctx.measureText(ch).width + h * 0.18, 0) / rPx;
  };
  let h2 = hPx * 0.56;
  const room = Math.PI - arc(label, hPx) - 0.5; // radians left between the two size strings, less a gap each side
  const w2 = arc(words, h2);
  if (w2 > room) h2 *= Math.max(0.4, room / w2);
  ringText(ctx, N, words, rPx, h2, [0, Math.PI]);
  const map = colourTexture(c.canvas, "sidewall-" + label);
  const normal = heightToNormal(ctx, N, N, 6, { alpha: true, flipY: true, name: "sidewall-emboss" });
  return { map, normal };
}

/* ---------- rubber ---------- */

/* 1x4 roughness map, read through uv1 with nearest filtering: one row per
   part. */
function regionMap(): DataTexture {
  const vals = [RUBBER.sidewall, RUBBER.tread, RUBBER.tread, RUBBER.top];
  const d = new Uint8Array(16);
  vals.forEach((v, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.round(v * 255); d[i * 4 + 3] = 255; });
  const t = new DataTexture(d, 1, 4, RGBAFormat);
  t.magFilter = t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.channel = 1;
  t.needsUpdate = true;
  t.name = "rubber-region";
  return t;
}

/* Fine moulded grain: blurred value noise as a height field, turned into a
   tangent-space normal map. Seeded, so every build looks the same. */
function grainNormal(): DataTexture {
  const W = 256;
  let seed = 0x2f6b1d;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let h = new Float32Array(W * W).map(() => rnd());
  for (let pass = 0; pass < 2; pass++) {
    const o = new Float32Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) acc += h[((y + dy + W) % W) * W + ((x + dx + W) % W)];
      o[y * W + x] = acc / 9;
    }
    h = o;
  }
  const out = new Uint8Array(W * W * 4), k = 7;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const H = (xx: number, yy: number) => h[((yy + W) % W) * W + ((xx + W) % W)];
    const nx = -(H(x + 1, y) - H(x - 1, y)) * k, ny = -(H(x, y + 1) - H(x, y - 1)) * k, l = Math.hypot(nx, ny, 1);
    const i = (y * W + x) * 4;
    out[i] = Math.round((nx / l * 0.5 + 0.5) * 255);
    out[i + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
    out[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
    out[i + 3] = 255;
  }
  const t = new DataTexture(out, W, W, RGBAFormat);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  t.name = "rubber-grain";
  return t;
}

/* Rubber: near black, no metal, a faint sheen at grazing angles and a
   weaker specular than the default dielectric, so a sunlit sidewall reads as
   soft black instead of grey plastic. Roughness comes from the region map. */
function rubber(): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: new Color(RUBBER.colour), metalness: 0, roughness: 1, specularIntensity: 0.55,
    sheen: 0.06, sheenRoughness: 0.6, sheenColor: new Color(0x161616), vertexColors: true,
  });
  m.roughnessMap = regionMap();
  m.normalMap = grainNormal();
  m.normalScale.set(0.35, 0.35);
  m.name = "rubber";
  return m;
}

const MIRRORED = new WeakMap<Material, Material>();

/** The read-the-right-way-round material for a decal on a mirrored corner. */
export function sidewallMirrored(m: Material): Material | undefined { return MIRRORED.get(m); }

/* ---------- geometry ---------- */

/** grain tile, inches */
const GRAIN = 1.6;

export function makeTire(od: number, section: number, rim: number, tread: Tread, rimWidthIn?: number, label?: string): Mesh {
  const s = SPEC[tread];
  const lay = treadLayout(od, section, tread);
  const Rt = od / 2, rb = rim / 2, S2 = section / 2, D = s.depth, Rb = Rt - D;
  const bx = rimWidthIn ? Math.min(rimWidthIn / 2 - 0.5, S2 - 0.6) : section * 0.42;
  const x0 = bx + 0.25, r0 = rb + 0.35;
  const { tw, sideTopX } = lay;
  const shR = Math.min(1.2, Math.max(0.5, 0.2 * (Rb - r0))); // shoulder radius, radial
  const rTop = Rb - shR; // where the shoulder meets the sidewall
  const ax = sideTopX - tw;

  /* sidewall, u = 0 at the bead flange to 1 at the shoulder: out to the
     section width at 42 percent, back in to sideTopX with a vertical tangent */
  const B = 0.42, e = (sideTopX - x0) / (S2 - x0);
  const bulge = (u: number) => {
    if (u <= B) return Math.sin((Math.PI / 2) * (u / B));
    const w = (u - B) / (1 - B);
    return 1 - (1 - e) * w * w * (3 - 2 * w);
  };
  const sideX = (u: number) => x0 + (S2 - x0) * bulge(u);
  // rim guard: a rounded ridge standing 0.26 in off the lower sidewall
  const rg = r0 + Math.min(0.55, 0.13 * (rTop - r0)), gH = 0.26, gW = 0.3;
  const guard = (r: number) => gH * Math.sqrt(Math.max(0, 1 - ((r - rg) / gW) ** 2));

  /* half profile, tread centre outward to the bead: [x, r, region] */
  const half: [number, number, number][] = [];
  for (const f of [0, 0.5, 1]) half.push([tw * f, Rb, VOID]);
  for (const deg of [72, 54, 36, 18, 0]) {
    const f = (deg * Math.PI) / 180;
    half.push([tw + ax * Math.cos(f), rTop + shR * Math.sin(f), VOID]);
  }
  const us = new Set<number>();
  for (let k = 0; k < 16; k++) us.add(k / 16);
  for (const g of [1, 0.75, 0.4, 0, -0.4, -0.75, -1]) {
    const u = (rg + g * gW - r0) / (rTop - r0);
    if (u > 0 && u < 1) us.add(u);
  }
  for (const u of [...us].sort((p, q) => q - p)) {
    if (u >= 1) continue;
    const r = r0 + u * (rTop - r0);
    half.push([Math.min(S2, sideX(u) + guard(r)), r, SIDE]);
  }
  half.push([bx, rb, SIDE]);

  // arc length and smoothed outward normals along the half profile
  const n = half.length, tArr = [0], nx: number[] = [], nr: number[] = [];
  for (let j = 1; j < n; j++) tArr.push(tArr[j - 1] + Math.hypot(half[j][0] - half[j - 1][0], half[j][1] - half[j - 1][1]));
  const segN = (j: number): P => { // outward normal of segment j..j+1: (-dr, dx)
    const dx = half[j + 1][0] - half[j][0], dr = half[j + 1][1] - half[j][1], l = Math.hypot(dx, dr) || 1;
    return [-dr / l, dx / l];
  };
  for (let j = 0; j < n; j++) {
    const a = j > 0 ? segN(j - 1) : segN(0), b = j < n - 1 ? segN(j) : segN(n - 2);
    const vx = a[0] + b[0], vr = a[1] + b[1], l = Math.hypot(vx, vr) || 1;
    nx.push(vx / l); nr.push(vr / l);
  }
  const tShEnd = tArr[7]; // the shoulder's last point, where the sidewall starts
  const sideLen = tArr[n - 2] - tShEnd;

  /* the carcass surface at arc length t (signed), offset h along its normal */
  const at = (t: number): [number, number, number, number] => {
    const ta = Math.min(Math.abs(t), tArr[n - 1]);
    let j = 0;
    while (j < n - 2 && tArr[j + 1] < ta) j++;
    const f = (ta - tArr[j]) / (tArr[j + 1] - tArr[j] || 1);
    const x = half[j][0] + f * (half[j + 1][0] - half[j][0]), r = half[j][1] + f * (half[j + 1][1] - half[j][1]);
    let vx = nx[j] + f * (nx[j + 1] - nx[j]), vr = nr[j] + f * (nr[j + 1] - nr[j]);
    const l = Math.hypot(vx, vr) || 1; vx /= l; vr /= l;
    return t < 0 ? [-x, r, -vx, vr] : [x, r, vx, vr];
  };
  type W = [number, number, number, number, number]; // x y z, uv0
  const world = (a: number, t: number, h: number): W => {
    const [x, r, vx, vr] = at(t), R = r + h * vr, th = a / Rt;
    return [x + h * vx, R * Math.cos(th), R * Math.sin(th), (a * R) / Rt / GRAIN, (t + h) / GRAIN];
  };

  const pos: number[] = [], uv0: number[] = [], uv1: number[] = [], col: number[] = [];
  const tri = (A: W, Bv: W, Cv: W, hint: number[], region: number) => {
    const ux = Bv[0] - A[0], uy = Bv[1] - A[1], uz = Bv[2] - A[2];
    const vx = Cv[0] - A[0], vy = Cv[1] - A[1], vz = Cv[2] - A[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const order = cx * hint[0] + cy * hint[1] + cz * hint[2] >= 0 ? [A, Bv, Cv] : [A, Cv, Bv];
    const v = (region + 0.5) / 4, sh = SHADE[region];
    for (const p of order) { pos.push(p[0], p[1], p[2]); uv0.push(p[3], p[4]); uv1.push(0.5, v); col.push(sh, sh, sh); }
  };
  const quad = (p0: W, p1: W, p2: W, p3: W, hint: number[], region: number) => { tri(p0, p1, p2, hint, region); tri(p0, p2, p3, hint, region); };
  const sub = (p: W, q: W) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];

  /* carcass: the full profile, inboard bead to outboard bead, lathed */
  const prof: { t: number; region: number }[] = [];
  for (let j = n - 1; j > 0; j--) prof.push({ t: -tArr[j], region: half[j][2] });
  for (let j = 0; j < n; j++) prof.push({ t: tArr[j], region: half[j][2] });
  const C = 2 * Math.PI * Rt;
  for (let i = 0; i < SEG; i++) {
    const a0 = (C * i) / SEG, a1 = (C * (i + 1)) / SEG;
    for (let j = 0; j < prof.length - 1; j++) {
      const { t: ta, region: ra } = prof[j], { t: tb, region: rbg } = prof[j + 1];
      const tm = (ta + tb) / 2, am = (a0 + a1) / 2;
      const hint = sub(world(am, tm, 1), world(am, tm, 0));
      quad(world(a0, ta, 0), world(a1, ta, 0), world(a1, tb, 0), world(a0, tb, 0), hint, ra === SIDE && rbg === SIDE ? SIDE : VOID);
    }
  }

  /* lug height at t: full depth across the tread and shoulder, easing down
     to the sidewall lug height, and never past the section width */
  const height = (t: number) => {
    const ta = Math.abs(t);
    let h: number = D;
    if (ta > tShEnd) { const w = Math.min(1, (ta - tShEnd) / 0.8); h = D + (s.sideLug - D) * w * w * (3 - 2 * w); }
    const [x, , vx] = at(t);
    if (Math.abs(vx) > 0.05) h = Math.min(h, (S2 - 0.01 - Math.abs(x)) / Math.abs(vx));
    return h;
  };

  /* one beveled block: q is four (a, t) corners */
  let blocks = 0;
  const SINK = -0.12, bev = s.bevel;
  const block = (q: P[]) => {
    blocks++;
    let area = 0;
    for (let i = 0; i < 4; i++) { const [a1, t1] = q[i], [a2, t2] = q[(i + 1) % 4]; area += a1 * t2 - a2 * t1; }
    const c = area < 0 ? [q[0], q[3], q[2], q[1]] : q; // counter-clockwise in (a, t)
    const len = (p: P, r: P) => Math.hypot(p[0] - r[0], p[1] - r[1]);
    const n01 = Math.max(1, Math.ceil(Math.max(len(c[0], c[1]), len(c[3], c[2])) / MAX_EDGE));
    const n12 = Math.max(1, Math.ceil(Math.max(len(c[1], c[2]), len(c[0], c[3])) / MAX_EDGE));
    // inset corners: each edge moved inward by the bevel, neighbours intersected
    const ins: P[] = [];
    for (let i = 0; i < 4; i++) {
      const pPrev = c[(i + 3) % 4], p = c[i], pNext = c[(i + 1) % 4];
      const e1 = [p[0] - pPrev[0], p[1] - pPrev[1]], e2 = [pNext[0] - p[0], pNext[1] - p[1]];
      const l1 = Math.hypot(e1[0], e1[1]), l2 = Math.hypot(e2[0], e2[1]);
      const n1 = [-e1[1] / l1, e1[0] / l1], n2 = [-e2[1] / l2, e2[0] / l2]; // left normals point inside
      const m = [n1[0] + n2[0], n1[1] + n2[1]], dot = 1 + n1[0] * n2[0] + n1[1] * n2[1];
      const k = bev / Math.max(0.2, dot);
      ins.push([p[0] + m[0] * k, p[1] + m[1] * k]);
    }
    const bil = (cs: P[], u: number, w: number): P => {
      const a0 = cs[0][0] + (cs[1][0] - cs[0][0]) * u, t0 = cs[0][1] + (cs[1][1] - cs[0][1]) * u;
      const a1 = cs[3][0] + (cs[2][0] - cs[3][0]) * u, t1 = cs[3][1] + (cs[2][1] - cs[3][1]) * u;
      return [a0 + (a1 - a0) * w, t0 + (t1 - t0) * w];
    };
    const top = (cs: P[], u: number, w: number, drop: number): W => { const [a, t] = bil(cs, u, w); return world(a, t, Math.max(height(t), bev + 0.06) - drop); };
    // top grid
    for (let i = 0; i < n01; i++) for (let j = 0; j < n12; j++) {
      const u0 = i / n01, u1 = (i + 1) / n01, w0 = j / n12, w1 = (j + 1) / n12;
      const [am, tm] = bil(ins, (u0 + u1) / 2, (w0 + w1) / 2), hm = height(tm);
      quad(top(ins, u0, w0, 0), top(ins, u1, w0, 0), top(ins, u1, w1, 0), top(ins, u0, w1, 0), sub(world(am, tm, hm + 1), world(am, tm, hm)), TOP);
    }
    // perimeter, counter-clockwise: chamfer then wall per segment
    const per: [number, number, number][] = []; // u, w, edge
    for (let k = 0; k < n01; k++) per.push([k / n01, 0, 0]);
    for (let k = 0; k < n12; k++) per.push([1, k / n12, 1]);
    for (let k = 0; k < n01; k++) per.push([1 - k / n01, 1, 2]);
    for (let k = 0; k < n12; k++) per.push([0, 1 - k / n12, 3]);
    for (let k = 0; k < per.length; k++) {
      const [ua, wa, edge] = per[k], [ub, wb] = per[(k + 1) % per.length];
      const um = (ua + ub) / 2, wm = (wa + wb) / 2;
      const [am, tm] = bil(c, um, wm), [ar, tr] = edge % 2 === 0 ? bil(c, um, 0.5) : bil(c, 0.5, wm);
      const hm = height(tm) - bev;
      const hint = sub(world(am, tm, hm), world(ar, tr, hm));
      quad(top(ins, ua, wa, 0), top(ins, ub, wb, 0), top(c, ub, wb, bev), top(c, ua, wa, bev), hint, TOP);
      const [aa, ta] = bil(c, ua, wa), [ab, tb] = bil(c, ub, wb);
      quad(top(c, ua, wa, bev), top(c, ub, wb, bev), world(ab, tb, SINK), world(aa, ta, SINK), hint, WALL);
    }
  };

  /* ---------- tread layout ---------- */
  const N = lay.pitches, p = C / N, rows = lay.rows;
  const tIn = tw - lay.ws; // inner edge of the shoulder lugs
  const rw = (lay.centre - (rows - 1) * s.groove) / rows;
  const cHalf = lay.centre / 2;
  const mt = tread === "MT";
  for (let k = 0; k < rows; k++) {
    const t0 = -cHalf + k * (rw + s.groove), t1 = t0 + rw, tm = (t0 + t1) / 2;
    const mid = (rows - 1) / 2, dir = k < mid ? 1 : k > mid ? -1 : 1;
    const sk = (t: number) => (mt ? dir : k % 2 ? 1 : -1) * s.slant * (t - tm);
    const phase = (k % 2) * p / 2;
    const L = p * (1 - s.voidF);
    for (let i = 0; i < N; i++) {
      const aS = i * p + phase;
      const q = (a0: number, a1: number, ta: number, tb: number): P[] => [[a0 + sk(ta), ta], [a1 + sk(ta), ta], [a1 + sk(tb), tb], [a0 + sk(tb), tb]];
      if (mt) {
        // stepped block: a full-width front and a narrower tail stepping into one groove
        const cut = aS + 0.58 * L, nar = 0.3 * rw;
        block(q(aS, cut, t0, t1));
        if ((i + k) % 2) block(q(cut, aS + L, t0 + nar, t1)); else block(q(cut, aS + L, t0, t1 - nar));
      } else {
        // interlocking block cut by sipes
        const gap = 0.09, sl = (L - s.sipes * gap) / (s.sipes + 1);
        for (let m = 0; m <= s.sipes; m++) { const a0 = aS + m * (sl + gap); block(q(a0, a0 + sl, t0, t1)); }
      }
    }
  }
  // shoulder lugs, both sides, the inboard row half a pitch behind
  for (const sg of [1, -1]) {
    const phase = p * (sg > 0 ? 0.25 : 0.75);
    const La = p * (1 - s.shVoidF);
    for (let i = 0; i < N; i++) {
      const aS = i * p + phase, lean = 0.12 * p;
      const long = i % 2 === 0;
      if (mt) {
        // over the shoulder, then a scalloped sidewall lug, long and short in turn
        block([[aS, sg * tIn], [aS + La, sg * tIn], [aS + La + lean, sg * tShEnd], [aS + lean, sg * tShEnd]]);
        const Ls = (long ? 0.3 : 0.17) * sideLen, a0 = aS + lean + 0.06 * La;
        block([[a0 + 0.1 * La, sg * tShEnd], [a0 + 0.9 * La, sg * tShEnd], [a0 + 0.78 * La + lean * 0.5, sg * (tShEnd + Ls)], [a0 + 0.22 * La + lean * 0.5, sg * (tShEnd + Ls)]]);
      } else {
        // a sipe down the middle; long ones reach just over the shoulder
        const tEnd = long ? tShEnd + 0.4 : tShEnd - 0.1, gap = 0.09, half2 = (La - gap) / 2;
        for (const a0 of [aS, aS + half2 + gap]) block([[a0, sg * tIn], [a0 + half2, sg * tIn], [a0 + half2 + lean, sg * tEnd], [a0 + lean, sg * tEnd]]);
      }
    }
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv0, 2));
  g.setAttribute("uv1", new Float32BufferAttribute(uv1, 2));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  const geo: BufferGeometry = toCreasedNormals(g, CREASE);
  geo.scale(IN, IN, IN);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  const mesh = new Mesh(geo, rubber());
  mesh.name = "tire";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    tread, grooves: rows + 1, grooveDepthIn: D, pitches: N, rows, blocks, triangles: pos.length / 9,
    beadRadiusM: rb * IN, odIn: od, sectionIn: section, rimIn: rim,
  };

  /* Sidewall lettering decal: the outboard sidewall between 24 and 80
     percent of its height, 0.04 in proud, with planar UVs over the face. */
  const text = label ?? sidewallLabel(od, section, rim);
  const band: Vector2[] = [];
  // outer to inner, the same direction as the tire's outboard wall, so the
  // lathe winds its faces outward (inner to outer is culled from outside)
  for (let k = 16; k >= 0; k--) {
    const u = 0.24 + (0.56 * k) / 16;
    band.push(new Vector2(r0 + u * (rTop - r0), sideX(u) + 0.04));
  }
  const rText = r0 + 0.5 * (rTop - r0), pxPerIn = 512 / Rt;
  const lt = letteringTexture(text, s.words, rText * pxPerIn, Math.min(0.24 * (rTop - r0), 1.3) * pxPerIn);
  const tex = lt?.map;
  if (tex) {
    const dg = new LatheGeometry(band, 128);
    dg.rotateZ(-Math.PI / 2); // lathe height onto +X (outboard): X = h, Y = -r sin, Z = r cos
    const pa = dg.attributes.position, uv = dg.attributes.uv;
    // Seen from +X with +Y up, screen right is -Z, so u runs along -Z.
    for (let i = 0; i < pa.count; i++) uv.setXY(i, 0.5 - pa.getZ(i) / (2 * Rt), 0.5 + pa.getY(i) / (2 * Rt));
    dg.scale(IN, IN, IN);
    dg.computeBoundingBox();
    dg.computeBoundingSphere();
    const mk = (map: Texture, normalMap: Texture) => {
      const m = new MeshStandardMaterial({ map, normalMap, transparent: true, depthWrite: false, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      m.name = "sidewall";
      return m;
    };
    const front = mk(tex, lt!.normal);
    MIRRORED.set(front, mk(mirroredCopy(tex), mirroredCopy(lt!.normal)));
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
  const rm = mesh.material as MeshPhysicalMaterial;
  rm.map?.dispose(); rm.normalMap?.dispose(); rm.roughnessMap?.dispose();
  rm.dispose();
  const d = mesh.getObjectByName("sidewall") as Mesh | undefined;
  if (!d) return;
  d.geometry.dispose();
  const m0 = d.material as MeshStandardMaterial;
  for (const m of [m0, MIRRORED.get(m0) as MeshStandardMaterial | undefined]) {
    if (!m) continue;
    m.map?.dispose();
    m.normalMap?.dispose();
    m.dispose();
  }
}

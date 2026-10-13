/* Parametric tire, scaled from the size string's numbers (od, section, rim,
   all inches). Axle on X, centred on the origin, same frame as makeWheel.

   The cross-section is lathed: bead on the rim radius, sidewall bulging out
   to the section width, a rounded shoulder, a flat tread band with
   circumferential grooves cut into the profile, and a raised rim-guard ring
   low on each sidewall. Lateral shoulder voids are then pushed in ring by
   ring, so the tire reads as a tire in silhouette. Mud-terrain gets fewer,
   deeper grooves and staggered shoulder blocks; all-terrain gets more,
   shallower grooves and small shoulder notches.

   The tread band carries a procedural normal, roughness and colour map drawn
   on a 1024x256 canvas (treadMaps): the blocks between the geometry's
   grooves, lateral voids phased to line up with the pushed-in shoulder rings,
   interlocking blocks with sipes for AT, big staggered lugs with deep voids
   for MT. The lathe's v is rewritten so the tread and shoulders span the
   texture and every sidewall vertex lands on its plain edge rows: rubber
   roughness 0.78 on the tread, 0.62 on the smoother sidewall, voids darker.

   The outboard sidewall carries the size string (e.g. 37x13.50R24) as a
   thin decal mesh that follows the sidewall bulge a hair proud of it. The
   lettering is drawn twice around a ring on a 1024px canvas, tops outward
   the way a tire is moulded, and mapped by planar UVs across the wheel
   face. It is light grey at low opacity: legible at the Wheel preset, lost
   in the mip chain at whole-truck distances. A normal map drawn from the
   same letters embosses them. Mirrored corners swap in
   sidewallMirrored(decal material) so the text never reads backwards. (Not
   kept in userData: Object3D.clone deep-copies userData through JSON, which
   would turn a material into a plain object.) Without a 2D
   canvas (tests under jsdom) the decal is left out.

   Built in inches and scaled last, for the same reason as wheel.ts. */
import { BufferGeometry, CanvasTexture, ClampToEdgeWrapping, Color, DataTexture, LatheGeometry, LinearFilter, LinearMipmapLinearFilter, Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace, Texture, Vector2 } from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvas2d, colourTexture, heightToNormal, mirroredCopy, ringText, type Ctx } from "./lettering";

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

/* The size string twice around a ring, top and bottom, letter tops pointing
   out from the axle. rPx is the baseline-centre radius, hPx the cap height.
   Returns the colour texture and an embossing normal map of the same
   letters. */
function letteringTexture(label: string, rPx: number, hPx: number): { map: CanvasTexture; normal: DataTexture } | null {
  const N = 1024, c = canvas2d(N);
  if (!c) return null;
  const { ctx } = c;
  ctx.clearRect(0, 0, N, N);
  ctx.fillStyle = "rgba(196,198,202,0.34)";
  ringText(ctx, N, label, rPx, hPx, [-Math.PI / 2, Math.PI / 2]);
  const map = colourTexture(c.canvas, "sidewall-" + label);
  const normal = heightToNormal(ctx, N, N, 6, { alpha: true, flipY: true, name: "sidewall-emboss" });
  return { map, normal };
}

/* ---------- tread maps ---------- */

/** v of the tread band: the shoulders' outer edges sit at 0.05 and 0.95; sidewall vertices sample the plain rows at 0.004 and 0.996 */
const BAND = 0.45;

interface TreadPlan { grooveV: number[]; grooveW: number; pitches: number }

/* Height field of one strip of tread, white high, drawn with y = v * H.
   Ribs are the bands between the geometry's grooves; each rib gets one
   lateral void per pitch, centred at a quarter pitch on even ribs and three
   quarters on odd ones, so neighbouring ribs interlock and the shoulder ribs
   line up with the shoulder rings tire geometry pushes in. */
function drawTread(ctx: Ctx, W: number, H: number, tread: Tread, plan: TreadPlan, per: number) {
  const pp = W / per; // pixels per pitch
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#c8c8c8"; // shoulder and sidewall rows, smooth
  ctx.fillRect(0, 0, W, H * 0.05);
  ctx.fillRect(0, H * 0.95, W, H * 0.05 + 1);
  const ribs: [number, number][] = [];
  let lo = 0.05;
  for (const g of plan.grooveV) { ribs.push([lo, g - plan.grooveW / 2]); lo = g + plan.grooveW / 2; }
  ribs.push([lo, 0.95]);
  const mt = tread === "MT";
  ribs.forEach(([v0, v1], r) => {
    const shoulder = r === 0 || r === ribs.length - 1;
    const voidW = mt ? (shoulder ? 0.42 : 0.3) : (shoulder ? 0.22 : 0.15);
    const phase = r % 2 ? 0.75 : 0.25;
    const slant = (mt ? 0.12 : 0.08) * (r < ribs.length / 2 ? 1 : -1);
    for (let p = -1; p <= per; p++) {
      // the block runs from the end of this pitch's void to the start of the next one
      const u0 = (p + phase + voidW / 2) * pp, u1 = (p + 1 + phase - voidW / 2) * pp;
      let a = v0, b = v1;
      // MT shoulder lugs are staggered: every other one reaches further onto the shoulder
      if (mt && shoulder && p % 2 === 0) { if (r === 0) a = 0.025; else b = 0.975; }
      const y0 = a * H, y1 = b * H, sk = slant * pp;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(u0 - sk, y0); ctx.lineTo(u1 - sk, y0); ctx.lineTo(u1 + sk, y1); ctx.lineTo(u0 + sk, y1);
      ctx.closePath();
      ctx.fill();
      const um = (u0 + u1) / 2;
      if (mt) {
        // a stepped notch in the middle of each big lug
        ctx.fillStyle = "#5a5a5a";
        ctx.fillRect(um - pp * 0.04, (y0 + y1) / 2 - (y1 - y0) * 0.18, pp * 0.08, (y1 - y0) * 0.36);
      } else {
        // two zigzag sipes across each block
        ctx.strokeStyle = "#6e6e6e";
        ctx.lineWidth = 2.2;
        for (const f of [0.36, 0.64]) {
          const ux = u0 + (u1 - u0) * f;
          ctx.beginPath();
          const n = 5;
          for (let k = 0; k <= n; k++) {
            const y = y0 + ((y1 - y0) * (0.12 + 0.76 * k / n)), x = ux + (k % 2 ? 3 : -3) + sk * (2 * (y - y0) / (y1 - y0) - 1);
            if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    }
  });
}

function treadMaps(tread: Tread, plan: TreadPlan): { normal: DataTexture; rough: DataTexture; colour: DataTexture } | null {
  const W = 1024, H = 256, per = 8, c = canvas2d(W, H);
  if (!c) return null;
  const { ctx } = c;
  drawTread(ctx, W, H, tread, plan, per);
  const normal = heightToNormal(ctx, W, H, tread === "MT" ? 3.2 : 2.4, { wrapX: true, name: "tread-normal" });
  normal.wrapT = ClampToEdgeWrapping;
  const src = ctx.getImageData(0, 0, W, H).data;
  const rough = new Uint8Array(W * H * 4), colour = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const side = y < H * 0.015 || y >= H * 0.985;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, hgt = src[i] / 255;
      const r = side ? 0.62 : 0.9 - 0.12 * hgt; // 0.78 on block tops, rougher in the voids
      const k = side ? 1 : 0.5 + 0.5 * hgt; // voids a shade darker
      rough[i] = rough[i + 1] = rough[i + 2] = Math.round(r * 255); rough[i + 3] = 255;
      colour[i] = colour[i + 1] = colour[i + 2] = Math.round(k * 255); colour[i + 3] = 255;
    }
  }
  const mk = (d: Uint8Array, name: string) => {
    const t = new DataTexture(d, W, H, RGBAFormat);
    t.wrapS = RepeatWrapping;
    t.magFilter = LinearFilter;
    t.minFilter = LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    t.name = name;
    return t;
  };
  const out = { normal, rough: mk(rough, "tread-rough"), colour: mk(colour, "tread-colour") };
  out.colour.colorSpace = SRGBColorSpace;
  for (const t of Object.values(out)) t.repeat.x = plan.pitches / per;
  return out;
}

/* Rubber: near black, no metal, a faint sheen at grazing angles and a
   weaker specular than the default dielectric, so a sunlit sidewall reads as
   soft black instead of grey plastic. With the tread maps the roughness
   comes from the map (0.78 tread, 0.62 sidewall). */
function rubber(maps: ReturnType<typeof treadMaps>): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: new Color(0x0b0b0b), metalness: 0, roughness: maps ? 1 : 0.78, specularIntensity: 0.55,
    sheen: 0.06, sheenRoughness: 0.6, sheenColor: new Color(0x161616),
  });
  if (maps) {
    m.map = maps.colour;
    m.normalMap = maps.normal;
    m.roughnessMap = maps.rough;
  }
  m.name = "rubber";
  return m;
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
  // rim guard: a rounded ring standing 0.18 in off the lower sidewall
  const rg = r0 + Math.min(0.4, 0.08 * (r1 - r0)), gW = 0.28;
  const guard = (r: number) => 0.18 * Math.max(0, 1 - ((r - rg) / gW) ** 2);
  for (const t of [0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
    const bulge = t <= 0.5 ? Math.sin((Math.PI / 2) * (t / 0.5)) : 1 - (1 - e) * ((t - 0.5) / 0.5) ** 2;
    const r = r0 + t * (r1 - r0);
    half.push([-(x0 + (S2 - x0) * bulge + guard(r)), r]);
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
  // v: tread and shoulders across the band, sidewalls on the edge rows
  const uvs = g.attributes.uv;
  const vOf = profile.map(([x, r]) => (r >= Rt - sh - 0.01 ? 0.5 + (BAND * x) / sideEnd : x < 0 ? 0.004 : 0.996));
  for (let i = 0; i <= s.segments; i++) for (let j = 0; j < P; j++) uvs.setY(i * P + j, vOf[j]);
  g.rotateZ(-Math.PI / 2);
  const geo: BufferGeometry = toCreasedNormals(g, CREASE);
  geo.scale(IN, IN, IN);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  const grooveV: number[] = [];
  for (let i = 0; i < s.grooves; i++) grooveV.push(0.5 + (BAND * (-tw + gap * (i + 1))) / sideEnd);
  const maps = treadMaps(tread, { grooveV, grooveW: (BAND * s.gw) / sideEnd, pitches: s.pitches });
  const mesh = new Mesh(geo, rubber(maps));
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
  const lt = letteringTexture(text, rText * pxPerIn, Math.min(0.24 * (r1 - r0), 1.3) * pxPerIn);
  const tex = lt?.map;
  if (tex) {
    const dg = new LatheGeometry(band, 128);
    dg.rotateZ(-Math.PI / 2); // lathe height onto +X (outboard): X = h, Y = -r sin, Z = r cos
    const p = dg.attributes.position, uv = dg.attributes.uv;
    // Seen from +X with +Y up, screen right is -Z, so u runs along -Z.
    for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 - p.getZ(i) / (2 * Rt), 0.5 + p.getY(i) / (2 * Rt));
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

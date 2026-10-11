/* Brake rotor and caliper, the dark steel that shows through the spoke
   windows. Same frame as makeWheel: metres, axle on X, outboard +X.

   The group's origin is on the axle at the hat's outboard face, and every
   part sits inboard of it (x <= 0), so WheelSet drops it at the back of the
   wheel's hub (wheel userData.hubBackIn) and it fills the barrel behind the
   face. caliperSide is the side of the axle the caliper sits on along Z:
   -1 behind the axle (trailing), +1 ahead of it.

   Built in inches and scaled last, for the same reason as wheel.ts. */
import { BufferGeometry, ExtrudeGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, Shape, Vector2 } from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const IN = 0.0254;
const CREASE = (40 * Math.PI) / 180;

/* The rotor diameter for a wheel: about 70 percent of the wheel, but always
   small enough that the caliper clears the barrel's drop centre (inner wall
   R - 2.15 in, see wheel.ts) with a little air. */
export function rotorDiaFor(wheelDiaIn: number): number {
  const R = wheelDiaIn / 2;
  return Math.min(wheelDiaIn * 0.7, 2 * (R - 2.15 - 0.25 - CALIPER_REACH));
}

/** how far the caliper reaches past the rotor edge, inches */
export const CALIPER_REACH = 0.55;
export const ROTOR_T = 1.25; // vented rotor thickness, inches
export const HAT_DEPTH = 1.6; // hat face to the rotor's outboard friction face

type P = [number, number]; // [axial, radius] inches

function lathe(pts: P[], segments: number): BufferGeometry {
  const g = new LatheGeometry(pts.map(([ax, r]) => new Vector2(r, ax)), segments);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function finish(g: BufferGeometry): BufferGeometry {
  const out = toCreasedNormals(g, CREASE);
  out.scale(IN, IN, IN);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

export function makeBrake(rotorDiaIn: number, caliperSide: 1 | -1): Group {
  const R = rotorDiaIn / 2;
  const hatR = Math.max(3.2, R * 0.46);
  const bore = 2.6;
  const T = ROTOR_T, x0 = -HAT_DEPTH, x1 = x0 - T; // friction faces, outboard and inboard
  const group = new Group();
  group.name = "brake";

  /* Hat: the raised centre the wheel bolts against, a closed cup. */
  const hat: P[] = [
    [-0.25, bore], [0, bore + 0.2], [0, hatR - 0.3], [-0.2, hatR],
    [x0 + 0.1, hatR], [x0 + 0.1, hatR - 0.35], [-0.35, hatR - 0.35], [-0.35, bore + 0.1], [-0.25, bore],
  ];
  /* Disc: two friction faces with a shallow ring groove and chamfered edges.
     Drawn as a closed ring section, outboard face first. */
  const g0 = hatR + 0.15;
  const disc: P[] = [
    [x0, g0], [x0, R - 0.12], [x0 - 0.1, R], [x1 + 0.1, R], [x1, R - 0.12],
    [x1, g0 + 0.6], [x1 + 0.2, g0], [x0, g0],
  ];
  const steel = new MeshStandardMaterial({ color: 0x6a6d72, metalness: 0.85, roughness: 0.55 });
  steel.name = "rotor";
  const hatMat = new MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.6, roughness: 0.6 });
  hatMat.name = "rotor-hat";
  const caliperMat = new MeshStandardMaterial({ color: 0x1d1e21, metalness: 0.35, roughness: 0.42 });
  caliperMat.name = "caliper";

  const mk = (name: string, geo: BufferGeometry, mat: MeshStandardMaterial) => {
    const m = new Mesh(finish(geo), mat);
    m.name = name;
    m.castShadow = false;
    m.receiveShadow = false;
    group.add(m);
    return m;
  };
  mk("hat", lathe(hat, 64), hatMat);
  mk("rotor", lathe(disc, 96), steel);

  /* Caliper: an annular sector straddling the rotor edge, 52 degrees long,
     centred 28 degrees above horizontal on caliperSide. Shape space is the
     YZ plane (shape x = -Z after the turn), extruded along the axle. */
  const span = (52 * Math.PI) / 180, mid = (28 * Math.PI) / 180;
  const rIn = R - 2.1, rOut = R + CALIPER_REACH;
  const at = (r: number, a: number): [number, number] => {
    const z = caliperSide * r * Math.cos(a), y = r * Math.sin(a);
    return [-z, y];
  };
  const s = new Shape();
  const n = 16;
  for (let k = 0; k <= n; k++) { const a = mid - span / 2 + (span * k) / n; const [u, v] = at(rOut, a); if (k === 0) s.moveTo(u, v); else s.lineTo(u, v); }
  for (let k = n; k >= 0; k--) { const a = mid - span / 2 + (span * k) / n; const [u, v] = at(rIn, a); s.lineTo(u, v); }
  s.closePath();
  const depth = T + 1.5;
  const cal = new ExtrudeGeometry(s, { depth, steps: 1, curveSegments: 1, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelOffset: -0.25, bevelSegments: 2 });
  cal.translate(0, 0, (x0 + x1) / 2 - depth / 2);
  cal.rotateY(Math.PI / 2); // shape +z (extrusion) onto +X, shape x onto -Z
  mk("caliper", cal, caliperMat);

  group.userData = { rotorDiaIn, caliperSide, outerRadiusIn: rOut, depthIn: HAT_DEPTH + T + 0.75 };
  return group;
}

export function disposeBrake(g: Group) {
  g.traverse((c) => {
    const m = c as Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    (m.material as MeshStandardMaterial).dispose();
  });
}

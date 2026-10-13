import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Box3, MathUtils, PerspectiveCamera, ShaderLib, UniformsUtils, Vector3 } from "three";
import { ASPHALT, AO, SUN_INTENSITY, patchGroundShader, shadowMapSize, sunDirection } from "../src/scene/Outdoor";
import { CONTACT } from "../src/scene/Stage";
import { FOV, MAX_POLAR, PRESETS, framedView } from "../src/scene/cameras";

const PUBLIC = path.resolve(__dirname, "../public");

describe("asphalt ground", () => {
  it("ships three WebP maps under 260 KB each, under 800 KB together, with a license row", () => {
    let total = 0;
    for (const m of ["diff", "nor_gl", "rough"]) {
      const file = path.join(PUBLIC, "textures", `asphalt_02_${m}.webp`);
      const buf = fs.readFileSync(file);
      expect(buf.subarray(8, 12).toString("ascii")).toBe("WEBP");
      expect(buf.length).toBeLessThan(260 * 1024);
      total += buf.length;
    }
    expect(total).toBeLessThan(800 * 1024);
    const lic = fs.readFileSync(path.join(PUBLIC, "textures", "LICENSES.md"), "utf8");
    expect(lic).toMatch(/asphalt_02/);
    expect(lic).toMatch(/CC0/);
  });

  it("points at those files and repeats at the scan's real 3 m tile", () => {
    for (const u of ASPHALT.urls) expect(u).toMatch(/textures\/asphalt_02_(diff|nor_gl|rough)\.webp$/);
    expect(ASPHALT.tile).toBe(3);
    expect(ASPHALT.radius).toBeGreaterThan(ASPHALT.fadeTo);
    expect(ASPHALT.fadeFrom).toBeLessThan(ASPHALT.fadeTo);
  });

  it("patches the standard shader with a radial fade and anti-tiling, keeping the PBR chunks", () => {
    const src = ShaderLib.standard;
    const shader = { uniforms: UniformsUtils.clone(src.uniforms), vertexShader: src.vertexShader, fragmentShader: src.fragmentShader };
    patchGroundShader(shader as never);
    expect(shader.uniforms.fadeRange.value).toMatchObject({ x: ASPHALT.fadeFrom, y: ASPHALT.fadeTo });
    expect(shader.vertexShader).toContain("vGroundXZ = (modelMatrix");
    expect(shader.fragmentShader).toContain("smoothstep(fadeRange.x, fadeRange.y");
    expect(shader.fragmentShader).toContain("gNoise(vGroundXZ");
    expect(shader.fragmentShader).not.toContain("#include <map_fragment>");
    expect(shader.fragmentShader).toContain("#include <lights_fragment_begin>");
    expect(shader.fragmentShader).toContain("#include <shadowmap_pars_fragment>");
  });
});

describe("sun, shadow and occlusion", () => {
  it("keeps the sun about 18 degrees up and brighter than before", () => {
    const d = sunDirection();
    expect(MathUtils.radToDeg(Math.asin(d.y))).toBeCloseTo(18.2, 0);
    expect(SUN_INTENSITY).toBeGreaterThan(2.4);
  });
  it("uses a 4096 shadow map on desktop, 2048 on a small GPU", () => {
    expect(shadowMapSize(16384)).toBe(4096);
    expect(shadowMapSize(4096)).toBe(2048);
  });
  it("sizes ambient occlusion for a 6 m truck in metres", () => {
    expect(AO.radius).toBeGreaterThanOrEqual(0.4);
    expect(AO.radius).toBeLessThanOrEqual(0.6);
    expect(AO.intensity).toBeGreaterThanOrEqual(2);
    expect(AO.intensity).toBeLessThanOrEqual(3);
    expect(["low", "medium"]).toContain(AO.quality);
  });
  it("keeps the contact shadow tight and dark", () => {
    expect(CONTACT.blur).toBeLessThan(2);
    expect(CONTACT.opacity).toBeGreaterThan(0.8);
  });
});

describe("front hero camera", () => {
  const box = new Box3(new Vector3(-1.1, 0, -5.5), new Vector3(1.1, 2.3, 1.35));
  const r = 0.47, wx = 1.0;
  const wheelHeight = (aspect: number) => {
    const v = framedView("front", aspect, box);
    const cam = new PerspectiveCamera(FOV, aspect, 0.1, 200);
    cam.position.set(...v.position); cam.lookAt(new Vector3(...v.target)); cam.updateMatrixWorld();
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const p = new Vector3(wx, r + Math.sin(a) * r, Math.cos(a) * r).project(cam);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return { frac: (y1 - y0) / 2, eye: v.position[1] };
  };
  it("sits at eye height, level to half a degree down, inside the orbit limit", () => {
    const p = new Vector3(...PRESETS.front.position).sub(new Vector3(...PRESETS.front.target));
    const polar = Math.acos(p.y / p.length());
    expect(polar).toBeLessThanOrEqual(MAX_POLAR);
    expect(MathUtils.radToDeg(polar)).toBeGreaterThan(88.5);
    const desk = wheelHeight(862 / 612);
    expect(desk.eye).toBeGreaterThan(1.0);
    expect(desk.eye).toBeLessThan(1.35);
  });
  it("lets the front wheel fill over a quarter of the desktop frame height", () => {
    expect(wheelHeight(862 / 612).frac).toBeGreaterThan(0.25);
    expect(wheelHeight(390 / 395).frac).toBeGreaterThan(0.2);
  });
  it("uses a slightly long lens", () => {
    expect(FOV).toBeGreaterThanOrEqual(26);
    expect(FOV).toBeLessThanOrEqual(28);
  });
});

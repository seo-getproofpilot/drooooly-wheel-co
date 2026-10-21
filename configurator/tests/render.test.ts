import { describe, it, expect } from "vitest";
import { MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, Scene, ShaderLib, UniformsUtils, Vector2, Vector3, Vector4 } from "three";
import { applyVertexAO, hasVertexAO, patchVertexAOShader } from "../src/scene/vertexAO";
import { PlanarReflection, noReflect, patchReflectShader, reflectUniforms, withReflectionsOff } from "../src/scene/reflection";
import { patchGroundShader } from "../src/scene/Outdoor";
import { PAINT, paintKind, paintMaterial, setPaint } from "../src/scene/paint";
import { finishSet, MILLED_EDGE_ROUGHNESS } from "../src/materials/finishes";

type Shader = { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string };
const lib = (k: "physical" | "standard"): Shader => {
  const s = ShaderLib[k];
  return { uniforms: UniformsUtils.clone(s.uniforms), vertexShader: s.vertexShader, fragmentShader: s.fragmentShader };
};
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe("vertex AO hook", () => {
  it("reads the color attribute as occlusion on indirect diffuse, specular and clearcoat, and never tints", () => {
    const shader = lib("physical");
    patchVertexAOShader(shader as never, { value: 0.8 });
    expect(shader.uniforms.vertexAOIntensity.value).toBe(0.8);
    // declared only when three has not declared it (vertexColors off)
    expect(shader.vertexShader).toMatch(/#if !defined\( USE_COLOR \) && !defined\( USE_COLOR_ALPHA \)\s*attribute vec3 color;/);
    expect(shader.vertexShader).toContain("vVertexAO = color.r;");
    expect(shader.fragmentShader).not.toContain("#include <color_fragment>");
    expect(shader.fragmentShader).toContain("#include <aomap_fragment>");
    expect(shader.fragmentShader).toContain("reflectedLight.indirectDiffuse *= vertexAO;");
    expect(shader.fragmentShader).toContain("clearcoatSpecularIndirect *= vertexAO;");
    expect(shader.fragmentShader).toContain("sheenSpecularIndirect *= vertexAO;");
    expect(shader.fragmentShader).toContain("computeSpecularOcclusion(");
    // after the lights, where reflectedLight and the clearcoat terms exist
    expect(shader.fragmentShader.indexOf("vertexAO;")).toBeGreaterThan(shader.fragmentShader.indexOf("#include <lights_fragment_end>"));
    // direct light untouched
    expect(shader.fragmentShader).not.toMatch(/\bdirectDiffuse \*= vertexAO/);
  });

  it("patches a material once, falls back to AO 1 without the attribute, and keeps a prior hook", () => {
    const m = new MeshPhysicalMaterial({ clearcoat: 1 });
    let prior = 0;
    m.onBeforeCompile = () => { prior++; };
    const key0 = m.customProgramCacheKey();
    applyVertexAO(m, 0.9);
    applyVertexAO(m, 0.5); // second call only moves the intensity
    expect(hasVertexAO(m)).toBe(true);
    expect((m as unknown as { defaultAttributeValues: Record<string, number[]> }).defaultAttributeValues.color).toEqual([1, 1, 1]);
    expect(m.customProgramCacheKey()).toBe(key0 + "|vertex-ao");
    const shader = lib("physical");
    m.onBeforeCompile(shader as never, {} as never);
    expect(prior).toBe(1);
    expect(count(shader.fragmentShader, "reflectedLight.indirectDiffuse *= vertexAO;")).toBe(1);
    expect(shader.uniforms.vertexAOIntensity.value).toBe(0.5);
  });

  it("works on MeshStandardMaterial, where the clearcoat terms compile out", () => {
    const m = applyVertexAO(new MeshStandardMaterial());
    const shader = lib("standard");
    m.onBeforeCompile(shader as never, {} as never);
    expect(shader.fragmentShader).toContain("#if defined( USE_CLEARCOAT )\n    clearcoatSpecularIndirect *= vertexAO;");
  });
});

describe("asphalt reflection", () => {
  it("patches alongside the ground fade, swapping the mirror image in for environment radiance", () => {
    const shader = lib("standard"), u = reflectUniforms();
    patchGroundShader(shader as never);
    patchReflectShader(shader as never, u);
    expect(shader.uniforms.tReflect).toBe(u.tReflect);
    expect(shader.uniforms.fadeRange).toBeTruthy();
    expect(shader.vertexShader).toContain("vGroundXZ = (modelMatrix");
    expect(shader.vertexShader).toContain("vReflectUv = reflectMatrix * modelMatrix");
    const f = shader.fragmentShader;
    expect(f).toContain("radiance = radiance * ( 1.0 - mirrorImage.a ) + mirrorImage.rgb * reflectGain;");
    // before three applies Fresnel and roughness to `radiance`
    expect(f.indexOf("mirrorImage.rgb * reflectGain")).toBeGreaterThan(f.indexOf("#include <lights_fragment_maps>"));
    expect(f.indexOf("mirrorImage.rgb * reflectGain")).toBeLessThan(f.indexOf("#include <lights_fragment_end>"));
    expect(f).toContain("textureLod( tReflect");
    expect(u.reflectOn.value).toBe(0); // off until a pass has rendered
  });

  /* A stand-in renderer: enough of WebGLRenderer for the pass bookkeeping. */
  const fakeGl = () => {
    const seen: boolean[] = [];
    const gl = {
      shadowMap: { autoUpdate: true },
      getDrawingBufferSize: (v: Vector2) => v.set(1600, 1000),
      getRenderTarget: () => null, setRenderTarget: () => {}, getClearAlpha: () => 1, setClearAlpha: () => {}, clear: () => {},
      render: (scene: Scene) => { seen.push(scene.getObjectByName("sky")!.visible, scene.getObjectByName("truck")!.visible, gl.shadowMap.autoUpdate); },
    };
    return { gl, seen };
  };

  it("hides what must not reflect, skips the shadow pass, and restores everything", () => {
    const scene = new Scene();
    const sky = new Object3D(); sky.name = "sky"; noReflect(sky); scene.add(sky);
    const truck = new Object3D(); truck.name = "truck"; scene.add(truck);
    const cam = new PerspectiveCamera(27, 1.6, 0.1, 400); cam.position.set(4, 1.2, 6); cam.lookAt(0, 0.6, -2); cam.updateMatrixWorld();
    const u = reflectUniforms(), pr = new PlanarReflection(u, 0), { gl, seen } = fakeGl();
    pr.render(gl as never, scene, cam);
    expect(seen).toEqual([false, true, false]);
    expect(sky.visible).toBe(true);
    expect(gl.shadowMap.autoUpdate).toBe(true);
    expect(u.reflectOn.value).toBe(1);
    expect(pr.target.width).toBe(800); // half the drawing buffer
    withReflectionsOff(() => expect(u.reflectOn.value).toBe(0));
    expect(u.reflectOn.value).toBe(1);
    pr.dispose();
  });

  it("mirrors the camera under the ground: a ground point lands at the same height and mirrored across", () => {
    const cam = new PerspectiveCamera(27, 1.6, 0.1, 400); cam.position.set(3, 1.25, 7); cam.lookAt(0, 0.5, -2); cam.updateMatrixWorld();
    const u = reflectUniforms(), pr = new PlanarReflection(u, 0);
    pr.render(fakeGl().gl as never, (() => { const s = new Scene(); const a = new Object3D(); a.name = "sky"; const b = new Object3D(); b.name = "truck"; s.add(a, b); return s; })(), cam);
    expect(pr.camera.position.y).toBeCloseTo(-1.25, 6);
    for (const p of [new Vector3(0, 0, 0), new Vector3(1.2, 0, -3), new Vector3(-0.8, 0, 2)]) {
      const ndc = p.clone().project(cam);
      const r = new Vector4(p.x, p.y, p.z, 1).applyMatrix4(u.reflectMatrix.value);
      expect(r.x / r.w).toBeCloseTo(1 - (ndc.x * 0.5 + 0.5), 4);
      expect(r.y / r.w).toBeCloseTo(ndc.y * 0.5 + 0.5, 4);
    }
    // the oblique near plane is the ground: a point just under it is clipped, one above is not
    const clip = (y: number) => new Vector4(0.5, y, -1, 1).applyMatrix4(pr.camera.matrixWorldInverse).applyMatrix4(pr.camera.projectionMatrix);
    const under = clip(-0.05), over = clip(0.05);
    expect(under.z / under.w).toBeLessThan(-1);
    expect(over.z / over.w).toBeGreaterThan(-1);
    pr.dispose();
  });

  it("turns itself off when the camera is under the plane", () => {
    const cam = new PerspectiveCamera(); cam.position.set(0, -1, 5); cam.updateMatrixWorld();
    const u = reflectUniforms(), pr = new PlanarReflection(u, 0);
    pr.render(fakeGl().gl as never, new Scene(), cam);
    expect(u.reflectOn.value).toBe(0);
    pr.dispose();
  });
});

describe("paint kinds", () => {
  it("renders the factory solids without metal or flake and the rest as metallics", () => {
    for (const hex of ["#eef1f4", "#0d0f13", "#8e1b22", "#404a38"]) expect(paintKind(hex)).toBe("solid");
    for (const hex of ["#16181c", "#9aa1a9", "#4d5359", "#274a72", "#16324f", "#8a4a1e"]) expect(paintKind(hex)).toBe("metallic");
    expect(paintKind("#123456")).toBe("metallic");
    const white = paintMaterial("#eef1f4");
    expect(white.metalness).toBe(0);
    expect(white.normalScale.x).toBe(0);
    const silver = paintMaterial("#9aa1a9");
    expect(silver.metalness).toBeGreaterThan(0.5);
    expect(silver.normalScale.x).toBeGreaterThan(0);
    expect(silver.roughness).toBeLessThan(0.45); // smoother base under the coat than before
  });

  it("switches kind in place, keeping the flake map bound so the shader does not recompile", () => {
    const m = paintMaterial("#eef1f4");
    const map = m.normalMap, version = m.version;
    setPaint(m, "#16324f");
    expect(m.normalMap).toBe(map);
    expect(m.metalness).toBe(PAINT.metallic.metalness);
    expect(m.version).toBe(version); // no needsUpdate
    expect(m.color.getHexString()).toBe("16324f");
  });
});

describe("black milled edge", () => {
  it("is cut aluminium a touch softer than the polished face", () => {
    const s = finishSet("black-milled");
    expect(s.edge.roughness).toBe(MILLED_EDGE_ROUGHNESS);
    expect(MILLED_EDGE_ROUGHNESS).toBeGreaterThan(finishSet("polished").face.roughness);
    expect(MILLED_EDGE_ROUGHNESS).toBeLessThan(0.3);
  });
});


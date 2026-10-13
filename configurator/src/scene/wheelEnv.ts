/* A local environment for the wheels.

   With only the location HDRI as their environment, the polished lip and the
   inside of the barrel reflect open sky, so a wheel tucked under a fender
   glows blue-grey where a real one is dark: it sits in a wheel well, next to
   a tyre, over asphalt, under a painted fender.

   So each side of the truck gets a cube map captured at its front wheel
   centre with the wheels, tyres and brakes hidden (and the glass, whose
   transmission would cost a pass per face). The capture sees the fender, the
   well, the chassis, the ground and the sky past them, all in world space,
   so it holds for any camera. three turns it into a PMREM the next time a
   material reads it (CubeCamera flags needsPMREMUpdate), so rough finishes
   blur it correctly.

   Cost: six small draws per side and two PMREM builds, a few frames after
   any change and then every CAPTURE.every frames to follow paint and lift
   changes Truck makes without WheelSet knowing. Nothing per frame. */
import { CubeCamera, HalfFloatType, Object3D, WebGLCubeRenderTarget, type Scene, type Texture, type WebGLRenderer } from "three";
import { withReflectionsOff } from "./reflection";

export const CAPTURE = {
  /** cube face size, pixels: the PMREM blurs it anyway */
  size: 128,
  /** frames between refreshes once settled */
  every: 60,
  /** captures right after a change, while textures and shaders settle */
  settle: 3,
};

export class WheelEnv {
  readonly left: WebGLCubeRenderTarget;
  readonly right: WebGLCubeRenderTarget;
  private readonly camL: CubeCamera;
  private readonly camR: CubeCamera;
  private frame = 0;
  private pending = CAPTURE.settle;

  constructor() {
    const rt = () => new WebGLCubeRenderTarget(CAPTURE.size, { type: HalfFloatType, generateMipmaps: false });
    this.left = rt(); this.right = rt();
    this.left.texture.name = "wheel-env-left"; this.right.texture.name = "wheel-env-right";
    this.camL = new CubeCamera(0.05, 400, this.left);
    this.camR = new CubeCamera(0.05, 400, this.right);
  }

  get textures(): { left: Texture; right: Texture } { return { left: this.left.texture, right: this.right.texture }; }

  /** Capture again over the next few frames. */
  invalidate() { this.pending = CAPTURE.settle; }

  /** Call once a frame; it captures only when due. `hide` is the wheelset group. */
  update(gl: WebGLRenderer, scene: Scene, hide: Object3D, left: [number, number, number], right: [number, number, number]) {
    this.frame++;
    if (this.pending <= 0 && this.frame % CAPTURE.every !== 0) return;
    if (this.pending > 0) this.pending--;
    const hidden: Object3D[] = [hide];
    scene.traverseVisible((o) => { if (o.userData.glass) hidden.push(o); });
    const was = hidden.map((o) => o.visible);
    for (const o of hidden) o.visible = false;
    const prevAuto = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    try {
      withReflectionsOff(() => {
        this.camL.position.set(...left); this.camL.updateMatrixWorld(); this.camL.update(gl, scene);
        this.camR.position.set(...right); this.camR.updateMatrixWorld(); this.camR.update(gl, scene);
      });
    } finally {
      gl.shadowMap.autoUpdate = prevAuto;
      hidden.forEach((o, i) => { o.visible = was[i]; });
    }
  }

  dispose() { this.left.dispose(); this.right.dispose(); }
}

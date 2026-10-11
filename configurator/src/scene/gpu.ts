/* True when WebGL is running on a software rasteriser (SwiftShader, llvmpipe,
   Microsoft Basic Render). Truck uses it for its glass: transmission renders
   the opaque scene a second time every frame, which a software renderer
   cannot afford (the page drops to a frame or two a second and stops
   answering), so it gets plain see-through glass. Poster mode keeps the real
   glass, because a poster is one still frame. */
export function softwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    if (new URLSearchParams(location.search).get("poster") === "1") return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch { return false; }
}

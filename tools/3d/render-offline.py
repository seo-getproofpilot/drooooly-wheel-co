"""Path-traces a configurator build in Blender Cycles from the exact scene and
camera the browser showed, for the WebGL vs offline-still comparison.

    blender -b -P tools/3d/render-offline.py -- <scene.glb> <camera.json> <out.png>
        [--samples 256] [--width W --height H] [--view three|"ACES 1.3"|AgX] [--no-sun]
        [--exposure-bias 0] [--hdri-rot-deg auto] [--save-blend out.blend]

scene.glb and camera.json come from the configurator's dev hook
(window.__droooly.exportScene(), configurator/src/dev/exportScene.ts): the
truck and wheelset as three.js had them, and the CameraControls camera.

The location is rebuilt to match configurator/src/scene/Outdoor.tsx:
  * outdoor.hdr as the world, turned by OUTDOOR_ROTATION about the up axis.
    The angle is solved from the HDRI's own sun pixels so the sun lands where
    the browser puts it (HDRI_SUN turned by OUTDOOR_ROTATION).
  * the same extra directional sun the browser adds (SUN_INTENSITY, SUN_COLOR).
    three's directional intensity and a Blender sun's strength are both
    irradiance with a 1/pi Lambert, so 3.5 maps to 3.5.
  * the asphalt_02 disc, 3 m tile, ASPHALT.tint, normal and roughness maps,
    fading to transparent between 10 and 25 m from the truck's middle, where
    the HDRI's own ground shows through (the browser's grounded skybox).
  * the grade: exposure 0.9 and the warm multiply. The multiply is folded into
    the world and sun colour (a path tracer is linear in its emitters, so this
    equals grading the frame), exposure goes to the view transform.
  * the display transform. By default ("--view three") Cycles writes linear
    EXR and the script applies exactly what the browser does after the grade:
    exposure 0.9, three's ACESFilmicToneMapping (the Hill fit with three's
    1/0.6 brightening), the postprocessing Vignette (offset 0.32, darkness
    0.55) and the sRGB encode. So the tone curve is identical by construction
    and the pair differs only in the light transport. "--view AgX" or
    "--view 'ACES 1.3'" use Blender's own view transform instead (with the
    vignette still applied), for a look at a real film curve.
  * depth of field on the Wheel preset only, focused on the camera target.

Coordinates: three is +Y up, metres. The glTF importer maps that to Blender
+Z up as (x, y, z) -> (x, -z, y); the camera is converted the same way.
"""
import bpy
import json
import math
import os
import sys
import time

import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
# hdri/ and textures/ live in configurator/public and are copied into the built
# visualize/. DROOOLY_ASSET_ROOT points at either (the render service image
# ships visualize/ only).
PUB = os.environ.get("DROOOLY_ASSET_ROOT") or os.path.join(REPO, "configurator", "public")
HDRI = os.path.join(PUB, "hdri", "outdoor.hdr")
ASPHALT = {m: os.path.join(PUB, "textures", f"asphalt_02_{m}.webp") for m in ("diff", "nor_gl", "rough")}

# Mirrors of configurator/src/scene/Outdoor.tsx
HDRI_SUN = (0.7678, 0.3125, 0.5594)          # three's equirect frame
OUTDOOR_ROTATION_DEG = 53.5
SUN_COLOR = (1.0, 0.806, 0.658)
SUN_INTENSITY = 3.5
OUTDOOR_EXPOSURE = 0.9
WARMTH = (1.05, 1.012, 0.94)                 # GradeEffect at warmth 1
CENTRE_THREE = (0.0, 0.0, -1.9)
TILE, RADIUS, FADE_FROM, FADE_TO = 3.0, 28.0, 10.0, 25.0
TINT = (1.44, 1.2, 0.93)
VIGNETTE = {"offset": 0.32, "darkness": 0.55}
WHEEL_FSTOP = 4.0


def to_blender(v):
    x, y, z = v
    return Vector((x, -z, y))


def rot_y(v, deg):
    a = math.radians(deg)
    x, y, z = v
    return (x * math.cos(a) + z * math.sin(a), y, -x * math.sin(a) + z * math.cos(a))


def parse(argv):
    a = argv[argv.index("--") + 1:] if "--" in argv else []
    if len(a) < 3:
        sys.exit(__doc__)
    opts = {"glb": a[0], "camera": a[1], "out": a[2], "samples": 256, "width": None, "height": None,
            "view": "three", "sun": True, "exposure_bias": 0.0, "hdri_rot": None, "save_blend": None, "device": "auto"}
    i = 3
    while i < len(a):
        k = a[i]
        if k == "--samples": opts["samples"] = int(a[i + 1]); i += 2
        elif k == "--width": opts["width"] = int(a[i + 1]); i += 2
        elif k == "--height": opts["height"] = int(a[i + 1]); i += 2
        elif k == "--view": opts["view"] = a[i + 1]; i += 2
        elif k == "--no-sun": opts["sun"] = False; i += 1
        elif k == "--exposure-bias": opts["exposure_bias"] = float(a[i + 1]); i += 2
        elif k == "--hdri-rot-deg": opts["hdri_rot"] = float(a[i + 1]); i += 2
        elif k == "--save-blend": opts["save_blend"] = a[i + 1]; i += 2
        elif k == "--device": opts["device"] = a[i + 1]; i += 2
        else: sys.exit(f"unknown option {k}")
    return opts


# ---------------------------------------------------------------- materials

def principled(mat):
    return next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if mat and mat.use_nodes else None


def fix_materials(log):
    for mat in bpy.data.materials:
        p = principled(mat)
        if p is None:
            continue
        nt = mat.node_tree
        base = mat.name.split(".")[0]
        if base == "glass":
            rebuild_glass(mat, p)
            log.append(f"{mat.name}: rebuilt as a thin pane (importer gave Principled transmission 0.9 plus a volume on open panes)")
            continue
        # Anisotropy with no tangent wired falls back to a tangent around the
        # object's Z, which is not the lathe direction. three reads the
        # tangent from the UVs (lathe u runs around the axle), so do the same.
        aniso = p.inputs["Anisotropic"]
        if (aniso.is_linked or aniso.default_value > 0) and not p.inputs["Tangent"].is_linked:
            t = nt.nodes.new("ShaderNodeTangent")
            t.direction_type = "UV_MAP"
            uv = next((n.uv_map for n in nt.nodes if n.type == "UVMAP" and n.uv_map), "")
            if not uv:
                me = next((o.data for o in bpy.data.objects if o.type == "MESH" and mat.name in [s.material.name for s in o.material_slots if s.material]), None)
                uv = me.uv_layers[0].name if me and me.uv_layers else ""
            t.uv_map = uv
            nt.links.new(t.outputs["Tangent"], p.inputs["Tangent"])
            log.append(f"{mat.name}: anisotropy {round(aniso.default_value, 2) if not aniso.is_linked else 'mapped'} given the UV tangent ({uv or 'first UV'})")
        # Normal map strength from the glTF scale, if the importer dropped it.
        for n in nt.nodes:
            if n.type == "NORMAL_MAP" and n.inputs["Strength"].default_value == 1.0 and base == "paint":
                n.inputs["Strength"].default_value = 0.15
                log.append(f"{mat.name}: flake normal strength set to 0.15 (glTF scale)")
        # Volume on open meshes is undefined in Cycles; only glass carried one.
        out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
        if out and out.inputs["Volume"].is_linked:
            for l in list(out.inputs["Volume"].links):
                nt.links.remove(l)
            log.append(f"{mat.name}: volume dropped")


def rebuild_glass(mat, p):
    """Thin automotive glass: Fresnel at IOR 1.5 between a straight-through
    tinted pass and a near-mirror reflection. A Principled transmission at IOR
    1.5 on a single open pane refracts every ray as if it entered a solid block
    and never left, which shifts the cab interior; three's thin transmission
    (thickness 0.01) does not, so a thin pane is the like-for-like."""
    col = tuple(p.inputs["Base Color"].default_value)
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    # A pane is air on both sides. Cycles inverts the IOR on a back-facing
    # hit, which on these open sheets means total internal reflection (a
    # full mirror) past 42 degrees, so the back face gets 1/1.5 to cancel it.
    fres = nt.nodes.new("ShaderNodeFresnel")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    ior = nt.nodes.new("ShaderNodeMapRange")
    ior.inputs["To Min"].default_value = 1.5
    ior.inputs["To Max"].default_value = 1 / 1.5
    nt.links.new(geo.outputs["Backfacing"], ior.inputs["Value"])
    nt.links.new(ior.outputs["Result"], fres.inputs["IOR"])
    trans = nt.nodes.new("ShaderNodeBsdfTransparent"); trans.inputs["Color"].default_value = col
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse"); diff.inputs["Color"].default_value = col
    body = nt.nodes.new("ShaderNodeMixShader"); body.inputs["Fac"].default_value = 0.1  # three: transmission 0.9
    nt.links.new(trans.outputs[0], body.inputs[1]); nt.links.new(diff.outputs[0], body.inputs[2])
    gloss = nt.nodes.new("ShaderNodeBsdfGlossy")
    gloss.inputs["Roughness"].default_value = 0.05
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fres.outputs[0], mix.inputs["Fac"])
    nt.links.new(body.outputs[0], mix.inputs[1]); nt.links.new(gloss.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])


# ---------------------------------------------------------------- location

def hdri_rotation(img):
    """Z rotation for the world lookup so the HDRI's sun lands on the
    browser's sun direction. Returns (degrees, report)."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    lum = px.reshape(h, w, 4)[..., :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    thr = np.quantile(lum, 1 - 0.0005)
    ys, xs = np.nonzero(lum >= thr)
    wts = lum[ys, xs]
    # circular mean on u so a sun on the seam averages correctly
    ang = (xs + 0.5) / w * 2 * math.pi
    u = (math.atan2(float((np.sin(ang) * wts).sum()), float((np.cos(ang) * wts).sum())) / (2 * math.pi)) % 1.0
    v = float(((ys + 0.5) / h * wts).sum() / wts.sum())  # Blender pixel rows run bottom-up
    elev_img = (v - 0.5) * 180.0
    # Blender equirect: u = -atan2(y, x) / 2pi + 0.5
    az_img = -(u - 0.5) * 2 * math.pi
    target = to_blender(rot_y(HDRI_SUN, OUTDOOR_ROTATION_DEG)).normalized()
    az_t = math.atan2(target.y, target.x)
    elev_t = math.degrees(math.asin(target.z))
    deg = math.degrees(az_img - az_t)
    deg = (deg + 180) % 360 - 180
    return deg, target, f"HDRI sun at u={u:.4f} elevation {elev_img:.1f} deg (Outdoor.tsx HDRI_SUN elevation {elev_t:.1f}); world Z rotation {deg:.2f} deg"


def build_world(opts, log):
    world = bpy.data.worlds.new("outdoor")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    img = bpy.data.images.load(HDRI)
    deg, sun_dir, report = hdri_rotation(img)
    if opts["hdri_rot"] is not None:
        deg = opts["hdri_rot"]
        report += f"; overridden to {deg:.2f}"
    log.append(report)
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapn = nt.nodes.new("ShaderNodeMapping")
    mapn.inputs["Rotation"].default_value = (0, 0, math.radians(deg))
    env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = img
    warm = nt.nodes.new("ShaderNodeMix"); warm.data_type = "RGBA"; warm.blend_type = "MULTIPLY"
    warm.inputs["Factor"].default_value = 1.0
    warm.inputs["B"].default_value = (*WARMTH, 1.0)
    bg = nt.nodes.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = 1.0
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(coord.outputs["Generated"], mapn.inputs["Vector"])
    nt.links.new(mapn.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], warm.inputs["A"])
    nt.links.new(warm.outputs["Result"], bg.inputs["Color"])
    nt.links.new(bg.outputs[0], out.inputs["Surface"])

    if opts["sun"]:
        sd = bpy.data.lights.new("sun", "SUN")
        sd.energy = SUN_INTENSITY
        sd.color = tuple(c * w for c, w in zip(SUN_COLOR, WARMTH))
        sd.angle = math.radians(0.53)
        so = bpy.data.objects.new("sun", sd)
        bpy.context.scene.collection.objects.link(so)
        so.rotation_euler = (-sun_dir).to_track_quat("-Z", "Y").to_euler()
        log.append(f"sun light strength {SUN_INTENSITY}, direction {tuple(round(c, 3) for c in sun_dir)} (Blender)")


def build_ground(log):
    centre = to_blender(CENTRE_THREE)
    size = RADIUS * 2
    bpy.ops.mesh.primitive_plane_add(size=size, location=(centre.x, centre.y, -0.002))
    g = bpy.context.active_object
    g.name = "asphalt"
    mat = bpy.data.materials.new("asphalt")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    uv = nt.nodes.new("ShaderNodeUVMap")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (size / TILE, size / TILE, 1)
    nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
    tex = {}
    for k, path in ASPHALT.items():
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(path)
        t.image.colorspace_settings.name = "sRGB" if k == "diff" else "Non-Color"
        t.interpolation = "Cubic"
        nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
        tex[k] = t
    tint = nt.nodes.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs["B"].default_value = (*TINT, 1.0)
    nt.links.new(tex["diff"].outputs["Color"], tint.inputs["A"])
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.uv_map = g.data.uv_layers[0].name
    nt.links.new(tex["nor_gl"].outputs["Color"], nm.inputs["Color"])
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Metallic"].default_value = 0.0
    nt.links.new(tint.outputs["Result"], p.inputs["Base Color"])
    nt.links.new(tex["rough"].outputs["Color"], p.inputs["Roughness"])
    nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    # radial fade to the HDRI's own ground
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dist = nt.nodes.new("ShaderNodeVectorMath"); dist.operation = "DISTANCE"
    dist.inputs[1].default_value = (centre.x, centre.y, 0.0)
    flat = nt.nodes.new("ShaderNodeVectorMath"); flat.operation = "MULTIPLY"; flat.inputs[1].default_value = (1, 1, 0)
    nt.links.new(geo.outputs["Position"], flat.inputs[0])
    nt.links.new(flat.outputs[0], dist.inputs[0])
    fade = nt.nodes.new("ShaderNodeMapRange"); fade.interpolation_type = "SMOOTHSTEP"
    fade.inputs["From Min"].default_value = FADE_FROM; fade.inputs["From Max"].default_value = FADE_TO
    nt.links.new(dist.outputs["Value"], fade.inputs["Value"])
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fade.outputs["Result"], mix.inputs["Fac"])
    nt.links.new(p.outputs[0], mix.inputs[1]); nt.links.new(clear.outputs[0], mix.inputs[2])
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    g.data.materials.append(mat)
    log.append(f"asphalt disc {RADIUS} m, tile {TILE} m, tint {TINT}, fade {FADE_FROM}-{FADE_TO} m")


# ---------------------------------------------------------------- camera

def build_camera(cam_json, width, height):
    pos = to_blender(cam_json["position"])
    tgt = to_blender(cam_json["target"])
    cd = bpy.data.cameras.new("cam")
    cd.sensor_fit = "VERTICAL"
    cd.sensor_height = 24.0
    cd.sensor_width = 24.0 * width / height
    cd.lens = (cd.sensor_height / 2) / math.tan(math.radians(cam_json["fov"]) / 2)
    cd.clip_start = 0.05
    cd.clip_end = 1000
    co = bpy.data.objects.new("cam", cd)
    bpy.context.scene.collection.objects.link(co)
    co.location = pos
    co.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = co
    if str(cam_json.get("preset", "")).lower() == "wheel":
        cd.dof.use_dof = True
        cd.dof.focus_distance = (tgt - pos).length
        cd.dof.aperture_fstop = WHEEL_FSTOP
    return cd


# ---------------------------------------------------------------- render

def setup_render(opts, width, height, log):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    device = "CPU"
    if opts["device"] in ("auto", "gpu"):
        for kind in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == kind
                device = kind
                break
    sc.cycles.device = "GPU" if device != "CPU" else "CPU"
    sc.cycles.samples = opts["samples"]
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    # OIDN on the GPU only when Cycles renders there; a CPU-only Linux box has
    # no GPU denoiser to fall back from.
    if hasattr(sc.cycles, "denoising_use_gpu"):
        sc.cycles.denoising_use_gpu = device != "CPU"
    sc.render.threads_mode = "AUTO"  # every core
    sc.cycles.max_bounces = 12
    sc.cycles.transparent_max_bounces = 16
    sc.render.resolution_x = width
    sc.render.resolution_y = height
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.look = "None"
    sc.view_settings.gamma = 1.0
    if opts["view"] == "three":
        # linear out; the browser's display transform is applied in to_display()
        sc.view_settings.view_transform = "Standard"
        sc.view_settings.exposure = 0.0
        sc.render.image_settings.file_format = "OPEN_EXR"
        sc.render.image_settings.color_depth = "32"
        sc.render.image_settings.color_mode = "RGB"
        expo = f"x{OUTDOOR_EXPOSURE * 2 ** opts['exposure_bias']:.3f} then three ACESFilmic"
    else:
        sc.view_settings.view_transform = opts["view"]
        sc.view_settings.exposure = math.log2(OUTDOOR_EXPOSURE) + opts["exposure_bias"]
        sc.render.image_settings.file_format = "PNG"
        sc.render.image_settings.color_mode = "RGB"
        sc.render.image_settings.color_depth = "8"
        expo = f"{sc.view_settings.exposure:+.3f} stops"
    log.append(f"Cycles {device}, {opts['samples']} samples, OIDN, {width}x{height}, view {opts['view']}, exposure {expo}")
    return device


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - 0.055)


ACES_IN = np.array([[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]], dtype=np.float64)
ACES_OUT = np.array([[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]], dtype=np.float64)


def three_aces(rgb):
    """three's ACESFilmicToneMapping at toneMappingExposure 1 (tonemapping_pars_fragment)."""
    c = rgb / 0.6
    c = c @ ACES_IN.T
    a = c * (c + 0.0245786) - 0.000090537
    b = c * (0.983729 * c + 0.4329510) + 0.238081
    c = (a / b) @ ACES_OUT.T
    return np.clip(c, 0.0, 1.0)


def vignette_gain(w, h):
    """postprocessing's Vignette, technique DEFAULT (vignette.frag)."""
    yy, xx = np.mgrid[0:h, 0:w]
    uv = np.stack([(xx + 0.5) / w, (yy + 0.5) / h], -1)
    d = np.linalg.norm(uv - 0.5, axis=-1) * (VIGNETTE["darkness"] + VIGNETTE["offset"])
    e0, e1 = 0.8, VIGNETTE["offset"] * 0.799
    t = np.clip((d - e0) / (e1 - e0), 0, 1)
    return (t * t * (3 - 2 * t))[..., None]


def read_pixels(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4).astype(np.float64), w, h


def write_png(rgb, path):
    """rgb is display-referred sRGB in 0..1; written as 8-bit with no further transform."""
    h, w, _ = rgb.shape
    img = bpy.data.images.new("out", w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "sRGB"
    px = np.ones((h, w, 4), dtype=np.float32)
    px[..., :3] = np.round(np.clip(rgb, 0, 1) * 255) / 255
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()


def to_display(src, out, view, bias):
    """The browser's chain after the grade. For "three" src is linear EXR; for a
    Blender view transform src is the view-transformed PNG and only the
    vignette (which the browser applies after tone mapping, in linear) is added."""
    px, w, h = read_pixels(src)
    if view == "three":
        lin = three_aces(px[..., :3] * OUTDOOR_EXPOSURE * 2 ** bias)
    else:
        lin = srgb_to_linear(px[..., :3])
    write_png(linear_to_srgb(lin * vignette_gain(w, h)), out)


def main():
    opts = parse(sys.argv)
    t_start = time.time()
    cam_json = json.load(open(opts["camera"]))
    width = opts["width"] or int(round(cam_json["width"]))
    height = opts["height"] or int(round(cam_json["height"]))
    log = []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=opts["glb"])
    fix_materials(log)
    build_world(opts, log)
    build_ground(log)
    build_camera(cam_json, width, height)
    device = setup_render(opts, width, height, log)
    if opts["save_blend"]:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opts["save_blend"]))
    sc = bpy.context.scene
    out = os.path.abspath(opts["out"])
    raw = os.path.splitext(out)[0] + (".exr" if opts["view"] == "three" else ".raw.png")
    sc.render.filepath = raw
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    render_s = time.time() - t0
    to_display(raw, out, opts["view"], opts["exposure_bias"])
    for line in log:
        print("render-offline:", line)
    print(f"render-offline: RESULT {json.dumps({'out': opts['out'], 'render_s': round(render_s, 2), 'total_s': round(time.time() - t_start, 2), 'samples': opts['samples'], 'device': device, 'width': width, 'height': height})}")


if __name__ == "__main__":
    main()

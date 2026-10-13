# blender -b -P tools/3d/prepare-f250.py -- <outdir> [--render]
# Turns the CC-BY "Ford F-450 Twin Turbo 2021" (DR1KING100K, Sketchfab) into the DROOOLY f250
# body: a 2017-2022 Super Duty crew cab, SRW, 6.75 ft bed. The F-450 source shares the cab,
# doors, hood and front fenders with the F-250; the differences are the 8 ft bed and the dually
# rear fenders. So, on top of everything prepare-f450.py does (badges, wheels, engine out,
# interior decimated, paint joined into `body`, glass into `glass`, the rest into `chassis`):
#   * a 16.4 in slice of the bed is cut out just behind the cab (the source's fuel door goes with
#     it) and everything aft of the slice slides forward, so the wheelbase is the real 159.8 in;
#   * the dually flares, their marker lamps and the mud flaps are flattened into the bed side,
#     keeping the round arch opening, so the bed reads as a single-rear-wheel bed side;
#   * the rear axle ends are clipped like the front so nothing pokes through an SRW wheel.
# Source frame: x across (driver +x), -y forward, z up, metres; front axle at y = -2.24.
import bpy, bmesh, json, sys, os, re, math
from mathutils import Vector
IN = 0.0254
argv = sys.argv[sys.argv.index("--") + 1:]
outdir = argv[0]; RENDER = "--render" in argv
root = os.path.dirname(os.path.abspath(__file__))
dims = json.load(open(os.path.join(root, "truck-dims.json")))["f250-crew"]
src = os.path.join(root, ".source", "ford-f450-2021", "scene.gltf")
SRC_FRONT_Y, SRC_REAR_Y, SRC_TIRE_R = -2.24, 2.236, 0.45
CUT = (176.2 - dims["wheelbaseIn"]) * IN           # 0.4166 m, the bed length difference
Y1 = 0.83; Y2 = Y1 + CUT                           # the slice: flat bed side behind the cab, ahead of the flare
FLARE = os.environ.get("FLARE", "flatten")         # flatten | delete, for comparison renders
FLUSH_X = 0.985                                    # where the flattened flare sits, a hair proud of the bed side

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)

# 1. delete: wheels and rims, engine, badges/logos/plates/emblems, clearcoat shells (see
#    prepare-f450.py), plus the dually mud flaps and their brackets (extra_1)
DROP = r"^(wheel_|inner|engineblock|enginebay|logos|plate_|bodyshell\.001|bedliner_SUB2_Glass|grille_SUB4_|extra_1_)|badge|symbol|_Tyre_|tyre"
for o in list(meshes):
    if re.search(DROP, o.name, re.I):
        bpy.data.objects.remove(o, do_unlink=True); meshes.remove(o)
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def bbox(o):
    cs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector([min(c[i] for c in cs) for i in range(3)]), Vector([max(c[i] for c in cs) for i in range(3)])

# 1b. moulded lettering: SUPER DUTY on the hood lip, the oval in the grille, the tailgate letters
def cut_loose(name, lo, hi, max_tris=None):
    o = bpy.data.objects.get(name)
    if o is None: return
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE"); bpy.ops.object.mode_set(mode="OBJECT")
    parts = list(bpy.context.selected_objects); keep = []; gone = 0
    for p in parts:
        vs = [p.matrix_world @ v.co for v in p.data.vertices]
        if not vs: bpy.data.objects.remove(p, do_unlink=True); continue
        mn = [min(v[i] for v in vs) for i in range(3)]; mx = [max(v[i] for v in vs) for i in range(3)]
        inside = all(lo[i] <= mn[i] and mx[i] <= hi[i] for i in range(3))
        if inside and (max_tris is None or len(p.data.polygons) <= max_tris):
            bpy.data.objects.remove(p, do_unlink=True); gone += 1
        else: keep.append(p)
    bpy.ops.object.select_all(action="DESELECT")
    for p in keep: p.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]
    with bpy.context.temp_override(active_object=keep[0], selected_editable_objects=keep, selected_objects=keep):
        bpy.ops.object.join()
    keep[0].name = name; keep[0].data.name = name
    print("cut", name, gone, "loose parts of", len(parts))
cut_loose("bonnet_SUB1_SKIN_00_0", (-0.45, -3.135, 1.33), (0.45, -3.05, 1.38))
cut_loose("grille_SUB3_EXT_Chrome_0", (-0.17, -3.21, 0.99), (0.17, -3.175, 1.14))
cut_loose("boot_SUB3_SKIN_01_0", (-0.78, 3.285, 0.98), (0.78, 3.305, 1.46), max_tris=100)
cut_loose("boot_SUB9_EXT_ALU_0", (-0.79, 3.395, 1.08), (0.79, 3.425, 1.25), max_tris=60)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]

# 1c. the dually rear fenders. Everything that stands proud of the bed side (|x| > FLUSH_X) in
#     the rear fender zone is either flattened onto the bed side or deleted. The marker lamps
#     and their bezels on the flares, and the flat plates under them, always go.
ZONE = dict(y0=1.25, y1=3.15, z1=1.45)
def in_zone(mn, mx): return mx.y > ZONE["y0"] and mn.y < ZONE["y1"] and mn.z < ZONE["z1"] and max(abs(mn.x), abs(mx.x)) > 1.02
LAMPS = r"^(bodyshell_emisv|bodyshell_SUB1_chrome_flat)"
PLATES = r"^bodyshell_SUB3_undercarriage"
def split_loose(o):
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE"); bpy.ops.object.mode_set(mode="OBJECT")
    return list(bpy.context.selected_objects)
flat = 0; gone = 0; lamps = []
for o in [o for o in meshes if re.match(r"^bodyshell", o.name)]:
    mn, mx = bbox(o)
    if not in_zone(mn, mx): continue
    name = o.name; meshes.remove(o)
    parts = split_loose(o); keep = []
    for p in parts:
        pmn, pmx = bbox(p)
        if in_zone(pmn, pmx) and (FLARE == "delete" or re.match(PLATES, name) or ((pmx.z - pmn.z) < 0.08 and not re.match(LAMPS, name))):
            bpy.data.objects.remove(p, do_unlink=True); gone += 1; continue
        if in_zone(pmn, pmx):
            for v in p.data.vertices:
                if abs(v.co.x) > FLUSH_X and ZONE["y0"] < v.co.y < ZONE["y1"] and v.co.z < ZONE["z1"]:
                    v.co.x = math.copysign(FLUSH_X, v.co.x); flat += 1
            if re.match(LAMPS, name):
                # a flattened marker lamp is a disc flush with the bed side: paint it, it fills the lamp hole
                p.name = "bodyshell_SUB11_lampfill"; lamps.append(p); continue
        keep.append(p)
    if keep:
        bpy.ops.object.select_all(action="DESELECT")
        for p in keep: p.select_set(True)
        bpy.context.view_layer.objects.active = keep[0]
        with bpy.context.temp_override(active_object=keep[0], selected_editable_objects=keep, selected_objects=keep):
            bpy.ops.object.join()
        keep[0].name = name; keep[0].data.name = name; meshes.append(keep[0])
meshes.extend(lamps)
print("flares:", FLARE, "flattened verts", flat, "deleted parts", gone, "lamp fills", len(lamps))

# 1d. axle ends: the source's dually axles reach 0.92 m outboard, past the mounting face of an
#     SRW wheel at the platform's 68.3 in track. Cut away everything beyond |x| = limit.
def clip_x(pattern, limit):
    for o in [o for o in meshes if re.match(pattern, o.name)]:
        bm = bmesh.new(); bm.from_mesh(o.data); before = len(bm.faces)
        for sign in (1, -1):
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(sign * limit, 0, 0), plane_no=(sign, 0, 0), clear_outer=True)
        bm.to_mesh(o.data); bm.free()
        print("clip", o.name, before, "->", len(o.data.polygons), "faces")
clip_x(r"^transmission_[fr]", 0.78)
clip_x(r"^chassis_SUB5", 0.80)

# 2. the bed slice: every mesh is bisected at Y1 and Y2, the faces between are deleted and the
#    aft part slides forward by the slice width, then the two cut loops are welded. The bed side,
#    floor, rails, frame and driveshaft are straight through here, so the seam closes.
EPS = 1e-4
def cut_slice(o):
    mn, mx = bbox(o)
    if mx.y <= Y1 + EPS: return "front"
    if mn.y >= Y2 - EPS:
        for v in o.data.vertices: v.co.y -= CUT
        return "aft"
    if mn.y >= Y1 - EPS and mx.y <= Y2 + EPS: return "inside"
    bm = bmesh.new(); bm.from_mesh(o.data)
    for y in (Y1, Y2):
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, y, 0), plane_no=(0, 1, 0), dist=EPS / 10)
    inner = [f for f in bm.faces if Y1 + EPS < f.calc_center_median().y < Y2 - EPS]
    bmesh.ops.delete(bm, geom=inner, context="FACES")
    loose = [v for v in bm.verts if Y1 + EPS < v.co.y < Y2 - EPS]
    if loose: bmesh.ops.delete(bm, geom=loose, context="VERTS")
    for v in bm.verts:
        if v.co.y >= Y2 - EPS: v.co.y -= CUT
    seam = [v for v in bm.verts if abs(v.co.y - Y1) < 1e-3]
    if seam: bmesh.ops.remove_doubles(bm, verts=seam, dist=0.004)
    bm.to_mesh(o.data); bm.free()
    return "cut"
tally = {}
for o in list(meshes):
    r = cut_slice(o); tally[r] = tally.get(r, 0) + 1
    if r == "inside": bpy.data.objects.remove(o, do_unlink=True); meshes.remove(o)
print("slice", round(CUT, 4), "m at y", Y1, "..", round(Y2, 4), tally)

# 3. origin: front axle to y = 0, and the source body sits on 35 inch tires (OD 0.90 m); drop it
#    so it sits right on the platform's stock tire, the configurator raises it per the tire chosen.
r = dims["stockTireOdIn"] / 2 * IN
for o in meshes:
    o.location.y -= SRC_FRONT_Y
    o.location.z -= (SRC_TIRE_R - r)
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 4. decimate the heavy interior parts before joining (the camera never goes inside)
for o in meshes:
    ratio = 0.35 if re.search(r"^(interior|seats|dashboard|steeringwheel|transmission|chassis_SUB)", o.name) else (0.7 if len(o.data.polygons) > 4000 else 1.0)
    if ratio < 1.0:
        m = o.modifiers.new("dec", "DECIMATE"); m.ratio = ratio
        with bpy.context.temp_override(object=o, active_object=o, selected_editable_objects=[o]):
            bpy.ops.object.modifier_apply(modifier="dec")

def mat_names(o): return [m.name for m in o.data.materials if m]
def join(pred, new_name):
    group = [o for o in meshes if pred(o)]
    if not group: return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in group: o.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    with bpy.context.temp_override(active_object=group[0], selected_editable_objects=group, selected_objects=group):
        bpy.ops.object.join()
    for o in group[1:]: meshes.remove(o)
    group[0].name = new_name; group[0].data.name = new_name
    return group[0]
# Material names in the source are scrambled and its textures dropped (see prepare-f450.py), so
# each object gets one of five plain materials by its name before the join.
is_livery = lambda o: any(m.startswith("for_f450drw_20_livery") for m in mat_names(o)) and not re.search(r"interior|seats|dashboard", o.name)
is_paint = lambda o: is_livery(o) or bool(re.match(r"bodyshell_SUB(7|8|11)_", o.name))
is_glass = lambda o: (any(re.search(r"glass", m, re.I) for m in mat_names(o)) or re.search(r"glass|windscreen|sunroof", o.name, re.I)) and not is_paint(o) and not re.search(r"black_glass", o.name, re.I)
def plain(name, rgb, metallic, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0); bsdf.inputs["Metallic"].default_value = metallic; bsdf.inputs["Roughness"].default_value = rough
    return m
PLAIN = {
    "chrome": plain("chrome", (0.85, 0.86, 0.88), 1.0, 0.18),
    "gloss_black": plain("gloss_black", (0.02, 0.02, 0.02), 0.0, 0.12),
    "lamp": plain("lamp", (0.92, 0.92, 0.90), 0.0, 0.35),
    "interior": plain("interior", (0.11, 0.11, 0.11), 0.0, 0.9),
    "dark": plain("dark", (0.045, 0.045, 0.045), 0.0, 0.72),
}
def plain_for(o):
    n = o.name
    if re.search(r"black_glass", n, re.I): return "gloss_black"
    if re.search(r"chrome|_alu_|alu_solid|mirror|ext_alu", n, re.I): return "chrome"
    if re.search(r"emis", n, re.I): return "lamp"
    if re.search(r"^(interior|seats|dashboard|steeringwheel)|_int_|INT_", n): return "interior"
    return "dark"
for o in meshes:
    if is_paint(o) or is_glass(o): continue
    o.data.materials.clear(); o.data.materials.append(PLAIN[plain_for(o)])
    for poly in o.data.polygons: poly.material_index = 0
join(is_paint, "body")
join(is_glass, "glass")
join(lambda o: o.name not in ("body", "glass"), "chassis")

# 5. body paint comes from the configurator; one clean material slot so the swap lands everywhere
body = bpy.data.objects["body"]
body.data.materials.clear(); body.data.materials.append(bpy.data.materials.new("paint"))

half = dims["trackIn"] / 2 * IN; wb = dims["wheelbaseIn"] * IN
for name, x, y in (("hub_FL", half, 0), ("hub_FR", -half, 0), ("hub_RL", half, wb), ("hub_RR", -half, wb)):
    e = bpy.data.objects.new(name, None); e.location = (x, y, r); bpy.context.scene.collection.objects.link(e)
bed = bpy.data.objects.new("bed", None); bed.location = (0, wb * 0.8, 1.2); bpy.context.scene.collection.objects.link(bed)
zmin = min((o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box)
print("lowest point m", round(zmin, 3), "tris", sum(len(o.data.polygons) for o in meshes))
os.makedirs(outdir, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(outdir, "f250-crew.gltf"), export_format="GLTF_SEPARATE", export_yup=True,
                          export_apply=True, export_image_format="AUTO", export_texture_dir="textures")
print("exported f250-crew")

if RENDER:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"; scene.display.shading.color_type = "SINGLE"
    scene.display.shading.show_cavity = True
    scene.render.resolution_x = 1400; scene.render.resolution_y = 900
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
    cam.data.lens = 50
    def shoot(pos, look, fn):
        cam.location = pos
        cam.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(outdir, fn); bpy.ops.render.render(write_still=True)
    shoot((5.5, 9.5, 2.2), (0, 3.5, 1.0), "r-rear34.png")
    shoot((12.0, 2.0, 1.2), (0, 2.0, 1.0), "r-side.png")
    shoot((3.8, 4.8, 0.9), (0.6, 4.2, 0.9), "r-rearwheel.png")
    shoot((4.5, -3.5, 1.6), (0, 1.5, 1.0), "r-front34.png")

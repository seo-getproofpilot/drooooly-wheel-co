# blender -b -P tools/3d/prepare-f450.py -- <outdir>
# Turns the CC-BY "Ford F-450 Twin Turbo 2021" (DR1KING100K, Sketchfab) into the DROOOLY f450
# body: every badge, logo, plate and emblem mesh deleted, wheels and engine removed, interior
# decimated, body paint meshes joined into `body`, glass into `glass`, the rest into `chassis`,
# hub empties on the platform's real wheelbase and track. The source is already real scale and
# already faces -Y (glTF +Z) with the driver's side at +X, so only the origin moves.
import bpy, json, sys, os, re
from mathutils import Vector
IN = 0.0254
argv = sys.argv[sys.argv.index("--") + 1:]
outdir = argv[0]
root = os.path.dirname(os.path.abspath(__file__))
dims = json.load(open(os.path.join(root, "truck-dims.json")))["f450-crew"]
src = os.path.join(root, ".source", "ford-f450-2021", "scene.gltf")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)

# 1. delete: wheels and rims, engine, badges/logos/plates/emblems. bodyshell.001 and the bed's
#    Glass_rgbaffffff99 piece are the exporter's clearcoat shells sitting a hair over the paint; kept,
#    they join `glass` and frost the roof, fenders and bumper. Wipers' washer jets etc. stay
DROP = r"^(wheel_|inner|engineblock|enginebay|logos|plate_|bodyshell\.001|bedliner_SUB2_Glass|grille_SUB4_)|badge|symbol|_Tyre_|tyre"
for o in list(meshes):
    if re.search(DROP, o.name, re.I):
        bpy.data.objects.remove(o, do_unlink=True); meshes.remove(o)

# 1b. lettering moulded onto painted and chrome panels is a set of loose shells sitting a hair
#     off the surface: SUPER DUTY on the hood lip, the oval and its script in the grille centre
#     (its blue backing, grille_SUB4, is dropped above), the embossed letters on the tailgate and
#     the cut-out letters in its chrome band. Each is split into loose parts and the parts that
#     lie wholly inside the box (source frame: x across, -y forward, z up, metres) are deleted.
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

# 2. origin: front axle to y = 0 (source front axle y = -2.24), and the source body sits on
#    35 inch tires (OD 0.90 m); drop it so it sits right on the platform's stock tire, the
#    configurator raises it again per the tire chosen.
src_front_y, src_tire_r = -2.24, 0.45
r = dims["stockTireOdIn"] / 2 * IN
for o in meshes:
    o.location.y -= src_front_y
    o.location.z -= (src_tire_r - r)
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 3. decimate the heavy interior parts before joining (the camera never goes inside)
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
# The source's material names are scrambled (an object called EXT_Plastic carries a material
# called clear_red_3) and its textures are dropped, so every non-paint material would export as
# the same flat light grey. The OBJECT names carry the truth, so each object gets one of five
# plain materials by its name before the join. The roof, front fenders, pillars and dually
# flares are "EXT_Plastic" pieces of the bodyshell in the source; on the truck they are painted.
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

# 4. body paint comes from the configurator; give the body one clean material slot so the
#    swap lands on every face
body = bpy.data.objects["body"]
body.data.materials.clear(); body.data.materials.append(bpy.data.materials.new("paint"))

half = dims["trackIn"] / 2 * IN; wb = dims["wheelbaseIn"] * IN
for name, x, y in (("hub_FL", half, 0), ("hub_FR", -half, 0), ("hub_RL", half, wb), ("hub_RR", -half, wb)):
    e = bpy.data.objects.new(name, None); e.location = (x, y, r); bpy.context.scene.collection.objects.link(e)
bed = bpy.data.objects.new("bed", None); bed.location = (0, wb * 0.8, 1.2); bpy.context.scene.collection.objects.link(bed)
zmin = min((o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box)
print("lowest point m", round(zmin, 3), "tris", sum(len(o.data.polygons) for o in meshes))
os.makedirs(outdir, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(outdir, "f450-crew.gltf"), export_format="GLTF_SEPARATE", export_yup=True,
                          export_apply=True, export_image_format="AUTO", export_texture_dir="textures")
print("exported f450-crew")

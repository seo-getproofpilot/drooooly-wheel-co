# blender -b -P tools/3d/prepare-f150.py -- <outdir>
# Turns the CC-BY "2024_ford_f-150_raptor_r" (007, Sketchfab) into the DROOOLY f150 body. The
# Raptor R is a wide-body trim of the 14th-gen F-150 SuperCrew 5.5 ft bed, the right shape for the
# platform. Meshes are unnamed (Object_N), so parts are picked by material and by position. The
# source is real scale x0.01, faces -Y (glTF +Z) with the driver's side at +X, and sits level on
# 34.4 in tires at a 73.7 in track. This script scales it uniformly so its wheelbase matches the
# platform's, sets the axle line at the platform's stock tire radius (not the Raptor's), deletes
# every logo decal, the FORD grille and tailgate letters, the F-150 and RAPTOR tailgate badges,
# wheels, brakes and engine, decimates the interior hard, joins the paint into `body` (one clean
# `paint` slot), glass into `glass` and the rest into `chassis` with its authored materials.
# Finish with SIMPLIFY=0 tools/3d/finish-body.sh <outdir>/f150-crew.gltf <dir> f150: the body fits
# the budget unsimplified (133k tris), and simplify smears the flat tailgate into a light patch.
import bpy, json, sys, os, re, math
from mathutils import Vector, Matrix
IN = 0.0254
argv = sys.argv[sys.argv.index("--") + 1:]
outdir = argv[0]; RENDER = "--render" in argv
root = os.path.dirname(os.path.abspath(__file__))
dims = json.load(open(os.path.join(root, "truck-dims.json")))["f150-crew"]
src = os.path.join(root, ".source", "ford-f150-raptor-r", "scene.gltf")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)
def mats(o): return [m.name for m in o.data.materials if m]
def bbox(o):
    cs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector([min(c[i] for c in cs) for i in range(3)]); hi = Vector([max(c[i] for c in cs) for i in range(3)])
    return lo, hi

# 1. measure the axles from the four tire meshes, then drop wheels, brakes, engine and decals
tires = [o for o in meshes if "tire" in mats(o)]
cen = [(sum(bbox(o), Vector()) / 2, (bbox(o)[1].z - bbox(o)[0].z) / 2) for o in tires]
front = [c for c in cen if c[0].y < 0]; rear = [c for c in cen if c[0].y > 0]
F = sum((c[0] for c in front), Vector()) / len(front); R = sum((c[0] for c in rear), Vector()) / len(rear)
F.x = R.x = 0
half_src = sum(abs(c[0].x) for c in cen) / len(cen); r_src = sum(c[1] for c in cen) / len(cen)
print("source front axle", tuple(round(c, 5) for c in F), "rear", tuple(round(c, 5) for c in R),
      "half-track", round(half_src, 5), "tire r", round(r_src, 5))

DROP_MATS = {"tire", "material", "Rim_T", "Breaks",                    # wheels, rims, brakes
             "RaptorENG_Plastic", "RaptorMETAL_ENG", "RaptorENG_T", "Raptorcaalb",   # engine bay
             "Logo", "Logo_D",                                         # decal atlases: ovals, RAPTOR, F-150, stickers, plate
             "RaptorGrille_F"}                                         # the raised FORD letters, grille and tailgate
DROP_OBJS = {"Object_182"}                                             # tailgate applique with the FORD letters cut in
for o in list(meshes):
    if o.name in DROP_OBJS or any(m in DROP_MATS for m in mats(o)):
        bpy.data.objects.remove(o, do_unlink=True); meshes.remove(o)

# 2. the FORD letter surrounds in the grille and the F-150 / RAPTOR badges on the tailgate frame
#    are loose parts inside larger trim meshes: split those two and drop the parts in the band
K = 100.0   # source units to metres, for the readable bounds below
def drop_loose(name, keep):
    o = bpy.data.objects.get(name)
    if not o: return
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.separate(type="LOOSE"); bpy.ops.object.mode_set(mode="OBJECT")
    parts = list(bpy.context.selected_objects); meshes.remove(o); dropped = 0
    for p in parts:
        lo, hi = bbox(p); c = (lo + hi) / 2 * K; sz = (hi - lo) * K
        if keep(c, sz): meshes.append(p)
        else: bpy.data.objects.remove(p, do_unlink=True); dropped += 1
    print(name, "dropped", dropped, "of", len(parts), "loose parts")
drop_loose("Object_282", lambda c, s: not (abs(c.x) < 0.6 and 0.99 < c.z < 1.10 and s.z <= 0.105 and s.x <= 0.32 and c.y < -2.80))
drop_loose("Object_534", lambda c, s: not (abs(c.x) < 0.78 and 0.94 < c.z < 1.12 and s.z < 0.11 and s.x < 0.45 and c.y > 2.83))

# 3. place: uniform scale to the platform wheelbase, front axle to y = 0 at the platform's stock
#    tire radius (the source's are 34.4 in; the configurator raises the body per tire chosen)
wb = dims["wheelbaseIn"] * IN; r = dims["stockTireOdIn"] / 2 * IN
d = R - F
s = wb / math.hypot(d.y, d.z)
theta = -math.atan2(d.z, d.y)
M = Matrix.Translation((0, 0, r)) @ Matrix.Rotation(theta, 4, "X") @ Matrix.Scale(s, 4) @ Matrix.Translation(-F)
print("scale", round(s, 3), "pitch deg", round(math.degrees(theta), 3), "source wheelbase in", round(math.hypot(d.y, d.z) * K / IN, 1),
      "source track in", round(2 * half_src * K / IN, 1), "source tire OD in", round(2 * r_src * K / IN, 1))
for o in meshes: o.matrix_world = M @ o.matrix_world
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 4. decimate: interior hard (the camera never goes inside), heavy trim medium, paint lightly
INTERIOR = {"Leather_Int", "INT_Plastic", "Metal_Int", "RaptorINT_cloth", "costuras", "Cabin_C", "Int_T", "Caarbon", "Dashb"}
is_paint = lambda o: "RaptorPaaint" in mats(o)
is_glass = lambda o: any(re.search(r"glass|^Window$|dummy_material", m, re.I) for m in mats(o)) and not is_paint(o)
for o in meshes:
    n = len(o.data.polygons)
    if is_glass(o): ratio = 1.0
    elif is_paint(o): ratio = 1.0   # decimating paint drops its custom normals; flat panels go blotchy
    elif any(m in INTERIOR for m in mats(o)): ratio = 0.15
    elif n > 4000: ratio = 0.6
    else: ratio = 1.0
    if ratio < 1.0:
        m = o.modifiers.new("dec", "DECIMATE"); m.ratio = ratio
        with bpy.context.temp_override(object=o, active_object=o, selected_editable_objects=[o]):
            bpy.ops.object.modifier_apply(modifier="dec")

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
join(is_paint, "body")
join(is_glass, "glass")
join(lambda o: o.name not in ("body", "glass"), "chassis")

# 5. body paint comes from the configurator; one clean material slot so the swap lands everywhere
body = bpy.data.objects["body"]
body.data.materials.clear(); body.data.materials.append(bpy.data.materials.new("paint"))

# The Raptor R's flares stand 3.4 in further out per side than a standard F-150's fenders and
# its track is 6 in wider, so the hubs sit at the Raptor's track: a wheel then pokes past this
# body's flare by the same amount the fitment maths says it pokes past the stock fender.
half = dims.get("bodyTrackIn", dims["trackIn"]) / 2 * IN
for name, x, y in (("hub_FL", half, 0), ("hub_FR", -half, 0), ("hub_RL", half, wb), ("hub_RR", -half, wb)):
    e = bpy.data.objects.new(name, None); e.location = (x, y, r); bpy.context.scene.collection.objects.link(e)
bed_c = M @ (Vector((0, 1.90, 1.25)) / K)   # middle of the 5.5 ft box at rail height
bed = bpy.data.objects.new("bed", None); bed.location = (0, bed_c.y, bed_c.z); bpy.context.scene.collection.objects.link(bed)
zmin = min((o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box)
print("lowest point m", round(zmin, 3), "tris", sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons))
os.makedirs(outdir, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(outdir, "f150-crew.gltf"), export_format="GLTF_SEPARATE", export_yup=True,
                          export_apply=True, export_image_format="AUTO", export_texture_dir="textures")
print("exported f150-crew")

if RENDER:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"; scene.display.shading.color_type = "SINGLE"
    scene.display.shading.show_cavity = True
    scene.display.shading.show_backface_culling = True    # three.js draws one side, so must QA
    scene.render.resolution_x = 1400; scene.render.resolution_y = 900
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
    def shoot(pos, look, fn, lens=50):
        cam.location = pos; cam.data.lens = lens
        cam.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(outdir, fn); bpy.ops.render.render(write_still=True)
    shoot((0, 9.0, 1.2), (0, 4.5, 0.95), "r-tailgate.png")
    shoot((3.0, 2.5, 0.9), (1.0, 3.4, 0.75), "r-rearflare.png", 45)
    shoot((5.5, 9.5, 2.2), (0, 3.0, 1.0), "r-rear34.png")
    shoot((12.0, 1.8, 1.1), (0, 1.8, 1.0), "r-side.png", 40)

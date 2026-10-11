# blender -b -P tools/3d/prepare-lightbody.py -- <key> <outdir>
# Turns the CC-BY "Lightbody Lifted '85" (Daniel Zhabotinsky, Sketchfab) into a DROOOLY
# stand-in body: wheels, badges and plates removed, the truck turned to the glTF contract
# (+Z forward, +Y up, +X driver side, origin on the ground under the front axle), scaled so
# the track matches the platform, the bed stretched so the wheelbase matches, body paint
# meshes joined into `body`, glass into `glass`, the undercarriage into `chassis`, and hub
# empties placed from tools/3d/truck-dims.json. Exported as a separate .gltf so the textures
# are plain https files (the static host's CSP refuses blob: URLs, LAUNCH-CHECKLIST 7.5).
import bpy, json, sys, os, re, math
from mathutils import Vector, Matrix
IN = 0.0254
argv = sys.argv[sys.argv.index("--") + 1:]
key, outdir = argv[0], argv[1]
root = os.path.dirname(os.path.abspath(__file__))
dims = json.load(open(os.path.join(root, "truck-dims.json")))[key]
src = os.path.join(root, ".source", "lightbody-lifted-85", "scene.gltf")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

# 1. flatten: every mesh to world space, drop the import's empties
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)

# 2. drop wheels, badges, plates
for o in list(meshes):
    if re.search(r"WheelStock|Badges|Numberplates", o.name):
        bpy.data.objects.remove(o, do_unlink=True); meshes.remove(o)

# 3. source geometry: faces +X, Z up. Front axle x = 1.59, rear x = -1.31, half track 0.78, tire r 0.35.
#    Turn to face -Y (Blender's glTF +Z), shift the front axle to y = 0, scale the track to the platform.
src_front, src_rear, src_half, src_r = 1.59, -1.31, 0.78, 0.35
s = (dims["trackIn"] / 2 * IN) / src_half
M = Matrix.Scale(s, 4) @ Matrix.Translation((0, src_front, 0)) @ Matrix.Rotation(math.radians(-90), 4, "Z")
for o in meshes:
    o.matrix_world = M @ o.matrix_world
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 4. stretch the bed: everything behind the cab's rear wall slides back until the wheelbase is right
src_wb = (src_front - src_rear) * s
want_wb = dims["wheelbaseIn"] * IN
delta = want_wb - src_wb
split = (src_front - (-0.50)) * s   # cab rear wall sat at x = -0.50 in the source
for o in meshes:
    for v in o.data.vertices:
        if v.co.y > split: v.co.y += delta

# 5. join into the contract names
def join(names_re, new_name):
    group = [o for o in meshes if re.search(names_re, o.name)]
    if not group: return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in group: o.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    with bpy.context.temp_override(active_object=group[0], selected_editable_objects=group, selected_objects=group):
        bpy.ops.object.join()
    for o in group[1:]: meshes.remove(o)
    group[0].name = new_name; group[0].data.name = new_name
    return group[0]
join(r"_Body_krml|_Hood_krml|_Bumper_Front_krml|_Trunkdoor_krml", "body")
join(r"Headlights_Glass|Windshield|Taillights_Glass|Glass_Rear|Glass_Driver|Glass_Passanger|Body_Glass", "glass")
join(r"_Bottom_UCB|Lifted_Suspension|Bullbar|Extra_A|Lifted_Trim|Bumper_Rear|Bumper_front_inner|Trunk_door_inner|Hood_inner", "chassis")
join(r"Interior|Steering_Wheel", "interior")
join(r"Blinkers|Brakelights|Headlights_UCB|Reverse", "lights")
for o in meshes:
    if o.name not in ("body", "glass", "chassis", "interior", "lights"): o.name = "chassis_" + re.sub(r"[^A-Za-z0-9]+", "_", o.name)[:24]

# 6. the specular-f0 maps are not worth their bytes: drop those image nodes
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    for n in list(mat.node_tree.nodes):
        if n.type == "TEX_IMAGE" and n.image and "specularf0" in n.image.name.lower():
            mat.node_tree.nodes.remove(n)

# 7. hub empties and the bed empty, on the platform's real track, wheelbase and stock tire radius
half = dims["trackIn"] / 2 * IN; r = dims["stockTireOdIn"] / 2 * IN; wb = want_wb
for name, x, y in (("hub_FL", half, 0), ("hub_FR", -half, 0), ("hub_RL", half, wb), ("hub_RR", -half, wb)):
    e = bpy.data.objects.new(name, None); e.location = (x, y, r); bpy.context.scene.collection.objects.link(e)
bed = bpy.data.objects.new("bed", None); bed.location = (0, wb * 0.85, 1.0); bpy.context.scene.collection.objects.link(bed)

# 8. the source's lifted body sits on 27.5 in tires; ours sit on the platform's stock tire, so lift
#    the body by the radius difference and settle the lowest point a hair above the ground.
zmin = min((o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box)
for o in meshes: o.location.z += (r - src_r * s) - zmin + 0.01

os.makedirs(outdir, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(outdir, key + ".gltf"), export_format="GLTF_SEPARATE", export_yup=True,
                          export_apply=True, export_image_format="AUTO", export_texture_dir="textures")
print("exported", key, "scale", round(s, 3), "bed stretch m", round(delta, 3))

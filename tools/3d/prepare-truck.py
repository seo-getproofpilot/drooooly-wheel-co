# Turns a CC0 stand-in pickup into a truck GLB that meets the configurator's node contract.
#   blender -b --factory-startup -P tools/3d/prepare-truck.py -- <key> <out.glb>
#
# Output, in glTF terms (+Y up, +Z forward, metres): nodes body, glass, chassis, bed,
# hub_FL, hub_FR, hub_RL, hub_RR. Origin is the ground under the front axle centre.
# hub_FL = (+track/2, tireRadius, 0), hub_RL = (+track/2, tireRadius, -wheelbase). No wheels.
# +X is the driver's (left) side: with +Y up and +Z forward, +X points left.
#
# Axes: Blender is +Z up. The glTF importer maps glTF (x, y, z) to Blender (x, -z, y), and the
# exporter with export_yup maps Blender (x, y, z) back to glTF (x, z, -y). So glTF +Z forward is
# Blender -Y forward, and the rear axle sits at Blender +Y = +wheelbase.
import bpy, bmesh, json, sys, os, re
from mathutils import Matrix, Vector

IN = 0.0254
argv = sys.argv[sys.argv.index("--") + 1:]
key, out = argv[0], os.path.abspath(argv[1])
root = os.path.dirname(os.path.abspath(__file__))
dims = json.load(open(os.path.join(root, "truck-dims.json")))[key]
models = os.path.join(root, "..", "..", "configurator", "public", "models")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(root, dims["source"]))
scene = bpy.context.scene

# 1. Measure the source's own axles from its wheel meshes, then drop every wheel and tire.
wheels = [o for o in bpy.data.objects if re.search(r"wheel|tire|tyre", o.name, re.I)]
if len(wheels) != 4:
    sys.exit("expected 4 separate wheel meshes in the source, found %d" % len(wheels))
centres = [o.matrix_world @ (sum((Vector(c) for c in o.bound_box), Vector()) / 8) for o in wheels]
front_y = min(c.y for c in centres)                    # source faces Blender -Y
rear_y = max(c.y for c in centres)
axle_z = sum(c.z for c in centres) / 4
src_r = sum(o.dimensions.z for o in wheels) / 8
for o in wheels:
    me = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if me.users == 0: bpy.data.meshes.remove(me)

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
if len(meshes) != 1:
    sys.exit("expected one body mesh after removing wheels, found %d" % len(meshes))
src = meshes[0]
src.data.transform(src.matrix_world); src.matrix_world = Matrix.Identity(4)

# 2. Fit the stand-in to the real truck, axis by axis.
#    length: source wheelbase -> real wheelbase, front axle to y = 0
#    height: source wheel radius -> stock tire radius, axle line to z = tire radius, so arches fit
#    width:  source body width -> published overall width
wb = dims["wheelbaseIn"] * IN
r = dims["stockTireOdIn"] / 2 * IN
half = dims["trackIn"] / 2 * IN
xs = [v.co.x for v in src.data.vertices]
sx = dims["bodyWidthIn"] * IN / (max(xs) - min(xs))
sy = wb / (rear_y - front_y)
sz = r / src_r
fit = Matrix.Translation((0, 0, r)) @ Matrix.Diagonal((sx, sy, sz, 1)) @ Matrix.Translation((0, -front_y, -axle_z))
src.data.transform(fit)

# 3. Split by palette cell of the source's colour atlas (16 strips across, 4 rows down).
#    Light blue strip 1 row 3 is the window glass; dark strip 5 row 2 is bumpers, arches and
#    underside. Everything else (paint, lights, trim, bed) stays body.
def cell(face, uv):
    u = sum(l[uv].uv.x for l in face.loops) / len(face.loops)
    v = sum(l[uv].uv.y for l in face.loops) / len(face.loops)
    return int(u * 16), int((1 - v) * 4)
GROUPS = {"glass": {(1, 3)}, "chassis": {(5, 2)}}

def split(name, keep):
    bm = bmesh.new(); bm.from_mesh(src.data)
    uv = bm.loops.layers.uv.active
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(cell(f, uv))], context="FACES")
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in src.data.materials: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    return ob, len(me.polygons)

taken = set().union(*GROUPS.values())
counts = {}
for name, cells in GROUPS.items():
    counts[name] = split(name, lambda c, cells=cells: c in cells)[1]
counts["body"] = split("body_new", lambda c: c not in taken)[1]
old = src.data; bpy.data.objects.remove(src, do_unlink=True); bpy.data.meshes.remove(old)
bpy.data.objects["body_new"].name = "body"; bpy.data.objects["body"].data.name = "body"
print("SPLIT faces", counts)

# 4. Contract empties. bed is a marker near the bed centre (rough, stand-in only); it carries no mesh.
def empty(name, loc):
    e = bpy.data.objects.new(name, None); e.location = loc; scene.collection.objects.link(e)
empty("bed", (0, wb * 0.85, r))
for name, x, y in (("hub_FL", half, 0), ("hub_FR", -half, 0), ("hub_RL", half, wb), ("hub_RR", -half, wb)):
    empty(name, (x, y, r))

# No materials or images in the file: the configurator replaces every material at load
# (paint, glass, trim), so the palette texture would only add a blob: fetch the static
# host's CSP refuses. The palette was already used above to split glass from body.
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_yup=True, export_apply=True,
                          export_materials="NONE", export_image_format="NONE")
print("WROTE", out)

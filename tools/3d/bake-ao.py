# blender -b -P tools/3d/bake-ao.py -- <in.gltf> <outdir> [--samples 96] [--distance 1.5] [--ground-margin 0.15]
# Bakes ambient occlusion per vertex into COLOR_0 on every mesh primitive of a finished body
# glTF (the output of finish-body.sh), for the renderer's AO shader hook.
#
# Contract with the renderer: COLOR_0 is VEC3, normalized UNSIGNED_BYTE, R = G = B = AO,
# linear, 1.0 fully open and 0.0 fully occluded. It is a data channel only: no material is
# changed (glTF has no vertex-colour switch on a material; three.js turns vertexColors on for
# any primitive with COLOR_0, so the renderer must turn it back off where it reads the AO).
#
# How: Blender imports the glTF only to bake. Cycles bakes AO (distance 1.5 m) into a point
# colour attribute on every mesh, with a ground plane at z = 0 under the truck's footprint so the
# underbody and the wheel wells read as closed from below the way they are on a parked truck. The baked values
# are then written straight into the ORIGINAL glTF: each primitive's vertices are matched to
# the baked vertices by world position (same node), a COLOR_0 accessor is appended, and the
# .bin is repacked. Nothing else changes: node, mesh and material names, quantization,
# extensions and the external WebP textures stay exactly as they were.
#
# Idempotent: any COLOR_0 already in the input (a previous bake, or the all-white VEC4 the GMC
# source carries) is stripped and its bytes dropped before the new bake is written.
import bpy, json, os, sys, struct, math, shutil
import numpy as np
from mathutils import Matrix, Vector, Quaternion
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index("--") + 1:]
src, outdir = os.path.abspath(argv[0]), os.path.abspath(argv[1])
def opt(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
SAMPLES = opt("--samples", 96); DIST = opt("--distance", 1.5)
srcdir = os.path.dirname(src)

# ---------------------------------------------------------------- glTF in
g = json.load(open(src))
assert len(g["buffers"]) == 1, "one buffer expected"
binname = g["buffers"][0]["uri"]
buf = bytearray(open(os.path.join(srcdir, binname), "rb").read())

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
def read_accessor(i):
    a = g["accessors"][i]; bv = g["bufferViews"][a["bufferView"]]
    dt = np.dtype(CT[a["componentType"]]); n = NC[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", dt.itemsize * n)
    raw = np.frombuffer(bytes(buf), dtype=np.uint8, count=stride * (a["count"] - 1) + dt.itemsize * n, offset=off)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(a["count"], dt.itemsize * n), strides=(stride, 1))
    v = np.ascontiguousarray(rows).view(dt).reshape(a["count"], n).astype(np.float64)
    if a.get("normalized"):
        v = {np.int8: lambda x: np.maximum(x / 127, -1), np.uint8: lambda x: x / 255,
             np.int16: lambda x: np.maximum(x / 32767, -1), np.uint16: lambda x: x / 65535}[CT[a["componentType"]]](v)
    return v

# 1. strip old COLOR_0 everywhere
stripped = 0
for m in g["meshes"]:
    for p in m["primitives"]:
        if p["attributes"].pop("COLOR_0", None) is not None: stripped += 1
print("bake-ao: stripped", stripped, "old COLOR_0")

# ---------------------------------------------------------------- bake in Blender
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = SAMPLES
if sc.world is None: sc.world = bpy.data.worlds.new("w")
sc.world.light_settings.distance = DIST
sc.render.bake.target = "VERTEX_COLORS"
sc.render.bake.use_selected_to_active = False

meshes = [o for o in sc.objects if o.type == "MESH"]
# the ground: the truck's own footprint plus 15 cm, not an endless floor. It closes the underbody
# and the wheel wells from below, but leaves the lower hemisphere of the side panels open; the
# HDRI already darkens what a panel sees of the ground, so a full floor would count it twice.
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
MARGIN = opt("--ground-margin", 0.15)
bpy.ops.mesh.primitive_plane_add(size=1, location=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0))
ground = bpy.context.active_object; ground.name = "__ao_ground"
ground.scale = (hi.x - lo.x + 2 * MARGIN, hi.y - lo.y + 2 * MARGIN, 1)
bake_mat = bpy.data.materials.new("__ao_bake"); bake_mat.use_nodes = True
for o in meshes:
    me = o.data
    for a in [a for a in me.color_attributes if a.name == "AO"]: me.color_attributes.remove(a)
    attr = me.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
    me.color_attributes.active_color = attr
    if not me.materials: me.materials.append(bake_mat)
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
print("bake-ao: baked", len(meshes), "objects,", sum(len(o.data.vertices) for o in meshes), "verts,", SAMPLES, "samples,", DIST, "m")

# world-space baked vertices per Blender object, keyed by the object name (= glTF node name)
trees = {}
for o in meshes:
    me = o.data; n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get("co", co); co = co.reshape(n, 3)
    col = np.empty(n * 4); me.color_attributes["AO"].data.foreach_get("color", col); ao = col.reshape(n, 4)[:, 0]
    M = np.array(o.matrix_world); co = co @ M[:3, :3].T + M[:3, 3]
    t = KDTree(n)
    for i in range(n): t.insert(co[i], i)
    t.balance(); trees[o.name] = (t, ao)

# ---------------------------------------------------------------- write COLOR_0 into the original glTF
def local_matrix(nd):
    if "matrix" in nd: return Matrix([nd["matrix"][i::4] for i in range(4)])
    t = Matrix.Translation(nd.get("translation", (0, 0, 0)))
    q = nd.get("rotation", (0, 0, 0, 1)); r = Quaternion((q[3], q[0], q[1], q[2])).to_matrix().to_4x4()
    s = nd.get("scale", (1, 1, 1)); S = Matrix.Diagonal((s[0], s[1], s[2], 1))
    return t @ r @ S
parent = {c: i for i, nd in enumerate(g["nodes"]) for c in nd.get("children", [])}
def world_matrix(i):
    m = local_matrix(g["nodes"][i])
    while i in parent: i = parent[i]; m = local_matrix(g["nodes"][i]) @ m
    return m
YUP_TO_ZUP = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))

new_views = []          # (bytes) appended after compaction
done = {}               # POSITION accessor -> COLOR_0 accessor (shared positions share AO)
report = {}
for ni, nd in enumerate(g["nodes"]):
    if "mesh" not in nd: continue
    name = nd.get("name"); tree = trees.get(name)
    if tree is None:
        cands = [k for k in trees if k == name or k.startswith(name + ".")]
        assert cands, f"no baked object for node {name}"
        tree = trees[cands[0]]
    kd, ao = tree
    M = np.array(YUP_TO_ZUP @ world_matrix(ni))
    far = 0; vals = []
    for p in g["meshes"][nd["mesh"]]["primitives"]:
        pa = p["attributes"]["POSITION"]
        if pa in done: p["attributes"]["COLOR_0"] = done[pa]; continue
        pos = read_accessor(pa); w = pos @ M[:3, :3].T + M[:3, 3]
        v = np.empty(len(w))
        for i, c in enumerate(w):
            _, j, d = kd.find(c); v[i] = ao[j]
            if d > 2e-3: far += 1
        q = np.clip(np.round(np.clip(v, 0, 1) * 255), 0, 255).astype(np.uint8)
        packed = np.zeros((len(q), 4), np.uint8); packed[:, 0] = packed[:, 1] = packed[:, 2] = q
        g["accessors"].append({"bufferView": None, "componentType": 5121, "normalized": True, "count": int(len(q)), "type": "VEC3"})
        ai = len(g["accessors"]) - 1
        new_views.append((ai, packed.tobytes()))
        p["attributes"]["COLOR_0"] = ai; done[pa] = ai; vals.append(v)
    allv = np.concatenate(vals) if vals else np.array([1.0])
    report[name] = dict(verts=int(len(allv)), mean=round(float(allv.mean()), 3), min=round(float(allv.min()), 3),
                        p05=round(float(np.percentile(allv, 5)), 3), unmatched=far)
for k, r in report.items(): print("bake-ao:", k, r)

# ---------------------------------------------------------------- repack: drop unreferenced accessors and views
used_acc = set()
for m in g["meshes"]:
    for p in m["primitives"]:
        used_acc.update(p["attributes"].values())
        if "indices" in p: used_acc.add(p["indices"])
        for t in p.get("targets", []): used_acc.update(t.values())
for s in g.get("skins", []):
    if "inverseBindMatrices" in s: used_acc.add(s["inverseBindMatrices"])
for an in g.get("animations", []):
    for s in an["samplers"]: used_acc.update((s["input"], s["output"]))
acc_map = {}; accs = []
for i, a in enumerate(g["accessors"]):
    if i in used_acc: acc_map[i] = len(accs); accs.append(a)
def remap_acc(i): return acc_map[i]
for m in g["meshes"]:
    for p in m["primitives"]:
        p["attributes"] = {k: remap_acc(v) for k, v in p["attributes"].items()}
        if "indices" in p: p["indices"] = remap_acc(p["indices"])
        if "targets" in p: p["targets"] = [{k: remap_acc(v) for k, v in t.items()} for t in p["targets"]]
for s in g.get("skins", []):
    if "inverseBindMatrices" in s: s["inverseBindMatrices"] = remap_acc(s["inverseBindMatrices"])
for an in g.get("animations", []):
    for s in an["samplers"]: s["input"], s["output"] = remap_acc(s["input"]), remap_acc(s["output"])
new_by_old = {acc_map[ai]: data for ai, data in new_views}
g["accessors"] = accs

out = bytearray(); views = []; view_map = {}
def align():
    while len(out) % 4: out.append(0)
used_views = sorted({a["bufferView"] for a in accs if a.get("bufferView") is not None} |
                    {im["bufferView"] for im in g.get("images", []) if "bufferView" in im})
for vi in used_views:
    bv = dict(g["bufferViews"][vi]); off = bv.get("byteOffset", 0)
    align(); data = buf[off:off + bv["byteLength"]]
    bv["byteOffset"] = len(out); out += data; bv["buffer"] = 0
    view_map[vi] = len(views); views.append(bv)
for a in accs:
    if a.get("bufferView") is not None: a["bufferView"] = view_map[a["bufferView"]]
for im in g.get("images", []):
    if "bufferView" in im: im["bufferView"] = view_map[im["bufferView"]]
for ai, data in sorted(new_by_old.items()):
    align()
    views.append({"buffer": 0, "byteOffset": len(out), "byteLength": len(data), "byteStride": 4, "target": 34962})
    out += data; accs[ai]["bufferView"] = len(views) - 1
align()
g["bufferViews"] = views
g["buffers"][0]["byteLength"] = len(out)

os.makedirs(outdir, exist_ok=True)
with open(os.path.join(outdir, binname), "wb") as f: f.write(out)
with open(os.path.join(outdir, os.path.basename(src)), "w") as f: json.dump(g, f, separators=(",", ":"))
if os.path.abspath(outdir) != srcdir:      # external textures travel with the model, never re-encoded
    for im in g.get("images", []):
        if "uri" in im:
            dst = os.path.join(outdir, im["uri"]); os.makedirs(os.path.dirname(dst), exist_ok=True)
            if not os.path.exists(dst): shutil.copy(os.path.join(srcdir, im["uri"]), dst)
print("bake-ao: wrote", os.path.join(outdir, os.path.basename(src)), round(len(out) / 1e6, 2), "MB bin,",
      len(new_by_old), "COLOR_0 accessors")

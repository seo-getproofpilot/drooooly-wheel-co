# Shared Blender steps for turning a Sketchfab truck into a DROOOLY body. Imported by the
# prepare-<key>.py scripts (gm2500, gmc2500, ram1500); prepare-f450.py is the hand-written
# original this generalises. Run only inside Blender.
#
# Contract (glTF): +Z forward, +Y up, +X driver's (left) side, origin on the ground under the
# front axle centre. In Blender terms before the Y-up export: front is -Y, rear +Y, left +X, up
# +Z. Hubs hub_FL/FR/RL/RR at x = +-track/2, z = stock tire radius, y = 0 and wheelbase.
#
# What a config gives:
#   key            output name, also the truck-dims.json key
#   src            path under tools/3d/.source/
#   yaw            degrees about Z that turn the source so its front faces -Y (residual yaw is
#                  then measured from the tires and removed)
#   tire           regex (object name + material names) matching the tire meshes, used to
#                  measure the source wheelbase, track and tire radius
#   drop           regex of meshes to delete outright (badges, plates, wheels, engine, ghosts)
#   split          regex of meshes to cut into loose parts before the wheel and cut-box tests
#   cut            extra boxes (final frame, metres) whose loose parts are deleted:
#                  [((xmin, ymin, zmin), (xmax, ymax, zmax)), ...]
#   paint          regex of materials that carry body paint
#   glass          regex of materials (or names) that are glass
#   heavy          (regex, ratio) list of decimations applied before joining
import bpy, bmesh, json, math, os, re
from mathutils import Matrix, Vector

IN = 0.0254
ROOT = os.path.dirname(os.path.abspath(__file__))


def log(*a):
    print("[bodykit]", *a, flush=True)


def key_of(o):
    return o.name + " " + " ".join(m.name for m in o.data.materials if m)


def meshes():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def load(src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    for o in meshes():
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    for o in [o for o in bpy.data.objects if o.type != "MESH"]:
        bpy.data.objects.remove(o, do_unlink=True)
    # meshes shared between objects cannot take an applied transform: make them single-user
    for o in meshes():
        if o.data.users > 1: o.data = o.data.copy()
    apply(Matrix.Identity(4))


def apply(M):
    for o in meshes():
        o.matrix_world = M @ o.matrix_world
    bpy.ops.object.select_all(action="DESELECT")
    ms = meshes()
    for o in ms: o.select_set(True)
    bpy.context.view_layer.objects.active = ms[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def drop(rx):
    gone = []
    for o in list(meshes()):
        if re.search(rx, key_of(o), re.I):
            gone.append(o.name); bpy.data.objects.remove(o, do_unlink=True)
    return gone


def wheels(rx):
    """Four tire centres, tire radius and width, in the current (front = -Y) frame."""
    vs = [o.matrix_world @ v.co for o in meshes() if re.search(rx, key_of(o)) for v in o.data.vertices]
    cy = (min(v.y for v in vs) + max(v.y for v in vs)) / 2
    cx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2
    out = {}
    for fr in ("F", "R"):
        for side in ("L", "R"):
            q = [v for v in vs if ((v.y < cy) == (fr == "F")) and ((v.x > cx) == (side == "L"))]
            lo = Vector([min(v[i] for v in q) for i in range(3)]); hi = Vector([max(v[i] for v in q) for i in range(3)])
            out[fr + side] = dict(c=(lo + hi) / 2, s=hi - lo)
    return out


def level(rx, yaw):
    """Turn by yaw, then remove the residual yaw, roll and pitch the tire centres show."""
    apply(Matrix.Rotation(math.radians(yaw), 4, "Z"))
    w = wheels(rx)
    f = (w["FL"]["c"] + w["FR"]["c"]) / 2; r = (w["RL"]["c"] + w["RR"]["c"]) / 2
    yaw2 = math.atan2(r.x - f.x, r.y - f.y)            # rear should sit straight behind front
    apply(Matrix.Rotation(yaw2, 4, "Z"))
    w = wheels(rx)
    l = (w["FL"]["c"] + w["RL"]["c"]) / 2; rr = (w["FR"]["c"] + w["RR"]["c"]) / 2
    roll = math.atan2(l.z - rr.z, l.x - rr.x)
    f = (w["FL"]["c"] + w["FR"]["c"]) / 2; r = (w["RL"]["c"] + w["RR"]["c"]) / 2
    pitch = math.atan2(r.z - f.z, r.y - f.y)
    apply(Matrix.Rotation(roll, 4, "Y") @ Matrix.Rotation(-pitch, 4, "X"))
    log("residual yaw %.2f roll %.2f pitch %.2f deg" % (math.degrees(yaw2), math.degrees(roll), math.degrees(pitch)))
    return wheels(rx)


def separate_loose(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE"); bpy.ops.object.mode_set(mode="OBJECT")
    return list(bpy.context.selected_objects)


def bbox(o):
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    if not vs: return None
    return (Vector([min(v[i] for v in vs) for i in range(3)]), Vector([max(v[i] for v in vs) for i in range(3)]))


def inside(b, box):
    lo, hi = box
    return all(b[0][i] >= lo[i] - 1e-6 and b[1][i] <= hi[i] + 1e-6 for i in range(3))


def cut(boxes, split_rx):
    """Delete every mesh, or loose part of a split mesh, that lies wholly inside a box."""
    n = 0
    for o in list(meshes()):
        if split_rx and re.search(split_rx, key_of(o)):
            parts = separate_loose(o)
        else:
            parts = [o]
        for p in parts:
            b = bbox(p)
            if b is None or any(inside(b, bx) for bx in boxes):
                bpy.data.objects.remove(p, do_unlink=True); n += 1
    return n


def patch(rx, lo, hi):
    """Lettering moulded into a panel: delete the faces whose centres sit in the box and close the
    gap with one flat plate on the panel's front-most plane (the box's x/z extent, facing -Y)."""
    n = 0
    for o in meshes():
        if not re.search(rx, key_of(o)): continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        M = o.matrix_world
        hit = [f for f in bm.faces if all(lo[i] <= (M @ f.calc_center_median())[i] <= hi[i] for i in range(3))]
        if not hit: bm.free(); continue
        y = min((M @ f.calc_center_median()).y for f in hit)
        mat = hit[0].material_index
        bmesh.ops.delete(bm, geom=hit, context="FACES"); n += len(hit)
        Mi = M.inverted()
        vs = [bm.verts.new(Mi @ Vector(p)) for p in ((lo.x, y, lo.z), (lo.x, y, hi.z), (hi.x, y, hi.z), (hi.x, y, lo.z))]
        f = bm.faces.new(vs); f.material_index = mat
        f.normal_update()
        if (M.to_3x3() @ f.normal).y > 0: f.normal_flip()
        bm.to_mesh(o.data); bm.free()
    return n


def decimate(rules):
    for o in meshes():
        for rx, ratio in rules:
            if re.search(rx, key_of(o)) and ratio < 1.0:
                m = o.modifiers.new("dec", "DECIMATE"); m.ratio = ratio
                with bpy.context.temp_override(object=o, active_object=o, selected_editable_objects=[o]):
                    bpy.ops.object.modifier_apply(modifier="dec")
                break


def join(group, name):
    if not group: return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in group: o.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    with bpy.context.temp_override(active_object=group[0], selected_editable_objects=group, selected_objects=group):
        bpy.ops.object.join()
    group[0].name = name; group[0].data.name = name
    return group[0]


def tris():
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes())


def run(cfg, outdir):
    dims = json.load(open(os.path.join(ROOT, "truck-dims.json")))[cfg["key"]]
    load(os.path.join(ROOT, ".source", cfg["src"]))
    log("source tris", tris())
    w = level(cfg["tire"], cfg["yaw"])
    f = (w["FL"]["c"] + w["FR"]["c"]) / 2; r = (w["RL"]["c"] + w["RR"]["c"]) / 2
    src_wb = r.y - f.y
    src_r = sum(max(x["s"].y, x["s"].z) for x in w.values()) / 8
    src_track = ((w["FL"]["c"].x - w["FR"]["c"].x) + (w["RL"]["c"].x - w["RR"]["c"].x)) / 2
    wb = dims["wheelbaseIn"] * IN; rs = dims["stockTireOdIn"] / 2 * IN; half = dims["trackIn"] / 2 * IN
    k = wb / src_wb
    log("source wheelbase %.4f track %.4f tire radius %.4f (units); scale %.5f" % (src_wb, src_track, src_r, k))
    log("scaled: wheelbase %.1f in, track %.1f in, tire OD %.1f in" % (src_wb * k / IN, src_track * k / IN, 2 * src_r * k / IN))
    # front axle centre to the origin, wheel centre to the stock tire radius: a source on bigger
    # tires is lowered by the radius difference, a smaller one raised
    mid_x = (f.x + r.x) / 2
    apply(Matrix.Translation((0, 0, rs)) @ Matrix.Scale(k, 4) @ Matrix.Translation((-mid_x, -f.y, -(f.z + r.z) / 2)))
    w = wheels(cfg["tire"])
    gone = drop(cfg["drop"])
    log("dropped", len(gone), "meshes")
    # wheel volumes: the tire's own box, widened inboard for brakes and hubs
    boxes = []
    for kk, x in w.items():
        c, s = x["c"], x["s"]; rr = max(s.y, s.z) / 2 * 1.04
        inboard = -1 if kk[1] == "L" else 1          # left wheels sit at +x, inboard is -x
        x0, x1 = c.x - s.x / 2 - 0.02, c.x + s.x / 2 + 0.02
        if inboard < 0: x0 -= cfg.get("hub_depth", 0.18)
        else: x1 += cfg.get("hub_depth", 0.18)
        boxes.append((Vector((x0, c.y - rr, c.z - rr)), Vector((x1, c.y + rr, c.z + rr))))
    boxes += [(Vector(a), Vector(b)) for a, b in cfg.get("cut", [])]
    log("cut", cut(boxes, cfg.get("split")), "parts inside wheel and cut boxes")
    # BODYKIT_PROBE="x0,y0,z0,x1,y1,z1[;...]": list what touches a region (for finding badges)
    for spec in filter(None, os.environ.get("BODYKIT_PROBE", "").split(";")):
        v = [float(t) for t in spec.split(",")]; lo, hi = Vector(v[:3]), Vector(v[3:])
        log("probe", spec)
        for o in meshes():
            b = bbox(o)
            if b and all(b[0][i] <= hi[i] and b[1][i] >= lo[i] for i in range(3)):
                n_in = sum(1 for p in o.data.polygons if all(lo[i] <= (o.matrix_world @ p.center)[i] <= hi[i] for i in range(3)))
                log("   %-24s tris %6d in %5d  lo %s hi %s  %s" % (o.name, len(o.data.polygons), n_in, tuple(round(t, 3) for t in b[0]), tuple(round(t, 3) for t in b[1]), [m.name[:24] for m in o.data.materials if m]))
    for rx, a, b in cfg.get("patch", []):
        log("patched", patch(rx, Vector(a), Vector(b)), "faces")
    decimate(cfg.get("heavy", []))
    def mats(o): return [m.name for m in o.data.materials if m]
    paint = [o for o in meshes() if any(re.search(cfg["paint"], m) for m in mats(o))]
    # a mesh that mixes paint with other materials keeps only its paint faces in the body
    body_parts = []
    for o in paint:
        others = [i for i, m in enumerate(o.data.materials) if m and not re.search(cfg["paint"], m.name)]
        if others:
            bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
            bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="DESELECT")
            for i in others:
                o.active_material_index = i; bpy.ops.object.material_slot_select()
            bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
        body_parts.append(o)
    body = join(body_parts, "body")
    glass = join([o for o in meshes() if o is not body and re.search(cfg["glass"], key_of(o), re.I)], "glass")
    chassis = join([o for o in meshes() if o not in (body, glass)], "chassis")
    body.data.materials.clear(); body.data.materials.append(bpy.data.materials.new("paint"))
    for name, x, y in (("hub_FL", half, 0), ("hub_FR", -half, 0), ("hub_RL", half, wb), ("hub_RR", -half, wb)):
        e = bpy.data.objects.new(name, None); e.location = (x, y, rs); bpy.context.scene.collection.objects.link(e)
    top = [ (body.matrix_world @ v.co).z for v in body.data.vertices if abs((body.matrix_world @ v.co).y - wb * 0.85) < 0.15 ]
    bed = bpy.data.objects.new("bed", None); bed.location = (0, wb * 0.8, max(top) if top else 1.2)
    bpy.context.scene.collection.objects.link(bed)
    zmin = min((o.matrix_world @ Vector(c)).z for o in meshes() for c in o.bound_box)
    log("lowest point m %.3f, bed top %.3f, tris %d" % (zmin, bed.location.z, tris()))
    for o in meshes(): log("  ", o.name, sum(len(p.vertices) - 2 for p in o.data.polygons), [m.name for m in o.data.materials if m][:6])
    os.makedirs(outdir, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(outdir, cfg["key"] + ".gltf"), export_format="GLTF_SEPARATE", export_yup=True,
                              export_apply=True, export_image_format="AUTO", export_texture_dir="textures")
    log("exported", cfg["key"])

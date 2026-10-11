# blender -b -P tools/3d/prepare-gmc2500.py -- <outdir>
# Turns the CC-BY "GMC SIERRA HD2500" (01, Sketchfab) into the DROOOLY gmc2500 body. The source
# is the 2020+ Sierra HD crew cab, standard bed, at about 1/2.5 scale, Z up, front toward +X
# after a 61.3 degree yaw in the ground plane; it is turned to the contract, levelled on its
# tire centres and scaled so its wheelbase is the platform's 158.9 in.
# Deleted: every GMC letter set and badge (grille, tailgate, fenders, doors), the DURAMAX /
# Allison badges, both Tamaulipas plates, the rear-window sticker, the windshield sun strip,
# all four wheels with their caps, brakes and tires, and the engine.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bodykit

CFG = dict(
    key="gmc2500-crew",
    src="gmc-sierra-hd2500/scene.gltf",
    yaw=-151.9,
    tire=r"material_91$",
    # by material: 15 DURAMAX/Allison badges, 78 and 90 plates, 84 an invisible shell, 88 the
    # windshield sun strip, 89 the rear-window sticker, 91-96 tires and rims, 16 the engine,
    # 50 the engine-bay photo plane. By object, found with BODYKIT_PROBE: 684/686/688 the grille
    # GMC, 714/716 the tailgate GMC, 712 the tailgate DENALI, 576/594 two fender decals
    # decals, 98 and 262 the two meshes that sample the GMC-lettered atlases (materials 18, 46).
    drop=r"material_(15|16|50|78|84|88|89|90|91|92|93|94|95|96)$|^Object_(684|686|688|712|714|716|576|594|98|262) ",
    split=r".",
    # the DENALI HD letters on both front doors (Object_128 and Object_168, 72 loose parts each)
    cut=[((0.985, 0.76, 0.765), (1.015, 1.41, 0.82)), ((-1.015, 0.76, 0.765), (-0.985, 1.41, 0.82))],
    paint=r"^material_0$",
    glass=r"material_(69|76|85|86|87)$",
    heavy=[],
)

if __name__ == "__main__":
    bodykit.run(CFG, sys.argv[sys.argv.index("--") + 1:][0])

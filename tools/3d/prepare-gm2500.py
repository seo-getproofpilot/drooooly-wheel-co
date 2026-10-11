# blender -b -P tools/3d/prepare-gm2500.py -- <outdir>
# Turns the CC-BY "Chevy Silverado 2500HD" (David_Holiday, Sketchfab) into the DROOOLY gm2500
# body. The source is the 2015-2019 (K2) HD crew cab, standard bed, not the 2020+ T1 body the
# platform covers: it is the closest CC-BY Silverado HD found, and a stand-in until a T1 body
# replaces it. The source faces -X with the driver's side at -Y, is about 1/10.5 scale and sits
# rolled 0.8 degrees; it is turned to the contract, levelled on its tire centres and scaled so
# its wheelbase is the platform's 158.9 in.
# Deleted: both bowties (front and tailgate share one mesh), the "053" plate decal, every tire,
# rim, hub and brake part, the spare tire, and the fully transparent ghost shells
# (material_186f, 0___Default) the exporter left over the body.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bodykit

CFG = dict(
    key="gm2500-crew",
    src="chevy-silverado-2500hd/scene.gltf",
    yaw=90,
    tire=r"TXT_PNEU",
    drop=r"material_186f|0___Default|TXT_PNEU|gmc_denali_hd_rim|Color_D01_f9c7|Color_003_4b07",
    split=r".",
    # final-frame boxes (metres, Blender axes) found with BODYKIT_PROBE: the "2500 HD" letters
    # on both front fenders, the engraved tailgate bowtie, the grille bowtie, the "053" decal
    cut=[((0.92, 0.6, 0.87), (0.95, 1.06, 0.93)), ((-0.95, 0.6, 0.87), (-0.92, 1.06, 0.93)),
         ((-0.15, 5.05, 1.16), (0.15, 5.075, 1.27)),
         ((-0.15, -0.93, 1.005), (0.145, -0.90, 1.12)),
         ((0.57, 0.48, 0.40), (0.58, 0.73, 0.54))],
    paint=r"^Color_A01_3842",
    glass=r"Translucent_Glass",
    heavy=[],
)

if __name__ == "__main__":
    bodykit.run(CFG, sys.argv[sys.argv.index("--") + 1:][0])

# blender -b -P tools/3d/prepare-ram1500.py -- <outdir>
# Turns the CC-BY "2021-ram-1500-trx" (007, Sketchfab) into the DROOOLY ram1500 body. The
# source is real scale x0.01 and already faces -Y (glTF +Z) with the driver's side at +X. It is
# the TRX: the right 5th-gen (DT) cab and bed, with the TRX's wide fenders, on 35 in tires. The
# body is scaled to the platform's 144.6 in wheelbase and dropped onto the platform's 34.1 in
# stock tire; the hubs sit on the platform's 68.4 in track, inboard of the TRX flares.
# Deleted: the Badge mesh (RAM grille and tailgate letters, TRX side badges), the
# ManufacturerPlate (rear plate), both wheel meshes, the calipers and the engine.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bodykit

CFG = dict(
    key="ram1500-crew",
    src="ram-1500-trx-2021/scene.gltf",
    yaw=0,
    tire=r"^polySurface1_",
    drop=r"Badge|ManufacturerPlate|Wheel1A|Callipers|^Engine_Geo",
    paint=r"Paint_Material",
    split=r"Grille",
    # the RAM letters moulded into the grille panel (the letters themselves were the Badge mesh)
    patch=[(r"Coloured_Geo", (-0.31, -1.0, 0.965), (0.31, -0.8, 1.125))],
    glass=r"Window_Material",
    heavy=[(r"Interior_Geo|InteriorTilling|SeatBelt", 0.3), (r"Light_Geo", 0.5), (r"Coloured_Geo", 0.6), (r"Paint_Geo", 0.8)],
)

if __name__ == "__main__":
    bodykit.run(CFG, sys.argv[sys.argv.index("--") + 1:][0])

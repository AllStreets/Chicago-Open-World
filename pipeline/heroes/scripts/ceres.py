# pipeline/heroes/scripts/ceres.py — CBOT's Ceres (John Storrs, 1930): a faceless Art Deco goddess in cast aluminium,
# 9.4 m (31 ft) tall, a sheaf of wheat raised in her left hand and a bag of corn in her right.
# Sources: https://en.wikipedia.org/wiki/Chicago_Board_of_Trade_Building · https://en.wikipedia.org/wiki/John_Storrs
# Run: blender -b -P pipeline/heroes/scripts/ceres.py -- --out pipeline/heroes/out/ceres.glb
# Built in metres around the origin, Blender +Z up, facing +Y (north once exported +Y-up: the building faces north).
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from _export import args, clear_scene, export_glb  # noqa: E402
from _shapes import finish, lathe, limb  # noqa: E402

H = 9.4


def main():
    out = args().get('out', os.path.join(os.path.dirname(__file__), '..', 'out', 'ceres.glb'))
    clear_scene()
    parts = []
    # the robe: long vertical pleats from the hem to the bust, narrowing at the waist
    parts.append(lathe('robe', [(1.25, 0.0), (1.3, 0.25), (1.12, 2.6), (0.92, 4.6), (0.98, 5.6), (1.02, 6.5), (0.95, 6.85), (0.7, 7.1), (0.36, 7.22), (0.0, 7.25)],
                       sides=72, flutes=24, flute_depth=0.1))
    # neck, the faceless head (a smooth ovoid) and a stepped Deco headdress
    parts.append(lathe('neck', [(0.34, 7.1), (0.3, 7.55), (0.0, 7.56)], sides=24))
    parts.append(lathe('head', [(0.0, 7.45), (0.38, 7.7), (0.46, 8.05), (0.42, 8.4), (0.3, 8.62), (0.0, 8.7)], sides=32))
    parts.append(lathe('headdress', [(0.5, 8.3), (0.54, 8.5), (0.36, 8.72), (0.4, 8.9), (0.18, 9.1), (0.0, 9.15)], sides=32))
    # shoulders and arms: the left raised holding the sheaf, the right lowered with the bag
    parts.append(limb('arm_l_upper', (-0.85, 0.05, 6.85), (-1.2, 0.25, 7.55), 0.22))
    parts.append(limb('arm_l_fore', (-1.25, 0.25, 7.5), (-1.15, 0.35, 8.25), 0.17))
    parts.append(limb('arm_r_upper', (0.85, 0.05, 6.85), (1.18, 0.3, 5.7), 0.22))
    parts.append(limb('arm_r_fore', (1.2, 0.3, 5.7), (1.05, 0.6, 4.95), 0.17))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.42, location=(1.02, 0.75, 4.6))
    bag = bpy.context.active_object
    bag.name = 'bag'
    bag.scale = (1, 0.9, 1.25)
    parts.append(bag)
    # the wheat sheaf: stalks fanning up from her hand to the top of the figure, tied at the grip
    for i in range(11):
        a = (i - 5) * 0.1
        top = (-1.15 + math.sin(a) * 1.1, 0.35 + math.cos(i * 1.3) * 0.15, H - 0.02 - abs(i - 5) * 0.06)
        parts.append(limb(f'stalk{i}', (-1.15, 0.35, 7.9), top, 0.07))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.13, location=top)
        ear = bpy.context.active_object
        ear.name = f'ear{i}'
        ear.scale = (0.7, 0.7, 2.2)
        parts.append(ear)
    finish(parts, H)
    export_glb([ob.name for ob in parts], os.path.abspath(out), 12000)


main()

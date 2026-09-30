# pipeline/heroes/scripts/statue_goethe.py — the Goethe Monument (Hermann Hahn, 1913, Lincoln Park): Goethe as an
# idealised Olympian, a cloak over his shoulder, his left foot raised on a rock where an eagle perches. The bronze
# is 25 ft (7.6 m). Source: https://en.wikipedia.org/wiki/Goethe_Monument_(Chicago)
# Run: blender -b -P pipeline/heroes/scripts/statue_goethe.py -- --out pipeline/heroes/out/statue_goethe.glb
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from _export import args, clear_scene, export_glb  # noqa: E402
from _shapes import box, ellipsoid, finish, lathe, limb  # noqa: E402

H = 7.6


def main():
    out = args().get('out', os.path.join(os.path.dirname(__file__), '..', 'out', 'statue_goethe.glb'))
    clear_scene()
    p = []
    p.append(box('rock', (-0.45, 0.35, 0.55), (0.9, 0.9, 1.1)))
    p.append(limb('leg_r', (0.25, 0.0, 0.0), (0.2, 0.0, 3.3), 0.24))
    p.append(limb('shin_l', (-0.45, 0.4, 1.1), (-0.35, 0.3, 2.3), 0.22))
    p.append(limb('thigh_l', (-0.35, 0.3, 2.3), (-0.2, 0.0, 3.3), 0.26))
    # torso, and the cloak falling from the left shoulder to the rock
    p.append(lathe('torso', [(0.42, 3.2), (0.36, 3.9), (0.44, 4.9), (0.56, 5.55), (0.3, 5.85), (0.0, 5.9)], sides=24))
    p.append(lathe('cloak', [(0.5, 1.2), (0.55, 2.6), (0.5, 4.2), (0.45, 5.6), (0.0, 5.75)], sides=16))
    p.append(limb('neck', (0.0, 0.0, 5.8), (0.0, 0.05, 6.2), 0.18))
    p.append(ellipsoid('head', (0.0, 0.08, 6.5), (0.26, 0.3, 0.36)))
    p.append(limb('arm_r_up', (0.58, 0.0, 5.5), (0.72, 0.1, 4.5), 0.16))
    p.append(limb('arm_r_fore', (0.72, 0.1, 4.5), (0.6, 0.35, 3.7), 0.14))
    p.append(limb('arm_l_up', (-0.58, 0.0, 5.5), (-0.7, 0.2, 4.6), 0.16))
    p.append(limb('arm_l_fore', (-0.7, 0.2, 4.6), (-0.45, 0.45, 3.6), 0.14))
    # the eagle on the rock at his knee
    p.append(ellipsoid('eagle', (-0.75, 0.6, 1.55), (0.22, 0.3, 0.4)))
    p.append(ellipsoid('eagle_head', (-0.75, 0.72, 2.0), (0.11, 0.13, 0.13)))
    p.append(ellipsoid('wing_l', (-0.98, 0.55, 1.6), (0.07, 0.28, 0.42)))
    p.append(ellipsoid('wing_r', (-0.52, 0.55, 1.6), (0.07, 0.28, 0.42)))
    finish(p, H)
    export_glb([o.name for o in p], os.path.abspath(out), 12000)


main()

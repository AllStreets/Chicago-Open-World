# pipeline/heroes/scripts/statue_lincoln.py — Standing Lincoln ("Abraham Lincoln: The Man", Augustus Saint-Gaudens,
# 1887, Lincoln Park): Lincoln risen from the chair behind him, head bowed, left hand at his coat lapel, the right
# behind his back. The bronze is 12 ft (3.7 m). Source: https://en.wikipedia.org/wiki/Abraham_Lincoln:_The_Man
# Run: blender -b -P pipeline/heroes/scripts/statue_lincoln.py -- --out pipeline/heroes/out/statue_lincoln.glb
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from _export import args, clear_scene, export_glb  # noqa: E402
from _shapes import box, ellipsoid, finish, lathe, limb  # noqa: E402

H = 3.7


def main():
    out = args().get('out', os.path.join(os.path.dirname(__file__), '..', 'out', 'statue_lincoln.glb'))
    clear_scene()
    p = []
    p.append(limb('leg_l', (-0.12, 0.02, 0.0), (-0.1, 0.0, 1.55), 0.1))
    p.append(limb('leg_r', (0.13, -0.05, 0.0), (0.1, 0.0, 1.55), 0.1))
    p.append(box('shoe_l', (-0.12, 0.12, 0.05), (0.12, 0.3, 0.1)))
    p.append(box('shoe_r', (0.13, 0.07, 0.05), (0.12, 0.3, 0.1)))
    # the frock coat: tails to the knee, buttoned body, square shoulders
    p.append(lathe('coat', [(0.32, 0.95), (0.3, 1.3), (0.25, 1.75), (0.26, 2.2), (0.33, 2.62), (0.24, 2.78), (0.0, 2.8)], sides=24))
    p.append(limb('neck', (0.0, 0.03, 2.75), (0.0, 0.07, 2.92), 0.08))
    p.append(ellipsoid('head', (0.0, 0.12, 3.08), (0.12, 0.14, 0.17)))    # bowed: set forward of the neck
    p.append(ellipsoid('beard', (0.0, 0.2, 2.97), (0.1, 0.07, 0.09)))
    # left hand to the lapel, right arm behind the back
    p.append(limb('arm_l_up', (-0.3, 0.0, 2.6), (-0.3, 0.12, 2.2), 0.075))
    p.append(limb('arm_l_fore', (-0.3, 0.12, 2.2), (-0.1, 0.22, 2.45), 0.065))
    p.append(limb('arm_r_up', (0.3, 0.0, 2.6), (0.3, -0.12, 2.2), 0.075))
    p.append(limb('arm_r_fore', (0.3, -0.12, 2.2), (0.05, -0.28, 2.05), 0.065))
    # the chair he has risen from
    p.append(box('seat', (0.0, -0.75, 0.95), (1.0, 0.7, 0.12)))
    p.append(box('chair_back', (0.0, -1.08, 1.6), (1.0, 0.1, 1.2)))
    for x, y in [(-0.45, -0.45), (0.45, -0.45), (-0.45, -1.05), (0.45, -1.05)]:
        p.append(limb(f'chair_leg{x}{y}', (x, y, 0.0), (x, y, 0.9), 0.05))
    finish(p, H)
    export_glb([o.name for o in p], os.path.abspath(out), 12000)


main()

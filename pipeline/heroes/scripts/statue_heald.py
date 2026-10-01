# pipeline/heroes/scripts/statue_heald.py — the Heald Square Monument (Lorado Taft, completed by Leonard Crunelle,
# 1941; Wacker Drive at Wabash Avenue): George Washington standing between the two financiers of the Revolution,
# Robert Morris (his right) and Haym Salomon (his left), clasping a hand of each. Bronze on a granite pedestal.
# Poses and the figures' height are read from photographs (approximate). A-8 / A41 (plan 2026-10-01 §2).
# Run: blender -b -P pipeline/heroes/scripts/statue_heald.py -- --out pipeline/heroes/out/statue_heald.glb
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from _export import args, clear_scene, export_glb  # noqa: E402
from _shapes import box, finish, lathe, limb  # noqa: E402
from _figure import standing  # noqa: E402

H = 3.4  # the group's height (heroic scale; approximate)


def shift(parts, dx, dy=0.0):
    for ob in parts:
        ob.location.x += dx
        ob.location.y += dy
    return parts


def skirts(name, dx):
    """An 18th-century coat's skirts from the hip to the knee, over breeches (the frock in _figure stops at the hip)."""
    ob = lathe(name, [(0.31, 0.5), (0.3, 0.7), (0.28, 0.95), (0.0, 0.96)], sides=20)
    ob.location.x += dx
    return ob


def main():
    out = args().get('out', os.path.join(os.path.dirname(__file__), '..', 'out', 'statue_heald.glb'))
    clear_scene()
    p = []
    # Washington, centre, a little taller and forward; his hands out to each side, clasping theirs at waist height
    w = standing('w', coat='cloak', arm_l=(-0.5, 0.12, 1.08), arm_r=(0.5, 0.12, 1.08), stance=0.1)
    for ob in w:  # scale about the origin, keeping each part's own scale (an ellipsoid's radii live in it)
        ob.scale = tuple(k * 1.06 for k in ob.scale)
        ob.location = ob.location * 1.06
    p += shift(w, 0.0, 0.12)
    # Morris (Washington's right = −x as he faces +y… the viewer's left), his left hand in Washington's
    m = standing('m', coat='frock', arm_l=(-0.32, 0.05, 0.9), arm_r=(0.36, 0.08, 1.06), stance=0.14)
    p += shift(m, -0.86)
    p.append(skirts('m_skirts', -0.86))
    # Salomon, his right hand in Washington's, the left at his coat
    s = standing('s', coat='frock', arm_l=(-0.36, 0.08, 1.06), arm_r=(0.12, 0.2, 1.3), stance=0.12)
    p += shift(s, 0.86)
    p.append(skirts('s_skirts', 0.86))
    # the bronze base plate the three stand on
    p.append(box('plate', (0.0, 0.05, 0.03), (2.6, 0.8, 0.06)))
    finish(p, H)
    export_glb([o.name for o in p], os.path.abspath(out), 9000)


main()

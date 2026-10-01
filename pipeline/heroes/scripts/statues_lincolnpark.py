# pipeline/heroes/scripts/statues_lincolnpark.py — the Lincoln Park monuments the B-6 pass adds, one glb each
# (figurative, so Blender per heroMethod.chooseMethod). Sources and heights in heroes.json; poses from photographs.
#   Schiller (Ernst Rau, 1886): the poet standing in a long coat, a scroll in his lowered left hand, the right at his chest.
#   Hans Christian Andersen (Johannes Gelert, 1896): seated on a tree stump, an open book on his knee, a swan at his feet.
#   Alexander Hamilton (John Angel, 1939/1952): standing in frock coat and cape, the right hand forward (gilded).
#   A Signal of Peace (Cyrus Dallin, 1890): a Sioux chief in war bonnet on his pony, the spear raised high.
#   Benjamin Franklin (Richard Henry Park, 1896): standing in a long coat, the hat held at his side, the left hand on a cane.
#   John Peter Altgeld (Gutzon Borglum, 1915): the governor's hand stretched over a working man, his wife and child.
# Run: blender -b -P pipeline/heroes/scripts/statues_lincolnpark.py -- --which all
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from _export import args, clear_scene, export_glb  # noqa: E402
from _shapes import box, ellipsoid, finish, lathe, limb  # noqa: E402
from _figure import horse, standing  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', 'out')


def schiller():
    p = standing('s', coat='cloak', arm_l=(-0.28, 0.12, 0.98), arm_r=(0.05, 0.2, 1.42), stance=0.15)
    p.append(limb('scroll', (-0.3, 0.1, 0.9), (-0.3, 0.14, 1.12), 0.035))
    return p, 2.9


def andersen():
    p = []
    p.append(lathe('stump', [(0.32, 0.0), (0.26, 0.2), (0.24, 0.55), (0.27, 0.6), (0.0, 0.62)], sides=14))
    p.append(lathe('a_coat', [(0.28, 0.55), (0.24, 0.8), (0.22, 1.05), (0.26, 1.2), (0.12, 1.24), (0.0, 1.25)], sides=20))
    for sx in (-1, 1):  # the thighs forward over the stump's edge, the shins down
        p.append(limb(f'thigh{sx}', (0.11 * sx, 0.0, 0.66), (0.12 * sx, 0.45, 0.62), 0.085))
        p.append(limb(f'shin{sx}', (0.12 * sx, 0.45, 0.62), (0.13 * sx, 0.55, 0.05), 0.07))
        p.append(box(f'shoe{sx}', (0.13 * sx, 0.64, 0.04), (0.1, 0.25, 0.08)))
    p.append(limb('a_neck', (0.0, 0.03, 1.22), (0.0, 0.07, 1.31), 0.055))
    p.append(ellipsoid('a_head', (0.0, 0.1, 1.41), (0.09, 0.105, 0.12), 16, 10))
    p.append(ellipsoid('a_hair', (0.0, 0.07, 1.45), (0.1, 0.1, 0.1), 14, 8))
    p.append(box('book', (0.0, 0.38, 0.72), (0.34, 0.24, 0.03)))  # open on his knee
    p.append(limb('arm_l', (-0.25, 0.0, 1.15), (-0.18, 0.35, 0.78), 0.06))
    p.append(limb('arm_r', (0.25, 0.0, 1.15), (0.3, 0.25, 1.25), 0.06))  # the right hand raised, telling the tale
    # the swan at his feet: body, the S of its neck
    p.append(ellipsoid('swan', (0.45, 0.75, 0.16), (0.14, 0.26, 0.13)))
    p.append(limb('swan_n1', (0.45, 0.92, 0.2), (0.45, 1.0, 0.38), 0.035))
    p.append(limb('swan_n2', (0.45, 1.0, 0.38), (0.45, 0.95, 0.5), 0.03))
    return p, 2.4


def hamilton():
    p = standing('h', coat='frock', arm_l=(-0.3, 0.05, 0.95), arm_r=(0.3, 0.42, 1.22), stance=0.18)
    p.append(lathe('cape', [(0.4, 0.9), (0.36, 1.2), (0.32, 1.48), (0.2, 1.56), (0.0, 1.57)], sides=18))
    return p, 4.0


def franklin():
    p = standing('f', coat='frock', arm_l=(-0.32, 0.18, 0.95), arm_r=(0.3, 0.04, 0.95), stance=0.1, hair=True)
    p.append(limb('cane', (-0.36, 0.2, 0.0), (-0.33, 0.19, 0.98), 0.02))
    p.append(lathe('tricorne', [(0.16, 0.86), (0.13, 0.9), (0.0, 0.92)], sides=3))  # held at his side
    p[-1].location.x += 0.34
    return p, 2.9


def signal():
    p, (sx, sy, sz) = horse('pony', head_up=0.1)
    rider = standing('r', coat='robe', arm_l=(-0.25, 0.4, 1.0), arm_r=(0.35, 0.05, 2.15), hat='feathers', hair=False)
    for o in rider:
        o.location.z += sz - 0.95
        o.location.y += sy
    p += rider
    # the spear, raised in the right hand, a feather at its head
    p.append(limb('spear', (0.36, sy + 0.05, sz + 0.2), (0.38, sy + 0.1, sz + 2.6), 0.022))
    p.append(limb('spear_feather', (0.38, sy + 0.1, sz + 2.5), (0.42, sy + 0.05, sz + 2.2), 0.03))
    return p, 3.4


def altgeld():
    p = standing('g', coat='frock', arm_l=(-0.3, 0.05, 0.92), arm_r=(0.3, 0.6, 1.35), stance=0.12)
    # the family before him: the man (kneeling on one knee), the mother and her child
    man = standing('m', coat='jacket', arm_l=(-0.25, 0.25, 0.75), arm_r=(0.25, 0.25, 0.75), hair=True)
    for o in man:
        o.location.y += 0.75
        o.location.x += 0.45
        o.location.z -= 0.35
        o.scale = (o.scale[0] * 0.95, o.scale[1] * 0.95, o.scale[2] * 0.8)
        o.location.z *= 0.8
    woman = standing('w', coat='robe', arm_l=(-0.15, 0.25, 1.1), arm_r=(0.15, 0.25, 1.1), hair=True)
    for o in woman:
        o.location.y += 0.7
        o.location.x -= 0.45
        o.scale = tuple(v * 0.92 for v in o.scale)
        o.location.z *= 0.92
    p += man + woman
    p.append(ellipsoid('child', (-0.45, 0.95, 1.05), (0.1, 0.1, 0.22)))
    return p, 2.7


BUILD = {'schiller': schiller, 'andersen': andersen, 'hamilton': hamilton, 'franklin': franklin, 'signal': signal, 'altgeld': altgeld}


def main():
    which = args().get('which', 'all')
    for k, fn in BUILD.items():
        if which not in ('all', k):
            continue
        clear_scene()
        parts, h = fn()
        finish(parts, h)
        export_glb([o.name for o in parts], os.path.abspath(os.path.join(OUT, f'statue_{k}.glb')), 12000)


main()

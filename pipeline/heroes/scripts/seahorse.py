# pipeline/heroes/scripts/seahorse.py — one of Buckingham Fountain's bronze sea horses (Marcel Loyau, 1927): a
# hippocampus rearing from its rock, horse forequarters with webbed forefins, an arched maned neck, a coiled fishtail.
# Built in the procedural unit's frame (lib/landmarks.js seahorseUnit: +X forward, mouth at (2.3, 1.68) — the jet
# anchor), so the Blender unit can replace it without moving the water. glTF: x = x, y = Blender z, z = −Blender y.
# Source: https://en.wikipedia.org/wiki/Buckingham_Fountain
# Run: blender -b -P pipeline/heroes/scripts/seahorse.py -- --out pipeline/heroes/out/seahorse.glb
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from _export import args, clear_scene, export_glb  # noqa: E402
from _shapes import ellipsoid, lathe, limb, sweep  # noqa: E402

MOUTH = (1.85, 0.0, 3.15)   # lib/landmarks.js SEAHORSE_MOUTH [1.85, 3.15, 0], in Blender axes


def bez(a, b, c, d, t):
    return tuple((1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * b[k] + 3 * (1 - t) * t * t * c[k] + t ** 3 * d[k] for k in range(3))


# the rearing pose of lib/landmarks.js SEAHORSE_POSE (JS (x, y, z) = Blender (x, −y… lateral, z up))
def body(t):
    return bez((-0.6, 0.0, 1.2), (0.1, 0.0, 1.55), (0.75, 0.0, 2.4), (0.8, 0.0, 3.5), t)


def body_r(t):
    return 0.5 * math.sin(math.pi * min(1.0, 0.25 + 0.9 * t)) + 0.16


def tail(k):
    a = k * 0.16
    return (-0.6 - 1.25 * math.sin(min(a, 1.4)) - 0.45 * math.sin(a), -0.5 * (1 - k / 48) * math.sin(a * 0.5), 1.2 - 0.32 * (1 - math.cos(a)))


def main():
    out = args().get('out', os.path.join(os.path.dirname(__file__), '..', 'out', 'seahorse.glb'))
    clear_scene()
    p = []
    spine = [body(i / 29) for i in range(30)]
    p.append(sweep('body', spine, body_r, sides=16, squash=0.8))
    # the head: from the poll out to the muzzle, a little Roman-nosed, ending at the jet's mouth
    top = spine[-1]
    head = [tuple(top[k] + (MOUTH[k] - top[k]) * s + (0, 0, 0.15 * math.sin(math.pi * s))[k] for k in range(3)) for s in [i / 9 for i in range(10)]]
    p.append(sweep('head', head, lambda t: 0.46 - 0.2 * t, sides=14, squash=0.7))
    p.append(ellipsoid('jaw', (1.2, 0.0, 3.3), (0.42, 0.24, 0.3), 14, 8))
    p.append(limb('ear_l', (0.85, 0.14, 3.75), (0.72, 0.2, 4.1), 0.06))
    p.append(limb('ear_r', (0.85, -0.14, 3.75), (0.72, -0.2, 4.1), 0.06))
    # the mane: fin-like tufts along the back of the arched neck
    for i in range(16, 29, 2):
        x, _, z = spine[i]
        f = ellipsoid(f'mane{i}', (x - 0.32, 0.0, z + 0.12), (0.26, 0.05, 0.2), 10, 6)
        f.rotation_euler = (0.0, 0.9, 0.0)
        p.append(f)
    # forelegs reaching forward and down, each ending in a webbed fin
    sx, _, sz = body(0.62)
    for s in (-1, 1):
        hip, knee, hoof = (sx, 0.4 * s, sz - 0.15), (sx + 0.5, 0.52 * s, sz - 0.5), (sx + 0.95, 0.6 * s, sz - 1.3)
        p.append(limb(f'arm{s}', hip, knee, 0.17))
        p.append(limb(f'shin{s}', knee, hoof, 0.13))
        p.append(ellipsoid(f'fin{s}', (hoof[0] + 0.22, hoof[1], hoof[2] - 0.05), (0.33, 0.07, 0.3), 12, 6))  # reaches as far as the stand-in's fin
    # the fishtail coiling over the back of the rock
    coil = [tail(k) for k in range(40)]
    p.append(sweep('tail', coil, lambda t: 0.3 * (1 - t) + 0.05, sides=12))
    tip = coil[-1]
    p.append(ellipsoid('fluke', (tip[0], tip[1], tip[2] + 0.1), (0.12, 0.38, 0.22), 10, 6))
    # the rock it rears from
    p.append(lathe('rock', [(1.6, 0.0), (1.45, 0.45), (1.2, 0.8), (0.8, 1.05), (0.0, 1.2)], sides=20, flutes=5, flute_depth=0.12))
    export_glb([o.name for o in p], os.path.abspath(out), 6000)


main()

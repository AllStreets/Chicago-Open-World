# pipeline/heroes/scripts/dusable_reliefs.py — the four 1928 reliefs on the DuSable (Michigan Avenue) Bridge's
# bridgehouses (A-9), one glb each, carved in high relief on a Bedford-stone panel.
#   NW  The Discoverers  (James Earle Fraser): Jolliet, Marquette, La Salle and Tonti.
#   NE  The Pioneers     (James Earle Fraser): John Kinzie leading settlers through the wilderness.
#   SW  Defense          (Henry Hering): Ensign George Ronan at the 1812 Battle of Fort Dearborn, the winged spirit above.
#   SE  Regeneration     (Henry Hering): workers rebuilding Chicago after the 1871 fire, the winged spirit above.
# Source: https://en.wikipedia.org/wiki/DuSable_Bridge (reliefs, corners, sculptors). The compositions (who stands
# where, the poses, the winged figures, the trees and the canoe) are read from photographs and are approximate.
#
# Local frame (Blender, metres, +Z up): the panel spans x −2.2…2.2, z 0…6.0, its face at y = 0.3 (no back face: it is
# set against the bridgehouse wall); the figures stand out toward +Y. Exported +Y up, so in the glb the panel faces −Z
# (glTF "north") and lib/bridgehouses.js turns it to face away from the river.
# Run: blender -b -P pipeline/heroes/scripts/dusable_reliefs.py -- --which all
import math
import os
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(__file__))
from _export import args, clear_scene, export_glb  # noqa: E402
from _shapes import box, ellipsoid, lathe, limb  # noqa: E402
from _figure import standing  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', 'out')
W, H, FACE = 4.4, 6.0, 0.3
MAX_TRIS = 2200  # lean for the perf budget (≤ 3.5 M at every perf pose); the figures still read at the street


def panel(name):
    """The stone ground: front face, four edges and a raised border (a frame 0.18 m proud), no back face."""
    # a closed slab 0…FACE deep, then its back face (normal −Y, against the wall) removed
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x, v.co.y, v.co.z = v.co.x * W, (v.co.y + 0.5) * FACE, (v.co.z + 0.5) * H
    bm.normal_update()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.y < -0.9], context='FACES_ONLY')
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    parts = [ob]
    b = 0.16  # the moulded border, proud of the ground
    parts.append(box(f'{name}_top', (0, FACE + 0.09, H - b / 2), (W, 0.18, b)))
    parts.append(box(f'{name}_l', (-W / 2 + b / 2, FACE + 0.09, H / 2), (b, 0.18, H)))
    parts.append(box(f'{name}_r', (W / 2 - b / 2, FACE + 0.09, H / 2), (b, 0.18, H)))
    # the inscription tablet under the scene, its lettering a row of shallow blocks
    parts.append(box(f'{name}_ledge', (0, FACE + 0.14, 0.95), (W, 0.28, 0.14)))
    for k in range(9):
        parts.append(box(f'{name}_txt{k}', (-1.6 + k * 0.4, FACE + 0.03, 0.5), (0.26, 0.06, 0.16)))
    return parts


def apply(parts):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def carve(parts, x, z0, height, depth=0.55, mirror=False, turn=0.0, nominal=1.85):
    """Stand a figure built facing +Y (nominal height) in the relief: scaled to `height`, its feet at (x, z0), its depth
    compressed (high relief) and its back set into the panel face. `turn` swings it toward ±X (profile), `mirror` flips."""
    apply(parts)
    k = height / nominal
    c, s = math.cos(turn), math.sin(turn)
    for ob in parts:
        for v in ob.data.vertices:
            px, py, pz = v.co.x * (-1 if mirror else 1), v.co.y, v.co.z
            px, py = px * c - py * s, px * s + py * c
            v.co.x = x + px * k
            v.co.y = FACE + (py * k + 0.34 * k) * depth
            v.co.z = z0 + pz * k
    return parts


def wings(name, at, span, up=0.0):
    """A winged allegorical figure flying over the scene (Hering): a robed body stretched almost level, the head and
    the leading arm forward (+X), the trailing robe behind, and two great wings raised in a fan of long feathers."""
    x, z = at
    p = []
    body = lathe(f'{name}_robe', [(0.0, -1.1), (0.16, -1.0), (0.26, -0.5), (0.24, 0.0), (0.2, 0.3), (0.14, 0.42), (0.0, 0.46)], sides=12)
    body.rotation_euler = (0, 1.25, 0)  # the long axis swung toward +X: flying, slightly rising
    body.location = (x, FACE + 0.16, z)
    body.scale = (1.0, 0.6, 1.0)
    p.append(body)
    p.append(ellipsoid(f'{name}_head', (x + 0.6, FACE + 0.18, z + 0.28), (0.15, 0.1, 0.16), 10, 6))
    p.append(ellipsoid(f'{name}_hair', (x + 0.52, FACE + 0.14, z + 0.33), (0.16, 0.08, 0.13), 8, 5))
    p.append(limb(f'{name}_arm', (x + 0.35, FACE + 0.22, z + 0.2), (x + 1.15, FACE + 0.26, z + 0.45 + up), 0.06))
    p.append(limb(f'{name}_arm2', (x + 0.3, FACE + 0.12, z + 0.12), (x + 0.9, FACE + 0.14, z - 0.2), 0.055))
    for side, (ox, lift) in enumerate([(-0.15, 1.0), (0.15, 0.85)]):  # far wing a little lower, both rising behind
        root = (x + ox, FACE + 0.1 + 0.06 * side, z + 0.2)
        for f in range(7):
            a = math.radians(95 + f * 14)  # fanned from straight up toward the trailing side
            L = span * (0.55 + 0.07 * f) * lift
            tip = (root[0] + math.cos(a) * L, root[1], root[2] + math.sin(a) * L)
            mid = ((root[0] + tip[0]) / 2, root[1], (root[2] + tip[2]) / 2)
            fe = ellipsoid(f'{name}_feather{side}{f}', mid, (L * 0.5, 0.05, 0.11), 10, 4)
            fe.rotation_euler = (0, -math.atan2(tip[2] - root[2], tip[0] - root[0]), 0)
            p.append(fe)
    return p


def kneeling(name, x, z0, height, facing=1):
    """A workman down on one knee setting a stone: torso upright over the bent knee, the shin back along the ground."""
    k = height / 1.85
    X = lambda dx: x + facing * dx * k
    Y = lambda dy: FACE + 0.2 + dy * k * 0.55
    Z = lambda dz: z0 + dz * k
    p = []
    p.append(lathe(f'{name}_torso', [(0.0, 0.0), (0.2, 0.02), (0.22, 0.3), (0.25, 0.5), (0.12, 0.56), (0.0, 0.57)], sides=12))
    p[-1].location = (X(0.0), Y(0.0), Z(0.62))
    p[-1].scale = (k, k * 0.55, k)
    p.append(ellipsoid(f'{name}_head', (X(0.04), Y(0.02), Z(1.3)), (0.095 * k, 0.07 * k, 0.12 * k), 10, 6))
    p.append(limb(f'{name}_thigh', (X(0.08), Y(0.05), Z(0.66)), (X(0.42), Y(0.08), Z(0.6)), 0.085 * k))
    p.append(limb(f'{name}_shin', (X(0.42), Y(0.08), Z(0.6)), (X(0.42), Y(0.08), Z(0.05)), 0.07 * k))
    p.append(limb(f'{name}_thigh2', (X(-0.05), Y(0.0), Z(0.66)), (X(-0.08), Y(0.0), Z(0.08)), 0.085 * k))
    p.append(limb(f'{name}_shin2', (X(-0.08), Y(0.0), Z(0.08)), (X(-0.6), Y(0.0), Z(0.06)), 0.07 * k))
    for i, dy in enumerate((0.12, -0.04)):
        p.append(limb(f'{name}_arm{i}', (X(0.0), Y(dy), Z(1.08)), (X(0.5), Y(dy + 0.05), Z(0.62)), 0.06 * k))
    return p


def tree(name, x, z0, h):
    p = [limb(f'{name}_trunk', (x, FACE + 0.06, z0), (x, FACE + 0.06, z0 + h * 0.55), 0.08)]
    for i, (dx, dz, r) in enumerate([(0, 0.62, 0.42), (-0.28, 0.5, 0.3), (0.3, 0.52, 0.32), (0.05, 0.82, 0.3)]):
        p.append(ellipsoid(f'{name}_crown{i}', (x + dx * h * 0.5, FACE + 0.08, z0 + dz * h), (r * h * 0.45, 0.08, r * h * 0.38), 10, 6))
    return p


def discoverers():
    # left to right: Marquette in his cassock raising the cross, Jolliet with the paddle, La Salle in plumed hat with
    # his hand on his sword, Tonti in profile pointing west; the prow of their canoe behind them
    p = panel('disc')
    m = standing('marq', coat='robe', arm_r=(0.25, 0.25, 1.95), arm_l=(-0.28, 0.12, 1.1))
    m.append(limb('marq_cross', (0.26, 0.26, 1.4), (0.26, 0.26, 2.35), 0.025))
    m.append(limb('marq_bar', (0.12, 0.26, 2.12), (0.4, 0.26, 2.12), 0.022))
    p += carve(m, -1.55, 1.05, 3.6)
    j = standing('jol', coat='frock', arm_l=(-0.3, 0.2, 1.3), arm_r=(0.28, 0.1, 0.95), stance=0.2)
    j.append(limb('jol_paddle', (-0.34, 0.24, 0.1), (-0.3, 0.2, 1.9), 0.03))
    j.append(box('jol_blade', (-0.34, 0.24, 0.25), (0.14, 0.04, 0.4)))
    p += carve(j, -0.5, 1.05, 3.5, turn=0.25)
    ls = standing('las', coat='frock', arm_l=(-0.32, 0.05, 0.95), arm_r=(0.34, 0.3, 1.25), hat='tricorne', stance=0.15)
    ls.append(limb('las_sword', (-0.3, 0.05, 0.95), (-0.25, -0.05, 0.25), 0.025))
    p += carve(ls, 0.55, 1.05, 3.7, turn=-0.15)
    t = standing('ton', coat='cloak', arm_r=(0.6, 0.55, 1.55), arm_l=(-0.25, 0.1, 0.95), stance=0.25)
    p += carve(t, 1.55, 1.05, 3.45, turn=-0.6)
    # the canoe's upturned prow and stern behind the group, and the waves at their feet
    p.append(limb('canoe', (-2.0, FACE + 0.08, 1.35), (2.0, FACE + 0.08, 1.35), 0.1))
    p.append(limb('prow', (2.0, FACE + 0.08, 1.35), (2.05, FACE + 0.08, 1.95), 0.08))
    for k in range(5):
        p.append(ellipsoid(f'wave{k}', (-1.8 + k * 0.9, FACE + 0.05, 1.12), (0.42, 0.06, 0.08), 10, 4))
    p += tree('disc_tree', 0.0, 4.6, 1.2)
    return p


def pioneers():
    # John Kinzie striding at the head with his rifle, his wife carrying a child, a settler with an axe over his
    # shoulder, a boy and the dog at their feet, the forest around them
    p = panel('pion')
    k = standing('kin', coat='frock', arm_r=(0.3, 0.35, 1.3), arm_l=(-0.3, 0.1, 1.0), hat='tricorne', stance=0.3)
    k.append(limb('kin_rifle', (0.32, 0.4, 1.3), (0.28, -0.1, 2.1), 0.03))
    p += carve(k, 1.35, 1.05, 3.7, turn=-0.5)
    w = standing('wife', coat='robe', arm_l=(-0.15, 0.25, 1.35), arm_r=(0.15, 0.25, 1.35))
    w.append(ellipsoid('child', (0.0, 0.3, 1.45), (0.16, 0.14, 0.26), 10, 6))
    w.append(ellipsoid('child_head', (0.05, 0.3, 1.72), (0.08, 0.08, 0.09), 8, 6))
    p += carve(w, 0.15, 1.05, 3.3, turn=-0.3)
    s = standing('settler', coat='jacket', arm_r=(0.2, 0.0, 1.65), arm_l=(-0.3, 0.12, 0.95), stance=0.2)
    s.append(limb('axe', (0.15, -0.05, 1.7), (0.5, -0.1, 2.25), 0.03))
    s.append(box('axe_head', (0.52, -0.1, 2.27), (0.06, 0.03, 0.2)))
    p += carve(s, -1.05, 1.05, 3.6, turn=-0.2)
    b = standing('boy', coat='jacket', arm_r=(0.3, 0.2, 0.9))
    p += carve(b, -1.75, 1.05, 2.1, turn=-0.3)
    p.append(ellipsoid('dog', (0.85, FACE + 0.18, 1.45), (0.42, 0.14, 0.18), 12, 6))
    p.append(ellipsoid('dog_head', (1.22, FACE + 0.2, 1.68), (0.14, 0.1, 0.12), 8, 6))
    p += tree('pion_tree_l', -1.6, 3.5, 2.4)
    p += tree('pion_tree_r', 1.6, 4.4, 1.5)
    return p


def defense():
    # Ensign Ronan, sword raised, meeting a warrior's tomahawk; a mother shielding her child behind him; the winged
    # spirit of Defense spreading over them
    p = panel('def')
    r = standing('ronan', coat='frock', arm_r=(0.35, 0.3, 2.05), arm_l=(-0.4, 0.3, 1.25), stance=0.35)
    r.append(limb('ronan_sword', (0.36, 0.3, 2.05), (0.55, 0.35, 2.75), 0.03))
    p += carve(r, -0.35, 1.05, 3.4, turn=0.6)
    wr = standing('warrior', coat='jacket', arm_r=(0.3, 0.35, 2.0), arm_l=(-0.35, 0.3, 1.2), hat='feathers', stance=0.35)
    wr.append(limb('toma', (0.32, 0.36, 2.0), (0.38, 0.42, 2.4), 0.03))
    p += carve(wr, 0.85, 1.05, 3.3, mirror=True, turn=-0.6)
    m = standing('mother', coat='robe', arm_l=(-0.05, 0.3, 1.0), arm_r=(0.2, 0.3, 1.3))
    m.append(ellipsoid('kid', (0.0, 0.35, 0.75), (0.18, 0.14, 0.32), 10, 6))
    p += carve(m, -1.5, 1.05, 3.1, turn=0.3)
    p += wings('spirit', (-0.4, 4.6), 1.35, up=0.2)
    return p


def regeneration():
    # workers rebuilding after the fire: one shoulders a beam, one swings a hammer, one kneels setting stone; the
    # winged spirit of Regeneration above them
    p = panel('reg')
    a = standing('beam', coat='jacket', arm_r=(0.2, 0.0, 1.62), arm_l=(-0.2, 0.0, 1.62), stance=0.2)
    p += carve(a, -1.3, 1.05, 3.5, turn=0.2)
    p.append(box('beam_log', (-1.1, FACE + 0.62, 4.15), (2.1, 0.18, 0.22)))
    h = standing('hammer', coat='jacket', arm_r=(0.3, 0.15, 2.1), arm_l=(-0.25, 0.3, 1.2), stance=0.3)
    h.append(limb('hammer_h', (0.3, 0.15, 2.1), (0.3, 0.2, 2.45), 0.025))
    h.append(box('hammer_head', (0.3, 0.2, 2.5), (0.22, 0.08, 0.1)))
    p += carve(h, 0.2, 1.05, 3.6, turn=-0.25)
    p += kneeling('kneel', 1.2, 1.05, 3.4)
    for i, (x, z) in enumerate([(1.75, 1.25), (1.95, 1.25), (1.85, 1.55)]):
        p.append(box(f'stone{i}', (x, FACE + 0.2, z), (0.42, 0.3, 0.3)))
    p += wings('spirit', (-0.5, 4.7), 1.35, up=0.3)
    return p


RELIEFS = {'discoverers': discoverers, 'pioneers': pioneers, 'defense': defense, 'regeneration': regeneration}


def main():
    which = args().get('which', 'all')
    for name, build in RELIEFS.items():
        if which not in ('all', name):
            continue
        clear_scene()
        parts = build()
        # nothing may stand behind the wall or above the panel; the scenes are composed with +x on the viewer's right,
        # and a viewer facing the panel (looking along −Y) has −X on the right: mirror x, then re-wind the faces
        apply(parts)
        for ob in parts:
            for v in ob.data.vertices:
                v.co.y = max(v.co.y, 0.0)
                v.co.z = min(max(v.co.z, 0.0), H)
                v.co.x = -min(max(v.co.x, -W / 2), W / 2)
            ob.data.flip_normals()
        export_glb([o.name for o in parts], os.path.abspath(os.path.join(OUT, f'relief_{name}.glb')), MAX_TRIS)


main()

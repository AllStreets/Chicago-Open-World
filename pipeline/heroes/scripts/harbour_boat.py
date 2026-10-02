"""pipeline/heroes/scripts/harbour_boat.py — B-8: the boats moored in Chicago's harbours (Belmont, Diversey, Monroe,
DuSable, Burnham), built to the F1 Pixel Cup standard (tools/blender/build_f1_car.py): a lofted hull with a raked stem,
flared topsides, a sheer stripe and a transom; a non-skid deck; a trunk cabin with window bands; the cockpit coaming;
stanchions, lifelines and bow and stern pulpits; and, by role, either a sloop rig (mast, spreaders, stays, boom with
its sail cover, masthead light) or a power cruiser's hardtop with its windscreen and radar arch. One model serves both:
the app collapses the rig on power boats and the hardtop on sailboats per instance, and recolours the hull, stripe
and canvas per instance (role-named materials). Ambient occlusion is baked into COLOR_0 (lifted, never black).
Two objects are exported: boat_lod0 (≈ 1.4 k triangles) and boat_lod1 (≈ 150).

Run headless:  Blender -b --factory-startup -P pipeline/heroes/scripts/harbour_boat.py -- --out pipeline/heroes/out/harbour_boat.glb

Axes: X forward (bow at +X), Y to port, Z up, metres; origin on the waterline amidships. Length overall 10 m, beam
3.3 m — a typical 30–35 ft Great Lakes cruiser (the app scales each instance 0.8–1.4×). glTF export is +Y up, so the
bow stays +X and port becomes −Z.
"""
import math
import os
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(__file__))
from _export import args  # noqa: E402

AO_LIFT = 0.42
ROLES = ['hull', 'stripe', 'deck', 'cabin', 'glass', 'rail', 'mast', 'canvas', 'light', 'top', 'topglass']


def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for block in list(coll):
            coll.remove(block)


def mat(name, color, metal=0.0, rough=0.5, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*color, 1)
        b.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*color, 1)
    return m


reset()
# linear colours for the preview; the app recolours hull, stripe and canvas per boat and reads the role from the name
MATS = {
    'hull': mat('hull', (0.86, 0.86, 0.84), 0.0, 0.25),
    'stripe': mat('stripe', (0.02, 0.06, 0.22), 0.0, 0.3),
    'deck': mat('deck', (0.72, 0.7, 0.64), 0.0, 0.8),
    'cabin': mat('cabin', (0.82, 0.82, 0.8), 0.0, 0.35),
    'glass': mat('glass', (0.02, 0.025, 0.03), 0.3, 0.1),
    'rail': mat('rail', (0.7, 0.72, 0.74), 1.0, 0.25),
    'mast': mat('mast', (0.62, 0.64, 0.66), 0.9, 0.35),
    'canvas': mat('canvas', (0.02, 0.1, 0.35), 0.0, 0.7),
    'light': mat('light', (1.0, 0.95, 0.8), 0.0, 0.3, emit=3.0),
    'top': mat('top', (0.86, 0.86, 0.84), 0.0, 0.3),
    'topglass': mat('topglass', (0.02, 0.025, 0.03), 0.3, 0.1),
}


class Builder:
    """One bmesh with a material slot per role."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()

    def face(self, verts, role):
        f = self.bm.faces.new([self.bm.verts.new(v) for v in verts])
        f.material_index = ROLES.index(role)
        return f

    def loft(self, rings, roles, close_ring=True, cap0=None, cap1=None):
        """rings: lists of (x, y, z), same count; roles[i] is the role of the strip from point i to i+1."""
        vr = [[self.bm.verts.new(p) for p in r] for r in rings]
        n = len(rings[0])
        for a, b in zip(vr, vr[1:]):
            for i in range(n if close_ring else n - 1):
                j = (i + 1) % n
                f = self.bm.faces.new((a[i], a[j], b[j], b[i]))
                f.material_index = ROLES.index(roles[i])
        if cap0:
            f = self.bm.faces.new(list(reversed(vr[0])))
            f.material_index = ROLES.index(cap0)
        if cap1:
            f = self.bm.faces.new(vr[-1])
            f.material_index = ROLES.index(cap1)

    def tube(self, path, r, role, sides=6, r1=None):
        """A tube along a polyline (x, y, z); radius r → r1 from start to end; capped."""
        r1 = r if r1 is None else r1
        rings = []
        for k, p in enumerate(path):
            a = path[max(0, k - 1)]
            b = path[min(len(path) - 1, k + 1)]
            d = [b[i] - a[i] for i in range(3)]
            ln = math.sqrt(sum(c * c for c in d)) or 1
            d = [c / ln for c in d]
            up = (0, 0, 1) if abs(d[2]) < 0.9 else (1, 0, 0)
            u = cross(d, up)
            ul = math.sqrt(sum(c * c for c in u)) or 1
            u = [c / ul for c in u]
            v = cross(d, u)
            rr = r + (r1 - r) * (k / max(1, len(path) - 1))
            rings.append([tuple(p[i] + rr * (math.cos(2 * math.pi * s / sides) * u[i] + math.sin(2 * math.pi * s / sides) * v[i]) for i in range(3)) for s in range(sides)])
        self.loft(rings, [role] * sides, cap0=role, cap1=role)

    def box(self, x0, x1, y0, y1, z0, z1, role, top_role=None):
        P = lambda x, y, z: (x, y, z)  # noqa: E731
        c = [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)]
        for idx, rl in (((0, 1, 5, 4), role), ((1, 2, 6, 5), role), ((2, 3, 7, 6), role), ((3, 0, 4, 7), role), ((4, 5, 6, 7), top_role or role), ((3, 2, 1, 0), role)):
            self.face([c[i] for i in idx], rl)

    def finish(self):
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.collection.objects.link(ob)
        for r in ROLES:
            me.materials.append(MATS[r])
        return ob


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


# ── the hull ───────────────────────────────────────────────────────────────────────────────────────────────────────
# stations: x, half-beam at the sheer, keel depth (canoe body), sheer height; the stem rakes forward above the water
STATIONS = [(-5.0, 1.42, -0.18, 1.0), (-4.3, 1.56, -0.4, 1.0), (-3.0, 1.64, -0.52, 1.02), (-1.5, 1.66, -0.58, 1.05),
            (0.0, 1.62, -0.6, 1.09), (1.5, 1.48, -0.56, 1.14), (2.7, 1.2, -0.46, 1.2), (3.6, 0.86, -0.32, 1.26),
            (4.3, 0.5, -0.16, 1.32), (4.85, 0.18, 0.15, 1.37), (5.1, 0.03, 0.75, 1.4)]
# down the topsides from the sheer: (fraction of the half-beam, fraction of the depth from the sheer to the keel)
SECTION = [(1.0, 0.0), (0.995, 0.07), (0.985, 0.3), (0.95, 0.55), (0.84, 0.74), (0.62, 0.89), (0.32, 0.97), (0.0, 1.0)]
SECTION_ROLES = ['stripe', 'hull', 'hull', 'hull', 'hull', 'hull', 'hull']
CAMBER = 0.08


def hull_rings(stations, section, deck_pts=3):
    rings = []
    for x, hw, zb, zt in stations:
        port = [(x, hw * fy, zt - fz * (zt - zb)) for fy, fz in section]
        star = [(x, -y, z) for (_, y, z) in reversed(port[:-1])]
        deck = [(x, -hw + 2 * hw * (k + 1) / (deck_pts + 1), zt + CAMBER * hw * math.sin(math.pi * (k + 1) / (deck_pts + 1))) for k in range(deck_pts)]
        rings.append(port + star + deck)
    n_side = len(section) - 1
    roles = SECTION_ROLES[:n_side] + list(reversed(SECTION_ROLES[:n_side])) + ['deck'] * (deck_pts + 1)
    return rings, roles


def sheer_at(x):
    for (x0, hw0, _, z0), (x1, hw1, _, z1) in zip(STATIONS, STATIONS[1:]):
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            return hw0 + (hw1 - hw0) * t, z0 + (z1 - z0) * t
    return STATIONS[-1][1], STATIONS[-1][3]


def build(lod, variant='both'):
    b = Builder(f'boat_lod{lod}')
    hi = lod == 0
    st = STATIONS if hi else [STATIONS[i] for i in (0, 2, 4, 6, 8, 10)]
    sec = SECTION if hi else [SECTION[i] for i in (0, 1, 3, 5, 7)]
    if not hi:
        global SECTION_ROLES
        keep = SECTION_ROLES
        SECTION_ROLES = ['stripe', 'hull', 'hull', 'hull']
    rings, roles = hull_rings(st, sec, 3 if hi else 1)
    if not hi:
        SECTION_ROLES = keep
    b.loft(rings, roles, cap0='hull', cap1='hull')
    # the trunk cabin: sloped sides, a cambered roof, a window band each side and forward
    cab = [(-1.3, 1.08, 1.03, 1.72), (-0.2, 1.08, 1.06, 1.76), (1.2, 0.98, 1.12, 1.74), (2.5, 0.66, 1.18, 1.6)]
    cr = []
    for x, hw, z0, z1 in cab:
        cr.append([(x, hw, z0), (x, hw * 0.86, z1), (x, 0.0, z1 + 0.06), (x, -hw * 0.86, z1), (x, -hw, z0)])
    b.loft(cr, ['cabin', 'cabin', 'cabin', 'cabin', 'deck'], close_ring=True, cap0='cabin', cap1='cabin')
    if hi:
        for s in (1, -1):  # window bands, a hair proud of the sloped cabin side
            for x0, x1 in ((-1.0, -0.1), (0.15, 1.0), (1.25, 2.0)):
                pts = []
                for x in (x0, x1):
                    hw = 1.08 if x < -0.2 else (1.08 + (0.98 - 1.08) * (x + 0.2) / 1.4 if x < 1.2 else 0.98 + (0.66 - 0.98) * (x - 1.2) / 1.3)
                    pts.append((x, s * (hw * 0.955 + 0.012), 1.34))
                    pts.append((x, s * (hw * 0.905 + 0.012), 1.56))
                b.face([pts[0], pts[2], pts[3], pts[1]], 'glass')
        b.face([(2.52, 0.5, 1.3), (2.52, -0.5, 1.3), (2.52, -0.42, 1.52), (2.52, 0.42, 1.52)], 'glass')
    # the cockpit: coaming round a well aft of the cabin, seats along it
    b.box(-4.6, -1.3, 1.02, 1.12, 1.0, 1.36, 'cabin', 'deck')
    b.box(-4.6, -1.3, -1.12, -1.02, 1.0, 1.36, 'cabin', 'deck')
    if hi:
        b.box(-4.5, -1.4, 0.55, 1.0, 0.98, 1.18, 'deck')
        b.box(-4.5, -1.4, -1.0, -0.55, 0.98, 1.18, 'deck')
        b.box(-4.2, -3.9, -0.2, 0.2, 1.0, 1.85, 'rail')  # binnacle and wheel pedestal
        b.tube([(-3.95, 0.45 * math.sin(2 * math.pi * k / 10), 1.6 + 0.45 * math.cos(2 * math.pi * k / 10)) for k in range(11)], 0.02, 'rail', 4)  # the wheel
        # stanchions and two lifelines along each side; bow and stern pulpits
        xs = [-4.6, -3.4, -2.2, -1.0, 0.2, 1.4, 2.6]
        for s in (1, -1):
            posts = []
            for x in xs:
                hw, z = sheer_at(x)
                p = (x, s * (hw - 0.07), z)
                b.tube([p, (p[0], p[1], p[2] + 0.62)], 0.016, 'rail', 4)
                posts.append(p)
            for h in (0.32, 0.62):
                b.tube([(p[0], p[1], p[2] + h) for p in posts], 0.008, 'rail', 3)
        pul = []
        for k in range(13):
            a = math.pi * k / 12
            x = 3.2 + 1.55 * math.sin(a)
            hw, z = sheer_at(min(x, 4.9))
            y = (hw - 0.06) * math.cos(a)
            pul.append((x, y, z + 0.66))
        b.tube(pul, 0.018, 'rail', 4)
        for k in (0, 4, 8, 12):
            p = pul[k]
            b.tube([(p[0], p[1], p[2] - 0.66), p], 0.016, 'rail', 4)
        stern = []
        for k in range(9):
            a = math.pi * k / 8
            hw, z = sheer_at(-4.8)
            stern.append((-4.75 - 0.15 * math.sin(a), (hw - 0.08) * math.cos(a), z + 0.66))
        b.tube(stern, 0.018, 'rail', 4)
        for k in (0, 8):
            p = stern[k]
            b.tube([(p[0], p[1], p[2] - 0.66), p], 0.016, 'rail', 4)
    # ── the sloop rig (sail-only roles: mast, canvas, light) ───────────────────────────────────────────────────────
    mx, mz0, mz1 = 1.75, 1.74, 14.2
    if variant == 'power':
        pass
    elif hi:
        b.tube([(mx, 0, mz0), (mx, 0, mz1)], 0.1, 'mast', 8, 0.065)
        for h, w in ((6.6, 1.05), (10.6, 0.7)):
            b.tube([(mx, -w, h), (mx, w, h)], 0.03, 'mast', 4)
        b.tube([(mx + 0.05, 0, mz1 - 0.1), (5.05, 0, 1.45)], 0.01, 'mast', 3)  # forestay
        b.tube([(mx - 0.05, 0, mz1 - 0.1), (-4.95, 0, 1.12)], 0.01, 'mast', 3)  # backstay
        for s in (1, -1):  # shrouds over the spreaders to the chainplates
            b.tube([(mx, 0, mz1 - 0.6), (mx, s * 0.7, 10.6), (mx, s * 1.05, 6.6), (mx - 0.1, s * 1.5, 1.12)], 0.008, 'mast', 3)
        b.tube([(mx, 0, 2.55), (-3.4, 0, 2.48)], 0.075, 'mast', 6)  # boom
        # the sail cover: a tapered round bag along the boom
        cov = []
        for k in range(7):
            x = mx - 0.15 - (mx - 0.15 + 3.2) * k / 6
            r = 0.26 - 0.13 * k / 6
            cov.append([(x, r * math.cos(2 * math.pi * s / 8), 2.62 + r * 0.9 + r * math.sin(2 * math.pi * s / 8)) for s in range(8)])
        b.loft(cov, ['canvas'] * 8, cap0='canvas', cap1='canvas')
        b.box(mx - 0.08, mx + 0.08, -0.08, 0.08, mz1, mz1 + 0.16, 'light')
    else:
        b.tube([(mx, 0, mz0), (mx, 0, mz1)], 0.1, 'mast', 3, 0.07)
        b.box(-3.2, mx - 0.1, -0.16, 0.16, 2.5, 2.95, 'canvas')
        b.box(mx - 0.1, mx + 0.1, -0.1, 0.1, mz1, mz1 + 0.18, 'light')
    # ── the power cruiser's hardtop (power-only roles: top, topglass) ───────────────────────────────────────────────
    if variant == 'sail':
        pass
    elif hi:
        b.box(-3.6, 0.95, -1.22, 1.22, 2.62, 2.74, 'top')
        for x in (-3.5, 0.75):
            for s in (1, -1):
                b.tube([(x, s * 1.12, 1.36), (x, s * 1.12, 2.62)], 0.035, 'top', 4)
        # a raked windscreen in a white frame, and short side screens: the aft deck under the hardtop stays open
        b.face([(1.2, 1.08, 1.76), (1.2, -1.08, 1.76), (0.72, -1.12, 2.62), (0.72, 1.12, 2.62)], 'topglass')
        b.tube([(1.22, 0, 1.78), (1.22, 1.1, 1.78), (0.74, 1.14, 2.6), (0.74, -1.14, 2.6), (1.22, -1.1, 1.78), (1.22, 0, 1.78)], 0.04, 'top', 4)
        for s in (1, -1):
            b.face([(1.18, s * 1.12, 1.8), (0.74, s * 1.16, 2.58), (-0.2, s * 1.18, 2.58), (-0.2, s * 1.16, 2.05)], 'topglass')
        arch = [(-3.3, 1.15 * math.cos(math.pi * k / 10), 2.74 + 0.7 * math.sin(math.pi * k / 10)) for k in range(11)]
        b.tube(arch, 0.06, 'top', 6)
        b.box(-3.4, -3.2, -0.35, 0.35, 3.44, 3.56, 'top')  # the radar dome's shelf
        b.tube([(-3.3, 0, 3.56), (-3.3, 0, 3.8)], 0.32, 'top', 10, 0.3)
    else:
        b.box(-3.6, 0.9, -1.2, 1.2, 2.6, 2.74, 'top')
        b.face([(0.88, 1.15, 1.76), (0.88, -1.15, 1.76), (0.9, -1.15, 2.6), (0.9, 1.15, 2.6)], 'topglass')
    return b.finish()


def bake_ao(objects):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    try:
        scene.cycles.device = 'CPU'
    except Exception:
        pass
    # the water as a ground plane at the waterline, so the hull's lower topsides read as shaded
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0.0))
    ground = bpy.context.active_object
    for ob in objects:
        attr = ob.data.color_attributes.new('AO', 'BYTE_COLOR', 'POINT')
        ob.data.color_attributes.active_color = attr
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        for d in attr.data:
            k = 1 - AO_LIFT * (1 - d.color[0])
            d.color = (k, k, k, 1)
    bpy.data.objects.remove(ground, do_unlink=True)


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def main():
    a = args()
    out = a.get('out', os.path.join(os.path.dirname(__file__), '..', 'out', 'harbour_boat.glb'))
    obs = [build(int(k), a.get('variant', 'both')) for k in a.get('lods', '0,1').split(',')]  # --lods 0 --variant sail: one look (preview.py)
    for ob in obs:
        tri = ob.modifiers.new('tri', 'TRIANGULATE')
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.ops.object.modifier_apply(modifier=tri.name)
        # flat shading reads crisply at harbour distance; the hull is smooth
        for p in ob.data.polygons:
            p.use_smooth = p.material_index in (ROLES.index('hull'), ROLES.index('stripe'), ROLES.index('canvas'))
    bake_ao(obs)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:
        ob.select_set(True)
    kw = dict(filepath=os.path.abspath(out), export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_texcoords=False, export_normals=True)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
    print('harbour_boat:', out, ' '.join(f'{ob.name}={tris(ob)} tris' for ob in obs))


main()

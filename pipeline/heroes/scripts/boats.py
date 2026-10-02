# pipeline/heroes/scripts/boats.py — F-9: the river's boats as scripted models (after the F1 Pixel Cup car method,
# tools/blender/build_f1_car.py): lofted hulls (a planing V for the pleasure boats, a low hard-chine hull for the tour
# boat and the water taxi), cabins with window bands and mullions, raked windscreens, rails on stanchions, canopies,
# materials named by role so one model wears any livery, ambient occlusion baked by Cycles into COLOR_0, and a LOD1.
# Generic, fictional boats after the look of the classes: no operator's name, logo or livery.
#
# Kinds (lib/boats.js BOAT_KINDS reads the same names):
#   runabout   a 7.4 m bowrider: open bow, walk-through windscreen, helm, aft bench, bimini, outboard
#   cruiser    an 11 m express cruiser: foredeck over a cabin, wraparound windscreen, hardtop on an arch
#   yacht      a 14 m flybridge sedan: saloon deckhouse, foredeck, flybridge with helm and bimini
#   tourboat   a 28 m architecture-tour boat: low hull, glazed lower saloon, open upper deck of benches, a
#              pilothouse forward and a canopy over the aft upper deck
#   watertaxi  an 18.5 m river water taxi: enclosed cabin all round, rail-edged roof deck, raised pilothouse
#
# Axes: X forward (the bow at +X), Y to port, Z up, metres; the origin on the waterline at mid-length. glTF export
# (+Y up) gives x forward, y up, z to starboard. Each .glb holds two meshes, `lod0` and `lod1`, one primitive per role.
# Roles: hull, trim, canopy (recoloured per boat by the app: the livery), bottom, deck, cabin, glass, metal, dark,
# seat, wood (fixed). COLOR_0 is the baked occlusion, lifted so a crease is shaded, never black.
#
# Run (headless, never touches an open session):
#   blender -b --factory-startup -P pipeline/heroes/scripts/boats.py -- --out pipeline/heroes/out/boats [--only tourboat]
# Preview: blender -b --factory-startup -P pipeline/heroes/scripts/boat_preview.py -- --in <glb> --out <prefix>
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from _export import args  # noqa: E402

AO_LIFT = 0.45          # 1 − AO_LIFT is the darkest a crease goes
ROLES = ['hull', 'trim', 'canopy', 'bottom', 'deck', 'cabin', 'glass', 'metal', 'dark', 'seat', 'wood']
RI = {r: i for i, r in enumerate(ROLES)}
# preview / default colours (linear); hull, trim and canopy are overridden per kind (LIVERY) and per boat by the app
BASE = {
    'hull': ((0.80, 0.80, 0.78), 0.0, 0.3), 'trim': ((0.02, 0.05, 0.16), 0.0, 0.35), 'canopy': ((0.02, 0.05, 0.16), 0.0, 0.8),
    'bottom': ((0.22, 0.03, 0.03), 0.0, 0.7), 'deck': ((0.62, 0.60, 0.55), 0.0, 0.8), 'cabin': ((0.84, 0.84, 0.82), 0.0, 0.35),
    'glass': ((0.015, 0.025, 0.035), 0.2, 0.08), 'metal': ((0.72, 0.73, 0.75), 0.9, 0.2), 'dark': ((0.02, 0.02, 0.022), 0.0, 0.6),
    'seat': ((0.78, 0.74, 0.66), 0.0, 0.7), 'wood': ((0.32, 0.18, 0.08), 0.0, 0.6),
}
LIVERY = {
    'runabout': {'hull': (0.80, 0.80, 0.78), 'trim': (0.01, 0.06, 0.20), 'canopy': (0.02, 0.05, 0.14)},
    'cruiser': {'hull': (0.82, 0.82, 0.80), 'trim': (0.02, 0.02, 0.025), 'canopy': (0.30, 0.30, 0.30)},
    'yacht': {'hull': (0.82, 0.82, 0.80), 'trim': (0.03, 0.07, 0.18), 'canopy': (0.02, 0.05, 0.14)},
    'tourboat': {'hull': (0.015, 0.035, 0.10), 'trim': (0.80, 0.80, 0.78), 'canopy': (0.02, 0.06, 0.16)},
    'watertaxi': {'hull': (0.85, 0.55, 0.02), 'trim': (0.02, 0.02, 0.02), 'canopy': (0.85, 0.55, 0.02)},
}


# ── scene and materials ───────────────────────────────────────────────────────────────────────────────────────────
def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for block in list(coll):
            coll.remove(block)


def make_mats(kind):
    mats = []
    for r in ROLES:
        col, metal, rough = BASE[r]
        col = LIVERY[kind].get(r, col)
        m = bpy.data.materials.new(r)
        try:
            m.use_nodes = True
        except Exception:
            pass
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = (*col, 1)
        b.inputs['Metallic'].default_value = metal
        b.inputs['Roughness'].default_value = rough
        m.diffuse_color = (*col, 1)
        mats.append(m)
    return mats


# ── the builder: one bmesh per LOD, every face tagged with its role ──────────────────────────────────────────────────
class B:
    def __init__(self, lod):
        self.bm = bmesh.new()
        self.lod = lod

    def v(self, p):
        return self.bm.verts.new(p)

    def face(self, vs, role):
        f = self.bm.faces.new(vs)
        f.material_index = RI[role]
        return f

    def fix(self, faces):
        if faces:
            bmesh.ops.recalc_face_normals(self.bm, faces=faces)

    def loft(self, rings, roles, cap=(None, None), closed=True, row_roles=None, sharp=(), role_fn=None):
        """rings: lists of 3D points (same count); roles[i]: the role of segment i→i+1 of every ring (or row_roles[k]:
        the role of the band between ring k and k+1). Caps: the role of the first / last ring's polygon, or None."""
        vr = [[self.v(p) for p in r] for r in rings]
        n, faces = len(rings[0]), []
        for k in range(len(vr) - 1):
            for i in range(n if closed else n - 1):
                j = (i + 1) % n
                role = row_roles[k] if row_roles else roles[i]
                q = (vr[k][i], vr[k][j], vr[k + 1][j], vr[k + 1][i])
                if role_fn:
                    role = role_fn(role, sum(v.co.z for v in q) / 4)
                faces.append(self.face(q, role))
        for i in sharp:                                   # creases along the loft (a chine, a gunwale)
            for k in range(len(vr) - 1):
                e = self.bm.edges.get((vr[k][i], vr[k + 1][i]))
                if e:
                    e.smooth = False
        if cap[0]:
            faces.append(self.face(list(reversed(vr[0])), cap[0]))
        if cap[1]:
            faces.append(self.face(vr[-1], cap[1]))
        self.fix(faces)
        return faces

    def box(self, c, size, role, yaw=0.0, pitch=0.0):
        sx, sy, sz = (s / 2 for s in size)
        cy, sy_ = math.cos(yaw), math.sin(yaw)
        cp, sp = math.cos(pitch), math.sin(pitch)

        def P(x, y, z):
            x, z = x * cp - z * sp, x * sp + z * cp          # pitch about Y (nose up for +pitch)
            return (c[0] + x * cy - y * sy_, c[1] + x * sy_ + y * cy, c[2] + z)
        V = [self.v(P(x, y, z)) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)]
        idx = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        self.fix([self.face([V[i] for i in q], role) for q in idx])

    def tube(self, path, r, role, sides=None, closed=False):
        """A tube along a polyline (rails, frames): `sides` round, no end caps (too small to see)."""
        sides = sides or (6 if self.lod == 0 else 4)
        pts = [Vector(p) for p in path]
        n = len(pts)
        rings = []
        for i in range(n):
            a = pts[i - 1] if (i > 0 or closed) else pts[i]
            b = pts[(i + 1) % n] if (i < n - 1 or closed) else pts[i]
            t = (b - a).normalized()
            up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            u = t.cross(up).normalized()
            w = u.cross(t).normalized()
            rings.append([tuple(pts[i] + r * (math.cos(2 * math.pi * k / sides) * u + math.sin(2 * math.pi * k / sides) * w)) for k in range(sides)])
        if closed:
            rings.append(rings[0])
        vr = [[self.v(p) for p in rg] for rg in rings]
        faces = []
        for k in range(len(vr) - 1):
            for i in range(sides):
                j = (i + 1) % sides
                faces.append(self.face((vr[k][i], vr[k][j], vr[k + 1][j], vr[k + 1][i]), role))
        self.fix(faces)

    def rod(self, a, b, r, role, sides=None):
        self.tube([a, b], r, role, sides)

    def sheet(self, grid, role, thick=0.025, role_under=None):
        """A thin solid from a grid of points (rows × cols): canopies, windscreens, fairings."""
        R, C = len(grid), len(grid[0])
        G = [[Vector(p) for p in row] for row in grid]

        def nrm(i, j):
            du = G[i][min(j + 1, C - 1)] - G[i][max(j - 1, 0)]
            dv = G[min(i + 1, R - 1)][j] - G[max(i - 1, 0)][j]
            n = du.cross(dv)
            return n.normalized() if n.length > 1e-9 else Vector((0, 0, 1))
        top = [[self.v(tuple(G[i][j])) for j in range(C)] for i in range(R)]
        bot = [[self.v(tuple(G[i][j] - thick * nrm(i, j))) for j in range(C)] for i in range(R)]
        faces = []
        for i in range(R - 1):
            for j in range(C - 1):
                faces.append(self.face((top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j]), role))
                faces.append(self.face((bot[i][j], bot[i + 1][j], bot[i + 1][j + 1], bot[i][j + 1]), role_under or role))
        rim = [top[0][j] for j in range(C)] + [top[i][C - 1] for i in range(1, R)] + [top[R - 1][j] for j in range(C - 2, -1, -1)] + [top[i][0] for i in range(R - 2, 0, -1)]
        rimb = [bot[0][j] for j in range(C)] + [bot[i][C - 1] for i in range(1, R)] + [bot[R - 1][j] for j in range(C - 2, -1, -1)] + [bot[i][0] for i in range(R - 2, 0, -1)]
        for k in range(len(rim)):
            k2 = (k + 1) % len(rim)
            faces.append(self.face((rim[k], rimb[k], rimb[k2], rim[k2]), role_under or role))
        self.fix(faces)


def se_ring(cx, a, b, z, segs, e=4.0, cy=0.0, front=None):
    """A superellipse ring in the XY plane (half-length a along X, half-width b), point 0 at the bow. `front`: an
    extra squash of the forward half (a shorter, blunter or longer nose)."""
    out = []
    for i in range(segs):
        t = 2 * math.pi * i / segs
        c, s = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(c) ** (2 / e), c)
        if front and x > 0:
            x *= front
        out.append((cx + x, cy + b * math.copysign(abs(s) ** (2 / e), s), z))
    return out


def smooth01(a, b, t):
    if t <= a:
        return 0.0
    if t >= b:
        return 1.0
    u = (t - a) / (b - a)
    return u * u * (3 - 2 * u)


# ── hulls ────────────────────────────────────────────────────────────────────────────────────────────────────────────
class Hull:
    """A lofted hull, transom (t = 0) to stem (t = 1). Each station is a section from the inner face of the bulwark
    down to the keel and back up: bulwark inside, gunwale, rub rail, topsides (with a boot stripe), chine, a V bottom.
    The deck (the cockpit sole) lies `well` below the sheer, bulwarks `wall` thick."""

    def __init__(self, L, Bm, D, T, dr_aft, dr_fwd, sheer_rise=0.2, rake=1.0, well=0.6, wall=0.07, entry=0.42,
                 chine=0.86, chine_fwd=0.6, flare=0.7, transom=0.94, boot=0.14, fore_lift=0.12, band='hull'):
        self.__dict__.update(locals())
        del self.__dict__['self']
        self.x0 = -L / 2
        self.zs_bow = D * (1 + sheer_rise)

    def zs(self, t):
        return self.D * (1 + self.sheer_rise * t * t)

    def zk(self, t):
        return -self.T + (self.T + self.fore_lift * self.D) * smooth01(0.42, 1.0, t) ** 1.5

    def hb(self, t):
        e = self.entry
        f = self.transom + (1 - self.transom) * smooth01(0.0, 0.3, t)
        if t > e:
            u = (t - e) / (1 - e)
            f *= max(0.0, 1 - u ** 2.1) ** 0.62
        return max(self.Bm / 2 * f, 0.012)

    def x(self, t, z):
        xstem = self.L / 2 - self.rake * (self.zs_bow - z)
        return self.x0 + t * (xstem - self.x0)

    def t_at(self, x, z=None):
        z = self.D if z is None else z
        xstem = self.L / 2 - self.rake * (self.zs_bow - z)
        return min(1.0, max(0.0, (x - self.x0) / (xstem - self.x0)))

    def half(self, t, lod=0):
        """[(y, z, role of the segment to the next point)] from the bulwark's inner foot to the keel (y ≥ 0)."""
        hb, zs, zk = self.hb(t), self.zs(t), self.zk(t)
        dr = math.radians(self.dr_aft + (self.dr_fwd - self.dr_aft) * smooth01(0.25, 1.0, t))
        cf = self.chine + (self.chine_fwd - self.chine) * smooth01(0.4, 1.0, t)
        yc = hb * cf
        zc = min(zk + yc * math.tan(dr), zs - 0.3 * self.D)
        ylip, zlip = min(yc + 0.03 * self.Bm / 2.5, hb), zc + 0.015

        def ytop(z):  # topsides with flare: from the chine lip out to the sheer
            u = max(0.0, min(1.0, (z - zlip) / max(zs - zlip, 1e-3)))
            return ylip + (hb - ylip) * u ** self.flare
        zb0 = min(max(zlip + 0.03, 0.04), zs - 0.22)
        zb1 = min(zb0 + self.boot, zs - 0.16)
        zm = (zb1 + zs - 0.1) / 2
        # the sole: `well` below the sheer, but never below the chine (forward, where the V narrows)
        zsole = min(max(zs - self.well, zlip + 0.12), zs - 0.06)
        yin = max(min(hb, ytop(zsole)) - self.wall, 0.006)
        if lod:
            return [(yin, zsole, 'cabin'), (yin, zs, 'hull'), (hb, zs, 'hull'), (ytop(zb1), zb1, 'trim'), (ytop(zb0), zb0, 'bottom'),
                    (yc, zc, 'bottom'), (0.0, zk, None)]
        r = 0.035 * self.Bm / 3
        return [(yin, zsole, 'cabin'), (yin, zs, 'hull'), (hb, zs, 'dark'), (hb + r, zs - 0.02, 'dark'), (hb + r, zs - 0.09, 'dark'),
                (ytop(zs - 0.11), zs - 0.11, self.band), (ytop(zm), zm, 'hull'), (ytop(zb1), zb1, 'trim'), (ytop(zb0), zb0, 'bottom'),
                (ylip, zlip, 'bottom'), (yc, zc, 'bottom'), (yc * 0.5, zk + (zc - zk) * 0.46, 'bottom'), (0.0, zk, None)]

    def ring(self, t, lod=0):
        """The closed section at t: starboard from the bulwark's inner foot down to the keel, port back up."""
        H = self.half(t, lod)
        pts = [(-y, z) for y, z, _ in H[:-1]] + [(H[-1][0], H[-1][1])] + [(y, z) for y, z, _ in reversed(H[:-1])]
        return [(self.x(t, z), y, z) for y, z in pts]

    def stations(self, lod):
        n = 18 if lod == 0 else 8
        return [math.sin(0.5 * math.pi * i / (n - 1)) ** 1.15 for i in range(n)]

    def build(self, b):
        rings = [self.ring(t, b.lod) for t in self.stations(b.lod)]
        # fix the port-side roles: segment i→i+1 on the port side runs from H[k] up to H[k-1] and takes H[k-1]'s role
        H = self.half(0.0, b.lod)
        m = len(H) - 1
        port = [H[k - 1][2] for k in range(m, 0, -1)]           # keel→H[m-1] … H[1]→H[0]
        roles = [h[2] for h in H[:-1]][:m]
        roles = [r for r in roles] + port + ['deck']
        # creases: the bulwark's inner foot and top, the gunwale, the rub rail, the chine lip and the chine, the keel
        crease = [0, 1, 2, 3, 4, 9, 10] if b.lod == 0 else [0, 1, 2, 5]
        n = len(rings[0])
        sharp = set(crease) | {n - 1 - c for c in crease} | {m}
        # antifouling only below the boot top: where the forefoot rises out of the water its V wears the topsides colour
        boot_top = 0.06 + self.boot
        b.loft(rings, roles, cap=('hull', 'hull'), sharp=sharp,
               role_fn=lambda r, z: ('hull' if z > boot_top else 'trim' if z > 0.06 else r) if r == 'bottom' else r)
        return self

    # where to put things on the hull
    def sheer_at(self, x):
        t = self.t_at(x)
        return self.hb(t), self.zs(t)

    def sole_at(self, x):
        """(z of the sole, half-width between the bulwarks) at x."""
        H = self.half(self.t_at(x), 1)
        return H[0][1], H[0][0]

    def side_y(self, x, z):
        t = self.t_at(x, z)
        H = self.half(t, 1)
        hb, zs = self.hb(t), self.zs(t)
        yc, zc = H[5][0], H[5][1]
        u = max(0.0, min(1.0, (z - zc) / max(zs - zc, 1e-3)))
        return yc + (hb - yc) * u ** self.flare


# ── fittings ────────────────────────────────────────────────────────────────────────────────────────────────────────
def deckhouse(b, cx, a, w, bands, segs=None, e=5.0, rake_f=0.0, rake_a=0.0, front=None, cy=0.0, mullions=None, cap='cabin'):
    """A deckhouse lofted up through `bands` [(z, role of the band above)…], the last z its roof. rake_f / rake_a:
    how far the front / back lean in over the full height. mullions: (z0, z1, every) posts in the window band."""
    segs = segs or (28 if b.lod == 0 else 12)
    z0, z1 = bands[0][0], bands[-1][0]
    rings = []
    for z, _ in bands:
        k = (z - z0) / max(z1 - z0, 1e-6)
        aa = a - (rake_f + rake_a) * k / 2
        rings.append(se_ring(cx + (rake_a - rake_f) * k / 2, aa, w, z, segs, e, cy, front))
    b.loft(rings, None, cap=(None, cap), row_roles=[r for _, r in bands[:-1]])
    if mullions and b.lod == 0:
        zm0, zm1, every = mullions
        ring_lo, ring_hi = None, None
        for k in range(len(bands) - 1):
            if abs(bands[k][0] - zm0) < 1e-6:
                ring_lo, ring_hi = rings[k], rings[k + 1]
        if ring_lo:
            # posts at roughly `every` metres round the band, from the band's lower ring to its upper
            per = []
            tot = 0.0
            for i in range(segs):
                per.append(tot)
                tot += math.dist(ring_lo[i], ring_lo[(i + 1) % segs])
            nposts = max(4, int(tot / every))
            for p in range(nposts):
                s = tot * p / nposts
                i = max(k for k in range(segs) if per[k] <= s)
                j = (i + 1) % segs
                f = (s - per[i]) / max(math.dist(ring_lo[i], ring_lo[j]), 1e-6)
                lo = Vector(ring_lo[i]).lerp(Vector(ring_lo[j]), f)
                hi = Vector(ring_hi[i]).lerp(Vector(ring_hi[j]), f)
                c = Vector((lo.x, lo.y, 0)) - Vector((cx, cy, 0))
                c = c.normalized() * 0.03 if c.length else Vector((0, 0, 0))
                b.rod(tuple(lo + c), tuple(hi + c), 0.045, 'cabin', sides=4)
    return rings


def rail(b, pts, h, every=1.4, r=0.022, mid=True, role='metal', closed=False):
    """A guard rail: a top tube `h` above the deck line `pts` (x, y, z), a mid tube, stanchions every `every` m."""
    top = [(x, y, z + h) for x, y, z in pts]
    b.tube(top, r, role, closed=closed)
    if mid and b.lod == 0:
        b.tube([(x, y, z + h * 0.5) for x, y, z in pts], r * 0.7, role, closed=closed)
    seq = pts + ([pts[0]] if closed else [])
    acc, nxt = 0.0, 0.0
    for i in range(len(seq) - 1):
        a, c = Vector(seq[i]), Vector(seq[i + 1])
        L = (c - a).length
        while nxt <= acc + L + 1e-6:
            p = a.lerp(c, (nxt - acc) / L if L else 0)
            if b.lod == 0 or nxt == 0.0:
                b.rod(tuple(p), (p.x, p.y, p.z + h), r * 0.85, role, sides=4)
            nxt += every
        acc += L


def sheer_line(hull, x0, x1, inset=0.06, n=10, side=1, lift=0.0):
    out = []
    for i in range(n):
        x = x0 + (x1 - x0) * i / (n - 1)
        hb, zs = hull.sheer_at(x)
        out.append((x, side * max(hb - inset, 0.02), zs + lift))
    return out


def bench(b, x, y, z, length, depth=0.45, back=True, yaw=0.0, role='seat'):
    b.box((x, y, z + 0.42), (depth, length, 0.08), role, yaw=yaw)
    b.box((x, y, z + 0.2), (depth * 0.8, length * 0.96, 0.4), 'cabin' if role == 'seat' else role, yaw=yaw)
    if back:
        c, s = math.cos(yaw), math.sin(yaw)
        bx = -depth / 2 + 0.05
        b.box((x + bx * c, y + bx * s, z + 0.7), (0.08, length, 0.5), role, yaw=yaw, pitch=-0.15)


def windscreen(b, hull, x, z0, h, rake, span, curve=0.35, cols=None, gap=0.0, wrap=0.0):
    """A windscreen across the boat: glass sheet raked back by `rake` metres, curved round toward the stern at its
    ends; a dark frame along its top."""
    cols = cols or (11 if b.lod == 0 else 5)
    rows = []
    for k, back in ((0, 0.0), (1, rake)):
        row = []
        for j in range(cols):
            u = -1 + 2 * j / (cols - 1)
            y = u * span / 2
            if gap and abs(y) < gap / 2:
                y = math.copysign(gap / 2, u) if u else 0
            hh = h * (1 - wrap * u ** 4)                  # a wraparound screen: lower toward its ends
            row.append((x - back * (hh / h) - curve * u * u, y * (1 - 0.06 * k), z0 + k * hh))
        rows.append(row)
    b.sheet(rows, 'glass', thick=0.02, role_under='glass')
    if b.lod == 0:
        b.tube(rows[1], 0.025, 'dark')


# ── the kinds ───────────────────────────────────────────────────────────────────────────────────────────────────────
def runabout(b):
    h = Hull(L=7.4, Bm=2.55, D=0.92, T=0.42, dr_aft=20, dr_fwd=48, sheer_rise=0.34, rake=1.25, well=0.62, entry=0.4,
             chine=0.84, chine_fwd=0.55, flare=0.65, fore_lift=0.15, band='trim').build(b)
    S = lambda x: h.sole_at(x)[0]                       # the sole's height at x
    # walk-through windscreen and the console behind it
    windscreen(b, h, 0.75, h.D + 0.0, 0.42, 0.32, 2.05, curve=0.45, gap=0.55 if b.lod == 0 else 0.0)
    b.box((0.25, -0.62, S(0.25) + 0.45), (0.8, 0.7, 0.9), 'cabin')                 # helm console (starboard)
    b.box((0.35, 0.62, S(0.35) + 0.45), (0.7, 0.7, 0.9), 'cabin')                  # port console
    if b.lod == 0:
        b.box((0.05, -0.62, S(0.05) + 0.95), (0.05, 0.36, 0.3), 'dark', pitch=0.5)  # dash
        b.tube([(-0.05, -0.62 + 0.18 * math.cos(a), S(-0.05) + 0.95 + 0.18 * math.sin(a)) for a in [k * math.pi / 4 for k in range(9)]], 0.02, 'dark')
        bench(b, -0.45, -0.62, S(-0.45), 0.6, depth=0.55)                         # helm seat
        bench(b, -0.45, 0.62, S(-0.45), 0.6, depth=0.55)
        # bow seating round the open bow
        for x in (1.55, 2.25):
            zb, yb = h.sole_at(x)
            for side in (-1, 1):
                b.box((x, side * (yb - 0.22), zb + 0.2), (0.7, 0.4, 0.4), 'seat', yaw=-side * 0.18)
    # aft bench across the transom and the sun pad over the engine well
    b.box((-3.0, 0, S(-3.0) + 0.24), (0.6, 2.1, 0.48), 'seat')
    if b.lod == 0:
        b.box((-3.25, 0, S(-3.25) + 0.7), (0.12, 2.1, 0.5), 'seat', pitch=-0.2)
    # bimini: a fabric top on two hoops over the helm and the aft cockpit
    zt = h.D + 1.15
    cols = 9 if b.lod == 0 else 4
    grid = [[(x, -1.05 + 2.1 * j / (cols - 1), zt + 0.12 * (1 - ((j / (cols - 1)) * 2 - 1) ** 2)) for j in range(cols)] for x in (0.15, -1.0, -2.0)]
    b.sheet(grid, 'canopy', thick=0.03)
    if b.lod == 0:
        for x in (-0.1, -1.9):
            hb, zs = h.sheer_at(x)
            b.tube([(x, -hb + 0.08, zs), (x, -1.0, zt - 0.05), (x, 1.0, zt - 0.05), (x, hb - 0.08, zs)], 0.018, 'metal')
        # bow rails
        for side in (-1, 1):
            rail(b, sheer_line(h, 1.4, 3.35, inset=0.08, n=6, side=side), 0.42, every=0.7, mid=False)
        # outboard on the transom
        b.box((-3.95, 0, 0.75), (0.55, 0.5, 0.65), 'cabin')
        b.box((-3.95, 0, 0.38), (0.45, 0.42, 0.1), 'dark')
        b.box((-4.0, 0, 0.0), (0.2, 0.14, 0.75), 'dark')
    else:
        b.box((-3.95, 0, 0.6), (0.5, 0.45, 0.8), 'cabin')
    # swim platform
    b.box((-3.9, 0, 0.2), (0.35, 1.9, 0.08), 'wood')
    return h


def cruiser(b):
    h = Hull(L=11.0, Bm=3.6, D=1.35, T=0.8, dr_aft=18, dr_fwd=44, sheer_rise=0.2, rake=1.3, well=0.9, entry=0.42,
             chine=0.86, chine_fwd=0.55, flare=0.6, fore_lift=0.14, band='trim').build(b)
    S = lambda x: h.sole_at(x)[0]                       # the sole's height at x
    xw = 0.6                                                                     # windscreen foot
    # the foredeck over the cabin: a crowned deck from the windscreen to the bow, on the bulwarks
    rows = []
    stations = [xw + (h.L / 2 - 0.25 - xw) * k / (9 if b.lod == 0 else 4) for k in range(10 if b.lod == 0 else 5)]
    cols = 9 if b.lod == 0 else 5
    for x in stations:
        hb, zs = h.sheer_at(x)
        w = max(hb - 0.02, 0.05)
        rows.append([(x, -w + 2 * w * j / (cols - 1), zs + 0.16 * (1 - ((j / (cols - 1)) * 2 - 1) ** 2)) for j in range(cols)])
    b.sheet(rows, 'hull', thick=0.08, role_under='cabin')
    hb, zs = h.sheer_at(xw)
    b.box((xw, 0, (S(xw) + zs) / 2 + 0.06), (0.1, 2 * h.sole_at(xw)[1], zs - S(xw) + 0.12), 'cabin')   # cockpit's forward bulkhead
    # wraparound windscreen and its frame
    windscreen(b, h, xw + 0.1, zs + 0.06, 0.46, 0.6, 2 * hb - 0.2, curve=0.9, wrap=0.65)
    # hardtop on an arch over the cockpit
    zt = zs + 1.9
    cols = 9 if b.lod == 0 else 4
    grid = [[(x, -1.55 + 3.1 * j / (cols - 1), zt + 0.08 * (1 - ((j / (cols - 1)) * 2 - 1) ** 2)) for j in range(cols)] for x in (xw - 0.45, -1.4, -2.6)]
    b.sheet(grid, 'cabin', thick=0.09, role_under='cabin')
    for side in (-1, 1):
        b.tube([(-2.4, side * 1.5, zt), (-2.0, side * 1.62, zs + 0.2)], 0.07, 'cabin', sides=6 if b.lod == 0 else 4)
        b.tube([(xw - 0.45, side * 1.45, zt), (xw - 0.15, side * (hb - 0.15), zs + 0.66)], 0.04, 'metal')
    # side curtains (the canvas enclosure, rolled down at the sides): the livery canvas
    if b.lod == 0:
        b.box((-0.3, 0, zt + 0.12), (0.5, 0.5, 0.18), 'cabin')                 # radar dome base
        b.box((-0.3, 0, zt + 0.26), (0.55, 0.55, 0.1), 'cabin')
        bench(b, -0.1, -0.85, S(-0.1), 0.9, depth=0.6)                            # helm seats
        bench(b, -0.1, 0.65, S(-0.1), 0.9, depth=0.6)
        b.box((-4.4, 0, S(-4.4) + 0.24), (0.7, 3.0, 0.48), 'seat')                 # aft bench
        b.box((-4.7, 0, S(-4.7) + 0.7), (0.12, 3.0, 0.5), 'seat', pitch=-0.2)
        for side in (-1, 1):
            rail(b, sheer_line(h, 1.2, 5.1, inset=0.1, n=7, side=side, lift=0.08), 0.55, every=0.9, mid=False)
    b.box((-5.55, 0, 0.18), (0.6, 3.1, 0.08), 'wood')
    return h


def yacht(b):
    h = Hull(L=14.0, Bm=4.4, D=1.6, T=1.0, dr_aft=16, dr_fwd=42, sheer_rise=0.2, rake=1.4, well=1.0, entry=0.45,
             chine=0.88, chine_fwd=0.58, flare=0.6, fore_lift=0.14).build(b)
    S = lambda x: h.sole_at(x)[0]                       # the sole's height at x
    hb_mid, zs_mid = h.sheer_at(0)
    # the foredeck from the saloon front to the bow
    xf = 2.6
    rows = []
    n = 9 if b.lod == 0 else 4
    cols = 9 if b.lod == 0 else 5
    for k in range(n + 1):
        x = xf + (h.L / 2 - 0.3 - xf) * k / n
        hb, zs = h.sheer_at(x)
        w = max(hb - 0.02, 0.05)
        rows.append([(x, -w + 2 * w * j / (cols - 1), zs + 0.14 * (1 - ((j / (cols - 1)) * 2 - 1) ** 2)) for j in range(cols)])
    b.sheet(rows, 'hull', thick=0.08, role_under='cabin')
    # side decks: the saloon stands on the deck between narrow walkways
    b.box((-0.4, 0, zs_mid - 0.05), (6.4, 2 * hb_mid - 0.12, 0.1), 'deck')
    # saloon: a long deckhouse, a raked windscreen front, dark glass all round
    z0 = zs_mid
    deckhouse(b, -0.4, 3.3, hb_mid - 0.5, [(z0, 'cabin'), (z0 + 0.55, 'glass'), (z0 + 1.55, 'cabin'), (z0 + 1.75, 'cabin')],
              e=5.0, rake_f=1.2, rake_a=0.15, mullions=(z0 + 0.55, z0 + 1.55, 1.6))
    # flybridge on the saloon roof: a fairing, helm, seats and a bimini
    zr = z0 + 1.75
    deckhouse(b, -0.9, 2.2, hb_mid - 0.62, [(zr, 'cabin'), (zr + 0.6, 'cabin')], e=4.0, rake_f=0.3, cap='deck')
    if b.lod == 0:
        b.box((0.7, -0.4, zr + 0.95), (0.5, 0.8, 0.7), 'cabin')                    # flybridge helm
        windscreen(b, h, 1.0, zr + 1.3, 0.25, 0.15, 1.0, curve=0.2)
        bench(b, -0.2, -0.4, zr + 0.6, 1.2, depth=0.55)
        b.box((-2.0, 0.6, zr + 0.82), (1.6, 0.6, 0.44), 'seat')
        rail(b, se_ring(-0.9, 2.15, hb_mid - 0.66, zr + 0.6, 20, 4.0)[5:16], 0.45, every=1.0, mid=False)
    zt = zr + 2.6
    cols = 9 if b.lod == 0 else 4
    b.sheet([[(x, -1.5 + 3.0 * j / (cols - 1), zt + 0.1 * (1 - ((j / (cols - 1)) * 2 - 1) ** 2)) for j in range(cols)] for x in (1.0, -0.6, -2.4)], 'canopy', thick=0.03)
    if b.lod == 0:
        for x in (0.8, -2.2):
            b.tube([(x, -1.45, zr + 0.6), (x, -1.45, zt - 0.05), (x, 1.45, zt - 0.05), (x, 1.45, zr + 0.6)], 0.022, 'metal')
        b.box((-0.5, 0, zt + 0.2), (0.12, 0.12, 0.4), 'metal')                    # mast
        b.box((-0.5, 0, zt + 0.42), (0.1, 1.0, 0.06), 'cabin')                     # radar bar
        # rails round the foredeck and down the side decks
        for side in (-1, 1):
            rail(b, sheer_line(h, -3.0, 6.6, inset=0.08, n=12, side=side, lift=0.1), 0.65, every=1.0)
        # cockpit: an aft bench
        b.box((-6.0, 0, S(-6.0) + 0.24), (0.6, 3.6, 0.48), 'seat')
        b.box((-6.3, 0, S(-6.3) + 0.7), (0.12, 3.6, 0.5), 'seat', pitch=-0.2)
        for side in (-1, 1):
            for x0, x1 in ((2.4, 4.4),):
                pts = []
                for k in range(4):
                    x = x0 + (x1 - x0) * k / 3
                    z = h.D - 0.5 + 0.08 * k / 3
                    pts.append((x, side * (h.side_y(x, z) + 0.03), z))
                b.sheet([pts, [(x, side * (h.side_y(x, z + 0.16) + 0.03), z + 0.16) for x, y, z in pts]], 'glass', thick=0.01)
    b.box((-7.1, 0, 0.22), (0.8, 3.8, 0.08), 'wood')
    return h


def tourboat(b):
    # Chicago's architecture boats: long, low and beamy (≈ 28 × 7.6 m), a glazed lower saloon, an open upper deck
    h = Hull(L=28.0, Bm=7.6, D=1.45, T=1.25, dr_aft=6, dr_fwd=30, sheer_rise=0.12, rake=0.55, well=0.95, wall=0.1,
             entry=0.62, chine=0.92, chine_fwd=0.6, flare=0.5, transom=0.97, boot=0.22, fore_lift=0.12).build(b)
    zd = h.D - h.well                                          # the main deck
    hb, zs = h.sheer_at(0)
    # lower saloon: solid below the sills, a deep window band with mullions, a roof edge in the trim colour
    xs, a = -2.0, 10.5
    w = hb - 0.45
    deckhouse(b, xs, a, w, [(zd, 'cabin'), (zd + 0.95, 'glass'), (zd + 2.25, 'trim'), (zd + 2.45, 'cabin')], e=7.0,
              rake_f=0.6, front=0.92, mullions=(zd + 0.95, zd + 2.25, 1.55), cap='deck')
    zu = zd + 2.45                                             # the upper deck
    # the upper deck overhangs the saloon a little: its edge a slab in the cabin colour
    deckhouse(b, xs - 0.2, a + 0.5, w + 0.3, [(zu - 0.18, 'cabin'), (zu, 'cabin')], e=7.0, front=0.92, cap='deck')
    # perimeter rail round the upper deck, with a solid lower panel
    ring = se_ring(xs - 0.2, a + 0.4, w + 0.22, zu, 26 if b.lod == 0 else 10, 7.0, front=0.92)
    rail(b, ring, 1.05, every=1.6, r=0.03, mid=True, role='cabin', closed=True)
    if b.lod == 0:
        lo = [(x, y, z + 0.05) for x, y, z in ring] + [(ring[0][0], ring[0][1], ring[0][2] + 0.05)]
        b.sheet([lo, [(x, y, z + 0.45) for x, y, z in lo]], 'trim', thick=0.02, role_under='cabin')
    # the pilothouse forward on the upper deck
    xp = xs + a - 3.2
    deckhouse(b, xp, 1.5, 1.45, [(zu, 'cabin'), (zu + 0.9, 'glass'), (zu + 2.0, 'trim'), (zu + 2.15, 'cabin')], e=5.0,
              rake_f=0.35, mullions=(zu + 0.9, zu + 2.0, 0.9))
    if b.lod == 0:
        b.box((xp - 0.6, 0, zu + 2.35), (0.1, 0.1, 0.4), 'metal')                    # mast and lights
        b.box((xp - 0.6, 0, zu + 2.56), (0.12, 0.6, 0.05), 'dark')
        # rows of benches across the upper deck, a centre aisle, facing forward
        for k in range(11):
            x = xp - 2.4 - 1.05 * k
            if x < xs - a + 1.2:
                break
            for side in (-1, 1):
                bench(b, x, side * (w / 2 + 0.3), zu, w - 0.9, depth=0.5, role='seat')
    else:
        b.box((xp - 7.5, 0, zu + 0.4), (12.0, 2 * w - 0.6, 0.8), 'seat')
    # the canopy over the aft upper deck, on posts
    zc = zu + 2.35
    cols = 11 if b.lod == 0 else 4
    x0c, x1c = xs - a + 0.6, xs + 1.5
    rows = []
    for x in [x1c + (x0c - x1c) * k / (5 if b.lod == 0 else 2) for k in range(6 if b.lod == 0 else 3)]:
        rows.append([(x, -(w + 0.1) + 2 * (w + 0.1) * j / (cols - 1), zc + 0.25 * (1 - ((j / (cols - 1)) * 2 - 1) ** 2)) for j in range(cols)])
    b.sheet(rows, 'canopy', thick=0.04)
    if b.lod == 0:
        for x in (x1c - 0.2, (x0c + x1c) / 2, x0c + 0.2):
            for side in (-1, 1):
                b.rod((x, side * w, zu), (x, side * w, zc - 0.02), 0.05, 'cabin', sides=6)
        # canopy valance
        for side in (-1, 1):
            b.sheet([[(x, side * (w + 0.1), zc - 0.2), (x, side * (w + 0.1), zc)] for x in (x1c, (x0c + x1c) / 2, x0c)], 'canopy', thick=0.02)
        # open bow deck: bitts and a rail; the aft deck's rail
        for side in (-1, 1):
            rail(b, sheer_line(h, xs + a + 0.6, h.L / 2 - 0.6, inset=0.12, n=6, side=side, lift=0.0), 0.45, every=1.2, r=0.03, mid=False, role='cabin')
            b.box((h.L / 2 - 3.0, side * 1.6, zd + 0.25), (0.3, 0.3, 0.5), 'dark')
        # life rings on the saloon front, fenders along the rub rail
        for side in (-1, 1):
            for x in (-9, -3, 3):
                b.box((x, side * (h.sheer_at(x)[0] + 0.1), h.sheer_at(x)[1] - 0.5), (0.5, 0.2, 0.7), 'dark')
    return h


def watertaxi(b):
    # a river water taxi (≈ 18.5 × 5.6 m): enclosed cabin all round, an open roof deck, a raised pilothouse forward
    h = Hull(L=18.5, Bm=5.6, D=1.4, T=1.1, dr_aft=8, dr_fwd=34, sheer_rise=0.14, rake=0.7, well=0.85, wall=0.09,
             entry=0.55, chine=0.9, chine_fwd=0.6, flare=0.5, transom=0.95, boot=0.18, fore_lift=0.12).build(b)
    zd = h.D - h.well
    hb, zs = h.sheer_at(0)
    xs, a, w = -0.8, 7.0, hb - 0.32
    deckhouse(b, xs, a, w, [(zd, 'hull'), (zd + 0.9, 'glass'), (zd + 2.1, 'canopy'), (zd + 2.3, 'cabin')], e=6.0,
              rake_f=0.5, rake_a=0.3, front=0.9, mullions=(zd + 0.9, zd + 2.1, 1.25), cap='deck')
    zu = zd + 2.3
    ring = se_ring(xs, a - 0.35, w - 0.12, zu, 24 if b.lod == 0 else 10, 6.0, front=0.9)
    rail(b, ring, 1.0, every=1.4, r=0.03, role='trim', closed=True)
    xp = xs + a - 2.4
    deckhouse(b, xp, 1.2, 1.25, [(zu, 'canopy'), (zu + 0.8, 'glass'), (zu + 1.75, 'canopy'), (zu + 1.9, 'cabin')], e=5.0,
              rake_f=0.3, mullions=(zu + 0.8, zu + 1.75, 0.8))
    if b.lod == 0:
        for k in range(6):
            x = xp - 2.0 - 1.1 * k
            for side in (-1, 1):
                bench(b, x, side * (w / 2 + 0.15), zu, w - 0.7, depth=0.48)
        b.box((xp, 0, zu + 2.1), (0.1, 0.1, 0.4), 'metal')
        for side in (-1, 1):
            rail(b, sheer_line(h, xs + a + 0.5, h.L / 2 - 0.5, inset=0.1, n=5, side=side), 0.45, every=1.2, mid=False, role='trim')
            for x in (-6, -1, 3):
                b.box((x, side * (h.sheer_at(x)[0] + 0.1), h.sheer_at(x)[1] - 0.45), (0.45, 0.2, 0.6), 'dark')
    return h


KINDS = {'runabout': runabout, 'cruiser': cruiser, 'yacht': yacht, 'tourboat': tourboat, 'watertaxi': watertaxi}


# ── assembly, AO, export ─────────────────────────────────────────────────────────────────────────────────────────────
def to_object(name, b, mats):
    me = bpy.data.meshes.new(name)
    bmesh.ops.remove_doubles(b.bm, verts=b.bm.verts, dist=1e-5)
    # smooth shading with creases: edges the builders marked, edges between roles, and folds steeper than 50°
    for e in b.bm.edges:
        fs = e.link_faces
        if len(fs) != 2 or fs[0].material_index != fs[1].material_index or e.calc_face_angle(0.0) > math.radians(50):
            e.smooth = False
    b.bm.to_mesh(me)
    b.bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    # triangulate so the counts are the counts the city draws
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new('tri', 'TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def bake_ao(objs):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    try:
        scene.cycles.device = 'CPU'
    except Exception:
        pass
    # the river: a plane at the waterline, so the hull's foot and the deck edges see it
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, -0.05))
    water = bpy.context.active_object
    for ob in objs:
        attr = ob.data.color_attributes.new('AO', 'BYTE_COLOR', 'POINT')
        ob.data.color_attributes.active_color = attr
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        for d in attr.data:
            k = 1 - AO_LIFT * (1 - d.color[0])
            d.color = (k, k, k, 1)
    bpy.data.objects.remove(water, do_unlink=True)


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def build(kind, out_dir):
    reset()
    mats = make_mats(kind)
    objs = []
    for lod in (0, 1):
        b = B(lod)
        KINDS[kind](b)
        objs.append(to_object(f'lod{lod}', b, mats))
    bake_ao(objs)
    for ob in objs:
        # drop the material slots a LOD does not use (no empty primitives)
        used = {p.material_index for p in ob.data.polygons}
        print(f'{kind} {ob.name}: {tris(ob)} tris, roles {[ROLES[i] for i in sorted(used)]}')
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    path = os.path.join(out_dir, f'{kind}.glb')
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
              export_texcoords=False, export_normals=True, export_materials='EXPORT')
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
    print('exported', path)


def main():
    a = args()
    out_dir = os.path.abspath(a.get('out', os.path.join(os.path.dirname(__file__), '..', 'out', 'boats')))
    os.makedirs(out_dir, exist_ok=True)
    for k in ([a['only']] if 'only' in a else KINDS):
        build(k, out_dir)


main()

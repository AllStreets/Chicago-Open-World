# pipeline/heroes/scripts/vehicles.py — the city's road vehicles as scripted models (after boats.py and the F1 Pixel Cup
# car, tools/blender/build_f1_car.py): bodies lofted from cross-sections along the length (wheel arches cut into the
# sides, the plan and the side view rounded at the ends), glasshouses lofted from horizontal rings (raked screens,
# tumblehome, pillars), lathed tyres with a sidewall and spoked rims, lamps, grilles, mirrors and seams as trim, materials
# named by role so one model wears any paint, ambient occlusion baked by Cycles into COLOR_0, and a LOD1.
# Generic, fictional designs after the look of each class: no maker's name, badge, logo or one model's exact lines.
#
# Kinds: sedan, suv, hatch, pickup, taxi (the sedan with a roof sign), van (a high-roof delivery van), bus (a 40-ft
#        low-floor city bus in the CTA's white, blue and red), semi (a day-cab tractor and a dry-van trailer),
#        boxtruck (a cab and a box).
#
# Axes: X forward (the front at +X), Y to the left, Z up, metres; the origin on the ground under the middle of the
# vehicle. glTF export (+Y up) gives x forward, y up, z to the vehicle's right. Each .glb holds two meshes, `lod0` and
# `lod1`, one primitive per role. Roles (material names): paint, paint2, glass, chrome, trim, tyre, rim, head, tail,
# amber, plate, interior, under, stripe_blue, stripe_red, sign. COLOR_0 is the baked occlusion, lifted, never black.
#
# Run (headless): blender -b --factory-startup -P pipeline/heroes/scripts/vehicles.py -- --out pipeline/heroes/out/vehicles [--only sedan]
# Preview:        blender -b --factory-startup -P pipeline/heroes/scripts/vehicle_preview.py -- --in <glb> --out <prefix>
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from _export import args  # noqa: E402

AO_LIFT = 0.45          # 1 − AO_LIFT is the darkest a crease goes
ROLES = ['paint', 'paint2', 'glass', 'chrome', 'trim', 'tyre', 'rim', 'head', 'tail', 'amber', 'plate', 'interior', 'under',
         'stripe_blue', 'stripe_red', 'sign']
RI = {r: i for i, r in enumerate(ROLES)}
# preview / default colours (linear): (colour, metallic, roughness, emission strength)
BASE = {
    'paint': ((0.62, 0.64, 0.67), 0.5, 0.3, 0), 'paint2': ((0.80, 0.80, 0.78), 0.0, 0.5, 0),
    'glass': ((0.012, 0.016, 0.022), 0.0, 0.06, 0), 'chrome': ((0.85, 0.85, 0.87), 1.0, 0.12, 0),
    'trim': ((0.018, 0.018, 0.02), 0.0, 0.55, 0), 'tyre': ((0.025, 0.025, 0.027), 0.0, 0.85, 0),
    'rim': ((0.55, 0.56, 0.58), 0.9, 0.28, 0), 'head': ((0.85, 0.86, 0.85), 0.0, 0.08, 0),
    'tail': ((0.42, 0.01, 0.012), 0.0, 0.15, 0), 'amber': ((0.85, 0.32, 0.01), 0.0, 0.15, 0),
    'plate': ((0.82, 0.82, 0.78), 0.0, 0.5, 0), 'interior': ((0.045, 0.045, 0.05), 0.0, 0.8, 0),
    'under': ((0.03, 0.03, 0.032), 0.0, 0.9, 0), 'stripe_blue': ((0.0, 0.12, 0.50), 0.0, 0.35, 0),
    'stripe_red': ((0.62, 0.015, 0.025), 0.0, 0.35, 0), 'sign': ((0.95, 0.62, 0.08), 0.0, 0.4, 0),
}
LIVERY = {'bus': {'paint': (0.86, 0.86, 0.84)}, 'taxi': {'paint': (0.85, 0.55, 0.02)},
          'semi': {'paint': (0.55, 0.04, 0.03)}, 'boxtruck': {'paint': (0.86, 0.86, 0.84)}}


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
        col, metal, rough, _ = BASE[r]
        col = LIVERY.get(kind, {}).get(r, col)
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


# ── curves ────────────────────────────────────────────────────────────────────────────────────────────────────────
def pchip(x, ks):
    """Monotone cubic through keys [(x, v)…] (any order): no overshoot, no flat spot at every key."""
    ks = sorted(ks)
    xs, ys = [k[0] for k in ks], [k[1] for k in ks]
    n = len(xs)
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    i = max(k for k in range(n - 1) if xs[k] <= x)
    t = (x - xs[i]) / h[i]
    t2, t3 = t * t, t * t * t
    return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1]
            + (t3 - t2) * h[i] * m[i + 1])


def K(v):
    """A key table or a constant."""
    return (lambda x: pchip(x, v)) if isinstance(v, (list, tuple)) else (lambda x: v)


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(v, a, b):
    return max(a, min(b, v))


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

    def grid_loft(self, rings, role_of, cap=(None, None), sharp=(), fix=True):
        """rings: closed rings of 3D points (same count). role_of(k, i): the role of the face between ring k and k+1
        from point i to i+1. sharp: ring indices whose edges along the loft are creased."""
        vr = [[self.v(p) for p in r] for r in rings]
        n, faces = len(rings[0]), []
        for k in range(len(vr) - 1):
            for i in range(n):
                j = (i + 1) % n
                faces.append(self.face((vr[k][i], vr[k][j], vr[k + 1][j], vr[k + 1][i]), role_of(k, i)))
        for i in sharp:
            for k in range(len(vr) - 1):
                e = self.bm.edges.get((vr[k][i], vr[k + 1][i]))
                if e:
                    e.smooth = False
        if cap[0]:
            faces.append(self.face(list(reversed(vr[0])), cap[0]))
        if cap[1]:
            faces.append(self.face(vr[-1], cap[1]))
        if fix:
            self.fix(faces)
        self.last_faces = faces
        return vr

    def box(self, c, size, role, yaw=0.0, pitch=0.0, roll=0.0, skip=()):
        """A box centred at c; yaw about Z, pitch about Y (x toward +z for +pitch), roll about X. skip: faces to leave
        out ('-x', '+x', '-y', '+y', '-z', '+z')."""
        sx, sy, sz = (s / 2 for s in size)
        cy, sy_ = math.cos(yaw), math.sin(yaw)
        cp, sp = math.cos(pitch), math.sin(pitch)
        cr, sr = math.cos(roll), math.sin(roll)

        def P(x, y, z):
            y, z = y * cr - z * sr, y * sr + z * cr
            x, z = x * cp - z * sp, x * sp + z * cp
            return (c[0] + x * cy - y * sy_, c[1] + x * sy_ + y * cy, c[2] + z)
        V = [self.v(P(x, y, z)) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)]
        idx = {'-x': (0, 1, 3, 2), '+x': (4, 6, 7, 5), '-y': (0, 4, 5, 1), '+y': (2, 3, 7, 6), '-z': (0, 2, 6, 4), '+z': (1, 5, 7, 3)}
        fs = [self.face([V[i] for i in q], role) for k, q in idx.items() if k not in skip]
        self.fix(fs)
        return fs

    def tube(self, path, r, role, sides=None, closed=False, caps=False):
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
        self.grid_loft(rings, lambda k, i: role, cap=(role, role) if caps and not closed else (None, None))

    def rod(self, a, b, r, role, sides=None, caps=False):
        self.tube([a, b], r, role, sides, caps=caps)

    def cyl(self, c, r, length, role, axis='x', sides=8, cap_role=None):
        """A capped cylinder along an axis."""
        rings = []
        for s in (-0.5, 0.5):
            ring = []
            for k in range(sides):
                a = 2 * math.pi * k / sides
                u, w = r * math.cos(a), r * math.sin(a)
                if axis == 'x':
                    ring.append((c[0] + s * length, c[1] + u, c[2] + w))
                elif axis == 'y':
                    ring.append((c[0] + u, c[1] + s * length, c[2] + w))
                else:
                    ring.append((c[0] + u, c[1] + w, c[2] + s * length))
            rings.append(ring)
        self.grid_loft(rings, lambda k, i: role, cap=(cap_role or role, cap_role or role))

    def ribbon(self, pts, w, role, out):
        """A thin strip lying on a surface along pts; out(p) → the outward unit normal there (a seam, a stripe)."""
        P = [Vector(p) for p in pts]
        L, R = [], []
        for i, p in enumerate(P):
            t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
            n = Vector(out(p))
            d = t.cross(n).normalized() * (w / 2)
            q = p + n * 0.004
            L.append(self.v(tuple(q + d)))
            R.append(self.v(tuple(q - d)))
        fs = [self.face((L[i], R[i], R[i + 1], L[i + 1]), role) for i in range(len(P) - 1)]
        for f in fs:                                   # face outward
            f.normal_update()
            c = f.calc_center_median()
            if f.normal.dot(Vector(out(tuple(c)))) < 0:
                f.normal_flip()


def rrect(hw, z0, z1, r, n=2, ybulge=0.0):
    """Half of a rounded rectangle section (y ≥ 0) from the bottom centre to the top centre: [(y, z)…]."""
    pts = [(0.0, z0)]
    for k in range(n + 1):
        a = -math.pi / 2 + (math.pi / 2) * k / n
        pts.append((hw - r + r * math.cos(a), z0 + r + r * math.sin(a)))
    for k in range(n + 1):
        a = (math.pi / 2) * k / n
        pts.append((hw - r + r * math.cos(a) + (ybulge if k == 0 else 0), z1 - r + r * math.sin(a)))
    pts.append((0.0, z1))
    return pts


def mirror_ring(x, half):
    """A closed ring at x from a half section [(y, z)…] (bottom centre → top centre, y ≥ 0): the left (+y) side up,
    the right side back down. Returns the points and, for each segment, (half-index, side)."""
    n = len(half)
    pts = [(x, y, z) for y, z in half] + [(x, -y, z) for y, z in reversed(half[1:-1])]
    seg = [(i, 1) for i in range(n - 1)] + [(n - 2 - m, -1) for m in range(n - 2)] + [(0, -1)]
    return pts, seg


def body_loft(b, xs, section, role_fn, caps=('paint', 'paint'), sharp_slots=()):
    """A body lofted through stations xs (ascending). section(x) → half section [(y, z, slot)…] from the bottom centre
    to the top centre; role_fn(slot, x_mid, side) → role of the band from that station to the next."""
    rings, slots = [], []
    for x in xs:
        H = section(x)
        pts, seg = mirror_ring(x, [(y, z) for y, z, _ in H])
        rings.append(pts)
        slots.append([H[i][2] for i in range(len(H))])
    n = len(rings[0])
    _, seg = mirror_ring(0, [(0, 0)] * len(slots[0]))
    sharp = []
    for i, s in enumerate(slots[0]):
        if s in sharp_slots:
            sharp += [i, (n - i) % n]
    return b.grid_loft(rings, lambda k, i: role_fn(slots[k][seg[i][0]], (xs[k] + xs[k + 1]) / 2, seg[i][1]),
                       cap=caps, sharp=sharp)


def rbox(b, c, size, r, role, n=None, ends=None, rx=None, roles=None):
    """A rounded box: a rounded-rectangle section (corner radius r) lofted along X, its ends rounded in plan and
    side by rx. roles: optional fn(slot index, x, side) for the band roles."""
    n = n if n is not None else (2 if b.lod == 0 else 1)
    L, W, H = size
    rx = r if rx is None else rx
    x0, x1 = c[0] - L / 2, c[0] + L / 2
    ends = ends if ends is not None else (2 if b.lod == 0 else 1)
    xs = []
    if ends == 0:
        xs = [(x0, 0.0), (x1, 0.0)]
    else:
        for k in range(ends + 1):
            a = (math.pi / 2) * k / ends
            xs.append((x0 + rx - rx * math.cos(a), 1 - math.sin(a)))
        for k in range(ends, -1, -1):
            a = (math.pi / 2) * k / ends
            xs.append((x1 - rx + rx * math.cos(a), 1 - math.sin(a)))
    rings = []
    for x, shrink in xs:
        s = shrink * rx
        half = rrect(max(W / 2 - s, 0.01), c[2] - H / 2 + s, c[2] + H / 2 - s, max(min(r, W / 2 - s - 0.005, H / 2 - s - 0.005), 0.003), n)
        pts, seg = mirror_ring(x, half)
        rings.append([(p[0], p[1] + c[1], p[2]) for p in pts])
    _, seg = mirror_ring(0, [(0, 0)] * len(half))
    xm = [x for x, _ in xs]
    rf = (lambda k, i: roles(seg[i][0], (xm[k] + xm[k + 1]) / 2, seg[i][1])) if roles else (lambda k, i: role)
    b.grid_loft(rings, rf, cap=(role, role))


# ── glasshouses: rings in plan, lofted up ───────────────────────────────────────────────────────────────────────────
def gh_ring(z, xf, xr, hw, rxf, rxr, side_x, nf, nr, bow=0.0):
    """One horizontal ring of a glasshouse: an elliptical front (depth rxf), straight sides through side_x, an
    elliptical rear (depth rxr). Returns (points, segment classes) for the whole ring, left side then right."""
    half, cls = [], []
    xF, xR = xf - rxf, xr + rxr
    for k in range(nf + 1):
        t = (math.pi / 2) * k / nf
        half.append((xF + rxf * math.cos(t), hw * math.sin(t)))
    # side points, kept in order inside the straight
    sx, prev = [], xF
    for x in side_x:
        x = min(x, prev - 0.006)
        sx.append(x)
        prev = x
    nxt = xR
    for i in range(len(sx) - 1, -1, -1):
        sx[i] = max(sx[i], nxt + 0.006)
        nxt = sx[i]
    mid, half_len = (xF + xR) / 2, max((xF - xR) / 2, 1e-3)
    for x in sx:
        half.append((x, hw + bow * (1 - ((x - mid) / half_len) ** 2)))
    for k in range(nr + 1):
        t = (math.pi / 2) * k / nr
        half.append((xR - rxr * math.sin(t), hw * math.cos(t)))
    cls = [('F', k) for k in range(nf)] + [('S', k) for k in range(len(sx) + 1)] + [('R', k) for k in range(nr)]
    pts = [(x, y, z) for x, y in half] + [(x, -y, z) for x, y in reversed(half[1:-1])]
    seg = [(c, 1) for c in cls] + [(c, -1) for c in reversed(cls)]
    return pts, seg


def glasshouse(b, rings, role_fn, side_lo, side_hi, z_lo, z_hi, nf, nr, cap='paint', bow=0.0):
    """rings: [(z, xf, xr, hw, rxf, rxr, band)…] bottom to top; band = the class of the band above (the last ring is
    capped). role_fn(band, (cls, k), side, z) → role. side_lo / side_hi: x of the side points at z_lo / z_hi."""
    R, segs = [], None
    for z, xf, xr, hw, rxf, rxr, _ in rings:
        t = clamp((z - z_lo) / max(z_hi - z_lo, 1e-6), 0, 1)
        sx = [lerp(a, c, t) for a, c in zip(side_lo, side_hi)]
        pts, segs = gh_ring(z, xf, xr, hw, rxf, rxr, sx, nf, nr, bow)
        R.append(pts)
    zs = [r[0] for r in rings]
    return b.grid_loft(R, lambda k, i: role_fn(rings[k][6], segs[i][0], segs[i][1], (zs[k] + zs[k + 1]) / 2), cap=(None, cap))


def tri_count_bm(bm):
    return sum(len(f.verts) - 2 for f in bm.faces)


def orient_wheel(faces, x, R, k):
    """Wheels are open lathes: wind them so the tread (face k, on the second band) faces away from the axle."""
    f = faces[k]
    f.normal_update()
    c = f.calc_center_median()
    if f.normal.dot(Vector((c.x - x, 0, c.z - R))) < 0:
        for g in faces:
            g.normal_flip()


# ── wheels ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def wheel(b, x, yc, R, rin, wd, side, spokes=5, rim=True, dish=0.05, style='spoke', dish_role='trim'):
    """A wheel standing on the ground at (x, yc): a lathed tyre with sidewalls and rounded shoulders, a rim with a lip,
    a dark dish and spokes (lod0); a flat-bottomed prism with a rim disc (lod1). side: +1 if the outer face looks +y."""
    if b.lod:
        n = getattr(b, 'lod1_wheel_sides', 8)
        Rs, rs = R / math.cos(math.pi / n), rin / math.cos(math.pi / n)
        ang = [-math.pi / 2 + math.pi / n + 2 * math.pi * k / n for k in range(n)]
        prof = [(Rs, -wd / 2), (Rs, wd / 2), (rs, wd / 2)]
        rings = [[(x + r * math.cos(a), yc + side * yy, R + r * math.sin(a)) for a in ang] for r, yy in prof]
        b.grid_loft(rings, lambda k, i: 'tyre', cap=(None, 'rim' if rim else 'tyre'), fix=False)
        orient_wheel(b.last_faces, x, R, 0)
        return
    n = 12
    ang = [-math.pi / 2 + 2 * math.pi * k / n for k in range(n)]
    h = wd / 2
    prof = [(rin + 0.02, -h + 0.012, 'tyre'), (R - 0.05, -h, 'tyre'), (R - 0.004, -h + 0.035, 'tyre'), (R, h - 0.035, 'tyre'),
            (R - 0.05, h, 'tyre'), (rin + 0.02, h - 0.012, 'tyre')]
    if rim:
        f = h - 0.016                                     # the rim's face, just inside the sidewall
        prof += [(rin - 0.006, f, 'rim'), (rin - 0.03, f - 0.012, 'rim'), (rin * 0.86, f - dish, dish_role),
                 (rin * 0.28, f - dish, 'rim')]
    rings = [[(x + r * math.cos(a), yc + side * yy, R + r * math.sin(a)) for a in ang] for r, yy, _ in prof]
    vr = b.grid_loft(rings, lambda k, i: prof[k][2], cap=(None, 'rim' if rim else None), fix=False)
    orient_wheel(b.last_faces, x, R, n * 2)
    for e in [b.bm.edges.get((vr[k][i], vr[k][(i + 1) % n])) for k in (2, 3) for i in range(n)]:
        if e:
            e.smooth = False                                  # the tread's shoulders
    if rim and spokes:
        f = h - 0.016
        r0, r1 = rin * 0.27, rin * 0.88
        for s in range(spokes):
            a = 2 * math.pi * s / spokes + 0.3
            rm = (r0 + r1) / 2
            depth = dish * 0.55
            b.box((x + rm * math.cos(a), yc + side * (f - dish + depth / 2 + 0.004), R + rm * math.sin(a)),
                  (r1 - r0, depth, 0.05 if style == 'spoke' else 0.07), 'rim', pitch=a, skip=('+y' if side < 0 else '-y',))


# ── cars: a lofted body, a glasshouse, wheels and the small parts ───────────────────────────────────────────────────
class Car:
    """A passenger car from a spec dict (see SPECS). Stations run rear → front."""

    def __init__(self, S):
        self.S = S
        self.L, self.W = S['L'], S['W']
        xc = S.get('xc', 0.0)
        self.xf, self.xr = xc + S['L'] / 2, xc - S['L'] / 2
        self.hwk = K(S['hwk']) if S.get('hwk') else None
        self.k = {n: K(S[n]) for n in ('zb', 'zrk', 'zlow', 'zsh', 'zs2', 'zte', 'crown', 'inset')}
        self.bed = S.get('bed')                        # (x_front, x_rear, z_floor) of a pickup's bed

    def plan(self, x):
        """The half-width in plan at x: rounded corners at both ends."""
        S, hw = self.S, self.W / 2
        rf, rr = S['rcf'], S['rcr']
        if self.hwk:
            hw = min(hw, self.hwk(x))
        if x > self.xf - rf:
            d = (x - (self.xf - rf)) / rf
            return hw - S.get('pf', rf) * (1 - math.sqrt(max(1 - d * d, 0)))
        if x < self.xr + rr:
            d = ((self.xr + rr) - x) / rr
            return hw - S.get('pr', rr) * (1 - math.sqrt(max(1 - d * d, 0)))
        return hw

    def arch(self, x):
        """(z of the arch's edge, flare) at x: the arch is a circle about a point just above each axle."""
        S = self.S
        za, fl = None, 0.0
        for xa in S['axles']:
            dx = abs(x - xa)
            Ra = S['Ra']
            if dx < Ra:
                z = S['R'] + S.get('arch_up', 0.02) + math.sqrt(Ra * Ra - dx * dx)
                za = z if za is None else max(za, z)
            fl = max(fl, S.get('flare', 0.0) * clamp(1 - (dx - Ra) / 0.25, 0, 1) if dx > Ra else S.get('flare', 0.0))
        return za, fl

    def in_bed(self, x):
        return self.bed and self.bed[1] < x < self.bed[0]

    def section(self, x, lod):
        S, k = self.S, self.k
        s = self.plan(x)
        zb, zr, zl, zsh, zs2, zte = (k[n](x) for n in ('zb', 'zrk', 'zlow', 'zsh', 'zs2', 'zte'))
        ztc = zte + k['crown'](x)
        yte = s - k['inset'](x)
        za, fl = self.arch(x)
        yo = s + fl
        if lod:
            zb1 = max(zr, S['R'] * S.get('lod1_sill', 0.95))
            H = [(0.0, zb1, 'under'), (yo - 0.06, zb1, 'sill'), (yo, zb1 + 0.08, 'door'), (yo, zsh, 'upper'),
                 (yo - 0.03, zs2, 'round'), (yte, zte, 'top'), (0.0, ztc, None)]
            if self.bed:
                H[-2:] = [(yte, zte, 'top'), (0.0, ztc, None)]
            return H
        yin = min(S['yin'], s - 0.12)
        zw = max(za if za is not None else zr, zb + 0.01)
        z4 = zw + 0.035
        z5 = max(zl, z4 + 0.02)
        z6 = max(zsh, z5 + 0.02)
        z7 = max(zs2, z6 + 0.02)
        H = [(0.0, zb, 'under'), (yin, zb, 'well'), (yin, zw, 'well'), (yo - 0.035, zw, 'lip'), (yo - 0.004, z4, 'sill'),
             (yo, z5, 'door'), (yo + S.get('belly', 0.0), z6, 'upper'), (yo - 0.022, z7, 'round'), (yte, max(zte, z7 + 0.01), 'top')]
        if self.bed:
            if self.in_bed(x):
                zf = self.bed[2]
                H += [(yte - 0.05, zte, 'bedwall'), (yte - 0.05, zf, 'bedfloor'), (0.0, zf, None)]
            else:
                H += [(yte - 0.05, zte + 0.004, 'top'), (yte * 0.45, ztc - 0.006, 'top'), (0.0, ztc, None)]
        else:
            H += [(yte * 0.55, ztc - 0.01, 'top'), (0.0, ztc, None)]
        return H

    def side_y(self, x, z):
        """The body side's half-width at (x, z) (between the sill and the top edge)."""
        H = self.section(x, 0)
        pts = [(y, zz) for y, zz, _ in H[4:9]]
        for (y0, z0), (y1, z1) in zip(pts, pts[1:]):
            if z0 <= z <= z1:
                return lerp(y0, y1, (z - z0) / max(z1 - z0, 1e-6))
        return pts[-1][0] if z > pts[-1][1] else pts[0][0]

    def role(self, slot, x, side):
        S = self.S
        if slot == 'top' and self.in_bed(x) and S.get('_lod1'):
            return 'trim'
        if slot in ('under', 'well', 'lip'):
            return 'under'
        if slot == 'sill':
            return S.get('sill_role', 'paint')
        if slot == 'bedfloor':
            return 'trim'
        if slot == 'upper':
            if x > self.xf - S['head_len']:
                if not S.get('_lod1'):
                    return 'paint'                     # lod0: the lamp units (front()) sit on the band
                return 'amber' if x < self.xf - S['head_len'] + 0.08 else 'head'
            if x < self.xr + S['tail_len']:
                return 'tail'
        if slot == 'door' and S.get('bumper_trim'):
            if x > self.xf - S['bumper_trim'][0] or x < self.xr + S['bumper_trim'][1]:
                return 'trim'
        return 'paint'

    def stations(self, lod):
        S = self.S
        xf, xr = self.xf, self.xr
        rf, rr, Ra = S['rcf'], S['rcr'], S['Ra']
        if lod:
            xs = [xr, xr + rr * 0.45, *S['axles'], xf - rf * 0.55, xf] + S.get('lod1_x', [])
            if self.bed:
                xs += [self.bed[0] + 0.02, xr + 0.25]
                xs.remove(xr + rr * 0.45)
            return sorted(xs)
        xs = []
        for k in range(6):                                 # rounded ends
            a = (math.pi / 2) * k / 5
            xs.append(xf - rf + rf * math.sin(a))
            xs.append(xr + rr - rr * math.sin(a))
        for xa in S['axles']:                              # arches
            for k in range(8):
                xs.append(xa + Ra * math.cos(math.pi * k / 7))
            xs += [xa + Ra + 0.012, xa - Ra - 0.012]
        xs += S.get('extra_x', [])
        if self.hwk:
            xs += S.get('step_x', [])
        if self.bed:
            xs += [self.bed[0] + 0.01, self.bed[0] - 0.04, self.bed[1] + 0.07, self.bed[1] + 0.05]
        xs = sorted(set(round(x, 4) for x in xs))
        out = [xs[0]]
        for x in xs[1:]:
            if x - out[-1] > 0.008:
                out.append(x)
        return out

    def build(self, b):
        self.S['_lod1'] = b.lod == 1
        sharp = ('well', 'lip') if b.lod == 0 else ()
        parts = [('body', lambda: body_loft(b, self.stations(b.lod), lambda x: self.section(x, b.lod), self.role, sharp_slots=sharp)),
                 ('glasshouse', lambda: self.greenhouse(b)), ('wheels', lambda: self.wheels(b)), ('front', lambda: self.front(b)),
                 ('rear', lambda: self.rear(b)), ('details', lambda: self.details(b) if b.lod == 0 else None)]
        for name, fn in parts:
            t0 = tri_count_bm(b.bm)
            fn()
            if os.environ.get('VEH_DEBUG'):
                print(f'PART lod{b.lod} {name}: {tri_count_bm(b.bm) - t0}')
        return self

    # the glasshouse
    def greenhouse(self, b):
        S = self.S
        G = S['gh']
        if b.lod:
            if G.get('lod1'):
                rings = G['lod1']
            else:
                rings = [r for r in G['rings'] if r[6] in ('win', 'roof')][:2] + [G['rings'][-1]]
                rings = [(*r[:6], 'win' if i == 0 else 'roof') for i, r in enumerate(rings)]
            glasshouse(b, rings, self.gh_role1, [], [], 0, 1, 2, 2)
            return
        glasshouse(b, G['rings'], self.gh_role, G['side_lo'], G['side_hi'], G['z_lo'], G['z_hi'], G.get('nf', 5),
                   G.get('nr', 4), bow=G.get('bow', 0.0))

    def gh_role1(self, band, cls, side, z):
        if band == 'win_front':
            return 'glass' if cls[0] == 'F' else 'paint'
        return 'glass' if band == 'win' else 'paint'

    def gh_role(self, band, cls, side, z):
        G = self.S['gh']
        c, k = cls
        if band in ('hide', 'roof'):
            return 'paint'
        if band == 'seal':
            return 'trim'
        # the window band ('win_lo': no glass at the back)
        if band == 'win_lo' and c == 'R':
            return 'paint'
        if c == 'F':
            return G.get('a_role', 'paint') if k >= G.get('nf', 5) - G.get('a_segs', 1) else 'glass'
        if c == 'R':
            return G.get('c_role', 'paint') if k < G.get('c_segs', 1) else G.get('back_role', 'glass')
        return G['side_roles'][k]

    def wall_y(self, x, z):
        """The side's half-width at (x, z): the body below its top edge, the glasshouse's rings above."""
        if z <= self.k['zte'](x) - 0.005 or not self.S.get('gh'):
            return self.side_y(x, z)
        R = self.S['gh']['rings']
        for r0, r1 in zip(R, R[1:]):
            if r0[0] <= z <= r1[0]:
                return lerp(r0[3], r1[3], (z - r0[0]) / (r1[0] - r0[0]))
        return R[-1][3] if z > R[-1][0] else R[0][3]

    def wheels(self, b):
        S = self.S
        if S.get('no_wheels'):
            return
        for xa in S['axles']:
            for side in (1, -1):
                wheel(b, xa, side * S['track'], S['R'], S['rin'], S['tw'], side, spokes=S.get('spokes', 5),
                      style=S.get('spoke_style', 'spoke'))

    # the nose: lamp units that wrap the corner, a framed grille with slats, the intake, a splitter and the hood's shut line
    def nose_path(self, side, y0, wrap, n_face=3, n_arc=7):
        """Points (x, y, nx, ny) along the nose in plan: across the face from y0 to the corner, round the corner's
        quarter ellipse, then back along the side to xf - wrap. (nx, ny) is the outward normal in plan."""
        S, xf, hw = self.S, self.xf, self.W / 2
        rf, pf = S['rcf'], S.get('pf', S['rcf'])
        s = self.plan(xf)
        pts = [(xf, side * (y0 + (s - y0) * i / n_face), 1.0, 0.0) for i in range(n_face)]
        x_end = xf - wrap
        a_end = math.asin(clamp((x_end - (xf - rf)) / rf, 0.0, 1.0))
        for i in range(n_arc + 1):
            a = math.pi / 2 - (math.pi / 2 - a_end) * i / n_arc
            nx, ny = math.sin(a) / rf, math.cos(a) / pf
            d = math.hypot(nx, ny)
            pts.append((xf - rf + rf * math.sin(a), side * (hw - pf + pf * math.cos(a)), nx / d, side * ny / d))
        if x_end < xf - rf - 0.02:
            pts.append((x_end, side * self.plan(x_end), 0.0, float(side)))
        return pts

    def band(self, b, path, zf, off, role):
        """A strip standing on a nose path: zf(x) → (z_lo, z_hi); pushed `off` out along the plan normal."""
        L = [b.v((x + nx * off, y + ny * off, zf(x)[0])) for x, y, nx, ny in path]
        U = [b.v((x + nx * off, y + ny * off, zf(x)[1])) for x, y, nx, ny in path]
        for i in range(len(path) - 1):
            f = b.face((L[i], L[i + 1], U[i + 1], U[i]), role)
            f.normal_update()
            x, y, nx, ny = path[i]
            if f.normal.x * nx + f.normal.y * ny < 0:
                f.normal_flip()

    def top_z(self, x, y):
        """The hood's height at (x, |y|) (the section's top: yte → yte·0.55 → the crown)."""
        zte, ztc, yte = self.k['zte'](x), self.k['zte'](x) + self.k['crown'](x), self.plan(x) - self.k['inset'](x)
        y = abs(y)
        if y >= yte * 0.55:
            return lerp(zte, ztc - 0.01, (yte - y) / (yte * 0.45))
        return lerp(ztc - 0.01, ztc, (yte * 0.55 - y) / (yte * 0.55))

    def front(self, b):
        S, xf = self.S, self.xf
        F = S['front']
        if b.lod:
            return
        zg0, zg1, gw = F['grille']
        gr = min(0.05, (zg1 - zg0) * 0.3)
        # the grille: a dark recess, slats, a chrome surround and a badge
        b.box((xf - 0.01, 0, (zg0 + zg1) / 2), (0.06, 2 * gw, zg1 - zg0), F.get('grille_role', 'trim'))
        bars = F.get('grille_bars') or [zg0 + (zg1 - zg0) * k / 4 for k in (1, 2, 3)]
        for zz in bars:
            b.box((xf + 0.022, 0, zz), (0.012, 2 * gw - 0.05, 0.018 if F.get('grille_bars') else 0.012),
                  F.get('grille_bar_role', 'rim'), skip=('-x',))
        if F.get('grille_bar', True):
            ring = []
            for cy, cz, a0 in ((gw - gr, zg1 - gr, 0), (-gw + gr, zg1 - gr, 90), (-gw + gr, zg0 + gr, 180), (gw - gr, zg0 + gr, 270)):
                for k in range(3):
                    a = math.radians(a0 + 45 * k)
                    ring.append((xf + 0.024, cy + gr * math.cos(a), cz + gr * math.sin(a)))
            b.tube(ring, 0.013, 'chrome', sides=5, closed=True)
        if not F.get('no_badge'):
            zb_ = (zg0 + zg1) / 2 if not F.get('grille_bars') else zg1 - (zg1 - zg0) * 0.5
            b.rod((xf + 0.026, 0, zb_), (xf + 0.042, 0, zb_), min(0.045, (zg1 - zg0) * 0.28), 'chrome', sides=10, caps=True)
        # the intake and a splitter lip under it
        zi0, zi1, iw = F['intake']
        b.box((xf - 0.015, 0, (zi0 + zi1) / 2), (0.05, 2 * iw, zi1 - zi0), 'trim')
        for k in (1, 2):
            b.box((xf + 0.012, 0, zi0 + (zi1 - zi0) * k / 3), (0.01, 2 * iw - 0.04, 0.012), 'under', skip=('-x',))
        if not F.get('no_splitter'):
            b.box((xf - 0.02, 0, zi0 - 0.035), (0.09, 2 * iw + 0.3, 0.022), 'trim')
        zp = F['plate_z']
        b.box((xf + 0.03, 0, zp), (0.025, 0.31, 0.155), 'plate')
        b.box((xf + 0.02, 0, zp), (0.02, 0.33, 0.175), 'trim', skip=('-x',))
        # the headlamps: a dark housing wrapping the corner, a chrome reflector, projectors, an LED strip, an amber tip
        k6, k7 = self.k['zsh'], self.k['zs2']
        y0 = gw + F.get('lamp_gap', 0.04)
        wrap = F.get('wrap', S['head_len'] * 0.85)
        dz = F.get('lamp_dz', (0.04, 0.02))
        if self.plan(xf) - 0.02 > y0:
            for side in (1, -1):
                P = self.nose_path(side, y0, wrap)
                Pa = P[:-2] if len(P) > 6 else P
                hs = lambda x: (k6(x) - dz[0], k7(x) + dz[1])
                self.band(b, P, hs, 0.008, 'trim')
                lens = lambda x: (lerp(k6(x), k7(x), 0.1), k7(x) + dz[1] * 0.4)
                self.band(b, Pa, lens, 0.013, 'glass')
                self.band(b, P[-3:], lens, 0.013, 'amber')
                rim_ = lambda x: (k7(x) + dz[1] * 0.4, k7(x) + dz[1] * 0.75)
                self.band(b, P, rim_, 0.012, 'chrome')
                drl = lambda x: (k6(x) - dz[0] * 0.6, lerp(k6(x), k7(x), 0.12))
                self.band(b, Pa, drl, 0.016, 'head')
                # projectors: along the face, looking forward
                h = k7(xf) - k6(xf)
                for f in F.get('projectors', (0.25, 0.6)):
                    x, y, nx, ny = P[min(int(f * (len(Pa) - 1)), len(Pa) - 1)]
                    zc = lerp(k6(x), k7(x), 0.62)
                    r = max(0.024, min(0.05, h * 0.4))
                    b.rod((x + nx * 0.011, y + ny * 0.011, zc), (x + nx * 0.02, y + ny * 0.02, zc), r * 1.35, 'chrome', sides=10, caps=True)
                    b.rod((x + nx * 0.012, y + ny * 0.012, zc), (x + nx * 0.03, y + ny * 0.03, zc), r, 'head', sides=10, caps=True)
        if F.get('fog'):
            for side in (1, -1):
                y = side * (iw + 0.08)
                zc = (zi0 + zi1) / 2
                b.box((xf - 0.005, y, zc), (0.04, 0.16, 0.1), 'trim')
                b.rod((xf + 0.012, y, zc), (xf + 0.03, y, zc), 0.036, 'head', sides=10, caps=True)
        # the hood's shut line: along each side and across the nose
        if F.get('hood') is not None or S.get('gh'):
            x0 = F.get('hood', S['gh']['rings'][0][1] - 0.04 if S.get('gh') else xf - 1.0)
            xn = xf - F.get('hood_front', 0.07)
            for side in (1, -1):
                pts = []
                for i in range(7):
                    x = lerp(x0, xn, i / 6)
                    y = self.plan(x) - self.k['inset'](x) - 0.07
                    pts.append((x, side * y, self.top_z(x, y)))
                b.ribbon(pts, 0.009, 'trim', lambda p, side=side: (0, side * 0.25, 1))
            yn = self.plan(xn) - self.k['inset'](xn) - 0.07
            pts = [(xn, yn * t, self.top_z(xn, yn * t)) for t in [k / 6 for k in range(-6, 7)]]
            b.ribbon(pts, 0.009, 'trim', lambda p: (0.3, 0, 1))

    def rear(self, b):
        S, xr = self.S, self.xr
        Rr = S.get('rear')
        if b.lod or not Rr:
            return
        s = self.plan(xr)
        z6, z7 = self.k['zsh'](xr), self.k['zs2'](xr)
        tl = Rr.get('tail_in', 0.35)
        for side in (1, -1):
            b.box((xr - 0.005, side * (s + tl) / 2 if not Rr.get('bar') else side * s / 2, (z6 + z7) / 2),
                  (0.03, (s - tl) if not Rr.get('bar') else s, z7 - z6), 'tail')
        if Rr.get('bar'):                                  # a full-width light bar
            pass
        if Rr.get('tail_box'):
            z0, z1, w = Rr['tail_box']
            for side in (1, -1):
                b.box((xr - 0.008, side * (s - w / 2 - 0.01), (z0 + z1) / 2), (0.03, w, z1 - z0), 'tail')
        zp = Rr['plate_z']
        b.box((xr - 0.012, 0, zp), (0.025, 0.31, 0.155), 'plate')
        zb0, zb1 = Rr['bumper']
        b.box((xr + 0.04, 0, (zb0 + zb1) / 2), (0.1, 2 * s - 0.1, zb1 - zb0), 'trim', skip=('+x',))
        for side in Rr.get('exhaust', ()):
            b.cyl((xr + 0.05, side * 0.55, zb0 + 0.02), 0.035, 0.14, 'chrome', axis='x', sides=8, cap_role='under')

    def details(self, b):
        S = self.S
        D = S['detail']
        # mirrors on the doors at the A-pillar's foot
        xm, zm = D['mirror']
        ym = self.side_y(xm, zm - 0.05)
        ml, mw, mh = D.get('mirror_size', (0.1, 0.2, 0.13))
        arm = D.get('mirror_arm', 0.05)
        for side in (1, -1):
            b.box((xm - 0.03, side * (ym + (0.1 + arm) / 2), zm - mh * 0.45), (0.07, 0.1 + arm, 0.03), 'trim')
            rbox(b, (xm - 0.06, side * (ym + arm + mw * 0.75), zm), (ml, mw, mh), 0.035, D.get('mirror_role', 'paint'), n=1, ends=0)
            b.box((xm - 0.06 - ml / 2 - 0.002, side * (ym + arm + mw * 0.775), zm), (0.006, mw * 0.85, mh * 0.8), 'glass')
        # door handles and seams
        for x, z in D.get('handles', []):
            for side in (1, -1):
                b.box((x, side * (self.side_y(x, z) + 0.008), z), (0.17, 0.02, 0.028), D.get('handle_role', 'chrome'))
        for seam in D.get('seams', []):
            sides = (1, -1)
            if isinstance(seam, dict):
                sides, seam = seam['sides'], seam['pts']
            for side in sides:
                pts = [(x, side * self.wall_y(x, z), z) for x, z in seam]
                b.ribbon(pts, 0.01, 'trim', lambda p, side=side: (0, side, 0))
        # a window sill strip
        if D.get('sill_strip'):
            x0, x1, z = D['sill_strip']
            for side in (1, -1):
                pts = [(x0 + (x1 - x0) * i / 5, side * self.side_y(x0 + (x1 - x0) * i / 5, z), z) for i in range(6)]
                b.ribbon(pts, 0.02, D.get('sill_strip_role', 'chrome'), lambda p, side=side: (0, side, 0))
        # wipers at the screen's foot
        xw, zw = D['wipers']
        for yy in (0.3, -0.25):
            b.box((xw, yy, zw), (0.03, 0.6, 0.015), 'trim', yaw=0.12)
        # the cabin: a dash, seats, head restraints
        I = D['interior']
        x0, x1, z0, z1, hw = I['tub']
        b.box(((x0 + x1) / 2, 0, (z0 + z1) / 2), (x1 - x0, 2 * hw, z1 - z0), 'interior', skip=('-z',))
        if I.get('partition'):
            xp, zp0, zp1 = I['partition']
            b.box((xp, 0, (zp0 + zp1) / 2), (0.04, 2 * hw + 0.1, zp1 - zp0), 'interior')
        xd, zd = I['dash']
        b.box((xd, 0, zd), (0.3, 1.7 * hw, 0.14), 'interior')
        for xs, zs, n_ in I['seats']:
            if n_ == 2:
                for yy in (-hw / 2, hw / 2):
                    b.box((xs, yy, zs), (0.12, hw * 0.8, 0.5), 'interior', pitch=0.18, skip=('-z',))
                    b.box((xs - 0.05, yy, zs + 0.32), (0.1, 0.24, 0.15), 'interior', skip=('-z',))
            else:
                b.box((xs, 0, zs), (0.12, hw * 1.9, 0.48), 'interior', pitch=0.18, skip=('-z',))
        if D.get('roof_rails'):
            x0, x1, z, y = D['roof_rails']
            for side in (1, -1):
                pts = [(x0 + (x1 - x0) * i / 4, side * y, z + 0.015 * math.sin(math.pi * i / 4)) for i in range(5)]
                b.tube([(pts[0][0] + 0.06, pts[0][1], z - 0.05)] + pts + [(pts[-1][0] - 0.06, pts[-1][1], z - 0.05)],
                       0.022, D.get('rail_role', 'chrome'), sides=4)
        if D.get('running_boards'):
            x0, x1, z = D['running_boards']
            for side in (1, -1):
                y = self.W / 2 - 0.08
                b.box(((x0 + x1) / 2, side * y, z), (x1 - x0, 0.22, 0.05), 'trim')
        if D.get('spoiler'):
            x, z, w = D['spoiler']
            rbox(b, (x, 0, z), (0.22, w, 0.05), 0.02, 'paint', n=1, ends=0)
        if D.get('bed_caps'):
            x0, x1, z = D['bed_caps']
            for side in (1, -1):
                y = self.plan((x0 + x1) / 2) - self.k['inset']((x0 + x1) / 2) - 0.02
                b.box(((x0 + x1) / 2, side * y, z + 0.012), (x0 - x1, 0.1, 0.025), 'trim')
            b.box((x1 + 0.02, 0, self.k['zte'](x1) - 0.12), (0.03, 0.25, 0.05), 'trim')      # tailgate handle
        if D.get('hitch'):
            xh, zh = D['hitch']
            b.box((xh, 0, zh), (0.25, 0.08, 0.08), 'under')
            b.box((xh - 0.1, 0, zh + 0.04), (0.06, 0.06, 0.06), 'chrome')
        if D.get('antenna'):
            xa, za = D['antenna']
            b.box((xa, 0, za + 0.03), (0.15, 0.05, 0.06), 'trim', skip=('-z',))


# ── the specs ───────────────────────────────────────────────────────────────────────────────────────────────────────
SEDAN = dict(
    L=4.85, W=1.85, axles=(1.43, -1.40), R=0.335, rin=0.216, tw=0.225, track=0.795, yin=0.63, Ra=0.395,
    rcf=0.55, rcr=0.40, pf=0.34, pr=0.26,
    zb=[(-2.425, 0.40), (-2.05, 0.26), (-1.7, 0.18), (1.8, 0.18), (2.15, 0.21), (2.35, 0.24), (2.425, 0.32)],
    zrk=[(-2.425, 0.44), (-2.0, 0.30), (-1.7, 0.23), (1.8, 0.23), (2.2, 0.26), (2.35, 0.29), (2.425, 0.35)],
    zlow=[(-2.425, 0.50), (-1.8, 0.42), (1.8, 0.40), (2.425, 0.40)],
    zsh=[(-2.425, 0.80), (-1.7, 0.83), (0.0, 0.79), (1.5, 0.74), (2.15, 0.67), (2.425, 0.59)],
    zs2=[(-2.425, 0.90), (-1.7, 0.93), (0.0, 0.90), (1.5, 0.84), (2.15, 0.755), (2.425, 0.665)],
    zte=[(-2.425, 0.95), (-2.3, 0.995), (-2.1, 1.008), (-1.6, 1.0), (0.9, 0.96), (1.5, 0.885), (2.1, 0.80), (2.32, 0.75), (2.425, 0.69)],
    crown=[(-2.425, 0.02), (-1.6, 0.04), (0.9, 0.035), (2.425, 0.02)],
    inset=[(-2.425, 0.07), (-1.6, 0.10), (1.5, 0.10), (2.425, 0.07)],
    flare=0.014, belly=0.008, head_len=0.56, tail_len=0.36, bumper_trim=None,
    extra_x=[0.0, -0.6, 0.6, 1.0, -1.9],
    gh=dict(rings=[(0.93, 1.06, -1.56, 0.80, 0.44, 0.38, 'hide'), (0.985, 1.00, -1.52, 0.795, 0.44, 0.38, 'seal'),
                   (1.01, 0.96, -1.49, 0.79, 0.44, 0.38, 'win'), (1.37, 0.24, -0.98, 0.655, 0.18, 0.24, 'roof'),
                   (1.425, 0.12, -0.88, 0.60, 0.16, 0.22, 'roof'), (1.452, -0.02, -0.74, 0.47, 0.15, 0.18, None)],
            z_lo=1.01, z_hi=1.37, side_lo=[-0.22, -0.30, -1.02], side_hi=[-0.30, -0.37, -0.70],
            side_roles=['glass', 'trim', 'glass', 'paint'], nf=5, nr=4, bow=0.015),
    front=dict(grille=(0.47, 0.64, 0.40), grille_bar=True, intake=(0.30, 0.42, 0.52), plate_z=0.37, fog=True),
    rear=dict(plate_z=0.70, bumper=(0.30, 0.48), exhaust=(-1,), tail_in=0.30),
    detail=dict(mirror=(0.86, 1.07), handles=[(0.28, 0.86), (-0.62, 0.88)],
                seams=[[(1.03, 0.30), (1.03, 0.62), (0.98, 0.98)], [(-0.24, 0.27), (-0.25, 0.62), (-0.25, 1.0)],
                       [(-0.98, 0.29), (-0.99, 0.55), (-1.12, 0.78), (-1.24, 0.99)]],
                sill_strip=(0.95, -1.15, 1.0), wipers=(1.0, 0.99),
                interior=dict(tub=(-1.25, 0.65, 0.75, 0.98, 0.70), dash=(0.42, 0.98), seats=[(-0.12, 0.97, 2), (-0.80, 0.92, 3)]),
                antenna=(-0.82, 1.43)),
)


def sedan(b):
    return Car(SEDAN).build(b)


def taxi(b):
    c = Car(SEDAN).build(b)
    # the roof sign: a lit, prism-sided ad top on a black base, along the roof
    if b.lod == 0:
        b.box((-0.38, 0, 1.47), (0.9, 0.34, 0.04), 'trim')
        rbox(b, (-0.38, 0, 1.64), (0.95, 0.3, 0.3), 0.04, 'sign', n=1, ends=1, rx=0.05)
    else:
        b.box((-0.38, 0, 1.6), (0.95, 0.3, 0.32), 'sign', skip=('-z',))
    return c


SUV = dict(
    L=4.9, W=1.95, axles=(1.50, -1.35), R=0.37, rin=0.24, tw=0.245, track=0.83, yin=0.65, Ra=0.44,
    rcf=0.52, rcr=0.32, pf=0.30, pr=0.18,
    zb=[(-2.45, 0.44), (-2.1, 0.27), (-1.8, 0.21), (1.9, 0.21), (2.2, 0.26), (2.45, 0.36)],
    zrk=[(-2.45, 0.49), (-2.1, 0.32), (-1.8, 0.26), (1.9, 0.26), (2.2, 0.31), (2.45, 0.40)],
    zlow=[(-2.45, 0.60), (-1.8, 0.53), (1.8, 0.51), (2.45, 0.54)],
    zsh=[(-2.45, 0.95), (-1.6, 0.98), (0.0, 0.96), (1.5, 0.93), (2.2, 0.89), (2.45, 0.84)],
    zs2=[(-2.45, 1.05), (-1.6, 1.08), (0.0, 1.06), (1.5, 1.02), (2.2, 0.975), (2.45, 0.925)],
    zte=[(-2.45, 1.07), (-2.3, 1.11), (-1.6, 1.13), (0.9, 1.12), (1.5, 1.08), (2.1, 1.03), (2.35, 1.0), (2.45, 0.96)],
    crown=0.03, inset=[(-2.45, 0.07), (-1.6, 0.10), (1.5, 0.10), (2.45, 0.07)],
    flare=0.022, belly=0.006, head_len=0.5, tail_len=0.34, sill_role='trim',
    extra_x=[0.0, 1.0, -1.9],
    gh=dict(rings=[(1.08, 1.16, -2.31, 0.85, 0.40, 0.18, 'hide'), (1.13, 1.10, -2.32, 0.845, 0.40, 0.18, 'seal'),
                   (1.155, 1.06, -2.31, 0.84, 0.40, 0.18, 'win'), (1.56, 0.32, -2.10, 0.71, 0.18, 0.12, 'roof'),
                   (1.625, 0.18, -2.04, 0.65, 0.16, 0.10, 'roof'), (1.652, 0.0, -1.96, 0.53, 0.14, 0.08, None)],
            z_lo=1.155, z_hi=1.56, side_lo=[-0.22, -0.30, -1.25, -1.35, -1.92], side_hi=[-0.30, -0.38, -1.28, -1.38, -1.86],
            side_roles=['glass', 'trim', 'glass', 'trim', 'glass', 'paint'], nf=5, nr=4, bow=0.015),
    front=dict(grille=(0.56, 0.82, 0.46), grille_bar=True, grille_bars=[0.65, 0.74], grille_bar_role='trim',
               intake=(0.33, 0.48, 0.60), plate_z=0.42, fog=True),
    rear=dict(plate_z=0.82, bumper=(0.40, 0.60), exhaust=(-1, 1), tail_in=0.42),
    detail=dict(mirror=(0.95, 1.22), handles=[(0.30, 1.00), (-0.70, 1.02)], handle_role='trim',
                seams=[[(1.02, 0.36), (1.02, 1.13)], [(-0.26, 0.30), (-0.27, 1.14)],
                       [(-0.88, 0.32), (-0.90, 0.62), (-1.10, 0.86), (-1.32, 1.14)]],
                sill_strip=(1.08, -2.2, 1.14), sill_strip_role='trim', wipers=(1.10, 1.13),
                interior=dict(tub=(-2.0, 0.7, 0.85, 1.12, 0.74), dash=(0.50, 1.12), seats=[(-0.18, 1.12, 2), (-1.0, 1.10, 3)]),
                roof_rails=(0.15, -1.85, 1.68, 0.56), rail_role='trim', antenna=(-1.7, 1.63)),
)

HATCH = dict(
    L=4.25, W=1.80, axles=(1.245, -1.375), R=0.32, rin=0.203, tw=0.205, track=0.78, yin=0.62, Ra=0.38,
    rcf=0.50, rcr=0.28, pf=0.32, pr=0.18,
    zb=[(-2.125, 0.36), (-1.85, 0.22), (-1.6, 0.17), (1.5, 0.17), (1.85, 0.21), (2.125, 0.30)],
    zrk=[(-2.125, 0.40), (-1.85, 0.27), (-1.6, 0.22), (1.5, 0.22), (1.85, 0.26), (2.125, 0.33)],
    zlow=0.42,
    zsh=[(-2.125, 0.84), (-1.6, 0.86), (0.0, 0.82), (1.3, 0.76), (1.85, 0.68), (2.125, 0.60)],
    zs2=[(-2.125, 0.94), (-1.6, 0.96), (0.0, 0.92), (1.3, 0.86), (1.85, 0.77), (2.125, 0.67)],
    zte=[(-2.125, 0.97), (-2.0, 1.0), (-1.6, 1.0), (0.7, 0.97), (1.3, 0.89), (1.85, 0.80), (2.05, 0.75), (2.125, 0.70)],
    crown=0.03, inset=[(-2.125, 0.07), (-1.6, 0.10), (1.3, 0.10), (2.125, 0.07)],
    flare=0.016, belly=0.008, head_len=0.5, tail_len=0.30,
    extra_x=[0.0, -0.6, 0.6],
    gh=dict(rings=[(0.95, 1.00, -2.02, 0.79, 0.42, 0.20, 'hide'), (0.99, 0.96, -2.03, 0.785, 0.42, 0.20, 'seal'),
                   (1.015, 0.92, -2.02, 0.78, 0.42, 0.20, 'win'), (1.38, 0.18, -1.74, 0.645, 0.16, 0.14, 'roof'),
                   (1.445, 0.05, -1.66, 0.585, 0.14, 0.12, 'roof'), (1.475, -0.08, -1.56, 0.46, 0.12, 0.10, None)],
            z_lo=1.015, z_hi=1.38, side_lo=[-0.28, -0.36, -1.18], side_hi=[-0.34, -0.42, -1.24],
            side_roles=['glass', 'trim', 'glass', 'paint'], nf=5, nr=4, bow=0.015),
    front=dict(grille=(0.45, 0.58, 0.36), grille_bar=True, intake=(0.26, 0.40, 0.55), plate_z=0.33),
    rear=dict(plate_z=0.70, bumper=(0.30, 0.48), exhaust=(-1,), tail_in=0.40),
    detail=dict(mirror=(0.82, 1.07), handles=[(0.20, 0.88), (-0.75, 0.90)],
                seams=[[(0.86, 0.30), (0.86, 0.99)], [(-0.32, 0.27), (-0.33, 1.0)],
                       [(-0.98, 0.30), (-1.0, 0.55), (-1.12, 0.78), (-1.18, 1.0)]],
                sill_strip=(0.94, -1.95, 1.0), sill_strip_role='trim', wipers=(0.95, 0.99),
                interior=dict(tub=(-1.6, 0.6, 0.75, 0.98, 0.68), dash=(0.42, 0.98), seats=[(-0.18, 0.97, 2), (-0.98, 0.93, 3)]),
                spoiler=(-1.60, 1.455, 1.0), antenna=(-1.35, 1.45)),
)

PICKUP = dict(
    L=5.6, W=2.0, axles=(1.85, -1.83), R=0.40, rin=0.254, tw=0.275, track=0.85, yin=0.64, Ra=0.48,
    rcf=0.26, rcr=0.08, pf=0.16, pr=0.04,
    zb=[(-2.8, 0.55), (-2.4, 0.48), (-2.2, 0.40), (2.2, 0.40), (2.6, 0.44), (2.8, 0.48)],
    zrk=[(-2.8, 0.61), (-2.4, 0.54), (-2.2, 0.46), (2.2, 0.46), (2.6, 0.50), (2.8, 0.54)],
    zlow=[(-2.8, 0.74), (-2.2, 0.70), (2.2, 0.68), (2.8, 0.66)],
    zsh=[(-2.8, 1.10), (0.0, 1.10), (2.0, 1.09), (2.8, 1.04)],
    zs2=[(-2.8, 1.20), (0.0, 1.21), (2.0, 1.19), (2.8, 1.14)],
    zte=[(-2.8, 1.26), (-0.8, 1.28), (1.1, 1.28), (1.6, 1.26), (2.55, 1.225), (2.8, 1.18)],
    crown=0.02, inset=[(-2.8, 0.06), (0.0, 0.07), (2.8, 0.06)],
    flare=0.03, belly=0.01, head_len=0.26, tail_len=0.14,
    bed=(-0.86, -2.72, 0.86), extra_x=[],
    gh=dict(rings=[(1.24, 1.20, -0.80, 0.89, 0.25, 0.04, 'hide'), (1.28, 1.17, -0.805, 0.885, 0.25, 0.04, 'seal'),
                   (1.30, 1.14, -0.805, 0.88, 0.25, 0.04, 'win'), (1.84, 0.50, -0.76, 0.79, 0.12, 0.04, 'roof'),
                   (1.90, 0.40, -0.74, 0.73, 0.10, 0.04, 'roof'), (1.92, 0.28, -0.70, 0.60, 0.08, 0.04, None)],
            z_lo=1.30, z_hi=1.84, side_lo=[0.12, 0.04, -0.68], side_hi=[0.08, 0.0, -0.66],
            side_roles=['glass', 'trim', 'glass', 'paint'], nf=4, nr=4, c_segs=2, bow=0.01),
    front=dict(grille=(0.70, 1.08, 0.60), grille_bar=True, grille_bars=[0.82, 0.95], intake=(0.50, 0.66, 0.70),
               plate_z=0.58, lamp_gap=0.03),
    rear=dict(plate_z=0.72, bumper=(0.55, 0.72), exhaust=(-1,), tail_in=0.9, tail_box=(0.88, 1.22, 0.12)),
    detail=dict(mirror=(1.05, 1.44), handles=[(0.70, 1.17), (-0.25, 1.17)], handle_role='trim',
                seams=[[(1.34, 0.66), (1.34, 1.0), (1.22, 1.27)], [(0.08, 0.62), (0.08, 1.28)], [(-0.78, 0.62), (-0.78, 1.28)],
                       [(-0.83, 0.62), (-0.83, 1.27)]],
                sill_strip=(1.12, -0.78, 1.29), sill_strip_role='trim', wipers=(1.16, 1.29),
                interior=dict(tub=(-0.75, 0.95, 0.95, 1.30, 0.80), dash=(0.75, 1.30), seats=[(0.2, 1.30, 2), (-0.55, 1.28, 3)]),
                running_boards=(1.30, -1.30, 0.50), bed_caps=(-0.88, -2.70, 1.28), hitch=(-2.76, 0.52)),
)


def suv(b):
    return Car(SUV).build(b)


def hatch(b):
    return Car(HATCH).build(b)


def pickup(b):
    b.lod1_wheel_sides = 6
    return Car(PICKUP).build(b)


# ── commercial vehicles ─────────────────────────────────────────────────────────────────────────────────────────────
def truck_wheels(b, sets, R, rin, tw, gap=0.03):
    """sets: [(x, y_outer, dual)…]: steel-disc truck wheels, single or dual (lod1: one wide tyre for a pair)."""
    for x, yo, dual in sets:
        for side in (1, -1):
            if b.lod:
                w = 2 * tw + gap if dual else tw
                wheel(b, x, side * (yo - (tw + gap) / 2 if dual else yo), R, rin, w, side)
                continue
            wheel(b, x, side * yo, R, rin, tw, side, spokes=0, dish=0.07, dish_role='rim')
            if dual:
                wheel(b, x, side * (yo - tw - gap), R, rin, tw, side, rim=False)


VAN = dict(
    L=5.9, W=2.0, axles=(1.95, -1.71), R=0.36, rin=0.203, tw=0.235, track=0.86, yin=0.64, Ra=0.43,
    rcf=0.45, rcr=0.06, pf=0.28, pr=0.03,
    zb=[(-2.95, 0.44), (-2.6, 0.36), (-2.2, 0.33), (2.3, 0.33), (2.7, 0.37), (2.95, 0.43)],
    zrk=[(-2.95, 0.50), (-2.6, 0.42), (-2.2, 0.39), (2.3, 0.39), (2.7, 0.43), (2.95, 0.49)],
    zlow=0.62,
    zsh=[(-2.95, 0.98), (1.6, 0.98), (2.5, 0.93), (2.95, 0.86)],
    zs2=[(-2.95, 1.06), (1.6, 1.07), (2.5, 1.02), (2.95, 0.95)],
    zte=[(-2.95, 1.12), (1.7, 1.14), (2.2, 1.11), (2.7, 1.05), (2.95, 0.99)],
    crown=[(-2.95, 0.0), (1.6, 0.0), (2.0, 0.03), (2.95, 0.02)], inset=[(-2.95, 0.03), (1.6, 0.03), (2.2, 0.06), (2.95, 0.06)],
    flare=0.02, belly=0.006, head_len=0.36, tail_len=0.04, sill_role='trim', bumper_trim=(0.0, 0.0),
    extra_x=[0.76, -0.80, 0.0, -2.2],
    gh=dict(rings=[(1.10, 1.80, -2.94, 0.975, 0.32, 0.05, 'hide'), (1.15, 1.75, -2.945, 0.975, 0.32, 0.05, 'seal'),
                   (1.17, 1.72, -2.945, 0.975, 0.32, 0.05, 'win_lo'), (1.47, 1.47, -2.94, 0.97, 0.30, 0.05, 'win'),
                   (1.95, 1.04, -2.935, 0.955, 0.26, 0.05, 'roof'), (2.28, 0.82, -2.93, 0.94, 0.30, 0.05, 'roof'),
                   (2.48, 0.60, -2.925, 0.895, 0.30, 0.05, 'roof'), (2.55, 0.40, -2.89, 0.74, 0.25, 0.05, None)],
            lod1=[(1.12, 1.76, -2.94, 0.975, 0.30, 0.05, 'win_front'), (1.95, 1.04, -2.935, 0.955, 0.26, 0.05, 'roof'),
                  (2.55, 0.42, -2.9, 0.80, 0.3, 0.05, None)],
            z_lo=1.17, z_hi=1.95, side_lo=[0.80, 0.72], side_hi=[0.76, 0.68],
            side_roles=['glass', 'trim', 'paint'], nf=4, nr=3, c_segs=1),
    front=dict(grille=(0.62, 0.88, 0.50), grille_bar=True, grille_bars=[0.72, 0.80], grille_bar_role='trim',
               intake=(0.42, 0.58, 0.70), plate_z=0.50, lamp_gap=0.03),
    rear=dict(plate_z=0.66, bumper=(0.44, 0.60), tail_in=0.9, tail_box=(0.62, 1.10, 0.11), exhaust=(-1,)),
    detail=dict(mirror=(1.58, 1.33), mirror_size=(0.1, 0.2, 0.3), mirror_arm=0.08, mirror_role='trim',
                handles=[(1.05, 1.0)], handle_role='trim',
                seams=[[(1.50, 0.45), (1.50, 1.14)], [(0.76, 0.45), (0.76, 1.95)],
                       dict(sides=(-1,), pts=[(0.62, 0.45), (0.62, 1.10), (0.62, 1.95)]),
                       dict(sides=(-1,), pts=[(-0.80, 0.45), (-0.80, 1.10), (-0.80, 1.95)]),
                       dict(sides=(-1,), pts=[(0.60, 1.96), (-0.85, 1.96)])],
                wipers=(1.72, 1.17),
                interior=dict(tub=(0.50, 1.6, 0.85, 1.15, 0.85), dash=(1.42, 1.17), seats=[(0.80, 1.18, 2)],
                              partition=(0.48, 1.0, 2.35))),
)


def van(b):
    c = Car(VAN).build(b)
    if b.lod == 0:
        # the rear doors' centre seam, the rear step, the sliding door's track and handle, roof marker lamps
        for z0, z1 in ((0.62, 1.12), (1.14, 2.42)):
            xs = c.xr - 0.004 if z0 < 1 else -2.945 + 0.0
            b.box((xs - 0.004, 0, (z0 + z1) / 2), (0.008, 0.012, z1 - z0), 'trim')
        b.box((c.xr + 0.04, 0, 0.42), (0.16, 1.5, 0.05), 'trim')
        b.box((-0.1, -(c.wall_y(-0.1, 1.98) + 0.01), 1.98), (1.5, 0.02, 0.025), 'trim')
        b.box((0.45, -(c.wall_y(0.45, 1.05) + 0.01), 1.05), (0.03, 0.02, 0.16), 'trim')
        for y in (-0.5, 0.5):
            b.box((0.36, y, 2.555), (0.06, 0.12, 0.03), 'amber')
        b.box((-2.93, 0, 2.47), (0.03, 0.3, 0.04), 'tail')                       # the high brake lamp
    return c


BOXCAB = dict(
    L=2.75, xc=3.125, W=2.30, hwk=[(4.5, 1.05), (3.36, 1.05), (3.26, 1.15), (1.75, 1.15)], step_x=[3.36, 3.26],
    axles=(3.55,), R=0.47, rin=0.25, tw=0.25, track=0.97, yin=0.80, Ra=0.56, arch_up=0.03, no_wheels=True,
    rcf=0.22, rcr=0.05, pf=0.12, pr=0.03,
    zb=[(1.75, 0.80), (3.2, 0.80), (4.2, 0.74), (4.5, 0.72)],
    zrk=[(1.75, 0.85), (3.2, 0.85), (4.2, 0.79), (4.5, 0.77)],
    zlow=[(1.75, 1.05), (3.25, 1.05), (4.5, 0.98)],
    zsh=[(1.75, 1.48), (3.22, 1.48), (3.4, 1.30), (4.5, 1.24)],
    zs2=[(1.75, 1.58), (3.22, 1.58), (3.4, 1.40), (4.5, 1.35)],
    zte=[(1.75, 1.64), (3.25, 1.65), (3.45, 1.56), (4.1, 1.50), (4.5, 1.42)],
    crown=[(1.75, 0.01), (3.3, 0.04), (4.5, 0.04)], inset=[(1.75, 0.04), (3.25, 0.04), (3.4, 0.10), (4.5, 0.08)],
    flare=0.04, head_len=0.32, tail_len=0.0, lod1_sill=1.4, lod1_x=[3.31],
    gh=dict(rings=[(1.60, 3.32, 1.76, 1.12, 0.20, 0.05, 'hide'), (1.64, 3.29, 1.755, 1.12, 0.20, 0.05, 'seal'),
                   (1.66, 3.27, 1.755, 1.12, 0.20, 0.05, 'win'), (2.42, 2.88, 1.76, 1.08, 0.14, 0.05, 'roof'),
                   (2.60, 2.75, 1.77, 1.03, 0.12, 0.05, 'roof'), (2.66, 2.62, 1.80, 0.92, 0.10, 0.05, None)],
            z_lo=1.66, z_hi=2.42, side_lo=[2.32, 2.26], side_hi=[2.30, 2.24],
            side_roles=['glass', 'trim', 'paint'], nf=4, nr=3, c_segs=1, back_role='glass'),
    front=dict(grille=(0.86, 1.30, 0.55), grille_bar=True, grille_bars=[1.0, 1.15], grille_bar_role='chrome',
               intake=(0.80, 0.86, 0.5), plate_z=0.62, lamp_gap=0.04),
    detail=dict(mirror=(3.05, 2.05), mirror_size=(0.08, 0.2, 0.42), mirror_arm=0.16, mirror_role='trim',
                handles=[(2.2, 1.55)], handle_role='trim',
                seams=[[(3.12, 0.95), (3.12, 1.64)], [(2.27, 0.95), (2.27, 1.64)]],
                wipers=(3.27, 1.66),
                interior=dict(tub=(1.8, 3.1, 1.2, 1.64, 1.0), dash=(3.0, 1.62), seats=[(2.15, 1.65, 2)])),
)


def boxtruck(b):
    b.lod1_wheel_sides = 6
    c = Car(BOXCAB).build(b)
    # the box: plywood-and-aluminium van body on the frame, a roll-up door at the back
    bx0, bx1, bz0, bz1, bw = -4.5, 1.62, 1.12, 3.6, 1.25
    if b.lod:
        b.box(((bx0 + bx1) / 2, 0, (bz0 + bz1) / 2), (bx1 - bx0, 2 * bw, bz1 - bz0), 'paint2')
        b.box((bx0 + 0.01, 0, 0.75), (0.04, 2.3, 0.2), 'trim', skip=('+x',))
        b.box((bx0 - 0.004, 0, 1.0), (0.02, 2.2, 0.12), 'tail', skip=('+x',))
    else:
        rbox(b, ((bx0 + bx1) / 2, 0, (bz0 + bz1) / 2), (bx1 - bx0, 2 * bw, bz1 - bz0), 0.05, 'paint2', n=1, ends=1, rx=0.05)
        for side in (1, -1):
            b.box(((bx0 + bx1) / 2, side * (bw + 0.008), bz0 + 0.06), (bx1 - bx0 - 0.02, 0.02, 0.12), 'trim')   # bottom rail
            b.box(((bx0 + bx1) / 2, side * (bw + 0.006), bz1 - 0.04), (bx1 - bx0 - 0.02, 0.016, 0.06), 'trim')  # top rail
            for x in (1.4, -1.4, -4.2):
                b.box((x, side * (bw + 0.012), bz0 + 0.18), (0.08, 0.02, 0.05), 'amber')
            for x in (-0.6, -2.6):                                                # side posts
                b.box((x, side * (bw + 0.006), (bz0 + bz1) / 2), (0.05, 0.012, bz1 - bz0 - 0.1), 'trim')
        # roll-up door: a frame round it and the slats' seams
        b.box((bx0 - 0.01, 0, bz1 - 0.12), (0.03, 2 * bw - 0.02, 0.16), 'trim')
        for y in (bw - 0.07, -(bw - 0.07)):
            b.box((bx0 - 0.01, y, (bz0 + bz1) / 2), (0.03, 0.12, bz1 - bz0 - 0.02), 'trim')
        for k in range(1, 9):
            z = bz0 + (bz1 - 0.2 - bz0) * k / 9
            b.box((bx0 - 0.006, 0, z), (0.01, 2 * bw - 0.26, 0.012), 'trim')
        b.box((bx0 - 0.03, 0, bz0 + 0.12), (0.03, 0.4, 0.05), 'chrome')                # door handle
        for side in (1, -1):
            b.box((bx0 + 0.02, side * 0.95, bz1 - 0.06), (0.03, 0.08, 0.05), 'amber')
            b.box((bx0 + 0.12, side * 1.0, 0.98), (0.2, 0.22, 0.14), 'trim')            # lamp housings under the sill
            b.box((bx0 - 0.0, side * 1.0, 0.98), (0.03, 0.18, 0.1), 'tail')
        b.box((bx0 + 0.1, 0, 0.78), (0.18, 2.3, 0.14), 'trim')                          # underride bar
        for side in (1, -1):
            b.box((bx0 + 0.12, side * 0.9, 0.95), (0.08, 0.08, 0.3), 'trim')
        b.box((bx0 - 0.005, 0, 0.9), (0.02, 0.31, 0.155), 'plate')
        # frame rails, the fuel tank, the battery box, mud flaps
        for side in (1, -1):
            b.box((-1.3, side * 0.45, 0.92), (6.2, 0.1, 0.28), 'under')
        b.box((-1.3, 0, 1.08), (6.2, 1.9, 0.06), 'under')
        b.cyl((0.9, -0.85, 0.72), 0.26, 0.9, 'chrome', axis='x', sides=10, cap_role='chrome')
        b.box((0.9, 0.82, 0.75), (0.7, 0.4, 0.4), 'trim')
        for side in (1, -1):
            b.box((-3.05, side * 0.98, 0.55), (0.02, 0.5, 0.6), 'trim')
            b.box((1.15, side * 1.0, 0.62), (0.02, 0.4, 0.5), 'trim')
        b.box((4.42, 0, 0.62), (0.2, 2.25, 0.24), 'chrome')                              # front bumper
    if b.lod:
        b.box((4.42, 0, 0.62), (0.2, 2.25, 0.24), 'trim', skip=('-x', '-z'))
    truck_wheels(b, [(3.55, c.S['track'], False), (-2.4, 1.10, True)], 0.47, 0.25, 0.25)
    return c


TRACTOR = dict(
    L=3.7, xc=6.4, W=2.5, hwk=[(8.25, 1.13), (6.74, 1.13), (6.62, 1.25), (4.55, 1.25)], step_x=[6.74, 6.62],
    axles=(7.35,), R=0.52, rin=0.29, tw=0.28, track=1.0, yin=0.80, Ra=0.62, arch_up=0.03, no_wheels=True,
    rcf=0.30, rcr=0.06, pf=0.18, pr=0.04,
    zb=[(4.55, 0.98), (6.5, 0.98), (7.9, 0.86), (8.25, 0.82)],
    zrk=[(4.55, 1.03), (6.5, 1.03), (7.9, 0.91), (8.25, 0.87)],
    zlow=[(4.55, 1.28), (6.6, 1.28), (8.25, 1.12)],
    zsh=[(4.55, 1.82), (6.58, 1.82), (6.8, 1.56), (8.25, 1.44)],
    zs2=[(4.55, 1.94), (6.58, 1.94), (6.8, 1.68), (8.25, 1.57)],
    zte=[(4.55, 2.0), (6.6, 2.02), (6.82, 1.92), (7.6, 1.80), (8.25, 1.66)],
    crown=[(4.55, 0.02), (6.7, 0.06), (8.25, 0.05)], inset=[(4.55, 0.05), (6.6, 0.05), (6.78, 0.14), (8.25, 0.10)],
    flare=0.05, head_len=0.48, tail_len=0.0, lod1_sill=1.9, lod1_x=[6.68],
    gh=dict(rings=[(1.96, 6.64, 4.56, 1.22, 0.18, 0.06, 'hide'), (2.02, 6.61, 4.555, 1.22, 0.18, 0.06, 'seal'),
                   (2.04, 6.59, 4.555, 1.22, 0.18, 0.06, 'win'), (2.72, 6.22, 4.56, 1.17, 0.14, 0.06, 'roof'),
                   (2.94, 6.06, 4.57, 1.12, 0.14, 0.06, 'roof'), (3.0, 5.92, 4.60, 1.0, 0.12, 0.06, None)],
            z_lo=2.04, z_hi=2.72, side_lo=[5.30, 5.22], side_hi=[5.28, 5.20],
            side_roles=['glass', 'trim', 'paint'], nf=4, nr=3, c_segs=4),
    front=dict(grille=(0.92, 1.62, 0.50), grille_role='trim', grille_bar=True, grille_bars=[1.08, 1.22, 1.36, 1.50],
               grille_bar_role='chrome', intake=(0.86, 0.92, 0.5), plate_z=0.68, lamp_gap=0.05),
    detail=dict(mirror=(6.38, 2.62), mirror_size=(0.08, 0.2, 0.48), mirror_arm=0.2, mirror_role='chrome',
                handles=[(5.45, 1.80)], handle_role='chrome',
                seams=[[(6.48, 1.08), (6.48, 2.02)], [(5.25, 1.08), (5.25, 2.02)]],
                sill_strip=(6.55, 4.62, 2.03), sill_strip_role='trim', wipers=(6.60, 2.05),
                interior=dict(tub=(4.65, 6.45, 1.4, 2.05, 1.1), dash=(6.30, 2.03), seats=[(5.35, 2.08, 2)])),
)


def semi(b):
    b.lod1_wheel_sides = 6
    c = Car(TRACTOR).build(b)
    lod = b.lod
    # roof fairing over the day cab: sloped front, full trailer width at its back
    fair = [(2.98, 5.90, 4.58, 1.05, 0.30, 0.04, 'roof'), (3.40, 5.40, 4.58, 1.20, 0.34, 0.04, 'roof'),
            (3.74, 4.92, 4.60, 1.24, 0.22, 0.04, 'roof'), (3.76, 4.86, 4.62, 1.20, 0.18, 0.04, None)]
    glasshouse(b, fair if lod == 0 else [fair[0], fair[2], fair[3]], lambda *a: 'paint', [], [], 0, 1, 4 if lod == 0 else 2, 2)
    for side in (1, -1):                                                         # cab extenders
        b.box((4.42, side * 1.235, 2.3), (0.3, 0.03, 2.1), 'paint', skip=('-z', '+z') if lod else ())
    # trailer: a 40-ft dry van (paint2) on its bogie, landing gear and side skirts
    tx0, tx1, tz0, tz1, tw = -8.25, 3.95, 1.25, 3.95, 1.3
    if lod:
        b.box(((tx0 + tx1) / 2, 0, (tz0 + tz1) / 2), (tx1 - tx0, 2 * tw, tz1 - tz0), 'paint2')
        b.box((tx0 - 0.004, 0, 1.15), (0.02, 2.3, 0.14), 'tail', skip=('+x',))
        b.box((-1.4, 0, 0.82), (3.2, 2.5, 0.7), 'trim', skip=('+z',))                # skirts as one block
        b.box((5.9, 0, 0.95), (3.2, 2.0, 0.45), 'under', skip=('+z',))
        b.box((8.13, 0, 0.66), (0.25, 2.45, 0.36), 'chrome', skip=('-x',))
    else:
        rbox(b, ((tx0 + tx1) / 2, 0, (tz0 + tz1) / 2), (tx1 - tx0, 2 * tw, tz1 - tz0), 0.04, 'paint2', n=1, ends=1, rx=0.04)
        for side in (1, -1):
            b.box(((tx0 + tx1) / 2, side * (tw + 0.01), tz0 + 0.06), (tx1 - tx0 - 0.04, 0.02, 0.12), 'trim')
            b.box(((tx0 + tx1) / 2, side * (tw + 0.006), tz1 - 0.035), (tx1 - tx0 - 0.04, 0.012, 0.05), 'chrome')
            for x in (3.7, 0.0, -4.0, -8.0):
                b.box((x, side * (tw + 0.014), tz0 + 0.2), (0.08, 0.02, 0.05), 'amber')
            b.box((-1.4, side * (tw - 0.03), 0.8), (6.6, 0.02, 0.72), 'trim')           # side skirts
            b.box((1.9, side * 0.6, 0.72), (0.1, 0.1, 0.9), 'trim')                     # landing gear legs
            b.box((1.9, side * 0.6, 0.27), (0.25, 0.25, 0.04), 'trim')
        b.box((1.9, 0, 0.95), (0.06, 1.2, 0.06), 'trim')
        b.box(((tx0 + tx1) / 2, 0, tz0 - 0.08), (tx1 - tx0 - 0.1, 2.0, 0.16), 'under')     # floor and cross-members
        b.box((-6.65, 0, 1.05), (3.0, 1.0, 0.16), 'under')                                # the slider
        # rear doors: frame, centre seam, lock rods, lamps, ICC bumper, plate
        b.box((tx0 - 0.012, 0, tz1 - 0.1), (0.03, 2 * tw, 0.14), 'trim')
        b.box((tx0 - 0.012, 0, tz0 + 0.06), (0.03, 2 * tw, 0.14), 'trim')
        b.box((tx0 - 0.008, 0, (tz0 + tz1) / 2), (0.016, 0.02, tz1 - tz0 - 0.2), 'trim')
        for y in (-0.95, -0.3, 0.3, 0.95):
            b.cyl((tx0 - 0.03, y, (tz0 + tz1) / 2), 0.018, tz1 - tz0 - 0.3, 'chrome', axis='z', sides=6)
        for side in (1, -1):
            b.box((tx0 - 0.015, side * 1.05, 1.12), (0.03, 0.22, 0.12), 'tail')
            b.box((tx0 - 0.015, side * 0.8, 1.12), (0.03, 0.12, 0.12), 'amber')
            b.box((tx0 - 0.02, side * 1.22, tz1 - 0.08), (0.03, 0.06, 0.05), 'tail')
            b.box((tx0 + 0.2, side * 0.85, 0.85), (0.08, 0.08, 0.5), 'trim')
            b.box((-7.9, side * 1.05, 0.5), (0.02, 0.45, 0.6), 'trim')                   # trailer mud flaps
        b.box((tx0 + 0.15, 0, 0.6), (0.12, 2.35, 0.14), 'trim')
        b.box((tx0 - 0.01, 0.45, 1.08), (0.02, 0.31, 0.155), 'plate')
        # tractor running gear: frame, fifth wheel, tanks, steps, stacks, fenders, flaps, bumper
        for side in (1, -1):
            b.box((4.7, side * 0.45, 0.95), (6.2, 0.1, 0.28), 'under')
        b.box((3.0, 0, 1.13), (1.2, 1.1, 0.1), 'trim')
        b.box((3.0, 0, 1.03), (0.6, 0.8, 0.12), 'under')
        for side in (1, -1):
            b.cyl((5.1, side * 1.0, 0.76), 0.33, 1.1, 'chrome', axis='x', sides=12, cap_role='chrome')
            for x in (4.7, 5.5):
                b.box((x, side * 1.0, 0.76), (0.05, 0.69, 0.69), 'trim', skip=('-z',))
            b.box((5.85, side * 1.12, 0.62), (0.4, 0.28, 0.04), 'trim')                 # steps
            b.box((5.85, side * 1.12, 0.92), (0.4, 0.22, 0.04), 'trim')
            b.cyl((4.36, side * 1.08, 2.55), 0.065, 2.9, 'chrome', axis='z', sides=8)    # stacks
            b.box((4.30, side * 1.08, 2.3), (0.06, 0.16, 0.8), 'chrome')
            b.box((3.0, side * 1.1, 1.13), (2.0, 0.34, 0.04), 'trim')                   # quarter fenders
            b.box((1.75, side * 1.05, 0.55), (0.02, 0.5, 0.62), 'trim')                  # mud flaps
            b.box((7.6, side * 0.45, 0.85), (1.3, 0.1, 0.2), 'under')
        b.box((8.13, 0, 0.66), (0.25, 2.45, 0.36), 'chrome')                             # bumper
        b.box((8.10, 0, 0.47), (0.2, 2.2, 0.06), 'trim')
        b.box((5.0, 0, 0.62), (1.6, 0.6, 0.28), 'under')                                # transmission / driveline
    truck_wheels(b, [(7.35, 1.0, False), (3.65, 1.09, True), (2.35, 1.09, True), (-6.0, 1.17, True), (-7.25, 1.17, True)],
                 0.52, 0.29, 0.28)
    return c


class Bus:
    """A 40-ft low-floor transit bus: a box section with rounded corners lofted along X, the livery and the glazing
    painted by number onto the loft's bands, two doors on the right (Blender −Y), panels on the flat ends."""
    xf, xr, hw = 5.98, -6.10, 1.275
    axles, R, rin, tw = (3.65, -3.35), 0.50, 0.286, 0.28
    rcf, rcr, Ra, yin = 0.22, 0.18, 0.58, 0.60
    posts = [4.50, 3.18, 1.88, 0.58, -0.72, -1.38, -2.68, -3.96, -5.20]
    doors = [(4.55, 5.70), (-2.64, -1.42)]

    def plan(self, x):
        if x > self.xf - self.rcf:
            d = (x - (self.xf - self.rcf)) / self.rcf
            return self.hw - self.rcf * (1 - math.sqrt(max(1 - d * d, 0)))
        if x < self.xr + self.rcr:
            d = ((self.xr + self.rcr) - x) / self.rcr
            return self.hw - self.rcr * (1 - math.sqrt(max(1 - d * d, 0)))
        return self.hw

    def zb(self, x):
        return pchip(x, [(-6.1, 0.46), (-5.6, 0.40), (-2.8, 0.36), (2.6, 0.30), (5.98, 0.30)])

    def section(self, x, lod):
        s = self.plan(x)
        zb = self.zb(x)
        if lod:
            z0 = 0.48
            return [(0.0, z0, 'under'), (s - 0.04, z0, 'skirt'), (s, z0 + 0.05, 'lower'), (s, 1.12, 'red'), (s, 1.18, 'blue'),
                    (s, 1.38, 'belt'), (s, 1.46, 'win'), (s - 0.025, 2.40, 'upper'), (s - 0.15, 2.80, 'roof'), (0.0, 2.88, None)]
        za = None
        for xa in self.axles:
            dx = abs(x - xa)
            if dx < self.Ra:
                z = self.R + 0.05 + math.sqrt(self.Ra ** 2 - dx * dx)
                za = z if za is None else max(za, z)
        zw = max(za if za is not None else zb + 0.03, zb + 0.01)
        yin = min(self.yin, s - 0.15)
        H = [(0.0, zb, 'under'), (yin, zb, 'well'), (yin, zw, 'well'), (s - 0.03, zw, 'lip'), (s, zw + 0.03, 'skirt'),
             (s, max(0.62, zw + 0.06), 'lower'), (s, 1.12, 'red'), (s, 1.18, 'blue'), (s, 1.38, 'belt'), (s, 1.46, 'win'),
             (s - 0.025, 2.40, 'upper'), (s - 0.05, 2.62, 'round'), (s - 0.17, 2.80, 'roof'), (s - 0.42, 2.865, 'roof'), (0.0, 2.88, None)]
        return H

    def role(self, slot, x, side):
        if slot in ('under', 'well', 'lip'):
            return 'under'
        front = x > self.xf - self.rcf
        if side < 0:                                     # the doors, glazed top to bottom, black frames and centre seam
            for d0, d1 in self.doors:
                if d0 - 0.06 < x < d1 + 0.06 and slot in ('skirt', 'lower', 'red', 'blue', 'belt', 'win'):
                    if x < d0 or x > d1 or abs(x - (d0 + d1) / 2) < 0.02:
                        return 'trim'
                    return 'glass'
        if slot == 'skirt':
            return 'trim'
        if front and slot in ('red', 'blue', 'belt', 'win'):
            return 'glass'
        if slot == 'red':
            return 'stripe_red'
        if slot == 'blue':
            return 'stripe_blue'
        if slot == 'win':
            if x < self.posts[-1]:
                return 'paint'
            if any(abs(x - p) < 0.04 for p in self.posts):
                return 'trim'
            return 'glass'
        return 'paint'

    def stations(self, lod):
        xf, xr = self.xf, self.xr
        if lod:
            return [xr, xr + self.rcr * 0.5, xr + self.rcr, xf - self.rcf, xf - self.rcf * 0.5, xf]
        xs = []
        for k in range(5):
            a = (math.pi / 2) * k / 4
            xs.append(xf - self.rcf + self.rcf * math.sin(a))
            xs.append(xr + self.rcr - self.rcr * math.sin(a))
        for xa in self.axles:
            for k in range(8):
                xs.append(xa + self.Ra * math.cos(math.pi * k / 7))
            xs += [xa + self.Ra + 0.012, xa - self.Ra - 0.012]
        for p in self.posts:
            xs += [p - 0.035, p + 0.035]
        for d0, d1 in self.doors:
            xs += [d0 - 0.05, d0, d1, d1 + 0.05, (d0 + d1) / 2 - 0.015, (d0 + d1) / 2 + 0.015]
        xs = sorted(set(round(x, 4) for x in xs))
        out = [xs[0]]
        for x in xs[1:]:
            if x - out[-1] > 0.008:
                out.append(x)
        return out

    def build(self, b):
        lod = b.lod
        b.lod1_wheel_sides = 6
        body_loft(b, self.stations(lod), lambda x: self.section(x, lod), self.role,
                  sharp_slots=('well', 'lip') if lod == 0 else ())
        xf, xr = self.xf, self.xr
        cf, cr = self.plan(xf), self.plan(xr)
        # the front: windscreen, destination sign, lamps, bumper, plate, the folded bike rack, mirror arms
        b.box((xf + 0.004, 0, 1.72), (0.03, 2 * cf - 0.04, 1.4), 'glass', skip=('-x',) if lod else ())
        b.box((xf + 0.006, 0, 2.60), (0.03, 1.9, 0.26), 'sign', skip=('-x',) if lod else ())
        if lod == 0:
            b.box((xf + 0.002, 0, 2.60), (0.03, 2 * cf - 0.06, 0.38), 'trim')
            b.box((xf + 0.004, 0, 1.0), (0.03, 2 * cf - 0.04, 0.04), 'trim')
            for side in (1, -1):
                b.box((xf + 0.01, side * 0.80, 0.66), (0.03, 0.34, 0.14), 'head')
                b.box((xf + 0.01, side * 0.80, 0.78), (0.03, 0.34, 0.06), 'amber')
                b.box((xf + 0.005, side * 0.80, 0.72), (0.03, 0.40, 0.30), 'trim')
                # mirror arms out of the roof corners and the mirror heads
                b.tube([(xf - 0.05, side * 1.05, 2.70), (xf + 0.25, side * 1.25, 2.55), (xf + 0.32, side * 1.38, 2.25)], 0.025, 'trim', sides=5)
                rbox(b, (xf + 0.32, side * 1.40, 2.05), (0.1, 0.22, 0.42), 0.04, 'trim', n=1, ends=0)
            b.box((xf + 0.02, 0, 0.42), (0.16, 2.48, 0.24), 'trim')
            b.box((xf + 0.105, 0, 0.42), (0.02, 0.31, 0.155), 'plate')
            # bike rack, folded up against the front
            for y in (-0.55, 0.55):
                b.tube([(xf + 0.10, y, 0.50), (xf + 0.14, y, 1.10)], 0.022, 'chrome', sides=5)
            for z in (0.62, 0.86, 1.08):
                b.tube([(xf + 0.12 + 0.04 * (z - 0.5) / 0.6, -0.62, z), (xf + 0.12 + 0.04 * (z - 0.5) / 0.6, 0.62, z)], 0.02, 'chrome', sides=5)
            b.box((xf + 0.05, 0, 0.52), (0.1, 1.2, 0.05), 'trim')
        # the rear: window, engine door, lamp stacks, bumper, plate
        b.box((xr - 0.004, 0, 2.15), (0.03, 1.7, 0.42), 'glass', skip=('+x',) if lod else ())
        if lod == 0:
            b.box((xr - 0.004, 0, 1.0), (0.025, 1.5, 0.75), 'trim')
            for side in (1, -1):
                b.box((xr - 0.01, side * (cr - 0.14), 0.95), (0.03, 0.2, 0.42), 'tail')
                b.box((xr - 0.01, side * (cr - 0.14), 1.25), (0.03, 0.2, 0.14), 'amber')
                b.box((xr - 0.01, side * (cr - 0.14), 1.42), (0.03, 0.2, 0.14), 'tail')
            b.box((xr - 0.03, 0, 0.45), (0.16, 2.45, 0.22), 'trim')
            b.box((xr - 0.115, 0, 0.62), (0.02, 0.31, 0.155), 'plate')
        else:
            for side in (1, -1):
                b.box((xr - 0.004, side * (cr - 0.14), 1.05), (0.03, 0.2, 0.62), 'tail', skip=('+x',))
            b.box((xf + 0.004, 0, 0.66), (0.03, 2 * cf - 0.2, 0.14), 'head', skip=('-x',))
        # roof pods: the hybrid's battery and cooling pod forward, the air-conditioning pod aft
        if lod == 0:
            rbox(b, (2.45, 0, 2.96), (4.4, 1.9, 0.22), 0.08, 'paint', n=2, ends=2, rx=0.3)
            rbox(b, (-4.70, 0, 2.98), (2.2, 2.1, 0.26), 0.09, 'paint', n=2, ends=2, rx=0.25)
            for k in range(4):                                                              # grilles on the AC pod
                b.box((-4.1 - 0.4 * k, 0, 3.115), (0.3, 1.4, 0.012), 'trim')
        else:
            b.box((2.45, 0, 2.96), (4.4, 1.9, 0.22), 'paint', skip=('-z',))
            b.box((-4.70, 0, 2.98), (2.2, 2.1, 0.26), 'paint', skip=('-z',))
        truck_wheels(b, [(self.axles[0], 1.10, False), (self.axles[1], 1.10, True)], self.R, self.rin, self.tw)
        return self


def bus(b):
    return Bus().build(b)


KINDS = {'sedan': sedan, 'suv': suv, 'hatch': hatch, 'pickup': pickup, 'taxi': taxi, 'van': van, 'bus': bus,
         'semi': semi, 'boxtruck': boxtruck}
AO_DIST = {'bus': 2.5, 'semi': 2.5, 'boxtruck': 2.0, 'van': 1.6}


# ── assembly, AO, export ─────────────────────────────────────────────────────────────────────────────────────────────
def to_object(name, b, mats):
    me = bpy.data.meshes.new(name)
    bmesh.ops.remove_doubles(b.bm, verts=b.bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(b.bm, edges=b.bm.edges, dist=1e-5)
    for e in b.bm.edges:
        fs = e.link_faces
        if len(fs) != 2 or fs[0].material_index != fs[1].material_index or e.calc_face_angle(0.0) > math.radians(48):
            e.smooth = False
    b.bm.to_mesh(me)
    b.bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new('tri', 'TRIANGULATE')
    mod.ngon_method = 'BEAUTY'
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def bake_ao(objs, dist):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    try:
        scene.cycles.device = 'CPU'
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('w')
    scene.world.light_settings.distance = dist
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0.0))
    ground = bpy.context.active_object
    for ob in objs:
        others = [o for o in objs if o is not ob]
        for o in others:
            o.location.z += 500                       # the other LOD out of the way
        attr = ob.data.color_attributes.new('AO', 'BYTE_COLOR', 'POINT')
        ob.data.color_attributes.active_color = attr
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        for d in attr.data:
            k = 1 - AO_LIFT * (1 - d.color[0])
            d.color = (k, k, k, 1)
        for o in others:
            o.location.z -= 500
    bpy.data.objects.remove(ground, do_unlink=True)


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
    bake_ao(objs, AO_DIST.get(kind, 1.2))
    for ob in objs:
        used = {p.material_index for p in ob.data.polygons}
        lo = [min(v.co[i] for v in ob.data.vertices) for i in range(3)]
        hi = [max(v.co[i] for v in ob.data.vertices) for i in range(3)]
        print(f'TRIS {kind} {ob.name}: {tris(ob)} tris, roles {[ROLES[i] for i in sorted(used)]}, '
              f'bounds x {lo[0]:.2f}..{hi[0]:.2f} y {lo[1]:.2f}..{hi[1]:.2f} z {lo[2]:.3f}..{hi[2]:.2f}')
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
    out_dir = os.path.abspath(a.get('out', os.path.join(os.path.dirname(__file__), '..', 'out', 'vehicles')))
    os.makedirs(out_dir, exist_ok=True)
    for k in (a['only'].split(',') if 'only' in a else KINDS):
        build(k, out_dir)


main()

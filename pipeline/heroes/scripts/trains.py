# pipeline/heroes/scripts/trains.py — the city's rolling stock as scripted models (after boats.py and the F1 Pixel Cup
# car method, tools/blender/build_f1_car.py): CTA 5000- and 7000-series cars, a Metra bi-level gallery coach and a
# Metra MP36PH-3C locomotive. Lofted body sections with rounded eaves, recessed window bands with mullions and gaskets,
# recessed door pairs with their windows and seams, fluted stainless where the class has it, cab ends with windscreens,
# destination signs, headlamps and marker lamps, roof HVAC pods, undercar equipment, trucks (side frames, wheels with
# flanges, axle boxes, springs, third-rail shoes), couplers, anticlimbers, diaphragms and the locomotive's long hood,
# cab, radiator fans, handrails, fuel tank and snowplough pilots. Generic look of each class: no logo or wordmark.
#
# Frame (as lib/rollingstock.js): origin at the car's centre on top of rail, +X toward the A (cab) end, +Y up, +Z to
# the right, metres. Built in Blender as (x, −z, y) so the glTF export (+Y up) lands in exactly that frame.
# Every face has a role → (colour, KIND) (lib/transit/meshkit.js KIND, lib/rollingstock.js COLOURS). Vertices are split
# where roles meet, so per vertex: COLOR_0 = the role's linear colour × Cycles-baked occlusion (lifted, AO_LIFT), and
# a float attribute `_KIND` the train shader reads (glass lit at night, signs in the line colour, headlamps on the
# lead car's +X end, tail lamps on the trailing car's +X end, stainless metal, painted livery).
#
# Run (headless): blender -b --factory-startup -P pipeline/heroes/scripts/trains.py -- --out pipeline/heroes/out/trains.glb
# Preview:        blender -b --factory-startup -P pipeline/heroes/scripts/train_preview.py -- --in <glb> --out <prefix>
# Consumed by pipeline/build/build-trains.js (falls back to the procedural lib/rollingstock.js without this file).
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from _export import args  # noqa: E402

AO_LIFT = 0.5           # 1 − AO_LIFT is the darkest a crease goes
HERE = os.path.dirname(os.path.abspath(__file__))
TRANSIT = os.path.join(HERE, '..', '..', '..', 'app', 'public', 'world', 'transit.json')
FALLBACK = {   # transit.json rollingStock (the pipeline catalog), used if the file is missing
    'cta5000': dict(length=14.63, width=2.84, height=3.66, floor=1.09, truckCentres=10.06, wheelbase=2.08, wheel=0.711, doorWidth=1.27),
    'cta7000': dict(length=14.63, width=2.84, height=3.66, floor=1.09, truckCentres=10.06, wheelbase=2.08, wheel=0.711, doorWidth=1.27),
    'metraCoach': dict(length=25.91, width=3.2, height=4.83, floor=1.22, truckCentres=18.14, wheelbase=2.59, wheel=0.914, doorWidth=1.5),
    'metraLoco': dict(length=20.98, width=3.25, height=4.7, floor=1.75, truckCentres=12.8, wheelbase=2.72, wheel=1.016, doorWidth=0.6),
}

KIND = dict(steel=0, concrete=1, ballast=2, rail=3, accent=4, roof=5, sign=6, glass=7, dark=8, stainless=9, door=10, headlight=11, tail=12, livery=13)
COLOURS = dict(stainless='#b9bec2', glass='#18222b', dark='#1c1f22', door='#a3a9ae', sign='#101418', head='#f2efe6', tail='#7a0c0c',
               roof='#8d9296', metraBlue='#005596', metraRed='#e31837', locoBody='#9ea4a8')


def hex_lin(h):
    n = int(h[1:], 16)

    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255))


# role → (colour, kind)
ROLE = {
    'stainless': ('stainless', 'stainless'), 'roof': ('roof', 'roof'), 'glass': ('glass', 'glass'), 'dark': ('dark', 'dark'),
    'door': ('door', 'door'), 'sign': ('sign', 'sign'), 'head': ('head', 'headlight'), 'tail': ('tail', 'tail'),
    'blue': ('metraBlue', 'livery'), 'red': ('metraRed', 'livery'), 'body': ('locoBody', 'livery'),
}
ROLES = list(ROLE)
RI = {r: i for i, r in enumerate(ROLES)}


def V(p):
    return Vector((p[0], p[1], p[2]))


def newell(pts):
    n = Vector((0, 0, 0))
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        n.x += (a[1] - b[1]) * (a[2] + b[2])
        n.y += (a[2] - b[2]) * (a[0] + b[0])
        n.z += (a[0] - b[0]) * (a[1] + b[1])
    return n


# ── the builder: points in the app frame, one bmesh per model, every face tagged with its role ─────────────────────
class M:
    def __init__(self):
        self.bm = bmesh.new()

    def face(self, pts, role, out):
        """A polygon facing `out` (a direction in the app frame)."""
        pts = [tuple(p) for p in pts]
        clean = []
        for p in pts:
            if not clean or (V(p) - V(clean[-1])).length > 1e-6:
                clean.append(p)
        if len(clean) > 2 and (V(clean[0]) - V(clean[-1])).length < 1e-6:
            clean.pop()
        if len(clean) < 3:
            return None
        n = newell(clean)
        if n.length < 1e-9:
            return None
        if n.dot(V(out)) < 0:
            clean.reverse()
        vs = [self.bm.verts.new((p[0], -p[2], p[1])) for p in clean]
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return None
        f.material_index = RI[role]
        return f

    def quad_from(self, pts, role, centre):
        c = sum((V(p) for p in pts), Vector()) / len(pts)
        return self.face(pts, role, c - V(centre))

    # ── primitives ──
    def box(self, c, h, role, skip=(), roles=None):
        """An axis-aligned box: centre c, half sizes h. skip: faces left out ('+x', '-y', …)."""
        cx, cy, cz = c
        hx, hy, hz = h
        P = lambda sx, sy, sz: (cx + sx * hx, cy + sy * hy, cz + sz * hz)
        F = {'+x': ([P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)], (1, 0, 0)),
             '-x': ([P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), P(-1, -1, 1)], (-1, 0, 0)),
             '+y': ([P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1)], (0, 1, 0)),
             '-y': ([P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)], (0, -1, 0)),
             '+z': ([P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)], (0, 0, 1)),
             '-z': ([P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1)], (0, 0, -1))}
        for k, (pts, n) in F.items():
            if k not in skip:
                self.face(pts, (roles or {}).get(k, role), n)

    def prism(self, outline, axis, a0, a1, role, cap=True, role_fn=None, cap_role=None):
        """A 2D outline extruded along an axis. axis 'x': outline (z, y); 'z': (x, y); 'y': (x, z)."""
        def P(u, v, a):
            return (a, v, u) if axis == 'x' else ((u, v, a) if axis == 'z' else (u, a, v))
        A = {'x': (1, 0, 0), 'y': (0, 1, 0), 'z': (0, 0, 1)}[axis]
        area = sum(outline[i][0] * outline[(i + 1) % len(outline)][1] - outline[(i + 1) % len(outline)][0] * outline[i][1] for i in range(len(outline)))
        sgn = 1 if area > 0 else -1
        n = len(outline)
        for i in range(n):
            (u0, v0), (u1, v1) = outline[i], outline[(i + 1) % n]
            nu, nv = sgn * (v1 - v0), -sgn * (u1 - u0)
            out = P(nu, nv, 0)
            r = role_fn((u0 + u1) / 2, (v0 + v1) / 2) if role_fn else role
            self.face([P(u0, v0, a0), P(u1, v1, a0), P(u1, v1, a1), P(u0, v0, a1)], r, out)
        if cap:
            for a, s in ((a0, -1), (a1, 1)):
                self.face([P(u, v, a) for u, v in outline], cap_role or role, tuple(s * k for k in A))

    def loft(self, rings, roles, out_fn, closed=True, row_roles=None, role_fn=None, skip=None):
        """rings: lists of 3D points (same count). roles[i]: role of segment i→i+1 (or row_roles[k] for band k, or
        role_fn(centroid)). out_fn(centroid, k) → an outward direction. skip(i, k): leave a face out."""
        n = len(rings[0])
        for k in range(len(rings) - 1):
            for i in range(n if closed else n - 1):
                j = (i + 1) % n
                if skip and skip(i, k):
                    continue
                q = [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]]
                c = sum((V(p) for p in q), Vector()) / 4
                role = role_fn(c) if role_fn else (row_roles[k] if row_roles else roles[i])
                self.face(q, role, out_fn(c, k))

    def cyl(self, c, axis, r, half, seg, role, caps=(True, True), r1=None, cap_role=None, phase=0.0):
        A = {'x': Vector((1, 0, 0)), 'y': Vector((0, 1, 0)), 'z': Vector((0, 0, 1))}[axis]
        U = Vector((0, 1, 0)) if axis != 'y' else Vector((1, 0, 0))
        W = A.cross(U)
        c = V(c)
        r1 = r if r1 is None else r1
        ring = lambda h, rr: [c + A * h + (U * math.cos(2 * math.pi * (k + phase) / seg) + W * math.sin(2 * math.pi * (k + phase) / seg)) * rr for k in range(seg)]
        lo, hi = ring(-half, r), ring(half, r1)
        for k in range(seg):
            k2 = (k + 1) % seg
            mid = (lo[k] + lo[k2] + hi[k] + hi[k2]) / 4
            self.face([lo[k], lo[k2], hi[k2], hi[k]], role, mid - (c + A * ((mid - c).dot(A))))
        if caps[0]:
            self.face(lo, cap_role or role, -A)
        if caps[1]:
            self.face(hi, cap_role or role, A)

    def lathe(self, c, axis_dir, prof, seg, role, cap_role=None, roles=None, phase=0.5):
        """A solid of revolution about an axis along x/y/z (axis_dir a signed unit vector): prof [(radius, offset along
        axis_dir)…], walked so the material is on its left; the first point's ring is capped (a hub)."""
        A = V(axis_dir)
        U = Vector((0, 1, 0)) if abs(A.y) < 0.5 else Vector((1, 0, 0))
        W = A.cross(U)
        c = V(c)
        rings = [[c + A * a + (U * math.cos(2 * math.pi * (k + phase) / seg) + W * math.sin(2 * math.pi * (k + phase) / seg)) * r for k in range(seg)] for r, a in prof]
        for b in range(len(prof) - 1):
            (r0, a0), (r1, a1) = prof[b], prof[b + 1]
            nr, na = -(a1 - a0), (r1 - r0)
            for k in range(seg):
                k2 = (k + 1) % seg
                ang = 2 * math.pi * (k + 0.5 + phase) / seg
                radial = U * math.cos(ang) + W * math.sin(ang)
                self.face([rings[b][k], rings[b][k2], rings[b + 1][k2], rings[b + 1][k]], (roles[b] if roles else role), radial * nr + A * na)
        if cap_role:
            self.face(rings[0], cap_role, A * (1 if prof[0][1] >= prof[1][1] else -1))

    def tube(self, path, r, role, sides=4):
        pts = [V(p) for p in path]
        rings = []
        for i in range(len(pts)):
            a = pts[max(i - 1, 0)]
            b = pts[min(i + 1, len(pts) - 1)]
            t = (b - a).normalized()
            up = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
            u = t.cross(up).normalized()
            w = u.cross(t).normalized()
            rings.append([pts[i] + r * (math.cos(2 * math.pi * (k + 0.5) / sides) * u + math.sin(2 * math.pi * (k + 0.5) / sides) * w) for k in range(sides)])
        for i in range(len(pts) - 1):
            for k in range(sides):
                k2 = (k + 1) % sides
                q = [rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]]
                c = sum(q, Vector()) / 4
                axis_pt = (pts[i] + pts[i + 1]) / 2
                self.face(q, role, c - axis_pt)

    # decals: thin panels standing just proud of a surface
    def side_rect(self, s, xa, xb, ya, yb, z, role):
        self.face([(xa, ya, s * z), (xb, ya, s * z), (xb, yb, s * z), (xa, yb, s * z)], role, (0, 0, s))

    def end_rect(self, x, d, za, zb, ya, yb, role):
        self.face([(x, ya, za), (x, ya, zb), (x, yb, zb), (x, yb, za)], role, (d, 0, 0))


# ── body sections ─────────────────────────────────────────────────────────────────────────────────────────────────────
def section(hw, levels, eave_r, crown, bottom, eave_pts=5, roof_pts=3, chamfer=0.04):
    """A closed car-body section (z, y), counter-clockwise seen from +X: up the right side through `levels` (the side
    wall's breakpoints, levels[-1] the eave), round the eave (radius eave_r), a cambered roof to the crown, down the
    left side and across the floor. Returns (points, index range of the right side wall, of the left)."""
    right = [(hw - chamfer, bottom)] + [(hw, y) for y in levels]
    e = levels[-1]
    arc = []
    for k in range(1, eave_pts + 1):
        t = (math.pi / 2) * k / eave_pts
        arc.append((hw - eave_r + eave_r * math.cos(t), e + eave_r * math.sin(t) * 0.8))
    zt, yt = arc[-1]
    roof = [(zt * (1 - k / roof_pts), yt + (crown - yt) * math.sin(0.5 * math.pi * k / roof_pts)) for k in range(1, roof_pts + 1)]
    half = right + arc + roof                     # right foot … crown (z = 0)
    left = [(-z, y) for z, y in reversed(half[:-1])]
    pts = half + left
    nr = len(right)
    return pts, (1, nr - 1), (len(pts) - nr, len(pts) - 2)


def ring_at(sec, x, fn=None):
    return [((fn(z, y)[0]) if fn else x, (fn(z, y)[1]) if fn else y, (fn(z, y)[2]) if fn else z) for z, y in sec]


def radial_out(axis_y, end_dir=0.0, end_from=None):
    def f(c, k):
        o = Vector((0, c.y - axis_y, c.z))
        o = o.normalized() if o.length > 1e-6 else Vector((0, 1, 0))
        if end_dir:
            o += Vector((end_dir * 0.6, 0, 0))
        return o
    return f


def cap_slabs(m, ring, cuts, d, roles):
    """Fill an end ring (a closed section at one x, or raked) as horizontal slabs between `cuts` (y values that are ring
    points on both sides), each slab one polygon, so a raked cab face stays planar per slab. roles[i]: slab i's role."""
    ys = [p[1] for p in ring]
    lo, hi = min(ys) - 1, max(ys) + 1
    bounds = [lo] + list(cuts) + [hi]
    for i in range(len(bounds) - 1):
        a, b = bounds[i], bounds[i + 1]
        pts = [p for p in ring if a - 1e-6 <= p[1] <= b + 1e-6]
        if len(pts) < 3:
            continue
        # keep the ring's cyclic order, starting on the right side at the slab's foot
        idx = [k for k, p in enumerate(ring) if a - 1e-6 <= p[1] <= b + 1e-6]
        n = len(ring)
        start = next((k for k in idx if ring[k][2] > 0 and abs(ring[k][1] - max(a, min(ys))) < 1e-6), None)
        if start is None:
            start = min(idx, key=lambda k: (ring[k][1], -ring[k][2]))
        seq = []
        k = start
        for _ in range(n):
            if k in idx:
                seq.append(ring[k])
            k = (k + 1) % n
        # the slab polygon is the run of in-range points (it wraps through the roof or the floor)
        m.face(seq, roles[i], (d, 0, 0))


# ── side walls: window bands, door openings, plain wall ───────────────────────────────────────────────────────────────
def side_wall(m, s, hw, levels, spans, band_roles=None, wall_role='stainless'):
    """spans: [(xa, xb, openings)], openings [(i0, i1, kind, opts)] cut the bands levels[i0]…levels[i1]."""
    for xa, xb, ops in spans:
        cut = set()
        for i0, i1, kind, o in ops:
            cut.update(range(i0, i1))
            opening(m, s, hw, xa, xb, levels[i0], levels[i1], kind, o)
        for i in range(len(levels) - 1):
            if i not in cut:
                m.side_rect(s, xa, xb, levels[i], levels[i + 1], hw, (band_roles or {}).get(i, wall_role))


def opening(m, s, hw, xa, xb, ya, yb, kind, o):
    depth = o.get('depth', 0.04)
    zo, zi = hw, hw - depth
    reveal = o.get('reveal', 'dark')
    m.face([(xa, yb, s * zo), (xb, yb, s * zo), (xb, yb, s * zi), (xa, yb, s * zi)], reveal, (0, -1, 0))   # head
    m.face([(xa, ya, s * zo), (xb, ya, s * zo), (xb, ya, s * zi), (xa, ya, s * zi)], o.get('sill', reveal), (0, 1, 0))
    m.face([(xa, ya, s * zo), (xa, yb, s * zo), (xa, yb, s * zi), (xa, ya, s * zi)], reveal, (1, 0, 0))    # jambs
    m.face([(xb, ya, s * zo), (xb, yb, s * zo), (xb, yb, s * zi), (xb, ya, s * zi)], reveal, (-1, 0, 0))
    if kind == 'win':
        m.side_rect(s, xa, xb, ya, yb, zi, 'glass')
        for xm in o.get('mullions', []):
            w = o.get('mw', 0.2) / 2
            mr = o.get('mullion', 'stainless')
            m.side_rect(s, xm - w, xm + w, ya, yb, zo, mr)
            m.face([(xm - w, ya, s * zo), (xm - w, yb, s * zo), (xm - w, yb, s * zi), (xm - w, ya, s * zi)], reveal, (-1, 0, 0))
            m.face([(xm + w, ya, s * zo), (xm + w, yb, s * zo), (xm + w, yb, s * zi), (xm + w, ya, s * zi)], reveal, (1, 0, 0))
        for xa2, xb2, ya2, yb2, role in o.get('panels', []):          # e.g. a side destination sign behind the glass
            m.side_rect(s, xa2, xb2, ya2, yb2, zi + 0.004, role)
    elif kind == 'door':
        xm = (xa + xb) / 2
        m.side_rect(s, xm - 0.012, xm + 0.012, ya, yb, zi - 0.004, 'dark')                 # the meeting seam
        for a, b in ((xa, xm - 0.012), (xm + 0.012, xb)):
            m.side_rect(s, a, b, ya, yb, zi, 'door')
            wa, wb = o.get('win', (ya + 0.75, yb - 0.3))
            m.side_rect(s, a + 0.09, b - 0.09, wa, wb, zi + 0.005, 'glass')
        if o.get('lower_win'):
            wa, wb = o['lower_win']
            for a, b in ((xa, xm - 0.012), (xm + 0.012, xb)):
                m.side_rect(s, a + 0.09, b - 0.09, wa, wb, zi + 0.005, 'glass')


def flutes(m, s, hw, xa, xb, ya, yb, pitch=0.055, depth=0.014, role='stainless'):
    """Horizontal fluting: trapezoid ribs standing proud of the side wall between ya and yb (no ends, no back)."""
    n = max(2, int(round((yb - ya) / pitch)))
    p = (yb - ya) / n
    prof = [(0.0, ya)]
    for k in range(n):
        y = ya + k * p
        prof += [(depth, y + p * 0.18), (depth, y + p * 0.62), (0.0, y + p * 0.82)]
    prof[-1] = (0.0, yb)
    for k in range(len(prof) - 1):
        (d0, y0), (d1, y1) = prof[k], prof[k + 1]
        nz, ny = (y1 - y0), -(d1 - d0)
        m.face([(xa, y0, s * (hw + d0)), (xb, y0, s * (hw + d0)), (xb, y1, s * (hw + d1)), (xa, y1, s * (hw + d1))], role, (0, ny, s * nz))
    # end returns, so a door jamb sees a closed rib
    for x, d in ((xa, -1), (xb, 1)):
        m.face([(x, y, s * (hw + dd)) for dd, y in prof] + [(x, yb, s * hw), (x, ya, s * hw)], role, (d, 0, 0))


def window_band(x0, x1, pitch, mw):
    n = max(1, int(round((x1 - x0) / pitch)))
    return [x0 + (x1 - x0) * k / n for k in range(1, n)]


# ── running gear ──────────────────────────────────────────────────────────────────────────────────────────────────────
def wheelset(m, x, r, seg=10, inner=0.675, outer=0.80, frame_role='dark'):
    for s in (-1, 1):
        A = (0, 0, s)
        prof = [(0.13, outer + 0.03), (r - 0.03, outer), (r, inner + 0.025), (r + 0.028, inner)]
        m.lathe((x, r, 0), A, prof, seg, 'dark', cap_role='dark')
    m.cyl((x, r, 0), 'z', 0.085, inner, 6, 'dark', caps=(False, False))


def side_frame(m, xc, r, h, z0, z1, kind):
    """A truck side frame (an outline in x, y extruded across z0…z1): pedestals over the axle boxes, a dropped centre
    where the bolster passes, a fish-belly between."""
    if kind == 'cta':
        top, bot, belly, end = r + 0.30, r + 0.10, r - 0.10, h + 0.32
        pts = [(-end, bot + 0.03), (-end, top - 0.04), (-end + 0.1, top), (-0.55, top), (-0.42, top - 0.08), (0.42, top - 0.08), (0.55, top),
               (end - 0.1, top), (end, top - 0.04), (end, bot + 0.03), (h + 0.16, bot), (h - 0.22, bot), (0.5, belly), (-0.5, belly), (-h + 0.22, bot), (-h - 0.16, bot)]
    else:
        top, bot, belly, end = r + 0.36, r + 0.14, r - 0.12, h + 0.36
        pts = [(-end, bot + 0.04), (-end, top - 0.06), (-end + 0.14, top), (-0.75, top), (-0.6, top - 0.16), (0.6, top - 0.16), (0.75, top),
               (end - 0.14, top), (end, top - 0.06), (end, bot + 0.04), (h + 0.2, bot), (h - 0.26, bot), (0.62, belly), (-0.62, belly), (-h + 0.26, bot), (-h - 0.2, bot)]
    m.prism([(xc + x, y) for x, y in pts], 'z', z0, z1, 'dark')


def truck(m, xc, S, kind='cta', shoe=False):
    r, h = S['wheel'] / 2, S['wheelbase'] / 2
    heavy = kind != 'cta'
    zf0, zf1 = (0.88, 1.02) if not heavy else (0.9, 1.06)
    for x in (xc - h, xc + h):
        wheelset(m, x, r)
    for s in (-1, 1):
        a, b = sorted((s * zf0, s * zf1))
        side_frame(m, xc, r, h, a, b, 'cta' if kind == 'cta' else 'heavy')
        for x in (xc - h, xc + h):                                       # axle boxes and their end caps
            m.box((x, r + 0.02, s * (zf1 - 0.02)), (0.16, 0.13, 0.07), 'dark', skip=('-z' if s > 0 else '+z',))
            m.cyl((x, r, s * (zf1 + 0.05)), 'z', 0.07, 0.02, 6, 'roof', caps=(s < 0, s > 0))
            if heavy:                                                    # coil springs over the boxes
                m.cyl((x, r + 0.26 + 0.07, s * (zf1 + 0.04)), 'y', 0.08, 0.1, 6, 'roof', caps=(False, True))
        if kind == 'cta':                                                # air springs on the bolster ends
            m.lathe((xc, r + 0.30, s * 0.95), (0, 1, 0), [(0.0, 0.26), (0.17, 0.25), (0.21, 0.14), (0.17, 0.02)], 6, 'dark')
        else:                                                            # nested coil springs at the bolster
            for dx in (-0.16, 0.16):
                m.cyl((xc + dx, r + 0.14, s * (zf1 + 0.05)), 'y', 0.085, 0.17, 6, 'roof', caps=(False, True))
            m.box((xc, r + 0.05, s * (zf1 + 0.05)), (0.42, 0.04, 0.1), 'dark', skip=('-y',))
    m.box((xc, r + 0.36, 0), (0.28, 0.1, zf0), 'dark')                                  # bolster
    for x in (xc - h * 0.45, xc + h * 0.45):                              # traction motors / brake units between the axles
        m.box((x, r + 0.02, 0), (0.22, 0.2, 0.5), 'dark', skip=('-y',))
    if shoe:                                                             # third-rail shoe gear, both sides
        for s in (-1, 1):
            m.box((xc, r - 0.02, s * (zf1 + 0.13)), (h * 0.55, 0.05, 0.05), 'dark')
            m.box((xc, r - 0.2, s * (zf1 + 0.2)), (0.05, 0.16, 0.035), 'dark', skip=('+y',))
            m.box((xc, 0.17, s * (zf1 + 0.32)), (0.17, 0.025, 0.16), 'dark')


def coupler(m, x, d, y=0.85, length=0.62):
    m.box((x + d * length * 0.45, y, 0), (length * 0.45, 0.09, 0.11), 'dark', skip=('-x' if d > 0 else '+x',))
    m.box((x + d * (length - 0.05), y, -0.03), (0.08, 0.16, 0.17), 'dark')


def underframe_boxes(m, xs, z_off=0.0):
    for xa, xb, ya, yb, za, zb, role in xs:
        m.box(((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2 + z_off), ((xb - xa) / 2, (yb - ya) / 2, (zb - za) / 2), role, skip=('+y',))


def hvac_pod(m, xc, ya, yb, a, b, chamfer=0.12, role='roof'):
    """A roof pod: a rounded-rectangle footprint, sides rising to a chamfered top; a dark condenser grille on top."""
    def rr(a_, b_, y, c):
        pts = []
        for cx, cz, t0 in ((a_ - c, b_ - c, 0), (-(a_ - c), b_ - c, 90), (-(a_ - c), -(b_ - c), 180), (a_ - c, -(b_ - c), 270)):
            for k in (0, 1):
                t = math.radians(t0 + 90 * k)
                pts.append((xc + cx + c * math.cos(t), y, cz + c * math.sin(t)))
        return pts
    yb -= 0.008
    rings = [rr(a, b, ya, 0.1), rr(a, b, yb - chamfer * 0.6, 0.1), rr(a - chamfer, b - chamfer, yb, 0.06)]
    m.loft(rings, None, lambda c, k: Vector((c.x - xc, 0.3 if k else 0, c.z)), row_roles=[role, role])
    m.face(rings[-1], role, (0, 1, 0))
    for dx in (-a * 0.45, a * 0.45):
        m.cyl((xc + dx, yb + 0.004, 0), 'y', min(b * 0.55, 0.32), 0.004, 10, 'dark', caps=(False, True))


# ── CTA cars ──────────────────────────────────────────────────────────────────────────────────────────────────────────
CTA_LV = [0.99, 1.06, 1.2, 1.6, 2.55, 2.75, 2.95]     # side wall breakpoints: foot, door sill, mask foot, belt/sill, head, door head, eave


def cta_car(S, series):
    m = M()
    L, hw = S['length'], S['width'] / 2
    x0, x1 = -L / 2, L / 2
    top = S['height'] - 0.3
    sec, _, _ = section(hw, CTA_LV, 0.42, top, 0.95, eave_pts=5, roof_pts=3)
    axis_y = 2.0
    nose = 0.95 if series == 7000 else 0.16        # depth of the A-end loft
    xa_body, xb_body = x0 + 0.14, x1 - nose
    rake = 0.38 if series == 7000 else 0.0
    belt = 1.6

    # roof and floor: a plain extrusion between the end lofts, stationed for the pods (AO resolution)
    stations = [xa_body, -5.35, -2.65, 2.65, 5.35, xb_body]                 # the pods' ends
    rings = [ring_at(sec, x) for x in stations]
    is_wall = lambda i: abs(abs(sec[i][0]) - hw) < 1e-6 and abs(abs(sec[(i + 1) % len(sec)][0]) - hw) < 1e-6
    m.loft(rings, ['dark' if (sec[i][1] < 0.96 and sec[(i + 1) % len(sec)][1] < 0.96) else ('roof' if sec[i][1] > 3.2 and sec[(i + 1) % len(sec)][1] > 3.2 else 'stainless') for i in range(len(sec))],
           radial_out(axis_y), skip=lambda i, k: is_wall(i))

    # B end: a short chamfered return, flat end; storm door, end windows, barriers, coupler
    bring = [(x0, y - (0.03 if y > 3.0 else 0.0), z * (1 - 0.04 / hw)) for z, y in sec]
    m.loft([bring, ring_at(sec, xa_body)], ['stainless'] * len(sec), radial_out(axis_y, -1))
    cap_slabs(m, bring, [], -1, ['stainless'])
    xe = x0 - 0.004
    m.end_rect(xe, -1, -0.42, 0.42, 1.0, 2.82, 'door')
    m.end_rect(xe - 0.002, -1, -0.27, 0.27, 1.85, 2.6, 'glass')
    for z in (-0.95, 0.95):
        m.end_rect(xe, -1, z - 0.3, z + 0.3, 1.85, 2.6, 'dark')
        m.end_rect(xe - 0.002, -1, z - 0.25, z + 0.25, 1.9, 2.55, 'glass')
    for s in (-1, 1):                                                   # between-car safety barriers
        m.box((x0 - 0.13, 1.7, s * (hw - 0.3)), (0.13, 0.5, 0.02), 'dark')
        m.box((x0 - 0.02, 2.25, s * (hw - 0.3)), (0.02, 0.05, 0.05), 'dark')
    m.box((x0 - 0.07, 1.02, 0), (0.07, 0.08, 1.2), 'dark')
    coupler(m, x0, -1)

    # A end
    if series == 5000:
        fring = [(x1, y if y < 3.0 else y - 0.03, z * (1 - 0.05 / hw)) for z, y in sec]
        m.loft([ring_at(sec, xb_body), fring], ['stainless'] * len(sec), radial_out(axis_y, 1))
        cap_slabs(m, fring, [], 1, ['stainless'])
        xe = x1 + 0.004
        m.end_rect(xe, 1, -1.25, 1.25, 1.68, 2.86, 'dark')                          # the black glazing panel
        m.end_rect(xe + 0.002, 1, -0.4, 0.4, 1.0, 2.86, 'door')                     # storm door
        m.end_rect(xe + 0.004, 1, -0.27, 0.27, 1.82, 2.62, 'glass')
        for za, zb in ((-1.18, -0.5), (0.5, 1.18)):
            m.end_rect(xe + 0.004, 1, za, zb, 1.76, 2.66, 'glass')                   # windscreens
        m.end_rect(xe + 0.002, 1, -0.62, 0.62, 2.92, 3.14, 'dark')
        m.end_rect(xe + 0.004, 1, -0.56, 0.56, 2.95, 3.11, 'sign')                  # destination sign
        m.end_rect(xe + 0.004, 1, 0.75, 1.1, 2.95, 3.08, 'sign')                    # run number
        for z in (-0.86, 0.86):
            m.end_rect(xe + 0.002, 1, z - 0.2, z + 0.2, 1.22, 1.48, 'dark')
            m.cyl((x1 + 0.03, 1.35, z - 0.07), 'x', 0.075, 0.02, 10, 'head', caps=(False, True))
            m.cyl((x1 + 0.03, 1.35, z + 0.09), 'x', 0.055, 0.02, 8, 'tail', caps=(False, True))
        for z in (-1.2, 1.2):
            m.box((x1 + 0.02, 3.02, z), (0.02, 0.05, 0.07), 'tail')                 # upper marker lamps
            m.box((x1 + 0.03, 2.0, z * 1.1), (0.03, 0.42, 0.02), 'dark')            # grab irons
    else:
        # 7000: a raked, rounded cab end under a black mask that wraps round the corners
        def nose_pt(z, y, t):
            u = t ** 1.6
            k = max(0.0, min(1.0, (y - belt) / (top - belt)))
            x = xb_body + (x1 - xb_body) * t - rake * k * u
            zz = z * (1 - 0.075 * u)
            yy = y if y < 3.0 else 3.0 + (y - 3.0) * (1 - 0.35 * u)
            return (x, yy, zz)
        ts = [0.0, 0.35, 0.65, 0.88, 1.0]
        nrings = [[nose_pt(z, y, t) for z, y in sec] for t in ts]
        mask = lambda c: 'dark' if (c.x > xb_body + 0.32 and c.y > 1.19) else ('stainless' if c.y > 0.96 else 'dark')
        m.loft(nrings, None, radial_out(axis_y, 1), role_fn=mask)
        cap_slabs(m, nrings[-1], [1.2, belt], 1, ['stainless', 'dark', 'dark'])
        # the windscreen on the raked face: x = x1 − rake·k(y)
        fx = lambda y: x1 - rake * max(0.0, min(1.0, (y - belt) / (top - belt))) + 0.006
        n_r = Vector((1, rake / (top - belt), 0)).normalized()
        for za, zb, role in ((-1.12, -0.42, 'glass'), (-0.36, 0.36, 'glass'), (0.42, 1.12, 'glass')):
            m.face([(fx(1.78), 1.78, za), (fx(1.78), 1.78, zb), (fx(2.68), 2.68, zb), (fx(2.68), 2.68, za)], role, n_r)
        m.face([(fx(2.8), 2.8, -0.62), (fx(2.8), 2.8, 0.62), (fx(3.0), 3.0, 0.62), (fx(3.0), 3.0, -0.62)], 'sign', n_r)
        m.face([(fx(2.8) + 0.001, 2.8, 0.75), (fx(2.8) + 0.001, 2.8, 1.05), (fx(2.96), 2.96, 1.05), (fx(2.96), 2.96, 0.75)], 'sign', n_r)
        xe = x1 + 0.004
        for z in (-0.92, 0.92):
            m.end_rect(xe, 1, z - 0.24, z + 0.24, 1.27, 1.45, 'roof')               # lamp clusters in the mask
            m.cyl((x1 + 0.02, 1.36, z - 0.1), 'x', 0.065, 0.02, 10, 'head', caps=(False, True))
            m.cyl((x1 + 0.02, 1.36, z + 0.1), 'x', 0.05, 0.02, 8, 'tail', caps=(False, True))
            m.box((fx(3.05) - 0.01, 3.08, z * 1.15), (0.02, 0.04, 0.08), 'tail')
    m.box((x1 + 0.08, 1.02, 0), (0.08, 0.08, 1.15), 'dark')                         # anticlimber
    for y in (0.97, 1.02, 1.07):
        m.box((x1 + 0.17, y, 0), (0.01, 0.012, 1.1), 'dark', skip=('-x',))
    coupler(m, x1, 1)

    # sides
    dw = S['doorWidth']
    doors = [-L / 4, L / 4]
    flush = series == 7000
    win = dict(depth=0.022 if flush else 0.045, mw=0.09 if flush else 0.24, mullion='dark' if flush else 'stainless', reveal='dark')
    for s in (-1, 1):
        d0a, d0b = doors[0] - dw / 2, doors[0] + dw / 2
        d1a, d1b = doors[1] - dw / 2, doors[1] + dw / 2
        bands = [(xa_body + 0.55, d0a - 0.3), (d0b + 0.3, d1a - 0.3), (d1b + 0.3, xb_body - (0.35 if series == 7000 else 0.75))]
        xs = [xa_body]
        spans = []
        for (ba, bb), door in zip(bands, [(d0a, d0b), (d1a, d1b), None]):
            spans.append((xs[-1], ba, []))
            o = dict(win, mullions=window_band(ba, bb, 1.55 if not flush else 1.9, win['mw']))
            if (ba, bb) == bands[1]:
                o['panels'] = [(bb - 0.95, bb - 0.12, 2.36, 2.5, 'sign')]                # side destination sign
            spans.append((ba, bb, [(3, 4, 'win', o)]))
            if door:
                spans.append((bb, door[0], []))
                spans.append((door[0], door[1], [(1, 5, 'door', dict(depth=0.05, reveal='stainless', sill='dark', win=(1.62, 2.5)))]))
                xs.append(door[1])
            else:
                xs.append(bb)
        spans.append((xs[-1], xb_body, []))
        if series == 5000:   # the cab's side window
            spans[-1:] = [(xs[-1], xb_body - 0.65, []), (xb_body - 0.65, xb_body - 0.1, [(3, 4, 'win', dict(win, mullions=[]))]), (xb_body - 0.1, xb_body, [])]
        side_wall(m, s, hw, CTA_LV, spans)
        if not flush:          # fluted lower panels between the doors
            for a, b in ((xa_body + 0.12, d0a - 0.06), (d0b + 0.06, d1a - 0.06), (d1b + 0.06, xb_body - 0.08)):
                flutes(m, s, hw, a, b, 1.24, 1.56, pitch=0.08)
        # rain gutter over the doors
        for da, db in ((d0a, d0b), (d1a, d1b)):
            m.box(((da + db) / 2, 2.83, s * (hw + 0.012)), (dw / 2 + 0.12, 0.018, 0.012), 'stainless', skip=('-z' if s > 0 else '+z',))

    # roof: two HVAC pods (their tops set the car's height), antennas
    for xc in (-4.0, 4.0):
        hvac_pod(m, xc, top - 0.1, S['height'], 1.35, 0.78)
    for xc in (-6.0, 0.0):
        m.box((xc, top + 0.04, 0.35), (0.12, 0.04, 0.06), 'dark', skip=('-y',))

    # underframe: a sill, equipment boxes between the trucks, air tanks
    tc = S['truckCentres'] / 2
    for s in (-1, 1):
        m.box((0, 0.9, s * (hw - 0.12)), (L / 2 - 0.3, 0.05, 0.03), 'dark', skip=('+y',))
    boxes = [(-3.6, -2.2, 0.48, 0.92, 0.25, 1.25, 'dark'), (-2.0, -0.9, 0.55, 0.92, -1.2, -0.1, 'dark'), (-0.7, 0.9, 0.42, 0.92, 0.1, 1.2, 'roof'),
             (1.1, 2.4, 0.5, 0.92, -1.25, -0.3, 'dark'), (2.6, 3.7, 0.56, 0.92, 0.2, 1.15, 'dark'), (-3.4, -2.4, 0.6, 0.92, -1.1, -0.2, 'roof')]
    underframe_boxes(m, boxes)
    m.cyl((0.0, 0.66, -0.75), 'x', 0.16, 0.8, 8, 'dark')
    for xc in (-tc, tc):
        truck(m, xc, S, 'cta', shoe=True)
    return m


# ── Metra gallery coach ───────────────────────────────────────────────────────────────────────────────────────────────
CO_LV = [1.04, 1.1, 1.28, 1.45, 1.5, 1.62, 2.42, 2.95, 3.12, 3.75, 4.0]


def metra_coach(S):
    m = M()
    L, hw = S['length'], S['width'] / 2
    x0, x1 = -L / 2, L / 2
    top = S['height'] - 0.25
    sec, _, _ = section(hw, CO_LV, 0.55, top, 1.0, eave_pts=5, roof_pts=3)
    axis_y = 2.6
    xa_body, xb_body = x0 + 0.14, x1 - 0.14
    stations = [xa_body, -10.2, -7.0, 0.0, 7.0, 10.2, xb_body]
    rings = [ring_at(sec, x) for x in stations]
    is_wall = lambda i: abs(abs(sec[i][0]) - hw) < 1e-6 and abs(abs(sec[(i + 1) % len(sec)][0]) - hw) < 1e-6
    m.loft(rings, ['dark' if (sec[i][1] < 1.01 and sec[(i + 1) % len(sec)][1] < 1.01) else ('roof' if sec[i][1] > 4.3 and sec[(i + 1) % len(sec)][1] > 4.3 else 'stainless') for i in range(len(sec))],
           radial_out(axis_y), skip=lambda i, k: is_wall(i))
    for xe, xb, d in ((x0, xa_body, -1), (x1, xb_body, 1)):
        ering = [(xe, y if y < 4.2 else y - 0.03, z * (1 - 0.05 / hw)) for z, y in sec]
        m.loft([ring_at(sec, xb), ering] if d > 0 else [ering, ring_at(sec, xb)], ['stainless'] * len(sec), radial_out(axis_y, d))
        cap_slabs(m, ering, [], d, ['stainless'])
        e = xe + d * 0.004
        # diaphragm: a rubber frame round the end door
        dz, dy0, dy1, t = 0.62, 1.08, 3.22, 0.16
        xo = xe + d * 0.2
        outer = [(xo, dy0, -dz), (xo, dy0, dz), (xo, dy1, dz), (xo, dy1, -dz)]
        inner = [(xo, dy0 + t, -dz + t), (xo, dy0 + t, dz - t), (xo, dy1 - t, dz - t), (xo, dy1 - t, -dz + t)]
        for k in range(4):
            k2 = (k + 1) % 4
            m.face([outer[k], outer[k2], inner[k2], inner[k]], 'dark', (d, 0, 0))
            ob = [(xe, p[1], p[2]) for p in outer]
            ib = [(xe, p[1], p[2]) for p in inner]
            mid = (V(outer[k]) + V(outer[k2])) / 2
            m.face([ob[k], ob[k2], outer[k2], outer[k]], 'dark', Vector((0, mid.y - 2.15, mid.z)))
            mid = (V(inner[k]) + V(inner[k2])) / 2
            m.face([ib[k], ib[k2], inner[k2], inner[k]], 'dark', Vector((0, 2.15 - mid.y, -mid.z)))
        m.end_rect(e, d, -0.42, 0.42, 1.12, 3.05, 'door')
        m.end_rect(e + d * 0.002, d, -0.27, 0.27, 2.05, 2.75, 'glass')
        for z in (-1.15, 1.15):
            m.end_rect(e, d, z - 0.28, z + 0.28, 2.1, 2.8, 'dark')
            m.end_rect(e + d * 0.002, d, z - 0.24, z + 0.24, 2.14, 2.76, 'glass')
            m.box((xe + d * 0.03, 3.35, z * 0.78), (0.03, 0.09, 0.14), 'head')         # lit only when leading (+X)
            m.box((xe + d * 0.03, 1.32, z * 1.13), (0.03, 0.07, 0.07), 'tail')
            m.box((xe + d * 0.03, 4.12, z * 1.05), (0.025, 0.05, 0.06), 'tail')
        m.end_rect(e, d, -0.62, 0.62, 3.6, 3.9, 'dark')
        m.end_rect(e + d * 0.002, d, -0.56, 0.56, 3.64, 3.86, 'sign')                 # destination sign
        m.box((xe + d * 0.08, 1.02, 0), (0.08, 0.09, 1.3), 'dark')
        coupler(m, xe, d, y=0.88)
        for z in (-1.42, 1.42):
            m.box((xe + d * 0.02, 2.4, z), (0.02, 0.7, 0.02), 'dark')                  # grab irons
    # sides: two window rows (the gallery above), a door pair at the centre, the belt, fluting
    dw = S['doorWidth']
    belt = {2: 'blue', 3: 'red'}
    o_lo = dict(depth=0.045, mw=0.26, mullion='stainless', reveal='dark')
    o_hi = dict(depth=0.04, mw=0.3, mullion='stainless', reveal='dark')
    for s in (-1, 1):
        da, db = -dw / 2, dw / 2
        spans = []
        for a, b in ((xa_body + 1.1, da - 0.9), (db + 0.9, xb_body - 1.1)):
            lo = dict(o_lo, mullions=window_band(a, b, 1.6, 0.26))
            hi = dict(o_hi, mullions=window_band(a, b, 1.6, 0.3))
            spans.append((a, b, [(5, 6, 'win', lo), (8, 9, 'win', hi)]))
        spans = [(xa_body, spans[0][0], []), spans[0], (spans[0][1], da, []), (da, db, [(1, 7, 'door', dict(depth=0.06, reveal='stainless', sill='dark', win=(1.75, 2.7)))]),
                 (db, spans[1][0], []), spans[1], (spans[1][1], xb_body, [])]
        side_wall(m, s, hw, CO_LV, spans, band_roles=belt)
        for a, b in ((xa_body + 0.1, da - 0.08), (db + 0.08, xb_body - 0.1)):
            flutes(m, s, hw, a, b, 2.48, 2.92, pitch=0.08)
            flutes(m, s, hw, a, b, 3.8, 3.96, pitch=0.08)
        m.box((0, 0.78, s * (hw - 0.25)), (dw / 2 + 0.05, 0.22, 0.2), 'dark', skip=('+y',))   # step well
    for xc in (-8.6, 8.6):
        hvac_pod(m, xc, top - 0.14, S['height'], 1.6, 0.9)
    for xc in (-4.0, 0.0, 4.0):
        m.box((xc, top + 0.03, 0), (0.3, 0.04, 0.3), 'roof', skip=('-y',))
    tc = S['truckCentres'] / 2
    for s in (-1, 1):
        m.box((0, 0.95, s * (hw - 0.14)), (L / 2 - 0.3, 0.06, 0.03), 'dark', skip=('+y',))
    boxes = [(-6.8, -4.6, 0.5, 1.0, 0.2, 1.35, 'dark'), (-4.2, -2.4, 0.55, 1.0, -1.35, -0.2, 'roof'), (2.4, 4.6, 0.5, 1.0, 0.2, 1.35, 'dark'),
             (4.8, 6.6, 0.58, 1.0, -1.3, -0.3, 'dark'), (-1.8, 1.8, 0.6, 1.0, -0.6, 0.6, 'dark')]
    underframe_boxes(m, boxes)
    for x, z in ((-3.0, 0.8), (3.4, -0.8)):
        m.cyl((x, 0.72, z), 'x', 0.2, 1.0, 8, 'dark')
    for xc in (-tc, tc):
        truck(m, xc, S, 'coach')
    return m


# ── Metra MP36PH-3C ───────────────────────────────────────────────────────────────────────────────────────────────────
def metra_loco(S):
    m = M()
    L, hw = S['length'], S['width'] / 2
    x0, x1 = -L / 2, L / 2
    deck = S['floor']
    H = S['height']
    livery = lambda u, v: 'blue' if 2.2 <= v <= 2.6 else ('red' if 2.6 < v <= 2.68 else 'body')
    # frame and deck: the sill in body silver, the walkway dark
    m.prism([(-hw, deck - 0.36), (hw, deck - 0.36), (hw, deck), (-hw, deck)], 'x', x0 + 0.3, x1 - 0.3, 'dark',
            role_fn=lambda u, v: 'body' if abs(abs(u) - hw) < 1e-6 else 'dark')
    # long hood: rounded top edges; a raised, wider radiator section at the rear
    xc0 = x1 - 4.9                                            # the cab's back wall
    hwh = 1.18

    def hood_sec(w, ht, r=0.22):
        pts = [(w, deck), (w, 2.2), (w, 2.6), (w, 2.68)]
        for k in range(4):
            t = (math.pi / 2) * k / 3
            pts.append((w - r + r * math.cos(t), ht - r + r * math.sin(t)))
        right = pts
        return right + [(-z, y) for z, y in reversed(right)]
    xr = x0 + 0.45 + 4.6
    m.prism(hood_sec(hwh, 4.3), 'x', xr, xc0, 'body', role_fn=livery)
    m.prism(hood_sec(hwh + 0.06, 4.42), 'x', x0 + 0.45, xr, 'body', role_fn=livery)
    for s in (-1, 1):
        z = s * (hwh + 0.064)
        for xa in (x0 + 0.75, x0 + 2.75):                                       # radiator grilles
            m.side_rect(s, xa, xa + 1.6, 3.1, 4.15, hwh + 0.064, 'dark')
        for xa in (x0 + 4.9, x0 + 7.4, x0 + 9.9, x0 + 12.4):                      # hood doors
            m.side_rect(s, xa, xa + 0.03, 1.8, 4.15, hwh + 0.004, 'dark')
            for y in (3.66, 3.76, 3.86, 3.96):                                     # louvres
                m.side_rect(s, xa + 0.6, xa + 1.6, y, y + 0.045, hwh + 0.004, 'dark')
    # radiator fans and dynamic-brake hatch on the roof, an exhaust stack
    for xf in (x0 + 1.55, x0 + 3.55):
        m.cyl((xf, 4.42 + 0.06, 0), 'y', 0.78, 0.06, 14, 'dark', caps=(False, True), cap_role='dark')
        m.cyl((xf, 4.42 + 0.125, 0), 'y', 0.18, 0.005, 8, 'roof', caps=(False, True))
    m.box((x0 + 8.0, 4.36, 0), (1.3, 0.06, 0.9), 'body', skip=('-y',))
    m.box((x0 + 8.0, 4.42 + 0.004, 0), (1.15, 0.004, 0.75), 'dark', skip=('-y',))
    m.box((x0 + 10.6, 4.45, 0), (0.42, 0.15, 0.24), 'dark', skip=('-y',))
    # cab: full width less the handrail line, rounded roof to the full height; windscreens, side windows, number boards
    cw = hw - 0.08
    csec = [(cw, deck), (cw, 2.2), (cw, 2.6), (cw, 2.68), (cw, 4.2)]
    for k in range(1, 4):
        t = (math.pi / 2) * k / 3
        csec.append((cw - 0.35 + 0.35 * math.cos(t), 4.2 + (H - 0.03 - 4.2) * math.sin(t)))
    csec.append((0.0, H))
    csec = csec + [(-z, y) for z, y in reversed(csec[:-1])]
    xcf = x1 - 2.0
    m.prism(csec, 'x', xc0, xcf, 'body', role_fn=livery)
    for s in (-1, 1):
        m.side_rect(s, xc0 + 0.3, xcf - 0.25, 3.25, 4.05, cw + 0.004, 'dark')
        m.side_rect(s, xc0 + 0.36, xc0 + 1.3, 3.3, 4.0, cw + 0.008, 'glass')
        m.side_rect(s, xc0 + 1.38, xcf - 0.31, 3.3, 4.0, cw + 0.008, 'glass')
    xe = xcf + 0.004
    for za, zb in ((-1.25, -0.08), (0.08, 1.25)):
        m.end_rect(xe, 1, za - 0.04, zb + 0.04, 3.22, 4.12, 'dark')
        m.end_rect(xe + 0.002, 1, za, zb, 3.27, 4.07, 'glass')
    for z in (-0.8, 0.8):
        m.end_rect(xe, 1, z - 0.36, z + 0.36, 4.26, 4.5, 'dark')
        m.end_rect(xe + 0.002, 1, z - 0.32, z + 0.32, 4.29, 4.47, 'sign')                # number boards
    m.box((xc0 + 1.2, H - 0.12, 0), (0.55, 0.12, 0.5), 'roof', skip=('-y',))            # cab A/C
    for dz in (-0.18, 0.0, 0.18):                                                        # horns
        m.cyl((xc0 + 0.35, H - 0.08, dz), 'x', 0.04, 0.12, 6, 'dark', r1=0.07, caps=(False, True))
    for z in (-0.5, 0.5):                                                                # rear number boards
        m.end_rect(x0 + 0.45 - 0.006, -1, z - 0.3, z + 0.3, 3.85, 4.05, 'sign')
    for xb_, zb_ in ((x0 + 0.9, 0.9), (xc0 - 0.6, -0.9)):                                # sand filler hatches
        m.box((xb_, 4.3 + (0.12 if xb_ < xr else 0.0), zb_), (0.18, 0.025, 0.14), 'body', skip=('-y',))
    # short nose: a chamfered top falling to the front, a door, headlamps
    nsec = [(1.1, deck), (1.1, 2.2), (1.1, 2.6), (1.1, 2.68), (1.1, 2.86), (0.95, 3.02), (0.0, 3.06)]
    nsec = nsec + [(-z, y) for z, y in reversed(nsec[:-1])]
    nfront = x1 - 0.36
    rings = [ring_at(nsec, xcf), ring_at(nsec, nfront - 0.55),
             [(nfront - (0.42 if y > 2.7 else 0.0) * ((y - 2.7) / 0.36 if y > 2.7 else 0), min(y, 2.7 + (y - 2.7) * 0.55) if y > 2.7 else y, z) for z, y in nsec]]
    m.loft(rings, None, lambda c, k: Vector((0.35 * k, c.y - 2.3, c.z)), role_fn=lambda c: livery(0, c.y))
    cap_slabs(m, rings[-1], [], 1, ['body'])
    xn = nfront + 0.004
    m.end_rect(xn, 1, -0.36, 0.36, deck + 0.05, 2.62, 'door')
    m.end_rect(xn + 0.002, 1, -0.22, 0.22, 2.0, 2.5, 'glass')
    for z in (-0.72, 0.72):
        m.end_rect(xn, 1, z - 0.16, z + 0.16, 2.24, 2.56, 'dark')
        m.cyl((nfront + 0.03, 2.4, z), 'x', 0.11, 0.03, 10, 'head', caps=(False, True))
    # pilots and snowploughs at both ends; ditch lights and tail lamps; couplers; steps
    for xe_, d in ((x1 - 0.3, 1), (x0 + 0.3, -1)):
        m.box((xe_ + d * 0.12, (deck - 0.36 + 0.55) / 2 + 0.02, 0), (0.12, (deck - 0.36 - 0.55) / 2, hw - 0.12), 'dark')
        tip, wing = xe_ + d * 0.42, xe_ + d * 0.05
        lo = [(tip, 0.12, 0.0), (wing, 0.12, 1.42), (xe_, 0.12, 1.42), (xe_, 0.12, -1.42), (wing, 0.12, -1.42)]
        hi = [(xe_ + d * 0.3, 0.62, 0.0), (xe_ + d * 0.1, 0.62, 1.42), (xe_, 0.62, 1.42), (xe_, 0.62, -1.42), (xe_ + d * 0.1, 0.62, -1.42)]
        cx = xe_ + d * 0.15
        m.loft([lo, hi], ['dark'] * 5, lambda c, k, cx=cx: Vector((c.x - cx, 0, c.z)))
        m.face(lo, 'dark', (0, -1, 0))
        m.face(hi, 'dark', (0, 1, 0))
        for z in (-1.3, 1.3):
            m.cyl((xe_ + d * 0.26, deck - 0.12, z), 'x', 0.08, 0.03, 8, 'head' if d > 0 else 'dark', caps=(d < 0, d > 0))
            m.box((xe_ + d * 0.25, deck - 0.16, z * 0.82), (0.02, 0.05, 0.05), 'tail')
        coupler(m, xe_ + d * 0.24, d, y=0.95, length=0.5)
        for z in (-1, 1):                                                       # end steps
            m.box((xe_ - d * 0.22, deck - 0.6, z * (hw - 0.3)), (0.24, 0.025, 0.2), 'dark')
            m.box((xe_ - d * 0.22, deck - 0.95, z * (hw - 0.3)), (0.24, 0.025, 0.2), 'dark')
            m.box((xe_ - d * 0.22, deck - 0.75, z * (hw - 0.08)), (0.25, 0.4, 0.015), 'dark')
    # the rear hood end: headlamp, number boards, a door
    xr_ = x0 + 0.45 - 0.004
    m.end_rect(xr_, -1, -0.5, 0.5, 3.0, 3.3, 'dark')
    for z in (-0.35, 0.35):
        m.cyl((x0 + 0.42, 3.15, z), 'x', 0.09, 0.03, 8, 'head', caps=(True, False))
    m.end_rect(xr_, -1, -0.36, 0.36, deck + 0.05, 2.85, 'dark')
    # handrails along both walkways and round the nose
    for s in (-1, 1):
        z = s * (hw - 0.06)
        rail = [(x0 + 0.5, deck + 1.0, z), (xc0 - 0.1, deck + 1.0, z)]
        m.tube(rail, 0.022, 'body', 4)
        m.tube([(x0 + 0.5, deck + 0.55, z), (xc0 - 0.1, deck + 0.55, z)], 0.018, 'body', 4)
        x = x0 + 0.5
        while x < xc0:
            m.tube([(x, deck, z), (x, deck + 1.0, z)], 0.025, 'body', 4)
            x += 2.4
        m.tube([(xcf + 0.05, deck + 1.0, z), (x1 - 0.42, deck + 1.0, z), (x1 - 0.42, deck + 1.0, s * 1.25)], 0.022, 'body', 4)
        m.tube([(x1 - 0.42, deck, z), (x1 - 0.42, deck + 1.0, z)], 0.025, 'body', 4)
        m.tube([(x0 + 0.42, deck, z), (x0 + 0.42, deck + 1.0, z), (x0 + 0.42, deck + 1.0, s * 1.25)], 0.022, 'body', 4)
    # fuel tank between the trucks, air reservoirs
    tank = [(1.32, 0.62), (1.42, 0.78), (1.42, deck - 0.4), (-1.42, deck - 0.4), (-1.42, 0.78), (-1.32, 0.62)]
    tank = [(z, y) for z, y in tank]
    m.prism(tank, 'x', -3.6, 3.6, 'dark')
    for z in (-1.0, 1.0):
        m.cyl((-4.6 if z < 0 else 4.6, deck - 0.6, z), 'x', 0.22, 0.6, 8, 'dark')
    tc = S['truckCentres'] / 2
    for xc in (-tc, tc):
        truck(m, xc, S, 'loco')
    return m


BUILDERS = {'cta5000': lambda S: cta_car(S, 5000), 'cta7000': lambda S: cta_car(S, 7000), 'metraCoach': metra_coach, 'metraLoco': metra_loco}


# ── assembly, AO, export ──────────────────────────────────────────────────────────────────────────────────────────────
def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials):
        for block in list(coll):
            coll.remove(block)


def to_object(name, m):
    bm = m.bm
    # every face was built with its own vertices: weld them per role only, so a vertex never straddles two roles
    # (one kind and one colour per vertex); crease folds steeper than 35°
    for r in range(len(ROLES)):
        vs = list({v for f in bm.faces if f.material_index == r for v in f.verts})
        if vs:
            bmesh.ops.remove_doubles(bm, verts=vs, dist=1e-5)
    for e in bm.edges:
        fs = e.link_faces
        if len(fs) != 2 or e.calc_face_angle(0.0) > math.radians(35):
            e.smooth = False
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='BEAUTY')
    bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=bm.edges)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def bake_ao(objs):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 128
    scene.cycles.device = 'CPU'
    if scene.world is None:
        scene.world = bpy.data.worlds.new('w')
    scene.world.light_settings.distance = 1.6
    # the track bed: ballast just below the rail tops, so the trucks and the undercar see it
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, -0.18))
    ground = bpy.context.active_object
    for ob in objs:
        for o in objs:
            o.hide_render = o is not ob
        attr = ob.data.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')
        ob.data.color_attributes.active_color = attr
        ob.data.attributes.active_color = attr
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    bpy.data.objects.remove(ground, do_unlink=True)
    for o in objs:
        o.hide_render = False


def finish(ob):
    """COLOR_0 = role colour × lifted occlusion; `_KIND` per vertex."""
    me = ob.data
    role_of = [None] * len(me.vertices)
    for p in me.polygons:
        for vi in p.vertices:
            role_of[vi] = ROLES[p.material_index]
    col = me.color_attributes['Color']
    kind = me.attributes.new('_KIND', 'FLOAT', 'POINT')
    for i, d in enumerate(col.data):
        r = role_of[i] or 'dark'
        ck, kk = ROLE[r]
        base = hex_lin(COLOURS[ck])
        ao = 1 - AO_LIFT * (1 - max(0.0, min(1.0, d.color[0])))
        d.color = (base[0] * ao, base[1] * ao, base[2] * ao, 1.0)
        kind.data[i].value = KIND[kk]


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def main():
    a = args()
    out = os.path.abspath(a.get('out', os.path.join(HERE, '..', 'out', 'trains.glb')))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    try:
        dims = json.load(open(TRANSIT))['rollingStock']
    except Exception:
        dims = FALLBACK
    reset()
    objs = []
    for name, build in BUILDERS.items():
        ob = to_object(name, build(dims[name]))
        objs.append(ob)
    bake_ao(objs)
    for ob in objs:
        finish(ob)
        bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        print(f'{ob.name}: {tris(ob)} tris, x {min(p.x for p in bb):.3f}…{max(p.x for p in bb):.3f}, '
              f'z(right) {-max(p.y for p in bb):.3f}…{-min(p.y for p in bb):.3f}, y(up) {min(p.z for p in bb):.3f}…{max(p.z for p in bb):.3f}')
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                              export_texcoords=False, export_normals=True, export_materials='NONE', export_attributes=True,
                              export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True)
    print('exported', out)


main()

# pipeline/heroes/scripts/_shapes.py — primitives shared by the hero figure scripts (Blender 5.2, metres, +Z up).
import math

import bmesh
import bpy


def lathe(name, profile, sides=48, flutes=0, flute_depth=0.0):
    """Surface of revolution from (radius, z) pairs; `flutes` vertical pleats cut into the radius (the Deco robe)."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            rr = r * (1 - flute_depth * (0.5 + 0.5 * math.cos(flutes * a))) if flutes and r > 0 else r
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            bm.faces.new((rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def limb(name, a, b, r):
    """A tapered cylinder between two points."""
    ax, ay, az = a
    bx, by, bz = b
    d = math.dist(a, b)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=r, radius2=r * 0.8, depth=d, location=((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2))
    ob = bpy.context.active_object
    ob.name = name
    dx, dy, dz = bx - ax, by - ay, bz - az
    # Euler XYZ: tilt the cone's +Z by acos(dz/d) about X (toward −Y), then swing it about Z onto (dx, dy)
    ob.rotation_euler = (math.acos(max(-1, min(1, dz / d))), 0, math.atan2(dx, -dy))
    return ob


def ellipsoid(name, at, radii, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0, location=at)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = radii
    return ob


def box(name, at, size):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=at)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    return ob


def finish(parts, height):
    """Apply transforms, stand the figure on z = 0 and scale it to exactly `height` metres."""
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    zmin = min(v.co.z for ob in parts for v in ob.data.vertices)
    zmax = max(v.co.z for ob in parts for v in ob.data.vertices)
    k = height / (zmax - zmin)
    for ob in parts:
        for v in ob.data.vertices:
            v.co.z = (v.co.z - zmin) * k
            v.co.x *= k
            v.co.y *= k


def sweep(name, path, radius, sides=12, squash=1.0):
    """A smooth tube along `path` (list of (x, y, z)); radius(t) for t in 0..1; `squash` flattens it sideways (y)."""
    from mathutils import Vector
    bm = bmesh.new()
    rings = []
    n = len(path)
    for i, p in enumerate(path):
        P = Vector(p)
        a, b = Vector(path[max(i - 1, 0)]), Vector(path[min(i + 1, n - 1)])
        t = (b - a).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        u = t.cross(up).normalized()
        v = u.cross(t).normalized()
        r = radius(i / (n - 1))
        rings.append([bm.verts.new(P + (u * math.cos(2 * math.pi * k / sides) * squash + v * math.sin(2 * math.pi * k / sides)) * r) for k in range(sides)])
    for j in range(n - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            bm.faces.new((rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob

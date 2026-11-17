# pipeline/heroes/scripts/train_preview.py — render a trains.glb by eye (after boat_preview.py): Eevee, a key and a fill
# sun, ballast and two rails under the car, every model drawn as the app draws it — base colour = COLOR_0 (the kind's
# colour × baked occlusion), roughness and metalness picked by `_KIND` (app/src/transit/trainMaterial.js), the
# destination signs in a line colour. Writes <prefix>_<model>_{front3q,side,end,rear3q,truck}.png.
# Run: blender -b --factory-startup -P pipeline/heroes/scripts/train_preview.py -- --in heroes/out/trains.glb --out /tmp/new
#      [--only cta5000] [--size 1000]
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from _export import args  # noqa: E402

a = args()
src, prefix, size = os.path.abspath(a['in']), os.path.abspath(a['out']), int(a.get('size', 1000))
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=src)
models = {o.name.split('.')[0]: o for o in bpy.data.objects if o.type == 'MESH'}
TRUCK = {'cta5000': 10.06, 'cta7000': 10.06, 'metraCoach': 18.14, 'metraLoco': 12.8}


def train_material():
    m = bpy.data.materials.new('train')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Color'
    nt.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    kind = nt.nodes.new('ShaderNodeAttribute')
    kind.attribute_name = '_KIND'

    def eq(v):
        c = nt.nodes.new('ShaderNodeMath')
        c.operation = 'COMPARE'
        c.inputs[1].default_value = v
        c.inputs[2].default_value = 0.4
        nt.links.new(kind.outputs['Fac'], c.inputs[0])
        return c.outputs[0]

    def lin(terms, base):
        out = None
        acc = nt.nodes.new('ShaderNodeValue')
        acc.outputs[0].default_value = base
        out = acc.outputs[0]
        for sock, w in terms:
            mul = nt.nodes.new('ShaderNodeMath')
            mul.operation = 'MULTIPLY_ADD'
            nt.links.new(sock, mul.inputs[0])
            mul.inputs[1].default_value = w
            nt.links.new(out, mul.inputs[2])
            out = mul.outputs[0]
        return out
    s, g, l, sg, hd = eq(9), eq(7), eq(13), eq(6), eq(11)
    nt.links.new(lin([(s, 0.32 - 0.5), (g, 0.08 - 0.5), (l, 0.45 - 0.5)], 0.5), bsdf.inputs['Roughness'])
    nt.links.new(lin([(s, 0.85 - 0.3), (g, -0.3)], 0.3), bsdf.inputs['Metallic'])
    # signs glow in a line colour (the Red Line's), headlamps a little
    em = nt.nodes.new('ShaderNodeMix')
    em.data_type = 'RGBA'
    em.inputs['Factor'].default_value = 1.0
    nt.links.new(sg, em.inputs['Factor'])
    em.inputs[6].default_value = (0, 0, 0, 1)
    em.inputs[7].default_value = (0.78, 0.02, 0.05, 1)
    nt.links.new(em.outputs[2], bsdf.inputs['Emission Color'])
    nt.links.new(lin([(sg, 0.8), (hd, 0.0)], 0.0), bsdf.inputs['Emission Strength'])
    return m


mat = train_material()
for o in models.values():
    o.data.materials.clear()
    o.data.materials.append(mat)

scene = bpy.context.scene
engines = [i.identifier for i in scene.render.bl_rna.properties['engine'].enum_items]
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else engines[0])
scene.render.resolution_x = size
scene.render.resolution_y = int(size * 0.56)
world = bpy.data.worlds.new('sky')
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (0.45, 0.55, 0.7, 1)
bg.inputs['Strength'].default_value = 0.8
scene.world = world
scene.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in scene.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'


def plain(name, rgb, rough=0.9, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


def slab(name, loc, dims, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = dims
    ob.data.materials.append(m)
    return ob


slab('ballast', (0, 0, -0.45), (120, 8, 0.3), plain('ballast', (0.16, 0.15, 0.14)))
rail = plain('rail', (0.35, 0.33, 0.31), 0.35, 0.8)
for y in (-0.7175, 0.7175):
    slab(f'rail{y}', (0, y, -0.08), (120, 0.07, 0.16), rail)
for x in range(-60, 61):
    slab(f'tie{x}', (x * 0.6, 0, -0.22), (0.22, 2.6, 0.14), plain('tie', (0.12, 0.1, 0.08)))


def light(name, energy, rot):
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = energy
    data.angle = math.radians(2)
    ob = bpy.data.objects.new(name, data)
    ob.rotation_euler = rot
    scene.collection.objects.link(ob)


light('key', 4.0, (math.radians(50), math.radians(8), math.radians(-35)))
light('fill', 1.0, (math.radians(65), math.radians(-15), math.radians(150)))

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.lens = 50
cam.data.clip_start = 0.05
scene.collection.objects.link(cam)
scene.camera = cam


def shoot(path, target, eye):
    cam.location = Vector(eye)
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# app frame: +X the cab end, +Y up, +Z right → Blender (x, −z, y): the right side faces −Y
only = a.get('only')
for name, ob in models.items():
    if only and name not in only.split(','):
        continue
    for o in models.values():
        o.hide_render = o is not ob
    L = ob.dimensions.x
    H = ob.dimensions.z
    c = Vector((0, 0, H / 2))
    d = L * 0.95
    base = f'{prefix}_{name}'
    shoot(f'{base}_front3q.png', c + Vector((L * 0.1, 0, -H * 0.1)), (L * 0.95, -L * 0.8, H * 1.15))
    shoot(f'{base}_side.png', c, (0, -L * 1.7, H * 0.55))
    shoot(f'{base}_end.png', (L / 2, 0, H * 0.5), (L / 2 + 8.5, -2.2, H * 0.7))
    shoot(f'{base}_rear3q.png', c + Vector((-L * 0.1, 0, -H * 0.1)), (-L * 0.95, L * 0.8, H * 1.6))
    xt = TRUCK.get(name, 10) / 2
    shoot(f'{base}_truck.png', (xt, -1.0, 0.75), (xt + 1.4, -5.2, 1.25))

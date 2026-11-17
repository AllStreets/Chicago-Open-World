# pipeline/heroes/scripts/vehicle_preview.py — render a vehicles.py export by eye (after boat_preview.py): Eevee, a key
# and a fill sun, an asphalt floor at z = 0, the role materials with the baked occlusion (COLOR_0) multiplied in, the
# lamps and signs lit. Writes <prefix>_front3q.png, _side.png, _rear3q.png, _top3q.png, _lod1.png, _lod1side.png and,
# with Pillow absent, nothing more (the contact sheet is made by the caller).
# Run: blender -b --factory-startup -P pipeline/heroes/scripts/vehicle_preview.py -- --in heroes/out/vehicles/sedan.glb --out /tmp/sedan
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from _export import args  # noqa: E402

a = args()
src, prefix, size = os.path.abspath(a['in']), os.path.abspath(a['out']), int(a.get('size', 900))
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.data.objects if o.type == 'MESH']
lod = {o.name.split('.')[0]: o for o in objs}
GLOW = {'head': 1.5, 'tail': 0.6, 'sign': 1.2, 'amber': 0.4}

for m in bpy.data.materials:
    if not m.node_tree:
        continue
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf or bsdf.inputs['Base Color'].is_linked:
        continue
    col = tuple(bsdf.inputs['Base Color'].default_value)
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Color'
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[6].default_value = col
    nt.links.new(attr.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    role = m.name.split('.')[0]
    if role in GLOW:
        bsdf.inputs['Emission Color'].default_value = col
        bsdf.inputs['Emission Strength'].default_value = GLOW[role]

main = lod.get('lod0', objs[0])
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for c in main.bound_box:
    w = main.matrix_world @ Vector(c)
    lo = Vector(map(min, lo, w))
    hi = Vector(map(max, hi, w))
centre = (lo + hi) / 2
extent = max((hi - lo).length, 0.5)

scene = bpy.context.scene
engines = [i.identifier for i in scene.render.bl_rna.properties['engine'].enum_items]
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else engines[0])
scene.render.resolution_x = size
scene.render.resolution_y = int(size * 0.62)
world = bpy.data.worlds.new('studio')
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (0.55, 0.6, 0.68, 1)
bg.inputs['Strength'].default_value = 0.9
scene.world = world
scene.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in scene.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'

bpy.ops.mesh.primitive_plane_add(size=extent * 14, location=(centre.x, centre.y, 0.0))
floor = bpy.context.active_object
fm = bpy.data.materials.new('asphalt')
fm.use_nodes = True
b = next(n for n in fm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
b.inputs['Base Color'].default_value = (0.09, 0.09, 0.095, 1)
b.inputs['Roughness'].default_value = 0.8
floor.data.materials.append(fm)


def light(name, energy, rot):
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = energy
    ob = bpy.data.objects.new(name, data)
    ob.rotation_euler = rot
    scene.collection.objects.link(ob)


light('key', 4.0, (math.radians(40), math.radians(10), math.radians(35)))
light('fill', 1.3, (math.radians(60), math.radians(-20), math.radians(-140)))

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.lens = 50
scene.collection.objects.link(cam)
scene.camera = cam


def shoot(tag, direction, dist=1.15, look=None):
    d = Vector(direction).normalized()
    tgt = Vector(look) if look else centre
    cam.location = tgt + d * extent * dist
    cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{prefix}_{tag}.png'
    bpy.ops.render.render(write_still=True)


# glTF import keeps the front at +X and the left at +Y
for o in objs:
    o.hide_render = o is not main
shoot('front3q', (1.0, 0.75, 0.32))
shoot('side', (0.0, -1.0, 0.08), dist=1.6)
shoot('rear3q', (-1.0, -0.8, 0.38))
shoot('top3q', (0.55, -0.85, 0.9))
shoot('front', (1.0, 0.0, 0.12), dist=0.9)
if 'lod1' in lod:
    for o in objs:
        o.hide_render = o is not lod['lod1']
    shoot('lod1', (1.0, 0.75, 0.32))
    shoot('lod1side', (0.0, -1.0, 0.08), dist=1.6)

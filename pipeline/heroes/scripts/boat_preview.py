# pipeline/heroes/scripts/boat_preview.py — F-9: render a boats.py export by eye (after the F1 Pixel Cup preview.py):
# Eevee, a key and a fill sun, a water-coloured floor at the waterline, the model's role materials with its baked
# occlusion (COLOR_0) multiplied in. Writes <prefix>_top3q.png, _side.png, _front.png, _rear.png and _lod1.png.
# Run: blender -b --factory-startup -P pipeline/heroes/scripts/boat_preview.py -- --in heroes/out/boats/tourboat.glb --out /tmp/tourboat
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

# multiply the baked occlusion into every material
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
bg.inputs['Color'].default_value = (0.42, 0.5, 0.62, 1)
bg.inputs['Strength'].default_value = 0.9
scene.world = world
scene.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in scene.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'

bpy.ops.mesh.primitive_plane_add(size=extent * 14, location=(centre.x, centre.y, 0.0))
floor = bpy.context.active_object
fm = bpy.data.materials.new('water')
fm.use_nodes = True
b = next(n for n in fm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
b.inputs['Base Color'].default_value = (0.05, 0.1, 0.09, 1)
b.inputs['Roughness'].default_value = 0.25
floor.data.materials.append(fm)


def light(name, loc, energy, rot):
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = energy
    ob = bpy.data.objects.new(name, data)
    ob.location = loc
    ob.rotation_euler = rot
    scene.collection.objects.link(ob)


light('key', (0, 0, 10), 4.0, (math.radians(40), math.radians(10), math.radians(35)))
light('fill', (0, 0, 10), 1.2, (math.radians(60), math.radians(-20), math.radians(-140)))

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.lens = 50
scene.collection.objects.link(cam)
scene.camera = cam


def shoot(tag, direction, up=0.0, dist=1.25):
    d = Vector(direction).normalized()
    cam.location = centre + d * extent * dist + Vector((0, 0, up * extent))
    cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{prefix}_{tag}.png'
    bpy.ops.render.render(write_still=True)


# glTF import: the model's bow (+X in boats.py) stays +X; port (+Y) stays +Y
for o in objs:
    o.hide_render = o is not main
shoot('top3q', (1.0, 0.9, 0.55))
shoot('side', (0.0, -1.0, 0.1))
shoot('front', (1.0, -0.15, 0.15))
shoot('rear', (-1.0, 0.45, 0.35))
shoot('water', (0.7, -1.0, 0.04), dist=1.0)
if 'lod1' in lod:
    for o in objs:
        o.hide_render = o is not lod['lod1']
    shoot('lod1', (1.0, 0.9, 0.55))

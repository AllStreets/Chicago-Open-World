# pipeline/heroes/scripts/site_preview.py — render a hero site (pipeline/build/preview-site.js writes the glb, vertex
# colours = its material rows) from four sides, after the F1 Pixel Cup review loop (tools/blender/preview.py): EEVEE,
# a sun and a sky fill, the model's own colours with soft shadows and ambient occlusion.
#   blender -b --factory-startup -P site_preview.py -- site.glb out_prefix [size]
# Writes out_prefix_se.png, _sw.png, _nw.png (three-quarter views, compass corners; −Z in the city is north) and
# _close.png (a low eye-level look at the south face).
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, prefix = argv[0], argv[1]
size = int(argv[2]) if len(argv) > 2 else 900

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.data.objects if o.type == 'MESH']
mat = bpy.data.materials.new('vc')
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
attr = nt.nodes.new('ShaderNodeVertexColor')
nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.75
for o in objs:
    o.data.materials.clear()
    o.data.materials.append(mat)
    # site glbs are not smooth: keep flat shading (the city draws faceted geometry)
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w))
        hi = Vector(map(max, hi, w))
# frame the building, not its ground plate: the plate is 25 m wider each side
centre = (lo + hi) / 2
centre.z = lo.z + (hi.z - lo.z) * 0.3
extent = float(argv[3]) if len(argv) > 3 else max((hi - lo).length - 70, 8)

scene = bpy.context.scene
engines = [i.identifier for i in scene.render.bl_rna.properties['engine'].enum_items]
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else engines[0])
scene.render.resolution_x = size
scene.render.resolution_y = int(size * 0.62)
world = bpy.data.worlds.new('sky')
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (0.62, 0.72, 0.85, 1)
bg.inputs['Strength'].default_value = 0.9
scene.world = world
try:
    scene.view_settings.view_transform = 'AgX'
except TypeError:
    pass


def light(name, kind, energy, rot):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.angle = math.radians(2.0)
    ob = bpy.data.objects.new(name, data)
    ob.rotation_euler = rot
    scene.collection.objects.link(ob)


light('sun', 'SUN', 4.2, (math.radians(42), math.radians(8), math.radians(150)))  # a southern afternoon sun

cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 40
cam_data.clip_end = 5000
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def shoot(tag, direction, dist=1.25, lens=40):
    cam_data.lens = lens
    d = Vector(direction).normalized()
    cam.location = centre + d * extent * dist
    cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{prefix}_{tag}.png'
    bpy.ops.render.render(write_still=True)


# glTF +Z (south in the city) imports as Blender −Y: south is −Y, east +X
shoot('se', (1.0, -1.0, 0.75))
shoot('sw', (-1.0, -1.0, 0.75))
shoot('nw', (-1.0, 1.0, 0.75))
shoot('close', (0.25, -1.0, 0.12), dist=0.85, lens=32)

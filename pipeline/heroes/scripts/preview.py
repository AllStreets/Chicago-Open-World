# pipeline/heroes/scripts/preview.py — a quick look at an export before it goes into the city: imports the .glb and
# renders it with the Workbench engine from the front and the three-quarter view, side by side.
# Run: blender -b -P pipeline/heroes/scripts/preview.py -- --in heroes/out/ceres.glb --out /tmp/ceres.png
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from _export import args, clear_scene  # noqa: E402


def main():
    a = args()
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(a['in']))
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre, size = (lo + hi) / 2, max(hi - lo)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'SINGLE'
    scene.display.shading.single_color = (0.75, 0.72, 0.66)
    scene.display.shading.show_cavity = True
    scene.render.resolution_x, scene.render.resolution_y = 512, 640
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    out = os.path.abspath(a['out'])
    for i, yaw in enumerate([0.0, 0.8]):
        d = size * 2.1
        # glTF +Z (south) imports as Blender −Y; the figures face north = Blender +Y, so look at them from +Y
        cam.location = centre + Vector((math.sin(yaw) * d, math.cos(yaw) * d, size * 0.15))
        cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = out.replace('.png', f'-{i}.png')
        bpy.ops.render.render(write_still=True)


main()

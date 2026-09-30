# pipeline/heroes/scripts/_export.py — shared helpers for the headless hero scripts (Blender 5.2, `blender -b -P`).
# Every script builds its object(s) in metres around the origin (+Z up in Blender), then calls export_glb, which
# applies transforms, triangulates, decimates to the triangle budget and writes a .glb with +Y up.
# The pipeline never needs Blender: a missing export falls back to a procedural stand-in (lib/statues.js).
import sys
import bpy


def args():
    """Arguments after `--`, e.g. `blender -b -P ceres.py -- --out heroes/out/ceres.glb` → {'out': ...}."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = {}
    for i in range(0, len(argv) - 1, 2):
        out[argv[i].lstrip('-')] = argv[i + 1]
    return out


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            block.remove(item)


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def export_glb(obj_names, out_path, max_tris):
    objs = [bpy.data.objects[n] for n in obj_names]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    tri = obj.modifiers.new('tri', 'TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=tri.name)
    n = tri_count(obj)
    if n > max_tris:
        dec = obj.modifiers.new('dec', 'DECIMATE')
        dec.ratio = max_tris / n * 0.98
        bpy.ops.object.modifier_apply(modifier=dec.name)
    bpy.ops.object.shade_smooth()
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_materials='NONE', export_texcoords=True, export_normals=True)
    print(f'export_glb: {out_path} tris={tri_count(obj)}')

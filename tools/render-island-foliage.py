"""Blender source-silhouette render. Run with --background --threads 8.

Uses the already converted, user-supplied Lightkeeper canopy. This reference
pass is local evidence; paint-island-foliage.py creates the public textures.
"""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'prototype/island/.playtest/foliage-reference'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'prototype/island/assets/lightkeeper-bushy.glb'))
material = bpy.data.materials.new('Canopy silhouette')
material.use_nodes = True
material.node_tree.nodes.clear()
emission = material.node_tree.nodes.new('ShaderNodeEmission')
emission.inputs['Color'].default_value = (1, 1, 1, 1)
output = material.node_tree.nodes.new('ShaderNodeOutputMaterial')
material.node_tree.links.new(emission.outputs[0], output.inputs[0])
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    obj.hide_render = 'trunk' in obj.name.lower()
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
bpy.ops.object.camera_add(location=(0, 0, 3))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .6)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.26
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 8
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = str(OUT / 'lightkeeper-canopy-top.png')
bpy.ops.render.render(write_still=True)

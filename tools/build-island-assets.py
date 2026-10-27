"""Run with Blender --background --threads 8 --python tools/build-island-assets.py.

Build the original portfolio character and convert supplied Lightkeeper trees.
The reference game's extracted meshes stay in ignored local evidence only.
"""
import bpy
import math
import json
import struct
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'prototype/island/assets'
EVIDENCE = ROOT / 'prototype/island/.playtest'
SOURCE = Path('F:/GameProject/Archive/Lightkeeper/Assets/Content/Meshes/Lightkeeper/Import')
OUT.mkdir(exist_ok=True, parents=True)
EVIDENCE.mkdir(exist_ok=True, parents=True)

def rgba(value):
    rgb = [int(value[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c < .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb) + (1,)

def unlit(name, color, vertex=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba(color)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = rgba(color)
    mat.node_tree.links.new(emission.outputs[0], output.inputs[0])
    if vertex:
        attr = nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
        mat.node_tree.links.new(attr.outputs['Color'], emission.inputs['Color'])
    return mat

def empty(name, location, parent=None):
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o)
    o.location = location
    bpy.context.view_layer.update()
    if parent:
        world = o.matrix_world.copy(); o.parent = parent; o.matrix_world = world
    return o

def attach(o, name, mat, parent=None):
    o.name = name; o.data.materials.clear(); o.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for face in o.data.polygons: face.use_smooth = True
    if parent:
        bpy.context.view_layer.update()
        world = o.matrix_world.copy(); o.parent = parent; o.matrix_world = world
    return o

def sphere(name, location, scale, mat, parent=None, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    o = bpy.context.object; o.scale = scale
    return attach(o, name, mat, parent)

def cube(name, location, scale, mat, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    o = bpy.context.object; o.scale = scale
    return attach(o, name, mat, parent)

def camera_render(path, target=(0, 0, 1), location=(4, -7, 3), scale=3.1, width=700, height=700):
    bpy.ops.object.camera_add(location=location)
    camera = bpy.context.object; camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'; camera.data.ortho_scale = scale
    scene = bpy.context.scene; scene.camera = camera
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 8
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 8
    scene.view_settings.view_transform = 'Standard'
    scene.render.resolution_x = width; scene.render.resolution_y = height; scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Preview backdrop'); scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = rgba('#b8cfbd')
    scene.render.filepath = str(path); bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)

def export(path):
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', export_materials='EXPORT', export_yup=True, export_animations=False, export_cameras=False, export_lights=False)
    # Blender's emission export uses emissive PBR. Declare true glTF unlit so
    # the browser preserves the exact palette without any lighting or bloom.
    data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0]
    document=json.loads(data[20:20+length])
    for mesh in document.get('meshes',[]):
        for primitive in mesh['primitives']:
            attributes=primitive['attributes']
            colors=sorted(key for key in attributes if key.startswith('COLOR_'))
            # Blender 5 emits a white compatibility COLOR_0 before the
            # actual emission-color layer. Keep the authored color channel.
            if colors:attributes['COLOR_0']=attributes[colors[-1]]
            primitive['attributes']={key:value for key,value in attributes.items() if key in ['POSITION','COLOR_0']}
    for material in document.get('materials',[]):
        color=material.pop('emissiveFactor',[1,1,1])
        material.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[*color,1]
        material.setdefault('extensions',{})['KHR_materials_unlit']={}
    document.setdefault('extensionsUsed',[]).append('KHR_materials_unlit')
    raw=data[28+length:]
    used=set()
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            used.update(primitive['attributes'].values());used.add(primitive['indices'])
    accessor_map={old:new for new,old in enumerate(sorted(used))}
    accessors=[document['accessors'][old] for old in sorted(used)]
    views=[];view_map={};packed=bytearray()
    for accessor in accessors:
        old=accessor['bufferView']
        if old not in view_map:
            view=document['bufferViews'][old].copy();start=view.get('byteOffset',0)
            while len(packed)%4:packed.append(0)
            view['byteOffset']=len(packed);packed.extend(raw[start:start+view['byteLength']]);view_map[old]=len(views);views.append(view)
        accessor['bufferView']=view_map[old]
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            primitive['attributes']={k:accessor_map[v] for k,v in primitive['attributes'].items()};primitive['indices']=accessor_map[primitive['indices']]
    document['accessors']=accessors;document['bufferViews']=views;document['buffers']=[{'byteLength':len(packed)}]
    while len(packed)%4:packed.append(0)
    encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    rest=struct.pack('<II',len(packed),0x004e4942)+packed;body=struct.pack('<II',len(encoded),0x4e4f534a)+encoded+rest
    path.write_bytes(struct.pack('<III',0x46546c67,2,12+len(body))+body)

bpy.ops.wm.read_factory_settings(use_empty=True)
navy = unlit('Dusk plum', '#414057')
shirt = unlit('Clay orange tunic', '#ce7050')
hem = unlit('Tunic hem', '#b95644')
white = unlit('Eye white', '#fff5dc')
pupil = unlit('Ink eyes', '#242d49')
gold = unlit('Warm beak', '#efc34d')
mint = unlit('Sage satchel', '#8eb69b')
body = empty('body_pivot', (0, 0, .65))
head = empty('head_pivot', (0, -.02, 1.49), body)
sphere('Round head', (0, -.02, 1.49), (.48, .43, .46), navy, head)
# The eye surfaces are shallow ellipsoids, not protruding cartoon eyeballs.
for side in [-1, 1]:
    eye = sphere('Eye white '+str(side), (side*.33, -.337, 1.49), (.19,.038,.235), white, head)
    eye.rotation_euler.z = side * .6
    dot = sphere('Eye pupil '+str(side), (side*.347,-.372,1.49), (.115,.028,.158), pupil, head)
    dot.rotation_euler.z = side*.6
# A short, smooth wedge retains the simple side-profile silhouette.
verts=[(-.16,-.345,1.32),(.16,-.345,1.32),(-.13,-.36,1.19),(.13,-.36,1.19),(0,-.66,1.24)]
faces=[(0,1,4),(1,3,4),(3,2,4),(2,0,4),(0,2,3,1)]
data=bpy.data.meshes.new('Beak wedge');data.from_pydata(verts,[],faces);data.update()
beak=bpy.data.objects.new('Beak',data);bpy.context.collection.objects.link(beak);beak.data.materials.append(gold)
world=beak.matrix_world.copy();beak.parent=head;beak.matrix_world=world
# Narrow tunic and thin legs: no belly patch, scarf, or bulky feet.
bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.31,radius2=.225,depth=.72,location=(0,.015,.8))
attach(bpy.context.object,'Tunic',shirt,body)
bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.313,radius2=.305,depth=.065,location=(0,.015,.468))
attach(bpy.context.object,'Tunic lower edge',hem,body)
for side,name in [(-1,'left_wing'),(1,'right_wing')]:
    pivot=empty(name,(side*.25,.02,1.01),body)
    wing=sphere('Sleeve '+name,(side*.32,.025,.86),(.11,.12,.25),shirt,pivot,16,10)
    wing.rotation_euler.y=side*-.17
    sphere('Wingtip '+name,(side*.34,.018,.66),(.074,.09,.105),navy,pivot,12,8)
for side,name in [(-1,'left_foot'),(1,'right_foot')]:
    foot=empty(name,(side*.145,0,.10))
    sphere('Foot '+name,(side*.145,-.05,.075),(.065,.14,.055),navy,foot,12,8)
    side_name='left' if side<0 else 'right'
    empty(side_name+'_hip',(side*.145,.01,.48),body)
    for part,a,b in [
        ('thigh',Vector((side*.145,.01,.48)),Vector((side*.145,-.07,.285))),
        ('shin',Vector((side*.145,-.07,.285)),Vector((side*.145,0,.10))),
    ]:
        direction=b-a
        bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.032,depth=1,location=(a+b)/2)
        segment=bpy.context.object;segment.scale.z=direction.length;segment.rotation_euler=direction.to_track_quat('Z','Y').to_euler()
        attach(segment,side_name+'_'+part,navy)
sphere('Tail',(0,.28,.53),(.12,.19,.07),navy,body,12,8)
satchel=sphere('Small satchel',(.26,.17,.76),(.15,.16,.22),mint,body,16,10)
strap=cube('Satchel strap',(.12,-.219,.85),(.045,.025,.57),mint,body);strap.rotation_euler.y=-.3
export(OUT/'character.glb')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'character.blend'))
camera_render(EVIDENCE/'character-v3.png')
print('CHARACTER_EXPORTED', (OUT/'character.glb').stat().st_size, flush=True)

for filename,output,palette in [
    ('Tree.fbx','lightkeeper-tree.glb',['#527b62','#638c69','#7e9b70']),
    ('BigBushyTree.fbx','lightkeeper-bushy.glb',['#bf7047','#d48750','#e6a05d']),
]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(SOURCE/filename))
    objects=[o for o in bpy.data.objects if o.type=='MESH']
    points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    dimensions=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
    correction=Matrix.Rotation(math.pi/2,4,'X') if dimensions[1]>dimensions[2]*1.4 else Matrix.Identity(4)
    positions=[correction@p for p in points]
    low=min(p.z for p in positions); height=max(p.z for p in positions)-low
    cx=(min(p.x for p in positions)+max(p.x for p in positions))/2
    cy=(min(p.y for p in positions)+max(p.y for p in positions))/2
    groups={'canopy':[],'trunk':[]}
    for o in objects:
        transform=correction@o.matrix_world
        coords=[transform@v.co for v in o.data.vertices]
        o.parent=None;o.matrix_world=Matrix.Identity(4)
        for v,p in zip(o.data.vertices,coords):v.co=((p.x-cx)/height,(p.y-cy)/height,(p.z-low)/height)
        o.data.update()
        groups['trunk' if 'trunk' in o.name.lower() else 'canopy'].append(o)
    for kind,items in groups.items():
        if not items:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:o.select_set(True)
        bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();o=bpy.context.object;o.name=kind
        if kind=='canopy':
            dec=o.modifiers.new('Canopy simplification','DECIMATE');dec.ratio=.34;bpy.ops.object.modifier_apply(modifier=dec.name)
        o.data.materials.clear();o.data.materials.append(unlit(kind,'#ffffff',True))
        for attribute in list(o.data.color_attributes):o.data.color_attributes.remove(attribute)
        layer=o.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
        o.data.color_attributes.active_color=layer
        for poly in o.data.polygons:
            if kind=='trunk':color=rgba('#7e7161' if poly.normal.z>.1 else '#5b6254')
            else:
                light=poly.normal.dot(Vector((-.45,-.35,.8)))
                color=rgba(palette[2 if light>.45 else 1 if light>-.3 else 0])
            for index in poly.loop_indices:layer.data[index].color=color
            poly.material_index=0
            poly.use_smooth=False
    for o in list(bpy.data.objects):
        if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
    export(OUT/output)
    camera_render(EVIDENCE/(output+'.png'),target=(0,0,.5),location=(2,-4,2),scale=1.5,width=600,height=700)
    print('TREE_EXPORTED',filename,(OUT/output).stat().st_size,flush=True)

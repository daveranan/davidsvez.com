# Authored model sources

`character.blend` is the editable original character, authored for this portfolio
in Blender by `tools/build-island-assets.py`. `character.glb` contains its compact
unlit mesh and named head/body/hip/leg/foot nodes. The alternate plum/orange/sage
character uses the supplied Short Hike reference for proportion and simplicity;
it does not contain the reference game's extracted geometry or textures.

`lightkeeper-tree.glb` derives from:
`F:/GameProject/Archive/Lightkeeper/Assets/Content/Meshes/Lightkeeper/Import/Tree.fbx`.

`lightkeeper-bushy.glb` derives from:
`F:/GameProject/Archive/Lightkeeper/Assets/Content/Meshes/Lightkeeper/Import/BigBushyTree.fbx`.

Both tree exports are normalized, simplified, and recolored for this requested
local prototype. Their authored palette vertex-color channel is retained as
COLOR_0 and declared unlit. Additional color channels, normals, and unused data
are removed from the web assets. The original source projects are untouched.

The outer forest is generated in `../looklab.js` from the user-supplied LookLab
project's procedural geometry and fog equations, rather than from these GLBs.

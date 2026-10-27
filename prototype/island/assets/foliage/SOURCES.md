# Painted foliage

The public canopy textures are original artwork derived from a top-down
silhouette render of the user-supplied Lightkeeper `BigBushyTree` canopy.
The jagged source outline is simplified into a smooth low-frequency contour;
large painted color shapes replace the individual source leaf polygons.
Trunk and branch geometry continues to come from the converted Lightkeeper
models. Grass tuft and sprig textures are original procedural drawings.

For construction reference, the local A Short Hike assets were inspected:
`UpwardTreeLeaves` uses `PineLeaves2` (256×256), and `UpwardTreeLeaves 1` uses
`TreeTop` (128×128). Its `Tree` mesh contains 117 vertices with a separate
eight-triangle canopy submesh and upward-facing normals. Those game textures,
meshes, and extracted code are not included in this asset folder.

Rebuild the source silhouette with Blender:

```powershell
blender --background --threads 8 --python tools/render-island-foliage.py
python tools/paint-island-foliage.py
```

On this Windows workstation, bind the Blender process and descendants to the
same set of at most eight logical CPUs as required by the repository rules.
Source inspection and render evidence live only in the ignored `.playtest/`
directory. Rendering and painting are deterministic.

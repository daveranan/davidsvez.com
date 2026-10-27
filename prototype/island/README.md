# Interactive portfolio prototype

Run `npm run island`, then open **http://127.0.0.1:4175/island/**.
The original entry point at `/` and its Netlify configuration remain in place.
The shared portfolio copy has been rewritten and independently reviewed.

## Experience

The native-resolution orthographic scene follows an original Blender-authored
character. The head, sleeves, hips, articulated legs, and feet have authored
pivots. Alternating world-space foot targets feed a two-bone IK solver; stance
feet stay planted while the body and shoulder line move subtly. This is an
original browser implementation informed by the supplied Short Hike references,
not copied game animation code. Extracted reference meshes/renders stay in the
ignored local evidence folder and are not part of the public assets.

Click/tap a page to approach its nearest edge from any direction and open it.
Walking behind a page routes around it without opening it. Hover adds a small
stable lift. Trees smoothly become translucent when they obscure the player or
ball. OS reduced motion is respected. The arrival camera descends through
distinct cloud shapes which leave the screen before the overlay is removed.

The clearing has a seat, a reversible campfire, a cast/bite/reel pond interaction,
and shakeable trees with square falling leaves. Walking physically pushes the
ball. The northern field has two goals and a nearby You/Dave score; Dave joins
play, goals trigger sound and confetti, and the ball resets after 2.5 seconds.
Ten coins fund a shovel and jump/glide ability, with marked dig sites and large
northern terraces. All use the primary click/tap; Space also jumps.
Dave joins football only after a ball-directed click. Goal and sideline chatter
use separate eight-variant bags, with occasional player replies. Fully crossing
the touchline resets play; goal detection runs first. Goal sound uses the supplied
party blower, and kicks use the supplied football recording with varied pitch.
Walking elsewhere exits seating or fishing. A nearby NPC gives a nonblocking
overhead greeting; a click starts the branching conversation. Dialogue and the
opt-in case guide use Lightkeeper-style mint bubbles and keyboard dismissal.

The responsive mobile scene rearranges and scales the physical pages; the normal
top navigation remains available as an accessible alternative. Content pages use
one column on narrow screens. Touch checks use an emulated 390×844 mobile device
at device scale 2; they are not a physical-device performance measurement.
Content panels are centered and capped at 1920px; HOME returns to the island.
Portrait pages occupy separated rows with walking gaps instead of overlapping.
The guide's opening uses ten calm variations, exhausted before repeats; progress
is retained across reloads in the same browser tab. The terraces have no trees
rooted on their climbable footprint.

## Separate static pages and lazy loading

Real standalone HTML routes are generated for:

- `/island/product-design/`
- `/island/technical-design/`
- `/island/resume/`
- `/island/case-studies/`
- `/island/contact/`
- `/island/blog/`
- `/island/blog/<id>/` for each of the three existing published essays.
- `/island/project/<id>/` for each public case or archive item.

Each route works on direct load and reload. Navigation uses browser history and
real links. The HTML shell and per-page JSON are separate files. The home scene
loads seven small project previews and three blog title/date records, not the
entire portfolio archive or article bodies. Cases and blog articles fetch
their own JSON. Caches retain six visited cases and four articles. Direct case entry does
not load Three.js, character/tree assets, or world metadata. The world is loaded
when returning to it and stops rendering while reading a page. Conversations
leave wind and ambient animation running. Music and ambience continue on pages;
the header audio control and hidden-tab pause apply to all audio.

Local videos load when visible, autoplay muted/inline, loop, and pause when out
of view or when the document is hidden. Controls remain available. Reduced
motion bypasses autoplay. External YouTube frames also wait until visible.

After editing shared CMS content or the island override, regenerate routes:

```powershell
npm run island:routes
```

The generator reads the existing `prototype/content` sources and the curated
`prototype/island/content/lightkeeper.json` override. It does not modify the
original content. An owned-file manifest limits stale-output cleanup to generated
route/data files within `prototype/island`. Netlify serves these real files
before its existing fallback redirect; no server application is required.

Lightkeeper is an eleven-block, proof-led case with role/status, working footage,
tools, and a short development outcome. Its walkthrough and deeper technical
archive are secondary links. Project status is shown alongside source-backed
roles and dates. The résumé combines the two supplied PDFs into six experience
entries, skills, community work, client history, and contact details, with both
original PDFs available to download. Reconciliation notes remain in the source
directory. Relevant project cases include the new source-supported details.

Contact retains the existing Netlify form name/fields. Local submissions are
explicitly not sent. The receiving address is not added to this prototype.

## Art and source provenance

- `tools/build-island-assets.py` builds `assets/character.blend` and its compact
  unlit GLB, and converts the provided Lightkeeper tree FBXs. Run it using Blender
  with `--background --threads 8 --python tools/build-island-assets.py`. On this
  workstation the executable is in Steam's Blender installation. Bind launched
  build processes to at most eight logical CPUs as required by project policy.
- Interior foliage uses instanced Lightkeeper trunks with original rounded,
  painted canopy textures on upward-facing cards. Grass uses rounded painted
  blades with coherent wind. Asset provenance is in `assets/foliage/SOURCES.md`.
- `looklab.js` ports the supplied `F:/GameProject/Godot/LookLab/diorama.gd` tree
  construction and `shaders/fade.gdshader` radial, height, and base-fog equations.
  The portfolio clearing radius is larger; the source height range (-0.15 to
  -2.6), 1.8-unit base-fog rise, sinking layers, and dark teal color are retained.
  Movement stays within the clearing, before the dark outer forest.
- `flat-style.js` supplies unlit palette rendering, distance/height fog, merged
  static scenery, instanced trees, stable contact shadows, and leaf particles.
- Floating landscape copy and the directional work sign have been removed.
- Dialogue UI/sound asset paths are documented in `assets/dialogue/SOURCES.md`.
  The dialogue is a lightweight static branching browser UI with the supplied
  game's visual/audio cues, not the Unity Yarn Spinner runtime.
- Three.js 0.160.1 and its local loader utilities retain the vendored MIT license.
- Lightkeeper menu music, ambience, footsteps, and interaction sounds are
  compressed for the browser. Exact source mappings are in
  `assets/environment/sfx/SOURCES.json`. Pond texture provenance is recorded
  alongside the environment assets.

## Verification and measured tradeoffs

With Playwright installed/available, run `npm run island:test` while the server
is running. `NODE_PATH` may point to shared Node packages; `PLAYTEST_BROWSER` may
point to installed Chrome or Edge. The test covers static reload/history, lazy
loading, video playback/pause, page approaches, hover, real content, contact's
local guard, touch, conversations, and physical actions including a real catch.
Screenshots and local reference material are in ignored `.playtest/`.

`node tools/island-profile.mjs` reproduces the fixed 1600×1000 idle-world workload
in Chromium SwiftShader: 15 warm-up frames and 60 samples. Before the redesign,
the median was 114.3 ms (p95 131.4), 393 draw calls, and a 1312×820 framebuffer.
The final measured scene was 85.8 ms (p95 102.9), 93 calls, at native 1600×1000:
about 25% lower frame time and 76% fewer calls despite 49% more pixels. The
larger terraces, authored characters, painted foliage, and two-goal field raise
triangle count from 23,420 to 103,050. These software-rendering numbers are a controlled
comparison, not a claimed frame rate for a phone or hardware GPU.

Two independent visual passes and a separate content review informed revisions.
The motion recheck sampled 65 rendered frames (31 walking): no double-swing
frames and no floating planted feet. All generated local media paths and internal
project links were audited. The clearing is still a lightweight website scene:
there is no full game navigation mesh, rigid-body engine, or general terrain
collision system.

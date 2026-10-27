# Dialogue asset provenance

All source project paths below were supplied by the user for this local prototype.

- `bubble.png`: copied unchanged from
  `F:/GameProject/Archive/Lightkeeper/Assets/Content/Textures/UI/Fishing/fishing-bg.png`.
  This is the center/name-bubble sprite referenced by
  `Assets/Content/Prefabs/UI/Widgets/UIWidget_DialogueLine.prefab` and
  `UIWidget_DialogueOptions.prefab` (GUID `bd1c700012c5040479cbd27dd1ff038f`).
  The source uses a 32px nine-slice border on a 100px image.
  The browser bubble now uses a solid CSS rounded shape and tail with the same
  palette; the stretched sprite mask introduced visible internal seams.
- `arrow.png`: copied unchanged from
  `F:/GameProject/Archive/Lightkeeper/Assets/Content/Textures/UI/ArrowDown.png`.
  It is the speech-arrow sprite in the same dialogue prefabs
  (GUID `fe08f14f4d5a5414e8a1654b8a824d7c`).
- `voice.wav`: copied unchanged from
  `F:/GameProject/Archive/Lightkeeper/Assets/Content/Audio/SFX/Dialogue/talking00000000_regions/talking00000000_02.wav`.
  One short dialogue blip, played quietly only after a visitor's explicit action.
- `voice-1.wav` through `voice-4.wav`: additional unchanged samples from the same
  Lightkeeper folder: `talking00000000_01.wav`, `talking00000005_01.wav`,
  `talking00000005_02.wav`, and `talking00000005_03.wav`. The browser selects a
  different sample every few revealed letters with speaker-specific randomized
  pitch. Revealing a line instantly cancels the remaining typewriter sounds.
- `guide.webp`: compact crop of the project's original Blender-authored character
  preview at `prototype/island/.playtest/character-v3.png`. This is an original
  portfolio character, not an extracted Lightkeeper or A Short Hike character.

The dialogue choices are curated, local content. The Lightkeeper answers use
`prototype/island/content/lightkeeper.json`; contribution claims retain the team
context and the credited role of game director, game designer, and producer.
There is no LLM or remote chat service. A nearby guide gives a brief, nonblocking
greeting; choosing to talk opens the authored branches. Pop/resize timing,
per-letter head springs, and the white single-panel response list are adapted
from the supplied dialogue clip and the project's dialogue widget source.

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { writeContentBundles } from "./content-bundles.mjs";
import { optimizedFileName } from "./media-optimizer.mjs";

const root = new URL("../", import.meta.url);
const mediaRoot = new URL("prototype/assets/media/og-library/Projects/", root);
const projectsPath = new URL("prototype/content/projects.json", root);
const mediaPath = new URL("prototype/content/media.json", root);
const assetPrefix = "assets/media/optimized/Projects/";
const originalAssetPrefix = "assets/media/og-library/Projects/";

const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const mediaId = (path) => `media-${slug(path)}`;
const titleFromPath = (path) => path.split("/").at(-1).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const oldProjects = JSON.parse(await readFile(projectsPath, "utf8"));
const creditsBySource = new Map();
let oldMedia = [];
try {
  oldMedia = JSON.parse(await readFile(mediaPath, "utf8"));
  for (const item of oldMedia) {
    if (item.sourcePath && item.credits) creditsBySource.set(item.sourcePath, item.credits);
  }
} catch {}
for (const project of oldProjects) {
  for (const block of project.blocks || []) {
    if (block.source && /creative by/i.test(block.body || "")) creditsBySource.set(block.source, block.body);
  }
}
const knownDroniesCredits = {
  "corvusos-boot-sequence.png": "Creative by Phil Goodwin for Unfold.",
  "dronies-eyes.jpg": "Creative by Eddie Lobanovskiy for Unfold.",
  "corvusos-component-library.png": "Creative by HebaH for Heyo.",
  "dronie-deconstructed-tee.png": "Creative by Phil Goodwin for Unfold.",
  "dronies-stickers.jpg": "Creative by Courtney Askew for Heyo. “Always Watching” sketch by Vic.",
  "dronies-roadmap.jpg": "Creative by Courtney Askew for Heyo.",
  "dronies-web-design-2022.png": "Creative by Benten Woodring for Heyo.",
  "dronies-nft-website.jpg": "Creative by Eicher for Heyo, in collaboration with the Web and Product teams.",
  "dronies-hoodie-concept.png": "Creative by HebaH for Heyo.",
  "dronies-merch.png": "Creative by Santi Jaramillo for Heyo.",
  "dronies-web-layout.png": "Creative by Benjamin Oberemok.",
  "dronies-web-hero.png": "Creative by Benjamin Oberemok.",
  "dronies-corvusos.png": "Creative by HebaH for Heyo.",
};

async function walk(directory, base = directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "to optimize and cut") continue;
    const full = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full, base));
    else output.push({ full, relative: relative(base, full).replaceAll("\\", "/"), size: (await stat(full)).size });
  }
  return output;
}

const localFiles = await walk(mediaRoot.pathname.replace(/^\/(.:)/, "$1"));
const typeFor = (path) => {
  const ext = extname(path).toLowerCase();
  if ([".mp4", ".mov", ".webm"].includes(ext)) return "video";
  if (ext === ".pdf") return "pdf";
  return "image";
};

const ownerFor = (path) => {
  if (path.startsWith("Apps/GameDesigner/")) return "game-designer";
  if (path.startsWith("Apps/Yesterday/")) return "yesterday";
  if (path.startsWith("Apps/MidiClipBuilder/")) return "midi-clip-builder";
  if (path.startsWith("Apps/Sonilabs/")) return "sonilabs";
  if (path.startsWith("Daedalus/Comic/")) return "daedalus-comic";
  if (path.startsWith("Daedalus/Brand/")) return "daedalus-brand";
  if (path.startsWith("Daedalus/Film/")) return "daedalus-film";
  if (path.startsWith("Dronies/MetaverseBunker/")) return "dronies-bunker";
  if (path.startsWith("Dronies/Creatives/")) return "dronies-creatives";
  if (path.startsWith("Dronies/")) return "dronies";
  if (path.startsWith("Flax/")) return "flax-editor";
  if (path.startsWith("Graphics/Marathon/")) return "marathon-tau-ceti";
  if (path === "Graphics/3DPractice/movingonexpress.webp") return "moving-on-express";
  if (path.startsWith("Graphics/3DPractice/")) return "visual-3d-practice";
  if (path === "Graphics/EstafosSuraya_Zine.webp") return "daedalus-origin";
  if (path.includes("EarthWallet")) return "earthwallet";
  if (path.includes("mountaingraphs")) return "mountain-graphs";
  if (path.includes("VRX_IIV")) return "vrx-iiv";
  if (path.includes("Worlds_Apart")) return "worlds-apart";
  if (path.includes("figmagram")) return "figmagram";
  if (path.includes("acid-wave")) return "acid-wave";
  if (path.includes("pill_button")) return "pill-button";
  if (path.includes("wanderstar")) return "brand-bits";
  if (path.startsWith("KERN/")) return "kern";
  if (path.startsWith("Lightkeeper/VerticalSlice/")) return "vertical-slice-2026";
  if (path.startsWith("Lightkeeper/TechnicalTest/")) return "lightkeeper-technical-test";
  if (path.startsWith("Lightkeeper/HighConcept_Pitchdeck/")) return "fell-out-concept";
  if (path.startsWith("Lightkeeper/GameJam/")) return "fell-out-gamejam";
  if (path.startsWith("Lightkeeper/UI/")) return "vertical-slice-2026";
  if (path.startsWith("Prototypes/ProjectHypno/")) return "project-hypno";
  if (path.startsWith("Prototypes/ProjectSunshine/")) return "project-sunshine";
  if (path.startsWith("Prototypes/MightyPebble/")) return "mighty-pebble";
  if (path.startsWith("Prototypes/MatterCraft/")) return "mattercraft";
  if (path.startsWith("Prototypes/SpaceKeeper/")) return "spacekeeper";
  if (path.startsWith("Prototypes/FoxStories/")) return "fox-stories";
  if (path.startsWith("Prototypes/KCD_Combat/")) return "kcd-combat";
  if (path.startsWith("Prototypes/LevelDesign/")) return "level-design";
  if (path.startsWith("Prototypes/SwampFellas/")) return "swamp-fellas";
  if (path.startsWith("UX/UserWise/")) return "userwise";
  if (path.startsWith("UX/RiseAboveDisorder/")) return "rise-above-disorder";
  if (path.startsWith("VoidOverdrive/")) return "void-overdrive";
  return "visual-lab";
};

const media = localFiles.map((file) => {
  const pathParts = file.relative.split("/");
  pathParts[pathParts.length - 1] = optimizedFileName(pathParts.at(-1));
  const sourcePath = `${assetPrefix}${pathParts.join("/")}`;
  return {
    id: mediaId(file.relative),
    type: typeFor(file.relative),
    title: titleFromPath(file.relative),
    caption: "",
    alt: `${titleFromPath(file.relative)} portfolio artifact`,
    sourcePath,
    originalSourcePath: `${originalAssetPrefix}${file.relative}`,
    externalUrl: "",
    projectId: ownerFor(file.relative),
    sectionId: "archive",
    credits: creditsBySource.get(sourcePath) || (file.relative.startsWith("Dronies/Creatives/") ? knownDroniesCredits[file.relative.split("/").at(-1)] || "" : ""),
    posterFrame: typeFor(file.relative) === "video" ? `assets/media/posters/${mediaId(file.relative)}.jpg` : "",
    fullscreenEligible: typeFor(file.relative) !== "pdf",
    fileSize: file.size,
  };
});

const externalMedia = [
  ["youtube-marathon-tau-ceti", "youtube", "TAU CETI IV ARCHIVES — Recovered Colony Logs", "https://www.youtube.com/watch?v=24Fv9rO7GYA", "marathon-tau-ceti"],
  ["youtube-moving-on-express", "youtube", "Moving On Express gameplay", "https://www.youtube.com/watch?v=3H-sLyd_h6g", "moving-on-express"],
  ["youtube-worlds-apart", "youtube", "Worlds Apart timelapse", "https://www.youtube.com/watch?v=sHkEmOFCxiE", "worlds-apart"],
  ["youtube-dronies-interview", "youtube", "Dronies team interview", "https://www.youtube.com/watch?v=AAw40ybbJus", "dronies"],
  ["youtube-daedalus-alpha-bts", "youtube", "Daedalus Alpha — Behind the Scenes", "https://www.youtube.com/watch?v=l9EgP_xHBI8", "daedalus-bts"],
  ["youtube-daedalus-alpha-film", "youtube", "Daedalus Alpha", "https://www.youtube.com/watch?v=U1zfTUhDk5E", "daedalus-film"],
  ["youtube-fell-out-walkthrough", "youtube", "Fell Out Walkthrough — Ludum Dare 54", "https://www.youtube.com/watch?v=aMEF98GBWjc", "fell-out-gamejam"],
  ["youtube-lightkeeper-technical-test", "youtube", "Lightkeeper Gameplay Teaser", "https://www.youtube.com/watch?v=mQxHtjzD3qc", "lightkeeper-technical-test"],
  ["media-lightkeeper-technicaltest-lightkeeper-techtest-direction-mp4", "youtube", "Lightkeeper early graphics test", "https://www.youtube.com/watch?v=1IYxMeIcDF0", "lightkeeper-technical-test"],
  ["media-lightkeeper-technicaltest-lightkeeper-techtest-timelapse-mp4", "youtube", "Lightkeeper techtest timelapse", "https://www.youtube.com/watch?v=mUqxsFPwdq0", "lightkeeper-technical-test"],
  ["media-prototypes-mattercraft-mattercraft-gameplay-mp4", "youtube", "Mattercraft gameplay", "https://www.youtube.com/watch?v=Ih2SJkeYeFg", "mattercraft"],
  ["media-prototypes-mightypebble-mighty-pebble-building-system-test-mp4", "youtube", "Mighty Pebble building system test", "https://www.youtube.com/watch?v=HpYl-L3auoI", "mighty-pebble"],
  ["media-prototypes-spacekeeper-spacekeeper-week1progress-mp4", "youtube", "Spacekeeper week 1 progress", "https://www.youtube.com/watch?v=4pFqY08wGKM", "spacekeeper"],
  ["media-prototypes-foxstories-christmasdemowith-fireworks-mp4", "youtube", "Fox Stories Christmas demo with fireworks", "https://www.youtube.com/watch?v=1MxcjfOadJo", "fox-stories"],
  ["youtube-project-sunshine", "youtube", "Little to the Left of Sunshine", "https://www.youtube.com/watch?v=H6Dubeaqhvo", "project-sunshine"],
  ["youtube-project-hypno", "youtube", "Hypnothermia — Intro", "https://www.youtube.com/watch?v=WIsTilxePUg", "project-hypno"],
  ["youtube-lightkeeper-vertical-slice", "youtube", "Lightkeeper Gameplay Walkthrough", "https://www.youtube.com/watch?v=_ROPRah7oxQ", "vertical-slice-2026"],
];
for (const [id, type, title, externalUrl, projectId] of externalMedia) {
  const item = { id, type, title, caption: "", alt: title, sourcePath: "", externalUrl, projectId, sectionId: "external", credits: "", posterFrame: "", fullscreenEligible: true, fileSize: 0 };
  const existingIndex = media.findIndex((candidate) => candidate.id === id);
  if (existingIndex >= 0) media[existingIndex] = item;
  else media.push(item);
}

const ref = (path) => mediaId(path);
const block = (id, type, width, heading = "", body = "", extra = {}) => ({ id, type, width, heading, body, source: "", mediaRef: "", href: "", label: "", projectId: "", alt: "", fit: "cover", ...extra });
const text = (id, heading, body, width = "full") => block(id, "text", width, heading, body);
const visual = (id, path, width = "full", heading = "", body = "", fit = "cover") => block(id, typeFor(path), width, heading, body, { mediaRef: ref(path), fit });
const youtube = (id, mediaRef, heading = "", body = "") => block(id, "youtube", "full", heading, body, { mediaRef });
const link = (id, heading, label, href, body = "", width = "full") => block(id, "link", width, heading, body, { href, label });
const projectLink = (id, projectId, label, body = "") => block(id, "project-link", "full", "", body, { projectId, label });

const projects = [];
function add(id, title, description, options = {}) {
  const thumbnailMediaRef = options.thumbnailMediaRef || (options.thumbnail ? ref(options.thumbnail) : "");
  const thumbnailMedia = media.find((item) => item.id === thumbnailMediaRef);
  const project = {
    id, parentId: options.parentId || null, showOnRoot: options.showOnRoot === true, layout: options.layout || "folder",
    windowWidth: options.windowWidth || "748px", windowHeight: options.windowHeight || "506px", textWidth: "62ch",
    body: options.body || "", showOverview: options.showOverview !== false, showFolderActions: options.showFolderActions !== false,
    blocks: options.blocks || [], title, heading: options.heading || title.replace(/\.(DIR|GAME|PROJECT|PRODUCTION|PRODUCT|EDITOR|UNITY|WEBSITE)$/, "").replaceAll("_", " "),
    shortcutLabel: options.shortcutLabel || title, kind: options.kind || (options.layout === "media-fullscreen" ? "MEDIA / FULLSCREEN" : "PROJECT / DIRECTORY"),
    description, thumbnail: "", thumbnailMediaRef, thumbnailType: thumbnailMedia?.type === "video" ? "video" : "image",
    sourceType: options.sourceType || "image", category: options.category || "EXPERIMENT", period: options.period || "",
    source: "", mediaRef: options.mediaRef || "", role: options.role || "DESIGN / DEVELOPMENT", state: options.state || "ARCHIVE READY",
    route: `/PROJECT/${id.toUpperCase()}`, status: ["MOUNTING PROJECT", "RESOLVING MEDIA REFERENCES", "BUILDING ARCHIVE", "OPENING DIRECTORY"],
  };
  projects.push(project);
  return project;
}

const journey = {
  lightkeeper: `Lightkeeper did not begin as Lightkeeper. It started as Fell Out, a small game-jam project built around a strange archipelago, its inhabitants, and a world hidden behind fog. We liked the setting enough to keep returning to it.\n\nIn 2024, Fell Out received concept funding from FFF Bayern. The job changed from “we made a fun little game” to “can this become an actual product?” We built a high-concept pitch, expanded the world, and tested exploration, gathering, traversal, progression and character interaction at a much larger scale.\n\nLater that year the project, now Lightkeeper, received prototype funding. The prototype phase expanded the game again, but it also forced us to cut. The final vertical slice is the result of that path. This archive keeps the polished work next to discarded directions and technical tests because the interesting part is how the project changed every time we learned something new.`,
  kern: `KERN is the project I am currently trying to solve, which means most of this folder is design work in motion.\n\nThe central question is simple to state and difficult to make into a game: if the player encounters an anomaly they do not understand, how do they investigate it, infer what it does, and act on that knowledge without the interaction collapsing into a checklist?\n\nThe prototype footage, pitch material and institutional graphics are shown together because KERN’s fiction and mechanics are being designed at the same time.`,
  dronies: `Dronies was the project that moved me from design into project direction. I managed production day to day for roughly seven months while the team grew across art, design, development, motion, marketing, community and operations.\n\nMy role was not to claim authorship over every object shown here. It was to keep a project with dozens of contributors moving as one system: track dependencies, keep disciplines unblocked, manage changing priorities and make sure the launch happened.\n\nThe official collection consisted of 10,000 pieces and sold out in five minutes. Credits attached to individual artifacts identify the creators where that information is available.`,
  flax: `I started modifying Flax because small editor interactions kept interrupting the speed at which I wanted to build the game. None of those problems is individually dramatic. Together they determine whether the editor feels like an extension of thought or a sequence of tiny negotiations.\n\nThe work here covers transforms, hierarchy behavior, property navigation, docking and content browsing. Some changes are experiments in our fork, some are still being designed, and some have been contributed upstream.`,
  daedalus: `Daedalus started as a smaller experiment called Estafos & Suraya: could a tiny team use early generative-image tools to finish a coherent narrative work instead of only producing isolated images?\n\nThat became a science-fiction world, a 12-page comic and an interactive animated reader. I wrote and designed the comic, assembled and standardized generated source material, built the pages in Figma, animated panels in Rive and wired the reader into the website. The project later expanded into brand, physical work and live action.`,
};

add("lightkeeper", "LIGHTKEEPER.GAME", "An exploration game that evolved from a game-jam prototype into a funded concept and then a substantially larger playable vertical slice.", { category: "GAME", period: "2023–2026 [VERIFY]", role: "GAME DIRECTOR / GAME DESIGNER / PRODUCER", state: "PLAYABLE VERTICAL SLICE / PLAYTEST", thumbnail: "Lightkeeper/VerticalSlice/lightkeeper_15s_still_graphics.mp4", blocks: [
  visual("lk-hero", "Lightkeeper/VerticalSlice/lightkeeper_15s_still_graphics.mp4", "full", "LIGHTKEEPER"), text("lk-journey", "FROM GAME JAM TO VERTICAL SLICE", journey.lightkeeper),
  youtube("lk-walkthrough", "youtube-lightkeeper-vertical-slice", "VERTICAL SLICE GAMEPLAY WALKTHROUGH"),
  link("lk-steam", "PLAY / VIEW", "VIEW ON STEAM ↗", "https://store.steampowered.com/app/3228540/Lightkeeper/"),
  visual("lk-atmosphere", "Lightkeeper/VerticalSlice/lightkeeper_atmosphere.mp4", "half"), visual("lk-characters", "Lightkeeper/VerticalSlice/lightkeeper_character_interactions.mp4", "half"),
  text("lk-exploration", "EXPLORATION", "The current slice combines traversal, environmental discovery, character interaction and progression across a strange archipelago.", "third"), visual("lk-climbing", "Lightkeeper/VerticalSlice/lightkeeper_climbing.mp4", "third"), visual("lk-interiors", "Lightkeeper/VerticalSlice/lightkeeper_interiors.mp4", "third"),
  visual("lk-camera", "Lightkeeper/VerticalSlice/lightkeeper_camera_director.mp4", "half"), visual("lk-clouds", "Lightkeeper/VerticalSlice/Lightkeeper_shadow_clouds_tech.mp4", "half"),
  text("lk-tools", "WORLD BUILDING WAS ALSO TOOL BUILDING", "Building the world meant building terrain, progression and layout tools that let a small team iterate on scale, pacing and content."), visual("lk-terrain", "Lightkeeper/VerticalSlice/lightkeeper_custom_terain_tools.mp4", "half"), visual("lk-progression", "Lightkeeper/VerticalSlice/Lightkeeper_progression_tool.mp4", "half"),
  visual("lk-inventory", "Lightkeeper/UI/Inventory.png", "half", "", "", "contain"), visual("lk-menu-board", "Lightkeeper/UI/lightkeeper-player-menu-design-board.png", "half", "", "", "contain"), visual("lk-menu", "Lightkeeper/VerticalSlice/Lightkeeper_vertical_Slice_Menu.mp4", "full", "PLAYER MENU", "", "contain"),
  text("lk-before", "BEFORE THE VERTICAL SLICE", "The technical test was where we searched for visual direction, world scale and traversal before committing to the current slice."), projectLink("lk-tech-link", "lightkeeper-technical-test", "OPEN TECHNICAL_TEST/"),
  text("lk-fell-out", "FELL OUT", "The game-jam idea became a formal high-concept pitch and received EUR 20,000 in concept funding from FFF Bayern in 2024."), visual("lk-deck-1", "Lightkeeper/HighConcept_Pitchdeck/1.png", "third", "", "", "contain"), visual("lk-deck-7", "Lightkeeper/HighConcept_Pitchdeck/7.png", "third", "", "", "contain"), visual("lk-deck-13", "Lightkeeper/HighConcept_Pitchdeck/13.png", "third", "", "", "contain"), projectLink("lk-concept-link", "fell-out-concept", "OPEN FELL_OUT.CONCEPT/"),
  visual("lk-origin", "Lightkeeper/GameJam/fell-out-game-jam-gameplay.mp4", "full", "WHERE IT STARTED"), projectLink("lk-jam-link", "fell-out-gamejam", "OPEN FELL_OUT.GAMEJAM/"),
  text("lk-retro", "WHAT CHANGED", "The project repeatedly exposed the difference between a promising prototype and a sustainable game. Systems expanded before the core loop was proven; later direction required cutting completed survival, farming, building and content work. The archive leaves those decisions visible."),
] });

add("kern", "KERN.GAME", "An investigative science-fiction game about entering an anomalous exclusion zone, observing things you do not understand, and learning their rules.", { category: "GAME", period: "2026–PRESENT", role: "CREATIVE DIRECTION / GAME DESIGN / PRODUCTION", state: "IN DEVELOPMENT", thumbnail: "KERN/prototype/kern_gameplay_test.mp4", blocks: [
  visual("kern-hero", "KERN/prototype/kern_gameplay_test.mp4", "full", "CURRENT PROTOTYPE"), text("kern-journey", "IN DEVELOPMENT", journey.kern), visual("kern-sound", "KERN/prototype/kern_event_sound_test.mp4", "half"), visual("kern-sketch", "KERN/prototype/FotoSketcher_image6.png", "half"),
  text("kern-question", "HOW DO YOU INVESTIGATE SOMETHING YOU DO NOT UNDERSTAND?", "Tools should produce evidence rather than tick checklist boxes. Encounters need uncertainty, investigation needs risk, and solving an anomaly must lead to an action rather than only a label."),
  ...["FotoSketcher_image.png", "FotoSketcher_image2.png", "FotoSketcher_image3.png"].map((name, i) => visual(`kern-study-${i + 1}`, `KERN/prototype/${name}`, "third")),
  text("kern-identity", "WORLD IDENTITY", "The identity work is institutional design for an organization that exists inside the Zone, not a detached logo exercise."),
  ...["kern-government-research-seal.png", "kern-logo-eye-globe.png", "kern-wordmark-split-layout.png"].map((name, i) => visual(`kern-brand-${i + 1}`, `KERN/Branding/${name}`, "third", "", "", "contain")),
  ...["Psycho_Hazard_Poster.jpg", "kern_groundcorp_poster.jpg", "kern_callnumber_poster.jpg"].map((name, i) => visual(`kern-poster-${i + 1}`, `KERN/Graphics/${name}`, "third", "", "", "contain")),
  ...["1.png", "6.png", "11.png"].map((name, i) => visual(`kern-deck-${i + 1}`, `KERN/pitch_deck/${name}`, "third", "", "", "contain")),
  text("kern-questions", "CURRENT QUESTIONS", "How much uncertainty can an investigation support? How should tools overlap? What persists after an encounter? This section remains intentionally open while the design changes."),
] });

add("dronies", "DRONIES.PRODUCTION", "A multidisciplinary digital-collectibles production I managed day to day across roughly 30 contributors, spanning launch, product, web, brand, motion, merchandise and narrative work.", { category: "PRODUCTION", period: "2021–2022 [VERIFY]", role: "PROJECT DIRECTOR / PRODUCER", state: "SHIPPED", thumbnail: "Dronies/project_breakdown.mp4", blocks: [
  visual("dronies-hero", "Dronies/project_breakdown.mp4", "full", "FROM PM PERSPECTIVE"), text("dronies-journey", "SEVEN MONTHS IN FAST FORWARD", journey.dronies), visual("dronies-transition", "Dronies/dronies_graphic.mp4"),
  ...["dronies-web-hero.png", "dronies-merch.png", "dronies-roadmap.jpg"].map((name, i) => visual(`dronies-scope-${i + 1}`, `Dronies/Creatives/${name}`, "third")),
  text("dronies-scope", "SCOPE", "Around 30 contributors worked across collection art, product, web, motion, brand, merchandise, community and operations. The official collection contained 10,000 pieces and sold out in five minutes."),
  ...["dronies-nft-website.jpg", "dronies-web-design-2022.png", "dronies-web-layout.png", "corvusos-component-library.png", "corvusos-boot-sequence.png", "dronies-corvusos.png"].map((name, i) => visual(`dronies-web-${i + 1}`, `Dronies/Creatives/${name}`, "half", "", "", "contain")),
  ...["dronie-deconstructed-tee.png", "dronies-hoodie-concept.png", "dronies-stickers.jpg"].map((name, i) => visual(`dronies-merch-${i + 1}`, `Dronies/Creatives/${name}`, "third", "", "", "contain")),
  visual("dronies-bunker-flat", "Dronies/MetaverseBunker/droniesbunker-flat-1.mp4", "half"), visual("dronies-bunker-reel", "Dronies/MetaverseBunker/DroniesSizzleReel-01-bumps.mp4", "half"), projectLink("dronies-bunker-link", "dronies-bunker", "OPEN METAVERSE_BUNKER/"),
  text("dronies-recovery", "NARRATIVE / COMICS", "Comic covers, pages and complete team credits remain in the recovery queue."),
  link("dronies-official", "EXTERNAL HISTORY", "OPEN OFFICIAL ARCHIVE ↗", "https://www.droniesnft.com/"), link("dronies-tldr", "", "OPEN OFFICIAL TLDR ↗", "https://www.droniesnft.com/tldr"), link("dronies-dribbble", "", "OPEN HISTORICAL PM POST ↗", "https://dribbble.com/shots/17372362--Dronies-from-PM-perspective"), youtube("dronies-interview", "youtube-dronies-interview", "TEAM INTERVIEW"),
] });

add("flax-editor", "FLAX.EDITOR", "An ongoing redesign of everyday Flax editor interactions, focused on faster selection, transforms, navigation, layout and feedback.", { category: "TOOLS", period: "2026–PRESENT", role: "PRODUCT / UX DESIGN, ENGINE-FORK CONTRIBUTOR", state: "ACTIVE", thumbnail: "Flax/flax-colored-block-transform-demo.mp4", blocks: [
  visual("flax-hero", "Flax/flax-colored-block-transform-demo.mp4", "full", "WHY MODIFY THE EDITOR"), text("flax-journey", "EDITOR ERGONOMICS", journey.flax),
  visual("flax-blockout", "Flax/flax-blockout-transform-workflow.mp4", "half"), visual("flax-modes", "Flax/flax-transform-mode-switching.mp4", "half"), visual("flax-gizmo", "Flax/flax-transform-gizmo-axis-demo.mp4", "half"), text("flax-principles", "TRANSFORM PRINCIPLES", "Predictable handles, maintained mode and focus, correct axis visibility, precise feedback and less interaction-state loss.", "half"),
  visual("flax-properties", "Flax/flax-properties-panel-navigation.mp4", "half"), visual("flax-hierarchy", "Flax/flax-scene-hierarchy-navigation.mp4", "half"), visual("flax-browser", "Flax/flax-content-browser-column-resizing.mp4", "half"), visual("flax-docking", "Flax/flax-panel-docking-layout-demo.mp4", "half"), visual("flax-screen", "Flax/FlaxEditorScreenshot.png", "full", "", "", "contain"),
  text("flax-upstream", "UPSTREAM / IMPLEMENTATION", "The archive includes fork experiments, design proposals and contributions at different stages. Exact merged PR and commit links still need to be recovered; no fork-only change should be read as an official Flax feature."),
] });

add("daedalus", "DAEDALUS.PROJECT", "An original science-fiction project developed across an interactive comic, film, web, music and experimental AI-assisted production.", { category: "NARRATIVE", role: "CREATOR / WRITER / DESIGNER / DIRECTOR", state: "SHIPPED / ARCHIVED", thumbnail: "Daedalus/Comic/daedalus_comic_trailer.mp4", blocks: [
  visual("daedalus-hero", "Daedalus/Comic/daedalus_comic_trailer.mp4", "full", "DAEDALUS"), text("daedalus-journey", "FROM IMAGE EXPERIMENT TO WORLD", journey.daedalus), visual("daedalus-origin", "Graphics/EstafosSuraya_Zine.webp", "full", "ORIGIN — ESTAFOS & SURAYA"), link("daedalus-origin-link", "", "OPEN BEHANCE ORIGIN ↗", "https://www.behance.net/gallery/150468091/Estafos-Suraya"),
  visual("daedalus-comic-project", "Daedalus/Comic/daedalus_comic_project.mp4", "full", "INTERACTIVE COMIC"), visual("daedalus-timelapse", "Daedalus/Comic/daedalus_comic_timelapse_short.mp4", "half"), visual("daedalus-site", "Daedalus/Comic/daedalus_comic_website.mp4", "half"),
  text("daedalus-process", "PROCESS", "Story and script → generated source images → Figma page design → cleanup and optimization → Rive animation → state machine and JavaScript progression."), projectLink("daedalus-comic-link", "daedalus-comic", "OPEN COMIC/"), link("daedalus-live", "", "OPEN LIVE INTERACTIVE COMIC ↗", "https://daedalus.am/comic"),
  visual("daedalus-maze", "Daedalus/Brand/dribbble-test-maze.mp4", "third"), visual("daedalus-merch-2", "Daedalus/Brand/merch-2.mp4", "third"), visual("daedalus-merch-1", "Daedalus/Brand/merch-vid-1.mp4", "third"), text("daedalus-credits", "BRAND / PHYSICAL", "Brand direction by Alex Lazaris; merchandise work by Ethan Blaney. See the Lazaris case study for the broader team output."), link("daedalus-case-study", "", "OPEN LAZARIS CASE STUDY ↗", "https://www.wearelazaris.com/daedalus"),
  visual("daedalus-film-concept", "Daedalus/Film/Intro-daedalus-concept.mp4", "full", "FILM — EARLY CONCEPT / PRE-PRODUCTION"), projectLink("daedalus-film-link", "daedalus-film", "OPEN FILM/"),
  youtube("daedalus-alpha-film", "youtube-daedalus-alpha-film", "DAEDALUS ALPHA"), youtube("daedalus-alpha-bts", "youtube-daedalus-alpha-bts", "BEHIND THE SCENES"),
] });

add("userwise", "USERWISE.PRODUCT", "A live-ops content-builder redesign shown from research and exploration through implementation workflows and final interface.", { category: "DESIGN", role: "PRODUCT / UX DESIGN", state: "SHIPPED", thumbnail: "UX/UserWise/userwise-content-builder.webp", blocks: [
  visual("userwise-hero", "UX/UserWise/userwise-content-builder.webp", "full", "CONTENT BUILDER", "", "contain"), text("userwise-journey", "FROM RESEARCH TO BUILDER", "UserWise was a live-ops product for mobile game teams. I worked with Phil Goodwin and Evan Place on the redesign, driving early research and exploration and helping carry the interface through refinement. The sequence below shows how the structure emerged instead of presenting the final UI as isolated polish."),
  visual("userwise-original", "UX/UserWise/userwise-original-design.webp", "half", "ORIGINAL", "", "contain"), visual("userwise-research", "UX/UserWise/userwise-research-comprehension.webp", "half", "RESEARCH", "", "contain"), visual("userwise-explore", "UX/UserWise/userwise-design-exploration.webp", "half", "EXPLORATION", "", "contain"), visual("userwise-workflows", "UX/UserWise/userwise-implementation-workflows.webp", "half", "IMPLEMENTATION", "", "contain"), visual("userwise-final", "UX/UserWise/userwise-content-builder.webp", "full", "FINAL INTERFACE", "", "contain"),
  link("userwise-history", "HISTORICAL CONTEXT", "OPEN ORIGINAL DRIBBBLE POST ↗", "https://dribbble.com/shots/16045087-UserWise-Content-Builder"), link("userwise-case", "", "OPEN AGENCY CASE STUDY ↗", "https://dribbble.com/shots/20098224-Userwise-io-Liveops-Engine-for-Mobile-Games"),
] });

add("marathon-tau-ceti", "MARATHON.TAU_CETI", "An in-universe archive video reconstructing the fall of Tau Ceti IV from recovered logs and damaged signals.", { category: "FILM", role: "EDITOR / MOTION DESIGN", state: "SHIPPED", thumbnail: "Graphics/Marathon/marathon-dither-experiment-02-1080p.mp4", blocks: [
  youtube("marathon-final", "youtube-marathon-tau-ceti", "TAU CETI IV ARCHIVES"), text("marathon-journey", "RECOVERED COLONY LOGS", "I treated Marathon’s source logs like damaged records recovered inside the world and reconstructed the fall of Tau Ceti IV as if somebody had assembled the evidence afterward. The final video took four days of editing. The local files below are signal studies that led to the finished piece."),
  visual("marathon-study-2", "Graphics/Marathon/marathon-dither-experiment-02-1080p.mp4", "half"), visual("marathon-study-3", "Graphics/Marathon/marathon-dither-experiment-03.mp4", "half"), visual("marathon-glyph-damage", "Graphics/Marathon/marathon-glyph-dithering-analogue-damage-test.mov", "half"), visual("marathon-glyph", "Graphics/Marathon/glyph-only.mov", "half"), visual("marathon-pattern", "Graphics/Marathon/marathon-green-dither-pattern-study.png", "full", "SIGNAL STUDIES", "Legibility against destruction: glyphs, dithering, analog damage and partial reconstruction.", "contain"),
] });

add("swamp-fellas", "SWAMP_FELLAS.GAME", "A multiplayer game experiment where development and public short-form documentation happened as one process.", { category: "GAME", role: "GAME DESIGN / DEVELOPMENT / PUBLIC DEVLOG", state: "PROTOTYPE ARCHIVED", thumbnail: "Prototypes/SwampFellas/trailer-socials.mp4", blocks: [
  visual("swamp-hero", "Prototypes/SwampFellas/trailer-socials.mp4", "full"), text("swamp-journey", "DEVELOPING IN PUBLIC", "Swamp Fellas was built partly to test multiplayer and gameplay ideas and partly to see how quickly a simple concept could become something people wanted to watch. Character tests, fishing, terrain work and dumb little scenes became short videos while the prototype was changing. Historical audience metrics still need verification."),
  ...["swamp-fellas-frog-character-test.mp4", "swamp-fellas-fishing-scene.mp4", "swamp-fellas-camera-crew-scene.mp4", "swamp-fellas-terrain-shader-breakdown.mp4", "Frogathon.mp4", "ilove.mp4", "trailer-socials.mp4", "trailer-wishlist.mp4"].map((name, i) => visual(`swamp-${i + 1}`, `Prototypes/SwampFellas/${name}`, "half")),
] });

add("bolt-icons", "BOLT.UNITY", "A visual-scripting interface and icon-system project; core source material remains in the recovery queue.", { parentId: "client-work", category: "TOOLS", role: "PRODUCT / UI DESIGN", state: "RECOVERY NEEDED", blocks: [text("bolt-story", "VISUAL LANGUAGE FOR CODE", "Bolt was where my product-design work and game-development interests overlapped directly. The useful story is how a visual language was built for code concepts, how those symbols behaved inside a dense developer tool, and which parts later carried into Unity Visual Scripting. Original icon sheets, exact icon count, UI screenshots, dates and credits still need verification before publication.")] });
add("lazaris", "LAZARIS.WEBSITE", "Development of the Lazaris studio website from an existing design direction into a responsive production site.", { parentId: "client-work", category: "WEBSITE", role: "WEB DEVELOPMENT / IMPLEMENTATION", state: "LIVE / MEDIA RECOVERY NEEDED", blocks: [text("lazaris-role", "DEVELOPMENT, NOT VISUAL DESIGN", "I developed the Lazaris website from an existing visual direction. My role was implementation: translating the design into a functioning responsive site, wiring interactions and content structure, and making the system behave consistently. The visual identity and design belong to the Lazaris team."), link("lazaris-live", "", "VIEW LIVE SITE ↗", "https://www.wearelazaris.com/")] });

add("prototypes", "PROTOTYPES.DIR", "Small projects built to answer a question quickly, test a mechanic, find a visual direction, or prove an idea was not worth another six months.", { category: "EXPERIMENT", kind: "ARCHIVE / DIRECTORY", thumbnailMediaRef: "preview-fox-stories" });
add("game-jams", "GAME_JAMS.DIR", "Small shipped games made under jam constraints, including the work that later grew into Lightkeeper.", { category: "GAME JAM", kind: "ARCHIVE / DIRECTORY" });
add("apps", "APPS.DIR", "Small product and tool experiments focused on planning, design systems, music and sound workflows.", { category: "APP", kind: "ARCHIVE / DIRECTORY" });
add("client-work", "CLIENT_WORK.DIR", "Selected client work where personal contribution and collaborator credits can be stated clearly.", { category: "DESIGN", kind: "ARCHIVE / DIRECTORY" });
add("visual-lab", "VISUAL_LAB.DIR", "One-off visual experiments, motion studies, 3D practice and small interface exercises.", { category: "DESIGN", kind: "ARCHIVE / DIRECTORY", thumbnailMediaRef: "preview-mountain-graphs" });

add("vertical-slice-2026", "VERTICAL_SLICE.2026", "The current playable Lightkeeper vertical slice.", { parentId: "lightkeeper", category: "GAME", role: "GAME DIRECTOR / GAME DESIGNER / PRODUCER", thumbnail: "Lightkeeper/VerticalSlice/lightkeeper_15s_still_graphics.mp4", blocks: [youtube("vertical-slice-walkthrough", "youtube-lightkeeper-vertical-slice", "GAMEPLAY WALKTHROUGH")] });
add("lightkeeper-technical-test", "TECHNICAL_TEST.DIR", "Visual direction, world-scale, traversal and tooling tests that preceded the vertical slice.", { parentId: "lightkeeper", category: "GAME", thumbnail: "Lightkeeper/TechnicalTest/lightkeeper_techtest_direction.mp4", blocks: [youtube("tech-gameplay", "youtube-lightkeeper-technical-test", "GAMEPLAY FOOTAGE"), visual("tech-begin", "Lightkeeper/TechnicalTest/lightkeeper_techtest_beginning.mp4", "half"), visual("tech-direction", "Lightkeeper/TechnicalTest/lightkeeper_techtest_direction.mp4", "half"), visual("tech-world", "Lightkeeper/TechnicalTest/lightkeeper-world-layout-planning.mp4", "third"), visual("tech-level", "Lightkeeper/TechnicalTest/lightkeeper-level-layout-overview.mp4", "third"), visual("tech-time", "Lightkeeper/TechnicalTest/lightkeeper_techtest_timelapse.mp4", "third")] });
add("fell-out-concept", "FELL_OUT.CONCEPT", "The funded high-concept phase between the original jam and Lightkeeper’s larger prototype.", { parentId: "lightkeeper", category: "GAME", thumbnail: "Lightkeeper/HighConcept_Pitchdeck/1.png", blocks: [text("fell-funding", "CONCEPT FUNDING", "Fell Out received EUR 20,000 concept funding from FFF Bayern in March 2024. The full deck and every slide are available in the archive."), link("fell-funding-source", "", "OPEN FFF FUNDING SOURCE ↗", "https://jahresbericht.fff-bayern.de/fff-foerderungen-2024-games/")] });
add("fell-out-gamejam", "FELL_OUT.GAMEJAM", "The original game-jam experiment where Lightkeeper began.", { parentId: "lightkeeper", showOnRoot: true, category: "GAME JAM", thumbnail: "Lightkeeper/GameJam/fell-out-game-jam-gameplay.mp4", blocks: [youtube("fell-jam-walkthrough", "youtube-fell-out-walkthrough", "FULL WALKTHROUGH"), visual("fell-jam-gameplay", "Lightkeeper/GameJam/fell-out-game-jam-gameplay.mp4", "full", "WHERE IT STARTED")] });

add("dronies-creatives", "CREATIVES.DIR", "Launch, product, web and merchandise artifacts with per-item credits where known.", { parentId: "dronies", category: "DESIGN" });
add("dronies-bunker", "METAVERSE_BUNKER.DIR", "Bunker initiative motion and sizzle-reel material.", { parentId: "dronies", category: "PRODUCTION", thumbnail: "Dronies/MetaverseBunker/DroniesSizzleReel-01-bumps.mp4" });
add("daedalus-origin", "ORIGIN_ESTAFOS_SURAYA", "The smaller narrative experiment that became Daedalus.", { parentId: "daedalus", category: "NARRATIVE", thumbnail: "Graphics/EstafosSuraya_Zine.webp" });
add("daedalus-comic", "COMIC.DIR", "The interactive comic, source imagery, animated panels and production system.", { parentId: "daedalus", category: "NARRATIVE", thumbnail: "Daedalus/Comic/daedalus_comic_project.mp4", blocks: [text("comic-context", "INTERACTIVE READER", "I wrote and designed the 12-page comic, standardized generated source material, built pages in Figma, animated panels in Rive and wired the state machine and JavaScript progression."), link("comic-live", "", "OPEN LIVE COMIC ↗", "https://daedalus.am/comic")] });
add("daedalus-brand", "BRAND.DIR", "Brand, merchandise and physical-output experiments with collaborator credits.", { parentId: "daedalus", category: "DESIGN", thumbnail: "Daedalus/Brand/dribbble-test-maze.mp4" });
add("daedalus-film", "FILM.DIR", "The finished Daedalus Alpha short film and early live-action concept material.", { parentId: "daedalus", category: "FILM", thumbnail: "Daedalus/Film/Intro-daedalus-concept.mp4", blocks: [youtube("alpha-film", "youtube-daedalus-alpha-film", "DAEDALUS ALPHA"), visual("alpha-concept", "Daedalus/Film/Intro-daedalus-concept.mp4", "full", "EARLY CONCEPT / PRE-PRODUCTION")] });
add("daedalus-bts", "BEHIND_THE_SCENES.DIR", "A one-minute behind-the-scenes look at the production of Daedalus Alpha.", { parentId: "daedalus", category: "FILM", blocks: [youtube("alpha-bts", "youtube-daedalus-alpha-bts", "DAEDALUS ALPHA — BEHIND THE SCENES")] });

const miniProjects = [
  ["void-overdrive", "VOID_OVERDRIVE", "prototypes", "VoidOverdrive/VO_Thumbnail.mp4", "An earlier hoverbike game prototype preserved through environment, character, sound and visualization studies.", ["VoidOverdrive/VO_Thumbnail.mp4", "VoidOverdrive/vo_visualization_test.mp4", "VoidOverdrive/VO_character_test.mp4", "VoidOverdrive/VO_Unreal_testing-hoverbike.mp4", "VoidOverdrive/void-overdrive-cliff-descent.mp4", "VoidOverdrive/void-overdrive-desert-outpost.jpg", "VoidOverdrive/void-overdrive-desert-pillar-run.jpg", "VoidOverdrive/voidoverdrive-sfx-test.mp4", "VoidOverdrive/voidoverdrive_sfx_test_2.mp4", "VoidOverdrive/cantgetout.mp4"]],
  ["project-hypno", "PROJECT_HYPNO", "prototypes", "Prototypes/ProjectHypno/project_hypno_thumb.mp4", "A roughly one-week concept focused on visual atmosphere, spatial anomaly and sound.", ["Prototypes/ProjectHypno/project_hypno_thumb.mp4", "Prototypes/ProjectHypno/aesthetics-10k.mp4", "Prototypes/ProjectHypno/project_hypno_gondolla_atnight.mp4", "Prototypes/ProjectHypno/project_hypno_spacial_anomaly.mp4", "Prototypes/ProjectHypno/project_hypno_sound_desing.mp4", "Prototypes/ProjectHypno/project_hypno_intro.mp4"]],
  ["project-sunshine", "PROJECT_SUNSHINE", "prototypes", "Prototypes/ProjectSunshine/project_sunshine_trailer_mockup.mp4", "A one-week game concept pushed far enough to test whether the idea had somewhere interesting to go.", ["Prototypes/ProjectSunshine/project_sunshine_trailer_mockup.mp4"]],
  ["mighty-pebble", "MIGHTY_PEBBLE", "prototypes", "Prototypes/MightyPebble/mighty-pebble-building-system-test.mp4", "A building and nighttime resource-system prototype; premise and role still need verification.", ["Prototypes/MightyPebble/mighty-pebble-building-system-test.mp4", "Prototypes/MightyPebble/mighty-pebble-night-resource-test.mp4"]],
  ["mattercraft", "MATTERCRAFT", "prototypes", "Prototypes/MatterCraft/Mattercraft_gameplay.mp4", "A gameplay prototype; premise and role still need verification.", ["Prototypes/MatterCraft/Mattercraft_gameplay.mp4"]],
  ["spacekeeper", "SPACEKEEPER", "prototypes", "Prototypes/SpaceKeeper/spacekeeper_week1progress.mp4", "A week-one prototype showing the hypothesis and early process.", ["Prototypes/SpaceKeeper/spacekeeper_week1progress.mp4"]],
  ["fox-stories", "FOX_STORIES", "prototypes", "Prototypes/FoxStories/ChristmasDemoWITH_fireworks.mp4", "A small playable demo preserved as a prototype artifact; context still needs verification.", ["Prototypes/FoxStories/ChristmasDemoWITH_fireworks.mp4"]],
  ["kcd-combat", "KCD_COMBAT", "prototypes", "Prototypes/KCD_Combat/kcd-combat-prototype-gameplay.mp4", "A combat interaction prototype; the exact design question still needs to be documented.", ["Prototypes/KCD_Combat/kcd-combat-prototype-gameplay.mp4"]],
  ["level-design", "LEVEL_DESIGN", "prototypes", "Prototypes/LevelDesign/first-person-graybox-level-test.mp4", "A first-person graybox level exercise preserved with its test footage.", ["Prototypes/LevelDesign/first-person-graybox-level-test.mp4"]],
];
for (const [id, title, parentId, thumbnail, description, paths] of miniProjects) add(id, `${title}.DIR`, description, { parentId, category: "EXPERIMENT", thumbnail, blocks: [visual(`${id}-hero`, paths[0], "full", title), text(`${id}-context`, "WHAT THIS TESTED", description), ...paths.slice(1).map((path, i) => visual(`${id}-${i + 1}`, path, "half"))] });
projects.find((project) => project.id === "void-overdrive").showOnRoot = true;
projects.find((project) => project.id === "project-sunshine").blocks.unshift(youtube("sunshine-youtube", "youtube-project-sunshine", "TRAILER MOCKUP"));
projects.find((project) => project.id === "project-hypno").blocks.unshift(youtube("hypno-youtube", "youtube-project-hypno", "PROJECT INTRO"));

add("moving-on-express", "MOVING_ON_EXPRESS", "My first game, made in one week with Unity, Bolt and MagicaVoxel; soundtrack by CillianCreates.", { parentId: "game-jams", category: "GAME JAM", thumbnail: "Graphics/3DPractice/movingonexpress.webp", blocks: [youtube("moe-gameplay", "youtube-moving-on-express", "MY FIRST GAME, MADE IN ONE WEEK"), text("moe-story", "LEARNING BY SHIPPING", "This was my first game and my first time using Unity, Bolt and MagicaVoxel. I did almost everything from game design through mechanical and technical implementation; the soundtrack was by CillianCreates."), visual("moe-still", "Graphics/3DPractice/movingonexpress.webp", "full"), link("moe-itch", "", "PLAY ON ITCH.IO ↗", "https://eloquent.itch.io/movingonexpress"), link("moe-jam", "", "VIEW JAM SUBMISSION ↗", "https://itch.io/jam/bolt-jam-6/rate/467497")] });
add("loooop", "LOOOOP.GAME", "A second jam game about managing a dying world’s temperature from orbit while defending it from debris.", { parentId: "game-jams", category: "GAME JAM", state: "SHIPPED / MEDIA RECOVERY NEEDED", blocks: [text("loooop-story", "SECOND JAM GAME", "After Moving On Express taught me how to get something running at all, LOOOOP was about making a smaller system feel deliberate. It won Bolt Jam #7 overall and placed first for aesthetics and use of Bolt."), link("loooop-itch", "", "PLAY ON ITCH.IO ↗", "https://eloquent.itch.io/loooop"), link("loooop-jam", "", "VIEW JAM RESULTS ↗", "https://itch.io/jam/bolt-jam-7/rate/518338")] });
add("fell-out-shortcut", "FELL_OUT.LNK", "Shortcut to the original Fell Out game-jam page inside Lightkeeper history.", { parentId: "game-jams", category: "GAME JAM", blocks: [projectLink("fell-out-target", "fell-out-gamejam", "OPEN FELL_OUT.GAMEJAM/")] });

const appPages = [
  ["game-designer", "GAME_DESIGNER", "Apps/GameDesigner/GameDesignerOverview_sub.mp4", "An experimental tool for representing mechanics, dependencies and loops spatially instead of burying relationships in linear documents."],
  ["yesterday", "YESTERDAY", "Apps/Yesterday/yesterday-daily-planner-overview.png", "A daily-planning product exploration; exact role, year and product context still need verification."],
  ["midi-clip-builder", "MIDI_CLIP_BUILDER", "Apps/MidiClipBuilder/midi_clip_builder.mp4", "A MIDI workflow tool; exact problem, use case and implementation details still need verification."],
  ["sonilabs", "SONILABS", "Apps/Sonilabs/sonilabs-sound-library-and-assembler.png", "A sound-library and assembly interface; exact use case and role still need verification."],
];
for (const [id, title, thumbnail, description] of appPages) add(id, `${title}.APP`, description, { parentId: "apps", category: "APP", thumbnail, blocks: [visual(`${id}-hero`, thumbnail, "full", title, "", "contain"), text(`${id}-context`, "PRODUCT NOTE", description)] });

add("rise-above-disorder", "RISE_ABOVE_DISORDER", "Selected about and volunteer page work; exact UX/web role still needs verification.", { parentId: "client-work", category: "WEBSITE", thumbnail: "UX/RiseAboveDisorder/rise-above-disorder-about-page.webp", blocks: [visual("rad-about", "UX/RiseAboveDisorder/rise-above-disorder-about-page.webp", "half", "ABOUT PAGE", "", "contain"), visual("rad-volunteer", "UX/RiseAboveDisorder/rise-above-disorder-volunteer-page.webp", "half", "VOLUNTEER PAGE", "", "contain"), text("rad-credit", "ROLE / CREDITS", "Exact UX/web role still needs verification. Illustration work in the historical posts is credited to Vic/Bo."), link("rad-link-1", "", "OPEN ABOUT PAGE POST ↗", "https://dribbble.com/shots/15697795-Rise-Above-The-Disorder-About-Page"), link("rad-link-2", "", "OPEN SUPPORT PAGE POST ↗", "https://dribbble.com/shots/15713859-Rise-Above-The-Disorder-Give-Support")] });
add("earthwallet", "EARTHWALLET", "A compact artifact page pending verification of personal role and full team credits.", { parentId: "client-work", category: "DESIGN", thumbnail: "Graphics/EarthWallet_Brand.webp", blocks: [visual("earth-brand", "Graphics/EarthWallet_Brand.webp", "full", "BRAND", "", "contain"), visual("earth-logo", "Graphics/Brand/EarthWallet_logo.webp", "full", "LOGO", "", "contain"), text("earth-role", "DRAFT PENDING ROLE", "The broader agency work involved multiple designers. Exact personal contribution must be confirmed before this becomes a case study.")] });
add("yogajoint", "YOGAJOINt.RECOVER", "A 2021 mobile-app exploration for live online yoga classes; local media still needs recovery.", { parentId: "client-work", category: "APP", state: "RECOVERY NEEDED", blocks: [text("yoga-context", "RECOVERY NOTE", "In 2021 I worked with Unfold and YogaJoint exploring designs for live online yoga classes. The exploration ran for a few weeks before cleanup and production."), link("yoga-history", "", "OPEN HISTORICAL POST ↗", "https://dribbble.com/shots/23277016-YogaJoint-Mobile-App-Explorations")] });
add("userwise-shortcut", "USERWISE.LNK", "Shortcut to the UserWise product case study.", { parentId: "client-work", category: "DESIGN", blocks: [projectLink("userwise-target", "userwise", "OPEN USERWISE.PRODUCT/")] });

const visualPages = [
  ["visual-3d-practice", "3D_PRACTICE", "Graphics/3DPractice/fujifilm-timelapse-100x.mp4", "Finals, Blender views and timelapses from 3D practice."],
  ["mountain-graphs", "MOUNTAIN_GRAPHS", "Graphics/mountaingraphs_final_03.mp4", "Five motion studies presented as one progression from beginning to final."],
  ["vrx-iiv", "VRX_IIV", "Graphics/VRX_IIV_Virtual RealityMeta Spaces.mp4", "A fictional VR/metaspace narrative experiment that points back toward Daedalus."],
  ["worlds-apart", "WORLDS_APART", "Graphics/Worlds_Apart_Inc_TransdimensionalArchitectureFirm.mp4", "A fictional transdimensional architecture-firm exercise conceptualized, designed and animated in roughly two hours."],
  ["figmagram", "FIGMAGRAM", "Graphics/figmagram-experience-more-promo.mp4", "A Figma prototype using Unfold’s SkewDat plugin for 3D/polaroid movement."],
  ["acid-wave", "ACID_WAVE", "Graphics/acid-wave-animation.mp4", "A compact motion artifact."],
  ["pill-button", "PILL_BUTTON", "Graphics/pill_button.mp4", "A small interaction and visual-state study."],
  ["brand-bits", "BRAND_BITS", "Graphics/Brand/wanderstar_logo.webp", "Small identity artifacts that do not need inflated case studies."],
];
for (const [id, title, thumbnail, description] of visualPages) add(id, `${title}.DIR`, description, { parentId: "visual-lab", category: "DESIGN", thumbnail, blocks: [visual(`${id}-hero`, thumbnail, "full", title), text(`${id}-context`, "CONTEXT", description), ...(id === "worlds-apart" ? [youtube("worlds-process", "youtube-worlds-apart", "PROCESS TIMELAPSE"), link("worlds-history", "", "OPEN HISTORICAL POST ↗", "https://dribbble.com/shots/19895408-Worlds-Apart-Inc-Transdimensional-Architecture-Firm")] : []), ...(id === "vrx-iiv" ? [link("vrx-history", "", "OPEN HISTORICAL POST ↗", "https://dribbble.com/shots/19905406-VRX-IIV-Virtual-Reality-Meta-Spaces")] : []), ...(id === "figmagram" ? [link("figma-history", "", "OPEN HISTORICAL POST ↗", "https://dribbble.com/shots/15198563-Figmagram")] : [])] });

const existingIds = new Set(projects.map((project) => project.id));
const archiveOwners = [...new Set(media.filter((item) => item.sourcePath).map((item) => item.projectId))].filter((id) => existingIds.has(id));
for (const owner of archiveOwners) {
  const archiveId = `${owner}-archive`;
  add(archiveId, "ARCHIVE.DIR", "Every local image, video and document assigned to this project.", { parentId: owner, category: projects.find((p) => p.id === owner)?.category || "EXPERIMENT", showOverview: false });
  for (const item of media.filter((candidate) => candidate.sourcePath && candidate.projectId === owner)) {
    const isPdf = item.type === "pdf";
    add(`file-${item.id}`, `${item.title.toUpperCase().replaceAll(" ", "_")}.${isPdf ? "PDF" : item.type === "video" ? "VIDEO" : "IMAGE"}`, item.credits || item.caption || `${item.type.toUpperCase()} archive artifact.`, {
      parentId: archiveId, layout: isPdf ? "text-window" : "media-fullscreen", category: projects.find((p) => p.id === owner)?.category || "EXPERIMENT",
      sourceType: item.type === "video" ? "video" : "image", mediaRef: item.id, thumbnail: "", showOverview: false, showFolderActions: false,
      blocks: isPdf ? [link(`${slug(item.title)}-open`, item.title, "OPEN PDF ↗", item.sourcePath, `Local source document — ${(item.fileSize / 1048576).toFixed(1)} MB. Replace with a hosted document link when ready.`)] : [],
    });
  }
}

for (const preview of oldMedia.filter((item) => item.id?.startsWith("preview-"))) {
  if (!media.some((item) => item.id === preview.id)) media.push(preview);
}
for (const project of projects) {
  const previous = oldProjects.find((item) => item.id === project.id);
  if (previous?.thumbnailMediaRef?.startsWith("preview-") && media.some((item) => item.id === previous.thumbnailMediaRef)) {
    project.thumbnail = "";
    project.thumbnailMediaRef = previous.thumbnailMediaRef;
    project.thumbnailType = "video";
  }
}

await writeFile(mediaPath, `${JSON.stringify(media, null, 2)}\n`, "utf8");
await writeFile(projectsPath, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
await writeContentBundles(new URL("prototype/", root).pathname.replace(/^\/(.:)/, "$1"), projects, media);
console.log(`Imported ${projects.length} CMS nodes and ${media.length} canonical media records.`);

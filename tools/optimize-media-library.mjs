import { existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { optimizeMediaFile, optimizedFileName } from "./media-optimizer.mjs";
import { writeContentBundles } from "./content-bundles.mjs";

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolsDirectory, "..");
const siteRoot = join(repositoryRoot, "prototype");
const originalRoot = join(siteRoot, "assets", "media", "og-library", "Projects");
const optimizedRoot = join(siteRoot, "assets", "media", "optimized", "Projects");
const contentFiles = ["site.json", "projects.json", "media.json"].map((name) => join(siteRoot, "content", name));
const publicPrefix = "assets/media/Projects/";
const optimizedPrefix = "assets/media/optimized/Projects/";
const originalPrefix = "assets/media/og-library/Projects/";
const sourceStartTimes = new Map([
  ["KERN/prototype/kern_event_sound_test.mp4", 3.2],
]);

function normalized(value) {
  return String(value || "").replaceAll("\\", "/");
}

function optimizedRelativePath(source) {
  const relativePath = normalized(source).slice(publicPrefix.length);
  const directory = relativePath.includes("/") ? relativePath.slice(0, relativePath.lastIndexOf("/") + 1) : "";
  return `${directory}${optimizedFileName(relativePath.split("/").at(-1))}`;
}

function collectSources(value, found = new Set()) {
  if (typeof value === "string" && normalized(value).startsWith(publicPrefix)) found.add(normalized(value));
  else if (Array.isArray(value)) value.forEach((item) => collectSources(item, found));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectSources(item, found));
  return found;
}

function rewriteSources(value, mapping) {
  if (typeof value === "string") return mapping.get(normalized(value)) || value;
  if (Array.isArray(value)) return value.map((item) => rewriteSources(item, mapping));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteSources(item, mapping)]));
  }
  return value;
}

const documents = new Map();
for (const path of contentFiles) documents.set(path, JSON.parse(await readFile(path, "utf8")));
const sources = new Set();
for (const document of documents.values()) collectSources(document, sources);

if (!existsSync(originalRoot)) {
  throw new Error(`Original library not found at ${originalRoot}. Move the existing Projects folder there first.`);
}

const mapping = new Map();
const results = new Map();
let completed = 0;
for (const source of [...sources].sort()) {
  const sourceRelative = source.slice(publicPrefix.length);
  if (sourceRelative.toLowerCase().startsWith("to optimize and cut/")) continue;
  const originalPath = join(originalRoot, ...sourceRelative.split("/"));
  if (!existsSync(originalPath)) {
    console.warn(`Missing original: ${source}`);
    continue;
  }
  const optimizedRelative = optimizedRelativePath(source);
  const result = await optimizeMediaFile(originalPath, dirname(join(optimizedRoot, ...optimizedRelative.split("/"))), {
    fileName: optimizedRelative.split("/").at(-1),
    maxDuration: 18,
    startTime: sourceStartTimes.get(sourceRelative) || 0,
  });
  const optimizedSource = `${optimizedPrefix}${optimizedRelative}`;
  mapping.set(source, optimizedSource);
  results.set(optimizedSource, { ...result, originalSourcePath: `${originalPrefix}${sourceRelative}` });
  completed += 1;
  console.log(`[${completed}/${sources.size}] ${sourceRelative} -> ${relative(optimizedRoot, result.outputPath).split(sep).join("/")}${result.clipped ? " (18s cut)" : ""}`);
}

for (const [path, document] of documents) {
  const rewritten = rewriteSources(document, mapping);
  if (path.endsWith("media.json")) {
    for (const item of rewritten) {
      const result = results.get(item.sourcePath);
      if (!result) continue;
      item.originalSourcePath = result.originalSourcePath;
      item.fileSize = result.fileSize;
      if (item.type === "video") item.duration = result.outputDuration;
    }
  }
  documents.set(path, rewritten);
  await writeFile(path, `${JSON.stringify(rewritten, null, 2)}\n`, "utf8");
}

await writeContentBundles(siteRoot, documents.get(contentFiles[1]), documents.get(contentFiles[2]));
console.log(`Optimized ${completed} referenced originals. CMS content now uses ${optimizedPrefix}`);

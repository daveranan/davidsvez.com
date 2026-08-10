import { readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(new URL("../", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const prototypeRoot = join(repositoryRoot, "prototype");
const mediaPath = join(prototypeRoot, "content", "media.json");
const media = JSON.parse(await readFile(mediaPath, "utf8"));
let updated = 0;

for (const item of media) {
  if (item.sectionId !== "thumbnail" || !String(item.sourcePath || "").startsWith("assets/media/")) continue;
  try {
    const info = await stat(join(prototypeRoot, ...item.sourcePath.split("/")));
    if (item.fileSize === info.size) continue;
    item.fileSize = info.size;
    updated += 1;
  } catch {
    // Remote or temporarily unavailable thumbnails keep their existing metadata.
  }
}

await writeFile(mediaPath, `${JSON.stringify(media, null, 2)}\n`, "utf8");
console.log(`Updated ${updated} thumbnail size records.`);

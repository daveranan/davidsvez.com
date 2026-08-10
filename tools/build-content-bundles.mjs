import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { writeContentBundles } from "./content-bundles.mjs";

const siteDirectory = resolve("prototype");
const projects = JSON.parse(await readFile(resolve(siteDirectory, "content", "projects.json"), "utf8"));
const media = JSON.parse(await readFile(resolve(siteDirectory, "content", "media.json"), "utf8"));
const { index, pages } = await writeContentBundles(siteDirectory, projects, media);

console.log(`Built ${index.length} index entries and ${pages.length} project pages.`);

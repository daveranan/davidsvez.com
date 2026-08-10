import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

function resolveMedia(item, mediaById) {
  const media = mediaById.get(item?.mediaRef);
  if (!media) return { ...item };
  return {
    ...item,
    type: ["image", "video", "youtube", "vimeo"].includes(media.type) ? media.type : item.type,
    source: media.sourcePath || media.externalUrl || item.source || "",
    posterFrame: media.posterFrame || item.posterFrame || "",
    mediaWidth: Number(media.width) || Number(item.mediaWidth) || 0,
    mediaHeight: Number(media.height) || Number(item.mediaHeight) || 0,
    aspectRatio: media.aspectRatio || item.aspectRatio || "",
    alt: item.alt || media.alt || media.title || "",
    body: item.body || media.caption || media.credits || "",
  };
}

export function buildContentBundles(projects, media) {
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const index = projects.map((project) => {
    const thumbnailMedia = mediaById.get(project.thumbnailMediaRef);
    return {
      id: project.id,
      parentId: project.parentId || null,
      hidden: project.hidden === true,
      showOnRoot: project.showOnRoot === true,
      layout: project.layout,
      title: project.title,
      heading: project.heading,
      shortcutLabel: project.shortcutLabel,
      description: project.description,
      thumbnail: thumbnailMedia?.sourcePath || project.thumbnail || "",
      thumbnailType: thumbnailMedia?.type === "video" ? "video" : "image",
      posterFrame: thumbnailMedia?.posterFrame || "",
      sourceType: project.sourceType,
      category: project.category,
      period: project.period,
    };
  });

  const pages = projects.map((project) => {
    const resolved = resolveMedia(project, mediaById);
    const thumbnailMedia = mediaById.get(project.thumbnailMediaRef);
    return {
      ...resolved,
      thumbnail: thumbnailMedia?.sourcePath || project.thumbnail || "",
      thumbnailType: thumbnailMedia?.type === "video" ? "video" : project.thumbnailType,
      posterFrame: thumbnailMedia?.posterFrame || resolved.posterFrame || "",
      blocks: (project.blocks || []).map((block) => resolveMedia(block, mediaById)),
    };
  });
  return { index, pages };
}

export async function writeContentBundles(siteDirectory, projects, media) {
  const { index, pages } = buildContentBundles(projects, media);
  const contentDirectory = join(siteDirectory, "content");
  const pagesDirectory = join(contentDirectory, "projects");
  await mkdir(pagesDirectory, { recursive: true });
  await writeFile(join(contentDirectory, "projects-index.json"), `${JSON.stringify(index)}\n`, "utf8");
  await Promise.all(pages.map((page) => writeFile(join(pagesDirectory, `${page.id}.json`), `${JSON.stringify(page, null, 2)}\n`, "utf8")));
  const valid = new Set(pages.map((page) => `${page.id}.json`));
  for (const file of await readdir(pagesDirectory)) {
    if (file.endsWith(".json") && !valid.has(file)) await unlink(join(pagesDirectory, file));
  }
  return { index, pages };
}

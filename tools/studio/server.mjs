import http from "node:http";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { writeContentBundles } from "../content-bundles.mjs";
import { optimizeMediaFile } from "../media-optimizer.mjs";

const studioDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(studioDirectory, "..", "..");
const publicDirectory = join(studioDirectory, "public");
const siteDirectory = join(repositoryRoot, "prototype");
const contentPath = join(siteDirectory, "content", "site.json");
const projectsPath = join(siteDirectory, "content", "projects.json");
const mediaPath = join(siteDirectory, "content", "media.json");
const originalMediaDirectory = join(siteDirectory, "assets", "media", "og-library", "Projects");
const optimizedMediaDirectory = join(siteDirectory, "assets", "media", "optimized", "Projects");
const posterMediaDirectory = join(siteDirectory, "assets", "media", "posters");
const previewMediaDirectory = join(siteDirectory, "assets", "media", "project-previews");
const thumbnailMediaDirectory = join(siteDirectory, "assets", "media", "project-thumbnails");
const host = "127.0.0.1";
const port = Number(process.env.STUDIO_PORT || 4174);
const token = process.env.STUDIO_TOKEN || randomBytes(24).toString("hex");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
};

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function safePath(root, requestPath) {
  const resolved = resolve(root, requestPath.replace(/^[/\\]+/, ""));
  return resolved === root || resolved.startsWith(`${root}${sep}`) ? resolved : null;
}

async function serveFile(response, path) {
  try {
    const info = await stat(path);
    const filePath = info.isDirectory() ? join(path, "index.html") : path;
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch {
    json(response, 404, { error: "Not found" });
  }
}

async function readJsonBody(request, limit = 180 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Request is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normalizeCssSize(value, fallback, field, id) {
  const size = String(value || fallback).trim();
  if (!/^\d+(?:\.\d+)?(?:px|vw|vh|rem|ch|%)$/.test(size)) {
    throw new Error(`${id}: ${field} must be a number followed by px, vw, vh, rem, ch, or %`);
  }
  return size;
}

function youtubeVideoId(value) {
  const source = String(value || "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(source)) return source;

  try {
    const url = new URL(/^https?:\/\//i.test(source) ? source : `https://${source}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    if (host !== "youtube.com" && !host.endsWith(".youtube.com") && host !== "youtube-nocookie.com") return "";
    if (url.pathname === "/watch") return url.searchParams.get("v") || "";
    const [route, videoId] = url.pathname.split("/").filter(Boolean);
    return ["embed", "shorts", "live"].includes(route) ? videoId || "" : "";
  } catch {
    return "";
  }
}

function normalizeYouTubeSource(value, blockId) {
  const videoId = youtubeVideoId(value);
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw new Error(`${blockId}: enter a valid YouTube video link or video id`);
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function normalizeBlock(block, index, projectId) {
  const id = String(block.id || `block-${index + 1}`).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error(`${projectId}: block ${index + 1} needs a lowercase id`);
  }
  const type = String(block.type || "text").trim();
  const width = String(block.width || "full").trim();
  const fit = String(block.fit || "cover").trim();
  if (!["text", "image", "video", "youtube", "link", "project-link"].includes(type)) {
    throw new Error(`${projectId}/${id}: unsupported block type ${type}`);
  }
  if (!["full", "half", "third"].includes(width)) {
    throw new Error(`${projectId}/${id}: width must be full, half, or third`);
  }
  if (!["cover", "contain"].includes(fit)) {
    throw new Error(`${projectId}/${id}: fit must be cover or contain`);
  }
  const mediaRef = String(block.mediaRef || "").trim().toLowerCase();
  const rawSource = String(block.source || "").trim();
  const source = type === "youtube" && rawSource
    ? normalizeYouTubeSource(rawSource, `${projectId}/${id}`)
    : rawSource.replaceAll("\\", "/").replace(/^\/+/, "");
  if (["image", "video", "youtube"].includes(type) && !source && !mediaRef) {
    throw new Error(`${projectId}/${id}: media blocks need a source or media reference`);
  }
  return {
    id,
    type,
    width,
    heading: String(block.heading || "").trim(),
    body: String(block.body || ""),
    source,
    mediaRef,
    href: String(block.href || "").trim(),
    label: String(block.label || "").trim(),
    projectId: String(block.projectId || "").trim().toLowerCase(),
    alt: String(block.alt || "").trim(),
    fit,
  };
}

function normalizeProject(project, index) {
  const id = String(project.id || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error(`Project ${index + 1} needs a lowercase id using letters, numbers, or dashes`);
  }
  const layout = String(project.layout || "folder").trim();
  if (!["folder", "media-fullscreen", "text-window"].includes(layout)) {
    throw new Error(`${id}: unknown layout ${layout}`);
  }
  const required = ["title", "heading", "kind", "description", "sourceType"];
  required.forEach((field) => {
    if (!String(project[field] || "").trim()) throw new Error(`${id}: ${field} is required`);
  });
  if (!["image", "video"].includes(project.sourceType)) {
    throw new Error(`${id}: sourceType must be image or video`);
  }
  if (layout === "media-fullscreen" && !String(project.source || "").trim() && !String(project.mediaRef || "").trim()) {
    throw new Error(`${id}: fullscreen media needs a media source or media reference`);
  }
  const statuses = Array.isArray(project.status) ? project.status : [];
  const blocks = (Array.isArray(project.blocks) ? project.blocks : []).map((block, blockIndex) =>
    normalizeBlock(block, blockIndex, id),
  );
  const category = String(project.category || "EXPERIMENT").trim().toUpperCase();
  const categories = ["WEBSITE", "FILM", "GAME", "PRODUCTION", "TOOLS", "NARRATIVE", "DESIGN", "GAME JAM", "EXPERIMENT", "APP"];
  if (!categories.includes(category)) {
    throw new Error(`${id}: unknown project category ${category}`);
  }
  const thumbnailType = String(project.thumbnailType || "image").trim().toLowerCase();
  if (!["image", "video"].includes(thumbnailType)) {
    throw new Error(`${id}: thumbnailType must be image or video`);
  }
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) {
    throw new Error(`${id}: block ids must be unique`);
  }
  return {
    id,
    parentId: project.parentId ? String(project.parentId).trim().toLowerCase() : null,
    showOnRoot: project.showOnRoot === true,
    layout,
    windowWidth: normalizeCssSize(project.windowWidth, "704px", "windowWidth", id),
    windowHeight: normalizeCssSize(project.windowHeight, "462px", "windowHeight", id),
    textWidth: normalizeCssSize(project.textWidth, "62ch", "textWidth", id),
    body: String(project.body || ""),
    showOverview: project.showOverview !== false,
    showFolderActions: project.showFolderActions !== false,
    blocks,
    title: String(project.title).trim(),
    heading: String(project.heading).trim(),
    shortcutLabel: String(project.shortcutLabel || project.heading).trim(),
    kind: String(project.kind).trim(),
    description: String(project.description).trim(),
    thumbnail: String(project.thumbnail || "").replaceAll("\\", "/").replace(/^\/+/, ""),
    thumbnailMediaRef: String(project.thumbnailMediaRef || "").trim().toLowerCase(),
    thumbnailType,
    sourceType: project.sourceType,
    category,
    period: String(project.period || "").trim(),
    source: String(project.source || "").replaceAll("\\", "/").replace(/^\/+/, ""),
    mediaRef: String(project.mediaRef || "").trim().toLowerCase(),
    role: String(project.role || "DESIGN / DEVELOPMENT").trim(),
    state: String(project.state || "PREVIEW COMPLETE").trim(),
    route: String(project.route || `/PROJECT/${id.toUpperCase()}`).trim(),
    status: (statuses.length ? statuses : Array.from({ length: 4 }, (_, statusIndex) => `LOADING ${statusIndex + 1}/4`))
      .map((status) => String(status || "").trim())
      .filter(Boolean),
  };
}

function normalizeMediaItem(item, index) {
  const id = String(item.id || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`Media item ${index + 1} needs a lowercase id`);
  const type = String(item.type || "").trim().toLowerCase();
  if (!["image", "video", "youtube", "pdf", "link"].includes(type)) throw new Error(`${id}: unsupported media type ${type}`);
  const sourcePath = String(item.sourcePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
  const externalUrl = String(item.externalUrl || "").trim();
  if (!sourcePath && !externalUrl) throw new Error(`${id}: media needs a local source path or external URL`);
  return {
    id,
    type,
    title: String(item.title || id).trim(),
    caption: String(item.caption || ""),
    alt: String(item.alt || "").trim(),
    sourcePath,
    externalUrl,
    projectId: String(item.projectId || "").trim().toLowerCase(),
    sectionId: String(item.sectionId || "").trim().toLowerCase(),
    credits: String(item.credits || "").trim(),
    posterFrame: String(item.posterFrame || "").replaceAll("\\", "/").replace(/^\/+/, ""),
    originalSourcePath: String(item.originalSourcePath || "").replaceAll("\\", "/").replace(/^\/+/, ""),
    fullscreenEligible: item.fullscreenEligible !== false,
    fileSize: Number(item.fileSize) || 0,
    duration: Number(item.duration) || 0,
  };
}

function normalizeBlogPost(post, index) {
  const id = String(post.id || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error(`Blog post ${index + 1} needs a lowercase id using letters, numbers, or dashes`);
  }
  const title = String(post.title || "").trim();
  const date = String(post.date || "").trim();
  const summary = String(post.summary || "").trim();
  if (!title) throw new Error(`${id}: blog title is required`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${id}: blog date must use YYYY-MM-DD`);
  if (!summary) throw new Error(`${id}: blog summary is required`);
  const blocks = (Array.isArray(post.blocks) ? post.blocks : []).map((block, blockIndex) =>
    normalizeBlock(block, blockIndex, `blog-${id}`),
  );
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) {
    throw new Error(`${id}: blog block ids must be unique`);
  }
  return { id, title, date, summary, published: post.published !== false, blocks };
}

function normalizeHomepage(homepage) {
  const title = String(homepage?.title || "CHARACTER_MONITOR.EXE").trim();
  if (!title) throw new Error("Homepage window title is required");
  const blocks = (Array.isArray(homepage?.blocks) ? homepage.blocks : []).map((block, blockIndex) =>
    normalizeBlock(block, blockIndex, "homepage"),
  );
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) {
    throw new Error("Homepage block ids must be unique");
  }
  return {
    title,
    status: String(homepage?.status || "").trim(),
    blocks,
  };
}

function normalizeTransmissionLines(value, field, preserveWhitespace = false) {
  const lines = (Array.isArray(value) ? value : [])
    .map((line) => preserveWhitespace ? String(line || "") : String(line || "").trim())
    .filter((line) => line.trim().length > 0);
  if (!lines.length) throw new Error(`${field} needs at least one authored line`);
  return lines;
}

function normalizeTransmissionTiming(value, fallback, minimum, maximum, field) {
  const timing = Number(value ?? fallback);
  if (!Number.isFinite(timing) || timing < minimum || timing > maximum) {
    throw new Error(`${field} must be between ${minimum} and ${maximum} milliseconds`);
  }
  return Math.round(timing);
}

export function validateContent(content) {
  if (!content || !Array.isArray(content.projects) || !content.projects.length) {
    throw new Error("At least one project is required");
  }
  if (!Object.hasOwn(content, "blog") || !Object.hasOwn(content, "contact") || !Object.hasOwn(content, "homepage") || !Object.hasOwn(content, "transmissions")) {
    throw new Error("Studio payload is missing BLOG, CONTACT, HOMEPAGE, or TRANSMISSIONS data. Reload the Studio before saving.");
  }
  content.projects.forEach((project) => {
    const requiredFields = ["showOverview", "showFolderActions", "blocks", "category"];
    const missingFields = requiredFields.filter((field) => !Object.hasOwn(project, field));
    if (missingFields.length) {
      throw new Error(`${project.id || "project"}: stale Studio payload is missing ${missingFields.join(", ")}. Reload before saving.`);
    }
  });
  const projects = content.projects.map(normalizeProject);
  const media = (Array.isArray(content.media) ? content.media : []).map(normalizeMediaItem);
  if (new Set(media.map((item) => item.id)).size !== media.length) throw new Error("Media ids must be unique");
  const mediaIds = new Set(media.map((item) => item.id));
  projects.forEach((project) => {
    [project.mediaRef, project.thumbnailMediaRef, ...project.blocks.map((block) => block.mediaRef)]
      .filter(Boolean)
      .forEach((mediaRef) => {
        if (!mediaIds.has(mediaRef)) throw new Error(`${project.id}: unknown media reference ${mediaRef}`);
      });
  });
  if (new Set(projects.map((project) => project.id)).size !== projects.length) {
    throw new Error("Project ids must be unique");
  }
  const byId = new Map(projects.map((project) => [project.id, project]));
  projects.forEach((project) => {
    if (project.parentId && !byId.has(project.parentId)) {
      throw new Error(`${project.id}: parent folder ${project.parentId} does not exist`);
    }
    if (project.parentId && byId.get(project.parentId)?.layout !== "folder") {
      throw new Error(`${project.id}: parent ${project.parentId} must use the folder layout`);
    }
    const visited = new Set([project.id]);
    let parentId = project.parentId;
    while (parentId) {
      if (visited.has(parentId)) throw new Error(`${project.id}: folder hierarchy contains a cycle`);
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentId || null;
    }
  });
  const blog = (Array.isArray(content.blog) ? content.blog : []).map(normalizeBlogPost);
  if (new Set(blog.map((post) => post.id)).size !== blog.length) {
    throw new Error("Blog post ids must be unique");
  }
  const contact = {
    heading: String(content.contact?.heading || "CONTACT").trim(),
    intro: String(content.contact?.intro || "Tell me what you are making, breaking, or trying to understand.").trim(),
    availability: String(content.contact?.availability || "AVAILABLE FOR SELECT PROJECTS").trim(),
    location: String(content.contact?.location || "OKLAHOMA / REMOTE").trim(),
  };
  const homepage = normalizeHomepage(content.homepage);
  const transmissions = {
    header: normalizeTransmissionLines(content.transmissions?.header, "Header transmission", true),
    ego: normalizeTransmissionLines(content.transmissions?.ego, "EGO transmission"),
    shadow: normalizeTransmissionLines(content.transmissions?.shadow, "SHADOW transmission"),
    typingSpeed: normalizeTransmissionTiming(content.transmissions?.typingSpeed, 65, 10, 500, "Typing speed"),
    commaPause: normalizeTransmissionTiming(content.transmissions?.commaPause, 300, 0, 5000, "Comma pause"),
    sentencePause: normalizeTransmissionTiming(content.transmissions?.sentencePause, 1000, 0, 10000, "Sentence pause"),
    phrasePause: normalizeTransmissionTiming(content.transmissions?.phrasePause, 100, 0, 5000, "EGO / SHADOW phrase pause"),
  };
  return {
    site: {
      title: String(content.site?.title || "DAVID SVEZHINTSEV").trim(),
      status: String(content.site?.status || "INTERFACE EXPOSED").trim(),
    },
    transmissions,
    contact,
    homepage,
    blog,
    projects,
    media,
  };
}

async function saveContent(content) {
  const normalized = validateContent(content);
  await mkdir(dirname(contentPath), { recursive: true });
  const temporaryPath = `${contentPath}.tmp`;
  const temporaryProjectsPath = `${projectsPath}.tmp`;
  const temporaryMediaPath = `${mediaPath}.tmp`;
  const { projects, media, ...siteContent } = normalized;
  await writeFile(temporaryPath, `${JSON.stringify(siteContent, null, 2)}\n`, "utf8");
  await writeFile(temporaryProjectsPath, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
  await writeFile(temporaryMediaPath, `${JSON.stringify(media, null, 2)}\n`, "utf8");
  await rename(temporaryPath, contentPath);
  await rename(temporaryProjectsPath, projectsPath);
  await rename(temporaryMediaPath, mediaPath);
  await writeContentBundles(siteDirectory, projects, media);
  return normalized;
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim(),
  };
}

function gitStatus() {
  const branch = runGit(["branch", "--show-current"]);
  const remote = runGit(["remote", "get-url", "origin"]);
  const changes = runGit(["status", "--short", "--", "prototype/content", "prototype/assets/media/optimized", "prototype/assets/media/posters", "prototype/assets/media/project-previews", "prototype/assets/media/project-thumbnails"]);
  return {
    branch: branch.output || "unknown",
    remote: remote.ok ? remote.output : null,
    contentChanges: changes.output ? changes.output.split(/\r?\n/) : [],
  };
}

async function publishContent() {
  const remote = runGit(["remote", "get-url", "origin"]);
  if (!remote.ok) throw new Error("No Git remote named origin exists yet. Connect this repo to GitHub first.");
  const paths = ["prototype/content"];
  if (existsSync(optimizedMediaDirectory)) paths.push("prototype/assets/media/optimized");
  if (existsSync(posterMediaDirectory)) paths.push("prototype/assets/media/posters");
  if (existsSync(previewMediaDirectory)) paths.push("prototype/assets/media/project-previews");
  if (existsSync(thumbnailMediaDirectory)) paths.push("prototype/assets/media/project-thumbnails");
  const added = runGit(["add", "--", ...paths]);
  if (!added.ok) throw new Error(added.output || "Could not stage content");
  const hasChanges = runGit(["diff", "--cached", "--quiet"]);
  if (hasChanges.status === 0) return { published: false, message: "Nothing new to publish." };
  const committed = runGit(["commit", "-m", "content: update portfolio via studio"]);
  if (!committed.ok) throw new Error(committed.output || "Could not commit content");
  const branch = runGit(["branch", "--show-current"]);
  const pushed = runGit(["push", "origin", branch.output]);
  if (!pushed.ok) throw new Error(pushed.output || "Could not push content");
  return { published: true, message: pushed.output || `Pushed ${branch.output} to origin.` };
}

function authorized(requestUrl, request) {
  return request.headers["x-studio-token"] === token || requestUrl.searchParams.get("token") === token;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
  try {
    if (requestUrl.pathname.startsWith("/api/") && !authorized(requestUrl, request)) {
      json(response, 403, { error: "Studio token rejected" });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/health") {
      json(response, 200, { ok: true });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/content") {
      const content = JSON.parse(await readFile(contentPath, "utf8"));
      if (existsSync(projectsPath)) content.projects = JSON.parse(await readFile(projectsPath, "utf8"));
      if (existsSync(mediaPath)) content.media = JSON.parse(await readFile(mediaPath, "utf8"));
      json(response, 200, content);
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/status") {
      json(response, 200, gitStatus());
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/content") {
      json(response, 200, { content: await saveContent(await readJsonBody(request)) });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/upload") {
      const upload = await readJsonBody(request);
      const projectId = String(upload.projectId || "").toLowerCase();
      const fileName = String(upload.fileName || "").replace(/[^a-zA-Z0-9._-]/g, "-");
      if (!/^[a-z0-9][a-z0-9-]*$/.test(projectId) || !fileName) throw new Error("Invalid upload path");
      const originalDirectory = join(originalMediaDirectory, projectId);
      await mkdir(originalDirectory, { recursive: true });
      const parsedName = parse(fileName);
      let archivedFileName = fileName;
      let suffix = 2;
      while (existsSync(join(originalDirectory, archivedFileName))) {
        archivedFileName = `${parsedName.name}-${suffix}${parsedName.ext}`;
        suffix += 1;
      }
      const originalPath = safePath(originalDirectory, archivedFileName);
      if (!originalPath) throw new Error("Invalid original-media path");
      await writeFile(originalPath, Buffer.from(String(upload.base64 || ""), "base64"), { flag: "wx" });
      const optimizedDirectory = join(optimizedMediaDirectory, projectId);
      const optimized = await optimizeMediaFile(originalPath, optimizedDirectory, { fileName: archivedFileName, maxDuration: 18 });
      json(response, 200, {
        source: relative(siteDirectory, optimized.outputPath).split(sep).join("/"),
        originalSource: relative(siteDirectory, originalPath).split(sep).join("/"),
        fileSize: optimized.fileSize,
        duration: optimized.outputDuration,
        clipped: optimized.clipped,
      });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/publish") {
      json(response, 200, await publishContent());
      return;
    }

    if (requestUrl.pathname === "/site" || requestUrl.pathname === "/site/" || /^\/site\/project\/[^/]+\/?$/i.test(requestUrl.pathname)) {
      await serveFile(response, join(siteDirectory, "index.html"));
      return;
    }
    if (requestUrl.pathname.startsWith("/site/")) {
      const filePath = safePath(siteDirectory, requestUrl.pathname.slice(6));
      if (!filePath) throw new Error("Invalid site path");
      await serveFile(response, filePath);
      return;
    }
    if (/^\/project\/[^/]+\/?$/i.test(requestUrl.pathname)) {
      await serveFile(response, join(siteDirectory, "index.html"));
      return;
    }
    if (
      requestUrl.pathname === "/app.js"
      || requestUrl.pathname === "/styles.css"
      || requestUrl.pathname.startsWith("/assets/")
      || requestUrl.pathname.startsWith("/content/")
    ) {
      const filePath = safePath(siteDirectory, requestUrl.pathname);
      if (!filePath) throw new Error("Invalid site path");
      await serveFile(response, filePath);
      return;
    }

    const publicPath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname;
    const filePath = safePath(publicDirectory, publicPath);
    if (!filePath) throw new Error("Invalid studio path");
    await serveFile(response, filePath);
  } catch (error) {
    json(response, 400, { error: error.message || "Studio request failed" });
  }
});

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  server.listen(port, host, () => {
    console.log(`Portfolio Studio: http://${host}:${port}/?token=${token}`);
  });
}

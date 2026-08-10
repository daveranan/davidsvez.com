import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { writeContentBundles } from "./content-bundles.mjs";

const repositoryRoot = resolve(new URL("../", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const prototypeRoot = join(repositoryRoot, "prototype");
const projectsPath = join(prototypeRoot, "content", "projects.json");
const mediaPath = join(prototypeRoot, "content", "media.json");
const previewDirectory = join(prototypeRoot, "assets", "media", "project-previews");
const imagePreviewDirectory = join(prototypeRoot, "assets", "media", "project-thumbnails");
const posterDirectory = join(prototypeRoot, "assets", "media", "posters");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "davidsvez-previews-"));

const projects = JSON.parse(await readFile(projectsPath, "utf8"));
const media = JSON.parse(await readFile(mediaPath, "utf8"));
const byProjectId = new Map(projects.map((project) => [project.id, project]));
const byMediaId = new Map(media.map((item) => [item.id, item]));
await mkdir(previewDirectory, { recursive: true });
await mkdir(imagePreviewDirectory, { recursive: true });
await mkdir(posterDirectory, { recursive: true });

const youtubeCuts = {
  lightkeeper: ["_ROPRah7oxQ", 300, 308],
  "vertical-slice-2026": ["_ROPRah7oxQ", 300, 308],
  "lightkeeper-technical-test": ["mQxHtjzD3qc", 18, 26],
  "fell-out-gamejam": ["aMEF98GBWjc", 190, 198],
  "project-sunshine": ["H6Dubeaqhvo", 18, 26],
  "project-hypno": ["WIsTilxePUg", 18, 26],
  daedalus: ["U1zfTUhDk5E", 150, 158],
  "daedalus-film": ["U1zfTUhDk5E", 150, 158],
  "daedalus-bts": ["l9EgP_xHBI8", 18, 26],
};
const localStartTimes = {
  dronies: 74,
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, ...options });
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

async function downloadYoutubeCuts() {
  const sources = new Map();
  const unique = new Map(Object.values(youtubeCuts).map(([id, start, end]) => [id, { id, start, end }]));
  for (const { id, start, end } of unique.values()) {
    const outputTemplate = join(temporaryDirectory, `${id}.%(ext)s`);
    run("python", [
      "-m", "yt_dlp", "--no-warnings", "--quiet",
      "--download-sections", `*${start}-${end}`,
      "--force-keyframes-at-cuts",
      "-f", "best[height<=720]/best",
      "-o", outputTemplate,
      `https://www.youtube.com/watch?v=${id}`,
    ]);
    const downloaded = (await readdir(temporaryDirectory)).find((name) => name.startsWith(`${id}.`));
    if (!downloaded) throw new Error(`YouTube cut ${id} was not downloaded`);
    sources.set(id, join(temporaryDirectory, downloaded));
  }
  return sources;
}

function mediaSource(item) {
  if (!item?.sourcePath || item.sectionId === "thumbnail" || !["image", "video"].includes(item.type)) return null;
  return { path: join(prototypeRoot, item.sourcePath), type: item.type };
}

function sourceForProject(projectId, visited = new Set()) {
  if (visited.has(projectId)) return null;
  visited.add(projectId);
  const project = byProjectId.get(projectId);
  if (!project) return null;

  const directCandidates = [
    byMediaId.get(project.thumbnailMediaRef),
    byMediaId.get(project.mediaRef),
    ...(project.blocks || []).map((block) => byMediaId.get(block.mediaRef)),
  ].map(mediaSource).filter(Boolean);
  const directVideo = directCandidates.find((source) => source.type === "video");
  if (directVideo) return directVideo;
  if (directCandidates[0]) return directCandidates[0];

  for (const block of project.blocks || []) {
    if (block.type === "project-link" && block.projectId) {
      const linked = sourceForProject(block.projectId, new Set(visited));
      if (linked) return linked;
    }
  }

  const children = projects.filter((candidate) => candidate.parentId === projectId);
  const childSources = children.map((child) => sourceForProject(child.id, new Set(visited))).filter(Boolean);
  return childSources.find((source) => source.type === "video") || childSources[0] || null;
}

function probeDuration(path) {
  const value = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path]).trim());
  return Number.isFinite(value) ? value : 0;
}

function escapedDrawtext(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'").replaceAll("%", "\\%");
}

function encodePreview(project, source, outputPath, bitrate = 2400) {
  const common = [
    "-t", "5", "-an", "-c:v", "libx264", "-preset", "veryfast",
    "-b:v", `${bitrate}k`, "-minrate", `${bitrate}k`, "-maxrate", `${bitrate}k`, "-bufsize", `${bitrate * 2}k`,
    "-x264-params", "nal-hrd=cbr:force-cfr=1:filler=1", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", outputPath,
  ];
  let args;
  if (source?.type === "video") {
    const duration = probeDuration(source.path);
    const start = source.youtube ? 0 : source.start ?? Math.max(0, Math.min(duration * 0.18, Math.max(0, duration - 5.1)));
    args = ["-loglevel", "error", "-stream_loop", "-1", "-ss", start.toFixed(2), "-i", source.path, "-vf", "scale=640:360:force_original_aspect_ratio=increase,crop=640:360,fps=24,format=yuv420p", ...common];
  } else if (source?.type === "image") {
    args = ["-loglevel", "error", "-loop", "1", "-i", source.path, "-vf", "scale=720:405:force_original_aspect_ratio=increase,crop=720:405,zoompan=z='min(zoom+0.0008,1.04)':d=120:s=640x360:fps=24,format=yuv420p", ...common];
  } else {
    const title = escapedDrawtext(project.title || project.heading || project.id);
    const subtitle = escapedDrawtext(project.state || "ARCHIVE");
    const filter = `drawgrid=width=40:height=40:thickness=1:color=white@0.06,drawtext=fontfile='C\\:/Windows/Fonts/consola.ttf':text='${title}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2-12,drawtext=fontfile='C\\:/Windows/Fonts/consola.ttf':text='${subtitle}':fontcolor=white@0.55:fontsize=14:x=(w-text_w)/2:y=(h-text_h)/2+30,format=yuv420p`;
    args = ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=#111111:s=640x360:r=24:d=5", "-vf", filter, ...common];
  }
  run("ffmpeg", args);
}

function encodeImagePreview(source, outputPath) {
  run("ffmpeg", [
    "-loglevel", "error", "-i", source.path,
    "-vf", "scale=640:360:force_original_aspect_ratio=increase,crop=640:360",
    "-c:v", "libwebp", "-quality", "78", "-compression_level", "5", "-frames:v", "1", "-y", outputPath,
  ]);
}

try {
  const youtubeSources = await downloadYoutubeCuts();
  for (let index = 0; index < projects.length; index += 1) {
    const project = projects[index];
    const cut = youtubeCuts[project.id];
    let source = cut
      ? { path: youtubeSources.get(cut[0]), type: "video", youtube: true }
      : sourceForProject(project.id);
    if (source && localStartTimes[project.id] !== undefined) source = { ...source, start: localStartTimes[project.id] };
    const id = `preview-${project.id}`;
    const useVideoPreview = project.layout === "folder" || source?.type === "video" || !source;
    let record;
    if (useVideoPreview) {
      const fileName = `${project.id}.mp4`;
      const posterName = `${id}.jpg`;
      const outputPath = join(previewDirectory, fileName);
      encodePreview(project, source, outputPath);
      let fileSize = (await stat(outputPath)).size;
      if (fileSize < 1024 * 1024 || fileSize > 3 * 1024 * 1024) {
        encodePreview(project, source, outputPath, fileSize < 1024 * 1024 ? 2800 : 1800);
        fileSize = (await stat(outputPath)).size;
      }
      run("ffmpeg", ["-loglevel", "error", "-ss", "0.1", "-i", outputPath, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", "-y", join(posterDirectory, posterName)]);
      record = {
        id, type: "video", title: `${project.title} preview`, caption: "Five-second silent project preview.", alt: `${project.heading || project.title} preview`,
        sourcePath: `assets/media/project-previews/${fileName}`, externalUrl: "", projectId: project.id, sectionId: "thumbnail", credits: "",
        posterFrame: `assets/media/posters/${posterName}`, fullscreenEligible: false, fileSize,
      };
    } else {
      const fileName = `${project.id}.webp`;
      const outputPath = join(imagePreviewDirectory, fileName);
      encodeImagePreview(source, outputPath);
      const fileSize = (await stat(outputPath)).size;
      record = {
        id, type: "image", title: `${project.title} thumbnail`, caption: "Lightweight project thumbnail.", alt: `${project.heading || project.title} thumbnail`,
        sourcePath: `assets/media/project-thumbnails/${fileName}`, externalUrl: "", projectId: project.id, sectionId: "thumbnail", credits: "",
        posterFrame: "", fullscreenEligible: false, fileSize,
      };
    }
    const existingIndex = media.findIndex((item) => item.id === id);
    if (existingIndex >= 0) media[existingIndex] = record;
    else media.push(record);
    byMediaId.set(id, record);
    project.thumbnail = "";
    project.thumbnailMediaRef = id;
    project.thumbnailType = record.type;
    if ((index + 1) % 20 === 0 || index === projects.length - 1) console.log(`Generated ${index + 1}/${projects.length} project thumbnails`);
  }

  await writeFile(projectsPath, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
  await writeFile(mediaPath, `${JSON.stringify(media, null, 2)}\n`, "utf8");
  await writeContentBundles(prototypeRoot, projects, media);
  const videoProjects = projects.filter((project) => byMediaId.get(project.thumbnailMediaRef)?.type === "video");
  const sizes = await Promise.all(videoProjects.map((project) => stat(join(previewDirectory, `${project.id}.mp4`)).then((info) => info.size)));
  const invalid = sizes.filter((size) => size < 1024 * 1024 || size > 3 * 1024 * 1024);
  console.log(`Completed ${projects.length} thumbnails (${videoProjects.length} video); ${(Math.min(...sizes) / 1048576).toFixed(2)}–${(Math.max(...sizes) / 1048576).toFixed(2)} MB; ${invalid.length} video previews outside target.`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

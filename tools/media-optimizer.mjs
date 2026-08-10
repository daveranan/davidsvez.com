import { existsSync } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { extname, join, parse } from "node:path";
import { spawnSync } from "node:child_process";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".avi"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".jfif", ".webp", ".bmp", ".tif", ".tiff"]);
const COPY_EXTENSIONS = new Set([".svg", ".gif", ".pdf"]);

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  }
  return String(result.stdout || "").trim();
}

export function optimizedFileName(fileName) {
  const file = parse(fileName);
  const extension = extname(fileName).toLowerCase();
  if (VIDEO_EXTENSIONS.has(extension)) return `${file.name}.mp4`;
  if (IMAGE_EXTENSIONS.has(extension)) return `${file.name}.webp`;
  return fileName;
}

export function probeDuration(sourcePath) {
  if (!VIDEO_EXTENSIONS.has(extname(sourcePath).toLowerCase())) return 0;
  const duration = Number(run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", sourcePath,
  ]));
  return Number.isFinite(duration) ? duration : 0;
}

export async function optimizeMediaFile(sourcePath, outputDirectory, options = {}) {
  const extension = extname(sourcePath).toLowerCase();
  const outputName = optimizedFileName(options.fileName || parse(sourcePath).base);
  const outputPath = join(outputDirectory, outputName);
  const temporaryPath = join(outputDirectory, `.${parse(outputName).name}-${process.pid}-${Date.now()}.tmp${extname(outputName)}`);
  await mkdir(outputDirectory, { recursive: true });

  let duration = 0;
  let clipped = false;
  try {
    if (VIDEO_EXTENSIONS.has(extension)) {
      duration = probeDuration(sourcePath);
      const maxDuration = Number(options.maxDuration || 18);
      const startTime = Math.max(0, Number(options.startTime || 0));
      const availableDuration = Math.max(0, duration - startTime);
      clipped = availableDuration > 30;
      const args = ["-hide_banner", "-loglevel", "error"];
      if (startTime > 0) args.push("-ss", String(startTime));
      args.push("-i", sourcePath);
      if (clipped) args.push("-t", String(maxDuration));
      args.push(
        "-an",
        "-vf", "scale='min(1280,iw)':-2:flags=lanczos,fps='min(30,source_fps)',format=yuv420p",
        "-c:v", "libx264", "-preset", "medium", "-crf", "24",
        "-profile:v", "high", "-level", "4.1",
        "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
        "-movflags", "+faststart", "-y", temporaryPath,
      );
      run("ffmpeg", args);
    } else if (IMAGE_EXTENSIONS.has(extension)) {
      run("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-i", sourcePath,
        "-vf", "scale='min(1920,iw)':-2:flags=lanczos",
        "-frames:v", "1", "-c:v", "libwebp", "-quality", "80",
        "-compression_level", "5", "-y", temporaryPath,
      ]);
    } else if (COPY_EXTENSIONS.has(extension)) {
      run("ffmpeg", ["-version"]);
      const { copyFile } = await import("node:fs/promises");
      await copyFile(sourcePath, temporaryPath);
    } else {
      throw new Error(`Unsupported media format: ${extension || "no extension"}`);
    }

    if (existsSync(outputPath)) await unlink(outputPath);
    await rename(temporaryPath, outputPath);
  } catch (error) {
    if (existsSync(temporaryPath)) await unlink(temporaryPath).catch(() => {});
    throw error;
  }

  const info = await stat(outputPath);
  return {
    outputName,
    outputPath,
    fileSize: info.size,
    duration,
    outputDuration: clipped
      ? Number(options.maxDuration || 18)
      : Math.max(0, duration - Math.max(0, Number(options.startTime || 0))),
    clipped,
  };
}

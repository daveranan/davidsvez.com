$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\prototype\assets\media\optimized\Projects")
$posterRoot = Join-Path (Split-Path $projectRoot -Parent) "posters"
New-Item -ItemType Directory -Force -Path $posterRoot | Out-Null

$videos = Get-ChildItem -LiteralPath $projectRoot -Recurse -File | Where-Object {
  $_.Extension.ToLowerInvariant() -in ".mp4", ".mov", ".webm"
}

foreach ($video in $videos) {
  $relative = $video.FullName.Substring($projectRoot.Path.Length + 1).Replace("\", "/")
  $id = "media-" + (($relative.ToLowerInvariant() -replace "[^a-z0-9]+", "-").Trim("-"))
  $target = Join-Path $posterRoot "$id.jpg"
  if (Test-Path -LiteralPath $target) { continue }
  & ffmpeg -loglevel error -ss 0.15 -i $video.FullName -frames:v 1 -vf "scale='min(1280,iw)':-2" -q:v 4 -y $target
  if ($LASTEXITCODE -ne 0) { Write-Warning "Could not extract poster: $relative" }
}

Write-Output "Generated poster frames for $($videos.Count) videos in $posterRoot"

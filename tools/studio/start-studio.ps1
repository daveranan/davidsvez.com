$ErrorActionPreference = "Stop"

$studioDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = Resolve-Path (Join-Path $studioDirectory "..\..")
$serverPath = Join-Path $studioDirectory "server.mjs"
$studioPort = 4174
$tokenFile = Join-Path $env:TEMP "davidsvez-portfolio-studio-token.txt"

function Test-Studio([string]$candidateToken) {
  if (-not $candidateToken) { return $false }
  try {
    $healthUrl = "http://127.0.0.1:$studioPort/api/health?token=$candidateToken"
    $response = Invoke-WebRequest -UseBasicParsing $healthUrl -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

$studioToken = if (Test-Path -LiteralPath $tokenFile) {
  (Get-Content -LiteralPath $tokenFile -Raw).Trim()
} else {
  ""
}

if (-not (Test-Studio $studioToken)) {
  $listener = Get-NetTCPConnection `
    -LocalAddress "127.0.0.1" `
    -LocalPort $studioPort `
    -State Listen `
    -ErrorAction SilentlyContinue | Select-Object -First 1

  if ($listener) {
    $listenerProcess = Get-CimInstance Win32_Process `
      -Filter "ProcessId=$($listener.OwningProcess)" `
      -ErrorAction SilentlyContinue
    $isPortfolioStudio = $listenerProcess `
      -and $listenerProcess.Name -eq "node.exe" `
      -and $listenerProcess.CommandLine -match "tools[\\/]studio[\\/]server\.mjs|server\.mjs"

    if (-not $isPortfolioStudio) {
      throw "Port $studioPort is already used by another application."
    }

    Stop-Process -Id $listener.OwningProcess -Force
    for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
      Start-Sleep -Milliseconds 100
      $stillListening = Get-NetTCPConnection `
        -LocalAddress "127.0.0.1" `
        -LocalPort $studioPort `
        -State Listen `
        -ErrorAction SilentlyContinue
      if (-not $stillListening) { break }
    }
  }

  $studioToken = [guid]::NewGuid().ToString("N")
  Set-Content -LiteralPath $tokenFile -Value $studioToken -NoNewline
  $escapedServer = $serverPath.Replace("'", "''")
  $launchCommand = "`$env:STUDIO_TOKEN='$studioToken'; `$env:STUDIO_PORT='$studioPort'; node '$escapedServer'"
  Start-Process powershell.exe `
    -ArgumentList @("-NoProfile", "-WindowStyle", "Hidden", "-Command", $launchCommand) `
    -WorkingDirectory $repositoryRoot `
    -WindowStyle Hidden

  $ready = $false
  for ($attempt = 0; $attempt -lt 24; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-Studio $studioToken) {
      $ready = $true
      break
    }
  }
  if (-not $ready) {
    throw "Portfolio Studio did not start on http://127.0.0.1:$studioPort"
  }
}

Start-Process "http://127.0.0.1:$studioPort/?token=$studioToken"

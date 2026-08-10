param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$prototypeRoot = $PSScriptRoot
$prototypeServer = Join-Path $prototypeRoot "dev-server.py"
$prototypePort = 4173

function Get-PrototypeServerState([int]$Port) {
    $url = "http://127.0.0.1:$Port/"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
        $isPortfolioServer = $response.StatusCode -eq 200 -and
            $response.Headers["X-ASCII-Portfolio-Lab"] -eq "no-cache"
        return [pscustomobject]@{ Available = $true; IsPortfolioServer = $isPortfolioServer }
    }
    catch {
        return [pscustomobject]@{ Available = $false; IsPortfolioServer = $false }
    }
}

function Get-PythonLaunch {
    $pythonCommand = Get-Command "python" -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        return [pscustomobject]@{ FilePath = $pythonCommand.Source; PrefixArguments = @() }
    }

    $pythonLauncher = Get-Command "py" -ErrorAction SilentlyContinue
    if ($pythonLauncher) {
        return [pscustomobject]@{ FilePath = $pythonLauncher.Source; PrefixArguments = @("-3") }
    }

    $bundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
    if (Test-Path -LiteralPath $bundledPython) {
        return [pscustomobject]@{ FilePath = $bundledPython; PrefixArguments = @() }
    }

    return $null
}

$serverState = Get-PrototypeServerState $prototypePort
if ($serverState.Available -and -not $serverState.IsPortfolioServer) {
    foreach ($candidatePort in 4174..4183) {
        $candidateState = Get-PrototypeServerState $candidatePort
        if ($candidateState.IsPortfolioServer) {
            $prototypePort = $candidatePort
            $serverState = $candidateState
            break
        }
        if (-not $candidateState.Available) {
            $prototypePort = $candidatePort
            $serverState = $candidateState
            break
        }
    }
}

if (-not $serverState.IsPortfolioServer) {
    $pythonLaunch = Get-PythonLaunch

    if (-not $pythonLaunch) {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show(
            "Python was not found. Install Python or run another static file server in the prototype directory.",
            "ASCII Portfolio Lab"
        ) | Out-Null
        exit 1
    }

    $serverArguments = @($pythonLaunch.PrefixArguments) + @(
        $prototypeServer,
        "--port", "$prototypePort",
        "--directory", $prototypeRoot
    )
    Start-Process `
        -FilePath $pythonLaunch.FilePath `
        -ArgumentList $serverArguments `
        -WorkingDirectory $prototypeRoot `
        -WindowStyle Hidden

    for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
        Start-Sleep -Milliseconds 150
        $serverState = Get-PrototypeServerState $prototypePort
        if ($serverState.IsPortfolioServer) {
            break
        }
    }
}

$launchToken = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$prototypeUrl = "http://127.0.0.1:$prototypePort/?launch=$launchToken"
if ($NoBrowser) {
    Write-Output $prototypeUrl
}
else {
    Start-Process $prototypeUrl
}

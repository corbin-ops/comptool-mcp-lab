param(
    [switch]$PauseOnExit
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DistDir = Join-Path $ProjectRoot "dist"

function Write-Section {
    param([string]$Message)

    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Section $Name
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    & $Action
    $timer.Stop()
    Write-Host "Done in $([math]::Round($timer.Elapsed.TotalSeconds, 1))s" -ForegroundColor Green
}

function Build-ExtensionZip {
    $extensionDir = Join-Path $ProjectRoot "extension"
    $manifestPath = Join-Path $extensionDir "manifest.json"

    if (-not (Test-Path $manifestPath)) {
        Write-Host "No extension manifest found. Skipping extension package." -ForegroundColor Yellow
        return
    }

    if (-not (Test-Path $DistDir)) {
        New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
    }

    $manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
    $zipPath = Join-Path $DistDir "comptoolv2-extension-$($manifest.version).zip"

    if (Test-Path $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }

    Push-Location $extensionDir
    try {
        Compress-Archive `
            -Path "manifest.json", "background.js", "content.js", "page-kml-bridge.js", "icons" `
            -DestinationPath $zipPath `
            -CompressionLevel Optimal
    }
    finally {
        Pop-Location
    }

    Write-Host "Extension package: $zipPath"
}

try {
    Push-Location $ProjectRoot

    Write-Host "DewClaw CompTool MCP Lab compile" -ForegroundColor White
    Write-Host "Project: $ProjectRoot"

    Invoke-Step "Checking Node" {
        node -v
        npm -v
    }

    if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
        Invoke-Step "Installing dependencies" {
            npm install
        }
    }
    else {
        Write-Section "Dependencies"
        Write-Host "node_modules found. Skipping npm install."
    }

    Invoke-Step "Rebuilding DewClaw corpus" {
        npm run build:comp-corpus
    }

    Invoke-Step "Running TypeScript check" {
        npm run typecheck
    }

    Invoke-Step "Building web app" {
        npm run build
    }

    Invoke-Step "Packaging Chrome extension" {
        Build-ExtensionZip
    }

    Write-Host ""
    Write-Host "Compile complete." -ForegroundColor Green
    Write-Host "Web build: .next"
    Write-Host "Extension zip: dist"
}
catch {
    Write-Host ""
    Write-Host "Compile failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location

    if ($PauseOnExit) {
        Write-Host ""
        Read-Host "Press Enter to close"
    }
}

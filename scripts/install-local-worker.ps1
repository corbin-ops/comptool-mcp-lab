$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$WorkerDir = Join-Path $RootDir "local-worker"
$EnvPath = Join-Path $WorkerDir ".env"
$EnvExamplePath = Join-Path $WorkerDir ".env.example"
$StartCmdPath = Join-Path $RootDir "Start CompTool Local Worker.cmd"

function Test-CommandExists {
  param([Parameter(Mandatory = $true)][string]$Name)

  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-EnvFileValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Key
  )

  if (-not (Test-Path $Path)) {
    return ""
  }

  $line = Get-Content $Path | Where-Object { $_ -match "^$([regex]::Escape($Key))=" } | Select-Object -First 1

  if (-not $line) {
    return ""
  }

  return ($line -replace "^$([regex]::Escape($Key))=", "").Trim()
}

function Set-EnvFileValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Key,
    [AllowEmptyString()][string]$Value
  )

  $content = @()

  if (Test-Path $Path) {
    $content = Get-Content $Path
  }

  $escapedKey = [regex]::Escape($Key)
  $found = $false
  $nextContent = foreach ($line in $content) {
    if ($line -match "^$escapedKey=") {
      $found = $true
      "$Key=$Value"
    } else {
      $line
    }
  }

  if (-not $found) {
    $nextContent += "$Key=$Value"
  }

  Set-Content -Path $Path -Value $nextContent -Encoding UTF8
}

Write-Host ""
Write-Host "DewClaw CompTool Local Worker Installer" -ForegroundColor Cyan
Write-Host "Project: $RootDir"
Write-Host ""

if (-not (Test-Path $WorkerDir)) {
  throw "Missing local-worker folder. Make sure this installer is inside the CompTool package."
}

if (-not (Test-CommandExists "node")) {
  Write-Host "Node.js is required before installing the local worker." -ForegroundColor Yellow
  Write-Host "Install the Windows LTS version from: https://nodejs.org/en/download"
  Start-Process "https://nodejs.org/en/download"
  throw "Node.js was not found."
}

if (-not (Test-CommandExists "npm")) {
  throw "npm was not found. Reinstall Node.js LTS, then run this installer again."
}

Write-Host "Node: $(node -v)"
Write-Host "npm:  $(npm -v)"
Write-Host ""

if (-not (Test-Path $EnvPath)) {
  Copy-Item -LiteralPath $EnvExamplePath -Destination $EnvPath
  Write-Host "Created local-worker\.env from .env.example"
}

$profileValue = Get-EnvFileValue -Path $EnvPath -Key "WORKER_BROWSER_PROFILE"
if (-not $profileValue) {
  $defaultProfile = Join-Path $env:LOCALAPPDATA "DewClawCompTool\browser-profile"
  Set-EnvFileValue -Path $EnvPath -Key "WORKER_BROWSER_PROFILE" -Value $defaultProfile
}

$anthropicKey = Get-EnvFileValue -Path $EnvPath -Key "ANTHROPIC_API_KEY"
if (-not $anthropicKey) {
  Write-Host ""
  Write-Host "Claude/Anthropic API key is optional but recommended for visual enrichment." -ForegroundColor Yellow
  $enteredKey = Read-Host "Paste ANTHROPIC_API_KEY now, or press Enter to skip"

  if ($enteredKey.Trim()) {
    Set-EnvFileValue -Path $EnvPath -Key "ANTHROPIC_API_KEY" -Value $enteredKey.Trim()
  }
}

Write-Host ""
Write-Host "Installing local worker dependencies..."
npm install --prefix $WorkerDir

Write-Host ""
Write-Host "Installing Playwright Chromium browser..."
Push-Location $WorkerDir
try {
  npm run install:browsers
} finally {
  Pop-Location
}

if (Test-Path $StartCmdPath) {
  $desktop = [Environment]::GetFolderPath("Desktop")
  $shortcutPath = Join-Path $desktop "Start DewClaw CompTool Worker.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $StartCmdPath
  $shortcut.WorkingDirectory = $RootDir
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
  $shortcut.Save()
  Write-Host "Created desktop shortcut: $shortcutPath"
}

Write-Host ""
Write-Host "Install complete." -ForegroundColor Green
Write-Host "Next: double-click 'Start DewClaw CompTool Worker' on the Desktop, keep it open, then use the Chrome extension on Land Insights."

# sync-codex.ps1
# Copies the most recent Codex rollout JSONL into the project so Claude can read it.
#
# Usage (from project root, in PowerShell):
#   .\scripts\sync-codex.ps1
#
# After running, tell Claude: "sync up with Codex"

$ErrorActionPreference = "Stop"

$CodexSessionsRoot = Join-Path $env:USERPROFILE ".codex\sessions"
$ProjectRoot      = Split-Path -Parent $PSScriptRoot
$DestDir          = Join-Path $ProjectRoot "docs"
$DestPath         = Join-Path $DestDir "codex-conversation-export.jsonl"

if (-not (Test-Path $CodexSessionsRoot)) {
    Write-Error "Codex sessions folder not found at $CodexSessionsRoot"
    exit 1
}

# Find the newest rollout-*.jsonl anywhere under sessions/
$latest = Get-ChildItem -Path $CodexSessionsRoot -Recurse -Filter "rollout-*.jsonl" -File `
    | Sort-Object LastWriteTime -Descending `
    | Select-Object -First 1

if (-not $latest) {
    Write-Error "No rollout-*.jsonl files found under $CodexSessionsRoot"
    exit 1
}

if (-not (Test-Path $DestDir)) {
    New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
}

Copy-Item -Path $latest.FullName -Destination $DestPath -Force

$sizeKb = [math]::Round($latest.Length / 1KB, 1)
Write-Host "Copied Codex session:" -ForegroundColor Green
Write-Host "  source : $($latest.FullName)"
Write-Host "  dest   : $DestPath"
Write-Host "  size   : $sizeKb KB"
Write-Host "  mtime  : $($latest.LastWriteTime)"
Write-Host ""
Write-Host "Next: tell Claude 'sync up with Codex'."

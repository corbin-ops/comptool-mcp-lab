$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$DistDir = Join-Path $RootDir "dist"
$PackageName = "DewClaw-CompTool-Internal-Installer"
$PackageDir = Join-Path $DistDir $PackageName
$ZipPath = Join-Path $DistDir "$PackageName.zip"

Write-Host ""
Write-Host "Packaging DewClaw CompTool internal installer" -ForegroundColor Cyan
Write-Host "Project: $RootDir"
Write-Host ""

New-Item -ItemType Directory -Force -Path $DistDir | Out-Null

if (Test-Path $PackageDir) {
  Remove-Item -LiteralPath $PackageDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $PackageDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PackageDir "scripts") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PackageDir "docs") | Out-Null

Copy-Item -LiteralPath (Join-Path $RootDir "Install CompTool Local Worker.cmd") -Destination $PackageDir
Copy-Item -LiteralPath (Join-Path $RootDir "Start CompTool Local Worker.cmd") -Destination $PackageDir
Copy-Item -LiteralPath (Join-Path $RootDir "README.md") -Destination $PackageDir
Copy-Item -LiteralPath (Join-Path $RootDir "scripts\install-local-worker.ps1") -Destination (Join-Path $PackageDir "scripts")

Copy-Item -LiteralPath (Join-Path $RootDir "local-worker") -Destination $PackageDir -Recurse
Copy-Item -LiteralPath (Join-Path $RootDir "extension") -Destination $PackageDir -Recurse

$workerNodeModules = Join-Path $PackageDir "local-worker\node_modules"
$workerEnv = Join-Path $PackageDir "local-worker\.env"

if (Test-Path $workerNodeModules) {
  Remove-Item -LiteralPath $workerNodeModules -Recurse -Force
}

if (Test-Path $workerEnv) {
  Remove-Item -LiteralPath $workerEnv -Force
}

$guideSource = Join-Path $RootDir "docs\CORBIN_INSTALL_GUIDE.md"
if (Test-Path $guideSource) {
  Copy-Item -LiteralPath $guideSource -Destination (Join-Path $PackageDir "docs")
}

if (Test-Path $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}

Compress-Archive -Path (Join-Path $PackageDir "*") -DestinationPath $ZipPath -Force

Write-Host "Package folder: $PackageDir"
Write-Host "Installer zip:  $ZipPath" -ForegroundColor Green

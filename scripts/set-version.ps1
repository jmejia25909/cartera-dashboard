param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Version invalida. Usa formato SemVer: 1.2.3"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Test-Path "package.json")) {
    throw "package.json no encontrado en $projectRoot"
}

Write-Host "Estableciendo version $Version..." -ForegroundColor Cyan
& pnpm version $Version --no-git-tag-version
if ($LASTEXITCODE -ne 0) {
    throw "No se pudo actualizar la version"
}

$actualVersion = (& node -p "require('./package.json').version").Trim()
if ($actualVersion -ne $Version) {
    throw "La version de package.json no coincide. Esperada: $Version, actual: $actualVersion"
}

Write-Host "Version oficial establecida: $actualVersion" -ForegroundColor Green
Write-Host "Electron e installer heredaran esta version desde package.json." -ForegroundColor Green

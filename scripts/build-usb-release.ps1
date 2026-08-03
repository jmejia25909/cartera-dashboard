param(
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$version = node -p "require('./package.json').version"
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "No se pudo leer la version de package.json"
}

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $root "usb-release-v$version"
}

& powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-clean-installer.ps1
if ($LASTEXITCODE -ne 0) { throw "La validacion del instalador limpio fallo" }

pnpm build:installer
if ($LASTEXITCODE -ne 0) { throw "La construccion del instalador fallo" }

if (Test-Path $OutputDirectory) {
    Remove-Item $OutputDirectory -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null

$installer = Get-ChildItem -Path (Join-Path $root "release") -File |
    Where-Object { $_.Extension -eq ".exe" -and $_.Name -match [regex]::Escape($version) } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $installer) {
    $installer = Get-ChildItem -Path (Join-Path $root "release") -File -Filter "*.exe" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}

if (-not $installer) {
    throw "No se encontro el instalador generado en la carpeta release"
}

Copy-Item $installer.FullName (Join-Path $OutputDirectory $installer.Name) -Force
Copy-Item (Join-Path $root "docs/ACTUALIZACION-PENDRIVE.md") (Join-Path $OutputDirectory "LEEME-ACTUALIZACION.md") -Force

Write-Host "" 
Write-Host "PAQUETE PARA PENDRIVE CREADO:" -ForegroundColor Green
Write-Host $OutputDirectory -ForegroundColor Cyan
Write-Host "" 
Write-Host "Incluye aplicacion limpia. No incluye cartera.db ni datos de desarrollo." -ForegroundColor Green

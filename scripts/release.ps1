. "$PSScriptRoot\common.ps1"

$root = Assert-ProjectRoot
Set-Location $root

Write-Section "CARTERA DASHBOARD - RELEASE CHECK"

Invoke-Checked "Validación completa" { pnpm validate }

Write-Host ""
Write-Host "Elige el empaquetado manualmente:" -ForegroundColor Yellow
Write-Host "  pnpm build:installer       # Windows"
Write-Host "  pnpm build:installer:mac   # macOS"
Write-Host "  pnpm build:all             # Windows + macOS"
Write-Host ""
Write-Ok "El proyecto está listo para empaquetar."

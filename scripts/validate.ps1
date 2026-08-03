. "$PSScriptRoot\common.ps1"

$root = Assert-ProjectRoot
Set-Location $root

Write-Section "CARTERA DASHBOARD - VALIDATE"

Invoke-Checked "TypeScript" { pnpm typecheck }
Invoke-Checked "ESLint" { pnpm lint }
Invoke-Checked "Build completo" { pnpm build }

Write-Ok "Validación finalizada correctamente."

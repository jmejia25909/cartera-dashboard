. "$PSScriptRoot\common.ps1"

$root = Assert-ProjectRoot
Set-Location $root

Write-Section "ZENITH CARTERA - VALIDATE"

Invoke-Checked "TypeScript" {
    pnpm typecheck
}

Invoke-Checked "ESLint" {
    pnpm lint
}

Invoke-Checked "Aislamiento QA / Produccion" {
    pnpm run verify:production-isolation
}

Invoke-Checked "Build completo" {
    pnpm build
}

Invoke-Checked "Aislamiento posterior al build" {
    pnpm run verify:production-isolation
}

Write-Ok "Validacion finalizada correctamente."
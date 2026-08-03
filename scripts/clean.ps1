. "$PSScriptRoot\common.ps1"

$root = Assert-ProjectRoot
Set-Location $root

Write-Section "CARTERA DASHBOARD - CLEAN"

$targets = @(
    "dist",
    "dist-electron",
    ".vite",
    "release",
    "coverage",
    "tsconfig.node.tsbuildinfo",
    "vite.config.js",
    "vite.config.d.ts"
)

foreach ($target in $targets) {
    $path = Join-Path $root $target

    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force
        Write-Ok "Eliminado: $target"
    } else {
        Write-Warn "No existe: $target"
    }
}

Write-Ok "Limpieza terminada. node_modules no fue eliminado."

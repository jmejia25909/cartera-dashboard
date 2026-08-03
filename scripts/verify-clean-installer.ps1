$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$forbiddenPatterns = @(
    "*.db",
    "*.db-wal",
    "*.db-shm",
    "*.sqlite",
    "*.sqlite3",
    "*.backup-*",
    "cartera-pre-update-*.db"
)

$excludedRoots = @(
    (Join-Path $root "node_modules"),
    (Join-Path $root ".git"),
    (Join-Path $root "release")
)

$found = @()
foreach ($pattern in $forbiddenPatterns) {
    $items = Get-ChildItem -Path $root -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        $excluded = $false
        foreach ($excludedRoot in $excludedRoots) {
            if ($item.FullName.StartsWith($excludedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                $excluded = $true
                break
            }
        }
        if (-not $excluded) {
            $found += $item.FullName
        }
    }
}

if ($found.Count -gt 0) {
    Write-Host "ARCHIVOS DE DATOS DETECTADOS EN EL PROYECTO:" -ForegroundColor Red
    $found | Sort-Object -Unique | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    throw "El instalador no puede construirse con bases de datos o respaldos incluidos."
}

Write-Host "Validacion correcta: el instalador saldra sin datos de prueba." -ForegroundColor Green

. "$PSScriptRoot\common.ps1"

$root = Assert-ProjectRoot
Set-Location $root

Write-Section "CARTERA DASHBOARD - BACKUP"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $root "backups"
$tempDir = Join-Path $env:TEMP "cartera-dashboard-backup-$timestamp"
$zipPath = Join-Path $backupDir "cartera-dashboard-backup-$timestamp.zip"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$folders = @("src", "electron", "public", "docs", "scripts")
foreach ($folder in $folders) {
    if (Test-Path $folder) {
        Copy-Item $folder $tempDir -Recurse -Force
    }
}

$files = @(
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts",
    "electron.vite.config.ts",
    "electron-builder.json5",
    "index.html",
    ".gitignore",
    ".editorconfig",
    ".env.example",
    ".eslintrc.cjs",
    "README.md",
    "CHANGELOG.md"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Copy-Item $file $tempDir -Force
    }
}

Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath -Force
Remove-Item $tempDir -Recurse -Force

Write-Ok "Respaldo generado:"
Write-Host $zipPath -ForegroundColor Cyan

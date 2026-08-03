. "$PSScriptRoot\common.ps1"

$root = Assert-ProjectRoot
Set-Location $root

Write-Section "CARTERA DASHBOARD - HEALTH CHECK"

$failed = $false

function Test-CommandAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandName,

        [Parameter(Mandatory = $true)]
        [string]$DisplayName
    )

    try {
        $command = Get-Command $CommandName -ErrorAction Stop
        Write-Ok "$DisplayName disponible: $($command.Source)"
    }
    catch {
        Write-Fail "$DisplayName no esta disponible."
        $script:failed = $true
    }
}

Test-CommandAvailable -CommandName "node" -DisplayName "Node.js"
Test-CommandAvailable -CommandName "pnpm" -DisplayName "pnpm"

try {
    $nodeVersion = node --version
    Write-Ok "Node.js version: $nodeVersion"
}
catch {
    Write-Fail "No fue posible obtener la version de Node.js."
    $failed = $true
}

try {
    $pnpmVersion = pnpm --version
    Write-Ok "pnpm version: $pnpmVersion"
}
catch {
    Write-Fail "No fue posible obtener la version de pnpm."
    $failed = $true
}

$requiredFiles = @(
    "package.json",
    "pnpm-lock.yaml",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts",
    "electron.vite.config.ts",
    "electron-builder.json5",
    "src\App.tsx",
    "electron\main.ts",
    "electron\preload.ts"
)

foreach ($file in $requiredFiles) {
    $path = Join-Path $root $file

    if (Test-Path $path) {
        Write-Ok "Archivo encontrado: $file"
    }
    else {
        Write-Fail "Falta archivo requerido: $file"
        $failed = $true
    }
}

$vitePath = Join-Path $root "node_modules\.bin\vite.cmd"

if (Test-Path $vitePath) {
    Write-Ok "Vite local disponible."
}
else {
    Write-Fail "Vite local no esta disponible. Ejecuta pnpm install."
    $failed = $true
}

$sqlitePath = Join-Path $root "node_modules\better-sqlite3"

if (Test-Path $sqlitePath) {
    Write-Ok "better-sqlite3 instalado."
}
else {
    Write-Fail "better-sqlite3 no esta instalado."
    $failed = $true
}

if ($failed) {
    Write-Fail "Estado general: REQUIERE ATENCION"
    exit 1
}

Write-Ok "Estado general: SALUDABLE"
exit 0
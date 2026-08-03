param(
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Invoke-Checked {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host "" 
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name fallo con codigo $LASTEXITCODE"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git no esta instalado o no esta disponible en PATH"
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm no esta instalado o no esta disponible en PATH"
}

$branch = (& git branch --show-current).Trim()
if ($branch -ne "master") {
    throw "Debes publicar desde la rama master. Rama actual: $branch"
}

$version = (& node -p "require('./package.json').version").Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Version invalida en package.json: $version"
}

$tag = "v$version"

if (-not $SkipValidation) {
    Invoke-Checked "TypeScript" { pnpm typecheck }
    Invoke-Checked "ESLint" { pnpm lint }
    Invoke-Checked "Build" { pnpm build }
}

Invoke-Checked "Preparar cambios" { git add -A }

$status = (& git status --porcelain | Out-String).Trim()
if ($status) {
    Invoke-Checked "Crear commit $tag" { git commit -m "release: $tag" }
} else {
    Write-Host "No hay cambios pendientes para commit." -ForegroundColor Yellow
}

Invoke-Checked "Publicar master" { git push origin master }

$localTagExists = (& git tag --list $tag | Out-String).Trim()
if (-not $localTagExists) {
    Invoke-Checked "Crear tag $tag" { git tag -a $tag -m "Cartera Dashboard $tag" }
}

Invoke-Checked "Publicar tag $tag" { git push origin $tag }

$versionTags = @(
    git tag --list "v*" --sort=-version:refname |
        Where-Object { $_ -match '^v\d+\.\d+\.\d+$' }
)

if ($versionTags.Count -gt 2) {
    $oldTags = $versionTags | Select-Object -Skip 2
    foreach ($oldTag in $oldTags) {
        Write-Host "Eliminando respaldo antiguo: $oldTag" -ForegroundColor Yellow
        & git push origin --delete $oldTag 2>$null
        & git tag -d $oldTag 2>$null
    }
}

Invoke-Checked "Sincronizar referencias" { git fetch origin --prune --tags }

$remainingTags = @(
    git tag --list "v*" --sort=-version:refname |
        Where-Object { $_ -match '^v\d+\.\d+\.\d+$' } |
        Select-Object -First 2
)

Write-Host "" 
Write-Host "Release publicada correctamente: $tag" -ForegroundColor Green
Write-Host "Versiones conservadas:" -ForegroundColor Green
$remainingTags | ForEach-Object { Write-Host "  $_" }

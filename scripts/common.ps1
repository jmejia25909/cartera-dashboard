Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ProjectRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Write-Section {
    param([Parameter(Mandatory)][string]$Title)
    Write-Host ""
    Write-Host ("=" * 62) -ForegroundColor Cyan
    Write-Host (" " + $Title) -ForegroundColor Cyan
    Write-Host ("=" * 62) -ForegroundColor Cyan
}

function Write-Ok {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][scriptblock]$Action
    )

    Write-Host ""
    Write-Host ">> $Label" -ForegroundColor White
    & $Action

    if ($LASTEXITCODE -ne 0) {
        throw "$Label falló con código $LASTEXITCODE."
    }

    Write-Ok $Label
}

function Assert-ProjectRoot {
    $root = Get-ProjectRoot
    $required = @("package.json", "src", "electron", "pnpm-lock.yaml")

    foreach ($item in $required) {
        if (-not (Test-Path (Join-Path $root $item))) {
            throw "No se encontró '$item'. Ejecuta el script dentro del proyecto Cartera Dashboard."
        }
    }

    return $root
}

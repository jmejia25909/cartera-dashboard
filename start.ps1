#!/usr/bin/env pwsh
# Script para iniciar Cartera Dashboard en desarrollo

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CARTERA DASHBOARD - INICIANDO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣  Iniciando servidor Vite..." -ForegroundColor Yellow
Start-Process pwsh -ArgumentList '-NoExit', '-Command', 'cd C:\dev\cartera-dashboard; pnpm dev:renderer'

Write-Host ""
Write-Host "Esperando que Vite esté listo..." -ForegroundColor Cyan
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "2️⃣  Compilando Electron..." -ForegroundColor Yellow

# Compilar electron
cd C:\dev\cartera-dashboard
pnpm exec tsc -p tsconfig.node.json

Write-Host ""
Write-Host "3️⃣  Creando build de Electron..." -ForegroundColor Yellow
pnpm exec vite build --config electron.vite.config.ts --logLevel silent

Write-Host ""
Write-Host "Esperando que todo esté listo..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "4️⃣  Lanzando Electron..." -ForegroundColor Yellow
$env:VITE_DEV_SERVER_URL = "http://localhost:5173"
& ./node_modules/.bin/electron .

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ APLICACIÓN CERRADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

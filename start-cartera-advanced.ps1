# Script para iniciar automáticamente Cartera Dashboard
# Coloca este archivo en: C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\
# O ejecuta: powershell -ExecutionPolicy Bypass -File "C:\dev\cartera-dashboard\start-cartera-advanced.ps1"

Write-Host "[$(Get-Date)] Iniciando Cartera Dashboard con soporte remoto..." -ForegroundColor Green

# Navega a la carpeta del proyecto
Set-Location -Path "C:\dev\cartera-dashboard"

# 1. Iniciar el servidor Vite (dev:renderer)
Write-Host "Iniciando servidor Vite..." -ForegroundColor Cyan
$env:VITE_DEV_SERVER_URL = "http://localhost:5173"

# Ejecuta en background
Start-Process -FilePath "cmd.exe" -ArgumentList '/c', 'pnpm dev:renderer' -NoNewWindow -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# 2. Compilar y iniciar Electron (incluye servidor HTTP en puerto 3000)
Write-Host "Compilando e iniciando Electron..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" -ArgumentList '/c', 'pnpm dev:electron' -NoNewWindow -ErrorAction SilentlyContinue
Start-Sleep -Seconds 10

# 3. Iniciar el túnel de Cloudflare en background
Write-Host "Iniciando túnel de Cloudflare..." -ForegroundColor Cyan
$cloudflaredExe = "C:\Users\j-mej\AppData\Local\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"

if (Test-Path $cloudflaredExe) {
    Start-Job -ScriptBlock {
        param($exe)
        & $exe tunnel run cartera-tunnel 2>&1
    } -ArgumentList $cloudflaredExe | Out-Null
    Start-Sleep -Seconds 5
    Write-Host "✅ Túnel iniciado" -ForegroundColor Green
} else {
    Write-Host "⚠️ Cloudflared no encontrado en: $cloudflaredExe" -ForegroundColor Yellow
}

# 4. Mostrar URLs disponibles
Write-Host "`n=== CARTERA DASHBOARD INICIADO ===" -ForegroundColor Green
Write-Host "🟢 Local: http://192.168.1.9:3000" -ForegroundColor Green
Write-Host "🌐 Remoto: https://0ebbb202-30f1-42a5-82b8-2d78ad402d5a.cfargotunnel.com" -ForegroundColor Cyan
Write-Host "App abierta en ventana Electron" -ForegroundColor Gray

Write-Host "`nEl sistema detectará automáticamente cambios de IP y reiniciará el túnel si es necesario." -ForegroundColor Cyan
Start-Sleep -Seconds 5

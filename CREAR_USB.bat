@echo off
chcp 65001 > nul
cls
color 0B

echo.
echo ═══════════════════════════════════════════════════════════════
echo.
echo       📦 GENERADOR DE PAQUETE USB - CARTERA DASHBOARD
echo.
echo ═══════════════════════════════════════════════════════════════
echo.
echo  Este script:
echo    1. Compilará el proyecto
echo    2. Generará el instalador
echo    3. Creará la carpeta USB lista para distribuir
echo.
echo ═══════════════════════════════════════════════════════════════
echo.
pause

REM Paso 1: Compilar proyecto
echo.
echo [1/3] 🔨 Compilando proyecto...
echo.
call pnpm build
if errorlevel 1 (
    echo ❌ Error al compilar el proyecto
    pause
    exit /b 1
)
echo ✓ Proyecto compilado exitosamente
echo.

REM Paso 2: Generar instalador
echo [2/3] 📦 Generando instalador Windows...
echo.
call pnpm build:installer
if errorlevel 1 (
    echo ❌ Error al generar instalador
    pause
    exit /b 1
)
echo ✓ Instalador generado exitosamente
echo.

REM Paso 3: Crear carpeta USB
echo [3/3] 💾 Creando paquete USB...
echo.

REM Crear carpeta USB_CARTERA
if exist "USB_CARTERA" (
    echo   Limpiando carpeta anterior...
    rmdir /S /Q "USB_CARTERA"
)
mkdir "USB_CARTERA"

REM Copiar instalador
echo   Copiando instalador...
xcopy /Y "release\1.0.0\*.exe" "USB_CARTERA\"

REM Copiar archivos auxiliares
echo   Copiando archivos de ayuda...
copy /Y "INSTALAR.bat" "USB_CARTERA\"
copy /Y "LICENSE.txt" "USB_CARTERA\"

REM Crear archivo de instrucciones
echo Creando INSTRUCCIONES.txt...
(
echo ═══════════════════════════════════════════════════════════
echo   INSTRUCCIONES DE INSTALACIÓN - CARTERA DASHBOARD
echo ═══════════════════════════════════════════════════════════
echo.
echo 📋 PASOS PARA INSTALAR:
echo.
echo 1. Ejecute: INSTALAR.bat
echo    (o directamente el archivo .exe^)
echo.
echo 2. Siga el asistente de instalación:
echo    ✓ Acepte la licencia
echo    ✓ Elija carpeta de instalación
echo    ✓ Seleccione crear acceso directo
echo    ✓ Presione "Instalar"
echo.
echo 3. Espere 2-3 minutos mientras se instala
echo.
echo 4. ¡Listo! Abra desde el Escritorio o Menú Inicio
echo.
echo ═══════════════════════════════════════════════════════════
echo.
echo 💻 REQUISITOS DEL SISTEMA:
echo.
echo    • Windows 10 o superior (64-bit^)
echo    • 4 GB RAM mínimo
echo    • 500 MB espacio en disco
echo    • Pantalla 1024x768 o superior
echo.
echo ═══════════════════════════════════════════════════════════
echo.
echo 🔐 USUARIO DEMO:
echo.
echo    Usuario: demo
echo    Contraseña: demo123
echo.
echo ═══════════════════════════════════════════════════════════
echo.
echo 🗑️ PARA DESINSTALAR:
echo.
echo    Panel de Control ^> Programas ^> Desinstalar programa
echo    Busque "Cartera Dashboard" y haga clic en Desinstalar
echo.
echo ═══════════════════════════════════════════════════════════
echo.
echo 💾 RESPALDO DE DATOS:
echo.
echo    Los datos se guardan en:
echo    C:\Users\SU_USUARIO\AppData\Roaming\Cartera Dashboard
echo.
echo    Copie esta carpeta para hacer respaldo
echo.
echo ═══════════════════════════════════════════════════════════
echo.
echo Versión 1.0 - Enero 2026
echo Soporte: soporte@tuempresa.com
) > "USB_CARTERA\INSTRUCCIONES.txt"

REM Crear README
(
echo # Cartera Dashboard - Instalador USB
echo.
echo Este USB contiene el instalador de Cartera Dashboard.
echo.
echo ## Contenido:
echo - INSTALAR.bat: Script de instalación automática
echo - Cartera Dashboard-Setup-1.0.0.exe: Instalador principal
echo - INSTRUCCIONES.txt: Guía paso a paso
echo - LICENSE.txt: Términos de licencia
echo.
echo ## Uso rápido:
echo 1. Ejecute INSTALAR.bat
echo 2. Siga las instrucciones
echo 3. ¡Listo!
echo.
echo Versión: 1.0.0
) > "USB_CARTERA\README.md"

echo ✓ Paquete USB creado exitosamente
echo.

REM Mostrar resumen
echo ═══════════════════════════════════════════════════════════════
echo.
echo  ✅ PAQUETE USB GENERADO EXITOSAMENTE
echo.
echo  📁 Ubicación: %CD%\USB_CARTERA\
echo.
echo  📦 Contenido:
for %%F in (USB_CARTERA\*) do (
    echo     • %%~nxF
)
echo.
echo  💾 SIGUIENTE PASO:
echo     Copie la carpeta USB_CARTERA a su memoria USB
echo.
echo  📝 Tamaño total: 
for /f "tokens=3" %%a in ('dir /s USB_CARTERA ^| find "bytes"') do set size=%%a
echo     ~150-200 MB aproximadamente
echo.
echo ═══════════════════════════════════════════════════════════════
echo.
echo  ¿Desea abrir la carpeta USB_CARTERA ahora? (S/N^)
set /p respuesta=  
if /i "%respuesta%"=="S" (
    start explorer "USB_CARTERA"
)

echo.
echo  ✓ Proceso completado
echo.
pause

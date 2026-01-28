@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
cls
color 0E

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                                                               ║
echo ║        📦 GENERADOR PORTABLE USB - CARTERA DASHBOARD         ║
echo ║                                                               ║
echo ║         Crear versión portátil lista para USB                ║
echo ║                                                               ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo Opciones:
echo   1. Crear versión PORTÁTIL (sin instalador - corre directo)
echo   2. Crear versión para MEDICAT USB
echo   3. Salir
echo.
set /p opcion="Elija opción (1-3): "

if "%opcion%"=="1" goto portable
if "%opcion%"=="2" goto medicat
if "%opcion%"=="3" goto fin
echo ❌ Opción no válida
timeout /t 2
goto inicio

:portable
cls
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║  GENERANDO VERSIÓN PORTÁTIL...                               ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

REM Compilar
echo [1/3] 🔨 Compilando proyecto...
call pnpm build > nul 2>&1
if errorlevel 1 (
    echo ❌ Error en compilación
    goto error
)
echo ✓ Compilación completada
echo.

REM Crear carpeta
echo [2/3] 📁 Creando carpeta USB...
if exist "USB_PORTABLE_CARTERA" rmdir /S /Q "USB_PORTABLE_CARTERA" > nul 2>&1
mkdir "USB_PORTABLE_CARTERA\Cartera Dashboard"

REM Copiar archivos compilados
echo   Copiando aplicación...
xcopy /Y /I /E "dist" "USB_PORTABLE_CARTERA\Cartera Dashboard\dist" > nul 2>&1
xcopy /Y /I /E "dist-electron" "USB_PORTABLE_CARTERA\Cartera Dashboard\dist-electron" > nul 2>&1
xcopy /Y /I /E "node_modules" "USB_PORTABLE_CARTERA\Cartera Dashboard\node_modules" > nul 2>&1

REM Crear ejecutable launcher
echo   Creando launcher...
(
echo @echo off
echo cd /d "%%~dp0"
echo start electron.exe dist-electron/main.js
) > "USB_PORTABLE_CARTERA\Cartera Dashboard\EJECUTAR.bat"

REM Crear instrucciones
echo   Creando instrucciones...
(
echo ═══════════════════════════════════════════════════════════════
echo   CARTERA DASHBOARD - VERSIÓN PORTÁTIL
echo ═══════════════════════════════════════════════════════════════
echo.
echo 🚀 PARA EJECUTAR:
echo.
echo   1. Haga doble clic en: EJECUTAR.bat
echo.
echo   O directamente: EJECUTAR.bat
echo.
echo ═══════════════════════════════════════════════════════════════
echo.
echo 💻 REQUISITOS:
echo    • Windows 10/11 (64-bit^)
echo    • 4 GB RAM mínimo
echo    • 1 GB espacio en disco
echo.
echo 🔐 USUARIO DEMO:
echo    Usuario: demo
echo    Contraseña: demo123
echo.
echo 💾 DATOS:
echo    Se guardan en: %%TEMP%%\Cartera Dashboard\
echo    (Se pierden al cerrar la aplicación^)
echo.
echo 📝 VENTAJAS:
echo    ✓ Sin instalador
echo    ✓ Sin configuración
echo    ✓ Corre desde cualquier lugar
echo    ✓ Perfecto para USB
echo.
echo ═══════════════════════════════════════════════════════════════
echo.
echo Versión: 1.0.0
echo Portable - Enero 2026
) > "USB_PORTABLE_CARTERA\Cartera Dashboard\INSTRUCCIONES.txt"

REM Crear README
(
echo # Cartera Dashboard - Versión Portátil
echo.
echo Ejecute: EJECUTAR.bat
echo.
echo Sin instalación requerida.
echo Corre desde USB o cualquier carpeta.
) > "USB_PORTABLE_CARTERA\Cartera Dashboard\README.md"

echo ✓ Versión portátil creada
echo.

REM Mostrar resumen
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║  ✅ PORTÁTIL GENERADO EXITOSAMENTE                           ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo 📁 Ubicación: %CD%\USB_PORTABLE_CARTERA\Cartera Dashboard\
echo.
echo 📦 Contenido:
dir "USB_PORTABLE_CARTERA\Cartera Dashboard\" /B | findstr /V "node_modules dist"
echo    ... (+ node_modules y dist^)
echo.
echo 💾 SIGUIENTE PASO:
echo    Copie "Cartera Dashboard" a su USB
echo.
echo    En la USB quedará:
echo    USB:\Cartera Dashboard\
echo       ├── EJECUTAR.bat
echo       ├── INSTRUCCIONES.txt
echo       ├── dist/
echo       ├── dist-electron/
echo       └── node_modules/
echo.
echo 🚀 PARA USAR:
echo    1. Copie carpeta a USB
echo    2. En cualquier PC: Abra EJECUTAR.bat
echo    3. ¡Listo! Se abre la aplicación
echo.
echo ═══════════════════════════════════════════════════════════════
echo.
set /p abrir="¿Abrir carpeta ahora? (S/N): "
if /i "%abrir%"=="S" start explorer "USB_PORTABLE_CARTERA"
goto fin

:medicat
cls
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║  GENERANDO PARA MEDICAT USB...                               ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

REM Compilar
echo [1/2] 🔨 Compilando proyecto...
call pnpm build > nul 2>&1
if errorlevel 1 (
    echo ❌ Error en compilación
    goto error
)
echo ✓ Compilación completada
echo.

REM Crear estructura MediCat
echo [2/2] 📁 Creando estructura MediCat...
if exist "MediCat_Cartera" rmdir /S /Q "MediCat_Cartera" > nul 2>&1
mkdir "MediCat_Cartera\Extra_Files\Cartera_Dashboard"

REM Copiar archivos
echo   Copiando archivos...
xcopy /Y /I /E "dist" "MediCat_Cartera\Extra_Files\Cartera_Dashboard\dist" > nul 2>&1
xcopy /Y /I /E "dist-electron" "MediCat_Cartera\Extra_Files\Cartera_Dashboard\dist-electron" > nul 2>&1
xcopy /Y /I /E "node_modules" "MediCat_Cartera\Extra_Files\Cartera_Dashboard\node_modules" > nul 2>&1

REM Crear launcher
(
echo @echo off
echo cd /d "%%~dp0"
echo start electron.exe dist-electron/main.js
) > "MediCat_Cartera\Extra_Files\Cartera_Dashboard\EJECUTAR.bat"

REM Instrucciones
(
echo ═══════════════════════════════════════════════════════════════
echo   CARTERA DASHBOARD EN MEDICAT
echo ═══════════════════════════════════════════════════════════════
echo.
echo 📍 EN MEDICAT:
echo    Navege: Extra Files ^> Cartera Dashboard ^> EJECUTAR.bat
echo.
echo   O en Windows PE:
echo    Abra carpeta: Extra_Files\Cartera_Dashboard
echo    Ejecute: EJECUTAR.bat
echo.
echo ═══════════════════════════════════════════════════════════════
) > "MediCat_Cartera\Extra_Files\Cartera_Dashboard\INSTRUCCIONES.txt"

echo ✓ Estructura MediCat creada
echo.

REM Mostrar resumen
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║  ✅ MEDICAT GENERADO EXITOSAMENTE                            ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo 📁 Ubicación: %CD%\MediCat_Cartera\
echo.
echo 📂 Estructura:
echo    MediCat_Cartera/
echo    └── Extra_Files/
echo        └── Cartera_Dashboard/
echo            ├── EJECUTAR.bat
echo            ├── dist/
echo            ├── dist-electron/
echo            └── node_modules/
echo.
echo 💾 INTEGRACIÓN CON MEDICAT:
echo    Copie "Extra_Files" a la raíz de su MediCat USB
echo.
echo    Estructura final en MediCat:
echo    MediCat_USB/
echo    ├── bootmgr
echo    ├── Extra_Files/       ← Copia aquí
echo    │   ├── Cartera_Dashboard/
echo    │   └── [otros programas]
echo    └── [otros archivos]
echo.
echo ═══════════════════════════════════════════════════════════════
echo.
set /p abrir="¿Abrir carpeta ahora? (S/N): "
if /i "%abrir%"=="S" start explorer "MediCat_Cartera"
goto fin

:error
echo.
echo ❌ OCURRIÓ UN ERROR
echo.
pause
exit /b 1

:fin
echo.
pause
exit /b 0

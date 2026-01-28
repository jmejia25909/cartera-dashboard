@echo off
chcp 65001 > nul
cls
color 0D

echo.
echo ═══════════════════════════════════════════════════════════════
echo.
echo    📦 GENERADOR PARA MEDICAT USB - CARTERA DASHBOARD
echo.
echo ═══════════════════════════════════════════════════════════════
echo.
echo  Este script:
echo    1. Compilará el proyecto
echo    2. Generará el instalador
echo    3. Creará estructura compatible con MediCat USB
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

REM Paso 3: Crear estructura MediCat
echo [3/3] 💾 Creando estructura para MediCat USB...
echo.

REM Crear carpeta para MediCat
if exist "MediCat_Cartera_Dashboard" (
    echo   Limpiando carpeta anterior...
    rmdir /S /Q "MediCat_Cartera_Dashboard"
)
mkdir "MediCat_Cartera_Dashboard\Extra_Files\Cartera_Dashboard"

REM Copiar instalador
echo   Copiando instalador...
xcopy /Y "release\1.0.0\*.exe" "MediCat_Cartera_Dashboard\Extra_Files\Cartera_Dashboard\"

REM Copiar archivos auxiliares
echo   Copiando archivos de ayuda...
copy /Y "INSTALAR.bat" "MediCat_Cartera_Dashboard\Extra_Files\Cartera_Dashboard\"
copy /Y "LICENSE.txt" "MediCat_Cartera_Dashboard\Extra_Files\Cartera_Dashboard\"

REM Crear INSTRUCCIONES específicas para MediCat
(
echo ═══════════════════════════════════════════════════════════
echo   CARTERA DASHBOARD - INSTALACIÓN DESDE MEDICAT USB
echo ═══════════════════════════════════════════════════════════
echo.
echo 📋 INSTALACIÓN:
echo.
echo 1. Desde MediCat, navegue a:
echo    Extra Files ^> Cartera Dashboard
echo.
echo 2. Ejecute: INSTALAR.bat
echo    (o el archivo .exe directamente^)
echo.
echo 3. Siga el asistente de instalación
echo.
echo 4. El programa se instalará en:
echo    C:\Program Files\Cartera Dashboard\
echo.
echo ═══════════════════════════════════════════════════════════
echo.
echo 💻 REQUISITOS:
echo    • Windows 10/11 (64-bit^)
echo    • 4 GB RAM
echo    • 500 MB disco
echo.
echo 🔐 USUARIO DEMO:
echo    Usuario: demo
echo    Contraseña: demo123
echo.
echo 💾 DATOS SE GUARDAN EN:
echo    %%APPDATA%%\Cartera Dashboard\
echo.
echo ═══════════════════════════════════════════════════════════
echo Versión 1.0 - Compatible con MediCat USB
) > "MediCat_Cartera_Dashboard\Extra_Files\Cartera_Dashboard\INSTRUCCIONES.txt"

REM Crear LEEME.txt para MediCat
(
echo ═══════════════════════════════════════════════════════════
echo   PARA ADMINISTRADORES DE MEDICAT
echo ═══════════════════════════════════════════════════════════
echo.
echo 📁 INSTALACIÓN EN MEDICAT USB:
echo.
echo 1. Copie la carpeta "Extra_Files" a la raíz de MediCat USB
echo.
echo 2. Si ya existe Extra_Files, copie solo:
echo    Cartera_Dashboard/ dentro de Extra_Files/
echo.
echo 3. Estructura final en MediCat USB:
echo    MediCat_USB/
echo    ├── Extra_Files/
echo    │   └── Cartera_Dashboard/
echo    │       ├── INSTALAR.bat
echo    │       ├── Cartera Dashboard-Setup-1.0.0.exe
echo    │       ├── INSTRUCCIONES.txt
echo    │       └── LICENSE.txt
echo.
echo ═══════════════════════════════════════════════════════════
echo.
echo 🎯 AGREGAR AL MENÚ MEDICAT (OPCIONAL^):
echo.
echo 1. Edite: MediCat\grub\grub.cfg
echo.
echo 2. Agregue esta entrada:
echo.
echo    menuentry "Instalar Cartera Dashboard" {
echo        set root=(hd0,1^)
echo        chainloader /Extra_Files/Cartera_Dashboard/INSTALAR.bat
echo    }
echo.
echo 3. O cree acceso directo en Windows PE del MediCat
echo.
echo ═══════════════════════════════════════════════════════════
echo.
echo ✅ VENTAJAS DE USAR MEDICAT:
echo.
echo    • Un solo USB para diagnóstico + software
echo    • Instalación en equipos sin sistema operativo
echo    • Ideal para técnicos de campo
echo    • Menú centralizado
echo.
echo ═══════════════════════════════════════════════════════════
) > "MediCat_Cartera_Dashboard\LEEME_MEDICAT.txt"

REM Crear script adicional para lanzar desde Windows PE
(
echo @echo off
echo title Cartera Dashboard - Instalador
echo cd /d "%%~dp0"
echo start "" "Cartera Dashboard-Setup-1.0.0.exe"
) > "MediCat_Cartera_Dashboard\Extra_Files\Cartera_Dashboard\INSTALAR_PE.bat"

echo ✓ Estructura MediCat creada exitosamente
echo.

REM Mostrar resumen
echo ═══════════════════════════════════════════════════════════════
echo.
echo  ✅ PAQUETE MEDICAT GENERADO EXITOSAMENTE
echo.
echo  📁 Ubicación: %CD%\MediCat_Cartera_Dashboard\
echo.
echo  📦 Estructura creada:
echo     MediCat_Cartera_Dashboard/
echo     ├── Extra_Files/
echo     │   └── Cartera_Dashboard/
echo     │       ├── INSTALAR.bat
echo     │       ├── INSTALAR_PE.bat (Windows PE^)
echo     │       ├── Cartera Dashboard-Setup-1.0.0.exe
echo     │       ├── INSTRUCCIONES.txt
echo     │       └── LICENSE.txt
echo     └── LEEME_MEDICAT.txt
echo.
echo  💾 SIGUIENTE PASO:
echo     Copie "Extra_Files" a la raíz de su MediCat USB
echo.
echo  📝 Tamaño: ~150-200 MB
echo.
echo ═══════════════════════════════════════════════════════════════
echo.
echo  ¿Desea abrir la carpeta ahora? (S/N^)
set /p respuesta=  
if /i "%respuesta%"=="S" (
    start explorer "MediCat_Cartera_Dashboard"
)

echo.
echo  ✓ Listo para copiar a MediCat USB
echo.
pause

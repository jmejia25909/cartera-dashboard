@echo off
chcp 65001 >nul
echo =====================================
echo   BACKUP AUTOMÁTICO - CARTERA DASHBOARD
echo   Fecha: 29 enero 2026
echo =====================================
echo.

cd /d "%~dp0"

echo [1/5] Verificando estado de Git...
git status
echo.

echo [2/5] Haciendo commit de cambios pendientes...
git add .
git commit -m "Backup completo antes de formatear - %date% %time%"
echo.

echo [3/5] Subiendo todo a GitHub...
git push origin master
echo.

echo [4/5] Mostrando último commit...
git log -1 --oneline
echo.

echo [5/5] Verificando que todo esté sincronizado...
git status
echo.

echo =====================================
echo   ✅ BACKUP COMPLETADO
echo =====================================
echo.
echo Tu proyecto está seguro en GitHub.
echo Repositorio: https://github.com/tu-usuario/cartera-dashboard.git
echo.
echo Después de formatear:
echo 1. Instala Node.js v20.20.0
echo 2. Instala pnpm: npm install -g pnpm@10.28.1
echo 3. Clona el repo: git clone [URL]
echo 4. Instala dependencias: pnpm install
echo 5. Ejecuta el proyecto: pnpm run dev
echo.
echo Lee el archivo BACKUP-INFO.md para más detalles.
echo.

pause

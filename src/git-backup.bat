@echo off
cd /d "%~dp0"
:: Asegurar que estamos en la raiz del proyecto
if exist "..\package.json" cd ..

color 0A
echo.
echo  =======================================================
echo   RESPALDO DE CODIGO FUENTE A GITHUB
echo  =======================================================
echo.
echo  1. Verificando estado...
git status
echo.
echo  2. Agregando todos los archivos...
git add .
echo.
echo  3. Guardando cambios...
set /p user_msg="-> Mensaje del commit (Enter para usar fecha): "
if "%user_msg%"=="" set user_msg=Actualizacion automatica

:: Guardar con mensaje + fecha siempre
git commit -m "%user_msg% [%date% %time%]"
echo.
echo  4. Subiendo a GitHub...
git push
echo.
echo  =======================================================
echo   RESPALDO COMPLETADO EXITOSAMENTE
echo  =======================================================
echo.
:: Reproducir sonido de sistema
rundll32 user32.dll,MessageBeep
pause
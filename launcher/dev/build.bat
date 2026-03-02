@echo off
echo Compilando FerreDesk Launcher (DEV)...
echo.

pyinstaller ferredesk_launcher.spec

if %errorlevel% neq 0 (
    echo.
    echo Error al compilar el launcher
    pause
    exit /b 1
)

echo.
echo Copiando ejecutable a carpeta instalador dev...
copy /Y dist\ferredesk_launcher.exe ..\..\instalador\dev\

echo.
echo Compilacion completada!
echo Ejecutable: dist\ferredesk_launcher.exe
echo Copiado a: ..\..\instalador\dev\ferredesk_launcher.exe
echo.
pause

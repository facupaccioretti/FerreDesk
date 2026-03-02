@echo off
echo Compilando FerreDesk Launcher...
echo.

pyinstaller ferredesk_launcher.spec

if %errorlevel% neq 0 (
    echo.
    echo Error al compilar el launcher
    pause
    exit /b 1
)

echo.
echo Copiando ejecutable a carpeta instalador...
copy /Y dist\ferredesk_launcher.exe ..\instalador\

echo.
echo Compilacion completada!
echo Ejecutable: dist\ferredesk_launcher.exe
echo Copiado a: ..\instalador\ferredesk_launcher.exe
echo.
pause


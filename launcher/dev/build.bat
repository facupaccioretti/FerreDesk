@echo off
echo Compilando FerreDesk Launcher (DEV)...
echo.

pyinstaller --onefile --noconsole --icon=..\..\instalador\dev\FerreDesk.ico --add-data "..\..\instalador\dev\FerreDesk.ico;." ferredesk_launcher.py

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

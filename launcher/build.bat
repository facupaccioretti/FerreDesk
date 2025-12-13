@echo off
echo Compilando FerreDesk Launcher...
echo.

pyinstaller --onefile --noconsole --icon=..\instalador\FerreDesk.ico --add-data "..\instalador\FerreDesk.ico;." ferredesk_launcher.py

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


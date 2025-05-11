@echo off
echo Configurando Python...

:: Descargar get-pip.py usando PowerShell
powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile 'get-pip.py'"

:: Instalar pip
python get-pip.py

:: Limpiar get-pip.py
del get-pip.py

echo Instalando dependencias...
python -m pip install -r requirements.txt

echo Generando ejecutable...
python -m PyInstaller --onefile --windowed --name="FerreDesk Launcher" start_ferredesk.py

if errorlevel 1 (
    echo Error al generar el ejecutable.
    pause
    exit /b 1
)

echo Limpiando archivos temporales...
if exist build rmdir /s /q build
if exist *.spec del /q *.spec

echo.
echo ¡Listo! El ejecutable se encuentra en la carpeta 'dist'
echo.
pause 
@echo off
echo Iniciando FerreDesk...

:: Activar entorno virtual de Django
echo Activando entorno virtual...
call pagina_combinada_backend\venv\Scripts\activate.bat

:: Verificar que Django está instalado
python -c "import django" 2>nul
if errorlevel 1 (
    echo Instalando Django...
    pip install django
)

:: Iniciar Django en segundo plano
start /B cmd /c "cd pagina_combinada_backend && ..\pagina_combinada_backend\venv\Scripts\activate.bat && python manage.py runserver"

:: Esperar 5 segundos
timeout /t 5 /nobreak

:: Iniciar Next.js en segundo plano
start /B cmd /c "cd pagina-combinada_frontend && npm run dev"

:: Esperar 5 segundos
timeout /t 5 /nobreak

:: Abrir el navegador
start http://localhost:3000

echo.
echo FerreDesk está iniciado!
echo Frontend: http://localhost:3000
echo Backend: http://localhost:8000
echo.
echo Presiona Ctrl+C para detener los servidores
echo.

:: Mantener la ventana abierta
pause 
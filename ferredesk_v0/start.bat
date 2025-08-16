@echo off
echo 🚀 Iniciando FerreDesk...
echo.

REM Verificar si los servicios están ejecutándose
docker-compose ps | findstr "Up" >nul
if %errorlevel% neq 0 (
    echo ⚠️  Los servicios no están ejecutándose
    echo 🔄 Iniciando servicios...
    docker-compose up -d
    timeout /t 10 /nobreak >nul
)

echo ✅ FerreDesk está ejecutándose
echo.
echo 🌐 Abre tu navegador en: http://localhost:8000
echo.
echo 👤 Usuario: admin
echo 🔑 Contraseña: admin123
echo.
echo 📋 Para ver logs: docker-compose logs -f
echo 📋 Para detener: docker-compose down
echo.
pause 
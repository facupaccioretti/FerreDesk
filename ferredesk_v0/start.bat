@echo off
echo 🚀 Iniciando FerreDesk...
echo.

REM Verificar si Docker está ejecutándose
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker no está ejecutándose!
    echo.
    echo 🔄 Abre Docker Desktop y espera a que esté listo
    echo.
    pause
    exit /b 1
)

REM Verificar si estamos en el directorio correcto
if not exist "docker-compose.yml" (
    echo ❌ Error: No se encontró docker-compose.yml
    echo.
    echo 📁 Ejecuta este script desde el directorio del proyecto FerreDesk
    echo.
    pause
    exit /b 1
)

REM Verificar si los servicios están ejecutándose
docker-compose ps | findstr "Up" >nul
if %errorlevel% neq 0 (
    echo ⚠️  Los servicios no están ejecutándose
    echo 🔄 Iniciando servicios...
    docker-compose up -d
    timeout /t 15 /nobreak >nul
)

REM Verificar estado final de los servicios
echo.
echo 🔍 Verificando estado de los servicios...
docker-compose ps

echo.
echo ✅ FerreDesk está ejecutándose
echo.
echo 🌐 Abre tu navegador en: http://localhost:8000
echo.
echo 🔑 Credenciales de acceso:
echo    Usuario: admin
echo    Contraseña: admin123
echo.
echo 📋 Comandos útiles:
echo    • Ver logs: docker-compose logs -f
echo    • Detener: docker-compose down
echo    • Reiniciar: docker-compose restart
echo    • Limpiar todo: clean.bat
echo.
pause 
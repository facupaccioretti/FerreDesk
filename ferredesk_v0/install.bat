@echo off
echo ========================================
echo    INSTALADOR FERREDESK v1.0
echo ========================================
echo.

REM Verificar si Docker está instalado
docker --version >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker no está instalado!
    echo.
    echo 📥 Descarga Docker Desktop desde:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo 🔄 Después de instalar, ejecuta este script nuevamente
    echo.
    pause
    exit /b 1
)

echo ✅ Docker detectado: 
docker --version

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

echo ✅ Docker está ejecutándose

REM Construir e iniciar servicios
echo.
echo 🚀 Construyendo FerreDesk...
docker-compose up --build -d

echo.
echo ⏳ Esperando a que los servicios estén listos...
timeout /t 30 /nobreak >nul

echo.
echo ========================================
echo    INSTALACIÓN COMPLETADA
echo ========================================
echo.
echo 🌐 Abre tu navegador en: http://localhost:8000
echo.
echo 👤 Usuario: admin
echo 🔑 Contraseña: admin123
echo.
echo 📋 Comandos útiles:
echo    Iniciar: docker-compose up -d
echo    Detener: docker-compose down
echo    Ver logs: docker-compose logs -f
echo    Reiniciar: docker-compose restart
echo.
pause 
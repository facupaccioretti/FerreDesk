@echo off
echo ========================================
echo    INSTALADOR FERREDESK v2.0
echo ========================================
echo.

REM Verificar si Git está instalado
git --version >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Git no está instalado!
    echo.
    echo 📥 Descarga Git desde: https://git-scm.com/download/win
    echo 🔄 Después de instalar Git, ejecuta este script nuevamente
    echo.
    pause
    exit /b 1
)

echo ✅ Git detectado: 
git --version

REM Verificar si Docker está instalado
docker --version >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker no está instalado!
    echo.
    echo 📥 Descarga Docker Desktop desde:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo 🔄 Después de instalar Docker, ejecuta este script nuevamente
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

REM Verificar si estamos en el directorio correcto del proyecto
if not exist "docker-compose.yml" (
    echo ❌ Error: No se encontró docker-compose.yml
    echo.
    echo ℹ️  Este script debe ejecutarse desde el directorio raíz del proyecto FerreDesk
    echo 📁 Asegúrate de que el directorio contenga: docker-compose.yml, Dockerfile, etc.
    echo.
    echo 💡 Si acabas de descargar el proyecto:
    echo    1. Extrae todos los archivos en una carpeta
    echo    2. Abre CMD en esa carpeta
    echo    3. Ejecuta install.bat nuevamente
    echo.
    pause
    exit /b 1
)

REM Verificar si existe env.example y crear .env si no existe
if exist "env.example" (
    if not exist ".env" (
        echo ⚙️  Creando archivo de configuración .env...
        copy env.example .env >nul
        echo ✅ Archivo .env creado desde env.example
    ) else (
        echo ℹ️  Archivo .env ya existe, manteniendo configuración actual
    )
) else (
    echo ⚠️  Advertencia: No se encontró env.example
)

REM Construir e iniciar servicios
echo.
echo 🚀 Construyendo FerreDesk (esto puede tomar 5-10 minutos la primera vez)...
docker-compose up --build -d

echo.
echo ⏳ Esperando a que los servicios estén listos...
timeout /t 30 /nobreak >nul

REM Verificar que los servicios están funcionando
echo.
echo 🔍 Verificando estado de los servicios...
docker-compose ps

echo.
echo ========================================
echo    INSTALACIÓN COMPLETADA
echo ========================================
echo.
echo 🌐 Accede a FerreDesk en: http://localhost:8000
echo.
echo 🔑 Credenciales de acceso:
echo    Usuario: admin
echo    Contraseña: admin123
echo.
echo 📋 Comandos útiles:
echo    • Iniciar: start.bat o docker-compose up -d
echo    • Detener: docker-compose down
echo    • Ver logs: docker-compose logs -f
echo    • Reiniciar: docker-compose restart
echo    • Limpiar todo: clean.bat
echo.
echo 💡 Si tienes problemas:
echo    • Revisa que Docker Desktop esté ejecutándose
echo    • Verifica que los puertos 8000 y 5433 estén libres
echo    • Consulta los logs con: docker-compose logs -f
echo.
echo ✅ ¡FerreDesk está listo para usar!
echo.
pause 
@echo off
echo ========================================
echo    ACTUALIZACION FERREDESK v2.0
echo    Actualizando sin perder datos
echo ========================================
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

REM Verificar si es un repositorio git
if not exist ".git" (
    echo ❌ Error: Este directorio no es un repositorio git
    echo.
    echo 💡 Esto significa que fue instalado con una versión anterior del instalador
    echo 🔄 Para habilitar actualizaciones automáticas:
    echo    1. Haz backup de tus datos importantes
    echo    2. Ejecuta clean.bat
    echo    3. Ejecuta super-install.bat (versión actualizada)
    echo.
    pause
    exit /b 1
)

echo ✅ Docker está ejecutándose
echo ✅ Directorio git detectado
echo.

REM Hacer backup del archivo .env
if exist ".env" (
    echo 📋 Haciendo backup de configuración...
    copy ".env" ".env.backup" >nul
    echo ✅ Backup de .env creado
)

REM Mostrar estado actual
echo.
echo 📊 Estado actual:
git log --oneline -1
echo.

REM Actualizar código desde GitHub
echo.
echo 🔄 Actualizando código desde GitHub...
git fetch origin
if %errorlevel% neq 0 (
    echo ❌ Error al conectar con GitHub
    echo.
    echo 💡 Verifica tu conexión a internet
    echo.
    pause
    exit /b 1
)

REM Verificar si hay actualizaciones disponibles
git status -uno | findstr "Your branch is up to date" >nul
if %errorlevel% equ 0 (
    echo ✅ Ya tienes la versión más reciente
    echo.
    pause
    exit /b 0
)

echo ⚠️  Actualizaciones disponibles
echo.
git log --oneline HEAD..origin/main
echo.

set /p confirm="¿Quieres actualizar ahora? (S/N): "
if /i not "%confirm%"=="S" (
    echo ❌ Actualización cancelada
    pause
    exit /b 0
)

REM Detener servicios
echo.
echo 🛑 Deteniendo servicios...
docker-compose down
if %errorlevel% neq 0 (
    echo ❌ Error al detener servicios
    pause
    exit /b 1
)

REM Aplicar actualizaciones
echo.
echo 📥 Aplicando actualizaciones...
git reset --hard origin/main
if %errorlevel% neq 0 (
    echo ❌ Error al aplicar actualizaciones
    echo.
    echo 🔄 Restaurando configuración...
    if exist ".env.backup" (
        copy ".env.backup" ".env" >nul
    )
    echo.
    echo 🚀 Reiniciando servicios...
    docker-compose up -d
    pause
    exit /b 1
)

REM Restaurar configuración si se perdió
if not exist ".env" (
    if exist ".env.backup" (
        echo 🔄 Restaurando configuración...
        copy ".env.backup" ".env" >nul
        echo ✅ Configuración restaurada
    ) else if exist "env.example" (
        echo ⚙️  Creando configuración desde ejemplo...
        copy "env.example" ".env" >nul
        echo ✅ Configuración creada desde env.example
    )
)

REM Reconstruir e iniciar servicios
echo.
echo 🔨 Reconstruyendo servicios con código actualizado...
docker-compose up --build -d
if %errorlevel% neq 0 (
    echo ❌ Error al reconstruir servicios
    echo.
    echo 💡 Posibles soluciones:
    echo    • Verifica que Docker Desktop esté ejecutándose
    echo    • Consulta los logs con: docker-compose logs -f
    echo.
    pause
    exit /b 1
)

echo.
echo ⏳ Esperando a que los servicios estén listos...
timeout /t 30 /nobreak >nul

REM Verificar estado de los servicios
echo.
echo 🔍 Verificando estado de los servicios...
docker-compose ps

REM Verificar que la aplicación responde
echo.
echo 🌐 Verificando que la aplicación responda...
powershell -Command "try { Invoke-WebRequest -Uri http://localhost:8000 -Method Head -TimeoutSec 10 | Out-Null; Write-Host '✅ Aplicación web respondiendo correctamente' } catch { Write-Host '⚠️  La aplicación puede necesitar unos minutos más para estar lista' }"

echo.
echo ========================================
echo    ACTUALIZACION COMPLETADA
echo ========================================
echo.
echo ✅ FerreDesk se ha actualizado exitosamente
echo.
echo 📊 Nueva versión:
git log --oneline -1
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
echo    • Actualizar: update.bat
echo.
echo 💡 Si tienes problemas:
echo    • Revisa que Docker Desktop esté ejecutándose
echo    • Verifica que los puertos 8000 y 5433 estén libres
echo    • Consulta los logs con: docker-compose logs -f
echo.
echo ✅ ¡Disfruta de las nuevas funcionalidades!
echo.
pause

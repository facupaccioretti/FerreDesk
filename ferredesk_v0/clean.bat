@echo off
echo ========================================
echo    LIMPIEZA COMPLETA FERREDESK
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

echo ⚠️  ADVERTENCIA: Esto eliminará todos los datos y contenedores!
echo.
echo 📋 Se eliminarán:
echo    • Todos los contenedores de FerreDesk
echo    • Base de datos PostgreSQL y sus datos
echo    • Imágenes Docker del proyecto
echo    • Volúmenes de datos
echo    • Directorios temporales (data, media, staticfiles)
echo.
set /p confirm="¿Estás seguro? Escribe 'SI' para continuar: "

if /i not "%confirm%"=="SI" (
    echo ❌ Operación cancelada
    pause
    exit /b 0
)

echo.
echo 🧹 Limpiando contenedores...
docker-compose down -v

echo 🗑️  Eliminando imágenes...
docker rmi ferredesk_v0-ferredesk 2>nul
docker rmi postgres:15 2>nul

echo 🧽 Limpiando volúmenes...
docker volume prune -f

echo 🗂️  Limpiando directorios temporales...
if exist "data" (
    rmdir /s /q "data"
    echo    ✅ Directorio data eliminado
)
if exist "media" (
    rmdir /s /q "media"
    echo    ✅ Directorio media eliminado
)
if exist "staticfiles" (
    rmdir /s /q "staticfiles"
    echo    ✅ Directorio staticfiles eliminado
)

REM Eliminar archivo .env si existe (se regenerará en la próxima instalación)
if exist ".env" (
    del ".env"
    echo    ✅ Archivo .env eliminado
)

echo.
echo ========================================
echo    LIMPIEZA COMPLETADA
echo ========================================
echo.
echo ✅ Todos los datos han sido eliminados
echo.
echo 🔄 Para reinstalar ejecuta: install.bat
echo 💡 El proyecto quedará como recién descargado
echo.
pause 
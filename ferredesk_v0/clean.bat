@echo off
echo ========================================
echo    LIMPIEZA COMPLETA FERREDESK
echo ========================================
echo.

echo ⚠️  ADVERTENCIA: Esto eliminará todos los datos!
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
docker rmi ferredesk_ferredesk 2>nul
docker rmi postgres:15 2>nul

echo 🧽 Limpiando volúmenes...
docker volume prune -f

echo 🗂️  Limpiando directorios temporales...
if exist "data" rmdir /s /q "data"
if exist "media" rmdir /s /q "media"
if exist "staticfiles" rmdir /s /q "staticfiles"

echo.
echo ========================================
echo    LIMPIEZA COMPLETADA
echo ========================================
echo.
echo ✅ Todos los datos han sido eliminados
echo.
echo 🔄 Para reinstalar ejecuta: install.bat
echo.
pause 
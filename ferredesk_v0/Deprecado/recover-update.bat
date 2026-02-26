@echo off
echo ========================================
echo    RECUPERACION DE ACTUALIZACION
echo    FerreDesk - Forzar Reconstruccion
echo ========================================
echo.

REM Verificar si Docker está ejecutándose
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Docker no está ejecutándose!
    echo.
    echo Abre Docker Desktop y espera a que esté listo
    echo.
    pause
    exit /b 1
)

REM Verificar si estamos en el directorio correcto
if not exist "docker-compose.yml" (
    echo ERROR: No se encontró docker-compose.yml
    echo.
    echo Ejecuta este script desde el directorio del proyecto FerreDesk
    echo.
    pause
    exit /b 1
)

echo AVISO: Este script FORZARA la reconstrucción completa del frontend
echo.
echo Acciones que realizará:
echo    1. Detener servicios Docker
echo    2. Eliminar caché de Docker (build cache)
echo    3. Reconstruir imagen SIN caché
echo    4. Iniciar servicios
echo    5. Verificar que el build sea exitoso
echo.

set /p confirm="¿Quieres continuar? (S/N): "
if /i not "%confirm%"=="S" (
    echo Operación cancelada
    pause
    exit /b 0
)

echo.
echo Deteniendo servicios...
docker-compose down
if %errorlevel% neq 0 (
    echo AVISO: Advertencia al detener servicios (puede ser normal si no estaban corriendo)
)

echo.
echo Limpiando caché de build...
docker builder prune -af --filter "until=1h"
echo Caché limpiado

echo.
echo Eliminando imágenes antiguas del proyecto...
docker rmi ferredesk_v0-ferredesk 2>nul
docker rmi ferredesk_v0_ferredesk 2>nul
echo Imágenes antiguas eliminadas

echo.
echo Reconstruyendo imagen COMPLETAMENTE (sin caché)...
docker-compose build --no-cache
if %errorlevel% neq 0 (
    echo ERROR: Error al construir la imagen
    echo.
    echo Posibles soluciones:
    echo    - Verifica que tienes suficiente espacio en disco
    echo    - Revisa que Docker Desktop tenga suficiente RAM asignada (mínimo 4GB)
    echo    - Consulta los logs de Docker Desktop
    echo.
    pause
    exit /b 1
)

echo Imagen reconstruida exitosamente

echo.
echo Iniciando servicios...
docker-compose up -d
if %errorlevel% neq 0 (
    echo ERROR: Error al iniciar servicios
    echo.
    echo Consulta los logs con: docker-compose logs -f
    echo.
    pause
    exit /b 1
)

echo.
echo Esperando a que los servicios estén listos...
timeout /t 30 /nobreak >nul

echo.
echo Verificando estado de los servicios...
docker-compose ps

echo.
echo Verificando que la aplicación responda...
powershell -Command "try { $response = Invoke-WebRequest -Uri http://localhost:8000 -Method Head -TimeoutSec 30 -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Host 'Aplicación web respondiendo correctamente' } else { Write-Host 'AVISO: La aplicación responde pero con error de estado' } } catch { Write-Host 'ERROR: La aplicación no responde correctamente' }"

echo.
echo Verificando que el frontend se haya construido correctamente...
docker exec ferredesk_app ls -la /app/frontend/build/index.html 2>nul
if %errorlevel% equ 0 (
    echo Frontend construido correctamente
) else (
    echo ERROR: Frontend NO se construyó correctamente
    echo.
    echo Consulta los logs con: docker-compose logs ferredesk
    echo.
)

echo.
echo ========================================
echo    RECUPERACION COMPLETADA
echo ========================================
echo.
echo Reconstrucción forzada completada
echo.
echo Estado:
git log --oneline -1
echo.
echo Accede a FerreDesk en: http://localhost:8000
echo.
echo Comandos útiles:
echo    - Ver logs: docker-compose logs -f
echo    - Reiniciar: docker-compose restart
echo    - Ver logs del frontend: docker-compose logs -f ferredesk | findstr /C:"frontend"
echo.
echo Si aún hay problemas:
echo    - Consulta los logs completos: docker-compose logs -f ferredesk
echo    - Verifica espacio en disco y RAM disponible
echo    - Considera ejecutar clean.bat y luego install.bat para reinstalación completa
echo.
pause

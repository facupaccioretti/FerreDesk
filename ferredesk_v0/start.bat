@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

REM ===== Configuracion Debug =====
set "MODO_DEBUG=1"
set "RUTA_LOG_DEBUG=%~dp0start-debug.log"
if "%MODO_DEBUG%"=="1" (
    echo [DEBUG] Inicio start.bat %date% %time%>>"%RUTA_LOG_DEBUG%"
)

REM Rutas de Docker Desktop (definidas fuera de bloques)
set "RUTA_DOCKER1=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
set "RUTA_DOCKER2=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
set "RUTA_DOCKER3=%LocalAppData%\Docker\Docker Desktop.exe"

echo 🚀 Iniciando FerreDesk...
echo.
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Verificando estado de Docker

REM ===== Resolver ubicacion de docker y docker compose =====
set "DOCKER_CMD=docker"
where docker >nul 2>nul
if !errorlevel! neq 0 (
    if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" set "DOCKER_CMD=%ProgramFiles%\Docker\Docker\resources\bin\docker.exe"
    if exist "%ProgramFiles(x86)%\Docker\Docker\resources\bin\docker.exe" set "DOCKER_CMD=%ProgramFiles(x86)%\Docker\Docker\resources\bin\docker.exe"
)
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] DOCKER_CMD="%DOCKER_CMD%"

set "COMPOSE_CMD=docker-compose"
where docker-compose >nul 2>nul
if !errorlevel! neq 0 (
    set "COMPOSE_CMD=%DOCKER_CMD% compose"
)
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] COMPOSE_CMD="%COMPOSE_CMD%"

REM Verificar si Docker está ejecutándose
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Ejecutando: "%DOCKER_CMD%" info
"%DOCKER_CMD%" info >nul 2>nul
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] docker info result: !errorlevel!
if !errorlevel! neq 0 (
    call :iniciar_docker
) else (
    if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Docker ya está ejecutándose, continuando
)
 :continuar_post_docker

REM Verificar si estamos en el directorio correcto
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Verificando docker-compose.yml en: %cd%
if not exist "docker-compose.yml" (
    echo ❌ Error: No se encontró docker-compose.yml
    echo.
    echo 📁 Ejecuta este script desde el directorio del proyecto FerreDesk
    echo.
    if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] docker-compose.yml NO encontrado en %cd%
    pause
    exit /b 1
) else (
    if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] docker-compose.yml encontrado, continuando
)

REM Verificar si los servicios están ejecutándose
%COMPOSE_CMD% ps | findstr "Up" >nul
if !errorlevel! neq 0 (
    echo ⚠️  Los servicios no están ejecutándose
    echo 🔄 Iniciando servicios...
    if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Ejecutando: %COMPOSE_CMD% up -d
    %COMPOSE_CMD% up -d
    timeout /t 15 /nobreak >nul
)

REM Verificar estado final de los servicios
echo.
echo 🔍 Verificando estado de los servicios...
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Ejecutando: %COMPOSE_CMD% ps
%COMPOSE_CMD% ps

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

goto :eof 

:iniciar_docker
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Docker no disponible, iniciando Docker Desktop
echo Docker no está ejecutándose. Intentando iniciar Docker Desktop...
echo.
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Docker no disponible, buscando y lanzando Docker Desktop

set "DOCKER_EXE_PATH="
if exist "%RUTA_DOCKER1%" set "DOCKER_EXE_PATH=%RUTA_DOCKER1%"
if exist "%RUTA_DOCKER2%" set "DOCKER_EXE_PATH=%RUTA_DOCKER2%"
if exist "%RUTA_DOCKER3%" set "DOCKER_EXE_PATH=%RUTA_DOCKER3%"

if defined DOCKER_EXE_PATH (
    if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Lanzando: "!DOCKER_EXE_PATH!"
    powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '!DOCKER_EXE_PATH!'"
) else (
    echo No se encontro Docker Desktop instalado.
    echo Abre Docker Desktop manualmente y vuelve a ejecutar este script.
    echo.
    if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Docker Desktop no encontrado. Abortando
    pause
    exit /b 1
)

REM Espera activa hasta que Docker Desktop inicie completamente
set "TIEMPO_ESPERA_TOTAL=120"
set "INTERVALO_ESPERA=5"
set /a "TIEMPO_TRANSCURRIDO=0"

echo Esperando a que Docker Desktop inicie (hasta %TIEMPO_ESPERA_TOTAL%s)...
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Iniciando espera hasta %TIEMPO_ESPERA_TOTAL%s
set /a "INTENTOS=%TIEMPO_ESPERA_TOTAL% / %INTERVALO_ESPERA%"
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Intentos calculados: !INTENTOS!
for /l %%I in (1,1,24) do (
    if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Intento %%I de 24, verificando Docker...
    "%DOCKER_CMD%" info >nul 2>nul
    if !errorlevel! equ 0 (
        if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Docker Desktop listo tras !TIEMPO_TRANSCURRIDO!s
        exit /b 0
    )
    if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Docker no listo, esperando 5s...
    timeout /t 5 /nobreak >nul
    set /a "TIEMPO_TRANSCURRIDO+=5"
    if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Espera completada, tiempo transcurrido: !TIEMPO_TRANSCURRIDO!s
)

echo Docker no inicio a tiempo. Intenta abrir Docker Desktop y reintenta.
if "%MODO_DEBUG%"=="1" >>"%RUTA_LOG_DEBUG%" echo [DEBUG] Timeout esperando Docker
pause
exit /b 1 
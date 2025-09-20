@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

REM ========================================
REM    CONFIGURACION Y DEBUG
REM ========================================
REM Activar (1) o desactivar (0) modo debug detallado
set "MODO_DEBUG=1"
REM Ruta de archivo log para debug (en el mismo directorio del script)
set "RUTA_LOG_DEBUG=%~dp0super-install-debug.log"
REM Tiempo total para esperar que Docker inicie (segundos)
set "TIEMPO_ESPERA_DOCKER=120"
REM Intervalo entre reintentos de chequeo de Docker (segundos)
set "INTERVALO_ESPERA=5"

if "%MODO_DEBUG%"=="1" (
    echo [DEBUG] Inicio de ejecucion %date% %time% >> "%RUTA_LOG_DEBUG%"
)

echo ========================================
echo    SUPER INSTALADOR FERREDESK v2.0
echo    Instalacion completa desde GitHub
echo ========================================
echo.

REM Verificar permisos de administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Este script necesita permisos de administrador
    echo.
    echo [INFO] Haz clic derecho en el archivo y selecciona "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

echo [OK] Ejecutandose con permisos de administrador
if "%MODO_DEBUG%"=="1" call :debug "Permisos de administrador verificados"

REM Instalar Chocolatey usando el script de PowerShell externo
powershell -ExecutionPolicy Bypass -File "%~dp0install_choco.ps1"
set "CHOCO_RESULT=%errorlevel%"

REM ERRORLEVEL 3010 significa: instalacion exitosa, se necesita reinicio.
if %CHOCO_RESULT% equ 3010 (
    echo.
    echo [INFO] REINICIO DEL SCRIPT REQUERIDO
    echo    Chocolatey se ha instalado. Para continuar, cierra esta ventana
    echo    y vuelve a ejecutar 'super-install.bat' como administrador.
    echo.
    pause
    exit /b 0
)

REM Cualquier otro ERRORLEVEL mayor o igual a 1 es un error.
if %CHOCO_RESULT% geq 1 (
    echo.
    echo [ERROR] El script de instalacion de Chocolatey fallo. Revisa los mensajes anteriores.
    echo.
    pause
    exit /b 1
)

REM Si llegamos aqui, CHOCO_RESULT es 0, significa que ya estaba instalado.

echo.
echo ========================================
echo    INSTALANDO DEPENDENCIAS
echo ========================================

REM Verificar e instalar Git
echo.
echo [INFO] Verificando Git...
where git >nul 2>nul
if ERRORLEVEL 1 (
    echo [INFO] Instalando Git...
    choco install git -y
    
    REM Verificar si Git se instalo correctamente, ignorando el errorlevel de choco
    where git >nul 2>nul
    if ERRORLEVEL 1 (
        echo [ERROR] Error al instalar Git
        echo.
        echo [INFO] Instalacion manual:
        echo    Descarga Git desde: https://git-scm.com/download/win
        echo.
        pause
        exit /b 1
    )
    
    echo [OK] Git instalado exitosamente
    
    REM Recargar variables de entorno
    call :refreshenv_safe
) else (
    echo [OK] Git ya esta instalado
    git --version
    if "%MODO_DEBUG%"=="1" call :debug "Git detectado"
)

REM Verificar e instalar Docker Desktop
echo.
echo [INFO] Verificando Docker Desktop...
where docker >nul 2>nul
if ERRORLEVEL 1 (
    echo [INFO] Instalando Docker Desktop...
    echo    NOTA: Docker Desktop requiere reinicio del sistema
    
    choco install docker-desktop -y --force
    
    echo [OK] Docker Desktop instalado exitosamente
    echo.
    echo [WARNING]  REINICIO DEL SISTEMA REQUERIDO
    echo.
    echo [INFO] Pasos siguientes:
    echo    1. Reinicia tu computadora
    echo    2. Abre Docker Desktop y espera a que este listo
    echo    3. Ejecuta este script nuevamente
    echo.
    pause
    exit /b 0
) else (
    echo [OK] Docker Desktop ya esta instalado
    docker --version
    if "%MODO_DEBUG%"=="1" call :debug "Docker Desktop detectado"
)

REM Verificar si Docker está ejecutándose
echo.
echo [INFO] Verificando que Docker este ejecutandose...
echo.
echo [IMPORTANTE] Asegurate de que Docker Desktop este iniciado y funcionando
echo    correctamente antes de continuar.
echo.
echo    Busca el icono de la ballena en tu barra de tareas. Si no esta,
echo    inicia Docker Desktop manualmente desde el menu de inicio.
echo.
pause

echo.
echo ========================================
echo    DESCARGANDO FERREDESK
echo ========================================

REM Crear directorio para FerreDesk si no existe
if not exist "FerreDesk" (
    echo [INFO] Creando directorio FerreDesk...
    mkdir FerreDesk
)

cd FerreDesk

REM Verificar si ya existe el proyecto
if exist "ferredesk_v0" (
    echo [WARNING]  El directorio ferredesk_v0 ya existe.
    set /p update="¿Quieres actualizar el codigo existente? (S/N): "
    if /i "!update!"=="S" (
        echo [INFO] Actualizando codigo existente...
        cd ferredesk_v0
        git pull origin main
        if %errorlevel% neq 0 (
            echo [ERROR] Error al actualizar. Intentando resetear...
            git reset --hard origin/main
        )
        cd ..
    ) else (
        echo [INFO]  Usando codigo existente
    )
) else (
    REM Descargar código desde GitHub
    echo.
    echo [INFO] Descargando FerreDesk desde GitHub...
    echo    Esto puede tomar unos minutos...
    
    REM Descargar desde GitHub
    git clone https://github.com/facupaccioretti/FerreDesk.git ferredesk_temp
    
    REM Crear directorio ferredesk_v0 si no existe
    if not exist "ferredesk_v0" mkdir ferredesk_v0
    
    REM Copiar todo el contenido manteniendo el .git
    xcopy ferredesk_temp\ferredesk_v0\* ferredesk_v0\ /E /H /Y /Q
    if exist "ferredesk_temp\.git" (
        xcopy ferredesk_temp\.git ferredesk_v0\.git\ /E /H /Y /Q
    )
    rmdir /s /q ferredesk_temp
    
    if %errorlevel% neq 0 (
        echo [ERROR] Error al descargar el codigo desde GitHub
        echo.
        echo [INFO] Posibles soluciones:
        echo    • Verifica tu conexion a internet
        echo    • Asegurate de tener acceso al repositorio
        echo    • Contacta al administrador del sistema
        echo.
        pause
        exit /b 1
    )
    
    echo [OK] Codigo descargado exitosamente
)

REM Navegar al directorio del proyecto
cd ferredesk_v0

REM Verificar que tenemos los archivos necesarios
if not exist "docker-compose.yml" (
    echo [ERROR] Error: Archivos del proyecto incompletos
    echo.
    echo [INFO] Intenta eliminar la carpeta FerreDesk y ejecutar el instalador nuevamente
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo    CONFIGURANDO FERREDESK
echo ========================================

REM Crear archivo .env si no existe
if exist "env.example" (
    if not exist ".env" (
        echo [INFO]  Creando archivo de configuracion .env...
        copy env.example .env >nul
        echo [OK] Archivo .env creado desde env.example
    ) else (
        echo [INFO]  Archivo .env ya existe, manteniendo configuracion actual
    )
) else (
    echo [WARNING]  Advertencia: No se encontro env.example
)

echo.
echo ========================================
echo    CONSTRUYENDO E INICIANDO FERREDESK
echo ========================================

REM Construir e iniciar servicios
echo.
echo [INFO] Construyendo FerreDesk (esto puede tomar 5-10 minutos la primera vez)...
echo    [INFO] Descargando imagenes Docker...
echo    [INFO] Instalando dependencias Python...
echo    [INFO] Instalando dependencias Node.js...
echo    [INFO] Construyendo aplicacion React...
echo    [INFO] Configurando base de datos...
echo.

docker-compose up --build -d

if %errorlevel% neq 0 (
    echo [ERROR] Error al construir o iniciar FerreDesk
    echo.
    echo [INFO] Posibles soluciones:
    echo    • Verifica que Docker Desktop este ejecutandose
    echo    • Revisa que los puertos 8000 y 5433 esten libres
    echo    • Consulta los logs con: docker-compose logs -f
    echo.
    pause
    exit /b 1
)
if "%MODO_DEBUG%"=="1" call :debug "docker-compose up finalizo - errorlevel=%errorlevel%"

echo.
echo [INFO] Esperando a que los servicios esten listos...
timeout /t 30 /nobreak >nul

REM Verificar que los servicios están funcionando
echo.
echo [INFO] Verificando estado de los servicios...
docker-compose ps
if "%MODO_DEBUG%"=="1" call :debug "docker-compose ps ejecutado - errorlevel=%errorlevel%"

REM Verificar que la aplicación responde
echo.
echo [INFO] Verificando que la aplicacion web responda...
powershell -Command "try { Invoke-WebRequest -Uri http://localhost:8000 -Method Head -TimeoutSec 10 | Out-Null; Write-Host '[OK] Aplicacion web respondiendo correctamente' } catch { Write-Host '[WARNING]  La aplicacion puede necesitar unos minutos mas para estar lista' }"
if "%MODO_DEBUG%"=="1" call :debug "Chequeo HTTP a http://localhost:8000 ejecutado"

echo.
echo ========================================
echo    INSTALACION COMPLETADA EXITOSAMENTE
echo ========================================
echo.
echo [SUCCESS] ¡FerreDesk se ha instalado y configurado automaticamente!
echo.
echo [INFO] Accede a FerreDesk en: http://localhost:8000
echo.
echo [INFO] Credenciales de acceso:
echo    Usuario: admin
echo    Contraseña: admin123
echo.
echo [INFO] Comandos utiles (desde el directorio ferredesk_v0):
echo    • Iniciar: start.bat o docker-compose up -d
echo    • Detener: docker-compose down
echo    • Ver logs: docker-compose logs -f
echo    • Reiniciar: docker-compose restart
echo    • Actualizar codigo: update.bat
echo    • Limpiar todo: clean.bat
echo.
echo [INFO] Si tienes problemas:
echo    • Revisa que Docker Desktop este ejecutandose
echo    • Verifica que los puertos 8000 y 5433 esten libres
echo    • Consulta los logs con: docker-compose logs -f
echo.
echo [INFO] ¡Disfruta usando FerreDesk!
echo.
pause

goto :eof

:debug
if "%MODO_DEBUG%"=="1" (
    echo [DEBUG] %~1
    >> "%RUTA_LOG_DEBUG%" echo [DEBUG] %date% %time% - %~1
)
exit /b 0

:refreshenv_safe
call :debug "Intentando recargar variables de entorno con refreshenv"
where refreshenv >nul 2>nul
if %errorlevel% equ 0 (
    call refreshenv
    if %errorlevel% neq 0 (
        echo [WARNING]  refreshenv retorno %errorlevel%, continuando...
        call :debug "refreshenv retorno %errorlevel%"
    ) else (
        echo [OK] Variables de entorno recargadas
        call :debug "refreshenv OK"
    )
) else (
    echo [WARNING]  refreshenv no esta disponible en esta sesion, continuando...
    call :debug "refreshenv no encontrado en PATH"
)
exit /b 0

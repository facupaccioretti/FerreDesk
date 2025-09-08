@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    SUPER INSTALADOR FERREDESK v2.0
echo    Instalacion automatica completa
echo ========================================
echo.

REM Verificar permisos de administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Este script necesita permisos de administrador
    echo.
    echo 🔄 Haz clic derecho en el archivo y selecciona "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

echo ✅ Ejecutandose con permisos de administrador

REM Verificar si Chocolatey está instalado (gestor de paquetes para Windows)
choco --version >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo 📦 Instalando Chocolatey (gestor de paquetes)...
    echo    Esto es necesario para instalar Git y Docker automaticamente
    echo.
    
    REM Instalar Chocolatey
    powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    
    if %errorlevel% neq 0 (
        echo ❌ Error al instalar Chocolatey
        echo.
        echo 💡 Instalacion manual requerida:
        echo    1. Ve a https://chocolatey.org/install
        echo    2. Sigue las instrucciones de instalacion
        echo    3. Ejecuta este script nuevamente
        echo.
        pause
        exit /b 1
    )
    
    echo ✅ Chocolatey instalado exitosamente
    
    REM Recargar variables de entorno
    call refreshenv
) else (
    echo ✅ Chocolatey ya esta instalado
    choco --version
)

echo.
echo ========================================
echo    INSTALANDO DEPENDENCIAS
echo ========================================

REM Verificar e instalar Git
echo.
echo 📥 Verificando Git...
git --version >nul 2>nul
if %errorlevel% neq 0 (
    echo ⏳ Instalando Git...
    choco install git -y
    
    if %errorlevel% neq 0 (
        echo ❌ Error al instalar Git
        echo.
        echo 💡 Instalacion manual:
        echo    Descarga Git desde: https://git-scm.com/download/win
        echo.
        pause
        exit /b 1
    )
    
    echo ✅ Git instalado exitosamente
    
    REM Recargar variables de entorno
    call refreshenv
) else (
    echo ✅ Git ya esta instalado
    git --version
)

REM Verificar e instalar Docker Desktop
echo.
echo 🐳 Verificando Docker Desktop...
docker --version >nul 2>nul
if %errorlevel% neq 0 (
    echo ⏳ Instalando Docker Desktop...
    echo    NOTA: Docker Desktop requiere reinicio del sistema
    
    choco install docker-desktop -y
    
    if %errorlevel% neq 0 (
        echo ❌ Error al instalar Docker Desktop
        echo.
        echo 💡 Instalacion manual:
        echo    1. Ve a https://www.docker.com/products/docker-desktop/
        echo    2. Descarga Docker Desktop for Windows
        echo    3. Instala y reinicia el sistema
        echo    4. Ejecuta este script nuevamente
        echo.
        pause
        exit /b 1
    )
    
    echo ✅ Docker Desktop instalado exitosamente
    echo.
    echo ⚠️  REINICIO REQUERIDO
    echo.
    echo 🔄 Pasos siguientes:
    echo    1. Reinicia tu computadora
    echo    2. Abre Docker Desktop y espera a que este listo
    echo    3. Ejecuta este script nuevamente
    echo.
    pause
    exit /b 0
) else (
    echo ✅ Docker Desktop ya esta instalado
    docker --version
)

REM Verificar si Docker está ejecutándose
echo.
echo 🔍 Verificando que Docker este ejecutandose...
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Docker no esta ejecutandose
    echo.
    echo 🔄 Intentando iniciar Docker Desktop...
    
    REM Intentar iniciar Docker Desktop
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    
    echo ⏳ Esperando a que Docker Desktop inicie (esto puede tomar 1-2 minutos)...
    
    REM Esperar hasta 2 minutos a que Docker inicie
    set /a timeout=120
    :wait_docker
    timeout /t 5 /nobreak >nul
    docker info >nul 2>nul
    if %errorlevel% equ 0 goto docker_ready
    
    set /a timeout-=5
    if %timeout% gtr 0 goto wait_docker
    
    echo ❌ Docker no pudo iniciarse automaticamente
    echo.
    echo 🔄 Pasos manuales:
    echo    1. Abre Docker Desktop manualmente
    echo    2. Espera a que aparezca "Docker Desktop is running"
    echo    3. Ejecuta este script nuevamente
    echo.
    pause
    exit /b 1
    
    :docker_ready
    echo ✅ Docker Desktop esta ejecutandose
) else (
    echo ✅ Docker Desktop esta ejecutandose correctamente
)

echo.
echo ========================================
echo    DESCARGANDO FERREDESK
echo ========================================

REM Crear directorio para FerreDesk si no existe
if not exist "FerreDesk" (
    echo 📁 Creando directorio FerreDesk...
    mkdir FerreDesk
)

cd FerreDesk

REM Verificar si ya existe el proyecto
if exist "ferredesk_v0" (
    echo ⚠️  El directorio ferredesk_v0 ya existe.
    set /p update="¿Quieres actualizar el codigo existente? (S/N): "
    if /i "!update!"=="S" (
        echo 🔄 Actualizando codigo existente...
        cd ferredesk_v0
        git pull origin main
        if %errorlevel% neq 0 (
            echo ❌ Error al actualizar. Intentando resetear...
            git reset --hard origin/main
        )
        cd ..
    ) else (
        echo ℹ️  Usando codigo existente
    )
) else (
    REM Descargar código desde GitLab
    echo.
    echo 📥 Descargando FerreDesk desde GitLab...
    echo    Esto puede tomar unos minutos...
    
    REM NOTA: Reemplaza esta URL con la URL real de tu repositorio GitLab
    git clone https://gitlab.com/TU_USUARIO/ferredesk.git ferredesk_v0
    
    if %errorlevel% neq 0 (
        echo ❌ Error al descargar el codigo desde GitLab
        echo.
        echo 💡 Posibles soluciones:
        echo    • Verifica tu conexion a internet
        echo    • Asegurate de tener acceso al repositorio
        echo    • Contacta al administrador del sistema
        echo.
        pause
        exit /b 1
    )
    
    echo ✅ Codigo descargado exitosamente
)

REM Navegar al directorio del proyecto
cd ferredesk_v0

REM Verificar que tenemos los archivos necesarios
if not exist "docker-compose.yml" (
    echo ❌ Error: Archivos del proyecto incompletos
    echo.
    echo 🔄 Intenta eliminar la carpeta FerreDesk y ejecutar el instalador nuevamente
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
        echo ⚙️  Creando archivo de configuracion .env...
        copy env.example .env >nul
        echo ✅ Archivo .env creado desde env.example
    ) else (
        echo ℹ️  Archivo .env ya existe, manteniendo configuracion actual
    )
) else (
    echo ⚠️  Advertencia: No se encontro env.example
)

echo.
echo ========================================
echo    CONSTRUYENDO E INICIANDO FERREDESK
echo ========================================

REM Construir e iniciar servicios
echo.
echo 🚀 Construyendo FerreDesk (esto puede tomar 5-10 minutos la primera vez)...
echo    ⏳ Descargando imagenes Docker...
echo    ⏳ Instalando dependencias Python...
echo    ⏳ Instalando dependencias Node.js...
echo    ⏳ Construyendo aplicacion React...
echo    ⏳ Configurando base de datos...
echo.

docker-compose up --build -d

if %errorlevel% neq 0 (
    echo ❌ Error al construir o iniciar FerreDesk
    echo.
    echo 💡 Posibles soluciones:
    echo    • Verifica que Docker Desktop este ejecutandose
    echo    • Revisa que los puertos 8000 y 5433 esten libres
    echo    • Consulta los logs con: docker-compose logs -f
    echo.
    pause
    exit /b 1
)

echo.
echo ⏳ Esperando a que los servicios esten listos...
timeout /t 30 /nobreak >nul

REM Verificar que los servicios están funcionando
echo.
echo 🔍 Verificando estado de los servicios...
docker-compose ps

REM Verificar que la aplicación responde
echo.
echo 🌐 Verificando que la aplicacion web responda...
powershell -Command "try { Invoke-WebRequest -Uri http://localhost:8000 -Method Head -TimeoutSec 10 | Out-Null; Write-Host '✅ Aplicacion web respondiendo correctamente' } catch { Write-Host '⚠️  La aplicacion puede necesitar unos minutos mas para estar lista' }"

echo.
echo ========================================
echo    INSTALACION COMPLETADA EXITOSAMENTE
echo ========================================
echo.
echo 🎉 ¡FerreDesk se ha instalado y configurado automaticamente!
echo.
echo 🌐 Accede a FerreDesk en: http://localhost:8000
echo.
echo 🔑 Credenciales de acceso:
echo    Usuario: admin
echo    Contraseña: admin123
echo.
echo 📋 Comandos utiles (desde el directorio ferredesk_v0):
echo    • Iniciar: start.bat o docker-compose up -d
echo    • Detener: docker-compose down
echo    • Ver logs: docker-compose logs -f
echo    • Reiniciar: docker-compose restart
echo    • Limpiar todo: clean.bat
echo.
echo 💡 Si tienes problemas:
echo    • Revisa que Docker Desktop este ejecutandose
echo    • Verifica que los puertos 8000 y 5433 esten libres
echo    • Consulta los logs con: docker-compose logs -f
echo.
echo 🚀 ¡Disfruta usando FerreDesk!
echo.
pause

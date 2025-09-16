@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    INSTALADOR FERREDESK v2.0
echo    Descarga automatica desde GitHub
echo ========================================
echo.

REM Verificar permisos de administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Para instalar dependencias automaticamente necesitas permisos de administrador
    echo.
    set /p admin_choice="¿Quieres continuar sin instalacion automatica? (S/N): "
    if /i "!admin_choice!" neq "S" (
        echo.
        echo 🔄 Haz clic derecho en el archivo y selecciona "Ejecutar como administrador"
        echo    para instalacion completamente automatica
        echo.
        pause
        exit /b 1
    )
    set MANUAL_MODE=1
) else (
    echo ✅ Ejecutandose con permisos de administrador
    set MANUAL_MODE=0
)

REM Verificar e instalar Chocolatey si tenemos permisos de admin
if !MANUAL_MODE! equ 0 (
    choco --version >nul 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo 📦 Instalando Chocolatey (gestor de paquetes)...
        powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
        
        if %errorlevel% neq 0 (
            echo ❌ Error al instalar Chocolatey, continuando en modo manual
            set MANUAL_MODE=1
        ) else (
            echo ✅ Chocolatey instalado exitosamente
            call refreshenv
        )
    ) else (
        echo ✅ Chocolatey ya esta instalado
    )
)

REM Verificar e instalar Git
echo.
echo 📥 Verificando Git...
git --version >nul 2>nul
if %errorlevel% neq 0 (
    if !MANUAL_MODE! equ 0 (
        echo ⏳ Instalando Git automaticamente...
        choco install git -y
        
        if %errorlevel% neq 0 (
            echo ❌ Error al instalar Git automaticamente
            set MANUAL_MODE=1
        ) else (
            echo ✅ Git instalado exitosamente
            call refreshenv
        )
    )
    
    if !MANUAL_MODE! equ 1 (
        echo ❌ Git no está instalado!
        echo.
        echo 📥 Descarga Git desde: https://git-scm.com/download/win
        echo 🔄 Después de instalar Git, ejecuta este script nuevamente
        echo.
        pause
        exit /b 1
    )
) else (
    echo ✅ Git ya esta instalado
    git --version
)

REM Verificar e instalar Docker Desktop
echo.
echo 🐳 Verificando Docker Desktop...
docker --version >nul 2>nul
if %errorlevel% neq 0 (
    if !MANUAL_MODE! equ 0 (
        echo ⏳ Instalando Docker Desktop automaticamente...
        echo    NOTA: Docker Desktop requiere reinicio del sistema
        
        choco install docker-desktop -y
        
        if %errorlevel% neq 0 (
            echo ❌ Error al instalar Docker Desktop automaticamente
            set MANUAL_MODE=1
        ) else (
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
        )
    )
    
    if !MANUAL_MODE! equ 1 (
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
) else (
    echo ✅ Docker Desktop ya esta instalado
    docker --version
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

REM Crear directorio para FerreDesk si no existe
if not exist "FerreDesk" (
    echo 📁 Creando directorio FerreDesk...
    mkdir FerreDesk
)

cd FerreDesk

REM Verificar si ya existe el proyecto
if exist "ferredesk_v0" (
    echo ⚠️  El directorio ferredesk_v0 ya existe.
    set /p update="¿Quieres actualizar el código existente? (S/N): "
    if /i "%update%"=="S" (
        echo 🔄 Actualizando código existente...
        cd ferredesk_v0
        git pull origin main
        if %errorlevel% neq 0 (
            echo ❌ Error al actualizar. Intentando resetear...
            git reset --hard origin/main
        )
        cd ..
    ) else (
        echo ℹ️  Usando código existente
    )
) else (
    REM Descargar código desde GitHub
    echo.
    echo 📥 Descargando FerreDesk desde GitHub...
    echo    Esto puede tomar unos minutos...
    
    REM Descargar desde GitHub
    git clone https://github.com/facupaccioretti/FerreDesk.git ferredesk_temp
    
    REM Mover solo el contenido de ferredesk_v0 al directorio correcto
    move ferredesk_temp\ferredesk_v0 ferredesk_v0
    rmdir /s /q ferredesk_temp
    
    if %errorlevel% neq 0 (
        echo ❌ Error al descargar el código desde GitHub
        echo.
        echo 💡 Posibles soluciones:
        echo    • Verifica tu conexión a internet
        echo    • Asegúrate de tener acceso al repositorio
        echo    • Contacta al administrador del sistema
        echo.
        pause
        exit /b 1
    )
    
    echo ✅ Código descargado exitosamente
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

REM Crear archivo .env si no existe
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
echo 📋 Comandos útiles (desde el directorio ferredesk_v0):
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

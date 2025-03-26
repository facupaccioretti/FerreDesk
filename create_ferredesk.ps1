Write-Host "🛠️ Iniciando setup de FerreDesk..." -ForegroundColor Cyan

# Ruta base del script
$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Check-Command {
    param([string]$cmd)
    $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

# --- Verificaciones de herramientas ---
if (-not (Check-Command python)) {
    Write-Host "Python no está instalado. Instalalo desde https://www.python.org/" -ForegroundColor Red
    exit 1
}

if (-not (Check-Command pip)) {
    Write-Host "pip no está instalado. Asegurate de haber marcado 'Add to PATH' al instalar Python." -ForegroundColor Red
    exit 1
}

if (-not (Check-Command node)) {
    Write-Host "Node.js no está instalado. Instalalo desde https://nodejs.org/" -ForegroundColor Red
    exit 1
}

if (-not (Check-Command npm)) {
    Write-Host "npm no está instalado. Reinstalá Node.js correctamente." -ForegroundColor Red
    exit 1
}

if (-not (Check-Command npx)) {
    Write-Host " npx no encontrado. Intentando actualizar npm..." -ForegroundColor Yellow
    npm install -g npm
}

# --- Crear carpetas ---
Write-Host "Creando estructura de carpetas..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "$BaseDir\ferredesk\backend" | Out-Null
New-Item -ItemType Directory -Force -Path "$BaseDir\ferredesk\frontend" | Out-Null

# --- BACKEND ---
Write-Host " Configurando entorno backend..." -ForegroundColor Green
Set-Location "$BaseDir\ferredesk\backend"

if (-not (Test-Path "venv")) {
    python -m venv venv
    Write-Host " Entorno virtual creado."
}
else {
    Write-Host "Entorno virtual ya existe."
}

& "$BaseDir\ferredesk\backend\venv\Scripts\activate.ps1"

$pkgs = @("fastapi", "uvicorn", "sqlalchemy", "psycopg2-binary", "pydantic")
foreach ($pkg in $pkgs) {
    $installed = pip show $pkg 2>&1
    if ($installed -match "Name: $pkg") {
        Write-Host "$pkg ya está instalado."
    }
    else {
        Write-Host " Instalando $pkg..."
        pip install $pkg
    }
}

# Desactivar entorno
& "$BaseDir\ferredesk\backend\venv\Scripts\deactivate.bat"
Set-Location $BaseDir

# --- FRONTEND ---
Write-Host " Configurando frontend..." -ForegroundColor Green
Set-Location "$BaseDir\ferredesk\frontend"

if (-not (Test-Path "package.json")) {
    npm init -y
}
else {
    Write-Host "package.json ya existe."
}

if (-not (Test-Path "node_modules/react")) {
    npm install react react-dom
}
else {
    Write-Host "React ya está instalado."
}

if (-not (Test-Path "node_modules/tailwindcss")) {
    npm install -D tailwindcss postcss autoprefixer
    npx tailwindcss init -p
}
else {
    Write-Host " Tailwind CSS ya está instalado."
}

Set-Location $BaseDir

# --- FINAL ---
Write-Host ""
Write-Host " FerreDesk está listo para desarrollar." -ForegroundColor Green
Write-Host " Activá backend con: .\ferredesk\backend\venv\Scripts\Activate.ps1"
Write-Host " Iniciá frontend con: cd ferredesk\frontend"

# ========================================
#    INSTALADOR FERREDESK v1.0.0
#    Arquitectura: Imágenes pre-compiladas
# ========================================
# Requiere: Windows 10/11 (64-bit)
# Requiere: Permisos de Administrador
# ========================================

<#
.SYNOPSIS
    Instalador FerreDesk usando imágenes Docker pre-compiladas.
.DESCRIPTION
    - Fase 1: Instala WSL2, Chocolatey, Docker Desktop (requiere reinicio)
    - Fase 2: Verifica Docker Desktop funcionando
    - Fase 3: Descarga imágenes de Docker Hub, genera .env, inicia servicios
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)][string]$InstallDirectory,
    [Parameter(Mandatory=$false)][switch]$Silent,
    [Parameter(Mandatory=$false)][string]$LogPath,
    [Parameter(Mandatory=$false)][string]$ProgressFile,
    [Parameter(Mandatory=$false)][string]$Phase,
    [Parameter(Mandatory=$false)][string]$StateFile,
    [Parameter(Mandatory=$false)][switch]$Resume,
    [Parameter(Mandatory=$false)][switch]$Repair,
    [Parameter(Mandatory=$false)][switch]$Update,
    [Parameter(Mandatory=$false)][switch]$Reinstall,
    [Parameter(Mandatory=$false)][switch]$NoOpenBrowser,
    [Parameter(Mandatory=$false)][int]$ParentPid
)

# ========================================
#    CONFIGURACION
# ========================================

$Script:ModoDebug = -not $Silent
$Script:ProgramDataRoot = Join-Path $env:ProgramData "FerreDesk"
$Script:ConfigDirectory = Join-Path $Script:ProgramDataRoot "config"
$Script:LogsDirectory = Join-Path $Script:ProgramDataRoot "logs"
$Script:DefaultLogPath = Join-Path $Script:LogsDirectory "FerreDesk-Installer.log"
$Script:DefaultStateFile = Join-Path $Script:ProgramDataRoot "installer-state.json"
$Script:RegistryBasePath = "HKLM:\SOFTWARE\FerreDesk\Installer"

# Imagen Docker Hub
$Script:DockerImage = "lautajuare/ferredesk:1.0.0"

# Timeouts
$Script:DockerWaitTimeout = 600

# ========================================
#    EXIT CODES (CRÍTICO)
# ========================================
# Estos valores deben coincidir con los que espera Inno Setup
$Script:EXIT_SUCCESS = 0          # Instalación exitosa
$Script:EXIT_ERROR = -1           # Error genérico
$Script:EXIT_NEEDS_RESTART = 3010 # Código estándar de Windows para "reinicio requerido"
$Script:ServicesWaitTimeout = 300
$Script:WSLWaitTimeout = 120

# Archivo de log
if ($LogPath) { $Script:LogFile = $LogPath } 
else { $Script:LogFile = $Script:DefaultLogPath }

$Script:ProgressFile = $ProgressFile

if ($StateFile) { $Script:StateFilePath = $StateFile }
else { $Script:StateFilePath = $Script:DefaultStateFile }

$Script:InstallDirectory = $null
$Script:ParentPid = $null
$Script:ParentMonitorJob = $null
$Script:ConteoFallasProcesoPadre = 0
$Script:AvisoSinParentPidMostrado = $false

$ErrorActionPreference = "Continue"
$Script:ErrorCount = 0
$Script:Errors = @()
$Script:CurrentState = $null

# Exit codes
$Script:EXIT_SUCCESS = 0
$Script:EXIT_ERROR = -1
$Script:EXIT_NEEDS_RESTART = 3010

# Error categories
$Script:ERROR_CATEGORY_DOCKER_NOT_READY = "DOCKER_NOT_READY"
$Script:ERROR_CATEGORY_ALREADY_INSTALLED = "ALREADY_INSTALLED"
$Script:ERROR_CATEGORY_RESTART_REQUIRED = "RESTART_REQUIRED"
$Script:ERROR_CATEGORY_GENERIC_ERROR = "GENERIC_ERROR"
$Script:ERROR_CATEGORY_SERVICES_NOT_RESPONDING = "SERVICES_NOT_RESPONDING"

# ========================================
#    FUNCIONES DE LOGGING (del instalador original)
# ========================================

function VerificarDirectorioLog {
    try {
        $logDir = Split-Path -Path $Script:LogFile -Parent
        if (-not $logDir) { return $false }
        if (-not (Test-Path $logDir)) {
            $null = New-Item -ItemType Directory -Path $logDir -Force -ErrorAction Stop
        }
        return (Test-Path $logDir)
    } catch {
        Write-Host "ERROR CRITICO: No se pudo crear el directorio de logs: $logDir" -ForegroundColor Red
        return $false
    }
}

function Write-Log {
    param(
        [string]$Mensaje = "",
        [ValidateSet("INFO", "SUCCESS", "WARNING", "ERROR", "DEBUG", "PROGRESS")]
        [string]$Tipo = "INFO",
        [int]$ProgressPercent = -1
    )
    
    if ([string]::IsNullOrWhiteSpace($Mensaje)) { return }
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMensaje = "[$timestamp] [$Tipo] $Mensaje"
    
    if ($Script:LogFile -and (Test-Path (Split-Path -Path $Script:LogFile -Parent))) {
        try { Add-Content -Path $Script:LogFile -Value $logMensaje -ErrorAction Stop }
        catch { }
    }
    
    if ($Script:ProgressFile -and $Tipo -eq "PROGRESS") {
        Write-ProgressToInno -Mensaje $Mensaje -Percent $ProgressPercent
    }
    
    if (-not $Silent) {
        switch ($Tipo) {
            "SUCCESS" { Write-Host $Mensaje -ForegroundColor Green }
            "WARNING" { Write-Host $Mensaje -ForegroundColor Yellow }
            "ERROR"   { Write-Host $Mensaje -ForegroundColor Red }
            "DEBUG"   { if ($Script:ModoDebug) { Write-Host $Mensaje -ForegroundColor Gray } }
            default   { Write-Host $Mensaje }
        }
    }
}

function Write-Success { param([string]$Mensaje) Write-Log -Mensaje $Mensaje -Tipo "SUCCESS" }
function Write-Warning { param([string]$Mensaje) Write-Log -Mensaje $Mensaje -Tipo "WARNING" }
function Write-Error { param([string]$Mensaje = "Error no especificado.") Write-Log -Mensaje $Mensaje -Tipo "ERROR" }
function Write-Info { param([string]$Mensaje = "") if ($Mensaje) { Write-Log -Mensaje $Mensaje -Tipo "INFO" } }
function Write-Debug { param([string]$Mensaje) Write-Log -Mensaje $Mensaje -Tipo "DEBUG" }

function Write-ProgressToInno {
    param([string]$Mensaje, [int]$Percent = -1)
    if ($Script:ProgressFile) {
        try {
            $content = "PERCENT:$Percent|MESSAGE:$Mensaje|TIMESTAMP:$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            Set-Content -Path $Script:ProgressFile -Value $content -Encoding UTF8 -ErrorAction SilentlyContinue
        } catch { }
    }
}

# ========================================
#    FUNCIONES DE ESTADO (del instalador original)
# ========================================

function Initialize-InstallerStorage {
    $directories = @($Script:ProgramDataRoot, $Script:LogsDirectory, $Script:ConfigDirectory) | Where-Object { $_ }
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            $null = New-Item -ItemType Directory -Path $dir -Force -ErrorAction Stop
        }
    }
    if (-not (Test-Path $Script:RegistryBasePath)) {
        $null = New-Item -Path $Script:RegistryBasePath -Force -ErrorAction SilentlyContinue
    }
}

function Get-DefaultState {
    return [pscustomobject]@{
        CurrentPhase = "FASE_0"
        InstallDirectory = $Script:InstallDirectory
        RequiresRestart = $false
        LastError = $null
        ErrorCategory = $null
        Timestamp = (Get-Date).ToString("o")
        Pid = "$PID"
        ExitCode = $null
    }
}

function Get-InstallationState {
    Initialize-InstallerStorage
    $state = $null
    
    # Primero intentar leer del archivo JSON
    if (Test-Path $Script:StateFilePath) {
        try {
            $json = Get-Content -Path $Script:StateFilePath -Raw -ErrorAction Stop
            if ($json) { $state = $json | ConvertFrom-Json }
        } catch { }
    }
    
    # Si no hay JSON o está vacío, intentar leer del REGISTRO
    # Esto es CRÍTICO para resume porque ISS borra el JSON al iniciar
    if (-not $state -or [string]::IsNullOrWhiteSpace($state.CurrentPhase) -or $state.CurrentPhase -eq "FASE_0") {
        try {
            if (Test-Path $Script:RegistryBasePath) {
                $regCurrentPhase = (Get-ItemProperty -Path $Script:RegistryBasePath -Name "CurrentPhase" -ErrorAction SilentlyContinue).CurrentPhase
                $regInstallDir = (Get-ItemProperty -Path $Script:RegistryBasePath -Name "InstallDirectory" -ErrorAction SilentlyContinue).InstallDirectory
                
                if ($regCurrentPhase -and $regCurrentPhase -ne "FASE_0") {
                    Write-Debug "Recuperando estado desde registro: $regCurrentPhase"
                    $state = Get-DefaultState
                    $state.CurrentPhase = $regCurrentPhase
                    if ($regInstallDir) { $state.InstallDirectory = $regInstallDir }
                }
            }
        } catch { }
    }
    
    if (-not $state) { $state = Get-DefaultState }
    
    if ([string]::IsNullOrWhiteSpace($state.CurrentPhase)) { $state.CurrentPhase = "FASE_0" }
    $Script:CurrentState = $state
    return $state
}

function Set-InstallationState {
    param([pscustomobject]$State)
    Initialize-InstallerStorage
    $State.Timestamp = (Get-Date).ToString("o")
    try {
        $stateJson = $State | ConvertTo-Json -Depth 5
        Set-Content -Path $Script:StateFilePath -Value $stateJson -Encoding UTF8 -Force
    } catch { }
    
    # Escribir al registro
    try {
        if (-not (Test-Path $Script:RegistryBasePath)) {
            New-Item -Path $Script:RegistryBasePath -Force | Out-Null
        }
        Set-ItemProperty -Path $Script:RegistryBasePath -Name "CurrentPhase" -Value $State.CurrentPhase -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $Script:RegistryBasePath -Name "InstallDirectory" -Value $State.InstallDirectory -ErrorAction SilentlyContinue
    } catch { }
    
    $Script:CurrentState = $state
}

function Set-MainExitCodeAndExit {
    param([int]$Codigo, [string]$Contexto, [string]$ErrorCategory = $null)
    try {
        $state = Get-InstallationState
        $state.ExitCode = "$Codigo"
        if ($ErrorCategory) { $state.ErrorCategory = $ErrorCategory }
        Set-InstallationState $state
    } catch { }
    Write-Log "MAIN_EXIT_CODE: $Codigo ($Contexto)" -Tipo "DEBUG"
    exit $Codigo
}

# ========================================
#    FUNCIONES DE VERIFICACION DE SISTEMA
# ========================================

function Test-Administrator {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-WindowsVersion {
    try {
        $version = [System.Environment]::OSVersion.Version
        if ($version.Major -lt 10) {
            Write-Error "Windows 10 o 11 requerido."
            return $false
        }
        if (-not [System.Environment]::Is64BitOperatingSystem) {
            Write-Error "Se requiere Windows 64-bit."
            return $false
        }
        Write-Info "Windows compatible detectado (64-bit)"
        return $true
    } catch {
        Write-Error "Error al verificar Windows: $($_.Exception.Message)"
        return $false
    }
}

function Test-IsTemporaryDirectory {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    $normalizedPath = $Path.TrimEnd('\', '/').ToLower()
    if ($normalizedPath -like "*\temp\*" -or $normalizedPath -like "*\tmp\*" -or $normalizedPath -like "*\is-*") {
        return $true
    }
    return $false
}

function Get-SafeInstallDirectory {
    if ($InstallDirectory -and -not (Test-IsTemporaryDirectory -Path $InstallDirectory)) {
        $dir = $InstallDirectory
    } else {
        $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
        $dir = Join-Path $localAppData "Programs\FerreDesk"
    }
    
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

# ========================================
#    WINDOWS FEATURES Y WSL
# ========================================

function Test-WindowsFeature {
    param([string]$FeatureName)
    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName $FeatureName -ErrorAction SilentlyContinue
        return ($feature -and $feature.State -eq "Enabled")
    } catch { return $false }
}

function Enable-WindowsFeature {
    param([string]$FeatureName)
    if (Test-WindowsFeature -FeatureName $FeatureName) {
        Write-Info "Caracteristica '$FeatureName' ya habilitada"
        return @{ Enabled = $true; RequiresRestart = $false }
    }
    Write-Info "Habilitando: $FeatureName"
    try {
        $result = Enable-WindowsOptionalFeature -Online -FeatureName $FeatureName -NoRestart -All
        $requiresRestart = $result.RestartNeeded -eq $true
        return @{ Enabled = $true; RequiresRestart = $requiresRestart }
    } catch {
        Write-Error "Error al habilitar $FeatureName"
        return @{ Enabled = $false; RequiresRestart = $false }
    }
}

function Test-WSLInstalled {
    try {
        wsl --status 2>&1 | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

function Install-WSL {
    Write-Info "Instalando WSL2..."
    try {
        wsl --install --no-distribution
        $exitCode = $LASTEXITCODE
        if ($exitCode -eq 0) {
            Write-Success "WSL2 instalado"
            return @{ Success = $true; RequiresRestart = $false }
        } elseif ($exitCode -eq 3010) {
            Write-Warning "WSL requiere reinicio"
            return @{ Success = $true; RequiresRestart = $true }
        }
        return @{ Success = $false; RequiresRestart = $false }
    } catch {
        return @{ Success = $false; RequiresRestart = $false }
    }
}

function Update-WSL {
    Write-Info "Actualizando WSL..."
    try { wsl --update; return $true } catch { return $false }
}

# ========================================
#    CHOCOLATEY Y DOCKER
# ========================================

function Test-ChocolateyInstalled {
    return (Test-Path "C:\ProgramData\chocolatey\bin\choco.exe")
}

function Install-Chocolatey {
    if (Test-ChocolateyInstalled) { return $true }
    Write-Info "Instalando Chocolatey..."
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        Start-Sleep -Seconds 3
        return (Test-ChocolateyInstalled)
    } catch {
        Write-Error "Error instalando Chocolatey"
        return $false
    }
}

function Test-DockerInstalled {
    $paths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
    )
    foreach ($path in $paths) { if (Test-Path $path) { return $true } }
    return $false
}

function Install-DockerDesktop {
    if (Test-DockerInstalled) {
        Write-Info "Docker Desktop ya instalado"
        return @{ Success = $true; RequiresRestart = $false; AlreadyInstalled = $true }
    }
    Write-Info "Instalando Docker Desktop (puede tardar varios minutos)..."
    try {
        choco install docker-desktop -y --force --limit-output --no-progress 2>&1 | Out-Null
        Start-Sleep -Seconds 5
        if (Test-DockerInstalled) {
            Write-Success "Docker Desktop instalado"
            return @{ Success = $true; RequiresRestart = $true; AlreadyInstalled = $false }
        }
        return @{ Success = $false; RequiresRestart = $true; AlreadyInstalled = $false }
    } catch {
        return @{ Success = $false; RequiresRestart = $false; AlreadyInstalled = $false }
    }
}

function Test-DockerRunning {
    try {
        docker info 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

function Start-DockerDesktop {
    $paths = @("$env:ProgramFiles\Docker\Docker\Docker Desktop.exe")
    foreach ($path in $paths) {
        if (Test-Path $path) {
            Start-Process -FilePath $path -WindowStyle Hidden
            return $true
        }
    }
    return $false
}

function Wait-ForDockerReady {
    param([int]$TimeoutSeconds = 600)
    Write-Info "Esperando Docker Desktop..."
    $interval = 5
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        if (Test-DockerRunning) {
            Write-Success "Docker Desktop listo"
            return $true
        }
        Start-Sleep -Seconds $interval
        $elapsed += $interval
    }
    Write-Warning "Timeout esperando Docker"
    return $false
}

# ========================================
#    FUNCIONES NUEVAS: DOCKER HUB E .ENV
# ========================================

function New-SecureSecretKey {
    Add-Type -AssemblyName System.Security
    $bytes = New-Object byte[] 50
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function New-SecurePassword {
    Add-Type -AssemblyName System.Security
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return ([Convert]::ToBase64String($bytes) -replace '[+/=]', '')
}

function New-EnvironmentFile {
    param([string]$EnvPath)
    
    # Si ya existe, preservar
    if (Test-Path $EnvPath) {
        Write-Info "Archivo .env existente, preservando configuracion"
        return $true
    }
    
    Write-Info "Generando archivo .env con configuracion segura..."
    
    $secretKey = New-SecureSecretKey
    $dbPassword = New-SecurePassword
    
    # Extraer version de la imagen Docker (formato: imagen:version)
    $dockerVersion = "1.0.0"
    if ($Script:DockerImage -match ':([^:]+)$') {
        $dockerVersion = $matches[1]
    }
    
    $envContent = @"
# FerreDesk Production Configuration
# Generado automaticamente - NO COMPARTIR

ENVIRONMENT=production
DEBUG=False

# FerreDesk Version
FERREDESK_VERSION=$dockerVersion

# Database
POSTGRES_DB=ferredesk
POSTGRES_USER=ferredesk_user
POSTGRES_PASSWORD=$dbPassword
DATABASE_URL=postgresql://ferredesk_user:$dbPassword@postgres:5432/ferredesk

# Django
SECRET_KEY=$secretKey
ALLOWED_HOSTS=*

# Timezone
TZ=America/Argentina/Buenos_Aires
"@
    
    try {
        $envContent | Out-File -FilePath $EnvPath -Encoding UTF8 -Force
        Write-Success "Archivo .env creado"
        return $true
    } catch {
        Write-Error "Error creando .env: $($_.Exception.Message)"
        return $false
    }
}

function Get-DockerHubImage {
    Write-Info "Descargando imagen desde Docker Hub: $Script:DockerImage"
    Write-Info "Esto puede tardar varios minutos segun tu conexion..."
    
    try {
        docker pull $Script:DockerImage
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Imagen descargada exitosamente"
            return $true
        }
        Write-Error "Error al descargar imagen (codigo: $LASTEXITCODE)"
        return $false
    } catch {
        Write-Error "Error al descargar imagen: $($_.Exception.Message)"
        return $false
    }
}

function Deploy-DockerCompose {
    param([string]$TargetDir)
    
    $composePath = Join-Path $TargetDir "docker-compose.yml"
    
    Write-Info "Creando docker-compose.yml..."
    
    $composeContent = @"
services:
  postgres:
    image: postgres:15
    container_name: ferredesk_postgres
    env_file:
      - .env
    environment:
      TZ: America/Argentina/Buenos_Aires
      PGTZ: America/Argentina/Buenos_Aires
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U `${POSTGRES_USER} -d `${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: lautajuare/ferredesk:`${FERREDESK_VERSION}
    container_name: ferredesk_app
    depends_on:
      postgres:
        condition: service_healthy
    env_file:
      - .env
    volumes:
      - ./media:/app/media
    ports:
      - "8000:8000"
    restart: unless-stopped

volumes:
  postgres_data:
"@
    
    try {
        $composeContent | Out-File -FilePath $composePath -Encoding UTF8 -Force
        Write-Success "docker-compose.yml creado"
        return $true
    } catch {
        Write-Error "Error creando docker-compose.yml"
        return $false
    }
}

function New-PersistentFolders {
    param([string]$TargetDir)
    
    $folders = @("media")
    foreach ($folder in $folders) {
        $path = Join-Path $TargetDir $folder
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    }
    Write-Success "Carpetas persistentes creadas"
    return $true
}

function Start-FerreDesk {
    param([string]$ProjectDir)
    
    Push-Location $ProjectDir
    try {
        Write-Info "Iniciando servicios..."
        docker-compose up -d
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Servicios iniciados"
            return $true
        }
        Write-Error "Error al iniciar servicios"
        return $false
    } finally {
        Pop-Location
    }
}

function Wait-ForServicesReady {
    param([string]$ProjectDir)
    
    Write-Info "Esperando a que los servicios esten listos..."
    Start-Sleep -Seconds 30
    
    Push-Location $ProjectDir
    try {
        for ($i = 1; $i -le 12; $i++) {
            $status = docker-compose ps 2>$null
            $servicesUp = ($status | Select-String "\s+Up\s+").Count
            
            if ($servicesUp -ge 2) {
                Write-Success "Servicios listos ($servicesUp activos)"
                return $true
            }
            
            Write-Debug "Esperando servicios... ($i/12)"
            Start-Sleep -Seconds 10
        }
        
        Write-Warning "Timeout esperando servicios"
        docker-compose ps
        return $false
    } finally {
        Pop-Location
    }
}

function Test-ApplicationResponding {
    Write-Info "Verificando aplicacion web..."
    for ($i = 1; $i -le 6; $i++) {
        try {
            Invoke-WebRequest -Uri "http://localhost:8000" -Method Head -TimeoutSec 10 -ErrorAction Stop | Out-Null
            Write-Success "Aplicacion respondiendo"
            return $true
        } catch {
            if ($i -lt 6) { Start-Sleep -Seconds 10 }
        }
    }
    Write-Warning "Aplicacion puede necesitar mas tiempo"
    return $false
}

# ========================================
#    FUNCIONES DE MONITOREO DEL PROCESO PADRE
# ========================================

function Test-ParentProcessAlive {
    param([int]$ParentProcessId)
    try {
        $parentProcess = Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue
        return ($parentProcess -ne $null)
    } catch {
        return $false
    }
}

function Start-ParentProcessMonitor {
    param([int]$ParentProcessId)
    
    if (-not $ParentProcessId -or $ParentProcessId -le 0) {
        Write-Debug "No se monitorea proceso padre (PID invalido o no provisto)"
        return
    }
    
    Write-Info "Iniciando monitor de proceso padre (PID: $ParentProcessId)..."
    
    $monitorLogFile = Join-Path (Split-Path -Path $Script:LogFile -Parent) "FerreDesk-Installer.parent_monitor.log"
    
    $monitorScript = {
        param($ParentPid, $ScriptPid, $LogFile)
        
        function Log-Monitor {
            param([string]$Msg)
            try { Add-Content -Path $LogFile -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Msg" -ErrorAction SilentlyContinue } catch {}
        }
        
        Log-Monitor "Monitor iniciado para ParentPid: $ParentPid, ScriptPid: $ScriptPid"
        
        while ($true) {
            Start-Sleep -Seconds 2
            $parent = Get-Process -Id $ParentPid -ErrorAction SilentlyContinue
            if (-not $parent) {
                Log-Monitor "PADRE MUERTO (PID $ParentPid). Terminando script ($ScriptPid)..."
                Stop-Process -Id $ScriptPid -Force -ErrorAction SilentlyContinue
                break
            }
        }
    }
    
    try {
        $monitorJob = Start-Job -ScriptBlock $monitorScript -ArgumentList $ParentProcessId, $PID, $monitorLogFile
        $Script:ParentMonitorJob = $monitorJob
        Write-Debug "Monitor iniciado (Job ID: $($monitorJob.Id))"
    } catch {
        Write-Warning "No se pudo iniciar monitor de proceso padre: $($_.Exception.Message)"
    }
}

# ========================================
#    INICIO DE EJECUCION
# ========================================

# Iniciar monitoreo si se proveyó PID
if ($ParentPid) {
    Start-ParentProcessMonitor -ParentProcessId $ParentPid
}


# ========================================
#    FASES DE INSTALACION
# ========================================

function Invoke-Phase1 {
    Write-ProgressToInno -Mensaje "Fase 1/3: Preparando Windows y dependencias" -Percent 10
    Write-Info "=== Fase 1/3: Preparando Windows y dependencias ==="
    
    if (-not (Test-WindowsVersion)) { return $Script:EXIT_ERROR }
    
    if (-not $Script:InstallDirectory) {
        $Script:InstallDirectory = Get-SafeInstallDirectory
    }
    Write-Info "Directorio: $Script:InstallDirectory"
    
    $state = Get-InstallationState
    $state.InstallDirectory = $Script:InstallDirectory
    $state.CurrentPhase = "FASE_1_EN_PROGRESO"
    Set-InstallationState $state
    
    # Windows Features
    $requiresRestart = $false
    foreach ($feature in @("Microsoft-Windows-Subsystem-Linux", "VirtualMachinePlatform")) {
        $result = Enable-WindowsFeature -FeatureName $feature
        if ($result.RequiresRestart) { $requiresRestart = $true }
    }
    
    # WSL
    Write-ProgressToInno -Mensaje "Configurando WSL" -Percent 25
    $wslResult = @{ Success = $true; RequiresRestart = $false }
    if (-not (Test-WSLInstalled)) {
        $wslResult = Install-WSL
    }
    Update-WSL
    
    # Chocolatey
    Write-ProgressToInno -Mensaje "Instalando Chocolatey" -Percent 35
    if (-not (Install-Chocolatey)) {
        Write-Error "No se pudo instalar Chocolatey"
        return $Script:EXIT_ERROR
    }
    
    # Docker Desktop
    Write-ProgressToInno -Mensaje "Instalando Docker Desktop" -Percent 55
    $dockerResult = Install-DockerDesktop
    
    # FORZAR REINICIO SIEMPRE AL FINAL DE FASE 1
    # Esto es CRÍTICO porque:
    # 1. Las variables de entorno (PATH) de Docker no están disponibles hasta después del reinicio
    # 2. El usuario podría no haber cerrado sesión desde la instalación de Docker
    # 3. El grupo "docker-users" solo se aplica después del re-login
    # Sin reinicio, Fase 2 y 3 fallarán con "docker: comando no reconocido"
    
    $state.CurrentPhase = "FASE_2_PENDIENTE"
    $state.RequiresRestart = $true
    # CRÍTICO: Guardar el ExitCode en el estado ANTES de retornar
    # para que Inno Setup pueda leerlo del JSON
    $state.ExitCode = "$Script:EXIT_NEEDS_RESTART"
    Set-InstallationState $state
    
    Write-Warning "========================================"
    Write-Warning "   REINICIO DEL SISTEMA REQUERIDO"
    Write-Warning "========================================"
    Write-Info "Es necesario reiniciar para aplicar cambios de configuracion."
    Write-Info ""
    Write-Info "1. Reinicia tu computadora"
    Write-Info "2. La instalacion continuara automaticamente"
    Write-Info ""
    Write-Info "Si la instalacion no continua automaticamente,"
    Write-Info "ejecuta el instalador .exe nuevamente."
    
    return $Script:EXIT_NEEDS_RESTART
}

function Invoke-Phase2 {
    Write-ProgressToInno -Mensaje "Fase 2/3: Verificando Docker Desktop" -Percent 65
    Write-Info "=== Fase 2/3: Verificando Docker Desktop ==="
    
    $state = Get-InstallationState
    if ($state.InstallDirectory) { $Script:InstallDirectory = $state.InstallDirectory }
    
    if (-not (Test-DockerInstalled)) {
        Write-Error "Docker Desktop no instalado. Ejecuta el instalador nuevamente."
        return $Script:EXIT_ERROR
    }
    
    $state.CurrentPhase = "FASE_2_EN_PROGRESO"
    Set-InstallationState $state
    
    if (-not (Test-DockerRunning)) {
        Start-DockerDesktop
    }
    
    if (-not (Wait-ForDockerReady -TimeoutSeconds 900)) {
        Write-Error "Docker Desktop no responde. Inicialo manualmente y reintenta."
        return $Script:EXIT_ERROR
    }
    
    $state.CurrentPhase = "FASE_3_PENDIENTE"
    Set-InstallationState $state
    return $Script:EXIT_SUCCESS
}

function Invoke-Phase3 {
    Write-ProgressToInno -Mensaje "Fase 3/3: Desplegando FerreDesk" -Percent 75
    Write-Info "=== Fase 3/3: Desplegando FerreDesk ==="
    
    $state = Get-InstallationState
    if ($state.InstallDirectory) { $Script:InstallDirectory = $state.InstallDirectory }
    
    if (-not $Script:InstallDirectory) {
        $Script:InstallDirectory = Get-SafeInstallDirectory
    }
    
    # Crear directorio del proyecto
    $projectDir = Join-Path $Script:InstallDirectory "ferredesk"
    if (-not (Test-Path $projectDir)) {
        New-Item -ItemType Directory -Path $projectDir -Force | Out-Null
    }
    
    $state.CurrentPhase = "FASE_3_EN_PROGRESO"
    Set-InstallationState $state
    
    # Descargar imagen
    Write-ProgressToInno -Mensaje "Descargando imagen de Docker Hub" -Percent 80
    if (-not (Get-DockerHubImage)) {
        Write-Error "No se pudo descargar la imagen. Verifica tu conexion a internet."
        return $Script:EXIT_ERROR
    }
    
    # Crear .env
    Write-ProgressToInno -Mensaje "Configurando ambiente" -Percent 85
    $envPath = Join-Path $projectDir ".env"
    if (-not (New-EnvironmentFile -EnvPath $envPath)) {
        return $Script:EXIT_ERROR
    }
    
    # Crear docker-compose.yml
    if (-not (Deploy-DockerCompose -TargetDir $projectDir)) {
        return $Script:EXIT_ERROR
    }
    
    # Crear carpetas
    New-PersistentFolders -TargetDir $projectDir
    
    # Iniciar servicios
    Write-ProgressToInno -Mensaje "Iniciando servicios" -Percent 90
    if (-not (Start-FerreDesk -ProjectDir $projectDir)) {
        return $Script:EXIT_ERROR
    }
    
    # Esperar servicios
    Write-ProgressToInno -Mensaje "Esperando servicios" -Percent 95
    Wait-ForServicesReady -ProjectDir $projectDir
    
    # Verificar aplicacion
    Test-ApplicationResponding
    
    # Completar
    Write-ProgressToInno -Mensaje "Instalacion completada" -Percent 100
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   INSTALACION COMPLETADA" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Info "Accede a FerreDesk en: http://localhost:8000"
    Write-Host ""
    Write-Info "Credenciales de acceso:"
    Write-Host "   Usuario: admin" -ForegroundColor Yellow
    Write-Host "   Contraseña: admin123" -ForegroundColor Yellow
    Write-Host ""
    Write-Info "Ubicacion: $projectDir"
    Write-Host ""
    
    if (-not $NoOpenBrowser) {
        try { Start-Process "http://localhost:8000" } catch { }
    }
    
    $state.CurrentPhase = "COMPLETO"
    $state.LastError = $null
    Set-InstallationState $state
    
    return $Script:EXIT_SUCCESS
}

# ========================================
#    FLUJO PRINCIPAL
# ========================================

function Initialize-Logging {
    Initialize-InstallerStorage
    if (-not (VerificarDirectorioLog)) { exit 1 }
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "FerreDesk Installer v1.0.0 - $timestamp" | Out-File -FilePath $Script:LogFile -Force -Encoding UTF8
    
    Write-Info "Log: $Script:LogFile"
}

function Get-PendingPhases {
    param([pscustomobject]$State)
    $current = $State.CurrentPhase
    switch -Wildcard ($current) {
        "FASE_0" { return @("FASE_1","FASE_2","FASE_3") }
        "FASE_1*" { return @("FASE_1","FASE_2","FASE_3") }
        "FASE_2*" { return @("FASE_2","FASE_3") }
        "FASE_3*" { return @("FASE_3") }
        "COMPLETO" { return @() }
        default { return @("FASE_1","FASE_2","FASE_3") }
    }
}

function Main {
    if (-not $Silent) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "   INSTALADOR FERREDESK v1.0.0" -ForegroundColor Yellow
        Write-Host "   Imagenes pre-compiladas Docker Hub" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
    }
    
    Initialize-Logging
    
    if (-not (Test-Administrator)) {
        Write-Error "Se requieren permisos de administrador"
        Set-MainExitCodeAndExit -Codigo $Script:EXIT_ERROR -Contexto "sin permisos"
    }
    
    if ($InstallDirectory -and -not (Test-IsTemporaryDirectory -Path $InstallDirectory)) {
        $Script:InstallDirectory = $InstallDirectory
    }
    
    $state = Get-InstallationState
    if ($state.InstallDirectory -and -not (Test-IsTemporaryDirectory -Path $state.InstallDirectory)) {
        $Script:InstallDirectory = $state.InstallDirectory
    }
    
    $phases = Get-PendingPhases -State $state
    
    if ($phases.Count -eq 0) {
        Write-Info "FerreDesk ya esta instalado."
        Set-MainExitCodeAndExit -Codigo $Script:EXIT_SUCCESS -Contexto "ya instalado"
    }
    
    # Ejecutar fases y capturar el primer error/reinicio
    $finalResult = $Script:EXIT_SUCCESS
    $finalContext = "completado"
    
    foreach ($phase in $phases) {
        $result = switch ($phase) {
            "FASE_1" { Invoke-Phase1 }
            "FASE_2" { Invoke-Phase2 }
            "FASE_3" { Invoke-Phase3 }
        }

        # --- FIX COMPATIBILIDAD LEGACY ---
        # Asegurar que $result sea un solo entero, no un array
        # Si funciones como Start-DockerDesktop o Update-WSL escapan booleanos al pipeline,
        # el resultado será un array. Tomamos el último elemento (el exit code real).
        if ($result -is [Array]) {
            Write-Debug "Detectado retorno multiple en fase $phase. Saneando resultado..."
            $result = $result[-1]
        }
        $result = [int]$result
        # ---------------------------------
        
        # Si la fase no fue exitosa, detener inmediatamente
        if ($result -ne $Script:EXIT_SUCCESS) {
            $finalResult = $result
            $finalContext = $phase
            break  # CRÍTICO: Salir del bucle inmediatamente
        }
    }
    
    # Salir UNA SOLA VEZ con el resultado final
    Set-MainExitCodeAndExit -Codigo $finalResult -Contexto $finalContext
}

Main

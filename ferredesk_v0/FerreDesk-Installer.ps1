# ========================================
#    INSTALADOR AUTOMATICO FERREDESK
#    Script PowerShell - Instalacion Completa
# ========================================
# Requiere: Windows 10/11 (64-bit)
# Requiere: Permisos de Administrador
# ========================================

<#
.SYNOPSIS
    Instalador automatico completo de FerreDesk para Windows.

.DESCRIPTION
    Este script automatiza completamente la instalacion de FerreDesk:
    - Verifica y activa caracteristicas de Windows (WSL2, Virtual Machine Platform)
    - Instala y actualiza WSL
    - Instala Chocolatey, Git y Docker Desktop
    - Descarga el codigo desde GitHub
    - Configura y construye la aplicacion
    - Inicia los servicios Docker
    - Abre el navegador automaticamente

.PARAMETER InstallDirectory
    Directorio donde instalar FerreDesk. Si no se especifica, se determina automaticamente.

.EXAMPLE
    .\FerreDesk-Installer.ps1
    
.EXAMPLE
    .\FerreDesk-Installer.ps1 -InstallDirectory "C:\FerreDesk"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$InstallDirectory,
    
    [Parameter(Mandatory=$false)]
    [switch]$Silent,
    
    [Parameter(Mandatory=$false)]
    [string]$LogPath,
    
    [Parameter(Mandatory=$false)]
    [string]$ProgressFile,
    
    [Parameter(Mandatory=$false)]
    [string]$Phase,
    
    [Parameter(Mandatory=$false)]
    [string]$StateFile,
    
    [Parameter(Mandatory=$false)]
    [switch]$Resume,
    
    [Parameter(Mandatory=$false)]
    [switch]$Repair,
    
    [Parameter(Mandatory=$false)]
    [switch]$Update,
    
    [Parameter(Mandatory=$false)]
    [switch]$Reinstall,
    
    [Parameter(Mandatory=$false)]
    [switch]$NoOpenBrowser
)

# ========================================
#    CONFIGURACION
# ========================================

# Modo debug (1 = activado, 0 = desactivado)
$Script:ModoDebug = -not $Silent

# Rutas principales en ProgramData
$Script:ProgramDataRoot = Join-Path $env:ProgramData "FerreDesk"
$Script:LogsDirectory = Join-Path $Script:ProgramDataRoot "logs"
$Script:DefaultLogPath = Join-Path $Script:LogsDirectory "FerreDesk-Installer.log"
$Script:DefaultStateFile = Join-Path $Script:ProgramDataRoot "installer-state.json"
$Script:RegistryBasePath = "HKLM:\SOFTWARE\FerreDesk\Installer"

# Archivo de log (usar ruta proporcionada por Inno Setup o la ruta fija en ProgramData)
if ($LogPath) {
    $Script:LogFile = $LogPath
} else {
    $Script:LogFile = $Script:DefaultLogPath
}

# Archivo de progreso para comunicacion con Inno Setup
$Script:ProgressFile = $ProgressFile

# Archivo de estado (JSON)
if ($StateFile) {
    $Script:StateFilePath = $StateFile
} else {
    $Script:StateFilePath = $Script:DefaultStateFile
}

# Configuracion de repositorio
$Script:GitHubRepo = "https://github.com/facupaccioretti/FerreDesk.git"
$Script:GitHubBranch = "main"

# Timeouts (en segundos)
$Script:DockerWaitTimeout = 600
$Script:ServicesWaitTimeout = 300
$Script:WSLWaitTimeout = 120

# Directorio de instalacion (se determina mas adelante si no se proporciona)
$Script:InstallDirectory = $null

# Configuracion global de manejo de errores
# Capturar TODOS los errores, no detener el script automaticamente
$ErrorActionPreference = "Continue"
$Script:ErrorCount = 0
$Script:Errors = @()
$Script:CurrentState = $null

# Codigos de salida estandarizados (Windows Installer standard)
$Script:EXIT_SUCCESS = 0
$Script:EXIT_ERROR = -1
$Script:EXIT_NEEDS_RESTART = 3010  # Estándar Windows: éxito con reinicio requerido

# Categorías de error para logging (no para códigos de salida)
$Script:ERROR_CATEGORY_DOCKER_NOT_READY = "DOCKER_NOT_READY"
$Script:ERROR_CATEGORY_ALREADY_INSTALLED = "ALREADY_INSTALLED"
$Script:ERROR_CATEGORY_RESTART_REQUIRED = "RESTART_REQUIRED"
$Script:ERROR_CATEGORY_GENERIC_ERROR = "GENERIC_ERROR"
$Script:ERROR_CATEGORY_BUILD_FAILED = "BUILD_FAILED"
$Script:ERROR_CATEGORY_SERVICES_NOT_RESPONDING = "SERVICES_NOT_RESPONDING"

# ========================================
#    FUNCIONES DE LOGGING Y UTILIDAD
# ========================================

function VerificarDirectorioLog {
    <#
    .SYNOPSIS
        Asegura que el directorio del archivo de log existe antes de escribir.
    #>
    try {
        $logDir = Split-Path -Path $Script:LogFile -Parent
        if (-not $logDir) {
            return $false
        }
        
        if (-not (Test-Path $logDir)) {
            # Crear directorio y validar que se creó correctamente
            $null = New-Item -ItemType Directory -Path $logDir -Force -ErrorAction Stop
        }
        
        # Validar que el directorio existe y es accesible
        if (-not (Test-Path $logDir)) {
            return $false
        }
        
        return $true
    } catch {
        # Si falla, mostrar error en consola (no podemos escribir al log)
        Write-Host "ERROR CRITICO: No se pudo crear el directorio de logs: $logDir" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Write-ErrorLog {
    <#
    .SYNOPSIS
        Escribe un error completo de PowerShell al log con todos los detalles.
    #>
    param(
        [Parameter(Mandatory=$true)]
        $ErrorRecord
    )
    
    $Script:ErrorCount++
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    # Construir mensaje de error detallado
    $errorDetails = @"
[$timestamp] [ERROR DETALLADO]
Mensaje: $($ErrorRecord.Exception.Message)
Tipo: $($ErrorRecord.Exception.GetType().FullName)
Comando: $($ErrorRecord.InvocationInfo.MyCommand)
Script: $($ErrorRecord.InvocationInfo.ScriptName)
Linea: $($ErrorRecord.InvocationInfo.ScriptLineNumber)
Posicion: $($ErrorRecord.InvocationInfo.PositionMessage)
Stack Trace: $($ErrorRecord.ScriptStackTrace)
"@
    
    if ($ErrorRecord.Exception.InnerException) {
        $errorDetails += "`nError Interno: $($ErrorRecord.Exception.InnerException.Message)"
    }
    
    # Asegurar que el directorio de logs existe antes de escribir
    if (-not (VerificarDirectorioLog)) {
        # Si no se puede crear el directorio, solo mostrar en consola
        Write-Host $errorDetails -ForegroundColor Red
        return
    }
    
    # Escribir al log
    try {
        Add-Content -Path $Script:LogFile -Value $errorDetails -ErrorAction Stop
    } catch {
        # Si falla escribir al log, mostrar en consola
        Write-Host "ADVERTENCIA: No se pudo escribir al archivo de log: $Script:LogFile" -ForegroundColor Yellow
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host $errorDetails -ForegroundColor Red
    }
    
    # Guardar en array de errores
    $Script:Errors += $ErrorRecord
    
    # Mostrar en consola (solo si no es modo silencioso)
    if (-not $Silent) {
        Write-Host "`n=== ERROR DETECTADO ===" -ForegroundColor Red
        Write-Host "Mensaje: $($ErrorRecord.Exception.Message)" -ForegroundColor Red
        Write-Host "Linea: $($ErrorRecord.InvocationInfo.ScriptLineNumber)" -ForegroundColor Yellow
        if ($ErrorRecord.Exception.InnerException) {
            Write-Host "Error Interno: $($ErrorRecord.Exception.InnerException.Message)" -ForegroundColor Red
        }
        Write-Host "======================`n" -ForegroundColor Red
    }
}

# Trap global para capturar TODOS los errores
trap {
    Write-ErrorLog -ErrorRecord $_
    continue  # Continuar ejecutando el script en lugar de detenerlo
}

function Write-Log {
    <#
    .SYNOPSIS
        Escribe un mensaje al archivo de log y a la consola.
    #>
    param(
        [Parameter(Mandatory=$false)]
        [string]$Mensaje = "",
        
        [Parameter(Mandatory=$false)]
        [ValidateSet("INFO", "SUCCESS", "WARNING", "ERROR", "DEBUG", "PROGRESS")]
        [string]$Tipo = "INFO",
        
        [Parameter(Mandatory=$false)]
        [int]$ProgressPercent = -1
    )
    
    # Si el mensaje está vacío, no hacer nada
    if ([string]::IsNullOrWhiteSpace($Mensaje)) {
        return
    }
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMensaje = "[$timestamp] [$Tipo] $Mensaje"
    
    # Escribir a archivo de log (solo si el directorio existe)
    # No forzar creación aquí para evitar errores silenciosos
    # La creación del directorio debe hacerse explícitamente en Initialize-Logging
    if ($Script:LogFile -and (Test-Path (Split-Path -Path $Script:LogFile -Parent))) {
    try {
            Add-Content -Path $Script:LogFile -Value $logMensaje -ErrorAction Stop
    } catch {
            # Si falla escribir al log, solo continuar (no es crítico para el flujo)
            # Los errores críticos se manejan en Write-ErrorLog
        }
    }
    
    # Escribir progreso a archivo para Inno Setup (si se proporciono)
    if ($Script:ProgressFile -and $Tipo -eq "PROGRESS") {
        Write-ProgressToInno -Mensaje $Mensaje -Percent $ProgressPercent
    }
    
    # Mostrar en consola (solo si no es modo silencioso)
    if (-not $Silent) {
        switch ($Tipo) {
            "SUCCESS" { Write-Host $Mensaje -ForegroundColor Green }
            "WARNING" { Write-Host $Mensaje -ForegroundColor Yellow }
            "ERROR"   { Write-Host $Mensaje -ForegroundColor Red }
            "DEBUG"   { if ($Script:ModoDebug) { Write-Host $Mensaje -ForegroundColor Gray } }
            "PROGRESS" { Write-Host $Mensaje }
            default   { Write-Host $Mensaje }
        }
    }
}

function Write-Success {
    param([string]$Mensaje)
    Write-Log -Mensaje $Mensaje -Tipo "SUCCESS"
}

function Write-Warning {
    param([string]$Mensaje)
    Write-Log -Mensaje $Mensaje -Tipo "WARNING"
}

function Write-Error {
    param(
        [Parameter(Mandatory=$false)]
        [string]$Mensaje = "Error no especificado.",
        [System.Management.Automation.ErrorRecord]$ErrorRecord = $null
    )
    
    # Si el mensaje está vacío, usar un mensaje por defecto
    if ([string]::IsNullOrWhiteSpace($Mensaje)) {
        $Mensaje = "Error no especificado."
    }
    
    Write-Log -Mensaje $Mensaje -Tipo "ERROR"
    
    # Si se proporciona un ErrorRecord, escribir detalles completos
    if ($ErrorRecord) {
        Write-ErrorLog -ErrorRecord $ErrorRecord
    }
}

function Write-Info {
    param([string]$Mensaje = "")
    if ([string]::IsNullOrWhiteSpace($Mensaje)) {
        return
    }
    Write-Log -Mensaje $Mensaje -Tipo "INFO"
}

function Write-Debug {
    param([string]$Mensaje)
    Write-Log -Mensaje $Mensaje -Tipo "DEBUG"
}

function Wait-ForOptionalKeyPress {
    param(
        [string]$Mensaje = "Presiona cualquier tecla para continuar..."
    )
    
    if (-not $Silent) {
        Write-Host $Mensaje -ForegroundColor Gray
        try {
            if ($Host -and $Host.UI -and $Host.UI.RawUI) {
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            }
        } catch {
            # Ignorar si no hay consola interactiva
        }
    }
}

# ========================================
#    FUNCIONES DE ESTADO Y ALMACENAMIENTO
# ========================================

function Initialize-InstallerStorage {
    <#
    .SYNOPSIS
        Crea las carpetas y claves de registro requeridas para logs y estado.
    #>
    $directories = @(
        $Script:ProgramDataRoot,
        $Script:LogsDirectory,
        (Split-Path -Path $Script:StateFilePath -Parent)
    ) | Where-Object { $_ -and $_.Trim() -ne "" }
    
    foreach ($dir in $directories) {
        try {
            if (-not (Test-Path $dir)) {
                $null = New-Item -ItemType Directory -Path $dir -Force -ErrorAction Stop
            }
            # Validar que el directorio se creó correctamente
            if (-not (Test-Path $dir)) {
                throw "No se pudo crear el directorio: $dir"
            }
        } catch {
            $errorMsg = "CRITICO: No se pudo crear el directorio requerido: $dir`nError: $($_.Exception.Message)"
            Write-Host $errorMsg -ForegroundColor Red
            throw $errorMsg
        }
    }
    
    try {
        if (-not (Test-Path $Script:RegistryBasePath)) {
            $null = New-Item -Path $Script:RegistryBasePath -Force -ErrorAction Stop
        }
    } catch {
        Write-Warning "No se pudo asegurar la clave de registro $Script:RegistryBasePath. Detalles: $($_.Exception.Message)"
    }
}

function Get-DefaultState {
    return [pscustomobject]@{
        CurrentPhase        = "FASE_0"
        InstallDirectory    = $Script:InstallDirectory
        RequiresRestart     = $false
        LastError           = $null
        ErrorCategory       = $null
        Timestamp           = (Get-Date).ToString("o")
        DockerInstalledByUser = $false
        # Campos de runtime para enlazar con el instalador externo
        Pid                 = "$PID"
        ExitCode            = $null
    }
}

function Get-InstallationStatusFromPhase {
    <#
    .SYNOPSIS
        Determina el InstallationStatus simplificado desde CurrentPhase.
        Este status es usado por ISS para detectar instalaciones existentes.
    #>
    param(
        [Parameter(Mandatory=$false)]
        [AllowEmptyString()]
        [string]$Phase = "FASE_0"
    )
    
    # Validación interna para manejar valores vacíos o nulos
    if ([string]::IsNullOrWhiteSpace($Phase)) {
        return "NONE"
    }
    
    switch -Wildcard ($Phase) {
        { $_ -like "FASE_*_PENDIENTE" -or $_ -like "FASE_*_EN_PROGRESO" } {
            return "IN_PROGRESS"
        }
        { $_ -eq "COMPLETO" -or $_ -eq "FASE_COMPLETA" } {
            return "COMPLETED"
        }
        default {
            return "NONE"
        }
    }
}

function Write-SimpleStateToRegistry {
    <#
    .SYNOPSIS
        Escribe solo los campos esenciales al registro para que ISS pueda detectar instalaciones.
        Mantiene InstallationStatus simplificado sincronizado.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Status,      # "NONE", "IN_PROGRESS", "COMPLETED", "FAILED"
        [Parameter(Mandatory=$false)]
        [string]$InstallDir = $null
    )
    
    try {
        if (-not (Test-Path $Script:RegistryBasePath)) {
            New-Item -Path $Script:RegistryBasePath -Force | Out-Null
        }
        
        Set-ItemProperty -Path $Script:RegistryBasePath -Name "InstallationStatus" -Value $Status -ErrorAction Stop
        
        if ($InstallDir) {
            Set-ItemProperty -Path $Script:RegistryBasePath -Name "InstallDir" -Value $InstallDir -ErrorAction Stop
        }
    } catch {
        Write-Warning "No se pudo escribir InstallationStatus al registro: $($_.Exception.Message)"
    }
}

function Write-StateToRegistry {
    param(
        [Parameter(Mandatory=$true)]
        [pscustomobject]$State
    )
    
    try {
        if (-not (Test-Path $Script:RegistryBasePath)) {
            New-Item -Path $Script:RegistryBasePath -Force | Out-Null
        }
        
        $properties = @{
            CurrentPhase        = $State.CurrentPhase
            InstallDirectory    = $State.InstallDirectory
            RequiresRestart     = [int]([bool]$State.RequiresRestart)
            LastError           = $State.LastError
            Timestamp           = $State.Timestamp
            DockerInstalledByUser = [int]([bool]$State.DockerInstalledByUser)
        }
        
        foreach ($key in $properties.Keys) {
            try {
                Set-ItemProperty -Path $Script:RegistryBasePath -Name $key -Value ($properties[$key]) -ErrorAction Stop
            } catch {
                Write-Warning "No se pudo escribir la propiedad '$key' en el registro: $($_.Exception.Message)"
            }
        }
        
        # Sincronizar InstallationStatus simplificado
        # Validar que CurrentPhase no esté vacío antes de usarlo
        $installStatus = "NONE"
        if (-not [string]::IsNullOrWhiteSpace($State.CurrentPhase)) {
        $installStatus = Get-InstallationStatusFromPhase -Phase $State.CurrentPhase
        }
        if ($State.LastError) {
            $installStatus = "FAILED"
        }
        Write-SimpleStateToRegistry -Status $installStatus -InstallDir $State.InstallDirectory
    } catch {
        Write-Warning "No se pudo actualizar el estado en el registro: $($_.Exception.Message)"
    }
}

function Read-StateFromRegistry {
    try {
        if (-not (Test-Path $Script:RegistryBasePath)) {
            return $null
        }
        
        $reg = Get-ItemProperty -Path $Script:RegistryBasePath -ErrorAction Stop
        return [pscustomobject]@{
            CurrentPhase        = $reg.CurrentPhase
            InstallDirectory    = $reg.InstallDirectory
            RequiresRestart     = [bool]$reg.RequiresRestart
            LastError           = $reg.LastError
            Timestamp           = $reg.Timestamp
            DockerInstalledByUser = [bool]$reg.DockerInstalledByUser
        }
    } catch {
        Write-Warning "No se pudo leer el estado desde el registro: $($_.Exception.Message)"
        return $null
    }
}

function Get-InstallationState {
    <#
    .SYNOPSIS
        Obtiene el estado actual de la instalacion (JSON tiene prioridad sobre registro).
    #>
    Initialize-InstallerStorage
    
    $state = $null
    
    if (Test-Path $Script:StateFilePath) {
        try {
            $json = Get-Content -Path $Script:StateFilePath -Raw -ErrorAction Stop
            if ($json) {
                $state = $json | ConvertFrom-Json
            }
        } catch {
            Write-Warning "No se pudo leer el archivo de estado ($Script:StateFilePath): $($_.Exception.Message)"
        }
    }
    
    if (-not $state) {
        $state = Read-StateFromRegistry
    }
    
    if (-not $state) {
        $state = Get-DefaultState
    }
    
    # Asegurar que campos opcionales existan en el objeto (por si el JSON no los tenía)
    if (-not $state.PSObject.Properties['Pid']) {
        $state | Add-Member -MemberType NoteProperty -Name 'Pid' -Value $null -Force
    }
    if (-not $state.PSObject.Properties['ExitCode']) {
        $state | Add-Member -MemberType NoteProperty -Name 'ExitCode' -Value $null -Force
    }
    if (-not $state.PSObject.Properties['ErrorCategory']) {
        $state | Add-Member -MemberType NoteProperty -Name 'ErrorCategory' -Value $null -Force
    }
    
    # Asegurar que CurrentPhase siempre tenga un valor válido
    if ([string]::IsNullOrWhiteSpace($state.CurrentPhase)) {
        $state.CurrentPhase = "FASE_0"
    }
    
    $Script:CurrentState = $state
    return $state
}

function Set-InstallationState {
    <#
    .SYNOPSIS
        Actualiza el estado de la instalacion en JSON y registro.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [pscustomobject]$State
    )
    
    Initialize-InstallerStorage
    $State.Timestamp = (Get-Date).ToString("o")
    
    try {
        $stateJson = $State | ConvertTo-Json -Depth 5
        Set-Content -Path $Script:StateFilePath -Value $stateJson -Encoding UTF8 -Force
    } catch {
        Write-Warning "No se pudo escribir el archivo de estado ($Script:StateFilePath): $($_.Exception.Message)"
    }
    
    Write-StateToRegistry -State $State
    $Script:CurrentState = $State
}

function Set-MainExitCodeAndExit {
    <#
    .SYNOPSIS
        Actualiza ExitCode en el estado compartido y sale con ese codigo.
        Esto permite que el instalador externo recupere el codigo real de cierre,
        incluso si hubo procesos intermedios.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [int]$Codigo,
        [Parameter(Mandatory=$true)]
        [string]$Contexto,
        [Parameter(Mandatory=$false)]
        [string]$ErrorCategory = $null
    )

    try {
        $state = Get-InstallationState
        $state.ExitCode = "$Codigo"
        if ($ErrorCategory) {
            $state.ErrorCategory = $ErrorCategory
        }
        Set-InstallationState $state
    } catch {
        # Si algo falla al actualizar el estado, continuamos igualmente
    }

    Write-Log "MAIN_EXIT_CODE: $Codigo ($Contexto)" -Tipo "DEBUG"
    exit $Codigo
}

function Exit-WithError {
    <#
    .SYNOPSIS
        Sale con código de error estándar (-1) y registra la categoría de error.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Category,
        [Parameter(Mandatory=$true)]
        [string]$Message
    )
    $state = Get-InstallationState
    $state.LastError = $Message
    $state.ErrorCategory = $Category
    Set-InstallationState $state
    Write-Error $Message
    Set-MainExitCodeAndExit -Codigo $Script:EXIT_ERROR -Contexto $Message -ErrorCategory $Category
}

function Clear-InstallationState {
    <#
    .SYNOPSIS
        Elimina cualquier estado previo (archivo y registro).
    #>
    try {
        if (Test-Path $Script:StateFilePath) {
            Remove-Item -Path $Script:StateFilePath -Force -ErrorAction Stop
        }
    } catch {
        Write-Warning "No se pudo eliminar el archivo de estado: $($_.Exception.Message)"
    }
    
    try {
        if (Test-Path $Script:RegistryBasePath) {
            Remove-Item -Path $Script:RegistryBasePath -Recurse -Force -ErrorAction Stop
        }
    } catch {
        Write-Warning "No se pudo limpiar el estado del registro: $($_.Exception.Message)"
    }
    
    $Script:CurrentState = Get-DefaultState
}

function Test-IsTemporaryDirectory {
    <#
    .SYNOPSIS
        Verifica si una ruta es un directorio temporal que no debería usarse para instalaciones permanentes.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Path
    )
    
    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $false
    }
    
    # Normalizar la ruta para comparaciones
    $normalizedPath = $Path.TrimEnd('\', '/').ToLower()
    
    # Lista de patrones que indican directorios temporales
    # Verificar si contiene rutas temporales comunes
    if ($normalizedPath -like "*\temp\*" -or 
        $normalizedPath -like "*\tmp\*" -or
        $normalizedPath -like "*\appdata\local\temp\*" -or
        $normalizedPath -like "*\windows\temp\*") {
        return $true
    }
    
    # Verificar patrones de Inno Setup (is-XXXXX.tmp)
    if ($normalizedPath -like "*\is-*") {
        return $true
    }
    
    # Verificar si termina con tmp o temp
    if ($normalizedPath -match '(\\|\/)(tmp|temp)$') {
        return $true
    }
    
    # Verificar si está dentro de variables de entorno temporales conocidas
    $tempDirs = @(
        $env:TEMP,
        $env:TMP,
        [System.IO.Path]::GetTempPath()
    )
    
    foreach ($tempDir in $tempDirs) {
        if ($tempDir -and $normalizedPath.StartsWith($tempDir.ToLower().TrimEnd('\', '/'))) {
            return $true
        }
    }
    
    return $false
}

function Sync-InstallDirectoryFromState {
    Write-Log "DEBUG: Intentando sincronizar directorio de instalacion..." -Tipo "DEBUG"
    
    # PRIORIDAD 1: Si ya hay un InstallDirectory establecido (del parámetro o de Get-SafeInstallDirectory), NO sobrescribirlo
    if ($Script:InstallDirectory) {
        Write-Log "DEBUG: InstallDirectory ya tiene valor: $Script:InstallDirectory" -Tipo "DEBUG"
        return
    }
    
    # PRIORIDAD 2: Si se pasó el parámetro InstallDirectory, usarlo (no viene del estado)
    if ($InstallDirectory) {
        $Script:InstallDirectory = $InstallDirectory
        Write-Log "DEBUG: Usando InstallDirectory del parámetro: $Script:InstallDirectory" -Tipo "DEBUG"
        return
    }
    
    # PRIORIDAD 3: Intentar desde el estado en memoria, pero validar que no sea temporal
    if ($Script:CurrentState -and $Script:CurrentState.InstallDirectory) {
        $dirFromState = $Script:CurrentState.InstallDirectory
        
        # VALIDAR: Rechazar directorios temporales (pueden ser eliminados)
        if (Test-IsTemporaryDirectory -Path $dirFromState) {
            Write-Log "DEBUG: Directorio del estado es temporal, ignorándolo: $dirFromState" -Tipo "DEBUG"
        } else {
            $Script:InstallDirectory = $dirFromState
            Write-Log "DEBUG: Directorio recuperado del estado en memoria: $Script:InstallDirectory" -Tipo "DEBUG"
            return
        }
    }
    
    # PRIORIDAD 4: Intentar leer directamente del registro como fallback, validando que no sea temporal
    try {
        $reg = Get-ItemProperty -Path $Script:RegistryBasePath -ErrorAction SilentlyContinue
        if ($reg -and $reg.InstallDirectory) {
            $dirFromReg = $reg.InstallDirectory
            
            # VALIDAR: Rechazar directorios temporales
            if (Test-IsTemporaryDirectory -Path $dirFromReg) {
                Write-Log "DEBUG: Directorio del registro es temporal, ignorándolo: $dirFromReg" -Tipo "DEBUG"
            } else {
                $Script:InstallDirectory = $dirFromReg
                Write-Log "DEBUG: Directorio recuperado del registro: $Script:InstallDirectory" -Tipo "DEBUG"
                
                # Actualizar estado en memoria si es necesario
                if ($Script:CurrentState) {
                    $Script:CurrentState.InstallDirectory = $Script:InstallDirectory
                }
                return
            }
        }
    } catch {
        Write-Log "DEBUG: Error al leer registro en Sync: $($_.Exception.Message)" -Tipo "DEBUG"
    }
    
    Write-Log "DEBUG: No se pudo determinar el directorio de instalacion en Sync." -Tipo "DEBUG"
}

# ========================================
#    FUNCIONES DE VERIFICACION DE SISTEMA
# ========================================

function Request-Administrator {
    <#
    .SYNOPSIS
        Relanza el script con permisos de administrador y cierra la instancia actual.
    #>
    $scriptPath = $PSCommandPath
    $arguments = @("-ExecutionPolicy", "Bypass", "-File", "`"$scriptPath`"")
    
    # Pasar todos los parametros a la nueva instancia
    if ($InstallDirectory) {
        $arguments += "-InstallDirectory", "`"$InstallDirectory`""
    }
    if ($Silent) {
        $arguments += "-Silent"
    }
    if ($LogPath) {
        $arguments += "-LogPath", "`"$LogPath`""
    }
    if ($ProgressFile) {
        $arguments += "-ProgressFile", "`"$ProgressFile`""
    }
    if ($Phase) {
        $arguments += "-Phase", "`"$Phase`""
    }
    if ($StateFile) {
        $arguments += "-StateFile", "`"$StateFile`""
    }
    if ($Resume) {
        $arguments += "-Resume"
    }
    if ($Repair) {
        $arguments += "-Repair"
    }
    if ($Update) {
        $arguments += "-Update"
    }
    if ($Reinstall) {
        $arguments += "-Reinstall"
    }
    if ($NoOpenBrowser) {
        $arguments += "-NoOpenBrowser"
    }
    
    try {
        # Iniciar nueva instancia con permisos de administrador
        # NO usar -Wait para que la instancia actual se cierre inmediatamente
        Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments | Out-Null
        
        # Cerrar esta instancia inmediatamente
        exit 0
    } catch {
        Write-Host "No se pudieron obtener permisos de administrador." -ForegroundColor Red
        Write-Host "Por favor, ejecuta este script como administrador." -ForegroundColor Yellow
        Write-Host ""
        Wait-ForOptionalKeyPress "Presiona cualquier tecla para salir..."
        exit 1
    }
}

function Test-WindowsVersion {
    <#
    .SYNOPSIS
        Verifica que sea Windows 10/11 (64-bit).
    #>
    try {
        $osInfo = Get-CimInstance Win32_OperatingSystem
        
        # Verificar version (Windows 10 = 10.0, Windows 11 = 10.0 pero con build mayor)
        $version = [System.Environment]::OSVersion.Version
        if ($version.Major -lt 10) {
            Write-Error "Windows 10 o 11 requerido. Version detectada: $($osInfo.Caption)"
            return $false
        }
        
        # Verificar arquitectura usando el método estándar de .NET (no depende del idioma)
        if (-not [System.Environment]::Is64BitOperatingSystem) {
            Write-Error "Se requiere Windows 64-bit. Arquitectura del sistema no es 64-bit."
            return $false
        }
        
        Write-Info "Windows compatible detectado: $($osInfo.Caption) (64-bit)"
        return $true
    } catch {
        Write-Error "Error al verificar version de Windows: $($_.Exception.Message)"
        return $false
    }
}

function Get-SafeInstallDirectory {
    <#
    .SYNOPSIS
        Determina un directorio seguro para instalar FerreDesk, evitando problemas de permisos.
    #>
    
    # Si se proporciono un directorio como parametro, validarlo primero
    if ($InstallDirectory) {
        # VALIDAR: Rechazar directorios temporales
        if (Test-IsTemporaryDirectory -Path $InstallDirectory) {
            Write-Warning "El directorio proporcionado es temporal y no puede usarse para instalacion permanente: $InstallDirectory"
            Write-Info "Se determinara un directorio permanente en su lugar."
            # Continuar con la logica de determinacion automatica
        } else {
            $dir = $InstallDirectory
            Write-Info "Usando directorio proporcionado: $dir"
        }
    }
    
    # Si no se proporciono un directorio o era temporal, determinar uno automaticamente
    if (-not $dir) {
        # NUNCA usar $PSScriptRoot porque puede ser temporal (cuando el script se ejecuta desde {tmp} de Inno Setup)
        # Usar LocalAppData\Programs (estándar para instalaciones por usuario)
        $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
        $dir = Join-Path $localAppData "Programs\FerreDesk"
        
        # Si LocalAppData no existe, usar el perfil del usuario como fallback
        if (-not $localAppData -or -not (Test-Path (Split-Path $dir -Parent))) {
            $dir = Join-Path $env:USERPROFILE "FerreDesk"
        }
        
        Write-Info "Se determinara un directorio permanente: $dir"
    }
    
    # VALIDACIÓN CRÍTICA: Nunca usar directorios temporales
    if (Test-IsTemporaryDirectory -Path $dir) {
        Write-Warning "El directorio determinado es temporal, usando fallback seguro: $dir"
        $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
        $dir = Join-Path $localAppData "Programs\FerreDesk"
        if (-not $localAppData -or -not (Test-Path (Split-Path $dir -Parent))) {
            $dir = Join-Path $env:USERPROFILE "FerreDesk"
        }
    }
    
    # Crear directorio si no existe
    if (-not (Test-Path $dir)) {
        try {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Info "Directorio creado: $dir"
        } catch {
            Write-Error "No se pudo crear el directorio: $dir"
            Write-Error "Error: $($_.Exception.Message)"
            return $null
        }
    }
    
    # Verificar permisos de escritura
    $testPath = Join-Path $dir "test-write.tmp"
    try {
        "test" | Out-File -FilePath $testPath -ErrorAction Stop
        Remove-Item -Path $testPath -ErrorAction Stop
        Write-Debug "Permisos de escritura verificados en: $dir"
        return $dir
    } catch {
        Write-Error "No se tienen permisos de escritura en: $dir"
        return $null
    }
}

# ========================================
#    FUNCIONES DE CARACTERISTICAS DE WINDOWS
# ========================================

function Test-WindowsFeature {
    <#
    .SYNOPSIS
        Verifica si una caracteristica de Windows esta habilitada.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$FeatureName
    )
    
    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName $FeatureName -ErrorAction SilentlyContinue
        if ($feature) {
            return $feature.State -eq "Enabled"
        }
        return $false
    } catch {
        Write-Debug "Error al verificar caracteristica $FeatureName : $($_.Exception.Message)"
        return $false
    }
}

function Enable-WindowsFeature {
    <#
    .SYNOPSIS
        Habilita una caracteristica de Windows y detecta si requiere reinicio.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$FeatureName
    )
    
    # Verificar si ya esta habilitada
    if (Test-WindowsFeature -FeatureName $FeatureName) {
        Write-Info "Caracteristica '$FeatureName' ya esta habilitada"
        return @{
            Enabled = $true
            RequiresRestart = $false
            FeatureName = $FeatureName
        }
    }
    
    Write-Info "Habilitando caracteristica de Windows: $FeatureName"
    
    try {
        $result = Enable-WindowsOptionalFeature -Online -FeatureName $FeatureName -NoRestart -All
        
        # Detectar si requiere reinicio
        # El codigo de salida puede indicar si se requiere reinicio
        $requiresRestart = $false
        if ($result.RestartNeeded -eq $true) {
            $requiresRestart = $true
        }
        
        # Verificar estado final
        $enabled = Test-WindowsFeature -FeatureName $FeatureName
        
        if ($enabled) {
            Write-Success "Caracteristica '$FeatureName' habilitada exitosamente"
        } else {
            Write-Warning "Caracteristica '$FeatureName' puede requerir reinicio para activarse completamente"
            $requiresRestart = $true
        }
        
        return @{
            Enabled = $enabled
            RequiresRestart = $requiresRestart
            FeatureName = $FeatureName
        }
    } catch {
        Write-Error "Error al habilitar caracteristica '$FeatureName': $($_.Exception.Message)"
        return @{
            Enabled = $false
            RequiresRestart = $false
            FeatureName = $FeatureName
        }
    }
}

# ========================================
#    FUNCIONES DE WSL
# ========================================

function Test-WSLInstalled {
    <#
    .SYNOPSIS
        Verifica si WSL esta instalado y operativo.
    #>
    try {
        # Metodo 1: Verificar comando wsl --status
        wsl --status 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        
        # Metodo 2: Verificar que el servicio LxssManager este ejecutandose
        $service = Get-Service -Name "LxssManager" -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq "Running") {
            return $true
        }
        
        # Metodo 3: Verificar que el ejecutable wsl.exe exista
        $wslPath = Get-Command wsl -ErrorAction SilentlyContinue
        if ($wslPath) {
            # Si existe el ejecutable, asumir que esta instalado (puede estar inicializandose)
            return $true
        }
        
        return $false
    } catch {
        return $false
    }
}

function Install-WSL {
    <#
    .SYNOPSIS
        Instala WSL2 sin distribucion Linux.
    #>
    Write-Info "Instalando WSL2..."
    
    try {
        # Instalar WSL sin distribucion Linux
        # Mostrar salida en tiempo real
        Write-Host "Ejecutando: wsl --install --no-distribution" -ForegroundColor Cyan
        wsl --install --no-distribution
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -eq 0) {
            Write-Success "WSL2 instalado exitosamente"
            return [pscustomobject]@{
                Success = $true
                RequiresRestart = $false
            }
        } elseif ($exitCode -eq 3010) {
            Write-Warning "WSL requiere reinicio para completar la instalacion (codigo 3010)"
            return [pscustomobject]@{
                Success = $true
                RequiresRestart = $true
            }
        } else {
            Write-Warning "WSL puede requerir reinicio para completar la instalacion (codigo $exitCode)"
            return [pscustomobject]@{
                Success = $false
                RequiresRestart = $false
            }
        }
    } catch {
        Write-Error "Error al instalar WSL: $($_.Exception.Message)"
        return [pscustomobject]@{
            Success = $false
            RequiresRestart = $false
        }
    }
}

function Update-WSL {
    <#
    .SYNOPSIS
        Actualiza WSL a la ultima version.
    #>
    Write-Info "Actualizando WSL a la ultima version..."
    
    try {
        # Mostrar salida en tiempo real
        Write-Host "Ejecutando: wsl --update" -ForegroundColor Cyan
        wsl --update
        if ($LASTEXITCODE -eq 0) {
            Write-Success "WSL actualizado exitosamente"
            return $true
        } else {
            Write-Warning "WSL puede no estar instalado o puede requerir reinicio"
            return $false
        }
    } catch {
        Write-Warning "No se pudo actualizar WSL (puede no estar instalado): $($_.Exception.Message)"
        return $false
    }
}

function Test-WSLVersion {
    <#
    .SYNOPSIS
        Verifica y convierte WSL1 a WSL2 si es necesario.
    #>
    try {
        wsl --list --verbose 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Debug "No hay distribuciones WSL instaladas (esto es normal)"
            return $true
        }
        
        # Verificar version por defecto
        $defaultVersion = wsl --status 2>&1 | Select-String "Default Version"
        if ($defaultVersion -match "1") {
            Write-Info "Configurando WSL2 como version por defecto..."
            Write-Host "Ejecutando: wsl --set-default-version 2" -ForegroundColor Cyan
            wsl --set-default-version 2
            Write-Success "WSL2 configurado como version por defecto"
        }
        
        return $true
    } catch {
        Write-Warning "No se pudo verificar version de WSL: $($_.Exception.Message)"
        return $false
    }
}

function Wait-ForWSLReady {
    <#
    .SYNOPSIS
        Espera a que WSL este listo y operativo.
    #>
    Write-Info "Esperando a que WSL este listo..."
    
    $timeout = $Script:WSLWaitTimeout
    $interval = 5
    $elapsed = 0
    $maxAttempts = [math]::Floor($timeout / $interval)
    
    # Verificar si WSL ya esta listo inmediatamente
    if (Test-WSLInstalled) {
        Write-Success "WSL esta listo"
        return $true
    }
    
    # Esperar con verificaciones periodicas
    for ($i = 1; $i -le $maxAttempts; $i++) {
        Start-Sleep -Seconds $interval
        $elapsed += $interval
        
        # Mostrar progreso cada 5 segundos
        $percentComplete = [math]::Min(($elapsed / $timeout) * 100, 100)
        Write-Progress -Activity "Esperando WSL..." -Status "Verificando... ($elapsed/$timeout segundos)" -PercentComplete $percentComplete
        
        # Verificar si WSL esta listo
        if (Test-WSLInstalled) {
            Write-Progress -Activity "Esperando WSL..." -Completed
            Write-Success "WSL esta listo"
            return $true
        }
        
        Write-Debug "Esperando WSL... ($elapsed/$timeout segundos)"
    }
    
    Write-Progress -Activity "Esperando WSL..." -Completed
    
    # Si llegamos aqui, WSL puede estar instalado pero no completamente inicializado
    # Verificar una ultima vez con un metodo mas permisivo
    $wslPath = Get-Command wsl -ErrorAction SilentlyContinue
    if ($wslPath) {
        Write-Warning "WSL esta instalado pero puede necesitar mas tiempo para inicializarse completamente"
        Write-Info "Continuando con la instalacion. WSL se inicializara completamente cuando Docker Desktop lo necesite."
        return $true
    }
    
    Write-Warning "Timeout esperando WSL. Continuando..."
    return $false
}

# ========================================
#    FUNCIONES DE CHOCOLATEY (INTEGRADAS)
# ========================================

function Test-ChocolateyInstalled {
    <#
    .SYNOPSIS
        Verifica si Chocolatey esta instalado.
    #>
    $chocoPath = "C:\ProgramData\chocolatey\bin\choco.exe"
    return (Test-Path $chocoPath)
}

function Install-Chocolatey {
    <#
    .SYNOPSIS
        Instala Chocolatey (logica integrada de install_choco.ps1).
        Mismo metodo que usa super-install.bat pero integrado en este script.
    #>
    $chocoPath = "C:\ProgramData\chocolatey\bin\choco.exe"
    
    Write-Info "Verificando si Chocolatey esta instalado en '$chocoPath'..."
    
    if (Test-Path $chocoPath) {
        Write-Info "Chocolatey ya esta instalado. Continuando..."
        return $true
    }
    
    Write-Info "Chocolatey no encontrado. Iniciando instalacion..."
    Write-Log "Iniciando instalacion de Chocolatey..." -Tipo "INFO"
    
    try {
        # Configurar politica de ejecucion (solo para este proceso)
        # Mismo metodo que install_choco.ps1
        Write-Log "Configurando politica de ejecucion..." -Tipo "DEBUG"
        Set-ExecutionPolicy Bypass -Scope Process -Force -ErrorAction Stop
        
        # Configurar protocolo de seguridad TLS 1.2
        # Mismo metodo que install_choco.ps1
        Write-Log "Configurando protocolo de seguridad TLS 1.2..." -Tipo "DEBUG"
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        
        # Descargar y ejecutar script de instalacion de Chocolatey
        # Usar metodo oficial: ejecutar en proceso separado para contexto limpio
        Write-Info "Descargando e instalando Chocolatey..."
        Write-Log "Iniciando instalacion de Chocolatey en proceso separado..." -Tipo "DEBUG"
        
        try {
            # Crear script temporal para instalar Chocolatey
            $tempScript = Join-Path $env:TEMP "choco-install-$(Get-Date -Format 'yyyyMMddHHmmss').ps1"
            
            # Script que ejecutara la instalacion de Chocolatey
            $chocoInstallScript = @"
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
"@
            
            # Guardar script temporal
            $chocoInstallScript | Out-File -FilePath $tempScript -Encoding UTF8 -Force
            Write-Log "Script temporal creado: $tempScript" -Tipo "DEBUG"
            
            # Ejecutar script en proceso separado y capturar salida
            Write-Log "Ejecutando instalacion de Chocolatey..." -Tipo "DEBUG"
            $process = Start-Process powershell.exe -ArgumentList @(
                "-ExecutionPolicy", "Bypass",
                "-NoProfile",
                "-File", "`"$tempScript`""
            ) -Wait -PassThru -NoNewWindow
            
            # Verificar codigo de salida
            if ($null -ne $process.ExitCode -and $process.ExitCode -ne 0) {
                Write-Log "Instalacion de Chocolatey retorno codigo: $($process.ExitCode)" -Tipo "WARNING"
                # Codigo 3010 significa exito pero requiere reinicio (esto es normal)
                if ($process.ExitCode -eq 3010) {
                    Write-Log "Chocolatey instalado pero requiere reinicio (codigo 3010)" -Tipo "INFO"
                }
            }
            
            # Limpiar script temporal
            if (Test-Path $tempScript) {
                Remove-Item -Path $tempScript -Force -ErrorAction SilentlyContinue
            }
            
        } catch {
            Write-ErrorLog -ErrorRecord $_
            throw
        }
        
        # Esperar un momento para que la instalacion se complete
        Write-Log "Esperando que la instalacion se complete..." -Tipo "DEBUG"
        Start-Sleep -Seconds 3
        
        # Verificar instalacion con reintentos (mejora sobre install_choco.ps1)
        $maxVerifyAttempts = 10
        $verifyAttempt = 0
        $installed = $false
        
        while ($verifyAttempt -lt $maxVerifyAttempts -and -not $installed) {
            if (Test-Path $chocoPath) {
                $installed = $true
            } else {
                $verifyAttempt++
                if ($verifyAttempt -lt $maxVerifyAttempts) {
                    Write-Debug "Esperando instalacion... (intento $verifyAttempt/$maxVerifyAttempts)"
                    Start-Sleep -Seconds 2
                }
            }
        }
        
        if ($installed) {
            Write-Success "Instalacion de Chocolatey finalizada."
            Write-Log "Chocolatey instalado exitosamente en: $chocoPath" -Tipo "SUCCESS"
            
            # Recargar variables de entorno
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            
            # Verificar que choco funciona
            Start-Sleep -Seconds 2
            try {
                $chocoVersion = & $chocoPath --version 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Info "Chocolatey version: $chocoVersion"
                    Write-Log "Chocolatey version: $chocoVersion" -Tipo "INFO"
                }
            } catch {
                $err = $_
                Write-Debug "No se pudo verificar la version de Chocolatey (puede necesitar reinicio)"
                Write-ErrorLog -ErrorRecord $err
            }
            
            return $true
        } else {
            Write-Warning "Chocolatey puede requerir reinicio para estar completamente disponible"
            Write-Log "Chocolatey no encontrado despues de $maxVerifyAttempts intentos. Puede requerir reinicio." -Tipo "WARNING"
            Write-Info "Si el problema persiste, instala Chocolatey manualmente desde: https://chocolatey.org/install"
            return $false
        }
        
    } catch {
        Write-Error "Ocurrio un error durante la instalacion de Chocolatey."
        Write-ErrorLog -ErrorRecord $_
        Write-Error "Error: $($_.Exception.Message)"
        if ($_.Exception.InnerException) {
            Write-Error "Error interno: $($_.Exception.InnerException.Message)"
        }
        Write-Info "Instalacion manual: Visita https://chocolatey.org/install para instrucciones"
        Write-Log "FALLO INSTALACION CHOCOLATEY - Ver detalles en el log: $Script:LogFile" -Tipo "ERROR"
        return $false
    }
}

# ========================================
#    FUNCIONES DE DEPENDENCIAS
# ========================================

function Test-GitInstalled {
    <#
    .SYNOPSIS
        Verifica si Git esta instalado usando multiples metodos.
    #>
    try {
        # Metodo 1: Get-Command (busca en PATH)
    $git = Get-Command git -ErrorAction SilentlyContinue
        if ($git) {
            return $true
        }

        # Metodo 2: Buscar ejecutable directamente en rutas comunes
        $possiblePaths = @(
            "$env:ProgramFiles\Git\bin\git.exe",
            "${env:ProgramFiles(x86)}\Git\bin\git.exe",
            "$env:LOCALAPPDATA\Programs\Git\bin\git.exe",
            "C:\ProgramData\chocolatey\lib\git\tools\bin\git.exe",
            "C:\ProgramData\chocolatey\bin\git.exe"
        )

        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                Write-Debug "Git encontrado en: $path"
                return $true
            }
        }

        # Metodo 3: Verificar si existe directorio de instalacion de Git
        $gitInstallPath = Get-Command git -ErrorAction SilentlyContinue 2>$null
        if ($gitInstallPath) {
            return $true
        }

        return $false
    } catch {
        Write-Debug "Error al verificar Git: $($_.Exception.Message)"
        return $false
    }
}

function Install-Git {
    <#
    .SYNOPSIS
        Instala Git usando Chocolatey con verificaciones robustas.
    #>
    if (Test-GitInstalled) {
        try {
            $version = git --version 2>&1
            if ($LASTEXITCODE -eq 0) {
        Write-Info "Git ya esta instalado: $version"
        return $true
            }
        } catch {
            Write-Debug "Git parece estar instalado pero no responde correctamente"
        }
    }
    
    Write-Info "Instalando Git..."

    try {
        # Verificar que Chocolatey este disponible y funcional
        $chocoVersion = & choco --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Chocolatey no esta disponible o no funciona correctamente"
            Write-Info "Verifica que Chocolatey se haya instalado correctamente"
            return $false
        }
        Write-Debug "Chocolatey version: $chocoVersion"

        # Intentar instalar Git con salida limitada (menos verboso)
        # Redirigir stdout a null para evitar logs excesivos, mantener stderr para errores
        $installResult = & choco install git -y --limit-output --no-progress 2>&1 | Out-String
        $exitCode = $LASTEXITCODE

        # Solo mostrar mensajes importantes en consola
        if ($installResult -match "already installed" -or $exitCode -eq 0) {
            Write-Info "Chocolatey procesando instalacion de Git..."
        }

        Write-Debug "Salida de Chocolatey: $installResult"
        Write-Debug "Codigo de salida: $exitCode"
        
        # Recargar variables de entorno de forma mas agresiva
        Write-Debug "Recargando variables de entorno..."
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        # Tambien intentar actualizar PATH desde el registro
        try {
            $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
            $machinePath = (Get-ItemProperty -Path $regPath -Name Path -ErrorAction Stop).Path
            $env:Path = $machinePath
            Write-Debug "PATH actualizado desde registro: $env:Path"
        } catch {
            Write-Debug "No se pudo actualizar PATH desde registro: $($_.Exception.Message)"
        }

        # Si Chocolatey dice "already installed", VERIFICAR SI GIT REALMENTE FUNCIONA
        $gitOk = $false
        if ($installResult -match "already installed" -and $exitCode -eq 0) {
            Write-Info "Chocolatey reporta que Git ya esta instalado. Verificando que funcione correctamente..."

            # Buscar Git en las rutas comunes de Chocolatey y agregar al PATH
            $chocoGitPaths = @(
                "C:\ProgramData\chocolatey\lib\git\tools\bin\git.exe",
                "C:\ProgramData\chocolatey\bin\git.exe"
            )

            $foundPath = $null
            foreach ($path in $chocoGitPaths) {
                if (Test-Path $path) {
                    $foundPath = $path
                    Write-Debug "Git encontrado en Chocolatey: $foundPath"
                    break
                }
            }

            if ($foundPath) {
                # Agregar la ruta al PATH de esta sesion
                $gitDir = Split-Path -Parent $foundPath
                if ($env:Path -notlike "*$gitDir*") {
                    $env:Path = "$gitDir;$env:Path"
                    Write-Debug "Ruta de Git agregada al PATH de la sesion: $gitDir"
                }
            }

            # Esperar un momento para que los cambios tomen efecto
        Start-Sleep -Seconds 2

            # Verificar que Git funcione realmente (3 intentos)
            for ($i = 1; $i -le 3; $i++) {
                Write-Debug "Verificando instalacion de Git (intento $i/3)..."
                try {
                    $output = git --version 2>$null
                    if ($output -match 'git version' -or $LASTEXITCODE -eq 0) {
                        $gitOk = $true
                        Write-Success "Git encontrado y disponible: $output"
                        break
                    }
                } catch {
                    Write-Debug "Git no responde en intento ${i}: $($_.Exception.Message)"
                }
                if ($i -lt 3) {
                    Start-Sleep -Seconds 2
                }
            }
        }

        # Si Git NO funciona aunque Chocolatey dice "already installed", forzar reinstalacion
        if ($installResult -match "already installed" -and $exitCode -eq 0 -and -not $gitOk) {
            Write-Warning "Git no se pudo verificar tras instalacion reportada. Forzando reinstalacion..."
            
            # Reinstalacion forzada con salida limitada (menos verboso)
            $forceResult = & choco install git -y --force --limit-output --no-progress 2>&1 | Out-String
            $forceExitCode = $LASTEXITCODE
            
            Write-Info "Chocolatey procesando reinstalacion de Git..."
            Write-Debug "Salida de reinstalacion forzada: $forceResult"
            Write-Debug "Codigo de salida: $forceExitCode"
            
            if ($forceExitCode -ne 0) {
                Write-Error "Chocolatey reporto un error durante la reinstalacion forzada de Git (codigo: $forceExitCode)"
                Write-Info "Esto puede deberse a problemas de red, permisos o conflictos con instalaciones existentes"
            }
            
            # Recargar PATH nuevamente
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            try {
                $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
                $machinePath = (Get-ItemProperty -Path $regPath -Name Path -ErrorAction Stop).Path
                $env:Path = $machinePath
            } catch {
                # Ignorar errores de registro
            }
            Start-Sleep -Seconds 3
        }

        if ($exitCode -ne 0 -and -not ($installResult -match "already installed")) {
            Write-Error "Chocolatey reporto un error durante la instalacion de Git (codigo: $exitCode)"
            Write-Info "Esto puede deberse a problemas de red, permisos o conflictos con instalaciones existentes"
            return $false
        }

        # Verificar instalacion con reintentos (despues de instalacion normal o reinstalacion forzada)
        $maxRetries = 3
        for ($i = 1; $i -le $maxRetries; $i++) {
            Write-Debug "Verificando instalacion de Git (intento $i/$maxRetries)..."

            # Verificar si Git esta en PATH
            try {
                $version = git --version 2>&1
                if ($LASTEXITCODE -eq 0 -and $version -match 'git version') {
                    Write-Success "Git instalado exitosamente: $version"
                    return $true
                }
            } catch {
                Write-Debug "Git no responde en verificacion: $($_.Exception.Message)"
            }

            # Si Test-GitInstalled retorna true pero git --version falla, puede estar roto
        if (Test-GitInstalled) {
                try {
                    $version = git --version 2>&1
                    if ($LASTEXITCODE -eq 0) {
            Write-Success "Git instalado exitosamente: $version"
            return $true
        }
    } catch {
                    Write-Debug "Git encontrado pero no responde: $($_.Exception.Message)"
                }
            }

            if ($i -lt $maxRetries) {
                Write-Debug "Reintentando verificacion en 2 segundos..."
                Start-Sleep -Seconds 2
            }
        }

        # Si llegamos aqui, Git no se instalo correctamente
        Write-Error "Git no se pudo instalar correctamente con Chocolatey"
        Write-Info "Posibles causas:"
        Write-Info "  • Problemas de conectividad a internet durante la descarga"
        Write-Info "  • Conflicto con una instalacion existente de Git"
        Write-Info "  • Problemas de permisos de escritura"
        Write-Info "Soluciones:"
        Write-Info "  1. Instala Git manualmente desde: https://git-scm.com/download/win"
        Write-Info "  2. Reinicia el sistema y ejecuta este script nuevamente"
        Write-Info "  3. Verifica que tengas permisos de administrador"
        return $false

    } catch {
        $errorMsg = $_.Exception.Message
        if ([string]::IsNullOrWhiteSpace($errorMsg)) {
            $errorMsg = "Error desconocido durante la instalacion de Git"
        } else {
            $errorMsg = "Error critico durante la instalacion de Git: $errorMsg"
        }
        Write-Error $errorMsg
        Write-ErrorLog -ErrorRecord $_
        return $false
    }
}

function Test-DockerInstalled {
    <#
    .SYNOPSIS
        Verifica si Docker Desktop esta instalado.
    #>
    $paths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )
    
    foreach ($path in $paths) {
        if (Test-Path $path) {
            return $true
        }
    }
    
    # Tambien verificar si docker esta en PATH
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    return ($null -ne $docker)
}

function Install-DockerDesktop {
    <#
    .SYNOPSIS
        Instala Docker Desktop usando Chocolatey.
    #>
    if (Test-DockerInstalled) {
        $version = docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Docker Desktop ya esta instalado: $version"
            return [pscustomobject]@{
                Success = $true
                RequiresRestart = $false
                AlreadyInstalled = $true
            }
        }
    }
    
    Write-Info "Instalando Docker Desktop..."
    Write-Warning "NOTA: Docker Desktop requiere reinicio del sistema"
    Write-Info "Esta operacion puede tardar varios minutos. Por favor espera..."
    Write-Log "Iniciando instalacion de Docker Desktop (puede tardar varios minutos)..." -Tipo "INFO"
    
    try {
        # Ejecutar instalacion mostrando progreso
        # No usar Out-Null para que el usuario vea que esta trabajando
        Write-Info "Descargando e instalando Docker Desktop (esto puede tardar 5-10 minutos)..."
        
        # Ejecutar instalacion mostrando salida en tiempo real
        # Ejecutar instalacion con salida limitada (menos verboso)
        Write-Info "Ejecutando instalacion (puede tardar varios minutos, por favor espera)..."
        Write-Log "Ejecutando: choco install docker-desktop -y --force --limit-output --no-progress" -Tipo "DEBUG"
        
        # Ejecutar con salida limitada para evitar logs excesivos
        $null = & choco install docker-desktop -y --force --limit-output --no-progress 2>&1 | Out-String
        $dockerExitCode = $LASTEXITCODE
        
        Write-Info "Chocolatey procesando instalacion de Docker Desktop..."
        
        # Verificar codigo de salida
        if ($dockerExitCode -ne 0) {
            Write-Warning "Chocolatey retorno codigo: $dockerExitCode"
            Write-Log "Chocolatey retorno codigo: $dockerExitCode" -Tipo "WARNING"
        } else {
            Write-Info "Instalacion de Chocolatey completada. Verificando..."
            Write-Log "Instalacion de Chocolatey completada, verificando Docker Desktop..." -Tipo "INFO"
        }
        
        # Esperar un momento para que la instalacion se complete
        Start-Sleep -Seconds 5
        
        # Verificar instalacion con reintentos (puede tardar en aparecer)
        $maxVerifyAttempts = 10
        $verifyAttempt = 0
        $installed = $false
        
        while ($verifyAttempt -lt $maxVerifyAttempts -and -not $installed) {
            if (Test-DockerInstalled) {
                $installed = $true
            } else {
                $verifyAttempt++
                if ($verifyAttempt -lt $maxVerifyAttempts) {
                    Write-Debug "Esperando instalacion... (intento $verifyAttempt/$maxVerifyAttempts)"
                    Start-Sleep -Seconds 3
                }
            }
        }
        
        if ($installed) {
            Write-Success "Docker Desktop instalado exitosamente"
            Write-Log "Docker Desktop instalado exitosamente" -Tipo "SUCCESS"
            Write-Warning "REINICIO DEL SISTEMA REQUERIDO"
            Write-Info "Pasos siguientes:"
            Write-Info "  1. Reinicia tu computadora"
            Write-Info "  2. Abre Docker Desktop y espera a que este listo"
            Write-Info "  3. Ejecuta este script nuevamente"
            return [pscustomobject]@{
                Success = $true
                RequiresRestart = $true
                AlreadyInstalled = $false
            }
        } else {
            Write-Warning "Docker Desktop puede requerir reinicio para estar completamente instalado"
            Write-Log "Docker Desktop no encontrado despues de instalacion. Puede requerir reinicio." -Tipo "WARNING"
            return [pscustomobject]@{
                Success = $false
                RequiresRestart = $true
                AlreadyInstalled = $false
            }
        }
    } catch {
        Write-Error "Error al instalar Docker Desktop: $($_.Exception.Message)"
        return [pscustomobject]@{
            Success = $false
            RequiresRestart = $false
            AlreadyInstalled = $false
        }
    }
}

# ========================================
#    FUNCIONES DE DOCKER
# ========================================

function Test-DockerRunning {
    <#
    .SYNOPSIS
        Verifica si Docker esta ejecutandose.
    #>
    try {
        docker info 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Start-DockerDesktop {
    <#
    .SYNOPSIS
        Inicia Docker Desktop.
    #>
    $paths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )
    
    foreach ($path in $paths) {
        if (Test-Path $path) {
            Write-Info "Iniciando Docker Desktop..."
            try {
                Start-Process -FilePath $path -WindowStyle Hidden
                return $true
            } catch {
                Write-Error "Error al iniciar Docker Desktop: $($_.Exception.Message)"
                return $false
            }
        }
    }
    
    Write-Error "No se encontro Docker Desktop instalado"
    return $false
}

function Wait-ForDockerReady {
    <#
    .SYNOPSIS
        Espera activamente a que Docker este listo.
    #>
    param(
        [Parameter(Mandatory=$false)]
        [int]$TimeoutSeconds = $Script:DockerWaitTimeout,
        
        [Parameter(Mandatory=$false)]
        [switch]$ShowWizardHints
    )
    
    Write-Info "Esperando a que Docker Desktop este listo..."
    
    if ($TimeoutSeconds -lt $Script:DockerWaitTimeout) {
        $TimeoutSeconds = $Script:DockerWaitTimeout
    }
    
    $interval = 5
    $elapsed = 0
    $maxAttempts = [math]::Floor($TimeoutSeconds / $interval)
    $wizardHintShown = $false
    
    for ($i = 1; $i -le $maxAttempts; $i++) {
        if (Test-DockerRunning) {
            Write-Success "Docker Desktop esta listo"
            return $true
        }
        
        if ($ShowWizardHints -and -not $wizardHintShown -and $elapsed -ge 60) {
            $dockerProcesses = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
            if ($dockerProcesses) {
                Write-Warning "Docker Desktop puede estar mostrando el asistente inicial/EULA."
                Write-Info "Si ves la ventana de Docker Desktop solicitando aceptar terminos, haz clic en 'Aceptar' y no cierres la aplicacion."
                $wizardHintShown = $true
            }
        }
        
        $percentComplete = [math]::Min(($i / $maxAttempts) * 100, 100)
        Write-Progress -Activity "Esperando Docker Desktop..." -Status "Verificando... ($elapsed/$TimeoutSeconds segundos)" -PercentComplete $percentComplete
        
        Start-Sleep -Seconds $interval
        $elapsed += $interval
    }
    
    Write-Progress -Activity "Esperando Docker Desktop..." -Completed
    Write-Warning "Timeout esperando Docker Desktop. Puede necesitar mas tiempo para iniciar."
    return $false
}

function Test-PortAvailable {
    <#
    .SYNOPSIS
        Verifica si un puerto esta disponible (no en uso).
    #>
    param(
        [Parameter(Mandatory=$true)]
        [int]$Port
    )
    
    try {
        # Test-NetConnection devuelve True si PUEDE conectar (puerto en uso)
        # Nosotros queremos saber si ESTA DISPONIBLE (puerto NO en uso)
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
        
        if ($connection) {
            Write-Log "DEBUG: Puerto $Port esta en uso (conectado exitosamente)." -Tipo "DEBUG"
            return $false
        } else {
            return $true
        }
    } catch {
        Write-Log "DEBUG: Error al verificar puerto $Port : $($_.Exception.Message)" -Tipo "DEBUG"
        # Si falla la verificacion, asumir que el puerto esta disponible para no bloquear
        return $true
    }
}

# ========================================
#    FUNCIONES DE INSTALACION
# ========================================

function Get-FerreDeskCodigo {
    <#
    .SYNOPSIS
        Descarga o actualiza el codigo de FerreDesk desde GitHub.
    #>
    $targetDir = $Script:InstallDirectory
    
    if (-not $targetDir) {
        Write-Error "Directorio de instalacion no determinado"
        return $false
    }
    
    Push-Location $targetDir
    
    try {
        # Verificar si ya existe repositorio
        if (Test-Path ".git") {
            Write-Info "Repositorio detectado. Actualizando desde origin/$Script:GitHubBranch..."
            
            try {
                Write-Host "Ejecutando: git fetch origin" -ForegroundColor Cyan
                & git fetch origin
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Error al conectar con GitHub"
                    return $false
                }
                
                Write-Host "Ejecutando: git reset --hard origin/$Script:GitHubBranch" -ForegroundColor Cyan
                & git reset --hard "origin/$Script:GitHubBranch"
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Error al actualizar a origin/$Script:GitHubBranch"
                    return $false
                }
                
                Write-Success "Codigo actualizado exitosamente"
            } catch {
                Write-Error "Error al actualizar codigo: $($_.Exception.Message)"
                return $false
            }
        } else {
            Write-Info "Descargando FerreDesk completo desde GitHub..."
            Write-Info "Esto puede tomar unos minutos..."
            
            try {
                Write-Host "Ejecutando: git clone $Script:GitHubRepo ." -ForegroundColor Cyan
                Write-Host ""
                & git clone $Script:GitHubRepo .
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Error al clonar el repositorio"
                    Write-Info "Posibles soluciones:"
                    Write-Info "  • Verifica tu conexion a internet"
                    Write-Info "  • Asegurate de tener acceso al repositorio"
                    Write-Info "  • Contacta al administrador del sistema"
                    return $false
                }
                
                Write-Success "Codigo descargado exitosamente"
            } catch {
                Write-Error "Error al descargar codigo: $($_.Exception.Message)"
                return $false
            }
        }
        
        # Verificar que existan los archivos necesarios
        if (-not (Test-Path "ferredesk_v0")) {
            Write-Error "No se encontro la carpeta 'ferredesk_v0' dentro del repositorio"
            return $false
        }
        
        if (-not (Test-Path "ferredesk_v0\docker-compose.yml")) {
            Write-Error "No se encontro 'docker-compose.yml' en el proyecto"
            return $false
        }
        
        Write-Success "Codigo listo"
        return $true
        
    } finally {
        Pop-Location
    }
}

function Set-FerreDeskConfiguracion {
    <#
    .SYNOPSIS
        Configura el proyecto (crea .env si no existe).
    #>
    $projectDir = Join-Path $Script:InstallDirectory "ferredesk_v0"
    
    if (-not (Test-Path $projectDir)) {
        Write-Error "Directorio del proyecto no encontrado: $projectDir"
        return $false
    }
    
    Push-Location $projectDir
    
    try {
        # Verificar docker-compose.yml
        if (-not (Test-Path "docker-compose.yml")) {
            Write-Error "Error: Archivos del proyecto incompletos"
            Write-Info "Intenta eliminar la carpeta FerreDesk y ejecutar el instalador nuevamente"
            return $false
        }
        
        # Crear .env si no existe
        if (Test-Path "env.example") {
            if (-not (Test-Path ".env")) {
                Write-Info "Creando archivo de configuracion .env..."
                Copy-Item "env.example" ".env" -ErrorAction Stop
                Write-Success "Archivo .env creado desde env.example"
            } else {
                Write-Info "Archivo .env ya existe, manteniendo configuracion actual"
            }
        } else {
            Write-Warning "Advertencia: No se encontro env.example"
        }
        
        return $true
        
    } catch {
        Write-Error "Error al configurar proyecto: $($_.Exception.Message)"
        return $false
    } finally {
        Pop-Location
    }
}

function Invoke-FerreDeskServicios {
    <#
    .SYNOPSIS
        Construye e inicia los servicios Docker.
        Intenta una recuperacion automatica si el build falla la primera vez.
    #>
    param(
        [Parameter(Mandatory=$false)]
        [switch]$SkipRetry
    )
    
    $projectDir = Join-Path $Script:InstallDirectory "ferredesk_v0"
    
    Push-Location $projectDir
    
    try {
        # Verificar si existe build pre-compilado del frontend
        # Esto evita problemas de memoria al no compilar React dentro de Docker
        $frontendBuildPath = Join-Path $projectDir "frontend\build"
        $buildPreexistente = $false
        
        if (Test-Path $frontendBuildPath) {
            $buildFiles = Get-ChildItem -Path $frontendBuildPath -Recurse -File -ErrorAction SilentlyContinue
            if ($buildFiles -and $buildFiles.Count -gt 0) {
                $buildPreexistente = $true
                Write-Info "Build pre-compilado detectado en frontend/build"
                Write-Info "  Docker usara el build existente (evita compilacion y problemas de memoria)"
                Write-Info "  Archivos encontrados: $($buildFiles.Count)"
                Write-Host ""
            }
        }
        
        if (-not $buildPreexistente) {
            Write-Info "Construyendo FerreDesk (esto puede tomar 5-10 minutos la primera vez)..."
            Write-Warning "NOTA: Se compilara React dentro de Docker (puede requerir mucha memoria)"
            Write-Info "  Si tienes problemas de memoria, compila React localmente primero:"
            Write-Info "    cd frontend && npm run build"
            Write-Host ""
        } else {
            Write-Info "Construyendo FerreDesk (usando build pre-compilado, sera mas rapido)..."
        }
        
        Write-Info "  [INFO] Descargando imagenes Docker..."
        Write-Info "  [INFO] Instalando dependencias Python..."
        Write-Info "  [INFO] Instalando dependencias Node.js..."
        if ($buildPreexistente) {
            Write-Info "  [INFO] Usando build React pre-compilado (omitiendo compilacion)..."
        } else {
            Write-Info "  [INFO] Construyendo aplicacion React..."
        }
        Write-Info "  [INFO] Configurando base de datos..."
        Write-Host ""
        
        # IMPORTANTE: Separar build de up para ver toda la salida en tiempo real
        # En PowerShell, docker-compose up --build -d puede no mostrar la salida completa
        # Por eso ejecutamos build primero (sin -d) para ver TODO el progreso
        
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "CONSTRUYENDO IMAGENES DOCKER" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Ejecutando: docker-compose build" -ForegroundColor Cyan
        Write-Host ""
        
        # Configurar variables de entorno para que Docker muestre salida formateada
        # Igual que en super-install.bat (checkmarks, barras de progreso, etc.)
        $env:DOCKER_BUILDKIT = "1"
        $env:BUILDKIT_PROGRESS = "auto"
        
        # CRITICO: Ejecutar docker-compose directamente en la consola principal
        # Sin redirecciones, sin pipes, sin Out-Null, sin Start-Process, sin &
        # Esto permite que Docker detecte TTY y muestre salida interactiva
        # La salida va directo a stdout/stderr de la consola visible
        # NO usar & porque puede interferir con la herencia de TTY
        docker-compose --progress=auto build
        
        # Forzar flush del buffer y asegurar que el script continúe automáticamente
        # Esto evita que PowerShell espere input del usuario después del build
        [Console]::Out.Flush()
        [Console]::Error.Flush()
        Start-Sleep -Milliseconds 500
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Red
            Write-Host "ERROR AL CONSTRUIR LAS IMAGENES DOCKER" -ForegroundColor Red
            Write-Host "========================================" -ForegroundColor Red
            Write-Host ""
            Write-Error "Error al construir las imagenes Docker"
            Write-Host ""
            
            # Si no se debe hacer retry, salir inmediatamente
            if ($SkipRetry) {
                Write-Host "========================================" -ForegroundColor Yellow
                Write-Host "LOGS DE DOCKER" -ForegroundColor Yellow
                Write-Host "========================================" -ForegroundColor Yellow
                Write-Host ""
                Write-Info "Consultando logs de Docker..."
                Write-Host ""
                
                $containers = docker ps -a --filter "name=ferredesk" --format "{{.Names}}"
                if ($containers) {
                    Write-Info "Logs de contenedores:"
                    Write-Host ""
                    foreach ($container in $containers) {
                        if ($container) {
                            Write-Host "--- Logs de $container ---" -ForegroundColor Cyan
                            docker logs $container --tail 100
                            Write-Host ""
                        }
                    }
                } else {
                    Write-Info "No hay contenedores creados aun (el error ocurrio durante la construccion)"
                    Write-Host ""
                }
                
                Write-Info "Estado de servicios:"
                docker-compose ps
                Write-Host ""
                
                Write-Host "========================================" -ForegroundColor Red
                Write-Host "INFORMACION ADICIONAL" -ForegroundColor Red
                Write-Host "========================================" -ForegroundColor Red
                Write-Host ""
                Write-Info "Posibles soluciones:"
                Write-Info "  • Verifica que Docker Desktop este ejecutandose"
                Write-Info "  • Revisa que los puertos 8000 y 5433 esten libres"
                Write-Info "  • Verifica que Docker Desktop tiene suficiente memoria asignada"
                Write-Info "  • Consulta los logs con: docker-compose logs -f"
                Write-Host ""
                
                return $false
            }
            
            # INTENTAR RECUPERACION AUTOMATICA
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Yellow
            Write-Host "INTENTANDO RECUPERACION AUTOMATICA" -ForegroundColor Yellow
            Write-Host "========================================" -ForegroundColor Yellow
            Write-Host ""
            Write-Info "El build fallo. Intentando recuperacion automatica..."
            Write-Info "  • Limpiando contenedores y imagenes fallidas"
            Write-Info "  • Reconstruyendo desde cero"
            Write-Host ""
            
            # Limpiar contenedores detenidos o fallidos
            Write-Info "Limpiando contenedores existentes..."
            docker-compose down 2>&1 | Out-Null
            Start-Sleep -Seconds 2
            
            # Limpiar imagenes huérfanas (opcional, puede ayudar con problemas de caché)
            Write-Info "Limpiando recursos Docker no utilizados..."
            docker system prune -f 2>&1 | Out-Null
            Start-Sleep -Seconds 2
            
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "RECONSTRUYENDO IMAGENES (INTENTO 2)" -ForegroundColor Yellow
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            
            # Intentar reconstruir con --no-cache para evitar problemas de caché corrupta
            Write-Info "Reconstruyendo imagenes sin usar cache (esto puede tomar mas tiempo)..."
            Write-Host "Ejecutando: docker-compose build --no-cache" -ForegroundColor Cyan
            Write-Host ""
            
            docker-compose build --no-cache --progress=auto
            
            [Console]::Out.Flush()
            [Console]::Error.Flush()
            Start-Sleep -Milliseconds 500
            
            if ($LASTEXITCODE -ne 0) {
                # Si el retry tambien falla, mostrar información detallada y salir
                Write-Host ""
                Write-Host "========================================" -ForegroundColor Red
                Write-Host "RECUPERACION AUTOMATICA FALLIDA" -ForegroundColor Red
                Write-Host "========================================" -ForegroundColor Red
                Write-Host ""
                Write-Error "La recuperacion automatica no pudo construir las imagenes."
                Write-Host ""
                
                Write-Host "========================================" -ForegroundColor Yellow
                Write-Host "LOGS DE DOCKER" -ForegroundColor Yellow
                Write-Host "========================================" -ForegroundColor Yellow
                Write-Host ""
                Write-Info "Consultando logs de Docker..."
                Write-Host ""
                
                $containers = docker ps -a --filter "name=ferredesk" --format "{{.Names}}"
                if ($containers) {
                    Write-Info "Logs de contenedores:"
                    Write-Host ""
                    foreach ($container in $containers) {
                        if ($container) {
                            Write-Host "--- Logs de $container ---" -ForegroundColor Cyan
                            docker logs $container --tail 100
                            Write-Host ""
                        }
                    }
                } else {
                    Write-Info "No hay contenedores creados (el build fallo en ambos intentos)"
                    Write-Host ""
                }
                
                Write-Info "Estado de servicios:"
                docker-compose ps
                Write-Host ""
                
                Write-Host "========================================" -ForegroundColor Red
                Write-Host "INFORMACION ADICIONAL" -ForegroundColor Red
                Write-Host "========================================" -ForegroundColor Red
                Write-Host ""
                Write-Info "El instalador intento recuperarse automaticamente pero fallo."
                Write-Info ""
                Write-Info "Posibles causas:"
                Write-Info "  • Docker Desktop no tiene suficiente memoria asignada"
                Write-Info "  • Problemas de conectividad al descargar imagenes"
                Write-Info "  • Errores en el codigo del proyecto"
                Write-Info "  • Problemas con permisos o recursos del sistema"
                Write-Info ""
                Write-Info "Pasos recomendados:"
                Write-Info "  1. Verifica que Docker Desktop este ejecutandose"
                Write-Info "  2. Aumenta la memoria asignada a Docker Desktop (Settings > Resources)"
                Write-Info "  3. Verifica tu conexion a internet"
                Write-Info "  4. Intenta construir manualmente: docker-compose build"
                Write-Info "  5. Consulta los logs con: docker-compose logs -f"
                Write-Host ""
                
                return $false
            }
            
            Write-Success "Recuperacion automatica exitosa. Las imagenes se reconstruyeron correctamente."
            Write-Host ""
        }
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "INICIANDO SERVICIOS" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Ejecutando: docker-compose up -d" -ForegroundColor Cyan
        Write-Host ""
        
        # Ahora iniciar los servicios en modo detached (ya construidos)
        # Ejecutar directamente sin & para que herede la consola correctamente
        docker-compose up -d
        
        # Forzar flush del buffer y asegurar que el script continúe automáticamente
        [Console]::Out.Flush()
        [Console]::Error.Flush()
        Start-Sleep -Milliseconds 500
        
        # Verificar codigo de salida
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            Write-Error "Error al construir o iniciar FerreDesk"
            Write-Info "Posibles soluciones:"
            Write-Info "  • Verifica que Docker Desktop este ejecutandose"
            Write-Info "  • Revisa que los puertos 8000 y 5433 esten libres"
            Write-Info "  • Consulta los logs con: docker-compose logs -f"
            return $false
        }
        
        Write-Success "Servicios construidos e iniciados"
        return $true
        
    } catch {
        Write-Error "Error al construir servicios: $($_.Exception.Message)"
        return $false
    } finally {
        Pop-Location
    }
}

function Wait-ForServicesReady {
    <#
    .SYNOPSIS
        Espera activamente a que los servicios Docker esten listos.
    #>
    $projectDir = Join-Path $Script:InstallDirectory "ferredesk_v0"
    
    Write-Info "Esperando a que los servicios esten listos..."
    Write-Host ""
    
    # Verificar que docker-compose.yml existe antes de continuar
    if (-not (Test-Path (Join-Path $projectDir "docker-compose.yml"))) {
        Write-Error "docker-compose.yml no encontrado en $projectDir"
        return $false
    }
    
    $timeout = $Script:ServicesWaitTimeout
    $interval = 10
    $elapsed = 0
    $maxAttempts = [math]::Floor($timeout / $interval)
    $noContainersCount = 0
    $maxNoContainersAttempts = 3  # Si no hay contenedores después de 3 intentos, salir
    
    Push-Location $projectDir
    
    try {
        # Esperar un poco antes de verificar (dar tiempo a que inicien)
        Write-Info "Esperando 30 segundos para que los servicios inicien..."
        Start-Sleep -Seconds 30
        
        Write-Host ""
        Write-Info "Verificando estado de los servicios..."
        
        # Verificar si hay contenedores creados (incluyendo detenidos)
        $allContainers = docker ps -a --filter "name=ferredesk" --format "{{.Names}}" 2>$null
        if (-not $allContainers -or $allContainers.Count -eq 0) {
            Write-Warning "No se detectaron contenedores creados. Es posible que el build haya fallado."
            Write-Info "Verificando con docker-compose ps..."
        }
        
        docker-compose ps
        Write-Host ""
        
        $retryAttempted = $false
        
        for ($i = 1; $i -le $maxAttempts; $i++) {
            # Ejecutar docker-compose ps y capturar salida como array de líneas
            $status = docker-compose ps 2>$null
            $statusArray = @($status)
            $statusString = $statusArray | Out-String
            
            # Verificar si realmente hay contenedores (no solo el encabezado)
            # docker-compose ps sin contenedores muestra solo una línea con "NAME      IMAGE..."
            # Necesitamos contar líneas que NO sean encabezados
            $hasRealContainers = $false
            $containerLines = 0
            
            foreach ($line in $statusArray) {
                $lineTrimmed = $line.Trim()
                # Ignorar líneas vacías y encabezados comunes
                if ($lineTrimmed -and 
                    $lineTrimmed -notmatch "^NAME\s+IMAGE\s+COMMAND\s+SERVICE" -and
                    $lineTrimmed -notmatch "^-+$" -and
                    $lineTrimmed.Length -gt 10) {
                    $hasRealContainers = $true
                    $containerLines++
                }
            }
            
            # Si no hay contenedores reales, incrementar contador
            if (-not $hasRealContainers) {
                $noContainersCount++
                Write-Debug "No se detectaron contenedores reales (intento $noContainersCount/$maxNoContainersAttempts)"
                
                # Si después de varios intentos no hay contenedores, es probable que el build falló
                if ($noContainersCount -ge $maxNoContainersAttempts) {
                    Write-Progress -Activity "Esperando servicios..." -Completed
                    Write-Host ""
                    Write-Warning "No se detectaron contenedores después de múltiples intentos."
                    Write-Warning "Es probable que el build de Docker haya fallado o los servicios no se iniciaron correctamente."
                    Write-Host ""
                    
                    # Verificar directamente si hay contenedores con docker ps
                    $directContainers = docker ps -a --filter "name=ferredesk" --format "{{.Names}}" 2>$null
                    if (-not $directContainers -or $directContainers.Count -eq 0) {
                        Write-Error "No hay contenedores de FerreDesk creados. El build probablemente falló."
                        Write-Info "Sugerencias:"
                        Write-Info "  • Revisa los logs del build con: docker-compose logs"
                        Write-Info "  • Verifica que Docker Desktop esté ejecutándose correctamente"
                        Write-Info "  • Intenta ejecutar manualmente: docker-compose up -d"
                        return $false
                    }
                }
            } else {
                # Si encontramos contenedores, resetear el contador
                $noContainersCount = 0
            }
            
            # Escribir al log si hay información
            if (-not [string]::IsNullOrWhiteSpace($statusString) -and $hasRealContainers) {
                Write-Log -Mensaje $statusString -Tipo "INFO"
            }
            
            # Contar servicios que están "Up"
            $servicesUp = 0
            $servicesRestarting = 0
            $servicesExited = 0
            
            foreach ($line in $statusArray) {
                if ($line -match "\s+Up\s+") {
                    $servicesUp++
                    if ($line -match "Restarting") {
                        $servicesRestarting++
                    }
                } elseif ($line -match "\s+Exited\s+") {
                    $servicesExited++
                }
            }
            
            # Si tenemos contenedores pero están todos detenidos, intentar recuperación una vez
            if ($hasRealContainers -and $servicesUp -eq 0 -and $servicesExited -gt 0 -and -not $retryAttempted -and $i -ge 2) {
                Write-Warning "Los contenedores están detenidos. Intentando recuperar servicios (Auto-Retry)..."
                Write-Info "Deteniendo servicios..."
                docker-compose down 2>$null
                Start-Sleep -Seconds 5
                
                Write-Info "Iniciando servicios nuevamente..."
                docker-compose up -d 2>&1 | Out-Host
                $retryAttempted = $true
                
                # Reiniciar contador de espera
                $i = 1
                $elapsed = 0
                Start-Sleep -Seconds 10
                continue
            }
            
            # Verificar que haya al menos 2 servicios "Up" y no estén reiniciándose
            if ($servicesUp -ge 2 -and $servicesRestarting -eq 0) {
                Write-Progress -Activity "Esperando servicios..." -Completed
                Write-Host ""
                Write-Info "Estado final de los servicios:"
                docker-compose ps
                Write-Host ""
                Write-Success "Todos los servicios estan listos ($servicesUp servicios activos)"
                return $true
            }
            
            # Si hay servicios pero están reiniciándose, continuar esperando
            if ($servicesRestarting -gt 0) {
                Write-Debug "Algunos servicios están reiniciándose. Esperando estabilización..."
            }
            
            $percentComplete = [math]::Min(($i / $maxAttempts) * 100, 100)
            Write-Progress -Activity "Esperando servicios..." -Status "Verificando... ($elapsed/$timeout segundos) - $servicesUp servicio(s) activo(s)" -PercentComplete $percentComplete
            
            Start-Sleep -Seconds $interval
            $elapsed += $interval
            
            # Mostrar estado cada 30 segundos
            if ($elapsed % 30 -eq 0 -and $elapsed -gt 0) {
                Write-Host ""
                Write-Info "Estado actual de los servicios ($elapsed/$timeout segundos):"
                docker-compose ps
                Write-Host ""
            }
        }
        
        Write-Progress -Activity "Esperando servicios..." -Completed
        Write-Host ""
        Write-Warning "Timeout esperando servicios. Pueden necesitar mas tiempo para iniciar."
        
        # Diagnostico final: mostrar logs si falló
        Write-Info "Recopilando logs de diagnostico..."
        docker-compose logs --tail 50 2>&1 | Out-Host
        
        Write-Info "Estado final de los servicios:"
        docker-compose ps
        Write-Host ""
        
        # Verificar estado final
        $finalStatus = docker-compose ps 2>$null
        $finalUp = ($finalStatus | Select-String "\s+Up\s+").Count
        if ($finalUp -gt 0) {
            Write-Warning "Algunos servicios están activos pero no todos. Puede ser necesario revisar los logs."
            return $false
        }
        
        return $false
        
    } finally {
        Pop-Location
    }
}

function Test-ApplicationResponding {
    <#
    .SYNOPSIS
        Verifica que la aplicacion web responda.
    #>
    Write-Info "Verificando que la aplicacion web responda..."
    
    $maxAttempts = 6
    $timeout = 10
    
    for ($i = 1; $i -le $maxAttempts; $i++) {
        try {
            Invoke-WebRequest -Uri "http://localhost:8000" -Method Head -TimeoutSec $timeout -ErrorAction Stop | Out-Null
            Write-Success "Aplicacion web respondiendo correctamente"
            return $true
        } catch {
            if ($i -lt $maxAttempts) {
                Write-Debug "Intento $i/$maxAttempts fallido, reintentando..."
                Start-Sleep -Seconds 10
            } else {
                Write-Warning "La aplicacion puede necesitar unos minutos mas para estar lista"
                Write-Info "Puedes verificar manualmente en: http://localhost:8000"
                return $false
            }
        }
    }
    
    return $false
}

function Write-ProgressToInno {
    <#
    .SYNOPSIS
        Escribe progreso a archivo para que Inno Setup lo lea.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Mensaje,
        
        [Parameter(Mandatory=$false)]
        [int]$Percent = -1
    )
    
    if ($Script:ProgressFile) {
        try {
            $percentText = if ($Percent -ge 0) { $Percent } else { -1 }
            $timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            $content = "PERCENT:$percentText|MESSAGE:$Mensaje|TIMESTAMP:$timestamp"
            Set-Content -Path $Script:ProgressFile -Value $content -Encoding UTF8 -ErrorAction SilentlyContinue
        } catch {
            # Si falla escribir progreso, continuar silenciosamente
        }
    }
}

function Complete-Installation {
    <#
    .SYNOPSIS
        Finaliza la instalacion y muestra informacion.
    #>
    if (-not $Silent) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "   INSTALACION COMPLETADA EXITOSAMENTE" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
    }
    
    Write-ProgressToInno -Mensaje "Instalacion completada exitosamente" -Percent 100
    Write-Success "¡FerreDesk se ha instalado y configurado automaticamente!"
    
    if (-not $Silent) {
        Write-Host ""
        Write-Info "Accede a FerreDesk en: http://localhost:8000"
        Write-Host ""
        Write-Info "Credenciales de acceso:"
        Write-Host "   Usuario: admin" -ForegroundColor Yellow
        Write-Host "   Contraseña: admin123" -ForegroundColor Yellow
        Write-Host ""
        Write-Info "Ubicacion de instalacion: $Script:InstallDirectory"
        Write-Host ""
        Write-Info "Comandos utiles (desde el directorio ferredesk_v0):"
        Write-Host "   • Iniciar: start.bat o docker-compose up -d"
        Write-Host "   • Detener: docker-compose down"
        Write-Host "   • Ver logs: docker-compose logs -f"
        Write-Host "   • Reiniciar: docker-compose restart"
        Write-Host "   • Actualizar codigo: update.bat"
        Write-Host "   • Limpiar todo: clean.bat"
        Write-Host ""
        Write-Info "Si tienes problemas:"
        Write-Host "   • Revisa que Docker Desktop este ejecutandose"
        Write-Host "   • Verifica que los puertos 8000 y 5433 esten libres"
        Write-Host "   • Consulta los logs con: docker-compose logs -f"
        Write-Host ""
    }
    
    # Abrir navegador automaticamente (solo si no se especifico NoOpenBrowser)
    if (-not $NoOpenBrowser) {
        try {
            Start-Process "http://localhost:8000"
            if (-not $Silent) {
                Write-Info "Navegador abierto automaticamente"
            }
        } catch {
            if (-not $Silent) {
                Write-Warning "No se pudo abrir el navegador automaticamente"
                Write-Info "Abre manualmente: http://localhost:8000"
            }
        }
    }
    
    if (-not $Silent) {
        Write-Host ""
        Write-Success "¡Disfruta usando FerreDesk!"
        Write-Host ""
    }
}

function Initialize-Logging {
    <#
    .SYNOPSIS
        Prepara los directorios y archivos de log antes de iniciar las fases.
    #>
    try {
    Initialize-InstallerStorage
    } catch {
        $errorMsg = "CRITICO: No se pudieron crear los directorios necesarios para los logs.`nError: $($_.Exception.Message)"
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "   ERROR CRITICO" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
        Write-Host "El instalador requiere permisos de administrador para crear directorios en ProgramData." -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
    
    # Asegurar que el directorio de logs existe (defensa en profundidad)
    if (-not (VerificarDirectorioLog)) {
        $errorMsg = "CRITICO: No se pudo crear o validar el directorio de logs."
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "   ERROR CRITICO" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host "Ubicacion esperada: $(Split-Path -Path $Script:LogFile -Parent)" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
    
    # Crear archivo de log inicial
    try {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    @"
========================================
FerreDesk Installer - Log de Instalacion
Fecha de inicio: $timestamp
Archivo de log: $Script:LogFile
========================================

"@ | Out-File -FilePath $Script:LogFile -Force -Encoding UTF8 -ErrorAction Stop
    } catch {
        $errorMsg = "CRITICO: No se pudo crear el archivo de log: $Script:LogFile`nError: $($_.Exception.Message)"
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "   ERROR CRITICO" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
        exit 1
    }
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "   ARCHIVO DE LOG" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Ubicacion: " -NoNewline
        Write-Host $Script:LogFile -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
    }
    
    Write-Info "Archivo de log: $Script:LogFile"
    Write-Log "Inicio de instalacion" -Tipo "INFO"
    Write-ProgressToInno -Mensaje "Iniciando instalacion de FerreDesk..." -Percent 0
}

function Get-PhaseNormalized {
    param([string]$Phase)
    
    if (-not $Phase) { return $null }
    
    switch ($Phase.ToUpper()) {
        "FASE_1" { return "FASE_1" }
        "FASE1"  { return "FASE_1" }
        "1"      { return "FASE_1" }
        "FASE_2" { return "FASE_2" }
        "FASE2"  { return "FASE_2" }
        "2"      { return "FASE_2" }
        "FASE_3" { return "FASE_3" }
        "FASE3"  { return "FASE_3" }
        "3"      { return "FASE_3" }
        default  { return $null }
    }
}

function Get-PendingPhasesFromState {
    param([pscustomobject]$State)
    
    if (-not $State) {
        return @("FASE_1","FASE_2","FASE_3")
    }
    
    $current = $State.CurrentPhase
    switch ($current) {
        { $_ -eq "FASE_0" -or $_ -eq $null -or $_ -like "FASE_1*" } {
            return @("FASE_1","FASE_2","FASE_3")
        }
        { $_ -like "FASE_2*" } {
            return @("FASE_2","FASE_3")
        }
        { $_ -like "FASE_3*" } {
            return @("FASE_3")
        }
        "COMPLETO" {
            return @()
        }
        default {
            return @("FASE_1","FASE_2","FASE_3")
        }
    }
}

function Invoke-Phase1 {
    Write-ProgressToInno -Mensaje "Fase 1/3: Preparando Windows y dependencias" -Percent 10
    Write-Info "Fase 1/3: Preparando Windows y dependencias"
    
    if (-not (Test-WindowsVersion)) {
        return $Script:EXIT_ERROR
    }
    
    # Si no hay directorio establecido aún, determinarlo
    # (Get-SafeInstallDirectory ya respeta el parámetro si está presente)
    if (-not $Script:InstallDirectory) {
        $Script:InstallDirectory = Get-SafeInstallDirectory
        if (-not $Script:InstallDirectory) {
            Write-Error "No se pudo determinar un directorio de instalacion seguro"
            return $Script:EXIT_ERROR
        }
    }
    
    Write-Info "Directorio de instalacion: $Script:InstallDirectory"
    Write-ProgressToInno -Mensaje "Directorio de instalacion: $Script:InstallDirectory" -Percent 15
    
    $state = Get-InstallationState
    $state.InstallDirectory = $Script:InstallDirectory
    $state.CurrentPhase = "FASE_1_EN_PROGRESO"
    $state.RequiresRestart = $false
    Set-InstallationState $state
    
    # Caracteristicas de Windows
    $features = @(
        "Microsoft-Windows-Subsystem-Linux",
        "VirtualMachinePlatform",
        "HypervisorPlatform"
    )
    
    $requiresRestart = $false
    foreach ($feature in $features) {
        $result = Enable-WindowsFeature -FeatureName $feature
        if ($result.RequiresRestart) {
            $requiresRestart = $true
        }
    }
    
    # WSL
    Write-ProgressToInno -Mensaje "Configurando WSL" -Percent 25
    Write-Info "Configurando WSL..."
    $wslInstallResult = [pscustomobject]@{ Success = $true; RequiresRestart = $false }
    if (-not (Test-WSLInstalled)) {
        $wslInstallResult = Install-WSL
        if (-not $wslInstallResult.Success) {
            Write-Warning "WSL puede requerir reinicio para completar la instalacion"
        }
    }
    
    Update-WSL
    Test-WSLVersion
    Wait-ForWSLReady
    
    # Chocolatey
    Write-ProgressToInno -Mensaje "Instalando dependencias del sistema" -Percent 35
    if (-not (Test-ChocolateyInstalled)) {
        if (-not (Install-Chocolatey)) {
            Write-Error "No se pudo instalar Chocolatey. Instala manualmente desde https://chocolatey.org/install"
            return $Script:EXIT_ERROR
        }
    }
    
    # Git
    Write-ProgressToInno -Mensaje "Instalando Git" -Percent 45
    if (-not (Install-Git)) {
        Write-Error "No se pudo instalar Git"
        return $Script:EXIT_ERROR
    }
    
    # Docker Desktop
    Write-ProgressToInno -Mensaje "Instalando Docker Desktop" -Percent 55
    $dockerInstalledBefore = Test-DockerInstalled
    $dockerInstallResult = [pscustomobject]@{ Success = $dockerInstalledBefore; RequiresRestart = $false; AlreadyInstalled = $dockerInstalledBefore }
    
    if ($dockerInstalledBefore) {
        Write-Info "Docker Desktop ya esta instalado. Se respetara la instalacion existente."
        $state.DockerInstalledByUser = $true
    } else {
        $dockerInstallResult = Install-DockerDesktop
        if (-not $dockerInstallResult.Success -and -not $dockerInstallResult.RequiresRestart) {
            Write-Error "No se pudo instalar Docker Desktop"
            return $Script:EXIT_ERROR
        }
    }
    
    if ($wslInstallResult.RequiresRestart -or $dockerInstallResult.RequiresRestart -or $requiresRestart) {
        $state.CurrentPhase = "FASE_2_PENDIENTE"
        $state.RequiresRestart = $true
        Set-InstallationState $state
        Write-Warning "REINICIO DEL SISTEMA REQUERIDO PARA CONTINUAR."
        Write-Info "Pasos siguientes:"
        Write-Info "  1. Reinicia tu computadora"
        Write-Info "  2. Ejecuta nuevamente este instalador"
        return $Script:EXIT_NEEDS_RESTART
    }
    
    $state.CurrentPhase = "FASE_2_PENDIENTE"
    $state.RequiresRestart = $false
    Set-InstallationState $state
    
    return $Script:EXIT_SUCCESS
}

function Invoke-Phase2 {
    Sync-InstallDirectoryFromState
    Write-ProgressToInno -Mensaje "Fase 2/3: Verificando Docker Desktop" -Percent 65
    Write-Info "Fase 2/3: Verificando Docker Desktop"
    
    $state = Get-InstallationState
    
    # Validar que Docker Desktop este realmente instalado antes de continuar con Fase 2.
    # Esto hace mas robusto el flujo cuando la Fase 1 no pudo completar la instalacion.
    if (-not (Test-DockerInstalled)) {
        Write-Error "Docker Desktop no se encuentra instalado. La Fase 1 no se completo correctamente."
        $state.CurrentPhase = "FASE_1_PENDIENTE"
        $state.RequiresRestart = $false
        $state.LastError = "Docker Desktop no instalado. Es necesario reejecutar la Fase 1 para completar los prerequisitos."
        $state.ErrorCategory = $Script:ERROR_CATEGORY_DOCKER_NOT_READY
        Set-InstallationState $state
        return $Script:EXIT_ERROR
    }
    
    $state.CurrentPhase = "FASE_2_EN_PROGRESO"
    $state.RequiresRestart = $false
    Set-InstallationState $state
    
    if (-not (Test-DockerRunning)) {
        if (-not (Start-DockerDesktop)) {
            Write-Error "No se pudo iniciar Docker Desktop. Inicia Docker Desktop manualmente y reintenta."
            return $Script:EXIT_ERROR
        }
    }
    
    $extendedTimeout = 900
    if (-not (Wait-ForDockerReady -TimeoutSeconds $extendedTimeout -ShowWizardHints)) {
        $state.LastError = "Docker Desktop no respondio dentro del tiempo esperado"
        $state.ErrorCategory = $Script:ERROR_CATEGORY_DOCKER_NOT_READY
        Set-InstallationState $state
        return $Script:EXIT_ERROR
    }
    
    if (-not (Test-PortAvailable -Port 8000)) {
        Write-Warning "El puerto 8000 esta en uso. Puede interferir con FerreDesk."
    }
    if (-not (Test-PortAvailable -Port 5433)) {
        Write-Warning "El puerto 5433 esta en uso. Puede interferir con la base de datos."
    }
    
    $state.CurrentPhase = "FASE_3_PENDIENTE"
    $state.RequiresRestart = $false
    $state.LastError = $null
    Set-InstallationState $state
    
    return $Script:EXIT_SUCCESS
}

function Invoke-Phase3 {
    Sync-InstallDirectoryFromState
    
    # VALIDACIÓN CRÍTICA: Asegurar que tenemos un directorio válido
    if (-not $Script:InstallDirectory -or $Script:InstallDirectory -eq '') {
        # Intentar obtener uno seguro
        $Script:InstallDirectory = Get-SafeInstallDirectory
        
        if (-not $Script:InstallDirectory -or $Script:InstallDirectory -eq '') {
            Write-Error "No se pudo determinar un directorio de instalacion valido. La instalacion no puede continuar."
            Write-Info "Solucion: Ejecuta el instalador nuevamente y selecciona un directorio permanente."
            return $Script:EXIT_ERROR
        }
        
        # Guardar el directorio determinado
        $state = Get-InstallationState
        $state.InstallDirectory = $Script:InstallDirectory
        Set-InstallationState $state
    }
    
    # Validar que no sea temporal
    if (Test-IsTemporaryDirectory -Path $Script:InstallDirectory) {
        Write-Error "El directorio de instalacion es temporal y no puede usarse: $Script:InstallDirectory"
        Write-Info "Solucion: Ejecuta el instalador nuevamente y selecciona un directorio permanente."
        return $Script:EXIT_ERROR
    }
    
    Write-ProgressToInno -Mensaje "Fase 3/3: Descargando y configurando FerreDesk" -Percent 75
    Write-Info "Fase 3/3: Descargando y configurando FerreDesk"
    
    $projectDir = Join-Path $Script:InstallDirectory "ferredesk_v0"
    $state = Get-InstallationState
    $state.CurrentPhase = "FASE_3_EN_PROGRESO"
    $state.RequiresRestart = $false
    Set-InstallationState $state
    
    if (-not (Get-FerreDeskCodigo)) {
        return $Script:EXIT_ERROR
    }
    
    Write-ProgressToInno -Mensaje "Configurando FerreDesk" -Percent 80
    if (-not (Set-FerreDeskConfiguracion)) {
        return $Script:EXIT_ERROR
    }
    
    Write-ProgressToInno -Mensaje "Construyendo servicios Docker" -Percent 85
    # Invoke-FerreDeskServicios intentara recuperacion automatica si falla
    if (-not (Invoke-FerreDeskServicios)) {
        Write-Error "Error al construir o iniciar los servicios Docker. La instalacion no puede continuar."
        Write-Info "El instalador intento recuperarse automaticamente pero no pudo completar la construccion."
        $state.LastError = "Error al construir servicios Docker (recuperacion automatica fallida)"
        Set-InstallationState $state
        return $Script:EXIT_ERROR
    }
    
    Write-ProgressToInno -Mensaje "Esperando a que los servicios esten listos" -Percent 90
    if (-not (Wait-ForServicesReady)) {
        # Intentar una ultima recuperacion: reiniciar los servicios
        Write-Host ""
        Write-Info "Intentando reiniciar los servicios una vez mas..."
        Push-Location $projectDir
        try {
            docker-compose down 2>&1 | Out-Null
            Start-Sleep -Seconds 3
            docker-compose up -d 2>&1 | Out-Host
            Start-Sleep -Seconds 10
            
            # Verificar una vez mas
            $status = docker-compose ps 2>$null
            $servicesUp = ($status | Select-String "\s+Up\s+").Count
            if ($servicesUp -ge 2) {
                Write-Success "Servicios iniciados correctamente tras el reinicio."
            } else {
                Write-Error "Los servicios Docker no se iniciaron correctamente tras los intentos de recuperacion."
                Write-Info "Puedes intentar iniciarlos manualmente con: docker-compose up -d"
                Write-Info "Y verificar el estado con: docker-compose ps"
                $state.LastError = "Servicios Docker no iniciados correctamente (recuperacion fallida)"
                Set-InstallationState $state
                return $Script:EXIT_ERROR
            }
        } catch {
            Write-Error "Error durante el intento de recuperacion: $($_.Exception.Message)"
            $state.LastError = "Error al intentar recuperar servicios Docker"
            Set-InstallationState $state
            return $Script:EXIT_ERROR
        } finally {
            Pop-Location
        }
    }
    
    # VALIDACIÓN CRÍTICA: Verificar que realmente hay contenedores funcionando antes de reportar éxito
    Write-ProgressToInno -Mensaje "Verificando que los servicios esten funcionando" -Percent 95
    $finalStatusCheck = docker-compose ps 2>$null
    # Convertir a array de líneas para procesar correctamente (misma lógica que Wait-ForServicesReady)
    $finalStatusArray = @($finalStatusCheck)
    $finalServicesUp = 0
    
    foreach ($line in $finalStatusArray) {
        if ($line -match "\s+Up\s+") {
            $finalServicesUp++
        }
    }
    
    if ($finalServicesUp -lt 2) {
        Write-Error "Los servicios Docker no estan funcionando correctamente ($finalServicesUp de 2 servicios activos)."
        Write-Info "Estado actual de los servicios:"
        docker-compose ps
        Write-Host ""
        Write-Info "El build de Docker probablemente fallo o los servicios no se iniciaron."
        Write-Info "Por favor, revisa los logs con: docker-compose logs"
        Write-Info "O intenta construir manualmente: docker-compose up --build -d"
        $state.LastError = "Servicios Docker no iniciados correctamente (solo $finalServicesUp de 2 servicios activos)"
        Set-InstallationState $state
        return $Script:EXIT_ERROR
    }
    
    Write-ProgressToInno -Mensaje "Verificando aplicacion web" -Percent 97
    if (-not (Test-ApplicationResponding)) {
        Write-Warning "La aplicacion puede tardar unos minutos adicionales en responder."
        Write-Info "Puedes acceder a FerreDesk en: http://localhost:8000"
        # No es crítico si la app no responde inmediatamente, los servicios están funcionando
    }
    
    Complete-Installation
    $state.CurrentPhase = "COMPLETO"
    $state.RequiresRestart = $false
    $state.LastError = $null
    Set-InstallationState $state
    Clear-InstallationState
    
    return $Script:EXIT_SUCCESS
}

function Invoke-Repair {
    Write-Info "Modo reparacion: verificando Docker y reconstruyendo servicios."
    
    # Si se pasó el parámetro InstallDirectory, usarlo directamente
    # de lo contrario, sincronizar desde el estado
    if ($InstallDirectory) {
        $Script:InstallDirectory = $InstallDirectory
        Write-Info "Usando directorio especificado para reparacion: $InstallDirectory"
    } else {
        Sync-InstallDirectoryFromState
    }
    
    $phase2 = Invoke-Phase2
    if ($phase2 -ne $Script:EXIT_SUCCESS) {
        return $phase2
    }
    
    $phase3 = Invoke-Phase3
    return $phase3
}

function Invoke-Update {
    Write-Info "Modo actualizacion: actualizando repositorio y reconstruyendo imagenes."
    $phase2 = Invoke-Phase2
    if ($phase2 -ne $Script:EXIT_SUCCESS) {
        return $phase2
    }
    
    if (-not (Get-FerreDeskCodigo)) {
        return $Script:EXIT_ERROR
    }
    
    if (-not (Invoke-FerreDeskServicios)) {
        return $Script:EXIT_ERROR
    }
    
    if (-not (Wait-ForServicesReady)) {
        Write-Warning "Los servicios pueden necesitar mas tiempo para iniciar."
    }
    
    if (-not (Test-ApplicationResponding)) {
        Write-Warning "La aplicacion puede tardar en responder."
    }
    
    Write-Success "Actualizacion completada."
    return $Script:EXIT_SUCCESS
}

function Invoke-Reinstall {
    Write-Info "Modo reinstalacion: deteniendo servicios Docker y limpiando instalacion."
    
    # NO sincronizar desde estado si se pasó el parámetro InstallDirectory
    # porque queremos usar el directorio nuevo, no uno temporal del estado anterior
    if (-not $InstallDirectory) {
        Sync-InstallDirectoryFromState
    } else {
        # Si se pasó el parámetro, usarlo directamente
        $Script:InstallDirectory = $InstallDirectory
        Write-Info "Usando directorio especificado para reinstalacion: $InstallDirectory"
    }
    
    $projectDir = $null
    if ($Script:InstallDirectory) {
        $projectDir = Join-Path $Script:InstallDirectory "ferredesk_v0"
    }
    
    if ($projectDir -and (Test-Path $projectDir)) {
        try {
            Push-Location $projectDir
            if (Test-Path "docker-compose.yml") {
                Write-Info "Deteniendo servicios Docker existentes..."
                docker-compose down
            }
        } catch {
            Write-Warning "No se pudieron detener los contenedores existentes: $($_.Exception.Message)"
        } finally {
            Pop-Location
        }
        
        try {
            Write-Info "Eliminando carpeta existente: $projectDir"
            Remove-Item -Path $projectDir -Recurse -Force -ErrorAction Stop
        } catch {
            Write-Warning "No se pudo eliminar la carpeta ${projectDir}: $($_.Exception.Message)"
        }
    }
    
    Clear-InstallationState
    $phases = @("FASE_1","FASE_2","FASE_3")
    return Invoke-PhaseSequence -Phases $phases
}

function Invoke-PhaseSequence {
    param(
        [Parameter(Mandatory=$true)]
        [string[]]$Phases
    )
    
    foreach ($phase in $Phases) {
        $normalized = Get-PhaseNormalized $phase
        if (-not $normalized) {
            Write-Warning "Fase desconocida: $phase. Se omitira."
            continue
        }
        
        $result = switch ($normalized) {
            "FASE_1" { Invoke-Phase1 }
            "FASE_2" { Invoke-Phase2 }
            "FASE_3" { Invoke-Phase3 }
            default  { $Script:EXIT_SUCCESS }
        }
        
        # Asegurar que $result sea un solo entero, no un array
        # Si es un array, tomar solo el último elemento (que debería ser el return value)
        if ($result -is [Array]) {
            $result = $result[-1]
        }
        # Convertir a entero explícitamente
        $result = [int]$result
        
        if ($result -ne $Script:EXIT_SUCCESS) {
            Write-Log "PHASE_SEQUENCE_RESULT: $result (fase: $normalized)" -Tipo "DEBUG"
            return $result
        }
    }
    
    Write-Log "PHASE_SEQUENCE_RESULT: $($Script:EXIT_SUCCESS) (todas las fases completadas)" -Tipo "DEBUG"
    return $Script:EXIT_SUCCESS
}

# ========================================
#    FLUJO PRINCIPAL
# ========================================

function Main {
    if (-not $Silent) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "   SUPER INSTALADOR FERREDESK v4.0" -ForegroundColor Yellow
        Write-Host "   Instalacion completa desde GitHub" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
    }
    
    Initialize-Logging
    
    # Registrar PID del proceso principal para diagnosticar posibles divorcios con el instalador
    Write-Log "MAIN_PID: $PID" -Tipo "DEBUG"
    
    $state = Get-InstallationState

    # Registrar en el estado compartido el PID de esta instancia y limpiar ExitCode previo.
    # Asegurar que Pid y ExitCode existan en el objeto (por si el JSON no los tenía)
    if (-not $state.PSObject.Properties['Pid']) {
        $state | Add-Member -MemberType NoteProperty -Name 'Pid' -Value $null -Force
    }
    if (-not $state.PSObject.Properties['ExitCode']) {
        $state | Add-Member -MemberType NoteProperty -Name 'ExitCode' -Value $null -Force
    }
    
    try {
        $state.Pid = "$PID"
        $state.ExitCode = $null
        Set-InstallationState $state
    } catch {
        # Si falla, continuamos igualmente; el instalador externo seguira usando el resultado de Exec.
        Write-Warning "No se pudo registrar PID en el estado: $($_.Exception.Message)"
    }

    # PRIORIDAD: Si se pasó el parámetro InstallDirectory, establecerlo ANTES de sincronizar desde el estado
    # Esto evita usar directorios temporales del estado anterior
    if ($InstallDirectory) {
        # Validar que no sea temporal
        if (Test-IsTemporaryDirectory -Path $InstallDirectory) {
            Write-Warning "El directorio proporcionado es temporal: $InstallDirectory. Se determinara un directorio permanente."
        } else {
            $Script:InstallDirectory = $InstallDirectory
            Write-Info "Directorio especificado por parametro: $InstallDirectory"
        }
    }

    Sync-InstallDirectoryFromState

    # Verificar estado REAL del sistema antes de decidir fases.
    # La Fase 1 instala dependencias críticas, así que es IMPOSIBLE pasar a Fase 2
    # si faltan dependencias de Fase 1. Verificamos el estado real del sistema
    # y ajustamos el estado guardado en consecuencia.
    try {
        Write-Info "Verificando estado real del sistema antes de decidir fases..."

        # Verificar si TODAS las dependencias críticas de Fase 1 están instaladas
        $gitInstalled = Test-GitInstalled
        $chocoInstalled = Test-ChocolateyInstalled
        $dockerInstalled = Test-DockerInstalled

        Write-Info "Estado del sistema - Git: $gitInstalled, Chocolatey: $chocoInstalled, Docker: $dockerInstalled"

        # Si faltan dependencias críticas de Fase 1, forzar re-ejecución de Fase 1
        $dependenciesOk = $gitInstalled -and $chocoInstalled -and $dockerInstalled

        if (-not $dependenciesOk) {
            Write-Warning "Faltan dependencias criticas de Fase 1. Forzando re-ejecucion completa de Fase 1."

            if (-not $gitInstalled) {
                Write-Warning "Git no esta instalado."
            }
            if (-not $chocoInstalled) {
                Write-Warning "Chocolatey no esta instalado."
            }
            if (-not $dockerInstalled) {
                Write-Warning "Docker Desktop no esta instalado."
            }

            # Resetear estado a Fase 1 pendiente independientemente del estado guardado
            # Preservar Pid y ExitCode que acabamos de asignar
            $savedPid = $state.Pid
            $savedExitCode = $state.ExitCode
            
            $state.CurrentPhase = "FASE_1_PENDIENTE"
            $state.RequiresRestart = $false
            $state.LastError = "Dependencias de Fase 1 incompletas. Re-ejecutando Fase 1."
            $state.Pid = $savedPid
            $state.ExitCode = $savedExitCode
            Set-InstallationState $state

            # IMPORTANTE: Re-leer el estado actualizado para que la variable local se actualice
            # pero preservar el Pid que acabamos de asignar
            $state = Get-InstallationState
            if (-not $state.PSObject.Properties['Pid']) {
                $state | Add-Member -MemberType NoteProperty -Name 'Pid' -Value $savedPid -Force
            }
            if (-not $state.PSObject.Properties['ExitCode']) {
                $state | Add-Member -MemberType NoteProperty -Name 'ExitCode' -Value $savedExitCode -Force
            }
            $state.Pid = $savedPid
            $state.ExitCode = $savedExitCode
            Set-InstallationState $state

            Write-Info "Estado ajustado a FASE_1_PENDIENTE debido a dependencias faltantes."
        } else {
            Write-Info "Todas las dependencias de Fase 1 están instaladas. Procediendo con estado guardado."
        }

    } catch {
        # Si falla la verificación, asumir que faltan dependencias y resetear
        Write-Warning "Error al verificar dependencias del sistema: $($_.Exception.Message). Asumiendo que faltan dependencias."
        # Preservar Pid y ExitCode que acabamos de asignar
        $savedPid = $state.Pid
        $savedExitCode = $state.ExitCode
        
        $state.CurrentPhase = "FASE_1_PENDIENTE"
        $state.RequiresRestart = $false
        $state.LastError = "Error al verificar dependencias. Re-ejecutando Fase 1."
        $state.Pid = $savedPid
        $state.ExitCode = $savedExitCode
        Set-InstallationState $state
        # Re-leer el estado actualizado pero preservar el Pid
        $state = Get-InstallationState
        if (-not $state.PSObject.Properties['Pid']) {
            $state | Add-Member -MemberType NoteProperty -Name 'Pid' -Value $savedPid -Force
        }
        if (-not $state.PSObject.Properties['ExitCode']) {
            $state | Add-Member -MemberType NoteProperty -Name 'ExitCode' -Value $savedExitCode -Force
        }
        $state.Pid = $savedPid
        $state.ExitCode = $savedExitCode
        Set-InstallationState $state
    }
    
    try {
        $result = $Script:EXIT_SUCCESS
        
        if ($Repair) {
            $result = Invoke-Repair
            Set-MainExitCodeAndExit -Codigo $result -Contexto "modo Repair"
        }
        
        if ($Update) {
            $result = Invoke-Update
            Set-MainExitCodeAndExit -Codigo $result -Contexto "modo Update"
        }
        
        if ($Reinstall) {
            $result = Invoke-Reinstall
            Set-MainExitCodeAndExit -Codigo $result -Contexto "modo Reinstall"
        }
        
        # Siempre fallamos rápido si no tenemos permisos
        if (-not (Test-Administrator)) {
            Write-Error "Se require permisos de administrador para continuar."
            Set-MainExitCodeAndExit -Codigo $Script:EXIT_ERROR -Contexto "sin permisos de administrador"
        }
        
        $phasesToRun = @()
        if ($Phase) {
            $normalized = Get-PhaseNormalized $Phase
            if (-not $normalized) {
                Write-Error "Fase especificada invalida: $Phase"
                Set-MainExitCodeAndExit -Codigo $Script:EXIT_ERROR -Contexto "fase invalida: $Phase"
            }
            $phasesToRun = @($normalized)
        } else {
            $phasesToRun = Get-PendingPhasesFromState -State $state
        }
        
        if ($Resume -and $state.CurrentPhase) {
            Write-Info "Reanudando instalacion desde la fase pendiente: $($state.CurrentPhase)"
        }
        
        if ($phasesToRun.Count -eq 0) {
            Write-Info "FerreDesk ya se encuentra instalado. Usa -Update o -Repair para otras acciones."
            Set-MainExitCodeAndExit -Codigo $Script:EXIT_ERROR -Contexto "ya instalado" -ErrorCategory $Script:ERROR_CATEGORY_ALREADY_INSTALLED
        }
        
        $result = Invoke-PhaseSequence -Phases $phasesToRun
        
        # Asegurar que $result sea un solo entero, no un array
        if ($result -is [Array]) {
            $result = $result[-1]
        }
        # Convertir a entero explícitamente
        $result = [int]$result
        
        Set-MainExitCodeAndExit -Codigo $result -Contexto "Invoke-PhaseSequence"
        
    } catch {
        Write-Error "Error durante la instalacion: $($_.Exception.Message)"
        Write-ErrorLog -ErrorRecord $_
        Write-Log "ERROR: $($_.Exception.Message)" -Tipo "ERROR"
        Write-Log "Stack trace: $($_.ScriptStackTrace)" -Tipo "ERROR"
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "   ERROR DURANTE LA INSTALACION" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Total de errores capturados: $Script:ErrorCount" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "   ARCHIVO DE LOG COMPLETO" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Ubicacion: " -NoNewline
        Write-Host $Script:LogFile -ForegroundColor Green
        Write-Host ""
        Write-Host "El archivo de log contiene todos los detalles de los errores." -ForegroundColor Yellow
        Write-Host "Abre el archivo con el Bloc de notas para ver el contenido completo." -ForegroundColor Yellow
        Wait-ForOptionalKeyPress "Presiona cualquier tecla para salir..."
        Set-MainExitCodeAndExit -Codigo $Script:EXIT_ERROR -Contexto "catch de Main"
    }
}

# ========================================
#    VERIFICACION INICIAL DE PERMISOS
#    (ANTES DE CUALQUIER INICIALIZACION)
# ========================================

# Verificar permisos de administrador INMEDIATAMENTE
# Esto debe hacerse antes de cualquier otra cosa para evitar
# que se abran ventanas innecesarias
function Test-Administrator {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Ejecutar flujo principal (solo si ya tiene permisos de administrador)
Main


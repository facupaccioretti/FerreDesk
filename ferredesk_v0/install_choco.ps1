# Este script instala Chocolatey.
# Devuelve códigos de salida específicos para que el script .bat sepa qué hacer.
# 0: Ya estaba instalado, continuar sin reiniciar.
# 3010: Se acaba de instalar, se necesita reiniciar el script .bat.
# 1: Error.

try {
    $choco_exe_path = "C:\ProgramData\chocolatey\bin\choco.exe"
    Write-Host "[INFO] Verificando si Chocolatey esta instalado en '$choco_exe_path'..."
    
    if (Test-Path $choco_exe_path) {
        Write-Host "[OK] Chocolatey ya esta instalado. Continuando..."
        exit 0
    } else {
        Write-Host "[INFO] Chocolatey no encontrado. Iniciando instalacion..."
        Set-ExecutionPolicy Bypass -Scope Process -Force;
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072;
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        Write-Host "[OK] Instalacion de Chocolatey finalizada."
        # Salir con 3010 para indicar al .bat que se necesita un reinicio.
        exit 3010
    }
} catch {
    Write-Host "[ERROR] Ocurrio un error durante la instalacion de Chocolatey."
    Write-Host $_.Exception.Message
    exit 1
}

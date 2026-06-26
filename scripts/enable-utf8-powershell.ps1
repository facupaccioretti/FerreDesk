$utf8_no_bom = New-Object System.Text.UTF8Encoding($false)

# Fuerza UTF-8 en la sesion actual para evitar mojibake al leer y escribir archivos.
[Console]::InputEncoding = $utf8_no_bom
[Console]::OutputEncoding = $utf8_no_bom
$OutputEncoding = $utf8_no_bom

# Cambia la code page activa para que herramientas hijas no hereden CP437.
chcp.com 65001 > $null

# Hace mas predecible la escritura de archivos desde PowerShell 5.1.
$PSDefaultParameterValues["Out-File:Encoding"] = "utf8"
$PSDefaultParameterValues["Set-Content:Encoding"] = "utf8"
$PSDefaultParameterValues["Add-Content:Encoding"] = "utf8"

# Ayuda a que procesos Python hijos emitan UTF-8 en stdio.
$env:PYTHONIOENCODING = "utf-8"

Write-Host "PowerShell UTF-8 habilitado para esta sesion."
Write-Host ("Code page: " + (chcp.com))
Write-Host ("InputEncoding: " + [Console]::InputEncoding.WebName)
Write-Host ("OutputEncoding: " + [Console]::OutputEncoding.WebName)

$ErrorActionPreference = "Stop"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Host "=== 1. Login ==="
$loginBody = @{
    username = "admin@ferretest2.com"
    password = "password123"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "http://ferretest2.lvh.me:3000/api/login/" -Method POST -Body $loginBody -ContentType "application/json" -WebSession $session
Write-Host "Status: $($loginResponse.StatusCode)"

# Extraemos CSRF Token para futuras peticiones si Django lo requiere (Fetch API lo hace)
$csrfCookie = $session.Cookies.GetCookies("http://ferretest2.lvh.me:3000") | Where-Object { $_.Name -eq "csrftoken" }
$headers = @{}
if ($csrfCookie) {
    $headers.Add("X-CSRFToken", $csrfCookie.Value)
}

Write-Host "`n=== 2. Request /api/user/ ==="
$userResponse = Invoke-WebRequest -Uri "http://ferretest2.lvh.me:3000/api/user/" -Method GET -WebSession $session -Headers $headers
Write-Host "Status: $($userResponse.StatusCode)"
Write-Host "Content: $($userResponse.Content)"

Write-Host "`n=== 3. Request /api/ferreteria/ ==="
$ferreResponse = Invoke-WebRequest -Uri "http://ferretest2.lvh.me:3000/api/ferreteria/" -Method GET -WebSession $session -Headers $headers
Write-Host "Status: $($ferreResponse.StatusCode)"
Write-Host "Content: $($ferreResponse.Content)"

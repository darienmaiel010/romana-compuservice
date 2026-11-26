$ErrorActionPreference = "Stop"
$port = 3000

$existingListener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($existingListener) {
  throw "El puerto $port ya está ocupado. Cierra la otra aplicación que lo usa y vuelve a iniciar ROMANA."
}

$server = Start-Process `
  -FilePath $env:ComSpec `
  -ArgumentList @("/k", "npm run start -- -H 127.0.0.1 -p $port") `
  -WorkingDirectory $PSScriptRoot `
  -PassThru

$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  $server.Refresh()
  if ($server.HasExited) {
    throw "El servidor se cerró antes de iniciar. Revisa la ventana de ROMANA para ver el error."
  }
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/login" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $ready) {
  throw "ROMANA no respondió en 60 segundos. Revisa la ventana del servidor."
}

Start-Process "http://127.0.0.1:$port"

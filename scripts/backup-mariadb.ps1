param(
  [string]$BackupDirectory = "C:\Users\Server\Desktop\RCRC\backups"
)

$ErrorActionPreference = "Stop"
$projectDirectory = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectDirectory ".env"

if (!(Test-Path -LiteralPath $envFile)) {
  throw "No existe $envFile"
}

$databaseUrl = (Get-Content -LiteralPath $envFile |
  Where-Object { $_ -match '^DATABASE_URL=' } |
  Select-Object -First 1) -replace '^DATABASE_URL=', ''

$databaseUrl = $databaseUrl.Trim('"')
$uri = [Uri]$databaseUrl
$databaseName = $uri.AbsolutePath.TrimStart("/")
$username = $uri.UserInfo.Split(":")[0]
$password = $uri.UserInfo.Substring($username.Length + 1)
$hostName = $uri.Host
$port = if ($uri.Port -gt 0) { $uri.Port } else { 3306 }

New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $BackupDirectory "romana-$timestamp.sql"
$mariadbDump = "C:\Program Files\MariaDB 13.0\bin\mariadb-dump.exe"

if (!(Test-Path -LiteralPath $mariadbDump)) {
  throw "No se encontró mariadb-dump.exe"
}

$passwordArgument = "--password=$password"
$arguments = @(
  "--host=$hostName",
  "--port=$port",
  "--user=$username",
  $passwordArgument,
  "--single-transaction",
  "--routines",
  "--events",
  "--databases",
  $databaseName
)

& $mariadbDump @arguments | Set-Content -LiteralPath $backupFile -Encoding UTF8

Get-FileHash -Algorithm SHA256 -LiteralPath $backupFile |
  Select-Object Hash,Path |
  Format-Table -AutoSize

Write-Output "Copia creada: $backupFile"

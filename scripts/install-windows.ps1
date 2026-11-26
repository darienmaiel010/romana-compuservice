param(
  [string]$InstallPath = (Join-Path $env:LOCALAPPDATA "Programs\RomanaCompuservice")
)

$ErrorActionPreference = "Stop"
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$InstallPath = [System.IO.Path]::GetFullPath($InstallPath)

function Refresh-Path {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
}

function Install-WingetPackage([string]$PackageId) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "No se encontró winget. Instala Node.js y MariaDB en Windows y vuelve a ejecutar el instalador."
  }
  & winget install --id $PackageId --exact --source winget --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo instalar $PackageId con winget. Revisa el instalador de Windows y vuelve a intentarlo."
  }
  Refresh-Path
}

function Set-PrivateFilePermissions([string]$Path) {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $acl = New-Object System.Security.AccessControl.FileSecurity
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetOwner([Security.Principal.NTAccount]$identity)
  $rule = New-Object -TypeName System.Security.AccessControl.FileSystemAccessRule -ArgumentList @(
    $identity,
    [System.Security.AccessControl.FileSystemRights]::FullControl,
    [System.Security.AccessControl.AccessControlType]::Allow
  )
  $acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $Path -AclObject $acl
}

function New-HexSecret([int]$ByteCount) {
  $bytes = New-Object byte[] $ByteCount
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }
  return [BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
}

function ConvertTo-DotEnvValue([string]$Value) {
  $escaped = $Value.Replace("\", "\\").Replace('"', '\"').Replace("`r", "").Replace("`n", "\n")
  return '"' + $escaped + '"'
}

function Read-SecretText([string]$Prompt) {
  $secureValue = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

if ($InstallPath.StartsWith($sourceRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "La carpeta de instalación no puede estar dentro de la carpeta del instalador."
}
if (Test-Path -LiteralPath $InstallPath) {
  throw "La carpeta '$InstallPath' ya existe. El instalador no modificará ni borrará una instalación existente."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Se necesita Node.js LTS para ejecutar la aplicación."
  if ((Read-Host "¿Instalar Node.js LTS con winget? (S/N)") -notmatch "^[sS]") {
    throw "Instala Node.js LTS y vuelve a ejecutar Instalar-Romana.cmd."
  }
  Install-WingetPackage "OpenJS.NodeJS.LTS"
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw "Node.js no está disponible en esta sesión. Cierra y vuelve a abrir el instalador."
}
$nodeVersionText = (& node -p "process.versions.node").Trim()
if ([version]$nodeVersionText -lt [version]"20.9") {
  throw "Se requiere Node.js 20.9 o posterior; se encontró $nodeVersionText."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "No se encontró npm. Reinstala Node.js LTS y vuelve a ejecutar el instalador."
}

$databaseClient = Get-Command mariadb, mysql -ErrorAction SilentlyContinue |
  Select-Object -First 1
if (-not $databaseClient) {
  Write-Host "Se necesita MariaDB Server para guardar los datos de esta instalación independiente."
  if ((Read-Host "¿Instalar MariaDB Server con winget? (S/N)") -notmatch "^[sS]") {
    throw "Instala MariaDB Server y vuelve a ejecutar Instalar-Romana.cmd."
  }
  Install-WingetPackage "MariaDB.Server"
  $databaseClient = Get-Command mariadb, mysql -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

if (-not $databaseClient) {
  $clientCandidates = Get-ChildItem -Path `
    "$env:ProgramFiles\MariaDB*\bin\mariadb.exe", `
    "$env:ProgramFiles\MariaDB*\bin\mysql.exe" `
    -ErrorAction SilentlyContinue
  $databaseClient = $clientCandidates | Select-Object -First 1
}
if (-not $databaseClient) {
  throw "No se encontró el cliente de MariaDB. Revisa la instalación de MariaDB Server y vuelve a intentarlo."
}

$databaseService = Get-Service |
  Where-Object { $_.DisplayName -match "MariaDB|MySQL" } |
  Select-Object -First 1
if (-not $databaseService) {
  throw "No se encontró el servicio de MariaDB. Completa la instalación de MariaDB Server y vuelve a intentarlo."
}
if ($databaseService.Status -ne "Running") {
  Start-Service -Name $databaseService.Name
  $databaseService = Get-Service -Name $databaseService.Name
  $databaseService.WaitForStatus("Running", [TimeSpan]::FromSeconds(30))
}

$adminUsername = (Read-Host "Nombre de usuario administrador para la aplicación").Trim().ToLowerInvariant()
if (-not $adminUsername -or $adminUsername -match "[^a-z0-9._-]") {
  throw "El usuario debe contener solo letras minúsculas, números, punto, guion o guion bajo."
}
$adminEmail = (Read-Host "Correo interno del administrador (no necesita ser real; Enter usa admin@romana.local)").Trim()
if (-not $adminEmail) {
  $adminEmail = "admin@romana.local"
}
$adminPassword = Read-SecretText "Contraseña de administrador (mínimo 8 caracteres)"
if ($adminPassword.Length -lt 8) {
  throw "La contraseña debe tener al menos 8 caracteres."
}

$suffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
$databaseName = "romana_compuservice_$suffix"
$databaseUsername = "romana_app_$suffix"
$databasePassword = New-HexSecret 24
$authSecret = New-HexSecret 32
$databaseUrl = "mysql://${databaseUsername}:$databasePassword@127.0.0.1:3306/$databaseName"

$sqlPath = Join-Path $env:TEMP "romana-db-init-$suffix.sql"
New-Item -ItemType File -Path $sqlPath | Out-Null
Set-PrivateFilePermissions $sqlPath
$databaseSql = @"
CREATE DATABASE ``$databaseName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER '$databaseUsername'@'127.0.0.1' IDENTIFIED BY '$databasePassword';
GRANT ALL PRIVILEGES ON ``$databaseName``.* TO '$databaseUsername'@'127.0.0.1';
FLUSH PRIVILEGES;
"@
[System.IO.File]::WriteAllText(
  $sqlPath,
  $databaseSql,
  (New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false)
)

try {
  $mysqlPath = $databaseClient.Source
  $mysqlCommand = '"{0}" --protocol=TCP --host=127.0.0.1 --port=3306 --user=root --password < "{1}"' -f $mysqlPath, $sqlPath
  Write-Host "MariaDB pedirá la contraseña root en la consola. No la compartas por chat."
  & $env:ComSpec /d /c $mysqlCommand
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo crear la base de datos local. Comprueba la contraseña root de MariaDB y vuelve a intentarlo."
  }
} finally {
  Remove-Item -LiteralPath $sqlPath -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $InstallPath | Out-Null
$excludedNames = @("node_modules", ".next", ".git", ".turbo", "coverage")
Get-ChildItem -LiteralPath $sourceRoot -Force |
  Where-Object {
    $_.Name -notin $excludedNames -and
    $_.Name -notmatch "^\.env($|\.)" -and
    $_.Extension -ne ".zip"
  } |
  ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $InstallPath -Recurse -Force
  }

$envPath = Join-Path $InstallPath ".env"
$envContents = @(
  "DATABASE_URL=$(ConvertTo-DotEnvValue $databaseUrl)"
  "AUTH_SECRET=$(ConvertTo-DotEnvValue $authSecret)"
  "ADMIN_EMAIL=$(ConvertTo-DotEnvValue $adminEmail)"
  "ADMIN_USERNAME=$(ConvertTo-DotEnvValue $adminUsername)"
  "ADMIN_PASSWORD=$(ConvertTo-DotEnvValue $adminPassword)"
  'WHATSAPP_ERIKA_ACCESS_TOKEN=""'
  'WHATSAPP_ERIKA_PHONE_NUMBER_ID=""'
  'WHATSAPP_API_VERSION="v21.0"'
) -join [Environment]::NewLine
[System.IO.File]::WriteAllText(
  $envPath,
  $envContents,
  (New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false)
)
Set-PrivateFilePermissions $envPath

$env:DATABASE_URL = $databaseUrl
$env:AUTH_SECRET = $authSecret
$env:ADMIN_EMAIL = $adminEmail
$env:ADMIN_USERNAME = $adminUsername
$env:ADMIN_PASSWORD = $adminPassword

Push-Location $InstallPath
try {
  Write-Host "Instalando dependencias de la aplicación..."
  & npm ci
  if ($LASTEXITCODE -ne 0) { throw "Falló npm ci." }

  Write-Host "Creando las tablas de la base independiente..."
  & npm run db:push
  if ($LASTEXITCODE -ne 0) { throw "Falló la creación de tablas." }

  Write-Host "Creando el usuario administrador inicial..."
  & npm run db:seed
  if ($LASTEXITCODE -ne 0) { throw "Falló la creación del usuario inicial." }

  Write-Host "Compilando la aplicación..."
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "Falló la compilación de la aplicación." }
} finally {
  Pop-Location
  $env:ADMIN_PASSWORD = $null
}

$launcherPath = Join-Path $InstallPath "Iniciar-Romana.cmd"
$launcherContents = @"
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-romana.ps1"
if errorlevel 1 pause
"@
[System.IO.File]::WriteAllText($launcherPath, $launcherContents, [System.Text.Encoding]::ASCII)

$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "ROMANA COMPUSERVICE"
New-Item -ItemType Directory -Path $startMenu -Force | Out-Null
$shortcutPath = Join-Path $startMenu "Iniciar ROMANA COMPUSERVICE.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcherPath
$shortcut.WorkingDirectory = $InstallPath
$shortcut.Description = "Inicia la instalación local de ROMANA COMPUSERVICE"
$shortcut.Save()

Write-Host ""
Write-Host "Instalación completada."
Write-Host "Base de datos independiente: $databaseName"
Write-Host "Usuario de acceso: $adminUsername"
Write-Host "La contraseña no se muestra; usa la que acabas de introducir."
Write-Host "Abre Iniciar ROMANA COMPUSERVICE desde el menú Inicio."
Write-Host "Esta instalación queda limitada a esta PC; no publica el servicio en Internet ni configura HTTPS."

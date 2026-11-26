param([string]$OutputPath)

$ErrorActionPreference = "Stop"
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $OutputPath) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "RomanaCompuservice-Windows-$stamp.zip"
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$stagePath = Join-Path $env:TEMP ("romana-package-" + [Guid]::NewGuid().ToString("N"))
$excludedNames = @("node_modules", ".next", ".git", ".turbo", "coverage")

New-Item -ItemType Directory -Path $stagePath | Out-Null
try {
  Get-ChildItem -LiteralPath $sourceRoot -Force |
    Where-Object {
      $_.Name -notin $excludedNames -and
      $_.Name -notmatch "^\.env($|\.)" -and
      $_.Extension -ne ".zip"
    } |
    ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $stagePath -Recurse -Force
    }

  $outputDirectory = Split-Path -Parent $OutputPath
  if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }
  if (Test-Path -LiteralPath $OutputPath) {
    throw "El archivo de destino ya existe; indica otra ruta para no sobrescribirlo."
  }
  Compress-Archive -Path (Join-Path $stagePath "*") -DestinationPath $OutputPath -CompressionLevel Optimal
  Write-Host "Paquete creado: $OutputPath"
  Write-Host "No incluye .env, node_modules ni datos de MariaDB."
} finally {
  if (Test-Path -LiteralPath $stagePath) {
    Remove-Item -LiteralPath $stagePath -Recurse -Force
  }
}

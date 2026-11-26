$databasePath = "C:\Users\Server\Desktop\RCRC\legacy-analysis\analysis-copy\CPRepair-backup-analysis.mdb"

if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) {
  throw "No se encontró la copia de análisis: $databasePath"
}

Add-Type -AssemblyName System.Data
$securePassword = Read-Host "Contraseña interna del archivo MDB (entrada oculta)" -AsSecureString
$password = ""
$passwordPointer = [IntPtr]::Zero
$connection = New-Object System.Data.Odbc.OdbcConnection

try {
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

  $connectionString = New-Object System.Data.Odbc.OdbcConnectionStringBuilder
  $connectionString["Driver"] = "Microsoft Access Driver (*.mdb, *.accdb)"
  $connectionString["DBQ"] = $databasePath
  $connectionString["UID"] = "Admin"
  $connectionString["PWD"] = $password
  $connectionString["ReadOnly"] = "1"
  $connectionString["Exclusive"] = "0"
  $connection.ConnectionString = $connectionString.ConnectionString
  $connection.Open()

  $tables = @(
    $connection.GetSchema("Tables") |
      Where-Object {
        $_.TABLE_TYPE -in @("TABLE", "VIEW") -and
        -not $_.TABLE_NAME.StartsWith("MSys")
      } |
      Sort-Object TABLE_NAME
  )

  if ($tables.Count -eq 0) {
    Write-Output "La conexión funcionó, pero no se encontraron tablas de usuario."
  }

  foreach ($table in $tables) {
    Write-Output ("TABLA: {0}" -f $table.TABLE_NAME)
    $columns = $connection.GetSchema("Columns", @($null, $null, $table.TABLE_NAME, $null))
    foreach ($column in ($columns | Sort-Object ORDINAL_POSITION)) {
      Write-Output ("  CAMPO: {0} ({1})" -f $column.COLUMN_NAME, $column.TYPE_NAME)
    }
  }

  Write-Output "Inspección terminada. No se leyeron registros ni se modificó la base."
}
catch [System.Data.Odbc.OdbcException] {
  $errorMessage = $_.Exception.Message
  if ($password) {
    $errorMessage = $errorMessage.Replace($password, "[oculto]")
  }
  Write-Error "No se pudo abrir la copia de análisis en modo solo lectura: $errorMessage"
  exit 1
}
finally {
  if ($connection.State -eq "Open") {
    $connection.Close()
  }
  $connection.Dispose()
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  $password = $null
  $securePassword = $null
}

# =====================================================================
#  ver-reporte.ps1
#  ---------------------------------------------------------------------
#  Pide el reporte de Flash a la funcion de Supabase, lo guarda como
#  archivo HTML y lo abre en el navegador.
#
#  Sirve para ver como va quedando el reporte sin esperar al correo.
#
#  COMO SE USA  (desde la carpeta del proyecto, en la terminal)
#
#    .\ver-reporte.ps1 GT                        el mes en curso
#    .\ver-reporte.ps1 SV                        el mes en curso
#    .\ver-reporte.ps1 GT -Mes 2026-10           un mes completo
#    .\ver-reporte.ps1 GT -Desde 2026-11-01 -Hasta 2026-11-08
#
#  DONDE QUEDAN LOS ARCHIVOS
#
#    En la carpeta "vista-previa", que esta AL LADO del repositorio,
#    no adentro. Es a proposito: los reportes llevan nombres de
#    clientes y montos, y este repositorio es publico. Al estar fuera,
#    git no los ve y no se pueden subir ni por error.
#
#  LA LLAVE
#
#    No esta escrita aqui. El script la lee del archivo .env, que no
#    se sube a git. En el .env tiene que haber una linea asi:
#
#      REPORTE_API_KEY=la-llave-del-reporte
#
#  SI LA PRIMERA VEZ DICE QUE NO PUEDE EJECUTAR SCRIPTS
#
#    Windows bloquea los scripts por defecto. Se habilita una sola vez:
#
#      Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#      Unblock-File .\ver-reporte.ps1
# =====================================================================

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("GT", "SV")]
  [string]$Pais,

  [string]$Mes,
  [string]$Desde,
  [string]$Hasta
)

$ErrorActionPreference = "Stop"

$PROYECTO = "scypmmaaatqsbtukuwwl"


# --- 1. Buscar la llave -----------------------------------------------

function Leer-LlaveDelEnv {
  $env_path = Join-Path $PSScriptRoot ".env"
  if (-not (Test-Path $env_path)) { return $null }

  foreach ($linea in Get-Content $env_path) {
    $t = $linea.Trim()
    if ($t -eq "" -or $t.StartsWith("#")) { continue }
    if ($t -match '^\s*REPORTE_API_KEY\s*=\s*(.+)$') {
      return $matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

$llave = Leer-LlaveDelEnv
if (-not $llave) { $llave = $env:REPORTE_API_KEY }

if (-not $llave) {
  Write-Host ""
  Write-Host "No encontre la llave del reporte." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Agrega esta linea a tu archivo .env (en esta misma carpeta):"
  Write-Host ""
  Write-Host "    REPORTE_API_KEY=la-llave-del-reporte"
  Write-Host ""
  Write-Host "El .env no se sube a git, asi que la llave se queda en tu computadora."
  Write-Host ""
  exit 1
}


# --- 2. Armar la direccion --------------------------------------------

$url = "https://$PROYECTO.supabase.co/functions/v1/reporte-flash-publico?pais=$Pais"
$periodo = "mes-en-curso"

if ($Desde -or $Hasta) {
  if (-not ($Desde -and $Hasta)) {
    Write-Host "Si usas -Desde tambien tienes que usar -Hasta, y al reves." -ForegroundColor Yellow
    exit 1
  }
  $url += "&desde=$Desde&hasta=$Hasta"
  $periodo = "$Desde-a-$Hasta"
}
elseif ($Mes) {
  $url += "&mes=$Mes"
  $periodo = $Mes
}


# --- 3. Preparar la carpeta de destino --------------------------------
#     Al lado del repositorio, nunca adentro.

$carpeta = Join-Path (Split-Path $PSScriptRoot -Parent) "vista-previa"
if (-not (Test-Path $carpeta)) {
  New-Item -ItemType Directory -Path $carpeta | Out-Null
  Write-Host "Cree la carpeta: $carpeta" -ForegroundColor DarkGray
}

$sello   = Get-Date -Format "yyyyMMdd-HHmm"
$destino = Join-Path $carpeta "reporte-$Pais-$periodo--$sello.html"


# --- 4. Pedirlo -------------------------------------------------------

Write-Host ""
Write-Host "Pidiendo el reporte de $Pais ($periodo)..." -ForegroundColor Cyan

try {
  $r = Invoke-WebRequest -Uri $url `
                         -Headers @{ "x-api-key" = $llave } `
                         -TimeoutSec 120 `
                         -UseBasicParsing
}
catch {
  $codigo = $_.Exception.Response.StatusCode.value__
  Write-Host ""
  Write-Host "La funcion no devolvio el reporte." -ForegroundColor Red
  switch ($codigo) {
    400 { Write-Host "  400 - alguna fecha esta mal escrita. Tiene que ser AAAA-MM-DD." }
    401 { Write-Host "  401 - la llave no coincide. Revisa REPORTE_API_KEY en el .env." }
    502 { Write-Host "  502 - fallo una de las fuentes de datos (SAN o Workflow)." }
    default { Write-Host "  $codigo - $($_.Exception.Message)" }
  }
  Write-Host ""
  exit 1
}

$sinBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($destino, $r.Content, $sinBom)

$kb = [math]::Round($r.Content.Length / 1024, 1)
Write-Host "Listo. $kb KB" -ForegroundColor Green
Write-Host "  $destino" -ForegroundColor DarkGray

if ($kb -gt 95) {
  Write-Host ""
  Write-Host "  Ojo: paso de 95 KB. Gmail corta los correos cerca de los 100 KB." -ForegroundColor Yellow
}

Write-Host ""
Invoke-Item $destino

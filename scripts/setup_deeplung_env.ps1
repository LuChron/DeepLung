param(
  [string]$PythonExe = "",
  [switch]$InstallMonai,
  [switch]$InstallFrontend
)

$ErrorActionPreference = 'Stop'

if (-not $PythonExe) {
  if ($env:CONDA_PREFIX -and (Test-Path (Join-Path $env:CONDA_PREFIX 'python.exe'))) {
    $PythonExe = Join-Path $env:CONDA_PREFIX 'python.exe'
  } else {
    $PythonExe = 'python'
  }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

Write-Host "[1/3] Installing backend and base AI dependencies..." -ForegroundColor Cyan
& $PythonExe -m pip install -r (Join-Path $root 'backend\requirements.txt') -r (Join-Path $root 'ai-engine\requirements.txt')

if ($InstallMonai) {
  Write-Host "[2/3] Installing MONAI runtime dependencies..." -ForegroundColor Cyan
  & $PythonExe -m pip install -r (Join-Path $root 'ai-engine\requirements-monai.txt')
  Write-Host "MONAI runtime dependencies installed." -ForegroundColor Green
  Write-Host "If torchvision is still missing, install the matching build for your existing torch in the same env." -ForegroundColor Yellow
}

if ($InstallFrontend) {
  $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCmd) {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  }
  if (-not $npmCmd) {
    throw 'npm was not found. Please install Node.js 18+ and reopen the terminal.'
  }

  Write-Host "[3/3] Installing frontend dependencies..." -ForegroundColor Cyan
  Push-Location (Join-Path $root 'frontend')
  try {
    & $npmCmd.Source install
    & $npmCmd.Source --prefix apps/doctor-web install
    & $npmCmd.Source --prefix apps/patient-h5 install
  } finally {
    Pop-Location
  }
}

Write-Host "Environment setup completed." -ForegroundColor Green

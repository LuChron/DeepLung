param(
  [string]$PythonExe = ""
)

$ErrorActionPreference = 'Stop'

if (-not $PythonExe) {
  if ($env:CONDA_PREFIX -and (Test-Path (Join-Path $env:CONDA_PREFIX 'python.exe'))) {
    $PythonExe = Join-Path $env:CONDA_PREFIX 'python.exe'
  } else {
    $PythonExe = 'python'
  }
}

$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCmd) {
  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
}

$pythonCheck = @'
import importlib
import json
import platform

packages = [
    "fastapi",
    "uvicorn",
    "pydantic",
    "httpx",
    "numpy",
    "torch",
    "torchvision",
    "monai",
    "nibabel",
    "SimpleITK",
]

result = {
    "python_version": platform.python_version(),
    "packages": {},
}

for name in packages:
    try:
        module = importlib.import_module(name)
        result["packages"][name] = {
            "installed": True,
            "version": getattr(module, "__version__", "unknown"),
        }
    except Exception as exc:
        result["packages"][name] = {
            "installed": False,
            "error": str(exc),
        }

try:
    import torch
    result["torch_runtime"] = {
        "cuda_available": bool(torch.cuda.is_available()),
        "cuda_device_count": int(torch.cuda.device_count()),
        "cuda_device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() and torch.cuda.device_count() > 0 else None,
        "version": torch.__version__,
    }
except Exception as exc:
    result["torch_runtime"] = {"error": str(exc)}

print(json.dumps(result, ensure_ascii=False, indent=2))
'@

$env:PYTHONWARNINGS = 'ignore'
$tmpPy = Join-Path ([System.IO.Path]::GetTempPath()) ("deeplung_env_check_" + [System.Guid]::NewGuid().ToString("N") + ".py")
Set-Content -Path $tmpPy -Value $pythonCheck -Encoding UTF8
$pythonJson = & $PythonExe $tmpPy 2>$null
$nodeResult = [ordered]@{
  npm_found = $false
  npm_version = $null
}

if ($npmCmd) {
  $nodeResult.npm_found = $true
  try {
    $nodeResult.npm_version = (& $npmCmd.Source --version | Select-Object -First 1)
  } catch {
    $nodeResult.npm_version = "unknown"
  }
}

Write-Output '=== Python Environment ==='
$pythonJson
Write-Output ''
Write-Output '=== Node Environment ==='
([pscustomobject]$nodeResult | ConvertTo-Json -Depth 4)

if (Test-Path $tmpPy) {
  Remove-Item $tmpPy -Force
}

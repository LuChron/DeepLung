param(
  [string]$AutoDownload = "true",
  [string]$BundleDir = "",
  [string]$PythonExe = "",
  [string]$RootDir = ""
)

$ErrorActionPreference = 'Stop'

if (-not $PythonExe) {
  if ($env:CONDA_PREFIX -and (Test-Path (Join-Path $env:CONDA_PREFIX 'python.exe'))) {
    $PythonExe = Join-Path $env:CONDA_PREFIX 'python.exe'
  } else {
    $PythonExe = 'python'
  }
}

if (-not $RootDir) {
  $RootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

$py = $PythonExe
$root = $RootDir
if (-not $BundleDir) { $BundleDir = Join-Path $root 'ai-engine\models\lung_nodule_ct_detection' }
$ctPath = Join-Path $root 'tmp_monai_ct.nii.gz'
$log = Join-Path $root 'ai-monai.runtime.log'
$err = Join-Path $root 'ai-monai.runtime.err'

if (Test-Path $ctPath) { Remove-Item $ctPath -Force }
if (Test-Path $log) { Remove-Item $log -Force }
if (Test-Path $err) { Remove-Item $err -Force }

# Create a tiny synthetic CT volume
$code = @"
import numpy as np
import nibabel as nib
arr = np.random.normal(loc=-800, scale=150, size=(64,64,64)).astype(np.float32)
arr[28:36,28:36,28:36] = 100.0
img = nib.Nifti1Image(arr, affine=np.eye(4, dtype=np.float32))
nib.save(img, r'$ctPath')
print('saved', r'$ctPath')
"@
& $py -c $code | Out-Null

$env:DETECTOR_PROVIDER = 'monai_bundle'
$env:MODEL_VERSION = 'monai-lung-nodule-v1'
$env:FALLBACK_TO_MOCK_ON_ERROR = 'true'
$env:MONAI_BUNDLE_REPO_ID = 'MONAI/lung_nodule_ct_detection'
$env:MONAI_BUNDLE_DIR = $BundleDir
$env:MONAI_AUTO_DOWNLOAD = $AutoDownload
$env:MONAI_INFER_CONFIG_RELPATH = 'configs/inference.json'
$env:MONAI_META_FILE_RELPATH = 'configs/metadata.json'
$env:MONAI_DEVICE = 'cpu'

$p = Start-Process -FilePath $py -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8100') -WorkingDirectory (Join-Path $root 'ai-engine') -PassThru -RedirectStandardOutput $log -RedirectStandardError $err

function Wait-Ready([string]$url,[int]$timeoutSec=60){
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while((Get-Date) -lt $deadline){
    try {
      $resp = Invoke-RestMethod -Uri $url -TimeoutSec 5
      return $resp
    } catch {
      Start-Sleep -Milliseconds 700
    }
  }
  throw "timeout waiting for $url"
}

try {
  $health = Wait-Ready 'http://127.0.0.1:8100/health'
  $body = @{
    study_id = 'MONAI-SMOKE-001'
    object_key = 'unused'
    ct_path = $ctPath
  } | ConvertTo-Json
  $pred = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8100/v1/predict' -ContentType 'application/json' -Body $body -TimeoutSec 1200

  [pscustomobject]@{
    health_runtime = $health.data.runtime
    inference_mode_used = $pred.data.inference_mode_used
    risk_level = $pred.data.risk_level
    note = $pred.data.note
    nodule_count = $pred.data.nodules.Count
  } | ConvertTo-Json -Depth 8
}
finally {
  if ($p -and !$p.HasExited) { Stop-Process -Id $p.Id -Force }
  if (Test-Path $ctPath) { Remove-Item $ctPath -Force }
}

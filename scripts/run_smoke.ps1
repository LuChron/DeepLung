param(
  [string]$PythonExe = '',
  [string]$RootDir = '',
  [ValidateSet('mock','monai_bundle')]
  [string]$DetectorProvider = 'mock',
  [string]$ModelVersion = '',
  [string]$MonaiBundleDir = '',
  [string]$MonaiAutoDownload = 'false'
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
if (-not $ModelVersion) {
  if ($DetectorProvider -eq 'monai_bundle') { $ModelVersion = 'monai-lung-nodule-v1' } else { $ModelVersion = 'baseline-mock-v1' }
}
if (-not $MonaiBundleDir) { $MonaiBundleDir = Join-Path $root 'ai-engine\models\lung_nodule_ct_detection' }

$env:DETECTOR_PROVIDER = $DetectorProvider
$env:MODEL_VERSION = $ModelVersion
$env:FALLBACK_TO_MOCK_ON_ERROR = 'true'
$env:MONAI_BUNDLE_REPO_ID = 'MONAI/lung_nodule_ct_detection'
$env:MONAI_BUNDLE_DIR = $MonaiBundleDir
$env:MONAI_AUTO_DOWNLOAD = $MonaiAutoDownload
$env:MONAI_INFER_CONFIG_RELPATH = 'configs/inference.json'
$env:MONAI_META_FILE_RELPATH = 'configs/metadata.json'
$env:MONAI_DEVICE = 'cpu'

$aiLog = Join-Path $root 'ai-engine.runtime.log'
$aiErr = Join-Path $root 'ai-engine.runtime.err'
$beLog = Join-Path $root 'backend.runtime.log'
$beErr = Join-Path $root 'backend.runtime.err'
if (Test-Path $aiLog) { Remove-Item $aiLog -Force }
if (Test-Path $aiErr) { Remove-Item $aiErr -Force }
if (Test-Path $beLog) { Remove-Item $beLog -Force }
if (Test-Path $beErr) { Remove-Item $beErr -Force }

$ai = Start-Process -FilePath $py -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8100') -WorkingDirectory (Join-Path $root 'ai-engine') -PassThru -RedirectStandardOutput $aiLog -RedirectStandardError $aiErr
$be = Start-Process -FilePath $py -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory (Join-Path $root 'backend') -PassThru -RedirectStandardOutput $beLog -RedirectStandardError $beErr
$tmpCtPath = $null

function Wait-Ready([string]$url,[int]$timeoutSec=30){
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while((Get-Date) -lt $deadline){
    try {
      $resp = Invoke-RestMethod -Uri $url -TimeoutSec 3
      return $resp
    } catch {
      Start-Sleep -Milliseconds 700
    }
  }
  throw "timeout waiting for $url"
}

try {
  $aiHealth = Wait-Ready 'http://127.0.0.1:8100/health'
  $beHealth = Wait-Ready 'http://127.0.0.1:8000/api/v1/health'

  $fileName = 'demo.mhd'
  if ($DetectorProvider -eq 'monai_bundle') {
    $tmpCtPath = Join-Path $root 'tmp_smoke_ct.nii.gz'
    if (Test-Path $tmpCtPath) { Remove-Item $tmpCtPath -Force }
    $code = @"
import numpy as np
import nibabel as nib
arr = np.random.normal(loc=-800, scale=150, size=(64,64,64)).astype(np.float32)
arr[26:38,26:38,26:38] = 120.0
img = nib.Nifti1Image(arr, affine=np.eye(4, dtype=np.float32))
nib.save(img, r'$tmpCtPath')
"@
    & $py -c $code | Out-Null
    $fileName = $tmpCtPath
  }

  $uploadBody = @{ patient_id='P10001'; file_name=$fileName; file_size=12345 } | ConvertTo-Json
  $upload = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/v1/upload_ct' -ContentType 'application/json' -Body $uploadBody
  $studyId = $upload.data.study_id

  $predict = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/v1/ai/predict/$studyId"
  $jobId = $predict.data.job_id

  $job = $null
  $maxPoll = 12
  if ($DetectorProvider -eq 'monai_bundle') { $maxPoll = 180 }
  for($i=0; $i -lt $maxPoll; $i++){
    Start-Sleep -Milliseconds 1000
    $job = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/api/v1/ai/jobs/$jobId"
    if($job.data.status -ne 'PENDING' -and $job.data.status -ne 'RUNNING'){ break }
  }

  $doctor = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8000/api/v1/doctor/patients?sort=risk_level'
  $patientReport = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8000/api/v1/patient/report/R202603090001'

  [pscustomobject]@{
    ai_health = $aiHealth
    backend_health = $beHealth
    study_id = $studyId
    job_id = $jobId
    job_status = $job.data.status
    job_risk = $job.data.risk_level
    doctor_count = $doctor.data.Count
    patient_report_risk = $patientReport.data.risk_light
  } | ConvertTo-Json -Depth 8
}
finally {
  if ($be -and !$be.HasExited) { Stop-Process -Id $be.Id -Force }
  if ($ai -and !$ai.HasExited) { Stop-Process -Id $ai.Id -Force }
  if ($tmpCtPath -and (Test-Path $tmpCtPath)) { Remove-Item $tmpCtPath -Force }
}

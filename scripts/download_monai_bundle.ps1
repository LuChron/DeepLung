# MONAI bundle 预下载脚本（可选）

param(
    [string]$RepoId = "MONAI/lung_nodule_ct_detection",
    [string]$LocalDir = "ai-engine/models/lung_nodule_ct_detection"
)

$ErrorActionPreference = 'Stop'

$code = @"
from huggingface_hub import snapshot_download
repo_id = r'''$RepoId'''
local_dir = r'''$LocalDir'''
print(f"downloading {repo_id} -> {local_dir}")
snapshot_download(repo_id=repo_id, local_dir=local_dir, local_dir_use_symlinks=False)
print("done")
"@

python -c $code

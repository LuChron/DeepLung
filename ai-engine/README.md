# AI Engine

AI 服务支持可插拔检测器：
- `mock`：稳定模拟推理（默认，快速联调）
- `monai_bundle`：MONAI 官方 bundle 推理

## 1) 快速启动（mock）

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

## 2) 启用 MONAI bundle（真实检测）

```bash
pip install -r requirements-monai.txt
```

`requirements-monai.txt` 已包含 `torch`、`monai[fire]`、`itk`、`pytorch-ignite` 等依赖。

环境变量建议：

```bash
DETECTOR_PROVIDER=monai_bundle
MODEL_VERSION=monai-lung-nodule-v1
MONAI_BUNDLE_REPO_ID=MONAI/lung_nodule_ct_detection
MONAI_BUNDLE_DIR=./models/lung_nodule_ct_detection
MONAI_AUTO_DOWNLOAD=true
MONAI_INFER_CONFIG_RELPATH=configs/inference.json
MONAI_META_FILE_RELPATH=configs/metadata.json
MONAI_DEVICE=cpu
FALLBACK_TO_MOCK_ON_ERROR=true
```

`MONAI_AUTO_DOWNLOAD=true` 时，首次推理会自动从 HuggingFace 下载 bundle。
CPU 环境下已自动注入 checkpoint `map_location=cpu`，避免 CUDA 序列化权重加载失败。

## 3) 接口

### 健康检查
`GET /health`

### 推理
`POST /v1/predict`

```json
{
  "study_id": "S001",
  "object_key": "ct/P001/S001/scan.mhd",
  "ct_path": "D:/data/scan.mhd"
}
```

`monai_bundle` 模式下必须提供可访问的 CT 本地路径（`ct_path` 或 `object_key` 指向本地文件）。

## 4) 冒烟脚本

- `../scripts/run_ai_monai_smoke.ps1`：自动生成测试 NIfTI 并验证 MONAI 推理链路。

示例：

```bash
powershell -ExecutionPolicy Bypass -File ../scripts/run_ai_monai_smoke.ps1 -PythonExe D:/Users/34544/miniconda3/envs/deeplung/python.exe
```

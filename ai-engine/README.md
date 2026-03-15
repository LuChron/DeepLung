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

建议先在当前虚拟环境中安装与你的 CUDA 匹配的 `torch`，再安装 `requirements-monai.txt` 中的其余依赖。

环境变量建议：

```bash
DETECTOR_PROVIDER=monai_bundle
MODEL_VERSION=monai-lung-nodule-v1
MONAI_BUNDLE_REPO_ID=MONAI/lung_nodule_ct_detection
MONAI_BUNDLE_DIR=./models/lung_nodule_ct_detection
MONAI_AUTO_DOWNLOAD=true
MONAI_INFER_CONFIG_RELPATH=configs/inference.json
MONAI_META_FILE_RELPATH=configs/metadata.json
MONAI_DEVICE=auto
FALLBACK_TO_MOCK_ON_ERROR=true
```

`MONAI_AUTO_DOWNLOAD=true` 时，首次推理会自动从 HuggingFace 下载 bundle。
`MONAI_DEVICE=auto` 时，服务会优先选择 GPU，不可用时自动回退到 CPU。
CPU 环境下已自动注入 checkpoint `map_location=cpu`，避免 CUDA 序列化权重加载失败。

## 3) 接口

### 健康检查
`GET /health`

健康检查会返回当前请求设备、实际解析出的运行设备、CUDA 是否可用和 GPU 名称。

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

返回结果语义约定：

- `nodules[].detection_score`：疑似结节检出置信度
- `risk_score`：系统级辅助风险分值
- `risk_level`：系统级辅助风险等级

当前版本不输出病理学意义上的“恶性概率”字段。

## 4) 冒烟脚本

- `../scripts/run_ai_monai_smoke.ps1`：自动生成测试 NIfTI 并验证 MONAI 推理链路。

示例：

```bash
powershell -ExecutionPolicy Bypass -File ../scripts/run_ai_monai_smoke.ps1 -PythonExe D:/Users/34544/miniconda3/envs/deeplung/python.exe
```

# DeepLung

基于 3D 医学影像的肺结节智能筛查与医患双端协同系统。  
当前仓库提供可运行的端到端工程骨架：`前端双端 + FastAPI 后端 + AI 推理服务（mock / MONAI bundle）`。

## 项目特性

- 医生端：风险排序看板、上传并触发 AI 推理、任务状态轮询
- 患者端：报告编号查询、风险灯展示、结节明细与随访提示
- 后端：统一 REST API，支持异步 AI 任务触发与状态查询
- AI 引擎：可插拔检测器
  - `mock`：稳定模拟推理（默认，联调友好）
  - `monai_bundle`：真实检测通道（MONAI 模型包）

## 技术栈

- 前端：React 18 + TypeScript + Vite（医生端/患者端双应用）
- 后端：FastAPI + Pydantic + httpx
- AI：Python + MONAI bundle（可选）
- 数据与部署：PostgreSQL / Redis / MinIO / Nginx / Docker Compose（可选）

## 目录结构

```text
.
├─ai-engine/                   # AI 推理服务
├─backend/                     # FastAPI 业务服务
├─frontend/                    # 医生端 + 患者端
├─docs/                        # 设计文档、接口、数据库等
├─infra/                       # Nginx 配置
├─scripts/                     # 冒烟与模型下载脚本
└─docker-compose.yml
```

## 环境准备（推荐 conda）

```powershell
conda create -n deeplung -y python=3.11
conda run -n deeplung python -m pip install -r backend/requirements.txt -r ai-engine/requirements.txt
```

如需启用 MONAI 真实推理通道，再安装：

```powershell
conda run -n deeplung python -m pip install -r ai-engine/requirements-monai.txt
```

## 完整启动步骤（前后端 + AI）

请开 3 个终端。

### 终端 A：Backend

```powershell
cd d:\task\learning_projects\DeepLung\backend
D:\Users\34544\miniconda3\envs\deeplung\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 终端 B：AI Engine

默认 mock 模式（推荐先这样跑通）：

```powershell
cd d:\task\learning_projects\DeepLung\ai-engine
D:\Users\34544\miniconda3\envs\deeplung\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

### 终端 C：Frontend

```powershell
cd d:\task\learning_projects\DeepLung\frontend
npm install
npm --prefix apps/doctor-web install
npm --prefix apps/patient-h5 install
npm run dev
```

## 访问地址

- Backend OpenAPI: <http://127.0.0.1:8000/docs>
- AI Engine OpenAPI: <http://127.0.0.1:8100/docs>
- 医生端：<http://127.0.0.1:5173>
- 患者端：<http://127.0.0.1:5174>

## 切换到 MONAI 真实检测

### 方式 1：直接设环境变量启动 AI 服务

```powershell
cd d:\task\learning_projects\DeepLung\ai-engine
$env:DETECTOR_PROVIDER='monai_bundle'
$env:MODEL_VERSION='monai-lung-nodule-v1'
$env:MONAI_BUNDLE_REPO_ID='MONAI/lung_nodule_ct_detection'
$env:MONAI_BUNDLE_DIR='.\models\lung_nodule_ct_detection'
$env:MONAI_AUTO_DOWNLOAD='true'
$env:MONAI_INFER_CONFIG_RELPATH='configs/inference.json'
$env:MONAI_META_FILE_RELPATH='configs/metadata.json'
$env:MONAI_DEVICE='cpu'
$env:FALLBACK_TO_MOCK_ON_ERROR='true'
D:\Users\34544\miniconda3\envs\deeplung\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

### 方式 2：用脚本验证

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_ai_monai_smoke.ps1 -PythonExe D:/Users/34544/miniconda3/envs/deeplung/python.exe
```

## 冒烟脚本

### 全链路（backend + ai-engine）

```powershell
# mock 模式
powershell -ExecutionPolicy Bypass -File scripts/run_smoke.ps1 -PythonExe D:/Users/34544/miniconda3/envs/deeplung/python.exe

# monai_bundle 模式
powershell -ExecutionPolicy Bypass -File scripts/run_smoke.ps1 -PythonExe D:/Users/34544/miniconda3/envs/deeplung/python.exe -DetectorProvider monai_bundle -MonaiAutoDownload false
```

### MONAI 单服务链路

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_ai_monai_smoke.ps1 -PythonExe D:/Users/34544/miniconda3/envs/deeplung/python.exe
```

## API 快速索引

- `POST /api/v1/upload_ct`：上传检查并创建 Study
- `POST /api/v1/ai/predict/{study_id}`：触发 AI 任务
- `GET /api/v1/ai/jobs/{job_id}`：查询任务状态
- `GET /api/v1/doctor/patients?sort=risk_level`：医生端风险列表
- `GET /api/v1/patient/report/{report_id}`：患者报告

## 常见问题

### 1) `No module named uvicorn`

原因：终端里的 Python 指向项目 `.venv`，不是 conda 环境。  
解决：直接用 conda 环境绝对路径启动：

```powershell
D:\Users\34544\miniconda3\envs\deeplung\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2) 后端 AI 任务报 `502`

已在代码中关闭了 `httpx` 环境代理继承（`trust_env=False`）。  
如仍异常，检查 `AI_ENGINE_BASE_URL` 是否为 `http://127.0.0.1:8100`。

### 3) MONAI 在 CPU 下加载失败

项目已在运行时注入 `map_location=cpu`。  
若仍失败，先执行 `run_ai_monai_smoke.ps1` 查看详细错误。

## 关键文档

- [完整项目设计方案](docs/完整项目设计方案.md)
- [API 接口设计](docs/API接口设计.md)
- [数据库设计 SQL](docs/数据库设计.sql)
- [系统架构图（Mermaid）](docs/系统架构图.mmd)
- [肺结节检测平替方案调研](docs/肺结节检测平替方案调研.md)

## 声明

本仓库用于课程/学习与工程验证场景，不构成医疗诊断建议。

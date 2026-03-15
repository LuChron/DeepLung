# DeepLung

基于胸部 CT 的肺结节辅助检出、风险分层与医患双端协同随访系统。

> 说明：本仓库用于课程项目、工程原型和流程验证，不作为临床诊断系统。

## 1. 当前状态（2026-03）

当前版本已跑通完整闭环（不依赖外接对话 API 也可完整运行）：

1. 医生端上传 CT（传入后端可访问的文件路径）。
2. AI Engine 调用 MONAI 3D 检测模型（支持 `mock` / `monai_bundle`）。
3. 后端创建并持久化推理任务，轮询状态并落库结果。
4. 后端生成病例级风险分层并更新医生分诊列表。
5. 医生端签发报告，报告持久化并返回 `report_id`。
6. 医生可向患者发送消息，患者端可在 `Messages` 页面查看。
7. 患者端按 `report_id` 查看报告、结节明细、随访日期。
8. 患者端聊天走后端 `/api/v1/chat/assistant`，默认 `mock`，后续可一键切 `external`。

## 2. 技术路线

`CT 上传 -> MONAI 检测 -> 结构化结果 -> 风险分层 -> 医生复核签发 -> 患者查看与随访`

当前语义约定：

- `detection_score`: 结节检出置信度（非恶性概率）
- `risk_score`: 系统级辅助风险分值
- `risk_level`: 系统级辅助风险等级（LOW/MEDIUM/HIGH）

## 3. 目录结构

```text
DeepLung/
├─ ai-engine/                     # AI 推理服务（FastAPI）
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ config.py
│  │  └─ pipeline/detector_adapter.py
│  ├─ models/lung_nodule_ct_detection/
│  ├─ requirements.txt
│  ├─ requirements-monai.txt
│  └─ README.md
├─ backend/                       # 业务后端（FastAPI）
│  ├─ app/
│  │  ├─ api/v1/endpoints/        # auth/upload/ai/doctor/patient/chat
│  │  ├─ db/                      # SQLAlchemy 模型与初始化
│  │  ├─ services/                # AI 客户端、持久化存储、助手适配层
│  │  └─ core/
│  ├─ requirements.txt
│  └─ README.md
├─ frontend/                      # 单应用前端（医生 + 患者路由）
│  ├─ src/app/components/
│  ├─ src/app/services/
│  └─ package.json
├─ docs/
├─ scripts/
├─ docker-compose.yml
└─ README.md
```

## 4. 后端持久化说明

后端已从内存存储切换为数据库持久化（默认 SQLite）：

- 默认 DB: `backend/deeplung.db`
- 已持久化实体：
  - `users`
  - `studies`
  - `jobs`
  - `patient_triage`
  - `reports`
  - `doctor_patient_messages`

启动时自动建表与初始化种子数据（用户、演示分诊、演示报告）。

## 5. 快速启动（推荐 Linux/macOS Bash）

说明：当前推荐直接用 Conda + 本地进程启动。`docker-compose.yml` 保留为可选部署方案，不是必须项。

## 5.1 环境准备

- Python 3.11
- Node.js 20+
- Conda（推荐）

```bash
conda create -n deeplung -y python=3.11
conda activate deeplung
```

安装后端 + AI 依赖：

```bash
python -m pip install -r backend/requirements.txt -r ai-engine/requirements.txt
python -m pip install -r ai-engine/requirements-monai.txt
```

安装前端依赖：

```bash
cd frontend
npm install
```

## 5.2 启动顺序（3 个终端）

### 终端 A：AI Engine（MONAI）

```bash
cd ai-engine
export DETECTOR_PROVIDER=monai_bundle
export MODEL_VERSION=monai-lung-nodule-v1
export MONAI_BUNDLE_REPO_ID=MONAI/lung_nodule_ct_detection
export MONAI_BUNDLE_DIR=./models/lung_nodule_ct_detection
export MONAI_AUTO_DOWNLOAD=true
export MONAI_INFER_CONFIG_RELPATH=configs/inference.json
export MONAI_META_FILE_RELPATH=configs/metadata.json
export MONAI_DEVICE=auto
export FALLBACK_TO_MOCK_ON_ERROR=true
python -m uvicorn app.main:app --host 127.0.0.1 --port 8100
```

### 终端 B：Backend

```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 终端 C：Frontend

```bash
cd frontend
npm run dev
```

## 5.3 访问地址

- Backend OpenAPI: http://127.0.0.1:8000/docs
- AI Engine OpenAPI: http://127.0.0.1:8100/docs
- Frontend: http://127.0.0.1:5173

## 6. 默认登录账号

首次启动 Backend 会自动初始化：

- 管理员：`admin / admin123456`
- 医生：`doctor_demo / doctor123456`
- 患者：`patient_demo / patient123456`

## 7. 外接 AI 对话接口（已预留并打通）

患者端聊天调用后端：`POST /api/v1/chat/assistant`

默认：

- `ASSISTANT_PROVIDER=mock`

切到外部 API（OpenAI 兼容格式）时，仅需配置环境变量并重启 backend：

```bash
export ASSISTANT_PROVIDER=external
export ASSISTANT_API_BASE_URL=https://api.openai.com/v1
export ASSISTANT_API_KEY=your_api_key
export ASSISTANT_MODEL=gpt-4o-mini
```

可选回退开关：

- `ASSISTANT_FALLBACK_TO_MOCK_ON_ERROR=true`（默认）

## 8. 常用 API 一览

- `POST /api/v1/auth/login`
- `POST /api/v1/upload_ct`
- `GET /api/v1/studies/{study_id}/preview`
- `GET /api/v1/studies/{study_id}/preview_overlay`
- `POST /api/v1/ai/predict/{study_id}`
- `GET /api/v1/ai/jobs/{job_id}`
- `GET /api/v1/doctor/patients`
- `GET /api/v1/doctor/reports`
- `GET /api/v1/doctor/followups`
- `GET /api/v1/doctor/patients/{patient_id}/messages`
- `POST /api/v1/doctor/patients/{patient_id}/messages`
- `POST /api/v1/doctor/studies/{study_id}/publish_report`
- `GET /api/v1/patient/reports?patient_id={patient_id}`
- `GET /api/v1/patient/messages?patient_id={patient_id}`
- `GET /api/v1/patient/report/{report_id}`
- `POST /api/v1/chat/assistant`

## 9. 一次性冒烟验证（手动）

1. 医生账号登录前端。
2. 进入医生工作台，输入后端可访问的 CT 绝对路径。
3. 触发 AI 推理，等待 `SUCCEEDED`。
4. 签发报告，保留在医生工作台，并记录返回的 `report_id`。
5. 医生可向该患者发送消息，患者端 `Messages` 页面可见。
6. 患者页可读取报告并通过聊天框请求 `/api/v1/chat/assistant`。

## 10. 已知限制

- 当前 `upload_ct` 是“路径入参”模式，不是二进制文件上传。
- MONAI 输入需为可读影像文件（nii/nii.gz/mhd/mha/dcm）。
- 患者对话当前默认是 `mock` provider，外接 API 需自行填密钥。

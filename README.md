# DeepLung

肺结节辅助检出与医患协同随访系统（课程原型，非临床系统）。

## 快速开始（本地）

### 1) 首次安装

```bash
conda create -n deeplung -y python=3.11
conda activate deeplung

# CPU 示例（如有 GPU 请按你的环境安装 torch/torchvision）
python -m pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cpu

python -m pip install -r backend/requirements.txt -r ai-engine/requirements.txt -r ai-engine/requirements-monai.txt

cd frontend && npm install
```

### 2) 配置后端 `.env`

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`（至少改这一项）：

```env
AI_ENGINE_BASE_URL=http://127.0.0.1:8100
```

如需接入 DeepSeek（可选）：

```env
ASSISTANT_PROVIDER=external
ASSISTANT_API_BASE_URL=https://api.deepseek.com/v1
ASSISTANT_API_KEY=sk-xxxx
ASSISTANT_MODEL=deepseek-chat
ASSISTANT_FALLBACK_TO_MOCK_ON_ERROR=true
```

### 3) 启动服务（3 个终端）

终端 A（AI Engine）

```bash
conda activate deeplung
cd ai-engine
export DETECTOR_PROVIDER=monai_bundle
export MONAI_AUTO_DOWNLOAD=true
export MONAI_DEVICE=cpu
python -m uvicorn app.main:app --host 0.0.0.0 --port 8100
```

终端 B（Backend）

```bash
conda activate deeplung
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

终端 C（Frontend）

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

## 访问地址

- 前端: `http://127.0.0.1:5173`
- 后端文档: `http://127.0.0.1:8000/docs`
- 后端健康检查: `http://127.0.0.1:8000/api/v1/health`
- AI Engine 健康检查: `http://127.0.0.1:8100/health`

## 默认账号

- 医生: `doctor_demo / doctor123456`
- 患者: `patient_demo / patient123456`
- 管理员: `admin / admin123456`

## 5 分钟自测流程

1. 医生登录，进入工作台。
2. 输入后端可访问的 CT 绝对路径，点击“上传并触发 AI 推理”。
3. 等任务 `SUCCEEDED` 后签发报告。
4. 切换患者账号，查看报告与消息。

## 常见问题

- `404 /health`：后端健康检查是 `/api/v1/health`。
- `fail to fetch`：先确认 `8000/8100/5173` 都在运行；`backend/.env` 的 `AI_ENGINE_BASE_URL` 本地模式要用 `http://127.0.0.1:8100`。

## 安全说明

- `backend/.env` 已被 `.gitignore` 忽略，不会自动提交。
- 可用以下命令确认：

```bash
git check-ignore -v backend/.env
```

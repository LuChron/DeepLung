# Backend

FastAPI 业务服务骨架，包含：
- 认证登录
- CT 上传接口
- 医生端风险排序接口
- AI 推理任务触发/查询
- 患者报告查询
- 患者 AI 对话接口（可切换 mock / external）

## 默认登录账号（首次启动自动初始化）

- 管理员: `admin` / `admin123456`
- 医生: `doctor_demo` / `doctor123456`
- 患者: `patient_demo` / `patient123456`

## 启动

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## AI 对话接口

- 路由：`POST /api/v1/chat/assistant`
- 默认 provider：`mock`（不依赖外部 API）
- 可切换外部 provider（OpenAI 兼容接口）：
  - `ASSISTANT_PROVIDER=external`
  - `ASSISTANT_API_BASE_URL=https://api.openai.com/v1`
  - `ASSISTANT_API_KEY=<your_api_key>`
  - `ASSISTANT_MODEL=gpt-4o-mini`

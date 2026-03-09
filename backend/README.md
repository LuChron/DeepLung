# Backend

FastAPI 业务服务骨架，包含：
- 认证登录
- CT 上传接口
- 医生端风险排序接口
- AI 推理任务触发/查询
- 患者报告查询

## 启动

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

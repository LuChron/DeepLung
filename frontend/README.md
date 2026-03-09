# Frontend

双端前端工程：
- `apps/doctor-web`：医生端工作台（风险看板 + AI 任务触发）
- `apps/patient-h5`：患者端 H5（报告解读）

## 安装

```bash
cd frontend
npm install
npm --prefix apps/doctor-web install
npm --prefix apps/patient-h5 install
```

## 启动

```bash
# 同时启动两个前端
npm run dev
```

访问地址：
- 医生端：`http://127.0.0.1:5173`
- 患者端：`http://127.0.0.1:5174`

## 前置服务

请先启动后端：
- Backend：`http://127.0.0.1:8000`
- AI Engine：`http://127.0.0.1:8100`

前端开发服务器已配置 `/api` 代理到 Backend。

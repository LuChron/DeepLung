# DeepLung

基于胸部 CT 的肺结节辅助检出、风险分层与医患双端协同随访系统。

当前版本已经统一到以下产品定位：

- AI 负责疑似肺结节检出与定位
- 系统负责辅助风险分层与任务排序
- 医生负责复核、报告签发和临床解释
- 患者端负责结果查看与随访提醒

本仓库用于课程项目、工程原型和流程验证，不作为临床诊断系统。

## 1. 当前版本做什么

当前版本不是“肺癌自动诊断系统”，而是一个可落地的辅助系统：

1. 医生上传胸部 CT。
2. AI Engine 调用 MONAI 官方 3D 肺结节检测模型。
3. 系统返回疑似结节坐标、大小、体积和检出置信度。
4. 后端基于模型输出计算病例级辅助风险分层。
5. 医生端按风险排序展示病例，并支持阅片和报告确认。
6. 患者端以图文形式展示结果，并提供复查提醒。

这条路线兼顾了：

- 可实现性
- 工程完整性
- 医学严谨性
- 答辩展示效果

## 2. 为什么选择这条技术路线

项目最初考虑的旧天池方案存在公开权重缺失问题，不适合作为当前课程项目的核心依赖。当前版本改为使用 `MONAI/lung_nodule_ct_detection`，主要原因是：

- 有公开可下载权重
- 有公开训练配置和关键超参数
- 使用公开数据集 LUNA16 训练
- 模型任务与当前产品目标一致，都是肺结节检测
- 可以直接接入现有 Python 服务化工程

因此，本项目的正式技术路线是：

`CT 上传 -> 影像预处理 -> MONAI 3D 检测 -> 结构化结果 -> 风险分层 -> 医生复核 -> 患者查看与随访`

## 3. 目录结构

```text
DeepLung/
├─ ai-engine/                  # AI 推理服务
│  ├─ app/
│  │  ├─ main.py               # FastAPI AI 服务入口
│  │  ├─ config.py             # AI 服务配置
│  │  └─ pipeline/
│  │     └─ detector_adapter.py# mock / MONAI 检测适配层
│  ├─ models/
│  │  └─ lung_nodule_ct_detection/
│  │     ├─ configs/           # MONAI bundle 配置
│  │     └─ models/            # model.pt / model.ts
│  ├─ requirements.txt
│  ├─ requirements-monai.txt
│  └─ README.md
├─ backend/                    # 业务后端
│  ├─ app/
│  │  ├─ api/                  # API 路由
│  │  ├─ schemas/              # DTO / 响应模型
│  │  ├─ services/             # AI 调用与内存存储
│  │  └─ core/
│  └─ README.md
├─ frontend/                   # 前端工作区
│  ├─ apps/
│  │  ├─ doctor-web/           # 医生端
│  │  └─ patient-h5/           # 患者端
│  └─ packages/
├─ docs/                       # 设计、API、数据库文档
├─ infra/                      # Nginx 等部署配置
├─ scripts/                    # 下载模型和冒烟测试脚本
└─ docker-compose.yml
```

## 4. 核心模块说明

## 4.1 AI Engine

职责：

- 接收 CT 路径
- 调用 MONAI bundle 推理
- 输出疑似结节列表
- 统一结果字段语义
- 生成辅助风险分层所需基础数据

当前支持两种 provider：

- `mock`
  - 用于联调和前后端开发
  - 不依赖真实模型
- `monai_bundle`
  - 使用 MONAI 官方肺结节检测 bundle
  - 用于真实推理

关键文件：

- [ai-engine/app/main.py](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/ai-engine/app/main.py)
- [ai-engine/app/pipeline/detector_adapter.py](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/ai-engine/app/pipeline/detector_adapter.py)

## 4.2 Backend

职责：

- 用户与角色管理
- 检查单创建
- AI 推理任务触发
- 任务状态查询
- 风险排序结果提供
- 患者报告与随访数据管理

当前后端使用内存假数据完成演示闭环，后续可切换到真实数据库。

关键文件：

- [backend/app/api/v1/endpoints/ai.py](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/backend/app/api/v1/endpoints/ai.py)
- [backend/app/services/ai_client.py](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/backend/app/services/ai_client.py)
- [backend/app/services/mock_store.py](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/backend/app/services/mock_store.py)

## 4.3 Frontend

医生端当前关注：

- 风险排序列表
- 上传检查
- 触发 AI 推理
- 查询任务状态

患者端当前关注：

- 风险灯展示
- 报告摘要
- 结节明细
- 复查提醒

关键文件：

- [frontend/apps/doctor-web/src/App.tsx](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/frontend/apps/doctor-web/src/App.tsx)
- [frontend/apps/patient-h5/src/App.tsx](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/frontend/apps/patient-h5/src/App.tsx)

## 5. 数据语义约定

这一点非常重要。当前系统统一采用以下语义：

- `detection_score`
  - 模型对该疑似结节的检出置信度
  - 不是恶性概率

- `risk_score`
  - 系统级辅助风险分值
  - 由结节大小、数量、检测分数等规则综合生成

- `risk_level`
  - 系统级辅助风险等级
  - 只用于病例排序、提醒强度和工作优先级

不再使用下列表述：

- `malignancy_prob`
- 良恶性自动判断
- AI 直接诊断肺癌

## 6. 本地运行方式

## 6.1 环境建议

推荐使用 `conda` 单独创建环境：

```powershell
conda create -n deeplung -y python=3.11
conda activate deeplung
python -m pip install -r backend/requirements.txt -r ai-engine/requirements.txt
python -m pip install -r ai-engine/requirements-monai.txt
```

如果你已经在 `deeplung` 环境里安装了 CUDA 版 `torch`，当前仓库不会再强制覆盖它。

也可以直接用脚本安装：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup_deeplung_env.ps1 -InstallMonai -InstallFrontend
```

安装前建议先运行环境自检：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check_env.ps1
```

前端安装：

```powershell
cd frontend
npm install
npm --prefix apps/doctor-web install
npm --prefix apps/patient-h5 install
```

## 6.2 启动顺序

需要三个终端。

### 终端 A：Backend

```powershell
cd D:\Courses\大二春夏学期\AIForMedicine\DeepLung\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 终端 B：AI Engine

先用 `mock` 跑通：

```powershell
cd D:\Courses\大二春夏学期\AIForMedicine\DeepLung\ai-engine
python -m uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

切换到真实 MONAI 推理：

```powershell
cd D:\Courses\大二春夏学期\AIForMedicine\DeepLung\ai-engine
$env:DETECTOR_PROVIDER='monai_bundle'
$env:MODEL_VERSION='monai-lung-nodule-v1'
$env:MONAI_BUNDLE_REPO_ID='MONAI/lung_nodule_ct_detection'
$env:MONAI_BUNDLE_DIR='.\models\lung_nodule_ct_detection'
$env:MONAI_AUTO_DOWNLOAD='false'
$env:MONAI_INFER_CONFIG_RELPATH='configs/inference.json'
$env:MONAI_META_FILE_RELPATH='configs/metadata.json'
$env:MONAI_DEVICE='auto'
$env:FALLBACK_TO_MOCK_ON_ERROR='true'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

如果你已经确认 `torch.cuda.is_available()` 为 `True`，也可以显式指定：

```powershell
$env:MONAI_DEVICE='cuda'
```

### 终端 C：Frontend

```powershell
cd D:\Courses\大二春夏学期\AIForMedicine\DeepLung\frontend
npm run dev
```

## 6.3 访问地址

- Backend OpenAPI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- AI Engine OpenAPI: [http://127.0.0.1:8100/docs](http://127.0.0.1:8100/docs)
- 医生端: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- 患者端: [http://127.0.0.1:5174](http://127.0.0.1:5174)

## 7. 冒烟测试

项目提供了两个脚本：

- `scripts/run_ai_monai_smoke.ps1`
  - 验证 AI Engine 和 MONAI 推理链路

- `scripts/run_smoke.ps1`
  - 验证 Backend + AI Engine 的全链路

示例：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_ai_monai_smoke.ps1 -PythonExe D:/Users/34544/miniconda3/envs/deeplung/python.exe
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_smoke.ps1 -PythonExe D:/Users/34544/miniconda3/envs/deeplung/python.exe
```

显式指定 GPU：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_ai_monai_smoke.ps1 -MonaiDevice cuda
powershell -ExecutionPolicy Bypass -File scripts/run_smoke.ps1 -DetectorProvider monai_bundle -MonaiDevice cuda
```

## 8. 当前已实现与待实现

## 8.1 已实现

- 前后端双端工程骨架
- AI 服务适配层
- mock / MONAI 两种推理模式
- 医生端风险列表和任务轮询
- 患者端报告展示
- 冒烟测试脚本

## 8.2 下一步优先实现

1. 将内存存储切换为真实数据库。
2. 完善上传后的对象存储链路。
3. 将患者报告与 AI 返回字段完全对齐。
4. 在医生端加入切片级病灶定位。
5. 基于随访规则生成更稳定的复查提醒。

## 8.3 后续增强

- 使用 GPU 推理优化时延
- 支持真实 DICOM 序列读取
- 引入多期 CT 对比
- 接入 nnDetection 或自训练模型做更强实验
- 加入医生反馈闭环

## 9. 建议的落地顺序

为了保证课程项目按时完成，建议按以下顺序落地：

### 第一阶段：跑通闭环

- 使用 `mock` 跑通上传、推理、查询、展示
- 保证医生端和患者端页面联通

### 第二阶段：接入真实模型

- 启用 `monai_bundle`
- 用公开 CT 数据做基础演示
- 确认 AI 输出结构稳定

### 第三阶段：补全医学工作流

- 完善辅助风险排序规则
- 完善结构化报告模板
- 完善随访提醒逻辑

### 第四阶段：优化答辩展示

- 准备一套固定演示病例
- 准备系统架构图和业务流程图
- 准备“医学边界说明”页面，避免答辩时被误解为自动诊断系统

## 10. 相关文档

- [docs/API接口设计.md](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/docs/API接口设计.md)
- [docs/数据库设计.sql](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/docs/数据库设计.sql)
- [docs/完整项目设计方案.md](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/docs/完整项目设计方案.md)
- [docs/部署文档.md](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/docs/部署文档.md)
- [ai-engine/README.md](/D:/Courses/大二春夏学期/AIForMedicine/DeepLung/ai-engine/README.md)

## 11. 常见问题

### 1) 为什么不用“恶性概率”

因为当前模型是肺结节检测模型，不是病理恶性诊断模型。将检测分数写成恶性概率不符合医学严谨性。

### 2) 为什么先做辅助系统

因为这条路线有公开模型、公开权重和明确能力边界，更适合课程项目按期落地。

### 3) 为什么保留 `mock`

因为前后端联调、UI 开发和接口演示不应依赖真实 GPU 或完整模型环境。

## 12. 声明

本仓库用于课程学习、系统设计与工程验证，不构成医疗诊断建议，也不能替代临床医生判断。

# API 接口设计

Base Path：`/api/v1`

统一响应格式：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

## 1. 认证接口

### POST `/auth/login`

说明：用户登录，返回访问令牌和角色信息。

请求：

```json
{
  "username": "doctor_demo",
  "password": "doctor123456"
}
```

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "access_token": "jwt-token",
    "token_type": "bearer",
    "role": "doctor"
  }
}
```

## 2. CT 检查与预览接口

### POST `/upload_ct`

说明：创建检查记录。课程原型中 `file_name` 可以直接传本地 CT 绝对路径。

请求：

```json
{
  "patient_id": "P10001",
  "file_name": "/data/LIDC-001.mhd",
  "file_size": 12034888
}
```

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "study_id": "S9A12BC34D56",
    "object_key": "/data/LIDC-001.mhd",
    "status": "UPLOADING"
  }
}
```

### GET `/studies/{study_id}/preview`

说明：返回指定检查的 PNG 预览图。

查询参数：

- `job_id`：可选，若提供则叠加当前任务结果对应的结节标记

### GET `/studies/{study_id}/preview_overlay`

说明：返回预览图叠加点位信息。

响应字段：

- `study_id`
- `job_id`
- `points[].index`
- `points[].left_ratio`
- `points[].top_ratio`
- `points[].size_px`
- `points[].score`
- `points[].diameter_mm`

## 3. AI 推理接口

### POST `/ai/predict/{study_id}`

说明：触发异步推理任务。

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "J123456ABCDEF",
    "status": "PENDING"
  }
}
```

### GET `/ai/jobs/{job_id}`

说明：查询推理任务状态与结果。

状态枚举：

- `PENDING`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`

当任务成功时，返回字段包括：

- `job_id`
- `study_id`
- `status`
- `model_version`
- `risk_score`
- `risk_level`
- `summary`
- `inference_mode_used`
- `note`
- `nodules`
- `updated_at`

示例响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "J123456ABCDEF",
    "study_id": "S9A12BC34D56",
    "status": "SUCCEEDED",
    "model_version": "monai-lung-nodule-v1",
    "risk_score": 0.81,
    "risk_level": "HIGH",
    "summary": "检测到 1 个疑似结节，已完成辅助风险分层，当前优先级为 HIGH",
    "inference_mode_used": "monai_bundle",
    "note": null,
    "nodules": [
      {
        "index": 0,
        "coord_x": 56.2,
        "coord_y": 41.8,
        "coord_z": 72.1,
        "diameter_mm": 12.4,
        "volume_mm3": 999.5,
        "detection_score": 0.87,
        "location": "肺部"
      }
    ],
    "updated_at": "2026-03-17T10:00:00"
  }
}
```

## 4. 医生端接口

### GET `/doctor/patients?sort=risk_level`

说明：按风险倒序返回患者分诊列表。

响应字段：

- `patient_id`
- `name_masked`
- `latest_risk_score`
- `latest_risk_level`
- `largest_nodule_mm`
- `report_status`

### GET `/doctor/reports`

说明：获取医生端已发布报告列表。

查询参数：

- `patient_id`：可选，按患者过滤

### GET `/doctor/followups?days=365`

说明：获取指定天数内需要随访的报告。

### GET `/doctor/patients/{patient_id}/messages?limit=100`

说明：获取医生与指定患者相关的消息记录。

### POST `/doctor/patients/{patient_id}/messages`

说明：医生向患者发送消息。

请求：

```json
{
  "doctor_username": "doctor_demo",
  "content": "请在三个月内复查 CT，如有不适及时就诊。"
}
```

### POST `/doctor/studies/{study_id}/publish_report`

说明：医生根据 AI 结果签发正式报告。

请求：

```json
{
  "impression": "右肺可见疑似结节，建议结合临床进一步随访。",
  "recommendation": "建议 3 个月内复查胸部 CT。",
  "risk_level": "HIGH"
}
```

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "study_id": "S9A12BC34D56",
    "report_id": "RABCDE123456",
    "status": "PUBLISHED",
    "risk_level": "HIGH"
  }
}
```

## 5. 患者端接口

### GET `/patient/reports?patient_id={patient_id}`

说明：获取患者的报告列表。

### GET `/patient/report/{report_id}`

说明：获取患者可读的单份报告详情。

示例响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "report_id": "RABCDE123456",
    "study_id": "S9A12BC34D56",
    "risk_light": "RED",
    "summary": "发现 1 个疑似肺结节，系统建议优先复核并结合医生意见尽快安排复查。",
    "recommendation": "建议在 3 个月内复查胸部 CT，并由影像科或呼吸科医生结合病史进一步评估。",
    "nodules": [
      {
        "location": "肺部",
        "diameter_mm": 12.4,
        "detection_score": 0.87
      }
    ],
    "followup_due_at": "2026-06-17"
  }
}
```

### GET `/patient/messages?patient_id={patient_id}&limit=100`

说明：获取患者端可见的医生消息。

## 6. 患者问答接口

### POST `/chat/assistant`

说明：围绕当前报告发起患者问答，系统可使用 mock 回复或外部大模型接口。

请求：

```json
{
  "patient_id": "patient_demo",
  "report_id": "RABCDE123456",
  "message": "这个报告严重吗？",
  "history": [
    {
      "role": "user",
      "text": "我需要注意什么？"
    },
    {
      "role": "assistant",
      "text": "请按医嘱定期复查，并留意症状变化。"
    }
  ]
}
```

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "reply": "[patient_demo] 从当前报告摘要看：发现 1 个疑似肺结节，请按计划复查，并留意症状变化。",
    "provider_used": "mock",
    "model": "local-rule-v1",
    "note": null
  }
}
```

## 7. AI Engine 内部接口

以下接口供后端调用 AI Engine：

### POST `/v1/predict`

请求：

```json
{
  "study_id": "S9A12BC34D56",
  "object_key": "/data/LIDC-001.mhd",
  "ct_path": "/data/LIDC-001.mhd"
}
```

响应字段：

- `model_version`
- `risk_score`
- `risk_level`
- `risk_light`
- `nodules`
- `summary`
- `inference_mode_used`
- `note`

### GET `/health`

说明：返回 AI Engine 当前运行状态、设备信息和模型状态。

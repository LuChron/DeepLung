# API 接口设计

Base Path：`/api/v1`

统一响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

## 1. 认证

### POST `/auth/login`

请求：

```json
{
  "username": "doctor001",
  "password": "***"
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

## 2. CT 上传

### POST `/upload_ct`

说明：创建检查单并返回上传元信息（可扩展预签名 URL）。

请求：

```json
{
  "patient_id": "P10001",
  "file_name": "LIDC-001.mhd",
  "file_size": 12034888
}
```

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "study_id": "S202603090001",
    "object_key": "ct/P10001/S202603090001/LIDC-001.mhd",
    "status": "UPLOADING"
  }
}
```

## 3. 医生端

### GET `/doctor/patients?sort=risk_level&page=1&page_size=20`

说明：按风险倒序返回患者列表。

响应字段：
- `patient_id`
- `name_masked`
- `latest_risk_score`
- `latest_risk_level`
- `largest_nodule_mm`
- `report_status`

### POST `/doctor/studies/{study_id}/publish_report`

说明：发布医生审核后的结构化报告。

请求：

```json
{
  "impression": "右肺上叶可见高风险结节，建议进一步检查",
  "recommendation": "3个月内复查",
  "risk_level": "HIGH"
}
```

## 4. AI 推理

### POST `/ai/predict/{study_id}`

说明：触发异步推理任务。

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "J202603090001",
    "status": "PENDING"
  }
}
```

AI 引擎内部请求体（Backend -> AI Engine）：`ct_path` 为可选本地文件路径，真实模型模式下建议提供。

```json
{
  "study_id": "S001",
  "object_key": "ct/P001/S001/scan.mhd",
  "ct_path": "D:/data/scan.mhd"
}
```

### GET `/ai/jobs/{job_id}`

说明：查询任务状态与结果摘要。

状态：`PENDING | RUNNING | SUCCEEDED | FAILED`

当任务成功时，建议返回以下字段：

- `risk_score`
- `risk_level`
- `summary`
- `inference_mode_used`
- `note`
- `nodules`

## 5. 患者端

### GET `/patient/report/{report_id}`

说明：获取患者可读图文报告。

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "report_id": "R202603090001",
    "risk_light": "RED",
    "summary": "发现 1 个疑似肺结节，系统建议优先复核并结合医生意见尽快安排复查",
    "recommendation": "建议在 3 个月内复查胸部 CT，并由影像科或呼吸科医生结合病史进一步评估。",
    "nodules": [
      {
        "location": "右肺上叶",
        "diameter_mm": 18.3,
        "detection_score": 0.84
      }
    ],
    "followup_due_at": "2026-06-09"
  }
}
```

说明：

- `detection_score` 表示模型对该疑似结节的检出置信度。
- `risk_score` 和 `risk_level` 表示系统级辅助风险分层，用于分诊排序和随访提醒。
- 当前版本不提供病理学意义上的“恶性概率”字段。

## 6. 随访

### POST `/followups/plans`

创建随访计划（3/6/12 月）。

### GET `/patient/followups`

查询当前患者的随访计划与提醒状态。

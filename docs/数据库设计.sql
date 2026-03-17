-- DeepLung 课程原型数据库设计
-- 当前项目实际实现基于 SQLAlchemy，可运行于 SQLite。
-- 下列 DDL 用于表达当前核心数据结构，字段命名与仓库实现保持一致。

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(16) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS studies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    study_id VARCHAR(32) NOT NULL UNIQUE,
    patient_id VARCHAR(64) NOT NULL,
    object_key VARCHAR(1024) NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_studies_study_id ON studies(study_id);
CREATE INDEX IF NOT EXISTS idx_studies_patient_id ON studies(patient_id);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id VARCHAR(32) NOT NULL UNIQUE,
    study_id VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    risk_score FLOAT NULL,
    risk_level VARCHAR(16) NULL,
    summary TEXT NULL,
    inference_mode_used VARCHAR(64) NULL,
    note TEXT NULL,
    nodules JSON NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_study_id ON jobs(study_id);

CREATE TABLE IF NOT EXISTS patient_triage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id VARCHAR(64) NOT NULL UNIQUE,
    name_masked VARCHAR(64) NOT NULL,
    latest_risk_score FLOAT NOT NULL DEFAULT 0.0,
    latest_risk_level VARCHAR(16) NOT NULL DEFAULT 'LOW',
    largest_nodule_mm FLOAT NOT NULL DEFAULT 0.0,
    report_status VARCHAR(16) NOT NULL DEFAULT 'NONE',
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_triage_patient_id ON patient_triage(patient_id);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id VARCHAR(32) NOT NULL UNIQUE,
    patient_id VARCHAR(64) NOT NULL,
    study_id VARCHAR(32) NULL,
    risk_light VARCHAR(16) NOT NULL,
    summary TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    nodules JSON NOT NULL,
    followup_due_at DATE NULL,
    created_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_report_id ON reports(report_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient_id ON reports(patient_id);

CREATE TABLE IF NOT EXISTS doctor_patient_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id VARCHAR(64) NOT NULL,
    doctor_username VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_patient_id ON doctor_patient_messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_messages_doctor_username ON doctor_patient_messages(doctor_username);

-- 说明：
-- 1. 当前课程原型未拆分独立 nodule 表，结节结果直接保存在 jobs.nodules 和 reports.nodules JSON 字段中。
-- 2. 当前课程原型未接入真实对象存储，studies.object_key 可保存本地 CT 文件路径。
-- 3. 当前课程原型未引入独立 followup_plan 表，随访时间直接存储在 reports.followup_due_at 字段中。

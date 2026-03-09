-- PostgreSQL 15+
-- DeepLung 核心业务表设计

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(16) NOT NULL CHECK (role IN ('doctor', 'patient', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    doctor_no VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL,
    department VARCHAR(64),
    title VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id),
    patient_no VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL,
    gender VARCHAR(8) CHECK (gender IN ('male', 'female', 'unknown')),
    birth_date DATE,
    phone VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_doctor_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patient_profiles(id),
    doctor_id UUID NOT NULL REFERENCES doctor_profiles(id),
    bind_type VARCHAR(16) NOT NULL DEFAULT 'primary',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(patient_id, doctor_id)
);

CREATE TABLE IF NOT EXISTS studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_no VARCHAR(64) NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id),
    uploaded_by UUID NOT NULL REFERENCES users(id),
    modality VARCHAR(16) NOT NULL DEFAULT 'CT',
    file_format VARCHAR(16) NOT NULL CHECK (file_format IN ('dicom', 'mhd', 'nrrd', 'nii')),
    object_key VARCHAR(255) NOT NULL,
    status VARCHAR(24) NOT NULL CHECK (
        status IN ('UPLOADING', 'READY', 'INFER_PENDING', 'INFER_RUNNING', 'INFER_DONE', 'INFER_FAILED')
    ),
    study_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studies_patient ON studies(patient_id);
CREATE INDEX IF NOT EXISTS idx_studies_status ON studies(status);

CREATE TABLE IF NOT EXISTS ai_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_no VARCHAR(64) NOT NULL UNIQUE,
    study_id UUID NOT NULL REFERENCES studies(id),
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
    model_version VARCHAR(64) NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_study ON ai_jobs(study_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);

CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id UUID NOT NULL REFERENCES studies(id),
    job_id UUID NOT NULL REFERENCES ai_jobs(id),
    risk_score NUMERIC(5,4) NOT NULL,
    risk_level VARCHAR(8) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    summary TEXT,
    raw_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(study_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_study ON ai_predictions(study_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_risk ON ai_predictions(risk_score DESC);

CREATE TABLE IF NOT EXISTS nodules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID NOT NULL REFERENCES ai_predictions(id),
    nodule_index INT NOT NULL,
    coord_x NUMERIC(10,4) NOT NULL,
    coord_y NUMERIC(10,4) NOT NULL,
    coord_z NUMERIC(10,4) NOT NULL,
    diameter_mm NUMERIC(10,4),
    volume_mm3 NUMERIC(14,4),
    malignancy_prob NUMERIC(5,4) NOT NULL,
    bbox_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(prediction_id, nodule_index)
);

CREATE INDEX IF NOT EXISTS idx_nodules_prediction ON nodules(prediction_id);

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_no VARCHAR(64) NOT NULL UNIQUE,
    study_id UUID NOT NULL REFERENCES studies(id),
    prediction_id UUID NOT NULL REFERENCES ai_predictions(id),
    doctor_id UUID NOT NULL REFERENCES doctor_profiles(id),
    status VARCHAR(16) NOT NULL CHECK (status IN ('DRAFT', 'REVIEWED', 'PUBLISHED')),
    risk_level VARCHAR(8) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    impression TEXT,
    recommendation TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_study ON reports(study_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

CREATE TABLE IF NOT EXISTS report_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id),
    version_no INT NOT NULL,
    content_json JSONB NOT NULL,
    edited_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(report_id, version_no)
);

CREATE TABLE IF NOT EXISTS followup_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patient_profiles(id),
    report_id UUID NOT NULL REFERENCES reports(id),
    risk_level VARCHAR(8) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    interval_months INT NOT NULL CHECK (interval_months IN (3, 6, 12)),
    next_due_at DATE NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'DONE', 'CANCELLED')),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_due ON followup_plans(next_due_at);

CREATE TABLE IF NOT EXISTS followup_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES followup_plans(id),
    channel VARCHAR(16) NOT NULL CHECK (channel IN ('in_app', 'sms', 'email')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'ACKED')),
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ,
    acked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    actor_role VARCHAR(16),
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id UUID,
    detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

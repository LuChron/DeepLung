from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    role: Literal['doctor', 'patient', 'admin']


class UploadCTRequest(BaseModel):
    patient_id: str
    file_name: str
    file_size: int = Field(ge=1)


class UploadCTResponse(BaseModel):
    study_id: str
    object_key: str
    status: Literal['UPLOADING', 'READY', 'INFER_PENDING']


class PatientTriageItem(BaseModel):
    patient_id: str
    name_masked: str
    latest_risk_score: float
    latest_risk_level: Literal['LOW', 'MEDIUM', 'HIGH']
    largest_nodule_mm: float
    report_status: Literal['DRAFT', 'PUBLISHED', 'NONE']


class TriggerPredictResponse(BaseModel):
    job_id: str
    status: Literal['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']


class JobStatusResponse(BaseModel):
    job_id: str
    study_id: str
    status: Literal['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']
    model_version: str
    risk_score: float | None = None
    risk_level: Literal['LOW', 'MEDIUM', 'HIGH'] | None = None
    summary: str | None = None
    inference_mode_used: str | None = None
    note: str | None = None
    nodules: list[dict] = Field(default_factory=list)
    updated_at: datetime


class NoduleItem(BaseModel):
    location: str
    diameter_mm: float
    detection_score: float


class PatientReportResponse(BaseModel):
    report_id: str
    risk_light: Literal['GREEN', 'YELLOW', 'RED']
    summary: str
    recommendation: str
    nodules: list[NoduleItem]
    followup_due_at: date | None = None


class PublishReportRequest(BaseModel):
    impression: str
    recommendation: str
    risk_level: Literal['LOW', 'MEDIUM', 'HIGH']

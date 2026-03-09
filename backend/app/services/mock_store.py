from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal
from uuid import uuid4


RiskLevel = Literal['LOW', 'MEDIUM', 'HIGH']
JobStatus = Literal['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']


@dataclass
class StudyRecord:
    study_id: str
    patient_id: str
    object_key: str
    status: str
    created_at: datetime


@dataclass
class JobRecord:
    job_id: str
    study_id: str
    status: JobStatus
    model_version: str
    risk_score: float | None
    risk_level: RiskLevel | None
    updated_at: datetime


class InMemoryStore:
    def __init__(self) -> None:
        self.studies: dict[str, StudyRecord] = {}
        self.jobs: dict[str, JobRecord] = {}
        self.reports: dict[str, dict] = {
            'R202603090001': {
                'report_id': 'R202603090001',
                'risk_light': 'RED',
                'summary': '发现 1 个高风险结节，建议尽快复查。',
                'nodules': [
                    {'location': '右肺上叶', 'diameter_mm': 18.3, 'malignancy_prob': 0.84},
                ],
                'followup_due_at': date.today() + timedelta(days=90),
            }
        }

    def create_study(self, patient_id: str, file_name: str) -> StudyRecord:
        study_id = f"S{uuid4().hex[:12].upper()}"
        file_path = Path(file_name)
        if file_path.is_absolute() and file_path.exists():
            object_key = str(file_path)
        else:
            object_key = f"ct/{patient_id}/{study_id}/{file_name}"
        record = StudyRecord(
            study_id=study_id,
            patient_id=patient_id,
            object_key=object_key,
            status='UPLOADING',
            created_at=datetime.now(),
        )
        self.studies[study_id] = record
        return record

    def list_triage(self) -> list[dict]:
        # 演示数据，真实环境应来自数据库 + 最新 AI 结果聚合
        return [
            {
                'patient_id': 'P10001',
                'name_masked': '张*',
                'latest_risk_score': 0.91,
                'latest_risk_level': 'HIGH',
                'largest_nodule_mm': 31.2,
                'report_status': 'DRAFT',
            },
            {
                'patient_id': 'P10008',
                'name_masked': '李*',
                'latest_risk_score': 0.63,
                'latest_risk_level': 'MEDIUM',
                'largest_nodule_mm': 14.8,
                'report_status': 'NONE',
            },
            {
                'patient_id': 'P10018',
                'name_masked': '王*',
                'latest_risk_score': 0.14,
                'latest_risk_level': 'LOW',
                'largest_nodule_mm': 6.1,
                'report_status': 'PUBLISHED',
            },
        ]

    def create_job(self, study_id: str) -> JobRecord:
        job_id = f"J{uuid4().hex[:12].upper()}"
        record = JobRecord(
            job_id=job_id,
            study_id=study_id,
            status='PENDING',
            model_version='baseline-mock-v1',
            risk_score=None,
            risk_level=None,
            updated_at=datetime.now(),
        )
        self.jobs[job_id] = record
        return record

    def mark_job_running(self, job_id: str) -> None:
        job = self.jobs[job_id]
        job.status = 'RUNNING'
        job.updated_at = datetime.now()

    def mark_job_succeeded(self, job_id: str, risk_score: float, risk_level: RiskLevel) -> None:
        job = self.jobs[job_id]
        job.status = 'SUCCEEDED'
        job.risk_score = risk_score
        job.risk_level = risk_level
        job.updated_at = datetime.now()

    def mark_job_failed(self, job_id: str) -> None:
        job = self.jobs[job_id]
        job.status = 'FAILED'
        job.updated_at = datetime.now()

    def get_job(self, job_id: str) -> JobRecord | None:
        return self.jobs.get(job_id)

    def get_report(self, report_id: str) -> dict | None:
        return self.reports.get(report_id)


store = InMemoryStore()


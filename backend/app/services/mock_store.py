from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal
from uuid import uuid4

from sqlalchemy import desc, select

from app.db.base import SessionLocal
from app.db.models import Job, PatientTriage, Report, Study


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
    summary: str | None
    inference_mode_used: str | None
    note: str | None
    nodules: list[dict]
    updated_at: datetime


class PersistentStore:
    def create_study(self, patient_id: str, file_name: str) -> StudyRecord:
        study_id = f"S{uuid4().hex[:12].upper()}"
        file_path = Path(file_name)
        if file_path.is_absolute() and file_path.exists():
            object_key = str(file_path)
        else:
            object_key = f"ct/{patient_id}/{study_id}/{file_name}"

        created_at = datetime.now()
        with SessionLocal.begin() as db:
            db.add(
                Study(
                    study_id=study_id,
                    patient_id=patient_id,
                    object_key=object_key,
                    status='UPLOADING',
                    created_at=created_at,
                )
            )
            self._get_or_create_triage(db, patient_id)

        return StudyRecord(
            study_id=study_id,
            patient_id=patient_id,
            object_key=object_key,
            status='UPLOADING',
            created_at=created_at,
        )

    def get_study(self, study_id: str) -> StudyRecord | None:
        with SessionLocal() as db:
            study = db.execute(select(Study).where(Study.study_id == study_id)).scalar_one_or_none()
            if study is None:
                return None
            return StudyRecord(
                study_id=study.study_id,
                patient_id=study.patient_id,
                object_key=study.object_key,
                status=study.status,
                created_at=study.created_at,
            )

    def list_triage(self) -> list[dict]:
        with SessionLocal() as db:
            rows = db.execute(select(PatientTriage).order_by(desc(PatientTriage.latest_risk_score))).scalars().all()
            return [
                {
                    'patient_id': x.patient_id,
                    'name_masked': x.name_masked,
                    'latest_risk_score': float(x.latest_risk_score),
                    'latest_risk_level': x.latest_risk_level,
                    'largest_nodule_mm': float(x.largest_nodule_mm),
                    'report_status': x.report_status,
                }
                for x in rows
            ]

    def create_job(self, study_id: str) -> JobRecord:
        job_id = f"J{uuid4().hex[:12].upper()}"
        updated_at = datetime.now()
        with SessionLocal.begin() as db:
            db.add(
                Job(
                    job_id=job_id,
                    study_id=study_id,
                    status='PENDING',
                    model_version='baseline-mock-v1',
                    risk_score=None,
                    risk_level=None,
                    summary=None,
                    inference_mode_used=None,
                    note=None,
                    nodules=[],
                    updated_at=updated_at,
                )
            )
            study = db.execute(select(Study).where(Study.study_id == study_id)).scalar_one_or_none()
            if study is not None:
                study.status = 'INFER_PENDING'

        return JobRecord(
            job_id=job_id,
            study_id=study_id,
            status='PENDING',
            model_version='baseline-mock-v1',
            risk_score=None,
            risk_level=None,
            summary=None,
            inference_mode_used=None,
            note=None,
            nodules=[],
            updated_at=updated_at,
        )

    def mark_job_running(self, job_id: str) -> None:
        with SessionLocal.begin() as db:
            job = db.execute(select(Job).where(Job.job_id == job_id)).scalar_one()
            job.status = 'RUNNING'
            job.updated_at = datetime.now()

    def mark_job_succeeded(self, job_id: str, result: dict) -> None:
        now = datetime.now()
        with SessionLocal.begin() as db:
            job = db.execute(select(Job).where(Job.job_id == job_id)).scalar_one()
            job.status = 'SUCCEEDED'
            job.model_version = str(result.get('model_version') or job.model_version)
            job.risk_score = float(result['risk_score'])
            job.risk_level = str(result['risk_level'])
            job.summary = result.get('summary')
            job.inference_mode_used = result.get('inference_mode_used')
            job.note = _safe_note(result.get('note'))
            job.nodules = list(result.get('nodules') or [])
            job.updated_at = now

            study = db.execute(select(Study).where(Study.study_id == job.study_id)).scalar_one_or_none()
            if study is not None:
                study.status = 'READY'
                triage = self._get_or_create_triage(db, study.patient_id)
                triage.latest_risk_score = float(job.risk_score or 0)
                triage.latest_risk_level = str(job.risk_level or 'LOW')
                triage.largest_nodule_mm = float(_max_diameter(job.nodules))
                triage.report_status = 'DRAFT'
                triage.updated_at = now

    def mark_job_failed(self, job_id: str) -> None:
        with SessionLocal.begin() as db:
            job = db.execute(select(Job).where(Job.job_id == job_id)).scalar_one()
            job.status = 'FAILED'
            job.updated_at = datetime.now()

    def get_job(self, job_id: str) -> JobRecord | None:
        with SessionLocal() as db:
            job = db.execute(select(Job).where(Job.job_id == job_id)).scalar_one_or_none()
            if job is None:
                return None
            return self._to_job_record(job)

    def get_report(self, report_id: str) -> dict | None:
        with SessionLocal() as db:
            report = db.execute(select(Report).where(Report.report_id == report_id)).scalar_one_or_none()
            if report is None:
                return None
            return {
                'report_id': report.report_id,
                'risk_light': report.risk_light,
                'summary': report.summary,
                'recommendation': report.recommendation,
                'nodules': list(report.nodules or []),
                'followup_due_at': report.followup_due_at,
            }

    def publish_report(self, study_id: str, impression: str, recommendation: str, risk_level: RiskLevel) -> dict:
        report_id = f"R{uuid4().hex[:12].upper()}"
        followup_due_at = date.today() + timedelta(days=90)

        with SessionLocal.begin() as db:
            study = db.execute(select(Study).where(Study.study_id == study_id)).scalar_one_or_none()
            if study is None:
                raise ValueError('study not found')

            latest_job = (
                db.execute(
                    select(Job)
                    .where(Job.study_id == study_id)
                    .order_by(desc(Job.updated_at))
                )
                .scalars()
                .first()
            )
            nodules = list(latest_job.nodules or []) if latest_job is not None else []

            db.add(
                Report(
                    report_id=report_id,
                    patient_id=study.patient_id,
                    study_id=study_id,
                    risk_light=_risk_light(risk_level),
                    summary=impression,
                    recommendation=recommendation,
                    nodules=nodules,
                    followup_due_at=followup_due_at,
                )
            )

            triage = self._get_or_create_triage(db, study.patient_id)
            triage.report_status = 'PUBLISHED'
            triage.updated_at = datetime.now()

        return {
            'study_id': study_id,
            'report_id': report_id,
            'status': 'PUBLISHED',
            'risk_level': risk_level,
        }

    def _get_or_create_triage(self, db, patient_id: str) -> PatientTriage:
        triage = db.execute(select(PatientTriage).where(PatientTriage.patient_id == patient_id)).scalar_one_or_none()
        if triage is not None:
            return triage

        triage = PatientTriage(
            patient_id=patient_id,
            name_masked=_mask_patient_id(patient_id),
            latest_risk_score=0.0,
            latest_risk_level='LOW',
            largest_nodule_mm=0.0,
            report_status='NONE',
            updated_at=datetime.now(),
        )
        db.add(triage)
        db.flush()
        return triage

    def _to_job_record(self, job: Job) -> JobRecord:
        return JobRecord(
            job_id=job.job_id,
            study_id=job.study_id,
            status=job.status,
            model_version=job.model_version,
            risk_score=job.risk_score,
            risk_level=job.risk_level,
            summary=job.summary,
            inference_mode_used=job.inference_mode_used,
            note=job.note,
            nodules=list(job.nodules or []),
            updated_at=job.updated_at,
        )


def _mask_patient_id(patient_id: str) -> str:
    if not patient_id:
        return '未*'
    if len(patient_id) == 1:
        return f'{patient_id}*'
    return f'{patient_id[0]}*'


def _max_diameter(nodules: list[dict]) -> float:
    if not nodules:
        return 0.0
    return max(float(n.get('diameter_mm') or 0.0) for n in nodules)


def _risk_light(risk_level: RiskLevel) -> str:
    if risk_level == 'HIGH':
        return 'RED'
    if risk_level == 'MEDIUM':
        return 'YELLOW'
    return 'GREEN'


def _safe_note(note: object) -> str | None:
    if note is None:
        return None
    text = str(note).strip()
    if not text:
        return None
    return text[:2000]


store = PersistentStore()

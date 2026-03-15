from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base, engine
from app.db.models import PatientTriage, Report, User


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        _seed_users(db)
        _seed_triage_and_reports(db)


def _seed_users(db: Session) -> None:
    settings = get_settings()
    default_users = [
        ('admin', settings.seed_admin_username, settings.seed_admin_password),
        ('doctor', settings.seed_doctor_username, settings.seed_doctor_password),
        ('patient', settings.seed_patient_username, settings.seed_patient_password),
    ]

    for role, username, password in default_users:
        stmt = select(User).where(User.username == username)
        user = db.execute(stmt).scalar_one_or_none()
        if user is not None:
            continue

        db.add(
            User(
                username=username,
                password_hash=hash_password(password),
                role=role,
                is_active=True,
            )
        )

    db.commit()


def _seed_triage_and_reports(db: Session) -> None:
    triage_seed = [
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
    for item in triage_seed:
        stmt = select(PatientTriage).where(PatientTriage.patient_id == item['patient_id'])
        row = db.execute(stmt).scalar_one_or_none()
        if row is not None:
            continue
        db.add(PatientTriage(**item))

    report_id = 'R202603090001'
    existing_report = db.execute(select(Report).where(Report.report_id == report_id)).scalar_one_or_none()
    if existing_report is None:
        db.add(
            Report(
                report_id=report_id,
                patient_id='P10001',
                study_id=None,
                risk_light='RED',
                summary='发现 1 个疑似肺结节，系统建议优先复核并结合医生意见尽快安排复查。',
                recommendation='建议在 3 个月内复查胸部 CT，并由影像科或呼吸科医生结合病史进一步评估。',
                nodules=[{'location': '右肺上叶', 'diameter_mm': 18.3, 'detection_score': 0.84}],
                followup_due_at=date.today() + timedelta(days=90),
            )
        )

    db.commit()

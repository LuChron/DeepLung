from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Study(Base):
    __tablename__ = 'studies'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    study_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    patient_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    object_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Job(Base):
    __tablename__ = 'jobs'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    study_id: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(16), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    inference_mode_used: Mapped[str | None] = mapped_column(String(64), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    nodules: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class PatientTriage(Base):
    __tablename__ = 'patient_triage'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    patient_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name_masked: Mapped[str] = mapped_column(String(64), nullable=False)
    latest_risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    latest_risk_level: Mapped[str] = mapped_column(String(16), default='LOW', nullable=False)
    largest_nodule_mm: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    report_status: Mapped[str] = mapped_column(String(16), default='NONE', nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Report(Base):
    __tablename__ = 'reports'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    patient_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    study_id: Mapped[str | None] = mapped_column(String(32), index=True, nullable=True)
    risk_light: Mapped[str] = mapped_column(String(16), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    nodules: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    followup_due_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

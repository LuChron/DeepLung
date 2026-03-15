from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from app.core.config import get_settings


pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str, role: str, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    expire_minutes = int(expires_minutes or settings.jwt_expire_minutes)
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload: dict[str, Any] = {
        'sub': subject,
        'role': role,
        'exp': expire_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm='HS256')

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.base import get_db
from app.db.models import User
from app.schemas.common import APIResponse
from app.schemas.dto import LoginRequest, LoginResponse


router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/login', response_model=APIResponse[LoginResponse])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> APIResponse[LoginResponse]:
    stmt = select(User).where(User.username == payload.username)
    user = db.execute(stmt).scalar_one_or_none()

    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail='invalid username or password')

    token = create_access_token(subject=user.username, role=user.role)
    return APIResponse(data=LoginResponse(access_token=token, role=user.role))

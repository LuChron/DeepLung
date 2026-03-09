from fastapi import APIRouter

from app.schemas.common import APIResponse
from app.schemas.dto import LoginRequest, LoginResponse


router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/login', response_model=APIResponse[LoginResponse])
def login(payload: LoginRequest) -> APIResponse[LoginResponse]:
    role = 'doctor'
    if payload.username.startswith('patient'):
        role = 'patient'
    elif payload.username.startswith('admin'):
        role = 'admin'

    token = f"demo-{payload.username}-token"
    return APIResponse(data=LoginResponse(access_token=token, role=role))

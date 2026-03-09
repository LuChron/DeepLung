from datetime import datetime

from fastapi import APIRouter

from app.schemas.common import APIResponse


router = APIRouter(tags=['health'])


@router.get('/health', response_model=APIResponse[dict])
def health() -> APIResponse[dict]:
    return APIResponse(data={'status': 'ok', 'time': datetime.now().isoformat()})

from datetime import datetime

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.common import APIResponse


router = APIRouter(tags=['health'])
settings = get_settings()


@router.get('/health', response_model=APIResponse[dict])
def health() -> APIResponse[dict]:
    return APIResponse(
        data={
            'status': 'ok',
            'time': datetime.now().isoformat(),
            'app_env': settings.app_env,
            'ai_engine_base_url': settings.ai_engine_base_url,
        }
    )

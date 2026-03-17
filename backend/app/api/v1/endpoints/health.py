from datetime import datetime
from typing import Any

from fastapi import APIRouter
import httpx

from app.core.config import get_settings
from app.schemas.common import APIResponse


router = APIRouter(tags=['health'])
settings = get_settings()


@router.get('/health', response_model=APIResponse[dict])
async def health() -> APIResponse[dict]:
    data: dict[str, Any] = {
        'status': 'ok',
        'time': datetime.now().isoformat(),
        'app_env': settings.app_env,
        'ai_engine_base_url': settings.ai_engine_base_url,
        'ai_engine_reachable': False,
        'ai_runtime': None,
        'ai_engine_error': None,
    }

    ai_url = f"{settings.ai_engine_base_url.rstrip('/')}/health"
    try:
        async with httpx.AsyncClient(timeout=5.0, trust_env=False) as client:
            resp = await client.get(ai_url)
            resp.raise_for_status()
            payload = resp.json()
            runtime = None
            if isinstance(payload, dict):
                runtime = payload.get('data', {}).get('runtime')
            if isinstance(runtime, dict):
                data['ai_runtime'] = runtime
            data['ai_engine_reachable'] = True
    except Exception as exc:  # pragma: no cover - health fallback path
        data['ai_engine_error'] = str(exc)[:200]

    return APIResponse(data=data)

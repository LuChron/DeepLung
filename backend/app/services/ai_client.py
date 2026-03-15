from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings


async def run_ai_predict(study_id: str, object_key: str) -> dict[str, Any]:
    settings = get_settings()
    url = f"{settings.ai_engine_base_url}/v1/predict"
    ct_path = object_key if Path(object_key).exists() else None
    payload = {'study_id': study_id, 'object_key': object_key, 'ct_path': ct_path}

    async with httpx.AsyncClient(timeout=float(settings.ai_engine_timeout_seconds), trust_env=False) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()

from datetime import datetime
from typing import Generic, TypeVar

from fastapi import FastAPI
from pydantic import BaseModel

from app.config import get_settings
from app.pipeline.detector_adapter import DetectorAdapter, PredictInput


T = TypeVar('T')


class APIResponse(BaseModel, Generic[T]):
    code: int = 0
    message: str = 'ok'
    data: T


class PredictRequest(BaseModel):
    study_id: str
    object_key: str
    ct_path: str | None = None


class PredictData(BaseModel):
    model_version: str
    risk_score: float
    risk_level: str
    risk_light: str
    nodules: list[dict]
    summary: str
    inference_mode_used: str
    note: str | None = None


settings = get_settings()
adapter = DetectorAdapter(
    detector_provider=settings.detector_provider,
    model_version=settings.model_version,
    fallback_to_mock_on_error=settings.fallback_to_mock_on_error,
    monai_bundle_repo_id=settings.monai_bundle_repo_id,
    monai_bundle_dir=settings.monai_bundle_dir,
    monai_auto_download=settings.monai_auto_download,
    monai_infer_config_relpath=settings.monai_infer_config_relpath,
    monai_meta_file_relpath=settings.monai_meta_file_relpath,
    monai_device=settings.monai_device,
)

app = FastAPI(
    title=settings.ai_app_name,
    version='0.4.0',
    docs_url='/docs',
    redoc_url='/redoc',
)


@app.get('/health', response_model=APIResponse[dict])
def health() -> APIResponse[dict]:
    return APIResponse(
        data={
            'status': 'ok',
            'time': datetime.now().isoformat(),
            'runtime': adapter.get_runtime_status(),
        }
    )


@app.post('/v1/predict', response_model=APIResponse[PredictData])
def predict(payload: PredictRequest) -> APIResponse[PredictData]:
    result = adapter.predict(
        PredictInput(
            study_id=payload.study_id,
            object_key=payload.object_key,
            ct_path=payload.ct_path,
        )
    )
    return APIResponse(data=PredictData(**result))

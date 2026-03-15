import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas.common import APIResponse
from app.schemas.dto import JobStatusResponse, TriggerPredictResponse
from app.services.ai_client import run_ai_predict
from app.services.mock_store import store


logger = logging.getLogger(__name__)
router = APIRouter(prefix='/ai', tags=['ai'])


async def run_predict_job(job_id: str, study_id: str, object_key: str) -> None:
    store.mark_job_running(job_id)
    try:
        result = await run_ai_predict(study_id=study_id, object_key=object_key)
        store.mark_job_succeeded(job_id, result=result['data'])
    except Exception as exc:  # pragma: no cover
        logger.exception('ai predict failed: %s', exc)
        store.mark_job_failed(job_id)


@router.post('/predict/{study_id}', response_model=APIResponse[TriggerPredictResponse])
def trigger_predict(study_id: str, background_tasks: BackgroundTasks) -> APIResponse[TriggerPredictResponse]:
    study = store.get_study(study_id)
    if not study:
        raise HTTPException(status_code=404, detail='study not found')

    job = store.create_job(study_id)
    background_tasks.add_task(run_predict_job, job.job_id, study_id, study.object_key)
    return APIResponse(data=TriggerPredictResponse(job_id=job.job_id, status=job.status))


@router.get('/jobs/{job_id}', response_model=APIResponse[JobStatusResponse])
def get_job(job_id: str) -> APIResponse[JobStatusResponse]:
    job = store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='job not found')

    return APIResponse(
        data=JobStatusResponse(
            job_id=job.job_id,
            study_id=job.study_id,
            status=job.status,
            model_version=job.model_version,
            risk_score=job.risk_score,
            risk_level=job.risk_level,
            summary=job.summary,
            inference_mode_used=job.inference_mode_used,
            note=job.note,
            nodules=job.nodules,
            updated_at=job.updated_at,
        )
    )

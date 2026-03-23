from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.schemas.common import APIResponse
from app.schemas.dto import StudyPreviewOverlayResponse, StudyPreviewPoint, UploadCTRequest, UploadCTResponse
from app.services.ct_preview import build_ct_preview
from app.services.mock_store import store


router = APIRouter(tags=['studies'])


@router.post('/upload_ct', response_model=APIResponse[UploadCTResponse])
def upload_ct(payload: UploadCTRequest) -> APIResponse[UploadCTResponse]:
    file_path = Path(payload.file_name).expanduser()
    if not file_path.is_absolute():
        raise HTTPException(status_code=400, detail='ct path must be an absolute local path')
    if not file_path.exists():
        raise HTTPException(status_code=400, detail=f'ct file not found: {file_path}')

    record = store.create_study(payload.patient_id, str(file_path))
    return APIResponse(
        data=UploadCTResponse(
            study_id=record.study_id,
            object_key=record.object_key,
            status='UPLOADING',
        )
    )


def _resolve_nodules_for_preview(study_id: str, job_id: str | None) -> tuple[str | None, list[dict]]:
    if not job_id:
        return None, []

    job = store.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail='job not found')
    if job.study_id != study_id:
        raise HTTPException(status_code=400, detail='job does not belong to study')
    return job_id, list(job.nodules or [])


@router.get('/studies/{study_id}/preview')
def preview_study(study_id: str, job_id: str | None = None) -> Response:
    study = store.get_study(study_id)
    if not study:
        raise HTTPException(status_code=404, detail='study not found')

    _, nodules = _resolve_nodules_for_preview(study_id, job_id)

    try:
        preview = build_ct_preview(ct_path=study.object_key, nodules=nodules)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(content=preview.png_bytes, media_type='image/png', headers={'Cache-Control': 'no-store'})


@router.get('/studies/{study_id}/preview_overlay', response_model=APIResponse[StudyPreviewOverlayResponse])
def preview_overlay(study_id: str, job_id: str | None = None) -> APIResponse[StudyPreviewOverlayResponse]:
    study = store.get_study(study_id)
    if not study:
        raise HTTPException(status_code=404, detail='study not found')

    resolved_job_id, nodules = _resolve_nodules_for_preview(study_id, job_id)

    try:
        preview = build_ct_preview(ct_path=study.object_key, nodules=nodules)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    points = [
        StudyPreviewPoint(
            index=p.index,
            left_ratio=p.left_ratio,
            top_ratio=p.top_ratio,
            size_px=p.size_px,
            score=p.score,
            diameter_mm=p.diameter_mm,
        )
        for p in preview.points
    ]
    return APIResponse(data=StudyPreviewOverlayResponse(study_id=study_id, job_id=resolved_job_id, points=points))

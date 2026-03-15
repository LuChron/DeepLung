from fastapi import APIRouter, HTTPException

from app.schemas.common import APIResponse
from app.schemas.dto import DoctorReportItem, FollowupItem, PatientTriageItem, PublishReportRequest
from app.services.mock_store import store


router = APIRouter(prefix='/doctor', tags=['doctor'])


@router.get('/patients', response_model=APIResponse[list[PatientTriageItem]])
def list_doctor_patients(sort: str = 'risk_level') -> APIResponse[list[PatientTriageItem]]:
    items = [PatientTriageItem(**x) for x in store.list_triage()]
    if sort == 'risk_level':
        items = sorted(items, key=lambda x: x.latest_risk_score, reverse=True)
    return APIResponse(data=items)


@router.get('/reports', response_model=APIResponse[list[DoctorReportItem]])
def list_reports(patient_id: str | None = None) -> APIResponse[list[DoctorReportItem]]:
    rows = [DoctorReportItem(**x) for x in store.list_reports(patient_id=patient_id)]
    return APIResponse(data=rows)


@router.get('/followups', response_model=APIResponse[list[FollowupItem]])
def list_followups(days: int = 365) -> APIResponse[list[FollowupItem]]:
    rows = [FollowupItem(**x) for x in store.list_followups(days=days)]
    return APIResponse(data=rows)


@router.post('/studies/{study_id}/publish_report', response_model=APIResponse[dict])
def publish_report(study_id: str, payload: PublishReportRequest) -> APIResponse[dict]:
    try:
        result = store.publish_report(
            study_id=study_id,
            impression=payload.impression,
            recommendation=payload.recommendation,
            risk_level=payload.risk_level,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return APIResponse(data=result)

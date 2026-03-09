from fastapi import APIRouter

from app.schemas.common import APIResponse
from app.schemas.dto import PatientTriageItem, PublishReportRequest
from app.services.mock_store import store


router = APIRouter(prefix='/doctor', tags=['doctor'])


@router.get('/patients', response_model=APIResponse[list[PatientTriageItem]])
def list_doctor_patients(sort: str = 'risk_level') -> APIResponse[list[PatientTriageItem]]:
    items = [PatientTriageItem(**x) for x in store.list_triage()]
    if sort == 'risk_level':
        items = sorted(items, key=lambda x: x.latest_risk_score, reverse=True)
    return APIResponse(data=items)


@router.post('/studies/{study_id}/publish_report', response_model=APIResponse[dict])
def publish_report(study_id: str, payload: PublishReportRequest) -> APIResponse[dict]:
    return APIResponse(
        data={
            'study_id': study_id,
            'status': 'PUBLISHED',
            'risk_level': payload.risk_level,
        }
    )

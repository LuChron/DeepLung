from fastapi import APIRouter, HTTPException

from app.schemas.common import APIResponse
from app.schemas.dto import PatientReportResponse
from app.services.mock_store import store


router = APIRouter(prefix='/patient', tags=['patient'])


@router.get('/report/{report_id}', response_model=APIResponse[PatientReportResponse])
def get_report(report_id: str) -> APIResponse[PatientReportResponse]:
    data = store.get_report(report_id)
    if not data:
        raise HTTPException(status_code=404, detail='report not found')
    return APIResponse(data=PatientReportResponse(**data))

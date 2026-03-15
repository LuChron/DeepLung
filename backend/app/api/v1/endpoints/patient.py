from fastapi import APIRouter, HTTPException

from app.schemas.common import APIResponse
from app.schemas.dto import DoctorPatientMessageItem, PatientReportListItem, PatientReportResponse
from app.services.mock_store import store


router = APIRouter(prefix='/patient', tags=['patient'])


@router.get('/reports', response_model=APIResponse[list[PatientReportListItem]])
def list_patient_reports(patient_id: str) -> APIResponse[list[PatientReportListItem]]:
    rows = [PatientReportListItem(**x) for x in store.list_reports(patient_id=patient_id)]
    return APIResponse(data=rows)


@router.get('/messages', response_model=APIResponse[list[DoctorPatientMessageItem]])
def list_messages(patient_id: str, limit: int = 100) -> APIResponse[list[DoctorPatientMessageItem]]:
    rows = [DoctorPatientMessageItem(**x) for x in store.list_doctor_messages(patient_id=patient_id, limit=limit)]
    return APIResponse(data=rows)


@router.get('/report/{report_id}', response_model=APIResponse[PatientReportResponse])
def get_report(report_id: str) -> APIResponse[PatientReportResponse]:
    data = store.get_report(report_id)
    if not data:
        raise HTTPException(status_code=404, detail='report not found')
    return APIResponse(data=PatientReportResponse(**data))

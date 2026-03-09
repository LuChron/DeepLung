from fastapi import APIRouter

from app.schemas.common import APIResponse
from app.schemas.dto import UploadCTRequest, UploadCTResponse
from app.services.mock_store import store


router = APIRouter(tags=['studies'])


@router.post('/upload_ct', response_model=APIResponse[UploadCTResponse])
def upload_ct(payload: UploadCTRequest) -> APIResponse[UploadCTResponse]:
    record = store.create_study(payload.patient_id, payload.file_name)
    return APIResponse(
        data=UploadCTResponse(
            study_id=record.study_id,
            object_key=record.object_key,
            status='UPLOADING',
        )
    )

from fastapi import APIRouter, HTTPException

from app.schemas.common import APIResponse
from app.schemas.dto import AssistantChatRequest, AssistantChatResponse
from app.services.assistant_client import ask_assistant
from app.services.mock_store import store


router = APIRouter(prefix='/chat', tags=['chat'])


@router.post('/assistant', response_model=APIResponse[AssistantChatResponse])
def chat_assistant(payload: AssistantChatRequest) -> APIResponse[AssistantChatResponse]:
    report_summary = None
    report_recommendation = None

    if payload.report_id:
        report = store.get_report(payload.report_id)
        if report:
            report_summary = str(report.get('summary') or '')
            report_recommendation = str(report.get('recommendation') or '')

    history = [{'role': item.role, 'text': item.text} for item in payload.history]

    try:
        result = ask_assistant(
            message=payload.message,
            history=history,
            patient_id=payload.patient_id,
            report_summary=report_summary,
            report_recommendation=report_recommendation,
        )
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f'assistant service unavailable: {exc}') from exc

    return APIResponse(data=AssistantChatResponse(**result))

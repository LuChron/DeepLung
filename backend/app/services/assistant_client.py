from __future__ import annotations

from typing import Literal

import httpx

from app.core.config import get_settings


Provider = Literal['mock', 'external']


def ask_assistant(
    *,
    message: str,
    history: list[dict],
    patient_id: str | None,
    report_summary: str | None,
    report_recommendation: str | None,
) -> dict:
    settings = get_settings()
    provider = settings.assistant_provider.strip().lower()

    if provider != 'external':
        return _mock_reply(message, patient_id, report_summary, report_recommendation)

    try:
        return _external_reply(
            message=message,
            history=history,
            patient_id=patient_id,
            report_summary=report_summary,
            report_recommendation=report_recommendation,
        )
    except Exception as exc:
        if not settings.assistant_fallback_to_mock_on_error:
            raise
        result = _mock_reply(message, patient_id, report_summary, report_recommendation)
        result['note'] = f'external api failed, fallback to mock: {exc}'
        return result


def _mock_reply(
    message: str,
    patient_id: str | None,
    report_summary: str | None,
    report_recommendation: str | None,
) -> dict:
    text = message.strip().lower()

    if any(k in text for k in ['手术', 'surgery', 'operation']):
        reply = '是否需要手术必须由医生结合影像与病史判断。当前建议先按医嘱完成复查。'
    elif any(k in text for k in ['危险', 'danger', 'serious', '严重']):
        if report_summary:
            reply = f'从当前报告摘要看：{report_summary}。请按计划复查，并留意症状变化。'
        else:
            reply = '请以医生签发报告为准，按计划复查。若出现不适请尽快就医。'
    elif any(k in text for k in ['生活', 'lifestyle', '饮食', '运动']):
        reply = '建议戒烟、规律作息、适度运动、均衡饮食，并按时复查影像。'
    elif any(k in text for k in ['报告', 'report']):
        if report_recommendation:
            reply = f'你的报告建议是：{report_recommendation}'
        elif report_summary:
            reply = f'你的报告摘要是：{report_summary}'
        else:
            reply = '当前没有加载到报告详情，请稍后重试。'
    else:
        reply = '这是很好的问题。建议记录后在复诊时请医生结合影像细节做进一步解释。'

    if patient_id:
        reply = f'[{patient_id}] {reply}'

    return {
        'reply': reply,
        'provider_used': 'mock',
        'model': 'local-rule-v1',
        'note': None,
    }


def _external_reply(
    *,
    message: str,
    history: list[dict],
    patient_id: str | None,
    report_summary: str | None,
    report_recommendation: str | None,
) -> dict:
    settings = get_settings()
    if not settings.assistant_api_key:
        raise RuntimeError('assistant_api_key is empty')

    context_lines = []
    if patient_id:
        context_lines.append(f'patient_id={patient_id}')
    if report_summary:
        context_lines.append(f'report_summary={report_summary}')
    if report_recommendation:
        context_lines.append(f'report_recommendation={report_recommendation}')

    messages: list[dict] = [{'role': 'system', 'content': settings.assistant_system_prompt}]
    if context_lines:
        messages.append({'role': 'system', 'content': '\n'.join(context_lines)})

    for item in history[-10:]:
        role = item.get('role')
        text = str(item.get('text') or '').strip()
        if role not in {'user', 'assistant'} or not text:
            continue
        messages.append({'role': role, 'content': text})

    messages.append({'role': 'user', 'content': message})

    url = f"{settings.assistant_api_base_url.rstrip('/')}/chat/completions"
    payload = {
        'model': settings.assistant_model,
        'messages': messages,
        'temperature': 0.2,
    }
    headers = {
        'Authorization': f'Bearer {settings.assistant_api_key}',
        'Content-Type': 'application/json',
    }

    with httpx.Client(timeout=float(settings.assistant_timeout_seconds), trust_env=False) as client:
        resp = client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    reply_text = _extract_reply_text(data)
    if not reply_text:
        raise RuntimeError('external api returned empty reply')

    return {
        'reply': reply_text,
        'provider_used': 'external',
        'model': settings.assistant_model,
        'note': None,
    }


def _extract_reply_text(payload: dict) -> str:
    choices = payload.get('choices') or []
    if not choices:
        return ''
    message = choices[0].get('message') or {}
    content = message.get('content')

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get('text')
                if text:
                    parts.append(str(text))
        return '\n'.join(parts).strip()

    return ''

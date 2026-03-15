import { getAccessToken, type UserRole } from './session';

const RAW_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL || 'http://127.0.0.1:8000';
export const BACKEND_BASE_URL = RAW_BASE_URL.replace(/\/$/, '');

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

export type LoginResponse = {
  access_token: string;
  token_type: 'bearer';
  role: UserRole;
};

export type PatientTriageItem = {
  patient_id: string;
  name_masked: string;
  latest_risk_score: number;
  latest_risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  largest_nodule_mm: number;
  report_status: 'DRAFT' | 'PUBLISHED' | 'NONE';
};

export type UploadCTResponse = {
  study_id: string;
  object_key: string;
  status: 'UPLOADING' | 'READY' | 'INFER_PENDING';
};

export type TriggerPredictResponse = {
  job_id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
};

export type PredictNodule = {
  index: number;
  coord_x: number;
  coord_y: number;
  coord_z: number;
  diameter_mm: number;
  volume_mm3: number;
  detection_score: number;
  location: string;
};

export type JobStatusResponse = {
  job_id: string;
  study_id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  model_version: string;
  risk_score: number | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  summary: string | null;
  inference_mode_used: string | null;
  note: string | null;
  nodules: PredictNodule[];
  updated_at: string;
};

export type PatientReportNodule = {
  location: string;
  diameter_mm: number;
  detection_score: number;
};

export type PatientReportResponse = {
  report_id: string;
  risk_light: 'GREEN' | 'YELLOW' | 'RED';
  summary: string;
  recommendation: string;
  nodules: PatientReportNodule[];
  followup_due_at: string | null;
};

export type PublishReportResponse = {
  study_id: string;
  report_id: string;
  status: 'PUBLISHED';
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type AssistantChatHistoryItem = {
  role: 'user' | 'assistant';
  text: string;
};

export type AssistantChatResponse = {
  reply: string;
  provider_used: 'mock' | 'external';
  model: string;
  note: string | null;
};

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const resp = await fetch(`${BACKEND_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await resp.text();
  let payload: ApiResponse<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as ApiResponse<T>;
    } catch {
      throw new Error(`接口返回非 JSON：${text.slice(0, 120)}`);
    }
  }

  if (!resp.ok) {
    const detail = payload?.message || text || `HTTP ${resp.status}`;
    throw new Error(detail);
  }

  if (!payload) {
    throw new Error('接口返回为空');
  }

  if (payload.code !== 0) {
    throw new Error(payload.message || '接口调用失败');
  }

  return payload.data;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return requestApi<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function listDoctorPatients(): Promise<PatientTriageItem[]> {
  return requestApi<PatientTriageItem[]>('/api/v1/doctor/patients?sort=risk_level');
}

export function uploadCT(patientId: string, fileName: string, fileSize: number): Promise<UploadCTResponse> {
  return requestApi<UploadCTResponse>('/api/v1/upload_ct', {
    method: 'POST',
    body: JSON.stringify({
      patient_id: patientId,
      file_name: fileName,
      file_size: Math.max(1, fileSize),
    }),
  });
}

export function triggerPredict(studyId: string): Promise<TriggerPredictResponse> {
  return requestApi<TriggerPredictResponse>(`/api/v1/ai/predict/${encodeURIComponent(studyId)}`, {
    method: 'POST',
  });
}

export function getPredictJob(jobId: string): Promise<JobStatusResponse> {
  return requestApi<JobStatusResponse>(`/api/v1/ai/jobs/${encodeURIComponent(jobId)}`);
}

export function publishReport(
  studyId: string,
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
  summary: string
): Promise<PublishReportResponse> {
  return requestApi<PublishReportResponse>(`/api/v1/doctor/studies/${encodeURIComponent(studyId)}/publish_report`, {
    method: 'POST',
    body: JSON.stringify({
      impression: summary,
      recommendation: summary,
      risk_level: riskLevel,
    }),
  });
}

export function getPatientReport(reportId: string): Promise<PatientReportResponse> {
  return requestApi<PatientReportResponse>(`/api/v1/patient/report/${encodeURIComponent(reportId)}`);
}

export function askAssistant(
  patientId: string,
  reportId: string | null,
  message: string,
  history: AssistantChatHistoryItem[]
): Promise<AssistantChatResponse> {
  return requestApi<AssistantChatResponse>('/api/v1/chat/assistant', {
    method: 'POST',
    body: JSON.stringify({
      patient_id: patientId,
      report_id: reportId,
      message,
      history,
    }),
  });
}

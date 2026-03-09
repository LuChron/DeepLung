export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

export type PatientItem = {
  patient_id: string;
  name_masked: string;
  latest_risk_score: number;
  latest_risk_level: RiskLevel;
  largest_nodule_mm: number;
  report_status: "DRAFT" | "PUBLISHED" | "NONE";
};

type UploadResponse = {
  study_id: string;
  object_key: string;
  status: string;
};

type TriggerResponse = {
  job_id: string;
  status: JobStatus;
};

export type JobResponse = {
  job_id: string;
  study_id: string;
  status: JobStatus;
  model_version: string;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  updated_at: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const body = (await response.json()) as ApiResponse<T>;
  if (body.code !== 0) {
    throw new Error(body.message || "request failed");
  }
  return body.data;
}

export function fetchPatients() {
  return request<PatientItem[]>("/api/v1/doctor/patients?sort=risk_level");
}

export function uploadStudy(payload: { patient_id: string; file_name: string; file_size: number }) {
  return request<UploadResponse>("/api/v1/upload_ct", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function triggerPredict(studyId: string) {
  return request<TriggerResponse>(`/api/v1/ai/predict/${studyId}`, {
    method: "POST"
  });
}

export function fetchJob(jobId: string) {
  return request<JobResponse>(`/api/v1/ai/jobs/${jobId}`);
}

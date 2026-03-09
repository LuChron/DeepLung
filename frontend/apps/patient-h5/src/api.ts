export type RiskLight = "GREEN" | "YELLOW" | "RED";

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

export type PatientReport = {
  report_id: string;
  risk_light: RiskLight;
  summary: string;
  nodules: Array<{
    location: string;
    diameter_mm: number;
    malignancy_prob: number;
  }>;
  followup_due_at: string | null;
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const body = (await response.json()) as ApiResponse<T>;
  if (body.code !== 0) {
    throw new Error(body.message || "request failed");
  }
  return body.data;
}

export function fetchPatientReport(reportId: string) {
  return request<PatientReport>(`/api/v1/patient/report/${reportId}`);
}

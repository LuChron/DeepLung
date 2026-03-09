import { useMemo, useState } from "react";
import { fetchJob, fetchPatients, type JobResponse, triggerPredict, uploadStudy, type PatientItem } from "./api";

const riskTone: Record<string, string> = {
  HIGH: "risk-high",
  MEDIUM: "risk-medium",
  LOW: "risk-low"
};

function secondsAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return `${Math.max(0, Math.floor(diff / 1000))}s`;
}

export default function App() {
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [patientId, setPatientId] = useState("P10001");
  const [fileName, setFileName] = useState("demo.mhd");
  const [job, setJob] = useState<JobResponse | null>(null);
  const [jobBusy, setJobBusy] = useState(false);

  const summary = useMemo(() => {
    const high = patients.filter((p) => p.latest_risk_level === "HIGH").length;
    const med = patients.filter((p) => p.latest_risk_level === "MEDIUM").length;
    return { total: patients.length, high, med };
  }, [patients]);

  async function loadPatients() {
    setLoading(true);
    setError("");
    try {
      const list = await fetchPatients();
      setPatients(list);
    } catch (e) {
      setError(`加载失败: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function runPredict() {
    setJobBusy(true);
    setError("");
    setJob(null);
    try {
      const upload = await uploadStudy({ patient_id: patientId, file_name: fileName, file_size: 1024 });
      const trigger = await triggerPredict(upload.study_id);
      let latest = await fetchJob(trigger.job_id);
      setJob(latest);

      for (let i = 0; i < 120; i++) {
        if (latest.status !== "PENDING" && latest.status !== "RUNNING") break;
        await new Promise((r) => setTimeout(r, 1000));
        latest = await fetchJob(trigger.job_id);
        setJob(latest);
      }
      await loadPatients();
    } catch (e) {
      setError(`推理失败: ${(e as Error).message}`);
    } finally {
      setJobBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="kicker">DeepLung / Doctor Console</p>
          <h1>肺结节智能分诊工作台</h1>
          <p className="subtitle">实时触发 AI 推理，按风险倒序查看患者并优先处理高危病例。</p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <span>患者总数</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="metric-card">
            <span>高危</span>
            <strong>{summary.high}</strong>
          </div>
          <div className="metric-card">
            <span>中危</span>
            <strong>{summary.med}</strong>
          </div>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <header className="card-head">
            <h2>AI 任务触发</h2>
          </header>
          <div className="form-grid">
            <label>
              患者 ID
              <input value={patientId} onChange={(e) => setPatientId(e.target.value)} />
            </label>
            <label>
              CT 文件标识
              <input value={fileName} onChange={(e) => setFileName(e.target.value)} />
            </label>
          </div>
          <div className="actions">
            <button onClick={runPredict} disabled={jobBusy}>
              {jobBusy ? "推理中..." : "上传并触发推理"}
            </button>
            <button className="secondary" onClick={loadPatients} disabled={loading}>
              {loading ? "刷新中..." : "刷新分诊列表"}
            </button>
          </div>
          {job && (
            <div className="job">
              <div>Job: {job.job_id}</div>
              <div>状态: {job.status}</div>
              <div>风险等级: {job.risk_level ?? "-"}</div>
              <div>更新时间: {secondsAgo(job.updated_at)} 前</div>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </article>

        <article className="card">
          <header className="card-head">
            <h2>风险排序列表</h2>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>患者</th>
                  <th>风险分</th>
                  <th>等级</th>
                  <th>最大结节(mm)</th>
                  <th>报告</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.patient_id}>
                    <td>{p.name_masked}</td>
                    <td>{p.latest_risk_score.toFixed(2)}</td>
                    <td>
                      <span className={`risk-chip ${riskTone[p.latest_risk_level]}`}>{p.latest_risk_level}</span>
                    </td>
                    <td>{p.largest_nodule_mm.toFixed(1)}</td>
                    <td>{p.report_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}

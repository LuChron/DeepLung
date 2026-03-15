import { useMemo, useState } from "react";
import { fetchPatientReport, type PatientReport, type RiskLight } from "./api";

const toneMap: Record<RiskLight, string> = {
  RED: "tone-red",
  YELLOW: "tone-yellow",
  GREEN: "tone-green"
};

const toneText: Record<RiskLight, string> = {
  RED: "高风险",
  YELLOW: "中风险",
  GREEN: "低风险"
};

export default function App() {
  const [reportId, setReportId] = useState("R202603090001");
  const [report, setReport] = useState<PatientReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hint = useMemo(() => {
    if (!report?.followup_due_at) return "暂无复查提醒";
    return `建议复查日期：${report.followup_due_at}`;
  }, [report]);

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPatientReport(reportId.trim());
      setReport(data);
    } catch (e) {
      setError(`查询失败: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="kicker">DeepLung / Patient H5</p>
        <h1>肺结节报告解读</h1>
        <p>用易懂方式查看风险、结节信息和复查提醒。</p>
      </header>

      <section className="card search">
        <label htmlFor="reportId">报告编号</label>
        <div className="search-row">
          <input
            id="reportId"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            placeholder="输入报告编号"
          />
          <button onClick={loadReport} disabled={loading}>
            {loading ? "加载中..." : "查询报告"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {report && (
        <>
          <section className={`card risk ${toneMap[report.risk_light]}`}>
            <div>
              <p className="risk-caption">当前风险等级</p>
              <strong>{toneText[report.risk_light]}</strong>
            </div>
            <span className="dot" />
          </section>

          <section className="card">
            <h2>报告摘要</h2>
            <p className="summary">{report.summary}</p>
            <p className="followup"><strong>建议：</strong>{report.recommendation}</p>
            <p className="followup">{hint}</p>
          </section>

          <section className="card">
            <h2>结节明细</h2>
            <div className="list">
              {report.nodules.map((n, i) => (
                <article className="item" key={`${n.location}-${i}`}>
                  <h3>{n.location}</h3>
                  <p>直径: {n.diameter_mm.toFixed(1)} mm</p>
                  <p>检出置信度: {(n.detection_score * 100).toFixed(1)}%</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { UploadProps } from 'antd';
import {
  Layout,
  Card,
  Button,
  Upload,
  Statistic,
  Input,
  List,
  message,
  Avatar,
  Badge,
  Space,
  Divider,
  Breadcrumb,
  Tag,
} from 'antd';
import {
  InboxOutlined,
  RobotOutlined,
  SendOutlined,
  LogoutOutlined,
  UserOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  ExpandOutlined,
  ArrowLeftOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import {
  fetchStudyPreview,
  fetchStudyPreviewOverlay,
  getPatientReport,
  getPredictJob,
  listDoctorReports,
  listDoctorPatientMessages,
  publishReport,
  sendDoctorPatientMessage,
  triggerPredict,
  uploadCT,
  type DoctorPatientMessageItem,
  type JobStatusResponse,
  type PredictNodule,
  type StudyPreviewPoint,
} from '../services/api';
import { clearSession, getUsername } from '../services/session';

const { Header, Content } = Layout;
const { TextArea } = Input;
const { Dragger } = Upload;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatRiskLabel(riskLevel: JobStatusResponse['risk_level']): string {
  if (riskLevel === 'HIGH') return '高';
  if (riskLevel === 'MEDIUM') return '中';
  if (riskLevel === 'LOW') return '低';
  return '-';
}

function formatJobStatus(status: JobStatusResponse['status'] | null | undefined): string {
  if (status === 'PENDING') return '排队中';
  if (status === 'RUNNING') return '运行中';
  if (status === 'SUCCEEDED') return '已完成';
  if (status === 'FAILED') return '失败';
  return '空闲';
}

function pickMaxNodule(nodules: PredictNodule[]): PredictNodule | null {
  if (!nodules.length) {
    return null;
  }
  return nodules.reduce((max, curr) => (curr.diameter_mm > max.diameter_mm ? curr : max), nodules[0]);
}

function generateReport(patientId: string, job: JobStatusResponse): string {
  const maxNodule = pickMaxNodule(job.nodules);
  const topScore = job.nodules.length
    ? Math.max(...job.nodules.map((n) => Number(n.detection_score || 0)))
    : 0;

  return `诊断报告 - 肺部 CT 影像分析

患者 ID: ${patientId}
检查 ID: ${job.study_id}
生成时间: ${new Date().toLocaleString('zh-CN')}

主要发现:
AI 模型版本：${job.model_version}
检出结节数：${job.nodules.length}
${
  maxNodule
    ? `最大结节：${maxNodule.diameter_mm.toFixed(2)} mm（${maxNodule.location}）`
    : '最大结节：未检出'
}
最高检出分值：${(topScore * 100).toFixed(1)}%
风险等级：${formatRiskLabel(job.risk_level)}
风险分值：${job.risk_score ?? 0}

诊断意见:
${job.summary || 'AI 分析已完成。'}

处置建议:
${job.risk_level === 'HIGH' ? '- 建议优先复核并尽快安排复查。' : '- 建议按计划随访复查。'}
- 本报告用于辅助，不替代医生诊断。

备注:
推理模式：${job.inference_mode_used || '未知'}
${job.note || ''}`;
}

function riskLevelFromLight(riskLight: 'GREEN' | 'YELLOW' | 'RED'): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (riskLight === 'RED') return 'HIGH';
  if (riskLight === 'YELLOW') return 'MEDIUM';
  return 'LOW';
}

function generateHistoricalReportText(
  patientId: string,
  reportId: string,
  report: {
    summary: string;
    recommendation: string;
    risk_light: 'GREEN' | 'YELLOW' | 'RED';
    followup_due_at: string | null;
    nodules: Array<{ location: string; diameter_mm: number; detection_score: number }>;
  }
): string {
  const noduleLines =
    report.nodules.length > 0
      ? report.nodules
          .map(
            (n, idx) =>
              `- N${idx + 1}: ${n.location}, ${Number(n.diameter_mm || 0).toFixed(2)} mm, score ${(Number(n.detection_score || 0) * 100).toFixed(1)}%`
          )
          .join('\n')
      : '- 无结节明细';

  return `已发布报告 - 历史查看

患者 ID: ${patientId}
报告 ID: ${reportId}
风险灯色: ${report.risk_light}
随访日期: ${report.followup_due_at || '-'}

报告摘要:
${report.summary}

医生建议:
${report.recommendation}

结节明细:
${noduleLines}`;
}

function extractReportFields(
  reportText: string,
  fallbackSummary: string,
  riskLevel: JobStatusResponse['risk_level']
): { impression: string; recommendation: string } {
  const text = (reportText || '').replace(/\r/g, '');
  const impressionMatch =
    text.match(/诊断意见:\s*([\s\S]*?)(?:\n处置建议:|$)/i) ||
    text.match(/IMPRESSION:\s*([\s\S]*?)(?:\nRECOMMENDATION:|$)/i);
  const recommendationMatch =
    text.match(/处置建议:\s*([\s\S]*?)(?:\n备注:|$)/i) ||
    text.match(/RECOMMENDATION:\s*([\s\S]*?)(?:\nNOTE:|$)/i);

  const impression = (impressionMatch?.[1] || fallbackSummary || text || 'AI 分析已完成。')
    .trim()
    .slice(0, 2000);

  const defaultRecommendation =
    riskLevel === 'HIGH' ? '建议优先复核并尽快安排复查。' : '建议按计划随访复查。';
  const recommendation = (recommendationMatch?.[1] || defaultRecommendation).trim().slice(0, 2000);

  return { impression, recommendation };
}

export function DoctorWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId') || 'P10001';
  const reportId = searchParams.get('reportId');
  const historyStudyId = searchParams.get('studyId');
  const doctorName = useMemo(() => getUsername() || 'doctor-demo', []);

  const [ctPath, setCtPath] = useState('');
  const [runningAi, setRunningAi] = useState(false);
  const [latestJob, setLatestJob] = useState<JobStatusResponse | null>(null);
  const [studyId, setStudyId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [overlayPoints, setOverlayPoints] = useState<StudyPreviewPoint[]>([]);
  const [doctorMessages, setDoctorMessages] = useState<DoctorPatientMessageItem[]>([]);
  const [loadingDoctorMessages, setLoadingDoctorMessages] = useState(false);
  const [sendingDoctorMessage, setSendingDoctorMessage] = useState(false);
  const [doctorMessageDraft, setDoctorMessageDraft] = useState('');
  const [reportText, setReportText] = useState(`诊断报告 - 肺部 CT 影像分析

患者 ID: ${patientId}

请先在左侧输入 CT 文件路径，然后点击“上传并触发 AI 推理”。`);

  const maxNodule = pickMaxNodule(latestJob?.nodules || []);
  const detectionScore = latestJob?.nodules?.length
    ? Math.max(...latestJob.nodules.map((n) => Number(n.detection_score || 0)))
    : 0;
  const isHistoryReportMode = Boolean(reportId && latestJob?.inference_mode_used === 'report_archive');

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadDoctorMessages = async () => {
    setLoadingDoctorMessages(true);
    try {
      const rows = await listDoctorPatientMessages(patientId, 100);
      setDoctorMessages(rows);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '加载医患消息失败';
      message.error(detail);
    } finally {
      setLoadingDoctorMessages(false);
    }
  };

  useEffect(() => {
    void loadDoctorMessages();
  }, [patientId]);

  useEffect(() => {
    if (!reportId) {
      return;
    }

    let cancelled = false;
    const loadHistoryReport = async () => {
      try {
        const report = await getPatientReport(reportId);
        if (cancelled) {
          return;
        }

        let resolvedStudyId = report.study_id || historyStudyId || null;
        if (!resolvedStudyId) {
          try {
            const doctorReports = await listDoctorReports(patientId);
            resolvedStudyId = doctorReports.find((x) => x.report_id === reportId)?.study_id || null;
          } catch {
            resolvedStudyId = null;
          }
        }
        if (resolvedStudyId) {
          setStudyId(resolvedStudyId);
          await loadStudyPreview(resolvedStudyId, null);
        } else {
          setStudyId(null);
          setOverlayPoints([]);
          setPreviewUrl((prev) => {
            if (prev) {
              URL.revokeObjectURL(prev);
            }
            return null;
          });
        }
        if (cancelled) {
          return;
        }

        const historicalNodules: PredictNodule[] = (report.nodules || []).map((n, index) => ({
          index,
          coord_x: 0,
          coord_y: 0,
          coord_z: 0,
          diameter_mm: Number(n.diameter_mm || 0),
          volume_mm3: 0,
          detection_score: Number(n.detection_score || 0),
          location: n.location || '肺部',
        }));

        setLatestJob({
          job_id: `REPORT-${reportId}`,
          study_id: resolvedStudyId || '-',
          status: 'SUCCEEDED',
          model_version: 'published-report',
          risk_score: null,
          risk_level: riskLevelFromLight(report.risk_light),
          summary: report.summary,
          inference_mode_used: 'report_archive',
          note: `loaded historical report ${reportId}`,
          nodules: historicalNodules,
          updated_at: new Date().toISOString(),
        });
        setReportText(generateHistoricalReportText(patientId, reportId, report));
      } catch (error) {
        const detail = error instanceof Error ? error.message : '历史报告加载失败';
        message.error(detail);
      }
    };

    void loadHistoryReport();
    return () => {
      cancelled = true;
    };
  }, [historyStudyId, patientId, reportId]);

  const loadStudyPreview = async (targetStudyId: string, targetJobId?: string | null) => {
    setPreviewLoading(true);
    try {
      const [blob, overlay] = await Promise.all([
        fetchStudyPreview(targetStudyId, targetJobId),
        fetchStudyPreviewOverlay(targetStudyId, targetJobId).catch(() => ({
          study_id: targetStudyId,
          job_id: targetJobId || null,
          points: [],
        })),
      ]);
      const nextUrl = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return nextUrl;
      });
      setOverlayPoints(overlay.points);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'CT 预览加载失败';
      message.warning(`CT 预览加载失败：${detail}`);
      setOverlayPoints([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAutoGenerate = () => {
    if (!latestJob || latestJob.status !== 'SUCCEEDED') {
      message.warning('请先完成一次 AI 推理。');
      return;
    }
    setReportText(generateReport(patientId, latestJob));
    message.success('已根据最新推理结果生成报告草稿');
  };

  const pollJobUntilDone = async (targetJobId: string): Promise<JobStatusResponse> => {
    for (let i = 0; i < 120; i += 1) {
      const job = await getPredictJob(targetJobId);
      setLatestJob(job);
      if (job.status === 'SUCCEEDED' || job.status === 'FAILED') {
        return job;
      }
      await sleep(2000);
    }
    throw new Error('AI 推理任务轮询超时（> 240s）');
  };

  const handleRunPredict = async () => {
    const path = ctPath.trim();
    if (!path) {
      message.warning('请先输入可被后端访问的 CT 文件路径。');
      return;
    }

    setRunningAi(true);
    try {
      const uploaded = await uploadCT(patientId, path, path.length);
      setStudyId(uploaded.study_id);
      await loadStudyPreview(uploaded.study_id, null);

      const predictTask = await triggerPredict(uploaded.study_id);
      setJobId(predictTask.job_id);

      message.info(`任务已提交，任务 ID：${predictTask.job_id}`);
      const doneJob = await pollJobUntilDone(predictTask.job_id);

      if (doneJob.status === 'SUCCEEDED') {
        await loadStudyPreview(uploaded.study_id, doneJob.job_id);
        setReportText(generateReport(patientId, doneJob));
        message.success('AI 推理完成');
      } else {
        message.error('AI 推理失败，请检查后端日志。');
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'AI 推理失败';
      message.error(detail);
    } finally {
      setRunningAi(false);
    }
  };

  const handleSignAndSend = async () => {
    if (!studyId || isHistoryReportMode) {
      message.warning('当前为历史报告浏览模式，不能重复签发。');
      return;
    }

    try {
      if (!latestJob?.risk_level) {
        message.warning('当前没有可签发的 AI 结果。');
        return;
      }
      const { impression, recommendation } = extractReportFields(
        reportText,
        latestJob.summary || 'AI 分析已完成。',
        latestJob.risk_level
      );
      const published = await publishReport(studyId, latestJob.risk_level, impression, recommendation);
      message.success(`报告已签发并发送给患者端（报告 ID：${published.report_id}）`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '报告签发失败';
      message.error(detail);
    }
  };

  const handleSendDoctorMessage = async () => {
    const text = doctorMessageDraft.trim();
    if (!text) {
      message.warning('请先输入要发送给患者的消息');
      return;
    }

    setSendingDoctorMessage(true);
    try {
      const sent = await sendDoctorPatientMessage(patientId, doctorName, text);
      setDoctorMessages((prev) => [...prev, sent]);
      setDoctorMessageDraft('');
      message.success('已发送给患者');
    } catch (error) {
      const detail = error instanceof Error ? error.message : '发送失败';
      message.error(detail);
    } finally {
      setSendingDoctorMessage(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.nii.gz,.nii,.mhd,.mha,.dcm',
    beforeUpload: (file) => {
      setCtPath(file.name);
      message.info('已读取文件名。请改成后端机器可访问的绝对路径后再执行推理。');
      return false;
    },
  };

  return (
    <Layout className="min-h-screen bg-gray-50" style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <Header
        className="bg-white shadow-sm px-8 flex items-center justify-between"
        style={{ background: '#001a3a', color: '#fff' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
            <RobotOutlined className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-xl m-0">医疗 AI 平台</h1>
            <p className="text-sm text-gray-500 m-0">医生诊断工作台</p>
          </div>
        </div>
        <Space size="large">
          <Badge count={latestJob?.status === 'RUNNING' ? 1 : 0} offset={[-5, 5]}>
            <Avatar size="large" icon={<UserOutlined />} className="bg-cyan-500" />
          </Badge>
          <span className="text-base">{doctorName}</span>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              clearSession();
              navigate('/');
            }}
          >
            退出登录
          </Button>
        </Space>
      </Header>

      <Content
        className="p-5"
        style={{ background: 'linear-gradient(180deg, #f7f9fc 0%, #f1f4f8 100%)', minHeight: 'calc(100vh - 64px)', overflowY: 'auto' }}
      >
        <div className="max-w-[1800px] mx-auto mb-3">
          <div className="flex items-center justify-between">
            <Breadcrumb
              items={[
                {
                  href: '/doctor-dashboard',
                  title: (
                    <span className="flex items-center gap-1">
                      <HomeOutlined />
                      <span>首页</span>
                    </span>
                  ),
                },
                {
                  title: '患者管理',
                },
                {
                  title: patientId,
                },
              ]}
            />
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/doctor-dashboard')}>
              返回医生端
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 max-w-[1800px] mx-auto">
          <div className="col-span-3 space-y-4">
            <Card
              title={
                <div className="flex items-center gap-2">
                  <UserOutlined className="text-cyan-600" />
                  <span>患者信息</span>
                </div>
              }
              className="shadow-sm"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">患者 ID</p>
                  <p className="text-base">{patientId}</p>
                </div>
                <Divider className="my-3" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">当前检查 ID</p>
                  <p className="text-base">{studyId || '-'}</p>
                </div>
                <Divider className="my-3" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">当前任务 ID</p>
                  <p className="text-base break-all">{jobId || '-'}</p>
                </div>
                <Divider className="my-3" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">任务状态</p>
                  <Tag
                    color={
                      latestJob?.status === 'SUCCEEDED'
                        ? 'green'
                        : latestJob?.status === 'FAILED'
                        ? 'red'
                        : latestJob?.status === 'RUNNING'
                        ? 'blue'
                        : 'default'
                    }
                  >
                    {formatJobStatus(latestJob?.status)}
                  </Tag>
                </div>
              </div>
            </Card>

            <Card title="CT 上传" className="shadow-sm">
              <Dragger {...uploadProps} className="bg-gradient-to-br from-cyan-50 to-teal-50">
                <p className="ant-upload-drag-icon">
                  <InboxOutlined className="text-cyan-600" />
                </p>
                <p className="ant-upload-text">点击或拖拽 CT 文件到此处</p>
                <p className="ant-upload-hint text-xs">支持 .nii.gz / .nii / .mhd / .mha / .dcm</p>
              </Dragger>

              <div className="mt-4 space-y-2">
                <Input
                  value={ctPath}
                  onChange={(e) => setCtPath(e.target.value)}
                  placeholder="输入后端可访问的 CT 绝对路径，例如 /home/zbx/DeepLung/tmp_monai_ct.nii.gz"
                />
                <Button type="primary" block loading={runningAi} onClick={handleRunPredict}>
                  上传并触发 AI 推理
                </Button>
              </div>
            </Card>
          </div>

          <div className="col-span-5 space-y-4">
            <Card
              title={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RobotOutlined className="text-cyan-600" />
                    <span>AI 影像分析</span>
                  </div>
                  <Button icon={<ExpandOutlined />} size="small">
                    全屏
                  </Button>
                </div>
              }
              className="shadow-sm"
            >
              <div className="relative bg-black rounded-lg overflow-hidden">
                <div className="relative h-[300px] bg-black flex items-center justify-center">
                  <div className="relative h-full aspect-square max-w-full bg-black">
                    {previewUrl ? (
                      <img src={previewUrl} alt="CT 预览图" className="w-full h-full object-contain" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                        <div className="w-full h-full opacity-15 bg-[radial-gradient(circle_at_30%_50%,rgba(148,163,184,0.45),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(148,163,184,0.45),transparent_45%)]" />
                      </div>
                    )}
                    <div className="absolute inset-0 pointer-events-none">
                      {overlayPoints.map((p) => (
                        <div
                          key={p.index}
                          className="absolute rounded-full border-2 border-red-400 bg-red-500/25"
                          style={{
                            left: `${(p.left_ratio * 100).toFixed(2)}%`,
                            top: `${(p.top_ratio * 100).toFixed(2)}%`,
                            width: `${p.size_px}px`,
                            height: `${p.size_px}px`,
                            transform: 'translate(-50%, -50%)',
                            boxShadow: '0 0 18px rgba(248, 113, 113, 0.7)',
                          }}
                          title={`结节-${p.index}: ${(p.score * 100).toFixed(1)}%, ${p.diameter_mm.toFixed(2)}mm`}
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-red-500 text-white px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
                            N{p.index} {(p.score * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-xs text-slate-200 bg-black/45 rounded px-3 py-2">
                    {previewLoading
                      ? '正在加载 CT 预览...'
                      : latestJob
                      ? `检查 ${latestJob.study_id} | 任务 ${latestJob.job_id} | 更新时间 ${new Date(latestJob.updated_at).toLocaleString('zh-CN')}`
                      : studyId
                      ? `检查 ${studyId} 已上传，等待推理结果。`
                      : '请先上传 CT，系统会显示真实切片预览。'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <Card className="text-center bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
                  <Statistic title="检出结节数" value={latestJob?.nodules.length || 0} valueStyle={{ color: '#dc2626' }} />
                </Card>
                <Card className="text-center bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                  <Statistic
                    title="最大直径 (mm)"
                    value={maxNodule ? Number(maxNodule.diameter_mm.toFixed(2)) : 0}
                    precision={2}
                    valueStyle={{ color: '#ea580c' }}
                  />
                </Card>
                <Card className="text-center bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200">
                  <Statistic
                    title={
                      <div className="flex items-center justify-center gap-1">
                        <EnvironmentOutlined />
                        <span>位置</span>
                      </div>
                    }
                    value={maxNodule?.location || '-'}
                    valueStyle={{ color: '#0891b2', fontSize: '16px' }}
                  />
                </Card>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 m-0">
                  <RobotOutlined className="mr-2" />
                  <strong>AI 结果：</strong>风险={formatRiskLabel(latestJob?.risk_level || null)} |
                  分值={(detectionScore * 100).toFixed(1)}% |
                  模式={latestJob?.inference_mode_used || '-'}
                </p>
                {latestJob?.summary && <p className="text-xs text-blue-800 mt-2 mb-0">{latestJob.summary}</p>}
              </div>
            </Card>
          </div>

          <div className="col-span-4 space-y-4">
            <Card
              title={
                <div className="flex items-center gap-2">
                  <RobotOutlined className="text-cyan-600" />
                  <span>AI 生成报告</span>
                </div>
              }
              className="shadow-sm"
              extra={
                <Button type="primary" icon={<RobotOutlined />} onClick={handleAutoGenerate} size="small">
                  自动生成
                </Button>
              }
            >
              <TextArea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                rows={14}
                className="font-mono text-sm"
                style={{ resize: 'none' }}
              />

              <div className="mt-6 space-y-3">
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<SendOutlined />}
                  onClick={() => void handleSignAndSend()}
                  className="h-14 bg-gradient-to-r from-green-500 to-emerald-500 border-0 hover:from-green-600 hover:to-emerald-600"
                  disabled={!latestJob || latestJob.status !== 'SUCCEEDED' || isHistoryReportMode || !studyId}
                >
                  <span className="text-lg">签发并发送给患者</span>
                </Button>

                <div className="flex gap-2">
                  <Button block onClick={handleAutoGenerate}>
                    保存草稿
                  </Button>
                  <Button block>导出 PDF</Button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-800 m-0">
                  仅用于辅助诊断。若任务失败，请检查后端与 AI 引擎日志，确认 CT 路径可被后端访问。
                </p>
              </div>
            </Card>

            <Card
              title="医生 -> 患者消息"
              className="shadow-sm"
              extra={
                <Button size="small" onClick={() => void loadDoctorMessages()} loading={loadingDoctorMessages}>
                  刷新
                </Button>
              }
            >
              <TextArea
                value={doctorMessageDraft}
                onChange={(e) => setDoctorMessageDraft(e.target.value)}
                rows={3}
                placeholder={`发送给 ${patientId} 的消息...`}
              />
              <Button
                className="mt-3"
                type="primary"
                block
                icon={<SendOutlined />}
                loading={sendingDoctorMessage}
                onClick={() => void handleSendDoctorMessage()}
              >
                发送消息
              </Button>

              <List
                className="mt-4"
                style={{ maxHeight: 220, overflowY: 'auto' }}
                loading={loadingDoctorMessages}
                dataSource={doctorMessages}
                locale={{ emptyText: '暂无医患消息' }}
                renderItem={(item) => (
                  <List.Item>
                    <div className="w-full">
                      <div className="text-xs text-gray-500">
                        {item.doctor_username} · {new Date(item.created_at).toLocaleString('zh-CN')}
                      </div>
                      <div className="text-sm mt-1 whitespace-pre-wrap">{item.content}</div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </div>
        </div>
      </Content>
    </Layout>
  );
}

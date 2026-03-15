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
  getPredictJob,
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
  if (riskLevel === 'HIGH') return 'High';
  if (riskLevel === 'MEDIUM') return 'Medium';
  if (riskLevel === 'LOW') return 'Low';
  return '-';
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

  return `DIAGNOSTIC REPORT - LUNG CT SCAN ANALYSIS

Patient ID: ${patientId}
Study ID: ${job.study_id}
Generated At: ${new Date().toLocaleString('zh-CN')}

FINDINGS:
AI-assisted analysis completed with model ${job.model_version}.
Detected nodules: ${job.nodules.length}
${
  maxNodule
    ? `Largest nodule: ${maxNodule.diameter_mm.toFixed(2)} mm at ${maxNodule.location}`
    : 'Largest nodule: none'
}
Top detection score: ${(topScore * 100).toFixed(1)}%
Risk level: ${formatRiskLabel(job.risk_level)}
Risk score: ${job.risk_score ?? 0}

IMPRESSION:
${job.summary || 'AI analysis completed.'}

RECOMMENDATION:
${job.risk_level === 'HIGH' ? '- 建议优先复核并尽快安排复查。' : '- 建议按计划随访复查。'}
- 本报告用于辅助，不替代医生诊断。

NOTE:
Inference mode: ${job.inference_mode_used || 'unknown'}
${job.note || ''}`;
}

function extractReportFields(
  reportText: string,
  fallbackSummary: string,
  riskLevel: JobStatusResponse['risk_level']
): { impression: string; recommendation: string } {
  const text = (reportText || '').replace(/\r/g, '');
  const impressionMatch = text.match(/IMPRESSION:\s*([\s\S]*?)(?:\nRECOMMENDATION:|$)/i);
  const recommendationMatch = text.match(/RECOMMENDATION:\s*([\s\S]*?)(?:\nNOTE:|$)/i);

  const impression = (impressionMatch?.[1] || fallbackSummary || text || 'AI analysis completed.')
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
  const [reportText, setReportText] = useState(`DIAGNOSTIC REPORT - LUNG CT SCAN ANALYSIS

Patient ID: ${patientId}

请先在左侧输入 CT 文件路径，然后点击“上传并触发 AI 推理”。`);

  const maxNodule = pickMaxNodule(latestJob?.nodules || []);
  const detectionScore = latestJob?.nodules?.length
    ? Math.max(...latestJob.nodules.map((n) => Number(n.detection_score || 0)))
    : 0;

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

      message.info(`任务已提交，Job ID: ${predictTask.job_id}`);
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
    try {
      let reportId = 'R202603090001';
      if (studyId && latestJob?.risk_level) {
        const { impression, recommendation } = extractReportFields(
          reportText,
          latestJob.summary || 'AI analysis completed.',
          latestJob.risk_level
        );
        const published = await publishReport(studyId, latestJob.risk_level, impression, recommendation);
        reportId = published.report_id;
      }
      message.success(`报告已签发并发送给患者端（report_id=${reportId}）`);
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
    <Layout className="min-h-screen bg-gray-50">
      <Header className="bg-white shadow-sm px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
            <RobotOutlined className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-xl m-0">Medical AI Platform</h1>
            <p className="text-sm text-gray-500 m-0">Doctor Diagnostic Workspace</p>
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
            Logout
          </Button>
        </Space>
      </Header>

      <Content className="p-6">
        <div className="max-w-[1800px] mx-auto mb-4">
          <div className="flex items-center justify-between">
            <Breadcrumb
              items={[
                {
                  href: '/doctor-dashboard',
                  title: (
                    <span className="flex items-center gap-1">
                      <HomeOutlined />
                      <span>Dashboard</span>
                    </span>
                  ),
                },
                {
                  title: 'Patient Directory',
                },
                {
                  title: patientId,
                },
              ]}
            />
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/doctor-dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 max-w-[1800px] mx-auto">
          <div className="col-span-3 space-y-6">
            <Card
              title={
                <div className="flex items-center gap-2">
                  <UserOutlined className="text-cyan-600" />
                  <span>Patient Information</span>
                </div>
              }
              className="shadow-sm"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Patient ID</p>
                  <p className="text-base">{patientId}</p>
                </div>
                <Divider className="my-3" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Current Study ID</p>
                  <p className="text-base">{studyId || '-'}</p>
                </div>
                <Divider className="my-3" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Current Job ID</p>
                  <p className="text-base break-all">{jobId || '-'}</p>
                </div>
                <Divider className="my-3" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Job Status</p>
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
                    {latestJob?.status || 'IDLE'}
                  </Tag>
                </div>
              </div>
            </Card>

            <Card title="CT Scan Upload" className="shadow-sm">
              <Dragger {...uploadProps} className="bg-gradient-to-br from-cyan-50 to-teal-50">
                <p className="ant-upload-drag-icon">
                  <InboxOutlined className="text-cyan-600" />
                </p>
                <p className="ant-upload-text">Click or drag CT scan files</p>
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

          <div className="col-span-5 space-y-6">
            <Card
              title={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RobotOutlined className="text-cyan-600" />
                    <span>AI Vision Analysis</span>
                  </div>
                  <Button icon={<ExpandOutlined />} size="small">
                    Fullscreen
                  </Button>
                </div>
              }
              className="shadow-sm"
            >
              <div className="relative bg-black rounded-lg overflow-hidden">
                <div className="relative h-[360px] bg-black flex items-center justify-center">
                  <div className="relative h-full aspect-square max-w-full bg-black">
                    {previewUrl ? (
                      <img src={previewUrl} alt="CT Preview" className="w-full h-full object-contain" />
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
                          title={`nodule-${p.index}: ${(p.score * 100).toFixed(1)}%, ${p.diameter_mm.toFixed(2)}mm`}
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
                      ? `Study ${latestJob.study_id} | Job ${latestJob.job_id} | Updated ${new Date(latestJob.updated_at).toLocaleString('zh-CN')}`
                      : studyId
                      ? `Study ${studyId} 已上传，等待推理结果。`
                      : '请先上传 CT，系统会显示真实切片预览。'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <Card className="text-center bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
                  <Statistic title="Nodules Detected" value={latestJob?.nodules.length || 0} valueStyle={{ color: '#dc2626' }} />
                </Card>
                <Card className="text-center bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                  <Statistic
                    title="Size (mm)"
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
                        <span>Location</span>
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
                  <strong>AI Result:</strong> risk={formatRiskLabel(latestJob?.risk_level || null)} |
                  score={(detectionScore * 100).toFixed(1)}% |
                  mode={latestJob?.inference_mode_used || '-'}
                </p>
                {latestJob?.summary && <p className="text-xs text-blue-800 mt-2 mb-0">{latestJob.summary}</p>}
              </div>
            </Card>
          </div>

          <div className="col-span-4 space-y-6">
            <Card
              title={
                <div className="flex items-center gap-2">
                  <RobotOutlined className="text-cyan-600" />
                  <span>AI-Generated Report</span>
                </div>
              }
              className="shadow-sm"
              extra={
                <Button type="primary" icon={<RobotOutlined />} onClick={handleAutoGenerate} size="small">
                  Auto-Generate
                </Button>
              }
            >
              <TextArea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                rows={24}
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
                  disabled={!latestJob || latestJob.status !== 'SUCCEEDED'}
                >
                  <span className="text-lg">Sign & Send to Patient</span>
                </Button>

                <div className="flex gap-2">
                  <Button block onClick={handleAutoGenerate}>
                    Save Draft
                  </Button>
                  <Button block>Export PDF</Button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-800 m-0">
                  仅用于辅助诊断。若任务失败，请检查后端与 AI 引擎日志，确认 CT 路径可被后端访问。
                </p>
              </div>
            </Card>

            <Card
              title="Doctor -> Patient Message"
              className="shadow-sm"
              extra={
                <Button size="small" onClick={() => void loadDoctorMessages()} loading={loadingDoctorMessages}>
                  Refresh
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
                Send Message
              </Button>

              <List
                className="mt-4"
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

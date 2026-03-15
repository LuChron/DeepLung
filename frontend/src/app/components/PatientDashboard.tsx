import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Layout,
  Card,
  Button,
  Timeline,
  Avatar,
  Input,
  Space,
  Tag,
  Progress,
  Divider,
  Menu,
  List,
  Alert,
  message,
} from 'antd';
import {
  HomeOutlined,
  FileTextOutlined,
  CalendarOutlined,
  MessageOutlined,
  LogoutOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  SendOutlined,
  HeartOutlined,
  MedicineBoxOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { askAssistant, getPatientReport, type PatientReportResponse } from '../services/api';
import { clearSession, getUsername } from '../services/session';

const { Header, Sider, Content } = Layout;

function riskLightToTag(riskLight: PatientReportResponse['risk_light'] | undefined): { color: string; text: string } {
  if (riskLight === 'RED') return { color: 'red', text: 'High Risk' };
  if (riskLight === 'YELLOW') return { color: 'orange', text: 'Medium Risk' };
  return { color: 'green', text: 'Low Risk' };
}

export function PatientDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const patientId = searchParams.get('patientId') || getUsername() || 'patient-demo';
  const reportId = searchParams.get('reportId') || 'R202603090001';

  type ChatMessage = {
    type: 'user' | 'ai';
    text: string;
    meta?: string;
  };

  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      type: 'ai',
      text: '你好，我是你的 AI 健康助手。你的最新影像报告已生成，可随时问我报告解读问题。',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [report, setReport] = useState<PatientReportResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const riskTag = useMemo(() => riskLightToTag(report?.risk_light), [report?.risk_light]);

  const followupDateText = report?.followup_due_at
    ? new Date(report.followup_due_at).toLocaleDateString('zh-CN')
    : '待医生确认';

  const followupDays = useMemo(() => {
    if (!report?.followup_due_at) {
      return 0;
    }
    const now = new Date();
    const due = new Date(report.followup_due_at);
    const diffMs = due.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [report?.followup_due_at]);

  const handleSendMessage = async (messageText?: string) => {
    const msgText = messageText || inputMessage;
    if (!msgText.trim()) return;

    const trimmed = msgText.trim();
    const history = chatMessages.map((x) => ({
      role: x.type === 'ai' ? ('assistant' as const) : ('user' as const),
      text: x.text,
    }));

    setChatMessages((prev) => [...prev, { type: 'user', text: trimmed }]);
    setInputMessage('');
    setChatLoading(true);

    try {
      const result = await askAssistant(patientId, reportId, trimmed, history);
      setChatMessages((prev) => [
        ...prev,
        {
          type: 'ai',
          text: result.reply,
          meta: `${result.provider_used}/${result.model}`,
        },
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '助手服务暂时不可用';
      setChatMessages((prev) => [...prev, { type: 'ai', text: `助手服务暂时不可用：${detail}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    const loadReport = async () => {
      setLoadingReport(true);
      try {
        const data = await getPatientReport(reportId);
        setReport(data);
      } catch (error) {
        const detail = error instanceof Error ? error.message : '报告加载失败';
        message.error(detail);
      } finally {
        setLoadingReport(false);
      }
    };

    void loadReport();
  }, [reportId]);

  const quickReplyButtons = ['Do I need surgery?', 'Is this dangerous?', 'What lifestyle changes should I make?'];

  return (
    <Layout className="min-h-screen">
      <Sider width={260} className="bg-white shadow-lg">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
              <HeartOutlined className="text-white text-2xl" />
            </div>
            <div>
              <h2 className="text-lg m-0">Health Portal</h2>
              <p className="text-xs text-gray-500 m-0">Patient Dashboard</p>
            </div>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[selectedMenu]}
            onClick={(e) => setSelectedMenu(e.key)}
            className="border-0"
            items={[
              {
                key: 'dashboard',
                icon: <HomeOutlined />,
                label: 'Dashboard',
              },
              {
                key: 'reports',
                icon: <FileTextOutlined />,
                label: 'My Reports',
              },
              {
                key: 'appointments',
                icon: <CalendarOutlined />,
                label: 'Appointments',
              },
              {
                key: 'messages',
                icon: <MessageOutlined />,
                label: 'Messages',
              },
            ]}
          />

          <Divider />

          <div className="mt-auto">
            <Card size="small" className="bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200">
              <div className="text-center">
                <Avatar size={64} icon={<UserOutlined />} className="bg-cyan-500 mb-2" />
                <p className="m-0">{patientId}</p>
                <p className="text-xs text-gray-500 m-0">Report: {reportId}</p>
                <Button
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={() => {
                    clearSession();
                    navigate('/');
                  }}
                  className="mt-3"
                  block
                >
                  Logout
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </Sider>

      <Layout>
        <Header className="bg-white shadow-sm px-8 flex items-center justify-between">
          <h1 className="text-2xl m-0">欢迎回来，{patientId}</h1>
          <Space>
            <Tag color={riskTag.color} className="px-4 py-1">
              <CheckCircleOutlined className="mr-1" />
              Risk: {riskTag.text}
            </Tag>
          </Space>
        </Header>

        <Content className="p-6 bg-gray-50">
          <div className="max-w-[1600px] mx-auto">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-8 space-y-6">
                <Card className="bg-gradient-to-r from-cyan-500 to-teal-500 border-0 shadow-lg">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <h2 className="text-3xl m-0 mb-2">你的影像报告已生成</h2>
                      <p className="text-lg text-cyan-50 m-0">报告编号：{reportId}</p>
                    </div>
                    <CheckCircleOutlined className="text-7xl opacity-20" />
                  </div>
                </Card>

                {loadingReport && <Alert type="info" showIcon message="正在加载后端报告数据..." />}

                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <FileTextOutlined className="text-cyan-600" />
                      <span>报告摘要</span>
                    </div>
                  }
                  className="shadow-sm"
                  extra={<Tag color="blue">{new Date().toLocaleDateString('zh-CN')}</Tag>}
                >
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="text-lg mb-2 flex items-center gap-2">
                        <SafetyOutlined className="text-blue-600" />
                        后端返回摘要
                      </h3>
                      <p className="text-base text-gray-700 leading-relaxed m-0">
                        {report?.summary || '暂无摘要数据'}
                      </p>
                    </div>

                    <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
                      <h3 className="text-lg mb-4 flex items-center gap-2">
                        <MedicineBoxOutlined className="text-teal-600" />
                        结节明细
                      </h3>
                      <List
                        dataSource={report?.nodules || []}
                        locale={{ emptyText: '未检出结节' }}
                        renderItem={(item) => (
                          <List.Item>
                            <Space direction="vertical" size={0}>
                              <div>
                                <strong>{item.location}</strong>
                              </div>
                              <div className="text-sm text-gray-600">
                                直径 {item.diameter_mm.toFixed(2)} mm | 检出分值 {(item.detection_score * 100).toFixed(1)}%
                              </div>
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Card>

                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h3 className="text-lg mb-2 flex items-center gap-2">
                        <CheckCircleOutlined className="text-green-600" />
                        医嘱建议
                      </h3>
                      <p className="m-0 text-gray-700">{report?.recommendation || '暂无建议'}</p>
                    </div>

                    <Button type="primary" size="large" block icon={<FileTextOutlined />}>
                      Download Full Medical Report (PDF)
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="col-span-4 space-y-6">
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <CalendarOutlined className="text-cyan-600" />
                      <span>Your Care Timeline</span>
                    </div>
                  }
                  className="shadow-sm"
                >
                  <Timeline
                    items={[
                      {
                        dot: <CheckCircleOutlined className="text-green-500" />,
                        color: 'green',
                        children: (
                          <div>
                            <p className="m-0">Report Loaded</p>
                            <p className="text-xs text-gray-500 m-0">{new Date().toLocaleDateString('zh-CN')}</p>
                          </div>
                        ),
                      },
                      {
                        dot: <CheckCircleOutlined className="text-green-500" />,
                        color: 'green',
                        children: (
                          <div>
                            <p className="m-0">Backend Data Synced</p>
                            <p className="text-xs text-gray-500 m-0">Report ID: {reportId}</p>
                          </div>
                        ),
                      },
                      {
                        dot: <ClockCircleOutlined className="text-blue-500" />,
                        color: 'blue',
                        children: (
                          <div>
                            <p className="m-0">Next Follow-up</p>
                            <p className="text-xs text-gray-500 m-0">{followupDateText}</p>
                            <Tag color="orange" className="mt-1">
                              In {followupDays} Days
                            </Tag>
                          </div>
                        ),
                      },
                    ]}
                  />

                  <Divider />

                  <div className="text-center">
                    <Progress
                      type="circle"
                      percent={Math.max(0, Math.min(100, Math.round((180 - followupDays) / 1.8)))}
                      size={80}
                      format={() => `${followupDays}d`}
                      strokeColor="#0891b2"
                    />
                    <p className="text-sm text-gray-500 mt-2">Until next checkup</p>
                  </div>
                </Card>

                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <RobotOutlined className="text-cyan-600" />
                      <span>Ask AI Assistant</span>
                    </div>
                  }
                  className="shadow-sm"
                >
                  <div className="h-64 overflow-y-auto mb-4 space-y-3">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-2 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                        <Avatar
                          size="small"
                          icon={msg.type === 'ai' ? <RobotOutlined /> : <UserOutlined />}
                          className={msg.type === 'ai' ? 'bg-cyan-500' : 'bg-gray-500'}
                        />
                        <div
                          className={`max-w-[80%] p-3 rounded-lg text-sm ${
                            msg.type === 'ai' ? 'bg-blue-50 text-gray-800' : 'bg-cyan-500 text-white'
                          }`}
                        >
                          {msg.text}
                          {msg.type === 'ai' && msg.meta && <div className="mt-1 text-[10px] opacity-60">{msg.meta}</div>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-3 space-y-2">
                    <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
                    {quickReplyButtons.map((btn, idx) => (
                      <Button
                        key={idx}
                        size="small"
                        block
                        disabled={chatLoading}
                        onClick={() => void handleSendMessage(btn)}
                        className="text-left"
                      >
                        {btn}
                      </Button>
                    ))}
                  </div>

                  <Space.Compact className="w-full">
                    <Input
                      placeholder="Type your question..."
                      value={inputMessage}
                      disabled={chatLoading}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onPressEnter={() => void handleSendMessage()}
                    />
                    <Button type="primary" icon={<SendOutlined />} loading={chatLoading} onClick={() => void handleSendMessage()} />
                  </Space.Compact>

                  <p className="text-xs text-gray-400 mt-2 text-center">AI responses are for general guidance only</p>
                </Card>
              </div>
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

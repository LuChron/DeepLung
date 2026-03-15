import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Divider,
  Input,
  Layout,
  List,
  Menu,
  Progress,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  message,
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  HeartOutlined,
  HomeOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  MessageOutlined,
  RobotOutlined,
  SafetyOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  askAssistant,
  getPatientReport,
  listPatientMessages,
  listPatientReports,
  type DoctorPatientMessageItem,
  type PatientReportListItem,
  type PatientReportResponse,
} from '../services/api';
import { clearSession, getUsername } from '../services/session';

const { Header, Sider, Content } = Layout;

type MenuKey = 'dashboard' | 'reports' | 'appointments' | 'messages';

type ChatMessage = {
  type: 'user' | 'ai';
  text: string;
  meta?: string;
};

function riskLightToTag(riskLight: PatientReportResponse['risk_light'] | undefined): { color: string; text: string } {
  if (riskLight === 'RED') return { color: 'red', text: 'High Risk' };
  if (riskLight === 'YELLOW') return { color: 'orange', text: 'Medium Risk' };
  return { color: 'green', text: 'Low Risk' };
}

function riskLightBadge(riskLight: PatientReportListItem['risk_light']) {
  if (riskLight === 'RED') return <Tag color="red">HIGH</Tag>;
  if (riskLight === 'YELLOW') return <Tag color="orange">MEDIUM</Tag>;
  return <Tag color="green">LOW</Tag>;
}

function toDateText(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('zh-CN');
}

export function PatientDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const patientId = searchParams.get('patientId') || getUsername() || 'patient_demo';
  const reportId = searchParams.get('reportId') || 'R202603090001';

  const [selectedMenu, setSelectedMenu] = useState<MenuKey>('dashboard');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      type: 'ai',
      text: '你好，我是你的 AI 健康助手。你可以问我报告解读、复查安排和生活方式建议。',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [report, setReport] = useState<PatientReportResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const [reportList, setReportList] = useState<PatientReportListItem[]>([]);
  const [loadingReportList, setLoadingReportList] = useState(false);
  const [doctorMessages, setDoctorMessages] = useState<DoctorPatientMessageItem[]>([]);
  const [loadingDoctorMessages, setLoadingDoctorMessages] = useState(false);

  const riskTag = useMemo(() => riskLightToTag(report?.risk_light), [report?.risk_light]);

  const followupDays = useMemo(() => {
    if (!report?.followup_due_at) return 0;
    const now = new Date();
    const due = new Date(report.followup_due_at);
    const diffMs = due.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [report?.followup_due_at]);

  const headerMap: Record<MenuKey, { title: string; desc: string }> = {
    dashboard: { title: 'Patient Dashboard', desc: '你的最新报告、风险与复查总览' },
    reports: { title: 'My Reports', desc: '查看历史报告与当前报告详情' },
    appointments: { title: 'Follow-up Plan', desc: '查看复查时间与执行建议' },
    messages: { title: 'Messages', desc: '查看医生消息并与健康助手对话' },
  };

  const handleSendMessage = async (messageText?: string) => {
    const msgText = (messageText || inputMessage).trim();
    if (!msgText) return;

    const history = chatMessages.map((x) => ({
      role: x.type === 'ai' ? ('assistant' as const) : ('user' as const),
      text: x.text,
    }));

    setChatMessages((prev) => [...prev, { type: 'user', text: msgText }]);
    setInputMessage('');
    setChatLoading(true);

    try {
      const result = await askAssistant(patientId, reportId, msgText, history);
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

  const loadCurrentReport = async () => {
    setLoadingReport(true);
    try {
      const data = await getPatientReport(reportId);
      setReport(data);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '报告加载失败';
      message.error(detail);
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  };

  const loadReportList = async () => {
    setLoadingReportList(true);
    try {
      const data = await listPatientReports(patientId);
      setReportList(data);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '历史报告加载失败';
      message.error(detail);
      setReportList([]);
    } finally {
      setLoadingReportList(false);
    }
  };

  const loadDoctorMessages = async () => {
    setLoadingDoctorMessages(true);
    try {
      const data = await listPatientMessages(patientId, 100);
      setDoctorMessages(data);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '医生消息加载失败';
      message.error(detail);
      setDoctorMessages([]);
    } finally {
      setLoadingDoctorMessages(false);
    }
  };

  useEffect(() => {
    void loadCurrentReport();
  }, [reportId]);

  useEffect(() => {
    void loadReportList();
  }, [patientId]);

  useEffect(() => {
    void loadDoctorMessages();
  }, [patientId]);

  const downloadCurrentReport = () => {
    if (!report) {
      message.warning('暂无可下载报告');
      return;
    }

    const lines = [
      `Report ID: ${report.report_id}`,
      `Patient ID: ${patientId}`,
      `Risk: ${report.risk_light}`,
      `Follow-up Due: ${toDateText(report.followup_due_at)}`,
      '',
      'Summary:',
      report.summary,
      '',
      'Recommendation:',
      report.recommendation,
      '',
      'Nodules:',
      ...(report.nodules.length
        ? report.nodules.map((n) => `${n.location} | diameter=${n.diameter_mm.toFixed(2)}mm | score=${(n.detection_score * 100).toFixed(1)}%`)
        : ['None']),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.report_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const quickReplyButtons = ['这个风险严重吗？', '我需要做手术吗？', '我该怎么调整生活方式？'];

  const reportColumns = [
    {
      title: 'Report ID',
      dataIndex: 'report_id',
      key: 'report_id',
      width: 190,
    },
    {
      title: 'Risk',
      dataIndex: 'risk_light',
      key: 'risk_light',
      width: 110,
      render: (risk: PatientReportListItem['risk_light']) => riskLightBadge(risk),
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      render: (text: string) => <span>{text.length > 70 ? `${text.slice(0, 70)}...` : text}</span>,
    },
    {
      title: 'Follow-up',
      dataIndex: 'followup_due_at',
      key: 'followup_due_at',
      width: 130,
      render: (value: string | null) => toDateText(value),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: (value: string) => toDateText(value),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_: unknown, row: PatientReportListItem) => (
        <Button onClick={() => navigate(`/patient-dashboard?patientId=${encodeURIComponent(patientId)}&reportId=${encodeURIComponent(row.report_id)}`)}>
          Open
        </Button>
      ),
    },
  ];

  const renderReportDetail = () => (
    <Card
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-cyan-600" />
          <span>当前报告详情</span>
        </div>
      }
      className="shadow-sm"
      extra={<Tag color="blue">{toDateText(new Date().toISOString())}</Tag>}
    >
      {loadingReport && <Alert type="info" showIcon message="正在加载后端报告数据..." className="mb-4" />}

      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg mb-2 flex items-center gap-2">
            <SafetyOutlined className="text-blue-600" />
            报告摘要
          </h3>
          <p className="text-base text-gray-700 leading-relaxed m-0 whitespace-pre-wrap break-words">
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
          <p className="m-0 text-gray-700 whitespace-pre-wrap break-words">{report?.recommendation || '暂无建议'}</p>
        </div>

        <Button type="primary" size="large" block icon={<FileTextOutlined />} onClick={downloadCurrentReport}>
          Download Report (TXT)
        </Button>
      </div>
    </Card>
  );

  const renderFollowupPanel = () => (
    <Card
      title={
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-cyan-600" />
          <span>复查与随访</span>
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
                <p className="m-0">报告已同步</p>
                <p className="text-xs text-gray-500 m-0">{reportId}</p>
              </div>
            ),
          },
          {
            dot: <ClockCircleOutlined className="text-blue-500" />,
            color: 'blue',
            children: (
              <div>
                <p className="m-0">下次复查时间</p>
                <p className="text-xs text-gray-500 m-0">{toDateText(report?.followup_due_at)}</p>
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
          size={90}
          format={() => `${followupDays}d`}
          strokeColor="#0891b2"
        />
        <p className="text-sm text-gray-500 mt-2">距离下次复查</p>
      </div>
    </Card>
  );

  const renderChatPanel = () => (
    <div className="space-y-6">
      <Card
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageOutlined className="text-cyan-600" />
              <span>Doctor Messages</span>
            </div>
          </div>
        }
        className="shadow-sm"
        extra={
          <Button size="small" onClick={() => void loadDoctorMessages()} loading={loadingDoctorMessages}>
            Refresh
          </Button>
        }
      >
        <List
          loading={loadingDoctorMessages}
          dataSource={doctorMessages}
          locale={{ emptyText: '暂无医生消息' }}
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

      <Card
        title={
          <div className="flex items-center gap-2">
            <RobotOutlined className="text-cyan-600" />
            <span>AI 健康助手</span>
          </div>
        }
        className="shadow-sm"
      >
        <div className="h-80 overflow-y-auto mb-4 space-y-3">
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

        <div className="mb-3 grid grid-cols-1 gap-2">
          {quickReplyButtons.map((btn, idx) => (
            <Button key={idx} disabled={chatLoading} onClick={() => void handleSendMessage(btn)} className="text-left">
              {btn}
            </Button>
          ))}
        </div>

        <Space.Compact className="w-full">
          <Input
            placeholder="输入你的问题..."
            value={inputMessage}
            disabled={chatLoading}
            onChange={(e) => setInputMessage(e.target.value)}
            onPressEnter={() => void handleSendMessage()}
          />
          <Button type="primary" icon={<SendOutlined />} loading={chatLoading} onClick={() => void handleSendMessage()} />
        </Space.Compact>

        <p className="text-xs text-gray-400 mt-2 text-center">AI 内容仅供健康管理参考，不替代医生诊断</p>
      </Card>
    </div>
  );

  const renderSection = () => {
    if (selectedMenu === 'dashboard') {
      return (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-6">
            <Card className="bg-gradient-to-r from-cyan-500 to-teal-500 border-0 shadow-lg">
              <div className="flex items-center justify-between text-white">
                <div>
                  <h2 className="text-3xl m-0 mb-2">欢迎回来，{patientId}</h2>
                  <p className="text-lg text-cyan-50 m-0">当前报告：{reportId}</p>
                </div>
                <HeartOutlined className="text-7xl opacity-20" />
              </div>
            </Card>

            {renderReportDetail()}
          </div>

          <div className="col-span-4 space-y-6">
            <Card className="shadow-sm">
              <Statistic title="我的报告数" value={reportList.length} />
              <Divider className="my-4" />
              <Statistic title="风险等级" value={riskTag.text} valueStyle={{ color: riskTag.color }} />
            </Card>
            {renderFollowupPanel()}
          </div>
        </div>
      );
    }

    if (selectedMenu === 'reports') {
      return (
        <div className="space-y-6">
          <Card
            title="历史报告列表"
            className="shadow-sm"
            extra={<Button onClick={() => void loadReportList()} loading={loadingReportList}>刷新</Button>}
          >
            <Table
              rowKey="report_id"
              columns={reportColumns}
              dataSource={reportList}
              loading={loadingReportList}
              pagination={{ pageSize: 8, showTotal: (total) => `Total ${total} reports` }}
            />
          </Card>

          {renderReportDetail()}
        </div>
      );
    }

    if (selectedMenu === 'appointments') {
      return (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-6">{renderFollowupPanel()}</div>
          <div className="col-span-6">
            <Card title="执行建议" className="shadow-sm">
              <List
                dataSource={[
                  '按医生建议在复查日期前后 1 周内完成低剂量 CT。',
                  '若出现咳血、胸痛、持续气促等症状，提前就医。',
                  '保留本次报告编号，复诊时给医生查看。',
                ]}
                renderItem={(item) => <List.Item>{item}</List.Item>}
              />
            </Card>
          </div>
        </div>
      );
    }

    return <div className="max-w-[900px]">{renderChatPanel()}</div>;
  };

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
            onClick={(e) => setSelectedMenu(e.key as MenuKey)}
            className="border-0"
            items={[
              { key: 'dashboard', icon: <HomeOutlined />, label: 'Dashboard' },
              { key: 'reports', icon: <FileTextOutlined />, label: 'My Reports' },
              { key: 'appointments', icon: <CalendarOutlined />, label: 'Appointments' },
              { key: 'messages', icon: <MessageOutlined />, label: 'Messages' },
            ]}
          />

          <Divider />

          <Card size="small" className="bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200">
            <div className="text-center">
              <Avatar size={64} icon={<UserOutlined />} className="bg-cyan-500 mb-2" />
              <p className="m-0">{patientId}</p>
              <p className="text-xs text-gray-500 m-0">Current Report: {reportId}</p>
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
      </Sider>

      <Layout>
        <Header className="bg-white shadow-sm px-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl m-0">{headerMap[selectedMenu].title}</h1>
            <p className="text-sm text-gray-500 m-0">{headerMap[selectedMenu].desc}</p>
          </div>
          <Tag color={riskTag.color} className="px-4 py-1">
            <CheckCircleOutlined className="mr-1" />
            Risk: {riskTag.text}
          </Tag>
        </Header>

        <Content className="p-6 bg-gray-50">
          <div className="max-w-[1600px] mx-auto">{renderSection()}</div>
        </Content>
      </Layout>
    </Layout>
  );
}

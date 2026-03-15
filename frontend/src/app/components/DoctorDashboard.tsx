import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Input,
  Layout,
  List,
  Menu,
  Modal,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  message,
} from 'antd';
import {
  CalendarOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  LogoutOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  BACKEND_BASE_URL,
  listDoctorFollowups,
  listDoctorPatients,
  listDoctorReports,
  type DoctorReportItem,
  type FollowupItem,
  type PatientTriageItem,
} from '../services/api';
import { clearSession, getUsername } from '../services/session';

const { Header, Sider, Content } = Layout;
const { Search } = Input;

type MenuKey = 'dashboard' | 'patients' | 'reports' | 'calendar' | 'ai-lab' | 'settings';

interface PatientRecord {
  key: string;
  id: string;
  name: string;
  lastVisit: string;
  aiSummary: string;
  status: 'awaiting-ct' | 'ai-analyzed' | 'report-sent' | 'follow-up';
  riskLevel: 'low' | 'medium' | 'high';
  rawRiskScore: number;
}

function mapStatus(reportStatus: PatientTriageItem['report_status']): PatientRecord['status'] {
  if (reportStatus === 'PUBLISHED') return 'report-sent';
  if (reportStatus === 'DRAFT') return 'ai-analyzed';
  return 'awaiting-ct';
}

function mapRiskLevel(riskLevel: PatientTriageItem['latest_risk_level']): PatientRecord['riskLevel'] {
  if (riskLevel === 'HIGH') return 'high';
  if (riskLevel === 'MEDIUM') return 'medium';
  return 'low';
}

function toPatientRecord(item: PatientTriageItem): PatientRecord {
  return {
    key: item.patient_id,
    id: item.patient_id,
    name: item.name_masked,
    lastVisit: new Date().toLocaleDateString('zh-CN'),
    aiSummary: `风险分值 ${item.latest_risk_score.toFixed(2)}，最大结节 ${item.largest_nodule_mm.toFixed(1)} mm`,
    status: mapStatus(item.report_status),
    riskLevel: mapRiskLevel(item.latest_risk_level),
    rawRiskScore: item.latest_risk_score,
  };
}

function riskLightTag(riskLight: DoctorReportItem['risk_light'] | FollowupItem['risk_light']) {
  if (riskLight === 'RED') return <Tag color="red">HIGH</Tag>;
  if (riskLight === 'YELLOW') return <Tag color="orange">MEDIUM</Tag>;
  return <Tag color="green">LOW</Tag>;
}

function daysUntil(dateText: string): number {
  const now = new Date();
  const target = new Date(dateText);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function DoctorDashboard() {
  const navigate = useNavigate();

  const [selectedMenu, setSelectedMenu] = useState<MenuKey>('patients');
  const [searchText, setSearchText] = useState('');
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [reports, setReports] = useState<DoctorReportItem[]>([]);
  const [followups, setFollowups] = useState<FollowupItem[]>([]);

  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingFollowups, setLoadingFollowups] = useState(false);
  const [refreshingRuntime, setRefreshingRuntime] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');

  const [backendHealth, setBackendHealth] = useState<{ app_env: string; ai_engine_base_url: string } | null>(null);
  const [aiRuntime, setAiRuntime] = useState<{ provider?: string; resolved_device?: string; bundle_ready?: boolean } | null>(
    null
  );

  const doctorName = useMemo(() => getUsername() || 'doctor_demo', []);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const data = await listDoctorPatients();
      setPatients(data.map(toPatientRecord));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载患者列表失败');
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const data = await listDoctorReports();
      setReports(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载报告列表失败');
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchFollowups = async () => {
    setLoadingFollowups(true);
    try {
      const data = await listDoctorFollowups(365);
      setFollowups(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载随访列表失败');
    } finally {
      setLoadingFollowups(false);
    }
  };

  const fetchRuntimeInfo = async () => {
    setRefreshingRuntime(true);
    try {
      const beResp = await fetch(`${BACKEND_BASE_URL}/api/v1/health`);
      const bePayload = (await beResp.json()) as { data?: { app_env: string; ai_engine_base_url: string } };
      if (!bePayload.data) {
        throw new Error('后端健康检查返回异常');
      }
      setBackendHealth(bePayload.data);

      const aiResp = await fetch(`${bePayload.data.ai_engine_base_url}/health`);
      const aiPayload = (await aiResp.json()) as { data?: { runtime?: { provider?: string; resolved_device?: string; bundle_ready?: boolean } } };
      setAiRuntime(aiPayload.data?.runtime || null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取运行时信息失败');
    } finally {
      setRefreshingRuntime(false);
    }
  };

  useEffect(() => {
    void Promise.all([fetchPatients(), fetchReports(), fetchFollowups(), fetchRuntimeInfo()]);
  }, []);

  const refreshCurrentSection = () => {
    if (selectedMenu === 'patients' || selectedMenu === 'dashboard') {
      void fetchPatients();
      return;
    }
    if (selectedMenu === 'reports') {
      void fetchReports();
      return;
    }
    if (selectedMenu === 'calendar') {
      void fetchFollowups();
      return;
    }
    void fetchRuntimeInfo();
  };

  const getStatusTag = (status: PatientRecord['status']) => {
    const statusMap = {
      'awaiting-ct': { color: 'orange', text: 'Awaiting CT' },
      'ai-analyzed': { color: 'blue', text: 'AI Analyzed' },
      'report-sent': { color: 'green', text: 'Report Sent' },
      'follow-up': { color: 'purple', text: 'Follow-up' },
    };
    const statusInfo = statusMap[status];
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  const getRiskTag = (risk: PatientRecord['riskLevel']) => {
    const riskMap = {
      low: { color: 'green', text: 'Low Risk' },
      medium: { color: 'orange', text: 'Medium Risk' },
      high: { color: 'red', text: 'High Risk' },
    };
    const riskInfo = riskMap[risk];
    return <Tag color={riskInfo.color}>{riskInfo.text}</Tag>;
  };

  const filteredPatients = patients.filter((patient) => {
    const q = searchText.toLowerCase();
    return patient.name.toLowerCase().includes(q) || patient.id.toLowerCase().includes(q) || patient.aiSummary.toLowerCase().includes(q);
  });

  const aiAnalyzedCount = patients.filter((p) => p.status === 'ai-analyzed').length;
  const reportsSentCount = patients.filter((p) => p.status === 'report-sent').length;

  const headerMap: Record<MenuKey, { title: string; desc: string }> = {
    dashboard: { title: 'Dashboard', desc: 'System overview and key indicators' },
    patients: { title: 'Patient Directory', desc: 'Manage and review patient cases' },
    reports: { title: 'Reports Center', desc: 'Browse published reports' },
    calendar: { title: 'Follow-up Calendar', desc: 'Upcoming follow-up timeline' },
    'ai-lab': { title: 'AI Lab', desc: 'AI runtime and service status' },
    settings: { title: 'Settings', desc: 'Portal and integration settings' },
  };

  const patientColumns = [
    {
      title: 'Patient ID',
      dataIndex: 'id',
      key: 'id',
      width: 140,
    },
    {
      title: 'Patient Name',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (text: string, record: PatientRecord) => (
        <Space>
          <Avatar icon={<UserOutlined />} className="bg-cyan-500" />
          <div>
            <div>{text}</div>
            <div className="text-xs text-gray-500">风险分值：{record.rawRiskScore.toFixed(2)}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Last Visit',
      dataIndex: 'lastVisit',
      key: 'lastVisit',
      width: 140,
    },
    {
      title: 'AI Brief Summary',
      dataIndex: 'aiSummary',
      key: 'aiSummary',
      render: (text: string, record: PatientRecord) => (
        <div>
          <div className="text-sm">{text}</div>
          <div className="mt-1">{getRiskTag(record.riskLevel)}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: PatientRecord['status']) => getStatusTag(status),
    },
    {
      title: 'Action',
      key: 'action',
      width: 180,
      render: (_: unknown, record: PatientRecord) => (
        <Button type="primary" icon={<FolderOpenOutlined />} onClick={() => navigate(`/doctor-workspace?patientId=${encodeURIComponent(record.id)}`)}>
          Open Workspace
        </Button>
      ),
    },
  ];

  const reportColumns = [
    {
      title: 'Report ID',
      dataIndex: 'report_id',
      key: 'report_id',
      width: 170,
    },
    {
      title: 'Patient',
      dataIndex: 'patient_id',
      key: 'patient_id',
      width: 120,
    },
    {
      title: 'Risk',
      dataIndex: 'risk_light',
      key: 'risk_light',
      width: 100,
      render: (risk: DoctorReportItem['risk_light']) => riskLightTag(risk),
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      render: (text: string) => <span>{text.length > 60 ? `${text.slice(0, 60)}...` : text}</span>,
    },
    {
      title: 'Follow-up',
      dataIndex: 'followup_due_at',
      key: 'followup_due_at',
      width: 130,
      render: (dateText: string | null) => (dateText ? new Date(dateText).toLocaleDateString('zh-CN') : '-'),
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      render: (_: unknown, record: DoctorReportItem) => (
        <Button onClick={() => navigate(`/patient-dashboard?patientId=${encodeURIComponent(record.patient_id)}&reportId=${encodeURIComponent(record.report_id)}`)}>
          View Report
        </Button>
      ),
    },
  ];

  const renderSection = () => {
    if (selectedMenu === 'dashboard') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <Card className="shadow-sm bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <Statistic title="Total Patients" value={patients.length} valueStyle={{ color: '#1e40af', fontSize: '36px' }} />
            </Card>
            <Card className="shadow-sm bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
              <Statistic title="Pending AI Review" value={aiAnalyzedCount} valueStyle={{ color: '#ea580c', fontSize: '36px' }} />
            </Card>
            <Card className="shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <Statistic title="Reports Sent" value={reportsSentCount} valueStyle={{ color: '#16a34a', fontSize: '36px' }} />
            </Card>
          </div>
          <Card title="Top Risk Patients" className="shadow-sm">
            <Table columns={patientColumns} dataSource={filteredPatients.slice(0, 5)} loading={loadingPatients} pagination={false} />
          </Card>
        </div>
      );
    }

    if (selectedMenu === 'patients') {
      return (
        <Card
          className="shadow-sm"
          title={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TeamOutlined className="text-cyan-600" />
                <span>All Patients</span>
              </div>
              <Search
                placeholder="Search patients..."
                allowClear
                style={{ width: 320 }}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<SearchOutlined />}
              />
            </div>
          }
          extra={
            <Space>
              <Button icon={<UserAddOutlined />} type="primary" onClick={() => setCreateModalOpen(true)}>
                Add Patient
              </Button>
              <Button type="default" icon={<ReloadOutlined />} loading={loadingPatients} onClick={() => void fetchPatients()}>
                Refresh
              </Button>
            </Space>
          }
        >
          <Table
            columns={patientColumns}
            dataSource={filteredPatients}
            loading={loadingPatients}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} patients` }}
          />
        </Card>
      );
    }

    if (selectedMenu === 'reports') {
      return (
        <Card
          title="Published Reports"
          className="shadow-sm"
          extra={<Button icon={<ReloadOutlined />} loading={loadingReports} onClick={() => void fetchReports()}>Refresh</Button>}
        >
          <Table
            rowKey="report_id"
            columns={reportColumns}
            dataSource={reports}
            loading={loadingReports}
            pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} reports` }}
          />
        </Card>
      );
    }

    if (selectedMenu === 'calendar') {
      return (
        <Card
          title="Upcoming Follow-ups"
          className="shadow-sm"
          extra={<Button icon={<ReloadOutlined />} loading={loadingFollowups} onClick={() => void fetchFollowups()}>Refresh</Button>}
        >
          <List
            loading={loadingFollowups}
            dataSource={followups}
            locale={{ emptyText: 'No follow-up tasks within 365 days.' }}
            renderItem={(item) => {
              const dueDays = daysUntil(item.followup_due_at);
              return (
                <List.Item
                  actions={[
                    <Button
                      key="open"
                      onClick={() => navigate(`/patient-dashboard?patientId=${encodeURIComponent(item.patient_id)}&reportId=${encodeURIComponent(item.report_id)}`)}
                    >
                      Open
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<CalendarOutlined className="text-cyan-600" />}
                    title={
                      <Space>
                        <span>{item.patient_id}</span>
                        <span className="text-gray-400">{item.report_id}</span>
                        {riskLightTag(item.risk_light)}
                      </Space>
                    }
                    description={
                      <div>
                        <div>{item.summary}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Due: {new Date(item.followup_due_at).toLocaleDateString('zh-CN')} ({dueDays >= 0 ? `in ${dueDays} days` : `${-dueDays} days overdue`})
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Card>
      );
    }

    if (selectedMenu === 'ai-lab') {
      return (
        <Card
          title="AI Runtime"
          className="shadow-sm"
          extra={<Button icon={<ReloadOutlined />} loading={refreshingRuntime} onClick={() => void fetchRuntimeInfo()}>Refresh</Button>}
        >
          {!backendHealth && !aiRuntime && <Alert type="warning" message="Runtime info unavailable" showIcon />}
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Backend API">{BACKEND_BASE_URL}</Descriptions.Item>
            <Descriptions.Item label="Backend Env">{backendHealth?.app_env || '-'}</Descriptions.Item>
            <Descriptions.Item label="AI Engine URL">{backendHealth?.ai_engine_base_url || '-'}</Descriptions.Item>
            <Descriptions.Item label="AI Provider">{aiRuntime?.provider || '-'}</Descriptions.Item>
            <Descriptions.Item label="AI Device">{aiRuntime?.resolved_device || '-'}</Descriptions.Item>
            <Descriptions.Item label="Bundle Ready">{String(aiRuntime?.bundle_ready ?? '-')}</Descriptions.Item>
          </Descriptions>
        </Card>
      );
    }

    return (
      <Card title="Settings" className="shadow-sm">
        <List
          dataSource={[
            `Backend: ${BACKEND_BASE_URL}`,
            `Doctor: ${doctorName}`,
            'Tip: use Add Patient to quickly open a new workspace.',
            'Tip: Reports and Calendar are now backed by persistent database data.',
          ]}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </Card>
    );
  };

  return (
    <Layout className="min-h-screen">
      <Sider width={260} className="bg-white shadow-lg">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
              <RobotOutlined className="text-white text-2xl" />
            </div>
            <div>
              <h2 className="text-lg m-0">Medical AI</h2>
              <p className="text-xs text-gray-500 m-0">Doctor Portal</p>
            </div>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[selectedMenu]}
            onClick={(e) => setSelectedMenu(e.key as MenuKey)}
            className="border-0"
            items={[
              { key: 'dashboard', icon: <HomeOutlined />, label: 'Dashboard' },
              { key: 'patients', icon: <TeamOutlined />, label: 'Patient Directory' },
              { key: 'reports', icon: <FileTextOutlined />, label: 'Reports' },
              { key: 'calendar', icon: <CalendarOutlined />, label: 'Calendar' },
              { key: 'ai-lab', icon: <ExperimentOutlined />, label: 'AI Lab' },
              { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
            ]}
          />

          <Divider />

          <Card size="small" className="bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200">
            <div className="text-center">
              <Avatar size={64} icon={<UserOutlined />} className="bg-cyan-500 mb-2" />
              <p className="m-0">{doctorName}</p>
              <p className="text-xs text-gray-500 m-0">Pulmonology</p>
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
          <Space size="large">
            <Badge count={patients.filter((p) => p.riskLevel === 'high').length} offset={[-5, 5]}>
              <Avatar size="large" icon={<UserOutlined />} className="bg-cyan-500" />
            </Badge>
            <span className="text-base">{doctorName}</span>
            <Button icon={<ReloadOutlined />} onClick={refreshCurrentSection}>
              Refresh Current
            </Button>
          </Space>
        </Header>

        <Content className="p-6 bg-gray-50">
          <div className="max-w-[1600px] mx-auto">{renderSection()}</div>
        </Content>
      </Layout>

      <Modal
        title="Add Patient"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => {
          const id = newPatientId.trim();
          if (!id) {
            message.warning('请输入患者 ID');
            return;
          }
          setCreateModalOpen(false);
          setNewPatientId('');
          navigate(`/doctor-workspace?patientId=${encodeURIComponent(id)}`);
        }}
      >
        <Input
          placeholder="例如 P10020"
          value={newPatientId}
          onChange={(e) => setNewPatientId(e.target.value)}
          onPressEnter={() => {
            const id = newPatientId.trim();
            if (id) {
              setCreateModalOpen(false);
              setNewPatientId('');
              navigate(`/doctor-workspace?patientId=${encodeURIComponent(id)}`);
            }
          }}
        />
      </Modal>
    </Layout>
  );
}

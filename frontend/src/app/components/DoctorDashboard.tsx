import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Layout,
  Card,
  Table,
  Button,
  Tag,
  Space,
  Avatar,
  Badge,
  Menu,
  Statistic,
  Input,
  Divider,
  message,
} from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  FileTextOutlined,
  CalendarOutlined,
  SettingOutlined,
  LogoutOutlined,
  RobotOutlined,
  SearchOutlined,
  TeamOutlined,
  ExperimentOutlined,
  SendOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { listDoctorPatients, type PatientTriageItem } from '../services/api';
import { clearSession, getUsername } from '../services/session';

const { Header, Sider, Content } = Layout;
const { Search } = Input;

interface PatientRecord {
  key: string;
  id: string;
  name: string;
  lastVisit: string;
  aiSummary: string;
  status: 'awaiting-ct' | 'ai-analyzed' | 'report-sent' | 'follow-up';
  riskLevel: 'low' | 'medium' | 'high';
  rawRiskScore: number;
  largestNoduleMm: number;
}

function mapStatus(reportStatus: PatientTriageItem['report_status']): PatientRecord['status'] {
  if (reportStatus === 'PUBLISHED') {
    return 'report-sent';
  }
  if (reportStatus === 'DRAFT') {
    return 'ai-analyzed';
  }
  return 'awaiting-ct';
}

function mapRiskLevel(riskLevel: PatientTriageItem['latest_risk_level']): PatientRecord['riskLevel'] {
  if (riskLevel === 'HIGH') {
    return 'high';
  }
  if (riskLevel === 'MEDIUM') {
    return 'medium';
  }
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
    largestNoduleMm: item.largest_nodule_mm,
  };
}

export function DoctorDashboard() {
  const navigate = useNavigate();
  const [selectedMenu, setSelectedMenu] = useState('patients');
  const [searchText, setSearchText] = useState('');
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const doctorName = useMemo(() => getUsername() || 'doctor-demo', []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await listDoctorPatients();
      setPatients(data.map(toPatientRecord));
    } catch (error) {
      const detail = error instanceof Error ? error.message : '加载患者列表失败';
      message.error(detail);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPatients();
  }, []);

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

  const columns = [
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
        <Button
          type="primary"
          icon={<FolderOpenOutlined />}
          onClick={() => navigate(`/doctor-workspace?patientId=${encodeURIComponent(record.id)}`)}
        >
          Open Workspace
        </Button>
      ),
    },
  ];

  const filteredData = patients.filter((patient) =>
    patient.name.toLowerCase().includes(searchText.toLowerCase()) ||
    patient.id.toLowerCase().includes(searchText.toLowerCase()) ||
    patient.aiSummary.toLowerCase().includes(searchText.toLowerCase())
  );

  const aiAnalyzedCount = patients.filter((p) => p.status === 'ai-analyzed').length;
  const reportsSentCount = patients.filter((p) => p.status === 'report-sent').length;

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
            onClick={(e) => setSelectedMenu(e.key)}
            className="border-0"
            items={[
              {
                key: 'dashboard',
                icon: <HomeOutlined />,
                label: 'Dashboard',
              },
              {
                key: 'patients',
                icon: <TeamOutlined />,
                label: 'Patient Directory',
              },
              {
                key: 'reports',
                icon: <FileTextOutlined />,
                label: 'Reports',
              },
              {
                key: 'calendar',
                icon: <CalendarOutlined />,
                label: 'Calendar',
              },
              {
                key: 'ai-lab',
                icon: <ExperimentOutlined />,
                label: 'AI Lab',
              },
              {
                key: 'settings',
                icon: <SettingOutlined />,
                label: 'Settings',
              },
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
            <h1 className="text-2xl m-0">Patient Directory</h1>
            <p className="text-sm text-gray-500 m-0">Manage and review your patient cases</p>
          </div>
          <Space size="large">
            <Badge count={5} offset={[-5, 5]}>
              <Avatar size="large" icon={<UserOutlined />} className="bg-cyan-500" />
            </Badge>
            <span className="text-base">{doctorName}</span>
          </Space>
        </Header>

        <Content className="p-6 bg-gray-50">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <Card className="shadow-sm bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                <Statistic
                  title={
                    <div className="flex items-center gap-2 text-base">
                      <TeamOutlined className="text-blue-600" />
                      <span>Total Patients</span>
                    </div>
                  }
                  value={patients.length}
                  valueStyle={{ color: '#1e40af', fontSize: '36px' }}
                  suffix={<span className="text-sm text-gray-500">active cases</span>}
                />
              </Card>

              <Card className="shadow-sm bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                <Statistic
                  title={
                    <div className="flex items-center gap-2 text-base">
                      <ExperimentOutlined className="text-orange-600" />
                      <span>Pending AI Review</span>
                    </div>
                  }
                  value={aiAnalyzedCount}
                  valueStyle={{ color: '#ea580c', fontSize: '36px' }}
                  suffix={<span className="text-sm text-gray-500">awaiting review</span>}
                />
              </Card>

              <Card className="shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <Statistic
                  title={
                    <div className="flex items-center gap-2 text-base">
                      <SendOutlined className="text-green-600" />
                      <span>Reports Sent</span>
                    </div>
                  }
                  value={reportsSentCount}
                  valueStyle={{ color: '#16a34a', fontSize: '36px' }}
                  suffix={<span className="text-sm text-gray-500">this month</span>}
                />
              </Card>
            </div>

            <Card
              title={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamOutlined className="text-cyan-600" />
                    <span>All Patients</span>
                  </div>
                  <Search
                    placeholder="Search patients..."
                    allowClear
                    style={{ width: 300 }}
                    onChange={(e) => setSearchText(e.target.value)}
                    prefix={<SearchOutlined />}
                  />
                </div>
              }
              className="shadow-sm"
              extra={
                <Button type="default" icon={<ReloadOutlined />} loading={loading} onClick={() => void fetchPatients()}>
                  Refresh
                </Button>
              }
            >
              <Table
                columns={columns}
                dataSource={filteredData}
                loading={loading}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} patients`,
                }}
                className="overflow-x-auto"
              />

              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 m-0">
                  <RobotOutlined className="mr-2" />
                  <strong>AI Insight:</strong> {aiAnalyzedCount} patients have AI-analyzed CT scans
                  awaiting your review and signature. High-risk cases are flagged in red.
                </p>
              </div>
            </Card>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

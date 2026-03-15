import { useState } from 'react';
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
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Search } = Input;

interface PatientRecord {
  key: string;
  id: string;
  name: string;
  age: number;
  gender: string;
  lastVisit: string;
  aiSummary: string;
  status: 'awaiting-ct' | 'ai-analyzed' | 'report-sent' | 'follow-up';
  riskLevel: 'low' | 'medium' | 'high';
}

const patientData: PatientRecord[] = [
  {
    key: '1',
    id: 'PT-2024-00123',
    name: 'John Smith',
    age: 58,
    gender: 'Male',
    lastVisit: 'March 15, 2026',
    aiSummary: 'Heavy smoker, 8.5mm nodule detected in right upper lobe',
    status: 'ai-analyzed',
    riskLevel: 'low',
  },
  {
    key: '2',
    id: 'PT-2024-00124',
    name: 'Mary Johnson',
    age: 62,
    gender: 'Female',
    lastVisit: 'March 14, 2026',
    aiSummary: 'Former smoker, multiple small nodules <5mm bilateral',
    status: 'report-sent',
    riskLevel: 'low',
  },
  {
    key: '3',
    id: 'PT-2024-00125',
    name: 'Robert Chen',
    age: 71,
    gender: 'Male',
    lastVisit: 'March 13, 2026',
    aiSummary: '12mm spiculated nodule left lower lobe, requires urgent review',
    status: 'ai-analyzed',
    riskLevel: 'high',
  },
  {
    key: '4',
    id: 'PT-2024-00126',
    name: 'Sarah Williams',
    age: 45,
    gender: 'Female',
    lastVisit: 'March 12, 2026',
    aiSummary: 'Non-smoker, incidental 6mm ground-glass opacity',
    status: 'awaiting-ct',
    riskLevel: 'low',
  },
  {
    key: '5',
    id: 'PT-2024-00127',
    name: 'Michael Brown',
    age: 67,
    gender: 'Male',
    lastVisit: 'March 11, 2026',
    aiSummary: 'COPD patient, stable 9mm nodule unchanged from 2025',
    status: 'follow-up',
    riskLevel: 'medium',
  },
  {
    key: '6',
    id: 'PT-2024-00128',
    name: 'Linda Garcia',
    age: 53,
    gender: 'Female',
    lastVisit: 'March 10, 2026',
    aiSummary: 'Family history lung cancer, no nodules detected',
    status: 'report-sent',
    riskLevel: 'low',
  },
  {
    key: '7',
    id: 'PT-2024-00129',
    name: 'James Wilson',
    age: 69,
    gender: 'Male',
    lastVisit: 'March 9, 2026',
    aiSummary: 'Current smoker, 7.2mm solid nodule right middle lobe',
    status: 'ai-analyzed',
    riskLevel: 'medium',
  },
  {
    key: '8',
    id: 'PT-2024-00130',
    name: 'Patricia Martinez',
    age: 56,
    gender: 'Female',
    lastVisit: 'March 8, 2026',
    aiSummary: 'Post-treatment surveillance, no new findings',
    status: 'report-sent',
    riskLevel: 'low',
  },
];

export function DoctorDashboard() {
  const navigate = useNavigate();
  const [selectedMenu, setSelectedMenu] = useState('patients');
  const [searchText, setSearchText] = useState('');

  const getStatusTag = (status: string) => {
    const statusMap = {
      'awaiting-ct': { color: 'orange', text: 'Awaiting CT' },
      'ai-analyzed': { color: 'blue', text: 'AI Analyzed' },
      'report-sent': { color: 'green', text: 'Report Sent' },
      'follow-up': { color: 'purple', text: 'Follow-up' },
    };
    const statusInfo = statusMap[status as keyof typeof statusMap];
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  const getRiskTag = (risk: string) => {
    const riskMap = {
      low: { color: 'green', text: 'Low Risk' },
      medium: { color: 'orange', text: 'Medium Risk' },
      high: { color: 'red', text: 'High Risk' },
    };
    const riskInfo = riskMap[risk as keyof typeof riskMap];
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
            <div className="text-xs text-gray-500">
              {record.age}y, {record.gender}
            </div>
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
      render: (status: string) => getStatusTag(status),
    },
    {
      title: 'Action',
      key: 'action',
      width: 180,
      render: (_: any, record: PatientRecord) => (
        <Button
          type="primary"
          icon={<FolderOpenOutlined />}
          onClick={() => navigate(`/doctor-workspace?patientId=${record.id}`)}
        >
          Open Workspace
        </Button>
      ),
    },
  ];

  const filteredData = patientData.filter((patient) =>
    patient.name.toLowerCase().includes(searchText.toLowerCase()) ||
    patient.id.toLowerCase().includes(searchText.toLowerCase()) ||
    patient.aiSummary.toLowerCase().includes(searchText.toLowerCase())
  );

  const aiAnalyzedCount = patientData.filter((p) => p.status === 'ai-analyzed').length;
  const reportsSentCount = patientData.filter((p) => p.status === 'report-sent').length;

  return (
    <Layout className="min-h-screen">
      {/* Left Sidebar */}
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
              <p className="m-0">Dr. Sarah Johnson</p>
              <p className="text-xs text-gray-500 m-0">Pulmonology</p>
              <Button
                size="small"
                icon={<LogoutOutlined />}
                onClick={() => navigate('/')}
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
        {/* Header */}
        <Header className="bg-white shadow-sm px-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl m-0">Patient Directory</h1>
            <p className="text-sm text-gray-500 m-0">Manage and review your patient cases</p>
          </div>
          <Space size="large">
            <Badge count={5} offset={[-5, 5]}>
              <Avatar size="large" icon={<UserOutlined />} className="bg-cyan-500" />
            </Badge>
            <span className="text-base">Dr. Sarah Johnson</span>
          </Space>
        </Header>

        <Content className="p-6 bg-gray-50">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {/* Summary Metric Cards */}
            <div className="grid grid-cols-3 gap-6">
              <Card className="shadow-sm bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                <Statistic
                  title={
                    <div className="flex items-center gap-2 text-base">
                      <TeamOutlined className="text-blue-600" />
                      <span>Total Patients</span>
                    </div>
                  }
                  value={patientData.length}
                  valueStyle={{ color: '#1e40af', fontSize: '36px' }}
                  suffix={
                    <span className="text-sm text-gray-500">active cases</span>
                  }
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
                  suffix={
                    <span className="text-sm text-gray-500">awaiting review</span>
                  }
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
                  suffix={
                    <span className="text-sm text-gray-500">this month</span>
                  }
                />
              </Card>
            </div>

            {/* Patient Directory Table */}
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
                <Space>
                  <Button type="primary" icon={<UserOutlined />}>
                    Add Patient
                  </Button>
                </Space>
              }
            >
              <Table
                columns={columns}
                dataSource={filteredData}
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

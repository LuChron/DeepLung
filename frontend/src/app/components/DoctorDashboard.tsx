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
  if (riskLight === 'RED') return <Tag color="red">高危</Tag>;
  if (riskLight === 'YELLOW') return <Tag color="orange">中危</Tag>;
  return <Tag color="green">低危</Tag>;
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
      const bePayload = (await beResp.json()) as {
        data?: {
          app_env: string;
          ai_engine_base_url: string;
          ai_runtime?: { provider?: string; resolved_device?: string; bundle_ready?: boolean } | null;
        };
      };
      if (!bePayload.data) {
        throw new Error('后端健康检查返回异常');
      }
      setBackendHealth(bePayload.data);
      setAiRuntime(bePayload.data.ai_runtime || null);
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
      'awaiting-ct': { color: 'orange', text: '待上传 CT' },
      'ai-analyzed': { color: 'blue', text: '已完成 AI 分析' },
      'report-sent': { color: 'green', text: '已发送报告' },
      'follow-up': { color: 'purple', text: '待随访' },
    };
    const statusInfo = statusMap[status];
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  const getRiskTag = (risk: PatientRecord['riskLevel']) => {
    const riskMap = {
      low: { color: 'green', text: '低风险' },
      medium: { color: 'orange', text: '中风险' },
      high: { color: 'red', text: '高风险' },
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
    dashboard: { title: '总览', desc: '系统概览与关键指标' },
    patients: { title: '患者管理', desc: '管理并查看患者病例' },
    reports: { title: '报告中心', desc: '浏览已发布报告' },
    calendar: { title: '随访日程', desc: '近期随访时间线' },
    'ai-lab': { title: 'AI 实验室', desc: 'AI 运行状态与服务信息' },
    settings: { title: '设置', desc: '门户与集成配置' },
  };

  const patientColumns = [
    {
      title: '患者 ID',
      dataIndex: 'id',
      key: 'id',
      width: 140,
    },
    {
      title: '患者姓名',
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
      title: '最近就诊',
      dataIndex: 'lastVisit',
      key: 'lastVisit',
      width: 140,
    },
    {
      title: 'AI 简要结论',
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: PatientRecord['status']) => getStatusTag(status),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: PatientRecord) => (
        <Button type="primary" icon={<FolderOpenOutlined />} onClick={() => navigate(`/doctor-workspace?patientId=${encodeURIComponent(record.id)}`)}>
          打开工作台
        </Button>
      ),
    },
  ];

  const reportColumns = [
    {
      title: '报告 ID',
      dataIndex: 'report_id',
      key: 'report_id',
      width: 170,
    },
    {
      title: '患者',
      dataIndex: 'patient_id',
      key: 'patient_id',
      width: 120,
    },
    {
      title: '风险',
      dataIndex: 'risk_light',
      key: 'risk_light',
      width: 100,
      render: (risk: DoctorReportItem['risk_light']) => riskLightTag(risk),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      key: 'summary',
      render: (text: string) => <span>{text.length > 60 ? `${text.slice(0, 60)}...` : text}</span>,
    },
    {
      title: '随访',
      dataIndex: 'followup_due_at',
      key: 'followup_due_at',
      width: 130,
      render: (dateText: string | null) => (dateText ? new Date(dateText).toLocaleDateString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: DoctorReportItem) => {
        const query = new URLSearchParams({
          patientId: record.patient_id,
          reportId: record.report_id,
        });
        if (record.study_id) {
          query.set('studyId', record.study_id);
        }
        return <Button onClick={() => navigate(`/doctor-workspace?${query.toString()}`)}>查看报告</Button>;
      },
    },
  ];

  const renderSection = () => {
    if (selectedMenu === 'dashboard') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <Card className="shadow-sm bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
              <Statistic title="患者总数" value={patients.length} valueStyle={{ color: '#1e40af', fontSize: '36px' }} />
            </Card>
            <Card className="shadow-sm bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
              <Statistic title="待医生复核" value={aiAnalyzedCount} valueStyle={{ color: '#ea580c', fontSize: '36px' }} />
            </Card>
            <Card className="shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <Statistic title="已发送报告" value={reportsSentCount} valueStyle={{ color: '#16a34a', fontSize: '36px' }} />
            </Card>
          </div>
          <Card title="高风险患者" className="shadow-sm">
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
                <span>全部患者</span>
              </div>
              <Search
                placeholder="搜索患者..."
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
                添加患者
              </Button>
              <Button type="default" icon={<ReloadOutlined />} loading={loadingPatients} onClick={() => void fetchPatients()}>
                刷新
              </Button>
            </Space>
          }
        >
          <Table
            columns={patientColumns}
            dataSource={filteredPatients}
            loading={loadingPatients}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 位患者` }}
          />
        </Card>
      );
    }

    if (selectedMenu === 'reports') {
      return (
        <Card
          title="已发布报告"
          className="shadow-sm"
          extra={<Button icon={<ReloadOutlined />} loading={loadingReports} onClick={() => void fetchReports()}>刷新</Button>}
        >
          <Table
            rowKey="report_id"
            columns={reportColumns}
            dataSource={reports}
            loading={loadingReports}
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 份报告` }}
          />
        </Card>
      );
    }

    if (selectedMenu === 'calendar') {
      return (
        <Card
          title="近期随访计划"
          className="shadow-sm"
          extra={<Button icon={<ReloadOutlined />} loading={loadingFollowups} onClick={() => void fetchFollowups()}>刷新</Button>}
        >
          <List
            loading={loadingFollowups}
            dataSource={followups}
            locale={{ emptyText: '未来 365 天内暂无随访任务。' }}
            renderItem={(item) => {
              const dueDays = daysUntil(item.followup_due_at);
              return (
                <List.Item
                  actions={[
                    (() => {
                      const query = new URLSearchParams({
                        patientId: item.patient_id,
                        reportId: item.report_id,
                      });
                      if (item.study_id) {
                        query.set('studyId', item.study_id);
                      }
                      return (
                        <Button key="open" onClick={() => navigate(`/doctor-workspace?${query.toString()}`)}>
                          打开
                        </Button>
                      );
                    })(),
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
                          到期：{new Date(item.followup_due_at).toLocaleDateString('zh-CN')}（{dueDays >= 0 ? `${dueDays} 天后` : `已逾期 ${-dueDays} 天`}）
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
          title="AI 运行状态"
          className="shadow-sm"
          extra={<Button icon={<ReloadOutlined />} loading={refreshingRuntime} onClick={() => void fetchRuntimeInfo()}>刷新</Button>}
        >
          {!backendHealth && !aiRuntime && <Alert type="warning" message="暂时无法获取运行时信息" showIcon />}
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="后端 API">{BACKEND_BASE_URL}</Descriptions.Item>
            <Descriptions.Item label="后端环境">{backendHealth?.app_env || '-'}</Descriptions.Item>
            <Descriptions.Item label="AI 引擎地址">{backendHealth?.ai_engine_base_url || '-'}</Descriptions.Item>
            <Descriptions.Item label="AI 提供方">{aiRuntime?.provider || '-'}</Descriptions.Item>
            <Descriptions.Item label="AI 设备">{aiRuntime?.resolved_device || '-'}</Descriptions.Item>
            <Descriptions.Item label="模型可用">{String(aiRuntime?.bundle_ready ?? '-')}</Descriptions.Item>
          </Descriptions>
        </Card>
      );
    }

    return (
      <Card title="系统设置" className="shadow-sm">
        <List
          dataSource={[
            `后端地址：${BACKEND_BASE_URL}`,
            `当前医生：${doctorName}`,
            '提示：可通过“添加患者”快速进入新工作台。',
            '提示：报告与随访数据已接入持久化数据库。',
          ]}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </Card>
    );
  };

  return (
    <Layout className="min-h-screen" style={{ minHeight: '100vh' }}>
      <Sider
        width={260}
        className="bg-white shadow-lg"
        style={{ background: '#00152f', boxShadow: '6px 0 18px rgba(0, 20, 48, 0.18)' }}
      >
        <div className="p-6" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
              <RobotOutlined className="text-white text-2xl" />
            </div>
            <div>
              <h2 className="text-lg m-0">医疗 AI</h2>
              <p className="text-xs text-gray-500 m-0">医生工作台</p>
            </div>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[selectedMenu]}
            onClick={(e) => setSelectedMenu(e.key as MenuKey)}
            className="border-0"
            items={[
              { key: 'dashboard', icon: <HomeOutlined />, label: '总览' },
              { key: 'patients', icon: <TeamOutlined />, label: '患者管理' },
              { key: 'reports', icon: <FileTextOutlined />, label: '报告中心' },
              { key: 'calendar', icon: <CalendarOutlined />, label: '随访日程' },
              { key: 'ai-lab', icon: <ExperimentOutlined />, label: 'AI 实验室' },
              { key: 'settings', icon: <SettingOutlined />, label: '设置' },
            ]}
          />

          <div style={{ marginTop: 'auto' }}>
            <Divider />
            <Card size="small" className="bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200">
              <div className="text-center">
                <Avatar size={64} icon={<UserOutlined />} className="bg-cyan-500 mb-2" />
                <p className="m-0">{doctorName}</p>
                <p className="text-xs text-gray-500 m-0">呼吸科</p>
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
                  退出登录
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </Sider>

      <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
        <Header
          className="bg-white shadow-sm px-8 flex items-center justify-between"
          style={{ background: '#001a3a', color: '#fff' }}
        >
          <div>
            <h1 className="text-2xl m-0" style={{ color: '#ffffff' }}>
              {headerMap[selectedMenu].title}
            </h1>
            <p className="text-sm text-gray-500 m-0" style={{ color: '#9ec5ff' }}>
              {headerMap[selectedMenu].desc}
            </p>
          </div>
          <Space size="large">
            <Badge count={patients.filter((p) => p.riskLevel === 'high').length} offset={[-5, 5]}>
              <Avatar size="large" icon={<UserOutlined />} className="bg-cyan-500" />
            </Badge>
            <span className="text-base" style={{ color: '#ffffff' }}>
              {doctorName}
            </span>
            <Button icon={<ReloadOutlined />} onClick={refreshCurrentSection}>
              刷新当前页面
            </Button>
          </Space>
        </Header>

        <Content className="p-6 bg-gray-50" style={{ background: '#f5f7fb', minHeight: 'calc(100vh - 64px)' }}>
          <div className="max-w-[1600px] mx-auto">{renderSection()}</div>
        </Content>
      </Layout>

      <Modal
        title="添加患者"
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

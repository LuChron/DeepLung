import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Layout,
  Card,
  Button,
  Upload,
  Statistic,
  Input,
  message,
  Avatar,
  Badge,
  Space,
  Divider,
  Breadcrumb,
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

const { Header, Content } = Layout;
const { TextArea } = Input;
const { Dragger } = Upload;

export function DoctorWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId') || 'PT-2024-00123';
  
  const [reportText, setReportText] = useState(`DIAGNOSTIC REPORT - LUNG CT SCAN ANALYSIS

Patient: John Smith (ID: ${patientId})
Date: March 15, 2026
Examination: High-Resolution Chest CT

FINDINGS:
AI-assisted analysis has identified a pulmonary nodule in the right lung.

Location: Right upper lobe, posterior segment
Size: 8.5 mm in maximum diameter
Morphology: Round, well-circumscribed
Density: Solid, non-calcified
Margins: Smooth and regular

IMPRESSION:
Single pulmonary nodule detected in the right upper lobe measuring 8.5mm.

RECOMMENDATION:
- Follow-up CT scan in 6 months to assess stability
- Consider PET scan if growth is observed
- Patient counseling regarding findings

This report has been generated with AI assistance and requires physician review and signature.`);

  const handleAutoGenerate = () => {
    message.success('AI Report Generated Successfully');
  };

  const handleSignAndSend = () => {
    message.success('Report signed and sent to patient');
    setTimeout(() => {
      navigate('/patient-dashboard');
    }, 1500);
  };

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.nii.gz,.nii,.dcm',
    beforeUpload: () => {
      message.info('CT Scan uploaded and processing...');
      return false;
    },
  };

  return (
    <Layout className="min-h-screen bg-gray-50">
      {/* Header */}
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
          <Badge count={3} offset={[-5, 5]}>
            <Avatar size="large" icon={<UserOutlined />} className="bg-cyan-500" />
          </Badge>
          <span className="text-base">Dr. Sarah Johnson</span>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => navigate('/')}
          >
            Logout
          </Button>
        </Space>
      </Header>

      <Content className="p-6">
        {/* Breadcrumb Navigation */}
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
                  title: `${patientId} - John Smith`,
                },
              ]}
            />
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/doctor-dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 max-w-[1800px] mx-auto">
          {/* LEFT COLUMN - Patient Info & Upload */}
          <div className="col-span-3 space-y-6">
            {/* Patient Info Card */}
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
                  <p className="text-xs text-gray-500 mb-1">Patient Name</p>
                  <p className="text-base">John Smith</p>
                </div>
                <Divider className="my-3" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Patient ID</p>
                  <p className="text-base">{patientId}</p>
                </div>
                <Divider className="my-3" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Age / Gender</p>
                  <p className="text-base">58 years / Male</p>
                </div>
                <Divider className="my-3" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Examination Date</p>
                  <p className="text-base">March 15, 2026</p>
                </div>
                <Divider className="my-3" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Referring Physician</p>
                  <p className="text-base">Dr. Michael Chen</p>
                </div>
              </div>
            </Card>

            {/* Upload Zone */}
            <Card
              title="CT Scan Upload"
              className="shadow-sm"
            >
              <Dragger {...uploadProps} className="bg-gradient-to-br from-cyan-50 to-teal-50">
                <p className="ant-upload-drag-icon">
                  <InboxOutlined className="text-cyan-600" />
                </p>
                <p className="ant-upload-text">Click or drag CT scan files</p>
                <p className="ant-upload-hint text-xs">
                  Supports .nii.gz, .nii, .dcm formats
                </p>
              </Dragger>
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircleOutlined />
                  <span className="text-sm">chest_ct_scan_2026.nii.gz</span>
                </div>
                <p className="text-xs text-green-600 mt-1 ml-6">Uploaded & Processed</p>
              </div>
            </Card>
          </div>

          {/* MIDDLE COLUMN - AI Vision */}
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
              {/* CT Scan Image with Bounding Box */}
              <div className="relative bg-black rounded-lg overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1581595219145-01060b2eb27d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwQ1QlMjBzY2FuJTIwbHVuZ3xlbnwxfHx8fDE3NzM1NzI3NDh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Lung CT Scan"
                  className="w-full h-auto"
                />
                {/* Red Bounding Box for Nodule Detection */}
                <div
                  className="absolute border-4 border-red-500 rounded-lg"
                  style={{
                    top: '28%',
                    right: '35%',
                    width: '120px',
                    height: '120px',
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)',
                  }}
                >
                  <div className="absolute -top-8 left-0 bg-red-500 text-white px-3 py-1 rounded text-sm whitespace-nowrap">
                    Nodule Detected
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <Card className="text-center bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
                  <Statistic
                    title="Nodules Detected"
                    value={1}
                    valueStyle={{ color: '#dc2626' }}
                  />
                </Card>
                <Card className="text-center bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                  <Statistic
                    title="Size (mm)"
                    value={8.5}
                    precision={1}
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
                    value="Right Lobe"
                    valueStyle={{ color: '#0891b2', fontSize: '16px' }}
                  />
                </Card>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <RobotOutlined className="mr-2" />
                  <strong>AI Confidence:</strong> 94.3% | The detected nodule shows characteristics
                  consistent with a benign lesion. Recommend follow-up imaging in 6 months.
                </p>
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN - AI Report */}
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
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  onClick={handleAutoGenerate}
                  size="small"
                >
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
                  onClick={handleSignAndSend}
                  className="h-14 bg-gradient-to-r from-green-500 to-emerald-500 border-0 hover:from-green-600 hover:to-emerald-600"
                >
                  <span className="text-lg">Sign & Send to Patient</span>
                </Button>
                
                <div className="flex gap-2">
                  <Button block>Save Draft</Button>
                  <Button block>Export PDF</Button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-800">
                  ⚠️ This AI-generated report requires physician review and digital signature
                  before being sent to the patient.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </Content>
    </Layout>
  );
}
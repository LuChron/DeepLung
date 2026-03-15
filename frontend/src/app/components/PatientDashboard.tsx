import { useState } from 'react';
import { useNavigate } from 'react-router';
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

const { Header, Sider, Content } = Layout;

export function PatientDashboard() {
  const navigate = useNavigate();
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [chatMessages, setChatMessages] = useState([
    {
      type: 'ai',
      text: 'Hello John! I\'m your AI health assistant. Your recent CT scan report is now available. How can I help you understand your results?',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const handleSendMessage = (message?: string) => {
    const msgText = message || inputMessage;
    if (!msgText.trim()) return;

    setChatMessages([
      ...chatMessages,
      { type: 'user', text: msgText },
      {
        type: 'ai',
        text: getAIResponse(msgText),
      },
    ]);
    setInputMessage('');
  };

  const getAIResponse = (question: string) => {
    const lowerQ = question.toLowerCase();
    if (lowerQ.includes('surgery')) {
      return 'Based on your results, surgery is not currently recommended. The 8.5mm nodule is small and shows benign characteristics. Your doctor has recommended monitoring with a follow-up CT scan in 6 months. If the nodule remains stable, no surgery will be needed.';
    } else if (lowerQ.includes('dangerous') || lowerQ.includes('serious')) {
      return 'Your nodule is considered low-risk. At 8.5mm with smooth margins, it has a 94.3% probability of being benign. However, regular monitoring is important to ensure it doesn\'t change. Your healthcare team will track this closely.';
    } else if (lowerQ.includes('lifestyle') || lowerQ.includes('do')) {
      return 'Continue living a healthy lifestyle: avoid smoking, maintain regular exercise, eat a balanced diet rich in antioxidants, and attend all follow-up appointments. These steps support overall lung health.';
    } else {
      return 'That\'s a great question. For specific medical advice, I recommend discussing this with Dr. Sarah Johnson during your next appointment. Would you like me to help schedule a consultation?';
    }
  };

  const quickReplyButtons = [
    'Do I need surgery?',
    'Is this dangerous?',
    'What lifestyle changes should I make?',
  ];

  return (
    <Layout className="min-h-screen">
      {/* Left Sidebar */}
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
                <p className="m-0">John Smith</p>
                <p className="text-xs text-gray-500 m-0">ID: PT-2024-00123</p>
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
        </div>
      </Sider>

      <Layout>
        {/* Header */}
        <Header className="bg-white shadow-sm px-8 flex items-center justify-between">
          <h1 className="text-2xl m-0">Welcome back, John! 👋</h1>
          <Space>
            <Tag color="green" className="px-4 py-1">
              <CheckCircleOutlined className="mr-1" />
              Health Status: Good
            </Tag>
          </Space>
        </Header>

        <Content className="p-6 bg-gray-50">
          <div className="max-w-[1600px] mx-auto">
            <div className="grid grid-cols-12 gap-6">
              {/* Main Content Area */}
              <div className="col-span-8 space-y-6">
                {/* Welcome Banner */}
                <Card className="bg-gradient-to-r from-cyan-500 to-teal-500 border-0 shadow-lg">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <h2 className="text-3xl m-0 mb-2">Your AI Health Report is Ready ✨</h2>
                      <p className="text-lg text-cyan-50 m-0">
                        Dr. Sarah Johnson has reviewed and signed your CT scan results
                      </p>
                    </div>
                    <CheckCircleOutlined className="text-7xl opacity-20" />
                  </div>
                </Card>

                {/* Report Summary */}
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <FileTextOutlined className="text-cyan-600" />
                      <span>Your CT Scan Results - Explained Simply</span>
                    </div>
                  }
                  className="shadow-sm"
                  extra={<Tag color="blue">March 15, 2026</Tag>}
                >
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="text-lg mb-2 flex items-center gap-2">
                        <SafetyOutlined className="text-blue-600" />
                        What We Found
                      </h3>
                      <p className="text-base text-gray-700 leading-relaxed">
                        Our AI analysis, reviewed by Dr. Sarah Johnson, detected a small spot
                        (called a "nodule") in your right lung. Don't worry – this is quite common
                        and most nodules are not harmful.
                      </p>
                    </div>

                    {/* Visual Size Comparison */}
                    <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
                      <h3 className="text-lg mb-4 flex items-center gap-2">
                        <MedicineBoxOutlined className="text-teal-600" />
                        Size Comparison – Easy to Understand
                      </h3>
                      <div className="flex items-center gap-8">
                        <div className="flex-1">
                          <div className="relative h-40 flex items-center justify-center">
                            <img
                              src="https://images.unsplash.com/photo-1601993488142-d3050a16478d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb3liZWFuJTIwc2l6ZSUyMGNvbXBhcmlzb258ZW58MXx8fHwxNzczNTcyNzQ5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                              alt="Soybean"
                              className="h-32 w-32 object-cover rounded-full border-4 border-teal-300 shadow-lg"
                            />
                          </div>
                          <p className="text-center mt-2 text-base">🫘 Soybean</p>
                        </div>
                        <div className="text-4xl text-teal-600">=</div>
                        <div className="flex-1">
                          <div className="relative h-40 flex items-center justify-center">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-rose-500 shadow-xl flex items-center justify-center">
                              <span className="text-white text-xl">8.5mm</span>
                            </div>
                          </div>
                          <p className="text-center mt-2 text-base">Your Nodule Size</p>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-white rounded-lg">
                        <p className="text-sm text-gray-700 text-center">
                          Your nodule is about the size of a soybean – very small!
                        </p>
                      </div>
                    </Card>

                    {/* What This Means */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h3 className="text-lg mb-2 flex items-center gap-2">
                        <CheckCircleOutlined className="text-green-600" />
                        What This Means for You
                      </h3>
                      <ul className="text-base text-gray-700 space-y-2 ml-4">
                        <li>✅ The nodule is small (8.5mm) with smooth edges</li>
                        <li>✅ AI analysis shows 94.3% probability of being benign (not harmful)</li>
                        <li>✅ No immediate treatment needed</li>
                        <li>✅ We'll monitor it with a follow-up scan in 6 months</li>
                      </ul>
                    </div>

                    <Button type="primary" size="large" block icon={<FileTextOutlined />}>
                      Download Full Medical Report (PDF)
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Right Panel - Timeline & Chat */}
              <div className="col-span-4 space-y-6">
                {/* Timeline */}
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
                            <p className="m-0">CT Scan Completed</p>
                            <p className="text-xs text-gray-500 m-0">March 15, 2026</p>
                          </div>
                        ),
                      },
                      {
                        dot: <CheckCircleOutlined className="text-green-500" />,
                        color: 'green',
                        children: (
                          <div>
                            <p className="m-0">AI Analysis Complete</p>
                            <p className="text-xs text-gray-500 m-0">March 15, 2026</p>
                          </div>
                        ),
                      },
                      {
                        dot: <CheckCircleOutlined className="text-green-500" />,
                        color: 'green',
                        children: (
                          <div>
                            <p className="m-0">Report Signed by Doctor</p>
                            <p className="text-xs text-gray-500 m-0">March 15, 2026</p>
                            <Tag color="cyan" className="mt-1">
                              Dr. Sarah Johnson
                            </Tag>
                          </div>
                        ),
                      },
                      {
                        dot: <ClockCircleOutlined className="text-blue-500" />,
                        color: 'blue',
                        children: (
                          <div>
                            <p className="m-0">Next Follow-up CT Scan</p>
                            <p className="text-xs text-gray-500 m-0">September 15, 2026</p>
                            <Tag color="orange" className="mt-1">
                              In 180 Days
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
                      percent={50}
                      size={80}
                      format={() => '180d'}
                      strokeColor="#0891b2"
                    />
                    <p className="text-sm text-gray-500 mt-2">Until next checkup</p>
                  </div>
                </Card>

                {/* AI Chatbot */}
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <RobotOutlined className="text-cyan-600" />
                      <span>Ask AI Assistant</span>
                    </div>
                  }
                  className="shadow-sm"
                >
                  {/* Chat Messages */}
                  <div className="h-64 overflow-y-auto mb-4 space-y-3">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-2 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <Avatar
                          size="small"
                          icon={msg.type === 'ai' ? <RobotOutlined /> : <UserOutlined />}
                          className={msg.type === 'ai' ? 'bg-cyan-500' : 'bg-gray-500'}
                        />
                        <div
                          className={`max-w-[80%] p-3 rounded-lg text-sm ${
                            msg.type === 'ai'
                              ? 'bg-blue-50 text-gray-800'
                              : 'bg-cyan-500 text-white'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Reply Buttons */}
                  <div className="mb-3 space-y-2">
                    <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
                    {quickReplyButtons.map((btn, idx) => (
                      <Button
                        key={idx}
                        size="small"
                        block
                        onClick={() => handleSendMessage(btn)}
                        className="text-left"
                      >
                        {btn}
                      </Button>
                    ))}
                  </div>

                  {/* Input */}
                  <Space.Compact className="w-full">
                    <Input
                      placeholder="Type your question..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onPressEnter={() => handleSendMessage()}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={() => handleSendMessage()}
                    />
                  </Space.Compact>

                  <p className="text-xs text-gray-400 mt-2 text-center">
                    💡 AI responses are for general guidance only
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

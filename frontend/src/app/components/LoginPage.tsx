import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, Input, Button, Segmented, Form, message } from 'antd';
import { UserOutlined, LockOutlined, MedicineBoxOutlined, TeamOutlined } from '@ant-design/icons';
import { login } from '../services/api';
import { saveSession } from '../services/session';

export function LoginPage() {
  const [loginType, setLoginType] = useState<string | number>('doctor');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleLogin = async (values: { id: string; password: string }) => {
    setSubmitting(true);
    try {
      const username = values.id.trim();
      const result = await login(username, values.password);
      saveSession(result.access_token, result.role, username);

      if (result.role === 'patient') {
        navigate(`/patient-dashboard?patientId=${encodeURIComponent(username)}`);
      } else {
        navigate('/doctor-dashboard');
      }
      message.success('登录成功');
    } catch (error) {
      const detail = error instanceof Error ? error.message : '登录失败';
      message.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-blue-50 to-teal-50"
      style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1759270463226-c5e04a4542c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG1lZGljYWwlMjBiYWNrZ3JvdW5kJTIwYmx1ZXxlbnwxfHx8fDE3NzM1NzI3NDh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.4,
        }}
      />
      
      {/* Glassmorphism Login Card */}
      <Card
        className="w-[480px] shadow-2xl relative z-10"
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 mb-4">
            <MedicineBoxOutlined className="text-white text-3xl" />
          </div>
          <h1 className="text-3xl mb-2">医疗 AI 平台</h1>
          <p className="text-gray-500">智能辅助诊断系统</p>
        </div>

        {/* Segmented Control */}
        <div className="mb-6">
          <Segmented
            block
            size="large"
            value={loginType}
            onChange={setLoginType}
            options={[
              {
                label: (
                  <div className="py-2 px-4">
                    <UserOutlined className="mr-2" />
                    👨‍⚕️ 医生登录
                  </div>
                ),
                value: 'doctor',
              },
              {
                label: (
                  <div className="py-2 px-4">
                    <TeamOutlined className="mr-2" />
                    🧑‍🤝‍🧑 患者登录
                  </div>
                ),
                value: 'patient',
              },
            ]}
          />
        </div>

        {/* Login Form */}
        <Form form={form} onFinish={handleLogin} layout="vertical">
          <Form.Item
            name="id"
            rules={[{ required: true, message: '请输入账号！' }]}
          >
            <Input
              size="large"
              prefix={<UserOutlined className="text-gray-400" />}
              placeholder={loginType === 'doctor' ? '医生账号' : '患者账号'}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码！' }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              className="h-12 text-lg"
              loading={submitting}
            >
              登录
            </Button>
          </Form.Item>

          <div className="text-center text-sm text-gray-500 mt-4">
            <a href="#" className="text-cyan-600 hover:text-cyan-700">
              忘记密码？
            </a>
            <span className="mx-2">|</span>
            <a href="#" className="text-cyan-600 hover:text-cyan-700">
              需要帮助？
            </a>
          </div>
        </Form>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>🔒 安全医疗平台 | 隐私合规</p>
          <p className="mt-1">© 2026 医疗 AI 平台</p>
        </div>
      </Card>
    </div>
  );
}

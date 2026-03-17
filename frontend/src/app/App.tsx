import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#0891b2',
          colorInfo: '#0891b2',
          borderRadius: 8,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        },
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}

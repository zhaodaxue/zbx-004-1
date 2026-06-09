import React from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  ExperimentOutlined,
  DropboxOutlined,
  CoffeeOutlined,
  PlaySquareOutlined,
  SnippetsOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import StockBatches from './pages/StockBatches';
import Dilutions from './pages/Dilutions';
import Tasks from './pages/Tasks';
import Traceability from './pages/Traceability';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/stock',
      icon: <ExperimentOutlined />,
      label: '原液管理',
    },
    {
      key: '/dilutions',
      icon: <DropboxOutlined />,
      label: '稀释记录',
    },
    {
      key: '/tasks',
      icon: <PlaySquareOutlined />,
      label: '冲洗任务',
    },
    {
      key: '/trace',
      icon: <SnippetsOutlined />,
      label: '追溯查询',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: 'linear-gradient(135deg, #3E2723 0%, #5D4037 100%)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <CoffeeOutlined style={{ fontSize: 28, color: '#D7CCC8', marginRight: 12 }} />
        <div style={{ color: '#EFEBE9', fontSize: 20, fontWeight: 600 }}>
          暗房化学品管理系统
        </div>
        <div style={{ color: '#A1887F', fontSize: 12, marginLeft: 16 }}>
          Darkroom Chemical Tracker
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#EFEBE9' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0, background: '#EFEBE9' }}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stock" element={<StockBatches />} />
              <Route path="/dilutions" element={<Dilutions />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/trace" element={<Traceability />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default App;

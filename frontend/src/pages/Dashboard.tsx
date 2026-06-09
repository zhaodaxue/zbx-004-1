import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Tag } from 'antd';
import {
  ExperimentOutlined,
  DropboxOutlined,
  PlaySquareOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  BookOutlined,
} from '@ant-design/icons';
import api from '../api/client';
import type { DashboardStats } from '../types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get('/dashboard');
      setStats(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#3E2723' }}>📊 仪表盘总览</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="配方数量"
              value={stats?.formulaCount || 0}
              prefix={<BookOutlined style={{ color: '#6D4C41' }} />}
              valueStyle={{ color: '#5D4037' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="有效原液批次"
              value={stats?.activeStockCount || 0}
              prefix={<ExperimentOutlined style={{ color: '#8D6E63' }} />}
              valueStyle={{ color: '#6D4C41' }}
              suffix={<Tag color="green">可用</Tag>}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="在用工作液"
              value={stats?.activeDilutionCount || 0}
              prefix={<DropboxOutlined style={{ color: '#A1887F' }} />}
              valueStyle={{ color: '#5D4037' }}
              suffix={<Tag color="blue">活跃</Tag>}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="冲洗任务总数"
              value={stats?.totalTasks || 0}
              prefix={<PlaySquareOutlined style={{ color: '#4E342E' }} />}
              valueStyle={{ color: '#3E2723' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="浓度告警工作液"
              value={stats?.lowConcCount || 0}
              prefix={<WarningOutlined style={{ color: '#E65100' }} />}
              valueStyle={{ color: '#E65100' }}
              suffix={
                (stats?.lowConcCount || 0) > 0 ? (
                  <Tag color="red">需注意</Tag>
                ) : (
                  <Tag color="green">正常</Tag>
                )
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="3天内到期工作液"
              value={stats?.expiringSoonCount || 0}
              prefix={<ClockCircleOutlined style={{ color: '#BF360C' }} />}
              valueStyle={{ color: '#BF360C' }}
              suffix={
                (stats?.expiringSoonCount || 0) > 0 ? (
                  <Tag color="orange">临近</Tag>
                ) : (
                  <Tag color="green">充裕</Tag>
                )
              }
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 32 }}>
        <Card title="📖 使用说明" type="inner">
          <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>
              <b>原液管理</b>：记录原液开瓶信息，系统自动计算理论失效日
            </li>
            <li>
              <b>稀释操作</b>：从原液配制成工作液，失效日按稀释比例缩短
            </li>
            <li>
              <b>冲洗任务</b>：登记每次冲洗消耗的工作液量，不足时禁止创建
            </li>
            <li>
              <b>追溯查询</b>：输入任务ID，查看从原液→稀释→消耗的完整链路
            </li>
            <li>
              <Tag color="orange">⚠️ 注意</Tag> 有效浓度低于标称70%时需二次确认
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

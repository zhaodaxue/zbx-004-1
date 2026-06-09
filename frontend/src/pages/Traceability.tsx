import React, { useEffect, useState } from 'react';
import {
  Input,
  Button,
  Card,
  Space,
  App,
  Empty,
  Tag,
  Descriptions,
  List,
  Divider,
  Select,
  Row,
  Col,
  Statistic,
  Steps,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  ExperimentOutlined,
  DropboxOutlined,
  PlaySquareOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/client';
import { useSearchParams } from 'react-router-dom';
import type { ProcessingTask, TraceabilityData } from '../types';

const { Step } = Steps;

const Traceability: React.FC = () => {
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [taskId, setTaskId] = useState(searchParams.get('taskId') || '');
  const [tasks, setTasks] = useState<ProcessingTask[]>([]);
  const [result, setResult] = useState<TraceabilityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    const id = searchParams.get('taskId');
    if (id) {
      setTaskId(id);
      doSearch(id);
    }
  }, [searchParams]);

  const loadTasks = async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch {}
  };

  const doSearch = async (id?: string) => {
    const targetId = id || taskId;
    if (!targetId) {
      message.warning('请选择或输入任务ID');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get(`/trace/${targetId}`);
      setResult(res.data);
      setSearchParams({ taskId: targetId });
    } catch (err: any) {
      message.error(err.response?.data?.error || '查询失败');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#3E2723' }}>🔍 追溯查询</h2>

      <Card style={{ marginBottom: 24 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Select
            style={{ width: 320 }}
            placeholder="从历史任务中选择..."
            value={taskId || undefined}
            onChange={(v) => setTaskId(v)}
            allowClear
            showSearch
            optionFilterProp="label"
            options={tasks.map((t) => ({
              label: `${dayjs(t.createdAt).format('MM-DD HH:mm')} | ${t.taskName}`,
              value: t.id,
            }))}
          />
          <Input
            placeholder="或手动粘贴任务ID..."
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => doSearch()}
            loading={loading}
          >
            查询链路
          </Button>
        </Space.Compact>
      </Card>

      {searched && !loading && !result && (
        <Card>
          <Empty description="未找到匹配的冲洗任务" />
        </Card>
      )}

      {result && (
        <div>
          {/* 链路步骤图 */}
          <Card style={{ marginBottom: 24 }}>
            <Steps
              direction="horizontal"
              size="small"
              current={3}
              items={[
                {
                  title: '配方',
                  description: result.formula.name,
                  icon: <ExperimentOutlined />,
                },
                {
                  title: '原液批次',
                  description: result.stockBatch.batchCode,
                  icon: <ExperimentOutlined />,
                },
                {
                  title: '稀释配液',
                  description: `1:${result.dilution.dilutionRatio.replace('1:', '')}`,
                  icon: <DropboxOutlined />,
                },
                {
                  title: '冲洗任务',
                  description: result.task.taskName,
                  icon: <PlaySquareOutlined />,
                  status: 'finish',
                },
              ]}
            />
          </Card>

          <Row gutter={[16, 16]}>
            {/* 第一层：配方信息 */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <ExperimentOutlined style={{ color: '#5D4037' }} />
                    <span>① 配方信息</span>
                  </Space>
                }
                style={{ borderTop: '4px solid #5D4037' }}
              >
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="配方名称">
                    <b>{result.formula.name}</b>
                  </Descriptions.Item>
                  <Descriptions.Item label="类型">
                    {result.formula.type === 'DEVELOPER' ? (
                      <Tag color="geekblue">显影液</Tag>
                    ) : (
                      <Tag color="purple">定影液</Tag>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="原液保质期">
                    {result.formula.stockShelfLifeDays} 天
                  </Descriptions.Item>
                  <Descriptions.Item label="标准稀释比例">
                    <Tag color="blue">1:{result.formula.standardDilutionRatio}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="标称浓度">
                    {result.formula.nominalConcentration}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* 第二层：原液批次 */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <ExperimentOutlined style={{ color: '#6D4C41' }} />
                    <span>② 原液批次</span>
                    <Tag color={result.stockBatch.status === 'ACTIVE' ? 'green' : 'default'}>
                      {result.stockBatch.status === 'ACTIVE' ? '有效' : '已作废'}
                    </Tag>
                  </Space>
                }
                style={{ borderTop: '4px solid #6D4C41' }}
              >
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="批次编号">
                    <code
                      style={{
                        background: '#EFEBE9',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {result.stockBatch.batchCode}
                    </code>
                  </Descriptions.Item>
                  <Descriptions.Item label="开瓶 → 失效">
                    <Space direction="vertical" size={0}>
                      <span>
                        <ClockCircleOutlined /> {dayjs(result.stockBatch.openDate).format('YYYY-MM-DD')}
                      </span>
                      <span>
                        <ArrowRightOutlined style={{ color: '#d4380d' }} />{' '}
                        {dayjs(result.stockBatch.expiryDate).format('YYYY-MM-DD')}
                      </span>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="容量">
                    <Statistic
                      value={result.stockBatch.currentVolumeMl}
                      suffix={`/ ${result.stockBatch.initialVolumeMl} ml`}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Descriptions.Item>
                </Descriptions>

                <Divider orientation="left" style={{ margin: '16px 0 8px' }}>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    本批次所有稀释记录（{result.stockBatch.allDilutions.length}次）
                  </span>
                </Divider>
                <List
                  size="small"
                  dataSource={result.stockBatch.allDilutions}
                  locale={{ emptyText: '暂无稀释记录' }}
                  renderItem={(item: any) => (
                    <List.Item
                      style={
                        item.id === result.dilution.id
                          ? { background: '#FFF3E0', borderRadius: 4, padding: '4px 8px' }
                          : {}
                      }
                    >
                      <Space direction="vertical" size={0} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Space>
                            <code style={{ fontSize: 10, color: '#666' }}>
                              {item.id.slice(0, 7)}..
                            </code>
                            <span style={{ fontSize: 12 }}>{item.totalVolumeMl}ml</span>
                            <Tag color="blue" style={{ margin: 0 }}>
                              {item.taskCount}次任务
                            </Tag>
                          </Space>
                          <span style={{ fontSize: 11, color: '#888' }}>
                            {dayjs(item.createdAt).format('MM-DD HH:mm')}
                          </span>
                        </div>
                        {item.id === result.dilution.id && (
                          <span style={{ fontSize: 11, color: '#d4380d' }}>
                            ← 当前任务使用的稀释液
                          </span>
                        )}
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            {/* 第三层：稀释液 */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <DropboxOutlined style={{ color: '#8D6E63' }} />
                    <span>③ 稀释配制</span>
                    <Tooltip title="本稀释液的有效浓度（使用时）">
                      <Tag color="geekblue">
                        稀释时浓度：{result.dilution.effectiveConcentrationAtTask}
                      </Tag>
                    </Tooltip>
                  </Space>
                }
                style={{ borderTop: '4px solid #8D6E63' }}
              >
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="配方">
                    原液 {result.dilution.stockUsedMl}ml + 水 {result.dilution.waterAddedMl}ml
                    <div>
                      总量：<b>{result.dilution.totalVolumeMl}ml</b>
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="稀释比例">
                    <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                      {result.dilution.dilutionRatio}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="初始浓度 → 使用时浓度">
                    <Space direction="vertical" size={0}>
                      <span>配置时：{result.dilution.initialConcentration}</span>
                      <span>
                        <ArrowRightOutlined /> 执行本任务时：
                        <b style={{ color: '#389e0d' }}>
                          {result.dilution.effectiveConcentrationAtTask}
                        </b>
                      </span>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="失效日期">
                    {dayjs(result.dilution.expiryDate).format('YYYY-MM-DD')}
                  </Descriptions.Item>
                  <Descriptions.Item label="配制时间">
                    {dayjs(result.dilution.createdAt).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                </Descriptions>

                {result.dilution.otherTasks.length > 0 && (
                  <>
                    <Divider orientation="left" style={{ margin: '16px 0 8px' }}>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        本稀释液的其他消耗（{result.dilution.otherTasks.length}次）
                      </span>
                    </Divider>
                    <List
                      size="small"
                      dataSource={result.dilution.otherTasks}
                      renderItem={(item: any) => (
                        <List.Item>
                          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                            <Space>
                              <PlaySquareOutlined style={{ color: '#888' }} />
                              <span style={{ fontSize: 12 }}>{item.taskName}</span>
                            </Space>
                            <Space>
                              <Tag style={{ margin: 0 }}>{item.consumeMl}ml</Tag>
                              <span style={{ fontSize: 11, color: '#888' }}>
                                {dayjs(item.createdAt).format('MM-DD HH:mm')}
                              </span>
                            </Space>
                          </div>
                        </List.Item>
                      )}
                    />
                  </>
                )}
              </Card>
            </Col>

            {/* 第四层：任务本身 */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <PlaySquareOutlined style={{ color: '#3E2723' }} />
                    <span>④ 冲洗任务（当前）</span>
                    <Tag color="green">本次查询目标</Tag>
                  </Space>
                }
                style={{ borderTop: '4px solid #3E2723' }}
              >
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="任务名称">
                    <b style={{ fontSize: 16 }}>{result.task.taskName}</b>
                  </Descriptions.Item>
                  <Descriptions.Item label="消耗工作液">
                    <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                      {result.task.consumeMl} ml
                    </Tag>
                  </Descriptions.Item>
                  {result.task.filmType && (
                    <Descriptions.Item label="胶片类型">
                      {result.task.filmType}
                    </Descriptions.Item>
                  )}
                  {result.task.notes && (
                    <Descriptions.Item label="备注">
                      <span
                        style={{
                          color:
                            result.task.notes.includes('浓度') || result.task.notes.includes('⚠️')
                              ? '#d4380d'
                              : 'inherit',
                        }}
                      >
                        {result.task.notes.includes('浓度') || result.task.notes.includes('⚠️') ? (
                          <InfoCircleOutlined />
                        ) : null}{' '}
                        {result.task.notes}
                      </span>
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="创建时间">
                    <ClockCircleOutlined /> {dayjs(result.task.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>

          {/* 底部总结 */}
          <Card
            style={{ marginTop: 24, background: '#FAFAFA' }}
            title="📋 链路总结"
            size="small"
          >
            <Space wrap size={[8, 8]} style={{ lineHeight: 2.2 }}>
              <Tag color="brown">配方：{result.formula.name}</Tag>
              <ArrowRightOutlined />
              <Tag color="default">
                原液开瓶：{result.stockBatch.batchCode} @ {dayjs(result.stockBatch.openDate).format('MM-DD')}
              </Tag>
              <ArrowRightOutlined />
              <Tag color="geekblue">
                稀释 {result.dilution.dilutionRatio}（{result.dilution.totalVolumeMl}ml）@{' '}
                {dayjs(result.dilution.createdAt).format('MM-DD')}
              </Tag>
              <ArrowRightOutlined />
              <Tag color="green">
                消耗 {result.task.consumeMl}ml 用于【{result.task.taskName}】@{' '}
                {dayjs(result.task.createdAt).format('MM-DD HH:mm')}
              </Tag>
            </Space>
          </Card>
        </div>
      )}

      {!searched && (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                请从上方选择或输入 <b>冲洗任务ID</b>，即可查看完整追溯链路：
                <br />
                配方 → 原液批次 → 稀释记录 → 消耗记录
              </span>
            }
          />
        </Card>
      )}
    </div>
  );
};

export default Traceability;

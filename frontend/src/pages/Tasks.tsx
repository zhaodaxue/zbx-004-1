import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  App,
  Card,
  Tooltip,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import type { ProcessingTask, Dilution } from '../types';

const Tasks: React.FC = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ProcessingTask[]>([]);
  const [dilutions, setDilutions] = useState<Dilution[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [selectedDilution, setSelectedDilution] = useState<Dilution | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tRes, dRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/dilutions?all=false'),
      ]);
      setTasks(tRes.data);
      setDilutions(dRes.data);
    } finally {
      setLoading(false);
    }
  };

  const handleDilutionChange = (id: string) => {
    const d = dilutions.find((x) => x.id === id) || null;
    setSelectedDilution(d);
  };

  const showLowConcConfirm = (
    effConc: number,
    nominalConc: number,
    finalSubmit: () => void
  ) => {
    modal.confirm({
      title: '⚠️ 有效浓度告警',
      icon: <WarningOutlined style={{ color: '#faad14' }} />,
      content: (
        <div style={{ lineHeight: 1.8 }}>
          <p>当前工作液的有效浓度已低于标称浓度的 <b style={{ color: '#d4380d' }}>70%</b> 阈值：</p>
          <ul style={{ paddingLeft: 20 }}>
            <li>有效浓度：<b style={{ color: '#d4380d' }}>{(effConc * 100).toFixed(1)}%</b></li>
            <li>标称浓度：{(nominalConc * 100).toFixed(0)}%</li>
            <li>阈值：{((nominalConc as number) * 0.7 * 100).toFixed(0)}%</li>
          </ul>
          <Divider style={{ margin: '12px 0' }} />
          <p style={{ fontSize: 13, color: '#666' }}>
            低浓度工作液可能导致显影不足或定影不全。建议：
            <br />• 适当延长显影/定影时间
            <br />• 或考虑重新配液
          </p>
          <p style={{ fontWeight: 600, marginTop: 8 }}>确认继续使用此工作液吗？</p>
        </div>
      ),
      okText: '确认继续（已注意风险）',
      okButtonProps: { danger: true },
      cancelText: '取消，重新配液',
      onOk: finalSubmit,
    });
  };

  const attemptSubmit = async () => {
    try {
      const values = await form.validateFields();
      try {
        await api.post('/tasks', { ...values, confirmLowConcentration: false });
        message.success('冲洗任务创建成功');
        setModalOpen(false);
        form.resetFields();
        setSelectedDilution(null);
        loadData();
      } catch (err: any) {
        if (err.response?.data?.code === 'LOW_CONCENTRATION') {
          const effConc = err.response.data.effectiveConcentration;
          const nominalConc = err.response.data.nominalConcentration;
          showLowConcConfirm(effConc, nominalConc, async () => {
            try {
              await api.post('/tasks', { ...values, confirmLowConcentration: true });
              message.success('冲洗任务创建成功（已备注浓度告警）');
              setModalOpen(false);
              form.resetFields();
              setSelectedDilution(null);
              loadData();
            } catch (err2: any) {
              message.error(err2.response?.data?.error || '操作失败');
            }
          });
        } else {
          message.error(err.response?.data?.error || '操作失败');
        }
      }
    } catch {
      // 校验未通过
    }
  };

  const columns = [
    {
      title: '任务 ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <Tooltip title="点击追溯此任务">
          <Button
            type="link"
            icon={<SearchOutlined />}
            size="small"
            onClick={() => navigate(`/trace?taskId=${id}`)}
          >
            {id.slice(0, 8)}...
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '任务名称',
      dataIndex: 'taskName',
      key: 'taskName',
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '使用工作液',
      key: 'dilution',
      render: (_: any, record: ProcessingTask) => (
        <Space direction="vertical" size={1}>
          <span>{record.dilution.stockBatch.formula.name}</span>
          <span style={{ fontSize: 12, color: '#888' }}>
            母液: {record.dilution.stockBatch.batchCode}
          </span>
          <Tag
            color={
              record.dilution.dilutionRatio >= 3.5
                ? 'purple'
                : record.dilution.dilutionRatio >= 1.5
                ? 'geekblue'
                : 'cyan'
            }
            style={{ margin: 0 }}
          >
            1:{record.dilution.dilutionRatio.toFixed(2)}
          </Tag>
        </Space>
      ),
    },
    {
      title: '消耗量',
      dataIndex: 'consumeMl',
      key: 'consumeMl',
      width: 100,
      render: (ml: number) => (
        <Tag color="blue">{ml.toFixed(0)} ml</Tag>
      ),
    },
    {
      title: '胶片类型',
      dataIndex: 'filmType',
      key: 'filmType',
      render: (f?: string | null) => f || '-',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      render: (n?: string | null) => {
        if (!n) return '-';
        const isLowConc = n.includes('浓度') || n.includes('⚠️') || n.includes('告警');
        return isLowConc ? (
          <span style={{ color: '#d4380d' }}>
            <ExclamationCircleOutlined /> {n}
          </span>
        ) : (
          n
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0, color: '#3E2723' }}>🎞️ 冲洗任务</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新建冲洗任务
        </Button>
      </div>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={tasks}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="🖨️ 创建冲洗任务"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
          setSelectedDilution(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={attemptSubmit}>
            创建任务
          </Button>,
        ]}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="任务名称"
            name="taskName"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="如 伊尔福HP5+ 36张 x 2卷" maxLength={60} />
          </Form.Item>

          <Form.Item
            label="选择工作液"
            name="dilutionId"
            rules={[{ required: true, message: '请选择工作液' }]}
          >
            <Select
              placeholder="选择有效的工作液..."
              onChange={handleDilutionChange}
              optionRender={(opt: any) => {
                const d = opt.data;
                return (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div>
                        {d.formulaName}{' '}
                        <Tag color="blue" style={{ margin: 0 }}>
                          1:{d.ratio}
                        </Tag>
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        母液 {d.batchCode}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>
                        剩 <b style={{ color: d.volume < 100 ? '#d4380d' : '#389e0d' }}>{d.volume}ml</b>
                      </div>
                      {d.lowConc && (
                        <Tag color="orange" icon={<WarningOutlined />} style={{ margin: 0 }}>
                          浓度偏低
                        </Tag>
                      )}
                    </div>
                  </div>
                );
              }}
              options={dilutions
                .filter((d) => d.currentVolumeMl > 0 && d.stockBatch.status !== 'DISCONTINUED')
                .map((d) => ({
                  label: `${d.stockBatch.formula.name} - 剩${d.currentVolumeMl.toFixed(0)}ml`,
                  value: d.id,
                  formulaName: d.stockBatch.formula.name,
                  ratio: d.dilutionRatio.toFixed(2),
                  batchCode: d.stockBatch.batchCode,
                  volume: d.currentVolumeMl.toFixed(0),
                  lowConc: (d.effectiveConcentration ?? 0) < d.stockBatch.formula.nominalConcentration * 0.7,
                }))}
            />
          </Form.Item>

          {selectedDilution && (
            <div
              style={{
                background:
                  (selectedDilution.effectiveConcentration ?? 0) <
                  selectedDilution.stockBatch.formula.nominalConcentration * 0.7
                    ? '#FFF3E0'
                    : '#E8F5E9',
                padding: 12,
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 13,
                lineHeight: 1.8,
              }}
            >
              <Row gutter={12}>
                <Col span={12}>
                  <div>
                    <b>剩余容量：</b>
                    <span
                      style={{
                        color: selectedDilution.currentVolumeMl < 200 ? '#d4380d' : '#389e0d',
                        fontWeight: 600,
                      }}
                    >
                      {selectedDilution.currentVolumeMl.toFixed(0)}ml
                    </span>
                  </div>
                  <div>
                    <b>失效日：</b>{dayjs(selectedDilution.expiryDate).format('MM-DD')}
                    （剩{Math.max(0, dayjs(selectedDilution.expiryDate).diff(dayjs(), 'day'))}天）
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <b>有效浓度：</b>
                    <span
                      style={{
                        color:
                          (selectedDilution.effectiveConcentration ?? 0) <
                          selectedDilution.stockBatch.formula.nominalConcentration * 0.7
                            ? '#d4380d'
                            : '#389e0d',
                        fontWeight: 600,
                      }}
                    >
                      {((selectedDilution.effectiveConcentration ?? 0) * 100).toFixed(1)}%
                    </span>
                    {' / 标称' + (selectedDilution.stockBatch.formula.nominalConcentration * 100).toFixed(0) + '%'}
                  </div>
                  {(selectedDilution.effectiveConcentration ?? 0) <
                    selectedDilution.stockBatch.formula.nominalConcentration * 0.7 && (
                    <Tag color="red" icon={<WarningOutlined />} style={{ marginTop: 4 }}>
                      低于70%阈值！
                    </Tag>
                  )}
                </Col>
              </Row>
            </div>
          )}

          <Form.Item
            label="消耗工作液 (ml)"
            name="consumeMl"
            initialValue={300}
            rules={[
              { required: true, message: '请输入消耗量' },
              {
                validator: (_, value) => {
                  if (!selectedDilution) return Promise.resolve();
                  if (value > selectedDilution.currentVolumeMl) {
                    return Promise.reject(
                      new Error(
                        `工作液不足！当前剩余 ${selectedDilution.currentVolumeMl.toFixed(0)}ml，请补配`
                      )
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber min={10} style={{ width: '100%' }} addonAfter="ml" />
          </Form.Item>

          <Form.Item label="胶片类型" name="filmType">
            <Input placeholder="如 伊尔福 HP5+ 400" />
          </Form.Item>

          <Form.Item label="备注说明" name="notes">
            <Input.TextArea rows={2} placeholder="显影时间、温度、特殊处理等" maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Tasks;

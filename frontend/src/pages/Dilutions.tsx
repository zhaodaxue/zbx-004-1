import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  InputNumber,
  Select,
  Tag,
  Popconfirm,
  App,
  Card,
  Progress,
  Row,
  Col,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/client';
import type { Dilution, StockBatch } from '../types';

const Dilutions: React.FC = () => {
  const { message } = App.useApp();
  const [dilutions, setDilutions] = useState<Dilution[]>([]);
  const [stockBatches, setStockBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [selectedStock, setSelectedStock] = useState<StockBatch | null>(null);
  const [waterSuggestion, setWaterSuggestion] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dRes, sRes] = await Promise.all([
        api.get('/dilutions'),
        api.get('/stock-batches?all=false'),
      ]);
      setDilutions(dRes.data);
      setStockBatches(sRes.data);
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (stockId: string) => {
    const stock = stockBatches.find((s) => s.id === stockId);
    setSelectedStock(stock || null);
    if (stock) {
      const suggestedWater = 300 * stock.formula.standardDilutionRatio;
      setWaterSuggestion(suggestedWater);
      form.setFieldsValue({ waterAddedMl: suggestedWater });
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      await api.post('/dilutions', values);
      message.success('稀释操作成功');
      setModalOpen(false);
      form.resetFields();
      setSelectedStock(null);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const handleDiscard = async (id: string) => {
    try {
      await api.post(`/dilutions/${id}/discard`);
      message.success('已作废该稀释液');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const statusTag = (status: string, expiryDate: string, effConc?: number) => {
    const expired = dayjs(expiryDate).isBefore(dayjs(), 'day');
    const lowConc = (effConc ?? 1) < 0.7;
    if (status === 'DISCONTINUED') return <Tag color="default">已作废/用完</Tag>;
    if (expired) return <Tag color="red">已过期</Tag>;
    if (lowConc)
      return (
        <Tag color="orange" icon={<ExclamationCircleOutlined />}>
          浓度偏低
        </Tag>
      );
    return <Tag color="green">可用</Tag>;
  };

  const columns = [
    {
      title: '稀释ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <code style={{ fontSize: 11, color: '#666' }}>{id.slice(0, 8)}...</code>
      ),
    },
    {
      title: '配方 / 母液',
      key: 'formula',
      render: (_: any, record: Dilution) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 500 }}>{record.stockBatch.formula.name}</span>
          <span style={{ fontSize: 12, color: '#888' }}>
            母液: {record.stockBatch.batchCode}
          </span>
        </Space>
      ),
    },
    {
      title: '稀释比例',
      key: 'ratio',
      width: 100,
      render: (_: any, record: Dilution) => (
        <Tag color="blue">1:{record.dilutionRatio.toFixed(2)}</Tag>
      ),
    },
    {
      title: '配制量 (ml)',
      key: 'vol',
      width: 130,
      render: (_: any, record: Dilution) => (
        <div>
          <div>原液 {record.stockUsedMl.toFixed(0)} + 水 {record.waterAddedMl.toFixed(0)}</div>
          <div style={{ fontSize: 12, color: '#888' }}>总量: {record.totalVolumeMl.toFixed(0)}ml</div>
        </div>
      ),
    },
    {
      title: '当前剩余',
      key: 'remain',
      width: 120,
      render: (_: any, record: Dilution) => (
        <div>
          <Progress
            percent={Math.round((record.currentVolumeMl / record.totalVolumeMl) * 100)}
            size="small"
            status={record.currentVolumeMl === 0 ? 'exception' : 'active'}
          />
          <div style={{ fontSize: 12, textAlign: 'center', marginTop: 2 }}>
            {record.currentVolumeMl.toFixed(0)}ml
          </div>
        </div>
      ),
    },
    {
      title: '有效浓度',
      key: 'conc',
      width: 140,
      render: (_: any, record: Dilution) => {
        const eff = record.effectiveConcentration ?? 0;
        const pct = (eff * 100).toFixed(1);
        const nominal = record.stockBatch.formula.nominalConcentration * 100;
        const lowConc = eff < record.stockBatch.formula.nominalConcentration * 0.7;
        return (
          <div>
            <span
              style={{
                color: lowConc ? '#d4380d' : '#389e0d',
                fontWeight: lowConc ? 600 : 400,
              }}
            >
              {pct}%
            </span>
            <span style={{ fontSize: 12, color: '#999', marginLeft: 6 }}>
              / 标称{nominal.toFixed(0)}%
            </span>
            {lowConc && (
              <div>
                <Tag color="red" style={{ marginTop: 4 }}>
                  <ExclamationCircleOutlined /> 低于70%阈值
                </Tag>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '失效日',
      key: 'expiry',
      width: 130,
      render: (_: any, record: Dilution) => (
        <Space direction="vertical" size={2}>
          <span>{dayjs(record.expiryDate).format('YYYY-MM-DD')}</span>
          {record.status === 'ACTIVE' && (
            <Tag
              color={
                dayjs(record.expiryDate).diff(dayjs(), 'day') <= 3
                  ? 'red'
                  : dayjs(record.expiryDate).diff(dayjs(), 'day') <= 7
                  ? 'orange'
                  : 'green'
              }
              style={{ margin: 0 }}
            >
              {dayjs(record.expiryDate).isBefore(dayjs(), 'day')
                ? '已过期'
                : `剩${dayjs(record.expiryDate).diff(dayjs(), 'day')}天`}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '配制时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => dayjs(d).format('MM-DD HH:mm'),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: Dilution) =>
        statusTag(record.status, record.expiryDate, record.effectiveConcentration),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Dilution) =>
        record.status === 'ACTIVE' && (
          <Popconfirm
            title="确认作废该稀释液？"
            description="作废后不可再用于冲洗任务"
            onConfirm={() => handleDiscard(record.id)}
            okText="确认作废"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              作废
            </Button>
          </Popconfirm>
        ),
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
        <h2 style={{ margin: 0, color: '#3E2723' }}>💧 稀释记录</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新配工作液
        </Button>
      </div>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={dilutions}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="🧪 配制工作液（稀释）"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
          setSelectedStock(null);
        }}
        footer={null}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="选择原液批次（母液）"
            name="stockBatchId"
            rules={[{ required: true, message: '请选择原液批次' }]}
          >
            <Select
              placeholder="选择一个有效的原液批次..."
              onChange={handleStockChange}
              optionRender={(opt: any) => {
                const data = opt.data;
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      <code style={{ fontSize: 11 }}>{data.batchCode}</code> {data.formulaName}
                    </span>
                    <span style={{ color: '#888', fontSize: 12 }}>
                      剩余{data.volume}ml · {data.daysLeft}天寿命
                    </span>
                  </div>
                );
              }}
              options={stockBatches.map((s) => ({
                label: `${s.batchCode} - ${s.formula.name}`,
                value: s.id,
                batchCode: s.batchCode,
                formulaName: s.formula.name,
                volume: s.currentVolumeMl.toFixed(0),
                daysLeft: Math.max(0, dayjs(s.expiryDate).diff(dayjs(), 'day')),
              }))}
            />
          </Form.Item>

          {selectedStock && (
            <div
              style={{
                background: '#FFF8E1',
                padding: 12,
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 13,
                lineHeight: 1.8,
              }}
            >
              <div>
                <b>配方标准比例：</b>1:{selectedStock.formula.standardDilutionRatio}
              </div>
              <div>
                <b>母液剩余：</b>
                {selectedStock.currentVolumeMl.toFixed(0)}ml · 剩余寿命{' '}
                {Math.max(0, dayjs(selectedStock.expiryDate).diff(dayjs(), 'day'))}天
              </div>
              <div>
                <b>理论失效日：</b>
                {dayjs(selectedStock.expiryDate).format('YYYY-MM-DD')}
              </div>
            </div>
          )}

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="取原液 (ml)"
                name="stockUsedMl"
                initialValue={300}
                rules={[{ required: true, message: '必填' }]}
              >
                <InputNumber
                  min={10}
                  max={selectedStock?.currentVolumeMl}
                  style={{ width: '100%' }}
                  addonAfter="ml"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="加水 (ml)"
                name="waterAddedMl"
                rules={[{ required: true, message: '必填' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} addonAfter="ml" />
              </Form.Item>
            </Col>
          </Row>

          {selectedStock && waterSuggestion !== null && (
            <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
              💡 建议按标准比例加水量：{waterSuggestion}ml（取原液300ml时）
            </div>
          )}

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.stockUsedMl !== cur.stockUsedMl || prev.waterAddedMl !== cur.waterAddedMl}>
            {({ getFieldsValue }) => {
              const { stockUsedMl, waterAddedMl } = getFieldsValue();
              if (!stockUsedMl || !waterAddedMl) return null;
              const total = stockUsedMl + waterAddedMl;
              const ratio = waterAddedMl / stockUsedMl;
              const initConc = stockUsedMl / total;
              const stockDays = selectedStock
                ? Math.max(0, dayjs(selectedStock.expiryDate).diff(dayjs(), 'day'))
                : 0;
              const newDays = Math.ceil(stockDays / (1 + ratio));
              return (
                <div
                  style={{
                    background: '#E8F5E9',
                    padding: 12,
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: 13,
                    lineHeight: 1.8,
                  }}
                >
                  <div>
                    <b>稀释比例：</b>1:{ratio.toFixed(2)}
                  </div>
                  <div>
                    <b>总配量：</b>
                    {total}ml
                  </div>
                  <div>
                    <b>初始浓度：</b>
                    {(initConc * 100).toFixed(1)}%
                  </div>
                  <div>
                    <b>稀释后寿命：</b>
                    约 {newDays} 天 → 失效日约{' '}
                    {dayjs().add(newDays, 'day').format('YYYY-MM-DD')}
                  </div>
                </div>
              );
            }}
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认稀释
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Dilutions;

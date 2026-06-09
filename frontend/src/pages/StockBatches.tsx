import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Tag,
  Popconfirm,
  App,
  Card,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/client';
import type { StockBatch, Formula, ChemicalType } from '../types';

const StockBatches: React.FC = () => {
  const { message } = App.useApp();
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bRes, fRes] = await Promise.all([
        api.get('/stock-batches'),
        api.get('/formulas'),
      ]);
      setBatches(bRes.data);
      setFormulas(fRes.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      await api.post('/stock-batches', {
        ...values,
        openDate: values.openDate.toISOString(),
      });
      message.success('原液开瓶登记成功');
      setModalOpen(false);
      form.resetFields();
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const handleDiscard = async (id: string) => {
    try {
      await api.post(`/stock-batches/${id}/discard`);
      message.success('已作废该批次');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const chemicalTypeTag = (type: ChemicalType) =>
    type === 'DEVELOPER' ? (
      <Tag color="geekblue">显影液</Tag>
    ) : (
      <Tag color="purple">定影液</Tag>
    );

  const statusTag = (status: string, expiryDate: string) => {
    const expired = dayjs(expiryDate).isBefore(dayjs(), 'day');
    if (status === 'DISCONTINUED') return <Tag color="default">已作废</Tag>;
    if (expired) return <Tag color="red">已过期</Tag>;
    return <Tag color="green">有效</Tag>;
  };

  const columns = [
    {
      title: '批次编号',
      dataIndex: 'batchCode',
      key: 'batchCode',
      width: 160,
      render: (code: string, record: StockBatch) => (
        <Space>
          <code style={{ background: '#EFEBE9', padding: '2px 8px', borderRadius: 4 }}>
            {code}
          </code>
          {chemicalTypeTag(record.formula.type)}
        </Space>
      ),
    },
    {
      title: '配方名称',
      dataIndex: ['formula', 'name'],
      key: 'formulaName',
    },
    {
      title: '开瓶日期',
      dataIndex: 'openDate',
      key: 'openDate',
      render: (d: string) => dayjs(d).format('YYYY-MM-DD'),
    },
    {
      title: '失效日期',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (d: string, record: StockBatch) => (
        <Space>
          <span
            style={{
              color: dayjs(d).isBefore(dayjs(), 'day') ? '#d4380d' : 'inherit',
              fontWeight: dayjs(d).diff(dayjs(), 'day') <= 7 ? 600 : 400,
            }}
          >
            {dayjs(d).format('YYYY-MM-DD')}
          </span>
          {record.status === 'ACTIVE' && (
            <Tag
              color={
                dayjs(d).diff(dayjs(), 'day') <= 7
                  ? 'orange'
                  : dayjs(d).diff(dayjs(), 'day') <= 14
                  ? 'gold'
                  : 'green'
              }
            >
              剩{Math.max(0, dayjs(d).diff(dayjs(), 'day'))}天
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '容量 (ml)',
      key: 'volume',
      render: (_: any, record: StockBatch) => (
        <span>
          {record.currentVolumeMl.toFixed(0)} /{' '}
          <span style={{ color: '#888' }}>{record.initialVolumeMl.toFixed(0)}</span>
        </span>
      ),
    },
    {
      title: '稀释次数',
      dataIndex: ['dilutions', 'length'],
      key: 'dilutionCount',
      render: (n: number) => n || 0,
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: StockBatch) => statusTag(record.status, record.expiryDate),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: StockBatch) =>
        record.status === 'ACTIVE' && (
          <Popconfirm
            title="确认作废该批次？"
            description="作废后不可再参与稀释操作"
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
        <h2 style={{ margin: 0, color: '#3E2723' }}>🧪 原液管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          登记开瓶
        </Button>
      </div>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={batches}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title="📝 原液开瓶登记"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="配方"
            name="formulaId"
            rules={[{ required: true, message: '请选择配方' }]}
          >
            <Select
              placeholder="选择配方"
              options={formulas.map((f) => ({
                label: `${f.name} (${f.type === 'DEVELOPER' ? '显影液' : '定影液'})`,
                value: f.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="批次编号"
            name="batchCode"
            rules={[{ required: true, message: '请输入批次编号' }]}
          >
            <Input placeholder="如 D76-2026-0609" />
          </Form.Item>

          <Form.Item
            label="开瓶日期"
            name="openDate"
            initialValue={dayjs()}
            rules={[{ required: true, message: '请选择开瓶日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="初始容量 (ml)"
            name="initialVolumeMl"
            initialValue={1000}
            rules={[{ required: true, message: '请输入初始容量' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} addonAfter="ml" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认登记
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StockBatches;

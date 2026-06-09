import { Router, Request, Response } from 'express';
import * as service from './services';
import { z } from 'zod';

const router = Router();

function handleError(res: Response, err: unknown) {
  console.error('API Error:', err);
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: '参数校验失败', details: err.errors });
  }
  const error = err as any;
  if (error.code === 'LOW_CONCENTRATION') {
    return res.status(409).json({
      error: error.message,
      code: 'LOW_CONCENTRATION',
      effectiveConcentration: error.effectiveConcentration,
      nominalConcentration: error.nominalConcentration,
    });
  }
  if (error.message) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: '服务器内部错误' });
}

// ========== 仪表盘 ==========
router.get('/dashboard', async (_req, res) => {
  try {
    const stats = await service.getDashboardStats();
    res.json(stats);
  } catch (err) {
    handleError(res, err);
  }
});

// ========== 配方 ==========
router.get('/formulas', async (_req, res) => {
  try {
    const formulas = await service.getAllFormulas();
    res.json(formulas);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/formulas/:id', async (req, res) => {
  try {
    const formula = await service.getFormulaById(req.params.id);
    if (!formula) return res.status(404).json({ error: '配方不存在' });
    res.json(formula);
  } catch (err) {
    handleError(res, err);
  }
});

// ========== 原液批次 ==========
router.get('/stock-batches', async (req, res) => {
  try {
    const all = req.query.all !== 'false';
    const batches = await service.getAllStockBatches(all);
    res.json(batches);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/stock-batches/:id', async (req, res) => {
  try {
    const batch = await service.getStockBatchById(req.params.id);
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    res.json(batch);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/stock-batches', async (req, res) => {
  try {
    const batch = await service.openStockBatch(req.body);
    res.status(201).json(batch);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/stock-batches/:id/discard', async (req, res) => {
  try {
    const batch = await service.discardStockBatch(req.params.id);
    res.json(batch);
  } catch (err) {
    handleError(res, err);
  }
});

// ========== 稀释 ==========
router.get('/dilutions', async (req, res) => {
  try {
    const all = req.query.all !== 'false';
    const dilutions = await service.getAllDilutions(all);
    res.json(dilutions);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/dilutions/:id', async (req, res) => {
  try {
    const dilution = await service.getDilutionById(req.params.id);
    if (!dilution) return res.status(404).json({ error: '稀释记录不存在' });
    res.json(dilution);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/dilutions', async (req, res) => {
  try {
    const dilution = await service.createDilution(req.body);
    res.status(201).json(dilution);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/dilutions/:id/discard', async (req, res) => {
  try {
    const dilution = await service.discardDilution(req.params.id);
    res.json(dilution);
  } catch (err) {
    handleError(res, err);
  }
});

// ========== 冲洗任务 ==========
router.get('/tasks', async (_req, res) => {
  try {
    const tasks = await service.getAllTasks();
    res.json(tasks);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await service.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: '任务不存在' });
    res.json(task);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const task = await service.createProcessingTask(req.body);
    res.status(201).json(task);
  } catch (err) {
    handleError(res, err);
  }
});

// ========== 追溯 ==========
router.get('/trace/:taskId', async (req, res) => {
  try {
    const trace = await service.getTraceability(req.params.taskId);
    res.json(trace);
  } catch (err) {
    handleError(res, err);
  }
});

// ========== 健康检查 ==========
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;

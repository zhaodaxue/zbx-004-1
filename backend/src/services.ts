import { PrismaClient } from '@prisma/client';
const BatchStatus = { ACTIVE: 'ACTIVE', DISCONTINUED: 'DISCONTINUED' };
const DilutionStatus = { ACTIVE: 'ACTIVE', DISCONTINUED: 'DISCONTINUED' };
const ChemicalType = { DEVELOPER: 'DEVELOPER', FIXER: 'FIXER' };
import { addDays, differenceInDays, startOfDay, isBefore, isAfter } from 'date-fns';
import { z } from 'zod';

export const prisma = new PrismaClient();

const today = () => startOfDay(new Date());

// ==================== 计算辅助函数 ====================

/**
 * 计算工作液当前有效浓度
 * 有效浓度 = 初始浓度 * (剩余天数 / 初始寿命天数)
 * 若已过期返回0
 */
export function calculateEffectiveConcentration(
  initialConcentration: number,
  initialShelfLifeDays: number,
  expiryDate: Date,
  now: Date = today()
): number {
  const remainingDays = differenceInDays(expiryDate, now);
  if (remainingDays <= 0) return 0;
  if (initialShelfLifeDays <= 0) return 0;
  return initialConcentration * (remainingDays / initialShelfLifeDays);
}

/**
 * 检查浓度是否低于标称70%阈值
 */
export function isConcentrationLow(
  effectiveConc: number,
  nominalConc: number
): boolean {
  return effectiveConc < nominalConc * 0.7;
}

/**
 * 计算稀释后失效日
 * 剩余寿命按稀释比例缩短，向上取整到天
 */
export function calculateDilutedExpiry(
  stockRemainingDays: number,
  dilutionRatio: number
): number {
  return Math.ceil(stockRemainingDays / (1 + dilutionRatio));
}

// ==================== 配方 ====================

export async function getAllFormulas() {
  return prisma.formula.findMany({
    orderBy: { createdAt: 'asc' },
  });
}

export async function getFormulaById(id: string) {
  return prisma.formula.findUnique({ where: { id } });
}

// ==================== 原液批次 ====================

const openStockSchema = z.object({
  formulaId: z.string(),
  batchCode: z.string().min(1),
  openDate: z.coerce.date(),
  initialVolumeMl: z.number().positive(),
});

export type OpenStockInput = z.infer<typeof openStockSchema>;

export async function openStockBatch(input: OpenStockInput) {
  const data = openStockSchema.parse(input);
  const formula = await getFormulaById(data.formulaId);
  if (!formula) throw new Error('配方不存在');

  const existing = await prisma.stockBatch.findUnique({ where: { batchCode: data.batchCode } });
  if (existing) throw new Error('批次号已存在');

  const expiryDate = addDays(startOfDay(data.openDate), formula.stockShelfLifeDays);

  return prisma.stockBatch.create({
    data: {
      formulaId: data.formulaId,
      batchCode: data.batchCode,
      openDate: startOfDay(data.openDate),
      initialVolumeMl: data.initialVolumeMl,
      currentVolumeMl: data.initialVolumeMl,
      expiryDate,
      status: BatchStatus.ACTIVE,
    },
    include: { formula: true },
  });
}

export async function getAllStockBatches(includeDiscontinued = true) {
  const where = includeDiscontinued ? {} : { status: BatchStatus.ACTIVE };
  return prisma.stockBatch.findMany({
    where,
    include: { formula: true, dilutions: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getStockBatchById(id: string) {
  return prisma.stockBatch.findUnique({
    where: { id },
    include: { formula: true, dilutions: { include: { tasks: true } } },
  });
}

export async function discardStockBatch(id: string) {
  const batch = await prisma.stockBatch.findUnique({ where: { id } });
  if (!batch) throw new Error('批次不存在');

  return prisma.stockBatch.update({
    where: { id },
    data: { status: BatchStatus.DISCONTINUED },
  });
}

// ==================== 稀释操作 ====================

const createDilutionSchema = z.object({
  stockBatchId: z.string(),
  stockUsedMl: z.number().positive(),
  waterAddedMl: z.number().positive(),
});

export type CreateDilutionInput = z.infer<typeof createDilutionSchema>;

export async function createDilution(input: CreateDilutionInput) {
  const data = createDilutionSchema.parse(input);

  const stock = await prisma.stockBatch.findUnique({
    where: { id: data.stockBatchId },
    include: { formula: true },
  });
  if (!stock) throw new Error('原液批次不存在');
  if (stock.status === BatchStatus.DISCONTINUED) throw new Error('原液批次已作废，禁止稀释');
  if (isBefore(stock.expiryDate, today())) throw new Error('原液已过期');
  if (stock.currentVolumeMl < data.stockUsedMl) {
    throw new Error(`原液不足，剩余 ${stock.currentVolumeMl}ml，需要 ${data.stockUsedMl}ml`);
  }

  const dilutionRatio = data.waterAddedMl / data.stockUsedMl;
  const totalVolume = data.stockUsedMl + data.waterAddedMl;
  const initialConcentration = data.stockUsedMl / totalVolume;
  const stockRemainingDays = Math.max(0, differenceInDays(stock.expiryDate, today()));
  const initialShelfDays = calculateDilutedExpiry(stockRemainingDays, dilutionRatio);
  const expiryDate = addDays(today(), initialShelfDays);

  return prisma.$transaction(async (tx) => {
    await tx.stockBatch.update({
      where: { id: stock.id },
      data: { currentVolumeMl: { decrement: data.stockUsedMl } },
    });

    return tx.dilution.create({
      data: {
        stockBatchId: stock.id,
        stockUsedMl: data.stockUsedMl,
        waterAddedMl: data.waterAddedMl,
        totalVolumeMl: totalVolume,
        dilutionRatio,
        initialConcentration,
        remainingDaysAtDilution: stockRemainingDays,
        initialShelfLifeDays: initialShelfDays,
        expiryDate,
        currentVolumeMl: totalVolume,
        status: DilutionStatus.ACTIVE,
      },
      include: {
        stockBatch: { include: { formula: true } },
      },
    });
  });
}

export async function getAllDilutions(includeDiscontinued = true) {
  const where = includeDiscontinued ? {} : { status: DilutionStatus.ACTIVE };
  const dilutions = await prisma.dilution.findMany({
    where,
    include: {
      stockBatch: { include: { formula: true } },
      tasks: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return dilutions.map((d) => ({
    ...d,
    effectiveConcentration: calculateEffectiveConcentration(
      d.initialConcentration,
      d.initialShelfLifeDays,
      d.expiryDate
    ),
  }));
}

export async function getDilutionById(id: string) {
  const dilution = await prisma.dilution.findUnique({
    where: { id },
    include: {
      stockBatch: { include: { formula: true } },
      tasks: true,
    },
  });
  if (!dilution) return null;
  return {
    ...dilution,
    effectiveConcentration: calculateEffectiveConcentration(
      dilution.initialConcentration,
      dilution.initialShelfLifeDays,
      dilution.expiryDate
    ),
  };
}

export async function discardDilution(id: string) {
  const dilution = await prisma.dilution.findUnique({ where: { id } });
  if (!dilution) throw new Error('稀释记录不存在');

  return prisma.dilution.update({
    where: { id },
    data: { status: DilutionStatus.DISCONTINUED },
  });
}

// ==================== 冲洗任务 ====================

const createTaskSchema = z.object({
  taskName: z.string().min(1),
  dilutionId: z.string(),
  consumeMl: z.number().positive(),
  filmType: z.string().optional(),
  notes: z.string().optional(),
  confirmLowConcentration: z.boolean().optional().default(false),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export async function createProcessingTask(input: CreateTaskInput) {
  const data = createTaskSchema.parse(input);

  const dilution = await prisma.dilution.findUnique({
    where: { id: data.dilutionId },
    include: { stockBatch: { include: { formula: true } } },
  });
  if (!dilution) throw new Error('稀释液不存在');
  if (dilution.status === DilutionStatus.DISCONTINUED) throw new Error('稀释液已作废');
  if (dilution.stockBatch.status === BatchStatus.DISCONTINUED) throw new Error('母液已作废，禁止使用该工作液');
  if (isBefore(dilution.expiryDate, today())) throw new Error('稀释液已过期');
  if (dilution.currentVolumeMl < data.consumeMl) {
    throw new Error(
      `工作液不足，剩余 ${dilution.currentVolumeMl}ml，需要 ${data.consumeMl}ml，请补配`
    );
  }

  const effectiveConc = calculateEffectiveConcentration(
    dilution.initialConcentration,
    dilution.initialShelfLifeDays,
    dilution.expiryDate
  );
  const lowConc = isConcentrationLow(effectiveConc, dilution.stockBatch.formula.nominalConcentration);

  if (lowConc && !data.confirmLowConcentration) {
    const error: any = new Error(
      `⚠️ 有效浓度告警：当前有效浓度约 ${(effectiveConc * 100).toFixed(1)}%，低于标称浓度70%阈值。请确认是否继续。`
    );
    error.code = 'LOW_CONCENTRATION';
    error.effectiveConcentration = effectiveConc;
    error.nominalConcentration = dilution.stockBatch.formula.nominalConcentration;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const newVolume = dilution.currentVolumeMl - data.consumeMl;
    
    const task = await tx.processingTask.create({
      data: {
        taskName: data.taskName,
        dilutionId: dilution.id,
        consumeMl: data.consumeMl,
        filmType: data.filmType || null,
        notes: data.notes || null,
      },
      include: {
        dilution: {
          include: {
            stockBatch: { include: { formula: true } },
          },
        },
      },
    });

    await tx.dilution.update({
      where: { id: dilution.id },
      data: {
        currentVolumeMl: newVolume,
        status: newVolume <= 0 ? DilutionStatus.DISCONTINUED : undefined,
      },
    });

    return { ...task, effectiveConcentration: effectiveConc, lowConcentrationWarning: lowConc };
  });
}

export async function getAllTasks() {
  return prisma.processingTask.findMany({
    include: {
      dilution: {
        include: {
          stockBatch: { include: { formula: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTaskById(id: string) {
  return prisma.processingTask.findUnique({
    where: { id },
    include: {
      dilution: {
        include: {
          stockBatch: { include: { formula: true } },
          tasks: true,
        },
      },
    },
  });
}

// ==================== 追溯链路 ====================

export async function getTraceability(taskId: string) {
  const task = await prisma.processingTask.findUnique({
    where: { id: taskId },
    include: {
      dilution: {
        include: {
          stockBatch: {
            include: {
              formula: true,
              dilutions: {
                include: { tasks: true },
              },
            },
          },
          tasks: true,
        },
      },
    },
  });

  if (!task) throw new Error('任务不存在');

  const dilution = task.dilution;
  const stockBatch = dilution.stockBatch;
  const formula = stockBatch.formula;

  const effectiveConc = calculateEffectiveConcentration(
    dilution.initialConcentration,
    dilution.initialShelfLifeDays,
    dilution.expiryDate,
    startOfDay(task.createdAt)
  );

  return {
    task: {
      id: task.id,
      taskName: task.taskName,
      consumeMl: task.consumeMl,
      filmType: task.filmType,
      notes: task.notes,
      createdAt: task.createdAt,
    },
    dilution: {
      id: dilution.id,
      stockUsedMl: dilution.stockUsedMl,
      waterAddedMl: dilution.waterAddedMl,
      totalVolumeMl: dilution.totalVolumeMl,
      dilutionRatio: `1:${dilution.dilutionRatio.toFixed(2)}`,
      initialConcentration: `${(dilution.initialConcentration * 100).toFixed(1)}%`,
      effectiveConcentrationAtTask: `${(effectiveConc * 100).toFixed(1)}%`,
      expiryDate: dilution.expiryDate,
      createdAt: dilution.createdAt,
      otherTasks: dilution.tasks.filter((t) => t.id !== task.id).map((t) => ({
        id: t.id,
        taskName: t.taskName,
        consumeMl: t.consumeMl,
        createdAt: t.createdAt,
      })),
    },
    stockBatch: {
      id: stockBatch.id,
      batchCode: stockBatch.batchCode,
      openDate: stockBatch.openDate,
      expiryDate: stockBatch.expiryDate,
      initialVolumeMl: stockBatch.initialVolumeMl,
      currentVolumeMl: stockBatch.currentVolumeMl,
      status: stockBatch.status,
      allDilutions: stockBatch.dilutions.map((d) => ({
        id: d.id,
        totalVolumeMl: d.totalVolumeMl,
        createdAt: d.createdAt,
        totalConsumed: d.tasks.reduce((sum, t) => sum + t.consumeMl, 0),
        taskCount: d.tasks.length,
      })),
    },
    formula: {
      id: formula.id,
      name: formula.name,
      type: formula.type,
      stockShelfLifeDays: formula.stockShelfLifeDays,
      standardDilutionRatio: formula.standardDilutionRatio,
      nominalConcentration: `${(formula.nominalConcentration * 100).toFixed(0)}%`,
    },
  };
}

// ==================== 仪表盘统计 ====================

export async function getDashboardStats() {
  const todayDate = today();

  const [
    activeStockCount,
    activeDilutionCount,
    totalTasks,
    formulas,
  ] = await Promise.all([
    prisma.stockBatch.count({ where: { status: BatchStatus.ACTIVE } }),
    prisma.dilution.count({ where: { status: DilutionStatus.ACTIVE } }),
    prisma.processingTask.count(),
    prisma.formula.findMany(),
  ]);

  const activeDilutions = await prisma.dilution.findMany({
    where: { status: DilutionStatus.ACTIVE },
    include: { stockBatch: { include: { formula: true } } },
  });

  let lowConcCount = 0;
  let expiringSoonCount = 0;

  for (const d of activeDilutions) {
    const effConc = calculateEffectiveConcentration(
      d.initialConcentration,
      d.initialShelfLifeDays,
      d.expiryDate
    );
    if (isConcentrationLow(effConc, d.stockBatch.formula.nominalConcentration)) {
      lowConcCount++;
    }
    const daysLeft = differenceInDays(d.expiryDate, todayDate);
    if (daysLeft >= 0 && daysLeft <= 3) expiringSoonCount++;
  }

  return {
    activeStockCount,
    activeDilutionCount,
    totalTasks,
    lowConcCount,
    expiringSoonCount,
    formulaCount: formulas.length,
  };
}

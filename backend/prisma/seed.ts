import { PrismaClient } from '@prisma/client';
const ChemicalType = { DEVELOPER: 'DEVELOPER', FIXER: 'FIXER' };
const BatchStatus = { ACTIVE: 'ACTIVE', DISCONTINUED: 'DISCONTINUED' };
const DilutionStatus = { ACTIVE: 'ACTIVE', DISCONTINUED: 'DISCONTINUED' };
import { addDays, differenceInDays, startOfDay } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始生成种子数据...');

  const today = startOfDay(new Date('2026-06-09'));

  // ========== 1. 创建配方 ==========
  console.log('📝 创建配方...');
  
  const formulaD76 = await prisma.formula.create({
    data: {
      name: 'D-76 显影液',
      type: ChemicalType.DEVELOPER,
      stockShelfLifeDays: 60,
      standardDilutionRatio: 1,
      nominalConcentration: 1.0,
    },
  });

  const formulaF5 = await prisma.formula.create({
    data: {
      name: 'F-5 酸性定影液',
      type: ChemicalType.FIXER,
      stockShelfLifeDays: 90,
      standardDilutionRatio: 4,
      nominalConcentration: 1.0,
    },
  });

  console.log(`  ✅ 配方1: ${formulaD76.name}`);
  console.log(`  ✅ 配方2: ${formulaF5.name}`);

  // ========== 2. 创建原液批次 ==========
  console.log('🧪 创建原液批次...');

  // 批次1: D-76 旧批次（开瓶较早，剩余寿命较短）
  const openDate1 = addDays(today, -50); // 50天前开瓶
  const stockD76Old = await prisma.stockBatch.create({
    data: {
      formulaId: formulaD76.id,
      batchCode: 'D76-2026-0420',
      openDate: openDate1,
      initialVolumeMl: 1000,
      currentVolumeMl: 300,
      expiryDate: addDays(openDate1, formulaD76.stockShelfLifeDays),
      status: BatchStatus.ACTIVE,
    },
  });

  // 批次2: D-76 新批次（刚开瓶不久）
  const openDate2 = addDays(today, -5);
  const stockD76New = await prisma.stockBatch.create({
    data: {
      formulaId: formulaD76.id,
      batchCode: 'D76-2026-0604',
      openDate: openDate2,
      initialVolumeMl: 1000,
      currentVolumeMl: 700,
      expiryDate: addDays(openDate2, formulaD76.stockShelfLifeDays),
      status: BatchStatus.ACTIVE,
    },
  });

  // 批次3: F-5 定影液
  const openDate3 = addDays(today, -20);
  const stockF5 = await prisma.stockBatch.create({
    data: {
      formulaId: formulaF5.id,
      batchCode: 'F5-2026-0520',
      openDate: openDate3,
      initialVolumeMl: 1000,
      currentVolumeMl: 600,
      expiryDate: addDays(openDate3, formulaF5.stockShelfLifeDays),
      status: BatchStatus.ACTIVE,
    },
  });

  console.log(`  ✅ 批次1: ${stockD76Old.batchCode} (开瓶50天, 剩余${differenceInDays(stockD76Old.expiryDate, today)}天)`);
  console.log(`  ✅ 批次2: ${stockD76New.batchCode} (开瓶5天, 剩余${differenceInDays(stockD76New.expiryDate, today)}天)`);
  console.log(`  ✅ 批次3: ${stockF5.batchCode} (开瓶20天, 剩余${differenceInDays(stockF5.expiryDate, today)}天)`);

  // ========== 3. 创建稀释记录 ==========
  console.log('💧 创建稀释记录...');

  // 稀释1: 用旧D76批次 1:1稀释 500ml原液 -> 1000ml工作液（8天前）
  // 这个工作液会触发浓度告警（有效浓度 < 70%）
  const dilutionDate1 = addDays(today, -8);
  const remainingDaysAtDilution1 = differenceInDays(stockD76Old.expiryDate, dilutionDate1);
  const stockUsed1 = 500;
  const waterAdded1 = 500;
  const total1 = stockUsed1 + waterAdded1;
  const ratio1 = waterAdded1 / stockUsed1;
  const initialConc1 = stockUsed1 / total1;
  const initialShelf1 = Math.ceil(remainingDaysAtDilution1 / (1 + ratio1));
  
  const dilutionLowConc = await prisma.dilution.create({
    data: {
      stockBatchId: stockD76Old.id,
      stockUsedMl: stockUsed1,
      waterAddedMl: waterAdded1,
      totalVolumeMl: total1,
      dilutionRatio: ratio1,
      initialConcentration: initialConc1,
      remainingDaysAtDilution: remainingDaysAtDilution1,
      initialShelfLifeDays: initialShelf1,
      expiryDate: addDays(dilutionDate1, initialShelf1),
      currentVolumeMl: 300,
      status: DilutionStatus.ACTIVE,
      createdAt: dilutionDate1,
    },
  });
  // 更新原液剩余量
  await prisma.stockBatch.update({
    where: { id: stockD76Old.id },
    data: { currentVolumeMl: stockD76Old.currentVolumeMl - stockUsed1 + 500 /* 回补，因为后面还要用 */ },
  });

  // 稀释2: 用新D76批次 1:1稀释 300ml原液 -> 600ml工作液（2天前）- 浓度正常
  const dilutionDate2 = addDays(today, -2);
  const remainingDaysAtDilution2 = differenceInDays(stockD76New.expiryDate, dilutionDate2);
  const stockUsed2 = 300;
  const waterAdded2 = 300;
  const total2 = stockUsed2 + waterAdded2;
  const ratio2 = waterAdded2 / stockUsed2;
  const initialConc2 = stockUsed2 / total2;
  const initialShelf2 = Math.ceil(remainingDaysAtDilution2 / (1 + ratio2));

  const dilutionD76Good = await prisma.dilution.create({
    data: {
      stockBatchId: stockD76New.id,
      stockUsedMl: stockUsed2,
      waterAddedMl: waterAdded2,
      totalVolumeMl: total2,
      dilutionRatio: ratio2,
      initialConcentration: initialConc2,
      remainingDaysAtDilution: remainingDaysAtDilution2,
      initialShelfLifeDays: initialShelf2,
      expiryDate: addDays(dilutionDate2, initialShelf2),
      currentVolumeMl: 400,
      status: DilutionStatus.ACTIVE,
      createdAt: dilutionDate2,
    },
  });
  await prisma.stockBatch.update({
    where: { id: stockD76New.id },
    data: { currentVolumeMl: stockD76New.currentVolumeMl - stockUsed2 },
  });

  // 稀释3: F-5定影液 1:4稀释 200ml原液 -> 1000ml工作液（10天前）
  const dilutionDate3 = addDays(today, -10);
  const remainingDaysAtDilution3 = differenceInDays(stockF5.expiryDate, dilutionDate3);
  const stockUsed3 = 200;
  const waterAdded3 = 800;
  const total3 = stockUsed3 + waterAdded3;
  const ratio3 = waterAdded3 / stockUsed3;
  const initialConc3 = stockUsed3 / total3;
  const initialShelf3 = Math.ceil(remainingDaysAtDilution3 / (1 + ratio3));

  const dilutionF5 = await prisma.dilution.create({
    data: {
      stockBatchId: stockF5.id,
      stockUsedMl: stockUsed3,
      waterAddedMl: waterAdded3,
      totalVolumeMl: total3,
      dilutionRatio: ratio3,
      initialConcentration: initialConc3,
      remainingDaysAtDilution: remainingDaysAtDilution3,
      initialShelfLifeDays: initialShelf3,
      expiryDate: addDays(dilutionDate3, initialShelf3),
      currentVolumeMl: 500,
      status: DilutionStatus.ACTIVE,
      createdAt: dilutionDate3,
    },
  });
  await prisma.stockBatch.update({
    where: { id: stockF5.id },
    data: { currentVolumeMl: stockF5.currentVolumeMl - stockUsed3 },
  });

  // 再做一次D76-旧批次的稀释用于产生历史任务
  const dilutionDate4 = addDays(today, -15);
  const remainingDaysAtDilution4 = differenceInDays(stockD76Old.expiryDate, dilutionDate4);
  const stockUsed4 = 400;
  const waterAdded4 = 400;
  const total4 = stockUsed4 + waterAdded4;
  const ratio4 = waterAdded4 / stockUsed4;
  const initialConc4 = stockUsed4 / total4;
  const initialShelf4 = Math.ceil(remainingDaysAtDilution4 / (1 + ratio4));

  const dilutionD76OldHist = await prisma.dilution.create({
    data: {
      stockBatchId: stockD76Old.id,
      stockUsedMl: stockUsed4,
      waterAddedMl: waterAdded4,
      totalVolumeMl: total4,
      dilutionRatio: ratio4,
      initialConcentration: initialConc4,
      remainingDaysAtDilution: remainingDaysAtDilution4,
      initialShelfLifeDays: initialShelf4,
      expiryDate: addDays(dilutionDate4, initialShelf4),
      currentVolumeMl: 0,
      status: DilutionStatus.DISCONTINUED,
      createdAt: dilutionDate4,
    },
  });
  await prisma.stockBatch.update({
    where: { id: stockD76Old.id },
    data: { currentVolumeMl: { decrement: stockUsed4 } },
  });

  console.log(`  ✅ 稀释1: D76旧批次 1:1 (8天前, ${total1}ml) - 此液浓度告警`);
  console.log(`  ✅ 稀释2: D76新批次 1:1 (2天前, ${total2}ml) - 浓度正常`);
  console.log(`  ✅ 稀释3: F5定影液 1:4 (10天前, ${total3}ml)`);
  console.log(`  ✅ 稀释4: D76旧批次 1:1 (15天前, ${total4}ml) - 已用完作废`);

  // ========== 4. 创建冲洗任务记录 ==========
  console.log('🎞️ 创建冲洗任务...');

  // 任务1: 历史任务，使用已用完的稀释液4
  const task1 = await prisma.processingTask.create({
    data: {
      taskName: '伊尔福 HP5+ 36张 x 2卷',
      dilutionId: dilutionD76OldHist.id,
      consumeMl: 500,
      filmType: 'Ilford HP5+ 400',
      notes: '20C 显影11分钟',
      createdAt: addDays(today, -12),
    },
  });

  // 任务2: 历史任务，使用已用完的稀释液4
  const task2 = await prisma.processingTask.create({
    data: {
      taskName: '柯达 Tri-X 36张 x 1卷',
      dilutionId: dilutionD76OldHist.id,
      consumeMl: 300,
      filmType: 'Kodak Tri-X 400',
      notes: '20C 显影10.5分钟',
      createdAt: addDays(today, -10),
    },
  });

  // 任务3: 使用浓度正常的D76稀释液2
  const task3 = await prisma.processingTask.create({
    data: {
      taskName: '富士 Acros 36张 x 1卷',
      dilutionId: dilutionD76Good.id,
      consumeMl: 200,
      filmType: 'Fuji Acros II 100',
      notes: '20C 显影9分钟',
      createdAt: addDays(today, -1),
    },
  });
  await prisma.dilution.update({
    where: { id: dilutionD76Good.id },
    data: { currentVolumeMl: { decrement: 200 } },
  });

  // 任务4: 使用F5定影液稀释液3
  const task4 = await prisma.processingTask.create({
    data: {
      taskName: '定影批次 - 3卷黑白',
      dilutionId: dilutionF5.id,
      consumeMl: 500,
      filmType: 'Mixed B&W',
      notes: '定影10分钟，流水冲洗20分钟',
      createdAt: addDays(today, -5),
    },
  });
  await prisma.dilution.update({
    where: { id: dilutionF5.id },
    data: { currentVolumeMl: { decrement: 500 } },
  });

  // 任务5: 使用低浓度D76稀释液1（触发浓度告警的记录）
  const task5 = await prisma.processingTask.create({
    data: {
      taskName: '🎯 柯达 TMax 100 x 1卷 (低浓度告警)',
      dilutionId: dilutionLowConc.id,
      consumeMl: 300,
      filmType: 'Kodak TMax 100',
      notes: '⚠️ 有效浓度低于标称70%，延长显影时间至13分钟',
      createdAt: addDays(today, -3),
    },
  });
  await prisma.dilution.update({
    where: { id: dilutionLowConc.id },
    data: { currentVolumeMl: { decrement: 300 } },
  });

  console.log(`  ✅ 任务1: ${task1.taskName}`);
  console.log(`  ✅ 任务2: ${task2.taskName}`);
  console.log(`  ✅ 任务3: ${task3.taskName}`);
  console.log(`  ✅ 任务4: ${task4.taskName}`);
  console.log(`  ✅ 任务5: ${task5.taskName} ⚠️浓度告警`);

  // ========== 5. 再更新一次原液数量使其合理 ==========
  // D76旧批次: 初始1000, 稀释1用了500，稀释4用了400，还剩100，但之前设置的是300，这里修正
  await prisma.stockBatch.update({
    where: { id: stockD76Old.id },
    data: { currentVolumeMl: 100 },
  });

  console.log('\n✅ 种子数据生成完成！');
  console.log('\n📊 数据汇总:');
  console.log(`  配方: 2 种 (D-76显影液, F-5定影液)`);
  console.log(`  原液批次: 3 个`);
  console.log(`  稀释记录: 4 条`);
  console.log(`  冲洗任务: 5 条 (含1条浓度告警)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

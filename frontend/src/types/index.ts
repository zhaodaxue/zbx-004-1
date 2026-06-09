export type ChemicalType = 'DEVELOPER' | 'FIXER';
export type BatchStatus = 'ACTIVE' | 'DISCONTINUED';
export type DilutionStatus = 'ACTIVE' | 'DISCONTINUED';

export interface Formula {
  id: string;
  name: string;
  type: ChemicalType;
  stockShelfLifeDays: number;
  standardDilutionRatio: number;
  nominalConcentration: number;
  createdAt: string;
}

export interface StockBatch {
  id: string;
  formulaId: string;
  formula: Formula;
  batchCode: string;
  openDate: string;
  initialVolumeMl: number;
  currentVolumeMl: number;
  expiryDate: string;
  status: BatchStatus;
  dilutions?: Dilution[];
  createdAt: string;
}

export interface Dilution {
  id: string;
  stockBatchId: string;
  stockBatch: StockBatch;
  stockUsedMl: number;
  waterAddedMl: number;
  totalVolumeMl: number;
  dilutionRatio: number;
  initialConcentration: number;
  remainingDaysAtDilution: number;
  initialShelfLifeDays: number;
  expiryDate: string;
  currentVolumeMl: number;
  status: DilutionStatus;
  tasks?: ProcessingTask[];
  createdAt: string;
  effectiveConcentration?: number;
}

export interface ProcessingTask {
  id: string;
  taskName: string;
  dilutionId: string;
  dilution: Dilution;
  consumeMl: number;
  filmType?: string | null;
  notes?: string | null;
  createdAt: string;
  effectiveConcentration?: number;
  lowConcentrationWarning?: boolean;
}

export interface DashboardStats {
  activeStockCount: number;
  activeDilutionCount: number;
  totalTasks: number;
  lowConcCount: number;
  expiringSoonCount: number;
  formulaCount: number;
}

export interface TraceabilityData {
  task: {
    id: string;
    taskName: string;
    consumeMl: number;
    filmType?: string | null;
    notes?: string | null;
    createdAt: string;
  };
  dilution: {
    id: string;
    stockUsedMl: number;
    waterAddedMl: number;
    totalVolumeMl: number;
    dilutionRatio: string;
    initialConcentration: string;
    effectiveConcentrationAtTask: string;
    expiryDate: string;
    createdAt: string;
    otherTasks: Array<{
      id: string;
      taskName: string;
      consumeMl: number;
      createdAt: string;
    }>;
  };
  stockBatch: {
    id: string;
    batchCode: string;
    openDate: string;
    expiryDate: string;
    initialVolumeMl: number;
    currentVolumeMl: number;
    status: string;
    allDilutions: Array<{
      id: string;
      totalVolumeMl: number;
      createdAt: string;
      totalConsumed: number;
      taskCount: number;
    }>;
  };
  formula: {
    id: string;
    name: string;
    type: ChemicalType;
    stockShelfLifeDays: number;
    standardDilutionRatio: number;
    nominalConcentration: string;
  };
}

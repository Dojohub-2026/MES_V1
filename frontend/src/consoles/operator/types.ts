export type StageStatus = 'PENDING' | 'AVAILABLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
export type JobStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type FaultSeverity = 'CRITICAL' | 'MINOR';

export interface AssignmentStage {
  id: string;
  jobId: string;
  jobDbId: string;
  jobName: string;
  jobStatus: JobStatus;
  productName: string | null;
  stageName: string;
  stationTag: string | null;
  estimatedDurationMinutes: number;
  status: StageStatus;
  scheduledStartAt: string | null;
}

export interface ResolvedFeedback {
  id: string;
  faultTitle: string;
  jobId: string | null;
  jobName: string | null;
  stageName: string | null;
  resolvedByName: string;
  resolutionNotes: string | null;
  resolvedAt: string;
}

export interface ChecklistItem {
  id: string;
  itemText: string;
  isRequired: boolean;
  sortOrder: number;
}

export interface QuantityMetric {
  id: string;
  metricName: string;
  unitLabel: string;
  minValue: number | null;
  maxValue: number | null;
  inputFrequency: 'ONCE' | 'PER_BATCH' | 'HOURLY';
}

export interface QcQuestion {
  id: string;
  questionText: string;
  responseType: 'pass_fail' | 'numeric' | 'text';
  numericMinValue: number | null;
  numericMaxValue: number | null;
  isRequired: boolean;
}

export interface QcResponseRecord {
  id: string;
  questionId: string;
  responseText: string | null;
  passed: boolean | null;
}

export interface FaultCategory {
  id: string;
  faultName: string;
  sortOrder: number;
}

export interface StageDetail {
  id: string;
  jobId: string;
  jobDbId: string;
  jobName: string;
  jobStatus: JobStatus;
  productName: string | null;
  stageName: string;
  instruction: string | null;
  stationTag: string | null;
  status: StageStatus;
  requiresQc: boolean;
  scheduledStartAt: string | null;
  actualStartedAt: string | null;
  openSessionStartedAt: string | null;
  guidelinesEnabled: boolean;
  guidelinesContent: string | null;
  checklistEnabled: boolean;
  checklistValidationTiming: 'before_start' | 'before_completion' | 'both' | null;
  checklistItems: ChecklistItem[];
  quantityLoggingEnabled: boolean;
  quantityMetrics: QuantityMetric[];
  qcFormEnabled: boolean;
  qcQuestions: QcQuestion[];
  qcResponses: QcResponseRecord[];
  faultCategoriesEnabled: boolean;
  faultCategories: FaultCategory[];
}

export interface BatchEntry {
  id: string;
  sessionId: string;
  batchNumber: number;
  loggedAt: string;
  quantityData: Record<string, number>;
  notes: string | null;
}

export const OTHER_FAULT_CATEGORY: FaultCategory = {
  id: '__other__',
  faultName: 'Other / Unspecified Issue',
  sortOrder: 9999,
};

export const INTERRUPTION_REASONS = [
  'Raw Material Delay',
  'Equipment Cleaning',
  'Shift Handoff / Break',
  'Minor Machine Clearing',
] as const;

export interface DocumentTemplate {
  id: number | string;
  templateCode: string;
  name: string;
  category: string;
  description?: string;
  currentVersion: string;
  isActive: boolean;
  fileType?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  createdAt?: string;
}

export interface TemplateVersion {
  id: number | string;
  templateId: number | string;
  version: string;
  changeNotes?: string;
  fileSize?: number;
  uploadedBy?: string;
  uploadedAt?: string;
  isActive?: boolean;
}

export interface SignatureRequest {
  id: number | string;
  accountNo: string;
  documentType: string;
  signerName: string;
  signerEmail: string;
  signerPhone?: string;
  amount?: number;
  description?: string;
  notes?: string;
  status: string;
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
  declinedAt?: string;
  expiresAt?: string;
  signatureHash?: string;
  createdAt?: string;
}

export interface SignatureAuditEntry {
  id: number | string;
  signatureId: number | string;
  action: string;
  performedBy?: string;
  performedAt: string;
  ipAddress?: string;
  details?: string;
}

export interface ProcessWorkflow {
  id: number | string;
  name: string;
  description?: string;
  isActive: boolean;
  version?: string;
  stageCount?: number;
  createdAt?: string;
  modifiedAt?: string;
  modifiedBy?: string;
}

export interface StageRule {
  id?: number | string;
  field: string;
  operator: string;
  value: string;
  logicOperator?: string;
}

export interface StageTemplate {
  id?: number | string;
  templateCode: string;
  templateName: string;
  channel?: string;
}

export interface StageAction {
  id?: number | string;
  actionType: string;
  description?: string;
  isAutomated: boolean;
  config?: string;
}

export interface StageTimer {
  waitDays: number;
  businessDaysOnly: boolean;
  escalateOnExpiry: boolean;
}

export interface WorkflowStage {
  id: number | string;
  workflowId: number | string;
  stageNumber: number;
  name: string;
  description?: string;
  isActive: boolean;
  rules: StageRule[];
  templates: StageTemplate[];
  actions: StageAction[];
  timer: StageTimer;
}

export interface BatchJob {
  id: number | string;
  jobType: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  scheduledAt?: string;
  triggeredBy?: string;
  totalRecords?: number;
  processedRecords?: number;
  failedRecords?: number;
  errorMessage?: string;
}

export interface BatchSchedule {
  id: number | string;
  jobType: string;
  cronExpression?: string;
  nextRunAt?: string;
  isActive: boolean;
  description?: string;
}

export interface ProcessMonitoringOverview {
  activeRuns: number;
  failedRuns: number;
  pendingApprovals: number;
  handoverQueued: number;
  handoverQueue?: number;
  terminationQueued: number;
  terminationQueue?: number;
  completedToday: number;
}

export interface ProcessRun {
  id: number | string;
  runType: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  startedBy?: string;
  totalAccounts?: number;
  processedAccounts?: number;
  failedAccounts?: number;
  errorMessage?: string;
  notes?: string;
}

export interface ApprovalItem {
  id: number | string;
  runType: string;
  status: string;
  submittedBy?: string;
  submittedAt?: string;
  totalAccounts?: number;
  totalAmount?: number;
  notes?: string;
}

export interface HandoverQueueItem {
  id: number | string;
  accountNo: string;
  accountName?: string;
  attorneyName?: string;
  status: string;
  queuedAt?: string;
  amount?: number;
}

export interface TerminationQueueItem {
  id: number | string;
  accountNo: string;
  accountName?: string;
  attorneyName?: string;
  status: string;
  reason?: string;
  queuedAt?: string;
  amount?: number;
}

export interface Condition {
  field: string;
  operator: string;
  value: string;
  logicOperator: 'AND' | 'OR';
}

export interface QualificationRule {
  id: number | string;
  name: string;
  description?: string;
  conditions: Condition[];
  isActive: boolean;
  createdAt?: string;
  modifiedAt?: string;
}

export interface RiskScore {
  accountNo: string;
  account_no?: string;
  overallScore: number;
  overall_score?: number;
  category: string;
  riskCategory?: string;
  risk_category?: string;
  factors: Record<string, number>;
  scoredAt?: string;
}

export interface ScoringWeight {
  factor: string;
  weight: number;
  description?: string;
}

export interface CommunicationStep {
  dayOffset: number;
  channel: string;
  templateName: string;
  templateBody: string;
  subject: string;
  isAutomated: boolean;
}

export interface CommunicationTimeline {
  id: number | string;
  name: string;
  description?: string;
  isActive: boolean;
  steps: CommunicationStep[];
  createdAt?: string;
  modifiedAt?: string;
}

export interface CommunicationLogEntry {
  id: number | string;
  accountNo: string;
  channel: string;
  status: string;
  sentAt?: string;
  deliveredAt?: string;
  templateName?: string;
  recipient?: string;
  errorMessage?: string;
}

export interface CommunicationStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalPending: number;
  byChannel: Record<string, { sent: number; delivered: number; failed: number }>;
}

export type ReviewDecision = 'Approve' | 'Decline' | '';

export interface AuthorizationRow {
  run: any;
  review: ReviewDecision;
  notes: string;
}

export interface CostItem {
  nr: number;
  additionalBillingTypeId: string;
  additionalBillingTypeName: string;
  amount: number;
}

export interface AttorneyRotationItem {
  nr: number;
  attorneyId: number;
  attorneyName: string;
  percentDebtorCount: number;
  percentHandoverAmount: number;
}

export type ConfigViewMode = 'landing' | 'detail';
export type HandoverOption = 'account' | 'bulk' | 'rotation';
export type RunType = 'trial-review' | 'trial-run';
export type DistributionType = 'email' | 'sms' | 'whatsapp' | 'print' | 'all';
export type TabMode = 'score' | 'dashboard' | 'weights';
export type CommTabMode = 'dashboard' | 'log' | 'scheduled' | 'send';

export interface QualificationRunResult {
  ruleId: number | string;
  ruleName: string;
  rule?: { name: string; id?: number | string };
  matchedAccounts: number;
  matchedCount?: number;
  unmatchedCount?: number;
  totalAccounts: number;
  totalEvaluated?: number;
  matched?: { accountNo: string; name?: string; totalArrears?: number; arrearDays?: number; propertyValue?: number; lastPayment?: string }[];
  matchedAccountsList?: { accountNo: string; name?: string; totalArrears?: number }[];
  executedAt?: string;
}

export interface Section129Config {
  demandLetterTemplate: string;
  smsTemplate: string;
  adminFees: number;
  lapseDays: number;
  noticeType: string;
  interestRate: number;
  minimumAmount: number;
  includeIndigents: boolean;
  includePensioners: boolean;
  excludeDepositBalances: boolean;
}

export interface Section129ConfigEntry {
  id?: number;
  finYear: string;
  section129Template: string;
  smsTemplate: string;
  additionalBillingType?: string;
  totalFees?: number;
  noticesPerFile: number;
  lapseDays: number;
  activateRotation: boolean;
  enabled: boolean;
  costItems?: { nr: number; additionalBillingTypeId: string; additionalBillingTypeName: string; amount: number }[];
  attorneyRotation?: { nr: number; attorneyId: number; attorneyName: string; percentDebtorCount: number; percentHandoverAmount: number }[];
}

export interface Section129Run {
  runId: number;
  status: string;
  distributionType: string;
  actionedBy: string;
  dateCreated: string;
  authorizedBy: string;
  billingCycle: string;
  runParameters: string;
  handoverOption: string;
  runType: string;
  totalAccounts: number;
  totalAmount: number;
}

export interface Section129RunAccount {
  accountId: number;
  accountNo: string;
  address: string;
  indigentStatus: string;
  rebateStatus: string;
  sgNumber: string;
  outstandingDays: number;
  qualifyingAmount: number;
  noticeFees: number;
  selected: boolean;
}

export interface Section129RunFile {
  fileId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  dateCreated: string;
}

export interface HandoverRecord {
  handoverId: number;
  accountNo: string;
  accountName: string;
  attorney: string;
  attorneyId: number;
  handoverDate: string;
  status: string;
  handedOverAmount: number;
  outstandingDays: number;
  billingCycle: string;
  handoverOption: string;
}

export interface Attorney {
  attorneyId: number;
  attorneyName: string;
  firmName: string;
  contactNumber: string;
  email: string;
  allocationPercentage: number;
  isActive: boolean;
}

export interface HandoverTermination {
  terminationId: number;
  handoverId: number;
  accountNo: string;
  attorney: string;
  reason: string;
  notes: string;
  status: string;
  terminationDate: string;
  approvedBy: string;
}

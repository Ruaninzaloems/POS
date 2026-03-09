export const RULE_FIELDS = [
  { value: 'outstandingBalance', label: 'Outstanding Balance' },
  { value: 'daysPastDue', label: 'Days Past Due' },
  { value: 'accountAge', label: 'Account Age (months)' },
  { value: 'accountType', label: 'Account Type' },
  { value: 'serviceType', label: 'Service Type' },
  { value: 'previousStageComplete', label: 'Previous Stage Complete' },
  { value: 'paymentArrangementActive', label: 'Payment Arrangement Active' },
  { value: 'indigentStatus', label: 'Indigent Status' },
  { value: 'legalHold', label: 'Legal Hold' },
  { value: 'municipalArea', label: 'Municipal Area' },
  { value: 'customerCategory', label: 'Customer Category' },
  { value: 'lastPaymentDays', label: 'Days Since Last Payment' },
] as const;

export const RULE_OPERATORS = [
  { value: 'eq', label: '= equals' },
  { value: 'neq', label: '≠ not equal' },
  { value: 'gt', label: '> greater than' },
  { value: 'gte', label: '≥ greater or equal' },
  { value: 'lt', label: '< less than' },
  { value: 'lte', label: '≤ less or equal' },
  { value: 'in', label: 'in (list)' },
  { value: 'notIn', label: 'not in (list)' },
  { value: 'isTrue', label: 'is true' },
  { value: 'isFalse', label: 'is false' },
] as const;

export const WORKFLOW_ACTION_TYPES = [
  { value: 'SEND_SMS', label: 'Send SMS' },
  { value: 'SEND_EMAIL', label: 'Send Email' },
  { value: 'SEND_LETTER', label: 'Generate & Send Letter' },
  { value: 'GENERATE_NOTICE', label: 'Generate Legal Notice' },
  { value: 'HANDOVER_ATTORNEY', label: 'Handover to Attorney' },
  { value: 'ISSUE_SUMMONS', label: 'Issue Summons' },
  { value: 'APPLY_RESTRICTION', label: 'Apply Service Restriction' },
  { value: 'FLAG_ACCOUNT', label: 'Flag Account' },
  { value: 'CREATE_TASK', label: 'Create Manual Task' },
  { value: 'ESCALATE', label: 'Escalate to Supervisor' },
  { value: 'UPDATE_STATUS', label: 'Update Account Status' },
  { value: 'WEBHOOK', label: 'Trigger Webhook' },
] as const;

export const CHANNEL_OPTIONS = [
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'LETTER', label: 'Letter' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
] as const;

export const TEMPLATE_CATEGORIES = [
  { value: 'SECTION_129', label: 'Section 129 Notices' },
  { value: 'HANDOVER', label: 'Handover Documents' },
  { value: 'AOD', label: 'Acknowledgement of Debt' },
  { value: 'FINAL_DEMAND', label: 'Final Demand' },
  { value: 'SUMMONS', label: 'Summons' },
  { value: 'ARRANGEMENT', label: 'Payment Arrangement' },
  { value: 'CLEARANCE', label: 'Clearance Certificate' },
  { value: 'GENERAL', label: 'General' },
] as const;

export const DOC_TYPES = [
  { value: 'AOD', label: 'Acknowledgement of Debt' },
  { value: 'PAYMENT_ARRANGEMENT', label: 'Payment Arrangement' },
  { value: 'SETTLEMENT_AGREEMENT', label: 'Settlement Agreement' },
  { value: 'CONSENT_ORDER', label: 'Consent to Judgment / Order' },
  { value: 'GENERAL', label: 'General Document' },
] as const;

export const LEGAL_CATEGORIES = [
  { value: 'NCA', label: 'National Credit Act' },
  { value: 'MSA', label: 'Municipal Systems Act' },
  { value: 'MPRA', label: 'Municipal Property Rates Act' },
  { value: 'POPIA', label: 'POPIA' },
  { value: 'CPA', label: 'Consumer Protection Act' },
] as const;

export const LEGAL_CATEGORY_LABELS: Record<string, string> = {
  NCA: 'National Credit Act',
  MSA: 'Municipal Systems Act',
  MPRA: 'Municipal Property Rates Act',
  POPIA: 'POPIA',
  CPA: 'Consumer Protection Act',
};

export const AUDIT_ACTION_TYPES = [
  { value: '__all__', label: 'All' },
  { value: 'NOTICE_ISSUED', label: 'Notice Issued' },
  { value: 'HANDOVER_SUBMITTED', label: 'Handover Submitted' },
  { value: 'AUTHORIZATION', label: 'Authorization' },
  { value: 'FINAL_RUN', label: 'Final Run' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'CONFIG_CHANGE', label: 'Config Change' },
] as const;

export const EVIDENCE_BUNDLE_SECTIONS = [
  { key: 'noticeHistory', label: 'Notice History' },
  { key: 'smsLogs', label: 'SMS Logs' },
  { key: 'emailLogs', label: 'Email Logs' },
  { key: 'postalBatch', label: 'Postal Batch Records' },
  { key: 'accountLedger', label: 'Account Ledger Summary' },
  { key: 'proofOfService', label: 'Proof of Service' },
] as const;

export const QUALIFICATION_FIELD_OPTIONS = [
  { value: 'waterArrears', label: 'Water Arrears (R)' },
  { value: 'electricityArrears', label: 'Electricity Arrears (R)' },
  { value: 'ratesArrears', label: 'Rates Arrears (R)' },
  { value: 'refuseArrears', label: 'Refuse Arrears (R)' },
  { value: 'sewerageArrears', label: 'Sewerage Arrears (R)' },
  { value: 'totalArrears', label: 'Total Arrears (R)' },
  { value: 'arrearDays', label: 'Arrear Age (days)' },
  { value: 'lastPaymentDays', label: 'Days Since Last Payment' },
  { value: 'propertyValue', label: 'Property Value (R)' },
  { value: 'overallScore', label: 'Risk Score (0-100)' },
  { value: 'indigentStatus', label: 'Indigent Status' },
  { value: 'previousLegalActions', label: 'Previous Legal Actions' },
  { value: 'debtSize', label: 'Debt Size (R)' },
  { value: 'paymentHistory', label: 'Payment History Score' },
  { value: 'locationRisk', label: 'Location Risk Score' },
] as const;

export const QUALIFICATION_OPERATOR_OPTIONS = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: 'contains', label: 'contains' },
] as const;

export const TERMINATION_REASONS = [
  { value: 'paid_in_full', label: 'Paid in Full' },
  { value: 'write_off', label: 'Write-off' },
  { value: 'settlement', label: 'Settlement' },
  { value: 'other', label: 'Other' },
] as const;

export const RISK_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  LOW: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-500' },
  HIGH: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', bar: 'bg-red-500' },
  UNKNOWN: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', bar: 'bg-slate-400' },
};

export const IMPACT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  HIGH: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  LOW: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  POSITIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  NEUTRAL: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  NEGATIVE: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

export const SIGNATURE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  SENT: { label: 'Sent', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  VIEWED: { label: 'Viewed', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  SIGNED: { label: 'Signed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  DECLINED: { label: 'Declined', className: 'bg-red-100 text-red-700 border-red-200' },
  EXPIRED: { label: 'Expired', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export const BATCH_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  RUNNING: { label: 'Running', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
  CANCELLED: { label: 'Cancelled', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
};

export const BATCH_JOB_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  TRIAL_RUN: { label: 'Trial Run', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  FINAL_RUN: { label: 'Final Run', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  LAPSE_CHECK: { label: 'Lapse Check', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  NOTIFICATION: { label: 'Notification', color: 'text-teal-600 bg-teal-50 border-teal-200' },
  ATTORNEY_ALLOCATION: { label: 'Attorney Allocation', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
};

export const PROCESS_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  RUNNING: { label: 'Running', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
  PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  QUEUED: { label: 'Queued', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  PROCESSING: { label: 'Processing', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700 border-red-200' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  TERMINATED: { label: 'Terminated', className: 'bg-gray-100 text-gray-700 border-gray-200' },
};

export const CHANNEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  sms: { label: 'SMS', color: 'text-green-700', bg: 'bg-green-50' },
  email: { label: 'Email', color: 'text-blue-700', bg: 'bg-blue-50' },
  whatsapp: { label: 'WhatsApp', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  letter: { label: 'Letter', color: 'text-amber-700', bg: 'bg-amber-50' },
};

export const COMM_STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  SENT: { color: 'text-emerald-700', bg: 'bg-emerald-50' },
  DELIVERED: { color: 'text-emerald-700', bg: 'bg-emerald-50' },
  FAILED: { color: 'text-red-700', bg: 'bg-red-50' },
  PENDING: { color: 'text-amber-700', bg: 'bg-amber-50' },
  COMPLETED: { color: 'text-emerald-700', bg: 'bg-emerald-50' },
  SKIPPED: { color: 'text-slate-600', bg: 'bg-slate-100' },
};

export const PAGE_SIZE = 50;

export const SECTION129_DEFAULTS = {
  section129Template: 'Section 129 Standard',
  smsTemplate: 'SMS Notification',
  lapseDays: 14,
  noticesPerFile: 500,
  activateRotation: true,
  enabled: true,
} as const;

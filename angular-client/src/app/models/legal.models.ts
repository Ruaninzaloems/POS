export interface LegalRuleVersion {
  id: number;
  ruleCode: string;
  title: string;
  category: string;
  description: string;
  legislativeRef: string;
  isActive: boolean;
  version: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  conditions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RuleFormData {
  ruleCode: string;
  title: string;
  legislationRef: string;
  description: string;
  category: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
}

export interface ComplianceLogEntry {
  id: number | string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  apiCallId?: string;
  timestamp?: string;
  legislationRef?: string;
  details?: string;
  accountNo?: string;
  outcome?: string;
}

export interface EvidenceBundle {
  id: number;
  accountNo: string;
  bundleReference: string;
  generatedBy: string;
  generatedAt: string;
  bundleData: Record<string, any>;
  status: string;
}

export interface BundleSection {
  key: string;
  label: string;
}

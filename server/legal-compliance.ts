import { db } from "./db";
import { legalRuleVersions, legalComplianceLog, litigationEvidenceBundles } from "@shared/schema";
import type { LegalRuleVersion, InsertLegalRuleVersion, LegalComplianceLog, InsertLegalComplianceLog, LitigationEvidenceBundle } from "@shared/schema";
import { eq, and, desc, gte, lte, ilike, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Request } from "express";

const ACTION_RULE_MAP: Record<string, string[]> = {
  NOTICE_ISSUED: ['NCA', 'MSA', 'POPIA', 'CPA'],
  HANDOVER_SUBMITTED: ['NCA', 'MSA', 'MPRA'],
  AUTHORIZATION: ['NCA', 'MSA'],
  FINAL_RUN: ['NCA', 'MSA', 'POPIA'],
  TERMINATION: ['NCA', 'MSA'],
  CONFIG_CHANGE: ['MSA'],
  TRIAL_RUN: ['NCA', 'MSA', 'POPIA'],
  TRIAL_REVIEW: ['NCA', 'MSA'],
  SMS_SENT: ['POPIA', 'CPA'],
  EMAIL_SENT: ['POPIA', 'CPA'],
};

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.trim() || '';
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function generateApiCallId(): string {
  return randomUUID();
}

export class LegalRulesEngine {
  async getApplicableRules(actionType: string): Promise<LegalRuleVersion[]> {
    const categories = ACTION_RULE_MAP[actionType] || [];
    if (categories.length === 0) return [];

    const rules = await db
      .select()
      .from(legalRuleVersions)
      .where(
        and(
          eq(legalRuleVersions.isActive, true),
          or(...categories.map(cat => eq(legalRuleVersions.category, cat)))
        )
      );
    return rules;
  }

  async validateAction(
    actionType: string,
    entityType: string,
    metadata?: Record<string, any>
  ): Promise<{ valid: boolean; appliedRules: LegalRuleVersion[]; violations: string[] }> {
    const rules = await this.getApplicableRules(actionType);
    const violations: string[] = [];

    for (const rule of rules) {
      if (rule.category === 'POPIA' && (actionType === 'SMS_SENT' || actionType === 'EMAIL_SENT' || actionType === 'NOTICE_ISSUED')) {
        if (!metadata?.consentVerified && !metadata?.statutoryException) {
          violations.push(`${rule.ruleCode}: POPIA consent not verified or statutory exception not declared - ${rule.legislationRef}`);
        }
      }

      if (rule.category === 'NCA' && actionType === 'NOTICE_ISSUED') {
        if (!metadata?.noticeType) {
          violations.push(`${rule.ruleCode}: Notice type must be specified per ${rule.legislationRef}`);
        }
      }

      if (rule.effectiveTo && new Date(rule.effectiveTo) < new Date()) {
        violations.push(`${rule.ruleCode}: Rule has expired (effective until ${rule.effectiveTo}) - legislation may have changed`);
      }
    }

    return {
      valid: violations.length === 0,
      appliedRules: rules,
      violations,
    };
  }

  async logComplianceAction(params: {
    actionType: string;
    entityType: string;
    entityId: string;
    processStage: string;
    userId?: string;
    userName?: string;
    ipAddress?: string;
    proofOfDelivery?: string;
    documentVersion?: string;
    communicationProof?: any;
    metadata?: any;
  }): Promise<LegalComplianceLog> {
    const apiCallId = generateApiCallId();
    const rules = await this.getApplicableRules(params.actionType);
    const primaryRule = rules[0];

    const [log] = await db
      .insert(legalComplianceLog)
      .values({
        actionType: params.actionType,
        entityType: params.entityType,
        entityId: params.entityId,
        ruleVersionId: primaryRule?.id || null,
        legislationRef: primaryRule?.legislationRef || null,
        processStage: params.processStage,
        proofOfDelivery: params.proofOfDelivery || null,
        userId: params.userId || null,
        userName: params.userName || null,
        ipAddress: params.ipAddress || null,
        apiCallId,
        documentVersion: params.documentVersion || null,
        communicationProof: params.communicationProof || null,
        metadata: {
          ...params.metadata,
          appliedRules: rules.map(r => ({ ruleCode: r.ruleCode, version: r.version, legislationRef: r.legislationRef })),
        },
      })
      .returning();

    return log;
  }

  async getComplianceLogs(filters: {
    actionType?: string;
    entityType?: string;
    entityId?: string;
    accountNo?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<LegalComplianceLog[]> {
    const conditions = [];

    if (filters.actionType) conditions.push(eq(legalComplianceLog.actionType, filters.actionType));
    if (filters.entityType) conditions.push(eq(legalComplianceLog.entityType, filters.entityType));
    if (filters.entityId) conditions.push(eq(legalComplianceLog.entityId, filters.entityId));
    if (filters.accountNo) conditions.push(eq(legalComplianceLog.entityId, filters.accountNo));
    if (filters.userId) conditions.push(eq(legalComplianceLog.userId, filters.userId));
    if (filters.dateFrom) conditions.push(gte(legalComplianceLog.timestamp, new Date(filters.dateFrom)));
    if (filters.dateTo) conditions.push(lte(legalComplianceLog.timestamp, new Date(filters.dateTo)));

    const query = db
      .select()
      .from(legalComplianceLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(legalComplianceLog.timestamp))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);

    return query;
  }

  async generateEvidenceBundle(accountNo: string, generatedBy: string): Promise<LitigationEvidenceBundle> {
    const logs = await db
      .select()
      .from(legalComplianceLog)
      .where(eq(legalComplianceLog.entityId, accountNo))
      .orderBy(desc(legalComplianceLog.timestamp));

    const noticeHistory = logs.filter(l => ['NOTICE_ISSUED', 'TRIAL_RUN', 'TRIAL_REVIEW', 'FINAL_RUN'].includes(l.actionType));
    const smsLogs = logs.filter(l => l.actionType === 'SMS_SENT' || l.proofOfDelivery === 'SMS_SENT');
    const emailLogs = logs.filter(l => l.actionType === 'EMAIL_SENT' || l.proofOfDelivery === 'EMAIL_SENT');
    const postalBatch = logs.filter(l => l.proofOfDelivery === 'POSTAL_DISPATCHED');
    const handoverRecords = logs.filter(l => ['HANDOVER_SUBMITTED', 'TERMINATION'].includes(l.actionType));
    const allProofs = logs.filter(l => l.communicationProof !== null);

    const bundleReference = `LEB-${accountNo}-${Date.now()}`;

    const [bundle] = await db
      .insert(litigationEvidenceBundles)
      .values({
        accountNo,
        bundleReference,
        generatedBy,
        bundleData: {
          generatedAt: new Date().toISOString(),
          accountNo,
          noticeHistory: noticeHistory.map(l => ({
            id: l.id,
            actionType: l.actionType,
            processStage: l.processStage,
            timestamp: l.timestamp,
            userId: l.userId,
            userName: l.userName,
            ipAddress: l.ipAddress,
            apiCallId: l.apiCallId,
            legislationRef: l.legislationRef,
            documentVersion: l.documentVersion,
            metadata: l.metadata,
          })),
          smsLogs: smsLogs.map(l => ({
            id: l.id,
            timestamp: l.timestamp,
            communicationProof: l.communicationProof,
            proofOfDelivery: l.proofOfDelivery,
          })),
          emailLogs: emailLogs.map(l => ({
            id: l.id,
            timestamp: l.timestamp,
            communicationProof: l.communicationProof,
            proofOfDelivery: l.proofOfDelivery,
          })),
          postalBatch: postalBatch.map(l => ({
            id: l.id,
            timestamp: l.timestamp,
            proofOfDelivery: l.proofOfDelivery,
            metadata: l.metadata,
          })),
          accountLedger: {
            totalActions: logs.length,
            firstAction: logs[logs.length - 1]?.timestamp || null,
            lastAction: logs[0]?.timestamp || null,
            actionSummary: Object.entries(
              logs.reduce((acc, l) => {
                acc[l.actionType] = (acc[l.actionType] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([type, count]) => ({ type, count })),
          },
          proofOfService: allProofs.map(l => ({
            id: l.id,
            actionType: l.actionType,
            timestamp: l.timestamp,
            proofOfDelivery: l.proofOfDelivery,
            communicationProof: l.communicationProof,
            apiCallId: l.apiCallId,
          })),
          handoverRecords: handoverRecords.map(l => ({
            id: l.id,
            actionType: l.actionType,
            timestamp: l.timestamp,
            processStage: l.processStage,
            metadata: l.metadata,
          })),
        },
        status: 'GENERATED',
      })
      .returning();

    return bundle;
  }

  async getEvidenceBundles(filters?: { accountNo?: string; limit?: number }): Promise<LitigationEvidenceBundle[]> {
    const conditions = [];
    if (filters?.accountNo) conditions.push(eq(litigationEvidenceBundles.accountNo, filters.accountNo));

    return db
      .select()
      .from(litigationEvidenceBundles)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(litigationEvidenceBundles.generatedAt))
      .limit(filters?.limit || 50);
  }

  async getEvidenceBundle(id: number): Promise<LitigationEvidenceBundle | undefined> {
    const [bundle] = await db
      .select()
      .from(litigationEvidenceBundles)
      .where(eq(litigationEvidenceBundles.id, id));
    return bundle;
  }

  async getAllRules(filters?: { category?: string; isActive?: boolean }): Promise<LegalRuleVersion[]> {
    const conditions = [];
    if (filters?.category) conditions.push(eq(legalRuleVersions.category, filters.category));
    if (filters?.isActive !== undefined) conditions.push(eq(legalRuleVersions.isActive, filters.isActive));

    return db
      .select()
      .from(legalRuleVersions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(legalRuleVersions.createdAt));
  }

  async createRule(rule: InsertLegalRuleVersion): Promise<LegalRuleVersion> {
    const [created] = await db.insert(legalRuleVersions).values(rule).returning();
    return created;
  }

  async updateRule(id: number, updates: Partial<InsertLegalRuleVersion>): Promise<LegalRuleVersion | undefined> {
    const [existing] = await db.select().from(legalRuleVersions).where(eq(legalRuleVersions.id, id));
    if (!existing) return undefined;

    await db.update(legalRuleVersions).set({ isActive: false, updatedAt: new Date() }).where(eq(legalRuleVersions.id, id));

    const newVersion = existing.version + 1;
    const newRuleCode = existing.ruleCode.replace(/_v\d+$/, '') + `_v${newVersion}`;

    const [created] = await db.insert(legalRuleVersions).values({
      ruleCode: newRuleCode,
      legislationRef: updates.legislationRef || existing.legislationRef,
      title: updates.title || existing.title,
      description: updates.description !== undefined ? updates.description : existing.description,
      version: newVersion,
      effectiveFrom: updates.effectiveFrom || new Date(),
      effectiveTo: updates.effectiveTo !== undefined ? updates.effectiveTo : existing.effectiveTo,
      category: updates.category || existing.category,
      isActive: updates.isActive !== undefined ? updates.isActive : true,
    }).returning();

    return created;
  }

  async deactivateRule(id: number): Promise<LegalRuleVersion | undefined> {
    const [updated] = await db
      .update(legalRuleVersions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(legalRuleVersions.id, id))
      .returning();
    return updated;
  }
}

const DEFAULT_RULES: InsertLegalRuleVersion[] = [
  {
    ruleCode: 'NCA_S129_NOTICE',
    title: 'National Credit Act Section 129 - Notice Requirements',
    legislationRef: 'National Credit Act 34 of 2005, Section 129(1)(a)',
    description: 'A credit provider must deliver a notice to the consumer in writing before commencing legal proceedings. The notice must propose that the consumer refer the credit agreement to a debt counsellor, alternative dispute resolution agent, consumer court, or ombud.',
    category: 'NCA',
    version: 1,
    effectiveFrom: new Date('2006-06-01'),
    isActive: true,
  },
  {
    ruleCode: 'NCA_S129_TIMEFRAME',
    title: 'Section 129 Notice Delivery Timeframe',
    legislationRef: 'National Credit Act 34 of 2005, Section 130(1)',
    description: 'A credit provider may not commence legal proceedings until at least 10 business days after delivery of the Section 129 notice. The consumer must be given reasonable opportunity to respond.',
    category: 'NCA',
    version: 1,
    effectiveFrom: new Date('2006-06-01'),
    isActive: true,
  },
  {
    ruleCode: 'MSA_CREDIT_CONTROL',
    title: 'Municipal Systems Act - Credit Control and Debt Collection',
    legislationRef: 'Municipal Systems Act 32 of 2000, Sections 96-99',
    description: 'Every municipality must adopt, maintain and implement a credit control and debt collection policy consistent with its rates and tariff policies. The policy must provide for credit control procedures, debt collection procedures, and provision for indigent debtors.',
    category: 'MSA',
    version: 1,
    effectiveFrom: new Date('2000-11-30'),
    isActive: true,
  },
  {
    ruleCode: 'MSA_CUSTOMER_CARE',
    title: 'Customer Care and Management Policy',
    legislationRef: 'Municipal Systems Act 32 of 2000, Section 95',
    description: 'Municipalities must within their financial and administrative capacity establish a sound customer management system including accessible pay points, communication, accounts, and metering.',
    category: 'MSA',
    version: 1,
    effectiveFrom: new Date('2000-11-30'),
    isActive: true,
  },
  {
    ruleCode: 'MPRA_RATES_COMPLIANCE',
    title: 'Municipal Property Rates Act Compliance',
    legislationRef: 'Municipal Property Rates Act 6 of 2004, Sections 3, 14-16',
    description: 'A municipality may levy rates on property only in terms of a rates policy adopted by the council. The municipality must maintain a valuation roll and apply rates consistently. Rebates and reductions must be administered per policy.',
    category: 'MPRA',
    version: 1,
    effectiveFrom: new Date('2004-05-27'),
    isActive: true,
  },
  {
    ruleCode: 'POPIA_CONSENT',
    title: 'POPIA Communication Consent Requirements',
    legislationRef: 'Protection of Personal Information Act 4 of 2013, Section 11',
    description: 'Personal information may only be processed if the data subject consents, or processing is necessary to comply with a legal obligation, or to protect a legitimate interest of the data subject. Municipal statutory debt recovery qualifies as a statutory exception under Section 11(1)(c).',
    category: 'POPIA',
    version: 1,
    effectiveFrom: new Date('2021-07-01'),
    isActive: true,
  },
  {
    ruleCode: 'POPIA_DATA_RETENTION',
    title: 'POPIA Data Retention and Purpose Limitation',
    legislationRef: 'Protection of Personal Information Act 4 of 2013, Section 14',
    description: 'Records of personal information must not be retained longer than necessary for achieving the purpose for which the information was collected, unless retention is required by law or a contract, or the data subject has consented.',
    category: 'POPIA',
    version: 1,
    effectiveFrom: new Date('2021-07-01'),
    isActive: true,
  },
  {
    ruleCode: 'CPA_NOTICE_REQUIREMENTS',
    title: 'Consumer Protection Act Notice Requirements',
    legislationRef: 'Consumer Protection Act 68 of 2008, Section 14',
    description: 'Suppliers must give consumers notice in plain and understandable language. Notices must be sent at least 20 business days before the proposed action. The notice must be in the prescribed form.',
    category: 'CPA',
    version: 1,
    effectiveFrom: new Date('2011-04-01'),
    isActive: true,
  },
];

export async function seedDefaultRules(): Promise<void> {
  try {
    const existing = await db.select({ count: sql<number>`count(*)` }).from(legalRuleVersions);
    const count = Number(existing[0]?.count || 0);
    if (count > 0) {
      console.log(`[LegalCompliance] ${count} legal rules already exist, skipping seed.`);
      return;
    }
    await db.insert(legalRuleVersions).values(DEFAULT_RULES);
    console.log(`[LegalCompliance] Seeded ${DEFAULT_RULES.length} default legal rules.`);
  } catch (e: any) {
    console.error(`[LegalCompliance] Failed to seed default rules:`, e.message);
  }
}

export const legalEngine = new LegalRulesEngine();

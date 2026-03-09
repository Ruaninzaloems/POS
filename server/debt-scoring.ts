import { db } from "./db";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import {
  debtRiskScores,
  debtQualificationRules,
  debtScoringWeights,
  type InsertDebtRiskScore,
  type DebtRiskScore,
  type InsertDebtQualificationRule,
  type DebtQualificationRule,
  type DebtScoringWeight,
} from "@shared/schema";

export interface AccountData {
  accountNo: string;
  paymentHistory?: number;
  arrearAge?: number;
  paymentFrequency?: number;
  debtSize?: number;
  indigentStatus?: boolean;
  serviceTypes?: string[];
  previousLegalActions?: number;
  locationRisk?: number;
  waterArrears?: number;
  electricityArrears?: number;
  ratesArrears?: number;
  refuseArrears?: number;
  sewerageArrears?: number;
  totalArrears?: number;
  arrearDays?: number;
  lastPaymentDays?: number;
  propertyValue?: number;
  [key: string]: any;
}

export interface FactorScore {
  key: string;
  label: string;
  rawValue: number;
  normalizedScore: number;
  weight: number;
  weightedScore: number;
}

export interface RiskScoreResult {
  accountNo: string;
  overallScore: number;
  riskCategory: "LOW" | "MEDIUM" | "HIGH";
  factors: FactorScore[];
}

export interface QualificationCondition {
  field: string;
  operator: ">" | "<" | ">=" | "<=" | "=" | "!=" | "contains";
  value: string | number | boolean;
  logicOperator?: "AND" | "OR";
}

const DEFAULT_WEIGHTS: Record<string, { label: string; weight: number; description: string }> = {
  payment_history: { label: "Payment History", weight: 15, description: "Score based on consistency of past payments (missed payments increase score)" },
  arrear_age: { label: "Arrear Age", weight: 20, description: "Age of oldest outstanding arrears in days" },
  payment_frequency: { label: "Payment Frequency", weight: 10, description: "How frequently the debtor makes payments (less frequent = higher risk)" },
  debt_size: { label: "Debt Size", weight: 20, description: "Total outstanding debt amount relative to thresholds" },
  indigent_status: { label: "Indigent Status", weight: 5, description: "Whether the account is registered as indigent (reduces risk score)" },
  service_type: { label: "Service Type", weight: 10, description: "Risk varies by service type — essential services score higher" },
  previous_legal: { label: "Previous Legal Actions", weight: 15, description: "Number of previous legal actions (more = higher recidivism risk)" },
  location_risk: { label: "Location Risk", weight: 5, description: "Area-based payment risk derived from collection rates in the location" },
};

export class DebtScoringEngine {
  async getWeights(): Promise<Record<string, { label: string; weight: number; description: string }>> {
    const rows = await db.select().from(debtScoringWeights);
    if (rows.length === 0) return { ...DEFAULT_WEIGHTS };

    const result: Record<string, { label: string; weight: number; description: string }> = {};
    for (const row of rows) {
      result[row.factorKey] = {
        label: row.label,
        weight: parseFloat(row.weight),
        description: row.description || "",
      };
    }
    return result;
  }

  async updateWeights(weights: Record<string, number>): Promise<void> {
    const allWeights = await this.getWeights();

    for (const [key, newWeight] of Object.entries(weights)) {
      const existing = allWeights[key];
      if (!existing) continue;

      const existingRow = await db.select().from(debtScoringWeights).where(eq(debtScoringWeights.factorKey, key));
      if (existingRow.length > 0) {
        await db.update(debtScoringWeights).set({ weight: String(newWeight), updatedAt: new Date() }).where(eq(debtScoringWeights.factorKey, key));
      } else {
        await db.insert(debtScoringWeights).values({
          factorKey: key,
          label: existing.label,
          weight: String(newWeight),
          description: existing.description,
        });
      }
    }
  }

  categorizeRisk(score: number): "LOW" | "MEDIUM" | "HIGH" {
    if (score <= 30) return "LOW";
    if (score <= 60) return "MEDIUM";
    return "HIGH";
  }

  calculateRiskScore(accountData: AccountData, weights: Record<string, { label: string; weight: number; description: string }>): RiskScoreResult {
    const factors: FactorScore[] = [];
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w.weight, 0);

    const normalizeWeight = (w: number) => (totalWeight > 0 ? (w / totalWeight) * 100 : 0);

    const paymentHistoryRaw = accountData.paymentHistory ?? 50;
    factors.push({
      key: "payment_history",
      label: weights.payment_history?.label || "Payment History",
      rawValue: paymentHistoryRaw,
      normalizedScore: Math.min(100, Math.max(0, paymentHistoryRaw)),
      weight: normalizeWeight(weights.payment_history?.weight || 15),
      weightedScore: 0,
    });

    const arrearAgeDays = accountData.arrearAge ?? accountData.arrearDays ?? 0;
    const arrearAgeScore = Math.min(100, (arrearAgeDays / 365) * 100);
    factors.push({
      key: "arrear_age",
      label: weights.arrear_age?.label || "Arrear Age",
      rawValue: arrearAgeDays,
      normalizedScore: arrearAgeScore,
      weight: normalizeWeight(weights.arrear_age?.weight || 20),
      weightedScore: 0,
    });

    const payFreqDays = accountData.paymentFrequency ?? accountData.lastPaymentDays ?? 30;
    const payFreqScore = Math.min(100, (payFreqDays / 180) * 100);
    factors.push({
      key: "payment_frequency",
      label: weights.payment_frequency?.label || "Payment Frequency",
      rawValue: payFreqDays,
      normalizedScore: payFreqScore,
      weight: normalizeWeight(weights.payment_frequency?.weight || 10),
      weightedScore: 0,
    });

    const debtAmount = accountData.debtSize ?? accountData.totalArrears ?? 0;
    const debtSizeScore = Math.min(100, (debtAmount / 50000) * 100);
    factors.push({
      key: "debt_size",
      label: weights.debt_size?.label || "Debt Size",
      rawValue: debtAmount,
      normalizedScore: debtSizeScore,
      weight: normalizeWeight(weights.debt_size?.weight || 20),
      weightedScore: 0,
    });

    const isIndigent = accountData.indigentStatus === true;
    const indigentScore = isIndigent ? 10 : 50;
    factors.push({
      key: "indigent_status",
      label: weights.indigent_status?.label || "Indigent Status",
      rawValue: isIndigent ? 1 : 0,
      normalizedScore: indigentScore,
      weight: normalizeWeight(weights.indigent_status?.weight || 5),
      weightedScore: 0,
    });

    const serviceTypes = accountData.serviceTypes || [];
    const essentialServices = ["water", "electricity", "sewerage"];
    const hasEssential = serviceTypes.some(s => essentialServices.includes(s.toLowerCase()));
    const serviceScore = hasEssential ? 70 : 40;
    factors.push({
      key: "service_type",
      label: weights.service_type?.label || "Service Type",
      rawValue: serviceTypes.length,
      normalizedScore: serviceScore,
      weight: normalizeWeight(weights.service_type?.weight || 10),
      weightedScore: 0,
    });

    const legalActions = accountData.previousLegalActions ?? 0;
    const legalScore = Math.min(100, legalActions * 25);
    factors.push({
      key: "previous_legal",
      label: weights.previous_legal?.label || "Previous Legal Actions",
      rawValue: legalActions,
      normalizedScore: legalScore,
      weight: normalizeWeight(weights.previous_legal?.weight || 15),
      weightedScore: 0,
    });

    const locRisk = accountData.locationRisk ?? 50;
    factors.push({
      key: "location_risk",
      label: weights.location_risk?.label || "Location Risk",
      rawValue: locRisk,
      normalizedScore: Math.min(100, Math.max(0, locRisk)),
      weight: normalizeWeight(weights.location_risk?.weight || 5),
      weightedScore: 0,
    });

    let overallScore = 0;
    for (const f of factors) {
      f.weightedScore = (f.normalizedScore * f.weight) / 100;
      overallScore += f.weightedScore;
    }

    overallScore = Math.min(100, Math.max(0, Math.round(overallScore * 100) / 100));

    return {
      accountNo: accountData.accountNo,
      overallScore,
      riskCategory: this.categorizeRisk(overallScore),
      factors,
    };
  }

  async scoreAccount(accountData: AccountData, scoredBy?: string): Promise<DebtRiskScore> {
    const weights = await this.getWeights();
    const result = this.calculateRiskScore(accountData, weights);

    const existing = await db.select().from(debtRiskScores).where(eq(debtRiskScores.accountNo, result.accountNo));
    if (existing.length > 0) {
      const [updated] = await db
        .update(debtRiskScores)
        .set({
          overallScore: String(result.overallScore),
          riskCategory: result.riskCategory,
          factorScores: result.factors,
          scoredBy: scoredBy || null,
          scoredAt: new Date(),
          metadata: accountData,
        })
        .where(eq(debtRiskScores.accountNo, result.accountNo))
        .returning();
      return updated;
    }

    const [saved] = await db
      .insert(debtRiskScores)
      .values({
        accountNo: result.accountNo,
        overallScore: String(result.overallScore),
        riskCategory: result.riskCategory,
        factorScores: result.factors,
        scoredBy: scoredBy || null,
        metadata: accountData,
      })
      .returning();
    return saved;
  }

  async scoreBulk(accounts: AccountData[], scoredBy?: string): Promise<DebtRiskScore[]> {
    const results: DebtRiskScore[] = [];
    for (const acc of accounts) {
      const result = await this.scoreAccount(acc, scoredBy);
      results.push(result);
    }
    return results;
  }

  async getScores(filters?: { riskCategory?: string; minScore?: number; maxScore?: number; limit?: number; offset?: number }): Promise<{ scores: DebtRiskScore[]; total: number }> {
    const conditions = [];
    if (filters?.riskCategory) conditions.push(eq(debtRiskScores.riskCategory, filters.riskCategory));
    if (filters?.minScore !== undefined) conditions.push(gte(debtRiskScores.overallScore, String(filters.minScore)));
    if (filters?.maxScore !== undefined) conditions.push(lte(debtRiskScores.overallScore, String(filters.maxScore)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(debtRiskScores)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    const scores = await db
      .select()
      .from(debtRiskScores)
      .where(whereClause)
      .orderBy(desc(debtRiskScores.overallScore))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    return { scores, total };
  }

  async getScoreByAccount(accountNo: string): Promise<DebtRiskScore | undefined> {
    const [score] = await db.select().from(debtRiskScores).where(eq(debtRiskScores.accountNo, accountNo));
    return score;
  }

  evaluateCondition(condition: QualificationCondition, accountData: AccountData): boolean {
    const fieldValue = accountData[condition.field];
    if (fieldValue === undefined || fieldValue === null) return false;

    const numVal = typeof fieldValue === "number" ? fieldValue : parseFloat(String(fieldValue));
    const condVal = typeof condition.value === "number" ? condition.value : parseFloat(String(condition.value));

    switch (condition.operator) {
      case ">": return numVal > condVal;
      case "<": return numVal < condVal;
      case ">=": return numVal >= condVal;
      case "<=": return numVal <= condVal;
      case "=": return String(fieldValue) === String(condition.value);
      case "!=": return String(fieldValue) !== String(condition.value);
      case "contains":
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      default: return false;
    }
  }

  evaluateQualificationRule(rule: DebtQualificationRule, accountData: AccountData): boolean {
    const conditions = rule.conditions as QualificationCondition[];
    if (!conditions || conditions.length === 0) return true;

    let result = this.evaluateCondition(conditions[0], accountData);

    for (let i = 1; i < conditions.length; i++) {
      const cond = conditions[i];
      const condResult = this.evaluateCondition(cond, accountData);
      const logic = cond.logicOperator || "AND";

      if (logic === "OR") {
        result = result || condResult;
      } else {
        result = result && condResult;
      }
    }

    return result;
  }

  async createRule(rule: InsertDebtQualificationRule): Promise<DebtQualificationRule> {
    const [created] = await db.insert(debtQualificationRules).values(rule).returning();
    return created;
  }

  async updateRule(id: number, updates: Partial<InsertDebtQualificationRule>): Promise<DebtQualificationRule | undefined> {
    const [updated] = await db
      .update(debtQualificationRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(debtQualificationRules.id, id))
      .returning();
    return updated;
  }

  async deleteRule(id: number): Promise<boolean> {
    const result = await db.delete(debtQualificationRules).where(eq(debtQualificationRules.id, id));
    return true;
  }

  async getAllRules(activeOnly?: boolean): Promise<DebtQualificationRule[]> {
    if (activeOnly) {
      return db.select().from(debtQualificationRules).where(eq(debtQualificationRules.isActive, true)).orderBy(desc(debtQualificationRules.priority));
    }
    return db.select().from(debtQualificationRules).orderBy(desc(debtQualificationRules.priority));
  }

  async getRule(id: number): Promise<DebtQualificationRule | undefined> {
    const [rule] = await db.select().from(debtQualificationRules).where(eq(debtQualificationRules.id, id));
    return rule;
  }

  async seedDefaultWeights(): Promise<void> {
    const existing = await db.select().from(debtScoringWeights);
    if (existing.length > 0) return;

    for (const [key, val] of Object.entries(DEFAULT_WEIGHTS)) {
      await db.insert(debtScoringWeights).values({
        factorKey: key,
        label: val.label,
        weight: String(val.weight),
        description: val.description,
      });
    }
    console.log("[DebtScoring] Seeded default scoring weights");
  }
}

export const debtScoringEngine = new DebtScoringEngine();
export function seedDefaultWeights() { return debtScoringEngine.seedDefaultWeights(); }

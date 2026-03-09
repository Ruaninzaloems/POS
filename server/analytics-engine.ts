import { db } from "./db";
import { eq, desc, sql, and, gte, lte, count } from "drizzle-orm";
import {
  debtRiskScores,
  legalComplianceLog,
  communicationLog,
  scheduledCommunications,
  communicationTimelines,
} from "@shared/schema";
import { platinumGet } from "./platinum-auth";
import type { UserSession } from "./platinum-auth";

export class AnalyticsEngine {

  async getDebtOverview(session: UserSession): Promise<any> {
    const [dashboardData, accountCount, paymentByType] = await Promise.all([
      platinumGet(session, "/api/BillingDashboard/pos-count").catch(() => null),
      platinumGet(session, "/api/BillingDashboard/account-count").catch(() => null),
      platinumGet(session, "/api/BillingDashboard/get-billing-payment-by-type-of-use").catch(() => null),
    ]);

    const debtArrangement = await platinumGet(session, "/api/BillingDashboard/get-debt-arrangement-summary-chart").catch(() => null);

    const riskDistribution = await this.getRiskDistribution();

    return {
      dashboard: dashboardData,
      accountCount,
      paymentByType,
      debtArrangement,
      riskDistribution,
    };
  }

  async getAgingAnalysis(session: UserSession): Promise<any> {
    const riskScores = await db.select().from(debtRiskScores).orderBy(desc(debtRiskScores.scoredAt)).limit(500);

    const agingBuckets = { current: 0, days30: 0, days60: 0, days90: 0, days120plus: 0 };
    const agingAmounts = { current: 0, days30: 0, days60: 0, days90: 0, days120plus: 0 };

    for (const score of riskScores) {
      const factors = score.factorScores as any;
      if (!factors) continue;
      const arrearAge = factors.arrearAge ?? factors.arrear_age ?? 0;
      const debtSize = factors.debtSize ?? factors.debt_size ?? 0;

      if (arrearAge <= 0) { agingBuckets.current++; agingAmounts.current += debtSize; }
      else if (arrearAge <= 30) { agingBuckets.days30++; agingAmounts.days30 += debtSize; }
      else if (arrearAge <= 60) { agingBuckets.days60++; agingAmounts.days60 += debtSize; }
      else if (arrearAge <= 90) { agingBuckets.days90++; agingAmounts.days90 += debtSize; }
      else { agingBuckets.days120plus++; agingAmounts.days120plus += debtSize; }
    }

    return { agingBuckets, agingAmounts, totalAccounts: riskScores.length };
  }

  async getRecoveryStats(): Promise<any> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

    const [allComms, recentComms30, recentComms60, recentComms90] = await Promise.all([
      db.select({ count: count(), channel: communicationLog.channel, status: communicationLog.status }).from(communicationLog).groupBy(communicationLog.channel, communicationLog.status),
      db.select({ count: count(), channel: communicationLog.channel, status: communicationLog.status }).from(communicationLog).where(gte(communicationLog.sentAt, thirtyDaysAgo)).groupBy(communicationLog.channel, communicationLog.status),
      db.select({ count: count(), channel: communicationLog.channel, status: communicationLog.status }).from(communicationLog).where(gte(communicationLog.sentAt, sixtyDaysAgo)).groupBy(communicationLog.channel, communicationLog.status),
      db.select({ count: count(), channel: communicationLog.channel, status: communicationLog.status }).from(communicationLog).where(gte(communicationLog.sentAt, ninetyDaysAgo)).groupBy(communicationLog.channel, communicationLog.status),
    ]);

    const aggregateByChannel = (rows: any[]) => {
      const result: Record<string, { sent: number; delivered: number; failed: number }> = {};
      for (const row of rows) {
        if (!result[row.channel]) result[row.channel] = { sent: 0, delivered: 0, failed: 0 };
        if (row.status === 'SENT' || row.status === 'DELIVERED') {
          result[row.channel].sent += row.count;
          if (row.status === 'DELIVERED') result[row.channel].delivered += row.count;
        } else if (row.status === 'FAILED') {
          result[row.channel].failed += row.count;
        }
      }
      return result;
    };

    return {
      allTime: aggregateByChannel(allComms),
      last30Days: aggregateByChannel(recentComms30),
      last60Days: aggregateByChannel(recentComms60),
      last90Days: aggregateByChannel(recentComms90),
      totalCommunications: allComms.reduce((sum, r) => sum + r.count, 0),
    };
  }

  async getLegalPipeline(): Promise<any> {
    const logs = await db.select({
      actionType: legalComplianceLog.actionType,
      processStage: legalComplianceLog.processStage,
      count: count(),
    }).from(legalComplianceLog).groupBy(legalComplianceLog.actionType, legalComplianceLog.processStage);

    const pipeline: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const byStage: Record<string, number> = {};

    for (const row of logs) {
      if (row.actionType) byAction[row.actionType] = (byAction[row.actionType] || 0) + row.count;
      if (row.processStage) byStage[row.processStage] = (byStage[row.processStage] || 0) + row.count;
    }

    const section129Count = Object.entries(byAction)
      .filter(([k]) => k.toLowerCase().includes('section129') || k.toLowerCase().includes('s129'))
      .reduce((sum, [, v]) => sum + v, 0);
    const handoverCount = Object.entries(byAction)
      .filter(([k]) => k.toLowerCase().includes('handover'))
      .reduce((sum, [, v]) => sum + v, 0);

    pipeline['Section 129 Notices'] = section129Count;
    pipeline['Handover Initiated'] = handoverCount;
    pipeline['In Collection'] = Object.entries(byStage)
      .filter(([k]) => k.toLowerCase().includes('collection') || k.toLowerCase().includes('active'))
      .reduce((sum, [, v]) => sum + v, 0);
    pipeline['Recovered'] = Object.entries(byStage)
      .filter(([k]) => k.toLowerCase().includes('recovered') || k.toLowerCase().includes('completed') || k.toLowerCase().includes('paid'))
      .reduce((sum, [, v]) => sum + v, 0);

    return { pipeline, byAction, byStage, totalLegalActions: logs.reduce((sum, r) => sum + r.count, 0) };
  }

  async getAttorneyPerformance(session: UserSession): Promise<any> {
    const handoverData = await platinumGet(session, "/api/BillingDebt/handover-list", {
      pageSize: "500",
      page: "1",
    }).catch(() => null);

    const attorneys: Record<string, {
      name: string;
      totalAccounts: number;
      totalDebt: number;
      recoveredAmount: number;
      activeAccounts: number;
      terminatedAccounts: number;
    }> = {};

    if (handoverData && Array.isArray(handoverData.data || handoverData)) {
      const records = handoverData.data || handoverData;
      for (const record of records) {
        const attorney = record.attorneyName || record.attorney_name || record.Attorney || 'Unknown';
        if (!attorneys[attorney]) {
          attorneys[attorney] = { name: attorney, totalAccounts: 0, totalDebt: 0, recoveredAmount: 0, activeAccounts: 0, terminatedAccounts: 0 };
        }
        attorneys[attorney].totalAccounts++;
        const debt = parseFloat(record.totalDebt || record.total_debt || record.Amount || '0') || 0;
        attorneys[attorney].totalDebt += debt;
        const recovered = parseFloat(record.recoveredAmount || record.recovered_amount || record.AmountPaid || '0') || 0;
        attorneys[attorney].recoveredAmount += recovered;
        const status = (record.status || record.Status || '').toLowerCase();
        if (status === 'active' || status === 'in progress') attorneys[attorney].activeAccounts++;
        if (status === 'terminated' || status === 'closed') attorneys[attorney].terminatedAccounts++;
      }
    }

    const result = Object.values(attorneys).map(a => ({
      ...a,
      recoveryRate: a.totalDebt > 0 ? Math.round((a.recoveredAmount / a.totalDebt) * 10000) / 100 : 0,
    })).sort((a, b) => b.recoveryRate - a.recoveryRate);

    return { attorneys: result, totalAttorneys: result.length };
  }

  async getRiskDistribution(): Promise<any> {
    const scores = await db.select({
      riskCategory: debtRiskScores.riskCategory,
      count: count(),
      avgScore: sql<number>`round(avg(${debtRiskScores.overallScore}), 1)`,
    }).from(debtRiskScores).groupBy(debtRiskScores.riskCategory);

    const distribution: Record<string, { count: number; avgScore: number }> = {};
    for (const row of scores) {
      distribution[row.riskCategory || 'UNKNOWN'] = { count: row.count, avgScore: row.avgScore };
    }

    const totalScored = scores.reduce((sum, r) => sum + r.count, 0);

    return { distribution, totalScored };
  }

  async getPredictiveForecasting(): Promise<any> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [commsLast30, commsLast60, commsLast90, riskScores, legalActions] = await Promise.all([
      db.select({ count: count(), channel: communicationLog.channel, status: communicationLog.status }).from(communicationLog).where(gte(communicationLog.sentAt, thirtyDaysAgo)).groupBy(communicationLog.channel, communicationLog.status),
      db.select({ count: count(), channel: communicationLog.channel, status: communicationLog.status }).from(communicationLog).where(and(gte(communicationLog.sentAt, sixtyDaysAgo), lte(communicationLog.sentAt, thirtyDaysAgo))).groupBy(communicationLog.channel, communicationLog.status),
      db.select({ count: count(), channel: communicationLog.channel, status: communicationLog.status }).from(communicationLog).where(and(gte(communicationLog.sentAt, ninetyDaysAgo), lte(communicationLog.sentAt, sixtyDaysAgo))).groupBy(communicationLog.channel, communicationLog.status),

      db.select({
        riskCategory: debtRiskScores.riskCategory,
        count: count(),
        avgScore: sql<number>`round(avg(${debtRiskScores.overallScore}), 1)`,
      }).from(debtRiskScores).groupBy(debtRiskScores.riskCategory),

      db.select({ count: count(), actionType: legalComplianceLog.actionType }).from(legalComplianceLog).where(gte(legalComplianceLog.timestamp, ninetyDaysAgo)).groupBy(legalComplianceLog.actionType),
    ]);

    const calcDeliveryRate = (rows: any[]) => {
      const sent = rows.filter(r => r.status === 'SENT' || r.status === 'DELIVERED').reduce((s, r) => s + r.count, 0);
      const delivered = rows.filter(r => r.status === 'DELIVERED').reduce((s, r) => s + r.count, 0);
      return sent > 0 ? Math.round((delivered / sent) * 100) : 0;
    };

    const deliveryTrend = [
      { period: '61-90 days ago', rate: calcDeliveryRate(commsLast90) },
      { period: '31-60 days ago', rate: calcDeliveryRate(commsLast60) },
      { period: 'Last 30 days', rate: calcDeliveryRate(commsLast30) },
    ];

    const lowRisk = riskScores.find(r => r.riskCategory === 'LOW');
    const medRisk = riskScores.find(r => r.riskCategory === 'MEDIUM');
    const highRisk = riskScores.find(r => r.riskCategory === 'HIGH');
    const totalScored = riskScores.reduce((s, r) => s + r.count, 0);

    const lowPct = totalScored > 0 ? (lowRisk?.count || 0) / totalScored : 0;
    const medPct = totalScored > 0 ? (medRisk?.count || 0) / totalScored : 0;
    const highPct = totalScored > 0 ? (highRisk?.count || 0) / totalScored : 0;

    const lowRecoveryRate = 0.75;
    const medRecoveryRate = 0.45;
    const highRecoveryRate = 0.15;

    const weightedRecoveryRate = (lowPct * lowRecoveryRate) + (medPct * medRecoveryRate) + (highPct * highRecoveryRate);

    const recentCommsTotal = commsLast30.reduce((s, r) => s + r.count, 0);
    const communicationVelocity = recentCommsTotal;

    const legalActionCount = legalActions.reduce((s, r) => s + r.count, 0);

    const avgTrend = deliveryTrend.reduce((s, d) => s + d.rate, 0) / Math.max(deliveryTrend.length, 1);
    const confidenceScore = Math.min(95, Math.max(20, Math.round(
      (avgTrend * 0.3) + (totalScored > 10 ? 25 : totalScored * 2.5) + (communicationVelocity > 50 ? 20 : communicationVelocity * 0.4) + (legalActionCount > 10 ? 20 : legalActionCount * 2)
    )));

    const channelEffectiveness: Record<string, { sent: number; delivered: number; rate: number }> = {};
    for (const row of commsLast30) {
      if (!channelEffectiveness[row.channel]) channelEffectiveness[row.channel] = { sent: 0, delivered: 0, rate: 0 };
      if (row.status === 'SENT' || row.status === 'DELIVERED') {
        channelEffectiveness[row.channel].sent += row.count;
        if (row.status === 'DELIVERED') channelEffectiveness[row.channel].delivered += row.count;
      }
    }
    for (const ch of Object.values(channelEffectiveness)) {
      ch.rate = ch.sent > 0 ? Math.round((ch.delivered / ch.sent) * 100) : 0;
    }

    return {
      predictedRecoveryRate: Math.round(weightedRecoveryRate * 10000) / 100,
      confidenceScore,
      deliveryTrend,
      riskBreakdown: {
        low: { count: lowRisk?.count || 0, avgScore: lowRisk?.avgScore || 0, expectedRecovery: lowRecoveryRate * 100 },
        medium: { count: medRisk?.count || 0, avgScore: medRisk?.avgScore || 0, expectedRecovery: medRecoveryRate * 100 },
        high: { count: highRisk?.count || 0, avgScore: highRisk?.avgScore || 0, expectedRecovery: highRecoveryRate * 100 },
      },
      channelEffectiveness,
      keyDrivers: [
        { factor: 'Risk Distribution', impact: totalScored > 0 ? 'HIGH' : 'LOW', detail: `${totalScored} accounts scored, ${Math.round(lowPct * 100)}% low risk` },
        { factor: 'Communication Velocity', impact: communicationVelocity > 20 ? 'HIGH' : communicationVelocity > 5 ? 'MEDIUM' : 'LOW', detail: `${communicationVelocity} communications in last 30 days` },
        { factor: 'Legal Actions', impact: legalActionCount > 10 ? 'HIGH' : legalActionCount > 3 ? 'MEDIUM' : 'LOW', detail: `${legalActionCount} legal actions in last 90 days` },
        { factor: 'Delivery Rate Trend', impact: avgTrend > 70 ? 'POSITIVE' : avgTrend > 40 ? 'NEUTRAL' : 'NEGATIVE', detail: `${Math.round(avgTrend)}% average delivery rate` },
      ],
      forecast: {
        next30Days: { estimatedRate: Math.round(weightedRecoveryRate * 100) },
        next60Days: { estimatedRate: Math.round(weightedRecoveryRate * 100 * 1.05) },
        next90Days: { estimatedRate: Math.round(weightedRecoveryRate * 100 * 1.08) },
      },
    };
  }

  async getGeographicDistribution(session: UserSession): Promise<any> {
    const riskScores = await db.select().from(debtRiskScores).orderBy(desc(debtRiskScores.scoredAt)).limit(1000);

    const byWard: Record<string, { totalDebt: number; accountCount: number; totalScore: number; riskCounts: Record<string, number> }> = {};
    const bySuburb: Record<string, { totalDebt: number; accountCount: number; totalScore: number; riskCounts: Record<string, number> }> = {};
    const byTown: Record<string, { totalDebt: number; accountCount: number; totalScore: number; riskCounts: Record<string, number> }> = {};
    const byPropertyType: Record<string, { totalDebt: number; accountCount: number; totalScore: number; riskCounts: Record<string, number> }> = {};

    for (const score of riskScores) {
      const meta = score.metadata as any || {};
      const factors = score.factorScores as any || {};
      const debtSize = factors.debtSize ?? factors.debt_size ?? 0;
      const overallScore = parseFloat(String(score.overallScore)) || 0;
      const risk = score.riskCategory || 'UNKNOWN';

      const ward = meta.ward || meta.wardNo || meta.ward_no || 'Unassigned';
      const suburb = meta.suburb || meta.area || 'Unassigned';
      const town = meta.town || meta.city || meta.municipality || 'Unassigned';
      const propType = meta.propertyType || meta.property_type || meta.typeOfUse || meta.type_of_use || 'Unassigned';

      const addTo = (bucket: Record<string, any>, key: string) => {
        if (!bucket[key]) bucket[key] = { totalDebt: 0, accountCount: 0, totalScore: 0, riskCounts: {} };
        bucket[key].totalDebt += debtSize;
        bucket[key].accountCount++;
        bucket[key].totalScore += overallScore;
        bucket[key].riskCounts[risk] = (bucket[key].riskCounts[risk] || 0) + 1;
      };

      addTo(byWard, ward);
      addTo(bySuburb, suburb);
      addTo(byTown, town);
      addTo(byPropertyType, propType);
    }

    const formatBucket = (bucket: Record<string, any>) =>
      Object.entries(bucket).map(([name, data]: [string, any]) => ({
        name,
        totalDebt: Math.round(data.totalDebt * 100) / 100,
        accountCount: data.accountCount,
        avgDebt: data.accountCount > 0 ? Math.round((data.totalDebt / data.accountCount) * 100) / 100 : 0,
        avgRiskScore: data.accountCount > 0 ? Math.round((data.totalScore / data.accountCount) * 10) / 10 : 0,
        riskCounts: data.riskCounts,
        dominantRisk: Object.entries(data.riskCounts).sort(([, a]: any, [, b]: any) => b - a)[0]?.[0] || 'UNKNOWN',
      })).sort((a, b) => b.totalDebt - a.totalDebt);

    return {
      byWard: formatBucket(byWard),
      bySuburb: formatBucket(bySuburb),
      byTown: formatBucket(byTown),
      byPropertyType: formatBucket(byPropertyType),
      totalAccounts: riskScores.length,
    };
  }
}

export const analyticsEngine = new AnalyticsEngine();

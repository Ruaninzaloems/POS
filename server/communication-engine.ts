import { db } from "./db";
import { eq, desc, and, gte, lte, sql, asc } from "drizzle-orm";
import {
  communicationTimelines,
  communicationTimelineSteps,
  communicationLog,
  scheduledCommunications,
  type InsertCommunicationTimeline,
  type CommunicationTimeline,
  type InsertCommunicationTimelineStep,
  type CommunicationTimelineStep,
  type InsertCommunicationLog,
  type CommunicationLog,
  type InsertScheduledCommunication,
  type ScheduledCommunication,
} from "@shared/schema";

export type ChannelType = "sms" | "email" | "whatsapp" | "letter";

export interface DispatchResult {
  success: boolean;
  channel: ChannelType;
  recipient?: string;
  messageId?: string;
  error?: string;
}

export class CommunicationEngine {

  async createTimeline(timeline: InsertCommunicationTimeline): Promise<CommunicationTimeline> {
    const [created] = await db.insert(communicationTimelines).values(timeline).returning();
    return created;
  }

  async updateTimeline(id: number, updates: Partial<InsertCommunicationTimeline>): Promise<CommunicationTimeline | undefined> {
    const [updated] = await db.update(communicationTimelines).set({ ...updates, updatedAt: new Date() }).where(eq(communicationTimelines.id, id)).returning();
    return updated;
  }

  async deleteTimeline(id: number): Promise<boolean> {
    await db.delete(communicationTimelineSteps).where(eq(communicationTimelineSteps.timelineId, id));
    await db.delete(communicationTimelines).where(eq(communicationTimelines.id, id));
    return true;
  }

  async getTimeline(id: number): Promise<{ timeline: CommunicationTimeline; steps: CommunicationTimelineStep[] } | undefined> {
    const [timeline] = await db.select().from(communicationTimelines).where(eq(communicationTimelines.id, id));
    if (!timeline) return undefined;
    const steps = await db.select().from(communicationTimelineSteps).where(eq(communicationTimelineSteps.timelineId, id)).orderBy(asc(communicationTimelineSteps.dayOffset));
    return { timeline, steps };
  }

  async getAllTimelines(): Promise<CommunicationTimeline[]> {
    return db.select().from(communicationTimelines).orderBy(desc(communicationTimelines.createdAt));
  }

  async addStep(step: InsertCommunicationTimelineStep): Promise<CommunicationTimelineStep> {
    const [created] = await db.insert(communicationTimelineSteps).values(step).returning();
    return created;
  }

  async updateStep(id: number, updates: Partial<InsertCommunicationTimelineStep>): Promise<CommunicationTimelineStep | undefined> {
    const [updated] = await db.update(communicationTimelineSteps).set(updates).where(eq(communicationTimelineSteps.id, id)).returning();
    return updated;
  }

  async deleteStep(id: number): Promise<boolean> {
    await db.delete(communicationTimelineSteps).where(eq(communicationTimelineSteps.id, id));
    return true;
  }

  async setTimelineSteps(timelineId: number, steps: InsertCommunicationTimelineStep[]): Promise<CommunicationTimelineStep[]> {
    return await db.transaction(async (tx) => {
      await tx.delete(communicationTimelineSteps).where(eq(communicationTimelineSteps.timelineId, timelineId));
      if (steps.length === 0) return [];
      const created = await tx.insert(communicationTimelineSteps).values(steps.map((s, i) => ({ ...s, timelineId, sortOrder: i }))).returning();
      return created;
    });
  }

  async dispatch(params: {
    accountNo: string;
    channel: ChannelType;
    recipient: string;
    subject?: string;
    messageBody: string;
    sentBy?: string;
    timelineId?: number;
    timelineStepId?: number;
    metadata?: Record<string, any>;
  }): Promise<CommunicationLog> {
    let status = "SENT";
    let deliveryStatus = "DELIVERED";
    let errorMessage: string | null = null;

    try {
      const result = await this.dispatchToChannel(params.channel, params.recipient, params.subject || "", params.messageBody);
      if (!result.success) {
        status = "FAILED";
        deliveryStatus = "FAILED";
        errorMessage = result.error || "Dispatch failed";
      }
    } catch (err: any) {
      status = "FAILED";
      deliveryStatus = "FAILED";
      errorMessage = err.message;
    }

    const [logEntry] = await db.insert(communicationLog).values({
      accountNo: params.accountNo,
      channel: params.channel,
      recipient: params.recipient,
      subject: params.subject || null,
      messageBody: params.messageBody,
      status,
      deliveryStatus,
      deliveryTimestamp: status === "SENT" ? new Date() : null,
      errorMessage,
      timelineId: params.timelineId || null,
      timelineStepId: params.timelineStepId || null,
      sentBy: params.sentBy || null,
      metadata: params.metadata || null,
    }).returning();

    return logEntry;
  }

  private async dispatchToChannel(channel: ChannelType, recipient: string, subject: string, body: string): Promise<DispatchResult> {
    switch (channel) {
      case "sms":
        console.log(`[CommEngine] SMS → ${recipient}: ${body.substring(0, 50)}...`);
        return { success: true, channel, recipient, messageId: `SMS-${Date.now()}` };

      case "email":
        console.log(`[CommEngine] Email → ${recipient}: Subject: ${subject}`);
        return { success: true, channel, recipient, messageId: `EMAIL-${Date.now()}` };

      case "whatsapp":
        console.log(`[CommEngine] WhatsApp → ${recipient}: ${body.substring(0, 50)}...`);
        return { success: true, channel, recipient, messageId: `WA-${Date.now()}` };

      case "letter":
        console.log(`[CommEngine] Letter queued for ${recipient}`);
        return { success: true, channel, recipient, messageId: `LTR-${Date.now()}` };

      default:
        return { success: false, channel, error: `Unknown channel: ${channel}` };
    }
  }

  async enrollAccountInTimeline(accountNo: string, timelineId: number, startDate?: Date): Promise<ScheduledCommunication[]> {
    const timelineData = await this.getTimeline(timelineId);
    if (!timelineData) throw new Error(`Timeline ${timelineId} not found`);

    const baseDate = startDate || new Date();
    const scheduled: ScheduledCommunication[] = [];

    for (const step of timelineData.steps) {
      const scheduledDate = new Date(baseDate);
      scheduledDate.setDate(scheduledDate.getDate() + step.dayOffset);

      const [entry] = await db.insert(scheduledCommunications).values({
        accountNo,
        timelineId,
        timelineStepId: step.id,
        scheduledDate,
        status: "PENDING",
      }).returning();

      scheduled.push(entry);
    }

    return scheduled;
  }

  async processScheduledCommunications(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const now = new Date();
    const pending = await db.select().from(scheduledCommunications)
      .where(and(
        eq(scheduledCommunications.status, "PENDING"),
        lte(scheduledCommunications.scheduledDate, now)
      ))
      .orderBy(asc(scheduledCommunications.scheduledDate))
      .limit(100);

    let succeeded = 0;
    let failed = 0;

    for (const sched of pending) {
      try {
        const [step] = await db.select().from(communicationTimelineSteps).where(eq(communicationTimelineSteps.id, sched.timelineStepId));
        if (!step) {
          await db.update(scheduledCommunications).set({ status: "SKIPPED", processedAt: new Date() }).where(eq(scheduledCommunications.id, sched.id));
          continue;
        }

        const logEntry = await this.dispatch({
          accountNo: sched.accountNo,
          channel: step.channel as ChannelType,
          recipient: sched.accountNo,
          subject: step.subject || undefined,
          messageBody: step.templateBody || `Automated ${step.channel} notification for account ${sched.accountNo}`,
          sentBy: "SYSTEM_AUTOMATED",
          timelineId: sched.timelineId,
          timelineStepId: sched.timelineStepId,
        });

        await db.update(scheduledCommunications).set({
          status: logEntry.status === "SENT" ? "COMPLETED" : "FAILED",
          processedAt: new Date(),
          communicationLogId: logEntry.id,
        }).where(eq(scheduledCommunications.id, sched.id));

        if (logEntry.status === "SENT") succeeded++;
        else failed++;
      } catch (err: any) {
        await db.update(scheduledCommunications).set({ status: "FAILED", processedAt: new Date() }).where(eq(scheduledCommunications.id, sched.id));
        failed++;
      }
    }

    return { processed: pending.length, succeeded, failed };
  }

  async getCommunicationLog(filters?: {
    accountNo?: string;
    channel?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: CommunicationLog[]; total: number }> {
    const conditions = [];
    if (filters?.accountNo) conditions.push(eq(communicationLog.accountNo, filters.accountNo));
    if (filters?.channel) conditions.push(eq(communicationLog.channel, filters.channel));
    if (filters?.status) conditions.push(eq(communicationLog.status, filters.status));
    if (filters?.dateFrom) conditions.push(gte(communicationLog.sentAt, new Date(filters.dateFrom)));
    if (filters?.dateTo) conditions.push(lte(communicationLog.sentAt, new Date(filters.dateTo)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(communicationLog).where(whereClause);
    const total = countResult[0]?.count || 0;

    const logs = await db.select().from(communicationLog)
      .where(whereClause)
      .orderBy(desc(communicationLog.sentAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    return { logs, total };
  }

  async getScheduledCommunications(filters?: {
    accountNo?: string;
    timelineId?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ scheduled: ScheduledCommunication[]; total: number }> {
    const conditions = [];
    if (filters?.accountNo) conditions.push(eq(scheduledCommunications.accountNo, filters.accountNo));
    if (filters?.timelineId) conditions.push(eq(scheduledCommunications.timelineId, filters.timelineId));
    if (filters?.status) conditions.push(eq(scheduledCommunications.status, filters.status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(scheduledCommunications).where(whereClause);
    const total = countResult[0]?.count || 0;

    const scheduled = await db.select().from(scheduledCommunications)
      .where(whereClause)
      .orderBy(asc(scheduledCommunications.scheduledDate))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    return { scheduled, total };
  }

  async getDeliveryStats(): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    totalPending: number;
    byChannel: Record<string, { sent: number; delivered: number; failed: number }>;
  }> {
    const allLogs = await db.select().from(communicationLog);

    const stats = {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalPending: 0,
      byChannel: {} as Record<string, { sent: number; delivered: number; failed: number }>,
    };

    for (const log of allLogs) {
      if (!stats.byChannel[log.channel]) {
        stats.byChannel[log.channel] = { sent: 0, delivered: 0, failed: 0 };
      }

      if (log.status === "SENT") {
        stats.totalSent++;
        stats.byChannel[log.channel].sent++;
      }
      if (log.deliveryStatus === "DELIVERED") {
        stats.totalDelivered++;
        stats.byChannel[log.channel].delivered++;
      }
      if (log.status === "FAILED") {
        stats.totalFailed++;
        stats.byChannel[log.channel].failed++;
      }
      if (log.status === "PENDING") {
        stats.totalPending++;
      }
    }

    return stats;
  }

  async seedDefaultTimeline(): Promise<void> {
    const existing = await db.select().from(communicationTimelines);
    if (existing.length > 0) return;

    const [timeline] = await db.insert(communicationTimelines).values({
      name: "Standard Debt Recovery",
      description: "Default 30-day escalation timeline for debt recovery: SMS → Email → WhatsApp → Section 129 → Handover",
      isActive: true,
      createdBy: "SYSTEM",
    }).returning();

    await db.insert(communicationTimelineSteps).values([
      { timelineId: timeline.id, dayOffset: 1, channel: "sms", templateName: "Initial Reminder", templateBody: "Dear account holder, your account {accountNo} has an outstanding balance. Please arrange payment to avoid further action.", subject: null, isAutomated: true, sortOrder: 0 },
      { timelineId: timeline.id, dayOffset: 3, channel: "email", templateName: "Email Reminder", templateBody: "Dear Sir/Madam,\n\nThis is a reminder that your municipal account {accountNo} has an outstanding balance.\n\nPlease arrange payment at your nearest municipal office or via online banking.\n\nRegards,\nGeorge Municipality Revenue Services", subject: "Outstanding Account Reminder - {accountNo}", isAutomated: true, sortOrder: 1 },
      { timelineId: timeline.id, dayOffset: 7, channel: "whatsapp", templateName: "WhatsApp Follow-up", templateBody: "Municipal Payment Reminder: Your account {accountNo} remains unpaid. Please settle your account to avoid legal action. Contact us at 044 801 9111.", subject: null, isAutomated: true, sortOrder: 2 },
      { timelineId: timeline.id, dayOffset: 14, channel: "letter", templateName: "Section 129 Notice", templateBody: "NOTICE IN TERMS OF SECTION 129 OF THE NATIONAL CREDIT ACT\n\nAccount: {accountNo}\n\nYou are hereby notified that your account is in arrears. You have 20 business days to settle or make payment arrangements.", subject: "Section 129 Notice of Default", isAutomated: false, sortOrder: 3 },
      { timelineId: timeline.id, dayOffset: 30, channel: "letter", templateName: "Handover Notice", templateBody: "NOTICE OF HANDOVER TO ATTORNEYS\n\nAccount: {accountNo}\n\nYour account has been handed over to our appointed attorneys for debt collection. All further correspondence should be directed to them.", subject: "Notice of Legal Handover", isAutomated: false, sortOrder: 4 },
    ]);

    console.log("[CommEngine] Seeded default debt recovery timeline");
  }
}

export const communicationEngine = new CommunicationEngine();
export function seedDefaultTimeline() { return communicationEngine.seedDefaultTimeline(); }

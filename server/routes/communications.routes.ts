import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult, requireLegalAdmin, injectAuditFields } from "./middleware";
import { platinumGet, platinumPost } from "../platinum-auth";
import { db } from "../db";
import { communicationLogs } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

export function registerCommunicationsRoutes(app: Express, httpServer: Server): void {
  // =====================================================
  // COMMUNICATION ENGINE ROUTES (Platinum API Proxy)
  // =====================================================

  app.get("/api/communications/timelines", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/communication-timelines", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/communications/timelines/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/communication-timelines", { id: req.params.id });
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/communications/timelines", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/communication-timelines", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/communications/timelines/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/communication-timelines-update", injectAuditFields(session, { ...req.body, id: parseInt(req.params.id) }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.delete("/api/communications/timelines/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/communication-timelines-delete", injectAuditFields(session, { id: parseInt(req.params.id) }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/communications/timelines/:id/steps", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/communication-timeline-steps", injectAuditFields(session, { ...req.body, timelineId: parseInt(req.params.id) }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/communications/dispatch", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/communication-dispatch", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/communications/dispatch-bulk", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/communication-dispatch-bulk", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/communications/enroll", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/communication-enroll", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/communications/process-scheduled", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/communication-process-scheduled", injectAuditFields(session, {}));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/communications/log", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/communication-log", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/communications/scheduled", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/communication-scheduled", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/communications/stats", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/communication-stats");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/communication-logs", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { accountId, accountNumber, accountHolder, method, recipients, subject, messageBody, statementType, financialYear, periodFrom, periodTo } = req.body;
      if (!accountId || !method || !recipients) {
        return res.status(400).json({ message: "accountId, method, and recipients are required" });
      }
      const sentBy = (session as any).userId || (session as any).user?.id || '';
      const sentByName = (session as any).cashierName || (session as any).user?.name || (session as any).username || '';
      const [log] = await db.insert(communicationLogs).values({
        accountId: String(accountId),
        accountNumber: accountNumber || '',
        accountHolder: accountHolder || '',
        method,
        recipients,
        subject: subject || '',
        messageBody: messageBody || '',
        statementType: statementType || '',
        financialYear: financialYear || '',
        periodFrom: periodFrom || '',
        periodTo: periodTo || '',
        status: 'sent',
        sentBy: String(sentBy),
        sentByName: String(sentByName),
      }).returning();
      console.log(`[comm-log] Saved ${method} communication for account ${accountId} → ${recipients}`);
      res.json(log);
    } catch (e: any) {
      console.error(`[comm-log] Error:`, e.message);
      res.status(500).json({ message: "Failed to save communication log", detail: e.message });
    }
  });

  app.get("/api/communication-logs/:accountId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { accountId } = req.params;
      const logs = await db.select().from(communicationLogs).where(eq(communicationLogs.accountId, accountId)).orderBy(desc(communicationLogs.createdAt)).limit(50);
      res.json(logs);
    } catch (e: any) {
      console.error(`[comm-log] Fetch error:`, e.message);
      res.status(500).json({ message: "Failed to fetch communication logs", detail: e.message });
    }
  });
}

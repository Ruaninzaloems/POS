import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult, requireLegalAdmin, injectAuditFields } from "./middleware";
import { platinumGet, platinumPost } from "../platinum-auth";

export function registerAnalyticsRoutes(app: Express, httpServer: Server): void {
  // =====================================================
  // INTELLIGENCE & ANALYTICS ROUTES (Platinum API Proxy)
  // =====================================================

  app.get("/api/analytics/debt-overview", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumGet(session, "/api/BillingDashboard/debt-overview", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/analytics/aging-analysis", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumGet(session, "/api/BillingDashboard/aging-analysis", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/analytics/recovery-stats", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumGet(session, "/api/BillingDashboard/recovery-stats", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/analytics/legal-pipeline", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumGet(session, "/api/BillingDashboard/legal-pipeline", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/analytics/attorney-performance", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumGet(session, "/api/BillingDashboard/attorney-performance", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/analytics/risk-distribution", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumGet(session, "/api/BillingDashboard/risk-distribution", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/analytics/predictive-forecasting", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumGet(session, "/api/BillingDashboard/predictive-forecasting", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/analytics/geographic-distribution", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumGet(session, "/api/BillingDashboard/geographic-distribution", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // =====================================================
  // BATCH PROCESSING ENGINE ROUTES (Platinum API Proxy)
  // =====================================================

  app.get("/api/batch-processing/jobs", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/batch-jobs", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/batch-processing/schedules", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/batch-schedules", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/batch-processing/trigger", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/batch-trigger", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/batch-processing/cancel", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/batch-cancel", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // =====================================================
  // PROCESS MONITORING ROUTES (Platinum API Proxy)
  // =====================================================

  app.get("/api/process-monitoring/overview", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/process-monitoring-overview", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/process-monitoring/active-runs", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/process-active-runs", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/process-monitoring/failed-runs", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/process-failed-runs", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/process-monitoring/pending-approvals", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/process-pending-approvals", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/process-monitoring/handover-queues", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/process-handover-queues", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/process-monitoring/termination-queues", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/process-termination-queues", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/document-templates", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/document-templates", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/document-templates/:templateId/versions", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/BillingDebt/document-templates/${req.params.templateId}/versions`, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/document-templates", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/document-templates", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/document-templates/:templateId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, `/api/BillingDebt/document-templates/${req.params.templateId}`, injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/document-templates/:templateId/upload", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, `/api/BillingDebt/document-templates/${req.params.templateId}/upload`, injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/document-templates/:templateId/download", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/BillingDebt/document-templates/${req.params.templateId}/download`, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/digital-signatures", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/digital-signatures", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/digital-signatures/audit-log", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/digital-signatures/audit-log", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/digital-signatures/:requestId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/BillingDebt/digital-signatures/${req.params.requestId}`, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/digital-signatures", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/digital-signatures", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/process-engine/workflows", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/process-workflows", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/process-engine/workflows/:workflowId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/BillingDebt/process-workflows/${req.params.workflowId}`, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/process-engine/workflows", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/process-workflows", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/process-engine/workflows/:workflowId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, `/api/BillingDebt/process-workflows/${req.params.workflowId}`, injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.delete("/api/process-engine/workflows/:workflowId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, `/api/BillingDebt/process-workflows/${req.params.workflowId}/delete`, injectAuditFields(session, {}));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/process-engine/workflows/:workflowId/stages", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/BillingDebt/process-workflows/${req.params.workflowId}/stages`, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/process-engine/workflows/:workflowId/stages", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, `/api/BillingDebt/process-workflows/${req.params.workflowId}/stages`, injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/process-engine/workflows/:workflowId/stages/:stageId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, `/api/BillingDebt/process-workflows/${req.params.workflowId}/stages/${req.params.stageId}`, injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.delete("/api/process-engine/workflows/:workflowId/stages/:stageId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, `/api/BillingDebt/process-workflows/${req.params.workflowId}/stages/${req.params.stageId}/delete`, injectAuditFields(session, {}));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/process-engine/workflows/:workflowId/stages/reorder", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, `/api/BillingDebt/process-workflows/${req.params.workflowId}/stages/reorder`, injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });
}

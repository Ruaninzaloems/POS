import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult, requireLegalAdmin, injectAuditFields } from "./middleware";
import { platinumGet, platinumPost } from "../platinum-auth";

export function registerLegalRoutes(app: Express, httpServer: Server): void {
  app.get("/api/legal/rules", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/legal-rules", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/legal/rules", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/legal-rules", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/legal/rules/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/legal-rules-update", injectAuditFields(session, { ...req.body, id: parseInt(req.params.id) }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.delete("/api/legal/rules/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/legal-rules-deactivate", injectAuditFields(session, { id: parseInt(req.params.id) }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/legal/compliance-log", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/compliance-log", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/legal/compliance-log/:entityId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/compliance-log", { entityId: req.params.entityId });
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/legal/evidence-bundle", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/evidence-bundle", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/legal/evidence-bundles", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/evidence-bundles", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/legal/evidence-bundle/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/evidence-bundle", { id: req.params.id });
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/legal/validate-action", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BillingDebt/validate-legal-action", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // =====================================================
  // DEBT QUALIFICATION & RISK SCORING ROUTES (Platinum API Proxy)
  // =====================================================

  app.post("/api/debt-scoring/score-account", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BillingDebt/score-account", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/debt-scoring/score-bulk", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BillingDebt/score-bulk", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/debt-scoring/scores", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/risk-scores", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/debt-scoring/scores/:accountNo", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/risk-scores", { accountNo: req.params.accountNo });
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/debt-scoring/weights", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/scoring-weights");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/debt-scoring/weights", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/scoring-weights", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/debt-scoring/qualification-rules", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/qualification-rules", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/debt-scoring/qualification-rules/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/qualification-rules", { id: req.params.id });
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/debt-scoring/qualification-rules", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/qualification-rules", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/debt-scoring/qualification-rules/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/qualification-rules-update", injectAuditFields(session, { ...req.body, id: parseInt(req.params.id) }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.delete("/api/debt-scoring/qualification-rules/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireLegalAdmin(session, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/qualification-rules-delete", injectAuditFields(session, { id: parseInt(req.params.id) }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/debt-scoring/qualification-rules/:id/run", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BillingDebt/qualification-rules-run", injectAuditFields(session, { ...req.body, ruleId: parseInt(req.params.id) }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });
}

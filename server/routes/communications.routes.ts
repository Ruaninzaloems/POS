import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult, requireLegalAdmin, injectAuditFields } from "./middleware";
import { platinumGet, platinumPost } from "../platinum-auth";

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
}

import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult, requireDebtPermission, injectAuditFields, DEBT_PERMISSIONS } from "./middleware";
import { platinumGet, platinumPost, getSiteConfig, getPlatinumApiUrl } from "../platinum-auth";

export function registerDebtRoutes(app: Express, httpServer: Server): void {
  // requiredPermission: PROCESS_SECTION129
  app.get("/api/platinum/billing-debt/section129-config", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/section129-config", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: PROCESS_SECTION129
  app.get("/api/platinum/billing-debt/section129-runs", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/section129-runs", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-debt/section129-trial-run", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireDebtPermission(session, DEBT_PERMISSIONS.PROCESS_SECTION129, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/section129-trial-run", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-debt/section129-trial-review-submit", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireDebtPermission(session, DEBT_PERMISSIONS.PROCESS_SECTION129, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/section129-trial-review-submit", injectAuditFields(session, req.body, { isReview: true }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-debt/section129-authorize", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireDebtPermission(session, DEBT_PERMISSIONS.AUTHORISE_SECTION129, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/section129-authorize", injectAuditFields(session, req.body, { isReview: true }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-debt/section129-final-run", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireDebtPermission(session, DEBT_PERMISSIONS.PROCESS_SECTION129, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/section129-final-run", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: PROCESS_SECTION129
  app.get("/api/platinum/billing-debt/section129-run-accounts", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/section129-run-accounts", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-debt/section129-delete-run", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireDebtPermission(session, DEBT_PERMISSIONS.PROCESS_SECTION129, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/section129-delete-run", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: HANDOVER_PROCESS
  app.get("/api/platinum/billing-debt/handover-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/handover-list", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-debt/handover-submit", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireDebtPermission(session, DEBT_PERMISSIONS.HANDOVER_PROCESS, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/handover-submit", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-debt/handover-terminate", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireDebtPermission(session, DEBT_PERMISSIONS.HANDOVER_PROCESS, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/handover-terminate", injectAuditFields(session, req.body, { isTermination: true }));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: HANDOVER_PROCESS
  app.get("/api/platinum/billing-debt/attorney-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/attorney-list", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: PROCESS_SECTION129
  app.get("/api/platinum/billing-debt/billing-cycles", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/billing-cycles", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: PROCESS_SECTION129
  app.get("/api/platinum/billing-debt/towns", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/towns", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: SECTION129_REPORT
  app.get("/api/platinum/billing-debt/section129-report", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/section129-report", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: HANDOVER_REPORT
  app.get("/api/platinum/billing-debt/handover-report", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/handover-report", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-debt/sms-log-report", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/sms-log-report", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-debt/section129-config-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/section129-config-list", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-debt/section129-config-save", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      if (!requireDebtPermission(session, DEBT_PERMISSIONS.PROCESS_SECTION129, res)) return;
      const data = await platinumPost(session, "/api/BillingDebt/section129-config-save", injectAuditFields(session, req.body));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: PROCESS_SECTION129
  app.get("/api/platinum/billing-debt/section129-templates", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/section129-templates", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: PROCESS_SECTION129
  app.get("/api/platinum/billing-debt/section129-sms-templates", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/section129-sms-templates", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: PROCESS_SECTION129
  app.get("/api/platinum/billing-debt/section129-run-files", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/section129-run-files", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: PROCESS_SECTION129
  app.get("/api/platinum/billing-debt/section129-download-file", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const siteConfig = getSiteConfig(session.siteId);
      const apiUrl = siteConfig?.apiUrl || getPlatinumApiUrl();
      const qs = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${apiUrl}/api/BillingDebt/section129-download-file${qs ? '?' + qs : ''}`;
      const upstream = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      if (!upstream.ok) {
        res.status(upstream.status).json({ message: `Platinum returned ${upstream.status}` });
        return;
      }
      const contentType = upstream.headers.get('content-type');
      const contentDisposition = upstream.headers.get('content-disposition');
      if (contentType) res.setHeader('Content-Type', contentType);
      if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // requiredPermission: PROCESS_SECTION129
  app.get("/api/platinum/billing-debt/additional-billing-types", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/additional-billing-types", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-debt/property-categories", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/property-categories", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-debt/account-types", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/account-types", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-debt/person-types", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/person-types", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-debt/ageing-ranges", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDebt/ageing-ranges", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

}

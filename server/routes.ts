import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const EXTERNAL_API_BASE = "https://george-uat-ems-billing-api.azurewebsites.net";

async function proxyGet(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) {
    return { error: true, status: res.status, statusText: res.statusText };
  }
  return res.json();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // =====================================================
  // EXTERNAL API PROXY ROUTES (solves CORS)
  // =====================================================

  app.get("/api/proxy/odata/:entity", async (req, res) => {
    try {
      const entity = req.params.entity;
      const data = await proxyGet(`${EXTERNAL_API_BASE}/odata/${entity}`);
      if (data.error) {
        return res.status(data.status).json({ message: data.statusText });
      }
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.get("/api/proxy/cons-accounts/search", async (req, res) => {
    try {
      const params = new URLSearchParams(req.query as Record<string, string>);
      const data = await proxyGet(`${EXTERNAL_API_BASE}/api/cons-accounts/search?${params.toString()}`);
      if (data.error) {
        return res.status(data.status).json({ message: data.statusText });
      }
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.get("/api/proxy/billing-enquiry-search", async (req, res) => {
    try {
      const params = new URLSearchParams(req.query as Record<string, string>);
      const data = await proxyGet(`${EXTERNAL_API_BASE}/api/billing-enquiry-search?${params.toString()}`);
      if (data.error) {
        return res.status(data.status).json({ message: data.statusText });
      }
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.get("/api/proxy/const-institutions/search", async (req, res) => {
    try {
      const params = new URLSearchParams(req.query as Record<string, string>);
      const data = await proxyGet(`${EXTERNAL_API_BASE}/api/const-institutions/search?${params.toString()}`);
      if (data.error) {
        return res.status(data.status).json({ message: data.statusText });
      }
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.get("/api/proxy/cons-accounts/:id", async (req, res) => {
    try {
      const data = await proxyGet(`${EXTERNAL_API_BASE}/api/cons-accounts/${req.params.id}`);
      if (data.error) {
        return res.status(data.status).json({ message: data.statusText });
      }
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.get("/api/proxy/billing-stage-cashier-receipt-details/reference", async (req, res) => {
    try {
      const params = new URLSearchParams(req.query as Record<string, string>);
      const url = `${EXTERNAL_API_BASE}/api/billing-stage-cashier-receipt-details/reference?${params.toString()}`;
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        res.json(data);
      } else if (response.status === 400 || response.status === 404) {
        res.json([]);
      } else {
        res.status(response.status).json({ message: response.statusText });
      }
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.get("/api/proxy/billing-stage-prepaid-recharge/:id", async (req, res) => {
    try {
      const data = await proxyGet(`${EXTERNAL_API_BASE}/api/billing-stage-prepaid-recharge/${req.params.id}`);
      if (data.error) return res.status(data.status).json({ message: data.statusText });
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.get("/api/proxy/billing-stage-prepaid-recovery/:identifier", async (req, res) => {
    try {
      const data = await proxyGet(`${EXTERNAL_API_BASE}/api/billing-stage-prepaid-recovery/${req.params.identifier}`);
      if (data.error) return res.status(data.status).json({ message: data.statusText });
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.get("/api/proxy/billing-stage-prepaid-recovery/reference", async (req, res) => {
    try {
      const params = new URLSearchParams(req.query as Record<string, string>);
      const data = await proxyGet(`${EXTERNAL_API_BASE}/api/billing-stage-prepaid-recovery/reference?${params.toString()}`);
      if (data.error) return res.status(data.status).json({ message: data.statusText });
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.post("/api/proxy/pos-multiple-account-payments/:capturerId/:accountId/receipt/:receiptId", async (req, res) => {
    try {
      const { capturerId, accountId, receiptId } = req.params;
      const url = `${EXTERNAL_API_BASE}/api/pos-multiple-account-payments/${capturerId}/${accountId}/receipt/${receiptId}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        return res.status(response.status).json({ message: response.statusText });
      }
      const text = await response.text();
      res.json(text ? JSON.parse(text) : { success: true });
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  // =====================================================
  // CASHIER SESSION ROUTES
  // =====================================================

  app.post("/api/sessions", async (req, res) => {
    try {
      const { cashierId, cashierName, cashOfficeId, cashOfficeName, floatAmount } = req.body;
      if (!cashierId || !cashOfficeId) {
        return res.status(400).json({ message: "cashierId and cashOfficeId are required" });
      }

      const existing = await storage.getActiveSession(cashierId);
      if (existing) {
        return res.json(existing);
      }

      const session = await storage.createSession({
        cashierId,
        cashierName: cashierName || cashierId,
        cashOfficeId,
        cashOfficeName: cashOfficeName || null,
        floatAmount: (floatAmount || 0).toString(),
        status: "ACTIVE",
      });
      res.status(201).json(session);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/sessions/active/:cashierId", async (req, res) => {
    try {
      const session = await storage.getActiveSession(req.params.cashierId);
      if (!session) {
        return res.status(404).json({ message: "No active session" });
      }
      res.json(session);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/sessions/:id/end", async (req, res) => {
    try {
      const session = await storage.endSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // =====================================================
  // TRANSACTION / RECEIPT ROUTES
  // =====================================================

  app.post("/api/transactions", async (req, res) => {
    try {
      const {
        receiptNumber, sessionId, cashierId, cashierName,
        cashOfficeId, totalAmount, cashAmount, cardAmount,
        chequeAmount, tenderAmount, changeAmount, paymentType,
        status, items
      } = req.body;

      if (!receiptNumber || !cashierId) {
        return res.status(400).json({ message: "receiptNumber and cashierId are required" });
      }

      const tx = await storage.createTransaction({
        receiptNumber,
        sessionId: sessionId || null,
        cashierId,
        cashierName: cashierName || null,
        cashOfficeId: cashOfficeId || null,
        totalAmount: (totalAmount || 0).toString(),
        cashAmount: (cashAmount || 0).toString(),
        cardAmount: (cardAmount || 0).toString(),
        chequeAmount: (chequeAmount || 0).toString(),
        tenderAmount: (tenderAmount || 0).toString(),
        changeAmount: (changeAmount || 0).toString(),
        paymentType: paymentType || "Cash",
        status: status || "COMPLETED",
        cancellationReason: null,
        items: items || [],
      });
      res.status(201).json(tx);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    try {
      const { cashierId, cashOfficeId, fromDate, toDate, status } = req.query;
      const txs = await storage.listTransactions({
        cashierId: cashierId as string,
        cashOfficeId: cashOfficeId as string,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
        status: status as string,
      });
      res.json(txs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/transactions/:id", async (req, res) => {
    try {
      const tx = await storage.getTransaction(req.params.id);
      if (!tx) return res.status(404).json({ message: "Transaction not found" });
      res.json(tx);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/transactions/:id/status", async (req, res) => {
    try {
      const { status, cancellationReason } = req.body;
      if (!status) return res.status(400).json({ message: "status is required" });
      const tx = await storage.updateTransactionStatus(req.params.id, status, cancellationReason);
      if (!tx) return res.status(404).json({ message: "Transaction not found" });
      res.json(tx);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}

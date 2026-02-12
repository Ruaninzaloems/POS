import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { platinumGet, platinumPost } from "./platinum-auth";

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

function handlePlatinumResult(res: any, data: any) {
  if (data && data._error) {
    return res.status(data.status || 502).json({ message: data.statusText || "Platinum API error" });
  }
  res.json(data);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // =====================================================
  // PLATINUM API PROXY ROUTES (authenticated)
  // =====================================================

  // --- ReceiptPrepaid endpoints ---

  app.get("/api/platinum/receipt-prepaid/validate-cashier", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/validate-cashier", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/cons-accounts", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/cons-accounts", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/cons-account-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/cons-account-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/prepaid-account-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/prepaid-account-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/cashier-details-by-id", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/cashier-detailsById", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/active-cashier-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/active-cashier-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/active-cash-office-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/active-cashOffice-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/pos-payment-type", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/pos-payment-type");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/is-billing", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/is-billing");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/search-property-rates-payment", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/search-property-rates-payment", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/validate-cashier-day-end-recon", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/ValidateCashierDayEndRecon", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/get-billing-runs", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/GetBillingRuns");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/service-type-wise-prepaid-list", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/ServiceTypeWisePrepaidList", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/active-fin-year", async (req, res) => {
    try {
      const data = await platinumGet("/api/UserPermission/ActiveFinYear", {});
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/cash-offices", async (req, res) => {
    try {
      let query = req.query as Record<string, string>;
      if (!query.finYear) {
        const finYearData = await platinumGet("/api/UserPermission/ActiveFinYear", {});
        if (finYearData && !finYearData._error) {
          const finYear = typeof finYearData === 'string' ? finYearData.replace(/"/g, '') : String(finYearData);
          query = { ...query, finYear };
        }
      }
      const data = await platinumGet("/api/ReceiptPrepaid/cash-offices", query);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/cheque-amend-list", async (req, res) => {
    try {
      const data = await platinumGet("/api/ReceiptPrepaid/cheque-amendList", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/receipt-prepaid/utilipay-breakdown-request", async (req, res) => {
    try {
      const data = await platinumPost("/api/ReceiptPrepaid/UtiliPayBreakdownRequest", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/receipt-prepaid/utilipay-token-request", async (req, res) => {
    try {
      const data = await platinumPost("/api/ReceiptPrepaid/UtiliPayTokenRequest", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/receipt-prepaid/submit-prepaid-payment", async (req, res) => {
    try {
      const data = await platinumPost("/api/ReceiptPrepaid/SubmitPrepaidPayment", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/receipt-prepaid/submit-cashier-setup", async (req, res) => {
    try {
      const data = await platinumPost("/api/ReceiptPrepaid/submit-cashier-setup", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Payment endpoints ---

  app.post("/api/platinum/billing-payment/submit-consumer-payment/:userId", async (req, res) => {
    try {
      const data = await platinumPost(`/api/billing-payment/submit-consumer-payment/${req.params.userId}`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/save-multiple-account-payment", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment/save-multiple-account-payment", req.body, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment/get-multiple-account-payment", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment/get-multiple-account-payment", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/submit-multiple-payment/:userId", async (req, res) => {
    try {
      const data = await platinumPost(`/api/billing-payment/submit-multiple-payment/${req.params.userId}`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/search-accounts", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment/search-accounts", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/print-receipt", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment/print-receipt", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/print-miscellaneous-receipt", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment/print-miscellaneous-receipt", req.body, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Payment Clearance endpoints ---

  app.get("/api/platinum/billing-payment-clearance/get-clearanceids", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-clearance/get-clearanceids", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-clearance/pos-payment-type", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-clearance/pos-payment-type");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-clearance/get-banks", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-clearance/get-banks");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-clearance/get-branches-by-bank", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-clearance/get-brances-by-bank", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-clearance/get-clearance-data", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment-clearance/get-clearance-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-clearance/get-accounts-for-clearance", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment-clearance/get-accounts-for-clearance", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-clearance/submit-payment", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment-clearance/submit-payment", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Payment Miscellaneous endpoints ---

  app.get("/api/platinum/billing-payment-miscellaneous/get-groups", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-miscellaneous/get-groups");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-miscellaneous/get-scoa-items", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-miscellaneous/get-scoa-items", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-miscellaneous/get-vat-rate", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-miscellaneous/get-vat-rate");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-miscellaneous/submit", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment-miscellaneous/submit", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Day-End Reconciliation (Cashier) ---

  app.get("/api/platinum/billing-payment-day-end/get-cashier-list", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-day-end-reconcile/get-cashier-list");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-day-end/get-cashier-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-day-end-reconcile/get-cashier-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/get-cashier-receipt-cheque-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment-day-end-reconcile/get-cashier-receipt-cheque-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/get-cashier-receipt-card-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment-day-end-reconcile/get-cashier-receipt-card-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/get-cashier-receipt-drop-box-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment-day-end-reconcile/get-cashier-receipt-drop-box-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-day-end/get-cashier-receipt-reconcile-list", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-day-end-reconcile/get-cashier-receipt-reconcile-list", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/save-reconcile-data", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-payment-day-end-reconcile/save-Reconcile-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Auth Day-End Reconciliation (Supervisor) ---

  app.get("/api/platinum/auth-day-end/cashier-list", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/auth-day-end-reconcile/cashier-list");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/cashier-reconcile-by-cashierid", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/pos-cashier", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/auth-day-end-reconcile/pos-cashier");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/active-cashierid-by-userid", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/auth-day-end-reconcile/active-cashierid-by-userid", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/cashier-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/auth-day-end-reconcile/cashier-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-cash-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-cash-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-cheque-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-cheque-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-card-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-card-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-postal-order-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-postal-order-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-offline-data-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-offline-data-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-drop-box-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-drop-box-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/system-vs-cashier-data-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/system-vs-cashier-data-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/finish-day-end-reconcile", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/finish-day-end-reconcile", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/return-day-end-reconcile", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/return-day-end-reconcile", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/validate-cashbook", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/validate-cashbook", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/submit-day-auth-reconcile", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/submit-day-auth-reconcile", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cancel-receipt", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cancel-day-auth-reconcile-receipt", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/print-receipt", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/print-receipt", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/print-cash-report", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/print-cash-report", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/print-deposit-slip", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/print-deposit-slip", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Direct Deposit Allocation endpoints ---

  app.post("/api/platinum/direct-deposit-allocation/get-bank-recon-positem-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-direct-deposit-allocation/get-bank-recon-positem-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/check-selected-item-processed", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/check-selected-item-processed", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-misc-payment-group", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/get-misc-payment-group");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-misc-vote-id-by-group", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/get-misc-vote-id-by-group", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-group-payment-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/get-group-payment-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-vat-rate", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/get-vat-rate");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-pos-item-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/get-pos-item-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-account-autocomplete", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/get-account-autocomplete", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-clearance-autocomplete", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/get-clearence-autocomplete", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-old-account-autocomplete", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/get-old-account-autocomplete", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-details-payment-grouping", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-direct-deposit-allocation/load-details-payment-grouping", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-details-consumer-services", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-direct-deposit-allocation/load-details-consumer-services", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-details-clearance", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-direct-deposit-allocation/load-details-clearance", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/get-consumer-details-data", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-direct-deposit-allocation/get-consumer-details-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-confirm-payment-details", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-direct-deposit-allocation/load-confirm-payment-details", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/submit-details-data", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-direct-deposit-allocation/submit-details-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-misc-receipt-data", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/get-misc-receipt-data", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/vote-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-direct-deposit-allocation/vote-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Direct Deposit Bulk Allocation ---

  app.post("/api/platinum/direct-deposit-bulk/get-unprocessed", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/direct-deposit-bulk-allocation/get-unprocessed-direct-deposits", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-bulk/get-processed", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/direct-deposit-bulk-allocation/get-processed-deposits", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-bulk/reconcile", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/direct-deposit-bulk-allocation/reconcile-processed-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-bulk/print-processed", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/direct-deposit-bulk-allocation/print-processed-deposits", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Bulk Progress ---

  app.post("/api/platinum/bulk-progress/get-bulk-allocation-list", async (req, res) => {
    try {
      const data = await platinumPost("/api/BulkProgress/get-bulk-allocation-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/bulk-progress/direct-deposit/:jobId", async (req, res) => {
    try {
      const data = await platinumGet(`/api/BulkProgress/direct-deposit/${req.params.jobId}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Direct Deposit Errors ---

  app.get("/api/platinum/direct-deposit-errors/failed-jobs", async (req, res) => {
    try {
      const data = await platinumGet("/api/DirectDepositErrors/failed-jobs");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-errors/job-details/:jobId", async (req, res) => {
    try {
      const data = await platinumGet(`/api/DirectDepositErrors/job-details/${req.params.jobId}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-errors/account-details/:jobId", async (req, res) => {
    try {
      const data = await platinumGet(`/api/DirectDepositErrors/account-details/${req.params.jobId}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-errors/retry/:jobId/:userId", async (req, res) => {
    try {
      const data = await platinumPost(`/api/DirectDepositErrors/retry/${req.params.jobId}/${req.params.userId}`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Third Party Payments V2 ---

  app.post("/api/platinum/third-party-payments/import", async (req, res) => {
    try {
      const data = await platinumPost("/api/v2/pos/third-party-payments/import", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/third-party-payments/:importId/transactions", async (req, res) => {
    try {
      const data = await platinumGet(`/api/v2/pos/third-party-payments/${req.params.importId}/transactions`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/third-party-payments/validate-account", async (req, res) => {
    try {
      const data = await platinumPost("/api/v2/pos/third-party-payments/validate-account", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/third-party-payments/:importId/reconcile", async (req, res) => {
    try {
      const data = await platinumPost(`/api/v2/pos/third-party-payments/${req.params.importId}/reconcile`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/third-party-payments/:importId/commit", async (req, res) => {
    try {
      const data = await platinumPost(`/api/v2/pos/third-party-payments/${req.params.importId}/commit`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Enquiry endpoints ---

  app.get("/api/platinum/billing-enquiry/deposit-amount", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/DepositAmount", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/deposits-by-account-id", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/DepositsByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/receipt-transaction-detail", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/getReceiptTransactionDetail", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/total-balance-debt", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/TotalBalanceDebtInquiry", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/service-type-balance", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/ServiceTypeBalanceDetails", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-enquiry/reconcile/:receiptId", async (req, res) => {
    try {
      const data = await platinumPost(`/api/BillingEnquiry/reconcile/${req.params.receiptId}`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Dashboard POS counts ---

  app.get("/api/platinum/billing-dashboard/pos-count", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingDashboard/pos-count");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-dashboard/pos-tab-item-details-count", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingDashboard/get-pos-tab-item-details-count");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-dashboard/get-deposit-table-data", async (req, res) => {
    try {
      const data = await platinumPost("/api/BillingDashboard/get-deposit-table-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-dashboard/get-direct-deposits-allocation-table-data", async (req, res) => {
    try {
      const data = await platinumPost("/api/BillingDashboard/get-direct-deposits-allocation-table-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-dashboard/get-third-party-payment-pending-table-data", async (req, res) => {
    try {
      const data = await platinumPost("/api/BillingDashboard/get-third-party-payment-pending-table-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Account Management (selected endpoints) ---

  app.post("/api/platinum/billing-account-management/search-accounts", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing/account-management/search-accounts", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/account-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/account-management/account-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/account-information", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/account-management/account-information", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/get-contact-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/account-management/get-contact-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/get-property-details", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/account-management/get-property-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // =====================================================
  // LEGACY EXTERNAL API PROXY ROUTES (old billing API, no auth needed)
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

  app.get("/api/proxy/cons-names/:id", async (req, res) => {
    try {
      const data = await proxyGet(`${EXTERNAL_API_BASE}/api/cons-names/${req.params.id}`);
      if (data.error) {
        return res.status(data.status).json({ message: data.statusText });
      }
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.get("/api/proxy/cons-units/:id", async (req, res) => {
    try {
      const data = await proxyGet(`${EXTERNAL_API_BASE}/api/cons-units/${req.params.id}`);
      if (data.error) {
        return res.status(data.status).json({ message: data.statusText });
      }
      res.json(data);
    } catch (e: any) {
      res.status(502).json({ message: "External API unreachable", detail: e.message });
    }
  });

  app.get("/api/proxy/account-full-details/:id", async (req, res) => {
    try {
      const accountId = req.params.id;
      const accountData = await proxyGet(`${EXTERNAL_API_BASE}/api/cons-accounts/${accountId}`);
      if (accountData.error) {
        return res.status(accountData.status).json({ message: accountData.statusText });
      }

      const results: any = { account: accountData };

      const [nameData, unitData] = await Promise.all([
        accountData.nameId ? proxyGet(`${EXTERNAL_API_BASE}/api/cons-names/${accountData.nameId}`) : null,
        accountData.unitId ? proxyGet(`${EXTERNAL_API_BASE}/api/cons-units/${accountData.unitId}`) : null,
      ]);

      if (nameData && !nameData.error) results.name = nameData;
      if (unitData && !unitData.error) results.unit = unitData;

      res.json(results);
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

  app.get("/api/proxy/pos-multi-receipt-print", async (req, res) => {
    try {
      const params = new URLSearchParams(req.query as Record<string, string>);
      const url = `${EXTERNAL_API_BASE}/api/pos-multi-receipt-print?${params.toString()}`;
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

  app.get("/api/proxy/pos-multi-receipt-print/batch", async (req, res) => {
    try {
      const startId = parseInt(req.query.startId as string) || 312979;
      const count = Math.min(parseInt(req.query.count as string) || 50, 200);
      const direction = (req.query.direction as string) === 'forward' ? 1 : -1;

      const ids: number[] = [];
      for (let i = 0; i < count; i++) {
        ids.push(startId + (i * direction));
      }

      const fetchOne = async (id: number) => {
        try {
          const url = `${EXTERNAL_API_BASE}/api/pos-multi-receipt-print?receiptId=${id}`;
          const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              return data.map((item: any) => ({ ...item, _receiptId: id }));
            }
          }
        } catch {}
        return null;
      };

      const results = await Promise.all(ids.map(fetchOne));
      const allResults: any[] = [];
      for (const r of results) {
        if (r) allResults.push(...r);
      }

      res.json(allResults);
    } catch (e: any) {
      res.status(502).json({ message: "Batch fetch failed", detail: e.message });
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

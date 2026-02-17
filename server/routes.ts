import type { Express } from "express";
import { createServer, type Server } from "http";
import { platinumGet, platinumPost, getPlatinumUserInfo, getPlatinumToken, getPlatinumApiUrl, getPlatinumAuthMode, loginWithCredentials, logoutUser, isAuthenticated } from "./platinum-auth";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";

const EXTERNAL_API_BASE = "https://george-uat-ems-billing-api.azurewebsites.net";

interface ReceiptAllocation {
  service: string;
  amount: number;
  vat: number;
  total: number;
}

function parseReceiptAllocations(pdfText: string): ReceiptAllocation[] {
  const allocations: ReceiptAllocation[] = [];
  const lines = pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let receiptNo = '';
  let totalAmount = 0;
  let vatAmount = 0;
  let tenderAmount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('Receipt No') && i + 1 < lines.length) {
      receiptNo = lines[i + 1];
    }

    const amountMatch = line.match(/^([\d,]+\.\d{2})$/);
    if (amountMatch && i > 0) {
      const prevLine = lines[i - 1];
      const val = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (prevLine === 'VAT Amount') vatAmount = val;
      else if (prevLine === 'Total') totalAmount = val;
      else if (prevLine === 'Tender Amount') tenderAmount = val;
    }
  }

  const serviceKeywords = [
    'Water', 'Electricity', 'Property Rates', 'Rates', 'Sanitation', 'Sewerage',
    'Waste', 'Refuse', 'Housing', 'Sundry', 'Advance Payment', 'Interest',
    'Electricity Basic', 'Electricity Metered', 'Sanitation Basic', 'Waste Disposal',
    'Water Basic', 'Water Metered', 'Assessment Rates'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matched = serviceKeywords.find(kw => line.toLowerCase().includes(kw.toLowerCase()));
    if (matched) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const valMatch = lines[j].match(/^-?([\d,]+\.\d{2})$/);
        if (valMatch) {
          const amount = parseFloat(valMatch[0].replace(/,/g, ''));
          if (amount !== 0) {
            allocations.push({
              service: line,
              amount: amount,
              vat: 0,
              total: amount,
            });
          }
          break;
        }
      }
    }
  }

  if (allocations.length === 0 && tenderAmount > 0) {
    allocations.push({
      service: 'Consumer Services',
      amount: tenderAmount - vatAmount,
      vat: vatAmount,
      total: tenderAmount,
    });
  }

  return allocations;
}

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
    return res.status(data.status || 502).json({ message: data.statusText || "Platinum API error", detail: data.detail || null });
  }
  res.json(data);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // =====================================================
  // LOGIN / LOGOUT / AUTH STATUS
  // =====================================================

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, dbName } = req.body;
      if (!username) {
        return res.status(400).json({ success: false, error: "Username is required" });
      }
      const result = await loginWithCredentials(username, password, dbName);
      if (result.success) {
        res.json({ success: true, user: result.userData });
      } else {
        res.status(401).json({ success: false, error: result.error });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/auth/logout", async (_req, res) => {
    logoutUser();
    res.json({ success: true });
  });

  app.get("/api/auth/status", async (_req, res) => {
    const authenticated = isAuthenticated();
    if (authenticated) {
      const userData = await getPlatinumUserInfo();
      res.json({ authenticated: true, user: userData });
    } else {
      res.json({ authenticated: false });
    }
  });

  // =====================================================
  // PLATINUM AUTH / USER INFO
  // =====================================================

  app.get("/api/platinum/auth/user-info", async (req, res) => {
    try {
      const userData = await getPlatinumUserInfo();
      if (!userData) {
        return res.status(503).json({ message: "Platinum user data not available" });
      }
      res.json({
        user_ID: userData.user_ID,
        userName: userData.userName,
        firstName: userData.firstName,
        lastName: userData.lastName,
        eMail: userData.eMail,
        enabled: userData.enabled,
        superUser: userData.superUser,
        cashFloat: userData.cashFloat,
        finYear: userData.finYear,
        authMode: getPlatinumAuthMode(),
      });
    } catch (e: any) {
      res.status(502).json({ message: "Failed to get Platinum user info", detail: e.message });
    }
  });

  app.post("/api/platinum/auth/ensure-cashier", async (req, res) => {
    try {
      const userData = await getPlatinumUserInfo();
      if (!userData) {
        return res.status(503).json({ success: false, message: "Platinum user data not available" });
      }

      const userId = userData.user_ID;

      const activeCashierId = await platinumGet("/api/billing/auth-day-end-reconcile/active-cashierid-by-userid", { userid: String(userId) });
      
      if (activeCashierId && activeCashierId !== 0 && !activeCashierId._error) {
        const details = await platinumGet(`/api/ReceiptPrepaid/cashier-detailsById`, { cashierId: String(activeCashierId) });
        const cashOffice = details?.const_CashOffice || null;
        const hasPOSCashierRecord = details?.user_Id != null && details?.id !== 0;
        
        return res.json({
          success: true,
          cashierId: activeCashierId,
          officeId: cashOffice?.cashOffice_ID || details?.officeId || null,
          officeName: cashOffice?.cashOfficeDesc || null,
          cashierMapped: hasPOSCashierRecord,
          message: hasPOSCashierRecord 
            ? "Cashier is active and fully registered" 
            : "Cashier session is active but POSCashier record is not fully mapped. Consumer account payments will work. Direct income/miscellaneous payments require the cashier to be set up through the Platinum admin portal (Cashier Management screen).",
        });
      }

      res.json({
        success: false,
        needsSetup: true,
        userId,
        message: "User is not registered as an active cashier in Platinum. This user needs to be set up through the Platinum admin portal.",
      });
    } catch (e: any) {
      res.status(502).json({ success: false, message: "Cashier validation failed", detail: e.message });
    }
  });

  app.get("/api/platinum/auth/active-cashier-by-userid", async (req, res) => {
    try {
      const userId = req.query.userid as string;
      if (!userId) {
        return res.status(400).json({ message: "userid is required" });
      }
      const cashierId = await platinumGet("/api/billing/auth-day-end-reconcile/active-cashierid-by-userid", { userid: userId });
      
      if (!cashierId && cashierId !== 0) {
        return res.json({ active: false, cashierId: null, cashierRegistered: false });
      }

      let cashierDetails: any = null;
      let activeOfficeId: number | null = null;
      let activeOfficeName: string | null = null;

      const detailEndpoints: Array<{ path: string; params: Record<string, string> }> = [
        { path: "/api/ReceiptPrepaid/ActiveCashierDetails", params: { userId } },
        { path: "/api/ReceiptPrepaid/active-cashier-details", params: { user: userId } },
        { path: "/api/ReceiptPrepaid/cashier-detailsById", params: { cashierId: String(cashierId) } },
      ];

      for (const ep of detailEndpoints) {
        try {
          const result = await platinumGet(ep.path, ep.params);
          if (result && !result._error) {
            const hasValidData = result.id > 0 || result.isActive === true || result.officeId > 0;
            if (hasValidData) {
              cashierDetails = result;
              console.log(`[active-cashier] Got valid details from ${ep.path}:`, JSON.stringify({ id: result.id, officeId: result.officeId, isActive: result.isActive, office: result.const_CashOffice?.cashOfficeDesc }));
              break;
            } else if (!cashierDetails && result.const_CashOffice) {
              cashierDetails = result;
              console.log(`[active-cashier] Got fallback details from ${ep.path} (id:${result.id}, inactive):`, JSON.stringify({ office: result.const_CashOffice?.cashOfficeDesc }));
            }
          }
        } catch {}
      }

      const isSessionActive = cashierDetails?.isActive === true;

      if (isSessionActive) {
        const cashOffice = cashierDetails?.const_CashOffice || null;
        activeOfficeId = cashOffice?.cashOffice_ID || cashierDetails?.officeId || null;
        activeOfficeName = cashOffice?.cashOfficeDesc || null;
      }

      const hasOffice = !!activeOfficeId;
      const isCashierRegistered = cashierId != null && cashierId !== 0;

      res.json({
        active: isSessionActive && hasOffice,
        cashierId: isCashierRegistered ? cashierId : null,
        cashierRegistered: isCashierRegistered,
        cashFloat: cashierDetails?.cashFloat ?? 0,
        officeId: activeOfficeId,
        officeName: activeOfficeName,
        cashOnHandLimit: isSessionActive ? (cashierDetails?.const_CashOffice?.cashOnHandLimit || 999999) : 999999,
        isActive: isSessionActive,
        details: cashierDetails,
      });
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

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
      const data = await platinumGet("/api/billing-payment-clearance/pos-payment-type", req.query as Record<string, string>);
      if (data && data._error) {
        console.error(`[pos-payment-type] Fallback billing-payment-clearance also failed: status=${data.status}, detail=${JSON.stringify(data.detail)}`);
      }
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[pos-payment-type] Exception:`, e.message);
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

      console.log(`[cash-offices] Calling Platinum cash-offices with finYear=${query.finYear}`);
      const primaryData = await platinumGet("/api/ReceiptPrepaid/cash-offices", query);

      const officeMap = new Map<number, any>();
      const addOffice = (office: any) => {
        if (office && office.cashOffice_ID && !officeMap.has(office.cashOffice_ID)) {
          officeMap.set(office.cashOffice_ID, {
            cashOffice_ID: office.cashOffice_ID,
            cashOfficeDesc: office.cashOfficeDesc || '',
            cashOnHandLimit: office.cashOnHandLimit || null,
            scoaConfigurationID: office.scoaConfigurationID || null,
            vote1: office.vote1 || null,
            vote: office.vote || null,
            vote_ID: office.vote_ID || null,
            voteDesc: office.voteDesc || null,
          });
        }
      };

      if (primaryData && !primaryData._error && Array.isArray(primaryData)) {
        primaryData.forEach(addOffice);
        console.log(`[cash-offices] Primary endpoint returned ${primaryData.length} offices`);
      }

      if (officeMap.size < 5) {
        console.log(`[cash-offices] Few offices from primary, probing IDs 1-20...`);
        const probeIds = Array.from({ length: 20 }, (_, i) => i + 1).filter(id => !officeMap.has(id));
        const probeResults = await Promise.all(
          probeIds.map(async (id) => {
            try {
              const office = await platinumGet("/api/ReceiptPrepaid/active-cashOffice-details", { cashierId: String(id) });
              if (office && !office._error && office.cashOffice_ID) return office;
            } catch {}
            return null;
          })
        );
        probeResults.filter(Boolean).forEach(addOffice);
        console.log(`[cash-offices] After probe: ${officeMap.size} offices found`);
      }

      const offices = Array.from(officeMap.values()).sort((a: any, b: any) => a.cashOffice_ID - b.cashOffice_ID);
      console.log(`[cash-offices] Returning ${offices.length} offices`);
      res.json(offices);
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
      const body = { ...req.body };
      body.isActive = true;
      const userId = body.user_Id;

      if (!userId) {
        return res.status(400).json({ message: "user_Id is required" });
      }

      const userDetail = await platinumGet(`/api/User/${userId}`);
      if (!userDetail || userDetail._error || !userDetail.enabled) {
        return res.status(400).json({
          message: "User not valid",
          detail: `User ${userId} is not found or not enabled in Platinum.`,
        });
      }

      console.log(`[submit-cashier-setup] Submitting for user ${userDetail.firstName} ${userDetail.lastName} (ID: ${userId}), office: ${body.officeId}`);
      console.log(`[submit-cashier-setup] Payload:`, JSON.stringify(body));
      const data = await platinumPost("/api/ReceiptPrepaid/submit-cashier-setup", body);
      console.log(`[submit-cashier-setup] Response:`, JSON.stringify(data));

      if (data && data._error) {
        const detail = data.detail || data.statusText || JSON.stringify(data);
        console.error(`[submit-cashier-setup] API error:`, detail);
        return res.status(data.status || 400).json({ message: "Cashier setup failed", detail });
      }

      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[submit-cashier-setup] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/user/:id", async (req, res) => {
    try {
      const data = await platinumGet(`/api/User/${req.params.id}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/platinum/user/:id", async (req, res) => {
    try {
      const { platinumPut } = await import("./platinum-auth");
      const data = await platinumPut(`/api/User/${req.params.id}`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Payment endpoints ---

  app.post("/api/platinum/billing-payment/submit-consumer-payment/:userId", async (req, res) => {
    try {
      console.log(`[submit-consumer-payment] userId=${req.params.userId}, payload:`, JSON.stringify(req.body, null, 2));
      const data = await platinumPost(`/api/billing-payment/submit-consumer-payment/${req.params.userId}`, req.body);
      console.log(`[submit-consumer-payment] response:`, JSON.stringify(data));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/save-multiple-account-payment", async (req, res) => {
    try {
      const accounts = Array.isArray(req.body) ? req.body : [];
      for (const acct of accounts) {
        console.log(`[save-multiple-account-payment] account_ID=${acct.account_ID}, outStandingAmt=${acct.outStandingAmt}, name=${acct.name}`);
      }
      const data = await platinumPost("/api/billing-payment/save-multiple-account-payment", req.body, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment/get-multiple-account-payment", async (req, res) => {
    try {
      console.log(`[get-multiple-account-payment] query:`, req.query);
      const data = await platinumGet("/api/billing-payment/get-multiple-account-payment", req.query as Record<string, string>);
      console.log(`[get-multiple-account-payment] response:`, JSON.stringify(data));
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
      const receiptIds = req.body;
      if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
        return res.status(400).json({ message: "Request body must be an array of receipt serial numbers" });
      }

      const token = await getPlatinumToken();
      const apiUrl = getPlatinumApiUrl();

      const pdfRes = await fetch(`${apiUrl}/api/billing-payment/print-receipt`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/pdf,application/octet-stream,*/*",
        },
        body: JSON.stringify(receiptIds.map(Number)),
      });

      if (!pdfRes.ok) {
        const errorText = await pdfRes.text().catch(() => "");
        console.error(`[print-receipt] Platinum returned ${pdfRes.status}: ${errorText}`);
        return res.status(pdfRes.status).json({ message: "Failed to fetch receipt PDF from Platinum", detail: errorText });
      }

      const contentType = pdfRes.headers.get("content-type") || "";
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

      if (contentType.includes("application/pdf") || pdfBuffer.length > 100) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="receipt_${receiptIds.join("_")}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
      }

      res.json({ message: "Receipt generated", size: pdfBuffer.length });
    } catch (e: any) {
      console.error("[print-receipt] Error:", e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment/receipt-allocations", async (req, res) => {
    try {
      const receiptId = req.query.receiptId as string;
      if (!receiptId) {
        return res.status(400).json({ message: "receiptId is required" });
      }

      const token = await getPlatinumToken();
      const apiUrl = getPlatinumApiUrl();

      const pdfRes = await fetch(`${apiUrl}/api/billing-payment/print-receipt`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/pdf",
        },
        body: JSON.stringify([Number(receiptId)]),
      });

      if (!pdfRes.ok) {
        return res.status(pdfRes.status).json({ message: "Failed to fetch receipt PDF" });
      }

      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
      const tmpPath = `/tmp/receipt_alloc_${receiptId}_${Date.now()}.pdf`;

      try {
        writeFileSync(tmpPath, pdfBuffer);
        const text = execSync(`pdftotext ${tmpPath} -`, { timeout: 10000 }).toString();

        const allocations = parseReceiptAllocations(text);
        res.json({ receiptId, allocations });
      } finally {
        if (existsSync(tmpPath)) {
          try { unlinkSync(tmpPath); } catch {}
        }
      }
    } catch (e: any) {
      console.error("[receipt-allocations] Error:", e.message);
      res.status(502).json({ message: "Failed to extract receipt allocations", detail: e.message });
    }
  });

  // =====================================================
  // VIEW RECEIPT ENDPOINTS
  // =====================================================

  app.get("/api/platinum/view-receipt/get-cashiers", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/auth-day-end-reconcile/cashier-list");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/view-receipt/search-account-numbers", async (req, res) => {
    try {
      const data = await platinumGet("/api/ViewReceipt/search-account-numbers", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/view-receipt/search-receipt-numbers", async (req, res) => {
    try {
      const data = await platinumGet("/api/ViewReceipt/search-recept-numbers", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/view-receipt/get-receipt-list", async (req, res) => {
    try {
      console.log(`[get-receipt-list] Request payload:`, JSON.stringify(req.body));

      const token = await getPlatinumToken();
      const apiUrl = getPlatinumApiUrl();
      const url = `${apiUrl}/api/ViewReceipt/get-receipt-list`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);
      try {
        const rawRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
          signal: controller.signal,
        });

        const rawText = await rawRes.text();
        console.log(`[get-receipt-list] Raw status: ${rawRes.status}, Raw response (first 1000 chars):`, rawText.substring(0, 1000));

        if (!rawRes.ok) {
          console.error(`[get-receipt-list] API error ${rawRes.status}: ${rawText.substring(0, 500)}`);
          return res.status(rawRes.status).json({ message: rawRes.statusText, detail: rawText.substring(0, 500) });
        }

        let data;
        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch {
          data = rawText;
        }

        console.log(`[get-receipt-list] Parsed item count:`, Array.isArray(data) ? data.length : (data?.items?.length ?? 'unknown'));

        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const items = data.items || data.value || data.results || data.data || [];
          const totalCount = data.totalCount ?? data.totalRecords ?? data.total ?? items.length;
          res.json({ items, totalCount });
        } else if (Array.isArray(data)) {
          res.json({ items: data, totalCount: data.length });
        } else {
          res.json({ items: [], totalCount: 0 });
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e: any) {
      console.error(`[get-receipt-list] Error:`, e.message);
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

  // === CASHIER PAYMENT OPTIONS (per-cashier allowed functions) ===
  // GET /api/billing-payment/payment-options?userId={userId}&cashofficeId={cashofficeId}&cashierId={cashierId}
  app.get("/api/platinum/receipt-prepaid/cashier-payment-options", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const cashofficeId = req.query.cashofficeId as string;
      const cashierId = req.query.cashierId as string;

      if (!userId || !cashofficeId || !cashierId) {
        return res.status(400).json({ message: "userId, cashofficeId, and cashierId are all required" });
      }

      console.log(`[cashier-payment-options] Calling Platinum billing-payment/payment-options — userId=${userId}, cashofficeId=${cashofficeId}, cashierId=${cashierId}`);
      const data = await platinumGet("/api/billing-payment/payment-options", { userId, cashofficeId, cashierId });

      if (data && !data._error) {
        console.log(`[cashier-payment-options] Platinum returned:`, JSON.stringify(data).substring(0, 500));

        let options: any[] = [];
        if (Array.isArray(data)) {
          options = data;
        } else if (data.data && Array.isArray(data.data)) {
          options = data.data;
        } else if (data.value && Array.isArray(data.value)) {
          options = data.value;
        }

        const normalized = options.map((opt: any) => ({
          posPaymentOption_ID: opt.posPaymentOption_ID ?? opt.posPaymentOptionID ?? opt.id ?? opt.Id ?? 0,
          posPaymentOptionDesc: opt.posPaymentOptionDesc ?? opt.description ?? opt.Description ?? '',
          isTicked: opt.isTicked ?? opt.IsTicked ?? opt.isEnabled ?? true,
          enabled: opt.enabled ?? opt.Enabled ?? opt.isEnabled ?? true,
        }));

        console.log(`[cashier-payment-options] Returning ${normalized.length} options from Platinum API`);
        return res.json({ source: "platinum", data: normalized });
      }

      console.warn(`[cashier-payment-options] Platinum API returned error or empty, using fallback. Response:`, JSON.stringify(data).substring(0, 500));
      const allOptionsEnabled = [
        { posPaymentOption_ID: 1, posPaymentOptionDesc: "Consumer Services", isTicked: true, enabled: true },
        { posPaymentOption_ID: 2, posPaymentOptionDesc: "Miscellaneous", isTicked: true, enabled: true },
        { posPaymentOption_ID: 3, posPaymentOptionDesc: "Account Group", isTicked: true, enabled: true },
        { posPaymentOption_ID: 4, posPaymentOptionDesc: "Clearance", isTicked: true, enabled: true },
        { posPaymentOption_ID: 5, posPaymentOptionDesc: "Prepaid", isTicked: true, enabled: true },
        { posPaymentOption_ID: 6, posPaymentOptionDesc: "Direct Deposit Allocation", isTicked: true, enabled: true },
      ];
      res.json({ source: "fallback", data: allOptionsEnabled });
    } catch (e: any) {
      console.error(`[cashier-payment-options] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // === CASHIER PAYMENT TYPES (per-cashier allowed tender methods) ===
  // PLACEHOLDER: Currently returns global payment types from billing-payment-clearance.
  // When the developer adds a per-cashier endpoint using POS_CashierPOSPaymentType table,
  // replace this with the real call filtered by cashierId.
  app.get("/api/platinum/receipt-prepaid/cashier-payment-types", async (req, res) => {
    try {
      const cashierId = req.query.cashierId as string;
      if (!cashierId) {
        return res.status(400).json({ message: "cashierId is required" });
      }

      // TODO: Replace with per-cashier endpoint once available:
      // const data = await platinumGet("/api/ReceiptPrepaid/cashier-payment-types", { cashierId });
      // if (data && !data._error) { return res.json(data); }

      const globalTypes = await platinumGet("/api/billing-payment-clearance/pos-payment-type");
      if (globalTypes && !globalTypes._error) {
        console.log(`[cashier-payment-types] Using global payment types for cashier ${cashierId} (per-cashier endpoint not yet available)`);
        return res.json({ source: "global", data: globalTypes });
      }
      handlePlatinumResult(res, globalTypes);
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
      console.log(`[clearance-data] Request:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing-payment-clearance/get-clearance-data", req.body);
      console.log(`[clearance-data] Response:`, JSON.stringify(data).substring(0, 2000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-clearance/get-accounts-for-clearance", async (req, res) => {
    try {
      console.log(`[clearance-accounts] Request:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing-payment-clearance/get-accounts-for-clearance", req.body);
      console.log(`[clearance-accounts] Response:`, JSON.stringify(data).substring(0, 2000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-clearance/submit-payment", async (req, res) => {
    try {
      console.log(`[clearance-submit] Request payload:`, JSON.stringify(req.body));

      const token = await getPlatinumToken();
      const apiUrl = getPlatinumApiUrl();
      const url = `${apiUrl}/api/billing-payment-clearance/submit-payment`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);
      try {
        const rawRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
          signal: controller.signal,
        });

        const rawText = await rawRes.text();
        console.log(`[clearance-submit] Raw status: ${rawRes.status}, Raw response:`, rawText.substring(0, 2000));

        if (!rawRes.ok) {
          console.error(`[clearance-submit] API error ${rawRes.status}: ${rawText}`);
          return res.status(rawRes.status).json({ message: rawRes.statusText, detail: rawText.substring(0, 1000) });
        }

        let data;
        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch {
          data = rawText;
        }
        console.log(`[clearance-submit] Parsed response:`, JSON.stringify(data).substring(0, 500));
        res.json(data);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e: any) {
      console.error(`[clearance-submit] Error:`, e.message);
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

  // --- Billing Enquiry - Search ---

  app.post("/api/platinum/billing-enquiry/enquiry-results", async (req, res) => {
    try {
      const data = await platinumPost("/api/BillingEnquiry/EnquiryResults", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Municipality / Institution Info ---

  app.get("/api/platinum/billing-enquiry/get-app-setting", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/GetAppSetting", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/get-config-setting", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/GetAAAA_ConfigSetting", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-info", async (req, res) => {
    try {
      const settings: Record<string, string> = {};

      const appSettingKeys = [
        'InstitutionName', 'InstitutionAddress1', 'InstitutionAddress2',
        'InstitutionAddress3', 'InstitutionPostalCode', 'InstitutionTel',
        'InstitutionFax', 'VATRegistrationNo', 'InstitutionEmail',
        'InstitutionWebsite', 'ReceiptFooter', 'ReceiptHeader',
        'MunicipalityName', 'MunicipalityAddress', 'MunicipalityVatNo',
        'CompanyName', 'CompanyAddress', 'CompanyVatNo',
        'SiteName', 'SiteAddress', 'OrgName',
      ];

      const results = await Promise.allSettled(
        appSettingKeys.map(async (key) => {
          try {
            const val = await platinumGet("/api/BillingEnquiry/GetAppSetting", { key });
            return { key, value: val };
          } catch {
            return { key, value: null };
          }
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.value !== null && result.value.value !== undefined) {
          const val = result.value.value;
          if (typeof val === 'string' && val.trim().length > 0) {
            settings[result.value.key] = val.trim();
          } else if (typeof val !== 'string' && val) {
            settings[result.value.key] = String(val);
          }
        }
      }

      const configKeys = [
        'InstitutionName', 'MunicipalityName', 'VATRegistrationNo',
        'InstitutionAddress', 'ReceiptHeader', 'ReceiptFooter',
      ];
      if (Object.keys(settings).length === 0) {
        const configResults = await Promise.allSettled(
          configKeys.map(async (key) => {
            try {
              const val = await platinumGet("/api/BillingEnquiry/GetAAAA_ConfigSetting", { strKeyName: key });
              return { key, value: val };
            } catch {
              return { key, value: null };
            }
          })
        );
        for (const result of configResults) {
          if (result.status === 'fulfilled' && result.value.value !== null && result.value.value !== undefined) {
            const val = result.value.value;
            if (typeof val === 'string' && val.trim().length > 0) {
              settings[result.value.key] = val.trim();
            }
          }
        }
      }

      console.log('[Receipt Info] Retrieved settings:', Object.keys(settings).length > 0 ? settings : '(no settings found - will use fallback)');
      res.json(settings);
    } catch (e: any) {
      console.error('[Receipt Info] Error fetching settings:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Enquiry - Rebuild ---

  app.get("/api/platinum/billing-enquiry/rebuild-full-account", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/rebuildFullAccount", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/get-rebuild-account-ss-check", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/getRebuildAccountSSCheck", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Day-End Reconciliation (Cashier) ---

  app.get("/api/platinum/billing-payment-day-end/get-cashier-list", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing-payment-day-end-reconcile/get-cashier-list");
      console.log(`[dayend-cashier-list] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-day-end/get-cashier-details", async (req, res) => {
    try {
      console.log(`[dayend-cashier-details] Query:`, req.query);
      const data = await platinumGet("/api/billing-payment-day-end-reconcile/get-cashier-details", req.query as Record<string, string>);
      console.log(`[dayend-cashier-details] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/get-cashier-receipt-cheque-list", async (req, res) => {
    try {
      console.log(`[dayend-cheque] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing-payment-day-end-reconcile/get-cashier-receipt-cheque-list", req.body, req.query as Record<string, string>);
      console.log(`[dayend-cheque] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/get-cashier-receipt-card-list", async (req, res) => {
    try {
      console.log(`[dayend-card] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing-payment-day-end-reconcile/get-cashier-receipt-card-list", req.body, req.query as Record<string, string>);
      console.log(`[dayend-card] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/get-cashier-receipt-drop-box-list", async (req, res) => {
    try {
      console.log(`[dayend-dropbox] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing-payment-day-end-reconcile/get-cashier-receipt-drop-box-list", req.body, req.query as Record<string, string>);
      console.log(`[dayend-dropbox] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-day-end/get-cashier-receipt-reconcile-list", async (req, res) => {
    try {
      console.log(`[dayend-reconcile-list] Query:`, req.query);
      const data = await platinumGet("/api/billing-payment-day-end-reconcile/get-cashier-receipt-reconcile-list", req.query as Record<string, string>);
      console.log(`[dayend-reconcile-list] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/save-reconcile-data", async (req, res) => {
    try {
      console.log(`[dayend-save] Query: userId=${req.query.userId}, Payload:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing-payment-day-end-reconcile/save-Reconcile-data", req.body, req.query as Record<string, string>);
      console.log(`[dayend-save] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Auth Day-End Reconciliation (Supervisor) ---

  app.get("/api/platinum/auth-day-end/cashier-list", async (req, res) => {
    try {
      console.log(`[auth-dayend-cashier-list] Fetching...`);
      const data = await platinumGet("/api/billing/auth-day-end-reconcile/cashier-list");
      console.log(`[auth-dayend-cashier-list] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/cashier-reconcile-by-cashierid", async (req, res) => {
    try {
      console.log(`[auth-dayend-reconcile] Query:`, req.query);
      const data = await platinumGet("/api/billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid", req.query as Record<string, string>);
      console.log(`[auth-dayend-reconcile] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/pos-cashier", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/auth-day-end-reconcile/pos-cashier", req.query as Record<string, string>);
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
      console.log(`[auth-dayend-details] Query:`, req.query);
      const data = await platinumGet("/api/billing/auth-day-end-reconcile/cashier-details", req.query as Record<string, string>);
      console.log(`[auth-dayend-details] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-cash-list", async (req, res) => {
    try {
      console.log(`[auth-dayend-cash] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-cash-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-cash] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-cheque-list", async (req, res) => {
    try {
      console.log(`[auth-dayend-cheque] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-cheque-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-cheque] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-card-list", async (req, res) => {
    try {
      console.log(`[auth-dayend-card] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-card-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-card] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-postal-order-list", async (req, res) => {
    try {
      console.log(`[auth-dayend-postal] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-postal-order-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-postal] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-offline-data-list", async (req, res) => {
    try {
      console.log(`[auth-dayend-offline] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-offline-data-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-offline] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-drop-box-list", async (req, res) => {
    try {
      console.log(`[auth-dayend-dropbox] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cashier-receipt-drop-box-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-dropbox] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/system-vs-cashier-data-list", async (req, res) => {
    try {
      console.log(`[auth-dayend-sys-vs-cashier] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/system-vs-cashier-data-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-sys-vs-cashier] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/finish-day-end-reconcile", async (req, res) => {
    try {
      console.log(`[auth-dayend-finish] Query: userId=${req.query.userId}`);
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/finish-day-end-reconcile", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-finish] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/return-day-end-reconcile", async (req, res) => {
    try {
      console.log(`[auth-dayend-return] Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/return-day-end-reconcile", req.body);
      console.log(`[auth-dayend-return] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/validate-cashbook", async (req, res) => {
    try {
      console.log(`[auth-dayend-validate] Query: cashierId=${req.query.cashierId}`);
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/validate-cashbook", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-validate] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/submit-day-auth-reconcile", async (req, res) => {
    try {
      console.log(`[auth-dayend-submit] Query:`, req.query);
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/submit-day-auth-reconcile", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-submit] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cancel-receipt", async (req, res) => {
    try {
      console.log(`[auth-dayend-cancel] Body:`, JSON.stringify(req.body));
      const data = await platinumPost("/api/billing/auth-day-end-reconcile/cancel-day-auth-reconcile-receipt", req.body);
      console.log(`[auth-dayend-cancel] Response:`, JSON.stringify(data).substring(0, 500));
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
      const data = await platinumPost("/api/billing-direct-deposit-allocation/load-details-payment-grouping", req.body, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-details-payment-grouping-institution-data", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-direct-deposit-allocation/load-details-payment-grouping-institution-data", req.body, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-details-consumer-services", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-direct-deposit-allocation/load-details-consumer-services", req.body, req.query as Record<string, string>);
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

  app.post("/api/platinum/direct-deposit-allocation/get-clearance-details-info", async (req, res) => {
    try {
      const data = await platinumPost("/api/billing-direct-deposit-allocation/get-clearance-details-info", req.body);
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
      const data = await platinumPost("/api/billing-direct-deposit-allocation/load-confirm-payment-details", req.body, req.query as Record<string, string>);
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
      const accountId = req.query.accountId as string;
      const data = await platinumGet("/api/BillingEnquiry/TotalBalanceDebtInquiry", { accountId });
      
      // If no data or error, fallback to enquiry results which might have some info
      if (!data || data._error || (Array.isArray(data) && data.length === 0)) {
         const enquiryData = await platinumPost("/api/BillingEnquiry/EnquiryResults", { accountID: accountId });
         if (enquiryData && !enquiryData._error) {
            const results = Array.isArray(enquiryData) ? enquiryData : (enquiryData.results || [enquiryData]);
            const match = results.find((r: any) => String(r.accountID) === accountId);
            if (match) {
               return res.json([{
                  serviceDescription: "Balance B/F",
                  totalOutStanding: match.outStandingAmount || 0,
                  currentAccount: match.outStandingAmount || 0,
                  newCharge: 0,
                  days30: 0, days60: 0, days90: 0, days120: 0, days150: 0, untill360: 0
               }]);
            }
         }
      }
      
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

  app.get("/api/platinum/billing-enquiry/property-details-by-account", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/PropertyDetailsByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/cons-unit-by-account", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/ConsUnitByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/name-info-by-account", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/NameInfoByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/handover-by-account", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/HandoverByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/payment-incentive-by-account", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingEnquiry/PaymentIncentiveByAccountId", req.query as Record<string, string>);
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

  app.get("/api/platinum/billing-dashboard/get-alert-counts", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingDashboard/get-alert-counts");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-dashboard/get-notification-counts", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingDashboard/get-notification-counts");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-dashboard/get-billing-payment-by-type-of-use", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingDashboard/get-billing-payment-by-type-of-use");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-dashboard/account-count", async (req, res) => {
    try {
      const data = await platinumGet("/api/BillingDashboard/account-count");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-dashboard/get-post-dated-cheque-search-table-data", async (req, res) => {
    try {
      const data = await platinumPost("/api/BillingDashboard/get-post-dated-cheque-search-table-data", req.body);
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

  app.get("/api/platinum/billing-account-management/get-account-grouping", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/account-management/get-account-grouping", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/get-sub-account-grouping", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/account-management/get-sub-account-grouping", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/get-payment-group-list", async (req, res) => {
    try {
      const data = await platinumGet("/api/billing/account-management/get-payment-group-list");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipting-account-group/get-account-groups", async (req, res) => {
    try {
      const data = await platinumGet("/api/receipting-account-group/get-account-groups", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipting-account-group/get-account-sub-groups", async (req, res) => {
    try {
      const data = await platinumGet("/api/receipting-account-group/get-account-sub-groups", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipting-account-group/search", async (req, res) => {
    try {
      const data = await platinumGet("/api/receipting-account-group/search", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipting-account-group-payment/search-accounts-by-group", async (req, res) => {
    try {
      const data = await platinumGet("/api/receipting-account-group-payment/search-accounts-by-group", req.query as Record<string, string>);
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

  app.get("/api/proxy/pos-multi-receipt-print/by-cashier", async (req, res) => {
    try {
      const cashierName = req.query.cashierName as string;
      const startId = parseInt(req.query.startId as string) || 0;
      const scanCount = Math.min(parseInt(req.query.scanCount as string) || 100, 300);

      if (!cashierName) {
        return res.status(400).json({ message: "cashierName required" });
      }

      let highestKnownId = startId;
      if (!highestKnownId) {
        try {
          const probeIds = [1041400, 1041350, 1041300, 1041280, 1041270, 1041260];
          for (const probeId of probeIds) {
            const url = `${EXTERNAL_API_BASE}/api/pos-multi-receipt-print?receiptId=${probeId}`;
            const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (resp.ok) {
              const data = await resp.json();
              if (Array.isArray(data) && data.length > 0) {
                highestKnownId = probeId;
                break;
              }
            }
          }
          if (!highestKnownId) {
            let probeId = 1041300;
            while (probeId > 1041200) {
              const url = `${EXTERNAL_API_BASE}/api/pos-multi-receipt-print?receiptId=${probeId}`;
              const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
              if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data) && data.length > 0) {
                  highestKnownId = probeId;
                  break;
                }
              }
              probeId -= 5;
            }
          }
        } catch {}
        if (!highestKnownId) highestKnownId = 1041280;
      }

      const scanStartId = highestKnownId + 30;
      console.log(`[by-cashier] Scanning from ${scanStartId} backwards for cashierName=${cashierName}, count=${scanCount}`);

      const ids: number[] = [];
      for (let i = 0; i < scanCount; i++) {
        ids.push(scanStartId - i);
      }

      const batchSize = 20;
      const allMatching: any[] = [];

      for (let batch = 0; batch < ids.length; batch += batchSize) {
        const batchIds = ids.slice(batch, batch + batchSize);
        const fetchOne = async (id: number) => {
          try {
            const url = `${EXTERNAL_API_BASE}/api/pos-multi-receipt-print?receiptId=${id}`;
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data) && data.length > 0) {
                const item = data[0];
                if (
                  item.cashierName && item.cashierName.toLowerCase() === cashierName.toLowerCase()
                ) {
                  return data.map((d: any) => ({ ...d, _receiptId: id }));
                }
              }
            }
          } catch {}
          return null;
        };

        const results = await Promise.all(batchIds.map(fetchOne));
        for (const r of results) {
          if (r) allMatching.push(...r);
        }

        if (allMatching.length >= 50) break;
      }

      console.log(`[by-cashier] Found ${allMatching.length} matching receipts`);
      res.json(allMatching);
    } catch (e: any) {
      res.status(502).json({ message: "Scan failed", detail: e.message });
    }
  });

  app.get("/api/proxy/pos-multi-receipt-print/search", async (req, res) => {
    try {
      const receiptNo = (req.query.receiptNo as string) || '';
      const cashierName = (req.query.cashierName as string) || '';
      const accountNumber = (req.query.accountNumber as string) || '';
      const scanCount = Math.min(parseInt(req.query.scanCount as string) || 200, 500);

      let highestKnownId = 0;
      try {
        const probeIds = [1041500, 1041450, 1041400, 1041350, 1041300, 1041280];
        for (const probeId of probeIds) {
          const url = `${EXTERNAL_API_BASE}/api/pos-multi-receipt-print?receiptId=${probeId}`;
          const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
              highestKnownId = probeId;
              break;
            }
          }
        }
        if (!highestKnownId) {
          let probeId = 1041300;
          while (probeId > 1041200) {
            const url = `${EXTERNAL_API_BASE}/api/pos-multi-receipt-print?receiptId=${probeId}`;
            const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (resp.ok) {
              const data = await resp.json();
              if (Array.isArray(data) && data.length > 0) {
                highestKnownId = probeId;
                break;
              }
            }
            probeId -= 5;
          }
        }
      } catch {}
      if (!highestKnownId) highestKnownId = 1041280;

      const scanStartId = highestKnownId + 30;
      console.log(`[receipt-search] Scanning from ${scanStartId} backwards, count=${scanCount}, receiptNo=${receiptNo}, cashier=${cashierName}, account=${accountNumber}`);

      const ids: number[] = [];
      for (let i = 0; i < scanCount; i++) {
        ids.push(scanStartId - i);
      }

      const batchSize = 25;
      const allMatching: any[] = [];

      for (let batch = 0; batch < ids.length; batch += batchSize) {
        const batchIds = ids.slice(batch, batch + batchSize);
        const fetchOne = async (id: number) => {
          try {
            const url = `${EXTERNAL_API_BASE}/api/pos-multi-receipt-print?receiptId=${id}`;
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data) && data.length > 0) {
                const item = data[0];
                let matches = true;
                if (receiptNo && item.receiptNo) {
                  matches = matches && item.receiptNo.toLowerCase().includes(receiptNo.toLowerCase());
                } else if (receiptNo) {
                  matches = false;
                }
                if (cashierName && item.cashierName) {
                  matches = matches && item.cashierName.toLowerCase().includes(cashierName.toLowerCase());
                } else if (cashierName) {
                  matches = false;
                }
                if (accountNumber) {
                  const hasAccount = data.some((d: any) =>
                    d.accountNo && d.accountNo.toLowerCase().includes(accountNumber.toLowerCase())
                  );
                  matches = matches && hasAccount;
                }
                if (matches) {
                  return data.map((d: any) => ({ ...d, _receiptId: id }));
                }
              }
            }
          } catch {}
          return null;
        };

        const results = await Promise.all(batchIds.map(fetchOne));
        for (const r of results) {
          if (r) allMatching.push(...r);
        }

        if (allMatching.length >= 100) break;
      }

      console.log(`[receipt-search] Found ${allMatching.length} matching receipts`);
      res.json(allMatching);
    } catch (e: any) {
      res.status(502).json({ message: "Receipt search failed", detail: e.message });
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


  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { platinumGet, platinumPost, platinumPut, platinumDelete, loginWithCredentials, logoutSession, isSessionAuthenticated, refreshSessionToken, getSessionPosCashierId, getPlatinumApiUrl, getPlatinumDbName, createEmptySession, type UserSession } from "./platinum-auth";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import type { Request } from "express";

function getSession(req: Request): UserSession {
  if (!req.session.platinumAuth) {
    req.session.platinumAuth = createEmptySession();
  }
  return req.session.platinumAuth;
}

function requireAuth(req: Request, res: any): UserSession | null {
  const session = getSession(req);
  if (!isSessionAuthenticated(session)) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  return session;
}

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

function stripHtml(text: string): string {
  if (!text) return text;
  if (/<[^>]+>/.test(text)) {
    const cleaned = text
      .replace(/<title[^>]*>(.*?)<\/title>/gi, '$1 — ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.substring(0, 300) || 'Server returned an HTML error page';
  }
  return text.substring(0, 500);
}

function handlePlatinumResult(res: any, data: any) {
  if (data && data._error) {
    return res.status(data.status || 502).json({ message: data.statusText || "Platinum API error", detail: stripHtml(data.detail) || null });
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
        req.session.platinumAuth = result.session!;
        res.json({ success: true, user: result.session!.userData });
      } else {
        res.status(401).json({ success: false, error: result.error });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const session = getSession(req);
    logoutSession(session);
    req.session.destroy(() => {});
    res.json({ success: true });
  });

  app.get("/api/auth/status", async (req, res) => {
    const session = getSession(req);
    const authenticated = isSessionAuthenticated(session);
    if (authenticated) {
      res.json({ authenticated: true, user: session.userData });
    } else {
      res.json({ authenticated: false });
    }
  });

  // =====================================================
  // PLATINUM AUTH / USER INFO
  // =====================================================

  app.get("/api/platinum/auth/user-info", async (req, res) => {
    try {
      const session = getSession(req);
      const userData = session.userData;
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
        authMode: session.authMode,
      });
    } catch (e: any) {
      res.status(502).json({ message: "Failed to get Platinum user info", detail: e.message });
    }
  });

  app.post("/api/platinum/auth/ensure-cashier", async (req, res) => {
    try {
      const session = requireAuth(req, res);
      if (!session) return;
      const userData = session.userData;
      if (!userData) {
        return res.status(503).json({ success: false, message: "Platinum user data not available" });
      }

      const userId = userData.user_ID;

      const activeCashierId = await platinumGet(session, "/api/billing/auth-day-end-reconcile/active-cashierid-by-userid", { userid: String(userId) });
      
      if (activeCashierId && activeCashierId !== 0 && !activeCashierId._error) {
        const details = await platinumGet(session, `/api/ReceiptPrepaid/cashier-detailsById`, { cashierId: String(activeCashierId) });
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
      const session = requireAuth(req, res);
      if (!session) return;
      const userId = req.query.userid as string;
      const finYear = (req.query.finYear as string) || '2025/2026';
      if (!userId) {
        return res.status(400).json({ message: "userid is required" });
      }

      console.log(`[active-cashier] Using validate-cashier API as single source of truth — userId=${userId}, finYear=${finYear}`);
      const vcData = await platinumGet(session, "/api/ReceiptPrepaid/validate-cashier", { userId, finYear });

      if (!vcData || vcData._error) {
        console.error(`[active-cashier] validate-cashier API failed or returned error:`, vcData?._error || 'no data');
        return res.json({ active: false, cashierId: null, cashierRegistered: false, isActive: false });
      }

      const cashier = vcData.cashier || null;
      const cashOffice = vcData.cashOffice || null;
      const receiptRange = vcData.receiptRange || vcData.receiptRangeAvailable || null;

      const hasReceiptRangeData = receiptRange != null && (receiptRange.user_Id > 0 || receiptRange.isEnabled === true);
      const isCashierRegistered = (cashier != null && (cashier.id > 0 || cashier.user_Id > 0)) || hasReceiptRangeData;
      const isSessionActive = cashier?.isActive === true;
      const cashierId = cashier?.id || cashier?.user_Id || (hasReceiptRangeData ? Number(userId) : null);
      const activeOfficeId = cashOffice?.cashOffice_ID || cashier?.officeId || null;
      const activeOfficeName = cashOffice?.cashOfficeDesc || null;
      const cashFloat = cashier?.cashFloat ?? 0;
      const cashOnHandLimit = cashOffice?.cashOnHandLimit || 999999;

      console.log(`[active-cashier] validate-cashier result — registered: ${isCashierRegistered}, isActive: ${isSessionActive} (POS_Cashier.IsActive=${cashier?.isActive}), cashierId: ${cashierId}, officeId: ${activeOfficeId}, officeName: ${activeOfficeName}`);

      const cashierDetails = cashier ? {
        ...cashier,
        const_CashOffice: cashOffice,
      } : null;

      res.json({
        active: isSessionActive,
        cashierId: isCashierRegistered ? cashierId : null,
        cashierRegistered: isCashierRegistered,
        cashFloat,
        officeId: activeOfficeId,
        officeName: activeOfficeName,
        cashOnHandLimit,
        isActive: isSessionActive,
        hasReceiptRange: receiptRange != null && receiptRange.isEnabled === true,
        details: cashierDetails,
      });
    } catch (e: any) {
      console.error(`[active-cashier] validate-cashier call failed:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // =====================================================
  // PLATINUM API PROXY ROUTES (authenticated)
  // =====================================================

  // --- ReceiptPrepaid endpoints ---

  app.get("/api/platinum/receipt-prepaid/validate-cashier", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/validate-cashier", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // === RECEIPT RANGE VALIDATION ===
  // Uses billing-payment/payment-options to verify cashier has valid setup with receipt range allocated
  app.get("/api/platinum/receipt-prepaid/validate-receipt-range", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const userId = req.query.userId as string;
      const cashierId = req.query.cashierId as string;
      const finYear = req.query.finYear as string;
      const requestedOfficeId = req.query.officeId as string;

      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      if (!cashierId || !requestedOfficeId) {
        return res.status(400).json({ message: "cashierId and officeId are required for receipt range validation" });
      }

      console.log(`[validate-receipt-range] Using billing-payment/payment-options — userId=${userId}, cashierId=${cashierId}, officeId=${requestedOfficeId}`);

      const paymentOptionsResult = await platinumGet(session, "/api/billing-payment/payment-options", {
        userId,
        cashofficeId: requestedOfficeId,
        cashierId
      });

      if (!paymentOptionsResult || paymentOptionsResult._error) {
        console.warn(`[validate-receipt-range] billing-payment/payment-options failed:`, JSON.stringify(paymentOptionsResult).substring(0, 500));
        return res.json({
          valid: false,
          reason: "Unable to verify receipt range. Payment options API returned an error.",
          isActive: false,
          cashierDetailsId: Number(cashierId) || 0,
          officeId: requestedOfficeId,
          officeName: null
        });
      }

      console.log(`[validate-receipt-range] RAW payment-options response:`, JSON.stringify(paymentOptionsResult).substring(0, 1000));

      let options: any[] = [];
      if (Array.isArray(paymentOptionsResult)) {
        options = paymentOptionsResult;
      } else if (paymentOptionsResult.paymentOptions && Array.isArray(paymentOptionsResult.paymentOptions)) {
        options = paymentOptionsResult.paymentOptions;
      } else if (paymentOptionsResult.data?.paymentOptions && Array.isArray(paymentOptionsResult.data.paymentOptions)) {
        options = paymentOptionsResult.data.paymentOptions;
      } else if (paymentOptionsResult.data && Array.isArray(paymentOptionsResult.data)) {
        options = paymentOptionsResult.data;
      } else if (paymentOptionsResult.value && Array.isArray(paymentOptionsResult.value)) {
        options = paymentOptionsResult.value;
      }

      console.log(`[validate-receipt-range] payment-options returned ${options.length} options for cashier ${cashierId} at office ${requestedOfficeId}`);

      if (options.length > 0) {
        console.log(`[validate-receipt-range] Receipt range valid — cashier ${cashierId} has ${options.length} payment options configured at office ${requestedOfficeId}`);
        return res.json({
          valid: true,
          isActive: true,
          cashierDetailsId: Number(cashierId) || 0,
          officeId: requestedOfficeId,
          officeName: null,
          reason: "Cashier is properly set up with receipt allocation"
        });
      }

      console.warn(`[validate-receipt-range] No payment options found for cashier ${cashierId} — receipt range may not be allocated`);
      return res.json({
        valid: false,
        reason: "No payment options configured for this cashier. Receipt range may not be allocated. Please contact your administrator.",
        isActive: false,
        cashierDetailsId: Number(cashierId) || 0,
        officeId: requestedOfficeId,
        officeName: null
      });
    } catch (e: any) {
      console.error(`[validate-receipt-range] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/cons-accounts", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/cons-accounts", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/cons-account-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/cons-account-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/prepaid-account-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/prepaid-account-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/cashier-details-by-id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/cashier-detailsById", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/active-cashier-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/active-cashier-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/active-cash-office-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/active-cashOffice-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/pos-payment-type", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-payment-clearance/pos-payment-type", req.query as Record<string, string>);
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
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/is-billing");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/search-property-rates-payment", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/search-property-rates-payment", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/validate-cashier-day-end-recon", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/ValidateCashierDayEndRecon", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/get-billing-runs", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/GetBillingRuns");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/service-type-wise-prepaid-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/ServiceTypeWisePrepaidList", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/active-fin-year", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/UserPermission/ActiveFinYear", {});
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-prepaid/cash-offices", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      let query = req.query as Record<string, string>;

      if (!query.finYear) {
        const finYearData = await platinumGet(session, "/api/UserPermission/ActiveFinYear", {});
        if (finYearData && !finYearData._error) {
          const finYear = typeof finYearData === 'string' ? finYearData.replace(/"/g, '') : String(finYearData);
          query = { ...query, finYear };
        }
      }

      console.log(`[cash-offices] Calling Platinum cash-offices with finYear=${query.finYear}`);
      const primaryData = await platinumGet(session, "/api/ReceiptPrepaid/cash-offices", query);

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
              const office = await platinumGet(session, "/api/ReceiptPrepaid/active-cashOffice-details", { cashierId: String(id) });
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
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/cheque-amendList", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/receipt-prepaid/utilipay-breakdown-request", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/ReceiptPrepaid/UtiliPayBreakdownRequest", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/receipt-prepaid/utilipay-token-request", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/ReceiptPrepaid/UtiliPayTokenRequest", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/receipt-prepaid/submit-prepaid-payment", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/ReceiptPrepaid/SubmitPrepaidPayment", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/receipt-prepaid/submit-cashier-setup", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const body = { ...req.body };
      body.isActive = true;
      body.isVirtual = null;
      const userId = body.user_Id;

      if (!userId) {
        return res.status(400).json({ message: "user_Id is required" });
      }

      const userDetail = await platinumGet(session, `/api/User/${userId}`);
      if (!userDetail || userDetail._error || !userDetail.enabled) {
        return res.status(400).json({
          message: "User not valid",
          detail: `User ${userId} is not found or not enabled in Platinum.`,
        });
      }

      console.log(`[submit-cashier-setup] Submitting for user ${userDetail.firstName} ${userDetail.lastName} (ID: ${userId}), office: ${body.officeId}`);
      console.log(`[submit-cashier-setup] Payload:`, JSON.stringify(body));
      const data = await platinumPost(session, "/api/ReceiptPrepaid/submit-cashier-setup", body);
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
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/User/${req.params.id}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/platinum/user/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPut(session, `/api/User/${req.params.id}`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Payment endpoints ---

  app.post("/api/platinum/billing-payment/submit-consumer-payment/:userId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const userId = req.params.userId;
      const body = req.body;
      const acct = body?.account || {};
      const rm = body?.requestModel || {};

      if (acct.billId === 0) acct.billId = null;
      if (rm.apiTransactionID === undefined) rm.apiTransactionID = 0;
      if (rm.isReconciled === undefined || rm.isReconciled === null) rm.isReconciled = 0;
      if (rm.isCancelled === undefined || rm.isCancelled === null) rm.isCancelled = 0;

      console.log(`[submit-consumer-payment] userId=${userId}`);
      console.log(`[submit-consumer-payment] account: account_ID=${acct.account_ID}, accountNumber=${acct.accountNumber}, name=${acct.name}, outStandingAmt=${acct.outStandingAmt}, billId=${acct.billId}, cutOffID=${acct.cutOffID}, cutOffAmount=${acct.cutOffAmount}, debtAmount=${acct.debtAmount}, debtArrangementId=${acct.debtArrangementId}, sundryDebtorsId=${acct.sundryDebtorsId}, billingCycleId=${acct.billingCycleId}`);
      console.log(`[submit-consumer-payment] requestModel: finYear=${rm.finYear}, receiptDate=${rm.receiptDate}, totalAmount=${rm.totalAmount}, tenderAmount=${rm.tenderAmount}, changeAmount=${rm.changeAmount}, paymentType=${rm.paymentType}, paymentOption=${rm.paymentOption}, outStandingAmount=${rm.outStandingAmount}, cutOffID=${rm.cutOffID}, cutOffAmount=${rm.cutOffAmount}, debtAmount=${rm.debtAmount}, debtArrangementId=${rm.debtArrangementId}, sundryDebtorsId=${rm.sundryDebtorsId}, cardNumber=${rm.cardNumber ? '***' : '(empty)'}, apiTransactionID=${rm.apiTransactionID}, isReconciled=${rm.isReconciled}, isCancelled=${rm.isCancelled}`);
      console.log(`[submit-consumer-payment] full payload:`, JSON.stringify(body, null, 2));
      const data = await platinumPost(session, `/api/billing-payment/submit-consumer-payment/${userId}`, body);
      console.log(`[submit-consumer-payment] response:`, JSON.stringify(data));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[submit-consumer-payment] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/submit-multiple-payment/:userId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const userId = req.params.userId;
      const body = req.body;
      const accounts = Array.isArray(body?.accounts) ? body.accounts : [];
      const rm = body?.requestModel || {};

      if (rm.apiTransactionID === undefined) rm.apiTransactionID = 0;
      if (rm.isReconciled === undefined || rm.isReconciled === null) rm.isReconciled = 0;
      if (rm.isCancelled === undefined || rm.isCancelled === null) rm.isCancelled = 0;

      for (const acct of accounts) {
        if (acct.billId === 0) acct.billId = null;
      }

      console.log(`[submit-multiple-payment] userId=${userId}, ${accounts.length} account(s)`);
      for (const acct of accounts) {
        console.log(`[submit-multiple-payment] account: account_ID=${acct.account_ID}, accountNumber=${acct.accountNumber}, name=${acct.name}, outStandingAmt=${acct.outStandingAmt}, billId=${acct.billId}`);
      }
      console.log(`[submit-multiple-payment] requestModel: finYear=${rm.finYear}, receiptDate=${rm.receiptDate}, totalAmount=${rm.totalAmount}, tenderAmount=${rm.tenderAmount}, changeAmount=${rm.changeAmount}, paymentType=${rm.paymentType}, paymentOption=${rm.paymentOption}, outStandingAmount=${rm.outStandingAmount}, cardNumber=${rm.cardNumber ? '***' : '(empty)'}`);
      console.log(`[submit-multiple-payment] full payload:`, JSON.stringify(body, null, 2).substring(0, 3000));
      const data = await platinumPost(session, `/api/billing-payment/submit-multiple-payment/${userId}`, body);
      console.log(`[submit-multiple-payment] response:`, JSON.stringify(data).substring(0, 2000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[submit-multiple-payment] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/save-multiple-account-payment", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const accounts = Array.isArray(req.body) ? req.body : [];
      for (const acct of accounts) {
        console.log(`[save-multiple-account-payment] account_ID=${acct.account_ID}, outStandingAmt=${acct.outStandingAmt}, name=${acct.name}`);
      }
      const data = await platinumPost(session, "/api/billing-payment/save-multiple-account-payment", req.body, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment/get-multiple-account-payment", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[get-multiple-account-payment] query:`, req.query);
      const data = await platinumGet(session, "/api/billing-payment/get-multiple-account-payment", req.query as Record<string, string>);
      console.log(`[get-multiple-account-payment] response:`, JSON.stringify(data));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });


  app.post("/api/platinum/billing-payment/search-accounts", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing-payment/search-accounts", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/print-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const receiptIds = req.body;
      if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
        return res.status(400).json({ message: "Request body must be an array of receipt serial numbers" });
      }

      const token = await refreshSessionToken(session);
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
      const session = requireAuth(req, res); if (!session) return;
      const receiptId = req.query.receiptId as string;
      if (!receiptId) {
        return res.status(400).json({ message: "receiptId is required" });
      }

      const token = await refreshSessionToken(session);
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
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[view-receipt/get-cashiers] Calling cashier-list (POS cashiers only)`);
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile/cashier-list");

      if (data && !data._error && Array.isArray(data) && data.length > 0) {
        const normalized = data.map((c: any) => ({
          id: c.id ?? c.userId ?? c.cashierId ?? 0,
          name: c.name ?? c.cashierName ?? c.userName ?? c.fullName ?? `Cashier ${c.id || ''}`,
          cashierId: c.cashierId ?? c.id ?? c.userId ?? 0,
        }));
        console.log(`[view-receipt/get-cashiers] Returning ${normalized.length} POS cashiers from cashier-list`);
        return res.json(normalized);
      }

      console.warn(`[view-receipt/get-cashiers] cashier-list returned no data, falling back to ViewReceipt/get-cashiers`);
      const fallbackData = await platinumGet(session, "/api/ViewReceipt/get-cashiers");
      if (fallbackData && !fallbackData._error) {
        let cashiers: any[] = [];
        if (Array.isArray(fallbackData)) {
          cashiers = fallbackData;
        } else if (fallbackData.data && Array.isArray(fallbackData.data)) {
          cashiers = fallbackData.data;
        } else if (fallbackData.value && Array.isArray(fallbackData.value)) {
          cashiers = fallbackData.value;
        }

        const normalized = cashiers.map((c: any) => ({
          id: c.id ?? c.userId ?? c.cashierId ?? 0,
          name: c.name ?? c.cashierName ?? c.userName ?? c.fullName ?? `Cashier ${c.id || ''}`,
          cashierId: c.cashierId ?? c.id ?? c.userId ?? 0,
        }));
        console.log(`[view-receipt/get-cashiers] Returning ${normalized.length} cashiers from ViewReceipt fallback`);
        return res.json(normalized);
      }

      res.json([]);
    } catch (e: any) {
      console.error(`[view-receipt/get-cashiers] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/view-receipt/search-account-numbers", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ViewReceipt/search-account-numbers", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/view-receipt/search-receipt-numbers", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/ViewReceipt/search-recept-numbers", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/view-receipt/get-receipt-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const body = req.body;
      const params: Record<string, string> = {};
      if (body.fromDate || body.FromDate) params.FromDate = body.fromDate || body.FromDate;
      if (body.toDate || body.ToDate) params.ToDate = body.toDate || body.ToDate;
      params.Page = String(body.page ?? body.Page ?? 1);
      params.PageSize = String(body.pageSize ?? body.PageSize ?? 50);
      if (body.orderby || body.Orderby) params.Orderby = body.orderby || body.Orderby;
      if (body.shortDirection || body.ShortDirection) params.ShortDirection = body.shortDirection || body.ShortDirection;
      const cashierVal = body.cashierId ?? body.CashierId ?? '';
      if (cashierVal !== '' && cashierVal !== undefined && cashierVal !== null) {
        params.Cashier = String(cashierVal);
        params.CashierId = String(cashierVal);
      }
      if (body.userId || body.UserId) {
        params.UserId = String(body.userId || body.UserId);
      }
      if (body.accountNumber || body.AccountNumber) params.AccountNumber = body.accountNumber || body.AccountNumber;
      if (body.receiptNo || body.ReceiptNo) params.ReceiptNo = body.receiptNo || body.ReceiptNo;

      const userId = session.userData?.user_ID ? String(session.userData.user_ID) : '';
      const cashierName = session.userData ? `${session.userData.firstName || ''} ${session.userData.lastName || ''}`.trim() : '';
      const isAllCashiers = String(cashierVal) === '0';
      console.log(`[get-receipt-list] Request params (GET):`, JSON.stringify(params), `userId=${userId}, cashierName=${cashierName}, isAllCashiers=${isAllCashiers}`);

      let data: any;

      // Strategy 1: Direct GET with params as provided (Cashier=0 for all, or Cashier=id for specific)
      console.log(`[get-receipt-list] Strategy 1: GET with Cashier=${params.Cashier}`);
      data = await platinumGet(session, "/api/ViewReceipt/get-receipt-list", params, { timeoutMs: 90000 });
      console.log(`[get-receipt-list] Strategy 1 result: type=${typeof data}, isArray=${Array.isArray(data)}, keys=${data && typeof data === 'object' ? Object.keys(data).join(',') : 'N/A'}, first500=${JSON.stringify(data).substring(0, 500)}`);

      // Strategy 2: If failed and a specific cashier was selected, try GET with Cashier=cashierName
      if ((!data || (data && typeof data === 'object' && data._error)) && !isAllCashiers && cashierName) {
        const nameParams: Record<string, string> = { ...params, Cashier: cashierName };
        delete nameParams.CashierId;
        console.log(`[get-receipt-list] Strategy 2: GET with Cashier="${cashierName}"`);
        data = await platinumGet(session, "/api/ViewReceipt/get-receipt-list", nameParams, { timeoutMs: 90000 });
        console.log(`[get-receipt-list] Strategy 2 result: type=${typeof data}, isArray=${Array.isArray(data)}, keys=${data && typeof data === 'object' ? Object.keys(data).join(',') : 'N/A'}, first500=${JSON.stringify(data).substring(0, 500)}`);
      }

      // Strategy 3: POST with the same params
      if (data && typeof data === 'object' && data._error) {
        console.log(`[get-receipt-list] Strategy 3: POST with Cashier=${params.Cashier}`);
        const postBody: Record<string, any> = {
          Cashier: isAllCashiers ? 0 : (cashierName || params.Cashier),
          FromDate: params.FromDate,
          ToDate: params.ToDate,
          Page: Number(params.Page),
          PageSize: Number(params.PageSize),
          Orderby: params.Orderby,
          ShortDirection: params.ShortDirection,
        };
        if (params.AccountNumber) postBody.AccountNumber = params.AccountNumber;
        if (params.ReceiptNo) postBody.ReceiptNo = params.ReceiptNo;
        data = await platinumPost(session, "/api/ViewReceipt/get-receipt-list", postBody);
        console.log(`[get-receipt-list] Strategy 3 result: type=${typeof data}, isArray=${Array.isArray(data)}, keys=${data && typeof data === 'object' ? Object.keys(data).join(',') : 'N/A'}, first500=${JSON.stringify(data).substring(0, 500)}`);
      }

      if (data && typeof data === 'object' && '_error' in data) {
        console.log(`[get-receipt-list] All strategies exhausted. Final response:`, JSON.stringify(data).substring(0, 500));
      }

      if (data && typeof data === 'object' && data._error) {
        console.error(`[get-receipt-list] API error: ${data.status} ${data.statusText}`);
        return res.status(data.status || 502).json({ message: data.statusText || "API error", detail: data.detail || '' });
      }

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const items = data.items || data.value || data.results || data.data || [];
        const totalCount = data.totalCount ?? data.totalRecords ?? data.total ?? items.length;
        console.log(`[get-receipt-list] Returning ${Array.isArray(items) ? items.length : 0} items, totalCount: ${totalCount}`);
        res.json({ items: Array.isArray(items) ? items : [], totalCount });
      } else if (Array.isArray(data)) {
        console.log(`[get-receipt-list] Returning array of ${data.length} items`);
        res.json({ items: data, totalCount: data.length });
      } else {
        console.log(`[get-receipt-list] No data returned, sending empty result`);
        res.json({ items: [], totalCount: 0 });
      }
    } catch (e: any) {
      console.error(`[get-receipt-list] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-discovery", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const cashierId = req.query.cashierId as string;
      const userId = session.userData?.user_ID ? String(session.userData.user_ID) : '';
      const finYear = session.userData?.finYear || '2025/2026';
      console.log(`[receipt-discovery] Starting — cashierId=${cashierId}, userId=${userId}`);

      const allReceipts: any[] = [];

      // Helper to extract items from various response shapes
      const extractItems = (data: any): any[] => {
        if (!data || (data && typeof data === 'object' && data._error)) return [];
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') return data.items || data.value || data.data || data.results || [];
        return [];
      };

      // Step 1: Get receipt range from validate-cashier to know which receipt numbers exist
      let receiptStart = 0, receiptCurrent = 0;
      try {
        const validateData = await platinumGet(session, "/api/ReceiptPrepaid/validate-cashier", { userId, finYear });
        receiptStart = validateData?.receiptRange?.startRange || validateData?.receiptRangeAvailable?.startRange || 0;
        receiptCurrent = validateData?.receiptRange?.currentRange || validateData?.receiptRangeAvailable?.currentRange || 0;
        console.log(`[receipt-discovery] Receipt range: ${receiptStart} to ${receiptCurrent} (${receiptCurrent - receiptStart} used)`);
      } catch (e: any) { console.warn(`[receipt-discovery] validate-cashier failed:`, e.message); }

      // Step 2: Try many different Platinum API endpoints to find receipt data
      const probeResults: { endpoint: string; status: string; count: number; sample: string }[] = [];

      const tryEndpoint = async (label: string, method: 'GET' | 'POST', path: string, queryOrBody: any, queryParams?: Record<string, string>) => {
        try {
          let data: any;
          if (method === 'GET') {
            data = await platinumGet(session, path, queryOrBody as Record<string, string>);
          } else {
            data = await platinumPost(session, path, queryOrBody, queryParams);
          }
          const items = extractItems(data);
          const raw = JSON.stringify(data).substring(0, 400);
          probeResults.push({ endpoint: `${method} ${path}`, status: items.length > 0 ? 'DATA' : (data?._error ? `ERROR ${data.status}` : 'EMPTY'), count: items.length, sample: raw });
          console.log(`[receipt-discovery] ${label}: ${items.length > 0 ? items.length + ' items' : (data?._error ? 'ERROR ' + data.status : 'empty')} — ${raw.substring(0, 200)}`);
          return items;
        } catch (e: any) {
          probeResults.push({ endpoint: `${method} ${path}`, status: `EXCEPTION: ${e.message}`, count: 0, sample: '' });
          console.warn(`[receipt-discovery] ${label} failed:`, e.message);
          return [];
        }
      };

      const pager = { page: 1, pageSize: 500, orderby: "dateCaptured", shortDirection: "desc" };
      const pagerNull = { page: 1, pageSize: 500, orderby: null, shortDirection: null };

      // Probe 1: cashier-receipt-cash-list with cashierId (auth version)
      let items = await tryEndpoint('auth/cash-list(cashierId)', 'POST', '/api/billing/auth-day-end-reconcile/cashier-receipt-cash-list', pager, { id: cashierId });
      if (items.length > 0) { items.forEach((i: any) => { i._source = 'cash'; i._paymentType = 'Cash'; }); allReceipts.push(...items); }

      // Probe 2: cashier-receipt-card-list with cashierId (auth version)
      items = await tryEndpoint('auth/card-list(cashierId)', 'POST', '/api/billing/auth-day-end-reconcile/cashier-receipt-card-list', pager, { id: cashierId });
      if (items.length > 0) { items.forEach((i: any) => { i._source = 'card'; i._paymentType = 'Credit Card'; }); allReceipts.push(...items); }

      // Probe 3: system-vs-cashier-data-list
      items = await tryEndpoint('auth/system-vs-cashier(cashierId)', 'POST', '/api/billing/auth-day-end-reconcile/system-vs-cashier-data-list', pager, { id: cashierId });
      if (items.length > 0) { items.forEach((i: any) => { i._source = 'system'; }); allReceipts.push(...items); }

      // Probe 4: cashier-reconcile-by-cashierid — might list receipts from the reconcile record
      items = await tryEndpoint('auth/reconcile-by-cashierid', 'GET', '/api/billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid', { cashierId });
      if (items.length > 0) { items.forEach((i: any) => { i._source = 'reconcile-detail'; }); allReceipts.push(...items); }

      // Probe 5: cashier-details — might include receipt list
      items = await tryEndpoint('auth/cashier-details', 'GET', '/api/billing/auth-day-end-reconcile/cashier-details', { id: cashierId });
      if (items.length > 0) { items.forEach((i: any) => { i._source = 'cashier-details'; }); allReceipts.push(...items); }

      // Probe 6: ReceiptPrepaid endpoints — the controller that handles POS cashier setup
      items = await tryEndpoint('ReceiptPrepaid/get-cashier-receipts', 'GET', '/api/ReceiptPrepaid/get-cashier-receipts', { cashierId, userId });
      if (items.length > 0) { items.forEach((i: any) => { i._source = 'prepaid-receipts'; }); allReceipts.push(...items); }

      items = await tryEndpoint('ReceiptPrepaid/cashier-receipt-list', 'GET', '/api/ReceiptPrepaid/cashier-receipt-list', { cashierId, userId });
      if (items.length > 0) { items.forEach((i: any) => { i._source = 'prepaid-list'; }); allReceipts.push(...items); }

      // Probe 7: billing-payment endpoints for receipt lookup
      items = await tryEndpoint('billing-payment/get-cashier-receipts', 'GET', '/api/billing-payment/get-cashier-receipts', { cashierId, userId });
      if (items.length > 0) { items.forEach((i: any) => { i._source = 'bp-receipts'; }); allReceipts.push(...items); }

      items = await tryEndpoint('billing-payment/pos-cashier-receipt', 'GET', '/api/billing-payment/pos-cashier-receipt', { cashierId, userId });
      if (items.length > 0) { items.forEach((i: any) => { i._source = 'bp-pos-receipt'; }); allReceipts.push(...items); }

      // Probe 8: Try pos-multi-receipt-print with known receipt IDs from Platinum (not Sebata)
      if (allReceipts.length === 0 && receiptCurrent > receiptStart) {
        for (let receiptNum = receiptStart; receiptNum < receiptCurrent; receiptNum++) {
          const receiptItems = await tryEndpoint(`platinum/pos-multi-receipt(${receiptNum})`, 'GET', '/api/billing-payment/pos-multi-receipt-print', { id: String(receiptNum) });
          if (receiptItems.length > 0) { receiptItems.forEach((i: any) => { i._source = 'platinum-receipt'; }); allReceipts.push(...receiptItems); }
        }
      }

      // Probe 9: search-recept-numbers with full formatted receipt numbers
      if (allReceipts.length === 0 && receiptCurrent > receiptStart) {
        const today = new Date();
        const datePrefix = `${String(today.getDate()).padStart(2,'0')}${String(today.getMonth()+1).padStart(2,'0')}${today.getFullYear()}`;
        const fullReceiptNos: string[] = [];
        for (let i = receiptStart; i < receiptCurrent; i++) {
          fullReceiptNos.push(`${datePrefix}/${i}`);
        }
        console.log(`[receipt-discovery] Trying search-recept-numbers with formatted: ${fullReceiptNos.join(', ')}`);
        items = await tryEndpoint('ViewReceipt/search-formatted', 'GET', '/api/ViewReceipt/search-recept-numbers', { receiptNumbers: fullReceiptNos.join(',') });
        if (items.length > 0) { items.forEach((i: any) => { i._source = 'search-formatted'; }); allReceipts.push(...items); }

        items = await tryEndpoint('ViewReceipt/search-plain', 'GET', '/api/ViewReceipt/search-recept-numbers', { receiptNumbers: Array.from({length: receiptCurrent - receiptStart}, (_, i) => String(receiptStart + i)).join(',') });
        if (items.length > 0) { items.forEach((i: any) => { i._source = 'search-plain'; }); allReceipts.push(...items); }
      }

      // Probe 10: billing-payment-day-end-reconcile versions with GET instead of POST
      if (allReceipts.length === 0) {
        items = await tryEndpoint('bp-day-end/reconcile-list(GET)', 'GET', '/api/billing-payment-day-end-reconcile/get-cashier-receipt-reconcile-list', { id: cashierId });
        if (items.length > 0) { items.forEach((i: any) => { i._source = 'bp-reconcile'; }); allReceipts.push(...items); }

        items = await tryEndpoint('bp-day-end/cash-list(POST)', 'POST', '/api/billing-payment-day-end-reconcile/get-cashier-receipt-cash-list', pagerNull, { id: cashierId });
        if (items.length > 0) { items.forEach((i: any) => { i._source = 'bp-cash'; i._paymentType = 'Cash'; }); allReceipts.push(...items); }
      }

      console.log(`[receipt-discovery] Total receipts found: ${allReceipts.length}`);
      console.log(`[receipt-discovery] Probe results:\n${probeResults.map(p => `  ${p.endpoint} → ${p.status} (${p.count}) ${p.sample.substring(0, 100)}`).join('\n')}`);
      res.json({ items: allReceipts, totalCount: allReceipts.length, probeResults });
    } catch (e: any) {
      console.error(`[receipt-discovery] Error:`, e.message);
      res.status(502).json({ message: "Receipt discovery failed", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/print-miscellaneous-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing-payment/print-miscellaneous-receipt", req.body, req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Payment Clearance endpoints ---

  app.get("/api/platinum/billing-payment-clearance/get-clearanceids", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-payment-clearance/get-clearanceids", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-clearance/pos-payment-type", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-payment-clearance/pos-payment-type");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // === CASHIER PAYMENT OPTIONS (per-cashier allowed functions) ===
  // GET /api/billing-payment/payment-options?userId={userId}&cashofficeId={cashofficeId}&cashierId={cashierId}
  app.get("/api/platinum/receipt-prepaid/cashier-payment-options", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const userId = req.query.userId as string;
      const cashofficeId = req.query.cashofficeId as string;
      const cashierId = req.query.cashierId as string;
      const officeOnly = req.query.officeOnly as string;

      if (!userId || !cashofficeId || !cashierId) {
        return res.status(400).json({ message: "userId, cashofficeId, and cashierId are all required" });
      }

      const effectiveCashierId = officeOnly === 'true' ? '0' : cashierId;
      console.log(`[cashier-payment-options] Calling Platinum billing-payment/payment-options — userId=${userId}, cashofficeId=${cashofficeId}, cashierId=${effectiveCashierId}, officeOnly=${officeOnly}`);
      const data = await platinumGet(session, "/api/billing-payment/payment-options", { userId, cashofficeId, cashierId: effectiveCashierId });

      if (data && !data._error) {
        console.log(`[cashier-payment-options] RAW Platinum response:`, JSON.stringify(data).substring(0, 2000));
        if (Array.isArray(data) && data.length > 0) {
          console.log(`[cashier-payment-options] FIRST ITEM ALL KEYS:`, JSON.stringify(Object.keys(data[0])));
          console.log(`[cashier-payment-options] FIRST ITEM FULL:`, JSON.stringify(data[0]));
        }

        let options: any[] = [];
        if (Array.isArray(data)) {
          options = data;
        } else if (data.paymentOptions && Array.isArray(data.paymentOptions)) {
          options = data.paymentOptions;
        } else if (data.data && Array.isArray(data.data)) {
          options = data.data;
        } else if (data.data?.paymentOptions && Array.isArray(data.data.paymentOptions)) {
          options = data.data.paymentOptions;
        } else if (data.value && Array.isArray(data.value)) {
          options = data.value;
        }

        const normalized = options.map((opt: any) => {
          const tickedFlag = opt.tickedFlag ?? opt.isTicked ?? opt.IsTicked;
          const isTicked = tickedFlag === true || tickedFlag === "True" || tickedFlag === "true" || tickedFlag === 1 || tickedFlag === "1";
          return {
            posPaymentOption_ID: opt.posPaymentOption_ID ?? opt.posPaymentOptionId ?? opt.posPaymentOptionID ?? opt.id ?? opt.Id ?? 0,
            posPaymentOptionDesc: opt.posPaymentOptionDesc ?? opt.description ?? opt.Description ?? '',
            isTicked,
            enabled: opt.enabled ?? opt.Enabled ?? isTicked ?? true,
          };
        });

        const anyEnabled = normalized.some((opt: any) => opt.isTicked);
        if (!anyEnabled && normalized.length > 0) {
          console.warn(`[cashier-payment-options] All ${normalized.length} payment options returned tickedFlag=False from Platinum API. Returning as-is from API.`);
        }

        console.log(`[cashier-payment-options] Returning ${normalized.length} options from Platinum API (anyEnabled=${anyEnabled}, officeOnly=${officeOnly})`);
        return res.json({ source: officeOnly === 'true' ? "office" : "platinum", data: normalized });
      }

      console.error(`[cashier-payment-options] Platinum API returned error or empty. Response:`, JSON.stringify(data).substring(0, 500));
      res.status(502).json({ message: "Platinum API returned no payment options data", detail: JSON.stringify(data).substring(0, 200) });
    } catch (e: any) {
      console.error(`[cashier-payment-options] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // === CASHIER PAYMENT TYPES (per-cashier allowed tender methods) ===
  // GET /api/billing-payment/payment-types?userId={userId}&cashofficeId={cashofficeId}&cashierId={cashierId}
  app.get("/api/platinum/receipt-prepaid/cashier-payment-types", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const userId = req.query.userId as string;
      const cashofficeId = req.query.cashofficeId as string;
      const cashierId = req.query.cashierId as string;
      const officeOnly = req.query.officeOnly as string;

      if (!userId || !cashofficeId || !cashierId) {
        return res.status(400).json({ message: "userId, cashofficeId, and cashierId are all required" });
      }

      const effectiveCashierId = officeOnly === 'true' ? '0' : cashierId;
      console.log(`[cashier-payment-types] Calling Platinum billing-payment/payment-types — userId=${userId}, cashofficeId=${cashofficeId}, cashierId=${effectiveCashierId}, officeOnly=${officeOnly}`);
      const data = await platinumGet(session, "/api/billing-payment/payment-types", { userId, cashofficeId, cashierId: effectiveCashierId });

      if (data && !data._error) {
        console.log(`[cashier-payment-types] RAW Platinum response:`, JSON.stringify(data).substring(0, 1000));

        let types: any[] = [];
        if (Array.isArray(data)) {
          types = data;
        } else if (data.paymentTypes && Array.isArray(data.paymentTypes)) {
          types = data.paymentTypes;
        } else if (data.data?.paymentTypes && Array.isArray(data.data.paymentTypes)) {
          types = data.data.paymentTypes;
        } else if (data.data && Array.isArray(data.data)) {
          types = data.data;
        } else if (data.value && Array.isArray(data.value)) {
          types = data.value;
        }

        const normalized = types.map((t: any) => {
          const tickedFlag = t.tickedFlag ?? t.isTicked ?? t.IsTicked;
          const isTicked = tickedFlag === true || tickedFlag === "True" || tickedFlag === "true" || tickedFlag === 1 || tickedFlag === "1";
          return {
            posPaymentType_ID: t.posPaymentType_ID ?? t.posPaymentTypeID ?? t.posPaymentOptionId ?? t.id ?? t.Id ?? 0,
            posPaymentTypeDesc: t.posPaymentTypeDesc ?? t.posPaymentOptionDesc ?? t.description ?? t.Description ?? '',
            isTicked,
            enabled: t.enabled ?? t.Enabled ?? isTicked ?? true,
          };
        });

        const anyEnabled = normalized.some((t: any) => t.isTicked);
        if (!anyEnabled && normalized.length > 0) {
          console.warn(`[cashier-payment-types] All ${normalized.length} payment types returned tickedFlag=False from Platinum API. Returning as-is from API.`);
        }

        console.log(`[cashier-payment-types] Returning ${normalized.length} types from Platinum API (anyEnabled=${anyEnabled}, officeOnly=${officeOnly})`);
        return res.json({ source: officeOnly === 'true' ? "office" : "platinum", data: normalized });
      }

      console.error(`[cashier-payment-types] Platinum billing-payment/payment-types returned error. Response:`, JSON.stringify(data).substring(0, 500));
      res.status(502).json({ message: "Platinum API returned no payment types data", detail: JSON.stringify(data).substring(0, 200) });
    } catch (e: any) {
      console.error(`[cashier-payment-types] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-clearance/get-banks", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-payment-clearance/get-banks");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-clearance/get-branches-by-bank", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-payment-clearance/get-brances-by-bank", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-clearance/get-clearance-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[clearance-data] Request:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-payment-clearance/get-clearance-data", req.body);
      console.log(`[clearance-data] Response:`, JSON.stringify(data).substring(0, 2000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-clearance/get-accounts-for-clearance", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[clearance-accounts] Request:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-payment-clearance/get-accounts-for-clearance", req.body);
      console.log(`[clearance-accounts] Response:`, JSON.stringify(data).substring(0, 2000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-clearance/submit-payment", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[clearance-submit] Request payload:`, JSON.stringify(req.body));

      const token = await refreshSessionToken(session);
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
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-payment-miscellaneous/get-groups");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-miscellaneous/get-scoa-items", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-payment-miscellaneous/get-scoa-items", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-miscellaneous/get-vat-rate", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-payment-miscellaneous/get-vat-rate");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-miscellaneous/submit", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing-payment-miscellaneous/submit", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Enquiry - Search ---

  app.post("/api/platinum/billing-enquiry/enquiry-results", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const sgNumber = req.body.sgNumber ? String(req.body.sgNumber).trim() : '';
      const erfNumber = req.body.erfNumber ? String(req.body.erfNumber).trim() : '';

      const unsupportedFields = ['deliveryAddress', 'trading', 'allotmentArea'];
      const cleanBody: Record<string, any> = {};
      for (const [k, v] of Object.entries(req.body)) {
        if (!unsupportedFields.includes(k) && v !== undefined && v !== null && String(v).trim() !== '') {
          cleanBody[k] = v;
        }
      }

      if (sgNumber || erfNumber) {
        console.log(`[enquiry-results] SG/ERF search — sgNumber: "${sgNumber}", erfNumber: "${erfNumber}"`);

        if (sgNumber) {
          console.log(`[enquiry-results] SG search via erfNumber autocomplete...`);
          const sgParts = sgNumber.match(/\d+/g) || [];
          const erfDigits = sgParts.length >= 3 ? sgParts[2].replace(/^0+/, '') : '';
          const searchTerms = new Set<string>();
          if (erfDigits) searchTerms.add(erfDigits);
          sgParts.forEach(p => { const d = p.replace(/^0+/, ''); if (d && d.length >= 3) searchTerms.add(d); });

          const matchedAccountIds = new Set<number>();
          for (const term of searchTerms) {
            try {
              const acResults = await platinumGet(session, "/api/BillingEnquiry/Autocomplete", { search: term, type: 'erfNumber' });
              const acArr = Array.isArray(acResults) ? acResults : [];
              for (const item of acArr) {
                if (item.displayItem === sgNumber && item.accountId) {
                  matchedAccountIds.add(item.accountId);
                }
              }
            } catch (e: any) {
              console.log(`[enquiry-results] erfNumber autocomplete for "${term}" failed: ${e.message}`);
            }
            if (matchedAccountIds.size > 0) break;
          }

          if (matchedAccountIds.size > 0) {
            console.log(`[enquiry-results] Found ${matchedAccountIds.size} account(s) with exact SG match via autocomplete: ${Array.from(matchedAccountIds).join(', ')}`);
            const lookups = await Promise.allSettled(
              Array.from(matchedAccountIds).map(id =>
                platinumPost(session, "/api/BillingEnquiry/EnquiryResults", { accountID: String(id) })
              )
            );
            const allAccounts: any[] = [];
            const seen = new Set<number>();
            for (const r of lookups) {
              if (r.status === 'fulfilled') {
                const data = r.value;
                const arr = Array.isArray(data) ? data : (data && !data._error ? [data] : []);
                for (const acct of arr) {
                  const id = acct.account_ID || acct.accountID;
                  if (id && !seen.has(id) && matchedAccountIds.has(id)) { seen.add(id); allAccounts.push(acct); }
                }
              }
            }
            console.log(`[enquiry-results] SG search returning ${allAccounts.length} unique account(s)`);
            return res.json(allAccounts);
          } else {
            console.log(`[enquiry-results] No accounts found with matching SG number`);
          }
        }

        if (erfNumber) {
          console.log(`[enquiry-results] Trying Platinum API with erfNumber...`);
          try {
            const erfResult = await platinumPost(session, "/api/BillingEnquiry/EnquiryResults", { erfNumber });
            const erfAccounts = Array.isArray(erfResult) ? erfResult : (erfResult && !erfResult._error ? [erfResult] : []);
            if (erfAccounts.length > 0) {
              console.log(`[enquiry-results] ERF search found ${erfAccounts.length} matching accounts`);
              return res.json(erfAccounts);
            }
          } catch (e: any) {
            console.log(`[enquiry-results] Platinum erfNumber search failed: ${e.message}`);
          }
        }

        const otherFields = { ...cleanBody };
        delete otherFields.sgNumber;
        delete otherFields.erfNumber;
        if (Object.keys(otherFields).length === 0) {
          return res.json([]);
        }
      }

      const searchBody = { ...cleanBody };
      delete searchBody.sgNumber;
      delete searchBody.erfNumber;
      if (Object.keys(searchBody).length === 0) {
        return res.json([]);
      }
      console.log(`[enquiry-results] Search body:`, JSON.stringify(cleanBody));
      const data = await platinumPost(session, "/api/BillingEnquiry/EnquiryResults", cleanBody);
      const count = Array.isArray(data) ? data.length : (data?._error ? 'ERROR' : '1');
      console.log(`[enquiry-results] Results: ${count}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.log(`[enquiry-results] Error: ${e.message}`);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Municipality / Institution Info ---

  app.get("/api/platinum/billing-enquiry/get-app-setting", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/GetAppSetting", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/get-config-setting", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/GetAAAA_ConfigSetting", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipt-info", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
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
            const val = await platinumGet(session, "/api/BillingEnquiry/GetAppSetting", { key });
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
              const val = await platinumGet(session, "/api/BillingEnquiry/GetAAAA_ConfigSetting", { strKeyName: key });
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

  // --- Billing Enquiry - Autocomplete ---

  app.get("/api/platinum/billing-enquiry/autocomplete", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/Autocomplete", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Enquiry - Rebuild ---

  app.get("/api/platinum/billing-enquiry/rebuild-full-account", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/rebuildFullAccount", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/get-rebuild-account-ss-check", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/getRebuildAccountSSCheck", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Day-End Reconciliation (Cashier) ---

  app.get("/api/platinum/billing-payment-day-end/get-cashier-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-payment-day-end-reconcile/get-cashier-list");
      console.log(`[dayend-cashier-list] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-day-end/get-cashier-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[dayend-cashier-details] Query:`, req.query);
      const data = await platinumGet(session, "/api/billing-payment-day-end-reconcile/get-cashier-details", req.query as Record<string, string>);
      console.log(`[dayend-cashier-details] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/get-cashier-receipt-cheque-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[dayend-cheque] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-payment-day-end-reconcile/get-cashier-receipt-cheque-list", req.body, req.query as Record<string, string>);
      console.log(`[dayend-cheque] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/get-cashier-receipt-card-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[dayend-card] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-payment-day-end-reconcile/get-cashier-receipt-card-list", req.body, req.query as Record<string, string>);
      console.log(`[dayend-card] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/get-cashier-receipt-drop-box-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[dayend-dropbox] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-payment-day-end-reconcile/get-cashier-receipt-drop-box-list", req.body, req.query as Record<string, string>);
      console.log(`[dayend-dropbox] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-day-end/get-cashier-receipt-reconcile-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const queryParams = req.query as Record<string, string>;
      const userId = queryParams.userId || (session.userData?.user_ID ? String(session.userData.user_ID) : '');
      console.log(`[dayend-reconcile-list] Query:`, queryParams, `resolved userId: ${userId}`);

      let data: any = null;

      if (userId) {
        data = await platinumGet(session, "/api/billing-payment-day-end-reconcile/get-cashier-receipt-reconcile-list", { id: userId });
        console.log(`[dayend-reconcile-list] userId=${userId}:`, JSON.stringify(data).substring(0, 500));
      }

      if (!data || (data && typeof data === 'object' && data._error)) {
        if (queryParams.id) {
          data = await platinumGet(session, "/api/billing-payment-day-end-reconcile/get-cashier-receipt-reconcile-list", { id: queryParams.id });
          console.log(`[dayend-reconcile-list] id=${queryParams.id}:`, JSON.stringify(data).substring(0, 500));
        }
      }

      if (!data || (data && typeof data === 'object' && data._error)) {
        if (queryParams.id) {
          data = await platinumGet(session, "/api/billing-payment-day-end-reconcile/get-cashier-receipt-reconcile-list", { cashierId: queryParams.id });
          console.log(`[dayend-reconcile-list] cashierId=${queryParams.id}:`, JSON.stringify(data).substring(0, 500));
        }
      }

      handlePlatinumResult(res, data || []);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-day-end/cashier-receipt-unreconciled-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const queryParams = req.query as Record<string, string>;
      const cashierId = queryParams.id || queryParams.cashierId || '';
      const userId = session.userData?.user_ID ? String(session.userData.user_ID) : '';
      if (!cashierId && !userId) { res.status(400).json({ message: "Missing id parameter" }); return; }

      const strategies = [
        { label: 'GET cashierId', method: 'GET' as const, path: '/api/billing-payment-day-end-reconcile/cashier-receipt-unreconciled-list', params: { id: cashierId || userId } },
        { label: 'POST cashierId', method: 'POST' as const, path: '/api/billing-payment-day-end-reconcile/cashier-receipt-unreconciled-list', params: { id: cashierId || userId }, body: { page: 1, pageSize: 500, orderby: 'dateCaptured', shortDirection: 'desc' } },
        { label: 'GET get-prefix', method: 'GET' as const, path: '/api/billing-payment-day-end-reconcile/get-cashier-receipt-unreconciled-list', params: { id: cashierId || userId } },
        { label: 'POST get-prefix', method: 'POST' as const, path: '/api/billing-payment-day-end-reconcile/get-cashier-receipt-unreconciled-list', params: { id: cashierId || userId }, body: { page: 1, pageSize: 500, orderby: 'dateCaptured', shortDirection: 'desc' } },
        ...(userId && userId !== cashierId ? [
          { label: 'GET userId', method: 'GET' as const, path: '/api/billing-payment-day-end-reconcile/cashier-receipt-unreconciled-list', params: { id: userId } },
          { label: 'POST userId', method: 'POST' as const, path: '/api/billing-payment-day-end-reconcile/cashier-receipt-unreconciled-list', params: { id: userId }, body: { page: 1, pageSize: 500, orderby: 'dateCaptured', shortDirection: 'desc' } },
        ] : []),
      ];

      for (const s of strategies) {
        try {
          console.log(`[dayend-unreconciled-list] Trying ${s.label}: ${s.method} ${s.path}?id=${s.params.id}`);
          const data = s.method === 'POST'
            ? await platinumPost(session, s.path, s.body || {}, s.params)
            : await platinumGet(session, s.path, s.params);
          const str = JSON.stringify(data).substring(0, 500);
          console.log(`[dayend-unreconciled-list] ${s.label} response:`, str);
          if (data && !(data as any)._error) {
            const items = Array.isArray(data) ? data : (data as any)?.data || (data as any)?.items || (data as any)?.value;
            if (items && (Array.isArray(items) ? items.length > 0 : true)) {
              console.log(`[dayend-unreconciled-list] SUCCESS with ${s.label}`);
              handlePlatinumResult(res, data);
              return;
            }
          }
        } catch (e: any) {
          console.log(`[dayend-unreconciled-list] ${s.label} failed: ${e.message}`);
        }
      }
      console.log(`[dayend-unreconciled-list] All strategies exhausted, returning empty`);
      res.json({ data: [], totalRecords: 0 });
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-day-end/save-reconcile-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[dayend-save] Query: userId=${req.query.userId}, Payload:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-payment-day-end-reconcile/save-Reconcile-data", req.body, req.query as Record<string, string>);
      console.log(`[dayend-save] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Auth Day-End Reconciliation (Supervisor) ---

  app.get("/api/platinum/auth-day-end/cashier-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-cashier-list] Fetching...`);
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile/cashier-list");
      console.log(`[auth-dayend-cashier-list] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/cashier-reconcile-by-cashierid", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-reconcile] Query:`, req.query);
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid", req.query as Record<string, string>);
      console.log(`[auth-dayend-reconcile] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/pos-cashier", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile/pos-cashier", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/active-cashierid-by-userid", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile/active-cashierid-by-userid", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/cashier-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-details] Query:`, req.query);
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile/cashier-details", req.query as Record<string, string>);
      console.log(`[auth-dayend-details] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-cash-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-cash] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/cashier-receipt-cash-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-cash] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-cheque-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-cheque] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/cashier-receipt-cheque-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-cheque] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-card-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-card] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/cashier-receipt-card-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-card] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-postal-order-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-postal] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/cashier-receipt-postal-order-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-postal] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-offline-data-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-offline] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/cashier-receipt-offline-data-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-offline] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cashier-receipt-drop-box-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-dropbox] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/cashier-receipt-drop-box-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-dropbox] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/system-vs-cashier-data-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-sys-vs-cashier] Query: id=${req.query.id}, Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/system-vs-cashier-data-list", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-sys-vs-cashier] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/finish-day-end-reconcile", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-finish] Query: userId=${req.query.userId}`);
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/finish-day-end-reconcile", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-finish] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/return-day-end-reconcile", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-return] Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/return-day-end-reconcile", req.body);
      console.log(`[auth-dayend-return] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/validate-cashbook", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-validate] Query: cashierId=${req.query.cashierId}`);
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/validate-cashbook", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-validate] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/submit-day-auth-reconcile", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-submit] Query:`, req.query);
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/submit-day-auth-reconcile", req.body, req.query as Record<string, string>);
      console.log(`[auth-dayend-submit] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/cancel-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-cancel] Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/cancel-day-auth-reconcile-receipt", req.body);
      console.log(`[auth-dayend-cancel] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/request-cancel-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[request-cancel-receipt] Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/request-cancel-receipt", req.body);
      console.log(`[request-cancel-receipt] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/approve-cancel-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[approve-cancel-receipt] Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/approve-cancel-receipt", req.body);
      console.log(`[approve-cancel-receipt] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/decline-cancel-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[decline-cancel-receipt] Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/decline-cancel-receipt", req.body);
      console.log(`[decline-cancel-receipt] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/pending-cancel-requests", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[pending-cancel-requests] Query:`, JSON.stringify(req.query));
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile/pending-cancel-requests", req.query as Record<string, string>);
      console.log(`[pending-cancel-requests] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/print-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/print-receipt", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/print-cash-report", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/print-cash-report", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end/print-deposit-slip", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/print-deposit-slip", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Direct Deposit Allocation endpoints ---

  app.post("/api/platinum/direct-deposit-allocation/get-bank-recon-positem-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/get-bank-recon-positem-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/check-selected-item-processed", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/check-selected-item-processed", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-misc-payment-group", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-misc-payment-group");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-misc-vote-id-by-group", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-misc-vote-id-by-group", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-group-payment-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-group-payment-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-vat-rate", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-vat-rate");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-pos-item-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-pos-item-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/bank-statement-notes", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { posItemIds } = req.body;
      if (!Array.isArray(posItemIds) || posItemIds.length === 0) {
        return res.json({});
      }
      const limitedIds = posItemIds.slice(0, 50);
      const results: Record<string, string> = {};
      const batchSize = 5;
      for (let i = 0; i < limitedIds.length; i += batchSize) {
        const batch = limitedIds.slice(i, i + batchSize);
        const promises = batch.map(async (id: number) => {
          try {
            const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-pos-item-details", { posItemId: String(id) });
            if (data && !data.error) {
              const item = Array.isArray(data) ? data[0] : data;
              if (item?.note) {
                results[String(id)] = item.note;
              }
            }
          } catch {}
        });
        await Promise.all(promises);
      }
      res.json(results);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/bank-statement-notes-by-account", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const accountId = req.query.accountId as string;
      if (!accountId) return res.status(400).json({ message: "accountId required" });

      const receiptData = await platinumGet(session, "/api/BillingEnquiry/PaymentAmountByAccountIds", { accountId });
      const receipts = Array.isArray(receiptData) ? receiptData : (receiptData?.data || []);
      if (!receipts.length) return res.json({});

      const eftReceipts = receipts.filter((r: any) => {
        const pt = (r.paymentType || '').toLowerCase();
        return pt.includes('eft') || pt.includes('electronic') || pt.includes('transfer') || pt.includes('direct');
      });

      if (!eftReceipts.length) return res.json({});
      console.log(`[Bank Notes] Found ${eftReceipts.length} EFT receipts out of ${receipts.length} total for account ${accountId}`);

      const results: Record<string, string> = {};
      const now = new Date();
      const finYear = now.getMonth() >= 6
        ? `${now.getFullYear()}/${now.getFullYear() + 1}`
        : `${now.getFullYear() - 1}/${now.getFullYear()}`;

      const batchSize = 3;
      const limited = eftReceipts.slice(0, 20);
      for (let i = 0; i < limited.length; i += batchSize) {
        const batch = limited.slice(i, i + batchSize);
        const promises = batch.map(async (r: any) => {
          const receiptNo = r.receiptNo;
          if (!receiptNo) return;
          const receiptDate = r.receiptDate ? new Date(r.receiptDate) : now;
          const month = receiptDate.getMonth() + 1;
          try {
            const traceData = await platinumGet(session, "/api/billing/cashbook-transaction-trace/search", {
              searchText: receiptNo,
              finYear,
              month: String(month),
            });
            console.log(`[Bank Notes] Trace raw for ${receiptNo} (month=${month}):`, JSON.stringify(traceData).substring(0, 300));
            if (traceData && !traceData._error) {
              const items = Array.isArray(traceData) ? traceData : (traceData?.items || traceData?.data || []);
              if (items.length > 0 && !results[receiptNo]) {
                console.log(`[Bank Notes] Trace response for ${receiptNo}: fields=${JSON.stringify(Object.keys(items[0]))}`);
                console.log(`[Bank Notes] Trace sample for ${receiptNo}:`, JSON.stringify(items[0]).substring(0, 500));
              } else {
                console.log(`[Bank Notes] Trace returned ${items.length} items for ${receiptNo}`);
              }
              for (const item of items) {
                const note = item.note || item.NOTE || item.bankStatementNote || item.bankStatementDescription || item.statementDescription || item.eftDescription || item.ledgerNote || '';
                if (note && note !== receiptNo) {
                  results[receiptNo] = note;
                  break;
                }
              }
            }
          } catch {}
        });
        await Promise.all(promises);
      }

      console.log(`[Bank Notes] Resolved ${Object.keys(results).length} bank statement notes for ${limited.length} EFT receipts`);
      res.json(results);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-account-autocomplete", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-account-autocomplete", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-clearance-autocomplete", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-clearence-autocomplete", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-old-account-autocomplete", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-old-account-autocomplete", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-details-payment-grouping", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log('[DD Prep] load-details-payment-grouping — body:', JSON.stringify(req.body), 'query:', JSON.stringify(req.query));
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/load-details-payment-grouping", req.body, req.query as Record<string, string>, { timeout: 55000 });
      console.log('[DD Prep] load-details-payment-grouping — response status:', data?._error ? 'ERROR' : 'OK');
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[DD Prep] load-details-payment-grouping — EXCEPTION:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-details-payment-grouping-institution-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/load-details-payment-grouping-institution-data", req.body, req.query as Record<string, string>, { timeout: 55000 });
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-details-consumer-services", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log('[DD Prep] load-details-consumer-services — body:', JSON.stringify(req.body), 'query:', JSON.stringify(req.query));
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/load-details-consumer-services", req.body, req.query as Record<string, string>, { timeout: 55000 });
      console.log('[DD Prep] load-details-consumer-services — response status:', data?._error ? 'ERROR' : 'OK');
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[DD Prep] load-details-consumer-services — EXCEPTION:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-details-clearance", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log('[DD Prep] load-details-clearance — body:', JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/load-details-clearance", req.body, undefined, { timeout: 55000 });
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/get-clearance-details-info", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/get-clearance-details-info", req.body, undefined, { timeout: 55000 });
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/get-consumer-details-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log('[DD Prep] get-consumer-details-data — body:', JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/get-consumer-details-data", req.body, undefined, { timeout: 55000 });
      console.log('[DD Prep] get-consumer-details-data — response status:', data?._error ? 'ERROR' : 'OK');
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[DD Prep] get-consumer-details-data — EXCEPTION:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/load-confirm-payment-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log('[DD Confirm] Query params:', JSON.stringify(req.query), 'Body:', JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/load-confirm-payment-details", req.body, req.query as Record<string, string>, { timeout: 55000 });
      console.log('[DD Confirm] API response:', data?._error ? `ERROR: ${JSON.stringify(data)}` : 'OK');
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[DD Confirm] EXCEPTION:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/submit-details-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log('[DD Submit] Request body:', JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/submit-details-data", req.body, undefined, { timeout: 55000 });
      console.log('[DD Submit] API response:', data?._error ? `ERROR: ${JSON.stringify(data)}` : 'OK');
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[DD Submit] EXCEPTION:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/get-misc-receipt-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-misc-receipt-data", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/view-receipt/search-by-eft-description", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { description, fromDate, toDate } = req.body;
      if (!description || description.length < 3) {
        return res.status(400).json({ message: "Description must be at least 3 characters" });
      }
      const searchText = description.toLowerCase();
      console.log(`[EFT Search] Searching for: "${description}"`);

      const allItems: any[] = [];
      let currentPage = 1;
      const pageSize = 200;
      const maxPages = 10;

      while (currentPage <= maxPages) {
        const listData = await platinumPost(session, "/api/billing-direct-deposit-allocation/get-bank-recon-positem-list", {
          page: currentPage,
          pageSize,
          orderby: 'dateOfTransaction',
          shortDirection: 'desc',
        });

        if (!listData || listData._error) break;

        const items = Array.isArray(listData?.items) ? listData.items : Array.isArray(listData) ? listData : [];
        if (items.length === 0) break;

        allItems.push(...items);
        const totalCount = listData.totalCount ?? items.length;
        if (allItems.length >= totalCount) break;
        currentPage++;
      }

      console.log(`[EFT Search] Loaded ${allItems.length} bank recon items across ${currentPage} pages`);

      const matching = allItems.filter((item: any) => {
        const noteText = (item.note || '').toLowerCase();
        return noteText.includes(searchText);
      });

      console.log(`[EFT Search] Found ${matching.length} matching items by 'note' field`);

      const allocatedMatches = matching.filter((item: any) => !!item.dateAllocated);
      const unallocatedMatches = matching.filter((item: any) => !item.dateAllocated);

      const results: any[] = [];

      for (const item of allocatedMatches) {
        results.push({
          posItemId: item.posItem_ID,
          bankReconId: item.bankReconID,
          description: item.note || '',
          amount: item.amount || 0,
          dateOfTransaction: item.dateOfTransaction,
          dateAllocated: item.dateAllocated,
          dateCaptured: item.dateCaptured,
          capturerID: item.capturerID,
          cashbookTransactionID: item.cashbookTransactionID || null,
          directDepositTypeID: item.directDepositTypeID || null,
          allocated: true,
          matchedReceipts: [],
        });
      }

      for (const item of unallocatedMatches) {
        results.push({
          posItemId: item.posItem_ID,
          bankReconId: item.bankReconID,
          description: item.note || '',
          amount: item.amount || 0,
          dateOfTransaction: item.dateOfTransaction,
          dateAllocated: null,
          dateCaptured: null,
          capturerID: null,
          cashbookTransactionID: item.cashbookTransactionID || null,
          directDepositTypeID: null,
          allocated: false,
          matchedReceipts: [],
        });
      }

      console.log(`[EFT Search] Returning ${results.length} results (${allocatedMatches.length} allocated, ${unallocatedMatches.length} unallocated)`);
      res.json({ results, totalBankReconItems: allItems.length, matchingItems: matching.length });
    } catch (e: any) {
      console.error(`[EFT Search] Error:`, e.message);
      res.status(502).json({ message: "Search failed", detail: e.message });
    }
  });

  app.get("/api/platinum/cashbook-transaction-trace/search", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { searchText, finYear, month } = req.query as Record<string, string>;
      if (!searchText) {
        return res.status(400).json({ message: "searchText is required" });
      }
      const params: Record<string, string> = { searchText };
      if (finYear) params.finYear = finYear;
      if (month) params.month = month;
      const data = await platinumGet(session, "/api/billing/cashbook-transaction-trace/search", params);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/vote-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/vote-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Direct Deposit Bulk Allocation ---

  app.post("/api/platinum/direct-deposit-bulk/get-unprocessed", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/direct-deposit-bulk-allocation/get-unprocessed-direct-deposits", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-bulk/get-processed", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/direct-deposit-bulk-allocation/get-processed-deposits", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-bulk/reconcile", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/direct-deposit-bulk-allocation/reconcile-processed-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-bulk/print-processed", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/direct-deposit-bulk-allocation/print-processed-deposits", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Bulk Progress ---

  app.get("/api/platinum/bulk-progress/get-financial-years", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BulkProgress/get-financial-years");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/bulk-progress/get-month-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BulkProgress/get-month-list");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/bulk-progress/get-process-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BulkProgress/get-process-list");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/bulk-progress/get-bulk-allocation-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BulkProgress/get-bulk-allocation-list", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/bulk-progress/direct-deposit/:jobId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/BulkProgress/direct-deposit/${req.params.jobId}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Direct Deposit Errors ---

  app.get("/api/platinum/direct-deposit-errors/failed-jobs", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/DirectDepositErrors/failed-jobs");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-errors/job-details/:jobId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/DirectDepositErrors/job-details/${req.params.jobId}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-errors/account-details/:jobId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/DirectDepositErrors/account-details/${req.params.jobId}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-errors/retry/:jobId/:userId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, `/api/DirectDepositErrors/retry/${req.params.jobId}/${req.params.userId}`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Third Party Payments V2 ---

  app.post("/api/platinum/third-party-payments/import", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/pos/third-party-payments/import", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/third-party-payments/:importId/transactions", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/billing/pos/third-party-payments/${req.params.importId}/transactions`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/third-party-payments/validate-account", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/pos/third-party-payments/validate-account", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/third-party-payments/:importId/reconcile", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, `/api/billing/pos/third-party-payments/${req.params.importId}/reconcile`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/third-party-payments/:importId/commit", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, `/api/billing/pos/third-party-payments/${req.params.importId}/commit`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.put("/api/platinum/third-party-payments/:importId/transactions/:index", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const token = await refreshSessionToken(session);
      const apiUrl = getPlatinumApiUrl();
      const url = `${apiUrl}/api/billing/pos/third-party-payments/${req.params.importId}/transactions/${req.params.index}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const rawRes = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
          signal: controller.signal,
        });
        const rawText = await rawRes.text();
        if (!rawRes.ok) {
          return res.status(rawRes.status).json({ message: rawRes.statusText, detail: rawText.substring(0, 1000) });
        }
        let data;
        try { data = rawText ? JSON.parse(rawText) : null; } catch { data = rawText; }
        res.json(data);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/third-party-payments/:importId/validate-for-reconcile", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, `/api/billing/pos/third-party-payments/${req.params.importId}/validate-for-reconcile`, req.body || {});
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/third-party-payments/account-search", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/pos/third-party-payments/account-search", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Third Party Payments - Cashier Status ---

  app.get("/api/platinum/third-party-payments/is-cashier-active", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/pos/third-party-payments/is-cashier-active", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/third-party-payments/cashier-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/pos/third-party-payments/cashier-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/third-party-payments/import-file", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const token = await refreshSessionToken(session);
      const apiUrl = getPlatinumApiUrl();
      const url = `${apiUrl}/api/billing/pos/third-party-payments/import`;

      const { fileContent, FileName, Name, ContentType, thirdpartyTypeId, paymentReference, cashBookId } = req.body;

      if (!fileContent) {
        return res.status(400).json({ message: "No file content provided" });
      }

      const fileName = FileName || Name || 'upload.csv';
      const mimeType = ContentType || 'text/plain';

      const formData = new FormData();
      const fileBlob = new Blob([fileContent], { type: mimeType });
      formData.append('file', fileBlob, fileName);

      if (thirdpartyTypeId !== undefined) formData.append('thirdpartyTypeId', String(thirdpartyTypeId));
      if (paymentReference) formData.append('paymentReference', String(paymentReference));
      if (cashBookId !== undefined) formData.append('cashBookId', String(cashBookId));

      console.log(`[third-party-import] Uploading file '${fileName}' (${fileContent.length} chars) to ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      try {
        const rawRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: formData,
          signal: controller.signal,
        });
        const rawText = await rawRes.text();
        console.log(`[third-party-import] Status: ${rawRes.status}, Response:`, rawText.substring(0, 1000));
        if (!rawRes.ok) {
          return res.status(rawRes.status).json({ message: rawRes.statusText, detail: rawText.substring(0, 1000) });
        }
        let data;
        try { data = rawText ? JSON.parse(rawText) : null; } catch { data = rawText; }
        res.json(data);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e: any) {
      console.error(`[third-party-import] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/third-party-payments/types", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/pos/third-party-payments/types");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Enquiry endpoints ---

  app.get("/api/platinum/billing-enquiry/deposit-amount", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/DepositAmount", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/deposits-by-account-id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/DepositsByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/receipt-transaction-detail", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/getReceiptTransactionDetail", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/total-balance-debt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const accountId = req.query.accountId as string;
      const data = await platinumGet(session, "/api/BillingEnquiry/TotalBalanceDebtInquiry", { accountId });
      
      // If no data or error, fallback to enquiry results which might have some info
      if (!data || data._error || (Array.isArray(data) && data.length === 0)) {
         const enquiryData = await platinumPost(session, "/api/BillingEnquiry/EnquiryResults", { accountID: accountId });
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
      const session = requireAuth(req, res); if (!session) return;
      console.log('[ServiceTypeBalance] Query params:', JSON.stringify(req.query));
      const data = await platinumGet(session, "/api/BillingEnquiry/ServiceTypeBalanceDetails", req.query as Record<string, string>);
      console.log('[ServiceTypeBalance] Response type:', typeof data, Array.isArray(data) ? `array(${data.length})` : '');
      if (data && typeof data === 'object') {
        const sample = Array.isArray(data) ? data.slice(0, 2) : data;
        console.log('[ServiceTypeBalance] Sample:', JSON.stringify(sample).substring(0, 500));
      }
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[ServiceTypeBalance] Error:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-enquiry/reconcile/:receiptId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, `/api/BillingEnquiry/reconcile/${req.params.receiptId}`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/linked-accounts-on-property", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const accountId = req.query.accountId as string;
      if (!accountId) return res.status(400).json({ message: "accountId is required" });

      console.log(`[linked-accounts] Getting property details for accountId: ${accountId}`);
      const propData = await platinumGet(session, "/api/BillingEnquiry/PropertyDetailsByAccountId", { accountId });
      if (!propData || propData._error) {
        console.log(`[linked-accounts] PropertyDetailsByAccountId failed`);
        return res.json([]);
      }
      const propertyId = propData.propertyId || propData.unitID;
      const ownerName = (propData.name || '').trim();
      const sgNumber = propData.sgNumber || '';

      console.log(`[linked-accounts] Property: ${propertyId}, owner: ${ownerName}, SG: ${sgNumber}`);

      if (!ownerName && !sgNumber && !propertyId) {
        console.log(`[linked-accounts] No owner name, SG number, or property ID found, returning empty`);
        return res.json([]);
      }

      let accounts: any[] = [];
      const seenIds = new Set<string>();

      if (sgNumber) {
        console.log(`[linked-accounts] Searching by sgNumber via autocomplete: ${sgNumber}`);
        const sgParts = sgNumber.match(/\d+/g) || [];
        const erfDigits = sgParts.length >= 3 ? sgParts[2].replace(/^0+/, '') : '';
        const searchTerms = new Set<string>();
        if (erfDigits) searchTerms.add(erfDigits);
        sgParts.forEach((p: string) => { const d = p.replace(/^0+/, ''); if (d && d.length >= 3) searchTerms.add(d); });

        const matchedAccountIds = new Set<number>();
        for (const term of searchTerms) {
          try {
            const acResults = await platinumGet(session, "/api/BillingEnquiry/Autocomplete", { search: term, type: 'erfNumber' });
            const acArr = Array.isArray(acResults) ? acResults : [];
            for (const item of acArr) {
              if (item.displayItem === sgNumber && item.accountId) {
                matchedAccountIds.add(item.accountId);
              }
            }
          } catch (e: any) {
            console.log(`[linked-accounts] Autocomplete for "${term}" failed: ${e.message}`);
          }
          if (matchedAccountIds.size > 0) break;
        }

        if (matchedAccountIds.size > 0) {
          console.log(`[linked-accounts] Found ${matchedAccountIds.size} account(s) via SG autocomplete: ${Array.from(matchedAccountIds).join(', ')}`);
          const lookups = await Promise.allSettled(
            Array.from(matchedAccountIds).map(id =>
              platinumPost(session, "/api/BillingEnquiry/EnquiryResults", { accountID: String(id) })
            )
          );
          for (const r of lookups) {
            if (r.status === 'fulfilled') {
              const data = r.value;
              const arr = Array.isArray(data) ? data : (data && !data._error ? [data] : []);
              for (const acct of arr) {
                const id = String(acct.account_ID || acct.accountID || '');
                if (id && !seenIds.has(id)) { seenIds.add(id); accounts.push(acct); }
              }
            }
          }
        }
      }

      if (accounts.length <= 1 && ownerName) {
        console.log(`[linked-accounts] Trying owner name search: ${ownerName}`);
        const nameResults = await platinumPost(session, "/api/BillingEnquiry/EnquiryResults", {
          companyName: ownerName,
        });
        let nameAccounts: any[] = [];
        if (Array.isArray(nameResults)) {
          nameAccounts = nameResults;
        } else if (nameResults && nameResults.results) {
          nameAccounts = nameResults.results;
        } else if (nameResults && !nameResults._error) {
          nameAccounts = [nameResults];
        }
        for (const na of nameAccounts) {
          const naId = String(na.account_ID || na.accountID || '');
          if (naId && !seenIds.has(naId)) {
            seenIds.add(naId);
            accounts.push(na);
          }
        }
      }

      const linkedAccounts = accounts.filter((a: any) => {
        const aId = String(a.account_ID || a.accountID || '');
        if (aId === String(accountId)) return false;
        const aSg = a.sgNumber || '';
        const aUnitId = String(a.unitID || a.unitPartitionID || '');
        const aPropId = String(a.propertyID || '').replace(/^0+/, '');
        const propIdClean = String(propertyId || '');
        if (sgNumber && aSg === sgNumber) return true;
        if (propIdClean && (aUnitId === propIdClean || aPropId === propIdClean)) return true;
        return false;
      });

      console.log(`[linked-accounts] Found ${linkedAccounts.length} linked accounts (out of ${accounts.length} total, property: ${propertyId}, SG: ${sgNumber})`);

      const enriched = await Promise.all(
        linkedAccounts.slice(0, 20).map(async (acct: any) => {
          const aId = acct.account_ID || acct.accountID;
          try {
            const balance = await platinumGet(session, "/api/BillingEnquiry/TotalBalanceDebtInquiry", { accountId: String(aId) });
            const balanceArr = Array.isArray(balance) ? balance : [];
            const totalOutstanding = balanceArr.reduce((sum: number, b: any) => sum + (b.totalOutStanding || 0), 0);
            return { ...acct, balanceDetails: balanceArr, totalOutstanding };
          } catch {
            return { ...acct, balanceDetails: [], totalOutstanding: acct.outStandingAmount || 0 };
          }
        })
      );

      res.json(enriched);
    } catch (e: any) {
      console.log(`[linked-accounts] Error: ${e.message}`);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/property-details-by-account", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/PropertyDetailsByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/cons-unit-by-account", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/ConsUnitByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/name-info-by-account", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/NameInfoByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/handover-by-account", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/HandoverByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/payment-incentive-by-account", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingEnquiry/PaymentIncentiveByAccountId", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Additional Billing Enquiry endpoints (registry-based) ---
  const billingEnquiryGetEndpoints: Array<[string, string]> = [
    ["basic-account-details", "BasicAccountDetails"],
    ["partition-details", "PartitionDetails"],
    ["unit-partition-owner", "UnitPartitionOwner"],
    ["property", "Property"],
    ["cons-unit-search", "ConsUnitSearch"],
    ["debit-order-deduction-by-account", "debitorderdeductionbyaccountid"],
    ["account-notifications", "AccountNotifications"],
    ["repayment-plan-status", "RepaymentPlanStatus"],
    ["allotment-description-by-id", "AllotmentDescriptionById"],
    ["sectional-title-scheme", "SectionalTitleScheme"],
    ["account-info-result", "AccountInfoResult"],
    ["account-service-meter-per-property", "AccountServiceMeterPerProperty"],
    ["account-delivery-address-detail", "AccountDeliveryAddressDetail"],
    ["additional-billing-search-results", "AdditionalBillingSearchResults"],
    ["services-search-results", "ServicesSearchResults"],
    ["bank-guarantee-history", "GetBankGuaranteetHistory"],
    ["payment-extension-search-results", "PaymentExtensionSearchResults"],
    ["detailed-transaction-results", "DetailedTransactionResults"],
    ["get-billing-period-transactions", "getBillingPeriodTransactions"],
    ["all-services", "AllServices"],
    ["payment-plan-remaining-capital", "PaymentPlanRemainingCapitalAmount"],
    ["payment-amount-by-account-ids", "PaymentAmountByAccountIds"],
    ["cheque-final-search-list", "ChequeFinalSearchList"],
    ["cheque-write-back-detail", "ChequeWriteBackDetail"],
    ["payment-plans-by-account-id", "PaymentPlansByAccountId"],
    ["payment-incentive-journals", "PaymentIncentiveJournals"],
    ["metered-services-on-account", "MeteredServicesOnAccount"],
    ["valuation-by-id", "ValuationById"],
    ["valuation-by-unit", "ValuationByUnit"],
    ["valuation-import-by-id", "ValuationImportById"],
    ["supplementary-valuations", "SupplementaryValuations"],
    ["rates-run-history", "RatesRunHistory"],
    ["account-rates-details", "GetAccountRatesDetails"],
    ["unit-linked-meters", "UnitLinkedMeters"],
    ["transfer-ownership", "TransferOwnerShip"],
    ["clearance-inquiries", "ClearanceInquiries"],
    ["prepaid-meter-services-for-account", "PrepaidMeterServicesForAccount"],
    ["periods", "Periods"],
    ["attp-application-history", "AttpApplicationHistory"],
    ["debtor-note-lists", "DebtorNoteLists"],
    ["account-inquiries", "AccountInquiries"],
    ["add-occupiers", "AddOccupiers"],
    ["autocomplete", "Autocomplete"],
    ["meter-reading-history", "meter-reading-history"],
    ["meter-reading-history-barchart", "meter-reading-history-barchart"],
    ["get-status", "get-status"],
    ["departmental-accounts-by-id", "get-departmental-accounts-by-id"],
    ["generated-statements-by-id", "get-generated-statements-by-id"],
    ["billing-template", "getBillingTemplate"],
    ["detail-billing-template", "getDetailBillingTemplate"],
    ["contact-details-history-by-id", "get-contactdetails-history-by-id"],
    ["delivery-address-history-by-id", "get-delivery-address-history-by-id"],
    ["delivery-account-details-by-id", "get-delivery-account-details-by-id"],
    ["property-notification", "getPropertyNotification"],
    ["billing-processing-month", "getBillingProcessingMonth"],
    ["levy-transaction-detail", "getLevyTransactionDetail"],
    ["open-balance-detail", "getOpenBalanceDetail"],
    ["close-balance-detail", "getCloseBalanceDetail"],
    ["journal-transaction-details", "getJournalTransactionDetails"],
    ["rebate-transaction-detail", "getRebateTransactionDetail"],
    ["interest-cons-payment-detail", "getInterestConsPaymentTransactionDetail"],
    ["interest-late-payment-detail", "getInterestLatePaymentTransactionDetail"],
    ["prepaid-recharge-details-for-meter", "getPrepaidRechargeDetailsForMeter"],
    ["section129-account-enquiry", "GetSection129AccountEnquiry"],
    ["get-debit-order-deduction", "getDebitOrderDeduction"],
    ["handover-account-enquiry", "getHandoverAccountEnquiry"],
    ["billed-vs-paid-amounts", "BilledVsPaidAmounts"],
    ["cons-handover-transaction-detail", "getConsHandoverTransactionDetail"],
    ["meter-info-by-id", "getMeterInfoById"],
    ["payments-received", "PaymentsReceived"],
    ["lookups", "lookups"],
    ["billing-calculation-popup-data", "getBillingalculationPopupDataDetails"],
    ["check-file-exists", "CheckFileExists"],
    ["search-by-bank-statement-note", "SearchByBankStatementNote"],
    ["get-eft-bank-statement-notes", "GetEftBankStatementNotes"],
  ];

  app.get(`/api/platinum/billing-enquiry/billed-vs-paid-amounts`, async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { accountId, financialYear } = req.query as Record<string, string>;
      try {
        const data = await platinumGet(session, `/api/BillingEnquiry/BilledVsPaidAmounts`, req.query as Record<string, string>);
        if (data && (Array.isArray(data) ? data.length > 0 : true)) {
          handlePlatinumResult(res, data);
          return;
        }
      } catch (primaryErr: any) {
        console.log(`[billed-vs-paid] Primary endpoint failed (${primaryErr.message}), falling back to DetailedTransactionResults`);
      }
      const finYear = financialYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
      const txnData = await platinumGet(session, `/api/BillingEnquiry/DetailedTransactionResults`, {
        accountId: accountId,
        finYear: finYear,
      });
      if (!txnData || !Array.isArray(txnData)) {
        res.json([]);
        return;
      }
      const months = ['july','august','september','october','november','december','january','february','march','april','may','june'];
      const monthLabels = ['July','August','September','October','November','December','January','February','March','April','May','June'];
      const totalRow = txnData.find((d: any) => d.transGroup === 900 || (d.serviceDesc || '').toLowerCase() === 'total');
      const receiptsRow = txnData.find((d: any) => d.transGroup === 915 || (d.serviceDesc || '').toLowerCase() === 'receipts');
      const result: any[] = [];
      for (let i = 0; i < months.length; i++) {
        const billing = totalRow ? Number(totalRow[months[i]]) || 0 : 0;
        const paid = receiptsRow ? Number(receiptsRow[months[i]]) || 0 : 0;
        if (billing !== 0 || paid !== 0) {
          result.push({
            financialYear: finYear,
            month: monthLabels[i],
            billingAmount: billing,
            paidAmount: paid,
          });
        }
      }
      res.json(result);
    } catch (e: any) {
      res.status(502).json({ message: "Failed to load billed vs paid data", detail: e.message });
    }
  });

  for (const [localPath, platinumPath] of billingEnquiryGetEndpoints) {
    if (localPath === 'billed-vs-paid-amounts') continue;
    app.get(`/api/platinum/billing-enquiry/${localPath}`, async (req, res) => {
      try {
        const session = requireAuth(req, res); if (!session) return;
        const data = await platinumGet(session, `/api/BillingEnquiry/${platinumPath}`, req.query as Record<string, string>);
        if (localPath === 'search-by-bank-statement-note' && data) {
          const items = Array.isArray(data) ? data : (data as any)?.value || (data as any)?.data || [];
          if (items.length > 0) {
            console.log('[bank-statement-note] First item keys:', Object.keys(items[0]));
            console.log('[bank-statement-note] First item:', JSON.stringify(items[0]));
          } else {
            console.log('[bank-statement-note] Response type:', typeof data, 'isArray:', Array.isArray(data), 'keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A');
          }
        }
        if (localPath === 'prepaid-meter-services-for-account' && data) {
          const items = Array.isArray(data) ? data : (data as any)?.value || (data as any)?.data || [];
          if (items.length > 0) {
            console.log('[prepaid-meters] First item keys:', Object.keys(items[0]));
            console.log('[prepaid-meters] First item:', JSON.stringify(items[0]));
          } else {
            console.log('[prepaid-meters] Response type:', typeof data, 'isArray:', Array.isArray(data), 'keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A');
          }
        }
        if (localPath === 'prepaid-recharge-details-for-meter') {
          console.log('[prepaid-recharge] Query:', req.query, 'Response type:', typeof data, 'isArray:', Array.isArray(data), 'length:', Array.isArray(data) ? data.length : 'N/A');
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            console.log('[prepaid-recharge] Response keys:', Object.keys(data));
          }
        }
        handlePlatinumResult(res, data);
      } catch (e: any) {
        res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
      }
    });
  }

  app.post("/api/platinum/billing-enquiry/generate-statement", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { accountId, statementType, financialYear, month } = req.body;
      const endpoint = statementType === 'detailed'
        ? "/api/BillingEnquiry/getDetailBillingTemplate"
        : "/api/BillingEnquiry/getBillingTemplate";
      const params: Record<string, string> = { accountId: String(accountId) };
      if (financialYear) params.financialYear = financialYear;
      if (month) params.month = month;
      const data = await platinumGet(session, endpoint, params);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/clearance-document-download", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { costScheduleId, type } = req.query as Record<string, string>;
      if (!costScheduleId || !type) {
        return res.status(400).json({ message: "costScheduleId and type are required" });
      }
      const token = await refreshSessionToken(session);
      const apiUrl = getPlatinumApiUrl();
      const endpoint = type === 'cost-schedule'
        ? `/api/BillingEnquiry/DownloadCostSchedule`
        : `/api/BillingEnquiry/DownloadClearanceCertificate`;
      const url = `${apiUrl}${endpoint}?costScheduleId=${costScheduleId}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return res.status(response.status).json({ message: `Failed to download ${type}`, detail: text.substring(0, 500) });
      }
      const contentType = response.headers.get('content-type') || 'application/pdf';
      const contentDisposition = response.headers.get('content-disposition');
      res.setHeader('Content-Type', contentType);
      if (contentDisposition) {
        res.setHeader('Content-Disposition', contentDisposition);
      } else {
        const filename = type === 'cost-schedule' ? 'cost-schedule.pdf' : 'clearance-certificate.pdf';
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      }
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (e: any) {
      res.status(502).json({ message: "Failed to download clearance document", detail: e.message });
    }
  });

  app.get("/api/platinum/statement-download", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const fileUrl = req.query.fileUrl as string;
      if (!fileUrl) {
        return res.status(400).json({ message: "fileUrl is required" });
      }
      const platinumApiUrl = getPlatinumApiUrl();
      const fullUrl = fileUrl.startsWith('/') ? `${platinumApiUrl}${fileUrl}` : fileUrl;
      const allowedHosts = [
        'georgeplatinumuatapi.azurewebsites.net',
        'george-uat-ems-billing-api.azurewebsites.net',
      ];
      try {
        const parsedUrl = new URL(fullUrl);
        if (!allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`))) {
          return res.status(403).json({ message: "Download URL not allowed" });
        }
      } catch {
        return res.status(400).json({ message: "Invalid file URL" });
      }
      const token = await refreshSessionToken(session);
      const response = await fetch(fullUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        return res.status(response.status).json({ message: "Failed to download statement" });
      }
      const contentType = response.headers.get('content-type') || 'application/pdf';
      const contentDisposition = response.headers.get('content-disposition');
      res.setHeader('Content-Type', contentType);
      if (contentDisposition) {
        res.setHeader('Content-Disposition', contentDisposition);
      } else {
        res.setHeader('Content-Disposition', 'attachment; filename=statement.pdf');
      }
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (e: any) {
      res.status(502).json({ message: "Failed to download statement", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-enquiry/search", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BillingEnquiry/search", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-enquiry/add-occupier", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BillingEnquiry/AddOccupier", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.delete("/api/platinum/billing-enquiry/add-occupier", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumDelete(session, "/api/BillingEnquiry/AddOccupier", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Dashboard POS counts ---

  app.get("/api/platinum/billing-dashboard/pos-count", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDashboard/pos-count");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-dashboard/pos-tab-item-details-count", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDashboard/get-pos-tab-item-details-count");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-dashboard/get-deposit-table-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BillingDashboard/get-deposit-table-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-dashboard/get-direct-deposits-allocation-table-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BillingDashboard/get-direct-deposits-allocation-table-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-dashboard/get-third-party-payment-pending-table-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BillingDashboard/get-third-party-payment-pending-table-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-dashboard/get-alert-counts", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDashboard/get-alert-counts");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-dashboard/get-notification-counts", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDashboard/get-notification-counts");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-dashboard/get-billing-payment-by-type-of-use", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDashboard/get-billing-payment-by-type-of-use");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-dashboard/account-count", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/BillingDashboard/account-count");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-dashboard/get-post-dated-cheque-search-table-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/BillingDashboard/get-post-dated-cheque-search-table-data", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Dashboard: dynamic GET/POST proxy for any BillingDashboard endpoint ---
  app.get("/api/platinum/billing-dashboard/consumption-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/consumption-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/debt-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/debt-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/billing-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/billing-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/property-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/property-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/indigentsubsidy-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/indigentsubsidy-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/journal-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/journal-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/rebate-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/rebate-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/assets-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/assets-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-notification-account-item-counts", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-notification-account-item-counts")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-notification-consumption-item-counts", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-notification-consumption-item-counts")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-notification-debt-item-counts", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-notification-debt-item-counts")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-subsidy-item-counts", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-subsidy-item-counts")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-property-tab-item-details-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-property-tab-item-details-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-rebate-tab-item-details-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-rebate-tab-item-details-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-billing-tab-item-details-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-billing-tab-item-details-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-billing-tab-item-asset-count", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-billing-tab-item-asset-count")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-debt-arrangement-summary-chart", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-debt-arrangement-summary-chart")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-meterreading-progress-chart", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-meterreading-progress-chart")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });
  app.get("/api/platinum/billing-dashboard/get-billing-dashboard-billing-cycles", async (req, res) => {
    try { const session = requireAuth(req, res); if (!session) return; handlePlatinumResult(res, await platinumGet(session, "/api/BillingDashboard/get-billing-dashboard-billing-cycles")); } catch (e: any) { res.status(502).json({ message: "Platinum API unreachable", detail: e.message }); }
  });

  app.post("/api/platinum/billing-dashboard/generic-table", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { endpoint, pager } = req.body;
      if (!endpoint || typeof endpoint !== 'string') { res.status(400).json({ message: "Missing endpoint" }); return; }
      const allowed = endpoint.startsWith('/api/BillingDashboard/get-') && endpoint.includes('table-data');
      const allowedOther = [
        '/api/BillingDashboard/get-awating-verification',
        '/api/BillingDashboard/get-automatic-disqualification',
        '/api/BillingDashboard/get-attp-applicatoin-authorization-details',
        '/api/BillingDashboard/get-attp-applicatoin-termination-details',
        '/api/BillingDashboard/get-awaiting-application-declined-details',
        '/api/BillingDashboard/get-bad-debt-reconciliation',
        '/api/BillingDashboard/get-billing-cycle-due-alerts',
        '/api/BillingDashboard/get-cutoff-history',
        '/api/BillingDashboard/get-declined-journals',
        '/api/BillingDashboard/get-employee-deduction-alerts',
        '/api/BillingDashboard/get-first-and-final-outstanding',
        '/api/BillingDashboard/get-first-and-final-readings-required',
        '/api/BillingDashboard/get-first-and-final-declined-alerts',
        '/api/BillingDashboard/get-final-reading-approval-pending-meter-change',
        '/api/BillingDashboard/get-final-services-with-no-meter-reading',
        '/api/BillingDashboard/get-journals-pending-review',
        '/api/BillingDashboard/get-meter-pending-status',
        '/api/BillingDashboard/get-meter-changes-pending-list',
        '/api/BillingDashboard/get-meter-removal-declined-alerts',
        '/api/BillingDashboard/get-meter-removal-readings-required',
        '/api/BillingDashboard/get-meterbook-with-no-route-file',
        '/api/BillingDashboard/get-meterbooks-not-linked-to-cycle',
        '/api/BillingDashboard/get-meters-not-linked-to-route-file',
        '/api/BillingDashboard/get-not-sequenced-meters',
        '/api/BillingDashboard/get-not-included-moc-table-data',
        '/api/BillingDashboard/get-not-linked-service-table-data',
        '/api/BillingDashboard/get-report-meters',
        '/api/BillingDashboard/get-repayment-plan-approved-not-activated',
        '/api/BillingDashboard/get-repayment-plan-awaiting-authorisation',
        '/api/BillingDashboard/get-repayment-plan-declined',
        '/api/BillingDashboard/get-repayment-plans-awaiting-termination-authorisation',
        '/api/BillingDashboard/get-unpaid-transactions',
        '/api/BillingDashboard/get-valuation-expired',
      ].includes(endpoint);
      if (!allowed && !allowedOther) { res.status(403).json({ message: "Endpoint not allowed" }); return; }
      const data = await platinumPost(session, endpoint, pager || {});
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Account Management (selected endpoints) ---

  app.post("/api/platinum/billing-account-management/search-accounts", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/account-management/search-accounts", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/account-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/account-management/account-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/account-information", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/account-management/account-information", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/get-contact-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/account-management/get-contact-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/get-property-details", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/account-management/get-property-details", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/get-account-grouping", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/account-management/get-account-grouping", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/get-sub-account-grouping", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/account-management/get-sub-account-grouping", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/get-payment-group-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/account-management/get-payment-group-list");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-account-management/get-additional-emails", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/account-management/get-additional-emails", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipting-account-group/get-account-groups", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/receipting-account-group/get-account-groups", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipting-account-group/get-account-sub-groups", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/receipting-account-group/get-account-sub-groups", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipting-account-group/search", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/receipting-account-group/search", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/receipting-account-group-payment/search-accounts-by-group", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/receipting-account-group-payment/search-accounts-by-group", req.query as Record<string, string>);
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

  app.get("/api/proxy/accounts-by-name-id", async (req, res) => {
    try {
      const accountId = req.query.accountId as string;
      if (!accountId) {
        return res.status(400).json({ message: "accountId is required" });
      }

      const accountData = await proxyGet(`${EXTERNAL_API_BASE}/api/cons-accounts/${accountId}`);
      if (accountData.error || !accountData) {
        return res.status(404).json({ message: "Account not found" });
      }

      const nameId = accountData.nameId;
      if (!nameId) {
        return res.json({ nameId: null, accounts: [] });
      }

      const searchData = await proxyGet(`${EXTERNAL_API_BASE}/api/cons-accounts/search?nameId=${nameId}`);
      let accounts: any[] = [];
      if (Array.isArray(searchData)) {
        accounts = searchData;
      } else if (searchData?.value && Array.isArray(searchData.value)) {
        accounts = searchData.value;
      } else if (searchData && !searchData.error) {
        accounts = [searchData];
      }

      accounts = accounts.filter((a: any) => {
        const aid = a.id || a.accountId || a.account_ID;
        return aid && String(aid) !== String(accountId);
      });

      res.json({ nameId, accounts });
    } catch (e: any) {
      console.error(`[accounts-by-name-id] Error:`, e.message);
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
      const receiptId = req.query.receiptId as string;
      const receiptNo = req.query.receiptNo as string;

      const tryMultiPrint = async (id: string): Promise<any[]> => {
        try {
          const url = `${EXTERNAL_API_BASE}/api/pos-multi-receipt-print?receiptId=${encodeURIComponent(id)}`;
          const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (response.ok) {
            const data = await response.json();
            const items = Array.isArray(data) ? data : [];
            if (items.length > 0) return items;
          }
        } catch {}
        return [];
      };

      const lookupViewReceipt = async (): Promise<{ serialNo: string | null; viewMatch: any | null }> => {
        try {
          const session = (req as any).session?.platinumAuth;
          if (!session?.token) return { serialNo: null, viewMatch: null };
          const lookupNo = receiptNo || '';
          if (!lookupNo) return { serialNo: null, viewMatch: null };
          const lookupParams: Record<string, string> = {
            ReceiptNo: lookupNo,
            Cashier: '0',
            FromDate: new Date(new Date().getFullYear() - 2, 0, 1).toISOString().split('T')[0] + 'T00:00:00',
            ToDate: new Date().toISOString().split('T')[0] + 'T23:59:59',
            Page: '1',
            PageSize: '10',
          };
          const viewData = await platinumGet(session, "/api/ViewReceipt/get-receipt-list", lookupParams, { timeoutMs: 30000 });
          let viewItems: any[] = [];
          if (Array.isArray(viewData)) {
            viewItems = viewData;
          } else if (viewData && typeof viewData === 'object' && !viewData._error) {
            viewItems = viewData.items || viewData.value || viewData.results || viewData.data || [];
          }
          const match = viewItems.find((v: any) => {
            const vNo = v.receiptNo || v.receipt_No || '';
            return vNo === lookupNo || vNo.includes(lookupNo) || lookupNo.includes(vNo);
          });
          if (match) {
            const sn = match.serialNo || match.receiptId || match.receipt_ID || match.id;
            return { serialNo: sn ? String(sn) : null, viewMatch: match };
          }
          return { serialNo: null, viewMatch: null };
        } catch (e) {
          console.warn('[pos-multi-receipt-print] ViewReceipt lookup failed:', e);
          return { serialNo: null, viewMatch: null };
        }
      };

      let items: any[] = [];
      let viewMatch: any = null;

      if (receiptNo) {
        console.log(`[pos-multi-receipt-print] receiptNo="${receiptNo}" provided, doing ViewReceipt lookup first for serialNo`);
        const lookup = await lookupViewReceipt();
        viewMatch = lookup.viewMatch;
        if (lookup.serialNo) {
          console.log(`[pos-multi-receipt-print] ViewReceipt resolved serialNo=${lookup.serialNo}, using for multi-print`);
          items = await tryMultiPrint(lookup.serialNo);
        }
      }

      if (items.length === 0 && receiptId) {
        console.log(`[pos-multi-receipt-print] Trying with raw receiptId=${receiptId}`);
        items = await tryMultiPrint(receiptId);
      }

      if (items.length > 0 && viewMatch) {
        const first = items[0];
        const needsEnrichment = !first.accountId && !first.accName && !first.oldAccountCode;
        if (needsEnrichment) {
          console.log(`[pos-multi-receipt-print] Enriching multi-print data with ViewReceipt fields`);
          const vm = viewMatch;
          const accountId = vm.accountNumber || vm.accountNo || vm.accountID || vm.account_number || '';
          const accName = vm.accName || vm.consumerName || vm.accountName || vm.account_name || '';
          const accAddress = vm.accAddress || vm.address || vm.consumerAddress || '';
          const oldAccountCode = vm.oldAccountCode || vm.oldAccountNo || vm.old_account_code || '';
          const sgNumber = vm.sgNumber || vm.sg_number || vm.sgNo || '';
          const cashierName = vm.cashierName || vm.cashier_name || vm.cashier || '';
          const cashOfficeName = vm.cashOfficeName || vm.cashOffice || vm.cash_office || vm.cashBook || '';
          const outstandingAmount = vm.outstandingAmount ?? vm.outstanding_amount ?? vm.balanceAmount ?? null;
          const payMode = vm.paymentType || vm.payment_type || vm.payMode || '';
          const billType = vm.paymentOption || vm.payment_option || vm.billType || '';
          for (const item of items) {
            if (!item.accountId && accountId) item.accountId = accountId;
            if (!item.accName && accName) item.accName = accName;
            if (!item.accAddress && accAddress) item.accAddress = accAddress;
            if (!item.oldAccountCode && oldAccountCode) item.oldAccountCode = oldAccountCode;
            if (!item.sgNumber && sgNumber) item.sgNumber = sgNumber;
            if (!item.cashierName && cashierName) item.cashierName = cashierName;
            if (!item.cashOfficeName && cashOfficeName) item.cashOfficeName = cashOfficeName;
            if (item.outstandingAmount == null && outstandingAmount != null) item.outstandingAmount = outstandingAmount;
            if (!item.payMode && payMode) item.payMode = payMode;
          }
        }
      }

      if (items.length === 0) {
        console.log(`[pos-multi-receipt-print] No data found for receiptId=${receiptId}, receiptNo=${receiptNo}`);
      }

      res.json(items);
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
          const baseProbe = 1041300;
          const probeIds = [baseProbe + 200, baseProbe + 150, baseProbe + 100, baseProbe + 50, baseProbe, baseProbe - 20];
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
            let probeId = baseProbe;
            while (probeId > baseProbe - 100) {
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
        if (!highestKnownId) highestKnownId = 1041300;
      }

      const scanStartId = highestKnownId + 50;
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

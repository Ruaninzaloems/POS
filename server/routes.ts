import type { Express } from "express";
import { createServer, type Server } from "http";
import { platinumGet, platinumPost, platinumPut, platinumDelete, loginWithCredentials, logoutSession, isSessionAuthenticated, refreshSessionToken, getSessionPosCashierId, getPlatinumApiUrl, getPlatinumDbName, createEmptySession, clearLockoutCache, SITE_CONFIGS, getSiteConfig, type UserSession, type SiteConfig } from "./platinum-auth";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import type { Request } from "express";
import OpenAI from "openai";

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


const recentPaymentSubmissions = new Map<string, { timestamp: number; response: any }>();
const PAYMENT_DEDUP_WINDOW_MS = 15000;

function getPaymentDeduplicationKey(userId: string, body: any): string {
  const rm = body?.requestModel || {};
  const accounts = body?.accounts || [];
  const acct = body?.account || {};
  const accountKey = acct.account_ID ? `single:${acct.account_ID}` :
    accounts.length > 0 ? `multi:${accounts.map((a: any) => a.accountID).sort().join(',')}` : 'unknown';
  return `${userId}|${accountKey}|${rm.totalAmount}|${rm.paymentType}`;
}

function checkPaymentDedup(key: string): { isDuplicate: boolean; cachedResponse?: any } {
  const now = Date.now();
  for (const [k, v] of recentPaymentSubmissions.entries()) {
    if (now - v.timestamp > PAYMENT_DEDUP_WINDOW_MS) {
      recentPaymentSubmissions.delete(k);
    }
  }
  const cached = recentPaymentSubmissions.get(key);
  if (cached && (now - cached.timestamp) < PAYMENT_DEDUP_WINDOW_MS) {
    return { isDuplicate: true, cachedResponse: cached.response };
  }
  return { isDuplicate: false };
}

function recordPaymentSubmission(key: string, response: any): void {
  recentPaymentSubmissions.set(key, { timestamp: Date.now(), response });
}

interface ReceiptAllocation {
  service: string;
  amount: number;
  vat: number;
  total: number;
}

function parseReceiptAllocations(pdfText: string): ReceiptAllocation[] {
  const allocations: ReceiptAllocation[] = [];
  const lines = pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const skipLabels = new Set([
    'total', 'tender amount', 'change', 'outstanding balance', 'outstanding',
    'vat amount', 'vat', 'receipt no', 'receipt date', 'account no', 'old account no',
    'account name', 'sg number', 'address', 'payment type', 'payment option',
    'cashier', 'cash office', 'reprint', 'thank you', 'vat registration number',
    'balance', 'amount', 'date', 'outstanding balance', 'outstanding',
  ]);

  const serviceAllocRegex = /^(.+?)\s{2,}(-?[\d, ]+\.\d{2})\s*$/;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const match = line.match(serviceAllocRegex);
    if (match) {
      let label = match[1].trim();
      const amtStr = match[2].replace(/[\s,]/g, '');
      const amount = parseFloat(amtStr);
      if (!label || isNaN(amount)) continue;
      const labelLower = label.toLowerCase();
      if (skipLabels.has(labelLower)) continue;
      if (/^\d/.test(label)) continue;
      if (labelLower.includes('municipality') || labelLower.includes('registration')) continue;

      if (li + 1 < lines.length) {
        const nextLine = lines[li + 1].trim();
        const knownSuffixes = ['basic', 'metered', 'charge', 'disposal', 'rates', 'levy', 'fixed', 'standing', 'contribution', 'payment', 'advance', 'arrear'];
        if (nextLine && !nextLine.match(/\d/) && !skipLabels.has(nextLine.toLowerCase()) && nextLine.length < 30) {
          const nextLineIsService = nextLine.match(serviceAllocRegex);
          const isKnownSuffix = knownSuffixes.some(s => nextLine.toLowerCase() === s || nextLine.toLowerCase().startsWith(s));
          if (!nextLineIsService && isKnownSuffix) {
            label = label + ' ' + nextLine;
            li++;
          }
        }
      }

      allocations.push({
        service: label,
        amount: amount,
        vat: 0,
        total: amount,
      });
    }
  }

  if (allocations.length > 0) {
    return allocations;
  }

  let vatAmount = 0;
  let tenderAmount = 0;
  const usedIndices = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const amountMatch = lines[i].match(/^-?([\d,]+\.\d{2})$/);
    if (amountMatch && i > 0) {
      const val = parseFloat(amountMatch[1].replace(/,/g, ''));
      const prevLine = lines[i - 1].toLowerCase();
      if (prevLine === 'vat amount' || prevLine === 'vat') vatAmount = val;
      else if (prevLine === 'total') { /* skip */ }
      else if (prevLine === 'tender amount') tenderAmount = val;
      else if (prevLine === 'change' || prevLine === 'outstanding balance' || prevLine === 'outstanding') { /* skip */ }
      else if (!skipLabels.has(prevLine) && !/^\d/.test(lines[i - 1]) && !usedIndices.has(i)) {
        allocations.push({
          service: lines[i - 1],
          amount: val,
          vat: 0,
          total: val,
        });
        usedIndices.add(i);
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
  if (data && data.isSuccess === false) {
    console.warn(`[handlePlatinumResult] API returned isSuccess=false:`, JSON.stringify(data).substring(0, 2000));
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

  app.get("/api/sites", (_req, res) => {
    res.json(SITE_CONFIGS.map(s => ({ id: s.id, name: s.name, logo: s.logo, themeClass: s.themeClass })));
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, dbName, siteId } = req.body;
      if (!username) {
        return res.status(400).json({ success: false, error: "Username is required" });
      }
      clearLockoutCache(username);
      const result = await loginWithCredentials(username, password, dbName, siteId);
      if (result.success) {
        req.session.platinumAuth = result.session!;
        const site = getSiteConfig(result.session!.siteId);
        res.json({ success: true, user: result.session!.userData, site: { id: site.id, name: site.name, logo: site.logo, themeClass: site.themeClass } });
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
      const site = getSiteConfig(session.siteId || 'george');
      res.json({ authenticated: true, user: session.userData, site: { id: site.id, name: site.name, logo: site.logo, themeClass: site.themeClass } });
    } else {
      res.json({ authenticated: false });
    }
  });

  app.get("/api/auth/site-info", async (req, res) => {
    const session = getSession(req);
    const site = getSiteConfig(session.siteId || 'george');
    res.json({ id: site.id, name: site.name, logo: site.logo, themeClass: site.themeClass });
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
      const finYear = req.query.finYear as string;
      if (!userId) {
        return res.status(400).json({ message: "userid is required" });
      }
      if (!finYear) {
        return res.status(400).json({ message: "finYear is required" });
      }

      console.log(`[active-cashier] Using validate-cashier API as single source of truth — userId=${userId}, finYear=${finYear}`);
      const vcData = await platinumGet(session, "/api/ReceiptPrepaid/validate-cashier", { userId, finYear });
      console.log(`[active-cashier] RAW validate-cashier top-level keys:`, vcData ? Object.keys(vcData).join(', ') : 'null');
      console.log(`[active-cashier] RAW cashier field:`, JSON.stringify(vcData?.cashier)?.substring(0, 500) || 'null');
      console.log(`[active-cashier] RAW cashOffice field:`, JSON.stringify(vcData?.cashOffice)?.substring(0, 300) || 'null');
      console.log(`[active-cashier] RAW cashierReconcile field:`, JSON.stringify(vcData?.cashierReconcile)?.substring(0, 500));

      if (!vcData || vcData._error) {
        console.error(`[active-cashier] validate-cashier API failed or returned error:`, vcData?._error || 'no data');
        return res.json({ active: false, cashierId: null, cashierRegistered: false, isActive: false });
      }

      let cashier = vcData.cashier || null;
      let cashOffice = vcData.cashOffice || null;
      const receiptRange = vcData.receiptRange || vcData.receiptRangeAvailable || null;
      const cashierReconcile = vcData.cashierReconcile || null;

      let sessionFromCache = false;

      if (!cashier) {
        console.log(`[active-cashier] validate-cashier returned cashier=null — checking fallbacks`);

        const knownId = (session as any).knownCashierId;
        if (knownId && knownId > 0) {
          console.log(`[active-cashier] Trying knownCashierId=${knownId} from session`);
          try {
            const details = await platinumGet(session, `/api/ReceiptPrepaid/cashier-detailsById`, { cashierId: String(knownId) });
            if (details && !details._error && details.id && details.isActive === true) {
              cashier = details;
              cashOffice = details.const_CashOffice || null;
              console.log(`[active-cashier] knownCashierId fallback SUCCESS — id: ${details.id}, isActive: ${details.isActive}, isVirtual: ${details.isVirtual}, officeId: ${details.officeId}`);
            } else {
              console.log(`[active-cashier] knownCashierId fallback returned no active session: id=${details?.id}, isActive=${details?.isActive}`);
            }
          } catch (knownErr: any) {
            console.warn(`[active-cashier] knownCashierId lookup failed:`, knownErr.message);
          }
        }

        if (!cashier) {
          try {
            const fallbackCashierId = await platinumGet(session, "/api/billing/auth-day-end-reconcile/active-cashierid-by-userid", { userid: userId });
            const numFallback = typeof fallbackCashierId === 'number' ? fallbackCashierId : parseInt(String(fallbackCashierId), 10);
            const numUserId = parseInt(String(userId), 10);
            if (numFallback && numFallback !== 0 && !isNaN(numFallback) && !(fallbackCashierId as any)?._error) {
              if (numFallback === numUserId) {
                console.log(`[active-cashier] Fallback returned userId ${numFallback} (same as user_Id) — this is NOT a valid POS_Cashier.id, skipping details lookup`);
              } else {
                console.log(`[active-cashier] Fallback found active cashierId: ${numFallback} (different from userId ${numUserId}) — fetching details`);
                const details = await platinumGet(session, `/api/ReceiptPrepaid/cashier-detailsById`, { cashierId: String(numFallback) });
                if (details && !details._error && details.id) {
                  cashier = details;
                  cashOffice = details.const_CashOffice || null;
                  console.log(`[active-cashier] Fallback cashier details loaded — id: ${details.id}, isActive: ${details.isActive}, isVirtual: ${details.isVirtual}, officeId: ${details.officeId}`);
                }
              }
            } else {
              console.log(`[active-cashier] Fallback returned no active cashier: ${JSON.stringify(fallbackCashierId)}`);
            }
          } catch (fbErr: any) {
            console.warn(`[active-cashier] Fallback active-cashierid check failed:`, fbErr.message);
          }
        }

        if (!cashier && (session as any).knownCashierData) {
          const stored = (session as any).knownCashierData;
          if (stored.id > 0) {
            console.log(`[active-cashier] Using stored knownCashierData for registration info only — id: ${stored.id} (NOT treating as active since Platinum API returned cashier=null)`);
            cashier = { ...stored, isActive: false };
            cashOffice = stored.const_CashOffice || null;
            sessionFromCache = true;
          }
        }
      }

      const hasReceiptRangeData = receiptRange != null && (receiptRange.user_Id > 0 || receiptRange.isEnabled === true);
      const isCashierRegistered = (cashier != null && (cashier.id > 0 || cashier.user_Id > 0)) || hasReceiptRangeData;
      const isSessionActive = cashier?.isActive === true;
      const cashierId = cashier?.id || cashier?.user_Id || null;
      const activeOfficeId = cashOffice?.cashOffice_ID || cashier?.officeId || null;
      const activeOfficeName = cashOffice?.cashOfficeDesc || null;
      const cashFloat = cashier?.cashFloat ?? 0;
      const cashOnHandLimit = cashOffice?.cashOnHandLimit || 999999;

      let resolvedCashierReconcile = cashierReconcile;

      if (!resolvedCashierReconcile && cashierId) {
        try {
          console.log(`[active-cashier] validate-cashier cashierReconcile=null — calling cashier-reconcile-by-cashierid?cashierId=${cashierId} as secondary check`);
          const reconcileData = await platinumGet(session, "/api/billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid", { cashierId: String(cashierId) });
          if (reconcileData && !reconcileData._error && reconcileData !== null && typeof reconcileData === 'object') {
            const hasId = reconcileData.id || reconcileData.reconcileId || reconcileData.cashierReconcile_ID;
            if (hasId) {
              console.log(`[active-cashier] cashier-reconcile-by-cashierid returned a reconcile record — id: ${hasId}, status: ${reconcileData.status || reconcileData.reconcileStatus || 'unknown'}`);
              resolvedCashierReconcile = reconcileData;
            } else {
              console.log(`[active-cashier] cashier-reconcile-by-cashierid returned data but no reconcile ID — treating as no pending reconcile`);
            }
          } else {
            console.log(`[active-cashier] cashier-reconcile-by-cashierid returned null/error — no pending reconcile`);
          }
        } catch (reconcileErr: any) {
          console.warn(`[active-cashier] cashier-reconcile-by-cashierid check failed:`, reconcileErr.message);
        }
      }

      const reconcileStatus = resolvedCashierReconcile ? String(resolvedCashierReconcile.status || resolvedCashierReconcile.reconcileStatus || '').toLowerCase().trim() : '';
      const isReconcileReturned = reconcileStatus.includes('return');
      const isReconcileCompleted = reconcileStatus.includes('complet') || reconcileStatus.includes('post') || reconcileStatus.includes('finish') || reconcileStatus.includes('approved');
      const isReconcileNotSubmitted = reconcileStatus.includes('not yet submitted') || reconcileStatus.includes('not submitted') || reconcileStatus === '';
      const hasDayEndReturned = resolvedCashierReconcile != null && isReconcileReturned;
      const reconcileIsPending = resolvedCashierReconcile != null && !isReconcileReturned && !isReconcileCompleted && !isReconcileNotSubmitted;
      const hasPendingDayEnd = reconcileIsPending || (!resolvedCashierReconcile && session.dayEndPending === true);
      if (!resolvedCashierReconcile && session.dayEndPending === true) {
        console.log(`[active-cashier] API cashierReconcile is null but session.dayEndPending=true — treating as pending (API may not reflect submission yet)`);
      }
      if (hasDayEndReturned) {
        console.log(`[active-cashier] Reconcile record has RETURNED status — cashier can re-submit`);
        session.dayEndPending = false;
      }
      if (isReconcileCompleted) {
        console.log(`[active-cashier] Reconcile record has COMPLETED status — day-end fully reconciled`);
        session.dayEndPending = false;
      }
      console.log(`[active-cashier] validate-cashier result — registered: ${isCashierRegistered}, isActive: ${isSessionActive} (POS_Cashier.IsActive=${cashier?.isActive}), cashierId: ${cashierId}, officeId: ${activeOfficeId}, officeName: ${activeOfficeName}, cashierReconcile: ${resolvedCashierReconcile ? 'PRESENT' : 'null'}, reconcileStatus: "${reconcileStatus}", session.dayEndPending: ${session.dayEndPending}, hasPendingDayEnd: ${hasPendingDayEnd}, hasDayEndReturned: ${hasDayEndReturned}, isReconcileCompleted: ${isReconcileCompleted}`);

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
        hasPendingDayEnd,
        hasDayEndReturned,
        dayEndReturnReason: hasDayEndReturned ? (resolvedCashierReconcile?.returnReason || resolvedCashierReconcile?.reason || resolvedCashierReconcile?.returnedReason || resolvedCashierReconcile?.comments || '') : undefined,
        cashierReconcile: resolvedCashierReconcile,
        details: cashierDetails,
        sessionNeedsCreation: sessionFromCache,
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
      const query = { ...req.query as Record<string, string> };
      delete query._nocache;
      const data = await platinumGet(session, "/api/ReceiptPrepaid/cons-account-details", query);
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
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
      console.log(`[validate-day-end-recon] Query: ${JSON.stringify(req.query)}, Response: ${JSON.stringify(data)}`);
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

      if (!query.userId && session.userData?.user_ID) {
        query = { ...query, userId: String(session.userData.user_ID) };
      }

      console.log(`[cash-offices] Calling Platinum cash-offices with params:`, JSON.stringify(query));
      const [primaryData, dayEndOfficeList] = await Promise.all([
        platinumGet(session, "/api/ReceiptPrepaid/cash-offices", query),
        platinumGet(session, "/api/billing/auth-day-end-reconcile/cash-office-list").catch((err) => { console.error('[cash-offices] Failed to fetch day-end office list:', err); return null; }),
      ]);

      const voteMap = new Map<number, { voteID: number; vote: string; vote1: string }>();
      if (dayEndOfficeList && !dayEndOfficeList._error && Array.isArray(dayEndOfficeList)) {
        for (const o of dayEndOfficeList) {
          if (o.cashOffice_ID && (o.voteID || o.vote_Id)) {
            voteMap.set(o.cashOffice_ID, {
              voteID: o.voteID || o.vote_Id,
              vote: o.vote || '',
              vote1: o.vote1 || '',
            });
          }
        }
        console.log(`[cash-offices] Loaded vote data for ${voteMap.size} offices from day-end cash-office-list`);
      }

      const officeMap = new Map<number, any>();
      const addOffice = (office: any) => {
        if (office && office.cashOffice_ID && !officeMap.has(office.cashOffice_ID)) {
          const voteData = voteMap.get(office.cashOffice_ID);
          officeMap.set(office.cashOffice_ID, {
            cashOffice_ID: office.cashOffice_ID,
            cashOfficeDesc: office.cashOfficeDesc || '',
            cashOnHandLimit: office.cashOnHandLimit || null,
            scoaConfigurationID: office.scoaConfigurationID || null,
            vote1: office.vote1 || voteData?.vote1 || null,
            vote: office.vote || voteData?.vote || null,
            vote_ID: office.vote_ID || voteData?.voteID || null,
            voteDesc: office.voteDesc || voteData?.vote || null,
          });
        }
      };

      if (primaryData && !primaryData._error && Array.isArray(primaryData)) {
        primaryData.forEach(addOffice);
        console.log(`[cash-offices] Primary endpoint returned ${primaryData.length} offices`);
      }

      if (dayEndOfficeList && !dayEndOfficeList._error && Array.isArray(dayEndOfficeList)) {
        dayEndOfficeList.forEach((o: any) => {
          if (o.cashOffice_ID && !officeMap.has(o.cashOffice_ID) && o.enabled !== false) {
            addOffice({
              cashOffice_ID: o.cashOffice_ID,
              cashOfficeDesc: o.cashOfficeDesc || '',
              cashOnHandLimit: null,
              scoaConfigurationID: o.scoaConfigurationID || null,
            });
          }
        });
      }

      if (officeMap.size < 5) {
        console.log(`[cash-offices] Few offices from primary, probing IDs 1-20...`);
        const probeIds = Array.from({ length: 20 }, (_, i) => i + 1).filter(id => !officeMap.has(id));
        const probeResults = await Promise.all(
          probeIds.map(async (id) => {
            try {
              const office = await platinumGet(session, "/api/ReceiptPrepaid/active-cashOffice-details", { cashierId: String(id) });
              if (office && !office._error && office.cashOffice_ID) return office;
            } catch (err) { console.error('[cash-offices] Probe failed for office ID:', err); }
            return null;
          })
        );
        probeResults.filter(Boolean).forEach(addOffice);
        console.log(`[cash-offices] After probe: ${officeMap.size} offices found`);
      }

      const offices = Array.from(officeMap.values()).sort((a: any, b: any) => a.cashOffice_ID - b.cashOffice_ID);
      console.log(`[cash-offices] Returning ${offices.length} offices, vote sample:`, offices.length > 0 ? `vote_ID=${offices[0].vote_ID}, vote=${offices[0].vote}` : 'none');
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
      const userId = session.userData?.user_ID || req.body.user_Id;

      const payload: Record<string, any> = {
        id: req.body.id ?? 0,
        user_Id: userId,
        cashFloat: req.body.cashFloat ?? null,
        stpPort: req.body.stpPort ?? null,
        plesseyPort: req.body.plesseyPort ?? null,
        officeId: req.body.officeId ?? null,
        isVirtual: req.body.isVirtual ?? false,
      };

      const isNewSession = !payload.id || payload.id === 0;
      const isClose = req.body.isActive === false;
      if (isClose) {
        payload.isActive = false;
      }
      console.log(`[submit-cashier-setup] ${isClose ? 'CLOSING' : isNewSession ? 'CREATING NEW' : 'UPDATING existing (id=' + payload.id + ')'} session — userId=${userId}, officeId=${payload.officeId}`);
      console.log(`[submit-cashier-setup] Payload:`, JSON.stringify(payload));
      const data = await platinumPost(session, "/api/ReceiptPrepaid/submit-cashier-setup", payload);
      console.log(`[submit-cashier-setup] Response:`, JSON.stringify(data));

      if (data && data._error) {
        const detail = data.detail || data.statusText || JSON.stringify(data);
        console.error(`[submit-cashier-setup] API error:`, detail);
        if (data.status === 401) {
          const isAzure = session.authMode === 'azure' || session.authMode === 'override';
          const msg = isAzure
            ? "Your account is currently using a bridge token (possibly due to a login lockout). This endpoint requires a direct login token. Please log out and log back in to retry, or wait for the lockout to expire."
            : "Authentication failed — please log in again";
          return res.status(401).json({ message: msg, detail, authMode: session.authMode });
        }
        return res.status(data.status || 400).json({ message: "Cashier setup failed", detail });
      }

      if (data?.cashier?.id && data.cashier.isActive === true) {
        (session as any).knownCashierId = data.cashier.id;
        (session as any).knownCashierOfficeId = data.cashier.officeId || payload.officeId;
        (session as any).knownCashierData = data.cashier;
        session.dayEndPending = false;
        console.log(`[submit-cashier-setup] Stored knownCashierId=${data.cashier.id}, officeId=${(session as any).knownCashierOfficeId} in session for fallback lookups. Cleared dayEndPending.`);
      }

      if (isClose && data?.cashier?.isActive === false) {
        (session as any).knownCashierId = null;
        (session as any).knownCashierOfficeId = null;
        (session as any).knownCashierData = null;
        console.log(`[submit-cashier-setup] Session closed — cleared knownCashier data from server session`);
      }

      res.json(data);
    } catch (e: any) {
      console.error(`[submit-cashier-setup] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/debug/user-auth-test", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const token = await refreshSessionToken(session);
      const userId = session.userData?.user_ID || 213;

      const sessionApiUrl = getPlatinumApiUrl(session);
      const userListRes = await fetch(`${sessionApiUrl}/api/User`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!userListRes.ok) {
        return res.json({ error: "Failed to fetch user list", status: userListRes.status });
      }
      const users: any[] = await userListRes.json();
      const target = users.find((u: any) => u.userId === userId || u.user_ID === userId || u.id === userId);

      const allFields = target ? Object.keys(target) : [];
      console.log(`[debug-auth] User ${userId} fields:`, allFields);
      console.log(`[debug-auth] User ${userId} data:`, JSON.stringify(target, null, 2));

      const password = process.env.PLATINUM_API_PASSWORD || '';
      const dbName = getPlatinumDbName(session);
      const apiUrl = sessionApiUrl;

      const candidates = new Set<string>();
      if (target) {
        if (target.userName) candidates.add(target.userName);
        if (target.loginName) candidates.add(target.loginName);
        if (target.email) candidates.add(target.email);
        if (target.firstName) candidates.add(target.firstName);
        if (target.lastName) candidates.add(target.lastName);
        if (target.firstName && target.lastName) {
          candidates.add(`${target.firstName}${target.lastName}`);
          candidates.add(`${target.firstName}.${target.lastName}`);
          candidates.add(`${target.firstName}${target.lastName[0]}`);
          candidates.add(`${target.firstName[0]}${target.lastName}`);
        }
      }
      candidates.add(process.env.PLATINUM_API_USERNAME || 'Francois');

      const results: Record<string, string> = {};
      for (const name of candidates) {
        try {
          const r = await fetch(`${apiUrl}/auth/createToken`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName: name, password, dbName }),
          });
          const text = await r.text();
          let parsed: any;
          try { parsed = JSON.parse(text); } catch { parsed = text; }
          if (r.ok && parsed.token) {
            const userData = parsed.data || parsed.user || parsed.userData || {};
            results[name] = `SUCCESS — user_ID: ${userData.user_ID || userData.userId || 'unknown'}`;
          } else {
            results[name] = `FAILED (${r.status}): ${typeof parsed === 'string' ? parsed.substring(0, 100) : JSON.stringify(parsed).substring(0, 100)}`;
          }
        } catch (e: any) {
          results[name] = `ERROR: ${e.message}`;
        }
      }

      console.log(`[debug-auth] createToken results:`, JSON.stringify(results, null, 2));
      res.json({ userId, userRecord: target, fields: allFields, createTokenResults: results });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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

      const isCard = rm.paymentType === 'CreditCard' || rm.paymentType === 3;
      if (rm.apiTransactionID === undefined) rm.apiTransactionID = 0;
      if (rm.isReconciled === undefined || rm.isReconciled === null) rm.isReconciled = 0;
      if (rm.isCancelled === undefined || rm.isCancelled === null) rm.isCancelled = 0;

      if (isCard && !rm.cardNumber) {
        console.warn(`[submit-consumer-payment] WARNING: Card payment but cardNumber is empty!`);
      }

      console.log(`[submit-consumer-payment] userId=${userId}, paymentType=${rm.paymentType}`);
      console.log(`[submit-consumer-payment] account: account_ID=${acct.account_ID}, accountNumber=${acct.accountNumber}, name=${acct.name}, outStandingAmt=${acct.outStandingAmt}, billId=${acct.billId}, cutOffID=${acct.cutOffID}, cutOffAmount=${acct.cutOffAmount}, debtAmount=${acct.debtAmount}, debtArrangementId=${acct.debtArrangementId}, sundryDebtorsId=${acct.sundryDebtorsId}, billingCycleId=${acct.billingCycleId}`);
      console.log(`[submit-consumer-payment] requestModel: finYear=${rm.finYear}, receiptDate=${rm.receiptDate}, totalAmount=${rm.totalAmount}, tenderAmount=${rm.tenderAmount}, changeAmount=${rm.changeAmount}, paymentType=${rm.paymentType}, paymentOption=${rm.paymentOption}, outStandingAmount=${rm.outStandingAmount}, cutOffID=${rm.cutOffID}, cutOffAmount=${rm.cutOffAmount}, debtAmount=${rm.debtAmount}, debtArrangementId=${rm.debtArrangementId}, sundryDebtorsId=${rm.sundryDebtorsId}, cardNumber=${rm.cardNumber ? '***' + rm.cardNumber.slice(-4) : '(empty)'}, apiTransactionID=${rm.apiTransactionID}, isReconciled=${rm.isReconciled}, isCancelled=${rm.isCancelled}`);
      console.log(`[submit-consumer-payment] full payload:`, JSON.stringify(body, null, 2));
      const dedupKey = getPaymentDeduplicationKey(userId, body);
      const dedupCheck = checkPaymentDedup(dedupKey);
      if (dedupCheck.isDuplicate) {
        console.warn(`[submit-consumer-payment] DUPLICATE BLOCKED — same payment within ${PAYMENT_DEDUP_WINDOW_MS/1000}s window. Key: ${dedupKey}`);
        res.json(dedupCheck.cachedResponse);
        return;
      }
      const data = await platinumPost(session, `/api/billing-payment/submit-consumer-payment/${userId}`, body);
      console.log(`[submit-consumer-payment] response (full):`, JSON.stringify(data));
      recordPaymentSubmission(dedupKey, data);
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

      console.log(`[submit-multiple-payment] userId=${userId}, ${accounts.length} account(s), paymentType=${rm.paymentType}`);
      for (const acct of accounts) {
        console.log(`[submit-multiple-payment] account: accountID=${acct.accountID}, accountNumber=${acct.accountNumber}, name=${acct.name}, outstandingAmount=${acct.outstandingAmount}, paymentAmount=${acct.paymentAmount}, billId=${acct.billId}`);
      }
      console.log(`[submit-multiple-payment] requestModel: finYear=${rm.finYear}, receiptDate=${rm.receiptDate}, totalAmount=${rm.totalAmount}, tenderAmount=${rm.tenderAmount}, changeAmount=${rm.changeAmount}, paymentType=${rm.paymentType}, paymentOption=${rm.paymentOption}, outStandingAmount=${rm.outStandingAmount}, cardNumber=${rm.cardNumber ? '***' + rm.cardNumber.slice(-4) : '(empty)'}`);
      const invalidAccounts = accounts.filter((a: any) => !a.accountID || a.accountID === 0);
      if (invalidAccounts.length > 0) {
        console.error(`[submit-multiple-payment] BLOCKED: ${invalidAccounts.length} account(s) have accountID=0 or missing`, invalidAccounts.map((a: any) => a.name || a.accountNumber));
        res.status(400).json({ isSuccess: false, message: `${invalidAccounts.length} account(s) have invalid Account IDs (0 or missing): ${invalidAccounts.map((a: any) => a.name || a.accountNumber || 'unknown').join(', ')}. Remove them from the cart and retry.` });
        return;
      }
      console.log(`[submit-multiple-payment] full payload:`, JSON.stringify(body, null, 2).substring(0, 3000));
      const dedupKey = getPaymentDeduplicationKey(userId, body);
      const dedupCheck = checkPaymentDedup(dedupKey);
      if (dedupCheck.isDuplicate) {
        console.warn(`[submit-multiple-payment] DUPLICATE BLOCKED — same payment within ${PAYMENT_DEDUP_WINDOW_MS/1000}s window. Key: ${dedupKey}`);
        res.json(dedupCheck.cachedResponse);
        return;
      }
      const timeoutMs = Math.max(60000, accounts.length * 8000);
      const data = await platinumPost(session, `/api/billing-payment/submit-multiple-payment/${userId}`, body, undefined, { timeout: timeoutMs });
      console.log(`[submit-multiple-payment] response (full):`, JSON.stringify(data).substring(0, 2000));
      recordPaymentSubmission(dedupKey, data);
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
      console.log(`[save-multiple-account-payment] Saving ${accounts.length} account(s), query params:`, req.query);
      for (const acct of accounts) {
        console.log(`[save-multiple-account-payment] account_ID=${acct.account_ID}, outStandingAmt=${acct.outStandingAmt}, paymentAmount=${acct.paymentAmount}, name=${acct.name}`);
      }
      const data = await platinumPost(session, "/api/billing-payment/save-multiple-account-payment", req.body, req.query as Record<string, string>);
      console.log(`[save-multiple-account-payment] response:`, JSON.stringify(data));
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
      const data = await platinumPost(session, "/api/billing-payment/search-accounts", req.body, undefined, { timeout: 20000 });
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/print-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      let receiptIds: number[];
      let receiptNos: string[] = [];
      let isReprint = false;
      if (Array.isArray(req.body)) {
        receiptIds = req.body;
      } else if (req.body && Array.isArray(req.body.ids)) {
        receiptIds = req.body.ids;
        receiptNos = req.body.receiptNos || [];
        isReprint = req.body.isReprint === true;
      } else {
        return res.status(400).json({ message: "Request body must be an array of receipt serial numbers or { ids, receiptNos, isReprint }" });
      }
      if (receiptIds.length === 0) {
        return res.status(400).json({ message: "No receipt IDs provided" });
      }
      console.log(`[print-receipt] Receipt IDs: [${receiptIds.join(', ')}], Receipt Nos: [${receiptNos.join(', ')}], IsReprint: ${isReprint}`);

      const token = await refreshSessionToken(session);
      const apiUrl = getPlatinumApiUrl();

      const buildPrintReceiptPayload = (ids: number[], rNos?: string[], reprint?: boolean) => ({
        Ids: ids.map(Number),
        ReceiptNos: rNos || [],
        IsReprint: reprint ?? isReprint,
      });

      const fetchSingleReceiptPdf = async (id: number, receiptNo?: string): Promise<Buffer | null> => {
        try {
          const payload = buildPrintReceiptPayload([id], receiptNo ? [receiptNo] : [], true);
          const r = await fetch(`${apiUrl}/api/billing-payment/print-receipt`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/pdf,application/octet-stream,*/*",
            },
            body: JSON.stringify(payload),
          });
          if (!r.ok) {
            console.warn(`[print-receipt] Failed to fetch receipt ${id}: HTTP ${r.status}`);
            return null;
          }
          return Buffer.from(await r.arrayBuffer());
        } catch (e: any) {
          console.warn(`[print-receipt] Error fetching receipt ${id}:`, e.message);
          return null;
        }
      };

      const { PDFDocument } = await import('pdf-lib');

      const cropReceiptPages = async (pdfBuffer: Buffer): Promise<Buffer> => {
        try {
          const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
          const pages = doc.getPages();
          for (const page of pages) {
            const { width, height } = page.getSize();
            const contentHeight = Math.min(height, Math.ceil(height * 0.58));
            page.setCropBox(0, height - contentHeight, width, contentHeight);
            page.setMediaBox(0, height - contentHeight, width, contentHeight);
          }
          const cropped = await doc.save();
          return Buffer.from(cropped);
        } catch (e: any) {
          console.warn(`[print-receipt] Failed to crop PDF, returning original:`, e.message);
          return pdfBuffer;
        }
      };

      const validatePdfNotEmpty = async (pdfBuffer: Buffer): Promise<boolean> => {
        try {
          if (pdfBuffer.length < 500) {
            console.warn(`[print-receipt] PDF too small (${pdfBuffer.length} bytes) — likely empty`);
            return false;
          }
          const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
          const pages = doc.getPages();
          if (pages.length === 0) {
            console.warn(`[print-receipt] PDF has 0 pages — empty`);
            return false;
          }
          for (const page of pages) {
            const ops = page.node.normalizedEntries();
            const contents = ops.Contents;
            if (contents) {
              const contentRef = contents.toString();
              if (contentRef && contentRef.length > 20) return true;
            }
          }
          const pdfString = pdfBuffer.toString('ascii');
          const streamCount = (pdfString.match(/stream\r?\n/g) || []).length;
          const endstreamCount = (pdfString.match(/endstream/g) || []).length;
          if (streamCount > 1 && endstreamCount > 1) return true;
          console.warn(`[print-receipt] PDF appears to have no meaningful content (${pages.length} pages, ${streamCount} streams, ${pdfBuffer.length} bytes)`);
          return false;
        } catch (e: any) {
          console.warn(`[print-receipt] PDF validation error (allowing through): ${e.message}`);
          return true;
        }
      };

      if (receiptIds.length === 1) {
        const payload = buildPrintReceiptPayload(receiptIds, receiptNos, isReprint);
        console.log(`[print-receipt] Single receipt payload:`, JSON.stringify(payload));
        const pdfRes = await fetch(`${apiUrl}/api/billing-payment/print-receipt`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/pdf,application/octet-stream,*/*",
          },
          body: JSON.stringify(payload),
        });

        if (!pdfRes.ok) {
          const errorText = await pdfRes.text().catch((err) => { console.error('[print-receipt] Failed to read error response text:', err); return ""; });
          console.error(`[print-receipt] Platinum returned ${pdfRes.status}: ${errorText}`);
          return res.status(pdfRes.status).json({ message: "Failed to fetch receipt PDF from Platinum", detail: errorText });
        }

        const rawBuffer = Buffer.from(await pdfRes.arrayBuffer());

        const isNotEmpty = await validatePdfNotEmpty(rawBuffer);
        if (!isNotEmpty) {
          return res.status(409).json({ 
            message: "Empty receipt PDF returned by billing system", 
            detail: `The billing system returned a blank PDF for receipt ${receiptNos.join(', ') || receiptIds.join(', ')}. This receipt may not be available for reprinting.`,
            emptyReceipt: true
          });
        }

        const pdfBuffer = await cropReceiptPages(rawBuffer);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="receipt_${receiptIds[0]}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
      }

      console.log(`[print-receipt] Fetching ${receiptIds.length} receipts individually for proper page breaks`);

      const BATCH_SIZE = 10;
      const allPdfBuffers: Buffer[] = [];
      for (let i = 0; i < receiptIds.length; i += BATCH_SIZE) {
        const batch = receiptIds.slice(i, i + BATCH_SIZE).map(Number);
        const batchNos = receiptNos.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map((id, idx) => fetchSingleReceiptPdf(id, batchNos[idx])));
        for (const buf of results) {
          if (buf && buf.length > 100) allPdfBuffers.push(buf);
        }
      }

      if (allPdfBuffers.length === 0) {
        console.log(`[print-receipt] No individual PDFs fetched, falling back to bulk request`);
        const bulkPayload = buildPrintReceiptPayload(receiptIds, receiptNos, isReprint);
        console.log(`[print-receipt] Bulk fallback payload:`, JSON.stringify(bulkPayload));
        const pdfRes = await fetch(`${apiUrl}/api/billing-payment/print-receipt`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/pdf,application/octet-stream,*/*",
          },
          body: JSON.stringify(bulkPayload),
        });
        if (!pdfRes.ok) {
          const errorText = await pdfRes.text().catch((err) => { console.error('[print-receipt] Failed to read error response text:', err); return ""; });
          return res.status(pdfRes.status).json({ message: "Failed to fetch receipt PDF", detail: errorText });
        }
        const rawBuf = Buffer.from(await pdfRes.arrayBuffer());
        const pdfBuffer = await cropReceiptPages(rawBuf);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="receipts_${receiptIds.length}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
      }

      const mergedPdf = await PDFDocument.create();
      for (const buf of allPdfBuffers) {
        try {
          const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
          const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
          for (const page of pages) {
            const { width, height } = page.getSize();
            const contentHeight = Math.min(height, Math.ceil(height * 0.58));
            page.setCropBox(0, height - contentHeight, width, contentHeight);
            page.setMediaBox(0, height - contentHeight, width, contentHeight);
            mergedPdf.addPage(page);
          }
        } catch (mergeErr: any) {
          console.warn(`[print-receipt] Failed to merge a receipt PDF:`, mergeErr.message);
        }
      }

      const mergedBytes = await mergedPdf.save();
      const mergedBuffer = Buffer.from(mergedBytes);
      console.log(`[print-receipt] Merged ${allPdfBuffers.length} receipt PDFs into ${mergedBuffer.length} bytes (${mergedPdf.getPageCount()} pages)`);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="receipts_${receiptIds.length}.pdf"`);
      res.setHeader("Content-Length", mergedBuffer.length);
      return res.send(mergedBuffer);
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
        body: JSON.stringify({ Ids: [Number(receiptId)], ReceiptNos: [], IsReprint: true }),
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
        params.CapturerId = String(cashierVal);
      }
      if (body.accountNumber || body.AccountNumber) params.AccountNumber = body.accountNumber || body.AccountNumber;
      if (body.receiptNo || body.ReceiptNo) params.ReceiptNo = body.receiptNo || body.ReceiptNo;

      const isAllCashiers = String(cashierVal) === '0';
      console.log(`[get-receipt-list] Request params:`, JSON.stringify(params), `isAllCashiers=${isAllCashiers}`);

      let data: any;

      console.log(`[get-receipt-list] GET with CapturerId=${params.CapturerId || '(not set)'}`);
      data = await platinumGet(session, "/api/ViewReceipt/get-receipt-list", params, { timeoutMs: 90000 });
      console.log(`[get-receipt-list] Result: type=${typeof data}, isArray=${Array.isArray(data)}, keys=${data && typeof data === 'object' ? Object.keys(data).join(',') : 'N/A'}, first500=${JSON.stringify(data).substring(0, 500)}`);

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
      const finYear = session.userData?.finYear;
      if (!finYear) {
        return res.status(400).json({ message: "Financial year missing from session. Please log in again." });
      }
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

      // Probe 8: Try pos-multi-receipt-print with known receipt IDs from Platinum
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
      const queryParams = req.query as Record<string, string>;
      console.log(`[print-misc-receipt] Params: ${JSON.stringify(queryParams)}, Body keys: ${Object.keys(req.body || {}).join(', ')}`);
      const data = await platinumPost(session, "/api/billing-payment/print-miscellaneous-receipt", req.body, queryParams);
      console.log(`[print-misc-receipt] Response:`, JSON.stringify(data)?.substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[print-misc-receipt] Error:`, e.message);
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
          console.warn(`[cashier-payment-options] All ${normalized.length} payment options returned tickedFlag=False from Platinum API. Treating all as enabled since options exist for this cashier.`);
          normalized.forEach((opt: any) => {
            opt.isTicked = true;
            opt.enabled = true;
          });
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
          console.warn(`[cashier-payment-types] All ${normalized.length} payment types returned tickedFlag=False from Platinum API. Treating all as enabled since types exist for this cashier.`);
          normalized.forEach((t: any) => {
            t.isTicked = true;
            t.enabled = true;
          });
        }

        console.log(`[cashier-payment-types] Returning ${normalized.length} types from Platinum API (anyEnabled=${anyEnabled}, officeOnly=${officeOnly})`);
        return res.json({ source: officeOnly === 'true' ? "office" : "platinum", data: normalized });
      }

      console.warn(`[cashier-payment-types] Platinum billing-payment/payment-types returned error. Response:`, JSON.stringify(data).substring(0, 500));
      return res.status(502).json({ message: "Platinum API returned no payment types data", detail: JSON.stringify(data).substring(0, 500) });
    } catch (e: any) {
      console.error(`[cashier-payment-types] Error:`, e.message);
      return res.status(502).json({ message: "Failed to fetch cashier payment types", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-clearance/get-banks", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const endpoints = [
        "/api/billing-payment-clearance/get-banks",
        "/api/BillingEnquiry/GetConstBanks",
        "/api/const-banks",
      ];
      for (const endpoint of endpoints) {
        try {
          const data = await platinumGet(session, endpoint);
          if (data && !data._error) {
            console.log(`[get-banks] Success via ${endpoint} — returned ${Array.isArray(data) ? data.length : 'non-array'} items`);
            return handlePlatinumResult(res, data);
          }
          console.warn(`[get-banks] ${endpoint} returned error:`, JSON.stringify(data).substring(0, 200));
        } catch (endpointErr: any) {
          console.warn(`[get-banks] ${endpoint} failed:`, endpointErr.message);
        }
      }
      console.error('[get-banks] All Platinum bank endpoints failed.');
      res.status(502).json({ message: "All Platinum bank endpoints returned errors", detail: "Tried: billing-payment-clearance/get-banks, BillingEnquiry/GetConstBanks, const-banks" });
    } catch (e: any) {
      console.error('[get-banks] Platinum API unreachable:', e.message);
      res.status(502).json({ message: "Failed to fetch banks list", detail: e.message });
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

  let clearanceScanSession: UserSession | null = null;

  app.get("/api/platinum/billing-payment-clearance/debug-batch-test", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      clearanceScanSession = session;
      const idsParam = req.query.ids as string || '';
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length === 0) return res.json({ error: 'Pass ?ids=1,2,3,...' });
      
      const results: any[] = [];
      for (const id of ids.slice(0, 20)) {
        const paddedId = id.padStart(12, '0');
        try {
          const [dataResult, accountsResult] = await Promise.all([
            platinumPost(session, "/api/billing-payment-clearance/get-clearance-data", { clearanceId: paddedId }).catch((e: any) => ({ _error: true, msg: e.message })),
            platinumPost(session, "/api/billing-payment-clearance/get-accounts-for-clearance", { clearanceId: paddedId, userId: -1 }).catch((e: any) => ({ _error: true, msg: e.message })),
          ]);
          const dataItems = (dataResult as any)?.items || [];
          const accountItems = (accountsResult as any)?.items || accountsResult || [];
          const hasData = dataItems.length > 0;
          const hasAccounts = Array.isArray(accountItems) && accountItems.length > 0 && !(accountsResult as any)?._error;
          const status = dataItems[0]?.status || '';
          const totalDue = Array.isArray(accountItems) ? accountItems.reduce((s: number, a: any) => s + (a.amount || a.paymentAmount || 0), 0) : 0;
          results.push({ id: paddedId, hasData, hasAccounts, status, accountCount: hasAccounts ? accountItems.length : 0, totalDue, dataItemCount: dataItems.length, error: (accountsResult as any)?._error ? (accountsResult as any).msg : null });
        } catch (e: any) {
          results.push({ id: paddedId, error: e.message });
        }
      }
      console.log(`[clearance-batch-test] Results:`, JSON.stringify(results));
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-clearance/trigger-scan", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const userId = session.userData?.user_ID || 209;
      
      const testIds = [1, 5, 10, 30, 50, 100, 200, 300, 301, 302, 303, 305, 310, 350, 400, 500, 785, 800, 900, 1000, 1032, 1100, 1200, 1300, 1301, 1302, 1303, 1304, 1305, 1350, 1400, 1500, 1600, 1700, 1800, 1900, 1950];
      
      console.log(`[CLEARANCE-SCAN] Testing ${testIds.length} clearance IDs with userId=${userId}...`);
      const results: any[] = [];
      
      for (const num of testIds) {
        const paddedId = String(num).padStart(12, '0');
        try {
          const dataResult = await platinumPost(session, "/api/billing-payment-clearance/get-clearance-data", { clearanceId: paddedId }).catch((e: any) => ({ _error: true, msg: e.message }));
          const dataItems = (dataResult as any)?.items || [];
          
          let acctResultMinus1: any = null;
          let acctResultUser: any = null;
          
          acctResultMinus1 = await platinumPost(session, "/api/billing-payment-clearance/get-accounts-for-clearance", { clearanceId: paddedId, userId: -1 }).catch((e: any) => ({ _error: true, status: 500, msg: e.message }));
          acctResultUser = await platinumPost(session, "/api/billing-payment-clearance/get-accounts-for-clearance", { clearanceId: paddedId, userId: userId }).catch((e: any) => ({ _error: true, status: 500, msg: e.message }));

          const status = dataItems[0]?.status || '';
          const name = dataItems[0]?.name || '';
          const m1Ok = !(acctResultMinus1 as any)?._error;
          const userOk = !(acctResultUser as any)?._error;
          const m1Items = m1Ok ? ((acctResultMinus1 as any)?.items || acctResultMinus1 || []) : [];
          const userItems = userOk ? ((acctResultUser as any)?.items || acctResultUser || []) : [];
          
          console.log(`[CLEARANCE-SCAN] ${paddedId}: data=${dataItems.length} items, status="${status}", name="${name}", accts(userId=-1)=${m1Ok ? (Array.isArray(m1Items) ? m1Items.length : '?') : 'ERR'}, accts(userId=${userId})=${userOk ? (Array.isArray(userItems) ? userItems.length : '?') : 'ERR'}`);
          
          results.push({ id: paddedId, hasData: dataItems.length > 0, status, name, acctsM1: m1Ok ? (Array.isArray(m1Items) ? m1Items.length : 0) : 'ERR', acctsUser: userOk ? (Array.isArray(userItems) ? userItems.length : 0) : 'ERR' });
        } catch (e: any) {
          console.log(`[CLEARANCE-SCAN] ${paddedId}: ERROR ${e.message}`);
          results.push({ id: paddedId, error: e.message });
        }
      }
      
      console.log(`[CLEARANCE-SCAN] ========== COMPLETE ==========`);
      const withData = results.filter((r: any) => r.hasData);
      console.log(`[CLEARANCE-SCAN] ${withData.length}/${results.length} had clearance data`);
      withData.forEach(r => console.log(`[CLEARANCE-SCAN]   ${r.id} | ${r.status} | ${r.name} | m1=${r.acctsM1} | user=${r.acctsUser}`));
      console.log(`[CLEARANCE-SCAN] ========== END ==========`);
      
      res.json(results);
    } catch (e: any) {
      console.error(`[CLEARANCE-SCAN] Error:`, e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
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

      const clrBody = req.body;
      const clrDedupKey = `clearance|${clrBody.userId || 'u'}|${clrBody.clearance_ID || clrBody.clearanceId || 'c'}|${clrBody.paidAmount || clrBody.totalAmount || 0}|${clrBody.paymentTypeId || 0}`;
      const clrDedupCheck = checkPaymentDedup(clrDedupKey);
      if (clrDedupCheck.isDuplicate) {
        console.warn(`[clearance-submit] DUPLICATE BLOCKED — same clearance payment within ${PAYMENT_DEDUP_WINDOW_MS/1000}s window. Key: ${clrDedupKey}`);
        res.json(clrDedupCheck.cachedResponse);
        return;
      }

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
        recordPaymentSubmission(clrDedupKey, data);
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
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[get-scoa-items] Sample item keys:`, Object.keys(data[0]), `First item:`, JSON.stringify(data[0]));
      }
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-payment-miscellaneous/get-vat-rate", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-payment-miscellaneous/get-vat-rate");
      console.log(`[get-vat-rate] Response:`, JSON.stringify(data));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-miscellaneous/submit", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const miscBody = req.body;

      if (!miscBody.userId) {
        return res.status(400).json({ message: "userId is required for misc payment submission" });
      }
      if (!miscBody.miscellaneousPaymentGroup && miscBody.miscellaneousPaymentGroup !== 0) {
        return res.status(400).json({ message: "miscellaneousPaymentGroup is required" });
      }
      if (!miscBody.scoaItem && miscBody.scoaItem !== 0) {
        return res.status(400).json({ message: "scoaItem is required" });
      }
      if (miscBody.totalAmount === undefined || miscBody.totalAmount === null || miscBody.totalAmount <= 0) {
        return res.status(400).json({ message: "totalAmount must be greater than 0" });
      }

      const sanitizedPayload = {
        lastName: miscBody.lastName || '',
        initials: miscBody.initials || '',
        miscellaneousPaymentGroup: Number(miscBody.miscellaneousPaymentGroup),
        scoaItem: Number(miscBody.scoaItem),
        description: miscBody.description || '',
        receiptDate: miscBody.receiptDate || new Date().toISOString(),
        totalAmount: Number(miscBody.totalAmount),
        vatAmount: Number(miscBody.vatAmount ?? 0),
        amount: Number(miscBody.amount ?? miscBody.totalAmount),
        tenderAmount: Number(miscBody.tenderAmount ?? miscBody.totalAmount),
        changeAmount: Number(miscBody.changeAmount ?? 0),
        paymentType: Number(miscBody.paymentType ?? 1),
        vatPercentage: Number(miscBody.vatPercentage ?? 0),
        isVatable: Boolean(miscBody.isVatable),
        userId: Number(miscBody.userId),
        cashierId: Number(miscBody.cashierId ?? 0),
        cashOfficeId: Number(miscBody.cashOfficeId ?? 0),
        finYear: miscBody.finYear,
        cardNo: miscBody.cardNo || '',
        expiryDate: miscBody.expiryDate || '',
        chequeNo: miscBody.chequeNo || '',
        bankBranch: miscBody.bankBranch || '',
        bankBranchCode: miscBody.bankBranchCode || '',
        accHolderName: miscBody.accHolderName || '',
      };

      console.log(`[misc-submit] Sanitized payload:`, JSON.stringify(sanitizedPayload));

      const miscDedupKey = `misc|${sanitizedPayload.userId}|${sanitizedPayload.scoaItem}|${sanitizedPayload.totalAmount}|${sanitizedPayload.paymentType}`;
      const miscDedupCheck = checkPaymentDedup(miscDedupKey);
      if (miscDedupCheck.isDuplicate) {
        console.warn(`[misc-submit] DUPLICATE BLOCKED — same misc payment within ${PAYMENT_DEDUP_WINDOW_MS/1000}s window. Key: ${miscDedupKey}`);
        res.json(miscDedupCheck.cachedResponse);
        return;
      }
      const pascalPayload = {
        LastName: sanitizedPayload.lastName,
        Initials: sanitizedPayload.initials,
        MiscellaneousPaymentGroup: sanitizedPayload.miscellaneousPaymentGroup,
        ScoaItem: sanitizedPayload.scoaItem,
        Description: sanitizedPayload.description,
        ReceiptDate: sanitizedPayload.receiptDate,
        TotalAmount: sanitizedPayload.totalAmount,
        VatAmount: sanitizedPayload.vatAmount,
        Amount: sanitizedPayload.amount,
        TenderAmount: sanitizedPayload.tenderAmount,
        ChangeAmount: sanitizedPayload.changeAmount,
        PaymentType: sanitizedPayload.paymentType,
        VatPercentage: sanitizedPayload.vatPercentage,
        IsVatable: sanitizedPayload.isVatable,
        UserId: sanitizedPayload.userId,
        CashierId: sanitizedPayload.cashierId,
        CashOfficeId: sanitizedPayload.cashOfficeId,
        FinYear: sanitizedPayload.finYear,
        CardNo: sanitizedPayload.cardNo,
        ExpiryDate: sanitizedPayload.expiryDate,
        ChequeNo: sanitizedPayload.chequeNo,
        BankBranch: sanitizedPayload.bankBranch,
        BankBranchCode: sanitizedPayload.bankBranchCode,
        AccHolderName: sanitizedPayload.accHolderName,
      };

      const attempts: { endpoint: string; payload: any }[] = [
        { endpoint: `/api/billing-payment-miscellaneous/submit/${sanitizedPayload.userId}`, payload: sanitizedPayload },
        { endpoint: `/api/billing-payment-miscellaneous/submit`, payload: pascalPayload },
        { endpoint: `/api/billing-payment-miscellaneous/submit`, payload: sanitizedPayload },
      ];

      let data: any = null;
      for (const { endpoint: ep, payload: pl } of attempts) {
        data = await platinumPost(session, ep, pl);
        if (data && !data._error) {
          console.log(`[misc-submit] SUCCESS via ${ep}:`, JSON.stringify(data)?.substring(0, 1000));
          break;
        }
        console.warn(`[misc-submit] ${ep} returned error (${data?.status}):`, JSON.stringify(data)?.substring(0, 500));
      }

      recordPaymentSubmission(miscDedupKey, data);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[misc-submit] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Drop Box (Cash Drop) ---

  app.post("/api/platinum/drop-box/submit", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { amount, description, userId, finYear, paymentType } = req.body;
      console.log(`[drop-box] Submit drop — amount=${amount}, userId=${userId}, paymentType=${paymentType || 1}, description="${description}"`);

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: "Drop amount must be greater than zero" });
      }

      const now = new Date().toISOString();
      const payload = {
        lastName: description || "Cash Drop",
        initials: "",
        miscellaneousPaymentGroup: null,
        scoaItem: null,
        description: description || "Drop Box - Cash Drop",
        receiptDate: now,
        totalAmount: amount,
        vatAmount: 0,
        amount: amount,
        tenderAmount: amount,
        changeAmount: 0,
        paymentType: paymentType || 1,
        vatPercentage: 0,
        cardNo: null,
        expiryDate: null,
        isVatable: false,
        chequeNo: null,
        bankBranch: null,
        bankBranchCode: null,
        accHolderName: null,
        userId: Number(userId),
        finYear: finYear,
      };

      console.log(`[drop-box] Trying misc submit with payload:`, JSON.stringify(payload));
      const data = await platinumPost(session, "/api/billing-payment-miscellaneous/submit", payload);
      console.log(`[drop-box] Misc submit response:`, JSON.stringify(data).substring(0, 1000));

      if (data && !data._error) {
        const receiptNo = data.receiptNo || data.receipt_no || data.receiptNumber || null;
        console.log(`[drop-box] Drop box submitted successfully — receiptNo: ${receiptNo}`);
        res.json({
          success: true,
          message: "Drop box payment submitted successfully",
          receiptNo,
          amount,
          data
        });
      } else {
        console.error(`[drop-box] API error:`, JSON.stringify(data));
        res.status(400).json({
          success: false,
          message: data?.message || data?.title || "Failed to submit drop box payment",
          detail: data
        });
      }
    } catch (e: any) {
      console.error(`[drop-box] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/drop-box/list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const cashierId = req.query.cashierId as string;
      if (!cashierId) return res.status(400).json({ message: "cashierId is required" });

      console.log(`[drop-box] Fetching drop box list for cashierId=${cashierId}`);
      const pager = { page: 1, pageSize: 100 };
      const data = await platinumPost(session, "/api/billing-payment-day-end-reconcile/get-cashier-receipt-drop-box-list", pager, { id: cashierId });
      console.log(`[drop-box] List response:`, JSON.stringify(data).substring(0, 500));

      const items = Array.isArray(data) ? data : (data?.items || data?.data || data?.value || []);
      res.json({ success: true, items, total: items.length });
    } catch (e: any) {
      console.error(`[drop-box] List error:`, e.message);
      res.status(502).json({ message: "Failed to fetch drop box list", detail: e.message });
    }
  });

  // --- Billing Enquiry - Search ---

  app.post("/api/platinum/billing-enquiry/enquiry-results", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const sgNumber = req.body.sgNumber ? String(req.body.sgNumber).trim() : '';
      const erfNumber = req.body.erfNumber ? String(req.body.erfNumber).trim() : '';

      const cleanBody: Record<string, any> = {};
      for (const [k, v] of Object.entries(req.body)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
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
            const erfResult = await platinumPost(session, "/api/BillingEnquiry/EnquiryResults", { erfNumber }, undefined, { timeout: 12000 });
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
      console.log(`[enquiry-results] Search body:`, JSON.stringify(searchBody));
      const data = await platinumPost(session, "/api/BillingEnquiry/EnquiryResults", searchBody, undefined, { timeout: 15000 });
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
      const keyName = req.query.strKeyName || req.query.keyName || req.query.key;
      if (keyName) {
        let data = await platinumGet(session, "/api/BillingEnquiry/GetAAAA_ConfigSetting", { strKeyName: String(keyName) });
        if (data && data._error) {
          data = await platinumGet(session, "/api/BillingEnquiry/GetAppSetting", { key: String(keyName) });
        }
        handlePlatinumResult(res, data);
      } else {
        res.status(400).json({ message: "key query parameter is required" });
      }
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/get-config-settings-batch", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const keys = [
        "Allow Prepaid And Miscellaneous",
        "Allow Prepaid And Recovery",
        "Allow Normal Receipting",
        "AllowCashierToAllocateDirectDeposit",
        "AllowCashierToViewBillingDashboard",
        "AllowCashierToViewEnquiries",
      ];
      const results = await Promise.allSettled(
        keys.map(key => platinumGet(session, "/api/BillingEnquiry/GetAAAA_ConfigSetting", { strKeyName: key })
          .catch(() => platinumGet(session, "/api/BillingEnquiry/GetAppSetting", { key }))
        )
      );
      const settings: Array<{ keyName: string; value: any }> = [];
      keys.forEach((key, idx) => {
        const r = results[idx];
        if (r.status === 'fulfilled' && r.value && !r.value._error) {
          settings.push({ keyName: key, value: r.value });
        }
      });
      res.json(settings);
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

      if (Object.keys(settings).length === 0) {
        console.log('[Receipt Info] No settings from GetAppSetting or ConfigSetting. Trying PDF receipt header extraction...');
        try {
          const apiUrl = getPlatinumApiUrl(session);
          const token = session.token;

          const probeIds = [312979, 312980, 312978, 313000, 312950, 312900];
          let pdfExtracted = false;

          for (const receiptId of probeIds) {
            if (pdfExtracted) break;
            try {
              const pdfRes = await fetch(`${apiUrl}/api/billing-payment/print-receipt`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  Accept: 'application/pdf',
                },
                body: JSON.stringify({ Ids: [receiptId], ReceiptNos: [], IsReprint: true }),
              });

              if (pdfRes.ok) {
                const contentType = pdfRes.headers.get('content-type') || '';
                if (contentType.includes('pdf') || contentType.includes('octet')) {
                  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
                  if (pdfBuffer.length > 500) {
                    const tmpPath = `/tmp/receipt_header_${Date.now()}.pdf`;
                    try {
                      writeFileSync(tmpPath, pdfBuffer);
                      const text = execSync(`pdftotext -layout ${tmpPath} -`, { timeout: 10000 }).toString();

                      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                      const vatLine = lines.findIndex(l => /vat\s*(registration|reg\.?)\s*(number|no\.?)\s*:?\s*/i.test(l));
                      if (vatLine >= 0) {
                        const vatMatch = lines[vatLine].match(/vat\s*(?:registration|reg\.?)\s*(?:number|no\.?)\s*:?\s*(\d[\d\s/-]*\d)?/i);
                        if (vatMatch && vatMatch[1]) {
                          settings['VATRegistrationNo'] = vatMatch[1].trim();
                        }
                        const headerLines = lines.slice(0, vatLine).filter(l => l.length > 2);
                        if (headerLines.length >= 1) {
                          settings['InstitutionName'] = headerLines[0];
                        }
                        if (headerLines.length >= 2) {
                          settings['InstitutionAddress1'] = headerLines.slice(1).join(', ');
                        }
                        pdfExtracted = true;
                        console.log(`[Receipt Info] Extracted from PDF receipt ${receiptId}:`, settings);
                      }
                    } finally {
                      if (existsSync(tmpPath)) { try { unlinkSync(tmpPath); } catch {} }
                    }
                  }
                }
              }
            } catch (e: any) {
              console.warn(`[Receipt Info] PDF probe ${receiptId} failed:`, e.message);
            }
          }
        } catch (pdfErr: any) {
          console.warn('[Receipt Info] PDF header extraction failed:', pdfErr.message);
        }
      }

      console.log('[Receipt Info] Retrieved settings:', Object.keys(settings).length > 0 ? settings : '(no settings found)');
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
      const search = req.query.search || '';
      const type = req.query.type || 'accountNumber';
      console.log(`[autocomplete] search="${search}" type="${type}"`);
      const data = await platinumGet(session, "/api/BillingEnquiry/Autocomplete", req.query as Record<string, string>);
      const count = Array.isArray(data) ? data.length : (data?._error ? 'ERROR' : '?');
      console.log(`[autocomplete] Results: ${count}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.log(`[autocomplete] Error: search="${req.query.search}" type="${req.query.type}" — ${e.message}`);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Enquiry - Rebuild ---

  app.get("/api/platinum/billing-enquiry/rebuild-full-account", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const query = { ...req.query as Record<string, string> };
      delete query._nocache;
      const data = await platinumGet(session, "/api/BillingEnquiry/rebuildFullAccount", query);
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');
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
        ...(userId ? [
          { label: 'GET userId', method: 'GET' as const, path: '/api/billing-payment-day-end-reconcile/cashier-receipt-unreconciled-list', params: { id: userId } },
        ] : []),
        { label: 'GET cashierId', method: 'GET' as const, path: '/api/billing-payment-day-end-reconcile/cashier-receipt-unreconciled-list', params: { id: cashierId || userId } },
        { label: 'POST cashierId', method: 'POST' as const, path: '/api/billing-payment-day-end-reconcile/cashier-receipt-unreconciled-list', params: { id: cashierId || userId }, body: { page: 1, pageSize: 500, orderby: 'dateCaptured', shortDirection: 'desc' } },
        { label: 'GET get-prefix', method: 'GET' as const, path: '/api/billing-payment-day-end-reconcile/get-cashier-receipt-unreconciled-list', params: { id: cashierId || userId } },
        { label: 'POST get-prefix', method: 'POST' as const, path: '/api/billing-payment-day-end-reconcile/get-cashier-receipt-unreconciled-list', params: { id: cashierId || userId }, body: { page: 1, pageSize: 500, orderby: 'dateCaptured', shortDirection: 'desc' } },
        ...(userId && userId !== cashierId ? [
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
      const userId = req.query.userId as string;
      console.log(`[dayend-save] Query: userId=${userId}, Payload:`, JSON.stringify(req.body));

      const cashierId = String(req.body.cashierId || '');
      const endpoints = [
        { label: 'bp-day-end (userId+cashierId query)', path: '/api/billing-payment-day-end-reconcile/save-Reconcile-data', params: { userId, cashierId } },
        { label: 'bp-day-end (cashierId query only)', path: '/api/billing-payment-day-end-reconcile/save-Reconcile-data', params: { cashierId } },
        { label: 'bp-day-end (userId query)', path: '/api/billing-payment-day-end-reconcile/save-Reconcile-data', params: { userId } },
        { label: 'auth-day-end (userId+cashierId query)', path: '/api/billing/auth-day-end-reconcile/save-Reconcile-data', params: { userId, cashierId } },
        { label: 'auth-day-end (cashierId query only)', path: '/api/billing/auth-day-end-reconcile/save-Reconcile-data', params: { cashierId } },
        { label: 'auth-day-end (userId query)', path: '/api/billing/auth-day-end-reconcile/save-Reconcile-data', params: { userId } },
      ];

      const results: Array<{ label: string; response: any; error?: string }> = [];
      for (const ep of endpoints) {
        try {
          console.log(`[dayend-save] Trying: ${ep.label} → ${ep.path}?${new URLSearchParams(ep.params as any).toString()}`);
          const data = await platinumPost(session, ep.path, req.body, ep.params as any);
          const respStr = JSON.stringify(data).substring(0, 500);
          console.log(`[dayend-save] ${ep.label} Response: ${respStr}`);
          results.push({ label: ep.label, response: data });
        } catch (err: any) {
          console.log(`[dayend-save] ${ep.label} threw: ${err.message}`);
          results.push({ label: ep.label, response: null, error: err.message });
        }
      }

      console.log(`[dayend-save] === ALL RESULTS SUMMARY ===`);
      for (const r of results) {
        const isSuccess = r.response && !r.response._error && r.response.success !== false;
        const isError = r.response?._error === true;
        const status = isError ? `ERROR(${r.response?.status})` : (isSuccess ? 'SUCCESS' : (r.error ? `THROW(${r.error.substring(0,50)})` : 'UNKNOWN'));
        console.log(`[dayend-save] ${r.label}: ${status} — ${JSON.stringify(r.response?.message || r.response?.title || r.error || '').substring(0, 200)}`);
      }

      const validResult = results.find(r => r.response && !r.response._error && r.response.success !== false);

      if (validResult) {
        console.log(`[dayend-save] Using result from: ${validResult.label}`);

        console.log(`[dayend-save] Now verifying: calling validate-cashier to check if cashierReconcile was created...`);
        try {
          const finYear = req.body.finyear || session.userData?.finYear;
          if (!finYear) {
            console.warn('[dayend-save] Financial year missing from request and session');
          }
          const vcData = await platinumGet(session, "/api/ReceiptPrepaid/validate-cashier", { userId, finYear });
          const hasReconcile = vcData?.cashierReconcile != null;
          console.log(`[dayend-save] Post-save verify: cashierReconcile=${hasReconcile ? 'PRESENT' : 'NULL'} — ${hasReconcile ? 'DB WRITE CONFIRMED' : 'DB WRITE FAILED — record was not created!'}`);
          if (hasReconcile) {
            console.log(`[dayend-save] cashierReconcile data:`, JSON.stringify(vcData.cashierReconcile).substring(0, 500));
          }
        } catch (verifyErr: any) {
          console.log(`[dayend-save] Post-save verify failed: ${verifyErr.message}`);
        }

        handlePlatinumResult(res, validResult.response);
      } else {
        console.error(`[dayend-save] ALL endpoints failed!`);
        res.status(502).json({ message: "All save-Reconcile-data endpoints failed", results: results.map(r => ({ label: r.label, error: r.error || r.response?.message })) });
      }
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Auth Day-End Reconciliation (Supervisor) ---

  app.get("/api/platinum/auth-day-end/cash-office-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile/cash-office-list");
      console.log(`[auth-dayend-cash-office-list] Response:`, JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end/cashier-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-cashier-list] Fetching cashier list and cash office list in parallel...`);
      const [cashierData, officeData] = await Promise.all([
        platinumGet(session, "/api/billing/auth-day-end-reconcile/cashier-list"),
        platinumGet(session, "/api/billing/auth-day-end-reconcile/cash-office-list").catch((err) => { console.error('[auth-dayend-cashier-list] Failed to fetch cash office list:', err); return null; }),
      ]);
      console.log(`[auth-dayend-cashier-list] Cashier response (first 2000 chars):`, JSON.stringify(cashierData).substring(0, 2000));
      console.log(`[auth-dayend-cashier-list] Office response:`, JSON.stringify(officeData).substring(0, 500));

      if (cashierData && !cashierData._error && Array.isArray(cashierData) && cashierData.length > 0) {
        console.log(`[auth-dayend-cashier-list] FIRST CASHIER ALL KEYS:`, JSON.stringify(Object.keys(cashierData[0])));
        console.log(`[auth-dayend-cashier-list] FIRST CASHIER FULL:`, JSON.stringify(cashierData[0]));
        if (cashierData.length > 1) {
          console.log(`[auth-dayend-cashier-list] SECOND CASHIER FULL:`, JSON.stringify(cashierData[1]));
        }
      }

      const officeMap = new Map<number, { groupCashiers: boolean; cashOfficeDesc: string; cashOnHandLimit: number | null }>();
      if (officeData && !officeData._error && Array.isArray(officeData)) {
        for (const o of officeData) {
          if (o.cashOffice_ID) {
            officeMap.set(o.cashOffice_ID, {
              groupCashiers: o.groupCashiers === true,
              cashOfficeDesc: o.cashOfficeDesc || '',
              cashOnHandLimit: o.cashOnHandLimit ?? null,
            });
          }
        }
        console.log(`[auth-dayend-cashier-list] Built office map with ${officeMap.size} offices. Grouped offices: ${Array.from(officeMap.entries()).filter(([,v]) => v.groupCashiers).map(([id, v]) => `${v.cashOfficeDesc} (ID:${id})`).join(', ') || 'none'}`);
      }

      if (cashierData && !cashierData._error) {
        const cashiers = Array.isArray(cashierData) ? cashierData : [];
        
        if (cashiers.length > 0) {
          console.log(`[auth-dayend-cashier-list] Enriching ${cashiers.length} cashiers with reconcile status and active session...`);
          const [reconcileResults, detailsResults] = await Promise.all([
            Promise.allSettled(
              cashiers.map((c: any) => {
                const cid = c.id || c.cashierId || c.cashier_ID;
                if (!cid) return Promise.resolve(null);
                return platinumGet(session, "/api/billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid", { cashierId: String(cid) });
              })
            ),
            Promise.allSettled(
              cashiers.map((c: any) => {
                const cid = c.id || c.cashierId || c.cashier_ID;
                if (!cid) return Promise.resolve(null);
                return platinumGet(session, "/api/ReceiptPrepaid/cashier-detailsById", { cashierId: String(cid) });
              })
            ),
          ]);
          
          for (let i = 0; i < cashiers.length; i++) {
            const detailResult = detailsResults[i];
            if (detailResult.status === 'fulfilled' && detailResult.value && !detailResult.value._error) {
              const det = detailResult.value;
              cashiers[i].isActive = det.isActive === true;
              cashiers[i].officeId = det.officeId || det.cashOfficeId || cashiers[i].officeId;
              cashiers[i].userId = det.user_Id || det.userId || cashiers[i].userId;
            } else {
              cashiers[i].isActive = false;
            }

            const result = reconcileResults[i];
            if (result.status === 'fulfilled' && result.value && !result.value._error) {
              const rec = result.value;
              if (i < 3) {
                console.log(`[auth-dayend-cashier-list] Cashier #${i} reconcile RAW KEYS:`, JSON.stringify(Object.keys(rec)));
                console.log(`[auth-dayend-cashier-list] Cashier #${i} reconcile RAW DATA:`, JSON.stringify(rec).substring(0, 1000));
              }
              const hasReconcile = rec.id || rec.reconcileId || rec.cashierReconcile_ID;
              if (hasReconcile) {
                cashiers[i].reconcileId = rec.id || rec.reconcileId || rec.cashierReconcile_ID;
                cashiers[i].reconcileStatus = rec.status || rec.reconcileStatus || rec.dayEndStatus || 'Submitted';
                cashiers[i].returnReason = rec.returnReason || rec.reason || rec.returnedReason || rec.comments || null;
                cashiers[i].reconcileDate = rec.reconcileDate || rec.dateCaptured || rec.dateModified || null;
                cashiers[i].totalAmount = rec.totalAmount || rec.systemTotal || rec.total || cashiers[i].totalAmount || 0;
                cashiers[i].transactionCount = rec.transactionCount || rec.receiptCount || cashiers[i].transactionCount || 0;
                cashiers[i].cashAmount = rec.cashAmount || rec.totalCashAmt || cashiers[i].cashAmount || 0;
                cashiers[i].cardAmount = rec.cardAmount || rec.totalCreditAmt || cashiers[i].cardAmount || 0;
                cashiers[i].declaredTotal = rec.declaredTotal || rec.cashierTotal || rec.totalDeclared || 0;
                cashiers[i].variance = rec.variance || rec.varianceAmount || rec.totalVariance || 0;
                console.log(`[auth-dayend-cashier-list] Cashier ${cashiers[i].name || cashiers[i].id}: active=${cashiers[i].isActive}, reconcileId=${hasReconcile}, status="${cashiers[i].reconcileStatus}", totalAmount=${cashiers[i].totalAmount}, txCount=${cashiers[i].transactionCount}`);
              } else {
                cashiers[i].reconcileStatus = 'Not Submitted';
                console.log(`[auth-dayend-cashier-list] Cashier ${cashiers[i].name || cashiers[i].id}: active=${cashiers[i].isActive}, no reconcile record — Not Submitted`);
              }
            } else {
              cashiers[i].reconcileStatus = 'Not Submitted';
              const errDetail = result.status === 'rejected' ? result.reason?.message : (result.value?._error || 'empty');
              console.log(`[auth-dayend-cashier-list] Cashier ${cashiers[i].name || cashiers[i].id}: active=${cashiers[i].isActive}, reconcile lookup failed (${errDetail}) — Not Submitted`);
            }
          }
        }
        
        const enriched = {
          cashiers: cashiers,
          offices: Object.fromEntries(Array.from(officeMap.entries()).map(([id, data]) => [String(id), data])),
        };
        return res.json(enriched);
      }

      handlePlatinumResult(res, cashierData);
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

  app.get("/api/platinum/auth-day-end/cashbook-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile/cashbook-list");
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
      if (!data?._error && data?.isSuccess !== false) {
        const requestCashierId = Number(req.query.cashierId || 0);
        const sessionCashierId = await getSessionPosCashierId(session);
        if (requestCashierId === sessionCashierId && sessionCashierId && sessionCashierId > 0) {
          session.dayEndPending = true;
          console.log(`[auth-dayend-submit] Marked session.dayEndPending=true (own cashier session)`);
        } else {
          console.log(`[auth-dayend-submit] Skipping dayEndPending — request cashierId=${requestCashierId} != session cashierId=${sessionCashierId} (supervisor approving for another cashier)`);
        }
      } else {
        console.warn(`[auth-dayend-submit] API returned error/failure — NOT setting dayEndPending`);
      }
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

  app.post("/api/platinum/auth-day-end/cancel-day-auth-reconcile-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[auth-dayend-direct-cancel] Body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile/cancel-day-auth-reconcile-receipt", req.body);
      console.log(`[auth-dayend-direct-cancel] Response:`, JSON.stringify(data).substring(0, 500));
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

  // --- Auth Day-End Reconciliation Per Office (GroupCashiers = true) ---

  app.get("/api/platinum/auth-day-end-per-office/cash-office-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile-per-office/cash-office-list");
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end-per-office/cash-office-selection", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile-per-office/cash-office-selection", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end-per-office/cashier-summary-by-office", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile-per-office/cashier-summary-by-office", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/auth-day-end-per-office/cashier-reconcile-status", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing/auth-day-end-reconcile-per-office/cashier-reconcile-status", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end-per-office/process-staging-payments", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const qs = req.query.cashOfficeId ? `?cashOfficeId=${req.query.cashOfficeId}` : '';
      const data = await platinumPost(session, `/api/billing/auth-day-end-reconcile-per-office/process-staging-payments${qs}`, {});
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end-per-office/add-stage", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile-per-office/add-stage", {});
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end-per-office/verify-cashier-reconcile", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile-per-office/verify-cashier-reconcile", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end-per-office/submit-reconcile-per-office", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile-per-office/submit-reconcile-per-office", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end-per-office/finish-stage", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile-per-office/finish-stage", {});
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end-per-office/cancel-day-auth-reconcile-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile-per-office/cancel-day-auth-reconcile-receipt", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end-per-office/return-day-end-reconcile", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile-per-office/return-day-end-reconcile", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end-per-office/print-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile-per-office/print-receipt", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end-per-office/print-cash-report", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile-per-office/print-cash-report", req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/auth-day-end-per-office/print-deposit-slip", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumPost(session, "/api/billing/auth-day-end-reconcile-per-office/print-deposit-slip", req.body);
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
          } catch (err) { console.error('[POS Item Notes] Failed to fetch note for posItemId:', err); }
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
      const finYear = session.userData?.finYear || (session as any).platinumUser?.finYear;
      if (!finYear) {
        return res.status(400).json({ message: "Financial year missing from session." });
      }

      const batchSize = 3;
      const limited = eftReceipts.slice(0, 20);
      for (let i = 0; i < limited.length; i += batchSize) {
        const batch = limited.slice(i, i + batchSize);
        const promises = batch.map(async (r: any) => {
          const receiptNo = r.receiptNo;
          if (!receiptNo) return;
          const receiptDate = r.receiptDate ? new Date(r.receiptDate) : new Date();
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
          } catch (err) { console.error('[Bank Notes] Failed to trace receipt:', err); }
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
      const data = await platinumGet(session, "/api/billing-direct-deposit-allocation/get-clearence-autocomplete", req.query as Record<string, string>, { timeoutMs: 8000 });
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
      console.log('[DD Prep] get-clearance-details-info — body:', JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/get-clearance-details-info", req.body, undefined, { timeout: 55000 });
      console.log('[DD Prep] get-clearance-details-info — response:', JSON.stringify(data)?.substring(0, 2000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[DD Prep] get-clearance-details-info — EXCEPTION:', e.message);
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

  app.post("/api/platinum/direct-deposit-allocation/create-virtual-session", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const serverUserId = session.userData?.user_ID;
      const finYear = req.body.financialYear || session.userData?.finYear || '2025/2026';

      let officeId = req.body.officeId || null;
      if (!officeId) {
        try {
          const vcData = await platinumGet(session, "/api/ReceiptPrepaid/validate-cashier", {
            userId: String(serverUserId),
            finYear,
          });
          if (vcData && !vcData._error) {
            officeId = vcData.cashOffice?.cashOffice_ID || vcData.cashier?.officeId || null;
          }
        } catch (e: any) {
          console.warn(`[DD Virtual] validate-cashier failed when resolving officeId:`, e.message);
        }
      }

      if (!officeId) {
        console.error(`[DD Virtual] Cannot determine officeId for virtual cashier`);
        return res.status(400).json({ success: false, message: "Cannot determine cash office. Please ensure you have an active cashier session." });
      }

      console.log(`[DD Virtual] Creating virtual cashier session — userId=${serverUserId}, officeId=${officeId}`);
      const setupPayload = {
        id: 0,
        user_Id: serverUserId,
        cashFloat: 0,
        stpPort: null,
        plesseyPort: null,
        officeId,
        isVirtual: true,
      };
      const setupResult = await platinumPost(session, "/api/ReceiptPrepaid/submit-cashier-setup", setupPayload);
      console.log(`[DD Virtual] submit-cashier-setup response:`, JSON.stringify(setupResult));

      if (setupResult?._error) {
        console.error(`[DD Virtual] Failed to create virtual session:`, setupResult._error);
        return res.status(400).json({ success: false, message: "Failed to create virtual cashier session", detail: setupResult.detail || setupResult._error });
      }

      const virtualCashierId = setupResult?.cashier?.id || setupResult?.id || null;
      if (!virtualCashierId) {
        console.error(`[DD Virtual] No cashier ID returned from setup`);
        return res.status(400).json({ success: false, message: "Virtual cashier created but no ID was returned" });
      }

      (session as any).ddVirtualCashierId = virtualCashierId;
      (session as any).ddVirtualOfficeId = officeId;
      console.log(`[DD Virtual] Virtual cashier created — cashierId=${virtualCashierId}, officeId=${officeId}, stored in session`);

      res.json({ success: true, virtualCashierId, officeId });
    } catch (e: any) {
      console.error(`[DD Virtual] EXCEPTION:`, e.message);
      res.status(502).json({ success: false, message: "Failed to create virtual cashier session", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/close-virtual-session", async (req, res) => {
    const session = requireAuth(req, res); if (!session) return;
    try {
      const virtualCashierId = (session as any).ddVirtualCashierId;
      const virtualOfficeId = (session as any).ddVirtualOfficeId;

      if (!virtualCashierId) {
        console.log(`[DD Virtual Close] No active virtual session to close`);
        return res.json({ success: true, message: "No active virtual session" });
      }

      console.log(`[DD Virtual Close] Closing virtual cashier session — cashierId=${virtualCashierId}, officeId=${virtualOfficeId}`);
      const closePayload = {
        id: virtualCashierId,
        user_Id: session.userData?.user_ID,
        officeId: virtualOfficeId,
        isVirtual: true,
        isActive: false,
      };
      const closeResult = await platinumPost(session, "/api/ReceiptPrepaid/submit-cashier-setup", closePayload);
      console.log(`[DD Virtual Close] Response:`, JSON.stringify(closeResult));

      (session as any).ddVirtualCashierId = null;
      (session as any).ddVirtualOfficeId = null;

      if (closeResult?._error) {
        console.warn(`[DD Virtual Close] API returned error (session cleared anyway):`, closeResult._error);
        return res.json({ success: true, message: "Virtual session cleared from server (API close may have failed)", detail: closeResult._error });
      }

      res.json({ success: true, message: "Virtual cashier session closed" });
    } catch (e: any) {
      (session as any).ddVirtualCashierId = null;
      (session as any).ddVirtualOfficeId = null;
      console.error(`[DD Virtual Close] EXCEPTION (session cleared anyway):`, e.message);
      res.json({ success: true, message: "Virtual session cleared from server (API close failed)", detail: e.message });
    }
  });

  interface DDBatchLineResult {
    lineIndex: number;
    accountNo: string;
    allocationType: string;
    amount: number;
    status: 'SUCCESS' | 'FAILED';
    error?: string;
    apiResponse?: any;
  }

  interface DDBatchJob {
    jobId: string;
    posItemId: number;
    status: 'PROCESSING' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';
    totalLines: number;
    completedLines: number;
    failedLines: number;
    currentLine: string;
    results: DDBatchLineResult[];
    errors: string[];
    createdAt: number;
  }

  const ddBatchJobs = new Map<string, DDBatchJob>();

  setInterval(() => {
    const ONE_HOUR = 60 * 60 * 1000;
    const STALE_PROCESSING_TIMEOUT = 15 * 60 * 1000;
    const now = Date.now();
    for (const [jobId, job] of ddBatchJobs.entries()) {
      if (job.status === 'PROCESSING' && now - job.createdAt > STALE_PROCESSING_TIMEOUT) {
        job.status = 'FAILED';
        job.currentLine = 'Job timed out (stale processing)';
        job.errors.push('Server-side processing exceeded maximum time limit');
        console.warn(`[DD Batch] Marked stale job ${jobId} as FAILED`);
      }
      if (now - job.createdAt > ONE_HOUR && job.status !== 'PROCESSING') {
        ddBatchJobs.delete(jobId);
      }
    }
  }, 10 * 60 * 1000);

  app.post("/api/dd-allocation/submit-batch", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { posItemId, reconId, financialYear, transactionDate, transactionNote, lines } = req.body;

      if (!posItemId || !reconId || !financialYear || !transactionDate || !Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ message: "Missing required fields: posItemId, reconId, financialYear, transactionDate, lines" });
      }

      const serverUserId = session.userData?.user_ID;
      if (!serverUserId || serverUserId <= 0) {
        return res.status(400).json({ message: "Could not determine user ID from session." });
      }

      const jobId = `dd-${posItemId}-${Date.now()}`;

      for (const [, existingJob] of ddBatchJobs.entries()) {
        if (existingJob.posItemId === posItemId && existingJob.status === 'PROCESSING') {
          return res.status(409).json({
            message: "A batch job for this POS item is already being processed.",
            jobId: existingJob.jobId,
          });
        }
      }

      const job: DDBatchJob = {
        jobId,
        posItemId,
        status: 'PROCESSING',
        totalLines: lines.filter((l: any) => l.allocationType !== 'CASHBOOK' && l.accountNo !== 'CASHBOOK-RTN').length,
        completedLines: 0,
        failedLines: 0,
        currentLine: 'Starting...',
        results: [],
        errors: [],
        createdAt: Date.now(),
      };
      ddBatchJobs.set(jobId, job);

      let token: string;
      let apiUrl: string;
      try {
        token = await refreshSessionToken(session);
        apiUrl = getPlatinumApiUrl(session);
      } catch (e: any) {
        job.status = 'FAILED';
        job.currentLine = 'Failed to initialize session';
        job.errors.push(`Session error: ${e.message}`);
        return res.status(500).json({ message: "Failed to initialize session for batch processing", detail: e.message });
      }

      res.json({ jobId, message: "Batch job started. Poll /api/dd-allocation/job/:jobId for progress." });

      const submitUrl = `${apiUrl}/api/billing-direct-deposit-allocation/submit-details-data`;

      const processBatch = async () => {
        try {
          const ALLOC_TYPE_ORDER: Record<string, number> = {
            'ACCOUNT': 1, 'PREPAID': 1, 'GROUP': 2, 'CLEARANCE': 3, 'DIRECT': 4, 'CASHBOOK': 5,
          };
          const sortedLines = [...lines].sort((a: any, b: any) => {
            return (ALLOC_TYPE_ORDER[a.allocationType || 'ACCOUNT'] || 99) - (ALLOC_TYPE_ORDER[b.allocationType || 'ACCOUNT'] || 99);
          });

          const submitLine = async (submitData: any, authToken: string): Promise<{ rawRes: any; responseText: string }> => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 55000);
            const rawRes = await fetch(submitUrl, {
              method: "POST",
              headers: { "Authorization": `Bearer ${authToken}`, "Accept": "*/*", "Content-Type": "application/json" },
              body: JSON.stringify(submitData),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const responseText = await rawRes.text();
            return { rawRes, responseText };
          };

          let lineIdx = 0;
          for (const line of sortedLines) {
            if (line.accountNo === 'CASHBOOK-RTN' || line.allocationType === 'CASHBOOK') continue;
            lineIdx++;

            const allocType = line.allocationType || 'ACCOUNT';
            const lineLabel = `${allocType} ${line.accountNo || ''} (R ${Number(line.amount).toFixed(2)})`;
            job.currentLine = `Line ${lineIdx}/${job.totalLines}: ${lineLabel}`;

            let billType = '1';
            if (allocType === 'DIRECT') billType = '4';
            else if (allocType === 'CLEARANCE') billType = '6';

            const groupId = reconId;
            const actualReference = transactionNote || '';

            let derivedLastName = line.lastName || '';
            let derivedInitials = line.initials || '';
            if (!derivedLastName) {
              const nameSource = line.description || transactionNote || line.accountNo || 'Unknown';
              const cleanName = nameSource
                .replace(/\s*\(Old:.*\)$/, '')
                .replace(/&amp;/g, '&')
                .replace(/CSV Import:\s*/i, '')
                .replace(/Payment to\s*/i, '')
                .replace(/Payment Grouping:\s*/i, '')
                .trim();
              const nameParts = cleanName.split(/\s+/).filter((p: string) => p && p !== '&');
              if (nameParts.length >= 2) {
                derivedLastName = nameParts[0];
                derivedInitials = nameParts.slice(1).map((p: string) => p.charAt(0).toUpperCase()).join('');
              } else if (nameParts.length === 1) {
                derivedLastName = nameParts[0];
                derivedInitials = nameParts[0].charAt(0).toUpperCase();
              }
            }
            if (!derivedLastName) derivedLastName = 'N/A';
            if (!derivedInitials) derivedInitials = 'N';

            let submitData: any;
            if (billType === '4') {
              if (!line.miscPaymentGroupId || line.miscPaymentGroupId <= 0) {
                job.failedLines++;
                job.errors.push(`${lineLabel}: miscPaymentGroupId is missing or zero`);
                job.results.push({ lineIndex: lineIdx, accountNo: line.accountNo, allocationType: allocType, amount: line.amount, status: 'FAILED', error: 'miscPaymentGroupId must be > 0' });
                continue;
              }
              submitData = {
                billType, amount: line.amount, vatAmount: line.vatAmount ?? 0, totalAmount: line.amount + (line.vatAmount ?? 0),
                paidAmount: line.amount + (line.vatAmount ?? 0), paymentTypeId: 5, posItemId, miscPaymentGroupId: line.miscPaymentGroupId,
                reconId, userId: serverUserId, financialYear, transactionDate,
                receiptDate: transactionDate, groupId, lastName: derivedLastName, initials: derivedInitials,
                description: line.description || transactionNote || '', reference: actualReference,
              };
            } else if (billType === '6') {
              const accountId = line.accountId || 0;
              const clearanceId = line.clearanceId || 0;
              if (accountId <= 0 || clearanceId <= 0) {
                job.failedLines++;
                job.errors.push(`${lineLabel}: accountId or clearanceId is missing`);
                job.results.push({ lineIndex: lineIdx, accountNo: line.accountNo, allocationType: allocType, amount: line.amount, status: 'FAILED', error: 'accountId and clearanceId required for clearance' });
                continue;
              }
              submitData = {
                billType, accountId, clearanceId, paidAmount: line.amount, paymentTypeId: 5, posItemId,
                reconId, userId: serverUserId, financialYear, transactionDate, groupId, reference: actualReference,
              };
            } else {
              const accountId = line.accountId || 0;
              if (accountId <= 0) {
                job.failedLines++;
                job.errors.push(`${lineLabel}: accountId is missing or zero`);
                job.results.push({ lineIndex: lineIdx, accountNo: line.accountNo, allocationType: allocType, amount: line.amount, status: 'FAILED', error: 'accountId must be > 0' });
                continue;
              }
              submitData = {
                billType, accountId, paidAmount: line.amount, paymentTypeId: 5, posItemId,
                reconId, userId: serverUserId, financialYear, transactionDate, groupId,
                reference: actualReference || "0", description: line.description || transactionNote || '',
              };
            }

            try {
              console.log(`[DD Batch ${jobId}] Submitting line ${lineIdx}/${job.totalLines}: ${lineLabel}`);
              let { rawRes, responseText } = await submitLine(submitData, token);

              if (rawRes.status === 401) {
                console.warn(`[DD Batch ${jobId}] Got 401, refreshing token and retrying line ${lineIdx}`);
                try {
                  token = await refreshSessionToken(session);
                  const retry = await submitLine(submitData, token);
                  rawRes = retry.rawRes;
                  responseText = retry.responseText;
                } catch (retryErr: any) {
                  console.error(`[DD Batch ${jobId}] Token refresh failed:`, retryErr?.message);
                }
              }

              console.log(`[DD Batch ${jobId}] Line ${lineIdx} HTTP ${rawRes.status}: ${responseText}`);

              let parsed: any;
              try { parsed = JSON.parse(responseText); } catch { parsed = responseText; }

              if (parsed && parsed.success === false) {
                job.failedLines++;
                const errMsg = parsed.message || `API returned success=false`;
                job.errors.push(`${lineLabel}: ${errMsg}`);
                job.results.push({ lineIndex: lineIdx, accountNo: line.accountNo, allocationType: allocType, amount: line.amount, status: 'FAILED', error: errMsg, apiResponse: parsed });
              } else if (rawRes.status >= 400) {
                job.failedLines++;
                const errMsg = typeof parsed === 'string' ? parsed : (parsed?.message || `HTTP ${rawRes.status}`);
                job.errors.push(`${lineLabel}: ${errMsg}`);
                job.results.push({ lineIndex: lineIdx, accountNo: line.accountNo, allocationType: allocType, amount: line.amount, status: 'FAILED', error: errMsg, apiResponse: parsed });
              } else {
                job.completedLines++;
                job.results.push({ lineIndex: lineIdx, accountNo: line.accountNo, allocationType: allocType, amount: line.amount, status: 'SUCCESS', apiResponse: parsed });
              }
            } catch (submitErr: any) {
              job.failedLines++;
              const errMsg = submitErr?.name === 'AbortError' ? 'Request timed out (55s)' : (submitErr?.message || 'Unknown error');
              job.errors.push(`${lineLabel}: ${errMsg}`);
              job.results.push({ lineIndex: lineIdx, accountNo: line.accountNo, allocationType: allocType, amount: line.amount, status: 'FAILED', error: errMsg });
              console.error(`[DD Batch ${jobId}] Line ${lineIdx} exception:`, submitErr?.message);
            }
          }
        } finally {
          if (job.failedLines === 0 && job.completedLines > 0) {
            job.status = 'COMPLETED';
          } else if (job.completedLines > 0 && job.failedLines > 0) {
            job.status = 'PARTIAL_FAILURE';
          } else {
            job.status = 'FAILED';
          }
          job.currentLine = job.status === 'COMPLETED' ? 'All lines processed successfully' : `Done: ${job.completedLines} succeeded, ${job.failedLines} failed`;
          console.log(`[DD Batch ${jobId}] Finished: ${job.status} (${job.completedLines}/${job.totalLines} succeeded)`);
        }
      };

      processBatch().catch((e) => {
        job.status = 'FAILED';
        job.currentLine = 'Unexpected error during processing';
        job.errors.push(`Batch processing error: ${e?.message || 'Unknown'}`);
        console.error(`[DD Batch ${jobId}] Unhandled error:`, e?.message);
      });
    } catch (e: any) {
      console.error('[DD Batch] EXCEPTION:', e.message);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to start batch job", detail: e.message });
      }
    }
  });

  app.get("/api/dd-allocation/job/:jobId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const job = ddBatchJobs.get(req.params.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found or expired" });
      }
      res.json({
        jobId: job.jobId,
        posItemId: job.posItemId,
        status: job.status,
        totalLines: job.totalLines,
        completedLines: job.completedLines,
        failedLines: job.failedLines,
        processedLines: job.completedLines + job.failedLines,
        currentLine: job.currentLine,
        results: job.results,
        errors: job.errors,
      });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch job status", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/submit-details-data", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const payload = { ...req.body };
      const serverUserId = session.userData?.user_ID;
      payload.userId = serverUserId;

      delete payload.cashierId;
      delete payload.cashOfficeId;
      delete payload.isVirtual;
      delete payload.cashFloat;
      delete payload.note;

      const token = await refreshSessionToken(session);
      const apiUrl = getPlatinumApiUrl(session);
      const url = `${apiUrl}/api/billing-direct-deposit-allocation/submit-details-data`;
      const bodyStr = JSON.stringify(payload);

      console.log(`[DD Submit] URL: ${url}`);
      console.log(`[DD Submit] userId=${serverUserId}`);
      console.log(`[DD Submit] Body: ${bodyStr}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 55000);
      try {
        const rawRes = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "*/*",
            "Content-Type": "application/json",
          },
          body: bodyStr,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const responseText = await rawRes.text();
        console.log(`[DD Submit] HTTP ${rawRes.status} ${rawRes.statusText}`);
        console.log(`[DD Submit] Response headers:`, JSON.stringify(Object.fromEntries(rawRes.headers.entries())));
        console.log(`[DD Submit] Response body: ${responseText}`);

        try {
          const data = JSON.parse(responseText);
          res.status(rawRes.status).json(data);
        } catch {
          res.status(rawRes.status).send(responseText);
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          console.error('[DD Submit] Request timed out after 55s');
          res.status(408).json({ message: "Request Timeout" });
        } else {
          throw fetchErr;
        }
      }
    } catch (e: any) {
      console.error('[DD Submit] EXCEPTION:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/test-kiran-payload", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const token = await refreshSessionToken(session);
      const apiUrl = getPlatinumApiUrl(session);
      const url = `${apiUrl}/api/billing-direct-deposit-allocation/submit-details-data`;

      const kiranPayload = {
        billType: "1",
        accountId: 20787,
        paidAmount: 56,
        paymentTypeId: 5,
        posItemId: 2876,
        reconId: 1,
        userId: 209,
        financialYear: "2025/2026",
        transactionDate: "2025-11-03T00:00:00",
        groupId: 1,
        reference: "MAGTAPE CREDIT USER 9524 SEQ/ABSA BANK Erf nr 226/16",
        description: "Du Plessis Cornelius Adriaan & Susan (Old: 1002521605)",
      };

      const bodyStr = JSON.stringify(kiranPayload);
      console.log(`[DD TEST-KIRAN] URL: ${url}`);
      console.log(`[DD TEST-KIRAN] Token (first 20): ${token?.substring(0, 20)}...`);
      console.log(`[DD TEST-KIRAN] Body (Kiran's exact payload): ${bodyStr}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 55000);
      const rawRes = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "*/*",
          "Content-Type": "application/json",
        },
        body: bodyStr,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseText = await rawRes.text();
      console.log(`[DD TEST-KIRAN] HTTP ${rawRes.status} ${rawRes.statusText}`);
      console.log(`[DD TEST-KIRAN] Response: ${responseText}`);

      try {
        const data = JSON.parse(responseText);
        res.json({ kiranPayload, apiResponse: data, httpStatus: rawRes.status });
      } catch {
        res.json({ kiranPayload, apiResponse: responseText, httpStatus: rawRes.status });
      }
    } catch (e: any) {
      console.error('[DD TEST-KIRAN] EXCEPTION:', e.message);
      res.status(502).json({ message: "Test failed", detail: e.message });
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

  app.post("/api/platinum/direct-deposit-allocation/validate-generic-import", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { payments } = req.body;
      if (!Array.isArray(payments) || payments.length === 0) {
        return res.json({ results: [], duplicates: [] });
      }

      console.log(`[Generic Import Validate] Validating ${payments.length} payment rows`);

      const accountNumbers = [...new Set(payments.map((p: any) => {
        const d = String(p.accountNumber || '').replace(/\D/g, '');
        return d.length > 0 && d.length <= 12 ? d.padStart(12, '0') : '';
      }).filter(a => a.length === 12))];
      console.log(`[Generic Import Validate] ${accountNumbers.length} unique account numbers to validate`);

      const accountMap: Record<string, { status: 'matched' | 'not_found' | 'api_error'; name: string; address: string; accountId?: number }> = {};
      let apiErrorCount = 0;
      const batchSize = 10;
      for (let i = 0; i < accountNumbers.length; i += batchSize) {
        const batch = accountNumbers.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (accNo) => {
            const stripped = accNo.replace(/^0+/, '') || '0';
            try {
              const data = await platinumPost(session, "/api/BillingEnquiry/EnquiryResults", { accountID: stripped });
              if (data && !data._error) {
                const arr = Array.isArray(data) ? data : (data.value ? (Array.isArray(data.value) ? data.value : [data.value]) : [data]);
                const match = arr.find((r: any) => {
                  const rAccNo = String(r.accountNo || r.accountNumber || r.account_ID || '').replace(/\D/g, '').padStart(12, '0');
                  return rAccNo === accNo;
                }) || arr[0];
                if (match && (match.companyName || match.name || match.ownerName || match.accountName)) {
                  return {
                    accNo,
                    status: 'matched' as const,
                    name: match.companyName || match.name || match.ownerName || match.accountName || '',
                    address: match.locationAddress || match.address || match.propertyAddress || '',
                    accountId: match.account_ID || match.id || match.accountId,
                  };
                }
              }
              if (data && data._error && (data.status === 500 || data.status === 502 || data.status === 503)) {
                return { accNo, status: 'api_error' as const, name: '', address: '' };
              }
            } catch (e) {
              return { accNo, status: 'api_error' as const, name: '', address: '' };
            }
            return { accNo, status: 'not_found' as const, name: '', address: '' };
          })
        );
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            accountMap[result.value.accNo] = result.value;
            if (result.value.status === 'api_error') apiErrorCount++;
          }
        }
      }

      if (apiErrorCount > 0) {
        console.log(`[Generic Import Validate] ${apiErrorCount}/${accountNumbers.length} accounts returned API errors (500) — marking as unverified, still submittable`);
      }

      const seenAccounts: Record<string, number[]> = {};
      const results = payments.map((p: any, idx: number) => {
        const accNo = String(p.accountNumber || '');
        const accDigits = accNo.replace(/\D/g, '');
        const normalizedAccNo = accDigits.length > 0 ? accDigits.padStart(12, '0') : accNo;
        const info = accountMap[normalizedAccNo];
        const amount = typeof p.amount === 'number' ? p.amount : parseFloat(p.amount);
        const dateValid = /^\d{2}\/\d{2}\/\d{4}$/.test(p.receiptDate || '');
        const ptId = parseInt(p.paymentTypeId) || 0;

        if (!seenAccounts[normalizedAccNo]) seenAccounts[normalizedAccNo] = [];
        seenAccounts[normalizedAccNo].push(idx);

        const formatIssues: string[] = [];
        if (accDigits.length === 0) formatIssues.push('Empty account number');
        else if (accDigits.length > 12) formatIssues.push('Account number too long (max 12 digits)');
        if (!dateValid) formatIssues.push(`Invalid date format: "${p.receiptDate}"`);
        if (isNaN(amount) || amount <= 0) formatIssues.push(`Invalid amount: ${p.amount}`);
        if (ptId < 1 || ptId > 7) formatIssues.push(`Invalid payment type: ${p.paymentTypeId}`);

        const hasFormatErrors = formatIssues.length > 0;
        const accountStatus = info?.status || 'not_found';
        const isApiError = accountStatus === 'api_error';
        const isNotFound = accountStatus === 'not_found' && !hasFormatErrors && accDigits.length > 0;

        let validationStatus: 'valid' | 'unverified' | 'invalid';
        let validationMsg = '';
        if (hasFormatErrors) {
          validationStatus = 'invalid';
          validationMsg = formatIssues.join('; ');
        } else if (accountStatus === 'matched') {
          validationStatus = 'valid';
        } else if (isApiError) {
          validationStatus = 'unverified';
          validationMsg = 'Account lookup API unavailable — will be validated on submission';
        } else {
          validationStatus = 'unverified';
          validationMsg = 'Account not confirmed — will be validated by Platinum on submission';
        }

        return {
          rowNum: p.rowNum || idx + 1,
          accountNumber: normalizedAccNo,
          amount: isNaN(amount) ? 0 : amount,
          receiptDate: p.receiptDate || '',
          paymentTypeId: p.paymentTypeId || 1,
          ownerName: info?.name || '',
          address: info?.address || '',
          accountId: info?.accountId,
          isValid: validationStatus !== 'invalid',
          validationStatus,
          validationMsg,
          isDuplicate: false,
        };
      });

      const duplicateAccounts: string[] = [];
      for (const [accNo, indices] of Object.entries(seenAccounts)) {
        if (indices.length > 1) {
          duplicateAccounts.push(accNo);
          for (const idx of indices) {
            if (results[idx]) {
              results[idx].isDuplicate = true;
            }
          }
        }
      }

      const validCount = results.filter((r: any) => r.validationStatus === 'valid').length;
      const unverifiedCount = results.filter((r: any) => r.validationStatus === 'unverified').length;
      const invalidCount = results.filter((r: any) => r.validationStatus === 'invalid').length;
      const submittableCount = results.filter((r: any) => r.isValid).length;
      const totalAmount = results.filter((r: any) => r.isValid).reduce((s: number, r: any) => s + r.amount, 0);
      console.log(`[Generic Import Validate] Results: ${validCount} matched, ${unverifiedCount} unverified, ${invalidCount} invalid, ${submittableCount} submittable, ${duplicateAccounts.length} duplicate accounts, total R${totalAmount.toFixed(2)}`);

      res.json({ results, duplicates: duplicateAccounts, validCount, unverifiedCount, invalidCount, submittableCount, totalAmount });
    } catch (e: any) {
      console.error('[Generic Import Validate] Error:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/submit-generic-import", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { cashOfficeId, cashierId, finYear, postToCashbook, payments } = req.body;

      if (!cashOfficeId || !cashierId || !finYear) {
        return res.status(400).json({ message: "Missing required fields", detail: `cashOfficeId=${cashOfficeId}, cashierId=${cashierId}, finYear=${finYear}` });
      }
      if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ message: "No payments to process", detail: "The payments array is empty." });
      }

      const sanitizedPayments = payments.map((p: any) => {
        const digits = String(p.accountNumber || '').replace(/\D/g, '');
        const accNo = digits.length > 0 && digits.length <= 12 ? digits.padStart(12, '0') : '';
        let receiptDate = String(p.receiptDate || '');
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(receiptDate)) {
          const now = new Date();
          receiptDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        }
        const amount = typeof p.amount === 'number' ? Math.round(p.amount * 100) / 100 : parseFloat(p.amount) || 0;
        const ptId = parseInt(p.paymentTypeId) || 0;
        const paymentTypeId = ptId >= 1 && ptId <= 7 ? ptId : 1;
        return { receiptDate, accountNumber: accNo, amount, paymentTypeId };
      }).filter((p: any) => p.amount > 0 && p.accountNumber.length === 12);

      if (sanitizedPayments.length === 0) {
        return res.status(400).json({ message: "No valid payments after sanitization", detail: "All payments were filtered out during validation." });
      }

      const serverUserId = session.userData?.user_ID;
      if (!serverUserId) {
        return res.status(401).json({ message: "User identity not available in session. Please log in again." });
      }
      const payload = {
        cashOfficeId: Number(cashOfficeId),
        cashierId: Number(cashierId),
        userId: Number(serverUserId),
        finYear: String(finYear),
        postToCashbook: postToCashbook ?? false,
        payments: sanitizedPayments,
      };

      console.log(`[Generic Import] Submit request — userId=${payload.userId}, cashOfficeId=${payload.cashOfficeId}, cashierId=${payload.cashierId}, finYear=${payload.finYear}, postToCashbook=${payload.postToCashbook}, payments=${payload.payments.length} rows`);
      console.log(`[Generic Import] First payment:`, JSON.stringify(payload.payments[0]));
      if (payload.payments.length > 1) {
        console.log(`[Generic Import] Last payment:`, JSON.stringify(payload.payments[payload.payments.length - 1]));
      }
      const totalAmount = payload.payments.reduce((s: number, p: any) => s + p.amount, 0);
      console.log(`[Generic Import] Total amount: R${totalAmount.toFixed(2)}, payment count: ${payload.payments.length}`);

      const timeoutMs = Math.max(55000, payload.payments.length * 3000);
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/submit-generic-import", payload, undefined, { timeout: timeoutMs });
      console.log('[Generic Import] Submit response:', data?._error ? `ERROR: ${JSON.stringify(data)}` : JSON.stringify(data).substring(0, 500));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[Generic Import] Submit EXCEPTION:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/generic-import-status/:jobId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/billing-direct-deposit-allocation/generic-import-status/${req.params.jobId}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[Generic Import] Status EXCEPTION:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/generic-import-results/:jobId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/billing-direct-deposit-allocation/generic-import-results/${req.params.jobId}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[Generic Import] Results EXCEPTION:', e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/direct-deposit-allocation/generic-import-errors/:jobId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/billing-direct-deposit-allocation/generic-import-errors/${req.params.jobId}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error('[Generic Import] Errors EXCEPTION:', e.message);
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
      console.log(`[dd-bulk-unprocessed] Request body:`, JSON.stringify(req.body));
      const data = await platinumPost(session, "/api/billing/direct-deposit-bulk-allocation/get-unprocessed-direct-deposits", req.body);
      console.log(`[dd-bulk-unprocessed] Response type: ${typeof data}, isArray: ${Array.isArray(data)}, keys: ${data && typeof data === 'object' ? Object.keys(data).join(', ') : 'N/A'}`);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        console.log(`[dd-bulk-unprocessed] Response shape: totalCount=${(data as any).totalCount}, first-level array keys:`, Object.entries(data).filter(([,v]) => Array.isArray(v)).map(([k, v]) => `${k}(${(v as any[]).length})`).join(', '));
      }
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  function transformBulkBatchForApi(batch: any) {
    if (!batch || typeof batch !== 'object') return batch;
    const transformed = { ...batch };
    if ('billingAllocated' in transformed && typeof transformed.billingAllocated === 'number') {
      transformed.billingAllocated = transformed.billingAllocated > 0;
    }
    if (Array.isArray(transformed.items)) {
      transformed.items = transformed.items.map((item: any) => {
        if (!item || typeof item !== 'object') return item;
        const ti = { ...item };
        if ('billingAllocated' in ti && typeof ti.billingAllocated !== 'boolean') {
          ti.billingAllocated = !!ti.billingAllocated;
        }
        return ti;
      });
    }
    if (Array.isArray(transformed.rejectedItems)) {
      transformed.rejectedItems = transformed.rejectedItems.map((item: any) => {
        if (!item || typeof item !== 'object') return item;
        const ti = { ...item };
        if ('billingAllocated' in ti && typeof ti.billingAllocated !== 'boolean') {
          ti.billingAllocated = !!ti.billingAllocated;
        }
        return ti;
      });
    }
    return transformed;
  }

  app.post("/api/platinum/direct-deposit-bulk/get-processed", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const rawUnprocessed = req.body?.unProcessedBatches || req.body?.UnProcessedData || [];
      const rawProcessed = req.body?.processedBatches || req.body?.ProcessedData || [];
      const unprocessedBatches = (Array.isArray(rawUnprocessed) ? rawUnprocessed : rawUnprocessed?.items || []).map(transformBulkBatchForApi);
      const processedBatches = (Array.isArray(rawProcessed) ? rawProcessed : rawProcessed?.items || []).map(transformBulkBatchForApi);
      const payload = {
        UnProcessedData: { items: unprocessedBatches, totalCount: unprocessedBatches.length },
        ProcessedData: { items: processedBatches, totalCount: processedBatches.length },
      };
      console.log(`[dd-bulk-processed] Sending payload with ${unprocessedBatches.length} unprocessed, ${processedBatches.length} processed batches`);
      console.log(`[dd-bulk-processed] Sample batch billingAllocated types:`, unprocessedBatches.slice(0, 1).map((b: any) => ({ num: b.num, billingAllocated: b.billingAllocated, type: typeof b.billingAllocated })));
      const data = await platinumPost(session, "/api/billing/direct-deposit-bulk-allocation/get-processed-deposits", payload);
      console.log(`[dd-bulk-processed] Response type: ${typeof data}, isArray: ${Array.isArray(data)}, keys: ${data && typeof data === 'object' ? Object.keys(data).join(', ') : 'N/A'}`);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-bulk/reconcile", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const selectedItem = transformBulkBatchForApi(req.body?.selectedItem || req.body?.SelectedItem);
      const batchNum = selectedItem?.num || 'unknown';
      const unallocCount = selectedItem?.billingUnAllocated || 0;
      const userId = req.body?.userId || req.body?.UserId;
      const rawUnprocessed = req.body?.unProcessedBatches || req.body?.UnProcessedData || [];
      const rawProcessed = req.body?.processedBatches || req.body?.ProcessedData || [];
      const unprocessedBatches = (Array.isArray(rawUnprocessed) ? rawUnprocessed : rawUnprocessed?.items || []).map(transformBulkBatchForApi);
      const processedBatches = (Array.isArray(rawProcessed) ? rawProcessed : rawProcessed?.items || []).map(transformBulkBatchForApi);
      console.log(`[dd-bulk-reconcile] Processing batch ${batchNum} — ${unallocCount} unallocated items, userId=${userId}`);
      const payload = {
        UserId: userId,
        SelectedItem: selectedItem,
        UnProcessedData: { items: unprocessedBatches, totalCount: unprocessedBatches.length },
        ProcessedData: { items: processedBatches, totalCount: processedBatches.length },
      };
      console.log(`[dd-bulk-reconcile] Payload keys: ${Object.keys(payload).join(', ')}, UnProcessedData.items: ${unprocessedBatches.length}, ProcessedData.items: ${processedBatches.length}`);
      const data = await platinumPost(session, "/api/billing/direct-deposit-bulk-allocation/reconcile-processed-data", payload);
      console.log(`[dd-bulk-reconcile] Response type: ${typeof data}, isArray: ${Array.isArray(data)}, keys: ${data && typeof data === 'object' ? Object.keys(data).join(', ') : 'N/A'}`);
      console.log(`[dd-bulk-reconcile] Response (first 2000 chars):`, JSON.stringify(data).substring(0, 2000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[dd-bulk-reconcile] FAILED:`, e.message);
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

  app.get("/api/platinum/bulk-progress/job-account-details/:jobId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, `/api/BulkProgress/job-account-details/${req.params.jobId}`);
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
      const { importId } = req.params;
      const { groupId, cashBookId, paymentReference, fileName, userId, finYear } = req.body;
      console.log(`[third-party-commit] importId=${importId}, groupId=${groupId}, cashBookId=${cashBookId}, paymentReference=${paymentReference}, fileName=${fileName}, userId=${userId}, finYear=${finYear}`);
      const data = await platinumPost(session, `/api/billing/pos/third-party-payments/${importId}/commit`, req.body);
      console.log(`[third-party-commit] response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[third-party-commit] Error:`, e.message);
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

  app.post("/api/platinum/billing-enquiry/batch-account-names", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const accountNumbers: string[] = req.body?.accountNumbers;
      if (!Array.isArray(accountNumbers) || accountNumbers.length === 0) {
        return res.json({});
      }
      const limited = accountNumbers.slice(0, 100);
      console.log(`[batch-account-names] Looking up ${limited.length} accounts`);

      const results: Record<string, { name: string; address: string }> = {};
      const batchSize = 10;
      for (let i = 0; i < limited.length; i += batchSize) {
        const batch = limited.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (accNo) => {
            const stripped = accNo.replace(/^0+/, '') || '0';
            try {
              const data = await platinumPost(session, "/api/BillingEnquiry/EnquiryResults", { accountID: stripped });
              if (data && !data._error) {
                const arr = Array.isArray(data) ? data : (data.value ? (Array.isArray(data.value) ? data.value : [data.value]) : [data]);
                const match = arr[0];
                if (match) {
                  const name = match.companyName || match.name || match.ownerName || match.accountName || '';
                  const address = match.locationAddress || match.address || match.propertyAddress || '';
                  return { accNo, name, address };
                }
              }
            } catch (e) {}
            return null;
          })
        );
        for (const r of batchResults) {
          if (r.status === 'fulfilled' && r.value) {
            results[r.value.accNo] = { name: r.value.name, address: r.value.address };
          }
        }
      }
      console.log(`[batch-account-names] Resolved ${Object.keys(results).length}/${limited.length} names`);
      res.json(results);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-enquiry/batch-balance", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const accountIds: number[] = req.body?.accountIds;
      if (!Array.isArray(accountIds) || accountIds.length === 0) {
        return res.json({});
      }
      const limited = accountIds.slice(0, 500);
      console.log(`[batch-balance] Fetching balances for ${limited.length} accounts (requested ${accountIds.length})`);

      const results: Record<string, number> = {};
      const batchSize = 10;
      for (let i = 0; i < limited.length; i += batchSize) {
        const batch = limited.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (accId) => {
            const data = await platinumGet(session, "/api/BillingEnquiry/TotalBalanceDebtInquiry", { accountId: String(accId) });
            if (data && !data._error && Array.isArray(data) && data.length > 0) {
              const total = Math.round(data.reduce((s: number, r: any) => s + (r.totalOutStanding || r.totalOutstanding || 0), 0) * 100) / 100;
              return { accId, total };
            }
            return { accId, total: 0 };
          })
        );
        for (const r of batchResults) {
          if (r.status === 'fulfilled') {
            results[String(r.value.accId)] = r.value.total;
          }
        }
      }
      console.log(`[batch-balance] Completed ${Object.keys(results).length} balances`);
      res.json(results);
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
      if (!financialYear) {
        return res.status(400).json({ message: "financialYear query parameter is required" });
      }
      const finYear = financialYear;

      try {
        console.log(`[billed-vs-paid] Trying AccountInquiries for accountId=${accountId}, finYear=${finYear}`);
        const aiData = await platinumGet(session, `/api/BillingEnquiry/AccountInquiries`, {
          accountId: accountId,
          finYear: finYear,
        });
        if (aiData) {
          const items = Array.isArray(aiData) ? aiData : [aiData];
          if (items.length > 0 && items[0] && typeof items[0] === 'object') {
            console.log(`[billed-vs-paid] AccountInquiries returned ${items.length} monthly rows`);
            res.json(items);
            return;
          }
        }
      } catch (aiErr: any) {
        console.log(`[billed-vs-paid] AccountInquiries failed (${aiErr.message}), trying BilledVsPaidAmounts`);
      }

      try {
        const data = await platinumGet(session, `/api/BillingEnquiry/BilledVsPaidAmounts`, req.query as Record<string, string>);
        if (data && (Array.isArray(data) ? data.length > 0 : true)) {
          handlePlatinumResult(res, data);
          return;
        }
      } catch (primaryErr: any) {
        console.log(`[billed-vs-paid] BilledVsPaidAmounts failed (${primaryErr.message}), falling back to DetailedTransactionResults`);
      }

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
      const institutionId = req.query.institutionId as string;
      const instIdNum = Number(institutionId);
      console.log(`[search-accounts-by-group] institutionId=${institutionId}`);

      const strategies: Array<{ label: string; fn: () => Promise<any> }> = [
        {
          label: `GET receipting-account-group-payment/search-accounts-by-group?institutionId=${instIdNum}`,
          fn: () => platinumGet(session, "/api/receipting-account-group-payment/search-accounts-by-group", { institutionId: String(instIdNum) }),
        },
        {
          label: `POST EnquiryResults {accountGroup: ${instIdNum}, pageSize: 2000}`,
          fn: () => platinumPost(session, "/api/BillingEnquiry/EnquiryResults", { accountGroup: instIdNum, pageSize: 2000 }),
        },
        {
          label: `GET billing-enquiry-search?accountGroup=${instIdNum}&PageSize=2000`,
          fn: () => platinumGet(session, "/api/billing-enquiry-search", { accountGroup: String(instIdNum), PageSize: "2000" }),
        },
        {
          label: `POST EnquiryResults {instituationID: ${instIdNum}, pageSize: 2000}`,
          fn: () => platinumPost(session, "/api/BillingEnquiry/EnquiryResults", { instituationID: instIdNum, pageSize: 2000 }),
        },
      ];

      for (const s of strategies) {
        try {
          const data = await s.fn();
          const isErr = data?._error;
          const count = Array.isArray(data) ? data.length : 'non-array';
          console.log(`[search-accounts-by-group] ${s.label} → ${isErr ? `error ${data.status}` : `${count} results`}`);
          if (!isErr && Array.isArray(data) && data.length > 0) {
            return res.json(data);
          }
        } catch (e: any) {
          console.log(`[search-accounts-by-group] ${s.label} threw: ${e.message}`);
        }
      }

      console.log(`[search-accounts-by-group] All strategies exhausted for institutionId=${institutionId}`);
      res.json([]);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // =====================================================
  // PLATINUM API DATA ROUTES
  // =====================================================

  app.get("/api/platinum/billing-config", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const keys = ["Allow Prepaid And Miscellaneous", "Allow Prepaid And Recovery", "Allow Normal Receipting"];
      const results = await Promise.allSettled(
        keys.map(key => platinumGet(session, "/api/BillingEnquiry/GetAppSetting", { key }))
      );
      const config: Record<string, any> = {};
      keys.forEach((key, idx) => {
        const r = results[idx];
        if (r.status === 'fulfilled' && r.value && !r.value._error) {
          const val = typeof r.value === 'string' ? r.value.replace(/"/g, '') : String(r.value);
          config[key] = val;
        }
      });
      res.json(config);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/cons-accounts/search", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/cons-accounts/search", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry-search", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-enquiry-search", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/const-institutions", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const finYear = session.userData?.finYear || req.query.finYear as string | undefined;

      const endpoints: { url: string; params: Record<string, string> }[] = [
        { url: "/api/receipting-account-group/search", params: {} },
        { url: "/api/const-institutions", params: {} },
        { url: "/api/BillingEnquiry/GetConstInstitutions", params: {} },
      ];
      if (finYear) {
        endpoints.splice(1, 0, { url: "/api/receipting-account-group/get-account-groups", params: { finYear: String(finYear) } });
      }

      for (const ep of endpoints) {
        try {
          const data = await platinumGet(session, ep.url, ep.params);
          if (data && !data._error) {
            const arr = Array.isArray(data) ? data : [];
            if (arr.length > 0) {
              console.log(`[const-institutions] ${ep.url} returned ${arr.length} groups, sample keys: ${JSON.stringify(Object.keys(arr[0]))}`);
              return handlePlatinumResult(res, data);
            }
          }
        } catch (epErr: any) {
          console.error(`[const-institutions] ${ep.url} threw: ${epErr?.message || epErr}`);
        }
      }

      console.log(`[const-institutions] All endpoints returned empty or failed`);
      res.json([]);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/const-institutions/search", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const nameQuery = (req.query.name as string || '').toLowerCase().trim();
      if (!nameQuery) return res.json([]);

      const filterByName = (items: any[]): any[] => {
        return items.filter((g: any) => {
          const desc = (g.institutionDesc || g.accountGroupDesc || g.name || '').toLowerCase();
          return desc.includes(nameQuery);
        });
      };

      const normalizeResult = (g: any) => ({
        institutionDesc: g.institutionDesc || g.accountGroupDesc || g.name || '',
        institution_ID: g.institution_ID || g.institutionID || g.accountGroupId || g.accountGroupID || g.id,
        institutionID: g.institution_ID || g.institutionID || g.accountGroupId || g.accountGroupID || g.id,
        groupCode_ID: g.groupCode_ID || g.groupCodeID || 0,
        groupCodeDesc: g.groupCodeDesc || '',
        account_ID: g.account_ID || g.accountID || null,
        accountNumber: g.accountNumber || '',
        outStandingAmt: g.outStandingAmt || 0,
        activeServiceCount: g.activeServiceCount || 0,
      });

      const finYear = session.userData?.finYear;
      const endpoints: { url: string; params: Record<string, string> }[] = [
        { url: "/api/receipting-account-group/search", params: {} },
        ...(finYear ? [{ url: "/api/receipting-account-group/get-account-groups", params: { finYear: String(finYear) } }] : []),
      ];

      for (const ep of endpoints) {
        const data = await platinumGet(session, ep.url, ep.params);
        if (data && !data._error && Array.isArray(data) && data.length > 0) {
          const filtered = filterByName(data);
          if (filtered.length > 0) {
            return res.json(filtered.map(normalizeResult));
          }
        }
      }

      res.json([]);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/cons-accounts/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/cons-accounts/" + req.params.id);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/accounts-by-name-id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const accountId = req.query.accountId as string;
      if (!accountId) {
        return res.status(400).json({ message: "accountId is required" });
      }

      const accountData = await platinumGet(session, "/api/cons-accounts/" + accountId);
      if (!accountData || accountData._error) {
        return res.status(404).json({ message: "Account not found" });
      }

      const nameId = accountData.nameId;
      if (!nameId) {
        return res.json({ nameId: null, accounts: [] });
      }

      const searchData = await platinumGet(session, "/api/cons-accounts/search", { nameId: String(nameId) });
      let accounts: any[] = [];
      if (Array.isArray(searchData)) {
        accounts = searchData;
      } else if (searchData?.value && Array.isArray(searchData.value)) {
        accounts = searchData.value;
      } else if (searchData && !searchData._error) {
        accounts = [searchData];
      }

      accounts = accounts.filter((a: any) => {
        const aid = a.id || a.accountId || a.account_ID;
        return aid && String(aid) !== String(accountId);
      });

      res.json({ nameId, accounts });
    } catch (e: any) {
      console.error(`[accounts-by-name-id] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/cons-names/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/cons-names/" + req.params.id);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/cons-units/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/cons-units/" + req.params.id);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/account-full-details/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const accountId = req.params.id;
      const accountData = await platinumGet(session, "/api/cons-accounts/" + accountId);
      if (!accountData || accountData._error) {
        return res.status(404).json({ message: "Account not found" });
      }

      const results: any = { account: accountData };

      const [nameData, unitData] = await Promise.all([
        accountData.nameId ? platinumGet(session, "/api/cons-names/" + accountData.nameId).catch((err) => { console.error('[account-details] Failed to fetch name data:', err); return null; }) : null,
        accountData.unitId ? platinumGet(session, "/api/cons-units/" + accountData.unitId).catch((err) => { console.error('[account-details] Failed to fetch unit data:', err); return null; }) : null,
      ]);

      if (nameData && !nameData._error) results.name = nameData;
      if (unitData && !unitData._error) results.unit = unitData;

      res.json(results);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-stage-cashier-receipt-details/reference", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-stage-cashier-receipt-details/reference", req.query as Record<string, string>);
      if (data && data._error) {
        const statusCode = data._statusCode || 502;
        if (statusCode === 400 || statusCode === 404) {
          return res.json([]);
        }
        return res.status(statusCode).json({ message: data._error });
      }
      res.json(data || []);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-stage-prepaid-recharge/:id", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-stage-prepaid-recharge/" + req.params.id);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-stage-prepaid-recovery/:identifier", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-stage-prepaid-recovery/" + req.params.identifier);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-stage-prepaid-recovery/reference", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const data = await platinumGet(session, "/api/billing-stage-prepaid-recovery/reference", req.query as Record<string, string>);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/pos-multiple-account-payments/:capturerId/:accountId/receipt/:receiptId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { capturerId, accountId, receiptId } = req.params;
      const data = await platinumPost(session, `/api/pos-multiple-account-payments/${capturerId}/${accountId}/receipt/${receiptId}`, req.body || {});
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/pos-multi-receipt-print", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const receiptId = req.query.receiptId as string;
      const receiptNo = req.query.receiptNo as string;

      const tryMultiPrint = async (id: string): Promise<any[]> => {
        try {
          console.log(`[pos-multi-receipt-print] Calling Platinum API: billing-payment/pos-multi-receipt-print?receiptId=${id}`);
          const data = await platinumGet(session, "/api/billing-payment/pos-multi-receipt-print", { receiptId: id });
          const items = Array.isArray(data) ? data : (data && !data._error ? [] : []);
          console.log(`[pos-multi-receipt-print] API returned ${items.length} items for receiptId=${id}`);
          if (items.length > 0) {
            const first = items[0];
            console.log(`[pos-multi-receipt-print] ITEM FIELDS for receiptId=${id}:`, JSON.stringify({
              receiptNo: first.receiptNo,
              accountId: first.accountId,
              oldAccountCode: first.oldAccountCode,
              accName: first.accName,
              sgNumber: first.sgNumber,
              accAddress: first.accAddress,
              cashierName: first.cashierName,
              cashOfficeName: first.cashOfficeName,
              billType: first.billType,
              amount: first.amount,
              vatAmount: first.vatAmount,
              tenderAmount: first.tenderAmount,
              changeAmount: first.changeAmount,
              outstandingAmount: first.outstandingAmount,
              payMode: first.payMode,
              paymentTypeId: first.paymentTypeId,
              billTypeId: first.billTypeId,
            }));
            if (items.length > 1) {
              console.log(`[pos-multi-receipt-print] ALL ${items.length} line items:`, items.map((it: any, idx: number) => `  [${idx}] billType="${it.billType}" amount=${it.amount} vatAmount=${it.vatAmount}`).join('\n'));
            }
            console.log(`[pos-multi-receipt-print] FULL RAW first item keys:`, Object.keys(first).join(', '));
          }
          if (items.length > 0) return items;
        } catch (e: any) {
          console.warn(`[pos-multi-receipt-print] API call failed for receiptId=${id}:`, e.message);
        }
        return [];
      };

      const lookupViewReceipt = async (): Promise<{ serialNo: string | null; viewMatch: any | null }> => {
        try {
          const lookupNo = receiptNo || '';
          if (!lookupNo) return { serialNo: null, viewMatch: null };
          const lookupParams: Record<string, string> = {
            ReceiptNo: lookupNo,
            CapturerId: '0',
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
          console.log(`[pos-multi-receipt-print] ViewReceipt returned ${viewItems.length} items for ReceiptNo="${lookupNo}"`);
          if (viewItems.length > 0) {
            console.log(`[pos-multi-receipt-print] ViewReceipt FIRST ITEM ALL KEYS:`, Object.keys(viewItems[0]).join(', '));
            console.log(`[pos-multi-receipt-print] ViewReceipt FIRST ITEM DATA:`, JSON.stringify(viewItems[0]).substring(0, 2000));
          }
          const match = viewItems.find((v: any) => {
            const vNo = v.receiptNo || v.receipt_No || '';
            return vNo === lookupNo || vNo.includes(lookupNo) || lookupNo.includes(vNo);
          });
          if (match) {
            const sn = match.serialNo || match.receiptId || match.receipt_ID || match.id;
            console.log(`[pos-multi-receipt-print] ViewReceipt MATCH found: serialNo=${sn}, accountNumber=${match.accountNumber || match.accountNo || 'N/A'}, accName=${match.accName || match.consumerName || 'N/A'}`);
            return { serialNo: sn ? String(sn) : null, viewMatch: match };
          }
          console.log(`[pos-multi-receipt-print] ViewReceipt NO MATCH found for receiptNo="${lookupNo}"`);
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
        const viewPaymentType = vm.paymentType || vm.payment_type || '';
        const viewPaymentOption = vm.paymentOption || vm.payment_option || '';
        for (const item of items) {
          if (!item.accountId && accountId) item.accountId = accountId;
          if (!item.accName && accName) item.accName = accName;
          if (!item.accAddress && accAddress) item.accAddress = accAddress;
          if (!item.oldAccountCode && oldAccountCode) item.oldAccountCode = oldAccountCode;
          if (!item.sgNumber && sgNumber) item.sgNumber = sgNumber;
          if (!item.cashierName && cashierName) item.cashierName = cashierName;
          if (!item.cashOfficeName && cashOfficeName) item.cashOfficeName = cashOfficeName;
        }
        if (viewPaymentType) {
          for (const item of items) {
            item.payMode = viewPaymentType;
          }
          console.log(`[pos-multi-receipt-print] Set payMode="${viewPaymentType}" from ViewReceipt.paymentType`);
        }
        if (viewPaymentOption) {
          for (const item of items) {
            if (!item._viewPaymentOption) item._viewPaymentOption = viewPaymentOption;
          }
          console.log(`[pos-multi-receipt-print] Set _viewPaymentOption="${viewPaymentOption}" from ViewReceipt`);
        }
        if (outstandingAmount != null) {
          for (const item of items) {
            item.outstandingAmount = outstandingAmount;
          }
          console.log(`[pos-multi-receipt-print] Set outstandingAmount=${outstandingAmount} from ViewReceipt`);
        }
        const viewTenderAmount = vm.tenderAmount ?? vm.tender_amount ?? null;
        const viewChangeAmount = vm.changeAmount ?? vm.change_amount ?? null;
        if (viewTenderAmount != null) {
          for (const item of items) item.tenderAmount = viewTenderAmount;
        }
        if (viewChangeAmount != null) {
          for (const item of items) item.changeAmount = viewChangeAmount;
        }
      }

      if (items.length > 0) {
        const first = items[0] as any;
        const serialNo = first.serialNo || (viewMatch && (viewMatch.serialNo || viewMatch.receiptId)) || receiptId;
        const needsServiceBreakdown = items.length === 1 
          && (first.billTypeId === 1 || first.billTypeId === 6 || first.billTypeId === 3)
          && serialNo;
        
        if (needsServiceBreakdown) {
          try {
            const token = await refreshSessionToken(session);
            const apiUrl = getPlatinumApiUrl();
            console.log(`[pos-multi-receipt-print] Fetching service breakdown from print-receipt PDF for serialNo=${serialNo}`);
            const pdfRes = await fetch(`${apiUrl}/api/billing-payment/print-receipt`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/pdf",
              },
              body: JSON.stringify({ Ids: [Number(serialNo)], ReceiptNos: [], IsReprint: false }),
            });
            if (pdfRes.ok) {
              const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
              if (pdfBuffer.length > 100) {
                const tmpPath = `/tmp/receipt_svc_${serialNo}_${Date.now()}.pdf`;
                try {
                  writeFileSync(tmpPath, pdfBuffer);
                  const text = execSync(`pdftotext -layout ${tmpPath} -`, { timeout: 10000 }).toString();
                  console.log(`[pos-multi-receipt-print] PDF text (layout mode, first 3000 chars):`, text.substring(0, 3000).replace(/\n/g, ' | '));
                  const allocations = parseReceiptAllocations(text);
                  if (allocations.length > 0) {
                    console.log(`[pos-multi-receipt-print] Extracted ${allocations.length} service allocations from PDF:`, allocations.map(a => `${a.service}: ${a.amount}`).join(', '));
                    for (const item of items) {
                      (item as any)._serviceAllocations = allocations;
                    }
                  } else {
                    console.log(`[pos-multi-receipt-print] No service allocations found in PDF text`);
                  }
                } finally {
                  if (existsSync(tmpPath)) {
                    try { unlinkSync(tmpPath); } catch {}
                  }
                }
              }
            } else {
              console.log(`[pos-multi-receipt-print] print-receipt PDF returned HTTP ${pdfRes.status}`);
            }
          } catch (e: any) {
            console.warn(`[pos-multi-receipt-print] Service breakdown extraction failed:`, e.message);
          }
        }
      }

      if (items.length === 0) {
        console.log(`[pos-multi-receipt-print] No data found for receiptId=${receiptId}, receiptNo=${receiptNo}`);
      }

      res.json(items);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.get("/api/platinum/pos-multi-receipt-print/by-cashier", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
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
            const data = await platinumGet(session, "/api/billing-payment/pos-multi-receipt-print", { receiptId: String(probeId) });
            if (Array.isArray(data) && data.length > 0) {
              highestKnownId = probeId;
              break;
            }
          }
          if (!highestKnownId) {
            let probeId = baseProbe;
            while (probeId > baseProbe - 100) {
              const data = await platinumGet(session, "/api/billing-payment/pos-multi-receipt-print", { receiptId: String(probeId) });
              if (Array.isArray(data) && data.length > 0) {
                highestKnownId = probeId;
                break;
              }
              probeId -= 5;
            }
          }
        } catch (err) { console.error('[by-cashier] Receipt ID probe failed:', err); }
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
            const data = await platinumGet(session, "/api/billing-payment/pos-multi-receipt-print", { receiptId: String(id) });
            if (Array.isArray(data) && data.length > 0) {
              const item = data[0];
              if (item.cashierName && item.cashierName.toLowerCase() === cashierName.toLowerCase()) {
                return data.map((d: any) => ({ ...d, _receiptId: id }));
              }
            }
          } catch (err) { console.error('[by-cashier] Failed to fetch receipt:', err); }
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

  app.get("/api/platinum/pos-multi-receipt-print/search", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const receiptNo = (req.query.receiptNo as string) || '';
      const cashierName = (req.query.cashierName as string) || '';
      const accountNumber = (req.query.accountNumber as string) || '';
      const scanCount = Math.min(parseInt(req.query.scanCount as string) || 200, 500);

      let highestKnownId = 0;
      try {
        const probeIds = [1041500, 1041450, 1041400, 1041350, 1041300, 1041280];
        for (const probeId of probeIds) {
          const data = await platinumGet(session, "/api/billing-payment/pos-multi-receipt-print", { receiptId: String(probeId) });
          if (Array.isArray(data) && data.length > 0) {
            highestKnownId = probeId;
            break;
          }
        }
        if (!highestKnownId) {
          let probeId = 1041300;
          while (probeId > 1041200) {
            const data = await platinumGet(session, "/api/billing-payment/pos-multi-receipt-print", { receiptId: String(probeId) });
            if (Array.isArray(data) && data.length > 0) {
              highestKnownId = probeId;
              break;
            }
            probeId -= 5;
          }
        }
      } catch (err) { console.error('[receipt-search] Receipt ID probe failed:', err); }
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
            const data = await platinumGet(session, "/api/billing-payment/pos-multi-receipt-print", { receiptId: String(id) });
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
          } catch (err) { console.error('[receipt-search] Failed to fetch receipt:', err); }
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

  app.get("/api/platinum/pos-multi-receipt-print/batch", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const startId = parseInt(req.query.startId as string) || 312979;
      const count = Math.min(parseInt(req.query.count as string) || 50, 200);
      const direction = (req.query.direction as string) === 'forward' ? 1 : -1;

      const ids: number[] = [];
      for (let i = 0; i < count; i++) {
        ids.push(startId + (i * direction));
      }

      const fetchOne = async (id: number) => {
        try {
          const data = await platinumGet(session, "/api/billing-payment/pos-multi-receipt-print", { receiptId: String(id) });
          if (Array.isArray(data) && data.length > 0) {
            return data.map((item: any) => ({ ...item, _receiptId: id }));
          }
        } catch (err) { console.error('[batch] Failed to fetch receipt:', err); }
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


  const aiOpenai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  app.post("/api/ai/parse-description", async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    try {
      const { description, reference } = req.body;
      if (!description) {
        return res.status(400).json({ message: "description required" });
      }

      const prompt = `You are a municipal banking description parser for a South African municipality. Analyze this bank statement description and extract ALL possible identifiers that could be used to find the account.

Bank statement description: "${description}"
${reference ? `Reference: "${reference}"` : ''}

Extract the following identifiers if present. Be thorough - look for ALL possible matches:

1. **Account Numbers**: Municipal account numbers (typically 10-15 digits, may have leading zeros). Look for patterns like "000000001234" or numbers after ACC/ACCOUNT/AC.
2. **ERF Numbers**: Property ERF/stand numbers (typically 3-8 digits). Look for patterns like "ERF 14783", "ERF NO 5043", "STAND 1234".
3. **Old Account Codes / SG Codes**: Legacy property codes in format like "C027/0002/00014783/00000" or partial codes. Numbers that could be part of SG codes.
4. **Meter Numbers**: Electricity/water meter numbers. Look for "MTR", "METER", or standalone long numbers.
5. **Person/Company Names**: Any names of people or companies/businesses in the description. Names may appear as "SURNAME FIRSTNAME", "J SMITH", "SMITH & JONES", etc. Strip banking noise words (FNB, ABSA, PMT, OB, EFT, CREDIT, DEBIT, REF, INTERNET, DOM, MAGTAPE, DEPOSIT, TRANSFER, STANDARD, NEDBANK, CAPITEC, INVESTEC, CASHFOCUS, ONTEC).
6. **Location/Area Keywords**: Any town, suburb, or area names mentioned.
7. **Reference Numbers**: Any reference numbers that could help identify the account.

Respond ONLY with valid JSON in this exact format:
{
  "accountNumbers": ["string array of account numbers found"],
  "erfNumbers": ["string array of ERF/stand numbers found"],
  "oldAccountCodes": ["string array of old account codes or SG code parts found"],
  "meterNumbers": ["string array of meter numbers found"],
  "names": ["string array of person or company names found"],
  "areaKeywords": ["string array of location/area keywords found"],
  "referenceNumbers": ["string array of reference numbers found"],
  "reasoning": "brief explanation of what you found and why"
}

If no identifiers of a type are found, use an empty array. Be aggressive in finding identifiers - err on the side of including possible matches rather than missing them.`;

      const completion = await aiOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      res.json(parsed);
    } catch (e: any) {
      console.error("[AI Parse] Error:", e.message);
      res.status(500).json({ message: "AI parsing failed", detail: e.message });
    }
  });

  app.post("/api/ai/parse-descriptions-batch", async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "items array required" });
      }

      const batchItems = items.slice(0, 10);

      const descriptionsText = batchItems.map((item: any, i: number) =>
        `[${i}] "${item.description}"${item.reference ? ` (ref: "${item.reference}")` : ''}`
      ).join('\n');

      const prompt = `You are a municipal banking description parser for a South African municipality. Analyze these bank statement descriptions and extract ALL possible identifiers from EACH one.

${descriptionsText}

For each description, extract:
- accountNumbers: Municipal account numbers (10-15 digits with leading zeros)
- erfNumbers: Property ERF/stand numbers (3-8 digits, from "ERF", "STAND", etc.)
- oldAccountCodes: Legacy SG codes or parts (e.g., "C027/0002/00014783/00000" or partial numbers that could be SG code segments)
- meterNumbers: Electricity/water meter numbers
- names: Person or company names (strip banking words: FNB, ABSA, PMT, OB, EFT, CREDIT, DEBIT, REF, INTERNET, DOM, MAGTAPE, DEPOSIT, TRANSFER, NEDBANK, CAPITEC, INVESTEC, CASHFOCUS, ONTEC)
- areaKeywords: Town/suburb/area names
- referenceNumbers: Reference numbers

Respond ONLY with valid JSON:
{
  "results": [
    {
      "index": 0,
      "accountNumbers": [],
      "erfNumbers": [],
      "oldAccountCodes": [],
      "meterNumbers": [],
      "names": [],
      "areaKeywords": [],
      "referenceNumbers": [],
      "reasoning": "brief note"
    }
  ]
}

Be thorough - find ALL possible identifiers. Err on the side of including possible matches.`;

      const completion = await aiOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content || '{"results":[]}';
      const parsed = JSON.parse(content);
      res.json(parsed);
    } catch (e: any) {
      console.error("[AI Parse Batch] Error:", e.message);
      res.status(500).json({ message: "AI batch parsing failed", detail: e.message });
    }
  });

  return httpServer;
}

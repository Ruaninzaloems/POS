import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult, checkPaymentDedup, recordPaymentSubmission, reservePaymentSlot, releasePaymentSlot } from "./middleware";
import { platinumGet, platinumPost, platinumPut, refreshSessionToken, getPlatinumApiUrl, getPlatinumDbName } from "../platinum-auth";

export function registerPosRoutes(app: Express, httpServer: Server): void {
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
      const b = req.body;
      const prepaidIdempotencyToken = req.headers['x-idempotency-token'] as string | undefined;
      const prepaidDedupKey = `prepaid|${b.userId || 'u'}|${b.meterNumber || 'm'}|${b.amount || 0}|${b.paymentTypeId || 0}`;
      const prepaidDedupCheck = checkPaymentDedup(prepaidDedupKey, prepaidIdempotencyToken);
      if (prepaidDedupCheck.isDuplicate) {
        console.warn(`[prepaid-submit] DUPLICATE BLOCKED — key: ${prepaidDedupKey}`);
        if (prepaidDedupCheck.inFlight) {
          res.status(409).json({ message: "Payment already in progress. Please wait." });
        } else {
          res.json(prepaidDedupCheck.cachedResponse);
        }
        return;
      }
      reservePaymentSlot(prepaidDedupKey, prepaidIdempotencyToken);
      try {
        const data = await platinumPost(session, "/api/ReceiptPrepaid/SubmitPrepaidPayment", req.body);
        recordPaymentSubmission(prepaidDedupKey, data, prepaidIdempotencyToken);
        handlePlatinumResult(res, data);
      } catch (submitErr: any) {
        releasePaymentSlot(prepaidDedupKey, prepaidIdempotencyToken);
        throw submitErr;
      }
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

  app.post("/api/platinum/pos/process-payment", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const userId = session.userData?.user_ID || (session as any).userId || (session as any).user?.id;
      if (!userId) {
        return res.status(400).json({ message: "User ID not found in session" });
      }
      const data = await platinumPost(session, `/api/billing-payment/submit-consumer-payment/${userId}`, req.body);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[pos/process-payment] Error:`, e.message);
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
}

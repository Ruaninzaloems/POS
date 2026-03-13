import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult, checkPaymentDedup, recordPaymentSubmission, reservePaymentSlot, releasePaymentSlot, PAYMENT_DEDUP_WINDOW_MS, getPaymentDeduplicationKey } from "./middleware";
import { platinumGet, platinumPost, refreshSessionToken, getPlatinumApiUrl, type UserSession } from "../platinum-auth";

export function registerClearanceRoutes(app: Express, httpServer: Server): void {
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

  app.get("/api/platinum/billing-payment-clearance/debug-batch-test", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
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
    const clrBody = req.body;
    const clrIdempotencyToken = req.headers['x-idempotency-token'] as string | undefined;
    const clrDedupKey = `clearance|${clrBody.userId || 'u'}|${clrBody.clearance_ID || clrBody.clearanceId || 'c'}|${clrBody.paidAmount || clrBody.totalAmount || 0}|${clrBody.paymentTypeId || 0}`;
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[clearance-submit] Request payload:`, JSON.stringify(req.body));
      const clrDedupCheck = checkPaymentDedup(clrDedupKey, clrIdempotencyToken);
      if (clrDedupCheck.isDuplicate) {
        console.warn(`[clearance-submit] DUPLICATE BLOCKED — key: ${clrDedupKey}`);
        if (clrDedupCheck.inFlight) {
          res.status(409).json({ message: "Payment already in progress. Please wait." });
        } else {
          res.json(clrDedupCheck.cachedResponse);
        }
        return;
      }
      reservePaymentSlot(clrDedupKey, clrIdempotencyToken);

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
          releasePaymentSlot(clrDedupKey, clrIdempotencyToken);
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
        recordPaymentSubmission(clrDedupKey, data, clrIdempotencyToken);
        res.json(data);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e: any) {
      releasePaymentSlot(clrDedupKey, clrIdempotencyToken);
      console.error(`[clearance-submit] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  // --- Billing Payment Miscellaneous endpoints ---

  app.get("/api/platinum/billing-payment-miscellaneous/get-groups", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[misc-groups] Fetching groups from Platinum API...`);
      const data = await platinumGet(session, "/api/billing-payment-miscellaneous/get-groups");
      console.log(`[misc-groups] RAW response type=${typeof data}, isArray=${Array.isArray(data)}, keys=${data ? Object.keys(data).slice(0,10) : 'null'}, length=${Array.isArray(data) ? data.length : 'N/A'}`);
      let groups = data;
      if (data && !Array.isArray(data)) {
        groups = data.data || data.paymentGroups || data.groups || data.miscellaneousPaymentGroups || [];
        console.log(`[misc-groups] Unwrapped from object — found ${Array.isArray(groups) ? groups.length : 0} groups. Full response:`, JSON.stringify(data).substring(0, 500));
      }
      if (Array.isArray(groups) && groups.length > 0) {
        console.log(`[misc-groups] First item:`, JSON.stringify(groups[0]));
        console.log(`[misc-groups] Returning ${groups.length} groups`);
      } else {
        console.log(`[misc-groups] WARNING: No groups found. Raw data:`, JSON.stringify(data).substring(0, 500));
      }
      res.json(Array.isArray(groups) ? groups : []);
    } catch (e: any) {
      console.error(`[misc-groups] Error:`, e.message);
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
    let miscDedupKey = '';
    let miscIdempotencyToken: string | undefined;
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
      if (miscBody.totalAmount === undefined || miscBody.totalAmount === null || miscBody.totalAmount < 0) {
        return res.status(400).json({ message: "totalAmount must be 0 or greater" });
      }

      const paymentType = Number(miscBody.paymentType ?? 1);
      const isCard = paymentType === 3;
      const userId = Number(miscBody.userId);
      const now = new Date();
      const receiptDateISO = miscBody.receiptDate
        ? (miscBody.receiptDate.includes('T') ? miscBody.receiptDate : `${miscBody.receiptDate}T00:00:00`)
        : now.toISOString().split('.')[0];

      const payload: Record<string, any> = {
        lastName: miscBody.lastName || '',
        initials: miscBody.initials || '',
        miscellaneousPaymentGroup: Number(miscBody.miscellaneousPaymentGroup),
        scoaItem: Number(miscBody.scoaItem),
        description: miscBody.description || '',
        receiptDate: receiptDateISO,
        totalAmount: Number(miscBody.totalAmount),
        vatAmount: Number(miscBody.vatAmount ?? 0),
        amount: Number(miscBody.amount ?? miscBody.totalAmount),
        tenderAmount: Number(miscBody.tenderAmount ?? miscBody.totalAmount),
        changeAmount: Number(miscBody.changeAmount ?? 0),
        paymentType: paymentType,
        vatPercentage: Number(miscBody.vatPercentage ?? 0),
        isVatable: Boolean(miscBody.isVatable),
        cardNo: isCard ? (miscBody.cardNo || '') : null,
        expiryDate: isCard ? (miscBody.expiryDate || '') : null,
        chequeNo: miscBody.chequeNo || null,
        bankBranch: miscBody.bankBranch || null,
        bankBranchCode: miscBody.bankBranchCode || null,
        bankBranchCodeId: miscBody.bankBranchCodeId || null,
        accHolderName: miscBody.accHolderName || null,
        finYear: miscBody.finYear,
        accountId: miscBody.accountId || null,
        sundryId: miscBody.sundryId || null,
      };

      const logSafe = { ...payload, cardNo: payload.cardNo ? '****' : '', expiryDate: payload.expiryDate ? '**/**' : '' };
      console.log(`[misc-submit] Sanitized payload:`, JSON.stringify(logSafe));

      miscIdempotencyToken = req.headers['x-idempotency-token'] as string | undefined;
      miscDedupKey = `misc|${userId}|${payload.scoaItem}|${payload.totalAmount}|${paymentType}`;
      const miscDedupCheck = checkPaymentDedup(miscDedupKey, miscIdempotencyToken);
      if (miscDedupCheck.isDuplicate) {
        console.warn(`[misc-submit] DUPLICATE BLOCKED — key: ${miscDedupKey}`);
        if (miscDedupCheck.inFlight) {
          res.status(409).json({ message: "Payment already in progress. Please wait." });
        } else {
          res.json(miscDedupCheck.cachedResponse);
        }
        return;
      }
      reservePaymentSlot(miscDedupKey, miscIdempotencyToken);

      const platinumEndpoint = `/api/billing-payment-miscellaneous/submit-miscellaneous-payment/${userId}`;
      console.log(`[misc-submit] Calling Platinum: ${platinumEndpoint}`);
      const data = await platinumPost(session, platinumEndpoint, payload);
      console.log(`[misc-submit] Response:`, JSON.stringify(data)?.substring(0, 1000));

      if (data && !data._error) {
        if (!data.ids) {
          const rid = data.receiptID || data.receiptId || data.receipt_ID || data.id;
          if (rid && Number(rid) > 0) {
            data.ids = [Number(rid)];
            console.log(`[misc-submit] Normalized ids from receiptID: [${data.ids}]`);
          }
        }
        if (data.isSuccess === undefined && !data._error && (data.ids?.length > 0 || data.receiptNo)) {
          data.isSuccess = true;
        }
        if (data.receiptNo && typeof data.receiptNo === 'string' && data.receiptNo.startsWith('EFT')) {
          console.warn(`[misc-submit] WARNING: API returned EFT receipt number "${data.receiptNo}" — expected POS receipt.`);
        }
      }

      recordPaymentSubmission(miscDedupKey, data, miscIdempotencyToken);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      releasePaymentSlot(miscDedupKey, miscIdempotencyToken);
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
      const data = await platinumPost(session, `/api/billing-payment-miscellaneous/submit-miscellaneous-payment/${userId}`, payload);
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

}

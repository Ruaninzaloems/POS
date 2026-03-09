import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult } from "./middleware";
import { platinumGet, platinumPost, getSessionPosCashierId } from "../platinum-auth";

export function registerDayendRoutes(app: Express, httpServer: Server): void {
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
      const effectiveUserId = userId || String(session.userData?.user_ID || '');
      if (!effectiveUserId) {
        res.status(400).json({ message: "userId is required for save-reconcile-data" });
        return;
      }
      const endpoints = [
        { label: 'bp-day-end (userId+cashierId query)', path: '/api/billing-payment-day-end-reconcile/save-Reconcile-data', params: { userId, cashierId } },
        { label: 'bp-day-end (cashierId query only)', path: '/api/billing-payment-day-end-reconcile/save-Reconcile-data', params: { cashierId } },
        { label: 'bp-day-end (userId query)', path: '/api/billing-payment-day-end-reconcile/save-Reconcile-data', params: { userId } },
        { label: 'auth-day-end (userId+cashierId query)', path: '/api/billing/auth-day-end-reconcile/save-Reconcile-data', params: { userId, cashierId } },
        { label: 'auth-day-end (cashierId query only)', path: '/api/billing/auth-day-end-reconcile/save-Reconcile-data', params: { cashierId } },
        { label: 'auth-day-end (userId query)', path: '/api/billing/auth-day-end-reconcile/save-Reconcile-data', params: { userId } },
      ];

      const finYear = req.body.finyear || session.userData?.finYear;
      if (!finYear) {
        console.warn('[dayend-save] Financial year missing from request and session');
      }

      const errors: string[] = [];
      let saveSucceeded = false;
      let saveResponse: any = null;

      for (const ep of endpoints) {
        try {
          console.log(`[dayend-save] Trying: ${ep.label} → ${ep.path}?${new URLSearchParams(ep.params as any).toString()}`);
          const data = await platinumPost(session, ep.path, req.body, ep.params as any);
          const respStr = JSON.stringify(data).substring(0, 500);
          console.log(`[dayend-save] ${ep.label} Response: ${respStr}`);

          const isSuccess = data && !data._error && data.success !== false && data.isSuccess !== false;
          if (!isSuccess) {
            const errMsg = data?.message || data?.title || 'Unknown error';
            console.log(`[dayend-save] ${ep.label} returned non-success: ${errMsg}`);
            errors.push(`${ep.label}: ${errMsg}`);
            continue;
          }

          console.log(`[dayend-save] ${ep.label} returned success — verifying DB write...`);
          await new Promise(r => setTimeout(r, 1000));

          let verified = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const vcData = await platinumGet(session, "/api/ReceiptPrepaid/validate-cashier", { userId: effectiveUserId, finYear });
              if (vcData?.cashierReconcile != null) {
                console.log(`[dayend-save] Verify attempt ${attempt}: cashierReconcile PRESENT — DB write confirmed`);
                console.log(`[dayend-save] cashierReconcile data:`, JSON.stringify(vcData.cashierReconcile).substring(0, 500));
                verified = true;
                break;
              }
              console.log(`[dayend-save] Verify attempt ${attempt}: cashierReconcile still NULL`);
            } catch (verifyErr: any) {
              console.log(`[dayend-save] Verify attempt ${attempt} failed: ${verifyErr.message}`);
            }
            if (attempt < 3) {
              await new Promise(r => setTimeout(r, 2000));
            }
          }

          if (verified) {
            saveSucceeded = true;
            saveResponse = data;
            break;
          } else {
            console.warn(`[dayend-save] ${ep.label} returned success but DB write NOT verified after 3 attempts — trying next endpoint`);
            errors.push(`${ep.label}: API returned success but reconcile record was not created in database`);
          }
        } catch (err: any) {
          console.log(`[dayend-save] ${ep.label} threw: ${err.message}`);
          errors.push(`${ep.label}: ${err.message}`);
        }
      }

      if (saveSucceeded && saveResponse) {
        console.log(`[dayend-save] Save completed and verified successfully`);
        handlePlatinumResult(res, saveResponse);
      } else {
        console.error(`[dayend-save] ALL endpoints failed or verification failed!`, errors);
        res.status(502).json({ message: "Day-end save failed: reconcile record could not be created. " + errors[errors.length - 1], errors });
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

}

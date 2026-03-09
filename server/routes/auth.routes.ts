import type { Express } from "express";
import type { Server } from "http";
import { getSession, requireAuth, handlePlatinumResult } from "./middleware";
import { platinumGet, platinumPost, loginWithCredentials, logoutSession, isSessionAuthenticated, refreshSessionToken, getPlatinumApiUrl, getPlatinumDbName, clearLockoutCache, SITE_CONFIGS, getSiteConfig } from "../platinum-auth";

export function registerAuthRoutes(app: Express, httpServer: Server): void {
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
      console.log(`[active-cashier] RAW reconcileStatusCode: ${vcData?.reconcileStatusCode}, reconcileStatusDescription: ${vcData?.reconcileStatusDescription}`);

      if (!vcData || vcData._error) {
        console.error(`[active-cashier] validate-cashier API failed or returned error:`, vcData?._error || 'no data');
        return res.json({ active: false, cashierId: null, cashierRegistered: false, isActive: false });
      }

      let cashier = vcData.cashier || null;
      let cashOffice = vcData.cashOffice || null;
      const receiptRange = vcData.receiptRange || vcData.receiptRangeAvailable || null;
      let cashierReconcile = vcData.cashierReconcile || null;

      const topLevelReconcileStatus = String(vcData.reconcileStatusDescription || vcData.reconcileStatusCode || '').toLowerCase().trim();
      const topLevelIsReturned = topLevelReconcileStatus.includes('return');
      if (topLevelIsReturned && !cashierReconcile) {
        console.log(`[active-cashier] Top-level reconcileStatus indicates RETURNED ("${vcData.reconcileStatusDescription}") but cashierReconcile is null — synthesizing reconcile record`);
        cashierReconcile = { status: vcData.reconcileStatusDescription || 'Returned', reason: vcData.returnReason || '', _synthetic: true };
      }

      let sessionFromCache = false;

      if (!cashier) {
        console.log(`[active-cashier] validate-cashier returned cashier=null — checking fallbacks`);

        const knownId = (session as any).knownCashierId;
        if (knownId && knownId > 0) {
          console.log(`[active-cashier] Trying knownCashierId=${knownId} from session`);
          try {
            const details = await platinumGet(session, `/api/ReceiptPrepaid/cashier-detailsById`, { cashierId: String(knownId) });
            if (details && !details._error && details.id) {
              if (details.isActive === true) {
                cashier = details;
                cashOffice = details.const_CashOffice || null;
                console.log(`[active-cashier] knownCashierId fallback SUCCESS — id: ${details.id}, isActive: ${details.isActive}, isVirtual: ${details.isVirtual}, officeId: ${details.officeId}`);
              } else if (topLevelIsReturned || cashierReconcile) {
                cashier = details;
                cashOffice = details.const_CashOffice || null;
                console.log(`[active-cashier] knownCashierId fallback: cashier isActive=false but day-end is RETURNED — using cashier record for session recovery. id: ${details.id}, officeId: ${details.officeId}`);
              } else {
                console.log(`[active-cashier] knownCashierId fallback returned no active session: id=${details?.id}, isActive=${details?.isActive}`);
              }
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

        if (!cashier && (topLevelIsReturned || cashierReconcile)) {
          console.log(`[active-cashier] Day-end is returned/pending but no cashier found — searching cashier-list for userId=${userId}`);
          try {
            const cashierList = await platinumGet(session, "/api/ReceiptPrepaid/cashier-list", {});
            const allCashiers = Array.isArray(cashierList) ? cashierList : [];
            const numUserId = parseInt(String(userId), 10);
            const matchedCashier = allCashiers.find((c: any) => c.user_Id === numUserId || c.userId === numUserId);
            if (matchedCashier) {
              console.log(`[active-cashier] Found cashier in cashier-list for userId=${userId} — cashierId=${matchedCashier.id}, isActive=${matchedCashier.isActive}`);
              cashier = matchedCashier;
              cashOffice = matchedCashier.const_CashOffice || null;
              if (!cashOffice && matchedCashier.officeId) {
                try {
                  const offices = await platinumGet(session, "/api/ReceiptPrepaid/cash-offices", { finYear, userId });
                  const officeList = Array.isArray(offices) ? offices : [];
                  cashOffice = officeList.find((o: any) => (o.cashOffice_ID || o.id) === matchedCashier.officeId) || null;
                } catch {} 
              }
            } else {
              console.log(`[active-cashier] No matching cashier found in cashier-list for userId=${userId}`);
            }
          } catch (clErr: any) {
            console.warn(`[active-cashier] cashier-list lookup failed:`, clErr.message);
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

      if (cashierId && cashierId > 0) {
        (session as any).knownCashierId = cashierId;
        if (cashier) (session as any).knownCashierData = cashier;
      }

      const cashierDetails = cashier ? {
        ...cashier,
        const_CashOffice: cashOffice,
      } : null;

      res.json({
        active: isSessionActive || hasDayEndReturned,
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
}

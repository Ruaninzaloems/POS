import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult } from "./middleware";
import { platinumGet, platinumPost, platinumPut, refreshSessionToken, getPlatinumApiUrl } from "../platinum-auth";

export function registerDepositsRoutes(app: Express, httpServer: Server): void {
  // --- Direct Deposit Allocation endpoints ---

  const bankReconCache = new Map<string, { data: any; ts: number }>();
  const BANK_RECON_CACHE_TTL = 30_000;

  app.post("/api/platinum/direct-deposit-allocation/get-bank-recon-positem-list", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const siteId = (session as any).siteId || (session as any).site?.id || 'default';
      const userId = (session as any).userId || (session as any).user?.id || 'anon';
      const cacheKey = `${siteId}:${userId}:${JSON.stringify(req.body)}`;
      const skipCache = req.headers['x-skip-cache'] === '1';
      const cached = !skipCache && bankReconCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < BANK_RECON_CACHE_TTL) {
        res.json(cached.data);
        return;
      }
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/get-bank-recon-positem-list", req.body);
      if (data && !data._error) {
        bankReconCache.set(cacheKey, { data, ts: Date.now() });
        if (bankReconCache.size > 20) {
          const oldest = [...bankReconCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
          for (let i = 0; i < 5; i++) bankReconCache.delete(oldest[i][0]);
        }
      }
      handlePlatinumResult(res, data);
    } catch (e: any) {
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/direct-deposit-allocation/invalidate-bank-recon-cache", (req, res) => {
    const session = requireAuth(req, res); if (!session) return;
    const siteId = (session as any).siteId || (session as any).site?.id || 'default';
    const userId = (session as any).userId || (session as any).user?.id || 'anon';
    const prefix = `${siteId}:${userId}:`;
    let cleared = 0;
    for (const key of Array.from(bankReconCache.keys())) {
      if (key.startsWith(prefix)) {
        bankReconCache.delete(key);
        cleared++;
      }
    }
    res.json({ cleared: cleared > 0, count: cleared });
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
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';
    totalLines: number;
    completedLines: number;
    failedLines: number;
    currentLine: string;
    results: DDBatchLineResult[];
    errors: string[];
    createdAt: number;
    queuePosition?: number;
  }

  const ddBatchJobs = new Map<string, DDBatchJob>();
  const ddPosItemLocks = new Set<number>();
  let ddJobCounter = 0;

  const MAX_CONCURRENT_JOBS = 3;
  let activeJobCount = 0;
  const jobQueue: Array<{ jobId: string; execute: () => Promise<void> }> = [];

  const platinumApiSemaphore = {
    maxConcurrent: 4,
    current: 0,
    queue: [] as Array<() => void>,

    async acquire(): Promise<void> {
      if (this.current < this.maxConcurrent) {
        this.current++;
        return;
      }
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
      this.current++;
    },

    release(): void {
      this.current--;
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        next();
      }
    },
  };

  const circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    state: 'CLOSED' as 'CLOSED' | 'OPEN' | 'HALF_OPEN',
    threshold: 8,
    resetTimeout: 30_000,

    recordSuccess(): void {
      this.failures = 0;
      this.state = 'CLOSED';
    },

    recordFailure(): void {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
        console.warn(`[DD CircuitBreaker] OPEN — ${this.failures} consecutive failures, pausing for ${this.resetTimeout / 1000}s`);
      }
    },

    async waitIfOpen(): Promise<void> {
      if (this.state === 'OPEN') {
        const elapsed = Date.now() - this.lastFailure;
        if (elapsed < this.resetTimeout) {
          const waitMs = this.resetTimeout - elapsed;
          console.log(`[DD CircuitBreaker] Waiting ${Math.round(waitMs / 1000)}s before retrying...`);
          await new Promise(r => setTimeout(r, waitMs));
        }
        this.state = 'HALF_OPEN';
      }
    },

    isAvailable(): boolean {
      if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') return true;
      if (Date.now() - this.lastFailure >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    },
  };

  const tokenCache = new Map<string, { token: string; ts: number }>();
  const tokenInflight = new Map<string, Promise<string>>();
  const TOKEN_CACHE_TTL = 4 * 60 * 1000;

  function getSessionKey(reqSession: any): string {
    const id = reqSession.id || reqSession.sessionID;
    if (!id) throw new Error('Session has no ID — cannot manage tokens safely');
    return String(id);
  }

  async function getOrRefreshToken(reqSession: any, userSession: any, jobId: string): Promise<string> {
    const sessionKey = getSessionKey(reqSession);
    const cached = tokenCache.get(sessionKey);
    if (cached && Date.now() - cached.ts < TOKEN_CACHE_TTL) {
      return cached.token;
    }
    const existing = tokenInflight.get(sessionKey);
    if (existing) {
      return existing;
    }
    const promise = (async () => {
      try {
        console.log(`[DD Token ${jobId}] Refreshing token for session ${sessionKey}`);
        const token = await refreshSessionToken(userSession);
        tokenCache.set(sessionKey, { token, ts: Date.now() });
        return token;
      } finally {
        tokenInflight.delete(sessionKey);
      }
    })();
    tokenInflight.set(sessionKey, promise);
    return promise;
  }

  function invalidateTokenCache(reqSession: any): void {
    try {
      const sessionKey = getSessionKey(reqSession);
      tokenCache.delete(sessionKey);
    } catch {}
  }

  function processJobQueue(): void {
    while (jobQueue.length > 0 && activeJobCount < MAX_CONCURRENT_JOBS) {
      const entry = jobQueue.shift()!;
      const job = ddBatchJobs.get(entry.jobId);
      if (!job || job.status !== 'QUEUED') {
        continue;
      }
      job.status = 'PROCESSING';
      job.currentLine = 'Starting...';
      delete job.queuePosition;
      activeJobCount++;
      entry.execute().finally(() => {
        activeJobCount--;
        processJobQueue();
      });
    }
    let pos = 1;
    for (const q of jobQueue) {
      const j = ddBatchJobs.get(q.jobId);
      if (j && j.status === 'QUEUED') {
        j.queuePosition = pos++;
        j.currentLine = `Queued — position ${j.queuePosition} of ${jobQueue.length}`;
      }
    }
  }

  setInterval(() => {
    const ONE_HOUR = 60 * 60 * 1000;
    const STALE_PROCESSING_TIMEOUT = 15 * 60 * 1000;
    const now = Date.now();
    const staleJobIds = new Set<string>();
    for (const [jobId, job] of ddBatchJobs.entries()) {
      if ((job.status === 'PROCESSING' || job.status === 'QUEUED') && now - job.createdAt > STALE_PROCESSING_TIMEOUT) {
        job.status = 'FAILED';
        job.currentLine = 'Job timed out (stale processing)';
        job.errors.push('Server-side processing exceeded maximum time limit');
        ddPosItemLocks.delete(job.posItemId);
        staleJobIds.add(jobId);
        console.warn(`[DD Batch] Marked stale job ${jobId} as FAILED, released posItemId lock ${job.posItemId}`);
      }
      if (now - job.createdAt > ONE_HOUR && job.status !== 'PROCESSING' && job.status !== 'QUEUED') {
        ddBatchJobs.delete(jobId);
      }
    }
    if (staleJobIds.size > 0) {
      const beforeLen = jobQueue.length;
      for (let i = jobQueue.length - 1; i >= 0; i--) {
        if (staleJobIds.has(jobQueue[i].jobId)) {
          jobQueue.splice(i, 1);
        }
      }
      if (beforeLen !== jobQueue.length) {
        console.log(`[DD Batch] Removed ${beforeLen - jobQueue.length} stale entries from job queue`);
      }
    }
    if (tokenCache.size > 50) {
      const stale = Date.now() - TOKEN_CACHE_TTL;
      for (const [k, v] of tokenCache) {
        if (v.ts < stale) tokenCache.delete(k);
      }
    }
  }, 10 * 60 * 1000);

  app.post("/api/dd-allocation/submit-batch", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const expressSession = req.session;
      const { posItemId, reconId, financialYear, transactionDate, transactionNote, lines } = req.body;

      if (!posItemId || !reconId || !financialYear || !transactionDate || !Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ message: "Missing required fields: posItemId, reconId, financialYear, transactionDate, lines" });
      }

      const serverUserId = session.userData?.user_ID;
      if (!serverUserId || serverUserId <= 0) {
        return res.status(400).json({ message: "Could not determine user ID from session." });
      }

      const numericPosItemId = Number(posItemId);
      if (!Number.isFinite(numericPosItemId) || numericPosItemId <= 0) {
        return res.status(400).json({ message: "posItemId must be a positive number" });
      }
      if (ddPosItemLocks.has(numericPosItemId)) {
        const existingJob = Array.from(ddBatchJobs.values()).find(j => j.posItemId === numericPosItemId && (j.status === 'PROCESSING' || j.status === 'QUEUED'));
        return res.status(409).json({
          message: "This deposit is already being allocated by another user. Please wait for the current allocation to complete.",
          jobId: existingJob?.jobId || null,
        });
      }
      ddPosItemLocks.add(numericPosItemId);

      ddJobCounter++;
      const jobId = `dd-${numericPosItemId}-${Date.now()}-${ddJobCounter}`;

      const job: DDBatchJob = {
        jobId,
        posItemId: numericPosItemId,
        status: 'QUEUED',
        totalLines: lines.filter((l: any) => l.allocationType !== 'CASHBOOK' && l.accountNo !== 'CASHBOOK-RTN').length,
        completedLines: 0,
        failedLines: 0,
        currentLine: 'Initializing...',
        results: [],
        errors: [],
        createdAt: Date.now(),
      };
      ddBatchJobs.set(jobId, job);

      let apiUrl: string;
      try {
        await getOrRefreshToken(expressSession, session, jobId);
        apiUrl = getPlatinumApiUrl(session);
      } catch (e: any) {
        job.status = 'FAILED';
        job.currentLine = 'Failed to initialize session';
        job.errors.push(`Session error: ${e.message}`);
        ddPosItemLocks.delete(numericPosItemId);
        return res.status(500).json({ message: "Failed to initialize session for batch processing", detail: e.message });
      }

      res.json({ jobId, message: "Job accepted. Poll /api/dd-allocation/job/:jobId for progress." });

      const submitUrl = `${apiUrl}/api/billing-direct-deposit-allocation/submit-details-data`;

      const MAX_RETRIES = 4;
      const INITIAL_BACKOFF_MS = 1500;

      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      const isRetryable = (status: number, err?: any): boolean => {
        if (err?.name === 'AbortError') return true;
        if (err?.code === 'ECONNRESET' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT' || err?.code === 'EPIPE') return true;
        if (status === 429 || status === 502 || status === 503 || status === 504 || status === 408) return true;
        if (status >= 500 && status < 600) return true;
        return false;
      };

      const submitLineWithRetry = async (submitData: any, lineLabel: string): Promise<{ rawRes: any; responseText: string; attempts: number }> => {
        let lastErr: any;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
            job.currentLine = `${lineLabel} — retry ${attempt}/${MAX_RETRIES} in ${Math.round(backoff / 1000)}s...`;
            console.log(`[DD Batch ${jobId}] Retry ${attempt}/${MAX_RETRIES} for ${lineLabel}, backoff ${Math.round(backoff)}ms`);
            await sleep(backoff);
          }

          await circuitBreaker.waitIfOpen();

          await platinumApiSemaphore.acquire();
          try {
            let token: string;
            try {
              token = await getOrRefreshToken(expressSession, session, jobId);
            } catch (tokenErr: any) {
              console.error(`[DD Batch ${jobId}] Token refresh failed:`, tokenErr?.message);
              throw tokenErr;
            }

            const timeoutMs = attempt === 0 ? 60_000 : 90_000;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const rawRes = await fetch(submitUrl, {
              method: "POST",
              headers: { "Authorization": `Bearer ${token}`, "Accept": "*/*", "Content-Type": "application/json" },
              body: JSON.stringify(submitData),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const responseText = await rawRes.text();

            if (rawRes.status === 401) {
              console.warn(`[DD Batch ${jobId}] Got 401, invalidating token cache`);
              invalidateTokenCache(expressSession);
              if (attempt < MAX_RETRIES) continue;
              circuitBreaker.recordFailure();
              return { rawRes, responseText, attempts: attempt + 1 };
            }

            if (isRetryable(rawRes.status) && attempt < MAX_RETRIES) {
              console.warn(`[DD Batch ${jobId}] ${lineLabel} got HTTP ${rawRes.status}, will retry`);
              circuitBreaker.recordFailure();
              lastErr = new Error(`HTTP ${rawRes.status}: ${responseText.substring(0, 200)}`);
              continue;
            }

            if (rawRes.status < 400) {
              circuitBreaker.recordSuccess();
            }

            return { rawRes, responseText, attempts: attempt + 1 };
          } catch (fetchErr: any) {
            lastErr = fetchErr;
            circuitBreaker.recordFailure();
            if (!isRetryable(0, fetchErr) || attempt >= MAX_RETRIES) {
              throw fetchErr;
            }
            console.warn(`[DD Batch ${jobId}] ${lineLabel} fetch error (attempt ${attempt + 1}): ${fetchErr?.message}`);
          } finally {
            platinumApiSemaphore.release();
          }
        }
        throw lastErr || new Error('Exhausted retries');
      };

      const processBatch = async () => {
        try {
          const ALLOC_TYPE_ORDER: Record<string, number> = {
            'ACCOUNT': 1, 'PREPAID': 1, 'GROUP': 2, 'CLEARANCE': 3, 'DIRECT': 4, 'CASHBOOK': 5,
          };
          const sortedLines = [...lines].sort((a: any, b: any) => {
            return (ALLOC_TYPE_ORDER[a.allocationType || 'ACCOUNT'] || 99) - (ALLOC_TYPE_ORDER[b.allocationType || 'ACCOUNT'] || 99);
          });

          let lineIdx = 0;
          for (const line of sortedLines) {
            if (line.accountNo === 'CASHBOOK-RTN' || line.allocationType === 'CASHBOOK') continue;
            lineIdx++;

            if (lineIdx > 1 && activeJobCount > 1) {
              const interLineDelay = Math.min(200 * activeJobCount, 1000);
              await sleep(interLineDelay);
            }

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
                reconId, userId: serverUserId, financialYear, transactionDate,
                receiptDate: transactionDate, groupId,
                lastName: derivedLastName, initials: derivedInitials,
                reference: actualReference || "0", description: line.description || transactionNote || '',
              };
            }

            try {
              console.log(`[DD Batch ${jobId}] Submitting line ${lineIdx}/${job.totalLines}: ${lineLabel}`);
              const { rawRes, responseText, attempts } = await submitLineWithRetry(submitData, lineLabel);

              if (attempts > 1) {
                console.log(`[DD Batch ${jobId}] Line ${lineIdx} succeeded after ${attempts} attempts`);
              }
              console.log(`[DD Batch ${jobId}] Line ${lineIdx} HTTP ${rawRes.status}: ${responseText.substring(0, 500)}`);

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
                const receiptNo = parsed?.receiptNo || parsed?.receiptNumber || parsed?.receipt_No || '';
                const receiptId = parsed?.receiptId || parsed?.receipt_ID || parsed?.id || parsed?.ids?.[0] || '';
                job.results.push({ lineIndex: lineIdx, accountNo: line.accountNo, allocationType: allocType, amount: line.amount, status: 'SUCCESS', receiptNo, receiptId, apiResponse: parsed });
              }
            } catch (submitErr: any) {
              job.failedLines++;
              const errMsg = submitErr?.name === 'AbortError'
                ? `Request timed out after ${MAX_RETRIES + 1} attempts`
                : (submitErr?.message || 'Unknown error');
              job.errors.push(`${lineLabel}: ${errMsg} (all retries exhausted)`);
              job.results.push({ lineIndex: lineIdx, accountNo: line.accountNo, allocationType: allocType, amount: line.amount, status: 'FAILED', error: errMsg });
              console.error(`[DD Batch ${jobId}] Line ${lineIdx} FAILED after all retries:`, submitErr?.message);
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
          ddPosItemLocks.delete(numericPosItemId);
          job.currentLine = job.status === 'COMPLETED' ? 'All lines processed successfully' : `Done: ${job.completedLines} succeeded, ${job.failedLines} failed`;
          console.log(`[DD Batch ${jobId}] Finished: ${job.status} (${job.completedLines}/${job.totalLines} succeeded), released posItemId lock ${numericPosItemId}`);
        }
      };

      const executeJob = async () => {
        await processBatch().catch((e) => {
          job.status = 'FAILED';
          job.currentLine = 'Unexpected error during processing';
          job.errors.push(`Batch processing error: ${e?.message || 'Unknown'}`);
          ddPosItemLocks.delete(numericPosItemId);
          console.error(`[DD Batch ${jobId}] Unhandled error:`, e?.message);
        });
      };

      jobQueue.push({ jobId, execute: executeJob });
      console.log(`[DD Batch ${jobId}] Enqueued (queue length: ${jobQueue.length}, active: ${activeJobCount}/${MAX_CONCURRENT_JOBS})`);
      processJobQueue();
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
        queuePosition: job.queuePosition,
      });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to fetch job status", detail: e.message });
    }
  });

  app.get("/api/dd-allocation/active-job", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const posItemId = Number(req.query.posItemId);
      if (!posItemId) {
        return res.status(400).json({ message: "posItemId required" });
      }
      for (const [, job] of ddBatchJobs) {
        if (job.posItemId === posItemId && (job.status === 'PROCESSING' || job.status === 'QUEUED' || Date.now() - job.createdAt < 120_000)) {
          return res.json({
            jobId: job.jobId,
            posItemId: job.posItemId,
            status: job.status,
            totalLines: job.totalLines,
            completedLines: job.completedLines,
            failedLines: job.failedLines,
            currentLine: job.currentLine,
            results: job.results,
            errors: job.errors,
            queuePosition: job.queuePosition,
          });
        }
      }
      res.json({ active: false });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to check active jobs", detail: e.message });
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
      const items = Array.isArray(data) ? data : data?.items || data?.data || [];
      if (items.length > 0) {
        console.log(`[job-account-details] Sample record keys: ${Object.keys(items[0]).join(', ')}`);
        console.log(`[job-account-details] Sample record: ${JSON.stringify(items[0]).substring(0, 600)}`);
      }
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
      const data = await platinumPut(session, `/api/billing/pos/third-party-payments/${req.params.importId}/transactions/${req.params.index}`, req.body);
      handlePlatinumResult(res, data);
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
}

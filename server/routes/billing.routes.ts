import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult, getPaymentDeduplicationKey, checkPaymentDedup, recordPaymentSubmission, reservePaymentSlot, releasePaymentSlot, PAYMENT_DEDUP_WINDOW_MS, parseReceiptAllocations } from "./middleware";
import { platinumGet, platinumPost, refreshSessionToken, getPlatinumApiUrl } from "../platinum-auth";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";

export function registerBillingRoutes(app: Express, httpServer: Server): void {
  // --- Billing Payment endpoints ---

  app.post("/api/platinum/billing-payment/submit-consumer-payment/:userId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const userId = req.params.userId;
      const body = req.body;
      const acct = body?.account || {};
      const rm = body?.requestModel || {};
      const idempotencyToken = req.headers['x-idempotency-token'] as string | undefined;

      const isCard = rm.paymentType === 'CreditCard' || rm.paymentType === 3;
      if (rm.apiTransactionID === undefined) rm.apiTransactionID = 0;
      if (rm.isReconciled === undefined || rm.isReconciled === null) rm.isReconciled = 0;
      if (rm.isCancelled === undefined || rm.isCancelled === null) rm.isCancelled = 0;

      if (isCard && !rm.cardNumber) {
        console.warn(`[submit-consumer-payment] WARNING: Card payment but cardNumber is empty!`);
      }

      console.log(`[submit-consumer-payment] userId=${userId}, acct=${acct.accountNumber}, amt=${rm.totalAmount}, type=${rm.paymentType}, token=${idempotencyToken || 'none'}`);
      const dedupKey = getPaymentDeduplicationKey(userId, body);
      const dedupCheck = checkPaymentDedup(dedupKey, idempotencyToken);
      if (dedupCheck.isDuplicate) {
        console.warn(`[submit-consumer-payment] DUPLICATE BLOCKED — key: ${dedupKey}`);
        if (dedupCheck.inFlight) {
          res.status(409).json({ message: "Payment already in progress. Please wait." });
        } else {
          res.json(dedupCheck.cachedResponse);
        }
        return;
      }
      reservePaymentSlot(dedupKey, idempotencyToken);
      try {
        const data = await platinumPost(session, `/api/billing-payment/submit-consumer-payment/${userId}`, body);
        console.log(`[submit-consumer-payment] response:`, JSON.stringify(data).substring(0, 500));
        recordPaymentSubmission(dedupKey, data, idempotencyToken);
        handlePlatinumResult(res, data);
      } catch (submitErr: any) {
        releasePaymentSlot(dedupKey, idempotencyToken);
        throw submitErr;
      }
    } catch (e: any) {
      console.error(`[submit-consumer-payment] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment-miscellaneous/submit-miscellaneous-payment/:userId", async (req, res) => {
    let dedupKey = '';
    let idempotencyToken: string | undefined;
    try {
      const session = requireAuth(req, res); if (!session) return;
      const userId = req.params.userId;
      const body = req.body;
      idempotencyToken = req.headers['x-idempotency-token'] as string | undefined;

      if (!body.miscellaneousPaymentGroup && body.miscellaneousPaymentGroup !== 0) {
        return res.status(400).json({ message: "miscellaneousPaymentGroup is required" });
      }
      if (!body.scoaItem && body.scoaItem !== 0) {
        return res.status(400).json({ message: "scoaItem is required" });
      }
      if (body.totalAmount === undefined || body.totalAmount === null || body.totalAmount < 0) {
        return res.status(400).json({ message: "totalAmount must be 0 or greater" });
      }

      const paymentType = Number(body.paymentType ?? 1);
      const isCard = paymentType === 3;
      const now = new Date();
      const receiptDateISO = body.receiptDate
        ? (body.receiptDate.includes('T') ? body.receiptDate : `${body.receiptDate}T00:00:00`)
        : now.toISOString().split('.')[0];

      const payload: Record<string, any> = {
        lastName: body.lastName || '',
        initials: body.initials || '',
        miscellaneousPaymentGroup: Number(body.miscellaneousPaymentGroup),
        scoaItem: Number(body.scoaItem),
        description: body.description || '',
        receiptDate: receiptDateISO,
        totalAmount: Number(body.totalAmount),
        vatAmount: Number(body.vatAmount ?? 0),
        amount: Number(body.amount ?? body.totalAmount),
        tenderAmount: Number(body.tenderAmount ?? body.totalAmount),
        changeAmount: Number(body.changeAmount ?? 0),
        paymentType: paymentType,
        vatPercentage: Number(body.vatPercentage ?? 0),
        isVatable: Boolean(body.isVatable),
        cardNo: isCard ? (body.cardNo || '') : null,
        expiryDate: isCard ? (body.expiryDate || '') : null,
        chequeNo: body.chequeNo || null,
        bankBranch: body.bankBranch || null,
        bankBranchCode: body.bankBranchCode || null,
        bankBranchCodeId: body.bankBranchCodeId || null,
        accHolderName: body.accHolderName || null,
        finYear: body.finYear,
        accountId: body.accountId || null,
        sundryId: body.sundryId || null,
      };

      const logSafe = { ...payload, cardNo: payload.cardNo ? '****' : '', expiryDate: payload.expiryDate ? '**/**' : '' };
      console.log(`[submit-misc-payment] userId=${userId}, group=${payload.miscellaneousPaymentGroup}, scoa=${payload.scoaItem}, amt=${payload.totalAmount}, paymentType=${paymentType} (${isCard ? 'Card' : 'Cash'}), token=${idempotencyToken || 'none'}`);
      console.log(`[submit-misc-payment] Payload:`, JSON.stringify(logSafe));

      dedupKey = `misc-pos|${userId}|${payload.scoaItem}|${payload.totalAmount}|${paymentType}`;
      const dedupCheck = checkPaymentDedup(dedupKey, idempotencyToken);
      if (dedupCheck.isDuplicate) {
        console.warn(`[submit-misc-payment] DUPLICATE BLOCKED — key: ${dedupKey}`);
        if (dedupCheck.inFlight) {
          res.status(409).json({ message: "Payment already in progress. Please wait." });
        } else {
          res.json(dedupCheck.cachedResponse);
        }
        return;
      }
      reservePaymentSlot(dedupKey, idempotencyToken);

      try {
        const platinumEndpoint = `/api/billing-payment-miscellaneous/submit-miscellaneous-payment/${userId}`;
        console.log(`[submit-misc-payment] Calling Platinum: ${platinumEndpoint}`);
        const data = await platinumPost(session, platinumEndpoint, payload);
        console.log(`[submit-misc-payment] Response:`, JSON.stringify(data)?.substring(0, 1000));

        if (data && !data._error) {
          if (!data.ids) {
            const rid = data.receiptID || data.receiptId || data.receipt_ID || data.id;
            if (rid && Number(rid) > 0) {
              data.ids = [Number(rid)];
            }
          }
          if (data.isSuccess === undefined && !data._error && (data.ids?.length > 0 || data.receiptNo)) {
            data.isSuccess = true;
          }
          if (data.receiptNo && typeof data.receiptNo === 'string' && data.receiptNo.startsWith('EFT')) {
            console.warn(`[submit-misc-payment] WARNING: Got EFT receipt "${data.receiptNo}" — unexpected for POS endpoint`);
          }
        }

        recordPaymentSubmission(dedupKey, data, idempotencyToken);
        handlePlatinumResult(res, data);
      } catch (submitErr: any) {
        releasePaymentSlot(dedupKey, idempotencyToken);
        throw submitErr;
      }
    } catch (e: any) {
      releasePaymentSlot(dedupKey, idempotencyToken);
      console.error(`[submit-misc-payment] Error:`, e.message);
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
      const idempotencyToken = req.headers['x-idempotency-token'] as string | undefined;

      const isMiscPayment = accounts.some((a: any) => a.accountType === 'Miscellaneous' || a.miscellaneousPaymentGroup);
      console.log(`[submit-multiple-payment] userId=${userId}, ${accounts.length} acct(s), amt=${rm.totalAmount}, type=${rm.paymentType}, misc=${isMiscPayment}, token=${idempotencyToken || 'none'}`);
      if (!isMiscPayment) {
        const invalidAccounts = accounts.filter((a: any) => !a.accountID || a.accountID === 0);
        if (invalidAccounts.length > 0) {
          console.error(`[submit-multiple-payment] BLOCKED: ${invalidAccounts.length} account(s) have accountID=0 or missing`);
          res.status(400).json({ isSuccess: false, message: `${invalidAccounts.length} account(s) have invalid Account IDs (0 or missing): ${invalidAccounts.map((a: any) => a.name || a.accountNumber || 'unknown').join(', ')}. Remove them from the cart and retry.` });
          return;
        }
      }
      const dedupKey = getPaymentDeduplicationKey(userId, body);
      const dedupCheck = checkPaymentDedup(dedupKey, idempotencyToken);
      if (dedupCheck.isDuplicate) {
        console.warn(`[submit-multiple-payment] DUPLICATE BLOCKED — key: ${dedupKey}`);
        if (dedupCheck.inFlight) {
          res.status(409).json({ message: "Payment already in progress. Please wait." });
        } else {
          res.json(dedupCheck.cachedResponse);
        }
        return;
      }
      reservePaymentSlot(dedupKey, idempotencyToken);
      try {
        const timeoutMs = Math.max(60000, accounts.length * 8000);
        const data = await platinumPost(session, `/api/billing-payment/submit-multiple-payment/${userId}`, body, undefined, { timeout: timeoutMs });
        console.log(`[submit-multiple-payment] response:`, JSON.stringify(data).substring(0, 500));
        recordPaymentSubmission(dedupKey, data, idempotencyToken);
        handlePlatinumResult(res, data);
      } catch (submitErr: any) {
        releasePaymentSlot(dedupKey, idempotencyToken);
        throw submitErr;
      }
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
      const { accountNo } = req.body;
      console.log(`[search-accounts] Searching for: "${accountNo}"`);

      const results: any[] = [];
      const searchStrategies = [
        { label: 'billing-payment/search-accounts', fn: () => platinumPost(session, "/api/billing-payment/search-accounts", req.body, undefined, { timeout: 15000 }) },
        { label: 'enquiry-results (accountID)', fn: () => platinumPost(session, "/api/billing-enquiry/enquiry-results", { accountID: accountNo }, undefined, { timeout: 15000 }) },
        { label: 'enquiry-results (oldAccount)', fn: () => platinumPost(session, "/api/billing-enquiry/enquiry-results", { oldAccount: accountNo }, undefined, { timeout: 15000 }) },
      ];

      const settled = await Promise.allSettled(searchStrategies.map(s => s.fn()));
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        if (r.status === 'fulfilled' && r.value && !r.value._error) {
          const items = Array.isArray(r.value) ? r.value : r.value?.accounts || r.value?.results || r.value?.data || [];
          console.log(`[search-accounts] ${searchStrategies[i].label} → ${items.length} results`);
          for (const item of items) {
            const id = item.accountID || item.account_ID || item.accountId || 0;
            if (id && !results.find((r: any) => (r.accountID || r.account_ID) === id)) {
              results.push(item);
            }
          }
        } else {
          const reason = r.status === 'rejected' ? r.reason?.message : (r.value?._error ? `API error ${r.value.status}` : 'empty');
          console.log(`[search-accounts] ${searchStrategies[i].label} → ${reason}`);
        }
      }

      console.log(`[search-accounts] Total unique results: ${results.length}`);
      res.json(results);
    } catch (e: any) {
      console.error(`[search-accounts] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/search-account-groups", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { searchTerm } = req.body;
      if (!searchTerm) {
        return res.status(400).json({ message: "searchTerm is required" });
      }
      console.log(`[search-account-groups] Searching for institution/group: "${searchTerm}"`);
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/load-details-payment-grouping-institution-data", { searchTerm }, undefined, { timeout: 55000 });
      console.log(`[search-account-groups] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[search-account-groups] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-payment/get-group-accounts", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { groupId, institutionName } = req.body;
      console.log(`[get-group-accounts] Loading accounts for group/institution: groupId=${groupId}, name="${institutionName}"`);
      const data = await platinumPost(session, "/api/billing-direct-deposit-allocation/load-details-payment-grouping", { groupId, institutionName }, undefined, { timeout: 55000 });
      console.log(`[get-group-accounts] Response:`, JSON.stringify(data).substring(0, 1000));
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[get-group-accounts] Error:`, e.message);
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
            signal: AbortSignal.timeout(60000),
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
          signal: AbortSignal.timeout(60000),
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
          signal: AbortSignal.timeout(60000),
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

  app.post("/api/platinum/billing-payment/send-receipt", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { receiptNo, method, email, phone, userId } = req.body;
      if (!receiptNo) {
        return res.status(400).json({ message: "receiptNo is required" });
      }
      console.log(`[send-receipt] Sending receipt ${receiptNo} via ${method}`);
      const data = await platinumPost(session, "/api/billing-payment/send-receipt", {
        receiptNo,
        deliveryMethod: method,
        emailAddress: email || '',
        phoneNumber: phone || '',
        userId,
      }, undefined, { timeout: 30000 });
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[send-receipt] Error:`, e.message);
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
        signal: AbortSignal.timeout(60000),
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
          try { unlinkSync(tmpPath); } catch (cleanupErr: any) { console.warn(`[receipt-allocations] Failed to clean up temp file ${tmpPath}:`, cleanupErr.message); }
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
      const receiptId = req.query.id as string;
      if (!receiptId) {
        return res.status(400).json({ message: "Receipt id query parameter is required (?id=123)" });
      }
      console.log(`[print-misc-receipt] Fetching PDF for receipt id=${receiptId}`);

      const token = await refreshSessionToken(session);
      const apiUrl = getPlatinumApiUrl();
      const platinumUrl = `${apiUrl}/api/billing-payment/print-miscellaneous-receipt?id=${encodeURIComponent(receiptId)}`;

      const pdfRes = await fetch(platinumUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/pdf,application/octet-stream,*/*",
        },
        signal: AbortSignal.timeout(60000),
      });

      if (!pdfRes.ok) {
        const errorText = await pdfRes.text().catch((e: any) => { console.warn('[print-misc-receipt] Failed to read error response body:', e?.message); return ""; });
        console.error(`[print-misc-receipt] Platinum returned ${pdfRes.status}: ${errorText}`);
        return res.status(pdfRes.status).json({ message: "Failed to fetch misc receipt PDF from Platinum", detail: errorText });
      }

      const rawBuffer = Buffer.from(await pdfRes.arrayBuffer());
      console.log(`[print-misc-receipt] PDF received: ${rawBuffer.length} bytes`);

      if (rawBuffer.length < 100) {
        return res.status(409).json({ message: "Empty misc receipt PDF", detail: "The billing system returned a blank PDF." });
      }

      const { PDFDocument } = await import('pdf-lib');
      try {
        const doc = await PDFDocument.load(rawBuffer, { ignoreEncryption: true });
        const pages = doc.getPages();
        for (const page of pages) {
          const { width, height } = page.getSize();
          const contentHeight = Math.min(height, Math.ceil(height * 0.58));
          page.setCropBox(0, height - contentHeight, width, contentHeight);
          page.setMediaBox(0, height - contentHeight, width, contentHeight);
        }
        const cropped = await doc.save();
        const pdfBuffer = Buffer.from(cropped);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="misc_receipt_${receiptId}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
      } catch {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="misc_receipt_${receiptId}.pdf"`);
        res.setHeader("Content-Length", rawBuffer.length);
        return res.send(rawBuffer);
      }
    } catch (e: any) {
      console.error(`[print-misc-receipt] Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

}

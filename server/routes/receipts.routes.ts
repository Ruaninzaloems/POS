import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult, parseReceiptAllocations } from "./middleware";
import { platinumGet, platinumPost, refreshSessionToken, getPlatinumApiUrl } from "../platinum-auth";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import OpenAI from "openai";

export function registerReceiptsRoutes(app: Express, httpServer: Server): void {
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
      if (data && !data._error) {
        console.log(`[cons-accounts] ID=${req.params.id} keys:`, Object.keys(data));
        if (!data.nameId && data.nameID) data.nameId = data.nameID;
        if (!data.nameId && data.name_ID) data.nameId = data.name_ID;
      }
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
        console.log(`[accounts-by-name-id] cons-accounts/${accountId} failed:`, accountData?._error || 'null');
        return res.status(404).json({ message: "Account not found" });
      }
      console.log(`[accounts-by-name-id] cons-accounts/${accountId} keys:`, Object.keys(accountData));

      const nameId = accountData.nameId || accountData.nameID || accountData.name_ID;
      if (!nameId) {
        console.log(`[accounts-by-name-id] No nameId found in response`);
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
      console.log(`[cons-names] Fetching cons-names for ID=${req.params.id}`);
      const data = await platinumGet(session, "/api/cons-names/" + req.params.id);
      if (data && !data._error) {
        console.log(`[cons-names] ID=${req.params.id} keys:`, Object.keys(data));
        console.log(`[cons-names] ID=${req.params.id} sample:`, JSON.stringify(data).substring(0, 800));
      } else {
        console.log(`[cons-names] ID=${req.params.id} ERROR:`, data?._error || 'null response');
      }
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[cons-names] ID=${req.params.id} EXCEPTION:`, e.message);
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
      const resolvedNameId = accountData.nameId || accountData.nameID || accountData.name_ID;
      const resolvedUnitId = accountData.unitId || accountData.unitID || accountData.unit_ID;
      console.log(`[account-full-details] ID=${accountId} nameId=${resolvedNameId} unitId=${resolvedUnitId}`);

      const [nameData, unitData] = await Promise.all([
        resolvedNameId ? platinumGet(session, "/api/cons-names/" + resolvedNameId).catch((err) => { console.error('[account-details] Failed to fetch name data:', err); return null; }) : null,
        resolvedUnitId ? platinumGet(session, "/api/cons-units/" + resolvedUnitId).catch((err) => { console.error('[account-details] Failed to fetch unit data:', err); return null; }) : null,
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
              signal: AbortSignal.timeout(60000),
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
                    try { unlinkSync(tmpPath); } catch (cleanupErr: any) { console.warn(`[pos-multi-receipt-print] Failed to clean up temp file ${tmpPath}:`, cleanupErr.message); }
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

}

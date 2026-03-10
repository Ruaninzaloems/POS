import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult } from "./middleware";
import { platinumGet, platinumPost, getPlatinumApiUrl } from "../platinum-auth";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";

export function registerEnquiriesRoutes(app: Express, httpServer: Server): void {
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
      console.log(`[enquiry-results] Search body:`, JSON.stringify(searchBody));
      const data = await platinumPost(session, "/api/BillingEnquiry/EnquiryResults", searchBody);
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
                      if (existsSync(tmpPath)) { try { unlinkSync(tmpPath); } catch (cleanupErr: any) { console.warn(`[Receipt Info] Failed to clean up temp file ${tmpPath}:`, cleanupErr.message); } }
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

  const autocompleteCache = new Map<string, { data: any; ts: number }>();
  const AUTOCOMPLETE_CACHE_TTL = 60_000;

  app.get("/api/platinum/billing-enquiry/autocomplete", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const search = req.query.search || '';
      const type = req.query.type || 'accountNumber';
      const siteId = (session as any).siteId || (session as any).site?.id || 'default';
      const cacheKey = `${siteId}:${type}:${search}`;
      const cached = autocompleteCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < AUTOCOMPLETE_CACHE_TTL) {
        res.json(cached.data);
        return;
      }
      console.log(`[autocomplete] search="${search}" type="${type}"`);
      const data = await platinumGet(session, "/api/BillingEnquiry/Autocomplete", req.query as Record<string, string>);
      const count = Array.isArray(data) ? data.length : (data?._error ? 'ERROR' : '?');
      console.log(`[autocomplete] Results: ${count}`);
      if (data && !data._error) {
        autocompleteCache.set(cacheKey, { data, ts: Date.now() });
        if (autocompleteCache.size > 100) {
          const oldest = [...autocompleteCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
          for (let i = 0; i < 20; i++) autocompleteCache.delete(oldest[i][0]);
        }
      }
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

  const enquiryPathParamMap: Record<string, string> = {
    "account-balance": "total-balance-debt",
    "handover-info": "handover-by-account",
    "name-info": "name-info-by-account",
    "property-details": "property-details-by-account",
    "contact-details": "get-contact-details",
    "contact-details-history": "contact-details-history-by-id",
    "delivery-address-history": "delivery-address-history-by-id",
    "deposits": "deposits-by-account-id",
    "refunds": "refunds-by-account-id",
    "payment-reversals": "payment-reversals-by-account-id",
    "deposit-bank-guarantee": "bank-guarantee-history",
    "payment-incentive": "payment-incentive-by-account",
    "generated-statements": "generated-statements-by-id",
    "debit-order-deduction": "get-debit-order-deduction",
    "consumption-units": "cons-unit-by-account",
    "transaction-history": "detailed-transaction-results",
  };

  app.get("/api/platinum/billing-enquiry/:endpoint/:accountId", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { endpoint, accountId } = req.params;
      const mappedEndpoint = enquiryPathParamMap[endpoint] || endpoint;
      console.log(`[billing-enquiry] endpoint="${endpoint}" mapped="${mappedEndpoint}" accountId=${accountId}`);

      const queryParams: Record<string, string> = {
        ...req.query as Record<string, string>,
        accountId: accountId,
      };

      const supervisorRoutes: Record<string, string> = {
        "total-balance-debt": "TotalBalanceDebt",
        "total-balance-debt-inquiry": "TotalBalanceDebtInquiry",
        "close-balance-detail": "getCloseBalanceDetail",
        "deposits-by-account-id": "DepositsByAccountId",
        "deposit-amount": "DepositAmount",
        "refunds-by-account-id": "RefundsByAccountId",
        "payment-reversals-by-account-id": "PaymentReversalsByAccountId",
        "bank-guarantee-history": "GetBankGuaranteetHistory",
        "name-info-by-account": "NameInfoByAccount",
        "handover-by-account": "HandoverByAccount",
        "property-details-by-account": "PropertyDetailsByAccount",
        "cons-unit-by-account": "ConsUnitByAccount",
        "payment-incentive-by-account": "PaymentIncentiveByAccount",
        "linked-accounts-on-property": "LinkedAccountsOnProperty",
        "service-type-balance": "ServiceTypeBalanceDetails",
        "transaction-summary-list": "TransactionSummaryList",
      };

      if (supervisorRoutes[mappedEndpoint]) {
        const data = await platinumGet(session, `/api/BillingEnquiry/${supervisorRoutes[mappedEndpoint]}`, queryParams);
        if (mappedEndpoint === 'property-details-by-account') {
          const sample = Array.isArray(data) ? data[0] : data;
          console.log(`[billing-enquiry] PropertyDetailsByAccount keys:`, sample ? Object.keys(sample) : 'empty/null', `isArray=${Array.isArray(data)}`);
          if (sample) console.log(`[billing-enquiry] PropertyDetailsByAccount sample:`, JSON.stringify(sample).substring(0, 500));
        }
        if (mappedEndpoint === 'cons-unit-by-account') {
          const sample = Array.isArray(data) ? data[0] : data;
          console.log(`[billing-enquiry] ConsUnitByAccount keys:`, sample ? Object.keys(sample) : 'empty/null', `isArray=${Array.isArray(data)} count=${Array.isArray(data) ? data.length : 'single'}`);
          if (sample) console.log(`[billing-enquiry] ConsUnitByAccount sample:`, JSON.stringify(sample).substring(0, 800));
        }
        if (['total-balance-debt', 'total-balance-debt-inquiry', 'close-balance-detail', 'service-type-balance', 'transaction-summary-list'].includes(mappedEndpoint)) {
          const sample = Array.isArray(data) ? data[0] : data;
          console.log(`[billing-enquiry] ${mappedEndpoint} queryParams:`, JSON.stringify(queryParams));
          console.log(`[billing-enquiry] ${mappedEndpoint} response keys:`, sample ? Object.keys(sample) : 'empty/null', `count=${Array.isArray(data) ? data.length : 'single'}`);
          if (mappedEndpoint === 'transaction-summary-list' && sample) {
            console.log(`[billing-enquiry] transaction-summary-list FULL ROW:`, JSON.stringify(sample));
            if (Array.isArray(data) && data.length > 1) console.log(`[billing-enquiry] transaction-summary-list ROW2:`, JSON.stringify(data[1]));
          } else if (sample) {
            console.log(`[billing-enquiry] ${mappedEndpoint} sample:`, JSON.stringify(sample).substring(0, 500));
          }
        }
        return handlePlatinumResult(res, data);
      }

      if (mappedEndpoint === "detailed-transaction-results") {
        const finYear = queryParams['finYear'] || session.userData?.finYear || '';
        if (finYear) queryParams['finYear'] = finYear;
        const data = await platinumGet(session, `/api/BillingEnquiry/DetailedTransactionResults`, queryParams);
        const sample = Array.isArray(data) ? data[0] : data;
        console.log(`[billing-enquiry] DetailedTransactionResults keys:`, sample ? Object.keys(sample) : 'empty/null', `count=${Array.isArray(data) ? data.length : 'single'}`);
        if (sample) console.log(`[billing-enquiry] DetailedTransactionResults sample:`, JSON.stringify(sample).substring(0, 500));
        return handlePlatinumResult(res, data);
      }

      if (mappedEndpoint === "get-contact-details") {
        const data = await platinumGet(session, "/api/billing/account-management/get-contact-details", queryParams);
        const sample = Array.isArray(data) ? data[0] : data;
        console.log(`[billing-enquiry] get-contact-details keys:`, sample ? Object.keys(sample) : 'empty/null');
        if (sample) console.log(`[billing-enquiry] get-contact-details sample:`, JSON.stringify(sample).substring(0, 500));
        return handlePlatinumResult(res, data);
      }

      const billingEnquiryPlatinumMap: Record<string, string> = {
        "basic-account-details": "BasicAccountDetails",
        "account-info-result": "AccountInfoResult",
        "all-services": "AllServices",
        "services-search-results": "ServicesSearchResults",
        "account-rates-details": "GetAccountRatesDetails",
        "metered-services-on-account": "MeteredServicesOnAccount",
        "transfer-ownership": "TransferOwnerShip",
        "contact-details-history-by-id": "get-contactdetails-history-by-id",
        "delivery-address-history-by-id": "get-delivery-address-history-by-id",
        "handover-account-enquiry": "getHandoverAccountEnquiry",
        "account-notifications": "AccountNotifications",
        "property-notification": "getPropertyNotification",
        "generated-statements-by-id": "get-generated-statements-by-id",
        "clearance-inquiries": "ClearanceInquiries",
        "debtor-note-lists": "DebtorNoteLists",
        "section129-account-enquiry": "GetSection129AccountEnquiry",
        "debit-order-deduction-by-account": "debitorderdeductionbyaccountid",
        "get-debit-order-deduction": "getDebitOrderDeduction",
        "payment-plans-by-account-id": "PaymentPlansByAccountId",
        "payment-plan-remaining-capital": "PaymentPlanRemainingCapitalAmount",
        "repayment-plan-status": "RepaymentPlanStatus",
        "payment-incentive-journals": "PaymentIncentiveJournals",
        "rates-run-history": "RatesRunHistory",
        "attp-application-history": "AttpApplicationHistory",
        "account-service-meter-per-property": "AccountServiceMeterPerProperty",
        "detailed-transaction-results": "DetailedTransactionResults",
        "cons-unit-by-account": "ConsUnitByAccount",
        "linked-accounts-on-property": "LinkedAccountsOnProperty",
        "deposit-amount": "DepositAmount",
        "deposits-by-account-id": "DepositsByAccountId",
        "payment-amount-by-account-ids": "PaymentAmountByAccountIds",
        "billed-vs-paid-amounts": "BilledVsPaidAmounts",
        "risk-flags": "RiskFlags",
      };

      const platinumPath = billingEnquiryPlatinumMap[mappedEndpoint];
      if (platinumPath) {
        if (mappedEndpoint === 'billed-vs-paid-amounts') {
          console.log(`[billing-enquiry] BilledVsPaidAmounts queryParams:`, JSON.stringify(queryParams));
        }
        const data = await platinumGet(session, `/api/BillingEnquiry/${platinumPath}`, queryParams);
        if (mappedEndpoint === 'generated-statements-by-id') {
          const sample = Array.isArray(data) ? data[0] : data;
          console.log(`[billing-enquiry] generated-statements response keys:`, sample ? Object.keys(sample) : 'empty/null', `type=${typeof data}`, `isArray=${Array.isArray(data)}`, `count=${Array.isArray(data) ? data.length : 'single'}`);
        }
        if (['account-rates-details', 'rates-run-history'].includes(mappedEndpoint)) {
          const sample = Array.isArray(data) ? data[0] : data;
          console.log(`[billing-enquiry] ${mappedEndpoint} response keys:`, sample ? Object.keys(sample) : 'empty/null', `type=${typeof data}`, `isArray=${Array.isArray(data)}`, `count=${Array.isArray(data) ? data.length : 'single'}`);
          if (sample) console.log(`[billing-enquiry] ${mappedEndpoint} field count:`, Object.keys(sample).length);
        }
        if (mappedEndpoint === 'billed-vs-paid-amounts') {
          const sample = Array.isArray(data) ? data[0] : data;
          console.log(`[billing-enquiry] BilledVsPaidAmounts response keys:`, sample ? Object.keys(sample) : 'empty/null', `type=${typeof data}`, `isArray=${Array.isArray(data)}`, `count=${Array.isArray(data) ? data.length : 'single'}`);
          if (sample) console.log(`[billing-enquiry] BilledVsPaidAmounts sample:`, JSON.stringify(sample).substring(0, 500));
        }
        return handlePlatinumResult(res, data);
      }

      const camelCase = mappedEndpoint.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
      const pascalCase = camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
      const data = await platinumGet(session, `/api/BillingEnquiry/${pascalCase}`, queryParams);
      handlePlatinumResult(res, data);
    } catch (e: any) {
      console.error(`[billing-enquiry/:endpoint/:accountId] ${req.params.endpoint}/${req.params.accountId} Error:`, e.message);
      res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-enquiry/send-statement", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { accountId, method, email, phone, statementType, financialYear, month } = req.body;
      if (!accountId) return res.status(400).json({ message: "accountId is required" });
      if (!method) return res.status(400).json({ message: "method is required (email|sms)" });

      const templateEndpoint = statementType === 'detailed'
        ? "/api/BillingEnquiry/getDetailBillingTemplate"
        : "/api/BillingEnquiry/getBillingTemplate";
      const params: Record<string, string> = { accountId: String(accountId) };
      if (financialYear) params.financialYear = financialYear;
      if (month) params.month = month;

      console.log(`[send-statement] Sending ${statementType || 'standard'} statement for account ${accountId} via ${method}, finYear=${financialYear}, month=${month}`);
      let templateData: any = null;
      try {
        templateData = await platinumGet(session, templateEndpoint, params);
      } catch (tplErr: any) {
        console.log(`[send-statement] Template pre-fetch optional, continuing with delivery: ${tplErr.message}`);
      }

      if (method === 'email') {
        if (!email) return res.status(400).json({ message: "email address is required for email delivery" });
        try {
          const emailResult = await platinumPost(session, "/api/BillingEnquiry/EmailBillingStatement", {
            accountId: String(accountId),
            emailAddress: email,
            statementType: statementType || 'standard',
            financialYear: financialYear || '',
            month: month || '',
          });
          console.log(`[send-statement] Email sent to ${email} for account ${accountId}`);
          return res.json({ success: true, method: 'email', recipient: email, data: emailResult });
        } catch (emailErr: any) {
          console.log(`[send-statement] Email API not available, returning template for client-side handling`);
          return res.json({ success: true, method: 'email', fallback: true, templateData, message: 'Statement generated - email delivery attempted' });
        }
      } else if (method === 'sms') {
        if (!phone) return res.status(400).json({ message: "phone number is required for SMS delivery" });
        try {
          const smsResult = await platinumPost(session, "/api/BillingEnquiry/SmsBillingStatement", {
            accountId: String(accountId),
            phoneNumber: phone,
            statementType: statementType || 'standard',
            financialYear: financialYear || '',
            month: month || '',
          });
          console.log(`[send-statement] SMS sent to ${phone} for account ${accountId}`);
          return res.json({ success: true, method: 'sms', recipient: phone, data: smsResult });
        } catch (smsErr: any) {
          console.log(`[send-statement] SMS API not available, returning template for client-side handling`);
          return res.json({ success: true, method: 'sms', fallback: true, templateData, message: 'Statement generated - SMS delivery attempted' });
        }
      } else {
        return res.status(400).json({ message: "Invalid method. Use 'email' or 'sms'" });
      }
    } catch (e: any) {
      console.error(`[send-statement] Error:`, e.message);
      res.status(502).json({ message: "Statement delivery failed", detail: e.message });
    }
  });

  app.post("/api/platinum/billing-enquiry/send-notification", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      const { accountId, method, recipient, subject, message, templateId } = req.body;
      if (!accountId) return res.status(400).json({ message: "accountId is required" });
      if (!method) return res.status(400).json({ message: "method is required (email|sms)" });
      if (!recipient) return res.status(400).json({ message: "recipient is required" });
      if (!message && !templateId) return res.status(400).json({ message: "message or templateId is required" });

      console.log(`[send-notification] Sending ${method} to ${recipient} for account ${accountId}, template=${templateId || 'custom'}`);

      if (method === 'email') {
        const strategies = [
          { label: 'EmailBillingNotification', path: '/api/BillingEnquiry/EmailBillingNotification' },
          { label: 'communication-dispatch', path: '/api/BillingDebt/communication-dispatch' },
          { label: 'EmailBillingStatement', path: '/api/BillingEnquiry/EmailBillingStatement' },
        ];
        const emailPayload = {
          accountId: String(accountId),
          emailAddress: recipient,
          subject: subject || 'Municipal Notification',
          message: message || '',
          templateId: templateId || null,
        };
        let sent = false;
        for (const strat of strategies) {
          try {
            console.log(`[send-notification] Trying ${strat.label}`);
            const result = await platinumPost(session, strat.path, emailPayload);
            if (result && !result._error) {
              console.log(`[send-notification] ${strat.label} succeeded`);
              res.json({ success: true, method: 'email', recipient, data: result });
              sent = true;
              break;
            }
          } catch (err: any) {
            console.log(`[send-notification] ${strat.label} failed: ${err.message}`);
          }
        }
        if (!sent) {
          res.status(502).json({ success: false, method: 'email', message: 'All email dispatch strategies failed. Please try again later.' });
        }
      } else if (method === 'sms') {
        const strategies = [
          { label: 'SmsBillingNotification', path: '/api/BillingEnquiry/SmsBillingNotification' },
          { label: 'communication-dispatch', path: '/api/BillingDebt/communication-dispatch' },
          { label: 'SmsBillingStatement', path: '/api/BillingEnquiry/SmsBillingStatement' },
        ];
        const smsPayload = {
          accountId: String(accountId),
          phoneNumber: recipient,
          message: message || '',
          templateId: templateId || null,
        };
        let sent = false;
        for (const strat of strategies) {
          try {
            console.log(`[send-notification] Trying ${strat.label}`);
            const result = await platinumPost(session, strat.path, smsPayload);
            if (result && !result._error) {
              console.log(`[send-notification] ${strat.label} succeeded`);
              res.json({ success: true, method: 'sms', recipient, data: result });
              sent = true;
              break;
            }
          } catch (err: any) {
            console.log(`[send-notification] ${strat.label} failed: ${err.message}`);
          }
        }
        if (!sent) {
          res.status(502).json({ success: false, method: 'sms', message: 'All SMS dispatch strategies failed. Please try again later.' });
        }
      } else {
        res.status(400).json({ message: "Invalid method. Use 'email' or 'sms'" });
      }
    } catch (e: any) {
      console.error(`[send-notification] Error:`, e.message);
      res.status(502).json({ message: "Notification delivery failed", detail: e.message });
    }
  });

  app.get("/api/platinum/billing-enquiry/communication-templates", async (req, res) => {
    try {
      const session = requireAuth(req, res); if (!session) return;
      console.log(`[comm-templates] Fetching communication templates`);
      const strategies = [
        { label: 'notification-templates', path: '/api/BillingEnquiry/getNotificationTemplates' },
        { label: 'communication-templates', path: '/api/BillingDebt/communication-templates' },
        { label: 'message-templates', path: '/api/BillingEnquiry/getMessageTemplates' },
      ];
      for (const strat of strategies) {
        try {
          const data = await platinumGet(session, strat.path, req.query as Record<string, string>);
          if (data && !data._error) {
            console.log(`[comm-templates] ${strat.label} succeeded`);
            handlePlatinumResult(res, data);
            return;
          }
        } catch (err: any) {
          console.log(`[comm-templates] ${strat.label} failed: ${err.message}`);
        }
      }
      res.json([]);
    } catch (e: any) {
      res.status(502).json({ message: "Failed to fetch templates", detail: e.message });
    }
  });
}

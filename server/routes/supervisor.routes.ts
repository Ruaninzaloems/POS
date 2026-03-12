import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, handlePlatinumResult } from "./middleware";
import { platinumGet, platinumPost, platinumDelete, refreshSessionToken, getPlatinumApiUrl } from "../platinum-auth";

export function registerSupervisorRoutes(app: Express, httpServer: Server): void {
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
            } catch {
            }
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
      const sample = Array.isArray(data) ? data[0] : data;
      console.log(`[billing-enquiry] ConsUnitByAccountId keys:`, sample ? Object.keys(sample) : 'empty/null', `isArray=${Array.isArray(data)} count=${Array.isArray(data) ? data.length : 'single'}`);
      if (sample) console.log(`[billing-enquiry] ConsUnitByAccountId sample:`, JSON.stringify(sample).substring(0, 1200));
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
        if (localPath === 'get-billing-period-transactions' && data) {
          const txnItems = Array.isArray(data) ? data : (data as any)?.value || [];
          if (txnItems.length > 0) {
            console.log('[billing-period-txn] keys:', Object.keys(txnItems[0]));
            console.log('[billing-period-txn] sample:', JSON.stringify(txnItems[0]).substring(0, 600));
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
        const text = await response.text().catch((e: any) => { console.warn('[supervisor-report] Failed to read error response body:', e?.message); return ''; });
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
        '/api/BillingDashboard/get-section129-process-handovers',
        '/api/BillingDashboard/get-handover-termination-pending',
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

}

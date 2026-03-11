# Phase 15 — Extended Server Route Handlers: Deposits, Supervisor, Receipts, Debt, Legal, Communications, Analytics

**Document Version**: 1.1
**Date**: 11 March 2026
**Scope**: 7 route handler files, 249 declared + 74 loop-generated = 323 effective endpoints, ~5,227 source lines
**Prerequisite Phases**: Phase 13 (Server Infrastructure), Phase 14 (Core Routes)

---

## 1. Overview

This document provides handler-level detail for the seven "extended operations" route files covering direct deposit allocation, supervisor dashboard, receipt management, debt management, legal compliance, communications engine, and analytics/monitoring.

**Counting Methodology**: "Declared" counts `app.get/post/put/delete` calls in source. `supervisor.routes.ts` contains a loop over a 75-entry registry array (`billingEnquiryGetEndpoints`) that generates 74 runtime routes (1 skipped: `billed-vs-paid-amounts` has its own explicit handler). These 74 loop-generated routes are counted separately.

| Route File | Declared | Loop-Generated | Effective | Lines | Platinum API Controllers |
|---|---|---|---|---|---|
| `deposits.routes.ts` | 61 | 0 | 61 | 1,617 | `billing-direct-deposit-allocation`, `billing/cashbook-transaction-trace`, `BillingEnquiry`, `ReceiptPrepaid`, `BulkProgress`, `DirectDepositErrors`, `billing/direct-deposit-bulk-allocation`, `billing/pos/third-party-payments` |
| `supervisor.routes.ts` | 65 | +74 | 139 | 1,027 | `BillingEnquiry` (including 74 loop-mapped sub-endpoints), `billing/auth-day-end-reconcile`, `BillingDashboard`, `billing-payment-clearance` |
| `receipts.routes.ts` | 21 | 0 | 21 | 839 | `BillingEnquiry`, `cons-accounts`, `billing-enquiry-search`, `receipting-account-group`, `const-institutions`, `ReceiptPrepaid`, `billing-payment`, `billing-stage-*`, `ViewReceipt` + OpenAI |
| `debt.routes.ts` | 29 | 0 | 29 | 337 | `BillingDebt` |
| `legal.routes.ts` | 22 | 0 | 22 | 239 | `BillingDebt` |
| `communications.routes.ts` | 13 | 0 | 13 | 148 | `BillingDebt` |
| `analytics.routes.ts` | 38 | 0 | 38 | 420 | `BillingDashboard`, `BillingDebt` |
| **Totals** | **249** | **+74** | **323** | **4,627** | |

---

## 2. deposits.routes.ts — Direct Deposit Allocation & Third-Party Payments

**Registration**: `registerDepositsRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `platinumGet`, `platinumPost`, `refreshSessionToken`, `getPlatinumApiUrl`
**Module-Level State**: `bankReconCache` — Map with 30s TTL, max 20 entries

### 2.1 Module-Level Cache: bankReconCache

```typescript
const bankReconCache = new Map<string, { data: any; ts: number }>();
const BANK_RECON_CACHE_TTL = 30_000; // 30 seconds
```

**Cache key**: `{siteId}:{userId}:{JSON.stringify(body)}`
**Eviction**: When size exceeds 20, removes 5 oldest entries (sorted by timestamp).
**Cache bypass**: Header `x-skip-cache: 1` forces fresh fetch.
**Manual invalidation**: POST `/api/platinum/direct-deposit-allocation/invalidate-bank-recon-cache` clears entire cache.

### 2.2 Endpoint Catalogue — Core Allocation

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 1 | POST | `/api/platinum/direct-deposit-allocation/get-bank-recon-positem-list` | `billing-direct-deposit-allocation/get-bank-recon-positem-list` | Cached (see §2.1) |
| 2 | POST | `/api/platinum/direct-deposit-allocation/invalidate-bank-recon-cache` | None (local) | Clears bankReconCache |
| 3 | GET | `/api/platinum/direct-deposit-allocation/check-selected-item-processed` | `billing-direct-deposit-allocation/check-selected-item-processed` | Simple proxy |
| 4 | GET | `/api/platinum/direct-deposit-allocation/get-misc-payment-group` | `billing-direct-deposit-allocation/get-misc-payment-group` | No params |
| 5 | GET | `/api/platinum/direct-deposit-allocation/get-misc-vote-id-by-group` | `billing-direct-deposit-allocation/get-misc-vote-id-by-group` | Simple proxy |
| 6 | GET | `/api/platinum/direct-deposit-allocation/get-group-payment-details` | `billing-direct-deposit-allocation/get-group-payment-details` | Simple proxy |
| 7 | GET | `/api/platinum/direct-deposit-allocation/get-vat-rate` | `billing-direct-deposit-allocation/get-vat-rate` | No params |
| 8 | GET | `/api/platinum/direct-deposit-allocation/get-pos-item-details` | `billing-direct-deposit-allocation/get-pos-item-details` | Simple proxy |

### 2.3 Endpoint Catalogue — Bank Statement Notes

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 9 | POST | `/api/platinum/bank-statement-notes` | `billing-direct-deposit-allocation/get-pos-item-details` (batch) | Batch note lookup for up to 50 posItemIds (see §2.4) |
| 10 | GET | `/api/platinum/bank-statement-notes-by-account` | `BillingEnquiry/PaymentAmountByAccountIds` + `billing/cashbook-transaction-trace/search` | EFT receipt trace for bank statement notes (see §2.5) |

### 2.4 bank-statement-notes — Batch Note Lookup

Accepts `{ posItemIds: number[] }`. Limits to 50 IDs. Processes in batches of 5 via `Promise.all`. For each posItemId, fetches `get-pos-item-details` and extracts `.note` field. Returns `Record<string, string>` (posItemId → note).

### 2.5 bank-statement-notes-by-account — EFT Receipt Trace

1. Fetches all receipts for account via `BillingEnquiry/PaymentAmountByAccountIds`
2. Filters for EFT/electronic/transfer/direct payment types
3. For each EFT receipt (max 20, batches of 3):
   - Traces via `billing/cashbook-transaction-trace/search` with receipt number as searchText
   - Extracts note from 6 possible field names: `note`, `NOTE`, `bankStatementNote`, `bankStatementDescription`, `statementDescription`, `eftDescription`, `ledgerNote`
4. Returns `Record<string, string>` (receiptNo → bankStatementNote)

### 2.6 Endpoint Catalogue — Search & Autocomplete

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 11 | GET | `/api/platinum/direct-deposit-allocation/get-account-autocomplete` | `billing-direct-deposit-allocation/get-account-autocomplete` | Simple proxy |
| 12 | GET | `/api/platinum/direct-deposit-allocation/get-clearance-autocomplete` | `billing-direct-deposit-allocation/get-clearence-autocomplete` | 8s timeout; note Platinum typo "clearence" |
| 13 | GET | `/api/platinum/direct-deposit-allocation/get-old-account-autocomplete` | `billing-direct-deposit-allocation/get-old-account-autocomplete` | Simple proxy |

### 2.7 Endpoint Catalogue — Allocation Details & Preparation

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 14 | POST | `/api/platinum/direct-deposit-allocation/load-details-payment-grouping` | `billing-direct-deposit-allocation/load-details-payment-grouping` | 55s timeout |
| 15 | POST | `/api/platinum/direct-deposit-allocation/load-details-payment-grouping-institution-data` | Same | 55s timeout |
| 16 | POST | `/api/platinum/direct-deposit-allocation/load-details-consumer-services` | `billing-direct-deposit-allocation/load-details-consumer-services` | 55s timeout |
| 17 | POST | `/api/platinum/direct-deposit-allocation/load-details-clearance` | `billing-direct-deposit-allocation/load-details-clearance` | 55s timeout |
| 18 | POST | `/api/platinum/direct-deposit-allocation/get-clearance-details-info` | `billing-direct-deposit-allocation/get-clearance-details-info` | 55s timeout, logged |
| 19 | POST | `/api/platinum/direct-deposit-allocation/get-consumer-details-data` | `billing-direct-deposit-allocation/get-consumer-details-data` | 55s timeout |
| 20 | POST | `/api/platinum/direct-deposit-allocation/load-confirm-payment-details` | `billing-direct-deposit-allocation/load-confirm-payment-details` | 55s timeout |

### 2.8 Virtual Session Management

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 21 | POST | `/api/platinum/direct-deposit-allocation/create-virtual-session` | `ReceiptPrepaid/submit-cashier-setup` | Virtual cashier creation (see §2.9) |
| 22 | POST | `/api/platinum/direct-deposit-allocation/close-virtual-session` | `ReceiptPrepaid/submit-cashier-setup` | Virtual session teardown (see §2.10) |

### 2.9 create-virtual-session

Creates a virtual cashier session for deposit allocation (deposits don't need a physical POS session):

1. Resolves `officeId` from request body or via `ReceiptPrepaid/validate-cashier`
2. If no officeId found → 400 error
3. Submits `ReceiptPrepaid/submit-cashier-setup` with `isVirtual: true`, `cashFloat: 0`
4. On success: stores `knownCashierId` and `knownCashierOfficeId` in Express session
5. Returns `{ success, cashierId, officeId }`

### 2.10 close-virtual-session

Closes a virtual cashier session:
1. Sets `isActive: false` on the cashier setup payload
2. On success: clears `knownCashierId`, `knownCashierOfficeId`, `knownCashierData` from session

### 2.11 Batch CSV Processing

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 23 | POST | `/api/dd-allocation/submit-batch` | `billing-direct-deposit-allocation/submit-details-data` (per line) | In-memory batch job processing (see §2.12) |
| 24 | GET | `/api/dd-allocation/job/:jobId` | None (local) | Job status polling |

### 2.12 submit-batch — In-Memory Batch Job

Processes CSV import lines one at a time with job tracking:

**Job State** (in-memory Map):
```typescript
{
  jobId: string,
  posItemId: number,
  status: 'running' | 'completed' | 'failed',
  totalLines: number,
  completedLines: number,
  failedLines: number,
  currentLine: number,
  results: any[],
  errors: any[]
}
```

Each line is submitted individually to `billing-direct-deposit-allocation/submit-details-data`. Processing continues even if individual lines fail (errors are accumulated).

### 2.13 Direct Allocation Submit

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 25 | POST | `/api/platinum/direct-deposit-allocation/submit-details-data` | `billing-direct-deposit-allocation/submit-details-data` | Raw fetch, 55s AbortController timeout (see §2.14) |
| 26 | GET | `/api/platinum/direct-deposit-allocation/test-kiran-payload` | Same | Debug: sends hardcoded test payload |
| 27 | GET | `/api/platinum/direct-deposit-allocation/get-misc-receipt-data` | `billing-direct-deposit-allocation/get-misc-receipt-data` | Simple proxy |

### 2.14 submit-details-data — Raw Fetch

Bypasses `platinumPost` and uses raw `fetch` with `AbortController` (55s timeout). This is necessary because the standard wrapper may not support the specific response handling needed.

**Payload cleanup**: Removes `cashierId`, `cashOfficeId`, `isVirtual`, `cashFloat`, `note` from body before sending. Overrides `userId` from session.

On timeout → 408 Request Timeout.

### 2.15 Generic Import (CSV)

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 28 | POST | `/api/platinum/direct-deposit-allocation/validate-generic-import` | `BillingEnquiry/EnquiryResults` (batch) | Account validation with 3-tier status (see §2.16) |
| 29 | POST | `/api/platinum/direct-deposit-allocation/submit-generic-import` | `billing-direct-deposit-allocation/submit-details-data` (per line) | Line-by-line submission with job tracking |
| 30 | GET | `/api/platinum/direct-deposit-allocation/generic-import-status/:jobId` | None (local) | Job status |
| 31 | GET | `/api/platinum/direct-deposit-allocation/generic-import-results/:jobId` | None (local) | Job results |
| 32 | GET | `/api/platinum/direct-deposit-allocation/generic-import-errors/:jobId` | None (local) | Job errors |

### 2.16 validate-generic-import — Account Validation

Validates imported payment rows against Platinum:

1. Extracts unique account numbers, normalizes to 12-digit zero-padded format
2. Batch validates (10 at a time) via `BillingEnquiry/EnquiryResults`
3. Matches results by normalized account number
4. Assigns 3-tier validation status:
   - `valid`: Account found in Platinum (matched)
   - `unverified`: API error (500/502/503) or not found (still submittable)
   - `invalid`: Format errors (empty account, >12 digits, invalid date, invalid amount, invalid payment type)
5. Detects intra-file duplicates (same account number appears multiple times)
6. Returns: `{ results[], duplicates[], validCount, unverifiedCount, invalidCount, submittableCount, totalAmount }`

### 2.17 Receipt Search & Cashbook Trace

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 33 | POST | `/api/platinum/view-receipt/search-by-eft-description` | `billing/cashbook-transaction-trace/search` | EFT description search |
| 34 | GET | `/api/platinum/cashbook-transaction-trace/search` | `billing/cashbook-transaction-trace/search` | Simple proxy |
| 35 | GET | `/api/platinum/direct-deposit-allocation/vote-details` | `billing-direct-deposit-allocation/get-group-payment-details` | Simple proxy |

### 2.18 Direct Deposit Bulk Allocation

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 36 | POST | `/api/platinum/direct-deposit-bulk/get-unprocessed` | `billing/direct-deposit-bulk-allocation/get-unprocessed-direct-deposits` | Logged |
| 37 | POST | `/api/platinum/direct-deposit-bulk/get-processed` | `billing/direct-deposit-bulk-allocation/get-processed-deposits` | Transforms `billingAllocated` to boolean (see §2.19) |
| 38 | POST | `/api/platinum/direct-deposit-bulk/reconcile` | `billing/direct-deposit-bulk-allocation/reconcile-processed-data` | Same transform + payload restructuring |
| 39 | POST | `/api/platinum/direct-deposit-bulk/print-processed` | `billing/direct-deposit-bulk-allocation/print-processed-deposits` | Simple proxy |

### 2.19 transformBulkBatchForApi

Local utility function that converts `billingAllocated` from number to boolean across batch items and rejectedItems. Platinum API expects boolean but frontend may send numeric.

### 2.20 Bulk Progress

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 40 | GET | `/api/platinum/bulk-progress/get-financial-years` | `BulkProgress/get-financial-years` | No params |
| 41 | GET | `/api/platinum/bulk-progress/get-month-list` | `BulkProgress/get-month-list` | No params |
| 42 | GET | `/api/platinum/bulk-progress/get-process-list` | `BulkProgress/get-process-list` | No params |
| 43 | POST | `/api/platinum/bulk-progress/get-bulk-allocation-list` | `BulkProgress/get-bulk-allocation-list` | Simple proxy |
| 44 | GET | `/api/platinum/bulk-progress/job-account-details/:jobId` | `BulkProgress/job-account-details/:jobId` | Logs sample record keys |
| 45 | GET | `/api/platinum/bulk-progress/direct-deposit/:jobId` | `BulkProgress/direct-deposit/:jobId` | Simple proxy |

### 2.21 Direct Deposit Errors

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 46 | GET | `/api/platinum/direct-deposit-errors/failed-jobs` | `DirectDepositErrors/failed-jobs` | No params |
| 47 | GET | `/api/platinum/direct-deposit-errors/job-details/:jobId` | `DirectDepositErrors/job-details/:jobId` | Simple proxy |
| 48 | GET | `/api/platinum/direct-deposit-errors/account-details/:jobId` | `DirectDepositErrors/account-details/:jobId` | Simple proxy |
| 49 | POST | `/api/platinum/direct-deposit-errors/retry/:jobId/:userId` | `DirectDepositErrors/retry/:jobId/:userId` | Retry failed job |

### 2.22 Third-Party Payments

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 50 | POST | `/api/platinum/third-party-payments/import` | `billing/pos/third-party-payments/import` | Simple proxy |
| 51 | GET | `/api/platinum/third-party-payments/:importId/transactions` | `billing/pos/third-party-payments/:importId/transactions` | Simple proxy |
| 52 | POST | `/api/platinum/third-party-payments/validate-account` | `billing/pos/third-party-payments/validate-account` | Simple proxy |
| 53 | POST | `/api/platinum/third-party-payments/:importId/reconcile` | `billing/pos/third-party-payments/:importId/reconcile` | Simple proxy |
| 54 | POST | `/api/platinum/third-party-payments/:importId/commit` | `billing/pos/third-party-payments/:importId/commit` | Logged with all params |
| 55 | PUT | `/api/platinum/third-party-payments/:importId/transactions/:index` | Same (PUT) | Raw fetch, 30s AbortController |
| 56 | POST | `/api/platinum/third-party-payments/:importId/validate-for-reconcile` | Same path | Simple proxy |
| 57 | GET | `/api/platinum/third-party-payments/account-search` | `billing/pos/third-party-payments/account-search` | Simple proxy |
| 58 | GET | `/api/platinum/third-party-payments/is-cashier-active` | `billing/pos/third-party-payments/is-cashier-active` | Simple proxy |
| 59 | GET | `/api/platinum/third-party-payments/cashier-details` | `billing/pos/third-party-payments/cashier-details` | Simple proxy |
| 60 | POST | `/api/platinum/third-party-payments/import-file` | `billing/pos/third-party-payments/import` | FormData file upload (see §2.23) |
| 61 | GET | `/api/platinum/third-party-payments/types` | `billing/pos/third-party-payments/types` | No params |

### 2.23 import-file — FormData Upload

Converts base64/text file content to a `Blob`, creates `FormData`, and POSTs to Platinum with `multipart/form-data`. Includes optional fields: `thirdpartyTypeId`, `paymentReference`, `cashBookId`. Raw fetch with 60s AbortController timeout.

---

## 3. supervisor.routes.ts — Supervisor Dashboard & Billing Dashboard

**Registration**: `registerSupervisorRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `platinumGet`, `platinumPost`, `platinumDelete`, `refreshSessionToken`, `getPlatinumApiUrl`

### 3.1 Endpoint Catalogue — Billing Enquiry (Supervisor Context)

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 1 | GET | `/api/platinum/billing-enquiry/deposit-amount` | `BillingEnquiry/DepositAmount` | Simple proxy |
| 2 | GET | `/api/platinum/billing-enquiry/deposits-by-account-id` | `BillingEnquiry/DepositsByAccountId` | Simple proxy |
| 3 | GET | `/api/platinum/billing-enquiry/receipt-transaction-detail` | `BillingEnquiry/getReceiptTransactionDetail` | Simple proxy |
| 4 | GET | `/api/platinum/billing-enquiry/total-balance-debt` | `BillingEnquiry/TotalBalanceDebtInquiry` | Simple proxy |
| 5 | POST | `/api/platinum/billing-enquiry/batch-account-names` | `BillingEnquiry/EnquiryResults` (batch) | Batch name resolution (see §3.2) |
| 6 | POST | `/api/platinum/billing-enquiry/batch-balance` | `BillingEnquiry/TotalBalanceDebtInquiry` (batch) | Batch balance lookup |
| 7 | GET | `/api/platinum/billing-enquiry/service-type-balance` | `BillingEnquiry/ServiceTypeBalance` | Simple proxy |
| 8 | POST | `/api/platinum/billing-enquiry/reconcile/:receiptId` | `BillingEnquiry/ReconcileReceipt` | Simple proxy |
| 9 | GET | `/api/platinum/billing-enquiry/linked-accounts-on-property` | `BillingEnquiry/LinkedAccountsOnProperty` | Complex linked account enrichment (see §3.3) |

### 3.2 batch-account-names

Accepts `{ accountNumbers: string[] }`. Limits to 100. Processes in batches of 10 via `Promise.allSettled`. For each account number:
- Strips leading zeros
- Calls `BillingEnquiry/EnquiryResults` with `{ accountID: stripped }`
- Extracts name from: `companyName`, `name`, `ownerName`, `accountName`
- Extracts address from: `locationAddress`, `address`, `propertyAddress`

Returns: `Record<string, { name: string, address: string }>`

### 3.3 linked-accounts-on-property

Multi-call enrichment (NOT a simple proxy):
1. Fetches property details via `BillingEnquiry/PropertyDetailsByAccountId` to get `propertyId`, `ownerName`, `sgNumber`
2. If SG number exists: searches via `BillingEnquiry/Autocomplete` (type=erfNumber) with digit extraction
3. If owner name exists (and <=1 SG match): searches by `companyName` via `BillingEnquiry/EnquiryResults`
4. Filters results to same property (matching sgNumber or propertyId/unitId)
5. Enriches each linked account with balance from `BillingEnquiry/TotalBalanceDebtInquiry` (max 20 accounts)

### 3.4 Endpoint Catalogue — Account Details (Enquiry Sub-Tabs)

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 10 | GET | `/api/platinum/billing-enquiry/property-details-by-account` | `BillingEnquiry/PropertyDetailsByAccount` | Simple proxy |
| 11 | GET | `/api/platinum/billing-enquiry/cons-unit-by-account` | `BillingEnquiry/ConsUnitByAccount` | Simple proxy |
| 12 | GET | `/api/platinum/billing-enquiry/name-info-by-account` | `BillingEnquiry/NameInfoByAccount` | Simple proxy |
| 13 | GET | `/api/platinum/billing-enquiry/handover-by-account` | `BillingEnquiry/HandoverByAccount` | Simple proxy |
| 14 | GET | `/api/platinum/billing-enquiry/payment-incentive-by-account` | `BillingEnquiry/PaymentIncentiveByAccount` | Simple proxy |
| 15 | GET | `/api/platinum/billing-enquiry/billed-vs-paid-amounts` | `BillingEnquiry/AccountInquiries` → `BilledVsPaidAmounts` → `DetailedTransactionResults` | 3-tier fallback with month extraction (see §3.5) |

### 3.5 billed-vs-paid-amounts — 3-Tier Fallback

1. **Try**: `BillingEnquiry/AccountInquiries` (accountId + finYear) — returns monthly rows directly
2. **Fallback 1**: `BillingEnquiry/BilledVsPaidAmounts` — standard endpoint
3. **Fallback 2**: `BillingEnquiry/DetailedTransactionResults` → extracts transGroup 900 (total) and 915 (receipts) rows, builds monthly billing vs paid array from July-June fiscal year columns

### 3.6 Dynamic Enquiry Endpoints (Loop-Generated — 74 routes)

A 75-entry registry array `billingEnquiryGetEndpoints` maps `[localPath, platinumEndpoint]` pairs. At startup, a `for` loop registers GET handlers for each entry (skipping `billed-vs-paid-amounts` which has its own explicit handler above). Each maps `GET /api/platinum/billing-enquiry/{localPath}` → `GET /api/BillingEnquiry/{platinumEndpoint}`.

**Notable mappings include** (local → Platinum):
- `basic-account-details` → `BasicAccountDetails`
- `partition-details` → `PartitionDetails`
- `debit-order-deduction-by-account` → `debitorderdeductionbyaccountid`
- `bank-guarantee-history` → `GetBankGuaranteetHistory` (Platinum typo: extra 't')
- `billing-calculation-popup-data` → `getBillingalculationPopupDataDetails` (Platinum typo: missing 'C')
- `meter-reading-history` → `meter-reading-history` (lowercase Platinum endpoint)
- `section129-account-enquiry` → `GetSection129AccountEnquiry`
- `handover-account-enquiry` → `getHandoverAccountEnquiry`
- `search-by-bank-statement-note` → `SearchByBankStatementNote`
- `get-eft-bank-statement-notes` → `GetEftBankStatementNotes`
- `valuation-by-id` → `ValuationById`
- `supplementary-valuations` → `SupplementaryValuations`
- `transfer-ownership` → `TransferOwnerShip`
- `clearance-inquiries` → `ClearanceInquiries`
- `prepaid-meter-services-for-account` → `PrepaidMeterServicesForAccount`
- `prepaid-recharge-details-for-meter` → `getPrepaidRechargeDetailsForMeter`

**Special logging**: `get-billing-period-transactions`, `prepaid-meter-services-for-account`, and `prepaid-recharge-details-for-meter` have additional console logging for response shape inspection.

Full list: 75 entries covering BasicAccountDetails, PartitionDetails, UnitPartitionOwner, Property, ConsUnitSearch, debitorderdeductionbyaccountid, AccountNotifications, RepaymentPlanStatus, AllotmentDescriptionById, SectionalTitleScheme, AccountInfoResult, AccountServiceMeterPerProperty, AccountDeliveryAddressDetail, AdditionalBillingSearchResults, ServicesSearchResults, GetBankGuaranteetHistory, PaymentExtensionSearchResults, DetailedTransactionResults, getBillingPeriodTransactions, AllServices, PaymentPlanRemainingCapitalAmount, PaymentAmountByAccountIds, ChequeFinalSearchList, ChequeWriteBackDetail, PaymentPlansByAccountId, PaymentIncentiveJournals, MeteredServicesOnAccount, ValuationById, ValuationByUnit, ValuationImportById, SupplementaryValuations, RatesRunHistory, GetAccountRatesDetails, UnitLinkedMeters, TransferOwnerShip, ClearanceInquiries, PrepaidMeterServicesForAccount, Periods, AttpApplicationHistory, DebtorNoteLists, AccountInquiries, AddOccupiers, Autocomplete, meter-reading-history, meter-reading-history-barchart, get-status, get-departmental-accounts-by-id, get-generated-statements-by-id, getBillingTemplate, getDetailBillingTemplate, get-contactdetails-history-by-id, get-delivery-address-history-by-id, get-delivery-account-details-by-id, getPropertyNotification, getBillingProcessingMonth, getLevyTransactionDetail, getOpenBalanceDetail, getCloseBalanceDetail, getJournalTransactionDetails, getRebateTransactionDetail, getInterestConsPaymentTransactionDetail, getInterestLatePaymentTransactionDetail, getPrepaidRechargeDetailsForMeter, GetSection129AccountEnquiry, getDebitOrderDeduction, getHandoverAccountEnquiry, BilledVsPaidAmounts, getConsHandoverTransactionDetail, getMeterInfoById, PaymentsReceived, lookups, getBillingalculationPopupDataDetails, CheckFileExists, SearchByBankStatementNote, GetEftBankStatementNotes

### 3.6 Statement & Document Endpoints

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| ... | POST | `/api/platinum/billing-enquiry/generate-statement` | `BillingEnquiry/GenerateStatement` | PDF generation |
| ... | GET | `/api/platinum/clearance-document-download` | `billing-payment-clearance/clearance-document-download` | Binary file passthrough |
| ... | GET | `/api/platinum/statement-download` | `BillingEnquiry/StatementDownload` | Binary file passthrough |
| ... | POST | `/api/platinum/billing-enquiry/search` | `BillingEnquiry/Search` | Simple proxy |
| ... | POST | `/api/platinum/billing-enquiry/add-occupier` | `BillingEnquiry/AddOccupier` | Simple proxy |
| ... | DELETE | `/api/platinum/billing-enquiry/add-occupier` | `BillingEnquiry/DeleteOccupier` | Uses `platinumDelete` (no concurrency slot) |

### 3.7 Billing Dashboard Endpoints

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| ... | GET | `/api/platinum/billing-dashboard/pos-count` | `BillingDashboard/POSCount` | No params |
| ... | GET | `/api/platinum/billing-dashboard/pos-tab-item-details-count` | `BillingDashboard/POSTabItemDetailsCount` | No params |
| ... | POST | `/api/platinum/billing-dashboard/get-deposit-table-data` | `BillingDashboard/GetDepositTableData` | Simple proxy |
| ... | POST | `/api/platinum/billing-dashboard/get-direct-deposits-allocation-table-data` | `BillingDashboard/GetDirectDepositsAllocationTableData` | Simple proxy |
| ... | POST | `/api/platinum/billing-dashboard/get-third-party-payment-pending-table-data` | `BillingDashboard/GetThirdPartyPaymentPendingTableData` | Simple proxy |
| ... | GET | `/api/platinum/billing-dashboard/get-alert-counts` | `BillingDashboard/GetAlertCounts` | No params |
| ... | GET | `/api/platinum/billing-dashboard/get-notification-counts` | `BillingDashboard/GetNotificationCounts` | No params |
| ... | GET | `/api/platinum/billing-dashboard/get-billing-payment-by-type-of-use` | `BillingDashboard/GetBillingPaymentByTypeOfUse` | Simple proxy |
| ... | GET | `/api/platinum/billing-dashboard/account-count` | `BillingDashboard/AccountCount` | No params |
| ... | POST | `/api/platinum/billing-dashboard/get-post-dated-cheque-search-table-data` | `BillingDashboard/GetPostDatedChequeSearchTableData` | Simple proxy |
| ... | GET | `/api/platinum/billing-dashboard/consumption-count` | `BillingDashboard/ConsumptionCount` | No params |
| ... | GET | `/api/platinum/billing-dashboard/debt-count` | `BillingDashboard/DebtCount` | No params |
| ... | GET | `/api/platinum/billing-dashboard/billing-count` | `BillingDashboard/BillingCount` | No params |
| ... | GET | `/api/platinum/billing-dashboard/property-count` | `BillingDashboard/PropertyCount` | No params |
| ... | GET | `/api/platinum/billing-dashboard/indigentsubsidy-count` | `BillingDashboard/IndigentSubsidyCount` | No params |
| ... | GET | `/api/platinum/billing-dashboard/journal-count` | `BillingDashboard/JournalCount` | No params |
| ... | GET | `/api/platinum/billing-dashboard/rebate-count` | `BillingDashboard/RebateCount` | No params |
| ... | GET | `/api/platinum/billing-dashboard/assets-count` | `BillingDashboard/AssetsCount` | No params |

---

## 4. receipts.routes.ts — Receipt Management, Account Lookup, AI Description Parsing

**Registration**: `registerReceiptsRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `parseReceiptAllocations`, `platinumGet`, `platinumPost`, `refreshSessionToken`, `getPlatinumApiUrl`, `execSync`, `writeFileSync`, `unlinkSync`, `existsSync`, `OpenAI`
**External Dependencies**: `openai` (for AI description parsing)

### 4.1 Endpoint Catalogue — Configuration & Search

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 1 | GET | `/api/platinum/billing-config` | `BillingEnquiry/GetAppSetting` (batch) | Fetches 3 config keys in parallel (see §4.2) |
| 2 | GET | `/api/platinum/cons-accounts/search` | `cons-accounts/search` | Simple proxy |
| 3 | GET | `/api/platinum/billing-enquiry-search` | `billing-enquiry-search` | Simple proxy |
| 4 | GET | `/api/platinum/const-institutions` | 4 fallback endpoints | Multi-endpoint fallback (see §4.3) |
| 5 | GET | `/api/platinum/const-institutions/search` | Same endpoints filtered | Client-side name filtering |

### 4.2 billing-config — Batch App Settings

Fetches 3 specific config keys in parallel via `Promise.allSettled`:
- `"Allow Prepaid And Miscellaneous"`
- `"Allow Prepaid And Recovery"`
- `"Allow Normal Receipting"`

Returns: `Record<string, any>` mapping key→value (string values have quotes stripped).

### 4.3 const-institutions — Multi-Endpoint Fallback

Tries up to 4 Platinum endpoints in order:
1. `receipting-account-group/search`
2. `receipting-account-group/get-account-groups` (if finYear available)
3. `const-institutions`
4. `BillingEnquiry/GetConstInstitutions`

Returns first non-empty array response. If all empty → returns `[]`.

### 4.4 Endpoint Catalogue — Account Details

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 6 | GET | `/api/platinum/cons-accounts/:id` | `cons-accounts/:id` | Simple proxy |
| 7 | GET | `/api/platinum/accounts-by-name-id` | Multiple fallback endpoints | Complex name-based lookup |
| 8 | GET | `/api/platinum/cons-names/:id` | `cons-names/:id` | Simple proxy |
| 9 | GET | `/api/platinum/cons-units/:id` | `cons-units/:id` | Simple proxy |
| 10 | GET | `/api/platinum/account-full-details/:id` | `ReceiptPrepaid/cons-account-details` | Simple proxy |

### 4.5 Endpoint Catalogue — Staged/Prepaid Receipt Operations

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 11 | GET | `/api/platinum/billing-stage-cashier-receipt-details/reference` | `billing-stage-cashier-receipt-details/reference` | Simple proxy |
| 12 | GET | `/api/platinum/billing-stage-prepaid-recharge/:id` | `billing-stage-prepaid-recharge/:id` | Simple proxy |
| 13 | GET | `/api/platinum/billing-stage-prepaid-recovery/:identifier` | `billing-stage-prepaid-recovery/:identifier` | Simple proxy |
| 14 | GET | `/api/platinum/billing-stage-prepaid-recovery/reference` | `billing-stage-prepaid-recovery/reference` | Simple proxy |
| 15 | POST | `/api/platinum/pos-multiple-account-payments/:capturerId/:accountId/receipt/:receiptId` | Same path | Simple proxy |

### 4.6 Endpoint Catalogue — Receipt Print/Search

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 16 | GET | `/api/platinum/pos-multi-receipt-print` | `billing-payment/pos-multi-receipt-print` | Complex receipt retrieval with pagination |
| 17 | GET | `/api/platinum/pos-multi-receipt-print/by-cashier` | Same | Cashier-filtered receipt search |
| 18 | GET | `/api/platinum/pos-multi-receipt-print/search` | Same | Search-based receipt lookup |
| 19 | GET | `/api/platinum/pos-multi-receipt-print/batch` | Same | Batch receipt retrieval |

### 4.7 AI Description Parsing

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 20 | POST | `/api/ai/parse-description` | None (OpenAI) | AI-powered EFT description parsing (see §4.8) |
| 21 | POST | `/api/ai/parse-descriptions-batch` | None (OpenAI) | Batch version (see §4.9) |

### 4.8 parse-description — AI Description Parser

Uses OpenAI integration to parse bank statement EFT descriptions and extract:
- Account number (ERF number, meter number)
- Payment reference
- Payer name
- Area/location hints

The AI model analyzes free-text bank descriptions like "MAGTAPE CREDIT USER 9524 SEQ/ABSA BANK Erf nr 226/16" and returns structured data for auto-allocation matching.

### 4.9 parse-descriptions-batch

Same as parse-description but accepts an array of descriptions and processes them in batch for efficiency.

---

## 5. debt.routes.ts — Debt Management (Section 129, Handover, Config)

**Registration**: `registerDebtRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `requireDebtPermission`, `injectAuditFields`, `DEBT_PERMISSIONS`, `platinumGet`, `platinumPost`, `getSiteConfig`, `getPlatinumApiUrl`
**Authorization**: Uses `requireDebtPermission` with `DEBT_PERMISSIONS` enum for write operations

### 5.1 Endpoint Catalogue — Section 129 Notice Lifecycle

| # | Method | Local Route | Platinum Endpoint | Permission | Special Behavior |
|---|---|---|---|---|---|
| 1 | GET | `/api/platinum/billing-debt/section129-config` | `BillingDebt/section129-config` | Auth only | Config read |
| 2 | GET | `/api/platinum/billing-debt/section129-runs` | `BillingDebt/section129-runs` | Auth only | List runs |
| 3 | POST | `/api/platinum/billing-debt/section129-trial-run` | `BillingDebt/section129-trial-run` | PROCESS_SECTION129 | Audit fields injected |
| 4 | POST | `/api/platinum/billing-debt/section129-trial-review-submit` | `BillingDebt/section129-trial-review-submit` | PROCESS_SECTION129 | Audit fields with `isReview: true` |
| 5 | POST | `/api/platinum/billing-debt/section129-authorize` | `BillingDebt/section129-authorize` | AUTHORISE_SECTION129 | Different permission than process |
| 6 | POST | `/api/platinum/billing-debt/section129-final-run` | `BillingDebt/section129-final-run` | PROCESS_SECTION129 | Audit fields injected |
| 7 | GET | `/api/platinum/billing-debt/section129-run-accounts` | `BillingDebt/section129-run-accounts` | Auth only | List accounts in run |
| 8 | GET | `/api/platinum/billing-debt/section129-run-status` | `BillingDebt/section129-run-status` | Auth only | Run status |
| 9 | POST | `/api/platinum/billing-debt/section129-delete-run` | `BillingDebt/section129-delete-run` | PROCESS_SECTION129 | Audit fields injected |

### 5.2 Endpoint Catalogue — Handover Management

| # | Method | Local Route | Platinum Endpoint | Permission | Special Behavior |
|---|---|---|---|---|---|
| 10 | GET | `/api/platinum/billing-debt/handover-list` | `BillingDebt/handover-list` | Auth only | List handovers |
| 11 | POST | `/api/platinum/billing-debt/handover-submit` | `BillingDebt/handover-submit` | HANDOVER_PROCESS | Audit fields injected |
| 12 | POST | `/api/platinum/billing-debt/handover-terminate` | `BillingDebt/handover-terminate` | HANDOVER_PROCESS | Audit fields with `isTermination: true` |

### 5.3 Endpoint Catalogue — Lookups & Reference Data

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 13 | GET | `/api/platinum/billing-debt/attorney-list` | `BillingDebt/attorney-list` | Simple proxy |
| 14 | GET | `/api/platinum/billing-debt/billing-cycles` | `BillingDebt/billing-cycles` | Simple proxy |
| 15 | GET | `/api/platinum/billing-debt/towns` | `BillingDebt/towns` | Simple proxy |
| 16 | GET | `/api/platinum/billing-debt/additional-billing-types` | `BillingDebt/additional-billing-types` | Simple proxy |
| 17 | GET | `/api/platinum/billing-debt/property-categories` | `BillingDebt/property-categories` | Simple proxy |
| 18 | GET | `/api/platinum/billing-debt/account-types` | `BillingDebt/account-types` | Simple proxy |
| 19 | GET | `/api/platinum/billing-debt/person-types` | `BillingDebt/person-types` | Simple proxy |
| 20 | GET | `/api/platinum/billing-debt/ageing-ranges` | `BillingDebt/ageing-ranges` | Simple proxy |

### 5.4 Endpoint Catalogue — Reports

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 21 | GET | `/api/platinum/billing-debt/section129-report` | `BillingDebt/section129-report` | Simple proxy |
| 22 | GET | `/api/platinum/billing-debt/handover-report` | `BillingDebt/handover-report` | Simple proxy |
| 23 | GET | `/api/platinum/billing-debt/sms-log-report` | `BillingDebt/sms-log-report` | Simple proxy |

### 5.5 Endpoint Catalogue — Section 129 Configuration

| # | Method | Local Route | Platinum Endpoint | Permission | Special Behavior |
|---|---|---|---|---|---|
| 24 | GET | `/api/platinum/billing-debt/section129-config-list` | `BillingDebt/section129-config-list` | Auth only | List configs |
| 25 | POST | `/api/platinum/billing-debt/section129-config-save` | `BillingDebt/section129-config-save` | PROCESS_SECTION129 | Audit fields |
| 26 | GET | `/api/platinum/billing-debt/section129-templates` | `BillingDebt/section129-templates` | Auth only | Letter templates |
| 27 | GET | `/api/platinum/billing-debt/section129-sms-templates` | `BillingDebt/section129-sms-templates` | Auth only | SMS templates |

### 5.6 Endpoint Catalogue — Run Files & Downloads

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 28 | GET | `/api/platinum/billing-debt/section129-run-files` | `BillingDebt/section129-run-files` | Simple proxy |
| 29 | GET | `/api/platinum/billing-debt/section129-download-file` | `BillingDebt/section129-download-file` | Binary file download (see §5.7) |

### 5.7 section129-download-file — Binary Download

Bypasses `platinumGet` for binary file download:
1. Resolves API URL from site config
2. Constructs URL with query params
3. Fetches with Bearer token
4. Forwards Content-Type and Content-Disposition headers
5. Sends binary buffer to client

---

## 6. legal.routes.ts — Legal Compliance, Risk Scoring, Qualification Rules

**Registration**: `registerLegalRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `requireLegalAdmin`, `injectAuditFields`, `platinumGet`, `platinumPost`
**Authorization**: Uses `requireLegalAdmin` for all write operations
**Platinum API Pattern**: ALL endpoints map to `/api/BillingDebt/*`

### 6.1 Endpoint Catalogue — Legal Rules (CRUD)

| # | Method | Local Route | Platinum Endpoint | Auth | Special Behavior |
|---|---|---|---|---|---|
| 1 | GET | `/api/legal/rules` | `BillingDebt/legal-rules` | Auth only | Read |
| 2 | POST | `/api/legal/rules` | `BillingDebt/legal-rules` | requireLegalAdmin | Create; audit fields |
| 3 | PUT | `/api/legal/rules/:id` | `BillingDebt/legal-rules-update` | requireLegalAdmin | Update; merges `:id` into body |
| 4 | DELETE | `/api/legal/rules/:id` | `BillingDebt/legal-rules-deactivate` | requireLegalAdmin | Soft delete via POST |

**HTTP Method Mapping**: PUT→POST (Platinum uses `*-update` endpoint), DELETE→POST (Platinum uses `*-deactivate` endpoint).

### 6.2 Endpoint Catalogue — Compliance Log & Evidence

| # | Method | Local Route | Platinum Endpoint | Auth | Special Behavior |
|---|---|---|---|---|---|
| 5 | GET | `/api/legal/compliance-log` | `BillingDebt/compliance-log` | Auth only | Query params |
| 6 | GET | `/api/legal/compliance-log/:entityId` | `BillingDebt/compliance-log` | Auth only | `entityId` as query param |
| 7 | POST | `/api/legal/evidence-bundle` | `BillingDebt/evidence-bundle` | requireLegalAdmin | Create bundle; audit fields |
| 8 | GET | `/api/legal/evidence-bundles` | `BillingDebt/evidence-bundles` | Auth only | List bundles |
| 9 | GET | `/api/legal/evidence-bundle/:id` | `BillingDebt/evidence-bundle` | Auth only | `id` as query param |

### 6.3 Endpoint Catalogue — Legal Action Validation

| # | Method | Local Route | Platinum Endpoint | Auth | Special Behavior |
|---|---|---|---|---|---|
| 10 | POST | `/api/legal/validate-action` | `BillingDebt/validate-legal-action` | Auth only | Audit fields |

### 6.4 Endpoint Catalogue — Risk Scoring

| # | Method | Local Route | Platinum Endpoint | Auth | Special Behavior |
|---|---|---|---|---|---|
| 11 | POST | `/api/debt-scoring/score-account` | `BillingDebt/score-account` | Auth only | Audit fields |
| 12 | POST | `/api/debt-scoring/score-bulk` | `BillingDebt/score-bulk` | Auth only | Audit fields |
| 13 | GET | `/api/debt-scoring/scores` | `BillingDebt/risk-scores` | Auth only | Query params |
| 14 | GET | `/api/debt-scoring/scores/:accountNo` | `BillingDebt/risk-scores` | Auth only | `accountNo` as query param |
| 15 | GET | `/api/debt-scoring/weights` | `BillingDebt/scoring-weights` | Auth only | No params |
| 16 | PUT | `/api/debt-scoring/weights` | `BillingDebt/scoring-weights` | requireLegalAdmin | Update; audit fields |

### 6.5 Endpoint Catalogue — Qualification Rules (CRUD + Run)

| # | Method | Local Route | Platinum Endpoint | Auth | Special Behavior |
|---|---|---|---|---|---|
| 17 | GET | `/api/debt-scoring/qualification-rules` | `BillingDebt/qualification-rules` | Auth only | Query params |
| 18 | GET | `/api/debt-scoring/qualification-rules/:id` | `BillingDebt/qualification-rules` | Auth only | `id` as query param |
| 19 | POST | `/api/debt-scoring/qualification-rules` | `BillingDebt/qualification-rules` | requireLegalAdmin | Create; audit fields |
| 20 | PUT | `/api/debt-scoring/qualification-rules/:id` | `BillingDebt/qualification-rules-update` | requireLegalAdmin | Update; merges `:id` |
| 21 | DELETE | `/api/debt-scoring/qualification-rules/:id` | `BillingDebt/qualification-rules-delete` | requireLegalAdmin | Soft delete via POST |
| 22 | POST | `/api/debt-scoring/qualification-rules/:id/run` | `BillingDebt/qualification-rules-run` | Auth only | Runs rule; audit fields |

---

## 7. communications.routes.ts — Communication Engine

**Registration**: `registerCommunicationsRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `requireLegalAdmin`, `injectAuditFields`, `platinumGet`, `platinumPost`
**Authorization**: `requireLegalAdmin` required for all write operations (POST, PUT, DELETE)
**Platinum API Pattern**: ALL endpoints map to `/api/BillingDebt/communication-*`

### 7.1 Endpoint Catalogue

| # | Method | Local Route | Platinum Endpoint | Auth | Special Behavior |
|---|---|---|---|---|---|
| 1 | GET | `/api/communications/timelines` | `BillingDebt/communication-timelines` | Auth only | List timelines |
| 2 | GET | `/api/communications/timelines/:id` | `BillingDebt/communication-timelines` | Auth only | Single timeline by `id` query param |
| 3 | POST | `/api/communications/timelines` | `BillingDebt/communication-timelines` | requireLegalAdmin | Create; audit fields |
| 4 | PUT | `/api/communications/timelines/:id` | `BillingDebt/communication-timelines-update` | requireLegalAdmin | PUT→POST; merges `:id` |
| 5 | DELETE | `/api/communications/timelines/:id` | `BillingDebt/communication-timelines-delete` | requireLegalAdmin | DELETE→POST; sends `{ id }` |
| 6 | PUT | `/api/communications/timelines/:id/steps` | `BillingDebt/communication-timeline-steps` | requireLegalAdmin | PUT→POST; sends `{ timelineId, ...body }` |
| 7 | POST | `/api/communications/dispatch` | `BillingDebt/communication-dispatch` | requireLegalAdmin | Single dispatch; audit fields |
| 8 | POST | `/api/communications/dispatch-bulk` | `BillingDebt/communication-dispatch-bulk` | requireLegalAdmin | Bulk dispatch; audit fields |
| 9 | POST | `/api/communications/enroll` | `BillingDebt/communication-enroll` | requireLegalAdmin | Enroll account; audit fields |
| 10 | POST | `/api/communications/process-scheduled` | `BillingDebt/communication-process-scheduled` | requireLegalAdmin | Trigger scheduled processing; empty body `{}` |
| 11 | GET | `/api/communications/log` | `BillingDebt/communication-log` | Auth only | Query params |
| 12 | GET | `/api/communications/scheduled` | `BillingDebt/communication-scheduled` | Auth only | Query params |
| 13 | GET | `/api/communications/stats` | `BillingDebt/communication-stats` | Auth only | No params |

### 7.2 HTTP Method Mapping Pattern

This file demonstrates the consistent pattern used across debt/legal/comms routes:
- **PUT** routes map to Platinum `*-update` POST endpoints (no native PUT support)
- **DELETE** routes map to Platinum `*-delete` POST endpoints (no native DELETE support)
- Route params (`:id`) are merged into the request body with `parseInt`

---

## 8. analytics.routes.ts — Analytics, Batch Processing, Monitoring, Documents, Signatures, Process Engine

**Registration**: `registerAnalyticsRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `requireLegalAdmin`, `injectAuditFields`, `platinumGet`, `platinumPost`
**Authorization**: `requireLegalAdmin` required for ALL endpoints (reads and writes)
**Platinum API Pattern**: Maps to `/api/BillingDashboard/*` (analytics) and `/api/BillingDebt/*` (all other sections)

### 8.1 Endpoint Catalogue — Executive Dashboard (BillingDashboard)

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 1 | GET | `/api/analytics/debt-overview` | `BillingDashboard/debt-overview` | requireLegalAdmin |
| 2 | GET | `/api/analytics/aging-analysis` | `BillingDashboard/aging-analysis` | requireLegalAdmin |
| 3 | GET | `/api/analytics/recovery-stats` | `BillingDashboard/recovery-stats` | requireLegalAdmin |
| 4 | GET | `/api/analytics/legal-pipeline` | `BillingDashboard/legal-pipeline` | requireLegalAdmin |
| 5 | GET | `/api/analytics/attorney-performance` | `BillingDashboard/attorney-performance` | requireLegalAdmin |
| 6 | GET | `/api/analytics/risk-distribution` | `BillingDashboard/risk-distribution` | requireLegalAdmin |
| 7 | GET | `/api/analytics/predictive-forecasting` | `BillingDashboard/predictive-forecasting` | requireLegalAdmin |
| 8 | GET | `/api/analytics/geographic-distribution` | `BillingDashboard/geographic-distribution` | requireLegalAdmin |

### 8.2 Endpoint Catalogue — Batch Processing (BillingDebt)

| # | Method | Local Route | Platinum Endpoint | Auth | Special Behavior |
|---|---|---|---|---|---|
| 9 | GET | `/api/batch-processing/jobs` | `BillingDebt/batch-jobs` | Auth only (reads) | Query params |
| 10 | GET | `/api/batch-processing/schedules` | `BillingDebt/batch-schedules` | Auth only | Query params |
| 11 | POST | `/api/batch-processing/trigger` | `BillingDebt/batch-trigger` | requireLegalAdmin | Audit fields |
| 12 | POST | `/api/batch-processing/cancel` | `BillingDebt/batch-cancel` | requireLegalAdmin | Audit fields |

### 8.3 Endpoint Catalogue — Process Monitoring (BillingDebt)

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 13 | GET | `/api/process-monitoring/overview` | `BillingDebt/process-monitoring-overview` | Auth only |
| 14 | GET | `/api/process-monitoring/active-runs` | `BillingDebt/process-active-runs` | Auth only |
| 15 | GET | `/api/process-monitoring/failed-runs` | `BillingDebt/process-failed-runs` | Auth only |
| 16 | GET | `/api/process-monitoring/pending-approvals` | `BillingDebt/process-pending-approvals` | Auth only |
| 17 | GET | `/api/process-monitoring/handover-queues` | `BillingDebt/process-handover-queues` | Auth only |
| 18 | GET | `/api/process-monitoring/termination-queues` | `BillingDebt/process-termination-queues` | Auth only |

### 8.4 Endpoint Catalogue — Document Templates (BillingDebt)

| # | Method | Local Route | Platinum Endpoint | Auth | Special Behavior |
|---|---|---|---|---|---|
| 19 | GET | `/api/document-templates` | `BillingDebt/document-templates` | Auth only | List templates |
| 20 | GET | `/api/document-templates/:templateId/versions` | `BillingDebt/document-templates/:templateId/versions` | Auth only | Version history |
| 21 | POST | `/api/document-templates` | `BillingDebt/document-templates` | requireLegalAdmin | Create; audit fields |
| 22 | PUT | `/api/document-templates/:templateId` | `BillingDebt/document-templates/:templateId` | requireLegalAdmin | PUT→POST |
| 23 | POST | `/api/document-templates/:templateId/upload` | `BillingDebt/document-templates/:templateId/upload` | requireLegalAdmin | File upload; audit fields |
| 24 | GET | `/api/document-templates/:templateId/download` | `BillingDebt/document-templates/:templateId/download` | Auth only | File download |

### 8.5 Endpoint Catalogue — Digital Signatures (BillingDebt)

| # | Method | Local Route | Platinum Endpoint | Auth | Special Behavior |
|---|---|---|---|---|---|
| 25 | GET | `/api/digital-signatures` | `BillingDebt/digital-signatures` | Auth only | List signatures |
| 26 | GET | `/api/digital-signatures/audit-log` | `BillingDebt/digital-signatures/audit-log` | Auth only | Audit log |
| 27 | GET | `/api/digital-signatures/:requestId` | `BillingDebt/digital-signatures/:requestId` | Auth only | Single request |
| 28 | POST | `/api/digital-signatures` | `BillingDebt/digital-signatures` | requireLegalAdmin | Create; audit fields |

### 8.6 Endpoint Catalogue — Process Engine Workflows (BillingDebt)

| # | Method | Local Route | Platinum Endpoint | Auth | Special Behavior |
|---|---|---|---|---|---|
| 29 | GET | `/api/process-engine/workflows` | `BillingDebt/process-workflows` | Auth only | List workflows |
| 30 | GET | `/api/process-engine/workflows/:workflowId` | `BillingDebt/process-workflows/:workflowId` | Auth only | Single workflow |
| 31 | POST | `/api/process-engine/workflows` | `BillingDebt/process-workflows` | requireLegalAdmin | Create; audit fields |
| 32 | PUT | `/api/process-engine/workflows/:workflowId` | `BillingDebt/process-workflows/:workflowId` | requireLegalAdmin | PUT→POST |
| 33 | DELETE | `/api/process-engine/workflows/:workflowId` | `BillingDebt/process-workflows/:workflowId/delete` | requireLegalAdmin | DELETE→POST |
| 34 | GET | `/api/process-engine/workflows/:workflowId/stages` | `BillingDebt/process-workflows/:workflowId/stages` | Auth only | List stages |
| 35 | POST | `/api/process-engine/workflows/:workflowId/stages` | Same | requireLegalAdmin | Create stage; audit fields |
| 36 | PUT | `/api/process-engine/workflows/:workflowId/stages/:stageId` | Same with `:stageId` | requireLegalAdmin | PUT→POST |
| 37 | DELETE | `/api/process-engine/workflows/:workflowId/stages/:stageId` | `*/delete` | requireLegalAdmin | DELETE→POST |
| 38 | POST | `/api/process-engine/workflows/:workflowId/stages/reorder` | `*/stages/reorder` | requireLegalAdmin | Reorder stages; audit fields |

---

## 9. Cross-Cutting Patterns Across Phase 15 Routes

### 9.1 Authorization Model

| Route File | Read Auth | Write Auth | Permission System |
|---|---|---|---|
| deposits.routes.ts | requireAuth | requireAuth | No additional permissions |
| supervisor.routes.ts | requireAuth | requireAuth | No additional permissions |
| receipts.routes.ts | requireAuth | requireAuth | No additional permissions |
| debt.routes.ts | requireAuth | requireDebtPermission | DEBT_PERMISSIONS enum (PROCESS_SECTION129, AUTHORISE_SECTION129, HANDOVER_PROCESS) |
| legal.routes.ts | requireAuth | requireLegalAdmin | Role-based (superUser check) |
| communications.routes.ts | requireAuth | requireLegalAdmin | Role-based |
| analytics.routes.ts | requireLegalAdmin (ALL) | requireLegalAdmin | Role-based — even reads require admin |

### 9.2 Audit Field Injection

Used by: debt.routes.ts, legal.routes.ts, communications.routes.ts, analytics.routes.ts

`injectAuditFields(session, body, options?)` adds:
- `auditUserId`: session user ID
- `auditUserName`: session user name
- `auditTimestamp`: ISO timestamp
- Optional flags: `isReview`, `isTermination`

### 9.3 HTTP Method Translation

The Platinum API does not support PUT or DELETE natively. All route files use this mapping:
- **PUT** → `platinumPost` to `*-update` endpoint
- **DELETE** → `platinumPost` to `*-delete` or `*-deactivate` endpoint

Route parameters (`:id`) are always parsed via `parseInt` and merged into the request body.

### 9.4 Platinum API Controller Distribution

| Platinum Controller | Endpoint Count | Route File(s) |
|---|---|---|
| `billing-direct-deposit-allocation` | ~25 | deposits |
| `BillingEnquiry` | ~20 | supervisor, receipts |
| `BillingDebt` | ~65 | debt, legal, communications, analytics |
| `BillingDashboard` | ~25 | supervisor, analytics |
| `billing/auth-day-end-reconcile` | ~5 | supervisor |
| `billing/direct-deposit-bulk-allocation` | 4 | deposits |
| `billing/pos/third-party-payments` | 12 | deposits |
| `BulkProgress` | 6 | deposits |
| `DirectDepositErrors` | 4 | deposits |
| `ReceiptPrepaid` | ~5 | deposits, receipts |
| OpenAI | 2 | receipts |

---

## 10. Complete Route Endpoint Summary (Phase 14 + 15)

| Route File | Declared | Loop-Generated | Effective | Category |
|---|---|---|---|---|
| auth.routes.ts | 8 | 0 | 8 | Core Auth |
| pos.routes.ts | 25 | 0 | 25 | Core POS |
| billing.routes.ts | 16 | 0 | 16 | Core Payments |
| clearance.routes.ts | 17 | 0 | 17 | Core Clearance |
| enquiries.routes.ts | 13 | 0 | 13 | Core Enquiries |
| dayend.routes.ts | 49 | 0 | 49 | Core Day-End |
| deposits.routes.ts | 61 | 0 | 61 | Extended Deposits |
| supervisor.routes.ts | 65 | +74 | 139 | Extended Supervisor |
| receipts.routes.ts | 21 | 0 | 21 | Extended Receipts |
| debt.routes.ts | 29 | 0 | 29 | Extended Debt |
| legal.routes.ts | 22 | 0 | 22 | Extended Legal |
| communications.routes.ts | 13 | 0 | 13 | Extended Comms |
| analytics.routes.ts | 38 | 0 | 38 | Extended Analytics |
| **Grand Total** | **377** | **+74** | **451** | **13 route files** |

---

*End of Phase 15 — Extended Server Route Handlers*

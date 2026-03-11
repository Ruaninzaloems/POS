# PHASE 10-11: CASHIER/POS & DEPOSITS/REPORTING — DETAIL PACK

**Document Version**: 1.1 (corrected after code review)
**Date**: 11 March 2026
**Scope**: All 16 remaining Angular components outside the debt/legal modules
**Phases Covered**: Phase 10 (Cashier/POS cluster), Phase 11 (Deposits/Reporting cluster)

---

## TABLE OF CONTENTS

1. [Phase 10 Component Inventory](#phase-10-component-inventory)
2. [Phase 11 Component Inventory](#phase-11-component-inventory)
3. [Frontend → Backend Route Cross-Reference](#frontend-backend-route-cross-reference)
4. [Platinum API Endpoint Map](#platinum-api-endpoint-map)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Identified Gaps & Observations](#identified-gaps--observations)
7. [Server Route File Inventory](#server-route-file-inventory)

---

## 1. PHASE 10 COMPONENT INVENTORY

### 1.1 LoginComponent
- **Path**: `angular-client/src/app/features/auth/login/login.component.ts`
- **Route**: `/login`
- **Lines**: ~280
- **Purpose**: Site selection + credential authentication against Platinum
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `GET /api/sites` | `auth.routes.ts` — `app.get("/api/sites")` | None (static SITE_CONFIGS) |
  | `POST /api/auth/login` | `auth.routes.ts` — `app.post("/api/auth/login")` | `POST /auth/createToken` |
  | `GET /api/auth/status` | `auth.routes.ts` — `app.get("/api/auth/status")` | None (session check) |
- **Key Patterns**: Multi-site support (George + Site02), lockout cache clearing, session cookie storage

### 1.2 CashierSetupComponent
- **Path**: `angular-client/src/app/features/cashier/cashier-setup.component.ts`
- **Route**: Embedded in POS Workflow Tab 1
- **Lines**: ~650
- **Purpose**: Cashier session registration — office selection, float entry, receipt range validation
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `GET /api/platinum/auth/active-cashier-by-userid` | `auth.routes.ts` | `GET /api/ReceiptPrepaid/validate-cashier` (primary), fallbacks to `active-cashierid-by-userid`, `cashier-detailsById`, `cashier-list` |
  | `GET /api/platinum/receipt-prepaid/cash-offices` | `pos.routes.ts` | `GET /api/ReceiptPrepaid/cash-offices` + `GET /api/billing/auth-day-end-reconcile/cash-office-list` (merged + probed) |
  | `GET /api/platinum/receipt-prepaid/cashier-payment-options` | `clearance.routes.ts` | `GET /api/billing-payment/payment-options` |
  | `GET /api/platinum/receipt-prepaid/cashier-payment-types` | `clearance.routes.ts` | `GET /api/billing-payment/payment-types` |
  | `GET /api/platinum/receipt-prepaid/validate-receipt-range` | `pos.routes.ts` | `GET /api/billing-payment/payment-options` (validated by options count) |
  | `POST /api/platinum/receipt-prepaid/submit-cashier-setup` | `pos.routes.ts` | `POST /api/ReceiptPrepaid/submit-cashier-setup` |
  | `GET /api/platinum/active-fin-year` | `pos.routes.ts` | `GET /api/UserPermission/ActiveFinYear` |
  | `POST /api/platinum/auth/ensure-cashier` | `auth.routes.ts` | `GET /api/billing/auth-day-end-reconcile/active-cashierid-by-userid` + `GET /api/ReceiptPrepaid/cashier-detailsById` |
- **Key Patterns**: Session recovery (knownCashierId fallback), virtual cashier detection, day-end returned state handling, office vote enrichment

### 1.3 PosComponent
- **Path**: `angular-client/src/app/features/pos/pos.component.ts`
- **Route**: Embedded in POS Workflow Tab 2
- **Lines**: ~2039 (largest component)
- **Purpose**: Unified POS receipting — multi-type basket (account/clearance/prepaid/misc), split tender, receipt delivery
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `POST /api/platinum/billing-payment/search-accounts` | `billing.routes.ts` | `POST /api/billing-payment/search-accounts` |
  | `POST /api/platinum/billing-payment/search-account-groups` | `billing.routes.ts` | `POST /api/billing-direct-deposit-allocation/load-details-payment-grouping-institution-data` |
  | `POST /api/platinum/billing-payment/get-group-accounts` | `billing.routes.ts` | `POST /api/billing-direct-deposit-allocation/load-details-payment-grouping` |
  | `GET /api/platinum/receipt-prepaid/cons-account-details` | `pos.routes.ts` | `GET /api/ReceiptPrepaid/cons-account-details` |
  | `GET /api/platinum/receipt-prepaid/prepaid-account-details` | `pos.routes.ts` | `GET /api/ReceiptPrepaid/prepaid-account-details` |
  | `GET /api/platinum/receipt-prepaid/pos-payment-type` | `pos.routes.ts` | `GET /api/billing-payment-clearance/pos-payment-type` |
  | `GET /api/platinum/receipt-prepaid/is-billing` | `pos.routes.ts` | `GET /api/ReceiptPrepaid/is-billing` |
  | `GET /api/platinum/billing-payment-miscellaneous/get-groups` | `clearance.routes.ts` | `GET /api/billing-payment-miscellaneous/get-groups` |
  | `GET /api/platinum/billing-payment-miscellaneous/get-scoa-items` | `clearance.routes.ts` | `GET /api/billing-payment-miscellaneous/get-scoa-items` |
  | `GET /api/platinum/billing-payment-miscellaneous/get-vat-rate` | `clearance.routes.ts` | `GET /api/billing-payment-miscellaneous/get-vat-rate` |
  | `POST /api/platinum/billing-payment-miscellaneous/submit` | `clearance.routes.ts` | `POST /api/billing-payment-miscellaneous/submit-payment` |
  | `GET /api/platinum/billing-payment-clearance/get-clearanceids` | `clearance.routes.ts` | `GET /api/billing-payment-clearance/get-clearanceids` |
  | `POST /api/platinum/billing-payment-clearance/get-clearance-data` | `clearance.routes.ts` | `POST /api/billing-payment-clearance/get-clearance-data` |
  | `POST /api/platinum/billing-payment-clearance/get-accounts-for-clearance` | `clearance.routes.ts` | `POST /api/billing-payment-clearance/get-accounts-for-clearance` |
  | `POST /api/platinum/billing-payment-clearance/submit-payment` | `clearance.routes.ts` | `POST /api/billing-payment-clearance/submit-payment` |
  | `POST /api/platinum/billing-payment/submit-consumer-payment/:userId` | `billing.routes.ts` | `POST /api/billing-payment/submit-consumer-payment/:userId` |
  | `POST /api/platinum/billing-payment/submit-multiple-payment/:userId` | `billing.routes.ts` | `POST /api/billing-payment/submit-multiple-payment/:userId` |
  | `POST /api/platinum/billing-payment/save-multiple-account-payment` | `billing.routes.ts` | `POST /api/billing-payment/save-multiple-account-payment` |
  | `GET /api/platinum/billing-payment/get-multiple-account-payment` | `billing.routes.ts` | `GET /api/billing-payment/get-multiple-account-payment` |
  | `POST /api/platinum/receipt-prepaid/utilipay-breakdown-request` | `pos.routes.ts` | `POST /api/ReceiptPrepaid/UtiliPayBreakdownRequest` |
  | `POST /api/platinum/receipt-prepaid/utilipay-token-request` | `pos.routes.ts` | `POST /api/ReceiptPrepaid/UtiliPayTokenRequest` |
  | `POST /api/platinum/receipt-prepaid/submit-prepaid-payment` | `pos.routes.ts` | `POST /api/ReceiptPrepaid/SubmitPrepaidPayment` |
  | `POST /api/platinum/billing-payment/print-receipt` | `billing.routes.ts` | `POST /api/billing-payment/print-receipt` (PDF) |
  | `POST /api/platinum/billing-payment/send-receipt` | `billing.routes.ts` | `POST /api/billing-payment/send-receipt` |
  | `GET /api/platinum/receipt-info` | `enquiries.routes.ts` | `GET /api/BillingEnquiry/GetAppSetting` (batch) |
  | `GET /api/platinum/billing-config` | `receipts.routes.ts` | `GET /api/BillingEnquiry/GetAppSetting` (3 keys) |
  | `GET /api/platinum/billing-payment-clearance/get-banks` | `clearance.routes.ts` | `GET /api/billing-payment-clearance/get-banks` (3 fallbacks) |
  | `GET /api/platinum/billing-payment-clearance/get-branches-by-bank` | `clearance.routes.ts` | `GET /api/billing-payment-clearance/get-brances-by-bank` |
  | `GET /api/platinum/const-institutions/search` | `receipts.routes.ts` | `GET /api/receipting-account-group/search` + fallbacks |
  | `GET /api/platinum/receipt-prepaid/search-property-rates-payment` | `pos.routes.ts` | `GET /api/ReceiptPrepaid/search-property-rates-payment` |
  | `GET /api/platinum/receipt-prepaid/service-type-wise-prepaid-list` | `pos.routes.ts` | `GET /api/ReceiptPrepaid/ServiceTypeWisePrepaidList` |
- **Key Patterns**: Signal-based PosBasketService, SA cash rounding (nearest 10c), split tender (cash+card), processing order enforcement (account→clearance→prepaid→misc), payment deduplication on server, CSV import wizard with batch validation

### 1.4 CashierDayEndComponent
- **Path**: `angular-client/src/app/features/cashier/cashier-day-end.component.ts`
- **Route**: Embedded in POS Workflow Tab 3
- **Lines**: ~850
- **Purpose**: Day-end reconciliation — denomination counting, receipt lists, variance calculation, submission
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `GET /api/platinum/billing-payment-day-end/get-cashier-receipt-reconcile-list` | `dayend.routes.ts` | `GET /api/billing-payment-day-end-reconcile/get-cashier-receipt-reconcile-list` |
  | `GET /api/platinum/billing-payment-day-end/cashier-receipt-unreconciled-list` | `dayend.routes.ts` | Multi-strategy: GET/POST variants of `cashier-receipt-unreconciled-list` |
  | `POST /api/platinum/billing-payment-day-end/get-cashier-receipt-cheque-list` | `dayend.routes.ts` | `POST /api/billing-payment-day-end-reconcile/get-cashier-receipt-cheque-list` |
  | `POST /api/platinum/billing-payment-day-end/get-cashier-receipt-card-list` | `dayend.routes.ts` | `POST /api/billing-payment-day-end-reconcile/get-cashier-receipt-card-list` |
  | `POST /api/platinum/billing-payment-day-end/get-cashier-receipt-drop-box-list` | `dayend.routes.ts` | `POST /api/billing-payment-day-end-reconcile/get-cashier-receipt-drop-box-list` |
  | `POST /api/platinum/billing-payment-day-end/save-reconcile-data` | `dayend.routes.ts` | Multi-endpoint: `POST /api/billing-payment-day-end-reconcile/save-Reconcile-data` + `POST /api/billing/auth-day-end-reconcile/save-Reconcile-data` (6 variants with DB verification) |
  | `POST /api/platinum/receipt-prepaid/submit-cashier-setup` (close session) | `pos.routes.ts` | `POST /api/ReceiptPrepaid/submit-cashier-setup` (isActive: false) |
- **Key Patterns**: Day-end returned state with re-submission, DB write verification loop (3 attempts), denomination grid (R200→1c), variance tracking, session close after reconcile submission

### 1.5 PosWorkflowComponent
- **Path**: `angular-client/src/app/features/pos/pos-workflow.component.ts`
- **Route**: `/pos`
- **Lines**: ~180
- **Purpose**: Wrapper component with 3 tabs — Session Setup, POS Receipting, Day-End Reconciliation
- **API Calls**: None directly (delegates to child components)
- **Key Patterns**: Tab auto-advance when session active, route redirects from old `/cashier-setup` and `/cashier-day-end`

---

## 2. PHASE 11 COMPONENT INVENTORY

### 2.1 UnmatchedQueueComponent (Direct Deposits)
- **Path**: `angular-client/src/app/features/direct-deposits/manual/unmatched-queue.component.ts`
- **Route**: `/direct-deposits/manual`
- **Lines**: ~900
- **Purpose**: Smart grid of unallocated bank recon items with auto-allocate, sort, filter, pagination
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `POST /api/platinum/direct-deposit-allocation/get-bank-recon-positem-list` | `deposits.routes.ts` | `POST /api/billing-direct-deposit-allocation/get-bank-recon-positem-list` |
  | `GET /api/platinum/direct-deposit-allocation/check-selected-item-processed` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/check-selected-item-processed` |
  | `POST /api/platinum/direct-deposit-allocation/invalidate-bank-recon-cache` | `deposits.routes.ts` | None (server cache clear) |
  | `POST /api/platinum/bank-statement-notes` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/get-pos-item-details` (batch) |
  | `POST /api/platinum/billing-enquiry/batch-account-names` | `supervisor.routes.ts` | `POST /api/BillingEnquiry/EnquiryResults` (per account) |
- **Key Patterns**: `parseDescriptionForClues` engine (ERF/meter/area/institution detection, confidence scoring), 30s server-side cache, auto-allocate with AI matching, pagination with sort/filter

### 2.2 AllocateTransactionComponent (Direct Deposits)
- **Path**: `angular-client/src/app/features/direct-deposits/manual/allocate-transaction.component.ts`
- **Route**: `/direct-deposits/manual/allocate/:id`
- **Lines**: ~1200
- **Purpose**: Full allocation workflow — 7 search scopes, clearance cost schedule, institution auto-expand, payment submission
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `GET /api/platinum/direct-deposit-allocation/get-pos-item-details` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/get-pos-item-details` |
  | `POST /api/platinum/billing-payment/search-accounts` | `billing.routes.ts` | `POST /api/billing-payment/search-accounts` |
  | `GET /api/platinum/receipt-prepaid/cons-account-details` | `pos.routes.ts` | `GET /api/ReceiptPrepaid/cons-account-details` |
  | `GET /api/platinum/direct-deposit-allocation/get-account-autocomplete` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/get-account-autocomplete` |
  | `GET /api/platinum/direct-deposit-allocation/get-clearance-autocomplete` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/get-clearence-autocomplete` |
  | `GET /api/platinum/direct-deposit-allocation/get-old-account-autocomplete` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/get-old-account-autocomplete` |
  | `POST /api/platinum/direct-deposit-allocation/load-details-payment-grouping` | `deposits.routes.ts` | `POST /api/billing-direct-deposit-allocation/load-details-payment-grouping` |
  | `POST /api/platinum/direct-deposit-allocation/load-details-payment-grouping-institution-data` | `deposits.routes.ts` | `POST /api/billing-direct-deposit-allocation/load-details-payment-grouping-institution-data` |
  | `POST /api/platinum/direct-deposit-allocation/load-details-consumer-services` | `deposits.routes.ts` | `POST /api/billing-direct-deposit-allocation/load-details-consumer-services` |
  | `POST /api/platinum/direct-deposit-allocation/load-details-clearance` | `deposits.routes.ts` | `POST /api/billing-direct-deposit-allocation/load-details-clearance` |
  | `POST /api/platinum/direct-deposit-allocation/get-clearance-details-info` | `deposits.routes.ts` | `POST /api/billing-direct-deposit-allocation/get-clearance-details-info` |
  | `POST /api/platinum/direct-deposit-allocation/get-consumer-details-data` | `deposits.routes.ts` | `POST /api/billing-direct-deposit-allocation/get-consumer-details-data` |
  | `POST /api/platinum/direct-deposit-allocation/load-confirm-payment-details` | `deposits.routes.ts` | `POST /api/billing-direct-deposit-allocation/load-confirm-payment-details` |
  | `POST /api/platinum/direct-deposit-allocation/create-virtual-session` | `deposits.routes.ts` | `POST /api/ReceiptPrepaid/submit-cashier-setup` (isVirtual: true) |
  | `POST /api/platinum/direct-deposit-allocation/close-virtual-session` | `deposits.routes.ts` | `POST /api/ReceiptPrepaid/submit-cashier-setup` (isActive: false) |
  | `GET /api/platinum/direct-deposit-allocation/get-misc-payment-group` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/get-misc-payment-group` |
  | `GET /api/platinum/direct-deposit-allocation/get-misc-vote-id-by-group` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/get-misc-vote-id-by-group` |
  | `GET /api/platinum/direct-deposit-allocation/get-group-payment-details` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/get-group-payment-details` |
  | `GET /api/platinum/direct-deposit-allocation/get-vat-rate` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/get-vat-rate` |
  | `GET /api/platinum/const-institutions` | `receipts.routes.ts` | Multi-endpoint: `receipting-account-group/search`, `const-institutions`, `BillingEnquiry/GetConstInstitutions` |
  | `POST /api/platinum/billing-enquiry/batch-balance` | `supervisor.routes.ts` | `GET /api/BillingEnquiry/TotalBalanceDebtInquiry` (per account) |
- **Key Patterns**: 7 search scopes (ALL/ACCOUNT/PREPAID/CLEARANCE/DIRECT/GROUP/INSTITUTION), Section 118(1) & 118(3) clearance breakdowns, virtual cashier session create/close, institution auto-expand with smart budget distribution

### 2.3 AllocationHistoryComponent (Direct Deposits)
- **Path**: `angular-client/src/app/features/direct-deposits/manual/allocation-history.component.ts`
- **Route**: `/direct-deposits/manual/history`
- **Lines**: ~450
- **Purpose**: View completed allocations with bank statement note enrichment and job retry status
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `POST /api/platinum/direct-deposit-allocation/get-bank-recon-positem-list` | `deposits.routes.ts` | `POST /api/billing-direct-deposit-allocation/get-bank-recon-positem-list` |
  | `POST /api/platinum/bank-statement-notes` | `deposits.routes.ts` | `GET /api/billing-direct-deposit-allocation/get-pos-item-details` (batch) |
  | `GET /api/dd-allocation/job/:jobId` | `deposits.routes.ts` | None (in-memory job map) |
- **Key Patterns**: Bank statement note enrichment via cashbook trace, job retry polling for batch allocations

### 2.4 AutoAllocationComponent (Direct Deposits)
- **Path**: `angular-client/src/app/features/direct-deposits/auto/auto-allocation.component.ts`
- **Route**: `/direct-deposits/auto`
- **Lines**: ~600
- **Purpose**: AI-powered auto-matching of bank recon items to accounts
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `POST /api/platinum/direct-deposit-allocation/get-bank-recon-positem-list` | `deposits.routes.ts` | `POST /api/billing-direct-deposit-allocation/get-bank-recon-positem-list` |
  | `POST /api/platinum/bank-statement-notes` | `deposits.routes.ts` | Batch POS item details |
  | `POST /api/platinum/billing-enquiry/batch-account-names` | `supervisor.routes.ts` | Batch EnquiryResults |
  | `POST /api/dd-allocation/submit-batch` | `deposits.routes.ts` | Various Platinum endpoints per line item |
  | `GET /api/dd-allocation/job/:jobId` | `deposits.routes.ts` | None (in-memory) |
  | `POST /api/platinum/direct-deposit-bulk/get-unprocessed` | `deposits.routes.ts` | `POST /api/billing/direct-deposit-bulk-allocation/get-unprocessed-direct-deposits` |
  | `POST /api/platinum/direct-deposit-bulk/get-processed` | `deposits.routes.ts` | `POST /api/billing/direct-deposit-bulk-allocation/get-processed-deposits` |
  | `POST /api/platinum/direct-deposit-bulk/reconcile` | `deposits.routes.ts` | `POST /api/billing/direct-deposit-bulk-allocation/reconcile-processed-data` |
  | `POST /api/platinum/direct-deposit-bulk/print-processed` | `deposits.routes.ts` | `POST /api/billing/direct-deposit-bulk-allocation/print-processed-deposits` |
- **Key Patterns**: `parseDescriptionForClues` confidence scoring, AI OpenAI matching, batch submission with line-by-line processing, job polling, direct-deposit-bulk endpoints for processed/unprocessed data

### 2.5 BulkAllocationProgressComponent (Direct Deposits)
- **Path**: `angular-client/src/app/features/bulk-allocation/bulk-allocation-progress.component.ts`
- **Route**: `/bulk-allocation`
- **Lines**: ~350
- **Purpose**: CSV bulk import processing with step wizard and progress tracking
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `POST /api/platinum/direct-deposit-allocation/get-bank-recon-positem-list` | `deposits.routes.ts` | Bank recon list |
  | `POST /api/dd-allocation/submit-batch` | `deposits.routes.ts` | Batch allocation |
  | `GET /api/dd-allocation/job/:jobId` | `deposits.routes.ts` | Job status polling |
  | `GET /api/platinum/bulk-progress/get-financial-years` | `deposits.routes.ts` | `GET /api/billing/direct-deposit-bulk-allocation/get-financial-years` |
  | `GET /api/platinum/bulk-progress/get-month-list` | `deposits.routes.ts` | `GET /api/billing/direct-deposit-bulk-allocation/get-month-list` |
  | `GET /api/platinum/bulk-progress/get-process-list` | `deposits.routes.ts` | `GET /api/billing/direct-deposit-bulk-allocation/get-process-list` |
  | `POST /api/platinum/bulk-progress/get-bulk-allocation-list` | `deposits.routes.ts` | `POST /api/billing/direct-deposit-bulk-allocation/get-bulk-allocation-list` |
  | `GET /api/platinum/bulk-progress/job-account-details/:jobId` | `deposits.routes.ts` | `GET /api/billing/direct-deposit-bulk-allocation/job-account-details/:jobId` |
  | `GET /api/platinum/bulk-progress/direct-deposit/:jobId` | `deposits.routes.ts` | `GET /api/billing/direct-deposit-bulk-allocation/direct-deposit/:jobId` |
- **Key Patterns**: CSV upload → preview → validate → process pipeline, batch validation against Platinum API, bulk-progress endpoints for financial year/month/process tracking

### 2.6 EnquiriesGeneralComponent
- **Path**: `angular-client/src/app/features/enquiries/enquiries-general.component.ts`
- **Route**: `/enquiries/general` (redirected from `/enquiries`)
- **Lines**: ~1800
- **Purpose**: Multi-tab account detail view with 30 tab categories, quick/advanced search, export
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `POST /api/platinum/billing-enquiry/enquiry-results` | `enquiries.routes.ts` | `POST /api/BillingEnquiry/EnquiryResults` |
  | `GET /api/platinum/billing-enquiry/autocomplete` | `enquiries.routes.ts` | `GET /api/BillingEnquiry/Autocomplete` |
  | `GET /api/platinum/billing-enquiry/:endpoint/:accountId` | `enquiries.routes.ts` | Dynamic mapped endpoints (30+ BillingEnquiry sub-paths) |
  | `GET /api/platinum/billing-enquiry/:endpoint` | `enquiries.routes.ts` | Valuation/meter query-param endpoints |
  | `GET /api/platinum/billing-enquiry/rebuild-full-account` | `enquiries.routes.ts` | `GET /api/BillingEnquiry/rebuildFullAccount` |
  | `GET /api/platinum/billing-enquiry/linked-accounts-on-property` | `supervisor.routes.ts` | Property lookup + SG autocomplete + name search |
  | `GET /api/platinum/billing-enquiry/service-type-balance` | `supervisor.routes.ts` | `GET /api/BillingEnquiry/ServiceTypeBalanceDetails` |
  | `GET /api/platinum/billing-enquiry/billed-vs-paid-amounts` | `supervisor.routes.ts` | `GET /api/BillingEnquiry/AccountInquiries` / `BilledVsPaidAmounts` / `DetailedTransactionResults` |
  | `GET /api/platinum/billing-enquiry/property-details-by-account` | `supervisor.routes.ts` | `GET /api/BillingEnquiry/PropertyDetailsByAccountId` |
  | `GET /api/platinum/billing-enquiry/total-balance-debt` | `supervisor.routes.ts` | `GET /api/BillingEnquiry/TotalBalanceDebtInquiry` |
  | `GET /api/platinum/billing-enquiry/receipt-transaction-detail` | `supervisor.routes.ts` | `GET /api/BillingEnquiry/getReceiptTransactionDetail` |
  | `GET /api/platinum/bank-statement-notes-by-account` | `deposits.routes.ts` | Payment trace via cashbook-transaction-trace/search |
  | `POST /api/platinum/billing-payment/print-receipt` | `billing.routes.ts` | `POST /api/billing-payment/print-receipt` (PDF) |
  | `GET /api/platinum/billing-enquiry/get-config-setting` | `enquiries.routes.ts` | `GET /api/BillingEnquiry/GetAAAA_ConfigSetting` / `GetAppSetting` |
  | Registry-based 50+ GET endpoints | `supervisor.routes.ts` | All `BillingEnquiry/*` endpoints |
- **Key Patterns**: 30 tab categories, SG number search via autocomplete+ERF, Excel/CSV/PDF export with standardized naming, Section 49/78 letters, Valuation Certificates, Proof of Residence, Occupier CRUD

### 2.7 SupervisorDashboardComponent
- **Path**: `angular-client/src/app/features/supervisor/supervisor-dashboard.component.ts`
- **Route**: `/supervisor`
- **Lines**: ~700
- **Purpose**: Day-end approval/decline, cancellation requests, cash reports
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `GET /api/platinum/auth-day-end/cashier-list` | `dayend.routes.ts` | `GET /api/billing/auth-day-end-reconcile/cashier-list` + enrichment (reconcile + details per cashier) |
  | `GET /api/platinum/auth-day-end/cash-office-list` | `dayend.routes.ts` | `GET /api/billing/auth-day-end-reconcile/cash-office-list` |
  | `GET /api/platinum/auth-day-end/cashier-reconcile-by-cashierid` | `dayend.routes.ts` | `GET /api/billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid` |
  | `GET /api/platinum/auth-day-end/cashier-details` | `dayend.routes.ts` | `GET /api/billing/auth-day-end-reconcile/cashier-details` |
  | `POST /api/platinum/auth-day-end/submit-day-auth-reconcile` | `dayend.routes.ts` | `POST /api/billing/auth-day-end-reconcile/submit-day-auth-reconcile` |
  | `POST /api/platinum/auth-day-end/validate-cashbook` | `dayend.routes.ts` | `POST /api/billing/auth-day-end-reconcile/validate-cashbook` |
  | `GET /api/platinum/auth-day-end/cashbook-list` | `dayend.routes.ts` | `GET /api/billing/auth-day-end-reconcile/cashbook-list` |
  | `POST /api/platinum/auth-day-end/request-cancel-receipt` | `dayend.routes.ts` | `POST /api/billing/auth-day-end-reconcile/request-cancel-receipt` |
  | `POST /api/platinum/auth-day-end/cashier-receipt-cash-list` | `dayend.routes.ts` | `POST /api/billing/auth-day-end-reconcile/cashier-receipt-cash-list` |
  | `POST /api/platinum/auth-day-end/cashier-receipt-cheque-list` | `dayend.routes.ts` | `POST /api/billing/auth-day-end-reconcile/cashier-receipt-cheque-list` |
  | `POST /api/platinum/auth-day-end/cashier-receipt-card-list` | `dayend.routes.ts` | `POST /api/billing/auth-day-end-reconcile/cashier-receipt-card-list` |
  | `POST /api/platinum/auth-day-end/cashier-receipt-drop-box-list` | `dayend.routes.ts` | `POST /api/billing/auth-day-end-reconcile/cashier-receipt-drop-box-list` |
- **Key Patterns**: Cashier list enrichment (parallel reconcile + detail lookups), grouped office support, approve/decline/return flows, receipt cancellation requests

### 2.8 ViewReceiptsComponent
- **Path**: `angular-client/src/app/features/receipts/view-receipts.component.ts`
- **Route**: `/view-receipts`
- **Lines**: ~500
- **Purpose**: Receipt search, view, print, cashbook trace
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `GET /api/platinum/view-receipt/get-cashiers` | `billing.routes.ts` | `GET /api/billing/auth-day-end-reconcile/cashier-list` → fallback `GET /api/ViewReceipt/get-cashiers` |
  | `POST /api/platinum/view-receipt/get-receipt-list` | `billing.routes.ts` | `POST /api/ViewReceipt/get-receipt-list` |
  | `POST /api/platinum/billing-payment/print-receipt` | `billing.routes.ts` | `POST /api/billing-payment/print-receipt` (PDF merge + crop) |
  | `GET /api/platinum/billing-payment/receipt-allocations` | `billing.routes.ts` | PDF extraction via pdftotext |
  | `GET /api/platinum/pos-multi-receipt-print` | `receipts.routes.ts` | `GET /api/billing-payment/pos-multi-receipt-print` + ViewReceipt enrichment |
  | `GET /api/platinum/billing-enquiry/receipt-transaction-detail` | `supervisor.routes.ts` | `GET /api/BillingEnquiry/getReceiptTransactionDetail` |
  | `GET /api/platinum/billing-stage-cashier-receipt-details/reference` | `receipts.routes.ts` | `GET /api/billing-stage-cashier-receipt-details/reference` |
- **Key Patterns**: Multi-receipt PDF merge (pdf-lib), receipt crop to 58% height, cashbook trace via transaction-trace/search, bank statement note display

### 2.9 BillingDashboardComponent
- **Path**: `angular-client/src/app/features/billing/billing-dashboard.component.ts`
- **Route**: `/billing-dashboard`
- **Lines**: ~500
- **Purpose**: Category-based billing alerts with drill-down
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `GET /api/platinum/billing-dashboard/pos-count` | `supervisor.routes.ts` | `GET /api/billing-dashboard/pos-count` |
  | `GET /api/platinum/billing-dashboard/pos-tab-item-details-count` | `supervisor.routes.ts` | `GET /api/billing-dashboard/pos-tab-item-details-count` |
  | `POST /api/platinum/billing-dashboard/get-deposit-table-data` | `supervisor.routes.ts` | `POST /api/billing-dashboard/get-deposit-table-data` |
  | `POST /api/platinum/billing-dashboard/get-direct-deposits-allocation-table-data` | `supervisor.routes.ts` | `POST /api/billing-dashboard/get-direct-deposits-allocation-table-data` |
  | `POST /api/platinum/billing-dashboard/get-third-party-payment-pending-table-data` | `supervisor.routes.ts` | `POST /api/billing-dashboard/get-third-party-payment-pending-table-data` |
  | `GET /api/platinum/billing-dashboard/get-alert-counts` | `supervisor.routes.ts` | `GET /api/billing-dashboard/get-alert-counts` |
  | `GET /api/platinum/billing-dashboard/get-notification-counts` | `supervisor.routes.ts` | `GET /api/billing-dashboard/get-notification-counts` |
  | `GET /api/platinum/billing-dashboard/get-notification-account-item-counts` | `supervisor.routes.ts` | `GET /api/billing-dashboard/get-notification-account-item-counts` |
  | `GET /api/platinum/billing-dashboard/account-count` | `supervisor.routes.ts` | `GET /api/billing-dashboard/account-count` |
  | + 8 more category count GETs (consumption, debt, billing, property, indigentsubsidy, journal, rebate, assets) | `supervisor.routes.ts` | Category-specific `billing-dashboard/*-count` endpoints |
- **Key Patterns**: All routes in `supervisor.routes.ts`; category-based count GETs + POST table data; drill-down to item counts

### 2.10 ThirdPartyPaymentProcessingComponent
- **Path**: `angular-client/src/app/features/third-party/payment-processing.component.ts`
- **Route**: `/third-party/processing` (redirected from `/third-party`)
- **Lines**: ~600
- **Purpose**: Third-party payment file import, validation, reconciliation, commit
- **API Calls**:
  | Frontend Call | Express Route | Platinum Endpoint |
  |---|---|---|
  | `POST /api/platinum/third-party-payments/import-file` | `deposits.routes.ts` | `POST /api/billing/pos/third-party-payments/import` |
  | `POST /api/platinum/third-party-payments/import` | `deposits.routes.ts` | `POST /api/billing/pos/third-party-payments/import` |
  | `GET /api/platinum/third-party-payments/:importId/transactions` | `deposits.routes.ts` | `GET /api/billing/pos/third-party-payments/:importId/transactions` |
  | `POST /api/platinum/third-party-payments/:importId/validate-for-reconcile` | `deposits.routes.ts` | `POST /api/billing/pos/third-party-payments/:importId/validate-for-reconcile` |
  | `POST /api/platinum/third-party-payments/:importId/reconcile` | `deposits.routes.ts` | `POST /api/billing/pos/third-party-payments/:importId/reconcile` |
  | `POST /api/platinum/third-party-payments/:importId/commit` | `deposits.routes.ts` | `POST /api/billing/pos/third-party-payments/:importId/commit` |
  | `PUT /api/platinum/third-party-payments/:importId/transactions/:index` | `deposits.routes.ts` | `PUT /api/billing/pos/third-party-payments/:importId/transactions/:index` |
  | `POST /api/platinum/third-party-payments/validate-account` | `deposits.routes.ts` | `POST /api/billing/pos/third-party-payments/validate-account` |
  | `GET /api/platinum/third-party-payments/account-search` | `deposits.routes.ts` | `GET /api/billing/pos/third-party-payments/account-search` |
  | `GET /api/platinum/third-party-payments/is-cashier-active` | `deposits.routes.ts` | `GET /api/billing/pos/third-party-payments/is-cashier-active` |
  | `GET /api/platinum/third-party-payments/cashier-details` | `deposits.routes.ts` | `GET /api/billing/pos/third-party-payments/cashier-details` |
  | `GET /api/platinum/third-party-payments/types` | `deposits.routes.ts` | `GET /api/billing/pos/third-party-payments/types` |
- **Key Patterns**: All routes in `deposits.routes.ts`; Platinum prefix is `/api/billing/pos/third-party-payments/...`; file import → importId → transactions → validate → reconcile → commit pipeline

### 2.11 SettingsComponent
- **Path**: `angular-client/src/app/features/settings/settings.component.ts`
- **Route**: `/settings`
- **Lines**: ~150
- **Purpose**: Placeholder component — no API calls implemented
- **API Calls**: None
- **Status**: `loadData()` method has only a comment (`// TODO: load settings`)

---

## 3. FRONTEND → BACKEND ROUTE CROSS-REFERENCE

### 3.1 Server Route Files by Module

| Route File | Line Count | Express Routes | Modules Served |
|---|---|---|---|
| `auth.routes.ts` | 353 | 8 | Login, Cashier Session |
| `pos.routes.ts` | 500+ | 18 | POS, Cashier Setup |
| `billing.routes.ts` | 430+ | 10 | POS Payments, Receipt Print/Send |
| `clearance.routes.ts` | 500+ | 14 | POS Clearance/Misc, Payment Options/Types |
| `dayend.routes.ts` | 500+ | 18 | Day-End (cashier + supervisor) |
| `deposits.routes.ts` | 1617 | 40+ | All Direct Deposit modules, Third-Party Payments, Bulk Deposits |
| `enquiries.routes.ts` | 800+ | 12+ | Enquiries (dynamic endpoint mapping) |
| `supervisor.routes.ts` | 1027 | 50+ | Supervisor, Enquiries (registry-based), Billing Dashboard |
| `receipts.routes.ts` | 800+ | 20+ | View Receipts, Multi-Receipt, Generic Table |
| `debt.routes.ts` | 500+ | 15+ | Debt management (Phase 8-9) |
| `legal.routes.ts` | 450+ | 10+ | Legal compliance (Phase 4-5) |
| `communications.routes.ts` | 280+ | 6+ | Communications (Phase 4-5) |
| `analytics.routes.ts` | 700+ | 12+ | Analytics (Phase 6-7) |

### 3.2 Route Registration Order
All route modules registered in `server/routes/index.ts`:
```
registerAuthRoutes → registerPosRoutes → registerBillingRoutes →
registerClearanceRoutes → registerDayendRoutes → registerDepositsRoutes →
registerSupervisorRoutes → registerEnquiriesRoutes → registerReceiptsRoutes →
registerDebtRoutes → registerLegalRoutes → registerCommunicationsRoutes →
registerAnalyticsRoutes
```

### 3.3 Middleware Chain
| Middleware | Location | Applied To |
|---|---|---|
| `requireAuth` | `middleware.ts` | All `/api/platinum/*` routes |
| `handlePlatinumResult` | `middleware.ts` | Standard response handler (checks `_error` flag) |
| `checkPaymentDedup` | `middleware.ts` | Consumer/multi/clearance/misc payments |
| `injectAuditFields` | `middleware.ts` | All debt/legal write operations |
| `requireDebtPermission` | `middleware.ts` | Debt management routes |

---

## 4. PLATINUM API ENDPOINT MAP

### 4.1 Authentication & User
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `POST /auth/createToken` | POST | Login |
| `GET /api/UserPermission/ActiveFinYear` | GET | Cashier setup, deposits |

### 4.2 ReceiptPrepaid (Cashier/POS Core)
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `GET /api/ReceiptPrepaid/validate-cashier` | GET | Session detection, day-end verify |
| `POST /api/ReceiptPrepaid/submit-cashier-setup` | POST | Session create/update/close, virtual sessions |
| `GET /api/ReceiptPrepaid/cashier-detailsById` | GET | Cashier detail lookups, fallback resolution |
| `GET /api/ReceiptPrepaid/cash-offices` | GET | Office list |
| `GET /api/ReceiptPrepaid/cashier-list` | GET | Cashier search fallback |
| `GET /api/ReceiptPrepaid/cons-accounts` | GET | Account search |
| `GET /api/ReceiptPrepaid/cons-account-details` | GET | Account detail with balance |
| `GET /api/ReceiptPrepaid/prepaid-account-details` | GET | Prepaid meter details |
| `GET /api/ReceiptPrepaid/active-cashier-details` | GET | Active cashier lookup |
| `GET /api/ReceiptPrepaid/active-cashOffice-details` | GET | Office detail probe |
| `GET /api/ReceiptPrepaid/is-billing` | GET | Billing mode check |
| `GET /api/ReceiptPrepaid/search-property-rates-payment` | GET | Property rates search |
| `GET /api/ReceiptPrepaid/ValidateCashierDayEndRecon` | GET | Day-end validation |
| `GET /api/ReceiptPrepaid/GetBillingRuns` | GET | Billing runs lookup |
| `GET /api/ReceiptPrepaid/ServiceTypeWisePrepaidList` | GET | Prepaid services list |
| `GET /api/ReceiptPrepaid/cheque-amendList` | GET | Cheque amendments |
| `POST /api/ReceiptPrepaid/UtiliPayBreakdownRequest` | POST | Prepaid breakdown |
| `POST /api/ReceiptPrepaid/UtiliPayTokenRequest` | POST | Prepaid token purchase |
| `POST /api/ReceiptPrepaid/SubmitPrepaidPayment` | POST | Prepaid payment submit |

### 4.3 billing-payment (Payment Processing)
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `POST /api/billing-payment/search-accounts` | POST | POS search, deposits |
| `POST /api/billing-payment/submit-consumer-payment/:userId` | POST | Single account payment |
| `POST /api/billing-payment/submit-multiple-payment/:userId` | POST | Multi-account payment |
| `POST /api/billing-payment/save-multiple-account-payment` | POST | Save multi-account |
| `GET /api/billing-payment/get-multiple-account-payment` | GET | Get saved multi-account |
| `POST /api/billing-payment/print-receipt` | POST | Receipt PDF generation |
| `POST /api/billing-payment/send-receipt` | POST | Receipt delivery |
| `GET /api/billing-payment/payment-options` | GET | Cashier payment options |
| `GET /api/billing-payment/payment-types` | GET | Cashier payment types |
| `GET /api/billing-payment/pos-multi-receipt-print` | GET | Multi-line receipt data |

### 4.4 billing-payment-clearance (Clearance & Misc)
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `GET /api/billing-payment-clearance/get-clearanceids` | GET | Clearance ID search |
| `GET /api/billing-payment-clearance/pos-payment-type` | GET | Payment type lookup |
| `POST /api/billing-payment-clearance/get-clearance-data` | POST | Clearance data |
| `POST /api/billing-payment-clearance/get-accounts-for-clearance` | POST | Clearance accounts |
| `POST /api/billing-payment-clearance/submit-payment` | POST | Clearance payment submit |
| `GET /api/billing-payment-clearance/get-banks` | GET | Bank list |
| `GET /api/billing-payment-clearance/get-brances-by-bank` | GET | Branch list |
| `GET /api/billing-payment-miscellaneous/get-groups` | GET | Misc groups |
| `GET /api/billing-payment-miscellaneous/get-scoa-items` | GET | SCOA items by group |
| `GET /api/billing-payment-miscellaneous/get-vat-rate` | GET | VAT rate |
| `POST /api/billing-payment-miscellaneous/submit-payment` | POST | Misc payment submit |

### 4.5 billing-payment-day-end-reconcile (Day-End Cashier)
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `GET .../get-cashier-list` | GET | Day-end cashier list |
| `GET .../get-cashier-details` | GET | Cashier details |
| `GET .../get-cashier-receipt-reconcile-list` | GET | Reconciled receipts |
| `GET/POST .../cashier-receipt-unreconciled-list` | GET/POST | Unreconciled receipts |
| `POST .../get-cashier-receipt-cheque-list` | POST | Cheque receipts |
| `POST .../get-cashier-receipt-card-list` | POST | Card receipts |
| `POST .../get-cashier-receipt-drop-box-list` | POST | Dropbox receipts |
| `POST .../save-Reconcile-data` | POST | Save reconciliation |

### 4.6 billing/auth-day-end-reconcile (Day-End Supervisor)
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `GET .../cash-office-list` | GET | Office list |
| `GET .../cashier-list` | GET | Cashier list |
| `GET .../cashier-reconcile-by-cashierid` | GET | Reconcile by cashier |
| `GET .../active-cashierid-by-userid` | GET | Active cashier lookup |
| `GET .../pos-cashier` | GET | POS cashier info |
| `GET .../cashier-details` | GET | Cashier details |
| `POST .../submit-day-auth-reconcile` | POST | Approve/decline |
| `POST .../validate-cashbook` | POST | Cashbook validation |
| `GET .../cashbook-list` | GET | Cashbook listing |
| `POST .../request-cancel-receipt` | POST | Cancel receipt request |
| `POST .../cashier-receipt-cash-list` | POST | Cash receipt list |
| `POST .../cashier-receipt-cheque-list` | POST | Cheque receipt list |
| `POST .../cashier-receipt-card-list` | POST | Card receipt list |
| `POST .../cashier-receipt-drop-box-list` | POST | Dropbox receipt list |

### 4.7 billing-direct-deposit-allocation
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `POST .../get-bank-recon-positem-list` | POST | Unmatched queue, history |
| `GET .../check-selected-item-processed` | GET | Item status check |
| `GET .../get-pos-item-details` | GET | POS item details + notes |
| `GET .../get-account-autocomplete` | GET | Account search |
| `GET .../get-clearence-autocomplete` | GET | Clearance search |
| `GET .../get-old-account-autocomplete` | GET | Old account search |
| `GET .../get-misc-payment-group` | GET | Misc groups |
| `GET .../get-misc-vote-id-by-group` | GET | Vote by group |
| `GET .../get-group-payment-details` | GET | Group payment details |
| `GET .../get-vat-rate` | GET | VAT rate |
| `POST .../load-details-payment-grouping` | POST | Group account loading |
| `POST .../load-details-payment-grouping-institution-data` | POST | Institution search |
| `POST .../load-details-consumer-services` | POST | Consumer services |
| `POST .../load-details-clearance` | POST | Clearance details |
| `POST .../get-clearance-details-info` | POST | Clearance info |
| `POST .../get-consumer-details-data` | POST | Consumer data |
| `POST .../load-confirm-payment-details` | POST | Payment confirmation |

### 4.8 BillingEnquiry (50+ Endpoints)
| Category | Platinum Endpoint | Used By |
|---|---|---|
| Search | `POST .../EnquiryResults` | Enquiries, batch account names |
| Search | `GET .../Autocomplete` | Enquiries, linked accounts |
| Balance | `GET .../TotalBalanceDebtInquiry` | Enquiries, supervisor, batch balance |
| Balance | `GET .../ServiceTypeBalanceDetails` | Enquiries |
| Property | `GET .../PropertyDetailsByAccountId` | Enquiries, linked accounts |
| Name | `GET .../NameInfoByAccountId` | Enquiries |
| Handover | `GET .../HandoverByAccount` | Enquiries |
| Meters | `GET .../MeteredServicesOnAccount` | Enquiries |
| Meters | `GET .../meter-reading-history` | Enquiries |
| Transactions | `GET .../DetailedTransactionResults` | Enquiries |
| Transactions | `GET .../getBillingPeriodTransactions` | Enquiries |
| Deposits | `GET .../DepositsByAccountId` | Enquiries |
| Payments | `GET .../PaymentAmountByAccountIds` | Enquiries, bank notes |
| Config | `GET .../GetAppSetting` | Receipt info, billing config |
| Config | `GET .../GetAAAA_ConfigSetting` | Config settings |
| + 35 more | Registry-based endpoints | Various enquiry tabs |

### 4.9 ViewReceipt
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `GET /api/ViewReceipt/get-cashiers` | GET | Receipt search (fallback) |
| `POST /api/ViewReceipt/get-receipt-list` | POST | Receipt listing |

### 4.10 Third-Party Payments (via `/api/billing/pos/third-party-payments/`)
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `POST /api/billing/pos/third-party-payments/import` | POST | File import |
| `GET /api/billing/pos/third-party-payments/:importId/transactions` | GET | Transaction listing |
| `POST /api/billing/pos/third-party-payments/:importId/validate-for-reconcile` | POST | Validation |
| `POST /api/billing/pos/third-party-payments/:importId/reconcile` | POST | Reconciliation |
| `POST /api/billing/pos/third-party-payments/:importId/commit` | POST | Commit |
| `PUT /api/billing/pos/third-party-payments/:importId/transactions/:index` | PUT | Transaction edit |
| `POST /api/billing/pos/third-party-payments/validate-account` | POST | Account validation |
| `GET /api/billing/pos/third-party-payments/account-search` | GET | Account search |
| `GET /api/billing/pos/third-party-payments/is-cashier-active` | GET | Cashier status |
| `GET /api/billing/pos/third-party-payments/cashier-details` | GET | Cashier details |
| `GET /api/billing/pos/third-party-payments/types` | GET | Payment types |

### 4.11 Direct Deposit Bulk Allocation (via `/api/billing/direct-deposit-bulk-allocation/`)
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `POST .../get-unprocessed-direct-deposits` | POST | Unprocessed deposit list |
| `POST .../get-processed-deposits` | POST | Processed deposit list |
| `POST .../reconcile-processed-data` | POST | Reconcile processed |
| `POST .../print-processed-deposits` | POST | Print processed |
| `GET .../get-financial-years` | GET | Financial year list |
| `GET .../get-month-list` | GET | Month list |
| `GET .../get-process-list` | GET | Process list |
| `POST .../get-bulk-allocation-list` | POST | Bulk allocation list |
| `GET .../job-account-details/:jobId` | GET | Job account details |
| `GET .../direct-deposit/:jobId` | GET | Direct deposit detail |

### 4.12 Cashbook Trace
| Platinum Endpoint | HTTP | Used By |
|---|---|---|
| `GET /api/billing/cashbook-transaction-trace/search` | GET | Bank statement notes, receipt trace |

---

## 5. DATA FLOW DIAGRAMS

### 5.1 POS Payment Flow
```
User → POS UI → Search (billing-payment/search-accounts)
              → Add to Basket (signal-based PosBasketService)
              → Tender Entry (cash rounding, split tender)
              → Process Order:
                 1. Account items → submit-consumer-payment / submit-multiple-payment
                 2. Clearance items → billing-payment-clearance/submit-payment
                 3. Prepaid items → UtiliPayTokenRequest → SubmitPrepaidPayment
                 4. Misc items → billing-payment-miscellaneous/submit-payment
              → Receipt Print (billing-payment/print-receipt → PDF)
              → Receipt Delivery (print/email/WhatsApp/SMS)
```

### 5.2 Cashier Session Lifecycle
```
Login → ensure-cashier → validate-cashier
     → Office Selection (cash-offices)
     → Submit Setup (submit-cashier-setup)
     → Payment Options/Types loaded
     → Active Session (POS transacting)
     → Day-End:
        → Denomination Entry
        → Receipt Lists (cheque/card/dropbox/reconcile)
        → Save Reconcile (save-Reconcile-data with DB verification)
        → Session Close (submit-cashier-setup isActive: false)
     → Supervisor Review:
        → Approve/Decline/Return
        → If Returned → Cashier re-submits
```

### 5.3 Direct Deposit Allocation Flow
```
Bank Recon List → Unmatched Queue (get-bank-recon-positem-list)
              → Auto-Allocate (parseDescriptionForClues + AI)
              → Manual Allocate:
                 → Create Virtual Session
                 → 7-Scope Search (account/clearance/group/institution/etc)
                 → Load Details (consumer-services/clearance/grouping)
                 → Confirm Payment (load-confirm-payment-details)
                 → Submit (billing-payment/submit-consumer-payment)
                 → Close Virtual Session
              → Batch Submit (submit-batch → line-by-line processing → job polling)
              → Allocation History (enriched with bank statement notes)
```

---

## 6. IDENTIFIED GAPS & OBSERVATIONS

### 6.1 Settings Component — Placeholder
- **File**: `settings.component.ts`
- **Issue**: `loadData()` is empty with a TODO comment
- **Impact**: Low — settings page has no functionality
- **Action**: No API contract exists; await requirements

### 6.2 Server-Side Caching
- **Bank Recon Cache**: `deposits.routes.ts` — 30s TTL, max 20 entries, per-site/user
- **Autocomplete Cache**: `enquiries.routes.ts` — 60s TTL, max 100 entries, per-site/type
- **Observation**: Caches are in-memory and not shared across server instances; acceptable for single-instance deployment

### 6.3 Payment Deduplication
- **Scope**: Consumer, multi-account, clearance, and misc payments all have dedup protection
- **Window**: Configurable `PAYMENT_DEDUP_WINDOW_MS` (server-side)
- **Pattern**: Hash-based key comparison with cached response replay

### 6.4 Multi-Strategy Endpoints
Several routes use multi-strategy patterns (try multiple Platinum endpoints until one succeeds):
- `active-cashier-by-userid`: validate-cashier → active-cashierid-by-userid → cashier-detailsById → cashier-list
- `save-reconcile-data`: 6 endpoint variants (bp-day-end + auth-day-end × 3 param combos) with DB verification
- `cashier-receipt-unreconciled-list`: 6 strategies (GET/POST × different paths/params)
- `get-banks`: 3 Platinum endpoints tried in sequence
- `const-institutions`: 4 Platinum endpoints tried in sequence

### 6.5 Virtual Cashier Sessions (Deposits)
- Created when allocating deposits without an active POS session
- Uses `submit-cashier-setup` with `isVirtual: true`
- Stored in Express session as `ddVirtualCashierId` / `ddVirtualOfficeId`
- Automatically closed after allocation or on explicit close

### 6.6 PDF Processing
- **Receipt printing**: pdf-lib for merge + crop (58% height)
- **Receipt allocation extraction**: pdftotext for text extraction → parseReceiptAllocations
- **Receipt header extraction**: Fallback for institutional info when AppSetting APIs return empty

### 6.7 Batch Processing (Deposits)
- In-memory job tracking (`ddBatchJobs` Map)
- Line-by-line processing with per-line success/failure
- 15-minute stale processing timeout
- 1-hour cleanup for completed jobs
- No persistence — jobs lost on server restart

### 6.8 Registry-Based Enquiry Routes
`supervisor.routes.ts` registers 50+ GET endpoints via `billingEnquiryGetEndpoints` array, mapping local paths to Platinum BillingEnquiry endpoints. This is the most efficient pattern in the codebase — single registration loop covers all enquiry tabs.

### 6.9 No Dead Routes Found
All Express routes in Phase 10-11 scope have corresponding frontend callers. No orphaned routes detected.

### 6.10 Cross-Module Dependencies
- `billing.routes.ts` and `deposits.routes.ts` both call `billing-direct-deposit-allocation/*` (group/institution endpoints shared by POS and deposits)
- `enquiries.routes.ts` and `supervisor.routes.ts` both serve BillingEnquiry endpoints (some duplicated for different use cases)
- `clearance.routes.ts` serves both POS payment options/types and clearance-specific operations

---

## 7. SERVER ROUTE FILE INVENTORY

### 7.1 Complete Route Count by File

| File | GET Routes | POST Routes | PUT/DELETE | Total |
|---|---|---|---|---|
| `auth.routes.ts` | 5 | 3 | 0 | 8 |
| `pos.routes.ts` | 15 | 3 | 0 | 18 |
| `billing.routes.ts` | 3 | 7 | 0 | 10 |
| `clearance.routes.ts` | 8 | 6 | 0 | 14 |
| `dayend.routes.ts` | 10 | 8 | 0 | 18 |
| `deposits.routes.ts` | 10 | 15 | 0 | 25 |
| `enquiries.routes.ts` | 6 | 6 | 0 | 12 |
| `supervisor.routes.ts` | 50+ | 3 | 0 | 53+ |
| `receipts.routes.ts` | 12 | 8 | 0 | 20 |
| `debt.routes.ts` | 8 | 7 | 0 | 15 |
| `legal.routes.ts` | 5 | 5 | 0 | 10 |
| `communications.routes.ts` | 3 | 3 | 0 | 6 |
| `analytics.routes.ts` | 6 | 6 | 0 | 12 |
| **TOTAL** | **141+** | **80+** | **0** | **221+** |

### 7.2 Shared Middleware Usage

| Middleware | Applied In | Purpose |
|---|---|---|
| `requireAuth(req, res)` | All route files | Session authentication check |
| `handlePlatinumResult(res, data)` | All route files | Standard response with `_error` check |
| `getPaymentDeduplicationKey` | billing, clearance | Payment dedup key generation |
| `checkPaymentDedup` | billing, clearance | Duplicate payment detection |
| `recordPaymentSubmission` | billing, clearance | Cache successful payment for dedup |
| `parseReceiptAllocations` | billing, receipts | PDF text → allocation extraction |
| `injectAuditFields` | debt, legal, comms | Audit metadata injection |
| `requireDebtPermission` | debt | Permission check for debt ops |

---

**END OF DOCUMENT**

*This detail pack covers all 16 Angular components outside the debt/legal modules (Phases 4-9). Combined with the Phase 4-5, 6-7, and 8-9 detail packs, this completes the full-system audit of every Angular component and its Platinum API integration.*

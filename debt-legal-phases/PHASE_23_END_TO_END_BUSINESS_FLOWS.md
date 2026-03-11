# Phase 23 — End-to-End Business Flows & Cross-Module Integration

**Document Version**: 1.0
**Date**: 11 March 2026
**Scope**: Complete end-to-end flow documentation for 8 primary business workflows, covering Angular component → Express route → Platinum API
**Prerequisite Phases**: Phase 14–15 (Routes), Phase 16–18 (Components), Phase 19–21 (Infrastructure), Phase 22 (API Catalog)

---

## 1. Overview

This document traces the complete lifecycle of each major business workflow from the user's browser action through the Angular component, Express proxy route, and Platinum API call, then back. It documents the data transformations, error handling, caching, and state management at each layer.

| Flow | Angular Entry | Express Route File | Key Platinum Controllers | Steps |
|---|---|---|---|---|
| 1. Login & Authentication | `LoginComponent` | `auth.routes.ts` | `auth`, `User`, `UserPermission` | 7 |
| 2. Cashier Session Lifecycle | `PosWorkflowComponent` → `CashierSetupComponent` | `auth.routes.ts`, `pos.routes.ts` | `ReceiptPrepaid`, `billing-payment` | 9 |
| 3. POS Payment (Single Account) | `PosComponent` | `billing.routes.ts`, `pos.routes.ts` | `billing-payment`, `ReceiptPrepaid` | 11 |
| 4. POS Payment (Multi-Account Basket) | `PosComponent` | `billing.routes.ts` | `billing-payment` | 8 |
| 5. Day-End Reconciliation | `CashierDayEndComponent` | `dayend.routes.ts` | `billing-payment-day-end-reconcile`, `billing/auth-day-end-reconcile` | 10 |
| 6. Direct Deposit Allocation | `ManualAllocationComponent` | `deposits.routes.ts` | `billing-direct-deposit-allocation`, `billing/direct-deposit-bulk-allocation` | 9 |
| 7. Account Enquiry & Export | `AccountEnquiryComponent` | `enquiries.routes.ts`, `supervisor.routes.ts` | `BillingEnquiry` | 6 |
| 8. Section 129 Notice Pipeline | `Section129ConfigComponent` → `TrialReviewComponent` | `debt.routes.ts` | `BillingDebt` | 8 |

---

## 2. Flow 1 — Login & Authentication

### 2.1 Sequence

```
User enters username/password → LoginComponent → POST /api/auth/login
  → Express: loginWithCredentials(username, password, dbName, siteId)
    → platinum-auth.ts: fetchTokenForUser()
      Step 1: POST auth/createToken {userName, password, dbName}
        ├── SUCCESS → extract token + userData → authMode='direct'
        ├── LOCKOUT → set lockoutCache, skip for 10min → fall through to Azure
        └── FAIL → fall through to Azure
      Step 2 (fallback): POST auth/createTokenAzure {azureUid, email, username, dbName}
        ├── SUCCESS → token obtained, but may resolve to wrong user (returns generic/admin user)
        │   └── Step 3: Resolve actual user via 4 search endpoints (sequential, 8s AbortSignal timeout each):
        │       a) GET /api/User/search?name={name}
        │       b) GET /api/User?$filter=contains(userName,'{name}')
        │       c) GET /api/User/by-name?userName={name}
        │       d) GET /api/User?$filter=contains(firstName,'{name}')
        │   └── All 4 fail? → Step 4: Streamed GET /api/User (full list, max 5MB, match by name)
        │   └── Match found → cache in resolvedUserCache (1hr TTL) → authMode='azure'
        └── FAIL → throw "User not found"
    → Store session: req.session.platinumAuth = { token, tokenExpiry, userData, authMode, siteId }
  → Response: { success, user: { user_ID, userName, firstName, lastName, finYear }, site: { id, name, logo, themeClass } }
  → LoginComponent: AuthService stores user, navigates to /pos
```

### 2.2 Token Refresh

```
Any subsequent API call → platinumGet/Post/Put/Delete
  → refreshSessionToken(session) checks tokenExpiry (with 60s buffer)
    ├── Not expired (expiry > now + 60s) → return existing token
    └── Expired → fetchTokenForUser(session.userData.userName, PLATINUM_API_PASSWORD, dbName, apiUrl)
       └── Uses userName from session + password from env (PLATINUM_API_PASSWORD)
       └── Updates session.token and session.tokenExpiry
       └── Mutex per user+site prevents concurrent refresh races
  → Token TTL: 7 hours (set from API response or default)
```

### 2.3 Multi-Site Support

```
Login screen shows site selector → populated from GET /api/sites
  → Returns SITE_CONFIGS: [{id:'george', apiUrl:'...', dbName:'George'}, {id:'site02', apiUrl:'...', dbName:'Site02'}]
  → Selected siteId stored in session
  → All subsequent platinumGet/Post calls resolve API URL via getApiUrlForSession(session)
  → UI applies theme: site02 sets CSS class 'theme-site02' → --platinum-primary: #1E6B45
```

### 2.4 Key State Artifacts

| Layer | Artifact | TTL | Purpose |
|---|---|---|---|
| Express session | `platinumAuth` (UserSession) | 12hr (cookie) | JWT token, userData, siteId, authMode |
| Server memory | `resolvedUserCache` | 1hr | Cached user lookups to avoid repeated searches |
| Server memory | `lockoutCache` | 10min | Prevents repeated createToken calls during lockout |
| Server memory | `responseCache` | 30s, max 500 | GET response deduplication |
| Angular | `AuthService.user` signal | Session lifetime | User data in browser |

---

## 3. Flow 2 — Cashier Session Lifecycle

### 3.1 Session Detection (Page Load)

```
PosWorkflowComponent.ngOnInit()
  → GET /api/platinum/auth/active-cashier-by-userid?userid={userId}&finYear={finYear}
    → auth.routes.ts:
      Step 1: GET /api/ReceiptPrepaid/validate-cashier {userId, finYear}
        → Returns: { cashier, cashOffice, receiptRange, cashierReconcile, reconcileStatusCode }
      Step 2 (if cashier=null): Fallback chain:
        a) Check session.knownCashierId → GET /api/ReceiptPrepaid/cashier-detailsById
        b) GET /api/billing/auth-day-end-reconcile/active-cashierid-by-userid
           → GET /api/ReceiptPrepaid/cashier-detailsById
        c) GET /api/ReceiptPrepaid/cashier-list (match by userId)
           ↳ Only runs when topLevelIsReturned || cashierReconcile context exists (not always)
        d) Use session.knownCashierData (last resort, marked as inactive)
      Step 3 (if cashierReconcile=null): Secondary check:
        → GET /api/billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid
    → Response: { active, cashierId, cashierRegistered, isActive, officeId, officeName,
                   hasPendingDayEnd, hasDayEndReturned, dayEndReturnReason, details }
  → PosWorkflowComponent determines tab:
    ├── hasDayEndReturned → 'transact' tab (can re-submit)
    ├── hasPendingDayEnd → 'transact' tab (status message shown)
    ├── isActive + officeId → check recon status:
    │   └── GET /api/platinum/receipt-prepaid/validate-cashier-day-end-recon
    │       ├── Needs reconcile → 'day-end' tab
    │       └── OK → 'transact' tab
    └── No session → 'setup' tab
```

### 3.2 Session Creation

```
CashierSetupComponent:
  Step 1: Load cash offices
    → GET /api/platinum/receipt-prepaid/cash-offices?finYear={}&userId={}
      → Express merges two sources:
        a) GET /api/ReceiptPrepaid/cash-offices {finYear, userId}
        b) GET /api/billing/auth-day-end-reconcile/cash-office-list
        → Merged via officeMap, vote data enriched
        → If < 5 offices: probe IDs 1-20 via GET active-cashOffice-details
    → Returns: [{ cashOffice_ID, cashOfficeDesc, cashOnHandLimit, vote_ID, vote, vote1 }]
  
  Step 2: User selects office, enters float amount
  
  Step 3: Submit setup
    → POST /api/platinum/receipt-prepaid/submit-cashier-setup
      → POST /api/ReceiptPrepaid/submit-cashier-setup
        Payload: { id:0, user_Id, cashFloat, officeId, isVirtual:false }
      → Response: { cashier: { id, isActive, officeId } }
      → Express stores knownCashierId in session
  
  Step 4: Validate receipt range
    → GET /api/platinum/receipt-prepaid/validate-receipt-range
      → GET /api/billing-payment/payment-options {userId, cashofficeId, cashierId}
      → Returns: { valid: true/false, reason }
  
  Step 5: → PosWorkflowComponent.onSessionStarted() → tab switches to 'transact'
```

### 3.3 Session Close

```
POST /api/platinum/receipt-prepaid/submit-cashier-setup
  Payload: { id: cashierId, user_Id, isActive: false }
  → Clears knownCashier data from session
  → CashierSetupComponent resets to office selection
```

---

## 4. Flow 3 — POS Payment (Single Account)

### 4.1 Account Search

```
PosComponent: Unified search bar
  → User types query (debounced 300ms)
  → Parallel searches:
    a) GET /api/platinum/receipt-prepaid/cons-accounts?search={query}
       → /api/ReceiptPrepaid/cons-accounts → account results
    b) POST /api/platinum/billing-payment/search-account-groups {searchTerm: query}
       → /api/billing-direct-deposit-allocation/load-details-payment-grouping-institution-data
       → institution/group results
    c) GET clearance, misc, prepaid searches (mode-dependent)
  → Results merged into UnifiedSearchResult[] with TYPE_LABELS
  → User selects result → accountDetailLoading
```

### 4.2 Account Detail Fetch

```
PosComponent: User selects account from search
  → GET /api/platinum/receipt-prepaid/cons-account-details?accountId={id}&_nocache={ts}
    → /api/ReceiptPrepaid/cons-account-details (no-cache response header)
    → Returns: { account_ID, accountNumber, name, outStandingAmt, billId, cutOffID,
                  cutOffAmount, debtAmount, debtArrangementId, sundryDebtorsId, billingCycleId, ... }
  → PosBasketService.addItem() creates BasketItem with type='account'
```

### 4.3 Payment Submission

```
PosComponent: User clicks Pay
  → showPaymentPanel → user selects tender type (cash/card/split)
  → SA cash rounding: nearest 10c adjusts first basket item
  → For CASH payment:
    → POST /api/platinum/billing-payment/submit-consumer-payment/{userId}
      Body: {
        account: { account_ID, accountNumber, name, outStandingAmt, billId, cutOffID, ... },
        requestModel: { finYear, receiptDate, totalAmount, tenderAmount, changeAmount,
                        paymentType:'Cash', paymentOption, outStandingAmount, apiTransactionID:0,
                        isReconciled:0, isCancelled:0 }
      }
      → Express: deduplication check (15s window, key=userId+account_ID+amount+type)
        ├── Duplicate → return cached response
        └── New → POST /api/billing-payment/submit-consumer-payment/{userId}
      → Response: { isSuccess, receiptNo, receiptId, message }
  
  → For CARD payment:
    → Same endpoint but paymentType:'CreditCard' (or 3), cardNumber included
  
  → For SPLIT TENDER (cash + card):
    → Two sequential API calls:
      Call 1: Cash portion with first N items from basket (by processing order)
      Call 2: Card portion with remaining items
    → Both use deduplication
```

### 4.4 Receipt Delivery

```
After successful payment:
  → User chooses: Print / Email / SMS / WhatsApp
  
  Print:
    → POST /api/platinum/billing-payment/print-receipt
      Body: { Ids: [receiptId], ReceiptNos: [receiptNo], IsReprint: false }
      → Express: direct fetch to Platinum API (binary PDF response)
      → PDF pages cropped to 58% height for receipt format
      → Returns application/pdf
  
  Email/SMS/WhatsApp:
    → POST /api/platinum/billing-payment/send-receipt
      Body: { receiptNo, deliveryMethod, emailAddress, phoneNumber, userId }
      → /api/billing-payment/send-receipt
```

---

## 5. Flow 4 — POS Multi-Account Basket Payment

### 5.1 Basket Building

```
PosComponent + PosBasketService:
  → Multiple accounts added via search → addItem()
  → Each item has type: 'account' | 'clearance' | 'prepaid' | 'misc'
  → PROCESSING_ORDER enforced: account(1) → clearance(2) → prepaid(3) → misc(4)
  → Basket signals: items(), totalAmount(), itemCount()
  → SA cash rounding adjusts first item by processing order
```

### 5.2 CSV Import (4-Step Wizard)

```
Step 1 (Upload): User selects CSV file → FileReader
Step 2 (Preview): Auto-detect headers/delimiters → preview grid
Step 3 (Validate): Batch validate accounts against Platinum:
  → POST /api/platinum/billing-payment/search-accounts (per account row)
  → GET /api/platinum/receipt-prepaid/cons-account-details (for matched accounts)
  → Detects basket duplicates + intra-file duplicates
  → Results: CsvValidatedRow[] with status: found/not_found/duplicate/error
Step 4 (Add): Validated rows added to basket with pre-filled amounts from CSV
```

### 5.3 Multi-Account Submission

```
POST /api/platinum/billing-payment/submit-multiple-payment/{userId}
  Body: {
    accounts: [{ accountID, accountNumber, name, outstandingAmount, paymentAmount, billId }],
    requestModel: { finYear, receiptDate, totalAmount, tenderAmount, changeAmount, paymentType, ... }
  }
  → Express: validate no accountID=0, dedup check
  → Dynamic timeout: max(60s, accounts.length × 8s)
  → POST /api/billing-payment/submit-multiple-payment/{userId}
  → Response: { isSuccess, receipts: [{ receiptNo, receiptId }], message }
  → Multi-receipt print: fetch each PDF individually, merge via pdf-lib, crop pages
```

---

## 6. Flow 5 — Day-End Reconciliation

### 6.1 Load Reconciliation Data

```
CashierDayEndComponent.ngOnInit():
  Step 1: Get cashier details
    → GET /api/platinum/billing-payment-day-end/get-cashier-details?cashierId={}&finYear={}
      → /api/billing-payment-day-end-reconcile/get-cashier-details
  
  Step 2: Get receipt lists (parallel)
    → POST /api/platinum/auth-day-end/cashier-receipt-cash-list
    → POST /api/platinum/auth-day-end/cashier-receipt-cheque-list
    → POST /api/platinum/auth-day-end/cashier-receipt-card-list
    → POST /api/platinum/auth-day-end/cashier-receipt-drop-box-list
    → (each calls /api/billing/auth-day-end-reconcile/{type})
  
  Step 3: Get system totals
    → POST /api/platinum/auth-day-end/system-vs-cashier-data-list
      → /api/billing/auth-day-end-reconcile/system-vs-cashier-data-list
```

### 6.2 Denomination Entry

```
CashierDayEndComponent:
  → User enters denomination counts (coins + notes)
  → Component calculates: totalCash = Σ(denomination × count)
  → Variance = systemTotal - cashierTotal
  → Must explain variance if non-zero
```

### 6.3 Submit Reconciliation

```
POST /api/platinum/auth-day-end/submit-day-auth-reconcile
  Body: { cashierId, finYear, denominations: [...], totalAmount, notes }
  → /api/billing/auth-day-end-reconcile/submit-day-auth-reconcile
  → Sets session.dayEndPending = true
  → Response: { success, reconcileId }
  → UI shows "Pending supervisor approval" status
```

### 6.4 Supervisor Approval/Return Flow

```
SupervisorDashboard:
  → GET /api/platinum/auth-day-end/pending-cancel-requests → list pending reconciles
  → GET /api/platinum/auth-day-end-per-office/cashier-reconcile-status → status per office
  
  Approve:
    → POST /api/platinum/auth-day-end/finish-day-end-reconcile { reconcileId }
      → /api/billing/auth-day-end-reconcile/finish-day-end-reconcile
      → Cashier's session closed, day-end complete
  
  Return for corrections:
    → POST /api/platinum/auth-day-end/return-day-end-reconcile { reconcileId, returnReason }
      → /api/billing/auth-day-end-reconcile/return-day-end-reconcile
      → Cashier sees hasDayEndReturned=true, can re-submit
  
  Print cash report:
    → POST /api/platinum/auth-day-end/print-cash-report → binary PDF
  
  Print deposit slip:
    → POST /api/platinum/auth-day-end/print-deposit-slip → binary PDF
```

### 6.5 Receipt Cancellation Sub-Flow

```
Cashier requests cancellation:
  → POST /api/platinum/auth-day-end/request-cancel-receipt { receiptId, reason }
    → /api/billing/auth-day-end-reconcile/request-cancel-receipt

Supervisor reviews:
  → GET /api/platinum/auth-day-end/pending-cancel-requests
  → Approve: POST /api/platinum/auth-day-end/approve-cancel-receipt { requestId }
  → Decline: POST /api/platinum/auth-day-end/decline-cancel-receipt { requestId, reason }
```

---

## 7. Flow 6 — Direct Deposit Allocation

### 7.1 Load Unprocessed Deposits

```
DirectDepositsComponent.ngOnInit():
  → POST /api/platinum/direct-deposit-bulk/get-unprocessed
    Body: { filters, pagination }
    → /api/billing/direct-deposit-bulk-allocation/get-unprocessed-direct-deposits
    → Returns: grid of unallocated bank deposits
  → Smart grid: sortable columns, pagination, search/filter
```

### 7.2 Auto-Allocation

```
User clicks Auto-Allocate on a deposit row:
  → parseDescriptionForClues(description) — client-side engine:
    ├── ERF number detection (regex: /ERF\s*(\d+)/i)
    ├── Meter number detection
    ├── Area/ward detection
    ├── Institution name detection
    ├── Account number patterns
    → Returns: { clues[], confidence: 0-100 }
  
  → For each clue, search Platinum via Express proxy:
    a) GET /api/platinum/direct-deposit-allocation/get-account-autocomplete?search={clue}
       → /api/billing-direct-deposit-allocation/get-account-autocomplete
    b) GET /api/platinum/direct-deposit-allocation/get-old-account-autocomplete?search={clue}
       → /api/billing-direct-deposit-allocation/get-old-account-autocomplete
    c) GET /api/platinum/direct-deposit-allocation/get-clearance-autocomplete?search={clue}
       → /api/billing-direct-deposit-allocation/get-clearence-autocomplete (Platinum typo preserved)
  
  → AI matching (if OpenAI available):
    → OpenAI analyzes description + candidate accounts → ranked matches
  
  → Best match presented to user for confirmation
```

### 7.3 Manual Allocation (7 Search Scopes)

```
ManualAllocationComponent:
  → User opens allocation panel for a deposit
  → Search scope selector: ALL | ACCOUNT | PREPAID | CLEARANCE | DIRECT | GROUP | INSTITUTION
  
  ACCOUNT scope:
    → POST /api/platinum/direct-deposit-allocation/get-consumer-details-data { searchTerm }
      → /api/billing-direct-deposit-allocation/get-consumer-details-data
  
  CLEARANCE scope:
    → POST /api/platinum/direct-deposit-allocation/load-details-clearance { accountId }
      → /api/billing-direct-deposit-allocation/load-details-clearance
    → POST /api/platinum/direct-deposit-allocation/get-clearance-details-info { accountId }
      → /api/billing-direct-deposit-allocation/get-clearance-details-info
      → Section 118(1) & 118(3) cost breakdowns
  
  GROUP/INSTITUTION scope:
    → POST /api/platinum/direct-deposit-allocation/load-details-payment-grouping-institution-data { searchTerm }
      → /api/billing-direct-deposit-allocation/load-details-payment-grouping-institution-data
    → Expand group:
      → POST /api/platinum/direct-deposit-allocation/load-details-payment-grouping { groupId, institutionName }
        → /api/billing-direct-deposit-allocation/load-details-payment-grouping
        → Smart budget distribution across group accounts
```

### 7.4 Confirm & Submit Allocation

```
User confirms allocation:
  → POST /api/platinum/direct-deposit-allocation/load-confirm-payment-details
    Body: { depositId, accountId, amount, allocationType, ... }
    → /api/billing-direct-deposit-allocation/load-confirm-payment-details
  → Response: { success, receiptNo }
  → Row moves from unprocessed to processed grid
```

### 7.5 Bulk CSV Import

```
CSV import flow:
  Step 1: Upload CSV → POST /api/platinum/direct-deposit-allocation/submit-generic-import
    → /api/billing-direct-deposit-allocation/submit-generic-import
    → Returns: { jobId }
  Step 2: Poll status → GET /api/platinum/direct-deposit-allocation/generic-import-status/{jobId}
  Step 3: View results → GET /api/platinum/direct-deposit-allocation/generic-import-results/{jobId}
  Step 4: View errors → GET /api/platinum/direct-deposit-allocation/generic-import-errors/{jobId}
```

---

## 8. Flow 7 — Account Enquiry & Export

### 8.1 Account Search

```
AccountEnquiryComponent:
  Quick search:
    → GET /api/platinum/enquiry/autocomplete?searchTerm={query}
      → /api/BillingEnquiry/Autocomplete
      → Returns: [{ accountId, accountNumber, name, address }]
  
  Advanced search:
    → POST /api/platinum/enquiry/search
      Body: { searchCriteria }
      → /api/BillingEnquiry/EnquiryResults
      → Returns: detailed search results
```

### 8.2 Tab Data Loading (30 Tabs)

```
User selects account → tab panel loads:
  Each tab calls its own BillingEnquiry endpoint:
  
  Account tab:
    → GET /api/platinum/billing-enquiry/basic-account-details?accountId={id}
      → /api/BillingEnquiry/BasicAccountDetails
  
  Name tab:
    → GET /api/platinum/enquiry/name-info?accountId={id}
      → /api/BillingEnquiry/NameInfoByAccountId
  
  Property tab:
    → GET /api/platinum/enquiry/property-details?accountId={id}
      → /api/BillingEnquiry/PropertyDetailsByAccountId
    → Section 49/78 Letters + Valuation Certificate: client-side PDF generation
  
  Services tab:
    → GET /api/platinum/billing-enquiry/services-search-results?accountId={id}
      → /api/BillingEnquiry/ServicesSearchResults
  
  Balance/Debt tab:
    → GET /api/platinum/enquiry/service-type-balance?accountId={id}
      → /api/BillingEnquiry/ServiceTypeBalanceDetails
    → GET /api/platinum/enquiry/total-balance-debt?accountId={id}
      → /api/BillingEnquiry/TotalBalanceDebtInquiry
  
  ... (28 more tabs follow same pattern via loop-generated routes in supervisor.routes.ts)
  
  All tabs share the pattern:
    GET /api/platinum/billing-enquiry/{tab-name}?accountId={id}
      → /api/BillingEnquiry/{PlatinumPath}
```

### 8.3 Export (All Tabs)

```
ExportService.exportCsv(options, headers, rows) / exportPdf(options, headers, rows, aligns)
  → Filename: GEORGE_MUNICIPALITY_{tabName}_{accountNo}_{YYYYMMDD}
  → CSV: BOM + UTF-8, comma-separated, quoted strings
  → PDF: Header with municipality branding (hardcoded #0f2b46/#c9a84c), table layout
  → Print: opens browser print dialog
```

### 8.4 Special Tab Actions

```
Occupiers tab:
  → GET /api/platinum/billing-enquiry/add-occupiers?accountId={id}
  → POST /api/BillingEnquiry/AddOccupier (create)
  → DELETE /api/BillingEnquiry/AddOccupier (remove)
  → Proof of Residence: client-side PDF generation

Statements tab:
  → GET /api/platinum/billing-enquiry/generated-statements-by-id?accountId={id}
  → POST /api/BillingEnquiry/EmailBillingStatement (email statement)
  → POST /api/BillingEnquiry/SmsBillingStatement (SMS statement)

Rebuild account:
  → GET /api/platinum/enquiry/rebuild-account?accountId={id}
    → /api/BillingEnquiry/rebuildFullAccount
```

---

## 9. Flow 8 — Section 129 Notice Pipeline

### 9.1 Configuration

```
Section129ConfigComponent:
  → Load existing configs:
    GET /api/platinum/billing-debt/section129-config-list
      → /api/BillingDebt/section129-config-list
  
  → Load lookup data (parallel):
    GET /api/platinum/billing-debt/account-types → /api/BillingDebt/account-types
    GET /api/platinum/billing-debt/billing-cycles → /api/BillingDebt/billing-cycles
    GET /api/platinum/billing-debt/towns → /api/BillingDebt/towns
    GET /api/platinum/billing-debt/property-categories → /api/BillingDebt/property-categories
    GET /api/platinum/billing-debt/person-types → /api/BillingDebt/person-types
    GET /api/platinum/billing-debt/ageing-ranges → /api/BillingDebt/ageing-ranges
    GET /api/platinum/billing-debt/additional-billing-types → /api/BillingDebt/additional-billing-types
    GET /api/platinum/billing-debt/section129-templates → /api/BillingDebt/section129-templates
    GET /api/platinum/billing-debt/section129-sms-templates → /api/BillingDebt/section129-sms-templates
  
  → Save config:
    POST /api/platinum/billing-debt/section129-config-save { config }
      → /api/BillingDebt/section129-config-save
```

### 9.2 Trial Run

```
User initiates trial run:
  → POST /api/platinum/billing-debt/section129-trial-run { configId, criteria }
    → /api/BillingDebt/section129-trial-run
    → Returns: { runId, status: 'processing' }
  
  → Poll status:
    GET /api/platinum/billing-debt/section129-run-status?runId={runId}
      → /api/BillingDebt/section129-run-status
      → Until status = 'completed'
  
  → View results:
    GET /api/platinum/billing-debt/section129-run-accounts?runId={runId}
      → /api/BillingDebt/section129-run-accounts
      → Returns: [{ accountId, accountNumber, name, debtAmount, qualifies, reason }]
```

### 9.3 Trial Review & Decision

```
TrialReviewComponent:
  → User reviews account list from trial run
  → Can exclude accounts from final run
  → Submit review decision:
    POST /api/platinum/billing-debt/section129-trial-review-submit
      Body: { runId, decision: 'approve'|'reject', excludedAccountIds, notes }
      → /api/BillingDebt/section129-trial-review-submit
```

### 9.4 Authorization

```
Supervisor authorizes the run:
  → POST /api/platinum/billing-debt/section129-authorize { runId, authorizerId }
    → /api/BillingDebt/section129-authorize
    → Run moves to 'authorized' status
```

### 9.5 Final Run (Notice Generation)

```
POST /api/platinum/billing-debt/section129-final-run { runId }
  → /api/BillingDebt/section129-final-run
  → Generates Section 129 notices for all qualified accounts
  → Dispatches via configured channels (letter, SMS, email)
  → Returns: { success, noticeCount, fileCount }

View generated files:
  → GET /api/platinum/billing-debt/section129-run-files?runId={runId}
    → /api/BillingDebt/section129-run-files
```

### 9.6 Reporting

```
GET /api/platinum/billing-debt/section129-report { filters }
  → /api/BillingDebt/section129-report
  → Returns: aggregated notice statistics

GET /api/platinum/billing-debt/section129-runs
  → /api/BillingDebt/section129-runs
  → Returns: run history

GET /api/platinum/billing-debt/sms-log-report { runId }
  → /api/BillingDebt/sms-log-report
  → Returns: SMS delivery status log
```

---

## 10. Cross-Cutting Concerns

### 10.1 Response Caching Strategy

```
platinum-auth.ts manages a 3-tier caching system:

Tier 1 — ALWAYS CACHE (30s TTL, max 500 entries):
  /api/BillingEnquiry/* (all enquiry reads)
  /api/ReceiptPrepaid/cashier-detailsById
  /api/ReceiptPrepaid/active-cashier-details
  /api/billing-payment/payment-options
  /api/billing-payment/payment-types

Tier 2 — NEVER CACHE:
  /api/BillingEnquiry/rebuild-full-account
  /api/BillingEnquiry/TotalBalanceDebtInquiry
  /api/billing-payment/submit-consumer-payment
  /api/billing-payment/submit-multiple-payment
  /api/billing-payment/save-multiple-account-payment
  /api/ReceiptPrepaid/validate-cashier
  /api/ReceiptPrepaid/ValidateCashierDayEndRecon
  /api/billing-payment-day-end-reconcile/save-Reconcile-data

Tier 3 — User-Specific Cache Keys:
  Paths in USER_SPECIFIC_PATHS use session.siteId + userId to scope cache entries
  Prevents cross-user cache contamination
```

### 10.2 Concurrency Control

```
MAX_CONCURRENT_REQUESTS = 20 (to Platinum API)
  → acquireSlot() blocks when at capacity
  → requestQueue FIFO when slots exhausted
  → releaseSlot() on response/error
  → In-flight deduplication: same GET URL → share single Promise
```

### 10.3 Payment Deduplication

```
middleware.ts:
  PAYMENT_DEDUP_WINDOW_MS = 15000 (15 seconds)
  
  getPaymentDeduplicationKey(userId, body):
    → Plain string concatenation: `${userId}|${accountKey}|${totalAmount}|${paymentType}`
    → accountKey = `single:{account_ID}` for single payments, `multi:{sorted IDs}` for multi
    → NOT a hash — literal pipe-delimited string used as Map key
  
  checkPaymentDedup(key):
    ├── Found within window → { isDuplicate: true, cachedResponse }
    └── Not found → { isDuplicate: false }
  
  recordPaymentSubmission(key, response):
    → Stores response with timestamp for dedup window
  
  Applied to: submit-consumer-payment, submit-multiple-payment
```

### 10.4 Error Handling Pattern

```
Every Express route follows this pattern:

try {
  const session = requireAuth(req, res); if (!session) return;
  const data = await platinumGet/Post(session, path, params);
  handlePlatinumResult(res, data);
} catch (e: any) {
  res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
}

handlePlatinumResult(res, data):
  ├── data._error → res.status(data.status || 502).json(data)
  └── data OK → res.json(data)

Angular ErrorInterceptor:
  ├── 401 → AuthService.logout(), navigate to /login
  ├── 502 → ToastService.error("Server connection error")
  └── Other → ToastService.error(error.message)
```

### 10.5 Audit Metadata Injection

```
middleware.ts: injectAuditFields middleware (applied to debt/legal/communications routes)
  → Adds to request body:
    { auditUserId, auditUserName, auditTimestamp, auditAction }
  → Source: session.userData
  → All write actions to BillingDebt controller include audit trail
```

### 10.6 PDF Generation Patterns

```
Two PDF generation patterns in the system:

Pattern 1 — Platinum PDF Proxy:
  Express fetches PDF binary from Platinum → crops/merges via pdf-lib → returns to browser
  Used by: print-receipt, print-cash-report, print-deposit-slip
  Cropping: receipt pages cropped to 58% height
  Merging: multi-receipt PDFs merged via PDFDocument.copyPages()
  Empty detection: validatePdfNotEmpty() checks page count + stream count

Pattern 2 — Client-Side PDF Generation:
  ExportService builds PDF in browser
  Used by: Section 49/78 Letters, Valuation Certificate, Proof of Residence, tab exports
  Branding: hardcoded #0f2b46 header, #c9a84c accents
  Filename: GEORGE_MUNICIPALITY_{context}_{date}.pdf
```

---

## 11. Data Flow Summary Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Angular 19)                  │
│                                                          │
│  LoginComponent → AuthService.user signal                │
│  PosWorkflowComponent → PosComponent + BasketService     │
│  CashierSetupComponent / CashierDayEndComponent          │
│  AccountEnquiryComponent → 30 tab sub-queries            │
│  DirectDepositsComponent → Auto/Manual allocation        │
│  Section129ConfigComponent → Trial → Review → Final      │
│                                                          │
│  All HTTP via ApiService → proxy.conf.json → port 3000   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (dev: proxy 5000→3000)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              EXPRESS SERVER (port 3000/5000)              │
│                                                          │
│  13 route files → requireAuth → platinumGet/Post/Put/Del │
│  Session: pos.sid cookie → PostgreSQL session store      │
│  Caching: responseCache (30s/500), in-flight dedup       │
│  Concurrency: 20 max concurrent to Platinum              │
│  Dedup: 15s payment dedup window                         │
│  PDF: fetch binary → crop/merge via pdf-lib → return     │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS (Bearer token)
                       ▼
┌─────────────────────────────────────────────────────────┐
│           PLATINUM INZALO EMS API                        │
│                                                          │
│  30 controllers, ~383 endpoints                          │
│  Auth: createToken / createTokenAzure                    │
│  Core: ReceiptPrepaid, billing-payment                   │
│  Enquiry: BillingEnquiry (90+ sub-endpoints)             │
│  Deposits: billing-direct-deposit-allocation             │
│  Day-End: billing/auth-day-end-reconcile                 │
│  Debt: BillingDebt (89 endpoints)                        │
│  Dashboard: BillingDashboard (34 endpoints)              │
│                                                          │
│  George: georgeplatinumuatapi.azurewebsites.net          │
│  Site02: test-ems-site02-token-api.azurewebsites.net     │
└─────────────────────────────────────────────────────────┘
```

---

*End of Phase 23 — End-to-End Business Flows & Cross-Module Integration*

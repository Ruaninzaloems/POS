# Phase 14 — Core Server Route Handlers: Auth, POS, Billing, Clearance, Enquiries, Day-End

**Document Version**: 1.0
**Date**: 11 March 2026
**Scope**: 6 route handler files, 128 endpoints, ~4,487 source lines
**Prerequisite Phases**: Phase 13 (Server Infrastructure), Phase 12 (Shared Services & Models)

---

## 1. Overview

This document provides handler-level detail for the six "core operations" route files that power the primary POS cashier workflow: authentication, receipting, payment submission, clearance processing, billing enquiries, and day-end reconciliation.

| Route File | Endpoints | Lines | Platinum API Controllers |
|---|---|---|---|
| `auth.routes.ts` | 8 | 353 | `auth/createToken`, `ReceiptPrepaid`, `billing/auth-day-end-reconcile`, `UserPermission` |
| `pos.routes.ts` | 25 | 543 | `ReceiptPrepaid`, `billing-payment`, `billing-payment-clearance`, `UserPermission`, `User` |
| `billing.routes.ts` | 16 | 748 | `billing-payment`, `billing-direct-deposit-allocation`, `billing-payment-clearance`, `ViewReceipt`, `BillingEnquiry` |
| `clearance.routes.ts` | 17 | 602 | `billing-payment-clearance`, `billing-payment-miscellaneous` |
| `enquiries.routes.ts` | 13 | 748 | `BillingEnquiry` |
| `dayend.routes.ts` | 49 | 811 | `billing-payment-day-end-reconcile`, `billing/auth-day-end-reconcile` |
| **Totals** | **128** | **3,805** | |

---

## 2. auth.routes.ts — Authentication & Cashier Session Validation

**Registration**: `registerAuthRoutes(app, httpServer)`
**Imports**: `getSession`, `requireAuth`, `handlePlatinumResult`, `platinumGet`, `platinumPost`, `loginWithCredentials`, `logoutSession`, `isSessionAuthenticated`, `refreshSessionToken`, `getPlatinumApiUrl`, `getPlatinumDbName`, `clearLockoutCache`, `SITE_CONFIGS`, `getSiteConfig`

### 2.1 Endpoint Catalogue

| # | Method | Local Route | Auth | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|---|
| 1 | GET | `/api/sites` | None | None (local) | Returns `SITE_CONFIGS` array (id, name, logo, themeClass) |
| 2 | POST | `/api/auth/login` | None | `auth/createToken` (via `loginWithCredentials`) | Clears lockout cache; stores `platinumAuth` in session; returns user + site info |
| 3 | POST | `/api/auth/logout` | None | None | Calls `logoutSession(session)`, destroys Express session |
| 4 | GET | `/api/auth/status` | None | None (session check) | Returns `authenticated: true/false` + user/site info from session |
| 5 | GET | `/api/auth/site-info` | None | None | Returns site config from session (default: 'george') |
| 6 | GET | `/api/platinum/auth/user-info` | Session | None (session data) | Returns session `userData` fields: user_ID, userName, firstName, lastName, eMail, enabled, superUser, cashFloat, finYear, authMode |
| 7 | POST | `/api/platinum/auth/ensure-cashier` | requireAuth | `billing/auth-day-end-reconcile/active-cashierid-by-userid`, `ReceiptPrepaid/cashier-detailsById` | Validates user is registered as active cashier; returns cashierId, officeId, cashierMapped status |
| 8 | GET | `/api/platinum/auth/active-cashier-by-userid` | requireAuth | `ReceiptPrepaid/validate-cashier` + 4 fallbacks | Complex multi-tier cashier lookup (see §2.2) |

### 2.2 Complex Handler: active-cashier-by-userid

This is the most complex endpoint in the entire application (250+ lines). It resolves the active cashier state for a user through a cascading fallback strategy:

**Primary**: `ReceiptPrepaid/validate-cashier` → returns cashier, cashOffice, receiptRange, cashierReconcile

**Fallback Tier 1**: If `cashier` is null, check `session.knownCashierId` → `ReceiptPrepaid/cashier-detailsById`
**Fallback Tier 2**: `billing/auth-day-end-reconcile/active-cashierid-by-userid` → handles case where cashierId equals userId
**Fallback Tier 3**: If day-end is returned/pending but no cashier found → scan `ReceiptPrepaid/cashier-list` for matching userId
**Fallback Tier 4**: `session.knownCashierData` stored from previous successful lookups (marked `isActive: false`)

**Reconcile Resolution**: If `cashierReconcile` is null but cashierId exists → secondary check via `billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid`

**Session State Written**:
- `session.knownCashierId` — cached for future fallback
- `session.knownCashierData` — full cashier record
- `session.dayEndPending` — cleared on returned/completed

**Response Shape**:
```typescript
{
  active: boolean,           // isSessionActive OR hasDayEndReturned
  cashierId: number | null,
  cashierRegistered: boolean,
  cashFloat: number,
  officeId: number | null,
  officeName: string | null,
  cashOnHandLimit: number,
  isActive: boolean,
  hasReceiptRange: boolean,
  hasPendingDayEnd: boolean,
  hasDayEndReturned: boolean,
  dayEndReturnReason?: string,
  cashierReconcile: object | null,
  details: object | null,
  sessionNeedsCreation: boolean
}
```

### 2.3 Login Error Handling

The login handler provides user-friendly error messages based on error type:
- Network errors (`fetch`, `ECONNREFUSED`, `ETIMEDOUT`) → "Cannot connect to the billing server"
- Other errors → pass through `e.message` or "Login failed. Please try again."

---

## 3. pos.routes.ts — POS Receipting & Cashier Setup

**Registration**: `registerPosRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `platinumGet`, `platinumPost`, `platinumPut`, `refreshSessionToken`, `getPlatinumApiUrl`, `getPlatinumDbName`

### 3.1 Endpoint Catalogue

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 1 | GET | `/api/platinum/receipt-prepaid/validate-cashier` | `ReceiptPrepaid/validate-cashier` | Simple proxy |
| 2 | GET | `/api/platinum/receipt-prepaid/validate-receipt-range` | `billing-payment/payment-options` | Validates cashier has receipt range allocated (see §3.2) |
| 3 | GET | `/api/platinum/receipt-prepaid/cons-accounts` | `ReceiptPrepaid/cons-accounts` | Simple proxy |
| 4 | GET | `/api/platinum/receipt-prepaid/cons-account-details` | `ReceiptPrepaid/cons-account-details` | Strips `_nocache` param; sets `Cache-Control: no-store` |
| 5 | GET | `/api/platinum/receipt-prepaid/prepaid-account-details` | `ReceiptPrepaid/prepaid-account-details` | Simple proxy |
| 6 | GET | `/api/platinum/receipt-prepaid/cashier-details-by-id` | `ReceiptPrepaid/cashier-detailsById` | Simple proxy |
| 7 | GET | `/api/platinum/receipt-prepaid/active-cashier-details` | `ReceiptPrepaid/active-cashier-details` | Simple proxy |
| 8 | GET | `/api/platinum/receipt-prepaid/active-cash-office-details` | `ReceiptPrepaid/active-cashOffice-details` | Simple proxy |
| 9 | GET | `/api/platinum/receipt-prepaid/pos-payment-type` | `billing-payment-clearance/pos-payment-type` | Fallback mapping from ReceiptPrepaid controller |
| 10 | GET | `/api/platinum/receipt-prepaid/is-billing` | `ReceiptPrepaid/is-billing` | No params |
| 11 | GET | `/api/platinum/receipt-prepaid/search-property-rates-payment` | `ReceiptPrepaid/search-property-rates-payment` | Simple proxy |
| 12 | GET | `/api/platinum/receipt-prepaid/validate-cashier-day-end-recon` | `ReceiptPrepaid/ValidateCashierDayEndRecon` | Logs full request + response |
| 13 | GET | `/api/platinum/receipt-prepaid/get-billing-runs` | `ReceiptPrepaid/GetBillingRuns` | No params |
| 14 | GET | `/api/platinum/receipt-prepaid/service-type-wise-prepaid-list` | `ReceiptPrepaid/ServiceTypeWisePrepaidList` | Simple proxy |
| 15 | GET | `/api/platinum/active-fin-year` | `UserPermission/ActiveFinYear` | No params |
| 16 | GET | `/api/platinum/receipt-prepaid/cash-offices` | `ReceiptPrepaid/cash-offices` + 3 sources | Complex aggregation (see §3.3) |
| 17 | GET | `/api/platinum/receipt-prepaid/cheque-amend-list` | `ReceiptPrepaid/cheque-amendList` | Simple proxy |
| 18 | POST | `/api/platinum/receipt-prepaid/utilipay-breakdown-request` | `ReceiptPrepaid/UtiliPayBreakdownRequest` | Prepaid breakdown |
| 19 | POST | `/api/platinum/receipt-prepaid/utilipay-token-request` | `ReceiptPrepaid/UtiliPayTokenRequest` | Prepaid token |
| 20 | POST | `/api/platinum/receipt-prepaid/submit-prepaid-payment` | `ReceiptPrepaid/SubmitPrepaidPayment` | Simple proxy |
| 21 | POST | `/api/platinum/receipt-prepaid/submit-cashier-setup` | `ReceiptPrepaid/submit-cashier-setup` | Session create/update/close (see §3.4) |
| 22 | GET | `/api/platinum/debug/user-auth-test` | `User` + `auth/createToken` | Debug endpoint: tests multiple username candidates |
| 23 | GET | `/api/platinum/user/:id` | `User/:id` | Simple proxy |
| 24 | POST | `/api/platinum/pos/process-payment` | `billing-payment/submit-consumer-payment/:userId` | Alternative payment submission (userId from session) |
| 25 | PUT | `/api/platinum/user/:id` | `User/:id` | Uses `platinumPut` (no concurrency slot) |

### 3.2 validate-receipt-range

Uses `billing-payment/payment-options` to verify a cashier has valid receipt allocation. Accepts `userId`, `cashierId`, `officeId`, `finYear`. Returns `{ valid, reason, isActive, cashierDetailsId, officeId, officeName }`.

Response extraction handles multiple shapes: array, `.paymentOptions`, `.data.paymentOptions`, `.data`, `.value`.

### 3.3 cash-offices Aggregation

Merges data from 3+ sources into a deduplicated office list:

1. **Primary**: `ReceiptPrepaid/cash-offices` (with auto-resolved finYear and userId)
2. **Day-End List**: `billing/auth-day-end-reconcile/cash-office-list` (parallel fetch, used for vote data enrichment)
3. **Probe**: If fewer than 5 offices found, probes IDs 1-20 via `ReceiptPrepaid/active-cashOffice-details`

Each office is enriched with vote data (voteID, vote, vote1) from the day-end list. Result sorted by `cashOffice_ID`.

### 3.4 submit-cashier-setup

Handles three modes:
- **Create** (id=0): New cashier session with userId, cashFloat, officeId
- **Update** (id>0): Modify existing session
- **Close** (isActive=false): End session

On success: stores `knownCashierId`, `knownCashierOfficeId`, `knownCashierData` in session; clears `dayEndPending`.
On close: clears all knownCashier data.
On 401 error: provides different message for azure/override auth modes (bridge token limitation).

---

## 4. billing.routes.ts — Payment Submission, Receipt Printing, View Receipts

**Registration**: `registerBillingRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `getPaymentDeduplicationKey`, `checkPaymentDedup`, `recordPaymentSubmission`, `PAYMENT_DEDUP_WINDOW_MS`, `parseReceiptAllocations`, `platinumGet`, `platinumPost`, `refreshSessionToken`, `getPlatinumApiUrl`, `execSync`, `writeFileSync`, `unlinkSync`, `existsSync`
**External Dependencies**: `pdf-lib` (dynamic import for PDF merge/crop)

### 4.1 Endpoint Catalogue

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 1 | POST | `/api/platinum/billing-payment/submit-consumer-payment/:userId` | `billing-payment/submit-consumer-payment/:userId` | Payment dedup; detailed logging (see §4.2) |
| 2 | POST | `/api/platinum/billing-payment/submit-multiple-payment/:userId` | `billing-payment/submit-multiple-payment/:userId` | Validates accountIDs≠0; dynamic timeout; dedup (see §4.3) |
| 3 | POST | `/api/platinum/billing-payment/save-multiple-account-payment` | `billing-payment/save-multiple-account-payment` | Forwards query params as Platinum query |
| 4 | GET | `/api/platinum/billing-payment/get-multiple-account-payment` | `billing-payment/get-multiple-account-payment` | Simple proxy |
| 5 | POST | `/api/platinum/billing-payment/search-accounts` | `billing-payment/search-accounts` | 55s timeout |
| 6 | POST | `/api/platinum/billing-payment/search-account-groups` | `billing-direct-deposit-allocation/load-details-payment-grouping-institution-data` | Cross-controller proxy for institution search |
| 7 | POST | `/api/platinum/billing-payment/get-group-accounts` | `billing-direct-deposit-allocation/load-details-payment-grouping` | Cross-controller proxy for group drill-down |
| 8 | POST | `/api/platinum/billing-payment/print-receipt` | `billing-payment/print-receipt` | PDF handling with crop, merge, validation (see §4.4) |
| 9 | POST | `/api/platinum/billing-payment/send-receipt` | `billing-payment/send-receipt` | Delivery method: print/email/WhatsApp/SMS |
| 10 | GET | `/api/platinum/billing-payment/receipt-allocations` | `billing-payment/print-receipt` | PDF→text extraction via `pdftotext` (see §4.5) |
| 11 | GET | `/api/platinum/view-receipt/get-cashiers` | `billing/auth-day-end-reconcile/cashier-list` → fallback `ViewReceipt/get-cashiers` | Normalized output |
| 12 | GET | `/api/platinum/view-receipt/search-account-numbers` | `ViewReceipt/search-account-numbers` | Simple proxy |
| 13 | GET | `/api/platinum/view-receipt/search-receipt-numbers` | `ViewReceipt/search-recept-numbers` | Note: Platinum has typo "recept" |
| 14 | POST | `/api/platinum/view-receipt/get-receipt-list` | `ViewReceipt/get-receipt-list` | POST→GET conversion; normalizes pagination params (see §4.6) |
| 15 | GET | `/api/platinum/receipt-discovery` | Multiple probes (9+ endpoints) | Discovery/diagnostic endpoint (see §4.7) |
| 16 | GET | `/api/platinum/receipt-discovery` (continued) | Probes cashier-receipt-cash-list, card-list, system-vs-cashier, etc. | Tags results with `_source` and `_paymentType` |

### 4.2 submit-consumer-payment — Payment Deduplication

Before submission:
1. Auto-sets defaults: `apiTransactionID=0`, `isReconciled=0`, `isCancelled=0`
2. Generates dedup key via `getPaymentDeduplicationKey(userId, body)`
3. Checks `checkPaymentDedup(key)` → if duplicate within window, returns cached response
4. After success: `recordPaymentSubmission(key, data)` caches the response

Card number logging: masked to last 4 digits (`***XXXX`).

### 4.3 submit-multiple-payment

Same dedup pattern as single payment. Additional validation:
- Rejects if any account has `accountID=0` or missing (400 error with account names)
- Dynamic timeout: `max(60000, accounts.length * 8000)` ms
- Response truncated to 2000 chars in logs

### 4.4 print-receipt — PDF Processing Pipeline

**Single receipt flow**:
1. Fetch PDF from `billing-payment/print-receipt` with `Accept: application/pdf`
2. Validate PDF not empty (`validatePdfNotEmpty`): checks size>500 bytes, page count>0, stream content
3. If empty → returns 409 with `emptyReceipt: true`
4. Crop pages to 58% height (receipt content area) via `pdf-lib`
5. Return as inline PDF

**Multiple receipt flow**:
1. Fetch each receipt individually in batches of 10 (`BATCH_SIZE=10`)
2. If all fail → bulk fallback (single request with all IDs)
3. Merge individual PDFs via `pdf-lib` `PDFDocument.create()` + `copyPages`
4. Apply 58% height crop to each merged page
5. Return merged PDF

**Payload format**: `{ Ids: number[], ReceiptNos: string[], IsReprint: boolean }`

### 4.5 receipt-allocations — PDF Text Extraction

1. Fetches receipt PDF (reprint mode)
2. Writes to `/tmp/receipt_alloc_{id}_{timestamp}.pdf`
3. Runs `pdftotext` (system binary) with 10s timeout
4. Parses text via `parseReceiptAllocations` (from middleware)
5. Cleans up temp file in `finally` block

### 4.6 get-receipt-list — POST→GET Conversion

Converts POST body fields to GET query parameters with case normalization:
- `fromDate`/`FromDate` → `FromDate`
- `cashierId`/`CashierId` → `CapturerId`
- `page`/`Page` → `Page` (default: 1)
- `pageSize`/`PageSize` → `PageSize` (default: 50)

Response normalization: wraps arrays in `{ items, totalCount }` format. 90s timeout.

### 4.7 receipt-discovery — Multi-Probe Diagnostic

Probes 9+ Platinum endpoints to discover receipt data for a cashier:
1. auth/cashier-receipt-cash-list
2. auth/cashier-receipt-card-list
3. auth/system-vs-cashier-data-list
4. auth/cashier-reconcile-by-cashierid
5. auth/cashier-details
6. ReceiptPrepaid/get-cashier-receipts
7. ReceiptPrepaid/cashier-receipt-list
8. billing-payment/get-cashier-receipts
9. billing-payment/pos-cashier-receipt
10. If zero results: probes individual receipt IDs from receipt range
11. If still zero: generates formatted receipt numbers and searches

Each result tagged with `_source` field for origin tracking.

---

## 5. clearance.routes.ts — Clearance Payments, Miscellaneous, Drop Box

**Registration**: `registerClearanceRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `checkPaymentDedup`, `recordPaymentSubmission`, `PAYMENT_DEDUP_WINDOW_MS`, `getPaymentDeduplicationKey`, `platinumGet`, `platinumPost`, `refreshSessionToken`, `getPlatinumApiUrl`, `UserSession`
**Module State**: `clearanceScanSession: UserSession | null` — stored for debug batch test

### 5.1 Endpoint Catalogue

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 1 | GET | `/api/platinum/billing-payment-clearance/get-clearanceids` | `billing-payment-clearance/get-clearanceids` | Simple proxy |
| 2 | GET | `/api/platinum/billing-payment-clearance/pos-payment-type` | `billing-payment-clearance/pos-payment-type` | No params |
| 3 | GET | `/api/platinum/receipt-prepaid/cashier-payment-options` | `billing-payment/payment-options` | Complex normalization (see §5.2) |
| 4 | GET | `/api/platinum/receipt-prepaid/cashier-payment-types` | `billing-payment/payment-types` | Same normalization pattern as options (see §5.3) |
| 5 | GET | `/api/platinum/billing-payment-clearance/get-banks` | 3 fallback endpoints | Multi-endpoint fallback (see §5.4) |
| 6 | GET | `/api/platinum/billing-payment-clearance/get-branches-by-bank` | `billing-payment-clearance/get-brances-by-bank` | Note: Platinum has typo "brances" |
| 7 | GET | `/api/platinum/billing-payment-clearance/debug-batch-test` | `billing-payment-clearance/get-clearance-data` + `get-accounts-for-clearance` | Debug: tests up to 20 clearance IDs |
| 8 | GET | `/api/platinum/billing-payment-clearance/trigger-scan` | Same as debug-batch-test | Scans 37 predefined clearance IDs |
| 9 | POST | `/api/platinum/billing-payment-clearance/get-clearance-data` | `billing-payment-clearance/get-clearance-data` | Logged proxy |
| 10 | POST | `/api/platinum/billing-payment-clearance/get-accounts-for-clearance` | `billing-payment-clearance/get-accounts-for-clearance` | Logged proxy |
| 11 | POST | `/api/platinum/billing-payment-clearance/submit-payment` | `billing-payment-clearance/submit-payment` | Payment dedup; raw fetch with AbortController (see §5.5) |
| 12 | GET | `/api/platinum/billing-payment-miscellaneous/get-groups` | `billing-payment-miscellaneous/get-groups` | No params |
| 13 | GET | `/api/platinum/billing-payment-miscellaneous/get-scoa-items` | `billing-payment-miscellaneous/get-scoa-items` | Logs sample item keys |
| 14 | GET | `/api/platinum/billing-payment-miscellaneous/get-vat-rate` | `billing-payment-miscellaneous/get-vat-rate` | No params |
| 15 | POST | `/api/platinum/billing-payment-miscellaneous/submit` | `billing-payment-miscellaneous/submit` | Dual-case submission (see §5.6) |
| 16 | POST | `/api/platinum/drop-box/submit` | `billing-payment-miscellaneous/submit` | Drop box via misc payment (see §5.7) |
| 17 | GET | `/api/platinum/drop-box/list` | `billing-payment-day-end-reconcile/get-cashier-receipt-drop-box-list` | Returns `{ success, items, total }` |

### 5.2 cashier-payment-options — Response Normalization

Requires: `userId`, `cashofficeId`, `cashierId`. Optional: `officeOnly` (sends `cashierId=0`).

Extracts options from 5 possible response shapes (array, `.paymentOptions`, `.data`, `.data.paymentOptions`, `.value`).

Normalizes each option:
```typescript
{
  posPaymentOption_ID: number,
  posPaymentOptionDesc: string,
  isTicked: boolean,
  enabled: boolean
}
```

**Important auto-enable rule**: If ALL options have `tickedFlag=False`, treats ALL as enabled (Platinum may return false for all when the cashier actually has access).

Returns: `{ source: "office" | "platinum", data: normalized[] }`

### 5.3 cashier-payment-types

Same pattern as payment-options. Normalizes to `posPaymentType_ID`, `posPaymentTypeDesc`, `isTicked`, `enabled`.

### 5.4 get-banks — Multi-Endpoint Fallback

Tries 3 Platinum endpoints in order:
1. `billing-payment-clearance/get-banks`
2. `BillingEnquiry/GetConstBanks`
3. `const-banks`

Returns first successful non-error response. If all fail → 502.

### 5.5 clearance submit-payment

Uses raw `fetch` with `AbortController` (35s timeout) instead of `platinumPost`. This bypasses the concurrency slot system.

Dedup key format: `clearance|{userId}|{clearanceId}|{amount}|{paymentTypeId}`

### 5.6 Miscellaneous Payment Submit

**Validation**: userId, miscellaneousPaymentGroup, scoaItem, totalAmount required.

Sanitizes payload with defaults for all fields (strings default to `''`, numbers to `0`, booleans to `false`).

**Dual-case submission strategy**: Tries PascalCase payload first, then camelCase if first fails. This handles Platinum API case-sensitivity variations.

**EFT receipt warning**: If response has `receiptNo` starting with "EFT", logs warning (expected POS receipt number format).

### 5.7 Drop Box Submit

Wraps miscellaneous payment submit with drop-box-specific defaults:
- `lastName`: description or "Cash Drop"
- `miscellaneousPaymentGroup`: null
- `scoaItem`: null
- `description`: "Drop Box - Cash Drop"
- `vatAmount`: 0, `vatPercentage`: 0, `isVatable`: false

Returns: `{ success, message, receiptNo, amount, data }`

---

## 6. enquiries.routes.ts — Billing Enquiry & Account Details

**Registration**: `registerEnquiriesRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `platinumGet`, `platinumPost`, `getPlatinumApiUrl`, `execSync`, `writeFileSync`, `unlinkSync`, `existsSync`

### 6.1 Endpoint Catalogue

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 1 | POST | `/api/platinum/billing-enquiry/enquiry-results` | `BillingEnquiry/EnquiryResults` + `BillingEnquiry/Autocomplete` | SG/ERF multi-strategy search (see §6.2) |
| 2 | GET | `/api/platinum/billing-enquiry/get-app-setting` | `BillingEnquiry/GetAppSetting` | Simple proxy |
| 3 | GET | `/api/platinum/billing-enquiry/get-config-setting` | `BillingEnquiry/GetConfigSetting` | Simple proxy |
| 4 | GET | `/api/platinum/billing-enquiry/get-config-settings-batch` | `BillingEnquiry/GetConfigSetting` (multiple) | Batches multiple config keys in parallel |
| 5 | GET | `/api/platinum/receipt-info` | `BillingEnquiry/getReceiptInfo` | Simple proxy |
| 6 | GET | `/api/platinum/billing-enquiry/autocomplete` | `BillingEnquiry/Autocomplete` | Simple proxy |
| 7 | GET | `/api/platinum/billing-enquiry/rebuild-full-account` | `BillingEnquiry/RebuildFullAccount` | Simple proxy |
| 8 | GET | `/api/platinum/billing-enquiry/get-rebuild-account-ss-check` | `BillingEnquiry/GetReBuildAccountSSCheck` | Simple proxy |
| 9 | GET | `/api/platinum/billing-enquiry/:endpoint` | `BillingEnquiry/{endpoint}` | Dynamic wildcard proxy (see §6.3) |
| 10 | GET | `/api/platinum/billing-enquiry/:endpoint/:accountId` | `BillingEnquiry/{endpoint}` with `accountId` param | Dynamic wildcard with account ID |
| 11 | POST | `/api/platinum/billing-enquiry/send-statement` | `BillingEnquiry/SendStatement` | Email/WhatsApp/SMS statement delivery |
| 12 | POST | `/api/platinum/billing-enquiry/send-notification` | `BillingEnquiry/SendNotification` | Notification delivery |
| 13 | GET | `/api/platinum/billing-enquiry/communication-templates` | `BillingEnquiry/GetCommunicationTemplates` | Simple proxy |

### 6.2 enquiry-results — Multi-Strategy Search

The primary search endpoint handles 3 search modes:

**Mode 1: SG Number Search**
1. Extracts digit groups from SG number using regex `\d+`
2. Uses 3rd group (stripped leading zeros) as ERF search term
3. Calls `BillingEnquiry/Autocomplete` with `type: 'erfNumber'`
4. Filters for exact `displayItem === sgNumber` match
5. Fetches full account details via `BillingEnquiry/EnquiryResults` for matched IDs
6. Deduplicates results by account ID

**Mode 2: ERF Number Search**
If SG search returns nothing, tries direct `BillingEnquiry/EnquiryResults` with `erfNumber` field.

**Mode 3: Standard Field Search**
Cleans body (removes null/empty values), strips `sgNumber` and `erfNumber`, sends remaining fields to `BillingEnquiry/EnquiryResults`.

### 6.3 Dynamic Wildcard Proxy

The `:endpoint` route handles 30+ BillingEnquiry sub-endpoints through a single handler. The endpoint parameter maps directly to `BillingEnquiry/{endpoint}`.

The `:endpoint/:accountId` variant adds the accountId as a query parameter.

---

## 7. dayend.routes.ts — Day-End Reconciliation (Cashier + Supervisor)

**Registration**: `registerDayendRoutes(app, httpServer)`
**Imports**: `requireAuth`, `handlePlatinumResult`, `platinumGet`, `platinumPost`, `getSessionPosCashierId`

### 7.1 Endpoint Catalogue — Cashier Day-End (billing-payment-day-end-reconcile)

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 1 | GET | `/api/platinum/billing-payment-day-end/get-cashier-list` | `billing-payment-day-end-reconcile/get-cashier-list` | Simple proxy |
| 2 | GET | `/api/platinum/billing-payment-day-end/get-cashier-details` | `billing-payment-day-end-reconcile/get-cashier-details` | Simple proxy |
| 3 | POST | `/api/platinum/billing-payment-day-end/get-cashier-receipt-cheque-list` | `billing-payment-day-end-reconcile/get-cashier-receipt-cheque-list` | Body + query.id |
| 4 | POST | `/api/platinum/billing-payment-day-end/get-cashier-receipt-card-list` | `billing-payment-day-end-reconcile/get-cashier-receipt-card-list` | Body + query.id |
| 5 | POST | `/api/platinum/billing-payment-day-end/get-cashier-receipt-drop-box-list` | `billing-payment-day-end-reconcile/get-cashier-receipt-drop-box-list` | Body + query.id |
| 6 | GET | `/api/platinum/billing-payment-day-end/get-cashier-receipt-reconcile-list` | `billing-payment-day-end-reconcile/get-cashier-receipt-reconcile-list` | Multi-param fallback (see §7.2) |
| 7 | GET | `/api/platinum/billing-payment-day-end/cashier-receipt-unreconciled-list` | `billing-payment-day-end-reconcile/cashier-receipt-unreconciled-list` | Simple proxy |
| 8 | POST | `/api/platinum/billing-payment-day-end/save-reconcile-data` | `billing-payment-day-end-reconcile/save-reconcile-data` | Complex submission (see §7.3) |

### 7.2 reconcile-list Multi-Param Fallback

Tries 3 parameter variations in order:
1. `{ id: userId }` (from session.userData.user_ID)
2. `{ id: queryParams.id }` (from request query)
3. `{ cashierId: queryParams.id }` (different param name)

Returns first non-error response.

### 7.3 save-reconcile-data

Large endpoint that handles the cashier day-end reconciliation submission. Key behaviors:
- Uses `getSessionPosCashierId(session)` to resolve the correct cashier ID
- Logs denomination counts (coins + notes)
- Sets `session.dayEndPending = true` on successful submission
- Handles multiple response formats

### 7.4 Endpoint Catalogue — Supervisor Day-End (billing/auth-day-end-reconcile)

| # | Method | Local Route | Platinum Endpoint | Special Behavior |
|---|---|---|---|---|
| 9+ | GET | `/api/platinum/auth-day-end/cash-office-list` | `billing/auth-day-end-reconcile/cash-office-list` | Simple proxy |
| 10+ | GET | `/api/platinum/auth-day-end/cashier-list` | `billing/auth-day-end-reconcile/cashier-list` | Complex normalization (see §7.5) |
| ... | GET | `/api/platinum/auth-day-end/cashier-reconcile-by-cashierid` | `billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid` | Simple proxy |
| ... | GET | `/api/platinum/auth-day-end/pos-cashier` | `ReceiptPrepaid/cashier-list` | Alternate controller |
| ... | GET | `/api/platinum/auth-day-end/active-cashierid-by-userid` | `billing/auth-day-end-reconcile/active-cashierid-by-userid` | Simple proxy |
| ... | GET | `/api/platinum/auth-day-end/cashier-details` | `billing/auth-day-end-reconcile/cashier-details` | Simple proxy |
| ... | POST | `/api/platinum/auth-day-end/cashier-receipt-cash-list` | `billing/auth-day-end-reconcile/cashier-receipt-cash-list` | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/cashier-receipt-cheque-list` | Same pattern | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/cashier-receipt-card-list` | Same pattern | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/cashier-receipt-postal-order-list` | Same pattern | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/cashier-receipt-offline-data-list` | Same pattern | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/cashier-receipt-drop-box-list` | Same pattern | Body + query params |
| ... | GET | `/api/platinum/auth-day-end/cashbook-list` | `billing/auth-day-end-reconcile/cashbook-list` | Simple proxy |
| ... | POST | `/api/platinum/auth-day-end/system-vs-cashier-data-list` | `billing/auth-day-end-reconcile/system-vs-cashier-data-list` | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/finish-day-end-reconcile` | `billing/auth-day-end-reconcile/finish-day-end-reconcile` | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/return-day-end-reconcile` | `billing/auth-day-end-reconcile/return-day-end-reconcile` | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/validate-cashbook` | `billing/auth-day-end-reconcile/validate-cashbook` | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/submit-day-auth-reconcile` | `billing/auth-day-end-reconcile/submit-day-auth-reconcile` | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/cancel-receipt` | Same pattern | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/cancel-day-auth-reconcile-receipt` | Same pattern | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/request-cancel-receipt` | Same pattern | Body + query params |
| ... | POST | `/api/platinum/auth-day-end/approve-cancel-receipt` | Same pattern | Body + query params |

### 7.5 cashier-list Normalization

The supervisor cashier-list endpoint performs complex normalization:
- Merges data from `billing/auth-day-end-reconcile/cashier-list`
- Extracts multiple response shapes (array, `.data`, `.value`)
- Normalizes cashier names from multiple possible fields

**Total Endpoint Count for dayend.routes.ts**: 49 endpoints across cashier day-end and supervisor day-end reconciliation.

---

## 8. Cross-Cutting Patterns

### 8.1 Payment Deduplication (billing.routes.ts + clearance.routes.ts)

Both route files use the middleware deduplication system:
- `getPaymentDeduplicationKey(userId, body)` generates a hash
- `checkPaymentDedup(key)` checks if same key was submitted within `PAYMENT_DEDUP_WINDOW_MS`
- `recordPaymentSubmission(key, response)` caches successful responses
- Duplicates return the cached response (not an error)

### 8.2 Multi-Endpoint Fallback Pattern

Used across all 6 files when a single Platinum endpoint may fail:
- `get-banks`: 3 endpoints
- `const-institutions`: 4 endpoints
- `cash-offices`: 3 sources + probe
- `active-cashier-by-userid`: 4-tier fallback + reconcile check
- `get-cashiers`: 2 endpoints

### 8.3 Response Shape Normalization

All route files handle multiple Platinum response shapes:
- Direct array
- `{ data: array }`
- `{ value: array }`
- `{ items: array }`
- `{ paymentOptions: array }`
- `{ data: { paymentOptions: array } }`

### 8.4 Raw Fetch vs platinumPost

Two endpoints bypass `platinumPost` and use raw `fetch` with `AbortController`:
- `clearance/submit-payment` (35s timeout)
- These bypass the concurrency slot system from `platinum-auth.ts`

---

## 9. Platinum API Controller Mapping Summary

| Platinum Controller | Used By Route File(s) |
|---|---|
| `auth/createToken` | auth |
| `ReceiptPrepaid` | auth, pos |
| `billing-payment` | pos, billing |
| `billing-payment-clearance` | pos, clearance |
| `billing-payment-miscellaneous` | clearance |
| `billing-direct-deposit-allocation` | billing (cross-controller for group search) |
| `BillingEnquiry` | enquiries, billing (receipt view) |
| `ViewReceipt` | billing |
| `billing-payment-day-end-reconcile` | dayend (cashier), clearance (drop box list) |
| `billing/auth-day-end-reconcile` | dayend (supervisor), auth, pos |
| `UserPermission` | pos |
| `User` | pos |

---

*End of Phase 14 — Core Server Route Handlers*

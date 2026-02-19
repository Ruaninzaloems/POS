# Angular Migration Audit Report
## Generated: February 2026

---

## SUMMARY

| Category | Status | Lines | Angular Effort |
|----------|--------|-------|----------------|
| Types & Interfaces (45+ total) | READY - Copy/paste | ~400 | None |
| Pure Business Logic (6 functions) | READY - Copy/paste | 245 | None |
| API Service Layer (270+ functions) | READY - Wrap in @Injectable | 2,040 | Low (swap fetch→HttpClient) |
| POS State Management | NEEDS RESTRUCTURE | 1,976 | High (split into 4-5 services) |
| Backend (Express proxy) | STAYS AS-IS or port | 3,602 | N/A |
| PDF Generators | READY - Copy/paste | 745 | None |
| Inline fetch() calls (pages + components) | COMPLETED - All extracted | 0 remaining | Done |
| Mock data files | COMPLETED - Consolidated | Re-exports only | Done |
| Console logging | COMPLETED - Centralized apiLog() | Single swap point | Done |

### Migration Readiness Checklist (all pass)
- [x] Zero inline fetch() calls in pages or components
- [x] Zero localStorage / sessionStorage usage
- [x] Zero React hooks or imports in service layer files
- [x] All types consolidated in external-api.ts (no mock-data.ts dependency)
- [x] mock-data.ts and direct-deposits-data.ts reduced to re-export stubs
- [x] Centralized apiLog() utility replaces all console.log in service layer
- [x] Typed interfaces for common API patterns (AccountSearchCriteria, PaymentSubmission, etc.)
- [x] AbortSignal-aware variants for search functions (platinumSearchAccountsWithSignal, fetchEnquiryResultsWithSignal)
- [x] Raw Response variants for PDF handling (platinumPrintReceiptRaw)
- [x] Zero LSP errors across entire codebase

---

## WEB COMPONENT / CUSTOM ELEMENT INTEGRATION

The React app is wrapped as a Custom Element (`<pos-app>`) for embedding in Angular or any parent application.

### Files
| File | Purpose |
|------|---------|
| `client/src/web-component.tsx` | Custom Element class with Shadow DOM, style scoping via `adoptedStyleSheets` |
| `client/src/mount.ts` | `render(container, props)` function for Angular to manually mount |
| `vite.config.lib.ts` | Library build config producing `pos-app.es.js` (ES) and `pos-app.umd.js` (UMD) |

### Angular Usage
```typescript
// In Angular component
import { render } from './pos-app.es.js';

@Component({ template: '<div #posContainer></div>' })
export class PosHostComponent implements AfterViewInit, OnDestroy {
  @ViewChild('posContainer') container!: ElementRef;
  private handle: any;

  ngAfterViewInit() {
    this.handle = render(this.container.nativeElement, {
      apiBaseUrl: environment.apiBaseUrl
    });
  }

  ngOnDestroy() {
    this.handle?.destroy();
  }
}
```

### Style Scoping
- All CSS (Tailwind + custom) is inlined into the Shadow DOM via `adoptedStyleSheets`
- No styles leak to or from the parent Angular application
- CSS variables are scoped within the shadow root

### Build Command
```bash
npx vite build --config vite.config.lib.ts
```
Output: `dist/lib/pos-app.es.js` (~4MB) and `dist/lib/pos-app.umd.js` (~2.8MB)

### Local Database Status
- `server/storage.ts` and `server/db.ts` exist but are **dead code** — never imported or called
- Zero `storage.` references in `routes.ts` or any client file
- All data persistence goes through Platinum API exclusively

---

## SECTION 1: ANGULAR-READY (No changes needed)

### 1A. Pure TypeScript Types & Interfaces

These have ZERO React dependency. Copy straight into Angular `models/` folder.

**From `pos-state.tsx` (lines 13-161):**
- `TransactionType` (union type)
- `TransactionStatus` (union type)
- `DayEndStatus` (union type)
- `CashierProfile`
- `ReceiptAllocation`
- `ServiceBalance`
- `SplitReceipt`
- `TransactionRecord`
- `DayEndReport`
- `TransactionItem`

**From `external-api.ts`:**
- `PlatinumUserInfo`
- `Bank`
- `GroupCode`
- `Institution`
- `ApiCashier`
- `BillingConfig`
- `CashierPaymentOption`
- `CashierPaymentType`
- `ReceiptRangeValidation`
- `PosMultiReceiptPrintItem`
- `InstitutionSearchResult`
- `MiscPaymentGroup`
- `MiscPaymentScoaItem`
- `ViewReceiptCashier`
- `ReceiptSearchQuery`
- `ViewReceiptItem`
- `ReceiptListResponse`
- `MunicipalityInfo`

**From `enquiries-service.ts`:**
- `EnquirySearchCriteria`
- `EnquirySearchResult`

**From `pos-logic.ts`:**
- `PaymentState`
- `TransactionTotals`

### 1B. Pure Business Logic Functions

No React. No framework dependency. Direct copy into Angular utility/service files.

**`pos-logic.ts` (127 lines):**
- `calculateTransactionTotals()` — Rounding rules, change calculation
- `determineTransactionType()` — Auto-detect transaction type from cart items
- `createTransactionRecord()` — Build finalized transaction record with sorted items

**`allocation-logic.ts` (100 lines):**
- `validateAllocationAmount()` — Validates allocation amount doesn't exceed balance
- `calculateAllocationTotals()` — Calculates allocated/remaining with epsilon
- `mapSearchResultToAllocationTarget()` — Maps search result to allocation target

**`direct-deposits-logic.ts` (18 lines):**
- `filterUnmatchedTransactions()` — Filter/search unmatched bank transactions

### 1C. API Service Layer (Already Framework-Agnostic)

**`external-api.ts` (1,724 lines) — 158 exported functions**
All standalone `async` functions using `fetch()`. For Angular:
- Wrap in `@Injectable({ providedIn: 'root' })` class
- Replace `fetch()` with `HttpClient`
- Return `Observable` instead of `Promise` (or keep as Promise with `.toPromise()`)

Key function groups:
- Auth: `fetchPlatinumUserInfo`, `fetchCashOffices`, `fetchCashiers`
- Payment: `submitConsumerPayment`, `submitMiscPayment`, `submitPrepaidPayment`
- Receipt: `platinumPrintReceipt`, `fetchPosMultiReceiptPrint`, `fetchReceiptAllocations`
- Staging: `platinumSaveMultipleAccountPayment`, `platinumGetMultipleAccountPayment`
- Config: `fetchCashierPaymentOptions`, `fetchCashierPaymentTypes`, `fetchBillingConfig`
- Validation: `validateReceiptRange`, `mapTransactionTypeToPaymentOptionId`
- Clearance: `platinumSubmitClearancePayment`
- Account: `platinumGetConsAccountDetails`, `rebuildFullAccount`

**`enquiries-service.ts` (776 lines) — 102 exported functions**
All standalone `async` functions. Covers all 70+ BillingEnquiry endpoints:
- `searchAccounts`, `fetchAccountInfo`, `fetchAgingAnalysis`
- `fetchServiceDetails`, `fetchMeterReadings`, `fetchPropertyDetails`
- `fetchTransactionHistory`, `fetchStatementData`
- Plus all financial, service, and transaction enquiry functions

### 1D. PDF Generators

**`statement-pdf.ts` (240 lines)** — Pure TypeScript, generates statement PDFs
**`property-letters-pdf.ts` (505 lines)** — Pure TypeScript, generates property letters

---

## SECTION 2: NEEDS RESTRUCTURING FOR ANGULAR

### 2A. `pos-state.tsx` — The Main Challenge (1,994 lines)

This is a single React Context Provider that needs to be split into **4-5 Angular services**.

#### Current structure (all in one file):

**State Variables (41 React hooks):**
- 30+ `useState` declarations
- 6 `useEffect` hooks (initialization, polling, derived state)
- 3 `useRef` hooks
- 2 `useMemo` hooks

**Toast Notifications:** 20 `toast()` calls (replace with Angular notification service)

#### Recommended Angular Service Split:

**Service 1: `SessionService` (~300 lines)**
Responsible for:
- Cashier session detection (line 327-382: `checkActiveSession`)
- Session polling every 30s (line 706-752: `checkSessionViaApi` + interval)
- Session start/end (line 694-766: `startSession`, `endSession`)
- Session state: `activeSession`, `sessionDetails`, `platinumCashierId`, `cashierRegistered`, `apiSessionActive`

Inline fetch calls to extract:
- Line 331: `GET /api/platinum/auth/active-cashier-by-userid` → move to `external-api.ts`
- Line 713: `GET /api/platinum/receipt-prepaid/validate-cashier` → move to `external-api.ts`

**Service 2: `CartService` (~150 lines)**
Responsible for:
- Cart items state management
- `addItem()` (line 772-805) — includes payment option validation
- `removeItem()`, `updateItemAmount()`, `updateItemDetails()`
- `clearTransaction()`
- Payment amounts: cash, card, cardReference
- Derived calculations via `pos-logic.ts` functions

**Service 3: `PaymentService` (~1,000 lines) — THE BIG ONE**
Responsible for:
- `completeTransaction()` (lines 852-1855) — the entire payment orchestration
- Pre-payment session check
- Receipt range validation
- Account payment staging & submission (Priority 1)
- Clearance payment submission (Priority 1B)
- Direct income/misc payment submission (Priority 2)
- Prepaid recharge (Priority 3 & 4)
- Split payment logic (cash/card portion calculation)
- Receipt fetching and allocation calculation
- Post-payment account rebuild

Inline fetch calls to extract:
- Line 889: `GET /api/platinum/active-fin-year` → move to `external-api.ts`
- Line 1018: `GET /api/platinum/receipt-prepaid/validate-cashier` (duplicate) → reuse from SessionService
- Line 1098: `GET /api/platinum/billing-enquiry/total-balance-debt` → move to `external-api.ts`
- Line 1537: `GET /api/platinum/billing-enquiry/total-balance-debt` (duplicate) → reuse
- Line 1884: `POST /api/platinum/auth-day-end/cancel-receipt` → move to `external-api.ts`

**Service 4: `TransactionHistoryService` (~200 lines)**
Responsible for:
- `loadTransactionsFromApi()` (lines 384-564)
- Receipt list fetching and mapping
- Discovery scan fallback via `pos-multi-receipt-print/by-cashier`
- Transaction record mapping from API to local types

Inline fetch calls to extract:
- Line 475: `GET /api/proxy/pos-multi-receipt-print/by-cashier` → move to `external-api.ts`

**Service 5: `ReferenceDataService` (~100 lines)**
Responsible for:
- Loading banks, groups, institutions, settings, cash offices, cashiers, billing config on app init (lines 263-320)
- Storing reference data for dropdowns/lookups
- Already calls functions from `external-api.ts` (clean)

---

### 2B. Inline fetch() Calls Across Page Components (37 total)

These API calls are made directly inside React components instead of going through the service layer. For Angular, they should ALL go through injectable services.

**`client-communications.tsx` — 7 inline calls:**
| Line | Endpoint | Should Move To |
|------|----------|---------------|
| 175 | `POST /billing-payment/search-accounts` | Already in external-api.ts (reuse) |
| 193 | `GET /billing-account-management/get-contact-details` | New: `CommunicationsService` |
| 194 | `GET /billing-enquiry/name-info-by-account` | New: `CommunicationsService` |
| 227 | `GET /billing-account-management/get-contact-details` | Duplicate of 193 |
| 228 | `GET /billing-enquiry/name-info-by-account` | Duplicate of 194 |
| 229 | `GET /billing-account-management/get-additional-emails` | New: `CommunicationsService` |
| 332 | `POST /billing-payment/search-accounts` | Duplicate of 175 |

**`unmatched-queue.tsx` — 5 inline calls:**
| Line | Endpoint | Should Move To |
|------|----------|---------------|
| 157, 190, 225, 262 | `POST /billing-payment/search-accounts` | Already in external-api.ts (reuse) |
| 383 | `GET /active-fin-year` | Move to `external-api.ts` |

**`allocate-transaction.tsx` — 4 inline calls:**
| Line | Endpoint | Should Move To |
|------|----------|---------------|
| 124, 132 | `POST /billing-payment/search-accounts` | Already in external-api.ts (reuse) |
| 442 | `GET /active-fin-year` | Move to `external-api.ts` |
| 452 | `GET /auth/user-info` | Already in external-api.ts (reuse) |

**`supervisor-dashboard.tsx` — 3 inline calls:**
| Line | Endpoint | Should Move To |
|------|----------|---------------|
| 223 | `GET /auth-day-end/cashier-list` | New: `SupervisorService` |
| 288 | `GET /auth-day-end/cashier-details` | New: `SupervisorService` |
| 289 | `GET /auth-day-end/cashier-reconcile-by-cashierid` | New: `SupervisorService` |

**`cashier-setup.tsx` — 3 inline calls:**
| Line | Endpoint | Should Move To |
|------|----------|---------------|
| 82 | `GET /auth/active-cashier-by-userid` | Move to `external-api.ts` |
| 113 | `GET /auth/user-info` | Already in external-api.ts (reuse) |
| 282 | `POST /receipt-prepaid/submit-cashier-setup` | Move to `external-api.ts` |

**`other-tabs.tsx` — 3 inline calls:**
| Line | Endpoint | Should Move To |
|------|----------|---------------|
| 828 | `POST /billing-enquiry/generate-statement` | Move to `enquiries-service.ts` |
| 1274 | `GET /billing-enquiry/property-details-by-account` | Already in enquiries-service.ts |
| 1275 | `GET /billing-enquiry/name-info-by-account` | Already in enquiries-service.ts |

**`view-receipts.tsx` — 1 inline call:**
| Line | Endpoint | Should Move To |
|------|----------|---------------|
| 210 | `POST /billing-payment/print-receipt` | Already in external-api.ts |

**`account-tabs.tsx` — 1 inline call:**
| Line | Endpoint | Should Move To |
|------|----------|---------------|
| 836 | `POST /billing-enquiry/enquiry-results` | Move to `enquiries-service.ts` |

**`transaction-tabs.tsx` — 1 inline call:**
| Line | Endpoint | Should Move To |
|------|----------|---------------|
| 633 | `GET /pos-multi-receipt-print` | Already in external-api.ts |

**`login.tsx` — 1 inline call:**
| Line | Endpoint | Should Move To |
|------|----------|---------------|
| 30 | `POST /auth/login` | New: `AuthService` (Angular) |

---

## SECTION 3: BACKEND (Express)

### `server/routes.ts` (3,047 lines)
The Express backend acts as a proxy to Platinum API and Sebata Billing API. This is framework-agnostic and can either:
- Stay as a Node.js/Express backend behind Angular
- Be ported to NestJS if preferred

### `server/platinum-auth.ts` (555 lines)
JWT token management for Platinum API. Pure Node.js, no frontend dependency.

---

## SECTION 4: ANGULAR SERVICE MAPPING (Recommended Structure)

```
angular-app/
├── models/
│   ├── transaction.model.ts      ← Types from pos-state.tsx
│   ├── cashier.model.ts          ← CashierProfile, SessionDetails
│   ├── payment.model.ts          ← PaymentState, TransactionTotals
│   ├── receipt.model.ts          ← SplitReceipt, ReceiptAllocation
│   ├── enquiry.model.ts          ← EnquirySearchCriteria, EnquirySearchResult
│   └── api.model.ts              ← PlatinumUserInfo, Bank, GroupCode, etc.
│
├── services/
│   ├── platinum-api.service.ts   ← external-api.ts (158 functions → HttpClient)
│   ├── enquiry-api.service.ts    ← enquiries-service.ts (102 functions → HttpClient)
│   ├── session.service.ts        ← Session management from pos-state.tsx
│   ├── cart.service.ts           ← Cart/item management from pos-state.tsx
│   ├── payment.service.ts        ← completeTransaction() orchestration
│   ├── transaction-history.service.ts ← Receipt list loading/mapping
│   ├── reference-data.service.ts ← Banks, groups, offices init loading
│   ├── communications.service.ts ← Contact details, search, bulk import
│   ├── supervisor.service.ts     ← Day-end, cashier list, reconciliation
│   └── auth.service.ts           ← Login, user info
│
├── utils/
│   ├── pos-logic.ts              ← Direct copy (calculateTotals, etc.)
│   ├── allocation-logic.ts       ← Direct copy (validateAmount, etc.)
│   └── pdf-generators/
│       ├── statement-pdf.ts      ← Direct copy
│       └── property-letters-pdf.ts ← Direct copy
```

---

## SECTION 5: CRITICAL BUSINESS LOGIC TO PRESERVE

These rules are embedded in the code and MUST be preserved in Angular:

1. **Rounding**: Cash-only → round UP to nearest 10c. Card involved → round to nearest cent. (pos-logic.ts line 26-28)
2. **Change**: Only on cash portion: `max(0, cash - (total - card))` (pos-logic.ts line 31)
3. **Split Payments**: Two separate API submission rounds — one for cash (paymentType=1), one for card (paymentType=3). Each creates separate DB entries and receipts. (pos-state.tsx lines 1422-1477)
4. **Pre-Payment Session Check**: ALWAYS call `validate-cashier` before payment processing. BLOCK if session inactive. (pos-state.tsx lines 1016-1058)
5. **Receipt Range Validation**: Validate via `validate-receipt-range` before any payment. (pos-state.tsx lines 886-910)
6. **Payment Option Enforcement**: Per-cashier, from office-level config. Block if option not enabled. (pos-state.tsx lines 618-648, 772-782)
7. **Receipt Allocation**: Pre-payment balance snapshot → submit payment → post-payment balance → diff = allocation per service. (pos-state.tsx lines 1075-1588)
8. **Account Rebuild**: After payment, call `rebuildFullAccount()` for each account. (pos-state.tsx lines 1505-1510)
9. **Receipt Sequence**: save-multiple → submit-consumer-payment (per account) → print-receipt → pos-multi-receipt-print. (pos-state.tsx lines 1300-1490)
10. **Session Polling**: Check `validate-cashier` every 30 seconds while session active. End session if isActive becomes false. (pos-state.tsx lines 745-752)

---

## SECTION 6: WHAT CAN BE DELETED IN ANGULAR

- `pos-state.tsx` — Entire file (replaced by 4-5 Angular services)
- `queryClient.ts` — React Query specific (Angular uses HttpClient + RxJS)
- `mock-data.ts` — Only used for type imports now (move types to models/)
- All React-specific hooks (`usePos`, `useToast`, etc.)
- `@tanstack/react-query` dependency
- `@tanstack/react-virtual` dependency (replace with Angular CDK virtual scroll)
- `wouter` routing (replace with Angular Router)
- `shadcn/ui` components (replace with Angular Material or PrimeNG)

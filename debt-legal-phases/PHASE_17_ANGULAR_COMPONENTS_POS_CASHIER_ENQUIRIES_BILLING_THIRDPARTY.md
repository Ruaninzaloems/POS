# PHASE 17 — Angular Components: POS, Cashier, Enquiries, Billing & Third-Party

**Document**: `PHASE_17_ANGULAR_COMPONENTS_POS_CASHIER_ENQUIRIES_BILLING_THIRDPARTY.md`
**Created**: 2026-03-11
**Scope**: All Angular 19 standalone components in `features/pos/`, `features/cashier/`, `features/enquiries/`, `features/billing/`, `features/bulk-allocation/`, `features/third-party/`, and `features/supervisor/`

---

## 1. COMPONENT INVENTORY

| # | Component | Path | Lines | API Endpoints Used | Key Models / Types |
|---|-----------|------|-------|--------------------|--------------------|
| 1 | PosWorkflowComponent | `pos/pos-workflow.component.ts` | 162 | 2 | WorkflowTab |
| 2 | PosComponent | `pos/pos.component.ts` | 2039 | 25 | BasketItem, BasketItemType, TenderType, UnifiedSearchResult, ScoaItem, CsvImportRow, CsvValidatedRow, ReceiptDeliveryMode |
| 3 | CashierSetupComponent | `cashier/cashier-setup.component.ts` | 459 | 6 | SetupStep |
| 4 | CashierDayEndComponent | `cashier/cashier-day-end.component.ts` | 676 | 11 | DenominationRow |
| 5 | EnquiriesGeneralComponent | `enquiries/enquiries-general.component.ts` | 5949 | 40+ | SearchCriteria, SearchResult, SearchField, TabItem, TabGroup, RiskFlag |
| 6 | SupervisorDashboardComponent | `supervisor/supervisor-dashboard.component.ts` | ~550 | 33 | SupervisorTab |
| 7 | ViewReceiptsComponent | `receipts/view-receipts.component.ts` | ~350 | 11 | — |
| 8 | BillingDashboardComponent | `billing/billing-dashboard.component.ts` | ~420 | 15 | — |
| 9 | PaymentProcessingComponent | `third-party/payment-processing.component.ts` | ~780 | 14 | ThirdPartyTab, GenericImportStep |
| 10 | BulkAllocationProgressComponent | `bulk-allocation/bulk-allocation-progress.component.ts` | ~320 | 7 | StatusCategory |

**Total**: 10 components, ~11,705 source lines, ~164 unique API endpoint calls

---

## 2. SHARED SERVICE DEPENDENCIES

### 2.1 Core Services

| Service | Import Path | Used By |
|---------|-------------|---------|
| `ApiService` | `core/services/api.service.ts` | All 10 components |
| `AuthService` | `core/services/auth.service.ts` | All 10 components |
| `ToastService` | `core/services/toast.service.ts` | All 10 components |
| `ExportService` | `services/export.service.ts` | EnquiriesGeneral |
| `PosBasketService` | `services/pos-basket.service.ts` | PosComponent |

### 2.2 PosBasketService (Signal-Based State)

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `items` | `WritableSignal<BasketItem[]>` | Full basket contents |
| `hasItems()` | `computed<boolean>` | Whether basket is non-empty |
| `totalToPay()` | `computed<number>` | Sum of all `amountToPay` |
| `totalDue()` | `computed<number>` | Sum of all `amountDue` |
| `itemsByType()` | `computed<Record<BasketItemType, BasketItem[]>>` | Grouped by type |
| `addItem(item)` | `void` | Add item to basket |
| `removeItem(id)` | `void` | Remove by UUID |
| `clearAll()` | `void` | Empty basket |
| `roundToNearest10c(n)` | `number` | SA cash rounding |

### 2.3 Model Files

| File | Key Interfaces |
|------|---------------|
| `models/pos-basket.models.ts` | `BasketItem`, `BasketItemType` (`account`/`clearance`/`prepaid`/`misc`), `AccountData`, `ClearanceData`, `PrepaidData`, `MiscData`, `ScoaItem`, `PROCESSING_ORDER`, `UnifiedSearchResult`, `CsvImportRow`, `CsvValidatedRow` |

---

## 3. COMPONENT DETAILS

---

### 3.1 PosWorkflowComponent (162 lines)

**Purpose**: Tabbed wrapper at `/pos` embedding 3 child components: CashierSetup → PosTransact → CashierDayEnd. Auto-detects existing sessions on init.

**Type**: `WorkflowTab = 'setup' | 'transact' | 'day-end'`

#### Signals

| Signal | Type | Default |
|--------|------|---------|
| `activeTab` | `WritableSignal<WorkflowTab>` | `'setup'` |
| `sessionReady` | `WritableSignal<boolean>` | `false` |
| `checkingSession` | `WritableSignal<boolean>` | `true` |
| `sessionActive` | `WritableSignal<boolean>` | `false` |
| `needsReconcile` | `WritableSignal<boolean>` | `false` |
| `reconcileMessage` | `WritableSignal<string>` | `''` |
| `sessionStatusMessage` | `WritableSignal<string>` | `''` |

#### Computed Guards

| Computed | Logic |
|----------|-------|
| `canAccessSetup` | `!sessionActive && !needsReconcile` |
| `canAccessTransact` | `sessionReady && !needsReconcile` |
| `canAccessDayEnd` | `sessionReady \|\| needsReconcile` |

#### API Endpoints

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/api/platinum/auth/active-cashier-by-userid?userid={}&finYear={}` | Check if user has active cashier session |
| 2 | GET | `/api/platinum/receipt-prepaid/validate-cashier-day-end-recon?cashierId={}&finYear={}` | Check if prior day-end reconciliation is needed |

#### Session Detection Flow

```
ngOnInit → checkExistingSession()
  1. GET active-cashier-by-userid
  2. If hasDayEndReturned → tab='transact'
  3. If hasPendingDayEnd → tab='transact', status msg
  4. If isActive + officeId:
     a. GET validate-cashier-day-end-recon
     b. If response includes "reconcile" → tab='day-end', needsReconcile=true
     c. If reconCheck fails → tab='day-end', needsReconcile=true (safe fallback)
     d. Otherwise → tab='transact'
  5. CashierSetup emits (sessionStarted) → tab='transact'
```

#### Child Component Communication

| Child | Input | Output |
|-------|-------|--------|
| `CashierSetupComponent` | `[embedded]="true"` | `(sessionStarted)` → `onSessionStarted()` |
| `PosComponent` | — | — |
| `CashierDayEndComponent` | — | — |

---

### 3.2 PosComponent (2039 lines)

**Purpose**: Main POS receipting screen — unified search, multi-type basket, split tender, payment processing, CSV import, receipt delivery, drop box, receipt cancellation.

#### Type Definitions (from pos-basket.models.ts)

```typescript
type BasketItemType = 'account' | 'clearance' | 'prepaid' | 'misc';
type TenderType = 'cash' | 'card' | 'cheque' | 'eft';
type ReceiptDeliveryMode = 'print' | 'email' | 'whatsapp' | 'sms';

const PROCESSING_ORDER: Record<BasketItemType, number> = {
  account: 1, clearance: 2, prepaid: 3, misc: 4
};

interface BasketItem {
  id: string;                    // crypto.randomUUID()
  type: BasketItemType;
  label: string;
  description: string;
  amountDue: number;
  amountToPay: number;
  accountData?: AccountData;
  clearanceData?: ClearanceData;
  prepaidData?: PrepaidData;
  miscData?: MiscData;
}

interface ScoaItem {
  scoaItemId: number;
  scoaItemName: string;
  description: string;
  amount: number;
  isVatable: boolean;
  vatPercentage: number;
}

interface CsvImportRow {
  accountNo: string; amount: number; receiptDate: string; raw: string;
}

interface CsvValidatedRow {
  accountNo: string; amount: number; receiptDate: string;
  status: 'pending' | 'validating' | 'found' | 'not_found' | 'duplicate' | 'error';
  accountId: number; name: string; outstandingAmount: number;
  address: string; errorMsg: string; rawApiData: any;
}
```

#### Signals — Session & Config

| Signal | Type | Default |
|--------|------|---------|
| `sessionActive` | `WritableSignal<boolean>` | `false` |
| `cashierInfo` | `WritableSignal<any>` | `null` |
| `paymentTypes` | `WritableSignal<any[]>` | `[]` |
| `paymentOptions` | `WritableSignal<any[]>` | `[]` |
| `banks` | `WritableSignal<any[]>` | `[]` |

#### Signals — Search (Unified)

| Signal | Type | Default |
|--------|------|---------|
| `unifiedSearchQuery` | `WritableSignal<string>` | `''` |
| `unifiedSearchResults` | `WritableSignal<UnifiedSearchResult[]>` | `[]` |
| `unifiedSearchLoading` | `WritableSignal<boolean>` | `false` |
| `unifiedSearchActive` | `WritableSignal<boolean>` | `false` |
| `expandedGroupId` | `WritableSignal<string \| null>` | `null` |
| `groupAccountsLoading` | `WritableSignal<boolean>` | `false` |
| `accountDetailLoading` | `WritableSignal<boolean>` | `false` |

#### Signals — Search (Tab-Specific)

| Signal | Type | Default |
|--------|------|---------|
| `tabSearchQuery` | `WritableSignal<string>` | `''` |
| `tabSearchResults` | `WritableSignal<any[]>` | `[]` |
| `tabSearchLoading` | `WritableSignal<boolean>` | `false` |
| `tabSearchActive` | `WritableSignal<boolean>` | `false` |

#### Signals — Payment Panel

| Signal | Type | Default |
|--------|------|---------|
| `showPaymentPanel` | `WritableSignal<boolean>` | `false` |
| `activeTender` | `WritableSignal<TenderType>` | `'cash'` |
| `cashAmount` | `WritableSignal<number>` | `0` |
| `cardAmount` | `WritableSignal<number>` | `0` |
| `cardNumber` | `WritableSignal<string>` | `''` |
| `cardExpiry` | `WritableSignal<string>` | `''` |
| `cardReference` | `WritableSignal<string>` | `''` |
| `chequeAmount` | `WritableSignal<number>` | `0` |
| `chequeNumber` | `WritableSignal<string>` | `''` |
| `chequeBankId` | `WritableSignal<number>` | `0` |
| `chequeName` | `WritableSignal<string>` | `''` |
| `eftAmount` | `WritableSignal<number>` | `0` |
| `eftReference` | `WritableSignal<string>` | `''` |

#### Signals — Receipt & Dialogs

| Signal | Type | Default |
|--------|------|---------|
| `lastReceiptData` | `WritableSignal<any>` | `null` |
| `showReceiptDialog` | `WritableSignal<boolean>` | `false` |
| `receiptDeliveryMode` | `WritableSignal<ReceiptDeliveryMode>` | `'print'` |
| `receiptEmail` | `WritableSignal<string>` | `''` |
| `receiptPhone` | `WritableSignal<string>` | `''` |
| `sendingReceipt` | `WritableSignal<boolean>` | `false` |
| `showCancelDialog` | `WritableSignal<boolean>` | `false` |
| `cancelReceiptNo` | `WritableSignal<string>` | `''` |
| `cancelReason` | `WritableSignal<string>` | `''` |
| `cancellingReceipt` | `WritableSignal<boolean>` | `false` |
| `showDropBoxDialog` | `WritableSignal<boolean>` | `false` |
| `dropBoxAmount` | `WritableSignal<number>` | `0` |
| `dropBoxReference` | `WritableSignal<string>` | `''` |
| `submittingDropBox` | `WritableSignal<boolean>` | `false` |

#### Signals — CSV Import

| Signal | Type | Default |
|--------|------|---------|
| `csvImportOpen` | `WritableSignal<boolean>` | `false` |
| `csvStep` | `WritableSignal<'upload' \| 'preview' \| 'validate' \| 'done'>` | `'upload'` |
| `csvFileName` | `WritableSignal<string>` | `''` |
| `csvParsedRows` | `WritableSignal<CsvImportRow[]>` | `[]` |
| `csvValidatedRows` | `WritableSignal<CsvValidatedRow[]>` | `[]` |
| `csvValidating` | `WritableSignal<boolean>` | `false` |
| `csvValidationProgress` | `WritableSignal<number>` | `0` |
| `csvCancelled` | `WritableSignal<boolean>` | `false` |
| `csvPage` | `WritableSignal<number>` | `1` |
| `csvPageSize` | `number` (readonly) | `20` |

#### Computed Signals

| Computed | Logic |
|----------|-------|
| `canTenderCash()` | `paymentOptions` includes type matching `'cash'` |
| `canTenderCard()` | `paymentOptions` includes type matching `'card'` |
| `canTenderCheque()` | `paymentOptions` includes type matching `'cheque'` |
| `canTenderEft()` | `paymentOptions` includes type matching `'eft'` |
| `isSplitTender()` | More than one tender amount > 0 |
| `totalTendered()` | `cashAmount + cardAmount + chequeAmount + eftAmount` |
| `changeAmount()` | `totalTendered - basket.totalToPay()` (≥0) |
| `tenderShortfall()` | `basket.totalToPay() - totalTendered` (≥0) |
| `canSubmit()` | Session active, basket has items, totalTendered ≥ totalToPay |

#### API Endpoints (25 unique)

| # | Method | Endpoint (exact from source) | Purpose | Called By |
|---|--------|------------------------------|---------|----------|
| 1 | GET | `/api/platinum/auth/active-cashier-by-userid` | Load session info on init | `ngOnInit` |
| 2 | GET | `/api/platinum/receipt-prepaid/validate-cashier-day-end-recon` | Check recon needed | `ngOnInit` |
| 3 | GET | `/api/platinum/receipt-prepaid/cashier-payment-options` | Payment options dropdown | `loadPaymentConfig()` |
| 4 | GET | `/api/platinum/receipt-prepaid/cashier-payment-types` | Payment types dropdown | `loadPaymentConfig()` |
| 5 | GET | `/api/platinum/billing-payment-clearance/get-banks` | Banks for cheque tender | `loadPaymentConfig()` |
| 6 | POST | `/api/platinum/billing-payment/search-accounts` | Tab-specific search + unified accounts + CSV validation | `tabSearch()`, `performUnifiedSearch()`, `csvValidateAccounts()` |
| 7 | POST | `/api/platinum/billing-payment/search-account-groups` | Unified search — groups/institutions | `performUnifiedSearch()` |
| 8 | GET | `/api/platinum/billing-payment-miscellaneous/get-groups` | Unified search — misc groups + misc tab listing | `performUnifiedSearch()`, misc tab |
| 9 | GET | `/api/platinum/receipt-prepaid/cons-account-details` | Full account detail enrichment | `addAccountToBasket()`, CSV validation |
| 10 | POST | `/api/platinum/billing-payment/get-group-accounts` | Expand group → list accounts | `loadGroupAccounts()` |
| 11 | GET | `/api/platinum/billing-payment-miscellaneous/get-scoa-items` | SCOA items for misc group | `addMiscToBasket()`, misc SCOA load |
| 12 | POST | `/api/platinum/billing-payment-clearance/get-clearance-data` | Clearance certificate data | clearance flow |
| 13 | POST | `/api/platinum/billing-payment-clearance/get-accounts-for-clearance` | Accounts linked to clearance | clearance flow |
| 14 | POST | `/api/platinum/receipt-prepaid/utilipay-breakdown-request` | Prepaid token cost breakdown | `getPrepaidBreakdown()` |
| 15 | GET | `/api/platinum/receipt-prepaid/service-type-wise-prepaid-list` | Prepaid service types | prepaid tab |
| 16 | POST | `/api/platinum/billing-payment/submit-consumer-payment/{userId}` | Single account payment | `submitConsumerPayment()` |
| 17 | POST | `/api/platinum/billing-payment/submit-multiple-payment/{userId}` | Multiple account payment | `submitMultiplePayment()` |
| 18 | POST | `/api/platinum/billing-payment-clearance/submit-payment` | Clearance payment | `submitClearancePayment()` |
| 19 | POST | `/api/platinum/receipt-prepaid/utilipay-token-request` | Prepaid vending (token purchase) | `submitPrepaidPayment()` |
| 20 | POST | `/api/platinum/billing-payment-miscellaneous/submit` | Misc payment | `submitMiscPayment()` |
| 21 | POST | `/api/platinum/billing-payment/print-receipt` | Print receipt | `sendReceipt()` |
| 22 | POST | `/api/platinum/billing-payment/send-receipt` | Email/SMS/WhatsApp receipt | `sendReceipt()` |
| 23 | POST | `/api/platinum/auth-day-end/request-cancel-receipt` | Receipt cancellation request | `submitCancellation()` |
| 24 | POST | `/api/platinum/drop-box/submit` | Cash drop box | `submitDropBox()` |

#### Payment Type ID Resolution

```
getPaymentTypeId(tenderType) → number
  Scans paymentTypes() array by posPaymentTypeDesc:
  - 'cash'   → posPaymentType_ID matching "cash"   (fallback: 1)
  - 'cheque' → posPaymentType_ID matching "cheque"  (fallback: 2)
  - 'card'   → posPaymentType_ID matching "card"    (fallback: 3)
  - 'eft'    → posPaymentType_ID matching "eft"     (fallback: 5)
```

#### Split Tender Logic

```
allocateSplitTender():
  1. Sort basket items by PROCESSING_ORDER (account→clearance→prepaid→misc)
  2. If isSplitTender:
     a. Cash portion → first N items up to cashAmount
     b. Card portion → next items up to cardAmount
     c. Remaining → cheque/eft
  3. Each portion creates separate API receipt call
  4. Smart item allocation: items fully covered by one tender go in that batch
```

#### CSV Import Pipeline

```
openCsvImport() → Step 'upload'
  ↓
onCsvFileSelected(event) → parseCsvContent(text)
  - Auto-detect delimiter: comma, semicolon, tab
  - Auto-detect header row (matches account*/amount* patterns)
  - Parse columns: accColIdx, amtColIdx, dateColIdx
  → Step 'preview' (paginated 20/page)
  ↓
csvValidateAccounts()
  - Pre-filter: basket duplicates, intra-file duplicates
  - Batch 5 at a time:
    1. POST billing-payment/search-accounts { accountNo }
    2. GET receipt-prepaid/cons-account-details { accountId }
    3. Merge → status: found/not_found/error/duplicate
  - Progress bar: csvValidationProgress (0-100%)
  - Cancellable: csvCancelled flag
  → Step 'done'
  ↓
csvAddToBasket()
  - Only rows with status='found'
  - Pre-fills amountToPay from CSV amount column
  - De-duplicates against current basket
```

#### Utility Methods

| Method | Purpose |
|--------|---------|
| `formatCurrency(n)` | `toLocaleString('en-ZA', {min:2, max:2})` |
| `formatDate(val)` | `dd/mm/yyyy` via padStart |
| `getReceiptNo(data)` | Resolves: receiptNumber / receipt_no / receiptNo / ReceiptNo |
| `getAccountNo(r)` | Resolves: accountNo / accountNumber / account_no |
| `getAccountName(r)` | Resolves: name / accountName / consumerName / surname_Company |
| `getAccountBalance(r)` | Resolves: outstandingAmount / outStandingAmt / balance / totalDue |
| `getTypeColor(type)` | account=#2563eb, clearance=#16a34a, prepaid=#d97706, misc=#7c3aed |
| `addDenomination(value)` | Adds coin/note value to cashAmount (rounded 2dp) |
| `formatCardNumber(val)` | Groups digits in 4s: `1234 5678 ...` |
| `formatExpiry(val)` | Formats as `MM/YY` |

---

### 3.3 CashierSetupComponent (459 lines)

**Purpose**: 3-step cashier session registration: Office Selection → Float Declaration → Session Start. Supports embedded mode (emits event) or standalone mode (navigates).

#### Inputs / Outputs

| Decorator | Name | Type | Default |
|-----------|------|------|---------|
| `@Input()` | `embedded` | `boolean` | `false` |
| `@Output()` | `sessionStarted` | `EventEmitter<void>` | — |

#### API Endpoints (6 unique)

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 1 | GET | `/api/platinum/auth/active-cashier-by-userid` | Check existing session |
| 2 | GET | `/api/platinum/receipt-prepaid/cash-offices` | Load office list (param: `finYear`) |
| 3 | GET | `/api/platinum/receipt-prepaid/cashier-payment-options` | Validate session config |
| 4 | GET | `/api/platinum/receipt-prepaid/cashier-payment-types` | Validate session config |
| 5 | GET | `/api/platinum/receipt-prepaid/validate-receipt-range` | Validate receipt number range |
| 6 | POST | `/api/platinum/receipt-prepaid/submit-cashier-setup` | Open new session / reclaim existing |

#### Session Reclaim Logic

```
startSession():
  1. POST submit-cashier-setup { userId, officeId, finYear, ... }
  2. If error includes "cashier already open" or "already active":
     a. GET active-cashier-by-userid
     b. Extract cashierId from response
     c. POST submit-cashier-setup { ..., cashierId }  ← reclaim
  3. On success:
     - If embedded=true → sessionStarted.emit()
     - If embedded=false → router.navigate(['/pos'])
```

---

### 3.4 CashierDayEndComponent (676 lines)

**Purpose**: Day-end reconciliation with 3 sections: Cash Takings, Cancellation Summary, Drop Box Summary. Denomination counting for cash, then save → validate → submit chain.

#### Denomination Keys

| Category | Keys | Values (ZAR) |
|----------|------|--------------|
| Notes | `n200, n100, n50, n20, n10` | 200, 100, 50, 20, 10 |
| Coins | `co5, co2, co1, c50, c20, c10, c5, c1` | 5.00, 2.00, 1.00, 0.50, 0.20, 0.10, 0.05, 0.01 |

#### Signals

| Signal | Type | Default |
|--------|------|---------|
| `loading` | `WritableSignal<boolean>` | `true` |
| `submitting` | `WritableSignal<boolean>` | `false` |
| `cashierInfo` | `WritableSignal<any>` | `null` |
| `takingsData` | `WritableSignal<any>` | `null` |
| `cancellationData` | `WritableSignal<any[]>` | `[]` |
| `dropBoxData` | `WritableSignal<any[]>` | `[]` |
| `denominations` | `WritableSignal<Record<string, number>>` | all keys → 0 |
| `enableDenominationCounting` | `WritableSignal<boolean>` | `true` |
| `totalCashAmt` | `WritableSignal<number>` | `0` |
| `activeSection` | `WritableSignal<'takings' \| 'cancellation' \| 'dropbox'>` | `'takings'` |
| `showConfirmDialog` | `WritableSignal<boolean>` | `false` |
| `reconResult` | `WritableSignal<any>` | `null` |
| `errorMessage` | `WritableSignal<string>` | `''` |

#### Computed Signals

| Computed | Logic |
|----------|-------|
| `denominationTotal` | Sum of (denomination[key] × value) for all 13 denomination keys |
| `cashOnHand` | If `enableDenominationCounting` → `denominationTotal`, else → `totalCashAmt` |
| `variance` | `cashOnHand - (takingsData.cashTotal \|\| 0)` |

#### API Endpoints (11 unique)

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 1 | GET | `/api/platinum/auth/active-cashier-by-userid` | Get active cashier session |
| 2 | GET | `/api/platinum/billing-payment-day-end/get-cashier-details` | Load cashier detail (param: `id`) |
| 3 | POST | `/api/platinum/billing-payment-day-end/get-cashier-receipt-cheque-list?id={cashierId}` | Cheque receipt list |
| 4 | POST | `/api/platinum/billing-payment-day-end/get-cashier-receipt-card-list?id={cashierId}` | Card receipt list |
| 5 | POST | `/api/platinum/billing-payment-day-end/get-cashier-receipt-drop-box-list?id={cashierId}` | Drop box receipt list |
| 6 | GET | `/api/platinum/billing-payment-day-end/get-cashier-receipt-reconcile-list` | Reconcile receipt list (params: `userId`, `id`) |
| 7 | POST | `/api/platinum/billing-payment-day-end/save-reconcile-data?userId={userId}` | Save denomination/cash data |
| 8 | POST | `/api/platinum/auth-day-end/validate-cashbook` | Validate cashbook totals |
| 9 | GET | `/api/platinum/auth-day-end/cashbook-list` | Get cashbook list |
| 10 | POST | `/api/platinum/auth-day-end/submit-day-auth-reconcile?cashierId={cashierId}` | Final day-end submission |
| 11 | POST | `/api/platinum/auth-day-end/request-cancel-receipt` | Request receipt cancellation |

#### Reconciliation Submission Chain

```
handleSaveReconcile():
  1. POST billing-payment-day-end/save-reconcile-data?userId={} {
       cashierId, finYear,
       cashOnHand: denominationTotal OR totalCashAmt,
       denominations: { n200, n100, ..., c1 },
       enableDenominationCounting
     }
  2. POST auth-day-end/validate-cashbook { cashierId }
  3. GET auth-day-end/cashbook-list
  4. POST auth-day-end/submit-day-auth-reconcile?cashierId={} {
       cashOnHand, variance, reconcile data
     }
  5. On success → toast + navigate to /pos or emit completion
```

---

### 3.5 EnquiriesGeneralComponent (5949 lines)

**Purpose**: Comprehensive account enquiry with quick/advanced search, 30+ detail tabs, consumption intelligence, financial summaries, Excel/CSV/PDF export on every tab, risk flags, occupier management, Section 49/78 letters, proof of residence, and communication compose.

#### Interfaces

```typescript
interface SearchCriteria {
  accountNo?: string; oldAccountCode?: string; name?: string;
  idNo?: string; passportNumber?: string; locationAddress?: string;
  mobileNumber?: string; physicalMeterNumber?: string;
  emailAddress?: string; sgNumber?: string; erfNumber?: string;
}

interface SearchResult {
  account_ID: number; accountID: number; accountNumber: string;
  oldAccountCode: string; name: string; surname_Company: string;
  initials: string; idRegistrationNumber: string;
  deliveryAddress: string; locationAddress: string; address: string;
  statusDesc: string; accountStatus: string; accountDesc: string;
  accountType: string; outStandingAmt: number; outStandingAmount: number;
  addName: string; contactDetails: string; unitID: number;
  unitPartitionID: number; sgNumber: string; propertyID: string;
}

interface RiskFlag {
  id: string; label: string; detail: string;
  severity: 'critical' | 'warning' | 'info'; icon: string;
}
```

#### Tab Groups (30 tabs in 6 groups)

| Group | Tabs |
|-------|------|
| **Account** | Account, Name, Property, Linked Accounts, Contact |
| **Financial** | Handover, Services, Meters, Consumption, Balance/Debt |
| **Transactions** | Property Debt, Transaction Detail, Transaction Summary, Receipts, Deposits |
| **Billing** | Payment Plans, Extensions, Billed vs Paid, Next Bill Estimate, Rates |
| **Documents** | Debit Orders, Statements, Clearance, Debtor Notes, Section 129 |
| **Other** | Occupiers, Notifications, Incentives, Indigent Subsidy, Related Accounts |

#### Signals — Core (key ones from 75+ total writable signals)

| Signal | Type | Purpose |
|--------|------|---------|
| `quickQuery` | `WritableSignal<string>` | Quick search input |
| `criteria` | `WritableSignal<SearchCriteria>` | Advanced search fields |
| `results` | `WritableSignal<SearchResult[]>` | Search results |
| `selectedAccount` | `WritableSignal<SearchResult \| null>` | Currently selected account |
| `activeTab` | `WritableSignal<string>` | Current detail tab |
| `tabData` | `WritableSignal<any>` | Current tab's data |
| `tabLoading` | `WritableSignal<boolean>` | Tab data loading state |
| `headerBalance` | `WritableSignal<number \| null>` | Account balance in header |
| `riskFlags` | `WritableSignal<RiskFlag[]>` | Computed risk indicators |

#### Signals — Consumption Intelligence

| Signal | Type | Purpose |
|--------|------|---------|
| `consumptionSelectedMeter` | `WritableSignal<any>` | Selected meter for analysis |
| `consumptionHistory` | `WritableSignal<any[]>` | Filtered consumption records |
| `consumptionAllHistory` | `WritableSignal<any[]>` | Full consumption records |
| `consumptionChartData` | `WritableSignal<any[]>` | Bar chart data |
| `consumptionInsights` | `WritableSignal<any>` | Computed insights (avg, min, max, spikes) |
| `consumptionFinYears` | `WritableSignal<string[]>` | Available financial years |
| `consumptionSelectedYears` | `WritableSignal<string[]>` | Filter by years |
| `consumptionViewMode` | `WritableSignal<'chart' \| 'table'>` | Toggle view |
| `consIntelligenceMonths` | `WritableSignal<number>` | Months for intelligence window (default: 6) |

#### Signals — Statements

| Signal | Type | Purpose |
|--------|------|---------|
| `stmtType` | `WritableSignal<'standard' \| 'detailed'>` | Statement type |
| `stmtFinYear` | `WritableSignal<string>` | Financial year filter |
| `stmtMonth` | `WritableSignal<string>` | Month filter |
| `stmtGenerating` | `WritableSignal<boolean>` | Generation in progress |
| `stmtGenerated` | `WritableSignal<any>` | Generated statement data |
| `stmtSending` | `WritableSignal<boolean>` | Email/SMS send in progress |

#### Signals — Occupiers

| Signal | Type | Purpose |
|--------|------|---------|
| `occupiersList` | `WritableSignal<any[]>` | Current occupiers |
| `showAddOccupierModal` | `WritableSignal<boolean>` | Add occupier dialog |
| `showProofModal` | `WritableSignal<boolean>` | Proof of residence dialog |
| `proofData` | `WritableSignal<any>` | Proof document data |
| `rebuildingAccount` | `WritableSignal<boolean>` | Account rebuild in progress |

#### API Endpoints (40+ unique, all under `/api/platinum/billing-enquiry/` unless noted)

**Search & Account Selection**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 1 | POST | `/api/platinum/billing-enquiry/enquiry-results` | Primary search (quick + advanced) |
| 2 | GET | `/api/platinum/billing-enquiry/autocomplete` | Typeahead autocomplete (params: `search`, `type`) |

**Account Detail Loading (bulk parallel fetch on account select)**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 3 | GET | `/api/platinum/billing-enquiry/basic-account-details/{accountId}` | Basic account info |
| 4 | GET | `/api/platinum/billing-enquiry/account-info-result/{accountId}` | Extended account info |
| 5 | GET | `/api/platinum/billing-enquiry/property-details-by-account/{accountId}` | Property details |
| 6 | GET | `/api/platinum/billing-enquiry/get-contact-details/{accountId}` | Contact details |
| 7 | GET | `/api/platinum/billing-enquiry/consumption-units/{accountId}` | Consumption/meter units |
| 8 | GET | `/api/platinum/billing-enquiry/account-rates-details/{accountId}` | Rates details |
| 9 | GET | `/api/platinum/billing-enquiry/deposit-amount` | Deposit amount (param: `accountId`) |
| 10 | GET | `/api/platinum/billing-account-management/account-information` | Account management info (param: `accountId`) |
| 11 | GET | `/api/platinum/billing-enquiry/sectional-title-scheme` | Sectional title scheme (param: `accountId`) |
| 12 | GET | `/api/platinum/receipt-prepaid/cons-account-details` | Consumer account details (param: `accountId`) |

**Tab-Specific Data**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 13 | GET | `/api/platinum/billing-enquiry/contact-details/{accountId}` | Contact tab |
| 14 | GET | `/api/platinum/billing-enquiry/all-services/{accountId}` | Services tab |
| 15 | GET | `/api/platinum/billing-enquiry/services-search-results/{accountId}` | Services search results |
| 16 | GET | `/api/platinum/billing-enquiry/additional-billing-search-results/{accountId}` | Additional billing results |
| 17 | GET | `/api/platinum/billing-enquiry/account-notifications/{accountId}` | Notifications tab |
| 18 | GET | `/api/platinum/billing-enquiry/handover-info/{accountId}` | Handover tab |
| 19 | GET | `/api/platinum/billing-enquiry/attp-application-history/{accountId}` | ATTP application history |
| 20 | GET | `/api/platinum/billing-enquiry/name-info/{accountId}` | Name tab |
| 21 | GET | `/api/platinum/billing-enquiry/partition-details` | Property partition (param: `unitPartitionID`) |
| 22 | GET | `/api/platinum/billing-enquiry/valuation-by-unit` | Valuation (param: `unitPartitionID`) |
| 23 | GET | `/api/platinum/billing-enquiry/unit-partition-owner` | Owner info (param: `unitPartitionID`) |

**Consumption & Meters**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 24 | GET | `/api/platinum/billing-enquiry/meter-reading-history` | Meter reading history (params: `meterId`/`accountId`, `finYear`) |
| 25 | GET | `/api/platinum/billing-enquiry/meter-reading-history-barchart` | Bar chart data for consumption |
| 26 | GET | `/api/platinum/billing-enquiry/prepaid-recharge-details-for-meter` | Prepaid recharge history (param: `meterId`) |

**Transactions**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 27 | GET | `/api/platinum/billing-enquiry/get-billing-period-transactions` | Billing period transaction list |
| 28 | GET | `/api/platinum/billing-enquiry/interest-cons-payment-detail` | Interest/consumer payment detail |
| 29 | GET | `/api/platinum/billing-enquiry/journal-transaction-details` | Journal transaction details |

**Balance & Financial**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 30 | GET | `/api/platinum/billing-enquiry/service-type-balance` | Service type balance (params: `accountId`, `financialYear`) |
| 31 | GET | `/api/platinum/billing-enquiry/linked-accounts-on-property/{accountId}` | Linked accounts on property |

**Statements & Communication**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 32 | POST | `/api/platinum/billing-enquiry/generate-statement` | Generate statement |
| 33 | GET | `/api/platinum/statement-download?fileUrl={}` | Download generated statement (window.open) |
| 34 | POST | `/api/platinum/billing-enquiry/send-statement` | Send statement via email/SMS |
| 35 | GET | `/api/platinum/billing-enquiry/communication-templates` | Load communication templates |
| 36 | POST | `/api/platinum/billing-enquiry/send-notification` | Send notification (email/SMS) |

**Occupiers & Property Actions**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 37 | POST | `/api/platinum/billing-enquiry/add-occupier` | Add occupier |
| 38 | DELETE | `/api/platinum/billing-enquiry/add-occupier` | Remove occupier (param: `occupierId`) |
| 39 | GET | `/api/platinum/billing-enquiry/rebuild-full-account` | Rebuild/recalculate account (param: `accountId`) |
| 40 | GET | `/api/platinum/clearance-document-download?costScheduleId={}&type={}` | Download clearance document (window.open) |

**Other External Endpoints**

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 41 | GET | `/api/platinum/billing-enquiry/search-by-bank-statement-note` | Search by bank statement note (used in receipts context) |
| 42 | GET | `/api/platinum/billing-enquiry/get-eft-bank-statement-notes` | EFT bank statement notes |

#### Account Balance Fetching Strategy

The component loads account details from 10+ endpoints in parallel on account selection, merging results:

```
selectAccount(account):
  Promise.allSettled([
    billing-enquiry/basic-account-details/{id},
    billing-enquiry/account-info-result/{id},
    billing-enquiry/property-details-by-account/{id},
    billing-enquiry/get-contact-details/{id},
    billing-enquiry/consumption-units/{id},
    billing-enquiry/account-rates-details/{id},
    billing-enquiry/deposit-amount?accountId={id},
    billing-account-management/account-information?accountId={id},
    billing-enquiry/sectional-title-scheme?accountId={id},
    receipt-prepaid/cons-account-details?accountId={id}
  ]) → merge all results into unified tabData
```

#### Consumption Intelligence

```
Constants:
  SPIKE_HIGH = 1.5  (150% of average)
  SPIKE_LOW  = 0.4  (40% of average)
  STD_DAYS   = 30   (normalize to 30-day periods)

computeConsumptionInsights(history, months):
  1. Slice last N months
  2. Normalize readings to STD_DAYS-day periods
  3. Calculate: average, min, max, stdDev, trend (linear regression)
  4. Flag spikes: reading > avg × SPIKE_HIGH → "High spike"
  5. Flag drops: reading < avg × SPIKE_LOW → "Low spike"
  6. Return { avg, min, max, spikes, drops, trend, forecastNext }
```

#### Tiered Billing Estimate

```
parseTariffTiers(costInterVal: string):
  Parses Platinum's tariff string format into tiers
  Returns: Array<{ from, to, rate }>

estimateNextBill(consumption, tariffTiers, vatRate):
  1. Apply tiered rates to consumption units
  2. Sum tier amounts
  3. Add VAT at vatRate%
  4. Return { subtotal, vat, total, tierBreakdown }
```

#### Export Capabilities

Every data tab supports export via `ExportService`:

| Export Format | Method | Naming Convention |
|---------------|--------|-------------------|
| CSV | `exportService.exportCsv(data, options)` | `GEORGE_MUNICIPALITY_{TAB}_{ACCOUNT}_{DATE}.csv` |
| Excel | `exportService.exportExcel(data, options)` | `GEORGE_MUNICIPALITY_{TAB}_{ACCOUNT}_{DATE}.xlsx` |
| PDF | `exportService.exportPdf(data, options)` | `GEORGE_MUNICIPALITY_{TAB}_{ACCOUNT}_{DATE}.pdf` |
| Print | `exportService.print(data, options)` | Browser print dialog |

---

### 3.6 SupervisorDashboardComponent (~550 lines)

**Purpose**: Supervisor approval/decline for day-end reconciliations, receipt cancellation requests, cash reports, per-office reconciliation, and deposit slips.

#### API Endpoints (33 unique across 3 route modules)

**`auth-day-end/` — Cashier-Level Operations**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 1 | GET | `/api/platinum/auth-day-end/cashier-list` | List all cashier shifts |
| 2 | GET | `/api/platinum/auth-day-end/pending-cancel-requests` | Pending cancellation requests |
| 3 | GET | `/api/platinum/auth-day-end/cashier-details` | Individual cashier detail (param: `id`) |
| 4 | GET | `/api/platinum/auth-day-end/cashier-reconcile-by-cashierid` | Reconcile data by cashier (param: `cashierId`) |
| 5 | POST | `/api/platinum/auth-day-end/cashier-receipt-cash-list?id={}` | Cash receipt list |
| 6 | POST | `/api/platinum/auth-day-end/cashier-receipt-card-list?id={}` | Card receipt list |
| 7 | POST | `/api/platinum/auth-day-end/cashier-receipt-cheque-list?id={}` | Cheque receipt list |
| 8 | POST | `/api/platinum/auth-day-end/cashier-receipt-postal-order-list?id={}` | Postal order list |
| 9 | POST | `/api/platinum/auth-day-end/cashier-receipt-drop-box-list?id={}` | Drop box list |
| 10 | POST | `/api/platinum/auth-day-end/cashier-receipt-offline-data-list?id={}` | Offline data list |
| 11 | POST | `/api/platinum/auth-day-end/system-vs-cashier-data-list?id={}` | System vs cashier comparison |
| 12 | POST | `/api/platinum/auth-day-end/validate-cashbook?cashierId={}` | Validate cashbook |
| 13 | GET | `/api/platinum/auth-day-end/cashbook-list` | Cashbook list |
| 14 | POST | `/api/platinum/auth-day-end/submit-day-auth-reconcile` | Submit day-end reconciliation |
| 15 | POST | `/api/platinum/auth-day-end/finish-day-end-reconcile?userId={}` | Finalize day-end |
| 16 | POST | `/api/platinum/auth-day-end/return-day-end-reconcile` | Return day-end to cashier |
| 17 | POST | `/api/platinum/auth-day-end/approve-cancel-receipt` | Approve cancellation |
| 18 | POST | `/api/platinum/auth-day-end/decline-cancel-receipt` | Decline cancellation |
| 19 | POST | `/api/platinum/auth-day-end/cancel-receipt` | Execute cancellation |
| 20 | POST | `/api/platinum/auth-day-end/print-cash-report` | Print cash report |
| 21 | POST | `/api/platinum/auth-day-end/print-deposit-slip` | Print deposit slip |
| 22 | GET | `/api/platinum/auth-day-end/pos-cashier` | POS cashier info |

**`auth-day-end-per-office/` — Office-Level Operations**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 23 | GET | `/api/platinum/auth-day-end-per-office/cash-office-list` | List cash offices |
| 24 | GET | `/api/platinum/auth-day-end-per-office/cash-office-selection` | Select office (param: `cashOfficeId`) |
| 25 | GET | `/api/platinum/auth-day-end-per-office/cashier-summary-by-office` | Cashier summary for office |
| 26 | POST | `/api/platinum/auth-day-end-per-office/add-stage` | Add staging step |
| 27 | POST | `/api/platinum/auth-day-end-per-office/process-staging-payments` | Process staging payments |
| 28 | POST | `/api/platinum/auth-day-end-per-office/verify-cashier-reconcile` | Verify cashier reconcile |
| 29 | POST | `/api/platinum/auth-day-end-per-office/submit-reconcile-per-office` | Submit office-level reconcile |
| 30 | POST | `/api/platinum/auth-day-end-per-office/finish-stage` | Finalize staging step |
| 31 | POST | `/api/platinum/auth-day-end-per-office/return-day-end-reconcile` | Return reconcile to cashier |
| 32 | POST | `/api/platinum/auth-day-end-per-office/cancel-day-auth-reconcile-receipt` | Cancel reconcile receipt |
| 33 | GET | `/api/platinum/auth-day-end-per-office/cashier-reconcile-status` | Check reconcile status |

---

### 3.7 ViewReceiptsComponent (~350 lines)

**Purpose**: Search, view, print receipts with multiple search modes, cashbook trace, and bank statement note enrichment.

#### API Endpoints (11 unique)

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 1 | GET | `/api/platinum/view-receipt/get-cashiers` | Load cashier list for filter |
| 2 | GET | `/api/platinum/active-fin-year` | Get active financial year |
| 3 | POST | `/api/platinum/view-receipt/get-receipt-list` | Search receipts with filters |
| 4 | POST | `/api/platinum/billing-payment/print-receipt` | Print standard receipt |
| 5 | POST | `/api/platinum/billing-payment/print-miscellaneous-receipt` | Print misc receipt |
| 6 | GET | `/api/platinum/billing-enquiry/search-by-bank-statement-note` | Search by bank statement note |
| 7 | GET | `/api/platinum/billing-enquiry/get-eft-bank-statement-notes` | EFT bank statement notes |
| 8 | GET | `/api/platinum/cashbook-transaction-trace/search` | Cashbook transaction trace |
| 9 | GET | `/api/platinum/view-receipt/search-account-numbers` | Autocomplete account numbers |
| 10 | GET | `/api/platinum/view-receipt/search-receipt-numbers` | Autocomplete receipt numbers |
| 11 | POST | `/api/platinum/view-receipt/search-by-eft-description` | Search by EFT description |

---

### 3.8 BillingDashboardComponent (~420 lines)

**Purpose**: Category-based billing dashboard with alert counts, notification counts, chart data, and generic table drill-down.

#### Category Endpoint Map (from source, line 246-252)

```typescript
const categoryEndpoints: Record<string, string> = {
  account:         '/api/platinum/billing-dashboard/get-notification-account-item-counts',
  indigentsubsidy: '/api/platinum/billing-dashboard/get-subsidy-item-counts',
  consumption:     '/api/platinum/billing-dashboard/get-notification-consumption-item-counts',
  debt:            '/api/platinum/billing-dashboard/get-notification-debt-item-counts',
  billing:         '/api/platinum/billing-dashboard/get-billing-tab-item-details-count',
  property:        '/api/platinum/billing-dashboard/get-property-tab-item-details-count',
  pos:             '/api/platinum/billing-dashboard/pos-tab-item-details-count',
  rebate:          '/api/platinum/billing-dashboard/get-rebate-tab-item-details-count',
};
```

#### API Endpoints (15 unique)

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 1 | GET | `/api/platinum/billing-dashboard/get-alert-counts` | Alert count summary |
| 2 | GET | `/api/platinum/billing-dashboard/get-notification-counts` | Notification count summary |
| 3 | GET | `/api/platinum/billing-dashboard/get-notification-account-item-counts` | Account category counts |
| 4 | GET | `/api/platinum/billing-dashboard/get-subsidy-item-counts` | Indigent subsidy counts |
| 5 | GET | `/api/platinum/billing-dashboard/get-notification-consumption-item-counts` | Consumption counts |
| 6 | GET | `/api/platinum/billing-dashboard/get-notification-debt-item-counts` | Debt counts |
| 7 | GET | `/api/platinum/billing-dashboard/get-billing-tab-item-details-count` | Billing tab counts |
| 8 | GET | `/api/platinum/billing-dashboard/get-property-tab-item-details-count` | Property tab counts |
| 9 | GET | `/api/platinum/billing-dashboard/pos-tab-item-details-count` | POS tab counts |
| 10 | GET | `/api/platinum/billing-dashboard/get-rebate-tab-item-details-count` | Rebate counts |
| 11 | GET | `/api/platinum/billing-dashboard/get-billing-payment-by-type-of-use` | Chart: billing by type of use |
| 12 | GET | `/api/platinum/billing-dashboard/get-debt-arrangement-summary-chart` | Chart: debt arrangement summary |
| 13 | GET | `/api/platinum/billing-dashboard/get-meterreading-progress-chart` | Chart: meter reading progress |
| 14 | GET | `/api/platinum/billing-dashboard/get-billing-dashboard-billing-cycles` | Billing cycles data |
| 15 | POST | `/api/platinum/billing-dashboard/generic-table` | Generic table drill-down |

---

### 3.9 PaymentProcessingComponent (~780 lines)

**Purpose**: Third-party payment processing (import→transactions→validate→commit) and generic CSV import (upload→preview→validate→submit→poll→results).

#### Type Definitions

```typescript
type ThirdPartyTab = 'third-party' | 'generic-import';
type GenericImportStep = 'upload' | 'preview' | 'validate' | 'submit' | 'poll' | 'results';
```

#### API Endpoints (14 unique across 3 route modules)

**Third-Party Payment Flow**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 1 | GET | `/api/platinum/third-party-payments/types` | Payment type list |
| 2 | GET | `/api/platinum/third-party-payments/cashier-details` | Cashier details for session |
| 3 | GET | `/api/platinum/receipt-prepaid/cash-offices` | Cash office list |
| 4 | POST | `/api/platinum/third-party-payments/import-file` | Import third-party file |
| 5 | GET | `/api/platinum/third-party-payments/{importId}/transactions` | List imported transactions |
| 6 | PUT | `/api/platinum/third-party-payments/{importId}/transactions/{idx}` | Update individual transaction |
| 7 | GET | `/api/platinum/third-party-payments/account-search` | Account search/lookup |
| 8 | POST | `/api/platinum/third-party-payments/{importId}/validate-for-reconcile` | Validate for reconciliation |
| 9 | POST | `/api/platinum/third-party-payments/{importId}/commit` | Commit validated transactions |

**Generic Import Flow**

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 10 | POST | `/api/platinum/direct-deposit-allocation/validate-generic-import` | Validate generic import |
| 11 | POST | `/api/platinum/direct-deposit-allocation/submit-generic-import` | Submit generic import |
| 12 | GET | `/api/platinum/direct-deposit-allocation/generic-import-status/{jobId}` | Poll job status |
| 13 | GET | `/api/platinum/direct-deposit-allocation/generic-import-results/{jobId}` | Get job results |
| 14 | GET | `/api/platinum/direct-deposit-allocation/generic-import-errors/{jobId}` | Get job errors |

#### Account Lookup Batching

```
lookupCurrentAccounts(transactions):
  - Batch size: 10 at a time
  - GET third-party-payments/account-search { accountNo }
  - Merge results back into transaction objects
  - Parallel within batch, sequential across batches
```

#### Generic Import Pipeline

```
Step 'upload'  → onGenericFileSelected(file)
Step 'preview' → parse CSV, show preview table
Step 'validate' → POST direct-deposit-allocation/validate-generic-import
Step 'submit'  → POST direct-deposit-allocation/submit-generic-import → returns jobId
Step 'poll'    → GET direct-deposit-allocation/generic-import-status/{jobId} every 3 seconds
Step 'results' → GET generic-import-results/{jobId} + generic-import-errors/{jobId}
```

---

### 3.10 BulkAllocationProgressComponent (~320 lines)

**Purpose**: Monitor direct deposit bulk allocation jobs — shows status grid with filtering, sorting, drill-down, and retry capability.

#### API Endpoints (7 unique)

| # | Method | Endpoint (exact from source) | Purpose |
|---|--------|------------------------------|---------|
| 1 | GET | `/api/platinum/bulk-progress/get-financial-years` | Financial year filter options |
| 2 | GET | `/api/platinum/bulk-progress/get-month-list` | Month filter options |
| 3 | GET | `/api/platinum/bulk-progress/get-process-list` | Process type filter options |
| 4 | POST | `/api/platinum/bulk-progress/get-bulk-allocation-list` | List bulk allocation jobs |
| 5 | GET | `/api/platinum/bulk-progress/direct-deposit/{jobId}` | Job detail drill-down |
| 6 | GET | `/api/platinum/bulk-progress/job-account-details/{jobId}` | Job account details |
| 7 | POST | `/api/platinum/direct-deposit-errors/retry/{jobId}/{userId}` | Retry failed job |

#### Stale Job Detection

```
A job is considered stale if:
  - Status is 'in_progress' or 'processing'
  - AND job has been processing for > 30 minutes (compare timestamps)
  → Display warning badge
```

---

## 4. CROSS-CUTTING PATTERNS

### 4.1 Angular Architecture

| Pattern | Detail |
|---------|--------|
| **Standalone Components** | All 10 components use `standalone: true`, no NgModules |
| **Change Detection** | EnquiriesGeneral uses `ChangeDetectionStrategy.OnPush`; others use default |
| **Dependency Injection** | `inject()` function (not constructor injection) |
| **State Management** | Angular `signal()` / `computed()` throughout |
| **HTTP** | `ApiService` wrapping `HttpClient`, all calls via `firstValueFrom()` for async/await |
| **Template Files** | Separate `.component.html` / `.component.css` files |

### 4.2 Data Source Pattern

| Rule | Implementation |
|------|---------------|
| **Platinum API Only** | All 10 components source data exclusively from Platinum API via Express proxy |
| **No Local DB for Features** | Zero feature data in PostgreSQL — only POS core tables (users, sessions, transactions) |
| **No Hardcoded Data** | Payment types, offices, banks, SCOA items — all fetched from API at runtime |
| **Error Surfacing** | API failures shown via `ToastService`, never silently swallowed |

### 4.3 Platinum API Field Normalization

Multiple components (PosComponent, EnquiriesGeneral) normalize inconsistent Platinum field names:

| Concept | Possible Platinum Fields | Normalized To |
|---------|--------------------------|--------------|
| Account ID | `account_ID`, `accountID`, `accountId` | First non-zero value |
| Account Number | `accountNo`, `accountNumber`, `account_no` | First non-empty string |
| Name | `name`, `accountName`, `consumerName`, `surname_Company` | First non-empty string |
| Balance | `outstandingAmount`, `outStandingAmt`, `balance`, `totalDue` | `Number()` coercion |
| Address | `address`, `physicalAddress`, `deliveryAddress` | First non-empty string |
| Bill ID | `billId`, `bill_ID` | First non-zero value |
| Cut-off ID | `cutOffID`, `cutoff_ID` | First non-zero value |
| Meter Number | `meterNo`, `prepaidMeterNo`, `meter_No` | First non-empty string |

### 4.4 Date Formatting Standard

Date displays in PosComponent and EnquiriesGeneral use `dd/mm/yyyy` format:
```typescript
formatDate(val: string): string {
  const d = new Date(val);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
```

### 4.5 Currency Formatting

South African locale used in POS: `toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`

### 4.6 Financial Year Calculation

```
July–June cycle:
  month >= 6 (July index) → year = currentYear
  month < 6              → year = currentYear - 1
  Format: "YYYY/YYYY+1"
```

### 4.7 Session Cookie

- Name: `pos.sid`
- maxAge: 12 hours
- httpOnly: true
- sameSite: 'lax'

---

## 5. ENDPOINT SUMMARY — ALL UNIQUE ENDPOINTS

### 5.1 By Express Route Module

| Route Module | Endpoint Count | Components Using |
|--------------|---------------|------------------|
| `auth` | 1 | PosWorkflow, PosComponent, CashierSetup, CashierDayEnd |
| `receipt-prepaid` | 10 | PosComponent, CashierSetup, CashierDayEnd, EnquiriesGeneral, PaymentProcessing |
| `billing-payment` | 7 | PosComponent (submit, search, print, send) |
| `billing-payment-clearance` | 4 | PosComponent (banks, clearance data, submit) |
| `billing-payment-miscellaneous` | 3 | PosComponent (groups, SCOA items, submit) |
| `billing-payment-day-end` | 5 | CashierDayEnd |
| `auth-day-end` | 12 | CashierDayEnd, SupervisorDashboard, PosComponent |
| `auth-day-end-per-office` | 11 | SupervisorDashboard |
| `billing-enquiry` | 30+ | EnquiriesGeneral, ViewReceipts |
| `billing-account-management` | 1 | EnquiriesGeneral |
| `billing-dashboard` | 15 | BillingDashboard |
| `view-receipt` | 5 | ViewReceipts |
| `cashbook-transaction-trace` | 1 | ViewReceipts |
| `third-party-payments` | 9 | PaymentProcessing |
| `direct-deposit-allocation` | 4 | PaymentProcessing |
| `bulk-progress` | 5 | BulkAllocationProgress |
| `direct-deposit-errors` | 1 | BulkAllocationProgress |
| `drop-box` | 1 | PosComponent |
| `statement-download` | 1 | EnquiriesGeneral |
| `clearance-document-download` | 1 | EnquiriesGeneral |
| `active-fin-year` | 1 | ViewReceipts |

### 5.2 Highest-Endpoint Components

| Rank | Component | Unique Endpoints |
|------|-----------|-----------------|
| 1 | EnquiriesGeneralComponent | 40+ |
| 2 | SupervisorDashboardComponent | 33 |
| 3 | PosComponent | 25 |
| 4 | BillingDashboardComponent | 15 |
| 5 | PaymentProcessingComponent | 14 |
| 6 | CashierDayEndComponent | 11 |
| 7 | ViewReceiptsComponent | 11 |
| 8 | BulkAllocationProgressComponent | 7 |
| 9 | CashierSetupComponent | 6 |
| 10 | PosWorkflowComponent | 2 |

---

## 6. INTER-COMPONENT DEPENDENCIES

```
PosWorkflowComponent
  ├── CashierSetupComponent [embedded=true, (sessionStarted)]
  ├── PosComponent
  └── CashierDayEndComponent

PosComponent
  ├── Uses: PosBasketService (signal-based state)
  ├── Uses: ApiService, AuthService, ToastService
  └── Navigation to: /cashier-setup, /cashier-day-end, /enquiries

EnquiriesGeneralComponent
  ├── Uses: ApiService, AuthService, ToastService, ExportService
  └── Standalone (no child components)

SupervisorDashboardComponent → standalone
ViewReceiptsComponent → standalone
BillingDashboardComponent → standalone
PaymentProcessingComponent → standalone
BulkAllocationProgressComponent → standalone
```

---

*End of Phase 17 Document*

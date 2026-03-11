# PHASE 18 — Angular Components: Direct Deposits, Auth, Home & Settings

**Document**: `PHASE_18_ANGULAR_COMPONENTS_DIRECT_DEPOSITS_AUTH_HOME_SETTINGS.md`
**Created**: 2026-03-11
**Scope**: All Angular 19 standalone components in `features/direct-deposits/`, `features/auth/`, `features/home/`, and `features/settings/`

---

## 1. COMPONENT INVENTORY

| # | Component | Path | Lines | API Endpoints Used | Key Models / Types |
|---|-----------|------|-------|--------------------|--------------------|
| 1 | UnmatchedQueueComponent | `direct-deposits/manual/unmatched-queue.component.ts` | 1605 | 4 | BankReconPosItem, SuggestedMatch, ParsedClues, SortField |
| 2 | AllocateTransactionComponent | `direct-deposits/manual/allocate-transaction.component.ts` | 1484 | 18 | SearchResult, SearchScope, AllocationLine, ClearanceCostSchedule, CsvParsedRow, CsvLookupRow |
| 3 | AutoAllocationComponent | `direct-deposits/auto/auto-allocation.component.ts` | 274 | 4 | — |
| 4 | AllocationHistoryComponent | `direct-deposits/manual/allocation-history.component.ts` | 514 | 11 | AllocationRecord |
| 5 | LoginComponent | `auth/login/login.component.ts` | 55 | 2 | — |
| 6 | HomeComponent | `home/home.component.ts` | 57 | 0 | — |
| 7 | NotFoundComponent | `home/not-found.component.ts` | 11 | 0 | — |
| 8 | SettingsComponent | `settings/settings.component.ts` | 45 | 0 | — |

**Total**: 8 components, ~4,045 source lines, ~39 unique API endpoint calls

---

## 2. SHARED SERVICE DEPENDENCIES

### 2.1 Core Services

| Service | Import Path | Used By |
|---------|-------------|---------|
| `ApiService` | `core/services/api.service.ts` | UnmatchedQueue, AllocateTransaction, AutoAllocation, AllocationHistory, Login, Settings |
| `AuthService` | `core/services/auth.service.ts` | AllocateTransaction, Login, Home, Settings |
| `ToastService` | `core/services/toast.service.ts` | UnmatchedQueue, AllocateTransaction, AutoAllocation, AllocationHistory, Settings |
| `Router` | `@angular/router` | All 8 components |

### 2.2 Utility Functions (Non-Service)

| Function | Defined In | Used By |
|----------|------------|---------|
| `parseDescriptionForClues(note, reference)` | Inline in `unmatched-queue.component.ts` | UnmatchedQueue (2 call sites: detail panel, inline auto-allocate) |
| `parseSgNumber(sgString)` | Inline in `unmatched-queue.component.ts` | UnmatchedQueue (ERF/SG code enrichment) |

### 2.3 Local Types (Defined Inline)

**UnmatchedQueueComponent** defines:
- `BankReconPosItem` — bank recon POS item from Platinum (`posItem_ID`, `amount`, `note`, `reference`, `dateOfTransaction`, `bankReconID`, `allocated`)
- `SuggestedMatch` — auto-match result (`accountId`, `accountNo`, `name`, `confidence`, `matchType`, `matchDetail`, `matchReasoning[]`, `matchSources[]`, `outstandingAmount`, `erfNumber`, `sgNumber`, `suburb`, `address`, `bankStatementPrior`)
- `ParsedClues` — output of `parseDescriptionForClues()` (`accountNumbers[]`, `erfNumbers[]`, `meterNumbers[]`, `oldAccountCodes[]`, `nameSearchTerms[]`, `keywords[]`, `serviceType`)
- `SortField` — `'dateOfTransaction' | 'amount' | 'note' | 'reference'`

**AllocateTransactionComponent** defines:
- `SearchResult` — unified search result (`accountId`, `accountNo`, `name`, `type`, `description`, `outstandingAmount`, `oldAccountCode`, `rawData`)
- `SearchScope` — `'ALL' | 'ACCOUNT' | 'PREPAID' | 'INSTITUTION' | 'GROUP' | 'CLEARANCE' | 'DIRECT'`
- `AllocationLine` — line item for allocation (`accountNo`, `accountId`, `name`, `amount`, `allocationType`, `description`, `lastName`, `initials`, `miscPaymentGroupId`, `clearanceId`, `vatAmount`)
- `ClearanceCostSchedule` — clearance cost breakdown (`scheduleNo`, `costScheduleID`, `status`, `totalDue`, `linkedAccounts[]`, `section118_1_Breakdown[]`, `section118_3_Breakdown[]`, `clearanceData`)
- `CsvParsedRow` — CSV import row (`accountNo`, `amount`, `raw`)
- `CsvLookupRow` — CSV lookup result (`accountNo`, `amount`, `status`, `name`, `accountId`, `outstandingAmount`, `errorMsg`)

**AutoAllocationComponent** defines:
- `activeView` — `'unprocessed' | 'processed'` (2-view toggle, not separate tabs)
- `UnprocessedBatch` — batch with `num`, `items[]`, `rejectedItems[]`, `cashBookAuthoriseDate`, allocation counts/amounts
- `ProcessedBatch` — batch with `num`, `cashBookAuthoriseDate`, record/amount totals, `posItemIds`

---

## 3. COMPONENT DETAIL

---

### 3.1 UnmatchedQueueComponent (1605 lines)

**Purpose**: Displays unmatched bank deposit items in a smart grid with sorting, filtering, pagination, and an auto-match suggestion engine. Allows inline quick-match and navigation to the full allocation screen.

**Lifecycle**:
1. `ngOnInit()` → calls `loadData()`
2. `loadData()` → fetches page 1 (pageSize=200), then background-loads remaining pages (up to 10 pages max)
3. `ngOnDestroy()` → clears inline suggestion state

#### 3.1.1 Platinum API Endpoints

| # | Method | Endpoint | Purpose | Request Payload | Response Shape |
|---|--------|----------|---------|-----------------|----------------|
| 1 | POST | `direct-deposit-allocation/get-bank-recon-positem-list` | Load unmatched bank deposit items | `{ page, pageSize, orderby: 'dateOfTransaction', shortDirection: 'desc' }` | `{ items: BankReconPosItem[], totalCount: number }` |
| 2 | GET | `direct-deposit-allocation/get-account-autocomplete` | Search accounts by text (account number, meter number, ERF) | `?searchText={value}` | `BankReconPosItem[]` or `{ value: [...] }` |
| 3 | GET | `direct-deposit-allocation/get-old-account-autocomplete` | Search old/legacy account codes and SG numbers | `?searchText={value}` | Array of old account records |
| 4 | POST | `billing-payment/search-accounts` | Search by account number, ERF number, or name | `{ accountNo }` or `{ erfNumber }` or `{ name }` | Array of account records |

**Notes on endpoints 2–4**: Each endpoint is called multiple times with different search terms extracted by `parseDescriptionForClues()`. A single item detail-panel search runs up to ~20 parallel API calls. Inline auto-allocate runs a condensed version (~12 parallel calls).

#### 3.1.2 Auto-Match Suggestion Engine (`parseDescriptionForClues`)

The `parseDescriptionForClues(note, reference)` function extracts structured clues from free-text bank descriptions:

| Clue Type | Detection Pattern | Example Input | Extracted Value |
|-----------|-------------------|---------------|-----------------|
| Account Numbers | 5–12 digit sequences, not dates/amounts | `"PAY 000123456789"` | `['000123456789']` |
| ERF Numbers | `ERF` prefix with optional portion/area | `"ERF 1234/5 GEORGE"` | `[{ erf: '1234', portion: '5', area: 'GEORGE' }]` |
| Meter Numbers | Alphanumeric 8–16 char patterns | `"MTR A12B345678"` | `['A12B345678']` |
| Old Account Codes | Legacy alphanumeric codes | `"OLD-ACC GRG12345"` | `['GRG12345']` |
| Name Terms | Multi-word sequences (non-numeric) | `"VAN DER MERWE"` | `['VAN DER MERWE']` |
| Keywords | Area/suburb names | `"BLANCO"` | `['BLANCO']` |
| Service Type | Electricity/water/rates/refuse | `"ELEC PAYMENT"` | `'electricity'` |

#### 3.1.3 Confidence Scoring

| Match Type | Confidence Range | Scoring Rules |
|------------|-----------------|---------------|
| Account number (exact) | 88–92 | Exact match from autocomplete or billing-payment search |
| Account number (partial) | 60–80 | Contains or ends-with match |
| ERF number (area confirmed) | 91–95 | ERF match + area/suburb confirmed in result fields |
| ERF number (no area) | 75–90 | ERF match, area not verified |
| SG code match | 86–95 | Old account autocomplete returns SG code containing ERF |
| Meter number (exact) | 92 | Meter number string found in result |
| Meter number (partial) | 75 | Loose meter reference |
| Old account code | 75–78 | Legacy code matched via old-account autocomplete |
| Name (surname exact) | 65–85 | Surname token exact match, multi-part boosted |
| Name (partial) | 45–60 | Single name component match |
| Reference (short number) | 92 | Numeric reference zero-padded to account number |
| Keyword/area | 40 | Low-confidence area keyword match |
| Multi-source boost | +4 per additional source | Capped at +8, max confidence 99 |

#### 3.1.4 Grid Features

| Feature | Implementation |
|---------|----------------|
| Client-side sorting | `sortField` signal: `dateOfTransaction`, `amount`, `note`, `reference` |
| Client-side search | `searchQuery` signal filters on `note`, `reference`, `amount` |
| Status filter | `statusFilter` signal: `'all'`, `'allocated'`, `'unallocated'` |
| Pagination | `page` / `pageSize` (default 25) signals, computed `paginatedItems` |
| Progressive loading | Pages 1–10 loaded sequentially, `loadingMore` / `loadProgress` signals |
| Multi-select | `selectedItems: WritableSignal<Set<number>>`, select-all toggles current page |
| Inline auto-allocate | `autoAllocateItem()` expands inline suggestion panel per row |
| Detail panel | `selectItem()` opens side panel with full `loadSuggestedMatches()` engine |

#### 3.1.5 Navigation

| Action | Route |
|--------|-------|
| Allocate item | `/direct-deposits/manual/allocate/:posItemId` |
| Allocate with pre-selected account | Same route + `?accountId=&accountNo=&name=&amount=` |
| View history | `/direct-deposits/manual/history` |

---

### 3.2 AllocateTransactionComponent (1484 lines)

**Purpose**: Full allocation screen for a single bank deposit transaction. Supports 7 search scopes, clearance cost schedule allocation, institution auto-expand with smart budget distribution, CSV bulk import, and batch submission.

**Route**: `/direct-deposits/manual/allocate/:id` where `:id` is the `posItemId`

**Lifecycle**:
1. `ngOnInit()` reads `ActivatedRoute.params` for `id` (posItemId)
2. Loads misc payment groups via `billing-payment-miscellaneous/get-groups`
3. Loads transaction details via `direct-deposit-allocation/get-pos-item-details`

#### 3.2.1 Platinum API Endpoints

| # | Method | Endpoint | Purpose | Request Payload | Response Shape |
|---|--------|----------|---------|-----------------|----------------|
| 1 | GET | `direct-deposit-allocation/get-pos-item-details` | Load transaction details by posItemId | `?posItemId={id}` | Single `BankReconPosItem` |
| 2 | GET | `billing-payment-miscellaneous/get-groups` | Load misc payment groups (on init) | — | Array of `MiscPaymentGroup` |
| 3 | GET | `billing-enquiry/autocomplete` | Search accounts via billing enquiry autocomplete | `?search={query}&type={acType}` | Array of account records |
| 4 | POST | `billing-payment/search-accounts` | Search by accountNo, erfNumber, name, oldAccountCode, or ID | `{ accountNo }` or `{ erfNumber }` or `{ name }` or `{ oldAccountCode }` | Array of account records |
| 5 | GET | `billing-payment-clearance/get-clearanceids` | Search clearance IDs (CLEARANCE scope, primary) | `?clearanceId={query}` | Array of clearance records |
| 6 | GET | `direct-deposit-allocation/get-clearance-autocomplete` | Search clearance autocomplete (CLEARANCE scope, fallback) | `?searchTerm={query}` | Array of clearance records |
| 7 | POST | `billing-payment-clearance/get-clearance-data` | Load clearance cost schedule (primary method) | `{ clearanceId: formattedClearanceId }` | `{ items: [{ clearanceStaging_ID, accountID, name, total1181, total1183, remaining, total, paid, ... }] }` |
| 8 | POST | `direct-deposit-allocation/get-clearance-details-info` | Load clearance details (legacy fallback) | `{ costScheduleID, accountID, transactionAmount, posItemID }` | `{ accounts: [...], items: [...] }` |
| 9 | POST | `direct-deposit-allocation/load-details-clearance` | Load clearance items (legacy fallback, parallel) | `{ costScheduleID, posItemID, transactionAmount }` | `{ accounts: [...], items: [...] }` |
| 10 | GET | `direct-deposit-allocation/get-group-payment-details` | Search payment groups (GROUP scope) | `?searchTerm={query}` | Array of group records |
| 11 | GET | `const-institutions/search` | Search institutions (INSTITUTION scope) | `?name={query}` | Array of institution records |
| 12 | GET | `receipting-account-group-payment/search-accounts-by-group` | Load accounts linked to institution (after selection) | `?institutionId={id}` | Array of accounts linked to institution |
| 13 | POST | `direct-deposit-allocation/create-virtual-session` | Create virtual cashier session for allocation | `{ posItemId, userId }` | `{ virtualCashierId }` |
| 14 | POST | `direct-deposit-allocation/close-virtual-session` | Close virtual session after allocation | `{ sessionId }` | — |
| 15 | GET | `active-fin-year` | Fetch active financial year | — | `string` or `{ finYear }` |

**Non-Platinum (Express backend) endpoints**:

| # | Method | Endpoint | Purpose | Request Payload |
|---|--------|----------|---------|-----------------|
| 16 | POST | `/api/dd-allocation/submit-batch` | Submit allocation batch (Express orchestrates Platinum calls) | `{ posItemId, reconId, financialYear, transactionDate, transactionNote, lines: [...] }` |
| 17 | GET | `/api/dd-allocation/job/{jobId}` | Poll batch job status | URL param | `{ status, completedLines, totalLines, results, errors }` |

#### 3.2.2 Search System

**7 Search Scopes**:

| Scope | API Calls | Auto-Detection |
|-------|-----------|----------------|
| ALL | `billing-enquiry/autocomplete` + `search-accounts` | Default — runs all |
| ACCOUNT | `billing-enquiry/autocomplete` + `search-accounts` (by accountNo or name) | — |
| PREPAID | `search-accounts` with `{ accountNo }` | Mobile number (10-digit starting 0) or ID number (13-digit) |
| CLEARANCE | `billing-payment-clearance/get-clearanceids` (primary) + `direct-deposit-allocation/get-clearance-autocomplete` (fallback) | SG number pattern (T0...) |
| DIRECT | `billing-enquiry/autocomplete` + `search-accounts` (by name) | — |
| GROUP | `direct-deposit-allocation/get-group-payment-details` | — |
| INSTITUTION | `const-institutions/search` → then `receipting-account-group-payment/search-accounts-by-group` on selection | — |

**Auto-detection rules** (applied to input text):
- 10-digit starting with `0` → mobile/prepaid
- 13-digit → ID number
- Starts with `T0` or contains `/` with digits → SG/clearance
- Contains `@` → email (searches by name)
- 6+ digits → account number
- Otherwise → name search

**Debounced search**: 150ms debounce, abort controller cancels prior searches, 8-second timeout via RxJS `timeout()`.

**Enrichment**: After autocomplete results return, `enrichAutocompleteResults()` calls `billing-payment/search-accounts` for the top 5 results to fill in full names, outstanding amounts, and old account codes.

#### 3.2.3 Clearance Allocation Flow

1. User selects clearance from search results
2. `loadClearanceDetails()` tries primary endpoint (`billing-payment-clearance/get-clearance-data`)
3. If primary fails, falls back to legacy parallel calls (`get-clearance-details-info` + `load-details-clearance`)
4. Builds `ClearanceCostSchedule` with Section 118(1) and 118(3) breakdowns
5. User can auto-fill amounts via `clearanceAutoFill()` (distributes remaining budget across schedule items)
6. `addClearanceLines()` creates one `AllocationLine` per cost schedule item with amount > 0

#### 3.2.4 Institution Allocation Flow

1. User selects institution from search results
2. `handleSelectInstitution()` calls `search-accounts-by-group` to get linked accounts
3. Smart budget distribution: accounts with outstanding amounts get `min(outstanding, budget)`, remainder split evenly across accounts without outstanding amounts
4. Multiple `AllocationLine` entries created automatically

#### 3.2.5 CSV Import Flow

| Step | Signal Value | Description |
|------|-------------|-------------|
| upload | `csvStep = 'upload'` | File selection dialog |
| preview | `csvStep = 'preview'` | Parsed rows displayed (auto-detects delimiter: `;`, `\t`, `,`; auto-detects headers) |
| lookup | `csvStep = 'lookup'` | Batch validates accounts via `billing-payment/search-accounts` (50 accounts per batch) |
| done | `csvStep = 'done'` | Shows results, user confirms to add lines |

CSV pagination: `CSV_PAGE_SIZE = 20`, signals `csvPage`, computed `csvPreviewTotalPages` / `csvLookupTotalPages`.

#### 3.2.6 Submission Flow

1. `submitAllocation()` validates `canSubmit()` (lines exist, total ≤ transaction amount)
2. Creates virtual cashier session via `create-virtual-session` (non-blocking if fails)
3. Fetches `active-fin-year`
4. Posts batch to `/api/dd-allocation/submit-batch`
5. If `jobId` returned, polls `/api/dd-allocation/job/{jobId}` (max 30 attempts, 2s interval)
6. Closes virtual session via `close-virtual-session` (non-blocking if fails)
7. Signals: `posting`, `postingStatus`, `postComplete`, `postErrors`, `completedLines`

---

### 3.3 AutoAllocationComponent (274 lines)

**Purpose**: 2-view toggle interface for automated bulk deposit allocation. Default view shows unprocessed batches; toggle switches to processed batches. Reconcile is a per-batch action on unprocessed items; print is a per-batch action on processed items.

**Route**: `/direct-deposits/auto`

#### 3.3.1 Platinum API Endpoints

| # | Method | Endpoint | Purpose | Request Payload | Response Shape |
|---|--------|----------|---------|-----------------|----------------|
| 1 | POST | `direct-deposit-bulk/get-unprocessed` | Load unprocessed bulk deposit batches | `{ fromDate: ISO, toDate: ISO }` | Array of `UnprocessedBatch` or `{ items/unProcessedBatches/batches: [...] }` |
| 2 | POST | `direct-deposit-bulk/get-processed` | Load processed bulk deposit batches | `{ unProcessedBatches: [...], processedBatches: [...] }` | Array of `ProcessedBatch` or `{ items/processedBatches: [...] }` |
| 3 | POST | `direct-deposit-bulk/reconcile` | Reconcile a single unprocessed batch | `{ userId, selectedItem: batch, unProcessedBatches: [...], processedBatches: [...] }` | `{ unProcessedBatches: [...], processedBatches: [...] }` |
| 4 | POST | `direct-deposit-bulk/print-processed` | Generate print report for a single processed batch | `{ userName, selectedItem: batch, processedBatches: [...] }` | Print report data |

#### 3.3.2 View Structure (2-view toggle)

| View | Signal Value | Data Source | Per-Batch Actions |
|------|-------------|-------------|-------------------|
| Unprocessed | `'unprocessed'` | `get-unprocessed` | Expand/collapse, **Reconcile** (auto-refreshes unprocessed after) |
| Processed | `'processed'` | `get-processed` | Expand/collapse, **Print** report |

**Lifecycle**:
1. `ngOnInit()` sets date range to last 30 days
2. User clicks Search → `fetchUnprocessed()` loads batches
3. `setActiveView('processed')` triggers `fetchProcessed()` automatically
4. `reconcileBatch(batch)` processes a single unprocessed batch, then auto-refreshes the unprocessed list
5. `printBatch(batch)` generates a print report for a single processed batch

#### 3.3.3 Grid Features

| Feature | Implementation |
|---------|----------------|
| Date range filter | `fromDate` / `toDate` signals (ISO input), last 30 days default |
| Batch expansion | `expandedBatchNum` / `expandedProcessedNum` toggles per-batch item visibility |
| Summary computed signals | `totalRecords`, `totalValue`, `totalAllocated`, `totalUnallocated`, `totalRejected` (all computed from unprocessed batches) |
| Loading states | `loading`, `processing`, `printing` signals |
| Error handling | `error` signal with toast notifications |
| Currency formatting | `formatCurrency()` — `R X,XXX.XX` (en-ZA locale) |
| Date formatting | `formatDate()` — `dd/mm/yyyy` (padStart pattern) |

---

### 3.4 AllocationHistoryComponent (514 lines)

**Purpose**: Displays allocation batch history with job status tracking, retry functionality, and drill-down to job details including account-level results and errors.

**Route**: `/direct-deposits/manual/history`

#### 3.4.1 Platinum API Endpoints

| # | Method | Endpoint | Purpose | Request Payload | Response Shape |
|---|--------|----------|---------|-----------------|----------------|
| 1 | GET | `bulk-progress/get-financial-years` | Load financial year filter options (on init) | — | `string[]` |
| 2 | GET | `bulk-progress/get-month-list` | Load billing month filter options (on init) | — | `{ id: number, name: string }[]` |
| 3 | GET | `bulk-progress/get-process-list` | Load process type filter options (on init) | — | `string[]` |
| 4 | POST | `bulk-progress/get-bulk-allocation-list` | Load allocation batch history (server-side paginated) | `{ financialYear, process, billingMonth, orderby: 'fileDate', page, pageSize: 20, shortDirection: 'desc' }` | `{ items: AllocationRecord[], totalCount }` |
| 5 | POST | `bank-statement-notes` | Fetch bank statement notes for posItemIds missing paymentReference | `{ posItemIds: number[] }` | `Record<string, string>` (posItemId→note) |
| 6 | POST | `direct-deposit-errors/retry/{jobId}/{userId}` | Retry failed allocation job | URL params | `{ success, message }` |
| 7 | GET | `direct-deposit-errors/job-details/{jobId}` | Poll job status after retry (3s intervals, max 20 attempts) | URL param | `{ status, errors: [...] }` |
| 8 | GET | `bulk-progress/job-account-details/{jobId}` | Load job account-level results (detail drill-down) | URL param | `{ accounts: [...] }` |
| 9 | GET | `direct-deposit-errors/account-details/{jobId}` | Load account error details (detail drill-down) | URL param | `{ accounts: [...], errors: [...] }` |
| 10 | GET | `direct-deposit-allocation/generic-import-errors/{jobId}` | Load generic import errors (detail drill-down) | URL param | `{ errors: [...] }` |
| 11 | GET | `direct-deposit-allocation/generic-import-status/{jobId}` | Load generic import status (detail drill-down) | URL param | `{ status, processedCount, totalCount }` |
| 12 | POST | `billing-payment/search-accounts` | Look up account details in detail view | `{ accountNo }` | Array of account records |
| 13 | POST | `billing-payment/print-receipt` | Reprint receipt from history detail | Receipt reprint payload | Receipt data |

#### 3.4.2 Filter System

Filters loaded on init via 3 parallel API calls:

| Filter | Signal | Source Endpoint | Options |
|--------|--------|-----------------|---------|
| Financial Year | `financialYear` | `bulk-progress/get-financial-years` | `string[]` (defaults to first) |
| Billing Month | `billingMonth` | `bulk-progress/get-month-list` | `{ id, name }[]` + 'All' default |
| Process Type | `processFilter` | `bulk-progress/get-process-list` | `string[]` + 'All' default |
| Method | `methodFilter` | Client-side | `ALL` / `MANUAL` / `BULK` |
| Text Search | `filterQuery` | Client-side | Filters by fileName, paymentReference, process, posItemID, amount |

Server-side pagination: `page` signal, `pageSize=20`, `orderby: 'fileDate'`, `shortDirection: 'desc'`.

#### 3.4.3 Bank Statement Note Enrichment

After loading allocation records, identifies items with missing `paymentReference` (null or '0') and fetches notes via `bank-statement-notes` POST endpoint. Results are cached in `posItemNoteCache` (keyed by posItemID) to avoid redundant API calls across page loads.

#### 3.4.4 Job Status Polling

After retry, polls `direct-deposit-errors/job-details/{jobId}` at 3-second intervals (max 20 attempts) until status is `COMPLETED`, `FAILED`, or `PARTIAL_FAILURE`.

#### 3.4.5 Detail Drill-Down

When user expands a job row, loads data from up to 4 parallel endpoints:
- `bulk-progress/job-account-details/{jobId}` — successful account allocations
- `direct-deposit-errors/account-details/{jobId}` — account-level errors
- `direct-deposit-allocation/generic-import-errors/{jobId}` — generic import errors
- `direct-deposit-allocation/generic-import-status/{jobId}` — import processing status

Detail view also supports account lookup (`billing-payment/search-accounts`) and receipt reprint (`billing-payment/print-receipt`).

#### 3.4.6 Grid Features

| Feature | Implementation |
|---------|----------------|
| Server-side pagination | POST body with `page`, `pageSize: 20`, `orderby`, `shortDirection` |
| Client-side filtering | `filteredHistory` computed signal applies `filterQuery` and `methodFilter` |
| Bank statement notes | Auto-enriched from `bank-statement-notes` endpoint, cached per posItemID |
| Status badges | Color-coded by job status (completed=green, failed=red, partial=amber, processing=blue) |
| Retry button | Per-job retry with polling feedback (`retrying` signal tracks active jobId) |
| Expandable rows | Click to show account details and errors (`detailOpen`, `selectedTx` signals) |

---

### 3.5 LoginComponent (55 lines)

**Purpose**: Authentication screen with site selection, username/password login.

**Route**: `/login`

#### 3.5.1 API Endpoints

| # | Method | Endpoint | Purpose | Request Payload | Response Shape |
|---|--------|----------|---------|-----------------|----------------|
| 1 | GET | `/api/sites` | Load available site configurations | — | `[{ id, name, label }]` |
| 2 | — | (Delegated) | `AuthService.login(username, password, site)` handles the actual login call | — | `{ success, error? }` |

#### 3.5.2 State

| Signal | Type | Purpose |
|--------|------|---------|
| `loading` | `boolean` | Login in progress |
| `error` | `string` | Login error message |
| `sites` | `any[]` | Available sites from `/api/sites` |

#### 3.5.3 Behavior

- Constructor calls `loadSites()` on instantiation
- `selectedSite` defaults to `'george'`
- On successful login, navigates to `/`
- On failure, displays error message from `AuthService`

---

### 3.6 HomeComponent (57 lines)

**Purpose**: Dashboard landing page with time-based greeting, user info display, and 8 quick-link navigation cards.

**Route**: `/` (default)

#### 3.6.1 API Endpoints

None. All data is static (quicklinks) or from `AuthService` signals (`user`, `site`).

#### 3.6.2 Quick Links

| # | Label | Route | Icon |
|---|-------|-------|------|
| 1 | POS Receipting | `/pos` | `point_of_sale` |
| 2 | View Receipts | `/view-receipts` | `description` |
| 3 | Billing Dashboard | `/billing-dashboard` | `bar_chart` |
| 4 | General Enquiries | `/enquiries/general` | `manage_search` |
| 5 | Direct Deposits | `/direct-deposits/manual` | `account_balance` |
| 6 | Communications | `/communications` | `forum` |
| 7 | Supervisor | `/supervisor` | `admin_panel_settings` |
| 8 | Debt Management | `/debt/section129` | `gavel` |

#### 3.6.3 Greeting Logic

| Time Range | Greeting |
|------------|----------|
| 00:00–11:59 | "Good morning" |
| 12:00–16:59 | "Good afternoon" |
| 17:00–23:59 | "Good evening" |

---

### 3.7 NotFoundComponent (11 lines)

**Purpose**: 404 error page displayed for unmatched routes.

**Route**: `**` (wildcard, last route in `app.routes.ts`)

**API Endpoints**: None.

**Behavior**: Static template with `RouterLink` back to home. No logic, no signals, no API calls.

---

### 3.8 SettingsComponent (45 lines)

**Purpose**: Stub/placeholder component for future settings functionality.

**Route**: `/settings`

**API Endpoints**: None currently. `loadData()` is a no-op stub with loading/error signal infrastructure.

**State**: `loading`, `error`, `data` signals prepared for future implementation.

**Injected Services**: `ApiService`, `ToastService`, `AuthService`, `Router`, `ActivatedRoute` — all injected but unused pending feature implementation.

---

## 4. CROSS-CUTTING PATTERNS

### 4.1 Signal-Based State Management

All components use Angular signals exclusively for reactive state:

| Pattern | Components Using |
|---------|-----------------|
| `WritableSignal<T>` for loading/error/data | All 8 |
| `computed()` for derived state | UnmatchedQueue (filteredItems, paginatedItems, stats, totalPages), AllocateTransaction (totalAllocated, remaining, canSubmit, csvPreviewTotalPages, csvLookupTotalPages) |
| `Signal<Set<T>>` for multi-select | UnmatchedQueue (selectedItems, inlineExpanded, inlineLoading) |
| `Signal<Map<K,V>>` for keyed state | UnmatchedQueue (inlineSuggestions, inlineProgress) |

### 4.2 Date Formatting

All components use the `dd/mm/yyyy` format standard:
```typescript
`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
```

Used in: UnmatchedQueue (`formatDate`, `formatDateTime`), AllocateTransaction (`formatDate`), AllocationHistory, AutoAllocation.

### 4.3 Currency Formatting

South African Rand with `en-ZA` locale:
```typescript
`R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
```

Used in: UnmatchedQueue, AllocateTransaction, AutoAllocation, AllocationHistory.

### 4.4 Error Handling Pattern

All API calls follow the pattern:
```typescript
try {
  // API call
} catch (e: any) {
  this.error.set(e?.error?.message || e?.message || 'Fallback message');
  this.toast.error('User-facing message');
}
```

### 4.5 Response Unwrapping

Both UnmatchedQueue and AllocateTransaction handle polymorphic Platinum API responses:
```typescript
Array.isArray(result) ? result
  : result?.items || result?.value || result?.results || result?.data || []
```

### 4.6 Abort/Cancellation

AllocateTransaction uses `AbortController` + `searchVersion` counter for search cancellation. CSV import uses `csvCancelRequested` boolean flag.

---

## 5. UNIQUE API ENDPOINT SUMMARY

### 5.1 Platinum API Endpoints (via `/api/platinum/` proxy)

| # | Method | Endpoint | Used By |
|---|--------|----------|---------|
| 1 | POST | `direct-deposit-allocation/get-bank-recon-positem-list` | UnmatchedQueue |
| 2 | GET | `direct-deposit-allocation/get-pos-item-details` | AllocateTransaction |
| 3 | GET | `direct-deposit-allocation/get-account-autocomplete` | UnmatchedQueue |
| 4 | GET | `direct-deposit-allocation/get-old-account-autocomplete` | UnmatchedQueue |
| 5 | GET | `direct-deposit-allocation/get-clearance-autocomplete` | AllocateTransaction |
| 6 | GET | `direct-deposit-allocation/get-group-payment-details` | AllocateTransaction |
| 7 | POST | `direct-deposit-allocation/create-virtual-session` | AllocateTransaction |
| 8 | POST | `direct-deposit-allocation/close-virtual-session` | AllocateTransaction |
| 9 | POST | `direct-deposit-allocation/get-clearance-details-info` | AllocateTransaction |
| 10 | POST | `direct-deposit-allocation/load-details-clearance` | AllocateTransaction |
| 11 | GET | `direct-deposit-allocation/generic-import-errors/{jobId}` | AllocationHistory |
| 12 | GET | `direct-deposit-allocation/generic-import-status/{jobId}` | AllocationHistory |
| 13 | GET | `billing-enquiry/autocomplete` | AllocateTransaction |
| 14 | GET | `billing-payment-miscellaneous/get-groups` | AllocateTransaction |
| 15 | POST | `billing-payment/search-accounts` | UnmatchedQueue, AllocateTransaction, AllocationHistory |
| 16 | POST | `billing-payment/print-receipt` | AllocationHistory |
| 17 | GET | `billing-payment-clearance/get-clearanceids` | AllocateTransaction |
| 18 | POST | `billing-payment-clearance/get-clearance-data` | AllocateTransaction |
| 19 | GET | `const-institutions/search` | AllocateTransaction |
| 20 | GET | `receipting-account-group-payment/search-accounts-by-group` | AllocateTransaction |
| 21 | GET | `active-fin-year` | AllocateTransaction |
| 22 | POST | `direct-deposit-bulk/get-unprocessed` | AutoAllocation |
| 23 | POST | `direct-deposit-bulk/get-processed` | AutoAllocation |
| 24 | POST | `direct-deposit-bulk/reconcile` | AutoAllocation |
| 25 | POST | `direct-deposit-bulk/print-processed` | AutoAllocation |
| 26 | GET | `bulk-progress/get-financial-years` | AllocationHistory |
| 27 | GET | `bulk-progress/get-month-list` | AllocationHistory |
| 28 | GET | `bulk-progress/get-process-list` | AllocationHistory |
| 29 | POST | `bulk-progress/get-bulk-allocation-list` | AllocationHistory |
| 30 | GET | `bulk-progress/job-account-details/{jobId}` | AllocationHistory |
| 31 | POST | `bank-statement-notes` | AllocationHistory |
| 32 | POST | `direct-deposit-errors/retry/{jobId}/{userId}` | AllocationHistory |
| 33 | GET | `direct-deposit-errors/job-details/{jobId}` | AllocationHistory |
| 34 | GET | `direct-deposit-errors/account-details/{jobId}` | AllocationHistory |

### 5.2 Express Backend Endpoints (non-Platinum)

| # | Method | Endpoint | Used By |
|---|--------|----------|---------|
| 35 | GET | `/api/sites` | Login |
| 36 | POST | `/api/dd-allocation/submit-batch` | AllocateTransaction |
| 37 | GET | `/api/dd-allocation/job/{jobId}` | AllocateTransaction |

### 5.3 AuthService Delegated Calls

| # | Method | Used By |
|---|--------|---------|
| 38 | `AuthService.login(username, password, site)` | Login |

**Total unique API endpoints**: 38 (34 Platinum + 3 Express backend + 1 AuthService delegated)

---

## 6. KNOWN PLATINUM API TYPOS

| Endpoint | Typo | Correct Spelling | Used In Phase 18? |
|----------|------|-------------------|-------------------|
| `billing-payment-clearance/get-clearence-autocomplete` | `clearence` | `clearance` | No (used in POS module via server routes, not in direct-deposits Angular components) |

This typo is in the actual Platinum API and must be used as-is in all code that calls it. The Phase 18 direct-deposits components use `get-clearanceids` and `get-clearance-autocomplete` (correctly spelled) for clearance searches instead.

---

## 7. COMPLIANCE NOTES

### 7.1 Platinum API Only ✅
All feature data sourced from Platinum API endpoints. No local database queries for feature data. Express `/api/dd-allocation/` endpoints orchestrate Platinum calls server-side.

### 7.2 No Hardcoded Data ✅
No `_synthetic: true`, no hardcoded accounts, no fallback data arrays. QuickLinks in HomeComponent are static navigation metadata (routes/labels), not feature data.

### 7.3 Date Format ✅
All date displays use `dd/mm/yyyy` with `padStart(2,'0')` pattern.

### 7.4 Error Handling ✅
All API screens have loading, error, and empty states. Errors surface to user via `ToastService` and `error` signals.

### 7.5 Settings Stub ⚠️
`SettingsComponent` is a prepared stub with no active endpoints. Implementation pending future feature specification.

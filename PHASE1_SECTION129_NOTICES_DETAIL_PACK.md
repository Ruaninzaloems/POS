# Phase 1 — Section 129 Notices: Implementation Detail Pack

> **Audience**: API Development Team
> **Page**: Section 129 — Letter of Demand (`/debt/section129`)
> **Frontend file**: `client/src/pages/debt/section129-notices.tsx`
> **Backend proxy file**: `server/routes.ts` (lines 6988–7250)
> **Models**: `client/src/models/debt.models.ts` (lines 281–358)
> **API client**: `client/src/lib/external-api.ts` (lines 2816–2982, 3086–3210)
> **EMS SQL schema**: `attached_assets/ems_(1)_1773064199473.sql`

---

## 1. Screen Breakdown

### 1.1 Top Selection Bar (4 fields — always visible)

| # | Label | Type | Required | Load Source | Validation | Editable | Conditional |
|---|-------|------|----------|------------|------------|----------|-------------|
| 1 | Financial Year | Select dropdown | Yes (auto-defaulted) | Computed via `getFinancialYearList(5)` — generates last 5 financial years (format `YYYY/YYYY`). Default = current FY based on month >= July. | Must be valid `YYYY/YYYY` format | Always editable | No |
| 2 | Month | Select dropdown | Yes (auto-defaulted) | Static list: January (1) through December (12). Default = current month. | Must be 1–12 | Always editable | No |
| 3 | Run Type | Select dropdown | Yes (defaulted) | Static: `trial-review`, `trial-run` | Must be one of the two values | Always editable | No — both options always shown |
| 4 | Handover Option | Select dropdown | Yes (defaulted) | Static: `account`, `bulk`, `rotation` | Must be one of the three values | Always editable | No — all options always shown |

**TypeScript types (from `debt.models.ts`):**
```typescript
type RunType = 'trial-review' | 'trial-run';
type HandoverOption = 'account' | 'bulk' | 'rotation';
type DistributionType = 'email' | 'sms' | 'whatsapp' | 'print' | 'all';
```

### 1.2 Section 129 Configuration Card (6 read-only display fields)

| # | Label | Type | Load Source | Editable | Conditional |
|---|-------|------|------------|----------|-------------|
| 5 | Demand Letter Template | Read-only text | `GET /api/BillingDebt/section129-config` → `demandLetterTemplate` | Never — display only | No |
| 6 | SMS Template | Read-only text | Same API → `smsTemplate` | Never — display only | No |
| 7 | Admin Fees | Read-only currency | Same API → `adminFees` (formatted as `R X.XX`) | Never — display only | No |
| 8 | Lapse Days | Read-only number | Same API → `lapseDays` | Never — display only | No |
| 9 | Interest Rate | Read-only percent | Same API → `interestRate` (formatted as `X%`) | Never — display only | No |
| 10 | Minimum Amount | Read-only currency | Same API → `minimumAmount` (formatted as `R X.XX`) | Never — display only | No |

**States**: Loading spinner shown while fetching. Error message shown if API call fails. No fallback data.

### 1.3 Filter Parameters Card (9 filter fields + 3 switches)

| # | Label | Type | Required | Load Source | Validation | Editable | Changes by Run Type / Handover Option |
|---|-------|------|----------|------------|------------|----------|---------------------------------------|
| 11 | Billing Cycle | Select dropdown | **YES** — blocks Submit | `GET /api/BillingDebt/billing-cycles` → `{id, name}[]` | Must be selected before submit | Always editable | No |
| 12 | Town | Select dropdown | No | `GET /api/BillingDebt/towns` → `{id, name}[]`. Includes "All Towns" (`__all__`) option. | None — optional filter | Always editable | No |
| 13 | Suburb | Text input | No | User typed. No autocomplete API currently. | None — free text | Always editable | No |
| 14 | Property Category | Select dropdown | No | `GET /api/BillingDebt/property-categories` → `{id, name}[]`. Includes "All Categories" option. | None — optional filter | Always editable | No |
| 15 | Account Type | Select dropdown | No | `GET /api/BillingDebt/account-types` → `{id, name}[]`. Includes "All Types" option. | None — optional filter | Always editable | No |
| 16 | Type of Person | Select dropdown | No | `GET /api/BillingDebt/person-types` → `{id, name}[]`. Includes "All" option. | None — optional filter | Always editable | No |
| 17 | Service Group Code | Text input | No | User typed | None — free text | Always editable | No |
| 18 | Ageing | Select dropdown | No | `GET /api/BillingDebt/ageing-ranges` → `{id, name}[]` | None — optional filter | Always editable | No |
| 19 | Amount Greater Than | Number input | No | User typed (decimal) | Must be a valid number ≥ 0 if entered. Parsed via `parseFloat()`. | Always editable | No |
| 20 | Include Indigents | Switch (boolean) | No (default: false) | User toggle | Boolean | Always editable | No |
| 21 | Include Pensioners | Switch (boolean) | No (default: false) | User toggle | Boolean | Always editable | No |
| 22 | Exclude Deposit Balances | Switch (boolean) | No (default: false) | User toggle | Boolean | Always editable | No |

### 1.4 Contact Details Card (3 fields)

| # | Label | Type | Required | Load Source | Validation | Editable | Conditional |
|---|-------|------|----------|------------|------------|----------|-------------|
| 23 | Contact Person | Text input | No | User typed | None — free text | Always editable | No |
| 24 | Phone | Text input | No | User typed | None — free text (should be SA phone format) | Always editable | No |
| 25 | Email | Email input | No | User typed | Should be valid email format (`type="email"`) | Always editable | No |

### 1.5 Distribution Options Card (1 radio group + 1 conditional switch)

| # | Label | Type | Required | Load Source | Validation | Editable | Conditional |
|---|-------|------|----------|------------|------------|----------|-------------|
| 26 | Distribution Type | Radio group | Yes (default: `email`) | Static options: Email, SMS, WhatsApp, Print, All | Must be one of the 5 values | Always editable | No |
| 27 | Must email accounts be printed? | Switch (boolean) | No (default: false) | User toggle | Boolean | Only when `distributionType === 'email'` | **YES** — only visible when Distribution Type = Email |

### 1.6 Generated Notice Files Grid (table + row actions)

| # | Element | Type | Data Source | Conditional |
|---|---------|------|------------|-------------|
| 28 | Runs count badge | Badge | Computed from `runs.length` | Only shown when `runs.length > 0` |
| 29 | Refresh button | Button | Re-calls `loadData()` | Always visible |
| 30 | Loading state | Spinner + text | Boolean `runsLoading` | While loading |
| 31 | Empty state | Text message | When `runs.length === 0` | When no runs |

**Grid columns:**

| Column | Source Field | Visibility |
|--------|-------------|-----------|
| Run ID | `run.runId` (formatted as `#123`) | Always |
| Status | `run.status` (badge with color from `getStatusColor()`) | Always |
| Distribution | `run.distributionType` | Always |
| Actioned By | `run.actionedBy` | Hidden on mobile (`hidden sm:table-cell`) |
| Date Created | `run.dateCreated` (formatted via `toLocaleDateString()`) | Always |
| Authorized By | `run.authorizedBy` (shows `—` if null) | Hidden medium (`hidden md:table-cell`) |
| Billing Cycle | `run.billingCycle` | Hidden large (`hidden lg:table-cell`) |
| Parameters | `run.runParameters` (truncated to 180px) | Hidden XL (`hidden xl:table-cell`) |
| Actions | Button group | Always |

**Row actions:**

| # | Action | Icon | Visible When | Handler | API Called |
|---|--------|------|-------------|---------|-----------|
| 32 | Review | Eye icon | `status === 'Trial Run Review'` OR `'Trial Review'` | Navigate to `/debt/section129/review/${runId}` | None — navigation |
| 33 | Execute Final Run | Play icon | `status` contains `'authorized'` OR `'approved'` (case-insensitive) | `handleFinalRun(runId)` | `POST /api/BillingDebt/section129-final-run` |
| 34 | Download Files | Download icon | Always | Opens file modal, calls `fetchSection129RunFiles(runId)` | `GET /api/BillingDebt/section129-run-files?runId=` |
| 35 | Remove | Trash icon | Always (currently no handler attached — dead button) | None implemented | **MISSING — needs `DELETE /api/BillingDebt/section129-delete-run`** |

**Row click behavior**: Clicking anywhere on a row navigates to trial review if status is `'Trial Run Review'` or `'Trial Review'`.

**Pagination**: Client-side, 10 rows per page. Previous/Next buttons.

### 1.7 File Modal (dialog overlay)

| # | Element | Type | Data Source | API |
|---|---------|------|------------|-----|
| 36 | File list | Scrollable card list | `GET /api/BillingDebt/section129-run-files?runId=` | Returns `Section129RunFile[]` |
| 37 | File name | Text | `file.fileName` | — |
| 38 | File type badge | Badge | `file.fileType` | — |
| 39 | File size | Text | `file.fileSize` (formatted via `formatFileSize()`) | — |
| 40 | File date | Text | `file.dateCreated` (formatted via `toLocaleDateString()`) | — |
| 41 | Download file button | Button per file | `downloadSection129File(fileId)` | `GET /api/BillingDebt/section129-download-file?fileId=` |

### 1.8 Action Buttons (bottom of page)

| # | Label | Action | Disabled When | API |
|---|-------|--------|--------------|-----|
| 42 | Submit | `handleSubmit()` | `submitting` OR `!billingCycle` | `POST /api/BillingDebt/section129-trial-run` |
| 43 | Clear | `handleClear()` | Never | None — local state reset |
| 44 | Cancel | Navigate to `/` | Never | None — navigation |

---

## 2. Page Logic

### 2.1 Page Load (`useEffect` → `loadData()`)

On mount, 8 API calls fire in parallel via `Promise.allSettled`:

```
1. fetchSection129Config()        → GET /api/BillingDebt/section129-config
2. fetchSection129Runs()          → GET /api/BillingDebt/section129-runs
3. fetchBillingCycles()           → GET /api/BillingDebt/billing-cycles
4. fetchTowns()                   → GET /api/BillingDebt/towns
5. fetchPropertyCategories()      → GET /api/BillingDebt/property-categories
6. fetchAccountTypes()            → GET /api/BillingDebt/account-types
7. fetchPersonTypes()             → GET /api/BillingDebt/person-types
8. fetchAgeingRanges()            → GET /api/BillingDebt/ageing-ranges
```

**Error handling**: Each result is checked individually. If a call fails, its data is not set and an error is logged. Other calls still succeed. Config and runs failures show error states on screen. Lookup failures result in empty dropdowns (no toast notifications for lookups).

**Defaults set before any API call:**
- `finYear`: Current financial year (July start)
- `finMonth`: Current month number as string
- `runType`: `'trial-review'`
- `handoverOption`: `'account'`
- `distributionType`: `'email'`
- All boolean switches: `false`
- All text/select filters: empty string `''`

### 2.2 Selecting Financial Year

Purely local state change (`setFinYear`). No API call triggered. The selected value is sent with the submit payload.

**Note**: The config load does NOT re-trigger when financial year changes. The config endpoint is called once on mount without a finYear parameter. This is a potential gap — config should be per-financial-year.

### 2.3 Selecting Run Type

Purely local state change (`setRunType`). No API call. The value `'trial-review'` or `'trial-run'` is sent with the submit payload.

**Frontend impact**: No conditional field visibility changes. Both run types show the same form.

### 2.4 Selecting Handover Option

Purely local state change (`setHandoverOption`). No API call. The value `'account'`, `'bulk'`, or `'rotation'` is sent with the submit payload.

**Frontend impact**: No conditional field visibility changes. When `rotation` is selected, the API is expected to use the attorney rotation configuration from the config to auto-distribute accounts.

### 2.5 Loading Config

`fetchSection129Config()` → `GET /api/BillingDebt/section129-config`

- Called once on page load
- No parameters sent (no finYear filter)
- Populates the read-only config card
- On failure: shows "Configuration could not be loaded from the API" text

### 2.6 Loading Filters (Lookup Dropdowns)

Six lookup APIs load on mount. Each returns `{id: string, name: string}[]`:

| API | Populates | EMS Source Table |
|-----|-----------|-----------------|
| `billing-cycles` | Billing Cycle dropdown | Billing cycle configuration |
| `towns` | Town dropdown | Town/area master |
| `property-categories` | Property Category dropdown | Property category lookup |
| `account-types` | Account Type dropdown | Account type lookup |
| `person-types` | Type of Person dropdown | Person type lookup |
| `ageing-ranges` | Ageing dropdown | Ageing period configuration |

### 2.7 Search / Load Generated Notice Files

`fetchSection129Runs()` → `GET /api/BillingDebt/section129-runs`

- Called on mount and after every submit/final-run action
- Currently sends NO filter parameters (no finYear, finMonth filter)
- Returns all runs for the site
- Client-side pagination (10 per page)

**Gap**: Should accept `finYear` and `finMonth` query parameters to filter server-side.

### 2.8 Submit Logic

`handleSubmit()` builds the payload and calls `POST /api/BillingDebt/section129-trial-run`:

**Frontend validation (before API call):**
- `billingCycle` must be non-empty → toast error if missing

**Payload construction:**

```typescript
{
  finYear: string,              // e.g. "2025/2026"
  finMonth: string,             // e.g. "3"
  runType: string,              // "trial-review" | "trial-run"
  billingCycle: string,         // selected billingCycleId
  town?: string,                // undefined if "__all__" or empty
  suburb?: string,              // undefined if "__all__" or empty
  propertyCategory?: string,    // undefined if "__all__" or empty
  accountType?: string,         // undefined if "__all__" or empty
  typeOfPerson?: string,        // undefined if "__all__" or empty
  serviceGroupCode?: string,    // undefined if "__all__" or empty
  ageing?: string,              // undefined if "__all__" or empty
  amountGreaterThan?: number,   // parsed float, undefined if empty
  includeIndigents: boolean,
  includePensioners: boolean,
  excludeDepositBalances: boolean,
  contactPerson?: string,       // undefined if empty
  phone?: string,               // undefined if empty
  email?: string,               // undefined if empty
  distributionType: string,     // "email"|"sms"|"whatsapp"|"print"|"all"
  mustEmailBePrinted?: boolean, // only sent when distributionType=email
  handoverOption: string,       // "account"|"bulk"|"rotation"
}
```

**Backend augmentation** (`injectAuditFields`):

```typescript
{
  ...payload,
  capturerID: number,    // session.userData.user_ID
  dateCaptured: string,  // ISO timestamp
  modifierID: number,    // session.userData.user_ID
  dateModified: string,  // ISO timestamp
}
```

**After submit**: On success toast shown, `loadData()` called to refresh config + runs.

### 2.9 Clear / Reset Logic

`handleClear()` resets:
- All filter fields to empty string
- All switches to false
- `distributionType` to `'email'`
- `mustEmailBePrinted` to false

**Does NOT reset**: `finYear`, `finMonth`, `runType`, `handoverOption` — these are considered "session context" fields.

### 2.10 Final Run Locking Logic

`handleFinalRun(runId)`:
- Sets `finalRunningId = runId` → disables the Play button for that row
- Calls `POST /api/BillingDebt/section129-final-run` with `{runId}`
- Backend adds audit fields
- On success: toast, refresh data
- On failure: toast with error
- Finally: clears `finalRunningId`

**Visibility rule**: Final Run button only appears when `run.status` contains `'authorized'` or `'approved'` (case-insensitive check via `.toLowerCase().includes()`).

---

## 3. Business Rules

| # | Rule | Where Enforced | Sync/Async |
|---|------|----------------|------------|
| BR-01 | Only one enabled Section 129 config per financial year | API — config-save must validate uniqueness | Sync |
| BR-02 | Lapse days count WORKDAYS only (exclude weekends and public holidays) | Worker — lapse period monitoring job | Async |
| BR-03 | **Account handover option**: Single account submitted, attorney selected manually | API — trial-run must accept `handoverOption='account'` and use provided attorney | Sync (initiate) + Async (process) |
| BR-04 | **Bulk handover option**: All qualifying accounts submitted to one attorney | API — trial-run with `handoverOption='bulk'` sends all qualifying to one attorney | Sync (initiate) + Async (process) |
| BR-05 | **Rotation handover option**: Qualifying accounts auto-distributed across attorneys by configured percentages | API — trial-run with `handoverOption='rotation'` reads attorney rotation config and distributes | Sync (initiate) + Async (process) |
| BR-06 | Exclude accounts already handed over to attorneys | API/Worker — trial-run account qualification must check `Billing_Handover.HandoverStatus` and exclude active handovers | Async (during qualification) |
| BR-07 | Ignore RPP (Repayment Plan) balances when calculating qualifying amount | API/Worker — must not include `Billing_RepaymentPlanArragementLetter` amounts in qualifying calculation | Async (during qualification) |
| BR-08 | Exclude accounts with active clearance certificates | API/Worker — trial-run must check clearance status and exclude | Async (during qualification) |
| BR-09 | Final run must use approved trial data — cannot re-qualify accounts | API — `section129-final-run` must only operate on runs with `TrialRunReviewStatusID = 3` (Approved) and `IsFinalReviewComplete = 1` | Sync (validation) |
| BR-10 | Distribution type determines notice delivery method: Email sends PDF via email, SMS sends text, WhatsApp sends via WhatsApp, Print generates PDF batch file, All sends via all channels | Worker — final run processing dispatches via selected channels | Async |
| BR-11 | When `distributionType='email'` and `mustEmailBePrinted=true`, email accounts ALSO get printed copies in the PDF batch | Worker — final run must dual-dispatch | Async |
| BR-12 | `billingCycle` is mandatory — frontend blocks submit if empty | Frontend | Sync |
| BR-13 | Filters with "All" selected (`__all__`) are stripped to `undefined` before sending to API | Frontend | Sync |
| BR-14 | `amountGreaterThan` must be parsed as float, not string | Frontend | Sync |
| BR-15 | Config values (demand letter template, SMS template, admin fees, lapse days, interest rate, minimum amount) are DISPLAY ONLY on this page — editing is Phase 2 | Frontend | N/A |
| BR-16 | Admin fees from config are applied per qualifying account during notice generation | Worker | Async |
| BR-17 | Interest rate from config is used to calculate interest on outstanding balance | Worker | Async |
| BR-18 | Minimum amount from config is used to exclude accounts with outstanding balance below threshold | API/Worker — qualification filter | Async |
| BR-19 | IncludeIndigent=false means accounts flagged as indigent must be excluded from the run | API/Worker — qualification filter | Async |
| BR-20 | IncludePensioners=false means accounts flagged as pensioner must be excluded from the run | API/Worker — qualification filter | Async |
| BR-21 | ExcludeDepositBalances=true means deposit credit balances must be subtracted from the outstanding amount before qualifying | API/Worker — qualification calculation | Async |
| BR-22 | A run cannot be deleted if it has been authorized or if final run has been executed | API — delete-run must check status | Sync |
| BR-23 | Only users with `PROCESS_SECTION129` permission can submit trial runs and final runs | Backend proxy | Sync |
| BR-24 | Only users with `AUTHORISE_SECTION129` permission can authorize runs (Phase 4, but permission exists) | Backend proxy | Sync |
| BR-25 | Contact details (person, phone, email) appear ON the generated Section 129 notice document as the municipality enquiry contact | Worker — PDF template merge | Async |

---

## 4. API List for This Page Only

### API-01: Load Section 129 Configuration

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/BillingDebt/section129-config` |
| **Method** | GET |
| **Purpose** | Load current Section 129 configuration for display |
| **Direct or Async** | Direct |
| **Service Bus Required** | No |
| **Worker Required** | No |
| **Source Tables** | `Billing_Section129Config` (new table) or derived from `Billing_Section129LetterOFDemand` defaults |
| **Target Tables** | None — read only |
| **Request Payload** | None (query params: optionally `finYear`) |
| **Response Payload** | `{ demandLetterTemplate: string, smsTemplate: string, adminFees: number, lapseDays: number, noticeType: string, interestRate: number, minimumAmount: number, includeIndigents: boolean, includePensioners: boolean, excludeDepositBalances: boolean }` |
| **Validations** | Auth required |
| **Error Responses** | `401 Unauthorized`, `502 Platinum unreachable` |
| **Audit Fields Written** | None |
| **Statuses Updated** | None |

### API-02: Load Section 129 Runs

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/BillingDebt/section129-runs` |
| **Method** | GET |
| **Purpose** | Load all Section 129 runs for the grid |
| **Direct or Async** | Direct |
| **Service Bus Required** | No |
| **Worker Required** | No |
| **Source Tables** | `Billing_Section129LetterOFDemand` |
| **Target Tables** | None — read only |
| **Request Payload** | Query params: optionally `finYear`, `finMonth` |
| **Response Payload** | `Section129Run[]` — see Section 5 |
| **Validations** | Auth required |
| **Error Responses** | `401 Unauthorized`, `502 Platinum unreachable` |
| **Audit Fields Written** | None |
| **Statuses Updated** | None |

### API-03: Submit Trial Run

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/BillingDebt/section129-trial-run` |
| **Method** | POST |
| **Purpose** | Create a new Section 129 run and qualify accounts |
| **Direct or Async** | **Hybrid** — Direct API creates the run record and returns immediately. Account qualification runs async if large dataset. |
| **Service Bus Required** | **Yes** — for runs with > 500 qualifying accounts |
| **Worker Required** | **Yes** — `Section129TrialRunWorker` |
| **Source Tables** | Consumer accounts, billing data, age analysis, indigent register, pensioner register, clearance register, handover register, RPP register |
| **Target Tables** | `Billing_Section129LetterOFDemand` (INSERT), `Billing_Section129LetterOFDemandDetails` (INSERT per qualifying account) |
| **Request Payload** | See Section 5.3 |
| **Response Payload** | `Section129Run` (the created run with initial status) |
| **Validations** | Permission: `PROCESS_SECTION129`. Mandatory: `billingCycle`, `finYear`, `finMonth`, `runType`, `handoverOption`, `distributionType`. Config must exist for `finYear`. |
| **Error Responses** | `400 Validation error`, `401 Unauthorized`, `403 Insufficient permissions`, `409 Config not found for financial year`, `502 Platinum unreachable` |
| **Audit Fields Written** | `CapturerID`, `DateCaptured`, `ModifierID`, `DateModified` on `Billing_Section129LetterOFDemand` |
| **Statuses Updated** | New run: `RunType` set. `TrialRunReviewStatusID` = NULL (Draft/Processing). |

### API-04: Submit Final Run

| Field | Value |
|-------|-------|
| **Endpoint** | `POST /api/BillingDebt/section129-final-run` |
| **Method** | POST |
| **Purpose** | Execute final notice generation and distribution for an approved run |
| **Direct or Async** | **Hybrid** — Direct API validates and updates status. Actual notice generation and distribution is async. |
| **Service Bus Required** | **Yes** — always |
| **Worker Required** | **Yes** — `Section129FinalRunWorker` |
| **Source Tables** | `Billing_Section129LetterOFDemand`, `Billing_Section129LetterOFDemandDetails`, `Billing_LetterTemplates`, consumer account data |
| **Target Tables** | `Billing_Section129LetterOFDemand` (UPDATE status), `Billing_Section129RunFiles` (new — INSERT generated files) |
| **Request Payload** | `{ runId: number }` + injected audit fields |
| **Response Payload** | `{ success: boolean, message: string }` |
| **Validations** | Permission: `PROCESS_SECTION129`. Run must exist. `TrialRunReviewStatusID` must be 3 (Approved). `IsFinalReviewComplete` must be true. Run must not already be in FINAL_RUNNING or FINAL_COMPLETE state. |
| **Error Responses** | `400 Run not approved`, `401 Unauthorized`, `403 Insufficient permissions`, `404 Run not found`, `409 Run already completed`, `502 Platinum unreachable` |
| **Audit Fields Written** | `ModifierID`, `DateModified` on `Billing_Section129LetterOFDemand` |
| **Statuses Updated** | `FinalRunReviewStatusID` = 1 (Processing). Worker later sets = 2 (Complete) and `IsFinalReviewComplete` = 1. |

### API-05: Load Run Files

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/BillingDebt/section129-run-files` |
| **Method** | GET |
| **Purpose** | Get list of generated files for a specific run |
| **Direct or Async** | Direct |
| **Service Bus Required** | No |
| **Worker Required** | No |
| **Source Tables** | `Billing_Section129RunFiles` (new table) or file system path from `Billing_Section129LetterOFDemand.PDFPath`, `ExcelPath`, `ZIPFilePath` |
| **Target Tables** | None — read only |
| **Request Payload** | Query: `runId=number` |
| **Response Payload** | `Section129RunFile[]` — see Section 5 |
| **Validations** | Auth required. `runId` must be valid integer. |
| **Error Responses** | `401 Unauthorized`, `404 Run not found`, `502 Platinum unreachable` |
| **Audit Fields Written** | None |
| **Statuses Updated** | None |

### API-06: Download File

| Field | Value |
|-------|-------|
| **Endpoint** | `GET /api/BillingDebt/section129-download-file` |
| **Method** | GET |
| **Purpose** | Stream a generated file (PDF/Excel/ZIP) to the client |
| **Direct or Async** | Direct |
| **Service Bus Required** | No |
| **Worker Required** | No |
| **Source Tables** | File system / blob storage referenced by `Billing_Section129RunFiles` or `Billing_Section129LetterOFDemand.PDFPath` |
| **Target Tables** | None |
| **Request Payload** | Query: `fileId=number|string` |
| **Response Payload** | Binary stream with `Content-Type` (application/pdf, application/vnd.openxmlformats, application/zip) and `Content-Disposition` headers |
| **Validations** | Auth required. `fileId` must be valid. |
| **Error Responses** | `401 Unauthorized`, `404 File not found`, `502 Platinum unreachable` |
| **Audit Fields Written** | None |
| **Statuses Updated** | None |

### API-07 through API-12: Lookup APIs

| API | Endpoint | Method | Purpose | Source Table |
|-----|----------|--------|---------|-------------|
| API-07 | `GET /api/BillingDebt/billing-cycles` | GET | Load billing cycle options | Billing cycle config |
| API-08 | `GET /api/BillingDebt/towns` | GET | Load town/area options | Town master |
| API-09 | `GET /api/BillingDebt/property-categories` | GET | Load property category options | Property category lookup |
| API-10 | `GET /api/BillingDebt/account-types` | GET | Load account type options | Account type lookup |
| API-11 | `GET /api/BillingDebt/person-types` | GET | Load person type options | Person type lookup |
| API-12 | `GET /api/BillingDebt/ageing-ranges` | GET | Load ageing period options | Ageing config |

All lookups:
- Method: GET
- Direct, no Service Bus, no Worker
- Auth required
- Response: `{ id: string, name: string }[]`
- No audit fields
- No status updates

### API-13: Delete Run (MISSING — needs implementation)

| Field | Value |
|-------|-------|
| **Endpoint** | `DELETE /api/BillingDebt/section129-delete-run` |
| **Method** | DELETE |
| **Purpose** | Remove a Section 129 run that has not been authorized or completed |
| **Direct or Async** | Direct |
| **Service Bus Required** | No |
| **Worker Required** | No |
| **Source Tables** | `Billing_Section129LetterOFDemand`, `Billing_Section129LetterOFDemandDetails` |
| **Target Tables** | Same (DELETE or soft-delete) |
| **Request Payload** | `{ runId: number }` or Query: `runId=number` |
| **Response Payload** | `{ success: boolean, message: string }` |
| **Validations** | Permission: `PROCESS_SECTION129`. Run must exist. Run must NOT be Authorized, Final Running, or Final Complete. |
| **Error Responses** | `400 Cannot delete authorized/completed run`, `401 Unauthorized`, `403 Insufficient permissions`, `404 Run not found` |
| **Audit Fields Written** | None (hard delete) or `ModifierID`, `DateModified` (soft delete) |
| **Statuses Updated** | Record removed or marked inactive |

---

## 5. Swagger-Ready Contracts

### 5.1 Section129Config (Response — API-01)

```json
// Schema
{
  "type": "object",
  "required": ["demandLetterTemplate", "smsTemplate", "adminFees", "lapseDays", "interestRate", "minimumAmount"],
  "properties": {
    "demandLetterTemplate": { "type": "string", "description": "Name of the selected Section 129 letter template" },
    "smsTemplate": { "type": "string", "description": "Name of the selected SMS notification template" },
    "adminFees": { "type": "number", "format": "decimal", "description": "Administrative fee per notice in ZAR" },
    "lapseDays": { "type": "integer", "description": "Number of workdays for the lapse period" },
    "noticeType": { "type": "string", "description": "Type of notice (e.g., 'Section 129')" },
    "interestRate": { "type": "number", "format": "decimal", "description": "Interest rate percentage applied to outstanding balance" },
    "minimumAmount": { "type": "number", "format": "decimal", "description": "Minimum outstanding amount for qualification in ZAR" },
    "includeIndigents": { "type": "boolean", "description": "Default: include indigent accounts" },
    "includePensioners": { "type": "boolean", "description": "Default: include pensioner accounts" },
    "excludeDepositBalances": { "type": "boolean", "description": "Default: exclude deposit balances from calculation" }
  }
}
```

**Example success response:**
```json
{
  "demandLetterTemplate": "Section 129 Standard Letter",
  "smsTemplate": "S129 SMS Notification v2",
  "adminFees": 150.00,
  "lapseDays": 14,
  "noticeType": "Section 129",
  "interestRate": 10.25,
  "minimumAmount": 500.00,
  "includeIndigents": false,
  "includePensioners": false,
  "excludeDepositBalances": true
}
```

### 5.2 Section129Run (Response item — API-02)

```json
// Schema
{
  "type": "object",
  "required": ["runId", "status", "runType"],
  "properties": {
    "runId": { "type": "integer", "description": "Unique run identifier (maps to LetterOfDemand_ID)" },
    "status": { "type": "string", "enum": ["Draft", "Processing", "Trial Review", "Trial Run Review", "Approved", "Authorized", "Declined", "Final Running", "Final Complete"], "description": "Current run status" },
    "distributionType": { "type": "string", "enum": ["Email", "SMS", "WhatsApp", "Print", "All"] },
    "actionedBy": { "type": "string", "description": "Username of person who created the run" },
    "dateCreated": { "type": "string", "format": "date-time", "description": "ISO 8601 timestamp" },
    "authorizedBy": { "type": "string", "nullable": true, "description": "Username of authorizer, null if not yet authorized" },
    "billingCycle": { "type": "string", "description": "Billing cycle name" },
    "runParameters": { "type": "string", "description": "Summary of filter parameters applied" },
    "runType": { "type": "string", "enum": ["trial-review", "trial-run"] },
    "totalAccounts": { "type": "integer", "description": "Number of qualifying accounts in this run" },
    "totalAmount": { "type": "number", "format": "decimal", "description": "Total outstanding amount across qualifying accounts" }
  }
}
```

**Example success response (array):**
```json
[
  {
    "runId": 1042,
    "status": "Trial Review",
    "distributionType": "Email",
    "actionedBy": "Jeandre Pretorius",
    "dateCreated": "2026-03-09T14:30:00.000Z",
    "authorizedBy": null,
    "billingCycle": "Monthly - March 2026",
    "runParameters": "Town: George, Ageing: 90+ days, Amount > R500",
    "runType": "trial-review",
    "totalAccounts": 1247,
    "totalAmount": 2845620.50
  },
  {
    "runId": 1041,
    "status": "Final Complete",
    "distributionType": "All",
    "actionedBy": "Admin User",
    "dateCreated": "2026-02-15T09:00:00.000Z",
    "authorizedBy": "Supervisor",
    "billingCycle": "Monthly - February 2026",
    "runParameters": "All Towns, All Categories",
    "runType": "trial-run",
    "totalAccounts": 3502,
    "totalAmount": 7123450.00
  }
]
```

### 5.3 TrialRun Request (API-03)

```json
// Request Schema
{
  "type": "object",
  "required": ["finYear", "finMonth", "runType", "billingCycle", "distributionType", "handoverOption"],
  "properties": {
    "finYear": { "type": "string", "pattern": "^\\d{4}/\\d{4}$", "example": "2025/2026" },
    "finMonth": { "type": "string", "pattern": "^([1-9]|1[0-2])$", "example": "3" },
    "runType": { "type": "string", "enum": ["trial-review", "trial-run"] },
    "billingCycle": { "type": "string", "description": "Billing cycle ID" },
    "handoverOption": { "type": "string", "enum": ["account", "bulk", "rotation"] },
    "distributionType": { "type": "string", "enum": ["email", "sms", "whatsapp", "print", "all"] },
    "town": { "type": "string", "nullable": true, "description": "Town ID filter. Omit or null for all." },
    "suburb": { "type": "string", "nullable": true, "description": "Suburb name filter (free text). Omit or null for all." },
    "propertyCategory": { "type": "string", "nullable": true, "description": "Property category ID filter" },
    "accountType": { "type": "string", "nullable": true, "description": "Account type ID filter" },
    "typeOfPerson": { "type": "string", "nullable": true, "description": "Person type ID filter" },
    "serviceGroupCode": { "type": "string", "nullable": true, "description": "Service group code filter" },
    "ageing": { "type": "string", "nullable": true, "description": "Ageing period ID filter" },
    "amountGreaterThan": { "type": "number", "nullable": true, "description": "Minimum qualifying amount in ZAR" },
    "includeIndigents": { "type": "boolean", "default": false },
    "includePensioners": { "type": "boolean", "default": false },
    "excludeDepositBalances": { "type": "boolean", "default": false },
    "contactPerson": { "type": "string", "nullable": true, "description": "Enquiry contact name for the notice" },
    "phone": { "type": "string", "nullable": true, "description": "Enquiry phone number for the notice" },
    "email": { "type": "string", "format": "email", "nullable": true, "description": "Enquiry email for the notice" },
    "mustEmailBePrinted": { "type": "boolean", "nullable": true, "description": "Only relevant when distributionType=email. Print copies for email accounts." }
  }
}
```

**Example request:**
```json
{
  "finYear": "2025/2026",
  "finMonth": "3",
  "runType": "trial-review",
  "billingCycle": "5",
  "handoverOption": "rotation",
  "distributionType": "email",
  "town": "1",
  "propertyCategory": "3",
  "ageing": "90",
  "amountGreaterThan": 500.00,
  "includeIndigents": false,
  "includePensioners": false,
  "excludeDepositBalances": true,
  "contactPerson": "J. Smith",
  "phone": "044 801 9111",
  "email": "debt@george.gov.za",
  "mustEmailBePrinted": true
}
```

**Backend augments before forwarding to Platinum:**
```json
{
  "...all above fields...",
  "capturerID": 209,
  "dateCaptured": "2026-03-09T14:30:00.000Z",
  "modifierID": 209,
  "dateModified": "2026-03-09T14:30:00.000Z"
}
```

**Example success response:**
```json
{
  "runId": 1043,
  "status": "Processing",
  "distributionType": "Email",
  "actionedBy": "Jeandre Pretorius",
  "dateCreated": "2026-03-09T14:30:00.000Z",
  "authorizedBy": null,
  "billingCycle": "Monthly - March 2026",
  "runParameters": "Town: George, Ageing: 90+ days, Amount > R500",
  "runType": "trial-review",
  "totalAccounts": 0,
  "totalAmount": 0
}
```

**Example validation error:**
```json
// 400 Bad Request
{
  "message": "Validation failed",
  "errors": [
    { "field": "billingCycle", "message": "Billing cycle is required" },
    { "field": "finYear", "message": "Financial year must be in format YYYY/YYYY" }
  ]
}
```

**Example dependency error:**
```json
// 409 Conflict
{
  "message": "No Section 129 configuration found for financial year 2025/2026. Please configure Section 129 settings first.",
  "code": "CONFIG_NOT_FOUND"
}
```

**Example permission error:**
```json
// 403 Forbidden
{
  "message": "Insufficient permissions: PROCESS_SECTION129 required"
}
```

### 5.4 FinalRun Request (API-04)

```json
// Request Schema
{
  "type": "object",
  "required": ["runId"],
  "properties": {
    "runId": { "type": "integer", "description": "ID of the approved run to finalize" }
  }
}
```

**Example request:**
```json
{ "runId": 1042 }
```

**Backend augments:**
```json
{
  "runId": 1042,
  "capturerID": 209,
  "dateCaptured": "2026-03-09T16:00:00.000Z",
  "modifierID": 209,
  "dateModified": "2026-03-09T16:00:00.000Z"
}
```

**Example success response:**
```json
{ "success": true, "message": "Final run submitted. Notice generation has been queued." }
```

**Example validation error (run not approved):**
```json
// 400 Bad Request
{
  "message": "Run #1042 has not been approved. Current status: Trial Review. Final run requires approved trial review.",
  "code": "RUN_NOT_APPROVED"
}
```

**Example conflict error (already completed):**
```json
// 409 Conflict
{
  "message": "Run #1042 final run has already been completed. Cannot re-execute.",
  "code": "FINAL_ALREADY_COMPLETE"
}
```

### 5.5 Section129RunFile (Response item — API-05)

```json
// Schema
{
  "type": "object",
  "required": ["fileId", "fileName", "fileType", "fileSize"],
  "properties": {
    "fileId": { "type": "integer", "description": "Unique file identifier" },
    "fileName": { "type": "string", "description": "Original file name including extension" },
    "fileType": { "type": "string", "enum": ["PDF", "XLSX", "ZIP", "CSV"], "description": "File format" },
    "fileSize": { "type": "integer", "description": "File size in bytes" },
    "dateCreated": { "type": "string", "format": "date-time", "description": "When the file was generated" }
  }
}
```

**Example response:**
```json
[
  {
    "fileId": 5001,
    "fileName": "Section129_George_Mar2026_Batch1.pdf",
    "fileType": "PDF",
    "fileSize": 2456789,
    "dateCreated": "2026-03-09T16:45:00.000Z"
  },
  {
    "fileId": 5002,
    "fileName": "Section129_George_Mar2026_AccountList.xlsx",
    "fileType": "XLSX",
    "fileSize": 345678,
    "dateCreated": "2026-03-09T16:45:00.000Z"
  },
  {
    "fileId": 5003,
    "fileName": "Section129_George_Mar2026_All.zip",
    "fileType": "ZIP",
    "fileSize": 12345678,
    "dateCreated": "2026-03-09T16:46:00.000Z"
  }
]
```

### 5.6 Lookup Response (API-07 through API-12)

```json
// Schema (same for all lookups)
{
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "name"],
    "properties": {
      "id": { "type": "string", "description": "Lookup item ID" },
      "name": { "type": "string", "description": "Display label" }
    }
  }
}
```

**Example (billing cycles):**
```json
[
  { "id": "1", "name": "Monthly - January 2026" },
  { "id": "2", "name": "Monthly - February 2026" },
  { "id": "3", "name": "Monthly - March 2026" },
  { "id": "5", "name": "Bi-Monthly - Jan/Feb 2026" }
]
```

**Example (ageing ranges):**
```json
[
  { "id": "30", "name": "30 Days" },
  { "id": "60", "name": "60 Days" },
  { "id": "90", "name": "90 Days" },
  { "id": "120", "name": "120+ Days" }
]
```

### 5.7 DeleteRun Request (API-13 — NEW)

```json
// Request Schema
{
  "type": "object",
  "required": ["runId"],
  "properties": {
    "runId": { "type": "integer", "description": "ID of the run to delete" }
  }
}
```

**Example request:**
```json
{ "runId": 1040 }
```

**Example success response:**
```json
{ "success": true, "message": "Run #1040 has been removed." }
```

**Example validation error:**
```json
// 400 Bad Request
{
  "message": "Cannot delete run #1040. Run has been authorized and cannot be removed.",
  "code": "CANNOT_DELETE_AUTHORIZED"
}
```

### 5.8 Common Error Responses (all APIs)

```json
// 401 Unauthorized
{ "message": "Authentication required" }

// 502 Bad Gateway
{ "message": "Platinum API unreachable", "detail": "Connection refused" }

// 502 Bad Gateway (API error passthrough)
{ "message": "Platinum API error", "detail": "Internal server error on downstream" }
```

---

## 6. Database Mapping

### 6.1 Existing Tables Reused

#### `Billing_Section129LetterOFDemand` — Main run record

| Column | Type | Used By | Read/Write | Maps To |
|--------|------|---------|-----------|---------|
| `LetterOfDemand_ID` | `INT IDENTITY` | API-02, API-03, API-04, API-05 | R+W | `Section129Run.runId` |
| `RunType` | `INT` | API-03 | W | `runType` (1=trial-review, 2=trial-run) |
| `HandOverOptionId` | `INT` | API-03 | W | `handoverOption` (1=account, 2=bulk, 3=rotation) |
| `AttorneyId` | `INT` | API-03 (when `handoverOption='account'`) | W | Attorney for single-account handover |
| `AddiTypeId` | `INT` | API-03 | W | Additional billing type from config |
| `ExecutionDate` | `DATETIME` | API-04 | W | Set when final run executed |
| `Email` | `BIT` | API-03 | W | `distributionType` includes email |
| `SMS` | `BIT` | API-03 | W | `distributionType` includes SMS |
| `PrintLetter` | `BIT` | API-03 | W | `distributionType` includes print |
| `PrintEmailAccount` | `BIT` | API-03 | W | `mustEmailBePrinted` |
| `SMSNotification` | `BIT` | API-03 | W | SMS notification flag |
| `PeriodId` | `INT` | API-03 | W | `finMonth` mapped to period |
| `BillingCycleID` | `INT` | API-03 | W | `billingCycle` |
| `DemandLetter` | `NVARCHAR(500)` | API-03 | W | Template path from config |
| `AdminFee` | `DECIMAL(18,2)` | API-03 | W | From config |
| `IncludeIndigent` | `BIT` | API-03 | W | `includeIndigents` |
| `ExcludeDepositBalances` | `BIT` | API-03 | W | `excludeDepositBalances` |
| `TownId` | `INT` | API-03 | W | `town` filter |
| `SuburbId` | `INT` | API-03 | W | `suburb` filter (needs lookup to ID) |
| `SubSuburbId` | `INT` | API-03 | W | Not used by frontend |
| `PropertyCategoryId` | `INT` | API-03 | W | `propertyCategory` |
| `AccountTypeId` | `INT` | API-03 | W | `accountType` |
| `TypeOfPersonId` | `INT` | API-03 | W | `typeOfPerson` |
| `MagisterialDistrictId` | `INT` | API-03 | W | Not used by frontend |
| `ServiceGroupID` | `INT` | API-03 | W | `serviceGroupCode` |
| `Ageing` | `INT` | API-03 | W | `ageing` |
| `AmountGreaterThen` | `DECIMAL(18,2)` | API-03 | W | `amountGreaterThan` |
| `LapseDays` | `INT` | API-03 | W | From config |
| `ExcelPath` | `NVARCHAR(500)` | API-05 | R | Generated Excel file path |
| `PDFPath` | `NVARCHAR(500)` | API-05 | R | Generated PDF file path |
| `FileName` | `NVARCHAR(500)` | API-05 | R | Generated file name |
| `PostingId` | `UNIQUEIDENTIFIER` | Worker | W | Batch posting reference |
| `DateCaptured` | `DATETIME` | API-03 | W | Audit: creation timestamp |
| `CapturerID` | `INT` | API-03 | W | Audit: creator user ID |
| `DateModified` | `DATETIME` | API-03, API-04 | W | Audit: last modified |
| `ModifierID` | `INT` | API-03, API-04 | W | Audit: modifier user ID |
| `FinancialYear` | `NVARCHAR(9)` | API-03 | W | `finYear` |
| `EnquirieName` | `VARCHAR(50)` | API-03 | W | `contactPerson` |
| `EnquiryPhone` | `VARCHAR(50)` | API-03 | W | `phone` |
| `EnquiryEmail` | `VARCHAR(50)` | API-03 | W | `email` |
| `TrialRunReviewStatusID` | `INT` | API-02, API-03, API-04 | R+W | Trial review status (NULL=draft, 1=pending, 2=under review, 3=approved, 4=declined) |
| `TrialRunReviewerID` | `INT` | Phase 4 (authorize) | W | Reviewer user ID |
| `TrialRunReviewDate` | `DATETIME` | Phase 4 (authorize) | W | Review timestamp |
| `TrialRunReviewerNotes` | `NVARCHAR(350)` | Phase 4 (authorize) | W | Reviewer notes |
| `FinalRunReviewStatusID` | `INT` | API-04 | W | Final run status (1=processing, 2=complete) |
| `FinalRunReviewerID` | `INT` | API-04 | W | Final reviewer user ID |
| `FinalRunReviewDate` | `DATETIME` | API-04 | W | Final review timestamp |
| `FinalRunReviewerNotes` | `NVARCHAR(350)` | API-04 | W | Final notes |
| `IsFinalReviewComplete` | `BIT` | API-04 | W | Set to 1 when final complete |
| `ZIPFilePath` | `NVARCHAR(500)` | API-05 | R | Generated ZIP file path |

#### `Billing_Section129LetterOFDemandDetails` — Account detail per run

| Column | Type | Used By | Read/Write | Maps To |
|--------|------|---------|-----------|---------|
| `LetterOFDemandDetails_ID` | `INT IDENTITY` | Worker | W | Auto-generated |
| `LetterOfDemandID` | `INT` (FK) | Worker, API-05 | W+R | Links to `LetterOfDemand_ID` |
| `AccountId` | `INT` | Worker | W | Qualifying account ID |
| `OutStandingAmount` | `DECIMAL(18,2)` | Worker | W | Outstanding balance at time of qualification |
| `Posted` | `INT` | Worker | W | Posting status |
| `DatePosted` | `DATETIME` | Worker | W | When posted |
| `IsPaid` | `BIT` | Worker | W | Whether paid since notice |
| `PaidAmount` | `DECIMAL(18,2)` | Worker | W | Amount paid |
| `TotalBalance` | `DECIMAL(18,2)` | Worker | W | Total account balance |
| `CurrentBalance` | `DECIMAL(18,2)` | Worker | W | Current period balance |
| `BalanceDue` | `DECIMAL(18,2)` | Worker | W | Amount due for notice |

#### `Billing_LetterTemplates` — Notice templates

| Column | Type | Used By | Read/Write | Maps To |
|--------|------|---------|-----------|---------|
| `Template_Id` | `INT IDENTITY` | API-01 (config) | R | Template ID |
| `TemplateName` | `NVARCHAR(50)` | API-01 (config) | R | `demandLetterTemplate` display name |
| `NoticeTypeID` | `INT` | API-01 (config) | R | Filter: Section 129 type only |
| `TemplateFileName` | `NVARCHAR(150)` | Worker | R | Physical file for merge |

#### `Billing_LetterTypes` — Notice type lookup

| Column | Type | Used By | Read/Write | Maps To |
|--------|------|---------|-----------|---------|
| `NoticeType_Id` | `INT` | Template filter | R | Join key |
| `NoticeTypeDescription` | `NVARCHAR(50)` | Template filter | R | E.g., "Section 129 Letter" |

#### `Billing_Handover` — Active handover check (exclusion rule BR-06)

| Column | Type | Used By | Read/Write |
|--------|------|---------|-----------|
| `AccountId` | `INT` | Worker | R — check if account already handed over |
| `HandoverStatus` | `INT` | Worker | R — exclude if status = Active (2) |

#### `Const_Attorney` — Attorney data (for rotation/single handover)

| Column | Type | Used By | Read/Write |
|--------|------|---------|-----------|
| `Attorney_ID` | `INT` | API-03 (when rotation or account) | R |
| `AttorneyDesc` | `NVARCHAR(200)` | Config display | R |
| `Commission` | `NUMERIC(18,2)` | Worker | R |
| `Enabled` | `BIT` | Filter | R — only active attorneys |

### 6.2 Missing Fields on Existing Tables

| Table | Missing Field | Type | Why | Which API |
|-------|--------------|------|-----|-----------|
| `Billing_Section129LetterOFDemand` | `IncludePensioners` | `BIT NULL DEFAULT 0` | Frontend sends `includePensioners` switch. No column exists. | API-03 writes |
| `Billing_Section129LetterOFDemand` | `WhatsApp` | `BIT NULL DEFAULT 0` | Frontend sends `distributionType='whatsapp'`. No column to store this. | API-03 writes |

**ALTER statements needed:**
```sql
ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
ADD [IncludePensioners] [bit] NULL DEFAULT 0;

ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
ADD [WhatsApp] [bit] NULL DEFAULT 0;
```

### 6.3 New Tables Needed

#### `Billing_Section129RunFiles`

| Why | The existing table stores paths (`PDFPath`, `ExcelPath`, `ZIPFilePath`) on the run header. This works for simple runs but doesn't support multiple file batches (e.g., 3000 accounts split into 6 PDF files of 500 each). A file table allows the API to return a proper file list. |
|-----|---|

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `File_ID` | `INT IDENTITY(1,1) NOT NULL` | No | Primary key |
| `LetterOfDemandID` | `INT NOT NULL` | No | FK to `Billing_Section129LetterOFDemand.LetterOfDemand_ID` |
| `FileName` | `NVARCHAR(500) NOT NULL` | No | Display filename |
| `FileType` | `NVARCHAR(10) NOT NULL` | No | PDF, XLSX, ZIP, CSV |
| `FileSize` | `BIGINT NULL` | Yes | File size in bytes |
| `FilePath` | `NVARCHAR(500) NOT NULL` | No | Server/blob storage path |
| `DateCreated` | `DATETIME NOT NULL` | No | Generation timestamp |

| API | Operation |
|-----|-----------|
| Worker (final run) | INSERT — writes file records after generation |
| API-05 (`section129-run-files`) | SELECT — reads files for a run |
| API-06 (`section129-download-file`) | SELECT — looks up file path by ID |

```sql
CREATE TABLE [dbo].[Billing_Section129RunFiles](
  [File_ID] [int] IDENTITY(1,1) NOT NULL,
  [LetterOfDemandID] [int] NOT NULL,
  [FileName] [nvarchar](500) NOT NULL,
  [FileType] [nvarchar](10) NOT NULL,
  [FileSize] [bigint] NULL,
  [FilePath] [nvarchar](500) NOT NULL,
  [DateCreated] [datetime] NOT NULL DEFAULT GETDATE(),
  CONSTRAINT [PK_Billing_Section129RunFiles] PRIMARY KEY CLUSTERED ([File_ID] ASC),
  CONSTRAINT [FK_Section129RunFiles_LetterOFDemand] FOREIGN KEY ([LetterOfDemandID])
    REFERENCES [dbo].[Billing_Section129LetterOFDemand]([LetterOfDemand_ID])
);
```

**Alternative**: If Platinum API can return file lists from the existing path fields, this table may not be needed. Confirm with API team.

---

## 7. Sync vs Async Matrix

| # | Action | Frontend | Direct API | Service Bus | Worker | Database Write | Status Update |
|---|--------|----------|-----------|-------------|--------|---------------|---------------|
| 1 | Page load — fetch config | `loadData()` | `GET section129-config` | No | No | No | No |
| 2 | Page load — fetch runs | `loadData()` | `GET section129-runs` | No | No | No | No |
| 3 | Page load — fetch billing cycles | `loadData()` | `GET billing-cycles` | No | No | No | No |
| 4 | Page load — fetch towns | `loadData()` | `GET towns` | No | No | No | No |
| 5 | Page load — fetch property categories | `loadData()` | `GET property-categories` | No | No | No | No |
| 6 | Page load — fetch account types | `loadData()` | `GET account-types` | No | No | No | No |
| 7 | Page load — fetch person types | `loadData()` | `GET person-types` | No | No | No | No |
| 8 | Page load — fetch ageing ranges | `loadData()` | `GET ageing-ranges` | No | No | No | No |
| 9 | Submit trial run | `handleSubmit()` | `POST section129-trial-run` | **Yes** (if >500 accounts) | **Yes** — `Section129TrialRunWorker` | **Yes** — INSERT into `Billing_Section129LetterOFDemand` + INSERT into `..Details` per account | `TrialRunReviewStatusID` set |
| 10 | Execute final run | `handleFinalRun()` | `POST section129-final-run` | **Yes** — always | **Yes** — `Section129FinalRunWorker` | **Yes** — UPDATE `Billing_Section129LetterOFDemand` + INSERT into `Billing_Section129RunFiles` | `FinalRunReviewStatusID` set |
| 11 | Open file modal | `handleOpenFileModal()` | `GET section129-run-files` | No | No | No | No |
| 12 | Download file | `handleDownloadFile()` | `GET section129-download-file` | No | No | No | No |
| 13 | Refresh runs | `loadData()` | `GET section129-runs` | No | No | No | No |
| 14 | Clear form | `handleClear()` | None | No | No | No | No |
| 15 | Cancel (navigate home) | `setLocation('/')` | None | No | No | No | No |
| 16 | Click run row (review) | `handleRowClick()` | None (navigation) | No | No | No | No |
| 17 | Remove run | Dead button (no handler) | **MISSING** — needs `DELETE section129-delete-run` | No | No | **Yes** — DELETE or soft-delete | Status removed |

---

## 8. Status and Audit Mapping

### 8.1 Status Lifecycle for a Section 129 Run

```
CREATE (API-03) → [Draft/Processing]
                      ↓
              Worker completes qualification
                      ↓
              [Trial Review] or [Trial Run Complete]
                      ↓
              Reviewer selects accounts (Phase 3)
                      ↓
              [Under Review → Approved] or [Declined] (Phase 4)
                      ↓
              Final Run triggered (API-04)
                      ↓
              [Final Running]
                      ↓
              Worker generates notices
                      ↓
              [Final Complete]
```

### 8.2 Status Detail

| Status | EMS Column | Value | Set By | When |
|--------|-----------|-------|--------|------|
| Draft / Processing | `TrialRunReviewStatusID` | `NULL` | API-03 (`section129-trial-run`) | On initial run creation |
| Trial Review / Trial Run Review | `TrialRunReviewStatusID` | `1` | Worker (`Section129TrialRunWorker`) | When qualification completes |
| Under Review | `TrialRunReviewStatusID` | `2` | Phase 3 API (`section129-trial-review-submit`) | When reviewer starts selecting accounts |
| Approved / Authorized | `TrialRunReviewStatusID` | `3` | Phase 4 API (`section129-authorize`) | When supervisor approves |
| Declined | `TrialRunReviewStatusID` | `4` | Phase 4 API (`section129-authorize`) | When supervisor declines |
| Final Running | `FinalRunReviewStatusID` | `1` | API-04 (`section129-final-run`) | When final run initiated |
| Final Complete | `FinalRunReviewStatusID` | `2` + `IsFinalReviewComplete` = `1` | Worker (`Section129FinalRunWorker`) | When all notices generated and dispatched |

### 8.3 Audit Fields per Step

| Step | `CapturerID` | `DateCaptured` | `ModifierID` | `DateModified` | `TrialRunReviewerID` | `TrialRunReviewDate` | `TrialRunReviewerNotes` | `FinalRunReviewerID` | `FinalRunReviewDate` |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Submit Trial Run (API-03) | ✅ SET | ✅ SET | ✅ SET | ✅ SET | — | — | — | — | — |
| Trial Review Submit (Phase 3) | — | — | ✅ UPDATE | ✅ UPDATE | ✅ SET | ✅ SET | — | — | — |
| Authorize (Phase 4) | — | — | ✅ UPDATE | ✅ UPDATE | ✅ SET | ✅ SET | ✅ SET | — | — |
| Final Run (API-04) | — | — | ✅ UPDATE | ✅ UPDATE | — | — | — | ✅ SET | ✅ SET |
| Worker completes final | — | — | ✅ UPDATE | ✅ UPDATE | — | — | — | — | — |

---

## 9. Open Gaps / Blockers

| # | Gap | Type | Severity | Impact | Resolution |
|---|-----|------|----------|--------|------------|
| G-01 | **Remove button has no handler** | Frontend + API | **HIGH** | Trash icon button exists but does nothing. No `DELETE` or `POST` endpoint for deleting a run. | API team must create `DELETE /api/BillingDebt/section129-delete-run`. Frontend needs handler wired up. |
| G-02 | **`IncludePensioners` column missing** | DB Schema | **MEDIUM** | Frontend sends `includePensioners` but EMS table `Billing_Section129LetterOFDemand` has no column. Value will be lost. | Add `IncludePensioners BIT NULL DEFAULT 0` to table. |
| G-03 | **`WhatsApp` column missing** | DB Schema | **MEDIUM** | Frontend sends `distributionType='whatsapp'` but EMS table has no `WhatsApp` bit field. Only `Email`, `SMS`, `PrintLetter` exist. | Add `WhatsApp BIT NULL DEFAULT 0` to table. |
| G-04 | **`section129-runs` returns ALL runs unfiltered** | API | **MEDIUM** | No `finYear` or `finMonth` query parameters are sent. As data grows, this will return thousands of rows. | API should accept and filter by `finYear`, `finMonth`. Frontend already sends these in the submit payload but not in the GET call. |
| G-05 | **Config not loaded per financial year** | API/Frontend | **LOW** | `fetchSection129Config()` is called without `finYear` parameter. If config differs per financial year, the wrong config may display. | Either: (a) API returns config for current FY, or (b) frontend passes `finYear` query param. |
| G-06 | **`section129-run-files` new table vs existing path fields** | DB Schema | **MEDIUM** | Frontend expects an array of file objects with `fileId`, `fileName`, `fileType`, `fileSize`, `dateCreated`. EMS table only stores `PDFPath`, `ExcelPath`, `ZIPFilePath` strings. | Either: (a) Create `Billing_Section129RunFiles` table (recommended), or (b) API constructs file array from path fields. |
| G-07 | **Suburb is free text — no lookup API** | Frontend | **LOW** | Suburb uses `<Input>` not `<Select>`. No autocomplete or validation. EMS column is `SuburbId` (INT) not a string. | Either: (a) Add suburb lookup API `GET /api/BillingDebt/suburbs?townId=`, or (b) Keep free text and have API do fuzzy match. |
| G-08 | **`ServiceGroupCode` vs `ServiceGroupID` mismatch** | Data Model | **LOW** | Frontend sends free text `serviceGroupCode`. EMS column is `ServiceGroupID` (INT). | API must resolve text code to ID, or frontend should send INT from a lookup dropdown. |
| G-09 | **`finYear` and `finMonth` sent in trial-run payload but not in API function signature** | Frontend Type | **LOW** | `submitSection129TrialRun` TypeScript function signature doesn't include `finYear` and `finMonth`, but `handleSubmit()` adds them to the params object. TypeScript won't catch missing fields. | Update the function signature type to include `finYear: string` and `finMonth: string` as required. |
| G-10 | **No async status polling for large trial runs** | API | **MEDIUM** | When trial run is submitted for a large dataset, the API returns immediately but there's no polling mechanism to check when the worker completes. Frontend just calls `loadData()` once after submit. | Either: (a) Add `GET /api/BillingDebt/section129-run-status?runId=` for polling, or (b) Frontend polls `section129-runs` with interval until status changes from "Processing". |
| G-11 | **`finMonth` type is string on frontend but `PeriodId` is INT on EMS** | Data Model | **LOW** | Frontend sends `"3"` for March. EMS stores `PeriodId` as INT. API must parse string to int. | API handles type conversion. Document the mapping. |

---

## 10. Final Implementation Pack

| Feature | Endpoint | Method | Direct or Async | Service Bus | Worker | Tables Used | DB Changes Needed | Swagger Ready | Blocked |
|---------|----------|--------|----------------|-------------|--------|------------|-------------------|---------------|---------|
| Load Config | `/api/BillingDebt/section129-config` | GET | Direct | No | No | Config source (see G-05) | None | ✅ Yes (5.1) | No |
| Load Runs | `/api/BillingDebt/section129-runs` | GET | Direct | No | No | `Billing_Section129LetterOFDemand` | None — but should add `finYear`/`finMonth` filter support (G-04) | ✅ Yes (5.2) | No |
| Submit Trial Run | `/api/BillingDebt/section129-trial-run` | POST | Hybrid | Yes (>500 accounts) | `Section129TrialRunWorker` | `Billing_Section129LetterOFDemand`, `..Details`, consumer data tables | Add `IncludePensioners` BIT (G-02), Add `WhatsApp` BIT (G-03) | ✅ Yes (5.3) | **Yes — G-02, G-03** |
| Execute Final Run | `/api/BillingDebt/section129-final-run` | POST | Hybrid | Yes (always) | `Section129FinalRunWorker` | `Billing_Section129LetterOFDemand`, `..Details`, `Billing_LetterTemplates`, `Billing_Section129RunFiles` | New table `Billing_Section129RunFiles` (G-06) | ✅ Yes (5.4) | **Yes — G-06** |
| Load Run Files | `/api/BillingDebt/section129-run-files` | GET | Direct | No | No | `Billing_Section129RunFiles` (new) or path fields | New table `Billing_Section129RunFiles` (G-06) | ✅ Yes (5.5) | **Yes — G-06** |
| Download File | `/api/BillingDebt/section129-download-file` | GET | Direct | No | No | File system / blob storage | None | ✅ Yes (binary) | No |
| Load Billing Cycles | `/api/BillingDebt/billing-cycles` | GET | Direct | No | No | Billing cycle config | None | ✅ Yes (5.6) | No |
| Load Towns | `/api/BillingDebt/towns` | GET | Direct | No | No | Town master | None | ✅ Yes (5.6) | No |
| Load Property Categories | `/api/BillingDebt/property-categories` | GET | Direct | No | No | Property category lookup | None | ✅ Yes (5.6) | No |
| Load Account Types | `/api/BillingDebt/account-types` | GET | Direct | No | No | Account type lookup | None | ✅ Yes (5.6) | No |
| Load Person Types | `/api/BillingDebt/person-types` | GET | Direct | No | No | Person type lookup | None | ✅ Yes (5.6) | No |
| Load Ageing Ranges | `/api/BillingDebt/ageing-ranges` | GET | Direct | No | No | Ageing config | None | ✅ Yes (5.6) | No |
| Delete Run | `/api/BillingDebt/section129-delete-run` | DELETE | Direct | No | No | `Billing_Section129LetterOFDemand`, `..Details` | None | ✅ Yes (5.7) | **Yes — G-01 (API does not exist)** |

### Blockers Summary

| Blocker | What is Blocked | Effort | Owner |
|---------|----------------|--------|-------|
| G-01: Delete Run API missing | Remove button on grid | Small — single endpoint | API Team |
| G-02: `IncludePensioners` column | Trial run persisting pensioner flag | Small — ALTER TABLE | DBA |
| G-03: `WhatsApp` column | Trial run persisting WhatsApp distribution | Small — ALTER TABLE | DBA |
| G-06: Run Files table | File listing and download | Medium — new table + API logic | DBA + API Team |

### Non-Blockers (Improvements to schedule)

| Item | Priority | Owner |
|------|----------|-------|
| G-04: Filter runs by finYear/finMonth | Medium | API Team |
| G-05: Config per financial year | Low | API Team |
| G-07: Suburb lookup API | Low | API Team |
| G-08: ServiceGroupCode→ID resolution | Low | API Team |
| G-09: Fix TypeScript function signature | Low | Frontend |
| G-10: Async status polling | Medium | API Team + Frontend |
| G-11: finMonth string→int mapping | Low | API Team |

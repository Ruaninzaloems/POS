# Phase 1 — Section 129 Notices: API Developer Handover

> **Scope**: Section 129 Notices page only (`/debt/section129`)
> **Platinum controller**: `BillingDebt`
> **Permission constants**: `PROCESS_SECTION129`, `AUTHORISE_SECTION129`

---

## 1. API List

| # | Endpoint | Method | Purpose | Auth | Permission | Direct/Async |
|---|----------|--------|---------|------|------------|-------------|
| 1 | `/api/BillingDebt/section129-config` | GET | Load active config for display | Token | — | Direct |
| 2 | `/api/BillingDebt/section129-runs` | GET | List all runs for the grid | Token | — | Direct |
| 3 | `/api/BillingDebt/section129-trial-run` | POST | Create a new trial run | Token | `PROCESS_SECTION129` | Hybrid (sync create → async worker) |
| 4 | `/api/BillingDebt/section129-final-run` | POST | Execute final notice generation | Token | `PROCESS_SECTION129` | Hybrid (sync validate → async worker) |
| 5 | `/api/BillingDebt/section129-run-files` | GET | List generated files for a run | Token | — | Direct |
| 6 | `/api/BillingDebt/section129-download-file` | GET | Stream binary file to client | Token | — | Direct |
| 7 | `/api/BillingDebt/section129-delete-run` | DELETE | Remove a draft/declined run | Token | `PROCESS_SECTION129` | Direct |
| 8 | `/api/BillingDebt/billing-cycles` | GET | Billing cycle lookup | Token | — | Direct |
| 9 | `/api/BillingDebt/towns` | GET | Town lookup | Token | — | Direct |
| 10 | `/api/BillingDebt/property-categories` | GET | Property category lookup | Token | — | Direct |
| 11 | `/api/BillingDebt/account-types` | GET | Account type lookup | Token | — | Direct |
| 12 | `/api/BillingDebt/person-types` | GET | Person type lookup | Token | — | Direct |
| 13 | `/api/BillingDebt/ageing-ranges` | GET | Ageing period lookup | Token | — | Direct |

Lookups 8–13 all return `{ id: string, name: string }[]`.

---

## 2. Swagger Request / Response Schemas

### API 1 — GET section129-config

**Query**: `?finYear=2025/2026` (optional)

**Response 200:**
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

### API 2 — GET section129-runs

**Query**: `?finYear=2025/2026&finMonth=3` (both optional, currently unfiltered)

**Response 200:**
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
  }
]
```

### API 3 — POST section129-trial-run

**Request body:**
```json
{
  "finYear": "2025/2026",
  "finMonth": "3",
  "runType": "trial-review",
  "billingCycle": "5",
  "handoverOption": "rotation",
  "distributionType": "email",
  "town": "1",
  "suburb": null,
  "propertyCategory": "3",
  "accountType": null,
  "typeOfPerson": null,
  "serviceGroupCode": null,
  "ageing": "90",
  "amountGreaterThan": 500.00,
  "includeIndigents": false,
  "includePensioners": false,
  "excludeDepositBalances": true,
  "contactPerson": "J. Smith",
  "phone": "044 801 9111",
  "email": "debt@george.gov.za",
  "mustEmailBePrinted": true,
  "capturerID": 209,
  "dateCaptured": "2026-03-09T14:30:00.000Z",
  "modifierID": 209,
  "dateModified": "2026-03-09T14:30:00.000Z"
}
```

**Response 200:**
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

**Error 400:** `{ "message": "Validation failed", "errors": [{ "field": "billingCycle", "message": "Billing cycle is required" }] }`
**Error 403:** `{ "message": "Insufficient permissions: PROCESS_SECTION129 required" }`
**Error 409:** `{ "message": "No Section 129 configuration found for financial year 2025/2026" }`

### API 4 — POST section129-final-run

**Request body:**
```json
{
  "runId": 1042,
  "capturerID": 209,
  "dateCaptured": "2026-03-09T16:00:00.000Z",
  "modifierID": 209,
  "dateModified": "2026-03-09T16:00:00.000Z"
}
```

**Response 200:** `{ "success": true, "message": "Final run submitted. Notice generation has been queued." }`
**Error 400:** `{ "message": "Run #1042 has not been approved. Current status: Trial Review." }`
**Error 409:** `{ "message": "Run #1042 final run has already been completed." }`

### API 5 — GET section129-run-files

**Query**: `?runId=1042`

**Response 200:**
```json
[
  { "fileId": 5001, "fileName": "Section129_Mar2026_Batch1.pdf", "fileType": "PDF", "fileSize": 2456789, "dateCreated": "2026-03-09T16:45:00.000Z" },
  { "fileId": 5002, "fileName": "Section129_Mar2026_AccountList.xlsx", "fileType": "XLSX", "fileSize": 345678, "dateCreated": "2026-03-09T16:45:00.000Z" }
]
```

### API 6 — GET section129-download-file

**Query**: `?fileId=5001`
**Response**: Binary stream. Headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="Section129_Mar2026_Batch1.pdf"`

### API 7 — DELETE section129-delete-run (NEW)

**Query or body**: `?runId=1040` or `{ "runId": 1040 }`
**Response 200:** `{ "success": true, "message": "Run #1040 has been removed." }`
**Error 400:** `{ "message": "Cannot delete run #1040. Run has been authorized." }`

---

## 3. Validation Rules

### API 3 — Trial Run Submission

| Field | Rule | Error |
|-------|------|-------|
| `finYear` | Required. Format `YYYY/YYYY`. | 400 — "Financial year is required" |
| `finMonth` | Required. String `"1"` to `"12"`. | 400 — "Month is required" |
| `runType` | Required. Must be `"trial-review"` or `"trial-run"`. | 400 — "Invalid run type" |
| `billingCycle` | Required. Must resolve to valid `BillingCycleID`. | 400 — "Billing cycle is required" |
| `handoverOption` | Required. Must be `"account"`, `"bulk"`, or `"rotation"`. | 400 — "Invalid handover option" |
| `distributionType` | Required. Must be `"email"`, `"sms"`, `"whatsapp"`, `"print"`, or `"all"`. | 400 — "Invalid distribution type" |
| `amountGreaterThan` | Optional. If present, must be numeric ≥ 0. | 400 — "Amount must be a positive number" |
| `email` | Optional. If present, must be valid email format. | 400 — "Invalid email format" |
| Config existence | Config must exist for the given `finYear`. | 409 — "No configuration found" |

### API 4 — Final Run

| Field | Rule | Error |
|-------|------|-------|
| `runId` | Required. Must resolve to existing run. | 404 — "Run not found" |
| Run status | `TrialRunReviewStatusID` must be 3 (Approved). | 400 — "Run not approved" |
| Review complete | `IsFinalReviewComplete` must be true (via Phase 3). | 400 — "Trial review not complete" |
| Not already running | `FinalRunReviewStatusID` must not be 1 or 2. | 409 — "Final run already in progress or complete" |

### API 7 — Delete Run

| Field | Rule | Error |
|-------|------|-------|
| `runId` | Required. Must resolve to existing run. | 404 — "Run not found" |
| Run status | Must NOT be Approved (3), Final Running (FinalRunReviewStatusID=1), or Final Complete (FinalRunReviewStatusID=2). | 400 — "Cannot delete authorized/completed run" |

---

## 4. Status Transitions

```
section129-trial-run (API 3)
  └─ INSERT: TrialRunReviewStatusID = NULL (Processing)
       │
       ▼
  Worker completes qualification
  └─ UPDATE: TrialRunReviewStatusID = 1 (Trial Review)
       │
       ▼
  section129-trial-review-submit (Phase 3)
  └─ UPDATE: TrialRunReviewStatusID = 2 (Under Review)
       │
       ▼
  section129-authorize (Phase 4)
  ├─ Approve: TrialRunReviewStatusID = 3 (Approved)
  └─ Decline: TrialRunReviewStatusID = 4 (Declined)
       │ (Approved only)
       ▼
  section129-final-run (API 4)
  └─ UPDATE: FinalRunReviewStatusID = 1 (Final Running)
       │
       ▼
  Worker completes notice generation
  └─ UPDATE: FinalRunReviewStatusID = 2, IsFinalReviewComplete = 1 (Final Complete)
```

**Status enum mapping:**

| `TrialRunReviewStatusID` | `FinalRunReviewStatusID` | Frontend Label |
|:---:|:---:|---|
| NULL | NULL | Processing |
| 1 | NULL | Trial Review |
| 2 | NULL | Under Review |
| 3 | NULL | Approved |
| 4 | NULL | Declined |
| 3 | 1 | Final Running |
| 3 | 2 (+ `IsFinalReviewComplete=1`) | Final Complete |

---

## 5. Audit Fields

Injected by the proxy layer before forwarding to Platinum. Source: authenticated session.

### Standard audit (all POST endpoints)

| Field | Value | Column |
|-------|-------|--------|
| `capturerID` | `session.userData.user_ID` | `CapturerID` |
| `dateCaptured` | `new Date().toISOString()` | `DateCaptured` |
| `modifierID` | `session.userData.user_ID` | `ModifierID` |
| `dateModified` | `new Date().toISOString()` | `DateModified` |

### Review audit (authorize endpoint — Phase 4, included for reference)

| Field | Value | Column |
|-------|-------|--------|
| `reviewerID` | `session.userData.user_ID` | `TrialRunReviewerID` or `FinalRunReviewerID` |
| `reviewDate` | `new Date().toISOString()` | `TrialRunReviewDate` or `FinalRunReviewDate` |

### Per-step audit matrix

| Step | `CapturerID` | `DateCaptured` | `ModifierID` | `DateModified` | `ReviewerID` | `ReviewDate` |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Trial run (API 3) | SET | SET | SET | SET | — | — |
| Final run (API 4) | — | — | UPDATE | UPDATE | SET (Final) | SET (Final) |
| Delete run (API 7) | — | — | — | — | — | — |

---

## 6. DB Changes Required

### ALTER — Add missing columns

```sql
ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
  ADD [IncludePensioners] [bit] NULL DEFAULT 0;

ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
  ADD [WhatsApp] [bit] NULL DEFAULT 0;
```

### CREATE — New file tracking table

```sql
CREATE TABLE [dbo].[Billing_Section129RunFiles](
  [File_ID]           INT IDENTITY(1,1) NOT NULL,
  [LetterOfDemandID]  INT NOT NULL,
  [FileName]          NVARCHAR(500) NOT NULL,
  [FileType]          NVARCHAR(10) NOT NULL,
  [FileSize]          BIGINT NULL,
  [FilePath]          NVARCHAR(500) NOT NULL,
  [DateCreated]       DATETIME NOT NULL DEFAULT GETDATE(),
  CONSTRAINT [PK_Billing_Section129RunFiles] PRIMARY KEY CLUSTERED ([File_ID]),
  CONSTRAINT [FK_Section129RunFiles_LetterOFDemand]
    FOREIGN KEY ([LetterOfDemandID])
    REFERENCES [dbo].[Billing_Section129LetterOFDemand]([LetterOfDemand_ID])
);
```

### Field mapping — Trial Run payload → EMS columns

| Payload Field | EMS Column | Type | Notes |
|---------------|-----------|------|-------|
| `finYear` | `FinancialYear` | NVARCHAR(9) | Direct map |
| `finMonth` | `PeriodId` | INT | Parse string → int |
| `runType` | `RunType` | INT | `trial-review`→1, `trial-run`→2 |
| `billingCycle` | `BillingCycleID` | INT | Parse string → int |
| `handoverOption` | `HandOverOptionId` | INT | `account`→1, `bulk`→2, `rotation`→3 |
| `distributionType` | `Email`, `SMS`, `WhatsApp`, `PrintLetter` | BIT each | `email`→Email=1; `sms`→SMS=1; `whatsapp`→WhatsApp=1; `print`→PrintLetter=1; `all`→all=1 |
| `mustEmailBePrinted` | `PrintEmailAccount` | BIT | Only when Email=1 |
| `town` | `TownId` | INT | Parse string → int, NULL if omitted |
| `suburb` | `SuburbId` | INT | Resolve text → ID or store NULL |
| `propertyCategory` | `PropertyCategoryId` | INT | Parse string → int, NULL if omitted |
| `accountType` | `AccountTypeId` | INT | Parse string → int, NULL if omitted |
| `typeOfPerson` | `TypeOfPersonId` | INT | Parse string → int, NULL if omitted |
| `serviceGroupCode` | `ServiceGroupID` | INT | Resolve code → ID, NULL if omitted |
| `ageing` | `Ageing` | INT | Parse string → int, NULL if omitted |
| `amountGreaterThan` | `AmountGreaterThen` | DECIMAL(18,2) | NULL if omitted |
| `includeIndigents` | `IncludeIndigent` | BIT | Direct map |
| `includePensioners` | `IncludePensioners` | BIT | **New column** |
| `excludeDepositBalances` | `ExcludeDepositBalances` | BIT | Direct map |
| `contactPerson` | `EnquirieName` | VARCHAR(50) | NULL if omitted |
| `phone` | `EnquiryPhone` | VARCHAR(50) | NULL if omitted |
| `email` | `EnquiryEmail` | VARCHAR(50) | NULL if omitted |

---

## 7. Service Bus Commands

| Command | Queue | Triggered By | Payload | Worker |
|---------|-------|-------------|---------|--------|
| `Section129TrialRunProcess` | `section129-trial-run` | API 3 (after INSERT) | `{ runId: number, finYear: string, billingCycleId: number, filters: {...} }` | `Section129TrialRunWorker` |
| `Section129FinalRunProcess` | `section129-final-run` | API 4 (after status update) | `{ runId: number }` | `Section129FinalRunWorker` |

**When to use Service Bus**: Trial run always queues to Service Bus (account qualification is heavy). Final run always queues to Service Bus (PDF generation + dispatch is heavy).

**When NOT to use Service Bus**: All GET endpoints, delete run, and all lookups are direct synchronous responses.

---

## 8. Worker Jobs

### Worker 1: `Section129TrialRunWorker`

| Field | Detail |
|-------|--------|
| **Trigger** | Service Bus message `Section129TrialRunProcess` |
| **Input** | `{ runId }` |
| **Steps** | 1. Read run record from `Billing_Section129LetterOFDemand` |
| | 2. Query consumer accounts matching all filter criteria |
| | 3. For each account: check not already handed over (`Billing_Handover.HandoverStatus ≠ 2`), check no active clearance, check no RPP balance, check indigent/pensioner flags, check `amountGreaterThan` threshold, check ageing period |
| | 4. Apply deposit balance exclusion if `ExcludeDepositBalances = 1` |
| | 5. INSERT qualifying accounts into `Billing_Section129LetterOFDemandDetails` |
| | 6. UPDATE run: `TrialRunReviewStatusID = 1`, total accounts, total amount |
| **Output** | Run status updated to Trial Review |
| **Error handling** | On failure: log error, set run status to a failed state or leave as Processing for retry |

### Worker 2: `Section129FinalRunWorker`

| Field | Detail |
|-------|--------|
| **Trigger** | Service Bus message `Section129FinalRunProcess` |
| **Input** | `{ runId }` |
| **Steps** | 1. Read run + details from `Billing_Section129LetterOFDemand` + `..Details` |
| | 2. Read letter template from `Billing_LetterTemplates` |
| | 3. For each qualifying account (or batch of N per config `noticesPerFile`): merge template with account data, generate PDF |
| | 4. Generate Excel summary of all accounts |
| | 5. ZIP all files if multiple batches |
| | 6. INSERT file records into `Billing_Section129RunFiles` |
| | 7. Dispatch via selected channels: Email (attach PDF), SMS (send text), WhatsApp (send message), Print (no dispatch — files only) |
| | 8. Post admin fee journal entries per account (`AdditionalBillingID`) |
| | 9. UPDATE run: `FinalRunReviewStatusID = 2`, `IsFinalReviewComplete = 1`, `ExecutionDate = NOW()` |
| **Output** | Run status updated to Final Complete, files available for download |
| **Error handling** | On partial failure: log per-account errors, continue with remaining. Set overall status based on success rate. |

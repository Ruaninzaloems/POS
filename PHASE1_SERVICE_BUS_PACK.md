# Phase 1 — Section 129 Notices: Service Bus & Worker Pack

---

## 1. Which Endpoints Trigger Service Bus

| Endpoint | Method | Trigger Condition | Queue |
|----------|--------|------------------|-------|
| `/api/BillingDebt/section129-trial-run` | POST | Always — after INSERT into `Billing_Section129LetterOFDemand` succeeds | `section129-trial-run` |
| `/api/BillingDebt/section129-final-run` | POST | Always — after status validation passes and `FinalRunReviewStatusID` set to 1 | `section129-final-run` |

No other Phase 1 endpoint uses Service Bus. All GETs, lookups, file downloads, and delete-run are synchronous.

---

## 2. Queue / Command Definitions

### Queue 1: `section129-trial-run`

| Field | Value |
|-------|-------|
| **Queue Name** | `section129-trial-run` |
| **Command** | `Section129TrialRunProcess` |
| **Publisher** | `POST /api/BillingDebt/section129-trial-run` |
| **Consumer** | `Section129TrialRunWorker` |
| **Concurrency** | 1 per site (sequential — prevents duplicate qualification) |
| **Max Delivery Count** | 3 |
| **Lock Duration** | 5 minutes |
| **Message TTL** | 24 hours |

### Queue 2: `section129-final-run`

| Field | Value |
|-------|-------|
| **Queue Name** | `section129-final-run` |
| **Command** | `Section129FinalRunProcess` |
| **Publisher** | `POST /api/BillingDebt/section129-final-run` |
| **Consumer** | `Section129FinalRunWorker` |
| **Concurrency** | 1 per site (sequential — prevents file generation conflicts) |
| **Max Delivery Count** | 3 |
| **Lock Duration** | 30 minutes (PDF generation is slow for large batches) |
| **Message TTL** | 24 hours |

---

## 3. Message Payloads

### Message 1: `Section129TrialRunProcess`

```json
{
  "command": "Section129TrialRunProcess",
  "runId": 1043,
  "siteId": "george",
  "finYear": "2025/2026",
  "billingCycleId": 5,
  "periodId": 3,
  "runType": 1,
  "handoverOptionId": 3,
  "filters": {
    "townId": 1,
    "suburbId": null,
    "propertyCategoryId": 3,
    "accountTypeId": null,
    "typeOfPersonId": null,
    "serviceGroupId": null,
    "ageing": 90,
    "amountGreaterThan": 500.00,
    "includeIndigent": false,
    "includePensioners": false,
    "excludeDepositBalances": true
  },
  "config": {
    "adminFee": 150.00,
    "interestRate": 10.25,
    "minimumAmount": 500.00,
    "lapseDays": 14,
    "templateId": 12
  },
  "userId": 209,
  "timestamp": "2026-03-09T14:30:00.000Z"
}
```

### Message 2: `Section129FinalRunProcess`

```json
{
  "command": "Section129FinalRunProcess",
  "runId": 1043,
  "siteId": "george",
  "distribution": {
    "email": true,
    "sms": false,
    "whatsApp": false,
    "print": false,
    "printEmailAccount": true
  },
  "contact": {
    "name": "J. Smith",
    "phone": "044 801 9111",
    "email": "debt@george.gov.za"
  },
  "config": {
    "templateId": 12,
    "smsTemplateId": 5,
    "noticesPerFile": 500,
    "adminFee": 150.00,
    "lapseDays": 14
  },
  "userId": 209,
  "timestamp": "2026-03-09T16:00:00.000Z"
}
```

---

## 4. Worker Responsibilities

### Worker 1: `Section129TrialRunWorker`

**Purpose**: Qualify consumer accounts against filter criteria and populate the run details table.

| Step | Action | Tables | Notes |
|------|--------|--------|-------|
| 1 | Read run record | `Billing_Section129LetterOFDemand` | Get all filter parameters |
| 2 | Query candidate accounts | Consumer account tables, billing data | Filter by: `BillingCycleID`, `TownId`, `PropertyCategoryId`, `AccountTypeId`, `TypeOfPersonId`, `ServiceGroupID`, `Ageing` |
| 3 | Exclude handed-over accounts | `Billing_Handover` | WHERE `HandoverStatus = 2` (Active) — exclude these accounts |
| 4 | Exclude active clearances | Clearance register | Accounts with active clearance certificates — exclude |
| 5 | Exclude RPP balances | `Billing_RepaymentPlanArragementLetter` | Do not count RPP amounts in qualifying total |
| 6 | Apply indigent filter | Indigent register | If `IncludeIndigent = 0`, exclude indigent-flagged accounts |
| 7 | Apply pensioner filter | Pensioner register | If `IncludePensioners = 0`, exclude pensioner-flagged accounts |
| 8 | Apply deposit exclusion | Deposit balances | If `ExcludeDepositBalances = 1`, subtract deposit credit from outstanding |
| 9 | Apply minimum amount | Calculated balance | Exclude accounts with qualifying amount < `config.minimumAmount` |
| 10 | Apply amount-greater-than | Calculated balance | If set, exclude accounts with qualifying amount < `amountGreaterThan` |
| 11 | INSERT qualifying accounts | `Billing_Section129LetterOFDemandDetails` | One row per qualifying account with `OutStandingAmount`, `TotalBalance`, `CurrentBalance`, `BalanceDue` |
| 12 | UPDATE run status | `Billing_Section129LetterOFDemand` | Set `TrialRunReviewStatusID = 1`, update totals |

### Worker 2: `Section129FinalRunWorker`

**Purpose**: Generate notice documents, dispatch via selected channels, post admin fee journals, and register files.

| Step | Action | Tables | Notes |
|------|--------|--------|-------|
| 1 | Read run + details | `Billing_Section129LetterOFDemand`, `..Details` | Get all qualifying accounts and distribution flags |
| 2 | Load letter template | `Billing_LetterTemplates` | Get template file by `templateId` |
| 3 | Load SMS template | SMS template source | Get SMS text template by `smsTemplateId` |
| 4 | Generate PDF notices | Template merge engine | Merge template with each account's data. Batch into files of `noticesPerFile` (e.g. 500 per PDF). Include contact details on each notice. |
| 5 | Generate Excel summary | — | All qualifying accounts with key columns |
| 6 | Generate ZIP archive | — | If multiple PDF batches, ZIP them together |
| 7 | Register files | `Billing_Section129RunFiles` | INSERT one row per generated file (PDF batch, Excel, ZIP) |
| 8 | Dispatch — Email | Email service | For accounts with email: attach individual PDF notice |
| 9 | Dispatch — SMS | SMS gateway | For accounts with mobile: send SMS text from template |
| 10 | Dispatch — WhatsApp | WhatsApp Business API | For accounts with mobile: send WhatsApp message |
| 11 | Dispatch — Print | No dispatch | PDF batch files are available for download only |
| 12 | Post admin fee journals | Billing journal tables | Post `AdminFee` per account as additional billing entry |
| 13 | UPDATE run status | `Billing_Section129LetterOFDemand` | Set `FinalRunReviewStatusID = 2`, `IsFinalReviewComplete = 1`, `ExecutionDate = GETDATE()` |

---

## 5. Success Status Updates

### Trial Run Worker — Success

| Column | Before | After |
|--------|--------|-------|
| `TrialRunReviewStatusID` | `NULL` | `1` (Trial Review) |
| `ModifierID` | original | worker system user ID |
| `DateModified` | original | current timestamp |

Run is now visible in grid with status "Trial Review" and accounts are available for review (Phase 3).

### Final Run Worker — Success

| Column | Before | After |
|--------|--------|-------|
| `FinalRunReviewStatusID` | `1` (Final Running) | `2` (Final Complete) |
| `IsFinalReviewComplete` | `NULL` or `0` | `1` |
| `ExecutionDate` | `NULL` | current timestamp |
| `PDFPath` | `NULL` | path to first/main PDF |
| `ExcelPath` | `NULL` | path to Excel summary |
| `ZIPFilePath` | `NULL` | path to ZIP archive (if applicable) |
| `ModifierID` | original | worker system user ID |
| `DateModified` | original | current timestamp |

Files are now available via `GET section129-run-files`. Run shows status "Final Complete" in grid.

---

## 6. Failure Status Updates

### Trial Run Worker — Failure

| Column | Before | After |
|--------|--------|-------|
| `TrialRunReviewStatusID` | `NULL` | `NULL` (remains Processing) |
| `ModifierID` | original | worker system user ID |
| `DateModified` | original | current timestamp |

**Behaviour**: Status stays as Processing. After max retries exhausted (see Section 7), move to dead-letter queue. The run appears stuck as "Processing" in the frontend grid.

**Recommended**: Add a `TrialRunReviewStatusID = 5` value for "Failed" so the frontend can show an error state and the user can re-submit or delete the run.

### Final Run Worker — Failure

**Partial failure** (some accounts dispatched, some failed):

| Column | Before | After |
|--------|--------|-------|
| `FinalRunReviewStatusID` | `1` | `1` (remains Final Running) |

Worker should log per-account errors and continue processing remaining accounts. Only set to Complete after all accounts processed. Failed dispatches should be logged for manual retry.

**Total failure** (cannot process at all — template missing, DB error, etc.):

| Column | Before | After |
|--------|--------|-------|
| `FinalRunReviewStatusID` | `1` | `1` (remains Final Running) |

After max retries exhausted, move to dead-letter queue. The run appears stuck as "Final Running".

**Recommended**: Add a `FinalRunReviewStatusID = 3` value for "Failed" so the frontend can show an error state.

---

## 7. Retry Behaviour

### Trial Run Worker

| Setting | Value | Reason |
|---------|-------|--------|
| Max delivery count | 3 | Account qualification is idempotent — safe to retry |
| Retry delay | 30 seconds (1st), 2 minutes (2nd) | Exponential backoff |
| Idempotency | Worker must DELETE existing `..Details` rows for this `runId` before re-inserting | Prevents duplicate account rows on retry |
| Dead-letter | After 3 failed attempts, message moves to `section129-trial-run/$deadletter` | Manual investigation required |
| Dead-letter action | Alert operations team. Run stays as "Processing" until manually resolved or deleted. | — |

### Final Run Worker

| Setting | Value | Reason |
|---------|-------|--------|
| Max delivery count | 3 | File generation and dispatch are partially idempotent |
| Retry delay | 1 minute (1st), 5 minutes (2nd) | Longer backoff — external services (email/SMS) may be temporarily down |
| Idempotency | Worker must check `Billing_Section129RunFiles` — skip file generation if files already exist for this `runId`. For dispatch, track per-account delivery status to avoid duplicate sends. | Prevents duplicate PDFs and double-sends |
| Dead-letter | After 3 failed attempts, message moves to `section129-final-run/$deadletter` | Manual investigation required |
| Dead-letter action | Alert operations team. Check which accounts were dispatched. Run stays as "Final Running" until manually resolved. | — |

### Dead-Letter Queue Monitoring

Both queues should have dead-letter monitoring configured:
- Alert via email/SMS to operations team when a message hits the dead-letter queue
- Include `runId`, `siteId`, error details, and attempt count in the alert
- Provide a manual re-queue mechanism for resolved issues

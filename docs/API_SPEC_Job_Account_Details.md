# Platinum API Bug Report & Required Fixes — Direct Deposit Allocation

**Prepared for:** Platinum Inzalo EMS API Development Team
**Date:** 06 March 2026
**Priority:** High
**Affected module:** `billing-direct-deposit-allocation` / `BulkProgress`

---

## Bug 1: `paymentTypeID` always stored as 3 (Credit Card) — should be 5 (EFT)

**Severity:** High
**Endpoint:** `POST /api/billing-direct-deposit-allocation/submit-details-data`
**Also visible in:** `GET /api/BulkProgress/get-bulk-allocation-list`

### Problem

When the POS submits a direct deposit allocation via `submit-details-data`, we send `paymentTypeId: 5` (EFT) in the request body. However, the job record stored by the API always has `paymentTypeID: 3` (Credit Card).

Direct deposits are bank EFT transactions by definition — they can never be credit card payments. The API appears to ignore the `paymentTypeId` field in the submission payload and default to `3`.

### Evidence

**What we send (request body):**
```json
{
  "posItemId": 2692,
  "reconId": 16858,
  "userId": -1,
  "paymentTypeId": 5,
  "billType": "4",
  "reference": "0",
  ...
}
```

**What the API stores (from `get-bulk-allocation-list` response):**
```json
{
  "directDepositJob_ID": 26135,
  "paymentTypeID": 3,
  "process": "Miscellaneous Payment",
  "posItemID": 2692,
  ...
}
```

### Expected Behaviour

The API should store `paymentTypeID: 5` (EFT) when `paymentTypeId: 5` is sent in the submission. All direct deposit allocations are EFT by nature.

### Questions for Developer

1. Does `submit-details-data` expect the field as `paymentTypeId` (camelCase) or `PaymentTypeId` (PascalCase) or `paymentTypeID` (with capital ID)?
2. Is the `paymentTypeID` hardcoded to `3` somewhere in the allocation processing logic?
3. If the field is intentionally ignored, should all direct deposit jobs default to `5` (EFT) instead of `3` (Credit Card)?

---

## Bug 2: `paymentReference` constructed from `lastName` + `initials` instead of `reference` field

**Severity:** High
**Endpoint:** `POST /api/billing-direct-deposit-allocation/submit-details-data`
**Also visible in:** `GET /api/BulkProgress/get-bulk-allocation-list`

### Problem

For Miscellaneous Payment (billType `4` / Direct Income) allocations, the API constructs the `paymentReference` stored in the job record from the `initials` and `lastName` fields of the submission, rather than from the `reference` field.

This produces garbage references. For example, when we submit an allocation to the "Building Control - Additional Tariff - Penalty" misc group, the name derivation produces `lastName: "Building"` and `initials: "C-AT-P"`, and the API stores `paymentReference: "C-AT-P Building"` instead of the actual bank reference.

### Evidence

**What we send (request body):**
```json
{
  "posItemId": 2692,
  "reference": "0",
  "lastName": "MAGTAPE CREDIT USER 9663 SEQ/Erf Number: 1925 Area: GEORGE",
  "initials": "",
  "description": "Building Control - Additional Tariff - Penalty",
  ...
}
```
*(Note: We have now fixed our side to send the actual bank note as `lastName` and the bank reference as `reference`. But the API should use the `reference` field for `paymentReference`, not construct it from name fields.)*

**What the API previously stored (from `get-bulk-allocation-list` response):**
```json
{
  "directDepositJob_ID": 26135,
  "paymentReference": "C-AT-P Building",
  ...
}
```

### Expected Behaviour

The `paymentReference` in the job record should come from the `reference` field in the submission payload — NOT from `initials` + `lastName`.

For the example above, `paymentReference` should be `"0"` (the actual bank reference value sent in the `reference` field).

### POS-Side Fix Already Applied

We have corrected our submission to:
- Send `reference` = the actual POS item bank reference (`transaction.reference`)
- Send `lastName` = the bank note/description (e.g. `"MAGTAPE CREDIT USER 9663..."`)
- Send `initials` = empty string for DIRECT/GROUP types (no longer derived from group name)

This mitigates the worst of the garbage, but the API should still be fixed to use the `reference` field as the canonical source for `paymentReference`.

---

## Bug 3: `DirectDepositErrors/account-details/{jobId}` returns empty for completed jobs

**Severity:** High
**Endpoint:** `GET /api/DirectDepositErrors/account-details/{jobId}`

### Problem

The existing endpoint `GET /api/DirectDepositErrors/account-details/{jobId}` only returns data for jobs that have **error** status. When called for successfully completed jobs, it returns an empty array `[]`.

The POS Allocation History needs to display the full list of allocated accounts for any job — regardless of whether it completed successfully, partially, or with errors. This is required for audit trails.

### Test Case

- **Job ID:** `26134`, **POS Item:** `2675` — a completed Consumer Services allocation that returns `[]`
- **Job ID:** `26135`, **POS Item:** `2692` — a completed Miscellaneous Payment allocation that returns `[]`

### Recommended Fix

**New endpoint** (cleanest separation of concerns):

```
GET /api/BulkProgress/job-account-details/{jobId}
```

**Why a new endpoint instead of modifying the existing one:**

- `DirectDepositErrors/account-details` has a clear semantic meaning — it returns error details. Changing it to also return successes could break its contract and impact other consumers.
- `BulkProgress` is the correct service group for job progress/status queries (it already hosts `direct-deposit/{jobId}`, `get-bulk-allocation-list`, etc.).
- A new endpoint avoids any risk of breaking existing error-handling workflows that depend on `DirectDepositErrors`.

### Response Specification

```
GET /api/BulkProgress/job-account-details/{jobId}
```

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `jobId` | Path | `integer` | Yes | The `directDepositJob_ID` of the allocation job |

**Authentication:** Bearer token (same as all existing endpoints)

#### Response — Success (200 OK)

```json
[
  {
    "accountNo": "100234",
    "accountName": "J VAN DER MERWE",
    "allocatedAmount": 1500.00,
    "status": "Success",
    "errorMessage": null
  },
  {
    "accountNo": "200891",
    "accountName": "M JACOBS",
    "allocatedAmount": 500.00,
    "status": "Error",
    "errorMessage": "Account suspended — cannot allocate"
  }
]
```

For **Miscellaneous Payment / Direct Income** allocations (no account number):

```json
[
  {
    "accountNo": null,
    "accountName": "Building Control - Building Plan Fees",
    "allocatedAmount": 448.75,
    "status": "Success",
    "errorMessage": null
  }
]
```

#### Response Schema

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `accountNo` | `string` | Yes | The municipal account number (null for misc/direct income allocations) |
| `accountName` | `string` | No | Account holder name or misc payment group description |
| `allocatedAmount` | `decimal` | No | The Rand amount allocated |
| `status` | `string` | No | `"Success"` or `"Error"` |
| `errorMessage` | `string` | Yes | Error description if `status` is `"Error"`, otherwise `null` |

#### Response — Empty (200 OK)

If the job exists but has no account-level detail records:

```json
[]
```

#### Response — Job Not Found (404)

```json
{
  "isSuccess": false,
  "status": 404,
  "detail": "Job ID 99999 not found"
}
```

### Data Source Guidance

The account details likely exist across these tables (or their equivalents):

1. **Successful allocations** — The records written when a billing allocation is processed (the same data that feeds reconciliation reports and receipt generation).
2. **Error allocations** — The records already surfaced by `DirectDepositErrors/account-details/{jobId}`.

The new endpoint should **UNION** both sources, tagged by status:

```sql
-- Pseudocode
SELECT accountNo, accountName, allocatedAmount, 'Success' AS status, NULL AS errorMessage
FROM [SuccessfulAllocations]
WHERE jobId = @jobId

UNION ALL

SELECT accountNo, accountName, allocatedAmount, 'Error' AS status, errorMessage
FROM [DirectDepositErrors]
WHERE jobId = @jobId

ORDER BY status DESC, accountNo  -- Errors first, then successes
```

### Front-End Integration (Already Built)

The POS front-end is **already coded** to consume this data. The Allocation History detail panel renders a table with columns: Account No, Name, Amount, Status — and styles errors in red vs successes in green.

The only change needed on our side is updating the API URL from:

```
/api/DirectDepositErrors/account-details/{jobId}
```

to:

```
/api/BulkProgress/job-account-details/{jobId}
```

**Current front-end field mapping** (flexible — handles multiple naming conventions):

| Display Column | Fields checked (in priority order) |
|---|---|
| Account No | `accountNo`, `accountNumber`, `account_No`, `accountId` |
| Name | `name`, `accountName`, `surname`, `description` |
| Amount | `amount`, `allocatedAmount` |
| Status | `status` (falls back to checking `errorMessage` presence) |

**Recommendation:** Use `accountNo`, `accountName`, `allocatedAmount`, `status`, and `errorMessage` as the canonical field names.

---

## Bug 4: `submit-details-data` — Payload field validation and `billType "3"` (Group Payment) not documented

**Severity:** Medium
**Endpoint:** `POST /api/billing-direct-deposit-allocation/submit-details-data`

### Problem

The API spec for `submit-details-data` documents only three `billType` values: `"1"` (Consumer Services), `"4"` (Miscellaneous), and `"6"` (Clearance). However, the POS also submits **Group Payments** with `billType: "3"`. We need confirmation:

1. **Does `billType "3"` work?** We have been sending it and it appears to process, but it's not in the spec. If it does work, what fields are required?
2. **Does `billType "3"` map to `billType "4"` internally?** If group payments should use `billType "4"` with `miscPaymentGroupId`, please confirm.

### Questions for Developer

1. Is `billType "3"` a valid value for `submit-details-data`? If yes, what are the required fields?
2. Should group payment allocations use `billType "3"` or `billType "4"` with a `miscPaymentGroupId`?
3. Is the `groupId` field accepted by the API, or is `miscPaymentGroupId` the only field used?

---

## Bug 5: `submit-generic-import` — Confirm accepted payload fields

**Severity:** Medium
**Endpoint:** `POST /api/billing-direct-deposit-allocation/submit-generic-import`

### Problem

The POS now sends the following JSON payload to `submit-generic-import`:

```json
{
  "fileContent": "AccountNumber,Amount,ReceiptDate,PaymentTypeId\n100001234,1500.00,2026-03-06,5\n...",
  "fileName": "import.csv",
  "paymentReference": "Batch 2026-03",
  "cashBookId": 1,
  "userId": 209,
  "finYear": "2025/2026",
  "receiptDate": "2026-03-06T00:00:00",
  "paymentTypeId": 5,
  "postToCashbook": true
}
```

### Questions for Developer

1. **Does the API accept `receiptDate` in the JSON payload?** If so, does it apply to all rows in the CSV, or is it ignored in favour of per-row `ReceiptDate` in the CSV?
2. **Does the API accept `paymentTypeId` in the JSON payload?** Should it be `paymentTypeId` (camelCase), `PaymentTypeId` (PascalCase), or `paymentTypeID`?
3. **Does the API accept `postToCashbook` (boolean)?** If yes, what is the default when not sent?
4. **CSV column names:** Does the API CSV parser support `ReceiptDate` and `PaymentTypeId` as optional columns? If not, what columns are supported beyond `AccountNumber` and `Amount`?
5. **What is the full list of accepted CSV columns?** Please provide the complete CSV schema so we can generate an accurate template.

---

## POS-Side Fixes Applied (06 March 2026) — Payload Audit

The POS payload construction for `submit-details-data` has been corrected to match the documented API spec. Here is what the POS now sends for each `billType`:

### Always Included (all billTypes)

| Field | Source | Validated |
|---|---|---|
| `posItemId` | `transaction.posItem_ID` | Must be > 0 (blocked if invalid) |
| `reconId` | `transaction.bankReconID` | Must be > 0 (blocked if invalid) |
| `userId` | `fetchPlatinumUserInfo().user_ID` | Must be > 0 (blocked if invalid) |
| `financialYear` | `fetchActiveFinYear()` | Fetched from API (blocked if fails) |
| `transactionDate` | `transaction.dateOfTransaction` or current SAST datetime | Always present |
| `paidAmount` | `line.amount` | Must be > 0 (pre-validated) |
| `billType` | `"1"`, `"3"`, `"4"`, or `"6"` | Based on `allocationType` |
| `paymentTypeId` | `5` (EFT) | Always sent |

### BillType "1" — Consumer Services (ACCOUNT / PREPAID)

| Field | Value | Notes |
|---|---|---|
| `accountId` | `line.accountId` | **Validated > 0** — submission blocked if missing |
| `amount` | `line.amount` | Same as paidAmount |
| `outstandingAmount` | `line.outstandingAmount` or `line.amount` | Optional |
| `description` | Line description or transaction note | Optional |
| `reference` | `transaction.reference` | Actual bank reference |
| `note` | Line note or transaction note | Optional |
| `receiptDate` | Current SAST datetime | Optional |
| `cashFloat` | `0` | Always 0 for direct deposits |

**Not sent:** `lastName`, `initials` (not required per spec for billType "1")

### BillType "4" — Miscellaneous (DIRECT Income)

| Field | Value | Notes |
|---|---|---|
| `miscPaymentGroupId` | `line.miscPaymentGroupId` | **Validated > 0** — submission blocked if missing |
| `lastName` | Derived from description/transaction note | Always populated (fallback: "N/A") |
| `initials` | Derived from name or fallback "N" | Always populated (never empty) |
| `totalAmount` | `line.amount` | **Required per spec** — now always sent |
| `amount` | `line.amount` | Optional |
| `vatAmount` | `line.vatAmount` or 0 | Optional |
| `vatableVote` | `line.vatableVote` or 0 | Optional |
| `vatPercentage` | `line.vatPercentage` or 0 | Optional |
| `description` | Line description | Optional |
| `reference` | `transaction.reference` | Actual bank reference |
| `note` | Line note or transaction note | Optional |
| `receiptDate` | Current SAST datetime | Optional |
| `cashFloat` | `0` | Always 0 |

**Previous bug (now fixed):** `initials` was being sent as empty string `""` for DIRECT type — spec says required.

### BillType "6" — Clearance

| Field | Value | Notes |
|---|---|---|
| `accountId` | `line.accountId` | **Validated > 0** — submission blocked if missing |
| `clearanceId` | `line.clearanceId` | **Validated > 0** — submission blocked if missing |
| `outstandingAmount` | `line.outstandingAmount` or `line.amount` | Optional |
| `totalAmount` | `line.amount` | Optional (now sent) |
| `amount` | `line.amount` | Optional |
| `vatAmount` | `line.vatAmount` or 0 | Optional |
| `vatableVote` | `line.vatableVote` or 0 | Optional |
| `vatPercentage` | `line.vatPercentage` or 0 | Optional |
| `reference` | `transaction.reference` | Actual bank reference |
| `note` | Line note or transaction note | Optional |
| `receiptDate` | Current SAST datetime | Optional |
| `cashFloat` | `0` | Always 0 |

**Previous issue (now fixed):** Extra `costScheduleId` field was being sent — removed since it's not in the API spec.

### BillType "3" — Group Payment (UNDOCUMENTED)

| Field | Value | Notes |
|---|---|---|
| `accountId` | `line.accountId` or 0 | Not validated (no spec) |
| `miscPaymentGroupId` | `line.miscPaymentGroupId` or 0 | Sent but not validated |
| `groupId` | `line.groupId` or `miscPaymentGroupId` | Sent but not validated |
| `lastName` | Derived | Always populated |
| `initials` | Derived or "N" | Always populated |
| `totalAmount` | `line.amount` | Now sent |
| Other fields | Same as common fields | See above |

**Need confirmation:** Whether billType "3" is valid and what fields it requires.

### Changes Summary

| What Changed | Before | After |
|---|---|---|
| `posItemId` validation | Sent without check | Blocked if <= 0 |
| `reconId` validation | Sent as 0 if missing | Blocked if <= 0 |
| `accountId` (billType 1, 6) | Sent as 0 if missing | Blocked if <= 0 |
| `clearanceId` (billType 6) | Sent as 0 if missing | Blocked if <= 0 |
| `miscPaymentGroupId` (billType 4) | Sent as 0 if missing | Blocked if <= 0 |
| `initials` (billType 4) | Empty string for DIRECT | Always populated ("N" fallback) |
| `totalAmount` (billType 4) | Already sent | Confirmed present |
| `totalAmount` (billType 6) | Not sent | Now sent |
| `costScheduleId` (billType 6) | Sent (not in spec) | Removed |
| Duplicate `PaymentTypeId` | Sent both `paymentTypeId` and `PaymentTypeId` | Only `paymentTypeId` sent |
| Payload structure | Single "else" branch for billTypes 1/3/6 | Separate branches per billType |

---

## Summary of All Issues

| # | Bug | Endpoint | Severity | Fix Required |
|---|-----|----------|----------|--------------|
| 1 | `paymentTypeID` stored as 3 (Credit Card) instead of 5 (EFT) | `submit-details-data` | High | Respect `paymentTypeId` field from request body, or default direct deposits to 5 (EFT) |
| 2 | `paymentReference` built from `lastName`+`initials` instead of `reference` field | `submit-details-data` | High | Use `reference` field as source for `paymentReference` |
| 3 | Account details empty for completed jobs | `account-details/{jobId}` | High | New endpoint `BulkProgress/job-account-details/{jobId}` returning all allocations (success + error) |
| 4 | `billType "3"` (Group Payment) undocumented | `submit-details-data` | Medium | Confirm if valid and document required fields |
| 5 | `submit-generic-import` payload fields undocumented | `submit-generic-import` | Medium | Confirm `receiptDate`, `paymentTypeId`, `postToCashbook` acceptance + CSV column spec |

---

## Consistency with Existing API Patterns

| Convention | Expected |
|---|---|
| **Service group** | `BulkProgress` (same as `direct-deposit`, `get-bulk-allocation-list`) |
| **HTTP method** | `GET` (read-only retrieval) |
| **Path parameter** | `{jobId}` (same pattern as `direct-deposit/{jobId}`) |
| **Auth** | Bearer token |
| **Response format** | JSON array (same as `account-details/{jobId}`) |
| **Error format** | `{ isSuccess, status, detail }` |

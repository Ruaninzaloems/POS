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

## Summary of All Issues

| # | Bug | Endpoint | Severity | Fix Required |
|---|-----|----------|----------|--------------|
| 1 | `paymentTypeID` stored as 3 (Credit Card) instead of 5 (EFT) | `submit-details-data` | High | Respect `paymentTypeId` field from request body, or default direct deposits to 5 (EFT) |
| 2 | `paymentReference` built from `lastName`+`initials` instead of `reference` field | `submit-details-data` | High | Use `reference` field as source for `paymentReference` |
| 3 | Account details empty for completed jobs | `account-details/{jobId}` | High | New endpoint `BulkProgress/job-account-details/{jobId}` returning all allocations (success + error) |

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

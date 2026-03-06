# API Specification: Job Allocation Account Details

**Prepared for:** Platinum Inzalo EMS API Development Team
**Date:** 06 March 2026
**Priority:** High — Required for POS Allocation History feature

---

## 1. Problem Statement

The existing endpoint `GET /api/DirectDepositErrors/account-details/{jobId}` only returns data for jobs that have **error** status. When called for successfully completed jobs, it returns an empty response.

The POS front-end needs to display the **full list of allocated accounts** for any job — regardless of whether it completed successfully, partially, or with errors. This is critical for audit trails and cashier reconciliation.

**Test case:** Job ID `26134`, POS Item `2675` — a completed job that currently returns no account details.

---

## 2. Recommended Approach

**New endpoint** (Option B — cleanest separation of concerns):

```
GET /api/BulkProgress/job-account-details/{jobId}
```

**Why a new endpoint instead of modifying the existing one:**

- `DirectDepositErrors/account-details` has a clear semantic meaning — it returns error details. Changing it to also return successes would break its contract and could impact other consumers.
- `BulkProgress` is the correct service group for job progress/status queries (it already hosts `direct-deposit/{jobId}`, `get-bulk-allocation-list`, etc.).
- A new endpoint avoids any risk of breaking existing error-handling workflows that depend on `DirectDepositErrors`.

---

## 3. Endpoint Specification

### Request

```
GET /api/BulkProgress/job-account-details/{jobId}
```

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `jobId` | Path | `integer` | Yes | The `directDepositJob_ID` of the allocation job |

**Authentication:** Bearer token (same as all existing endpoints)

```
Authorization: Bearer {token}
Accept: application/json
```

### Response — Success (200 OK)

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
    "accountNo": "100567",
    "accountName": "A WILLIAMS",
    "allocatedAmount": 750.00,
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

### Response Schema

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `accountNo` | `string` | No | The municipal account number |
| `accountName` | `string` | No | Account holder's full name / description |
| `allocatedAmount` | `decimal` | No | The Rand amount allocated to this account |
| `status` | `string` | No | `"Success"` or `"Error"` |
| `errorMessage` | `string` | Yes | Error description if `status` is `"Error"`, otherwise `null` |

### Response — Empty (200 OK)

If the job exists but has no account-level detail records:

```json
[]
```

### Response — Job Not Found (404)

```json
{
  "isSuccess": false,
  "status": 404,
  "detail": "Job ID 99999 not found"
}
```

### Response — Server Error (500)

```json
{
  "isSuccess": false,
  "status": 500,
  "detail": "Internal server error"
}
```

---

## 4. Data Source Guidance

The account details likely exist across these tables (or their equivalents):

1. **Successful allocations** — The records written when a billing allocation is processed (the same data that feeds reconciliation reports and receipt generation).
2. **Error allocations** — The records already surfaced by `DirectDepositErrors/account-details/{jobId}`.

The new endpoint should **UNION** both sources, tagged by status:

```
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

---

## 5. Front-End Integration (Already Built)

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

**Recommendation:** Use `accountNo`, `accountName`, `allocatedAmount`, `status`, and `errorMessage` as the canonical field names (as shown in the schema above).

---

## 6. Consistency with Existing API Patterns

This endpoint follows the established conventions:

| Convention | This Endpoint |
|---|---|
| **Service group** | `BulkProgress` (same as `direct-deposit`, `get-bulk-allocation-list`) |
| **HTTP method** | `GET` (read-only retrieval) |
| **Path parameter** | `{jobId}` (same pattern as `direct-deposit/{jobId}`) |
| **Auth** | Bearer token |
| **Response format** | JSON array (same as `account-details/{jobId}`) |
| **Error format** | `{ isSuccess, status, detail }` |

---

## 7. Summary

| Item | Detail |
|---|---|
| **Endpoint** | `GET /api/BulkProgress/job-account-details/{jobId}` |
| **Returns** | All allocated accounts for a job (successes + errors) |
| **Test job** | Job ID `26134`, POS Item `2675` |
| **Fields** | `accountNo`, `accountName`, `allocatedAmount`, `status`, `errorMessage` |
| **Front-end** | Already built — just needs URL switch once endpoint is live |

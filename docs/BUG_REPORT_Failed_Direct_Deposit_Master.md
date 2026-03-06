# Bug Report: "Failed to create direct deposit master"

**Date**: 06 March 2026
**Severity**: Critical — Manual direct deposit allocation is completely blocked
**Reporter**: POS Prototype (George Municipality)
**API Endpoint**: `POST /api/billing-direct-deposit-allocation/submit-details-data`

---

## Summary

All manual direct deposit allocation submissions return `success: false` with the message `"Failed to create direct deposit master"`. The API returns HTTP 200 but the internal operation fails. No allocations can be completed.

## Environment

- **Site**: George Municipality (Site01)
- **User**: Jeandre Pretorius (userId: 209)
- **Cashier ID**: 9495
- **Cash Office**: George - York Street (officeId: 1)
- **Financial Year**: 2025/2026
- **Cashier Status**: Active, registered, has receipt range (460001–470000)

## Steps to Reproduce

1. Log in as userId 209 (active cashier session)
2. Navigate to Direct Deposits → Manual Allocation
3. Select any unallocated POS item (e.g., posItemId 2695 or 2676)
4. Search and select any account (tested with both active and inactive accounts)
5. Submit allocation

## What Happens

The API accepts the request (HTTP 200) but returns:

```json
{
  "success": false,
  "message": "Failed to create direct deposit master",
  "cashierId": null,
  "depositMasterId": null,
  "receiptId": null,
  "vendingData": null
}
```

Note: `cashierId` is `null` in the response, which suggests the API is not resolving the cashier internally.

## Test Case 1 — Active Account (20707)

**Request payload**:
```json
{
  "posItemId": 2695,
  "reconId": 1,
  "userId": 209,
  "financialYear": "2025/2026",
  "transactionDate": "2025-11-03T00:00:00",
  "paidAmount": 500,
  "billType": "1",
  "paymentTypeId": 5,
  "accountId": 20707,
  "amount": 500,
  "outstandingAmount": 500,
  "description": "Du Plessis Cornelius Adriaan & Susan (Old: 1002521605)",
  "reference": "0",
  "note": "MAGTAPE CREDIT USER 9501 SEQ/NICO S 2",
  "receiptDate": "2026-03-06T12:18:34",
  "cashFloat": 0
}
```

**Account details** (from `search-accounts`):
- account_ID: 20707
- statusDesc: **Active**
- accountDesc: Owner / Occupier
- outStandingAmt: -7618.75 (credit balance)
- institutionID: 128

**Result**: `success: false`, `"Failed to create direct deposit master"`

## Test Case 2 — Inactive Account (5050)

**Request payload**:
```json
{
  "posItemId": 2676,
  "reconId": 1,
  "userId": 209,
  "financialYear": "2025/2026",
  "transactionDate": "2025-11-03T00:00:00",
  "paidAmount": 56,
  "billType": "1",
  "paymentTypeId": 5,
  "accountId": 5050,
  "amount": 56,
  "outstandingAmount": 56,
  "description": "Minprovest Pty Ltd (Old: 1002515837)",
  "reference": "0",
  "note": "MAGTAPE CREDIT USER 9524 SEQ/ABSA BANK Erf nr 226/16",
  "receiptDate": "2026-03-06T12:15:55",
  "cashFloat": 0
}
```

**Account details** (from `search-accounts`):
- account_ID: 5050
- statusDesc: **Inactive**

**Result**: Same — `success: false`, `"Failed to create direct deposit master"`

## Analysis

1. **Both active and inactive accounts fail** — this rules out account status as the sole cause.
2. **The `cashierId` in the response is `null`** — the API may be failing to look up the cashier from the `userId`. The POS does not send `cashierId` in this payload because the API spec uses `userId`. If the API now expects `cashierId`, that is a breaking change.
3. **All other API calls succeed** — authentication, account search, POS item list, validate-cashier, payment types, etc. Only `submit-details-data` fails.
4. **The payload matches the format that previously worked** for allocations made on 05/03/2026 and 06/03/2026 earlier today (visible in allocation history as "Completed" status).

## Questions for Platinum API Team

1. Has the `submit-details-data` endpoint been updated recently? Is `cashierId` now a required field in the payload (previously it was resolved from `userId` server-side)?
2. Is there a database-level issue preventing the creation of deposit master records (e.g., a constraint violation, sequence exhaustion, or locked table)?
3. Does the API log show the specific internal error? The generic message `"Failed to create direct deposit master"` does not indicate the root cause.
4. Should we be sending `cashierId: 9495` in the payload alongside `userId: 209`?

## What Needs to Be Fixed (API Side)

The `submit-details-data` endpoint needs to:
1. Successfully create the direct deposit master record when given valid payload data
2. Return a meaningful error message if there is a specific validation failure (e.g., "Account is inactive", "Cashier not found", "Receipt range exhausted") instead of the generic "Failed to create direct deposit master"
3. If the API now requires `cashierId` in the payload, this should be documented so the POS can include it

## POS Payload Validation

Our POS payload includes all fields from the API spec:
- `posItemId` ✓ (valid POS item from bank recon)
- `reconId` ✓ (valid bank reconciliation ID)
- `userId` ✓ (authenticated user, matches session)
- `financialYear` ✓ (from active-fin-year API)
- `transactionDate` ✓ (from POS item dateOfTransaction)
- `paidAmount` / `amount` ✓ (from POS item amount)
- `billType` ✓ ("1" for Consumer Services)
- `paymentTypeId` ✓ (5 = EFT, appropriate for direct deposits)
- `accountId` ✓ (valid account_ID from search-accounts)
- `outstandingAmount` ✓
- `description` ✓
- `reference` ✓
- `note` ✓ (from POS item note)
- `receiptDate` ✓
- `cashFloat` ✓

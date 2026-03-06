# Bug Report: "Failed to create direct deposit master"

**Date**: 06 March 2026
**Severity**: Critical — Manual direct deposit allocation is completely blocked
**Reporter**: POS Prototype (George Municipality)
**API Endpoint**: `POST /api/billing-direct-deposit-allocation/submit-details-data`
**Status**: RESOLVED — POS payload updated with required changes

---

## Summary

All manual direct deposit allocation submissions returned `success: false` with the message `"Failed to create direct deposit master"`. The API returns HTTP 200 but the internal operation fails.

## Root Cause

Three API contract changes were confirmed by the Platinum team:

1. **`cashierId` is now required** in the `submit-details-data` payload. Previously the API resolved this internally from `userId`. The POS was not sending it.
2. **`PaymentTypeId` is now read from the request** payload. Previously the API may have defaulted this. The POS was already sending `paymentTypeId: 5` (EFT) but this confirms it must always be present.
3. **`PaymentReference`** — the field name expected by the API is `paymentReference`, not `reference`. The POS was sending `reference`.

## Fix Applied (POS Side)

### Server route (`server/routes.ts` — `submit-details-data`):

1. **`cashierId` injection**: Before forwarding to Platinum, the server now calls `validate-cashier` to resolve the `cashierId` from the authenticated `userId` and injects it into the payload.
2. **`reference` → `paymentReference` rename**: If the client sends `reference`, the server automatically renames it to `paymentReference` before forwarding to the API.
3. **`paymentTypeId`**: Already sent by the client (value `5` for EFT). No change needed — confirmed the API now reads this from the request.

### What the corrected payload now looks like:

```json
{
  "posItemId": 2695,
  "reconId": 1,
  "userId": 209,
  "cashierId": 9495,
  "financialYear": "2025/2026",
  "transactionDate": "2025-11-03T00:00:00",
  "paidAmount": 500,
  "billType": "1",
  "paymentTypeId": 5,
  "accountId": 20707,
  "amount": 500,
  "outstandingAmount": 500,
  "description": "Du Plessis Cornelius Adriaan & Susan",
  "paymentReference": "0",
  "note": "MAGTAPE CREDIT USER 9501 SEQ/NICO S 2",
  "receiptDate": "2026-03-06T12:18:34",
  "cashFloat": 0
}
```

### Changes from the previous (failing) payload:
| Field | Before (failing) | After (fixed) |
|---|---|---|
| `cashierId` | not sent | `9495` (resolved from validate-cashier) |
| `reference` | `"0"` | removed |
| `paymentReference` | not sent | `"0"` (renamed from `reference`) |
| `paymentTypeId` | `5` | `5` (unchanged, confirmed required) |

---

## Environment

- **Site**: George Municipality (Site01)
- **User**: Jeandre Pretorius (userId: 209)
- **Cashier ID**: 9495
- **Cash Office**: George - York Street (officeId: 1)
- **Financial Year**: 2025/2026

## Previous Error Response (before fix)

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

## API Feedback

The error message `"Failed to create direct deposit master"` is generic and does not indicate which field was missing or invalid. A more descriptive error (e.g., `"cashierId is required"`, `"paymentReference field missing"`) would significantly speed up debugging.

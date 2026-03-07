# API Comparison Report: Generic Import vs Manual Allocation
## For Kiran — Direct Deposit Allocation Bug Investigation

**Date:** 07 March 2026  
**Issue:** Manual allocation via `submit-details-data` returns `"Failed to create direct deposit master"` with `cashierId: null` — but Generic Import via `submit-generic-import` works perfectly and creates receipts.

---

## 1. SIDE-BY-SIDE: The Two API Endpoints

| Aspect | Generic Import (WORKING) | Manual Allocation (FAILING) |
|--------|--------------------------|----------------------------|
| **Platinum endpoint** | `POST /api/billing-direct-deposit-allocation/submit-generic-import` | `POST /api/billing-direct-deposit-allocation/submit-details-data` |
| **Creates receipts?** | YES — receipts created successfully | NO — `"Failed to create direct deposit master"` |
| **Response on success** | `{ isSuccess: true, jobId, message, totalCount }` | Expected: `{ success: true, cashierId, depositMasterId, receiptId }` |
| **Response on failure** | N/A (working) | `{ success: false, message: "Failed to create direct deposit master", cashierId: null, depositMasterId: null, receiptId: null }` |

---

## 2. PAYLOAD COMPARISON

### Generic Import Payload (WORKING)
```json
{
  "cashOfficeId": 1,
  "cashierId": 9495,
  "userId": 209,
  "finYear": "2025/2026",
  "postToCashbook": false,
  "payments": [
    {
      "receiptDate": "07/03/2026",
      "accountNumber": "000000013088",
      "amount": 300.00,
      "paymentTypeId": 1
    }
  ]
}
```

### Manual Allocation Payload (FAILING)
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
  "accountId": 38395,
  "amount": 500,
  "outstandingAmount": 500,
  "description": "Sokopo Phumeza (Old: 1002055560)",
  "reference": "0",
  "note": "MAGTAPE CREDIT USER 9501 SEQ/NICO S 2",
  "receiptDate": "2026-03-07T21:27:35",
  "cashFloat": 0,
  "cashierId": 32555,
  "cashOfficeId": 1,
  "isVirtual": true
}
```

---

## 3. KEY DIFFERENCES (Field-by-Field)

| # | Field | Generic Import | Manual Allocation | Potential Issue? |
|---|-------|---------------|-------------------|-----------------|
| 1 | **Financial Year field name** | `finYear` | `financialYear` | MAYBE — different field name for same data |
| 2 | **Account identifier** | `accountNumber` (string, 12-digit zero-padded: `"000000013088"`) | `accountId` (numeric: `38395`) | Different type AND name |
| 3 | **Receipt date format** | `dd/MM/yyyy` (`"07/03/2026"`) | ISO 8601 (`"2026-03-07T21:27:35"`) | POSSIBLE — different date format |
| 4 | **Cashier ID** | `9495` (real cashier with receipt range) | `32555` (virtual cashier, NO receipt range) | HIGH — virtual cashier may lack receipt range |
| 5 | **posItemId** | NOT SENT (not needed) | `2695` | N/A — only manual needs this |
| 6 | **reconId** | NOT SENT | `1` | POSSIBLE — is reconId=1 valid for posItemId 2695? |
| 7 | **billType** | NOT SENT (Platinum determines) | `"1"` (string) | POSSIBLE — should this be numeric `1`? |
| 8 | **paymentTypeId** | `1` (Cash — from CSV) | `5` (EFT) | Expected difference (EFT for deposits) |
| 9 | **isVirtual** | NOT SENT | `true` | POSSIBLE — API might not support this field |
| 10 | **cashFloat** | NOT SENT | `0` | Unknown if expected |
| 11 | **Additional fields** | None | `outstandingAmount`, `description`, `reference`, `note`, `paidAmount`, `transactionDate` | These are extra context fields |

---

## 4. CRITICAL OBSERVATIONS

### 4A. The cashierId Problem
- **Generic Import** uses the **real cashier** (ID `9495`), which has a valid receipt range assigned (`hasReceiptRange: true` confirmed by `validate-cashier`).
- **Manual Allocation** creates a **virtual cashier** (ID `32555`) via `submit-cashier-setup` with `isVirtual: true`. This virtual cashier does NOT have a receipt range assigned.
- **Before we added cashierId** to the manual payload, the same error occurred — Platinum returned `cashierId: null` even without the field being sent. This suggests the API NEEDS a valid cashier with a receipt range to create the deposit master/receipt.

### 4B. The Error Is Consistent
- **Every** attempt with `submit-details-data` returns the same error, regardless of:
  - Whether `cashierId` is included or not
  - Whether a virtual or real cashier ID is used  
  - Which account is being allocated (tested with accountIds 38395, 11475, 54196)
  - Which posItemId is used
- This suggests the issue is either:
  1. A fundamental API-level problem with `submit-details-data` (broken after update?)
  2. A missing required field that the API now expects but doesn't report
  3. A receipt range issue (API can't generate receipts without one)

### 4C. The `check-selected-item-processed` Endpoint Also Fails
- When navigating to a transaction, the client calls `check-selected-item-processed?posItemId=2695&reconId=1`
- This call also returns an error (`"Failed to check item processed status"`)
- This could indicate that posItemId 2695 or reconId 1 is invalid/already processed

---

## 5. QUESTIONS FOR KIRAN

1. **Does `submit-details-data` now require `cashierId` and `cashOfficeId`?** The old working payload from Kiran's test did NOT include these fields, and it worked. Now nothing works. Did the API update add these as required fields?

2. **Does `submit-details-data` need a cashier with a receipt range?** If so, we should use the real cashier ID (9495) instead of creating virtual cashiers. The generic import works because it uses the real cashier.

3. **Was the `submit-details-data` endpoint itself changed in the recent API update?** Since the generic import (different endpoint) works fine, maybe only `submit-details-data` was affected by the update.

4. **Is `reconId: 1` still valid?** All our manual allocation attempts use `reconId: 1`. Is this the correct bank reconciliation ID for the POS items we're trying to allocate?

5. **Should `billType` be a string `"1"` or a number `1`?** The generic import doesn't send billType at all (Platinum determines it). Manual allocation sends it as a string.

6. **Is there a new required field** that `submit-details-data` now expects but wasn't previously required? The response `cashierId: null` in the error body suggests Platinum couldn't resolve the cashier internally.

7. **Should `receiptDate` use `dd/MM/yyyy` format** (like generic import) instead of ISO 8601? The two endpoints use completely different date formats.

---

## 6. SUGGESTED TEST

To narrow down the issue, could Kiran try calling `submit-details-data` directly (e.g. via Postman/Swagger) with:

### Test A: Minimal payload with REAL cashier
```json
{
  "posItemId": 2695,
  "reconId": 1,
  "userId": 209,
  "cashierId": 9495,
  "cashOfficeId": 1,
  "financialYear": "2025/2026",
  "transactionDate": "2025-11-03T00:00:00",
  "paidAmount": 500,
  "billType": "1",
  "paymentTypeId": 5,
  "accountId": 38395,
  "amount": 500,
  "outstandingAmount": 500,
  "receiptDate": "07/03/2026",
  "cashFloat": 0
}
```

### Test B: With `finYear` instead of `financialYear`
Same as Test A but use `"finYear": "2025/2026"` instead of `"financialYear"`.

### Test C: Different posItemId
Try a different (not previously attempted) posItemId to rule out that 2695 is already allocated.

This will tell us whether the issue is:
- Field naming (`finYear` vs `financialYear`)
- Receipt range (real vs virtual cashier)
- Date format (`dd/MM/yyyy` vs ISO)
- posItemId already processed
- Or a bug in the `submit-details-data` endpoint itself

---

## 7. SUMMARY

The generic import works because it uses a completely different Platinum API endpoint (`submit-generic-import`) with a simpler flat payload, the real cashier (with receipt range), and `dd/MM/yyyy` date format. The manual allocation uses `submit-details-data` which requires additional fields (posItemId, reconId, billType) and is currently failing for ALL attempts. The most likely causes are: (1) the API endpoint itself changed and needs new/different fields, (2) the virtual cashier lacks a receipt range, or (3) a combination of field naming/format differences.

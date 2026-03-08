# API Comparison Report: Generic Import vs Manual Allocation
## For Kiran — Direct Deposit Allocation Bug Investigation

**Date:** 08 March 2026  
**Issue:** Manual allocation via `submit-details-data` returns `"Failed to create direct deposit master"` with `cashierId: null` — but Generic Import via `submit-generic-import` works perfectly and creates receipts.

**Status:** PAYLOADS CORRECTED — aligned to Kiran's spec. Please re-test.

---

## 1. WHAT WAS WRONG (Root Cause Analysis)

Our `submit-details-data` payloads had **3 critical problems** compared to Kiran's spec:

### Problem 1: MISSING `groupId` field
Kiran's spec includes `groupId` in ALL three bill types. We never sent it. Now added — using `bankReconID` from the transaction as the `groupId` value.

### Problem 2: Server was injecting EXTRA fields NOT in the spec
Our server-side code was adding these fields to every payload before sending to Platinum:
- `cashierId` (virtual cashier ID, e.g. 32555)
- `cashOfficeId` (e.g. 1)
- `isVirtual` (true)
- `cashFloat` (0)
- `note` (transaction note)

**None of these are in Kiran's spec.** The API was likely rejecting payloads because of these unexpected fields, particularly `cashierId` and `isVirtual`.

### Problem 3: Extra fields in client payloads
Each bill type was sending fields not in Kiran's spec:
- BillType "1": `amount`, `outstandingAmount`, `note`, `receiptDate`, `cashFloat` — none in spec
- BillType "6": `outstandingAmount`, `totalAmount`, `amount`, `vatAmount`, `vatableVote`, `vatPercentage`, `note`, `receiptDate` — none in spec
- BillType "4": `vatableVote`, `vatPercentage`, `note` — none in spec

---

## 2. CORRECTED PAYLOADS (Now Matching Kiran's Spec Exactly)

### BillType "1" — Consumer Services
**Kiran's Spec:**
```json
{
  "billType": "1",
  "accountId": 12345,
  "paidAmount": 500.00,
  "paymentTypeId": 5,
  "posItemId": 67,
  "reconId": 10,
  "userId": 1,
  "financialYear": "2025/2026",
  "transactionDate": "2026-03-08T00:00:00",
  "groupId": 2,
  "reference": "Optional reference",
  "description": "Payment for account 12345"
}
```

**Our Corrected Payload:**
```json
{
  "billType": "1",
  "accountId": 38395,
  "paidAmount": 500.00,
  "paymentTypeId": 5,
  "posItemId": 2695,
  "reconId": 1,
  "userId": 209,
  "financialYear": "2025/2026",
  "transactionDate": "2025-11-03T00:00:00",
  "groupId": 1,
  "reference": "MAGTAPE CREDIT USER 9501 SEQ/NICO S 2",
  "description": "Sokopo Phumeza (Old: 1002055560)"
}
```
**Match: YES** — all fields present, no extras.

---

### BillType "6" — Clearance
**Kiran's Spec:**
```json
{
  "billType": "6",
  "accountId": 12345,
  "clearanceId": 99,
  "paidAmount": 1200.00,
  "paymentTypeId": 5,
  "posItemId": 67,
  "reconId": 10,
  "userId": 1,
  "financialYear": "2025/2026",
  "transactionDate": "2026-03-08T00:00:00",
  "groupId": 2,
  "reference": "Clearance ref"
}
```

**Our Corrected Payload:**
```json
{
  "billType": "6",
  "accountId": 12345,
  "clearanceId": 99,
  "paidAmount": 1200.00,
  "paymentTypeId": 5,
  "posItemId": 2695,
  "reconId": 1,
  "userId": 209,
  "financialYear": "2025/2026",
  "transactionDate": "2025-11-03T00:00:00",
  "groupId": 1,
  "reference": "transaction note/reference"
}
```
**Match: YES** — all fields present, no extras.

---

### BillType "4" — Miscellaneous Payment
**Kiran's Spec:**
```json
{
  "billType": "4",
  "amount": 100.00,
  "vatAmount": 14.00,
  "totalAmount": 114.00,
  "paidAmount": 114.00,
  "paymentTypeId": 5,
  "posItemId": 67,
  "miscPaymentGroupId": 3,
  "reconId": 10,
  "userId": 1,
  "financialYear": "2025/2026",
  "transactionDate": "2026-03-08T00:00:00",
  "receiptDate": "2026-03-08T00:00:00",
  "groupId": 2,
  "lastName": "Smith",
  "initials": "J",
  "description": "Misc payment description",
  "reference": "Optional ref"
}
```

**Our Corrected Payload:**
```json
{
  "billType": "4",
  "amount": 100.00,
  "vatAmount": 14.00,
  "totalAmount": 114.00,
  "paidAmount": 114.00,
  "paymentTypeId": 5,
  "posItemId": 2695,
  "miscPaymentGroupId": 3,
  "reconId": 1,
  "userId": 209,
  "financialYear": "2025/2026",
  "transactionDate": "2025-11-03T00:00:00",
  "receiptDate": "2026-03-08T21:30:00",
  "groupId": 1,
  "lastName": "Smith",
  "initials": "J",
  "description": "Misc payment description",
  "reference": "transaction note"
}
```
**Match: YES** — all fields present, no extras.

---

## 3. CHANGES MADE

| Change | Before | After |
|--------|--------|-------|
| `groupId` field | MISSING from all payloads | Added to all 3 bill types (using `bankReconID`) |
| Server `cashierId` injection | Added virtual cashier ID to payload | REMOVED — not in spec |
| Server `cashOfficeId` injection | Added office ID to payload | REMOVED — not in spec |
| Server `isVirtual` injection | Added `true` to payload | REMOVED — not in spec |
| Server `cashFloat` injection | Added `0` to payload | REMOVED — not in spec |
| Server `note` field | Passed through to API | REMOVED — not in spec |
| BillType "1" extras | `amount`, `outstandingAmount`, `receiptDate`, `cashFloat` | REMOVED — only fields in spec |
| BillType "6" extras | `outstandingAmount`, `totalAmount`, `amount`, `vatAmount`, `vatableVote`, `vatPercentage`, `receiptDate` | REMOVED — only fields in spec |
| BillType "4" extras | `vatableVote`, `vatPercentage` | REMOVED — only fields in spec |
| Virtual cashier session | Created before batch, closed after | REMOVED — not needed per spec |

---

## 4. REMAINING QUESTION FOR KIRAN

**`groupId` value:** We're using `bankReconID` from the POS item as `groupId`. In Kiran's examples, `groupId: 2`. Is `bankReconID` the correct source for `groupId`, or is it a different field? Our current POS items have `bankReconID: 1`, so `groupId` will be `1`.

---

## 5. COMPARISON WITH GENERIC IMPORT

| Aspect | Generic Import (WORKING) | Manual Allocation (CORRECTED) |
|--------|--------------------------|-------------------------------|
| Platinum endpoint | `submit-generic-import` | `submit-details-data` |
| Needs `posItemId` | No | Yes |
| Needs `reconId` | No | Yes |
| Needs `groupId` | No | Yes (NEW — was missing) |
| Needs `billType` | No (Platinum decides) | Yes |
| Needs `cashierId` | Yes (in payload) | No (NOT in spec) |
| Needs `cashOfficeId` | Yes (in payload) | No (NOT in spec) |
| Account format | `accountNumber` (string) | `accountId` (number) |
| Date format | `dd/MM/yyyy` | ISO 8601 |

The key difference: Generic Import sends `cashierId`/`cashOfficeId` in its payload (and works). Manual Allocation does NOT need these fields per Kiran's spec — the API resolves the cashier internally from the auth token.

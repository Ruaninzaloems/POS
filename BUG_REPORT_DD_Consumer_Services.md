# Bug Report: Direct Deposit Allocation — Consumer Services (billType "1") Fails on Azure UAT

**Date:** 06 March 2026  
**Reporter:** POS Prototype (Replit)  
**Severity:** Blocker  
**Endpoint:** `POST /api/billing-direct-deposit-allocation/submit-details-data`  
**Environment:** George UAT (`georgeplatinumuatapi.azurewebsites.net`)

---

## Summary

Consumer service direct deposit allocation (billType `"1"`) consistently returns `"Failed to create direct deposit master"` when called against the Azure UAT API, despite using the **exact same payload structure** that succeeds on Kiran's local instance (`localhost:7019`).

---

## Kiran's Working Request (localhost:7019)

```json
{
  "posItemId": 2876,
  "reconId": 1,
  "userId": 209,
  "financialYear": "2025/2026",
  "transactionDate": "2025-11-03T00:00:00",
  "paidAmount": 56,
  "billType": "1",
  "paymentTypeId": 5,
  "accountId": 20787,
  "amount": 56,
  "outstandingAmount": 56,
  "description": "Du Plessis Cornelius Adriaan & Susan (Old: 1002521605)",
  "reference": "0",
  "note": "MAGTAPE CREDIT USER 9524 SEQ/ABSA BANK Erf nr 226/16",
  "receiptDate": "2026-03-06T12:47:18",
  "cashFloat": 0
}
```

**Response (SUCCESS):**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "cashierId": 32510,
  "depositMasterId": 26167,
  "receiptId": null,
  "vendingData": null
}
```

---

## Our Failing Request (georgeplatinumuatapi.azurewebsites.net)

```json
{
  "posItemId": 11700,
  "reconId": 1,
  "userId": 209,
  "financialYear": "2025/2026",
  "transactionDate": "2025-11-20T00:00:00",
  "paidAmount": 414,
  "billType": "1",
  "paymentTypeId": 5,
  "accountId": 17479,
  "amount": 414,
  "outstandingAmount": 414,
  "description": "Wait Willem Hendrik (Old: 1002207073)",
  "reference": "0",
  "note": "FNB OB PMT/REF 13305016 2022070",
  "receiptDate": "2026-03-06T22:33:12",
  "cashFloat": 0
}
```

**Response (FAIL):**
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

**HTTP Status:** 200 OK  
**Response Headers:** `content-type: application/json; charset=utf-8`, `server: Microsoft-IIS/10.0`

---

## Key Observations

1. **Payload structure is identical** — same fields, same types, same format.
2. **Multiple transactions tested** — posItemIds 2695, 6621, 11700, 1647, 20700 all fail with the same error.
3. **The API returns HTTP 200** with `success: false` — this is not a network/auth issue.
4. **The JWT token is valid** — all other Platinum API calls (validate-cashier, payment-types, payment-options, unreconciled-list, account search, etc.) work correctly with the same token.
5. **The cashier session is active** — `validate-cashier` confirms cashierId=9495, isActive=true, officeId=1.
6. **The response returns `cashierId: null`** — the API is unable to resolve/create the cashier record internally, even though the cashier is confirmed active.
7. **Only billType "1" tested** — other billTypes have not been tested yet.

---

## Hypothesis

The Azure UAT deployment of the Platinum API may have:
- A different code version than Kiran's local instance
- A configuration difference that affects cashier resolution during direct deposit master creation
- A database state issue specific to the UAT environment
- A dependency on a prior API call (e.g., session initialization) that the local instance doesn't require

---

## Request to Kiran

1. Can you confirm the Azure UAT API is running the same version as your local instance?
2. Does the Azure UAT API require any additional session setup or pre-call before `submit-details-data`?
3. Can you try calling `submit-details-data` directly against `georgeplatinumuatapi.azurewebsites.net` (not localhost) with the same payload to confirm the issue is environment-specific?
4. The `cashierId: null` in the failure response — what does the API use to resolve the cashier? Is it derived from the JWT token, the `userId` field, or something else?

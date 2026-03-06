# Bug Report: Direct Deposit Allocation — Consumer Services (billType "1") Fails on Azure UAT

**Date:** 06 March 2026  
**Reporter:** POS Prototype (Replit)  
**Severity:** Blocker  
**Endpoint:** `POST /api/billing-direct-deposit-allocation/submit-details-data`  
**Environment:** George UAT (`georgeplatinumuatapi.azurewebsites.net`)

---

## Summary

Consumer service direct deposit allocation (billType `"1"`) consistently returns `"Failed to create direct deposit master"` when called against the Azure UAT API. **We tested with Kiran's exact payload** (the one that succeeded on his `localhost:7019`) **and it ALSO FAILS on Azure UAT.** This proves the issue is environment-specific — the Azure UAT API is broken for this endpoint.

---

## PROOF: Kiran's Exact Payload — Tested on BOTH Environments

### Kiran's Payload (used for both tests):

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

### Result on Kiran's localhost:7019 — SUCCESS:
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

### Result on Azure UAT (georgeplatinumuatapi.azurewebsites.net) — FAIL:
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

**Same payload. Same userId. Same JWT auth. Different environment = different result.**

---

## Our Payload (also fails on Azure UAT):

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

**Response:** Same failure — `"Failed to create direct deposit master"`, `cashierId: null`

---

## Comparison: Our Payload vs Kiran's Payload

| Field             | Kiran's Payload                                              | Our Payload                                        | Match? |
|-------------------|--------------------------------------------------------------|----------------------------------------------------|--------|
| posItemId         | 2876                                                         | 11700                                              | Type match (int) |
| reconId           | 1                                                            | 1                                                  | Identical |
| userId            | 209                                                          | 209                                                | Identical |
| financialYear     | "2025/2026"                                                  | "2025/2026"                                        | Identical |
| transactionDate   | "2025-11-03T00:00:00"                                        | "2025-11-20T00:00:00"                              | Format match (ISO) |
| paidAmount        | 56                                                           | 414                                                | Type match (number) |
| billType          | "1"                                                          | "1"                                                | Identical |
| paymentTypeId     | 5                                                            | 5                                                  | Identical |
| accountId         | 20787                                                        | 17479                                              | Type match (int) |
| amount            | 56                                                           | 414                                                | Type match (number) |
| outstandingAmount | 56                                                           | 414                                                | Type match (number) |
| description       | "Du Plessis Cornelius Adriaan & Susan (Old: 1002521605)"     | "Wait Willem Hendrik (Old: 1002207073)"            | Type match (string) |
| reference         | "0"                                                          | "0"                                                | Identical |
| note              | "MAGTAPE CREDIT USER 9524 SEQ/ABSA BANK Erf nr 226/16"      | "FNB OB PMT/REF 13305016 2022070"                  | Type match (string) |
| receiptDate       | "2026-03-06T12:47:18"                                        | "2026-03-06T22:33:12"                              | Format match (ISO) |
| cashFloat         | 0                                                            | 0                                                  | Identical |

**All fields match in structure, type, and format. Both payloads are valid.**

---

## Key Evidence

1. **Kiran's exact payload fails on Azure UAT** — this eliminates our payload as the cause.
2. **HTTP 200 returned** — not a network, auth, or routing issue.
3. **JWT token is valid** — all other Platinum API calls work (validate-cashier, payment-types, unreconciled-list, account search, etc.).
4. **Cashier session is active** — validate-cashier confirms cashierId=9495, isActive=true, officeId=1.
5. **`cashierId: null` in failure response** — the API cannot resolve the cashier internally on Azure UAT.
6. **Multiple posItemIds tested** — 2876, 2695, 6621, 11700, 1647, 20700 all fail with the same error.

---

## Conclusion

The `submit-details-data` endpoint for billType "1" (Consumer Services) is **broken on the Azure UAT deployment**. The same payload succeeds on Kiran's local instance but fails on Azure. This is a server-side/environment issue — not a payload or client issue.

---

## Request to Kiran

1. **Please test your working payload against `georgeplatinumuatapi.azurewebsites.net`** (not localhost) to confirm this.
2. Is the Azure UAT running the same API code version as your local instance?
3. What does the API use internally to resolve the cashier during deposit master creation — JWT token, userId, or something else?
4. Could there be a database/config difference between your local DB and the UAT DB that affects cashier resolution?

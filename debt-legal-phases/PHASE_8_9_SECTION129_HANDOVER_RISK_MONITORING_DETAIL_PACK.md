# PHASE 8-9: Section 129, Handover, Risk Scoring, Qualification & Process Monitoring — Detail Pack

**Document Version**: 1.0  
**Date**: 11/03/2026  
**Status**: DESIGN COMPLETE — PENDING API TEAM BUILD  
**Covers**: Phase 8 (Section 129 Config/Notices/Review/Authorization/Report + Handover Management/Termination/Report) + Phase 9 (Risk Scoring + Qualification Rules + Process Monitoring)

---

## TABLE OF CONTENTS

1. [Frontend Audit Summary](#1-frontend-audit-summary)
2. [Phase 8: Section 129 — API Contracts](#2-phase-8-section-129)
3. [Phase 8: Handover — API Contracts](#3-phase-8-handover)
4. [Phase 9: Risk Scoring — API Contracts](#4-phase-9-risk-scoring)
5. [Phase 9: Qualification Rules — API Contracts](#5-phase-9-qualification-rules)
6. [Phase 9: Process Monitoring — API Contracts](#6-phase-9-process-monitoring)
7. [Shared Reference Data Endpoints](#7-shared-reference-data-endpoints)
8. [Middleware & Security](#8-middleware--security)
9. [Angular Model Definitions](#9-angular-model-definitions)
10. [Checklist for Platinum API Team](#10-checklist-for-platinum-api-team)
11. [Blockers & Dependencies](#11-blockers--dependencies)
12. [Sign-Off Checklist](#12-sign-off-checklist)

---

## 1. FRONTEND AUDIT SUMMARY

### Phase 8: Section 129 Config (section129-config.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 1 | `/api/platinum/billing-debt/section129-templates` | GET | `debt.routes.ts:225` | `/api/BillingDebt/section129-templates` | ALIGNED |
| 2 | `/api/platinum/billing-debt/section129-sms-templates` | GET | `debt.routes.ts:236` | `/api/BillingDebt/section129-sms-templates` | ALIGNED |
| 3 | `/api/platinum/billing-debt/additional-billing-types` | GET | `debt.routes.ts:286` | `/api/BillingDebt/additional-billing-types` | ALIGNED |
| 4 | `/api/platinum/billing-debt/attorney-list` | GET | `debt.routes.ts:139` | `/api/BillingDebt/attorney-list` | ALIGNED |
| 5 | `/api/platinum/billing-debt/section129-config-list` | GET | `debt.routes.ts:203` | `/api/BillingDebt/section129-config-list` | ALIGNED |
| 6 | `/api/platinum/billing-debt/section129-config-save` | POST | `debt.routes.ts:213` | `/api/BillingDebt/section129-config-save` | ALIGNED |

### Phase 8: Section 129 Notices (section129-notices.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 7 | `/api/platinum/billing-debt/section129-config` | GET | `debt.routes.ts:8` | `/api/BillingDebt/section129-config` | ALIGNED |
| 8 | `/api/platinum/billing-debt/section129-runs` | GET | `debt.routes.ts:19` | `/api/BillingDebt/section129-runs` | ALIGNED |
| 9 | `/api/platinum/billing-debt/billing-cycles` | GET | `debt.routes.ts:150` | `/api/BillingDebt/billing-cycles` | ALIGNED |
| 10 | `/api/platinum/billing-debt/towns` | GET | `debt.routes.ts:161` | `/api/BillingDebt/towns` | ALIGNED |
| 11 | `/api/platinum/billing-debt/property-categories` | GET | `debt.routes.ts:296` | `/api/BillingDebt/property-categories` | ALIGNED |
| 12 | `/api/platinum/billing-debt/account-types` | GET | `debt.routes.ts:306` | `/api/BillingDebt/account-types` | ALIGNED |
| 13 | `/api/platinum/billing-debt/person-types` | GET | `debt.routes.ts:316` | `/api/BillingDebt/person-types` | ALIGNED |
| 14 | `/api/platinum/billing-debt/ageing-ranges` | GET | `debt.routes.ts:326` | `/api/BillingDebt/ageing-ranges` | ALIGNED |
| 15 | `/api/platinum/billing-debt/section129-trial-run` | POST | `debt.routes.ts:29` | `/api/BillingDebt/section129-trial-run` | ALIGNED |
| 16 | `/api/platinum/billing-debt/section129-run-files` | GET | `debt.routes.ts:247` | `/api/BillingDebt/section129-run-files` | ALIGNED |
| 17 | `/api/platinum/billing-debt/section129-download-file` | GET | `debt.routes.ts:258` | `/api/BillingDebt/section129-download-file` | ALIGNED |
| 18 | `/api/platinum/billing-debt/section129-final-run` | POST | `debt.routes.ts:62` | `/api/BillingDebt/section129-final-run` | ALIGNED |
| 19 | `/api/platinum/billing-debt/section129-delete-run` | POST | `debt.routes.ts:94` | `/api/BillingDebt/section129-delete-run` | ALIGNED |

### Phase 8: Section 129 Trial Review (section129-trial-review.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 20 | `/api/platinum/billing-debt/section129-run-accounts` | GET | `debt.routes.ts:74` | `/api/BillingDebt/section129-run-accounts` | ALIGNED |
| 21 | `/api/platinum/billing-debt/section129-runs` | GET | `debt.routes.ts:19` | `/api/BillingDebt/section129-runs` | ALIGNED (shared) |
| 22 | `/api/platinum/billing-debt/section129-trial-review-submit` | POST | `debt.routes.ts:40` | `/api/BillingDebt/section129-trial-review-submit` | ALIGNED |

### Phase 8: Section 129 Authorization (section129-authorization.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 23 | `/api/platinum/billing-debt/section129-runs` | GET | `debt.routes.ts:19` | `/api/BillingDebt/section129-runs` | ALIGNED (shared) |
| 24 | `/api/platinum/billing-debt/section129-authorize` | POST | `debt.routes.ts:51` | `/api/BillingDebt/section129-authorize` | ALIGNED |

### Phase 8: Section 129 Report (section129-report.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 25 | `/api/platinum/billing-debt/billing-cycles` | GET | `debt.routes.ts:150` | `/api/BillingDebt/billing-cycles` | ALIGNED (shared) |
| 26 | `/api/platinum/billing-debt/ageing-ranges` | GET | `debt.routes.ts:326` | `/api/BillingDebt/ageing-ranges` | ALIGNED (shared) |
| 27 | `/api/platinum/billing-payment/search-accounts` | POST | `pos.routes.ts` | `/api/BillingPayment/search-accounts` | ALIGNED (shared POS) |
| 28 | `/api/platinum/billing-debt/section129-report` | GET | `debt.routes.ts:172` | `/api/BillingDebt/section129-report` | ALIGNED |

### Phase 8: Handover Management (handover-management.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 29 | `/api/platinum/billing-debt/attorney-list` | GET | `debt.routes.ts:139` | `/api/BillingDebt/attorney-list` | ALIGNED (shared) |
| 30 | `/api/platinum/billing-debt/billing-cycles` | GET | `debt.routes.ts:150` | `/api/BillingDebt/billing-cycles` | ALIGNED (shared) |
| 31 | `/api/platinum/billing-debt/towns` | GET | `debt.routes.ts:161` | `/api/BillingDebt/towns` | ALIGNED (shared) |
| 32 | `/api/platinum/billing-debt/ageing-ranges` | GET | `debt.routes.ts:326` | `/api/BillingDebt/ageing-ranges` | ALIGNED (shared) |
| 33 | `/api/platinum/billing-debt/handover-list` | GET | `debt.routes.ts:106` | `/api/BillingDebt/handover-list` | ALIGNED |
| 34 | `/api/platinum/billing-debt/handover-submit` | POST | `debt.routes.ts:116` | `/api/BillingDebt/handover-submit` | ALIGNED |

### Phase 8: Handover Termination (handover-termination.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 35 | `/api/platinum/billing-debt/handover-list` | GET | `debt.routes.ts:106` | `/api/BillingDebt/handover-list` | ALIGNED (shared) |
| 36 | `/api/platinum/billing-debt/attorney-list` | GET | `debt.routes.ts:139` | `/api/BillingDebt/attorney-list` | ALIGNED (shared) |
| 37 | `/api/platinum/billing-debt/handover-terminate` | POST | `debt.routes.ts:127` | `/api/BillingDebt/handover-terminate` | ALIGNED |

### Phase 8: Handover Report (handover-report.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 38 | `/api/platinum/billing-debt/attorney-list` | GET | `debt.routes.ts:139` | `/api/BillingDebt/attorney-list` | ALIGNED (shared) |
| 39 | `/api/platinum/billing-debt/billing-cycles` | GET | `debt.routes.ts:150` | `/api/BillingDebt/billing-cycles` | ALIGNED (shared) |
| 40 | `/api/platinum/billing-debt/handover-report` | GET | `debt.routes.ts:183` | `/api/BillingDebt/handover-report` | ALIGNED |

### Phase 9: Risk Scoring (risk-scoring.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 41 | `/api/debt-scoring/score-account` | POST | `legal.routes.ts:115` | `/api/BillingDebt/risk-score-account` | ALIGNED |
| 42 | `/api/debt-scoring/score-bulk` | POST | `legal.routes.ts:125` | `/api/BillingDebt/risk-score-bulk` | ALIGNED |
| 43 | `/api/debt-scoring/scores` | GET | `legal.routes.ts:135` | `/api/BillingDebt/risk-scores` | ALIGNED |
| 44 | `/api/debt-scoring/weights` | GET | `legal.routes.ts:155` | `/api/BillingDebt/risk-weights` | ALIGNED |
| 45 | `/api/debt-scoring/weights` | PUT | `legal.routes.ts:165` | `/api/BillingDebt/risk-weights` | ALIGNED |

### Phase 9: Qualification Rules (qualification-rules.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 46 | `/api/debt-scoring/qualification-rules` | GET | `legal.routes.ts:176` | `/api/BillingDebt/qualification-rules` | ALIGNED |
| 47 | `/api/debt-scoring/qualification-rules` | POST | `legal.routes.ts:196` | `/api/BillingDebt/qualification-rules` | ALIGNED |
| 48 | `/api/debt-scoring/qualification-rules/:id` | PUT | `legal.routes.ts:207` | `/api/BillingDebt/qualification-rules/:id` | ALIGNED |
| 49 | `/api/debt-scoring/qualification-rules/:id` | DELETE | `legal.routes.ts:218` | `/api/BillingDebt/qualification-rules/:id` | ALIGNED |
| 50 | `/api/debt-scoring/qualification-rules/:id/run` | POST | `legal.routes.ts:229` | `/api/BillingDebt/qualification-rules/:id/run` | ALIGNED |

### Phase 9: Process Monitoring (process-monitoring.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 51 | `/api/process-monitoring/overview` | GET | `analytics.routes.ts:149` | `/api/BillingDebt/process-monitoring-overview` | ALIGNED |
| 52 | `/api/process-monitoring/active-runs` | GET | `analytics.routes.ts:159` | `/api/BillingDebt/process-active-runs` | ALIGNED |
| 53 | `/api/process-monitoring/failed-runs` | GET | `analytics.routes.ts:169` | `/api/BillingDebt/process-failed-runs` | ALIGNED |
| 54 | `/api/process-monitoring/pending-approvals` | GET | `analytics.routes.ts:179` | `/api/BillingDebt/process-pending-approvals` | ALIGNED |
| 55 | `/api/process-monitoring/handover-queues` | GET | `analytics.routes.ts:189` | `/api/BillingDebt/process-handover-queues` | ALIGNED |
| 56 | `/api/process-monitoring/termination-queues` | GET | `analytics.routes.ts:199` | `/api/BillingDebt/process-termination-queues` | ALIGNED |

### Fixes Applied This Session
**NONE REQUIRED** — All 56 frontend-to-backend paths are correctly aligned. No legacy paths or mismatches found.

---

## 2. PHASE 8: SECTION 129 — API CONTRACTS

### S129-01: Get Active Section 129 Config
```
GET /api/BillingDebt/section129-config
Auth: Session (requireAuth)
Response 200:
{
  "id": number,
  "finYear": "string (e.g. '2025/2026')",
  "enabled": boolean,
  "section129Template": "string (template ID)",
  "smsTemplate": "string (SMS template ID)",
  "lapseDays": number (14-99),
  "noticesPerFile": number (min 1),
  "activateRotation": boolean,
  "costItems": [{ "nr": number, "additionalBillingTypeId": "string", "additionalBillingTypeName": "string", "amount": number }],
  "attorneyRotation": [{ "nr": number, "attorneyId": number, "attorneyName": "string", "percentDebtorCount": number, "percentHandoverAmount": number }]
}
```

### S129-02: List Section 129 Config Entries by Financial Year
```
GET /api/BillingDebt/section129-config-list
Auth: Session (requireAuth)
Query: ?finYear=2025/2026
Response 200: Section129ConfigEntry[]
{
  "id": number,
  "finYear": "string",
  "enabled": boolean,
  "section129Template": "string|null",
  "smsTemplate": "string|null",
  "lapseDays": number,
  "noticesPerFile": number,
  "activateRotation": boolean,
  "costItems": CostItem[],
  "attorneyRotation": AttorneyRotationItem[],
  "createdAt": "ISO date",
  "modifiedBy": "string|null"
}
```

### S129-03: Save Section 129 Config
```
POST /api/BillingDebt/section129-config-save
Auth: Session (requireAuth + requireDebtPermission PROCESS_SECTION129)
Body:
{
  "id": number|null (null = new entry),
  "enabled": boolean,
  "finYear": "string (e.g. '2025/2026')",
  "section129Template": "string (template ID)",
  "smsTemplate": "string (SMS template ID)",
  "lapseDays": number (14-99),
  "noticesPerFile": number (min 1),
  "costItems": [{ "nr": number, "additionalBillingTypeId": "string", "additionalBillingTypeName": "string", "amount": number }],
  "activateRotation": boolean,
  "attorneyRotation": [{ "nr": number, "attorneyId": number, "attorneyName": "string", "percentDebtorCount": number (0-100), "percentHandoverAmount": number (0-100) }],
  "userId": "injected",
  "auditTimestamp": "injected"
}
Validation Rules:
- lapseDays must be 14-99
- noticesPerFile must be >= 1
- If activateRotation=true: attorney allocations must use EITHER percentDebtorCount OR percentHandoverAmount (not both), and must total 100%
- Only one enabled config per finYear
Response 200: { "success": true, "id": number }
```

### S129-04: List Section 129 Runs
```
GET /api/BillingDebt/section129-runs
Auth: Session (requireAuth)
Response 200: Section129Run[]
{
  "runId": number,
  "finYear": "string",
  "finMonth": "string",
  "runType": "trial-review|final",
  "status": "string (e.g. 'Trial Run Review', 'Approved', 'Final Running', 'Final Complete')",
  "totalAccounts": number,
  "totalAmount": number,
  "billingCycle": "string",
  "createdAt": "ISO date",
  "createdBy": "string"
}
```

### S129-05: Submit Section 129 Trial Run
```
POST /api/BillingDebt/section129-trial-run
Auth: Session (requireAuth + requireDebtPermission PROCESS_SECTION129)
Body:
{
  "finYear": "string",
  "finMonth": "string",
  "runType": "trial-review",
  "billingCycle": "string (required)",
  "town": "string|undefined",
  "suburb": "string|undefined",
  "propertyCategory": "string|undefined",
  "accountType": "string|undefined",
  "typeOfPerson": "string|undefined",
  "serviceGroupCode": "string|undefined",
  "ageing": "string|undefined",
  "amountGreaterThan": number|undefined,
  "includeIndigents": boolean,
  "includePensioners": boolean,
  "excludeDepositBalances": boolean,
  "contactPerson": "string|undefined",
  "phone": "string|undefined",
  "email": "string|undefined",
  "distributionType": "email|print|both",
  "mustEmailBePrinted": boolean|undefined,
  "handoverOption": "account|bulk|rotation",
  "userId": "injected",
  "auditTimestamp": "injected"
}
Response 200: { "success": true, "runId": number, "message": "string" }
```

### S129-06: Get Run Accounts for Trial Review
```
GET /api/BillingDebt/section129-run-accounts
Auth: Session (requireAuth)
Query: ?runId=123
Response 200: Section129RunAccount[]
{
  "accountId": number,
  "accountNo": "string",
  "accountName": "string",
  "qualifyingAmount": number,
  "noticeFees": number,
  "daysPastDue": number,
  "selected": boolean,
  "status": "string"
}
```

### S129-07: Submit Trial Review
```
POST /api/BillingDebt/section129-trial-review-submit
Auth: Session (requireAuth + requireDebtPermission PROCESS_SECTION129)
Body:
{
  "runId": number,
  "selectedAccountIds": number[],
  "finalReviewComplete": boolean,
  "userId": "injected",
  "auditTimestamp": "injected",
  "isReview": true (injected by middleware)
}
Response 200: { "success": true, "message": "string" }
```

### S129-08: Authorize Section 129 Run
```
POST /api/BillingDebt/section129-authorize
Auth: Session (requireAuth + requireDebtPermission AUTHORISE_SECTION129)
Body:
{
  "runId": number,
  "review": "Approve|Decline",
  "notes": "string (required when review=Decline, max 250 chars)",
  "userId": "injected",
  "auditTimestamp": "injected",
  "isReview": true (injected by middleware)
}
Response 200: { "success": true }
```

### S129-09: Submit Final Run
```
POST /api/BillingDebt/section129-final-run
Auth: Session (requireAuth + requireDebtPermission PROCESS_SECTION129)
Body:
{
  "runId": number,
  "userId": "injected",
  "auditTimestamp": "injected"
}
Response 200: { "success": true, "message": "string" }
```

### S129-10: Delete Section 129 Run
```
POST /api/BillingDebt/section129-delete-run
Auth: Session (requireAuth + requireDebtPermission PROCESS_SECTION129)
Body:
{
  "runId": number,
  "userId": "injected",
  "auditTimestamp": "injected"
}
Validation: Cannot delete runs with status in ['Approved', 'Authorized', 'Final Running', 'Final Complete']
Response 200: { "success": true }
```

### S129-11: Get Run Files
```
GET /api/BillingDebt/section129-run-files
Auth: Session (requireAuth)
Query: ?runId=123
Response 200: Section129RunFile[]
{
  "fileId": number,
  "fileName": "string",
  "fileSize": number (bytes),
  "fileType": "string (e.g. 'pdf', 'docx')",
  "createdAt": "ISO date"
}
```

### S129-12: Download Run File
```
GET /api/BillingDebt/section129-download-file
Auth: Session (requireAuth)
Query: ?fileId=456
Response 200: Binary file stream
Headers: Content-Type, Content-Disposition
Note: Backend proxies binary stream directly from Platinum (no JSON wrapper)
```

### S129-13: Section 129 Report
```
GET /api/BillingDebt/section129-report
Auth: Session (requireAuth)
Query: ?finYear=2025/2026&finMonth=1&billingCycle=BC001&accountNo=ACC123&ageing=90&amountGreaterThan=1000
Response 200: any[] (dynamic columns — frontend renders all keys)
```

---

## 3. PHASE 8: HANDOVER — API CONTRACTS

### HO-01: List Handover Records
```
GET /api/BillingDebt/handover-list
Auth: Session (requireAuth)
Response 200: HandoverRecord[]
{
  "handoverId": number,
  "accountNo": "string",
  "accountName": "string",
  "attorneyId": number,
  "attorneyName": "string",
  "handoverDate": "ISO date",
  "amount": number,
  "balance": number,
  "status": "string (e.g. 'Active', 'Pending', 'Terminated', 'Closed')",
  "handoverOption": "account|bulk|rotation"
}
```

### HO-02: Submit Handover
```
POST /api/BillingDebt/handover-submit
Auth: Session (requireAuth + requireDebtPermission HANDOVER_PROCESS)
Body:
{
  "handoverOption": "account|bulk|rotation",
  "attorneyId": number (0 if rotation),
  "accountNo": "string (required if handoverOption=account)",
  "billingCycle": "string|undefined (for bulk/rotation)",
  "town": "string|undefined (for bulk/rotation)",
  "ageing": "string|undefined (for bulk/rotation)",
  "amountGreaterThan": number|undefined (for bulk/rotation),
  "rotationAllocations": [{ "attorneyId": number, "percentage": number }] (required if rotation, must total 100%),
  "userId": "injected",
  "auditTimestamp": "injected"
}
Response 200: { "success": true, "message": "string", "handoverId": number|null }
```

### HO-03: Terminate Handovers
```
POST /api/BillingDebt/handover-terminate
Auth: Session (requireAuth + requireDebtPermission HANDOVER_PROCESS)
Body:
{
  "handoverIds": number[],
  "reason": "string (from TERMINATION_REASONS list)",
  "notes": "string|null",
  "userId": "injected",
  "auditTimestamp": "injected",
  "isTermination": true (injected by middleware)
}
Response 200: { "success": true, "message": "string" }
```

### HO-04: Handover Report
```
GET /api/BillingDebt/handover-report
Auth: Session (requireAuth)
Query: ?finYear=2025/2026&finMonth=1&billingCycle=BC001&attorneyId=5&accountNo=ACC123
Response 200: any[] (dynamic columns — frontend renders all keys)
```

---

## 4. PHASE 9: RISK SCORING — API CONTRACTS

### RS-01: Score Single Account
```
POST /api/BillingDebt/risk-score-account
Auth: Session (requireAuth)
Body:
{
  "accountNo": "string (required)",
  "paymentHistory": number (0-100, default 50),
  "arrearAge": number (days),
  "arrearDays": number (days),
  "lastPaymentDays": number (days since last payment),
  "paymentFrequency": number,
  "totalArrears": number,
  "debtSize": number,
  "indigentStatus": boolean,
  "previousLegalActions": number,
  "locationRisk": number (0-100),
  "waterArrears": number,
  "electricityArrears": number,
  "serviceTypes": string[] (e.g. ["water", "electricity"])
}
Response 200:
{
  "accountNo": "string",
  "overallScore": number (0-100),
  "riskCategory": "LOW|MEDIUM|HIGH",
  "factorScores": [
    {
      "factor": "string",
      "rawScore": number,
      "normalizedScore": number (0-100),
      "weight": number,
      "contribution": number
    }
  ]
}
```

### RS-02: Bulk Score Accounts
```
POST /api/BillingDebt/risk-score-bulk
Auth: Session (requireAuth)
Body:
{
  "accounts": [
    {
      "accountNo": "string",
      "paymentHistory": number,
      "arrearAge": number,
      "lastPaymentDays": number,
      "totalArrears": number,
      "debtSize": number,
      "indigentStatus": boolean,
      "previousLegalActions": number,
      "locationRisk": number,
      "serviceTypes": string[]
    }
  ]
}
Response 200: { "success": true, "scored": number, "failed": number }
```

### RS-03: Get Score Dashboard
```
GET /api/BillingDebt/risk-scores
Auth: Session (requireAuth)
Query: ?limit=10&offset=0&riskCategory=HIGH
Response 200:
{
  "scores": [
    {
      "accountNo": "string",
      "overallScore": number,
      "riskCategory": "LOW|MEDIUM|HIGH",
      "scoredAt": "ISO date"
    }
  ],
  "total": number
}
```

### RS-04: Get Risk Weights
```
GET /api/BillingDebt/risk-weights
Auth: Session (requireAuth)
Response 200:
{
  "paymentHistory": { "label": "string", "weight": number, "description": "string" },
  "arrearAge": { "label": "string", "weight": number, "description": "string" },
  "debtSize": { "label": "string", "weight": number, "description": "string" },
  "paymentFrequency": { "label": "string", "weight": number, "description": "string" },
  "locationRisk": { "label": "string", "weight": number, "description": "string" },
  ... (additional factors)
}
```

### RS-05: Update Risk Weights
```
PUT → POST /api/BillingDebt/risk-weights
Auth: Session (requireAuth + requireLegalAdmin)
Body:
{
  "paymentHistory": number,
  "arrearAge": number,
  "debtSize": number,
  "paymentFrequency": number,
  "locationRisk": number,
  ...
  "userId": "injected",
  "auditTimestamp": "injected"
}
Validation: All weights should ideally sum to 100
Response 200: { "success": true }
```

---

## 5. PHASE 9: QUALIFICATION RULES — API CONTRACTS

### QR-01: List Qualification Rules
```
GET /api/BillingDebt/qualification-rules
Auth: Session (requireAuth)
Response 200: QualificationRule[]
{
  "id": number,
  "name": "string",
  "description": "string|null",
  "priority": number,
  "isActive": boolean,
  "conditions": [
    {
      "field": "totalArrears|arrearDays|lastPaymentDays|propertyValue|waterArrears|electricityArrears|riskScore|indigentStatus|accountType",
      "operator": ">|<|>=|<=|==|!=|contains|in",
      "value": "string|number",
      "logicOperator": "AND|OR"
    }
  ],
  "createdAt": "ISO date",
  "modifiedAt": "ISO date"
}
```

### QR-02: Create Qualification Rule
```
POST /api/BillingDebt/qualification-rules
Auth: Session (requireAuth + requireLegalAdmin)
Body:
{
  "name": "string (required)",
  "description": "string|null",
  "priority": number,
  "isActive": true,
  "conditions": Condition[],
  "userId": "injected",
  "auditTimestamp": "injected"
}
Response 201: { "id": number, "name": "string" }
```

### QR-03: Update Qualification Rule
```
PUT → POST /api/BillingDebt/qualification-rules/:id
Auth: Session (requireAuth + requireLegalAdmin)
Body: Same as QR-02 (partial updates accepted, e.g. { isActive: false })
Response 200: { "success": true }
```

### QR-04: Delete Qualification Rule
```
DELETE → POST /api/BillingDebt/qualification-rules/:id/delete
Auth: Session (requireAuth + requireLegalAdmin)
Body: { "userId": "injected", "auditTimestamp": "injected" }
Response 200: { "success": true }
```

### QR-05: Run Qualification Rule Against Test Accounts
```
POST /api/BillingDebt/qualification-rules/:id/run
Auth: Session (requireAuth)
Body:
{
  "accounts": [
    {
      "accountNo": "string",
      "totalArrears": number|undefined,
      "arrearDays": number|undefined,
      "lastPaymentDays": number|undefined,
      "propertyValue": number|undefined,
      "waterArrears": number|undefined,
      "electricityArrears": number|undefined
    }
  ]
}
Response 200:
{
  "totalEvaluated": number,
  "matchedCount": number,
  "results": [
    { "accountNo": "string", "matched": boolean, "failedConditions": string[] }
  ]
}
```

---

## 6. PHASE 9: PROCESS MONITORING — API CONTRACTS

### PM-01: Monitoring Overview
```
GET /api/BillingDebt/process-monitoring-overview
Auth: Session (requireAuth)
Response 200: ProcessMonitoringOverview
{
  "activeRuns": number,
  "failedRuns": number,
  "pendingApprovals": number,
  "handoverQueued": number,
  "terminationQueued": number,
  "lastUpdated": "ISO date"
}
```

### PM-02: Active Runs
```
GET /api/BillingDebt/process-active-runs
Auth: Session (requireAuth)
Response 200:
{
  "runs": [
    {
      "id": number,
      "runType": "string",
      "status": "string",
      "startedAt": "ISO date",
      "accountNo": "string|null",
      "description": "string|null"
    }
  ]
}
```

### PM-03: Failed Runs
```
GET /api/BillingDebt/process-failed-runs
Auth: Session (requireAuth)
Response 200:
{
  "runs": [
    {
      "id": number,
      "runType": "string",
      "status": "FAILED",
      "failedAt": "ISO date",
      "error": "string",
      "accountNo": "string|null"
    }
  ]
}
```

### PM-04: Pending Approvals
```
GET /api/BillingDebt/process-pending-approvals
Auth: Session (requireAuth)
Response 200:
{
  "approvals": [
    {
      "id": number,
      "jobType": "string",
      "accountNo": "string",
      "requestedAt": "ISO date",
      "requestedBy": "string",
      "amount": number|null
    }
  ]
}
```

### PM-05: Handover Queues
```
GET /api/BillingDebt/process-handover-queues
Auth: Session (requireAuth)
Response 200:
{
  "queues": [
    {
      "id": number,
      "accountNo": "string",
      "attorneyName": "string",
      "amount": number,
      "queuedAt": "ISO date",
      "status": "string"
    }
  ]
}
```

### PM-06: Termination Queues
```
GET /api/BillingDebt/process-termination-queues
Auth: Session (requireAuth)
Response 200:
{
  "queues": [
    {
      "id": number,
      "accountNo": "string",
      "handoverId": number,
      "reason": "string",
      "queuedAt": "ISO date",
      "status": "string"
    }
  ]
}
```

---

## 7. SHARED REFERENCE DATA ENDPOINTS

These endpoints are used by multiple Phase 8 components (Config, Notices, Handover) and must be built once:

| # | Endpoint | Platinum Path | Used By |
|---|---|---|---|
| 1 | `/api/platinum/billing-debt/section129-templates` | `/api/BillingDebt/section129-templates` | Config |
| 2 | `/api/platinum/billing-debt/section129-sms-templates` | `/api/BillingDebt/section129-sms-templates` | Config |
| 3 | `/api/platinum/billing-debt/additional-billing-types` | `/api/BillingDebt/additional-billing-types` | Config |
| 4 | `/api/platinum/billing-debt/attorney-list` | `/api/BillingDebt/attorney-list` | Config, Handover Mgmt, Handover Term, Handover Report |
| 5 | `/api/platinum/billing-debt/billing-cycles` | `/api/BillingDebt/billing-cycles` | Notices, Report, Handover Mgmt, Handover Report |
| 6 | `/api/platinum/billing-debt/towns` | `/api/BillingDebt/towns` | Notices, Handover Mgmt |
| 7 | `/api/platinum/billing-debt/property-categories` | `/api/BillingDebt/property-categories` | Notices |
| 8 | `/api/platinum/billing-debt/account-types` | `/api/BillingDebt/account-types` | Notices |
| 9 | `/api/platinum/billing-debt/person-types` | `/api/BillingDebt/person-types` | Notices |
| 10 | `/api/platinum/billing-debt/ageing-ranges` | `/api/BillingDebt/ageing-ranges` | Notices, Report, Handover Mgmt |

---

## 8. MIDDLEWARE & SECURITY

### Permission Model (debt.routes.ts)
```typescript
DEBT_PERMISSIONS = {
  PROCESS_SECTION129: 'PROCESS_SECTION129',
  AUTHORISE_SECTION129: 'AUTHORISE_SECTION129',
  HANDOVER_PROCESS: 'HANDOVER_PROCESS',
  // ... additional permissions
}
```

### Authentication Chain
- **Read-only routes** (GET): `requireAuth` only
- **Section 129 processing** (trial run, final run, delete, config save): `requireAuth` + `requireDebtPermission(PROCESS_SECTION129)`
- **Section 129 authorization**: `requireAuth` + `requireDebtPermission(AUTHORISE_SECTION129)` — separate from processing permission
- **Handover submit/terminate**: `requireAuth` + `requireDebtPermission(HANDOVER_PROCESS)`
- **Risk scoring writes**: `requireAuth` + `requireLegalAdmin`
- **Qualification rule CUD**: `requireAuth` + `requireLegalAdmin`

### Audit Field Injection
All write operations inject `userId` and `auditTimestamp`.  
Review-specific operations also inject `isReview: true`.  
Termination operations inject `isTermination: true`.

### Binary File Download (S129-12)
The `section129-download-file` endpoint uses a **direct binary proxy** pattern:
- Fetches binary stream from Platinum using `fetch()`
- Forwards `Content-Type` and `Content-Disposition` headers
- Sends raw buffer (not JSON wrapped)

---

## 9. ANGULAR MODEL DEFINITIONS

### File: `angular-client/src/app/models/debt.models.ts`

```typescript
// Section 129 Config
interface Section129ConfigEntry {
  id: number;
  finYear: string;
  enabled: boolean;
  section129Template: string | null;
  smsTemplate: string | null;
  lapseDays: number;
  noticesPerFile: number;
  activateRotation: boolean;
  costItems: CostItem[];
  attorneyRotation: AttorneyRotationItem[];
  createdAt?: string;
  modifiedBy?: string;
}

interface CostItem {
  nr: number;
  additionalBillingTypeId: string;
  additionalBillingTypeName: string;
  amount: number;
}

interface AttorneyRotationItem {
  nr: number;
  attorneyId: number;
  attorneyName: string;
  percentDebtorCount: number;
  percentHandoverAmount: number;
}

interface Attorney {
  attorneyId: number;
  attorneyName: string;
  isActive: boolean;
  firmName?: string;
  email?: string;
  phone?: string;
}

// Section 129 Config view mode
type ConfigViewMode = 'landing' | 'detail';

// Section 129 Run
interface Section129Config {
  // Active config shape (from /section129-config GET)
  id?: number;
  finYear: string;
  enabled: boolean;
  lapseDays: number;
  noticesPerFile: number;
}

interface Section129Run {
  runId: number;
  finYear: string;
  finMonth: string;
  runType: string;
  status: string;
  totalAccounts: number;
  totalAmount: number;
  billingCycle: string;
  createdAt?: string;
  createdBy?: string;
}

interface Section129RunAccount {
  accountId: number;
  accountNo: string;
  accountName: string;
  qualifyingAmount: number;
  noticeFees: number;
  daysPastDue: number;
  selected: boolean;
  status?: string;
}

interface Section129RunFile {
  fileId: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdAt?: string;
}

// Run types
type RunType = 'trial-review' | 'final';
type HandoverOption = 'account' | 'bulk' | 'rotation';
type DistributionType = 'email' | 'print' | 'both';

// Authorization
type ReviewDecision = '' | 'Approve' | 'Decline';
interface AuthorizationRow {
  run: Section129Run;
  review: ReviewDecision;
  notes: string;
}

// Handover
interface HandoverRecord {
  handoverId: number;
  accountNo: string;
  accountName: string;
  attorneyId: number;
  attorneyName: string;
  handoverDate: string;
  amount: number;
  balance: number;
  status: string;
  handoverOption?: string;
}

// Risk Scoring
type TabMode = 'score' | 'dashboard' | 'weights';

// Qualification
interface Condition {
  field: string;
  operator: string;
  value: string;
  logicOperator: string;
}

// Process Monitoring
interface ProcessMonitoringOverview {
  activeRuns: number;
  failedRuns: number;
  pendingApprovals: number;
  handoverQueued: number;
  terminationQueued: number;
  lastUpdated?: string;
}
```

### Config Constants (debt-config.ts)

```typescript
SECTION129_DEFAULTS = {
  section129Template: '',
  smsTemplate: '',
  lapseDays: 30,
  noticesPerFile: 50,
  activateRotation: false,
}

TERMINATION_REASONS = [
  'Payment in Full',
  'Payment Arrangement',
  'Account Write-Off',
  'Deceased Estate',
  'Prescribed Debt',
  'Administrative Error',
  'Court Order',
  'Other'
]

PAGE_SIZE = 10

QUALIFICATION_FIELD_OPTIONS = [
  { value: 'totalArrears', label: 'Total Arrears' },
  { value: 'arrearDays', label: 'Arrear Days' },
  { value: 'lastPaymentDays', label: 'Days Since Last Payment' },
  { value: 'propertyValue', label: 'Property Value' },
  { value: 'waterArrears', label: 'Water Arrears' },
  { value: 'electricityArrears', label: 'Electricity Arrears' },
  { value: 'riskScore', label: 'Risk Score' },
  { value: 'indigentStatus', label: 'Indigent Status' },
  { value: 'accountType', label: 'Account Type' },
]

QUALIFICATION_OPERATOR_OPTIONS = [
  { value: '>', label: 'Greater Than' },
  { value: '<', label: 'Less Than' },
  { value: '>=', label: 'Greater or Equal' },
  { value: '<=', label: 'Less or Equal' },
  { value: '==', label: 'Equals' },
  { value: '!=', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'in', label: 'In List' },
]

PROCESS_STATUS_LABELS = {
  RUNNING: { label: 'Running', className: '...' },
  COMPLETED: { label: 'Completed', className: '...' },
  FAILED: { label: 'Failed', className: '...' },
  PENDING: { label: 'Pending', className: '...' },
  QUEUED: { label: 'Queued', className: '...' },
}

RISK_COLORS = {
  HIGH: { text: '...', bg: '...', border: '...', bar: '...' },
  MEDIUM: { text: '...', bg: '...', border: '...', bar: '...' },
  LOW: { text: '...', bg: '...', border: '...', bar: '...' },
  UNKNOWN: { text: '...', bg: '...', border: '...', bar: '...' },
}
```

---

## 10. CHECKLIST FOR PLATINUM API TEAM

### Phase 8: Section 129 — Platinum Must Build
| # | Endpoint | Method | Priority |
|---|---|---|---|
| 1 | `/api/BillingDebt/section129-config` | GET | HIGH |
| 2 | `/api/BillingDebt/section129-config-list` | GET | HIGH |
| 3 | `/api/BillingDebt/section129-config-save` | POST | HIGH |
| 4 | `/api/BillingDebt/section129-runs` | GET | HIGH |
| 5 | `/api/BillingDebt/section129-trial-run` | POST | HIGH |
| 6 | `/api/BillingDebt/section129-run-accounts` | GET | HIGH |
| 7 | `/api/BillingDebt/section129-trial-review-submit` | POST | HIGH |
| 8 | `/api/BillingDebt/section129-authorize` | POST | HIGH |
| 9 | `/api/BillingDebt/section129-final-run` | POST | HIGH |
| 10 | `/api/BillingDebt/section129-delete-run` | POST | MEDIUM |
| 11 | `/api/BillingDebt/section129-run-files` | GET | HIGH |
| 12 | `/api/BillingDebt/section129-download-file` | GET (binary) | HIGH |
| 13 | `/api/BillingDebt/section129-report` | GET | MEDIUM |
| 14 | `/api/BillingDebt/section129-templates` | GET | HIGH |
| 15 | `/api/BillingDebt/section129-sms-templates` | GET | HIGH |

### Phase 8: Handover — Platinum Must Build
| # | Endpoint | Method | Priority |
|---|---|---|---|
| 16 | `/api/BillingDebt/handover-list` | GET | HIGH |
| 17 | `/api/BillingDebt/handover-submit` | POST | HIGH |
| 18 | `/api/BillingDebt/handover-terminate` | POST | HIGH |
| 19 | `/api/BillingDebt/handover-report` | GET | MEDIUM |

### Phase 8: Shared Reference Data — Platinum Must Build
| # | Endpoint | Method | Priority |
|---|---|---|---|
| 20 | `/api/BillingDebt/attorney-list` | GET | HIGH |
| 21 | `/api/BillingDebt/billing-cycles` | GET | HIGH |
| 22 | `/api/BillingDebt/towns` | GET | HIGH |
| 23 | `/api/BillingDebt/property-categories` | GET | MEDIUM |
| 24 | `/api/BillingDebt/account-types` | GET | MEDIUM |
| 25 | `/api/BillingDebt/person-types` | GET | MEDIUM |
| 26 | `/api/BillingDebt/ageing-ranges` | GET | MEDIUM |
| 27 | `/api/BillingDebt/additional-billing-types` | GET | MEDIUM |

### Phase 9: Risk Scoring — Platinum Must Build
| # | Endpoint | Method | Priority |
|---|---|---|---|
| 28 | `/api/BillingDebt/risk-score-account` | POST | HIGH |
| 29 | `/api/BillingDebt/risk-score-bulk` | POST | MEDIUM |
| 30 | `/api/BillingDebt/risk-scores` | GET | HIGH |
| 31 | `/api/BillingDebt/risk-weights` | GET | HIGH |
| 32 | `/api/BillingDebt/risk-weights` | POST (update) | MEDIUM |

### Phase 9: Qualification Rules — Platinum Must Build
| # | Endpoint | Method | Priority |
|---|---|---|---|
| 33 | `/api/BillingDebt/qualification-rules` | GET | HIGH |
| 34 | `/api/BillingDebt/qualification-rules` | POST | HIGH |
| 35 | `/api/BillingDebt/qualification-rules/:id` | POST (update) | HIGH |
| 36 | `/api/BillingDebt/qualification-rules/:id/delete` | POST | MEDIUM |
| 37 | `/api/BillingDebt/qualification-rules/:id/run` | POST | MEDIUM |

### Phase 9: Process Monitoring — Platinum Must Build
| # | Endpoint | Method | Priority |
|---|---|---|---|
| 38 | `/api/BillingDebt/process-monitoring-overview` | GET | HIGH |
| 39 | `/api/BillingDebt/process-active-runs` | GET | HIGH |
| 40 | `/api/BillingDebt/process-failed-runs` | GET | HIGH |
| 41 | `/api/BillingDebt/process-pending-approvals` | GET | MEDIUM |
| 42 | `/api/BillingDebt/process-handover-queues` | GET | MEDIUM |
| 43 | `/api/BillingDebt/process-termination-queues` | GET | MEDIUM |

**TOTAL: 43 Platinum API endpoints (27 unique, 16 shared with other components)**

---

## 11. BLOCKERS & DEPENDENCIES

| # | Blocker | Impact | Owner | Status |
|---|---|---|---|---|
| B1 | Section 129 templates must exist in Platinum as configurable objects | S129-01 config dropdown will be empty without templates | Platinum API Team | OPEN |
| B2 | SMS templates must be registered in Platinum SMS gateway | Config SMS template dropdown requires SMS template registry | Platinum API Team | OPEN |
| B3 | Additional billing types must be defined in Platinum billing module | Config cost items need billing type lookups | Platinum API Team | OPEN |
| B4 | Attorney master data must be maintained in Platinum | Config rotation, handover submit, termination all need attorney data | Platinum API Team | OPEN |
| B5 | File storage for Section 129 notices — Platinum must define where generated PDFs are stored | Run files and download require file storage infrastructure | Platinum API Team | OPEN |
| B6 | Risk scoring algorithm — Platinum must implement the weighted factor scoring engine | RS-01 score-account needs calculation logic | Platinum API Team | OPEN |
| B7 | Qualification rule evaluation engine — Platinum must implement condition evaluation logic | QR-05 run endpoint needs rule engine | Platinum API Team | OPEN |
| B8 | Process monitoring data source — Platinum must aggregate run status from all debt processes | PM-01 through PM-06 need cross-module visibility | Platinum API Team | OPEN |
| B9 | Permission matrix — PROCESS_SECTION129 vs AUTHORISE_SECTION129 separation must be enforced in Platinum user roles | Auth/permission checks rely on role assignments | Platinum API Team | OPEN |
| B10 | Binary file proxy — Section 129 download uses direct binary streaming; Platinum must return proper Content-Type/Content-Disposition headers | File downloads will fail without proper headers | Platinum API Team | OPEN |

---

## 12. SIGN-OFF CHECKLIST

| # | Item | Verified |
|---|---|---|
| 1 | All Section 129 Config frontend paths (6 endpoints) match backend routes | YES |
| 2 | All Section 129 Notices frontend paths (13 endpoints) match backend routes | YES |
| 3 | All Section 129 Trial Review frontend paths (3 endpoints) match backend routes | YES |
| 4 | All Section 129 Authorization frontend paths (2 endpoints) match backend routes | YES |
| 5 | All Section 129 Report frontend paths (4 endpoints) match backend routes | YES |
| 6 | All Handover Management frontend paths (6 endpoints) match backend routes | YES |
| 7 | All Handover Termination frontend paths (3 endpoints) match backend routes | YES |
| 8 | All Handover Report frontend paths (3 endpoints) match backend routes | YES |
| 9 | All Risk Scoring frontend paths (5 endpoints) match backend routes | YES |
| 10 | All Qualification Rules frontend paths (5 endpoints) match backend routes | YES |
| 11 | All Process Monitoring frontend paths (6 endpoints) match backend routes | YES |
| 12 | No legacy/incorrect API paths found — zero fixes required | YES |
| 13 | Section 129 permission separation (PROCESS vs AUTHORISE) verified in middleware | YES |
| 14 | Handover permission (HANDOVER_PROCESS) verified in middleware | YES |
| 15 | All write routes inject audit fields via `injectAuditFields()` | YES |
| 16 | Review routes inject `isReview: true`; termination routes inject `isTermination: true` | YES |
| 17 | Binary file download proxy verified with proper header forwarding | YES |
| 18 | All TypeScript models/types defined in `debt.models.ts` | YES |
| 19 | Config constants (SECTION129_DEFAULTS, TERMINATION_REASONS, RISK_COLORS, etc.) verified in `debt-config.ts` | YES |
| 20 | Error handling uses `toast.error()` or `toast.show(msg, 'error')` — no silent fallbacks | YES |
| 21 | No hardcoded data, no `_synthetic: true`, no local DB usage | YES |
| 22 | 43 Platinum API endpoints documented with full request/response contracts | YES |
| 23 | 10 blockers identified and documented | YES |
| 24 | Angular build compiles with zero errors | YES |

---

**END OF PHASE 8-9 DETAIL PACK**

# PHASE 6-7: Documents, Signatures, Process Engine & Analytics — Detail Pack

**Document Version**: 1.0  
**Date**: 11/03/2026  
**Status**: DESIGN COMPLETE — PENDING API TEAM BUILD  
**Covers**: Phase 6 (Document Templates & Digital Signatures) + Phase 7 (Process Engine & Analytics)

---

## TABLE OF CONTENTS

1. [Frontend Audit Summary](#1-frontend-audit-summary)
2. [Phase 6: Document Templates — API Contracts](#2-phase-6-document-templates)
3. [Phase 6: Digital Signatures — API Contracts](#3-phase-6-digital-signatures)
4. [Phase 7: Process Engine — API Contracts](#4-phase-7-process-engine)
5. [Phase 7: Analytics — API Contracts](#5-phase-7-analytics)
6. [Middleware & Security](#6-middleware--security)
7. [Angular Model Definitions](#7-angular-model-definitions)
8. [Checklist for Platinum API Team](#8-checklist-for-platinum-api-team)
9. [Blockers & Dependencies](#9-blockers--dependencies)
10. [Sign-Off Checklist](#10-sign-off-checklist)

---

## 1. FRONTEND AUDIT SUMMARY

### Phase 6: Document Templates (document-templates.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 1 | `/api/document-templates` | GET | `analytics.routes.ts:209` | `/api/BillingDebt/document-templates` | ALIGNED |
| 2 | `/api/document-templates` | POST | `analytics.routes.ts:229` | `/api/BillingDebt/document-templates` | ALIGNED |
| 3 | `/api/document-templates/:id` | PUT | `analytics.routes.ts:240` | `/api/BillingDebt/document-templates/:id` | ALIGNED |
| 4 | `/api/document-templates/:id/versions` | GET | `analytics.routes.ts:219` | `/api/BillingDebt/document-templates/:id/versions` | ALIGNED |
| 5 | `/api/document-templates/:id/upload` | POST | `analytics.routes.ts:251` | `/api/BillingDebt/document-templates/:id/upload` | ALIGNED |
| 6 | `/api/document-templates/:id/download` | GET | `analytics.routes.ts:262` | `/api/BillingDebt/document-templates/:id/download` | ALIGNED |
| 7 | `/api/document-templates/:id/download?versionId=X` | GET | Same as #6 (query param) | `/api/BillingDebt/document-templates/:id/download?versionId=X` | FIXED — was using non-existent `/versions/:versionId/download` path |

### Phase 6: Digital Signatures (digital-signatures.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 1 | `/api/digital-signatures` | GET | `analytics.routes.ts:272` | `/api/BillingDebt/digital-signatures` | ALIGNED |
| 2 | `/api/digital-signatures/audit-log` | GET | `analytics.routes.ts:282` | `/api/BillingDebt/digital-signatures/audit-log` | ALIGNED |
| 3 | `/api/digital-signatures/:id` | GET | `analytics.routes.ts:292` | `/api/BillingDebt/digital-signatures/:id` | ALIGNED |
| 4 | `/api/digital-signatures` | POST | `analytics.routes.ts:302` | `/api/BillingDebt/digital-signatures` | ALIGNED |

### Phase 7: Process Engine (process-engine.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 1 | `/api/process-engine/workflows` | GET | `analytics.routes.ts:313` | `/api/BillingDebt/process-workflows` | ALIGNED |
| 2 | `/api/process-engine/workflows` | POST | `analytics.routes.ts:333` | `/api/BillingDebt/process-workflows` | ALIGNED |
| 3 | `/api/process-engine/workflows/:id` | PUT | `analytics.routes.ts:344` | `/api/BillingDebt/process-workflows/:id` | ALIGNED |
| 4 | `/api/process-engine/workflows/:id` | DELETE | `analytics.routes.ts:355` | `/api/BillingDebt/process-workflows/:id/delete` | ALIGNED |
| 5 | `/api/process-engine/workflows/:id/stages` | GET | `analytics.routes.ts:366` | `/api/BillingDebt/process-workflows/:id/stages` | ALIGNED |
| 6 | `/api/process-engine/workflows/:id/stages` | POST | `analytics.routes.ts:376` | `/api/BillingDebt/process-workflows/:id/stages` | ALIGNED |
| 7 | `/api/process-engine/workflows/:wfId/stages/:stageId` | PUT | `analytics.routes.ts:387` | `/api/BillingDebt/process-workflows/:wfId/stages/:stageId` | ALIGNED |
| 8 | `/api/process-engine/workflows/:wfId/stages/:stageId` | DELETE | `analytics.routes.ts:398` | `/api/BillingDebt/process-workflows/:wfId/stages/:stageId/delete` | ALIGNED |
| 9 | `/api/process-engine/workflows/:wfId/stages/reorder` | POST | `analytics.routes.ts:409` | `/api/BillingDebt/process-workflows/:wfId/stages/reorder` | ALIGNED |

### Phase 7: Analytics — Executive Dashboard (executive-dashboard.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 1 | `/api/analytics/debt-overview` | GET | `analytics.routes.ts:11` | `/api/BillingDashboard/debt-overview` | ALIGNED |
| 2 | `/api/analytics/aging-analysis` | GET | `analytics.routes.ts:22` | `/api/BillingDashboard/aging-analysis` | ALIGNED |
| 3 | `/api/analytics/recovery-stats` | GET | `analytics.routes.ts:33` | `/api/BillingDashboard/recovery-stats` | ALIGNED |
| 4 | `/api/analytics/legal-pipeline` | GET | `analytics.routes.ts:44` | `/api/BillingDashboard/legal-pipeline` | ALIGNED |
| 5 | `/api/analytics/attorney-performance` | GET | `analytics.routes.ts:55` | `/api/BillingDashboard/attorney-performance` | ALIGNED |
| 6 | `/api/analytics/risk-distribution` | GET | `analytics.routes.ts:66` | `/api/BillingDashboard/risk-distribution` | ALIGNED |

### Phase 7: Analytics — Predictive Forecasting (predictive-forecasting.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 7 | `/api/analytics/predictive-forecasting` | GET | `analytics.routes.ts:77` | `/api/BillingDashboard/predictive-forecasting` | ALIGNED |

### Phase 7: Analytics — Geographic Mapping (geographic-mapping.component.ts)
| # | Frontend Path | HTTP Method | Backend Route | Platinum API Path | Status |
|---|---|---|---|---|---|
| 8 | `/api/analytics/geographic-distribution` | GET | `analytics.routes.ts:88` | `/api/BillingDashboard/geographic-distribution` | ALIGNED |

### Fixes Applied This Session
| Component | Fix | Before | After |
|---|---|---|---|
| Document Templates | Version-specific download path | `/api/document-templates/:id/versions/:versionId/download` | `/api/document-templates/:id/download?versionId=X` |
| Process Engine | 7 remaining legacy paths | `/api/process-workflows/${wfId}/...` | `/api/process-engine/workflows/${wfId}/...` |

---

## 2. PHASE 6: DOCUMENT TEMPLATES — API CONTRACTS

### DT-01: List Document Templates
```
GET /api/BillingDebt/document-templates
Auth: Session (requireAuth)
Query: ?category=SECTION_129&search=notice&isActive=true
Response 200:
{
  "templates": [
    {
      "id": "string|number",
      "templateCode": "string",
      "name": "string",
      "category": "SECTION_129|HANDOVER|AOD|CLEARANCE|GENERAL",
      "description": "string|null",
      "currentVersion": "string (e.g. '1.2')",
      "isActive": true,
      "fileType": "string|null (e.g. 'docx', 'pdf')",
      "createdAt": "ISO date",
      "modifiedAt": "ISO date"
    }
  ]
}
```

### DT-02: Create Document Template
```
POST /api/BillingDebt/document-templates
Auth: Session (requireAuth + requireLegalAdmin)
Body:
{
  "name": "string (required)",
  "templateCode": "string (required, unique identifier)",
  "category": "SECTION_129|HANDOVER|AOD|CLEARANCE|GENERAL",
  "description": "string|null",
  "isActive": true,
  "userId": "injected by middleware",
  "auditTimestamp": "injected by middleware"
}
Response 201:
{
  "id": "string|number",
  "templateCode": "string",
  "name": "string",
  "category": "string",
  "currentVersion": "1.0",
  "isActive": true,
  "createdAt": "ISO date"
}
```

### DT-03: Update Document Template
```
PUT → POST /api/BillingDebt/document-templates/:templateId
Auth: Session (requireAuth + requireLegalAdmin)
Note: Express route is PUT, proxied as POST to Platinum
Body:
{
  "name": "string",
  "templateCode": "string",
  "category": "string",
  "description": "string|null",
  "isActive": true,
  "userId": "injected",
  "auditTimestamp": "injected"
}
Response 200: { "success": true, "template": { ...updated } }
```

### DT-04: Get Template Versions
```
GET /api/BillingDebt/document-templates/:templateId/versions
Auth: Session (requireAuth)
Response 200:
{
  "versions": [
    {
      "id": "string|number",
      "templateId": "string|number",
      "version": "string (e.g. '1.2')",
      "changeNotes": "string|null",
      "fileSize": number|null,
      "uploadedBy": "string|null",
      "uploadedAt": "ISO date|null",
      "isActive": true
    }
  ]
}
```

### DT-05: Upload Template Version
```
POST /api/BillingDebt/document-templates/:templateId/upload
Auth: Session (requireAuth + requireLegalAdmin)
Body:
{
  "version": "string (e.g. '1.3')",
  "changeNotes": "string|null",
  "fileName": "string|null",
  "userId": "injected",
  "auditTimestamp": "injected"
}
Response 201: { "success": true, "version": { ...new version object } }
```

### DT-06: Download Template
```
GET /api/BillingDebt/document-templates/:templateId/download
Auth: Session (requireAuth)
Query: ?versionId=X (optional, defaults to current version)
Response 200: Binary file stream or { "downloadUrl": "string" }
```

---

## 3. PHASE 6: DIGITAL SIGNATURES — API CONTRACTS

### DS-01: List Signature Requests
```
GET /api/BillingDebt/digital-signatures
Auth: Session (requireAuth)
Query: ?status=PENDING&documentType=AOD&search=account123
Response 200:
{
  "requests": [
    {
      "id": "string|number",
      "accountNo": "string",
      "documentType": "AOD|SECTION_129|HANDOVER|POWER_OF_ATTORNEY|CONSENT|SETTLEMENT",
      "signerName": "string",
      "signerEmail": "string",
      "signerPhone": "string|null",
      "amount": number|null,
      "description": "string|null",
      "status": "PENDING|SENT|SIGNED|DECLINED|EXPIRED|CANCELLED",
      "signedAt": "ISO date|null",
      "expiresAt": "ISO date|null",
      "createdAt": "ISO date",
      "notes": "string|null"
    }
  ]
}
```

### DS-02: Get Signature Detail
```
GET /api/BillingDebt/digital-signatures/:requestId
Auth: Session (requireAuth)
Response 200:
{
  "id": "string|number",
  "accountNo": "string",
  "documentType": "string",
  "signerName": "string",
  "signerEmail": "string",
  "signerPhone": "string|null",
  "amount": number|null,
  "description": "string|null",
  "status": "string",
  "signedAt": "ISO date|null",
  "expiresAt": "ISO date|null",
  "signatureData": "string|null (base64 or URL)",
  "documentUrl": "string|null",
  "auditTrail": [
    { "action": "string", "timestamp": "ISO date", "user": "string", "details": "string|null" }
  ],
  "createdAt": "ISO date",
  "notes": "string|null"
}
```

### DS-03: Create Signature Request
```
POST /api/BillingDebt/digital-signatures
Auth: Session (requireAuth + requireLegalAdmin)
Body:
{
  "accountNo": "string (required)",
  "documentType": "AOD|SECTION_129|HANDOVER|POWER_OF_ATTORNEY|CONSENT|SETTLEMENT",
  "signerName": "string (required)",
  "signerEmail": "string (required)",
  "signerMobile": "string|null",
  "amount": number|null,
  "notes": "string|null",
  "expiryDays": number (default 7),
  "userId": "injected",
  "auditTimestamp": "injected"
}
Response 201:
{
  "id": "string|number",
  "status": "SENT",
  "expiresAt": "ISO date",
  "message": "Signature request sent to signer"
}
```

### DS-04: Get Signature Audit Log
```
GET /api/BillingDebt/digital-signatures/audit-log
Auth: Session (requireAuth)
Query: ?from=2026-01-01&to=2026-03-11&requestId=X
Response 200:
{
  "entries": [
    {
      "id": "string|number",
      "requestId": "string|number",
      "action": "CREATED|SENT|VIEWED|SIGNED|DECLINED|EXPIRED|CANCELLED",
      "timestamp": "ISO date",
      "userId": "string",
      "ipAddress": "string|null",
      "details": "string|null"
    }
  ]
}
```

---

## 4. PHASE 7: PROCESS ENGINE — API CONTRACTS

### PE-01: List Process Workflows
```
GET /api/BillingDebt/process-workflows
Auth: Session (requireAuth)
Query: ?isActive=true
Response 200:
{
  "workflows": [
    {
      "id": "string|number",
      "name": "string",
      "description": "string|null",
      "isActive": true,
      "version": "string|null",
      "stageCount": number,
      "createdAt": "ISO date",
      "modifiedAt": "ISO date"
    }
  ]
}
```

### PE-02: Create Process Workflow
```
POST /api/BillingDebt/process-workflows
Auth: Session (requireAuth + requireLegalAdmin)
Body:
{
  "name": "string (required)",
  "description": "string|null",
  "isActive": true,
  "userId": "injected",
  "auditTimestamp": "injected"
}
Response 201: { "id": "string|number", "name": "string", "isActive": true, "createdAt": "ISO date" }
```

### PE-03: Update Process Workflow
```
PUT → POST /api/BillingDebt/process-workflows/:workflowId
Auth: Session (requireAuth + requireLegalAdmin)
Body:
{
  "name": "string",
  "description": "string|null",
  "isActive": true,
  "userId": "injected",
  "auditTimestamp": "injected"
}
Response 200: { "success": true, "workflow": { ...updated } }
```

### PE-04: Delete Process Workflow
```
DELETE → POST /api/BillingDebt/process-workflows/:workflowId/delete
Auth: Session (requireAuth + requireLegalAdmin)
Body: { "userId": "injected", "auditTimestamp": "injected" }
Response 200: { "success": true }
Note: Cascades to all stages, rules, actions, templates under this workflow
```

### PE-05: List Workflow Stages
```
GET /api/BillingDebt/process-workflows/:workflowId/stages
Auth: Session (requireAuth)
Response 200:
{
  "stages": [
    {
      "id": "string|number",
      "workflowId": "string|number",
      "stageNumber": number,
      "name": "string",
      "description": "string|null",
      "isActive": true,
      "rules": [{ "id": "opt", "field": "string", "operator": "string", "value": "string", "logicOperator": "AND|OR" }],
      "templates": [{ "id": "opt", "templateCode": "string", "templateName": "string", "channel": "SMS|EMAIL|LETTER|WHATSAPP" }],
      "actions": [{ "id": "opt", "actionType": "string", "description": "string|null", "isAutomated": true, "config": "string|null" }],
      "timer": { "waitDays": 14, "businessDaysOnly": true, "escalateOnExpiry": false }
    }
  ]
}
```

### PE-06: Create Workflow Stage
```
POST /api/BillingDebt/process-workflows/:workflowId/stages
Auth: Session (requireAuth + requireLegalAdmin)
Body:
{
  "workflowId": "string|number",
  "stageNumber": number,
  "name": "string (required)",
  "description": "string|null",
  "isActive": true,
  "rules": [{ "field": "daysPastDue|totalDebt|riskScore|accountType|serviceType|paymentHistory", "operator": "gte|lte|eq|neq|gt|lt|contains|in", "value": "string", "logicOperator": "AND|OR" }],
  "templates": [{ "templateCode": "string", "templateName": "string", "channel": "SMS|EMAIL|LETTER|WHATSAPP" }],
  "actions": [{ "actionType": "SEND_SMS|SEND_EMAIL|SEND_LETTER|RESTRICT_SERVICES|HANDOVER|ESCALATE|GENERATE_NOTICE|UPDATE_STATUS", "description": "string|null", "isAutomated": true, "config": "string|null" }],
  "timer": { "waitDays": 14, "businessDaysOnly": true, "escalateOnExpiry": false },
  "userId": "injected",
  "auditTimestamp": "injected"
}
Response 201: { "id": "string|number", "stageNumber": number, "name": "string" }
```

### PE-07: Update Workflow Stage
```
PUT → POST /api/BillingDebt/process-workflows/:workflowId/stages/:stageId
Auth: Session (requireAuth + requireLegalAdmin)
Body: Same as PE-06
Response 200: { "success": true, "stage": { ...updated } }
```

### PE-08: Delete Workflow Stage
```
DELETE → POST /api/BillingDebt/process-workflows/:workflowId/stages/:stageId/delete
Auth: Session (requireAuth + requireLegalAdmin)
Body: { "userId": "injected", "auditTimestamp": "injected" }
Response 200: { "success": true }
```

### PE-09: Reorder Workflow Stages
```
POST /api/BillingDebt/process-workflows/:workflowId/stages/reorder
Auth: Session (requireAuth + requireLegalAdmin)
Body:
[
  { "id": "string|number", "stageNumber": 1 },
  { "id": "string|number", "stageNumber": 2 },
  ...
]
Note: Array wrapped with audit fields by middleware: { stages: [...], userId, auditTimestamp }
Response 200: { "success": true }
```

---

## 5. PHASE 7: ANALYTICS — API CONTRACTS

### AN-01: Debt Overview
```
GET /api/BillingDashboard/debt-overview
Auth: Session (requireAuth + requireLegalAdmin)
Response 200:
{
  "totalDebt": number,
  "totalAccounts": number,
  "averageDebt": number,
  "collectionRate": number,
  "activeNotices": number,
  "pendingHandovers": number
}
```

### AN-02: Aging Analysis
```
GET /api/BillingDashboard/aging-analysis
Auth: Session (requireAuth + requireLegalAdmin)
Response 200:
{
  "agingBuckets": { "current": number, "days30": number, "days60": number, "days90": number, "days120plus": number },
  "agingAmounts": { "current": number, "days30": number, "days60": number, "days90": number, "days120plus": number }
}
```

### AN-03: Recovery Stats
```
GET /api/BillingDashboard/recovery-stats
Auth: Session (requireAuth + requireLegalAdmin)
Response 200:
{
  "totalCommunications": number,
  "allTime": { "SMS": { "sent": number, "delivered": number }, "EMAIL": {...}, "LETTER": {...} },
  "last30Days": { ...same channel structure },
  "last60Days": { ...same channel structure },
  "last90Days": { ...same channel structure }
}
```

### AN-04: Legal Pipeline
```
GET /api/BillingDashboard/legal-pipeline
Auth: Session (requireAuth + requireLegalAdmin)
Response 200:
{
  "totalLegalActions": number,
  "pipeline": {
    "Section 129 Notices": number,
    "Handover Initiated": number,
    "In Collection": number,
    "Recovered": number
  }
}
```

### AN-05: Attorney Performance
```
GET /api/BillingDashboard/attorney-performance
Auth: Session (requireAuth + requireLegalAdmin)
Response 200:
{
  "attorneys": [
    {
      "attorneyName": "string",
      "handedOverCount": number,
      "handedOverAmount": number,
      "recoveredAmount": number,
      "recoveryRate": number (0-100)
    }
  ]
}
```

### AN-06: Risk Distribution
```
GET /api/BillingDashboard/risk-distribution
Auth: Session (requireAuth + requireLegalAdmin)
Response 200:
{
  "totalScored": number,
  "distribution": {
    "LOW": { "count": number, "avgScore": number },
    "MEDIUM": { "count": number, "avgScore": number },
    "HIGH": { "count": number, "avgScore": number }
  }
}
```

### AN-07: Predictive Forecasting
```
GET /api/BillingDashboard/predictive-forecasting
Auth: Session (requireAuth + requireLegalAdmin)
Response 200:
{
  "predictedRecoveryRate": number (0-100),
  "confidenceScore": number (0-100),
  "forecast": {
    "next30Days": { "estimatedRate": number },
    "next60Days": { "estimatedRate": number },
    "next90Days": { "estimatedRate": number }
  },
  "riskBreakdown": {
    "low": { "count": number, "avgScore": number, "expectedRecovery": number },
    "medium": { "count": number, "avgScore": number, "expectedRecovery": number },
    "high": { "count": number, "avgScore": number, "expectedRecovery": number }
  },
  "deliveryTrend": [
    { "period": "string (e.g. 'Jan 2026')", "rate": number }
  ],
  "channelEffectiveness": {
    "SMS": { "rate": number, "sent": number, "delivered": number },
    "EMAIL": { "rate": number, "sent": number, "delivered": number },
    ...
  },
  "keyDrivers": [
    { "name": "string", "weight": number, "impact": "HIGH|MEDIUM|LOW|POSITIVE|NEGATIVE" }
  ]
}
```

### AN-08: Geographic Distribution
```
GET /api/BillingDashboard/geographic-distribution
Auth: Session (requireAuth + requireLegalAdmin)
Response 200:
{
  "totalAccounts": number,
  "byWard": [{ "name": "string", "totalDebt": number, "accountCount": number, "avgDebt": number, "avgRiskScore": number, "riskCounts": { "HIGH": number, "MEDIUM": number, "LOW": number }, "dominantRisk": "string" }],
  "bySuburb": [...same shape],
  "byTown": [...same shape],
  "byPropertyType": [...same shape]
}
```

---

## 6. MIDDLEWARE & SECURITY

### Authentication Chain
All Phase 6-7 routes use the same middleware pattern:
```typescript
const session = requireAuth(req, res);     // Returns session or sends 401
if (!requireLegalAdmin(session, res)) return; // Checks permission, sends 403 if denied
```

### Audit Field Injection
All write operations (POST, PUT, DELETE) inject audit metadata via `injectAuditFields()`:
```typescript
injectAuditFields(session, req.body)
// Produces: { ...body, userId: session.userId, auditTimestamp: new Date().toISOString() }
```

### HTTP Method Mapping
- Express `PUT` routes are proxied as `POST` to Platinum (Platinum doesn't support PUT)
- Express `DELETE` routes are proxied as `POST` to Platinum with `/delete` suffix
- All `GET` routes pass `req.query` through as Platinum query parameters

### Route Registration
All Phase 6-7 routes registered in `server/routes/analytics.routes.ts` via `registerAnalyticsRoutes()`, called from `server/routes/index.ts`.

---

## 7. ANGULAR MODEL DEFINITIONS

### File: `angular-client/src/app/models/debt.models.ts`

```typescript
// Phase 6 — Document Templates
interface DocumentTemplate {
  id: number | string;
  templateCode: string;
  name: string;
  category: string;
  description?: string;
  currentVersion: string;
  isActive: boolean;
  fileType?: string;
  createdAt?: string;
  modifiedAt?: string;
}

interface TemplateVersion {
  id: number | string;
  templateId: number | string;
  version: string;
  changeNotes?: string;
  fileSize?: number;
  uploadedBy?: string;
  uploadedAt?: string;
  isActive?: boolean;
}

// Phase 6 — Digital Signatures
interface SignatureRequest {
  id: number | string;
  accountNo: string;
  documentType: string;
  signerName: string;
  signerEmail: string;
  signerPhone?: string;
  amount?: number;
  description?: string;
  status: string;
  signedAt?: string;
  expiresAt?: string;
  signatureData?: string;
  documentUrl?: string;
  auditTrail?: { action: string; timestamp: string; user: string; details?: string }[];
  createdAt?: string;
  notes?: string;
}

// Phase 7 — Process Engine
interface ProcessWorkflow {
  id: number | string;
  name: string;
  description?: string;
  isActive: boolean;
  version?: string;
  stageCount?: number;
  createdAt?: string;
  modifiedAt?: string;
}

interface StageRule {
  id?: number | string;
  field: string;
  operator: string;
  value: string;
  logicOperator?: string;
}

interface StageTemplate {
  id?: number | string;
  templateCode: string;
  templateName: string;
  channel?: string;
}

interface StageAction {
  id?: number | string;
  actionType: string;
  description?: string;
  isAutomated: boolean;
  config?: string;
}

interface StageTimer {
  waitDays: number;
  businessDaysOnly: boolean;
  escalateOnExpiry: boolean;
}

interface WorkflowStage {
  id: number | string;
  workflowId: number | string;
  stageNumber: number;
  name: string;
  description?: string;
  isActive: boolean;
  rules: StageRule[];
  templates: StageTemplate[];
  actions: StageAction[];
  timer: StageTimer;
}
```

### File: `angular-client/src/app/models/analytics.models.ts`

```typescript
// Phase 7 — Analytics
interface DebtOverview { totalDebt: number; totalAccounts: number; averageDebt: number; collectionRate: number; activeNotices: number; pendingHandovers: number; }
interface AgingAnalysis { current: number; days30: number; days60: number; days90: number; days120: number; days150: number; days180Plus: number; }
interface RecoveryStats { totalRecovered: number; recoveryRate: number; byPeriod: { period: string; rate: number; amount: number }[]; byChannel: { channel: string; recovered: number; count: number }[]; }
interface LegalPipelineStage { stage: string; count: number; amount: number; }
interface AttorneyPerformance { attorneyName: string; handedOverCount: number; handedOverAmount: number; recoveredAmount: number; recoveryRate: number; }
interface RiskDistributionItem { category: string; count: number; amount: number; percentage: number; }
interface GeoItem { name: string; totalDebt: number; accountCount: number; avgDebt: number; avgRiskScore: number; riskCounts: Record<string, number>; dominantRisk: string; }
interface ForecastScenario { name: string; description: string; impact: string; predictedRecovery: number; confidence: number; timeframe: string; factors: { name: string; weight: number; trend: string }[]; }
interface ForecastData { currentRecoveryRate: number; predictedRecoveryRate: number; confidence: number; trends: { period: string; rate: number }[]; scenarios: ForecastScenario[]; recommendations: { title: string; description: string; impact: string; priority: string }[]; }

// Shared types
type ViewTab = 'ward' | 'suburb' | 'town' | 'propertyType';
type SortField = 'name' | 'totalDebt' | 'accountCount' | 'avgDebt' | 'avgRiskScore';
type SortDir = 'asc' | 'desc';
```

### File: `angular-client/src/app/services/debt-config.ts` (Phase 6-7 config constants)

```typescript
TEMPLATE_CATEGORIES: [
  { value: 'SECTION_129', label: 'Section 129' },
  { value: 'HANDOVER', label: 'Handover' },
  { value: 'AOD', label: 'Acknowledgement of Debt' },
  { value: 'CLEARANCE', label: 'Clearance' },
  { value: 'GENERAL', label: 'General' }
]

DOC_TYPES: [
  { value: 'AOD', label: 'Acknowledgement of Debt' },
  { value: 'SECTION_129', label: 'Section 129 Notice' },
  { value: 'HANDOVER', label: 'Handover Notice' },
  { value: 'POWER_OF_ATTORNEY', label: 'Power of Attorney' },
  { value: 'CONSENT', label: 'Consent Form' },
  { value: 'SETTLEMENT', label: 'Settlement Agreement' }
]

SIGNATURE_STATUS_LABELS: { PENDING, SENT, SIGNED, DECLINED, EXPIRED, CANCELLED }

RULE_FIELDS: daysPastDue, totalDebt, riskScore, accountType, serviceType, paymentHistory
RULE_OPERATORS: gte, lte, eq, neq, gt, lt, contains, in
WORKFLOW_ACTION_TYPES: SEND_SMS, SEND_EMAIL, SEND_LETTER, RESTRICT_SERVICES, HANDOVER, ESCALATE, GENERATE_NOTICE, UPDATE_STATUS
CHANNEL_OPTIONS: SMS, EMAIL, LETTER, WHATSAPP
RISK_COLORS: HIGH, MEDIUM, LOW, UNKNOWN
```

---

## 8. CHECKLIST FOR PLATINUM API TEAM

### Phase 6: Document Templates — Platinum Must Build
| # | Endpoint | Method | Priority |
|---|---|---|---|
| 1 | `/api/BillingDebt/document-templates` | GET | HIGH |
| 2 | `/api/BillingDebt/document-templates` | POST | HIGH |
| 3 | `/api/BillingDebt/document-templates/:id` | POST (update) | HIGH |
| 4 | `/api/BillingDebt/document-templates/:id/versions` | GET | HIGH |
| 5 | `/api/BillingDebt/document-templates/:id/upload` | POST | HIGH |
| 6 | `/api/BillingDebt/document-templates/:id/download` | GET | HIGH |

### Phase 6: Digital Signatures — Platinum Must Build
| # | Endpoint | Method | Priority |
|---|---|---|---|
| 7 | `/api/BillingDebt/digital-signatures` | GET | HIGH |
| 8 | `/api/BillingDebt/digital-signatures/:id` | GET | MEDIUM |
| 9 | `/api/BillingDebt/digital-signatures` | POST | HIGH |
| 10 | `/api/BillingDebt/digital-signatures/audit-log` | GET | MEDIUM |

### Phase 7: Process Engine — Platinum Must Build
| # | Endpoint | Method | Priority |
|---|---|---|---|
| 11 | `/api/BillingDebt/process-workflows` | GET | HIGH |
| 12 | `/api/BillingDebt/process-workflows` | POST | HIGH |
| 13 | `/api/BillingDebt/process-workflows/:id` | POST (update) | HIGH |
| 14 | `/api/BillingDebt/process-workflows/:id/delete` | POST | HIGH |
| 15 | `/api/BillingDebt/process-workflows/:id/stages` | GET | HIGH |
| 16 | `/api/BillingDebt/process-workflows/:id/stages` | POST | HIGH |
| 17 | `/api/BillingDebt/process-workflows/:id/stages/:stageId` | POST (update) | MEDIUM |
| 18 | `/api/BillingDebt/process-workflows/:id/stages/:stageId/delete` | POST | MEDIUM |
| 19 | `/api/BillingDebt/process-workflows/:id/stages/reorder` | POST | LOW |

### Phase 7: Analytics — Platinum Must Build
| # | Endpoint | Method | Priority |
|---|---|---|---|
| 20 | `/api/BillingDashboard/debt-overview` | GET | HIGH |
| 21 | `/api/BillingDashboard/aging-analysis` | GET | HIGH |
| 22 | `/api/BillingDashboard/recovery-stats` | GET | HIGH |
| 23 | `/api/BillingDashboard/legal-pipeline` | GET | HIGH |
| 24 | `/api/BillingDashboard/attorney-performance` | GET | MEDIUM |
| 25 | `/api/BillingDashboard/risk-distribution` | GET | MEDIUM |
| 26 | `/api/BillingDashboard/predictive-forecasting` | GET | MEDIUM |
| 27 | `/api/BillingDashboard/geographic-distribution` | GET | MEDIUM |

**TOTAL: 27 Platinum API endpoints to build**

---

## 9. BLOCKERS & DEPENDENCIES

| # | Blocker | Impact | Owner | Status |
|---|---|---|---|---|
| B1 | Document template file storage — Platinum must define storage mechanism (blob, S3, file share) | DT-05, DT-06 file upload/download won't function | Platinum API Team | OPEN |
| B2 | Digital signature provider — Platinum must integrate with an e-signature service (DocuSign, SignRequest, etc.) | DS-03 create request won't deliver to signer | Platinum API Team | OPEN |
| B3 | Process workflow execution engine — Platinum must implement workflow runner that evaluates stage rules and triggers actions | PE-05 through PE-09 are config only; no execution | Platinum API Team | OPEN |
| B4 | Predictive forecasting model — Platinum must implement ML/statistical model for recovery prediction | AN-07 will return empty/placeholder data | Platinum API Team | OPEN |
| B5 | Geographic data source — Platinum must have ward/suburb/town mappings linked to consumer accounts | AN-08 depends on spatial data availability | Platinum API Team | OPEN |
| B6 | Attorney master data — Platinum must maintain attorney records for performance tracking | AN-05 depends on attorney entity | Platinum API Team | OPEN |
| B7 | Batch processing integration — Process engine stages with `isAutomated: true` need Service Bus queue integration | Automated actions won't fire without queue | Azure + Platinum | OPEN |
| B8 | Template version file validation — Upload endpoint needs MIME type validation and size limits | Security concern for DT-05 | Platinum API Team | OPEN |

---

## 10. SIGN-OFF CHECKLIST

| # | Item | Verified |
|---|---|---|
| 1 | All Phase 6 Document Templates frontend paths match backend routes | YES |
| 2 | All Phase 6 Digital Signatures frontend paths match backend routes | YES |
| 3 | All Phase 7 Process Engine frontend paths match backend routes (9 endpoints) | YES |
| 4 | All Phase 7 Analytics frontend paths match backend routes (8 endpoints) | YES |
| 5 | Version-specific download fixed to use query param instead of nested path | YES |
| 6 | All 7 remaining `/api/process-workflows/` legacy paths corrected to `/api/process-engine/workflows/` | YES |
| 7 | Angular build compiles with zero errors | YES |
| 8 | No legacy paths remain in any Phase 6-7 component | YES |
| 9 | All write routes have `requireLegalAdmin` permission check | YES |
| 10 | All write routes inject audit fields via `injectAuditFields()` | YES |
| 11 | All TypeScript models defined in `debt.models.ts` and `analytics.models.ts` | YES |
| 12 | Config constants (TEMPLATE_CATEGORIES, DOC_TYPES, RULE_FIELDS, etc.) defined in `debt-config.ts` | YES |
| 13 | Error handling uses `toast.error()` or `toast.show(msg, 'error')` — no `.catch(() => [])` | YES |
| 14 | No hardcoded data, no `_synthetic: true`, no local DB usage | YES |
| 15 | 27 Platinum API endpoints documented with full request/response contracts | YES |
| 16 | 8 blockers identified and documented | YES |
| 17 | PUT routes proxy as POST to Platinum (Platinum doesn't support PUT) | YES |
| 18 | DELETE routes proxy as POST with `/delete` suffix | YES |

---

**END OF PHASE 6-7 DETAIL PACK**

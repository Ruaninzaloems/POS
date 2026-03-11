# Phase 4–5 — Communication Engine, Batch Processing, Legal Compliance: Detail Pack

> **Revision**: v1
> **Date**: 2026-03-11
> **Scope**: Phase 4 (Communication Engine, Batch Processing, Process Monitoring) + Phase 5 (Legal Rules, Audit Trail, Evidence Bundles) + SMS Log Report
> **Frontend**: Angular 19 (`angular-client/src/app/features/debt/communication/`, `batch/`, `monitoring/`, `features/legal/`)
> **Backend**: Express proxy (`server/routes/communications.routes.ts`, `analytics.routes.ts`, `legal.routes.ts`, `debt.routes.ts`)
> **Platinum Controller**: `BillingDebt` (all endpoints below)

---

## 1. Frontend Path Audit — Fixes Applied

### 1.1 Communication Timeline (`communication-timeline.component.ts`) — 6 Fixes

| # | Old Frontend Path | New Frontend Path | HTTP | Backend Route | Platinum Endpoint |
|---|---|---|---|---|---|
| CT1 | `/api/communication-timelines` | `/api/communications/timelines` | GET | `communications.routes.ts` | `GET /api/BillingDebt/communication-timelines` |
| CT2 | `/api/communication-timelines/:id` | `/api/communications/timelines/:id` | GET | `communications.routes.ts` | `GET /api/BillingDebt/communication-timelines?id=:id` |
| CT3 | `/api/communication-timelines` | `/api/communications/timelines` | POST | `communications.routes.ts` | `POST /api/BillingDebt/communication-timelines` |
| CT4 | `/api/communication-timelines/:id` | `/api/communications/timelines/:id` | DELETE | `communications.routes.ts` | `POST /api/BillingDebt/communication-timelines-delete` |
| CT5 | `POST /api/communication-timelines/:id/steps` | `PUT /api/communications/timelines/:id/steps` | PUT | `communications.routes.ts` | `POST /api/BillingDebt/communication-timeline-steps` |
| CT6 | `POST /api/communication-timelines/:id/enroll` | `POST /api/communications/enroll` (+ `timelineId` in body) | POST | `communications.routes.ts` | `POST /api/BillingDebt/communication-enroll` |

### 1.2 Communication Dashboard (`communication-dashboard.component.ts`) — 5 Fixes

| # | Old Frontend Path | New Frontend Path | HTTP | Backend Route | Platinum Endpoint |
|---|---|---|---|---|---|
| CD1 | `/api/communication-stats` | `/api/communications/stats` | GET | `communications.routes.ts` | `GET /api/BillingDebt/communication-stats` |
| CD2 | `/api/communication-log` | `/api/communications/log` | GET | `communications.routes.ts` | `GET /api/BillingDebt/communication-log` |
| CD3 | `/api/scheduled-communications` | `/api/communications/scheduled` | GET | `communications.routes.ts` | `GET /api/BillingDebt/communication-scheduled` |
| CD4 | `/api/scheduled-communications/process` | `/api/communications/process-scheduled` | POST | `communications.routes.ts` | `POST /api/BillingDebt/communication-process-scheduled` |
| CD5 | `GET /api/accounts?search=` | `POST /api/platinum/billing-payment/search-accounts` | POST | `pos.routes.ts` | `POST /api/BillingPayment/search-accounts` |

### 1.3 SMS Log Report (`sms-log-report.component.ts`) — 1 Fix (was empty placeholder)

| # | Old Frontend Path | New Frontend Path | HTTP | Backend Route | Platinum Endpoint |
|---|---|---|---|---|---|
| SL1 | *(none — empty placeholder)* | `/api/platinum/billing-debt/sms-log-report` | GET | `debt.routes.ts` | `GET /api/BillingDebt/sms-log-report` |

### 1.4 Batch Processing (`batch-processing.component.ts`) — 4 Fixes

| # | Old Frontend Path | New Frontend Path | HTTP | Backend Route | Platinum Endpoint |
|---|---|---|---|---|---|
| BP1 | `/api/batch-jobs` | `/api/batch-processing/jobs` | GET | `analytics.routes.ts` | `GET /api/BillingDebt/batch-jobs` |
| BP2 | `/api/batch-schedules` | `/api/batch-processing/schedules` | GET | `analytics.routes.ts` | `GET /api/BillingDebt/batch-schedules` |
| BP3 | `/api/batch-jobs/trigger` | `/api/batch-processing/trigger` | POST | `analytics.routes.ts` | `POST /api/BillingDebt/batch-trigger` |
| BP4 | `/api/batch-jobs/:id/cancel` | `/api/batch-processing/cancel` (jobId in body) | POST | `analytics.routes.ts` | `POST /api/BillingDebt/batch-cancel` |

### 1.5 Process Monitoring (`process-monitoring.component.ts`) — 0 Fixes (already correct)

All 6 paths were already aligned:

| # | Frontend Path | HTTP | Backend Route | Platinum Endpoint |
|---|---|---|---|---|
| PM1 | `/api/process-monitoring/overview` | GET | `analytics.routes.ts` | `GET /api/BillingDebt/process-monitoring-overview` |
| PM2 | `/api/process-monitoring/active-runs` | GET | `analytics.routes.ts` | `GET /api/BillingDebt/process-active-runs` |
| PM3 | `/api/process-monitoring/failed-runs` | GET | `analytics.routes.ts` | `GET /api/BillingDebt/process-failed-runs` |
| PM4 | `/api/process-monitoring/pending-approvals` | GET | `analytics.routes.ts` | `GET /api/BillingDebt/process-pending-approvals` |
| PM5 | `/api/process-monitoring/handover-queues` | GET | `analytics.routes.ts` | `GET /api/BillingDebt/process-handover-queues` |
| PM6 | `/api/process-monitoring/termination-queues` | GET | `analytics.routes.ts` | `GET /api/BillingDebt/process-termination-queues` |

### 1.6 Legal Rules (`legal-rules.component.ts`) — 0 Fixes (already correct)

| # | Frontend Path | HTTP | Backend Route | Platinum Endpoint |
|---|---|---|---|---|
| LR1 | `/api/legal/rules` | GET | `legal.routes.ts` | `GET /api/BillingDebt/legal-rules` |
| LR2 | `/api/legal/rules` | POST | `legal.routes.ts` | `POST /api/BillingDebt/legal-rules` |
| LR3 | `/api/legal/rules/:id` | PUT | `legal.routes.ts` | `POST /api/BillingDebt/legal-rules-update` |
| LR4 | `/api/legal/rules/:id` | DELETE | `legal.routes.ts` | `POST /api/BillingDebt/legal-rules-deactivate` |

### 1.7 Audit Trail (`audit-trail.component.ts`) — 1 Fix

| # | Old Frontend Path | New Frontend Path | HTTP | Backend Route | Platinum Endpoint |
|---|---|---|---|---|---|
| AT1 | `/api/legal/compliance-logs` | `/api/legal/compliance-log` | GET | `legal.routes.ts` | `GET /api/BillingDebt/compliance-log` |

### 1.8 Evidence Bundle (`evidence-bundle.component.ts`) — 2 Fixes

| # | Old Frontend Path | New Frontend Path | HTTP | Backend Route | Platinum Endpoint |
|---|---|---|---|---|---|
| EB1 | `/api/legal/evidence-bundles/generate` | `/api/legal/evidence-bundle` | POST | `legal.routes.ts` | `POST /api/BillingDebt/evidence-bundle` |
| EB2 | `/api/legal/evidence-bundles/:id` | `/api/legal/evidence-bundle/:id` | GET | `legal.routes.ts` | `GET /api/BillingDebt/evidence-bundle?id=:id` |

*(Note: list endpoint `GET /api/legal/evidence-bundles` (plural) was already correct)*

---

## 2. API Contracts — Phase 4 Communication Engine

### C1: GET Communication Stats
```
Frontend:  GET /api/communications/stats
Express:   GET /api/communications/stats
Platinum:  GET /api/BillingDebt/communication-stats
Auth:      requireAuth
Response:  {
  totalSent: number, totalDelivered: number, totalFailed: number, totalPending: number,
  byChannel: Record<string, { sent: number, failed: number, delivered: number }>
}
```

### C2: GET Communication Log
```
Frontend:  GET /api/communications/log?limit=10&offset=0&channel=sms&status=DELIVERED&accountNo=123
Express:   GET /api/communications/log
Platinum:  GET /api/BillingDebt/communication-log
Auth:      requireAuth
Response:  { logs: Array<{ id, accountNo, channel, recipient, messageBody, subject, status, sentAt, deliveredAt, errorMessage }>, total: number }
```

### C3: GET Communication Scheduled
```
Frontend:  GET /api/communications/scheduled?limit=10&offset=0&status=PENDING
Express:   GET /api/communications/scheduled
Platinum:  GET /api/BillingDebt/communication-scheduled
Auth:      requireAuth
Response:  { scheduled: Array<{ id, accountNo, channel, scheduledFor, status, timelineId, stepDay }>, total: number }
```

### C4: POST Process Scheduled Communications
```
Frontend:  POST /api/communications/process-scheduled
Express:   POST /api/communications/process-scheduled
Platinum:  POST /api/BillingDebt/communication-process-scheduled
Auth:      requireAuth + requireLegalAdmin
Payload:   {} (audit fields injected server-side)
Response:  { processed: number, succeeded: number, failed: number }
```

### C5: GET Communication Timelines
```
Frontend:  GET /api/communications/timelines
Express:   GET /api/communications/timelines
Platinum:  GET /api/BillingDebt/communication-timelines
Auth:      requireAuth
Response:  Array<{ id, name, description, isActive, stepCount, createdAt }>
```

### C6: GET Communication Timeline Detail
```
Frontend:  GET /api/communications/timelines/:id
Express:   GET /api/communications/timelines/:id
Platinum:  GET /api/BillingDebt/communication-timelines?id=:id
Auth:      requireAuth
Response:  { timeline: { id, name, description, isActive }, steps: Array<{ dayOffset, channel, templateName, templateBody, subject, isAutomated }> }
```

### C7: POST Create Timeline
```
Frontend:  POST /api/communications/timelines
Express:   POST /api/communications/timelines
Platinum:  POST /api/BillingDebt/communication-timelines
Auth:      requireAuth + requireLegalAdmin
Payload:   { name: string, description?: string, isActive: boolean, capturerID, dateCaptured, modifierID, dateModified }
Response:  { id: number, name, isActive }
```

### C8: PUT Update Timeline Steps
```
Frontend:  PUT /api/communications/timelines/:id/steps
Express:   PUT /api/communications/timelines/:id/steps
Platinum:  POST /api/BillingDebt/communication-timeline-steps
Auth:      requireAuth + requireLegalAdmin
Payload:   { timelineId: number, steps: Array<{ timelineId, dayOffset, channel, templateName, templateBody, subject, isAutomated }>, capturerID, dateCaptured, modifierID, dateModified }
```

### C9: DELETE Timeline
```
Frontend:  DELETE /api/communications/timelines/:id
Express:   DELETE /api/communications/timelines/:id
Platinum:  POST /api/BillingDebt/communication-timelines-delete
Auth:      requireAuth + requireLegalAdmin
Payload:   { id: number, capturerID, dateCaptured, modifierID, dateModified }
```

### C10: POST Dispatch Communication
```
Frontend:  POST /api/communications/dispatch
Express:   POST /api/communications/dispatch
Platinum:  POST /api/BillingDebt/communication-dispatch
Auth:      requireAuth + requireLegalAdmin
Payload:   { accountNo: string, channel: 'sms'|'email'|'letter'|'whatsapp', recipient: string, subject?: string, messageBody: string, capturerID, dateCaptured, modifierID, dateModified }
Response:  { success: boolean, messageId?: string }
```

### C11: POST Dispatch Bulk
```
Frontend:  POST /api/communications/dispatch-bulk
Express:   POST /api/communications/dispatch-bulk
Platinum:  POST /api/BillingDebt/communication-dispatch-bulk
Auth:      requireAuth + requireLegalAdmin
Payload:   { accounts: Array<{ accountNo, channel, recipient }>, messageBody: string, subject?: string, capturerID, dateCaptured, modifierID, dateModified }
```

### C12: POST Enroll Account in Timeline
```
Frontend:  POST /api/communications/enroll
Express:   POST /api/communications/enroll
Platinum:  POST /api/BillingDebt/communication-enroll
Auth:      requireAuth + requireLegalAdmin
Payload:   { timelineId: number, accountNo: string, capturerID, dateCaptured, modifierID, dateModified }
Response:  { success: boolean, scheduledCount: number }
```

### C13: GET SMS Log Report
```
Frontend:  GET /api/platinum/billing-debt/sms-log-report?accountNo=&dateFrom=&dateTo=
Express:   GET /api/platinum/billing-debt/sms-log-report
Platinum:  GET /api/BillingDebt/sms-log-report
Auth:      requireAuth
Response:  Array<{ sentAt, accountNo, recipient, messageBody, status, deliveryStatus }> OR { logs: [...] }
```

---

## 3. API Contracts — Phase 4 Batch Processing & Monitoring

### B1: GET Batch Jobs
```
Frontend:  GET /api/batch-processing/jobs
Express:   GET /api/batch-processing/jobs
Platinum:  GET /api/BillingDebt/batch-jobs
Auth:      requireAuth
Response:  Array<{ id, jobType, status, startedAt, completedAt, totalItems, processedItems, failedItems, createdBy }>
           OR { jobs: [...] }
```

### B2: GET Batch Schedules
```
Frontend:  GET /api/batch-processing/schedules
Express:   GET /api/batch-processing/schedules
Platinum:  GET /api/BillingDebt/batch-schedules
Auth:      requireAuth
Response:  Array<{ id, jobType, cronExpression, isActive, nextRun, lastRun }>
           OR { schedules: [...] }
```

### B3: POST Trigger Batch Job
```
Frontend:  POST /api/batch-processing/trigger
Express:   POST /api/batch-processing/trigger
Platinum:  POST /api/BillingDebt/batch-trigger
Auth:      requireAuth + requireLegalAdmin
Payload:   { jobType: string, capturerID, dateCaptured, modifierID, dateModified }
Response:  { jobId: string, status: 'QUEUED' }
```

### B4: POST Cancel Batch Job
```
Frontend:  POST /api/batch-processing/cancel
Express:   POST /api/batch-processing/cancel
Platinum:  POST /api/BillingDebt/batch-cancel
Auth:      requireAuth + requireLegalAdmin
Payload:   { jobId: string, capturerID, dateCaptured, modifierID, dateModified }
Response:  { success: boolean }
```

### M1: GET Process Monitoring Overview
```
Frontend:  GET /api/process-monitoring/overview
Express:   GET /api/process-monitoring/overview
Platinum:  GET /api/BillingDebt/process-monitoring-overview
Auth:      requireAuth
Response:  { activeRuns: number, failedRuns: number, pendingApprovals: number, handoverQueued: number, terminationQueued: number }
```

### M2-M6: Process Monitoring Detail Endpoints
```
GET /api/process-monitoring/active-runs       → GET /api/BillingDebt/process-active-runs
GET /api/process-monitoring/failed-runs       → GET /api/BillingDebt/process-failed-runs
GET /api/process-monitoring/pending-approvals → GET /api/BillingDebt/process-pending-approvals
GET /api/process-monitoring/handover-queues   → GET /api/BillingDebt/process-handover-queues
GET /api/process-monitoring/termination-queues → GET /api/BillingDebt/process-termination-queues
Auth: requireAuth
Response: Array of items with { id, accountNo, runType/jobType, status, startedAt, amount, description }
          OR { runs/queues/approvals: [...] }
```

---

## 4. API Contracts — Phase 5 Legal Compliance

### L1: GET Legal Rules
```
Frontend:  GET /api/legal/rules?category=NCA
Express:   GET /api/legal/rules
Platinum:  GET /api/BillingDebt/legal-rules
Auth:      requireAuth
Response:  Array<{ id, ruleCode, title, category, description, legislativeRef, isActive, version, effectiveFrom, effectiveTo, conditions, metadata, createdAt, updatedAt }>
```

### L2: POST Create Legal Rule
```
Frontend:  POST /api/legal/rules
Express:   POST /api/legal/rules
Platinum:  POST /api/BillingDebt/legal-rules
Auth:      requireAuth + requireLegalAdmin
Payload:   { ruleCode, title, legislationRef, description?, category: 'NCA'|'MSA'|'MFMA'|'CONSTITUTION'|'BYLAWS'|'REGULATIONS', effectiveFrom: ISO, effectiveTo?: ISO, isActive: boolean, capturerID, dateCaptured, modifierID, dateModified }
Response:  { id, ruleCode, title, version: 1 }
```

### L3: PUT Update Legal Rule
```
Frontend:  PUT /api/legal/rules/:id
Express:   PUT /api/legal/rules/:id
Platinum:  POST /api/BillingDebt/legal-rules-update
Auth:      requireAuth + requireLegalAdmin
Payload:   { id: number, ruleCode, title, legislationRef, description?, category, effectiveFrom, effectiveTo?, isActive, capturerID, dateCaptured, modifierID, dateModified }
```

### L4: DELETE (Deactivate) Legal Rule
```
Frontend:  DELETE /api/legal/rules/:id
Express:   DELETE /api/legal/rules/:id
Platinum:  POST /api/BillingDebt/legal-rules-deactivate
Auth:      requireAuth + requireLegalAdmin
Payload:   { id: number, capturerID, dateCaptured, modifierID, dateModified }
```

### L5: GET Compliance Audit Log
```
Frontend:  GET /api/legal/compliance-log?actionType=&accountNo=&dateFrom=&dateTo=&userId=
Express:   GET /api/legal/compliance-log
Platinum:  GET /api/BillingDebt/compliance-log
Auth:      requireAuth
Response:  Array<{ id, actionType, entityType?, entityId?, userId?, userName?, ipAddress?, apiCallId?, timestamp, legislationRef?, details?, accountNo?, outcome? }>
```

### L6: GET Compliance Log by Entity
```
Frontend:  GET /api/legal/compliance-log/:entityId
Express:   GET /api/legal/compliance-log/:entityId
Platinum:  GET /api/BillingDebt/compliance-log?entityId=:entityId
Auth:      requireAuth
```

### L7: POST Generate Evidence Bundle
```
Frontend:  POST /api/legal/evidence-bundle
Express:   POST /api/legal/evidence-bundle
Platinum:  POST /api/BillingDebt/evidence-bundle
Auth:      requireAuth + requireLegalAdmin
Payload:   { accountNo: string, capturerID, dateCaptured, modifierID, dateModified }
Response:  { id, bundleReference, status: 'GENERATED' }
```

### L8: GET List Evidence Bundles
```
Frontend:  GET /api/legal/evidence-bundles
Express:   GET /api/legal/evidence-bundles
Platinum:  GET /api/BillingDebt/evidence-bundles
Auth:      requireAuth
Response:  Array<{ id, accountNo, bundleReference, generatedBy, generatedAt, status, bundleData }>
```

### L9: GET Evidence Bundle Detail
```
Frontend:  GET /api/legal/evidence-bundle/:id
Express:   GET /api/legal/evidence-bundle/:id
Platinum:  GET /api/BillingDebt/evidence-bundle?id=:id
Auth:      requireAuth
Response:  { id, accountNo, bundleReference, generatedBy, generatedAt, bundleData: { accountHistory, billingRecords, communicationLog, paymentHistory, section129Notices, handoverHistory, ... }, status }
```

### L10: POST Validate Legal Action
```
Frontend:  POST /api/legal/validate-action
Express:   POST /api/legal/validate-action
Platinum:  POST /api/BillingDebt/validate-legal-action
Auth:      requireAuth
Payload:   { accountNo, actionType, proposedAction, capturerID, dateCaptured, modifierID, dateModified }
Response:  { isValid: boolean, violations: Array<{ ruleCode, title, legislativeRef, severity }>, recommendations: string[] }
```

---

## 5. Bonus — Phase 6-7 Path Fixes Also Applied

### 5.1 Document Templates (`document-templates.component.ts`) — 1 Fix

| # | Old Path | New Path | HTTP | Platinum |
|---|---|---|---|---|
| DT1 | `/api/document-templates/:id/versions` (POST) | `/api/document-templates/:id/upload` | POST | `POST /api/BillingDebt/document-templates/:id/upload` |

### 5.2 Digital Signatures (`digital-signatures.component.ts`) — 4 Fixes

| # | Old Path | New Path | HTTP | Platinum |
|---|---|---|---|---|
| DS1 | `/api/signature-requests` | `/api/digital-signatures` | GET | `GET /api/BillingDebt/digital-signatures` |
| DS2 | `/api/signature-audit-log` | `/api/digital-signatures/audit-log` | GET | `GET /api/BillingDebt/digital-signatures/audit-log` |
| DS3 | `/api/signature-requests/:id` | `/api/digital-signatures/:id` | GET | `GET /api/BillingDebt/digital-signatures/:id` |
| DS4 | `/api/signature-requests` | `/api/digital-signatures` | POST | `POST /api/BillingDebt/digital-signatures` |

### 5.3 Process Engine (`process-engine.component.ts`) — 8 Fixes

| # | Old Path | New Path | HTTP |
|---|---|---|---|
| PE1 | `/api/process-workflows` | `/api/process-engine/workflows` | GET |
| PE2 | `/api/process-workflows/:id/stages` | `/api/process-engine/workflows/:id/stages` | GET |
| PE3 | `/api/process-workflows` | `/api/process-engine/workflows` | POST |
| PE4 | `/api/process-workflows/:id` | `/api/process-engine/workflows/:id` | PUT |
| PE5 | `/api/process-workflows/:id` | `/api/process-engine/workflows/:id` | DELETE |
| PE6 | `/api/process-workflows/:id/stages` | `/api/process-engine/workflows/:id/stages` | POST |
| PE7 | `/api/process-workflows/:id/stages/:stageId` | `/api/process-engine/workflows/:id/stages/:stageId` | PUT |
| PE8 | `/api/process-workflows/:id/stages/:stageId` | `/api/process-engine/workflows/:id/stages/:stageId` | DELETE |
| PE9 | `/api/process-workflows/:id/stages/reorder` | `/api/process-engine/workflows/:id/stages/reorder` | POST |

---

## 6. Middleware & Audit Trail

All POST/PUT/DELETE routes inject audit metadata server-side via `injectAuditFields(session, body)`:

```typescript
function injectAuditFields(session: any, body: any): any {
  return {
    ...body,
    capturerID: session.userId,
    modifierID: session.userId,
    dateCaptured: new Date().toISOString(),
    dateModified: new Date().toISOString(),
  };
}
```

Authorization middleware chain:
1. `requireAuth(req, res)` — Checks active session, returns session object or sends 401
2. `requireLegalAdmin(session, res)` — Checks `session.role === 'admin' || session.permissions?.includes('LEGAL_ADMIN')`
3. `injectAuditFields(session, body)` — Appends capturer/modifier metadata to request body

---

## 7. Angular Models Used

### `debt.models.ts` (Phase 4)
```typescript
interface CommunicationStep {
  dayOffset: number; channel: string; templateName: string;
  templateBody: string; subject: string; isAutomated: boolean;
}
interface CommunicationTimeline {
  id: number; name: string; description?: string;
  isActive: boolean; stepCount?: number;
}
interface CommunicationStats {
  totalSent: number; totalDelivered: number;
  totalFailed: number; totalPending: number;
  byChannel: Record<string, { sent: number; failed: number; delivered: number }>;
}
interface ProcessMonitoringOverview {
  activeRuns: number; failedRuns: number;
  pendingApprovals: number; handoverQueued: number; terminationQueued: number;
}
```

### `legal.models.ts` (Phase 5)
```typescript
interface LegalRuleVersion {
  id: number; ruleCode: string; title: string; category: string;
  description: string; legislativeRef: string; isActive: boolean;
  version: number; effectiveFrom: string; effectiveTo?: string | null;
  conditions?: Record<string, unknown>; metadata?: Record<string, unknown>;
}
interface RuleFormData {
  ruleCode: string; title: string; legislationRef: string;
  description: string; category: string;
  effectiveFrom: string; effectiveTo: string; isActive: boolean;
}
interface ComplianceLogEntry {
  id: number | string; actionType: string; entityType?: string;
  entityId?: string; userId?: string; userName?: string;
  ipAddress?: string; apiCallId?: string; timestamp?: string;
  legislationRef?: string; details?: string; accountNo?: string; outcome?: string;
}
interface EvidenceBundle {
  id: number; accountNo: string; bundleReference: string;
  generatedBy: string; generatedAt: string;
  bundleData: Record<string, any>; status: string;
}
```

---

## 8. Checklist — What Platinum API Team Must Build

### Phase 4: Communication Engine (BillingDebt Controller)

| # | Method | Platinum Endpoint | Purpose | Priority |
|---|--------|---|---------|----------|
| 1 | GET | `/api/BillingDebt/communication-timelines` | List timelines (optional `?id=` for single) | P1 |
| 2 | POST | `/api/BillingDebt/communication-timelines` | Create new timeline | P1 |
| 3 | POST | `/api/BillingDebt/communication-timelines-update` | Update timeline | P2 |
| 4 | POST | `/api/BillingDebt/communication-timelines-delete` | Delete timeline by `{ id }` | P2 |
| 5 | POST | `/api/BillingDebt/communication-timeline-steps` | Save/replace timeline steps | P1 |
| 6 | POST | `/api/BillingDebt/communication-dispatch` | Send single SMS/email/letter | P1 |
| 7 | POST | `/api/BillingDebt/communication-dispatch-bulk` | Bulk dispatch to multiple accounts | P2 |
| 8 | POST | `/api/BillingDebt/communication-enroll` | Enroll account in timeline | P1 |
| 9 | POST | `/api/BillingDebt/communication-process-scheduled` | Process pending scheduled items | P1 |
| 10 | GET | `/api/BillingDebt/communication-log` | Query delivery log (with filters) | P1 |
| 11 | GET | `/api/BillingDebt/communication-scheduled` | List scheduled communications | P1 |
| 12 | GET | `/api/BillingDebt/communication-stats` | Summary statistics by channel | P1 |
| 13 | GET | `/api/BillingDebt/sms-log-report` | SMS delivery report (filters: accountNo, dateFrom, dateTo) | P1 |

### Phase 4: Batch Processing (BillingDebt Controller)

| # | Method | Platinum Endpoint | Purpose | Priority |
|---|--------|---|---------|----------|
| 14 | GET | `/api/BillingDebt/batch-jobs` | List batch jobs with status | P1 |
| 15 | GET | `/api/BillingDebt/batch-schedules` | List scheduled batch configs | P1 |
| 16 | POST | `/api/BillingDebt/batch-trigger` | Manually trigger a batch job | P1 |
| 17 | POST | `/api/BillingDebt/batch-cancel` | Cancel a running/queued batch job | P2 |

### Phase 4: Process Monitoring (BillingDebt Controller)

| # | Method | Platinum Endpoint | Purpose | Priority |
|---|--------|---|---------|----------|
| 18 | GET | `/api/BillingDebt/process-monitoring-overview` | Dashboard summary counts | P1 |
| 19 | GET | `/api/BillingDebt/process-active-runs` | Currently running processes | P1 |
| 20 | GET | `/api/BillingDebt/process-failed-runs` | Failed process runs | P1 |
| 21 | GET | `/api/BillingDebt/process-pending-approvals` | Items awaiting approval | P1 |
| 22 | GET | `/api/BillingDebt/process-handover-queues` | Handover queue items | P1 |
| 23 | GET | `/api/BillingDebt/process-termination-queues` | Termination queue items | P1 |

### Phase 5: Legal Compliance (BillingDebt Controller)

| # | Method | Platinum Endpoint | Purpose | Priority |
|---|--------|---|---------|----------|
| 24 | GET | `/api/BillingDebt/legal-rules` | List legal rules (optional `?category=`) | P1 |
| 25 | POST | `/api/BillingDebt/legal-rules` | Create new legal rule | P1 |
| 26 | POST | `/api/BillingDebt/legal-rules-update` | Update existing rule (new version) | P1 |
| 27 | POST | `/api/BillingDebt/legal-rules-deactivate` | Deactivate rule by `{ id }` | P2 |
| 28 | GET | `/api/BillingDebt/compliance-log` | Search audit trail (filters: actionType, accountNo, dateFrom, dateTo, userId, entityId) | P1 |
| 29 | POST | `/api/BillingDebt/evidence-bundle` | Generate evidence bundle for account | P1 |
| 30 | GET | `/api/BillingDebt/evidence-bundles` | List all generated bundles | P1 |
| 31 | GET | `/api/BillingDebt/evidence-bundle` | Get single bundle detail `?id=` | P1 |
| 32 | POST | `/api/BillingDebt/validate-legal-action` | Validate proposed action against rules | P2 |

**Total Platinum Endpoints: 32** (13 Communication + 4 Batch + 6 Monitoring + 9 Legal)

---

## 9. Blockers & Action List

| # | Blocker | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| B1 | Platinum `BillingDebt` communication endpoints not yet built | Platinum API Team | PENDING | All 13 communication endpoints in section 8 |
| B2 | Platinum `BillingDebt` batch processing endpoints not yet built | Platinum API Team | PENDING | All 4 batch endpoints |
| B3 | Platinum `BillingDebt` process monitoring endpoints not yet built | Platinum API Team | PENDING | All 6 monitoring endpoints |
| B4 | Platinum `BillingDebt` legal compliance endpoints not yet built | Platinum API Team | PENDING | All 9 legal endpoints |
| B5 | SMS gateway integration for `communication-dispatch` | Platinum API Team + SMS Provider | PENDING | Requires SMS provider credentials and API integration |
| B6 | Email gateway integration for email dispatch | Platinum API Team + Email Provider | PENDING | SMTP or SendGrid/similar configuration needed |
| B7 | Azure Service Bus for batch job queuing | Platinum DevOps | PENDING | Batch trigger/cancel needs message queue infrastructure |
| B8 | Evidence bundle data aggregation queries | Platinum DBA | PENDING | Bundle generation requires joining 8+ EMS tables per account |

---

## 10. Sign-off Checklist

| # | Item | Status |
|---|------|--------|
| 1 | All Phase 4-5 frontend API paths match Express backend routes | DONE |
| 2 | All Express routes proxy to correct Platinum `BillingDebt/` endpoints | DONE |
| 3 | All POST/PUT/DELETE routes include `injectAuditFields` | DONE |
| 4 | All write routes check `requireLegalAdmin` | DONE |
| 5 | SMS Log Report component implemented (was empty placeholder) | DONE |
| 6 | Communication Dashboard account search uses `search-accounts` not `/api/accounts` | DONE |
| 7 | Batch cancel sends `jobId` in body (not URL param) to match backend | DONE |
| 8 | Enroll sends `timelineId` in body (not URL path) to match backend | DONE |
| 9 | Timeline steps uses PUT (not POST) to match backend route | DONE |
| 10 | Angular build compiles cleanly with zero errors | DONE |
| 11 | Phase 6-7 path fixes applied (document templates, signatures, process engine) | DONE |
| 12 | All 32 Platinum API contracts documented with payloads | DONE |
| 13 | Blockers list created for API team | DONE |
| 14 | No local DB used, no mock data, no hardcoded values | VERIFIED |
| 15 | Date format uses `dd/mm/yyyy` with `padStart(2,'0')` pattern | VERIFIED |

---

## 11. Total Fix Summary

| Component | Fixes Applied |
|-----------|--------------|
| Communication Timeline | 6 |
| Communication Dashboard | 5 |
| SMS Log Report | 1 (full implementation) |
| Batch Processing | 4 |
| Process Monitoring | 0 (already correct) |
| Legal Rules | 0 (already correct) |
| Audit Trail | 1 |
| Evidence Bundle | 2 |
| Document Templates (bonus) | 1 |
| Digital Signatures (bonus) | 4 |
| Process Engine (bonus) | 9 |
| **TOTAL** | **33 fixes** |

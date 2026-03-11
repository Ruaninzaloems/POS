# Phase 0 (v2) — Debt & Legal: Master Feature Matrix & API Foundation

> **Revision**: v2 — Fresh analysis taking Angular 19 standalone components into account
> **Date**: 2026-03-11
> **Scope**: All Debt Management, Legal Compliance & Analytics pages
> **Frontend**: Angular 19 (`angular-client/src/app/features/debt/`, `legal/`, `analytics/`)
> **Backend**: Express proxy (`server/routes/debt.routes.ts`, `legal.routes.ts`, `analytics.routes.ts`)
> **Platinum Controller**: `BillingDebt` (all debt/legal APIs)

---

## 1. Project Feature Matrix (24 Pages)

| # | Page | Angular Route | Component File | Category | Priority |
|---|------|--------------|----------------|----------|----------|
| 1 | Section 129 Configuration | `/debt/section129/config` | `section129-config.component.ts` | Config | P1 |
| 2 | Section 129 Notices | `/debt/section129` | `section129-notices.component.ts` | Core Process | P1 |
| 3 | Section 129 Trial Review | `/debt/section129/review/:runId` | `section129-trial-review.component.ts` | Core Process | P1 |
| 4 | Section 129 Authorization | `/debt/section129/authorize` | `section129-authorization.component.ts` | Core Process | P1 |
| 5 | Section 129 Report | `/debt/section129-report` | `section129-report.component.ts` | Reporting | P2 |
| 6 | SMS Log Report | `/debt/sms-log-report` | `sms-log-report.component.ts` | Reporting | P2 |
| 7 | Handover Management | `/debt/handover` | `handover-management.component.ts` | Core Process | P2 |
| 8 | Handover Termination | `/debt/handover/terminate` | `handover-termination.component.ts` | Core Process | P2 |
| 9 | Handover Report | `/debt/handover-report` | `handover-report.component.ts` | Reporting | P2 |
| 10 | Communication Dashboard | `/debt/communication-dashboard` | `communication-dashboard.component.ts` | Communications | P3 |
| 11 | Communication Timeline | `/debt/communication-timelines` | `communication-timeline.component.ts` | Communications | P3 |
| 12 | Qualification Rules | `/debt/qualification-rules` | `qualification-rules.component.ts` | Rules Engine | P3 |
| 13 | Risk Scoring | `/debt/risk-scoring` | `risk-scoring.component.ts` | Scoring | P3 |
| 14 | Batch Processing | `/debt/batch-processing` | `batch-processing.component.ts` | Engine | P4 |
| 15 | Process Monitoring | `/debt/process-monitoring` | `process-monitoring.component.ts` | Engine | P4 |
| 16 | Document Templates | `/debt/document-templates` | `document-templates.component.ts` | Documents | P4 |
| 17 | Digital Signatures | `/debt/digital-signatures` | `digital-signatures.component.ts` | Documents | P4 |
| 18 | Process Engine | `/debt/process-engine` | `process-engine.component.ts` | Engine | P4 |
| 19 | Legal Rules Administration | `/legal/rules` | `legal-rules.component.ts` | Legal | P3 |
| 20 | Compliance Audit Trail | `/legal/audit-trail` | `audit-trail.component.ts` | Legal | P3 |
| 21 | Litigation Evidence Bundles | `/legal/evidence-bundle` | `evidence-bundle.component.ts` | Legal | P4 |
| 22 | Executive Debt Dashboard | `/analytics/executive-dashboard` | `executive-dashboard.component.ts` | Analytics | P4 |
| 23 | Predictive Forecasting | `/analytics/predictive-forecasting` | `predictive-forecasting.component.ts` | Analytics | P4 |
| 24 | Geographic Debt Mapping | `/analytics/geographic-mapping` | `geographic-mapping.component.ts` | Analytics | P4 |

---

## 2. Current State Audit

### 2.1 What EXISTS Today

#### Angular Frontend Components (Built, UI-only)
All 24 pages have Angular 19 standalone components with separate `.ts`, `.html`, `.css` files. These components currently:
- Display UI elements (forms, grids, tabs, filters)
- Call APIs through `ApiService` which proxies to Express
- Use Angular signals for state management
- Have typed models in `angular-client/src/app/models/debt.models.ts` (395 lines)
- Have typed models in `angular-client/src/app/models/legal.models.ts`

#### Express Backend Routes (Built, proxy-only)
- `server/routes/debt.routes.ts` — 327 lines, 24 route handlers proxying to `BillingDebt/*` Platinum endpoints
- `server/routes/legal.routes.ts` — 239 lines, handlers for rules, compliance-log, evidence bundles
- `server/routes/analytics.routes.ts` — handlers for dashboard, forecasting, geographic endpoints
- All routes use `requireAuth`, `requireDebtPermission`, `injectAuditFields` middleware

#### What's NOT Working
- **Section 129 Notices page** calls routes like `/api/section129/config`, `/api/billing-cycles`, `/api/towns` which return **404** — these are old paths. The correct paths use `/api/platinum/billing-debt/...` prefix
- Filter dropdown APIs (`billing-cycles`, `towns`, `property-categories`, `account-types`, `person-types`, `ageing-ranges`) proxy to Platinum but **Platinum may not have these endpoints built yet**
- No Platinum `BillingDebt` controller endpoints are confirmed as live on the UAT environment

### 2.2 What NEEDS TO BE BUILT on Platinum (Azure API)

This is the core deliverable — a new **`BillingDebt` controller** on the Platinum Inzalo EMS API (C# / .NET, deployed to Azure) with Swagger documentation. The controller wraps existing EMS database tables.

---

## 3. EMS Schema Mapping (Existing Tables)

### Tables That Already Exist in EMS

| EMS Table | Purpose | Used By Pages | Key Columns |
|-----------|---------|--------------|-------------|
| `Billing_Section129LetterOFDemand` | Section 129 run header | 2, 3, 4, 5 | `LetterOfDemand_ID`, `RunType`, `HandOverOptionId`, `AttorneyId`, `PeriodId`, `BillingCycleID`, `DemandLetter`, `AdminFee`, `IncludeIndigent`, `ExcludeDepositBalances`, `TownId`, `SuburbId`, `PropertyCategoryId`, `AccountTypeId`, `TypeOfPersonId`, `Ageing`, `AmountGreaterThen`, `LapseDays`, `FinancialYear`, `EnquirieName`, `EnquiryPhone`, `EnquiryEmail`, `TrialRunReviewStatusID`, `TrialRunReviewerID`, `FinalRunReviewStatusID`, `FinalRunReviewerID`, `IsFinalReviewComplete`, `DateCaptured`, `CapturerID`, `DateModified`, `ModifierID`, `Email`, `SMS`, `PrintLetter`, `PrintEmailAccount`, `SMSNotification` |
| `Billing_Section129LetterOFDemandDetails` | Account details per run | 3, 5 | `LetterOFDemandDetails_ID`, `LetterOfDemandID` (FK), `AccountId`, `OutStandingAmount`, `Posted`, `DatePosted`, `IsPaid`, `PaidAmount`, `TotalBalance`, `CurrentBalance`, `BalanceDue` |
| `Billing_Handover` | Basic handover flag | 7, 8 | `Handover_Id`, `AccountId`, `ActivateDate`, `CancelDate`, `HandoverStatus` |
| `Cons_Handovers` | Detailed handover records | 7, 8, 9, 15 | `Handover_ID`, `AccountID`, `HandedOverAmount`, `HandedOverDate`, `AttorneyID`, `ReferenceNumber`, `Comment`, `DateCaptured`, `CapturerID`, `DateModified`, `ModifierID`, `StatusID`, `TerminationDate` |
| `Cons_Handovers_Transactions` | Handover transaction detail | 7, 9 | `HandOverTransaction_ID`, `HandOverID` (FK), `ServiceTypeID`, `Amount`, `VatAmount`, `InterestAmount` |
| `Const_Attorney` | Attorney master data | 1, 2, 7, 8, 9 | `Attorney_ID`, `AttorneyDesc`, `Address1-3`, `Email`, `Commission`, `Enabled`, `TownID` |
| `Billing_LetterTemplates` | Letter templates | 1, 2, 16 | `Template_Id`, `TemplateName`, `NoticeTypeID`, `TemplateFileName` |
| `Billing_LetterTypes` | Notice type lookups | 1, 2 | `NoticeType_Id`, `NoticeTypeDescription` |
| `Billing_SelectedTemplates` | Template-to-notice mapping | 1, 2 | `NoticeTypeID`, `SelectedTemplate_Id` |

### Tables That NEED TO BE CREATED

| New Table | Purpose | Used By Pages | Reason |
|-----------|---------|--------------|--------|
| `Billing_Section129RunFiles` | Multi-file tracking per run | 2, 5 | Existing `PDFPath`/`ExcelPath`/`ZIPFilePath` on header don't support batched files (e.g. 6 PDFs of 500 accounts each) |
| `Billing_Section129Config` | Per-FY configuration storage | 1 | Config with cost items and attorney rotation. Currently the config fields live on the run header, but a dedicated config table allows CRUD |
| `Billing_Section129ConfigCostItems` | Cost item line items per config | 1 | Admin fee line items (additional billing type + amount) |
| `Billing_Section129ConfigAttorneyRotation` | Attorney rotation percentages per config | 1 | Attorney allocation percentages for rotation handovers |

### Columns That NEED TO BE ADDED to Existing Tables

| Table | New Column | Type | Default | Reason |
|-------|-----------|------|---------|--------|
| `Billing_Section129LetterOFDemand` | `IncludePensioners` | `bit` | `0` | Frontend sends this flag; not in current schema |
| `Billing_Section129LetterOFDemand` | `WhatsApp` | `bit` | `0` | WhatsApp distribution channel; matches `Email`, `SMS`, `PrintLetter` pattern |
| `Billing_Section129LetterOFDemand` | `StatusID` | `int` | `0` | Unified status tracking (DRAFT→TRIAL_RUNNING→TRIAL_COMPLETE→UNDER_REVIEW→APPROVED→DECLINED→FINAL_RUNNING→FINAL_COMPLETE→LAPSING→LAPSED) |
| `Billing_Section129LetterOFDemandDetails` | `Selected` | `bit` | `1` | Track which accounts reviewer selected/deselected during trial review |

---

## 4. Platinum API Specification — Full Endpoint List

### 4.1 Section 129 Configuration (Page 1)

| # | Platinum Endpoint | Method | Purpose | Sync/Async |
|---|-------------------|--------|---------|-----------|
| C1 | `GET /api/BillingDebt/section129-config` | GET | Load active config for current FY | Sync |
| C2 | `GET /api/BillingDebt/section129-config-list` | GET | List all configs (filterable by FY) | Sync |
| C3 | `POST /api/BillingDebt/section129-config-save` | POST | Create or update config entry | Sync |
| C4 | `GET /api/BillingDebt/section129-templates` | GET | List demand letter templates | Sync |
| C5 | `GET /api/BillingDebt/section129-sms-templates` | GET | List SMS templates | Sync |
| C6 | `GET /api/BillingDebt/additional-billing-types` | GET | List billing types for cost items | Sync |
| C7 | `GET /api/BillingDebt/attorney-list` | GET | List attorneys for rotation config | Sync |

### 4.2 Section 129 Notices (Pages 2-4)

| # | Platinum Endpoint | Method | Purpose | Sync/Async |
|---|-------------------|--------|---------|-----------|
| N1 | `GET /api/BillingDebt/section129-runs` | GET | List all runs (grid) | Sync |
| N2 | `POST /api/BillingDebt/section129-trial-run` | POST | Submit new trial run | Hybrid — sync create, async worker |
| N3 | `GET /api/BillingDebt/section129-run-accounts` | GET | List accounts for a run (trial review) | Sync |
| N4 | `POST /api/BillingDebt/section129-trial-review-submit` | POST | Submit reviewed account selections | Sync |
| N5 | `POST /api/BillingDebt/section129-authorize` | POST | Approve or decline a reviewed run | Sync |
| N6 | `POST /api/BillingDebt/section129-final-run` | POST | Execute final notice generation | Hybrid — sync validate, async worker |
| N7 | `GET /api/BillingDebt/section129-run-files` | GET | List generated files for a run | Sync |
| N8 | `GET /api/BillingDebt/section129-download-file` | GET | Stream binary file download | Sync |
| N9 | `POST /api/BillingDebt/section129-delete-run` | POST | Remove a draft/declined run | Sync |
| N10 | `GET /api/BillingDebt/section129-run-status` | GET | Poll async run status | Sync |

### 4.3 Shared Lookup Endpoints (Used by multiple pages)

| # | Platinum Endpoint | Method | Returns | Used By |
|---|-------------------|--------|---------|---------|
| L1 | `GET /api/BillingDebt/billing-cycles` | GET | `{ id, name }[]` | Pages 2, 5, 6, 7, 9 |
| L2 | `GET /api/BillingDebt/towns` | GET | `{ id, name }[]` | Pages 2, 7 |
| L3 | `GET /api/BillingDebt/property-categories` | GET | `{ id, name }[]` | Page 2 |
| L4 | `GET /api/BillingDebt/account-types` | GET | `{ id, name }[]` | Page 2 |
| L5 | `GET /api/BillingDebt/person-types` | GET | `{ id, name }[]` | Page 2 |
| L6 | `GET /api/BillingDebt/ageing-ranges` | GET | `{ id, name }[]` | Pages 2, 7 |

### 4.4 Section 129 Report (Page 5)

| # | Platinum Endpoint | Method | Purpose | Sync/Async |
|---|-------------------|--------|---------|-----------|
| R1 | `GET /api/BillingDebt/section129-report` | GET | Filtered report query | Sync |

### 4.5 SMS Log Report (Page 6)

| # | Platinum Endpoint | Method | Purpose | Sync/Async |
|---|-------------------|--------|---------|-----------|
| R2 | `GET /api/BillingDebt/sms-log-report` | GET | SMS log filtered query | Sync |

### 4.6 Handover Management (Pages 7-9)

| # | Platinum Endpoint | Method | Purpose | Sync/Async |
|---|-------------------|--------|---------|-----------|
| H1 | `GET /api/BillingDebt/handover-list` | GET | List handover records | Sync |
| H2 | `POST /api/BillingDebt/handover-submit` | POST | Submit account handover | Sync (single), Hybrid (bulk/rotation) |
| H3 | `POST /api/BillingDebt/handover-terminate` | POST | Terminate active handover | Sync |
| H4 | `GET /api/BillingDebt/handover-report` | GET | Filtered handover report | Sync |

---

## 5. Sync vs Async Decision Matrix

| Operation | Direct API (Sync) | Azure Service Bus (Async) | Worker Process | Reason |
|-----------|------------------|--------------------------|----------------|--------|
| All lookup/dropdown loads | YES | — | — | Simple SELECT queries |
| Load/save Section 129 config | YES | — | — | Single row CRUD |
| Load runs list | YES | — | — | SELECT with filters |
| Load run accounts | YES | — | — | SELECT by runId |
| Submit trial run | YES (create header) | YES (process) | YES | Heavy: qualifies thousands of accounts against billing data |
| Trial review submit | YES | — | — | UPDATE selected flags |
| Authorize run | YES | — | — | UPDATE status |
| Submit final run | YES (validate) | YES (process) | YES | Heavy: generates PDFs, sends SMS/email |
| File generation | — | YES | YES | Background PDF/ZIP creation |
| Communication batch send | — | YES | YES | Bulk SMS/email dispatch |
| Single account handover | YES | — | — | Single record INSERT |
| Bulk handover | YES (initiate) | YES (process) | YES | Multiple accounts |
| Rotation handover | YES (initiate) | YES (process) | YES | Distributes across attorneys |
| Handover terminate | YES | — | — | UPDATE status |
| Lapse period check | — | YES | YES | Scheduled job: workday countdown |
| Risk scoring (single) | YES | — | — | Calculation |
| Risk scoring (bulk) | YES (initiate) | YES (process) | YES | Heavy batch scoring |
| Qualification rule run | YES (initiate) | YES (process) | YES | Heavy: evaluates all accounts |
| Evidence bundle generate | YES (initiate) | YES (compile) | YES | Gathers data from multiple sources |
| Reports | YES | — | — | Query + return |

---

## 6. Status Lifecycle Diagrams

### 6.1 Section 129 Run Statuses

```
DRAFT (0) → TRIAL_RUNNING (1) → TRIAL_COMPLETE (2) → UNDER_REVIEW (3)
  → APPROVED (4) → FINAL_RUNNING (6) → FINAL_COMPLETE (7) → LAPSING (8) → LAPSED (9)
  → DECLINED (5) [terminal]
```

| Status | Code | Description | Triggered By |
|--------|------|-------------|-------------|
| DRAFT | 0 | Run created, not yet processed | `section129-trial-run` POST |
| TRIAL_RUNNING | 1 | Background worker executing trial | Worker pickup |
| TRIAL_COMPLETE | 2 | Trial finished, accounts populated | Worker completion |
| UNDER_REVIEW | 3 | Reviewer selecting/deselecting accounts | `section129-trial-review-submit` |
| APPROVED | 4 | Authorized for final run | `section129-authorize` (approve) |
| DECLINED | 5 | Authorization rejected | `section129-authorize` (decline) |
| FINAL_RUNNING | 6 | Final notice generation in progress | `section129-final-run` POST |
| FINAL_COMPLETE | 7 | Notices generated, files ready | Worker completion |
| LAPSING | 8 | Monitoring workday lapse period | Worker sets after file generation |
| LAPSED | 9 | Lapse period expired, ready for handover | Scheduled lapse checker |

### 6.2 Handover Statuses

```
PENDING (1) → ACTIVE (2) → TERMINATED (3) | COMPLETED (4)
```

---

## 7. Audit Fields Standard

Every write operation to the Platinum API MUST include:

| Field | Source | When |
|-------|--------|------|
| `capturerID` | `session.userData.user_ID` | Create operations |
| `dateCaptured` | Server UTC timestamp | Create operations |
| `modifierID` | `session.userData.user_ID` | Update operations |
| `dateModified` | Server UTC timestamp | Update operations |
| `reviewerID` | `session.userData.user_ID` | Authorization/review |
| `reviewDate` | Server UTC timestamp | Authorization/review |
| `statusID` | Business logic | All state transitions |

The Express middleware `injectAuditFields()` already handles this injection automatically.

---

## 8. Angular Architecture Rules

### Component Pattern (Standalone, Angular 19)
```
features/debt/section129/
  ├── section129-notices.component.ts    (logic, signals, DI via inject())
  ├── section129-notices.component.html  (template)
  └── section129-notices.component.css   (styles)
```

### Rules
1. **Standalone components** — no NgModules, use `imports: [...]` in `@Component`
2. **Separate files** — `.ts`, `.html`, `.css` always separate
3. **Signals for state** — `signal()`, `computed()`, `effect()` — no RxJS BehaviorSubject
4. **inject() for DI** — no constructor injection
5. **ApiService for HTTP** — all calls through `api.get()` / `api.post()`
6. **Typed models** — every API response has a TypeScript interface in `models/`
7. **Lazy routing** — all routes in `app.routes.ts` use `loadComponent`
8. **Error/loading/empty states** — every API screen must show all three states
9. **Date format** — `dd/mm/yyyy` everywhere, never `month: 'short'` or `dateStyle`
10. **Theme** — `--platinum-primary: #0f2b46`, `--platinum-accent: #c9a84c`, Inter font

### Service Pattern
```typescript
// In component — use ApiService directly
private api = inject(ApiService);

// Call pattern
this.api.get<Section129Run[]>('/api/platinum/billing-debt/section129-runs', { finYear })
  .subscribe({ next: data => this.runs.set(data), error: err => this.error.set(err.message) });
```

### Route Pattern (app.routes.ts)
```typescript
{ path: 'debt/section129', loadComponent: () => import('./features/debt/section129/section129-notices.component').then(m => m.Section129NoticesComponent) },
```

---

## 9. API Gap Analysis (What Platinum Must Build)

### Confirmed Working (Express proxy routes exist, need Platinum backend)
All endpoints in Section 4 above have Express proxy routes in `server/routes/debt.routes.ts`. The routes proxy to `BillingDebt/*` on Platinum. **None are confirmed live on the Platinum UAT API.**

### Critical Gaps

| # | Gap | Impact | Resolution |
|---|-----|--------|-----------|
| G1 | No `BillingDebt` controller exists on Platinum UAT | All 24 pages return 404/502 | API team must create controller |
| G2 | No async status polling endpoint | Can't track trial/final run progress | Add `GET section129-run-status?runId=` |
| G3 | No `IncludePensioners` column in EMS | Frontend sends flag, DB can't store it | ALTER TABLE add column |
| G4 | No `WhatsApp` column in EMS | WhatsApp distribution can't persist | ALTER TABLE add column |
| G5 | No `Selected` column on Details table | Can't persist reviewer selections | ALTER TABLE add column |
| G6 | No run files table | Multi-file output can't be tracked | CREATE TABLE |
| G7 | Section 129 config has no dedicated table | Config data lives on run headers | CREATE TABLE with cost items/rotation |
| G8 | Suburb lookup API | Frontend has free text, should be dropdown | Low priority — keep as free text for now |

---

## 10. Phase Roadmap

| Phase | Focus | Pages | Depends On | Estimated APIs |
|-------|-------|-------|-----------|---------------|
| **Phase 1** | Section 129 Config + Notices + Trial Review + Authorization | 1, 2, 3, 4 | DB changes, BillingDebt controller | 20 endpoints |
| **Phase 2** | Section 129 Report + SMS Log + Handover Management + Termination + Report | 5, 6, 7, 8, 9 | Phase 1 APIs | 8 endpoints |
| **Phase 3** | Communication Dashboard + Timeline + Qualification + Risk Scoring | 10, 11, 12, 13 | Phase 1 data | 12 endpoints |
| **Phase 4** | Batch Processing + Process Monitoring + Document Templates + Signatures + Process Engine | 14, 15, 16, 17, 18 | Phase 2 & 3 | 15 endpoints |
| **Phase 5** | Legal Rules + Audit Trail + Evidence Bundles | 19, 20, 21 | Phase 1 | 6 endpoints |
| **Phase 6** | Executive Dashboard + Predictive Forecasting + Geographic Mapping | 22, 23, 24 | Phase 1-3 data | 5 endpoints |

---

## 11. Express Route Path Correction

The Angular frontend currently calls some old paths that return 404. The correct mapping:

| Wrong Path (404) | Correct Path | Status |
|-----------------|-------------|--------|
| `/api/section129/config` | `/api/platinum/billing-debt/section129-config` | Route exists in debt.routes.ts |
| `/api/section129/runs` | `/api/platinum/billing-debt/section129-runs` | Route exists |
| `/api/billing-cycles` | `/api/platinum/billing-debt/billing-cycles` | Route exists |
| `/api/towns` | `/api/platinum/billing-debt/towns` | Route exists |
| `/api/property-categories` | `/api/platinum/billing-debt/property-categories` | Route exists |
| `/api/account-types` | `/api/platinum/billing-debt/account-types` | Route exists |
| `/api/person-types` | `/api/platinum/billing-debt/person-types` | Route exists |
| `/api/ageing-ranges` | `/api/platinum/billing-debt/ageing-ranges` | Route exists |

**Action**: The Angular Section 129 Notices component must be updated to call the correct `/api/platinum/billing-debt/...` paths.

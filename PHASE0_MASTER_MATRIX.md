# Phase 0 — Master Feature Matrix & API Design Foundation

## 1. Project Feature Matrix

| # | Page | Route | Menu Position | Category |
|---|------|-------|--------------|----------|
| 1 | Section 129 Configuration | `/debt/section129/config` | Debt > Configuration | Config |
| 2 | Section 129 Notices | `/debt/section129` | Debt > Section 129 | Core Process |
| 3 | Section 129 Trial Review | `/debt/section129/review/:runId` | (Sub-page of Notices) | Core Process |
| 4 | Section 129 Authorization | `/debt/section129/authorize` | Debt > Authorization | Core Process |
| 5 | Section 129 Report | `/debt/section129/report` | Reports > Section 129 | Reporting |
| 6 | SMS Log Report | `/debt/sms-log-report` | Reports > SMS Log | Reporting |
| 7 | Handover Management | `/debt/handover` | Debt > Handover | Core Process |
| 8 | Handover Termination | `/debt/handover/terminate` | Debt > Termination | Core Process |
| 9 | Handover Report | `/debt/handover/report` | Reports > Handover | Reporting |
| 10 | Communication Dashboard | `/debt/communication-dashboard` | Debt > Communications | Communications |
| 11 | Communication Timeline | `/debt/communication-timelines` | Debt > Timelines | Communications |
| 12 | Qualification Rules | `/debt/qualification-rules` | Debt > Qualification | Rules Engine |
| 13 | Risk Scoring | `/debt/risk-scoring` | Debt > Risk Scoring | Scoring |
| 14 | Batch Processing | `/debt/batch-processing` | Debt > Batch Processing | Engine |
| 15 | Process Monitoring | `/debt/process-monitoring` | Debt > Monitoring | Engine |
| 16 | Document Templates | `/debt/document-templates` | Debt > Templates | Documents |
| 17 | Digital Signatures | `/debt/digital-signatures` | Debt > Signatures | Documents |
| 18 | Process Engine | `/debt/process-engine` | Debt > Process Engine | Engine |
| 19 | Legal Rules Administration | `/legal/rules` | Legal > Rules | Legal |
| 20 | Compliance Audit Trail | `/legal/audit-trail` | Legal > Audit Trail | Legal |
| 21 | Litigation Evidence Bundles | `/legal/evidence-bundles` | Legal > Evidence | Legal |
| 22 | Executive Debt Dashboard | `/analytics/executive-dashboard` | Analytics > Dashboard | Analytics |
| 23 | Predictive Forecasting | `/analytics/predictive-forecasting` | Analytics > Forecasting | Analytics |
| 24 | Geographic Debt Mapping | `/analytics/geographic-mapping` | Analytics > Geographic | Analytics |

---

## 2. Screen Elements Matrix — All 24 Pages

### Page 1: Section 129 Configuration (`/debt/section129/config`)

| Element | Type | Data Source | API |
|---------|------|------------|-----|
| Financial Year | Select dropdown | Platinum API | `GET billing-debt/section129-config-list?finYear=` |
| Search button | Button | — | Triggers config list load |
| Clear button | Button | — | Resets form |
| Add New button | Button | — | Opens detail form |
| Config entries grid | Table | Platinum API | `GET billing-debt/section129-config-list` |
| — Grid: ID, FinYear, Template, SMS Template, Lapse Days, Enabled | Columns | — | — |
| — Grid actions: Edit, Delete | Buttons | — | Edit loads detail, Delete calls save with enabled=false |
| Section 129 Template | Select dropdown | Platinum API | `GET billing-debt/section129-templates` |
| SMS Notification Template | Select dropdown | Platinum API | `GET billing-debt/section129-sms-templates` |
| No of Lapse Days | Number input | User entry | — |
| No of Notices per File | Number input | User entry | — |
| Enabled checkbox | Checkbox | User toggle | — |
| Additional Billing Type | Select dropdown | Platinum API | `GET billing-debt/additional-billing-types` |
| Amount (cost item) | Number input | User entry | — |
| Add Cost Item button | Button | — | Adds row to cost table |
| Cost items grid | Table | Local state | — |
| Activate Rotation checkbox | Checkbox | User toggle | — |
| Attorney select | Select dropdown | Platinum API | `GET billing-debt/attorney-list` |
| % Debtor Count | Number input | User entry | — |
| % Handover Amount | Number input | User entry | — |
| Add Attorney button | Button | — | Adds row to rotation table |
| Attorney rotation grid | Table | Local state | — |
| Save button | Button | — | `POST billing-debt/section129-config-save` |
| Cancel button | Button | — | Returns to landing |

### Page 2: Section 129 Notices (`/debt/section129`)

| Element | Type | Data Source | API |
|---------|------|------------|-----|
| Financial Year | Select dropdown | Computed (getFinancialYearList) | — |
| Month | Select dropdown | Static months list | — |
| Run Type | Select dropdown | Static: Trial Review, Trial Run | — |
| Handover Option | Select dropdown | Static: Account, Bulk, Rotation | — |
| Configuration panel | Read-only card | Platinum API | `GET billing-debt/section129-config` |
| — Demand Letter Template | Display text | Config data | — |
| — SMS Template | Display text | Config data | — |
| — Admin Fees | Display currency | Config data | — |
| — Lapse Days | Display number | Config data | — |
| — Interest Rate | Display percent | Config data | — |
| — Minimum Amount | Display currency | Config data | — |
| Billing Cycle | Select dropdown | Platinum API | `GET billing-debt/billing-cycles` |
| Town | Select dropdown | Platinum API | `GET billing-debt/towns` |
| Suburb | Text input | User entry | — |
| Property Category | Select dropdown | Platinum API | `GET billing-debt/property-categories` |
| Account Type | Select dropdown | Platinum API | `GET billing-debt/account-types` |
| Type of Person | Select dropdown | Platinum API | `GET billing-debt/person-types` |
| Service Group Code | Text input | User entry | — |
| Ageing | Select dropdown | Platinum API | `GET billing-debt/ageing-ranges` |
| Amount Greater Than | Number input | User entry | — |
| Include Indigents | Switch | User toggle | — |
| Include Pensioners | Switch | User toggle | — |
| Exclude Deposit Balances | Switch | User toggle | — |
| Contact Person | Text input | User entry | — |
| Phone | Text input | User entry | — |
| Email | Email input | User entry | — |
| Distribution Type | Radio group | Static: Email, SMS, WhatsApp, Print, All | — |
| Print email accounts switch | Switch (conditional) | User toggle | — |
| Generated runs grid | Table | Platinum API | `GET billing-debt/section129-runs` |
| — Grid: Run ID, Status, Distribution, Actioned By, Date, Authorized By, Billing Cycle, Parameters | Columns | — | — |
| — Review action | Button per row | — | Navigates to Trial Review page |
| — Execute Final Run action | Button per row | — | `POST billing-debt/section129-final-run` |
| — Download Files action | Button per row | — | `GET billing-debt/section129-run-files` then download |
| — Remove action | Button per row | — | Delete run |
| Refresh button | Button | — | Reloads runs grid |
| Pagination | Prev/Next buttons | — | Client-side paging |
| Submit button | Button | — | `POST billing-debt/section129-trial-run` |
| Clear button | Button | — | Resets all filters |
| Cancel button | Button | — | Returns to landing |
| Run files dialog | Dialog | Platinum API | `GET billing-debt/section129-run-files` |
| — File: Name, Type, Size, Date | Display | — | — |
| — Download file button | Button per file | — | `GET billing-debt/section129-download-file?fileId=` |

### Page 3: Section 129 Trial Review (`/debt/section129/review/:runId`)

| Element | Type | Data Source | API |
|---------|------|------------|-----|
| Back to Notices button | Navigation | — | — |
| Run info card | Read-only | Platinum API | From run data |
| — Run ID, Status, Handover Option, Created Date | Display fields | — | — |
| Total Accounts card | Summary stat | Computed | — |
| Selected count card | Summary stat | Computed from checkboxes | — |
| Qualifying Amount total | Summary stat | Computed | — |
| Notice Fees total | Summary stat | Computed | — |
| Select All checkbox | Checkbox (header) | User toggle | — |
| Accounts table | Table | Platinum API | `GET billing-debt/section129-run-accounts?runId=` |
| — Checkbox, Account No, Address, Indigent, Rebate, SG Number, Days O/S, Qualifying Amt, Notice Fees | Columns | — | — |
| Pagination | Prev/Next buttons | — | Client-side |
| Final Review Complete switch | Switch | User toggle | — |
| Cancel button | Button | — | Returns to notices |
| Submit Review button | Button | — | `POST billing-debt/section129-trial-review-submit` |

### Page 4: Section 129 Authorization (`/debt/section129/authorize`)

| Element | Type | Data Source | API |
|---------|------|------------|-----|
| Refresh button | Button | — | Reloads pending list |
| Back button | Navigation | — | — |
| Authorizations table | Table | Platinum API | `GET billing-debt/section129-runs` (filtered to pending) |
| — Review dropdown | Select per row: Approve/Decline | User selection | — |
| — Notes input | Text input per row | User entry | — |
| — Run ID, Status, Distribution, Actioned By, Date, Billing Cycle, Accounts, Amount | Columns | — | — |
| Pending count | Display | Computed | — |
| Decisions badge | Display | Computed | — |
| Cancel button | Button | — | — |
| Submit Authorization button | Button | — | `POST billing-debt/section129-authorize` |

### Page 5: Section 129 Report (`/debt/section129/report`)

| Element | Type | Data Source | API |
|---------|------|------------|-----|
| Financial Year | Select dropdown | Computed | — |
| Billing Month | Select dropdown | Static | — |
| Billing Cycle | Select dropdown | Platinum API | `GET billing-debt/billing-cycles` |
| Account Number | Text input (autocomplete) | Platinum API | Account search |
| Ageing | Select dropdown | Platinum API | `GET billing-debt/ageing-ranges` |
| Amount Greater Than | Number input | User entry | — |
| Submit button | Button | — | `GET billing-debt/section129-report` |
| Clear button | Button | — | Resets filters |
| Cancel button | Button | — | — |
| Results table | Dynamic table | Platinum API | Report results |
| Pagination | Prev/Next | — | Client-side |

### Page 6: SMS Log Report (`/debt/sms-log-report`)

| Element | Type | Data Source | API |
|---------|------|------------|-----|
| Financial Year | Select dropdown | Computed | — |
| Billing Month | Select dropdown | Static | — |
| Billing Cycle | Select dropdown | Platinum API | `GET billing-debt/billing-cycles` |
| Status | Select dropdown | Static | — |
| Account Number | Text input (autocomplete) | Platinum API | Account search |
| Date From / Date To | Date inputs | User entry | — |
| Submit / Clear / Cancel buttons | Buttons | — | `GET billing-debt/sms-log-report` |
| Results table | Table | Platinum API | Report results |
| — Date, Account, Mobile, Template, Status, Message, Sent By | Columns | — | — |
| Pagination | Prev/Next | — | Client-side |

### Pages 7-24: (Summary — detailed elements captured by explorers above)

| Page | Key Actions | Direct APIs | Async/Service Bus |
|------|------------|-------------|-------------------|
| 7: Handover Management | Submit Account/Bulk/Rotation handover | attorney-list, billing-cycles, towns, ageing-ranges, handover-list, handover-submit | Bulk/Rotation handover processing |
| 8: Handover Termination | Select & terminate handovers | handover-list, handover-terminate | — |
| 9: Handover Report | Filter & view report | attorney-list, billing-cycles, handover-report | — |
| 10: Communication Dashboard | View stats, send ad-hoc | communication-stats, communication-log, communication-scheduled, communication-dispatch | Batch communication sends |
| 11: Communication Timeline | Create/manage timelines | communication-timelines (CRUD), enroll-in-timeline | Automated step execution |
| 12: Qualification Rules | CRUD rules, run tests | qualification-rules (CRUD), run-qualification-rule | Rule evaluation runs |
| 13: Risk Scoring | Score accounts, manage weights | score-account, risk-scores, scoring-weights | Bulk scoring |
| 14: Batch Processing | Trigger/monitor batch jobs | batch-jobs, batch-schedules, batch-trigger, batch-cancel | All batch jobs are async |
| 15: Process Monitoring | View active/failed/pending | process-monitoring-overview, active-runs, failed-runs, pending-approvals, handover-queues, termination-queues | — |
| 16: Document Templates | CRUD templates, upload/download | document-templates (CRUD), upload, download | — |
| 17: Digital Signatures | Create/track signature requests | digital-signatures (CRUD), audit-log | — |
| 18: Process Engine | Configure workflows & stages | process-workflows (CRUD), stages (CRUD), reorder | — |
| 19: Legal Rules | CRUD legal rules | legal-rules (CRUD), deactivate | — |
| 20: Audit Trail | Search compliance logs | compliance-log (search) | — |
| 21: Evidence Bundles | Generate & view bundles | evidence-bundle (create), evidence-bundles (list) | Bundle generation |
| 22: Executive Dashboard | View KPIs | debt-overview, aging-analysis, recovery-stats, legal-pipeline, attorney-performance, risk-distribution | — |
| 23: Predictive Forecasting | View forecasts | predictive-forecasting | — |
| 24: Geographic Mapping | View geographic analysis | geographic-distribution | — |

---

## 3. EMS Schema Reuse Matrix

### Existing EMS Tables That Support Features

| EMS Table | Purpose | Relevant Pages | Key Columns |
|-----------|---------|---------------|-------------|
| `Billing_Section129LetterOFDemand` | Section 129 run header | 2, 3, 4, 5 | `LetterOfDemand_ID`, `RunType`, `HandOverOptionId`, `AttorneyId`, `PeriodId`, `BillingCycleID`, `DemandLetter`, `AdminFee`, `IncludeIndigent`, `ExcludeDepositBalances`, `TownId`, `SuburbId`, `PropertyCategoryId`, `AccountTypeId`, `TypeOfPersonId`, `Ageing`, `AmountGreaterThen`, `LapseDays`, `ExcelPath`, `PDFPath`, `FileName`, `FinancialYear`, `EnquirieName`, `EnquiryPhone`, `EnquiryEmail`, `TrialRunReviewStatusID`, `TrialRunReviewerID`, `TrialRunReviewDate`, `FinalRunReviewStatusID`, `FinalRunReviewerID`, `FinalRunReviewDate`, `IsFinalReviewComplete`, `ZIPFilePath`, `DateCaptured`, `CapturerID`, `DateModified`, `ModifierID`, `Email`, `SMS`, `PrintLetter`, `PrintEmailAccount`, `SMSNotification` |
| `Billing_Section129LetterOFDemandDetails` | Section 129 account details per run | 3, 5 | `LetterOFDemandDetails_ID`, `LetterOfDemandID` (FK), `AccountId`, `OutStandingAmount`, `Posted`, `DatePosted`, `IsPaid`, `PaidAmount`, `TotalBalance`, `CurrentBalance`, `BalanceDue` |
| `Billing_Handover` | Basic handover flag per account | 7, 8 | `Handover_Id`, `AccountId`, `ActivateDate`, `CancelDate`, `HandoverStatus` |
| `Cons_Handovers` | Detailed handover records | 7, 8, 9, 15 | `Handover_ID`, `AccountID`, `HandoverAccountID`, `HandedOverAmount`, `HandedOverDate`, `OutstandingDaysDescription`, `OutstandingPeriodID`, `AttorneyID`, `ReferenceNumber`, `Comment`, `DateCaptured`, `CapturerID`, `DateModified`, `ModifierID`, `StatusID`, `TerminationDate`, `ReviewerID`, `ReviewDate` |
| `Cons_Handovers_Transactions` | Handover transaction detail | 7, 9 | `HandOverTransaction_ID`, `HandOverID` (FK), `HandOverAccountID`, `ServiceTypeID`, `Amount`, `VatAmount`, `InterestAmount`, `AdditionalBillingID`, `AmountAdditionalBilling`, `TransationDate`, `JournalID`, `DocumentTypeID`, `DocumentNumber` |
| `Const_Attorney` | Attorney master data | 1, 2, 7, 8, 9 | `Attorney_ID`, `AttorneyDesc`, `Address1-3`, `PostalCode`, `LandLineNo`, `MobilNo`, `Email`, `AttorneyFax`, `Commission`, `Enabled`, `TownID`, `DateCaptured`, `CapturerID`, `DateModified`, `ModifierID` |
| `Billing_LetterTemplates` | Letter templates | 1, 2, 16 | `Template_Id`, `TemplateName`, `NoticeTypeID`, `TemplateFileName` |
| `Billing_LetterTypes` | Notice type lookups | 1, 2 | `NoticeType_Id`, `NoticeTypeDescription` |
| `Billing_SelectedTemplates` | Template-to-notice mapping | 1, 2 | `NoticeTypeID`, `SelectedTemplate_Id` |

---

## 4. Sync vs Async Matrix

| Operation | Direct API (Sync) | Service Bus (Async) | Worker | Reason |
|-----------|------------------|-------------------|--------|--------|
| Load financial years | YES | — | — | Lookup |
| Load Section 129 config | YES | — | — | Config read |
| Save Section 129 config | YES | — | — | Config write |
| Load billing cycles | YES | — | — | Lookup |
| Load towns/suburbs | YES | — | — | Lookup |
| Load filter dropdowns (property cat, account type, person type, ageing) | YES | — | — | Lookup |
| Load existing runs | YES | — | — | Status read |
| Load run accounts | YES | — | — | Data read |
| Load attorneys | YES | — | — | Lookup |
| Load templates | YES | — | — | Lookup |
| Submit trial run (Section 129) | YES (initiate) | YES (process) | YES | Heavy processing: qualifies accounts against billing data |
| Trial review submit | YES | — | — | Status update + selection save |
| Authorize run | YES | — | — | Status update |
| Submit final run (Section 129) | YES (initiate) | YES (process) | YES | Heavy: generates notices, PDFs, sends communications |
| File generation | — | YES | YES | Background PDF/ZIP creation |
| Communication batch send | — | YES | YES | Bulk SMS/email dispatch |
| Handover submit (single account) | YES | — | — | Single record operation |
| Handover submit (bulk) | YES (initiate) | YES (process) | YES | Heavy: processes multiple accounts |
| Handover submit (rotation) | YES (initiate) | YES (process) | YES | Heavy: distributes across attorneys |
| Handover terminate | YES | — | — | Status update |
| Lapse period check | — | YES | YES | Scheduled job: checks workday lapse |
| Score account (single) | YES | — | — | Calculation |
| Score accounts (bulk) | YES (initiate) | YES (process) | YES | Heavy batch scoring |
| Run qualification rule | YES (initiate) | YES (process) | YES | Heavy: evaluates all accounts against rule |
| Batch job trigger | YES (initiate) | YES (process) | YES | All batch jobs are async |
| Evidence bundle generate | YES (initiate) | YES (compile) | YES | Gathers data from multiple sources |
| Report generation | YES | — | — | Query + return results |
| Dashboard aggregation | YES | — | — | Pre-computed aggregates |

---

## 5. API Gap Analysis

### Currently Implemented (Frontend + Backend + Platinum Proxy)

| API Endpoint (Backend) | Frontend Function | Status |
|----------------------|-------------------|--------|
| `GET billing-debt/section129-config` | `fetchSection129Config()` | Implemented |
| `GET billing-debt/section129-config-list` | `fetchSection129ConfigList(finYear)` | Implemented |
| `POST billing-debt/section129-config-save` | `saveSection129Config(params)` | Implemented |
| `GET billing-debt/section129-templates` | `fetchSection129Templates()` | Implemented |
| `GET billing-debt/section129-sms-templates` | `fetchSection129SmsTemplates()` | Implemented |
| `GET billing-debt/section129-runs` | `fetchSection129Runs()` | Implemented |
| `POST billing-debt/section129-trial-run` | `submitSection129TrialRun(filters)` | Implemented |
| `POST billing-debt/section129-trial-review-submit` | `submitSection129TrialReview(runId, accounts, complete)` | Implemented |
| `POST billing-debt/section129-authorize` | `authorizeSection129Run(runId, notes, review)` | Implemented |
| `POST billing-debt/section129-final-run` | `submitSection129FinalRun(runId)` | Implemented |
| `GET billing-debt/section129-run-accounts` | `fetchSection129RunAccounts(runId)` | Implemented |
| `GET billing-debt/section129-run-files` | `fetchSection129RunFiles(runId)` | Implemented |
| `GET billing-debt/section129-download-file` | `downloadSection129File(fileId)` | Implemented |
| `GET billing-debt/section129-report` | `fetchSection129Report(filters)` | Implemented |
| `GET billing-debt/additional-billing-types` | `fetchAdditionalBillingTypes()` | Implemented |
| `GET billing-debt/billing-cycles` | `fetchBillingCycles()` | Implemented |
| `GET billing-debt/towns` | `fetchTowns()` | Implemented |
| `GET billing-debt/property-categories` | `fetchPropertyCategories()` | Implemented |
| `GET billing-debt/account-types` | `fetchAccountTypes()` | Implemented |
| `GET billing-debt/person-types` | `fetchPersonTypes()` | Implemented |
| `GET billing-debt/ageing-ranges` | `fetchAgeingRanges()` | Implemented |
| `GET billing-debt/attorney-list` | `fetchAttorneyList()` | Implemented |
| `GET billing-debt/handover-list` | `fetchHandoverList()` | Implemented |
| `POST billing-debt/handover-submit` | `submitHandover(params)` | Implemented |
| `POST billing-debt/handover-terminate` | `terminateHandover(ids, reason, notes)` | Implemented |
| `GET billing-debt/handover-report` | `fetchHandoverReport(filters)` | Implemented |
| `GET billing-debt/sms-log-report` | `fetchSmsLogReport(filters)` | Implemented |

### Gaps / Missing Elements

| Gap | Description | Which Page | Priority |
|-----|------------|-----------|----------|
| No `DELETE` for Section 129 config entry | Frontend has delete button but no dedicated delete API; relies on save with `enabled=false` | Config (1) | Low — current approach works |
| No `DELETE` for Section 129 run | Frontend shows Remove action but no explicit delete run endpoint | Notices (2) | Medium |
| No suburb autocomplete API | Suburb is a free text input — should be a Platinum lookup | Notices (2) | Low |
| No `IncludePensioners` in EMS schema | Frontend switch exists but `Billing_Section129LetterOFDemand` has no `IncludePensioners` column | Notices (2) | Medium — needs EMS schema update |
| No `ServiceGroupCode` filter in EMS | Frontend has field, EMS table has `ServiceGroupID` (int) not a code lookup | Notices (2) | Low — map to existing field |
| No dedicated trial review status endpoint | Trial review status is embedded in run record, no separate status transition API | Trial Review (3) | Low — current approach works |
| No `finMonth` filter on section129-runs | Frontend sends month filter but unclear if Platinum API supports it | Notices (2) | Medium — verify Platinum API |
| No `contactPerson`, `phone`, `email` persist separately | Contact details submitted with run but stored on `Billing_Section129LetterOFDemand` fields | Notices (2) | None — already mapped |
| No async status polling endpoint | When trial/final run is submitted as async, no dedicated polling endpoint exists | Notices (2), Batch (14) | High — needed for Service Bus pattern |
| No `pensioner` exclusion flag in EMS | `IncludePensioners` not in `Billing_Section129LetterOFDemand` table | Notices (2) | Medium — new column needed |

---

## 6. Status Mapping

### Section 129 Run Statuses

| Status | Code | EMS Column | Description |
|--------|------|-----------|-------------|
| DRAFT | 0 | `TrialRunReviewStatusID = NULL` | Run created, not yet processed |
| TRIAL_RUNNING | 1 | — | Background worker executing trial |
| TRIAL_COMPLETE | 2 | `TrialRunReviewStatusID = 1` (pending review) | Trial processing finished |
| UNDER_REVIEW | 3 | `TrialRunReviewStatusID = 2` (under review) | Reviewer selecting/deselecting accounts |
| APPROVED | 4 | `TrialRunReviewStatusID = 3` (approved) | Authorized for final run |
| DECLINED | 5 | `TrialRunReviewStatusID = 4` (declined) | Authorization rejected |
| FINAL_RUNNING | 6 | `FinalRunReviewStatusID = 1` | Final notice generation in progress |
| FINAL_COMPLETE | 7 | `FinalRunReviewStatusID = 2`, `IsFinalReviewComplete = 1` | Notices generated, files ready |
| LAPSING | 8 | — | Monitoring workday lapse period |
| LAPSED | 9 | — | Lapse period expired, ready for handover |

### Handover Statuses (`Cons_Handovers.StatusID`)

| Status | Description |
|--------|-------------|
| PENDING (1) | Submitted, awaiting processing |
| ACTIVE (2) | Handed over to attorney |
| TERMINATED (3) | Handover cancelled/terminated |
| COMPLETED (4) | Debt recovered or resolved |

### Batch Job Statuses

| Status | Description |
|--------|-------------|
| PENDING | Queued for processing |
| RUNNING | Currently executing |
| COMPLETED | Successfully finished |
| FAILED | Finished with errors |
| CANCELLED | Manually cancelled |

---

## 7. Audit Fields Mapping

### Standard Audit Fields (Required on ALL writes)

| Audit Field | EMS Column | Source | Required |
|------------|-----------|-------|----------|
| CapturerID | `CapturerID` | `session.platinumUserId` | Always (create) |
| DateCaptured | `DateCaptured` | Server timestamp | Always (create) |
| ModifierID | `ModifierID` | `session.platinumUserId` | Always (update) |
| DateModified | `DateModified` | Server timestamp | Always (update) |
| ReviewerID | `ReviewerID` / `TrialRunReviewerID` / `FinalRunReviewerID` | `session.platinumUserId` | Authorization steps |
| ReviewDate | `ReviewDate` / `TrialRunReviewDate` / `FinalRunReviewDate` | Server timestamp | Authorization steps |
| StatusID | `StatusID` / `TrialRunReviewStatusID` / `FinalRunReviewStatusID` | Business logic | Always |
| Notes | `TrialRunReviewerNotes` / `FinalRunReviewerNotes` / `Comment` | User input | Where applicable |

### Implementation (Backend `injectAuditFields`)
```typescript
function injectAuditFields(session: SessionData, body: any) {
  body.capturerID = session.platinumUserId;
  body.dateCaptured = new Date().toISOString();
  body.modifierID = session.platinumUserId;
  body.dateModified = new Date().toISOString();
}
```

---

## 8. Phase Execution Plan (23 Phases)

| Phase | Page | Focus |
|-------|------|-------|
| 0 | Foundation | This document — matrices, schema, gap analysis |
| 1 | Section 129 Notices | Main notices page: filters, config panel, runs grid, submit, trial/final |
| 2 | Section 129 Configuration | Config CRUD: templates, costs, attorney rotation |
| 3 | Section 129 Trial Review | Account selection, review completion, submit |
| 4 | Section 129 Authorization | Approve/decline runs |
| 5 | Section 129 Report | Report filters and results |
| 6 | SMS Log Report | SMS delivery report |
| 7 | Handover Management | Account/Bulk/Rotation handover submission |
| 8 | Handover Termination | Select and terminate active handovers |
| 9 | Handover Report | Handover report filters and results |
| 10 | Communication Dashboard | Stats, log, scheduled, ad-hoc send |
| 11 | Communication Timeline | Timeline CRUD, step config, enrollment |
| 12 | Qualification Rules | Rule builder, conditions, test/run |
| 13 | Risk Scoring | Score calculation, dashboard, weights |
| 14 | Batch Processing | Job triggers, schedules, history |
| 15 | Process Monitoring | Overview, active/failed/pending queues |
| 16 | Document Templates | Template CRUD, versioning, upload/download |
| 17 | Digital Signatures | Signature requests, tracking, audit |
| 18 | Process Engine | Workflow + stage configuration |
| 19 | Legal Rules | Legal rule CRUD |
| 20 | Compliance Audit Trail | Search and view audit logs |
| 21 | Evidence Bundles | Generate and view litigation bundles |
| 22 | Executive Dashboard | KPI cards, charts, tables |
| 23 | Predictive Forecasting + Geographic Mapping | Forecast models, geographic analysis |

---

## 9. EMS Tables — Missing Fields / New Tables Needed

### Missing Fields on Existing Tables

| Table | Missing Field | Type | Purpose |
|-------|--------------|------|---------|
| `Billing_Section129LetterOFDemand` | `IncludePensioners` | `BIT` | Frontend switch for pensioner inclusion |
| `Billing_Section129LetterOFDemand` | `WhatsApp` | `BIT` | WhatsApp distribution channel |
| `Billing_Section129LetterOFDemand` | `StatusDescription` | `NVARCHAR(50)` | Human-readable status text |
| `Cons_Handovers` | `HandoverOption` | `INT` | Track handover mode (Account=1, Bulk=2, Rotation=3) |
| `Cons_Handovers` | `BillingCycleID` | `INT` | Track which billing cycle the handover relates to |

### New Tables Needed (Not in current EMS schema)

| Table | Purpose | Key Columns | Needed For |
|-------|---------|-------------|-----------|
| `Billing_Section129Config` | Financial year-specific Section 129 configuration | `Config_ID`, `FinancialYear`, `TemplateID`, `SMSTemplateID`, `LapseDays`, `NoticesPerFile`, `Enabled`, `ActivateRotation`, `DateCaptured`, `CapturerID`, `DateModified`, `ModifierID` | Page 1 |
| `Billing_Section129ConfigCosts` | Cost items per config entry | `CostItem_ID`, `ConfigID` (FK), `AdditionalBillingTypeID`, `Amount` | Page 1 |
| `Billing_Section129ConfigRotation` | Attorney rotation per config entry | `Rotation_ID`, `ConfigID` (FK), `AttorneyID`, `PercentDebtorCount`, `PercentHandoverAmount` | Page 1 |
| `Billing_Section129RunFiles` | Generated files per run | `File_ID`, `LetterOfDemandID` (FK), `FileName`, `FileType`, `FileSize`, `FilePath`, `DateCreated` | Page 2 |
| `Billing_QualificationRule` | Smart qualification rules | `Rule_ID`, `RuleName`, `Description`, `Priority`, `IsActive`, `Conditions` (JSON), `DateCaptured`, `CapturerID`, `DateModified`, `ModifierID` | Page 12 |
| `Billing_RiskScoringWeights` | Scoring factor weights | `Weight_ID`, `FactorName`, `Weight`, `DateModified`, `ModifierID` | Page 13 |
| `Billing_BatchJob` | Batch processing jobs | `Job_ID`, `JobType`, `Status`, `TotalRecords`, `ProcessedRecords`, `FailedRecords`, `ErrorMessage`, `StartedAt`, `CompletedAt`, `TriggeredBy`, `DateCaptured`, `CapturerID` | Page 14 |
| `Billing_BatchSchedule` | Batch job schedules | `Schedule_ID`, `JobType`, `CronExpression`, `NextRun`, `LastRun`, `IsActive`, `DateCaptured`, `CapturerID` | Page 14 |
| `Billing_ProcessWorkflow` | Debt process workflows | `Workflow_ID`, `Name`, `Description`, `Status`, `DateCaptured`, `CapturerID`, `DateModified`, `ModifierID` | Page 18 |
| `Billing_ProcessWorkflowStage` | Workflow stages | `Stage_ID`, `WorkflowID` (FK), `StageName`, `StageOrder`, `Rules` (JSON), `Templates` (JSON), `Actions` (JSON), `WaitDays`, `BusinessDaysOnly`, `AutoEscalate` | Page 18 |
| `Billing_DocumentTemplate` | Document templates | `Template_ID`, `TemplateCode`, `Name`, `Category`, `CurrentVersion`, `Status`, `FilePath`, `DateCaptured`, `CapturerID`, `DateModified`, `ModifierID` | Page 16 |
| `Billing_DocumentTemplateVersion` | Template versions | `Version_ID`, `TemplateID` (FK), `VersionNumber`, `ChangeNotes`, `FilePath`, `FileSize`, `DateCreated`, `CreatedBy` | Page 16 |
| `Billing_DigitalSignatureRequest` | Signature requests | `Request_ID`, `AccountNo`, `DocumentType`, `SignerName`, `SignerEmail`, `SignerMobile`, `Amount`, `ExpiryDays`, `Status`, `SignedAt`, `SignatureHash`, `DateCaptured`, `CapturerID` | Page 17 |
| `Billing_CommunicationLog` | Communication dispatch log | `Log_ID`, `AccountNo`, `Channel`, `Recipient`, `Subject`, `Status`, `DeliveryStatus`, `SentBy`, `DateSent` | Page 10 |
| `Billing_CommunicationTimeline` | Automated comm timelines | `Timeline_ID`, `Name`, `Description`, `IsActive`, `DateCaptured`, `CapturerID` | Page 11 |
| `Billing_CommunicationTimelineStep` | Timeline escalation steps | `Step_ID`, `TimelineID` (FK), `DayOffset`, `Channel`, `TemplateName`, `Subject`, `MessageTemplate`, `IsAutomated`, `StepOrder` | Page 11 |
| `Billing_LegalRule` | Legal compliance rules | `Rule_ID`, `RuleCode`, `Title`, `LegislationRef`, `Description`, `Category`, `EffectiveFrom`, `EffectiveTo`, `IsActive`, `Version`, `DateCaptured`, `CapturerID`, `DateModified`, `ModifierID` | Page 19 |
| `Billing_ComplianceAuditLog` | Compliance audit trail | `AuditLog_ID`, `ActionType`, `EntityType`, `EntityID`, `UserName`, `IPAddress`, `Timestamp`, `Legislation`, `ProcessStage`, `ProofOfDelivery`, `Metadata` (JSON) | Page 20 |
| `Billing_EvidenceBundle` | Litigation evidence bundles | `Bundle_ID`, `BundleRef`, `AccountNo`, `GeneratedBy`, `Status`, `DateGenerated`, `BundleData` (JSON) | Page 21 |

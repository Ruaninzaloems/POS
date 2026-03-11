# PHASE 16 — Angular Components: Debt, Legal, Analytics & Communications

**Document**: `PHASE_16_ANGULAR_COMPONENTS_DEBT_LEGAL_ANALYTICS_COMMS.md`
**Created**: 2026-03-11
**Scope**: All Angular 19 standalone components in `features/debt/`, `features/legal/`, `features/analytics/`, and `features/communications/`

---

## 1. COMPONENT INVENTORY

| # | Component | Path | Lines | API Endpoints Used | Key Models |
|---|-----------|------|-------|--------------------|------------|
| 1 | Section129NoticesComponent | `debt/section129/section129-notices.component.ts` | 287 | 10 | Section129Config, Section129Run, Section129RunFile |
| 2 | Section129ConfigComponent | `debt/section129/section129-config.component.ts` | 281 | 6 | Section129ConfigEntry, Attorney, CostItem, AttorneyRotationItem |
| 3 | Section129AuthorizationComponent | `debt/section129/section129-authorization.component.ts` | 125 | 2 | Section129Run, AuthorizationRow, ReviewDecision |
| 4 | Section129TrialReviewComponent | `debt/section129/section129-trial-review.component.ts` | 160 | 3 | Section129Run, Section129RunAccount |
| 5 | Section129ReportComponent | `debt/section129/section129-report.component.ts` | 160 | 4 | — (dynamic columns) |
| 6 | HandoverManagementComponent | `debt/handover/handover-management.component.ts` | 189 | 5 | Attorney, HandoverRecord, HandoverOption |
| 7 | HandoverTerminationComponent | `debt/handover/handover-termination.component.ts` | 174 | 3 | Attorney, HandoverRecord, TERMINATION_REASONS |
| 8 | HandoverReportComponent | `debt/handover/handover-report.component.ts` | 150 | 3 | Attorney, dynamic columns |
| 9 | RiskScoringComponent | `debt/risk-scoring/risk-scoring.component.ts` | 191 | 5 | RISK_COLORS, TabMode |
| 10 | QualificationRulesComponent | `debt/qualification/qualification-rules.component.ts` | 165 | 5 | Condition, QUALIFICATION_FIELD_OPTIONS, QUALIFICATION_OPERATOR_OPTIONS |
| 11 | CommunicationDashboardComponent | `debt/communication/communication-dashboard.component.ts` | 257 | 6 | CommunicationStats, CHANNEL_CONFIG, COMM_STATUS_CONFIG |
| 12 | CommunicationTimelineComponent | `debt/communication/communication-timeline.component.ts` | 184 | 6 | CommunicationTimeline, CommunicationStep, CHANNEL_CONFIG |
| 13 | SmsLogReportComponent | `debt/communication/sms-log-report.component.ts` | 113 | 1 | — (dynamic) |
| 14 | BatchProcessingComponent | `debt/batch/batch-processing.component.ts` | 120 | 4 | BATCH_JOB_TYPE_LABELS, BATCH_STATUS_LABELS |
| 15 | ProcessMonitoringComponent | `debt/monitoring/process-monitoring.component.ts` | 100 | 6 | ProcessMonitoringOverview, PROCESS_STATUS_LABELS |
| 16 | DocumentTemplatesComponent | `debt/documents/document-templates.component.ts` | 215 | 5 | DocumentTemplate, TemplateVersion, TEMPLATE_CATEGORIES |
| 17 | DigitalSignaturesComponent | `debt/signatures/digital-signatures.component.ts` | 171 | 4 | SignatureRequest, DOC_TYPES, SIGNATURE_STATUS_LABELS |
| 18 | ProcessEngineComponent | `debt/engine/process-engine.component.ts` | 307 | 8 | ProcessWorkflow, WorkflowStage, StageRule, StageTemplate, StageAction, StageTimer |
| 19 | LegalRulesComponent | `legal/legal-rules.component.ts` | 225 | 3 | LegalRuleVersion, RuleFormData, LEGAL_CATEGORIES |
| 20 | AuditTrailComponent | `legal/audit-trail.component.ts` | 128 | 1 | AUDIT_ACTION_TYPES |
| 21 | EvidenceBundleComponent | `legal/evidence-bundle.component.ts` | 147 | 3 | EvidenceBundle, EVIDENCE_BUNDLE_SECTIONS |
| 22 | ExecutiveDashboardComponent | `analytics/executive-dashboard.component.ts` | 222 | 6 | — (dynamic cards/bars) |
| 23 | GeographicMappingComponent | `analytics/geographic-mapping.component.ts` | 157 | 1 | GeoItem, ViewTab, SortField, SortDir, RISK_COLORS |
| 24 | PredictiveForecastingComponent | `analytics/predictive-forecasting.component.ts` | 162 | 1 | — (dynamic forecast) |
| 25 | ClientCommunicationsComponent | `communications/client-communications.component.ts` | 439 | 4 | Recipient (local), Attachment (local), CommMode |

**Total**: 25 components, ~4,647 source lines

---

## 2. SHARED SERVICE DEPENDENCIES

### 2.1 debt-config.ts Constants (222 lines)

| Constant | Type | Usage Count |
|----------|------|-------------|
| `PAGE_SIZE` | `50` | HandoverMgmt, HandoverTerm, HandoverRpt, TrialReview, BatchProc |
| `SECTION129_DEFAULTS` | object | Section129Config |
| `TERMINATION_REASONS` | array of 4 | HandoverTermination |
| `RISK_COLORS` | Record<LOW/MEDIUM/HIGH/UNKNOWN> | RiskScoring, GeographicMapping |
| `CHANNEL_CONFIG` | Record<sms/email/whatsapp/letter> | CommunicationDashboard, CommunicationTimeline |
| `COMM_STATUS_CONFIG` | Record<SENT/DELIVERED/FAILED/PENDING/COMPLETED/SKIPPED> | CommunicationDashboard |
| `QUALIFICATION_FIELD_OPTIONS` | array of 15 | QualificationRules |
| `QUALIFICATION_OPERATOR_OPTIONS` | array of 7 | QualificationRules |
| `BATCH_JOB_TYPE_LABELS` | Record<5 types> | BatchProcessing |
| `BATCH_STATUS_LABELS` | Record<6 statuses> | BatchProcessing |
| `PROCESS_STATUS_LABELS` | Record<10 statuses> | ProcessMonitoring |
| `TEMPLATE_CATEGORIES` | array of 8 | DocumentTemplates |
| `DOC_TYPES` | array of 5 | DigitalSignatures |
| `SIGNATURE_STATUS_LABELS` | Record<7 statuses> | DigitalSignatures |
| `LEGAL_CATEGORIES` | array of 5 | LegalRules |
| `LEGAL_CATEGORY_LABELS` | Record<5> | LegalRules |
| `AUDIT_ACTION_TYPES` | array of 7 | AuditTrail |
| `EVIDENCE_BUNDLE_SECTIONS` | array of 6 | EvidenceBundle |
| `RULE_FIELDS` | array of 12 | ProcessEngine |
| `RULE_OPERATORS` | array of 10 | ProcessEngine |
| `WORKFLOW_ACTION_TYPES` | array of 12 | ProcessEngine |
| `CHANNEL_OPTIONS` | array of 4 | ProcessEngine |
| `IMPACT_COLORS` | Record<6> | (available, not directly used) |

### 2.2 Model Files

| File | Interface Count | Key Interfaces |
|------|----------------|----------------|
| `debt.models.ts` | 35 | Section129Config/Entry/Run/RunAccount/RunFile, Attorney, HandoverRecord/Termination, CostItem, AttorneyRotationItem, ReviewDecision, AuthorizationRow, Condition, QualificationRule, RiskScore, ScoringWeight, CommunicationStep/Timeline/LogEntry/Stats, DocumentTemplate, TemplateVersion, SignatureRequest/AuditEntry, ProcessWorkflow, WorkflowStage, StageRule/Template/Action/Timer, BatchJob/Schedule, ProcessMonitoringOverview, ProcessRun, ApprovalItem, HandoverQueueItem, TerminationQueueItem |
| `legal.models.ts` | 5 | LegalRuleVersion, RuleFormData, ComplianceLogEntry, EvidenceBundle, BundleSection |
| `analytics.models.ts` | 10 | DebtOverview, AgingAnalysis, RecoveryStats, LegalPipelineStage, AttorneyPerformance, RiskDistributionItem, GeoItem, ForecastScenario, ForecastData, ViewTab/SortField/SortDir |

### 2.3 format.service.ts Functions Used

`formatCurrency`, `formatCurrencyCompact`, `formatDate`, `formatDateShort`, `formatTimestamp`, `formatFileSize`, `formatDuration`, `getFinancialYear`, `getFinancialYearList`

### 2.4 validation.service.ts Functions Used

`getStatusColor`, `isCourtReady`, `getConfidenceLabel`, `sortByField`

---

## 3. COMPONENT DETAIL — SECTION 129 (5 Components)

### 3.1 Section129NoticesComponent

**Purpose**: Main Section 129 landing page — submit trial/final runs, view run history grid

**State** (signals + class fields):
- `config: signal<Section129Config | null>`, `configLoading`, `runs: signal<Section129Run[]>`, `runsLoading`, `submitting`
- Filter fields: `finYear`, `finMonth`, `runType`, `handoverOption`, `billingCycle`, `town`, `suburb`, `propertyCategory`, `accountType`, `typeOfPerson`, `serviceGroupCode`, `ageing`, `amountGreaterThan`
- Booleans: `includeIndigents`, `includePensioners`, `excludeDepositBalances`
- Contact: `contactPerson`, `contactPhone`, `contactEmail`
- Distribution: `distributionType`, `mustEmailBePrinted`
- Grid: `gridPage`, `gridPageSize=10`
- File modal: `fileModalOpen`, `fileModalRunId`, `runFiles`, `filesLoading`, `downloadingFileId`
- Delete: `finalRunningId`, `deleteConfirmRunId`, `isDeleting`
- Dropdowns loaded from API: `billingCycles`, `towns`, `propertyCategories`, `accountTypes`, `personTypes`, `ageingRanges`

**API Calls** (8 on init + 2 actions):
1. `GET /api/platinum/billing-debt/section129-config`
2. `GET /api/platinum/billing-debt/section129-runs`
3. `GET /api/platinum/billing-debt/billing-cycles`
4. `GET /api/platinum/billing-debt/towns`
5. `GET /api/platinum/billing-debt/property-categories`
6. `GET /api/platinum/billing-debt/account-types`
7. `GET /api/platinum/billing-debt/person-types`
8. `GET /api/platinum/billing-debt/ageing-ranges`
9. `POST /api/platinum/billing-debt/section129-trial-run` — submit
10. `POST /api/platinum/billing-debt/section129-final-run` — final run
11. `POST /api/platinum/billing-debt/section129-delete-run` — delete
12. `GET /api/platinum/billing-debt/section129-run-files` — file modal
13. `GET /api/platinum/billing-debt/section129-download-file` — download

**Business Rules**:
- `__all__` sentinel values stripped before submission (sent as `undefined`)
- `NON_DELETABLE_STATUSES`: Approved, Authorized, Final Running, Final Complete
- Financial year computed: if month >= 6 → next year; 5 years generated
- Months ordered July–June for financial year alignment
- Row click navigates to `/debt/section129/review/:runId` only for Trial Run Review / Trial Review statuses
- `mustEmailBePrinted` only sent when `distributionType === 'email'`

### 3.2 Section129ConfigComponent

**Purpose**: CRUD for Section 129 configuration entries per financial year

**State**:
- `viewMode: 'landing' | 'detail'`, `isNewEntry`, `currentFY`
- Config fields: `enabled`, `selectedFinYear`, `section129Template`, `smsTemplate`, `lapseDays`, `noticesPerFile`, `activateRotation`
- Sub-collections: `costItems: CostItem[]`, `attorneyRotation: AttorneyRotationItem[]`
- Add-row fields: `addBillTypeId`, `addBillAmount`, `addAttorneyId`, `addPercentDebtor`, `addPercentHandover`
- Dropdowns: `templates`, `smsTemplates`, `additionalBillingTypes`, `attorneys`

**API Calls**:
1. `GET /api/platinum/billing-debt/section129-templates`
2. `GET /api/platinum/billing-debt/section129-sms-templates`
3. `GET /api/platinum/billing-debt/additional-billing-types`
4. `GET /api/platinum/billing-debt/attorney-list`
5. `GET /api/platinum/billing-debt/section129-config-list` — search by finYear
6. `POST /api/platinum/billing-debt/section129-config-save` — save

**Validation Rules**:
- Financial year, template, SMS template required
- `lapseDays` must be 14–99
- `noticesPerFile` must be ≥ 1
- Only one enabled config per financial year
- Cost items: duplicate `additionalBillingTypeId` not allowed, amount ≥ 0
- Attorney rotation: either `percentDebtorCount` OR `percentHandoverAmount` (not both), must sum to 100%, no duplicate attorney IDs
- Cost item add requires both fields or none

### 3.3 Section129AuthorizationComponent

**Purpose**: Authorize/decline pending Section 129 runs

**State**: `rows: AuthorizationRow[]` (each has `run`, `review`, `notes`), `loading`, `submitting`

**API Calls**:
1. `GET /api/platinum/billing-debt/section129-runs` — filtered client-side for 'notice issued' + 'trial' statuses
2. `POST /api/platinum/billing-debt/section129-authorize` — per-row sequential

**Business Rules**:
- Client-side filtering: status must include 'notice issued' AND 'trial', exclude 'review' and 'final'
- `ReviewDecision`: 'Approve' | 'Decline' | ''
- Declined runs require notes (max 250 chars)
- Sequential POST per actionable row with success/error counting
- Row CSS class: `row-approve` / `row-decline` based on decision

### 3.4 Section129TrialReviewComponent

**Purpose**: Review accounts in a trial run, select/deselect, submit review

**State**: `runId` (from route param), `accounts: signal<Section129RunAccount[]>`, `runInfo`, `selectedIds: Set<number>`, `finalReviewComplete`, `currentPage`, `pageSize=PAGE_SIZE`

**API Calls**:
1. `GET /api/platinum/billing-debt/section129-run-accounts` — `{ runId }`
2. `GET /api/platinum/billing-debt/section129-runs` — find matching run
3. `POST /api/platinum/billing-debt/section129-trial-review-submit` — `{ runId, selectedAccountIds, finalReviewComplete }`

**Business Rules**:
- Pre-selected accounts: if any have `selected: true`, use those; otherwise select all
- Page-level select-all toggle
- `totalQualifyingAmount` and `totalNoticeFees` computed from selected accounts only
- Days class: >90 → danger, >60 → warning
- Navigates back to `/debt/section129` on submit

### 3.5 Section129ReportComponent

**Purpose**: Query and display Section 129 report data

**State**: `finYear`, `finMonth`, `billingCycle`, `accountNo`, `ageing`, `amountGreaterThan`, `results`, `gridPage`, `gridPageSize=10`, `accountSuggestions`, `showSuggestions`

**API Calls**:
1. `GET /api/platinum/billing-debt/billing-cycles`
2. `GET /api/platinum/billing-debt/ageing-ranges`
3. `POST /api/platinum/billing-payment/search-accounts` — account autocomplete
4. `GET /api/platinum/billing-debt/section129-report` — main query

**Business Rules**:
- Dynamic columns from `Object.keys(results[0])`, filtered to exclude `_` prefixed
- `formatColumnHeader`: camelCase → Title Case
- Account search autocomplete triggers at 3+ characters
- `amountGreaterThan` validated as non-negative integer

---

## 4. COMPONENT DETAIL — HANDOVER (3 Components)

### 4.1 HandoverManagementComponent

**Purpose**: Submit account handovers to attorneys — single account, bulk, or rotation modes

**State** (all signals via `inject()`):
- `handoverOption: signal<'account' | 'bulk' | 'rotation'>`, `accountSearch`, `selectedAttorneyId`
- Filters: `billingCycle`, `town`, `ageing`, `amountGreaterThan`
- `rotationAllocations: signal<{ attorneyId, attorneyName, percentage }[]>`
- `handovers`, `loadingHandovers`, `loadingRef`, `submitting`, `currentPage`

**Computed**: `activeAttorneys`, `totalAllocation`, `paginatedHandovers`, `totalPages`

**API Calls**:
1. `GET /api/platinum/billing-debt/attorney-list`
2. `GET /api/platinum/billing-debt/billing-cycles`
3. `GET /api/platinum/billing-debt/towns`
4. `GET /api/platinum/billing-debt/ageing-ranges`
5. `GET /api/platinum/billing-debt/handover-list`
6. `POST /api/platinum/billing-debt/handover-submit`

**Business Rules**:
- **Account mode**: requires account number + attorney
- **Bulk mode**: requires attorney; optional filters
- **Rotation mode**: requires ≥1 attorney, percentages must sum to 100%
- `rotationAllocations` sent as `{ attorneyId, percentage }[]`
- Status badge classes: active→success, terminated/closed→danger, pending→warning

### 4.2 HandoverTerminationComponent

**Purpose**: Select and terminate active handovers

**State** (all signals):
- `handovers`, `attorneys`, `loading`, `submitting`
- Filters: `accountFilter`, `attorneyFilter`, `statusFilter`, `dateFrom`, `dateTo`
- `selectedIds: signal<Set<number>>`, `terminationReason`, `terminationNotes`

**Computed**: `uniqueStatuses`, `filteredHandovers`, `totalPages`, `paginatedHandovers`, `allVisibleSelected`

**API Calls**:
1. `GET /api/platinum/billing-debt/handover-list`
2. `GET /api/platinum/billing-debt/attorney-list`
3. `POST /api/platinum/billing-debt/handover-terminate` — `{ handoverIds[], reason, notes }`

**Business Rules**:
- 5-dimension filter: account text, attorney dropdown, status dropdown, date range
- Page-level select-all toggle (scoped to visible page)
- `TERMINATION_REASONS`: paid_in_full, write_off, settlement, other
- Reason required; notes optional
- Filter change resets page to 1 and clears selection

### 4.3 HandoverReportComponent

**Purpose**: Query handover report by financial year, month, billing cycle, attorney, account

**State** (signals): `finYear`, `finMonth`, `billingCycle`, `selectedAttorneyId`, `accountNo`, `results`, `currentPage`, `loading`, `hasSearched`

**Computed**: `resultColumns`, `paginatedResults`, `totalPages`

**API Calls**:
1. `GET /api/platinum/billing-debt/attorney-list`
2. `GET /api/platinum/billing-debt/billing-cycles`
3. `GET /api/platinum/billing-debt/handover-report` — main query

**Business Rules**:
- Dynamic columns from first result row
- Response unwrapping: tries `data` as array, then `data.value`, then `data.items`
- `isAmountColumn`/`isStatusColumn` detected by column name substring
- No results → toast info

---

## 5. COMPONENT DETAIL — RISK SCORING & QUALIFICATION (2 Components)

### 5.1 RiskScoringComponent

**Purpose**: Score individual accounts, view score dashboard, edit scoring weights

**3 Tabs**: `score` | `dashboard` | `weights`

**State** (signals):
- Score tab: `accountNo`, `bulkInput`, `scoring`, `scoreResult`, `factors`
- Input sliders: `paymentHistory(50)`, `arrearDays(0)`, `lastPaymentDays(30)`, `totalArrears(0)`, `indigentStatus(false)`, `previousLegalActions(0)`, `locationRisk(50)`, `waterArrears(0)`, `electricityArrears(0)`
- Dashboard: `dashScores`, `dashTotal`, `dashFilter`, `dashPage`, `dashLoading`, `dashPageSize=10`
- Weights: `weights`, `editWeights`, `weightsLoading`, `weightsSaving`

**Computed**: `dashTotalPages`, `lowCount/medCount/highCount`, `weightEntries`, `totalWeight`

**API Calls**:
1. `POST /api/debt-scoring/score-account` — single score
2. `POST /api/debt-scoring/score-bulk` — bulk score
3. `GET /api/debt-scoring/scores` — dashboard (paginated)
4. `GET /api/debt-scoring/weights` — load weights
5. `PUT /api/debt-scoring/weights` — save weights

**Business Rules**:
- Score result reads both camelCase and snake_case fields (`overallScore` / `overall_score`)
- Gauge SVG stroke: `(score / 100) * 327` out of 327
- Risk category color from `RISK_COLORS` config
- Factor bar class: ≤30→low, ≤60→medium, >60→high
- Bulk score: default params applied (paymentHistory=50, arrearAge=90, etc.)
- Dashboard reloads on filter change or tab switch
- Weight total computed from editable weight values
- **NOTE**: Uses `/api/debt-scoring/` prefix (NOT `/api/platinum/`)

### 5.2 QualificationRulesComponent

**Purpose**: CRUD qualification rules with condition builder, test against CSV accounts

**State** (signals):
- `rules`, `loading`, `showEditor`, `editingId`, `ruleName`, `ruleDescription`, `rulePriority`
- `conditions: signal<Condition[]>`, `saving`, `runningRuleId`, `runResults`, `testAccounts`

**Computed**: `previewText` — generates WHERE clause preview

**API Calls**:
1. `GET /api/debt-scoring/qualification-rules` — list
2. `POST /api/debt-scoring/qualification-rules` — create
3. `PUT /api/debt-scoring/qualification-rules/:id` — update
4. `DELETE /api/debt-scoring/qualification-rules/:id` — delete
5. `PUT /api/debt-scoring/qualification-rules/:id` — toggle isActive
6. `POST /api/debt-scoring/qualification-rules/:id/run` — test run

**Business Rules**:
- Condition builder: field (15 options), operator (7 options), value, logicOperator (AND/OR)
- First condition always gets `logicOperator: 'AND'`
- Numeric values auto-detected via `isNaN(Number(c.value))`
- CSV test format: `accountNo,totalArrears,arrearDays,lastPaymentDays,propertyValue,waterArrears,electricityArrears`
- Preview text: `WHERE field operator value AND/OR field operator value ...`
- Toggle active sends full payload with only `isActive` flipped
- **NOTE**: Uses `/api/debt-scoring/` prefix (NOT `/api/platinum/`)

---

## 6. COMPONENT DETAIL — COMMUNICATION (3 Components)

### 6.1 CommunicationDashboardComponent

**Purpose**: Communication stats, log, scheduled queue, and manual dispatch

**4 Tabs**: `dashboard` | `log` | `scheduled` | `send`

**State** (signals):
- Stats: `stats: signal<CommunicationStats>`, `statsLoading`
- Log: `logs`, `logTotal`, `logLoading`, `logPage`, `logChannel`, `logStatus`, `logAccount`, `logPageSize=10`
- Scheduled: `scheduled`, `schedTotal`, `schedLoading`, `schedPage`, `schedStatus`, `processing`, `schedPageSize=10`
- Send: `sendChannel`, `sendAccount`, `sendRecipient`, `sendSubject`, `sendMessage`, `sending`, `accountSuggestions`, `showSuggestions`

**Computed**: `logTotalPages`, `schedTotalPages`, `channelEntries` (from stats.byChannel), `recipientLabel`, `recipientPlaceholder`

**API Calls**:
1. `GET /api/communications/stats`
2. `GET /api/communications/log` — paginated + filtered
3. `GET /api/communications/scheduled` — paginated + filtered
4. `POST /api/communications/process-scheduled` — trigger processing
5. `POST /api/platinum/billing-payment/search-accounts` — account autocomplete
6. `POST /api/communications/dispatch` — send communication

**Business Rules**:
- Channel entries compute `deliveryRate = delivered / (sent + failed) * 100`
- Dispatch payload: `{ accountNo, channel, recipient, subject?, messageBody }`
- Recipient label changes by channel: Email → "Email Address", Letter → "Postal Address", else → "Mobile Number"
- Account autocomplete: 3+ chars, maps both camelCase and PascalCase field names
- **NOTE**: Uses `/api/communications/` prefix (NOT `/api/platinum/`)

### 6.2 CommunicationTimelineComponent

**Purpose**: CRUD communication timelines with step editor and account enrollment

**State** (signals):
- `timelines`, `loading`, `selectedTimeline`, `steps: signal<Step[]>`
- Create: `showCreate`, `newName`, `newDesc`, `creating`
- `saving`, `enrollAccount`, `enrolling`

**Computed**: `sortedSteps` — sorted by dayOffset

**API Calls**:
1. `GET /api/communications/timelines` — list
2. `GET /api/communications/timelines/:id` — detail
3. `POST /api/communications/timelines` — create
4. `DELETE /api/communications/timelines/:id` — delete
5. `PUT /api/communications/timelines/:id/steps` — save steps
6. `POST /api/communications/enroll` — enroll account

**Business Rules**:
- Steps have: `dayOffset`, `channel`, `templateName`, `templateBody`, `subject`, `isAutomated`
- New step auto-calculates dayOffset: max existing + 7 (or 1 if first)
- Timeline detail maps both camelCase and snake_case fields
- Enroll response includes `scheduledCount`
- Delete confirms with browser `confirm()`
- **NOTE**: Uses `/api/communications/` prefix

### 6.3 SmsLogReportComponent

**Purpose**: Search and display SMS delivery logs from Platinum API

**State** (signals): `loading`, `error`, `logs`, `searched`, `accountNo`, `dateFrom`, `dateTo`, `statusFilter`, `gridPage`, `gridPageSize=15`

**Computed**: `filteredLogs` (client-side status filter), `paginatedLogs`, `totalGridPages`

**API Calls**:
1. `GET /api/platinum/billing-debt/sms-log-report` — `{ accountNo?, dateFrom?, dateTo? }`

**Business Rules**:
- Status filter applied client-side after API fetch
- Response unwrapping: array, or `data.logs`, or `data.data`
- Status classes: delivered/sent→success, failed/error→error, pending/queued→pending
- Date format: dd/mm/yyyy HH:mm
- **NOTE**: Uses `/api/platinum/` prefix (Platinum API data)

---

## 7. COMPONENT DETAIL — BATCH & MONITORING (2 Components)

### 7.1 BatchProcessingComponent

**Purpose**: View batch jobs, trigger new jobs, cancel running jobs

**State** (signals): `loading`, `triggeringType`, `cancellingId`, `jobs`, `schedules`, `filterType`, `filterStatus`

**Computed**: `filteredJobs`, `activeCount`, `pendingCount`, `failedCount`, `completedCount`

**API Calls**:
1. `GET /api/batch-processing/jobs`
2. `GET /api/batch-processing/schedules`
3. `POST /api/batch-processing/trigger` — `{ jobType }`
4. `POST /api/batch-processing/cancel` — `{ jobId }`

**Business Rules**:
- 5 job types: TRIAL_RUN, FINAL_RUN, LAPSE_CHECK, NOTIFICATION, ATTORNEY_ALLOCATION
- 6 statuses: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, SCHEDULED
- Status counts computed from full job list
- Duration formatting via `formatDuration(start, end)`
- **NOTE**: Uses `/api/batch-processing/` prefix

### 7.2 ProcessMonitoringComponent

**Purpose**: Overview dashboard for all debt process queues

**State** (signals): `loading`, `tab`, `overview`, `activeRuns`, `failedRuns`, `pendingApprovals`, `handoverQueues`, `terminationQueues`

**Computed**: `stats` (5 stat cards), `overviewSections` (5 sections with items/border colors)

**API Calls** (6 parallel):
1. `GET /api/process-monitoring/overview`
2. `GET /api/process-monitoring/active-runs`
3. `GET /api/process-monitoring/failed-runs`
4. `GET /api/process-monitoring/pending-approvals`
5. `GET /api/process-monitoring/handover-queues`
6. `GET /api/process-monitoring/termination-queues`

**Business Rules**:
- Uses `Promise.allSettled` — partial failures tolerated
- Item labels try: `runType`, `jobType`, `accountNo`, `description`, fallback 'Item'
- 10 process statuses in `PROCESS_STATUS_LABELS`
- Color scheme: blue(active), red(failed), amber(pending), indigo(handover), purple(termination)
- **NOTE**: Uses `/api/process-monitoring/` prefix

---

## 8. COMPONENT DETAIL — DOCUMENTS & SIGNATURES (2 Components)

### 8.1 DocumentTemplatesComponent

**Purpose**: CRUD document templates with version management and file upload

**State** (signals): `loading`, `templates`, `filterCategory`, `searchText`, form signals, version/upload dialog signals

**Computed**: `filtered` (category + text search)

**API Calls**:
1. `GET /api/document-templates` — list
2. `POST /api/document-templates` — create
3. `PUT /api/document-templates/:id` — update
4. `GET /api/document-templates/:id/versions` — version list
5. `POST /api/document-templates/:id/upload` — upload new version
6. `GET /api/document-templates/:id/download` — download

**Business Rules**:
- 8 categories: SECTION_129, HANDOVER, AOD, FINAL_DEMAND, SUMMONS, ARRANGEMENT, CLEARANCE, GENERAL
- Version auto-increment: splits `currentVersion` on `.`, increments minor
- Name + templateCode required for create
- Search filters on name and templateCode
- **NOTE**: Uses `/api/document-templates/` prefix

### 8.2 DigitalSignaturesComponent

**Purpose**: Create and track digital signature requests

**2 Tabs**: `requests` | `audit`

**State** (signals): `loading`, `tab`, `requests`, `auditLog`, filters, form signals, dialog signals

**Computed**: `filtered` (status + docType + text search), `pendingCount`, `signedCount`, `declinedCount`, `expiredCount`

**API Calls**:
1. `GET /api/digital-signatures` — list
2. `GET /api/digital-signatures/:id` — detail
3. `POST /api/digital-signatures` — create
4. `GET /api/digital-signatures/audit-log` — audit tab

**Business Rules**:
- 5 document types: AOD, PAYMENT_ARRANGEMENT, SETTLEMENT_AGREEMENT, CONSENT_ORDER, GENERAL
- 7 statuses: PENDING, SENT, VIEWED, SIGNED, DECLINED, EXPIRED, CANCELLED
- Create requires: accountNo, signerName, signerEmail
- `expiryDays` defaults to 7
- Audit tab lazy-loads on first visit
- **NOTE**: Uses `/api/digital-signatures/` prefix

---

## 9. COMPONENT DETAIL — PROCESS ENGINE (1 Component)

### 9.1 ProcessEngineComponent

**Purpose**: Configure debt recovery workflows with stages, rules, templates, actions, and timers

**State** (signals):
- Workflow list: `workflows`, `viewMode: 'list' | 'detail'`, `selectedWorkflow`
- Stages: `stages`, `loadingStages`, `expandedStage`
- Workflow dialog: `wfName`, `wfDescription`, `wfActive`
- Stage dialog: `stName`, `stDescription`, `stActive`, `stRules`, `stTemplates`, `stActions`, `stTimer`, `stageTab`

**API Calls**:
1. `GET /api/process-engine/workflows` — list
2. `POST /api/process-engine/workflows` — create
3. `PUT /api/process-engine/workflows/:id` — update
4. `DELETE /api/process-engine/workflows/:id` — delete
5. `GET /api/process-engine/workflows/:id/stages` — list stages
6. `POST /api/process-engine/workflows/:id/stages` — create stage
7. `PUT /api/process-engine/workflows/:id/stages/:stageId` — update stage
8. `DELETE /api/process-engine/workflows/:id/stages/:stageId` — delete stage
9. `POST /api/process-engine/workflows/:id/stages/reorder` — reorder

**Business Rules**:
- Stages sorted by `stageNumber`
- New stage: `stageNumber = max + 1`
- Stage reorder: swap stageNumbers between adjacent items
- Stage sub-tabs: rules | templates | actions | timer
- Rules use 12 field options, 10 operators
- Actions use 12 action types (SEND_SMS through WEBHOOK)
- Timer: `waitDays`, `businessDaysOnly`, `escalateOnExpiry`
- Templates: `templateCode`, `templateName`, `channel`
- Delete workflow confirms cascade: "all stages, rules, and actions"
- **NOTE**: Uses `/api/process-engine/` prefix

---

## 10. COMPONENT DETAIL — LEGAL (3 Components)

### 10.1 LegalRulesComponent

**Purpose**: CRUD legal compliance rules with versioning and category filtering

**State** (signals): `loading`, `rules`, `searchQuery`, `categoryFilter`, `gridPage`, `dialogOpen`, `editingRule`, `form`, `saving`, `historyRule`

**Computed**: `filteredRules` (text search), `paginatedRules`, `totalGridPages`

**API Calls**:
1. `GET /api/legal/rules` — `{ category? }`
2. `POST /api/legal/rules` — create
3. `PUT /api/legal/rules/:id` — update
4. `DELETE /api/legal/rules/:id` — deactivate (not hard delete)

**Business Rules**:
- 5 legal categories: NCA, MSA, MPRA, POPIA, CPA
- Required fields: ruleCode, title, legislationRef, category
- `effectiveFrom` defaults to today
- Search filters on ruleCode, title, legislativeRef, category
- Delete = deactivate (confirm says "deactivate")
- History toggle shows version history for individual rule
- Uses standard `toast.show(msg, type)` pattern (not shorthand)

### 10.2 AuditTrailComponent

**Purpose**: Search and display compliance audit log entries

**State** (signals): `actionType`, `accountNo`, `dateFrom`, `dateTo`, `userFilter`, `results`, `loading`, `searched`, `expandedRow`, `gridPage`

**Computed**: `paginatedResults`, `totalGridPages`

**API Calls**:
1. `GET /api/legal/compliance-log` — `{ actionType?, accountNo?, dateFrom?, dateTo?, userId? }`

**Business Rules**:
- 7 action types: NOTICE_ISSUED, HANDOVER_SUBMITTED, AUTHORIZATION, FINAL_RUN, TERMINATION, CONFIG_CHANGE
- Expandable rows show full JSON detail
- `isCourtReady` check from validation service
- `truncateId`: shows first 8 chars + '...'
- Timestamp formatting via `formatTimestamp`
- No `OnInit` — purely manual search

### 10.3 EvidenceBundleComponent

**Purpose**: Generate and browse evidence bundles for court proceedings

**State** (signals): `accountNo`, `generating`, `bundles`, `loading`, `expandedId`, `expandedBundle`, `loadingDetail`, `gridPage`

**Computed**: `paginatedBundles`, `totalGridPages`

**API Calls**:
1. `GET /api/legal/evidence-bundles` — list
2. `POST /api/legal/evidence-bundle` — generate `{ accountNo }`
3. `GET /api/legal/evidence-bundle/:id` — detail

**Business Rules**:
- 6 evidence sections: noticeHistory, smsLogs, emailLogs, postalBatch, accountLedger, proofOfService
- Section data detection: array.length > 0 or object with keys
- Section items preview: first 5 items shown, remainder counted
- Item formatting: strings shown as-is, objects JSON-stringified and truncated to 80 chars
- Enter key triggers generate
- Expand/collapse toggles detail loading

---

## 11. COMPONENT DETAIL — ANALYTICS (3 Components)

### 11.1 ExecutiveDashboardComponent

**Purpose**: Read-only executive dashboard with debt overview, aging, recovery, pipeline, attorney performance, risk distribution

**State** (signals): `loading`, `overview`, `aging`, `recovery`, `pipeline`, `attorneys`, `risk`

**API Calls** (6 parallel via `Promise.allSettled`):
1. `GET /api/analytics/debt-overview`
2. `GET /api/analytics/aging-analysis`
3. `GET /api/analytics/recovery-stats`
4. `GET /api/analytics/legal-pipeline`
5. `GET /api/analytics/attorney-performance`
6. `GET /api/analytics/risk-distribution`

**Business Rules**:
- `totalDebt`: sum of all aging buckets (current + 30 + 60 + 90 + 120+)
- `overallRecoveryRate`: delivered / sent across all channels
- Aging bars: 5 buckets with distinct colors (green→red gradient)
- Pipeline entries: Section 129 → Handover → Collection → Recovered
- Risk distribution: segment width = count / totalScored * 100%
- Attorney list from `attorneys.attorneys[]`
- Recovery by period: 30/60/90 day windows
- Bar widths calculated as percentage of maximum value
- Currency uses `formatCurrencyCompact`

### 11.2 GeographicMappingComponent

**Purpose**: Geographic debt distribution analysis by ward, suburb, town, property type

**4 Tabs**: `ward` | `suburb` | `town` | `propertyType`

**State** (signals): `loading`, `data`, `tab`, `sortField`, `sortDir`

**API Calls**:
1. `GET /api/analytics/geographic-distribution`

**Business Rules**:
- Single API call returns all 4 dimensions
- Sortable by: name, totalDebt, accountCount, avgDebt, avgRiskScore
- Sort toggle: same field → flip direction; new field → desc
- Heat map: top 10 items, bar width = item.totalDebt / totalDebtAll * 100%
- Risk badge classes: HIGH→danger, MEDIUM→warning, LOW→success
- Heat bar color: HIGH→red, MEDIUM→amber, LOW→green
- Uses `sortByField` from validation service

### 11.3 PredictiveForecastingComponent

**Purpose**: Predictive recovery forecasting with confidence scoring

**State** (signals): `loading`, `data`

**API Calls**:
1. `GET /api/analytics/predictive-forecasting`

**Business Rules**:
- Forecast periods: 30/60/90 days with estimated rates
- Confidence gauge: SVG stroke = (score / 100) * 327
- Confidence labels from `getConfidenceLabel` (≥70 green, ≥40 amber, else red)
- Risk breakdown tiers: low, medium, high with expectedRecovery
- Channel effectiveness: per-channel rate/sent/delivered stats
- Key drivers with impact classification (HIGH/LOW/POSITIVE/NEGATIVE)
- Trend bars: width relative to maxTrendRate

---

## 12. COMPONENT DETAIL — CLIENT COMMUNICATIONS (1 Component)

### 12.1 ClientCommunicationsComponent

**Purpose**: Bulk email/SMS composition with recipient management, CSV import, contact enrichment

**State** (signals):
- `mode: 'email' | 'sms'`, `loading`, `error`
- Recipients: `recipients: signal<Recipient[]>`, `searchQuery`, `searching`, `searchResults`, `searchDropdownOpen`, `contactIndicators`
- Compose: `subject`, `messageBody`, `attachments`
- Import: `importing`, `importProgress`, `contactEnriching`, `contactEnrichProgress`
- `showPreview`

**Private**: `recipientIds: Set<number>`, `searchTimer`

**Computed**: `selectedRecipients`, `validEmailRecipients`, `validSmsRecipients`, `totalEmailAddresses`

**API Calls**:
1. `POST /api/platinum/billing-payment/search-accounts` — recipient search
2. `GET /api/platinum/billing-account-management/get-contact-details` — per account
3. `GET /api/platinum/billing-enquiry/name-info-by-account` — per account
4. `GET /api/platinum/billing-account-management/get-additional-emails` — per account

**Business Rules**:
- **NOT a dispatcher** — `handleSend` logs payload to console, shows prototype message
- Recipient interface: id, accountId, accountNo, name, email, additionalEmails[], mobile, address, outstanding, selected, contactLoading, contactLoaded
- Email validation: regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- Mobile validation: SA patterns (0[6-8]XXXXXXXX, +27, 27 prefix, or 0XXXXXXXXX)
- Mobile normalization: strips +27/27 prefix → 0XXXXXXXXX
- Contact extraction: tries both camelCase and PascalCase field names from Platinum API
- Additional emails fetched and validated individually
- CSV import: batch size 20, extracts numeric strings 2-15 digits, deduplicates, validates against search-accounts API
- Contact enrichment: batch size 10, runs after import completes
- Progress tracking for both import and contact enrichment phases
- Download template: generates CSV blob with 3 sample account numbers
- File attachments: tracked by name/size but not actually uploaded (prototype)
- Search debounced: 300ms, triggers at 2+ chars
- Contact indicators: pre-fetches email/mobile availability for search results

---

## 13. API ENDPOINT SUMMARY BY PREFIX

| Prefix | Components | Endpoint Count |
|--------|-----------|----------------|
| `/api/platinum/billing-debt/` | Section129 (5), Handover (3), SmsLogReport | ~25 |
| `/api/platinum/billing-payment/` | Section129Report, CommunicationDashboard, ClientComms | 1 (search-accounts) |
| `/api/platinum/billing-account-management/` | ClientComms | 2 |
| `/api/platinum/billing-enquiry/` | ClientComms | 1 |
| `/api/debt-scoring/` | RiskScoring, QualificationRules | ~8 |
| `/api/communications/` | CommunicationDashboard, CommunicationTimeline | ~10 |
| `/api/batch-processing/` | BatchProcessing | 4 |
| `/api/process-monitoring/` | ProcessMonitoring | 6 |
| `/api/document-templates/` | DocumentTemplates | 6 |
| `/api/digital-signatures/` | DigitalSignatures | 4 |
| `/api/process-engine/` | ProcessEngine | 9 |
| `/api/legal/` | LegalRules, AuditTrail, EvidenceBundle | ~6 |
| `/api/analytics/` | ExecutiveDashboard, GeographicMapping, PredictiveForecasting | 8 |

**Total unique endpoint patterns**: ~90

---

## 14. CROSS-CUTTING PATTERNS

### 14.1 DI Pattern Split
- **Constructor injection**: Section129Notices, Section129Config, Section129Authorization, Section129TrialReview, Section129Report, LegalRules, AuditTrail, EvidenceBundle, ExecutiveDashboard, GeographicMapping, PredictiveForecasting
- **`inject()` function**: HandoverMgmt, HandoverTerm, HandoverReport, RiskScoring, QualificationRules, CommunicationDashboard, CommunicationTimeline, SmsLogReport, BatchProcessing, ProcessMonitoring, DocumentTemplates, DigitalSignatures, ProcessEngine, ClientCommunications

### 14.2 Toast Pattern Split
- **`toast.show(msg, type)`**: Section129Notices, Section129Config, Section129Report, Section129TrialReview, LegalRules, AuditTrail, EvidenceBundle, ExecutiveDashboard, GeographicMapping, PredictiveForecasting
- **`toast.error()/success()/info()`**: HandoverMgmt, HandoverTerm, HandoverReport, RiskScoring, QualificationRules, CommunicationDashboard, CommunicationTimeline, SmsLogReport, BatchProcessing, ProcessMonitoring, DocumentTemplates, DigitalSignatures, ProcessEngine, ClientCommunications

### 14.3 Date Format Compliance
All 25 components use `dd/mm/yyyy` format (with `padStart(2,'0')` pattern). Components with time: add `HH:mm`. No violations of the permanent date format standard.

### 14.4 Error Handling Pattern
All components follow: `catch (err: any) → toast.show/error(err?.error?.message || err?.message || 'fallback')`. No silent catches. No fallback data in live flows.

### 14.5 Loading States
All components have explicit loading signals. Multi-source loads use `Promise.allSettled` with partial failure tolerance. Individual action loads use dedicated signals (`submitting`, `saving`, `triggeringType`, etc.).

---

## 15. ARCHITECTURAL NOTES

1. **Platinum API vs Local API**: Section 129 and Handover features use `/api/platinum/billing-debt/` (proxied to Platinum). Risk scoring, qualification, batch processing, monitoring, document templates, digital signatures, and process engine use local API routes (`/api/debt-scoring/`, `/api/batch-processing/`, etc.) — these are orchestration/configuration endpoints that don't directly proxy to Platinum.

2. **ClientCommunicationsComponent is a prototype**: `handleSend` does NOT dispatch — it logs to console. This is clearly noted in the toast message.

3. **No NgModules**: All 25 components are `standalone: true` with `imports: [CommonModule, FormsModule]`. Analytics components (ExecutiveDashboard, GeographicMapping, PredictiveForecasting) only import `CommonModule` (no forms).

4. **Component file separation**: All components follow the standard pattern with separate `.component.ts`, `.component.html`, and `.component.css` files.

5. **Signal vs Property split**: Earlier components (Section129) use class properties + `signal()` for loading states. Later components (Handover, Batch, Monitoring) use signals for everything including form fields.

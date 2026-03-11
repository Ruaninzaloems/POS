# Phase 20 — Shared UI Components, Angular Services & TypeScript Models

**Document**: Source-Verified Technical Reference  
**Scope**: 13 Shared UI Components · 5 Angular Shared Services · 4 Model Files  
**Source Files Read**: Every `.component.ts` in `shared/components/`, every service in `services/` and `core/services/`, every model in `models/`  
**Author**: Agent (source-verified, no fabrication)

---

## Table of Contents

1. [Shared UI Components (13)](#1-shared-ui-components-13)
2. [Angular Shared Services (5)](#2-angular-shared-services-5)
3. [TypeScript Model Files (4)](#3-typescript-model-files-4)
4. [Barrel Export (index.ts)](#4-barrel-export-indexts)
5. [Cross-Reference: Component → Service Dependencies](#5-cross-reference-component--service-dependencies)
6. [Summary Counts](#6-summary-counts)

---

## 1. Shared UI Components (13)

All components live in `angular-client/src/app/shared/components/`.  
All are **standalone: true** (Angular 19, no NgModules).  
Barrel-exported from `index.ts`.

---

### 1.1 SpinnerComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-spinner` |
| **File** | `spinner.component.ts` (inline template + inline styles) |
| **Imports** | None |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `size` | `string` | `'1.5rem'` |

**Template:** Single `<span class="spinner">` with `[style.width]` and `[style.height]` bound to `size`. Has `data-testid="spinner"`.

**Host styles:** `display: inline-flex; align-items: center; justify-content: center;`

---

### 1.2 BadgeComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-badge` |
| **File** | `badge.component.ts` (inline template + inline styles) |
| **Imports** | None |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `variant` | `'success' \| 'danger' \| 'warning' \| 'info' \| 'default'` | `'default'` |

**Template:** `<span class="badge" [class]="'badge badge-' + variant" [attr.data-testid]="'badge-' + variant"><ng-content /></span>`

**Host styles:** `display: inline-flex;`

---

### 1.3 CardComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-card` |
| **File** | `card.component.ts` + `.html` + `.css` (external template) |
| **Imports** | None |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `title` | `string` | `''` |
| `subtitle` | `string` | `''` |
| `padding` | `boolean` | `true` |

---

### 1.4 TabsComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-tabs` |
| **File** | `tabs.component.ts` + `.html` + `.css` (external template) |
| **Imports** | None |
| **Exports** | `TabItem` interface |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `tabs` | `TabItem[]` | `[]` |
| `activeTab` | `string` | `''` |

**Outputs:**

| Output | Emits |
|--------|-------|
| `tabChange` | `string` (the selected tab key) |

**TabItem interface:**

```typescript
export interface TabItem {
  key: string;
  label: string;
}
```

**Methods:**
- `selectTab(key: string)` — emits `tabChange` with the key.

---

### 1.5 DataTableComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-data-table` |
| **File** | `data-table.component.ts` + `.html` + `.css` (external template) |
| **Imports** | `CommonModule` |
| **Exports** | `TableColumn` interface |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `columns` | `TableColumn[]` | `[]` |
| `data` | `any[]` | `[]` |
| `loading` | `boolean` | `false` |
| `emptyMessage` | `string` | `'No data available'` |
| `sortColumn` | `string` | `''` |
| `sortDirection` | `'asc' \| 'desc'` | `'asc'` |

**Outputs:**

| Output | Emits |
|--------|-------|
| `sortChange` | `{ column: string; direction: 'asc' \| 'desc' }` |
| `rowClick` | `any` (the clicked row data) |

**Content projection:**
- `@ContentChild('rowTemplate') rowTemplate: TemplateRef<any>` — allows custom row rendering via `<ng-template #rowTemplate>`.

**TableColumn interface:**

```typescript
export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}
```

**Methods:**
- `onSort(column)` — toggles asc/desc if column is sortable, emits `sortChange`.
- `getSortIcon(column)` — returns `'↕'` (unsorted), `'↑'` (asc), or `'↓'` (desc).

---

### 1.6 DialogComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-dialog` |
| **File** | `dialog.component.ts` + `.html` + `.css` (external template) |
| **Imports** | None |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `open` | `boolean` | `false` |
| `title` | `string` | `''` |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` |

**Outputs:**

| Output | Emits |
|--------|-------|
| `close` | `void` |

**Methods:**
- `onOverlayClick(event)` — if click target has class `dialog-overlay`, emits `close`.

---

### 1.7 PaginationComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-pagination` |
| **File** | `pagination.component.ts` + `.html` + `.css` (external template) |
| **Imports** | None |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `currentPage` | `number` | `1` |
| `totalPages` | `number` | `1` |
| `totalItems` | `number` | `0` |
| `pageSize` | `number` | `10` |

**Outputs:**

| Output | Emits |
|--------|-------|
| `pageChange` | `number` (new page number) |

**Computed getters:**
- `pages` — returns a 5-page sliding window: `[currentPage-2 .. currentPage+2]`, clamped to `[1..totalPages]`.
- `startItem` — `(currentPage - 1) * pageSize + 1`.
- `endItem` — `Math.min(currentPage * pageSize, totalItems)`.

**Methods:**
- `goToPage(page)` — emits `pageChange` if page is in range and not current page.

---

### 1.8 EmptyStateComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-empty-state` |
| **File** | `empty-state.component.ts` + `.html` + `.css` (external template) |
| **Imports** | None |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `icon` | `string` | `'📋'` |
| `title` | `string` | `'No data found'` |
| `message` | `string` | `''` |

---

### 1.9 StatCardComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-stat-card` |
| **File** | `stat-card.component.ts` + `.html` + `.css` (external template) |
| **Imports** | None |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `label` | `string` | `''` |
| `value` | `string \| number` | `''` |
| `icon` | `string` | `''` |
| `trend` | `string` | `''` |
| `trendDirection` | `'up' \| 'down' \| 'neutral'` | `'neutral'` |

---

### 1.10 LoadingStateComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-loading-state` |
| **File** | `loading-state.component.ts` + `.html` + `.css` (external template) |
| **Imports** | `SpinnerComponent` |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `loading` | `boolean` | `false` |
| `error` | `string` | `''` |
| `loadingText` | `string` | `'Loading...'` |

**Outputs:**

| Output | Emits |
|--------|-------|
| `retry` | `void` |

**Dependency:** Uses `SpinnerComponent` internally when `loading` is true.

---

### 1.11 ConfirmDialogComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-confirm-dialog` |
| **File** | `confirm-dialog.component.ts` + `.html` + `.css` (external template) |
| **Imports** | `DialogComponent` |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `open` | `boolean` | `false` |
| `title` | `string` | `'Confirm Action'` |
| `message` | `string` | `'Are you sure you want to proceed?'` |
| `confirmLabel` | `string` | `'Confirm'` |
| `cancelLabel` | `string` | `'Cancel'` |
| `variant` | `'primary' \| 'danger'` | `'primary'` |

**Outputs:**

| Output | Emits |
|--------|-------|
| `confirm` | `void` |
| `cancel` | `void` |

**Dependency:** Wraps `DialogComponent` internally.

---

### 1.12 PageHeaderComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-page-header` |
| **File** | `page-header.component.ts` + `.html` + `.css` (external template) |
| **Imports** | None |

**Inputs:**

| Input | Type | Default |
|-------|------|---------|
| `title` | `string` | `''` |
| `subtitle` | `string` | `''` |

---

### 1.13 ToastComponent

| Property | Value |
|----------|-------|
| **Selector** | `app-toast` |
| **File** | `toast.component.ts` + `.html` + `.css` (external template) |
| **Imports** | None (but has constructor DI) |

**Constructor dependencies:**
- `public toastService: ToastService` — injected via constructor, used in template to read toast messages.

**No inputs/outputs.** Reads state from `ToastService` directly.

---

## 2. Angular Shared Services (5)

### 2.1 Format Functions (format.service.ts)

**File:** `angular-client/src/app/services/format.service.ts`  
**Pattern:** Standalone exported functions (NOT an injectable class).

| Function | Signature | Returns | Null/Invalid Handling |
|----------|-----------|---------|----------------------|
| `formatDate` | `(d: string \| null \| undefined): string` | `dd/mm/yyyy` | null/undefined → `'—'`; invalid date → `String(d)` |
| `formatDateShort` | `(d: string \| null \| undefined): string` | `dd/mm/yyyy HH:MM` | null/undefined → `'—'`; invalid date → `String(d)` |
| `formatTimestamp` | `(ts: string \| null \| undefined): string` | `dd/mm/yyyy HH:MM:SS` | null/undefined → `'—'`; invalid date → `String(ts)` |
| `formatCurrency` | `(value: number \| null \| undefined): string` | `R X,XXX.XX` (en-ZA, 2dp) | null/undefined → `'—'` |
| `formatCurrencyCompact` | `(value: number): string` | `R X.XXK` or `R X.XXM` | Values < 1000 → `R X.XX` |
| `formatFileSize` | `(bytes: number \| null \| undefined): string` | `X B` / `X.X KB` / `X.X MB` | null/undefined → `'—'` |
| `formatDuration` | `(startDate: string \| null \| undefined, endDate: string \| null \| undefined): string` | `Xm Xs` or `Xs` | null startDate → `'—'`; null endDate → uses `Date.now()` |
| `formatPercentage` | `(value: number \| null \| undefined, decimals?: number): string` | `X.X%` (default 1dp) | null/undefined → `'—'` |
| `formatDateOnly` | `(d: string \| null \| undefined): string` | `dd/mm/yyyy` (same as formatDate) | null/undefined → `'—'`; invalid → `String(d)` |
| `getFinancialYear` | `(): string` | `YYYY/YYYY` (July cutoff, no parameters) | N/A |
| `getFinancialYearList` | `(count?: number): string[]` | Array of FY strings, default count=5 | N/A |

**Key differences from typical services:**
- These are **bare exported functions**, not methods on a class. Import as `import { formatDate } from '../../services/format.service';`.
- `formatDuration` takes two date strings (startDate, endDate), NOT milliseconds. If endDate is null, it uses current time.
- `formatCurrency` returns `'—'` for null (not `'R 0.00'`).
- Invalid dates return `String(d)` (the original input), NOT `'—'`.
- Financial year cutoff: month >= 6 (July onwards) → next calendar year is the end year.

---

### 2.2 Validation Functions (validation.service.ts)

**File:** `angular-client/src/app/services/validation.service.ts`  
**Pattern:** Standalone exported functions (NOT an injectable class).

**Exported interface:**

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

**Validation functions (all return `ValidationResult`):**

| Function | Signature | Description |
|----------|-----------|-------------|
| `validateRequired` | `(fields: Record<string, unknown>): ValidationResult` | Checks each field for null/undefined/empty-string. Adds `"{key} is required."` per failing field. |
| `validateNumericRange` | `(value: number, min: number, max: number, fieldName: string): ValidationResult` | Checks NaN and range `[min, max]`. |
| `validatePercentageSum` | `(values: number[], tolerance?: number): ValidationResult` | Checks values sum to 100% (default tolerance: 0.01). |
| `validateEmail` | `(email: string): ValidationResult` | Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| `validateAccountNo` | `(accountNo: string): ValidationResult` | Checks non-empty after trim. |

**Utility functions:**

| Function | Signature | Description |
|----------|-----------|-------------|
| `isCourtReady` | `(row: Record<string, unknown>): boolean` | Returns true if all 9 fields present: actionType, entityType, entityId, userId, userName, ipAddress, apiCallId, timestamp, legislationRef. |
| `getRiskCategory` | `(score: number): 'LOW' \| 'MEDIUM' \| 'HIGH'` | ≤30=LOW, ≤60=MEDIUM, >60=HIGH. |
| `getConfidenceLabel` | `(score: number): string` | ≥70='High Confidence', ≥40='Moderate Confidence', else 'Low Confidence'. |
| `sortByField` | `<T>(items: T[], field: keyof T, dir: 'asc' \| 'desc'): T[]` | Generic typed sort (string localeCompare or numeric). Returns new array (spread copy). |
| `getStatusColor` | `(status: string): string` | Returns Tailwind CSS class string based on status keyword (final, review, trial, authorized/approved, else slate). |

---

### 2.3 ExportService

**File:** `angular-client/src/app/services/export.service.ts`  
**Injectable:** `{ providedIn: 'root' }` (this IS an Angular injectable class)

**Exported interface:**

```typescript
export interface ExportOptions {
  title: string;
  tabName: string;
  accountNo: string;
  accountName?: string;
  accountStatus?: string;
  address?: string;
  financialYear?: string;
  extraHeaders?: { label: string; value: string }[];
}
```

**Public methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `exportCsv` | `(options: ExportOptions, headers: string[], rows: (string \| number)[][]): void` | Downloads CSV with UTF-8 BOM, branded header rows, filename: `GEORGE_MUNICIPALITY_{tabName}_{accountNo}_{YYYYMMDD}.csv` |
| `exportPdf` | `(options: ExportOptions, headers: string[], rows: (string \| number)[][], columnAligns?: ('left' \| 'right' \| 'center')[]): void` | Opens new browser window with print-ready HTML. A4 landscape. Auto-triggers `print()` after 400ms. |

**Private helpers:**
- `getExportDate()` — returns `{ dateStr, timeStr, fileDate }` with `dd/mm/yyyy`, `HH:MM`, `YYYYMMDD`.
- `buildFilename(tabName, accountNo, ext)` — sanitizes and builds `GEORGE_MUNICIPALITY_...` filename.
- `csvEsc(val)` — escapes double-quotes for CSV.
- `downloadBlob(blob, filename)` — creates download link, clicks, revokes.
- `escHtml(s)` — escapes `&`, `<`, `>`, `"` for HTML.

**CSV specifics:**
- UTF-8 BOM (`\uFEFF`) for Excel compatibility.
- Branded header: municipality title, account info, export date/time.
- MIME type: `text/csv;charset=utf-8`.

**PDF specifics:**
- Opens new window (`window.open`), writes full HTML document.
- `@page { size: A4 landscape; margin: 15mm; }`.
- Header: hardcoded `#0f2b46` border and h1 color (matches `--platinum-primary`).
- Subtitle: hardcoded `#c9a84c` color (matches `--platinum-accent`).
- Table headers: hardcoded `background: #0f2b46; color: #fff`.
- Column alignment support via optional `columnAligns` parameter.
- Auto-triggers `window.print()` after 400ms delay.

---

### 2.4 Debt Config Constants (debt-config.ts)

**File:** `angular-client/src/app/services/debt-config.ts`  
**Pattern:** Pure exported constants (all `as const`) — no injectable service.

**Dropdown/select option arrays:**

| Constant | Type | Items | Description |
|----------|------|-------|-------------|
| `RULE_FIELDS` | `{ value, label }[]` | 12 | Workflow rule fields (outstandingBalance, daysPastDue, accountAge, accountType, serviceType, previousStageComplete, paymentArrangementActive, indigentStatus, legalHold, municipalArea, customerCategory, lastPaymentDays) |
| `RULE_OPERATORS` | `{ value, label }[]` | 10 | Operators (eq, neq, gt, gte, lt, lte, in, notIn, isTrue, isFalse) |
| `WORKFLOW_ACTION_TYPES` | `{ value, label }[]` | 12 | Actions (SEND_SMS, SEND_EMAIL, SEND_LETTER, GENERATE_NOTICE, HANDOVER_ATTORNEY, ISSUE_SUMMONS, APPLY_RESTRICTION, FLAG_ACCOUNT, CREATE_TASK, ESCALATE, UPDATE_STATUS, WEBHOOK) |
| `CHANNEL_OPTIONS` | `{ value, label }[]` | 4 | Channels (SMS, EMAIL, LETTER, WHATSAPP) |
| `TEMPLATE_CATEGORIES` | `{ value, label }[]` | 8 | Categories (SECTION_129, HANDOVER, AOD, FINAL_DEMAND, SUMMONS, ARRANGEMENT, CLEARANCE, GENERAL) |
| `DOC_TYPES` | `{ value, label }[]` | 5 | Document types (AOD, PAYMENT_ARRANGEMENT, SETTLEMENT_AGREEMENT, CONSENT_ORDER, GENERAL) |
| `LEGAL_CATEGORIES` | `{ value, label }[]` | 5 | Legal categories (NCA, MSA, MPRA, POPIA, CPA) |
| `AUDIT_ACTION_TYPES` | `{ value, label }[]` | 7 | Includes `__all__` filter option, plus NOTICE_ISSUED, HANDOVER_SUBMITTED, AUTHORIZATION, FINAL_RUN, TERMINATION, CONFIG_CHANGE |
| `EVIDENCE_BUNDLE_SECTIONS` | `{ key, label }[]` | 6 | Sections: noticeHistory, smsLogs, emailLogs, postalBatch, accountLedger, proofOfService |
| `QUALIFICATION_FIELD_OPTIONS` | `{ value, label }[]` | 15 | Fields for qualification rules (waterArrears, electricityArrears, ratesArrears, refuseArrears, sewerageArrears, totalArrears, arrearDays, lastPaymentDays, propertyValue, overallScore, indigentStatus, previousLegalActions, debtSize, paymentHistory, locationRisk) |
| `QUALIFICATION_OPERATOR_OPTIONS` | `{ value, label }[]` | 7 | Operators (>, <, >=, <=, =, !=, contains) |
| `TERMINATION_REASONS` | `{ value, label }[]` | 4 | Reasons (paid_in_full, write_off, settlement, other) |

**Status label maps (all `Record<string, { label: string; className: string }>`):**

| Constant | Keys | Description |
|----------|------|-------------|
| `SIGNATURE_STATUS_LABELS` | PENDING, SENT, VIEWED, SIGNED, DECLINED, EXPIRED, CANCELLED | Signature request status → label + Tailwind CSS class |
| `BATCH_STATUS_LABELS` | PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, SCHEDULED | Batch job status → label + Tailwind CSS class |
| `PROCESS_STATUS_LABELS` | RUNNING, COMPLETED, FAILED, PENDING, AWAITING_APPROVAL, QUEUED, PROCESSING, REJECTED, APPROVED, TERMINATED | Process run status → label + Tailwind CSS class |

**Job type labels:**

| Constant | Type | Keys |
|----------|------|------|
| `BATCH_JOB_TYPE_LABELS` | `Record<string, { label: string; color: string }>` | TRIAL_RUN, FINAL_RUN, LAPSE_CHECK, NOTIFICATION, ATTORNEY_ALLOCATION |

**Category label map:**

| Constant | Type | Description |
|----------|------|-------------|
| `LEGAL_CATEGORY_LABELS` | `Record<string, string>` | Plain string map: NCA, MSA, MPRA, POPIA, CPA → full names |

**Channel/communication config:**

| Constant | Type | Keys | Description |
|----------|------|------|-------------|
| `CHANNEL_CONFIG` | `Record<string, { label, color, bg }>` | sms, email, whatsapp, letter | Channel display styling |
| `COMM_STATUS_CONFIG` | `Record<string, { color, bg }>` | SENT, DELIVERED, FAILED, PENDING, COMPLETED, SKIPPED | Communication status styling |

**Color maps:**

| Constant | Type | Keys | Shape |
|----------|------|------|-------|
| `RISK_COLORS` | `Record<string, {...}>` | LOW, MEDIUM, HIGH, UNKNOWN | `{ bg, text, border, bar }` (Tailwind classes) |
| `IMPACT_COLORS` | `Record<string, {...}>` | HIGH, MEDIUM, LOW, POSITIVE, NEUTRAL, NEGATIVE | `{ bg, text, border }` (Tailwind classes) |

**Other constants:**

| Constant | Type | Value |
|----------|------|-------|
| `PAGE_SIZE` | `number` | `50` |
| `SECTION129_DEFAULTS` | `object` | `{ section129Template: 'Section 129 Standard', smsTemplate: 'SMS Notification', lapseDays: 14, noticesPerFile: 500, activateRotation: true, enabled: true }` |

---

### 2.5 PosBasketService

**File:** `angular-client/src/app/services/pos-basket.service.ts`  
**Injectable:** `{ providedIn: 'root' }`  
**Pattern:** Signal-based reactive state management.

**Key features:**
- Signal-based basket state using `signal()` and `computed()`.
- 4 basket item types: `account`, `clearance`, `prepaid`, `misc`.
- Processing order constant `PROCESSING_ORDER`: account=1, clearance=2, prepaid=3, misc=4.
- `allocateSplitTender()` splits cash/card amounts per PROCESSING_ORDER.
- SA cash rounding: rounds total to nearest 10c, adjusts first basket item.
- Typed models in `models/pos-basket.models.ts`.

---

## 3. TypeScript Model Files (4)

### 3.1 debt.models.ts

**File:** `angular-client/src/app/models/debt.models.ts`  
**Interfaces:** 37 · **Type aliases:** 7

| Interface | Fields | Used By |
|-----------|--------|---------|
| `DocumentTemplate` | id, templateCode, name, category, description?, currentVersion, isActive, fileType?, lastModifiedBy?, lastModifiedAt?, createdAt? | Document Templates |
| `TemplateVersion` | id, templateId, version, changeNotes?, fileSize?, uploadedBy?, uploadedAt?, isActive? | Template Versioning |
| `SignatureRequest` | id, accountNo, documentType, signerName, signerEmail, signerPhone?, amount?, description?, status, sentAt?, viewedAt?, signedAt?, declinedAt?, expiresAt?, signatureHash?, createdAt? | Digital Signatures |
| `SignatureAuditEntry` | id, signatureId, action, performedBy?, performedAt, ipAddress?, details? | Signature Audit |
| `ProcessWorkflow` | id, name, description?, isActive, version?, stageCount?, createdAt?, modifiedAt?, modifiedBy? | Process Engine |
| `StageRule` | id?, field, operator, value, logicOperator? | Workflow Stage Rules |
| `StageTemplate` | id?, templateCode, templateName, channel? | Workflow Stage Templates |
| `StageAction` | id?, actionType, description?, isAutomated, config? | Workflow Stage Actions |
| `StageTimer` | waitDays, businessDaysOnly, escalateOnExpiry | Workflow Stage Timers |
| `WorkflowStage` | id, workflowId, stageNumber, name, description?, isActive, rules[], templates[], actions[], timer | Workflow Stages |
| `BatchJob` | id, jobType, status, startedAt?, completedAt?, scheduledAt?, triggeredBy?, totalRecords?, processedRecords?, failedRecords?, errorMessage? | Batch Processing |
| `BatchSchedule` | id, jobType, cronExpression?, nextRunAt?, isActive, description? | Batch Scheduling |
| `ProcessMonitoringOverview` | activeRuns, failedRuns, pendingApprovals, handoverQueued, terminationQueued, completedToday | Process Monitoring |
| `ProcessRun` | id, runType, status, startedAt?, completedAt?, startedBy?, totalAccounts?, processedAccounts?, failedAccounts?, errorMessage?, notes? | Process Runs |
| `ApprovalItem` | id, runType, status, submittedBy?, submittedAt?, totalAccounts?, totalAmount?, notes? | Approval Queue |
| `HandoverQueueItem` | id, accountNo, accountName?, attorneyName?, status, queuedAt?, amount? | Handover Queue |
| `TerminationQueueItem` | id, accountNo, accountName?, attorneyName?, status, reason?, queuedAt?, amount? | Termination Queue |
| `Condition` | field, operator, value, logicOperator: 'AND' \| 'OR' | Qualification Rules |
| `QualificationRule` | id, name, description?, conditions[], isActive, createdAt?, modifiedAt? | Qualification |
| `RiskScore` | accountNo, overallScore, category, factors: Record, scoredAt? | Risk Scoring |
| `ScoringWeight` | factor, weight, description? | Risk Scoring Weights |
| `CommunicationStep` | dayOffset, channel, templateName, templateBody, subject, isAutomated | Communication Timeline Steps |
| `CommunicationTimeline` | id, name, description?, isActive, steps[], createdAt?, modifiedAt? | Communication Timeline |
| `CommunicationLogEntry` | id, accountNo, channel, status, sentAt?, deliveredAt?, templateName?, recipient?, errorMessage? | Communication Log |
| `CommunicationStats` | totalSent, totalDelivered, totalFailed, totalPending, byChannel: Record | Communication Dashboard |
| `QualificationRunResult` | ruleId, ruleName, matchedAccounts, totalAccounts, matchedAccountsList?, executedAt? | Qualification Runs |
| `Section129Config` | configId?, finYear?, demandLetterTemplate, demandLetterTemplateId?, smsTemplate, smsTemplateId?, adminFees, lapseDays, noticesPerFile?, activateRotation?, enabled?, noticeType?, interestRate?, minimumAmount?, includeIndigents?, includePensioners?, excludeDepositBalances?, costItems?, attorneyRotation? | Section 129 Configuration |
| `Section129ConfigEntry` | id?, finYear, section129Template, smsTemplate, additionalBillingType?, totalFees?, noticesPerFile, lapseDays, activateRotation, enabled, costItems?, attorneyRotation? | Section 129 Config List Entry |
| `Section129Run` | runId, status, statusId, distributionType, actionedBy, dateCreated, authorizedBy, billingCycle, runParameters, handoverOption, runType, totalAccounts, totalAmount | Section 129 Runs |
| `Section129RunAccount` | detailId, accountId, accountNo, address, indigentStatus, rebateStatus, sgNumber, outstandingDays, qualifyingAmount, noticeFees, totalBalance, currentBalance, balanceDue, selected | Section 129 Run Accounts |
| `Section129RunFile` | fileId, fileName, fileType, fileSize, dateCreated | Section 129 Run Files |
| `HandoverRecord` | handoverId, accountNo, accountName, attorney, attorneyId, handoverDate, status, handedOverAmount, outstandingDays, billingCycle, handoverOption | Handover Management |
| `Attorney` | attorneyId, attorneyName, firmName, contactNumber, email, commission, allocationPercentage?, isActive | Attorney Management |
| `HandoverTermination` | terminationId, handoverId, accountNo, attorney, reason, notes, status, terminationDate, approvedBy | Handover Termination |
| `CostItem` | nr, additionalBillingTypeId, additionalBillingTypeName, amount | Cost Schedule |
| `AttorneyRotationItem` | nr, attorneyId, attorneyName, percentDebtorCount, percentHandoverAmount | Attorney Rotation |
| `AuthorizationRow` | run: any, review: ReviewDecision, notes: string | Authorization UI |

**Type aliases (7):**

| Type | Values |
|------|--------|
| `ReviewDecision` | `'Approve' \| 'Decline' \| ''` |
| `ConfigViewMode` | `'landing' \| 'detail'` |
| `HandoverOption` | `'account' \| 'bulk' \| 'rotation'` |
| `RunType` | `'trial-review' \| 'trial-run'` |
| `DistributionType` | `'email' \| 'sms' \| 'whatsapp' \| 'print' \| 'all'` |
| `TabMode` | `'score' \| 'dashboard' \| 'weights'` |
| `CommTabMode` | `'dashboard' \| 'log' \| 'scheduled' \| 'send'` |

---

### 3.2 legal.models.ts

**File:** `angular-client/src/app/models/legal.models.ts`  
**Interfaces:** 5

| Interface | Fields | Used By |
|-----------|--------|---------|
| `LegalRuleVersion` | id, ruleCode, title, category, description, legislativeRef, isActive, version, effectiveFrom, effectiveTo?, conditions?: Record, metadata?: Record, createdAt?, updatedAt? | Legal Rules CRUD |
| `RuleFormData` | ruleCode, title, legislationRef, description, category, effectiveFrom, effectiveTo, isActive | Rule Create/Edit Form |
| `ComplianceLogEntry` | id, actionType, entityType?, entityId?, userId?, userName?, ipAddress?, apiCallId?, timestamp?, legislationRef?, details?, accountNo?, outcome? | Audit Trail |
| `EvidenceBundle` | id, accountNo, bundleReference, generatedBy, generatedAt, bundleData: Record, status | Evidence Bundles |
| `BundleSection` | key, label | Evidence Bundle Sections |

---

### 3.3 analytics.models.ts

**File:** `angular-client/src/app/models/analytics.models.ts`  
**Interfaces:** 9 · **Type aliases:** 3

| Interface | Fields | Used By |
|-----------|--------|---------|
| `DebtOverview` | totalDebt, totalAccounts, averageDebt, collectionRate, activeNotices, pendingHandovers | Executive Dashboard |
| `AgingAnalysis` | current, days30, days60, days90, days120, days150, days180Plus | Aging Analysis |
| `RecoveryStats` | totalRecovered, recoveryRate, byPeriod[], byChannel[] | Recovery Stats |
| `LegalPipelineStage` | stage, count, amount | Legal Pipeline |
| `AttorneyPerformance` | attorneyName, handedOverCount, handedOverAmount, recoveredAmount, recoveryRate | Attorney Performance |
| `RiskDistributionItem` | category, count, amount, percentage | Risk Distribution |
| `GeoItem` | name, totalDebt, accountCount, avgDebt, avgRiskScore, riskCounts: Record, dominantRisk | Geographic Mapping |
| `ForecastScenario` | name, description, impact, predictedRecovery, confidence, timeframe, factors[] | Predictive Forecasting |
| `ForecastData` | currentRecoveryRate, predictedRecoveryRate, confidence, trends[], scenarios[], recommendations[] | Forecasting |

**Type aliases (3):**

| Type | Values |
|------|--------|
| `ViewTab` | `'ward' \| 'suburb' \| 'town' \| 'propertyType'` |
| `SortField` | `'name' \| 'totalDebt' \| 'accountCount' \| 'avgDebt' \| 'avgRiskScore'` |
| `SortDir` | `'asc' \| 'desc'` |

---

### 3.4 pos-basket.models.ts

**File:** `angular-client/src/app/models/pos-basket.models.ts`  
**Type aliases:** 4 · **Constants:** 2 · **Interfaces:** 9

**Type aliases:**

| Type | Values |
|------|--------|
| `BasketItemType` | `'account' \| 'clearance' \| 'prepaid' \| 'misc'` |
| `ReceiptDeliveryMethod` | `'print' \| 'email' \| 'whatsapp' \| 'sms'` |
| `TenderType` | `'cash' \| 'card' \| 'cheque' \| 'eft'` |
| `SearchMode` | `'tabs' \| 'unified'` |

**Constants:**

| Constant | Type | Value |
|----------|------|-------|
| `PROCESSING_ORDER` | `Record<BasketItemType, number>` | `{ account: 1, clearance: 2, prepaid: 3, misc: 4 }` |
| `TYPE_LABELS` | `Record<BasketItemType, string>` | `{ account: 'Consumer Payment', clearance: 'Clearance', prepaid: 'Prepaid Recharge', misc: 'Miscellaneous' }` |

**Interfaces:**

| Interface | Key Fields |
|-----------|------------|
| `AccountItemData` | accountId, accountNumber, name, address, billId, cutOffID, cutOffAmount, debtAmount, debtArrangementId, sundryDebtorsId, billingCycleId, hasPrepaidMeter, prepaidMeterNo, originalData |
| `ClearanceItemData` | clearanceId, status, ownerName, propertyDesc, accounts: ClearanceAccountItem[] |
| `ClearanceAccountItem` | accountId, accountNumber, name, amount, paymentAmount, serviceType |
| `PrepaidItemData` | meterNumber, serviceType, breakdown, tokenResult |
| `MiscItemData` | groupId, groupName, scoaItemId, scoaItemName, lastName, initials, description, isVatable, vatPercentage, vatAmount |
| `BasketItem` | id, type, label, description, amountDue, amountToPay, accountData?, clearanceData?, prepaidData?, miscData? |
| `UnifiedSearchResult` | resultType (BasketItemType \| 'group'), id, label, description, balance, status, rawData, groupAccounts? |
| `SplitTenderAllocation` | cashItems, cardItems, cashTotal, cardTotal |
| `ReceiptResult` | receiptNumber, tenderType, amount, items, rawResponse |

---

## 4. Barrel Export (index.ts)

**File:** `angular-client/src/app/shared/components/index.ts`

Exports all 13 components + 2 interfaces:

```typescript
export { SpinnerComponent } from './spinner.component';
export { BadgeComponent } from './badge.component';
export { CardComponent } from './card.component';
export { TabsComponent, type TabItem } from './tabs.component';
export { DataTableComponent, type TableColumn } from './data-table.component';
export { DialogComponent } from './dialog.component';
export { PaginationComponent } from './pagination.component';
export { EmptyStateComponent } from './empty-state.component';
export { StatCardComponent } from './stat-card.component';
export { LoadingStateComponent } from './loading-state.component';
export { ConfirmDialogComponent } from './confirm-dialog.component';
export { PageHeaderComponent } from './page-header.component';
export { ToastComponent } from './toast.component';
```

---

## 5. Cross-Reference: Component → Service Dependencies

| Component | Depends On |
|-----------|------------|
| `LoadingStateComponent` | `SpinnerComponent` |
| `ConfirmDialogComponent` | `DialogComponent` |
| `ToastComponent` | `ToastService` (core) |
| All others | No shared component/service dependencies |

---

## 6. Summary Counts

| Category | Count |
|----------|-------|
| Shared UI Components | 13 |
| Components with inline template | 2 (Spinner, Badge) |
| Components with external template | 11 |
| Exported interfaces from components | 2 (TabItem, TableColumn) |
| Standalone function modules | 2 (format.service.ts, validation.service.ts) |
| Injectable service classes | 1 (ExportService) |
| Constant config files | 1 (debt-config.ts) |
| Signal-based services | 1 (PosBasketService) |
| Model files | 4 (debt, legal, analytics, pos-basket) |
| Total interfaces across all models | 60 (debt: 37, legal: 5, analytics: 9, pos-basket: 9) |
| Total type aliases across all models | 14 (debt: 7, analytics: 3, pos-basket: 4) |
| Total constants in models | 2 (pos-basket: PROCESSING_ORDER, TYPE_LABELS) |

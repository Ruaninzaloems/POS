# PHASE 12: SHARED SERVICES, MODELS & UI COMPONENTS — DETAIL PACK

**Document Version**: 1.1
**Date**: 11 March 2026
**Scope**: All Angular shared/core services, typed models, reusable UI components, and application bootstrap
**Coverage**: 5 core services, 5 app services, 4 model files, 13 shared components, layout shell, root app, routing, and config

---

## TABLE OF CONTENTS

1. [Core Services](#1-core-services)
2. [Application Services](#2-application-services)
3. [Typed Models](#3-typed-models)
4. [Shared UI Components](#4-shared-ui-components)
5. [Application Bootstrap & Routing](#5-application-bootstrap--routing)
6. [Dependency Graph](#6-dependency-graph)
7. [Design System Standards](#7-design-system-standards)
8. [Cross-Cutting Observations](#8-cross-cutting-observations)

---

## 1. CORE SERVICES

### 1.1 ApiService
- **Path**: `angular-client/src/app/core/services/api.service.ts`
- **Lines**: 40
- **Scope**: Singleton HTTP wrapper for all Platinum API communication
- **Methods**:
  | Method | Signature | Purpose |
  |---|---|---|
  | `get<T>` | `(url, params?) → Observable<T>` | GET with query params, `withCredentials: true` |
  | `post<T>` | `(url, body?) → Observable<T>` | POST with JSON body, `withCredentials: true` |
  | `put<T>` | `(url, body?) → Observable<T>` | PUT with JSON body, `withCredentials: true` |
  | `delete<T>` | `(url, params?) → Observable<T>` | DELETE with query params, `withCredentials: true` |
- **Key Patterns**: All methods set `withCredentials: true` for Express session cookies. Null/undefined query params filtered out. No base URL prefix — all components pass full relative paths (e.g., `/api/platinum/...`).
- **Used By**: Every feature component (via inject or constructor DI)

### 1.2 AuthService
- **Path**: `angular-client/src/app/core/services/auth.service.ts`
- **Lines**: 96
- **Scope**: Authentication state management with Angular signals
- **State**:
  | Signal | Type | Purpose |
  |---|---|---|
  | `_user` | `signal<AuthUser \| null>` | Current authenticated user |
  | `_site` | `signal<SiteInfo \| null>` | Current site (George / Site02) |
  | `_authenticated` | `signal(boolean)` | Auth status |
  | `_checked` | `signal(boolean)` | Whether initial auth check completed |
  | `isSite02` | `computed(() => boolean)` | Convenience check for Site02 |
- **Methods**:
  | Method | Purpose |
  |---|---|
  | `checkAuth()` | `GET /api/auth/status` — restores session on page refresh |
  | `login(username, password, siteId?)` | `POST /api/auth/login` — authenticates + sets state |
  | `logout()` | `POST /api/auth/logout` — clears state + navigates to `/login` |
  | `applyTheme(themeClass)` | Adds/removes `theme-site02` CSS class on `<html>` |
- **Interfaces Exported**:
  - `AuthUser`: `{ user_ID, userName, firstName, lastName, eMail, enabled, superUser, cashFloat, finYear }`
  - `SiteInfo`: `{ id, name, logo, themeClass }`

### 1.3 ToastService
- **Path**: `angular-client/src/app/core/services/toast.service.ts`
- **Lines**: 39
- **Scope**: Global notification system with signal-based toast queue
- **Types**: `'success' | 'error' | 'info'` (no `'warning'` type)
- **Methods**:
  | Method | Duration | Purpose |
  |---|---|---|
  | `show(message, type, duration)` | Custom (default 4s) | Generic toast |
  | `success(message)` | 4s | Success notification |
  | `error(message)` | 6s | Error notification (longer display) |
  | `info(message)` | 4s | Info notification |
  | `dismiss(id)` | — | Manual dismiss |
- **Key Pattern**: Auto-dismiss via `setTimeout`. Signal-based `_toasts` array drives `ToastComponent` rendering.

### 1.4 AuthGuard
- **Path**: `angular-client/src/app/core/guards/auth.guard.ts`
- **Lines**: 18
- **Scope**: Route guard for authenticated-only pages
- **Logic**: If `!checked()` → calls `checkAuth()` first. If `authenticated()` → allows. Otherwise → redirects to `/login`.
- **Applied To**: All routes under the main layout (via `canActivate: [authGuard]` in `app.routes.ts`)

### 1.5 ErrorInterceptor
- **Path**: `angular-client/src/app/core/interceptors/error.interceptor.ts`
- **Lines**: 32
- **Scope**: Global HTTP error handler
- **Behavior**:
  | Status | Action |
  |---|---|
  | 401 (non-auth URLs) | Redirect to `/login` |
  | 0 (network error) | Toast: "Network error — unable to reach the server" |
  | 500+ (non-silent URLs) | Toast with server error message |
- **Silent URL Patterns** (no toast for 500+ errors):
  - `/api/platinum/billing-enquiry/`
  - `/api/platinum/billing/account-management/`
  - `/api/platinum/supervisor/`
- **Key Pattern**: Errors are still re-thrown via `throwError()` so components can handle them individually.

---

## 2. APPLICATION SERVICES

### 2.1 PosBasketService
- **Path**: `angular-client/src/app/services/pos-basket.service.ts`
- **Lines**: 138
- **Scope**: Signal-based shopping basket for POS multi-type payments
- **State Signals**:
  | Signal | Type | Purpose |
  |---|---|---|
  | `items` | `signal<BasketItem[]>` | Raw basket contents |
  | `orderedItems` | `computed` | Items sorted by PROCESSING_ORDER |
  | `totalDue` | `computed` | Sum of `amountDue` |
  | `totalToPay` | `computed` | Sum of `amountToPay` |
  | `itemCount` | `computed` | Item count |
  | `hasItems` | `computed` | Boolean shortcut |
  | `itemsByType` | `computed` | Grouped by `BasketItemType` |
- **Core Methods**:
  | Method | Purpose |
  |---|---|
  | `addItem(item)` | Add (deduplicated by `id`) |
  | `removeItem(id)` | Remove by ID |
  | `updateAmount(id, amount)` | Update `amountToPay` (min 0) |
  | `payFullAmount(id)` | Set `amountToPay = amountDue` |
  | `payAllFull()` | Set all items to full amount |
  | `clearAll()` | Empty basket |
  | `roundToNearest10c(amount)` | SA cash rounding |
  | `applyCashRounding(cashAmount)` | Returns `{ roundedCash, adjustment }` |
  | `adjustFirstItemForRounding(roundedTotal)` | Applies rounding adjustment to first item (by processing order) |
  | `allocateSplitTender(cashAmount, cardAmount)` | Splits items between cash and card payments |

### 2.2 FormatService (standalone functions)
- **Path**: `angular-client/src/app/services/format.service.ts`
- **Lines**: 109
- **Scope**: Date, currency, and utility formatters
- **Functions**:
  | Function | Output Format | Notes |
  |---|---|---|
  | `formatDate(d)` | `dd/mm/yyyy` | Standard date display |
  | `formatDateShort(d)` | `dd/mm/yyyy HH:mm` | Date with time |
  | `formatTimestamp(ts)` | `dd/mm/yyyy HH:mm:ss` | Full timestamp |
  | `formatDateOnly(d)` | `dd/mm/yyyy` | Alias of formatDate |
  | `formatCurrency(value)` | `R 1,234.56` | South African Rand, `en-ZA` locale |
  | `formatCurrencyCompact(value)` | `R 1.2M` / `R 1.5K` | Compact display |
  | `formatFileSize(bytes)` | `1.5 MB` | File size |
  | `formatDuration(start, end)` | `5m 30s` | Duration between timestamps |
  | `formatPercentage(value, decimals)` | `45.5%` | Percentage display |
  | `getFinancialYear()` | `2025/2026` | Current SA financial year (Jul-Jun) |
  | `getFinancialYearList(count)` | `['2025/2026', ...]` | Last N financial years |
- **Project Standard**: ALL dates use `dd/mm/yyyy` via `padStart(2,'0')` — never `Intl.DateTimeFormat` or `toLocaleDateString`.

### 2.3 ExportService
- **Path**: `angular-client/src/app/services/export.service.ts`
- **Lines**: 142
- **Scope**: CSV and PDF/Print export for enquiry tabs and reports
- **Methods**:
  | Method | Purpose |
  |---|---|
  | `exportCsv(options, headers, rows)` | Generates CSV with BOM, header block, and download |
  | `exportPdf(options, headers, rows, columnAligns?)` | Generates HTML table and opens print dialog |
- **Filename Convention**: `GEORGE_MUNICIPALITY_[TAB]_[ACCOUNT]_[DATE].csv/pdf`
- **CSV Features**: UTF-8 BOM (`\uFEFF`), double-quote escaping, metadata header block (account, status, address, financial year, export date)
- **PDF Features**: A4 landscape, Platinum theme colors (`#0f2b46` headers, `#c9a84c` subtitles), zebra striping, column alignment support, auto-print on open

### 2.4 ValidationService (standalone functions)
- **Path**: `angular-client/src/app/services/validation.service.ts`
- **Lines**: 99
- **Scope**: Reusable validation and utility functions
- **Functions**:
  | Function | Purpose |
  |---|---|
  | `validateRequired(fields)` | Check all fields are non-null/non-empty |
  | `validateNumericRange(value, min, max, name)` | Range validation |
  | `validatePercentageSum(values, tolerance)` | Sum-to-100% check |
  | `validateEmail(email)` | Email regex validation |
  | `validateAccountNo(accountNo)` | Non-empty account check |
  | `isCourtReady(row)` | Checks all required audit fields present |
  | `getRiskCategory(score)` | Score → `LOW/MEDIUM/HIGH` |
  | `getConfidenceLabel(score)` | Score → confidence label |
  | `sortByField(items, field, dir)` | Generic array sort |
  | `getStatusColor(status)` | Status string → Tailwind CSS classes |
- **Return Type**: All validators return `{ valid: boolean, errors: string[] }`

### 2.5 DebtConfig (constants)
- **Path**: `angular-client/src/app/services/debt-config.ts`
- **Lines**: 221
- **Scope**: All debt/legal module configuration constants and UI label maps
- **Exports**:
  | Constant | Purpose | Items |
  |---|---|---|
  | `RULE_FIELDS` | Qualification/rule field options | 12 fields |
  | `RULE_OPERATORS` | Comparison operators | 10 operators |
  | `WORKFLOW_ACTION_TYPES` | Workflow stage actions | 12 types |
  | `CHANNEL_OPTIONS` | Communication channels | 4 channels |
  | `TEMPLATE_CATEGORIES` | Document template categories | 8 categories |
  | `DOC_TYPES` | Document types for signatures | 5 types |
  | `LEGAL_CATEGORIES` | Legal framework categories | 5 categories |
  | `LEGAL_CATEGORY_LABELS` | Label map for legal categories | 5 entries |
  | `AUDIT_ACTION_TYPES` | Audit trail filter options | 7 types |
  | `EVIDENCE_BUNDLE_SECTIONS` | Evidence bundle section keys | 6 sections |
  | `QUALIFICATION_FIELD_OPTIONS` | Qualification rule fields | 15 fields |
  | `QUALIFICATION_OPERATOR_OPTIONS` | Qualification operators | 7 operators |
  | `TERMINATION_REASONS` | Handover termination reasons | 4 reasons |
  | `RISK_COLORS` | Risk category color maps | 4 levels |
  | `IMPACT_COLORS` | Impact level color maps | 6 levels |
  | `SIGNATURE_STATUS_LABELS` | Signature status display | 7 statuses |
  | `BATCH_STATUS_LABELS` | Batch job status display | 6 statuses |
  | `BATCH_JOB_TYPE_LABELS` | Batch job type display | 5 types |
  | `PROCESS_STATUS_LABELS` | Process status display | 10 statuses |
  | `CHANNEL_CONFIG` | Channel display config | 4 channels |
  | `COMM_STATUS_CONFIG` | Communication status config | 6 statuses |
  | `PAGE_SIZE` | Default page size (50) | — |
  | `SECTION129_DEFAULTS` | Section 129 default config | 6 fields |

---

## 3. TYPED MODELS

### 3.1 pos-basket.models.ts
- **Lines**: 111
- **Purpose**: POS basket type system
- **Types Exported**:
  | Type | Purpose |
  |---|---|
  | `BasketItemType` | `'account' \| 'clearance' \| 'prepaid' \| 'misc'` |
  | `ReceiptDeliveryMethod` | `'print' \| 'email' \| 'whatsapp' \| 'sms'` |
  | `TenderType` | `'cash' \| 'card' \| 'cheque' \| 'eft'` |
  | `SearchMode` | `'tabs' \| 'unified'` |
  | `PROCESSING_ORDER` | Type → sort priority (account=1, clearance=2, prepaid=3, misc=4) |
  | `TYPE_LABELS` | Type → display label |
  | `AccountItemData` | Account-specific basket fields (accountId, billId, cutOffAmount, etc.) |
  | `ClearanceItemData` | Clearance-specific fields (clearanceId, status, accounts array) |
  | `PrepaidItemData` | Prepaid fields (meterNumber, breakdown, tokenResult) |
  | `MiscItemData` | Misc fields (groupId, scoaItemId, VAT info) |
  | `BasketItem` | Union basket item (id, type, label, amountDue, amountToPay, data union) |
  | `UnifiedSearchResult` | Search result type (supports `'group'` result type) |
  | `SplitTenderAllocation` | Split tender output (cashItems, cardItems, totals) |
  | `ReceiptResult` | Receipt response (receiptNumber, tenderType, amount, items) |

### 3.2 debt.models.ts
- **Lines**: 409
- **Purpose**: Debt management typed contracts
- **Key Interfaces**: `DocumentTemplate`, `TemplateVersion`, `SignatureRequest`, `SignatureAuditEntry`, `ProcessWorkflow`, `StageRule`, `StageTemplate`, `StageAction`, `StageTimer`, `WorkflowStage`, plus 20+ additional interfaces for Section 129, handover, risk scoring, qualification, batch processing, monitoring, and communication components.

### 3.3 legal.models.ts
- **Lines**: 58
- **Purpose**: Legal compliance typed contracts
- **Interfaces**: `LegalRuleVersion`, `RuleFormData`, `ComplianceLogEntry`, `EvidenceBundle`, `BundleSection`

### 3.4 analytics.models.ts
- **Lines**: 79
- **Purpose**: Analytics typed contracts
- **Interfaces**: `DebtOverview`, `AgingAnalysis`, `RecoveryStats`, `LegalPipelineStage`, `AttorneyPerformance`, `RiskDistributionItem`, `GeoItem`, `ForecastScenario`, `ForecastData`
- **Type Aliases**: `ViewTab`, `SortField`, `SortDir`

---

## 4. SHARED UI COMPONENTS

### 4.1 Component Inventory

| Component | Lines | Inputs | Purpose |
|---|---|---|---|
| `SpinnerComponent` | 11 | — | Loading spinner |
| `BadgeComponent` | 11 | `text`, `color` | Status badge |
| `CardComponent` | 13 | `title` | Card container |
| `TabsComponent` | 22 | `tabs: TabItem[]`, `activeTab` | Tab navigation |
| `DataTableComponent` | 43 | `columns: TableColumn[]`, `rows`, `sortField`, `sortDir` | Sortable data table |
| `DialogComponent` | 20 | `open`, `title` | Modal dialog |
| `ConfirmDialogComponent` | 20 | `open`, `title`, `message` | Confirmation modal |
| `PaginationComponent` | 39 | `currentPage`, `totalPages`, `pageSize` | Page navigation |
| `EmptyStateComponent` | 13 | `message`, `icon` | Empty data display |
| `LoadingStateComponent` | 16 | `message` | Loading skeleton |
| `StatCardComponent` | 15 | `label`, `value`, `icon`, `color` | Dashboard stat card |
| `PageHeaderComponent` | 12 | `title`, `subtitle` | Page title bar |
| `ToastComponent` | 12 | — (reads `ToastService.toasts`) | Toast notification display |
| **Total** | **247** | | |

### 4.2 Barrel Export
All shared components re-exported via `angular-client/src/app/shared/components/index.ts` for clean imports:
```typescript
import { SpinnerComponent, DataTableComponent, ... } from '../../shared/components';
```

### 4.3 PosLayoutComponent (Shell)
- **Path**: `angular-client/src/app/shared/layout/pos-layout.component.ts`
- **Lines**: 225
- **Purpose**: Application shell — sidebar (250px collapsible to 64px) + toolbar (56px)
- **Features**:
  - Signal-based sidebar state (`sidebarCollapsed`, `mobileSidebarOpen`)
  - Grouped navigation with expandable sections
  - Breadcrumb generation from current URL
  - Site-aware display (George vs Site02)
  - User info display in toolbar
- **Navigation Groups**:
  | Group | Items |
  |---|---|
  | (top-level) | Dashboard, POS Receipting |
  | Billing & Payments | Billing Dashboard, Direct Deposits, Auto Allocation, Third Party, Bulk Allocation |
  | Enquiries & Receipts | General Enquiries, View Receipts |
  | (top-level) | Communications, Supervisor |
  | Debt Management | Section 129, Authorization, Configuration, Handover, Termination, Batch Processing, Process Monitoring, Document Templates, Digital Signatures, Process Engine |
  | Reports | Section 129 Report, Handover Report, SMS Log Report, Risk Scoring, Qualification Rules, Communication Timeline, Comms Dashboard |
  | Legal Compliance | Legal Rules, Audit Trail, Evidence Bundle |
  | Analytics | Executive Dashboard, Predictive Forecasting, Geographic Mapping |
- **Separate Files**: `.component.html`, `.component.css` (follows project standard)

---

## 5. APPLICATION BOOTSTRAP & ROUTING

### 5.1 Root Component (`app.ts`)
- **Lines**: 18
- **Imports**: `RouterOutlet`, `ToastComponent`
- **On Init**: Calls `auth.checkAuth()` to restore session from cookie

### 5.2 App Config (`app.config.ts`)
- **Lines**: 31
- **Providers**:
  | Provider | Purpose |
  |---|---|
  | `provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules))` | Lazy-loaded routing with preload |
  | `provideHttpClient(withInterceptors([errorInterceptor]))` | HTTP with global error interceptor |
  | `{ provide: ErrorHandler, useClass: GlobalErrorHandler }` | Chunk reload on stale module error |
  | `provideBrowserGlobalErrorListeners()` | Browser error hooks |
- **GlobalErrorHandler**: Detects `ChunkLoadError` / stale dynamic imports and auto-reloads page (once)

### 5.3 Routing (`app.routes.ts`)
- **Total Route Entries**: 45 path definitions (including redirects)
- **Structure**:
  | Pattern | Count | Examples |
  |---|---|---|
  | Standalone lazy routes | 39 | All feature components via `loadComponent` |
  | Redirects | 4 | `cashier-setup→pos`, `cashier-day-end→pos`, `enquiries→enquiries/general`, `third-party→third-party/processing` |
  | Auth-guarded | All main routes | `canActivate: [authGuard]` on layout wrapper |
  | Wildcard | 1 | `**` → `NotFoundComponent` |
- **Layout**: All authenticated routes wrapped in `PosLayoutComponent` via route children

---

## 6. DEPENDENCY GRAPH

```
App Bootstrap
├── app.config.ts
│   ├── provideRouter(routes) → app.routes.ts (56 routes)
│   ├── provideHttpClient([errorInterceptor])
│   └── GlobalErrorHandler (chunk reload)
├── app.ts → AuthService.checkAuth()
└── PosLayoutComponent (shell)
    ├── AuthService (user/site display)
    └── RouterOutlet → Feature Components
        ├── ApiService (all HTTP calls)
        ├── AuthService (user context)
        ├── ToastService (notifications)
        ├── PosBasketService (POS only)
        ├── ExportService (enquiries/reports)
        ├── FormatService (dates/currency)
        ├── ValidationService (form validation)
        ├── DebtConfig (constants)
        └── Shared Components (13 reusable)
```

### Service Injection Pattern
All services use `inject()` or constructor DI. No service creates another service — flat dependency graph. All services are `providedIn: 'root'` singletons.

---

## 7. DESIGN SYSTEM STANDARDS

### 7.1 Theme CSS Variables
| Variable | Value | Usage |
|---|---|---|
| `--platinum-primary` | `#0f2b46` | Navy — headers, sidebar, primary buttons |
| `--platinum-accent` | `#c9a84c` | Gold — accents, active states, highlights |
| Background | White surfaces | Cards, panels, page backgrounds |
| Font | Inter | All text |

### 7.2 Tailwind Usage
- All components use Tailwind CSS utility classes
- Status badges use semantic colors (emerald=success, amber=warning, red=error, blue=info)
- Card shadows: `shadow-sm` standard, `shadow-md` elevated
- Responsive: Mobile-first with `md:` and `lg:` breakpoints

### 7.3 Date Format Standard
**ALL dates everywhere**: `dd/mm/yyyy` using `padStart(2,'0')` pattern. Never `month: 'short'`, `dateStyle: 'medium'`, or `Intl.DateTimeFormat`. API payloads remain ISO format.

---

## 8. CROSS-CUTTING OBSERVATIONS

### 8.1 No Service-Level Error Handling
`ApiService` does not catch errors — all error handling is delegated to:
1. `ErrorInterceptor` (global toast + 401 redirect)
2. Individual component `subscribe()` / `firstValueFrom()` error handlers

### 8.2 Session Cookie Strategy
- Cookie name: `pos.sid`
- Max age: 12 hours
- `httpOnly: true`, `secure` in production, `sameSite: 'lax'`
- `withCredentials: true` on all Angular HTTP calls ensures cookie inclusion

### 8.3 Silent Error Suppression
`ErrorInterceptor` silences 500+ errors for BillingEnquiry, account-management, and supervisor URLs. This prevents toast floods during multi-tab enquiry loading but means some API failures are invisible to users.

### 8.4 Preload Strategy
`PreloadAllModules` preloads all lazy route chunks after initial load. Combined with `GlobalErrorHandler` chunk reload, this provides resilience against deployment-time chunk invalidation.

### 8.5 No State Management Library
No NgRx, Akita, or external state management. All state is managed via Angular signals in individual services (`AuthService`, `PosBasketService`, `ToastService`). This is appropriate for the current application complexity.

### 8.6 Export Filename Convention
All exports use: `GEORGE_MUNICIPALITY_[TAB]_[ACCOUNT]_[DATE].[ext]`
- Tab name: cleaned (alphanumeric + underscores)
- Date: `YYYYMMDD` format
- Extensions: `.csv` or browser print

---

**END OF DOCUMENT**

# PHASE 19 — App Shell, Routing Architecture, Core Services & Layout Infrastructure

**Document**: `PHASE_19_APP_SHELL_ROUTING_CORE_SERVICES_LAYOUT.md`
**Created**: 2026-03-11
**Scope**: Root app component, routing configuration, core services, auth guard, HTTP interceptor, layout shell, shared UI components, shared business services, and model files

---

## 1. FILE INVENTORY

| # | File | Path | Lines | Category |
|---|------|------|-------|----------|
| 1 | App (root) | `app.ts` | 18 | App Shell |
| 2 | App Config | `app.config.ts` | 31 | App Shell |
| 3 | App Routes | `app.routes.ts` | 59 | Routing |
| 4 | ApiService | `core/services/api.service.ts` | 40 | Core Service |
| 5 | AuthService | `core/services/auth.service.ts` | 96 | Core Service |
| 6 | ToastService | `core/services/toast.service.ts` | 39 | Core Service |
| 7 | Auth Guard | `core/guards/auth.guard.ts` | 18 | Guard |
| 8 | Error Interceptor | `core/interceptors/error.interceptor.ts` | 32 | Interceptor |
| 9 | PosLayoutComponent | `shared/layout/pos-layout.component.ts` | 225 | Layout Shell |
| 10 | ToastComponent | `shared/components/toast.component.ts` | 12 | Shared UI |
| 11 | SpinnerComponent | `shared/components/spinner.component.ts` | 11 | Shared UI |
| 12 | BadgeComponent | `shared/components/badge.component.ts` | 11 | Shared UI |
| 13 | CardComponent | `shared/components/card.component.ts` | 13 | Shared UI |
| 14 | TabsComponent | `shared/components/tabs.component.ts` | 22 | Shared UI |
| 15 | DataTableComponent | `shared/components/data-table.component.ts` | 43 | Shared UI |
| 16 | DialogComponent | `shared/components/dialog.component.ts` | 20 | Shared UI |
| 17 | PaginationComponent | `shared/components/pagination.component.ts` | 39 | Shared UI |
| 18 | EmptyStateComponent | `shared/components/empty-state.component.ts` | 13 | Shared UI |
| 19 | StatCardComponent | `shared/components/stat-card.component.ts` | 15 | Shared UI |
| 20 | LoadingStateComponent | `shared/components/loading-state.component.ts` | 16 | Shared UI |
| 21 | ConfirmDialogComponent | `shared/components/confirm-dialog.component.ts` | 20 | Shared UI |
| 22 | PageHeaderComponent | `shared/components/page-header.component.ts` | 12 | Shared UI |
| 23 | Shared Components Index | `shared/components/index.ts` | 13 | Barrel Export |
| 24 | ExportService | `services/export.service.ts` | 142 | Shared Service |
| 25 | FormatService | `services/format.service.ts` | 109 | Shared Service |
| 26 | ValidationService | `services/validation.service.ts` | 99 | Shared Service |
| 27 | PosBasketService | `services/pos-basket.service.ts` | 138 | Shared Service |
| 28 | DebtConfig | `services/debt-config.ts` | 221 | Config Constants |
| 29 | POS Basket Models | `models/pos-basket.models.ts` | 111 | Model File |
| 30 | Debt Models | `models/debt.models.ts` | 409 | Model File |
| 31 | Legal Models | `models/legal.models.ts` | 58 | Model File |
| 32 | Analytics Models | `models/analytics.models.ts` | 79 | Model File |
| 33 | Proxy Config | `proxy.conf.json` | 7 | Dev Config |

**Total**: 33 files, ~2,191 source lines

---

## 2. APP SHELL

### 2.1 Root Component (`app.ts`)

```
App (root)
├── RouterOutlet — renders current route
└── ToastComponent — global toast notification overlay
```

**Lifecycle**: `ngOnInit()` calls `AuthService.checkAuth()` to validate existing session on app load.

**Imports**: `RouterOutlet`, `ToastComponent` (standalone, no NgModules).

### 2.2 App Configuration (`app.config.ts`)

| Provider | Configuration |
|----------|---------------|
| `provideRouter` | Routes + `withComponentInputBinding()` + `withPreloading(PreloadAllModules)` |
| `provideHttpClient` | `withInterceptors([errorInterceptor])` |
| `ErrorHandler` | Custom `GlobalErrorHandler` class |

**GlobalErrorHandler**: Detects stale chunk errors (`Failed to fetch dynamically imported module`, `ChunkLoadError`, `Loading chunk`) and triggers `window.location.reload()` once. Prevents infinite reload loops via `chunkReloadAttempted` flag.

**Preloading Strategy**: `PreloadAllModules` — all lazy-loaded routes are preloaded in the background after initial render.

---

## 3. ROUTING ARCHITECTURE

### 3.1 Route Structure

```
Routes
├── /login                              → LoginComponent (no auth guard)
└── /* (all other paths)                → PosLayoutComponent (auth guard)
    ├── /                               → HomeComponent
    ├── /pos                            → PosWorkflowComponent
    ├── /cashier-setup                  → redirectTo: /pos
    ├── /cashier-day-end                → redirectTo: /pos
    ├── /direct-deposits/manual         → UnmatchedQueueComponent
    ├── /direct-deposits/manual/allocate/:id → AllocateTransactionComponent
    ├── /direct-deposits/manual/history → AllocationHistoryComponent
    ├── /direct-deposits/auto           → AutoAllocationComponent
    ├── /bulk-allocation                → BulkAllocationProgressComponent
    ├── /third-party/processing         → PaymentProcessingComponent
    ├── /third-party                    → redirectTo: /third-party/processing
    ├── /view-receipts                  → ViewReceiptsComponent
    ├── /billing-dashboard              → BillingDashboardComponent
    ├── /enquiries/general              → EnquiriesGeneralComponent
    ├── /enquiries                      → redirectTo: /enquiries/general
    ├── /communications                 → ClientCommunicationsComponent
    ├── /supervisor                     → SupervisorDashboardComponent
    ├── /settings                       → SettingsComponent
    ├── /debt/section129                → Section129NoticesComponent
    ├── /debt/section129/review/:runId  → Section129TrialReviewComponent
    ├── /debt/section129/authorize      → Section129AuthorizationComponent
    ├── /debt/section129/config         → Section129ConfigComponent
    ├── /debt/section129-report         → Section129ReportComponent
    ├── /debt/handover                  → HandoverManagementComponent
    ├── /debt/handover/terminate        → HandoverTerminationComponent
    ├── /debt/handover-report           → HandoverReportComponent
    ├── /debt/sms-log-report            → SmsLogReportComponent
    ├── /debt/risk-scoring              → RiskScoringComponent
    ├── /debt/qualification-rules       → QualificationRulesComponent
    ├── /debt/communication-timelines   → CommunicationTimelineComponent
    ├── /debt/communication-dashboard   → CommunicationDashboardComponent
    ├── /debt/batch-processing          → BatchProcessingComponent
    ├── /debt/process-monitoring        → ProcessMonitoringComponent
    ├── /debt/document-templates        → DocumentTemplatesComponent
    ├── /debt/digital-signatures        → DigitalSignaturesComponent
    ├── /debt/process-engine            → ProcessEngineComponent
    ├── /legal/rules                    → LegalRulesComponent
    ├── /legal/audit-trail              → AuditTrailComponent
    ├── /legal/evidence-bundle          → EvidenceBundleComponent
    ├── /analytics/executive-dashboard  → ExecutiveDashboardComponent
    ├── /analytics/predictive-forecasting → PredictiveForecastingComponent
    ├── /analytics/geographic-mapping   → GeographicMappingComponent
    └── /**                             → NotFoundComponent (wildcard)
```

**Total routes**: 45 path entries (1 top-level login + 1 layout shell + 43 children). Of the 43 children: 4 redirects, 38 component routes, 1 wildcard (`**`). Total navigable component routes: 40 (including login and wildcard).

### 3.2 Routing Patterns

| Pattern | Details |
|---------|---------|
| Lazy loading | All routes use `loadComponent: () => import(...)` dynamic imports |
| Auth guard | `authGuard` applied at layout level — all child routes protected |
| Layout wrapper | `PosLayoutComponent` wraps all authenticated routes via `children` |
| Redirects (4) | `/cashier-setup` → `/pos`, `/cashier-day-end` → `/pos`, `/third-party` → `/third-party/processing`, `/enquiries` → `/enquiries/general` |
| Parameterized | `/direct-deposits/manual/allocate/:id`, `/debt/section129/review/:runId` |
| Wildcard | `**` → `NotFoundComponent` (last route) |

### 3.3 Auth Guard (`auth.guard.ts`)

```
authGuard: CanActivateFn
1. If !auth.checked() → await auth.checkAuth()
2. If auth.authenticated() → return true
3. Else → return router.createUrlTree(['/login'])
```

- Functional guard (not class-based)
- Uses `inject()` for DI
- Waits for auth check to complete before deciding

---

## 4. CORE SERVICES

### 4.1 ApiService (`core/services/api.service.ts`)

**Purpose**: Thin HTTP wrapper over Angular `HttpClient`. All API calls from all components go through this service.

**Injectable**: `providedIn: 'root'` (singleton)

| Method | Signature | Notes |
|--------|-----------|-------|
| `get<T>` | `(url: string, params?: Record<string, string>) → Observable<T>` | Converts params to `HttpParams`, skips null/undefined |
| `post<T>` | `(url: string, body?: any) → Observable<T>` | Sends `body || {}` |
| `put<T>` | `(url: string, body?: any) → Observable<T>` | Sends `body || {}` |
| `delete<T>` | `(url: string, params?: Record<string, string>) → Observable<T>` | Same params handling as GET |

**All methods**: Set `withCredentials: true` (sends session cookie).

### 4.2 AuthService (`core/services/auth.service.ts`)

**Purpose**: Manages authentication state, login/logout flows, multi-site support, and theme switching.

**Injectable**: `providedIn: 'root'` (singleton)

#### 4.2.1 State Signals

| Signal | Type | Access | Purpose |
|--------|------|--------|---------|
| `_user` | `WritableSignal<AuthUser \| null>` | Private | Current user data |
| `_site` | `WritableSignal<SiteInfo \| null>` | Private | Current site config |
| `_authenticated` | `WritableSignal<boolean>` | Private | Auth state |
| `_checked` | `WritableSignal<boolean>` | Private | Whether initial check completed |
| `user` | `Signal<AuthUser \| null>` | Public readonly | Exposed user |
| `site` | `Signal<SiteInfo \| null>` | Public readonly | Exposed site |
| `authenticated` | `Signal<boolean>` | Public readonly | Exposed auth state |
| `checked` | `Signal<boolean>` | Public readonly | Exposed check state |
| `isSite02` | `Signal<boolean>` | Public computed | `site()?.id === 'site02'` |

#### 4.2.2 Interfaces

**AuthUser**:
```typescript
{ user_ID: number, userName: string, firstName: string, lastName: string,
  eMail: string, enabled: boolean, superUser: boolean, cashFloat: number, finYear: string }
```

**SiteInfo**:
```typescript
{ id: string, name: string, logo: string, themeClass: string }
```

#### 4.2.3 Methods

| Method | API Call | Purpose |
|--------|----------|---------|
| `checkAuth()` | `GET /api/auth/status` | Validates existing session, sets user/site/auth state |
| `login(username, password, siteId?)` | `POST /api/auth/login` | Authenticates, returns `{ success, error? }` |
| `logout()` | `POST /api/auth/logout` | Clears state, navigates to `/login` |
| `applyTheme(themeClass)` | — | Adds/removes `theme-site02` CSS class on `<html>` |

#### 4.2.4 API Endpoints

| # | Method | Endpoint | Request | Response |
|---|--------|----------|---------|----------|
| 1 | GET | `/api/auth/status` | — | `{ authenticated: boolean, user?: AuthUser, site?: SiteInfo }` |
| 2 | POST | `/api/auth/login` | `{ username, password, siteId? }` | `{ success: boolean, user?, site?, error? }` |
| 3 | POST | `/api/auth/logout` | — | — |

### 4.3 ToastService (`core/services/toast.service.ts`)

**Purpose**: Global notification system using signals.

**Injectable**: `providedIn: 'root'` (singleton)

#### 4.3.1 Interface

```typescript
interface Toast { id: number, message: string, type: 'success' | 'error' | 'info', duration: number }
```

#### 4.3.2 Methods

| Method | Args | Default Duration | Notes |
|--------|------|-----------------|-------|
| `show(message, type, duration)` | `string, 'success'\|'error'\|'info', number` | 4000ms | Base method |
| `success(message)` | `string` | 4000ms | Shorthand |
| `error(message)` | `string` | 6000ms | Longer display for errors |
| `info(message)` | `string` | 4000ms | Shorthand |
| `dismiss(id)` | `number` | — | Removes toast by ID |

**Auto-dismiss**: Each toast auto-dismissed after `duration` via `setTimeout`.

---

## 5. HTTP INTERCEPTOR

### 5.1 Error Interceptor (`core/interceptors/error.interceptor.ts`)

**Type**: Functional interceptor (`HttpInterceptorFn`)

| Status | Behavior |
|--------|----------|
| 401 (not auth endpoint) | Navigate to `/login` |
| 0 (network error) | `toast.error('Network error — unable to reach the server')` |
| 500+ (not silent URL) | `toast.error(error.error?.message \|\| 'Server error')` |

**Silent URL patterns** (no 500 toast):
- `/api/platinum/billing-enquiry/`
- `/api/platinum/billing/account-management/`
- `/api/platinum/supervisor/`

---

## 6. LAYOUT SHELL

### 6.1 PosLayoutComponent (`shared/layout/pos-layout.component.ts`)

**Purpose**: Main application shell with sidebar navigation, toolbar, breadcrumbs, and content area.

**Structure**:
```
PosLayoutComponent
├── Sidebar (250px, collapsible to 64px)
│   ├── Municipality header (name, financial period)
│   ├── Navigation items (flat + grouped)
│   └── User panel (initials, name, sign-out)
├── Toolbar (56px)
│   ├── Mobile hamburger menu
│   ├── Breadcrumbs
│   └── User info
└── Content area (<router-outlet>)
```

#### 6.1.1 Navigation Structure

| # | Type | Label | Children |
|---|------|-------|----------|
| 1 | Flat | Dashboard | `/` |
| 2 | Flat | POS Receipting | `/pos` |
| 3 | Group | Billing & Payments | Billing Dashboard, Direct Deposits, Auto Allocation, Third Party Payments, Bulk Allocation |
| 4 | Group | Enquiries & Receipts | General Enquiries, View Receipts |
| 5 | Flat | Communications | `/communications` |
| 6 | Flat | Supervisor | `/supervisor` |
| 7 | Group | Debt Management | Section 129 Notices, Authorization, Configuration, Handover Management, Handover Termination, Batch Processing, Process Monitoring, Document Templates, Digital Signatures, Process Engine |
| 8 | Group | Reports | Section 129 Report, Handover Report, SMS Log Report, Risk Scoring, Qualification Rules, Communication Timeline, Comms Dashboard |
| 9 | Group | Legal Compliance | Legal Rules, Audit Trail, Evidence Bundle |
| 10 | Group | Analytics | Executive Dashboard, Predictive Forecasting, Geographic Mapping |

**Total nav items**: 10 top-level (4 flat + 6 groups), 30 children across groups = 34 navigable items

#### 6.1.2 State Signals

| Signal | Type | Purpose |
|--------|------|---------|
| `sidebarCollapsed` | `boolean` | Desktop sidebar collapse state |
| `mobileSidebarOpen` | `boolean` | Mobile sidebar overlay state |
| `expandedGroups` | `Set<string>` | Which nav groups are expanded (default: `['Billing & Payments']`) |
| `currentUrl` | `string` | Current router URL (updated on `NavigationEnd`) |

#### 6.1.3 Computed Properties

| Property | Purpose |
|----------|---------|
| `breadcrumbs` | Auto-generated from current URL by matching against nav items |

#### 6.1.4 Methods

| Method | Purpose |
|--------|---------|
| `toggleSidebar()` | Toggle desktop sidebar collapse |
| `toggleMobileSidebar()` | Toggle mobile sidebar overlay |
| `toggleGroup(label)` | Expand/collapse a nav group |
| `onGroupClick(label)` | If collapsed → expand sidebar + open group; else toggle group |
| `isActive(href)` | Check if route is active (exact or starts-with) |
| `isGroupActive(group)` | Check if any child route is active |
| `signOut()` | Delegates to `AuthService.logout()` |
| `getUserInitial()` | First char of firstName or userName |
| `getUserDisplayName()` | `"firstName lastName"` or userName |
| `getMunicipalityName()` | `'George Municipality'` or `'Inzalo EMS Site02'` |
| `getFinancialPeriod()` | From `user().finYear` or default `'2025/2026'` |

#### 6.1.5 Multi-Site Support

| Site | ID | Theme Class | Municipality Name |
|------|----|-------------|-------------------|
| George | `'george'` | (none) | George Municipality |
| Site02 | `'site02'` | `theme-site02` | Inzalo EMS Site02 |

Theme switching: `AuthService.applyTheme()` adds/removes `theme-site02` class on `<html>` root element.

---

## 7. SHARED UI COMPONENTS

All components are standalone (no NgModules). Exported via barrel `shared/components/index.ts`.

| # | Component | Selector | Key Inputs | Notes |
|---|-----------|----------|------------|-------|
| 1 | SpinnerComponent | `app-spinner` | `size: string` (default `'1.5rem'`) | Inline SVG/CSS spinner |
| 2 | BadgeComponent | `app-badge` | (template-based) | Status badge display |
| 3 | CardComponent | `app-card` | (template-based) | Content card wrapper |
| 4 | TabsComponent | `app-tabs` | `TabItem[]` | Tab bar with selection |
| 5 | DataTableComponent | `app-data-table` | `TableColumn[]`, data | Configurable data grid |
| 6 | DialogComponent | `app-dialog` | (template-based) | Modal dialog wrapper |
| 7 | PaginationComponent | `app-pagination` | page, totalPages | Page navigation controls |
| 8 | EmptyStateComponent | `app-empty-state` | (template-based) | Empty data placeholder |
| 9 | StatCardComponent | `app-stat-card` | title, value, etc. | Dashboard stat display |
| 10 | LoadingStateComponent | `app-loading-state` | (template-based) | Loading placeholder |
| 11 | ConfirmDialogComponent | `app-confirm-dialog` | (template-based) | Confirmation modal |
| 12 | PageHeaderComponent | `app-page-header` | `title: string`, `subtitle: string` | Page title bar |
| 13 | ToastComponent | `app-toast` | — | Renders `ToastService.toasts()` |

**Exported Types**: `TabItem` (from TabsComponent), `TableColumn` (from DataTableComponent)

---

## 8. SHARED BUSINESS SERVICES

### 8.1 FormatService (`services/format.service.ts`)

**Type**: Pure functions (no `@Injectable`, tree-shakeable)

| Function | Signature | Output Format |
|----------|-----------|---------------|
| `formatDate(d)` | `string \| null → string` | `dd/mm/yyyy` |
| `formatDateShort(d)` | `string \| null → string` | `dd/mm/yyyy HH:mm` |
| `formatTimestamp(ts)` | `string \| null → string` | `dd/mm/yyyy HH:mm:ss` |
| `formatCurrency(value)` | `number \| null → string` | `R X,XXX.XX` |
| `formatCurrencyCompact(value)` | `number → string` | `R X.XXXK` or `R X.XXM` |
| `formatFileSize(bytes)` | `number \| null → string` | `X B`, `X.X KB`, `X.X MB` |
| `formatDuration(start, end)` | `string, string → string` | `Xm Xs` or `Xs` |
| `formatPercentage(value, decimals)` | `number, number → string` | `X.X%` |
| `formatDateOnly(d)` | `string \| null → string` | `dd/mm/yyyy` (same as formatDate) |
| `getFinancialYear()` | `→ string` | `YYYY/YYYY` (SA financial year Jul-Jun) |
| `getFinancialYearList(count)` | `number → string[]` | Last N financial years |

### 8.2 ValidationService (`services/validation.service.ts`)

**Type**: Pure functions (no `@Injectable`)

| Function | Purpose |
|----------|---------|
| `validateRequired(fields)` | Checks for null/undefined/empty string |
| `validateNumericRange(value, min, max, fieldName)` | Range validation |
| `validatePercentageSum(values, tolerance)` | Validates sum = 100% |
| `validateEmail(email)` | Regex email validation |
| `validateAccountNo(accountNo)` | Non-empty account number check |
| `isCourtReady(row)` | Checks all required fields for court evidence |
| `getRiskCategory(score)` | `≤30=LOW, ≤60=MEDIUM, >60=HIGH` |
| `getConfidenceLabel(score)` | `≥70=High, ≥40=Moderate, <40=Low` |
| `sortByField(items, field, dir)` | Generic array sorting by field |
| `getStatusColor(status)` | Returns Tailwind CSS classes by status text |

### 8.3 ExportService (`services/export.service.ts`)

**Type**: `@Injectable({ providedIn: 'root' })` (singleton)

**Purpose**: Generates CSV downloads and PDF/print reports with standardized municipality branding.

| Method | Output | Notes |
|--------|--------|-------|
| `exportCsv(options, headers, rows)` | CSV file download | BOM prefix (`\uFEFF`), municipality header, account metadata |
| `exportPdf(options, headers, rows, columnAligns?)` | Opens print window | A4 landscape, Platinum theme colors (`#0f2b46`, `#c9a84c`) |

**Filename Pattern**: `GEORGE_MUNICIPALITY_{TAB}_{ACCOUNT}_{YYYYMMDD}.{ext}`

### 8.4 PosBasketService (`services/pos-basket.service.ts`)

**Type**: `@Injectable({ providedIn: 'root' })` (singleton)

**Purpose**: Signal-based state management for the POS basket (multi-type items, split tender, cash rounding).

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `items` | `WritableSignal<BasketItem[]>` | All basket items |
| `orderedItems` | `computed` | Items sorted by processing order (account→clearance→prepaid→misc) |
| `totalDue` | `computed<number>` | Sum of `amountDue` |
| `totalToPay` | `computed<number>` | Sum of `amountToPay` |
| `itemCount` | `computed<number>` | Item count |
| `hasItems` | `computed<boolean>` | Non-empty check |
| `itemsByType` | `computed<Record<BasketItemType, BasketItem[]>>` | Grouped by type |
| `addItem(item)` | `void` | Add (dedup by ID) |
| `removeItem(id)` | `void` | Remove by UUID |
| `updateAmount(id, amount)` | `void` | Update `amountToPay` |
| `payFullAmount(id)` | `void` | Set `amountToPay = amountDue` |
| `payAllFull()` | `void` | All items full amount |
| `clearAll()` | `void` | Empty basket |
| `roundToNearest10c(amount)` | `number` | SA cash rounding |
| `applyCashRounding(cashAmount)` | `{ roundedCash, adjustment }` | Cash rounding with adjustment |
| `adjustFirstItemForRounding(roundedTotal)` | `void` | Adjusts first item (by processing order) to match rounded total |
| `allocateSplitTender(cash, card)` | `SplitTenderAllocation` | Splits basket items between cash and card tenders |

### 8.5 DebtConfig (`services/debt-config.ts`)

**Type**: `const` exports (no service, pure configuration)

**Purpose**: Centralized configuration constants for debt management, legal compliance, and process engine components.

| Export | Purpose | Item Count |
|--------|---------|------------|
| `RULE_FIELDS` | Debt rule condition fields | 12 |
| `RULE_OPERATORS` | Condition operators | 10 |
| `WORKFLOW_ACTION_TYPES` | Workflow step action types | 12 |
| `CHANNEL_OPTIONS` | Communication channels | 4 |
| `TEMPLATE_CATEGORIES` | Document template categories | 8 |
| `DOC_TYPES` | Signature document types | 5 |
| `LEGAL_CATEGORIES` | Legal act categories | 5 |
| `LEGAL_CATEGORY_LABELS` | Label lookup for legal categories | 5 |
| `AUDIT_ACTION_TYPES` | Audit trail action filters | 7 |
| `EVIDENCE_BUNDLE_SECTIONS` | Evidence bundle section keys | 6 |
| `QUALIFICATION_FIELD_OPTIONS` | Qualification rule fields | 15 |
| `QUALIFICATION_OPERATOR_OPTIONS` | Qualification rule operators | 7 |
| `TERMINATION_REASONS` | Handover termination reasons | 4 |
| `RISK_COLORS` | Risk level CSS config (LOW/MEDIUM/HIGH/UNKNOWN) | 4 |
| `IMPACT_COLORS` | Impact level CSS config | 6 |
| `SIGNATURE_STATUS_LABELS` | Signature status display | 7 |
| `BATCH_STATUS_LABELS` | Batch job status display | 6 |
| `BATCH_JOB_TYPE_LABELS` | Batch job type display | 5 |
| `PROCESS_STATUS_LABELS` | Process status display | 10 |
| `CHANNEL_CONFIG` | Channel display config | 4 |
| `COMM_STATUS_CONFIG` | Communication status display | 6 |
| `PAGE_SIZE` | Default page size | 50 |
| `SECTION129_DEFAULTS` | Section 129 default values | 5 |

---

## 9. MODEL FILES

### 9.1 POS Basket Models (`models/pos-basket.models.ts`, 111 lines)

| Type | Kind | Purpose |
|------|------|---------|
| `BasketItemType` | Type alias | `'account' \| 'clearance' \| 'prepaid' \| 'misc'` |
| `ReceiptDeliveryMethod` | Type alias | `'print' \| 'email' \| 'whatsapp' \| 'sms'` |
| `TenderType` | Type alias | `'cash' \| 'card' \| 'cheque' \| 'eft'` |
| `SearchMode` | Type alias | `'tabs' \| 'unified'` |
| `PROCESSING_ORDER` | Const record | `account:1, clearance:2, prepaid:3, misc:4` |
| `TYPE_LABELS` | Const record | Display labels for basket item types |
| `AccountItemData` | Interface | Account payment data (accountId, billId, cutOffID, etc.) |
| `ClearanceItemData` | Interface | Clearance certificate data |
| `ClearanceAccountItem` | Interface | Individual clearance account entry |
| `PrepaidItemData` | Interface | Prepaid meter/token data |
| `MiscItemData` | Interface | Miscellaneous payment data (SCOA, VAT) |
| `BasketItem` | Interface | Union basket item (id, type, label, amountDue, amountToPay + type-specific data) |
| `UnifiedSearchResult` | Interface | Search result for unified POS search |
| `SplitTenderAllocation` | Interface | Split tender output (cashItems, cardItems, totals) |
| `ReceiptResult` | Interface | Receipt API response wrapper |

### 9.2 Debt Models (`models/debt.models.ts`, 409 lines)

Contains 30+ interfaces for debt management: `Section129Config`, `Section129Notice`, `Section129TrialRun`, `HandoverCase`, `HandoverTermination`, `RiskScore`, `QualificationRule`, `CommunicationEvent`, `BatchJob`, `ProcessInstance`, `DocumentTemplate`, `DigitalSignatureRequest`, etc.

### 9.3 Legal Models (`models/legal.models.ts`, 58 lines)

Contains interfaces for legal compliance: `LegalRule`, `AuditEntry`, `EvidenceBundle`, `EvidenceSection`.

### 9.4 Analytics Models (`models/analytics.models.ts`, 79 lines)

Contains interfaces for analytics: `DashboardMetric`, `ForecastDataPoint`, `GeographicCluster`, `TrendSeries`.

---

## 10. DEV SERVER CONFIGURATION

### 10.1 Angular Dev Proxy (`proxy.conf.json`)

```json
{ "/api": { "target": "http://localhost:3000", "secure": false, "changeOrigin": true } }
```

All `/api/*` requests from Angular dev server (port 5000) proxy to Express backend (port 3000).

### 10.2 Workflow Command

```bash
concurrently \
  "NODE_ENV=development PORT=3000 tsx server/index.ts" \
  "cd angular-client && npx ng serve --host 0.0.0.0 --port 5000 --proxy-config proxy.conf.json" \
  --names server,angular --prefix-colors blue,green
```

### 10.3 Build Timing

- Angular build: ~22 seconds after workflow restart
- Port 5000 unreachable during build window
- Health check: `GET /api/health` (Express on port 3000) — always instant

---

## 11. API ENDPOINTS (INFRASTRUCTURE ONLY)

These endpoints are used by the infrastructure layer (auth, session management). Feature endpoints are documented in Phases 14–18.

| # | Method | Endpoint | Service | Purpose |
|---|--------|----------|---------|---------|
| 1 | GET | `/api/auth/status` | AuthService | Session validation |
| 2 | POST | `/api/auth/login` | AuthService | Login |
| 3 | POST | `/api/auth/logout` | AuthService | Logout |
| 4 | GET | `/api/sites` | LoginComponent | Load available sites |
| 5 | GET | `/api/health` | (ops-only, not consumed by Angular app) | Backend health check — used by workflow/deployment monitors, not called from Angular code |

---

## 12. COMPLIANCE NOTES

### 12.1 Platinum API Only ✅
Infrastructure services handle authentication only. All feature data is sourced from Platinum API endpoints (documented in Phases 14–18).

### 12.2 No Hardcoded Feature Data ✅
Navigation items, quick links, and config constants are structural metadata (routes, labels, CSS classes), not feature data.

### 12.3 Date Format ✅
`FormatService` enforces `dd/mm/yyyy` pattern with `padStart(2,'0')` everywhere.

### 12.4 Session Management ✅
Cookie-based sessions (`pos.sid`), 12hr maxAge, httpOnly, sameSite lax. All HTTP calls use `withCredentials: true`.

### 12.5 Error Handling ✅
Global error interceptor handles 401 (redirect), 0 (network), 500+ (toast). Per-component error handling documented in Phases 14–18.

### 12.6 Multi-Site Support ✅
George Municipality (default) and Inzalo EMS Site02 via `AuthService.isSite02` computed signal and `theme-site02` CSS class.

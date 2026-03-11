# Phase 21 — Server Infrastructure, Build Configuration & Database Schema

**Document**: Source-Verified Technical Reference  
**Scope**: 7 Server Files · 5 Build/Config Files · 1 Shared Schema File  
**Source Files Read**: `server/index.ts`, `server/db.ts`, `server/storage.ts`, `server/platinum-auth.ts`, `server/static.ts`, `server/routes/middleware.ts`, `server/routes/index.ts`, `angular.json`, `proxy.conf.json`, `tsconfig.json`, `tsconfig.app.json`, `styles.css`, `shared/schema.ts`  
**Author**: Agent (source-verified, no fabrication)

---

## Table of Contents

1. [Server Entry Point (index.ts)](#1-server-entry-point-indexts)
2. [Database Layer (db.ts)](#2-database-layer-dbts)
3. [Storage Interface & Implementation (storage.ts)](#3-storage-interface--implementation-storagets)
4. [Platinum Authentication (platinum-auth.ts)](#4-platinum-authentication-platinum-authts)
5. [Static File Serving (static.ts)](#5-static-file-serving-staticts)
6. [Route Middleware (routes/middleware.ts)](#6-route-middleware-routesmiddlewarets)
7. [Route Registration (routes/index.ts)](#7-route-registration-routesindexts)
8. [Database Schema (shared/schema.ts)](#8-database-schema-sharedschematts)
9. [Build Configuration](#9-build-configuration)
10. [Theme & Styles (styles.css)](#10-theme--styles-stylescss)
11. [Summary Tables](#11-summary-tables)

---

## 1. Server Entry Point (index.ts)

**File:** `server/index.ts`  
**Framework:** Express 5  
**HTTP Server:** Node.js `http.createServer`

### Process-Level Handlers

| Handler | Behavior |
|---------|----------|
| `uncaughtException` | Logs `[FATAL]` with message + stack (first 500 chars) |
| `unhandledRejection` | Logs `[FATAL]` with message + stack (first 500 chars) |
| `SIGTERM` | Logs `[PROCESS] Received SIGTERM`, exits 0 |
| `SIGINT` | Logs `[PROCESS] Received SIGINT`, exits 0 |

### Health Check

```
GET /api/health → { status: 'ok', timestamp: <epoch_ms> }
```

Registered **before** session middleware. No auth required. Ops-only (not a feature endpoint).

### Session Configuration

| Property | Value |
|----------|-------|
| Cookie name | `pos.sid` |
| Max age | 12 hours (`12 * 60 * 60 * 1000`) |
| httpOnly | `true` |
| secure | `true` in production only (`process.env.NODE_ENV === 'production'`) |
| sameSite | `'lax'` |
| resave | `false` |
| saveUninitialized | `false` |
| Secret | `SESSION_SECRET` env var or `crypto.randomBytes(32).toString('hex')` |

### Session Type Augmentation

```typescript
declare module "express-session" {
  interface SessionData {
    platinumAuth: UserSession;
  }
}
```

### Trust Proxy

`app.set('trust proxy', 1)` — trusts first proxy hop (required for Replit's reverse proxy).

### Body Parsing

| Parser | Limit | Notes |
|--------|-------|-------|
| `express.json()` | `10mb` | Also captures `rawBody` via verify callback |
| `express.urlencoded()` | `10mb` | `extended: false` |

### Request Logging

Middleware intercepts `res.json()` to capture response body. On `res.finish`, logs API requests:

```
HH:MM:SS AM/PM [express] METHOD /api/path STATUS in Xms :: {response_json}
```

Only logs paths starting with `/api`.

### Bundle Serving

```
GET /dist/bundle.js → serves dist/bundle.js with CORS headers, 1hr cache
OPTIONS /dist/bundle.js → 204 with CORS headers
```

Returns 404 JSON if bundle not built.

### Startup Sequence

1. Register health check endpoint
2. Configure session middleware
3. Configure body parsers
4. Add request logging middleware
5. Register bundle route
6. Call `registerRoutes(httpServer, app)` (all API routes)
7. Add global error handler (catches unhandled errors, returns status+message JSON)
8. In production: call `serveStatic(app)` (Angular build output)
9. Listen on port

### Port Resolution

```typescript
const defaultPort = process.env.NODE_ENV === 'production' ? '5000' : '3000';
const port = parseInt(process.env.PORT || defaultPort, 10);
```

| Environment | Default Port |
|-------------|-------------|
| Development | 3000 |
| Production | 5000 |

### Global Error Handler

Catches any unhandled errors. Extracts `err.status || err.statusCode || 500`. Returns JSON `{ message }`. If headers already sent, delegates to `next(err)`.

---

## 2. Database Layer (db.ts)

**File:** `server/db.ts`

| Export | Type | Description |
|--------|------|-------------|
| `pool` | `pg.Pool` | PostgreSQL connection pool from `DATABASE_URL` env var |
| `db` | Drizzle instance | `drizzle(pool, { schema })` with all shared schema tables |

**Startup check:** Throws `Error("DATABASE_URL must be set...")` if env var is missing.

**ORM:** Drizzle ORM with `drizzle-orm/node-postgres` driver.

---

## 3. Storage Interface & Implementation (storage.ts)

**File:** `server/storage.ts`

### IStorage Interface

13 methods across 3 domains:

**Users (3 methods):**

| Method | Signature | Returns |
|--------|-----------|---------|
| `getUser` | `(id: string)` | `Promise<User \| undefined>` |
| `getUserByUsername` | `(username: string)` | `Promise<User \| undefined>` |
| `createUser` | `(user: InsertUser)` | `Promise<User>` |

**Cashier Sessions (4 methods):**

| Method | Signature | Returns |
|--------|-----------|---------|
| `createSession` | `(session: InsertCashierSession)` | `Promise<CashierSession>` |
| `getSession` | `(id: string)` | `Promise<CashierSession \| undefined>` |
| `getActiveSession` | `(cashierId: string)` | `Promise<CashierSession \| undefined>` |
| `endSession` | `(id: string)` | `Promise<CashierSession \| undefined>` |

**Transactions (6 methods):**

| Method | Signature | Returns |
|--------|-----------|---------|
| `createTransaction` | `(tx: InsertTransaction)` | `Promise<Transaction>` |
| `getTransaction` | `(id: string)` | `Promise<Transaction \| undefined>` |
| `getTransactionByReceipt` | `(receiptNumber: string)` | `Promise<Transaction \| undefined>` |
| `listTransactions` | `(filters: {...})` | `Promise<Transaction[]>` |
| `updateTransactionStatus` | `(id: string, status: string, reason?: string)` | `Promise<Transaction \| undefined>` |
| `updateTransactionReceiptNumber` | `(id: string, receiptNumber: string)` | `Promise<Transaction \| undefined>` |

**listTransactions filters:**
- `cashierId?: string`
- `cashOfficeId?: string`
- `fromDate?: Date`
- `toDate?: Date`
- `status?: string`

All filters are optional. Results ordered by `createdAt DESC`.

### DatabaseStorage Implementation

Implements `IStorage` using Drizzle queries. Key patterns:
- All queries use `eq()`, `and()`, `gte()`, `lte()`, `desc()` from `drizzle-orm`.
- `endSession` sets `endedAt: new Date()` and `status: "ENDED"`.
- `updateTransactionStatus` sets `cancellationReason: reason || null`.
- All mutations use `.returning()` for immediate result.

**Singleton export:** `export const storage = new DatabaseStorage();`

---

## 4. Platinum Authentication (platinum-auth.ts)

**File:** `server/platinum-auth.ts`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PLATINUM_API_URL` | `https://georgeplatinumuatapi.azurewebsites.net` | Base API URL |
| `PLATINUM_API_USERNAME` | `Francois` | Default username |
| `PLATINUM_API_PASSWORD` | `""` | Default password |
| `PLATINUM_API_DBNAME` | `George` | Default database name |

### Multi-Site Configuration

**`SiteConfig` interface:**

| Field | Type |
|-------|------|
| `id` | `string` |
| `name` | `string` |
| `apiUrl` | `string` |
| `dbName` | `string` |
| `logo` | `string` |
| `themeClass` | `string` |

**`SITE_CONFIGS` array (2 sites):**

| Site ID | Name | API URL | DB Name | Theme Class |
|---------|------|---------|---------|-------------|
| `george` | George Municipality | `https://georgeplatinumuatapi.azurewebsites.net` | `George` | `''` (default) |
| `site02` | Inzalo EMS (Site02) | `https://test-ems-site02-token-api.azurewebsites.net` | `Site02` | `theme-site02` |

**`getSiteConfig(siteId)`** — returns matching config or falls back to `SITE_CONFIGS[0]` (George).

### UserSession Interface

```typescript
export interface UserSession {
  token: string;
  tokenExpiry: number;
  userData: any;
  posCashierId: number | null;
  authMode: 'direct' | 'azure' | 'override';
  loggedIn: boolean;
  siteId: string;
  dayEndPending?: boolean;
}
```

### Caching Architecture

**User Cache:**

| Property | Value |
|----------|-------|
| Storage | `Map<string, { userData, ts }>` |
| TTL | 1 hour (`60 * 60 * 1000`) |
| Key | `username.toLowerCase()` |
| Functions | `getCachedUser()`, `setCachedUser()` |

**Response Cache:**

| Property | Value |
|----------|-------|
| Storage | `Map<string, { data, ts }>` |
| TTL (default) | 30 seconds |
| TTL (short) | 5 seconds |
| Max entries | 500 (evicts oldest 100 when exceeded) |
| Functions | `getResponseCache()`, `setResponseCache()` |

**In-Flight Dedup:**

| Property | Value |
|----------|-------|
| Storage | `Map<string, Promise<any>>` |
| Purpose | Prevents duplicate concurrent requests to same URL |

### Cacheable Paths

**Always cacheable (30s TTL):**
- `/api/BillingEnquiry/`
- `/api/ReceiptPrepaid/cashier-detailsById`
- `/api/ReceiptPrepaid/active-cashier-details`
- `/api/billing-payment/payment-options`
- `/api/billing-payment/payment-types`

**Never cacheable:**
- `/api/BillingEnquiry/rebuild-full-account`
- `/api/BillingEnquiry/TotalBalanceDebtInquiry`
- `/api/billing-payment/submit-consumer-payment`
- `/api/billing-payment/submit-multiple-payment`
- `/api/billing-payment/save-multiple-account-payment`
- `/api/ReceiptPrepaid/validate-cashier`
- `/api/ReceiptPrepaid/ValidateCashierDayEndRecon`
- `/api/billing-payment-day-end-reconcile/save-Reconcile-data`

**User-specific paths** (cache key includes user ID):
- `/api/ReceiptPrepaid/validate-cashier`
- `/api/ReceiptPrepaid/cashier-detailsById`
- `/api/ReceiptPrepaid/active-cashier-details`
- `/api/billing-payment/payment-options`
- `/api/billing-payment/payment-types`

### Concurrency Control

| Property | Value |
|----------|-------|
| Max concurrent Platinum requests | 20 (`MAX_CONCURRENT_REQUESTS`) |
| Queue mechanism | `requestQueue` array with resolve callbacks |
| `acquireSlot()` | Increments counter or enqueues promise |
| `releaseSlot()` | Decrements counter, resolves next queued |

### Authentication Flow

**`fetchTokenForUser(username, password, dbName, apiUrl?)`**

1. **If password provided** and not in lockout:
   - POST `{baseUrl}/auth/createToken` with `{ userName, password, dbName }`
   - If OK and valid user_ID (not 1): return `authMode: 'direct'`
   - If lockout detected in response: cache lockout with backoff (up to 10min)

2. **Fallback to Azure:**
   - POST `{baseUrl}/auth/createTokenAzure` with `{ azureUid: "00000000...", email, username, dbName }`
   - If token user doesn't match requested username:
     - Check user cache first
     - Try 4 search endpoints: `/api/User/search`, `/api/User?$filter=contains(userName,...)`, `/api/User/by-name`, `/api/User?$filter=contains(firstName,...)`
     - Each endpoint has 8s timeout, AbortController
     - If all search endpoints fail: try streamed `/api/User` full list (12s timeout, max 5MB)
     - Match logic: `matchUser()` checks userName, email, firstName+lastName, fullName
   - If matched: return `authMode: 'azure'`

3. **If API returns generic user (ID=1):**
   - Override with hardcoded Francois Naude (user_ID: 213)
   - Return `authMode: 'override'`

**Lockout handling:**
- Backoff: `LOCKOUT_BACKOFF_MS = 10 * 60 * 1000` (10 minutes)
- Extracts lockout duration from response text via regex
- Skips createToken during lockout to avoid extending it

### Token Management

**`refreshSessionToken(session)`:**
- Returns cached token if `tokenExpiry > now + 60000` (1min buffer)
- Uses mutex pattern (`tokenRefreshPromises` Map) to prevent concurrent refreshes per user+site
- Token TTL: 7 hours (`7 * 60 * 60 * 1000`)

### Exported Functions (17 total: 2 interfaces, 2 constants, 13 functions)

**Interfaces & constants:**

| Export | Type |
|--------|------|
| `SiteConfig` | Interface (id, name, apiUrl, dbName, logo, themeClass) |
| `UserSession` | Interface (token, tokenExpiry, userData, posCashierId, authMode, loggedIn, siteId, dayEndPending?) |
| `SITE_CONFIGS` | `SiteConfig[]` (2 entries: george, site02) |

**Functions:**

| Function | Signature | Description |
|----------|-----------|-------------|
| `getSiteConfig` | `(siteId: string): SiteConfig` | Returns site config or George default |
| `createEmptySession` | `(): UserSession` | Returns blank session with siteId='george' |
| `refreshSessionToken` | `(session: UserSession): Promise<string>` | Refreshes/returns valid token with mutex dedup |
| `loginWithCredentials` | `(username, password, dbName?, siteId?): Promise<{ success, session?, error? }>` | Full login flow |
| `clearLockoutCache` | `(username?: string): void` | Clears lockout for user or all |
| `logoutSession` | `(session: UserSession): void` | Resets session fields |
| `isSessionAuthenticated` | `(session: UserSession): boolean` | Checks loggedIn + token + userData + expiry |
| `getSessionPosCashierId` | `(session: UserSession): Promise<number \| null>` | Fetches POS cashier session from Platinum |
| `platinumGet` | `(session, path, params?, options?): Promise<any>` | Authenticated GET with caching, concurrency, retry on 401 |
| `platinumPost` | `(session, path, body, params?, options?): Promise<any>` | Authenticated POST |
| `platinumPut` | `(session, path, body, params?): Promise<any>` | Authenticated PUT |
| `platinumDelete` | `(session, path, params?): Promise<any>` | Authenticated DELETE |
| `getPlatinumApiUrl` | `(session?: UserSession): string` | Returns API URL for session or default |
| `getPlatinumDbName` | `(session?: UserSession): string` | Returns DB name for session or default |

### platinumGet Details

- Builds URL with `URLSearchParams`, applies `%2F` → `/` fix
- Checks response cache before fetch
- Deduplicates in-flight requests to same URL
- Acquires concurrency slot before fetch
- On 401: clears token, refreshes, retries once
- Default timeout: 30s (configurable via `options.timeoutMs`)

---

## 5. Static File Serving (static.ts)

**File:** `server/static.ts`

**Used in production only** (called when `NODE_ENV === 'production'`).

### Build Output Search Order

1. `<serverDir>/../angular-client/dist/angular-client/browser`
2. `<cwd>/angular-client/dist/angular-client/browser`
3. `<serverDir>/public`
4. `<cwd>/dist/public`

First existing path is used. Throws if none found.

### Static Serving Configuration

| Property | Value |
|----------|-------|
| etag | `false` |
| lastModified | `false` |
| Cache-Control | `no-store, no-cache, must-revalidate` |
| Pragma | `no-cache` |

### SPA Fallback

```typescript
app.use("/{*path}", (_req, res) => {
  res.sendFile(path.resolve(distPath, "index.html"));
});
```

All non-static routes serve `index.html` for Angular client-side routing.

---

## 6. Route Middleware (routes/middleware.ts)

**File:** `server/routes/middleware.ts`

### Session Access

| Function | Description |
|----------|-------------|
| `getSession(req)` | Returns `req.session.platinumAuth`, creating empty session if absent |
| `requireAuth(req, res)` | Returns session if authenticated, else 401 JSON + null |

### Payment Deduplication

| Constant/Type | Value |
|---------------|-------|
| `PAYMENT_DEDUP_WINDOW_MS` | 15,000 (15 seconds) |
| `recentPaymentSubmissions` | `Map<string, { timestamp, response }>` |

**`getPaymentDeduplicationKey(userId, body)`:**
- Key format: `{userId}|{accountKey}|{totalAmount}|{paymentType}`
- Account key: `single:{account_ID}` or `multi:{sorted_accountIDs}` or `unknown`

**`checkPaymentDedup(key)`:**
- Cleans expired entries on every check
- Returns `{ isDuplicate: true, cachedResponse }` if within window

**`recordPaymentSubmission(key, response)`:**
- Stores response with timestamp for dedup window

### Receipt Allocation Parser

**`parseReceiptAllocations(pdfText): ReceiptAllocation[]`**

Two-pass regex parser for extracting service allocations from receipt PDF text:

**Pass 1 (primary):** Regex `^(.+?)\s{2,}(-?[\d, ]+\.\d{2})\s*$`
- Matches "ServiceName    123.45" pattern (label + 2+ spaces + amount)
- Skips known labels (total, tender amount, change, etc.)
- Skips lines starting with digits
- Skips municipality/registration lines
- Merges multi-line service names if next line is a known suffix (basic, metered, charge, disposal, rates, levy, fixed, standing, contribution, payment, advance, arrear)

**Pass 2 (fallback):** Standalone amount regex `^-?([\d,]+\.\d{2})$`
- If pass 1 returns nothing, tries label-on-previous-line pattern
- Ultimate fallback: single "Consumer Services" allocation from tender amount minus VAT

**`ReceiptAllocation` interface:**

| Field | Type |
|-------|------|
| `service` | `string` |
| `amount` | `number` |
| `vat` | `number` |
| `total` | `number` |

### HTML Stripping

**`stripHtml(text): string`**
- Returns input unchanged if falsy
- Detects HTML with `/<[^>]+>/` regex
- If HTML detected: extracts `<title>` content, replaces `<br>` with spaces, strips all tags, decodes 5 HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`), collapses whitespace, truncates to **300 chars**
- If plain text (no HTML): truncates to **500 chars**

### Platinum Result Handler

**`handlePlatinumResult(res, data)`**
- If `data._error`: returns status (default 502) with message + stripped detail
- If `data.isSuccess === false`: logs warning (first 2000 chars)
- Otherwise: passes through as JSON

### Debt Permissions

**`DEBT_PERMISSIONS` constants:**

| Key | Value |
|-----|-------|
| `PROCESS_SECTION129` | `'PROCESS_SECTION129'` |
| `AUTHORISE_SECTION129` | `'AUTHORISE_SECTION129'` |
| `HANDOVER_PROCESS` | `'HANDOVER_PROCESS'` |
| `AUTHORISE_HANDOVER` | `'AUTHORISE_HANDOVER'` |
| `SECTION129_REPORT` | `'SECTION129_REPORT'` |
| `HANDOVER_REPORT` | `'HANDOVER_REPORT'` |
| `SMS_LOG_REPORT` | `'SMS_LOG_REPORT'` |

**`requireDebtPermission(session, permission, res): boolean`**
- Checks `session.userData.permissions` or `session.userData.roles` array
- Passes if user has the specific permission or `ADMIN`/`admin`
- Passes if permissions array is empty (no permission data from API)
- Returns 403 JSON if denied

### Audit Field Injection

**`injectAuditFields(session, body, options?): any`**
- Adds `capturerID`, `dateCaptured`, `modifierID`, `dateModified` (all from session user + ISO timestamp)
- If `options.isReview`: adds `reviewerID`, `reviewDate`
- If `options.isTermination`: adds `statusID`, `comment`

### Legal Admin Check

**`requireLegalAdmin(session, res): boolean`**
- Passes if `superUser === true`
- Passes if permissions include any of: `ADMIN`, `admin`, `LEGAL_ADMIN`, `COMPLIANCE_ADMIN`, `DEBT_ADMIN`
- Returns 403 JSON if denied

---

## 7. Route Registration (routes/index.ts)

**File:** `server/routes/index.ts`

Registers all 13 route modules in order:

| # | Module | Import |
|---|--------|--------|
| 1 | Auth | `registerAuthRoutes` from `./auth.routes` |
| 2 | POS | `registerPosRoutes` from `./pos.routes` |
| 3 | Billing | `registerBillingRoutes` from `./billing.routes` |
| 4 | Clearance | `registerClearanceRoutes` from `./clearance.routes` |
| 5 | Enquiries | `registerEnquiriesRoutes` from `./enquiries.routes` |
| 6 | Day-End | `registerDayendRoutes` from `./dayend.routes` |
| 7 | Deposits | `registerDepositsRoutes` from `./deposits.routes` |
| 8 | Supervisor | `registerSupervisorRoutes` from `./supervisor.routes` |
| 9 | Receipts | `registerReceiptsRoutes` from `./receipts.routes` |
| 10 | Debt | `registerDebtRoutes` from `./debt.routes` |
| 11 | Legal | `registerLegalRoutes` from `./legal.routes` |
| 12 | Communications | `registerCommunicationsRoutes` from `./communications.routes` |
| 13 | Analytics | `registerAnalyticsRoutes` from `./analytics.routes` |

All receive `(app: Express, httpServer: Server)`. Returns `httpServer`.

---

## 8. Database Schema (shared/schema.ts)

**File:** `shared/schema.ts`  
**ORM:** Drizzle ORM  
**Driver:** `drizzle-orm/pg-core`  
**Validation:** `drizzle-zod` + Zod

### Tables (5)

#### 8.1 users

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK, default `gen_random_uuid()` |
| `username` | `text` | NOT NULL, UNIQUE |
| `password` | `text` | NOT NULL |

**Insert schema:** picks `username`, `password` only.

#### 8.2 cashierSessions (→ `cashier_sessions`)

| Column | DB Column | Type | Constraints |
|--------|-----------|------|-------------|
| `id` | `id` | `varchar` | PK, default `gen_random_uuid()` |
| `cashierId` | `cashier_id` | `text` | NOT NULL |
| `cashierName` | `cashier_name` | `text` | NOT NULL |
| `cashOfficeId` | `cash_office_id` | `text` | NOT NULL |
| `cashOfficeName` | `cash_office_name` | `text` | nullable |
| `floatAmount` | `float_amount` | `numeric(12,2)` | NOT NULL, default `'0'` |
| `startedAt` | `started_at` | `timestamp` | NOT NULL, default `now()` |
| `endedAt` | `ended_at` | `timestamp` | nullable |
| `status` | `status` | `text` | NOT NULL, default `'ACTIVE'` |

**Insert schema:** omits `id`, `startedAt`, `endedAt`.

#### 8.3 transactions

| Column | DB Column | Type | Constraints |
|--------|-----------|------|-------------|
| `id` | `id` | `varchar` | PK, default `gen_random_uuid()` |
| `receiptNumber` | `receipt_number` | `text` | NOT NULL |
| `sessionId` | `session_id` | `varchar` | nullable |
| `cashierId` | `cashier_id` | `text` | NOT NULL |
| `cashierName` | `cashier_name` | `text` | nullable |
| `cashOfficeId` | `cash_office_id` | `text` | nullable |
| `totalAmount` | `total_amount` | `numeric(12,2)` | NOT NULL, default `'0'` |
| `cashAmount` | `cash_amount` | `numeric(12,2)` | default `'0'` |
| `cardAmount` | `card_amount` | `numeric(12,2)` | default `'0'` |
| `chequeAmount` | `cheque_amount` | `numeric(12,2)` | default `'0'` |
| `tenderAmount` | `tender_amount` | `numeric(12,2)` | default `'0'` |
| `changeAmount` | `change_amount` | `numeric(12,2)` | default `'0'` |
| `paymentType` | `payment_type` | `text` | default `'Cash'` |
| `status` | `status` | `text` | NOT NULL, default `'COMPLETED'` |
| `cancellationReason` | `cancellation_reason` | `text` | nullable |
| `items` | `items` | `jsonb` | default `[]` |
| `createdAt` | `created_at` | `timestamp` | NOT NULL, default `now()` |

**Insert schema:** omits `id`, `createdAt`.

#### 8.4 conversations

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `serial` | PK (auto-increment) |
| `title` | `text` | NOT NULL |
| `createdAt` | `timestamp` | NOT NULL, default `now()` |

#### 8.5 messages

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `serial` | PK (auto-increment) |
| `conversationId` | `integer` | NOT NULL |
| `role` | `text` | NOT NULL |
| `content` | `text` | NOT NULL |
| `createdAt` | `timestamp` | NOT NULL, default `now()` |

### Exported Types

| Export | Source |
|--------|-------|
| `InsertUser` | `z.infer<typeof insertUserSchema>` |
| `User` | `typeof users.$inferSelect` |
| `InsertCashierSession` | `z.infer<typeof insertCashierSessionSchema>` |
| `CashierSession` | `typeof cashierSessions.$inferSelect` |
| `InsertTransaction` | `z.infer<typeof insertTransactionSchema>` |
| `Transaction` | `typeof transactions.$inferSelect` |

**Note:** `conversations` and `messages` tables do not have exported insert schemas or type aliases — they are used for AI chat only.

---

## 9. Build Configuration

### 9.1 angular.json

**File:** `angular-client/angular.json`

| Property | Value |
|----------|-------|
| Project name | `angular-client` |
| Project type | `application` |
| Package manager | `npm` |
| Source root | `src` |
| Prefix | `app` |
| Builder (build) | `@angular/build:application` |
| Builder (serve) | `@angular/build:dev-server` |
| Entry point | `src/main.ts` |
| TSConfig | `tsconfig.app.json` |
| Global styles | `src/styles.css` |
| Assets | `public/**/*` |

**Schematics:** All `skipTests: true` for class, component, directive, guard, interceptor, pipe, resolver, service.

**Build configurations:**

| Config | Settings |
|--------|----------|
| Production | outputHashing: all, budgets: initial 500kB warn / 1MB error, anyComponentStyle 24kB warn / 48kB error |
| Development | optimization: false, extractLicenses: false, sourceMap: true |

**Serve configuration:**

| Property | Value |
|----------|-------|
| Host | `0.0.0.0` |
| Port | `5000` |
| Allowed hosts | `true` (all) |
| Proxy config | `proxy.conf.json` |
| Default config | `development` |

### 9.2 proxy.conf.json

**File:** `angular-client/proxy.conf.json`

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

Proxies all `/api` requests from Angular dev server (port 5000) to Express backend (port 3000).

### 9.3 tsconfig.json (root)

**File:** `angular-client/tsconfig.json`

| Option | Value |
|--------|-------|
| `strict` | `true` |
| `noImplicitOverride` | `true` |
| `noPropertyAccessFromIndexSignature` | `true` |
| `noImplicitReturns` | `true` |
| `noFallthroughCasesInSwitch` | `true` |
| `skipLibCheck` | `true` |
| `isolatedModules` | `true` |
| `experimentalDecorators` | `true` |
| `importHelpers` | `true` |
| `target` | `ES2022` |
| `module` | `preserve` |

**Angular compiler options:**

| Option | Value |
|--------|-------|
| `enableI18nLegacyMessageIdFormat` | `false` |
| `strictInjectionParameters` | `true` |
| `strictInputAccessModifiers` | `true` |
| `strictTemplates` | `true` |

### 9.4 tsconfig.app.json

**File:** `angular-client/tsconfig.app.json`

Extends `./tsconfig.json`. Sets `outDir: ./out-tsc/app`. Includes `src/**/*.ts`, excludes `src/**/*.spec.ts`.

### 9.5 Workflow Command

```bash
concurrently \
  "NODE_ENV=development PORT=3000 tsx server/index.ts" \
  "cd angular-client && npx ng serve --host 0.0.0.0 --port 5000 --proxy-config proxy.conf.json" \
  --names server,angular --prefix-colors blue,green
```

Runs Express (blue prefix) and Angular (green prefix) concurrently.

---

## 10. Theme & Styles (styles.css)

**File:** `angular-client/src/styles.css`

### CSS Framework

```css
@import "tailwindcss";
```

Tailwind CSS imported as first line.

### Root CSS Variables (`:root`)

**Primary palette:**

| Variable | Value | Description |
|----------|-------|-------------|
| `--platinum-primary` | `#0f2b46` | Navy primary |
| `--platinum-primary-light` | `#1a3a5c` | Lighter navy |
| `--platinum-primary-dark` | `#091d30` | Darker navy |
| `--platinum-accent` | `#c9a84c` | Gold accent |
| `--platinum-accent-light` | `#d5b866` | Lighter gold |
| `--platinum-accent-dark` | `#a97d24` | Darker gold |

**Surfaces:**

| Variable | Value |
|----------|-------|
| `--platinum-surface` | `#f8f9fb` |
| `--platinum-surface-alt` | `#f1f5f9` |
| `--platinum-surface-warm` | `#fafbfc` |

**Text:**

| Variable | Value |
|----------|-------|
| `--platinum-text` | `#1e293b` |
| `--platinum-text-secondary` | `#64748b` |
| `--platinum-text-muted` | `#94a3b8` |

**Semantic colors:**

| Variable | Value | Light variant |
|----------|-------|---------------|
| `--platinum-success` | `#4caf50` | `#e8f5e9` |
| `--platinum-warning` | `#f59e0b` | `#fff8e1` |
| `--platinum-danger` | `#ef5350` | `#ffebee` |
| `--platinum-info` | `#42a5f5` | `#e3f2fd` |

**Extended colors:**

| Variable | Value | Light variant |
|----------|-------|---------------|
| `--platinum-teal` | `#26a69a` | `#e0f2f1` |
| `--platinum-purple` | `#7e57c2` | `#ede7f6` |
| `--platinum-indigo` | `#5c6bc0` | `#e8eaf6` |

**Borders & shadows:**

| Variable | Value |
|----------|-------|
| `--platinum-border` | `#e8ecf1` |
| `--platinum-border-light` | `#f0f3f7` |
| `--platinum-card-shadow` | `0 1px 3px rgba(15,43,70,0.04), 0 1px 2px rgba(15,43,70,0.02)` |
| `--platinum-card-shadow-hover` | `0 4px 12px rgba(15,43,70,0.08), 0 2px 4px rgba(15,43,70,0.04)` |
| `--platinum-card-radius` | `12px` |

**POS-specific aliases:** Duplicate variables prefixed `--pos-*` for backward compatibility. Includes `--pos-primary-gradient: linear-gradient(135deg, #0f2b46, #1a3a5c)`.

### Site02 Theme Override (`.theme-site02`)

| Variable | Override Value |
|----------|---------------|
| `--pos-accent` | `#1E6B45` |
| `--pos-accent-hover` | `#155A38` |
| `--pos-accent-dark` | `#0E4C2E` |
| `--pos-primary` | `#1E6B45` |
| `--pos-primary-gradient` | `linear-gradient(135deg, #1E6B45, #155A38)` |
| `--platinum-primary` | `#1E6B45` |
| `--platinum-primary-light` | `#155A38` |
| `--pos-accent-light` | `#E8F5EE` |

### Global Styles

| Rule | Value |
|------|-------|
| `html` | `height: 100%` |
| `*` | `margin: 0; padding: 0; box-sizing: border-box` |
| `body` | `color-scheme: light; font-family: 'Inter', 'Roboto', system fonts; background: var(--platinum-surface); color: var(--platinum-text); height: 100%` |
| `a` | `text-decoration: none` |
| Scrollbar | `6px width/height, transparent track, #cbd5e1 thumb (#94a3b8 hover), 3px radius` |

---

## 11. Summary Tables

### Files by Category

| Category | Files | Count |
|----------|-------|-------|
| Server Core | index.ts, db.ts, storage.ts | 3 |
| Server Auth | platinum-auth.ts | 1 |
| Server Middleware | routes/middleware.ts | 1 |
| Server Config | routes/index.ts, static.ts | 2 |
| Build Config | angular.json, proxy.conf.json, tsconfig.json, tsconfig.app.json | 4 |
| Theme | styles.css | 1 |
| DB Schema | shared/schema.ts | 1 |
| **Total** | | **13** |

### Database Tables

| Table | PK Type | Purpose |
|-------|---------|---------|
| `users` | UUID (varchar) | Local auth users |
| `cashier_sessions` | UUID (varchar) | POS cashier session tracking |
| `transactions` | UUID (varchar) | POS transaction records |
| `conversations` | serial (int) | AI chat conversations |
| `messages` | serial (int) | AI chat messages |

### Key Architectural Constants

| Constant | Value | Location |
|----------|-------|----------|
| Session cookie name | `pos.sid` | index.ts |
| Session max age | 12 hours | index.ts |
| Token TTL | 7 hours | platinum-auth.ts |
| Lockout backoff | 10 minutes | platinum-auth.ts |
| Response cache TTL | 30 seconds | platinum-auth.ts |
| Response cache max | 500 entries | platinum-auth.ts |
| User cache TTL | 1 hour | platinum-auth.ts |
| Max concurrent Platinum requests | 20 | platinum-auth.ts |
| Payment dedup window | 15 seconds | middleware.ts |
| Body size limit | 10mb | index.ts |
| Dev Express port | 3000 | index.ts |
| Production port | 5000 | index.ts |
| Angular dev server port | 5000 | angular.json |
| Budget (initial) | 500kB warn / 1MB error | angular.json |

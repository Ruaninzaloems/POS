# PHASE 13: SERVER INFRASTRUCTURE, MIDDLEWARE & CONFIGURATION — DETAIL PACK

**Document Version**: 1.1
**Date**: 11 March 2026
**Scope**: Express server setup, Platinum authentication engine, middleware layer, route registration, database schema, static serving, dev tooling
**Coverage**: 7 server files, 1 shared schema, proxy and workflow configuration

---

## TABLE OF CONTENTS

1. [Platinum Authentication Engine](#1-platinum-authentication-engine)
2. [Express Server Setup](#2-express-server-setup)
3. [Middleware Layer](#3-middleware-layer)
4. [Route Registration](#4-route-registration)
5. [Database Layer](#5-database-layer)
6. [Static Serving & Dev Tooling](#6-static-serving--dev-tooling)
7. [Multi-Site Configuration](#7-multi-site-configuration)
8. [Security & Performance](#8-security--performance)
9. [Infrastructure Observations](#9-infrastructure-observations)

---

## 1. PLATINUM AUTHENTICATION ENGINE

### 1.1 File Overview
- **Path**: `server/platinum-auth.ts`
- **Lines**: 767
- **Purpose**: Core authentication, token management, caching, and Platinum API proxy functions

### 1.2 Authentication Strategy (3-Tier Fallback)

```
Login Request
├── Strategy 1: Direct Auth (createToken)
│   ├── POST /auth/createToken { userName, password, dbName }
│   ├── If token + real user_ID (not 1) → SUCCESS (authMode: 'direct')
│   ├── If lockout detected → backoff cache (up to 10min) → skip to Azure
│   └── If generic user (ID:1) or error → fall through
├── Strategy 2: Azure Auth (createTokenAzure)
│   ├── POST /auth/createTokenAzure { azureUid, email, username, dbName }
│   ├── If token user matches requested user → SUCCESS (authMode: 'azure')
│   ├── If token user differs → user resolution (see 1.3)
│   └── If 401/error → FAIL
└── Strategy 3: Override (hardcoded fallback)
    ├── If API returns generic user (ID:1) and no match found
    └── Uses hardcoded user: Francois Naude (user_ID: 213) (authMode: 'override')
```

### 1.3 User Resolution (Azure Auth Mismatch)

When `createTokenAzure` returns a token for a different user than requested, the system performs a multi-step user lookup:

| Step | Endpoint | Timeout | Purpose |
|---|---|---|---|
| 1 | Check `resolvedUserCache` | — | Skip lookup if cached (1hr TTL) |
| 2 | `GET /api/User/search?name=` | 8s | Search by name |
| 3 | `GET /api/User?$filter=contains(userName,'...')` | 8s | OData userName filter |
| 4 | `GET /api/User/by-name?userName=` | 8s | Direct name lookup |
| 5 | `GET /api/User?$filter=contains(firstName,'...')` | 8s | OData firstName filter |
| 6 | `GET /api/User` (streamed) | 12s | Full user list streaming (max 5MB) |

**Match Logic**: Checks `userName`, `email`, `firstName+lastName`, and `fullName` (case-insensitive).

### 1.4 Token Management

| Parameter | Value | Notes |
|---|---|---|
| Token TTL | 7 hours | `Date.now() + 7 * 60 * 60 * 1000` |
| Refresh threshold | 60 seconds | Refreshes when token expires within 60s |
| Refresh mutex | Per-user per-site key | `refresh-{username}-{siteId}` prevents duplicate refresh |
| Lockout backoff | Up to 10 minutes | Detects lockout message, skips `createToken` during backoff |

### 1.5 Response Cache

| Parameter | Value |
|---|---|
| Default TTL | 30 seconds |
| Short TTL | 5 seconds |
| Max entries | 500 |
| Eviction | LRU — when exceeds 500, evicts oldest 100 |
| In-flight dedup | Same URL shares single Promise |

**Cacheable Paths** (30s TTL):
| Path | Purpose |
|---|---|
| `/api/BillingEnquiry/` | Account enquiry data |
| `/api/ReceiptPrepaid/cashier-detailsById` | Cashier details |
| `/api/ReceiptPrepaid/active-cashier-details` | Active cashier |
| `/api/billing-payment/payment-options` | Payment options |
| `/api/billing-payment/payment-types` | Payment types |

**Never-Cache Paths** (mutations / real-time data):
| Path | Reason |
|---|---|
| `/api/BillingEnquiry/rebuild-full-account` | Account rebuild |
| `/api/BillingEnquiry/TotalBalanceDebtInquiry` | Real-time balance |
| `/api/billing-payment/submit-consumer-payment` | Payment submit |
| `/api/billing-payment/submit-multiple-payment` | Batch payment submit |
| `/api/billing-payment/save-multiple-account-payment` | Multi-account save |
| `/api/ReceiptPrepaid/validate-cashier` | Cashier validation |
| `/api/ReceiptPrepaid/ValidateCashierDayEndRecon` | Day-end validation |
| `/api/billing-payment-day-end-reconcile/save-Reconcile-data` | Day-end save |

**User-Specific Cache Keys**: Paths in `USER_SPECIFIC_PATHS` include `u{user_ID}:` prefix in cache key to prevent cross-user data leaks.

### 1.6 Concurrency Control

| Parameter | Value |
|---|---|
| Max concurrent requests | 20 |
| Queue mechanism | Promise-based FIFO |
| Slot acquisition | `acquireSlot()` — blocks if at limit |
| Slot release | `releaseSlot()` — dequeues next waiting request |

### 1.7 Proxy Functions (Exported)

| Function | HTTP Method | Purpose |
|---|---|---|
| `platinumGet(session, path, params?, options?)` | GET | Proxied GET with cache + concurrency |
| `platinumPost(session, path, body?, params?)` | POST | Proxied POST (never cached) |
| `platinumPut(session, path, body?)` | PUT | Proxied PUT |
| `platinumDelete(session, path, params?)` | DELETE | Proxied DELETE |
**Proxy Function Behavior**:
- `platinumGet` and `platinumPost`: Acquire concurrency slot via `acquireSlot()` / `releaseSlot()`, auto-retry on 401, cache support (GET only)
- `platinumPut` and `platinumDelete`: No concurrency slot management — direct fetch with 401 retry (PUT) or 30s timeout (DELETE)
- All functions: Build URL with `URLSearchParams` + `%2F` fix (`.replace(/%2F/gi, '/')`), return parsed JSON or error object `{ _error: true, status, statusText, detail }`

### 1.8 User Cache

| Parameter | Value |
|---|---|
| TTL | 1 hour |
| Scope | By username (lowercased) |
| Storage | In-memory Map |
| Purpose | Avoid repeated user resolution lookups |

### 1.9 Session Functions (Exported)

| Function | Purpose |
|---|---|
| `loginWithCredentials(username, password, dbName?, siteId?)` | Full login flow → returns `UserSession` |
| `refreshSessionToken(session)` | Token refresh with mutex |
| `logoutSession(session)` | Clear session state |
| `isSessionAuthenticated(session)` | Check token validity |
| `getSessionPosCashierId(session)` | Lookup POS cashier session ID |
| `clearLockoutCache(username?)` | Clear lockout backoff |
| `createEmptySession()` | New empty session (default: george, override mode) |
| `getSiteConfig(siteId)` | Get site configuration |
| `getPlatinumApiUrl(session?)` | Get site-specific API URL (exported wrapper) |
| `getPlatinumDbName(session?)` | Get site-specific DB name (exported wrapper) |

### 1.10 UserSession Interface

```typescript
interface UserSession {
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

---

## 2. EXPRESS SERVER SETUP

### 2.1 File Overview
- **Path**: `server/index.ts`
- **Lines**: 154
- **Purpose**: Application entry point — Express configuration, middleware, error handling, server start

### 2.2 Configuration

| Setting | Value | Notes |
|---|---|---|
| JSON body limit | 10MB | With raw body capture |
| URL-encoded limit | 10MB | `extended: false` |
| Trust proxy | `1` | For secure cookies behind reverse proxy |
| Dev port | 3000 | Via `PORT` env var |
| Production port | 5000 | Serves Angular build + API |
| Health check | `GET /api/health` | Always returns `{ status: 'ok', timestamp }` |

### 2.3 Session Configuration

| Setting | Value |
|---|---|
| Secret | `SESSION_SECRET` env var or random 32-byte hex |
| Cookie name | `pos.sid` |
| Max age | 12 hours |
| httpOnly | `true` |
| Secure | `true` in production only |
| sameSite | `'lax'` |
| resave | `false` |
| saveUninitialized | `false` |

### 2.4 Middleware Stack (Order)

1. Health check endpoint (`/api/health`)
2. Express session
3. JSON body parser (10MB, raw body capture)
4. URL-encoded body parser
5. Request logger (logs all `/api` requests with duration + response)
6. Bundle CORS handler (`/dist/bundle.js`)
7. Route registration (`registerRoutes`)
8. Global error handler (catches unhandled errors, returns JSON)
9. Static file serving (production only)

### 2.5 Process Signal Handling

| Signal | Action |
|---|---|
| `uncaughtException` | Log + continue |
| `unhandledRejection` | Log + continue |
| `SIGTERM` | Log + `process.exit(0)` |
| `SIGINT` | Log + `process.exit(0)` |

### 2.6 Request Logging
All `/api/*` requests logged with: `METHOD PATH STATUS in DURATIONms :: RESPONSE_BODY`
Response body captured via `res.json` override. Non-API requests (static files) are not logged.

---

## 3. MIDDLEWARE LAYER

### 3.1 File Overview
- **Path**: `server/routes/middleware.ts`
- **Lines**: 229
- **Purpose**: Shared middleware functions used by all route modules

### 3.2 Authentication Middleware

| Function | Purpose | Returns |
|---|---|---|
| `getSession(req)` | Gets or creates `platinumAuth` on `req.session` | `UserSession` |
| `requireAuth(req, res)` | Checks session authentication, returns 401 if invalid | `UserSession \| null` |

### 3.3 Payment Deduplication

| Component | Purpose |
|---|---|
| `recentPaymentSubmissions` | In-memory Map of recent submissions |
| `PAYMENT_DEDUP_WINDOW_MS` | 15 seconds dedup window |
| `getPaymentDeduplicationKey(userId, body)` | Builds unique key: `userId\|accountKey\|totalAmount\|paymentType` |
| `checkPaymentDedup(key)` | Returns `{ isDuplicate, cachedResponse? }` |
| `recordPaymentSubmission(key, response)` | Records successful submission for dedup |

**Account Key Construction**:
- Single account: `single:{account_ID}`
- Multiple accounts: `multi:{sorted account IDs}`
- Fallback: `unknown`

### 3.4 Receipt Allocation Parser

| Function | Purpose |
|---|---|
| `parseReceiptAllocations(pdfText)` | Parses service allocations from receipt PDF text |

**Two-Pass Parsing**:
1. **Primary**: Regex `(.+?)\s{2,}(-?[\d, ]+\.\d{2})` — label + amount separated by 2+ spaces
2. **Fallback**: Label-on-one-line, amount-on-next-line pattern
3. **Last resort**: If no allocations found but tender amount exists → single "Consumer Services" entry

**Skip Labels**: `total`, `tender amount`, `change`, `outstanding balance`, `vat`, `receipt no`, etc.
**Multi-line Service Names**: Detects known suffixes (`basic`, `metered`, `charge`, `disposal`, `rates`, etc.) and concatenates with preceding label.

### 3.5 Utility Functions

| Function | Purpose |
|---|---|
| `stripHtml(text)` | Strips HTML from API error responses (max 300 chars) |
| `handlePlatinumResult(res, data)` | Standard response handler — surfaces `_error` and `isSuccess=false` |

### 3.6 Permission Middleware

| Function | Purpose |
|---|---|
| `requireDebtPermission(session, permission, res)` | Checks user has specific debt permission (or ADMIN) |
| `requireLegalAdmin(session, res)` | Checks superUser or LEGAL_ADMIN/COMPLIANCE_ADMIN/DEBT_ADMIN |

**Debt Permission Constants**:
```
PROCESS_SECTION129, AUTHORISE_SECTION129, HANDOVER_PROCESS,
AUTHORISE_HANDOVER, SECTION129_REPORT, HANDOVER_REPORT, SMS_LOG_REPORT
```

### 3.7 Audit Field Injection

| Function | Signature | Purpose |
|---|---|---|
| `injectAuditFields(session, body, options?)` | Merges `capturerID`, `dateCaptured`, `modifierID`, `dateModified` | Standard audit metadata |

**Options**:
- `isReview: true` → adds `reviewerID`, `reviewDate`
- `isTermination: true` → adds `statusID`, `comment`

---

## 4. ROUTE REGISTRATION

### 4.1 File Overview
- **Path**: `server/routes/index.ts`
- **Lines**: 36
- **Purpose**: Central registration of all 13 route modules

### 4.2 Registration Order

| Order | Module | Registration Function |
|---|---|---|
| 1 | Auth | `registerAuthRoutes` |
| 2 | POS | `registerPosRoutes` |
| 3 | Billing | `registerBillingRoutes` |
| 4 | Clearance | `registerClearanceRoutes` |
| 5 | Enquiries | `registerEnquiriesRoutes` |
| 6 | Day-End | `registerDayendRoutes` |
| 7 | Deposits | `registerDepositsRoutes` |
| 8 | Supervisor | `registerSupervisorRoutes` |
| 9 | Receipts | `registerReceiptsRoutes` |
| 10 | Debt | `registerDebtRoutes` |
| 11 | Legal | `registerLegalRoutes` |
| 12 | Communications | `registerCommunicationsRoutes` |
| 13 | Analytics | `registerAnalyticsRoutes` |

### 4.3 Route File Pattern
All route modules follow the same pattern:
```typescript
export function registerXxxRoutes(app: Express, httpServer: Server): void {
  const router = Router();
  // ... route handlers using requireAuth + platinum* proxy functions
  app.use('/api/platinum/xxx', router);
}
```

---

## 5. DATABASE LAYER

### 5.1 Shared Schema
- **Path**: `shared/schema.ts`
- **Lines**: 81
- **ORM**: Drizzle ORM with `drizzle-zod` for insert schemas

**Tables**:
| Table | Columns | Purpose |
|---|---|---|
| `users` | `id` (UUID PK), `username`, `password` | Local user accounts |
| `cashierSessions` | `id` (UUID PK), `cashierId`, `cashierName`, `cashOfficeId`, `cashOfficeName`, `floatAmount`, `startedAt`, `endedAt`, `status` | Cashier session tracking |
| `transactions` | `id` (UUID PK), `receiptNumber`, `sessionId`, `cashierId`, `cashierName`, `cashOfficeId`, `totalAmount`, `cashAmount`, `cardAmount`, `chequeAmount`, `tenderAmount`, `changeAmount`, `paymentType`, `status`, `cancellationReason`, `items` (JSONB), `createdAt` | Payment transaction records |
| `conversations` | `id` (serial PK), `title`, `createdAt` | AI chat conversations |
| `messages` | `id` (serial PK), `conversationId`, `role`, `content`, `createdAt` | AI chat messages |

**Schema Pattern**: `users`, `cashierSessions`, and `transactions` have `createInsertSchema` + `InsertType` + `SelectType`. `conversations` and `messages` define only the table (no insert schemas or exported types).

### 5.2 Database Connection
- **Path**: `server/db.ts`
- **Lines**: 13
- **Driver**: `pg.Pool` with `DATABASE_URL` environment variable
- **Export**: `db` (Drizzle instance) and `pool` (raw pg Pool)

### 5.3 Storage Interface
- **Path**: `server/storage.ts`
- **Lines**: 126
- **Interface**: `IStorage` — CRUD operations for `users`, `cashierSessions`, `transactions`
- **Implementation**: `DatabaseStorage` class using Drizzle queries
- **Status**: **NOT USED BY ROUTE HANDLERS** — No route handler in `server/routes/` imports or calls `storage`. All live feature data comes from Platinum API exclusively. However, `server/db.ts` IS actively imported by `server/replit_integrations/chat/storage.ts` for the AI chat feature (conversations/messages tables).

---

## 6. STATIC SERVING & DEV TOOLING

### 6.1 Static File Server
- **Path**: `server/static.ts`
- **Lines**: 35
- **Purpose**: Production-only Angular build serving
- **Build Directory Search Order**:
  1. `angular-client/dist/angular-client/browser` (relative to `__dirname`)
  2. `angular-client/dist/angular-client/browser` (relative to `cwd`)
  3. `server/public`
  4. `dist/public`
- **Cache Control**: `no-store, no-cache, must-revalidate` (prevents stale deployments)
- **SPA Fallback**: `/{*path}` → `index.html` (Angular handles client-side routing)
- **Activation**: Only in `NODE_ENV=production`

### 6.2 Vite Dev Server (Legacy)
- **Path**: `server/vite.ts`
- **Lines**: 58
- **Purpose**: Vite HMR middleware for React client (from initial scaffold)
- **Status**: **NOT USED** — The project uses Angular CLI (`ng serve`) for development, not Vite. This file is a remnant of the initial Replit template. Not imported by `server/index.ts` in the current codebase.

### 6.3 Dev Proxy Configuration
- **Path**: `angular-client/proxy.conf.json`
- **Content**: `{ "/api": { "target": "http://localhost:3000", "secure": false, "changeOrigin": true } }`
- **Purpose**: Angular dev server (port 5000) proxies all `/api/*` requests to Express (port 3000)

### 6.4 Workflow Configuration
- **Command**: `concurrently "NODE_ENV=development PORT=3000 tsx server/index.ts" "cd angular-client && npx ng serve --host 0.0.0.0 --port 5000 --proxy-config proxy.conf.json" --names server,angular --prefix-colors blue,green`
- **Processes**: Express (blue) + Angular CLI (green)
- **Build Time**: Angular compilation takes ~22 seconds after restart

---

## 7. MULTI-SITE CONFIGURATION

### 7.1 Site Definitions

| Site ID | Name | API URL | DB Name |
|---|---|---|---|
| `george` | George Municipality | `https://georgeplatinumuatapi.azurewebsites.net` | `George` |
| `site02` | Inzalo EMS (Site02) | `https://test-ems-site02-token-api.azurewebsites.net` | `Site02` |

### 7.2 Site Resolution
- Default site: `george`
- Site stored in `UserSession.siteId`
- `getApiUrlForSession(session)` resolves site → API URL
- `getDbNameForSession(session)` resolves site → DB name
- All proxy functions (`platinumGet`, etc.) use session-aware URL resolution

### 7.3 Site-Specific Features
| Feature | Implementation |
|---|---|
| Theme | `theme-site02` CSS class on `<html>` |
| Logo | `/images/platinum-logo.png` (George) or `/images/inzalo-ems-logo.png` (Site02) |
| Navigation | Same nav structure for both sites |
| API routing | All requests route to site-specific Platinum API URL |

---

## 8. SECURITY & PERFORMANCE

### 8.1 Security Measures

| Measure | Implementation |
|---|---|
| Session secret | Random 32-byte hex (or env var) |
| Cookie security | httpOnly, secure (prod), sameSite: lax |
| Trust proxy | Level 1 (single reverse proxy) |
| Auth check | Every route handler calls `requireAuth()` |
| Debt permissions | Role-based via `requireDebtPermission()` |
| Legal admin | SuperUser or specific admin roles |
| Audit trail | `injectAuditFields()` on all write operations |
| Payment dedup | 15s window prevents double-submit |
| Token refresh | Automatic with <60s remaining |
| Lockout protection | Backoff cache prevents extending API lockouts |
| HTML stripping | API error responses sanitized before forwarding |

### 8.2 Performance Measures

| Measure | Implementation |
|---|---|
| Response cache | 30s TTL, 500 entry limit, LRU eviction |
| In-flight dedup | Same URL shares single Promise |
| Concurrency limit | 20 max concurrent Platinum API requests |
| User cache | 1hr TTL prevents repeated user lookups |
| Preload modules | Angular preloads all lazy chunks after initial load |
| No-cache static | Prevents stale deployment assets |
| Body size limit | 10MB prevents oversized payloads |
| Request timeouts | 30s default, configurable per-call |
| Streamed user lookup | Aborts at 5MB to prevent memory exhaustion |

---

## 9. INFRASTRUCTURE OBSERVATIONS

### 9.1 File Usage Status
| File | Status | Notes |
|---|---|---|
| `server/vite.ts` | Legacy/unused | Vite HMR setup from React scaffold. Not imported anywhere. Safe to remove. |
| `server/storage.ts` | Unused by routes | `DatabaseStorage` class is instantiated but never called by any route handler. All feature data from Platinum API. |
| `server/db.ts` | Active (chat) | Database connection pool. Not used by route handlers, but actively imported by `server/replit_integrations/chat/storage.ts` for AI chat persistence. |
| `shared/schema.ts` | Active (chat) | `users`, `cashierSessions`, `transactions` tables not populated by routes. `conversations`/`messages` tables actively used by AI chat integration. |

### 9.2 `%2F` URL Encoding Fix
All `URLSearchParams` outputs in `platinumGet`/`platinumPost`/etc. apply `.replace(/%2F/gi, '/')` to prevent Platinum API rejecting encoded forward slashes in parameter values. This is a critical workaround applied across all proxy functions.

### 9.3 Error Response Pattern
All Platinum proxy functions return errors as: `{ _error: true, status: number, statusText: string, detail: string }`
The `handlePlatinumResult()` middleware converts these to proper HTTP responses with the original status code.

### 9.4 Token User Override
When `createTokenAzure` returns a generic user (ID: 1), the system falls back to hardcoded user "Francois Naude" (user_ID: 213). This is a UAT workaround — in production, the API should always return the correct user identity.

### 9.5 No Database Session Store
Express sessions use the default in-memory store (no `connect-pg-simple` or similar). This means:
- Sessions are lost on server restart
- Not suitable for multi-instance deployment without adding a persistent store
- Current single-instance deployment is acceptable

### 9.6 Bundle CORS Endpoint
`GET /dist/bundle.js` is served with permissive CORS headers — this is for external embedding of the POS widget. Includes 1-hour cache and OPTIONS preflight support.

---

**END OF DOCUMENT**

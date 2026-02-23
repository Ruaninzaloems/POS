# Municipal POS Receipting System V2

## Overview

This project is a **Municipal Point-of-Sale (POS) Receipting System** prototype, a React/Express/PostgreSQL web application serving as a unified cashier interface for various municipal payments. It handles consumer services, multi-account payments, prepaid recharges, direct income, clearance, and direct deposit allocations. The system is designed to demonstrate business logic, UI flows, and data models for a future Angular production environment.

Key capabilities include:
- A unified POS screen that auto-detects transaction types.
- Split payments (cash + card) with change calculation on the cash portion.
- Enforcement of a single active session per cashier.
- Concurrency-optimized for 10+ simultaneous users with token mutex, server-side response caching, request concurrency limiting, and frontend in-flight deduplication.
- All transaction storage handled via the Platinum API, not locally, ensuring data consistency for day-end reconciliation.
- Cashier session management, float tracking, and day-end reconciliation.
- Supervisor dashboard for transaction oversight and approvals.
- Direct deposit allocation (manual and bulk).
- Receipt management (print, email, SMS) and permit/certificate generation.
- Client Communications module for custom email/SMS sending with account search, contact detail pulling, file attachments (schema only — no actual sending; ready for Angular migration with Mimecast integration).
- Send Statements feature in Enquiries — select period range, pick email/mobile recipients from account data (including additional emails), preview message, and queue for delivery via Mimecast (email) or SMS Gateway (both not yet connected; payload logged for Angular migration).
- Integration with Platinum Inzalo EMS API and legacy Sebata Billing microservices for live account data.
- Comprehensive contextual tooltips throughout all pages via a reusable `HelpTip` component (`client/src/components/ui/help-tip.tsx`) wrapping shadcn Tooltip, providing inline help for every major UI element.
- Smart category-based icons for Direct Income items via keyword matching (`client/src/lib/category-icons.ts`), mapping 35+ municipal categories (building, fire, water, parks, etc.) to unique Lucide icons with distinct colors.

## User Preferences

Preferred communication style: Simple, everyday language.

### Test Cashier
- **Cashier Name**: Francois Naude
- **User ID**: 213
- **Cashier ID**: 31922 (POS cashier record)
- **Cash Office**: George - York Street (ID: 1)

## System Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript, using Vite.
- **Routing**: `wouter` for lightweight routing.
- **Styling**: Tailwind CSS with `shadcn/ui` (Radix UI primitives).
- **State Management**: React Context API (`PosProvider`) manages session state, cart, payments, cashier profile, and history.
- **Data Fetching**: TanStack React Query with a custom `apiRequest` helper.
- **UI Components**: Separated into generic `shadcn/ui` components and business-specific POS components.
- **Key Patterns**: Business logic (`pos-logic.ts`, `allocation-logic.ts`) is separated from UI. No `localStorage` is used; all data is API-driven. A `PosLayout` component provides a consistent layout and enforces cashier session gating.

### Backend (Express + Node.js)
- **Framework**: Express 5 with TypeScript.
- **API Pattern**: RESTful routes.
- **Proxy Layer**: Proxies requests to Platinum Inzalo EMS API (authenticated via JWT for POS operations) and legacy Sebata Billing API (unauthenticated OData for backward compatibility).
- **Session Management**: `express-session` with in-memory store holds per-user browser sessions (cookie-based). Each user's Platinum JWT token, userData, posCashierId, and authMode are stored in `req.session.platinumAuth` (type `UserSession`). This enables 50+ concurrent users without session cross-contamination. NO local database is used — the Platinum API is the sole authority for authentication and all data.
- **Concurrency**: Global request queue limits concurrent Platinum API calls to 100. Response cache is user-aware: user-specific paths (validate-cashier, payment-options, etc.) are keyed by userId, shared data (BillingEnquiry) uses URL-only keys.
- **Serving**: Serves production builds statically; uses Vite middleware for development.
- **No Local Database for Business Data**: All transaction storage, cashier sessions, account data, receipts, day-end reconciliation, and every other business operation is handled exclusively via the Platinum API. The local PostgreSQL database is NOT used at all. Local database schemas (`storage.ts`, `db.ts`, `shared/schema.ts`) are dead code — never called from routes or client.

### Database (PostgreSQL)
- **Purpose**: The local database is NOT used for any business logic or session storage. All persistence goes through the Platinum API exclusively.
- **Legacy code**: `shared/schema.ts`, `server/storage.ts`, `server/db.ts` define unused tables (`users`, `cashier_sessions`, `transactions`). These are dead code kept for reference only.

### Key Business Logic Decisions
- **Rounding**: Transaction totals are rounded up to the nearest 10 cents.
- **Change Calculation**: Only on the cash portion: `max(0, cash - (total - card))`.
- **Transaction Types**: Six types auto-detected: Consumer Services, Multi-Account, Account Group, Prepaid, Direct Income, Clearance.
- **Day-End Process**: Cashiers submit cash counts, supervisors approve.
- **Cancellation Workflow**: Cashiers request, supervisors approve/cancel.
- **Payment Validation**: Cashier payment options/types are validated against Platinum API endpoints (`/api/billing-payment/payment-options`, `/api/billing-payment/payment-types`).
- **Receipt Range Validation**: Verified via `/api/platinum/receipt-prepaid/validate-receipt-range` before payment processing.
- **Session Detection**: Uses `/api/ReceiptPrepaid/validate-cashier` as the single source of truth for cashier session status (`isActive` field). Auto-resume and session enforcement are based on this.
- **Payment Submission**: For single account, uses `submit-consumer-payment/{userId}`. For multiple accounts (2+), uses `submit-multiple-payment/{userId}` with `{ accounts: [...], requestModel: {...} }` in a single API call. For split payments (cash + card), two separate rounds are made (paymentType 1 for cash, 3 for card), each using the appropriate single/multiple endpoint based on account count. Each round creates separate DB entries with its own `print-receipt` call.
- **Pre-Payment Session Check**: Before ANY payment processing, validate-cashier is called to verify the session is still active. Payment is BLOCKED if session is inactive or API fails.

## External Dependencies

### External APIs
-   **Platinum Inzalo EMS API** (`georgeplatinumuatapi.azurewebsites.net`):
    -   Handles all core POS operations (payments, prepaid, clearance, day-end, direct deposits, etc.).
    -   Authenticated via JWT tokens; `server/platinum-auth.ts` manages token refresh.
    -   Environment variables: `PLATINUM_API_PASSWORD`, `PLATINUM_API_USERNAME`, `PLATINUM_API_DBNAME`.
    -   Key endpoint groups: `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, `BillingDashboard`.
    -   **Critical Payment Flow**: `save-multiple-account-payment` → `submit-consumer-payment/{userId}` (per account) → `print-receipt` → `pos-multi-receipt-print` (for structured receipt data).
    -   Payment Type IDs: 1=Cash, 3=Credit Card (critical for split payments). Payment Option (e.g., 1 for Consumer Services) is distinct from Payment Type.
    -   Cashier setup and session status are managed through specific Platinum endpoints.
    -   **Direct Deposit Allocation**: `submit-details-data` endpoint. Processing order: Consumer Services (ACCOUNT, billType "1") → Payment Grouping (GROUP, billType "3") → Clearance (billType "6") → Misc/Direct Income (DIRECT, billType "4") → Cashbook Return (skipped). Each line submitted individually. Mandatory fields: posItemId, reconId, userId, financialYear, transactionDate, paidAmount, billType, accountId.
-   **Sebata Billing Microservice** (`george-uat-ems-billing-api.azurewebsites.net`):
    -   Legacy OData-based API for consumer account data and billing configuration.
    -   Accessed via server-side proxy routes (`/api/proxy/`).

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: Comprehensive UI component library.
-   `TanStack React Query`: Server state management.
-   `date-fns`: Date utilities.
-   `react-to-print`: Printing functionality.

### Build Tools
-   `Vite`: Frontend bundler.
-   `esbuild`: Server bundler.
-   `tsx`: TypeScript execution for development.
-   `drizzle-kit`: Database schema management (for the unused local database).

### Web Component / Angular Integration
-   `client/src/web-component.tsx`: Custom Element (`<pos-app>`) wrapping the React App with Shadow DOM for style isolation.
-   `client/src/mount.ts`: Exports `render(container, props)` function for Angular to mount the app into any DOM element.
-   `vite.config.lib.ts`: Library build config producing a single ES module bundle with all CSS inlined.
-   Build command: `npx vite build --config vite.config.lib.ts` → output: `dist/bundle.js`.
-   The server serves `dist/bundle.js` at `/dist/bundle.js` with CORS enabled (`Access-Control-Allow-Origin: *`) so Angular apps can fetch it remotely.
-   Local database (`storage.ts`, `db.ts`) is dead code — never called from routes or client. All persistence uses Platinum API.

### MANDATORY Development Rules (Web Component / Angular Embedding)
All new code MUST follow these rules to keep the app embeddable in Angular:
1.  **ReactDOM.createRoot in connectedCallback()** — The Custom Element creates the React root inside `connectedCallback()`. Never call `createRoot` outside the web component lifecycle.
2.  **HTML Attributes as Props** — `api-base-url` and `auth-token` are accepted as HTML attributes on `<pos-app>`, mapped into `PosConfigProvider` context, and consumed by all API calls via `resolveApiUrl()` and `getAuthHeaders()`.
3.  **Single File Build** — `vite.config.lib.ts` uses `inlineDynamicImports: true` and `cssCodeSplit: false` to produce exactly ONE `dist/bundle.js` (ES module) with no chunks.
4.  **CSS Scoped via Shadow DOM** — All styles (Tailwind + custom) are loaded via `?inline` import and applied to the Shadow DOM using `adoptedStyleSheets`. No global `:root` or `body` styles leak to the Angular parent.
5.  **All fetch() calls go through `apiFetch()` or `resolveApiUrl()`** — Every API call in `external-api.ts`, `enquiries-service.ts`, `queryClient.ts`, and `App.tsx` uses the centralized URL resolver and auth header injector. Raw `fetch('/api/...')` calls are prohibited.
6.  **No localStorage / sessionStorage** — All state comes from APIs.
7.  **No local database writes** — `storage.ts` and `db.ts` are dead code. All persistence goes through Platinum API.
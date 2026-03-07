# Municipal POS Receipting System V2

## Overview

This project is a **Municipal Point-of-Sale (POS) Receipting System** prototype, implemented as a React/Express/PostgreSQL web application. It provides a unified cashier interface for various municipal payments, including consumer services, multi-account payments, prepaid recharges, direct income, clearance, and direct deposit allocations. Its primary purpose is to validate business logic, UI flows, and data models for a future Angular production environment.

Key capabilities include a unified POS screen with automatic transaction type detection, split payments, cashier session management, float tracking, day-end reconciliation, supervisor dashboard, direct deposit allocation, receipt management (print, email, SMS), permit/certificate generation, and a Client Communications module. The system is designed for high concurrency and integrates exclusively with the Platinum Inzalo EMS API for all real-time account data access.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + TypeScript)
The frontend uses React 18 with TypeScript, Vite, and `wouter` for routing. Tailwind CSS with `shadcn/ui` handles styling, and state management uses the React Context API (`PosProvider`). Data fetching is managed by TanStack React Query with a custom `apiRequest` helper. The architecture separates business logic from UI components, with all data being API-driven.

### Backend (Express + Node.js)
The backend is an Express 5 application with TypeScript, serving as an authenticated proxy to the Platinum Inzalo EMS API. It uses `express-session` for user session management, storing JWT tokens and user data. Concurrency features include a global request queue, user-aware response caching, and in-flight GET request deduplication. The backend does not use a local database for business data; all operational data is managed through the Platinum API.

### Database (PostgreSQL)
A local PostgreSQL database is present but **explicitly not used** for any business logic or data persistence. All operational data is handled by the Platinum API.

### Web Component / Angular Integration
The React application is designed as a self-contained Web Component (`<pos-app>`) for seamless embedding into existing Angular applications. It uses Shadow DOM for style isolation and routes all API calls through a centralized URL resolver, adhering to strict integration guidelines.

### Design System — Colour Palettes & CSS Variables
The application supports multi-site theming via CSS custom properties. An accent color system uses variables like `--pos-accent` and `--pos-accent-dark`, which are set in `:root` for the Platinum/George theme (peach palette) and overridden for Inzalo EMS (teal palette). All components reference these variables for automatic theme switching. Hardcoded color values are to be avoided in components.

### Page Layout Standards
All pages maintain a consistent layout with a sticky header (icon, title, description) and a scrollable content area. This includes full-width content, full-height layout, consistent header styling, specific background colors for content areas, and predefined styles for cards, stat cards, and empty states.

### MANDATORY: API Is The Single Source Of Truth
The Platinum Inzalo EMS API is the single source of truth for all data. This entails:
- No fallbacks, mock data, or hardcoded values for business data.
- All data displayed or processed must come exclusively from the Platinum API.
- Explicit failure and clear error states if an API call fails; no silent error handling.
- Frontend validation of API responses.
- Errors must be visible in the UI and logged.
- No construction or derivation of business data (e.g., financial year, configuration data); it must all come from the API.
- Protocol constants and loading state placeholders are acceptable exceptions.
- API bugs are to be documented and reported, not worked around with fallbacks.

### Direct Deposit Allocation
Direct deposit manual allocations pass `userId`, `cashierId`, and `cashOfficeId` in the `submit-details-data` payload. The server **always** resolves all three from the authenticated session and `validate-cashier` API — client-provided values are overwritten for security. If `cashierId` cannot be resolved, the server returns HTTP 400 and does not call Platinum. The field `paymentReference` (not `reference`) is the correct API field name for generic imports. `paymentTypeId` must always be included (read from request, not defaulted by API). `/direct-deposits` paths are exempt from active cashier session enforcement. The allocation submission order is: Account/Prepaid → Group → Clearance → Direct Income → Cashbook. Group payments use billType "1" (Consumer Services). The POS uses billTypes `"1"` (Consumer Services), `"4"` (Miscellaneous), and `"6"` (Clearance). The allocation search includes scoped tabs for various categories, with Institution search allowing discovery and allocation to linked accounts.

### Generic Import (Direct Deposit Allocation)
A "Generic Import" tab allows uploading CSV files for generic direct deposit allocation via the Platinum API. The process involves Upload → Preview & Validate (with progress bar) → Confirm & Submit → Processing (polling) → Results. No row limit — supports 10,000+ rows. The upload form includes file upload, receipt date, payment method, and a "Post to Cashbook" toggle. CSV is parsed client-side into a `payments` array. The API payload matches the Platinum spec: `{ cashOfficeId, cashierId, userId, finYear, postToCashbook, payments: [{ receiptDate: "dd/MM/yyyy", accountNumber: "000000013088", amount: 300.00, paymentTypeId: 1 }] }`. Account numbers are zero-padded to 12 digits. Receipt dates use `dd/MM/yyyy` format. The API response returns `{ isSuccess, jobId, message, totalCount }`. Server proxy routes handle submission, status polling, and result/error retrieval via the `billing-direct-deposit-allocation` Platinum API.

**Validation uses three statuses**: `valid` (matched via `cons-accounts` API), `unverified` (API returned 500/error — account may still exist, submittable), and `invalid` (format errors like empty account, bad date, zero amount — excluded from submission). Both matched and unverified rows are submitted to Platinum, which does its own validation during processing. The preview step validates in batches of 50 rows with a live progress bar showing parsing → API validation → building preview. Only rows with true format errors are blocked.

### Account Enquiry Dialog
A reusable `AccountEnquiryDialog` component provides a pop-out dialog with full account enquiry tabs (Account, Balance/Debt, Transactions, Services, Property). It searches for accounts via `searchAccounts` and renders enquiry tabs inside a large modal. It is integrated into `view-receipts.tsx` and does not require an active cashier session.

## External Dependencies

### Multi-Site Support
The application supports multiple EMS sites, each with its own API endpoint and visual branding. Site selection occurs at login, and the API base URL is managed per-session. Currently configured sites include **George Municipality** and **Inzalo EMS (Site02)**.

### External APIs
-   **Platinum Inzalo EMS API** (multi-site): This is the central dependency for all core POS operations, including payments, prepaid services, clearance, day-end processes, and direct deposits. It handles authentication via JWT tokens and integrates modules like `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, and `BillingDashboard`.

### Receipt Number Resolution
When a payment is submitted, the Platinum API returns a receipt ID. The real EMS receipt number is fetched via `pos-multi-receipt-print`. If that API fails, the system falls back to querying the unreconciled list (`cashier-receipt-unreconciled-list`) to find the correct `receiptNo`. This fallback applies to consumer services, clearance, and miscellaneous/direct income payment paths.

### Receipt Processing Performance Optimizations
Post-payment receipt flow is optimized for speed by:
- Removing `platinumPrintReceipt()` from the payment processing flow; actual PDF printing occurs on user action via `platinumPrintReceiptRaw()`.
- Parallelizing unreconciled list lookup with receipt data fetching.
- Optimizing unreconciled list strategy by prioritizing `userId` and then `cashierId`.
- Reducing retries for receipt data fetches.
- Suppressing session polling during `transactionProcessing`.
- Passing receipt numbers to the print API for first prints and reprints.

### Multi-Account Payment Timeout Scaling
For large batch payments (e.g., 149 accounts), timeouts scale dynamically at all three layers:
- **Server proxy**: `Math.max(60000, accounts × 8000)` ms passed to Platinum API call.
- **Client API call** (`submitMultiplePayment`): Same formula with AbortController.
- **Receipt modal watchdog**: `BASE_TIMEOUT_SECONDS` (120s) for ≤5 items; `items × 8s` for 6-25 items; for chunked batches (>25): `ceil(chunks/MAX_CONCURRENT) × PER_CHUNK_TIMEOUT_SECONDS (120s) + 30s` buffer. Previously hardcoded at 120s/45s, which force-failed large batches before the API could respond. Platinum takes ~85-100s per 25-account batch. Footer warning shows elapsed time and max duration estimate for large batches.

### Chunked Parallel Multi-Account Payments
When a multi-account payment exceeds `CHUNK_SIZE` (25 accounts), submissions are split into parallel batches:
- Accounts are divided into chunks of 25.
- Up to `MAX_CONCURRENT` (3) chunks are submitted in parallel via `Promise.all`.
- Each chunk gets its own `requestModel` with proportional `totalAmount`, `tenderAmount` = chunk total (no change), `changeAmount` = 0.
- Progress updates show completed batches and account counts.
- Partial failure handling: if some batches fail but others succeed, the user is warned with receipt IDs from successful batches and told to check View Receipts. The error message surfaces the first failure reason.
- For 149 accounts: 6 chunks × 2 rounds (3 concurrent) ≈ 60-90s total instead of 10-20 minutes with a single API call.
- Small batches (≤25 accounts) still use a single `submitMultiplePayment` call as before.

### Day-End Reconciliation Status Flow
The day-end process uses these statuses: `NOT_SUBMITTED` (or "Not Yet Submitted"), `PENDING_APPROVAL` ("Submitted"), `RETURNED`, and `COMPLETED`. The cashier submits via 3 API steps: save-reconcile-data → validate-cashbook → submit-day-auth-reconcile. The supervisor approves via: validate-cashbook → submit-day-auth-reconcile → finish-day-end-reconcile. Returns use `return-day-end-reconcile` with `{ id, returnReason }`. The server's active-cashier endpoint checks the reconcile record's status field to distinguish pending vs returned — `hasDayEndReturned` keeps the session active so the cashier can re-submit, while `hasPendingDayEnd` blocks the session. Status mapping must check "not yet submitted" and "return" before "submit" to avoid misclassification. `session.dayEndPending` is a fallback flag only set on successful submit, cleared when reconcile is returned or completed. `reconcileIsPending` is true only when a reconcile record exists with a non-terminal status. Per-office reconciliation follows: add-stage → process-staging → verify-cashier → submit-reconcile → finish-stage.

### SA 10c Cash Rounding
Cash payments must be rounded UP to the nearest 10c (SA standard). Card payments are exempt. Implementation:
- `pos-logic.ts` `calculateTransactionTotals()` rounds `totalToPay` up for cash-only display/change calculation.
- `payment-drawer.tsx` `cashRoundingInfo` detects when the raw basket total doesn't end in 0c and shows a warning banner with a one-click "Round up to R X.X0" button.
- The COMPLETE button is blocked (`!cashRoundingInfo`) until the cashier applies rounding, which adjusts the first basket item's `amountToPay` and auto-updates cash tender.
- Silent auto-rounding was removed from `processTransaction` in `pos-state.tsx` — rounding is now always explicit and user-initiated.
- Double-click guard via `roundingApplied` state prevents over-rounding.

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: For robust and customizable UI components.
-   `TanStack React Query`: For efficient server state management.
-   `date-fns`: For date manipulation.
-   `react-to-print`: For client-side printing.
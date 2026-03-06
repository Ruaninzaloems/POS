# Municipal POS Receipting System V2

## Overview

This project is a **Municipal Point-of-Sale (POS) Receipting System** prototype, implemented as a React/Express/PostgreSQL web application. It aims to provide a unified cashier interface for various municipal payments, including consumer services, multi-account payments, prepaid recharges, direct income, clearance, and direct deposit allocations. The primary purpose is to validate business logic, UI flows, and data models for a future Angular production environment.

Key capabilities include a unified POS screen with automatic transaction type detection, support for split payments, comprehensive cashier session management, float tracking, day-end reconciliation, and a supervisor dashboard. It also features robust direct deposit allocation, receipt management (print, email, SMS), permit/certificate generation, and a Client Communications module. The system is designed for high concurrency and integrates exclusively with the Platinum Inzalo EMS API for all real-time account data access.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + TypeScript)
The frontend uses React 18 with TypeScript, powered by Vite, and `wouter` for routing. Styling is handled by Tailwind CSS, leveraging `shadcn/ui` for components. State management relies on the React Context API (`PosProvider`), and data fetching is done via TanStack React Query with a custom `apiRequest` helper. The architecture emphasizes separating business logic from UI components, with all data being API-driven. Error handling is robust, ensuring critical failures block session initialization.

### Backend (Express + Node.js)
The backend is an Express 5 application with TypeScript, acting as an authenticated proxy to the Platinum Inzalo EMS API. It uses `express-session` for user session management, storing JWT tokens and user data. Concurrency is managed through a global request queue, user-aware response caching, and in-flight GET request deduplication. Importantly, the backend does not use a local database for business data; all operational data is managed through the Platinum API.

### Database (PostgreSQL)
A local PostgreSQL database is present but **explicitly not used** for any business logic or data persistence. All operational data is handled by the Platinum API.

### Web Component / Angular Integration
The React application is designed as a self-contained Web Component (`<pos-app>`) for seamless embedding into existing Angular applications. It utilizes Shadow DOM for style isolation and routes all API calls through a centralized URL resolver. It adheres to strict guidelines for integration, including configuration via HTML attributes and generating a single ES module bundle.

### Design System — Colour Palettes & CSS Variables
The application supports multi-site theming via CSS custom properties defined in `index.css`. The accent color system uses `--pos-accent`, `--pos-accent-dark`, `--pos-accent-light`, `--pos-accent-shadow`, `--pos-accent-tint`, and `--pos-accent-tint-strong` variables. These are set in `:root` for the Platinum/George theme (peach palette) and overridden in `.theme-site02` for Inzalo EMS (teal palette). All component files reference these variables (e.g., `from-[var(--pos-accent)]`, `text-[var(--pos-accent)]`) instead of hardcoded hex values, so theme switching is fully automatic via the CSS class on `<body>`.

| Variable | George (default) | EMS Site02 |
|---|---|---|
| `--pos-accent` | `#E6A57E` | `#2FB5AD` |
| `--pos-accent-dark` | `#D18E65` | `#249E97` |
| `--pos-accent-light` | `#F0C3A7` | `#8DD8D3` |
| `--pos-accent-shadow` | `rgba(230,165,126,0.20)` | `rgba(47,181,173,0.20)` |
| `--pos-accent-tint` | `rgba(240,195,167,0.20)` | `rgba(47,181,173,0.15)` |
| `--pos-accent-tint-strong` | `rgba(240,195,167,0.30)` | `rgba(47,181,173,0.25)` |

**Important:** Do NOT hardcode `#E6A57E`, `#D18E65`, or `#F0C3A7` in component files. Always use the CSS variable equivalents. Only the login page's site-specific config and pos-layout's header overlay retain hardcoded Site02 teal values behind `isSite02` conditionals (structural, not color-only differences).

### Page Layout Standards
All pages follow a mandatory, consistent layout comprising a sticky header with an icon, title, and description, and a scrollable content area. Key rules include full-width content (no `max-w-* mx-auto`), full-height layout, consistent header styling, specific background colors for content areas, and predefined styles for cards, stat cards, and empty states.

## External Dependencies

### Multi-Site Support
The application is designed to support multiple EMS sites, each with its own API endpoint and visual branding. Site selection occurs at login, and the API base URL is managed per-session. Currently configured sites include **George Municipality** and **Inzalo EMS (Site02)**, each with distinct API URLs and theme classes.

### External APIs
-   **Platinum Inzalo EMS API** (multi-site): This is the central dependency, providing all core POS operations such as payments, prepaid services, clearance, day-end processes, and direct deposits. It handles authentication via JWT tokens and integrates key modules like `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, and `BillingDashboard`.

### Receipt Number Resolution
When a payment is submitted, the Platinum API returns a receipt ID (e.g., `1239092`). The real EMS receipt number (e.g., `27022026/460001`) is fetched via `pos-multi-receipt-print`. If that API returns a 500 error (known Platinum bug), the system falls back to querying the unreconciled list (`cashier-receipt-unreconciled-list`) to find the correct `receiptNo` for that receipt ID. This fallback is applied in all three payment paths: consumer services, clearance, and miscellaneous/direct income. The `receipt-template.tsx` also uses `transaction.receiptNumber` directly instead of fabricating a number.

### Receipt Processing Performance Optimizations
The post-payment receipt flow is optimized for speed:
- **No in-flow print-receipt calls**: The `platinumPrintReceipt()` function (which always failed trying to parse PDF as JSON) was removed from the payment processing flow. Actual PDF printing happens only when the user clicks "Print & Complete" via `platinumPrintReceiptRaw()`.
- **Parallel receipt resolution**: The unreconciled list lookup starts in parallel with the receipt data fetch, rather than sequentially waiting for the receipt fetch to fail first.
- **Optimized unreconciled list strategy**: The server tries `userId` first (the only strategy that works on George) before falling back to `cashierId`-based strategies.
- **Reduced retries**: Receipt data fetch uses 2 retries (down from 3) with shorter linear delays (300ms × attempt).
- **Session polling paused during payment**: The 30-second session enforcement polling is suppressed while `transactionProcessing` is true, preventing interference during active payments.
- **Receipt numbers passed to print API**: The `print-receipt` endpoint now sends `PrintReceiptRequest { Ids, ReceiptNos, IsReprint }` to the Platinum API (capital-case keys). The server's `buildPrintReceiptPayload()` helper constructs this format. Client callers pass `isReprint: true` for reprints (view-receipts, enquiry tabs) and `false`/default for first prints (receipt-modal). All 6 server-side calls to `billing-payment/print-receipt` use this format.

### Direct Deposit Allocation
Direct deposit manual allocations always use `VirtualCashierUserId = -1` as the cashier ID in the Platinum API submission payload. The real logged-in user ID is validated (user must be authenticated) but is only used for audit/logging — not passed to the Platinum API. All `/direct-deposits` paths are exempt from active cashier session enforcement; users can access and process direct deposit allocations without having an open cashier session. The allocation submission order is: Account/Prepaid → Group → Clearance → Direct Income → Cashbook.

### Generic Import (Direct Deposit Allocation)
The Third Party Payment Processing page (`client/src/pages/third-party/payment-processing.tsx`) has a "Generic Import" tab alongside the existing "Third Party Import" tab. This feature allows uploading CSV files for generic direct deposit allocation via the Platinum API. The flow is: **Upload → Processing (polling) → Results**. Four server proxy routes handle the Platinum API integration: `submit-generic-import` (POST, 55s timeout), `generic-import-status/{jobId}` (GET, polled every 3s), `generic-import-results/{jobId}` (GET), and `generic-import-errors/{jobId}` (GET). All routes go through `billing-direct-deposit-allocation` on the Platinum API side. Polling uses a `useRef`-based interval with deterministic cleanup on unmount, tab switch, and new import reset.

### MANDATORY: API Is The Single Source Of Truth
**This is the #1 system design rule. It overrides all other considerations.**

The Platinum Inzalo EMS API must be the single source of truth for ALL data in the system. There are zero exceptions.

#### Core Rules

1. **No fallbacks** — Do not use fallbacks, mock data, hardcoded values, or workarounds anywhere in the application.
2. **API-only data** — All screens, workflows, and calculations must depend only on real API responses. ALL data displayed or processed MUST come exclusively from the Platinum API.
3. **Explicit failure** — If an API call fails, the system must fail explicitly and show a clear error state rather than substituting data or continuing as if the request succeeded. Never silently return default/empty data.
4. **No silent catch blocks** — Every `catch` must either re-throw the error or display an explicit error message to the user. Never swallow errors and return `[]`, `{}`, `null`, or hardcoded defaults. Empty `catch {}` blocks are forbidden.
5. **Response validation** — The frontend must validate API responses and treat missing or malformed data as an error, not as a reason to substitute defaults.
6. **Visible errors** — Errors must be visible in the UI (toast notifications, error states, inline messages) and logged properly to the console for debugging.
7. **No constructed/derived business data** — Don't construct data that should come from the API (e.g. building references from unrelated fields, deriving financial years from the current date).
8. **Financial year from API only** — The user's session provides `platinumUser.finYear` from the login API. If it's missing, the operation must fail with an error — never fall back to a hardcoded year.
9. **Configuration data from API only** — Payment types, payment options, groups, banks, institutions, cashiers — all fetched from API. If the fetch fails, show the error.
10. **No hardcoded display fallbacks** — Do not use patterns like `|| 'Cash Office'` or `|| 'Active'` to mask missing API data. Show the raw value or a dash (`-`) when data is absent.

#### What Is NOT a Fallback

**Protocol constants are acceptable** — Internal mappings like billType codes (`1`=Account, `3`=Group, `4`=Direct, `6`=Clearance), HTTP methods, route paths, API field names, and UI labels for known enum values are structural protocol that define HOW to talk to the API. These are not "data" and are acceptable as code constants.

**Loading state placeholders are acceptable** — Showing "Loading..." or skeleton UI while waiting for an API response is not a fallback. It becomes a violation only if the loading state persists after a failed API call without showing the error.

#### Testing Requirements

- Testing must always include both the success scenario AND the failure scenario.
- Confirm that real API data loads correctly and that when the API fails, the system displays the correct error state without inserting fallback values.
- A feature should only be considered complete once it has been tested against the real API and verified to fail clearly when the API fails.

#### When the API Has a Bug or Missing Feature

- Document the issue in `docs/API_SPEC_Job_Account_Details.md`
- Report it to the Platinum developer with clear test cases
- Do NOT work around it with fallback data

### Account Enquiry Dialog
A reusable `AccountEnquiryDialog` component (`client/src/components/account-enquiry-dialog.tsx`) provides a pop-out dialog with the full account enquiry tab system (Account, Balance/Debt, Transactions, Services, Property, etc.). It accepts an account number/ID, searches for the account via `searchAccounts`, and renders all enquiry tabs inside a large modal. Currently integrated into `view-receipts.tsx` — Bank Statement and EFT by Account tabs show an "Enquiry" button on account allocation rows, and the Receipt Search tab has clickable account numbers. The dialog does not require an active cashier session.

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: For robust and customizable UI components.
-   `TanStack React Query`: For efficient server state management.
-   `date-fns`: For date manipulation.
-   `react-to-print`: For client-side printing.
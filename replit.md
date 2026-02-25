# Municipal POS Receipting System V2

## Overview

This project is a **Municipal Point-of-Sale (POS) Receipting System** prototype, developed as a React/Express/PostgreSQL web application. It aims to provide a unified cashier interface for various municipal payments, including consumer services, multi-account payments, prepaid recharges, direct income, clearance, and direct deposit allocations. The system demonstrates critical business logic, UI flows, and data models for a future Angular production environment.

Key capabilities include:
- A unified POS screen with automatic transaction type detection.
- Split payment functionality (cash + card) with accurate change calculation.
- Enforcement of a single active session per cashier.
- Optimized for concurrency with token mutex, server-side response caching, request concurrency limiting, frontend in-flight deduplication, and server-side GET request deduplication.
- All transaction and session data is managed via the Platinum API, ensuring data consistency for day-end reconciliation.
- Comprehensive cashier session management, float tracking, and day-end reconciliation processes (per-cashier and per-office workflows).
- Supervisor dashboard for transaction oversight and approvals.
- Direct deposit allocation (manual and bulk).
- Receipt management (print, email, SMS) and permit/certificate generation.
- Client Communications module for custom email/SMS sending, account search, and contact detail pulling.
- "Send Statements" feature for selecting date ranges and sending statements via email/SMS.
- Integration with Platinum Inzalo EMS API and legacy Sebata Billing microservices for live account data.
- Contextual tooltips for UI elements via a reusable `HelpTip` component.
- Smart, category-based icons for Direct Income items, mapping over 35 municipal categories to unique Lucide icons.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript, using Vite.
- **Routing**: `wouter`.
- **Styling**: Tailwind CSS with `shadcn/ui` (Radix UI primitives).
- **State Management**: React Context API (`PosProvider`) for session, cart, payments, cashier profile, and history.
- **Data Fetching**: TanStack React Query with a custom `apiRequest` helper.
- **Key Patterns**: Business logic (`pos-logic.ts`, `allocation-logic.ts`) is separated from UI. No `localStorage` is used; all data is API-driven. A `PosLayout` component provides a consistent layout and enforces cashier session gating. The application is designed to be embedded as a web component in an Angular application.

### Backend (Express + Node.js)
- **Framework**: Express 5 with TypeScript.
- **API Pattern**: RESTful routes.
- **Proxy Layer**: Proxies requests to Platinum Inzalo EMS API (authenticated via JWT) and legacy Sebata Billing API (unauthenticated OData).
- **Session Management**: `express-session` with in-memory store for per-user browser sessions. User-specific Platinum JWT tokens and data are stored in `req.session.platinumAuth`.
- **Concurrency**: Global request queue limits concurrent Platinum API calls. Response cache is user-aware.
- **Serving**: Serves production builds statically; uses Vite middleware for development.
- **No Local Database for Business Data**: All business operations, including transaction storage, cashier sessions, account data, receipts, and day-end reconciliation, are handled exclusively via the Platinum API. The local PostgreSQL database is NOT used for operational data.

### Database (PostgreSQL)
- **Purpose**: The local database is **not used** for any business logic or session storage. All persistence is handled by the Platinum API.
- **Legacy code**: `shared/schema.ts`, `server/storage.ts`, `server/db.ts` define unused tables and are considered dead code, kept for reference only.

### Key Business Logic Decisions
- **Rounding**: Transaction totals are rounded up to the nearest 10 cents.
- **Change Calculation**: Applied only to the cash portion of split payments.
- **Transaction Types**: Six types are auto-detected: Consumer Services, Multi-Account, Account Group, Prepaid, Direct Income, Clearance.
- **Day-End Processes**: Detailed per-cashier (8 phases) and per-office (13 phases) workflows via dedicated API controllers (`auth-day-end-reconcile`, `auth-day-end-reconcile-per-office`) manage reconciliation, supervisor approvals, and printing.
- **Cancellation Workflow**: Cashiers request cancellations, which supervisors approve/decline. Supervisors can also directly cancel receipts.
- **Payment Validation**: Cashier payment options, types, and receipt ranges are validated against Platinum API endpoints.
- **Session Detection**: `ReceiptPrepaid/validate-cashier` is the single source of truth for cashier session status, driving auto-resume and session enforcement.
- **Payment Error Handling**: Comprehensive `try-catch` blocks for payment processing, logging errors, showing toast notifications, and marking failed transactions.
- **Transaction History Source**: `platinumGetDayEndUnreconciledList` is the exclusive source for transaction history.
- **Payment Submission**: Uses `submit-consumer-payment` for single accounts and `submit-multiple-payment` for multiple accounts. Split payments involve separate submission rounds for cash and card portions.
- **Pre-Payment Session Check**: A `validate-cashier` call is made before any payment processing to ensure an active session.

### Web Component / Angular Integration
- The React application is designed as a custom web component (`<pos-app>`) for embedding into Angular applications.
- A single ES module bundle (`dist/bundle.js`) is produced with all CSS inlined and scoped via Shadow DOM.
- All API calls use a centralized URL resolver and authentication header injector, with no direct `fetch()` calls.
- No `localStorage` or `sessionStorage` is used; all state is API-driven.

## External Dependencies

### External APIs
-   **Platinum Inzalo EMS API** (`georgeplatinumuatapi.azurewebsites.net`): The primary API for all core POS operations including payments, prepaid services, clearance, day-end processes, direct deposits, and authentication. Managed with JWT tokens and environment variables. Key endpoints include `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, `BillingDashboard`.
-   **Sebata Billing Microservice** (`george-uat-ems-billing-api.azurewebsites.net`): A legacy OData-based API providing consumer account data and billing configuration, accessed via a server-side proxy.

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: UI component library.
-   `TanStack React Query`: Server state management.
-   `date-fns`: Date utilities.
-   `react-to-print`: Printing functionality.

### Build Tools
-   `Vite`: Frontend bundler.
-   `esbuild`: Server bundler.
-   `tsx`: TypeScript execution for development.
-   `drizzle-kit`: Database schema management (for the unused local database reference).
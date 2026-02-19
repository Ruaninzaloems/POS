# Municipal POS Receipting System V2

## Overview

This project is a **Municipal Point-of-Sale (POS) Receipting System** prototype, a React/Express/PostgreSQL web application serving as a unified cashier interface for various municipal payments. It handles consumer services, multi-account payments, prepaid recharges, direct income, clearance, and direct deposit allocations. The system is designed to demonstrate business logic, UI flows, and data models for a future Angular production environment.

Key capabilities include:
- A unified POS screen that auto-detects transaction types.
- Split payments (cash + card) with change calculation on the cash portion.
- Enforcement of a single active session per cashier.
- All transaction storage handled via the Platinum API, not locally, ensuring data consistency for day-end reconciliation.
- Cashier session management, float tracking, and day-end reconciliation.
- Supervisor dashboard for transaction oversight and approvals.
- Direct deposit allocation (manual and bulk).
- Receipt management (print, email, SMS) and permit/certificate generation.
- Client Communications module for custom email/SMS sending with account search, contact detail pulling, file attachments (schema only — no actual sending; ready for Angular migration with Mimecast integration).
- Integration with Platinum Inzalo EMS API and legacy Sebata Billing microservices for live account data.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Serving**: Serves production builds statically; uses Vite middleware for development.
- **Storage Layer**: Implements `IStorage` interface with `DatabaseStorage` using Drizzle ORM, though currently not actively used for persistence as all transactions go to Platinum API.

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM for PostgreSQL.
- **Schema**: Defined in `shared/schema.ts` with Zod validation.
- **Tables**: `users`, `cashier_sessions`, `transactions`.
- **Migrations**: Managed via `drizzle-kit push`.
- **Note**: While a database layer is defined, the system primarily uses external APIs for transaction persistence and session management. The local database code is legacy and not actively used for core transaction/session data.

### Key Business Logic Decisions
- **Rounding**: Transaction totals are rounded up to the nearest 10 cents.
- **Change Calculation**: Only on the cash portion: `max(0, cash - (total - card))`.
- **Transaction Types**: Six types auto-detected: Consumer Services, Multi-Account, Account Group, Prepaid, Direct Income, Clearance.
- **Day-End Process**: Cashiers submit cash counts, supervisors approve.
- **Cancellation Workflow**: Cashiers request, supervisors approve/cancel.
- **Payment Validation**: Cashier payment options/types are validated against Platinum API endpoints (`/api/billing-payment/payment-options`, `/api/billing-payment/payment-types`).
- **Receipt Range Validation**: Verified via `/api/platinum/receipt-prepaid/validate-receipt-range` before payment processing.
- **Session Detection**: Uses `/api/ReceiptPrepaid/validate-cashier` as the single source of truth for cashier session status (`isActive` field). Auto-resume and session enforcement are based on this.
- **Payment Submission**: Uses `submit-consumer-payment/{userId}` API per account. For split payments (cash + card), two separate rounds of per-account calls are made (paymentType 1 for cash, 3 for card) creating separate DB entries, each with its own `print-receipt` call.
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
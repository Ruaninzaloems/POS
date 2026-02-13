# Municipal POS Receipting System V2

## Overview

This is a **Municipal Point-of-Sale (POS) Receipting System** prototype built as a React/Express/PostgreSQL web application. It serves as a unified cashier interface for municipal payments including consumer services, multi-account payments, prepaid recharges, direct income payments, clearance payments, and direct deposit allocations.

The system is designed as a prototype that will eventually be migrated to an Angular production environment. The React frontend demonstrates all business logic, UI flows, and data models that the production system will need.

Key business capabilities:
- **Unified POS Screen**: Single search bar auto-detects transaction type (consumer payment, prepaid, direct income, clearance, etc.)
- **Split Payments**: Cash + Card can be split on the same transaction with change calculated on cash portion only
- **Cashier Session Management**: Float tracking, day-end reconciliation, denomination counting
- **Supervisor Dashboard**: Transaction oversight, cancellation approvals, day-end reviews
- **Direct Deposit Allocation**: Manual and bulk allocation of unmatched bank transactions to consumer accounts
- **Receipt Management**: Print, email, SMS receipt delivery with permit/certificate generation
- **External API Integration**: Proxied connections to Platinum Inzalo EMS API and legacy Sebata Billing microservices for live account data

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: `wouter` (lightweight router, similar to React Router)
- **Styling**: Tailwind CSS with shadcn/ui component library (Radix UI primitives)
- **State Management**: React Context API (`PosProvider` in `client/src/lib/pos-state.tsx`) manages the entire POS session state including cart items, payment amounts, cashier profile, and transaction history
- **Data Fetching**: TanStack React Query for server state, with a custom `apiRequest` helper in `client/src/lib/queryClient.ts`
- **UI Components**: Located in `client/src/components/ui/` (shadcn/ui) and `client/src/components/pos/` (business-specific POS components)

### Key Frontend Patterns
- **Business Logic Separation**: Pure calculation functions live in `client/src/lib/pos-logic.ts` and `client/src/lib/allocation-logic.ts`, separate from UI components
- **Mock Data Layer**: `client/src/lib/mock-data.ts` contains TypeScript interfaces and seed data. Some mock data uses `localStorage` for persistence (e.g., `client/src/lib/direct-deposits-data.ts`)
- **Layout System**: `PosLayout` component wraps all pages, providing the navigation sidebar and cashier session gate (blocks access until session is started)
- **Page Structure**: Main pages in `client/src/pages/` — the POS screen (`pos.tsx`), supervisor dashboard, settings, view receipts, and direct deposit allocation pages

### Backend (Express + Node.js)
- **Framework**: Express 5 with TypeScript, compiled via `tsx`
- **API Pattern**: RESTful routes registered in `server/routes.ts`
- **Proxy Layer**: Backend proxies requests to two external APIs:
  - **Platinum Inzalo EMS API** (`georgeplatinumuatapi.azurewebsites.net`): Authenticated via JWT tokens (`server/platinum-auth.ts`). Routes prefixed with `/api/platinum/` cover all POS operations (payments, prepaid, clearance, miscellaneous, day-end reconciliation, direct deposits, third-party payments, account management, billing enquiry, dashboard)
  - **Legacy Sebata Billing API** (`george-uat-ems-billing-api.azurewebsites.net`): Unauthenticated OData proxy. Routes prefixed with `/api/proxy/` for backward compatibility
- **Static Serving**: Production builds served from `dist/public/`; development uses Vite middleware with HMR
- **Storage Layer**: `server/storage.ts` implements `IStorage` interface with a `DatabaseStorage` class using Drizzle ORM

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` with Zod validation via `drizzle-zod`
- **Tables**:
  - `users` — Basic user authentication (id, username, password)
  - `cashier_sessions` — Tracks cashier login sessions with float amount, cash office, start/end times, and status
  - `transactions` — Stores completed transactions with receipt numbers, payment split (cash/card amounts), line items (JSONB), and status tracking
- **Migrations**: Managed via `drizzle-kit push` (schema-push approach, not migration files)
- **Connection**: Uses `pg.Pool` with `DATABASE_URL` environment variable

### Build System
- **Development**: `tsx server/index.ts` runs the server which sets up Vite dev middleware for the client
- **Production Build**: Custom build script (`script/build.ts`) uses Vite for client and esbuild for server, outputting to `dist/`
- **Port**: Dev server runs on port 5000

### Key Business Logic Decisions
1. **Rounding**: Transaction totals are rounded UP to nearest 10 cents to prevent outstanding balances
2. **Change Calculation**: Change is only calculated on the cash portion: `changeDue = max(0, cash - (total - card))`
3. **Transaction Types**: Six types auto-detected from search: Consumer Services, Multi-Account, Account Group, Prepaid, Direct Income, Clearance
4. **Day-End Process**: Cashiers submit cash-on-hand counts; supervisors approve/return; denomination counting is configurable
5. **Cancellation Workflow**: Regular cashiers request cancellation (goes to supervisor); supervisors can cancel directly

## External Dependencies

### External APIs
- **Platinum Inzalo EMS API** (`georgeplatinumuatapi.azurewebsites.net`): Full POS system API authenticated via JWT bearer tokens. Auth module in `server/platinum-auth.ts` handles token management with auto-refresh. Credentials stored as environment secrets (PLATINUM_API_PASSWORD) and env vars (PLATINUM_API_USERNAME, PLATINUM_API_DBNAME). OpenAPI spec in `platinum-openapi.json`.
  - Key endpoint groups: ReceiptPrepaid (cashier/account operations), billing-payment (consumer/clearance/misc payments), auth-day-end-reconcile (supervisor), billing-payment-day-end-reconcile (cashier), billing-direct-deposit-allocation (manual), billing/direct-deposit-bulk-allocation (bulk), third-party-payments v2, BillingEnquiry, BillingDashboard
  - **API Naming Convention**: Platinum API expects PascalCase input with underscores preserved (e.g., `Const_CashOffice`, `User_Id`, `account_ID`) but returns camelCase output (e.g., `accountID`, `outStandingAmount`)
  - **Performance**: Account search via `BillingEnquiry/EnquiryResults` is slow (~23 seconds for broad queries). All API calls have 30-35 second timeouts configured with AbortController
  - **Working Payment Flow**: `save-multiple-account-payment` → `submit-consumer-payment/{userId}` (per account, uses `BillingConsumerPaymentSubmitDto: { account, requestModel }`) → returns `{isSuccess: true, ids: [receiptId]}` → `print-receipt` (POST with receipt IDs array, generates PDF) → `pos-multi-receipt-print` (structured receipt data for display). **IMPORTANT**: Only `submit-consumer-payment` is used for payments. `submit-multiple-payment` has been removed entirely.
  - **Receipt Data**: `pos-multi-receipt-print` (Sebata proxy) returns structured receipt data with `receiptNo`, `cashierName`, `cashOfficeName`, `tenderAmount`, `changeAmount`, `outstandingAmount`, `payMode`, `billType`
  - **Cashier Setup Flow** (in `client/src/pages/cashier-setup.tsx`): Three-step flow: (1) `validateCashier` GET on page load with userId/finYear, (2) `getCashOffices` GET after validation with finYear, (3) `submitCashierSetup` POST on submit button click with POSCashier payload. All via Platinum ReceiptPrepaid endpoints.
  - **Cashier Session**: User 4697 (Francois Francois), cashierId 31055, Uniondale cash office (cashOffice_ID: 2). Session managed by Platinum, not local DB.
  - **Auth Note**: JWT token resolves to System Administration (ID:1) due to Azure SSO mapping issue. userId parameter (4697) is passed separately to API calls
- **Sebata Billing Microservice** (`george-uat-ems-billing-api.azurewebsites.net`): Legacy OData-based API providing consumer account data, billing config, and receipt staging. Accessed via server-side proxy routes (`/api/proxy/`) for backward compatibility. Swagger spec in `swagger.json`.
  
### Database
- **No local database**: The application does NOT use a local PostgreSQL database. All data persistence is handled through the Platinum Inzalo EMS API and Sebata Billing API. The `server/storage.ts`, `server/db.ts`, and `shared/schema.ts` files exist as legacy code but are not imported or used by any active code path. Session state is managed in-memory via React Context, and transaction/receipt history is sourced from Platinum API endpoints (e.g., `pos-multi-receipt-print`). This architecture ensures the frontend can be deployed into any environment with only API access to Platinum.

### Frontend Libraries
- **shadcn/ui + Radix UI**: Complete component library (dialogs, dropdowns, tabs, tables, tooltips, etc.)
- **TanStack React Query**: Server state management
- **date-fns**: Date formatting and manipulation
- **react-to-print**: Browser print functionality for receipts and permits
- **embla-carousel-react**: Carousel component
- **cmdk**: Command palette component
- **recharts**: Charting library (likely used in supervisor dashboard)

### Build Tools
- **Vite**: Frontend bundler with React plugin and Tailwind CSS plugin
- **esbuild**: Server bundler for production builds
- **tsx**: TypeScript execution for development server
- **drizzle-kit**: Database schema management

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Development tooling
- `@replit/vite-plugin-dev-banner`: Development banner
- Custom `vite-plugin-meta-images.ts`: Updates OpenGraph meta tags for Replit deployments
# Municipal POS Receipting System V2

## Overview

This project is a **Municipal Point-of-Sale (POS) Receipting System** prototype. It's a React/Express/PostgreSQL web application designed as a unified cashier interface for diverse municipal payments, including consumer services, multi-account payments, prepaid recharges, direct income, clearance, and direct deposit allocations. The primary goal is to validate business logic, UI flows, and data models for a future Angular production environment.

Key capabilities include:
- A unified POS screen with automatic transaction type detection.
- Support for split payments (cash + card) with accurate change calculation.
- Enforcement of a single active session per cashier for operational integrity.
- High concurrency optimization for 10+ simultaneous users through token mutexes, server-side caching, request limiting, and frontend/server-side GET request deduplication.
- All transaction and session data are stored and managed exclusively via the Platinum API, ensuring data consistency and simplifying day-end reconciliation.
- Comprehensive cashier session management, float tracking, and day-end reconciliation workflows.
- A supervisor dashboard for transaction oversight and approval processes.
- Functionality for direct deposit allocation, both manual and bulk, with two-step clearance search (typeahead via `get-clearanceids` + full data via `get-clearance-data`), property detail display (SG number, address, expiry), Section 118(1)/118(3) breakdown allocation, auto-fill capability, and real-time allocated vs remaining total tracking.
- Robust receipt management (print, email, SMS) and permit/certificate generation.
- A Client Communications module for custom messaging (email/SMS) and a "Send Statements" feature, integrated with account data.
- Integration exclusively with Platinum Inzalo EMS API for all real-time account data access.
- Contextual tooltips via a reusable `HelpTip` component for inline user assistance.
- Smart, category-based icon display for Direct Income items, enhancing UI clarity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript, powered by Vite.
- **Routing**: `wouter` for lightweight client-side navigation.
- **Styling**: Tailwind CSS, utilizing `shadcn/ui` (built on Radix UI primitives) for component development.
- **State Management**: React Context API (`PosProvider`) centrally manages core application state, including session, cart, payments, and cashier profiles.
- **Data Fetching**: TanStack React Query, enhanced with a custom `apiRequest` helper for API interactions.
- **Component Structure**: Clear separation between generic `shadcn/ui` components and specific POS business components.
- **Design Patterns**: Emphasizes separation of business logic (`pos-logic.ts`, `allocation-logic.ts`) from UI components. Data is exclusively API-driven, with no `localStorage` usage. A `PosLayout` component enforces consistent layout and cashier session authentication.
- **Error Handling**: All API fetch functions (`fetchPlatinumUserInfo`, `fetchCashOffices`, `fetchCashiers`, `fetchBanks`, `fetchGroups`, `fetchInstitutions`, `fetchConfigSettings`, `fetchBillingConfig`, `fetchCashierPaymentOptions`, `fetchCashierPaymentTypes`) throw errors on failure — no silent fallbacks or empty-array returns. Reference data loading uses a `tracked()` wrapper that records individual failures and surfaces them via toast while allowing partial data loading. Critical failures (e.g., Platinum user info) block session initialization entirely.

### Backend (Express + Node.js)
- **Framework**: Express 5 with TypeScript.
- **API Pattern**: RESTful architecture.
- **Proxy Layer**: Acts as an authenticated gateway exclusively to the Platinum Inzalo EMS API (JWT-based).
- **Session Management**: `express-session` handles per-user browser sessions, storing Platinum JWT tokens and user data. This design supports high concurrency without session conflicts.
- **Concurrency Control**: Implements a global request queue to limit concurrent Platinum API calls and employs user-aware response caching and in-flight GET request deduplication to optimize performance.
- **Data Persistence**: Crucially, the backend does not use a local database for business data. All transaction storage, cashier sessions, account data, and reconciliation processes are managed entirely through the Platinum API. Legacy local database schemas are present but unused.

### Database (PostgreSQL)
- **Role**: The local PostgreSQL database is explicitly NOT used for any business logic or data persistence. All operational data is handled by the Platinum API.
- **Legacy Code**: Files defining local database schemas (`shared/schema.ts`, `server/storage.ts`, `server/db.ts`) are considered dead code, kept for reference only, and are not invoked by the application.

### Web Component / Angular Integration
- The React application is designed as a Web Component (`<pos-app>`) for seamless embedding into existing Angular applications.
- Utilizes Shadow DOM for complete style isolation, ensuring no CSS leakage to the host application.
- All API calls are routed through a centralized URL resolver and authentication header injector, preventing direct `fetch()` calls.
- Adheres to strict guidelines: `ReactDOM.createRoot` is called within the web component's `connectedCallback()`, HTML attributes are used for passing configuration (`api-base-url`, `auth-token`), and the build process generates a single, self-contained ES module bundle (`dist/bundle.js`) with inlined CSS.
- No `localStorage` or `sessionStorage` is used, and no local database writes occur, enforcing an API-first data strategy.

## External Dependencies

### External APIs
-   **Platinum Inzalo EMS API** (`georgeplatinumuatapi.azurewebsites.net`):
    -   Central to all core POS operations: payments, prepaid services, clearance, day-end processes, and direct deposits.
    -   Authentication via JWT tokens, with token refresh managed server-side.
    -   Key modules integrated: `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, `BillingDashboard`.
    -   Handles critical payment flows, cashier setup, session status, and direct deposit allocations.
    -   Manages distinct Payment Type IDs (e.g., 1 for Cash, 3 for Credit Card) for accurate financial processing.
### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: Provides a robust and customizable UI component foundation.
-   `TanStack React Query`: Used for efficient server state management and data synchronization.
-   `date-fns`: A utility library for date manipulation.
-   `react-to-print`: Facilitates client-side printing functionality.

### Build Tools
-   `Vite`: Frontend bundler, optimized for speed and efficiency.
-   `esbuild`: Used for efficient server-side bundling.
-   `tsx`: Enables direct execution of TypeScript files during development.
-   `drizzle-kit`: Utilized for database schema management, primarily for the unused local database definitions.
# Municipal POS Receipting System V2

## Overview
This project is a React/Express/PostgreSQL web application prototype for a **Municipal Point-of-Sale (POS) Receipting System**. Its main purpose is to provide a unified cashier interface for various municipal payments, including consumer services, multi-account payments, prepaid recharges, direct income, clearance, and direct deposit allocations. The system validates business logic, UI flows, and data models for a future Angular production environment. Key capabilities include a unified POS screen, split payments, cashier session management, float tracking, day-end reconciliation, supervisor dashboard, direct deposit allocation, receipt management (print, email, SMS), permit/certificate generation, and a Client Communications module. It is designed for high concurrency and integrates exclusively with the Platinum Inzalo EMS API.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
The system is built on a React 18 frontend with TypeScript, Vite, and `wouter` for routing, styled with Tailwind CSS and `shadcn/ui`. State management uses React Context API, and data fetching relies on TanStack React Query. The Express 5 backend acts as an authenticated proxy to the Platinum Inzalo EMS API, managing user sessions with `express-session` and implementing concurrency features like a global request queue and response caching. A local PostgreSQL database is present but not used for business data; all operational data is managed via the Platinum API. The entire application is designed as a self-contained Web Component (`<pos-app>`) for embedding into existing Angular applications.

### UI/UX and Theming
The application supports multi-site theming via CSS custom properties, utilizing an accent color system (e.g., `--pos-accent`) for dynamic theme switching. Page layouts are standardized with sticky headers, scrollable content areas, and consistent styling for various components.

### API as Single Source of Truth
The Platinum Inzalo EMS API is the sole source of truth for all data. No fallbacks, mock data, or hardcoded values are used for business logic. All data must originate from the API, and explicit error handling is implemented for API call failures.

### Key Features and Implementations

#### Direct Deposit Allocation
The system supports direct deposit allocation, where submissions are batched server-side (`POST /api/dd-allocation/submit-batch`) and processed sequentially against the Platinum API in the background. Clients poll for progress. Specific payload specifications exist for various `BillType`s (Consumer Services, Clearance, Miscellaneous). A "Generic Import" tab allows CSV uploads for bulk direct deposit allocation, with client-side parsing, validation, and server-side batch submission.

#### Account Enquiry
A reusable `AccountEnquiryDialog` component provides comprehensive account enquiry functionalities, integrating various account-related tabs and accessible from different parts of the application.

#### Receipt Processing and Performance
Receipt generation is optimized by separating printing from payment processing. Lookup strategies for unreconciled receipts are prioritized, and performance enhancements include parallelization of API calls and suppression of session polling during transactions.

#### Multi-Account Payment Handling
For large multi-account payments, the system implements dynamic timeout scaling at the server proxy, client API, and UI levels. Payments exceeding a `CHUNK_SIZE` (25 accounts) are split into parallel batches (up to 3 concurrent chunks) to improve performance and handle partial failures gracefully.

#### Day-End Reconciliation
The day-end process involves a multi-step submission and approval workflow with distinct statuses (`NOT_SUBMITTED`, `PENDING_APPROVAL`, `RETURNED`, `COMPLETED`). The system manages cashier sessions based on reconciliation status to allow re-submission or block further transactions.

#### SA 10c Cash Rounding
Cash payments are rounded up to the nearest 10c (South African standard). The UI provides explicit user interaction for rounding, adjusting the first basket item's amount to pay, and updating the cash tender.

## External Dependencies

### Multi-Site Support
The application supports multiple EMS sites (e.g., George Municipality, Inzalo EMS (Site02)), each with its own API endpoint and branding, selected at login.

### External APIs
-   **Platinum Inzalo EMS API**: The central dependency for all core POS operations, including payments, prepaid services, clearance, day-end processes, direct deposits, and authentication (via JWT). It integrates modules such as `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, and `BillingDashboard`.

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: For robust and customizable UI components.
-   `TanStack React Query`: For efficient server state management.
-   `date-fns`: For date manipulation.
-   `react-to-print`: For client-side printing.
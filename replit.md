# Municipal POS Receipting System V2

## Overview
This project is a React/Express/PostgreSQL web application prototype for a Municipal Point-of-Sale (POS) Receipting System. Its primary goal is to provide a unified cashier interface for various municipal payments and integrate exclusively with the Platinum Inzalo EMS API. The system validates business logic, UI flows, and data models for a future Angular production environment. Key capabilities include a unified POS screen, split payments, cashier session management, float tracking, day-end reconciliation, supervisor dashboard, direct deposit allocation, receipt management, permit/certificate generation, a Client Communications module, and advanced debt management functionalities. It is designed for high concurrency and aims to streamline municipal payment processing and debt recovery.

## User Preferences
Preferred communication style: Simple, everyday language.
Theme: SAMRAS warm/light theme — `bg-[#F2F4F7]` background, `bg-white` cards with `border-[#D6D6D6] shadow-sm`, `bg-[#F7F7F7]` inputs with `border-[#D6D6D6]`, accent via `var(--pos-accent)` orange. NO dark slate themes. All pages must use this consistent light theme.

## System Architecture

### Core Design Principles
The system uses a React 18 frontend with TypeScript, Vite, `wouter` for routing, styled with Tailwind CSS and `shadcn/ui`. State management uses React Context API, and data fetching relies on TanStack React Query. The Express 5 backend acts as a pure authenticated proxy to the Platinum Inzalo EMS API — ALL feature data comes exclusively from Platinum, no local database for feature data. The local PostgreSQL database is used ONLY for POS core tables (users, cashier_sessions, transactions). The backend manages user sessions, implements a global request queue, and response caching. The application is designed as a self-contained Web Component (`<pos-app>`) for embedding into existing Angular applications. Multi-site theming is supported via CSS custom properties and an accent color system.

### Key Features and Implementations

#### Direct Deposit Allocation
Supports direct deposit allocation with batched server-side submissions and client polling for progress. Includes a "Generic Import" tab for bulk CSV uploads with client-side parsing and validation. The unmatched queue features bulk selection, an "Auto-Match Page" function using AI-enhanced and regex-based analysis, and inline match confidence indicators. AI-enhanced matching leverages OpenAI for description parsing and identifier extraction across Platinum API endpoints. It avoids hardcoded municipality data, relying on API autocomplete endpoints for SG code matching and comprehensive ERF parsing.

#### Receipt Processing and Performance
Receipt generation separates printing from payment processing. Lookup strategies for unreconciled receipts are prioritized, and performance enhancements include parallelization of API calls and suppression of session polling during transactions. Miscellaneous receipts are routed dynamically. For large multi-account payments, dynamic timeout scaling is implemented, and payments exceeding a `CHUNK_SIZE` are split into parallel batches.

#### Day-End Reconciliation
Involves a multi-step submission and approval workflow with distinct statuses. The system manages cashier sessions based on reconciliation status, and server-side endpoints verify record creation. Returned day-end sessions are recoverable.

#### Cash Handling
Includes a cash-on-hand limit pre-check before processing cash payments and implements SA 10c cash rounding.

#### Debt Management Module
A full debt recovery workflow covers Section 129 Letter of Demand processes and account handover management, including Section 129 Notice generation, Handover Management (Account, Bulk, Rotation modes), and Handover Termination. All debt operations proxy through dedicated Platinum API endpoints. This module includes configurable Section 129 parameters, debt reports, run file management, and specific debt tabs in the General Enquiries dialog. Permissions and audit trails are enforced.

#### Legal Compliance (Platinum API Proxy)
Legal compliance validation, audit trails, evidence bundles, and rule management all proxy to Platinum API (`/api/BillingDebt/legal-rules`, `/api/BillingDebt/compliance-log`, `/api/BillingDebt/evidence-bundle`, `/api/BillingDebt/validate-legal-action`). Admin pages exist for managing legal rule versions and viewing compliance audit trails. `requireLegalAdmin()` fails closed — only superUser OR explicit ADMIN/LEGAL_ADMIN/COMPLIANCE_ADMIN/DEBT_ADMIN permission grants access.

#### Intelligent Debt Qualification & Risk Scoring (Platinum API Proxy)
Debt scoring and qualification rules proxy to Platinum API (`/api/BillingDebt/score-account`, `/api/BillingDebt/risk-scores`, `/api/BillingDebt/scoring-weights`, `/api/BillingDebt/qualification-rules`). Risk Scoring page (`/debt/risk-scoring`) and Qualification Rules page (`/debt/qualification-rules`) in sidebar.

#### Advanced Communication Engine (Platinum API Proxy)
Omni-channel communication management proxies to Platinum API (`/api/BillingDebt/communication-timelines`, `/api/BillingDebt/communication-dispatch`, `/api/BillingDebt/communication-log`, `/api/BillingDebt/communication-scheduled`, `/api/BillingDebt/communication-stats`). Communication Timeline page (`/debt/communication-timelines`) and Communication Dashboard (`/debt/communication-dashboard`) with 4 tabs (Overview, Log, Scheduled, Send). All write operations require `requireLegalAdmin` authorization.

#### Intelligence & Analytics Module (Platinum API Proxy)
Executive-level analytics proxy to Platinum API (`/api/BillingDashboard/debt-overview`, `/api/BillingDashboard/aging-analysis`, `/api/BillingDashboard/recovery-stats`, `/api/BillingDashboard/legal-pipeline`, `/api/BillingDashboard/attorney-performance`, `/api/BillingDashboard/risk-distribution`, `/api/BillingDashboard/predictive-forecasting`, `/api/BillingDashboard/geographic-distribution`). Three pages: Executive Debt Dashboard (`/analytics/executive-dashboard`), Predictive Recovery Forecasting (`/analytics/predictive-forecasting`), Geographic Debt Mapping (`/analytics/geographic-mapping`). All require `requireAuth` + `requireLegalAdmin`.

#### Batch Processing Engine (Platinum API Proxy)
Batch processing for scheduled debt recovery jobs proxies to Platinum API (`/api/BillingDebt/batch-jobs`, `/api/BillingDebt/batch-schedules`, `/api/BillingDebt/batch-trigger`, `/api/BillingDebt/batch-cancel`). Supports 5 job types: Trial Runs, Final Runs, Lapse Checks, Notifications, Attorney Allocation. Batch Processing page (`/debt/batch-processing`) shows KPI stats, trigger buttons, scheduled jobs table, and filterable job history with cancel capability. Trigger/cancel require `requireLegalAdmin`.

#### Process Monitoring (Platinum API Proxy)
Real-time process monitoring proxies to Platinum API (`/api/BillingDebt/process-monitoring-overview`, `/api/BillingDebt/process-active-runs`, `/api/BillingDebt/process-failed-runs`, `/api/BillingDebt/process-pending-approvals`, `/api/BillingDebt/process-handover-queues`, `/api/BillingDebt/process-termination-queues`). Process Monitoring page (`/debt/process-monitoring`) with tabbed interface: Overview (summary cards with drill-down), Active Runs, Failed Runs, Pending Approvals, Handover Queue, Termination Queue. All require `requireAuth`.

#### Digital Document Management (Platinum API Proxy)
Two sub-features:
1. **Document Templates** (`/debt/document-templates`): Version-controlled template management proxying to Platinum API (`/api/BillingDebt/document-templates`, `/api/BillingDebt/document-templates/:id/versions`, `/api/BillingDebt/document-templates/:id/upload`, `/api/BillingDebt/document-templates/:id/download`). CRUD for templates with category filter (SECTION_129, HANDOVER, AOD, FINAL_DEMAND, SUMMONS, ARRANGEMENT, CLEARANCE, GENERAL), version history dialog, upload new versions with change notes, download current/archived versions. Write operations require `requireLegalAdmin`.
2. **Digital Signatures** (`/debt/digital-signatures`): Electronic signature management for AOD agreements proxying to Platinum API (`/api/BillingDebt/digital-signatures`, `/api/BillingDebt/digital-signatures/:id`, `/api/BillingDebt/digital-signatures/audit-log`). Send signature requests with signer info, expiry, amount; track status (PENDING/SENT/VIEWED/SIGNED/DECLINED/EXPIRED/CANCELLED); view request details with timeline and signature hash verification; full audit log tab. KPI summary cards. Write operations require `requireLegalAdmin`.

#### Debt Process Engine (Platinum API Proxy)
Configurable workflow engine for debt recovery processes proxying to Platinum API (`/api/BillingDebt/process-workflows`, `/api/BillingDebt/process-workflows/:id/stages`, `/api/BillingDebt/process-workflows/:id/stages/reorder`). Process Engine page (`/debt/process-engine`) with two views: workflow list and stage detail. Each workflow contains ordered stages (e.g., Stage 1: Reminder SMS → Stage 2: Arrear SMS → Stage 3: 14 Day Notice → Stage 4: Section 129 → Stage 5: Handover → Stage 6: Summons → Stage 7: Judgment → Stage 8: Warrant). Each stage has: entry rules (condition builder with AND/OR logic across 12 field types), document templates (linked by channel — SMS/Email/Letter/WhatsApp), automated/manual actions (12 action types including Send SMS, Generate Notice, Handover to Attorney, Apply Restriction, Issue Summons), and configurable timers (wait days, business days only, auto-escalate on expiry). Stages can be reordered via drag. Write operations require `requireLegalAdmin`.

## External Dependencies

### External APIs
-   **Platinum Inzalo EMS API**: The central dependency for all core POS operations, including payments, prepaid services, clearance, day-end processes, direct deposits, authentication, billing enquiry, and dashboard functionalities. It integrates various modules such as `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, `BillingDashboard`, and `BillingDebt`.

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: For robust and customizable UI components.
-   `TanStack React Query`: For efficient server state management.
-   `date-fns`: For date manipulation.
-   `react-to-print`: For client-side printing.

### Databases
-   **PostgreSQL**: Used ONLY for POS core tables: `users`, `cashier_sessions`, `transactions`. All debt/legal/communication/analytics data comes from Platinum API. Drizzle ORM is used for database interactions.

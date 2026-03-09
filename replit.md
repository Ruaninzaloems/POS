# Municipal POS Receipting System V2

## Overview
This project is a React/Express/PostgreSQL web application prototype for a Municipal Point-of-Sale (POS) Receipting System. Its primary goal is to provide a unified cashier interface for various municipal payments, including consumer services, multi-account payments, prepaid recharges, direct income, clearance, and direct deposit allocations. The system validates business logic, UI flows, and data models for a future Angular production environment. Key capabilities include a unified POS screen, split payments, cashier session management, float tracking, day-end reconciliation, supervisor dashboard, direct deposit allocation, receipt management, permit/certificate generation, and a Client Communications module. It is designed for high concurrency and integrates exclusively with the Platinum Inzalo EMS API.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
The system uses a React 18 frontend with TypeScript, Vite, `wouter` for routing, styled with Tailwind CSS and `shadcn/ui`. State management uses React Context API, and data fetching relies on TanStack React Query. The Express 5 backend acts as an authenticated proxy to the Platinum Inzalo EMS API, managing user sessions and implementing a global request queue and response caching. A local PostgreSQL database is present but not used for business data; all operational data is managed via the Platinum API. The application is designed as a self-contained Web Component (`<pos-app>`) for embedding into existing Angular applications.

### UI/UX and Theming
Multi-site theming is supported via CSS custom properties and an accent color system for dynamic theme switching. Page layouts are standardized with sticky headers, scrollable content areas, and consistent component styling.

### API as Single Source of Truth
The Platinum Inzalo EMS API is the sole source of truth for all data, with explicit error handling for API call failures.

### Key Features and Implementations

#### Direct Deposit Allocation
The system supports direct deposit allocation with batched server-side submissions processed sequentially against the Platinum API. Clients poll for progress. A "Generic Import" tab allows CSV uploads for bulk direct deposit allocation, with client-side parsing and validation. The unmatched queue features bulk selection, an "Auto-Match Page" function for smart suggestion analysis (AI-enhanced and regex-based), and inline match confidence indicators. AI-enhanced matching uses OpenAI to parse descriptions and extract identifiers for comprehensive searches across Platinum API endpoints. Institution, payment group, clearance, and cost schedule matching are implemented with confidence scoring. Balance enrichment fetches missing balance data for suggested accounts. The system avoids hardcoded municipality data, relying on API autocomplete endpoints for SG code matching and comprehensive ERF parsing. ERF search includes timeout handling and dual-fetch pipelines to optimize performance under high concurrency. Unmatched queue performance is optimized by preloading items, client-side filtering/pagination, and server-side caching.

#### Account Enquiry
A reusable `AccountEnquiryDialog` component provides comprehensive account enquiry functionalities.

#### Receipt Processing and Performance
Receipt generation is optimized by separating printing from payment processing. Lookup strategies for unreconciled receipts are prioritized, and performance enhancements include parallelization of API calls and suppression of session polling during transactions. Miscellaneous receipts are routed dynamically to appropriate Platinum receipt endpoints.

#### Multi-Account Payment Handling
For large multi-account payments, dynamic timeout scaling is implemented at server proxy, client API, and UI levels. Payments exceeding a `CHUNK_SIZE` are split into parallel batches to improve performance and handle partial failures.

#### Day-End Reconciliation
The day-end process involves a multi-step submission and approval workflow with distinct statuses. The system manages cashier sessions based on reconciliation status. The server-side `save-reconcile-data` endpoint tries multiple Platinum API path variations and verifies record creation. Returned day-end sessions are recoverable, allowing cashiers to resume activity.

#### Cash-on-Hand Limit Pre-Check
Before processing cash payments, the system checks if the transaction would exceed the cashier's cash-on-hand limit, blocking payments if necessary and providing warnings with a "Do a Drop" shortcut.

#### SA 10c Cash Rounding
Cash payments are rounded up to the nearest 10c (South African standard), with UI support for user interaction and adjustment of tender.

#### Debt Management Module
A full debt recovery workflow under the "Debt" sidebar group covers Section 129 Letter of Demand processes and account handover management. This includes Section 129 Notice generation (Trial Review, Authorization, Final Run), Handover Management (Account, Bulk, Rotation modes), and Handover Termination. All debt operations proxy through dedicated Platinum API endpoints.

**Section 129 Configuration** (`/debt/section129/config`): Admin page for configuring Section 129 notice parameters per financial year. Supports templates (letter + SMS), lapse days (14-99 workdays), notices per file, additional billing cost grid, and attorney rotation with percentage allocation (debtor count or handover amount, must sum to 100%). Landing page with search grid + detail page for add/view.

**Section 129 Configuration Enforcement**: One-enabled-config-per-FY enforcement with client-side validation and server-side re-check on save.

**Debt Reports**: Three report pages under the Debt sidebar group (dark slate theme):
- Section 129 Notices Report (`/debt/section129-report`): Filter by FY, month, billing cycle, account, ageing (30-180+ days), amount threshold
- Handover Report (`/debt/handover-report`): Filter by FY, month, billing cycle, attorney, account
- SMS Log Report (`/debt/sms-log-report`): Filter by FY, month, billing cycle, account, date range, status (Sent/Failed/Pending). Grid shows date, account, mobile, template, status, message, sent by.

**Run File Management**: Section 129 Notices page includes per-run file listing modal with individual download/reprint buttons. Download route uses binary passthrough (not JSON proxy) for file streaming.

**General Enquiries – Debt Tabs**: Account Enquiry Dialog has Section 129 and Handover tabs in the OTHER group. Section 129 tab shows notices per billing period with FY + month filter, status badges, paginated table, and download/reprint buttons per notice. Handover tab shows handover list with FY + month filter and transaction detail.

**Dashboard Debt Notifications**: Two Debt category notifications on billing dashboard:
- "Section 129 – Process Handovers" (`get-section129-process-handovers`, warning severity)
- "Handover Termination Pending" (`get-handover-termination-pending`, warning severity)

**Permissions & Audit**: All debt POST routes enforce `requireDebtPermission()` server-side (PROCESS_SECTION129, AUTHORISE_SECTION129, HANDOVER_PROCESS). Audit fields (capturerID, dateCaptured, modifierID, dateModified, reviewerID, reviewDate, statusID, comment) are auto-injected via `injectAuditFields()` on all write payloads.

**Final Run Workflow**: Final run is triggered per-row in the runs grid (authorized runs only), not from the submission form. Play button appears on authorized runs.

**Debt Proxy Routes** (server/routes.ts under `/api/platinum/billing-debt/*`): section129-config, section129-config-list, section129-config-save, section129-templates, section129-sms-templates, additional-billing-types, section129-runs, section129-trial-run, section129-trial-review-submit, section129-authorize, section129-final-run, section129-run-accounts, section129-run-files, section129-download-file, section129-report, sms-log-report, handover-list, handover-submit, handover-terminate, handover-report, attorney-list, billing-cycles, towns.

#### Legal Compliance Engine
A full legal compliance framework under the "Compliance" sidebar group covering South African legislative best practice.

**Legal Rules Engine** (`server/legal-compliance.ts`): Validates every debt action against applicable legislation (NCA, MSA, MPRA, POPIA, CPA). Each action is mapped to relevant legislation categories. `validateAction()` checks active rules and returns violations. Rules are stored in `legal_rule_versions` database table with version tracking, effective dates, and soft-delete support.

**Court-Ready Audit Trail** (`legal_compliance_log` table): Every debt action automatically stores: user, timestamp, IP address, UUID API call ID, document version, communication proof, applicable legislation reference, legal rule version, and process stage. Compliance logging is fire-and-forget (non-blocking) on all debt POST routes.

**Litigation Evidence Bundle** (`litigation_evidence_bundles` table): On-demand generation of court submission packs per account. Bundles include: notice history, SMS logs, email logs, postal batch records, account ledger summary, proof of service, and handover records. Each section has completeness indicators.

**Legal Rules Administration** (`/legal/rules`): CRUD admin page for managing legal rule versions. Category filter (NCA/MSA/MPRA/POPIA/CPA), version tracking, effective date management.

**Compliance Audit Trail Page** (`/legal/audit-trail`): Searchable audit log with filters by action type, account, user, date range. "Court Ready" badge per record when all required fields populated. Expandable row detail for full metadata.

**Evidence Bundle Page** (`/legal/evidence-bundle`): Generate and view litigation evidence bundles. Structured sections with completeness indicators.

**Database Tables**: `legal_rule_versions`, `legal_compliance_log`, `litigation_evidence_bundles` (PostgreSQL, Drizzle ORM).

**Default Rules Seeded**: 8 rules covering NCA S129 Notice/Timeframe, MSA Credit Control/Customer Care, MPRA Rates, POPIA Consent/Data Retention, CPA Notice Requirements.

**Legal Compliance API Routes** (`/api/legal/*`): rules (GET/POST/PUT/DELETE), compliance-log (GET), compliance-log/:entityId (GET), evidence-bundle (POST/GET), evidence-bundles (GET), validate-action (POST).

## External Dependencies

### Multi-Site Support
The application supports multiple EMS sites, each with its own API endpoint and branding, selectable at login.

### External APIs
-   **Platinum Inzalo EMS API**: The central dependency for all core POS operations, including payments, prepaid services, clearance, day-end processes, direct deposits, and authentication. It integrates modules such as `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, and `BillingDashboard`.

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: For robust and customizable UI components.
-   `TanStack React Query`: For efficient server state management.
-   `date-fns`: For date manipulation.
-   `react-to-print`: For client-side printing.
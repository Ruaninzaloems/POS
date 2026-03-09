# Municipal POS Receipting System V2

## Overview
This project is a React/Express/PostgreSQL web application prototype for a Municipal Point-of-Sale (POS) Receipting System. Its primary goal is to provide a unified cashier interface for various municipal payments and integrate exclusively with the Platinum Inzalo EMS API. The system validates business logic, UI flows, and data models for a future Angular production environment. Key capabilities include a unified POS screen, split payments, cashier session management, float tracking, day-end reconciliation, supervisor dashboard, direct deposit allocation, receipt management, permit/certificate generation, a Client Communications module, and advanced debt management functionalities. It is designed for high concurrency and aims to streamline municipal payment processing and debt recovery.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
The system uses a React 18 frontend with TypeScript, Vite, `wouter` for routing, styled with Tailwind CSS and `shadcn/ui`. State management uses React Context API, and data fetching relies on TanStack React Query. The Express 5 backend acts as an authenticated proxy to the Platinum Inzalo EMS API, managing user sessions and implementing a global request queue and response caching. A local PostgreSQL database is present but used for specific features like legal compliance logging, debt scoring configurations, and communication timelines, not for core business data which resides in the Platinum API. The application is designed as a self-contained Web Component (`<pos-app>`) for embedding into existing Angular applications. Multi-site theming is supported via CSS custom properties and an accent color system.

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

#### Legal Compliance Engine
A legal compliance framework validates debt actions against South African legislation (NCA, MSA, MPRA, POPIA, CPA) using a rules engine. It maintains a court-ready audit trail for every debt action and supports on-demand generation of litigation evidence bundles per account. Admin pages exist for managing legal rule versions and viewing compliance audit trails.

#### Intelligent Debt Qualification & Risk Scoring
A predictive debt scoring engine scores debtor accounts (0-100) based on 8 weighted factors, categorizing them as LOW, MEDIUM, or HIGH risk. Weights are configurable. Smart qualification rules allow for complex multi-condition filters. Dashboards and administration pages are provided for managing scoring weights and qualification rules.

#### Advanced Communication Engine
Manages omni-channel communication (SMS, email, WhatsApp, printed letter) for automated debt recovery escalation. It includes configurable escalation timelines with ordered steps and supports automated timeline enrollment and scheduled processing. Dashboards provide an overview of delivery statistics, a communication log, and a queue of scheduled communications.

## External Dependencies

### External APIs
-   **Platinum Inzalo EMS API**: The central dependency for all core POS operations, including payments, prepaid services, clearance, day-end processes, direct deposits, authentication, billing enquiry, and dashboard functionalities. It integrates various modules such as `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, and `BillingDashboard`.

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: For robust and customizable UI components.
-   `TanStack React Query`: For efficient server state management.
-   `date-fns`: For date manipulation.
-   `react-to-print`: For client-side printing.

### Databases
-   **PostgreSQL**: Used for specific features like `legal_rule_versions`, `legal_compliance_log`, `litigation_evidence_bundles`, `debt_risk_scores`, `debt_qualification_rules`, `debt_scoring_weights`, `communication_timelines`, `communication_timeline_steps`, `communication_log`, and `scheduled_communications`. Drizzle ORM is used for database interactions.
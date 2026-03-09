# Municipal POS Receipting System V2

## Overview
This project is a React/Express/PostgreSQL web application prototype for a Municipal Point-of-Sale (POS) Receipting System. Its primary goal is to provide a unified cashier interface for various municipal payments and integrate exclusively with the Platinum Inzalo EMS API. The system validates business logic, UI flows, and data models for a future Angular production environment. Key capabilities include a unified POS screen, split payments, cashier session management, float tracking, day-end reconciliation, supervisor dashboard, direct deposit allocation, receipt management, permit/certificate generation, a Client Communications module, and advanced debt management functionalities. It is designed for high concurrency and aims to streamline municipal payment processing and debt recovery.

## User Preferences
Preferred communication style: Simple, everyday language.
Theme: SAMRAS warm/light theme — `bg-[#F2F4F7]` background, `bg-white` cards with `border-[#D6D6D6] shadow-sm`, `bg-[#F7F7F7]` inputs with `border-[#D6D6D6]`, accent via `var(--pos-accent)` orange. NO dark slate themes. All pages must use this consistent light theme.

## Permanent Project Standards (NON-NEGOTIABLE)
Full details in **`PROJECT_IMPLEMENTATION_RULES.md`** and **`POST_CHANGE_CHECKLIST.md`** (both in repo root). These rules apply to EVERY development task — no exceptions.

1. **Platinum API Only** — ALL feature data from Platinum APIs exclusively. No local DB for feature data. No SQLite. No JSON files as storage. No mock persistence. No fallback data in live flows. No hardcoded business data. Local PostgreSQL ONLY for POS core tables (users, cashier_sessions, transactions) and AI chat support tables (conversations, messages). When a Platinum API call fails, surface the error clearly — never silently swallow with `.catch(() => [])` or return fake success.
2. **Angular-Ready Always** — Business logic in plain TypeScript services (not components). Typed models/DTOs in framework-neutral files. Components are presentational only. No React-only patterns that block Angular migration. Minimize custom hooks for business logic. All shared logic lives in `client/src/services/` and `client/src/models/`.
3. **Deployment-Ready Always** — Production-structured code after every change. No temporary hacks. Clean builds. Error/loading/empty/retry states on all API screens. No dead code. Config externalized by environment.
4. **Post-Change Compliance Review** — After every task, run `POST_CHANGE_CHECKLIST.md` and verify: Platinum-only, no local DB, no fallbacks, Angular-ready, deployment-ready, business logic outside UI, typed contracts, environment handling correct. Report any violations immediately.

## System Architecture

### Core Design Principles
The system uses a React 18 frontend with TypeScript, Vite, `wouter` for routing, styled with Tailwind CSS and `shadcn/ui`. State management uses React Context API, and data fetching relies on TanStack React Query. The Express 5 backend acts as a pure authenticated proxy to the Platinum Inzalo EMS API, which is the exclusive source for all feature data. The local PostgreSQL database is used ONLY for POS core tables (users, cashier_sessions, transactions). The backend manages user sessions, implements a global request queue, and response caching. The application is designed as a self-contained Web Component (`<pos-app>`) for embedding into existing Angular applications. Multi-site theming is supported via CSS custom properties and an accent color system.

### Debt & Legal Hybrid Architecture
The Debt & Legal solution employs a hybrid architecture where Replit handles the UI, rules engine, and process orchestration. Platinum serves as the system of record (API only), and Azure Service Bus manages long-running background jobs. Direct synchronous APIs are used for configuration, lookups, enquiries, and status reads. All write actions include full audit metadata.

### Key Features and Implementations
-   **Angular-Ready Architecture**: All business logic, validation, formatting, constants, and type definitions are extracted into framework-neutral plain TypeScript files for direct reuse in Angular standalone feature modules. React page components are presentational only.
-   **Direct Deposit Allocation**: Supports batched server-side submissions and client polling, bulk CSV uploads with client-side parsing/validation, and AI-enhanced auto-matching using OpenAI for description parsing.
-   **Receipt Processing**: Separates printing from payment processing, prioritizes lookup strategies for unreconciled receipts, and includes performance enhancements like parallelized API calls and dynamic timeout scaling for large payments.
-   **Day-End Reconciliation**: Implements a multi-step submission and approval workflow, managing cashier sessions based on reconciliation status.
-   **Cash Handling**: Includes pre-checks for cash-on-hand limits and implements SA 10c cash rounding.
-   **Debt Management Module**: Covers Section 129 Letter of Demand processes and account handover management (including Section 129 Notice generation, Handover Management, and Handover Termination) by proxying all operations through dedicated Platinum API endpoints.
-   **Legal Compliance, Intelligent Debt Qualification & Risk Scoring, Advanced Communication Engine, Intelligence & Analytics Module, Batch Processing Engine, Process Monitoring, Digital Document Management, and Debt Process Engine**: These modules primarily function as proxies to their respective Platinum API endpoints, providing UI and orchestration for complex workflows, data management, and reporting functionalities. They enforce strict access controls and integrate with Platinum for data persistence and business logic execution.

### Angular-Ready Architecture (Shared Services Layer)
All business logic, validation, formatting, constants, and type definitions are extracted into framework-neutral plain TypeScript files for direct reuse in Angular standalone feature modules:
- **`client/src/models/debt.models.ts`** — All debt feature interfaces (ProcessWorkflow, WorkflowStage, StageRule, StageAction, DocumentTemplate, SignatureRequest, BatchJob, Condition, Section129Config, Section129ConfigEntry, Section129Run, Section129RunAccount, Section129RunFile, HandoverRecord, Attorney, HandoverTermination, QualificationRunResult, RiskScore, CommunicationStats, CommunicationTimeline, ProcessMonitoringOverview, etc.)
- **`client/src/models/legal.models.ts`** — Legal interfaces (LegalRuleVersion, RuleFormData, ComplianceLogEntry, EvidenceBundle)
- **`client/src/models/analytics.models.ts`** — Analytics interfaces (DebtOverview, AgingAnalysis, GeoItem, ForecastScenario, ForecastData, etc.)
- **`client/src/services/format.service.ts`** — Framework-neutral formatters (formatDate, formatCurrency, formatCurrencyCompact, formatFileSize, formatDuration, formatTimestamp, getFinancialYear, getFinancialYearList)
- **`client/src/services/validation.service.ts`** — Framework-neutral validators (validateRequired, validatePercentageSum, validateEmail, isCourtReady, getRiskCategory, getStatusColor, sortByField, getConfidenceLabel)
- **`client/src/services/debt-config.ts`** — All shared constants (RULE_FIELDS, RULE_OPERATORS, WORKFLOW_ACTION_TYPES, CHANNEL_OPTIONS, TEMPLATE_CATEGORIES, DOC_TYPES, LEGAL_CATEGORIES, QUALIFICATION_FIELD_OPTIONS, RISK_COLORS, status label maps, PAGE_SIZE, SECTION129_DEFAULTS)

All React page components are presentational only — they import types, constants, and utilities from these shared files. No inline type definitions, no inline formatting functions, no inline constant arrays in page files.

## External Dependencies

### External APIs
-   **Platinum Inzalo EMS API**: The central dependency for all core POS operations, including payments, prepaid services, clearance, day-end processes, direct deposits, authentication, billing enquiry, dashboard, and various debt management modules (e.g., `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, `BillingDashboard`, `BillingDebt`).

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: For robust and customizable UI components.
-   `TanStack React Query`: For efficient server state management.
-   `date-fns`: For date manipulation.
-   `react-to-print`: For client-side printing.

### Databases
-   **PostgreSQL**: Used ONLY for POS core tables: `users`, `cashier_sessions`, `transactions`, and AI chat tables: `conversations`, `messages`. All other feature-related data is sourced from the Platinum Inzalo EMS API. Drizzle ORM is used for database interactions.

## Phase Deliverable Standard
Every development phase (Phase 1, 2, 3, ...) produces exactly 5 output files. See skill `.agents/skills/phase-deliverables/SKILL.md` for the template and naming conventions.

### Phase Status
- **Phase 0** (Foundation/Analysis) — COMPLETED → `PHASE0_MASTER_MATRIX.md`
- **Phase 1** (Section 129 Notices) — DESIGN COMPLETE, PENDING API TEAM BUILD
  - `PHASE1_SECTION129_NOTICES_DETAIL_PACK.md` — master design (1,153 lines)
  - `PHASE1_BLOCKERS_ACTION_LIST.md` — 4 blockers requiring decisions
  - `PHASE1_API_DEVELOPER_HANDOVER.md` — API team implementation pack
  - `PHASE1_DB_CHANGE_SCRIPT.sql` — idempotent SQL with rollback
  - `PHASE1_SERVICE_BUS_PACK.md` — async queue/worker definitions
  - `PHASE1_SIGNOFF_CHECKLIST.md` — 54-item signoff gate
- **Phase 2** (Section 129 Configuration) — NOT STARTED (blocked by Phase 1 signoff)

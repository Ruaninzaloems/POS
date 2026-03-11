# Municipal POS Receipting System V2

## Overview
This project is an Angular 19/Express/PostgreSQL web application for a Municipal Point-of-Sale (POS) Receipting System. Its primary goal is to provide a unified cashier interface for various municipal payments and integrate exclusively with the Platinum Inzalo EMS API. The system validates business logic, UI flows, and data models. Key capabilities include a unified POS screen, split payments, cashier session management, float tracking, day-end reconciliation, supervisor dashboard, direct deposit allocation, receipt management, permit/certificate generation, a Client Communications module, and advanced debt management functionalities. Multi-site support: George Municipality + Inzalo EMS Site02.

## User Preferences
Preferred communication style: Simple, everyday language.
Theme: Platinum SCM Design System — navy primary (`--platinum-primary: #0f2b46`), gold accent (`--platinum-accent: #c9a84c`), white surfaces, Inter font. Layout: sidebar (250px collapsible to 64px) + toolbar (56px) shell with grouped navigation. NO dark slate themes. All pages must use this consistent light theme with CSS variables from `styles.css`.
**Date Format Rule**: ALL date displays EVERYWHERE in the UI must use `dd/mm/yyyy` format. Reports and all screens. This is a permanent standard — never use `month: 'short'`, `dateStyle: 'medium'`, or any other format. Date values sent to APIs remain unchanged (ISO format). Use the `padStart(2,'0')` pattern for consistent formatting.

## Permanent Project Standards (NON-NEGOTIABLE)
Full details in **`PROJECT_IMPLEMENTATION_RULES.md`** and **`POST_CHANGE_CHECKLIST.md`** (both in repo root). These rules apply to EVERY development task — no exceptions.

1. **Platinum API Only** — ALL feature data from Platinum APIs exclusively. No local DB for feature data. No SQLite. No JSON files as storage. No mock persistence. No fallback data in live flows. No hardcoded business data. Local PostgreSQL ONLY for POS core tables (users, cashier_sessions, transactions) and AI chat tables (conversations, messages). When a Platinum API call fails, surface the error clearly — never silently swallow with `.catch(() => [])` or return fake success.
2. **Angular Architecture** — Angular 19 standalone components with separate .component.ts/.component.html/.component.css files. Business logic in framework-neutral TypeScript services. Typed models/DTOs in shared files. Components are presentational only. All shared logic lives in `angular-client/src/app/services/` and `angular-client/src/app/models/`.
3. **Deployment-Ready Always** — Production-structured code after every change. No temporary hacks. Clean builds. Error/loading/empty/retry states on all API screens. No dead code. Config externalized by environment.
4. **Post-Change Compliance Review** — After every task, run `POST_CHANGE_CHECKLIST.md` and verify: Platinum-only, no local DB, no fallbacks, deployment-ready, business logic outside UI, typed contracts, environment handling correct. Report any violations immediately.

## System Architecture

### Frontend — Angular 19
- **Framework**: Angular 19 with standalone components (no NgModules)
- **File Structure**: Separate .component.ts, .component.html, .component.css for every component
- **Styling**: Tailwind CSS with SAMRAS theme CSS custom properties
- **Routing**: Angular Router with lazy-loaded feature routes (50+ routes in app.routes.ts)
- **State Management**: Angular signals (signal(), computed())
- **HTTP**: Angular HttpClient via ApiService, proxy to Express backend
- **DI Pattern**: inject() for dependency injection
- **Location**: `angular-client/` directory

### Backend — Express 5 (Modular Routes)
- **Role**: Pure authenticated proxy to Platinum Inzalo EMS API
- **Route Structure**: Modular files under `server/routes/`:
  - `auth.routes.ts` — Login, logout, session status
  - `pos.routes.ts` — POS/receipt-prepaid operations
  - `billing.routes.ts` — Billing payment endpoints
  - `clearance.routes.ts` — Clearance/misc endpoints
  - `enquiries.routes.ts` — Billing enquiry endpoints
  - `dayend.routes.ts` — Day-end reconciliation
  - `deposits.routes.ts` — Direct deposit allocation
  - `supervisor.routes.ts` — Supervisor dashboard
  - `receipts.routes.ts` — Receipt management
  - `debt.routes.ts` — Section 129, handover, risk, qualification
  - `legal.routes.ts` — Legal compliance
  - `communications.routes.ts` — Communication engine
  - `analytics.routes.ts` — Analytics, batch processing, monitoring
  - `middleware.ts` — Shared middleware (requireAuth, requireDebtPermission, injectAuditFields)
  - `index.ts` — Central registration of all route modules
- **Session**: Express-session with PostgreSQL store
- **Port**: 3000 (dev), 5000 (production)

### Dev Setup
- Angular dev server on port 5000 with proxy to Express on port 3000
- Express serves API only in dev mode (no Vite)
- In production: Express serves Angular build output + API on port 5000
- Workflow: `concurrently` runs both servers
- **Health Check**: GET `/api/health` (Express, always instant) — use to verify backend is up
- **IMPORTANT Build Timing**: Angular build takes ~22 seconds after every workflow restart. The dev server on port 5000 is unreachable during this window. NEVER use `mark_completed_and_get_feedback` immediately — it restarts the workflow and checks port 5000 too early, causing an infinite restart loop. Instead: (1) restart workflow, (2) wait 30+ seconds, (3) verify with `curl http://localhost:5000/` returning 200, (4) ONLY THEN call `mark_completed_and_get_feedback`. If the tool fails, do NOT retry immediately — wait 30 seconds first.

### Angular Project Structure
```
angular-client/src/app/
├── core/
│   ├── services/     (api.service.ts, auth.service.ts, toast.service.ts)
│   ├── guards/       (auth.guard.ts)
│   └── interceptors/ (error.interceptor.ts)
├── shared/
│   ├── layout/       (pos-layout.component)
│   └── components/   (card, badge, spinner, tabs, data-table, dialog, pagination, etc.)
├── features/
│   ├── auth/login/
│   ├── home/         (home, not-found, placeholder)
│   ├── pos/
│   ├── cashier/      (setup, day-end)
│   ├── direct-deposits/ (manual/, auto/)
│   ├── enquiries/
│   ├── supervisor/
│   ├── receipts/
│   ├── billing/
│   ├── communications/
│   ├── third-party/
│   ├── debt/         (section129/, handover/, risk-scoring/, qualification/, communication/, batch/, monitoring/, documents/, signatures/, engine/)
│   ├── legal/        (rules, audit-trail, evidence-bundle)
│   ├── analytics/    (executive-dashboard, predictive-forecasting, geographic-mapping)
│   ├── settings/
│   └── bulk-allocation/
├── models/           (debt.models.ts, legal.models.ts, analytics.models.ts)
├── services/         (format.service.ts, validation.service.ts, debt-config.ts, export.service.ts)
├── app.routes.ts     (50+ lazy-loaded routes)
├── app.config.ts     (HttpClient, Router providers)
└── app.ts            (root component)
```

### Debt & Legal Hybrid Architecture
The Debt & Legal solution employs a hybrid architecture where Replit handles the UI, rules engine, and process orchestration. Platinum serves as the system of record (API only), and Azure Service Bus manages long-running background jobs. Direct synchronous APIs are used for configuration, lookups, enquiries, and status reads. All write actions include full audit metadata.

### Key Features
- **POS Workflow (Tabbed)**: Single-page workflow at `/pos` with 3 tabs: (1) Session Setup (cashier registration, office selection, float), (2) POS Receipting (unified multi-type basket, split tender, cash rounding, receipt delivery), (3) Day-End Reconciliation (denomination counting, recon submission). Auto-advances to Transact tab when session is active. Wrapper: `PosWorkflowComponent` embeds `CashierSetupComponent`, `PosComponent`, `CashierDayEndComponent`. Old routes `/cashier-setup` and `/cashier-day-end` redirect to `/pos`.
- **POS Basket System**: Signal-based `PosBasketService` (`services/pos-basket.service.ts`) with typed models (`models/pos-basket.models.ts`). Multi-type basket supports 4 item types: `account` (consumer), `clearance`, `prepaid`, `misc`. Processing order enforced: account→clearance→prepaid→misc. SA cash rounding (nearest 10c) adjusts first basket item. Split tender (cash+card) creates separate API receipt calls with smart item allocation. Unified dynamic search searches accounts, groups, misc items, and prepaid meters simultaneously. Account group/institution search with expandable drill-down. Misc SCOA auto-populates from API (first item, read-only). Prepaid meter can be added from account's linked meter chip. Receipt delivery via print, email, WhatsApp, or SMS. CSV import with 4-step wizard (upload→preview→validate→add): auto-detects headers/delimiters, batch validates accounts against Platinum API (search-accounts + cons-account-details), detects basket and intra-file duplicates, adds validated accounts to basket with pre-filled amounts from CSV.
- **Direct Deposits**: Auto-loading smart grid with column sorting, pagination, search/filter, auto-allocate (description-based account detection with `parseDescriptionForClues` engine — ERF/meter/area/institution detection, confidence scoring), manual allocation queue with multi-source match resolution (account, old account code, ERF, meter, name, bank statement history), allocate transaction with 7 search scopes (ALL/ACCOUNT/PREPAID/CLEARANCE/DIRECT/GROUP/INSTITUTION), clearance cost schedule allocation (Section 118(1) & 118(3) breakdowns), institution auto-expand with smart budget distribution, CSV import with batch validation, allocation history with bank statement note enrichment and job retry polling, auto-allocation with AI matching, bulk CSV processing
- **Enquiries**: Multi-tab account detail view with 30 tab categories (Account, Name, Property, Linked Accounts, Contact, Handover, Services, Meters, Consumption, Balance/Debt, Property Debt, Transaction Detail, Transaction Summary, Receipts, Deposits, Payment Plans, Extensions, Billed vs Paid, Next Bill Estimate, Rates, Debit Orders, Statements, Clearance, Debtor Notes, Section 129, Occupiers, Notifications, Incentives, Indigent Subsidy), quick/advanced search, Excel/CSV and PDF/Print export on all tabs with standardized naming (GEORGE_MUNICIPALITY_[TAB]_[ACCOUNT]_[DATE]). Property tab includes Section 49/78 Letters and Valuation Certificate generation. Occupiers tab supports CRUD + Proof of Residence printing.
- **Supervisor Dashboard**: Day-end approval/decline, cancellation requests, cash reports
- **Receipts**: Search, view, print, cashbook trace, bank statement notes
- **Billing Dashboard**: Category-based alerts with drill-down
- **Debt Management**: Section 129 notices (config, trial review, authorization, reports), handover management/termination/reports, risk scoring, qualification rules, communication timeline/dashboard, batch processing, process monitoring, document templates, digital signatures, process engine
- **Legal Compliance**: Rules CRUD, audit trail, evidence bundles
- **Analytics**: Executive dashboard, predictive forecasting, geographic mapping

## External Dependencies

### External APIs
- **Platinum Inzalo EMS API**: The central dependency for ALL operations. All feature data sourced exclusively from Platinum.

### Frontend Libraries
- Angular 19 (standalone components, signals, lazy routing)
- Tailwind CSS
- Angular CDK (used in shared components)

### Databases
- **PostgreSQL**: Used ONLY for POS core tables: `users`, `cashier_sessions`, `transactions`, and AI chat tables: `conversations`, `messages`. Drizzle ORM for database interactions.

## Phase Deliverable Standard
Every development phase (Phase 1, 2, 3, ...) produces exactly 5 output files. See skill `.agents/skills/phase-deliverables/SKILL.md` for the template and naming conventions.

### Phase Status
- **Phase 0** (Foundation/Analysis) — COMPLETED → `PHASE0_MASTER_MATRIX.md`
- **Phase 1** (Section 129 Notices) — DESIGN COMPLETE, PENDING API TEAM BUILD
- **Phase 2** (Section 129 Configuration) — NOT STARTED (blocked by Phase 1 signoff)

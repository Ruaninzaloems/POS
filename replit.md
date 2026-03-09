# Municipal POS Receipting System V2

## Overview
This project is an Angular 19/Express/PostgreSQL web application for a Municipal Point-of-Sale (POS) Receipting System. Its primary goal is to provide a unified cashier interface for various municipal payments and integrate exclusively with the Platinum Inzalo EMS API. The system validates business logic, UI flows, and data models. Key capabilities include a unified POS screen, split payments, cashier session management, float tracking, day-end reconciliation, supervisor dashboard, direct deposit allocation, receipt management, permit/certificate generation, a Client Communications module, and advanced debt management functionalities. Multi-site support: George Municipality + Inzalo EMS Site02.

## User Preferences
Preferred communication style: Simple, everyday language.
Theme: Platinum SCM Design System — navy primary (`--platinum-primary: #0f2b46`), gold accent (`--platinum-accent: #c9a84c`), white surfaces, Inter font. Layout: sidebar (250px collapsible to 64px) + toolbar (56px) shell with grouped navigation. NO dark slate themes. All pages must use this consistent light theme with CSS variables from `styles.css`.

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
├── services/         (format.service.ts, validation.service.ts, debt-config.ts)
├── app.routes.ts     (50+ lazy-loaded routes)
├── app.config.ts     (HttpClient, Router providers)
└── app.ts            (root component)
```

### Debt & Legal Hybrid Architecture
The Debt & Legal solution employs a hybrid architecture where Replit handles the UI, rules engine, and process orchestration. Platinum serves as the system of record (API only), and Azure Service Bus manages long-running background jobs. Direct synchronous APIs are used for configuration, lookups, enquiries, and status reads. All write actions include full audit metadata.

### Key Features
- **POS & Cashier**: Unified POS screen with account search, payment processing, split payments, cash rounding, receipt generation, cashier session management, float tracking
- **Day-End Reconciliation**: Multi-step submission/approval workflow with denomination counting
- **Direct Deposits**: Manual allocation queue, auto-allocation with AI matching, bulk CSV processing
- **Enquiries**: Multi-tab account detail view with 25+ tab categories, quick/advanced search
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

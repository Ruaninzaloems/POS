# Municipal POS Receipting System V2

## Overview
This project is an Angular 19/Express/PostgreSQL web application for a Municipal Point-of-Sale (POS) Receipting System. Its primary goal is to provide a unified cashier interface for various municipal payments and integrate exclusively with the Platinum Inzalo EMS API. The system validates business logic, UI flows, and data models. Key capabilities include a unified POS screen, split payments, cashier session management, float tracking, day-end reconciliation, supervisor dashboard, direct deposit allocation, receipt management, permit/certificate generation, a Client Communications module, and advanced debt management functionalities. The system supports multi-site deployments for George Municipality and Inzalo EMS Site02.

## User Preferences
Preferred communication style: Simple, everyday language.
Theme: Platinum SCM Design System — navy primary (`--platinum-primary: #0f2b46`), gold accent (`--platinum-accent: #c9a84c`), white surfaces, Inter font. Layout: sidebar (250px collapsible to 64px) + toolbar (56px) shell with grouped navigation. NO dark slate themes. All pages must use this consistent light theme with CSS variables from `styles.css`.
**Date Format Rule**: ALL date displays EVERYWHERE in the UI must use `dd/mm/yyyy` format. Reports and all screens. This is a permanent standard — never use `month: 'short'`, `dateStyle: 'medium'`, or any other format. Date values sent to APIs remain unchanged (ISO format). Use the `padStart(2,'0')` pattern for consistent formatting.

## System Architecture

### Frontend — Angular 19
- **Framework**: Angular 19 with standalone components
- **File Structure**: Separate .component.ts, .component.html, .component.css for every component
- **Styling**: Tailwind CSS with SAMRAS theme CSS custom properties
- **Routing**: Angular Router with lazy-loaded feature routes
- **State Management**: Angular signals
- **HTTP**: Angular HttpClient via ApiService, proxy to Express backend
- **DI Pattern**: `inject()` for dependency injection
- **Location**: `angular-client/` directory

### Backend — Express 5 (Modular Routes)
- **Role**: Pure authenticated proxy to Platinum Inzalo EMS API
- **Route Structure**: Modular files under `server/routes/` for various functionalities including authentication, POS, billing, clearance, enquiries, day-end, deposits, supervisor, receipts, debt, legal, communications, and analytics.
- **Session**: Express-session with PostgreSQL store
- **Deployment**: Express serves Angular build output and API on port 5000 in both development and production. In development, run `cd angular-client && npx ng build --configuration development` to rebuild Angular after frontend changes.

### Debt & Legal Hybrid Architecture
The Debt & Legal solution uses a hybrid architecture:
- **Replit**: Handles UI, rules engine, and process orchestration.
- **Platinum Inzalo EMS API**: Serves as the system of record.
- **Azure Service Bus**: Manages long-running background jobs.
- All write actions include full audit metadata.

### Key Features
- **POS Workflow**: Single-page workflow at `/pos` with three tabs: Session Setup, POS Receipting (multi-type basket, split tender including Cash+Card combined mode with smart allocation, R200 change cap, cash rounding, auto-print receipts, real-time progress tracking, receipt delivery, CSV import), and Day-End Reconciliation. Cash+Card split creates separate receipts per tender type per item with proper API payload separation. Miscellaneous payments use dedicated `billing-payment-miscellaneous/submit` endpoint (PascalCase). Multi-account payments use `submit-multiple-payment`. All payment types generate PDF receipts via `print-receipt`.
- **Direct Deposits**: Auto-loading smart grid with allocation features (auto-allocate with AI matching, manual allocation, multi-source match resolution, CSV import), allocation history, and bulk CSV processing.
- **Enquiries**: Multi-tab account detail view with 30 categories, quick/advanced search, and export capabilities. Includes Section 49/78 Letters and Valuation Certificate generation, and Occupiers tab with CRUD for Proof of Residence printing.
- **Supervisor Dashboard**: Day-end approval/decline, cancellation requests, cash reports.
- **Receipts**: Search, view, print, cashbook trace, bank statement notes.
- **Debt Management**: Section 129 notices, handover management, risk scoring, qualification rules, communication timeline, batch processing, document templates, digital signatures, process engine.
- **Legal Compliance**: Rules CRUD, audit trail, evidence bundles.
- **Analytics**: Executive dashboard, predictive forecasting, geographic mapping.

## External Dependencies

### External APIs
- **Platinum Inzalo EMS API**: The central dependency for all operations and the exclusive source for all feature data.

### Frontend Libraries
- Angular 19
- Tailwind CSS
- Angular CDK

### Databases
- **PostgreSQL**: Used ONLY for POS core tables (`users`, `cashier_sessions`, `transactions`) and AI chat tables (`conversations`, `messages`). Drizzle ORM is used for database interactions.
# Project Implementation Rules

These rules are permanent and non-negotiable. They apply to every development task, every code change, and every feature addition.

## 1. Platinum API Only

- Use only Platinum APIs for all reads and writes.
- No local database for feature data.
- No SQLite.
- No JSON files as storage.
- No mock persistence.
- No fallback data in live flows.
- No business data may live only in frontend state.
- All important process results, statuses, files, audit entries, approvals, and run outputs must be persisted through Platinum APIs.
- If the API does not exist, fail clearly and log it as a missing Platinum dependency.
- Never create a local database workaround.
- Never simulate successful processing if Platinum integration is missing.
- Never hardcode live business data.
- The local PostgreSQL database is used ONLY for POS core tables: users, cashier_sessions, transactions.

## 2. Angular-Ready Architecture Always

- Even if the current UI is React, structure the app so migration to Angular is easy and low-risk.
- No React-only architecture decisions that are hard to migrate.
- Minimize custom hooks for business logic.
- Keep forms, validation, state, and API mapping framework-neutral.
- Use typed request and response models everywhere.
- Build screens as container + reusable child components.
- Keep shared UI primitives reusable and easy to recreate in Angular.
- Avoid React libraries that lock the project into React-specific patterns.
- Business logic in plain TypeScript services, not in components.
- Components are presentational only.
- Models, DTOs, validation schemas, and permissions in reusable framework-neutral files.

## 3. Deployment-Ready Code Always

- The codebase must remain production-structured after every change.
- No temporary hacks.
- No dev-only shortcuts left behind.
- Ensure clean build with no warnings that affect production quality.
- Keep config externalized by environment.
- Ensure error handling is production-safe.
- Ensure loading, empty, error, and retry states exist on all API-backed screens.
- Ensure all routes, services, and modules can run in a production deployment without code changes.
- Remove dead code, unused files, and temporary test scaffolding after each change.

## 4. Project Structure Rules

- Use feature-based folders: config, section129, handover, enquiries, reports, dashboard, shared, core.
- Put all API logic in centralized service files.
- Put all business rules in plain TypeScript services, not in components.
- Keep components presentational where possible.
- Keep models, DTOs, validation schemas, and permissions in reusable framework-neutral files.
- Keep routes centralized and feature-based.
- Keep environment config clean for dev, qa, uat, prod.

## 5. API-Only Enforcement Rules

- Any feature that needs data must first check for a Platinum API.
- If the API does not exist, fail clearly and log it as a missing Platinum dependency.
- Never create a local database workaround.
- Never simulate successful processing if Platinum integration is missing.
- Never hardcode live business data.

## 6. Post-Change Compliance Review Required

After every development task, a compliance review must confirm ALL of the following:

1. Platinum APIs only were used
2. No local database was introduced
3. No mock or fallback persistence was introduced
4. Angular-ready structure was preserved
5. Deployment-ready structure was preserved
6. Business logic remains outside UI components
7. API contracts remain typed
8. Environment handling still works correctly
9. No feature was built in a way that blocks future Angular migration
